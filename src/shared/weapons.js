/**
 * Weapon + equipment tables, attachments and the loadout ("class") rules.
 *
 * The server is the authority for every number in here: damage is always computed
 * server-side from these tables, never trusted from a client message.
 *
 * Every gun belongs to a `category` (what the class editor groups it under) and
 * a `base`: the original gun of its family whose hold, animations, casings and
 * sound it shares (a Volk-47 is held and reloaded like the VX-7, a Kite like the
 * Longhaul). `sound` tunes the family's shot for this gun: `rate` < 1 is a
 * deeper, heavier report; `base` borrows another family's.
 */

export const SLOTS = Object.freeze({ PRIMARY: 1, SECONDARY: 2, MELEE: 3 })

/** Weapon categories, in the order the class editor lists them. */
export const CATEGORIES = Object.freeze({
  ar: { label: 'Assault Rifles', short: 'AR', slot: SLOTS.PRIMARY },
  smg: { label: 'Submachine Guns', short: 'SMG', slot: SLOTS.PRIMARY },
  sniper: { label: 'Sniper Rifles', short: 'Sniper', slot: SLOTS.PRIMARY },
  lmg: { label: 'Machine Guns', short: 'LMG', slot: SLOTS.PRIMARY },
  shotgun: { label: 'Shotguns', short: 'Shotgun', slot: SLOTS.PRIMARY },
  pistol: { label: 'Pistols', short: 'Pistol', slot: SLOTS.SECONDARY },
  launcher: { label: 'Launchers', short: 'Launcher', slot: SLOTS.SECONDARY },
})
export const PRIMARY_CATEGORIES = Object.freeze(['ar', 'smg', 'sniper', 'lmg', 'shotgun'])
export const SECONDARY_CATEGORIES = Object.freeze(['pistol', 'launcher'])

/* Attachment options per family (the first of each list is the default). */
const MUZZLES = ['none', 'suppressor', 'compensator', 'brake']
const UNDERS = ['none', 'grip', 'angled', 'laser']
const MAGS = ['std', 'extended', 'fast']
const AR_SLOTS = Object.freeze({ optic: ['iron', 'reddot', 'holo', 'acog'], muzzle: MUZZLES, under: UNDERS, mag: MAGS })
const SMG_SLOTS = Object.freeze({ optic: ['iron', 'reddot', 'holo'], muzzle: MUZZLES, under: UNDERS, mag: MAGS })
const LMG_SLOTS = Object.freeze({ optic: ['iron', 'reddot', 'holo', 'acog'], muzzle: ['none', 'compensator', 'brake', 'suppressor'], under: ['none', 'grip', 'angled'], mag: ['std', 'fast'] })
const BOLT_SLOTS = Object.freeze({ muzzle: ['none', 'suppressor'], mag: MAGS })
const PISTOL_SLOTS = Object.freeze({ optic: ['iron', 'reddot'], muzzle: ['none', 'suppressor'], under: ['none', 'laser'], mag: MAGS })

const P = SLOTS.PRIMARY
const S = SLOTS.SECONDARY

