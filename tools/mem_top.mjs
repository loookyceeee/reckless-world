import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await pg.goto(process.argv[2], { waitUntil: 'load' }); await pg.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 200000 });
console.log(await pg.evaluate(() => { const sc = window.__rw.posters[0].mesh.getScene(); const ms = sc.meshes.map(m => { let v = 0, ix = 0; try { v = m.getTotalVertices(); ix = (m.getTotalIndices && m.getTotalIndices()) || 0; } catch (e) {} return [m.name, v, ix, m.thinInstanceCount || 0, m.instances ? m.instances.length : 0, !!m.geometry]; });
  const geos = sc.geometries.length; let tv = 0, ti = 0, kinds = {}; for (const g of sc.geometries) { tv += g.getTotalVertices(); ti += (g.getTotalIndices() || 0); const vb = g.getVertexBuffers() || {}; for (const k in vb) { const d = vb[k].getData && vb[k].getData(); kinds[k] = (kinds[k] || 0) + (d ? (d.byteLength || d.length * 8) : 0); } }
  const byPrefix = {}; for (const [n, v, ix] of ms) { const p = n.replace(/[0-9_.\-]+.*$/, '').slice(0, 18); byPrefix[p] = byPrefix[p] || [0, 0, 0]; byPrefix[p][0]++; byPrefix[p][1] += v; byPrefix[p][2] += ix; }
  const top = Object.entries(byPrefix).sort((a, b) => b[1][1] - a[1][1]).slice(0, 25);
  return JSON.stringify({ meshes: sc.meshes.length, geos, tv, ti, cpuVB_MB: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, Math.round(v / 1e6)])), textures: sc.textures.length, top }, null, 0); }));
await b.close();
