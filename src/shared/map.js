/**
 * "Dustline Pumpstation" — the map, as data.
 *
 * Coordinates are metres. +X is east, -Z is north, +Y is up, ground is y = 0.
 * The playable square is 60 x 60 m centred on the water tower at the origin.
 *
 * Everything is described once here as high-level *entities* (a container, a tank,
 * a ruined house...). Two consumers read it:
 *   - the client renders each entity type with its own component, and
 *   - BOTH client and server call `buildColliders()` to get the exact same flat list
 *     of Rapier boxes/cylinders, so a wall that stops your bullet on screen is the
 *     same wall the server raycasts against.
 * Generated geometry (ruined walls, the pipeline) comes from shared functions
 * (`ruinPieces`, `pipelinePieces`) for the same reason.
 */
import { GROUP, TEAMS } from './constants.js'
import { normalize3, quatFromEuler, quatFromUnitVectors, quatMultiply, seededRandom, sub3 } from './math.js'

export const MAP_NAME = 'Dustline Pumpstation'
export const MAP_HALF = 30
/** Centre line of the perimeter wall. */
export const WALL_LINE = 31

/* ---------------------------------------------------------------------------
 * Small helpers
 * ------------------------------------------------------------------------- */

const entities = []
const add = (e) => {
  entities.push(e)
  return e
}

/** Offsets a local XZ point by a yaw rotation around `origin`. */
export function yawOffset(origin, lx, lz, rotY) {
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  return [origin[0] + lx * c + lz * s, origin[1], origin[2] - lx * s + lz * c]
}

/**
 * A tilted slab from `top` (high end) to `bottom` (low end), as a box whose top
 * face is the walking surface. Used by stairs, collapsed roofs and ramps.
 */
