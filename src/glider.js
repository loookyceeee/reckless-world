// Rapid-bus fast travel between the venue stops (generic purple articulated bus, no operator marks).
// Walk up to a stop shelter -> E -> pick a venue -> short cinematic: bus pulls in, fade, arrive, bus pulls away.
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

const ease = x => 1 - (1 - x) * (1 - x);
export function createRapid({ scene, traffic, hud, app }) {
  const stops = traffic.rapid || [];
  const tp = traffic.tpl('bus', 'bus', Color3.FromHexString('#7e2a91'));
  const node = new TransformNode('rapidBus', scene); const b = tp.b.createInstance('rapidBusBody'); b.parent = node; b.position.setAll(0); const l = tp.l.createInstance('rapidBusLights'); l.parent = node; l.position.setAll(0); node.setEnabled(false);
  const parkedBus = (traffic.parked || []).filter(p => p.kind === 'bus');
  const fade = document.createElement('div'); fade.id = 'rbFade'; fade.innerHTML = '<div class="rbcard"><small>RAPID BUS</small><b></b></div>'; document.body.appendChild(fade);
  let C = null; const tgt = new Vector3();
  const nearStop = (P) => stops.find(s => Math.hypot(P.x - s.sx, P.z - s.sz) < 4.2);
  const placeBus = (s, d) => { node.position.set(s.bx + s.ux * d, -0.085, s.bz + s.uz * d); node.rotation.y = s.h; };
  const menu = (from, P) => {
    const rows = stops.map((s, i) => { const here = s === from; const dist = Math.round(Math.hypot(s.sx - P.x, s.sz - P.z));
      return `<button class="rbstop ${here ? 'here' : ''}" data-i="${i}" ${here ? 'disabled' : ''}><b>${s.name}</b><span>${here ? 'YOU ARE HERE' : dist + 'M · ' + Math.max(1, Math.round(dist / 250)) + ' MIN'}</span></button>`; }).join('');
    hud.open(`<h2>RAPID BUS</h2><p class="sub">FAST TRAVEL BETWEEN THE RECKLESS VENUES · FREE</p><div class="rblist">${rows}</div>`, 'rbov');
    document.querySelectorAll('.rbstop').forEach(el => el.onclick = () => { hud.close(); start(from, stops[+el.dataset.i]); });
  };
  const start = (from, to) => { C = { from, to, t: 0, moved: false }; app.paused = true; app.cine = true; node.setEnabled(true); placeBus(from, -45); parkedBus.forEach(p => p.node.setEnabled(false));
    fade.querySelector('b').textContent = 'NEXT STOP · ' + to.name; };
  const skip = () => { if (C && C.t > 0.6 && C.t < 3.0) C.t = 3.0; };
  addEventListener('keydown', (e) => { if (C && e.code !== 'KeyW') skip(); });
  addEventListener('pointerdown', () => skip());
  // returns true while the cinematic owns the camera; P = player state
  const update = (dt, P, cam, onArrive) => {
    if (!C) return false; C.t += dt; const t = C.t; let s = C.from, op = 0;
    if (t < 2.4) { placeBus(s, -45 * (1 - ease(t / 2.4))); P.heading = s.h - Math.PI / 2; }
    else if (t < 3.0) { placeBus(s, 0); op = (t - 2.4) / 0.6; }
    else { s = C.to; if (!C.moved) { C.moved = true; P.x = s.sx; P.z = s.sz; P.speed = 0; P.heading = Math.atan2(s.sx - s.bx, s.sz - s.bz); onArrive && onArrive(s); }
      const k = Math.max(0, t - 3.4); placeBus(s, 32 * Math.pow(Math.min(1, k / 2.2), 2)); op = t < 3.4 ? 1 : Math.max(0, 1 - (t - 3.4) / 0.6); }
    fade.style.opacity = op.toFixed(3); fade.classList.toggle('on', op > 0.5);
    // wide kerbside shot: from the pavement ahead of the stop, looking back along the bus
    const kx = (s.sx + s.bx) / 2 + (s.sx - s.bx) * 0.15, kz = (s.sz + s.bz) / 2 + (s.sz - s.bz) * 0.15; // just on the kerb
    const side = t < 3.0 ? 15 : -17; // arrival: ahead of the stop watching it pull in; destination: behind it watching it pull away
    cam.position.set(kx + s.ux * side, 2.0, kz + s.uz * side); tgt.set(node.position.x - s.ux * 4 + (t < 3.0 ? 0 : (s.sx - s.bx) * 0.8), 1.5, node.position.z - s.uz * 4 + (t < 3.0 ? 0 : (s.sz - s.bz) * 0.8)); cam.setTarget(tgt); cam.fov = 0.8;
    if (t > 5.6) { C = null; node.setEnabled(false); parkedBus.forEach(p => p.node.setEnabled(true)); app.paused = false; app.cine = false; fade.style.opacity = '0'; fade.classList.remove('on'); }
    return true;
  };
  return { stops, nearStop, menu, update, get active() { return !!C; }, start };
}
