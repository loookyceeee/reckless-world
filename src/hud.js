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
  <div class="brand"><img src="${import.meta.env.BASE_URL}img/logo.png" alt="Reckless"/><div><b>RECKLESS WORLD</b><span>BELFAST</span></div></div>
  <div class="topright"><div class="fps" id="fps">— FPS</div><div class="live" id="live"><i></i><span>RAVE MODE · DEMO</span> <a href="https://www.recklessraves.co.uk" target="_blank" rel="noopener">TICKETS</a></div><div class="heat" id="heat" title="HEAT"><i></i><i></i><i></i></div><div class="objective" id="objective"></div><a class="np" id="np" target="_blank" rel="noopener"></a></div>
  <div class="mapwrap"><canvas id="minimap" width="220" height="220"></canvas><canvas id="stam" width="240" height="240"></canvas><div class="street" id="street"></div><div class="district" id="district"></div><div class="gps" id="gps"></div></div>
  <div class="prompt" id="prompt"></div>
  <div class="toast" id="toast"></div>
  <div class="notes" id="notes"></div>
  <div class="mtitle" id="mtitle"><div class="lb t"></div><div class="lb b"></div><div class="mtb"><small></small><b></b></div></div>
  <div class="hints" id="hints"></div>
  <div class="stamp" id="stamp"><div class="lb t"></div><div class="lb b"></div><div class="sbody"><div class="stitle"></div><div class="ssub"></div><div class="slines"></div></div></div>
  <div class="keys" id="keys"></div>
  <div class="touch" id="touch"><div class="stick" id="stick"><div class="nub" id="nub"></div></div><button class="tbtn run" id="tRun">RUN</button><button class="tbtn act" id="tAct">E</button><button class="tbtn jmp" id="tJump">JUMP</button><button class="tbtn tph" id="tPhone">☐<em id="tPhoneN"></em></button><button class="tbtn whl" id="tWheel">◎</button></div>
  <div class="fade" id="fade"></div>`;
  const $ = (id) => hud.querySelector('#' + id);
  // overlays
  const overlay = el('div', 'overlay hidden'); document.body.appendChild(overlay);
  const open = (html, cls = '') => { overlay.className = 'overlay ' + cls; overlay.innerHTML = `<div class="panel">${html}<button class="close">CLOSE</button></div>`; overlay.querySelector('.close').onclick = close; app.paused = true; };
  const close = () => { overlay.className = 'overlay hidden'; overlay.innerHTML = ''; app.paused = false; };
  const isOpen = () => !overlay.classList.contains('hidden');
  let stamVis = 0; const mm = $('minimap'), mg = mm.getContext('2d'); const base = app.mapBase;
  const dpr = Math.min(2, window.devicePixelRatio || 1); const MS = 220; mm.width = mm.height = MS * dpr; mg.scale(dpr, dpr);
  let toastT = 0;
  const FK = 'rw.mapFilters.v1'; let FIL = { venues: true, stops: true, posters: true, collectibles: true }; try { FIL = { ...FIL, ...JSON.parse(localStorage.getItem(FK) || '{}') }; } catch (e) { }
  const api = {
    hud, $, close, isOpen,
    filters: () => FIL, setFilter(k, v) { FIL[k] = v; localStorage.setItem(FK, JSON.stringify(FIL)); },
    // world/crew/radio notifications (top-right stack, max 3) — research/game-design.md 1.8
    note({ kicker = 'RECKLESS', title = '', body = '', type = '', hold } = {}) {
      const box = $('notes'); const n = el('div', 'note' + (type ? ' ' + type : ''));
      const tm = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
      n.innerHTML = `<div class="nk"><span></span><i>${tm}</i></div><div class="nt"></div>${body ? '<div class="nb"></div>' : ''}`;
      n.querySelector('.nk span').textContent = kicker; n.querySelector('.nt').textContent = title; if (body) n.querySelector('.nb').textContent = body;
      box.prepend(n); while (box.children.length > 3) box.lastChild.remove();
      requestAnimationFrame(() => n.classList.add('on'));
      const h = hold ?? (type === 'radio' ? 4 : 5); setTimeout(() => { n.classList.remove('on'); n.classList.add('off'); setTimeout(() => n.remove(), 320); }, h * 1000);
      return n;
    },
    // record-stamp moment for a finished activity (1.9): letterbox, big title, breakdown lines, ~5 s. Never prints XP.
    stamp({ title = 'MISSION PASSED', sub = '', lines = [], fail = false } = {}) {
      const S = $('stamp'); S.className = 'stamp' + (fail ? ' fail' : ''); S.querySelector('.stitle').textContent = title; S.querySelector('.ssub').textContent = sub;
      const L = S.querySelector('.slines'); L.innerHTML = ''; clearTimeout(api._st1); clearTimeout(api._st2);
      void S.offsetWidth; S.classList.add('on'); hud.classList.add('stamping');
      lines.forEach((t, i) => setTimeout(() => { const d = el('div', 'sl'); d.textContent = t; L.appendChild(d); requestAnimationFrame(() => d.classList.add('on')); }, 1400 + i * 160));
      api._st1 = setTimeout(() => S.classList.add('out'), 4200); api._st2 = setTimeout(() => { S.className = 'stamp'; hud.classList.remove('stamping'); }, 5000);
    },
    // mission intro (1.9): letterbox, kicker, display title, hold 2.4 s, then the objective slot takes over
    mtitle({ kicker = 'NEW ACTIVITY', title = '', red = false } = {}) {
      const M = $('mtitle'); M.className = 'mtitle' + (red ? ' red' : ''); M.querySelector('small').textContent = kicker; M.querySelector('b').textContent = title;
      void M.offsetWidth; M.classList.add('on'); clearTimeout(api._mt); api._mt = setTimeout(() => { M.classList.add('out'); setTimeout(() => { M.className = 'mtitle'; }, 500); }, 2800);
    },
    // heat pips (2.5): solid = active, red pulsing frame = searching (no line of sight), white flash when a pip is added
    heat(level, searching, flash) { const h = $('heat'); h.classList.toggle('on', level > 0); h.classList.toggle('search', !!searching && level > 0); h.classList.toggle('flash', !!flash);
      h.querySelectorAll('i').forEach((p, i) => p.classList.toggle('a', i < level)); },
    hints(html, ms = 6000) { const h = $('hints'); if (!html) { h.classList.remove('on'); return; } h.innerHTML = html; h.classList.add('on'); clearTimeout(api._hn); api._hn = setTimeout(() => h.classList.remove('on'), ms); },
    toast(msg, s = 2.6) { $('toast').textContent = msg; $('toast').classList.add('on'); clearTimeout(api._tt); api._tt = setTimeout(() => $('toast').classList.remove('on'), s * 1000); },
    prompt(msg) { const p = $('prompt'); if (msg) { p.innerHTML = msg; p.classList.add('on'); } else p.classList.remove('on'); },
    fade(on) { $('fade').classList.toggle('on', on); },
    setLive(on) { $('live').classList.toggle('off', !on); },
    fps(v) { $('fps').textContent = v + ' FPS'; },
    interior(on, mode) { hud.classList.toggle('inside', on); },
    // GTA-style key hints: a short row of key chips bottom-right that fades in when it has something to say and fades out after ms
    keys(list, ms = 6000) { const k = $('keys'); clearTimeout(api._kt); if (!list || !list.length) { k.classList.remove('on'); return; }
      const html = list.map(([key, label]) => `<span><kbd>${key}</kbd>${label}</span>`).join(''); if (k._h !== html) { k._h = html; k.innerHTML = html; }
      k.classList.add('on'); if (ms) api._kt = setTimeout(() => k.classList.remove('on'), ms); },
    update(dt, st) {
      // ---- stamina half-ring under the minimap: invisible when full, fades 1.2 s after refilling, pulses red when emptied ----
      { const c = $('stam'); if (c) { const g = c.getContext('2d'); const v = st.stamina == null ? 1 : st.stamina; stamVis = v < 0.999 ? 1 : Math.max(0, stamVis - dt / 1.2);
        g.clearRect(0, 0, 240, 240); if (stamVis > 0) { g.globalAlpha = stamVis; g.lineWidth = 4; g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.arc(120, 120, 114, Math.PI, 0, true); g.stroke();
          g.strokeStyle = st.stamFlash > 0 && Math.floor(st.stamFlash * 10) % 2 === 0 ? '#ff2a2a' : '#fff'; g.beginPath(); g.arc(120, 120, 114, Math.PI, Math.PI - Math.PI * v, true); g.stroke(); g.globalAlpha = 1; } } }
      // ---- minimap ----
      // speed-driven zoom (GTA radar: tight on foot, pulls out when sprinting / on transit), smoothed
      { const sp = api._lx == null ? 0 : Math.hypot(st.x - api._lx, st.z - api._lz) / Math.max(dt, 1e-3); api._lx = st.x; api._lz = st.z; api._sp = (api._sp || 0) + (Math.min(sp, 40) - (api._sp || 0)) * Math.min(1, dt * 2.5); }
      const zTarget = st.inside ? 6 : 0.7 / (1 + Math.max(0, api._sp - 2) * 0.09); api._z = api._z == null ? zTarget : api._z + (zTarget - api._z) * Math.min(1, dt * 2);
      const R = MS / 2, zoom = st.inside ? 6 : api._z;
      mg.save(); mg.clearRect(0, 0, MS, MS); mg.beginPath(); mg.arc(R, R, R - 3, 0, Math.PI * 2); mg.clip();
      mg.fillStyle = '#000'; mg.fillRect(0, 0, MS, MS);
      mg.translate(R, R); mg.rotate(-st.camYaw); // map rotates with camera (up = view direction)
      if (!st.inside) {
        const px = base.tx(st.x), py = base.ty(st.z); const k = zoom / base.S;
        mg.scale(k, k); mg.drawImage(base.canvas, -px, -py);
        if (st.route && st.route.length > 1) { mg.lineJoin = mg.lineCap = 'round'; const path = () => { mg.beginPath(); st.route.forEach((p, i) => { const x = base.tx(p[0]) - px, y = base.ty(p[1]) - py; i ? mg.lineTo(x, y) : mg.moveTo(x, y); }); };
          mg.strokeStyle = '#000'; mg.lineWidth = 9 / k; path(); mg.stroke(); mg.strokeStyle = '#ff2a3c'; mg.lineWidth = 5 / k; path(); mg.stroke(); }
        // blips under the venue pins: rapid-bus stops, poster spots (filters shared with the pause map)
        const F = api.filters(), bl = (x, z, f) => { f(base.tx(x) - px, base.ty(z) - py); };
        if (F.stops) for (const b of (app.blips && app.blips.stops) || []) bl(b.x, b.z, (x, y) => { const r = 6 / k; mg.fillStyle = '#fff'; mg.fillRect(x - r, y - r, 2 * r, 2 * r); mg.fillStyle = '#000'; mg.font = `800 ${8 / k}px Unbounded, sans-serif`; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText('B', x, y + 0.5 / k); });
        if (F.posters) for (const b of (app.blips && app.blips.posters) || []) bl(b.x, b.z, (x, y) => { const r = 4 / k; mg.fillStyle = b.done ? '#777' : '#ff2a3c'; mg.fillRect(x - r * 0.7, y - r, r * 1.4, r * 2); });
        for (const b of st.patrols || []) if (b.cone) { // view cone: 28 m, ±20° (what missions.js tests); red when it has you
          mg.beginPath(); mg.moveTo(base.tx(b.x) - px, base.ty(b.z) - py); for (let i = 0; i <= 8; i++) { const a = b.h - 0.349 + i * 0.0873; mg.lineTo(base.tx(b.x + Math.sin(a) * 28) - px, base.ty(b.z + Math.cos(a) * 28) - py); }
          mg.closePath(); mg.fillStyle = b.sees ? 'rgba(255,42,60,.45)' : 'rgba(255,255,255,.16)'; mg.fill(); mg.strokeStyle = b.sees ? '#ff2a3c' : 'rgba(255,255,255,.5)'; mg.lineWidth = 1 / k; mg.stroke(); }
        for (const b of st.patrols || []) bl(b.x, b.z, (x, y) => { const r = 5 / k; mg.fillStyle = '#fff'; mg.strokeStyle = '#ff2a3c'; mg.lineWidth = 2 / k; mg.beginPath(); mg.arc(x, y, r, 0, Math.PI * 2); mg.fill(); mg.stroke(); });
        if (st.dest && st.dest.kind === 'waypoint') bl(st.dest.x, st.dest.z, (x, y) => { const r = 7 / k; mg.fillStyle = '#ff2a3c'; mg.strokeStyle = '#fff'; mg.lineWidth = 2 / k; mg.beginPath(); mg.moveTo(x, y - r); mg.lineTo(x + r, y); mg.lineTo(x, y + r); mg.lineTo(x - r, y); mg.closePath(); mg.fill(); mg.stroke(); });
        mg.scale(1 / k, 1 / k);
      } else { // interior: nave layout with stage, barrier, bar and exits
        const X = (x) => (x - st.lx) * zoom, Y = (z) => -(z - st.lz) * zoom;
        if (st.plan) { const pl = st.plan; mg.fillStyle = '#141414'; mg.fillRect(X(-pl.W / 2), Y(pl.D), pl.W * zoom, pl.D * zoom); mg.strokeStyle = '#fff'; mg.lineWidth = 2; mg.strokeRect(X(-pl.W / 2), Y(pl.D), pl.W * zoom, pl.D * zoom);
          mg.font = '700 9px Unbounded, sans-serif'; mg.textAlign = 'center';
          for (const r of pl.rects) { mg.fillStyle = r.c; mg.fillRect(X(r.x), Y(r.z + r.d), r.w * zoom, r.d * zoom); mg.fillStyle = r.c === '#fff' ? '#000' : '#fff'; mg.fillText(r.t, X(r.x + r.w / 2), Y(r.z + r.d / 2) + 3); }
          mg.fillStyle = '#2bd46a'; mg.fillRect(X(-1.5), Y(0.4), 3 * zoom, 0.8 * zoom); mg.fillStyle = '#fff'; mg.fillText('EXIT', X(0), Y(-1.2));
        } else {
        mg.fillStyle = '#141414'; mg.fillRect(X(-9.6), Y(46), 19.2 * zoom, 46 * zoom);
        mg.strokeStyle = '#fff'; mg.lineWidth = 2; mg.strokeRect(X(-9.6), Y(46), 19.2 * zoom, 46 * zoom);
        mg.fillStyle = '#555'; for (let z = 3; z < 34; z += 6) for (const sx of [-5, 5]) mg.fillRect(X(sx) - 2, Y(z) - 2, 4, 4);
        mg.fillStyle = '#fff'; mg.fillRect(X(-5), Y(46), 10 * zoom, 11.4 * zoom); // stage
        mg.strokeStyle = '#ff2a3c'; mg.beginPath(); mg.moveTo(X(-5), Y(34.2)); mg.lineTo(X(5), Y(34.2)); mg.stroke();
        mg.fillStyle = '#ff2a3c'; mg.fillRect(X(6.8), Y(9), 0.8 * zoom, 5 * zoom);
        mg.fillStyle = '#2bd46a'; mg.fillRect(X(-1.5), Y(0.4), 3 * zoom, 0.8 * zoom);
        mg.font = '700 9px Unbounded, sans-serif'; mg.textAlign = 'center'; mg.fillStyle = '#000'; mg.fillText('STAGE', X(0), Y(40));
        mg.fillStyle = '#fff'; mg.fillText('BAR', X(7.2), Y(10.5)); mg.fillText('EXIT', X(0), Y(-1.2)); } }
      mg.restore();
      // pins
      mg.save(); mg.font = '700 9px Unbounded, sans-serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle';
      const cs = Math.cos(st.camYaw), sn = -Math.sin(st.camYaw);
      if (!st.inside && FIL.venues) for (const v of VENUES) {
        const dx = (v.x - st.x) * zoom, dy = -(v.z - st.z) * zoom; let x = dx * cs - dy * sn, y = dx * sn + dy * cs;
        const d = Math.hypot(x, y), lim = R - 16; let edge = false; if (d > lim) { x *= lim / d; y *= lim / d; edge = true; }
        mg.fillStyle = v.inSlice ? '#fff' : '#000'; mg.strokeStyle = '#fff'; mg.lineWidth = 2;
        mg.beginPath(); mg.arc(R + x, R + y, 9, 0, Math.PI * 2); mg.fill(); mg.stroke();
        mg.fillStyle = v.inSlice ? '#000' : '#fff'; mg.fillText(v.pin, R + x, R + y + 0.5);
        if (!edge || !v.inSlice) { mg.fillStyle = '#fff'; mg.font = '600 7px "DM Sans", sans-serif'; const lbl = v.inSlice ? v.name : v.nostalgia ? v.name + ' · EST.' : v.name + ' · COMING SOON'; if (!edge) mg.fillText(lbl, R + x, R + y + 15); mg.font = '700 9px Unbounded, sans-serif'; }
      }
      // destination marker: red diamond, clamped to the rim with a pointer when it's off the radar (GTA-style)
      if (st.dest && !st.inside) { const dx = (st.dest.x - st.x) * zoom, dy = -(st.dest.z - st.z) * zoom; let x = dx * cs - dy * sn, y = dx * sn + dy * cs; const d = Math.hypot(x, y), lim = R - 14;
        const edge = d > lim; if (edge) { x *= lim / d; y *= lim / d; } const r = edge ? 7 : 6, pul = 1 + 0.15 * Math.sin(performance.now() / 180);
        mg.save(); mg.translate(R + x, R + y); if (edge) { mg.rotate(Math.atan2(y, x)); mg.fillStyle = '#ff2a3c'; mg.beginPath(); mg.moveTo(r + 7, 0); mg.lineTo(r, -4); mg.lineTo(r, 4); mg.closePath(); mg.fill(); mg.rotate(-Math.atan2(y, x)); }
        mg.scale(pul, pul); mg.fillStyle = '#ff2a3c'; mg.strokeStyle = '#fff'; mg.lineWidth = 2; mg.beginPath(); mg.moveTo(0, -r); mg.lineTo(r, 0); mg.lineTo(0, r); mg.lineTo(-r, 0); mg.closePath(); mg.fill(); mg.stroke(); mg.restore(); }
      // north marker
      const nx = sn * (R - 9), ny = -cs * (R - 9);
      mg.fillStyle = '#fff'; mg.beginPath(); mg.arc(R + nx, R + ny, 8, 0, 7); mg.fill(); mg.fillStyle = '#000'; mg.font = '800 9px Unbounded, sans-serif'; mg.fillText('N', R + nx, R + ny + 0.5);
      // player arrow
      mg.translate(R, R); mg.rotate(st.heading - st.camYaw + Math.PI * 0 ); mg.fillStyle = '#fff'; mg.strokeStyle = '#000'; mg.lineWidth = 2;
      mg.beginPath(); mg.moveTo(0, -9); mg.lineTo(6.5, 7); mg.lineTo(0, 3.5); mg.lineTo(-6.5, 7); mg.closePath(); mg.fill(); mg.stroke();
      mg.restore();
      mg.strokeStyle = '#fff'; mg.lineWidth = 3; mg.beginPath(); mg.arc(R, R, R - 3, 0, Math.PI * 2); mg.stroke();
      $('street').textContent = st.street || ''; $('district').textContent = st.district || '';
      { const d = $('gps'); if (st.dest && !st.inside) { const m = Math.hypot(st.dest.x - st.x, st.dest.z - st.z); d.innerHTML = `<i></i>${st.dest.label} · ${m < 1000 ? Math.round(m / 10) * 10 + ' M' : (m / 1000).toFixed(1) + ' KM'}`; d.classList.add('on'); } else d.classList.remove('on'); }
      $('objective').innerHTML = st.objective || '';
    },
    openMap(st) { // st = { P, route(fx,fz,tx,tz), getDest(), setDest(d|null), venues:[{id,name,x,z}] }
      open(`<div class="pm"><div class="pmhead"><h2>BELFAST</h2><span class="pmhint">DRAG TO PAN · WHEEL / PINCH TO ZOOM · TAP THE MAP TO DROP A WAYPOINT</span></div>
        <div class="pmbody"><div class="pmcanvas"><canvas id="bigmap"></canvas><div class="pmzoom"><button data-z="1.4">+</button><button data-z="0.7">−</button><button data-z="me">◎</button></div></div>
        <aside class="pmside"><h3>DESTINATION</h3><div class="pmdest" id="pmdest"></div>
          <div class="pmvenues">${(st.venues || []).map(v => `<button class="pmv" data-v="${v.id}"><b>${v.pin || ''}</b><span>${v.name}</span></button>`).join('')}</div>
          <h3>LEGEND</h3><div class="pmleg">
            <label><input type="checkbox" data-f="venues" ${FIL.venues ? 'checked' : ''}/><i class="lg v"></i>VENUES</label>
            <label><input type="checkbox" data-f="stops" ${FIL.stops ? 'checked' : ''}/><i class="lg b">B</i>RAPID BUS STOPS</label>
            <label><input type="checkbox" data-f="posters" ${FIL.posters ? 'checked' : ''}/><i class="lg p"></i>POSTER SPOTS</label>
            <label><input type="checkbox" data-f="collectibles" ${FIL.collectibles ? 'checked' : ''}/><i class="lg c"></i>COLLECTIBLES${(app.blips && app.blips.collectibles && app.blips.collectibles.length) ? '' : ' · SOON'}</label>
            <div class="lgrow"><i class="lg r"></i>GPS ROUTE</div><div class="lgrow"><i class="lg w"></i>WAYPOINT</div><div class="lgrow"><i class="lg me"></i>YOU</div></div>
          <button class="pmclear" id="pmclear">CLEAR WAYPOINT</button></aside></div></div>`, 'mapov');
      const c = overlay.querySelector('#bigmap'), g = c.getContext('2d'); const wrap = c.parentElement; const dpr = Math.min(2, window.devicePixelRatio || 1);
      const fit = () => { const r = wrap.getBoundingClientRect(); c.width = Math.max(200, r.width * dpr); c.height = Math.max(200, r.height * dpr); c.style.width = r.width + 'px'; c.style.height = r.height + 'px'; };
      fit();
      const P = st.P; const V = { cx: P.x, cz: P.z, s: 0.45 }; // s = px per metre (css px)
      const toS = (x, z) => [(x - V.cx) * V.s * dpr + c.width / 2, -(z - V.cz) * V.s * dpr + c.height / 2];
      const toW = (sx, sy) => [(sx * dpr - c.width / 2) / (V.s * dpr) + V.cx, -(sy * dpr - c.height / 2) / (V.s * dpr) + V.cz];
      let route = null; const reroute = () => { const d = st.getDest(); route = d ? st.route(P.x, P.z, d.x, d.z) : null; };
      reroute();
      const clampV = () => { // GTA-style: the map always fills the view (no void past the edge)
        const mx0 = base.img ? base.x0 : base.bounds.mnx - 20 / base.S, mz1 = base.img ? base.ztop : base.bounds.mxz + 20 / base.S;
        const mw = base.canvas.width / base.S, mh = base.canvas.height / base.S, vw = c.width / dpr, vh = c.height / dpr;
        V.s = Math.max(V.s, vw / mw, vh / mh); const hw = vw / 2 / V.s, hh = vh / 2 / V.s;
        V.cx = Math.min(Math.max(V.cx, mx0 + hw), mx0 + mw - hw); V.cz = Math.min(Math.max(V.cz, mz1 - mh + hh), mz1 - hh); };
      const draw = () => {
        clampV(); const W = c.width, H = c.height; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1a1a1e'; g.fillRect(0, 0, W, H);
        const k = V.s * dpr / base.S; const [ox, oy] = toS(base.img ? base.x0 : base.bounds.mnx, base.img ? base.ztop : base.bounds.mxz);
        g.imageSmoothingEnabled = true; if (base.img && base.proc) { const pb = base.proc, kp = V.s * dpr / pb.S, [px0, py0] = toS(pb.bounds.mnx, pb.bounds.mxz); g.globalAlpha = 0.85; g.drawImage(pb.canvas, px0 - 20 * kp, py0 - 20 * kp, pb.canvas.width * kp, pb.canvas.height * kp); g.globalAlpha = 1; } if (base.img) g.drawImage(base.canvas, ox, oy, base.canvas.width * k, base.canvas.height * k); else g.drawImage(base.canvas, ox - 20 * k, oy - 20 * k, base.canvas.width * k, base.canvas.height * k);
        g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1; const step = 250; const [wx0, wz1] = toW(0, 0), [wx1, wz0] = toW(W / dpr, H / dpr);
        for (let x = Math.ceil(wx0 / step) * step; x < wx1; x += step) { const [a] = toS(x, 0); g.beginPath(); g.moveTo(a, 0); g.lineTo(a, H); g.stroke(); }
        for (let z = Math.ceil(wz0 / step) * step; z < wz1; z += step) { const [, b] = toS(0, z); g.beginPath(); g.moveTo(0, b); g.lineTo(W, b); g.stroke(); }
        const u = dpr; g.lineJoin = g.lineCap = 'round';
        if (route && route.length > 1) { const path = () => { g.beginPath(); route.forEach((p, i) => { const [x, y] = toS(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); }; g.strokeStyle = '#000'; g.lineWidth = 9 * u; path(); g.stroke(); g.strokeStyle = '#ff2a3c'; g.lineWidth = 5 * u; path(); g.stroke(); }
        const B = app.blips || {};
        if (FIL.stops) for (const b of B.stops || []) { const [x, y] = toS(b.x, b.z); const r = 7 * u; g.fillStyle = '#fff'; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.fillStyle = '#000'; g.font = `800 ${9 * u}px Unbounded, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('B', x, y + u); }
        if (FIL.posters) for (const b of B.posters || []) { const [x, y] = toS(b.x, b.z); const r = 5 * u; g.fillStyle = b.done ? '#777' : '#ff2a3c'; g.strokeStyle = '#fff'; g.lineWidth = 1.5 * u; g.fillRect(x - r * 0.7, y - r, r * 1.4, r * 2); g.strokeRect(x - r * 0.7, y - r, r * 1.4, r * 2); }
        if (FIL.collectibles) for (const b of B.collectibles || []) { const [x, y] = toS(b.x, b.z); g.fillStyle = '#ffd400'; g.beginPath(); g.arc(x, y, 4 * u, 0, 7); g.fill(); }
        if (FIL.venues) for (const v of VENUES) { const [x, y] = toS(v.x, v.z); const r = 13 * u; g.fillStyle = v.inSlice ? '#fff' : '#000'; g.strokeStyle = '#fff'; g.lineWidth = 3 * u; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
          g.fillStyle = v.inSlice ? '#000' : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${13 * u}px Unbounded, sans-serif`; g.fillText(v.pin, x, y + u);
          if (V.s > 0.18) { g.textAlign = 'left'; g.font = `800 ${11 * u}px Unbounded, sans-serif`; g.lineWidth = 4 * u; g.strokeStyle = '#000'; g.strokeText(v.name, x + r + 6 * u, y - 4 * u); g.fillStyle = '#fff'; g.fillText(v.name, x + r + 6 * u, y - 4 * u);
            g.font = `600 ${9 * u}px "DM Sans", sans-serif`; const sub = v.inSlice || v.nostalgia ? v.sub : v.sub + ' · COMING SOON'; g.strokeText(sub, x + r + 6 * u, y + 9 * u); g.fillStyle = '#ccc'; g.fillText(sub, x + r + 6 * u, y + 9 * u); } }
        const d = st.getDest(); if (d) { const [x, y] = toS(d.x, d.z); const r = 10 * u; g.fillStyle = '#ff2a3c'; g.strokeStyle = '#fff'; g.lineWidth = 2.5 * u; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill(); g.stroke(); }
        { const [x, y] = toS(P.x, P.z); g.save(); g.translate(x, y); g.rotate(P.heading); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2.5 * u; g.beginPath(); g.moveTo(0, -13 * u); g.lineTo(9 * u, 10 * u); g.lineTo(0, 5 * u); g.lineTo(-9 * u, 10 * u); g.closePath(); g.fill(); g.stroke(); g.restore(); }
        // scale bar
        { const m = V.s > 1 ? 50 : V.s > 0.3 ? 200 : 500; const px = m * V.s * u; g.fillStyle = '#fff'; g.fillRect(16 * u, H - 22 * u, px, 3 * u); g.font = `700 ${9 * u}px Unbounded, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(m + ' M', 16 * u, H - 28 * u); }
        const dd = overlay.querySelector('#pmdest'); if (dd) dd.innerHTML = d ? `<b>${d.label}</b><span>${Math.round(Math.hypot(d.x - P.x, d.z - P.z))} M ${route ? 'BY ROAD' : '· NO ROUTE'}</span>` : '<span>NONE · TAP THE MAP OR PICK A VENUE</span>';
      };
      const clampS = (v) => Math.max(0.08, Math.min(4, v));
      const zoomAt = (f, sx, sy) => { const [wx, wz] = toW(sx, sy); V.s = clampS(V.s * f); const [nx, nz] = toW(sx, sy); V.cx += wx - nx; V.cz += wz - nz; draw(); };
      const pts = new Map(); let moved = 0, pinch0 = null;
      c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.offsetX, e.offsetY]); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: V.s }; } });
      c.addEventListener('pointermove', (e) => { const q = pts.get(e.pointerId); if (!q) return; const dx = e.offsetX - q[0], dy = e.offsetY - q[1]; pts.set(e.pointerId, [e.offsetX, e.offsetY]);
        if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()]; const dd = Math.hypot(a[0] - b[0], a[1] - b[1]); const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; zoomAt(clampS(pinch0.s * dd / Math.max(1, pinch0.d)) / V.s, mx, my); moved += 99; return; }
        moved += Math.abs(dx) + Math.abs(dy); V.cx -= dx / V.s; V.cz += dy / V.s; draw(); });
      const up = (e) => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null;
        if (moved < 6 && pts.size === 0) { const [x, z] = toW(e.offsetX, e.offsetY); st.setDest({ x, z, label: 'WAYPOINT', kind: 'waypoint' }); reroute(); draw(); } };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); pinch0 = null; });
      c.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY); }, { passive: false });
      overlay.querySelectorAll('.pmzoom button').forEach(b => b.onclick = () => { if (b.dataset.z === 'me') { V.cx = P.x; V.cz = P.z; draw(); } else { const r = c.getBoundingClientRect(); zoomAt(Number(b.dataset.z), r.width / 2, r.height / 2); } });
      overlay.querySelectorAll('.pmv').forEach(b => b.onclick = () => { const v = (st.venues || []).find(q => q.id === b.dataset.v); if (!v) return; st.setDest({ x: v.x, z: v.z, label: v.name, kind: 'venue', id: v.id }); reroute(); V.cx = v.x; V.cz = v.z; V.s = Math.max(V.s, 0.6); overlay.querySelectorAll('.pmv').forEach(q => q.classList.toggle('sel', q === b)); draw(); });
      overlay.querySelectorAll('.pmleg input').forEach(i => i.onchange = () => { api.setFilter(i.dataset.f, i.checked); draw(); });
      overlay.querySelector('#pmclear').onclick = () => { st.setDest(null); reroute(); draw(); };
      api._mapResize = () => { if (!overlay.querySelector('#bigmap')) return removeEventListener('resize', api._mapResize); fit(); draw(); }; addEventListener('resize', api._mapResize);
      draw(); api._mapDraw = draw;
    },
    openWardrobe(C, st) { // C = crew module, st = { fit, xp|null, account, apply(fit), signIn(email), signOut(), email, setEmail }
      const lvl = C.playerLevel(st.xp);
      const rows = [...C.WARDROBE].sort((a, b) => a.level - b.level).map(p => { const locked = p.level > lvl, on = !locked && st.fit[p.slot] === p.id;
        return `<button class="cw ${on ? 'sel' : ''} ${locked ? 'lock' : ''}" data-id="${p.id}" ${locked ? 'disabled' : ''}><img src="${C.iconFor(p.id)}" onerror="this.onerror=null;this.src='${C.iconFallback(p.id)}'" alt="${p.name}" loading="lazy"/><span><b>${p.name}</b><small>${p.slot.toUpperCase()} · ${locked ? 'LOCKED · UNLOCKS AT LVL ' + p.level : 'LVL ' + p.level}</small></span></button>`; }).join('');
      const acct = st.account ? `<p class="fine">SIGNED IN AS ${st.account.email.toUpperCase()} · ${st.xp == null ? 'CREW NOT LOADED' : 'LVL ' + lvl + ' · FIT FROM THE APP'} <button id="crewOut">SIGN OUT</button></p>`
        : `<h3>SIGN IN <small>(SAME CREW ACCOUNT AS THE APP · LOADS YOUR EQUIPPED FIT)</small></h3><div class="row"><input id="email" type="email" placeholder="you@example.com" value="${st.email || ''}"/><button id="crewIn">SIGN IN</button></div>`;
      open(`<h2>WARDROBE</h2><p class="sub">CLOTHING DROP 018 · ${st.account ? 'YOUR CREW FIT · LVL ' + lvl : 'SIGNED OUT · LVL 1 PIECES ONLY · SIGN IN TO WEAR WHAT YOUR CREW RANK UNLOCKS'}</p>
      <div class="crewfig"><img id="crewLook" alt="CREW AVATAR"/></div>
      <h3>CREW BASE <small>${st.baseFromApp ? '(SET IN THE APP FOR YOUR ACCOUNT)' : '(SAME WARDROBE ON BOTH)'}</small></h3><div class="basesel">${['male', 'female'].map(b => `<button data-b="${b}" class="${st.base === b ? 'sel' : ''}"${st.baseFromApp ? ' disabled' : ''}>${b.toUpperCase()}</button>`).join('')}</div>
      <div class="cwlist">${rows}</div>${acct}
      <p class="fine">CREW GAME RULES (SET BY RECKLESS CREW, AWARDED BY THE CREW SERVER, NEVER BY THE GAME): DIGITAL RAVE ${C.CREW_RULES.GAME.rave.xp} XP FOR A 10-MIN STAY, MAX ${C.CREW_RULES.GAME.rave.max_per_london_day}/DAY AND ${C.CREW_RULES.GAME.rave.max_per_iso_week}/WEEK · POSTER ${C.CREW_RULES.GAME.poster.xp} XP ONCE PER SPOT, MAX ${C.CREW_RULES.GAME.poster.max_per_london_day}/DAY · CAP ${C.CREW_RULES.GAME.weekly_cap_xp} XP/WEEK.${C.CREW_RULES.status === 'proposed' ? ' (PROPOSED RULES, NOT LIVE YET)' : ''}</p><p class="fine">NO XP OR CODES ARE AWARDED IN THE GAME. CHANGES HERE STAY ON THIS DEVICE AND NEVER WRITE TO YOUR CREW. VISITS ARE QUEUED AS TEST EVENTS ONLY.</p>`, 'wardov');
      overlay.querySelectorAll('.cw').forEach(b => b.onclick = () => { const p = C.gearById(b.dataset.id); st.fit = C.toggle(st.fit, p); st.apply(st.fit);
        overlay.querySelectorAll('.cw').forEach(x => x.classList.toggle('sel', st.fit[C.gearById(x.dataset.id).slot] === x.dataset.id));
        look(); });
      let lk = 0; const look = () => { const n = ++lk; C.composeLook(st.base, st.fit).then(u => { const im = overlay.querySelector('#crewLook'); if (im && n === lk && u) im.src = u; }); }; look();
      const bi = overlay.querySelector('#crewIn'); if (bi) bi.onclick = async () => { const e = overlay.querySelector('#email').value.trim().toLowerCase(); st.setEmail(e); bi.textContent = '…'; try { await st.signIn(e); } catch (err) { api.toast('THAT EMAIL DOES NOT LOOK RIGHT'); bi.textContent = 'SIGN IN'; } };
      const bo = overlay.querySelector('#crewOut'); if (bo) bo.onclick = () => st.signOut();
      overlay.querySelectorAll('.basesel button').forEach(b => b.onclick = () => { if (st.baseFromApp || !st.setBase) return; st.base = b.dataset.b; st.setBase(st.base); overlay.querySelectorAll('.basesel button').forEach(x => x.classList.toggle('sel', x.dataset.b === st.base)); look(); });
    },
    // first launch: pick the crew base (MALE / FEMALE); remembered, changeable from the phone's WARDROBE
    chooseBase(onPick, C, fit) {
      open(`<h2>WHO ARE YOU?</h2><p class="sub">PICK YOUR CREW BASE · SAME WARDROBE, CHANGE IT ANY TIME IN THE PHONE'S WARDROBE</p>
      <div class="basesel big"><button data-b="male"><img class="bpimg" data-b="male" alt=""/>MALE</button><button data-b="female"><img class="bpimg" data-b="female" alt=""/>FEMALE</button></div>`, 'basepick');
      if (C) overlay.querySelectorAll('.bpimg').forEach(im => C.composeLook(im.dataset.b, fit || C.DEFAULT_FIT).then(u => { if (u) im.src = u; }));
      const c = overlay.querySelector('.close'); if (c) c.remove();
      overlay.querySelectorAll('.basesel button').forEach(b => b.onclick = () => { close(); onPick(b.dataset.b); });
    },
    openCredits(extra) {
      open(`<h2>CREDITS</h2>
      <p><b>MAP DATA</b> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>, available under the Open Database Licence (ODbL 1.0). Roads and building footprints fetched via the Overpass API, 18 Nov 2026. Building heights are from Belfast City LIDAR 2006 and OSM tags where present, otherwise estimated.</p>
      <p><b>LIDAR</b> Belfast City LIDAR is provided by the Department for Infrastructure (Rivers) with the permission of the copyright owner, Cyient Europe Limited, and licensed under the Open Government Licence v3.0.</p>
      <p><b>OPEN DATA</b> Contains DfI Roads street lighting and crossing data, Belfast City Council trees data and Translink route data, all under the Open Government Licence v3.0 via OpenDataNI.</p>
      <p><b>ANIMATION</b> Quaternius Universal Animation Library (CC0), retargeted to the Reckless avatar. Traffic cars from the Kenney Car Kit (CC0, kenney.nl), re-coloured per car. Other CC0 assets: Kenney, Quaternius, Poly Haven, ambientCG.</p>
      <p><b>SKY &amp; SOUND</b> Night reflections from the Poly Haven HDRI “Cobblestone Street Night” (CC0). Night sky, city ambience and the fallback 140 BPM beat are generated in the browser (original, no samples). Shop names are invented.</p>
      <p><b>MUSIC</b> Tracks by Reckless Raves / DOUBLE R RECORDS, streamed from <a href="https://soundcloud.com/recklessraves" target="_blank" rel="noopener">soundcloud.com/recklessraves</a> via the official SoundCloud Widget API. All rights remain with the artists and SoundCloud; nothing is downloaded or re-hosted. Press K for the next track.</p>
      <p><b>ENGINE</b> Babylon.js (Apache-2.0) · earcut (ISC) · Vite (MIT)</p>
      <p><b>FONTS</b> Unbounded and DM Sans (SIL Open Font License, via Fontsource)</p>
      <p><b>CHARACTER</b> Clay avatar built for Reckless Raves from the canonical Crew avatar art. Outfits approximate RCKLS Clothing Drop 018.</p>
      <p><b>THE TEMPLE</b> Interior modelled from Reckless Raves reference photos.</p>
      <p><b>VEHICLES</b> Patrol vehicles are fictional. No real police force, wordmark, emblem or manufacturer badge is depicted.</p>
      <p class="fine">CONTROLS: WASD / ARROWS MOVE · SHIFT RUN · DRAG TO LOOK · WHEEL ZOOM · E INTERACT · F DANCE · M MAP · O WARDROBE · P PHOTO · L TEMPLE LIGHTS · N SOUND · K NEXT TRACK</p>
      <div class="row">${extra || ''}</div>`);
    },
    open,
  };
  hud.querySelectorAll('.btns button').forEach(b => b.onclick = (e) => { e.stopPropagation(); app.key(b.dataset.k); });
  return api;
}
