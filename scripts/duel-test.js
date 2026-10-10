/**
 * Two real clients in one FFA room: B stands still, A walks over and shoots.
 * Verifies movement validation, the noclip guard, hit validation and damage.
 *
 *   node scripts/duel-test.js
 */
import { Server } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { Client } from '@colyseus/sdk'

import { findPath, getNavGraph, initPhysics, MapWorld, nearestNode } from '../src/game/physics.js'
import { DustlineRoom } from '../src/rooms/DustlineRoom.js'
import { PLAYER, ROOM_NAME } from '../src/shared/constants.js'
import { chestPoint } from '../src/shared/hitbox.js'

const PORT = 2598
process.env.DISABLE_BOTS = '1'
await initPhysics()
const server = new Server({ transport: new WebSocketTransport(), greet: false })
server.define(ROOM_NAME, DustlineRoom).filterBy(['mode'])
await server.listen(PORT)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const join = async (name) => {
  const c = new Client(`http://localhost:${PORT}`)
  const room = await c.joinOrCreate(ROOM_NAME, { mode: 'ffa', name, classData: { name: 'T', primary: 'ar', tactical: 'smoke' } })
  const log = { spawn: null, corrections: 0, hits: [], damaged: [] }
  room.onMessage('spawn', (m) => (log.spawn = m))
  room.onMessage('correct', () => log.corrections++)
  room.onMessage('hit', (m) => log.hits.push(m))
  room.onMessage('damaged', (m) => log.damaged.push(m))
  room.onMessage('*', () => {})
  return { room, log }
}

const A = await join('Alpha')
const B = await join('Bravo')
await wait(300)
A.room.send('spawn_request', {})
B.room.send('spawn_request', {})
await wait(400)
console.log('A spawn', A.log.spawn.p.map((v) => v.toFixed(1)), 'B spawn', B.log.spawn.p.map((v) => v.toFixed(1)))

async function walk(client, from, to, seq) {
  const dist = Math.hypot(to[0] - from[0], to[2] - from[2])
  const step = dist > 0 ? (PLAYER.walkSpeed * 0.05) / dist : 1
  let pos = from
  for (let t = step; t <= 1 + step; t += step) {
    pos = [from[0] + (to[0] - from[0]) * Math.min(1, t), to[1], from[2] + (to[2] - from[2]) * Math.min(1, t)]
    client.room.send('m', { p: pos, yaw: 0, pitch: 0, f: 0, s: seq })
    await wait(50)
  }
  return pos
}

// 1) Walk A along the nav graph to a node that can see B from 6-14 m away.
const world = new MapWorld()
const graph = getNavGraph(world)
const bState0 = B.room.state.players.get(B.room.sessionId)
const bChest = chestPoint(bState0.x, bState0.y, bState0.z, false)
let goal = -1
let goalD = Infinity
graph.nodes.forEach((n, i) => {
  const d = Math.hypot(n[0] - bState0.x, n[2] - bState0.z)
  if (d < 6 || d > 14 || graph.kinds[i] === 'elevated') return
  if (d < goalD && world.clearLine([n[0], n[1] + PLAYER.eyeHeight, n[2]], bChest, 0.3)) {
    goal = i
    goalD = d
  }
})
const start = nearestNode(graph, world, A.log.spawn.p)
const path = findPath(graph, start, goal)
let cur = A.log.spawn.p
for (const i of path) cur = await walk(A, cur, graph.nodes[i], A.log.spawn.seq)
await wait(300)
const aState = A.room.state.players.get(A.room.sessionId)
const bState = B.room.state.players.get(B.room.sessionId)
console.log('after path walk (' + path.length + ' nodes): A', aState.x.toFixed(1), aState.z.toFixed(1), 'B', bState.x.toFixed(1), bState.z.toFixed(1), 'corrections', A.log.corrections)

// 3) A shoots B in the chest 5 times (respecting fire rate).
const eye = [aState.x, aState.y + PLAYER.eyeHeight, aState.z]
const chest = chestPoint(bState.x, bState.y, bState.z, false)
const d = [chest[0] - eye[0], chest[1] - eye[1], chest[2] - eye[2]]
const len = Math.hypot(...d)
const dir = d.map((v) => v / len)
for (let i = 0; i < 5; i++) {
  A.room.send('fire', { w: 'ar', o: eye, d: dir, e: chest, h: B.room.sessionId, z: 'chest' })
  await wait(100)
}
await wait(300)
console.log('A hits', A.log.hits.length, A.log.hits.map((h) => h.dmg).join(','), '| B damaged', B.log.damaged.map((x) => x.hp).join(','), '| B hp', B.room.state.players.get(B.room.sessionId).hp)

// 4) Cheat attempt: claim a headshot through the tower's pump block from far away.
const fake = [0, 1.0, 0]
A.room.send('fire', { w: 'ar', o: eye, d: [1, 0, 0], e: fake, h: B.room.sessionId, z: 'head' })
await wait(200)
console.log('after bogus shot, A hits', A.log.hits.length)

// 5) Noclip attempt: walk A straight through the shack.
const before = A.log.corrections
const target = [20, 0, 22]
await walk(A, [aState.x, aState.y, aState.z], target, A.log.spawn.seq)
await wait(200)
const a2 = A.room.state.players.get(A.room.sessionId)
console.log('noclip into shack: server has A at', a2.x.toFixed(1), a2.z.toFixed(1), 'new corrections', A.log.corrections - before)

world.dispose()
await A.room.leave()
await B.room.leave()
await server.gracefullyShutdown(false)
process.exit(0)
