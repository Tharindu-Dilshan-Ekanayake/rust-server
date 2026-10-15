/**
 * "Pinecrest Lodge" — a timber lodge in the mountains in autumn, as data.
 *
 * South of the middle, on level ground, the lodge: two storeys of green board
 * and batten on a stone base, its wing on the east side, a gravel courtyard
 * in front with the cars. A creek runs right across the map from the hills in
 * the east to the lake on the west, in a gully you can drop into anywhere;
 * near the east end it pours over a rock step (the waterfall), and below it
 * the south bank is a cliff, climbed by a timber stair. Crossings: the road's
 * concrete bridge, a footbridge, a few planks across the stream. North of the
 * creek: the guest cabin; two granite outcrops (a ramp of rock up each); the
 * workshop with its garage door; the power substation in its fenced yard.
 * West, the lake: the boathouse on the bluff above it, its deck and a stair
 * down to the dock. South-east of the lodge, the glasshouse (its glass
 * breaks); south-west the stone stable; birches turning gold and dark pines
 * everywhere, granite boulders, logs and stumps.
 *
 * Coordinates are metres. +X is east, -Z north, +Y up. Level ground is y = 0
 * (everything built stands on it); the creek, the lake shore, the outcrops and
 * the hills round the edge are one triangle mesh shared by the physics and the
 * renderer (pinecrestGround). The arena is 100 x 100 m. Everything is listed
 * once as entities; the client draws them and BOTH sides build their physics
 * from `buildPinecrestColliders()`.
 */
import { TEAMS } from './constants.js'
import { glassPane } from './glass.js'
import { CAR_MODELS, houseColliders, houseOpenings } from './mapAcres.js'
import { smoothLine } from './mapBramble.js'
import { boundaryColliders, boxC, cylC, groundBox, IDENTITY_Q, ladderIn, meshC, MOVE_ONLY, quatFromEuler, rampBox, segmentCyl, yawOffset, yawQ } from './mapKit.js'
import { seededRandom } from './math.js'

export const PINECREST_NAME = 'Pinecrest Lodge'
export const PINECREST_HALF = 50

const entities = []
const add = (e) => {
  entities.push(e)
  return e
}

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
const lerp = (a, b, t) => a + (b - a) * t
/** 1 at `c`, easing to 0 at `r` away. */
const bump = (x, c, r) => {
  const d = Math.abs(x - c) / r
  return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(d * Math.PI)
}

/* ---------------------------------------------------------------------------
 * The ground: level land, the lake's bluff, the creek's gully, the outcrops,
 * a few gentle mounds, the hills rising past the edge
 * ------------------------------------------------------------------------- */

/** The lake along the west edge: its water level, and the ground's at the waterline. */
export const LAKE = Object.freeze({ level: -3.8, shore: -3.55 })
/** The shoreline's x at z (west of it, water). */
export const shoreX = (z) => -43 + 1.2 * Math.sin(z * 0.08 + 0.6) + 0.6 * Math.sin(z * 0.21 + 2.0)
/** How far inland the bluff runs up from the waterline to level ground (a rock face past the stable). */
const bluffW = (z) => 5.2 - 2.2 * bump(z, 32, 9)

/**
 * The creek, east to west: its middle line, the gully's half-widths (lip,
 * bed), and the waterfall where its bed drops a metre and a half. Below the
 * fall, along the glasshouse's stretch, the south bank is a cliff.
 */
export const CREEK = Object.freeze({
  points: [[58, -9.5], [46, -7], [36, -3.5], [28, -0.6], [20, 1.4], [10, 3.0], [0, 3.6], [-10, 4.0], [-20, 4.6], [-30, 6.2], [-38, 8.6], [-48, 11.0], [-60, 13.0]],
  top: 5.9,
  bed: 1.5,
  fallX: 28.0,
  /** The south bank's cliff: centre and reach along x. */
  cliff: [23.0, 8.0],
})
const CREEK_LINE = smoothLine(CREEK.points, 3)

/** The creek's middle line: its z at x (the line runs east to west, x falling along it). */
export function creekZ(x) {
  const L = CREEK_LINE
  if (x >= L[0][0]) return L[0][1]
  for (let i = 1; i < L.length; i++) {
    const [ax, az] = L[i - 1]
    const [bx, bz] = L[i]
    if (x >= bx) return az + ((x - ax) * (bz - az)) / (bx - ax)
  }
  return L[L.length - 1][1]
}
const creekZAt = creekZ
const creekSlope = (x) => creekZAt(x + 0.5) - creekZAt(x - 0.5)

/**
 * The creek bed's height at x: shallow and rising east above the fall; below
 * it, down to the lake. The fall itself pours down a rock chute over
 * FALL_RUN metres: steep, but you can climb it (the ground mesh is a metre
 * apart, so a shorter step would come out steeper than anyone can walk).
 */
export const FALL_RUN = 2.6
export function creekBedY(x) {
  const f = CREEK.fallX
  const h = FALL_RUN / 2
  const above = -1.05 + Math.max(0, x - f) * 0.022
  const below = -2.6 - Math.max(0, f - 0.5 - x) * (0.5 / 67.5)
  if (x >= f + h) return above
  if (x <= f - h) return below
  return lerp(below, above, (x - (f - h)) / FALL_RUN)
}
/** The water's surface in the creek at x: a shallow stream over the stones. */
export const creekWaterY = (x) => creekBedY(x) + 0.1

/** The gully's section at x: the lips each side (north +), the bed's half-width. */
export function creekSection(x) {
  return {
    z: creekZAt(x),
    topN: CREEK.top + 0.3 * Math.sin(x * 0.13 + 1.1),
    topS: CREEK.top + 0.3 * Math.sin(x * 0.17 + 0.3) - 2.9 * bump(x, CREEK.cliff[0], CREEK.cliff[1]),
    bed: CREEK.bed + 0.2 * Math.sin(x * 0.21 + 2.0),
    bedY: creekBedY(x),
  }
}

/**
 * A bank's fall from its lip (f = 0) to its foot (f = 1): nearly straight, a
 * little rounded over at both, so nowhere steeper than a bot can climb (~36°).
 */
const bankCurve = (f) => 0.85 * f + 0.15 * f * f * (3 - 2 * f)

/** Off the creek's line at (x, z): the offset square to it (north +) and the section there. */
function creekLocal(x, z) {
  const k = creekSlope(x)
  const c = 1 / Math.hypot(1, k)
  const dz = z - creekZAt(x)
  return { o: -dz * c, s: creekSection(x + dz * k * c * c) }
}

/** The creek's carve at (x, z) from the land's height there, or null outside the gully. */
function creekCarve(x, z, land) {
  const { o, s } = creekLocal(x, z)
  const top = o >= 0 ? s.topN : s.topS
  const a = Math.abs(o)
  if (a >= top) return null
  if (a <= s.bed) return s.bedY - 0.06 * (1 - (a / s.bed) ** 2)
  return land + (s.bedY - land) * bankCurve((top - a) / (top - s.bed))
}

/** True if (x, z) is in the gully, or within `margin` of its lips. */
export function inCreek(x, z, margin = 0) {
  const { o, s } = creekLocal(x, z)
  return Math.abs(o) < (o >= 0 ? s.topN : s.topS) + margin
}

/** The lake's carve: the bluff up from the waterline, the lake bed under the water; null inland. */
function lakeCarve(x, z, land) {
  const d = x - shoreX(z)
  const w = bluffW(z)
  if (d >= w) return null
  if (d >= 0) return LAKE.shore + (land - LAKE.shore) * smooth(d / w)
  // Shallow inside the arena: you can wade in, waist deep at most.
  return LAKE.shore - Math.min(1.0, -d * 0.4)
}

/**
 * Granite outcrops: an oval of rock (a wobbly rim, steep sides, a lumpy top
 * `h` up) and a ramp of rock up one side from `from` (on the ground) to `to`
 * (on top), `w` wide, at full height `full` of the way along (before the
 * rock's own steep rim rises past it, so there's no lip at the top).
 */