export const WEAPONS = Object.freeze({
  /* ---- Assault rifles ----------------------------------------------------- */
  ar: {
    id: 'ar',
    name: 'VX-7 Ranger',
    short: 'VX-7',
    kind: 'Assault Rifle',
    category: 'ar',
    base: 'ar',
    desc: '5.56 carbine. The steady all-rounder.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 42, chest: 28, body: 28 },
    /** Full damage until `start`, linear down to `minScale` at `end` (metres). */
    falloff: { start: 20, end: 30, minScale: 20 / 28 },
    fireInterval: 0.086,
    magSize: 30,
    reserve: 120,
    reloadTime: 1.65,
    reloadEmptyTime: 2.1,
    swapTime: 0.45,
    adsTime: 0.25,
    adsFov: 55,
    hipSpread: 0.035,
    adsSpread: 0.003,
    moveSpread: 0.03,
    recoil: { vertical: 0.0105, horizontal: 0.0045, recovery: 7 },
    moveMultiplier: 0.95,
    range: 150,
    stats: { damage: 55, fireRate: 82, range: 60, mobility: 72, handling: 70 },
    attachSlots: { ...AR_SLOTS, optic: ['reddot', 'iron', 'holo', 'acog'] },
  },
  volk: {
    id: 'volk',
    name: 'Volk-47',
    short: 'VOLK',
    kind: 'Assault Rifle',
    category: 'ar',
    base: 'ar',
    desc: '7.62 in wood and stamped steel. Hits hard, kicks harder.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 49, chest: 34, body: 32 },
    falloff: { start: 22, end: 35, minScale: 25 / 34 },
    fireInterval: 0.1,
    magSize: 30,
    reserve: 120,
    reloadTime: 1.9,
    reloadEmptyTime: 2.4,
    swapTime: 0.5,
    adsTime: 0.28,
    adsFov: 55,
    hipSpread: 0.038,
    adsSpread: 0.0035,
    moveSpread: 0.032,
    recoil: { vertical: 0.0135, horizontal: 0.0068, recovery: 6.5 },
    moveMultiplier: 0.94,
    range: 160,
    sound: { rate: 0.84, gain: 1.08 },
    stats: { damage: 68, fireRate: 70, range: 64, mobility: 66, handling: 58 },
    attachSlots: AR_SLOTS,
  },
  talon: {
    id: 'talon',
    name: 'Talon H',
    short: 'TALON',
    kind: 'Battle Rifle',
    category: 'ar',
    base: 'ar',
    desc: 'Full-power 7.62 battle rifle. Three to the chest at range.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 58, chest: 41, body: 38 },
    falloff: { start: 30, end: 48, minScale: 31 / 41 },
    fireInterval: 0.112,
    magSize: 20,
    reserve: 100,
    reloadTime: 2.0,
    reloadEmptyTime: 2.5,
    swapTime: 0.52,
    adsTime: 0.3,
    adsFov: 54,
    hipSpread: 0.04,
    adsSpread: 0.003,
    moveSpread: 0.034,
    recoil: { vertical: 0.016, horizontal: 0.0055, recovery: 6 },
    moveMultiplier: 0.92,
    range: 180,
    sound: { base: 'lmg', rate: 1.06, gain: 1.0 },
    stats: { damage: 78, fireRate: 58, range: 76, mobility: 60, handling: 54 },
    attachSlots: AR_SLOTS,
  },
  strix: {
    id: 'strix',
    name: 'Strix F2',
    short: 'STRIX',
    kind: 'Burst Rifle',
    category: 'ar',
    base: 'ar',
    desc: 'Bullpup three-round burst. Tight, quick, deadly accurate.',
    slot: P,
    fireMode: 'burst',
    /** Rounds per trigger pull, `fireInterval` apart; `burstDelay` before the next. */
    burst: 3,
    burstDelay: 0.22,
    damage: { head: 40, chest: 30, body: 29 },
    falloff: { start: 26, end: 40, minScale: 0.76 },
    fireInterval: 0.056,
    magSize: 30,
    reserve: 120,
    reloadTime: 1.75,
    reloadEmptyTime: 2.25,
    swapTime: 0.48,
    adsTime: 0.26,
    adsFov: 54,
    hipSpread: 0.034,
    adsSpread: 0.0025,
    moveSpread: 0.03,
    recoil: { vertical: 0.0095, horizontal: 0.0035, recovery: 7.5 },
    moveMultiplier: 0.95,
    range: 160,
    sound: { rate: 1.08, gain: 0.95 },
    stats: { damage: 60, fireRate: 76, range: 66, mobility: 70, handling: 66 },
    attachSlots: AR_SLOTS,
  },
  harrier: {
    id: 'harrier',
    name: 'Harrier 36',
    short: 'HARRIER',
    kind: 'Assault Rifle',
    category: 'ar',
    base: 'ar',
    desc: 'Light polymer rifle. Fast fire, barely moves.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 37, chest: 25, body: 24 },
    falloff: { start: 20, end: 30, minScale: 0.75 },
    fireInterval: 0.08,
    magSize: 30,
    reserve: 150,
    reloadTime: 1.6,
    reloadEmptyTime: 2.05,
    swapTime: 0.42,
    adsTime: 0.24,
    adsFov: 56,
    hipSpread: 0.033,
    adsSpread: 0.003,
    moveSpread: 0.028,
    recoil: { vertical: 0.0088, horizontal: 0.004, recovery: 7.5 },
    moveMultiplier: 0.96,
    range: 150,
    sound: { rate: 1.12, gain: 0.92 },
    stats: { damage: 48, fireRate: 86, range: 58, mobility: 76, handling: 76 },
    attachSlots: AR_SLOTS,
  },

  /* ---- Submachine guns ---------------------------------------------------- */
  smg: {
    id: 'smg',
    name: 'VK-9 Vandal',
    short: 'VANDAL',
    kind: 'Submachine Gun',
    category: 'smg',
    base: 'smg',
    desc: '9 mm workhorse. Fast and forgiving up close.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 32, chest: 23, body: 22 },
    falloff: { start: 12, end: 24, minScale: 0.68 },
    fireInterval: 0.067,
    magSize: 32,
    reserve: 128,
    reloadTime: 1.45,
    reloadEmptyTime: 1.85,
    swapTime: 0.38,
    adsTime: 0.18,
    adsFov: 62,
    hipSpread: 0.03,
    adsSpread: 0.008,
    moveSpread: 0.018,
    recoil: { vertical: 0.0085, horizontal: 0.0055, recovery: 9 },
    moveMultiplier: 1.02,
    range: 90,
    stats: { damage: 40, fireRate: 94, range: 35, mobility: 90, handling: 86 },
    attachSlots: SMG_SLOTS,
  },
  wasp: {
    id: 'wasp',
    name: 'Wasp 45',
    short: 'WASP',
    kind: 'Submachine Gun',
    category: 'smg',
    base: 'smg',
    desc: 'Boxy .45. Slower, but each round lands heavy.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 42, chest: 30, body: 28 },
    falloff: { start: 14, end: 26, minScale: 0.7 },
    fireInterval: 0.092,
    magSize: 25,
    reserve: 125,
    reloadTime: 1.6,
    reloadEmptyTime: 2.0,
    swapTime: 0.38,
    adsTime: 0.19,
    adsFov: 62,
    hipSpread: 0.03,
    adsSpread: 0.007,
    moveSpread: 0.018,
    recoil: { vertical: 0.0105, horizontal: 0.0055, recovery: 8.5 },
    moveMultiplier: 1.0,
    range: 100,
    sound: { rate: 0.86, gain: 1.08 },
    stats: { damage: 52, fireRate: 72, range: 44, mobility: 86, handling: 82 },
    attachSlots: SMG_SLOTS,
  },
  mako: {
    id: 'mako',
    name: 'Mako 57',
    short: 'MAKO',
    kind: 'Personal Defence Weapon',
    category: 'smg',
    base: 'smg',
    desc: 'Bullpup with a 50-round top magazine. Soft recoil.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 30, chest: 21, body: 20 },
    falloff: { start: 12, end: 22, minScale: 0.7 },
    fireInterval: 0.066,
    magSize: 50,
    reserve: 150,
    reloadTime: 2.2,
    reloadEmptyTime: 2.6,
    swapTime: 0.4,
    adsTime: 0.2,
    adsFov: 62,
    hipSpread: 0.028,
    adsSpread: 0.008,
    moveSpread: 0.018,
    recoil: { vertical: 0.0068, horizontal: 0.0042, recovery: 9.5 },
    moveMultiplier: 1.0,
    range: 90,
    sound: { rate: 1.1, gain: 0.9 },
    stats: { damage: 36, fireRate: 94, range: 34, mobility: 86, handling: 84 },
    attachSlots: SMG_SLOTS,
  },
  ripper: {
    id: 'ripper',
    name: 'Ripper V',
    short: 'RIPPER',
    kind: 'Submachine Gun',
    category: 'smg',
    base: 'smg',
    desc: '1,200 rounds a minute. Shreds anything in a room.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 27, chest: 19, body: 18 },
    falloff: { start: 8, end: 18, minScale: 0.6 },
    fireInterval: 0.05,
    magSize: 25,
    reserve: 125,
    reloadTime: 1.4,
    reloadEmptyTime: 1.8,
    swapTime: 0.34,
    adsTime: 0.17,
    adsFov: 63,
    hipSpread: 0.032,
    adsSpread: 0.009,
    moveSpread: 0.016,
    recoil: { vertical: 0.0072, horizontal: 0.0068, recovery: 10 },
    moveMultiplier: 1.03,
    range: 70,
    sound: { rate: 1.18, gain: 0.88 },
    stats: { damage: 32, fireRate: 100, range: 22, mobility: 92, handling: 88 },
    attachSlots: SMG_SLOTS,
  },
  rattler: {
    id: 'rattler',
    name: 'Rattler',
    short: 'RATTLER',
    kind: 'Submachine Gun',
    category: 'smg',
    base: 'smg',
    desc: 'Compact open-bolt classic. Quickest to the sights.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 32, chest: 23, body: 22 },
    falloff: { start: 10, end: 20, minScale: 0.65 },
    fireInterval: 0.075,
    magSize: 32,
    reserve: 128,
    reloadTime: 1.35,
    reloadEmptyTime: 1.7,
    swapTime: 0.3,
    adsTime: 0.15,
    adsFov: 64,
    hipSpread: 0.026,
    adsSpread: 0.01,
    moveSpread: 0.015,
    recoil: { vertical: 0.0098, horizontal: 0.0072, recovery: 9 },
    moveMultiplier: 1.04,
    range: 75,
    sound: { rate: 0.96, gain: 1.0 },
    stats: { damage: 40, fireRate: 86, range: 26, mobility: 96, handling: 92 },
    attachSlots: SMG_SLOTS,
  },

  /* ---- Sniper rifles ------------------------------------------------------ */
  sniper: {
    id: 'sniper',
    name: 'Longhaul .50',
    short: 'LONGHAUL',
    kind: 'Sniper Rifle',
    category: 'sniper',
    base: 'sniper',
    desc: 'Heavy bolt-action. One to the upper chest.',
    slot: P,
    fireMode: 'bolt',
    // Upper-chest hits are a one-shot kill; lower body leaves the target on 5 hp.
    damage: { head: 200, chest: 100, body: 95 },
    falloff: null,
    fireInterval: 1.1,
    magSize: 5,
    reserve: 20,
    reloadTime: 2.5,
    reloadEmptyTime: 2.5,
    swapTime: 0.6,
    adsTime: 0.45,
    adsFov: 20,
    hipSpread: 0.11,
    adsSpread: 0.0,
    moveSpread: 0.08,
    recoil: { vertical: 0.045, horizontal: 0.008, recovery: 4 },
    moveMultiplier: 0.85,
    range: 300,
    scoped: true,
    sway: 0.012,
    holdBreath: 3,
    stats: { damage: 98, fireRate: 12, range: 100, mobility: 45, handling: 30 },
    attachSlots: BOLT_SLOTS,
  },
  kite: {
    id: 'kite',
    name: 'Kite SR',
    short: 'KITE',
    kind: 'Sniper Rifle',
    category: 'sniper',
    base: 'sniper',
    desc: 'Light scout rifle. Quick scope, quick bolt; headshots to drop.',
    slot: P,
    fireMode: 'bolt',
    damage: { head: 200, chest: 92, body: 82 },
    falloff: null,
    fireInterval: 0.85,
    magSize: 6,
    reserve: 24,
    reloadTime: 2.1,
    reloadEmptyTime: 2.1,
    swapTime: 0.5,
    adsTime: 0.32,
    adsFov: 26,
    hipSpread: 0.09,
    adsSpread: 0.0,
    moveSpread: 0.065,
    recoil: { vertical: 0.035, horizontal: 0.007, recovery: 4.5 },
    moveMultiplier: 0.92,
    range: 280,
    scoped: true,
    sway: 0.009,
    holdBreath: 3,
    sound: { rate: 1.15, gain: 0.85 },
    stats: { damage: 85, fireRate: 22, range: 92, mobility: 64, handling: 50 },
    attachSlots: BOLT_SLOTS,
  },
  ironwood: {
    id: 'ironwood',
    name: 'Ironwood M91',
    short: 'IRONWOOD',
    kind: 'Sniper Rifle',
    category: 'sniper',
    base: 'sniper',
    desc: 'Old wood-stocked bolt gun on stripper clips. One shot, one kill.',
    slot: P,
    fireMode: 'bolt',
    damage: { head: 200, chest: 105, body: 90 },
    falloff: null,
    fireInterval: 1.3,
    magSize: 5,
    reserve: 20,
    reloadTime: 2.9,
    reloadEmptyTime: 2.9,
    swapTime: 0.6,
    adsTime: 0.42,
    adsFov: 24,
    hipSpread: 0.11,
    adsSpread: 0.0,
    moveSpread: 0.08,
    recoil: { vertical: 0.05, horizontal: 0.01, recovery: 3.8 },
    moveMultiplier: 0.86,
    range: 300,
    scoped: true,
    sway: 0.013,
    holdBreath: 3,
    sound: { rate: 0.92, gain: 1.05 },
    stats: { damage: 96, fireRate: 10, range: 100, mobility: 48, handling: 34 },
    attachSlots: { muzzle: ['none', 'suppressor'] },
  },
  sable: {
    id: 'sable',
    name: 'Sable DMR',
    short: 'SABLE',
    kind: 'Marksman Rifle',
    category: 'sniper',
    base: 'sniper',
    desc: 'Semi-auto 7.62 on a low-power scope. Two to the chest.',
    slot: P,
    fireMode: 'semi',
    damage: { head: 110, chest: 52, body: 48 },
    falloff: { start: 45, end: 75, minScale: 0.85 },
    fireInterval: 0.22,
    magSize: 20,
    reserve: 80,
    reloadTime: 1.9,
    reloadEmptyTime: 2.4,
    swapTime: 0.5,
    adsTime: 0.3,
    adsFov: 34,
    hipSpread: 0.06,
    adsSpread: 0.002,
    moveSpread: 0.05,
    recoil: { vertical: 0.026, horizontal: 0.006, recovery: 6 },
    moveMultiplier: 0.92,
    range: 220,
    scoped: true,
    sway: 0.006,
    holdBreath: 3,
    sound: { base: 'lmg', rate: 0.94, gain: 1.1 },
    stats: { damage: 76, fireRate: 40, range: 90, mobility: 60, handling: 52 },
    attachSlots: { muzzle: ['none', 'suppressor', 'compensator'], under: ['none', 'grip', 'angled'], mag: MAGS },
  },
  goliath: {
    id: 'goliath',
    name: 'Goliath .50',
    short: 'GOLIATH',
    kind: 'Anti-materiel Rifle',
    category: 'sniper',
    base: 'sniper',
    desc: 'Semi-auto .50 BMG. Brutal kick, nothing survives it.',
    slot: P,
    fireMode: 'semi',
    damage: { head: 240, chest: 115, body: 100 },
    falloff: null,
    fireInterval: 0.5,
    magSize: 10,
    reserve: 30,
    reloadTime: 2.8,
    reloadEmptyTime: 3.4,
    swapTime: 0.75,
    adsTime: 0.55,
    adsFov: 18,
    hipSpread: 0.13,
    adsSpread: 0.0,
    moveSpread: 0.1,
    recoil: { vertical: 0.065, horizontal: 0.014, recovery: 3.5 },
    moveMultiplier: 0.8,
    range: 320,
    scoped: true,
    sway: 0.014,
    holdBreath: 3,
    sound: { rate: 0.82, gain: 1.15 },
    stats: { damage: 100, fireRate: 18, range: 100, mobility: 30, handling: 24 },
    attachSlots: { muzzle: ['none', 'suppressor'], mag: ['std', 'fast'] },
  },

  /* ---- Machine guns ------------------------------------------------------- */
  lmg: {
    id: 'lmg',
    name: 'Bulldog LMG',
    short: 'BULLDOG',
    kind: 'Light Machine Gun',
    category: 'lmg',
    base: 'lmg',
    desc: '5.56 belt-fed. A hundred rounds before you have to stop.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 44, chest: 31, body: 29 },
    falloff: { start: 25, end: 40, minScale: 0.75 },
    fireInterval: 0.092,
    magSize: 100,
    reserve: 200,
    reloadTime: 4.6,
    reloadEmptyTime: 5.2,
    swapTime: 0.7,
    adsTime: 0.4,
    adsFov: 52,
    hipSpread: 0.05,
    adsSpread: 0.006,
    moveSpread: 0.045,
    recoil: { vertical: 0.012, horizontal: 0.0075, recovery: 6 },
    moveMultiplier: 0.82,
    range: 160,
    stats: { damage: 62, fireRate: 78, range: 70, mobility: 38, handling: 36 },
    attachSlots: LMG_SLOTS,
  },
  mule: {
    id: 'mule',
    name: 'Mule 60',
    short: 'MULE',
    kind: 'General-purpose MG',
    category: 'lmg',
    base: 'lmg',
    desc: '7.62 general-purpose gun. Slow, steady, three to drop.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 54, chest: 38, body: 35 },
    falloff: { start: 28, end: 45, minScale: 0.78 },
    fireInterval: 0.112,
    magSize: 100,
    reserve: 200,
    reloadTime: 5.6,
    reloadEmptyTime: 6.2,
    swapTime: 0.75,
    adsTime: 0.44,
    adsFov: 52,
    hipSpread: 0.055,
    adsSpread: 0.006,
    moveSpread: 0.05,
    recoil: { vertical: 0.0165, horizontal: 0.0085, recovery: 5.5 },
    moveMultiplier: 0.8,
    range: 180,
    sound: { rate: 0.9, gain: 1.1 },
    stats: { damage: 74, fireRate: 58, range: 76, mobility: 32, handling: 30 },
    attachSlots: LMG_SLOTS,
  },
  ram: {
    id: 'ram',
    name: 'Ram PK',
    short: 'RAM',
    kind: 'General-purpose MG',
    category: 'lmg',
    base: 'lmg',
    desc: 'Rugged 7.62 belt gun out of a can. Hard-hitting, steady.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 48, chest: 33, body: 31 },
    falloff: { start: 26, end: 42, minScale: 0.78 },
    fireInterval: 0.092,
    magSize: 100,
    reserve: 200,
    reloadTime: 5.0,
    reloadEmptyTime: 5.6,
    swapTime: 0.72,
    adsTime: 0.42,
    adsFov: 52,
    hipSpread: 0.052,
    adsSpread: 0.0065,
    moveSpread: 0.048,
    recoil: { vertical: 0.0145, horizontal: 0.0085, recovery: 5.8 },
    moveMultiplier: 0.81,
    range: 170,
    sound: { rate: 0.96, gain: 1.05 },
    stats: { damage: 70, fireRate: 72, range: 72, mobility: 34, handling: 32 },
    attachSlots: LMG_SLOTS,
  },
  buzzsaw: {
    id: 'buzzsaw',
    name: 'Buzzsaw 42',
    short: 'BUZZSAW',
    kind: 'Machine Gun',
    category: 'lmg',
    base: 'lmg',
    desc: '1,200 rounds a minute. A wall of lead, if you can hold it.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 34, chest: 24, body: 23 },
    falloff: { start: 22, end: 36, minScale: 0.75 },
    fireInterval: 0.05,
    magSize: 75,
    reserve: 225,
    reloadTime: 4.8,
    reloadEmptyTime: 5.4,
    swapTime: 0.7,
    adsTime: 0.45,
    adsFov: 53,
    hipSpread: 0.06,
    adsSpread: 0.009,
    moveSpread: 0.05,
    recoil: { vertical: 0.0115, horizontal: 0.0105, recovery: 5 },
    moveMultiplier: 0.82,
    range: 150,
    sound: { rate: 1.2, gain: 0.95 },
    stats: { damage: 50, fireRate: 100, range: 62, mobility: 34, handling: 26 },
    attachSlots: LMG_SLOTS,
  },
  tundra: {
    id: 'tundra',
    name: 'Tundra RPK',
    short: 'TUNDRA',
    kind: 'Squad Automatic',
    category: 'lmg',
    base: 'lmg',
    desc: 'Long-barrelled rifle on a 75-round drum. The nimblest MG.',
    slot: P,
    fireMode: 'auto',
    damage: { head: 46, chest: 31, body: 29 },
    falloff: { start: 24, end: 38, minScale: 0.76 },
    fireInterval: 0.1,
    magSize: 75,
    reserve: 150,
    reloadTime: 3.6,
    reloadEmptyTime: 4.2,
    swapTime: 0.58,
    adsTime: 0.34,
    adsFov: 54,
    hipSpread: 0.045,
    adsSpread: 0.005,
    moveSpread: 0.04,
    recoil: { vertical: 0.0125, horizontal: 0.0068, recovery: 6.2 },
    moveMultiplier: 0.88,
    range: 165,
    sound: { base: 'ar', rate: 0.82, gain: 1.1 },
    stats: { damage: 62, fireRate: 70, range: 68, mobility: 52, handling: 46 },
    attachSlots: { ...LMG_SLOTS, mag: ['std', 'fast'] },
  },

  /* ---- Shotgun ------------------------------------------------------------ */
  shotgun: {
    id: 'shotgun',
    name: 'Breacher 12',
    short: 'BREACHER',
    kind: 'Shotgun',
    category: 'shotgun',
    base: 'shotgun',
    desc: '12 gauge pump. Point blank, nothing else comes close.',
    slot: P,
    fireMode: 'pump',
    /** Each shot is `pellets` rays in a cone; damage below is per pellet. */
    pellets: 8,
    pelletSpread: 0.075,
    pelletSpreadAds: 0.055,
    damage: { head: 19, chest: 16, body: 15 },
    falloff: { start: 7, end: 20, minScale: 0.25 },
    fireInterval: 0.85,
    magSize: 6,
    reserve: 30,
    /** Loaded a shell at a time: shellStart, then shellTime per shell. */
    shellStart: 0.3,
    shellTime: 0.42,
    reloadTime: 2.8,
    reloadEmptyTime: 3.2,
    swapTime: 0.5,
    adsTime: 0.24,
    adsFov: 62,
    hipSpread: 0.0,
    adsSpread: 0.0,
    moveSpread: 0.0,
    recoil: { vertical: 0.06, horizontal: 0.012, recovery: 6 },
    moveMultiplier: 0.95,
    range: 45,
    stats: { damage: 92, fireRate: 18, range: 18, mobility: 76, handling: 64 },
    attachSlots: { optic: ['iron', 'reddot', 'holo'], muzzle: ['none', 'suppressor'], under: ['none', 'grip', 'laser'] },
  },

  /* ---- Pistols ------------------------------------------------------------ */
  pistol: {
    id: 'pistol',
    name: 'Kestrel P9',
    short: 'P9',
    kind: 'Pistol',
    category: 'pistol',
    base: 'pistol',
    desc: 'Polymer 9 mm. Light, quick, always there.',
    slot: S,
    fireMode: 'semi',
    damage: { head: 45, chest: 30, body: 30 },
    falloff: { start: 15, end: 25, minScale: 0.7 },
    fireInterval: 0.15,
    magSize: 12,
    reserve: 48,
    reloadTime: 1.15,
    reloadEmptyTime: 1.15,
    swapTime: 0.3,
    adsTime: 0.15,
    adsFov: 65,
    hipSpread: 0.022,
    adsSpread: 0.006,
    moveSpread: 0.015,
    recoil: { vertical: 0.016, horizontal: 0.006, recovery: 9 },
    moveMultiplier: 1.0,
    range: 80,
    stats: { damage: 45, fireRate: 55, range: 32, mobility: 90, handling: 92 },
    attachSlots: PISTOL_SLOTS,
  },
  colonel: {
    id: 'colonel',
    name: 'Colonel 45',
    short: 'COLONEL',
    kind: 'Pistol',
    category: 'pistol',
    base: 'pistol',
    desc: 'Steel-framed .45 single-action. Three to the chest, dead accurate.',
    slot: S,
    fireMode: 'semi',
    damage: { head: 52, chest: 36, body: 34 },
    falloff: { start: 18, end: 28, minScale: 0.7 },
    fireInterval: 0.17,
    magSize: 8,
    reserve: 40,
    reloadTime: 1.25,
    reloadEmptyTime: 1.5,
    swapTime: 0.3,
    adsTime: 0.16,
    adsFov: 64,
    hipSpread: 0.02,
    adsSpread: 0.0035,
    moveSpread: 0.014,
    recoil: { vertical: 0.022, horizontal: 0.006, recovery: 8.5 },
    moveMultiplier: 1.0,
    range: 85,
    sound: { rate: 0.85, gain: 1.08 },
    stats: { damage: 58, fireRate: 46, range: 40, mobility: 90, handling: 88 },
    attachSlots: PISTOL_SLOTS,
  },
  dragoon: {
    id: 'dragoon',
    name: 'Dragoon .50',
    short: 'DRAGOON',
    kind: 'Hand Cannon',
    category: 'pistol',
    base: 'pistol',
    desc: 'Gas-operated .50 hand cannon. Two hits, and a kick like a mule.',
    slot: S,
    fireMode: 'semi',
    damage: { head: 98, chest: 58, body: 54 },
    falloff: { start: 16, end: 30, minScale: 0.65 },
    fireInterval: 0.3,
    magSize: 7,
    reserve: 35,
    reloadTime: 1.7,
    reloadEmptyTime: 2.1,
    swapTime: 0.38,
    adsTime: 0.22,
    adsFov: 62,
    hipSpread: 0.03,
    adsSpread: 0.004,
    moveSpread: 0.022,
    recoil: { vertical: 0.058, horizontal: 0.012, recovery: 6.5 },
    moveMultiplier: 0.98,
    range: 90,
    sound: { base: 'viper', rate: 0.92, gain: 1.1 },
    stats: { damage: 82, fireRate: 22, range: 46, mobility: 84, handling: 62 },
    attachSlots: { optic: ['iron', 'reddot'], muzzle: ['none', 'compensator'], under: ['none', 'laser'], mag: ['std', 'extended'] },
  },
  viper: {
    id: 'viper',
    name: 'Viper .45',
    short: 'VIPER',
    kind: 'Revolver',
    category: 'pistol',
    base: 'viper',
    desc: 'Six-shot revolver. Two body shots, or a head and a body.',
    slot: S,
    fireMode: 'semi',
    // Two body shots, or a head + body.
    damage: { head: 85, chest: 52, body: 52 },
    falloff: { start: 18, end: 32, minScale: 0.65 },
    fireInterval: 0.32,
    magSize: 6,
    reserve: 30,
    reloadTime: 1.8,
    reloadEmptyTime: 1.8,
    swapTime: 0.35,
    adsTime: 0.2,
    adsFov: 62,
    hipSpread: 0.028,
    adsSpread: 0.004,
    moveSpread: 0.02,
    recoil: { vertical: 0.05, horizontal: 0.01, recovery: 7 },
    moveMultiplier: 1.0,
    range: 90,
    stats: { damage: 72, fireRate: 25, range: 45, mobility: 88, handling: 70 },
    attachSlots: { optic: ['iron', 'reddot'], muzzle: ['none', 'compensator'], under: ['none', 'laser'] },
  },
  hornet: {
    id: 'hornet',
    name: 'Hornet MP',
    short: 'HORNET',
    kind: 'Machine Pistol',
    category: 'pistol',
    base: 'hornet',
    desc: 'Full-auto machine pistol with a fore-grip. A backup that sprays.',
    slot: S,
    fireMode: 'auto',
    damage: { head: 26, chest: 18, body: 18 },
    falloff: { start: 10, end: 20, minScale: 0.65 },
    fireInterval: 0.063,
    magSize: 20,
    reserve: 100,
    reloadTime: 1.3,
    reloadEmptyTime: 1.55,
    swapTime: 0.3,
    adsTime: 0.16,
    adsFov: 66,
    hipSpread: 0.04,
    adsSpread: 0.014,
    moveSpread: 0.02,
    recoil: { vertical: 0.0085, horizontal: 0.008, recovery: 9 },
    moveMultiplier: 1.0,
    range: 60,
    stats: { damage: 30, fireRate: 96, range: 22, mobility: 92, handling: 85 },
    attachSlots: { optic: ['iron', 'reddot'], muzzle: ['none', 'suppressor'], under: ['none', 'laser'], mag: ['std', 'extended', 'fast'] },
  },

  /* ---- Launcher ----------------------------------------------------------- */
  rpg: {
    id: 'rpg',
    name: 'Warhead RL',
    short: 'WARHEAD',
    kind: 'Rocket Launcher',
    category: 'launcher',
    base: 'rpg',
    desc: 'Unguided rocket. Clears a room; two shots carried.',
    slot: S,
    fireMode: 'semi',
    /** Fires a rocket the server flies; it bursts on contact (or at maxFlight). */
    projectile: { speed: 52, gravity: 2.5, radius: 6.5, damage: 165, maxFlight: 3 },
    damage: { head: 165, chest: 165, body: 165 },
    falloff: null,
    fireInterval: 1.0,
    magSize: 1,
    reserve: 2,
    reloadTime: 2.6,
    reloadEmptyTime: 2.6,
    swapTime: 0.75,
    adsTime: 0.35,
    adsFov: 55,
    hipSpread: 0.025,
    adsSpread: 0.004,
    moveSpread: 0.02,
    recoil: { vertical: 0.07, horizontal: 0.012, recovery: 4 },
    moveMultiplier: 0.88,
    range: 200,
    stats: { damage: 100, fireRate: 8, range: 80, mobility: 55, handling: 32 },
    attachSlots: {},
  },

  /* ---- Melee -------------------------------------------------------------- */
  knife: {
    id: 'knife',
    name: 'Combat Knife',
    short: 'KNIFE',
    kind: 'Melee',
    category: 'melee',
    base: 'knife',
    slot: SLOTS.MELEE,
    fireMode: 'melee',
    damage: { head: 100, chest: 100, body: 100 },
    falloff: null,
    fireInterval: 0.8,
    magSize: 0,
    reserve: 0,
    swapTime: 0.25,
    adsTime: 0,
    adsFov: 75,
    moveMultiplier: 1.1,
    /** Hit reach, and the distance the lunge will close to get there. */
    range: 2.0,
    lungeRange: 2.5,
    stats: { damage: 100, fireRate: 40, range: 5, mobility: 100, handling: 96 },
    attachSlots: {},
  },
})

