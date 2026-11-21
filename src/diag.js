// On-screen diagnostics so a player can screenshot what went wrong on their device.
// Shown with ?debug=1, and automatically on a fatal error, a render failure or a black canvas.
const Q = new URLSearchParams(location.search);
const LOG = [];
const t0 = performance.now();
const stamp = () => ((performance.now() - t0) / 1000).toFixed(1) + 's';
const push = (kind, args) => { try { LOG.push(stamp() + ' ' + kind + ' ' + Array.from(args).map(a => a instanceof Error ? (a.message + (a.stack ? ' @ ' + a.stack.split('\n').slice(0, 2).join(' | ') : '')) : typeof a === 'object' ? (() => { try { return JSON.stringify(a).slice(0, 300); } catch (e) { return String(a); } })() : String(a)).join(' ').slice(0, 500)); if (LOG.length > 60) LOG.shift(); if (box) render(); } catch (e) { } };
for (const k of ['error', 'warn']) { const o = console[k].bind(console); console[k] = (...a) => { push(k.toUpperCase(), a); o(...a); }; }
export const info = { engine: '?', gpu: '?', stage: 'boot' };
let box = null, reason = '';
function render() {
  if (!box) return;
  box.querySelector('pre').textContent = [
    'RECKLESS WORLD · DIAGNOSTICS' + (reason ? ' · ' + reason : ''),
    'stage: ' + info.stage + ' · engine: ' + info.engine,
    'gpu: ' + info.gpu,
    'screen: ' + screen.width + 'x' + screen.height + ' @' + (devicePixelRatio || 1) + ' · view ' + innerWidth + 'x' + innerHeight,
    'ua: ' + navigator.userAgent,
    'url: ' + location.href,
    '', ...LOG.slice(-25)].join('\n');
}
export function show(why) {
  if (why && !reason) reason = why;
  if (!box) {
    box = document.createElement('div'); box.id = 'diag';
    box.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;max-height:36vh;overflow:auto;z-index:99999;background:rgba(0,0,0,.88);color:#fff;border:2px solid #fff;font:11px/1.35 ui-monospace,Menlo,monospace;padding:10px;';
    box.innerHTML = '<div style="display:flex;gap:8px;margin-bottom:6px"><a href="?safe=1" style="color:#000;background:#fff;padding:4px 8px;text-decoration:none;font-weight:700">TRY SAFE MODE</a><button style="background:#000;color:#fff;border:1px solid #fff;padding:4px 8px">CLOSE</button></div><pre style="white-space:pre-wrap;margin:0"></pre>';
    box.querySelector('button').onclick = () => { box.remove(); box = null; };
    document.body.appendChild(box);
  }
  render();
}
export const fatal = (why, e) => { if (e) push('FATAL', [e]); info.stage += ' (failed)'; show(why); try { window.__rwBoot && window.__rwBoot.fail(why, e && e.message); } catch (x) { } }; // branded RETRY / SAFE MODE fallback (index.html), also in ?app=1
export const log = (...a) => push('INFO', a);
window.addEventListener('error', (e) => { push('ONERROR', [e.message + ' ' + (e.filename || '').split('/').pop() + ':' + e.lineno]); if (!info.ready) show('script error'); });
window.addEventListener('unhandledrejection', (e) => { push('REJECT', [e.reason]); if (!info.ready) show('startup error'); });
// load watchdog: if the world isn't up in 60 s, show what we know
setTimeout(() => { if (!info.ready) show('still loading after 60 s'); }, 60000);
if (Q.has('debug')) { if (document.body) show(''); else addEventListener('DOMContentLoaded', () => show(''), { once: true }); }
window.__diag = { show, info, LOG };
