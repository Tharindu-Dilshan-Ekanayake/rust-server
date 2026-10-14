/**
 * "Skyport Terminal" — an airport terminal and the jet parked at its gate, as data,
 * after a battle has gone through it.
 *
 * The north edge of the map is the terminal building itself (the map ends at its
 * back wall), an L: the main block, 88 x 36 m, two levels under a flat roof,
 * and its leg, a pier wing 16 m wide running 32 m south down the apron's east
 * side. Inside, a double-height hall under skylights with a palm in a planter,
 * escalators and a grand stair up to the mezzanine round it; the check-in
 * desks and the security lanes in the west hall; a bookshop, a coffee bar, the
 * café, the duty-free shop and the gate lounges in the east hall; upstairs the
 * Sky Lounge (west), the VIP lounge and gate seating (east) and Gate 3 over the
 * tarmac. The leg is the baggage hall downstairs and more gates upstairs; part
 * of its upper floor has come down in one piece, a ramp of broken slab from
 * one floor to the other under the hole blown through its roof. The fronts
 * are glass (you can see and shoot through it, not walk through it), shot out
 * here and there: where a pane is gone you can step through. Sandbags,
 * rubble and barricades through both floors.
 *
 * In front of it, nose-in at the gate, a wide-body jet: the jet bridge runs
 * from Gate 3 upstairs to its front left door; the escape slide is out of the
 * front right door, the over-wing exits are open onto both wings, and an
 * airstair truck stands at the back right door. Round it the apron: container
 * stacks, a fuel truck, baggage trains, an apron bus, a police car, a free
 * airstair truck to climb, floodlight masts, the painted stand markings and
 * burnt-out cars. Across the south-west of the apron lies a narrow-body jet that
 * crashed and broke in three, its wing and engines torn off and burning.
 * Doors lead into the terminal from the apron, at both ends and into the leg,
 * up the stairs outside its east end, and through the hole blown in the
 * leg's end.
 *
 * Coordinates are metres. +X is east, -Z north, +Y up, ground y = 0. The arena
 * is 112 x 112 m. Everything is listed once as entities; the client draws them
 * and BOTH sides build their physics from `buildTerminalColliders()`.
 */
import { TEAMS } from './constants.js'
import { glassPane } from './glass.js'
import { CAR_MODELS } from './mapAcres.js'
import { boundaryColliders, boxC, cylC, groundBox, IDENTITY_Q, ladderIn, MOVE_ONLY, quatFromEuler, quatMultiply, rampBox, yawOffset, yawQ } from './mapKit.js'
import { rectMinus } from './mapQuarter.js'

export const TERMINAL_NAME = 'Skyport Terminal'
export const TERMINAL_HALF = 56

const entities = []
const add = (e) => {
  entities.push(e)
  return e
}

/* ---------------------------------------------------------------------------
 * The terminal building
 *
 * Walls are straight runs ({ axis, at, from, to, t, y0, y1 }) with rectangular
 * openings ({ from, to, bottom, top, kind }) measured along the run (world x
 * for an 'x' run, world z for a 'z' run) and in world height. A run's solid
 * part is its rectangle minus the openings; an opening of kind 'glass' is
 * glazed (a pane that stops you but not a bullet), 'door' and 'shutter' are
 * open. Glass runs (shopfronts, the security line, the VIP lounge) are glazed
 * all along between their solid `header` above and the floor, apart from
 * their doors.
 * ------------------------------------------------------------------------- */

export const TB = Object.freeze({
  x0: -44,
  x1: 44,
  z0: -56,
  z1: -20,
  /** Outer walls, inner walls, glass and slab thickness. */
  wall: 0.3,
  inner: 0.2,
  glass: 0.06,
  slab: 0.35,
  /** Upper floor level, roof level (top of the roof slab), top of the parapet. */
  l1: 5.0,
  roof: 10.0,
  top: 11.0,
})
/** Inside faces of the outer walls. */
export const TB_IN = Object.freeze({ x0: TB.x0 + TB.wall, x1: TB.x1 - TB.wall, z0: TB.z0 + TB.wall, z1: TB.z1 - TB.wall })
/**
 * The L's leg off the east end (outer faces): its floors and roof carry on
 * from the main block's, open to the east hall and the gate lounge upstairs.
 */
export const LEG = Object.freeze({ x0: 28.0, x1: TB.x1, z0: TB.z1, z1: 12.0 })
export const LEG_IN = Object.freeze({ x0: LEG.x0 + TB.wall, x1: LEG.x1 - TB.wall, z0: TB_IN.z1, z1: LEG.z1 - TB.wall })
/** Underside of the upper floor and of the roof. */
const UNDER1 = TB.l1 - TB.slab
const UNDER2 = TB.roof - TB.slab

const door = (from, to, bottom, top) => ({ from, to, bottom, top, kind: 'door' })
const glazed = (from, to, bottom, top) => ({ from, to, bottom, top, kind: 'glass' })
/** A hole blown through a wall: open like a door, drawn ragged. */
const breach = (from, to, bottom, top) => ({ from, to, bottom, top, kind: 'breach' })
/** Windows boarded up from inside: solid plywood where the glass was. */
const boarded = (from, to, bottom, top) => ({ from, to, bottom, top, kind: 'boarded' })
/** Openings you can walk through. */
export const isWalkable = (o) => o.kind === 'door' || o.kind === 'breach'

/** Solid walls: the outer walls and the rooms' walls. */
export const TM_WALLS = Object.freeze([
  // Outer walls: the back wall (the edge of the map), the west and east ends.
  { id: 'back', axis: 'x', at: TB.z0 + TB.wall / 2, from: TB.x0, to: TB.x1, t: TB.wall, y0: 0, y1: TB.top, outer: 'n', openings: [] },
  {
    id: 'west',
    axis: 'z',
    at: TB.x0 + TB.wall / 2,
    from: TB_IN.z0,
    to: TB.z1,
    t: TB.wall,
    y0: 0,
    y1: TB.top,
    outer: 'w',
    openings: [door(-37.0, -33.0, 0, 3.0), boarded(-30.0, -22.0, 0.9, 3.6), glazed(-52.0, -40.0, 6.0, 9.0), glazed(-31.0, -22.0, 6.0, 9.0)],
  },
  // (The east wall runs on down the leg's east side.)
  {
    id: 'east',
    axis: 'z',
    at: TB.x1 - TB.wall / 2,
    from: TB_IN.z0,
    to: LEG.z1,
    t: TB.wall,
    y0: 0,
    y1: TB.top,
    outer: 'e',
    openings: [
      door(-30.0, -26.0, 0, 3.0),
      glazed(-36.0, -31.5, 0.9, 3.6),
      door(-48.8, -47.2, TB.l1, TB.l1 + 2.3),
      glazed(-44.0, -36.0, 6.0, 9.0),
      glazed(-31.0, -22.0, 6.0, 9.0),
      // The leg.
      door(-12.4, -10.4, 0, 3.0),
      glazed(-6.5, -1.0, 0.9, 3.6),
      boarded(3.0, 9.0, 0.9, 3.6),
      glazed(-17.0, -6.0, 6.0, 9.0),
      glazed(-2.0, 9.0, 6.0, 9.0),
    ],
  },
  // The leg's south end: a door, the hole a shell blew through it, windows upstairs.
  {
    id: 'leg-s',
    axis: 'x',
    at: LEG.z1 - TB.wall / 2,
    from: LEG.x0,
    to: LEG_IN.x1,
    t: TB.wall,
    y0: 0,
    y1: TB.top,
    outer: 's',
    openings: [door(30.8, 32.8, 0, 3.0), breach(37.2, 41.0, 0, 3.4), glazed(29.5, 35.5, 6.0, 9.0), glazed(37.0, 42.5, 6.0, 9.0)],
  },
  // Ground floor: the restrooms behind the check-in hall.
  { id: 'wc-s', axis: 'x', at: -49.1, from: -26.0, to: -17.6, t: TB.inner, y0: 0, y1: UNDER1, openings: [door(-23.0, -21.8, 0, 2.3)] },
  { id: 'wc-w', axis: 'z', at: -25.9, from: TB_IN.z0, to: -49.2, t: TB.inner, y0: 0, y1: UNDER1, openings: [] },
  { id: 'wc-e', axis: 'z', at: -17.7, from: TB_IN.z0, to: -49.2, t: TB.inner, y0: 0, y1: UNDER1, openings: [breach(-55.5, -54.5, 0, 1.9)] },
  // The bookshop under the north mezzanine (its front is glass, below).
  { id: 'books-w', axis: 'z', at: -9.9, from: TB_IN.z0, to: -48.06, t: TB.inner, y0: 0, y1: UNDER1, openings: [] },
  { id: 'books-e', axis: 'z', at: 1.9, from: TB_IN.z0, to: -48.06, t: TB.inner, y0: 0, y1: UNDER1, openings: [] },
  // The hideout behind the toilets: someone's been living in the old store room (see HIDEOUT).
  { id: 'hide-s', axis: 'x', at: -50.0, from: -17.6, to: -10.0, t: TB.inner, y0: 0, y1: UNDER1, openings: [breach(-17.3, -16.4, 0, 1.9)] },
  // Makeshift walls the defenders put up: plywood and sheet steel on timber, head high, a gap to get through.
  { id: 'ply-checkin', axis: 'z', at: -28.5, from: -33.0, to: -23.0, t: 0.1, y0: 0, y1: 2.4, style: 'plywood', openings: [door(-28.4, -27.0, 0, 2.2)] },
  { id: 'ply-east', axis: 'x', at: -31.0, from: 13.0, to: 22.0, t: 0.1, y0: 0, y1: 2.4, style: 'sheet', openings: [door(16.6, 18.0, 0, 2.2)] },
  { id: 'ply-leg', axis: 'x', at: -0.4, from: 39.2, to: LEG_IN.x1, t: 0.1, y0: 0, y1: 2.4, style: 'sheet', openings: [door(40.4, 41.6, 0, 2.2)] },
  { id: 'ply-lounge', axis: 'x', at: -33.0, from: TB_IN.x0, to: -36.0, t: 0.1, y0: TB.l1, y1: TB.l1 + 2.4, style: 'plywood', openings: [] },
  // The duty-free shop in the east hall.
  { id: 'duty-n', axis: 'x', at: -48.0, from: 30.0, to: TB_IN.x1, t: TB.inner, y0: 0, y1: UNDER1, openings: [] },
  { id: 'duty-w', axis: 'z', at: 30.1, from: -47.9, to: -38.06, t: TB.inner, y0: 0, y1: UNDER1, openings: [door(-45.0, -43.0, 0, 2.4)] },
  // Upstairs: the restrooms on the north mezzanine, the VIP lounge's back wall.
  { id: 'wc2-s', axis: 'x', at: -50.1, from: -4.0, to: 4.0, t: TB.inner, y0: TB.l1, y1: UNDER2, openings: [door(-0.6, 0.6, TB.l1, TB.l1 + 2.3)] },
  { id: 'wc2-w', axis: 'z', at: -3.9, from: TB_IN.z0, to: -50.2, t: TB.inner, y0: TB.l1, y1: UNDER2, openings: [] },
  { id: 'wc2-e', axis: 'z', at: 3.9, from: TB_IN.z0, to: -50.2, t: TB.inner, y0: TB.l1, y1: UNDER2, openings: [] },
  { id: 'vip-e', axis: 'z', at: 27.9, from: TB_IN.z0, to: -46.06, t: TB.inner, y0: TB.l1, y1: UNDER2, openings: [door(-52.0, -50.6, TB.l1, TB.l1 + 2.3)] },
])

/**
 * Glazed runs: glass from `y0` up to `glassTop`, a solid header from there to
 * `y1` (none if they're equal), open where the doors are.
 */
export const TM_GLASS_RUNS = Object.freeze([
  // The security line between the check-in hall and the airside: four lanes through it, open above.
  {
    id: 'security',
    axis: 'z',
    at: -17.0,
    from: -44.0,
    to: TB_IN.z1,
    y0: 0,
    glassTop: 2.6,
    y1: 2.6,
    frame: 'steel',
    openings: [door(-41.0, -39.4, 0, 2.6), door(-36.0, -34.4, 0, 2.6), door(-31.0, -29.4, 0, 2.6), door(-26.0, -24.4, 0, 2.6)],
  },
  // Shopfronts: the bookshop and the duty-free.
  { id: 'books-s', axis: 'x', at: -48.0, from: -10.0, to: 2.0, y0: 0, glassTop: 3.0, y1: UNDER1, frame: 'dark', openings: [door(-5.6, -3.6, 0, 2.6)] },
  { id: 'duty-s', axis: 'x', at: -38.0, from: 30.0, to: TB_IN.x1, y0: 0, glassTop: 3.0, y1: UNDER1, frame: 'dark', openings: [door(35.0, 37.0, 0, 2.6)] },
  // The VIP lounge upstairs: glass to the lounge and the gates.
  { id: 'vip-s', axis: 'x', at: -46.0, from: 16.0, to: 28.0, y0: TB.l1, glassTop: TB.l1 + 2.9, y1: UNDER2, frame: 'dark', openings: [door(21.0, 23.0, TB.l1, TB.l1 + 2.5)] },
  { id: 'vip-w', axis: 'z', at: 16.0, from: TB_IN.z0, to: -46.06, y0: TB.l1, glassTop: TB.l1 + 2.9, y1: UNDER2, frame: 'dark', openings: [] },
])

