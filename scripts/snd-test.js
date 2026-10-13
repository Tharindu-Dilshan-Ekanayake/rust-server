/**
 * Search & Destroy, headless: boots a room in-process, joins as a player (so
 * rounds count), and lets the bots play the rounds out. The test player blows
 * itself up with a cooked frag as each round goes live, so it never sits on the
 * bomb: the bots have to fetch it, plant, defend, defuse.
 *
 *   npm run test:snd            (MAP=acres|palmwood|dustline, SECONDS=420)
 *
 * Passes when rounds end with a winner and a reason, the score adds up, sides
 * swap on schedule, a dropped bomb doesn't lie about while attacker bots are
 * alive to fetch it, and (given time) the match ends at SND.roundsToWin.
 */
import { Server } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { Client } from '@colyseus/sdk'

import { initPhysics } from '../src/game/physics.js'
import { DustlineRoom } from '../src/rooms/DustlineRoom.js'
import { EQUIPMENT } from '../src/shared/weapons.js'
import { ROOM_NAME, SND } from '../src/shared/constants.js'

const PORT = Number(process.env.PORT || 2598)
const SECONDS = Number(process.env.SECONDS || 420)
const MAP = process.env.MAP || 'palmwood'

await initPhysics()
const server = new Server({ transport: new WebSocketTransport(), greet: false })
server.define(ROOM_NAME, DustlineRoom).filterBy(['mode', 'map'])
await server.listen(PORT)

const client = new Client(`http://localhost:${PORT}`)
const room = await client.joinOrCreate(ROOM_NAME, { mode: 'snd', map: MAP, name: 'Tester', classData: { name: 'TEST', primary: 'ar', tactical: 'flash' } })
const name = (id) => room.state.players.get(id)?.name ?? id
const t0 = Date.now()
const at = () => `${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s`
const log = (...a) => console.log(at(), ...a)

const seen = { round: 0, planted: 0, defused: 0, detonated: 0, eliminated: 0, time: 0, dropped: 0, pickup: 0, swap: 0, ends: [] }
let matchEnd = null
room.onMessage('snd', (m) => {
  const s = room.state
  if (m.e === 'round') {
    seen.round++
    log(`ROUND ${m.round} — ${m.attackers} attack`)
  } else if (m.e === 'live') log('  live')
  else if (m.e === 'planted') {
    seen.planted++
    log(`  bomb planted on ${m.site} by ${name(m.by)}`)
  } else if (m.e === 'defused') {
    seen.defused++
    log(`  bomb defused by ${name(m.by)}`)
  } else if (m.e === 'dropped') {
    seen.dropped++
    log(`  bomb dropped at ${m.p.map((v) => v.toFixed(1)).join(',')}`)
  } else if (m.e === 'pickup') {
    seen.pickup++
    log(`  bomb picked up by ${name(m.by)}`)
  } else if (m.e === 'swap') {
    seen.swap++
    log(`  SIDES SWAP: ${m.attackers} attack now`)
  } else if (m.e === 'end') {
    seen[m.why] = (seen[m.why] ?? 0) + 1
    seen.ends.push(m)
    log(`  round won by ${m.winner} (${m.why}) — alpha ${m.a} : ${m.b} bravo${m.counted ? '' : ' (not counted)'}  [round ${s.round}]`)
  }
})
room.onMessage('match_end', (m) => {
  matchEnd = m
  log(`MATCH OVER — winner ${m.winner}, mvp ${name(m.mvp)}`)
})
room.onMessage('kill', (m) => {
  if (m.w === 'bomb') log(`  ${name(m.v)} killed by the bomb`)
})
room.onMessage('*', () => {})

await new Promise((r) => setTimeout(r, 300))
room.send('choose_team', { team: 'auto' })
await new Promise((r) => setTimeout(r, 300))
room.send('spawn_request', {})

// Each time the round goes live with us alive: a frag cooked to nothing, in hand.
let lastBlown = 0
// How long the bomb has lain on the ground with an attacker bot alive to fetch it (the longest such wait).
let lying = 0
let longestLying = 0
while (Date.now() - t0 < SECONDS * 1000 && !matchEnd) {
  await new Promise((r) => setTimeout(r, 250))
  const s = room.state
  const fetchers = [...s.players.values()].filter((p) => p.isBot && p.state === 'alive' && p.team === s.attackers)
  if (s.bombState === 'dropped' && s.roundPhase === 'live' && fetchers.length) {
    lying += 0.25
    longestLying = Math.max(longestLying, lying)
    if (lying % 5 === 0) log(`    bomb lying ${lying} s; nearest attacker bot ${Math.min(...fetchers.map((p) => Math.hypot(p.x - s.bombX, p.z - s.bombZ))).toFixed(1)} m`)
  } else {
    lying = 0
  }
  const me = s.players.get(room.sessionId)
  if (me?.state === 'deploying') room.send('spawn_request', {})
  if (me?.state === 'alive' && s.roundPhase === 'live' && Date.now() - lastBlown > 3000) {
    lastBlown = Date.now()
    room.send('th', { k: 'frag', cook: EQUIPMENT.frag.fuse, o: [me.x, me.y + 1.5, me.z], d: [0, -1, 0] })
  }
}

const s = room.state
const counted = seen.ends.filter((e) => e.counted)
const failures = []
if (!counted.length) failures.push('no round was won')
if (counted.some((e) => !e.winner || !e.why)) failures.push('a round ended without a winner or a reason')
if (s.phase === 'playing' && counted.length && s.scoreAlpha + s.scoreBravo !== counted.length) failures.push(`score ${s.scoreAlpha}+${s.scoreBravo} doesn't match ${counted.length} counted rounds`)
if (longestLying > 30) failures.push(`a dropped bomb lay ${longestLying.toFixed(0)} s with attacker bots alive to fetch it`)
const roundsPlayed = Math.max(0, ...seen.ends.map((e) => e.a + e.b))
if (roundsPlayed > SND.swapEvery && !seen.swap) failures.push('the sides never swapped')
if (matchEnd && Math.max(...[seen.ends.at(-1)?.a ?? 0, seen.ends.at(-1)?.b ?? 0]) !== SND.roundsToWin) failures.push('the match ended before a side reached the round limit')

console.log('\nsummary', JSON.stringify({ ...seen, ends: seen.ends.length, counted: counted.length, score: [s.scoreAlpha, s.scoreBravo], matchEnd: Boolean(matchEnd), longestLying }))
console.log(failures.length ? 'FAIL\n  ' + failures.join('\n  ') : 'all Search & Destroy checks passed')
await room.leave()
await server.gracefullyShutdown(false)
process.exit(failures.length ? 1 : 0)
