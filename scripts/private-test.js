/**
 * Private rooms: create one with a key, join it by key from a second client,
 * make sure a bad key fails and public matchmaking never lands in it.
 *
 *   node scripts/private-test.js
 */
import { Server } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { Client } from '@colyseus/sdk'

import { initPhysics } from '../src/game/physics.js'
import { DustlineRoom } from '../src/rooms/DustlineRoom.js'
import { ROOM_NAME } from '../src/shared/constants.js'

const PORT = 2599
await initPhysics()
const server = new Server({ transport: new WebSocketTransport(), greet: false })
server.define(ROOM_NAME, DustlineRoom).filterBy(['mode'])
await server.listen(PORT)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const client = () => new Client(`http://localhost:${PORT}`)
let failures = 0
const check = (label, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

const host = await client().create(ROOM_NAME, { mode: 'ffa', private: true, maxPlayers: 4, bots: false, name: 'Host' })
await wait(300)
const code = host.state.roomCode
check(`host got a key (${code})`, /^[A-Z2-9]{6}$/.test(code) && host.roomId === code)
check('max players respected', host.state.maxPlayers === 4)

const guest = await client().joinById(code, { name: 'Guest' })
await wait(300)
check('guest joined the same room by key', guest.roomId === code && host.state.players.size === 2)
check('bots off when asked', [...host.state.players.values()].every((p) => !p.isBot))

let badFailed = false
try {
  await client().joinById('ZZZZZZ', { name: 'Nope' })
} catch {
  badFailed = true
}
check('wrong key is refused', badFailed)

// Warm-up: no clock until the host starts; only the host can start.
check('private room starts in warm-up', host.state.phase === 'warmup' && host.state.host === host.sessionId)
const t0 = host.state.timeLeft
guest.send('start_match', {})
await wait(1300)
check('guest cannot start the match', host.state.phase === 'warmup' && host.state.timeLeft === t0)
host.send('start_match', {})
await wait(1300)
check('host starts the match, clock runs', host.state.phase === 'playing' && host.state.timeLeft < t0)

const pub = await client().joinOrCreate(ROOM_NAME, { mode: 'ffa', name: 'Public' })
await wait(200)
check('public matchmaking does not join the private room', pub.roomId !== code)

// Fill to the cap: 2 more fit, the 5th is refused.
const extra = [await client().joinById(code, { name: 'C' }), await client().joinById(code, { name: 'D' })]
let fullFailed = false
try {
  await client().joinById(code, { name: 'E' })
} catch {
  fullFailed = true
}
check('room refuses players past its cap', fullFailed)

const tdm = await client().create(ROOM_NAME, { mode: 'tdm', private: true, maxPlayers: 6, name: 'TDM host' })
await wait(400)
const bots = [...tdm.state.players.values()].filter((p) => p.isBot).length
check(`private TDM fills with bots (${bots})`, bots === 6 - 1 || bots === 5 || bots === 6)

// Host leaves: the longest-standing player takes over.
await host.leave()
await wait(300)
check('host role passes on when the host leaves', guest.state.host === guest.sessionId)
for (const r of [guest, pub, tdm, ...extra]) await r.leave().catch(() => {})
await server.gracefullyShutdown(false)
console.log(failures ? `${failures} FAILED` : 'all private-room checks passed')
process.exit(failures ? 1 : 0)
