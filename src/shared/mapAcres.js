/**
 * "Atomic Acres" — a 1950s test-site suburb, as data.
 *
 * A cul-de-sac at the centre with a school bus and a moving truck parked in it,
 * two family houses facing each other across it (yellow to the west, green to
 * the east; two storeys, stairs inside, balconies onto the carport and garage
 * roofs), their fenced backyards behind them (the team spawns), and the lots
 * round about: a modern orange house and a park with the welcome sign to the
 * north, a water tower you can climb in the north-west, a cottage and a pool
 * with its pool house to the south, and the road out, closed by a barricade.
 *
 * Coordinates are metres. +X is east, -Z north, +Y up, ground y = 0. The arena
 * is 84 x 84 m, centred on the cul-de-sac. Like map.js, everything is listed once
 * as entities; the client draws them and BOTH sides build their physics from
 * `buildColliders()`.
 */
import { TEAMS } from './constants.js'
import {
  boundaryColliders,
  boxC,
  cylC,
  groundBox,
  IDENTITY_Q,
  ladder,
  ladderIn,
  MOVE_ONLY,
  rampBox,
  wallPieces,
  yawOffset,
  yawQ,
} from './mapKit.js'

export const ACRES_NAME = 'Atomic Acres'
export const ACRES_HALF = 42

const entities = []
const add = (e) => {
  entities.push(e)
  return e
}

/* ---------------------------------------------------------------------------
 * Houses
 *
 * Axis-aligned boxes of rooms. `x0..x1, z0..z1` are the outer faces of the
 * walls. Each floor lists its wall openings per side ('n' 's' 'w' 'e'), measured
 * along the wall in world x (north/south walls) or world z (west/east walls),
 * with `bottom`/`top` above that floor's surface. Inner walls run along an axis
 * at a fixed x or z. An upper floor's walls start at the bottom of the slab
 * under it, so its doors have a sill flush with the floor.
 * ------------------------------------------------------------------------- */

/** Exterior and interior wall thickness, slab thickness. */
export const WALL_T = 0.2
export const INNER_T = 0.12
export const SLAB_T = 0.2
const CEIL_T = 0.15

const door = (from, to, top = 2.2) => ({ from, to, bottom: 0, top, door: true })
const win = (from, to, bottom = 1.0, top = 2.1) => ({ from, to, bottom, top })

export const HOUSES = Object.freeze([
  {
    // Two storeys: cream stucco below, yellow siding above, a stone chimney on
    // the north wall and a carport on the south whose roof is a balcony.
    id: 'yellow',
    x0: -30,
    x1: -19,
    z0: -7,
    z1: 5,
    look: { lower: 'cream', upper: 'yellow', trim: 'white', roof: 'slate', base: 'stone' },
    floors: [
      {
        y: 0,
        h: 3.0,
        walls: {
          e: [door(-1.6, -0.4), win(0.6, 4.0, 0.8, 2.3), win(-5.6, -3.4)],
          w: [door(1.2, 2.4), win(-4.8, -2.6)],
          n: [win(-29.2, -27.6)],
          s: [door(-23.6, -22.4), win(-28.6, -26.4), win(-21.6, -20.0)],
        },
        inner: [{ axis: 'z', at: -24.5, from: -5.6, to: 4.8, openings: [door(-1.0, 1.4)] }],
        floor: 'wood',
        kitchen: { x0: -29.8, x1: -24.5, z0: -5.6, z1: 4.8 },
      },
      {
        y: 3.2,
        h: 2.6,
        walls: {
          e: [win(-5.6, -3.6, 0.9, 2.0), win(0.4, 3.6, 0.9, 2.0)],
          w: [win(-2.4, -0.4, 0.9, 2.0), win(2.0, 3.6, 0.9, 2.0)],
          n: [win(-21.6, -19.9, 0.9, 2.0)],
          s: [door(-22.4, -21.2), win(-28.4, -26.4, 0.9, 2.0)],
        },
        inner: [{ axis: 'z', at: -24.5, from: -5.6, to: 4.8, openings: [door(-4.6, -3.4)] }],
        floor: 'carpet',
      },
    ],
    // Upper slab, leaving the stairwell open (and lapping over the top step).
    slabs: [
      { x0: -29.8, x1: -25.7, z0: -6.8, z1: 4.8 },
      { x0: -22.0, x1: -19.2, z0: -6.8, z1: 4.8 },
      { x0: -26.0, x1: -22.0, z0: -5.75, z1: 4.8 },
    ],
    stairs: [{ bottom: [-20.6, 0, -6.3], top: [-25.8, 3.2, -6.3], width: 1.0 }],
    // Banister round the stairwell on the upper floor: [x0, z0, x1, z1].
    rails: [[-26.0, -5.75, -22.0, -5.75], [-22.0, -6.8, -22.0, -5.75]],
    // Under the high end of the stairs: a closet.
    closets: [{ x0: -25.8, x1: -23.4, z0: -6.8, z1: -5.8, h: 1.4 }],
    roof: { ridge: 8.7, overhang: 0.6 },
    chimney: { x0: -23.8, x1: -22.4, z0: -7.9, z1: -7.0, top: 8.4 },
    carport: { x0: -30, x1: -19.4, z0: 5, z1: 11.2, top: 3.2, posts: [[-29.7, 10.9], [-24.7, 10.9], [-19.7, 10.9]] },
    porch: { side: 'e', from: -2.6, to: 0.6, depth: 1.6 },
  },
  {
    // Two storeys: green siding with a stone base below, white with shutters
    // above, a garage on the north whose flat roof is a balcony.
    id: 'green',
    x0: 19,
    x1: 30,
    z0: -5,
    z1: 7,
    look: { lower: 'green', upper: 'white', trim: 'white', roof: 'charcoal', base: 'stone', shutters: 'green' },
    floors: [
      {
        y: 0,
        h: 3.0,
        walls: {
          w: [door(0.4, 1.6), win(-4.0, -1.8), win(3.0, 5.6, 0.9, 2.2)],
          e: [door(-2.4, -1.2), win(2.4, 4.6)],
          n: [door(25.4, 26.6), win(20.6, 22.0)],
          s: [door(27.0, 28.2), win(20.6, 23.0)],
        },
        inner: [{ axis: 'z', at: 24.5, from: -4.8, to: 5.6, openings: [door(-1.4, 1.0)] }],
        floor: 'wood',
        kitchen: { x0: 24.5, x1: 29.8, z0: -4.8, z1: 5.6 },
      },
      {
        y: 3.2,
        h: 2.6,
        walls: {
          w: [win(-4.0, -2.0, 0.9, 2.0), win(1.6, 3.6, 0.9, 2.0)],
          e: [win(-2.0, 0.0, 0.9, 2.0), win(3.0, 4.6, 0.9, 2.0)],
          n: [door(22.2, 23.4), win(26.6, 28.4, 0.9, 2.0)],
          s: [win(27.0, 29.0, 0.9, 2.0)],
        },
        inner: [{ axis: 'z', at: 24.5, from: -4.8, to: 5.6, openings: [door(3.0, 4.2)] }],
        floor: 'carpet',
      },
    ],
    slabs: [
      { x0: 19.2, x1: 22.0, z0: -4.8, z1: 6.8 },
      { x0: 25.7, x1: 29.8, z0: -4.8, z1: 6.8 },
      { x0: 22.0, x1: 26.0, z0: -4.8, z1: 5.75 },
    ],
    stairs: [{ bottom: [20.6, 0, 6.3], top: [25.8, 3.2, 6.3], width: 1.0 }],
    rails: [[22.0, 5.75, 26.0, 5.75], [22.0, 5.75, 22.0, 6.8]],
    closets: [{ x0: 23.4, x1: 25.8, z0: 5.8, z1: 6.8, h: 1.4 }],
    roof: { ridge: 8.8, overhang: 0.6 },
    garage: {
      x0: 19.4,
      x1: 29.0,
      z0: -12.6,
      z1: -5,
      h: 3.0,
      top: 3.2,
      walls: { w: [{ from: -12.0, to: -6.2, bottom: 0, top: 2.5, door: true, garage: true }], n: [win(24.0, 26.0, 1.2, 2.2)], e: [door(-9.6, -8.4)] },
    },
    porch: { side: 'w', from: -0.4, to: 2.4, depth: 1.4 },
  },
  {
    // Single storey, tall and modern: orange panels, big glass, a stone base and
    // a roof that kicks up at the front.
    id: 'orange',
    x0: 14,
    x1: 27,
    z0: -36,
    z1: -25,
    look: { lower: 'orange', trim: 'concrete', roof: 'concrete', base: 'stone', modern: true },
    floors: [
      {
        y: 0,
        h: 3.6,
        walls: {
          s: [door(19.4, 20.8, 2.4), win(15.0, 18.6, 0.6, 3.0), win(21.6, 26.0, 0.6, 3.0)],
          w: [door(-29.8, -27.4, 2.4), win(-34.6, -32.6, 0.9, 2.6)],
          e: [door(-29.4, -28.2, 2.4), win(-34.4, -32.2, 1.0, 2.4)],
          n: [win(17.0, 19.4, 1.0, 2.4), door(25.4, 26.6, 2.4)],
        },
        inner: [{ axis: 'x', at: -31, from: 14.2, to: 22, openings: [door(18.2, 19.4, 2.4)] }],
        floor: 'terrazzo',
        kitchen: { x0: 22, x1: 26.8, z0: -35.8, z1: -31 },
      },
    ],
    roof: { flat: true, overhang: 0.8, front: 's' },
    porch: { side: 's', from: 18.6, to: 21.6, depth: 1.2 },
  },
  {
    // Little single-storey cottage on the corner by the road.
    id: 'cottage',
    x0: -25,
    x1: -15,
    z0: 21,
    z1: 30,
    look: { lower: 'blue', trim: 'white', roof: 'red', base: 'brick', shutters: 'white' },
    floors: [
      {
        y: 0,
        h: 2.9,
        walls: {
          e: [door(24.6, 25.8), win(21.8, 23.8), win(27.0, 29.0)],
          w: [door(26.4, 27.6), win(22.4, 24.4)],
          n: [win(-22.4, -20.4)],
          s: [door(-23.6, -22.4), win(-20.0, -18.0)],
        },
        inner: [{ axis: 'z', at: -20, from: 21.2, to: 29.8, openings: [door(25.0, 26.2)] }],
        floor: 'wood',
        kitchen: { x0: -24.8, x1: -20, z0: 21.2, z1: 29.8 },
      },
    ],
    roof: { ridge: 5.2, overhang: 0.5 },
    porch: { side: 'e', from: 24.0, to: 26.4, depth: 1.2 },
  },
  {
    // Pool house: one room, the resupply crate inside.
    id: 'poolhouse',
    x0: 26,
    x1: 32,
    z0: 24,
    z1: 30,
    look: { lower: 'white', trim: 'teal', roof: 'teal', base: 'concrete' },
    floors: [
      {
        y: 0,
        h: 2.7,
        walls: {
          w: [door(26.2, 27.6)],
          n: [win(28.0, 30.0)],
          s: [win(27.4, 29.0), door(30.0, 31.2)],
          e: [win(25.6, 27.6)],
        },
        floor: 'tile',
      },
    ],
    roof: { flat: true, overhang: 0.6 },
  },
  {
    // Garden shed in the north-west lot: the other resupply crate.
    id: 'shed',
    x0: -40,
    x1: -35,
    z0: -22,
    z1: -17,
    look: { lower: 'barn', trim: 'white', roof: 'slate', base: 'concrete' },
    floors: [
      {
        y: 0,
        h: 2.5,
        walls: {
          e: [door(-20.4, -18.6, 2.2)],
          s: [win(-38.6, -37.0)],
          n: [door(-37.0, -35.8)],
        },
        floor: 'plank',
      },
    ],
    roof: { ridge: 3.9, overhang: 0.4 },
  },
])
for (const h of HOUSES) add({ type: 'house', id: h.id })

