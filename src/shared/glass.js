/**
 * Breakable glass. A map lists its panes (`map.glass`: oriented boxes, the same
 * list on the server and every client, so a pane is known everywhere by its
 * index). A whole pane stops a bullet and breaks; after that bullets go
 * through the gap, and so do players. The server decides what breaks and puts
 * the broken set in the room state as a hex bitmask string; clients draw and
 * collide with the panes still whole, and shatter the rest.
 */

/** A pane: an oriented box { p: [x, y, z], half: [hx, hy, hz], q: [x, y, z, w] }. */
export const glassPane = (p, size, q = [0, 0, 0, 1]) => ({ p, half: [size[0] / 2, size[1] / 2, size[2] / 2], q })

/** Rotates v by the quaternion q. */
function rotate(v, q) {
  const [x, y, z] = v
  const [qx, qy, qz, qw] = q
  const ix = qw * x + qy * z - qz * y
  const iy = qw * y + qz * x - qx * z
  const iz = qw * z + qx * y - qy * x
  const iw = -qx * x - qy * y - qz * z
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx]
}

/** Per pane, its axes and bounding radius (worked out once per list). */
const prepared = new WeakMap()
function prep(panes) {
  let list = prepared.get(panes)
  if (!list) {
    list = panes.map((g) => ({
      p: g.p,
      half: g.half,
      axes: [rotate([1, 0, 0], g.q), rotate([0, 1, 0], g.q), rotate([0, 0, 1], g.q)],
      r: Math.hypot(...g.half),
    }))
    prepared.set(panes, list)
  }
  return list
}

/** Where a ray (o + d t, d normalised) enters an oriented box, or Infinity. */
function rayBox(o, d, g) {
  const rel = [o[0] - g.p[0], o[1] - g.p[1], o[2] - g.p[2]]
  let t0 = -Infinity
  let t1 = Infinity
  for (let k = 0; k < 3; k++) {
    const a = g.axes[k]
    const e = a[0] * rel[0] + a[1] * rel[1] + a[2] * rel[2]
    const f = a[0] * d[0] + a[1] * d[1] + a[2] * d[2]
    const h = g.half[k]
    if (Math.abs(f) < 1e-9) {
      if (Math.abs(e) > h) return Infinity
      continue
    }
    let ta = (-h - e) / f
    let tb = (h - e) / f
    if (ta > tb) [ta, tb] = [tb, ta]
    if (ta > t0) t0 = ta
    if (tb < t1) t1 = tb
    if (t0 > t1) return Infinity
  }
  return t1 < 0 ? Infinity : Math.max(0, t0)
}

/**
 * The first whole pane along a ray before `maxT`: { i, t } or null. `broken`
 * is anything with has(i).
 */
export function glassRayHit(panes, broken, o, d, maxT) {
  if (!panes?.length) return null
  let best = null
  for (const [i, g] of prep(panes).entries()) {
    if (broken.has(i)) continue
    // Cheap reject: the ray's closest approach to the pane's centre.
    const rx = g.p[0] - o[0]
    const ry = g.p[1] - o[1]
    const rz = g.p[2] - o[2]
    const along = rx * d[0] + ry * d[1] + rz * d[2]
    if (along < -g.r || along > maxT + g.r) continue
    const off = rx * rx + ry * ry + rz * rz - along * along
    if (off > g.r * g.r) continue
    const t = rayBox(o, d, g)
    if (t <= maxT && (!best || t < best.t)) best = { i, t }
  }
  return best
}

/** Whole panes within `radius` of a point (an explosion's reach). */
export function glassNear(panes, broken, pos, radius) {
  const out = []
  if (!panes?.length) return out
  for (const [i, g] of prep(panes).entries()) {
    if (broken.has(i)) continue
    if (Math.hypot(g.p[0] - pos[0], g.p[1] - pos[1], g.p[2] - pos[2]) - g.r * 0.5 < radius) out.push(i)
  }
  return out
}

/** The broken set as hex (4 panes a digit), and back. */
export function encodeBroken(broken, count) {
  if (!broken.size) return ''
  let s = ''
  for (let i = 0; i < count; i += 4) {
    let v = 0
    for (let b = 0; b < 4; b++) if (broken.has(i + b)) v |= 1 << b
    s += v.toString(16)
  }
  return s.replace(/0+$/, '')
}
export function decodeBroken(s) {
  const out = new Set()
  if (typeof s !== 'string') return out
  for (let k = 0; k < s.length; k++) {
    const v = parseInt(s[k], 16)
    if (!v) continue
    for (let b = 0; b < 4; b++) if (v & (1 << b)) out.add(k * 4 + b)
  }
  return out
}

/** How close a point is to pane `i` (0 inside it). */
export function glassDistance(panes, i, pos) {
  const list = prep(panes)
  const g = list[i]
  if (!g) return Infinity
  const rel = [pos[0] - g.p[0], pos[1] - g.p[1], pos[2] - g.p[2]]
  let sq = 0
  for (let k = 0; k < 3; k++) {
    const a = g.axes[k]
    const e = Math.abs(a[0] * rel[0] + a[1] * rel[1] + a[2] * rel[2]) - g.half[k]
    if (e > 0) sq += e * e
  }
  return Math.sqrt(sq)
}

/** A knife reaches glass this far from the eye (the server allows a little more). */
export const KNIFE_GLASS_REACH = 1.9
