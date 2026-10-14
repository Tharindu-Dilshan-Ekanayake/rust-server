/**
 * The lethals and burst fire, with real clients in one FFA room: a burst
 * rifle's three rounds all landing, C4 thrown and set off by the detonator
 * (one out at a time), C4 set off by an enemy's bullet, a claymore that
 * ignores someone behind it and trips on someone in front, and semtex that
 * sticks to the player it hits.
 *
 * Players are put in place on the server (an open, level lane of the map) so
 * every distance is known.
 *
 *   node scripts/explosives-test.js
 */
import { matchMaker, Server } from 'colyseus'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { Client } from '@colyseus/sdk'

import { getNavGraph, initPhysics } from '../src/game/physics.js'
import { DustlineRoom } from '../src/rooms/DustlineRoom.js'
import { PLAYER, ROOM_NAME } from '../src/shared/constants.js'
import { chestPoint } from '../src/shared/hitbox.js'
import { WEAPONS } from '../src/shared/weapons.js'

const PORT = 2599
process.env.DISABLE_BOTS = '1'
await initPhysics()
const server = new Server({ transport: new WebSocketTransport(), greet: false })
server.define(ROOM_NAME, DustlineRoom).filterBy(['mode'])
await server.listen(PORT)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let failures = 0
function check(ok, label, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures++
}

async function join(name, classData) {
  const c = new Client(`http://localhost:${PORT}`)
  const room = await c.joinOrCreate(ROOM_NAME, { mode: 'ffa', name, classData: { name, tactical: 'smoke', ...classData } })
  const log = { hits: [], explosions: [], acts: [] }
  room.onMessage('hit', (m) => log.hits.push(m))
  room.onMessage('explosion', (m) => log.explosions.push(m))
  room.onMessage('act', (m) => log.acts.push(m))
  room.onMessage('*', () => {})
  return { room, log, id: room.sessionId }
}

const A = await join('ALPHA', { primary: 'strix', lethal: 'c4' })
const B = await join('BRAVO', { primary: 'ar', lethal: 'claymore' })
const C = await join('CHARLIE', { primary: 'ar', lethal: 'semtex' })
await wait(300)
for (const x of [A, B, C]) x.room.send('spawn_request', {})
await wait(600)

const room = matchMaker.getLocalRoomById(A.room.roomId)
const mw = room.mapWorld
const P = (x) => room.state.players.get(x.id)
const meta = (x) => room.meta.get(x.id)
const eye = (x) => [P(x).x, P(x).y + PLAYER.eyeHeight, P(x).z]
const toward = (from, to) => {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]]
  const l = Math.hypot(...d)
  return d.map((v) => v / l)
}
const reset = (x) => {
  P(x).hp = 100
  meta(x).protectedUntil = 0
}
for (const x of [A, B, C]) reset(x)

// An open, level lane 10 m long: nothing in the way at the knees or the chest.
const graph = getNavGraph(mw)
let lane = null
for (let i = 0; i < graph.nodes.length && !lane; i++) {
  if (graph.kinds[i] === 'elevated') continue
  const n = graph.nodes[i]
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const f = [-Math.sin(yaw), -Math.cos(yaw)]
    const ok = [-3, 2, 4, 6, 8, 10].every((s) => {
      const x = n[0] + f[0] * s
      const z = n[2] + f[1] * s
      const y = mw.groundY(x, n[1] + 1, z, 2)
      return y !== null && Math.abs(y - n[1]) < 0.15
    })
    const clear = (h) => mw.clearLine([n[0] - f[0] * 3, n[1] + h, n[2] - f[1] * 3], [n[0] + f[0] * 10, n[1] + h, n[2] + f[1] * 10], 0.45)
    if (ok && clear(0.3) && clear(1.3) && clear(1.7)) {
      lane = { o: n, yaw, f }
      break
    }
  }
}
if (!lane) throw new Error('no open lane on this map')
/** A point `s` metres down the lane (negative: behind its start), on the ground. */
const at = (s, side = 0) => {
  const x = lane.o[0] + lane.f[0] * s - lane.f[1] * side
  const z = lane.o[2] + lane.f[1] * s + lane.f[0] * side
  return [x, mw.groundY(x, lane.o[1] + 1, z, 2), z]
}
const put = (x, pos, yaw = lane.yaw) => {
  const p = P(x)
  p.x = pos[0]
  p.y = pos[1]
  p.z = pos[2]
  p.yaw = yaw
  meta(x).history = []
}
/** Somewhere well clear of the lane (and of each other), on the nav graph. */
const clear = graph.nodes.filter((n, i) => graph.kinds[i] !== 'elevated' && Math.hypot(n[0] - lane.o[0], n[2] - lane.o[2]) > 25)
const away = (k) => [...clear[k * 7]]
const far = () => [A, B, C].forEach((x, i) => put(x, away(i)))
const alive = (x) => P(x).state === 'alive'