const houseById = Object.fromEntries(HOUSES.map((h) => [h.id, h]))
export const houseOf = (id) => houseById[id]

/** Floor-level wall runs of a house (or garage): exterior first, then inner. */
function wallRuns(h, f) {
  const t = WALL_T
  const walls = f.walls ?? {}
  // With no south wall (a garage against the house) the sides run on to the house.
  const zEnd = h.skip?.includes('s') ? h.z1 : h.z1 - t
  const runs = [
    { side: 'n', axis: 'x', fixed: h.z0 + t / 2, from: h.x0, to: h.x1, t, openings: walls.n ?? [] },
    { side: 's', axis: 'x', fixed: h.z1 - t / 2, from: h.x0, to: h.x1, t, openings: walls.s ?? [] },
    { side: 'w', axis: 'z', fixed: h.x0 + t / 2, from: h.z0 + t, to: zEnd, t, openings: walls.w ?? [] },
    { side: 'e', axis: 'z', fixed: h.x1 - t / 2, from: h.z0 + t, to: zEnd, t, openings: walls.e ?? [] },
  ]
  for (const w of f.inner ?? []) {
    runs.push({ side: 'inner', axis: w.axis, fixed: w.at, from: w.from, to: w.to, t: INNER_T, openings: w.openings ?? [] })
  }
  // A garage's south wall is the house's north wall.
  return h.skip ? runs.filter((r) => !h.skip.includes(r.side)) : runs
}

/**
 * Every wall piece of a house, garage included, in world space:
 * { p, size, floor, side, axis, y0, y1, garage? }. Shared by the colliders and the
 * renderer so the holes line up.
 */
const wallCache = new Map()
export function houseWallBoxes(h) {
  if (wallCache.has(h.id)) return wallCache.get(h.id)
  const out = []
  const build = (shell, floors, garage) => {
    floors.forEach((f, fi) => {
      const base = fi === 0 ? 0 : f.y - SLAB_T
      const lift = f.y - base
      const height = f.h + lift
      for (const run of wallRuns(shell, f)) {
        const openings = run.openings.map((o) => ({ from: o.from, to: o.to, bottom: o.bottom + lift, top: o.top + lift }))
        for (const piece of wallPieces(run.from, run.to, height, openings)) {
          const len = piece.b - piece.a
          const hh = piece.y1 - piece.y0
          if (len < 0.01 || hh < 0.01) continue
          const mid = (piece.a + piece.b) / 2
          const y = base + piece.y0 + hh / 2
          out.push({
            floor: fi,
            side: run.side,
            axis: run.axis,
            garage,
            p: run.axis === 'x' ? [mid, y, run.fixed] : [run.fixed, y, mid],
            size: run.axis === 'x' ? [len, hh, run.t] : [run.t, hh, len],
            y0: base + piece.y0,
            y1: base + piece.y1,
          })
        }
      }
    })
  }
  build(h, h.floors, false)
  if (h.garage) {
    const g = h.garage
    build({ ...g, id: `${h.id}-garage`, skip: ['s'] }, [{ y: 0, h: g.h, walls: g.walls }], true)
  }
  wallCache.set(h.id, out)
  return out
}