export const OUTCROPS = Object.freeze([
  { id: 'big', c: [-14, -15], r: [8.5, 5.6], rot: 0.35, h: 3.4, ramp: { from: [-27.9, -12.9], to: [-20.4, -14.4], w: 3.6, full: 0.75 } },
  { id: 'east', c: [24, -13], r: [6.4, 4.4], rot: -0.25, h: 2.8, ramp: { from: [27.8, -24.8], to: [25.2, -17.4], w: 3.2 } },
])

function outcropY(o, x, z) {
  const dx = x - o.c[0]
  const dz = z - o.c[1]
  const c = Math.cos(o.rot)
  const s = Math.sin(o.rot)
  const u = (dx * c - dz * s) / o.r[0]
  const v = (dx * s + dz * c) / o.r[1]
  const e = Math.hypot(u, v)
  const a = Math.atan2(v, u)
  const rim = 1 + 0.1 * Math.sin(a * 3 + o.c[0]) + 0.06 * Math.sin(a * 5 + o.c[1])
  const inside = (rim - e) * Math.min(o.r[0], o.r[1])
  // (Off the rock and its ramp: nothing to add, so the gully and the lake still cut below 0.)
  let y = null
  if (inside > 0) y = o.h * smooth(inside / 1.3) + 0.22 * smooth((inside - 1.3) / 2) * Math.sin(x * 0.9 + z * 0.7)
  const r = o.ramp
  if (r) {
    const [ax, az] = r.from
    const L = Math.hypot(r.to[0] - ax, r.to[1] - az)
    const ux = (r.to[0] - ax) / L
    const uz = (r.to[1] - az) / L
    const t = ((x - ax) * ux + (z - az) * uz) / L
    const side = Math.abs(-(x - ax) * uz + (z - az) * ux)
    if (t > 0 && t < 1.3 && side < r.w / 2 + 0.8) y = Math.max(y ?? 0, o.h * Math.min(1, t / (r.full ?? 1)) * (1 - smooth((side - r.w / 2) / 0.8)))
  }
  return y
}

/** True if (x, z) is on bare rock: an outcrop or its ramp. */
export const onRock = (x, z) => OUTCROPS.some((o) => (outcropY(o, x, z) ?? 0) > 0.2)

/** Gentle mounds in the woods: [x, z, radius, height]. */
const MOUNDS = [
  [34, -28, 6, 1.0],
  [42, 8, 5, 0.9],
  [-31, -25, 5, 1.0],
  [36, 36, 6, 1.1],
  [-24, 41, 4.5, 0.7],
]

/**
 * The hills round the edge, by how far past 47 m out (`edge`): steep up to the
 * walls (4.2 m high at 50 m), then a steady wooded slope beyond them.
 */
export const hillY = (edge) => (edge <= 0 ? 0 : edge <= 3 ? 0.9 * edge ** 1.4 : Math.min(24, 4.2 + (edge - 3) * 0.9))

/** The land before the lake and the creek cut into it: level, the mounds, the hills past the edge (north, south, east). */
function landY(x, z) {
  let y = 0
  for (const [mx, mz, r, h] of MOUNDS) {
    const d = Math.hypot(x - mx, z - mz) / r
    if (d < 1) y += h * (0.5 + 0.5 * Math.cos(d * Math.PI))
  }
  const edge = Math.max(-z - 47, z - 47, x - 47)
  if (edge > 0) y += hillY(edge) + (edge > 6 ? 1.5 * Math.sin(x * 0.07 + 1) * Math.sin(z * 0.06 + 2) : 0)
  return y
}

/**
 * Where stairs come down a bank or a bluff, the ground is cut away under
 * them: [top [x, y, z], bottom [x, y, z], width].
 */
const CUTS = []

/** The ground's height at (x, z). */
export function pinecrestGroundY(x, z) {
  let y = landY(x, z)
  const lake = lakeCarve(x, z, y)
  if (lake !== null) y = Math.min(y, lake)
  const creek = creekCarve(x, z, y)
  if (creek !== null) y = Math.min(y, creek)
  for (const o of OUTCROPS) {
    const rock = outcropY(o, x, z)
    if (rock !== null) y = Math.max(y, rock)
  }
  for (const [a, b, w] of CUTS) {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2])
    const ux = (b[0] - a[0]) / L
    const uz = (b[2] - a[2]) / L
    const t = ((x - a[0]) * ux + (z - a[2]) * uz) / L
    const side = Math.abs(-(x - a[0]) * uz + (z - a[2]) * ux)
    if (t < -0.1 || t > 1.1 || side > w / 2 + 1.0) continue
    const under = lerp(a[1], b[1], Math.min(1, Math.max(0, t))) - 0.3
    y = Math.min(y, lerp(under, y, smooth((side - w / 2) / 1.0)))
  }
  return y
}

/** The mesh reaches this far out from the middle (past the walls, under the hills). */
export const GROUND_REACH = PINECREST_HALF + 6
const GROUND_STEP = 1.0

let groundCache = null
/**
 * The ground as one triangle mesh, for the physics and the renderer alike: a
 * grid a metre apart over the arena and a little past it. `positions` are
 * xyz triples, `indices` the triangles (wound to face up), `n` vertices a side.
 */
export function pinecrestGround() {
  if (groundCache) return groundCache
  const R = GROUND_REACH
  const n = Math.round((R * 2) / GROUND_STEP) + 1
  const pos = new Float32Array(n * n * 3)
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const x = -R + i * GROUND_STEP
      const z = -R + k * GROUND_STEP
      const j = (i * n + k) * 3
      pos[j] = x
      pos[j + 1] = +pinecrestGroundY(x, z).toFixed(4)
      pos[j + 2] = z
    }
  }
  const idx = []
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < n - 1; k++) {
      const a = i * n + k
      const b = (i + 1) * n + k
      // Alternate the diagonal so slopes don't all crease the same way. (a, a+1, b) faces up: +z then +x.
      if ((i + k) % 2) idx.push(a, a + 1, b, b, a + 1, b + 1)
      else idx.push(a, a + 1, b + 1, a, b + 1, b)
    }
  }
  groundCache = Object.freeze({ positions: pos, indices: Uint32Array.from(idx), n, step: GROUND_STEP, reach: R })
  return groundCache
}
add({ type: 'pcGround' })
add({ type: 'pcWater' })

/* ---------------------------------------------------------------------------
 * Buildings (Atomic Acres' house model: see mapAcres.js)
 * ------------------------------------------------------------------------- */

const door = (from, to, top = 2.2) => ({ from, to, bottom: 0, top, door: true })
const win = (from, to, bottom = 1.0, top = 2.1) => ({ from, to, bottom, top })
const bay = (from, to, top) => ({ from, to, bottom: 0, top, door: true, garage: true })
const up = (from, to, bottom = 0.9, top = 2.1) => win(from, to, bottom, top)

const LODGE_LOOK = { lower: 'lodge', upper: 'lodge', trim: 'walnut', roof: 'shake', base: 'stone', door: '#3a2a1e', curtains: '#b8a888', interior: ['#d6cab2', '#cdbfa4'], upperFloor: 'plank', noAerial: true }