// 1) Burst: the Strix's three rounds at the rifle's own spacing all land.
put(A, at(0))
put(B, at(6))
put(C, away(2))
{
  const w = WEAPONS.strix
  const hits0 = A.log.hits.length
  const chest = chestPoint(P(B).x, P(B).y, P(B).z, false)
  for (let i = 0; i < w.burst; i++) {
    A.room.send('fire', { w: 'strix', o: eye(A), d: toward(eye(A), chest), e: chest, h: B.id, z: 'chest' })
    await wait(w.fireInterval * 1000 + 5)
  }
  await wait(250)
  const landed = A.log.hits.length - hits0
  check(landed === w.burst, `burst: ${w.burst} rounds land`, `${landed} hits, B hp ${P(B).hp}`)
  reset(B)
}

// 2) C4: thrown, sticks, one out at a time, the detonator sets it off.
{
  put(A, at(0))
  put(B, away(1))
  put(C, away(2))
  A.room.send('th', { k: 'c4', o: eye(A), d: [lane.f[0] * 0.75, -0.66, lane.f[1] * 0.75] })
  await wait(1400)
  const mine = () => [...room.state.grenades.values()].filter((g) => g.owner === A.id && g.kind === 'c4')
  const c4 = mine()[0]
  check(Boolean(c4) && c4.stuck, 'c4: thrown and stuck where it landed', c4 ? `at ${c4.x.toFixed(1)}, ${c4.y.toFixed(1)}, ${c4.z.toFixed(1)}` : 'none')
  meta(A).lethal = 1
  A.room.send('th', { k: 'c4', o: eye(A), d: [lane.f[0], 0, lane.f[1]] })
  await wait(300)
  check(mine().length === 1, 'c4: a second one is refused while one is out', `${mine().length} out`)
  if (c4) {
    // The thrower well clear (their own C4 would kill them), a victim 4.5 m off it: hurt, not killed.
    put(A, away(0))
    const v = [c4.x + lane.f[0] * 4.5, 0, c4.z + lane.f[1] * 4.5]
    v[1] = mw.groundY(v[0], c4.y + 1.5, v[2], 3) ?? c4.y
    put(C, v)
    const n0 = C.log.explosions.length
    A.room.send('det', {})
    await wait(300)
    const boom = C.log.explosions.slice(n0).find((m) => m.k === 'c4')
    check(Boolean(boom), 'c4: the detonator sets it off')
    check(P(C).hp < 100 && P(C).hp > 0, 'c4: hurts a player 4.5 m away', `C hp ${P(C).hp}`)
    check(mine().length === 0, 'c4: gone after the blast')
  }
  reset(C)
}

