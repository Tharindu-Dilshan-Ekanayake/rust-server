/**
 * "Hollow Creek" — a small town on Halloween night, as data.
 *
 * Main Street runs east-west through the middle, round a roundabout whose
 * island holds the town's Halloween statue (a pumpkin-headed witch over a
 * glowing cauldron); two lanes cross it north-south. North of the roundabout:
 * the stone church with its bell tower and, beside it, the graveyard behind an
 * iron fence. South of it: the park, where a creek winds under a footbridge
 * past the red barn (burning inside) and an old wooden watchtower on fire at
 * the top. Two family houses, two storeys each, stand on the north side, west
 * (Alpha) and east (Bravo), their backyards along the edges; cottages sit in
 * the south-west and south-east lots. Pumpkins, candles, string lights and
 * street lamps light the place; everything else is moonlight.
 *
 * Coordinates are metres. +X is east, -Z north, +Y up, ground y = 0. The arena
 * is 80 x 80 m. Like the other maps, everything is listed once as entities; the
 * client draws them and BOTH sides build their physics from
 * `buildHollowColliders()`. Houses use the same description as Atomic Acres'
 * (shared/mapAcres.js), so the same code builds their walls, colliders and art.
 */
import { TEAMS } from './constants.js'
import { CAR_MODELS, HOUSES as ACRES_HOUSES, ACRES_NAV, houseColliders, houseOpenings } from './mapAcres.js'
import { boundaryColliders, boxC, cylC, groundBox, ladder, ladderIn, MOVE_ONLY, rampBox, yawOffset, yawQ } from './mapKit.js'

export const HOLLOW_NAME = 'Hollow Creek'
export const HOLLOW_HALF = 40

const entities = []
const add = (e) => {
  entities.push(e)
  return e
}

/* ---------------------------------------------------------------------------
 * Streets (ground only: the renderer draws them)
 * ------------------------------------------------------------------------- */

/** Main Street (east-west), the two lanes (north-south), sidewalks, the roundabout. */
export const STREETS = Object.freeze({
  main: { z0: -4, z1: 4 },
  lanes: Object.freeze([{ x0: -19, x1: -14 }, { x0: 14, x1: 19 }]),
  walk: 2,
  circle: { r: 9.5, island: 4.6, walk: 11.5, curb: 0.18 },
})
add({ type: 'hollowGround' })

/** The creek: a winding centre line [x, z] and its width (water at ground level, a shallow ford). */
export const CREEK = Object.freeze({
  width: 3.2,
  points: Object.freeze([
    [-41, 27.6], [-36, 26.4], [-31, 26.0], [-26, 27.0], [-21, 26.6], [-14, 26.2], [-9, 27.2], [-4, 26.8], [0, 25.8],
    [4, 25.6], [8, 26.6], [14, 26.6], [19, 26.2], [24, 25.6], [29, 26.6], [34, 27.4], [41, 26.6],
  ]),
})

/** Where the creek's centre line crosses x = at (straight between its points). */
export function creekZ(at) {
  const pts = CREEK.points
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]
    const [bx, bz] = pts[i]
    if ((ax - at) * (bx - at) <= 0 && ax !== bx) return az + ((at - ax) / (bx - ax)) * (bz - az)
  }
  return pts[0][1]
}

/**
 * Culverts: the creek runs under each lane through a pipe; a concrete headwall
 * stands at both edges of the lane, facing out ({ x, z, face: -1 west / 1 east }).
 */
export const CULVERTS = Object.freeze(
  STREETS.lanes.flatMap((l) => [
    { x: l.x0 - STREETS.walk - 0.12, face: -1 },
    { x: l.x1 + STREETS.walk + 0.12, face: 1 },
  ]).map((c) => ({ ...c, z: creekZ(c.x), length: 4.4, h: 0.32 })),
)
add({ type: 'culverts' })

/* ---------------------------------------------------------------------------
 * Houses (the Atomic Acres description: see shared/mapAcres.js)
 * ------------------------------------------------------------------------- */

const door = (from, to, top = 2.2) => ({ from, to, bottom: 0, top, door: true })
const win = (from, to, bottom = 1.0, top = 2.1) => ({ from, to, bottom, top })
/** A wide opening with its door rolled (or slid) away. */
const bay = (from, to, top) => ({ from, to, bottom: 0, top, door: true, garage: true })

/** An Atomic Acres house moved by (dx, dz), with a new id and look. */
function moved(src, id, dx, dz, extra) {
  const along = (list, by) => (list ?? []).map((o) => ({ ...o, from: o.from + by, to: o.to + by }))
  const walls = (w) => ({ n: along(w?.n, dx), s: along(w?.s, dx), w: along(w?.w, dz), e: along(w?.e, dz) })
  const inner = (list) =>
    list?.map((iw) =>
      iw.axis === 'z'
        ? { ...iw, at: iw.at + dx, from: iw.from + dz, to: iw.to + dz, openings: along(iw.openings, dz) }
        : { ...iw, at: iw.at + dz, from: iw.from + dx, to: iw.to + dx, openings: along(iw.openings, dx) },
    )
  const rect = (r) => r && { ...r, x0: r.x0 + dx, x1: r.x1 + dx, z0: r.z0 + dz, z1: r.z1 + dz }
  const pt = (p) => [p[0] + dx, p[1], p[2] + dz]
  const porchBy = src.porch && (src.porch.side === 'e' || src.porch.side === 'w' ? dz : dx)
  return {
    ...src,
    id,
    x0: src.x0 + dx,
    x1: src.x1 + dx,
    z0: src.z0 + dz,
    z1: src.z1 + dz,
    floors: src.floors.map((f) => ({ ...f, walls: walls(f.walls), inner: inner(f.inner), kitchen: rect(f.kitchen) })),
    slabs: src.slabs?.map(rect),
    stairs: src.stairs?.map((st) => ({ ...st, bottom: pt(st.bottom), top: pt(st.top) })),
    rails: src.rails?.map(([a, b, c, d]) => [a + dx, b + dz, c + dx, d + dz]),
    closets: src.closets?.map(rect),
    chimney: rect(src.chimney),
    carport: src.carport && { ...rect(src.carport), posts: src.carport.posts.map(([x, z]) => [x + dx, z + dz]) },
    garage: src.garage && { ...rect(src.garage), walls: walls(src.garage.walls) },
    porch: src.porch && { ...src.porch, from: src.porch.from + porchBy, to: src.porch.to + porchBy },
    ...extra,
  }
}

const acresHouse = (id) => ACRES_HOUSES.find((h) => h.id === id)
/** Where the two family houses moved to, from their Atomic Acres spots. */
const WEST_SHIFT = [-4, -18]
const EAST_SHIFT = [4, -18]

