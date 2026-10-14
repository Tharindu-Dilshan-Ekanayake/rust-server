/**
 * "Palmwood" — a tropical plywood shanty town, as data.
 *
 * A dirt track loops round the middle of town. Inside the loop: the Frame, an
 * unfinished two-storey plywood block whose open top floor (no roof yet, safety
 * mesh on the bays) is reached by stairs up its east and west sides, and a
 * deck under camo netting. Round the loop: the long house to the north, the
 * warehouse with its veranda to the east, the market stalls and the bunkhouse
 * to the south and the cookhouse to the west; tarp shacks, a tin shed, a hut,
 * two lookout towers in the corners, banana groves and coconut palms.
 * Team spawns: north (Alpha) and south (Bravo).
 *
 * Coordinates are metres. +X is east, -Z north, +Y up, ground y = 0. The arena
 * is 76 x 76 m. Like the other maps, everything is listed once as entities;
 * the client draws them and BOTH sides build their physics from
 * `buildPalmwoodColliders()`.
 */
import { TEAMS } from './constants.js'
import { CAR_MODELS } from './mapAcres.js'
import { boundaryColliders, boxC, cylC, groundBox, IDENTITY_Q, ladder, ladderIn, MOVE_ONLY, rampBox, wallPieces, yawOffset, yawQ } from './mapKit.js'

export const PALMWOOD_NAME = 'Palmwood'
export const PALMWOOD_HALF = 38

const entities = []
const add = (e) => {
  entities.push(e)
  return e
}

/* ---------------------------------------------------------------------------
 * Buildings
 *
 * Axis-aligned plywood (or tin) boxes. `x0..x1, z0..z1` are the outer faces of
 * the walls. Each floor has a base `y` and wall height `h`, and lists its wall
 * openings per side ('n' 's' 'w' 'e'), measured along the wall in world x
 * (north/south walls) or world z (west/east walls), with `bottom`/`top` above
 * the floor's base. An upper floor stands on a slab spanning the inside, its
 * walls on top of the walls below.
 *
 * Roofs: `gable` (ridge along `axis`), `shed` (one slope falling to `down`), or
 * none (the Frame's open top floor).
 * ------------------------------------------------------------------------- */

/** Wall, inner wall and slab thickness. */
export const PW_WALL_T = 0.15
export const PW_INNER_T = 0.1
export const PW_SLAB_T = 0.15
/** Corrugated roof sheet thickness, and how far a roof sits above the walls. */
export const PW_ROOF_T = 0.06
const ROOF_SEAT = 0.08

const door = (from, to, top = 2.15) => ({ from, to, bottom: 0, top, door: true })
const win = (from, to, bottom = 1.0, top = 2.0) => ({ from, to, bottom, top })
/** An open bay of an unfinished floor: a parapet below, nothing above. */
const bay = (from, to, bottom = 1.05) => ({ from, to, bottom, top: 99, bay: true })
/** A gap in a parapet where stairs arrive. */
const gap = (from, to) => ({ from, to, bottom: 0, top: 99, door: true, bay: true })

