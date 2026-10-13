/**
 * Every map in the game, by id. A map is the data both sides need to play on it:
 * its colliders, ladders, spawns, resupply crates, the bot navigation hints, its
 * bounds and its Search & Destroy layout (`snd`: which team spawns attack, and
 * bomb sites A and B). The client also draws its `entities` (see world/MapScene.jsx).
 */
import * as dustline from './map.js'
import * as acres from './mapAcres.js'
import * as hollow from './mapHollow.js'
import * as palmwood from './mapPalmwood.js'

export const MAPS = Object.freeze({
  dustline: Object.freeze({
    id: 'dustline',
    name: dustline.MAP_NAME,
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
    tagline: 'A small town on Halloween night',
    blurb: 'Halloween night in a small town. A witch statue on the roundabout, a church and its graveyard, a creek, and a barn and a watchtower on fire.',
    size: '80 × 80 m',
    isNew: true,
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
})

/** Order maps are listed in the menus. */
export const MAP_IDS = Object.freeze(['hollow', 'palmwood', 'acres', 'dustline'])
/** What a new player starts on. */
export const DEFAULT_MAP = 'acres'
/** What a room opens on when the client didn't say (clients from before maps). */
export const LEGACY_MAP = 'dustline'

export const isMapId = (id) => typeof id === 'string' && Object.hasOwn(MAPS, id)
export const getMap = (id) => MAPS[id] ?? MAPS[DEFAULT_MAP]
