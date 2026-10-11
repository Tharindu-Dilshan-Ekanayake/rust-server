/**
 * How many rooms one pod can hold: starts the real server as a child process
 * (production mode, a stats line every 5 s), opens ROOMS full rooms (1 player +
 * 7 bots each: bots are the expensive part) and prints the server's CPU,
 * event-loop lag and memory for each step.
 *
 *   npm run test:load            # 1, 2, 4 rooms
 *   STEPS=1,2,3,4,6 npm run test:load
 *
 * A Legion pod is 1 vCPU / 512 MB; set the deploy's seatCap so a full pod stays
 * well under 100% CPU with lag p99 close to the 33 ms tick.
 */
import { spawn } from 'node:child_process'
import { Client } from '@colyseus/sdk'

import { ROOM_NAME } from '../src/shared/constants.js'

const PORT = 2597
const STEPS = (process.env.STEPS || '1,2,4').split(',').map(Number)
const SAMPLE_S = Number(process.env.SAMPLE_S || 15)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const server = spawn(process.execPath, ['src/server.js'], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production', STATS_INTERVAL: '5' },
  stdio: ['ignore', 'pipe', 'inherit'],
})
let lastStats = ''
server.stdout.on('data', (d) => {
  for (const line of String(d).split('\n')) if (line.startsWith('[stats')) lastStats = line.replace(/^\[stats [^\]]+\] /, '')
})
for (let i = 0; i < 100 && !lastStats; i++) await wait(100)
await wait(500)

const client = new Client(`http://localhost:${PORT}`)
const rooms = []
const opts = { name: 'Load', classData: { name: 'TEST', primary: 'ar', tactical: 'flash' } }
try {
  for (const target of STEPS) {
    while (rooms.length < target) {
      const room = await client.create(ROOM_NAME, { mode: 'tdm', private: true, maxPlayers: 8, bots: true, ...opts })
      room.onMessage('*', () => {})
      await wait(200)
      room.send('choose_team', { team: 'auto' })
      await wait(200)
      room.send('spawn_request', {})
      rooms.push(room)
    }
    // Skip the line that straddles the step, then take the worst of the rest.
    await wait(6000)
    const lines = []
    const until = Date.now() + SAMPLE_S * 1000
    let prev = lastStats
    while (Date.now() < until) {
      await wait(250)
      if (lastStats !== prev) lines.push((prev = lastStats))
    }
    console.log(`${String(target).padStart(2)} rooms (${target * 8} players incl. bots):`)
    for (const l of lines) console.log(`     ${l}`)
  }
} finally {
  for (const r of rooms) await r.leave().catch(() => {})
  server.kill()
}
process.exit(0)