/**
 * The glass fronts over the apron, both levels: floor-to-ceiling panes between
 * a dark spandrel at the upper floor and the fascia under the roof's edge.
 * The main front's doors: the baggage hall's shutter, two pairs of glass
 * doors, and Gate 3's door to the jet bridge upstairs; the leg's: two pairs
 * of glass doors. Each is a run (`axis`, `at`, `from`, `to`, `out` the side
 * the apron is on). `broken` panes ([a0, a1, y0, y1]) are shot out: open
 * where they reach the floor, just a ragged gap high up.
 */
const BANDS = [
  [UNDER1 - 0.05, TB.l1],
  [UNDER2 - 0.05, TB.top],
]
/** Height of the transoms across the panes, downstairs and up. */
export const TRANSOM = Object.freeze([2.95, TB.l1 + 2.6])
export const FACADE = Object.freeze({
  axis: 'x',
  at: TB.z1 - TB.wall / 2,
  from: TB_IN.x0,
  to: LEG.x0,
  out: 1,
  z: TB.z1 - TB.wall / 2,
  x0: TB_IN.x0,
  x1: LEG.x0,
  /** Solid bands: the spandrel over the upper floor's edge, the fascia over the roof's. */
  bands: BANDS,
  ground: [door(-38.0, -33.0, 0, 3.6), door(-11.4, -9.4, 0, 2.7), door(9.4, 11.4, 0, 2.7)],
  upper: [door(-7.2, -4.8, TB.l1, TB.l1 + 2.4)],
  /** The shutter's box and the panel over it (solid, not glass). */
  shutter: [-38.0, -33.0, 3.6, UNDER1 - 0.05],
  boarded: [
    [TB_IN.x0, -38.0, 0, BANDS[0][0]],
    [TB_IN.x0, -33.5, TB.l1, TRANSOM[1]],
  ],
  broken: [
    [-27.0, -24.0, 0, TRANSOM[0]],
    [15.5, 18.5, 0, TRANSOM[0]],
    [-20.5, -16.0, TRANSOM[1], BANDS[1][0]],
    [3.0, 7.5, TRANSOM[1], BANDS[1][0]],
    [21.0, 25.5, TRANSOM[0], BANDS[0][0]],
  ],
})
/** The leg's west front, facing the jet (from the main front's corner to the leg's south end). */
export const LEG_FACADE = Object.freeze({
  axis: 'z',
  at: LEG.x0 + TB.wall / 2,
  from: TB_IN.z1,
  to: LEG_IN.z1,
  out: -1,
  bands: BANDS,
  ground: [door(-9.2, -7.2, 0, 2.7), door(3.6, 5.6, 0, 2.7)],
  upper: [],
  shutter: null,
  boarded: [
    [6.4, LEG_IN.z1, 0, BANDS[0][0]],
    [TB_IN.z1, -15.0, TB.l1, TRANSOM[1]],
  ],
  broken: [
    [-16.4, -13.4, 0, TRANSOM[0]],
    [-1.6, 1.4, 0, TRANSOM[0]],
    [-12.5, -8.0, TRANSOM[1], BANDS[1][0]],
    [6.0, 10.5, TRANSOM[1], BANDS[1][0]],
  ],
})
export const TM_FRONTS = Object.freeze([FACADE, LEG_FACADE])

/**
 * The hideout (behind the toilets, under the north mezzanine): the store room
 * someone holed up in. Its walls are the toilets', the bookshop's and hide-s;
 * in through the hole knocked in the toilets' wall or the gap from the hall.
 */
export const HIDEOUT = Object.freeze({ x0: -17.5, x1: -10.1, z0: TB_IN.z0, z1: -50.1 })

/** Upper floor and roof: rectangles minus holes (the hall's void, the stairwells, the skylights). */
export const TM_VOID = Object.freeze([-12.0, 12.0, -44.0, -27.0])
export const TM_SKYLIGHTS = Object.freeze([
  [-9.5, -1.0, -41.5, -29.5],
  [1.0, 9.5, -41.5, -29.5],
  [-40.0, -16.0, -35.0, -31.0],
  [16.0, 40.0, -35.0, -31.0],
])
const STAIR_HOLES = [
  [-41.5, -33.0, TB_IN.z0, -53.5],
  [30.0, 38.5, TB_IN.z0, -53.5],
]
/**
 * War damage overhead: the bay of the leg's upper floor that came down (see
 * COLLAPSE), and the holes shells blew through the roof (over it, and over
 * the Sky Lounge's west end).
 */
export const LEG_HOLE = Object.freeze([30.0, 36.6, -1.0, 7.6])
export const ROOF_HOLES = Object.freeze([
  [31.0, 36.0, -2.4, 4.6],
  [-40.0, -35.5, -51.0, -46.5],
])
const INSIDE = [TB_IN.x0, TB_IN.x1, TB_IN.z0, TB_IN.z1]
const LEG_RECT = [LEG_IN.x0, LEG_IN.x1, LEG_IN.z0, LEG_IN.z1]
export const TM_SLABS = Object.freeze([
  { y: TB.l1, rects: [...rectMinus(INSIDE, [TM_VOID, ...STAIR_HOLES]), ...rectMinus(LEG_RECT, [LEG_HOLE])], roof: false },
  { y: TB.roof, rects: [...rectMinus(INSIDE, [...TM_SKYLIGHTS, ...ROOF_HOLES]), ...rectMinus(LEG_RECT, ROOF_HOLES)], roof: true },
])

/**
 * The fallen slab: broken off along the hole's north edge and come down on
 * the ground floor, a ramp from one floor to the other (its top face is the
 * walking surface, `top` to `bottom`).
 */
export const COLLAPSE = Object.freeze({ top: [33.3, TB.l1, -1.0], bottom: [33.3, 0.12, 6.4], width: 5.6, thick: 0.35 })

/** Square columns floor to roof: [x, z, size]. The hall's stand 2 cm proud of the void's edge. */
export const TM_COLUMNS = Object.freeze([
  // West hall.
  [-36.0, -36.0, 0.9],
  [-36.0, -26.0, 0.9],
  [-26.0, -36.0, 0.9],
  [-26.0, -46.0, 0.9],
  // Round the hall's void.
  [-12.47, -44.47, 0.9],
  [12.47, -44.47, 0.9],
  [-12.47, -26.53, 0.9],
  [12.47, -26.53, 0.9],
  [0.0, -44.47, 0.9],
  [0.0, -26.53, 0.9],
  // East hall.
  [24.0, -44.0, 0.9],
  [24.0, -32.0, 0.9],
  [36.0, -32.0, 0.9],
  [36.0, -44.0, 0.9],
  // Behind the glass front.
  [-40.0, -20.88, 0.6],
  [-30.0, -20.88, 0.6],
  [-22.0, -20.88, 0.6],
  [-14.0, -20.88, 0.6],
  [14.0, -20.88, 0.6],
  [20.0, -20.88, 0.6],
  [34.0, -20.88, 0.6],
  [40.0, -20.88, 0.6],
  // The leg (the ones under the fallen bay came down with it), and behind its glass.
  [33.4, -12.0, 0.9],
  [38.6, -12.0, 0.9],
  [38.6, -2.0, 0.9],
  [38.6, 8.0, 0.9],
  [28.88, -18.4, 0.6],
  [28.88, -5.0, 0.6],
  [28.88, 8.4, 0.6],
])

/**
 * Flights: stairs (solid, a stepped mass under them) and escalators (a truss
 * under the steps, balustrades both sides and between the two lanes), from
 * `bottom` up to `top` (x, y, z); `rails` names the sides with a rail, `glass`
 * makes them glass balustrades.
 */
export const TM_FLIGHTS = Object.freeze([
  { id: 'westStair', kind: 'stair', bottom: [-41.5, 0, -54.7], top: [-33.0, TB.l1, -54.7], width: 2.0, rails: ['s'] },
  { id: 'eastStair', kind: 'stair', bottom: [30.0, 0, -54.7], top: [38.5, TB.l1, -54.7], width: 2.0, rails: ['s'] },
  { id: 'escalators', kind: 'escalator', bottom: [-10.0, 0, -35.3], top: [-10.0, TB.l1, -44.0], width: 2.4, rails: ['w', 'e'], lanes: 2 },
  { id: 'grandStair', kind: 'stair', bottom: [10.1, 0, -35.6], top: [10.1, TB.l1, -27.0], width: 3.0, rails: ['w', 'e'], glass: true },
  { id: 'outsideStair', kind: 'stair', bottom: [44.9, 0, -38.0], top: [44.9, TB.l1, -46.6], width: 1.8, rails: ['e'], outside: true },
])
const flightById = Object.fromEntries(TM_FLIGHTS.map((f) => [f.id, f]))
export const tmFlight = (id) => flightById[id]

/** The landing at the top of the stairs outside: a solid block, rails round its open sides. */
export const TM_LANDINGS = Object.freeze([
  { x0: 44.0, x1: 46.0, z0: -49.2, z1: -46.6, y: TB.l1, rails: [[45.96, -49.16, 45.96, -46.6], [44.0, -49.16, 45.96, -49.16]] },
])

/** Balustrades on the upper floor: [ax, az, bx, bz, y, glass]. */
export const TM_RAILS = Object.freeze([
  // Round the hall's void (gaps where the escalators and the grand stair arrive).
  [-12.0, -43.95, -11.2, -43.95, TB.l1, true],
  [-8.8, -43.95, 12.0, -43.95, TB.l1, true],
  [-12.0, -27.05, 8.6, -27.05, TB.l1, true],
  [11.6, -27.05, 12.0, -27.05, TB.l1, true],
  [-11.95, -43.95, -11.95, -27.05, TB.l1, true],
  [11.95, -43.95, 11.95, -27.05, TB.l1, true],
  // Round the stairwells.
  [-41.5, -53.45, -33.0, -53.45, TB.l1, false],
  [-41.45, TB_IN.z0, -41.45, -53.45, TB.l1, false],
  [30.0, -53.45, 38.5, -53.45, TB.l1, false],
  [30.05, TB_IN.z0, 30.05, -53.45, TB.l1, false],
])

/* ---------------------------------------------------------------------------
 * Furniture and fittings: low cover through the terminal.
 * [kind, x, z, w, h, d, rotY, y]  (w along local x, d along local z)
 * ------------------------------------------------------------------------- */

