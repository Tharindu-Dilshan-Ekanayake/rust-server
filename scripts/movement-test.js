/**
 * Headless movement check against the real map colliders, using the same Rapier
 * character-controller settings as the client's LocalPlayer.
 *
 *   node scripts/movement-test.js
 *
 * Each route walks a scripted path and reports where the player ended up, so a
 * collider tweak can be verified without opening the game.
 */
import RAPIER from '@dimforge/rapier3d-compat'

import { interactionGroups, PLAYER, PLAYER_GROUPS } from '../src/shared/constants.js'
import { buildColliders, ladderAt, LADDERS } from '../src/shared/map.js'

await RAPIER.init({})
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
for (const c of buildColliders()) {
  const desc =
    c.shape === 'box' ? RAPIER.ColliderDesc.cuboid(...c.half) : RAPIER.ColliderDesc.cylinder(c.halfHeight, c.r)
  desc
    .setTranslation(...c.p)
    .setRotation({ x: c.q[0], y: c.q[1], z: c.q[2], w: c.q[3] })
    .setCollisionGroups(interactionGroups(c.group, 0xffff))
  world.createCollider(desc)
}
world.step()

const R = PLAYER.radius
const HALF = PLAYER.height / 2 - R

function makePlayer(p) {
  const controller = world.createCharacterController(0.03)
  controller.setUp({ x: 0, y: 1, z: 0 })
  controller.enableAutostep(0.42, 0.15, false)
  controller.enableSnapToGround(0.35)
  controller.setMaxSlopeClimbAngle((52 * Math.PI) / 180)
  controller.setMinSlopeSlideAngle((60 * Math.PI) / 180)
  controller.setSlideEnabled(true)
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(HALF, R).setTranslation(p[0], p[1] + HALF + R + 0.02, p[2]).setCollisionGroups(PLAYER_GROUPS),
  )
  return { controller, collider, vel: { x: 0, y: 0, z: 0 }, grounded: false, climbing: false, airLock: 0 }
}

function feet(pl) {
  const t = pl.collider.translation()
  return [t.x, t.y - HALF - R, t.z]
}

/** One 60 Hz step: yaw (0 = -Z), forward input, jump flag. */
function step(pl, yaw, forward, jump = false) {
  const dt = 1 / 60
  const f = feet(pl)
  const fx = -Math.sin(yaw)
  const fz = -Math.cos(yaw)
  const v = pl.vel
  const ladder = ladderAt(f[0], f[1], f[2])
  if (!pl.climbing && ladder && forward > 0 && fx * ladder.exitDir[0] + fz * ladder.exitDir[2] > 0.3) pl.climbing = true
  if (pl.climbing && !ladder) pl.climbing = false
  if (pl.climbing) {
    v.y = forward * PLAYER.climbSpeed
    v.x = (ladder.x - f[0]) * 8
    v.z = (ladder.z - f[2]) * 8
    if (forward > 0 && f[1] >= ladder.topY + 0.02) {
      v.x = ladder.exitDir[0] * 3
      v.z = ladder.exitDir[2] * 3
      v.y = 0.5
    }
  } else {
    const k = Math.min(1, (pl.grounded ? 14 : 3) * dt)
    v.x += (fx * forward * PLAYER.walkSpeed - v.x) * k
    v.z += (fz * forward * PLAYER.walkSpeed - v.z) * k
    if (pl.grounded && jump) {
      v.y = PLAYER.jumpVelocity
      pl.airLock = 11 // frames (~0.18 s) during which edge contacts don't count as ground
    } else if (pl.grounded) v.y = -2
    else v.y -= PLAYER.gravity * dt
  }
  const desired = { x: v.x * dt, y: v.y * dt, z: v.z * dt }
  pl.controller.computeColliderMovement(pl.collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, PLAYER_GROUPS)
  const mv = pl.controller.computedMovement()
  const t = pl.collider.translation()
  pl.collider.setTranslation({ x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z })
  if (pl.airLock > 0) pl.airLock--
  pl.grounded = pl.controller.computedGrounded() && pl.airLock === 0
  if (v.y > 0 && mv.y < desired.y * 0.5) v.y = 0
}

