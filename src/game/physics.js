import RAPIER from '@dimforge/rapier3d-compat'

import { BULLET_GROUPS, GRENADE_GROUPS, interactionGroups, WALK_GROUPS } from '../shared/constants.js'
import { buildColliders, NAV_CHAINS, NAV_EXTRA_NODES, NAV_GRID } from '../shared/map.js'

let initPromise = null

/** Rapier ships as WASM; it must finish loading before any world is built. */
export function initPhysics() {
  if (!initPromise) initPromise = RAPIER.init({})
  return initPromise
}

const GRENADE_GRAVITY = -16

/**
 * One Rapier world per room: the static map plus any grenades in flight.
 *
 * Players are deliberately NOT bodies here. Clients own their own movement and the
 * server only needs the map for line-of-sight, bullet occlusion, bot footing and
 * grenade bounces.
 */
export class MapWorld {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: GRENADE_GRAVITY, z: 0 })
    this.world.timestep = 1 / 30

    for (const c of buildColliders()) {
      const desc =
        c.shape === 'box'
          ? RAPIER.ColliderDesc.cuboid(c.half[0], c.half[1], c.half[2])
          : RAPIER.ColliderDesc.cylinder(c.halfHeight, c.r)
      desc
        .setTranslation(c.p[0], c.p[1], c.p[2])
        .setRotation({ x: c.q[0], y: c.q[1], z: c.q[2], w: c.q[3] })
        .setCollisionGroups(interactionGroups(c.group, 0xffff))
        .setRestitution(0.3)
        .setFriction(0.8)
      this.world.createCollider(desc)
    }

    this._ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })
    // Build the broad-phase now so queries work before the first tick.
    this.world.step()
  }

  step(dt) {
    this.world.timestep = Math.min(Math.max(dt, 1 / 120), 1 / 15)
    this.world.step()
  }

  /** Distance to the first map hit along a normalised direction, or null. */
  raycast(o, d, maxDist, groups = BULLET_GROUPS) {
    const ray = this._ray
    ray.origin = { x: o[0], y: o[1], z: o[2] }
    ray.dir = { x: d[0], y: d[1], z: d[2] }
    const hit = this.world.castRay(ray, maxDist, true, undefined, groups)
    return hit ? hit.timeOfImpact : null
  }

  /** True if nothing solid sits between a and b (ignoring the last `slack` metres). */
  clearLine(a, b, slack = 0.05, groups = BULLET_GROUPS) {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const dz = b[2] - a[2]
    const len = Math.hypot(dx, dy, dz)
    if (len < 1e-4) return true
    const toi = this.raycast(a, [dx / len, dy / len, dz / len], len, groups)
    return toi === null || toi >= len - slack
  }

  /**
   * True if there's walkable floor just under feet at (x, y, z): five short rays
   * (centre + four round the capsule) so standing on an edge still counts.
   */
  onGround(x, y, z, reach = 0.22) {
    for (const [ox, oz] of [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) {
      const toi = this.raycast([x + ox, y + 0.25, z + oz], [0, -1, 0], 0.25 + reach, WALK_GROUPS)
      if (toi !== null) return true
    }
    return false
  }

  /** Floor height under (x, z), probing down from `fromY`. */
  groundY(x, fromY, z, maxDown = 40) {
    const toi = this.raycast([x, fromY, z], [0, -1, 0], maxDown, WALK_GROUPS)
    return toi === null ? null : fromY - toi
  }

  /** Spawns a grenade body. Grenades bounce off walls and railings, not each other. */
  addGrenade(pos, vel) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(pos[0], pos[1], pos[2])
        .setLinvel(vel[0], vel[1], vel[2])
        .setLinearDamping(0.15)
        .setAngularDamping(2.5)
        .setCcdEnabled(true),
    )
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(0.07)
        .setDensity(250)
        .setRestitution(0.35)
        .setFriction(0.9)
        .setCollisionGroups(GRENADE_GROUPS),
      body,
    )
    return body
  }

  removeBody(body) {
    if (body) this.world.removeRigidBody(body)
  }

  dispose() {
    this.world.free()
  }
}

/* ---------------------------------------------------------------------------
 * Navigation graph
 * ------------------------------------------------------------------------- */

let navCache = null

/** Is there room for a standing bot (knee to head) with its feet at (x, y, z)? */
function standable(mapWorld, x, y, z) {
  const ball = new RAPIER.Ball(0.42)
  const rot = { x: 0, y: 0, z: 0, w: 1 }
  for (const h of [0.55, 1.4]) {
    if (mapWorld.world.intersectionWithShape({ x, y: y + h, z }, rot, ball, undefined, WALK_GROUPS)) return false
  }
  return true
}

/** Is a bot-wide corridor between two ground points clear at knee and chest height? */
function corridorClear(mapWorld, a, b) {
  const dx = b[0] - a[0]
  const dz = b[2] - a[2]
  const d = Math.hypot(dx, dz)
  if (d < 0.01) return true
  const px = (-dz / d) * 0.32
  const pz = (dx / d) * 0.32
  for (const h of [0.45, 1.3]) {
    for (const side of [-1, 0, 1]) {
      const from = [a[0] + px * side, a[1] + h, a[2] + pz * side]
      const to = [b[0] + px * side, b[1] + h, b[2] + pz * side]
      if (!mapWorld.clearLine(from, to, 0, WALK_GROUPS)) return false
    }
  }
  return true
}