export function rampBox(top, bottom, width, thickness = 0.14) {
  const dx = bottom[0] - top[0]
  const dz = bottom[2] - top[2]
  const run = Math.hypot(dx, dz)
  const rise = top[1] - bottom[1]
  const length = Math.hypot(run, rise)
  const angle = Math.atan2(rise, run)
  // Local +Z points downhill: yaw it onto the horizontal run, then pitch it down.
  const yaw = Math.atan2(dx, dz)
  const q = quatMultiply(quatFromEuler(0, yaw, 0), quatFromEuler(angle, 0, 0))
  const mid = [(top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, (top[2] + bottom[2]) / 2]
  // Surface normal tips toward the downhill side.
  const n = [(dx / (run || 1)) * Math.sin(angle), Math.cos(angle), (dz / (run || 1)) * Math.sin(angle)]
  const p = [mid[0] - (n[0] * thickness) / 2, mid[1] - (n[1] * thickness) / 2, mid[2] - (n[2] * thickness) / 2]
  return { p, size: [width, thickness, length], q, yaw, angle, length }
}

/* ---------------------------------------------------------------------------
 * Central derrick tower (unchanged footprint: the ladder volume depends on it).
 * Steel legs, a corrugated head house, the lookout platform, and a lattice mast
 * rising above it with open sides so the platform still sees the whole map.
 * ------------------------------------------------------------------------- */

export const TOWER = Object.freeze({
  p: [0, 0, 0],
  legInset: 1.7,
  legSize: 0.36,
  legHeight: 9,
  houseSize: 3.8,
  houseBottom: 9,
  houseHeight: 3,
  platformSize: 4.4,
  platformTop: 12.2,
  railHeight: 1.0,
  ladderX: 0,
  ladderZ: 2.6,
  ladderGap: 0.55,
  /** Mast: vertical corner posts up to `mastBase` above the deck, then tapering to the crown. */
  mastInset: 1.95,
  mastBase: 3.2,
  mastHeight: 13,
  mastTop: 0.55,
})
add({ type: 'tower', ...TOWER })

/**
 * Ladder trigger volume (feet position). Inside it, W/S climb instead of walk.
 * `exitDir` is the direction you step off at the top.
 */
export const LADDERS = Object.freeze([
  Object.freeze({
    min: [-0.6, -0.2, 2.2],
    max: [0.6, TOWER.platformTop + 0.4, 3.25],
    topY: TOWER.platformTop,
    exitDir: [0, 0, -1],
    x: 0,
    z: 2.62,
  }),
])

/* ---------------------------------------------------------------------------
 * Tank yard (north-east)
 * ------------------------------------------------------------------------- */

export const TANKS = Object.freeze([
  Object.freeze({ p: [13, 0, -19], r: 3, h: 5 }),
  Object.freeze({ p: [20.2, 0, -19], r: 3, h: 5 }),
])
for (const t of TANKS) add({ type: 'tank', ...t })
add({ type: 'catwalk', p: [16.6, 5, -19], length: 2.2, width: 1.4 })
export const STAIRS = Object.freeze({ bottom: [9.2, 0, -10], top: [9.2, 5, -18], width: 1.2 })
add({ type: 'stairs', ...STAIRS })
add({ type: 'landing', p: [9.55, 5, -19], size: [2.1, 2.0] })

/* ---------------------------------------------------------------------------
 * Elevated pipeline (north-west to south-east)
 *
 * Runs on H-frame racks with its underside at 2.15 m, so everyone walks under it.
 * It's broken next to the tower: two torn ends droop down and a section lies in the
 * sand below as low cover.
 * ------------------------------------------------------------------------- */

export const PIPELINE = Object.freeze({
  start: [-24, -33], // x, z — outside the north wall
  /** A big 2 m main: centre high enough that there's head room underneath. */
  height: 3.35,
  radius: 1.0,
  fallenRadius: 0.85,
  length: 82,
  break: [37.6, 44.4], // along-pipe distances of the torn ends
  racks: [9, 15, 21, 27, 33.5, 48.5, 54.5, 60.5, 66.5, 72.5],
  rackHalf: 1.35,
})
const PIPE_DIR = normalize3([1, 0, 1])
const pipeAt = (s, y = PIPELINE.height) => [PIPELINE.start[0] + PIPE_DIR[0] * s, y, PIPELINE.start[1] + PIPE_DIR[2] * s]
/** Where the pipeline crosses the perimeter (it runs along x - z = C), so the fence can leave a gap. */
const PIPE_C = PIPELINE.start[0] - PIPELINE.start[1]
export const PIPE_CROSSINGS = Object.freeze([
  ['north', -WALL_LINE + PIPE_C],
  ['east', WALL_LINE - PIPE_C],
])

/** Pipe runs, rack frames and the fallen section, in world space. */
export function pipelinePieces() {
  const { radius: r, height: y } = PIPELINE
  const [b0, b1] = PIPELINE.break
  const pipes = [
    { a: pipeAt(-1), b: pipeAt(b0 - 1.7), r },
    { a: pipeAt(b0 - 1.8), b: pipeAt(b0, y - 0.45), r, open: 'b' },
    { a: pipeAt(b1, y - 0.5), b: pipeAt(b1 + 1.8), r, open: 'a' },
    { a: pipeAt(b1 + 1.7), b: pipeAt(PIPELINE.length), r },
  ]
  const yaw = Math.atan2(PIPE_DIR[0], PIPE_DIR[2])
  const racks = PIPELINE.racks.map((s) => ({ p: pipeAt(s, 0), yaw }))
  // The fallen piece lies beside the gap, slewed off the pipe's line.
  // Half sunk in the sand, so it's chest-high cover rather than a wall.
  const fr = PIPELINE.fallenRadius
  const fy = fr - 0.3
  const mid = pipeAt((b0 + b1) / 2, fy)
  // Pushed off the line toward the tank-yard side, so the ring around the tower stays clear.
  const side = [-PIPE_DIR[2], 0, PIPE_DIR[0]]
  const centre = [mid[0] - side[0] * 1.6, fy, mid[2] - side[2] * 1.6]
  const fallenDir = normalize3([Math.cos(0.42 + Math.PI / 4), 0, Math.sin(0.42 + Math.PI / 4)])
  const fallen = {
    a: [centre[0] - fallenDir[0] * 2.6, fy, centre[2] - fallenDir[2] * 2.6],
    b: [centre[0] + fallenDir[0] * 2.6, fy, centre[2] + fallenDir[2] * 2.6],
    r: fr,
    open: 'both',
  }
  return { pipes, racks, fallen, dir: PIPE_DIR }
}
add({ type: 'pipeline' })

/* ---------------------------------------------------------------------------
 * Container yard (south-west)
 * ------------------------------------------------------------------------- */

export const CONTAINER = Object.freeze({ length: 6.0, height: 2.6, width: 2.4, wall: 0.08 })
const containers = [
  { p: [-24, 0, 11], rotY: 0, color: 'red', open: false },
  { p: [-24, 2.6, 11], rotY: 0, color: 'blue', open: false },
  { p: [-14, 0, 14], rotY: Math.PI / 2, color: 'green', open: true },
  { p: [-23, 0, 18], rotY: 0, color: 'orange', open: true },
  { p: [-17.5, 0, 24.5], rotY: 0, color: 'white', open: false },
  { p: [-17, 2.6, 24.5], rotY: 0, color: 'rust', open: false },
  { p: [-27.5, 0, 25], rotY: Math.PI / 2, color: 'teal', open: false },
  { p: [-8.5, 0, 25.5], rotY: 0.25, color: 'mustard', open: false },
  { p: [-12.5, 0, 6], rotY: -0.1, color: 'red', open: false },
]
for (const c of containers) add({ type: 'container', ...c })
// White pressure tanks on cradles behind yellow rails, on top of the two stacks.
add({ type: 'deckTank', p: [-24, 5.2, 11], rotY: 0, length: 4.2, r: 0.8 })
add({ type: 'deckTank', p: [-17, 5.2, 24.5], rotY: 0, length: 3.6, r: 0.75 })
// Crate "ramp" onto the orange container: ground -> 1.0 -> 2.0 -> 2.6.
add({ type: 'crate', p: [-19.45, 0, 18.0], size: 1.0, rotY: 0 })
add({ type: 'crate', p: [-19.45, 1.0, 18.0], size: 1.0, rotY: 0.08 })
add({ type: 'crate', p: [-18.45, 0, 19.0], size: 1.0, rotY: -0.1 })

/* ---------------------------------------------------------------------------
 * Control shack (south-east)
 * ------------------------------------------------------------------------- */

export const SHACK = Object.freeze({
  x0: 17,
  z0: 19,
  x1: 23,
  z1: 25,
  height: 2.5,
  wall: 0.2,
  roofThickness: 0.12,
  door: { wall: 'west', from: 21.4, to: 22.6, top: 2.1 },
  windows: [
    { wall: 'north', from: 19.3, to: 20.7, bottom: 1.0, top: 1.9 },
    { wall: 'west', from: 19.6, to: 20.8, bottom: 1.0, top: 1.9 },
  ],
})
add({ type: 'shack', ...SHACK })
add({ type: 'desk', p: [21.75, 0, 20.0], size: [1.6, 0.8, 0.8], rotY: 0 })
add({ type: 'lockers', p: [22.5, 0, 23.4], size: [0.5, 2.0, 2.0], rotY: 0 })
export const AMMO_CRATE = Object.freeze({ p: [18.7, 0, 24.3], radius: 1.7, cooldown: 20 })
add({ type: 'ammoCrate', p: AMMO_CRATE.p, size: [1.0, 0.6, 0.6], rotY: 0 })
// Crates up onto the shack roof.
add({ type: 'crate', p: [19.9, 0, 17.1], size: 1.0, rotY: 0.05 })
add({ type: 'crate', p: [21.25, 0, 18.2], size: 1.0, rotY: 0 })
add({ type: 'crate', p: [21.25, 1.0, 18.2], size: 1.0, rotY: -0.06 })

/* ---------------------------------------------------------------------------
 * War-damaged buildings
 *
 * Walls are described in the ruin's local frame (x along its width, z along its
 * depth). `broken` ranges get jagged, partly collapsed tops; openings are doors,
 * windows and breaches. `ruinPieces()` turns this into boxes.
 * ------------------------------------------------------------------------- */

const ruins = [
  {
    // Two storeys, the upper floor half gone; outside stairs up the south side.
    id: 'westHouse',
    p: [-21, 0, -3],
    rotY: 0,
    w: 8,
    d: 6,
    h: 3.0,
    seed: 11,
    walls: [
      { a: [-4, -3], b: [4, -3], openings: [{ from: 1.2, to: 2.4, bottom: 1.0, top: 2.0 }, { from: 5.2, to: 6.3, bottom: 0, top: 2.2 }], broken: [{ from: 6.6, to: 8, min: 1.2, max: 2.4 }] },
      { a: [-4, 3], b: [4, 3], openings: [{ from: 1.2, to: 2.2, bottom: 1.0, top: 2.0 }], broken: [{ from: 5.2, to: 8, min: 1.6, max: 2.7 }] },
      { a: [-4, -3], b: [-4, 3], openings: [{ from: 2.0, to: 3.2, bottom: 1.0, top: 2.0 }] },
      { a: [4, -3], b: [4, 3], openings: [{ from: 1.8, to: 4.8, bottom: 0, top: 9, breach: true }], broken: [{ from: 0, to: 1.8, min: 1.0, max: 2.2 }, { from: 4.8, to: 6, min: 1.2, max: 2.0 }] },
      { a: [0.6, -3], b: [0.6, -1], openings: [] },
      // Upper storey: low, shattered parapets around the surviving floor.
      { a: [-4, -3], b: [0.6, -3], base: 3.25, h: 1.2, broken: [{ from: 0, to: 4.6, min: 0.35, max: 1.2 }] },
      { a: [-4, -3], b: [-4, 3], base: 3.25, h: 1.3, broken: [{ from: 0, to: 6, min: 0.5, max: 1.3 }], openings: [{ from: 2.4, to: 3.4, bottom: 0, top: 9 }] },
      { a: [-4, 3], b: [-0.6, 3], base: 3.25, h: 1.0, broken: [{ from: 0, to: 3.4, min: 0.4, max: 1.0 }] },
    ],
    slabs: [{ x0: -4.15, x1: 0.75, z0: -3.15, z1: 3.15, top: 3.25, thick: 0.25 }],
    ramps: [{ top: [0.3, 3.25, 3.75], bottom: [4.6, 0, 3.75], width: 1.1, stairs: true }],
    rubble: [
      { p: [2.8, 0.5], size: [1.6, 0.6, 1.4], rotY: 0.3 },
      { p: [5.0, 0.6], size: [1.3, 0.45, 1.6], rotY: -0.2 },
    ],
  },
  {
    // Outpost with a collapsed roof slab you can run up onto the west wall.
    id: 'outpost',
    p: [-4, 0, -23],
    rotY: 0,
    w: 6,
    d: 5,
    h: 2.6,
    seed: 23,
    walls: [
      { a: [-3, -2.5], b: [3, -2.5], openings: [{ from: 2.0, to: 3.2, bottom: 1.0, top: 1.9 }], broken: [{ from: 4.0, to: 6, min: 1.0, max: 2.2 }] },
      { a: [-3, 2.5], b: [3, 2.5], openings: [{ from: 2.4, to: 3.6, bottom: 0, top: 2.1 }], broken: [{ from: 4.2, to: 6, min: 0.9, max: 1.8 }] },
      { a: [-3, -2.5], b: [-3, 2.5], openings: [{ from: 3.4, to: 4.1, bottom: 1.2, top: 1.8 }] },
      { a: [3, -2.5], b: [3, 2.5], broken: [{ from: 0, to: 5, min: 0.1, max: 0.35 }] },
    ],
    ramps: [{ top: [-2.7, 2.6, 0], bottom: [2.6, 0.04, 0], width: 3.6 }],
    rubble: [{ p: [3.9, -1.3], size: [1.2, 0.4, 1.2], rotY: 0.4 }],
  },
  {
    // Two rooms; part of the roof slid off and leans against the north wall,
    // making a ramp up onto what's left of it.
    id: 'southBlock',
    p: [4, 0, 22],
    rotY: 0,
    w: 9,
    d: 6,
    h: 2.8,
    seed: 37,
    walls: [
      { a: [-4.5, -3], b: [4.5, -3], openings: [{ from: 3.3, to: 4.4, bottom: 0, top: 2.1 }, { from: 6.5, to: 7.5, bottom: 1.0, top: 1.9 }], broken: [{ from: 6.0, to: 9, min: 1.5, max: 2.6 }] },
      { a: [-4.5, 3], b: [4.5, 3], openings: [{ from: 1.5, to: 2.5, bottom: 1.0, top: 1.9 }, { from: 6.1, to: 7.9, bottom: 0, top: 9, breach: true }], broken: [{ from: 5.0, to: 9, min: 1.0, max: 2.4 }] },
      { a: [-4.5, -3], b: [-4.5, 3], openings: [{ from: 2.4, to: 3.6, bottom: 1.0, top: 1.9 }] },
      { a: [4.5, -3], b: [4.5, 3], openings: [{ from: 3.2, to: 4.3, bottom: 0, top: 2.1 }], broken: [{ from: 0, to: 3, min: 1.8, max: 2.6 }] },
      { a: [0.5, -3], b: [0.5, 3], openings: [{ from: 2.5, to: 3.7, bottom: 0, top: 2.1 }], broken: [{ from: 3.7, to: 6, min: 1.2, max: 2.4 }] },
    ],
    slabs: [{ x0: -4.65, x1: 0.65, z0: -3.15, z1: -0.6, top: 2.98, thick: 0.18 }],
    ramps: [{ top: [-3.0, 2.95, -3.2], bottom: [-3.0, 0.04, -6.4], width: 2.4 }],
    rubble: [
      { p: [2.6, 3.9], size: [1.8, 0.5, 1.2], rotY: 0.1 },
      { p: [2.4, 1.6], size: [1.2, 0.4, 1.0], rotY: -0.4 },
      { p: [-2.6, 1.4], size: [2.2, 0.45, 1.6], rotY: 0.15 },
    ],
  },
  {
    // Burnt-out house on the east edge; a shell breach faces the tower.
    id: 'eastHouse',
    p: [25, 0, 2],
    rotY: 0,
    w: 6,
    d: 6,
    h: 2.6,
    seed: 41,
    walls: [
      { a: [-3, -3], b: [3, -3], openings: [{ from: 2.5, to: 3.7, bottom: 1.0, top: 1.9 }], broken: [{ from: 0, to: 2.0, min: 1.4, max: 2.4 }] },
      { a: [-3, 3], b: [3, 3], openings: [{ from: 1.0, to: 2.0, bottom: 1.0, top: 1.9 }, { from: 3.8, to: 4.9, bottom: 0, top: 2.1 }] },
      { a: [-3, -3], b: [-3, 3], openings: [{ from: 1.6, to: 4.2, bottom: 0, top: 9, breach: true }], broken: [{ from: 0, to: 1.6, min: 1.4, max: 2.5 }, { from: 4.2, to: 6, min: 1.0, max: 2.2 }] },
      { a: [3, -3], b: [3, 3], openings: [{ from: 2.6, to: 3.4, bottom: 1.2, top: 1.8 }] },
    ],
    beams: true,
    rubble: [
      { p: [-3.9, 0.0], size: [1.4, 0.45, 1.8], rotY: 0.2 },
      { p: [-1.6, 0.6], size: [1.2, 0.5, 1.0], rotY: -0.3 },
    ],
  },
  {
    // Half-height pump room: the walls stop mid-chest almost everywhere.
    id: 'pumpRoom',
    p: [11, 0, 11],
    rotY: 0.35,
    w: 5,
    d: 4,
    h: 2.0,
    seed: 53,
    walls: [
      { a: [-2.5, -2], b: [2.5, -2], openings: [{ from: 1.8, to: 3.0, bottom: 0, top: 9, breach: true }], broken: [{ from: 0, to: 5, min: 0.9, max: 1.7 }] },
      { a: [-2.5, 2], b: [2.5, 2], openings: [{ from: 3.4, to: 4.4, bottom: 0, top: 9, breach: true }], broken: [{ from: 0, to: 5, min: 1.0, max: 2.0 }] },
      { a: [-2.5, -2], b: [-2.5, 2], broken: [{ from: 0, to: 4, min: 1.1, max: 1.9 }] },
      { a: [2.5, -2], b: [2.5, 2], broken: [{ from: 0, to: 4, min: 0.8, max: 1.5 }] },
    ],
    props: [{ p: [-0.6, 0.2], size: [1.6, 1.1, 1.0], rotY: 0 }],
    rubble: [{ p: [3.3, 0.8], size: [1.0, 0.35, 1.3], rotY: 0.5 }],
  },
]
for (const r of ruins) add({ type: 'ruin', ...r })
export const RUINS = Object.freeze(ruins)

/**
 * Splits a wall run into vertical strips: openings carve holes, broken ranges get
 * jagged tops. Deterministic (seeded), so client and server agree on every strip.
 */
function wallStrips(wall, h, rand) {
  const [ax, az] = wall.a
  const [bx, bz] = wall.b
  const L = Math.hypot(bx - ax, bz - az)
  const openings = wall.openings ?? []
  const broken = wall.broken ?? []
  const cuts = new Set([0, L])
  for (const o of openings) cuts.add(Math.max(0, o.from)).add(Math.min(L, o.to))
  for (const b of broken) cuts.add(Math.max(0, b.from)).add(Math.min(L, b.to))
  const marks = [...cuts].sort((x, y) => x - y)
  const out = []
  for (let i = 0; i < marks.length - 1; i++) {
    const s0 = marks[i]
    const s1 = marks[i + 1]
    if (s1 - s0 < 0.02) continue
    const mid = (s0 + s1) / 2
    const opening = openings.find((o) => mid > o.from && mid < o.to)
    const brk = broken.find((b) => mid > b.from && mid < b.to)
    // Broken stretches are chopped into uneven strips with ragged tops.
    const pieces = []
    if (brk) {
      let s = s0
      while (s < s1 - 0.01) {
        const w = Math.min(s1 - s, 0.35 + rand() * 0.5)
        pieces.push([s, s + w, brk.min + (brk.max - brk.min) * rand()])
        s += w
      }
    } else {
      pieces.push([s0, s1, h])
    }
    for (const [p0, p1, top] of pieces) {
      if (opening) {
        if (opening.breach) {
          // Shell hole: just a low ragged stub.
          const stub = 0.05 + rand() * 0.3
          out.push({ s0: p0, s1: p1, y0: 0, y1: stub, broken: true })
          continue
        }
        if (opening.bottom > 0) out.push({ s0: p0, s1: p1, y0: 0, y1: Math.min(opening.bottom, top), broken: Boolean(brk) })
        if (top > opening.top + 0.05) out.push({ s0: p0, s1: p1, y0: opening.top, y1: top, broken: Boolean(brk) })
      } else {
        out.push({ s0: p0, s1: p1, y0: 0, y1: top, broken: Boolean(brk) })
      }
    }
  }
  return { out, L, dir: [(bx - ax) / L, (bz - az) / L] }
}

const ruinCache = new Map()

/**
 * World-space boxes for a ruin: wall strips, floor slabs, ramps (tilted slabs),
 * rubble piles and props. Each has { p, size, q, yaw } plus a `kind`.
 */
export function ruinPieces(r) {
  if (ruinCache.has(r.id)) return ruinCache.get(r.id)
  const rand = seededRandom(r.seed ?? 1)
  const t = r.t ?? 0.3
  const toWorld = (lx, ly, lz) => {
    const o = yawOffset(r.p, lx, lz, r.rotY)
    return [o[0], r.p[1] + ly, o[2]]
  }
  const yawQ = (yaw) => quatFromEuler(0, yaw, 0)
  const walls = []
  for (const wall of r.walls) {
    const base = wall.base ?? 0
    const { out, dir } = wallStrips(wall, wall.h ?? r.h, rand)
    // Box local X runs along the wall.
    const yaw = Math.atan2(-dir[1], dir[0]) + r.rotY
    for (const s of out) {
      const along = (s.s0 + s.s1) / 2
      const lx = wall.a[0] + dir[0] * along
      const lz = wall.a[1] + dir[1] * along
      const height = s.y1 - s.y0
      if (height < 0.03) continue
      walls.push({
        kind: s.broken ? 'brick' : 'plaster',
        p: toWorld(lx, base + s.y0 + height / 2, lz),
        size: [s.s1 - s.s0, height, t],
        q: yawQ(yaw),
        yaw,
        top: base + s.y1,
      })
    }
  }
  const slabs = (r.slabs ?? []).map((sl) => ({
    kind: 'slab',
    p: toWorld((sl.x0 + sl.x1) / 2, sl.top - sl.thick / 2, (sl.z0 + sl.z1) / 2),
    size: [sl.x1 - sl.x0, sl.thick, sl.z1 - sl.z0],
    q: yawQ(r.rotY),
    yaw: r.rotY,
  }))
  const ramps = (r.ramps ?? []).map((rp) => {
    const box = rampBox(toWorld(...rp.top), toWorld(...rp.bottom), rp.width, rp.stairs ? 0.14 : 0.22)
    return { kind: rp.stairs ? 'stairs' : 'ramp', ...box, top: toWorld(...rp.top), bottom: toWorld(...rp.bottom), width: rp.width }
  })
  const rubble = (r.rubble ?? []).map((rb, i) => ({
    kind: 'rubble',
    p: toWorld(rb.p[0], rb.size[1] / 2, rb.p[1]),
    size: rb.size,
    q: yawQ(r.rotY + rb.rotY),
    yaw: r.rotY + rb.rotY,
    seed: (r.seed ?? 1) * 31 + i,
  }))
  const props = (r.props ?? []).map((pr) => ({
    kind: 'machine',
    p: toWorld(pr.p[0], pr.size[1] / 2, pr.p[1]),
    size: pr.size,
    q: yawQ(r.rotY + pr.rotY),
    yaw: r.rotY + pr.rotY,
  }))
  const pieces = { walls, slabs, ramps, rubble, props }
  ruinCache.set(r.id, pieces)
  return pieces
}

/** Points just outside and inside every ground-level opening, for bot navigation. */
function ruinDoorNodes(r) {
  const nodes = []
  for (const wall of r.walls) {
    if (wall.base) continue
    const [ax, az] = wall.a
    const [bx, bz] = wall.b
    const L = Math.hypot(bx - ax, bz - az)
    const dir = [(bx - ax) / L, (bz - az) / L]
    const normal = [-dir[1], dir[0]]
    for (const o of wall.openings ?? []) {
      if (o.bottom > 0.3) continue
      const from = Math.max(0, o.from)
      const to = Math.min(L, o.to)
      const mid = (from + to) / 2
      // Wide gaps (breaches) get several candidates; rubble may cover some of them.
      const alongs = to - from > 1.6 ? [mid, from + 0.5, to - 0.5] : [mid]
      for (const along of alongs) {
        const cx = ax + dir[0] * along
        const cz = az + dir[1] * along
        for (const side of [-1, 1]) {
          const o2 = yawOffset(r.p, cx + normal[0] * side * 0.9, cz + normal[1] * side * 0.9, r.rotY)
          nodes.push([o2[0], 0, o2[2]])
        }
      }
    }
  }
  return nodes
}

/* ---------------------------------------------------------------------------
 * Cover, props and edges
 * ------------------------------------------------------------------------- */

add({ type: 'pumpjack', p: [-14, 0, -14], rotY: -Math.PI / 4 })
add({ type: 'apc', p: [-5.5, 0, 11.5], rotY: 0.6 })

const barriers = [
  [-11, -8, 0.4], [-6, -16, -0.3], [-20, -10, 1.2], [-3, 17, 0.2], [8, 8, -Math.PI / 4],
  [16, 13, 0.3], [6, 15, 0], [19, -6, 0.1], [-2.5, -26, 0.15], [24, -11, 1.4],
  [-17, 2, 0.2], [25, 15, 0.5], [-14, 20.5, 1.0], [-9, -1, Math.PI / 2],
]
for (const [x, z, rotY] of barriers) add({ type: 'barrier', p: [x, 0, z], rotY, length: 3 })

const crates = [
  // [x, y, z, size, rotY]
  [15.6, 0, -11, 1.2, 0], [15.6, 1.2, -11, 1.2, 0.25],
  [-14, 0, -3, 1.2, 0.2], [-12.8, 0, -2.7, 1.2, -0.1], [-13.5, 1.2, -2.9, 1.0, 0.5],
  [2.5, 0, 12, 1.2, 0.3], [3.5, 0, 12.6, 1.0, -0.2], [4.5, 0, 5.5, 1.2, 0.6],
  [0.5, 0, -20, 1.2, 0.1], [1.6, 0, -20.6, 1.0, -0.3], [22, 0, -26, 1.2, 0.4],
  [-26, 0, -24, 1.2, 0.1], [10, 0, -24, 1.0, 0.2],
]
for (const [x, y, z, size, rotY] of crates) add({ type: 'crate', p: [x, y, z], size, rotY })

const barrels = [
  [-8, 4, 'red'], [-8.65, 4.45, 'blue'], [-7.6, 4.75, 'red'], [9.5, 14, 'yellow'], [10.15, 14.5, 'red'],
  [22.5, -14, 'blue'], [23.1, -14.8, 'red'], [22, -14.75, 'yellow'], [24, 26.5, 'red'],
  [-26.5, 7.5, 'blue'], [-25.9, 8, 'red'], [6.5, -12.5, 'yellow'], [-1.5, 24.8, 'blue'],
]
for (const [x, z, color] of barrels) add({ type: 'barrel', p: [x, 0, z], color })

const sandbags = [
  [-7.5, 1.5, Math.PI / 2, 3.0],
  [-1.5, 7.5, 0, 3.0],
  [12.5, 23, 0.1, 2.8],
  // U-shaped nest under the camo net.
  [14, -5.2, 0, 3.0],
  [12.6, -3.8, Math.PI / 2, 2.4],
  [15.4, -3.8, Math.PI / 2, 2.4],
]
for (const [x, z, rotY, length] of sandbags) add({ type: 'sandbags', p: [x, 0, z], rotY, length })
add({ type: 'camonet', p: [14, 0, -3.9], size: [4.2, 3.6], height: 2.35 })

add({ type: 'generator', p: [14.5, 0, 17], rotY: 0.15 })
add({ type: 'truck', p: [-27.3, 0, 3], rotY: 0.15 })
add({ type: 'truck', p: [1.5, 0, 28], rotY: Math.PI / 2 + 0.08 })
add({ type: 'scrap', p: [27.5, 0, -8], rotY: 0.4 })
add({ type: 'scrap', p: [-12, 0, -27.5], rotY: 2.2 })
add({ type: 'culvert', p: [7, 0, -27.2], rotY: Math.PI / 2 })
add({ type: 'culvert', p: [-27.5, 0, -14], rotY: 0 })

const boulders = [
  [-18, 4, 1.2], [21, 7, 1.4], [-1, -16, 1.0], [26, 9.5, 1.1], [14, -27, 1.3], [-20, -18, 0.9], [-28.5, 18, 1.0],
]
for (const [x, z, size] of boulders) add({ type: 'rock', p: [x, 0, z], size })

const palms = [
  [-29, 7.5, 6.5, 0.25], [28.5, -24, 7.2, -0.2], [9.5, 29.4, 6.0, 0.15], [-15, -28.6, 6.8, 0.3],
  [19.5, 15, 6.2, -0.25], [-29, -28.8, 7.0, 0.2],
]
for (const [x, z, h, lean] of palms) add({ type: 'palm', p: [x, 0, z], h, lean })

// Power line along the north and west walls.
export const POWER_LINES = Object.freeze([
  [[-26, -29.6], [-12, -29.6], [2, -29.6], [16, -29.6], [28, -29.6]],
  [[-29.6, -14], [-29.6, 0], [-29.6, 14]],
])
for (const line of POWER_LINES) for (const [x, z] of line) add({ type: 'pole', p: [x, 0, z] })
add({ type: 'powerlines' })

for (const [x, z] of [[-5.5, -5.5], [5.5, 5.5], [-5.5, 5.5]]) add({ type: 'lamp', p: [x, 0, z] })

add({ type: 'decor', seed: 7, shrubs: 170, pebbles: 90 })
// Visual-only ground detail: dirt tracks, oil stains, thin concrete pads.
add({ type: 'ground' })
add({ type: 'perimeter' })

export const ENTITIES = Object.freeze(entities)

/* ---------------------------------------------------------------------------
 * Spawns
 * ------------------------------------------------------------------------- */

const spawn = (x, z, faceX = 0, faceZ = 0) => ({
  p: [x, 0, z],
  // Face the given point (default: the tower). yaw 0 looks down -Z.
  yaw: Math.atan2(-(faceX - x), -(faceZ - z)),
})

export const SPAWNS = Object.freeze({
  [TEAMS.ALPHA]: [spawn(-27.5, -27.5), spawn(-21.5, -28.2), spawn(-28.2, -21.5), spawn(-28, -9)],
  [TEAMS.BRAVO]: [spawn(27.5, 27.5), spawn(21, 28.2), spawn(28.3, 12), spawn(13, 28)],
  ffa: [
    spawn(-27.5, -27.5),
    spawn(0, -28.5),
    spawn(27.5, -27.5),
    spawn(26, -12),
    spawn(27.5, 27.5),
    spawn(-4.5, 28.5),
    spawn(-28.5, -3),
    spawn(-22, 28.5),
  ],
})

/* ---------------------------------------------------------------------------
 * Bot navigation
 *
 * The server lays a grid over the map and keeps the points a bot can stand on
 * (see game/physics.js). Extra nodes cover doorways and narrow gaps the grid
 * misses; chains describe the elevated routes (stairs, tank tops, ramps), each
 * starting from a ground point.
 * ------------------------------------------------------------------------- */

export const NAV_GRID = Object.freeze({ spacing: 2.5, half: MAP_HALF - 1.2 })

export const NAV_EXTRA_NODES = Object.freeze([
  // Tank gap.
  [16.6, 0, -19], [16.6, 0, -23.2], [16.6, 0, -14.8],
  // Open container interiors and mouths.
  [-14, 0.08, 14], [-14, 0, 10.1], [-14, 0, 17.9],
  [-23, 0.08, 18], [-26.9, 0, 18],
  // Shack door and interior.
  [16.1, 0, 22], [18.1, 0, 22], [20, 0, 22.4],
  // Ruin doorways and breaches.
  ...ruins.flatMap(ruinDoorNodes),
])

export const NAV_CHAINS = Object.freeze([
  // Stairs -> landing -> tank 1 -> catwalk -> tank 2.
  [[9.2, 0, -9.1], [9.55, 5, -19], [13, 5, -19], [16.6, 5, -19], [20.2, 5, -19], [21.2, 5, -20.6]],
  // West house: outside stairs to the upper floor.
  [[-15.6, 0, 0.75], [-20.9, 3.25, 0.75], [-21.2, 3.25, -1.2], [-23, 3.25, -3]],
  // Outpost: up the collapsed roof onto the west wall.
  [[-0.1, 0, -23], [-1.7, 0.1, -23], [-5.6, 2.2, -23], [-6.4, 2.6, -23]],
  // South block: up the slab leaning on the north wall, onto the roof remnant.
  [[1.0, 0, 14.9], [1.0, 0.1, 15.5], [1.0, 1.5, 17.2], [1.0, 2.95, 18.8], [1.0, 2.98, 20.2]],
])

/* ---------------------------------------------------------------------------
 * Collider generation
 * ------------------------------------------------------------------------- */

const SOLID = GROUP.SOLID
const MOVE_ONLY = GROUP.MOVE_ONLY

/**
 * @typedef {{shape:'box', p:number[], half:number[], q:number[], group:number}
 *         | {shape:'cyl', p:number[], halfHeight:number, r:number, q:number[], group:number}} ColliderDef
 */

const IDENTITY_Q = [0, 0, 0, 1]

function boxC(p, size, q = IDENTITY_Q, group = SOLID) {
  return { shape: 'box', p, half: [size[0] / 2, size[1] / 2, size[2] / 2], q, group }
}

function cylC(p, r, h, q = IDENTITY_Q, group = SOLID) {
  return { shape: 'cyl', p, halfHeight: h / 2, r, q, group }
}

/** Box sitting on `base` (centre of its bottom face), rotated about Y. */
function groundBox(base, size, rotY = 0, group = SOLID) {
  return boxC([base[0], base[1] + size[1] / 2, base[2]], size, quatFromEuler(0, rotY, 0), group)
}

/** Cylinder between two points. */
function segmentCyl(a, b, r, group = SOLID) {
  const d = sub3(b, a)
  const length = Math.hypot(d[0], d[1], d[2])
  const q = quatFromUnitVectors([0, 1, 0], normalize3(d))
  return cylC([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r, length, q, group)
}

function towerColliders(t) {
  const out = []
  const { legInset: li, legSize: ls, legHeight: lh } = t
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) out.push(boxC([sx * li, lh / 2, sz * li], [ls, lh, ls]))
  }
  out.push(boxC([0, t.houseBottom + t.houseHeight / 2, 0], [t.houseSize, t.houseHeight, t.houseSize]))
  const ps = t.platformSize
  const top = t.platformTop
  out.push(boxC([0, top - 0.1, 0], [ps, 0.2, ps]))
  // Mast corner posts and the ring beam over the deck (head height after a jump).
  const mi = t.mastInset
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) out.push(boxC([sx * mi, top + t.mastBase / 2, sz * mi], [0.22, t.mastBase, 0.22]))
    out.push(boxC([sx * mi, top + t.mastBase, 0], [0.18, 0.18, mi * 2 + 0.22]))
    out.push(boxC([0, top + t.mastBase, sx * mi], [mi * 2 + 0.22, 0.18, 0.18]))
  }

  // Railing: a solid kick plate (stops bullets, gives crouch cover) and a
  // movement-only upper section (keeps players on, lets bullets through).
  const half = ps / 2
  const kick = 0.3
  const upper = t.railHeight - kick
  const gap = t.ladderGap
  const rails = [
    { c: [0, -half + 0.04], s: [ps, 0.08] },
    { c: [half - 0.04, 0], s: [0.08, ps] },
    { c: [-half + 0.04, 0], s: [0.08, ps] },
    { c: [-(half + gap) / 2, half - 0.04], s: [half - gap, 0.08] },
    { c: [(half + gap) / 2, half - 0.04], s: [half - gap, 0.08] },
  ]
  for (const r of rails) {
    out.push(boxC([r.c[0], top + kick / 2, r.c[1]], [r.s[0], kick, r.s[1]]))
    out.push(boxC([r.c[0], top + kick + upper / 2, r.c[1]], [r.s[0], upper, r.s[1]], IDENTITY_Q, MOVE_ONLY))
  }
  out.push(boxC([0, 0.15, 0], [2.6, 0.3, 2.0]))
  out.push(boxC([0, 0.85, 0], [1.8, 1.1, 1.2]))
  out.push(cylC([-0.6, 5.2, -0.4], 0.18, 7.6))
  return out
}

