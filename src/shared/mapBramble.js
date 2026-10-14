/**
 * "Bramblewood" — an abandoned farm town the woods have taken back, as data.
 *
 * North-east, a big field of old furrows and round hay bales, a tractor left
 * where it stopped, the water tower beside it and the barn on its south-east
 * corner (a hayloft over the floor, its north window looking down the whole
 * field). A dried-up creek cuts across the middle in a deep, wide ditch
 * (puddles here and there in its bed), crossed by a covered boardwalk and the
 * farm track's bridge, both of which you can crouch under. West,
 * the brick farmhouse; in the middle a roofless ruin and a burnt-out tank still
 * burning on the farm track. Along the dirt road to the south, a row of houses,
 * a tin garage and the backyards behind them. Ivy on every wall and pole, tall
 * grass, ferns and bushes in every corner, trees everywhere.
 *
 * Coordinates are metres. +X is east, -Z north, +Y up, ground y = 0 (down in
 * the creek: the ground is a triangle mesh, see brambleGround). The arena is
 * 104 x 104 m. Everything is listed once as entities; the client draws them
 * and BOTH sides build their physics from `buildBrambleColliders()`.
 */
import { TEAMS } from './constants.js'
import { CAR_MODELS, houseColliders, houseOpenings, towerDeckPieces } from './mapAcres.js'
import { buildingColliders as shackColliders, buildingOpenings as shackOpenings } from './mapPalmwood.js'
import { boundaryColliders, boxC, cylC, groundBox, IDENTITY_Q, ladder, ladderIn, meshC, MOVE_ONLY, quatFromEuler, quatMultiply, rampBox, segmentCyl, yawOffset, yawQ } from './mapKit.js'
import { seededRandom } from './math.js'

export const BRAMBLE_NAME = 'Bramblewood'
export const BRAMBLE_HALF = 52

const entities = []
const add = (e) => {
  entities.push(e)
  return e
}

/* ---------------------------------------------------------------------------
 * Houses and the barn (Atomic Acres' house model: see mapAcres.js)
 * ------------------------------------------------------------------------- */

const door = (from, to, top = 2.2) => ({ from, to, bottom: 0, top, door: true })
const win = (from, to, bottom = 1.0, top = 2.1) => ({ from, to, bottom, top })
/** A barn's big doorway (open, no leaf). */
const bay = (from, to, top) => ({ from, to, bottom: 0, top, door: true, garage: true })