export const HOUSES = Object.freeze([
  {
    // The lodge: the main block, its gable over the courtyard; the stairs up its west wall.
    id: 'pc-lodge',
    x0: -12,
    x1: 0,
    z0: 16,
    z1: 33,
    look: { ...LODGE_LOOK, gable: 'chevron' },
    floors: [
      {
        y: 0,
        h: 3.2,
        walls: {
          n: [win(-10.8, -8.8), door(-7.0, -5.4, 2.4), win(-3.4, -1.4)],
          s: [win(-11.4, -10.2), door(-9.2, -8.0), win(-4.4, -2.4)],
          w: [win(18.4, 20.0), door(24.0, 25.2), win(28.0, 30.0)],
          e: [win(16.8, 18.4), door(20.4, 21.6), door(27.0, 28.2), win(30.0, 31.8)],
        },
        inner: [
          { axis: 'x', at: 25.5, from: -10.6, to: -0.2, openings: [door(-5.6, -4.4)] },
          { axis: 'z', at: -6.0, from: 25.6, to: 32.8, openings: [door(29.0, 30.2)] },
        ],
        floor: 'wood',
      },
      {
        y: 3.4,
        h: 2.8,
        walls: {
          n: [up(-10.6, -8.6), up(-7.2, -4.8, 0.5, 2.3), up(-3.4, -1.4)],
          s: [up(-10.4, -8.4), up(-7.0, -5.0, 0.5, 2.3), up(-3.0, -1.0)],
          w: [up(21.0, 22.6), up(26.0, 27.6), up(30.0, 31.6)],
          e: [up(17.0, 18.4), door(21.0, 22.2), up(30.2, 31.8)],
        },
        inner: [
          { axis: 'x', at: 25.5, from: -10.6, to: -0.2, openings: [door(-5.6, -4.4)] },
          { axis: 'z', at: -6.0, from: 25.6, to: 32.8, openings: [door(28.0, 29.2)] },
        ],
        floor: 'wood',
      },
    ],
    // The stairwell open over the stairs (they climb north along the west wall).
    slabs: [
      { x0: -11.8, x1: -10.8, z0: 16.2, z1: 18.2 },
      { x0: -11.8, x1: -10.8, z0: 21.8, z1: 32.8 },
      { x0: -10.8, x1: -0.2, z0: 16.2, z1: 32.8 },
    ],
    stairs: [{ bottom: [-11.3, 0, 23.6], top: [-11.3, 3.4, 18.2], width: 1.0 }],
    rails: [[-10.8, 18.2, -10.8, 21.8], [-11.8, 21.8, -10.8, 21.8]],
    closets: [{ x0: -11.8, x1: -10.8, z0: 18.2, z1: 20.4, h: 1.4 }],
    roof: { ridge: 11.2, overhang: 0.7 },
    chimney: { x0: -12.9, x1: -12.0, z0: 26.4, z1: 27.8, top: 12.6 },
    porch: { side: 'n', from: -7.6, to: -4.8, depth: 1.8 },
  },
  {
    // Its wing on the east side, through two doors downstairs and one up.
    id: 'pc-lodge-wing',
    x0: 0,
    x1: 10,
    z0: 19,
    z1: 29,
    look: LODGE_LOOK,
    floors: [
      {
        y: 0,
        h: 3.2,
        walls: {
          w: [door(20.4, 21.6), door(27.0, 28.2)],
          n: [door(2.0, 3.2), win(6.6, 8.6)],
          e: [win(20.4, 22.2), door(23.4, 24.6), win(26.0, 27.8)],
          s: [win(1.8, 3.8), win(6.0, 8.4)],
        },
        inner: [{ axis: 'z', at: 5.2, from: 19.2, to: 28.8, openings: [door(22.6, 23.8)] }],
        floor: 'wood',
      },
      {
        y: 3.4,
        h: 2.8,
        walls: {
          w: [door(21.0, 22.2)],
          n: [up(1.8, 3.6), up(6.2, 8.4)],
          e: [up(20.8, 22.6), up(25.4, 27.2)],
          s: [up(2.0, 4.0), up(6.0, 8.2)],
        },
        inner: [{ axis: 'z', at: 5.2, from: 19.2, to: 28.8, openings: [door(24.6, 25.8)] }],
        floor: 'wood',
      },
    ],
    slabs: [{ x0: 0.2, x1: 9.8, z0: 19.2, z1: 28.8 }],
    roof: { ridge: 9.6, overhang: 0.6 },
    porch: { side: 'e', from: 23.0, to: 25.0, depth: 1.6 },
  },
  {
    // The boathouse on the bluff over the lake: a door out onto its deck.
    id: 'pc-boathouse',
    x0: -37,
    x1: -29,
    z0: -13,
    z1: -5,
    look: { lower: 'cabinGrey', trim: 'walnut', roof: 'shake', base: 'stone', door: '#2e2a26', curtains: '#9a9080', interior: ['#b8aa92'], noAerial: true },
    floors: [
      {
        y: 0,
        h: 3.0,
        walls: {
          w: [win(-12.2, -10.6, 0.8, 2.4), door(-9.6, -8.4), win(-7.4, -5.8, 0.8, 2.4)],
          e: [win(-12.0, -10.6), door(-9.8, -8.6)],
          n: [win(-35.4, -33.4)],
          s: [win(-35.6, -33.6), door(-31.8, -30.6)],
        },
        floor: 'plank',
      },
    ],
    roof: { ridge: 6.6, overhang: 0.6 },
  },
  {
    // The guest cabin north of the creek.
    id: 'pc-cabin',
    x0: -3,
    x1: 5,
    z0: -11,
    z1: -5,
    look: { lower: 'cedar', trim: 'walnut', roof: 'shake', base: 'stone', door: '#3a2a1e', curtains: '#a89878', interior: ['#c9b898'], noAerial: true },
    floors: [
      {
        y: 0,
        h: 2.9,
        walls: {
          s: [win(-2.0, -0.4), door(1.0, 2.2), win(3.2, 4.4)],
          n: [win(-1.4, 0.4), win(2.0, 3.8)],
          w: [door(-9.0, -7.8)],
          e: [win(-9.6, -7.6)],
        },
        floor: 'wood',
      },
    ],
    roof: { ridge: 5.8, overhang: 0.5 },
    chimney: { x0: 5.0, x1: 5.8, z0: -9.4, z1: -8.2, top: 6.4 },
  },
  {
    // The workshop: a garage door south, its yellow pickup inside.
    id: 'pc-workshop',
    x0: -6,
    x1: 8,
    z0: -42,
    z1: -32,
    look: { lower: 'shedBlue', trim: 'concrete', roof: 'charcoal', base: 'concrete', door: '#5a6066', curtains: null, interior: ['#b4b0a6'], noAerial: true },
    floors: [
      {
        y: 0,
        h: 4.0,
        walls: {
          s: [bay(-3.2, 1.2, 3.4), win(2.6, 4.6, 1.2, 2.4), door(5.4, 6.6)],
          n: [win(-3.0, -1.0, 1.4, 2.6), win(3.0, 5.0, 1.4, 2.6)],
          w: [win(-40.4, -38.6, 1.2, 2.4), door(-37.6, -36.4)],
          e: [win(-40.0, -38.0, 1.2, 2.4), door(-35.0, -33.8)],
        },
        floor: 'concrete',
      },
    ],
    roof: { ridge: 7.4, overhang: 0.5 },
  },
  {
    // The stone stable south-west of the lodge, open to the yard on its east side.
    id: 'pc-stable',
    x0: -35,
    x1: -23,
    z0: 21,
    z1: 29,
    look: { lower: 'stone', trim: 'bone', roof: 'slate', door: '#3a3026', curtains: null, interior: ['#a89a84'], noAerial: true },
    floors: [
      {
        y: 0,
        h: 3.0,
        walls: {
          e: [bay(22.4, 26.4, 2.8)],
          n: [win(-34.0, -32.4), door(-31.0, -29.8), win(-27.4, -25.6)],
          s: [win(-33.6, -31.6), win(-27.6, -25.6)],
          w: [win(23.6, 25.4), win(26.4, 28.0)],
        },
        floor: 'concrete',
      },
    ],
    roof: { ridge: 6.6, overhang: 0.5 },
  },
  {
    // A woodshed behind the lodge.
    id: 'pc-shed',
    x0: -15,
    x1: -11,
    z0: 42,
    z1: 46,
    look: { lower: 'cedar', trim: 'walnut', roof: 'shake', door: '#3a2a1e', curtains: null, interior: ['#9a8a70'], noAerial: true },
    floors: [{ y: 0, h: 2.5, walls: { n: [door(-13.6, -12.4)], e: [win(43.2, 44.6, 1.0, 1.8)] }, floor: 'plank' }],
    roof: { ridge: 4.2, overhang: 0.4 },
  },
])
for (const h of HOUSES) add({ type: 'house', id: h.id })
const houseById = Object.fromEntries(HOUSES.map((h) => [h.id, h]))
export const pinecrestHouseOf = (id) => houseById[id]

