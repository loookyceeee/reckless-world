// In-game crew phone (menu hub) + GTA-style action wheel. research/game-design.md 1.5 / 1.6, mockups 03-phone / 04-action-wheel.
// The phone is a black slate with typographic tiles; every app routes to an existing system via ctx callbacks.
const TILES = [
  ['map', 'MAP', '◻'], ['rave', 'RAVE', '◎'], ['posters', 'POSTERS', '▣'],
  ['radio', 'RADIO', '♪'], ['camera', 'CAMERA', '▢'], ['wardrobe', 'WARDROBE', '▤'],
  ['crew', 'CREW', '◆'], ['settings', 'SETTINGS', '⚙'], ['msgs', 'MSGS', '●'], ['cards', 'CARDS', '▮'], ['dance', 'DANCE', '♫'],
];
const WHEEL = [ // clockwise from north
  ['phone', 'PHONE', 'OPEN THE CREW PHONE'], ['radio', 'RADIO', 'NOW PLAYING · SKIP'], ['camera', 'CAMERA', 'PHOTO MODE'], ['dance', 'DANCE', 'TOGGLE DANCE'],
  ['poster', 'POSTER', 'PASTE IF A WALL IS IN RANGE'], ['cab', 'HAIL CAB', 'BLACK CAB TO ANY VENUE · FREE'], ['wardrobe', 'WARDROBE', 'CHANGE YOUR FIT'], ['map', 'MAP', 'PAUSE MAP'],
];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
export const haptics = { on: localStorage.getItem('rw.haptics') !== '0' };
export const buzz = (p) => { if (!haptics.on) return; try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } }; // Android Chrome; silent no-op on iOS