export const BUILDINGS = Object.freeze([
  {
    // The Frame: unfinished, two storeys, the top floor open to the sky.
    id: 'frame',
    x0: -7.5,
    x1: 2.5,
    z0: -4.5,
    z1: 3.5,
    look: { walls: 'plywood', band: 'blue', floor: 'concrete', mesh: true, marks: [['s', -2.2, 2.4, '2'], ['n', -2.6, 2.4, '1']] },
    floors: [
      {
        y: 0,
        h: 3.0,
        walls: {
          n: [door(-6.4, -5.2), win(-3.6, -1.6), door(0.0, 1.2)],
          s: [door(-6.0, -4.8), win(-3.2, -1.2), door(0.4, 1.6)],
          w: [win(-1.2, 0.6)],
          e: [],
        },
        inner: [{ axis: 'x', at: -0.4, from: -7.35, to: -1.6, openings: [door(-5.0, -3.8)] }],
      },
      {
        y: 3.0,
        h: 2.3,
        walls: {
          n: [bay(-6.6, -4.4), bay(-3.6, -0.8), bay(0.0, 1.8)],
          s: [bay(-6.6, -4.2), bay(-3.4, -0.6), bay(0.2, 1.6)],
          w: [gap(-4.3, -3.0), bay(-1.6, 2.6)],
          e: [bay(-3.6, -0.6), gap(2.0, 3.2)],
        },
      },
    ],
    slab: { y: 3.0 },
    roof: null,
    stairs: [
      // East side, climbing south to a landing at the bay in the top floor's east wall.
      { bottom: [3.15, 0, -4.2], top: [3.15, 3.0, 1.85], width: 1.2, landing: { x0: 2.5, x1: 3.75, z0: 1.85, z1: 3.6 }, open: 'e' },
      // West side, climbing north to the top floor's west gap.
      { bottom: [-8.15, 0, 3.25], top: [-8.15, 3.0, -2.85], width: 1.2, landing: { x0: -8.75, x1: -7.5, z0: -4.6, z1: -2.85 }, open: 'w' },
    ],
  },
  {
    // Long house: plywood with a yellow band, red and white tin roof.
    id: 'longhouse',
    x0: -12,
    x1: 6,
    z0: -28,
    z1: -21.5,
    look: { walls: 'plywood', band: 'yellow', floor: 'plank', tin: ['red', 'white', 'rust'], marks: [['s', -5.5, 2.4, 'A']] },
    floors: [
      {
        y: 0,
        h: 2.8,
        walls: {
          s: [door(-9.6, -8.4), win(-6.8, -4.6), door(-2.2, -1.0), win(1.0, 3.0), door(4.0, 5.2)],
          n: [door(-8.4, -7.2), win(-4.8, -2.8), door(1.2, 2.4)],
          w: [door(-25.4, -24.2)],
          e: [win(-25.8, -23.8)],
        },
        inner: [{ axis: 'z', at: -3.5, from: -27.85, to: -21.65, openings: [door(-25.4, -24.2)] }],
      },
    ],
    roof: { type: 'gable', axis: 'x', ridge: 4.5, overhang: 0.5 },
  },
  {
    // Warehouse: tin walls, rusty roof, a veranda along the road.
    id: 'warehouse',
    x0: 23,
    x1: 31,
    z0: -13,
    z1: 9,
    look: { walls: 'tin', wallTint: 'teal', floor: 'concrete', tin: ['rust', 'brown', 'rust'], marks: [['w', -4.6, 2.6, '3']] },
    floors: [
      {
        y: 0,
        h: 3.2,
        walls: {
          w: [door(-10.4, -8.8), win(-6.4, -3.8), door(-1.6, 0.2), win(2.6, 5.0), door(6.0, 7.2)],
          e: [door(-4.4, -3.2), door(3.0, 4.2)],
          n: [door(26.4, 27.6)],
          s: [door(25.0, 26.2), win(28.2, 29.8)],
        },
        inner: [{ axis: 'x', at: -2.0, from: 23.15, to: 28.0, openings: [door(24.6, 25.8)] }],
      },
    ],
    roof: { type: 'gable', axis: 'z', ridge: 5.3, overhang: 0.5 },
    veranda: { side: 'w', from: -11.2, to: 7.4, depth: 2.4, high: 3.05, low: 2.6, posts: [-11.0, -6.6, -2.2, 2.6, 7.2] },
  },
  {
    // Cookhouse: pink-painted plywood under a blue tarp roof.
    id: 'cookhouse',
    x0: -32,
    x1: -24,
    z0: -6,
    z1: 4,
    look: { walls: 'painted', paint: 'pink', floor: 'plank', tarp: true },
    floors: [
      {
        y: 0,
        h: 2.6,
        walls: {
          e: [door(-4.4, -3.2), win(-1.6, 0.6), door(2.0, 3.2)],
          w: [door(-0.6, 0.6)],
          n: [win(-29.8, -27.8)],
          s: [door(-29.0, -27.8), win(-26.6, -25.0)],
        },
        inner: [{ axis: 'z', at: -28, from: -5.85, to: 3.85, openings: [door(-1.4, -0.2)] }],
      },
    ],
    roof: { type: 'shed', down: 'w', rise: 0.7, overhang: 0.5 },
  },
  {
    // Tarp shack in the north-west yard.
    id: 'tarpshack',
    x0: -30,
    x1: -23,
    z0: -27,
    z1: -21,
    look: { walls: 'plywood', floor: 'plank', tarp: true },
    floors: [
      {
        y: 0,
        h: 2.5,
        walls: {
          e: [door(-24.8, -23.6)],
          s: [door(-29.6, -28.5), win(-25.8, -24.4)],
          w: [win(-25.4, -23.6)],
          n: [],
        },
      },
    ],
    roof: { type: 'shed', down: 'n', rise: 0.6, overhang: 0.45 },
  },
  {
    // Tin shed in the north-east corner: the first resupply crate.
    id: 'tinshed',
    x0: 23,
    x1: 29,
    z0: -31,
    z1: -26,
    look: { walls: 'tin', wallTint: 'rust', floor: 'concrete', tin: ['white', 'rust'] },
    floors: [
      {
        y: 0,
        h: 2.5,
        walls: {
          s: [door(24.4, 25.8)],
          w: [door(-29.6, -28.4)],
          e: [win(-29.2, -27.8, 1.1, 1.9)],
          n: [],
        },
      },
    ],
    roof: { type: 'shed', down: 'e', rise: 0.55, overhang: 0.4 },
  },
  {
    // Hut in the south-west corner: the other resupply crate.
    id: 'hut',
    x0: -31,
    x1: -26,
    z0: 24,
    z1: 29,
    look: { walls: 'plywood', floor: 'plank', tin: ['teal', 'rust'] },
    floors: [
      {
        y: 0,
        h: 2.5,
        walls: {
          n: [door(-29.8, -28.6)],
          e: [door(25.2, 26.4)],
          w: [win(25.6, 27.4, 1.1, 1.9)],
          s: [],
        },
      },
    ],
    roof: { type: 'shed', down: 'w', rise: 0.55, overhang: 0.4 },
  },
  {
    // Bunkhouse south of the loop: plywood, blue band, teal roof.
    id: 'bunkhouse',
    x0: 6,
    x1: 18,
    z0: 22,
    z1: 28,
    look: { walls: 'plywood', band: 'blue', floor: 'plank', tin: ['teal', 'white', 'teal'], marks: [['n', 11.8, 2.3, 'B']] },
    floors: [
      {
        y: 0,
        h: 2.8,
        walls: {
          n: [door(7.2, 8.4), win(9.4, 11.0), win(13.0, 14.6), door(15.6, 16.8)],
          s: [door(13.0, 14.2), win(15.4, 17.2)],
          e: [door(24.4, 25.6)],
          w: [win(23.6, 25.6)],
        },
        inner: [{ axis: 'z', at: 12, from: 22.15, to: 27.85, openings: [door(24.4, 25.6)] }],
      },
    ],
    roof: { type: 'gable', axis: 'x', ridge: 4.4, overhang: 0.5 },
  },
  ...[
    ['stallA', -15, -11, 'orange'],
    ['stallB', -9, -5, 'green'],
    ['stallC', -3, 1, 'red'],
  ].map(([id, x0, x1, awning]) => ({
    // Market stalls: a counter along the front, a way in at its east end.
    id,
    x0,
    x1,
    z0: 21,
    z1: 24.2,
    look: { walls: 'plywood', floor: null, tin: ['rust', 'white'], awning },
    floors: [
      {
        y: 0,
        h: 2.5,
        walls: {
          n: [win(x0 + 0.3, x1 - 1.3, 1.0, 2.5), door(x1 - 1.05, x1 - 0.2, 2.5)],
          s: [],
          w: [],
          e: [],
        },
      },
    ],
    roof: { type: 'shed', down: 's', rise: 0.5, overhang: 0.35 },
  })),
])
for (const b of BUILDINGS) add({ type: 'building', id: b.id })

const buildingById = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]))
export const buildingOf = (id) => buildingById[id]

/** Top of a building's highest walls. */
export const eaveOfBuilding = (b) => {
  const f = b.floors[b.floors.length - 1]
  return f.y + f.h
}

/** Floor-level wall runs of a building: the four sides, then inner walls. */
function wallRuns(b, f) {
  const t = PW_WALL_T
  const walls = f.walls ?? {}
  const runs = [
    { side: 'n', axis: 'x', fixed: b.z0 + t / 2, from: b.x0, to: b.x1, t, openings: walls.n ?? [] },
    { side: 's', axis: 'x', fixed: b.z1 - t / 2, from: b.x0, to: b.x1, t, openings: walls.s ?? [] },
    { side: 'w', axis: 'z', fixed: b.x0 + t / 2, from: b.z0 + t, to: b.z1 - t, t, openings: walls.w ?? [] },
    { side: 'e', axis: 'z', fixed: b.x1 - t / 2, from: b.z0 + t, to: b.z1 - t, t, openings: walls.e ?? [] },
  ]
  for (const w of f.inner ?? []) {
    runs.push({ side: 'inner', axis: w.axis, fixed: w.at, from: w.from, to: w.to, t: PW_INNER_T, openings: w.openings ?? [] })
  }
  return runs
}

/**
 * Every wall piece of a building in world space: { p, size, floor, side, axis,
 * y0, y1 }. Shared by the colliders and the renderer so the holes line up.
 * Inner walls under an upper floor stop at the slab.
 */
const wallCache = new Map()
export function buildingWallBoxes(b) {
  if (wallCache.has(b.id)) return wallCache.get(b.id)
  const out = []
  b.floors.forEach((f, fi) => {
    for (const run of wallRuns(b, f)) {
      const height = run.side === 'inner' && b.slab && fi === 0 ? b.slab.y - PW_SLAB_T : f.h
      for (const piece of wallPieces(run.from, run.to, height, run.openings)) {
        const len = piece.b - piece.a
        const hh = piece.y1 - piece.y0
        if (len < 0.01 || hh < 0.01) continue
        const mid = (piece.a + piece.b) / 2
        const y = f.y + piece.y0 + hh / 2
        out.push({
          floor: fi,
          side: run.side,
          axis: run.axis,
          p: run.axis === 'x' ? [mid, y, run.fixed] : [run.fixed, y, mid],
          size: run.axis === 'x' ? [len, hh, run.t] : [run.t, hh, len],
          y0: f.y + piece.y0,
          y1: f.y + piece.y1,
        })
      }
    }
  })
  wallCache.set(b.id, out)
  return out
}

