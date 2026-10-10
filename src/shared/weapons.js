/**
 * Weapon + equipment tables, attachments and the loadout ("class") rules.
 *
 * The server is the authority for every number in here: damage is always computed
 * server-side from these tables, never trusted from a client message.
 */

export const SLOTS = Object.freeze({ PRIMARY: 1, SECONDARY: 2, MELEE: 3 })

export const WEAPONS = Object.freeze({
  ar: {
    id: 'ar',
    name: 'VX-7 Ranger',
    short: 'VX-7',
    kind: 'Assault Rifle',
    slot: SLOTS.PRIMARY,
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
    attachSlots: {
      optic: ['reddot', 'iron', 'holo'],
      muzzle: ['none', 'suppressor', 'compensator'],
      mag: ['std', 'extended'],
    },
  },
  sniper: {
    id: 'sniper',
    name: 'Longhaul .50',
    short: 'LONGHAUL',
    kind: 'Sniper Rifle',
    slot: SLOTS.PRIMARY,
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
    attachSlots: { muzzle: ['none', 'suppressor'], mag: ['std', 'extended'] },
  },
  pistol: {
    id: 'pistol',
    name: 'Kestrel P9',
    short: 'P9',
    kind: 'Pistol',
    slot: SLOTS.SECONDARY,
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
    attachSlots: { optic: ['iron', 'reddot'], muzzle: ['none', 'suppressor'], mag: ['std', 'extended'] },
  },
  viper: {
    id: 'viper',
    name: 'Viper .45',
    short: 'VIPER',
    kind: 'Revolver',
    slot: SLOTS.SECONDARY,
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
    attachSlots: { optic: ['iron', 'reddot'], muzzle: ['none', 'compensator'] },
  },
  hornet: {
    id: 'hornet',
    name: 'Hornet MP',
    short: 'HORNET',
    kind: 'Machine Pistol',
    slot: SLOTS.SECONDARY,
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
    attachSlots: { optic: ['iron', 'reddot'], muzzle: ['none', 'suppressor'], mag: ['std', 'extended'] },
  },
  knife: {
    id: 'knife',
    name: 'Combat Knife',
    short: 'KNIFE',
    kind: 'Melee',
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

export const EQUIPMENT = Object.freeze({
  frag: {
    id: 'frag',
    name: 'Frag Grenade',
    type: 'lethal',
    count: 1,
    /** Ammo boxes can push you to a second frag. */
    maxCount: 2,
    fuse: 3.5,
    damage: 150,
    radius: 7,
    killRadius: 3,
  },
  flash: {
    id: 'flash',
    name: 'Flashbang',
    type: 'tactical',
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

export const PRIMARY_OPTIONS = Object.freeze(['ar', 'sniper'])
export const SECONDARY_OPTIONS = Object.freeze(['pistol', 'viper', 'hornet'])
export const TACTICAL_OPTIONS = Object.freeze(['flash', 'smoke'])

/* ---------------------------------------------------------------------------
 * Attachments
 *
 * Each weapon lists which options it accepts per slot (`attachSlots`); the first
 * option is the default. `mods` are applied by `effectiveWeapon()`, on both the
 * server (ammo, damage falloff) and the client (ADS, recoil, sound, visuals).
 * ------------------------------------------------------------------------- */

export const ATTACHMENT_SLOTS = Object.freeze(['optic', 'muzzle', 'mag'])
export const ATTACHMENT_SLOT_LABELS = Object.freeze({ optic: 'Optic', muzzle: 'Muzzle', mag: 'Magazine' })

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
  },
  mag: {
    std: { id: 'std', name: 'Standard Mag', desc: 'Factory magazine.', mods: {} },
    extended: {
      id: 'extended',
      name: 'Extended Mag',
      desc: '+50% rounds per magazine. Slower reloads and aiming.',
      mods: { magMul: 1.5, reloadMul: 1.15, adsTimeAdd: 0.04, stats: { mobility: -4, handling: -8 } },
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
  const key = `${id}:${a.optic ?? ''}:${a.muzzle ?? ''}:${a.mag ?? ''}`
  if (effectiveCache.has(key)) return effectiveCache.get(key)

  let adsFovMul = 1
  let adsSpreadMul = 1
  let adsTimeAdd = 0
  let rangeMul = 1
  let recoilMul = 1
  let magMul = 1
  let reloadMul = 1
  let quiet = false
  const stats = { ...base.stats }
  for (const slot of ATTACHMENT_SLOTS) {
    const m = a[slot] ? ATTACHMENTS[slot][a[slot]].mods : null
    if (!m) continue
    adsFovMul *= m.adsFovMul ?? 1
    adsSpreadMul *= m.adsSpreadMul ?? 1
    adsTimeAdd += m.adsTimeAdd ?? 0
    rangeMul *= m.rangeMul ?? 1
    recoilMul *= m.recoilMul ?? 1
    magMul *= m.magMul ?? 1
    reloadMul *= m.reloadMul ?? 1
    quiet ||= Boolean(m.quiet)
    for (const [k, v] of Object.entries(m.stats ?? {})) stats[k] = Math.max(0, Math.min(100, stats[k] + v))
  }

  const w = {
    ...base,
    att: a,
    quiet,
    magSize: Math.round(base.magSize * magMul),
    reserve: Math.round(base.reserve * magMul),
    reloadTime: (base.reloadTime ?? 0) * reloadMul,
    reloadEmptyTime: (base.reloadEmptyTime ?? 0) * reloadMul,
    adsTime: base.adsTime > 0 ? Math.max(0.08, base.adsTime + adsTimeAdd) : 0,
    adsFov: base.scoped ? base.adsFov : base.adsFov * adsFovMul,
    adsSpread: (base.adsSpread ?? 0) * adsSpreadMul,
    recoil: base.recoil && {
      ...base.recoil,
      vertical: base.recoil.vertical * recoilMul,
      horizontal: base.recoil.horizontal * (0.5 + recoilMul * 0.5),
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
    tactical: 'flash',
    preset: true,
  }),
  Object.freeze({
    id: 'preset-recon',
    name: 'RECON',
    primary: 'sniper',
    primaryAtt: { muzzle: 'none', mag: 'std' },
    secondary: 'viper',
    secondaryAtt: {},
    tactical: 'smoke',
    preset: true,
  }),
])

export const CUSTOM_CLASS_COUNT = 5
export const CLASS_NAME_MAX = 16

/**
 * Validates a client-supplied class: primary + its attachments, secondary + its
 * attachments, and the tactical. Melee and lethal are fixed by design, so they are
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
    lethal: 'frag',
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
 * the right attachments: "ar.reddot.suppressor.std|viper.iron.none."
 */
export function kitString(cls) {
  if (!cls) return ''
  const part = (id, att) => [id, att?.optic ?? '', att?.muzzle ?? '', att?.mag ?? ''].join('.')
  return `${part(cls.primary, cls.primaryAtt)}|${part(cls.secondary, cls.secondaryAtt)}`
}

/** Inverse of kitString: weapon id -> attachments. */
export function parseKit(kit) {
  const out = {}
  for (const part of String(kit || '').split('|')) {
    const [id, optic, muzzle, mag] = part.split('.')
    if (!WEAPONS[id]) continue
    out[id] = sanitizeAttachments(id, { optic, muzzle, mag })
  }
  return out
}
