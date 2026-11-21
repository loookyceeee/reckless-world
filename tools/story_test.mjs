// Story chain smoke test: tutorial steps, then the 6 missions via hooks/teleports; shots in /tmp/kk/story_*.png
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('PE', e.message));
await page.evaluateOnNewDocument(() => { localStorage.setItem('rw.avatarBase', 'male'); localStorage.setItem('rw.introSeen', '1'); });
await page.goto('http://localhost:4173/?webgl', { waitUntil: 'load' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 180000 });
await page.click('#play').catch(() => {});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const S = () => page.evaluate(() => JSON.stringify(window.__rw.STORY.state()) + ' | ' + document.getElementById('objective').innerText.replace(/\n/g, ' / '));
await sleep(6000); console.log("t0", await S());
for (let i = 0; i < 12; i++) { await page.evaluate(() => { window.__rw.P.x += 1.6; }); await sleep(250); }
await page.keyboard.down('w'); await page.keyboard.down('Shift'); await sleep(12000); await page.keyboard.up('Shift'); await page.keyboard.up('w'); console.log('t1', await S());
await page.keyboard.press('b'); await sleep(500); await page.keyboard.press('Tab'); await sleep(800); await page.keyboard.press('Tab'); await sleep(400); await page.keyboard.press('m'); await sleep(800); await page.keyboard.press('Escape'); await sleep(2500);
console.log('t2', await S()); await page.screenshot({ path: '/tmp/kk/story_m1.png' });
for (const k of ['fit', 'poster', 'photo']) { await page.evaluate((k) => window.__rw.STORY.emit(k), k); await sleep(2500); console.log(k, await S()); }
await page.screenshot({ path: '/tmp/kk/story_m4.png' });
await page.evaluate(() => window.__rw.STORY.emit('cab')); await sleep(2500); console.log('cab', await S()); await page.screenshot({ path: '/tmp/kk/story_m5.png' });
await page.evaluate(() => { const r = window.__rw; r.teleport(r.ext.doorPos.x - Math.sin(r.ext.yaw) * 4, r.ext.doorPos.z - Math.cos(r.ext.yaw) * 4); }); await sleep(2500); console.log('queue', await S());
await page.evaluate(() => window.__rw.enterTemple()); await sleep(3000); await page.evaluate(() => { window.__rw.P.dancing = true; }); await sleep(4000); await page.screenshot({ path: '/tmp/kk/story_m6.png' }); await sleep(6000); console.log('rave', await S()); await page.screenshot({ path: '/tmp/kk/story_done.png' });
await browser.close();