/** The family a weapon (or any id) is animated and voiced as. */
export const baseOf = (id) => WEAPONS[id]?.base ?? id

/** Weapon ids in a category, in table order. */
export const weaponsIn = (category) => Object.values(WEAPONS).filter((w) => w.category === category).map((w) => w.id)

export const PRIMARY_OPTIONS = Object.freeze(PRIMARY_CATEGORIES.flatMap(weaponsIn))
export const SECONDARY_OPTIONS = Object.freeze(SECONDARY_CATEGORIES.flatMap(weaponsIn))

/**
 * Seconds between trigger pulls on average: burst guns pause between bursts
 * (bots fire at this rate; the server's fire budget allows bursts through).
 */
export const cycleTime = (w) => (w.burst ? (w.fireInterval * (w.burst - 1) + w.burstDelay) / w.burst : w.fireInterval)

export const EQUIPMENT = Object.freeze({
  frag: {
    id: 'frag',
    name: 'Frag Grenade',
    type: 'lethal',
    desc: 'Cook it, throw it. 3.5 s fuse.',
    count: 1,
    /** Ammo boxes can push you to a second one. */
    maxCount: 2,
    fuse: 3.5,
    damage: 150,
    radius: 7,
    killRadius: 3,
  },
  semtex: {
    id: 'semtex',
    name: 'Semtex',
    type: 'lethal',
    desc: 'Sticks to whatever it hits, players too. 2.4 s fuse.',
    count: 1,
    maxCount: 2,
    fuse: 2.4,
    damage: 150,
    radius: 6.5,
    sticky: true,
  },
  c4: {
    id: 'c4',
    name: 'C4',
    type: 'lethal',
    desc: 'Toss it and set it off when you choose: press again to detonate.',
    count: 1,
    maxCount: 2,
    damage: 190,
    radius: 6.5,
    /** A gentler lob than a grenade; it sticks where it lands. */
    throwSpeed: 9,
    /** Seconds after landing before the detonator works. */
    armTime: 0.35,
  },
  claymore: {
    id: 'claymore',
    name: 'Claymore',
    type: 'lethal',
    desc: 'Planted at your feet, facing out. Anyone walking into its front goes up.',
    count: 1,
    maxCount: 2,
    damage: 200,
    radius: 4.5,
    /** Trips on an enemy within `trigger` metres and `cone` radians either side of its front. */
    trigger: 3.2,
    cone: 0.62,
    /** Seconds before it arms, and from the click to the blast. */
    armTime: 1.0,
    delay: 0.25,
    /** Hurts anywhere close round it too, not only in front. */
    nearRadius: 1.4,
  },
  flash: {
    id: 'flash',
    name: 'Flashbang',
    type: 'tactical',
    desc: 'Blinds and deafens anyone facing it.',
    count: 2,
    fuse: 1.5,
    radius: 12,
    duration: 3,
    lookAwayScale: 0.3,
  },
  smoke: {
    id: 'smoke',
    name: 'Smoke Grenade',
    type: 'tactical',
    desc: 'A thick wall of smoke that hides you for 12 s.',
    count: 1,
    deployDelay: 1,
    radius: 5,
    duration: 12,
    fadeTime: 2,
    /** Safety: a smoke that never settles still pops after this long. */
    maxFlight: 4,
  },
})

