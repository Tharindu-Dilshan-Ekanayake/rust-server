/**
 * "Old Quarter" — sun-baked backstreets round a building site, as data.
 *
 * The middle of the map is a construction site: the Skeleton, an unfinished
 * three-level concrete frame (block walls going up on the ground floor,
 * scaffolding, stud frames on the open top), a bulldozer, sand piles, stacks
 * of blocks and a site container. Round it: the apartments to the north (two
 * storeys over balconies with square-pattern iron railings, a stairwell up to
 * the roof), the teahouse and its courtyard (north-west), the workshop
 * (north-east), tin shacks and the west house (west, Alpha's side), the east
 * block with stairs up its outside to the roof (east, Bravo's side), and along
 * Market Street to the south the market hall, a courtyard house and two
 * little houses by a car park. Power lines everywhere, palms in the yards,
 * dry grass in the corners.
 *
 * Coordinates are metres. +X is east, -Z north, +Y up, ground y = 0. The arena
 * is 80 x 80 m. Everything is listed once as entities; the client draws them
 * and BOTH sides build their physics from `buildQuarterColliders()`.
 */
import { TEAMS } from './constants.js'
import { CAR_MODELS } from './mapAcres.js'
import { buildingColliders as shackColliders, buildingOpenings as shackOpenings } from './mapPalmwood.js'
import { boundaryColliders, boxC, cylC, groundBox, IDENTITY_Q, ladder, ladderIn, MOVE_ONLY, quatFromEuler, quatMultiply, rampBox, wallPieces, yawOffset, yawQ } from './mapKit.js'

export const QUARTER_NAME = 'Old Quarter'
export const QUARTER_HALF = 40

const entities = []
const add = (e) => {
  entities.push(e)
  return e
}

/* ---------------------------------------------------------------------------
 * Masonry buildings
 *
 * Axis-aligned boxes of rooms, any number of storeys. `x0..x1, z0..z1` are the
 * outer faces of the walls. Each floor has its level `y` and height `h` (to
 * the next floor, or to the roof slab), and lists its wall openings per side
 * ('n' 's' 'w' 'e', null for no wall at all), measured along the wall in world
 * x (north/south walls) or world z (west/east walls), `bottom`/`top` above the
 * floor. Upper floors stand on `slabs` (their top at the floor's level) with
 * `holes` cut for the stairs; a flat `roof` is the top slab with a parapet
 * (`gaps` where stairs arrive), walkable if `walk`. Stair `flights` are solid
 * concrete from `bottom` up to `top`; `landings` are solid blocks; `rails`
 * are banisters round the stair holes; `balconies` stick out of a wall with
 * iron railings.
 *
 * A `frame` building (the Skeleton) is the bare structure: columns, slabs over
 * the whole footprint, and block walls between them stopping under each slab.
 * ------------------------------------------------------------------------- */

/** Wall, inner wall and slab thickness; parapet coping. */
export const OQ_WALL_T = 0.25
export const OQ_INNER_T = 0.15
export const OQ_SLAB_T = 0.25
export const OQ_COL = 0.4

const door = (from, to, top = 2.3) => ({ from, to, bottom: 0, top, door: true })
const win = (from, to, bottom = 1.0, top = 2.2) => ({ from, to, bottom, top })
/** A shopfront: a wide opening with a roller shutter rolled up over it. */
const shop = (from, to, top = 2.6) => ({ from, to, bottom: 0, top, door: true, shop: true })
/** A wide garage door, its shutter rolled up. */
const garage = (from, to, top = 3.4) => ({ from, to, bottom: 0, top, door: true, shop: true, garage: true })
/** An open bay of an unfinished floor: a parapet (or nothing) below, open above. */
const bay = (from, to, bottom = 0) => ({ from, to, bottom, top: 99, bay: true })
/** A gap right down to the floor (a ladder or stairs arrive there). */
const gap = (from, to) => ({ from, to, bottom: 0, top: 99, door: true, bay: true })