/**
 * Builds the bot waypoint graph once per process.
 *
 * Ground nodes come from a grid laid over the map, keeping only points where the
 * floor is near ground level and a bot fits; hand-placed extras fill doorways and
 * narrow gaps. Ground nodes link to their neighbours when a bot-wide corridor is
 * clear. Elevated routes (stairs, tank tops, ramps) come from the map's chains.
 */
export function getNavGraph(mapWorld) {
  if (navCache) return navCache
  const nodes = []
  const links = []
  const kinds = []
  const addNode = (p, kind) => {
    nodes.push(p)
    links.push([])
    kinds.push(kind)
    return nodes.length - 1
  }
  const link = (i, j) => {
    if (i === j || links[i].some((l) => l.to === j)) return
    const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1], nodes[i][2] - nodes[j][2])
    links[i].push({ to: j, cost: d })
    links[j].push({ to: i, cost: d })
  }

  const { spacing, half } = NAV_GRID
  for (let x = -half; x <= half + 1e-6; x += spacing) {
    for (let z = -half; z <= half + 1e-6; z += spacing) {
      const floor = mapWorld.groundY(x, 1.7, z, 3)
      if (floor === null || floor > 0.5) continue
      if (standable(mapWorld, x, floor, z)) addNode([x, floor, z], 'grid')
    }
  }
  for (const p of NAV_EXTRA_NODES) {
    const floor = mapWorld.groundY(p[0], p[1] + 1.2, p[2], 3) ?? p[1]
    if (standable(mapWorld, p[0], floor, p[2])) addNode([p[0], floor, p[2]], 'extra')
  }
  const chainLinks = []
  for (const chain of NAV_CHAINS) {
    const ids = chain.map((p, i) => addNode([...p], i === 0 ? 'extra' : 'elevated'))
    for (let i = 1; i < ids.length; i++) chainLinks.push([ids[i - 1], ids[i]])
  }

  // Ground links: grid neighbours (incl. diagonals) and anything near an extra.
  const ground = nodes.map((_, i) => i).filter((i) => kinds[i] !== 'elevated')
  const reachGrid = spacing * 1.5
  for (let a = 0; a < ground.length; a++) {
    for (let b = a + 1; b < ground.length; b++) {
      const i = ground[a]
      const j = ground[b]
      const reach = kinds[i] === 'grid' && kinds[j] === 'grid' ? reachGrid : 4.5
      const d = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][2] - nodes[j][2])
      if (d > reach || Math.abs(nodes[i][1] - nodes[j][1]) > 0.4) continue
      if (corridorClear(mapWorld, nodes[i], nodes[j])) link(i, j)
    }
  }
  for (const [i, j] of chainLinks) link(i, j)

  // Keep only what's reachable from open ground near the tower; pockets under
  // ramps or on rubble would otherwise strand a bot that picked them.
  let root = 0
  let rootD = Infinity
  nodes.forEach((n, i) => {
    const d = Math.hypot(n[0], n[2] - 6)
    if (kinds[i] === 'grid' && d < rootD) {
      rootD = d
      root = i
    }
  })
  const keep = new Set([root])
  const queue = [root]
  while (queue.length) {
    const u = queue.pop()
    for (const { to } of links[u]) {
      if (!keep.has(to)) {
        keep.add(to)
        queue.push(to)
      }
    }
  }
  const remap = new Map()
  const kept = []
  nodes.forEach((n, i) => {
    if (!keep.has(i)) return
    remap.set(i, kept.length)
    kept.push(i)
  })
  navCache = {
    nodes: kept.map((i) => nodes[i]),
    kinds: kept.map((i) => kinds[i]),
    links: kept.map((i) => links[i].filter((l) => remap.has(l.to)).map((l) => ({ to: remap.get(l.to), cost: l.cost }))),
  }
  return navCache
}

/** Dijkstra over the (small) nav graph. Returns node indices from start to goal, inclusive. */
export function findPath(graph, start, goal) {
  if (start === goal) return [start]
  const n = graph.nodes.length
  const dist = new Float64Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const done = new Uint8Array(n)
  dist[start] = 0
  for (;;) {
    let u = -1
    let best = Infinity
    for (let i = 0; i < n; i++) {
      if (!done[i] && dist[i] < best) {
        best = dist[i]
        u = i
      }
    }
    if (u === -1 || u === goal) break
    done[u] = 1
    for (const { to, cost } of graph.links[u]) {
      const nd = dist[u] + cost
      if (nd < dist[to]) {
        dist[to] = nd
        prev[to] = u
      }
    }
  }
  if (dist[goal] === Infinity) return null
  const path = []
  for (let v = goal; v !== -1; v = prev[v]) path.unshift(v)
  return path
}

/** Nearest node, preferring one with a clear walk line from `pos`. */
export function nearestNode(graph, mapWorld, pos, needLine = true) {
  let best = -1
  let bestD = Infinity
  let fallback = -1
  let fallbackD = Infinity
  graph.nodes.forEach((n, i) => {
    const d = Math.hypot(n[0] - pos[0], (n[1] - pos[1]) * 2, n[2] - pos[2])
    if (d < fallbackD) {
      fallbackD = d
      fallback = i
    }
    if (d >= bestD || d > 14) return
    if (!needLine || mapWorld.clearLine([pos[0], pos[1] + 0.6, pos[2]], [n[0], n[1] + 0.6, n[2]], 0, WALK_GROUPS)) {
      bestD = d
      best = i
    }
  })
  return best >= 0 ? best : fallback
}
