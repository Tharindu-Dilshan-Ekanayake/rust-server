/**
 * "Dustline Pumpstation" — the map, as data.
 *
 * Coordinates are metres. +X is east, -Z is north, +Y is up, ground is y = 0.
 * The playable square is 60 x 60 m centred on the refinery at the origin.
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
 * Derrick tower (north-east corner, by the pipeline). Steel legs, a corrugated head
 * house, the lookout platform, and a lattice mast rising above it with open
 * sides so the platform still sees the whole map. Everything below is relative
 * to `p`.
 * ------------------------------------------------------------------------- */

export const TOWER = Object.freeze({
  p: [25, 0, -21],
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
  /** Guy-wire ground anchors (x, z), placed clear of the tanks, pipeline and outpost. */
  guys: [[4.5, -3.4], [-5.5, -3.4], [4.5, 5.6], [-5.5, 6]],
})
add({ type: 'tower', ...TOWER })

/**
 * A fixed ladder up the face of something. `foot` is where its rails stand
 * (x, z), `dir` the horizontal direction into the structure (and the way you
 * step off at the top), `topY` the floor it leads to, rungs from `rungs[0]`
 * every `rungs[1]` metres above `base` (where its feet stand).
 *
 * The climb volume (feet position) sits in front of the rails; inside it W/S
 * climb instead of walk, and the climber is held at `x, z`, a forearm's
 * length back from the rungs.
 */
function ladder(foot, dir, topY, rungs, standoff = 0.12, base = 0) {
  const side = [-dir[2], 0, dir[0]]
  const face = [foot[0] + dir[0] * standoff, foot[1] + dir[2] * standoff]
  const out = [foot[0] - dir[0] * 0.95, foot[1] - dir[2] * 0.95]
  const xs = [face[0] + side[0] * 0.6, face[0] - side[0] * 0.6, out[0] + side[0] * 0.6, out[0] - side[0] * 0.6]
  const zs = [face[1] + side[2] * 0.6, face[1] - side[2] * 0.6, out[1] + side[2] * 0.6, out[1] - side[2] * 0.6]
  return Object.freeze({
    min: [Math.min(...xs), base - 0.2, Math.min(...zs)],
    max: [Math.max(...xs), topY + 0.4, Math.max(...zs)],
    topY,
    exitDir: dir,
    x: foot[0] - dir[0] * 0.4,
    z: foot[1] - dir[2] * 0.4,
    foot,
    side,
    base,
    rungs: [base + rungs[0], rungs[1]],
  })
}

const STACK_TOP = 5.2

/* ---------------------------------------------------------------------------
 * Refinery (centre). A corrugated pump hall with an open bay beside it, a deck
 * over both, a tall process tower and a raised tank platform. A conveyor ramp
 * runs up to the deck from the west; ladders go ground -> deck -> platform ->
 * tower top. All coordinates are world space.
 * ------------------------------------------------------------------------- */