/** Doors and windows of a house in world space, for frames, sills and shutters. */
export function houseOpenings(h) {
  const out = []
  const collect = (shell, floors, garage) => {
    floors.forEach((f, fi) => {
      for (const run of wallRuns(shell, f)) {
        for (const o of run.openings) {
          const mid = (o.from + o.to) / 2
          out.push({
            floor: fi,
            side: run.side,
            axis: run.axis,
            garage,
            door: Boolean(o.door),
            garageDoor: Boolean(o.garage),
            width: o.to - o.from,
            y0: f.y + o.bottom,
            y1: f.y + o.top,
            t: run.t,
            at: run.axis === 'x' ? [mid, run.fixed] : [run.fixed, mid],
          })
        }
      }
    })
  }
  collect(h, h.floors, false)
  if (h.garage) collect({ ...h.garage, skip: ['s'] }, [{ y: 0, h: h.garage.h, walls: h.garage.walls }], true)
  return out
}

/** Top of the highest floor's walls. */
export const eaveOf = (h) => {
  const f = h.floors[h.floors.length - 1]
  return f.y + f.h
}

/** How far a pitched roof sits above the walls (a frieze band fills the gap). */
export const ROOF_LIFT = 0.32

/** Gable roof planes as tilted slabs (ridge along z), or the flat roof slab. */
export function roofSlabs(h) {
  const r = h.roof
  const eave = eaveOf(h)
  const o = r.overhang
  if (r.flat) {
    const top = eave + 0.25
    return [{ flat: true, p: [(h.x0 + h.x1) / 2, top - 0.125, (h.z0 + h.z1) / 2], size: [h.x1 - h.x0 + o * 2, 0.25, h.z1 - h.z0 + o * 2], top }]
  }
  const cx = (h.x0 + h.x1) / 2
  const cz = (h.z0 + h.z1) / 2
  const halfW = (h.x1 - h.x0) / 2
  // The roof drops past the walls by the overhang at the same pitch.
  const base = eave + ROOF_LIFT
  const slope = (r.ridge - base) / halfW
  const low = base - slope * o
  const width = h.z1 - h.z0 + o * 2
  return [-1, 1].map((s) => ({ ...rampBox([cx, r.ridge, cz], [cx + s * (halfW + o), low, cz], width, 0.16), side: s, low, ridge: r.ridge }))
}

export function houseColliders(h) {
  const out = houseWallBoxes(h).map((b) => boxC(b.p, b.size))
  const top = h.floors[h.floors.length - 1]
  // Upper floor slabs.
  for (const s of h.slabs ?? []) {
    const y = h.floors[1].y
    out.push(boxC([(s.x0 + s.x1) / 2, y - SLAB_T / 2, (s.z0 + s.z1) / 2], [s.x1 - s.x0, SLAB_T, s.z1 - s.z0]))
  }
  // Ceiling over the top floor (the attic is closed off).
  const eave = top.y + top.h
  out.push(boxC([(h.x0 + h.x1) / 2, eave + CEIL_T / 2, (h.z0 + h.z1) / 2], [h.x1 - h.x0, CEIL_T, h.z1 - h.z0]))
  for (const r of roofSlabs(h)) out.push(boxC(r.p, r.size, r.q ?? IDENTITY_Q))
  for (const st of h.stairs ?? []) {
    const r = rampBox(st.top, st.bottom, st.width, 0.14)
    out.push(boxC(r.p, r.size, r.q))
  }
  for (const [x0, z0, x1, z1] of h.rails ?? []) {
    const y = h.floors[1].y
    const len = Math.hypot(x1 - x0, z1 - z0)
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0)
    out.push(boxC([(x0 + x1) / 2, y + 0.5, (z0 + z1) / 2], alongX ? [len, 1.0, 0.08] : [0.08, 1.0, len], IDENTITY_Q, MOVE_ONLY))
  }
  for (const c of h.closets ?? []) out.push(boxC([(c.x0 + c.x1) / 2, c.h / 2, (c.z0 + c.z1) / 2], [c.x1 - c.x0, c.h, c.z1 - c.z0]))
  if (h.chimney) {
    const c = h.chimney
    out.push(boxC([(c.x0 + c.x1) / 2, c.top / 2, (c.z0 + c.z1) / 2], [c.x1 - c.x0, c.top, c.z1 - c.z0]))
  }
  if (h.carport) {
    const c = h.carport
    out.push(boxC([(c.x0 + c.x1) / 2, c.top - 0.1, (c.z0 + c.z1) / 2], [c.x1 - c.x0, 0.2, c.z1 - c.z0]))
    for (const [x, z] of c.posts) out.push(boxC([x, (c.top - 0.2) / 2, z], [0.2, c.top - 0.2, 0.2]))
  }
  if (h.garage) {
    const g = h.garage
    out.push(boxC([(g.x0 + g.x1) / 2, g.top - 0.1, (g.z0 + g.z1) / 2], [g.x1 - g.x0 + 0.2, 0.2, g.z1 - g.z0]))
  }
  return out
}

/* ---------------------------------------------------------------------------
 * The cul-de-sac, the road and the vehicles in it
 * ------------------------------------------------------------------------- */

/** Asphalt circle, its sidewalk ring, and the road out to the south. */
export const STREET = Object.freeze({
  r: 12,
  walk: 14.2,
  road: { x: 4.5, walk: 6.6, z0: 8, z1: 48 },
})
add({ type: 'acresGround' })

/** The school bus: front toward local -z, door on the right (+x). */
export const BUS = Object.freeze({ length: 10.6, width: 2.5, floor: 0.35, door: [-4.85, -3.65], rear: [-0.55, 0.55] })
add({ type: 'bus', p: [-2.2, 0, -5.4], rotY: -1.32 })

/** Semi truck: the trailer centred on `p`, cab ahead of it toward local -z, open side on -x with a ramp. */
export const SEMI = Object.freeze({
  trailer: { length: 9.0, width: 2.5, floor: 1.25, top: 3.7 },
  opening: [-2.2, 1.0],
  ramp: { z: -0.6, out: 3.2, width: 2.2 },
})
add({ type: 'semi', p: [6.4, 0, 5.6], rotY: 0.62 })

add({ type: 'jeep', p: [2.2, 0, 29.6], rotY: 0.35 })
add({ type: 'car', model: 'wagon', color: 'mint', p: [-25.2, 0, 8.1], rotY: -Math.PI / 2 })
add({ type: 'car', model: 'coupe', color: 'red', p: [15.9, 0, -9.3], rotY: Math.PI / 2 + 0.06 })
add({ type: 'car', model: 'pickup', color: 'sky', p: [-9.8, 0, 28.4], rotY: Math.PI - 0.08 })
add({ type: 'car', model: 'sedan', color: 'rust', p: [-33.5, 0, -36.5], rotY: 0.9, wreck: true })
add({ type: 'car', model: 'wagon', color: 'cream', p: [31.5, 0, -19.5], rotY: 0.05 })

