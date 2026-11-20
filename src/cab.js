// Black-cab hailing (stage 9): phone HAIL CAB -> a black cab drives up the nearest road and pulls in at the kerb beside you ->
// E GET IN -> pick a venue (or your GPS waypoint) -> short ride cinematic -> dropped at the kerb by the door. Free in the demo:
// no fare is charged, nothing is written to the crew API and no XP is awarded. Fictional cab: no operator marks, blank plate.
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

const ease = x => x * x * (3 - 2 * x);
export function createCabs({ scene, traffic, hud, app, city, player }) {
  const tp = traffic.tpl('cab', 'cab', Color3.FromHexString('#121214'));
  const node = new TransformNode('hailCab', scene); const b = tp.b.createInstance('hailCabBody'); b.parent = node; b.position.setAll(0); const l = tp.l.createInstance('hailCabLights'); l.parent = node; l.position.setAll(0); node.setEnabled(false);
  const fade = document.getElementById('rbFade'); const card = fade && fade.querySelector('.rbcard');
  // nearest drivable kerb spot: {x,z (cab), px,pz (pavement), h (heading), path back up the road}
  const kerb = (x, z) => { let best = null, bd = 1e9;
    for (const r of city.roads) { if (!r.d || r.t === 'service' || r.w < 5) continue; for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], c = r.pts[i + 1], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz); if (L < 8) continue;
      const t = Math.max(0.15, Math.min(0.85, ((x - a[0]) * dx + (z - a[1]) * dz) / (L * L))), qx = a[0] + dx * t, qz = a[1] + dz * t, d = Math.hypot(qx - x, qz - z); if (d < bd) { bd = d; best = { r, i, t, qx, qz, ux: dx / L, uz: dz / L }; } } }
    if (!best) return null; const { r, i, ux, uz } = best; let sx = -uz, sz = ux; if ((x - best.qx) * sx + (z - best.qz) * sz < 0) { sx = -sx; sz = -sz; } // side of the road the player is on
    const off = r.w / 2 - 1.15, cx = best.qx + sx * off, cz = best.qz + sz * off; let dir = 1; if (sx * uz - sz * ux > 0) dir = -1; // UK: keep left -> travel so the kerb is on the cab's left
    const h = Math.atan2(ux * dir, uz * dir);
    const path = [[cx, cz]]; let run = 0, px = best.qx, pz = best.qz, k = dir > 0 ? i : i + 1; // walk back up the road ~70 m (against travel)
    while (run < 70) { const nk = dir > 0 ? k : k; const q = r.pts[nk]; if (!q) break; const seg = Math.hypot(q[0] - px, q[1] - pz); if (seg > 0.01) { run += seg; px = q[0]; pz = q[1]; path.push([px + sx * off, pz + sz * off]); } k += dir > 0 ? -1 : 1; if (k < 0 || k >= r.pts.length) break; }
    if (run < 25) { const L = 70 - run; const last = path[path.length - 1]; path.push([last[0] - Math.sin(h) * L, last[1] - Math.cos(h) * L]); }
    return { x: cx, z: cz, px: cx + sx * 2.2, pz: cz + sz * 2.2, h, path: path.reverse() }; };
  let S = null; const tgt = new Vector3();
  const along = (path, d) => { let acc = 0; for (let i = 0; i < path.length - 1; i++) { const a = path[i], c = path[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (acc + L >= d) { const t = (d - acc) / L; return [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, Math.atan2(c[0] - a[0], c[1] - a[1])]; } acc += L; } const e = path[path.length - 1], p = path[path.length - 2] || e; return [e[0], e[1], Math.atan2(e[0] - p[0], e[1] - p[1])]; };
  const plen = (path) => { let s = 0; for (let i = 0; i < path.length - 1; i++) s += Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); return s; };
  const api = {
    get state() { return S && S.mode; },
    hail(P) { if (app.inside) return hud.toast('HAIL A CAB OUTSIDE'); if (S && S.mode !== 'gone') return hud.toast(S.mode === 'wait' ? 'YOUR CAB IS HERE' : 'CAB ON ITS WAY');
      const k = kerb(P.x, P.z); if (!k) return hud.toast('NO ROAD NEARBY'); S = { mode: 'come', k, d: 0, L: plen(k.path) }; node.setEnabled(true); l.setEnabled(true);
      hud.toast('BLACK CAB ON ITS WAY · ' + Math.max(5, Math.round(S.L / 9)) + ' S'); },
    near(P) { return S && S.mode === 'wait' && Math.hypot(P.x - node.position.x, P.z - node.position.z) < 4.5; },
    menu(P, dests) { const rows = dests.map((d, i) => { const m = Math.round(Math.hypot(d.x - P.x, d.z - P.z)); return `<button class="rbstop" data-i="${i}"><b>${d.name}</b><span>${m}M · ${Math.max(1, Math.round(m / 400))} MIN · ON THE HOUSE</span></button>`; }).join('');
      hud.open(`<h2>BLACK CAB</h2><p class="sub">WHERE TO? · FREE IN THE DEMO · NO FARE CHARGED</p><div class="rblist">${rows}</div>`, 'rbov');
      document.querySelectorAll('.rbov .rbstop, .rbstop').forEach(el => el.onclick = () => { hud.close(); api.ride(P, dests[+el.dataset.i]); }); },
    ride(P, dest) { const to = kerb(dest.x, dest.z); if (!to) return hud.toast('CAN\'T GET THERE BY ROAD'); S = { mode: 'ride', t: 0, from: S.k, to, dest, moved: false }; app.paused = true; app.cine = true; player.root.setEnabled(false); if (card) { card.querySelector('small').textContent = 'BLACK CAB'; card.querySelector('b').textContent = 'TO ' + dest.name; } },
    cancel() { S = null; node.setEnabled(false); },
    tick(dt, P) { if (!S) return; // cab approaching / waiting / leaving (not cinematic)
      if (S.mode === 'come') { const left = S.L - S.d, v = Math.max(1.2, Math.min(11, left * 0.6)); S.d = Math.min(S.L, S.d + v * dt); const [x, z, h] = along(S.k.path, S.d); node.position.set(x, -0.085, z); node.rotation.y = h; if (S.d >= S.L - 0.05) { S.mode = 'wait'; S.w = 0; node.rotation.y = S.k.h; hud.toast('YOUR CAB IS HERE · E TO GET IN'); } }
      else if (S.mode === 'wait') { S.w += dt; if (S.w > 90) { S.mode = 'leave'; S.d = 0; hud.toast('THE CAB GAVE UP WAITING'); } }
      else if (S.mode === 'leave' || S.mode === 'gone') { S.d += dt * 9; const h = node.rotation.y; node.position.x += Math.sin(h) * dt * Math.min(11, 2 + S.d); node.position.z += Math.cos(h) * dt * Math.min(11, 2 + S.d); if (S.d > 60) { S = null; node.setEnabled(false); } } },
    // ride cinematic: pull away (0-2.2 s), fade (2.2-2.8), arrive + you step out (2.8-3.4), cab pulls away (to 5.4). Returns true while it owns the camera
    update(dt, P, cam) { if (!S || S.mode !== 'ride') return false; S.t += dt; const t = S.t; let k = S.from, op = 0;
      const place = (kk, d) => { node.position.set(kk.x + Math.sin(kk.h) * d, -0.085, kk.z + Math.cos(kk.h) * d); node.rotation.y = kk.h; };
      if (t < 2.2) { place(k, 18 * ease(Math.min(1, t / 2.2)) ** 2); op = t > 1.6 ? (t - 1.6) / 0.6 : 0; }
      else if (t < 2.8) { place(k, 18); op = 1; }
      else { k = S.to; if (!S.moved) { S.moved = true; P.x = k.px; P.z = k.pz; P.speed = 0; P.heading = Math.atan2(S.dest.x - k.px, S.dest.z - k.pz); player.root.setEnabled(true); }
        const m = Math.max(0, t - 3.6); place(k, 30 * Math.min(1, m / 2) ** 2); op = t < 3.4 ? 1 : Math.max(0, 1 - (t - 3.4) / 0.5); }
      if (fade) { fade.style.opacity = op.toFixed(3); fade.classList.toggle('on', op > 0.5); }
      const sx = k.px - k.x, sz = k.pz - k.z; cam.position.set(k.x - sx * 1.4 - Math.sin(k.h) * 9, 2.4, k.z - sz * 1.4 - Math.cos(k.h) * 9); tgt.set(node.position.x, 1.1, node.position.z); cam.setTarget(tgt); cam.fov = 0.8;
      if (t > 5.4) { const nm = S.dest.name; S = null; node.setEnabled(false); app.paused = false; app.cine = false; if (fade) { fade.style.opacity = '0'; fade.classList.remove('on'); } if (card) card.querySelector('small').textContent = 'RAPID BUS'; hud.toast('DROPPED AT ' + nm); }
      return true; },
    get node() { return node; },
  };
  return api;
}
