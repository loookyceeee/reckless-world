import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('PE', e.message));
await page.goto('http://localhost:4173/?webgl' + (process.env.Q || ''), { waitUntil: 'load' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 120000 });
const r = await page.evaluate(async () => {
  const s = __rw.scene, e = s.getEngine(); e.stopRenderLoop(); __rw.app.title = false;
  const T = (n = 3) => { const t0 = performance.now(); for (let i = 0; i < n; i++) s.render(); return +((performance.now() - t0) / n).toFixed(0); };
  T(2); const out = { base: T(), active: s.getActiveMeshes().length, draw: e._drawCalls ? e._drawCalls.current : null };
  const fest = s.meshes.filter(m => /festoon/.test(m.name)); fest.forEach(m => m.setEnabled(false)); out.noFest = T(); fest.forEach(m => m.setEnabled(true));
  const gl = s.effectLayers || []; gl.forEach(l => l.isEnabled = false); out.noGlow = T(); gl.forEach(l => l.isEnabled = true);
  const pm = s.postProcessRenderPipelineManager; const cam = s.activeCamera; try { pm.detachCamerasFromRenderPipeline('ssao', cam); } catch (e) { } out.noSSAO = T();
  try { pm.detachCamerasFromRenderPipeline('cine', cam); } catch (e) { } out.noPost = T();
  const av = s.meshes.filter(m => /^av3d-/.test(m.name)); av.forEach(m => m.setEnabled(false)); out.noAv = T();
  return out;
});
console.log(JSON.stringify(r)); await browser.close();