/** Doors, windows and bays of a building in world space, for frames and sills. */
export function buildingOpenings(b) {
  const out = []
  b.floors.forEach((f, fi) => {
    for (const run of wallRuns(b, f)) {
      for (const o of run.openings) {
        const mid = (o.from + o.to) / 2
        out.push({
          floor: fi,
          side: run.side,
          axis: run.axis,
          door: Boolean(o.door),
          bay: Boolean(o.bay),
          width: o.to - o.from,
          y0: f.y + o.bottom,
          y1: f.y + Math.min(o.top, f.h),
          t: run.t,
          at: run.axis === 'x' ? [mid, run.fixed] : [run.fixed, mid],
        })
      }
    }
  })
  return out
}

/**
 * A roof as sheets (tilted slabs, from rampBox) plus the infill between the
 * walls and the roof (gable triangles, the high side of a shed roof):
 * { sheets: [{ p, size, q, ... }], gables: [{ side, axis, at, from, to, y0, y1, peak }],
 *   knees: [{ side, p, size }] }.
 */
export function roofOf(b) {
  const r = b.roof
  if (!r) return null
  const eave = eaveOfBuilding(b)
  const o = r.overhang
  const cx = (b.x0 + b.x1) / 2
  const cz = (b.z0 + b.z1) / 2
  const base = eave + ROOF_SEAT
  if (r.type === 'gable') {
    const alongX = r.axis === 'x'
    const half = alongX ? (b.z1 - b.z0) / 2 : (b.x1 - b.x0) / 2
    const slope = (r.ridge - base) / half
    const low = base - slope * o
    const width = (alongX ? b.x1 - b.x0 : b.z1 - b.z0) + o * 2
    const sheets = [-1, 1].map((s) => {
      const bottom = alongX ? [cx, low, cz + s * (half + o)] : [cx + s * (half + o), low, cz]
      return { ...rampBox([cx, r.ridge, cz], bottom, width, PW_ROOF_T), side: s }
    })
    // The triangles at both ends, from the wall tops up under the sheets.
    const gables = (alongX ? [['w', b.x0], ['e', b.x1]] : [['n', b.z0], ['s', b.z1]]).map(([side, at]) => ({
      side,
      axis: alongX ? 'z' : 'x',
      at,
      from: alongX ? b.z0 : b.x0,
      to: alongX ? b.z1 : b.x1,
      y0: eave,
      y1: r.ridge - PW_ROOF_T - 0.02,
    }))
    return { type: 'gable', sheets, gables, knees: [], eave, ridge: r.ridge, axis: r.axis }
  }
  // Shed roof: high over the wall opposite `down`, low over `down`.
  const high = eave + r.rise
  const low = base
  const dir = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[r.down]
  const alongX = dir[0] === 0
  const depth = alongX ? b.z1 - b.z0 : b.x1 - b.x0
  const k = (high - low) / depth
  const width = (alongX ? b.x1 - b.x0 : b.z1 - b.z0) + o * 2
  const hd = depth / 2 + o
  const top = alongX ? [cx, high + k * o, cz - dir[1] * hd] : [cx - dir[0] * hd, high + k * o, cz]
  const bottom = alongX ? [cx, low - k * o, cz + dir[1] * hd] : [cx + dir[0] * hd, low - k * o, cz]
  const sheet = { ...rampBox(top, bottom, width, PW_ROOF_T), side: 1 }
  // The wall under the high edge goes on up to the roof; the side walls get triangles.
  const t = PW_WALL_T
  const kneeH = high - PW_ROOF_T - 0.02 - eave
  const highSide = { n: 's', s: 'n', w: 'e', e: 'w' }[r.down]
  const knee = (() => {
    const y = eave + kneeH / 2
    if (highSide === 'n') return { side: 'n', p: [cx, y, b.z0 + t / 2], size: [b.x1 - b.x0, kneeH, t] }
    if (highSide === 's') return { side: 's', p: [cx, y, b.z1 - t / 2], size: [b.x1 - b.x0, kneeH, t] }
    if (highSide === 'w') return { side: 'w', p: [b.x0 + t / 2, y, cz], size: [t, kneeH, b.z1 - b.z0] }
    return { side: 'e', p: [b.x1 - t / 2, y, cz], size: [t, kneeH, b.z1 - b.z0] }
  })()
  const sides = alongX ? [['w', b.x0], ['e', b.x1]] : [['n', b.z0], ['s', b.z1]]
  const gables = sides.map(([side, at]) => ({
    side,
    axis: alongX ? 'z' : 'x',
    at,
    from: alongX ? b.z0 : b.x0,
    to: alongX ? b.z1 : b.x1,
    y0: eave,
    y1: eave + kneeH,
    // Which end is high: the start (from) or the end (to) of the run.
    highAt: (alongX ? highSide === 'n' : highSide === 'w') ? 'from' : 'to',
  }))
  return { type: 'shed', sheets: [sheet], gables, knees: [knee], eave, high, low, down: r.down }
}

/** Stair flights as sloped slabs, with what's under them and their rails. */
export function stairPieces(st) {
  const ramp = rampBox(st.top, st.bottom, st.width, 0.14)
  const dx = st.top[0] - st.bottom[0]
  const dz = st.top[2] - st.bottom[2]
  const run = Math.hypot(dx, dz)
  const ux = dx / run
  const uz = dz / run
  // Solid under the flight, in steps that stay just under the treads.
  const fill = []
  const n = 5
  for (let k = 1; k < n; k++) {
    const h = (st.top[1] * k) / n - 0.22
    if (h < 0.25) continue
    const a = k / n
    const len = run * (1 - a)
    const mid = [st.bottom[0] + ux * run * (a + (1 - a) / 2), st.bottom[2] + uz * run * (a + (1 - a) / 2)]
    fill.push({ p: [mid[0], h / 2, mid[1]], size: Math.abs(ux) > 0.5 ? [len - 0.02, h, st.width - 0.04] : [st.width - 0.04, h, len - 0.02], h })
  }
  // The rail on the open side, following the slope.
  const side = st.open === 'e' ? [1, 0] : st.open === 'w' ? [-1, 0] : st.open === 's' ? [0, 1] : [0, -1]
  const off = st.width / 2 - 0.04
  const lift = (p, y) => [p[0] + side[0] * off, p[1] + y, p[2] + side[1] * off]
  const rail = rampBox(lift(st.top, 1.0), lift(st.bottom, 1.0), 0.06, 1.0)
  const L = st.landing
  return { ramp, fill, rail, landing: { ...L, y: st.top[1] }, side }
}