export const BLOCKS = Object.freeze([
  {
    // The apartments: two storeys and a walkable roof over the north alley,
    // balconies on the south front, the stairwell at the west end.
    id: 'apartments',
    x0: -12,
    x1: 6,
    z0: -38,
    z1: -28,
    look: {
      tint: '#dcc9a3',
      inside: '#cdbfa2',
      floor: 'tile',
      shutters: '#4d6b55',
      rail: '#2c3a33',
      roofKit: { tanks: [[2.4, -35.6], [4.4, -35.6]], dishes: [[-1.6, -30.0, 0.6], [3.6, -30.2, 0.2]], ac: [['s', -2.0, 5.0], ['s', -2.6, 2.4], ['e', -34.4, 4.9]] },
    },
    floors: [
      {
        y: 0,
        h: 3.3,
        walls: {
          n: [win(-1.6, -0.2), win(2.0, 3.4)],
          s: [door(-9.0, -7.8), win(-6.4, -4.8), door(-1.6, -0.4), win(1.4, 3.0), win(3.8, 5.2)],
          w: [door(-31.2, -30.0)],
          e: [door(-33.2, -32.0)],
        },
        inner: [{ axis: 'z', at: -3.0, from: -37.75, to: -28.25, openings: [door(-31.6, -30.4)] }],
      },
      {
        y: 3.3,
        h: 3.3,
        walls: {
          n: [win(-1.6, -0.2), win(2.0, 3.4)],
          s: [door(-7.6, -6.4), win(-5.4, -3.8), door(0.6, 1.8), win(2.8, 4.4)],
          w: [win(-31.4, -30.0)],
          e: [win(-33.4, -32.0)],
        },
        inner: [{ axis: 'z', at: -3.0, from: -37.75, to: -28.25, openings: [door(-31.6, -30.4)] }],
      },
    ],
    slabs: [{ y: 3.3, holes: [[-10.4, -5.0, -37.75, -36.55]] }],
    roof: { parapet: 1.0, walk: true, holes: [[-10.4, -5.0, -36.55, -35.35]] },
    flights: [
      { bottom: [-10.4, 0, -37.15], top: [-5.0, 3.3, -37.15], width: 1.2, rail: 's' },
      { bottom: [-5.0, 3.3, -35.95], top: [-10.4, 6.6, -35.95], width: 1.2, rail: 'n' },
    ],
    rails: [
      [-10.4, -37.75, -10.4, -36.55, 3.3],
      [-10.4, -36.55, -5.0, -36.55, 6.6],
      [-5.0, -36.55, -5.0, -35.35, 6.6],
      [-10.4, -35.35, -5.0, -35.35, 6.6],
    ],
    balconies: [
      { side: 's', from: -9.0, to: -3.6, y: 3.3, depth: 1.5 },
      { side: 's', from: 0.0, to: 5.2, y: 3.3, depth: 1.5 },
    ],
  },
  {
    // The teahouse: one high room behind arched windows, the roof reached by
    // stairs up the courtyard side.
    id: 'teahouse',
    x0: -38,
    x1: -27,
    z0: -37,
    z1: -28,
    look: {
      tint: '#e6d5ae',
      inside: '#d6c4a0',
      floor: 'tile',
      shutters: '#7a4a2e',
      rail: '#2c2c2c',
      awnings: [['s', -34.8, -29.2, 2.75, '#b8452f']],
      roofKit: { tanks: [[-36.4, -35.4]], dishes: [[-30.2, -29.4, 2.4]], ac: [['n', -32.4, 2.3]] },
    },
    floors: [
      {
        y: 0,
        h: 3.4,
        walls: {
          n: [win(-35.2, -33.8), win(-31.2, -29.8)],
          s: [door(-36.6, -35.4), win(-34.4, -32.2, 0.9, 2.3), win(-31.4, -29.6, 0.9, 2.3), door(-28.8, -27.8)],
          w: [win(-33.4, -31.6)],
          e: [door(-36.6, -35.6)],
        },
      },
    ],
    roof: { parapet: 1.0, walk: true, gaps: [{ side: 'e', from: -35.3, to: -34.1 }] },
    flights: [{ bottom: [-26.4, 0, -28.4], top: [-26.4, 3.4, -34.0], width: 1.2, rail: 'e', outside: true }],
    landings: [{ x0: -27.0, x1: -25.6, z0: -35.4, z1: -34.0, y: 3.4, rails: [[-27.0, -35.4, -25.6, -35.4], [-25.6, -35.4, -25.6, -34.0]] }],
  },
  {
    // The west house: two storeys over the shacks, a balcony on its east side.
    id: 'westhouse',
    x0: -34,
    x1: -26,
    z0: -14,
    z1: -4,
    look: { tint: '#cdb698', inside: '#cbbd9f', floor: 'tile', shutters: '#3d5f7a', rail: '#2c3330', roofKit: { tanks: [[-32.6, -5.6]], dishes: [[-27.6, -12.4, 1.8]] } },
    floors: [
      {
        y: 0,
        h: 3.3,
        walls: {
          n: [],
          s: [door(-30.8, -29.6), win(-28.8, -27.2)],
          w: [win(-11.4, -9.8), door(-7.8, -6.6)],
          e: [win(-11.2, -9.6), door(-7.2, -6.0)],
        },
      },
      {
        y: 3.3,
        h: 3.3,
        walls: {
          n: [win(-31.4, -30.0), win(-28.6, -27.2)],
          s: [win(-32.4, -30.8), win(-28.6, -27.0)],
          w: [win(-9.8, -8.2)],
          e: [win(-11.4, -9.8), door(-8.2, -7.0)],
        },
      },
    ],
    slabs: [{ y: 3.3, holes: [[-33.0, -27.6, -13.75, -12.55]] }],
    roof: { parapet: 0.8 },
    flights: [{ bottom: [-33.0, 0, -13.15], top: [-27.6, 3.3, -13.15], width: 1.2, rail: 's', railFrom: 0.3 }],
    rails: [
      [-33.0, -12.55, -27.6, -12.55, 3.3],
      [-33.0, -13.75, -33.0, -12.55, 3.3],
    ],
    balconies: [{ side: 'e', from: -10.4, to: -5.0, y: 3.3, depth: 1.4 }],
  },
  {
    // The east block: two storeys and a walkable roof, the stairs up its
    // outside: up the west face to the first floor, round onto the north face
    // and up to the roof.
    id: 'eastblock',
    x0: 25,
    x1: 35,
    z0: -18,
    z1: -6,
    look: { tint: '#e8d9b9', inside: '#d2c4a6', floor: 'tile', shutters: '#5e4a7a', rail: '#2a2d33', roofKit: { tanks: [[33.4, -16.4]], dishes: [[27.0, -7.6, 2.8]], ac: [['e', -14.0, 4.9], ['s', 27.0, 2.5]] } },
    floors: [
      {
        y: 0,
        h: 3.3,
        walls: {
          n: [win(32.4, 33.8)],
          s: [door(28.6, 29.8), win(31.0, 33.0)],
          w: [door(-9.8, -8.6)],
          e: [win(-16.2, -14.6), door(-9.8, -8.6), win(-8.0, -6.6)],
        },
        inner: [{ axis: 'x', at: -12.0, from: 25.25, to: 34.75, openings: [door(29.4, 30.6)] }],
      },
      {
        y: 3.3,
        h: 3.3,
        walls: {
          n: [win(32.2, 33.6)],
          s: [win(26.4, 28.0), win(30.4, 32.4)],
          w: [door(-17.6, -16.6)],
          e: [win(-16.2, -14.6), win(-9.6, -8.0)],
        },
        inner: [{ axis: 'x', at: -12.0, from: 25.25, to: 34.75, openings: [door(29.4, 30.6)] }],
      },
    ],
    slabs: [{ y: 3.3, holes: [] }],
    roof: { parapet: 1.0, walk: true, gaps: [{ side: 'n', from: 30.5, to: 31.7 }] },
    flights: [
      { bottom: [24.4, 0, -11.6], top: [24.4, 3.3, -17.0], width: 1.2, rail: 'w', outside: true },
      { bottom: [25.0, 3.3, -18.6], top: [30.4, 6.6, -18.6], width: 1.2, rail: 'n', outside: true },
    ],
    landings: [
      { x0: 23.8, x1: 25.0, z0: -19.2, z1: -17.0, y: 3.3, rails: [[23.8, -19.2, 23.8, -17.0], [23.8, -19.2, 25.0, -19.2]] },
      { x0: 30.4, x1: 31.8, z0: -19.2, z1: -18.0, y: 6.6, rails: [[30.4, -19.2, 31.8, -19.2], [31.8, -19.2, 31.8, -18.0]] },
    ],
  },
  {
    // The workshop: one tall storey, two garage bays, a ladder up its east end.
    id: 'workshop',
    x0: 24,
    x1: 37,
    z0: -38,
    z1: -29,
    look: { tint: '#c3b8a4', inside: '#b8ae9c', floor: 'concrete', roofKit: { tanks: [[26.0, -36.6]], ac: [['w', -31.4, 3.0]] } },
    floors: [
      {
        y: 0,
        h: 4.2,
        walls: {
          s: [garage(25.4, 29.4), garage(30.6, 34.6), door(35.4, 36.4)],
          n: [win(27.0, 29.0, 1.8, 3.0), win(32.0, 34.0, 1.8, 3.0)],
          w: [door(-34.6, -33.4)],
          e: [win(-36.0, -34.4, 1.6, 2.8)],
        },
      },
    ],
    roof: { parapet: 0.6, walk: true, gaps: [{ side: 'e', from: -31.6, to: -30.4 }] },
  },
  {
    // A corner shop on the north side.
    id: 'shop',
    x0: 9,
    x1: 16,
    z0: -37,
    z1: -30,
    look: { tint: '#d9b78f', inside: '#cbb99a', floor: 'tile', awnings: [['s', 9.6, 13.4, 2.75, '#2f6f5a']] },
    floors: [
      {
        y: 0,
        h: 3.4,
        walls: { s: [shop(10.0, 13.0, 2.5), door(14.0, 15.2)], e: [win(-34.8, -33.2)], w: [], n: [] },
      },
    ],
    roof: { parapet: 0.6 },
  },
  {
    // The market hall: shops along Market Street under a striped awning, a
    // back room, stairs up to the long first-floor room over the street.
    id: 'markethall',
    x0: -38,
    x1: -24,
    z0: 19,
    z1: 30,
    look: { tint: '#d6b68e', inside: '#ccbc9c', floor: 'tile', shutters: '#3d6a8a', rail: '#2a2a2a', awnings: [['n', -37.2, -28.8, 2.85, '#3d6a8a']], roofKit: { tanks: [[-26.0, 28.0]], dishes: [[-36.4, 28.6, 3.0]] } },
    floors: [
      {
        y: 0,
        h: 3.3,
        walls: {
          n: [shop(-36.8, -33.8), shop(-32.6, -29.6), door(-27.8, -26.6)],
          s: [door(-36.4, -35.2)],
          w: [win(22.6, 24.4)],
          e: [door(26.6, 27.8), win(21.2, 22.8)],
        },
        inner: [{ axis: 'x', at: 25.0, from: -37.75, to: -24.25, openings: [door(-35.8, -34.6), door(-29.4, -28.2)] }],
      },
      {
        y: 3.3,
        h: 3.3,
        walls: {
          n: [win(-36.4, -34.6), win(-32.6, -30.8), win(-28.8, -27.0)],
          s: [win(-36.6, -35.0)],
          w: [win(21.8, 23.4)],
          e: [win(21.4, 23.0)],
        },
      },
    ],
    slabs: [{ y: 3.3, holes: [[-31.4, -26.0, 28.55, 29.75]] }],
    roof: { parapet: 0.8 },
    flights: [{ bottom: [-26.0, 0, 29.15], top: [-31.4, 3.3, 29.15], width: 1.2, rail: 'n' }],
    rails: [
      [-31.4, 28.55, -26.0, 28.55, 3.3],
      [-26.0, 28.55, -26.0, 29.75, 3.3],
    ],
  },
  {
    // The courtyard house, west wing: stairs up its west wall, a balcony over the courtyard.
    id: 'westwing',
    x0: -14,
    x1: -6,
    z0: 20,
    z1: 34,
    look: { tint: '#e2d0ad', inside: '#d4c5a5', floor: 'tile', shutters: '#3d6a5a', rail: '#2b3531', roofKit: { tanks: [[-12.6, 32.4]], dishes: [[-7.6, 21.6, 0.8]] } },
    floors: [
      {
        y: 0,
        h: 3.3,
        walls: {
          n: [door(-11.0, -9.8), win(-8.6, -7.0)],
          e: [door(21.6, 22.8), win(24.4, 26.0), door(27.6, 28.8)],
          s: [win(-11.0, -9.4)],
          w: [win(22.4, 24.0)],
        },
        inner: [{ axis: 'x', at: 27.0, from: -12.45, to: -6.25, openings: [door(-10.0, -8.8)] }],
      },
      {
        y: 3.3,
        h: 3.3,
        walls: {
          n: [win(-11.0, -9.4), win(-8.4, -6.8)],
          e: [door(22.0, 23.2), win(24.6, 26.2), door(27.4, 28.6)],
          s: [win(-10.8, -9.0)],
          w: [win(21.4, 23.0)],
        },
        inner: [{ axis: 'x', at: 27.0, from: -12.45, to: -6.25, openings: [door(-10.0, -8.8)] }],
      },
    ],
    slabs: [{ y: 3.3, holes: [[-13.75, -12.55, 27.2, 32.6]] }],
    roof: { parapet: 0.8 },
    flights: [{ bottom: [-13.15, 0, 32.6], top: [-13.15, 3.3, 27.2], width: 1.2, rail: 'e', railFrom: 0.3 }],
    rails: [
      [-12.55, 27.2, -12.55, 32.6, 3.3],
      [-13.75, 32.6, -12.55, 32.6, 3.3],
    ],
    balconies: [{ side: 'e', from: 21.2, to: 28.9, y: 3.3, depth: 1.3 }],
  },
  {
    // East wing: the west wing's mirror.
    id: 'eastwing',
    x0: 6,
    x1: 14,
    z0: 20,
    z1: 34,
    look: { tint: '#d6c29e', inside: '#d0c1a2', floor: 'tile', shutters: '#7a3e2e', rail: '#2b3531', roofKit: { tanks: [[12.6, 32.4]], dishes: [[7.6, 21.6, 2.4]] } },
    floors: [
      {
        y: 0,
        h: 3.3,
        walls: {
          n: [win(7.0, 8.6), door(9.8, 11.0)],
          w: [door(21.6, 22.8), win(24.4, 26.0), door(27.6, 28.8)],
          s: [win(9.4, 11.0)],
          e: [win(22.4, 24.0)],
        },
        inner: [{ axis: 'x', at: 27.0, from: 6.25, to: 12.45, openings: [door(8.8, 10.0)] }],
      },
      {
        y: 3.3,
        h: 3.3,
        walls: {
          n: [win(6.8, 8.4), win(9.4, 11.0)],
          w: [door(22.0, 23.2), win(24.6, 26.2), door(27.4, 28.6)],
          s: [win(9.0, 10.8)],
          e: [win(21.4, 23.0)],
        },
        inner: [{ axis: 'x', at: 27.0, from: 6.25, to: 12.45, openings: [door(8.8, 10.0)] }],
      },
    ],
    slabs: [{ y: 3.3, holes: [[12.55, 13.75, 27.2, 32.6]] }],
    roof: { parapet: 0.8 },
    flights: [{ bottom: [13.15, 0, 32.6], top: [13.15, 3.3, 27.2], width: 1.2, rail: 'w', railFrom: 0.3 }],
    rails: [
      [12.55, 27.2, 12.55, 32.6, 3.3],
      [12.55, 32.6, 13.75, 32.6, 3.3],
    ],
    balconies: [{ side: 'w', from: 21.2, to: 28.9, y: 3.3, depth: 1.3 }],
  },
  {
    // South wing: one storey across the back of the courtyard.
    id: 'southwing',
    x0: -6,
    x1: 6,
    z0: 29,
    z1: 34,
    look: { tint: '#dcc8a4', inside: '#d2c3a4', floor: 'tile', shutters: '#3d6a5a' },
    floors: [
      {
        y: 0,
        h: 3.4,
        walls: { n: [win(-4.6, -3.0), door(-1.2, 1.2), win(3.0, 4.6)], s: [win(-1.0, 1.0)], w: null, e: null },
      },
    ],
    roof: { parapet: 0.6 },
  },
  {
    // The pink house south of the east block, on the corner of Market Street.
    id: 'pinkhouse',
    x0: 25,
    x1: 33,
    z0: 0,
    z1: 6.5,
    look: { tint: '#e2b6a2', inside: '#d8c4ac', floor: 'tile', shutters: '#2f5f7a', roofKit: { tanks: [[31.6, 1.4]], dishes: [[26.2, 5.4, 2.6]], ac: [['w', 4.8, 2.4]] } },
    floors: [
      {
        y: 0,
        h: 3.2,
        walls: {
          n: [door(27.0, 28.2), win(30.0, 31.6)],
          s: [win(26.0, 27.6), door(29.6, 30.8)],
          w: [win(1.4, 3.2)],
          e: [door(2.4, 3.6)],
        },
      },
    ],
    roof: { parapet: 0.5 },
  },
  {
    id: 'houseA',
    x0: 24,
    x1: 31,
    z0: 20,
    z1: 27,
    look: { tint: '#e4c7a0', inside: '#d8c8a8', floor: 'tile', shutters: '#2f5f7a', roofKit: { tanks: [[29.6, 25.6]], dishes: [[25.4, 21.4, 0.4]] } },
    floors: [
      {
        y: 0,
        h: 3.2,
        walls: {
          n: [door(26.0, 27.2), win(28.4, 30.0)],
          s: [win(25.2, 26.8), door(28.6, 29.8)],
          w: [win(22.4, 24.0)],
          e: [win(22.6, 24.2)],
        },
        inner: [{ axis: 'z', at: 27.8, from: 20.25, to: 26.75, openings: [door(23.0, 24.2)] }],
      },
    ],
    roof: { parapet: 0.5 },
  },
  {
    id: 'houseB',
    x0: 33,
    x1: 39.5,
    z0: 20,
    z1: 27,
    look: { tint: '#cfd2c2', inside: '#d2c9b0', floor: 'tile', shutters: '#7a5a2e', roofKit: { dishes: [[37.8, 21.4, 1.2]] } },
    floors: [
      {
        y: 0,
        h: 3.2,
        walls: {
          n: [win(34.0, 35.4), door(36.4, 37.6)],
          s: [door(34.2, 35.4)],
          w: [win(22.6, 24.2)],
          e: [],
        },
      },
    ],
    roof: { parapet: 0.5 },
  },
  {
    // The Skeleton: the unfinished frame in the middle of the site. Block walls
    // half up on the ground floor, a parapet round some of the first, the top
    // open to the sky; concrete stairs up the east side, a ladder up the west.
    id: 'skeleton',
    frame: true,
    x0: -7,
    x1: 7,
    z0: -18,
    z1: -6,
    look: { tint: '#c9c2b4', inside: '#c9c2b4', floor: null, rebar: true },
    columns: [
      [-6.8, -17.8], [-2.27, -17.8], [2.27, -17.8], [6.8, -17.8],
      [-6.8, -12.0], [-2.27, -12.0], [2.27, -12.0], [6.8, -12.0],
      [-6.8, -6.2], [-2.27, -6.2], [2.27, -6.2], [6.8, -6.2],
    ],
    floors: [
      {
        y: 0,
        h: 3.3,
        walls: {
          n: [win(-5.4, -3.6, 1.0, 2.4), win(-1.0, 1.0, 1.0, 2.4), win(3.6, 5.4, 1.0, 2.4)],
          s: null,
          w: [bay(-15.4, -8.6)],
          e: [bay(-17.6, -13.4)],
        },
      },
      {
        y: 3.3,
        h: 3.3,
        walls: {
          n: [bay(-6.4, -2.6, 1.0), bay(-1.8, 1.8, 1.0), bay(2.6, 6.4, 1.0)],
          s: null,
          w: [bay(-17.4, -10.6, 1.0), gap(-10.6, -9.4), bay(-9.4, -6.6, 1.0)],
          e: [bay(-17.4, -13.0, 1.0)],
        },
      },
      { y: 6.6, h: 2.6, walls: { n: null, s: null, w: null, e: null } },
    ],
    slabs: [
      { y: 3.3, holes: [[5.4, 6.6, -12.2, -6.8]] },
      { y: 6.6, holes: [[4.2, 5.4, -12.2, -6.8]] },
    ],
    roof: null,
    flights: [
      { bottom: [6.0, 0, -6.8], top: [6.0, 3.3, -12.2], width: 1.2, rail: 'w' },
      // Back toward the middle of the floor, so you arrive on the top inside, not at its open edge.
      { bottom: [4.8, 3.3, -6.8], top: [4.8, 6.6, -12.2], width: 1.2, rail: 'e' },
    ],
    rails: [
      [5.4, -6.8, 6.6, -6.8, 3.3],
      [4.2, -12.2, 4.2, -6.8, 6.6],
      [4.2, -6.8, 5.4, -6.8, 6.6],
      [5.4, -12.2, 5.4, -6.8, 6.6],
    ],
  },
])
for (const b of BLOCKS) add({ type: 'block', id: b.id })