// 3) An enemy's bullet sets off a C4 lying in the open.
check(alive(A) && alive(C), 'c4 shot: A and C alive going in')
{
  far()
  put(A, at(0))
  meta(A).lethal = 1
  A.room.send('th', { k: 'c4', o: eye(A), d: [lane.f[0] * 0.75, -0.66, lane.f[1] * 0.75] })
  await wait(1400)
  const c4 = [...room.state.grenades.values()].find((g) => g.owner === A.id && g.kind === 'c4')
  if (!c4) check(false, 'c4 shot: a second charge to shoot')
  else {
    put(A, away(0))
    put(C, at(10), lane.yaw + Math.PI)
    const target = [c4.x, c4.y + 0.12, c4.z]
    const n0 = C.log.explosions.length
    C.room.send('fire', { w: 'ar', o: eye(C), d: toward(eye(C), target), e: target })
    await wait(300)
    check(Boolean(C.log.explosions.slice(n0).find((m) => m.k === 'c4')), 'c4 shot: an enemy bullet sets it off')
  }
  reset(A)
  reset(C)
}

// 4) Claymore: planted facing down the lane; nobody trips it from behind, an enemy in front does.
check(alive(A) && alive(B), 'claymore: A and B alive going in')
{
  far()
  put(B, at(2))
  B.room.send('th', { k: 'claymore' })
  await wait(200)
  const clay = [...room.state.grenades.values()].find((g) => g.owner === B.id && g.kind === 'claymore')
  check(Boolean(clay) && clay.stuck, 'claymore: planted', clay ? `facing ${clay.yaw.toFixed(2)}` : 'none')
  put(B, away(1))
  await wait(1200)
  const n0 = A.log.explosions.length
  // Behind it (towards the lane's start), 1.8 m off.
  put(A, at(0.6 + 0.2))
  P(A).x = clay.x - lane.f[0] * 1.8
  P(A).z = clay.z - lane.f[1] * 1.8
  await wait(700)
  check(!A.log.explosions.slice(n0).length && P(A).hp === 100, 'claymore: no trip from behind', `hp ${P(A).hp}`)
  // In front, 2 m out.
  P(A).x = clay.x + lane.f[0] * 2
  P(A).z = clay.z + lane.f[1] * 2
  await wait(800)
  const boom = A.log.explosions.slice(n0).find((m) => m.k === 'claymore')
  const tripped = A.log.acts.some((m) => m.a === 'trip')
  check(tripped && Boolean(boom), 'claymore: trips on an enemy in front (click, then blast)')
  check(!alive(A), 'claymore: kills at 2 m', `A hp ${P(A).hp}`)
}

// 5) Semtex: thrown at a player, it sticks to them and goes off where they are.
check(alive(B) && alive(C), 'semtex: B and C alive going in')
{
  put(C, at(0))
  put(B, at(4))
  reset(B)
  reset(C)
  const n0 = B.log.explosions.length
  const chest = chestPoint(P(B).x, P(B).y, P(B).z, false)
  C.room.send('th', { k: 'semtex', o: eye(C), d: toward(eye(C), chest) })
  await wait(500)
  const sem = [...room.state.grenades.values()].find((g) => g.owner === C.id && g.kind === 'semtex')
  const gd = sem && room.grenadeBodies.get(sem.id)
  check(Boolean(gd?.stuckTo), 'semtex: sticks to the player it hits', gd ? `stuck to ${gd.stuckTo === B.id ? 'B' : gd.stuckTo}` : 'gone')
  // B runs; it goes with them.
  put(B, at(7))
  await wait(2400)
  const boom = B.log.explosions.slice(n0).find((m) => m.k === 'semtex')
  const off = boom ? Math.hypot(boom.p[0] - P(B).x, boom.p[2] - P(B).z) : Infinity
  check(Boolean(boom) && off < 1, 'semtex: goes off on them, where they ran to', boom ? `${off.toFixed(2)} m off` : 'no blast')
  check(!alive(B), 'semtex: kills them', `B hp ${P(B).hp}`)
}

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
for (const x of [A, B, C]) await x.room.leave()
await server.gracefullyShutdown(false)
process.exit(failures ? 1 : 0)
