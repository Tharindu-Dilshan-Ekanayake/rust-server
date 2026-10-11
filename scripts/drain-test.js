/**
 * Deploy drain: what players see when the server is told to shut down.
 *
 *   npm run test:drain
 *
 * Boots the room in-process in production mode with short matches, puts one
 * player mid-match and one in a private warm-up, then starts the shutdown that
 * SIGTERM would. Expected: the warm-up player is moved on at once (close code
 * SERVER_MOVING_CODE), nobody new can join, the match plays out, shows its results
 * and then moves its player on, and the shutdown completes once both rooms are gone.
 */
process.env.NODE_ENV = 'production'
process.env.MATCH_TIME_LIMIT = '4'

const { Server } = await import('colyseus')
const { WebSocketTransport } = await import('@colyseus/ws-transport')
const { Client } = await import('@colyseus/sdk')
const { initPhysics } = await import('../src/game/physics.js')
const { DustlineRoom } = await import('../src/rooms/DustlineRoom.js')
const { MATCH_END_DURATION, ROOM_NAME, SERVER_MOVING_CODE } = await import('../src/shared/constants.js')

const PORT = 2598
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = false
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) failed = true
}

await initPhysics()
const server = new Server({ transport: new WebSocketTransport(), greet: false, gracefullyShutdown: false })
server.define(ROOM_NAME, DustlineRoom).filterBy(['mode'])
await server.listen(PORT)

const client = new Client(`http://localhost:${PORT}`)
const opts = { name: 'Tester', classData: { name: 'TEST', primary: 'ar', tactical: 'flash' } }

// Mid-match player.
const fighter = await client.joinOrCreate(ROOM_NAME, { mode: 'tdm', ...opts })
fighter.onMessage('*', () => {})
const notices = []
fighter.onMessage('notice', (m) => notices.push(m.text))
await wait(300)
fighter.send('choose_team', { team: 'auto' })
await wait(300)
fighter.send('spawn_request', {})
await wait(300)

// Private warm-up player.
const idler = await client.create(ROOM_NAME, { mode: 'tdm', private: true, maxPlayers: 4, ...opts })
idler.onMessage('*', () => {})
await wait(300)

const left = {}
const t0 = Date.now()
fighter.onLeave((code) => (left.fighter = { code, at: Date.now() - t0, phase: fighter.state.phase }))
idler.onLeave((code) => (left.idler = { code, at: Date.now() - t0 }))

let shutdownDone = 0
server.gracefullyShutdown(false).then(() => (shutdownDone = Date.now() - t0))
await wait(500)

check(left.idler?.code === SERVER_MOVING_CODE, `warm-up player moved on at once (code ${left.idler?.code}, ${left.idler?.at} ms)`)
check(!left.fighter, 'mid-match player is still playing')
check(notices.some((n) => /LAST MATCH/.test(n)), `mid-match player was told: "${notices[0] ?? ''}"`)

let joinError = ''
try {
  const late = await new Client(`http://localhost:${PORT}`).joinOrCreate(ROOM_NAME, { mode: 'tdm', ...opts })
  await late.leave()
} catch (err) {
  joinError = String(err?.message ?? err)
}
check(Boolean(joinError), `new joins are refused while draining (${joinError.slice(0, 60)})`)

// The 4 s match ends, the results show for MATCH_END_DURATION, then everyone moves on.
const limit = (4 + MATCH_END_DURATION + 5) * 1000
while (!left.fighter && Date.now() - t0 < limit) await wait(250)
check(left.fighter?.code === SERVER_MOVING_CODE, `mid-match player moved on after the results (code ${left.fighter?.code}, ${(left.fighter?.at / 1000).toFixed(1)} s, phase ${left.fighter?.phase})`)
while (!shutdownDone && Date.now() - t0 < limit + 3000) await wait(100)
check(shutdownDone > 0, `shutdown finished once the rooms were empty (${(shutdownDone / 1000).toFixed(1)} s)`)

console.log(failed ? '\nDRAIN TEST FAILED' : '\nall drain checks passed')
process.exit(failed ? 1 : 0)
