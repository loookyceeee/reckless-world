// Fast headless check: load, stop the render loop, run JS steps, render frames manually and save the canvas (no HUD).
// S="js ;; frames:30 ;; snap:name" node tools/snap.mjs   -> /tmp/rwx/name.png
import puppeteer from 'puppeteer-core'; import fs from 'fs';
const W = +(process.env.W || 1024), H = +(process.env.H || 576);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
page.on('pageerror', e => console.log('PE', e.message)); page.on('console', m => { if (m.type() === 'error') console.log('CE', m.text().slice(0, 200)); });
await page.goto('http://localhost:4173/?webgl' + (process.env.Q || ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 180000 });
await page.evaluate(() => { const e = __rw.scene.getEngine(); e.stopRenderLoop(); __rw.fixedDt = 1 / 30; __rw.app.title = false; const t = document.getElementById('title'); if (t) t.style.display = 'none'; });
if (process.env.WAITAV) await page.waitForFunction(() => window.__rw.player && window.__rw.player.isGlb, { timeout: 120000 }).catch(() => console.log('no glb'));
for (const st of (process.env.S || '').split(' ;; ')) {
  if (!st) continue;
  if (st === 'ready') { for (let i = 0; i < 120; i++) { const ok = await page.evaluate(() => { __rw.scene.render(); return __rw.scene.meshes.filter(m => m.isEnabled() && m.isVisible && (m.getTotalVertices() > 0)).every(m => m.isReady(true)); }); if (ok) break; await new Promise(r => setTimeout(r, 500)); } }
  else if (st.startsWith('frames:')) await page.evaluate((n) => { for (let i = 0; i < n; i++) __rw.scene.render(); }, +st.slice(7));
  else if (st.startsWith('shot:')) { await page.evaluate(() => __rw.scene.render()); await page.screenshot({ path: '/tmp/rwx/' + st.slice(5) + '.png' }); console.log('shot', st.slice(5)); }
  else if (st.startsWith('snap:')) { const d = await page.evaluate(() => { __rw.scene.render(); return document.getElementById('c').toDataURL('image/png'); }); fs.writeFileSync('/tmp/rwx/' + st.slice(5) + '.png', Buffer.from(d.split(',')[1], 'base64')); console.log('snap', st.slice(5)); }
  else { const r = await page.evaluate(st).catch(e => 'ERR ' + e.message); if (r !== undefined) console.log(JSON.stringify(r)); }
}
await browser.close();
