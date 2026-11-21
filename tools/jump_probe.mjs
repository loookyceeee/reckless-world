import puppeteer from '/workspace/reckless-world/game/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage(); await pg.setViewport({ width: 393, height: 851, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await pg.evaluateOnNewDocument(() => localStorage.setItem('rw.avatarBase', 'male'));
await pg.goto(process.argv[2], { waitUntil: 'load' }); await pg.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 240000 });
await pg.touchscreen.tap(196, 600); await new Promise(r => setTimeout(r, 6000));
const j = await pg.evaluate(() => { const r = document.getElementById('tJump').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, getComputedStyle(document.getElementById('tJump')).display, document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).id || document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).className]; });
console.log('btn', JSON.stringify(j));
await pg.touchscreen.tap(j[0], j[1]); const ys = []; for (let i = 0; i < 10; i++) { ys.push(await pg.evaluate(() => [+window.__rw.P.y.toFixed(2), !!window.__rw.P.air])); await new Promise(r => setTimeout(r, 100)); }
console.log('y', JSON.stringify(ys)); await b.close();