export const HOUSES = Object.freeze([
  {
    // The farmhouse: brick below, weathered boards above, stairs up the north wall.
    id: 'br-farmhouse',
    x0: -40.7,
    x1: -28.7,
    z0: -8.7,
    z1: 1.3,
    look: { lower: 'brick', upper: 'weathered', trim: 'bone', roof: 'slate', base: 'stone', shutters: 'black', door: '#4a3426', curtains: '#8a7a5a', interior: ['#c9b89a', '#b7a48a'], noAerial: true },
    floors: [
      {
        y: 0,
        h: 3.0,
        walls: {
          n: [win(-31.3, -29.9)],
          s: [win(-39.3, -37.3), door(-36.9, -35.7), win(-32.3, -30.3)],
          w: [win(-7.1, -5.5), door(-4.3, -3.1)],
          e: [win(-7.3, -5.7), door(-4.1, -2.9), win(-1.1, 0.5)],
        },
        inner: [{ axis: 'z', at: -34.7, from: -7.5, to: 1.1, openings: [door(-2.7, -1.5)] }],
        floor: 'wood',
      },
      {
        y: 3.2,
        h: 2.6,
        walls: {
          n: [win(-31.1, -29.7, 0.9, 2.0)],
          s: [win(-39.1, -37.3, 0.9, 2.0), win(-33.7, -32.1, 0.9, 2.0), win(-30.7, -29.5, 0.9, 2.0)],
          w: [win(-6.5, -4.9, 0.9, 2.0), win(-2.3, -0.7, 0.9, 2.0)],
          e: [win(-6.7, -5.1, 0.9, 2.0), win(-2.1, -0.5, 0.9, 2.0)],
        },
        inner: [{ axis: 'z', at: -34.7, from: -7.5, to: 1.1, openings: [door(-5.1, -3.9)] }],
        floor: 'wood',
      },
    ],
    slabs: [
      { x0: -40.5, x1: -36.7, z0: -8.5, z1: 1.1 },
      { x0: -32.9, x1: -28.9, z0: -8.5, z1: 1.1 },
      { x0: -36.7, x1: -32.9, z0: -7.5, z1: 1.1 },
    ],
    stairs: [{ bottom: [-38.1, 0, -8.0], top: [-32.9, 3.2, -8.0], width: 1.0 }],
    rails: [[-36.7, -7.5, -32.9, -7.5], [-36.7, -8.5, -36.7, -7.5]],
    closets: [{ x0: -35.7, x1: -32.9, z0: -8.5, z1: -7.5, h: 1.4 }],
    roof: { ridge: 9.0, overhang: 0.5 },
    chimney: { x0: -40.1, x1: -38.9, z0: 1.3, z1: 2.2, top: 9.4 },
    porch: { side: 'e', from: -4.5, to: -2.5, depth: 1.4 },
  },
  {
    // The barn: a hayloft over the floor, big doorways at both gable ends, the
    // loft's north window over the field.
    id: 'br-barn',
    x0: 31.1,
    x1: 43.1,
    z0: -9.0,
    z1: 7.0,
    look: { lower: 'barnGrey', upper: 'barnGrey', trim: 'bone', roof: 'charcoal', base: 'stone', door: '#4a3e30', curtains: null, interior: ['#8c7c66', '#857560'], upperFloor: 'plank', noAerial: true },
    floors: [
      {
        y: 0,
        h: 3.4,
        walls: {
          s: [bay(35.1, 39.1, 3.2)],
          n: [bay(35.7, 38.5, 3.0)],
          w: [door(-4.2, -3.0), win(1.0, 2.2, 1.2, 2.2)],
          e: [win(-5.0, -3.8, 1.2, 2.2), door(0.0, 1.2)],
        },
        floor: 'plank',
      },
      {
        y: 3.6,
        h: 2.6,
        walls: {
          s: [door(36.3, 37.9, 2.0)],
          n: [win(36.1, 38.1, 0.8, 2.0)],
          w: [win(-5.8, -4.4, 0.9, 1.9), win(2.2, 3.6, 0.9, 1.9)],
          e: [win(-1.0, 0.4, 0.9, 1.9)],
        },
        floor: 'plank',
      },
    ],
    // The loft, leaving the stairwell open along the east wall.
    slabs: [
      { x0: 31.3, x1: 41.9, z0: -8.8, z1: 6.8 },
      { x0: 41.9, x1: 42.9, z0: -0.6, z1: 6.8 },
      { x0: 41.9, x1: 42.9, z0: -8.8, z1: -5.0 },
    ],
    stairs: [{ bottom: [42.4, 0, -6.8], top: [42.4, 3.6, -0.6], width: 1.0 }],
    rails: [[41.9, -5.0, 41.9, -0.6], [41.9, -5.0, 42.9, -5.0]],
    closets: [{ x0: 41.9, x1: 42.9, z0: -3.0, z1: -0.6, h: 1.4 }],
    roof: { ridge: 10.0, overhang: 0.5 },
  },
  {
    // Brick house on the road, stairs up its west wall.
    id: 'br-houseS',
    x0: 13.6,
    x1: 23.6,
    z0: 30.9,
    z1: 40.9,
    look: { lower: 'brick', upper: 'brick', trim: 'bone', roof: 'charcoal', base: 'stone', shutters: 'green', door: '#2a3a2c', curtains: '#9a8a6a', interior: ['#cdbd9c', '#b9a98c'], noAerial: true },
    floors: [
      {
        y: 0,
        h: 3.0,
        walls: {
          n: [win(15.2, 16.8), door(18.0, 19.2), win(20.6, 22.2)],
          s: [win(16.0, 17.6), door(20.0, 21.2)],
          w: [win(31.7, 33.3)],
          e: [win(32.5, 34.1), door(36.3, 37.5), win(38.5, 39.9)],
        },
        inner: [{ axis: 'x', at: 35.9, from: 14.8, to: 23.4, openings: [door(19.6, 20.8)] }],
        floor: 'wood',
      },
      {
        y: 3.2,
        h: 2.6,
        walls: {
          n: [win(15.6, 17.2, 0.9, 2.0), win(20.0, 21.6, 0.9, 2.0)],
          s: [win(16.6, 18.2, 0.9, 2.0), win(20.6, 22.2, 0.9, 2.0)],
          w: [win(31.5, 32.9, 0.9, 2.0)],
          e: [win(32.3, 33.9, 0.9, 2.0), win(37.9, 39.5, 0.9, 2.0)],
        },
        inner: [{ axis: 'x', at: 35.9, from: 14.8, to: 23.4, openings: [door(17.2, 18.4)] }],
        floor: 'wood',
      },
    ],
    slabs: [
      { x0: 13.8, x1: 14.8, z0: 38.1, z1: 40.7 },
      { x0: 13.8, x1: 14.8, z0: 31.1, z1: 34.3 },
      { x0: 14.8, x1: 23.4, z0: 31.1, z1: 40.7 },
    ],
    stairs: [{ bottom: [14.3, 0, 39.5], top: [14.3, 3.2, 34.3], width: 1.0 }],
    rails: [[14.8, 34.3, 14.8, 38.1], [13.8, 38.1, 14.8, 38.1]],
    closets: [{ x0: 13.8, x1: 14.8, z0: 34.3, z1: 36.9, h: 1.4 }],
    roof: { ridge: 8.6, overhang: 0.5 },
    chimney: { x0: 23.6, x1: 24.5, z0: 32.9, z1: 34.1, top: 8.8 },
  },
  {
    // Weathered clapboard house in the south-east, stairs up its east wall.
    id: 'br-houseSE',
    x0: 34.6,
    x1: 44.6,
    z0: 29.7,
    z1: 39.7,
    look: { lower: 'weathered', upper: 'weathered', trim: 'white', roof: 'slate', base: 'concrete', shutters: 'black', door: '#5a3a2a', curtains: '#8a8a72', interior: ['#c4b598', '#b3a68c'], noAerial: true },
    floors: [
      {
        y: 0,
        h: 3.0,
        walls: {
          n: [win(35.6, 37.2), door(38.0, 39.2), win(40.6, 42.2)],
          s: [door(36.0, 37.2), win(39.6, 41.2)],
          w: [win(31.1, 32.7), door(35.3, 36.5)],
          e: [win(30.3, 31.7)],
        },
        inner: [{ axis: 'x', at: 34.7, from: 34.8, to: 43.4, openings: [door(38.6, 39.8)] }],
        floor: 'wood',
      },
      {
        y: 3.2,
        h: 2.6,
        walls: {
          n: [win(36.0, 37.6, 0.9, 2.0), win(40.0, 41.6, 0.9, 2.0)],
          s: [win(36.6, 38.2, 0.9, 2.0), win(40.6, 42.2, 0.9, 2.0)],
          w: [win(31.3, 32.9, 0.9, 2.0), win(36.7, 38.3, 0.9, 2.0)],
          e: [win(30.5, 31.9, 0.9, 2.0)],
        },
        inner: [{ axis: 'x', at: 34.7, from: 34.8, to: 43.4, openings: [door(36.2, 37.4)] }],
        floor: 'wood',
      },
    ],
    slabs: [
      { x0: 43.4, x1: 44.4, z0: 36.9, z1: 39.5 },
      { x0: 43.4, x1: 44.4, z0: 29.9, z1: 33.1 },
      { x0: 34.8, x1: 43.4, z0: 29.9, z1: 39.5 },
    ],
    stairs: [{ bottom: [43.9, 0, 38.3], top: [43.9, 3.2, 33.1], width: 1.0 }],
    rails: [[43.4, 33.1, 43.4, 36.9], [43.4, 36.9, 44.4, 36.9]],
    closets: [{ x0: 43.4, x1: 44.4, z0: 33.1, z1: 35.7, h: 1.4 }],
    roof: { ridge: 8.6, overhang: 0.5 },
  },
  {
    // Brick cottage on the road.
    id: 'br-cottage',
    x0: -26.3,
    x1: -18.3,
    z0: 31.9,
    z1: 39.9,
    look: { lower: 'brick', trim: 'bone', roof: 'red', base: 'stone', shutters: 'black', door: '#3a4a3a', curtains: '#a08a6a', interior: ['#c9b49a'], noAerial: true },
    floors: [
      {
        y: 0,
        h: 2.9,
        walls: {
          n: [win(-25.3, -23.9), door(-23.3, -22.1), win(-20.7, -19.1)],
          s: [win(-24.3, -22.7), door(-20.9, -19.7)],
          w: [win(33.9, 35.5)],
          e: [win(33.3, 34.9), door(37.3, 38.5)],
        },
        inner: [{ axis: 'x', at: 35.9, from: -26.1, to: -18.5, openings: [door(-22.9, -21.7)] }],
        floor: 'wood',
      },
    ],
    roof: { ridge: 5.6, overhang: 0.45 },
    chimney: { x0: -25.7, x1: -24.7, z0: 39.9, z1: 40.8, top: 6.4 },
  },
  {
    // Clapboard house in the south-west.
    id: 'br-houseSW',
    x0: -45.9,
    x1: -35.9,
    z0: 30.9,
    z1: 40.9,
    look: { lower: 'ash', trim: 'bone', roof: 'slate', base: 'concrete', shutters: 'black', door: '#4a3a2a', curtains: '#8a7a62', interior: ['#c2b498'], noAerial: true },
    floors: [
      {
        y: 0,
        h: 3.0,
        walls: {
          n: [win(-44.9, -43.3), door(-42.6, -41.4), win(-39.3, -37.7)],
          s: [win(-43.9, -42.3), door(-39.5, -38.3)],
          w: [win(32.9, 34.5), win(37.3, 38.9)],
          e: [door(35.3, 36.5)],
        },
        inner: [{ axis: 'z', at: -40.9, from: 31.1, to: 40.7, openings: [door(35.9, 37.1)] }],
        floor: 'wood',
      },
    ],
    roof: { ridge: 6.2, overhang: 0.5 },
  },
])
for (const h of HOUSES) add({ type: 'house', id: h.id })
const houseById = Object.fromEntries(HOUSES.map((h) => [h.id, h]))
export const brambleHouseOf = (id) => houseById[id]

/* ---------------------------------------------------------------------------
 * Sheds and the tin garage (Palmwood's shack model: see mapPalmwood.js)
 * ------------------------------------------------------------------------- */

const sDoor = (from, to, top = 2.15) => ({ from, to, bottom: 0, top, door: true })
const sWin = (from, to, bottom = 1.1, top = 1.9) => ({ from, to, bottom, top })

