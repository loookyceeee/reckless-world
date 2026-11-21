// Sign-in UI test with mocked auth (426 -> PIN field -> token). Never hits the live auth route; logs any crew event call (should be none: flag off).
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('PE', e.message));
await page.setRequestInterception(true);
const J = (rq, status, o) => rq.respond({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });
page.on('request', rq => { const u = rq.url();
  if (u.includes('/api/auth/request')) { if (rq.method() === 'OPTIONS') return rq.respond({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } }); const b = JSON.parse(rq.postData() || '{}'); return b.pin ? J(rq, 200, { ok: true, email: b.email, token: 'tok_test' }) : J(rq, 426, { ok: false, error: 'UPDATE_APP' }); }
  if (u.includes('/api/auth/me')) return J(rq, 200, { ok: true });
  if (u.includes('/api/crew/events')) console.log('EVENTCALL', u);
  rq.continue(); });
await page.evaluateOnNewDocument(() => { localStorage.setItem('rw.avatarBase', 'male'); localStorage.setItem('rw.introSeen', '1'); });
await page.goto('http://localhost:4173/?webgl', { waitUntil: 'load' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 180000 });
await page.click('#play').catch(() => {});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
await sleep(1500); await page.keyboard.press('o'); await sleep(1500);
console.log('email?', !!(await page.$('#email')));
await page.type('#email', 'luke.test@example.com'); await page.click('#crewIn'); await sleep(1500);
console.log('pinrow visible', await page.$eval('#pinrow', e => !e.classList.contains('hidden')));
await page.screenshot({ path: '/tmp/kk/signin_pin.png' });
await page.type('#pin', '1234'); await page.click('#crewIn'); await sleep(3000);
console.log('acct', await page.evaluate(() => localStorage.getItem('rw.crewAccount')));
await page.screenshot({ path: '/tmp/kk/signin_done.png' });
await page.keyboard.press('Escape'); await page.evaluate(() => window.__rw.enterTemple()); await sleep(1500); await page.evaluate(() => window.__rw.exitTemple()); await sleep(1500);
console.log('done'); await browser.close();