export const REFINERY = Object.freeze({
  hall: { x0: -5, x1: 1, z0: -4, z1: 4, h: 3.4, wall: 0.2 },
  bay: { x0: 1, x1: 5 },
  /** Top of the deck slab over the hall and bay. */
  deck: 3.6,
  tower: { x0: -4.6, x1: -1.2, z0: -3.6, z1: -0.2, top: 11 },
  platform: { x0: -1.2, x1: 5, z0: -4, z1: 0.6, top: 6.6 },
  /** Columns holding the platform up off the deck (x, z). */
  columns: [[4.85, -3.85], [4.85, 0.45], [1.6, -3.85], [1.6, 0.45]],
  tank: { p: [3.2, -2.3], r: 0.95, h: 2.6 },
  /** Ground clutter: an IBC tote by the bay, stacks of tyres (x, z, how many). */
  ibc: [6.9, -5.6],
  tyres: [[6.4, 4.3, 4], [7.1, 3.7, 2]],
  conveyor: { top: [-5.05, 3.6, 2], bottom: [-14, 0, 2], width: 1.6, legs: [-11.6, -8.6] },
  /** Door/window cuts per wall: from/to along the wall, bottom/top heights. */
  walls: [
    { side: 'north', fixed: -4, from: -5, to: 1, openings: [{ from: -1.0, to: 0.2, bottom: 0, top: 2.2 }] },
    { side: 'south', fixed: 4, from: -5, to: 1, openings: [{ from: -3.4, to: -2.2, bottom: 0, top: 2.2 }, { from: -1.2, to: 0.2, bottom: 1.0, top: 2.0 }] },
    { side: 'west', fixed: -5, from: -4, to: 4, openings: [{ from: -1.5, to: 0.5, bottom: 1.0, top: 2.2 }] },
    // Between hall and bay: a wide doorway with a lintel.
    { side: 'east', fixed: 1, from: -4, to: 4, openings: [{ from: -3.0, to: 3.0, bottom: 0, top: 2.6 }] },
    // Bay's outer wall, with a big grille window.
    { side: 'east', fixed: 5, from: -4, to: 4, openings: [{ from: -2.8, to: 0.2, bottom: 1.0, top: 2.6 }] },
  ],
  /** Deck rails leave gaps where the conveyor and ladders arrive: [side, from, to]. */
  deckGaps: [['west', 1.1, 2.9], ['east', 1.95, 2.85], ['south', 1.95, 3.25]],
  /** Outside stairs from the south yard up to the deck (a third way up besides the conveyor and ladder). */
  stairs: { bottom: [2.6, 0, 9.7], top: [2.6, 3.6, 4.15], width: 1.2 },
  platformGaps: [['south', 2.75, 3.65]],
  towerGaps: [['east', -2.35, -1.45]],
})
add({ type: 'refinery', ...REFINERY })
add({ type: 'stairs', ...REFINERY.stairs })

export const LADDERS = Object.freeze([
  // Derrick: up to the lookout deck, through the gap in its rail.
  ladder([TOWER.p[0] + TOWER.ladderX, TOWER.p[2] + TOWER.ladderZ], [0, 0, -1], TOWER.p[1] + TOWER.platformTop, [0.3, 0.32], 0.42),
  // East end of the red/blue stack, and the south side of the white/rust one.
  ladder([-20.88, 11], [-1, 0, 0], STACK_TOP, [0.3, 0.3]),
  ladder([12.1, -17.68], [0, 0, -1], STACK_TOP, [0.3, 0.3]),
  // Refinery: ground -> deck (bay wall), deck -> tank platform, platform -> tower top.
  ladder([5.12, 2.4], [-1, 0, 0], REFINERY.deck, [0.3, 0.3]),
  ladder([3.2, 0.72], [0, 0, -1], REFINERY.platform.top, [0.3, 0.3], 0.12, REFINERY.deck),
  ladder([-1.08, -1.9], [-1, 0, 0], REFINERY.tower.top, [0.3, 0.3], 0.12, REFINERY.platform.top),
])
for (const l of LADDERS.slice(1)) add({ type: 'ladder', foot: l.foot, dir: l.exitDir, topY: l.topY, base: l.base, rungs: l.rungs })

/* ---------------------------------------------------------------------------
 * Tank yard (south-west corner): two storage tanks joined by a catwalk, stairs
 * up to a landing on the east tank. The derrick has the opposite corner, so
 * each high point is a neutral corner the same distance from both spawns.
 * ------------------------------------------------------------------------- */

export const TANKS = Object.freeze([
  Object.freeze({ p: [-19, 0, 25.5], r: 3, h: 5 }),
  Object.freeze({ p: [-26.2, 0, 25.5], r: 3, h: 5 }),
])
for (const t of TANKS) add({ type: 'tank', ...t })
add({ type: 'catwalk', p: [-22.6, 5, 25.5], length: 2.2, width: 1.4 })
export const STAIRS = Object.freeze({ bottom: [-15.2, 0, 17], top: [-15.2, 5, 24.5], width: 1.2 })
add({ type: 'stairs', ...STAIRS })
add({ type: 'landing', p: [-15.55, 5, 25.5], size: [2.1, 2.0] })