const L1 = TB.l1
const furniture = [
  // West hall: check-in desks (three islands), the baggage belts behind them, self check-in kiosks.
  ['desk', -38.75, -46.0, 3.5, 1.05, 0.9, 0],
  ['desk', -33.65, -46.0, 3.5, 1.05, 0.9, 0],
  ['desk', -29.0, -46.0, 3.2, 1.05, 0.9, 0],
  ['belt', -38.75, -47.6, 3.5, 0.55, 0.8, 0],
  ['belt', -33.65, -47.6, 3.5, 0.55, 0.8, 0],
  ['belt', -29.0, -47.6, 3.2, 0.55, 0.8, 0],
  ['kiosk', -40.0, -40.6, 0.6, 1.5, 0.5, 0],
  ['kiosk', -38.6, -40.6, 0.6, 1.5, 0.5, 0],
  ['kiosk', -31.0, -40.6, 0.6, 1.5, 0.5, 0],
  ['kiosk', -29.6, -40.6, 0.6, 1.5, 0.5, 0],
  ['seats', -40.6, -27.4, 3.6, 0.9, 0.7, 0],
  ['seats', -31.0, -30.0, 3.6, 0.9, 0.7, Math.PI],
  ['cart', -42.6, -44.0, 0.8, 1.1, 2.4, 0],
  // Security: an X-ray machine beside each lane (the tunnel over the rollers).
  ['xray', -20.2, -41.55, 6.0, 0.8, 0.9, 0],
  ['xray', -20.2, -36.55, 6.0, 0.8, 0.9, 0],
  ['xray', -20.2, -31.55, 6.0, 0.8, 0.9, 0],
  ['xray', -20.2, -26.55, 6.0, 0.8, 0.9, 0],
  ['tunnel', -20.6, -41.55, 1.7, 1.45, 1.0, 0],
  ['tunnel', -20.6, -36.55, 1.7, 1.45, 1.0, 0],
  ['tunnel', -20.6, -31.55, 1.7, 1.45, 1.0, 0],
  ['tunnel', -20.6, -26.55, 1.7, 1.45, 1.0, 0],
  // Restrooms: the basins and two cubicle partitions.
  ['basins', -18.1, -52.4, 0.6, 0.9, 3.6, 0],
  ['stall', -23.6, -54.9, 0.06, 2.1, 1.6, 0],
  ['stall', -21.8, -54.9, 0.06, 2.1, 1.6, 0],
  // The hall: the planter round the palm, the departures board, the information desk, benches.
  ['planter', 0.0, -36.75, 8.0, 0.65, 6.5, 0],
  ['board', 0.0, -30.0, 2.6, 2.7, 0.6, 0],
  ['info', -5.0, -30.6, 2.8, 1.05, 1.2, 0],
  ['seats', -5.4, -40.8, 3.6, 0.9, 0.7, Math.PI / 2],
  ['seats', 5.6, -32.6, 3.6, 0.9, 0.7, -Math.PI / 2],
  ['cart', 6.6, -42.2, 0.8, 1.1, 2.4, 0.3],
  // Under the north mezzanine: the bookshop's shelves and till, the coffee bar.
  ['shelf', -7.2, -52.8, 4.2, 1.8, 0.6, 0],
  ['shelf', -1.6, -52.8, 4.2, 1.8, 0.6, 0],
  ['shelf', -9.4, -54.6, 0.5, 2.2, 2.2, 0],
  ['counter', -1.0, -49.6, 2.4, 1.05, 0.7, 0],
  ['counter', 7.0, -50.4, 5.0, 1.1, 0.8, 0],
  ['shelf', 7.0, -55.45, 5.0, 2.2, 0.5, 0],
  // East hall: the café, its tables.
  ['counter', 21.0, -53.6, 8.0, 1.1, 0.9, 0],
  ['shelf', 21.0, -55.45, 8.0, 2.2, 0.5, 0],
  ['table', 18.6, -50.0, 0.9, 0.75, 0.9, 0],
  ['table', 21.6, -49.2, 0.9, 0.75, 0.9, 0],
  ['table', 24.8, -50.4, 0.9, 0.75, 0.9, 0],
  ['table', 19.4, -46.8, 0.9, 0.75, 0.9, 0],
  ['table', 27.6, -47.4, 0.9, 0.75, 0.9, 0],
  // The duty-free: shelf islands and a counter.
  ['shelf', 33.6, -44.2, 3.0, 1.5, 0.8, 0],
  ['shelf', 39.4, -44.2, 3.0, 1.5, 0.8, 0],
  ['shelf', 34.0, -41.2, 3.0, 1.5, 0.8, 0],
  ['counter', 41.4, -40.4, 2.6, 1.05, 0.7, 0],
  ['shelf', 43.45, -47.0, 0.5, 2.2, 1.6, 0],
  // East hall: gate seating, back to back in banks, facing the glass.
  ...[19.3, 24.3, 29.3, 34.3, 39.3].flatMap((x) => [
    ['seats', x, -28.25, 3.6, 0.9, 0.7, 0],
    ['seats', x, -27.55, 3.6, 0.9, 0.7, Math.PI],
  ]),
  ...[19.3, 24.3, 34.3, 39.3].flatMap((x) => [
    ['seats', x, -24.25, 3.6, 0.9, 0.7, 0],
    ['seats', x, -23.55, 3.6, 0.9, 0.7, Math.PI],
  ]),

  // Upstairs, the Sky Lounge: the bar, its back shelves, tables, sofas along the glass, planters.
  ['counter', -25.0, -52.5, 10.0, 1.1, 1.0, 0, L1],
  ['shelf', -25.0, -55.45, 10.0, 2.2, 0.5, 0, L1],
  ['table', -40.0, -44.0, 0.8, 0.75, 0.8, 0, L1],
  ['table', -32.0, -44.6, 0.8, 0.75, 0.8, 0, L1],
  ['table', -22.0, -44.0, 0.8, 0.75, 0.8, 0, L1],
  ['table', -40.2, -38.6, 0.8, 0.75, 0.8, 0, L1],
  ['table', -30.6, -40.2, 0.8, 0.75, 0.8, 0, L1],
  ['table', -18.6, -40.4, 0.8, 0.75, 0.8, 0, L1],
  ['sofa', -40.0, -22.6, 2.4, 0.85, 0.9, Math.PI, L1],
  ['sofa', -33.0, -22.6, 2.4, 0.85, 0.9, Math.PI, L1],
  ['sofa', -26.0, -22.6, 2.4, 0.85, 0.9, Math.PI, L1],
  ['sofa', -18.4, -22.6, 2.4, 0.85, 0.9, Math.PI, L1],
  // Two sofa groups round low tables between the columns.
  ['table', -31.0, -37.2, 1.2, 0.5, 0.8, 0, L1],
  ['sofa', -31.0, -39.0, 2.4, 0.85, 0.9, Math.PI, L1],
  ['sofa', -31.0, -35.4, 2.4, 0.85, 0.9, 0, L1],
  ['table', -20.6, -37.2, 1.2, 0.5, 0.8, 0, L1],
  ['sofa', -20.6, -39.0, 2.4, 0.85, 0.9, Math.PI, L1],
  ['sofa', -20.6, -35.4, 2.4, 0.85, 0.9, 0, L1],
  ['planter', -40.0, -29.0, 3.0, 1.0, 0.8, 0, L1],
  ['planter', -30.6, -29.0, 3.0, 1.0, 0.8, 0, L1],
  ['planter', -21.0, -29.0, 3.0, 1.0, 0.8, 0, L1],
  // North mezzanine: benches along the void.
  ['seats', -6.6, -46.0, 3.6, 0.9, 0.7, Math.PI, L1],
  ['seats', 6.6, -46.0, 3.6, 0.9, 0.7, Math.PI, L1],
  ['basins', 3.5, -53.2, 0.6, 0.9, 3.0, 0, L1],
  // Gate 3: its desk and seats.
  ['podium', -1.6, -24.4, 2.2, 1.05, 0.7, 0, L1],
  ['seats', 2.6, -23.4, 3.6, 0.9, 0.7, 0, L1],
  ['seats', 6.8, -23.4, 2.4, 0.9, 0.7, 0, L1],
  ['seats', -10.0, -24.6, 2.4, 0.9, 0.7, Math.PI / 2, L1],
  // East upstairs: gate seating, the VIP lounge's sofas.
  ...[16.6, 21.6, 26.6, 31.6, 36.6].flatMap((x) => [
    ['seats', x, -28.75, 3.6, 0.9, 0.7, 0, L1],
    ['seats', x, -28.05, 3.6, 0.9, 0.7, Math.PI, L1],
  ]),
  ['sofa', 18.4, -51.6, 2.4, 0.85, 0.9, Math.PI / 2, L1],
  ['sofa', 24.6, -54.6, 2.4, 0.85, 0.9, 0, L1],
  ['table', 21.4, -51.2, 1.2, 0.5, 0.8, 0, L1],
  ['planter', 41.4, -37.6, 2.6, 1.0, 0.8, 0, L1],

  // The leg, downstairs: the baggage carousel, seats, the baggage desk, carts.
  ['carousel', 36.0, -7.0, 2.6, 0.6, 8.4, 0],
  ['seats', 30.6, -11.0, 3.6, 0.9, 0.7, Math.PI / 2],
  ['seats', 41.8, -15.0, 3.6, 0.9, 0.7, -Math.PI / 2],
  ['seats', 41.8, 2.0, 3.6, 0.9, 0.7, -Math.PI / 2],
  ['desk', 42.2, 10.6, 2.8, 1.05, 0.9, Math.PI],
  ['cart', 40.2, 6.4, 0.8, 1.1, 2.4, 0.5],
  // Upstairs: gate seating in banks.
  ...[-15.0, -8.0].flatMap((z) =>
    [33.2, 39.0].flatMap((x) => [
      ['seats', x, z - 0.35, 3.6, 0.9, 0.7, 0, L1],
      ['seats', x, z + 0.35, 3.6, 0.9, 0.7, Math.PI, L1],
    ]),
  ),

  // The hideout: two cots, the radio table, crates of supplies.
  ['cot', -14.6, -55.0, 2.0, 0.45, 0.8, 0],
  ['cot', -14.6, -51.0, 2.0, 0.45, 0.8, 0],
  ['radioTable', -11.2, -52.6, 1.0, 0.78, 1.8, 0],
  ['crates', -13.2, -53.0, 1.2, 1.1, 0.8, 0.3],
  // Outside it in the hall, the shelf unit fallen against the wall beside the gap, half hiding it.
  ['shelfFallen', -15.2, -49.62, 2.2, 1.7, 0.5, 0],

  // Planters knocked over (soil and the plant spilled out of them), tables on their sides.
  ['potFallen', -8.6, -33.6, 0.75, 0.7, 0.95, 0.8],
  ['potFallen', 13.6, -40.6, 0.75, 0.7, 0.95, -1.2],
  ['potFallen', -35.0, -40.8, 0.75, 0.7, 0.95, 2.2],
  ['potFallen', 42.2, -9.0, 0.75, 0.7, 0.95, 0.3],
  ['potFallen', -22.4, -31.0, 0.75, 0.7, 0.95, 0.6, L1],
  ['potFallen', 9.2, -21.8, 0.75, 0.7, 0.95, 0.2, L1],
  ['tableBroken', 18.4, -44.4, 1.2, 0.9, 0.45, 0.4],
  ['tableBroken', 23.2, -47.2, 1.2, 0.9, 0.45, -0.6],
  ['tableBroken', 31.4, -6.0, 1.2, 0.9, 0.45, 1.0],
  ['tableBroken', -26.4, -42.0, 1.2, 0.9, 0.45, 1.4, L1],
  ['tableBroken', 34.0, -4.0, 1.2, 0.9, 0.45, 0.5, L1],

  // The fighting: sandbagged positions, barricades of whatever was to hand,
  // ammunition crates, and rubble where the shells came in.
  ['sandbags', -2.2, -22.8, 3.0, 1.05, 0.8, 0],
  ['sandbags', -36.0, -23.4, 3.0, 1.05, 0.8, 0],
  ['sandbags', 32.6, -17.6, 3.0, 1.05, 0.8, 0],
  ['sandbags', 39.8, -17.6, 2.6, 1.05, 0.8, 0.2],
  ['sandbags', -9.6, -22.4, 2.6, 1.05, 0.8, 0, L1],
  ['sandbags', 24.0, -22.2, 3.0, 1.05, 0.8, 0, L1],
  ['sandbags', 29.8, -6.2, 0.8, 1.05, 3.0, 0, L1],
  ['sandbags', 29.8, 9.8, 0.8, 1.05, 2.6, 0, L1],
  ['barricade', 13.0, -23.0, 2.6, 1.1, 1.0, 0.2],
  ['barricade', 36.0, -19.0, 3.0, 1.1, 1.0, 0.1, L1],
  ['crates', -20.4, -22.4, 1.6, 1.1, 1.0, 0.3],
  ['crates', 42.6, -19.0, 1.6, 1.1, 1.0, 0],
  ['crates', 42.4, 8.8, 1.6, 1.1, 1.0, 0, L1],
  ['rubble', -25.5, -23.0, 2.4, 0.35, 1.4, 0.3],
  ['rubble', 29.4, 7.4, 1.4, 0.6, 2.0, 0.15],
  ['rubble', 37.7, 4.6, 1.8, 1.0, 2.8, -0.2],
  ['rubble', 38.0, 1.4, 1.6, 0.7, 2.4, 0.3, L1],
  ['rubble', -37.6, -48.8, 3.2, 1.1, 2.8, 0.2, L1],
]
export const TM_FURNITURE = Object.freeze(furniture.map(([kind, x, z, w, h, d, rotY = 0, y = 0]) => ({ kind, p: [x, y, z], size: [w, h, d], rotY })))

/** The walk-through metal detectors in the security lanes: [z]. Only their posts are solid. */
export const TM_ARCHES = Object.freeze([-40.2, -35.2, -30.2, -25.2])

add({ type: 'terminal' })

/* ---------------------------------------------------------------------------
 * The jet at the gate
 *
 * Nose-in, nose north, its centreline on x = 0. A round fuselage (constant
 * from `body0` to `body1`, a blunt nose in front, the tail cone sweeping up
 * behind), the cabin floor at `floor`, a low wing each side with an engine
 * under it, the main gear under the wing roots and the nose gear, the
 * tailplane and the fin. Open doors: front left (the jet bridge), front right
 * (the escape slide), the over-wing exits each side (onto the wings), back
 * right (the airstair truck).
 * ------------------------------------------------------------------------- */