export const SHACKS = Object.freeze([
  {
    // The tin garage on the road: a wide doorway, a door round the side.
    id: 'br-garage',
    x0: -6.2,
    x1: 3.8,
    z0: 30.6,
    z1: 38.1,
    look: { walls: 'tin', wallTint: 'rust', floor: 'concrete', tin: ['rust', 'galvanized', 'rust'] },
    floors: [
      {
        y: 0,
        h: 3.0,
        walls: {
          n: [{ from: -4.6, to: 0.2, bottom: 0, top: 2.7, door: true }, sDoor(1.4, 2.6)],
          s: [sWin(-3.6, -1.8), sDoor(0.8, 2.0)],
          w: [sDoor(33.0, 34.2)],
          e: [sWin(33.6, 35.2)],
        },
      },
    ],
    roof: { type: 'gable', axis: 'x', ridge: 4.6, overhang: 0.4 },
  },
  {
    // Shed in the meadow (north-west): the first resupply crate.
    id: 'br-shedNW',
    x0: -24.2,
    x1: -19.2,
    z0: -46.6,
    z1: -42.6,
    look: { walls: 'plywood', floor: 'plank', tin: ['rust', 'galvanized'] },
    floors: [{ y: 0, h: 2.5, walls: { s: [sDoor(-22.4, -21.2)], e: [sWin(-45.4, -43.8)], n: [], w: [] } }],
    roof: { type: 'shed', down: 'n', rise: 0.5, overhang: 0.35 },
  },
  {
    // Shed behind the houses (south-east): the other resupply crate.
    id: 'br-shedSE',
    x0: 39.0,
    x1: 44.0,
    z0: 45.1,
    z1: 49.5,
    look: { walls: 'tin', wallTint: 'galvanized', floor: 'concrete', tin: ['rust', 'white'] },
    floors: [{ y: 0, h: 2.5, walls: { n: [sDoor(41.0, 42.2)], w: [sWin(46.5, 48.1)], s: [], e: [] } }],
    roof: { type: 'shed', down: 's', rise: 0.5, overhang: 0.35 },
  },
])
for (const s of SHACKS) add({ type: 'shack', id: s.id })
const shackById = Object.fromEntries(SHACKS.map((s) => [s.id, s]))
export const brambleShackOf = (id) => shackById[id]

/* ---------------------------------------------------------------------------
 * The ruin: a roofless brick shell in the middle, and broken walls
 * ------------------------------------------------------------------------- */

/**
 * Broken brick walls: from `a` to `b`, `t` thick, in 1 m stretches whose
 * heights are `h` (0 = fallen right down: a gap you walk through).
 */
export const RUINS = Object.freeze([
  { a: [-11.4, -3.9], b: [-3.4, -3.9], h: [2.8, 2.9, 2.4, 0, 0, 1.6, 2.2, 2.6] },
  { a: [-11.4, -3.6], b: [-11.4, 4.8], h: [2.8, 2.5, 1.8, 1.0, 0.7, 1.2, 2.0, 2.4] },
  { a: [-11.4, 5.1], b: [-3.4, 5.1], h: [2.6, 1.9, 0, 0, 0.8, 1.4, 2.1, 2.3] },
  { a: [-3.4, -3.6], b: [-3.4, 4.8], h: [2.9, 2.2, 1.2, 0, 0, 0, 1.0, 1.8] },
  // A broken garden wall above the creek, east of the farm track.
  { a: [11.3, -8.0], b: [23.3, -8.0], h: [1.1, 1.2, 0.9, 0, 1.0, 1.1, 1.2, 0.6, 0, 0, 1.0, 1.2] },
  // What's left of a house by the meadow.
  { a: [-31.4, -29.0], b: [-24.4, -29.0], h: [2.2, 1.6, 0.9, 0, 0, 1.4, 2.0] },
  { a: [-31.4, -28.7], b: [-31.4, -23.3], h: [2.0, 1.2, 0, 0.9, 1.6] },
])
export const RUIN_T = 0.32
RUINS.forEach((r, i) => add({ type: 'ruin', i }))

/** The stretches of a ruined wall: { p, size, yaw, h, a, b } (1 m long, the last whatever's left). */
export function ruinPieces(r) {
  const len = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1])
  const ux = (r.b[0] - r.a[0]) / len
  const uz = (r.b[1] - r.a[1]) / len
  const yaw = Math.atan2(-uz, ux)
  const n = r.h.length
  const step = len / n
  const out = []
  for (let i = 0; i < n; i++) {
    const h = r.h[i]
    if (h <= 0) continue
    const c = (i + 0.5) * step
    out.push({ p: [r.a[0] + ux * c, h / 2, r.a[1] + uz * c], size: [step, h, RUIN_T], yaw, h, i })
  }
  return out
}

/** Rubble heaps in the ruin and along the broken walls: [x, z, radius, height]. */
export const RUBBLE = Object.freeze([
  [-7.4, -2.9, 1.4, 0.5],
  [-4.6, 1.1, 1.2, 0.4],
  [-9.8, 3.7, 1.0, 0.35],
  [14.9, -7.1, 1.0, 0.35],
  [-28.0, -28.0, 1.2, 0.4],
])
for (const [x, z, r, h] of RUBBLE) add({ type: 'rubble', p: [x, 0, z], r, h })

/* ---------------------------------------------------------------------------
 * The farm: the field, hay, the tractor, the water tower
 * ------------------------------------------------------------------------- */

/** The field: old furrows running north-south. */
export const FIELD = Object.freeze({ x0: 9.0, x1: 47.0, z0: -50.0, z1: -23.0 })
add({ type: 'brGround' })

/** Hay: round bales lying in the field and square stacks by the barn: [kind, x, z, rotY]. */
const hay = [
  ['round', 14.0, -44.6, 0.4],
  ['round', 21.8, -38.9, 1.2],
  ['round', 16.6, -30.5, 0.1],
  ['round', 28.0, -45.1, 2.0],
  ['round', 36.4, -37.1, 0.7],
  ['round', 42.1, -28.0, 1.6],
  ['round', 25.3, -26.6, 0.3],
  ['round', 40.9, -45.8, 2.4],
  ['round', 27.6, -33.0, 2.9],
  ['stack', 27.2, 3.7, 0.2],
  ['stack', 40.9, 11.1, -0.3],
]
export const HAY = Object.freeze(hay.map(([kind, x, z, rotY]) => ({ kind, p: [x, 0, z], rotY })))
for (const h of HAY) add({ type: 'hay', ...h })

export const TRACTOR = Object.freeze({ length: 3.6, width: 1.9 })
add({ type: 'tractor', p: [32.7, 0, -32.4], rotY: 2.3 })

/** The water tower west of the field: legs, a deck ring round the tank, a ladder up the south side. */
export const WATER_TOWER = Object.freeze({
  p: [-5.0, 0, -37.2],
  leg: 2.1,
  deck: 9.2,
  ringIn: 2.7,
  ringOut: 4.0,
  tank: { r: 2.7, h: 4.0, roof: 1.3 },
})
add({ type: 'waterTower', ...WATER_TOWER })

function waterTowerColliders(t) {
  const out = []
  const [cx, , cz] = t.p
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(boxC([cx + sx * t.leg, t.deck / 2, cz + sz * t.leg], [0.34, t.deck, 0.34]))
  const { deck, rails } = towerDeckPieces(t)
  for (const d of deck) out.push(boxC(d.p, d.size, yawQ(d.yaw)))
  for (const r of rails) {
    out.push(boxC([r.p[0], t.deck + 0.15, r.p[1]], [r.len, 0.3, 0.08], yawQ(r.yaw)))
    out.push(boxC([r.p[0], t.deck + 0.65, r.p[1]], [r.len, 0.7, 0.08], yawQ(r.yaw), MOVE_ONLY))
  }
  out.push(cylC([cx, t.deck + t.tank.h / 2, cz], t.tank.r, t.tank.h))
  out.push(cylC([cx, t.deck + t.tank.h + t.tank.roof * 0.35, cz], t.tank.r * 0.6, t.tank.roof * 0.7))
  out.push(boxC([cx, t.deck - 0.1, cz], [t.ringIn * 2, 0.2, t.ringIn * 2]))
  return out
}

/* ---------------------------------------------------------------------------
 * The creek: a dried-up ditch across the middle, and the ground round it
 * ------------------------------------------------------------------------- */

/**
 * The creek's middle line, west to east (straight where it runs out under the
 * perimeter wall at both ends), and its ditch: `top` wide between the lips,
 * `bed` wide at the bottom, `depth` deep. All three vary a little along it and
 * the bed wanders from side to side (see creekSection); under the farm track's
 * bridge it's dug deeper, so you can crouch through. The bed is dry but for
 * the puddles: [from x, to x], where it dips and the water lies.
 */
export const CREEK = Object.freeze({
  top: 10.0,
  bed: 4.2,
  depth: 1.5,
  points: [[-60, -15.6], [-50, -15.6], [-40, -15.9], [-30, -15.8], [-20, -16.1], [-10, -16.6], [0, -16.2], [6, -15.5], [14, -15.2], [24, -15.3], [34, -15.9], [44, -15.8], [50, -15.6], [60, -15.6]],
  puddles: [[-45, -38], [-28, -22.5], [-9.5, -2.5], [14.5, 21.5], [29.5, 35.5], [41, 46.5]],
})

