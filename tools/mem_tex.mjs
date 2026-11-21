import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await pg.goto(process.argv[2], { waitUntil: 'load' }); await pg.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 200000 });
console.log(await pg.evaluate(() => { const sc = window.__rw.scene; const t = sc.textures.map(x => { const s = x.getSize ? x.getSize() : { width: 0, height: 0 }; return [x.name.split('/').pop().slice(0, 40), s.width + 'x' + s.height, Math.round(s.width * s.height * 4 * (x.isCube ? 6 : 1) / 1e5) / 10]; }).sort((a, b) => b[2] - a[2]).slice(0, 18);
  const rt = (sc.customRenderTargets || []).length; const byMat = {}; for (const m of sc.meshes) { const k = m.name.replace(/[@\-_0-9].*$/, ''); byMat[k] = (byMat[k] || 0) + (m.getTotalVertices ? m.getTotalVertices() : 0); }
  return JSON.stringify({ t, rt, canvas: [sc.getEngine().getRenderWidth(), sc.getEngine().getRenderHeight()], verts: Object.entries(byMat).sort((a, b) => b[1] - a[1]).slice(0, 16) }); }));
await b.close();