export const PLANE = Object.freeze({
  x: 0,
  yc: 4.2,
  R: 2.25,
  floor: 3.5,
  /** Cabin ceiling (the lining under the bins). */
  ceil: 5.95,
  nose: -16.0,
  body0: -10.0,
  body1: 21.0,
  tail: 32.0,
  /** The cabin runs between the cockpit bulkhead and the rear one. */
  bulkF: -9.6,
  bulkR: 20.4,
  doorTop: 5.45,
  /** side -1 = left (west), +1 = right (east). */
  doors: [
    { id: 'L1', side: -1, z0: -8.2, z1: -7.0 },
    { id: 'R1', side: 1, z0: -8.2, z1: -7.0 },
    { id: 'L3', side: -1, z0: 4.4, z1: 5.4 },
    { id: 'R3', side: 1, z0: 4.4, z1: 5.4 },
    { id: 'R4', side: 1, z0: 17.6, z1: 18.8 },
  ],
  /** Shut doors (drawn, not cut). */
  shut: [{ side: -1, z0: 17.6, z1: 18.8 }],
  /** Wing: root (inside the fuselage) to tip; leading and trailing edge z at each; top surface height; thickness. */
  wing: { root: 2.0, tip: 21.0, le: [2.0, 11.5], te: [9.5, 14.0], top: [3.45, 4.3], thick: [0.55, 0.16] },
  engine: { x: 8.5, y: 2.0, r: 1.2, z0: -3.0, z1: 3.0 },
  noseGear: { z: -12.0 },
  mainGear: { x: 3.1, z: 10.0 },
  tailplane: { y: 5.2, root: 1.0, tip: 9.5, le: [25.5, 29.5], te: [31.0, 31.9], thick: [0.36, 0.12] },
  fin: { root: [22.4, 31.6], tipZ: [29.4, 32.6], y0: 6.0, y1: 14.0, thick: 0.5 },
})

/** Centre height and radius of the fuselage's section at `z` (nose, constant body, tail cone). */
export function fuselageAt(z) {
  const P = PLANE
  if (z <= P.body0) {
    const t = Math.max(0, (z - P.nose) / (P.body0 - P.nose))
    return { yc: P.yc - 0.6 * (1 - t) ** 2, r: Math.max(0.04, P.R * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2))) }
  }
  if (z >= P.body1) {
    const t = Math.min(1, (z - P.body1) / (P.tail - P.body1))
    return { yc: P.yc + 1.35 * t ** 1.5, r: P.R * (1 - 0.8 * t ** 1.2) }
  }
  return { yc: P.yc, r: P.R }
}

/** The wing at a distance `d` out from the centreline: leading and trailing edge z, top height, thickness. */
export function wingAt(d) {
  const w = PLANE.wing
  const f = Math.min(1, Math.max(0, (d - w.root) / (w.tip - w.root)))
  const lerp = ([a, b]) => a + (b - a) * f
  return { le: lerp(w.le), te: lerp(w.te), top: lerp(w.top), thick: lerp(w.thick) }
}

/** The tailplane at a distance `d` out from the centreline. */
export function tailplaneAt(d) {
  const t = PLANE.tailplane
  const f = Math.min(1, Math.max(0, (d - t.root) / (t.tip - t.root)))
  const lerp = ([a, b]) => a + (b - a) * f
  return { le: lerp(t.le), te: lerp(t.te), y: t.y + f * 0.35, thick: lerp(t.thick) }
}

/**
 * The cabin's fittings (solid: cover in the cabin): seat rows (a block of two
 * seats each side of the aisle; business class wider and further apart), the
 * galley at the front, the lavatories and the galley at the back. The over-wing
 * exit row is left clear. [x0, x1, z0, z1, h] above the cabin floor.
 */
export const CABIN = Object.freeze({
  business: [-5.4, -3.8, -2.2, -0.6],
  economy: [1.4, 2.25, 3.1, ...Array.from({ length: 12 }, (_, k) => +(6.6 + k * 0.85).toFixed(2))],
  fittings: [
    // Front galley either side, a trolley parked between.
    [-1.9, -0.7, -9.55, -8.85, 1.05, 'galley'],
    [0.7, 1.9, -9.55, -8.85, 1.05, 'galley'],
    [-0.2, 0.2, -9.5, -8.9, 1.0, 'trolley'],
    // Lavatories in the back corners, the rear galley between them.
    [-1.95, -0.75, 19.25, 20.35, 2.2, 'lav'],
    [0.75, 1.95, 19.25, 20.35, 2.2, 'lav'],
    [-0.6, 0.6, 19.8, 20.35, 1.05, 'galley'],
  ],
})

/** Seat blocks as [x0, x1, z0, z1, h, kind]: each row, each side of the aisle. */
export function cabinSeats() {
  const out = []
  for (const z of CABIN.business) for (const s of [-1, 1]) out.push([s > 0 ? 0.75 : -1.95, s > 0 ? 1.95 : -0.75, z - 0.5, z + 0.5, 1.15, 'business'])
  for (const z of CABIN.economy) for (const s of [-1, 1]) out.push([s > 0 ? 0.65 : -1.95, s > 0 ? 1.95 : -0.65, z - 0.38, z + 0.38, 1.12, 'economy'])
  return out
}

function cabinColliders() {
  const y = PLANE.floor
  return [...cabinSeats(), ...CABIN.fittings].map(([x0, x1, z0, z1, h]) => boxC([(x0 + x1) / 2, y + h / 2, (z0 + z1) / 2], [x1 - x0, h, z1 - z0]))
}

/** Shell segments round the body: 16 flat boxes, each split round the doors cut through it. */
export const SHELL_SEGMENTS = 16
const SHELL_T = 0.14
/** Which shell segments a door on `side` cuts: the three round its middle height. */
const doorSegments = (side) => (side > 0 ? [15, 0, 1] : [7, 8, 9])

function shellColliders() {
  const P = PLANE
  const out = []
  const step = (Math.PI * 2) / SHELL_SEGMENTS
  const width = 2 * P.R * Math.tan(step / 2) + 0.02
  for (let k = 0; k < SHELL_SEGMENTS; k++) {
    const a = k * step
    const cuts = P.doors
      .filter((d) => doorSegments(d.side).includes(k))
      .map((d) => [d.z0, d.z1])
      .sort((p, q) => p[0] - q[0])
    let cursor = P.body0
    const runs = []
    for (const [z0, z1] of cuts) {
      if (z0 > cursor) runs.push([cursor, z0])
      cursor = z1
    }
    runs.push([cursor, P.body1])
    const r = P.R - SHELL_T / 2
    const q = quatFromEuler(0, 0, a - Math.PI / 2)
    for (const [z0, z1] of runs) out.push(boxC([P.x + Math.cos(a) * r, P.yc + Math.sin(a) * r, (z0 + z1) / 2], [width, SHELL_T, z1 - z0], q))
  }
  // Under each door, the sill down to where the shell carries on.
  for (const d of P.doors) out.push(boxC([P.x + d.side * 2.1, (P.floor + 2.95) / 2, (d.z0 + d.z1) / 2], [0.3, P.floor - 2.95, d.z1 - d.z0]))
  // The cabin floor.
  out.push(boxC([P.x, P.floor - 0.15, (P.bulkF + P.bulkR) / 2], [4.24, 0.3, P.bulkR - P.bulkF]))
  // Nose and tail cones: solid, stacked short cylinders along the fuselage (the first and last close the cabin).
  const alongZ = quatFromEuler(Math.PI / 2, 0, 0)
  const cone = (z0, z1) => {
    const m = fuselageAt((z0 + z1) / 2)
    out.push(cylC([P.x, m.yc, (z0 + z1) / 2], m.r, Math.abs(z1 - z0), alongZ))
  }
  const noseCuts = [P.bulkF, -11.0, -12.4, -13.6, -14.6, -15.4, -15.85]
  for (let i = 0; i < noseCuts.length - 1; i++) cone(noseCuts[i + 1], noseCuts[i])
  const tailCuts = [P.bulkR, 22.5, 24.5, 26.5, 28.5, 30.2, 31.6]
  for (let i = 0; i < tailCuts.length - 1; i++) cone(tailCuts[i], tailCuts[i + 1])
  return out
}

/** The wings, tailplane, fin, engines and gear. */
function airframeColliders() {
  const P = PLANE
  const out = []
  for (const s of [-1, 1]) {
    // Wing: one-metre bands from the root to the tip (you can walk on it from the over-wing exits).
    for (let d = P.wing.root; d < P.wing.tip - 1e-6; d += 1) {
      const m = wingAt(d + 0.5)
      out.push(boxC([P.x + s * (d + 0.5), m.top - m.thick / 2, (m.le + m.te) / 2], [1.0, m.thick, m.te - m.le]))
    }
    // Tailplane, out of reach.
    const tpStep = (P.tailplane.tip - P.tailplane.root) / 8
    for (let i = 0; i < 8; i++) {
      const d = P.tailplane.root + tpStep * (i + 0.5)
      const m = tailplaneAt(d)
      out.push(boxC([P.x + s * d, m.y, (m.le + m.te) / 2], [tpStep, m.thick, m.te - m.le]))
    }
    // Engine nacelle (the pylon above it is drawn, not solid).
    const e = P.engine
    out.push(cylC([P.x + s * e.x, e.y, (e.z0 + e.z1) / 2], e.r, e.z1 - e.z0, quatFromEuler(Math.PI / 2, 0, 0)))
    // Main gear: the bogie and its leg under the wing root.
    out.push(boxC([P.x + s * P.mainGear.x, 1.35, P.mainGear.z], [1.2, 2.7, 2.2]))
  }
  out.push(boxC([P.x, 1.1, P.noseGear.z], [0.9, 2.2, 1.2]))
  // The fin, in four swept layers.
  const f = P.fin
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4
    const z0 = f.root[0] + (f.tipZ[0] - f.root[0]) * t
    const z1 = f.root[1] + (f.tipZ[1] - f.root[1]) * t
    const h = (f.y1 - f.y0) / 4
    out.push(boxC([P.x, f.y0 + h * (i + 0.5), (z0 + z1) / 2], [f.thick * (1 - t * 0.5), h, z1 - z0]))
  }
  return out
}

add({ type: 'plane' })

/* ---------------------------------------------------------------------------
 * The jet bridge: a steel corridor (one small window each side) from Gate 3 (upstairs, in the glass front)
 * sloping down to the cab at the jet's front left door.
 * ------------------------------------------------------------------------- */

export const JET_BRIDGE = Object.freeze({
  x0: -7.3,
  x1: -4.7,
  z0: TB.z1,
  z1: -9.8,
  y0: TB.l1,
  y1: PLANE.floor,
  cab: { x0: -7.5, x1: -2.3, z0: -9.8, z1: -5.4 },
  wall: 0.12,
  height: 2.45,
  floorT: 0.3,
  roofT: 0.15,
  /** The walls' lower part (solid panels) goes up to here; steel above it. */
  sill: 1.0,
  /** Supports: the rotunda column by the terminal, the drive column's legs and bogie. */
  rotunda: [-6.0, -18.6],
  drive: -11.0,
})

/** Floor height of the jet bridge's corridor at `z`. */
export function bridgeFloorAt(z) {
  const J = JET_BRIDGE
  const f = Math.min(1, Math.max(0, (z - J.z0) / (J.z1 - J.z0)))
  return J.y0 + (J.y1 - J.y0) * f
}

/**
 * The corridor's walls are steel all the way up (you can't see in or out),
 * but for one small window each side halfway along it: where along it
 * (fractions from the terminal end) and how high above its floor.
 */
export const BRIDGE_WINDOW = Object.freeze({ f0: 0.44, f1: 0.54, y0: 1.3, y1: 1.95 })

/** A slab along the corridor between fractions f0 and f1, its top `lift` over the floor. */
export function bridgeSlab(x, f0, f1, lift, width, thick) {
  const J = JET_BRIDGE
  const at = (f) => [x, J.y0 + (J.y1 - J.y0) * f + lift, J.z0 + (J.z1 - J.z0) * f]
  return rampBox(at(f0), at(f1), width, thick)
}

/**
 * The corridor's sloping parts as boxes (shared with the renderer): its
 * floor, the walls (the lower part and the steel round the windows), the
 * roof. The windows' glass is in TERMINAL_GLASS.
 * [{ kind: 'floor' | 'wall' | 'metal' | 'roof', box: a rampBox }]
 */
export function bridgeSlopes() {
  const J = JET_BRIDGE
  const W = BRIDGE_WINDOW
  const mid = (J.x0 + J.x1) / 2
  const out = [{ kind: 'floor', box: bridgeSlab(mid, 0, 1, 0, J.x1 - J.x0, J.floorT) }]
  for (const x of [J.x0 + J.wall / 2, J.x1 - J.wall / 2]) {
    out.push({ kind: 'wall', box: bridgeSlab(x, 0, 1, J.sill, J.wall, J.sill) })
    out.push({ kind: 'metal', box: bridgeSlab(x, 0, W.f0, J.height, J.wall, J.height - J.sill) })
    out.push({ kind: 'metal', box: bridgeSlab(x, W.f1, 1, J.height, J.wall, J.height - J.sill) })
    out.push({ kind: 'metal', box: bridgeSlab(x, W.f0, W.f1, W.y0, J.wall, W.y0 - J.sill) })
    out.push({ kind: 'metal', box: bridgeSlab(x, W.f0, W.f1, J.height, J.wall, J.height - W.y1) })
  }
  out.push({ kind: 'roof', box: bridgeSlab(mid, 0, 1, J.height + J.roofT, J.x1 - J.x0, J.roofT) })
  return out
}

