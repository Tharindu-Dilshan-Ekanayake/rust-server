/**
 * Search & Destroy rules, run by the room (rooms/DustlineRoom.js) when its mode
 * is 'snd'.
 *
 * Rounds: everyone spawns frozen for a few seconds (freeze), then the round is
 * live. One life a round: the dead watch their team until the next one. The
 * bomb starts each round on the ground in front of the attackers' spawn and the
 * first attacker to reach it once the round is live carries it; dropped where
 * its carrier falls, any attacker can pick it up by walking over it. Holding
 * Use on a site plants it (attackers) and holding Use by it defuses it
 * (defenders), standing still for the whole time. A round ends when a side is
 * wiped out (the attackers, only before the bomb is down), the clock runs out
 * with no bomb planted, the bomb goes off, or it's defused. First to
 * SND.roundsToWin wins the match; the sides swap attack and defence every
 * SND.swapEvery rounds.
 *
 * While nobody real is playing (the room is all bots), rounds don't count: the
 * bots keep it warm, and the first player to deploy gets the round restarted.
 */
import { PLAYER_STATES, ROUND, SND, stanceOf, TEAMS } from '../shared/constants.js'
import { chestPoint } from '../shared/hitbox.js'
import { dist3 } from '../shared/math.js'
import { XP } from '../shared/progression.js'
import { nearestNode } from './physics.js'

const { ALIVE, DEAD } = PLAYER_STATES
const otherTeam = (t) => (t === TEAMS.ALPHA ? TEAMS.BRAVO : TEAMS.ALPHA)

export class SearchDestroy {
  constructor(room) {
    this.room = room
    /** When the freeze or the end-of-round pause is over. */
    this.phaseEndsAt = 0
    /** When the round went live. */
    this.liveAt = 0
    /** Ids holding Use. */
    this.uses = new Set()
    /** The plant or defuse under way: { by, kind, progress, at: [x, z] } or null. */
    this.act = null
    this.planter = ''
    /** Whether the round that just ended counted (someone real was playing). */
    this.counted = false
    /** The site the attacking bots go for this round. */
    this.botSite = 'A'
    this.exploding = false
  }

  get state() {
    return this.room.state
  }

  /** Rounds are being played: not a private room's warm-up, not between matches. */
  get on() {
    return this.state.phase === 'playing' && this.state.roundPhase !== ''
  }

  /** Shots, grenades and damage count (the round is live, bomb down or not). */
  fighting() {
    const r = this.state.roundPhase
    return r === ROUND.LIVE || r === ROUND.PLANTED
  }

  defenders() {
    return otherTeam(this.state.attackers)
  }

  sites() {
    return this.room.map.snd.sites
  }

  site(id) {
    return this.sites().find((s) => s.id === id) ?? this.sites()[0]
  }

  /** The site whose plant zone holds a feet position, or null. */
  siteAt(x, y, z) {
    return this.sites().find((s) => Math.hypot(x - s.p[0], z - s.p[2]) <= SND.siteRadius && Math.abs(y - s.p[1]) < 1.8) ?? null
  }

  /** Which of the map's spawn lists a team starts from this round. */
  spawnSide(team) {
    const attack = this.room.map.snd.attack
    return team === this.state.attackers ? attack : otherTeam(attack)
  }

  alive(team) {
    let n = 0
    for (const p of this.state.players.values()) if (p.team === team && p.state === ALIVE) n++
    return n
  }

  /** Players of a team taking part in the round (alive or already dead). */
  inRound(team) {
    let n = 0
    for (const p of this.state.players.values()) if (p.team === team && (p.state === ALIVE || p.state === DEAD)) n++
    return n
  }

  humansPlaying(except = null) {
    for (const p of this.state.players.values()) {
      if (p !== except && !p.isBot && (p.state === ALIVE || p.state === DEAD)) return true
    }
    return false
  }

  /* ---- Rounds -------------------------------------------------------------- */

  /** A new match: round 1, Alpha attacking. */
  resetMatch() {
    const s = this.state
    s.round = 0
    s.attackers = TEAMS.ALPHA
    this.startRound(false)
  }