/* ---------------------------------------------------------------------------
 * The glasshouse: a barrel vault of glass on a brick base, a door at each end
 * ------------------------------------------------------------------------- */

export const GREENHOUSE = Object.freeze({
  x0: 16,
  x1: 28,
  z0: 16,
  z1: 24,
  /** Brick up to here, glass walls on up to the springing of the vault, and the vault's rise. */
  base: 0.9,
  spring: 2.6,
  rise: 2.4,
  bays: 6,
  /** Around the vault: this many panes from one side to the other. */
  arc: 8,
  /** The doors in each end: across, and up to. */
  door: [19.2, 20.8, 2.4],
  brick: 0.3,
})

/** A point on the vault's arch at angle θ (0 at the north side … π at the south): [z, y]. */
export function vaultPoint(t) {
  const G = GREENHOUSE
  const zc = (G.z0 + G.z1) / 2
  const a = (G.z1 - G.z0) / 2
  return [zc - a * Math.cos(t), G.spring + G.rise * Math.sin(t)]
}
/** The vault's height over z (where it is over the glasshouse). */
export function vaultY(z) {
  const G = GREENHOUSE
  const a = (G.z1 - G.z0) / 2
  const u = (z - (G.z0 + G.z1) / 2) / a
  return G.spring + G.rise * Math.sqrt(Math.max(0, 1 - u * u))
}

/** Its brick base as boxes [x0, x1, z0, z1, y0, y1] (round the doors). */
export function greenhouseBase() {
  const G = GREENHOUSE
  const t = G.brick
  const [d0, d1] = G.door
  return [
    [G.x0, G.x1, G.z0, G.z0 + t, 0, G.base],
    [G.x0, G.x1, G.z1 - t, G.z1, 0, G.base],
    [G.x0, G.x0 + t, G.z0 + t, d0, 0, G.base],
    [G.x0, G.x0 + t, d1, G.z1 - t, 0, G.base],
    [G.x1 - t, G.x1, G.z0 + t, d0, 0, G.base],
    [G.x1 - t, G.x1, d1, G.z1 - t, 0, G.base],
  ]
}

/** The glasshouse's panes (breakable glass: see shared/glass.js). */
function greenhousePanes() {
  const G = GREENHOUSE
  const out = []
  const bayW = (G.x1 - G.x0) / G.bays
  const T = 0.05
  // Side walls, a pane a bay, above the brick.
  for (let i = 0; i < G.bays; i++) {
    const x = G.x0 + bayW * (i + 0.5)
    for (const z of [G.z0 + G.brick / 2, G.z1 - G.brick / 2]) out.push(glassPane([x, (G.base + G.spring) / 2, z], [bayW - 0.06, G.spring - G.base, T]))
  }
  // The vault: `arc` strips round it, a pane a bay along each.
  for (let k = 0; k < G.arc; k++) {
    const [za, ya] = vaultPoint((Math.PI * k) / G.arc)
    const [zb, yb] = vaultPoint((Math.PI * (k + 1)) / G.arc)
    const dz = zb - za
    const dy = yb - ya
    const len = Math.hypot(dz, dy)
    const q = quatFromEuler(Math.atan2(-dy, dz), 0, 0)
    for (let i = 0; i < G.bays; i++) out.push(glassPane([G.x0 + bayW * (i + 0.5), (ya + yb) / 2, (za + zb) / 2], [bayW - 0.06, T, len - 0.04], q))
  }
  // The ends: upright strips from the brick to under the vault, over the door in the middle.
  const [d0, d1, dTop] = G.door
  for (const x of [G.x0 + G.brick / 2, G.x1 - G.brick / 2]) {
    for (const [z0, z1] of [[G.z0 + G.brick, d0 - 1.6], [d0 - 1.6, d0], [d1, d1 + 1.6], [d1 + 1.6, G.z1 - G.brick]]) {
      const top = Math.min(vaultY(z0), vaultY(z1)) - 0.06
      out.push(glassPane([x, (G.base + top) / 2, (z0 + z1) / 2], [T, top - G.base, z1 - z0 - 0.06]))
    }
    const over = Math.min(vaultY(d0), vaultY(d1)) - 0.06
    out.push(glassPane([x, (dTop + over) / 2, (d0 + d1) / 2], [T, over - dTop, d1 - d0 - 0.06]))
  }
  return out
}
export const PINECREST_GLASS = Object.freeze(greenhousePanes())
add({ type: 'greenhouse' })

/* ---------------------------------------------------------------------------
 * Crossings and stairs: the road's bridge, the footbridge, the planks, the
 * timber stair up the cliff, the boathouse's deck and its stair to the dock
 * ------------------------------------------------------------------------- */

/** The road's concrete bridge over the gully (low walls each side); you can walk under it. */
export const ROAD_BRIDGE = Object.freeze({ x0: 6, x1: 10, z0: -3.2, z1: 9.4, top: 0.22, deck: 0.4, wall: 0.55, wallT: 0.3 })
/** The footbridge: plank deck on posts, rails both sides. */
export const FOOTBRIDGE = Object.freeze({ x0: -19.2, x1: -16.8, z0: -1.8, z1: 10.8, top: 0.18, deck: 0.2 })
add({ type: 'roadBridge' })
add({ type: 'footbridge' })

/** Planks laid across the stream in the bed: [x, z, length, rotY]. */
export const PLANKS = Object.freeze([
  [17.5, 1.4, 3.2, 0.08],
  [-31.0, 6.0, 3.0, -0.12],
])
/** Where the planks' undersides sit against the bed (bedded in it: their tops just clear the water, low enough to step onto). */
export const PLANK_LIFT = -0.02
add({ type: 'planks' })

/** Timber stairs (straight flights, plank treads, rails both sides): [top, bottom, width]. */
const flight = (top, bottom, width) => ({ top, bottom, width })
export const PC_STAIRS = Object.freeze([
  // Up the south cliff below the waterfall, from the bed to the glasshouse's side.
  flight([24.5, 0.02, 4.8], [24.5, creekBedY(24.5) + 0.04, 0.4], 1.3),
  // From the boathouse's deck down the bluff to the dock.
  flight([-40.0, 0.02, -13.6], [-42.4, -3.33, -19.4], 1.2),
])
for (const s of PC_STAIRS) CUTS.push([s.top, s.bottom, s.width + 2.4])
add({ type: 'pcStairs' })

/** The boathouse's deck (level with its floor) on posts over the bluff, and the dock on the lake. */
export const DECK = Object.freeze({ x0: -40.6, x1: -37, z0: -13.6, z1: -4.4, top: 0.04 })
export const DOCK = Object.freeze({ x0: -48.6, x1: -41.6, z0: -20.6, z1: -18.4, top: -3.33 })
add({ type: 'deck' })
add({ type: 'dock' })

/* ---------------------------------------------------------------------------
 * The power substation, the poles and lines, the pylons past the edge
 * ------------------------------------------------------------------------- */

