// peak JS heap + GL buffer/texture estimate during load: node tools/mem_probe.mjs <url>
import puppeteer from 'puppeteer-core'; import fs from 'fs';
const url = process.argv[2];
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await pg.evaluateOnNewDocument(fs.readFileSync(new URL('./gl_track.js', import.meta.url), 'utf8'));
const t0 = Date.now(); await pg.goto(url, { waitUntil: 'load' }); let peak = 0, last = '';
for (let i = 0; i < 200; i++) { const m = await pg.metrics(); peak = Math.max(peak, m.JSHeapUsedSize);
  const s = await pg.evaluate(() => [(document.getElementById('lbar') || {}).style?.width, !!(window.__rw && window.__rw.ready), Math.round(window.__gm().buf / 1e6), Math.round(window.__gm().tex / 1e6)]);
  const line = `${s[0]} ready=${s[1]} heap=${Math.round(m.JSHeapUsedSize / 1e6)}MB gl-buf=${s[2]}MB gl-tex=${s[3]}MB`; if (s[0] !== last) { console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', line); last = s[0]; }
  if (s[1]) { await new Promise(r => setTimeout(r, 12000)); const cdp = await pg.target().createCDPSession(); await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage'); const m2 = await pg.metrics(); const s2 = await pg.evaluate(() => [Math.round(window.__gm().buf / 1e6), Math.round(window.__gm().tex / 1e6)]); console.log('ready+4s after GC heap', Math.round(m2.JSHeapUsedSize / 1e6), 'MB peak heap', Math.round(peak / 1e6), 'MB gl-buf', s2[0], 'MB gl-tex', s2[1], 'MB'); break; }
  await new Promise(r => setTimeout(r, 250)); }
await b.close();
