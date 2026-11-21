// 1:1 port of the Reckless Raves app crew wardrobe (rr-ios-src/data/crew.ts):
// same Drop 018 pieces, slots, unlock levels, renders and lookFor() logic.
// 2D portraits are APP DEV's v5 layered crew art (manifest + bundled fallback), composited exactly like the app.
// READ-ONLY against the Crew API: GET /api/crew only. Never PUT, never XP, never codes.
const B = () => import.meta.env.BASE_URL + 'crew/';
export const API = 'https://reckless-raves-api-30is.onrender.com';
// ---- crew rules: owned by RECKLESS CREW LOYALTY (crew_config.json, schema reckless-crew-config/v1). Never edited here. ----
// Runtime: GET {API}/api/crew/config, falling back to the copy bundled at build time (public/data/crew_config.json).
// The numbers below are only the last-resort fallback if neither loads.
export const CREW_RULES = {
  RANKS: [0, 250, 500, 1000, 1250, 1500, 2000, 2250, 2500, 3000, 3500, 4000, 5000, 6000, 7500], // xp_to_enter for levels 1..15
  SIGNED_OUT_LEVEL: 1, // signed-out players (and signed-in before the crew loads) get only what the first rank unlocks
  STARTER_FIT: { top: 'skate-tee', outer: null, legs: 'barrel-jeans' },
  GAME: { weekly_cap_xp: 40, rave: { xp: 20, min_dwell_seconds: 600, max_per_london_day: 1, max_per_iso_week: 2 }, poster: { xp: 10, max_per_london_day: 2 } },
  source: 'fallback', status: null, updated_at: null,
};
export const RANKS = CREW_RULES.RANKS; // same array object; refilled in place by applyCrewConfig
export const levelFor = (xp) => { let l = 1; CREW_RULES.RANKS.forEach((x, i) => { if (xp >= x) l = i + 1; }); return l; };
// col = median colour of APP DEV's v5 garment layer (fallback tint for the 3D figure); kind = which 3D garment shape (matched to the v5 silhouette).
const W = (id, name, slot, level, icon, look, withJeans, col, kind) => ({ id, name, slot, level, icon, look, withJeans, col, kind });
export const WARDROBE = [
  W('skate-tee', 'SKATE TEE', 'top', 2, 'icon-tee', 'tee', 'tee-jeans', '#1e1b21', 'tee'),
  W('rckls-tee', 'RCKLS TEE', 'top', 3, 'icon-rckls-tee', 'rckls-tee', 'rckls-tee', '#161618', 'tee'),
  W('see-me-shorts', 'SEE ME SHORTS', 'legs', 3, 'icon-see-shorts', 'see-shorts', null, '#736f6f', 'shorts'),
  W('deject-sleeve', 'DEJECT SLEEVE', 'top', 4, 'icon-deject', 'deject', 'deject-jeans', '#262428', 'long'),
  W('barrel-jeans', 'BARREL JEANS', 'legs', 5, 'icon-jeans', 'jeans', null, '#58697f', 'jeans'),
  W('moltin-tee', 'MOLTIN TEE', 'top', 5, 'icon-moltin', 'moltin', 'moltin', '#e0dee5', 'tee'),
  W('stripped-tee', 'STRIPPED TEE', 'top', 6, 'icon-stripped', 'stripped', 'stripped', '#161618', 'tee'),
  W('seasoned-pants', 'SEASONED PANTS', 'legs', 6, 'icon-seasoned-pants', 'seasoned-pants', null, '#161619', 'pants'),
  W('seasoned-hoodie', 'SEASONED HOODIE', 'outer', 7, 'icon-hoodie', 'hoodie', 'hoodie-jeans', '#1d1b22', 'hoodie'),
  W('isometric-tee', 'ISOMETRIC TEE', 'top', 8, 'icon-isometric', 'isometric', 'isometric', '#e0dee8', 'tee'),
  W('artillery', 'ARTILLERY CARGOS', 'legs', 8, 'icon-artillery', 'artillery', null, '#161417', 'pants'),
  W('ultra-tee', 'ULTRA TEE', 'top', 9, 'icon-ultra', 'ultra', 'ultra', '#151517', 'tee'),
  W('stan-bottoms', 'STAN BOTTOMS', 'legs', 9, 'icon-stan-bottoms', 'stan-bottoms', null, '#171719', 'cuffed'),
  W('rawdwg-zip', 'RAWDWG ZIP', 'outer', 10, 'icon-zip', 'zip', 'zip-jeans', '#18161a', 'hoodie'),
  W('pinner-tee', 'PINNER TEE', 'top', 11, 'icon-pinner', 'pinner', 'pinner', '#171717', 'tee'),
  W('rawdawg-shorts', 'RAWDWG SHORTS', 'legs', 11, 'icon-raw-shorts', 'raw-shorts', null, '#161616', 'shorts'),
  W('distress-shirt', 'DISTRESS SHIRT', 'top', 12, 'icon-distress', 'distress', 'distress', '#353537', 'tee'),
  W('manager-shorts', 'MANAGER SHORTS', 'legs', 12, 'icon-manager-shorts', 'manager-shorts', null, '#6b7d9d', 'shorts'),
  W('manager-zip', 'MANAGER ZIP', 'outer', 13, 'icon-manager', 'manager', 'manager-jeans', '#7487ae', 'long'),
  W('see-me-crop', 'SEE ME CROP', 'top', 14, 'icon-crop', 'crop', 'crop', '#706b72', 'tee'),
  W('stan-hoodie', 'STAN HOODIE', 'outer', 14, 'icon-stan-hoodie', 'stan-hoodie', 'stan-hoodie', '#222224', 'long'),
  W('rcklstv-jersey', 'RCKLSTV JERSEY', 'top', 15, 'icon-jersey', 'jersey', 'jersey', '#d9d7d8', 'long'),
  W('mesh-jersey', 'MESH JERSEY', 'top', 15, 'icon-mesh', 'mesh', 'mesh', '#282729', 'tee'),
];
/** v5 cut variants: pieces whose v5 silhouette differs from their kind's shared 3D mesh get their own fitted mesh (build_avatar.py). */
export const M3 = { 'manager-shorts': 'shortsL', 'rawdawg-shorts': 'shortsL', 'artillery': 'pantsW', 'rcklstv-jersey': 'jersey', 'distress-shirt': 'teeD', 'see-me-crop': 'crop' };
export const meshKind = (g) => (g && (M3[g.id] || g.kind)) || null;
export const EMPTY_FIT = { top: null, outer: null, legs: null };
export const gearById = (id) => (id && WARDROBE.find(p => p.id === id)) || null;
/** Drop 018 product photo for a wardrobe piece (from the app's shop assets, 256 px webp). */
export const shopImg = (id) => B() + 'shop/' + id + '.webp';
// ---- v5 crew art (APP DEV, approved by Luke): one fixed base per gender, clothing-only layers, 540x720 ----
// Live manifest {API}/avatar/manifest.json (GET only); bundled lossless copies in public/crew/v5/ if the API is down.
// Draw order (manifest.order): lower first (the legs piece, else body.lower), then upper (outer, else top, else body.upper).
const V5 = () => B() + 'v5/';
const V5_FILES = { 'skate-tee': 'upper-tee', 'rckls-tee': 'upper-rckls-tee', 'see-me-shorts': 'lower-see-shorts', 'deject-sleeve': 'upper-deject', 'barrel-jeans': 'lower-jeans', 'moltin-tee': 'upper-moltin', 'stripped-tee': 'upper-stripped',
  'seasoned-pants': 'lower-seasoned-pants', 'seasoned-hoodie': 'upper-hoodie', 'isometric-tee': 'upper-isometric', 'artillery': 'lower-artillery', 'ultra-tee': 'upper-ultra', 'stan-bottoms': 'lower-stan-bottoms', 'rawdwg-zip': 'upper-zip',
  'pinner-tee': 'upper-pinner', 'rawdawg-shorts': 'lower-raw-shorts', 'distress-shirt': 'upper-distress', 'manager-shorts': 'lower-manager-shorts', 'manager-zip': 'upper-manager', 'see-me-crop': 'upper-crop', 'stan-hoodie': 'upper-stan-hoodie',
  'rcklstv-jersey': 'upper-jersey', 'mesh-jersey': 'upper-mesh' };