export const HOUSES = Object.freeze([
  // Alpha's house (west): slate-grey siding, a darker storey above, black shutters.
  moved(acresHouse('yellow'), 'hc-west', ...WEST_SHIFT, {
    look: { lower: 'ash', upper: 'dusk', trim: 'bone', roof: 'slate', base: 'stone', shutters: 'black', door: '#5a1e1a', glow: true, curtains: '#e8a24a', interior: ['#c9b89a', '#b7a48a'], lit: 0.2 },
  }),
  // Bravo's house (east): moss-green siding over brick, cream above.
  moved(acresHouse('green'), 'hc-east', ...EAST_SHIFT, {
    look: { lower: 'moss', upper: 'oat', trim: 'bone', roof: 'charcoal', base: 'brick', shutters: 'black', door: '#2a3a2c', glow: true, curtains: '#f0b45a', interior: ['#cdbd9c', '#b9a98c'], lit: 0.2 },
  }),
  {
    // The church: one tall stone hall, the gable to the street, a porch of steps.
    id: 'hc-church',
    x0: -5,
    x1: 5,
    z0: -33,
    z1: -17,
    look: { lower: 'stone', trim: 'walnut', roof: 'slate', door: '#3a2216', curtains: null, glow: false, interior: ['#9d9282'], lit: 0.2 },
    floors: [
      {
        y: 0,
        h: 6.0,
        walls: {
          s: [door(-1.2, 1.2, 3.2), win(-3.9, -2.9, 1.8, 4.6), win(2.9, 3.9, 1.8, 4.6)],
          n: [door(-0.6, 0.6, 2.4)],
          w: [win(-30.4, -29.2, 1.8, 4.6), win(-26.6, -25.4, 1.8, 4.6), door(-19.6, -18.4, 2.4)],
          e: [win(-30.4, -29.2, 1.8, 4.6), win(-26.6, -25.4, 1.8, 4.6), win(-23.0, -21.8, 1.8, 4.6)],
        },
        floor: 'wood',
      },
    ],
    roof: { ridge: 12.0, overhang: 0.5 },
    porch: { side: 's', from: -2.3, to: 2.3, depth: 1.8 },
  },
  {
    // The red barn: a hayloft over the floor, big doors at both gable ends.
    id: 'hc-barn',
    x0: 3,
    x1: 12,
    z0: 8,
    z1: 18,
    look: { lower: 'barn', upper: 'barn', trim: 'bone', roof: 'slate', base: 'stone', door: '#5a3e2a', curtains: null, interior: ['#7a5a40', '#6e5038'], lit: 0.2 },
    floors: [
      {
        y: 0,
        h: 3.2,
        walls: {
          s: [bay(5.6, 9.4, 3.0)],
          n: [bay(6.4, 8.6, 2.6)],
          w: [door(12.4, 13.6), win(15.6, 16.8, 1.1, 2.1)],
          e: [win(16.2, 17.2, 1.1, 2.1)],
        },
        floor: 'plank',
      },
      {
        y: 3.4,
        h: 2.4,
        walls: {
          s: [door(6.6, 8.4, 1.9)],
          n: [win(7.0, 8.0, 0.8, 1.8)],
          w: [win(12.6, 13.6, 0.9, 1.8)],
          e: [],
        },
        floor: 'plank',
      },
    ],
    // The loft, leaving the stairwell open along the east wall.
    slabs: [
      { x0: 3.2, x1: 10.7, z0: 8.2, z1: 17.8 },
      { x0: 10.7, x1: 11.8, z0: 15.6, z1: 17.8 },
      { x0: 10.7, x1: 11.8, z0: 8.2, z1: 9.8 },
    ],
    stairs: [{ bottom: [11.25, 0, 10.2], top: [11.25, 3.4, 15.8], width: 1.0 }],
    rails: [[10.7, 9.8, 10.7, 15.6], [10.7, 9.8, 11.8, 9.8]],
    closets: [{ x0: 10.75, x1: 11.75, z0: 12.6, z1: 15.6, h: 1.4 }, { x0: 10.75, x1: 11.75, z0: 11.0, z1: 12.6, h: 0.45 }],
    roof: { ridge: 8.8, overhang: 0.5 },
  },
  {
    // South-west cottage: plum siding, a lamp-lit porch onto the west lane.
    id: 'hc-cottageW',
    x0: -35,
    x1: -26,
    z0: 10,
    z1: 18,
    look: { lower: 'plum', trim: 'bone', roof: 'charcoal', base: 'stone', shutters: 'black', door: '#e07a2a', glow: true, curtains: '#e89a3c', interior: ['#c4a98e'], lit: 0.2 },
    floors: [
      {
        y: 0,
        h: 2.9,
        walls: {
          e: [door(13.0, 14.2), win(10.8, 12.2), win(15.4, 17.0)],
          w: [door(14.6, 15.8), win(11.0, 12.6)],
          n: [win(-33.2, -31.6), win(-28.8, -27.4)],
          s: [win(-33.0, -31.2), door(-29.2, -28.0)],
        },
        inner: [{ axis: 'z', at: -30.5, from: 10.2, to: 17.8, openings: [door(13.4, 14.6)] }],
        floor: 'wood',
      },
    ],
    roof: { ridge: 5.6, overhang: 0.5 },
    porch: { side: 'e', from: 12.2, to: 15.0, depth: 1.4 },
    chimney: { x0: -31.4, x1: -30.2, z0: 17.9, z1: 18.8, top: 6.2 },
  },
  {
    // South-east cottage: the mirror, in teal-grey.
    id: 'hc-cottageE',
    x0: 26,
    x1: 35,
    z0: 10,
    z1: 18,
    look: { lower: 'tealgrey', trim: 'bone', roof: 'slate', base: 'stone', shutters: 'black', door: '#7a2a5a', glow: true, curtains: '#f0a850', interior: ['#bba890'], lit: 0.2 },
    floors: [
      {
        y: 0,
        h: 2.9,
        walls: {
          w: [door(13.0, 14.2), win(10.8, 12.2), win(15.4, 17.0)],
          e: [door(14.6, 15.8), win(11.0, 12.6)],
          n: [win(27.4, 28.8), win(31.6, 33.2)],
          s: [win(31.2, 33.0), door(28.0, 29.2)],
        },
        inner: [{ axis: 'z', at: 30.5, from: 10.2, to: 17.8, openings: [door(13.4, 14.6)] }],
        floor: 'wood',
      },
    ],
    roof: { ridge: 5.6, overhang: 0.5 },
    porch: { side: 'w', from: 12.2, to: 15.0, depth: 1.4 },
    chimney: { x0: 30.2, x1: 31.4, z0: 17.9, z1: 18.8, top: 6.2 },
  },
  ...[
    ['hc-shedW', -39.6, -34.6, 'e', -1],
    ['hc-shedE', 34.6, 39.6, 'w', 1],
  ].map(([id, x0, x1, side, s]) => ({
    // Tool sheds in the far corners: the resupply crates.
    id,
    x0,
    x1,
    z0: -39.6,
    z1: -34.6,
    look: { lower: 'barn', trim: 'bone', roof: 'slate', base: 'concrete', door: '#5a3e2a', curtains: null, interior: ['#9a7a58'], lit: 0.2 },
    floors: [
      {
        y: 0,
        h: 2.5,
        walls: {
          [side]: [door(-38.2, -36.4, 2.2)],
          [side === 'e' ? 'w' : 'e']: [],
          s: [door(s < 0 ? -37.8 : 36.6, s < 0 ? -36.6 : 37.8)],
          n: [win(s < 0 ? -38.4 : 36.8, s < 0 ? -37.2 : 38.0)],
        },
        floor: 'plank',
      },
    ],
    roof: { ridge: 3.9, overhang: 0.4 },
  })),
])
for (const h of HOUSES) add({ type: 'house', id: h.id })

