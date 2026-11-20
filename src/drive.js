// Stage 9 driving, chunk 1: get in any parked hatch/saloon (E), arcade handling, building + traffic bumps, chase cam, E to get out.
// Patrol vehicles, buses and black cabs are not drivable (cabs are for hailing). Plates stay blank; nothing is written anywhere.
const DRIVABLE = new Set(['hatch', 'saloon']);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export function createDrive(traffic) {
  const S = { on: false, pc: null, v: 0, h: 0, st: 0, x: 0, z: 0, bump: 0 };
  const near = (P, r = 3.2) => { let best = null, bd = r; for (const pc of traffic.parked) { if (!DRIVABLE.has(pc.kind) || !pc.node.isEnabled()) continue; const d = Math.hypot(pc.node.position.x - P.x, pc.node.position.z - P.z); if (d < bd) { bd = d; best = pc; } } return best; };
  const api = {
    get on() { return S.on; }, get speed() { return S.v; }, near,
    mph() { return Math.round(Math.abs(S.v) * 2.237); },
    enter(pc, P, player) { S.on = true; S.pc = pc; S.v = 0; S.st = 0; S.h = pc.node.rotation.y; S.x = pc.node.position.x; S.z = pc.node.position.z; if (pc.l) pc.l.setEnabled(true); player.root.setEnabled(false); P.x = S.x; P.z = S.z; P.heading = S.h; P.speed = 0; },
    exit(P, player, grid) { if (!S.on) return; if (Math.abs(S.v) > 3) return false; const h = S.h, lx = -Math.cos(h), lz = Math.sin(h);
      let p = { x: S.x + lx * 1.7, z: S.z + lz * 1.7 }; grid.resolve(p, 0.38, 0); if (Math.hypot(p.x - S.x, p.z - S.z) < 1.2) { p = { x: S.x - lx * 1.7, z: S.z - lz * 1.7 }; grid.resolve(p, 0.38, 0); }
      P.x = p.x; P.z = p.z; P.heading = h; P.speed = 0; player.root.setEnabled(true); if (S.pc.l) S.pc.l.setEnabled(false); S.on = false; S.pc = null; S.v = 0; return true; },
    update(dt, ix, iz, brake, P, grid) {
      if (!S.on) return; const v0 = S.v;
      // longitudinal: accel 6.5 m/s^2 tapering to 17 m/s (~38 mph), brakes 15, reverse to 5 m/s, rolling drag, handbrake
      if (iz > 0.05) S.v = S.v < -0.2 ? S.v + 15 * dt * iz : S.v + 6.5 * iz * (1 - Math.max(0, S.v) / 17) * dt;
      else if (iz < -0.05) S.v = S.v > 0.2 ? S.v + 15 * dt * iz : Math.max(-5, S.v + 5 * dt * iz);
      else S.v -= Math.sign(S.v) * Math.min(Math.abs(S.v), (1.2 + Math.abs(S.v) * 0.06) * dt);
      if (brake) S.v -= Math.sign(S.v) * Math.min(Math.abs(S.v), 11 * dt);
      S.st += (ix - S.st) * Math.min(1, dt * 7);
      const grip = Math.min(1, Math.abs(S.v) / 5) / (1 + Math.abs(S.v) / 20); S.h = wrap(S.h + S.st * 1.9 * grip * Math.sign(S.v) * dt * (brake ? 1.5 : 1));
      const fx = Math.sin(S.h), fz = Math.cos(S.h); let nx = S.x + fx * S.v * dt, nz = S.z + fz * S.v * dt;
      // buildings: two circles (nose and tail) pushed out of the collision grid; a hard hit scrubs most of the speed
      let hit = 0; for (const k of [1.25, -1.25]) { const p = { x: nx + fx * k, z: nz + fz * k }; grid.resolve(p, 0.92, 0.3); const dx = p.x - (nx + fx * k), dz = p.z - (nz + fz * k); if (dx || dz) { nx += dx; nz += dz; hit = Math.max(hit, Math.hypot(dx, dz)); } }
      // traffic: simple push-apart against moving cars and other parked cars
      for (const c of traffic.cars) { if (!c.node.isEnabled()) continue; const p = c.node.position, dx = nx - p.x, dz = nz - p.z, d = Math.hypot(dx, dz), R = c.kind === 'bus' ? 3.2 : 2.3; if (d < R && d > 1e-3) { nx = p.x + dx / d * R; nz = p.z + dz / d * R; hit = Math.max(hit, 0.3); if (c.speed != null) c.speed = 0; } }
      for (const c of traffic.parked) { if (c === S.pc || !c.node.isEnabled()) continue; const p = c.node.position, dx = nx - p.x, dz = nz - p.z, d = Math.hypot(dx, dz), R = c.kind === 'bus' ? 3.2 : 2.2; if (d < R && d > 1e-3) { nx = p.x + dx / d * R; nz = p.z + dz / d * R; hit = Math.max(hit, 0.3); } }
      if (hit > 0.02) { S.v *= hit > 0.15 ? -0.25 : 0.7; S.bump = Math.min(1, Math.abs(v0) / 12); }
      S.x = nx; S.z = nz; S.bump = Math.max(0, S.bump - dt * 3);
      const n = S.pc.node; n.position.x = S.x; n.position.z = S.z; n.rotation.y = S.h;
      n.rotation.z = -S.st * Math.min(1, Math.abs(S.v) / 14) * 0.045; n.rotation.x = Math.max(-0.03, Math.min(0.03, -(S.v - v0) / Math.max(dt, 1e-3) * 0.003)) + S.bump * 0.03 * Math.sin(S.bump * 40);
      P.x = S.x; P.z = S.z; P.heading = S.h; P.speed = 0; P.jumpReq = 0;
    },
  };
  return api;
}
