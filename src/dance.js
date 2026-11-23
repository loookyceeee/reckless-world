// Dance rhythm minigame (research/game-design.md item 11): E DANCE on a venue floor, ~36 s chart against the 140 BPM bed,
// four lanes (A/← · S/↓ · W/↑ · D/→, d-pad / face buttons, four touch pads to the right of the stick). Grades
// MISS / OK / CLEAN / RECKLESS, 0-1000 score, a letter on the stamp. Awards nothing: no XP, no codes, no events.
const LANES = ['←', '↓', '↑', '→'], KEYS = { KeyA: 0, ArrowLeft: 0, KeyS: 1, ArrowDown: 1, KeyW: 2, ArrowUp: 2, KeyD: 3, ArrowRight: 3 };
// quality pass 2026-11-23 (Luke: 'far too fast, virtually impossible'): three tiers, EASY by default. Old (now HARD): 2.2-beat
// highway (0.94 s on screen), 4-beat count-in, up to 6 notes a bar with 8ths, windows 45/90/140 ms (+60 ms late grace).
// The chart stays on the synth bed's real 140 BPM grid (AU.clock), so notes land on the kick whatever the tier.
const TIERS = {
  easy: { name: 'EASY', lead: 5, count: 8, win: { reckless: 0.075, clean: 0.14, ok: 0.21 }, grace: 0.09, pat: [[0], [0, 2], [0, 2], [0, 2], [0, 1, 2], [0, 2, 3], [0, 1, 2, 3], [0, 2, 3]], lvl: 3 },
  normal: { name: 'NORMAL', lead: 3.6, count: 8, win: { reckless: 0.06, clean: 0.115, ok: 0.18 }, grace: 0.08, pat: [[0, 2], [0, 1, 2, 3], [0, 2], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1.5, 2, 3], [0, 1, 2, 3], [0, 1, 2, 2.5, 3]], lvl: 2 },
  hard: { name: 'HARD', lead: 2.2, count: 4, win: { reckless: 0.045, clean: 0.09, ok: 0.14 }, grace: 0.06, pat: [[0, 1, 2, 3], [0, 2], [0, 1, 2, 3], [0, 1.5, 2, 3], [0, 0.5, 1, 2, 3], [0, 1, 1.5, 2, 3, 3.5], [0, 0.5, 1, 1.5, 2, 3], [0, 1, 2, 2.5, 3, 3.5]], lvl: 1 },
};
const TIER_IDS = ['easy', 'normal', 'hard'];
const tierNow = () => { try { const t = localStorage.getItem('rw.danceTier'); return TIERS[t] ? t : 'easy'; } catch (e) { return 'easy'; } };
const PTS = { reckless: 10, clean: 7, ok: 3, miss: 0 };
const BEAT = 60 / 140;
let WIN = TIERS.easy.win, LEAD = TIERS.easy.lead, GRACE = TIERS.easy.grace;
function chart(seed, T = TIERS.easy) { // count-in beats, then 16 bars; density rises through the song (slower ramp on easier tiers)
  let s = seed >>> 0 || 7; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const PAT = T.pat;
  const out = []; let last = -1;
  for (let bar = 0; bar < 16; bar++) { const lvl = Math.min(PAT.length - 1, Math.floor(bar / (T.lvl + 1)) + (R() < 0.3 ? 1 : 0)); const p = bar === 15 ? (T === TIERS.easy ? [0, 2] : [0, 1, 2]) : PAT[lvl];
    for (const b of p) { let lane = Math.floor(R() * 4); if (lane === last && R() < 0.7) lane = (lane + 1 + Math.floor(R() * 3)) % 4; last = lane; out.push({ b: T.count + bar * 4 + b, lane, g: null }); } }
  return out;
}
export function createDance({ hud, AU, MU, onPunch, isTouch }) {
  let st = null; const root = document.createElement('div'); root.className = 'dance'; root.innerHTML = `<div class="dhead"><small>DANCE · 140 BPM · <span class="dtier">EASY</span></small><b class="dsc">0</b><i class="dcb"></i></div><canvas width="360" height="300"></canvas><div class="dgr"></div><div class="dtiers">${TIER_IDS.map(i => `<button data-t="${i}">${TIERS[i].name}</button>`).join('')}</div><div class="dpads">${LANES.map((l, i) => `<button data-l="${i}">${l}</button>`).join('')}</div>`;
  (hud.hud || document.body).appendChild(root); const cv = root.querySelector('canvas'), cx = cv.getContext('2d'), gr = root.querySelector('.dgr'), sc = root.querySelector('.dsc'), cb = root.querySelector('.dcb');
  root.querySelectorAll('.dtiers button').forEach(b => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); api.setTier(b.dataset.t); }));
  root.querySelectorAll('.dpads button').forEach(b => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); hit(+b.dataset.l); }));
  let gameT = 0; const clock = () => { const a = (window.__rw && window.__rw.danceGameClock) ? null : (AU && AU.clock ? AU.clock() : null); return typeof a === 'number' ? a : gameT * 140 / 60; };
  const flash = (txt, cls) => { gr.textContent = txt; gr.className = 'dgr on ' + cls; clearTimeout(flash.t); flash.t = setTimeout(() => { gr.className = 'dgr'; }, 380); };
  function grade(n, g) { n.g = g; st.counts[g]++; st.score += PTS[g]; if (g === 'miss') { st.combo = 0; AU && AU.hit && AU.hit('miss'); } else { st.combo++; st.best = Math.max(st.best, st.combo); AU && AU.hit && AU.hit(g); if (g !== 'ok' && onPunch) onPunch(g === 'reckless' ? 1 : 0.6); }
    st.laneFx[n.lane] = { g, t: performance.now() }; flash(g.toUpperCase(), g); }
  function hit(lane) { if (!st) return false; const now = clock(); let best = null, bd = 1e9;
    for (const n of st.notes) { if (n.g || n.lane !== lane) continue; const d = Math.abs((now - (st.b0 + n.b)) * BEAT); if (d < bd) { bd = d; best = n; } if (st.b0 + n.b - now > 2) break; }
    st.press[lane] = performance.now();
    if (best && bd <= WIN.ok + GRACE) grade(best, bd <= WIN.reckless ? 'reckless' : bd <= WIN.clean ? 'clean' : bd <= WIN.ok ? 'ok' : 'miss');
    return true; }
  function draw(now) { const W = cv.width, H = cv.height, lw = W / 4, hy = H - 46; cx.clearRect(0, 0, W, H);
    for (let l = 0; l < 4; l++) { const x = l * lw; cx.fillStyle = l % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.09)'; cx.fillRect(x + 3, 0, lw - 6, H);
      const pr = st.press[l] && performance.now() - st.press[l] < 110; const fx = st.laneFx[l] && performance.now() - st.laneFx[l].t < 220 ? st.laneFx[l].g : null;
      cx.strokeStyle = fx === 'reckless' ? '#ff2a3c' : fx === 'clean' ? '#fff' : pr ? '#bbb' : 'rgba(255,255,255,0.55)'; cx.lineWidth = fx ? 6 : 3; cx.beginPath(); cx.arc(x + lw / 2, hy, 24, 0, 7); cx.stroke();
      cx.fillStyle = 'rgba(255,255,255,0.6)'; cx.font = '800 20px Unbounded, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(LANES[l], x + lw / 2, hy + 1); }
    // beat lines
    for (let k = Math.ceil(now); k < now + LEAD; k++) { const y = hy - (k - now) / LEAD * hy; cx.fillStyle = k % 4 === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'; cx.fillRect(0, y, W, k % 4 === 0 ? 2 : 1); }
    for (const n of st.notes) { const db = st.b0 + n.b - now; if (db > LEAD) break; if (n.g && n.g !== 'miss') continue; if (db < -0.6) continue; const y = hy - db / LEAD * hy, x = n.lane * lw + lw / 2;
      cx.globalAlpha = n.g === 'miss' ? 0.3 : 1; cx.fillStyle = n.lane === 0 || n.lane === 3 ? '#ff2a3c' : '#ffffff'; cx.beginPath(); cx.arc(x, y, 19, 0, 7); cx.fill(); cx.fillStyle = n.lane === 0 || n.lane === 3 ? '#fff' : '#000'; cx.font = '800 18px Unbounded, sans-serif'; cx.fillText(LANES[n.lane], x, y + 1); cx.globalAlpha = 1; }
    if (now < st.b0 + st.T.count) { const c = Math.ceil(st.b0 + st.T.count - now); cx.fillStyle = '#fff'; cx.font = '900 64px Unbounded, sans-serif'; cx.fillText(c > 4 ? '' : String(c), W / 2, H / 2 - 30);
      if (c > 4) { cx.font = '900 26px Unbounded, sans-serif'; cx.fillText('GET READY', W / 2, H / 2 - 40); cx.font = '800 13px Unbounded, sans-serif'; cx.fillStyle = 'rgba(255,255,255,0.75)'; cx.fillText((isTouch ? 'TAP ' : 'PRESS 1 / 2 / 3 · ') + st.T.name + ' · HIT ON THE KICK', W / 2, H / 2 - 8); } }
    { const pre = now < st.b0 + 2; if (pre !== st._pre) { st._pre = pre; root.classList.toggle('pre', pre); root.querySelectorAll('.dtiers button').forEach(x => x.classList.toggle('sel', x.dataset.t === st.tier)); } }
    sc.textContent = String(Math.round(st.score / st.max * 1000)); cb.textContent = st.combo > 3 ? st.combo + ' COMBO' : ''; }
  const api = {
    active: () => !!st,
    start({ venue = 'THE TEMPLE', t = 0, tier = null } = {}) { if (st) return; gameT = t; const tid = TIERS[tier] ? tier : tierNow(), T = TIERS[tid]; WIN = T.win; LEAD = T.lead; GRACE = T.grace;
      if (AU) { try { AU.unlock && AU.unlock(); } catch (e) { } AU.force = true; } // bed on BEFORE the radio pauses: no silent gap
      const now = clock(); const notes = chart(Math.floor(Date.now() / 86400000), T);
      st = { venue, tier: tid, T, b0: Math.ceil(now) + 1, notes, score: 0, max: notes.length * PTS.reckless, combo: 0, best: 0, counts: { reckless: 0, clean: 0, ok: 0, miss: 0 }, press: [], laneFx: [], wasMusic: !!(MU && MU.playing) };
      if (st.wasMusic) MU.pause(); root.querySelector('.dtier').textContent = T.name; root.classList.add('on'); document.body.classList.add('dancing'); hud.mtitle && hud.mtitle({ kicker: 'DANCE', title: venue }); },
    stop(done = false) { if (!st) return null; const s = st; st = null; root.classList.remove('on'); document.body.classList.remove('dancing'); if (AU) AU.force = false; if (s.wasMusic && MU) MU.start();
      const pts = Math.round(s.score / s.max * 1000), L = pts >= 900 ? 'S' : pts >= 780 ? 'A' : pts >= 620 ? 'B' : pts >= 450 ? 'C' : 'D';
      if (done) hud.stamp(pts >= 450 ? { title: L === 'S' ? 'RECKLESS' : 'GRADE ' + L, sub: 'DANCE · ' + s.venue, lines: [`SCORE ${pts} / 1000`, `RECKLESS ${s.counts.reckless} · CLEAN ${s.counts.clean} · OK ${s.counts.ok} · MISS ${s.counts.miss}`, `BEST COMBO ${s.best}`] }
        : { title: 'MOVE ON', sub: 'DANCE · ' + s.venue, lines: [`SCORE ${pts} / 1000`, 'THE FLOOR WILL BE HERE ALL NIGHT'], fail: true });
      try { const best = +localStorage.getItem('rw.danceBest') || 0; if (done && pts > best) localStorage.setItem('rw.danceBest', String(pts)); } catch (e) {}
      return { pts, L, ...s.counts, best: s.best }; },
    key(e) { if (!st) return false; if (e.code === 'Escape') { api.stop(false); return true; }   // E no longer quits mid-round (it sits next to W/↑)
      if (/^Digit[123]$/.test(e.code) && clock() < st.b0 + 2) { api.setTier(TIER_IDS[+e.code.slice(5) - 1]); return true; } const l = KEYS[e.code]; if (l === undefined) return e.code === 'Space'; if (!e.repeat) hit(l); return true; },
    pad(i) { return hit(i); },
    setTier(id) { if (!TIERS[id]) return; try { localStorage.setItem('rw.danceTier', id); } catch (e) { } if (st && clock() < st.b0 + 2) { const v = st.venue, wm = st.wasMusic; st = null; api._restart = true; api.start({ venue: v, t: gameT, tier: id }); if (st) st.wasMusic = wm; api._restart = false; } },
    tiers: () => TIER_IDS.map(i => ({ id: i, name: TIERS[i].name, lead_beats: TIERS[i].lead, lead_s: +(TIERS[i].lead * BEAT).toFixed(2), count_in: TIERS[i].count, win_ms: Object.fromEntries(Object.entries(TIERS[i].win).map(([k, v]) => [k, Math.round(v * 1000)])), late_grace_ms: Math.round(TIERS[i].grace * 1000) })),
    update(dt, t) { if (!st) return; gameT = t; if (AU && AU.pump) AU.pump(); const now = clock();
      for (const n of st.notes) { if (n.g) continue; if ((now - (st.b0 + n.b)) * BEAT > WIN.ok + GRACE) grade(n, 'miss'); else break; }
      draw(now); if (now > st.b0 + st.notes[st.notes.length - 1].b + 2) api.stop(true); },
    state: () => st, clock: () => clock(),
  };
  return api;
}
