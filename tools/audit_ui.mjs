// Audit: HUD/UI screenshots per viewport -> /tmp/rwx/ui_<tag>_*.png ; logs console errors + overlap checks
import puppeteer from 'puppeteer-core';
const [tag, W, H, mob] = [process.env.TAG || 'desk', +(process.env.W || 1280), +(process.env.H || 720), !!process.env.MOBILE];
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: W, height: H, deviceScaleFactor: mob ? 2 : 1, isMobile: mob, hasTouch: mob });
if (mob) await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36');
const errs = []; page.on('pageerror', e => errs.push('PE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CE ' + m.text().slice(0, 200)); });
page.on('request', r => { if (['PUT', 'PATCH', 'DELETE'].includes(r.method())) errs.push('WRITE ' + r.method() + ' ' + r.url()); if (r.method() === 'POST') errs.push('POST ' + r.url().slice(0, 120)); });
await page.evaluateOnNewDocument(() => { localStorage.setItem('rw.avatarBase', 'female'); });
const t0 = Date.now(); await page.goto('http://localhost:4173/' + (process.env.Q || ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 240000 }); console.log('ready', ((Date.now() - t0) / 1000).toFixed(1) + 's');
const sleep = (ms) => new Promise(r => setTimeout(r, ms)); const shot = async (n) => { await page.screenshot({ path: `/tmp/rwx/ui_${tag}_${n}.png` }); };
await sleep(1500); await shot('01_title');
await page.click('#play').catch(() => {}); await sleep(6000); await shot('02_hud');
// overlap check: visible fixed elements intersecting touch controls
const ov = () => page.evaluate(() => { const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 ? r : null; };
  const ctl = [...document.querySelectorAll('button, .stick, .joy, [class*=btn], [class*=touch]')].map(e => [e.id || e.className, vis(e)]).filter(a => a[1]);
  const txt = [...document.querySelectorAll('.note, .objective, .toast, .storyskip, #objective, .notes')].map(e => [e.id || e.className, vis(e)]).filter(a => a[1]);
  const hit = []; for (const [n, r] of txt) for (const [m, q] of ctl) if (r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top && !(n + '').includes(m)) hit.push(n + ' x ' + m);
  const offscreen = [...document.querySelectorAll('.hud *')].filter(e => { const r = vis(e); return r && (r.right > innerWidth + 2 || r.bottom > innerHeight + 2 || r.left < -2); }).map(e => e.id || e.className).slice(0, 8);
  return { hit: [...new Set(hit)].slice(0, 12), offscreen }; });
console.log('overlap hud', JSON.stringify(await ov()));
await page.evaluate(() => __rw.app.key('m')); await sleep(2000); await shot('03_map'); await page.evaluate(() => __rw.hud.close()); await sleep(500);
await page.evaluate(() => __rw.app.key('phone')); await sleep(1500); await shot('04_phone'); await page.evaluate(() => __rw.app.key('phone')); await sleep(500);
await page.evaluate(() => __rw.app.key('o')); await sleep(2000); await shot('05_wardrobe');
console.log('wardrobe overflow', await page.evaluate(() => { const p = document.querySelector('.overlay .panel'); if (!p) return 'none'; const r = p.getBoundingClientRect(); return JSON.stringify({ top: r.top | 0, bottom: r.bottom | 0, h: innerHeight, scroll: p.scrollHeight > p.clientHeight }); }));
await page.evaluate(() => __rw.hud.close()); await sleep(500);
await page.evaluate(() => __rw.app.key('c')); await sleep(1500); await shot('06_credits');
console.log('credits text', await page.evaluate(() => { const p = document.querySelector('.overlay .panel'); return p ? p.innerText.replace(/\s+/g, ' ').slice(0, 1800) : 'none'; }));
await page.evaluate(() => __rw.hud.close()); await sleep(500);
if (!mob) { await page.keyboard.down('KeyQ'); await sleep(1200); await shot('07_wheel'); await page.keyboard.up('KeyQ'); await sleep(500); }
await page.evaluate(() => __rw.enterTemple()); await sleep(7000); await shot('08_temple_entry');
console.log('overlap temple', JSON.stringify(await ov()));
await page.evaluate(() => __rw.exitTemple()); await sleep(5000);
await page.evaluate(() => __rw.enterClub('thompsons')); await sleep(7000); await shot('09_club_entry'); await page.evaluate(() => __rw.exitTemple()); await sleep(5000);
console.log('fps', await page.evaluate(() => __rw.scene.getEngine().getFps().toFixed(1)), 'tier', await page.evaluate(() => { try { return JSON.stringify(__rw.stats()); } catch (e) { return e.message; } }));
console.log('ERRS', JSON.stringify([...new Set(errs)].slice(0, 30)));
await browser.close();