/** Its chain-link fence (black tarps hung on it here and there), a gate on the east and south. */
export const SUBSTATION = Object.freeze({
  x0: -34,
  x1: -18,
  z0: -47,
  z1: -33,
  /** Gaps: [side, from, to]. */
  gates: [['e', -41.0, -37.4], ['s', -27.6, -24.0]],
  /** Transformers: [x, z] (each 2.4 x 1.8 m, on a concrete pad). */
  transformers: [[-30.5, -43.6], [-26.0, -43.6], [-21.5, -43.6], [-30.5, -38.4], [-21.4, -37.8]],
  height: 2.4,
})
/** The fence's runs: [ax, az, bx, bz] (round the gates). */
export function substationFence() {
  const S = SUBSTATION
  const corners = { n: [[S.x0, S.z0], [S.x1, S.z0]], s: [[S.x0, S.z1], [S.x1, S.z1]], w: [[S.x0, S.z0], [S.x0, S.z1]], e: [[S.x1, S.z0], [S.x1, S.z1]] }
  const out = []
  for (const [side, [a, b]] of Object.entries(corners)) {
    const alongX = side === 'n' || side === 's'
    const from = alongX ? a[0] : a[1]
    const to = alongX ? b[0] : b[1]
    const fixed = alongX ? a[1] : a[0]
    let cursor = from
    for (const [gs, g0, g1] of S.gates) {
      if (gs !== side) continue
      out.push(alongX ? [cursor, fixed, g0, fixed] : [fixed, cursor, fixed, g0])
      cursor = g1
    }
    out.push(alongX ? [cursor, fixed, to, fixed] : [fixed, cursor, fixed, to])
  }
  return out
}
add({ type: 'substation' })

/** Wooden poles carrying the line along the north edge into the substation. */
export const PC_POWER_LINES = Object.freeze([[[47, -41.5], [36, -41.5], [24, -41.0], [12, -40.0], [2, -45.0], [-10, -45.5], [-17.4, -44.0]]])
for (const line of PC_POWER_LINES) for (const [x, z] of line) add({ type: 'pole', p: [x, 0, z] })
add({ type: 'powerLines', lines: PC_POWER_LINES })
/** Red lattice pylons out past the edge (drawn only): [x, z, rotY]. */
export const PYLONS = Object.freeze([[-26, -64, 0.1], [36, -70, -0.2], [70, -20, 1.3]])
add({ type: 'pylons' })

/* ---------------------------------------------------------------------------
 * Walls, cars, the boat, logs, crates, firewood
 * ------------------------------------------------------------------------- */

/** Dry-stone walls, waist high: [ax, az, bx, bz]. */
export const STONE_WALLS = Object.freeze([
  // Along the courtyard's edge over the creek (a gap for the path, the road's bridge).
  [-14.0, 10.6, -3.0, 10.6],
  [0.2, 10.6, 4.6, 10.6],
  [11.6, 10.6, 15.4, 10.6],
  // Between the stable's yard and the lodge's.
  [-22.6, 19.4, -18.8, 19.4],
  [-16.2, 19.4, -12.8, 19.4],
  // The glasshouse's garden.
  [14.0, 13.6, 14.0, 17.2],
  [14.0, 19.8, 14.0, 26.6],
  [14.0, 26.6, 30.4, 26.6],
])
for (const [ax, az, bx, bz] of STONE_WALLS) add({ type: 'stoneWall', a: [ax, az], b: [bx, bz], h: 0.95 })

/** Cars: [model, colour, x, z, rotY]. The jeep is its own model. */
const cars = [
  ['wagon', '#f2f2ee', 4.0, 13.2, 1.45],
  ['pickup', '#e6e6e2', -24.6, -9.0, 1.4],
  ['pickup', '#e3b62a', -1.0, -36.6, Math.PI],
]
for (const [model, color, x, z, rotY] of cars) add({ type: 'car', model, color, p: [x, 0, z], rotY })
add({ type: 'jeep', p: [-9.4, 0, 12.8], rotY: -0.3 })
/** An old rusted car that went off the road into the creek long ago. */
add({ type: 'car', model: 'sedan', color: 'rust', wreck: true, p: [12.6, creekBedY(12.6) - 0.05, 2.9], rotY: 1.25 })

/** The rowing boat tied up at the dock. */
export const BOAT = Object.freeze({ p: [-46.4, LAKE.level, -22.6], rotY: 0.2, length: 4.2, width: 1.4 })
add({ type: 'boat', ...BOAT })

/** Fallen logs: [ax, az, bx, bz, r] (resting on the ground). */
const logs = [
  [13.5, -16.0, 17.0, -19.5, 0.28],
  [-36.0, 34.0, -32.0, 37.5, 0.3],
  [38.0, -12.0, 41.0, -16.0, 0.26],
  [-7.5, -28.6, -4.6, -29.6, 0.24],
  [30.0, 44.0, 34.5, 42.0, 0.3],
]
export const LOGS = Object.freeze(
  logs.map(([ax, az, bx, bz, r]) => ({ a: [ax, pinecrestGroundY(ax, az) + r * 0.8, az], b: [bx, pinecrestGroundY(bx, bz) + r * 0.8, bz], r })),
)
for (const l of LOGS) add({ type: 'log', ...l })

/** Crates and stacks of them: [x, z, w, h, d, rotY]. */
const crates = [
  [-23.8, -35.2, 1.2, 1.0, 1.2, 0.2],
  [-23.8, -35.2, 1.0, 0.9, 1.0, 0.5, 1.0],
  [10.2, -33.6, 1.4, 1.1, 1.0, -0.2],
  [-19.6, 15.2, 1.2, 1.0, 1.2, 0.3],
  [31.6, 12.0, 1.2, 1.0, 1.2, -0.4],
  [-27.6, -2.4, 1.2, 1.0, 1.0, 0.1],
]
export const CRATES = Object.freeze(crates.map(([x, z, w, h, d, rotY, y = 0]) => ({ p: [x, y, z], size: [w, h, d], rotY })))
for (const c of CRATES) add({ type: 'crate', ...c })

/** Firewood stacked against walls: [x, z, rotY]. */
for (const [x, z, rotY] of [[-16.6, 44.0, Math.PI / 2], [-38.0, -2.6, Math.PI / 2], [6.0, -4.4, 0]]) add({ type: 'woodPile', p: [x, 0, z], rotY })

/* ---------------------------------------------------------------------------
 * Boulders, trees, stumps
 * ------------------------------------------------------------------------- */

/** Granite boulders: [x, z, r] (sitting on the ground, half sunk). */
const boulders = [
  [-23.5, -19.0, 1.4], [-5.0, -19.5, 1.1], [-21.0, -7.2, 1.2], [17.0, -9.0, 1.3], [31.5, -16.0, 1.0], [30.0, -6.0, 1.5],
  [-34.0, -16.0, 1.2], [-40.5, 18.0, 1.0], [-38.0, 36.0, 1.3], [36.0, 22.0, 1.4], [44.0, -24.0, 1.2], [14.5, -22.0, 0.9],
  [-8.0, 40.0, 1.0], [24.0, 38.0, 1.1], [42.0, 30.0, 1.0], [-2.0, -26.0, 1.2], [20.5, 10.0, 1.0], [33.5, 4.8, 1.3],
  [-28.0, 13.6, 1.0], [12.0, 42.0, 0.9],
]
export const BOULDERS = Object.freeze(boulders.map(([x, z, r], i) => ({ p: [x, pinecrestGroundY(x, z), z], r, seed: 400 + i })))
for (const b of BOULDERS) add({ type: 'boulder', ...b })

/** Rectangles to keep trees off: the buildings and their yards, the paths, the courtyard, the spawns. */
const KEEP_CLEAR = [
  [-14, 12, 10, 36],
  [-41.5, -27, -15, -3],
  [-28, -3, -9.5, -2],
  [-5, 7, -12.5, -3],
  [-8, 10, -44, -27],
  [-36, -16, -49, -31],
  [14.5, 31, 13, 27],
  [-37, -21, 19, 31],
  [-16, -10, 40, 48],
  [3, 12, -30, 14],
  [-20, -15.5, -3, 18],
  [8, 46, -48, -38],
  [-26, 30, 40, 49],
  // The stairs down the bluff to the dock, and up the cliff by the waterfall.
  [-45, -37.5, -22, -12],
  [22, 27, -1.5, 7],
]
const clearOf = (x, z, m = 0) => KEEP_CLEAR.every(([x0, x1, z0, z1]) => x < x0 - m || x > x1 + m || z < z0 - m || z > z1 + m)

