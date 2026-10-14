import { schema, t } from '@colyseus/schema'

/**
 * Synced room state. Only what other clients need to *see* lives here; ammo,
 * loadouts, timers and anti-cheat bookkeeping stay server-side in `meta`.
 */
export const PlayerState = schema(
  {
    id: t.string(),
    name: t.string(),
    /** '' while picking a team, 'alpha' | 'bravo' in TDM, 'ffa' in free-for-all. */
    team: t.string().default(''),
    isBot: t.boolean().default(false),
    /** selecting | deploying | alive | dead — see PLAYER_STATES. */
    state: t.string().default('selecting'),
    x: t.float32().default(0),
    y: t.float32().default(0),
    z: t.float32().default(0),
    yaw: t.float32().default(0),
    pitch: t.float32().default(0),
    hp: t.uint8().default(100),
    kills: t.uint16().default(0),
    deaths: t.uint16().default(0),
    ping: t.uint16().default(0),
    /** Weapon currently in hand: ar | sniper | pistol | knife. */
    weapon: t.string().default('ar'),
    primary: t.string().default('ar'),
    /** Loadout + attachments, so others can draw your guns: see kitString(). */
    kit: t.string().default(''),
    /** Server time (ms since the room opened) of the position above, for smooth interpolation. */
    mt: t.uint32().default(0),
    crouch: t.boolean().default(false),
    prone: t.boolean().default(false),
    slide: t.boolean().default(false),
    ads: t.boolean().default(false),
    sprint: t.boolean().default(false),
    climbing: t.boolean().default(false),
    /** Bumped on every spawn so clients can snap instead of interpolating a teleport. */
    spawnSeq: t.uint16().default(0),
    /** Rank number (1-based) the client reports, for insignia on scoreboards. */
    rank: t.uint8().default(1),
    /** JSON: { equipped, proportions } from the player's Bloxity avatar. */
    avatar: t.string().default(''),
    joinedAt: t.float64().default(0),
  },
  'PlayerState',
)

export const GrenadeState = schema(
  {
    id: t.string(),
    kind: t.string(),
    owner: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    /** Placed charges: which way a claymore faces; a C4 brick's turn where it lies. */
    yaw: t.float32(),
    /** Stuck to a wall, the floor or a player (it stops tumbling). */
    stuck: t.boolean(),
  },
  'GrenadeState',
)

export const SmokeState = schema(
  {
    id: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    /** Seconds left; the cloud fades out over the last couple. */
    remaining: t.float32(),
  },
  'SmokeState',
)

export const PickupState = schema(
  {
    id: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
  },
  'PickupState',
)

export const DustlineState = schema(
  {
    mode: t.string().default('tdm'),
    /** Join key for private rooms ('' for public matchmaking rooms). */
    roomCode: t.string().default(''),
    maxPlayers: t.uint8().default(8),
    /** Private rooms: the player who can start the match. */
    host: t.string().default(''),
    /** warmup (private rooms, before the host starts) | playing | ended */
    phase: t.string().default('playing'),
    timeLeft: t.uint16().default(0),
    scoreLimit: t.uint16().default(0),
    scoreAlpha: t.uint16().default(0),
    scoreBravo: t.uint16().default(0),
    /** After a match: 'alpha' | 'bravo' | 'draw' (TDM) or the winner's id (FFA). */
    winner: t.string().default(''),
    mvp: t.string().default(''),
    restartIn: t.uint8().default(0),
    /* Search & Destroy ('' / 0 in the other modes). */
    round: t.uint8().default(0),
    /** freeze | live | planted | over (see ROUND). */
    roundPhase: t.string().default(''),
    /** Team attacking this round. */
    attackers: t.string().default(''),
    /** carried | dropped | planted | defused | exploded | '' */
    bombState: t.string().default(''),
    bombCarrier: t.string().default(''),
    /** Site it was planted on: 'A' | 'B'. */
    bombSite: t.string().default(''),
    bombX: t.float32().default(0),
    bombY: t.float32().default(0),
    bombZ: t.float32().default(0),
    /** Seconds until it goes off, once planted. */
    bombLeft: t.float32().default(0),
    /** Someone planting or defusing: 'plant' | 'defuse' | '', who, and how far along (0..1). */
    action: t.string().default(''),
    actionBy: t.string().default(''),
    actionProgress: t.float32().default(0),
    /** The last round's result: winning team, and why (eliminated | time | detonated | defused). */
    roundWinner: t.string().default(''),
    roundWhy: t.string().default(''),
    /** Breakable glass: which of the map's panes are broken, as hex (see shared/glass.js). */
    glass: t.string().default(''),
    players: t.map(PlayerState),
    grenades: t.map(GrenadeState),
    smokes: t.map(SmokeState),
    pickups: t.map(PickupState),
  },
  'DustlineState',
)