/* ---------------------------------------------------------------------------
 * Water tower (north-west): legs, a deck ring round the tank, a ladder up.
 * ------------------------------------------------------------------------- */

export const WATER_TOWER = Object.freeze({
  p: [-30, 0, -30],
  leg: 2.3,
  deck: 9.6,
  ringIn: 3.0,
  ringOut: 4.3,
  tank: { r: 3.0, h: 4.2, roof: 1.6 },
})
add({ type: 'waterTower', ...WATER_TOWER })

export const ACRES_LADDERS = Object.freeze([
  ladder([WATER_TOWER.p[0], WATER_TOWER.p[2] + WATER_TOWER.ringOut + 0.05], [0, 0, -1], WATER_TOWER.deck, [0.3, 0.32], 0.4),
])
for (const l of ACRES_LADDERS) add({ type: 'ladder', foot: l.foot, dir: l.exitDir, topY: l.topY, base: l.base, rungs: l.rungs })

/** The octagonal deck ring and its rail, as boxes (shared with the renderer). */
export function towerDeckPieces(t = WATER_TOWER) {
  const deck = []
  const rails = []
  const mid = (t.ringIn + t.ringOut) / 2
  const side = 2 * t.ringOut * Math.tan(Math.PI / 8)
  const railR = t.ringOut - 0.06
  const railSide = 2 * railR * Math.tan(Math.PI / 8)
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    // Segment facing direction a (k = 0 faces +z, the ladder side).
    const dir = [Math.sin(a), Math.cos(a)]
    deck.push({ p: [t.p[0] + dir[0] * mid, t.deck - 0.1, t.p[2] + dir[1] * mid], size: [side + 0.02, 0.2, t.ringOut - t.ringIn], yaw: a })
    const c = [t.p[0] + dir[0] * railR, t.p[2] + dir[1] * railR]
    if (k === 0) {
      // Gap where the ladder arrives.
      const half = (railSide - 0.9) / 2
      for (const s of [-1, 1]) {
        const off = s * (0.45 + half / 2)
        rails.push({ p: [c[0] + Math.cos(a) * off, c[1] - Math.sin(a) * off], len: half, yaw: a })
      }
    } else {
      rails.push({ p: c, len: railSide, yaw: a })
    }
  }
  return { deck, rails }
}

function waterTowerColliders(t) {
  const out = []
  const [cx, , cz] = t.p
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(boxC([cx + sx * t.leg, t.deck / 2, cz + sz * t.leg], [0.36, t.deck, 0.36]))
  const { deck, rails } = towerDeckPieces(t)
  for (const d of deck) out.push(boxC(d.p, d.size, yawQ(d.yaw)))
  for (const r of rails) {
    out.push(boxC([r.p[0], t.deck + 0.15, r.p[1]], [r.len, 0.3, 0.08], yawQ(r.yaw)))
    out.push(boxC([r.p[0], t.deck + 0.65, r.p[1]], [r.len, 0.7, 0.08], yawQ(r.yaw), MOVE_ONLY))
  }
  // The tank and the floor plate under it.
  out.push(cylC([cx, t.deck + t.tank.h / 2, cz], t.tank.r, t.tank.h))
  out.push(cylC([cx, t.deck + t.tank.h + t.tank.roof * 0.35, cz], t.tank.r * 0.6, t.tank.roof * 0.7))
  out.push(boxC([cx, t.deck - 0.1, cz], [t.ringIn * 2, 0.2, t.ringIn * 2]))
  return out
}

/* ---------------------------------------------------------------------------
 * Pool (south-east): sunk into the ground, steps at the shallow end.
 * ------------------------------------------------------------------------- */

export const POOL = Object.freeze({ x0: 14, x1: 22, z0: 22, z1: 27, floor: -1.4, steps: { z: 24.5, width: 1.6, run: 2.9 } })
add({ type: 'pool', ...POOL })

function poolColliders(p) {
  // The steps start under the lip of the deck, so there's no gap at the top.
  const bottom = rampBox([p.x0 - 0.05, 0, p.steps.z], [p.x0 + p.steps.run, p.floor, p.steps.z], p.steps.width, 0.2)
  return [
    boxC([(p.x0 + p.x1) / 2, p.floor - 0.1, (p.z0 + p.z1) / 2], [p.x1 - p.x0, 0.2, p.z1 - p.z0]),
    boxC(bottom.p, bottom.size, bottom.q),
  ]
}

/** The ground slab, with the pool cut out of it. */
function groundColliders() {
  const { x0, x1, z0, z1 } = POOL
  const E = 100
  const slab = (ax, bx, az, bz) => boxC([(ax + bx) / 2, -1, (az + bz) / 2], [bx - ax, 2, bz - az])
  return [slab(-E, E, -E, z0), slab(-E, E, z1, E), slab(-E, x0, z0, z1), slab(x1, E, z0, z1)]
}

/* ---------------------------------------------------------------------------
 * Fences, hedges, trees and walls
 * ------------------------------------------------------------------------- */

/** Wooden privacy fences round the backyards: [ax, az, bx, bz]. */
export const PRIVACY_FENCES = Object.freeze([
  [-42, -14, -36.6, -14], [-35.0, -14, -30.4, -14],
  [-42, 12, -37.2, 12], [-35.6, 12, -30.4, 12],
  [30.4, -14, 35.0, -14], [36.6, -14, 42, -14],
  [30.4, 12, 35.4, 12], [37.0, 12, 42, 12],
  // Round the pool lot.
  [33, 16, 42, 16],
  // Between the cottage's backyard and the west backyard lane.
  [-42, 18, -27.5, 18],
])
for (const f of PRIVACY_FENCES) add({ type: 'privacyFence', a: [f[0], f[1]], b: [f[2], f[3]] })

/** White picket fences along the front lawns. */
export const PICKET_FENCES = Object.freeze([
  [-15.4, -13.0, -15.4, -6.2],
  [15.4, -4.0, 15.4, -0.6],
  [15.4, 2.6, 15.4, 11.0],
  [-11.6, 17.0, -11.6, 24.0],
  [-11.6, 26.4, -11.6, 33.0],
  [-11.6, 33.0, -24.0, 33.0],
])
for (const f of PICKET_FENCES) add({ type: 'picketFence', a: [f[0], f[1]], b: [f[2], f[3]] })

/** Low fieldstone wall and gate pillars in front of the yellow house. */
export const STONE_WALLS = Object.freeze([
  [-15.2, -6.0, -15.2, -2.5],
  [-15.2, 0.5, -15.2, 3.8],
])
for (const w of STONE_WALLS) add({ type: 'stoneWall', a: [w[0], w[1]], b: [w[2], w[3]], h: 0.75 })
for (const z of [-2.3, 0.3]) add({ type: 'pillar', p: [-15.2, 0, z] })

/** Low concrete planters along the orange house's front. */
for (const [x0, x1] of [[14.2, 18.4], [21.8, 26.8]]) add({ type: 'planter', a: [x0, -22.6], b: [x1, -22.6] })