const blockById = Object.fromEntries(BLOCKS.map((b) => [b.id, b]))
export const blockOf = (id) => blockById[id]

/** Level of a building's roof slab (the top of its highest floor). */
export const roofLevel = (b) => {
  const f = b.floors[b.floors.length - 1]
  return f.y + f.h
}

/** Wall runs of a floor: the four sides (null = no wall), then inner walls. */
function wallRuns(b, f) {
  const t = OQ_WALL_T
  const walls = f.walls ?? {}
  const runs = []
  const side = (s, axis, fixed, from, to) => {
    if (walls[s] === null) return
    runs.push({ side: s, axis, fixed, from, to, t, openings: walls[s] ?? [] })
  }
  side('n', 'x', b.z0 + t / 2, b.x0, b.x1)
  side('s', 'x', b.z1 - t / 2, b.x0, b.x1)
  side('w', 'z', b.x0 + t / 2, b.z0 + t, b.z1 - t)
  side('e', 'z', b.x1 - t / 2, b.z0 + t, b.z1 - t)
  for (const w of f.inner ?? []) runs.push({ side: 'inner', axis: w.axis, fixed: w.at, from: w.from, to: w.to, t: OQ_INNER_T, openings: w.openings ?? [] })
  return runs
}

/**
 * How high a floor's walls go: to the next floor (through the slab), or on the
 * top floor up to the roof and its parapet; a frame's infill and every inner
 * wall stop under the slab above.
 */
function wallHeight(b, fi, inner) {
  const f = b.floors[fi]
  const next = b.floors[fi + 1]
  if (b.frame || inner) return next ? next.y - OQ_SLAB_T - f.y : b.roof ? f.h - OQ_SLAB_T : f.h
  if (next) return next.y - f.y
  return f.h + (b.roof ? b.roof.parapet : 0)
}

/**
 * Every wall piece of a building in world space: { p, size, floor, side, axis,
 * y0, y1 }. Shared by the colliders and the renderer so the holes line up.
 */