  /** Everyone back to their spawns, frozen; the bomb on the ground in front of the attackers. `again`: replay the same round. */
  startRound(again) {
    const room = this.room
    const s = this.state
    room.clearRoundDebris()
    if (!again) {
      s.round += 1
      if (s.round > 1 && (s.round - 1) % SND.swapEvery === 0) {
        s.attackers = otherTeam(s.attackers)
        room.broadcast('snd', { e: 'swap', attackers: s.attackers })
      }
    }
    s.roundPhase = ROUND.FREEZE
    this.phaseEndsAt = Date.now() + SND.freezeTime * 1000
    s.timeLeft = SND.roundTime
    s.bombState = ''
    s.bombCarrier = ''
    s.bombSite = ''
    s.bombLeft = 0
    s.roundWinner = ''
    s.roundWhy = ''
    this.clearAction()
    this.uses.clear()
    this.planter = ''
    this.exploding = false
    this.botSite = Math.random() < 0.5 ? 'A' : 'B'
    for (const p of s.players.values()) {
      if (p.state === ALIVE || p.state === DEAD) room.spawnPlayer(p)
    }
    this.placeBomb()
    room.broadcast('snd', { e: 'round', round: s.round, attackers: s.attackers })
  }

  /**
   * Where the bomb waits at the start of a round: on the ground a few metres out
   * from the middle of the attackers' spawns, toward the middle of the map (on
   * the nav node nearest that, so it's somewhere you can stand).
   */
  bombStart() {
    const side = this.spawnSide(this.state.attackers)
    this.starts ??= {}
    if (!this.starts[side]) {
      const list = this.room.map.spawns[side]
      let x = 0
      let y = 0
      let z = 0
      for (const sp of list) {
        x += sp.p[0] / list.length
        y += sp.p[1] / list.length
        z += sp.p[2] / list.length
      }
      const len = Math.hypot(x, z) || 1
      const at = [x - (x / len) * 3, y, z - (z / len) * 3]
      const node = this.room.nav.nodes[nearestNode(this.room.nav, this.room.mapWorld, at)]
      this.starts[side] = node ? [node[0], node[1], node[2]] : at
    }
    return this.starts[side]
  }

  /** The round's bomb, lying in front of the attackers: whoever reaches it first once the round is live carries it. */
  placeBomb() {
    const s = this.state
    const [x, y, z] = this.bombStart()
    s.bombState = 'dropped'
    s.bombCarrier = ''
    s.bombX = x
    s.bombY = y
    s.bombZ = z
  }

  carry(p) {
    const s = this.state
    s.bombState = 'carried'
    s.bombCarrier = p.id
    s.bombX = p.x
    s.bombY = p.y
    s.bombZ = p.z
  }

  /** A player spawned (round start, or joining in time): a round somehow without its bomb gets one. */
  onSpawn() {
    if (!this.on) return
    const s = this.state
    if (s.bombState === '' && (s.roundPhase === ROUND.FREEZE || s.roundPhase === ROUND.LIVE)) this.placeBomb()
  }

  /**
   * Someone deploying from the class screen. Returns true to spawn them now: in
   * the freeze, or just after the round goes live. Otherwise they watch until the
   * next round. The first real player into a room of bots gets a fresh round.
   */
  mayJoin(p) {
    const s = this.state
    if (!this.on) return true
    if (!this.humansPlaying(p) && s.roundPhase !== ROUND.FREEZE) {
      this.startRound(true)
      return true
    }
    if (s.roundPhase === ROUND.FREEZE) return true
    return s.roundPhase === ROUND.LIVE && Date.now() - this.liveAt < SND.joinGrace * 1000
  }

  tick(dt, now) {
    if (!this.on) return
    const s = this.state
    if (s.roundPhase === ROUND.OVER) {
      if (now >= this.phaseEndsAt) this.nextRound()
      return
    }
    if (s.roundPhase === ROUND.FREEZE && now >= this.phaseEndsAt) {
      s.roundPhase = ROUND.LIVE
      this.liveAt = now
      this.room.broadcast('snd', { e: 'live' })
    }
    if (s.bombState === 'carried') {
      const c = s.players.get(s.bombCarrier)
      if (!c || c.state !== ALIVE) this.dropBomb(c)
      else {
        s.bombX = c.x
        s.bombY = c.y
        s.bombZ = c.z
      }
    }
    if (s.bombState === 'dropped') this.checkPickup()
    if (this.fighting()) this.tickAction(dt)
    if (s.roundPhase === ROUND.PLANTED) {
      s.bombLeft = Math.max(0, s.bombLeft - dt)
      if (s.bombLeft <= 0) this.explode()
    }
  }

