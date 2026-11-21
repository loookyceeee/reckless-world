// App / embed support (docs/EMBED.md).
// ?app=1   -> class rw-app on <html> (set by the boot script in index.html): web-only chrome hidden, edge to edge with safe-area insets.
// in iframe -> class rw-embed: fullscreen button (requestFullscreen, falls back to opening the game in a new tab).
// #token=<bearer> -> taken out of the URL by the boot script before any module runs; verified here with GET /api/auth/me,
//                   then stored exactly like the wardrobe sign-in (crew.js storeAccount). Never logged, never written anywhere else.
import { API, storeAccount } from './crew.js';
const root = document.documentElement;
export const APP = root.classList.contains('rw-app');
export const EMBED = root.classList.contains('rw-embed');
const take = () => { const t = window.__rwHandoff; try { delete window.__rwHandoff; } catch (e) { window.__rwHandoff = undefined; } return typeof t === 'string' ? t : null; };
const me = async (t) => { const ac = typeof AbortController !== 'undefined' ? new AbortController() : null; const to = ac && setTimeout(() => ac.abort(), 8000); // a hung request must not hold up the boot
  try { const r = await fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + t }, cache: 'no-store', credentials: 'omit', signal: ac ? ac.signal : undefined }); clearTimeout(to);
  if (r.status === 426) return { s: 'pin' }; if (r.status === 401 || r.status === 403) return { s: 'expired' }; if (!r.ok) return { s: 'offline' }; const p = await r.json().catch(() => ({})); return { s: 'ok', email: (p && (p.email || (p.user && p.user.email))) || '' }; } catch (e) { clearTimeout(to); return { s: 'offline' }; } };
/** 'none' | 'ok' | 'expired' (401/403) | 'pin' (426 UPDATE_APP) | 'offline'. On offline it retries once in the background (8 s) and stores on success. */
export async function consumeHandoff(onLate) {
  const t = take(); if (!t) return 'none';
  const r = await me(t); if (r.s === 'ok') { storeAccount({ token: t, email: r.email, via: 'app' }); return 'ok'; }
  if (r.s === 'offline') setTimeout(async () => { const r2 = await me(t); if (r2.s === 'ok') { storeAccount({ token: t, email: r2.email, via: 'app' }); onLate && onLate(); } }, 8000);
  return r.s;
}
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
const canFs = () => !!(root.requestFullscreen || root.webkitRequestFullscreen) && (document.fullscreenEnabled !== false || document.webkitFullscreenEnabled);
async function goFull() {
  if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  try { if (!canFs()) throw new Error('no fs'); const req = root.requestFullscreen || root.webkitRequestFullscreen; await req.call(root, { navigationUI: 'hide' }); window.__rwFs = 'fullscreen'; try { await screen.orientation.lock('landscape'); } catch (e) { } }
  catch (e) { const u = location.origin + location.pathname + location.search; const w = window.open(u, '_blank', 'noopener'); window.__rwFs = 'newtab:' + (e && e.name); } // iframe without allow=fullscreen, or iPhone Safari (no element fullscreen)
}
/** In-app close (APP DEV contract): tells the React Native WebView host to close the game. */
export const appBridge = () => !!(window.ReactNativeWebView && window.ReactNativeWebView.postMessage);
export const appClose = () => { try { window.ReactNativeWebView?.postMessage('{"type":"close"}'); } catch (e) { } };
/** Fullscreen button: shown in iframes and on the plain web; never in the app (the WebView already runs edge to edge). */
export function mountFullscreen() {
  if (APP) return null;
  const b = document.createElement('button'); b.id = 'fsBtn'; b.type = 'button'; b.setAttribute('aria-label', 'FULL SCREEN');
  const lbl = () => { const on = !!fsEl(); b.innerHTML = `<i>${on ? '✕' : '⤢'}</i><span>${on ? 'EXIT FULL SCREEN' : (canFs() ? 'FULL SCREEN' : 'OPEN FULL SCREEN')}</span>`; b.classList.toggle('on', on); };
  b.addEventListener('click', (e) => { e.stopPropagation(); goFull().finally(() => setTimeout(lbl, 300)); }); b.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.addEventListener('fullscreenchange', lbl); document.addEventListener('webkitfullscreenchange', lbl); lbl(); document.body.appendChild(b); return b;
}
