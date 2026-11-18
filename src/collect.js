// Photo hunt + CREW CARDS (research/game-design.md items 4/5 and 12). Both award nothing (no XP, no codes, no events):
// progress lives in localStorage only. Photo hunt: five landmarks, frame one near the centre of the viewfinder with a
// clear line of sight and shoot (P, or SHOOT in the viewfinder). Cards: twenty B&W typographic cards hidden across the
// slice (venue porches, poster walls, behind rapid-bus stops); a quiet ping at 12 m, pick up within 1.2 m.
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { box, toMesh } from './geo.js';

const LS = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') ?? d; } catch (e) { return d; } };
const SAVE = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
export const CARD_NAMES = ['THE PORCH', 'CARLISLE CIRCUS', 'THE GABLE', 'DUNBAR STREET', 'THE BLADE', 'GLENGALL STREET', 'THE BALCONY', "PATTERSON'S PLACE", 'BANKMORE SQUARE', 'LISBURN ROAD',
  'HILL STREET', 'DONEGALL STREET', 'CLIFTON STREET', 'THE NIGHT BUS', 'LAST ORDERS', '140 BPM', 'THE FIRST WALL', 'RED LIGHT', 'THE QUEUE', 'HOME BY FOUR'];
const CARD_LINES = ['Doors at nine. Nobody comes at nine.', 'Round the circus twice before anyone says a word.', 'Black letters on a white wall, the bass behind them.', 'Fruit and veg by day.',
  'Yellow sign, last bus long gone.', 'The old station still keeps time.', 'Glass up top, queue down below.', 'A lane you only find by following the noise.', 'Brick, copper and a pool table nobody wins.', 'Arcade lights through the window.',
  'Shutters down, posters up.', 'Paste at midnight, read at noon.', 'The walk home starts here.', 'Purple, bendy, packed.', 'Water, lots of ice.', 'The only tempo that matters.', 'Where the first poster went up.', 'Everything looks better in red.', 'Worth it.', 'Breakfast is a rumour.'];