/** Hedges: [x, z, length, rotY]. */
const hedges = [
  [-8.5, -26, 6, 0], [8, -31, 5, 0], [-1.5, -36.5, 7, 0], [12.6, -17.5, 4.5, Math.PI / 2],
  [-18.5, -11.2, 4.5, 0], [-9.6, 18.6, 3.6, Math.PI / 2], [9.6, 15.8, 6, 0],
  [-36.5, 4.5, 3.2, Math.PI / 2], [36.8, -4.0, 3.2, Math.PI / 2], [-6.5, -16.8, 3.0, 0.3],
  [26.5, 14.5, 4.0, 0], [-31.5, 27.5, 3.5, Math.PI / 2],
]
for (const [x, z, length, rotY] of hedges) add({ type: 'hedge', p: [x, 0, z], length, rotY })

const trees = [
  [-11.5, -17.5, 1.0], [11, -21.5, 1.1], [-6.5, -31.5, 0.9], [10.5, -37.5, 1.2], [-17.5, -38.5, 1.1],
  [-36.8, -2.0, 1.0], [37.2, 6.0, 1.1], [-9.6, 13.6, 0.9], [12.5, 35, 1.0], [-30.5, 38.5, 1.2],
  [35, -33, 1.1], [-20.5, 15.6, 0.8], [33, -24.5, 0.9], [-1.5, -41, 1.0], [24, 38.5, 1.0], [-38.5, 27.5, 1.0],
]
for (const [x, z, s] of trees) add({ type: 'tree', p: [x, 0, z], s })

/* ---------------------------------------------------------------------------
 * Street furniture and yard props
 * ------------------------------------------------------------------------- */

// Globe lamps round the circle and down the road.
for (const [x, z] of [[-10.1, -10.1], [10.1, -10.1], [-10.1, 10.1], [10.1, 10.1], [-5.6, 24], [5.6, 34]]) add({ type: 'globeLamp', p: [x, 0, z] })

export const ACRES_POWER_LINES = Object.freeze([
  [[-40, -40.6], [-24, -40.6], [-8, -40.6], [8, -40.6], [24, -40.6], [40, -40.6]],
  [[-17.4, -13.6], [0, -16.6], [17.4, -15.4]],
  [[-7.2, 16], [-7.2, 29], [-7.2, 41.5]],
])
for (const line of ACRES_POWER_LINES) for (const [x, z] of line) add({ type: 'pole', p: [x, 0, z] })
add({ type: 'powerlines', lines: ACRES_POWER_LINES })

add({ type: 'streetSign', p: [-5.4, 0, 15.6], rotY: 0.6, names: ['MESA DR', 'ATOMIC WAY'] })
add({ type: 'welcomeSign', p: [0, 0, -21.5], rotY: 0 })
add({ type: 'mailbox', p: [-14.6, 0, 4.4], rotY: -Math.PI / 2 })
add({ type: 'mailbox', p: [14.8, 0, 2.0], rotY: Math.PI / 2 })
add({ type: 'mailbox', p: [-11.0, 0, 24.3], rotY: -Math.PI / 2 })
add({ type: 'hydrant', p: [7.4, 0, 18.5] })
add({ type: 'hydrant', p: [-13.4, 0, -6.6] })

// The road out is closed: jersey barriers, wire and the army jeep.
for (const [x, rotY] of [[-3.0, 0.08], [0.2, -0.05], [3.4, 0.12]]) add({ type: 'barrier', p: [x, 0, 33.6], rotY, length: 3 })
add({ type: 'wire', a: [-6.5, 35.2], b: [6.5, 35.2] })
add({ type: 'sawhorse', p: [-1.5, 0, 31.6], rotY: 0.1 })
add({ type: 'sawhorse', p: [2.8, 0, 32.0], rotY: -0.2 })

// Park to the north.
add({ type: 'picnicTable', p: [5.4, 0, -24.5], rotY: 0.3 })
add({ type: 'picnicTable', p: [-6.8, 0, -21.5], rotY: -0.2 })
add({ type: 'swingSet', p: [-4.2, 0, -29.6], rotY: 0 })
add({ type: 'slide', p: [4.6, 0, -34.6], rotY: 0.5 })
add({ type: 'shelter', p: [4.2, 0, -28.4], rotY: -0.4 })
add({ type: 'bench', p: [-11.6, 0, -24], rotY: Math.PI / 2 })
add({ type: 'bench', p: [11.8, 0, -27], rotY: -Math.PI / 2 })

// Backyards.
add({ type: 'picnicTable', p: [-36.5, 0, -8.5], rotY: Math.PI / 2 })
add({ type: 'bbq', p: [-33.6, 0, 1.8], rotY: 0 })
add({ type: 'clothesline', a: [-40.5, -11.5], b: [-40.5, -4.5] })
add({ type: 'swingSet', p: [40.4, 0, -5.4], rotY: Math.PI / 2 })
add({ type: 'patioSet', p: [34.2, 0, 3.2], rotY: 0 })
add({ type: 'doghouse', p: [40, 0, 8.5], rotY: -Math.PI / 2 })
add({ type: 'trashCans', p: [-31.2, 0, 10.2], rotY: 0 })
add({ type: 'trashCans', p: [30.8, 0, -12.0], rotY: Math.PI })

// Pool deck.
add({ type: 'lounger', p: [16.2, 0, 29.0], rotY: 0.1 })
add({ type: 'lounger', p: [19.0, 0, 29.2], rotY: -0.1 })
add({ type: 'umbrella', p: [24.0, 0, 21.0] })
add({ type: 'divingBoard', p: [22.6, 0, 24.5], rotY: -Math.PI / 2 })

// Lots of moving boxes by the truck, junk in the north-west lot.
add({ type: 'boxPile', p: [-1.4, 0, 10.4], rotY: 0.4 })
add({ type: 'boxPile', p: [11.6, 0, 9.4], rotY: -0.3 })
add({ type: 'tyres', p: [-36.4, 0, -28.8] })
add({ type: 'tyres', p: [-24.6, 0, -24.4] })
add({ type: 'oilDrums', p: [-38.4, 0, -33.6] })
add({ type: 'woodPile', p: [-26.0, 0, -36.8], rotY: 0.3 })

export const ACRES_AMMO = Object.freeze([
  { p: [29.0, 0, 28.6], radius: 1.7, cooldown: 20, rotY: 0 },
  { p: [-38.9, 0, -20.4], radius: 1.7, cooldown: 20, rotY: Math.PI / 2 },
])
for (const a of ACRES_AMMO) add({ type: 'ammoCrate', p: a.p, size: [1.0, 0.6, 0.6], rotY: a.rotY })

/** The town's famous residents: shop-window mannequins, posed round the place. */
const mannequins = [
  [-17.2, -4.2, 1.6, 'wave'], [-20.0, 3.9, -Math.PI / 2, 'window'], [19.75, 2.6, Math.PI / 2, 'window', 3.2],
  [3.2, -23.6, Math.PI, 'stand'], [-13.6, 22.4, -Math.PI / 2, 'wave'], [20.2, -23.4, 0.2, 'stand'],
  [31.4, -4.2, -Math.PI / 2, 'stand'], [-31.6, 4.2, Math.PI / 2, 'hips'], [17.6, 21.0, 0.6, 'hips'],
  [-29.4, -1.4, Math.PI / 2, 'window', 3.2],
]
for (const [x, z, rotY, pose, y = 0] of mannequins) add({ type: 'mannequin', p: [x, y, z], rotY, pose })