  everySecond() {
    if (!this.on || this.state.roundPhase !== ROUND.LIVE) return
    const s = this.state
    s.timeLeft = Math.max(0, s.timeLeft - 1)
    if (s.timeLeft === 0) this.endRound(this.defenders(), 'time')
  }

  /** Between rounds: the match is over, or on to the next (the same one again if it didn't count). */
  nextRound() {
    const s = this.state
    if (s.scoreAlpha >= SND.roundsToWin || s.scoreBravo >= SND.roundsToWin) {
      this.room.endMatch()
      return
    }
    this.startRound(!this.counted)
  }

  endRound(winner, why) {
    const s = this.state
    if (s.roundPhase === ROUND.OVER) return
    s.roundPhase = ROUND.OVER
    this.phaseEndsAt = Date.now() + SND.roundEndDelay * 1000
    this.clearAction()
    this.uses.clear()
    s.roundWinner = winner
    s.roundWhy = why
    this.counted = this.humansPlaying()
    if (this.counted) {
      if (winner === TEAMS.ALPHA) s.scoreAlpha += 1
      else s.scoreBravo += 1
      for (const p of s.players.values()) {
        if (p.team === winner && (p.state === ALIVE || p.state === DEAD)) this.room.awardXp(p, XP.roundWin, 'round')
      }
    }
    this.room.broadcast('snd', { e: 'end', winner, why, a: s.scoreAlpha, b: s.scoreBravo, counted: this.counted })
  }

  /** Is either side wiped out? (A side nobody is on — a half-empty private room — can't be.) */
  checkElimination() {
    const s = this.state
    if (!this.fighting() || this.exploding) return
    const atk = s.attackers
    const def = this.defenders()
    if (!this.inRound(atk) || !this.inRound(def)) return
    if (this.alive(def) === 0) this.endRound(atk, 'eliminated')
    else if (this.alive(atk) === 0 && s.roundPhase === ROUND.LIVE) this.endRound(def, 'eliminated')
  }

  onDeath(victim) {
    if (!this.on) return
    const s = this.state
    if (s.bombCarrier === victim.id) this.dropBomb(victim)
    if (this.act?.by === victim.id) this.clearAction()
    this.uses.delete(victim.id)
    this.checkElimination()
  }

  /** A player left the room (or a bot was taken out). */
  onLeave(p) {
    if (!this.on) return
    const s = this.state
    if (s.bombCarrier === p.id) this.dropBomb(p)
    if (this.act?.by === p.id) this.clearAction()
    this.uses.delete(p.id)
    this.checkElimination()
  }

  /* ---- The bomb ------------------------------------------------------------ */

  dropBomb(carrier) {
    const s = this.state
    s.bombState = 'dropped'
    s.bombCarrier = ''
    if (carrier) {
      // Out of the map (a fall): it lands back where the carrier last stood on something.
      const y = carrier.y < this.room.map.killY ? 0 : carrier.y
      s.bombX = carrier.x
      s.bombY = y
      s.bombZ = carrier.z
    }
    if (this.act?.kind === 'plant') this.clearAction()
    this.room.broadcast('snd', { e: 'dropped', p: [s.bombX, s.bombY, s.bombZ] })
  }

  checkPickup() {
    const s = this.state
    if (!this.fighting()) return
    for (const p of s.players.values()) {
      if (p.state !== ALIVE || p.team !== s.attackers) continue
      if (Math.hypot(p.x - s.bombX, p.z - s.bombZ) > SND.pickupRange || Math.abs(p.y - s.bombY) > 1.6) continue
      this.carry(p)
      this.room.broadcast('snd', { e: 'pickup', by: p.id })
      return
    }
  }

  onUse(p, on) {
    if (on && p.state === ALIVE) this.uses.add(p.id)
    else this.uses.delete(p.id)
  }

