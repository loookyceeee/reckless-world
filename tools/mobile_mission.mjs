// Mobile (390x844, touch) check of the crew phone and the action wheel -> /tmp/rwx/mob_*.png
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.emulate({ viewport: { width: +(process.env.VW || 390), height: +(process.env.VH || 844), deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
page.on('pageerror', e => console.log('PE', e.message));
await page.goto('http://localhost:4173/?webgl', { waitUntil: 'load' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 180000 });
const W = (ms) => new Promise(r => setTimeout(r, ms));
await page.waitForSelector('#title.ready', { timeout: 60000 }).catch(() => {}); await W(500); await page.tap('#play'); await W(1500);
for (let i = 0; i < 5 && await page.evaluate(() => __rw.app.title); i++) { console.log('retry', await page.evaluate(() => { const e = document.elementFromPoint(195, 700); document.getElementById('play').click(); return [e && (e.id || e.className), __rw.app.title]; })); await W(1500); }
console.log('in game:', !(await page.evaluate(() => __rw.app.title))); await W(2500);
const shot = async (n) => { await page.screenshot({ path: '/tmp/rwx/' + n + '.png' }); console.log('shot', n); };
// Mobile poster-run check: phone POSTERS app START button, mission title, objective, heat pips and the WALLS DONE stamp at 390x844.
await page.evaluate(() => localStorage.removeItem('rw.pday'));
await page.evaluate(() => { __rw.app.key('phone'); }); await W(400);
await page.evaluate(() => document.querySelector('.pht[data-app=posters]').click()); await W(400); await shot('mm_posters_app');
const btn = await page.evaluate(() => { const b = document.querySelector('[data-act=prStart]'); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, b.textContent]; });
console.log('start btn', btn); if (btn) await page.touchscreen.tap(btn[0], btn[1]); await W(900); await shot('mm_title');
await W(2600); console.log('state', await page.evaluate(() => __rw.M.PR.state));
const paste = (i) => page.evaluate(async (i) => { const p = __rw.posters[i]; __rw.P.x = p.ix; __rw.P.z = p.iz; await new Promise(r => setTimeout(r, 400)); __rw.app.key('e'); await new Promise(r => setTimeout(r, 400)); return __rw.M.objective(); }, i);
console.log(await paste(0)); await page.evaluate(() => __rw.M.raise(1)); await W(1200); await shot('mm_heat');
await page.evaluate(() => __rw.M.clearHeat(true));
for (let i = 1; i < 5; i++) console.log(await paste(i)); await W(2400); await shot('mm_done');
await browser.close();