const wallCache = new Map()
export function blockWallBoxes(b) {
  if (wallCache.has(b.id)) return wallCache.get(b.id)
  const out = []
  const last = b.floors.length - 1
  b.floors.forEach((f, fi) => {
    for (const run of wallRuns(b, f)) {
      const inner = run.side === 'inner'
      const height = wallHeight(b, fi, inner)
      let openings = run.openings
      // The parapet's gaps on the top floor.
      if (fi === last && b.roof && !inner) {
        const gaps = (b.roof.gaps ?? []).filter((g) => g.side === run.side).map((g) => ({ from: g.from, to: g.to, bottom: f.h, top: 99 }))
        openings = [...openings, ...gaps]
      }
      for (const piece of wallPieces(run.from, run.to, height, openings)) {
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

/** Doors, windows, shopfronts and bays of a building in world space, for frames, sills and shutters. */
export function blockOpenings(b) {
  const out = []
  b.floors.forEach((f, fi) => {
    for (const run of wallRuns(b, f)) {
      const height = wallHeight(b, fi, run.side === 'inner')
      for (const o of run.openings) {
        const mid = (o.from + o.to) / 2
        out.push({
          floor: fi,
          side: run.side,
          axis: run.axis,
          door: Boolean(o.door),
          bay: Boolean(o.bay),
          shop: Boolean(o.shop),
          garage: Boolean(o.garage),
          width: o.to - o.from,
          y0: f.y + o.bottom,
          y1: f.y + Math.min(o.top, height),
          t: run.t,
          at: run.axis === 'x' ? [mid, run.fixed] : [run.fixed, mid],
        })
      }
    }
  })
  return out
}

/** A rectangle minus rectangular holes, as disjoint rectangles [x0, x1, z0, z1]. */
export function rectMinus([x0, x1, z0, z1], holes) {
  const cuts = holes.map(([a, b, c, d]) => [Math.max(x0, a), Math.min(x1, b), Math.max(z0, c), Math.min(z1, d)]).filter(([a, b, c, d]) => b > a + 1e-6 && d > c + 1e-6)
  const xs = [...new Set([x0, x1, ...cuts.flatMap((h) => [h[0], h[1]])])].sort((p, q) => p - q)
  const cols = []
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i]
    const c = xs[i + 1]
    const mid = (a + c) / 2
    const blocked = cuts.filter((h) => h[0] < mid && h[1] > mid).map((h) => [h[2], h[3]]).sort((p, q) => p[0] - q[0])
    let cursor = z0
    for (const [p, q] of blocked) {
      if (p > cursor + 1e-6) cols.push([a, c, cursor, p])
      cursor = Math.max(cursor, q)
    }
    if (z1 > cursor + 1e-6) cols.push([a, c, cursor, z1])
  }
  // Merge neighbouring columns with the same z span.
  const out = []
  for (const r of cols) {
    const prev = out.find((o) => Math.abs(o[1] - r[0]) < 1e-6 && Math.abs(o[2] - r[2]) < 1e-6 && Math.abs(o[3] - r[3]) < 1e-6)
    if (prev) prev[1] = r[1]
    else out.push([...r])
  }
  return out
}

/**
 * The slabs of a building as rectangles: each upper floor's (inside the walls,
 * or the whole footprint for a frame) and the roof's. [{ y, rects, roof }].
 */
const slabCache = new Map()
export function blockSlabs(b) {
  if (slabCache.has(b.id)) return slabCache.get(b.id)
  const t = OQ_WALL_T
  const walls0 = b.floors[0].walls ?? {}
  const inside = b.frame
    ? [b.x0, b.x1, b.z0, b.z1]
    : [walls0.w === null ? b.x0 : b.x0 + t, walls0.e === null ? b.x1 : b.x1 - t, walls0.n === null ? b.z0 : b.z0 + t, walls0.s === null ? b.z1 : b.z1 - t]
  const out = (b.slabs ?? []).map((s) => ({ y: s.y, rects: rectMinus(inside, s.holes ?? []), roof: false }))
  if (b.roof) out.push({ y: roofLevel(b), rects: rectMinus(inside, b.roof.holes ?? []), roof: true })
  slabCache.set(b.id, out)
  return out
}

/**
 * A flight of solid concrete stairs: the walking ramp, the stepped mass under
 * it (down to the floor it starts on, or to the ground outside), and its rail.
 */
export function flightPieces(fl) {
  const base = fl.outside ? 0 : fl.bottom[1]
  const rise = fl.top[1] - fl.bottom[1]
  const ramp = rampBox(fl.top, fl.bottom, fl.width, 0.14)
  const dx = fl.top[0] - fl.bottom[0]
  const dz = fl.top[2] - fl.bottom[2]
  const run = Math.hypot(dx, dz)
  const ux = dx / run
  const uz = dz / run
  const alongX = Math.abs(ux) > 0.5
  const fill = []
  const n = 6
  for (let k = 0; k < n; k++) {
    const a = k / n
    // Each block reaches just under the treads at its low end.
    const top = fl.bottom[1] + rise * a - 0.2
    const h = top - base
    if (h < 0.2) continue
    const len = run * (1 - a)
    const mid = [fl.bottom[0] + ux * run * (a + (1 - a) / 2), fl.bottom[2] + uz * run * (a + (1 - a) / 2)]
    fill.push({ p: [mid[0], base + h / 2, mid[1]], size: alongX ? [len - 0.02, h, fl.width - 0.04] : [fl.width - 0.04, h, len - 0.02] })
  }
  let rail = null
  if (fl.rail) {
    const side = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] }[fl.rail]
    const off = fl.width / 2 - 0.04
    // `railFrom`: the rail starts that far up (a fraction), leaving the foot open to step on from the side.
    const a = fl.railFrom ?? 0
    const foot = [fl.bottom[0] + ux * run * a, fl.bottom[1] + rise * a, fl.bottom[2] + uz * run * a]
    const lift = (p) => [p[0] + side[0] * off, p[1] + 1.0, p[2] + side[1] * off]
    rail = rampBox(lift(fl.top), lift(foot), 0.06, 1.0)
  }
  return { ramp, fill, rail, base, rise, run, ux, uz }
}

/** Straight rail (banister, landing edge) at floor level `y`: movement-only, a metre high. */
const lineBox = (a, b, h, thick, y0 = 0, group) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
  return boxC([(a[0] + b[0]) / 2, y0 + h / 2, (a[1] + b[1]) / 2], [len, h, thick], yawQ(yaw), group)
}

/** A balcony's slab and its three railing runs: { slab: [x0, x1, z0, z1], y, rails: [[ax, az, bx, bz]] }. */
export function balconyOf(b, bal) {
  const T = 0.18
  let r
  if (bal.side === 's') r = [bal.from, bal.to, b.z1, b.z1 + bal.depth]
  else if (bal.side === 'n') r = [bal.from, bal.to, b.z0 - bal.depth, b.z0]
  else if (bal.side === 'e') r = [b.x1, b.x1 + bal.depth, bal.from, bal.to]
  else r = [b.x0 - bal.depth, b.x0, bal.from, bal.to]
  const [x0, x1, z0, z1] = r
  const i = 0.05
  let rails
  if (bal.side === 's') rails = [[x0 + i, z0, x0 + i, z1 - i], [x0 + i, z1 - i, x1 - i, z1 - i], [x1 - i, z1 - i, x1 - i, z0]]
  else if (bal.side === 'n') rails = [[x0 + i, z1, x0 + i, z0 + i], [x0 + i, z0 + i, x1 - i, z0 + i], [x1 - i, z0 + i, x1 - i, z1]]
  else if (bal.side === 'e') rails = [[x0, z0 + i, x1 - i, z0 + i], [x1 - i, z0 + i, x1 - i, z1 - i], [x1 - i, z1 - i, x0, z1 - i]]
  else rails = [[x1, z0 + i, x0 + i, z0 + i], [x0 + i, z0 + i, x0 + i, z1 - i], [x0 + i, z1 - i, x1, z1 - i]]
  return { slab: r, y: bal.y, thick: T, rails }
}

/** Where a roof kit's water tank sits and how big it is. */
export const TANK = Object.freeze({ r: 0.62, h: 1.3, stand: 0.45 })

function blockColliders(b) {
  const out = blockWallBoxes(b).map((w) => boxC(w.p, w.size))
  for (const s of blockSlabs(b)) {
    for (const [x0, x1, z0, z1] of s.rects) out.push(boxC([(x0 + x1) / 2, s.y - OQ_SLAB_T / 2, (z0 + z1) / 2], [x1 - x0, OQ_SLAB_T, z1 - z0]))
  }
  if (b.columns) {
    const top = b.slabs[b.slabs.length - 1].y
    for (const [x, z] of b.columns) out.push(boxC([x, top / 2, z], [OQ_COL, top, OQ_COL]))
  }
  for (const fl of b.flights ?? []) {
    const s = flightPieces(fl)
    out.push(boxC(s.ramp.p, s.ramp.size, s.ramp.q))
    for (const f of s.fill) out.push(boxC(f.p, f.size))
    if (s.rail) out.push(boxC(s.rail.p, s.rail.size, s.rail.q, MOVE_ONLY))
  }
  for (const L of b.landings ?? []) {
    out.push(boxC([(L.x0 + L.x1) / 2, L.y / 2, (L.z0 + L.z1) / 2], [L.x1 - L.x0, L.y, L.z1 - L.z0]))
    for (const [ax, az, bx, bz] of L.rails ?? []) out.push(lineBox([ax, az], [bx, bz], 1.0, 0.06, L.y, MOVE_ONLY))
  }
  for (const [ax, az, bx, bz, y] of b.rails ?? []) out.push(lineBox([ax, az], [bx, bz], 1.0, 0.06, y, MOVE_ONLY))
  for (const bal of b.balconies ?? []) {
    const r = balconyOf(b, bal)
    const [x0, x1, z0, z1] = r.slab
    out.push(boxC([(x0 + x1) / 2, r.y - r.thick / 2, (z0 + z1) / 2], [x1 - x0, r.thick, z1 - z0]))
    for (const [ax, az, bx, bz] of r.rails) out.push(lineBox([ax, az], [bx, bz], 1.05, 0.06, r.y, MOVE_ONLY))
  }
  // Water tanks on a walkable roof are in the way.
  if (b.roof?.walk) for (const [x, z] of b.look.roofKit?.tanks ?? []) out.push(cylC([x, roofLevel(b) + (TANK.stand + TANK.h) / 2, z], TANK.r, TANK.stand + TANK.h))
  return out
}