/**
 * Trees: birches turning gold and dark pines, scattered through the woods
 * round the edge and between the buildings; none in the creek's bed, the
 * lake, on paths or in yards. { p, h, kind, seed }.
 */
function placeTrees() {
  const rand = seededRandom(7301)
  const out = []
  let tries = 0
  while (out.length < 78 && tries < 4000) {
    tries++
    const x = -48 + rand() * 96
    const z = -48 + rand() * 96
    if (!clearOf(x, z, 1.2)) continue
    if (x < shoreX(z) + 1.5) continue
    const { o, s } = creekLocal(x, z)
    if (Math.abs(o) < s.bed + 1.2) continue
    if (out.some((t) => Math.hypot(t.p[0] - x, t.p[2] - z) < 4.2)) continue
    if (BOULDERS.some((b) => Math.hypot(b.p[0] - x, b.p[2] - z) < b.r + 1.0)) continue
    if (OUTCROPS.some((c) => Math.hypot(x - c.c[0], z - c.c[1]) < Math.min(c.r[0], c.r[1]) + 0.5) && rand() < 0.6) continue
    const pine = rand() < 0.45
    out.push({ p: [+x.toFixed(2), +pinecrestGroundY(x, z).toFixed(3), +z.toFixed(2)], h: pine ? 11 + rand() * 6 : 9 + rand() * 5, kind: pine ? 'pine' : 'birch', seed: 7400 + out.length })
  }
  return out
}
export const TREES = Object.freeze(placeTrees())
for (const t of TREES) add({ type: 'tree', ...t })

/** Stumps (low, cut): [x, z]. */
export const STUMPS = Object.freeze(
  [[-24.0, -4.0], [12.0, 30.0], [-30.0, 40.0], [40.0, -4.0], [-10.0, -24.0], [28.0, -32.0]].map(([x, z]) => ({ p: [x, pinecrestGroundY(x, z), z] })),
)
for (const s of STUMPS) add({ type: 'stump', ...s })

add({ type: 'undergrowth' })
add({ type: 'pcBackdrop' })
add({ type: 'pcPerimeter' })

/* ---------------------------------------------------------------------------
 * Furniture: low cover inside. [kind, x, z, w, h, d, rotY, y] (Acres' kinds)
 * ------------------------------------------------------------------------- */

const L1 = 3.4
const furniture = [
  // The lodge's hall: the sofas round the coffee table, the dining table, a bookshelf.
  ['sofa', -3.0, 20.6, 2.4, 0.85, 0.9, 0],
  ['coffeeTable', -3.0, 22.0, 1.2, 0.42, 0.6, 0],
  ['armchair', -1.2, 23.8, 0.85, 0.9, 0.85, -0.8],
  ['diningTable', -8.0, 21.0, 1.0, 0.78, 1.8, 0],
  ['bookshelf', -0.45, 23.2, 0.45, 1.9, 1.2, 0],
  // Its kitchen (south-west) and the den (south-east).
  ['counter', -11.5, 28.9, 0.6, 0.95, 3.0, 0],
  ['fridge', -11.45, 32.1, 0.7, 1.8, 0.7, 0],
  ['island', -8.6, 29.0, 0.9, 0.95, 2.2, 0],
  ['sofa', -1.0, 30.2, 0.9, 0.85, 2.2, 0],
  ['tv', -5.55, 27.2, 0.45, 0.9, 1.3, 0],
  // Upstairs: bedrooms.
  ['bed', -2.6, 19.6, 2.1, 0.62, 1.6, 0, L1],
  ['dresser', -0.5, 23.2, 0.55, 1.1, 1.3, 0, L1],
  ['bed', -9.0, 30.6, 1.6, 0.62, 2.1, 0, L1],
  ['wardrobe', -11.5, 27.2, 0.6, 2.0, 1.3, 0, L1],
  ['bed', -2.8, 30.6, 1.6, 0.62, 2.1, 0, L1],
  // The wing: dining room and kitchen down, bedrooms up.
  ['diningTable', 7.6, 20.9, 1.8, 0.78, 1.0, 0],
  ['counter', 2.8, 28.45, 4.0, 0.95, 0.6, 0],
  ['piano', 9.45, 27.0, 0.6, 1.25, 1.5, 0],
  ['bed', 2.8, 21.2, 2.1, 0.62, 1.6, 0, L1],
  ['bed', 7.6, 26.8, 2.1, 0.62, 1.6, 0, L1],
  ['dresser', 9.45, 21.0, 0.55, 1.1, 1.3, 0, L1],
  // The cabin.
  ['bed', 3.6, -8.0, 1.5, 0.6, 2.0, 0],
  ['diningTable', -0.6, -8.2, 1.2, 0.78, 0.9, 0],
  // The boathouse.
  ['workbench', -29.6, -11.6, 0.8, 0.95, 2.4, 0],
  ['shelf', -33.0, -12.55, 2.2, 1.9, 0.5, 0],
  ['sofa', -35.6, -6.8, 2.2, 0.85, 0.9, 0],
  // The workshop.
  ['workbench', 7.2, -39.6, 0.8, 0.95, 2.4, 0],
  ['shelf', 2.0, -41.55, 2.2, 1.9, 0.5, 0],
  // The stable.
  ['workbench', -34.4, 27.0, 0.8, 0.95, 2.4, 0],
  ['shelf', -29.0, 28.55, 2.2, 1.9, 0.5, 0],
]
export const PINECREST_FURNITURE = Object.freeze(furniture.map(([kind, x, z, w, h, d, rotY = 0, y = 0]) => ({ kind, p: [x, y, z], size: [w, h, d], rotY })))
add({ type: 'furniture' })

/** Potting benches in the glasshouse (cover): [x, z, length]. */
export const BENCHES = Object.freeze([
  [22.0, 17.6, 9.0],
  [22.0, 22.4, 9.0],
])

export const PINECREST_AMMO = Object.freeze([
  { p: [-35.8, 0, -11.9], radius: 1.7, cooldown: 20, rotY: 0 },
  { p: [-5.0, 0, -41.0], radius: 1.7, cooldown: 20, rotY: 0.2 },
])
for (const a of PINECREST_AMMO) add({ type: 'ammoCrate', p: a.p, size: [1.0, 0.6, 0.6], rotY: a.rotY })

export const PINECREST_LADDERS = Object.freeze([])
export const pinecrestLadderAt = (x, y, z) => ladderIn(PINECREST_LADDERS, x, y, z)

export const PINECREST_ENTITIES = Object.freeze(entities)

/* ---------------------------------------------------------------------------
 * Collider generation
 * ------------------------------------------------------------------------- */

const lineBox = (a, b, h, thick, y0 = 0, group) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
  return boxC([(a[0] + b[0]) / 2, y0 + h / 2, (a[1] + b[1]) / 2], [len, h, thick], yawQ(yaw), group)
}
const aabb = (x0, x1, y0, y1, z0, z1, group) => boxC([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], IDENTITY_Q, group)

function localBoxes(e, list) {
  const q = yawQ(e.rotY)
  return list.map(([lx, y0, lz, w, h, d, group]) => {
    const o = yawOffset(e.p, lx, lz, e.rotY)
    return boxC([o[0], e.p[1] + y0 + h / 2, o[2]], [w, h, d], q, group)
  })
}

function carColliders(e) {
  const m = CAR_MODELS[e.model]
  const [y0, y1] = m.body
  const [c0, c1] = m.cabin
  return localBoxes(e, [
    [0, y0, 0, m.w, y1 - y0, m.length],
    [0, y1, (c0 + c1) / 2, m.cabinW, m.cabinTop - y1, c1 - c0],
  ])
}