/** The corridor's two windows (rampBoxes): the glass in the gap in each wall. */
export function bridgeWindows() {
  const J = JET_BRIDGE
  const W = BRIDGE_WINDOW
  return [J.x0 + J.wall / 2, J.x1 - J.wall / 2].map((x) => bridgeSlab(x, W.f0, W.f1, W.y1, J.wall * 0.4, W.y1 - W.y0))
}

/** The cab's parts as axis-aligned boxes [x0, x1, y0, y1, z0, z1, kind]. */
export function bridgeCabBoxes() {
  const J = JET_BRIDGE
  const c = J.cab
  const y = J.y1
  const top = y + J.height
  const w = J.wall
  const out = [[c.x0, c.x1, y - J.floorT, y, c.z0, c.z1, 'floor']]
  const wallRun = (x0, x1, z0, z1) => {
    out.push([x0, x1, y, y + J.sill, z0, z1, 'wall'])
    out.push([x0, x1, y + J.sill, top, z0, z1, 'metal'])
  }
  // North side (either side of the corridor's mouth), south, west.
  wallRun(c.x0, J.x0 + w, c.z0, c.z0 + w)
  wallRun(J.x1 - w, c.x1, c.z0, c.z0 + w)
  wallRun(c.x0, c.x1, c.z1 - w, c.z1)
  wallRun(c.x0, c.x0 + w, c.z0 + w, c.z1 - w)
  out.push([c.x0, c.x1, top, top + J.roofT, c.z0, c.z1, 'roof'])
  // Against the fuselage either side of the door: the bellows (stops you, not bullets).
  const d = PLANE.doors.find((o) => o.id === 'L1')
  out.push([c.x1 - 0.12, c.x1, y, top, c.z0 + w, d.z0, 'bellows'])
  out.push([c.x1 - 0.12, c.x1, y, top, d.z1, c.z1 - w, 'bellows'])
  return out
}

function bridgeColliders() {
  const J = JET_BRIDGE
  const out = []
  for (const s of bridgeSlopes()) out.push(boxC(s.box.p, s.box.size, s.box.q))
  for (const [x0, x1, y0, y1, z0, z1, kind] of bridgeCabBoxes()) {
    out.push(boxC([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], IDENTITY_Q, kind === 'bellows' ? MOVE_ONLY : undefined))
  }
  // Supports.
  const [rx, rz] = J.rotunda
  const under = bridgeFloorAt(rz) - J.floorT
  out.push(cylC([rx, under / 2, rz], 0.45, under))
  const legTop = bridgeFloorAt(J.drive) - J.floorT
  for (const x of [J.x0 + 0.3, J.x1 - 0.3]) out.push(boxC([x, (0.9 + legTop) / 2, J.drive], [0.35, legTop - 0.9, 0.35]))
  out.push(boxC([(J.x0 + J.x1) / 2, 0.45, J.drive], [3.2, 0.9, 1.2]))
  return out
}
add({ type: 'jetBridge' })

/* ---------------------------------------------------------------------------
 * The escape slide (front right door) and the airstair trucks
 * ------------------------------------------------------------------------- */

export const SLIDE = Object.freeze({ top: [2.32, 3.47, -7.6], bottom: [8.4, 0.1, -7.6], width: 1.7, toe: 1.4 })

function slideColliders() {
  const s = SLIDE
  const out = []
  const r = rampBox(s.top, s.bottom, s.width, 0.3)
  out.push(boxC(r.p, r.size, r.q))
  out.push(boxC([s.bottom[0] + s.toe / 2, 0.05, s.bottom[2]], [s.toe, 0.1, s.width]))
  // The inflated side tubes keep you on it.
  for (const k of [-1, 1]) {
    const lift = (p) => [p[0], p[1] + 0.3, p[2] + k * (s.width / 2 - 0.12)]
    const t = rampBox(lift(s.top), lift(s.bottom), 0.24, 0.45)
    out.push(boxC(t.p, t.size, t.q, MOVE_ONLY))
  }
  return out
}
add({ type: 'slide' })

/**
 * Airstair trucks: `top` is the middle of the platform's edge where you step
 * off (into the jet's door, or off the end of a free one), `dir` the way the
 * stairs run down, away from it.
 */
export const AIRSTAIRS = Object.freeze([
  { id: 'rear', top: [2.32, 3.47, 18.2], dir: [1, 0], attached: true },
  { id: 'free', top: [30.4, 3.47, 20.4], dir: [0, 1], attached: false },
])
export const AIRSTAIR = Object.freeze({ platform: 1.6, run: 5.5, width: 1.6, foot: 0.3, cab: 2.8, cabTop: 2.45 })
export const airstairOf = (id) => AIRSTAIRS.find((a) => a.id === id)

/** An airstair truck's parts in world space: the platform, the stairs' ends, the cab under them, rails. */
export function airstairParts(a) {
  const A = AIRSTAIR
  const [dx, dz] = a.dir
  const sx = -dz
  const sz = dx
  const [x, y, z] = a.top
  const at = (along, side, yy) => [x + dx * along + sx * side, yy, z + dz * along + sz * side]
  const platform = { from: at(0, 0, y), to: at(A.platform, 0, y) }
  const rampTop = at(A.platform, 0, y)
  const rampFoot = at(A.platform + A.run, 0, A.foot)
  // The slope carried on down to the ground past the bottom step (a smooth lip, and bots can't step 0.3 m).
  const rampGround = at(A.platform + A.run + (A.foot * A.run) / (y - A.foot), 0, 0)
  // The cab ends where the stairs come down too low over it.
  const cab = { from: at(A.platform - 1.4, 0, 0), to: at(A.platform - 1.4 + A.cab, 0, 0) }
  const w = A.width / 2 - 0.04
  const rails = [
    [at(A.platform, -w, y), at(A.platform + A.run, -w, A.foot)],
    [at(A.platform, w, y), at(A.platform + A.run, w, A.foot)],
  ]
  // Round the platform: both sides, and the end too on a free one.
  const flat = [
    [at(0, -w, y), at(A.platform, -w, y)],
    [at(0, w, y), at(A.platform, w, y)],
  ]
  if (!a.attached) flat.push([at(0.04, -w, y), at(0.04, w, y)])
  return { platform, rampTop, rampFoot, rampGround, cab, rails, flat, dir: [dx, dz], side: [sx, sz], at }
}

function airstairColliders(a) {
  const A = AIRSTAIR
  const p = airstairParts(a)
  const out = []
  const q = yawQ(Math.atan2(-p.dir[1], p.dir[0]))
  const mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2, (u[2] + v[2]) / 2]
  // Platform: a deck on top of the truck's front end (against a jet, reaching over the gap to its
  // door sill: a bot's feet would fall through it).
  const lip = a.attached ? 0.12 : 0
  const pm = mid(p.at(-lip, 0, a.top[1]), p.platform.to)
  out.push(boxC([pm[0], a.top[1] - 0.2, pm[2]], [A.platform + lip, 0.4, A.width], q))
  // The truck's cab and body under the platform and the top of the stairs.
  const cm = mid(p.cab.from, p.cab.to)
  out.push(boxC([cm[0], A.cabTop / 2, cm[2]], [A.cab, A.cabTop, A.width + 0.5], q))
  const r = rampBox(p.rampTop, p.rampGround, A.width, 0.16)
  out.push(boxC(r.p, r.size, r.q))
  for (const [u, v] of p.rails) {
    const lift = (pt) => [pt[0], pt[1] + 0.95, pt[2]]
    const t = rampBox(lift(u), lift(v), 0.06, 0.95)
    out.push(boxC(t.p, t.size, t.q, MOVE_ONLY))
  }
  for (const [u, v] of p.flat) {
    const len = Math.hypot(v[0] - u[0], v[2] - u[2])
    const m = mid(u, v)
    out.push(boxC([m[0], u[1] + 0.5, m[2]], [len, 1.0, 0.06], yawQ(Math.atan2(-(v[2] - u[2]), v[0] - u[0])), MOVE_ONLY))
  }
  return out
}
for (const a of AIRSTAIRS) add({ type: 'airstairs', id: a.id })

/* ---------------------------------------------------------------------------
 * The apron: containers, ground vehicles, barriers, floodlight masts
 * ------------------------------------------------------------------------- */

/** Air cargo containers: the small rounded-shoulder kind and the big flat one. */
export const ULD = Object.freeze({
  ake: { w: 1.56, h: 1.63, d: 1.53 },
  pmc: { w: 3.18, h: 1.62, d: 2.44 },
})
/** [kind, x, z, rotY, level] — level 1 stands on top of whatever's under it. */
const ulds = [
  // In front of the terminal, west.
  ['pmc', -24.6, -13.2, 0.04, 0],
  ['ake', -27.9, -14.1, 0.1, 0],
  ['ake', -27.9, -14.1, 0.1, 1],
  ['ake', -27.7, -12.4, 0.02, 0],
  // West apron.
  ['pmc', -42.0, 6.0, Math.PI / 2, 0],
  ['pmc', -39.3, 6.2, Math.PI / 2 + 0.05, 0],
  ['ake', -42.0, 5.2, 0.0, 1],
  ['ake', -47.0, 14.0, 0.3, 0],
  // South-west.
  ['ake', -18.0, 40.0, 0.0, 0],
  ['ake', -16.35, 40.2, 0.05, 0],
  ['ake', -18.0, 41.7, 0.0, 0],
  ['ake', -18.0, 40.0, 0.0, 1],
  ['pmc', -21.8, 39.2, 0.2, 0],
  ['ake', -41.0, 44.0, 0.2, 0],
  ['ake', -39.3, 44.3, 0.25, 0],
  // In front of the terminal, east.
  ['ake', 22.6, -12.8, 0.0, 0],
  ['ake', 24.25, -12.6, 0.06, 0],
  ['ake', 22.6, -12.8, 0.0, 1],
  ['pmc', 19.6, -13.4, 0.1, 0],
  // Off the leg's end.
  ['pmc', 34.6, 17.6, 0.25, 0],
  ['ake', 34.0, 17.2, 0.25, 1],
  ['ake', 37.8, 16.2, 0.15, 0],
  // South.
  ['ake', 6.0, 42.0, 0.0, 0],
  ['ake', 7.66, 42.1, 0.04, 0],
  ['ake', 6.0, 42.0, 0.0, 1],
  ['pmc', 11.6, 41.4, -0.1, 0],
  ['pmc', 30.4, 40.2, 0.4, 0],
  ['ake', 33.3, 41.6, 0.4, 0],
  ['ake', 33.3, 41.6, 0.4, 1],
]
export const TM_ULDS = Object.freeze(
  ulds.map(([kind, x, z, rotY, level]) => {
    const under = level ? (kind === 'ake' && ulds.some(([k, ux, uz, , l]) => l === 0 && k === 'pmc' && Math.hypot(ux - x, uz - z) < 2) ? ULD.pmc.h : ULD.ake.h) : 0
    return { kind, p: [x, level ? under + 0.01 : 0, z], rotY }
  }),
)
for (const u of TM_ULDS) add({ type: 'uld', ...u })

/** Ground vehicles' sizes (local -z is the front). */
export const GSE = Object.freeze({
  tug: { length: 2.8, width: 1.45, height: 1.5 },
  dolly: { deck: 0.5 },
  fuel: { length: 10.0, width: 2.5, cab: 2.4, cabTop: 2.9, tankR: 1.25, tankY: 2.05 },
  catering: { length: 8.0, width: 2.5, cab: 2.2, cabTop: 2.6, boxY: 1.15, boxTop: 3.8 },
  pushback: { length: 6.2, width: 2.8, height: 1.45, cabTop: 2.35 },
  gpu: { length: 2.2, width: 1.3, height: 1.35 },
  bus: { length: 12.6, width: 2.75, height: 3.0 },
})

/** Baggage trains: a tug and its dollies, each with a container on it. */
const trains = [
  { p: [-15.0, 0, -6.4], rotY: 0, dollies: ['ake', 'ake', 'pmc'] },
  { p: [18.4, 0, 24.0], rotY: -Math.PI / 2, dollies: ['pmc', 'ake'] },
]
/** Where a train's tug and dollies stand: [{ kind: 'tug' | 'dolly', p, rotY, cargo }]. */
export function trainParts(t) {
  const out = [{ kind: 'tug', p: t.p, rotY: t.rotY }]
  let along = GSE.tug.length / 2 + 0.5
  for (const cargo of t.dollies) {
    const len = (cargo === 'pmc' ? ULD.pmc.d : ULD.ake.d) + 0.4
    along += len / 2
    // Behind the tug: local +z.
    out.push({ kind: 'dolly', p: yawOffset(t.p, 0, along, t.rotY), rotY: t.rotY, cargo })
    along += len / 2 + 0.9
  }
  return out
}
for (const t of trains) for (const part of trainParts(t)) add({ type: part.kind, ...part })

