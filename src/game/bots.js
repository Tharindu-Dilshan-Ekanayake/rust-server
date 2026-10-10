/**
 * Server-side bots.
 *
 * Bots are ordinary PlayerState entries driven from the room's simulation tick.
 * They see through the same map raycasts as everyone else, can't see through
 * smoke, and their shots go through the room's normal damage path. Hit rolls are
 * probabilistic rather than simulated bullets, tuned so a bot is a threat in the
 * open but beatable by flanking or using cover.
 */
import { eyeHeightFor, PLAYER, stanceOf, WALK_GROUPS } from '../shared/constants.js'
import { MAP_HALF } from '../shared/map.js'
import { chestPoint, headPoint } from '../shared/hitbox.js'
import { angleDelta, clamp } from '../shared/math.js'
import { effectiveWeapon, EQUIPMENT, WEAPONS } from '../shared/weapons.js'
import { findPath, nearestNode } from './physics.js'

export const BOT_NAMES = [
  'Viper', 'Rook', 'Nomad', 'Sable', 'Kestrel', 'Dune', 'Mako', 'Talon',
  'Jinx', 'Havoc', 'Onyx', 'Raptor', 'Ghost', 'Brick', 'Ember', 'Static',
]

const GRENADE_G = 16

export function createBotBrain() {
  return {
    skill: 0.85 + Math.random() * 0.3,
    path: null,
    pathIdx: 0,
    target: null,
    hasLine: false,
    reactionAt: 0,
    nextShotAt: 0,
    burst: 0,
    strafeDir: 0,
    strafeUntil: 0,
    lastKnown: null,
    lastKnownAt: 0,
    flashedUntil: 0,
    reloadUntil: 0,
    mag: 30,
    nextThinkAt: 0,
    grenadeReadyAt: 0,
    stuckCheckAt: 0,
    stuckPos: null,
    meleeReadyAt: 0,
    aimNoiseYaw: 0,
    aimNoisePitch: 0,
  }
}

/** Fresh per-life state. */
export function resetBotBrain(brain, cls) {
  brain.path = null
  brain.target = null
  brain.lastKnown = null
  brain.burst = 0
  brain.flashedUntil = 0
  brain.reloadUntil = 0
  brain.mag = effectiveWeapon(cls.primary, cls.primaryAtt).magSize
  brain.grenadeReadyAt = Date.now() + 8000 + Math.random() * 8000
}

const eyeOf = (p) => [p.x, p.y + eyeHeightFor(stanceOf(p)), p.z]

function think(room, p, meta, now) {
  const b = meta.bot
  const eye = eyeOf(p)
  const fx = -Math.sin(p.yaw)
  const fz = -Math.cos(p.yaw)

  let best = null
  let bestD = Infinity
  for (const other of room.state.players.values()) {
    if (other === p || other.state !== 'alive' || !room.isEnemy(p, other)) continue
    const chest = chestPoint(other.x, other.y, other.z, stanceOf(other), other.yaw)
    const dx = chest[0] - eye[0]
    const dz = chest[2] - eye[2]
    const d = Math.hypot(dx, chest[1] - eye[1], dz)
    if (d > 70) continue
    const hurtBy = meta.lastAttacker === other.id && now - meta.lastDamageAt < 2500
    if (d > 5 && !hurtBy) {
      const flat = Math.hypot(dx, dz) || 1
      if ((dx * fx + dz * fz) / flat < 0.34) continue // outside a ~140 degree cone
    }
    const head = headPoint(other.x, other.y, other.z, stanceOf(other), other.yaw)
    if (!room.canSee(eye, chest) && !room.canSee(eye, head)) continue
    if (d < bestD) {
      best = other
      bestD = d
    }
  }

  if (best) {
    if (b.target !== best.id) {
      b.target = best.id
      b.reactionAt = now + (230 + Math.random() * 340 + bestD * 5) / b.skill
      b.burst = 0
    }
    b.hasLine = true
    b.lastKnown = [best.x, best.y, best.z]
    b.lastKnownAt = now
  } else {
    b.target = null
    b.hasLine = false
    // Something just shot us from out of view: turn toward it.
    if (meta.lastAttacker && now - meta.lastDamageAt < 1500) {
      const attacker = room.state.players.get(meta.lastAttacker)
      if (attacker && attacker.state === 'alive') {
        b.lastKnown = [attacker.x, attacker.y, attacker.z]
        b.lastKnownAt = now
      }
    }
    maybeThrowGrenade(room, p, meta, now)
  }

  // Aim wobble drifts slowly so consecutive shots don't all land in one spot.
  b.aimNoiseYaw = clamp(b.aimNoiseYaw + (Math.random() - 0.5) * 0.03, -0.05, 0.05)
  b.aimNoisePitch = clamp(b.aimNoisePitch + (Math.random() - 0.5) * 0.02, -0.03, 0.03)
}