function containerColliders(c) {
  const { length: L, height: H, width: W, wall } = CONTAINER
  const q = quatFromEuler(0, c.rotY, 0)
  const at = (lx, ly, lz) => {
    const o = yawOffset(c.p, lx, lz, c.rotY)
    return [o[0], c.p[1] + ly, o[2]]
  }
  if (!c.open) return [boxC(at(0, H / 2, 0), [L, H, W], q)]
  return [
    boxC(at(0, wall / 2, 0), [L, wall, W], q),
    boxC(at(0, H - wall / 2, 0), [L, wall, W], q),
    boxC(at(0, H / 2, -W / 2 + wall / 2), [L, H, wall], q),
    boxC(at(0, H / 2, W / 2 - wall / 2), [L, H, wall], q),
  ]
}

/** Splits a wall run into solid pieces around door/window openings. */
function wallPieces(from, to, height, openings) {
  const pieces = []
  const sorted = [...openings].sort((a, b) => a.from - b.from)
  let cursor = from
  for (const o of sorted) {
    if (o.from > cursor) pieces.push({ a: cursor, b: o.from, y0: 0, y1: height })
    if ((o.bottom ?? 0) > 0) pieces.push({ a: o.from, b: o.to, y0: 0, y1: o.bottom })
    if (o.top < height) pieces.push({ a: o.from, b: o.to, y0: o.top, y1: height })
    cursor = o.to
  }
  if (cursor < to) pieces.push({ a: cursor, b: to, y0: 0, y1: height })
  return pieces
}