/* ---------------------------------------------------------------------------
 * Elevated pipeline along the north wall
 *
 * Comes in through the east wall and runs west on H-frame racks with its
 * underside at 2.35 m, leaving a lane between it and the wall. Its west end is
 * torn off: the last length has dropped, one end still up by the rack and the
 * other buried in the sand (you can run up it onto the pipe), and a loose
 * section lies further on as low cover.
 * ------------------------------------------------------------------------- */

export const PIPELINE = Object.freeze({
  /** Runs along z = `z` from x = `from` (outside the east wall) west to the torn end at `torn`. */
  z: -27,
  from: 36,
  torn: 0,
  height: 3.35,
  radius: 1.0,
  fallenRadius: 0.85,
  racks: [28, 23.4, 18.6, 13.6, 9.6, 4.4, 1.6],
  rackHalf: 1.35,
  /** Service line: radius, offset from the main (z), where it drops to the ground (x). */
  small: { r: 0.2, dz: 1.15, dropX: 2.6 },
  /** Gate valve on top of the main (x), and the bellows of an expansion joint (x). */
  valveX: 20.8,
  bellowsX: 11.6,
})
const PIPE_DIR = [-1, 0, 0]
const pipeAt = (x, y = PIPELINE.height, dz = 0) => [x, y, PIPELINE.z + dz]
/** Where the pipeline passes through the perimeter, so the fence can leave a gap. */
export const PIPE_CROSSINGS = Object.freeze([['east', PIPELINE.z]])

/** Pipe runs, rack frames and the fallen sections, in world space. */
export function pipelinePieces() {
  const { radius: r, torn } = PIPELINE
  const pipes = [{ a: pipeAt(PIPELINE.from), b: pipeAt(torn), r, open: 'b' }]
  const yaw = Math.atan2(PIPE_DIR[0], PIPE_DIR[2])
  const racks = PIPELINE.racks.map((x) => ({ p: pipeAt(x, 0), yaw }))
  const fr = PIPELINE.fallenRadius
  const fallen = [
    // The dropped length: top end resting by the torn mouth (a short step down
    // from the pipe's crown), bottom end sunk in the sand.
    { a: pipeAt(torn - 0.35, 3.15), b: pipeAt(torn - 8.4, -0.85, 0.1), r: r * 0.97, open: 'both', walk: true },
    // A loose section further west, slewed and half buried.
    { a: [-11.6, fr - 0.3, PIPELINE.z + 1.6], b: [-16.4, fr - 0.3, PIPELINE.z + 3.3], r: fr, open: 'both' },
  ]
  // Service line: along the racks on the crossbeams, then an elbow down to its valve.
  const { small } = PIPELINE
  const sy = PIPELINE.height - r + small.r
  const sz = PIPELINE.z + small.dz
  const service = [
    { a: [PIPELINE.from, sy, sz], b: [small.dropX, sy, sz], r: small.r },
    { a: [small.dropX, sy + small.r * 0.6, sz], b: [small.dropX, 0, sz], r: small.r },
  ]
  return { pipes, racks, fallen, service, dir: PIPE_DIR }
}
add({ type: 'pipeline' })

/* ---------------------------------------------------------------------------
 * Container yard (south-west)
 * ------------------------------------------------------------------------- */

