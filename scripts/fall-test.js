/**
 * Fall damage, decided by the server from the positions clients send:
 *  - a hop on flat ground and walking down stairs are free,
 *  - stepping off the 5 m stair landing hurts a little,
 *  - jumping off the tower kills (credited as a fall).
 *
 *   node scripts/fall-test.js
 */
import { Server } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { Client } from '@colyseus/sdk'

import { findPath, getNavGraph, initPhysics, MapWorld, nearestNode } from '../src/game/physics.js'
import { DustlineRoom } from '../src/rooms/DustlineRoom.js'
import { fallDamage, ROOM_NAME, SPAWN_PROTECTION } from '../src/shared/constants.js'
import { STAIRS, TOWER } from '../src/shared/map.js'

const PORT = 2597
process.env.DISABLE_BOTS = '1'
await initPhysics()
const server = new Server({ transport: new WebSocketTransport(), greet: false })
server.define(ROOM_NAME, DustlineRoom).filterBy(['mode'])
await server.listen(PORT)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (label, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

const c = new Client(`http://localhost:${PORT}`)
const room = await c.joinOrCreate(ROOM_NAME, { mode: 'ffa', name: 'Faller', classData: { name: 'T', primary: 'ar', tactical: 'smoke' } })
const log = { spawn: null, fell: [], damaged: [], kills: [], corrections: 0 }
room.onMessage('spawn', (m) => (log.spawn = m))
room.onMessage('fell', (m) => log.fell.push(m))
room.onMessage('damaged', (m) => log.damaged.push(m))
room.onMessage('kill', (m) => log.kills.push(m))
room.onMessage('correct', () => log.corrections++)
room.onMessage('*', () => {})
await wait(300)
room.send('spawn_request', {})
await wait(400)
const me = () => room.state.players.get(room.sessionId)
// Wait out spawn protection so damage applies.
await wait(SPAWN_PROTECTION * 1000 + 100)

let pos = log.spawn.p
const send = (p, f = 0) => room.send('m', { p, yaw: 0, pitch: 0, f, s: log.spawn.seq })

/** Walks (and climbs/descends) in straight lines at walking pace, height eased along. */
async function walkTo(to, flags = 0) {
  const from = pos
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  const n = Math.max(1, Math.ceil(dist / 0.2))
  for (let i = 1; i <= n; i++) {
    const t = i / n
    pos = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t]
    send(pos, flags)
    await wait(40)
  }
}

/** Falls under gravity from the current spot to floor height `toY`, drifting by (dx, dz). */
async function fallTo(toY, dx, dz) {
  let v = 0
  const from = pos
  let y = pos[1]
  let k = 0
  while (y > toY) {
    v += 20 * 0.04
    y = Math.max(toY, y - v * 0.04)
    k = Math.min(1, k + 0.15)
    pos = [from[0] + dx * k, y, from[2] + dz * k]
    send(pos)
    await wait(40)
  }
  for (let i = 0; i < 4; i++) {
    send(pos)
    await wait(40)
  }
}

const world = new MapWorld()
const graph = getNavGraph(world)

// 1) A hop on flat ground: no damage.
const hopFrom = pos
await walkTo([hopFrom[0], hopFrom[1] + 1.3, hopFrom[2]])
await fallTo(hopFrom[1], 0, 0)
await wait(200)
check(`hop on flat ground is free (hp ${me().hp})`, me().hp === 100 && log.fell.length === 0)

// 2) Walk to the stairs, up to the 5 m landing, back down the stairs: still free.
// Which way the stairs climb along z.
const up = Math.sign(STAIRS.top[2] - STAIRS.bottom[2])
const bottom = [STAIRS.bottom[0], 0, STAIRS.bottom[2] - 0.9 * up]
const path = findPath(graph, nearestNode(graph, world, pos), nearestNode(graph, world, bottom))
for (const i of path) await walkTo(graph.nodes[i])
await walkTo(bottom)
const landing = [STAIRS.top[0], STAIRS.top[1], STAIRS.top[2] + 0.6 * up]
await walkTo(landing)
await walkTo(bottom)
await wait(200)
check(`walking down the stairs is free (hp ${me().hp}, corrections ${log.corrections})`, me().hp === 100 && log.fell.length === 0)

// 3) Back up, then step off the landing's open side (the other is the tank): hurts, doesn't kill.
await walkTo(landing)
const side = [-1, 1].find((s) => (world.groundY(landing[0] + s * 2.2, 4.5, landing[2]) ?? 0) < 0.5) ?? -1
await walkTo([landing[0] + side * 0.9, landing[1], landing[2]])
const ground = world.groundY(landing[0] + side * 2.2, 4.5, landing[2]) ?? 0
await fallTo(ground, side * 1.3, 0)
await wait(250)
const expect = fallDamage(landing[1] - ground)
check(
  `5 m drop hurts: ${log.fell.map((f) => `${f.h} m -> ${f.dmg}`).join(', ')} (hp ${me().hp}, expected about ${100 - expect})`,
  log.fell.length === 1 && me().hp < 100 && me().hp > 0,
)

// 4) Up the derrick ladder and off the top: lethal, and credited to the fall.
const tx = TOWER.p[0] + TOWER.ladderX
const tz = TOWER.p[2]
const towerPath = findPath(graph, nearestNode(graph, world, pos), nearestNode(graph, world, [tx, 0, tz + TOWER.ladderZ + 1.5]))
for (const i of towerPath) await walkTo(graph.nodes[i])
await walkTo([tx, 0, tz + TOWER.ladderZ + 0.3])
await walkTo([tx, TOWER.platformTop + 0.03, tz + TOWER.ladderZ + 0.3], 8)
await walkTo([tx, TOWER.platformTop + 0.03, tz + 1.4])
await walkTo([tx, TOWER.platformTop + 1.2, tz - 1.9])
await walkTo([tx, TOWER.platformTop + 1.2, tz - 2.9])
await fallTo(0.03, 0, -1.2)
await wait(300)
const fallKill = log.kills.find((k) => k.v === room.sessionId)
check(`tower jump kills (${log.fell.at(-1)?.h} m, state ${me().state}, weapon ${fallKill?.w})`, me().state === 'dead' && fallKill?.w === 'fall' && !fallKill.k)

world.dispose()
await room.leave()
await server.gracefullyShutdown(false)
console.log(failures ? `${failures} FAILED` : 'all fall checks passed')
process.exit(failures ? 1 : 0)