/** Throw speed in m/s along the aim direction, plus a little loft. */
export const THROW_SPEED = 16
export const THROW_LOFT = 2.2

export const LETHAL_OPTIONS = Object.freeze(['frag', 'semtex', 'c4', 'claymore'])
export const TACTICAL_OPTIONS = Object.freeze(['flash', 'smoke'])

/** Seconds a shotgun spends racking the pump after loading from empty. */
export const PUMP_RACK_TIME = 0.35

/** How many shells a shell-by-shell reload puts in. */
export const shellsToLoad = (w, mag) => Math.max(1, w.magSize - mag)

/** Seconds to reload `w` from `mag` rounds (shotguns load shell by shell). */
export function reloadDuration(w, mag) {
  if (w.shellTime) return w.shellStart + shellsToLoad(w, mag) * w.shellTime + (mag === 0 ? PUMP_RACK_TIME : 0)
  return mag === 0 ? w.reloadEmptyTime : w.reloadTime
}

/* ---------------------------------------------------------------------------
 * Attachments
 *
 * Each weapon lists which options it accepts per slot (`attachSlots`); the first
 * option is the default. `mods` are applied by `effectiveWeapon()`, on both the
 * server (ammo, damage falloff) and the client (ADS, recoil, sound, visuals).
 * ------------------------------------------------------------------------- */