/** Rails round a landing: every edge except the building side and where the flight arrives. */
export function landingRails(st) {
  const L = st.landing
  const y = st.top[1]
  const out = []
  // The flight arrives on the landing's edge nearest the stair bottom.
  const fromNorth = st.bottom[2] < L.z0
  const fromSouth = st.bottom[2] > L.z1
  const buildingWest = st.open === 'e'
  // Outer long edge (away from the building).
  const outerX = buildingWest ? L.x1 - 0.04 : L.x0 + 0.04
  out.push({ a: [outerX, L.z0], b: [outerX, L.z1], y })
  // The far end (opposite the arriving flight).
  if (fromNorth) out.push({ a: [L.x0, L.z1 - 0.04], b: [L.x1, L.z1 - 0.04], y })
  if (fromSouth) out.push({ a: [L.x0, L.z0 + 0.04], b: [L.x1, L.z0 + 0.04], y })
  return out
}

export function buildingColliders(b) {
  const out = buildingWallBoxes(b).map((w) => boxC(w.p, w.size))
  const t = PW_WALL_T
  if (b.slab) {
    const y = b.slab.y
    out.push(boxC([(b.x0 + b.x1) / 2, y - PW_SLAB_T / 2, (b.z0 + b.z1) / 2], [b.x1 - b.x0 - t * 2, PW_SLAB_T, b.z1 - b.z0 - t * 2]))
  }
  const roof = roofOf(b)
  if (roof) {
    for (const s of roof.sheets) out.push(boxC(s.p, s.size, s.q))
    for (const k of roof.knees) out.push(boxC(k.p, k.size))
    // Infill triangles as a block over their lower half (bullets and grenades stop there).
    for (const g of roof.gables) {
      const h = (g.y1 - g.y0) * 0.55
      const span = g.to - g.from
      const mid = roof.type === 'gable' ? (g.from + g.to) / 2 : g.highAt === 'from' ? g.from + span * 0.3 : g.to - span * 0.3
      const len = roof.type === 'gable' ? span * 0.6 : span * 0.6
      const inset = g.side === 'n' || g.side === 'w' ? t / 2 : -t / 2
      const p = g.axis === 'x' ? [mid, g.y0 + h / 2, g.at + inset] : [g.at + inset, g.y0 + h / 2, mid]
      out.push(boxC(p, g.axis === 'x' ? [len, h, t] : [t, h, len]))
    }
  }
  for (const st of b.stairs ?? []) {
    const s = stairPieces(st)
    out.push(boxC(s.ramp.p, s.ramp.size, s.ramp.q))
    for (const f of s.fill) out.push(boxC(f.p, f.size))
    out.push(boxC(s.rail.p, s.rail.size, s.rail.q, MOVE_ONLY))
    const L = s.landing
    out.push(boxC([(L.x0 + L.x1) / 2, L.y - 0.075, (L.z0 + L.z1) / 2], [L.x1 - L.x0, 0.15, L.z1 - L.z0]))
    // Posts under the landing's outer corners.
    const ox = st.open === 'e' ? L.x1 - 0.08 : L.x0 + 0.08
    for (const z of [L.z0 + 0.08, L.z1 - 0.08]) out.push(boxC([ox, (L.y - 0.15) / 2, z], [0.12, L.y - 0.15, 0.12]))
    for (const r of landingRails(st)) out.push(lineBox(r.a, r.b, 1.0, 0.06, r.y, MOVE_ONLY))
  }
  if (b.veranda) {
    const v = b.veranda
    const x = v.side === 'w' ? b.x0 - v.depth : b.x1 + v.depth
    const r = rampBox([v.side === 'w' ? b.x0 : b.x1, v.high, (v.from + v.to) / 2], [x, v.low, (v.from + v.to) / 2], v.to - v.from, PW_ROOF_T)
    out.push(boxC(r.p, r.size, r.q))
    for (const z of v.posts) out.push(boxC([x + (v.side === 'w' ? 0.1 : -0.1), (v.low - 0.1) / 2, z], [0.14, v.low - 0.1, 0.14]))
  }
  return out
}

/* ---------------------------------------------------------------------------
 * The loop and the tracks off it (ground only: the renderer draws them)
 * ------------------------------------------------------------------------- */

/** The dirt loop round the middle of town: a rounded rectangle (centre line), and its width. */
export const LOOP = Object.freeze({ ax: 17, az: 13.5, r: 8, width: 5 })
/** Tracks off the loop: polylines [[x, z], ...] and widths. */
export const TRACKS = Object.freeze([
  { width: 3.6, points: [[-18.5, 7.5], [-26, 8.6], [-32, 8.2], [-39, 8.0]] },
  { width: 3.4, points: [[3.6, 15.6], [3.4, 24], [2.6, 31], [2.2, 39]] },
  { width: 3.4, points: [[18.8, 12.2], [26, 12.8], [32, 12.6], [39, 13.0]] },
])
add({ type: 'pwGround' })

/** Points along the loop's centre line (closed), `step` metres apart. */
export function loopPath(step = 1) {
  const { ax, az, r } = LOOP
  const pts = []
  const cxs = ax - r
  const czs = az - r
  // Corners (centre, start angle) going clockwise in the x/z plane, from the north-east.
  const corners = [
    [cxs, -czs, -Math.PI / 2],
    [cxs, czs, 0],
    [-cxs, czs, Math.PI / 2],
    [-cxs, -czs, Math.PI],
  ]
  for (let i = 0; i < 4; i++) {
    const [ccx, ccz, a0] = corners[i]
    const arc = (Math.PI / 2) * r
    const nArc = Math.max(2, Math.ceil(arc / step))
    for (let k = 0; k < nArc; k++) {
      const a = a0 + (k / nArc) * (Math.PI / 2)
      pts.push([ccx + Math.cos(a) * r, ccz + Math.sin(a) * r])
    }
    // Straight to the next corner.
    const [nx, nz, na] = corners[(i + 1) % 4]
    const from = [ccx + Math.cos(a0 + Math.PI / 2) * r, ccz + Math.sin(a0 + Math.PI / 2) * r]
    const to = [nx + Math.cos(na) * r, nz + Math.sin(na) * r]
    const len = Math.hypot(to[0] - from[0], to[1] - from[1])
    const nLine = Math.max(1, Math.ceil(len / step))
    for (let k = 0; k < nLine; k++) pts.push([from[0] + ((to[0] - from[0]) * k) / nLine, from[1] + ((to[1] - from[1]) * k) / nLine])
  }
  return pts
}

/* ---------------------------------------------------------------------------
 * Raised things: the camo deck, two lookout towers, the water tank
 * ------------------------------------------------------------------------- */

/** Plank deck under a camo net, in the loop beside the Frame. */
export const DECK = Object.freeze({ x0: 6.5, x1: 12.5, z0: -3.5, z1: 2.5, y: 0.3, net: 2.65 })
add({ type: 'deck', ...DECK })