/** Shack walls as axis-aligned pieces — exported so the client renders the same cuts. */
export function shackWallBoxes(s) {
  const out = []
  const t = s.wall
  const openingsFor = (wall) => [
    ...(s.door.wall === wall ? [{ from: s.door.from, to: s.door.to, bottom: 0, top: s.door.top }] : []),
    ...s.windows.filter((w) => w.wall === wall),
  ]
  const runs = [
    { wall: 'north', axis: 'x', fixed: s.z0 + t / 2, from: s.x0, to: s.x1 },
    { wall: 'south', axis: 'x', fixed: s.z1 - t / 2, from: s.x0, to: s.x1 },
    { wall: 'west', axis: 'z', fixed: s.x0 + t / 2, from: s.z0 + t, to: s.z1 - t },
    { wall: 'east', axis: 'z', fixed: s.x1 - t / 2, from: s.z0 + t, to: s.z1 - t },
  ]
  for (const run of runs) {
    for (const piece of wallPieces(run.from, run.to, s.height, openingsFor(run.wall))) {
      const mid = (piece.a + piece.b) / 2
      const len = piece.b - piece.a
      const h = piece.y1 - piece.y0
      if (len <= 0.001 || h <= 0.001) continue
      const p = run.axis === 'x' ? [mid, piece.y0 + h / 2, run.fixed] : [run.fixed, piece.y0 + h / 2, mid]
      const size = run.axis === 'x' ? [len, h, t] : [t, h, len]
      out.push({ p, size, wall: run.wall })
    }
  }
  return out
}