export const ATTACHMENT_SLOTS = Object.freeze(['optic', 'muzzle', 'under', 'mag'])
export const ATTACHMENT_SLOT_LABELS = Object.freeze({ optic: 'Optic', muzzle: 'Muzzle', under: 'Underbarrel', mag: 'Magazine' })

export const ATTACHMENTS = Object.freeze({
  optic: {
    iron: { id: 'iron', name: 'Iron Sights', desc: 'Factory front post and rear aperture.', mods: {} },
    reddot: {
      id: 'reddot',
      name: 'Red Dot',
      desc: 'Clean red-dot reticle with a touch of zoom. Tighter aim.',
      mods: { adsFovMul: 0.9, adsSpreadMul: 0.8, stats: { handling: 3, range: 4 } },
    },
    holo: {
      id: 'holo',
      name: 'Holo Sight',
      desc: 'Wide ring reticle for fast close-range target pick-up.',
      mods: { adsTimeAdd: -0.04, adsFovMul: 0.96, stats: { handling: 7 } },
    },
    acog: {
      id: 'acog',
      name: 'ACOG 3×',
      desc: '3× prism scope with a lit chevron. For mid range; slower to aim.',
      mods: { adsFovMul: 0.58, adsSpreadMul: 0.7, adsTimeAdd: 0.06, stats: { range: 8, handling: -6, mobility: -2 } },
    },
  },
  muzzle: {
    none: { id: 'none', name: 'Standard', desc: 'Stock muzzle.', mods: {} },
    suppressor: {
      id: 'suppressor',
      name: 'Suppressor',
      desc: 'Quiet shots that never show on enemy minimaps. Damage drops off sooner.',
      mods: { rangeMul: 0.8, quiet: true, stats: { range: -12, mobility: -2 } },
    },
    compensator: {
      id: 'compensator',
      name: 'Compensator',
      desc: 'Vents gas upward to tame vertical recoil.',
      mods: { recoilMul: 0.7, stats: { handling: 6 } },
    },
    brake: {
      id: 'brake',
      name: 'Muzzle Brake',
      desc: 'Side ports cut the sideways kick.',
      mods: { recoilHMul: 0.6, stats: { handling: 4 } },
    },
  },
  under: {
    none: { id: 'none', name: 'None', desc: 'Bare handguard.', mods: {} },
    grip: {
      id: 'grip',
      name: 'Vertical Grip',
      desc: 'Steadier under sustained fire.',
      mods: { recoilMul: 0.86, recoilHMul: 0.85, stats: { handling: 5, mobility: -2 } },
    },
    angled: {
      id: 'angled',
      name: 'Angled Grip',
      desc: 'Brings the gun onto the sights faster.',
      mods: { adsTimeMul: 0.85, stats: { handling: 6 } },
    },
    laser: {
      id: 'laser',
      name: 'Laser Sight',
      desc: 'Much tighter hip-fire. Its beam can give you away.',
      mods: { hipSpreadMul: 0.68, laser: true, stats: { handling: 4 } },
    },
  },
  mag: {
    std: { id: 'std', name: 'Standard Mag', desc: 'Factory magazine.', mods: {} },
    extended: {
      id: 'extended',
      name: 'Extended Mag',
      desc: '+50% rounds per magazine. Slower reloads and aiming.',
      mods: { magMul: 1.5, reloadMul: 1.15, adsTimeAdd: 0.04, stats: { mobility: -4, handling: -8 } },
    },
    fast: {
      id: 'fast',
      name: 'Fast Mag',
      desc: 'Magazines coupled side by side: much quicker reloads.',
      mods: { reloadMul: 0.7, stats: { handling: 3, mobility: -1 } },
    },
  },
})

