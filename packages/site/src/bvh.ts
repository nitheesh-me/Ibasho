/**
 * Triangle bounding volume hierarchy for the CPU visibility kernel (SD 1.3, R30). Owner: WP-16.
 *
 * Binned surface area heuristic build (Wald 2007, "On fast construction of SAH-based bounding
 * volume hierarchies"; Pharr, Jakob and Humphreys, "Physically Based Rendering", 4th ed., 7.3,
 * https://pbr-book.org) and Moller-Trumbore ray and triangle tests (Moller and Trumbore 1997,
 * "Fast, minimum storage ray/triangle intersection", J. Graphics Tools 2(1)). The same algorithms
 * three-mesh-bvh uses; this one is dependency free, float64 and deterministic: the build depends
 * only on the triangle order, and the tests use only + - * / and comparisons, so every engine
 * gives the same answer (ARCH 15.2). See the WP-16 INTERFACES entry about three-mesh-bvh.
 */

const LEAF = 4;
const BINS = 12;

export class Bvh {
  /** Triangle vertices, 9 per triangle, metres. */
  readonly tri: Float64Array;
  /** Owner index per triangle (who casts the shade). */
  readonly owner: Int32Array;
  private readonly order: Int32Array;
  /** Per node: min xyz, max xyz. */
  private nb: Float64Array;
  /** Per node: left child or first triangle; count (0 for inner nodes). */
  private nl: Int32Array;
  private nc: Int32Array;
  private nodes = 0;
  private readonly stack = new Int32Array(256);
  /** Rays traced since construction (for runtime notes). */
  rays = 0;