/** The ditch runs from wall to wall: it ends inside the perimeter wall at x = ±CREEK_END. */
export const CREEK_END = BRAMBLE_HALF + 0.3

/** Chaikin-smoothed polyline (two points in, three rounds: a gentle curve through them). */
export function smoothLine(points, rounds = 2) {
  let pts = points
  for (let r = 0; r < rounds; r++) {
    const out = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[i + 1]
      out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75])
    }
    out.push(pts[pts.length - 1])
    pts = out
  }
  return pts
}

const CREEK_LINE = smoothLine(CREEK.points, 3)

/** The creek's middle line: its z at x, and dz/dx there. */
export function creekZ(x) {
  const L = CREEK_LINE
  for (let i = 1; i < L.length; i++) {
    if (x <= L[i][0] || i === L.length - 1) {
      const k = (L[i][1] - L[i - 1][1]) / (L[i][0] - L[i - 1][0])
      return L[i - 1][1] + (Math.min(Math.max(x, L[i - 1][0]), L[i][0]) - L[i - 1][0]) * k
    }
  }
  return L[0][1]
}
const creekSlope = (x) => (creekZ(x + 0.5) - creekZ(x - 0.5)) / 1.0

/** Where the boardwalk and the bridge cross (the ditch runs even under them). */
const BOARDWALK_X = -17.2
const BRIDGE_X = 6.0

/** 1 at `c`, easing to 0 at `r` away. */
const bump = (x, c, r) => {
  const d = Math.abs(x - c) / r
  return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(d * Math.PI)
}
/** The depth to the banks' foot, before the puddles level it off. */
const rawDepth = (x) => CREEK.depth + 0.1 * Math.sin(x * 0.19 + 0.7) + 0.35 * bump(x, BRIDGE_X, 7.5)

/**
 * The ditch's cross-section at x: `top` (each lip, off the middle line), `bed`
 * (half the bed's width), `shift` (the bed's middle, off the middle line; north
 * is +), `depth` (to the foot of the banks) and `dip` (the bed's middle, below
 * that). Each puddle is a hollow in the bed, deepest at its middle (the bed
 * runs level round it, so its water makes an oval).
 */
export function creekSection(x) {
  const even = Math.max(bump(x, BOARDWALK_X, 9), bump(x, BRIDGE_X, 9))
  const wild = 1 - even
  let depth = rawDepth(x)
  let hollow = 0
  for (const [a, b] of CREEK.puddles) {
    const c = (a + b) / 2
    const w = bump(x, c, (b - a) / 2 + 2.5)
    depth += (rawDepth(c) - depth) * w
    hollow = Math.max(hollow, 0.2 * bump(x, c, (b - a) / 2) * (1 + 0.15 * Math.sin(x * 1.7)))
  }
  return {
    z: creekZ(x),
    top: CREEK.top / 2 + wild * (0.3 * Math.sin(x * 0.13 + 1.1) + 0.12 * Math.sin(x * 0.37)),
    bed: CREEK.bed / 2 + wild * 0.15 * Math.sin(x * 0.21 + 2.0),
    shift: wild * 0.3 * Math.sin(x * 0.09 + 0.4),
    depth,
    dip: 0.05 + hollow,
  }
}

/** The water level of a puddle: flat, so it shows only where its hollow sinks below it. */
export function puddleLevel([a, b]) {
  const s = creekSection((a + b) / 2)
  return -s.depth - s.dip * 0.45
}

/** A bank's fall from its lip (f = 0) to its foot (f = 1), as a share of the depth: rounded over at both. */
const bankCurve = (f) => 0.6 * f + 0.4 * f * f * (3 - 2 * f)

/** Offsets (north +) and heights across the ditch at a section, lip to lip: what the ground mesh is built from. */
export const CREEK_PROFILE = Object.freeze([
  // [where, f]: 'n'/'s' bank at f (0 lip .. 1 foot), 'b' bed at u (-1 north foot .. 1 south foot).
  ['n', 0], ['n', 0.25], ['n', 0.5], ['n', 0.75], ['n', 1],
  ['b', -0.5], ['b', 0], ['b', 0.5],
  ['s', 1], ['s', 0.75], ['s', 0.5], ['s', 0.25], ['s', 0],
])

function profilePoint(s, [where, f]) {
  const footN = s.shift + s.bed
  const footS = s.shift - s.bed
  if (where === 'n') return [s.top + (footN - s.top) * f, -s.depth * bankCurve(f)]
  if (where === 's') return [-s.top + (footS + s.top) * f, -s.depth * bankCurve(f)]
  return [s.shift - f * s.bed, -s.depth - s.dip * (1 - f * f)]
}

/** The ground's height at (x, z): 0 but in the creek. */
export function brambleGroundY(x, z) {
  if (Math.abs(x) > CREEK_END) return 0
  const k = creekSlope(x)
  const c = 1 / Math.hypot(1, k)
  const dz = z - creekZ(x)
  // Off the middle line, square to it (north +), and the point on it opposite.
  const o = -dz * c
  const s = creekSection(x + dz * k * c * c)
  if (o >= s.top || o <= -s.top) return 0
  const footN = s.shift + s.bed
  const footS = s.shift - s.bed
  if (o > footN) return -s.depth * bankCurve((s.top - o) / (s.top - footN))
  if (o < footS) return -s.depth * bankCurve((o + s.top) / (footS + s.top))
  const u = (s.shift - o) / s.bed
  return -s.depth - s.dip * (1 - u * u)
}

/** True if (x, z) is in the ditch or within `margin` of its lips. */
export function inCreek(x, z, margin = 0) {
  if (Math.abs(x) > CREEK_END + margin) return false
  const k = creekSlope(x)
  const c = 1 / Math.hypot(1, k)
  const dz = z - creekZ(x)
  return Math.abs(dz * c) < creekSection(x + dz * k * c * c).top + margin
}

let groundCache = null

/**
 * The playable ground as one triangle mesh, for the physics and the renderer
 * alike: the ditch (sections about a metre apart, CREEK_PROFILE across each),
 * the flat ground north and south of it out to the edge, and a strip at each
 * end past the wall. `positions` are xyz triples; the three index lists split
 * it by surface (grass, the banks' bare earth, the bed).
 */
export function brambleGround() {
  if (groundCache) return groundCache
  const E = BRAMBLE_HALF + 1.5
  const pos = []
  const grass = []
  const bank = []
  const bed = []
  const vert = (x, y, z) => {
    pos.push(+x.toFixed(4), +y.toFixed(4), +z.toFixed(4))
    return pos.length / 3 - 1
  }
  // Triangles wound to face up, whichever way the corners were listed.
  const tri = (out, a, b, c) => {
    const ux = pos[b * 3] - pos[a * 3]
    const uz = pos[b * 3 + 2] - pos[a * 3 + 2]
    const vx = pos[c * 3] - pos[a * 3]
    const vz = pos[c * 3 + 2] - pos[a * 3 + 2]
    if (uz * vx - ux * vz >= 0) out.push(a, b, c)
    else out.push(a, c, b)
  }
  const quad = (out, a, b, c, d) => {
    tri(out, a, b, c)
    tri(out, a, c, d)
  }
  const n = Math.round((CREEK_END * 2) / 1.0)
  const P = CREEK_PROFILE.length
  const rows = []
  for (let i = 0; i <= n; i++) {
    const x = -CREEK_END + (i * CREEK_END * 2) / n
    const s = creekSection(x)
    const k = creekSlope(x)
    const c = 1 / Math.hypot(1, k)
    // North, square to the line.
    const nx = k * c
    const nz = -c
    rows.push(CREEK_PROFILE.map((p) => {
      const [o, y] = profilePoint(s, p)
      return vert(x + nx * o, y, s.z + nz * o)
    }))
  }
  const surface = (j) => (j === 0 || j === P - 2 ? grass : j < 4 || j > P - 6 ? bank : bed)
  for (let i = 0; i < n; i++) for (let j = 0; j < P - 1; j++) quad(surface(j), rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1])
  // Flat ground either side, out to the edge; past each end, flat right across.
  for (const [j, edge] of [[0, -E], [P - 1, E]]) {
    let prev = null
    for (let i = 0; i <= n; i++) {
      const lip = rows[i][j]
      const far = vert(pos[lip * 3], 0, edge)
      if (prev) quad(grass, prev[0], lip, far, prev[1])
      prev = [lip, far]
    }
  }
  for (const s of [-1, 1]) {
    const a = vert(s * CREEK_END, 0, -E)
    const b = vert(s * E, 0, -E)
    const c = vert(s * E, 0, E)
    const d = vert(s * CREEK_END, 0, E)
    quad(grass, a, b, c, d)
  }
  groundCache = Object.freeze({ positions: new Float32Array(pos), grass, bank, bed })
  return groundCache
}

