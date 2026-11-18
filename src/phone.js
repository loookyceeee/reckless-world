// In-game crew phone (menu hub) + GTA-style action wheel. research/game-design.md 1.5 / 1.6, mockups 03-phone / 04-action-wheel.
// The phone is a black slate with typographic tiles; every app routes to an existing system via ctx callbacks.
const TILES = [
  ['map', 'MAP', '◻'], ['rave', 'RAVE', '◎'], ['posters', 'POSTERS', '▣'],
  ['radio', 'RADIO', '♪'], ['camera', 'CAMERA', '▢'], ['wardrobe', 'WARDROBE', '▤'],
  ['crew', 'CREW', '◆'], ['settings', 'SETTINGS', '⚙'], ['msgs', 'MSGS', '●'],
];
const WHEEL = [ // clockwise from north
  ['phone', 'PHONE', 'OPEN THE CREW PHONE'], ['radio', 'RADIO', 'NOW PLAYING · SKIP'], ['camera', 'CAMERA', 'PHOTO MODE'], ['dance', 'DANCE', 'TOGGLE DANCE'],
  ['poster', 'POSTER', 'PASTE IF A WALL IS IN RANGE'], ['cab', 'HAIL CAB', 'COMING SOON'], ['wardrobe', 'WARDROBE', 'CHANGE YOUR FIT'], ['map', 'MAP', 'PAUSE MAP'],
];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } };

