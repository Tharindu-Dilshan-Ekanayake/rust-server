/**
 * Tiny dependency-free vector/quaternion helpers.
 *
 * Shared code runs on the server (plain Node, no three.js) and in the browser, so
 * it cannot lean on THREE.Vector3. Vectors are `[x, y, z]` arrays, quaternions are
 * `[x, y, z, w]` — the same component order Rapier and three.js use.
 */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v)
export const lerp = (a, b, t) => a + (b - a) * t

export const len3 = (v) => Math.hypot(v[0], v[1], v[2])
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const scale3 = (v, s) => [v[0] * s, v[1] * s, v[2] * s]
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz)

export function normalize3(v) {
  const l = len3(v) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

/** Quaternion for an XYZ-order Euler rotation — matches THREE.Euler's default. */
export function quatFromEuler(x = 0, y = 0, z = 0) {
  const c1 = Math.cos(x / 2)
  const c2 = Math.cos(y / 2)
  const c3 = Math.cos(z / 2)
  const s1 = Math.sin(x / 2)
  const s2 = Math.sin(y / 2)
  const s3 = Math.sin(z / 2)
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ]
}

/** Shortest-arc quaternion rotating unit vector `from` onto unit vector `to`. */
export function quatFromUnitVectors(from, to) {
  let r = dot3(from, to) + 1
  let x
  let y
  let z
  if (r < 1e-6) {
    r = 0
    if (Math.abs(from[0]) > Math.abs(from[2])) {
      x = -from[1]
      y = from[0]
      z = 0
    } else {
      x = 0
      y = -from[2]
      z = from[1]
    }
  } else {
    x = from[1] * to[2] - from[2] * to[1]
    y = from[2] * to[0] - from[0] * to[2]
    z = from[0] * to[1] - from[1] * to[0]
  }
  const l = Math.hypot(x, y, z, r) || 1
  return [x / l, y / l, z / l, r / l]
}

/** Rotates vector `v` by quaternion `q`. */
export function rotate3(v, q) {
  const [x, y, z] = v
  const [qx, qy, qz, qw] = q
  const ix = qw * x + qy * z - qz * y
  const iy = qw * y + qz * x - qx * z
  const iz = qw * z + qx * y - qy * x
  const iw = -qx * x - qy * y - qz * z
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ]
}

/** Unit forward vector for a yaw/pitch pair (yaw 0 looks down -Z, three.js convention). */
export function dirFromYawPitch(yaw, pitch) {
  const cp = Math.cos(pitch)
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp]
}

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

/** Deterministic PRNG (mulberry32) so map decoration is identical on every client. */
export function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Hamilton product a * b (apply b first, then a). */
export function quatMultiply(a, b) {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    ax * bw + aw * bx + ay * bz - az * by,
    ay * bw + aw * by + az * bx - ax * bz,
    az * bw + aw * bz + ax * by - ay * bx,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}
