// Perf probe: draw calls, active meshes, active indices, total meshes/materials at fixed views
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); if (process.env.MOBILE) { await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'); await page.setViewport({ width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true }); } else await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('PE', e.message));
await page.goto('http://localhost:4173/?webgl' + (process.env.Q || ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 180000 });
await page.click('#play').catch(() => {});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const m = async (label) => { await sleep(3000); const r = await page.evaluate(() => { const w = window.__rw, s = w.scene || w.inst.scene; const i = w.inst; return { draw: i.drawCallsCounter.current, active: s.getActiveMeshes().length, idx: s.getActiveIndices(), meshes: s.meshes.length, mats: s.materials.length, fps: w.fps(), tier: w.tier, scale: w.inst.scene.getEngine().getHardwareScalingLevel(), rw: w.inst.scene.getEngine().getRenderWidth() }; }); console.log(label.padEnd(12), JSON.stringify(r)); };
await page.evaluate(() => { const r = window.__rw; r.gotoStreet('Donegall Street', 0.62, 1); r.C.yaw = r.P.heading; }); await m('street');
await page.evaluate(() => { const r = window.__rw; const e = r.ext; r.teleport(e.spawn.x, e.spawn.z); }); await m('templeExt');
await page.evaluate(() => window.__rw.enterTemple()); await page.evaluate(() => { window.__rw.camOverride = [4002, 7.5, 9, 4000, 4, 34]; }); await m('rave');
await browser.close();