/** Lookout towers: a platform on four posts, a parapet and a tin roof, a ladder up one face. */
export const TOWERS = Object.freeze([
  { id: 'nw', p: [-31, 0, -33], half: 1.7, deck: 5.0, roof: 7.5, ladder: 's' },
  { id: 'se', p: [31, 0, 33], half: 1.7, deck: 5.0, roof: 7.5, ladder: 'n' },
])
for (const t of TOWERS) add({ type: 'tower', id: t.id })
export const towerOf = (id) => TOWERS.find((t) => t.id === id)

const LADDER_DIR = { s: [0, 0, -1], n: [0, 0, 1], e: [-1, 0, 0], w: [1, 0, 0] }
/** Where a tower's ladder stands: just off the middle of the `ladder` face. */
function towerLadderFoot(t) {
  const [cx, , cz] = t.p
  const off = t.half + 0.05
  return { s: [cx, cz + off], n: [cx, cz - off], e: [cx + off, cz], w: [cx - off, cz] }[t.ladder]
}

export const PW_LADDERS = Object.freeze(TOWERS.map((t) => ladder(towerLadderFoot(t), LADDER_DIR[t.ladder], t.deck, [0.3, 0.32])))
for (const l of PW_LADDERS) add({ type: 'ladder', foot: l.foot, dir: l.exitDir, topY: l.topY, base: l.base, rungs: l.rungs })

/** A tower's parapet as runs: [{ axis, fixed, a, b }] round the deck, open where the ladder arrives. */
export function towerParapet(t) {
  const [cx, , cz] = t.p
  const e = t.half - 0.05
  const runs = [
    { side: 'n', axis: 'x', fixed: cz - e, a: cx - t.half, b: cx + t.half },
    { side: 's', axis: 'x', fixed: cz + e, a: cx - t.half, b: cx + t.half },
    { side: 'w', axis: 'z', fixed: cx - e, a: cz - e + 0.05, b: cz + e - 0.05 },
    { side: 'e', axis: 'z', fixed: cx + e, a: cz - e + 0.05, b: cz + e - 0.05 },
  ]
  const out = []
  for (const r of runs) {
    if (r.side === t.ladder) {
      const c = r.axis === 'x' ? cx : cz
      out.push({ ...r, b: c - 0.5 }, { ...r, a: c + 0.5 })
    } else out.push(r)
  }
  return out
}

function towerColliders(t) {
  const [cx, , cz] = t.p
  const h = t.half
  const out = []
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(boxC([cx + sx * (h - 0.1), t.roof / 2, cz + sz * (h - 0.1)], [0.2, t.roof, 0.2]))
  out.push(boxC([cx, t.deck - 0.08, cz], [h * 2, 0.16, h * 2]))
  for (const r of towerParapet(t)) {
    const len = r.b - r.a
    const mid = (r.a + r.b) / 2
    out.push(boxC(r.axis === 'x' ? [mid, t.deck + 0.5, r.fixed] : [r.fixed, t.deck + 0.5, mid], r.axis === 'x' ? [len, 1.0, 0.08] : [0.08, 1.0, len]))
  }
  out.push(boxC([cx, t.roof + 0.04, cz], [h * 2 + 0.8, PW_ROOF_T, h * 2 + 0.8]))
  return out
}

/** Water tank on a timber stand, south-west. */
export const TANK_STAND = Object.freeze({ p: [-21.5, 0, 31.5], half: 1.25, deck: 2.2, r: 1.0, h: 1.5 })
add({ type: 'tankStand', ...TANK_STAND })

function tankStandColliders(s) {
  const [cx, , cz] = s.p
  const out = []
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(boxC([cx + sx * (s.half - 0.08), s.deck / 2, cz + sz * (s.half - 0.08)], [0.16, s.deck, 0.16]))
  out.push(boxC([cx, s.deck - 0.07, cz], [s.half * 2, 0.14, s.half * 2]))
  out.push(cylC([cx, s.deck + s.h / 2, cz], s.r, s.h))
  return out
}

/* ---------------------------------------------------------------------------
 * Vehicles and the boat
 * ------------------------------------------------------------------------- */

add({ type: 'car', model: 'pickup', color: '#dcdad2', p: [14.5, 0, 11.3], rotY: -0.78 })
add({ type: 'jeep', p: [-16.8, 0, -19.6], rotY: 0.42 })
add({ type: 'boat', p: [-30.5, 0, 12.4], rotY: 0.35 })

/** Old fishing boat on blocks: [length, beam, keel height (top of the blocks), gunwale height]. */
export const BOAT = Object.freeze({ length: 6.4, beam: 2.0, keel: 0.35, top: 1.45 })

/* ---------------------------------------------------------------------------
 * Fences
 * ------------------------------------------------------------------------- */

/** Plywood sheet fences: [ax, az, bx, bz, h]. */
export const PLY_FENCES = Object.freeze([
  [-38, -18, -33.4, -18, 2.0],
  [33.4, -17, 38, -17, 2.0],
  [-38, 19, -34.2, 19, 2.0],
  [34.2, 20, 38, 20, 2.0],
  // Breaking the long views down the west and east of the loop.
  [-21.2, 15.8, -21.2, 20.8, 2.0],
  [21.6, -20.6, 21.6, -15.4, 2.0],
])
for (const f of PLY_FENCES) add({ type: 'plyFence', a: [f[0], f[1]], b: [f[2], f[3]], h: f[4] })

/** Corrugated tin fences: [ax, az, bx, bz, h]. */
export const TIN_FENCES = Object.freeze([
  [-14.6, -33.2, -14.6, -29.4, 2.2],
  [10.6, -33.2, 10.6, -29.4, 2.2],
  [-12.2, 30.4, -12.2, 34.2, 2.2],
  [14.6, 30.4, 14.6, 34.2, 2.2],
  [33.4, -4.4, 33.4, 1.4, 2.2],
  [-35.4, -13.2, -35.4, -9.2, 2.2],
])
for (const f of TIN_FENCES) add({ type: 'tinFence', a: [f[0], f[1]], b: [f[2], f[3]], h: f[4] })

/* ---------------------------------------------------------------------------
 * Cover and clutter
 * ------------------------------------------------------------------------- */

/** Sandbag walls: [ax, az, bx, bz, layers]. */
export const SANDBAGS = Object.freeze([
  [-12.6, -8.2, -9.4, -7.4, 5],
  [-2.6, -9.2, 0.6, -9.2, 5],
  [6.8, -7.6, 9.8, -8.6, 5],
  [-11.8, 7.4, -9.0, 8.6, 5],
  [-1.6, 8.2, 1.6, 8.2, 5],
  [9.2, 6.8, 11.8, 5.4, 5],
  [7.2, -3.25, 10.6, -3.25, 3, 0.3],
  [-22.6, -16.6, -20.0, -15.2, 5],
  [20.6, 17.8, 23.2, 16.6, 5],
  [-6.2, -33.6, -3.0, -33.6, 4],
  [2.8, 33.6, 6.0, 33.6, 4],
])
for (const [ax, az, bx, bz, layers, y = 0] of SANDBAGS) add({ type: 'sandbags', a: [ax, az], b: [bx, bz], layers, y })