let MAN = null, manP = null;
export function loadAvatarManifest(ms = 3000) {
  if (manP) return manP;
  manP = (async () => { try { const ac = new AbortController(); const to = setTimeout(() => ac.abort(), ms); const r = await fetch(API + '/avatar/manifest.json', { signal: ac.signal, cache: 'no-cache' }); clearTimeout(to);
    if (r.ok) { const j = await r.json(); if (j && j.ok && j.bases && j.bases.male && j.bases.female) MAN = j; } } catch (e) { } return MAN; })();
  return manP;
}
export const avatarArtSource = () => MAN ? 'api ' + MAN.version : 'bundled';
const bundled = (base, file) => V5() + base + '/' + file + '.webp';
// [primary url, bundled fallback] for a layer
function layerUrls(base, which, id) {
  base = base === 'female' ? 'female' : 'male';
  const b = MAN && MAN.bases[base];
  if (!id) { const f = which + '-body'; return [b ? b.body[which] : null, bundled(base, f)]; }
  const p = b && b.pieces[id]; return [p ? p.url : null, bundled(base, V5_FILES[id])];
}
const imgCache = new Map();
function loadImg(urls) {
  const key = urls.join('|'); if (imgCache.has(key)) return imgCache.get(key);
  const pr = new Promise((res) => { const list = urls.filter(Boolean); let i = 0; const next = () => { if (i >= list.length) return res(null); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => { i++; next(); }; im.src = list[i]; }; next(); });
  imgCache.set(key, pr); return pr;
}
/** Which pieces the v5 portrait draws (mirrors the manifest order exactly); also drives the in-world 3D figure. */
export function visibleFor(top, outer, legs) { return { upper: gearById(outer ?? top), lower: gearById(legs) }; }
/** Composite the v5 portrait for a base + fit -> data URL (540x720 PNG). */
export async function composeLook(base, fit) {
  await loadAvatarManifest(); const v = visibleFor(fit && fit.top, fit && fit.outer, fit && fit.legs);
  const [lo, up] = await Promise.all([loadImg(layerUrls(base, 'lower', v.lower && v.lower.id)), loadImg(layerUrls(base, 'upper', v.upper && v.upper.id))]);
  const c = document.createElement('canvas'); c.width = 540; c.height = 720; const g = c.getContext('2d');
  if (lo) g.drawImage(lo, 0, 0, 540, 720); if (up) g.drawImage(up, 0, 0, 540, 720);
  try { return c.toDataURL('image/png'); } catch (e) { return up ? up.src : ''; }
}
/** Wardrobe icon: manifest icon if loaded, else the bundled v5 copy. */
export const iconFor = (id) => { const p = gearById(id); const m = MAN && MAN.pieces[id]; return m ? m.icon : V5() + 'icons/' + (p ? p.icon : 'icon-tee') + '.webp'; };
export const iconFallback = (id) => { const p = gearById(id); return V5() + 'icons/' + (p ? p.icon : 'icon-tee') + '.webp'; };
// starter fit comes from crew_config.wardrobe.starter_fit
export const DEFAULT_FIT = CREW_RULES.STARTER_FIT;
/** Current crew level: signed out / not loaded = SIGNED_OUT_LEVEL; otherwise from Crew XP (read-only). */
export const playerLevel = (xp) => xp == null ? CREW_RULES.SIGNED_OUT_LEVEL : levelFor(xp);
/** Strip any piece above the player's level (e.g. a saved try-on fit from before the rule). */
export const allowedFit = (fit, lvl) => { const o = { ...EMPTY_FIT }; for (const k of ['top', 'outer', 'legs']) { const p = gearById(fit && fit[k]); o[k] = p && p.level <= lvl ? p.id : null; } return o; };
export function loadFit() { try { const f = JSON.parse(localStorage.getItem('rw.fit') || 'null'); if (f && 'top' in f) return f; } catch (e) { } return { ...CREW_RULES.STARTER_FIT }; }
export const saveFit = (f) => localStorage.setItem('rw.fit', JSON.stringify(f));
/** Tap behaviour from crew.tsx: tap an unlocked piece to equip it in its slot, tap again to remove. */
export const toggle = (fit, piece) => ({ ...fit, [piece.slot]: fit[piece.slot] === piece.id ? null : piece.id });
// ---- signed-in crew (same endpoints the app uses; read-only) ----
export const getAccount = () => { try { return JSON.parse(localStorage.getItem('rw.crewAccount') || 'null'); } catch (e) { return null; } };
// APP DEV auth: POST /api/auth/request {email, pin?} -> {ok,email,token} (30-day bearer). 426 UPDATE_APP = this account needs a PIN.
const DAY30 = 30 * 864e5;
/** Same storage for both routes in: the wardrobe sign-in and the app's #token= handoff (embed.js). */
export const storeAccount = ({ token, email = '', via = null }) => { const a = { token, email: email || '', exp: Date.now() + DAY30, ...(via ? { via } : {}) }; localStorage.setItem('rw.crewAccount', JSON.stringify(a)); return a; };
export async function signIn(email, pin) {
  const body = { email }; if (pin) body.pin = String(pin).trim();
  const r = await fetch(API + '/api/auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const p = await r.json().catch(() => ({}));
  if (r.status === 426) throw new Error(pin ? 'PIN_WRONG' : 'PIN');
  if (r.status === 429) throw new Error('RATE');
  if (!r.ok || typeof p.token !== 'string') throw new Error(r.status === 401 || r.status === 403 ? (pin ? 'PIN_WRONG' : 'EMAIL') : (p.error || 'EMAIL'));
  return storeAccount({ token: p.token, email: p.email || email });
}
/** GET /api/auth/me with the stored bearer. 'ok' | 'expired' (401: sign in again) | 'offline' (keep the account, try later) */
export async function authMe(acct = getAccount()) {
  if (!acct) return 'expired'; if (acct.exp && Date.now() > acct.exp) return 'expired';
  try { const r = await fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + acct.token }, cache: 'no-cache' }); if (r.status === 401) return 'expired'; return r.ok ? 'ok' : 'offline'; } catch (e) { return 'offline'; }
}
export const signOut = () => localStorage.removeItem('rw.crewAccount');
export async function readCrew(acct = getAccount()) {
  if (!acct) return null;
  const r = await fetch(API + '/api/crew', { headers: { Authorization: 'Bearer ' + acct.token } });
  if (!r.ok) return null; const p = await r.json(); const f = p.fit || {};
  return { xp: Math.max(0, Math.floor(Number(p.xp) || 0)), fit: { top: f.top ?? null, outer: f.outer ?? null, legs: f.legs ?? null } };
}

