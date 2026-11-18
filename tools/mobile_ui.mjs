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
const shot = async (n) => { await page.screenshot({ path: '/tmp/rwx/' + n + (process.env.VW ? '_' + process.env.VW : '') + '.png' }); console.log('shot', n); };
await shot('mob_hud');
// overlap audit: every touch control vs minimap / each other / viewport edges
console.log('layout', JSON.stringify(await page.evaluate(() => { const r = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
  const ids = ['#tAct', '#tRun', '#tJump', '#tPhone', '#tWheel', '.mapwrap', '.btns', '.topright', '.brand']; const o = {}; for (const q of ids) o[q] = r(q);
  const ov = []; const k = ids.filter(q => o[q] && o[q][2] > o[q][0]); for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = o[k[i]], b = o[k[j]]; if (a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]) ov.push(k[i] + 'x' + k[j]); }
  return { o, overlaps: ov, vw: innerWidth, vh: innerHeight }; })));
// jump button
await page.tap('#tJump'); await W(120); console.log('jump airborne:', await page.evaluate(() => [__rw.P.air, +__rw.P.y.toFixed(2)])); await W(900);
// long-press ACTION -> wheel
{ const cdp0 = await page.target().createCDPSession(); const b = await page.evaluate(() => { const r = document.getElementById('tAct').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await cdp0.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b[0], y: b[1], id: 5 }] }); await W(700);
  console.log('long-press ACTION opens wheel:', await page.evaluate(() => __rw.wheel.isOpen)); await shot('mob_longpress_wheel');
  await cdp0.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await W(300);
  if (await page.evaluate(() => __rw.wheel.isOpen)) await page.evaluate(() => __rw.wheel.release(false)); await W(200); }

await page.tap('#tPhone'); await W(600);
const box = await page.evaluate(() => { const r = document.querySelector('.phone').getBoundingClientRect(); return [r.x, r.y, r.width, r.height, getComputedStyle(document.querySelector('.phone')).opacity]; }); console.log('phone rect', JSON.stringify(box));
await shot('mob_phone');
await page.tap('.pht[data-app=rave]'); await W(400); await shot('mob_rave');
await page.tap('.phback'); await W(200); await page.tap('.pht[data-app=msgs]'); await W(300); await shot('mob_msgs');
await page.tap('.phclose'); await W(400);
console.log('phone open after close:', await page.evaluate(() => __rw.phone.isOpen));
// wheel: tap the button (sticky), tap a slice
console.log('tWheel', await page.evaluate(() => { const b = document.getElementById('tWheel'), r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return [r.x, r.y, r.width, e && (e.id || e.className)]; }));
await page.tap('#tWheel'); await W(300);
console.log('wheel open:', await page.evaluate(() => __rw.wheel.isOpen)); await shot('mob_wheel');
const before = await page.evaluate(() => __rw.P.dancing);
{ const p = await page.evaluate(() => { const r = document.querySelector('.ws[data-i="3"] path').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }); await page.touchscreen.tap(p[0], p[1]); } await W(300);
console.log('wheel closed:', !(await page.evaluate(() => __rw.wheel.isOpen)), 'dance toggled:', before !== (await page.evaluate(() => __rw.P.dancing)));
// hold + drag + lift
const cdp = await page.target().createCDPSession(); const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 2 }] });
const b = await page.evaluate(() => { const r = document.getElementById('tWheel').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
await tp('touchStart', b[0], b[1]); await W(250);
for (let i = 1; i <= 8; i++) { await tp('touchMove', b[0] - (b[0] - 195) * i / 8, b[1] - (b[1] - 300) * i / 8); await W(40); } // toward north-ish of centre (422)
await W(200); const sel = await page.evaluate(() => document.querySelector('.wmid b').textContent); await shot('mob_wheel_drag');
await tp('touchEnd'); await W(500);
console.log('drag selected', sel, 'phone open:', await page.evaluate(() => __rw.phone.isOpen));
await shot('mob_after_drag');
await browser.close();