/* ---------------------------------------------------------------------------
 * Shacks: tin and plywood (Palmwood's shack model, see mapPalmwood.js)
 * ------------------------------------------------------------------------- */

const sDoor = (from, to, top = 2.15) => ({ from, to, bottom: 0, top, door: true })
const sWin = (from, to, bottom = 1.1, top = 1.9) => ({ from, to, bottom, top })

export const SHACKS = Object.freeze([
  {
    id: 'oq-shackA',
    x0: -33,
    x1: -28,
    z0: -21,
    z1: -16,
    look: { walls: 'tin', wallTint: 'rust', floor: 'concrete', tin: ['rust', 'galvanized', 'rust'] },
    floors: [{ y: 0, h: 2.6, walls: { s: [sDoor(-31.6, -30.4)], e: [sDoor(-19.2, -18.0)], n: [], w: [sWin(-19.4, -17.8)] } }],
    roof: { type: 'shed', down: 'n', rise: 0.5, overhang: 0.4 },
  },
  {
    id: 'oq-shackB',
    x0: -26,
    x1: -22.6,
    z0: -20,
    z1: -15,
    look: { walls: 'tin', wallTint: 'teal', floor: 'concrete', tin: ['rust', 'white'] },
    floors: [{ y: 0, h: 2.5, walls: { w: [sDoor(-18.4, -17.2)], s: [sWin(-25.2, -24.0)], n: [], e: [sDoor(-17.6, -16.4)] } }],
    roof: { type: 'shed', down: 'e', rise: 0.5, overhang: 0.35 },
  },
  {
    id: 'oq-shackC',
    x0: -33,
    x1: -27,
    z0: 1,
    z1: 7,
    look: { walls: 'plywood', floor: 'plank', tin: ['rust', 'galvanized'] },
    floors: [{ y: 0, h: 2.6, walls: { n: [sDoor(-31.0, -29.8)], e: [sDoor(3.4, 4.6)], s: [sWin(-31.4, -29.6)], w: [] } }],
    roof: { type: 'shed', down: 's', rise: 0.55, overhang: 0.4 },
  },
  {
    id: 'oq-woodshed',
    x0: -25.4,
    x1: -22.6,
    z0: -3,
    z1: 3,
    look: { walls: 'plywood', floor: 'plank', tin: ['galvanized', 'rust'] },
    floors: [{ y: 0, h: 2.5, walls: { w: [sDoor(-0.6, 0.6)], e: [sDoor(-1.8, -0.6)], n: [], s: [sWin(-24.6, -23.4)] } }],
    roof: { type: 'shed', down: 'e', rise: 0.45, overhang: 0.35 },
  },
])
for (const s of SHACKS) add({ type: 'shack', id: s.id })
const shackById = Object.fromEntries(SHACKS.map((s) => [s.id, s]))
export const shackOf = (id) => shackById[id]

/* ---------------------------------------------------------------------------
 * The building site round the Skeleton
 * ------------------------------------------------------------------------- */

/** Timber stud frames on the Skeleton's open top: [ax, az, bx, bz] at its top slab. */
export const STUDS = Object.freeze([
  // Along the north and east edges (the stairs arrive near them), part way down the west.
  [-6.4, -17.55, 6.4, -17.55],
  [6.55, -17.2, 6.55, -12.6],
  [-6.55, -17.2, -6.55, -12.6],
  [1.2, -14.2, 3.4, -14.2],
])
const SKELETON_TOP = 6.6
for (const [ax, az, bx, bz] of STUDS) add({ type: 'studs', a: [ax, az], b: [bx, bz], y: SKELETON_TOP, h: 2.4 })

/** Scaffolding along the Skeleton's south face: decks at each level, poles, braces. */
export const SCAFFOLD = Object.freeze({ x0: -6.2, x1: 1.8, z0: -5.95, z1: -4.85, decks: [2.0, 4.4] })
add({ type: 'scaffold', ...SCAFFOLD })

export const BULLDOZER = Object.freeze({ length: 5.4, width: 2.6, track: 0.6, body: 1.9, cab: 3.1 })
add({ type: 'bulldozer', p: [10.6, 0, 0.8], rotY: -0.5 })

add({ type: 'mixer', p: [2.8, 0, -2.4], rotY: 0.8 })

/** Sand and gravel piles: [x, z, radius, height, tint]. */
export const PILES = Object.freeze([
  [-12.2, 2.6, 2.6, 1.4, 'sand'],
  [13.0, -14.8, 2.2, 1.2, 'gravel'],
])
for (const [x, z, r, h, kind] of PILES) add({ type: 'pile', p: [x, 0, z], r, h, kind })

/** Pallets of concrete blocks: [x, z, rotY]. */
const blockStacks = [
  [-4.6, -3.0, 0.3],
  [-3.1, -3.2, 0.0],
  [-3.9, 2.6, 0.6],
  [8.4, -19.4, 0.1],
  [9.8, -19.4, 0.0],
  [-14.6, -8.4, 0.2],
]
export const BLOCK_STACK = Object.freeze({ w: 1.2, h: 1.0, d: 1.0 })
for (const [x, z, rotY] of blockStacks) add({ type: 'blockStack', p: [x, 0, z], rotY })

add({ type: 'rebar', p: [-9.8, 0, -8.6], rotY: Math.PI / 2, length: 5.5 })
add({ type: 'timber', p: [12.6, 0, 6.0], rotY: 0.3 })
add({ type: 'toilet', p: [14.6, 0, -19.4], rotY: Math.PI })
add({ type: 'toilet', p: [15.8, 0, -19.4], rotY: Math.PI })
add({ type: 'culvert', p: [-14.4, 0, 6.6], rotY: 0.25 })
add({ type: 'culvert', p: [-12.0, 0, 7.4], rotY: 0.1 })

/** Containers: the site office, one half across Market Street, one in the north alley. */
export const CONTAINER = Object.freeze({ length: 6.0, height: 2.6, width: 2.4 })
const containers = [
  { p: [-12.6, 0, -14.5], rotY: Math.PI / 2, color: 'blue' },
  { p: [-2.0, 0, 11.3], rotY: 0.06, color: 'red' },
  { p: [28.0, 0, -24.2], rotY: 0, color: 'green' },
  { p: [-23.4, 0, -10.5], rotY: Math.PI / 2, color: 'blue' },
]
for (const c of containers) add({ type: 'container', ...c })

/* ---------------------------------------------------------------------------
 * Streets: Market Street (east-west, south of the site), the north alley, and
 * the lanes down the west and east of the site
 * ------------------------------------------------------------------------- */

export const STREETS = Object.freeze({
  main: { z0: 9, z1: 16 },
  alley: { z0: -26, z1: -22 },
  west: { x0: -22, x1: -18 },
  east: { x0: 17, x1: 21 },
})
add({ type: 'oqGround' })

/** Cars along the streets: [model, colour, x, z, rotY, wreck]. */
const cars = [
  ['sedan', '#8a8d84', -12.6, 14.4, 1.62, false],
  ['pickup', '#c9c2b0', 28.6, 11.8, -1.5, false],
  ['sedan', '#5d6f7f', 19.2, -12.8, 0.12, true],
  ['coupe', '#a43b2a', 13.2, -24.2, 1.5, true],
  ['pickup', '#6f7a5a', -33.6, 36.0, 0.3, true],
  ['sedan', '#d4cfc0', 27.2, 34.4, -1.4, true],
]
for (const [model, color, x, z, rotY, wreck] of cars) add({ type: 'car', model, color, p: [x, 0, z], rotY, wreck })

/** Burnt-out wrecks. */
add({ type: 'carWreck', p: [-28.4, 0, 12.6], rotY: 0.25 })
add({ type: 'carWreck', p: [-19.8, 0, 23.4], rotY: 1.4 })
add({ type: 'carWreck', p: [33.2, 0, 34.8], rotY: -0.2 })

/** Jersey barriers: [x, z, rotY]. */
const barriers = [
  [11.6, 13.0, 0.5],
  [-30.4, -24.0, 1.3],
  [19.0, 26.8, 0.2],
]
for (const [x, z, rotY] of barriers) add({ type: 'barrier', p: [x, 0, z], rotY, length: 3 })

