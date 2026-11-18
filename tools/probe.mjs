import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('PE', e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warn') console.log('C', m.text().slice(0, 200)); });
await page.goto('http://localhost:4173/?webgl' + (process.env.Q || ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 120000 });
await page.click('#play');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// script: lines of JS evaluated in page; "shot:name" takes screenshot; "wait:ms"
const script = (process.env.S || '').split(' ;; ');
for (const st of script) {
  if (!st) continue;
  if (st.startsWith('shot:')) { await page.screenshot({ path: '/tmp/' + st.slice(5) + '.png' }); console.log('shot', st.slice(5)); }
  else if (st.startsWith('wait:')) await sleep(+st.slice(5));
  else { const r = await page.evaluate(st).catch(e => 'ERR ' + e.message); if (r !== undefined) console.log(JSON.stringify(r)); }
}
await browser.close();