function maybeThrowGrenade(room, p, meta, now) {
  const b = meta.bot
  if (!b.lastKnown || meta.lethal <= 0 || now < b.grenadeReadyAt) return
  const age = now - b.lastKnownAt
  if (age < 500 || age > 4000 || Math.random() > 0.3) return
  const eye = eyeOf(p)
  const dx = b.lastKnown[0] - eye[0]
  const dz = b.lastKnown[2] - eye[2]
  const R = Math.hypot(dx, dz)
  if (R < 6 || R > 22) return
  const h = b.lastKnown[1] - eye[1]
  const theta = 0.62
  const denom = 2 * Math.cos(theta) ** 2 * (R * Math.tan(theta) - h)
  if (denom <= 0) return
  const v = Math.min(Math.sqrt((GRENADE_G * R * R) / denom), 20)
  const vel = [(dx / R) * v * Math.cos(theta), v * Math.sin(theta), (dz / R) * v * Math.cos(theta)]
  const origin = [eye[0] + (dx / R) * 0.5, eye[1], eye[2] + (dz / R) * 0.5]
  meta.lethal -= 1
  b.grenadeReadyAt = now + 12000 + Math.random() * 6000
  room.spawnGrenade(p, 'frag', origin, vel, EQUIPMENT.frag.fuse)
}

function planPath(room, p, meta, now) {
  const b = meta.bot
  const graph = room.nav
  const start = nearestNode(graph, room.mapWorld, [p.x, p.y, p.z])
  let goal = -1
  if (b.lastKnown && now - b.lastKnownAt < 6000) {
    goal = nearestNode(graph, room.mapWorld, b.lastKnown, false)
  } else if (Math.random() < 0.55) {
    const enemies = [...room.state.players.values()].filter(
      (o) => o !== p && o.state === 'alive' && room.isEnemy(p, o),
    )
    if (enemies.length) {
      const e = enemies[Math.floor(Math.random() * enemies.length)]
      goal = nearestNode(graph, room.mapWorld, [e.x, e.y, e.z], false)
    }
  }
  if (goal < 0) {
    // Snipers like to perch on the tanks half the time.
    const wantHigh = meta.activeClass?.primary === 'sniper' && Math.random() < 0.5
    const pool = graph.nodes
      .map((_n, i) => i)
      .filter((i) => (wantHigh ? graph.nodes[i][1] > 1 : graph.nodes[i][1] <= 1))
    goal = pool.length ? pool[Math.floor(Math.random() * pool.length)] : start
  }
  b.path = findPath(graph, start, goal) || [start]
  b.pathIdx = 0
}