export function createPhone(ctx) {
  // ctx: { root, open: {map, wardrobe, camera, credits, crew}, dance(), poster(), sound:{label(), toggle()}, quality:{get(), set(n)},
  //        radio(): {title, link, playing, failed}, skip(), rave(): {inside, venue, dwell, need}, posters(): [{name,done,x,z}],
  //        setDest(d), messages: [] }
  const el = document.createElement('div'); el.className = 'phone hidden'; ctx.root.appendChild(el);
  const veil = document.createElement('div'); veil.className = 'phveil hidden'; ctx.root.appendChild(veil);
  const msgs = []; let unread = 0, view = 'home';
  const S = { open: false };
  const frame = (title, body) => `<div class="phs"><b>RECKLESS</b><span>${clock()}</span><i>●●●●</i></div>
    ${title ? `<div class="phh"><button class="phback" data-v="home">‹</button><b>${title}</b></div>` : ''}<div class="phb">${body}</div><button class="phclose" data-act="close" aria-label="Close phone"><i></i></button>`;
  const views = {
    home: () => frame('', `<div class="phgrid">${TILES.map(([id, n, ic]) => `<button class="pht" data-app="${id}"><i>${ic}</i><span>${n}</span>${id === 'msgs' && unread ? `<em>${unread}</em>` : ''}</button>`).join('')}</div>
      ${msgs[0] ? `<button class="phpeek" data-app="msgs"><small>${esc(msgs[0].from)} · ${esc(msgs[0].t)}</small><b>${esc(msgs[0].title)}</b><span>${esc(msgs[0].body)}</span></button>` : ''}`),
    rave: () => { const r = ctx.rave(); const pct = Math.min(100, Math.round((r.dwell || 0) / (r.need || 600) * 100));
      return frame('RAVE', `<div class="phcard"><small>TONIGHT</small><b>${esc(r.venue || 'THE TEMPLE')}</b><span>${r.inside ? 'You are inside.' : 'Doors open. Follow the red line to the door.'}</span></div>
      <div class="phcard"><small>10 MIN TO LOG A VISIT</small><div class="phbar"><i style="width:${r.inside ? pct : 0}%"></i></div><span>${r.inside ? `${Math.floor((r.dwell || 0) / 60)} / 10 MIN` : 'Timer starts when you walk in.'}</span></div>
      ${r.inside ? `<div class="phrowb"><button class="phbtn" data-act="lights">LIGHTS: ${r.lights === 'day' ? 'DAY' : 'RAVE'}</button></div>` : '<button class="phbtn" data-act="gpsTemple">SET GPS · THE TEMPLE</button>'}
      ${r.inside ? '' : `<div class="phlist">${(r.venues || []).map(v => `<button class="phrow" data-act="gps:${v.id}"><span>${esc(v.name)}<small style="display:block;opacity:.6;font-size:9px">${esc(v.sub || '')}</small></span><i>GPS ›</i></button>`).join('')}</div>`}
      ${ctx.missions ? (ctx.missions.active() === 'fd' ? '<button class="phbtn on" data-act="fdCancel">CANCEL FLYER DROP</button>' : '<button class="phbtn" data-act="fdStart">START FLYER DELIVERY</button>') : ''}<p class="phfine">Visits are test events until launch. The game never awards XP.</p>`); },
    posters: () => { const P = ctx.posters(); const d = P.filter(p => p.done).length;
      return frame('POSTERS', `<div class="phcard"><small>WALLS TODAY</small><b>${d} / ${P.length}</b><span>Paste a fresh poster at each spot. Watch for patrols.</span></div>
      ${ctx.missions ? (ctx.missions.active() === 'pr' ? '<button class="phbtn on" data-act="prCancel">CANCEL POSTER RUN</button>' : '<button class="phbtn" data-act="prStart">START POSTER RUN · HEAT RISK</button>') : ''}
      <div class="phlist">${P.map((p, i) => `<button class="phrow" data-poster="${i}"><span>${esc(p.name)}</span><i>${p.done ? 'DONE' : 'GO ›'}</i></button>`).join('')}</div>`); },
    radio: () => { const r = ctx.radio();
      return frame('RADIO', `<div class="phcard"><small>RECKLESS FM · NOW PLAYING</small><b>${esc(r.playing && r.title ? r.title.toUpperCase() : (r.failed ? 'RECKLESS BEAT (OFFLINE)' : 'TURN THE SOUND ON'))}</b><span>Reckless Raves on SoundCloud</span></div>
      <div class="phrowb"><button class="phbtn" data-act="sound">${esc(ctx.sound.label())}</button><button class="phbtn" data-act="skip">SKIP ›</button></div>
      <a class="phlink" href="${esc(r.link)}" target="_blank" rel="noopener">OPEN ON SOUNDCLOUD ↗</a>`); },
    crew: () => frame('CREW', `<div class="phlook"><img data-look="1" alt="YOUR CREW LOOK"/></div><div class="phcard"><small>CREW</small><b>${esc(ctx.crew().rank)}</b><span>${esc(ctx.crew().line)}</span></div>
      <button class="phbtn" data-act="crewOpen">SIGN IN / WARDROBE</button><p class="phfine">XP IS AWARDED BY CREW LOYALTY, NOT BY THIS GAME.</p>`),
    settings: () => { const q = ctx.quality.get();
      return frame('SETTINGS', `<div class="phcard"><small>QUALITY</small><div class="phrowb">${['low', 'med', 'high'].map(n => `<button class="phbtn${q === n ? ' on' : ''}" data-q="${n}">${n.toUpperCase()}</button>`).join('')}</div></div>
      <div class="phrowb"><button class="phbtn" data-act="sound">${esc(ctx.sound.label())}</button><button class="phbtn" data-act="credits">CREDITS</button></div>
      <div class="phcard"><small>LOOK SENSITIVITY</small><div class="phrowb"><button class="phbtn" data-act="sensDn">−</button><b class="phval">${ctx.sens ? ctx.sens.get().toFixed(2) + '×' : ''}</b><button class="phbtn" data-act="sensUp">+</button></div><div class="phbar"><i style="width:${ctx.sens ? (ctx.sens.get() - 0.5) / 1.5 * 100 : 0}%"></i></div></div>
      <div class="phrowb"><button class="phbtn${haptics.on ? ' on' : ''}" data-act="haptics">HAPTICS ${haptics.on ? 'ON' : 'OFF'}</button></div>
      <p class="phfine">Map data © OpenStreetMap contributors. Terrain: LiDAR open data. Full credits in CREDITS.</p>`); },
    camera: () => { const H = ctx.hunt ? ctx.hunt() : []; const n = H.filter(h => h.done).length;
      return frame('CAMERA', `<div class="phcard"><small>PHOTO HUNT</small><b>${n} / ${H.length}</b><span>Frame a landmark in the middle of the viewfinder, clear line of sight, and shoot.</span></div>
      <div class="phrowb"><button class="phbtn" data-act="vf">OPEN VIEWFINDER</button><button class="phbtn" data-act="snap">PHOTO CARD</button></div>
      <div class="phshots">${H.map(h => `<div style="${h.thumb ? `background-image:url(${h.thumb})` : ''}">${esc(h.name)}${h.done ? ' ✓' : ''}</div>`).join('')}</div>
      <div class="phlist">${H.filter(h => !h.done).map(h => `<button class="phrow" data-act="huntgps:${h.id}"><span>${esc(h.name)}</span><i>GPS ›</i></button>`).join('')}</div><p class="phfine">Photo hunt awards nothing. Shots stay on this device.</p>`); },
    cards: () => { const C = ctx.cards ? ctx.cards() : []; const n = C.filter(c => c.got).length;
      return frame('CARDS', `<div class="phcard"><small>CREW CARDS</small><b>${n} / ${C.length || 20}</b><span>Hidden in venue porches, on poster walls and behind bus stops. Listen for the ping.</span></div>
      <div class="phcards">${C.map(c => c.got ? `<div class="pcd"><img data-card="${c.i}" alt="${esc(c.name)}"/></div>` : `<div class="pcd">${String(c.i + 1).padStart(2, '0')}</div>`).join('')}</div><p class="phfine">Cards are collectibles only. They never award XP.</p>`); },
    dance: () => frame('DANCE', `<div class="phcard"><small>RHYTHM · 140 BPM</small><b>BEST ${ctx.danceBest ? ctx.danceBest() : 0} / 1000</b><span>Stand on any venue dancefloor and press E (or F) to dance. Keys A S W D or arrows, d-pad, or the four pads.</span></div>
      <p class="phfine">MISS · OK · CLEAN · RECKLESS. Grades stay on this device and award nothing.</p>`),
    msgs: () => frame('MSGS', msgs.length ? `<div class="phlist">${msgs.map((m, i) => `<button class="phmsg" data-msg="${i}"><small>${esc(m.from)} · ${esc(m.t)}</small><b>${esc(m.title)}</b><span>${esc(m.body)}</span>${m.act ? '<i>TAP TO START ›</i>' : m.dest ? '<i>TAP TO SET GPS ›</i>' : ''}</button>`).join('')}</div>` : '<p class="phfine">No messages.</p>'),
  };
  let lastHtml = '';
  const render = () => { const h = (views[view] || views.home)(); if (h === lastHtml) return; lastHtml = h; el.innerHTML = h; if (view === 'crew' && ctx.crewLook) { const im = el.querySelector('img[data-look]'); ctx.crewLook().then(u => { if (u && im.isConnected) im.src = u; }); } if (view === 'cards' && ctx.cardArt) el.querySelectorAll('img[data-card]').forEach(im => { im.src = ctx.cardArt(+im.dataset.card); }); }; // only touch the DOM on change, so taps aren't lost
  const go = (v) => {
    if (v === 'map') { api.close(); return ctx.open.map(); }
    if (v === 'wardrobe') { api.close(); return ctx.open.wardrobe(); }
    if (v === 'msgs') { unread = 0; ctx.onUnread && ctx.onUnread(0); }
    view = v; render();
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.app) return go(b.dataset.app);
    if (b.dataset.v) return go(b.dataset.v);
    if (b.dataset.q) { ctx.quality.set(b.dataset.q); return render(); }
    if (b.dataset.poster != null) { const p = ctx.posters()[+b.dataset.poster]; if (p && !p.done) { ctx.setDest({ x: p.x, z: p.z, label: 'POSTER · ' + p.name, kind: 'waypoint' }); api.close(); } return; }
    if (b.dataset.msg != null) { const m = msgs[+b.dataset.msg]; if (m && m.act) { api.close(); m.act(); m.act = null; return; } if (m && m.dest) { ctx.setDest(m.dest); api.close(); } return; }
    const a = b.dataset.act;
    if (a === 'close') return api.close();
    if (a === 'vf') { api.close(); return ctx.open.viewfinder && ctx.open.viewfinder(); }
    if (a === 'snap') { api.close(); return ctx.open.camera(); }
    if (a && a.startsWith('huntgps:')) { const h = (ctx.hunt() || []).find(x => x.id === a.slice(8)); if (h) { ctx.setDest({ x: h.x, z: h.z, label: 'PHOTO · ' + h.name, kind: 'waypoint' }); api.close(); } return; }
    if (a === 'prStart') { api.close(); return ctx.missions.startPosterRun(); }
    if (a === 'prCancel') { ctx.missions.cancel('pr'); return render(); }
    if (a === 'fdStart') { api.close(); return ctx.missions.startFlyers(); }
    if (a === 'fdCancel') { ctx.missions.cancel('fd'); return render(); }
    if (a === 'sensDn' || a === 'sensUp') { ctx.sens.set(Math.max(0.5, Math.min(2, Math.round((ctx.sens.get() + (a === 'sensUp' ? 0.25 : -0.25)) * 100) / 100))); return render(); }
    if (a === 'haptics') { haptics.on = !haptics.on; localStorage.setItem('rw.haptics', haptics.on ? '1' : '0'); buzz(10); return render(); }
    if (a === 'sound') { ctx.sound.toggle(); return setTimeout(render, 50); }
    if (a === 'skip') { ctx.skip(); return setTimeout(render, 600); }
    if (a === 'credits') { api.close(); return ctx.open.credits(); }
    if (ctx.onAct && ctx.onAct(a, api)) return render();
    if (a === 'crewOpen') { api.close(); return ctx.open.wardrobe(); }
    if (a === 'gpsTemple') { ctx.setDest(null, 'temple'); api.close(); } else if (a && a.startsWith('gps:')) { ctx.setDest(null, a.slice(4)); api.close(); }
  });
  veil.addEventListener('click', () => api.close());
  let tick = null;
  const api = {
    ctx,
    get isOpen() { return S.open; },
    open(v = 'home') { view = v; render(); S.open = true; el.classList.remove('hidden', 'out'); veil.classList.remove('hidden'); requestAnimationFrame(() => el.classList.add('on'));
      clearInterval(tick); tick = setInterval(() => { if (S.open && (view === 'rave' || view === 'home' || view === 'radio')) render(); }, 1000); },
    close() { if (!S.open) return; S.open = false; clearInterval(tick); el.classList.remove('on'); el.classList.add('out'); veil.classList.add('hidden'); setTimeout(() => { if (!S.open) el.classList.add('hidden'); }, 180); },
    toggle() { S.open ? api.close() : api.open(); },
    text(m) { msgs.unshift({ from: 'RECKLESS', t: clock(), ...m }); unread++; ctx.onUnread && ctx.onUnread(unread); buzz([20, 40, 20]);
      if (S.open) return render();
      const pk = document.createElement('button'); pk.className = 'phpeekf'; pk.innerHTML = `<small>RECKLESS · ${clock()}</small><b>${esc(m.title)}</b><span>${esc(m.body)}</span>`;
      ctx.root.appendChild(pk); requestAnimationFrame(() => pk.classList.add('on')); pk.onclick = () => { pk.remove(); api.open('msgs'); unread = 0; ctx.onUnread && ctx.onUnread(0); };
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
  let open = false, sel = 0, last = 0, t0 = 0, cx = 0, cy = 0, lastAng = null, touchOpen = false;
  const setSel = (i) => { if (i === sel && el.querySelector('.ws.on')) return; sel = i; el.querySelectorAll('.ws').forEach((g, k) => g.classList.toggle('on', k === i)); el.querySelector('.wmid b').textContent = WHEEL[i][1]; el.querySelector('.wmid span').textContent = WHEEL[i][2]; buzz(10); };
  const pick = (x, y) => { const dx = x - cx, dy = y - cy; if (Math.hypot(dx, dy) < 24) return; let a = Math.atan2(dx, -dy); if (a < 0) a += 2 * Math.PI;
    const deg = a * 180 / Math.PI; if (lastAng != null) { const d = Math.abs(((deg - lastAng + 540) % 360) - 180); if (d < 8) return; } lastAng = deg; setSel(Math.round(a / (2 * Math.PI / N)) % N); };
  const move = (e) => { if (open) pick(e.clientX, e.clientY); };
  const api = {
    get isOpen() { return open; },
    open(touch = false) { if (open) return; open = true; touchOpen = touch; t0 = performance.now(); const r = el.getBoundingClientRect(); cx = innerWidth / 2; cy = innerHeight / 2; lastAng = null; setSel(last); el.classList.remove('hidden'); requestAnimationFrame(() => el.classList.add('on')); addEventListener('pointermove', move); },
    release(confirm = true) { if (!open) return; open = false; removeEventListener('pointermove', move); el.classList.remove('on'); setTimeout(() => !open && el.classList.add('hidden'), 90);
      const quick = t0 > 0 && performance.now() - t0 < 180 && lastAng == null && !touchOpen; const id = WHEEL[quick ? last : sel][0]; if (!quick) last = sel; if (confirm) ctx.run(id); },
    point(x, y) { if (open) pick(x, y); },
    select(id) { const i = WHEEL.findIndex(w => w[0] === id); if (i >= 0) setSel(i); },
  };
  // touch: hold the WHEEL button, drag to a slice, lift to confirm; or tap the button and then tap a slice (tap outside closes)
  addEventListener('pointerup', (e) => { if (open && e.pointerType !== 'mouse' && lastAng != null && performance.now() - t0 > 180) api.release(true); });
  let armed = false; el.addEventListener('pointerdown', () => { armed = open; });  // only taps that start on the wheel count (not the tap that opened it)
  el.addEventListener('click', (e) => { if (!open || !armed) return; armed = false; const g = e.target.closest('.ws'); if (g) { setSel(+g.dataset.i); t0 = 0; return api.release(true); }
    api.release(false); });
  return api;
}