/* ---------------------------------------------------------------------------
 * Furniture: low cover inside the houses. [kind, x, z, w, h, d, rotY, y]
 * ------------------------------------------------------------------------- */

const furniture = [
  // Yellow house, ground floor: living room (front) and kitchen (back).
  ['sofa', -23.7, 2.8, 0.9, 0.85, 2.2, 0],
  ['coffeeTable', -22.0, 2.8, 0.7, 0.42, 1.2, 0],
  ['tv', -19.65, -4.4, 0.5, 0.95, 1.0, 0],
  ['armchair', -21.8, -3.2, 0.85, 0.9, 0.85, -0.6],
  ['counter', -27.4, 4.45, 4.4, 0.95, 0.6, 0],
  ['fridge', -29.4, -4.6, 0.7, 1.8, 0.7, 0],
  ['stove', -29.45, -2.9, 0.65, 0.95, 0.7, 0],
  ['diningTable', -27.4, 0.2, 1.5, 0.78, 0.95, 0],
  // Yellow house, upstairs.
  ['bed', -21.2, 2.6, 1.6, 0.62, 2.1, 0, 3.2],
  ['dresser', -24.0, 0.6, 0.55, 1.1, 1.3, 0, 3.2],
  ['bed', -28.4, 3.4, 2.1, 0.62, 1.5, 0, 3.2],
  ['wardrobe', -29.45, -4.4, 0.6, 2.0, 1.3, 0, 3.2],
  // Green house, ground floor: living room (front) and kitchen (back).
  ['sofa', 23.7, -2.8, 0.9, 0.85, 2.2, Math.PI],
  ['coffeeTable', 22.0, -2.8, 0.7, 0.42, 1.2, 0],
  ['piano', 19.55, 4.6, 0.6, 1.25, 1.5, 0],
  ['counter', 28.2, -4.45, 2.8, 0.95, 0.6, 0],
  ['fridge', 29.4, 4.8, 0.7, 1.8, 0.7, 0],
  ['diningTable', 27.4, 0.0, 1.5, 0.78, 0.95, 0],
  // Green house, upstairs.
  ['bed', 21.0, -0.2, 1.6, 0.62, 2.1, 0, 3.2],
  ['dresser', 24.0, -0.4, 0.55, 1.1, 1.3, 0, 3.2],
  ['bed', 28.4, -3.6, 2.1, 0.62, 1.5, 0, 3.2],
  ['bookshelf', 29.5, 2.0, 0.45, 1.9, 1.4, 0, 3.2],
  // Green garage.
  ['workbench', 28.4, -11.0, 0.8, 0.95, 2.4, 0],
  ['shelf', 23.0, -12.15, 2.2, 1.9, 0.5, 0],
  ['washer', 28.5, -6.2, 0.7, 0.95, 0.7, 0],
  // Orange house: open living space and the bedroom behind.
  ['island', 24.2, -33.0, 2.4, 0.95, 0.9, 0],
  ['counter', 23.5, -35.45, 2.6, 0.95, 0.6, 0],
  ['sofa', 17.4, -28.2, 2.4, 0.8, 0.9, 0],
  ['coffeeTable', 17.4, -26.9, 1.2, 0.4, 0.6, 0],
  ['tv', 22.4, -25.55, 1.4, 0.9, 0.45, 0],
  ['bed', 16.6, -33.6, 2.0, 0.6, 1.6, 0],
  ['wardrobe', 21.4, -35.45, 1.4, 2.0, 0.6, 0],
  // Cottage.
  ['bed', -17.2, 28.2, 1.5, 0.6, 2.0, 0],
  ['dresser', -19.4, 22.0, 0.55, 1.1, 1.2, 0],
  ['counter', -24.4, 23.8, 0.6, 0.95, 3.0, 0],
  ['diningTable', -22.4, 27.0, 1.2, 0.78, 0.9, 0],
  // Pool house.
  ['shelf', 31.5, 26.2, 0.45, 1.8, 1.6, 0],
  ['bench', 27.4, 29.4, 1.6, 0.45, 0.45, 0],
  // Inside the trailer: see `semiColliders`.
]
export const FURNITURE = Object.freeze(furniture.map(([kind, x, z, w, h, d, rotY = 0, y = 0]) => ({ kind, p: [x, y, z], size: [w, h, d], rotY })))
add({ type: 'furniture' })

/* ---------------------------------------------------------------------------
 * Boundary and backdrop
 * ------------------------------------------------------------------------- */

add({ type: 'acresPerimeter' })
add({ type: 'acresBackdrop' })

export const ACRES_ENTITIES = Object.freeze(entities)

/* ---------------------------------------------------------------------------
 * Vehicle colliders (local frame: front toward -z, +x to the right)
 * ------------------------------------------------------------------------- */

function localBoxes(e, list) {
  const q = yawQ(e.rotY)
  return list.map(([lx, y0, lz, w, h, d, group]) => {
    const o = yawOffset(e.p, lx, lz, e.rotY)
    return boxC([o[0], e.p[1] + y0 + h / 2, o[2]], [w, h, d], q, group)
  })
}

/** Bus pieces: [lx, y0, lz, w, h, d] boxes in the bus's frame (shared with the renderer). */
export function busPieces() {
  const { length: L, width: W, floor: F, door: [d0, d1], rear: [r0, r1] } = BUS
  const half = L / 2
  const t = 0.08
  const sideX = W / 2 - t / 2
  const winBot = 1.25
  const winTop = 2.2
  const roof = 2.55
  const doorTop = 2.35
  const out = []
  // Body under the floor, and the floor.
  out.push([0, 0, 0, W - 0.3, F - 0.2, L - 0.6])
  out.push([0, F - 0.2, 0, W, 0.2, L])
  // Left side: solid below the windows, posts between them, a band above.
  const posts = []
  for (let z = -half + 0.9; z <= half - 0.5; z += 1.05) posts.push(z)
  out.push([-sideX, F, 0, t, winBot - F, L])
  for (const z of posts) out.push([-sideX, winBot, z, t, winTop - winBot, 0.12])
  out.push([-sideX, winTop, 0, t, roof - winTop, L])
  // Right side: the same, round the door.
  out.push([sideX, F, (-half + d0) / 2, t, winBot - F, d0 + half])
  out.push([sideX, F, (d1 + half) / 2, t, winBot - F, half - d1])
  for (const z of posts) if (z < d0 - 0.1 || z > d1 + 0.1) out.push([sideX, winBot, z, t, winTop - winBot, 0.12])
  out.push([sideX, winTop, (-half + d0) / 2, t, roof - winTop, d0 + half])
  out.push([sideX, winTop, (d1 + half) / 2, t, roof - winTop, half - d1])
  out.push([sideX, doorTop, (d0 + d1) / 2, t, roof - doorTop, d1 - d0])
  // Front: dash below the windscreen, header above it; the engine hood ahead.
  out.push([0, F, -half + t / 2, W, winBot + 0.1 - F, t])
  out.push([0, winTop, -half + t / 2, W, roof - winTop, t])
  out.push([0, 0.25, -half - 0.55, W - 0.2, 1.0, 1.1])
  // Rear: wall round the emergency door.
  out.push([(-W / 2 + r0) / 2, F, half - t / 2, r0 + W / 2, roof - F, t])
  out.push([(r1 + W / 2) / 2, F, half - t / 2, W / 2 - r1, roof - F, t])
  out.push([(r0 + r1) / 2, doorTop, half - t / 2, r1 - r0, roof - doorTop, t])
  // Roof.
  out.push([0, roof, 0, W, 0.15, L])
  return out
}