/** Crates: [x, z, w, h, d, rotY, y]. */
const crates = [
  [10.8, 0.4, 1.0, 1.0, 1.0, 0.2, 0.3],
  [8.4, 1.2, 1.2, 0.8, 0.9, -0.1, 0.3],
  [4.6, 7.4, 1.2, 1.2, 1.2, 0.15],
  [4.8, 8.6, 0.9, 0.9, 0.9, -0.3, 0],
  [-13.0, -1.6, 1.1, 1.0, 1.1, 0.4],
  [12.4, -8.6, 1.2, 1.1, 1.2, 0.1],
  [-3.8, -12.6, 1.0, 1.0, 1.0, 0.3],
  [-30.4, -19.6, 1.0, 0.9, 1.0, 0.1],
  [35.0, -6.8, 1.2, 1.2, 1.2, 0.25],
  [-34.6, 2.4, 1.1, 1.0, 1.1, -0.2],
  [-24.0, 20.4, 1.2, 1.1, 1.2, 0.35],
  [24.4, 19.6, 1.0, 1.0, 1.0, -0.4],
  [-31.0, -33.0, 1.0, 1.0, 1.0, 0.3],
  [31.0, 33.0, 1.0, 1.0, 1.0, -0.2],
  [18.6, -24.2, 1.2, 1.0, 1.2, 0.2],
  [-17.6, 26.8, 1.1, 1.1, 1.1, -0.3],
  // Stacked two high in the gaps either side of the Frame (they break the long diagonals between the spawns).
  [5.85, 0.2, 1.1, 1.1, 1.1, 0.1],
  [5.9, 0.2, 0.9, 0.85, 0.9, 0.4, 1.1],
  [-10.0, -0.8, 1.1, 1.1, 1.1, -0.2],
  [-10.0, -0.8, 0.9, 0.85, 0.9, 0.3, 1.1],
]
export const CRATES = Object.freeze(crates.map(([x, z, w, h, d, rotY, y = 0]) => ({ p: [x, y, z], size: [w, h, d], rotY })))
for (const c of CRATES) add({ type: 'crate', ...c })

/** Barrel stacks: blue drums splashed with paint on pallets, two high ('stack'), or rusty drums ('drums'). */
const barrels = [
  ['stack', -12.2, 2.6, 0.3],
  ['stack', 16.6, -20.4, -0.2],
  ['stack', -18.4, 21.8, 0.5],
  ['drums', 12.6, 4.2, 0],
  ['drums', -26.6, -14.2, 0.6],
  ['drums', 33.6, 8.6, 1.1],
  ['drums', -8.2, 17.6, 0.2],
  ['drums', 21.4, -27.6, 0.4],
]
export const BARRELS = Object.freeze(barrels.map(([kind, x, z, rotY]) => ({ kind, p: [x, 0, z], rotY })))
for (const b of BARRELS) add({ type: 'barrels', ...b })

add({ type: 'generator', p: [-12.4, 0, 5.4], rotY: 1.2 })
add({ type: 'generator', p: [21.8, 0, 2.0], rotY: -Math.PI / 2 })
add({ type: 'logs', p: [-26.4, 0, -19.4], rotY: 0 })
add({ type: 'logs', p: [26.4, 0, 16.8], rotY: 0.5 })
add({ type: 'pallets', p: [-4.4, 0, 6.6], rotY: 0.3 })
add({ type: 'pallets', p: [-15.8, 0, -24.6], rotY: -0.2 })
add({ type: 'pallets', p: [29.6, 0, -18.6], rotY: 0.7 })
add({ type: 'boom', p: [-36.2, 0, 10.2], rotY: Math.PI / 2, length: 4.2 })
add({ type: 'boom', p: [36.2, 0, 14.9], rotY: Math.PI / 2, length: 4.2 })
add({ type: 'campfire', p: [-20.6, 0, -2.4], rotY: 0, smoke: [0, 0.4, 0] })
add({ type: 'washline', a: [-29.6, -15.8], b: [-24.4, -14.4] })
add({ type: 'washline', a: [8.4, 30.4], b: [13.8, 30.8] })

/** Camo net lean-to beside the tarp shack, over a log pile. */
export const LEANTO = Object.freeze({ x0: -30, x1: -25, z0: -21, z1: -18.4, high: 2.5, low: 2.15 })
add({ type: 'leanTo', ...LEANTO })

export const PW_AMMO = Object.freeze([
  { p: [27.6, 0, -29.8], radius: 1.7, cooldown: 20, rotY: Math.PI / 2 },
  { p: [-29.4, 0, 27.6], radius: 1.7, cooldown: 20, rotY: 0 },
])
for (const a of PW_AMMO) add({ type: 'ammoCrate', p: a.p, size: [1.0, 0.6, 0.6], rotY: a.rotY })

/* ---------------------------------------------------------------------------
 * Trees: banana plants (kehel) and coconut palms
 * ------------------------------------------------------------------------- */

/** Banana plants: [x, z, size]. */
const bananas = [
  // In the loop.
  [-13.4, -5.6, 1.0], [-12.4, 8.8, 0.9], [13.4, 7.6, 1.0], [13.6, -6.2, 0.9], [-0.6, -10.6, 0.8],
  // Groves round the edges.
  [-34.6, 16.4, 1.1], [-36.0, 13.6, 0.9], [-33.2, 21.8, 1.0], [-36.4, 23.6, 1.1], [-35.4, 33.6, 1.0],
  [33.8, -21.6, 1.1], [36.2, -24.4, 0.9], [34.6, -27.8, 1.0], [36.0, -32.6, 1.1],
  [-20.4, -30.4, 1.0], [-17.6, -35.6, 0.9], [19.6, 31.6, 1.0], [23.4, 35.4, 0.9],
  [-36.2, -4.0, 1.0], [36.4, 3.6, 1.0], [-10.6, 31.8, 0.9], [8.6, -35.8, 0.9],
  [-22.4, 10.8, 0.85],
]
export const BANANAS = Object.freeze(bananas.map(([x, z, s]) => ({ p: [x, 0, z], s })))
for (const b of BANANAS) add({ type: 'banana', ...b })

/** Coconut palms: [x, z, height, lean]. */
const palms = [
  [-36.2, -36.0, 9.5, 0.25], [-24.6, -36.4, 8.0, 0.35], [-2.4, -36.6, 10.0, 0.2], [16.4, -36.2, 8.5, 0.4], [34.6, -35.6, 9.0, 0.3],
  [36.4, -12.0, 8.6, 0.3], [36.0, 24.6, 9.4, 0.35], [26.4, 36.4, 8.2, 0.25], [-0.8, 36.6, 9.6, 0.3], [-26.6, 36.2, 8.8, 0.4],
  [-36.6, 28.4, 9.2, 0.3], [-36.4, -26.4, 8.4, 0.35], [-20.2, -19.0, 7.4, 0.45], [19.8, 19.4, 7.8, 0.4], [-19.6, 18.4, 7.2, 0.4],
  [20.4, -18.8, 7.6, 0.35],
]
export const PALMS = Object.freeze(palms.map(([x, z, h, lean]) => ({ p: [x, 0, z], h, lean })))
for (const p of PALMS) add({ type: 'palm', ...p })