export function cardArt(i, size = 220) { // typographic B&W card, 5:7
  const c = document.createElement('canvas'); c.width = size; c.height = Math.round(size * 1.4); const g = c.getContext('2d'), W = c.width, H = c.height;
  const inv = i % 3 === 1; g.fillStyle = inv ? '#fff' : '#000'; g.fillRect(0, 0, W, H); g.strokeStyle = inv ? '#000' : '#fff'; g.lineWidth = W * 0.025; g.strokeRect(W * 0.05, W * 0.05, W * 0.9, H - W * 0.1);
  g.fillStyle = inv ? '#000' : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${W * 0.42}px Unbounded, sans-serif`; g.fillText(String(i + 1).padStart(2, '0'), W / 2, H * 0.36);
  g.fillStyle = '#ff2a3c'; g.fillRect(W * 0.2, H * 0.55, W * 0.6, W * 0.02); g.fillStyle = inv ? '#000' : '#fff';
  let fs = W * 0.1; do { g.font = `800 ${fs}px Unbounded, sans-serif`; fs -= 1; } while (g.measureText(CARD_NAMES[i]).width > W * 0.8 && fs > 8); g.fillText(CARD_NAMES[i], W / 2, H * 0.64);
  g.font = `600 ${W * 0.055}px "DM Sans", sans-serif`; const words = CARD_LINES[i].split(' '); let line = '', y = H * 0.74; for (const w of words) { const tl = line ? line + ' ' + w : w; if (g.measureText(tl).width > W * 0.78) { g.fillText(line, W / 2, y); line = w; y += W * 0.075; } else line = tl; } g.fillText(line, W / 2, y);
  g.font = `800 ${W * 0.045}px Unbounded, sans-serif`; g.fillText('RECKLESS · CREW CARD', W / 2, H - W * 0.13);
  return c;
}
export function createCollect({ scene, hud, AU, app, grid, targets, spots }) {
  // ---- photo hunt
  const shot = LS('rw.photoHunt.v1', {}); const thumbs = LS('rw.photoThumbs.v1', {});
  const T = targets.map(t => { let c = t.c, r = t.r; if (t.mesh) { t.mesh.computeWorldMatrix(true); const bb = t.mesh.getBoundingInfo().boundingBox; c = bb.centerWorld.clone(); r = bb.extendSizeWorld.length(); if (t.lift) c.y += t.lift; } return { ...t, c, r }; });
  const fwd = new Vector3();
  const framed = (cam) => { cam.getDirectionToRef(Vector3.Forward(), fwd); const p = cam.globalPosition || cam.position; let best = null;
    for (const t of T) { const v = t.c.subtract(p), d = v.length(); if (d < 6 || d > (t.max || 260)) continue; const ang = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(v.scale(1 / d), fwd))));
      const lim = Math.min(0.42, Math.max(0.16, Math.atan(t.r / d) * 0.8)); if (ang > lim) continue;
      const f = grid.raycast(p.x, p.z, t.c.x, t.c.z, Math.min(p.y, t.c.y) + 0.5); if (f * d < d - t.r * 0.9 - 3) continue;
      if (!best || ang < best.ang) best = { t, ang, d }; }
    return best; };
  const thumb = (canvas) => { try { const c = document.createElement('canvas'); c.width = 192; c.height = 108; const g = c.getContext('2d'); g.drawImage(canvas, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.6); } catch (e) { return null; } };
  // viewfinder overlay
  const vf = document.createElement('div'); vf.className = 'vfinder'; vf.innerHTML = '<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i><div class="vfl"></div><button class="vfshoot">SHOOT</button><button class="vfx">✕</button>';
  (hud.hud || document.body).appendChild(vf); const vfl = vf.querySelector('.vfl');
  let vfOn = false; const api = {};
  api.viewfinder = (on = !vfOn) => { vfOn = on; vf.classList.toggle('on', on); document.body.classList.toggle('vfon', on); };
  vf.querySelector('.vfx').addEventListener('click', (e) => { e.stopPropagation(); api.viewfinder(false); });
  vf.querySelector('.vfshoot').addEventListener('click', (e) => { e.stopPropagation(); api.onShoot && api.onShoot(); });
  // called by main's photo() right after the frame is rendered: returns the target this shot counts for (or null)
  api.checkShot = (cam, canvas) => { AU && AU.shutter && AU.shutter(); const f = framed(cam); if (!f) { if (vfOn) hud.toast('NOTHING ON THE LIST IN FRAME'); return null; }
    const t = f.t; if (shot[t.id]) { hud.toast(t.name + ' · ALREADY SHOT'); return t; }
    shot[t.id] = Date.now(); SAVE('rw.photoHunt.v1', shot); const th = thumb(canvas); if (th) { thumbs[t.id] = th; SAVE('rw.photoThumbs.v1', thumbs); }
    const n = Object.keys(shot).filter(k => T.some(x => x.id === k)).length;
    if (n >= T.length) hud.stamp({ title: 'PHOTO HUNT DONE', sub: 'CAMERA', lines: T.map(x => x.name + ' ✓'), }); else hud.stamp({ title: t.name, sub: `PHOTO HUNT · ${n} / ${T.length}`, lines: ['SAVED TO CAMERA'] });
    return t; };
  api.photoList = () => T.map(t => ({ id: t.id, name: t.name, done: !!shot[t.id], thumb: thumbs[t.id] || null, x: t.c.x, z: t.c.z }));
  // ---- crew cards
  const got = new Set(LS('rw.cards.v1', [])); const heard = new Set(LS('rw.cardsHeard.v1', []));
  const tex = new DynamicTexture('cardTex', { width: 128, height: 180 }, scene, true); { const g = tex.getContext(); const a = cardArt(0, 128); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 180); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(6, 6, 116, 168);
    g.font = '900 54px Unbounded, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('R', 64, 74); g.fillStyle = '#ff2a3c'; g.fillRect(30, 112, 68, 4); g.fillStyle = '#fff'; g.font = '800 13px Unbounded, sans-serif'; g.fillText('CREW', 64, 134); g.fillText('CARD', 64, 150); tex.update(); void a; }
  const cm = new StandardMaterial('cardM', scene); cm.disableLighting = true; cm.emissiveTexture = tex; cm.diffuseColor = Color3.Black(); cm.emissiveColor = Color3.Black(); cm.backFaceCulling = false;
  const card = toMesh('crewCard', box(0.34, 0.48, 0.015), scene, cm); card.isPickable = false; card.alwaysSelectAsActiveMesh = true;
  const C = spots.slice(0, 20).map((s, i) => ({ ...s, i })); const buf = new Float32Array(20 * 16); card.thinInstanceSetBuffer('matrix', buf, 16, false);
  const m4 = new Matrix(), q4 = new Quaternion(), v4 = new Vector3(), s4 = new Vector3(1, 1, 1);
  api.blips = () => C.filter(c => !got.has(c.i) && heard.has(c.i)).map(c => ({ x: c.x, z: c.z }));
  api.cards = () => C.map(c => ({ i: c.i, name: CARD_NAMES[c.i], where: c.label, got: got.has(c.i) }));
  api.cardCount = () => got.size;
  api.update = (P, t, inside) => { if (inside) { card.thinInstanceCount = 0; return; } let n = 0;
    for (const c of C) { if (got.has(c.i)) continue; const d = Math.hypot(P.x - c.x, P.z - c.z);
      if (d < 1.2) { got.add(c.i); SAVE('rw.cards.v1', [...got]); AU && AU.blip && (AU.blip(1320, 0.12, 0.06), setTimeout(() => AU.blip(1760, 0.16, 0.05), 90)); hud.toast(`CREW CARD ${got.size} / ${C.length} · ${CARD_NAMES[c.i]}`); if (got.size === C.length) hud.stamp({ title: 'FULL DECK', sub: 'CREW CARDS · 20 / 20', lines: ['EVERY CARD FOUND', 'SEE THEM ALL IN THE PHONE'] }); continue; }
      if (d < 12 && !c._ping) { c._ping = true; AU && AU.blip && AU.blip(1760, 0.05, 0.025); if (!heard.has(c.i)) { heard.add(c.i); SAVE('rw.cardsHeard.v1', [...heard]); } } else if (d > 16) c._ping = false;
      if (d > 120) continue; Quaternion.FromEulerAnglesToRef(0, t * 1.6 + c.i, 0, q4); v4.set(c.x, (c.y || 1.05) + Math.sin(t * 2 + c.i) * 0.06, c.z); Matrix.ComposeToRef(s4, q4, v4, m4); m4.copyToArray(buf, n * 16); n++; }
    card.thinInstanceCount = n; card.thinInstanceBufferUpdated('matrix'); };
  api.frameHint = (cam) => { if (!vfOn) return; const f = framed(cam); vf.classList.toggle('lock', !!f); let near = null, nd = 1e9; const p = cam.globalPosition || cam.position;
    for (const t of T) { if (shot[t.id]) continue; const d = Math.hypot(t.c.x - p.x, t.c.z - p.z); if (d < nd) { nd = d; near = t; } }
    vfl.innerHTML = f ? `<b>${f.t.name}</b> IN FRAME · ${Math.round(f.d)} M${shot[f.t.id] ? ' · SHOT ✓' : ''}` : near ? `PHOTO HUNT · NEAREST: <b>${near.name}</b> · ${Math.round(nd)} M` : 'PHOTO HUNT COMPLETE · FREE SHOOTING'; };
  api.mesh = card; api.vfOn = () => vfOn;
  return api;
}
