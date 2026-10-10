/**
 * Player hitboxes and ray tests against them.
 *
 * The client uses these to find what the crosshair hit; the server re-runs the same
 * test (with a little slack for latency) before it accepts the shot. Hitboxes are
 * analytic shapes rather than physics colliders, so neither side needs player bodies
 * in its Rapier world.
 *
 * `stance` is 0 standing, 1 crouched, 2 prone (a boolean still means crouched or
 * not). Prone bodies lie along the player's facing, so those need `yaw` too.
 */

const STAND = { headY: 1.58, headR: 0.24, bodyA: 0.35, bodyB: 1.24, bodyR: 0.34, chestY: 1.0 }
const CROUCH = { headY: 1.1, headR: 0.24, bodyA: 0.3, bodyB: 0.8, bodyR: 0.36, chestY: 0.62 }
/** Prone: head a little ahead of the feet position, torso and legs trailing behind. */
const PRONE = { headY: 0.6, headR: 0.22, headFwd: -0.06, bodyY: 0.26, bodyR: 0.26, bodyFrom: -0.12, bodyTo: -1.3, chestTo: -0.6 }

const stanceNum = (s) => (s === true ? 1 : s === false || s == null ? 0 : s | 0)
const forward = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)]

/** Hitbox for a player whose feet are at (x, y, z). */
export function hitboxFor(x, y, z, stance = 0, yaw = 0) {
  const st = stanceNum(stance)
  if (st === 2) {
    const [fx, fz] = forward(yaw)
    const P = PRONE
    return {
      head: { c: [x + fx * P.headFwd, y + P.headY, z + fz * P.headFwd], r: P.headR },
      body: {
        seg: true,
        a: [x + fx * P.bodyFrom, y + P.bodyY, z + fz * P.bodyFrom],
        b: [x + fx * P.bodyTo, y + P.bodyY, z + fz * P.bodyTo],
        r: P.bodyR,
        chestFrac: (P.chestTo - P.bodyFrom) / (P.bodyTo - P.bodyFrom),
      },
      chestY: y + P.bodyY,
      feetY: y,
    }
  }
  const d = st === 1 ? CROUCH : STAND
  return {
    head: { c: [x, y + d.headY, z], r: d.headR },
    body: { x, z, ya: y + d.bodyA, yb: y + d.bodyB, r: d.bodyR },
    chestY: y + d.chestY,
    feetY: y,
  }
}

/** Point the server and bots aim at: centre mass. */
export function chestPoint(x, y, z, stance = 0, yaw = 0) {
  const st = stanceNum(stance)
  if (st === 2) {
    const [fx, fz] = forward(yaw)
    return [x - fx * 0.3, y + PRONE.bodyY + 0.04, z - fz * 0.3]
  }
  const d = st === 1 ? CROUCH : STAND
  return [x, y + (d.bodyA + d.bodyB) / 2 + 0.1, z]
}

export function headPoint(x, y, z, stance = 0, yaw = 0) {
  const st = stanceNum(stance)
  if (st === 2) {
    const [fx, fz] = forward(yaw)
    return [x + fx * PRONE.headFwd, y + PRONE.headY, z + fz * PRONE.headFwd]
  }
  return [x, y + (st === 1 ? CROUCH : STAND).headY, z]
}

/** Smallest t >= 0 where the ray hits the sphere, or Infinity. */
export function raySphere(o, d, c, r) {
  const ox = o[0] - c[0]
  const oy = o[1] - c[1]
  const oz = o[2] - c[2]
  const b = ox * d[0] + oy * d[1] + oz * d[2]
  const cc = ox * ox + oy * oy + oz * oz - r * r
  const disc = b * b - cc
  if (disc < 0) return Infinity
  const s = Math.sqrt(disc)
  const t0 = -b - s
  if (t0 >= 0) return t0
  const t1 = -b + s
  return t1 >= 0 ? 0 : Infinity
}