add({ type: 'fuelTruck', p: [-30.0, 0, 2.0], rotY: 0.15 })
add({ type: 'catering', p: [-13.0, 0, 22.0], rotY: 1.35 })
add({ type: 'pushback', p: [12.6, 0, -14.0], rotY: Math.PI / 2 })
add({ type: 'gpu', p: [-2.8, 0, -14.4], rotY: 0.1 })
add({ type: 'apronBus', p: [51.0, 0, 6.0], rotY: 0.04 })

/** Cars: the police car beside the leg, taxis and cars at the kerb outside the west end (one burnt out). */
const cars = [
  ['sedan', '#eef0f0', 50.0, -9.5, 0.3, 'police', false],
  ['sedan', '#e8c22a', -49.6, -46.0, 0.0, 'taxi', false],
  ['sedan', 'rust', -49.4, -39.6, 0.25, null, true],
  ['van', '#d8dcdc', -49.8, -27.0, -0.04, null, false],
]
for (const [model, color, x, z, rotY, livery, wreck] of cars) add({ type: 'car', model, color, p: [x, 0, z], rotY, livery, wreck, ...(wreck ? { smoke: [0, 1.0, -1.6] } : {}) })

/** Burnt-out cars on the apron, one still burning. */
add({ type: 'carWreck', p: [47.6, 0, 40.0], rotY: 2.2, fire: [0, 1.0, 0] })
add({ type: 'carWreck', p: [-14.0, 0, 36.6], rotY: -0.4 })

/** Jersey barriers: [x, z, rotY]. */
const barriers = [
  [-34.0, -16.8, 0.0],
  [21.0, -16.6, 0.1],
  [-6.0, 33.8, 0.15],
  [16.4, 32.2, -0.2],
  [-47.0, 30.0, 1.5],
  [48.0, 34.0, 1.4],
  [-30.0, 48.0, 0.1],
  [40.0, 46.0, -0.3],
]
for (const [x, z, rotY] of barriers) add({ type: 'barrier', p: [x, 0, z], rotY, length: 3 })

/** Floodlight masts. */
export const MASTS = Object.freeze([
  [-48.0, 22.0],
  [48.0, 26.0],
  [-22.0, 50.4],
  [22.0, 50.4],
])
export const MAST = Object.freeze({ h: 20.0, r: 0.28 })
for (const [x, z] of MASTS) add({ type: 'mast', p: [x, 0, z] })

/** Traffic cones (drawn only): [x, z]. */
export const CONES = Object.freeze([
  [-3.4, -17.2], [3.4, -17.2], [-1.2, 30.4], [1.2, 30.4], [10.8, -8.8], [10.8, -6.4],
  [-9.8, 10.0], [9.8, 10.0], [-12.6, -3.8], [12.6, 18.2], [26.6, 22.6],
])
add({ type: 'cones' })

/* ---------------------------------------------------------------------------
 * The crashed jet
 *
 * A narrow-body came down on the south-west of the apron and broke in three:
 * the nose, the middle with the left wing's stub, the tail with its fin. Each
 * section lies on its belly, sunk into the concrete; its local frame is the
 * jet's (nose towards local -z, its left wing local -x). Walk in at a broken
 * end: the floor is a step up. The right wing lies where it was torn off,
 * and both engines, burning.
 * ------------------------------------------------------------------------- */

export const WRECK = Object.freeze({ R: 1.95, yc: 1.35, floor: 0.32, shell: 0.14, segments: 12 })
/**
 * Sections: where they lie, their length along local z (`z0`..`z1`), the
 * constant tube between `body0` and `body1` (the nose cone before it, the
 * tail cone after), which ends are torn open, burnt seats inside
 * ([x0, x1, z0, z1, h] above the floor), and what's burning.
 */
export const WRECK_SECTIONS = Object.freeze([
  {
    id: 'nose',
    p: [-30.5, 0, 18.5],
    rotY: -0.5,
    z0: -9.0,
    z1: 3.0,
    body0: -4.5,
    body1: 3.0,
    open: [false, true],
    seats: [[-1.45, -0.55, -2.6, -1.9, 1.0], [0.55, 1.45, -1.2, -0.5, 1.0]],
    fire: [0.3, 1.2, 3.6, 1.3],
  },
  {
    id: 'mid',
    p: [-37.0, 0, 27.0],
    rotY: -0.62,
    z0: -6.0,
    z1: 6.0,
    body0: -6.0,
    body1: 6.0,
    open: [true, true],
    wing: { root: 1.9, tip: 9.5, le: [-1.2, 2.2], te: [3.6, 4.4] },
    seats: [[-1.45, -0.55, -3.4, -2.7, 1.0], [0.55, 1.45, -2.2, -1.5, 1.0], [-1.45, -0.55, 2.4, 3.1, 1.0], [0.55, 1.45, 3.6, 4.3, 1.0]],
    fire: [-3.0, 0.6, 1.0, 1.6],
  },
  {
    id: 'tail',
    p: [-44.0, 0, 37.0],
    rotY: -0.95,
    z0: -4.0,
    z1: 8.0,
    body0: -4.0,
    body1: 2.0,
    open: [true, false],
    fin: { root: [3.2, 7.4], tipZ: [6.6, 8.8], y0: 2.6, y1: 8.6, thick: 0.4 },
    seats: [[0.55, 1.45, -1.6, -0.9, 1.0]],
    smoke: [0, 2.6, -3.2],
  },
])
export const wreckSection = (id) => WRECK_SECTIONS.find((s) => s.id === id)

/** Centre height and radius of a section's skin at local z (the nose cone, the tube, the tail cone sweeping up). */
export function wreckAt(s, z) {
  const W = WRECK
  if (z < s.body0) {
    const t = Math.max(0, Math.min(1, (z - s.z0) / (s.body0 - s.z0)))
    return { yc: W.yc - 0.35 * (1 - t) ** 2, r: Math.max(0.05, W.R * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2))) }
  }
  if (z > s.body1) {
    const t = Math.min(1, (z - s.body1) / (s.z1 - s.body1))
    return { yc: W.yc + 1.1 * t ** 1.5, r: W.R * (1 - 0.82 * t ** 1.2) }
  }
  return { yc: W.yc, r: W.R }
}

/** The torn-off right wing, lying tilted (its leading edge propped on its own wreckage), and the engines. */
export const WRECK_WING = Object.freeze({ p: [-25.6, 0, 33.2], rotY: 0.35, span: 10.5, chord: [4.2, 2.2], lift: 1.35, thick: 0.4, fire: [-4.2, 0.9, 0.4, 1.5] })
export const WRECK_ENGINES = Object.freeze([
  { p: [-21.6, 0, 27.4], rotY: 1.1, r: 1.0, length: 3.6, fire: [0, 1.1, 0.4, 1.1] },
  { p: [-45.4, 0, 24.6], rotY: -0.3, r: 1.0, length: 3.6, smoke: [0, 1.0, 0] },
])
/** The scar it ploughed across the apron: [x, z] from where it touched down to where the nose stopped. */
export const WRECK_SCAR = Object.freeze([
  [-53.0, 47.0],
  [-46.0, 39.0],
  [-38.0, 28.5],
  [-31.0, 19.5],
  [-27.0, 12.5],
])

for (const s of WRECK_SECTIONS) add({ type: 'wreckSection', id: s.id, p: s.p, rotY: s.rotY, ...(s.fire ? { fire: s.fire } : {}), ...(s.smoke ? { smoke: s.smoke } : {}) })
add({ type: 'wreckWing', p: WRECK_WING.p, rotY: WRECK_WING.rotY, fire: WRECK_WING.fire })
WRECK_ENGINES.forEach((e, i) => add({ type: 'wreckEngine', index: i, p: e.p, rotY: e.rotY, ...(e.fire ? { fire: e.fire } : {}), ...(e.smoke ? { smoke: e.smoke } : {}) }))
add({ type: 'wreckDebris' })

/** Smoke out of the holes in the roofs (drawn by the effects alone). */
add({ type: 'smoulder', p: [33.5, 8.6, 1.0], rotY: 0, smoke: [0, 0, 0] })
add({ type: 'smoulder', p: [-37.8, 8.6, -48.8], rotY: 0, smoke: [0, 0, 0] })

/** The left wing's stub on the middle section: [x0, x1] out from the centreline (negative), le and te at each. */
function wingStub(s) {
  const w = s.wing
  const at = (d) => {
    const f = (d - w.root) / (w.tip - w.root)
    return { le: w.le[0] + (w.le[1] - w.le[0]) * f, te: w.te[0] + (w.te[1] - w.te[0]) * f }
  }
  return { at }
}

function wreckSectionColliders(e) {
  const s = wreckSection(e.id)
  const W = WRECK
  const yaw = yawQ(s.rotY)
  const out = []
  const local = (x, y, z) => {
    const o = yawOffset(s.p, x, z, s.rotY)
    return [o[0], y, o[2]]
  }
  // The tube's skin: flat segments round it, those above the ground, open at the torn ends.
  const step = (Math.PI * 2) / W.segments
  const width = 2 * W.R * Math.tan(step / 2) + 0.02
  const r = W.R - W.shell / 2
  for (let k = 0; k < W.segments; k++) {
    const a = (k + 0.5) * step
    const cy = W.yc + Math.sin(a) * r
    if (cy < -0.2) continue
    const q = quatMultiply(yaw, quatFromEuler(0, 0, a - Math.PI / 2))
    out.push(boxC(local(Math.cos(a) * r, cy, (s.body0 + s.body1) / 2), [width, W.shell, s.body1 - s.body0], q))
  }
  // The floor, and the burnt seats on it.
  out.push(boxC(local(0, W.floor / 2, (s.body0 + s.body1) / 2), [3.3, W.floor, s.body1 - s.body0 - 0.04], yaw))
  for (const [x0, x1, z0, z1, h] of s.seats) out.push(boxC(local((x0 + x1) / 2, W.floor + h / 2, (z0 + z1) / 2), [x1 - x0, h, z1 - z0], yaw))
  // Nose and tail cones: solid, stacked short cylinders (the first closes the cabin).
  const along = quatMultiply(yaw, quatFromEuler(Math.PI / 2, 0, 0))
  const cone = (z0, z1) => {
    const m = wreckAt(s, (z0 + z1) / 2)
    out.push(cylC(local(0, m.yc, (z0 + z1) / 2), m.r, Math.abs(z1 - z0), along))
  }
  if (s.body0 > s.z0 + 0.1) {
    const cuts = [s.body0, s.body0 - 1.4, s.body0 - 2.6, s.body0 - 3.5, s.z0 + 0.2]
    for (let i = 0; i < cuts.length - 1; i++) cone(cuts[i + 1], cuts[i])
  }
  if (s.body1 < s.z1 - 0.1) {
    const cuts = [s.body1, s.body1 + 1.6, s.body1 + 3.0, s.body1 + 4.2, s.z1 - 0.3]
    for (let i = 0; i < cuts.length - 1; i++) cone(cuts[i], cuts[i + 1])
  }
  // The wing's stub: a slab on the ground, out from the left side.
  if (s.wing) {
    const st = wingStub(s)
    for (let d = s.wing.root; d < s.wing.tip - 1e-6; d += 2) {
      const m = st.at(Math.min(s.wing.tip, d + 1))
      out.push(boxC(local(-(d + 1), 0.2, (m.le + m.te) / 2), [2.0, 0.4, m.te - m.le], yaw))
    }
  }
  // The fin: up from the tail cone in three swept layers.
  if (s.fin) {
    const f = s.fin
    for (let i = 0; i < 3; i++) {
      const t = (i + 0.5) / 3
      const z0 = f.root[0] + (f.tipZ[0] - f.root[0]) * t
      const z1 = f.root[1] + (f.tipZ[1] - f.root[1]) * t
      const h = (f.y1 - f.y0) / 3
      out.push(boxC(local(0, f.y0 + h * (i + 0.5), (z0 + z1) / 2), [f.thick, h, z1 - z0], yaw))
    }
  }
  return out
}

/** The torn wing as a tilted slab: its top face from the propped leading edge down to the trailing edge on the ground. */
export function wreckWingSlab() {
  const w = WRECK_WING
  const chord = (w.chord[0] + w.chord[1]) / 2
  const top = yawOffset(w.p, 0, -chord / 2, w.rotY)
  const bottom = yawOffset(w.p, 0, chord / 2, w.rotY)
  return rampBox([top[0], w.lift, top[2]], [bottom[0], 0.06, bottom[2]], w.span, w.thick)
}

function wreckEngineColliders(e) {
  const g = WRECK_ENGINES[e.index]
  const q = quatMultiply(yawQ(g.rotY), quatFromEuler(Math.PI / 2, 0, 0))
  return [cylC([g.p[0], g.r - 0.15, g.p[2]], g.r, g.length, q)]
}

export const TERMINAL_AMMO = Object.freeze([
  { p: [-12.0, 0, -54.9], radius: 1.7, cooldown: 20, rotY: 0 },
  { p: [33.0, 0, 48.6], radius: 1.7, cooldown: 20, rotY: 0.3 },
])
for (const a of TERMINAL_AMMO) add({ type: 'ammoCrate', p: a.p, size: [1.0, 0.6, 0.6], rotY: a.rotY })

