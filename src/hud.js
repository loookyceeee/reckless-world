// GTA-style HUD: circular B&W minimap with venue pins, full map, prompts, wardrobe, credits, photo frame.
import { VENUES, DISTRICTS, KX, KZ, LAT0 } from './venues.js';
// Research minimap: whole-area 1 px/m GTA-style base (roads by class, parks, river, rail). Falls back to procedural.
export function loadMinimapImage(url, meta) {
  return new Promise((res) => { const im = new Image(); im.onload = () => res({ canvas: im, S: meta.px_per_m, tx: (x) => (x - meta.local_x_at_px0) * meta.px_per_m, ty: (z) => (meta.local_z_at_top - z) * meta.px_per_m, img: true, x0: meta.local_x_at_px0, ztop: meta.local_z_at_top }); im.onerror = () => res(null); im.src = url; });
}
// GPS: A* over the walkable road graph
export function makeRouter(G) {
  const ids = G.nodes; const P = (n) => G.pos.get(n);
  const nearest = (x, z) => { let b = null, bd = 1e18; for (const n of ids) { const p = P(n); const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd) { bd = d; b = n; } } return b; };
  return (fx, fz, tx, tz) => {
    const s = nearest(fx, fz), g = nearest(tx, tz); if (s == null || g == null) return null;
    const gp = P(g); const H = (n) => { const p = P(n); return Math.hypot(p[0] - gp[0], p[1] - gp[1]); };
    const open = new Map([[s, H(s)]]), gs = new Map([[s, 0]]), from = new Map(); const closed = new Set(); let it = 0;
    while (open.size && it++ < 20000) {
      let cur = null, cf = 1e18; for (const [n, f] of open) if (f < cf) { cf = f; cur = n; }
      if (cur === g) { const out = [[tx, tz]]; let n = g; while (n !== undefined) { out.push(P(n)); n = from.get(n); } out.push([fx, fz]); return out.reverse(); }
      open.delete(cur); closed.add(cur); const cp = P(cur);
      for (const nb of G.adj.get(cur) || []) { if (closed.has(nb)) continue; const np = P(nb); const ng = gs.get(cur) + Math.hypot(np[0] - cp[0], np[1] - cp[1]);
        if (ng < (gs.get(nb) ?? 1e18)) { gs.set(nb, ng); from.set(nb, cur); open.set(nb, ng + H(nb)); } }
    }
    return null;
  };
}
export function buildMinimapBase(city) {
  let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
  for (const r of city.roads) for (const p of r.pts) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); mnz = Math.min(mnz, p[1]); mxz = Math.max(mxz, p[1]); }
  const S = 1.2; const W = Math.ceil((mxx - mnx) * S) + 40, H = Math.ceil((mxz - mnz) * S) + 40;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const tx = (x) => (x - mnx) * S + 20, ty = (z) => (mxz - z) * S + 20;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#262626';
  for (const b of city.buildings) { const pts = b.pts || []; if (pts.length < 3) continue; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(tx(p[0]), ty(p[1])) : g.moveTo(tx(p[0]), ty(p[1]))); g.closePath(); g.fill(); }
  const tb = city.buildings.find(b => b.temple); if (tb) { g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < tb.p.length; i += 2) (i ? g.lineTo : g.moveTo).call(g, tx(tb.p[i]), ty(tb.p[i + 1])); g.closePath(); g.fill(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pass of [0, 1]) for (const r of city.roads) {
    if (pass === 0 && r.d) continue; if (pass === 1 && !r.d) continue;
    g.strokeStyle = r.d ? '#f2f2f2' : '#5a5a5a'; g.lineWidth = r.d ? Math.max(2.2, r.w * S * 0.75) : 1.2;
    g.beginPath(); r.pts.forEach((p, i) => i ? g.lineTo(tx(p[0]), ty(p[1])) : g.moveTo(tx(p[0]), ty(p[1]))); g.stroke();
  }
  return { canvas: c, tx, ty, S, bounds: { mnx, mxx, mnz, mxz } };
}
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export function createHUD(app) {
  const hud = el('div', 'hud'); document.body.appendChild(hud);
  hud.innerHTML = `
  <div class="brand"><img src="${import.meta.env.BASE_URL}img/logo.png" alt="Reckless"/><div><b>RECKLESS WORLD</b><span>BELFAST · PROTOTYPE 0.1</span></div></div>
  <div class="topright"><div class="fps" id="fps">— FPS</div><div class="live" id="live"><i></i><span>RAVE MODE · DEMO</span> <a href="https://www.recklessraves.co.uk" target="_blank" rel="noopener">TICKETS</a></div><div class="objective" id="objective"></div></div>
  <div class="mapwrap"><canvas id="minimap" width="220" height="220"></canvas><div class="street" id="street"></div><div class="district" id="district"></div></div>
  <div class="prompt" id="prompt"></div>
  <div class="toast" id="toast"></div>
  <div class="btns"><button data-k="m">MAP</button><button data-k="o">WARDROBE</button><button data-k="f">DANCE</button><button data-k="p">PHOTO</button><button data-k="c">CREDITS</button><button data-k="n" id="sndBtn">SOUND: OFF</button><button data-k="l" id="lightsBtn" class="hide">LIGHTS: RAVE</button></div>
  <div class="touch" id="touch"><div class="stick" id="stick"><div class="nub" id="nub"></div></div><button class="tbtn run" id="tRun">RUN</button><button class="tbtn act" id="tAct">E</button></div>
  <div class="fade" id="fade"></div>`;
  const $ = (id) => hud.querySelector('#' + id);
  // overlays
  const overlay = el('div', 'overlay hidden'); document.body.appendChild(overlay);
  const open = (html, cls = '') => { overlay.className = 'overlay ' + cls; overlay.innerHTML = `<div class="panel">${html}<button class="close">CLOSE</button></div>`; overlay.querySelector('.close').onclick = close; app.paused = true; };
  const close = () => { overlay.className = 'overlay hidden'; overlay.innerHTML = ''; app.paused = false; };
  const isOpen = () => !overlay.classList.contains('hidden');
  const mm = $('minimap'), mg = mm.getContext('2d'); const base = app.mapBase;
  const dpr = Math.min(2, window.devicePixelRatio || 1); const MS = 220; mm.width = mm.height = MS * dpr; mg.scale(dpr, dpr);
  let toastT = 0;
  const api = {
    hud, $, close, isOpen,
    toast(msg, s = 2.6) { $('toast').textContent = msg; $('toast').classList.add('on'); clearTimeout(api._tt); api._tt = setTimeout(() => $('toast').classList.remove('on'), s * 1000); },
    prompt(msg) { const p = $('prompt'); if (msg) { p.innerHTML = msg; p.classList.add('on'); } else p.classList.remove('on'); },
    fade(on) { $('fade').classList.toggle('on', on); },
    setLive(on) { $('live').classList.toggle('off', !on); },
    fps(v) { $('fps').textContent = v + ' FPS'; },
    interior(on, mode) { $('lightsBtn').classList.toggle('hide', !on); $('lightsBtn').textContent = 'LIGHTS: ' + (mode === 'day' ? 'DAY' : 'RAVE'); hud.classList.toggle('inside', on); },
    update(dt, st) {
      // ---- minimap ----
      const R = MS / 2, zoom = st.inside ? 6 : 0.62;
      mg.save(); mg.clearRect(0, 0, MS, MS); mg.beginPath(); mg.arc(R, R, R - 3, 0, Math.PI * 2); mg.clip();
      mg.fillStyle = '#000'; mg.fillRect(0, 0, MS, MS);
      mg.translate(R, R); mg.rotate(-st.camYaw); // map rotates with camera (up = view direction)
      if (!st.inside) {
        const px = base.tx(st.x), py = base.ty(st.z); const k = zoom / base.S;
        mg.scale(k, k); mg.drawImage(base.canvas, -px, -py);
        if (st.route && st.route.length > 1) { mg.strokeStyle = '#ff2a3c'; mg.lineWidth = 5 / k; mg.lineJoin = mg.lineCap = 'round'; mg.beginPath(); st.route.forEach((p, i) => { const x = base.tx(p[0]) - px, y = base.ty(p[1]) - py; i ? mg.lineTo(x, y) : mg.moveTo(x, y); }); mg.stroke(); }
        mg.scale(1 / k, 1 / k);
      } else { // interior: nave layout with stage, barrier, bar and exits
        const X = (x) => (x - st.lx) * zoom, Y = (z) => -(z - st.lz) * zoom;
        mg.fillStyle = '#141414'; mg.fillRect(X(-9.6), Y(46), 19.2 * zoom, 46 * zoom);
        mg.strokeStyle = '#fff'; mg.lineWidth = 2; mg.strokeRect(X(-9.6), Y(46), 19.2 * zoom, 46 * zoom);
        mg.fillStyle = '#555'; for (let z = 3; z < 34; z += 6) for (const sx of [-5, 5]) mg.fillRect(X(sx) - 2, Y(z) - 2, 4, 4);
        mg.fillStyle = '#fff'; mg.fillRect(X(-5), Y(46), 10 * zoom, 11.4 * zoom); // stage
        mg.strokeStyle = '#ff2a3c'; mg.beginPath(); mg.moveTo(X(-5), Y(34.2)); mg.lineTo(X(5), Y(34.2)); mg.stroke();
        mg.fillStyle = '#ff2a3c'; mg.fillRect(X(6.8), Y(9), 0.8 * zoom, 5 * zoom);
        mg.fillStyle = '#2bd46a'; mg.fillRect(X(-1.5), Y(0.4), 3 * zoom, 0.8 * zoom);
        mg.font = '700 9px Unbounded, sans-serif'; mg.textAlign = 'center'; mg.fillStyle = '#000'; mg.fillText('STAGE', X(0), Y(40));
        mg.fillStyle = '#fff'; mg.fillText('BAR', X(7.2), Y(10.5)); mg.fillText('EXIT', X(0), Y(-1.2)); }
      mg.restore();
      // pins
      mg.save(); mg.font = '700 9px Unbounded, sans-serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle';
      const cs = Math.cos(st.camYaw), sn = -Math.sin(st.camYaw);
      if (!st.inside) for (const v of VENUES) {
        const dx = (v.x - st.x) * zoom, dy = -(v.z - st.z) * zoom; let x = dx * cs - dy * sn, y = dx * sn + dy * cs;
        const d = Math.hypot(x, y), lim = R - 16; let edge = false; if (d > lim) { x *= lim / d; y *= lim / d; edge = true; }
        mg.fillStyle = v.inSlice ? '#fff' : '#000'; mg.strokeStyle = '#fff'; mg.lineWidth = 2;
        mg.beginPath(); mg.arc(R + x, R + y, 9, 0, Math.PI * 2); mg.fill(); mg.stroke();
        mg.fillStyle = v.inSlice ? '#000' : '#fff'; mg.fillText(v.pin, R + x, R + y + 0.5);
        if (!edge || !v.inSlice) { mg.fillStyle = '#fff'; mg.font = '600 7px "DM Sans", sans-serif'; const lbl = v.inSlice ? v.name : v.name + ' · COMING SOON'; if (!edge) mg.fillText(lbl, R + x, R + y + 15); mg.font = '700 9px Unbounded, sans-serif'; }
      }
      // north marker
      const nx = sn * (R - 9), ny = -cs * (R - 9);
      mg.fillStyle = '#fff'; mg.beginPath(); mg.arc(R + nx, R + ny, 8, 0, 7); mg.fill(); mg.fillStyle = '#000'; mg.font = '800 9px Unbounded, sans-serif'; mg.fillText('N', R + nx, R + ny + 0.5);
      // player arrow
      mg.translate(R, R); mg.rotate(st.heading - st.camYaw + Math.PI * 0 ); mg.fillStyle = '#fff'; mg.strokeStyle = '#000'; mg.lineWidth = 2;
      mg.beginPath(); mg.moveTo(0, -9); mg.lineTo(6.5, 7); mg.lineTo(0, 3.5); mg.lineTo(-6.5, 7); mg.closePath(); mg.fill(); mg.stroke();
      mg.restore();
      mg.strokeStyle = '#fff'; mg.lineWidth = 3; mg.beginPath(); mg.arc(R, R, R - 3, 0, Math.PI * 2); mg.stroke();
      $('street').textContent = st.street || ''; $('district').textContent = st.district || '';
      $('objective').innerHTML = st.objective || '';
    },
    openMap(st) {
      open(`<h2>BELFAST</h2><canvas id="bigmap" width="900" height="900"></canvas><p class="legend">WHITE PINS = WALK IN NOW · BLACK PINS = COMING SOON</p>`, 'mapov');
      const c = overlay.querySelector('#bigmap'), g = c.getContext('2d'); const W = c.width;
      const all = VENUES.map(v => [v.x, v.z]).concat([[base.bounds.mnx, base.bounds.mnz], [base.bounds.mxx, base.bounds.mxz]]);
      const mnx = Math.min(...all.map(a => a[0])) - 150, mxx = Math.max(...all.map(a => a[0])) + 150, mnz = Math.min(...all.map(a => a[1])) - 150, mxz = Math.max(...all.map(a => a[1])) + 150;
      const s = Math.min(W / (mxx - mnx), W / (mxz - mnz)); const X = (x) => (x - mnx) * s + (W - (mxx - mnx) * s) / 2, Y = (z) => (mxz - z) * s + (W - (mxz - mnz) * s) / 2;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, W);
      g.strokeStyle = '#1c1c1c'; g.lineWidth = 1; for (let i = -3000; i < 3000; i += 250) { g.beginPath(); g.moveTo(X(i), 0); g.lineTo(X(i), W); g.stroke(); g.beginPath(); g.moveTo(0, Y(i)); g.lineTo(W, Y(i)); g.stroke(); }
      const k = s / base.S; if (base.img) g.drawImage(base.canvas, X(base.x0), Y(base.ztop), base.canvas.width * k, base.canvas.height * k); else g.drawImage(base.canvas, X(base.bounds.mnx) - 20 * k, Y(base.bounds.mxz) - 20 * k, base.canvas.width * k, base.canvas.height * k);
      g.strokeStyle = '#fff'; g.setLineDash([6, 6]); g.strokeRect(X(base.bounds.mnx), Y(base.bounds.mxz), (base.bounds.mxx - base.bounds.mnx) * s, (base.bounds.mxz - base.bounds.mnz) * s); g.setLineDash([]);
      g.font = '700 13px Unbounded, sans-serif'; g.fillStyle = '#fff'; g.fillText('PLAYABLE SLICE', X(base.bounds.mnx) + 8, Y(base.bounds.mxz) + 20);
      for (const v of VENUES) {
        const x = X(v.x), y = Y(v.z); g.fillStyle = v.inSlice ? '#fff' : '#000'; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 15, 0, 7); g.fill(); g.stroke();
        g.fillStyle = v.inSlice ? '#000' : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 14px Unbounded, sans-serif'; g.fillText(v.pin, x, y + 1);
        g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = '700 13px Unbounded, sans-serif'; g.fillText(v.name, x + 22, y - 6);
        g.font = '600 11px "DM Sans", sans-serif'; g.fillText(v.inSlice ? v.sub : v.sub + ' · COMING SOON', x + 22, y + 10);
      }
      const px = X(st.x), py = Y(st.z); g.save(); g.translate(px, py); g.rotate(st.heading); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -12); g.lineTo(9, 9); g.lineTo(0, 4); g.lineTo(-9, 9); g.closePath(); g.fill(); g.stroke(); g.restore();
    },
    openWardrobe(outfits, current, pick, email, setEmail) {
      open(`<h2>WARDROBE</h2><p class="sub">CLOTHING DROP 018 · TRY-ON ONLY</p><div class="outfits">${outfits.map(o => `<button class="of ${o.id === current ? 'sel' : ''}" data-id="${o.id}">${o.name}</button>`).join('')}</div>
      <h3>CREW EMAIL <small>(OPTIONAL · TEST EVENTS ONLY)</small></h3><div class="row"><input id="email" type="email" placeholder="you@example.com" value="${email || ''}"/><button id="saveEmail">SAVE</button></div>
      <p class="fine">NO XP OR CODES ARE AWARDED IN THE GAME. WITH AN EMAIL SET, VISITS AND POSTERS ARE QUEUED AS TEST EVENTS ON THIS DEVICE ONLY.</p>`);
      overlay.querySelectorAll('.of').forEach(b => b.onclick = () => { pick(b.dataset.id); overlay.querySelectorAll('.of').forEach(x => x.classList.toggle('sel', x === b)); });
      overlay.querySelector('#saveEmail').onclick = () => { setEmail(overlay.querySelector('#email').value); api.toast('EMAIL SAVED ON THIS DEVICE'); };
    },
    openCredits(extra) {
      open(`<h2>CREDITS</h2>
      <p><b>MAP DATA</b> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>, available under the Open Database Licence (ODbL 1.0). Roads and building footprints fetched via the Overpass API, 18 Nov 2026. Building heights are from Belfast City LIDAR 2006 and OSM tags where present, otherwise estimated.</p>
      <p><b>LIDAR</b> Belfast City LIDAR is provided by the Department for Infrastructure (Rivers) with the permission of the copyright owner, Cyient Europe Limited, and licensed under the Open Government Licence v3.0.</p>
      <p><b>OPEN DATA</b> Contains DfI Roads street lighting and crossing data, Belfast City Council trees data and Translink route data, all under the Open Government Licence v3.0 via OpenDataNI.</p>
      <p><b>ANIMATION</b> Quaternius Universal Animation Library (CC0), retargeted to the Reckless avatar. Other CC0 assets: Kenney, Quaternius, Poly Haven, ambientCG.</p>
      <p><b>SKY &amp; SOUND</b> Night reflections from the Poly Haven HDRI “Cobblestone Street Night” (CC0). Night sky, city ambience and the 140 BPM Temple beat are generated in the browser (original, no samples). Shop names are invented.</p>
      <p><b>ENGINE</b> Babylon.js (Apache-2.0) · earcut (ISC) · Vite (MIT)</p>
      <p><b>FONTS</b> Unbounded and DM Sans (SIL Open Font License, via Fontsource)</p>
      <p><b>CHARACTER</b> Clay avatar built for Reckless Raves from the canonical Crew avatar art. Outfits approximate RCKLS Clothing Drop 018.</p>
      <p><b>THE TEMPLE</b> Interior modelled from Reckless Raves reference photos.</p>
      <p><b>VEHICLES</b> Patrol vehicles are fictional. No real police force, wordmark, emblem or manufacturer badge is depicted.</p>
      <p class="fine">CONTROLS: WASD / ARROWS MOVE · SHIFT RUN · DRAG TO LOOK · WHEEL ZOOM · E INTERACT · F DANCE · M MAP · O WARDROBE · P PHOTO · L TEMPLE LIGHTS · N SOUND</p>
      <div class="row">${extra || ''}</div>`);
    },
    open,
  };
  hud.querySelectorAll('.btns button').forEach(b => b.onclick = (e) => { e.stopPropagation(); app.key(b.dataset.k); });
  return api;
}
