import { Room } from 'colyseus'

import { botHearNoise, BOT_NAMES, createBotBrain, resetBotBrain, tickBot } from '../game/bots.js'
import { getNavGraph, MapWorld } from '../game/physics.js'
import {
  eyeHeightFor,
  MATCH_END_DURATION,
  MATCH_RULES,
  MAX_LEGAL_SPEED,
  fallDamage,
  MAX_PLAYERS,
  PATCH_RATE_MS,
  ROOM_CODE_LENGTH,
  PLAYER,
  PLAYER_STATES,
  RESPAWN_DELAY,
  SPAWN_PROTECTION,
  stanceOf,
  TEAM_SELECT_TIMEOUT,
  TEAMS,
  WALK_GROUPS,
} from '../shared/constants.js'
import { chestPoint, headPoint, hitboxFor, rayHitbox, raySphere } from '../shared/hitbox.js'
import { AMMO_CRATE, KILL_Y, MAP_HALF, MAP_NAME, SPAWNS } from '../shared/map.js'
import { clamp, dist2, dist3 } from '../shared/math.js'
import {
  attachmentsFor,
  damageAt,
  DEFAULT_CLASS,
  effectiveWeapon,
  EQUIPMENT,
  kitString,
  sanitizeClass,
  SECONDARY_OPTIONS,
  THROW_LOFT,
  THROW_SPEED,
  WEAPONS,
} from '../shared/weapons.js'
import { DustlineState, GrenadeState, PickupState, PlayerState, SmokeState } from './schema.js'

const { SELECTING, DEPLOYING, ALIVE, DEAD } = PLAYER_STATES

/** How much position history to keep for validating hits against a moving target. */
const HISTORY_MS = 450
const PICKUP_TTL_MS = 25000
const MAX_PICKUPS = 10

const EQUIP_KEYS = ['hatId', 'backId', 'skinId', 'headId', 'armLId', 'armRId', 'legLId', 'legRId', 'torsoId']
const PROPORTION_KEYS = ['height', 'shoulderWidth', 'armLength', 'legOffsetX', 'torsoScaleX', 'neckHeight', 'headScale']

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const vec3 = (v) => (Array.isArray(v) && v.length === 3 && v.every(isNum) ? [v[0], v[1], v[2]] : null)
const unit3 = (v) => {
  const a = vec3(v)
  if (!a) return null
  const l = Math.hypot(a[0], a[1], a[2])
  return l > 1e-6 ? [a[0] / l, a[1] / l, a[2] / l] : null
}
const otherTeam = (t) => (t === TEAMS.ALPHA ? TEAMS.BRAVO : TEAMS.ALPHA)

function sanitizeName(name) {
  const clean = String(name ?? '')
    .replace(/[^\w \-.]/g, '')
    .trim()
    .slice(0, 16)
  return clean || `Player${Math.floor(100 + Math.random() * 900)}`
}

function sanitizeAvatar(avatar) {
  if (!avatar || typeof avatar !== 'object') return ''
  const equipped = {}
  for (const key of EQUIP_KEYS) {
    const v = avatar.equipped?.[key]
    if (v !== undefined && v !== null && String(v).length <= 40) equipped[key] = String(v)
  }
  const proportions = {}
  for (const key of PROPORTION_KEYS) {
    const n = Number(avatar.proportions?.[key])
    if (Number.isFinite(n)) proportions[key] = clamp(n, 0.5, 1.6)
  }
  return JSON.stringify({ equipped, proportions })
}

const eyeOf = (p) => [p.x, p.y + eyeHeightFor(stanceOf(p)), p.z]