  constructor(tri: Float64Array, owner: Int32Array) {
    this.tri = tri;
    this.owner = owner;
    const n = owner.length;
    this.order = new Int32Array(n);
    for (let i = 0; i < n; i++) this.order[i] = i;
    const cap = Math.max(1, 2 * n);
    this.nb = new Float64Array(cap * 6);
    this.nl = new Int32Array(cap);
    this.nc = new Int32Array(cap);
    const cx = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++)
        cx[i * 3 + k] =
          ((tri[i * 9 + k] as number) + (tri[i * 9 + 3 + k] as number) + (tri[i * 9 + 6 + k] as number)) / 3;
    }
    this.nodes = 1;
    if (n > 0) this.build(0, 0, n, cx);
    else {
      this.nb.fill(0, 0, 6);
      this.nc[0] = 0;
      this.nl[0] = 0;
    }
  }

  get triangles(): number {
    return this.owner.length;
  }

  private bounds(node: number, start: number, end: number) {
    let x0 = Infinity;
    let y0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    let z1 = -Infinity;
    for (let i = start; i < end; i++) {
      const t = (this.order[i] as number) * 9;
      for (let v = 0; v < 9; v += 3) {
        const x = this.tri[t + v] as number;
        const y = this.tri[t + v + 1] as number;
        const z = this.tri[t + v + 2] as number;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (z < z0) z0 = z;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
        if (z > z1) z1 = z;
      }
    }
    const b = node * 6;
    this.nb[b] = x0;
    this.nb[b + 1] = y0;
    this.nb[b + 2] = z0;
    this.nb[b + 3] = x1;
    this.nb[b + 4] = y1;
    this.nb[b + 5] = z1;
  }

  private build(node: number, start: number, end: number, cx: Float64Array): void {
    this.bounds(node, start, end);
    const count = end - start;
    if (count <= LEAF) {
      this.nl[node] = start;
      this.nc[node] = count;
      return;
    }
    // Centroid bounds and the longest axis.
    let c0 = [Infinity, Infinity, Infinity];
    let c1 = [-Infinity, -Infinity, -Infinity];
    for (let i = start; i < end; i++) {
      const t = (this.order[i] as number) * 3;
      c0 = [
        Math.min(c0[0] as number, cx[t] as number),
        Math.min(c0[1] as number, cx[t + 1] as number),
        Math.min(c0[2] as number, cx[t + 2] as number),
      ];
      c1 = [
        Math.max(c1[0] as number, cx[t] as number),
        Math.max(c1[1] as number, cx[t + 1] as number),
        Math.max(c1[2] as number, cx[t + 2] as number),
      ];
    }
    let axis = 0;
    let ext = (c1[0] as number) - (c0[0] as number);
    for (let a = 1; a < 3; a++) {
      const e = (c1[a] as number) - (c0[a] as number);
      if (e > ext) {
        ext = e;
        axis = a;
      }
    }
    let mid = start + (count >> 1);
    if (ext > 0) {
      // Binned SAH along the axis.
      const lo = c0[axis] as number;
      const scale = BINS / ext;
      const binCount = new Int32Array(BINS);
      const binBox = new Float64Array(BINS * 6);
      for (let b = 0; b < BINS; b++) {
        binBox.set([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], b * 6);
      }
      const binOf = (i: number) => {
        const k = Math.floor(((cx[(this.order[i] as number) * 3 + axis] as number) - lo) * scale);
        return k >= BINS ? BINS - 1 : k < 0 ? 0 : k;
      };
      for (let i = start; i < end; i++) {
        const b = binOf(i);
        binCount[b] = (binCount[b] as number) + 1;
        const t = (this.order[i] as number) * 9;
        for (let v = 0; v < 9; v += 3) {
          for (let k = 0; k < 3; k++) {
            const x = this.tri[t + v + k] as number;
            if (x < (binBox[b * 6 + k] as number)) binBox[b * 6 + k] = x;
            if (x > (binBox[b * 6 + 3 + k] as number)) binBox[b * 6 + 3 + k] = x;
          }
        }
      }
      const area = (bx: number[]) => {
        const dx = (bx[3] as number) - (bx[0] as number);
        const dy = (bx[4] as number) - (bx[1] as number);
        const dz = (bx[5] as number) - (bx[2] as number);
        return dx < 0 ? 0 : dx * dy + dy * dz + dz * dx;
      };
      const grow = (acc: number[], b: number) => {
        for (let k = 0; k < 3; k++) {
          acc[k] = Math.min(acc[k] as number, binBox[b * 6 + k] as number);
          acc[3 + k] = Math.max(acc[3 + k] as number, binBox[b * 6 + 3 + k] as number);
        }
      };
      const leftArea = new Float64Array(BINS - 1);
      const leftN = new Int32Array(BINS - 1);
      let acc = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      let nAcc = 0;
      for (let b = 0; b < BINS - 1; b++) {
        grow(acc, b);
        nAcc += binCount[b] as number;
        leftArea[b] = area(acc);
        leftN[b] = nAcc;
      }
      acc = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      nAcc = 0;
      let best = -1;
      let bestCost = Infinity;
      for (let b = BINS - 1; b > 0; b--) {
        grow(acc, b);
        nAcc += binCount[b] as number;
        const nl = leftN[b - 1] as number;
        if (nl === 0 || nAcc === 0) continue;
        const cost = (leftArea[b - 1] as number) * nl + area(acc) * nAcc;
        if (cost < bestCost) {
          bestCost = cost;
          best = b - 1;
        }
      }
      if (best >= 0) {
        // Stable partition: bins <= best to the left.
        const tmp = this.order.slice(start, end);
        let l = start;
        for (let i = 0; i < count; i++) {
          const t = tmp[i] as number;
          const k = Math.floor(((cx[t * 3 + axis] as number) - lo) * scale);
          if ((k >= BINS ? BINS - 1 : k < 0 ? 0 : k) <= best) this.order[l++] = t;
        }
        let r = l;
        for (let i = 0; i < count; i++) {
          const t = tmp[i] as number;
          const k = Math.floor(((cx[t * 3 + axis] as number) - lo) * scale);
          if ((k >= BINS ? BINS - 1 : k < 0 ? 0 : k) > best) this.order[r++] = t;
        }
        mid = l;
      }
    }
    if (mid <= start || mid >= end) mid = start + (count >> 1);
    const left = this.nodes;
    this.nodes += 2;
    this.nl[node] = left;
    this.nc[node] = 0;
    this.build(left, start, mid, cx);
    this.build(left + 1, mid, end, cx);
  }

  /** Slab test; returns the entry distance or Infinity. */
  private box(
    node: number,
    ox: number,
    oy: number,
    oz: number,
    ix: number,
    iy: number,
    iz: number,
    tmax: number,
  ): number {
    const b = node * 6;
    // 0 * Infinity is NaN when the ray runs inside a slab plane; such a slab does not limit it.
    let t0 = ((this.nb[b] as number) - ox) * ix;
    let t1 = ((this.nb[b + 3] as number) - ox) * ix;
    if (Number.isNaN(t0)) t0 = -Infinity;
    if (Number.isNaN(t1)) t1 = Infinity;
    if (t0 > t1) [t0, t1] = [t1, t0];
    let a = ((this.nb[b + 1] as number) - oy) * iy;
    let c = ((this.nb[b + 4] as number) - oy) * iy;
    if (Number.isNaN(a)) a = -Infinity;
    if (Number.isNaN(c)) c = Infinity;
    if (a > c) [a, c] = [c, a];
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    a = ((this.nb[b + 2] as number) - oz) * iz;
    c = ((this.nb[b + 5] as number) - oz) * iz;
    if (Number.isNaN(a)) a = -Infinity;
    if (Number.isNaN(c)) c = Infinity;
    if (a > c) [a, c] = [c, a];
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    if (t0 > t1 || t1 < 0 || t0 > tmax) return Infinity;
    return t0;
  }

  /** Moller-Trumbore, two sided; distance or -1. */
  private hit(t: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
    const p = this.tri;
    const k = t * 9;
    const ax = p[k] as number;
    const ay = p[k + 1] as number;
    const az = p[k + 2] as number;
    const e1x = (p[k + 3] as number) - ax;
    const e1y = (p[k + 4] as number) - ay;
    const e1z = (p[k + 5] as number) - az;
    const e2x = (p[k + 6] as number) - ax;
    const e2y = (p[k + 7] as number) - ay;
    const e2z = (p[k + 8] as number) - az;
    const px = dy * e2z - dz * e2y;
    const py = dz * e2x - dx * e2z;
    const pz = dx * e2y - dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -1e-12 && det < 1e-12) return -1;
    const inv = 1 / det;
    const sx = ox - ax;
    const sy = oy - ay;
    const sz = oz - az;
    const u = (sx * px + sy * py + sz * pz) * inv;
    if (u < 0 || u > 1) return -1;
    const qx = sy * e1z - sz * e1y;
    const qy = sz * e1x - sx * e1z;
    const qz = sx * e1y - sy * e1x;
    const v = (dx * qx + dy * qy + dz * qz) * inv;
    if (v < 0 || u + v > 1) return -1;
    const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
    return d > 1e-6 ? d : -1;
  }

  /**
   * First triangle hit along a unit ray within `tmax` metres, or -1. With `any`, returns the first
   * triangle found rather than the nearest (occlusion only).
   */
  cast(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    tmax = Infinity,
    any = false,
  ): number {
    this.rays++;
    if (this.owner.length === 0) return -1;
    const ix = 1 / dx;
    const iy = 1 / dy;
    const iz = 1 / dz;
    const st = this.stack;
    let sp = 0;
    let best = -1;
    let bestT = tmax;
    if (this.box(0, ox, oy, oz, ix, iy, iz, bestT) === Infinity) return -1;
    st[sp++] = 0;
    while (sp > 0) {
      const node = st[--sp] as number;
      const c = this.nc[node] as number;
      if (c > 0) {
        const s = this.nl[node] as number;
        for (let i = s; i < s + c; i++) {
          const t = this.order[i] as number;
          const d = this.hit(t, ox, oy, oz, dx, dy, dz);
          if (d > 0 && d < bestT) {
            // Ties resolve to the lower triangle index, so the answer does not depend on visit order.
            best = t;
            bestT = d;
            if (any) return best;
          } else if (d > 0 && d === bestT && t < best) best = t;
        }
        continue;
      }
      const l = this.nl[node] as number;
      const tl = this.box(l, ox, oy, oz, ix, iy, iz, bestT);
      const tr = this.box(l + 1, ox, oy, oz, ix, iy, iz, bestT);
      if (tl <= tr) {
        if (tr !== Infinity) st[sp++] = l + 1;
        if (tl !== Infinity) st[sp++] = l;
      } else {
        if (tl !== Infinity) st[sp++] = l;
        st[sp++] = l + 1;
      }
    }
    return best;
  }
}