/* ---------------------------------------------------------------------------
 * The covered boardwalk and the farm track's bridge over the creek
 * ------------------------------------------------------------------------- */

const bwZ = creekZ(BOARDWALK_X)
/** The covered boardwalk: a plank deck on posts, rails along both sides, a tin roof; stilts down into the ditch. */
export const BOARDWALK = Object.freeze({ x0: BOARDWALK_X - 1.6, x1: BOARDWALK_X + 1.6, z0: +(bwZ - 6.4).toFixed(2), z1: +(bwZ + 6.4).toFixed(2), y: 0.32, roof: 2.75 })
add({ type: 'boardwalk', ...BOARDWALK })

/** The boardwalk's posts: [x, z] down each side (roof posts, and stilts where they stand in the ditch) and down the middle. */
export function boardwalkPosts(w) {
  const side = []
  for (let z = w.z0 + 0.1; z <= w.z1 - 0.09; z += (w.z1 - w.z0 - 0.2) / 4) for (const x of [w.x0 + 0.08, w.x1 - 0.08]) side.push([x, z])
  const middle = [-2.2, 2.2].map((d) => [(w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2 + d])
  return { side, middle }
}

function boardwalkColliders(w) {
  const cx = (w.x0 + w.x1) / 2
  const s = creekSection(cx)
  const lipN = s.z - s.top
  const lipS = s.z + s.top
  // The deck, and solid under it where it rests on the ground (open over the ditch).
  const out = [boxC([cx, w.y - 0.1, (w.z0 + w.z1) / 2], [w.x1 - w.x0, 0.2, w.z1 - w.z0])]
  for (const [a, b] of [[w.z0, lipN], [lipS, w.z1]]) out.push(boxC([cx, (w.y - 0.2) / 2, (a + b) / 2], [w.x1 - w.x0, w.y - 0.2, b - a]))
  const { side, middle } = boardwalkPosts(w)
  for (const [x, z] of side) {
    const y0 = brambleGroundY(x, z) - 0.1
    out.push(boxC([x, (w.roof + y0) / 2, z], [0.14, w.roof - y0, 0.14]))
  }
  for (const [x, z] of middle) {
    const y0 = brambleGroundY(x, z) - 0.1
    out.push(boxC([x, (w.y - 0.2 + y0) / 2, z], [0.16, w.y - 0.2 - y0, 0.16]))
  }
  // Rails along the sides (you can't step off into the creek mid-span).
  for (const x of [w.x0 + 0.08, w.x1 - 0.08]) out.push(boxC([x, w.y + 0.5, (w.z0 + w.z1) / 2], [0.06, 1.0, w.z1 - w.z0 - 3.0], IDENTITY_Q, MOVE_ONLY))
  const r = rampBox([cx, w.roof + 0.35, (w.z0 + w.z1) / 2], [w.x0 - 0.4, w.roof, (w.z0 + w.z1) / 2], w.z1 - w.z0 + 0.6, 0.06)
  out.push(boxC(r.p, r.size, r.q))
  const r2 = rampBox([cx, w.roof + 0.35, (w.z0 + w.z1) / 2], [w.x1 + 0.4, w.roof, (w.z0 + w.z1) / 2], w.z1 - w.z0 + 0.6, 0.06)
  out.push(boxC(r2.p, r2.size, r2.q))
  return out
}

const brZ = creekZ(BRIDGE_X)
/**
 * The farm track's bridge: a concrete deck from lip to lip and a little past,
 * low parapets along both sides, abutments down at the foot of each bank.
 * The deck's top sits 6 cm proud of the ground; under it, crouching room.
 */
export const BRIDGE = Object.freeze({ x0: BRIDGE_X - 2.8, x1: BRIDGE_X + 2.8, z0: +(brZ - 6.3).toFixed(2), z1: +(brZ + 6.3).toFixed(2), top: 0.06, deck: 0.36, wall: 0.55, wallT: 0.3 })
add({ type: 'bridge', ...BRIDGE })

/** The bridge's solid parts: { p, size } boxes (the deck, the parapets, the abutments). */
export function bridgePieces(b) {
  const cx = (b.x0 + b.x1) / 2
  const cz = (b.z0 + b.z1) / 2
  const s = creekSection(cx)
  const under = b.top - b.deck
  const footY = -s.depth - 0.3
  const out = [{ p: [cx, b.top - b.deck / 2, cz], size: [b.x1 - b.x0, b.deck, b.z1 - b.z0], kind: 'deck' }]
  for (const x of [b.x0 + b.wallT / 2, b.x1 - b.wallT / 2]) out.push({ p: [x, b.top + b.wall / 2, cz], size: [b.wallT, b.wall, b.z1 - b.z0], kind: 'parapet' })
  for (const o of [s.shift + s.bed + 0.15, s.shift - s.bed - 0.15]) out.push({ p: [cx, (under + footY) / 2, s.z - o], size: [b.x1 - b.x0 + 0.8, under - footY, 0.3], kind: 'abutment' })
  return out
}

/** Logs fallen into the bed, lying along it: cover down in the ditch. [x0, x1, off the middle line, radius] */
export const CREEK_LOGS = Object.freeze(
  [[-34.0, -29.2, 0.7, 0.34], [24.6, 28.6, -0.6, 0.3], [-1.0, 1.8, 0.5, 0.28]].map(([x0, x1, o, r]) => {
    const at = (x) => {
      const s = creekSection(x)
      const z = s.z - (s.shift + o)
      return [x, brambleGroundY(x, z) + r * 0.75, z]
    }
    return { a: at(x0), b: at(x1), r }
  }),
)
for (const l of CREEK_LOGS) add({ type: 'creekLog', ...l })

/* ---------------------------------------------------------------------------
 * The tank, the fuel tank, wrecks
 * ------------------------------------------------------------------------- */

/** The burnt-out tank on the farm track, still burning. */
export const TANK = Object.freeze({ length: 6.6, width: 3.2, hull: 1.35, turret: 1.15 })
add({ type: 'tank', p: [5.4, 0, -2.0], rotY: 0.42, fire: [0.3, 2.3, -0.4] })

/** The fuel tank beside the farmhouse: a horizontal drum on concrete cradles. */
export const FUEL_TANK = Object.freeze({ r: 1.25, length: 5.6, lift: 0.5 })
add({ type: 'fuelTank', p: [-34.3, 0, 4.9], rotY: 0.05 })

add({ type: 'carWreck', p: [-37.9, 0, -31.4], rotY: 0.6 })
add({ type: 'car', model: 'sedan', color: '#5d6f5a', p: [-15.4, 0, 23.8], rotY: 1.75, wreck: true })
add({ type: 'car', model: 'pickup', color: '#7a5a3a', p: [23.0, 0, -4.0], rotY: 0.2, wreck: true })
add({ type: 'car', model: 'wagon', color: '#8a8a7a', p: [30.2, 0, 23.0], rotY: -1.4, wreck: true })

/* ---------------------------------------------------------------------------
 * Roads and tracks (ground only: the renderer draws them)
 * ------------------------------------------------------------------------- */

export const ROADS = Object.freeze([
  // The road along the south of the town.
  { width: 6.0, points: [[-54.5, 26.0], [-37.1, 23.0], [-18.6, 20.1], [0, 18.8], [18.6, 19.3], [37.1, 21.0], [54.5, 18.1]] },
  // The farm track north from the road, past the tank, over the bridge, to the field.
  { width: 4.4, points: [[2.5, 19.1], [3.7, 7.4], [5.4, -2.5], [6.0, -8.0], [6.0, -23.5], [4.6, -31.0], [3.8, -54.5]] },
  // To the farmhouse, north of the ruin.
  { width: 3.2, points: [[-27.2, -3.5], [-18.6, -6.9], [-7.4, -8.9], [5.0, -7.7]] },
  // To the barn.
  { width: 3.4, points: [[5.9, -5.7], [14.9, -4.2], [22.3, -2.5], [29.7, -2.5]] },
])

/* ---------------------------------------------------------------------------
 * Fences and hedges
 * ------------------------------------------------------------------------- */

/** Post-and-rail fences: [ax, az, bx, bz]. Movement only (shots go through the rails). */
export const RAIL_FENCES = Object.freeze([
  // Round the field, with gaps to get in.
  [9.0, -22.8, 17.0, -22.8],
  [20.2, -22.8, 34.0, -22.8],
  [37.2, -22.8, 47.0, -22.8],
  [8.6, -50.0, 8.6, -38.4],
  [8.6, -35.2, 8.6, -23.0],
  // Paddocks in the meadow and by the houses.
  [-44.6, -39.6, -29.7, -39.6],
  [-49.5, 14.9, -37.1, 14.9],
  [39.6, 14.9, 49.5, 14.9],
  [-13.6, 26.5, -8.0, 26.5],
])
for (const [ax, az, bx, bz] of RAIL_FENCES) add({ type: 'railFence', a: [ax, az], b: [bx, bz] })

/** Overgrown hedges: [x, z, length, rotY]. */
const hedges = [
  [-38.9, -23.0, 8.0, 0],
  [-44.6, -32.2, 6.0, Math.PI / 2],
  [-14.9, -33.4, 8.0, 0.3],
  [17.3, 11.1, 7.0, 0],
  [-29.7, 14.1, 6.0, 0],
  [32.2, 14.4, 6.0, 0],
  [-3.0, -26.4, 6.0, -0.2],
  [29.0, 33.0, 5.0, Math.PI / 2],
]
export const HEDGES = Object.freeze(hedges.map(([x, z, length, rotY]) => ({ p: [x, 0, z], length, rotY })))
for (const h of HEDGES) add({ type: 'hedge', ...h })

/** Corrugated tin fences round the garage yard: [ax, az, bx, bz, h]. */
export const TIN_FENCES = Object.freeze([
  [4.2, 29.2, 4.2, 38.0, 2.3],
  [-6.6, 38.4, -1.2, 38.4, 2.3],
])
for (const [ax, az, bx, bz, h] of TIN_FENCES) add({ type: 'tinFence', a: [ax, az], b: [bx, bz], h })

/* ---------------------------------------------------------------------------
 * Cover and clutter
 * ------------------------------------------------------------------------- */

export const SANDBAGS = Object.freeze([
  [-9.1, -10.2, -6.1, -10.1, 5],
  [17.6, 1.1, 20.2, 1.9, 5],
  [-48.7, -8.9, -46.1, -8.9, 5],
  [46.1, -9.2, 48.7, -9.2, 5],
  [-2.2, 24.3, 0.4, 24.5, 4],
  [-23.2, -23.6, -20.6, -24.0, 4],
])
for (const [ax, az, bx, bz, layers] of SANDBAGS) add({ type: 'sandbags', a: [ax, az], b: [bx, bz], layers })

const crates = [
  [-30.9, -7.1, 1.1, 1.0, 1.1, 0.3],
  [26.7, -7.7, 1.2, 1.1, 1.2, -0.2],
  [-6.6, 3.1, 1.0, 1.0, 1.0, 0.4],
  [10.6, 25.3, 1.0, 0.9, 1.0, 0.1],
  [-45.1, 25.5, 1.1, 1.0, 1.1, 0.2],
  [45.3, 24.8, 1.0, 1.0, 1.0, -0.3],
  [-12.6, 13.0, 1.1, 1.0, 1.1, 0.5],
  [27.6, 9.0, 1.0, 0.9, 1.0, 0.2],
]
export const CRATES = Object.freeze(crates.map(([x, z, w, h, d, rotY, y = 0]) => ({ p: [x, y, z], size: [w, h, d], rotY })))
for (const c of CRATES) add({ type: 'crate', ...c })

const barrels = [
  ['drums', -25.5, 5.0, 0.3],
  ['drums', 28.5, -9.4, 0.6],
  ['stack', 7.4, 33.9, 0.2],
  ['drums', -38.4, 45.6, 0.4],
  ['stack', -24.0, 11.4, 0.1],
]
export const BARRELS = Object.freeze(barrels.map(([kind, x, z, rotY]) => ({ kind, p: [x, 0, z], rotY })))
for (const b of BARRELS) add({ type: 'barrels', ...b })

add({ type: 'tyres', p: [-4.2, 0, 26.0] })
add({ type: 'tyres', p: [25.6, 0, -9.4] })
add({ type: 'oilDrums', p: [-10.9, 0, 37.6] })

export const BRAMBLE_AMMO = Object.freeze([
  { p: [-21.8, 0, -45.0], radius: 1.7, cooldown: 20, rotY: 0 },
  { p: [41.6, 0, 47.7], radius: 1.7, cooldown: 20, rotY: 0 },
])
for (const a of BRAMBLE_AMMO) add({ type: 'ammoCrate', p: a.p, size: [1.0, 0.6, 0.6], rotY: a.rotY })

/** Power poles up the farm track and along the road, wires between them. */
export const BR_POWER_LINES = Object.freeze([
  [[0.8, -47.0], [0.8, -28.0], [0.6, -4.6], [8.6, 6.6], [-2.5, 14.9]],
  [[-47.0, 16.6], [-26.5, 15.6], [-12.4, 14.9], [-2.5, 14.9], [14.9, 14.9], [35.2, 15.6], [48.3, 16.3]],
])
// One pole where two lines meet.
const poles = new Map()
for (const line of BR_POWER_LINES) for (const [x, z] of line) poles.set(`${x}:${z}`, [x, z])
for (const [x, z] of poles.values()) add({ type: 'pole', p: [x, 0, z] })
add({ type: 'powerLines' })

/* ---------------------------------------------------------------------------
 * Trees, bushes, ivy and grass
 * ------------------------------------------------------------------------- */

/** Distance from (x, z) to a polyline of [x, z]. */
function distToPath(points, x, z) {
  let best = Infinity
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)))
    best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t))
  }
  return best
}