export const CONTAINER = Object.freeze({ length: 6.0, height: 2.6, width: 2.4, wall: 0.08 })
const containers = [
  { p: [-24, 0, 11], rotY: 0, color: 'red', open: false },
  { p: [-24, 2.6, 11], rotY: 0, color: 'blue', open: false },
  { p: [-11.5, 0, 13], rotY: Math.PI / 2, color: 'green', open: true },
  { p: [-23, 0, 18], rotY: 0, color: 'orange', open: true },
  { p: [14, 0, -19], rotY: 0, color: 'white', open: false },
  { p: [14.5, 2.6, -19], rotY: 0, color: 'rust', open: false },
  { p: [20, 0, -12], rotY: 0.15, color: 'teal', open: false },
  { p: [-8.5, 0, 25.5], rotY: 0.25, color: 'mustard', open: false },
  { p: [-12.5, 0, 6], rotY: -0.1, color: 'red', open: false },
]
for (const c of containers) add({ type: 'container', ...c })
// White pressure tanks on cradles behind yellow rails, on top of the two stacks.
// `gap`: where the deck rail opens for a ladder (side, from, to, in the tank's frame).
add({ type: 'deckTank', p: [-24, 5.2, 11], rotY: 0, length: 4.2, r: 0.8, gap: { side: 'x+', from: -0.4, to: 0.4 } })
add({ type: 'deckTank', p: [14.5, 5.2, -19], rotY: 0, length: 3.6, r: 0.75, gap: { side: 'z+', from: -2.95, to: -1.5 } })
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
 * windows and breaches. `drifts` are sand banked against a wall:
 * [x, z at the wall's foot, length along it, depth out from it, height, side
 * 'n' | 's' | 'e' | 'w']. `ruinPieces()` turns all of it into boxes.
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
      // Upper storey: still standing tall at the west end with its windows,
      // shattered elsewhere.
      { a: [-4, -3], b: [0.6, -3], base: 3.25, h: 2.6, openings: [{ from: 0.8, to: 1.8, bottom: 0.9, top: 1.9 }], broken: [{ from: 2.3, to: 4.6, min: 0.35, max: 2.0 }] },
      { a: [-4, -3], b: [-4, 3], base: 3.25, h: 2.6, openings: [{ from: 0.8, to: 1.8, bottom: 0.9, top: 1.9 }, { from: 2.4, to: 3.4, bottom: 0, top: 9 }], broken: [{ from: 3.4, to: 6, min: 0.5, max: 1.9 }] },
      { a: [-4, 3], b: [-0.6, 3], base: 3.25, h: 1.6, broken: [{ from: 0, to: 3.4, min: 0.4, max: 1.6 }] },
    ],
    slabs: [{ x0: -4.15, x1: 0.75, z0: -3.15, z1: 3.15, top: 3.25, thick: 0.25 }],
    ramps: [{ top: [0.3, 3.25, 3.75], bottom: [4.6, 0, 3.75], width: 1.1, stairs: true }],
    drifts: [[-4, 0.5, 3.4, 1.9, 0.75, 'w'], [1.5, -3, 3.6, 1.6, 0.6, 'n'], [4, -1.0, 2.2, 1.5, 0.5, 'e']],
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
    drifts: [[-3, 0.5, 3.0, 1.6, 0.6, 'w'], [0, 2.5, 3.6, 1.4, 0.5, 's']],
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
      { a: [-4.5, -3], b: [-4.5, 3], base: 2.8, h: 2.3, openings: [{ from: 0.6, to: 1.5, bottom: 0.8, top: 1.7 }], broken: [{ from: 1.8, to: 6, min: 0.2, max: 1.6 }] },
    ],
    drifts: [[-4.5, 1.5, 3.0, 1.8, 0.7, 'w'], [2.5, 3, 3.4, 1.5, 0.55, 's']],
    slabs: [{ x0: -4.65, x1: 0.65, z0: -3.15, z1: -0.6, top: 2.98, thick: 0.18 }],
    ramps: [{ top: [-3.0, 2.95, -3.2], bottom: [-3.0, 0.04, -6.4], width: 2.4 }],
    rubble: [
      { p: [2.6, 3.9], size: [1.8, 0.5, 1.2], rotY: 0.1 },
      { p: [2.4, 1.6], size: [1.2, 0.4, 1.0], rotY: -0.4 },
      { p: [-2.6, 1.4], size: [2.2, 0.45, 1.6], rotY: 0.15 },
    ],
  },
  {
    // Gutted two-storey shell on the east edge: the floors are gone but the walls
    // still stand high with their upper windows; a shell breach faces the yard.
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
      // Upper storey, only over walls still whole below.
      { a: [-1, -3], b: [3, -3], base: 2.6, h: 2.5, openings: [{ from: 1.6, to: 2.6, bottom: 0.8, top: 1.8 }], broken: [{ from: 0, to: 1.2, min: 0.3, max: 1.8 }] },
      { a: [3, -3], b: [3, 3], base: 2.6, h: 2.5, openings: [{ from: 1.0, to: 2.0, bottom: 0.8, top: 1.8 }, { from: 3.6, to: 4.6, bottom: 0.8, top: 1.8 }], broken: [{ from: 4.8, to: 6, min: 0.6, max: 2.2 }] },
      { a: [-3, 3], b: [3, 3], base: 2.6, h: 2.4, broken: [{ from: 0, to: 2.4, min: 0.2, max: 1.4 }, { from: 2.4, to: 6, min: 1.0, max: 2.4 }] },
    ],
    drifts: [[-3, 2.2, 1.5, 1.8, 0.7, 'w'], [0.5, 3, 3.0, 1.5, 0.55, 's'], [3, -1.0, 3.2, 1.7, 0.8, 'e']],
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
/** Which way a drift's slope runs down (local yaw), by the side of the wall it's on. */
const DRIFT_YAW = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 }

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
  // Sand drifts: a slope from up the wall down to the ground, walkable.
  const drifts = (r.drifts ?? []).map(([lx, lz, len, depth, h, side]) => {
    const yaw = DRIFT_YAW[side]
    const out = [Math.sin(yaw), Math.cos(yaw)]
    const top = toWorld(lx, h * 0.9, lz)
    const bottom = toWorld(lx + out[0] * depth, 0, lz + out[1] * depth)
    return { kind: 'drift', ...rampBox(top, bottom, len * 0.7, 0.3), at: toWorld(lx, 0, lz), yawOut: r.rotY + yaw, len, depth, h }
  })
  const pieces = { walls, slabs, ramps, rubble, props, drifts }
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
add({ type: 'apc', p: [-5.5, 0, 11.5], rotY: 0.6, fire: [-0.6, 2.35, -1.0] })
add({ type: 'tanker', p: [-10, 0, -9.5], rotY: 2.3, fire: [0, 2.95, -3.1] })
add({ type: 'pipeStack', p: [6.5, 0, -19], rotY: 0.35 })
add({ type: 'car', p: [15.2, 0, 5.2], rotY: 1.15, smoke: [0, 1.1, -1.3] })