export function createPhone(ctx) {
  // ctx: { root, open: {map, wardrobe, camera, credits, crew}, dance(), poster(), sound:{label(), toggle()}, quality:{get(), set(n)},
  //        radio(): {title, link, playing, failed}, skip(), rave(): {inside, venue, dwell, need}, posters(): [{name,done,x,z}],
  //        setDest(d), messages: [] }
  const el = document.createElement('div'); el.className = 'phone hidden'; ctx.root.appendChild(el);
  const veil = document.createElement('div'); veil.className = 'phveil hidden'; ctx.root.appendChild(veil);
  const msgs = []; let unread = 0, view = 'home';
  const S = { open: false };
  const frame = (title, body) => `<div class="phs"><b>RECKLESS</b><span>${clock()}</span><i>●●●●</i></div>
    ${title ? `<div class="phh"><button class="phback" data-v="home">‹</button><b>${title}</b></div>` : ''}<div class="phb">${body}</div>`;
  const views = {
    home: () => frame('', `<div class="phgrid">${TILES.map(([id, n, ic]) => `<button class="pht" data-app="${id}"><i>${ic}</i><span>${n}</span>${id === 'msgs' && unread ? `<em>${unread}</em>` : ''}</button>`).join('')}</div>
      ${msgs[0] ? `<button class="phpeek" data-app="msgs"><small>${esc(msgs[0].from)} · ${esc(msgs[0].t)}</small><b>${esc(msgs[0].title)}</b><span>${esc(msgs[0].body)}</span></button>` : ''}`),
    rave: () => { const r = ctx.rave(); const pct = Math.min(100, Math.round((r.dwell || 0) / (r.need || 600) * 100));
      return frame('RAVE', `<div class="phcard"><small>TONIGHT</small><b>${esc(r.venue || 'THE TEMPLE')}</b><span>${r.inside ? 'You are inside.' : 'Doors open. Follow the red line to the door.'}</span></div>
      <div class="phcard"><small>10 MIN TO LOG A VISIT</small><div class="phbar"><i style="width:${r.inside ? pct : 0}%"></i></div><span>${r.inside ? `${Math.floor((r.dwell || 0) / 60)} / 10 MIN` : 'Timer starts when you walk in.'}</span></div>
      <button class="phbtn" data-act="gpsTemple">SET GPS · THE TEMPLE</button><p class="phfine">Visits are test events until launch. The game never awards XP.</p>`); },
    posters: () => { const P = ctx.posters(); const d = P.filter(p => p.done).length;
      return frame('POSTERS', `<div class="phcard"><small>WALLS TODAY</small><b>${d} / ${P.length}</b><span>Paste a fresh poster at each spot. Watch for patrols.</span></div>
      <div class="phlist">${P.map((p, i) => `<button class="phrow" data-poster="${i}"><span>${esc(p.name)}</span><i>${p.done ? 'DONE' : 'GO ›'}</i></button>`).join('')}</div>`); },
    radio: () => { const r = ctx.radio();
      return frame('RADIO', `<div class="phcard"><small>RECKLESS FM · NOW PLAYING</small><b>${esc(r.playing && r.title ? r.title.toUpperCase() : (r.failed ? 'RECKLESS BEAT (OFFLINE)' : 'TURN THE SOUND ON'))}</b><span>Reckless Raves on SoundCloud</span></div>
      <div class="phrowb"><button class="phbtn" data-act="sound">${esc(ctx.sound.label())}</button><button class="phbtn" data-act="skip">SKIP ›</button></div>
      <a class="phlink" href="${esc(r.link)}" target="_blank" rel="noopener">OPEN ON SOUNDCLOUD ↗</a>`); },
    crew: () => frame('CREW', `<div class="phcard"><small>CREW</small><b>${esc(ctx.crew().rank)}</b><span>${esc(ctx.crew().line)}</span></div>
      <button class="phbtn" data-act="crewOpen">SIGN IN / WARDROBE</button><p class="phfine">XP IS AWARDED BY CREW LOYALTY, NOT BY THIS GAME.</p>`),
    settings: () => { const q = ctx.quality.get();
      return frame('SETTINGS', `<div class="phcard"><small>QUALITY</small><div class="phrowb">${['low', 'med', 'high'].map(n => `<button class="phbtn${q === n ? ' on' : ''}" data-q="${n}">${n.toUpperCase()}</button>`).join('')}</div></div>
      <div class="phrowb"><button class="phbtn" data-act="sound">${esc(ctx.sound.label())}</button><button class="phbtn" data-act="credits">CREDITS</button></div>
      <p class="phfine">Map data © OpenStreetMap contributors. Terrain: LiDAR open data. Full credits in CREDITS.</p>`); },
    msgs: () => frame('MSGS', msgs.length ? `<div class="phlist">${msgs.map((m, i) => `<button class="phmsg" data-msg="${i}"><small>${esc(m.from)} · ${esc(m.t)}</small><b>${esc(m.title)}</b><span>${esc(m.body)}</span>${m.dest ? '<i>TAP TO SET GPS ›</i>' : ''}</button>`).join('')}</div>` : '<p class="phfine">No messages.</p>'),
  };
  const render = () => { el.innerHTML = (views[view] || views.home)(); };
  const go = (v) => {
    if (v === 'map') { api.close(); return ctx.open.map(); }
    if (v === 'camera') { api.close(); return ctx.open.camera(); }
    if (v === 'wardrobe') { api.close(); return ctx.open.wardrobe(); }
    if (v === 'msgs') unread = 0;
    view = v; render();
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.app) return go(b.dataset.app);
    if (b.dataset.v) return go(b.dataset.v);
    if (b.dataset.q) { ctx.quality.set(b.dataset.q); return render(); }
    if (b.dataset.poster != null) { const p = ctx.posters()[+b.dataset.poster]; if (p && !p.done) { ctx.setDest({ x: p.x, z: p.z, label: 'POSTER · ' + p.name, kind: 'waypoint' }); api.close(); } return; }
    if (b.dataset.msg != null) { const m = msgs[+b.dataset.msg]; if (m && m.dest) { ctx.setDest(m.dest); api.close(); } return; }
    const a = b.dataset.act;
    if (a === 'sound') { ctx.sound.toggle(); return setTimeout(render, 50); }
    if (a === 'skip') { ctx.skip(); return setTimeout(render, 600); }
    if (a === 'credits') { api.close(); return ctx.open.credits(); }
    if (a === 'crewOpen') { api.close(); return ctx.open.wardrobe(); }
    if (a === 'gpsTemple') { ctx.setDest(null, 'temple'); api.close(); }
  });
  veil.addEventListener('click', () => api.close());
  let tick = null;
  const api = {
    get isOpen() { return S.open; },
    open(v = 'home') { view = v; render(); S.open = true; el.classList.remove('hidden', 'out'); veil.classList.remove('hidden'); requestAnimationFrame(() => el.classList.add('on'));
      clearInterval(tick); tick = setInterval(() => { if (S.open && (view === 'rave' || view === 'home' || view === 'radio')) render(); }, 1000); },
    close() { if (!S.open) return; S.open = false; clearInterval(tick); el.classList.remove('on'); el.classList.add('out'); veil.classList.add('hidden'); setTimeout(() => { if (!S.open) el.classList.add('hidden'); }, 180); },
    toggle() { S.open ? api.close() : api.open(); },
    text(m) { msgs.unshift({ from: 'RECKLESS', t: clock(), ...m }); unread++; buzz([20, 40, 20]);
      if (S.open) return render();
      const pk = document.createElement('button'); pk.className = 'phpeekf'; pk.innerHTML = `<small>RECKLESS · ${clock()}</small><b>${esc(m.title)}</b><span>${esc(m.body)}</span>`;
      ctx.root.appendChild(pk); requestAnimationFrame(() => pk.classList.add('on')); pk.onclick = () => { pk.remove(); api.open('msgs'); unread = 0; };
      setTimeout(() => { pk.classList.remove('on'); setTimeout(() => pk.remove(), 300); }, 4500); },
  };
  return api;
}