/** Rectangles to keep the trees out of: [x0, x1, z0, z1] (buildings, the field, the spawns, the structures). */
const KEEP_CLEAR = [
  ...HOUSES.map((h) => [h.x0 - 2.2, h.x1 + 2.2, h.z0 - 2.2, h.z1 + 2.2]),
  ...SHACKS.map((s) => [s.x0 - 1.8, s.x1 + 1.8, s.z0 - 1.8, s.z1 + 1.8]),
  [FIELD.x0 + 0.5, FIELD.x1, FIELD.z0, FIELD.z1 - 0.5],
  [-11, 1, -43, -31],
  [-12.4, -2.4, -4.9, 6.1],
  [0, 11, -7, 3],
  [-38, -30.5, 2.5, 7.5],
  [BOARDWALK.x0 - 1.5, BOARDWALK.x1 + 1.5, BOARDWALK.z0 - 1.5, BOARDWALK.z1 + 1.5],
  [BRIDGE.x0 - 1.5, BRIDGE.x1 + 1.5, BRIDGE.z0 - 1.5, BRIDGE.z1 + 1.5],
  [-52, -41.5, -9, 14],
  [43.5, 52, -9, 14],
  [-33, -23, -31, -21.5],
]

/** Fences, hedges and sandbags as segments [a, b, half thickness]; everything else on the ground as [x, z, radius]. */
const OBSTACLES = {
  lines: [
    ...RAIL_FENCES.map(([ax, az, bx, bz]) => [[ax, az], [bx, bz], 0.1]),
    ...SANDBAGS.map(([ax, az, bx, bz]) => [[ax, az], [bx, bz], 0.35]),
    ...TIN_FENCES.map(([ax, az, bx, bz]) => [[ax, az], [bx, bz], 0.1]),
    ...HEDGES.map((h) => {
      const dx = (Math.cos(h.rotY) * h.length) / 2
      const dz = (-Math.sin(h.rotY) * h.length) / 2
      return [[h.p[0] - dx, h.p[2] - dz], [h.p[0] + dx, h.p[2] + dz], 0.5]
    }),
  ],
  points: entities.filter((e) => e.p && !['house', 'shack', 'ruin'].includes(e.type)).map((e) => [e.p[0], e.p[2], e.type === 'tank' ? 3.6 : e.type.startsWith('car') ? 2.4 : 1.0]),
}
/** Too close to something on the ground for a tree. */
function crowded(x, z) {
  if (OBSTACLES.points.some(([px, pz, r]) => Math.hypot(px - x, pz - z) < r + 0.9)) return true
  return OBSTACLES.lines.some(([a, b, t]) => distToPath([a, b], x, z) < t + 0.9)
}