function run(name, start, script) {
  const pl = makePlayer(start)
  for (let i = 0; i < 20; i++) step(pl, 0, 0)
  const trace = []
  for (const [yaw, forward, seconds, jumpAt] of script) {
    const n = Math.round(seconds * 60)
    for (let i = 0; i < n; i++) step(pl, yaw, forward, jumpAt !== undefined && i === Math.round(jumpAt * 60))
    trace.push(feet(pl).map((v) => v.toFixed(2)).join(', '))
  }
  console.log(`${name.padEnd(22)} ${trace.map((t) => `(${t})`).join(' -> ')}`)
  world.removeCollider(pl.collider, false)
  world.removeCharacterController(pl.controller)
}

const W = Math.PI / 2 // facing west (-X)
const E = -Math.PI / 2 // facing east (+X)
const S = Math.PI // facing south (+Z)
const yawTo = (from, to) => Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]))

run('ladder to derrick top', [LADDERS[0].x, 0, LADDERS[0].z + 0.8], [[0, 1, 2], [0, 1, 3.5], [0, 1, 0.6]])
run('stairs to landing', [-15.2, 0, 16.4], [[S, 1, 1], [S, 1, 1.5], [S, 1, 0.5]])
run('landing to tank tops', [-15.55, 5, 25.5], [[W, 1, 1], [W, 1, 1.4]])
run('tank gap (flank)', [-22.6, 0, 19.5], [[S, 1, 2.6]])
run('under the pipeline', [11.5, 0, -23.5], [[0, 1, 0.8], [0, 1, 0.8]])
run('up the fallen pipe', [-10.6, 0, -26.95], [[E, 1, 1.2], [E, 1, 1.2], [E, 1, 1.0]])
run('conveyor to deck', [-15.5, 0, 2], [[E, 1, 1.5], [E, 1, 1.5], [E, 1, 0.6]])
run('ladder to refinery deck', [7.0, 0, 2.4], [[W, 1, 0.6], [W, 1, 1.6]])
run('ladder to tank platform', [3.2, 3.6, 2.3], [[0, 1, 0.6], [0, 1, 1.8]])
run('ladder to process tower', [0.8, 6.6, -1.9], [[W, 1, 0.6], [W, 1, 2.4]])
run('into the hall', [-2.8, 0, 6], [[0, 1, 1.0], [0, 1, 0.6]])
run('west house upstairs', [-15.4, 0, 0.75], [[W, 1, 1.6], [W, 1, 0.4], [0, 1, 0.6], [W, 1, 0.5]])
run('outpost roof ramp', [0.4, 0, -23], [[W, 1, 0.8], [W, 1, 0.9]])
run('south block roof', [1.0, 0, 14.4], [[S, 1, 1.0], [S, 1, 0.8], [S, 1, 0.5]])
run('open container walk', [-11.5, 0, 9], [[S, 1, 2]])
run('shack door', [15.5, 0, 22], [[E, 1, 1.5]])
run('crates onto container', [-17.6, 0, 19.8], [
  [yawTo([-17.6, 19.8], [-18.45, 19.0]), 1, 0.3, 0.02], [0, 0, 0.6],
  [yawTo([-18.45, 19.0], [-19.45, 18.0]), 1, 0.3, 0.02], [0, 0, 0.6],
  [W, 1, 0.35, 0.02], [W, 1, 0.6],
])
run('crates onto shack roof', [19.2, 0, 15.4], [
  [yawTo([19.2, 15.4], [19.9, 17.1]), 1, 0.4, 0.02], [0, 0, 0.6],
  [yawTo([19.9, 17.1], [21.25, 18.2]), 1, 0.3, 0.02], [0, 0, 0.6],
  [S, 1, 0.35, 0.02], [S, 1, 0.6],
])
run('refinery south stairs', [2.6, 0, 11], [[0, 1, 1.2], [0, 1, 1.0], [0, 1, 0.6]])
run('round the tanker', [-14, 0, -6], [[E, 1, 1.0], [-Math.PI / 4, 1, 1.4]])