/** Bench seats either side of the aisle: [lx, lz]. */
export function busSeats() {
  const out = []
  const x = BUS.width / 2 - 0.08 - 0.36
  for (let z = -BUS.length / 2 + 2.3; z <= BUS.length / 2 - 0.7; z += 0.86) {
    out.push([-x, z])
    if (z > BUS.door[1] + 0.3) out.push([x, z])
  }
  return out
}

function busColliders(e) {
  const seats = busSeats().map(([x, z]) => [x, BUS.floor, z, 0.7, 0.95, 0.45])
  return localBoxes(e, [...busPieces(), ...seats])
}

/** Trailer pieces in the trailer's frame, and the cab ahead of it. */
export function semiPieces() {
  const { length: L, width: W, floor: F, top } = SEMI.trailer
  const half = L / 2
  const [o0, o1] = SEMI.opening
  const t = 0.08
  const sx = W / 2 - t / 2
  const openTop = 3.3
  return [
    // Chassis under the trailer and its floor.
    [0, 0.4, 0, W - 0.5, F - 0.2 - 0.4, L - 0.4],
    [0, F - 0.2, 0, W, 0.2, L],
    // Closed right side, front and rear walls, roof.
    [sx, F, 0, t, top - F, L],
    [0, F, -half + t / 2, W, top - F, t],
    [0, F, half - t / 2, W, top - F, t],
    [0, top, 0, W, 0.12, L],
    // Left side, round the opening.
    [-sx, F, (-half + o0) / 2, t, top - F, o0 + half],
    [-sx, F, (o1 + half) / 2, t, top - F, half - o1],
    [-sx, openTop, (o0 + o1) / 2, t, top - openTop, o1 - o0],
    // Tractor: chassis, hood and cab.
    [0, 0.3, -half - 2.6, 1.9, 0.45, 4.6],
    [0, 0.75, -half - 4.35, 2.1, 1.2, 1.7],
    [0, 0.75, -half - 2.45, 2.4, 2.25, 2.1],
  ]
}

/** Stuff packed in the trailer: [lx, lz, w, h, d] on its floor. */
export const SEMI_CARGO = Object.freeze([
  [0.45, -3.6, 1.4, 1.2, 1.0],
  [0.5, -2.2, 0.75, 1.75, 0.75],
  [0.75, 0.4, 0.85, 0.8, 2.1],
  [-0.35, 2.7, 1.5, 0.95, 1.4],
  [0.7, 3.8, 0.9, 1.6, 0.9],
])

function semiColliders(e) {
  const F = SEMI.trailer.floor
  const cargo = SEMI_CARGO.map(([x, z, w, h, d]) => [x, F, z, w, h, d])
  const out = localBoxes(e, [...semiPieces(), ...cargo])
  // Ramp from the side opening down to the street.
  const { z, out: reach, width } = SEMI.ramp
  const at = (lx, y) => {
    const o = yawOffset(e.p, lx, z, e.rotY)
    return [o[0], y, o[2]]
  }
  const r = rampBox(at(-SEMI.trailer.width / 2 + 0.05, F), at(-SEMI.trailer.width / 2 - reach, 0.02), width, 0.12)
  out.push(boxC(r.p, r.size, r.q))
  return out
}

/** Car bodies by model: lower body and cabin, [w, h0, h1, length, cabin z0, z1, cabin w]. */
export const CAR_MODELS = Object.freeze({
  wagon: { w: 1.95, body: [0.32, 1.02], length: 5.3, cabin: [-0.9, 2.45], cabinTop: 1.58, cabinW: 1.78 },
  coupe: { w: 1.95, body: [0.3, 0.98], length: 5.0, cabin: [-0.2, 1.5], cabinTop: 1.45, cabinW: 1.7 },
  sedan: { w: 1.9, body: [0.32, 1.0], length: 4.9, cabin: [-0.7, 1.3], cabinTop: 1.52, cabinW: 1.72 },
  pickup: { w: 1.95, body: [0.42, 1.12], length: 5.2, cabin: [-1.0, 0.4], cabinTop: 1.85, cabinW: 1.8, bed: true },
  /** Hollow Creek's van: cab windows up front, a panelled box behind. */
  van: { w: 2.0, body: [0.36, 1.08], length: 5.0, cabin: [-1.85, 2.45], cabinTop: 2.12, cabinW: 1.94, van: true },
})

function carColliders(e) {
  const m = CAR_MODELS[e.model]
  const [y0, y1] = m.body
  const [c0, c1] = m.cabin
  return localBoxes(e, [
    [0, y0, 0, m.w, y1 - y0, m.length],
    [0, y1, (c0 + c1) / 2, m.cabinW, m.cabinTop - y1, c1 - c0],
  ])
}

function jeepColliders(e) {
  return localBoxes(e, [
    [0, 0.42, 0, 1.75, 0.82, 3.7],
    [0, 1.24, -0.55, 1.6, 0.42, 0.08],
  ])
}

/* ---------------------------------------------------------------------------
 * Collider generation
 * ------------------------------------------------------------------------- */

const lineBox = (a, b, h, thick, y0 = 0, group) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
  return boxC([(a[0] + b[0]) / 2, y0 + h / 2, (a[1] + b[1]) / 2], [len, h, thick], yawQ(yaw), group)
}

