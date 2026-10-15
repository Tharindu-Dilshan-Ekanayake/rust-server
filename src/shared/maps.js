/**
 * Every map in the game, by id (`short` is its name where room is tight). A map is the data both sides need to play on it:
 * its colliders, ladders, spawns, resupply crates, the bot navigation hints, its
 * bounds and its Search & Destroy layout (`snd`: which team spawns attack, and
 * bomb sites A and B). The client also draws its `entities` (see world/MapScene.jsx).
 */
import * as dustline from './map.js'
import * as acres from './mapAcres.js'
import * as bramble from './mapBramble.js'
import * as hollow from './mapHollow.js'
import * as palmwood from './mapPalmwood.js'
import * as quarter from './mapQuarter.js'
import * as pinecrest from './mapPinecrest.js'
import * as terminal from './mapTerminal.js'

export const MAPS = Object.freeze({
  dustline: Object.freeze({
    id: 'dustline',
    name: dustline.MAP_NAME,
    short: 'Dustline',
    tagline: 'Desert pumpstation in a sandstorm',
    blurb: 'Abandoned desert pumping station in a sandstorm. Refinery decks, a derrick and container stacks.',
    size: '60 × 60 m',
    half: dustline.MAP_HALF,
    entities: dustline.ENTITIES,
    colliders: dustline.buildColliders,
    ladders: dustline.LADDERS,
    ladderAt: dustline.ladderAt,
    spawns: dustline.SPAWNS,
    ammoCrates: [dustline.AMMO_CRATE],
    nav: {
      grid: dustline.NAV_GRID,
      extra: dustline.NAV_EXTRA_NODES,
      chains: dustline.NAV_CHAINS,
      root: [0, 6],
    },
    killY: dustline.KILL_Y,
    maxY: 16,
    // Search & Destroy: attackers start from the north-west, sites at the camo-net nest and by the truck.
    snd: { attack: 'alpha', sites: [{ id: 'A', p: [14, 0, -3.9] }, { id: 'B', p: [-4, 0, 24] }] },
  }),
  acres: Object.freeze({
    id: 'acres',
    name: acres.ACRES_NAME,
    short: 'Atomic Acres',
    tagline: '1950s test-site suburb',
    blurb: 'A 1950s test-site suburb. Two houses face off across the cul-de-sac — bus, moving truck and backyards between them.',
    size: '84 × 84 m',
    half: acres.ACRES_HALF,
    entities: acres.ACRES_ENTITIES,
    colliders: acres.buildAcresColliders,
    ladders: acres.ACRES_LADDERS,
    ladderAt: acres.acresLadderAt,
    spawns: acres.ACRES_SPAWNS,
    ammoCrates: acres.ACRES_AMMO,
    nav: acres.ACRES_NAV,
    killY: -5,
    maxY: 16,
    // Attackers from the west backyards; sites on the orange house's lawn and by the pool.
    snd: { attack: 'alpha', sites: [{ id: 'A', p: [16, 0, -18] }, { id: 'B', p: [12, 0, 20] }] },
  }),
  palmwood: Object.freeze({
    id: 'palmwood',
    name: palmwood.PALMWOOD_NAME,
    short: 'Palmwood',
    tagline: 'Tropical plywood shanty town',
    blurb: 'A plywood shanty town in the palms. A dirt loop round the unfinished Frame, market stalls, a warehouse, and two lookout towers.',
    size: '76 × 76 m',
    half: palmwood.PALMWOOD_HALF,
    entities: palmwood.PALMWOOD_ENTITIES,
    colliders: palmwood.buildPalmwoodColliders,
    ladders: palmwood.PW_LADDERS,
    ladderAt: palmwood.palmwoodLadderAt,
    spawns: palmwood.PALMWOOD_SPAWNS,
    ammoCrates: palmwood.PW_AMMO,
    nav: palmwood.PALMWOOD_NAV,
    killY: -5,
    maxY: 16,
    // Attackers from the north yard; sites in the boat yard (west) and the crate yard (east).
    snd: { attack: 'alpha', sites: [{ id: 'A', p: [-25, 0, 16] }, { id: 'B', p: [25, 0, 15.5] }] },
  }),
  hollow: Object.freeze({
    id: 'hollow',
    name: hollow.HOLLOW_NAME,
    short: 'Hollow Creek',
    tagline: 'A small town on Halloween night',
    blurb: 'Halloween night in a small town. A witch statue on the roundabout, a church and its graveyard, a creek, and a barn and a watchtower on fire.',
    size: '80 × 80 m',
    half: hollow.HOLLOW_HALF,
    entities: hollow.HOLLOW_ENTITIES,
    colliders: hollow.buildHollowColliders,
    ladders: hollow.HOLLOW_LADDERS,
    ladderAt: hollow.hollowLadderAt,
    spawns: hollow.HOLLOW_SPAWNS,
    ammoCrates: hollow.HOLLOW_AMMO,
    nav: hollow.HOLLOW_NAV,
    killY: -5,
    maxY: 16,
    // Attackers from the west; sites in the graveyard (north) and the barn yard (south).
    snd: { attack: 'alpha', sites: [{ id: 'A', p: [8.8, 0, -30.4] }, { id: 'B', p: [7.5, 0, 21.8] }] },
  }),
  quarter: Object.freeze({
    id: 'quarter',
    name: quarter.QUARTER_NAME,
    short: 'Old Quarter',
    tagline: 'Sun-baked backstreets round a building site',
    blurb: 'Sun-baked backstreets round an unfinished concrete frame. Rooftops, balconies, tin shacks, a bulldozer and Market Street.',
    size: '80 × 80 m',
    half: quarter.QUARTER_HALF,
    entities: quarter.QUARTER_ENTITIES,
    colliders: quarter.buildQuarterColliders,
    ladders: quarter.QUARTER_LADDERS,
    ladderAt: quarter.quarterLadderAt,
    spawns: quarter.QUARTER_SPAWNS,
    ammoCrates: quarter.QUARTER_AMMO,
    nav: quarter.QUARTER_NAV,
    killY: -5,
    maxY: 16,
    // Attackers from the west; sites in the building site (by the bulldozer) and the courtyard house.
    snd: { attack: 'alpha', sites: [{ id: 'A', p: [8.6, 0, -3.6] }, { id: 'B', p: [2.6, 0, 25.6] }] },
  }),
  bramble: Object.freeze({
    id: 'bramble',
    name: bramble.BRAMBLE_NAME,
    short: 'Bramblewood',
    tagline: 'An overgrown farm town',
    blurb: 'An abandoned farm the woods have taken back. A field of hay bales under the water tower, the barn, a deep dried-up creek with its covered boardwalk and bridge, ivy on every wall.',
    size: '104 × 104 m',
    half: bramble.BRAMBLE_HALF,
    entities: bramble.BRAMBLE_ENTITIES,
    colliders: bramble.buildBrambleColliders,
    ladders: bramble.BRAMBLE_LADDERS,
    ladderAt: bramble.brambleLadderAt,
    spawns: bramble.BRAMBLE_SPAWNS,
    ammoCrates: bramble.BRAMBLE_AMMO,
    nav: bramble.BRAMBLE_NAV,
    killY: -5,
    maxY: 18,
    // Attackers from the west; sites in the corner of the field and the yard of the brick house on the road.
    snd: { attack: 'alpha', sites: [{ id: 'A', p: [16.0, 0, -28.0] }, { id: 'B', p: [18.6, 0, 26.0] }] },
  }),
  pinecrest: Object.freeze({
    id: 'pinecrest',
    name: pinecrest.PINECREST_NAME,
    short: 'Pinecrest',
    tagline: 'A timber lodge in the mountains in autumn',
    blurb: 'A lodge over a creek, a lake and its boathouse, a glasshouse, granite outcrops and a power substation, in birch and pine woods turning gold. Drop into the gully, climb the rocks, or fight through the lodge.',
    size: '100 × 100 m',
    isNew: true,
    half: pinecrest.PINECREST_HALF,
    entities: pinecrest.PINECREST_ENTITIES,
    colliders: pinecrest.buildPinecrestColliders,
    glass: pinecrest.PINECREST_GLASS,
    ladders: pinecrest.PINECREST_LADDERS,
    ladderAt: pinecrest.pinecrestLadderAt,
    spawns: pinecrest.PINECREST_SPAWNS,
    ammoCrates: pinecrest.PINECREST_AMMO,
    nav: pinecrest.PINECREST_NAV,
    killY: -12,
    maxY: 26,
    // Attackers from the north woods; site A in the lodge, B in the glasshouse.
    snd: { attack: 'alpha', sites: [{ id: 'A', p: [-3.0, 0, 29.0] }, { id: 'B', p: [22.0, 0, 20.0] }] },
  }),
  terminal: Object.freeze({
    id: 'terminal',
    name: terminal.TERMINAL_NAME,
    short: 'Skyport',
    tagline: 'A shelled airport terminal and the jets on its apron',
    blurb: 'A battle-scarred, L-shaped airport terminal and the wide-body jet parked nose-in at its gate, a crashed airliner burning on the apron. Walk the jet bridge into the cabin, slide out onto the apron, climb the fallen floor in the pier, or fight through the hall, the shops and the lounges behind the shot-out glass.',
    size: '112 × 112 m',
    half: terminal.TERMINAL_HALF,
    entities: terminal.TERMINAL_ENTITIES,
    colliders: terminal.buildTerminalColliders,
    glass: terminal.TERMINAL_GLASS,
    ladders: terminal.TERMINAL_LADDERS,
    ladderAt: terminal.terminalLadderAt,
    spawns: terminal.TERMINAL_SPAWNS,
    ammoCrates: terminal.TERMINAL_AMMO,
    nav: terminal.TERMINAL_NAV,
    killY: -5,
    maxY: 22,
    // Attackers from the apron; site A inside the terminal (the east hall's gate lounge), site B inside
    // the jet at the gate (its cabin, by the over-wing exits: up the slide, the stairs, the bridge or a wing).
    snd: { attack: 'bravo', sites: [{ id: 'A', p: [26.0, 0, -35.0] }, { id: 'B', p: [0, 3.5, 4.9] }] },
  }),
})

/** Order maps are listed in the menus. */
export const MAP_IDS = Object.freeze(['pinecrest', 'terminal', 'bramble', 'quarter', 'hollow', 'palmwood', 'acres', 'dustline'])
/** What a new player starts on. */
export const DEFAULT_MAP = 'acres'
/** What a room opens on when the client didn't say (clients from before maps). */
export const LEGACY_MAP = 'dustline'

export const isMapId = (id) => typeof id === 'string' && Object.hasOwn(MAPS, id)
export const getMap = (id) => MAPS[id] ?? MAPS[DEFAULT_MAP]
