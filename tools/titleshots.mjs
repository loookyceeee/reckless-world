// Capture title flyover keyframes without pressing start
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('PE', e.message));
await page.goto('http://localhost:4173/?webgl', { waitUntil: 'load' });
await page.screenshot({ path: (process.env.OUT || '/tmp/rwx/') + 'title-loading.png' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 180000 });
await new Promise(r => setTimeout(r, 2500));
for (const s of (process.env.TS || '0,6,12,18,26').split(',')) { await page.evaluate((s) => { window.__rwFly.at = +s; }, s); await new Promise(r => setTimeout(r, 1500)); await page.screenshot({ path: (process.env.OUT || '/tmp/rwx/') + 'title-' + s + '.png' }); console.log('shot', s); }
await browser.close();
