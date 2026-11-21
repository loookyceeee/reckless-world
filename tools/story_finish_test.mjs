// ?storyjump=6&storyfast: jump to FIRST RAVE, check the dance clip plays (bone deltas) and the STORY COMPLETE stamp shows; shots /tmp/kk/dz_*.png
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', e => console.log('PE', e.message));
await page.evaluateOnNewDocument(() => { localStorage.setItem('rw.avatarBase', 'male'); localStorage.setItem('rw.introSeen', '1'); });
await page.goto('http://localhost:4173/?webgl&storyjump=6&storyfast', { waitUntil: 'load' });
await page.waitForFunction(() => window.__rw && window.__rw.ready, { timeout: 180000 });
await page.click('#play').catch(() => {});
await page.click('#play').catch(() => {}); const sleep = (ms) => new Promise(r => setTimeout(r, ms));
await sleep(3000); console.log('groups', await page.evaluate(() => window.__rw.scene.animationGroups.filter(g => /dance/i.test(g.name)).map(g => g.name + ':' + g.isPlaying).join(',')));
await page.evaluate(() => window.__rw.enterTemple()); await sleep(2500);
const shot = async (n) => { await page.screenshot({ path: `/tmp/kk/dz_${n}.png` }); };
const bones = () => page.evaluate(() => { const sk = window.__rw.scene.skeletons.find(s => s.bones.length > 20); if (!sk) return null; return sk.bones.slice(0, 40).map(b => b.getRotationQuaternion ? 0 : 0).length + ':' + sk.bones.filter(b => /arm|Arm/.test(b.name)).slice(0, 2).map(b => { const q = b.getLocalMatrix().m; return [q[0], q[1], q[2]].map(v => v.toFixed(3)).join(','); }).join('|'); });
await page.evaluate(() => { window.__rw.camRel = [Math.PI, 3.2, 1.5, 1.0]; }); await sleep(1500); console.log('b0', await bones(), await page.evaluate(() => JSON.stringify({ ad: window.__rw.phone.ctx.app ? 1 : 0 }))); await shot('a'); await sleep(2500); console.log('b1', await bones()); await shot('b');
for (let i = 0; i < 25; i++) { const st = await page.evaluate(() => window.__rw.STORY.state()); if (st.done) break; await sleep(1000); }
await page.evaluate(() => { window.__rw.camRel = null; }); await sleep(1500); console.log('state', JSON.stringify(await page.evaluate(() => window.__rw.STORY.state()))); await shot('done');
await browser.close();
