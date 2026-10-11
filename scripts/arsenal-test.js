/**
 * New weapons, end to end against the real room:
 *  - a Warhead rocket flies, bursts on the target and is credited to 'rpg',
 *  - a Breacher blast's pellets land as one summed hit,
 *  - kills award XP to the shooter.
 *
 *   node scripts/arsenal-test.js
 */
import { Server } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { Client } from '@colyseus/sdk'

import { findPath, getNavGraph, initPhysics, MapWorld, nearestNode } from '../src/game/physics.js'
import { DustlineRoom } from '../src/rooms/DustlineRoom.js'
import { PLAYER, ROOM_NAME, SPAWN_PROTECTION } from '../src/shared/constants.js'
import { chestPoint } from '../src/shared/hitbox.js'
import { XP } from '../src/shared/progression.js'
import { WEAPONS } from '../src/shared/weapons.js'

const PORT = 2596
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

const join = async (name, classData) => {
  const room = await new Client(`http://localhost:${PORT}`).joinOrCreate(ROOM_NAME, { mode: 'ffa', name, classData })
  const log = { spawn: null, hits: [], damaged: [], xp: [], kills: [], explosions: [] }
  room.onMessage('spawn', (m) => (log.spawn = m))
  room.onMessage('hit', (m) => log.hits.push(m))
  room.onMessage('damaged', (m) => log.damaged.push(m))
  room.onMessage('xp', (m) => log.xp.push(m))
  room.onMessage('kill', (m) => log.kills.push(m))
  room.onMessage('explosion', (m) => log.explosions.push(m))
  room.onMessage('*', () => {})
  return { room, log, pos: null }
}

const A = await join('Gunner', { name: 'BOOM', primary: 'shotgun', secondary: 'rpg', tactical: 'smoke' })
const B = await join('RocketTarget', { name: 'T', primary: 'ar', tactical: 'smoke' })
const C = await join('BlastTarget', { name: 'T', primary: 'ar', tactical: 'smoke' })
await wait(300)
for (const p of [A, B, C]) p.room.send('spawn_request', {})
await wait(500)
for (const p of [A, B, C]) p.pos = p.log.spawn.p
await wait(SPAWN_PROTECTION * 1000 + 100)

const world = new MapWorld()
const graph = getNavGraph(world)
const state = (p) => p.room.state.players.get(p.room.sessionId)
const eye = (p) => [p.pos[0], p.pos[1] + PLAYER.eyeHeight, p.pos[2]]

async function walk(p, to) {
  const from = p.pos
  const dist = Math.hypot(to[0] - from[0], to[2] - from[2])
  const n = Math.max(1, Math.ceil(dist / (PLAYER.walkSpeed * 0.033)))
  for (let i = 1; i <= n; i++) {
    const t = i / n
    p.pos = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t]
    p.room.send('m', { p: p.pos, yaw: 0, pitch: 0, f: 0, s: p.log.spawn.seq })
    await wait(33)
  }
}

/** Walks the shooter along the nav graph to a spot `lo`..`hi` m from the target with a clear view. */
async function approach(shooter, target, lo, hi) {
  const tc = chestPoint(...target.pos, 0)
  let goal = -1
  let best = Infinity
  graph.nodes.forEach((n, i) => {
    const d = Math.hypot(n[0] - target.pos[0], n[2] - target.pos[2])
    if (d < lo || d > hi || graph.kinds[i] === 'elevated') return
    if (d < best && world.clearLine([n[0], n[1] + PLAYER.eyeHeight, n[2]], tc, 0.3)) {
      goal = i
      best = d
    }
  })
  for (const i of findPath(graph, nearestNode(graph, world, shooter.pos), goal)) await walk(shooter, graph.nodes[i])
  await wait(250)
  return best
}

const aim = (from, to) => {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  const l = Math.hypot(...d)
  return d.map((v) => v / l)
}

// 1) Rocket into B.
const rocketRange = await approach(A, B, 5, 9)
A.room.send('sw', { w: 'rpg' })
await wait(WEAPONS.rpg.swapTime * 1000 + 150)
const bChest = chestPoint(...B.pos, 0)
A.room.send('fire', { w: 'rpg', o: eye(A), d: aim(eye(A), bChest) })
await wait(600)
const rocketKill = A.log.kills.find((k) => k.v === B.room.sessionId) ?? B.log.kills.find((k) => k.v === B.room.sessionId)
check(`rocket from ${rocketRange.toFixed(1)} m bursts on target (explosions ${A.log.explosions.length}, B hp ${state(B).hp})`, A.log.explosions.some((e) => e.k === 'rocket'))
check(`rocket kill credited to the launcher (weapon ${rocketKill?.w})`, rocketKill?.w === 'rpg' && rocketKill.k === A.room.sessionId)

// 2) Shotgun blast into C: every pellet on target, one summed hit.
const blastRange = await approach(A, C, 3, 6)
A.room.send('sw', { w: 'shotgun' })
await wait(WEAPONS.shotgun.swapTime * 1000 + 150)
const cChest = chestPoint(...C.pos, 0)
const centre = aim(eye(A), cChest)
const pellets = Array.from({ length: WEAPONS.shotgun.pellets }, (_, i) => {
  const a = (i / WEAPONS.shotgun.pellets) * Math.PI * 2
  const target = [cChest[0] + Math.cos(a) * 0.08, cChest[1] + Math.sin(a) * 0.08, cChest[2]]
  return { d: aim(eye(A), target), e: target, h: C.room.sessionId, z: 'chest' }
})
const hitsBefore = A.log.hits.length
A.room.send('fire', { w: 'shotgun', o: eye(A), d: centre, e: cChest, pl: pellets })
await wait(400)
const blastHits = A.log.hits.slice(hitsBefore)
check(`blast from ${blastRange.toFixed(1)} m lands as one hit (${blastHits.map((h) => h.dmg).join(',')} dmg, kill ${blastHits[0]?.kill})`, blastHits.length === 1 && blastHits[0].dmg >= 100 && blastHits[0].kill)
check(`victim felt one hit, not eight (damaged messages: ${C.log.damaged.length})`, C.log.damaged.length === 1)

// 3) XP for both kills.
const xpTotal = A.log.xp.reduce((a, x) => a + x.n, 0)
check(`kills award XP: ${A.log.xp.map((x) => `${x.why}+${x.n}`).join(' ')}`, A.log.xp.filter((x) => x.why === 'kill').length === 2 && xpTotal >= 2 * XP.kill)

world.dispose()
for (const p of [A, B, C]) await p.room.leave()
await server.gracefullyShutdown(false)
console.log(failures ? `${failures} FAILED` : 'all arsenal checks passed')
process.exit(failures ? 1 : 0)
