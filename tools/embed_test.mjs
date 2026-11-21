// Embed / app contract test -> /tmp/rwx/emb_*.png. Needs `npm run preview` (:4173) and the host page server:
//   python3 -m http.server 8090 -d tools/embed_test   (cross-origin parent, like recklessraves.co.uk)
import puppeteer from 'puppeteer-core';
const TOK = 'tok_APPtest.123-xyz';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const log = (...a) => console.log(...a);
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
async function mk(vp, mob, meStatus) {
  const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); // fresh storage per case await page.setViewport({ ...vp, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob }); if (mob) await page.setUserAgent(UA);
  const leaks = []; page.on('console', m => { if (m.text().includes(TOK)) leaks.push('console'); }); page.on('pageerror', e => log('PE', e.message));
  page.on('request', r => { if (r.url().includes(TOK) && !r.isNavigationRequest()) leaks.push('url ' + r.url().slice(0, 80)); }); // the test's own navigation URL carries the fragment; browsers never send it
  await page.evaluateOnNewDocument(() => { localStorage.setItem('rw.avatarBase', 'male'); });
  if (meStatus) { await page.setRequestInterception(true); page.on('request', r => { if (r.url().includes('/api/auth/me') && r.method() === 'OPTIONS') return r.respond({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization', 'Access-Control-Allow-Methods': 'GET' } });
    if (r.url().includes('/api/auth/me')) { const ok = (r.headers().authorization || '') === 'Bearer ' + TOK;
    return r.respond({ status: ok ? meStatus : 401, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization' }, body: JSON.stringify(ok && meStatus === 200 ? { email: 'luke.test@example.com' } : { error: meStatus === 426 ? 'UPDATE_APP' : 'SESSION' }) }); } r.continue(); }); }
  return { page, leaks };
}
const frameOf = async (page) => { const h = await page.waitForSelector('iframe'); return h.contentFrame(); };
const readyF = (f) => f.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 240000 });
// ---- iframe on the mock Squarespace page: portrait + landscape (touch), desktop (mouse/keyboard)
for (const [tag, vp, mob] of [['port', { width: 393, height: 851 }, true], ['land', { width: 851, height: 393 }, true], ['desk', { width: 1280, height: 800 }, false]]) {
  const { page } = await mk(vp, mob); await page.goto('http://localhost:8090/index.html', { waitUntil: 'load' });
  await page.screenshot({ path: `/tmp/rwx/emb_${tag}_1_page.png`, fullPage: false });
  await page.evaluate(() => document.getElementById('frame').scrollIntoView({ block: 'start' }));
  const f = await frameOf(page); await readyF(f); await sleep(1500);
  log(tag, 'in frame', JSON.stringify(await f.evaluate(() => ({ embed: window.__rw.embed, fs: !!document.getElementById('fsBtn'), fsTxt: (document.getElementById('fsBtn') || {}).innerText }))));
  await page.screenshot({ path: `/tmp/rwx/emb_${tag}_2_frame_title.png` });
  const fr = await (await page.$('iframe')).boundingBox();
  if (mob) await page.touchscreen.tap(fr.x + fr.width / 2, fr.y + fr.height * 0.6); else await page.mouse.click(fr.x + fr.width / 2, fr.y + fr.height * 0.6);
  await sleep(6000); log(tag, 'started', await f.evaluate(() => !window.__rw.app.title));
  if (mob) { const j = await f.evaluate(() => { const r = document.getElementById('tJump').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await page.touchscreen.tap(fr.x + j[0], fr.y + j[1]); await sleep(150); log(tag, 'touch jump airborne', await f.evaluate(() => window.__rw.P.air || window.__rw.P.y > 0.01));
    const sY0 = await page.evaluate(() => scrollY); const y0 = await f.evaluate(() => window.__rw.C.yaw); const sx = fr.x + fr.width * 0.8, sy = fr.y + fr.height * 0.45;
    const cdp = await page.target().createCDPSession(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx - i * 12, y: sy }] }); await sleep(60); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); log(tag, 'touch look yaw changed', Math.abs((await f.evaluate(() => window.__rw.C.yaw)) - y0) > 0.05);
    log(tag, 'host page scroll after touch drag (was ' + sY0 + ')', await page.evaluate(() => scrollY));
  } else { const y0 = await f.evaluate(() => window.__rw.C.yaw); await page.mouse.move(fr.x + 500, fr.y + 300); await page.mouse.down(); await page.mouse.move(fr.x + 400, fr.y + 300, { steps: 6 }); await page.mouse.up();
    log(tag, 'mouse drag look', Math.abs((await f.evaluate(() => window.__rw.C.yaw)) - y0) > 0.05);
    const p0 = await f.evaluate(() => [window.__rw.P.x, window.__rw.P.z]); await page.keyboard.down('w'); await sleep(3000); await page.keyboard.up('w'); const p1 = await f.evaluate(() => [window.__rw.P.x, window.__rw.P.z]);
    log(tag, 'keyboard moves in frame', Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(2) + ' m');
    const sY = await page.evaluate(() => scrollY); await page.mouse.move(fr.x + 400, fr.y + 300); await page.mouse.wheel({ deltaY: 300 }); await sleep(300); log(tag, 'wheel scrolls host page', (await page.evaluate(() => scrollY)) !== sY);
    await page.mouse.move(fr.x + 400, fr.y + 300); }
  await page.screenshot({ path: `/tmp/rwx/emb_${tag}_3_frame_game.png` });
  const fsb = await f.$('#fsBtn'); if (fsb) { const b = await fsb.boundingBox(); if (mob) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); else await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await sleep(1500);
    log(tag, 'fullscreen', await f.evaluate(() => !!(document.fullscreenElement || document.webkitFullscreenElement)), 'how', await f.evaluate(() => window.__rwFs || null), 'pages', (await page.browserContext().pages()).length); await page.screenshot({ path: `/tmp/rwx/emb_${tag}_4_fullscreen.png` }); }
  await page.close();
}
// ---- app contract: ?app=1#token= (200), 426 UPDATE_APP, and no fragment
for (const [tag, st, hash] of [['app_ok', 200, '#token=' + TOK], ['app_426', 426, '#token=' + TOK], ['app_none', 200, '']]) {
  const { page, leaks } = await mk({ width: 393, height: 851 }, true, st);
  await page.goto('http://localhost:4173/?webgl&app=1' + hash, { waitUntil: 'load' }); await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 240000 }); await sleep(1500);
  log(tag, JSON.stringify(await page.evaluate(() => { const a = JSON.parse(localStorage.getItem('rw.crewAccount') || 'null'); const vis = (id) => { const e = document.getElementById(id) || document.querySelector(id); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
    return { url: location.href, hash: location.hash, histLen: history.length, acct: a && { via: a.via, email: a.email, tokLen: a.token.length }, embed: window.__rw.embed, safeLnk: vis('safeLnk'), fsBtn: vis('fsBtn'), tickets: vis('.live a'), brandLeft: document.querySelector('.brand').getBoundingClientRect().left }; })));
  await page.screenshot({ path: `/tmp/rwx/emb_${tag}_1_title.png` });
  await page.touchscreen.tap(196, 600); await sleep(7000);
  log(tag, 'after start', JSON.stringify(await page.evaluate(() => { const p = document.querySelector('.overlay:not(.hidden) .panel'); const pr = document.getElementById('pinrow'); return { overlay: p ? p.querySelector('h2') && p.querySelector('h2').innerText : null, pinVisible: !!pr && !pr.classList.contains('hidden'), brandLeft: document.querySelector('.brand').getBoundingClientRect().left }; })));
  await page.screenshot({ path: `/tmp/rwx/emb_${tag}_2_game.png` });
  log(tag, 'token leaks', JSON.stringify(leaks)); await page.close();
}
await browser.close();