/** A flight's ramp and its two rails. */
function stairColliders(s) {
  const out = []
  const r = rampBox(s.top, s.bottom, s.width, 0.16)
  out.push(boxC(r.p, r.size, r.q))
  const dx = s.bottom[0] - s.top[0]
  const dz = s.bottom[2] - s.top[2]
  const L = Math.hypot(dx, dz)
  const side = [-dz / L, dx / L]
  for (const k of [-1, 1]) {
    const off = (p) => [p[0] + side[0] * k * (s.width / 2 - 0.05), p[1] + 1.0, p[2] + side[1] * k * (s.width / 2 - 0.05)]
    const t = rampBox(off(s.top), off(s.bottom), 0.08, 1.0)
    out.push(boxC(t.p, t.size, t.q, MOVE_ONLY))
  }
  return out
}

export function roadBridgePieces(b = ROAD_BRIDGE) {
  return [
    { kind: 'deck', p: [(b.x0 + b.x1) / 2, b.top - b.deck / 2, (b.z0 + b.z1) / 2], size: [b.x1 - b.x0, b.deck, b.z1 - b.z0] },
    ...[b.x0 + b.wallT / 2, b.x1 - b.wallT / 2].map((x) => ({ kind: 'wall', p: [x, b.top + b.wall / 2, (b.z0 + b.z1) / 2], size: [b.wallT, b.wall, b.z1 - b.z0] })),
  ]
}

function footbridgeColliders(b = FOOTBRIDGE) {
  const out = [aabb(b.x0, b.x1, b.top - b.deck, b.top, b.z0, b.z1)]
  for (const x of [b.x0 + 0.05, b.x1 - 0.05]) out.push(aabb(x - 0.05, x + 0.05, b.top, b.top + 1.0, b.z0, b.z1, MOVE_ONLY))
  return out
}

function greenhouseColliders() {
  const out = greenhouseBase().map(([x0, x1, z0, z1, y0, y1]) => aabb(x0, x1, y0, y1, z0, z1))
  const G = GREENHOUSE
  // Corner posts of the frame, the potting benches.
  for (const x of [G.x0 + 0.15, G.x1 - 0.15]) for (const z of [G.z0 + 0.15, G.z1 - 0.15]) out.push(aabb(x - 0.1, x + 0.1, 0, G.spring, z - 0.1, z + 0.1))
  for (const [x, z, len] of BENCHES) out.push(aabb(x - len / 2, x + len / 2, 0, 0.9, z - 0.45, z + 0.45))
  return out
}

function substationColliders() {
  const S = SUBSTATION
  const out = []
  // Chain-link stops you, not bullets.
  for (const [ax, az, bx, bz] of substationFence()) out.push(lineBox([ax, az], [bx, bz], S.height, 0.08, 0, MOVE_ONLY))
  for (const [x, z] of S.transformers) {
    out.push(aabb(x - 1.3, x + 1.3, 0, 0.15, z - 1.0, z + 1.0))
    out.push(aabb(x - 1.1, x + 1.1, 0.15, 2.45, z - 0.8, z + 0.8))
  }
  // The control cabinet by the south gate.
  out.push(aabb(-32.6, -30.6, 0, 1.9, -34.2, -33.6))
  return out
}

const COLLIDER_BUILDERS = {
  pcGround: () => {
    const g = pinecrestGround()
    return [meshC(g.positions, g.indices)]
  },
  house: (e) => houseColliders(pinecrestHouseOf(e.id)),
  greenhouse: greenhouseColliders,
  roadBridge: () => roadBridgePieces().map((b) => boxC(b.p, b.size)),
  footbridge: () => footbridgeColliders(),
  planks: () => PLANKS.map(([x, z, length, rotY]) => groundBox([x, creekBedY(x) + PLANK_LIFT, z], [0.9, 0.16, length], rotY)),
  pcStairs: () => PC_STAIRS.flatMap(stairColliders),
  deck: () => {
    const d = DECK
    const out = [aabb(d.x0, d.x1, d.top - 0.2, d.top, d.z0, d.z1)]
    // Rails round its lake side and its north end (the stair leaves from the north-west corner).
    out.push(aabb(d.x0, d.x0 + 0.08, d.top, d.top + 1.0, d.z0 + 1.4, d.z1, MOVE_ONLY))
    out.push(aabb(d.x0 + 1.3, d.x1, d.top, d.top + 1.0, d.z0, d.z0 + 0.08, MOVE_ONLY))
    out.push(aabb(d.x0, d.x1, d.top, d.top + 1.0, d.z1 - 0.08, d.z1, MOVE_ONLY))
    return out
  },
  dock: () => [aabb(DOCK.x0, DOCK.x1, DOCK.top - 0.25, DOCK.top, DOCK.z0, DOCK.z1)],
  substation: substationColliders,
  pole: (e) => [cylC([e.p[0], 3.5, e.p[2]], 0.14, 7.0)],
  stoneWall: (e) => [lineBox(e.a, e.b, e.h, 0.5)],
  car: carColliders,
  jeep: (e) => localBoxes(e, [[0, 0.42, 0, 1.75, 0.82, 3.7], [0, 1.24, -0.55, 1.6, 0.42, 0.08]]),
  boat: (e) => localBoxes(e, [[0, -0.3, 0, e.width, 0.8, e.length]]),
  log: (e) => [segmentCyl(e.a, e.b, e.r)],
  crate: (e) => [groundBox(e.p, e.size, e.rotY)],
  woodPile: (e) => [groundBox(e.p, [2.4, 0.85, 1.0], e.rotY)],
  boulder: (e) => [cylC([e.p[0], e.p[1] + e.r * 0.35, e.p[2]], e.r * 0.82, e.r * 1.4)],
  tree: (e) => [cylC([e.p[0], e.p[1] + 3.0, e.p[2]], e.kind === 'pine' ? 0.3 : 0.2, 6.0)],
  stump: (e) => [cylC([e.p[0], e.p[1] + 0.25, e.p[2]], 0.38, 0.5)],
  furniture: () => PINECREST_FURNITURE.filter((f) => f.kind !== 'bed').map((f) => groundBox(f.p, f.size, f.rotY)),
  ammoCrate: (e) => [groundBox(e.p, e.size, e.rotY)],
  pcPerimeter: () => {
    // The walls stand on y = 0: carry them down too, where the lake and the gully run out under them.
    const E = PINECREST_HALF + 0.3
    const W = PINECREST_HALF * 2 + 2
    return [
      ...boundaryColliders(PINECREST_HALF, PINECREST_HALF),
      boxC([-E, -6, 0], [1, 12, W]),
      boxC([E, -6, 0], [1, 12, W]),
      boxC([0, -6, -E], [W, 12, 1]),
      boxC([0, -6, E], [W, 12, 1]),
      boxC([0, -8, 0], [GROUND_REACH * 2 + 4, 2, GROUND_REACH * 2 + 4]),
    ]
  },
}

let colliderCache = null
/** Flat, cached list of every collider in the map. Identical on client and server. */
export function buildPinecrestColliders() {
  if (colliderCache) return colliderCache
  const out = []
  for (const e of PINECREST_ENTITIES) {
    const build = COLLIDER_BUILDERS[e.type]
    if (build) out.push(...build(e))
  }
  colliderCache = Object.freeze(out)
  return colliderCache
}

/* ---------------------------------------------------------------------------
 * Spawns
 * ------------------------------------------------------------------------- */

const spawn = (x, z, faceX = 0, faceZ = 0) => ({ p: [x, +pinecrestGroundY(x, z).toFixed(3), z], yaw: Math.atan2(-(faceX - x), -(faceZ - z)) })

