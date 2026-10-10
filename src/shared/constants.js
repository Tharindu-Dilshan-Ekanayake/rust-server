/**
 * Gameplay constants shared by the client and the server.
 *
 * Anything the server validates against (speeds, timers, limits) lives here so the
 * two sides cannot drift apart.
 */

export const ROOM_NAME = 'dustline'
export const MAX_PLAYERS = 8
/** Length of private-room join keys. */
export const ROOM_CODE_LENGTH = 6

export const MODES = Object.freeze({ TDM: 'tdm', FFA: 'ffa' })
export const MODE_LABELS = Object.freeze({ tdm: 'TEAM DEATHMATCH', ffa: 'FREE FOR ALL' })

export const TEAMS = Object.freeze({ ALPHA: 'alpha', BRAVO: 'bravo' })
export const TEAM_LABELS = Object.freeze({ alpha: 'ALPHA', bravo: 'BRAVO' })

/** Per-mode match rules. Time limits are in seconds. */
export const MATCH_RULES = Object.freeze({
  tdm: { scoreLimit: 50, timeLimit: 600, botFill: 8, teamSize: 4 },
  ffa: { scoreLimit: 25, timeLimit: 600, botFill: 6, teamSize: 8 },
})

export const RESPAWN_DELAY = 5
export const TEAM_SELECT_TIMEOUT = 15
export const DEPLOY_TIMEOUT = 5
export const MATCH_END_DURATION = 15
export const SPAWN_PROTECTION = 1.5

/**
 * Lifecycle of a player inside a room.
 * selecting -> (TDM team picked) -> deploying -> alive <-> dead
 */
export const PLAYER_STATES = Object.freeze({
  SELECTING: 'selecting',
  DEPLOYING: 'deploying',
  ALIVE: 'alive',
  DEAD: 'dead',
})

export const PLAYER = Object.freeze({
  radius: 0.35,
  height: 1.8,
  crouchHeight: 1.2,
  proneHeight: 0.72,
  eyeHeight: 1.62,
  crouchEyeHeight: 1.12,
  proneEyeHeight: 0.6,
  walkSpeed: 5.2,
  sprintMultiplier: 1.45,
  crouchMultiplier: 0.55,
  proneMultiplier: 0.3,
  /** Slide: launch speed, how long it lasts, and the wait before the next one. */
  slideSpeed: 9.4,
  slideTime: 0.75,
  slideCooldown: 0.9,
  adsMultiplier: 0.65,
  jumpVelocity: 7.4,
  gravity: 20,
  climbSpeed: 3.2,
  maxHealth: 100,
  regenDelay: 4,
  regenRate: 25,
})

/** Body stance, as synced and as used by hitboxes. */
export const STANCE = Object.freeze({ STAND: 0, CROUCH: 1, PRONE: 2 })

/** Stance of a synced player state (`crouch` / `prone` / `slide` flags). */
export const stanceOf = (p) => (p.prone ? STANCE.PRONE : p.crouch || p.slide ? STANCE.CROUCH : STANCE.STAND)

export const eyeHeightFor = (stance) =>
  stance === STANCE.PRONE ? PLAYER.proneEyeHeight : stance === STANCE.CROUCH ? PLAYER.crouchEyeHeight : PLAYER.eyeHeight

/** Fastest legal horizontal speed (sprinting with the knife out), used by the server sanity check. */
export const MAX_LEGAL_SPEED = PLAYER.walkSpeed * PLAYER.sprintMultiplier * 1.1

/** How often clients stream their transform to the server. */
export const MOVE_SEND_INTERVAL_MS = 33

/** Remote players are rendered this far in the past so there are always two snapshots to blend. */
export const INTERP_DELAY_MS = 90

/** State patches per second from the server (keep in step with MOVE_SEND_INTERVAL_MS). */
export const PATCH_RATE_MS = 33

/**
 * Fall damage: drops up to FALL_SAFE metres (a jump off the shack roof) are free,
 * then FALL_DAMAGE_PER_M per metre — the tank tops hurt, the tower kills.
 */
export const FALL_SAFE = 4.2
export const FALL_DAMAGE_PER_M = 19
export const fallDamage = (height) => (height <= FALL_SAFE ? 0 : Math.round((height - FALL_SAFE) * FALL_DAMAGE_PER_M))

/** Rapier collision groups: (membership << 16) | filter. */
export const GROUP = Object.freeze({
  SOLID: 0x0001, // map geometry that stops players AND bullets
  MOVE_ONLY: 0x0002, // railings etc: stops players, bullets pass through
  PLAYER: 0x0004,
  GRENADE: 0x0008,
})

export const interactionGroups = (membership, filter) =>
  ((membership & 0xffff) << 16) | (filter & 0xffff)

/** Ray groups for bullets: only solid geometry. */
export const BULLET_GROUPS = interactionGroups(0xffff, GROUP.SOLID)
/** Groups for the local player's character controller. */
export const PLAYER_GROUPS = interactionGroups(GROUP.PLAYER, GROUP.SOLID | GROUP.MOVE_ONLY)
/** Groups for anything walking or bouncing that railings should stop. */
export const WALK_GROUPS = interactionGroups(0xffff, GROUP.SOLID | GROUP.MOVE_ONLY)
export const GRENADE_GROUPS = interactionGroups(GROUP.GRENADE, GROUP.SOLID | GROUP.MOVE_ONLY)