/* ---------------------------------------------------------------------------
 * Ground, paint, the fence round the apron, and what's beyond it
 * ------------------------------------------------------------------------- */

add({ type: 'tmGround' })
add({ type: 'markings' })
add({ type: 'tmPerimeter' })
add({ type: 'tmBackdrop' })

export const TERMINAL_LADDERS = Object.freeze([])
export const terminalLadderAt = (x, y, z) => ladderIn(TERMINAL_LADDERS, x, y, z)

export const TERMINAL_ENTITIES = Object.freeze(entities)

/* ---------------------------------------------------------------------------
 * Collider generation
 * ------------------------------------------------------------------------- */

/** A wall rectangle [a0, a1, y0, y1] along a run as a box, `t` thick. */
function runBox(run, [a0, a1, y0, y1], t, group) {
  const mid = (a0 + a1) / 2
  const p = run.axis === 'x' ? [mid, (y0 + y1) / 2, run.at] : [run.at, (y0 + y1) / 2, mid]
  const size = run.axis === 'x' ? [a1 - a0, y1 - y0, t] : [t, y1 - y0, a1 - a0]
  return boxC(p, size, IDENTITY_Q, group)
}

const holes = (openings) => openings.map((o) => [o.from, o.to, o.bottom, o.top])

/** Solid parts of a wall run: its rectangle minus its openings ([a0, a1, y0, y1]). */
export function wallSolids(w) {
  return rectMinus([w.from, w.to, w.y0, w.y1], holes(w.openings))
}

/** A glass run's panes (between its doors) and its solid header, as rectangles. */
export function glassRunParts(g) {
  return {
    panes: rectMinus([g.from, g.to, g.y0, g.glassTop], holes(g.openings)),
    header: g.y1 > g.glassTop + 1e-3 ? [[g.from, g.to, g.glassTop, g.y1]] : [],
  }
}

/**
 * A glass front's parts: solid bands and the shutter's panel, the panes, and
 * the shot-out gaps ([a0, a1, y0, y1] along it).
 */
export function facadeParts(F = FACADE) {
  const solid = F.bands.map(([y0, y1]) => [F.from, F.to, y0, y1])
  if (F.shutter) solid.push(F.shutter)
  const broken = F.broken ?? []
  const boards = F.boarded ?? []
  const ground = rectMinus([F.from, F.to, 0, F.bands[0][0]], [...holes(F.ground), ...(F.shutter ? [F.shutter] : []), ...broken, ...boards])
  const upper = rectMinus([F.from, F.to, F.bands[0][1], F.bands[1][0]], [...holes(F.upper), ...broken, ...boards])
  return { solid, panes: [...ground, ...upper], broken, boards }
}
/** Boards nailed up inside a front (or a window): this far in from its line, this thick. */
export const BOARDS = Object.freeze({ inset: 0.15, t: 0.06 })
/** A front's doorways: its doors, and the gaps shot out down to the floor. */
const frontDoors = (F) => [...F.ground, ...F.upper, ...(F.broken ?? []).filter((b) => b[2] < 0.1 || Math.abs(b[2] - TB.l1) < 0.1).map(([from, to, bottom, top]) => door(from, to, bottom, top))]

/** Stairs and escalators: the walking ramp, what's under it, the balustrades. */
export function flightParts(fl) {
  const rise = fl.top[1] - fl.bottom[1]
  const dx = fl.top[0] - fl.bottom[0]
  const dz = fl.top[2] - fl.bottom[2]
  const run = Math.hypot(dx, dz)
  const ux = dx / run
  const uz = dz / run
  const alongX = Math.abs(ux) > 0.5
  const escalator = fl.kind === 'escalator'
  const ramp = rampBox(fl.top, fl.bottom, fl.width, escalator ? 0.6 : 0.14)
  const fill = []
  if (!escalator) {
    const n = 6
    for (let k = 0; k < n; k++) {
      const a = k / n
      const top = fl.bottom[1] + rise * a - 0.2
      if (top < 0.2) continue
      const len = run * (1 - a)
      const c = a + (1 - a) / 2
      const mid = [fl.bottom[0] + ux * run * c, fl.bottom[2] + uz * run * c]
      fill.push({ p: [mid[0], top / 2, mid[1]], size: alongX ? [len - 0.02, top, fl.width - 0.04] : [fl.width - 0.04, top, len - 0.02] })
    }
  }
  // Balustrades: one per named side, and between an escalator's lanes.
  const offsets = []
  const sideOf = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] }
  for (const s of fl.rails ?? []) {
    const v = sideOf[s]
    offsets.push((v[0] * -uz + v[1] * ux) * (fl.width / 2 - 0.05))
  }
  if (escalator && fl.lanes > 1) offsets.push(0)
  const rails = offsets.map((off) => {
    // `off` is along the flight's right-hand side (-uz, ux).
    const lift = (p) => [p[0] - uz * off, p[1] + 0.5, p[2] + ux * off]
    return { off, box: rampBox(lift(fl.top), lift(fl.bottom), escalator ? 0.12 : 0.06, 1.0) }
  })
  return { ramp, fill, rails, rise, run, ux, uz, escalator }
}

/** Straight balustrade or rail, `h` high, along [ax, az] -> [bx, bz] from floor `y0`. */
const lineBox = (a, b, h, thick, y0 = 0, group) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0])
  return boxC([(a[0] + b[0]) / 2, y0 + h / 2, (a[1] + b[1]) / 2], [len, h, thick], yawQ(yaw), group)
}

function terminalColliders() {
  const out = []
  // (The glass itself is TERMINAL_GLASS: it breaks, so it isn't in this fixed list.)
  for (const w of TM_WALLS) for (const r of wallSolids(w)) out.push(runBox(w, r, w.t))
  for (const g of TM_GLASS_RUNS) for (const r of glassRunParts(g).header) out.push(runBox(g, r, TB.inner))
  for (const F of TM_FRONTS) {
    const parts = facadeParts(F)
    for (const r of parts.solid) out.push(runBox(F, r, TB.wall))
    for (const r of parts.boards) out.push(runBox({ axis: F.axis, at: F.at - F.out * BOARDS.inset }, r, BOARDS.t))
  }
  for (const w of TM_WALLS) for (const o of w.openings) if (o.kind === 'boarded') out.push(runBox(w, [o.from, o.to, o.bottom, o.top], w.t))
  for (const s of TM_SLABS) for (const [x0, x1, z0, z1] of s.rects) out.push(boxC([(x0 + x1) / 2, s.y - TB.slab / 2, (z0 + z1) / 2], [x1 - x0, TB.slab, z1 - z0]))
  const c = COLLAPSE
  const fallen = rampBox(c.top, c.bottom, c.width, c.thick)
  out.push(boxC(fallen.p, fallen.size, fallen.q))
  for (const [x0, x1, z0, z1] of TM_SKYLIGHTS) out.push(boxC([(x0 + x1) / 2, TB.roof - 0.05, (z0 + z1) / 2], [x1 - x0, 0.06, z1 - z0], IDENTITY_Q, MOVE_ONLY))
  for (const [x, z, s] of TM_COLUMNS) out.push(boxC([x, UNDER2 / 2, z], [s, UNDER2, s]))
  for (const fl of TM_FLIGHTS) {
    const p = flightParts(fl)
    out.push(boxC(p.ramp.p, p.ramp.size, p.ramp.q))
    for (const b of p.fill) out.push(boxC(b.p, b.size))
    for (const r of p.rails) out.push(boxC(r.box.p, r.box.size, r.box.q, MOVE_ONLY))
  }
  for (const L of TM_LANDINGS) {
    out.push(boxC([(L.x0 + L.x1) / 2, L.y / 2, (L.z0 + L.z1) / 2], [L.x1 - L.x0, L.y, L.z1 - L.z0]))
    for (const [ax, az, bx, bz] of L.rails) out.push(lineBox([ax, az], [bx, bz], 1.05, 0.06, L.y, MOVE_ONLY))
  }
  for (const [ax, az, bx, bz, y] of TM_RAILS) out.push(lineBox([ax, az], [bx, bz], 1.05, 0.06, y, MOVE_ONLY))
  for (const fu of TM_FURNITURE) out.push(groundBox(fu.p, fu.size, fu.rotY))
  // The metal detectors' posts.
  for (const z of TM_ARCHES) for (const s of [-1, 1]) out.push(boxC([-17.0, 1.1, z + s * 0.68], [0.5, 2.2, 0.15]))
  return out
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
  terminal: terminalColliders,
  plane: () => [...shellColliders(), ...airframeColliders(), ...cabinColliders()],
  jetBridge: bridgeColliders,
  slide: slideColliders,
  airstairs: (e) => airstairColliders(airstairOf(e.id)),
  uld: (e) => [groundBox(e.p, [ULD[e.kind].w, ULD[e.kind].h, ULD[e.kind].d], e.rotY)],
  tug: (e) => localBoxes(e, [[0, 0, 0, GSE.tug.width, GSE.tug.height, GSE.tug.length]]),
  dolly: (e) => {
    const c = ULD[e.cargo]
    const deck = GSE.dolly.deck
    return localBoxes(e, [[0, 0, 0, c.w + 0.3, deck, c.d + 0.4], [0, deck, 0, c.w, c.h, c.d]])
  },
  fuelTruck: (e) => {
    const g = GSE.fuel
    const half = g.length / 2
    const q = quatMultiply(yawQ(e.rotY), quatFromEuler(Math.PI / 2, 0, 0))
    const tankLen = g.length - g.cab - 0.3
    const mid = yawOffset(e.p, 0, -half + g.cab + 0.3 + tankLen / 2, e.rotY)
    return [
      ...localBoxes(e, [
        [0, 0, -half + g.cab / 2, g.width, g.cabTop, g.cab],
        [0, 0.3, g.cab / 2, g.width - 0.2, 0.8, g.length - g.cab],
      ]),
      cylC([mid[0], g.tankY, mid[2]], g.tankR, tankLen, q),
    ]
  },
  catering: (e) => {
    const g = GSE.catering
    const half = g.length / 2
    return localBoxes(e, [
      [0, 0, -half + g.cab / 2, g.width, g.cabTop, g.cab],
      [0, 0.3, g.cab / 2, g.width - 0.2, g.boxY - 0.3, g.length - g.cab],
      [0, g.boxY, g.cab / 2 + 0.2, g.width, g.boxTop - g.boxY, g.length - g.cab - 0.4],
    ])
  },
  pushback: (e) => {
    const g = GSE.pushback
    return localBoxes(e, [
      [0, 0, 0, g.width, g.height, g.length],
      [0, g.height, -g.length / 2 + 0.9, 1.4, g.cabTop - g.height, 1.4],
    ])
  },
  gpu: (e) => localBoxes(e, [[0, 0, 0, GSE.gpu.width, GSE.gpu.height, GSE.gpu.length]]),
  apronBus: (e) => localBoxes(e, [[0, 0.2, 0, GSE.bus.width, GSE.bus.height - 0.2, GSE.bus.length]]),
  car: carColliders,
  carWreck: (e) => [groundBox(e.p, [1.8, 1.45, 4.3], e.rotY)],
  wreckSection: wreckSectionColliders,
  wreckWing: () => {
    const b = wreckWingSlab()
    return [boxC(b.p, b.size, b.q)]
  },
  wreckEngine: wreckEngineColliders,
  barrier: (e) => [groundBox(e.p, [e.length, 1.0, 0.62], e.rotY)],
  mast: (e) => [cylC([e.p[0], MAST.h / 2, e.p[2]], MAST.r, MAST.h)],
  ammoCrate: (e) => [groundBox(e.p, e.size, e.rotY)],
  tmPerimeter: () => [...boundaryColliders(TERMINAL_HALF, TERMINAL_HALF), boxC([0, -1, 0], [240, 2, 240])],
}

let colliderCache = null

/** Flat, cached list of every collider in the map. Identical on client and server. */
export function buildTerminalColliders() {
  if (colliderCache) return colliderCache
  const out = []
  for (const e of TERMINAL_ENTITIES) {
    const build = COLLIDER_BUILDERS[e.type]
    if (build) out.push(...build(e))
  }
  colliderCache = Object.freeze(out)
  return colliderCache
}

/* ---------------------------------------------------------------------------
 * Breakable glass (see shared/glass.js): every pane on the map, the one
 * between each pair of mullions or glazing bars (split at the transoms), so
 * each breaks on its own. The renderers draw the frames; the panes are drawn
 * and collided with by the glass system, on both sides.
 * ------------------------------------------------------------------------- */