/** Leafy bushes (soft: no collider), and scattered grass tufts. */
const bushes = [
  [-12.6, -9.0], [12.4, 8.6], [-5.6, 10.0], [6.2, -10.2], [-18.6, -12.4], [18.4, 13.8], [-21.0, 4.4], [20.6, -14.4],
  [-27.4, 6.0], [27.0, -16.4], [-8.6, -30.2], [7.8, 30.0], [-33.6, -21.8], [31.4, 22.2], [-23.4, -11.0], [33.0, 15.4],
]
export const BUSHES = Object.freeze(bushes.map(([x, z], i) => ({ p: [x, 0, z], s: 0.8 + ((i * 37) % 10) / 20 })))
for (const b of BUSHES) add({ type: 'bush', ...b })
add({ type: 'tufts', seed: 77 })

/* ---------------------------------------------------------------------------
 * Furniture and things inside: low cover. [kind, x, z, w, h, d, rotY, y]
 * ------------------------------------------------------------------------- */

const furniture = [
  // The Frame, ground floor.
  ['table', -5.4, 1.6, 1.6, 0.8, 0.9, 0],
  ['crates', 0.8, -2.6, 1.2, 1.0, 1.0, 0.2],
  ['shelf', -7.0, -2.4, 0.5, 1.8, 1.6, 0],
  ['sheets', 1.4, 1.6, 1.3, 1.1, 0.3, 0.4],
  ['crates', -1.0, 0.7, 1.0, 1.9, 1.0, 0.1],
  // The Frame, top floor.
  ['crates', -5.8, -2.6, 1.0, 1.0, 1.0, 0, 3.0],
  ['sheets', -2.4, 1.6, 2.4, 0.55, 1.22, 0, 3.0],
  ['crates', 0.9, -3.1, 1.0, 0.8, 1.0, 0.3, 3.0],
  ['bucket', -1.0, -1.8, 0.4, 0.45, 0.4, 0, 3.0],
  // Long house.
  ['bunk', -10.6, -26.9, 1.9, 1.6, 0.9, 0],
  ['bunk', -5.6, -26.9, 1.9, 1.6, 0.9, 0],
  ['table', -6.4, -24.0, 1.8, 0.8, 0.9, 0],
  ['table', 1.0, -24.6, 2.2, 0.8, 1.0, 0],
  ['shelf', 5.4, -25.0, 0.5, 1.8, 2.0, 0],
  ['crates', -1.8, -27.0, 1.2, 1.1, 1.0, 0],
  // Warehouse.
  ['crates', 29.4, -9.6, 1.4, 1.6, 1.4, 0],
  ['crates', 25.8, -6.8, 1.2, 1.0, 1.2, 0.3],
  ['crates', 29.6, 2.4, 1.2, 1.2, 1.2, 0],
  ['pallets', 25.6, 5.4, 1.2, 0.6, 1.0, 0.2],
  ['shelf', 30.4, 6.6, 0.6, 1.9, 2.0, 0],
  ['crates', 26.8, 1.6, 1.0, 0.9, 1.0, 0],
  ['shelf', 30.4, -6.2, 0.6, 1.9, 2.0, 0],
  // Cookhouse.
  ['stove', -31.2, -4.6, 0.8, 0.9, 1.2, 0],
  ['table', -30.0, 0.6, 1.0, 0.8, 1.8, 0],
  ['crates', -25.4, -5.2, 1.0, 1.0, 1.0, 0],
  ['shelf', -25.6, 3.55, 1.6, 1.8, 0.5, 0],
  // Bunkhouse.
  ['bunk', 7.4, 27.0, 1.9, 1.6, 0.9, 0],
  ['bunk', 10.4, 27.0, 1.9, 1.6, 0.9, 0],
  ['table', 15.0, 25.0, 1.8, 0.8, 0.9, 0],
  ['crates', 17.2, 26.4, 1.0, 1.0, 1.0, 0.2],
  // Tarp shack.
  ['table', -28.6, -24.6, 1.4, 0.8, 0.8, 0],
  ['crates', -24.0, -25.8, 1.0, 1.0, 1.0, 0.3],
  // Tin shed and the hut.
  ['shelf', 24.0, -30.4, 1.6, 1.8, 0.5, 0],
  ['table', -27.0, 28.2, 1.4, 0.8, 0.8, 0],
  // Market stalls: crates of fruit on the counters and behind them.
  ['fruit', -14.0, 23.4, 1.6, 0.8, 0.8, 0],
  ['fruit', -8.0, 23.4, 1.6, 0.8, 0.8, 0],
  ['fruit', -2.0, 23.4, 1.6, 0.8, 0.8, 0],
]
export const PW_FURNITURE = Object.freeze(furniture.map(([kind, x, z, w, h, d, rotY = 0, y = 0]) => ({ kind, p: [x, y, z], size: [w, h, d], rotY })))
add({ type: 'furniture' })

/* ---------------------------------------------------------------------------
 * Boundary and backdrop
 * ------------------------------------------------------------------------- */

add({ type: 'pwPerimeter' })
add({ type: 'pwBackdrop' })

export const PALMWOOD_ENTITIES = Object.freeze(entities)

/* ---------------------------------------------------------------------------
 * Collider generation
 * ------------------------------------------------------------------------- */

const lineBox = (a, b, h, thick, y0 = 0, group) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
  return boxC([(a[0] + b[0]) / 2, y0 + h / 2, (a[1] + b[1]) / 2], [len, h, thick], yawQ(yaw), group)
}

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

function deckColliders(d) {
  const out = [boxC([(d.x0 + d.x1) / 2, d.y / 2, (d.z0 + d.z1) / 2], [d.x1 - d.x0, d.y, d.z1 - d.z0])]
  for (const x of [d.x0 + 0.1, d.x1 - 0.1]) for (const z of [d.z0 + 0.1, d.z1 - 0.1]) out.push(boxC([x, (d.net + d.y) / 2, z], [0.14, d.net - d.y, 0.14]))
  return out
}