/** Fills in / corrects a weapon's attachments so only allowed options remain. */
export function sanitizeAttachments(weaponId, att) {
  const allowed = WEAPONS[weaponId]?.attachSlots ?? {}
  const out = {}
  for (const slot of ATTACHMENT_SLOTS) {
    const opts = allowed[slot]
    if (!opts) continue
    const v = att?.[slot]
    out[slot] = opts.includes(v) ? v : opts[0]
  }
  return out
}

const effectiveCache = new Map()

/**
 * A weapon's numbers with its attachments applied. Cached, so it's cheap to call
 * every shot.
 */
export function effectiveWeapon(id, att) {
  const base = WEAPONS[id]
  if (!base) return null
  const a = sanitizeAttachments(id, att)
  const key = `${id}:${a.optic ?? ''}:${a.muzzle ?? ''}:${a.mag ?? ''}:${a.under ?? ''}`
  if (effectiveCache.has(key)) return effectiveCache.get(key)

  let adsFovMul = 1
  let adsSpreadMul = 1
  let adsTimeAdd = 0
  let adsTimeMul = 1
  let hipSpreadMul = 1
  let rangeMul = 1
  let recoilMul = 1
  let recoilHMul = 1
  let magMul = 1
  let reloadMul = 1
  let quiet = false
  let laser = false
  const stats = { ...base.stats }
  for (const slot of ATTACHMENT_SLOTS) {
    const m = a[slot] ? ATTACHMENTS[slot][a[slot]].mods : null
    if (!m) continue
    adsFovMul *= m.adsFovMul ?? 1
    adsSpreadMul *= m.adsSpreadMul ?? 1
    adsTimeAdd += m.adsTimeAdd ?? 0
    adsTimeMul *= m.adsTimeMul ?? 1
    hipSpreadMul *= m.hipSpreadMul ?? 1
    rangeMul *= m.rangeMul ?? 1
    recoilMul *= m.recoilMul ?? 1
    recoilHMul *= m.recoilHMul ?? 1
    magMul *= m.magMul ?? 1
    reloadMul *= m.reloadMul ?? 1
    quiet ||= Boolean(m.quiet)
    laser ||= Boolean(m.laser)
    for (const [k, v] of Object.entries(m.stats ?? {})) stats[k] = Math.max(0, Math.min(100, stats[k] + v))
  }

  const w = {
    ...base,
    att: a,
    quiet,
    laser,
    magSize: Math.round(base.magSize * magMul),
    reserve: Math.round(base.reserve * magMul),
    reloadTime: (base.reloadTime ?? 0) * reloadMul,
    reloadEmptyTime: (base.reloadEmptyTime ?? 0) * reloadMul,
    adsTime: base.adsTime > 0 ? Math.max(0.08, (base.adsTime + adsTimeAdd) * adsTimeMul) : 0,
    adsFov: base.scoped ? base.adsFov : base.adsFov * adsFovMul,
    hipSpread: (base.hipSpread ?? 0) * hipSpreadMul,
    adsSpread: (base.adsSpread ?? 0) * adsSpreadMul,
    recoil: base.recoil && {
      ...base.recoil,
      vertical: base.recoil.vertical * recoilMul,
      horizontal: base.recoil.horizontal * (0.5 + recoilMul * 0.5) * recoilHMul,
    },
    falloff: base.falloff && { ...base.falloff, start: base.falloff.start * rangeMul, end: base.falloff.end * rangeMul },
    stats,
  }
  effectiveCache.set(key, w)
  return w
}