/** Apply a crew_config (v1) in place: rank thresholds, wardrobe unlock levels, starter fit, game XP rules. */
export function applyCrewConfig(c, source) {
  if (!c || c.schema !== 'reckless-crew-config/v1') return false;
  const lv = (c.levels || []).slice().sort((a, b) => a.level - b.level).map(l => Number(l.xp_to_enter));
  if (lv.length && lv.every(Number.isFinite)) { CREW_RULES.RANKS.length = 0; CREW_RULES.RANKS.push(...lv); }
  const items = (c.wardrobe && c.wardrobe.items) || [];
  for (const it of items) { const p = gearById(it.id); if (p && Number.isFinite(Number(it.unlock_level))) p.level = Number(it.unlock_level); }
  const sf = c.wardrobe && c.wardrobe.starter_fit; if (sf) for (const k of ['top', 'outer', 'legs']) CREW_RULES.STARTER_FIT[k] = sf[k] ?? null;
  const g = c.xp_rates && c.xp_rates.game; if (g) { CREW_RULES.GAME.weekly_cap_xp = g.weekly_cap_xp ?? CREW_RULES.GAME.weekly_cap_xp; if (g.digital_rave_attended) CREW_RULES.GAME.rave = { ...CREW_RULES.GAME.rave, ...g.digital_rave_attended }; if (g.poster_placed) CREW_RULES.GAME.poster = { ...CREW_RULES.GAME.poster, ...g.poster_placed }; }
  CREW_RULES.source = source; CREW_RULES.status = c.status || null; CREW_RULES.updated_at = c.updated_at || null; return true;
}
export async function loadCrewConfig() {
  const get = async (url, ms) => { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms); try { const r = await fetch(url, { signal: ac.signal, cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (e) { return null; } finally { clearTimeout(t); } };
  const live = await get(API + '/api/crew/config', 2500); if (applyCrewConfig(live, 'api')) return CREW_RULES;
  const local = await get(import.meta.env.BASE_URL + 'data/crew_config.json', 5000); applyCrewConfig(local, 'bundled'); return CREW_RULES;
}

// ---- avatar base (MALE / FEMALE) ----
// Signed in: APP DEV's crew API owns the choice, GET /api/crew/avatar-base?email= -> {"avatarBase":"male"|"female"}.
// The game only reads it (never PUTs). Signed out, offline or no answer: the local pick from the first-launch select.
export const BASES = ['male', 'female'];
export const getLocalBase = () => { const b = localStorage.getItem('rw.avatarBase'); return BASES.includes(b) ? b : null; };
export const setLocalBase = (b) => { if (BASES.includes(b)) localStorage.setItem('rw.avatarBase', b); };
export async function readAvatarBase(acct = getAccount(), ms = 6000) {
  if (!acct || !acct.email) return null;
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(API + '/api/crew/avatar-base?email=' + encodeURIComponent(acct.email), { signal: ac.signal, cache: 'no-cache' }); if (!r.ok) return null;
    const p = await r.json(); return BASES.includes(p && p.avatarBase) ? p.avatarBase : null; } catch (e) { return null; } finally { clearTimeout(t); }
}
