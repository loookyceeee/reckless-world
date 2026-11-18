import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,720'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
page.on('console', m => console.log('C', m.type(), m.text().slice(0, 300))); page.on('pageerror', e => console.log('PE', e.message)); page.on('error', e => console.log('CRASH', e.message));
const t0 = Date.now();
await page.goto('http://localhost:4173/' + (process.argv[2] || ''), { waitUntil: 'load' });
for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 3000)); const r = await page.evaluate(() => ({ ready: window.__rw && window.__rw.ready, kind: window.__rw && window.__rw.kind, l: document.getElementById('loading').textContent })).catch(e => ({ err: e.message })); console.log((Date.now() - t0) / 1000, JSON.stringify(r)); if (r.ready || r.err) break; }
await page.screenshot({ path: '/tmp/diag.png' }).catch(e => console.log(e.message));
await browser.close();