function shackColliders(s) {
  const out = shackWallBoxes(s).map((b) => boxC(b.p, b.size))
  const cx = (s.x0 + s.x1) / 2
  const cz = (s.z0 + s.z1) / 2
  out.push(boxC([cx, s.height + s.roofThickness / 2, cz], [s.x1 - s.x0 + 0.4, s.roofThickness, s.z1 - s.z0 + 0.4]))
  return out
}

function stairsColliders(st) {
  const r = rampBox(st.top, st.bottom, st.width, 0.12)
  return [boxC(r.p, r.size, r.q)]
}

function pipelineColliders() {
  const { pipes, racks, fallen } = pipelinePieces()
  const out = pipes.map((p) => segmentCyl(p.a, p.b, p.r))
  out.push(segmentCyl(fallen.a, fallen.b, fallen.r))
  const h = PIPELINE.height - PIPELINE.radius
  for (const rack of racks) {
    const q = quatFromEuler(0, rack.yaw, 0)
    for (const side of [-1, 1]) {
      const o = yawOffset(rack.p, side * PIPELINE.rackHalf, 0, rack.yaw)
      out.push(boxC([o[0], h / 2, o[2]], [0.22, h, 0.22], q))
    }
    out.push(boxC([rack.p[0], h - 0.09, rack.p[2]], [PIPELINE.rackHalf * 2 + 0.22, 0.18, 0.22], q))
  }
  return out
}