export const PINECREST_SPAWNS = Object.freeze({
  // TDM: Alpha in the woods by the road in the north-east, Bravo behind the lodge in the south.
  [TEAMS.ALPHA]: [spawn(12, -45, 0, -20), spawn(18, -46, 8, -20), spawn(24, -44.5, 16, -20), spawn(30, -45.5, 20, -24), spawn(36, -43, 24, -20), spawn(41, -38, 30, -20)],
  [TEAMS.BRAVO]: [spawn(-22, 44, -12, 30), spawn(-6, 46, -4, 36), spawn(2, 45, 4, 34), spawn(10, 44, 10, 30), spawn(18, 45.5, 18, 30), spawn(26, 43, 22, 30)],
  ffa: [
    spawn(-34, -26, -14, -10),
    spawn(-8, -46.5, -4, -30),
    spawn(44, -20, 20, -20),
    spawn(44, 14, 20, 16),
    spawn(38, 40, 20, 30),
    spawn(16, 34, 10, 20),
    spawn(-20, 38, -10, 26),
    spawn(-30, 16, -16, 14),
    spawn(-36, -20, -20, -10),
    spawn(2, -18, 0, -4),
    spawn(14, -24, 6, -10),
    spawn(-4, 40, -6, 30),
  ],
})

/* ---------------------------------------------------------------------------
 * Bot navigation: a grid over the ground (whatever its height), doorways,
 * the stairs, the bridges, the lodge's upper floors
 * ------------------------------------------------------------------------- */

/** Points either side of every ground-floor doorway. */
function doorNodes() {
  const out = []
  for (const h of HOUSES) {
    for (const o of houseOpenings(h)) {
      if (!o.door || o.floor !== 0) continue
      const [a, c] = o.at
      const n = o.axis === 'x' ? [0, 1] : [1, 0]
      const k = o.side === 'inner' ? 0.8 : 0.9
      for (const s of [-1, 1]) out.push([+(a + n[0] * s * k).toFixed(2), 0, +(c + n[1] * s * k).toFixed(2)])
    }
  }
  return out
}

/** Nodes along a straight flight from off its foot to off its top. */
function flightChain(top, bottom, before = 1.0, after = 1.0) {
  const dx = top[0] - bottom[0]
  const dz = top[2] - bottom[2]
  const run = Math.hypot(dx, dz)
  const at = (f, y) => [+(bottom[0] + dx * f).toFixed(2), +y.toFixed(2), +(bottom[2] + dz * f).toFixed(2)]
  const rise = top[1] - bottom[1]
  return [at(-before / run, bottom[1]), at(0.12, bottom[1] + rise * 0.12), at(0.5, bottom[1] + rise * 0.5), at(0.88, bottom[1] + rise * 0.88), at(1 + after / run, top[1])]
}

/** Nodes over each upstairs floor, clear of the walls, the stairwell and the furniture. */
function upperNodes() {
  const out = []
  const step = 2.2
  const m = 0.6
  for (const h of HOUSES) {
    if (!h.slabs) continue
    const y = h.floors[1].y
    for (const s of h.slabs) {
      if (s.x1 - s.x0 < m * 2 || s.z1 - s.z0 < m * 2) continue
      const nx = Math.max(1, Math.round((s.x1 - s.x0 - m * 2) / step) + 1)
      const nz = Math.max(1, Math.round((s.z1 - s.z0 - m * 2) / step) + 1)
      for (let i = 0; i < nx; i++) {
        for (let k = 0; k < nz; k++) {
          const x = nx === 1 ? (s.x0 + s.x1) / 2 : s.x0 + m + ((s.x1 - s.x0 - m * 2) * i) / (nx - 1)
          const z = nz === 1 ? (s.z0 + s.z1) / 2 : s.z0 + m + ((s.z1 - s.z0 - m * 2) * k) / (nz - 1)
          const inner = h.floors[1].inner ?? []
          if (inner.some((w) => (w.axis === 'x' ? Math.abs(z - w.at) < 0.45 && x > w.from && x < w.to : Math.abs(x - w.at) < 0.45 && z > w.from && z < w.to))) continue
          if (PINECREST_FURNITURE.some((f) => Math.abs(f.p[1] - y) < 0.01 && f.kind !== 'bed' && Math.abs(x - f.p[0]) < Math.max(f.size[0], f.size[2]) / 2 + 0.45 && Math.abs(z - f.p[2]) < Math.max(f.size[0], f.size[2]) / 2 + 0.45)) continue
          out.push([+x.toFixed(2), y, +z.toFixed(2)])
        }
      }
    }
    // Either side of each upstairs door (the inner ones, and through to the wing).
    for (const o of houseOpenings(h)) {
      if (!o.door || o.floor === 0) continue
      const [a, c] = o.at
      const n = o.axis === 'x' ? [0, 1] : [1, 0]
      for (const k of [-1, 1]) out.push([+(a + n[0] * k * 0.75).toFixed(2), y, +(c + n[1] * k * 0.75).toFixed(2)])
    }
  }
  return out
}

/** Down a flight between two ground levels: off its top, steps no more than 0.35 m apart in height, off its foot. */
function stairNodes(top, bottom, before = 1.0, after = 1.0) {
  const dx = bottom[0] - top[0]
  const dz = bottom[2] - top[2]
  const run = Math.hypot(dx, dz)
  const rise = top[1] - bottom[1]
  const n = Math.max(2, Math.ceil(rise / 0.35))
  const at = (f, y) => [+(top[0] + dx * f).toFixed(2), +y.toFixed(2), +(top[2] + dz * f).toFixed(2)]
  const out = [at(-before / run, top[1])]
  for (let i = 1; i < n; i++) out.push(at(i / n, top[1] - (rise * i) / n))
  out.push(at(1 + after / run, bottom[1]))
  return out
}

/** Along a deck from off one end to off the other: [x, z0, z1, top]. */
const deckChain = (x, z0, z1, top) => [[x, 0, z0 - 1.0], ...[0.12, 0.37, 0.63, 0.88].map((f) => [x, top, +(z0 + (z1 - z0) * f).toFixed(2)]), [x, 0, z1 + 1.0]]

const lodgeStairs = pinecrestHouseOf('pc-lodge').stairs[0]
const [cliffStair, dockStair] = PC_STAIRS

export const PINECREST_NAV = Object.freeze({
  // The grid looks for floor from just over the ground's own height (so it finds the
  // rock tops and the gully's bed alike), and skips the lake.
  grid: {
    spacing: 2.5,
    half: PINECREST_HALF - 1.4,
    depth: 4,
    floorAt: (x, z) => {
      const y = pinecrestGroundY(x, z)
      return y < LAKE.level + 0.15 ? null : y
    },
  },
  root: [0, -22],
  linkUpper: true,
  // Ground links may climb this much per metre (the banks, the ramps of rock), and nowhere
  // between them may the ground rise faster than `steep` (no link over an outcrop's sheer side).
  climb: 0.8,
  steep: 0.85,
  extra: Object.freeze([
    ...doorNodes(),
    ...deckChain((ROAD_BRIDGE.x0 + ROAD_BRIDGE.x1) / 2, ROAD_BRIDGE.z0, ROAD_BRIDGE.z1, ROAD_BRIDGE.top),
    ...deckChain((FOOTBRIDGE.x0 + FOOTBRIDGE.x1) / 2, FOOTBRIDGE.z0, FOOTBRIDGE.z1, FOOTBRIDGE.top),
    // The boathouse's deck, down its stair to the dock and along it; up the cliff's stair.
    [-38.8, DECK.top, -9.0],
    [-38.8, DECK.top, -12.6],
    ...stairNodes(dockStair.top, dockStair.bottom, 0.7, 0.8),
    [-45.0, DOCK.top, -19.5],
    [-47.6, DOCK.top, -19.5],
    ...stairNodes(cliffStair.top, cliffStair.bottom, 1.0, 0.8),
  ]),
  chains: Object.freeze([flightChain(lodgeStairs.top, lodgeStairs.bottom, 1.2)]),
  upper: Object.freeze(upperNodes()),
})
