// ?app=1 web-only chrome check: node tools/app_chrome_check.mjs <base> <tag>  -> /tmp/rwx/appchk_<tag>_*.png
import puppeteer from 'puppeteer-core';
const base = process.argv[2] || 'http://localhost:4173/', tag = process.argv[3] || 'local';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 600000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [vp, q] of [[{ width: 430, height: 932 }, '?app=1'], [{ width: 932, height: 430 }, '?app=1'], [{ width: 430, height: 932 }, '']]) {
  const ctx = await b.createBrowserContext(); const pg = await ctx.newPage();
  await pg.setViewport({ ...vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await pg.goto(base + q, { waitUntil: 'load' }); await pg.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 240000 }).catch(() => {}); await new Promise(r => setTimeout(r, 1500));
  const r = await pg.evaluate(() => { const vis = (e) => !!e && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0;
    const sm = document.querySelector('#title small'); const ext = [...document.querySelectorAll('a[href^="http"],a[target=_blank]')].filter(vis).map(a => a.innerText.trim().slice(0, 30));
    return { cls: document.documentElement.className, safeLnk: vis(document.getElementById('safeLnk')), fsBtn: vis(document.getElementById('fsBtn')), footer: sm && sm.innerText, osm: !!sm && /OPENSTREETMAP/.test(sm.innerText) && vis(sm), visibleExternalLinks: ext, tickets: vis(document.querySelector('.live a')) }; });
  const name = `${q ? 'app' : 'web'}_${vp.width > vp.height ? 'land' : 'port'}`; console.log(tag, name, JSON.stringify(r));
  await pg.screenshot({ path: `/tmp/rwx/appchk_${tag}_${name}.png` }); await ctx.close();
}
await b.close();
