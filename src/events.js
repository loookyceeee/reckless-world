// Crew game-event client queue. Schema (append-only JSONL, see tools/flush-events.mjs):
//   { event_id, type, email, ts (ISO UTC), test:true }
//   digital_rave_attended: + venue, session_id, dwell_seconds (server-timed; filled by the flusher from enter/exit marks).
//     Only queued once the stay reaches 600 s (shorter visits are not logged by ingest). event_id = wr:<session_id>:<h>
//   poster_placed: ingest event_id = wp:<spot_id>:<h> (rebuilt by the flusher). The local queue id adds :<London day> so a spot
//     whose event hit the cap can be re-sent on a later day (crew_config: over cap = spot not consumed).  h = sha256(trimmed lowercased email)[:12]. Guest play queues nothing.
//   poster_placed:         + spot_id
// The client NEVER awards XP or codes. It queues test events locally; the live crew event routes are wired in crewapi.js behind EVENTS_LIVE (OFF).
import { CREW_RULES } from './crew.js';
import * as CAPI from './crewapi.js'; // live routes, flag OFF (no-ops) until Luke says switch
const KEY = 'rw.eventQueue.v1', EMAIL = 'rw.email', LOG = 'rw.limitLog.v1';
// ---- client-side mirror of the crew game limits (crew_config xp_rates.game). Display/queue hygiene only: the Crew
// server is the authority; the game never awards XP. Per-day local record only: spots are never marked used for good here.
export const londonDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export const isoWeek = (day) => { const [y, m, dd] = day.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, dd)); const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + String(Math.ceil(((t - y0) / 864e5 + 1) / 7)).padStart(2, '0'); };
const log = () => { try { return JSON.parse(localStorage.getItem(LOG) || '[]'); } catch { return []; } };
const xpOf = (type) => type === 'digital_rave_attended' ? CREW_RULES.GAME.rave.xp : CREW_RULES.GAME.poster.xp;
/** null if this event may be queued now, otherwise a short reason for the toast */
export function limitFor(type, email, spot_id) {
  const day = londonDay(), wk = isoWeek(day), L = log().filter(e => e.email === email), G = CREW_RULES.GAME;
  const today = L.filter(e => e.day === day), week = L.filter(e => e.wk === wk);
  if (type === 'poster_placed') { if (today.some(e => e.type === type && e.spot === spot_id)) return 'ALREADY SENT TODAY';
    if (today.filter(e => e.type === type).length >= G.poster.max_per_london_day) return 'DAILY POSTER LIMIT · TRY THIS SPOT ANOTHER DAY'; }
  else { if (today.filter(e => e.type === type).length >= G.rave.max_per_london_day) return 'ONE DIGITAL RAVE A DAY';
    if (week.filter(e => e.type === type).length >= G.rave.max_per_iso_week) return 'TWO DIGITAL RAVES A WEEK'; }
  if (week.reduce((a, e) => a + xpOf(e.type), 0) + xpOf(type) > G.weekly_cap_xp) return 'WEEKLY GAME CAP REACHED · TRY ANOTHER DAY';
  return null;
}
const record = (type, email, spot) => { const day = londonDay(); const L = log().filter(e => e.day >= isoWeekStart(day)); L.push({ type, email, spot: spot || null, day, wk: isoWeek(day) }); localStorage.setItem(LOG, JSON.stringify(L)); };
const isoWeekStart = (day) => { const [y, m, dd] = day.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, dd)); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() || 7) - 1)); return t.toISOString().slice(0, 10); };
export const postedToday = (spot_id) => log().some(e => e.type === 'poster_placed' && e.spot === spot_id && e.day === londonDay() && e.email === getEmail());
export async function emailHash(email) {
  const norm = String(email || '').trim().toLowerCase(); if (!norm) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}
export const getEmail = () => localStorage.getItem(EMAIL) || '';
export const setEmail = (e) => localStorage.setItem(EMAIL, String(e || '').trim().toLowerCase());
export const queue = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const save = (q) => localStorage.setItem(KEY, JSON.stringify(q));
export const isoZ = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
export const MIN_DWELL = 600; // = crew_config game.digital_rave_attended.min_dwell_seconds (server-timed)
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));

async function push(type, extra, meta) {
  const email = getEmail(); if (!email) return null; // anonymous free play: nothing is queued
  const h = await emailHash(email);
  const why = limitFor(type, email, extra.spot_id); if (why) return { blocked: why };
  const id = type === 'digital_rave_attended' ? `wr:${extra.session_id}:${h}` : `wp:${extra.spot_id}:${h}:${londonDay()}`;
  const ev = { event_id: id, type, email, ts: isoZ(meta && meta.mark_ts ? new Date(meta.mark_ts) : new Date()), test: true, ...extra };
  const q = queue(); if (q.some(e => e.event_id === ev.event_id)) return null; // idempotent per session/spot
  q.push(meta ? { ...ev, _meta: meta } : ev); save(q); record(type, email, extra.spot_id); window.dispatchEvent(new CustomEvent('rw-event', { detail: ev })); return ev;
}
let session = null;
export function raveEnter(venue) { CAPI.raveStart(String(venue || 'temple').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 64) || 'temple'); session = { venue, session_id: 'temple-' + uid().slice(0, 18), enter_ms: Date.now(), queued: false }; return session; }
export const dwell = () => (session ? (Date.now() - session.enter_ms) / 1000 : 0);
// call every frame while inside: queues the attendance once the stay passes 10 minutes
export async function raveTick() {
  if (!session || session.queued || dwell() < MIN_DWELL) return null; session.queued = true;
  return push('digital_rave_attended', { venue: session.venue, session_id: session.session_id, dwell_seconds: Math.floor(dwell()) }, { enter_ts: isoZ(new Date(session.enter_ms)), mark_ts: isoZ(new Date()) });
}
export async function raveExit() { CAPI.raveFinish(); const ev = await raveTick(); session = null; return ev; }
export async function posterPlaced(spot_id) { CAPI.posterPlaced(String(spot_id)); return push('poster_placed', { spot_id }); }
export function exportQueue() { // download as JSONL for tools/flush-events.mjs
  const text = queue().map(e => JSON.stringify(e)).join('\n') + '\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/x-ndjson' })); a.download = 'rw-queued-events.jsonl'; a.click();
}
export const clearQueue = () => save([]);