function catwalkColliders(c) {
  const out = [boxC([c.p[0], c.p[1] - 0.06, c.p[2]], [c.length, 0.12, c.width])]
  for (const side of [-1, 1]) {
    out.push(
      boxC([c.p[0], c.p[1] + 0.5, c.p[2] + side * (c.width / 2 - 0.03)], [c.length - 0.6, 1.0, 0.06], IDENTITY_Q, MOVE_ONLY),
    )
  }
  return out
}

function pumpjackColliders(e) {
  const at = (lx, lz) => yawOffset(e.p, lx, lz, e.rotY)
  return [
    groundBox(e.p, [5.2, 0.6, 1.5], e.rotY),
    groundBox(at(0.3, 0), [0.6, 4.0, 1.3], e.rotY),
    groundBox(at(-2.0, 0), [1.2, 1.4, 1.2], e.rotY),
  ]
}

function truckColliders(e) {
  const at = (lx, lz) => yawOffset(e.p, lx, lz, e.rotY)
  return [groundBox(at(0, -1.45), [1.9, 2.0, 1.5], e.rotY), groundBox(at(0, 0.85), [1.9, 1.25, 2.9], e.rotY)]
}

function apcColliders(e) {
  const turret = yawOffset(e.p, 0, 0.4, e.rotY)
  return [groundBox(e.p, [2.6, 2.05, 5.6], e.rotY), groundBox([turret[0], 2.05, turret[2]], [1.4, 0.6, 1.5], e.rotY + 0.8)]
}