/** Where a tree may stand: off the roads and the creek, clear of buildings, fences, props and each other. */
function placeTrees() {
  const rand = seededRandom(5307)
  const out = []
  const H = BRAMBLE_HALF - 1.2
  for (let tries = 0; tries < 6000 && out.length < 92; tries++) {
    const x = (rand() * 2 - 1) * H
    const z = (rand() * 2 - 1) * H
    if (KEEP_CLEAR.some(([a, b, c, d]) => x > a && x < b && z > c && z < d)) continue
    if (ROADS.some((r) => distToPath(r.points, x, z) < r.width / 2 + 1.6)) continue
    if (inCreek(x, z, 1.4)) continue
    if (crowded(x, z)) continue
    if (out.some((t) => Math.hypot(t.p[0] - x, t.p[2] - z) < 5.2)) continue
    const big = rand() < 0.35
    out.push({ p: [+x.toFixed(2), 0, +z.toFixed(2)], h: big ? 12 + rand() * 4 : 7.5 + rand() * 3.5, seed: Math.floor(rand() * 1e6), autumn: rand() < 0.22 })
  }
  return out
}
export const TREES = Object.freeze(placeTrees())
for (const t of TREES) add({ type: 'tree', ...t })

add({ type: 'undergrowth', seed: 911 })
add({ type: 'ivy', seed: 2211 })

/* ---------------------------------------------------------------------------
 * Ladders: up the water tower
 * ------------------------------------------------------------------------- */

export const BRAMBLE_LADDERS = Object.freeze([
  ladder([WATER_TOWER.p[0], WATER_TOWER.p[2] + WATER_TOWER.ringOut + 0.05], [0, 0, -1], WATER_TOWER.deck, [0.3, 0.32], 0.4),
])
for (const l of BRAMBLE_LADDERS) add({ type: 'ladder', foot: l.foot, dir: l.exitDir, topY: l.topY, base: l.base, rungs: l.rungs })
export const brambleLadderAt = (x, y, z) => ladderIn(BRAMBLE_LADDERS, x, y, z)

/* ---------------------------------------------------------------------------
 * Furniture: low cover in the rooms. [kind, x, z, w, h, d, rotY, y]
 * ------------------------------------------------------------------------- */

const furniture = [
  ['table', -32.3, -4.1, 1.4, 0.78, 0.9, 0],
  ['sofa', -38.3, 0.1, 2.0, 0.8, 0.8, Math.PI],
  ['bed', -31.3, -3.1, 1.4, 0.5, 2.0, 0, 3.2],
  ['table', -37.7, -2.3, 1.2, 0.78, 0.8, 0.3, 3.2],
  ['crates', 33.5, -6.8, 1.2, 1.1, 1.2, 0.1],
  ['crates', 40.7, 5.4, 1.2, 1.1, 1.2, 0.3],
  ['bales', 34.1, 4.0, 1.6, 1.0, 1.0, 0.2, 3.6],
  ['bales', 39.7, -6.4, 1.6, 1.0, 1.0, -0.3, 3.6],
  ['table', 20.0, 33.3, 1.4, 0.78, 0.9, 0],
  ['bed', 17.6, 38.5, 1.4, 0.5, 2.0, Math.PI / 2, 3.2],
  ['table', 39.2, 32.1, 1.4, 0.78, 0.9, 0],
  ['sofa', 38.0, 38.1, 2.0, 0.8, 0.8, 0, 3.2],
  ['table', -21.7, 33.9, 1.2, 0.78, 0.8, 0.2],
  ['sofa', -43.5, 38.3, 2.0, 0.8, 0.8, 0],
  ['bench', 0.4, 36.6, 2.4, 0.9, 0.7, 0],
]
export const BRAMBLE_FURNITURE = Object.freeze(furniture.map(([kind, x, z, w, h, d, rotY = 0, y = 0]) => ({ kind, p: [x, y, z], size: [w, h, d], rotY })))
add({ type: 'furniture' })

/* ---------------------------------------------------------------------------
 * Boundary and backdrop
 * ------------------------------------------------------------------------- */

add({ type: 'brPerimeter' })
add({ type: 'brBackdrop' })

export const BRAMBLE_ENTITIES = Object.freeze(entities)

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

const COLLIDER_BUILDERS = {
  house: (e) => houseColliders(brambleHouseOf(e.id)),
  shack: (e) => shackColliders(brambleShackOf(e.id)),
  ruin: (e) => ruinPieces(RUINS[e.i]).map((s) => boxC(s.p, s.size, yawQ(s.yaw))),
  rubble: (e) => [cylC([e.p[0], e.h / 2, e.p[2]], e.r * 0.8, e.h)],
  hay: (e) => (e.kind === 'round' ? [groundBox(e.p, [1.2, 1.3, 1.4], e.rotY)] : [groundBox(e.p, [2.2, 1.0, 1.1], e.rotY)]),
  tractor: (e) => localBoxes(e, [[0, 0, 0, TRACTOR.width, 1.55, TRACTOR.length], [0, 1.55, 0.6, 1.1, 1.0, 1.2]]),
  waterTower: waterTowerColliders,
  boardwalk: boardwalkColliders,
  bridge: (e) => bridgePieces(e).map((b) => boxC(b.p, b.size)),
  creekLog: (e) => [segmentCyl(e.a, e.b, e.r)],
  brGround: () => {
    const g = brambleGround()
    return [meshC(g.positions, [...g.grass, ...g.bank, ...g.bed])]
  },
  tank: (e) => {
    const turret = yawOffset(e.p, 0, -0.4, e.rotY)
    return [...localBoxes(e, [[0, 0, 0, TANK.width, TANK.hull, TANK.length]]), cylC([turret[0], TANK.hull + TANK.turret / 2, turret[2]], 1.25, TANK.turret)]
  },
  fuelTank: (e) => [
    cylC([e.p[0], FUEL_TANK.lift + FUEL_TANK.r, e.p[2]], FUEL_TANK.r, FUEL_TANK.length, quatMultiply(quatFromEuler(0, e.rotY, 0), quatFromEuler(0, 0, Math.PI / 2))),
    ...localBoxes(e, [[-FUEL_TANK.length * 0.3, 0, 0, 0.5, FUEL_TANK.lift + 0.4, 2.0], [FUEL_TANK.length * 0.3, 0, 0, 0.5, FUEL_TANK.lift + 0.4, 2.0]]),
  ],
  car: carColliders,
  carWreck: (e) => [groundBox(e.p, [1.8, 1.45, 4.3], e.rotY)],
  railFence: (e) => [lineBox(e.a, e.b, 1.1, 0.12, 0, MOVE_ONLY)],
  hedge: (e) => [groundBox(e.p, [e.length, 1.45, 0.95], e.rotY)],
  tinFence: (e) => [lineBox(e.a, e.b, e.h, 0.1)],
  sandbags: (e) => [lineBox(e.a, e.b, 0.2 + e.layers * 0.17, 0.62)],
  crate: (e) => [groundBox(e.p, e.size, e.rotY)],
  barrels: (e) => (e.kind === 'stack' ? [groundBox(e.p, [1.75, 2.05, 1.15], e.rotY)] : [groundBox(e.p, [1.5, 0.95, 1.3], e.rotY)]),
  tyres: (e) => [cylC([e.p[0], 0.5, e.p[2]], 0.48, 1.0)],
  oilDrums: (e) => [groundBox(e.p, [1.4, 0.95, 1.4], 0.2)],
  ammoCrate: (e) => [groundBox(e.p, e.size, e.rotY)],
  pole: (e) => [cylC([e.p[0], 3.5, e.p[2]], 0.14, 7.0)],
  tree: (e) => [cylC([e.p[0], 3.0, e.p[2]], e.h > 11 ? 0.34 : 0.24, 6.0)],
  furniture: () => BRAMBLE_FURNITURE.filter((f) => f.kind !== 'bed').map((f) => groundBox(f.p, f.size, f.rotY)),
  brPerimeter: () => {
    const E = BRAMBLE_HALF + 1.5
    const out = boundaryColliders(BRAMBLE_HALF, BRAMBLE_HALF)
    // The invisible walls stand on the ground: under them where the creek runs out.
    for (const s of [-1, 1]) out.push(boxC([s * (BRAMBLE_HALF + 0.4), -2, creekZ(s * CREEK_END)], [1.2, 4, CREEK.top + 4]))
    // The ground past the mesh's edge, and a floor under everything.
    for (const s of [-1, 1]) {
      out.push(boxC([0, -1, s * (E + 50)], [E * 2 + 200, 2, 100]))
      out.push(boxC([s * (E + 50), -1, 0], [100, 2, E * 2]))
    }
    out.push(boxC([0, -4, 0], [E * 2, 2, E * 2]))
    return out
  },
}