const COLLIDER_BUILDERS = {
  house: (e) => houseColliders(houseOf(e.id)),
  bus: busColliders,
  semi: semiColliders,
  jeep: jeepColliders,
  car: carColliders,
  waterTower: waterTowerColliders,
  pool: poolColliders,
  privacyFence: (e) => [lineBox(e.a, e.b, 1.95, 0.12)],
  picketFence: (e) => [lineBox(e.a, e.b, 0.95, 0.1, 0, MOVE_ONLY)],
  stoneWall: (e) => [lineBox(e.a, e.b, e.h, 0.45)],
  pillar: (e) => [boxC([e.p[0], 0.7, e.p[2]], [0.5, 1.4, 0.5])],
  planter: (e) => [lineBox(e.a, e.b, 0.65, 0.7)],
  hedge: (e) => [groundBox(e.p, [e.length, 1.45, 0.95], e.rotY)],
  tree: (e) => [cylC([e.p[0], 1.6, e.p[2]], 0.26 * e.s, 3.2)],
  globeLamp: (e) => [cylC([e.p[0], 1.9, e.p[2]], 0.1, 3.8)],
  pole: (e) => [cylC([e.p[0], 3.5, e.p[2]], 0.14, 7)],
  streetSign: (e) => [cylC([e.p[0], 1.5, e.p[2]], 0.05, 3.0)],
  welcomeSign: (e) => [groundBox(e.p, [6.4, 1.0, 1.3], e.rotY), groundBox([e.p[0], 1.0, e.p[2]], [6.0, 2.8, 0.35], e.rotY)],
  mailbox: (e) => [cylC([e.p[0], 0.55, e.p[2]], 0.12, 1.1)],
  hydrant: (e) => [cylC([e.p[0], 0.4, e.p[2]], 0.17, 0.8)],
  barrier: (e) => [groundBox(e.p, [e.length, 1.0, 0.62], e.rotY)],
  sawhorse: (e) => [groundBox(e.p, [1.8, 1.0, 0.5], e.rotY, MOVE_ONLY)],
  picnicTable: (e) => [groundBox(e.p, [1.9, 0.78, 1.6], e.rotY)],
  shelter: (e) => [groundBox(e.p, [2.2, 1.1, 2.2], e.rotY)],
  bench: (e) => [groundBox(e.p, [1.7, 0.85, 0.55], e.rotY)],
  bbq: (e) => [cylC([e.p[0], 0.5, e.p[2]], 0.35, 1.0)],
  patioSet: (e) => [cylC([e.p[0], 0.37, e.p[2]], 0.6, 0.74)],
  doghouse: (e) => [groundBox(e.p, [1.2, 1.2, 1.1], e.rotY)],
  trashCans: (e) => {
    const out = []
    for (const s of [-0.35, 0.35]) {
      const o = yawOffset(e.p, s, 0, e.rotY)
      out.push(cylC([o[0], 0.48, o[2]], 0.3, 0.96))
    }
    return out
  },
  lounger: (e) => [groundBox(e.p, [0.7, 0.5, 1.9], e.rotY)],
  boxPile: (e) => [groundBox(e.p, [1.6, 1.0, 1.2], e.rotY), groundBox([e.p[0], 1.0, e.p[2]], [0.8, 0.7, 0.8], e.rotY + 0.3)],
  tyres: (e) => [cylC([e.p[0], 0.5, e.p[2]], 0.48, 1.0)],
  oilDrums: (e) => [groundBox(e.p, [1.4, 0.95, 1.4], 0.2)],
  woodPile: (e) => [groundBox(e.p, [2.4, 0.9, 1.0], e.rotY)],
  ammoCrate: (e) => [groundBox(e.p, e.size, e.rotY)],
  mannequin: (e) => [cylC([e.p[0], e.p[1] + 0.9, e.p[2]], 0.22, 1.8)],
  furniture: () => FURNITURE.map((f) => groundBox(f.p, f.size, f.rotY)),
  acresPerimeter: () => [...boundaryColliders(ACRES_HALF, ACRES_HALF), ...groundColliders()],
}

let colliderCache = null

/** Flat, cached list of every collider in the map. Identical on client and server. */
export function buildAcresColliders() {
  if (colliderCache) return colliderCache
  const out = []
  for (const e of ACRES_ENTITIES) {
    const build = COLLIDER_BUILDERS[e.type]
    if (build) out.push(...build(e))
  }
  colliderCache = Object.freeze(out)
  return colliderCache
}

export const acresLadderAt = (x, y, z) => ladderIn(ACRES_LADDERS, x, y, z)

/* ---------------------------------------------------------------------------
 * Spawns
 * ------------------------------------------------------------------------- */

const spawn = (x, z, faceX = 0, faceZ = 0) => ({ p: [x, 0, z], yaw: Math.atan2(-(faceX - x), -(faceZ - z)) })

export const ACRES_SPAWNS = Object.freeze({
  // TDM: the two backyards.
  [TEAMS.ALPHA]: [spawn(-38.5, -9.5), spawn(-38.5, -3.5), spawn(-38.5, 2.5), spawn(-38.5, 8.5), spawn(-34, -11.5), spawn(-34, 9.6)],
  [TEAMS.BRAVO]: [spawn(38.5, -9.5), spawn(38.5, -3.5), spawn(38.5, 2.5), spawn(38.5, 8.5), spawn(34, -11.5), spawn(34, 9.6)],
  ffa: [
    spawn(-38, -38),
    spawn(0, -39),
    spawn(38, -38),
    spawn(39, 0),
    spawn(38, 38),
    spawn(0, 39.5),
    spawn(-38, 38),
    spawn(-39, 0),
    spawn(-21, -19),
    spawn(28, 19),
  ],
})

/* ---------------------------------------------------------------------------
 * Bot navigation (see map.js): grid + doorways + the routes upstairs.
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

const at3 = (e, lx, y, lz) => {
  const o = yawOffset(e.p, lx, lz, e.rotY)
  return [o[0], y, o[2]]
}
const busE = ACRES_ENTITIES.find((e) => e.type === 'bus')
const semiE = ACRES_ENTITIES.find((e) => e.type === 'semi')

export const ACRES_NAV = Object.freeze({
  grid: { spacing: 2.5, half: ACRES_HALF - 1.2 },
  root: [0, 9],
  linkUpper: true,
  extra: Object.freeze([
    ...doorNodes(),
    // The garage, carport and through the backyard gates.
    [21.5, 0, -9.2], [25.5, 0, -9.2], [-35.8, 0, -14], [-36.2, 0, 12], [35.8, 0, -14], [36.2, 0, 12],
  ]),
  chains: Object.freeze([
    // Yellow house: up the stairs, round the upper floor, out onto the carport roof.
    [[-19.9, 0, -6.3], [-21.4, 0.5, -6.3], [-24.6, 2.45, -6.3], [-26.7, 3.2, -6.2], [-28.0, 3.2, -4.4]],
    // Green house: up the stairs.
    [[19.9, 0, 6.3], [21.4, 0.5, 6.3], [24.6, 2.45, 6.3], [26.7, 3.2, 6.2], [28.0, 3.2, 4.4]],
    // The bus: in at the front door, down the aisle, out the back.
    [at3(busE, 2.2, 0, -4.25), at3(busE, 0.7, 0.35, -4.25), at3(busE, 0, 0.35, -3.4), at3(busE, 0, 0.35, -2.0), at3(busE, 0, 0.35, 1.5), at3(busE, 0, 0.35, 4.6), at3(busE, 0, 0, 6.2)],
    // The truck: up the ramp into the trailer.
    [at3(semiE, -5.2, 0, -0.6), at3(semiE, -3.4, 0.45, -0.6), at3(semiE, -0.6, 1.25, -0.6), at3(semiE, -0.4, 1.25, 1.6), at3(semiE, -0.65, 1.25, -3.0)],
    // Into the pool and along the bottom.
    [[12.8, 0, 24.5], [15.4, -0.7, 24.5], [17.6, -1.4, 24.5], [20.8, -1.4, 23.2]],
  ]),
  // Upstairs rooms and the balcony roofs (linked to each other and to the chain tops).
  upper: Object.freeze([
    [-28.0, 3.2, -1.0], [-26.4, 3.2, 2.2], [-25.4, 3.2, -4.0], [-23.6, 3.2, -4.0], [-21.4, 3.2, -4.2], [-21.4, 3.2, -0.6],
    [-23.0, 3.2, 2.4], [-23.0, 3.2, 4.2], [-21.8, 3.2, 4.25], [-21.8, 3.2, 6.6], [-25.0, 3.2, 8.4], [-28.6, 3.2, 8.4],
    [28.0, 3.2, 1.0], [26.4, 3.2, -2.2], [25.4, 3.2, 3.6], [23.6, 3.2, 3.6], [21.4, 3.2, 2.6], [23.0, 3.2, -1.0],
    [21.4, 3.2, -3.8], [22.8, 3.2, -4.1], [22.8, 3.2, -6.4], [25.0, 3.2, -9.0], [21.2, 3.2, -11.0],
  ]),
})