/** Ray vs vertical capsule (cylinder between ya..yb plus hemispherical caps). */
export function rayVerticalCapsule(o, d, body, r) {
  let best = Infinity
  const ox = o[0] - body.x
  const oz = o[2] - body.z
  const a = d[0] * d[0] + d[2] * d[2]
  if (a > 1e-9) {
    const b = 2 * (ox * d[0] + oz * d[2])
    const c = ox * ox + oz * oz - r * r
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const s = Math.sqrt(disc)
      for (const t of [(-b - s) / (2 * a), (-b + s) / (2 * a)]) {
        if (t < 0) continue
        const y = o[1] + d[1] * t
        if (y >= body.ya && y <= body.yb && t < best) {
          best = t
          break
        }
      }
    }
  }
  best = Math.min(best, raySphere(o, d, [body.x, body.ya, body.z], r))
  best = Math.min(best, raySphere(o, d, [body.x, body.yb, body.z], r))
  return best
}

/**
 * Ray vs capsule around segment a-b. Returns { t, s } (s: 0 at a .. 1 at b) or null.
 */
export function raySegmentCapsule(o, d, a, b, r) {
  const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const oa = [o[0] - a[0], o[1] - a[1], o[2] - a[2]]
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const baba = dot(ba, ba)
  const bard = dot(ba, d)
  const baoa = dot(ba, oa)
  const rdoa = dot(d, oa)
  const oaoa = dot(oa, oa)
  let best = Infinity
  let bestS = 0
  const qa = baba - bard * bard
  const qb = baba * rdoa - baoa * bard
  const qc = baba * oaoa - baoa * baoa - r * r * baba
  const h = qb * qb - qa * qc
  if (h >= 0 && Math.abs(qa) > 1e-9) {
    const t = (-qb - Math.sqrt(h)) / qa
    const y = baoa + t * bard
    if (t >= 0 && y > 0 && y < baba) {
      best = t
      bestS = y / baba
    }
  }
  for (const [c, s] of [[a, 0], [b, 1]]) {
    const t = raySphere(o, d, c, r)
    if (t < best) {
      best = t
      bestS = s
    }
  }
  return best === Infinity ? null : { t: best, s: bestS }
}

/**
 * Ray vs a player hitbox.
 *
 * @param {number[]} o ray origin
 * @param {number[]} d normalised ray direction
 * @param {ReturnType<typeof hitboxFor>} box
 * @param {number} [inflate] extra radius, for server-side latency tolerance
 * @returns {{t:number, zone:'head'|'chest'|'body'} | null}
 */
export function rayHitbox(o, d, box, inflate = 0) {
  const tHead = raySphere(o, d, box.head.c, box.head.r + inflate)
  if (box.body.seg) {
    const hit = raySegmentCapsule(o, d, box.body.a, box.body.b, box.body.r + inflate)
    if (tHead === Infinity && !hit) return null
    if (!hit || tHead <= hit.t) return { t: tHead, zone: 'head' }
    return { t: hit.t, zone: hit.s <= box.body.chestFrac ? 'chest' : 'body' }
  }
  const tBody = rayVerticalCapsule(o, d, box.body, box.body.r + inflate)
  if (tHead === Infinity && tBody === Infinity) return null
  if (tHead <= tBody) return { t: tHead, zone: 'head' }
  const y = o[1] + d[1] * tBody
  return { t: tBody, zone: y >= box.chestY ? 'chest' : 'body' }
}

/** Distance from point `p` to the ray (o, d) — used for loose server-side checks. */
export function pointRayDistance(o, d, p) {
  const vx = p[0] - o[0]
  const vy = p[1] - o[1]
  const vz = p[2] - o[2]
  const t = Math.max(0, vx * d[0] + vy * d[1] + vz * d[2])
  const cx = o[0] + d[0] * t - p[0]
  const cy = o[1] + d[1] * t - p[1]
  const cz = o[2] + d[2] * t - p[2]
  return { distance: Math.hypot(cx, cy, cz), t }
}