export const PRESET_CLASSES = Object.freeze([
  Object.freeze({
    id: 'preset-assault',
    name: 'ASSAULT',
    primary: 'ar',
    primaryAtt: { optic: 'reddot', muzzle: 'none', mag: 'std' },
    secondary: 'pistol',
    secondaryAtt: {},
    lethal: 'frag',
    tactical: 'flash',
    preset: true,
  }),
  Object.freeze({
    id: 'preset-cqb',
    name: 'CLOSE QUARTERS',
    primary: 'smg',
    primaryAtt: { optic: 'holo', muzzle: 'none', mag: 'std' },
    secondary: 'pistol',
    secondaryAtt: {},
    lethal: 'semtex',
    tactical: 'smoke',
    preset: true,
  }),
  Object.freeze({
    id: 'preset-recon',
    name: 'RECON',
    primary: 'kite',
    primaryAtt: { muzzle: 'suppressor', mag: 'std' },
    secondary: 'colonel',
    secondaryAtt: {},
    lethal: 'claymore',
    tactical: 'smoke',
    preset: true,
  }),
])

/**
 * Primary attachments bots carry, per weapon. A fixed list rather than random
 * picks, so the client can build every one of these guns ahead of time (in idle
 * moments in the menus): building a new gun + attachment combination
 * mid-match is a visible hitch.
 */