/** Power poles along Market Street and up the lanes, wires slung between them. */
export const OQ_POWER_LINES = Object.freeze([
  [[-36, 8.4], [-20.6, 8.4], [-6.0, 8.4], [8.0, 8.4], [22.4, 8.4], [36, 8.4]],
  [[-17.4, -36.4], [-17.4, -21.2], [-17.4, -8.0]],
  [[21.6, -36.4], [21.6, -21.2], [21.6, -8.0]],
])
for (const line of OQ_POWER_LINES) for (const [x, z] of line) add({ type: 'pole', p: [x, 0, z] })
add({ type: 'powerLines' })

/** Cables strung between the buildings across the streets: [ax, az, ay, bx, bz, by]. */
export const CABLES = Object.freeze([
  [-12.0, -29.0, 6.2, -12.4, -21.4, 4.8],
  [5.8, -30.0, 5.6, 9.0, -36.0, 3.3],
  [-24.0, 19.0, 5.8, -20.6, 8.4, 6.6],
  [-14.0, 21.0, 5.6, -6.0, 8.4, 6.6],
  [14.0, 21.0, 5.6, 8.0, 8.4, 6.6],
  [25.0, 20.4, 3.0, 22.4, 8.4, 6.6],
  [25.0, -10.0, 5.8, 21.6, -8.0, 6.6],
  [-26.0, -8.0, 5.4, -17.4, -8.0, 6.6],
])
add({ type: 'cables' })

/* ---------------------------------------------------------------------------
 * Walls round the yards (plastered block) and tin fences
 * ------------------------------------------------------------------------- */

/** Plastered yard walls: [ax, az, bx, bz, height]. */
export const YARD_WALLS = Object.freeze([
  // The teahouse courtyard, open on its west where the stairs come down.
  [-24.6, -27.7, -22.4, -27.7, 2.4],
  // Behind the apartments' west yard.
  [-17.6, -27.7, -14.4, -27.7, 2.2],
  // The courtyard house's gate on Market Street.
  [-6.0, 19.85, -2.0, 19.85, 2.6],
  [2.0, 19.85, 6.0, 19.85, 2.6],
  // The car park's low wall.
  [22.6, 29.4, 30.0, 29.4, 1.1],
  [33.0, 29.4, 39.6, 29.4, 1.1],
  // Behind the market hall.
  [-37.6, 33.4, -30.4, 33.4, 2.2],
  [-27.2, 33.4, -22.6, 33.4, 2.2],
  // Spawn yards: low walls to duck behind.
  [-38.6, -2.6, -35.6, -2.6, 1.1],
  [35.6, -2.0, 38.6, -2.0, 1.1],
])
for (const [ax, az, bx, bz, h] of YARD_WALLS) add({ type: 'yardWall', a: [ax, az], b: [bx, bz], h })

/** Corrugated tin fences round the building site: [ax, az, bx, bz, h]. */
export const TIN_FENCES = Object.freeze([
  [-17.4, -21.0, -17.4, -15.4, 2.2],
  [-17.4, -5.0, -17.4, 0.6, 2.2],
  [-11.0, -21.4, -3.0, -21.4, 2.2],
  [3.4, -21.4, 9.4, -21.4, 2.2],
  [16.8, -6.4, 16.8, -1.0, 2.2],
])
for (const [ax, az, bx, bz, h] of TIN_FENCES) add({ type: 'tinFence', a: [ax, az], b: [bx, bz], h })

/* ---------------------------------------------------------------------------
 * Cover and clutter
 * ------------------------------------------------------------------------- */

/** Sandbag walls: [ax, az, bx, bz, layers]. */
export const SANDBAGS = Object.freeze([
  [-21.4, -9.6, -19.2, -8.6, 5],
  [17.6, 4.4, 19.8, 5.2, 5],
  [-3.6, -24.6, -0.6, -23.4, 5],
  [-38.4, 10.6, -35.6, 10.6, 5],
  [35.6, 10.6, 38.4, 10.6, 5],
  [8.6, 17.2, 11.2, 18.2, 4],
])
for (const [ax, az, bx, bz, layers] of SANDBAGS) add({ type: 'sandbags', a: [ax, az], b: [bx, bz], layers })

/** Crates: [x, z, w, h, d, rotY, y]. */
const crates = [
  [-15.2, -2.6, 1.1, 1.0, 1.1, 0.3],
  [15.4, 1.6, 1.2, 1.1, 1.2, -0.2],
  [-36.6, -19.4, 1.0, 1.0, 1.0, 0.1],
  [36.8, -18.6, 1.1, 1.0, 1.1, -0.3],
  [-23.2, -36.0, 1.0, 0.9, 1.0, 0.4],
  [-1.2, 26.8, 1.1, 1.0, 1.1, 0.2],
  [32.0, 32.6, 1.2, 1.1, 1.2, 0.5],
  [-20.8, 30.4, 1.0, 1.0, 1.0, -0.2],
  [7.4, -26.6, 1.1, 1.0, 1.1, 0.2],
  [-10.6, 17.4, 1.0, 0.9, 1.0, 0.1],
]
export const CRATES = Object.freeze(crates.map(([x, z, w, h, d, rotY, y = 0]) => ({ p: [x, y, z], size: [w, h, d], rotY })))
for (const c of CRATES) add({ type: 'crate', ...c })

/** Drum stacks ('stack' on a pallet, two high) and loose rusty drums. */
const barrels = [
  ['drums', -15.8, 3.6, 0.3],
  ['drums', 34.6, -23.8, 0.2],
  ['stack', -36.8, 16.6, 0.4],
  ['drums', -24.6, 7.6, 0.2],
]
export const BARRELS = Object.freeze(barrels.map(([kind, x, z, rotY]) => ({ kind, p: [x, 0, z], rotY })))
for (const b of BARRELS) add({ type: 'barrels', ...b })

add({ type: 'generator', p: [-31.0, 0, -26.9], rotY: 0 })
add({ type: 'generator', p: [15.6, 0, 7.4], rotY: -1.2 })
add({ type: 'pallets', p: [-3.6, 0, 6.0], rotY: 0.2 })
add({ type: 'pallets', p: [36.8, 0, 16.2], rotY: 0.6 })
add({ type: 'tyres', p: [-29.6, 0, 8.2] })
add({ type: 'tyres', p: [23.2, 0, 15.6] })
add({ type: 'tyres', p: [-16.4, 0, -24.4] })
add({ type: 'oilDrums', p: [33.8, 0, -27.0] })
add({ type: 'oilDrums', p: [-35.0, 0, 31.8] })
add({ type: 'washline', a: [-5.2, 21.2], b: [-5.2, 27.4] })
add({ type: 'washline', a: [-24.4, -36.4], b: [-24.4, -31.6] })
add({ type: 'fountain', p: [0.4, 0, 24.2] })

/* ---------------------------------------------------------------------------
 * Furniture: low cover in the rooms. [kind, x, z, w, h, d, rotY, y]
 * ------------------------------------------------------------------------- */

const furniture = [
  // Teahouse.
  ['counter', -35.6, -35.9, 3.0, 1.05, 0.7, 0],
  ['table', -33.0, -31.6, 0.9, 0.75, 0.9, 0.2],
  ['table', -30.4, -33.6, 0.9, 0.75, 0.9, -0.3],
  ['table', -29.8, -30.6, 0.9, 0.75, 0.9, 0.1],
  ['shelf', -37.3, -31.8, 0.5, 1.8, 1.6, 0],
  // Apartments.
  ['table', -7.6, -31.8, 1.6, 0.78, 0.9, 0],
  ['sofa', -9.6, -29.0, 2.0, 0.8, 0.8, 0],
  ['shelf', 5.3, -33.0, 0.5, 1.8, 1.6, 0],
  ['table', 1.2, -33.4, 1.4, 0.78, 0.9, 0.2],
  ['mattress', -9.0, -30.2, 1.0, 0.25, 2.0, 0, 3.3],
  ['table', 2.6, -33.6, 1.4, 0.78, 0.9, 0, 3.3],
  // West house.
  ['table', -29.0, -9.0, 1.4, 0.78, 0.9, 0],
  ['sacks', -32.6, -5.4, 1.2, 0.8, 0.7, 0],
  ['mattress', -32.4, -6.2, 1.0, 0.25, 2.0, 0, 3.3],
  // East block.
  ['sacks', 27.0, -16.4, 1.2, 0.8, 0.7, 0],
  ['table', 32.0, -8.6, 1.4, 0.78, 0.9, 0],
  ['table', 30.0, -8.8, 1.4, 0.78, 0.9, 0.3, 3.3],
  ['mattress', 33.4, -15.6, 1.0, 0.25, 2.0, 0, 3.3],
  // Market hall.
  ['sacks', -36.0, 21.4, 1.2, 0.8, 0.7, 0.3],
  ['counter', -30.8, 21.6, 2.4, 1.0, 0.6, 0],
  ['shelf', -37.3, 27.4, 0.5, 1.8, 1.6, 0],
  ['table', -34.0, 24.2, 1.4, 0.78, 0.9, 0.2, 3.3],
  // The courtyard house.
  ['table', -9.6, 30.6, 1.4, 0.78, 0.9, 0],
  ['table', 9.6, 30.6, 1.4, 0.78, 0.9, 0],
  ['mattress', -10.0, 31.0, 1.0, 0.25, 2.0, 0, 3.3],
  ['sofa', 10.0, 21.4, 2.0, 0.8, 0.8, Math.PI, 3.3],
  ['table', -3.4, 31.8, 1.4, 0.78, 0.9, 0],
  ['sacks', 3.6, 32.4, 1.2, 0.8, 0.7, 0],
  // The little houses.
  ['table', 25.8, 24.0, 1.2, 0.78, 0.9, 0],
  ['sofa', 37.6, 24.0, 2.0, 0.8, 0.8, -Math.PI / 2],
  // Workshop and the corner shop.
  ['table', 32.6, -36.9, 2.0, 0.9, 0.8, 0],
  ['shelf', 36.3, -33.0, 0.5, 1.8, 1.6, 0],
  ['crate', 27.2, -36.4, 1.2, 1.1, 1.2, 0.2],
  ['counter', 12.6, -35.9, 3.0, 1.0, 0.6, 0],
  ['shelf', 9.5, -33.4, 0.5, 1.8, 1.6, 0],
  // The pink house.
  ['table', 29.0, 3.4, 1.4, 0.78, 0.9, 0.2],
]
export const QUARTER_FURNITURE = Object.freeze(furniture.map(([kind, x, z, w, h, d, rotY = 0, y = 0]) => ({ kind, p: [x, y, z], size: [w, h, d], rotY })))
add({ type: 'furniture' })