export function createWheel(ctx) {
  // ctx: { root, run(id) } — hold Q (desktop) / long-press WHEEL (touch); release to confirm; tap Q repeats the last verb
  const el = document.createElement('div'); el.className = 'wheel hidden';
  const N = WHEEL.length, R = 210, r0 = 76;
  const seg = (i) => { const a0 = (i - 0.5) * 2 * Math.PI / N - Math.PI / 2, a1 = (i + 0.5) * 2 * Math.PI / N - Math.PI / 2, P = (a, r) => `${(R + r * Math.cos(a)).toFixed(1)},${(R + r * Math.sin(a)).toFixed(1)}`;
    return `M${P(a0, r0)} L${P(a0, R - 2)} A${R - 2},${R - 2} 0 0 1 ${P(a1, R - 2)} L${P(a1, r0)} A${r0},${r0} 0 0 0 ${P(a0, r0)} Z`; };
  el.innerHTML = `<svg viewBox="0 0 ${2 * R} ${2 * R}">${WHEEL.map(([id, n], i) => { const a = i * 2 * Math.PI / N - Math.PI / 2, rr = (R + r0) / 2;
    return `<g class="ws" data-i="${i}"><path d="${seg(i)}"/><text x="${(R + rr * Math.cos(a)).toFixed(1)}" y="${(R + rr * Math.sin(a) + 4).toFixed(1)}">${n}</text></g>`; }).join('')}
    <circle cx="${R}" cy="${R}" r="${r0 - 6}" class="wc"/></svg><div class="wmid"><b></b><span></span></div>`;
  ctx.root.appendChild(el);
  let open = false, sel = 0, last = 0, t0 = 0, cx = 0, cy = 0, lastAng = null;
  const setSel = (i) => { if (i === sel && el.querySelector('.ws.on')) return; sel = i; el.querySelectorAll('.ws').forEach((g, k) => g.classList.toggle('on', k === i)); el.querySelector('.wmid b').textContent = WHEEL[i][1]; el.querySelector('.wmid span').textContent = WHEEL[i][2]; buzz(8); };
  const pick = (x, y) => { const dx = x - cx, dy = y - cy; if (Math.hypot(dx, dy) < 24) return; let a = Math.atan2(dx, -dy); if (a < 0) a += 2 * Math.PI;
    const deg = a * 180 / Math.PI; if (lastAng != null) { const d = Math.abs(((deg - lastAng + 540) % 360) - 180); if (d < 8) return; } lastAng = deg; setSel(Math.round(a / (2 * Math.PI / N)) % N); };
  const move = (e) => { if (open) pick(e.clientX, e.clientY); };
  const api = {
    get isOpen() { return open; },
    open() { if (open) return; open = true; t0 = performance.now(); const r = el.getBoundingClientRect(); cx = innerWidth / 2; cy = innerHeight / 2; lastAng = null; setSel(last); el.classList.remove('hidden'); requestAnimationFrame(() => el.classList.add('on')); addEventListener('pointermove', move); },
    release(confirm = true) { if (!open) return; open = false; removeEventListener('pointermove', move); el.classList.remove('on'); setTimeout(() => !open && el.classList.add('hidden'), 90);
      const quick = performance.now() - t0 < 180; const id = WHEEL[quick ? last : sel][0]; if (!quick) last = sel; if (confirm) ctx.run(id); },
    point(x, y) { if (open) pick(x, y); },
    select(id) { const i = WHEEL.findIndex(w => w[0] === id); if (i >= 0) setSel(i); },
  };
  el.addEventListener('pointerup', (e) => { if (open && e.pointerType !== 'mouse') api.release(true); });
  return api;
}