let colliderCache = null

/** Flat, cached list of every collider in the map. Identical on client and server. */
export function buildBrambleColliders() {
  if (colliderCache) return colliderCache
  const out = []
  for (const e of BRAMBLE_ENTITIES) {
    const build = COLLIDER_BUILDERS[e.type]
    if (build) out.push(...build(e))
  }
  colliderCache = Object.freeze(out)
  return colliderCache
}

/* ---------------------------------------------------------------------------
 * Spawns
 * ------------------------------------------------------------------------- */

const spawn = (x, z, faceX = 0, faceZ = 0) => ({ p: [x, 0, z], yaw: Math.atan2(-(faceX - x), -(faceZ - z)) })

export const BRAMBLE_SPAWNS = Object.freeze({
  // TDM: west of the farmhouse (Alpha), east of the barn (Bravo). The
  // farmhouse and the barn stand close in front, so the spawns face out along
  // the yards and through the gaps, not at a wall.
  [TEAMS.ALPHA]: [spawn(-49.0, -6.6, -16, -24), spawn(-47.5, -2.5, -33, 32), spawn(-49.3, 2.5, -20, 25), spawn(-47.3, 7.4, -14, 24), spawn(-49.0, 11.6, -16, 29), spawn(-44.8, -7.2, -18, -21)],
  [TEAMS.BRAVO]: [spawn(49.0, -6.6, 28, -38), spawn(47.5, -2.5, 43, 35), spawn(49.3, 2.5, 26, 32), spawn(47.3, 7.4, 10, 11), spawn(49.0, 11.6, 12, 10), spawn(46.4, -7.4, 24, -40)],
  ffa: [
    spawn(-44.6, -47.0),
    spawn(-9.9, -47.0, -9, -17),
    spawn(12.0, -5.6, -11, 14),
    spawn(48.3, -47.0),
    spawn(48.8, 24.8),
    spawn(24.8, 48.3, 33, 12),
    spawn(-7.4, 46.6, -24, 14),
    spawn(-48.8, 25.3),
    spawn(-48.3, -26.0),
    spawn(-17.3, 7.4, 19, 19),
  ],
})

/* ---------------------------------------------------------------------------
 * Bot navigation: grid + doorways + the stairs in the houses and the barn
 * ------------------------------------------------------------------------- */

/** Points either side of every ground-floor doorway. */
function doorNodes() {
  const out = []
  const push = (o, k) => {
    const [a, c] = o.at
    const n = o.axis === 'x' ? [0, 1] : [1, 0]
    for (const s of [-1, 1]) out.push([a + n[0] * s * k, 0, c + n[1] * s * k])
  }
  for (const h of HOUSES) for (const o of houseOpenings(h)) if (o.door && o.floor === 0) push(o, o.side === 'inner' ? 0.8 : 0.9)
  for (const s of SHACKS) for (const o of shackOpenings(s)) if (o.door && o.floor === 0) push(o, 0.9)
  return out
}

/** Nodes along a straight flight from its foot (`before` metres off it) to its top and out onto the floor. */
function stairChain(st, before = 1.0, after = 1.0) {
  const dx = st.top[0] - st.bottom[0]
  const dz = st.top[2] - st.bottom[2]
  const run = Math.hypot(dx, dz)
  const at = (f, y) => [+(st.bottom[0] + (dx * f)).toFixed(2), +y.toFixed(2), +(st.bottom[2] + (dz * f)).toFixed(2)]
  const rise = st.top[1] - st.bottom[1]
  return [at(-before / run, 0), at(0.12, rise * 0.12), at(0.5, rise * 0.5), at(0.88, rise * 0.88), at(1 + after / run, st.top[1])]
}

/** Nodes over each upstairs floor, clear of the walls, the stairwell, the closets and the furniture. */
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
          if (BRAMBLE_FURNITURE.some((f) => Math.abs(f.p[1] - y) < 0.01 && f.kind !== 'bed' && Math.abs(x - f.p[0]) < Math.max(f.size[0], f.size[2]) / 2 + 0.45 && Math.abs(z - f.p[2]) < Math.max(f.size[0], f.size[2]) / 2 + 0.45)) continue
          out.push([+x.toFixed(2), y, +z.toFixed(2)])
        }
      }
    }
    // Either side of the upstairs inner doors.
    for (const o of houseOpenings(h)) {
      if (!o.door || o.floor === 0 || o.side !== 'inner') continue
      const [a, c] = o.at
      const n = o.axis === 'x' ? [0, 1] : [1, 0]
      for (const k of [-1, 1]) out.push([+(a + n[0] * k * 0.75).toFixed(2), y, +(c + n[1] * k * 0.75).toFixed(2)])
    }
  }
  return out
}

const st = (id) => brambleHouseOf(id).stairs[0]

export const BRAMBLE_NAV = Object.freeze({
  // Deep enough to find the creek bed.
  grid: { spacing: 2.5, half: BRAMBLE_HALF - 1.2, depth: 6 },
  root: [0, 18.8],
  linkUpper: true,
  // Ground links may climb this much per metre (the creek's banks).
  climb: 0.62,
  extra: Object.freeze([
    ...doorNodes(),
    // On and off the boardwalk and the bridge.
    ...[BOARDWALK, BRIDGE].flatMap((w) => {
      const x = +((w.x0 + w.x1) / 2).toFixed(2)
      const y = w.y ?? w.top
      const len = w.z1 - w.z0
      return [[x, 0, w.z0 - 1.0], ...[0.12, 0.37, 0.63, 0.88].map((f) => [x, y, +(w.z0 + len * f).toFixed(2)]), [x, 0, w.z1 + 1.0]]
    }),
  ]),
  chains: Object.freeze([
    stairChain(st('br-farmhouse'), 1.2),
    stairChain(st('br-barn'), 1.2),
    stairChain(st('br-houseS'), 0.7),
    stairChain(st('br-houseSE'), 0.7),
  ]),
  upper: Object.freeze(upperNodes()),
})