const barriers = [
  [-6, -16, -0.3], [-20, -10, 1.2], [-3, 17, 0.2], [8, 8, -Math.PI / 4],
  [16, 13, 0.3], [6, 15, 0], [19, -6, 0.1], [-2.5, -26, 0.15], [24, -11, 1.4],
  [-17, 2, 0.2], [25, 15, 0.5], [-11.2, 20.8, 1.0], [-9, -1, Math.PI / 2],
  [1.2, -11.2, 0.25], [4.6, -12.6, -0.5],
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
  [26.4, -14, 'blue'], [27, -14.8, 'red'], [25.9, -14.75, 'yellow'], [24, 26.5, 'red'],
  [-26.5, 7.5, 'blue'], [-25.9, 8, 'red'], [6.5, -12.5, 'yellow'], [-1.5, 24.8, 'blue'],
]
for (const [x, z, color] of barrels) add({ type: 'barrel', p: [x, 0, z], color })

const sandbags = [
  [-7.5, 5.9, 0, 3.0],
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
add({ type: 'truck', p: [-27.3, 0, 3], rotY: 0.15, fire: [0, 2.2, -0.98] })
add({ type: 'truck', p: [1.5, 0, 28], rotY: Math.PI / 2 + 0.08, fire: [0, 2.2, -0.98] })
add({ type: 'scrap', p: [27.5, 0, -8], rotY: 0.4 })
add({ type: 'scrap', p: [-20, 0, -24], rotY: 2.2 })
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
  [-22.6, 0, 25.5], [-22.6, 0, 21.2], [-22.6, 0, 29.6],
  // Open container interiors and mouths.
  [-11.5, 0.08, 13], [-11.5, 0, 9.1], [-11.5, 0, 16.9],
  [-23, 0.08, 18], [-26.9, 0, 18],
  // Shack door and interior.
  [16.1, 0, 22], [18.1, 0, 22], [20, 0, 22.4],
  // Refinery doors, hall and bay.
  [-2.8, 0, 4.9], [-2.8, 0, 3.0], [-0.4, 0, -4.9], [-0.4, 0, -3.0], [3, 0, 0], [3, 0, -3], [-0.5, 0, 0],
  // Ruin doorways and breaches.
  ...ruins.flatMap(ruinDoorNodes),
])

