// retained-allocation sites (sampling heap profiler) after load: node tools/mem_sites.mjs <url>
import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const cdp = await pg.target().createCDPSession(); await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 65536 });
await pg.goto(process.argv[2], { waitUntil: 'load' }); await pg.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 200000 });
await cdp.send('HeapProfiler.collectGarbage'); const { profile } = await cdp.send('HeapProfiler.getSamplingProfile');
const self = new Map(), incl = new Map();
const walk = (n, stack) => { const f = n.callFrame; const key = (f.functionName || '(anon)') + ' ' + f.url.split('/').pop().split('?')[0] + ':' + f.lineNumber + ':' + f.columnNumber; const st = [...stack, key];
  self.set(key, (self.get(key) || 0) + n.selfSize); for (const k of new Set(st)) incl.set(k, (incl.get(k) || 0) + n.selfSize); for (const c of n.children) walk(c, st); };
walk(profile.head, []);
const mb = (v) => (v / 1e6).toFixed(0) + 'MB';
console.log('SELF', [...self].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => mb(v) + ' ' + k).join('\n'));
console.log('INCL', [...incl].sort((a, b) => b[1] - a[1]).filter(([k]) => !/^\(|start |^\(anon\) $/.test(k)).slice(0, 40).map(([k, v]) => mb(v) + ' ' + k).join('\n'));
await b.close();
