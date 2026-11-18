import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
page.on('pageerror', e => console.log('PE', e.message));
await page.goto('http://localhost:4173/?webgl', { waitUntil: 'load' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 120000 });
await page.tap('#play');
await new Promise(r => setTimeout(r, 2500));
// drag the joystick forward with touch
const cdp = await page.target().createCDPSession();
const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const before = await page.evaluate(() => [window.__rw.P.x, window.__rw.P.z]);
await tp('touchStart', 90, 600); for (let i = 0; i < 6; i++) { await tp('touchMove', 90, 600 - i * 10); await new Promise(r => setTimeout(r, 100)); }
await new Promise(r => setTimeout(r, 3000));
await page.screenshot({ path: '/workspace/reckless-world/shots/14-mobile-touch.png' });
await tp('touchEnd');
const after = await page.evaluate(() => [window.__rw.P.x, window.__rw.P.z, window.__rw.low, window.__rw.stats()]);
console.log('moved', JSON.stringify(before), JSON.stringify(after));
await browser.close();
