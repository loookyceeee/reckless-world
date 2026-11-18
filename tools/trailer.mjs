// Render a deterministic trailer: frames at fixed 1/30 s steps, then ffmpeg -> MP4 (30fps)
import puppeteer from 'puppeteer-core';
const D = process.env.FR || '/tmp/rwx/tr/';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('PE', e.message));
await page.goto('http://localhost:4173/?webgl', { waitUntil: 'load' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 180000 });
await new Promise(r => setTimeout(r, 2000));
await page.evaluate(() => { window.__rw.fixedDt = 1 / 30; window.__rw.manual(true); });
let n = 0; const only = process.env.SEG;
const frame = async (pre) => { await page.evaluate(pre || (() => 0)); await page.evaluate(() => window.__rw.renderFrame(1)); await page.screenshot({ path: D + String(n++).padStart(4, '0') + '.jpg', type: 'jpeg', quality: 90 }); if (n % 30 === 0) console.log('frame', n); };
// A: title flyover (9 s) — St Anne's + Spire, down to the Temple, logo + PRESS START
for (let f = 0; f < 270; f++) await frame(new Function(`window.__rwFly.at = ${4 + f * 22 / 269};`));
// B: press start, jog down Donegall Street with traffic (6 s)
await page.evaluate(() => { window.__rwFly.at = null; document.getElementById('play').click(); const r = window.__rw; r.gotoStreet('Donegall Street', 0.62, 1); r.C.pitch = 0.12; r.C.dist = 5; r.C.curDist = 5; r.C.yaw = r.P.heading; });
await page.evaluate(() => window.__rw.renderFrame(20));
await page.keyboard.down('KeyW');
for (let f = 0; f < 180; f++) { if (f === 60) await page.keyboard.down('ShiftLeft'); await frame(); }
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
// C: inside the Temple — slow crane down the nave toward the stage (7 s)
await page.evaluate(() => { window.__rw.enterTemple(); window.__rw.renderFrame(10); });
for (let f = 0; f < 210; f++) { const u = f / 209; await frame(new Function(`window.__rw.camOverride=[${4003 - u * 3},${8 - u * 4.5},${6 + u * 16},4000,${3.5 + u * 1.2},34];`)); }
// D: low side angle across the crowd with beams (5 s)
for (let f = 0; f < 150; f++) { const u = f / 149; await frame(new Function(`window.__rw.camOverride=[${3992 + u * 2},${2.6 + u * 0.8},${22 + u * 4},4004,6,32];`)); }
await browser.close(); console.log('done', n);
