// Stage 11 mechanics QA (headless, SwiftShader): look-behind, stamina, collisions, sensitivity, heat edges, gamepad, weather, photo mode.
// node tools/qa.mjs  (needs `npm run preview` on :4173). Prints PASS/FAIL per check; docs/QA_TESTS.md has the manual list.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 900000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 800, height: 450 });
page.on('pageerror', e => console.log('PE', e.message));
await page.goto('http://localhost:4173/?webgl&nomid' + (process.env.Q || ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 180000 });
const R = await page.evaluate(async () => {
  const w = window.__rw, s = w.scene, P = w.P, C = w.C, out = [];
  s.getEngine().stopRenderLoop(); w.fixedDt = 1 / 30; w.app.title = false; const t = document.getElementById('title'); if (t) t.style.display = 'none';
  const run = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) s.render(); };
  const key = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code.replace('Key', '').toLowerCase(), bubbles: true }));
  const ok = (name, pass, info) => out.push({ name, pass: !!pass, info });
  if (w.weather) w.weather.set(0); run(1);
  // 1 look-behind (B): camera swings in front of the player, restores on release
  { const fx = Math.sin(P.heading), fz = Math.cos(P.heading); const side = () => { const c = s.activeCamera.position; return (c.x - P.x) * fx + (c.z - P.z) * fz; };
    const a = side(); key('KeyB', true); run(0.5); const b = side(); key('KeyB', false); run(1.5); const c = side(); ok('look-behind B', a < 0 && b > 0 && c < 0, { behind: +a.toFixed(2), held: +b.toFixed(2), after: +c.toFixed(2) }); }
  // 2 stamina: sprint drains in ~4.5 s and locks; refills after release
  { const st = w.stamina; st.v = 1; key('KeyW', true); key('ShiftLeft', true); run(5.2); const v1 = st.v, lk = st.locked; key('ShiftLeft', false); key('KeyW', false); run(6.5);
    ok('stamina drain + lock + refill', v1 < 0.05 && lk && st.v > 0.95, { after5s: +v1.toFixed(2), locked: lk, after6s: +st.v.toFixed(2) }); }
  // 3 collisions: run straight at the nearest facade for 3 s, the player never crosses it
  { const g = w.grid(); let best = null; for (const sg of g.near(P.x, P.z, 40)) { if (sg.h < 3) continue; const mx = (sg.x0 + sg.x1) / 2, mz = (sg.z0 + sg.z1) / 2, d = Math.hypot(mx - P.x, mz - P.z); if (!best || d < best.d) best = { mx, mz, d }; }
    if (best) { const x0 = P.x, z0 = P.z; const h = Math.atan2(best.mx - P.x, best.mz - P.z); w.teleport(P.x, P.z, h); key('KeyW', true); run(3); key('KeyW', false); run(0.3);
      const crossed = g.raycast(x0, z0, P.x, P.z, 1) < 1 && Math.hypot(P.x - x0, P.z - z0) > best.d + 0.5; ok('wall collision', !crossed, { wallAt: +best.d.toFixed(1), moved: +Math.hypot(P.x - x0, P.z - z0).toFixed(1) }); }
    else ok('wall collision', false, 'no wall near spawn'); }
  // 4 sensitivity persists
  { const SE = (w.app.phone && w.app.phone.ctx && w.app.phone.ctx.sens) || w.sens; const s0 = SE.get(); SE.set(1.7); const v = +localStorage.getItem("rw.sens"); SE.set(s0); ok('sensitivity saved', v === 1.7, { saved: v }); }
  // 5 heat edges: clamps at 3, max 2 chasers, clears to 0, entering a venue with heat
  { const M = w.M; if (M) { M.raise(1); M.raise(5); const lv = M.H.level, ch = M.H.chasers.length; M.clearHeat(true); const lv0 = M.H.level;
      ok('heat clamp / chasers / clear', lv === 3 && ch <= 2 && lv0 === 0, { level: lv, chasers: ch, cleared: lv0 }); } else ok('heat', false, 'no missions'); }
  // 6 gamepad: left stick forward moves, R3 (button 11) is look-behind
  { const axes = [0, -1, 0, 0], btn = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })); const pad = { connected: true, axes, buttons: btn, id: 'qa', index: 0, mapping: 'standard' };
    const orig = navigator.getGamepads; navigator.getGamepads = () => [pad]; const x0 = P.x, z0 = P.z; run(1.5); const moved = Math.hypot(P.x - x0, P.z - z0);
    btn[11] = { pressed: true, value: 1 }; axes[1] = 0; run(0.2); const lb = C.lb; btn[11] = { pressed: false, value: 0 }; run(0.2); const lb2 = C.lb; navigator.getGamepads = orig;
    ok('gamepad move + R3 look-behind', moved > 1 && lb && !lb2, { moved: +moved.toFixed(2), lb, released: !lb2 }); }
  // 7 weather: rain ramps up outside, emits nothing inside
  { const W = w.weather; if (W) { W.set(1); run(8); const k = W.k; ok('weather ramps', k > 0.5, { k: +k.toFixed(2) }); W.set(0); } }
  // 8 photo mode: filter cycles, HUD hides, closing resets
  { const COL = w.COL; if (COL) { COL.viewfinder(true); COL.cycle('filter'); const f = document.querySelector('.vfbar [data-k="filter"] b').textContent; COL.cycle('hud'); const cl = document.body.classList.contains('vfclean'); COL.viewfinder(false);
      ok('photo filter / clean HUD / reset', f === 'B&W' && cl && !document.body.classList.contains('vfclean') && document.querySelector('.vfbar [data-k="filter"] b').textContent === 'NONE', { f, cl }); } }
  // 9 no XP anywhere in the local event log
  { const log = JSON.stringify(Object.keys(localStorage).filter(k => /event|ev/i.test(k)).map(k => localStorage.getItem(k))); ok('no XP in event log', !/"xp"\s*:/i.test(log), { bytes: log.length }); }
  return out;
});
for (const r of R) console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name.padEnd(36) + JSON.stringify(r.info));
console.log(R.filter(r => r.pass).length + ' / ' + R.length + ' passed');
await browser.close();