/** Moves the bot by (dx, dz), keeping its feet on the floor. Returns false if blocked. */
function step(room, p, dx, dz, allowDrop) {
  const len = Math.hypot(dx, dz)
  if (len < 1e-5) return true
  const nx = dx / len
  const nz = dz / len
  for (const h of [0.5, 1.3]) {
    const toi = room.mapWorld.raycast([p.x, p.y + h, p.z], [nx, 0, nz], len + 0.38, WALK_GROUPS)
    if (toi !== null) return false
  }
  const x = clamp(p.x + dx, -MAP_HALF + 0.6, MAP_HALF - 0.6)
  const z = clamp(p.z + dz, -MAP_HALF + 0.6, MAP_HALF - 0.6)
  const y = room.mapWorld.groundY(x, p.y + 1.0, z)
  if (y === null) return false
  if (!allowDrop && y < p.y - 0.9) return false
  p.x = x
  p.z = z
  p.y = y
  return true
}

export function tickBot(room, p, meta, dt, now) {
  const b = meta.bot
  if (p.state !== 'alive') return

  if (now >= b.nextThinkAt) {
    b.nextThinkAt = now + 110 + Math.random() * 70
    think(room, p, meta, now)
  }

  const weapon = effectiveWeapon(meta.activeClass.primary, meta.activeClass.primaryAtt)
  const flashed = now < b.flashedUntil
  const target = b.target ? room.state.players.get(b.target) : null
  const targetAlive = target && target.state === 'alive'
  const eye = eyeOf(p)

  // --- Aim ------------------------------------------------------------------
  let wantYaw = p.yaw
  let wantPitch = 0
  let targetDist = Infinity
  if (targetAlive && !flashed) {
    const c = chestPoint(target.x, target.y, target.z, stanceOf(target), target.yaw)
    const dx = c[0] - eye[0]
    const dy = c[1] - eye[1]
    const dz = c[2] - eye[2]
    targetDist = Math.hypot(dx, dy, dz)
    wantYaw = Math.atan2(-dx, -dz) + b.aimNoiseYaw
    wantPitch = Math.atan2(dy, Math.hypot(dx, dz)) + b.aimNoisePitch
  } else if (b.lastKnown && now - b.lastKnownAt < 3000 && !flashed) {
    wantYaw = Math.atan2(-(b.lastKnown[0] - p.x), -(b.lastKnown[2] - p.z))
  }

  // --- Movement ---------------------------------------------------------------
  let moveX = 0
  let moveZ = 0
  let speed = PLAYER.walkSpeed * weapon.moveMultiplier * 0.92
  let followingPath = false

  if (flashed) {
    if (now >= b.strafeUntil) {
      b.strafeDir = Math.random() * Math.PI * 2
      b.strafeUntil = now + 400 + Math.random() * 500
    }
    moveX = Math.sin(b.strafeDir)
    moveZ = Math.cos(b.strafeDir)
    speed *= 0.6
    wantYaw = p.yaw + (Math.random() - 0.5) * 0.6
  } else if (targetAlive && b.hasLine) {
    const chase = weapon.id === 'ar' && targetDist > 26
    const close = targetDist < 2.6
    if (close) {
      // Knife range: close the last bit.
      moveX = target.x - p.x
      moveZ = target.z - p.z
    } else if (chase) {
      followingPath = true
    } else if (p.y < 1 && weapon.id !== 'sniper') {
      if (now >= b.strafeUntil) {
        const r = Math.random()
        b.strafeDir = r < 0.2 ? 0 : r < 0.6 ? -1 : 1
        b.strafeUntil = now + 450 + Math.random() * 900
      }
      // Strafe perpendicular to the line of fire.
      const tx = target.x - p.x
      const tz = target.z - p.z
      const tl = Math.hypot(tx, tz) || 1
      moveX = (-tz / tl) * b.strafeDir
      moveZ = (tx / tl) * b.strafeDir
      speed *= 0.55
    }
  } else {
    followingPath = true
  }

  if (followingPath) {
    if (!b.path || b.pathIdx >= b.path.length) planPath(room, p, meta, now)
    const node = room.nav.nodes[b.path[b.pathIdx]]
    if (node) {
      const dx = node[0] - p.x
      const dz = node[2] - p.z
      if (Math.hypot(dx, dz) < 0.45) {
        b.pathIdx += 1
      } else {
        moveX = dx
        moveZ = dz
        if (!targetAlive && !(b.lastKnown && now - b.lastKnownAt < 3000)) {
          wantYaw = Math.atan2(-dx, -dz)
        }
      }
    }
    // Stuck detection: if we've barely moved in a while, pick somewhere else.
    if (now >= b.stuckCheckAt) {
      if (b.stuckPos && Math.hypot(p.x - b.stuckPos[0], p.z - b.stuckPos[1]) < 0.4) {
        b.lastKnown = null
        b.path = null
      }
      b.stuckPos = [p.x, p.z]
      b.stuckCheckAt = now + 2000
    }
  }

  const ml = Math.hypot(moveX, moveZ)
  let moving = false
  if (ml > 1e-4) {
    const s = Math.min(speed * dt, ml)
    const ok = step(room, p, (moveX / ml) * s, (moveZ / ml) * s, followingPath)
    if (!ok && !followingPath) b.strafeDir = -b.strafeDir
    if (!ok && followingPath) b.path = null
    moving = ok
  }
  p.sprint = false
  p.ads = Boolean(targetAlive && b.hasLine && !flashed && targetDist > 12)

  // Turn toward the wanted aim at a capped rate.
  const turn = 5.5 * b.skill * dt
  p.yaw += clamp(angleDelta(p.yaw, wantYaw), -turn, turn)
  p.pitch += clamp(wantPitch - p.pitch, -turn, turn)
  meta.botMoving = moving

  // --- Attack -----------------------------------------------------------------
  if (!targetAlive || !b.hasLine || flashed || now < b.reactionAt) return

  if (targetDist < 2.2 && now >= b.meleeReadyAt) {
    b.meleeReadyAt = now + WEAPONS.knife.fireInterval * 1000
    room.botMelee(p, target, Math.random() < 0.7)
    return
  }

  if (now < b.reloadUntil || now < b.nextShotAt) return
  const aimErr =
    Math.abs(angleDelta(p.yaw, Math.atan2(-(target.x - p.x), -(target.z - p.z)))) + Math.abs(wantPitch - p.pitch)
  if (aimErr > 0.18) return

  if (b.mag <= 0) {
    b.mag = weapon.magSize
    b.reloadUntil = now + weapon.reloadTime * 1000 + 200
    return
  }
  b.mag -= 1

  let pHit
  let headChance
  if (weapon.id === 'sniper') {
    b.nextShotAt = now + 1500 + Math.random() * 900
    pHit = 0.5
    headChance = 0.25
  } else {
    if (b.burst <= 0) b.burst = 3 + Math.floor(Math.random() * 5)
    b.burst -= 1
    b.nextShotAt = now + weapon.fireInterval * 1000 * 1.25 + (b.burst === 0 ? 280 + Math.random() * 450 : 0)
    pHit = clamp(0.62 - targetDist * 0.009, 0.14, 0.62)
    headChance = 0.12
  }
  if (target.sprint) pHit *= 0.75
  if (target.prone) pHit *= 0.7
  else if (target.crouch || target.slide) pHit *= 0.85
  if (meta.botMoving) pHit *= 0.85
  pHit = clamp(pHit * b.skill, 0.05, 0.85)

  const hit = Math.random() < pHit
  const r = Math.random()
  const zone = r < headChance ? 'head' : r < headChance + 0.45 ? 'chest' : 'body'
  room.botShot(p, target, weapon.id, hit, zone)
}

/** Bots react to gunfire they can hear. */
export function botHearNoise(room, meta, pos, now) {
  const b = meta.bot
  if (b.target) return
  b.lastKnown = pos
  b.lastKnownAt = now
  if (Math.random() < 0.5) b.path = null
}