  /** Who is planting or defusing right now, and how far along. */
  tickAction(dt) {
    const s = this.state
    let actor = null
    let kind = ''
    if (s.roundPhase === ROUND.LIVE && s.bombState === 'carried') {
      const c = s.players.get(s.bombCarrier)
      if (c && c.state === ALIVE && this.uses.has(c.id) && this.siteAt(c.x, c.y, c.z)) {
        actor = c
        kind = 'plant'
      }
    } else if (s.roundPhase === ROUND.PLANTED) {
      const bomb = [s.bombX, s.bombY, s.bombZ]
      const def = this.defenders()
      const can = (p) => p && p.state === ALIVE && p.team === def && this.uses.has(p.id) && dist3([p.x, p.y, p.z], bomb) <= SND.defuseRange
      // Whoever started keeps it while they hold on; otherwise the first defender in reach.
      const current = this.act?.kind === 'defuse' ? s.players.get(this.act.by) : null
      if (can(current)) actor = current
      else for (const p of s.players.values()) if (can(p)) {
        actor = p
        break
      }
      if (actor) kind = 'defuse'
    }
    if (!actor) {
      this.clearAction()
      return
    }
    // A new actor, or the same one stepping off the spot, starts from scratch.
    if (!this.act || this.act.by !== actor.id || this.act.kind !== kind || Math.hypot(actor.x - this.act.at[0], actor.z - this.act.at[1]) > 0.8) {
      this.act = { by: actor.id, kind, progress: 0, at: [actor.x, actor.z] }
    }
    this.act.progress += dt / (kind === 'plant' ? SND.plantTime : SND.defuseTime)
    s.action = kind
    s.actionBy = actor.id
    s.actionProgress = Math.min(1, this.act.progress)
    if (this.act.progress >= 1) {
      if (kind === 'plant') this.plant(actor)
      else this.defuse(actor)
    }
  }

  clearAction() {
    const s = this.state
    this.act = null
    s.action = ''
    s.actionBy = ''
    s.actionProgress = 0
  }

  plant(p) {
    const s = this.state
    const site = this.siteAt(p.x, p.y, p.z)
    s.bombState = 'planted'
    s.bombCarrier = ''
    s.bombSite = site?.id ?? ''
    s.bombX = p.x
    s.bombY = p.y
    s.bombZ = p.z
    s.bombLeft = SND.bombTime
    s.roundPhase = ROUND.PLANTED
    this.planter = p.id
    this.clearAction()
    this.uses.delete(p.id)
    this.room.awardXp(p, XP.plant, 'plant')
    this.room.broadcast('snd', { e: 'planted', site: s.bombSite, by: p.id, p: [p.x, p.y, p.z] })
  }

  defuse(p) {
    const s = this.state
    s.bombState = 'defused'
    this.clearAction()
    this.room.awardXp(p, XP.defuse, 'defuse')
    this.room.broadcast('snd', { e: 'defused', by: p.id })
    this.endRound(this.defenders(), 'defused')
  }

  /** It goes off: everyone close dies, the open ground round it gets hurt. The planter gets the kills. */
  explode() {
    const room = this.room
    const s = this.state
    s.bombState = 'exploded'
    s.bombLeft = 0
    this.clearAction()
    const pos = [s.bombX, s.bombY, s.bombZ]
    room.broadcast('explosion', { k: 'bomb', p: pos })
    const planter = s.players.get(this.planter) ?? null
    this.exploding = true
    for (const v of [...s.players.values()]) {
      if (v.state !== ALIVE) continue
      const chest = chestPoint(v.x, v.y, v.z, stanceOf(v), v.yaw)
      const d = dist3(pos, chest)
      if (d >= SND.blastRadius) continue
      let dmg = 0
      if (d < SND.killRadius) dmg = 999
      else if (room.mapWorld.clearLine([pos[0], pos[1] + 0.4, pos[2]], chest, 0.1)) {
        dmg = 120 * (1 - (d - SND.killRadius) / (SND.blastRadius - SND.killRadius))
      }
      if (dmg > 0) room.applyDamage(v, dmg, planter && planter !== v ? planter : null, 'bomb', { from: [pos[0], pos[2]] })
    }
    this.exploding = false
    this.endRound(s.attackers, 'detonated')
  }
}
