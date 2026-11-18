// Load a URL headless, log failed requests / console errors / engine kind, screenshot title + after start.
import puppeteer from 'puppeteer-core';
const URL = process.env.URL || 'https://reckless-world.onrender.com/';
const args = ['--no-sandbox', '--ignore-gpu-blocklist', ...(process.env.ARGS || '--use-angle=swiftshader --enable-unsafe-swiftshader').split(' ').filter(Boolean)];
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args });
const page = await browser.newPage(); await page.setViewport({ width: +(process.env.W || 1280), height: +(process.env.H || 720), deviceScaleFactor: +(process.env.DPR || 1), isMobile: !!process.env.MOBILE, hasTouch: !!process.env.MOBILE });
if (process.env.UA) await page.setUserAgent(process.env.UA);
page.on('pageerror', e => console.log('PAGEERROR', e.message));
page.on('console', m => { if (['error', 'warn', 'warning'].includes(m.type())) console.log('CONSOLE', m.type(), m.text().slice(0, 300)); });
page.on('requestfailed', r => console.log('REQFAIL', r.url().slice(0, 160), r.failure() && r.failure().errorText));
page.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url().slice(0, 160)); });
const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable'); let bytes = 0; const big = []; const urls = {};
cdp.on('Network.responseReceived', e => { urls[e.requestId] = e.response.url; }); cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; if (e.encodedDataLength > 150000) big.push(((e.encodedDataLength / 1e6).toFixed(2)) + 'MB ' + (urls[e.requestId] || '').split('/').pop().slice(0, 60)); });
const t0 = Date.now(); await page.goto(URL, { waitUntil: 'load', timeout: 90000 });
const ok = await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 150000 }).then(() => true).catch(() => false);
console.log('ready', ok, ((Date.now() - t0) / 1000).toFixed(1) + 's', await page.evaluate(() => { const e = window.__rw && window.__rw.scene && window.__rw.scene.getEngine(); return e ? e.__kind + ' ' + (e.description || '') : 'no engine'; }).catch(e => e.message));
console.log('transferred to ready', (bytes / 1e6).toFixed(2) + ' MB', big.join(', '));
const tag = process.env.TAG || 'live';
await page.screenshot({ path: `/tmp/rwx/${tag}-title.png` });
if (ok) { await page.click('#play').catch(() => {}); await new Promise(r => setTimeout(r, +(process.env.WAIT || 5000))); await page.screenshot({ path: `/tmp/rwx/${tag}-play.png` });
  console.log('fps', await page.evaluate(() => window.__rw.scene.getEngine().getFps().toFixed(1))); }
await browser.close();