const houseById = Object.fromEntries(HOUSES.map((h) => [h.id, h]))
export const hollowHouseOf = (id) => houseById[id]

/* ---------------------------------------------------------------------------
 * The bell tower, the graveyard and its crypt
 * ------------------------------------------------------------------------- */

/** Bell tower against the church's front corner: a stone shaft, the open belfry, a slate spire. */
export const BELFRY = Object.freeze({ x0: 5.0, x1: 8.6, z0: -20.6, z1: -17.0, belfry: [10.6, 13.4], top: 13.4, spire: 19.6 })
add({ type: 'belfry', ...BELFRY })

/** The graveyard east of the church, behind an iron fence. */
export const GRAVEYARD = Object.freeze({ x0: 6.4, x1: 11.6, z0: -39, z1: -23 })
add({ type: 'graveyardGround', ...GRAVEYARD })

/** Iron fences: [ax, az, bx, bz] (spiked railings, 1.5 m). */
export const IRON_FENCES = Object.freeze([
  // Round the graveyard, gates to the plaza (south), the church (west) and the lane (east).
  [6.4, -39, 11.6, -39],
  [6.4, -23, 7.9, -23], [9.9, -23, 11.6, -23],
  [6.4, -39, 6.4, -28.2], [6.4, -26.2, 6.4, -23],
  [11.6, -39, 11.6, -31.4], [11.6, -29.6, 11.6, -23],
  // Along the churchyard's west side, by the west lane.
  [-11.6, -38.6, -11.6, -30.6], [-11.6, -28.4, -11.6, -16.0],
])
for (const f of IRON_FENCES) add({ type: 'ironFence', a: [f[0], f[1]], b: [f[2], f[3]] })

/** Gate posts (stone piers with a pumpkin on top): [x, z]. */
export const GATE_PIERS = Object.freeze([[7.9, -23], [9.9, -23], [-11.6, -30.6], [-11.6, -28.4]])
for (const [x, z] of GATE_PIERS) add({ type: 'gatePier', p: [x, 0, z] })

/** The crypt at the back of the graveyard. */
export const CRYPT = Object.freeze({ x0: 7.4, x1: 10.6, z0: -38.6, z1: -35.4, h: 2.7 })
add({ type: 'crypt', ...CRYPT })

/** Headstones: [x, z, kind, rotY, tilt]. Kinds: 'round', 'cross', 'obelisk', 'square'. */
const stones = [
  // In rows either side of the path up the middle (x 8.0 - 9.6 stays clear).
  [7.2, -24.8, 'round', 0.05, 0], [10.5, -24.9, 'cross', -0.08, 0.08], [11.0, -26.6, 'square', 0.1, 0],
  [10.4, -27.2, 'round', -0.12, -0.1],
  [6.95, -30.1, 'round', 0.2, 0], [10.85, -30.4, 'cross', -0.1, 0],
  [7.3, -33.4, 'square', 0.04, 0.12], [10.6, -33.3, 'obelisk', 0.1, 0],
  [7.1, -35.0, 'cross', 0.15, -0.14], [11.0, -35.4, 'round', 0, 0],
  // A few round the churchyard.
  [-9.6, -36.8, 'cross', 0.3, 0.1], [-7.4, -37.6, 'round', -0.2, 0], [-10.2, -33.6, 'square', 0.1, 0],
]
export const HEADSTONES = Object.freeze(stones.map(([x, z, kind, rotY, tilt]) => ({ p: [x, 0, z], kind, rotY, tilt })))
add({ type: 'headstones' })

/** Headstone sizes by kind: [w, h, d]. */
export const STONE_SIZE = Object.freeze({ round: [0.62, 0.92, 0.18], cross: [0.62, 1.15, 0.16], obelisk: [0.46, 1.65, 0.46], square: [0.72, 0.78, 0.22] })

/* ---------------------------------------------------------------------------
 * The roundabout's statue, the watchtower, the footbridge
 * ------------------------------------------------------------------------- */

/** The Halloween statue on the island: a stepped plinth, the witch, the cauldron in front. */
export const STATUE = Object.freeze({ p: [0, STREETS.circle.curb, 0], base: [2.0, 0.5], plinth: [1.4, 0.9], body: 0.7, height: 4.2, cauldron: [2.7, 0.62, 0.78] })
add({ type: 'statue' })

/** The watchtower in the park: four legs, a deck with a cabin roof over it, a spire burning at the top. */
export const WATCHTOWER = Object.freeze({ p: [-6.5, 0, 33.4], half: 1.6, deck: 6.0, cabin: 8.3, spire: 11.6, ladder: 'n' })
add({ type: 'watchtower', ...WATCHTOWER, fire: [0, 10.4, 0], rotY: 0 })

const LADDER_DIR = { s: [0, 0, -1], n: [0, 0, 1], e: [-1, 0, 0], w: [1, 0, 0] }
function towerLadderFoot(t) {
  const [cx, , cz] = t.p
  const off = t.half + 0.05
  return { s: [cx, cz + off], n: [cx, cz - off], e: [cx + off, cz], w: [cx - off, cz] }[t.ladder]
}

export const HOLLOW_LADDERS = Object.freeze([ladder(towerLadderFoot(WATCHTOWER), LADDER_DIR[WATCHTOWER.ladder], WATCHTOWER.deck, [0.3, 0.32])])
for (const l of HOLLOW_LADDERS) add({ type: 'ladder', foot: l.foot, dir: l.exitDir, topY: l.topY, base: l.base, rungs: l.rungs })

