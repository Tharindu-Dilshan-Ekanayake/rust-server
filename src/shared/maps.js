/**
 * Every map in the game, by id. A map is the data both sides need to play on it:
 * its colliders, ladders, spawns, resupply crates, the bot navigation hints and
 * its bounds. The client also draws its `entities` (see world/MapScene.jsx).
 */
import * as dustline from './map.js'
import * as acres from './mapAcres.js'

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
  }),
})

/** Order maps are listed in the menus. */
export const MAP_IDS = Object.freeze(['acres', 'dustline'])
/** What a new player starts on. */
export const DEFAULT_MAP = 'acres'
/** What a room opens on when the client didn't say (clients from before maps). */
export const LEGACY_MAP = 'dustline'

export const isMapId = (id) => typeof id === 'string' && Object.hasOwn(MAPS, id)
export const getMap = (id) => MAPS[id] ?? MAPS[DEFAULT_MAP]
