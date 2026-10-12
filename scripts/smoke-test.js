/**
 * Headless end-to-end check: boots the room in-process, joins as a fake client,
 * picks a team, deploys, and lets the bots play for a while.
 *
 *   npm run test:bots            (MAP=acres or MAP=palmwood, MODE=ffa, SECONDS=40)
 */
import { Server } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { Client } from '@colyseus/sdk'

import { getNavGraph, initPhysics, MapWorld } from '../src/game/physics.js'
import { DustlineRoom } from '../src/rooms/DustlineRoom.js'
import { ROOM_NAME } from '../src/shared/constants.js'
import { getMap } from '../src/shared/maps.js'

const PORT = 2599
const SECONDS = Number(process.env.SECONDS || 20)
const MAP = process.env.MAP || 'dustline'

await initPhysics()

const nav = getNavGraph(new MapWorld(getMap(MAP)))
const linkCount = nav.links.reduce((n, l) => n + l.length, 0) / 2
const isolated = nav.links.map((l, i) => (l.length === 0 ? i : -1)).filter((i) => i >= 0)
console.log(`nav: ${nav.nodes.length} nodes, ${linkCount} links, isolated: ${JSON.stringify(isolated.map((i) => nav.nodes[i]))}`)

const server = new Server({ transport: new WebSocketTransport(), greet: false })
server.define(ROOM_NAME, DustlineRoom).filterBy(['mode', 'map'])
await server.listen(PORT)

const client = new Client(`http://localhost:${PORT}`)
const room = await client.joinOrCreate(ROOM_NAME, {
  mode: process.env.MODE || 'tdm',
  map: MAP,
  name: 'Tester',
  classData: { name: 'TEST', primary: 'ar', tactical: 'flash' },
})

const counts = { shot: 0, kill: 0, explosion: 0, flash: 0, damaged: 0, melee: 0 }
for (const type of Object.keys(counts)) room.onMessage(type, () => counts[type]++)
room.onMessage('kill', (m) => {
  counts.kill++
  const name = (id) => room.state.players.get(id)?.name ?? id
  console.log(`  kill: ${name(m.k)} [${m.w}${m.hs ? ' HS' : ''}] ${name(m.v)}`)
})
let spawned = null
room.onMessage('spawn', (m) => (spawned = m))
room.onMessage('team_assigned', (m) => console.log('team_assigned', m))
room.onMessage('*', () => {})

await new Promise((r) => setTimeout(r, 300))
if (room.state.mode === 'tdm') room.send('choose_team', { team: 'auto' })
await new Promise((r) => setTimeout(r, 300))
room.send('spawn_request', {})
await new Promise((r) => setTimeout(r, 300))
console.log('spawned at', spawned?.p, 'class', spawned?.classData?.name, 'ammo', JSON.stringify(spawned?.ammo))

const start = Date.now()
const travelled = new Map()
const last = new Map()
/** Highest a bot got (upstairs, on a roof, in the bus or the truck). */
const highest = new Map()
while (Date.now() - start < SECONDS * 1000) {
  await new Promise((r) => setTimeout(r, 500))
  for (const p of room.state.players.values()) {
    if (!p.isBot) continue
    const prev = last.get(p.id)
    if (prev && p.state === 'alive') travelled.set(p.id, (travelled.get(p.id) ?? 0) + Math.hypot(p.x - prev[0], p.z - prev[1]))
    last.set(p.id, [p.x, p.z])
    if (p.state === 'alive') highest.set(p.id, Math.max(highest.get(p.id) ?? -9, p.y))
  }
}

console.log('\nplayers:')
for (const p of room.state.players.values()) {
  console.log(
    `  ${p.name.padEnd(14)} team=${p.team.padEnd(6)} state=${p.state.padEnd(9)} hp=${String(p.hp).padStart(3)} ` +
      `k/d=${p.kills}/${p.deaths} pos=(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}) moved=${(travelled.get(p.id) ?? 0).toFixed(0)}m` +
      (p.isBot ? ` highest=${(highest.get(p.id) ?? 0).toFixed(1)}m` : ''),
  )
}
console.log('score', room.state.scoreAlpha, room.state.scoreBravo, 'timeLeft', room.state.timeLeft)
console.log('events', counts)

await room.leave()
await server.gracefullyShutdown(false)
process.exit(0)