const COLLIDER_BUILDERS = {
  building: (e) => buildingColliders(buildingOf(e.id)),
  deck: deckColliders,
  tower: (e) => towerColliders(towerOf(e.id)),
  tankStand: tankStandColliders,
  car: carColliders,
  jeep: (e) => localBoxes(e, [[0, 0.42, 0, 1.75, 0.82, 3.7], [0, 1.24, -0.55, 1.6, 0.42, 0.08]]),
  boat: (e) => localBoxes(e, [[0, 0, 0, BOAT.beam, BOAT.top, BOAT.length * 0.86], [0, 0, -BOAT.length * 0.43, BOAT.beam * 0.55, BOAT.top, 0.6]]),
  plyFence: (e) => [lineBox(e.a, e.b, e.h, 0.08)],
  tinFence: (e) => [lineBox(e.a, e.b, e.h, 0.1)],
  sandbags: (e) => [lineBox(e.a, e.b, 0.2 + e.layers * 0.17, 0.62, e.y)],
  crate: (e) => [groundBox(e.p, e.size, e.rotY)],
  barrels: (e) => (e.kind === 'stack' ? [groundBox(e.p, [1.75, 2.05, 1.15], e.rotY)] : [groundBox(e.p, [1.5, 0.95, 1.3], e.rotY)]),
  generator: (e) => [groundBox(e.p, [1.8, 1.25, 1.0], e.rotY)],
  logs: (e) => [groundBox(e.p, [2.6, 0.95, 1.3], e.rotY)],
  pallets: (e) => [groundBox(e.p, [1.3, 0.75, 1.1], e.rotY)],
  boom: (e) => {
    const out = [cylC([e.p[0], 0.55, e.p[2]], 0.14, 1.1)]
    const end = yawOffset(e.p, e.length, 0, e.rotY)
    out.push(boxC([(e.p[0] + end[0]) / 2, 0.95, (e.p[2] + end[2]) / 2], [e.length, 0.12, 0.12], yawQ(e.rotY), MOVE_ONLY))
    return out
  },
  campfire: (e) => [cylC([e.p[0], 0.18, e.p[2]], 0.6, 0.36, IDENTITY_Q, MOVE_ONLY)],
  leanTo: (l) => [
    boxC([l.x0 + 0.08, l.low / 2, l.z1 - 0.08], [0.12, l.low, 0.12]),
    boxC([l.x1 - 0.08, l.low / 2, l.z1 - 0.08], [0.12, l.low, 0.12]),
  ],
  ammoCrate: (e) => [groundBox(e.p, e.size, e.rotY)],
  banana: (e) => [cylC([e.p[0], 1.0 * e.s, e.p[2]], 0.15 * e.s, 2.0 * e.s)],
  palm: (e) => {
    // The trunk leans: a straight run of three cylinders following it.
    const out = []
    const yaw = palmYaw(e.p)
    let x = 0
    let y = 0
    const n = 3
    for (let i = 0; i < n; i++) {
      const ang = e.lean * ((i + 0.5) / n) * 1.6
      const seg = e.h / n
      const mx = x + Math.sin(ang) * seg * 0.5
      const my = y + Math.cos(ang) * seg * 0.5
      const w = yawOffset(e.p, mx, 0, yaw)
      out.push(cylC([w[0], my, w[2]], 0.2 - i * 0.03, seg))
      x += Math.sin(ang) * seg
      y += Math.cos(ang) * seg
    }
    return out
  },
  furniture: () => PW_FURNITURE.filter((f) => f.kind !== 'bucket').map((f) => groundBox(f.p, f.size, f.rotY)),
  pwPerimeter: () => [...boundaryColliders(PALMWOOD_HALF, PALMWOOD_HALF), boxC([0, -1, 0], [200, 2, 200])],
}

/** Which way a palm leans (deterministic per spot; the renderer turns the same way). */
export function palmYaw(p) {
  return (((p[0] * 7.3 + p[2] * 3.1) % 6.283) + 6.283) % 6.283
}

let colliderCache = null

/** Flat, cached list of every collider in the map. Identical on client and server. */
export function buildPalmwoodColliders() {
  if (colliderCache) return colliderCache
  const out = []
  for (const e of PALMWOOD_ENTITIES) {
    const build = COLLIDER_BUILDERS[e.type]
    if (build) out.push(...build(e))
  }
  colliderCache = Object.freeze(out)
  return colliderCache
}

export const palmwoodLadderAt = (x, y, z) => ladderIn(PW_LADDERS, x, y, z)

/* ---------------------------------------------------------------------------
 * Spawns
 * ------------------------------------------------------------------------- */

const spawn = (x, z, faceX = 0, faceZ = 0) => ({ p: [x, 0, z], yaw: Math.atan2(-(faceX - x), -(faceZ - z)) })

export const PALMWOOD_SPAWNS = Object.freeze({
  // TDM: the yards behind the long house (north) and the stalls and bunkhouse (south).
  [TEAMS.ALPHA]: [spawn(-18, -34.5), spawn(-12, -35), spawn(-6, -35.6), spawn(0.6, -35), spawn(6, -34.6), spawn(13.6, -35)],
  [TEAMS.BRAVO]: [spawn(18, 34.6), spawn(12, 35), spawn(6.4, 35.6), spawn(-1.2, 35), spawn(-6.8, 34.6), spawn(-15.4, 35)],
  ffa: [
    spawn(-22.6, -34.4),
    spawn(1.4, -35.2),
    spawn(18.4, -33.6),
    spawn(35.2, -2.4),
    spawn(34.8, 17.2),
    spawn(19.6, 34.2),
    spawn(-4.6, 35.4),
    spawn(-35.2, 21.4),
    spawn(-35.4, -15.6),
    spawn(-21.2, -8.4),
  ],
})

/* ---------------------------------------------------------------------------
 * Bot navigation: grid + doorways + the stairs to the Frame's top floor.
 * ------------------------------------------------------------------------- */

/** Points either side of every ground-floor doorway. */
function doorNodes() {
  const out = []
  for (const b of BUILDINGS) {
    for (const o of buildingOpenings(b)) {
      if (!o.door || o.floor > 0 || o.side === 'inner') continue
      const [a, c] = o.at
      const n = o.axis === 'x' ? [0, 1] : [1, 0]
      for (const s of [-1, 1]) out.push([a + n[0] * s * 0.9, 0, c + n[1] * s * 0.9])
    }
    for (const o of buildingOpenings(b)) {
      if (!o.door || o.floor > 0 || o.side !== 'inner') continue
      const [a, c] = o.at
      const n = o.axis === 'x' ? [0, 1] : [1, 0]
      for (const s of [-1, 1]) out.push([a + n[0] * s * 0.8, 0, c + n[1] * s * 0.8])
    }
  }
  return out
}

export const PALMWOOD_NAV = Object.freeze({
  grid: { spacing: 2.5, half: PALMWOOD_HALF - 1.2 },
  root: [0, 13.5],
  linkUpper: true,
  extra: Object.freeze([...doorNodes()]),
  chains: Object.freeze([
    // East stairs: up the flight, onto the landing, in through the gap.
    [[3.15, 0, -5.4], [3.15, 0.35, -3.6], [3.15, 1.5, -1.15], [3.15, 2.6, 1.0], [3.15, 3.0, 2.7], [1.6, 3.0, 2.6]],
    // West stairs.
    [[-8.1, 0, 4.45], [-8.1, 0.35, 2.65], [-8.1, 1.5, 0.2], [-8.1, 2.6, -2.0], [-8.1, 3.0, -3.7], [-6.6, 3.0, -3.7]],
  ]),
  // The Frame's top floor (linked to each other and to the chain tops).
  upper: Object.freeze([
    [-6.4, 3.0, -1.0], [-6.2, 3.0, 2.2], [-3.6, 3.0, -2.2], [-3.6, 3.0, 0.4], [-0.8, 3.0, 2.4], [-0.6, 3.0, -0.6], [1.4, 3.0, 0.6], [1.6, 3.0, -1.8], [-4.4, 3.0, 2.6], [-3.0, 3.0, -3.6],
  ]),
})