export const BOT_KITS = Object.freeze({
  ar: [
    { optic: 'reddot', muzzle: 'none' },
    { optic: 'holo', muzzle: 'suppressor', under: 'grip' },
  ],
  volk: [{ optic: 'iron', muzzle: 'brake' }],
  talon: [{ optic: 'acog', muzzle: 'none', under: 'grip' }],
  strix: [{ optic: 'reddot', muzzle: 'none' }],
  harrier: [{ optic: 'holo', muzzle: 'compensator', under: 'angled' }],
  smg: [
    { optic: 'holo', muzzle: 'none' },
    { optic: 'reddot', muzzle: 'suppressor' },
  ],
  wasp: [{ optic: 'reddot', muzzle: 'none', under: 'laser' }],
  mako: [{ optic: 'reddot', muzzle: 'none' }],
  ripper: [{ optic: 'holo', muzzle: 'compensator' }],
  rattler: [{ optic: 'iron', muzzle: 'none' }],
  lmg: [{ optic: 'reddot', muzzle: 'none' }],
  mule: [{ optic: 'iron', muzzle: 'none' }],
  ram: [{ optic: 'holo', muzzle: 'brake' }],
  buzzsaw: [{ optic: 'iron', muzzle: 'none' }],
  tundra: [{ optic: 'acog', muzzle: 'none' }],
  sniper: [{ muzzle: 'none' }, { muzzle: 'suppressor' }],
  kite: [{ muzzle: 'none' }],
  ironwood: [{ muzzle: 'none' }],
  sable: [{ muzzle: 'none' }],
})

export const CUSTOM_CLASS_COUNT = 5
export const CLASS_NAME_MAX = 16

/**
 * Validates a client-supplied class: primary + its attachments, secondary + its
 * attachments, the lethal and the tactical. Melee is fixed by design, so it's
 * filled in here rather than accepted from the wire.
 *
 * @returns {{name:string, primary:string, primaryAtt:object, secondary:string,
 *            secondaryAtt:object, melee:string, lethal:string, tactical:string} | null}
 */
export function sanitizeClass(data) {
  if (!data || typeof data !== 'object') return null
  if (!PRIMARY_OPTIONS.includes(data.primary)) return null
  if (!TACTICAL_OPTIONS.includes(data.tactical)) return null
  const secondary = SECONDARY_OPTIONS.includes(data.secondary) ? data.secondary : 'pistol'
  const lethal = LETHAL_OPTIONS.includes(data.lethal) ? data.lethal : 'frag'
  const name =
    String(data.name ?? 'CLASS')
      .replace(/[^\w .-]/g, '')
      .trim()
      .slice(0, CLASS_NAME_MAX)
      .toUpperCase() || 'CLASS'
  return {
    name,
    primary: data.primary,
    primaryAtt: sanitizeAttachments(data.primary, data.primaryAtt),
    secondary,
    secondaryAtt: sanitizeAttachments(secondary, data.secondaryAtt),
    melee: 'knife',
    lethal,
    tactical: data.tactical,
  }
}

export const DEFAULT_CLASS = sanitizeClass(PRESET_CLASSES[0])

/** Attachments a class has fitted to a given weapon id. */
export function attachmentsFor(cls, weaponId) {
  if (!cls) return {}
  if (weaponId === cls.primary) return cls.primaryAtt ?? {}
  if (weaponId === cls.secondary) return cls.secondaryAtt ?? {}
  return {}
}

/** Damage after range falloff (attachments can shorten the falloff range). */
export function damageAt(weaponId, zone, distance, att) {
  const w = effectiveWeapon(weaponId, att)
  if (!w) return 0
  const base = w.damage[zone] ?? w.damage.body
  const f = w.falloff
  if (!f || distance <= f.start) return base
  if (distance >= f.end) return Math.round(base * f.minScale)
  const t = (distance - f.start) / (f.end - f.start)
  return Math.round(base * (1 - t * (1 - f.minScale)))
}

/** Weapon id held in a given slot for a class. */
export function weaponForSlot(cls, slot) {
  if (slot === SLOTS.PRIMARY) return cls.primary
  if (slot === SLOTS.SECONDARY) return cls.secondary
  return cls.melee
}

/**
 * Compact loadout string synced to other players so they can draw your guns with
 * the right attachments: "ar.reddot.suppressor.std.grip|viper.iron.none.."
 */
export function kitString(cls) {
  if (!cls) return ''
  const part = (id, att) => [id, att?.optic ?? '', att?.muzzle ?? '', att?.mag ?? '', att?.under ?? ''].join('.')
  return `${part(cls.primary, cls.primaryAtt)}|${part(cls.secondary, cls.secondaryAtt)}`
}

/** Inverse of kitString: weapon id -> attachments. */
export function parseKit(kit) {
  const out = {}
  for (const part of String(kit || '').split('|')) {
    const [id, optic, muzzle, mag, under] = part.split('.')
    if (!WEAPONS[id]) continue
    out[id] = sanitizeAttachments(id, { optic, muzzle, mag, under })
  }
  return out
}