/** The tower deck's parapet as runs round the deck, open where the ladder arrives. */
export function towerParapet(t = WATCHTOWER) {
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

/** Wooden footbridge over the creek in the park: a hump with rails. */
export const BRIDGE = Object.freeze({ p: [-1.6, 0, 26.0], rotY: 0.12, length: 6.6, width: 1.8, rise: 0.55 })
add({ type: 'bridge', ...BRIDGE })

/** The bridge deck as tilted slabs (up, across, down), in world space. */
export function bridgeSlabs(b = BRIDGE) {
  const q = b.length / 4
  const at = (lz, y) => {
    const o = yawOffset(b.p, 0, lz, b.rotY)
    return [o[0], y, o[2]]
  }
  return [
    rampBox(at(-q, b.rise), at(-q * 2 - 0.15, 0.02), b.width, 0.12),
    rampBox(at(-q, b.rise), at(q, b.rise), b.width, 0.12),
    rampBox(at(q, b.rise), at(q * 2 + 0.15, 0.02), b.width, 0.12),
  ]
}

/* ---------------------------------------------------------------------------
 * The burning hay in the barn, vehicles
 * ------------------------------------------------------------------------- */

add({ type: 'hayPile', p: [4.9, 0, 10.1], rotY: 0.3, fire: [0, 0.5, 0] })

/* Cars and the van: Atomic Acres' models (CAR_MODELS). */
add({ type: 'car', model: 'pickup', color: '#d8d6cf', p: [-15.6, 0, -28.4], rotY: 0.06 })
add({ type: 'car', model: 'van', color: '#4a5a62', p: [15.7, 0, 30.8], rotY: Math.PI - 0.05 })
add({ type: 'car', model: 'wagon', color: '#16161a', p: [17.4, 0, -26.6], rotY: Math.PI + 0.04 })
add({ type: 'car', model: 'coupe', color: '#6a1e22', p: [-17.6, 0, 21.6], rotY: 0.1 })
add({ type: 'car', model: 'sedan', color: 'rust', p: [33.6, 0, 1.6], rotY: 1.28, wreck: true, smoke: [0, 1.0, -1.6] })
add({ type: 'car', model: 'sedan', color: '#3c4650', p: [-25.8, 0, 2.5], rotY: -Math.PI / 2 })

/** A farm cart loaded with hay and pumpkins, left in the street: [length 3.2, width 1.8]. */
add({ type: 'cart', p: [23.6, 0, -2.0], rotY: Math.PI / 2 + 0.1 })

/* ---------------------------------------------------------------------------
 * Fences, hedges, walls
 * ------------------------------------------------------------------------- */

/** Privacy fences round the backyards: [ax, az, bx, bz]. */
export const PRIVACY_FENCES = Object.freeze([
  [-40, -25.8, -36.6, -25.8], [-35.0, -25.8, -34.2, -25.8],
  [-40, -12.4, -36.4, -12.4],
  [36.6, -24.0, 40, -24.0],
  [36.4, -10.6, 40, -10.6], [34.2, -10.6, 34.8, -10.6],
  [-40, 8.2, -36.6, 8.2],
  [36.6, 8.2, 40, 8.2],
])
for (const f of PRIVACY_FENCES) add({ type: 'privacyFence', a: [f[0], f[1]], b: [f[2], f[3]] })

/** Picket fences along the front yards. */
export const PICKET_FENCES = Object.freeze([
  [-21.6, 7.2, -21.6, 11.6], [-21.6, 15.6, -21.6, 20.6],
  [21.6, 7.2, 21.6, 11.6], [21.6, 15.6, 21.6, 20.6],
  [-21.6, -38.6, -21.6, -30.0],
  [21.6, -38.6, 21.6, -33.0],
])
for (const f of PICKET_FENCES) add({ type: 'picketFence', a: [f[0], f[1]], b: [f[2], f[3]] })

/** Low fieldstone walls round the church plaza, gate piers between them. */
export const STONE_WALLS = Object.freeze([
  [-11.4, -15.2, -6.4, -15.2],
  [-11.4, -15.2, -11.4, -12.2],
])
for (const w of STONE_WALLS) add({ type: 'stoneWall', a: [w[0], w[1]], b: [w[2], w[3]], h: 0.8 })

/** Hedges: [x, z, length, rotY]. */
const hedges = [
  [-27.4, -30.6, 4.2, 0], [27.4, -34.4, 4.2, 0],
  [-23.0, 22.8, 3.6, Math.PI / 2], [23.0, 22.8, 3.6, Math.PI / 2],
  [-9.4, 9.8, 3.4, 0], [-2.2, -36.6, 4.0, 0],
]
for (const [x, z, length, rotY] of hedges) add({ type: 'hedge', p: [x, 0, z], length, rotY })

/* ---------------------------------------------------------------------------
 * Trees, rocks, hay, scarecrows
 * ------------------------------------------------------------------------- */

/** Bare dead trees, twisted: [x, z, size]. */
const deadTrees = [
  [-28.6, -32.8, 1.0], [-8.8, -26.4, 1.15], [-3.6, -37.8, 0.9], [-8.6, 19.8, 1.1], [9.6, 33.2, 1.0],
  [-25.4, 23.0, 0.95], [26.0, 23.4, 1.0], [-37.0, -2.0, 0.85], [37.0, 4.8, 0.9], [-1.4, 14.6, 0.9],
  [28.2, -38.0, 0.85], [-31.0, 35.8, 1.05], [33.4, 35.4, 1.0],
]
export const DEAD_TREES = Object.freeze(deadTrees.map(([x, z, s]) => ({ p: [x, 0, z], s })))
for (const t of DEAD_TREES) add({ type: 'deadTree', ...t })

/** Pines: [x, z, height]. */
const pines = [
  [-10.6, 36.8, 9.5], [-1.6, 38.0, 8.5], [4.8, 36.6, 10], [11.0, 30.0, 8.0], [-11.0, 29.8, 8.8],
  [-35.8, 33.2, 9.5], [-22.6, 33.6, 8.6], [-27.4, 38.2, 9.8], [-38.0, 22.4, 8.4],
  [35.8, 33.2, 9.5], [22.6, 33.6, 8.6], [27.4, 38.2, 9.8], [38.0, 22.4, 8.4],
  [-36.6, -37.8, 9.0], [36.6, -37.8, 9.0], [-25.2, -38.4, 8.2], [25.2, -38.4, 8.2],
]
export const PINES = Object.freeze(pines.map(([x, z, h]) => ({ p: [x, 0, z], h })))
for (const t of PINES) add({ type: 'pine', ...t })

/** Boulders: [x, z, size]. */
const rocks = [
  [-9.4, 23.4, 1.2], [-5.0, 29.6, 1.0], [2.8, 23.2, 0.95], [8.6, 29.0, 1.3], [-25.6, 29.8, 1.1],
  [-31.2, 23.4, 0.9], [25.8, 29.6, 1.1], [31.4, 23.8, 1.0], [-11.0, 33.0, 1.3], [11.6, 36.8, 1.2],
  [-37.6, 30.4, 1.2], [37.4, 28.8, 1.1], [0.6, 33.6, 1.15],
]
export const ROCKS = Object.freeze(rocks.map(([x, z, s], i) => ({ p: [x, 0, z], s, seed: 700 + i })))
for (const r of ROCKS) add({ type: 'rock', ...r })

/** Hay: round bales (lying on their side) and stacks of square bales: [x, z, kind, rotY]. */
const hay = [
  [4.6, 20.8, 'round', 0.3], [10.4, 21.4, 'stack', 0.12], [-4.0, 19.0, 'round', 1.4], [-7.8, 12.0, 'stack', -0.2],
  [-37.0, -1.8, 'stack', 0.05], [-36.2, 2.6, 'round', 1.5], [37.0, 1.4, 'stack', -0.05],
  [-30.2, -36.6, 'stack', 0.3], [30.2, -32.0, 'round', 0.2], [-23.6, 24.6, 'round', 0.6], [23.6, 25.0, 'stack', -0.3],
  [-2.6, -12.8, 'stack', 0.1], [8.6, -8.8, 'round', 0.4], [-8.8, 8.8, 'round', 0.7],
]
export const HAY = Object.freeze(hay.map(([x, z, kind, rotY]) => ({ p: [x, 0, z], kind, rotY })))
for (const h of HAY) add({ type: 'hay', ...h })

/** Scarecrows with pumpkin heads: [x, z, rotY]. */
const scarecrows = [[-6.6, 13.8, 0.4], [-29.8, -29.4, 1.2], [29.6, 30.6, -2.4]]
export const SCARECROWS = Object.freeze(scarecrows.map(([x, z, rotY]) => ({ p: [x, 0, z], rotY })))
for (const s of SCARECROWS) add({ type: 'scarecrow', ...s })

/* ---------------------------------------------------------------------------
 * Pumpkins, candles, lamps and string lights (the light of the town)
 * ------------------------------------------------------------------------- */

/**
 * Pumpkins: [x, z, size, carved, rotY, y]. Carved ones glow. Size 1 is a
 * 0.42 m pumpkin; the big ones (size >= 1.6) are solid.
 */
const pumpkins = [
  // Round the statue on the island.
  [2.6, -2.2, 1.1, 1, 0.6], [-2.8, -1.8, 1.0, 1, -0.8], [-2.4, 2.6, 1.2, 1, -2.4], [1.2, 3.4, 0.9, 0, 0],
  [3.4, 1.0, 0.8, 0, 0], [-3.6, 0.6, 0.85, 0, 0], [0.4, -3.6, 1.0, 1, 0.1], [-1.4, -3.4, 0.75, 0],
  // Porches and steps.
  [-21.9, -20.8, 1.0, 1, Math.PI / 2], [-21.9, -17.2, 0.9, 1, Math.PI / 2], [-21.6, -19.9, 0.7, 0, 0, 0.14],
  [21.9, -18.8, 1.0, 1, -Math.PI / 2], [21.9, -15.2, 0.9, 1, -Math.PI / 2], [21.6, -16.0, 0.7, 0, 0, 0.14],
  [-24.2, 12.0, 1.0, 1, Math.PI / 2], [-24.2, 15.2, 1.1, 1, Math.PI / 2], [24.2, 12.0, 1.0, 1, -Math.PI / 2], [24.2, 15.2, 1.1, 1, -Math.PI / 2],
  [-2.8, -14.8, 1.0, 1, 0], [2.8, -14.8, 1.0, 1, 0], [-2.1, -15.1, 0.75, 0, 0], [2.1, -15.0, 0.8, 0, 0],
  // The pumpkin patch in the park, by the scarecrow.
  [-8.2, 14.6, 1.0, 0, 0], [-7.0, 15.8, 1.3, 0, 0], [-5.4, 15.0, 0.9, 1, -0.4], [-8.8, 16.6, 1.1, 0, 0],
  [-5.8, 12.4, 1.0, 0, 0], [-9.2, 13.0, 0.85, 1, 0.9], [-4.2, 16.6, 1.0, 0, 0], [-6.4, 17.2, 2.4, 1, -0.3],
  // By the barn and on the bridge.
  [2.4, 18.6, 1.0, 1, -0.6], [12.4, 19.6, 1.0, 1, 0.4], [6.6, 7.4, 0.9, 1, Math.PI], [8.6, 7.2, 0.8, 0, 0],
  // Graveyard and gate piers.
  [8.6, -29.0, 0.9, 1, 0.2], [7.8, -24.4, 0.8, 0, 0], [10.2, -36.6, 1.0, 1, 0],
  // Yards.
  [-30.8, -35.4, 1.0, 0, 0], [-31.6, -34.2, 1.2, 1, 0.8], [30.8, -33.8, 1.0, 1, -0.8], [31.8, -34.6, 0.9, 0, 0],
  [-35.6, -4.8, 1.0, 1, 0.2], [35.6, 4.8, 1.0, 1, -2.9], [-28.0, 21.2, 2.0, 1, 2.6], [28.0, 21.2, 2.0, 1, -2.6],
  [-13.4, -8.2, 1.0, 1, -1.2], [13.4, 8.2, 1.0, 1, 1.9], [-12.6, 8.4, 0.9, 0, 0], [12.6, -8.4, 0.9, 0, 0],
]
export const PUMPKINS = Object.freeze(
  pumpkins.map(([x, z, s, carved, rotY = 0, y = 0]) => ({ p: [x, y + (Math.hypot(x, z) < STREETS.circle.island ? STREETS.circle.curb : 0), z], s, carved: Boolean(carved), rotY })),
)
add({ type: 'pumpkins' })

/** Gate piers carry a carved pumpkin each. */
export const PIER_TOP = 1.55

/** Candle clusters: [x, z, count, y]. */
const candles = [
  // On the plinth's lower step.
  [1.3, -1.2, 5, STREETS.circle.curb + 0.5], [-1.3, 1.2, 5, STREETS.circle.curb + 0.5], [1.2, 1.3, 4, STREETS.circle.curb + 0.5], [-1.2, -1.2, 4, STREETS.circle.curb + 0.5],
  [-1.6, -14.6, 6, 0], [1.6, -14.6, 6, 0], [9.0, -33.0, 4, 0], [7.4, -27.4, 3, 0], [10.4, -24.4, 3, 0],
  [0, -31.6, 6, 1.02],
]
export const CANDLES = Object.freeze(candles.map(([x, z, n, y]) => ({ p: [x, y, z], n })))
add({ type: 'candles' })

/** Street lamps (iron posts with lanterns): [x, z]. */
const lamps = [
  [-30.5, -5.1], [-23.5, 5.1], [23.5, -5.1], [30.5, 5.1],
  [-12.9, -21.0], [-20.1, -31.0], [20.1, -21.0], [12.9, -31.0],
  [-12.9, 20.5], [-20.1, 31.5], [20.1, 20.5], [12.9, 31.5],
  [-5.6, -14.0], [5.2, -15.2],
  [-1.0, 20.4], [0.8, 31.0],
]
export const LAMPS = Object.freeze(lamps.map(([x, z]) => ({ p: [x, 0, z] })))
for (const l of LAMPS) add({ type: 'lamp', ...l })

/** Wooden poles carrying string lights round the roundabout. */
export const LIGHT_POLES = Object.freeze([[-11.4, -5.6], [11.4, -5.6], [-11.4, 5.6], [11.4, 5.6]].map(([x, z]) => ({ p: [x, 0, z], h: 5.6 })))
for (const p of LIGHT_POLES) add({ type: 'lightPole', ...p })

/** String lights: runs [[ax, ay, az], [bx, by, bz], sag]. */
export const STRING_LIGHTS = Object.freeze([
  [[-11.4, 5.4, -5.6], [11.4, 5.4, -5.6], 0.9],
  [[-11.4, 5.4, 5.6], [11.4, 5.4, 5.6], 0.9],
  [[-11.4, 5.4, -5.6], [-11.4, 5.4, 5.6], 0.6],
  [[11.4, 5.4, -5.6], [11.4, 5.4, 5.6], 0.6],
  [[11.4, 5.4, -5.6], [8.6, 6.4, -17.4], 0.7],
  [[-11.4, 5.4, -5.6], [-5.0, 5.6, -17.2], 0.7],
  [[-11.4, 5.4, 5.6], [-12.9, 3.8, 20.5], 0.6],
  [[11.4, 5.4, 5.6], [12.9, 3.8, 20.5], 0.6],
  // Along the houses' eaves (porch to carport / garage corner).
  [[-22.9, 3.2, -23.0], [-22.9, 3.2, -13.4], 0.35],
  [[22.9, 3.2, -21.0], [22.9, 3.2, -11.4], 0.35],
  // Between the barn and the bridge lamp.
  [[3.0, 3.2, 18.0], [-1.0, 3.8, 20.4], 0.45],
])
add({ type: 'stringLights' })

/** Power poles along Main Street, and their wires. */
export const HOLLOW_POWER_LINES = Object.freeze([
  [[-40, -6.8], [-31.5, -6.8], [-22.4, -6.8]],
  [[22.4, 6.8], [31.5, 6.8], [40, 6.8]],
])
for (const line of HOLLOW_POWER_LINES) for (const [x, z] of line.slice(1)) add({ type: 'pole', p: [x, 0, z] })
add({ type: 'powerlines', lines: HOLLOW_POWER_LINES })

/* ---------------------------------------------------------------------------
 * Street furniture, barricades, odds and ends
 * ------------------------------------------------------------------------- */

add({ type: 'streetSign', p: [-12.6, 0, -6.6], rotY: 0.3, names: ['CREEK RD', 'MAIN ST'] })
add({ type: 'streetSign', p: [12.6, 0, 6.6], rotY: 0.3 + Math.PI, names: ['CREEK RD', 'MAIN ST'] })
add({ type: 'mailbox', p: [-21.4, 0, -22.4], rotY: -Math.PI / 2 })
add({ type: 'mailbox', p: [21.4, 0, -20.4], rotY: Math.PI / 2 })
add({ type: 'mailbox', p: [-21.4, 0, 12.8], rotY: -Math.PI / 2 })
add({ type: 'mailbox', p: [21.4, 0, 12.8], rotY: Math.PI / 2 })
add({ type: 'hydrant', p: [-12.6, 0, 6.6] })
add({ type: 'hydrant', p: [12.6, 0, -6.6] })
add({ type: 'trashCans', p: [-25.4, 0, -10.6], rotY: 0 })
add({ type: 'trashCans', p: [25.6, 0, -9.0], rotY: Math.PI })
add({ type: 'bench', p: [-8.6, 0, -16.2], rotY: 0 })
add({ type: 'bench', p: [3.6, 0, 30.2], rotY: Math.PI / 2 })
add({ type: 'woodPile', p: [-37.6, 0, -30.0], rotY: Math.PI / 2 })
add({ type: 'woodPile', p: [37.6, 0, -28.0], rotY: Math.PI / 2 })
add({ type: 'outhouse', p: [-38.0, 0, 34.0], rotY: Math.PI / 2 })
add({ type: 'outhouse', p: [38.0, 0, 34.0], rotY: -Math.PI / 2 })

// Main Street is closed at both ends: concrete barriers and sawhorses.
add({ type: 'barrier', p: [-38.4, 0, -2.6], rotY: Math.PI / 2 + 0.06, length: 3 })
add({ type: 'barrier', p: [-38.6, 0, 1.4], rotY: Math.PI / 2 - 0.08, length: 3 })
add({ type: 'sawhorse', p: [-35.4, 0, 0.2], rotY: Math.PI / 2 + 0.1 })
add({ type: 'barrier', p: [38.4, 0, 2.6], rotY: Math.PI / 2 + 0.06, length: 3 })
add({ type: 'barrier', p: [38.6, 0, -1.4], rotY: Math.PI / 2 - 0.08, length: 3 })
add({ type: 'sawhorse', p: [35.6, 0, -0.6], rotY: Math.PI / 2 - 0.1 })

export const HOLLOW_AMMO = Object.freeze([
  { p: [-37.1, 0, -37.4], radius: 1.7, cooldown: 20, rotY: 0 },
  { p: [37.1, 0, -37.4], radius: 1.7, cooldown: 20, rotY: 0 },
])
for (const a of HOLLOW_AMMO) add({ type: 'ammoCrate', p: a.p, size: [1.0, 0.6, 0.6], rotY: a.rotY })

/* ---------------------------------------------------------------------------
 * Furniture: low cover inside. [kind, x, z, w, h, d, rotY, y]
 * ------------------------------------------------------------------------- */

const shiftList = (list, [dx, dz]) => list.map(([kind, x, z, ...rest]) => [kind, x + dx, z + dz, ...rest])
const furniture = [
  // The family houses: their Atomic Acres rooms, moved with them.
  ...shiftList(
    [
      ['sofa', -23.7, 2.8, 0.9, 0.85, 2.2, 0],
      ['coffeeTable', -22.0, 2.8, 0.7, 0.42, 1.2, 0],
      // (No TV or armchair here: on this map's grid they'd cut the bots' way to the stairs.)
      ['counter', -27.4, 4.45, 4.4, 0.95, 0.6, 0],
      ['fridge', -29.4, -4.6, 0.7, 1.8, 0.7, 0],
      ['stove', -29.45, -2.9, 0.65, 0.95, 0.7, 0],
      ['diningTable', -27.4, 0.2, 1.5, 0.78, 0.95, 0],
      ['bed', -21.2, 2.6, 1.6, 0.62, 2.1, 0, 3.2],
      ['dresser', -24.0, 0.6, 0.55, 1.1, 1.3, 0, 3.2],
      ['bed', -28.4, 3.4, 2.1, 0.62, 1.5, 0, 3.2],
      ['wardrobe', -29.45, -4.4, 0.6, 2.0, 1.3, 0, 3.2],
    ],
    WEST_SHIFT,
  ),
  ...shiftList(
    [
      ['sofa', 23.7, -2.8, 0.9, 0.85, 2.2, Math.PI],
      ['coffeeTable', 22.0, -2.8, 0.7, 0.42, 1.2, 0],
      ['piano', 19.55, 4.6, 0.6, 1.25, 1.5, 0],
      ['counter', 28.2, -4.45, 2.8, 0.95, 0.6, 0],
      ['fridge', 29.4, 4.8, 0.7, 1.8, 0.7, 0],
      ['diningTable', 27.4, 0.0, 1.5, 0.78, 0.95, 0],
      ['bed', 21.0, -0.2, 1.6, 0.62, 2.1, 0, 3.2],
      ['dresser', 24.0, -0.4, 0.55, 1.1, 1.3, 0, 3.2],
      ['bed', 28.4, -3.6, 2.1, 0.62, 1.5, 0, 3.2],
      ['bookshelf', 29.5, 2.0, 0.45, 1.9, 1.4, 0, 3.2],
      ['workbench', 28.4, -11.0, 0.8, 0.95, 2.4, 0],
      ['shelf', 23.0, -12.15, 2.2, 1.9, 0.5, 0],
    ],
    EAST_SHIFT,
  ),
  // Church: pews either side of the aisle, the altar.
  ...[-28.6, -26.8, -25.0, -23.2, -21.4].flatMap((z) => [
    ['pew', -2.75, z, 2.9, 0.95, 0.6, 0],
    ['pew', 2.75, z, 2.9, 0.95, 0.6, 0],
  ]),
  ['altar', 0, -31.6, 2.4, 1.0, 1.0, 0],
  // Barn: bales, a cart and a workbench below; bales up in the loft.
  ['bales', 4.0, 15.0, 1.2, 1.4, 1.6, 0],
  ['bales', 7.0, 12.8, 2.0, 1.0, 1.0, 0],
  ['crates', 4.2, 16.8, 1.1, 1.0, 1.1, 0.2],
  ['bales', 5.0, 9.6, 2.2, 1.0, 1.2, 0, 3.4],
  ['bales', 9.0, 13.2, 1.2, 0.9, 2.4, 0, 3.4],
  // Cottages.
  ['bed', -33.6, 16.4, 1.5, 0.6, 2.0, Math.PI / 2],
  ['dresser', -34.4, 11.4, 0.55, 1.1, 1.2, 0],
  ['diningTable', -28.0, 15.6, 1.2, 0.78, 0.9, 0],
  ['counter', -28.2, 10.55, 2.6, 0.95, 0.6, 0],
  ['bed', 33.6, 16.4, 1.5, 0.6, 2.0, -Math.PI / 2],
  ['dresser', 34.4, 11.4, 0.55, 1.1, 1.2, 0],
  ['diningTable', 28.0, 15.6, 1.2, 0.78, 0.9, 0],
  ['counter', 28.2, 10.55, 2.6, 0.95, 0.6, 0],
  // Sheds.
  ['shelf', -38.0, -39.1, 2.2, 1.8, 0.5, 0],
  ['shelf', 38.0, -39.1, 2.2, 1.8, 0.5, 0],
]
export const HOLLOW_FURNITURE = Object.freeze(furniture.map(([kind, x, z, w, h, d, rotY = 0, y = 0]) => ({ kind, p: [x, y, z], size: [w, h, d], rotY })))
add({ type: 'furniture' })

/* ---------------------------------------------------------------------------
 * Night dressing (no colliders): mist, bats, cobwebs
 * ------------------------------------------------------------------------- */

/** Low mist drifting over the graveyard, the creek and the park: [x, z, radius]. */
export const MIST = Object.freeze([
  [9.0, -31.0, 5.5], [9.0, -25.4, 4.0], [-8.0, -32.0, 4.5], [-24.0, 27.2, 5.0], [-6.0, 27.0, 5.0], [10.0, 27.0, 5.0],
  [24.0, 26.8, 5.0], [-6.4, 34.0, 4.0], [32.0, 30.0, 4.0], [-32.0, 30.0, 4.0], [0, -38.0, 4.0],
].map(([x, z, r]) => ({ p: [x, 0, z], r })))
add({ type: 'mist' })

/** Bats circling: centres, radius, height. */
export const BAT_FLOCKS = Object.freeze([
  { p: [6.8, 15.5, -18.8], r: 5.5, n: 7 },
  { p: [-6.5, 12.5, 33.4], r: 4.5, n: 5 },
])
add({ type: 'bats' })

/* ---------------------------------------------------------------------------
 * Boundary and backdrop
 * ------------------------------------------------------------------------- */

add({ type: 'hollowPerimeter' })
add({ type: 'hollowBackdrop' })

export const HOLLOW_ENTITIES = Object.freeze(entities)

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

function belfryColliders(b) {
  const cx = (b.x0 + b.x1) / 2
  const cz = (b.z0 + b.z1) / 2
  const w = b.x1 - b.x0
  const d = b.z1 - b.z0
  return [
    boxC([cx, b.top / 2, cz], [w, b.top, d]),
    // The spire, as a narrowing stack.
    boxC([cx, b.top + 1.2, cz], [w * 0.7, 2.4, d * 0.7]),
    boxC([cx, b.top + 3.6, cz], [w * 0.35, 2.4, d * 0.35]),
  ]
}

function statueColliders() {
  const s = STATUE
  const [cx, y, cz] = s.p
  const out = [
    // The island itself: a low curb you step up onto.
    cylC([0, s.p[1] / 2, 0], STREETS.circle.island, s.p[1]),
    cylC([cx, y + s.base[1] / 2, cz], s.base[0], s.base[1]),
    cylC([cx, y + s.base[1] + s.plinth[1] / 2, cz], s.plinth[0], s.plinth[1]),
  ]
  const top = y + s.base[1] + s.plinth[1]
  out.push(cylC([cx, top + s.height / 2, cz], s.body, s.height))
  // The cauldron in front (south) of her.
  const [r, h, off] = [s.cauldron[1], s.cauldron[2], s.cauldron[0]]
  out.push(cylC([cx, y + h / 2, cz + off], r, h))
  return out
}

function watchtowerColliders(t) {
  const [cx, , cz] = t.p
  const h = t.half
  const out = []
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(boxC([cx + sx * (h - 0.1), t.cabin / 2, cz + sz * (h - 0.1)], [0.22, t.cabin, 0.22]))
  out.push(boxC([cx, t.deck - 0.08, cz], [h * 2, 0.16, h * 2]))
  for (const r of towerParapet(t)) {
    const len = r.b - r.a
    const mid = (r.a + r.b) / 2
    out.push(boxC(r.axis === 'x' ? [mid, t.deck + 0.5, r.fixed] : [r.fixed, t.deck + 0.5, mid], r.axis === 'x' ? [len, 1.0, 0.08] : [0.08, 1.0, len]))
  }
  // The cabin roof over the deck, and the spire above it.
  out.push(boxC([cx, t.cabin + 0.06, cz], [h * 2 + 0.6, 0.12, h * 2 + 0.6]))
  out.push(boxC([cx, (t.cabin + t.spire) / 2 - 0.4, cz], [h * 1.1, t.spire - t.cabin - 0.8, h * 1.1]))
  return out
}

function bridgeColliders(b) {
  const out = bridgeSlabs(b).map((s) => boxC(s.p, s.size, s.q))
  // Rails along both sides, movement only.
  for (const s of [-1, 1]) out.push(...localBoxes({ p: [b.p[0], 0, b.p[2]], rotY: b.rotY }, [[s * (b.width / 2 - 0.05), b.rise, 0, 0.08, 0.95, b.length * 0.6, MOVE_ONLY]]))
  return out
}

function headstoneColliders() {
  return HEADSTONES.map((h) => {
    const [w, ht, d] = STONE_SIZE[h.kind]
    return groundBox(h.p, [w, ht * Math.cos(h.tilt), Math.max(d, 0.2)], h.rotY)
  })
}

const COLLIDER_BUILDERS = {
  house: (e) => houseColliders(hollowHouseOf(e.id)),
  belfry: belfryColliders,
  // The crypt and its portico (the columns and steps in front of the door).
  crypt: (c) => [boxC([(c.x0 + c.x1) / 2, (c.h + 0.6) / 2, (c.z0 + c.z1 + 0.45) / 2], [c.x1 - c.x0, c.h + 0.6, c.z1 - c.z0 + 0.45])],
  culverts: () => CULVERTS.map((c) => boxC([c.x, c.h / 2, c.z], [0.24, c.h, c.length])),
  headstones: headstoneColliders,
  ironFence: (e) => [lineBox(e.a, e.b, 1.5, 0.08, 0, MOVE_ONLY)],
  gatePier: (e) => [boxC([e.p[0], 0.7, e.p[2]], [0.5, 1.4, 0.5])],
  statue: statueColliders,
  watchtower: watchtowerColliders,
  bridge: bridgeColliders,
  hayPile: (e) => [groundBox(e.p, [2.2, 0.8, 1.8], e.rotY)],
  car: carColliders,
  privacyFence: (e) => [lineBox(e.a, e.b, 1.95, 0.12)],
  picketFence: (e) => [lineBox(e.a, e.b, 0.95, 0.1, 0, MOVE_ONLY)],
  stoneWall: (e) => [lineBox(e.a, e.b, e.h, 0.45)],
  hedge: (e) => [groundBox(e.p, [e.length, 1.45, 0.95], e.rotY)],
  deadTree: (e) => [cylC([e.p[0], 2.0 * e.s, e.p[2]], 0.3 * e.s, 4.0 * e.s)],
  pine: (e) => [cylC([e.p[0], 1.6, e.p[2]], 0.3, 3.2)],
  rock: (e) => [cylC([e.p[0], 0.5 * e.s, e.p[2]], 0.72 * e.s, 1.0 * e.s)],
  hay: (e) => (e.kind === 'round' ? [groundBox(e.p, [1.2, 1.3, 1.4], e.rotY)] : [groundBox(e.p, [2.2, 1.0, 1.1], e.rotY)]),
  scarecrow: (e) => [cylC([e.p[0], 1.2, e.p[2]], 0.16, 2.4)],
  pumpkins: () => PUMPKINS.filter((p) => p.s >= 1.6).map((p) => cylC([p.p[0], p.p[1] + 0.21 * p.s, p.p[2]], 0.27 * p.s, 0.42 * p.s)),
  lamp: (e) => [cylC([e.p[0], 1.9, e.p[2]], 0.1, 3.8)],
  lightPole: (e) => [cylC([e.p[0], e.h / 2, e.p[2]], 0.13, e.h)],
  pole: (e) => [cylC([e.p[0], 3.5, e.p[2]], 0.14, 7)],
  streetSign: (e) => [cylC([e.p[0], 1.5, e.p[2]], 0.05, 3.0)],
  mailbox: (e) => [cylC([e.p[0], 0.55, e.p[2]], 0.12, 1.1)],
  hydrant: (e) => [cylC([e.p[0], 0.4, e.p[2]], 0.17, 0.8)],
  trashCans: (e) => {
    const out = []
    for (const s of [-0.35, 0.35]) {
      const o = yawOffset(e.p, s, 0, e.rotY)
      out.push(cylC([o[0], 0.48, o[2]], 0.3, 0.96))
    }
    return out
  },
  bench: (e) => [groundBox(e.p, [1.7, 0.85, 0.55], e.rotY)],
  woodPile: (e) => [groundBox(e.p, [2.4, 0.9, 1.0], e.rotY)],
  outhouse: (e) => [groundBox(e.p, [1.3, 2.4, 1.3], e.rotY)],
  cart: (e) => [groundBox(e.p, [1.8, 1.45, 3.2], e.rotY)],
  barrier: (e) => [groundBox(e.p, [e.length, 1.0, 0.62], e.rotY)],
  sawhorse: (e) => [groundBox(e.p, [1.8, 1.0, 0.5], e.rotY, MOVE_ONLY)],
  ammoCrate: (e) => [groundBox(e.p, e.size, e.rotY)],
  furniture: () => HOLLOW_FURNITURE.map((f) => groundBox(f.p, f.size, f.rotY)),
  hollowPerimeter: () => [...boundaryColliders(HOLLOW_HALF, HOLLOW_HALF), boxC([0, -1, 0], [200, 2, 200])],
}

let colliderCache = null

/** Flat, cached list of every collider in the map. Identical on client and server. */
export function buildHollowColliders() {
  if (colliderCache) return colliderCache
  const out = []
  for (const e of HOLLOW_ENTITIES) {
    const build = COLLIDER_BUILDERS[e.type]
    if (build) out.push(...build(e))
  }
  colliderCache = Object.freeze(out)
  return colliderCache
}

export const hollowLadderAt = (x, y, z) => ladderIn(HOLLOW_LADDERS, x, y, z)

/* ---------------------------------------------------------------------------
 * Spawns
 * ------------------------------------------------------------------------- */

const spawn = (x, z, faceX = 0, faceZ = 0) => ({ p: [x, 0, z], yaw: Math.atan2(-(faceX - x), -(faceZ - z)) })

export const HOLLOW_SPAWNS = Object.freeze({
  // TDM: Alpha behind the west house and the south-west cottage, Bravo behind
  // the east ones. The houses are close in front, so most spawns face along
  // the open gap past them (a face point) rather than at their back walls.
  [TEAMS.ALPHA]: [spawn(-37.4, -23.4), spawn(-37.6, -19.0, -22.6, 7), spawn(-37.4, -14.6, -12, 1), spawn(-38.0, 11.2, -17, -11), spawn(-38.0, 14.2, -23, -12), spawn(-37.8, 17.2, -30, -12)],
  [TEAMS.BRAVO]: [spawn(37.4, -21.4, 22.4, 4.6), spawn(37.6, -17.0, 22.6, 9), spawn(37.4, -12.6, 16, 8), spawn(38.0, 11.2, 12, -4), spawn(38.0, 14.2, 23, -12), spawn(37.8, 17.2, 30, -12)],
  ffa: [
    spawn(-31.0, -38.0),
    spawn(0, -38.6),
    spawn(31.0, -38.0, 7, -20),
    spawn(38.4, -6.0),
    spawn(37.0, 38.0, 20, 13),
    spawn(4.0, 38.6),
    spawn(-37.0, 38.0),
    spawn(-38.4, 6.0, -8, 4),
    spawn(-24.6, 33.0),
    spawn(24.6, 33.0),
  ],
})

/* ---------------------------------------------------------------------------
 * Bot navigation: grid + doorways + the stairs in the houses and the barn.
 * ------------------------------------------------------------------------- */

/** Points either side of every ground-floor doorway. */
function doorNodes() {
  const out = []
  for (const h of HOUSES) {
    for (const o of houseOpenings(h)) {
      if (!o.door || o.floor > 0) continue
      const [a, b] = o.at
      const n = o.axis === 'x' ? [0, 1] : [1, 0]
      for (const s of [-1, 1]) out.push([a + n[0] * s * 0.9, 0, b + n[1] * s * 0.9])
    }
  }
  return out
}

const shiftPt = ([x, y, z], [dx, dz]) => [x + dx, y, z + dz]

export const HOLLOW_NAV = Object.freeze({
  grid: { spacing: 2.5, half: HOLLOW_HALF - 1.2 },
  root: [0, 7],
  linkUpper: true,
  extra: Object.freeze([
    ...doorNodes(),
    // Down the church's aisle, between the pews.
    [0, 0, -19.8], [0, 0, -22.3], [0, 0, -24.1], [0, 0, -25.9], [0, 0, -27.7], [0, 0, -30.2],
    // The graveyard path.
    [8.8, 0, -25.6], [8.8, 0, -28.4], [8.9, 0, -31.0], [9.0, 0, -33.4], [9.0, 0, -34.9],
  ]),
  chains: Object.freeze([
    // The two family houses: their Atomic Acres routes upstairs, moved with them.
    ACRES_NAV.chains[0].map((p) => shiftPt(p, WEST_SHIFT)),
    ACRES_NAV.chains[1].map((p) => shiftPt(p, EAST_SHIFT)),
    // The barn: up the stairs along the east wall into the loft.
    [[11.25, 0, 9.0], [11.25, 0.55, 11.0], [11.25, 1.75, 13.0], [11.25, 2.95, 15.0], [11.25, 3.4, 16.6], [9.6, 3.4, 16.8]],
  ]),
  upper: Object.freeze([
    ...ACRES_NAV.upper.slice(0, 12).map((p) => shiftPt(p, WEST_SHIFT)),
    ...ACRES_NAV.upper.slice(12).map((p) => shiftPt(p, EAST_SHIFT)),
    // The barn loft.
    [7.4, 3.4, 16.6], [5.0, 3.4, 16.4], [5.0, 3.4, 13.4], [7.4, 3.4, 13.4], [9.4, 3.4, 15.0], [7.6, 3.4, 10.6], [9.2, 3.4, 11.2], [7.5, 3.4, 9.0],
  ]),
})