/** A run's rectangle [a0, a1, y0, y1] as panes: `pitch` apart along it, split at the heights in `cuts`. */
function runPanes(run, [a0, a1, y0, y1], pitch, cuts = []) {
  const out = []
  const n = Math.max(1, Math.round((a1 - a0) / pitch))
  const ys = [y0, ...cuts.filter((c) => c > y0 + 0.1 && c < y1 - 0.1), y1]
  for (let i = 0; i < n; i++) {
    const b0 = a0 + ((a1 - a0) * i) / n
    const b1 = a0 + ((a1 - a0) * (i + 1)) / n
    for (let k = 0; k < ys.length - 1; k++) {
      const b = runBox(run, [b0, b1, ys[k], ys[k + 1]], TB.glass)
      out.push(glassPane(b.p, [b.half[0] * 2, b.half[1] * 2, b.half[2] * 2]))
    }
  }
  return out
}

function buildGlass() {
  const out = []
  // The fronts (a pane between each pair of mullions, the same spacing the renderer draws them at).
  for (const F of TM_FRONTS) for (const r of facadeParts(F).panes) out.push(...runPanes(F, r, 1.5, TRANSOM))
  // Windows in the walls; the shopfronts, the security line and the VIP lounge's glass.
  for (const w of TM_WALLS) for (const o of w.openings) if (o.kind === 'glass') out.push(...runPanes(w, [o.from, o.to, o.bottom, o.top], 1.4))
  for (const g of TM_GLASS_RUNS) for (const r of glassRunParts(g).panes) out.push(...runPanes(g, r, 1.2))
  // The jet bridge's two little windows.
  for (const b of bridgeWindows()) out.push(glassPane(b.p, b.size, b.q))
  return out
}
export const TERMINAL_GLASS = Object.freeze(buildGlass())

/* ---------------------------------------------------------------------------
 * Spawns
 * ------------------------------------------------------------------------- */

const spawn = (x, z, faceX = 0, faceZ = 0, y = 0) => ({ p: [x, y, z], yaw: Math.atan2(-(faceX - x), -(faceZ - z)) })

export const TERMINAL_SPAWNS = Object.freeze({
  // TDM: Alpha in the terminal's check-in hall (west end), Bravo across the
  // apron at its south edge, behind the container stacks.
  [TEAMS.ALPHA]: [spawn(-42.2, -38.0, -17, -32), spawn(-42.2, -31.0, -17, -30), spawn(-38.0, -43.2, -17, -34), spawn(-31.0, -43.2, -17, -36), spawn(-31.0, -35.6, -17, -30), spawn(-38.6, -35.6, -17, -30)],
  [TEAMS.BRAVO]: [spawn(-14.0, 52.6, -10, 0), spawn(-6.0, 52.6, -4, 0), spawn(2.0, 52.6, 2, 0), spawn(10.0, 52.6, 6, 0), spawn(18.0, 52.6, 12, 0), spawn(26.0, 52.6, 16, 0)],
  ffa: [
    spawn(-42.2, -40.0, -20, -32),
    spawn(41.6, -50.6, 20, -40),
    spawn(0.0, -42.6, 0, -30),
    spawn(-50.0, -32.0, -50, 0),
    spawn(50.0, -26.0, 50, 0),
    spawn(41.0, -5.0, 30, -5),
    spawn(41.6, -17.0, 30, -10, TB.l1),
    spawn(-51.0, 12.0, -20, 10),
    spawn(51.0, 22.0, 20, 20),
    spawn(-26.0, 45.0, 0, 20),
    spawn(24.0, 46.0, 0, 20),
    spawn(0.0, 51.0, 0, 20),
    spawn(-19.0, -15.0, 0, 0),
    spawn(20.0, -8.0, 0, 0),
    spawn(21.0, -37.0, 0, -36),
  ],
})

/* ---------------------------------------------------------------------------
 * Bot navigation: the ground grid, every doorway, every flight up from the
 * ground; and over everything raised (the upper floor, the jet bridge, the
 * cabin, the wings, the airstair platforms) a grid of nodes that link
 * wherever a bot can walk between them.
 * ------------------------------------------------------------------------- */

const conj = (q) => [-q[0], -q[1], -q[2], q[3]]
function rotateBy(v, q) {
  const [x, y, z] = v
  const [qx, qy, qz, qw] = q
  const ix = qw * x + qy * z - qz * y
  const iy = qw * y + qz * x - qx * z
  const iz = qw * z + qx * y - qy * x
  const iw = -qx * x - qy * y - qz * z
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx]
}

/** Distance from a point to a collider (a cylinder taken as its box). */
function distanceTo(c, p) {
  const local = rotateBy([p[0] - c.p[0], p[1] - c.p[1], p[2] - c.p[2]], conj(c.q))
  const half = c.shape === 'box' ? c.half : [c.r, c.halfHeight, c.r]
  const dx = Math.max(0, Math.abs(local[0]) - half[0])
  const dy = Math.max(0, Math.abs(local[1]) - half[1])
  const dz = Math.max(0, Math.abs(local[2]) - half[2])
  return Math.hypot(dx, dy, dz)
}

/** Room for a standing bot with its feet at (x, y, z)? (Like the server's check, from the collider list.) */
function roomAt(x, y, z) {
  for (const c of buildTerminalColliders()) {
    if (c.shape === 'mesh' || (c.half && (c.half[0] > 60 || c.half[2] > 60))) continue
    for (const h of [0.55, 1.4]) if (distanceTo(c, [x, y + h, z]) < 0.42) return false
  }
  return true
}

/** Either side of a doorway in a wall run: [[x, y, z], [x, y, z]]. */
function besideDoor(run, o, k = 0.9) {
  const mid = (o.from + o.to) / 2
  const y = o.bottom
  return run.axis === 'x'
    ? [
        [mid, y, run.at - k],
        [mid, y, run.at + k],
      ]
    : [
        [run.at - k, y, mid],
        [run.at + k, y, mid],
      ]
}

function doorNodes() {
  const ground = []
  const upper = []
  const runs = [...TM_WALLS.map((w) => [w, w.openings.filter(isWalkable)]), ...TM_GLASS_RUNS.map((g) => [g, g.openings]), ...TM_FRONTS.map((F) => [F, frontDoors(F)])]
  for (const [run, doors] of runs) {
    for (const o of doors) {
      const pts = besideDoor(run, o, o.bottom > 0.1 ? 0.75 : 0.9)
      if (o.bottom > 0.1) upper.push(...pts)
      else ground.push(...pts)
    }
  }
  return { ground, upper }
}

/** Nodes up a flight: off its foot, up it, and out onto what it arrives at. */
function flightChain(fl, before = 1.0, after = 1.0) {
  const p = flightParts(fl)
  const at = (f, y) => [+(fl.bottom[0] + p.ux * p.run * f).toFixed(2), +y.toFixed(2), +(fl.bottom[2] + p.uz * p.run * f).toFixed(2)]
  const y0 = fl.bottom[1]
  return [at(-before / p.run, y0), at(0.15, y0 + p.rise * 0.15), at(0.5, y0 + p.rise * 0.5), at(0.85, y0 + p.rise * 0.85), at(1 + after / p.run, fl.top[1])]
}

/** From `start` on the ground, up a slope from `low` to `high` (points on its surface), then on to `beyond`. */
function slopeChain(start, low, high, beyond = []) {
  const at = (f) => [+(low[0] + (high[0] - low[0]) * f).toFixed(2), +(low[1] + (high[1] - low[1]) * f).toFixed(2), +(low[2] + (high[2] - low[2]) * f).toFixed(2)]
  return [start, at(0.15), at(0.5), at(0.85), ...beyond]
}

function upperNodes(extraUpper) {
  const out = []
  const keep = (x, y, z) => {
    if (roomAt(x, y, z)) out.push([+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)])
  }
  // The upper floor: a grid over each rectangle of the slab.
  const step = 2.2
  const m = 0.6
  for (const [x0, x1, z0, z1] of TM_SLABS[0].rects) {
    if (x1 - x0 < m * 2 || z1 - z0 < m * 2) continue
    const nx = Math.max(1, Math.round((x1 - x0 - m * 2) / step) + 1)
    const nz = Math.max(1, Math.round((z1 - z0 - m * 2) / step) + 1)
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < nz; k++) {
        const x = nx === 1 ? (x0 + x1) / 2 : x0 + m + ((x1 - x0 - m * 2) * i) / (nx - 1)
        const z = nz === 1 ? (z0 + z1) / 2 : z0 + m + ((z1 - z0 - m * 2) * k) / (nz - 1)
        keep(x, TB.l1, z)
      }
    }
  }
  // The jet bridge, down its middle to the cab and the door.
  const J = JET_BRIDGE
  const bx = (J.x0 + J.x1) / 2
  for (let z = J.z0 + 0.6; z < J.z1 - 0.1; z += 1.7) keep(bx, bridgeFloorAt(z), z)
  keep(bx, PLANE.floor, -8.6)
  keep(-4.6, PLANE.floor, -7.6)
  keep(-3.0, PLANE.floor, -7.6)
  // The cabin: down the aisle, and in by every door.
  for (let z = PLANE.bulkF + 0.8; z < PLANE.bulkR - 0.6; z += 1.6) keep(PLANE.x, PLANE.floor, z)
  for (const d of PLANE.doors) keep(PLANE.x + d.side * 1.3, PLANE.floor, (d.z0 + d.z1) / 2)
  // Out along the wings from the over-wing exits.
  for (const s of [-1, 1]) {
    for (const d of [3.4, 5.8, 8.8, 11.8, 14.8, 17.6]) {
      const w = wingAt(d)
      const z = d < 4 ? 4.9 : (w.le + w.te) / 2
      keep(PLANE.x + s * d, w.top, z)
    }
  }
  for (const p of extraUpper) keep(p[0], p[1], p[2])
  return out
}

/** A point in a wreck section's own frame (on its floor unless `y` is given), in world space. */
function wreckPoint(id, lx, lz, y = WRECK.floor) {
  const s = wreckSection(id)
  const o = yawOffset(s.p, lx, lz, s.rotY)
  return [+o[0].toFixed(2), y, +o[2].toFixed(2)]
}

let navUpper = null
const doors = doorNodes()
const rear = airstairParts(airstairOf('rear'))
const free = airstairParts(airstairOf('free'))
const A = AIRSTAIR

export const TERMINAL_NAV = Object.freeze({
  grid: { spacing: 2.5, half: TERMINAL_HALF - 1.2 },
  root: [0, 40],
  linkUpper: true,
  extra: Object.freeze([
    ...doors.ground,
    // Round the jet's gear and between the engines and the fuselage.
    [-5.0, 0, -12.0],
    [5.0, 0, -12.0],
    [0.0, 0, 6.0],
    [-5.6, 0, 10.0],
    [5.6, 0, 10.0],
  ]),
  chains: Object.freeze([
    flightChain(tmFlight('westStair')),
    flightChain(tmFlight('eastStair')),
    // (Up the east lane: the balustrade runs down the middle.)
    flightChain(tmFlight('escalators')).map(([x, y, z]) => [x + 0.6, y, z]),
    flightChain(tmFlight('grandStair')),
    [...flightChain(tmFlight('outsideStair'), 1.0, 0.6), [45.0, TB.l1, -48.0], [42.9, TB.l1, -48.0]],
    // Through the crashed jet: in at the middle section's back, along it, across the gap into the
    // nose; and into the tail at its break.
    [wreckPoint('mid', 0, 7.4, 0), wreckPoint('mid', 0, 5.0), wreckPoint('mid', 0, 1.0), wreckPoint('mid', 0, -3.0), wreckPoint('mid', 0, -5.6)],
    [wreckPoint('nose', -0.45, 3.8, 0), wreckPoint('nose', 0, 2.4), wreckPoint('nose', 0, -0.4), wreckPoint('nose', 0, -3.4)],
    [wreckPoint('tail', 0, -5.6, 0), wreckPoint('tail', 0, -3.0), wreckPoint('tail', 0, 0.6)],
    // Up the leg's fallen slab, from the ground floor to the upper floor.
    slopeChain([COLLAPSE.bottom[0], 0, COLLAPSE.bottom[2] + 1.6], COLLAPSE.bottom, COLLAPSE.top, [[COLLAPSE.top[0], TB.l1, COLLAPSE.top[2] - 1.2]]),
    // The escape slide: from its toe up into the cabin.
    slopeChain([SLIDE.bottom[0] + SLIDE.toe + 0.6, 0, SLIDE.bottom[2]], SLIDE.bottom, SLIDE.top, [[1.3, PLANE.floor, SLIDE.top[2]]]),
    // The airstair trucks: up the stairs onto the platform (and into the jet at the back door).
    slopeChain(rear.at(A.platform + A.run + 1.0, 0, 0), rear.rampFoot, rear.rampTop, [rear.at(0.8, 0, rear.rampTop[1]), [1.3, PLANE.floor, rear.rampTop[2]]]),
    slopeChain(free.at(A.platform + A.run + 1.0, 0, 0), free.rampFoot, free.rampTop, [free.at(0.8, 0, free.rampTop[1])]),
  ]),
  get upper() {
    navUpper ??= Object.freeze(upperNodes(doors.upper))
    return navUpper
  },
})
