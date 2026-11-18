// 1:1 port of the Reckless Raves app crew wardrobe (rr-ios-src/data/crew.ts):
// same Drop 018 pieces, slots, unlock levels, renders and lookFor() logic.
// Renders are the app's own avatar3d/looks PNGs (re-encoded to WebP, lazy-loaded).
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
// col = colour sampled from the app render for the in-world 3D figure; kind = which 3D garment shape.
const W = (id, name, slot, level, icon, look, withJeans, col, kind) => ({ id, name, slot, level, icon, look, withJeans, col, kind });
export const WARDROBE = [
  W('skate-tee', 'SKATE TEE', 'top', 2, 'icon-tee', 'tee', 'tee-jeans', '#201e23', 'tee'),
  W('rckls-tee', 'RCKLS TEE', 'top', 3, 'icon-rckls-tee', 'rckls-tee', 'rckls-tee', '#161618', 'tee'),
  W('see-me-shorts', 'SEE ME SHORTS', 'legs', 3, 'icon-see-shorts', 'see-shorts', null, '#727274', 'shorts'),
  W('deject-sleeve', 'DEJECT SLEEVE', 'top', 4, 'icon-deject', 'deject', 'deject-jeans', '#242227', 'long'),
  W('barrel-jeans', 'BARREL JEANS', 'legs', 5, 'icon-jeans', 'jeans', null, '#6a819f', 'jeans'),
  W('moltin-tee', 'MOLTIN TEE', 'top', 5, 'icon-moltin', 'moltin', 'moltin', '#e1dfe6', 'tee'),
  W('stripped-tee', 'STRIPPED TEE', 'top', 6, 'icon-stripped', 'stripped', 'stripped', '#151517', 'tee'),
  W('seasoned-pants', 'SEASONED PANTS', 'legs', 6, 'icon-seasoned-pants', 'seasoned-pants', null, '#131315', 'pants'),
  W('seasoned-hoodie', 'SEASONED HOODIE', 'outer', 7, 'icon-hoodie', 'hoodie', 'hoodie-jeans', '#1e1d23', 'hoodie'),
  W('isometric-tee', 'ISOMETRIC TEE', 'top', 8, 'icon-isometric', 'isometric', 'isometric', '#e1e0e8', 'tee'),
  W('artillery', 'ARTILLERY CARGOS', 'legs', 8, 'icon-artillery', 'artillery', null, '#110f12', 'pants'),
  W('ultra-tee', 'ULTRA TEE', 'top', 9, 'icon-ultra', 'ultra', 'ultra', '#161618', 'tee'),
  W('stan-bottoms', 'STAN BOTTOMS', 'legs', 9, 'icon-stan-bottoms', 'stan-bottoms', null, '#141416', 'cuffed'),
  W('rawdwg-zip', 'RAWDWG ZIP', 'outer', 10, 'icon-zip', 'zip', 'zip-jeans', '#1a1a1f', 'hoodie'),
  W('pinner-tee', 'PINNER TEE', 'top', 11, 'icon-pinner', 'pinner', 'pinner', '#171717', 'tee'),
  W('rawdawg-shorts', 'RAWDWG SHORTS', 'legs', 11, 'icon-raw-shorts', 'raw-shorts', null, '#161616', 'shorts'),
  W('distress-shirt', 'DISTRESS SHIRT', 'top', 12, 'icon-distress', 'distress', 'distress', '#37363a', 'long'),
  W('manager-shorts', 'MANAGER SHORTS', 'legs', 12, 'icon-manager-shorts', 'manager-shorts', null, '#5f6f8d', 'shorts'),
  W('manager-zip', 'MANAGER ZIP', 'outer', 13, 'icon-manager', 'manager', 'manager-jeans', '#7e93be', 'long'),
  W('see-me-crop', 'SEE ME CROP', 'top', 14, 'icon-crop', 'crop', 'crop', '#87858a', 'tee'),
  W('stan-hoodie', 'STAN HOODIE', 'outer', 14, 'icon-stan-hoodie', 'stan-hoodie', 'stan-hoodie', '#202022', 'hoodie'),
  W('rcklstv-jersey', 'RCKLSTV JERSEY', 'top', 15, 'icon-jersey', 'jersey', 'jersey', '#dfddde', 'tee'),
  W('mesh-jersey', 'MESH JERSEY', 'top', 15, 'icon-mesh', 'mesh', 'mesh', '#932822', 'tee'),
];
export const EMPTY_FIT = { top: null, outer: null, legs: null };
export const gearById = (id) => (id && WARDROBE.find(p => p.id === id)) || null;
export const img = (name) => B() + name + '.webp';
/** Drop 018 product photo for a wardrobe piece (from the app's shop assets, 256 px webp). */
export const shopImg = (id) => B() + 'shop/' + id + '.webp';
/** Same rule as the app: outer covers top; barrel jeans stay on with a jeans render; other bottoms replace legs. */
export function lookFor(top, outer, legs) {
  const piece = gearById(outer ?? top), leg = gearById(legs);
  if (piece && leg?.id === 'barrel-jeans' && piece.withJeans) return img(piece.withJeans);
  if (piece && leg && leg.id !== 'barrel-jeans') return img(leg.look);
  if (piece) return img(piece.look);
  if (leg) return img(leg.look);
  return img('body');
}
/** Which garments the chosen app render actually shows (mirrors lookFor exactly), for the in-world 3D figure. */
export function visibleFor(top, outer, legs) {
  const piece = gearById(outer ?? top), leg = gearById(legs), jeans = gearById('barrel-jeans');
  if (piece && leg?.id === 'barrel-jeans' && piece.withJeans) return { upper: piece, lower: jeans };
  if (piece && leg) return { upper: null, lower: leg };
  if (piece) return { upper: piece, lower: piece.withJeans === piece.look ? jeans : null };
  return { upper: null, lower: leg };
}
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
export async function signIn(email) {
  const r = await fetch(API + '/api/auth/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  const p = await r.json().catch(() => ({}));
  if (!r.ok || typeof p.token !== 'string') throw new Error(p.error || 'EMAIL');
  const a = { token: p.token, email: p.email }; localStorage.setItem('rw.crewAccount', JSON.stringify(a)); return a;
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