export const QUARTER_AMMO = Object.freeze([
  { p: [-23.4, 0, -31.2], radius: 1.7, cooldown: 20, rotY: Math.PI / 2 },
  { p: [37.6, 0, 37.4], radius: 1.7, cooldown: 20, rotY: 0 },
])
for (const a of QUARTER_AMMO) add({ type: 'ammoCrate', p: a.p, size: [1.0, 0.6, 0.6], rotY: a.rotY })

/* ---------------------------------------------------------------------------
 * Palms, dry trees, grass
 * ------------------------------------------------------------------------- */

/** Date palms: [x, z, height, lean]. */
const palms = [
  [-24.6, -33.4, 8.6, 0.28],
  [-15.6, -33.6, 7.8, 0.35],
  [-3.6, 25.8, 8.8, 0.22],
  [36.4, -23.8, 8.0, 0.3],
  [-37.4, 37.4, 9.0, 0.3],
  [-37.6, -38.0, 7.6, 0.3],
  [21.4, 37.0, 8.4, 0.3],
  [-21.0, 37.4, 7.8, 0.35],
  [38.2, 14.6, 8.2, 0.25],
]
export const PALMS = Object.freeze(palms.map(([x, z, h, lean]) => ({ p: [x, 0, z], h, lean })))
for (const p of PALMS) add({ type: 'palm', ...p })

/** Leafless scrub trees: [x, z, size]. */
const scrub = [
  [-36.6, -9.0, 1.0],
  [16.0, -27.6, 0.9],
  [-8.8, -24.8, 0.8],
  [36.4, 4.4, 0.9],
  [-19.6, 36.0, 1.0],
  [-36.8, 24.8, 0.85],
]
export const SCRUB = Object.freeze(scrub.map(([x, z, s]) => ({ p: [x, 0, z], s })))
for (const s of SCRUB) add({ type: 'scrub', ...s })
add({ type: 'tufts', seed: 413 })

/* ---------------------------------------------------------------------------
 * Ladders: up the Skeleton's west face, onto the workshop roof
 * ------------------------------------------------------------------------- */

export const QUARTER_LADDERS = Object.freeze([
  ladder([-7.05, -10.0], [1, 0, 0], 3.3, [0.3, 0.3]),
  ladder([37.05, -31.0], [-1, 0, 0], 4.2, [0.3, 0.3]),
])
for (const l of QUARTER_LADDERS) add({ type: 'ladder', foot: l.foot, dir: l.exitDir, topY: l.topY, base: l.base, rungs: l.rungs })
export const quarterLadderAt = (x, y, z) => ladderIn(QUARTER_LADDERS, x, y, z)

/* ---------------------------------------------------------------------------
 * Boundary and backdrop
 * ------------------------------------------------------------------------- */

add({ type: 'oqPerimeter' })
add({ type: 'oqBackdrop' })

export const QUARTER_ENTITIES = Object.freeze(entities)

/* ---------------------------------------------------------------------------
 * Collider generation
 * ------------------------------------------------------------------------- */

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

function bulldozerColliders(e) {
  const d = BULLDOZER
  return localBoxes(e, [
    // Tracks and body, the cab, the blade out front (local -z is the front).
    [0, 0, 0.2, d.width, d.body, d.length - 0.6],
    [0, d.body, 0.9, 1.5, d.cab - d.body, 1.5],
    [0, 0, -d.length / 2 - 0.25, d.width + 0.5, 1.15, 0.35],
  ])
}