/** Private-room keys: short, upper-case, no look-alike characters (0/O, 1/I). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const activeCodes = new Set()
function newRoomCode() {
  for (;;) {
    let code = ''
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    if (!activeCodes.has(code)) {
      activeCodes.add(code)
      return code
    }
  }
}

export class DustlineRoom extends Room {
  maxClients = MAX_PLAYERS
  patchRate = PATCH_RATE_MS
  maxMessagesPerSecond = 160

  onCreate(options) {
    /** Zero point for the per-player position timestamps (`mt`). */
    this.t0 = Date.now()
    this.mode = options?.mode === 'ffa' ? 'ffa' : 'tdm'
    // Private rooms: created with a key, hidden from matchmaking, joined by key only.
    this.isPrivate = Boolean(options?.private)
    const maxPlayers = this.isPrivate ? clamp(Math.round(Number(options?.maxPlayers) || MAX_PLAYERS), 2, MAX_PLAYERS) : MAX_PLAYERS
    this.maxClients = maxPlayers
    this.botsEnabled = !this.isPrivate || options?.bots !== false
    // MATCH_TIME_LIMIT / MATCH_SCORE_LIMIT env vars shorten matches for testing.
    this.rules = {
      ...MATCH_RULES[this.mode],
      ...(Number(process.env.MATCH_TIME_LIMIT) > 0 && { timeLimit: Number(process.env.MATCH_TIME_LIMIT) }),
      ...(Number(process.env.MATCH_SCORE_LIMIT) > 0 && { scoreLimit: Number(process.env.MATCH_SCORE_LIMIT) }),
    }

    if (this.isPrivate) {
      // Teams split the room evenly; bots (if on) fill up to the player cap.
      this.rules.teamSize = Math.ceil(maxPlayers / 2)
      this.rules.botFill = maxPlayers
      this.roomCode = newRoomCode()
      this.roomId = this.roomCode
      this.setPrivate(true)
    }

    const state = new DustlineState()
    state.mode = this.mode
    state.roomCode = this.roomCode ?? ''
    state.maxPlayers = maxPlayers
    // Private rooms warm up (no clock, no score) until the host starts the match.
    if (this.isPrivate) state.phase = 'warmup'
    state.scoreLimit = this.rules.scoreLimit
    state.timeLeft = this.rules.timeLimit
    this.state = state

    this.mapWorld = new MapWorld()
    this.nav = getNavGraph(this.mapWorld)
    /** id -> server-only bookkeeping (loadout, ammo, timers, bot brain...). */
    this.meta = new Map()
    /** grenade id -> { body, kind, owner, ownerTeam, explodeAt, landedAt, spawnedAt } */
    this.grenadeBodies = new Map()
    this.pickupExpiry = new Map()
    this.uid = 0
    this.joinCounter = 0
    this.botNameCursor = Math.floor(Math.random() * BOT_NAMES.length)

    this.setMetadata({ mode: this.mode, map: MAP_NAME, private: this.isPrivate })
    this.registerMessages()
    this.setTimestep((dtMs) => this.tick(dtMs), 1000 / 30)
    this.clock.setInterval(() => this.everySecond(), 1000)
    this.clock.setInterval(() => this.sendPings(), 2000)
    this.rebalanceBots()
  }

  onDispose() {
    if (this.roomCode) activeCodes.delete(this.roomCode)
    this.mapWorld?.dispose()
  }

  /* -------------------------------------------------------------------------
   * Joining / leaving
   * ----------------------------------------------------------------------- */

  onJoin(client, options) {
    const p = new PlayerState()
    p.id = client.sessionId
    p.name = sanitizeName(options?.name)
    p.avatar = sanitizeAvatar(options?.avatar)
    p.joinedAt = Date.now()
    p.team = this.mode === 'ffa' ? 'ffa' : ''
    p.state = this.mode === 'ffa' ? DEPLOYING : SELECTING

    const meta = this.createMeta(p, client)
    meta.pendingClass = sanitizeClass(options?.classData)
    this.state.players.set(p.id, p)
    if (this.isPrivate && !this.state.host) this.state.host = p.id

    client.send('welcome', { id: p.id, mode: this.mode, map: MAP_NAME, code: this.roomCode ?? '', max: this.maxClients })
    if (this.mode === 'tdm') {
      meta.teamTimer = this.clock.setTimeout(
        () => this.assignTeam(p, 'auto', 'timeout'),
        TEAM_SELECT_TIMEOUT * 1000,
      )
      client.send('team_select', { timeout: TEAM_SELECT_TIMEOUT })
    } else {
      this.rebalanceBots()
    }
  }

  onLeave(client) {
    const p = this.state.players.get(client.sessionId)
    if (!p) return
    const meta = this.meta.get(p.id)
    meta?.teamTimer?.clear()
    meta?.reloadTimer?.clear()
    this.state.players.delete(p.id)
    this.meta.delete(p.id)
    if (this.state.host === p.id) {
      // Hand the room to whoever has been here longest.
      const next = [...this.state.players.values()]
        .filter((o) => !o.isBot)
        .sort((a, b) => this.meta.get(a.id).joinOrder - this.meta.get(b.id).joinOrder)[0]
      this.state.host = next?.id ?? ''
    }
    this.rebalanceBots()
  }

  /**
   * Server time to stamp a move with. Clients send their own clock (`ct`) with
   * each move; mapping it through the smallest seen (arrival - ct) gap strips
   * the upload jitter, so others see evenly spaced steps. Bounded to stay
   * increasing and never ahead of now.
   */
  moveTime(meta, ct, now) {
    let t = now
    if (isNum(ct)) {
      const gap = now - ct
      if (meta.ctGap === undefined || gap < meta.ctGap || gap - meta.ctGap > 1000) meta.ctGap = gap
      else meta.ctGap += (gap - meta.ctGap) * 0.01
      t = Math.min(now, ct + meta.ctGap)
    }
    t = Math.max(t, (meta.lastMt ?? 0) + 1)
    meta.lastMt = t
    return t
  }

  /** True while players can fight: the match itself, or a private room's warm-up. */
  inPlay() {
    return this.state.phase === 'playing' || this.state.phase === 'warmup'
  }

  /** Host only, from warm-up: scores wiped, everyone back to the deploy screen, clock on. */
  onStartMatch(_client, p) {
    if (this.state.phase !== 'warmup' || p.id !== this.state.host) return
    for (const id of [...this.grenadeBodies.keys()]) this.removeGrenade(id)
    this.state.smokes.clear()
    this.resetMatch()
    this.broadcast('match_start', {})
  }

  createMeta(p, client) {
    const meta = {
      client,
      activeClass: null,
      pendingClass: null,
      ammo: {},
      lethal: 0,
      tactical: 0,
      fireCredits: {},
      meleeReadyAt: 0,
      lastMoveAt: Date.now(),
      lastCorrectAt: 0,
      history: [],
      respawnAt: 0,
      protectedUntil: 0,
      lastDamageAt: 0,
      lastAttacker: null,
      regenAcc: 0,
      ammoCrateAt: 0,
      reloadUntil: 0,
      reloadTimer: null,
      joinOrder: ++this.joinCounter,
      teamTimer: null,
      bot: null,
      botMoving: false,
    }
    this.meta.set(p.id, meta)
    return meta
  }

  /* -------------------------------------------------------------------------
   * Messages
   * ----------------------------------------------------------------------- */

  registerMessages() {
    const withPlayer = (fn) => (client, msg) => {
      const p = this.state.players.get(client.sessionId)
      const meta = p && this.meta.get(p.id)
      if (p && meta) fn.call(this, client, p, meta, msg ?? {})
    }
    this.onMessage('m', withPlayer(this.onMove))
    this.onMessage('fire', withPlayer(this.onFire))
    this.onMessage('sw', withPlayer(this.onSwitch))
    this.onMessage('rl', withPlayer(this.onReload))
    this.onMessage('ml', withPlayer(this.onMelee))
    this.onMessage('th', withPlayer(this.onThrow))
    this.onMessage('choose_team', withPlayer(this.onChooseTeam))
    this.onMessage('set_class', withPlayer(this.onSetClass))
    this.onMessage('spawn_request', withPlayer(this.onSpawnRequest))
    this.onMessage('avatar', withPlayer((_c, p, _m, msg) => (p.avatar = sanitizeAvatar(msg))))
    this.onMessage('start_match', withPlayer(this.onStartMatch))
    this.onMessage('pong', withPlayer((_c, p, _m, msg) => {
      if (isNum(msg.t)) p.ping = clamp(Math.round(Date.now() - msg.t), 0, 999)
    }))
    this.onMessage('*', () => {})
  }

  onMove(client, p, meta, msg) {
    if (p.state !== ALIVE || msg.s !== p.spawnSeq) return
    const pos = vec3(msg.p)
    if (!pos) return
    const now = Date.now()
    const dt = clamp((now - meta.lastMoveAt) / 1000, 0.02, 1.0)
    meta.lastMoveAt = now

    // Generous bounds: this catches teleports and speed hacks, not honest jitter.
    const horizontal = dist2(p.x, p.z, pos[0], pos[2])
    const maxHorizontal = MAX_LEGAL_SPEED * dt * 1.4 + 0.8
    const rise = pos[1] - p.y
    const maxRise = 12 * dt + 0.8
    const outside = Math.abs(pos[0]) > MAP_HALF + 1 || Math.abs(pos[2]) > MAP_HALF + 1 || pos[1] < KILL_Y - 1 || pos[1] > 16
    if (horizontal > maxHorizontal || rise > maxRise || outside || this.throughWall(p, pos)) {
      if (now - meta.lastCorrectAt > 250) {
        meta.lastCorrectAt = now
        client.send('correct', { p: [p.x, p.y, p.z] })
      }
      return
    }
    p.x = pos[0]
    p.y = pos[1]
    p.z = pos[2]
    p.mt = this.moveTime(meta, msg.ct, now) - this.t0
    if (isNum(msg.yaw)) p.yaw = msg.yaw
    if (isNum(msg.pitch)) p.pitch = clamp(msg.pitch, -1.56, 1.56)
    const f = msg.f | 0
    p.crouch = Boolean(f & 1)
    p.ads = Boolean(f & 2)
    p.sprint = Boolean(f & 4)
    p.climbing = Boolean(f & 8)
    p.prone = Boolean(f & 16) && !p.climbing
    p.slide = Boolean(f & 32) && !p.prone
    this.trackFall(p, meta)
    this.checkPickups(p, meta, now)
  }

  /**
   * Fall damage, decided here rather than trusted to the client: remember the
   * highest point since the player last stood on something; when they're back
   * on the ground, the drop from there decides the damage. Ladders reset it.
   */
  trackFall(p, meta) {
    if (p.climbing || meta.fallPeak === undefined) {
      meta.fallPeak = p.y
      return
    }
    if (p.y > meta.fallPeak) meta.fallPeak = p.y
    if (!this.mapWorld.onGround(p.x, p.y, p.z)) return
    const drop = meta.fallPeak - p.y
    meta.fallPeak = p.y
    const dmg = fallDamage(drop)
    if (dmg > 0) {
      meta.client?.send('fell', { dmg, h: Math.round(drop * 10) / 10 })
      this.applyDamage(p, dmg, null, 'fall')
    }
  }

  /**
   * Noclip guard: a move is rejected only if BOTH a knee-height and a head-height
   * ray from the old to the new position hit solid map. Low cover (crates, railings)
   * blocks just the knee ray, so jumping onto things never rubber-bands.
   */
  throughWall(p, pos) {
    const dx = pos[0] - p.x
    const dz = pos[2] - p.z
    if (dx * dx + dz * dz < 0.0025) return false
    const blocked = (h) =>
      !this.mapWorld.clearLine([p.x, p.y + h, p.z], [pos[0], pos[1] + h, pos[2]], 0.02, WALK_GROUPS)
    return blocked(0.5) && blocked(1.45)
  }

  onFire(client, p, meta, msg) {
    if (p.state !== ALIVE || !this.inPlay()) return
    const w = this.weaponOf(meta, p.weapon)
    if (!w || w.fireMode === 'melee' || msg.w !== p.weapon) return
    const now = Date.now()
    if (now < meta.reloadUntil) return
    if (!this.takeFireCredit(meta, w, now)) return
    const ammo = meta.ammo[w.id]
    if (!ammo || ammo.mag <= 0) return
    ammo.mag -= 1
    meta.protectedUntil = 0

    const eye = eyeOf(p)
    let o = vec3(msg.o)
    const d = unit3(msg.d)
    if (!d) return
    if (!o || dist3(o, eye) > 1.8) o = eye

    let e = vec3(msg.e)
    if (!e || dist3(o, e) > w.range) e = [o[0] + d[0] * 60, o[1] + d[1] * 60, o[2] + d[2] * 60]
    const hit = typeof msg.h === 'string' && this.resolveHit(p, w, o, d, msg.h, msg.z, now)
    // `b`: the shot drew blood (hit puff instead of dust); `q`: suppressed.
    this.broadcast('shot', { id: p.id, w: w.id, o, e, b: hit, q: w.quiet }, { except: client })
    this.noise(p, now, w.quiet)
  }

  /** Leaky bucket: sustained fire is capped at the weapon's rate, short jitter bursts pass. */
  takeFireCredit(meta, w, now) {
    const b = meta.fireCredits[w.id] ?? (meta.fireCredits[w.id] = { c: 2.5, t: now })
    b.c = Math.min(2.5, b.c + (now - b.t) / (w.fireInterval * 1000))
    b.t = now
    if (b.c < 1) return false
    b.c -= 1
    return true
  }

  resolveHit(shooter, w, o, d, targetId, zoneClaim, now) {
    const target = this.state.players.get(targetId)
    if (!target || target === shooter || target.state !== ALIVE || !this.isEnemy(shooter, target)) return false
    const tm = this.meta.get(target.id)
    if (!tm || now < tm.protectedUntil) return false

    // The shooter saw the target ~100 ms+ in the past; accept a hit against any
    // recent position, with a little slack on the hitbox.
    const samples = [...tm.history, { x: target.x, y: target.y, z: target.z, c: stanceOf(target), w: target.yaw }]
    let best = null
    for (const s of samples) {
      const r = rayHitbox(o, d, hitboxFor(s.x, s.y, s.z, s.c, s.w), 0.3)
      if (r && (!best || r.t < best.t)) best = r
    }
    if (!best || best.t > w.range) return false

    let zone = ['head', 'chest', 'body'].includes(zoneClaim) ? zoneClaim : best.zone
    if (zone === 'head') {
      const headOk = samples.some((s) => raySphere(o, d, headPoint(s.x, s.y, s.z, s.c, s.w), 0.55) !== Infinity)
      if (!headOk) zone = 'chest'
    }

    const wall = this.mapWorld.raycast(o, d, best.t)
    if (wall !== null && wall < best.t - 0.35) return false

    const dmg = damageAt(w.id, zone, best.t, w.att)
    this.applyDamage(target, dmg, shooter, w.id, { headshot: zone === 'head', from: [shooter.x, shooter.z] })
    return true
  }

  onSwitch(_client, p, meta, msg) {
    if (p.state !== ALIVE) return
    const cls = meta.activeClass
    if (!cls) return
    if (msg.w === cls.primary || msg.w === cls.secondary || msg.w === 'knife') {
      p.weapon = msg.w
      this.cancelReload(meta)
    }
  }

  onReload(_client, p, meta) {
    if (p.state !== ALIVE) return
    const w = this.weaponOf(meta, p.weapon)
    const ammo = meta.ammo[w?.id]
    const now = Date.now()
    if (!ammo || ammo.mag >= w.magSize || ammo.reserve <= 0 || meta.reloadUntil > now) return
    // A touch faster than the client so a shot fired right as the client's reload
    // ends is never rejected.
    const ms = (ammo.mag === 0 ? w.reloadEmptyTime : w.reloadTime) * 1000 * 0.85
    meta.reloadUntil = now + ms
    this.broadcast('act', { id: p.id, a: 'reload', d: Math.round(ms / 0.85), w: w.id, e: ammo.mag === 0 }, { except: _client })
    meta.reloadTimer = this.clock.setTimeout(() => {
      const take = Math.min(w.magSize - ammo.mag, ammo.reserve)
      ammo.mag += take
      ammo.reserve -= take
      meta.reloadUntil = 0
      meta.reloadTimer = null
    }, ms)
  }

  cancelReload(meta) {
    meta.reloadTimer?.clear()
    meta.reloadTimer = null
    meta.reloadUntil = 0
  }

  onMelee(client, p, meta, msg) {
    if (p.state !== ALIVE || !this.inPlay()) return
    const now = Date.now()
    if (now < meta.meleeReadyAt) return
    meta.meleeReadyAt = now + WEAPONS.knife.fireInterval * 1000 * 0.85
    meta.protectedUntil = 0
    this.broadcast('melee', { id: p.id }, { except: client })

    if (typeof msg.h !== 'string') return
    const target = this.state.players.get(msg.h)
    if (!target || target === p || target.state !== ALIVE || !this.isEnemy(p, target)) return
    const tm = this.meta.get(target.id)
    if (now < tm.protectedUntil) return
    const samples = [...tm.history, { x: target.x, y: target.y, z: target.z }]
    const reach = WEAPONS.knife.lungeRange + 0.9
    const near = samples.some((s) => dist2(p.x, p.z, s.x, s.z) <= reach && Math.abs(s.y - p.y) < 1.6)
    if (!near) return
    if (!this.mapWorld.clearLine(eyeOf(p), chestPoint(target.x, target.y, target.z, stanceOf(target), target.yaw), 0.2)) return
    this.applyDamage(target, WEAPONS.knife.damage.body, p, 'knife', { from: [p.x, p.z] })
  }

  onThrow(_client, p, meta, msg) {
    if (p.state !== ALIVE || !this.inPlay()) return
    const kind = msg.k
    if (kind === 'frag') {
      if (meta.lethal <= 0) return
      meta.lethal -= 1
    } else if (kind === 'flash' || kind === 'smoke') {
      if (meta.activeClass?.tactical !== kind || meta.tactical <= 0) return
      meta.tactical -= 1
    } else {
      return
    }
    const eye = eyeOf(p)
    let o = vec3(msg.o)
    if (!o || dist3(o, eye) > 1.8) o = eye
    const d = unit3(msg.d) ?? [-Math.sin(p.yaw), 0, -Math.cos(p.yaw)]

    let fuse = Infinity
    if (kind === 'frag') fuse = EQUIPMENT.frag.fuse - clamp(isNum(msg.cook) ? msg.cook : 0, 0, EQUIPMENT.frag.fuse)
    if (kind === 'flash') fuse = EQUIPMENT.flash.fuse
    if (fuse <= 0.05) {
      // Cooked too long: it goes off in hand.
      this.detonate({ kind, owner: p.id, ownerTeam: p.team }, [p.x, p.y + 1.0, p.z])
      return
    }
    this.broadcast('act', { id: p.id, a: 'throw' }, { except: _client })
    const start = [o[0] + d[0] * 0.4, o[1] + d[1] * 0.4, o[2] + d[2] * 0.4]
    const vel = [d[0] * THROW_SPEED, d[1] * THROW_SPEED + THROW_LOFT, d[2] * THROW_SPEED]
    this.spawnGrenade(p, kind, start, vel, fuse)
  }

  onChooseTeam(_client, p, _meta, msg) {
    if (this.mode !== 'tdm' || p.state !== SELECTING) return
    this.assignTeam(p, msg.team, 'choice')
  }

  onSetClass(client, p, meta, msg) {
    const cls = sanitizeClass(msg.classData)
    if (!cls) {
      client.send('class_ack', { ok: false })
      return
    }
    // Never swaps the live loadout: it always waits for the next spawn.
    meta.pendingClass = cls
    client.send('class_ack', { ok: true, pending: p.state === ALIVE, name: cls.name })
  }

  onSpawnRequest(_client, p, meta, msg) {
    if (p.state !== DEPLOYING || !this.inPlay()) return
    const cls = sanitizeClass(msg.classData)
    if (cls) meta.pendingClass = cls
    this.spawnPlayer(p)
  }

  /* -------------------------------------------------------------------------
   * Teams + bots
   * ----------------------------------------------------------------------- */

  humansOn(team) {
    let n = 0
    for (const p of this.state.players.values()) if (!p.isBot && p.team === team) n++
    return n
  }

  canJoinTeam(team) {
    const mine = this.humansOn(team)
    const theirs = this.humansOn(otherTeam(team))
    return mine < this.rules.teamSize && mine + 1 - theirs <= 1
  }

  autoTeam() {
    const a = this.humansOn(TEAMS.ALPHA)
    const b = this.humansOn(TEAMS.BRAVO)
    if (a !== b) return a < b ? TEAMS.ALPHA : TEAMS.BRAVO
    const { scoreAlpha, scoreBravo } = this.state
    if (scoreAlpha !== scoreBravo) return scoreAlpha < scoreBravo ? TEAMS.ALPHA : TEAMS.BRAVO
    return Math.random() < 0.5 ? TEAMS.ALPHA : TEAMS.BRAVO
  }

  assignTeam(p, choice, reason) {
    if (p.state !== SELECTING || !this.state.players.has(p.id)) return
    const meta = this.meta.get(p.id)
    let team = choice
    if (team !== TEAMS.ALPHA && team !== TEAMS.BRAVO) {
      team = this.autoTeam()
      if (reason !== 'timeout') reason = 'auto'
    } else if (!this.canJoinTeam(team)) {
      meta.client?.send('team_denied', { team, reason: 'TEAM FULL - UNBALANCED' })
      return
    }
    meta.teamTimer?.clear()
    meta.teamTimer = null
    p.team = team
    p.state = DEPLOYING
    meta.client?.send('team_assigned', { team, reason })
    this.rebalanceBots()
  }

  /** At death: the newest player on a team that's 2+ humans bigger swaps sides. */
  maybeMoveForBalance(victim) {
    if (this.mode !== 'tdm') return
    const a = this.humansOn(TEAMS.ALPHA)
    const b = this.humansOn(TEAMS.BRAVO)
    if (Math.abs(a - b) < 2) return
    const bigger = a > b ? TEAMS.ALPHA : TEAMS.BRAVO
    if (victim.team !== bigger) return
    let newest = null
    for (const p of this.state.players.values()) {
      if (p.isBot || p.team !== bigger) continue
      if (!newest || this.meta.get(p.id).joinOrder > this.meta.get(newest.id).joinOrder) newest = p
    }
    if (newest !== victim) return
    victim.team = otherTeam(bigger)
    this.meta.get(victim.id).client?.send('team_moved', { newTeam: victim.team })
    this.rebalanceBots()
  }

  rebalanceBots() {
    const bots = [...this.state.players.values()].filter((p) => p.isBot)
    // DISABLE_BOTS=1 keeps rooms human-only (handy for testing); private rooms can opt out.
    if (process.env.DISABLE_BOTS === '1' || !this.botsEnabled) {
      bots.forEach((b) => this.removeBot(b))
      return
    }
    const adjust = (team, desired) => {
      const mine = bots.filter((b) => b.team === team)
      // Remove dead bots first so nobody vanishes mid-fight if avoidable.
      mine.sort((x, y) => (x.state === DEAD ? 0 : 1) - (y.state === DEAD ? 0 : 1))
      while (mine.length > desired) this.removeBot(mine.shift())
      for (let i = mine.length; i < desired; i++) this.addBot(team)
    }
    if (this.mode === 'tdm') {
      for (const team of [TEAMS.ALPHA, TEAMS.BRAVO]) {
        adjust(team, Math.max(0, this.rules.teamSize - this.humansOn(team)))
      }
    } else {
      let humans = 0
      for (const p of this.state.players.values()) if (!p.isBot) humans++
      adjust('ffa', Math.max(0, this.rules.botFill - humans))
    }
  }

  addBot(team) {
    const used = new Set([...this.state.players.values()].map((p) => p.name))
    let name = ''
    for (let i = 0; i < BOT_NAMES.length; i++) {
      name = `BOT ${BOT_NAMES[this.botNameCursor++ % BOT_NAMES.length]}`
      if (!used.has(name)) break
    }
    const p = new PlayerState()
    p.id = `bot_${++this.uid}`
    p.name = name
    p.isBot = true
    p.team = team
    p.joinedAt = Date.now()
    p.state = DEAD
    const meta = this.createMeta(p, null)
    meta.bot = createBotBrain()
    const pick = (list) => list[Math.floor(Math.random() * list.length)]
    const primary = Math.random() < 0.75 ? 'ar' : 'sniper'
    meta.activeClass = sanitizeClass({
      name: 'BOT',
      primary,
      primaryAtt: {
        optic: pick(WEAPONS[primary].attachSlots.optic ?? ['']),
        muzzle: pick(WEAPONS[primary].attachSlots.muzzle ?? ['']),
      },
      secondary: pick(SECONDARY_OPTIONS),
      tactical: Math.random() < 0.5 ? 'flash' : 'smoke',
    })
    meta.respawnAt = Date.now() + 300 + Math.random() * 1500
    this.state.players.set(p.id, p)
  }

  removeBot(p) {
    this.state.players.delete(p.id)
    this.meta.delete(p.id)
  }

  isEnemy(a, b) {
    return a !== b && (this.mode === 'ffa' || a.team !== b.team)
  }

  /** A weapon's stats with this player's attachments applied. */
  weaponOf(meta, id) {
    return effectiveWeapon(id, attachmentsFor(meta.activeClass, id))
  }

  /* -------------------------------------------------------------------------
   * Spawning, damage, death
   * ----------------------------------------------------------------------- */

  pickSpawn(p) {
    const list = this.mode === 'tdm' ? SPAWNS[p.team] ?? SPAWNS.ffa : SPAWNS.ffa
    const others = [...this.state.players.values()].filter((o) => o !== p && o.state === ALIVE)
    let best = list[0]
    let bestScore = -Infinity
    for (const s of list) {
      let nearestEnemy = 60
      let crowd = 0
      for (const o of others) {
        const d = dist2(s.p[0], s.p[2], o.x, o.z)
        if (this.isEnemy(p, o)) nearestEnemy = Math.min(nearestEnemy, d)
        if (d < 1.4) crowd++
      }
      const score = nearestEnemy + Math.random() * 3 - crowd * 25
      if (score > bestScore) {
        bestScore = score
        best = s
      }
    }
    return best
  }

  ammoPayload(meta) {
    const out = { lethal: meta.lethal, tactical: meta.tactical }
    for (const [id, a] of Object.entries(meta.ammo)) out[id] = [a.mag, a.reserve]
    return out
  }

  spawnPlayer(p) {
    const meta = this.meta.get(p.id)
    if (!meta) return
    if (meta.pendingClass) {
      meta.activeClass = meta.pendingClass
      meta.pendingClass = null
    }
    if (!meta.activeClass) meta.activeClass = DEFAULT_CLASS
    const cls = meta.activeClass
    meta.ammo = {}
    for (const id of [cls.primary, cls.secondary]) {
      const w = this.weaponOf(meta, id)
      meta.ammo[id] = { mag: w.magSize, reserve: w.reserve }
    }
    p.kit = kitString(cls)
    meta.lethal = EQUIPMENT.frag.count
    meta.tactical = EQUIPMENT[cls.tactical].count
    meta.fireCredits = {}
    this.cancelReload(meta)

    const s = this.pickSpawn(p)
    const now = Date.now()
    p.x = s.p[0] + (Math.random() - 0.5) * 0.6
    p.y = s.p[1]
    p.z = s.p[2] + (Math.random() - 0.5) * 0.6
    p.yaw = s.yaw
    p.pitch = 0
    p.hp = PLAYER.maxHealth
    p.state = ALIVE
    p.weapon = cls.primary
    p.primary = cls.primary
    p.crouch = false
    p.prone = false
    p.slide = false
    p.ads = false
    p.sprint = false
    p.climbing = false
    p.spawnSeq = (p.spawnSeq + 1) % 65535
    p.mt = now - this.t0
    meta.lastMt = now
    meta.fallPeak = p.y
    meta.history = []
    meta.protectedUntil = now + SPAWN_PROTECTION * 1000
    meta.lastDamageAt = 0
    meta.lastAttacker = null
    meta.lastMoveAt = now
    meta.regenAcc = 0

    if (meta.bot) {
      resetBotBrain(meta.bot, cls)
    } else {
      meta.client?.send('spawn', {
        p: [p.x, p.y, p.z],
        yaw: p.yaw,
        seq: p.spawnSeq,
        classData: cls,
        ammo: this.ammoPayload(meta),
      })
    }
  }

  applyDamage(victim, amount, attacker, weaponId, opts = {}) {
    if (victim.state !== ALIVE || amount <= 0 || !this.inPlay()) return
    const vm = this.meta.get(victim.id)
    const now = Date.now()
    if (now < vm.protectedUntil && attacker !== victim) return
    const dmg = Math.round(amount)
    const hp = Math.max(0, victim.hp - dmg)
    victim.hp = hp
    vm.lastDamageAt = now
    vm.regenAcc = 0
    if (attacker && attacker !== victim) vm.lastAttacker = attacker.id

    vm.client?.send('damaged', { from: opts.from ?? null, dmg, hp })
    if (attacker && attacker !== victim && !attacker.isBot) {
      this.meta.get(attacker.id)?.client?.send('hit', {
        t: victim.id,
        dmg,
        kill: hp === 0,
        hs: Boolean(opts.headshot),
      })
    }
    if (hp === 0) this.killPlayer(victim, attacker, weaponId, opts.headshot)
  }

  killPlayer(victim, killer, weaponId, headshot) {
    const vm = this.meta.get(victim.id)
    victim.state = DEAD
    victim.hp = 0
    victim.ads = false
    victim.sprint = false
    victim.climbing = false
    victim.deaths += 1
    vm.respawnAt = Date.now() + RESPAWN_DELAY * 1000
    this.cancelReload(vm)

    const credited = killer && killer !== victim && this.isEnemy(killer, victim)
    if (credited) {
      killer.kills += 1
      if (this.mode === 'tdm') {
        if (killer.team === TEAMS.ALPHA) this.state.scoreAlpha += 1
        else this.state.scoreBravo += 1
      }
    }
    this.dropPickup(victim)
    this.broadcast('kill', {
      k: killer?.id ?? '',
      v: victim.id,
      w: weaponId,
      hs: Boolean(headshot),
      khp: killer && killer !== victim ? killer.hp : 0,
    })
    if (!victim.isBot) this.maybeMoveForBalance(victim)
    this.checkScoreLimit()
  }

  /* -------------------------------------------------------------------------
   * Grenades and smoke
   * ----------------------------------------------------------------------- */

  spawnGrenade(owner, kind, pos, vel, fuseSeconds) {
    const id = `g${++this.uid}`
    const now = Date.now()
    const body = this.mapWorld.addGrenade(pos, vel)
    const g = new GrenadeState()
    g.id = id
    g.kind = kind
    g.owner = owner.id
    g.x = pos[0]
    g.y = pos[1]
    g.z = pos[2]
    this.state.grenades.set(id, g)
    this.grenadeBodies.set(id, {
      body,
      kind,
      owner: owner.id,
      ownerTeam: owner.team,
      explodeAt: Number.isFinite(fuseSeconds) ? now + fuseSeconds * 1000 : Infinity,
      landedAt: 0,
      spawnedAt: now,
    })
  }

  removeGrenade(id) {
    const gd = this.grenadeBodies.get(id)
    if (gd) this.mapWorld.removeBody(gd.body)
    this.grenadeBodies.delete(id)
    this.state.grenades.delete(id)
  }

  tickGrenades(now) {
    for (const [id, gd] of this.grenadeBodies) {
      const g = this.state.grenades.get(id)
      const t = gd.body.translation()
      if (g) {
        g.x = t.x
        g.y = t.y
        g.z = t.z
      }
      const pos = [t.x, t.y, t.z]
      if (t.y < KILL_Y) {
        this.removeGrenade(id)
        continue
      }
      if (gd.kind === 'smoke') {
        const v = gd.body.linvel()
        const speed = Math.hypot(v.x, v.y, v.z)
        const flight = now - gd.spawnedAt
        if (!gd.landedAt && ((speed < 0.8 && flight > 300) || flight > EQUIPMENT.smoke.maxFlight * 1000)) {
          gd.landedAt = now
        }
        if (gd.landedAt && now - gd.landedAt >= EQUIPMENT.smoke.deployDelay * 1000) {
          this.removeGrenade(id)
          this.deploySmoke(pos)
        }
      } else if (now >= gd.explodeAt) {
        this.removeGrenade(id)
        this.detonate(gd, pos)
      }
    }
  }

  detonate(gd, pos) {
    if (gd.kind === 'flash') {
      this.broadcast('flash', { p: pos })
      this.flashBots(pos)
      return
    }
    if (gd.kind !== 'frag') return
    this.broadcast('explosion', { k: 'frag', p: pos })
    const owner = this.state.players.get(gd.owner) ?? null
    const { radius, damage } = EQUIPMENT.frag
    const lift = [pos[0], pos[1] + 0.25, pos[2]]
    for (const victim of this.state.players.values()) {
      if (victim.state !== ALIVE) continue
      const self = victim.id === gd.owner
      // No friendly fire in TDM, but your own grenade can still kill you.
      if (!self && this.mode === 'tdm' && victim.team === gd.ownerTeam) continue
      const chest = chestPoint(victim.x, victim.y, victim.z, stanceOf(victim), victim.yaw)
      const d = dist3(pos, chest)
      if (d >= radius) continue
      const exposed =
        this.mapWorld.clearLine(lift, chest, 0.1) ||
        this.mapWorld.clearLine(lift, headPoint(victim.x, victim.y, victim.z, stanceOf(victim), victim.yaw), 0.1) ||
        this.mapWorld.clearLine(lift, [victim.x, victim.y + 0.3, victim.z], 0.1)
      if (!exposed) continue
      this.applyDamage(victim, damage * (1 - d / radius), owner, 'frag', { from: [pos[0], pos[2]] })
    }
  }

  /** Humans work out their own flash from the broadcast; bots are flashed here. */
  flashBots(pos) {
    const { radius, duration, lookAwayScale } = EQUIPMENT.flash
    const now = Date.now()
    for (const p of this.state.players.values()) {
      if (!p.isBot || p.state !== ALIVE) continue
      const eye = eyeOf(p)
      const dx = pos[0] - eye[0]
      const dy = pos[1] - eye[1]
      const dz = pos[2] - eye[2]
      const d = Math.hypot(dx, dy, dz)
      if (d > radius || !this.mapWorld.clearLine(eye, pos, 0.15)) continue
      const facing = (-Math.sin(p.yaw) * dx - Math.cos(p.yaw) * dz) / (Math.hypot(dx, dz) || 1)
      const look = lookAwayScale + (1 - lookAwayScale) * Math.max(0, facing)
      const secs = duration * (1 - d / radius) * look
      if (secs > 0.25) this.meta.get(p.id).bot.flashedUntil = Math.max(this.meta.get(p.id).bot.flashedUntil, now + secs * 1000)
    }
  }

  deploySmoke(pos) {
    const s = new SmokeState()
    s.id = `s${++this.uid}`
    s.x = pos[0]
    s.y = pos[1]
    s.z = pos[2]
    s.remaining = EQUIPMENT.smoke.duration
    this.state.smokes.set(s.id, s)
    this.broadcast('explosion', { k: 'smoke', p: pos })
  }

  /** Does the segment a->b pass through an active smoke cloud? */
  smokeBlocks(a, b) {
    if (this.state.smokes.size === 0) return false
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const dz = b[2] - a[2]
    const len = Math.hypot(dx, dy, dz) || 1
    const dir = [dx / len, dy / len, dz / len]
    for (const s of this.state.smokes.values()) {
      const r = EQUIPMENT.smoke.radius * Math.min(1, s.remaining / EQUIPMENT.smoke.fadeTime) * 0.9
      const c = [s.x, s.y + 1.2, s.z]
      const t = raySphere(a, dir, c, r)
      if (t <= len) return true
    }
    return false
  }

  canSee(a, b) {
    return this.mapWorld.clearLine(a, b, 0.1) && !this.smokeBlocks(a, b)
  }

  /* -------------------------------------------------------------------------
   * Bot hooks
   * ----------------------------------------------------------------------- */

  botShot(p, target, weaponId, hit, zone) {
    const now = Date.now()
    const meta = this.meta.get(p.id)
    meta.protectedUntil = 0
    const eye = eyeOf(p)
    const fx = -Math.sin(p.yaw)
    const fz = -Math.cos(p.yaw)
    const muzzle = [eye[0] + fx * 0.6 - fz * 0.15, eye[1] - 0.12, eye[2] + fz * 0.6 + fx * 0.15]

    let end = zone === 'head'
      ? headPoint(target.x, target.y, target.z, stanceOf(target), target.yaw)
      : chestPoint(target.x, target.y, target.z, stanceOf(target), target.yaw)
    if (hit && !this.canSee(eye, end)) hit = false
    if (!hit) {
      const aim = [end[0] + (Math.random() - 0.5) * 1.6, end[1] + (Math.random() - 0.5) * 1.1, end[2] + (Math.random() - 0.5) * 1.6]
      const dx = aim[0] - eye[0]
      const dy = aim[1] - eye[1]
      const dz = aim[2] - eye[2]
      const l = Math.hypot(dx, dy, dz) || 1
      const dir = [dx / l, dy / l, dz / l]
      const toi = this.mapWorld.raycast(eye, dir, 80) ?? 80
      end = [eye[0] + dir[0] * toi, eye[1] + dir[1] * toi, eye[2] + dir[2] * toi]
    }
    const w = this.weaponOf(meta, weaponId)
    this.broadcast('shot', { id: p.id, w: weaponId, o: muzzle, e: end, b: hit, q: w.quiet })
    this.noise(p, now, w.quiet)
    if (hit) {
      const dmg = damageAt(weaponId, zone, dist3(eye, end), w.att)
      this.applyDamage(target, dmg, p, weaponId, { headshot: zone === 'head', from: [p.x, p.z] })
    }
  }

  botMelee(p, target, success) {
    this.broadcast('melee', { id: p.id })
    this.meta.get(p.id).protectedUntil = 0
    if (!success || target.state !== ALIVE) return
    if (dist2(p.x, p.z, target.x, target.z) > WEAPONS.knife.lungeRange) return
    this.applyDamage(target, WEAPONS.knife.damage.body, p, 'knife', { from: [p.x, p.z] })
  }

  /** Gunfire is loud: nearby enemy bots turn toward it (suppressed shots barely carry). */
  noise(source, now, quiet = false) {
    const reach = quiet ? 7 : 30
    for (const p of this.state.players.values()) {
      if (!p.isBot || p.state !== ALIVE || !this.isEnemy(p, source)) continue
      if (dist2(p.x, p.z, source.x, source.z) > reach) continue
      botHearNoise(this, this.meta.get(p.id), [source.x, source.y, source.z], now)
    }
  }

  /* -------------------------------------------------------------------------
   * Ammo pickups
   * ----------------------------------------------------------------------- */

  dropPickup(victim) {
    if (this.state.pickups.size >= MAX_PICKUPS) {
      const oldest = this.state.pickups.keys().next().value
      this.state.pickups.delete(oldest)
      this.pickupExpiry.delete(oldest)
    }
    const a = new PickupState()
    a.id = `a${++this.uid}`
    a.x = victim.x
    a.y = victim.y
    a.z = victim.z
    this.state.pickups.set(a.id, a)
    this.pickupExpiry.set(a.id, Date.now() + PICKUP_TTL_MS)
  }

  checkPickups(p, meta, now) {
    for (const a of this.state.pickups.values()) {
      if (dist2(p.x, p.z, a.x, a.z) > 1.3 || Math.abs(p.y - a.y) > 1.6) continue
      for (const [id, ammo] of Object.entries(meta.ammo)) {
        const w = this.weaponOf(meta, id)
        ammo.reserve = Math.min(w.reserve, ammo.reserve + w.magSize * 2)
      }
      meta.lethal = Math.min(EQUIPMENT.frag.maxCount, meta.lethal + 1)
      this.state.pickups.delete(a.id)
      this.pickupExpiry.delete(a.id)
      meta.client?.send('ammo', { ammo: this.ammoPayload(meta), msg: 'AMMO PICKED UP' })
      break
    }
    const c = AMMO_CRATE.p
    if (now >= meta.ammoCrateAt && dist2(p.x, p.z, c[0], c[2]) <= AMMO_CRATE.radius && Math.abs(p.y - c[1]) < 1.5) {
      meta.ammoCrateAt = now + AMMO_CRATE.cooldown * 1000
      for (const [id, ammo] of Object.entries(meta.ammo)) ammo.reserve = this.weaponOf(meta, id).reserve
      meta.lethal = EQUIPMENT.frag.count
      meta.tactical = EQUIPMENT[meta.activeClass.tactical].count
      meta.client?.send('ammo', { ammo: this.ammoPayload(meta), msg: 'RESUPPLIED' })
    }
  }

  /* -------------------------------------------------------------------------
   * Loop + match flow
   * ----------------------------------------------------------------------- */

  tick(dtMs) {
    const dt = Math.min(dtMs / 1000, 0.1)
    const now = Date.now()
    this.mapWorld.step(dt)
    this.tickGrenades(now)
    const playing = this.inPlay()

    for (const p of this.state.players.values()) {
      const meta = this.meta.get(p.id)
      if (!meta) continue
      if (p.state === ALIVE) {
        meta.history.push({ t: now, x: p.x, y: p.y, z: p.z, c: stanceOf(p), w: p.yaw })
        while (meta.history.length && now - meta.history[0].t > HISTORY_MS) meta.history.shift()

        if (p.hp < PLAYER.maxHealth && now - meta.lastDamageAt > PLAYER.regenDelay * 1000) {
          meta.regenAcc += PLAYER.regenRate * dt
          const add = Math.floor(meta.regenAcc)
          if (add > 0) {
            p.hp = Math.min(PLAYER.maxHealth, p.hp + add)
            meta.regenAcc -= add
          }
        }
        if (p.y < KILL_Y && playing) this.killPlayer(p, null, 'fall', false)
        else if (meta.bot && playing) {
          tickBot(this, p, meta, dt, now)
          p.mt = now - this.t0
        }
      } else if (p.state === DEAD && playing && now >= meta.respawnAt) {
        this.spawnPlayer(p)
      }
    }

    for (const s of this.state.smokes.values()) {
      s.remaining -= dt
      if (s.remaining <= 0) this.state.smokes.delete(s.id)
    }
  }

  everySecond() {
    const now = Date.now()
    if (this.state.phase === 'playing') {
      this.state.timeLeft = Math.max(0, this.state.timeLeft - 1)
      if (this.state.timeLeft === 0) this.endMatch()
    } else if (this.state.phase === 'ended') {
      this.state.restartIn = Math.max(0, this.state.restartIn - 1)
      if (this.state.restartIn === 0) this.resetMatch()
    }
    for (const [id, at] of this.pickupExpiry) {
      if (now >= at) {
        this.state.pickups.delete(id)
        this.pickupExpiry.delete(id)
      }
    }
  }

  sendPings() {
    const t = Date.now()
    for (const client of this.clients) client.send('ping', { t })
  }

  checkScoreLimit() {
    if (this.state.phase !== 'playing') return
    const limit = this.state.scoreLimit
    if (this.mode === 'tdm') {
      if (this.state.scoreAlpha >= limit || this.state.scoreBravo >= limit) this.endMatch()
      return
    }
    for (const p of this.state.players.values()) {
      if (p.kills >= limit) {
        this.endMatch()
        return
      }
    }
  }

  ranking() {
    return [...this.state.players.values()]
      .filter((p) => p.state !== SELECTING)
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.joinedAt - b.joinedAt)
  }

  endMatch() {
    if (this.state.phase !== 'playing') return
    const s = this.state
    s.phase = 'ended'
    s.restartIn = MATCH_END_DURATION
    const ranking = this.ranking()
    if (this.mode === 'tdm') {
      s.winner = s.scoreAlpha === s.scoreBravo ? 'draw' : s.scoreAlpha > s.scoreBravo ? TEAMS.ALPHA : TEAMS.BRAVO
    } else {
      s.winner = ranking[0]?.id ?? ''
    }
    s.mvp = ranking[0]?.id ?? ''
    for (const id of [...this.grenadeBodies.keys()]) this.removeGrenade(id)
    s.smokes.clear()
    for (const meta of this.meta.values()) this.cancelReload(meta)
    this.broadcast('match_end', { winner: s.winner, mvp: s.mvp })
  }

  resetMatch() {
    const s = this.state
    s.scoreAlpha = 0
    s.scoreBravo = 0
    s.timeLeft = this.rules.timeLimit
    s.winner = ''
    s.mvp = ''
    s.pickups.clear()
    this.pickupExpiry.clear()
    for (const p of s.players.values()) {
      p.kills = 0
      p.deaths = 0
    }

    // Re-balance humans before the new match: newest joiners move first.
    if (this.mode === 'tdm') {
      for (;;) {
        const a = this.humansOn(TEAMS.ALPHA)
        const b = this.humansOn(TEAMS.BRAVO)
        if (Math.abs(a - b) < 2) break
        const bigger = a > b ? TEAMS.ALPHA : TEAMS.BRAVO
        const newest = [...s.players.values()]
          .filter((p) => !p.isBot && p.team === bigger)
          .sort((x, y) => this.meta.get(y.id).joinOrder - this.meta.get(x.id).joinOrder)[0]
        newest.team = otherTeam(bigger)
        this.meta.get(newest.id).client?.send('team_moved', { newTeam: newest.team })
      }
    }
    this.rebalanceBots()

    s.phase = 'playing'
    for (const p of s.players.values()) {
      if (p.state === SELECTING) continue
      if (p.isBot) this.spawnPlayer(p)
      else p.state = DEPLOYING
    }
    this.broadcast('match_reset', {})
  }
}