function scrapColliders(e) {
  const at = (lx, lz) => yawOffset(e.p, lx, lz, e.rotY)
  return [groundBox(at(0, 0), [2.4, 1.1, 1.4], e.rotY + 0.2), groundBox(at(1.1, 0.9), [1.0, 0.8, 1.0], e.rotY)]
}

function ruinColliders(r) {
  const { walls, slabs, ramps, rubble, props } = ruinPieces(r)
  return [...walls, ...slabs, ...ramps, ...rubble, ...props].map((b) => boxC(b.p, b.size, b.q))
}

function perimeterColliders() {
  const H = 30
  const T = 1.0
  const off = WALL_LINE + T / 2 - 0.2
  const span = WALL_LINE * 2 + 2
  return [
    boxC([0, H / 2, -off], [span, H, T]),
    boxC([0, H / 2, off], [span, H, T]),
    boxC([-off, H / 2, 0], [T, H, span]),
    boxC([off, H / 2, 0], [T, H, span]),
    // Ground slab: a thick box rather than a plane so fast bodies can't tunnel through.
    boxC([0, -1, 0], [160, 2, 160]),
  ]
}

const COLLIDER_BUILDERS = {
  tower: towerColliders,
  tank: (t) => [cylC([t.p[0], t.h / 2, t.p[2]], t.r, t.h)],
  catwalk: catwalkColliders,
  stairs: stairsColliders,
  landing: (e) => [boxC([e.p[0], e.p[1] - 0.1, e.p[2]], [e.size[0], 0.2, e.size[1]])],
  pipeline: pipelineColliders,
  container: containerColliders,
  deckTank: (e) => [groundBox([e.p[0], e.p[1] + 0.3, e.p[2]], [e.length, e.r * 2, e.r * 2], e.rotY)],
  crate: (e) => [groundBox(e.p, [e.size, e.size, e.size], e.rotY)],
  shack: shackColliders,
  desk: (e) => [groundBox(e.p, e.size, e.rotY)],
  lockers: (e) => [groundBox(e.p, e.size, e.rotY)],
  ammoCrate: (e) => [groundBox(e.p, e.size, e.rotY)],
  pumpjack: pumpjackColliders,
  barrier: (e) => [groundBox(e.p, [e.length, 1.0, 0.62], e.rotY)],
  barrel: (e) => [cylC([e.p[0], 0.45, e.p[2]], 0.3, 0.9)],
  sandbags: (e) => [groundBox(e.p, [e.length, 0.95, 0.7], e.rotY)],
  generator: (e) => [groundBox(e.p, [2.2, 1.4, 1.2], e.rotY)],
  truck: truckColliders,
  apc: apcColliders,
  scrap: scrapColliders,
  palm: (e) => [cylC([e.p[0], 1.5, e.p[2]], 0.2, 3.0)],
  ruin: ruinColliders,
  culvert: (e) => [cylC([e.p[0], 0.85, e.p[2]], 0.85, 2.4, quatMultiply(quatFromEuler(0, e.rotY, 0), quatFromEuler(Math.PI / 2, 0, 0)))],
  rock: (e) => [cylC([e.p[0], e.size * 0.35, e.p[2]], e.size * 0.5, e.size * 0.7)],
  pole: (e) => [cylC([e.p[0], 3.5, e.p[2]], 0.14, 7)],
  lamp: (e) => [cylC([e.p[0], 2.2, e.p[2]], 0.11, 4.4)],
  camonet: (e) => {
    // Corner poles only; the net itself is see-through and walk-under.
    const [w, d] = e.size
    return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) =>
      cylC([e.p[0] + (sx * w) / 2, e.height / 2, e.p[2] + (sz * d) / 2], 0.05, e.height),
    )
  },
  perimeter: perimeterColliders,
}

let colliderCache = null

/** Flat, cached list of every collider in the map. Identical on client and server. */
export function buildColliders() {
  if (colliderCache) return colliderCache
  const out = []
  for (const e of ENTITIES) {
    const build = COLLIDER_BUILDERS[e.type]
    if (build) out.push(...build(e))
  }
  colliderCache = Object.freeze(out)
  return colliderCache
}

/** Is a feet position inside a ladder volume? Returns the ladder or null. */
export function ladderAt(x, y, z) {
  for (const l of LADDERS) {
    if (x >= l.min[0] && x <= l.max[0] && y >= l.min[1] && y <= l.max[1] && z >= l.min[2] && z <= l.max[2]) return l
  }
  return null
}

/** Below this, a player has fallen out of the world. */
export const KILL_Y = -5
