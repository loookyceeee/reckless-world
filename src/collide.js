// 2D segment grid used for player + camera collision against building walls.
export class SegGrid {
  constructor(cell = 16) { this.cell = cell; this.map = new Map(); }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  add(x0, z0, x1, z1, h = 99) {
    const s = { x0, z0, x1, z1, h }; const c = this.cell;
    const i0 = Math.floor(Math.min(x0, x1) / c), i1 = Math.floor(Math.max(x0, x1) / c), j0 = Math.floor(Math.min(z0, z1) / c), j1 = Math.floor(Math.max(z0, z1) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = this.key(i, j); let a = this.map.get(k); if (!a) this.map.set(k, (a = [])); a.push(s); }
  }
  addPoly(pts, h) { for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; this.add(a[0], a[1], b[0], b[1], h); } }
  near(x, z, r) {
    const c = this.cell, out = new Set();
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++) for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) { const a = this.map.get(this.key(i, j)); if (a) for (const s of a) out.add(s); }
    return out;
  }
  // push a circle out of walls
  resolve(p, r) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const s of this.near(p.x, p.z, r + 1)) {
        const dx = s.x1 - s.x0, dz = s.z1 - s.z0; const L2 = dx * dx + dz * dz || 1e-6;
        let t = ((p.x - s.x0) * dx + (p.z - s.z0) * dz) / L2; t = Math.max(0, Math.min(1, t));
        const cx = s.x0 + dx * t, cz = s.z0 + dz * t; const ex = p.x - cx, ez = p.z - cz; const d = Math.hypot(ex, ez);
        if (d < r && d > 1e-5) { p.x = cx + ex / d * r; p.z = cz + ez / d * r; moved = true; }
      }
      if (!moved) break;
    }
  }
  // first hit fraction along ray from a to b (2D), only walls taller than y
  raycast(ax, az, bx, bz, y) {
    let best = 1; const mx = (ax + bx) / 2, mz = (az + bz) / 2, r = Math.hypot(bx - ax, bz - az) / 2 + 1;
    for (const s of this.near(mx, mz, r)) {
      if (s.h < y) continue;
      const rx = bx - ax, rz = bz - az, sx = s.x1 - s.x0, sz = s.z1 - s.z0; const den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) continue;
      const t = ((s.x0 - ax) * sz - (s.z0 - az) * sx) / den, u = ((s.x0 - ax) * rz - (s.z0 - az) * rx) / den;
      if (t >= 0 && t < best && u >= 0 && u <= 1) best = t;
    }
    return best;
  }
}