const COLLIDER_BUILDERS = {
  block: (e) => blockColliders(blockOf(e.id)),
  shack: (e) => shackColliders(shackOf(e.id)),
  studs: (e) => [lineBox(e.a, e.b, e.h, 0.12, e.y, MOVE_ONLY)],
  scaffold: (s) => {
    const out = []
    for (let x = s.x0; x <= s.x1 + 0.01; x += (s.x1 - s.x0) / 4) for (const z of [s.z0, s.z1]) out.push(cylC([x, 3.6, z], 0.04, 7.2, IDENTITY_Q, MOVE_ONLY))
    return out
  },
  bulldozer: bulldozerColliders,
  mixer: (e) => [groundBox(e.p, [1.6, 1.6, 2.2], e.rotY)],
  pile: (e) => [cylC([e.p[0], e.h * 0.25, e.p[2]], e.r * 0.85, e.h * 0.5), cylC([e.p[0], e.h * 0.7, e.p[2]], e.r * 0.45, e.h * 0.4)],
  blockStack: (e) => [groundBox(e.p, [BLOCK_STACK.w, BLOCK_STACK.h, BLOCK_STACK.d], e.rotY)],
  rebar: (e) => [groundBox(e.p, [e.length, 0.35, 0.8], e.rotY)],
  timber: (e) => [groundBox(e.p, [4.2, 0.6, 1.2], e.rotY)],
  toilet: (e) => [groundBox(e.p, [1.1, 2.3, 1.1], e.rotY)],
  culvert: (e) => [cylC([e.p[0], 0.85, e.p[2]], 0.85, 2.4, quatMultiply(quatFromEuler(0, e.rotY, 0), quatFromEuler(Math.PI / 2, 0, 0)))],
  container: (e) => [groundBox(e.p, [CONTAINER.length, CONTAINER.height, CONTAINER.width], e.rotY)],
  car: carColliders,
  carWreck: (e) => [groundBox(e.p, [1.8, 1.45, 4.3], e.rotY)],
  barrier: (e) => [groundBox(e.p, [e.length, 1.0, 0.62], e.rotY)],
  pole: (e) => [cylC([e.p[0], 3.5, e.p[2]], 0.14, 7.0)],
  yardWall: (e) => [lineBox(e.a, e.b, e.h, 0.3)],
  tinFence: (e) => [lineBox(e.a, e.b, e.h, 0.1)],
  sandbags: (e) => [lineBox(e.a, e.b, 0.2 + e.layers * 0.17, 0.62)],
  crate: (e) => [groundBox(e.p, e.size, e.rotY)],
  barrels: (e) => (e.kind === 'stack' ? [groundBox(e.p, [1.75, 2.05, 1.15], e.rotY)] : [groundBox(e.p, [1.5, 0.95, 1.3], e.rotY)]),
  generator: (e) => [groundBox(e.p, [1.8, 1.25, 1.0], e.rotY)],
  pallets: (e) => [groundBox(e.p, [1.3, 0.75, 1.1], e.rotY)],
  tyres: (e) => [cylC([e.p[0], 0.5, e.p[2]], 0.48, 1.0)],
  oilDrums: (e) => [groundBox(e.p, [1.4, 0.95, 1.4], 0.2)],
  fountain: (e) => [cylC([e.p[0], 0.3, e.p[2]], 1.5, 0.6), cylC([e.p[0], 0.9, e.p[2]], 0.22, 1.2)],
  ammoCrate: (e) => [groundBox(e.p, e.size, e.rotY)],
  furniture: () => QUARTER_FURNITURE.filter((f) => f.kind !== 'mattress').map((f) => groundBox(f.p, f.size, f.rotY)),
  palm: (e) => {
    // The trunk leans: a run of three cylinders following it.
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
  scrub: (e) => [cylC([e.p[0], 1.0 * e.s, e.p[2]], 0.13 * e.s, 2.0 * e.s)],
  oqPerimeter: () => [...boundaryColliders(QUARTER_HALF, QUARTER_HALF), boxC([0, -1, 0], [200, 2, 200])],
}

/** Which way a palm leans (deterministic per spot; the renderer turns the same way). Same as Palmwood's. */
export function palmYaw(p) {
  return (((p[0] * 7.3 + p[2] * 3.1) % 6.283) + 6.283) % 6.283
}

let colliderCache = null

/** Flat, cached list of every collider in the map. Identical on client and server. */
export function buildQuarterColliders() {
  if (colliderCache) return colliderCache
  const out = []
  for (const e of QUARTER_ENTITIES) {
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

export const QUARTER_SPAWNS = Object.freeze({
  // TDM: the yards behind the west house and the shacks (Alpha), and behind the
  // east block and the pink house (Bravo). The yards are narrow, so the spawns
  // face along them and out through the gaps (a face point), not at a wall.
  [TEAMS.ALPHA]: [spawn(-38.0, -18.0, -38, 12), spawn(-37.6, -12.4, -34, 17), spawn(-38.2, -6.8, -30, 22), spawn(-37.4, -0.6, -25, 27), spawn(-38.0, 4.6, -13, 21), spawn(-36.6, -15.2, -33, 15)],
  [TEAMS.BRAVO]: [spawn(38.0, -18.0, 36, 12), spawn(37.6, -12.4, 31, 17), spawn(38.2, -6.8, 10, 4), spawn(37.4, -0.6, 7, -3), spawn(38.0, 4.6, 20, 29), spawn(36.6, -15.2, 35, 15)],
  ffa: [
    spawn(-34.4, -23.6, -5, -19),
    spawn(0.0, -24.2),
    spawn(33.0, -21.0, 16, -21),
    spawn(-38.2, 14.0),
    spawn(38.2, 13.4, 8, 16),
    spawn(-29.8, 36.6, -1, 28),
    spawn(0.0, 37.6),
    spawn(29.6, 37.2, 1, 29),
    spawn(-20.0, 1.6),
    spawn(19.0, 1.8, -9, 12),
  ],
})

/* ---------------------------------------------------------------------------
 * Bot navigation: grid + doorways + every flight of stairs + the floors above
 * ------------------------------------------------------------------------- */

/** Points either side of every ground-floor doorway, masonry and shacks. */
function doorNodes() {
  const out = []
  const push = (o, k) => {
    const [a, c] = o.at
    const n = o.axis === 'x' ? [0, 1] : [1, 0]
    for (const s of [-1, 1]) out.push([a + n[0] * s * k, 0, c + n[1] * s * k])
  }
  for (const b of BLOCKS) {
    for (const o of blockOpenings(b)) {
      if (!o.door || o.floor > 0 || o.y0 > 0.1) continue
      push(o, o.side === 'inner' ? 0.8 : 0.9)
    }
  }
  for (const s of SHACKS) for (const o of shackOpenings(s)) if (o.door && o.floor === 0) push(o, 0.9)
  return out
}

/** Nodes along a flight: just off its foot (or `start`, beside it), up it, and out onto what it arrives at. */
function flightChain(fl, before = 1.0, after = 1.0, start = null) {
  const s = flightPieces(fl)
  const at = (f, y) => [+(fl.bottom[0] + s.ux * s.run * f).toFixed(2), +y.toFixed(2), +(fl.bottom[2] + s.uz * s.run * f).toFixed(2)]
  const y0 = fl.bottom[1]
  return [
    start ?? at(-before / s.run, y0),
    at(0.12, y0 + s.rise * 0.12),
    at(0.5, y0 + s.rise * 0.5),
    at(0.88, y0 + s.rise * 0.88),
    at(1 + after / s.run, fl.top[1]),
  ]
}

/**
 * A grid of nodes over each floor you can walk on upstairs (and the walkable
 * roofs and the balconies), kept clear of the walls, the stair holes and the
 * flights; linkUpper joins them wherever a bot can walk.
 */
function upperNodes() {
  const out = []
  const step = 2.2
  const m = 0.6
  for (const b of BLOCKS) {
    if (!b.flights?.length) continue
    const flights = (b.flights ?? []).map((fl) => {
      const x = [fl.bottom[0], fl.top[0]]
      const z = [fl.bottom[2], fl.top[2]]
      const w = fl.width / 2 + 0.3
      return [Math.min(...x) - w, Math.max(...x) + w, Math.min(...z) - w, Math.max(...z) + w]
    })
    for (const s of blockSlabs(b)) {
      if (s.roof && !b.roof.walk) continue
      for (const [x0, x1, z0, z1] of s.rects) {
        if (x1 - x0 < m * 2 || z1 - z0 < m * 2) continue
        const nx = Math.max(1, Math.round((x1 - x0 - m * 2) / step) + 1)
        const nz = Math.max(1, Math.round((z1 - z0 - m * 2) / step) + 1)
        for (let i = 0; i < nx; i++) {
          for (let k = 0; k < nz; k++) {
            const x = nx === 1 ? (x0 + x1) / 2 : x0 + m + ((x1 - x0 - m * 2) * i) / (nx - 1)
            const z = nz === 1 ? (z0 + z1) / 2 : z0 + m + ((z1 - z0 - m * 2) * k) / (nz - 1)
            if (flights.some(([a, c, d, e]) => x > a && x < c && z > d && z < e)) continue
            // Not in the furniture.
            if (QUARTER_FURNITURE.some((fu) => Math.abs(fu.p[1] - s.y) < 0.01 && fu.kind !== 'mattress' && Math.abs(x - fu.p[0]) < Math.max(fu.size[0], fu.size[2]) / 2 + 0.45 && Math.abs(z - fu.p[2]) < Math.max(fu.size[0], fu.size[2]) / 2 + 0.45)) continue
            // Not in an inner wall of the floor it's on.
            const floor = b.floors.find((fl) => Math.abs(fl.y - s.y) < 0.01)
            if ((floor?.inner ?? []).some((w) => (w.axis === 'x' ? Math.abs(z - w.at) < 0.45 && x > w.from && x < w.to : Math.abs(x - w.at) < 0.45 && z > w.from && z < w.to))) continue
            // Inside the roof's water tanks.
            if (s.roof && (b.look.roofKit?.tanks ?? []).some(([tx, tz]) => Math.hypot(x - tx, z - tz) < TANK.r + 0.5)) continue
            out.push([+x.toFixed(2), s.y, +z.toFixed(2)])
          }
        }
      }
    }
    for (const bal of b.balconies ?? []) {
      const r = balconyOf(b, bal)
      const [x0, x1, z0, z1] = r.slab
      const along = bal.side === 'n' || bal.side === 's'
      const len = along ? x1 - x0 : z1 - z0
      const n = Math.max(2, Math.round(len / step) + 1)
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n
        out.push(along ? [+(x0 + (x1 - x0) * f).toFixed(2), bal.y, +((z0 + z1) / 2).toFixed(2)] : [+((x0 + x1) / 2).toFixed(2), bal.y, +(z0 + (z1 - z0) * f).toFixed(2)])
      }
    }
    for (const L of b.landings ?? []) out.push([+((L.x0 + L.x1) / 2).toFixed(2), L.y, +((L.z0 + L.z1) / 2).toFixed(2)])
    // Either side of every upstairs door (to the balconies, landings and between rooms): a link
    // across a doorway at an angle clips the jamb.
    for (const o of blockOpenings(b)) {
      if (!o.door || o.bay || o.floor === 0) continue
      const [a, c] = o.at
      const n = o.axis === 'x' ? [0, 1] : [1, 0]
      for (const k of [-1, 1]) out.push([+(a + n[0] * k * 0.75).toFixed(2), o.y0, +(c + n[1] * k * 0.75).toFixed(2)])
    }
  }
  return out
}

const fl = (id, i) => blockOf(id).flights[i]

export const QUARTER_NAV = Object.freeze({
  grid: { spacing: 2.5, half: QUARTER_HALF - 1.2 },
  root: [0, 12.5],
  linkUpper: true,
  extra: Object.freeze([
    ...doorNodes(),
    // Round the container on Market Street and through the courtyard gate.
    [0, 0, 18.8], [0, 0, 21.2], [3.0, 0, 8.6], [-6.8, 0, 8.6],
  ]),
  chains: Object.freeze([
    // Apartments: up to the first floor, round the landing and on up to the roof.
    [...flightChain(fl('apartments', 0), 0.7).slice(0, 4), [-4.35, 3.3, -37.15], [-4.35, 3.3, -35.95], ...flightChain(fl('apartments', 1), 0.4).slice(1)],
    // Teahouse: up the courtyard stairs and through the parapet onto the roof.
    [...flightChain(fl('teahouse', 0), 1.2, 0.7), [-27.9, 3.4, -34.7]],
    // West house, market hall, the courtyard wings: up to the first floor.
    flightChain(fl('westhouse', 0), 1.0, 1.0, [-32.6, 0, -11.5]),
    flightChain(fl('markethall', 0)),
    flightChain(fl('westwing', 0), 1.0, 1.0, [-11.9, 0, 32.2]),
    flightChain(fl('eastwing', 0), 1.0, 1.0, [11.9, 0, 32.2]),
    // East block: up the west face, through the door; round the corner and on up to the roof.
    [...flightChain(fl('eastblock', 0), 1.2, 0.0), [24.4, 3.3, -18.4], ...flightChain(fl('eastblock', 1), 0.6, 0.7).slice(1), [31.1, 6.6, -17.0]],
    [[24.4, 3.3, -17.4], [26.2, 3.3, -17.1]],
    // The Skeleton: up the east stairs to the first floor, then on up to the top.
    [...flightChain(fl('skeleton', 0), 1.0, 0.8).slice(0, 4), [6.0, 3.3, -13.0], [3.5, 3.3, -12.8], [3.5, 3.3, -6.6], [4.8, 3.3, -6.4], ...flightChain(fl('skeleton', 1), 0.4, 0.6).slice(1)],
  ]),
  upper: Object.freeze(upperNodes()),
})