export const NAV_CHAINS = Object.freeze([
  // Refinery: up the south stairs onto the deck.
  [[2.6, 0, 10.6], [2.6, 0.6, 8.9], [2.6, 2.4, 6.0], [2.6, 3.6, 4.0], [0.6, 3.6, 2.6]],
  // Refinery: up the conveyor onto the deck.
  [[-14.9, 0, 2], [-13.4, 0.25, 2], [-9.5, 1.8, 2], [-5.8, 3.3, 2], [-4.2, 3.6, 2.2], [-0.5, 3.6, 2.4], [3.2, 3.6, 2.6]],
  // Stairs -> landing -> tank 1 -> catwalk -> tank 2.
  [[-15.2, 0, 16.1], [-15.55, 5, 25.5], [-19, 5, 25.5], [-22.6, 5, 25.5], [-26.2, 5, 25.5], [-27.2, 5, 27.1]],
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
  // Built around the origin, then moved to the tower's spot.
  const moved = () => out.map((c) => ({ ...c, p: [c.p[0] + t.p[0], c.p[1] + t.p[1], c.p[2] + t.p[2]] }))
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
  return moved()
}

/** Wall runs with door/window cuts (refinery walls), as world boxes. */
function cutWall(w, height, t) {
  const out = []
  const along = w.side === 'north' || w.side === 'south'
  // Runs along x butt into the side walls rather than overlapping their corners.
  const from = along ? w.from + t : w.from
  const to = along ? w.to - t : w.to
  for (const piece of wallPieces(from, to, height, w.openings ?? [])) {
    const mid = (piece.a + piece.b) / 2
    const len = piece.b - piece.a
    const h = piece.y1 - piece.y0
    if (len <= 0.001 || h <= 0.001) continue
    const inset = w.side === 'north' || w.side === 'west' ? t / 2 : -t / 2
    out.push(along ? { p: [mid, piece.y0 + h / 2, w.fixed + inset], size: [len, h, t] } : { p: [w.fixed + inset, piece.y0 + h / 2, mid], size: [t, h, len] })
  }
  return out
}

/**
 * Straight rail runs round a rectangle, skipping `gaps` ([side, from, to]):
 * [{ side, axis, fixed, a, b }] with `axis` the direction the run goes.
 */
export function railRuns(x0, x1, z0, z1, gaps = []) {
  const out = []
  const sides = [
    ['north', 'x', z0 + 0.04, x0, x1],
    ['south', 'x', z1 - 0.04, x0, x1],
    ['west', 'z', x0 + 0.04, z0, z1],
    ['east', 'z', x1 - 0.04, z0, z1],
  ]
  for (const [side, axis, fixed, from, to] of sides) {
    let cursor = from
    const cuts = gaps.filter((g) => g[0] === side).sort((p, q) => p[1] - q[1])
    for (const [, a, b] of cuts) {
      if (a > cursor + 0.05) out.push({ side, axis, fixed, a: cursor, b: a })
      cursor = Math.max(cursor, b)
    }
    if (to > cursor + 0.05) out.push({ side, axis, fixed, a: cursor, b: to })
  }
  return out
}

/** Rail round a rectangle at height `y`: solid kick plate + movement-only top, with gaps. */
function railColliders(x0, x1, z0, z1, y, gaps = []) {
  const out = []
  for (const { axis, fixed, a, b } of railRuns(x0, x1, z0, z1, gaps)) {
    const mid = (a + b) / 2
    const len = b - a
    const at = (yc) => (axis === 'x' ? [mid, yc, fixed] : [fixed, yc, mid])
    const size = (h) => (axis === 'x' ? [len, h, 0.08] : [0.08, h, len])
    out.push(boxC(at(y + 0.15), size(0.3)))
    out.push(boxC(at(y + 0.65), size(0.7), IDENTITY_Q, MOVE_ONLY))
  }
  return out
}

/** The refinery's wall boxes, shared with the renderer so the cuts match. */
export function refineryWallBoxes(r = REFINERY) {
  return r.walls.flatMap((w) => cutWall(w, r.hall.h, r.hall.wall).map((b) => ({ ...b, side: w.side, y0: b.p[1] - b.size[1] / 2 })))
}

/** Thin tilted wall along a ramp (conveyor side rails): movement-only by default. */
function rampSide(top, bottom, offset, height, group = MOVE_ONLY) {
  const lift = (p) => [p[0], p[1] + height / 2 + 0.05, p[2] + offset]
  const r = rampBox(lift(top), lift(bottom), 0.06, height)
  return boxC(r.p, r.size, r.q, group)
}

function refineryColliders(r) {
  const out = []
  const { deck, tower: tw, platform: pf, tank, conveyor: cv } = r
  for (const b of refineryWallBoxes(r)) out.push(boxC(b.p, b.size))
  // Deck over hall + bay, its rail, and the hall floor machine.
  out.push(boxC([0, deck - 0.1, 0], [10.2, 0.2, 8.2]))
  out.push(...railColliders(-5.1, 5.1, -4.1, 4.1, deck, r.deckGaps))
  out.push(boxC([-2.6, 0.75, 1.6], [2.2, 1.5, 1.3]))
  out.push(boxC([r.ibc[0], 0.55, r.ibc[1]], [1.1, 1.1, 1.1]))
  for (const [x, z, n] of r.tyres) out.push(cylC([x, n * 0.13, z], 0.45, n * 0.26))
  // Process tower, its roof rail.
  out.push(boxC([(tw.x0 + tw.x1) / 2, (deck + tw.top) / 2, (tw.z0 + tw.z1) / 2], [tw.x1 - tw.x0, tw.top - deck, tw.z1 - tw.z0]))
  out.push(...railColliders(tw.x0, tw.x1, tw.z0, tw.z1, tw.top, r.towerGaps))
  // Chimneys on the tower roof.
  out.push(cylC([tw.x0 + 0.7, tw.top + 1.6, tw.z0 + 0.7], 0.35, 3.2))
  out.push(cylC([tw.x0 + 1.6, tw.top + 1.3, tw.z0 + 0.6], 0.28, 2.6))
  // Tank platform: slab on columns, rail (open where it meets the tower), the tank.
  out.push(boxC([(pf.x0 + pf.x1) / 2, pf.top - 0.1, (pf.z0 + pf.z1) / 2], [pf.x1 - pf.x0, 0.2, pf.z1 - pf.z0]))
  for (const [x, z] of r.columns) out.push(boxC([x, (deck + pf.top - 0.2) / 2, z], [0.26, pf.top - 0.2 - deck, 0.26]))
  out.push(...railColliders(pf.x0, pf.x1, pf.z0, pf.z1, pf.top, [...r.platformGaps, ['west', tw.z0, tw.z1]]))
  out.push(cylC([tank.p[0], pf.top + tank.h / 2, tank.p[1]], tank.r, tank.h))
  // Conveyor: walkable belt deck, rails either side, two pairs of legs.
  const belt = rampBox(cv.top, cv.bottom, cv.width, 0.16)
  out.push(boxC(belt.p, belt.size, belt.q))
  for (const side of [-1, 1]) out.push(rampSide(cv.top, cv.bottom, side * (cv.width / 2 + 0.04), 0.9))
  const slope = (cv.top[1] - cv.bottom[1]) / (cv.top[0] - cv.bottom[0])
  for (const x of cv.legs) {
    const h = cv.bottom[1] + (x - cv.bottom[0]) * slope - 0.2
    for (const side of [-1, 1]) out.push(boxC([x, h / 2, cv.bottom[2] + side * (cv.width / 2 - 0.1)], [0.2, h, 0.2]))
  }
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
  const { pipes, racks, fallen, service } = pipelinePieces()
  const out = [...pipes, ...fallen, ...service].map((p) => segmentCyl(p.a, p.b, p.r))
  // The gate valve's body stands on top of the main: cover up on the pipe.
  out.push(boxC([PIPELINE.valveX, PIPELINE.height + PIPELINE.radius + 0.35, PIPELINE.z], [0.7, 0.7, 0.8]))
  // Flat strips along the crowns of the dropped length and the pipe itself, so
  // running up and along them doesn't slide you off the curve (movement only;
  // bullets still meet the pipe).
  for (const f of [...fallen.filter((p) => p.walk), ...pipes]) {
    const crown = (p) => [p[0], p[1] + f.r + 0.03, p[2]]
    const strip = rampBox(crown(f.a), crown(f.b), 1.4, 0.1)
    out.push(boxC(strip.p, strip.size, strip.q, MOVE_ONLY))
  }
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

function tankerColliders(e) {
  const at = (lx, lz) => yawOffset(e.p, lx, lz, e.rotY)
  const y = 2.05
  const a = at(0, -1.7)
  const b = at(0, 3.6)
  return [
    groundBox(at(0, -3.15), [2.3, 2.6, 1.9], e.rotY),
    groundBox(at(0, 0.6), [1.9, 0.95, 7.2], e.rotY),
    segmentCyl([a[0], y, a[2]], [b[0], y, b[2]], 1.08),
  ]
}

/** Three spare pipe lengths stacked on sleepers: two below, one on top. */
function pipeStackColliders(e) {
  const out = []
  for (const [lx, ly] of [[-0.52, 0.62], [0.52, 0.62], [0, 1.5]]) {
    const a = yawOffset(e.p, lx, -2.5, e.rotY)
    const b = yawOffset(e.p, lx, 2.5, e.rotY)
    out.push(segmentCyl([a[0], ly, a[2]], [b[0], ly, b[2]], 0.5))
  }
  return out
}

function carColliders(e) {
  const at = (lx, lz) => yawOffset(e.p, lx, lz, e.rotY)
  return [groundBox(e.p, [1.8, 0.95, 4.3], e.rotY), groundBox([at(0, 0.2)[0], 0.95, at(0, 0.2)[2]], [1.6, 0.5, 2.0], e.rotY)]
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
  const { walls, slabs, ramps, rubble, props, drifts } = ruinPieces(r)
  return [...walls, ...slabs, ...ramps, ...rubble, ...props, ...drifts].map((b) => boxC(b.p, b.size, b.q))
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
  refinery: refineryColliders,
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
  tanker: tankerColliders,
  car: carColliders,
  pipeStack: pipeStackColliders,
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
