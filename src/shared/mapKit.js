/**
 * Building blocks shared by every map: placement helpers, ladders, and the
 * collider shapes both the client and the server build their physics from.
 *
 * Coordinates are metres. +X is east, -Z is north, +Y is up, ground is y = 0.
 */
import { GROUP } from './constants.js'
import { normalize3, quatFromEuler, quatFromUnitVectors, quatMultiply, sub3 } from './math.js'

export const SOLID = GROUP.SOLID
export const MOVE_ONLY = GROUP.MOVE_ONLY
export const IDENTITY_Q = [0, 0, 0, 1]

/** Offsets a local XZ point by a yaw rotation around `origin`. */
export function yawOffset(origin, lx, lz, rotY) {
  const c = Math.cos(rotY)
  const s = Math.sin(rotY)
  return [origin[0] + lx * c + lz * s, origin[1], origin[2] - lx * s + lz * c]
}

/**
 * A tilted slab from `top` (high end) to `bottom` (low end), as a box whose top
 * face is the walking surface. Used by stairs, collapsed roofs and ramps.
 */
export function rampBox(top, bottom, width, thickness = 0.14) {
  const dx = bottom[0] - top[0]
  const dz = bottom[2] - top[2]
  const run = Math.hypot(dx, dz)
  const rise = top[1] - bottom[1]
  const length = Math.hypot(run, rise)
  const angle = Math.atan2(rise, run)
  // Local +Z points downhill: yaw it onto the horizontal run, then pitch it down.
  const yaw = Math.atan2(dx, dz)
  const q = quatMultiply(quatFromEuler(0, yaw, 0), quatFromEuler(angle, 0, 0))
  const mid = [(top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, (top[2] + bottom[2]) / 2]
  // Surface normal tips toward the downhill side.
  const n = [(dx / (run || 1)) * Math.sin(angle), Math.cos(angle), (dz / (run || 1)) * Math.sin(angle)]
  const p = [mid[0] - (n[0] * thickness) / 2, mid[1] - (n[1] * thickness) / 2, mid[2] - (n[2] * thickness) / 2]
  return { p, size: [width, thickness, length], q, yaw, angle, length }
}

/**
 * A fixed ladder up the face of something. `foot` is where its rails stand
 * (x, z), `dir` the horizontal direction into the structure (and the way you
 * step off at the top), `topY` the floor it leads to, rungs from `rungs[0]`
 * every `rungs[1]` metres above `base` (where its feet stand).
 *
 * The climb volume (feet position) sits in front of the rails; inside it W/S
 * climb instead of walk, and the climber is held at `x, z`, a forearm's
 * length back from the rungs.
 */
export function ladder(foot, dir, topY, rungs, standoff = 0.12, base = 0) {
  const side = [-dir[2], 0, dir[0]]
  const face = [foot[0] + dir[0] * standoff, foot[1] + dir[2] * standoff]
  const out = [foot[0] - dir[0] * 0.95, foot[1] - dir[2] * 0.95]
  const xs = [face[0] + side[0] * 0.6, face[0] - side[0] * 0.6, out[0] + side[0] * 0.6, out[0] - side[0] * 0.6]
  const zs = [face[1] + side[2] * 0.6, face[1] - side[2] * 0.6, out[1] + side[2] * 0.6, out[1] - side[2] * 0.6]
  return Object.freeze({
    min: [Math.min(...xs), base - 0.2, Math.min(...zs)],
    max: [Math.max(...xs), topY + 0.4, Math.max(...zs)],
    topY,
    exitDir: dir,
    x: foot[0] - dir[0] * 0.4,
    z: foot[1] - dir[2] * 0.4,
    foot,
    side,
    base,
    rungs: [base + rungs[0], rungs[1]],
  })
}

/** The ladder (of `ladders`) whose climb volume holds a feet position, or null. */
export function ladderIn(ladders, x, y, z) {
  for (const l of ladders) {
    if (x >= l.min[0] && x <= l.max[0] && y >= l.min[1] && y <= l.max[1] && z >= l.min[2] && z <= l.max[2]) return l
  }
  return null
}

/* ---------------------------------------------------------------------------
 * Collider shapes
 * ------------------------------------------------------------------------- */

/**
 * @typedef {{shape:'box', p:number[], half:number[], q:number[], group:number}
 *         | {shape:'cyl', p:number[], halfHeight:number, r:number, q:number[], group:number}
 *         | {shape:'mesh', p:number[], q:number[], vertices:Float32Array, indices:Uint32Array, group:number}} ColliderDef
 */

export function boxC(p, size, q = IDENTITY_Q, group = SOLID) {
  return { shape: 'box', p, half: [size[0] / 2, size[1] / 2, size[2] / 2], q, group }
}

export function cylC(p, r, h, q = IDENTITY_Q, group = SOLID) {
  return { shape: 'cyl', p, halfHeight: h / 2, r, q, group }
}

/** A triangle mesh (ground that isn't flat): xyz triples and triangle corner indices, in world space. */
export function meshC(vertices, indices, group = SOLID) {
  return { shape: 'mesh', p: [0, 0, 0], q: IDENTITY_Q, vertices: Float32Array.from(vertices), indices: Uint32Array.from(indices), group }
}

/** Box sitting on `base` (centre of its bottom face), rotated about Y. */
export function groundBox(base, size, rotY = 0, group = SOLID) {
  return boxC([base[0], base[1] + size[1] / 2, base[2]], size, quatFromEuler(0, rotY, 0), group)
}

/** Cylinder between two points. */
export function segmentCyl(a, b, r, group = SOLID) {
  const d = sub3(b, a)
  const length = Math.hypot(d[0], d[1], d[2])
  const q = quatFromUnitVectors([0, 1, 0], normalize3(d))
  return cylC([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], r, length, q, group)
}

/** Splits a wall run into solid pieces around door/window openings. */
export function wallPieces(from, to, height, openings) {
  const pieces = []
  const sorted = [...openings].sort((a, b) => a.from - b.from)
  let cursor = from
  for (const o of sorted) {
    if (o.from > cursor) pieces.push({ a: cursor, b: o.from, y0: 0, y1: height })
    if ((o.bottom ?? 0) > 0) pieces.push({ a: o.from, b: o.to, y0: 0, y1: o.bottom })
    if (o.top < height) pieces.push({ a: o.from, b: o.to, y0: o.top, y1: height })
    cursor = o.to
  }
  if (cursor < to) pieces.push({ a: cursor, b: to, y0: 0, y1: height })
  return pieces
}

/**
 * Straight rail runs round a rectangle, skipping `gaps` ([side, from, to]):
 * [{ side, axis, fixed, a, b }] with `axis` the direction the run goes.
 */
export function railRuns(x0, x1, z0, z1, gaps = []) {
  const out = []
  const sides = [
    ['north', 'x', z0 + 0.04, x0, x1],
    ['south', 'x', z1 - 0.04, x0, x1],
    ['west', 'z', x0 + 0.04, z0, z1],
    ['east', 'z', x1 - 0.04, z0, z1],
  ]
  for (const [side, axis, fixed, from, to] of sides) {
    let cursor = from
    const cuts = gaps.filter((g) => g[0] === side).sort((p, q) => p[1] - q[1])
    for (const [, a, b] of cuts) {
      if (a > cursor + 0.05) out.push({ side, axis, fixed, a: cursor, b: a })
      cursor = Math.max(cursor, b)
    }
    if (to > cursor + 0.05) out.push({ side, axis, fixed, a: cursor, b: to })
  }
  return out
}

/** Rail round a rectangle at height `y`: solid kick plate + movement-only top, with gaps. */
export function railColliders(x0, x1, z0, z1, y, gaps = []) {
  const out = []
  for (const { axis, fixed, a, b } of railRuns(x0, x1, z0, z1, gaps)) {
    const mid = (a + b) / 2
    const len = b - a
    const at = (yc) => (axis === 'x' ? [mid, yc, fixed] : [fixed, yc, mid])
    const size = (h) => (axis === 'x' ? [len, h, 0.08] : [0.08, h, len])
    out.push(boxC(at(y + 0.15), size(0.3)))
    out.push(boxC(at(y + 0.65), size(0.7), IDENTITY_Q, MOVE_ONLY))
  }
  return out
}

/** Thin tilted wall along a ramp (conveyor side rails): movement-only by default. */
export function rampSide(top, bottom, offset, height, group = MOVE_ONLY) {
  const lift = (p) => [p[0], p[1] + height / 2 + 0.05, p[2] + offset]
  const r = rampBox(lift(top), lift(bottom), 0.06, height)
  return boxC(r.p, r.size, r.q, group)
}

/** Invisible boundary walls round a `halfX` x `halfZ` arena, plus the ground slab. */
export function boundaryColliders(halfX, halfZ, thickness = 1.0, height = 30) {
  const T = thickness
  const ox = halfX + T / 2 - 0.2
  const oz = halfZ + T / 2 - 0.2
  return [
    boxC([0, height / 2, -oz], [halfX * 2 + 2, height, T]),
    boxC([0, height / 2, oz], [halfX * 2 + 2, height, T]),
    boxC([-ox, height / 2, 0], [T, height, halfZ * 2 + 2]),
    boxC([ox, height / 2, 0], [T, height, halfZ * 2 + 2]),
  ]
}

/** Quaternion for a yaw about +Y (re-exported for map files). */
export const yawQ = (yaw) => quatFromEuler(0, yaw, 0)
export { quatFromEuler, quatMultiply }
