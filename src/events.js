// Crew game-event client queue. Schema (append-only JSONL, see tools/flush-events.mjs):
//   { event_id, type, email, ts (ISO UTC), test:true }
//   digital_rave_attended: + venue, session_id, dwell_seconds (server-timed; filled by the flusher from enter/exit marks).
//     Only queued once the stay reaches 600 s (shorter visits are not logged by ingest). event_id = wr:<session_id>:<h>
//   poster_placed: event_id = wp:<spot_id>:<h>.  h = sha256(trimmed lowercased email)[:12]. Guest play queues nothing.
//   poster_placed:         + spot_id
// The client NEVER awards XP or codes and never calls the Crew API. It only queues test events locally.
const KEY = 'rw.eventQueue.v1', EMAIL = 'rw.email';
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
export const MIN_DWELL = 600;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));

async function push(type, extra, meta) {
  const email = getEmail(); if (!email) return null; // anonymous free play: nothing is queued
  const h = await emailHash(email);
  const id = type === 'digital_rave_attended' ? `wr:${extra.session_id}:${h}` : `wp:${extra.spot_id}:${h}`;
  const ev = { event_id: id, type, email, ts: isoZ(meta && meta.mark_ts ? new Date(meta.mark_ts) : new Date()), test: true, ...extra };
  const q = queue(); if (q.some(e => e.event_id === ev.event_id)) return null; // idempotent per session/spot
  q.push(meta ? { ...ev, _meta: meta } : ev); save(q); window.dispatchEvent(new CustomEvent('rw-event', { detail: ev })); return ev;
}
let session = null;
export function raveEnter(venue) { session = { venue, session_id: 'temple-' + uid().slice(0, 18), enter_ms: Date.now(), queued: false }; return session; }
export const dwell = () => (session ? (Date.now() - session.enter_ms) / 1000 : 0);
// call every frame while inside: queues the attendance once the stay passes 10 minutes
export async function raveTick() {
  if (!session || session.queued || dwell() < MIN_DWELL) return null; session.queued = true;
  return push('digital_rave_attended', { venue: session.venue, session_id: session.session_id, dwell_seconds: Math.floor(dwell()) }, { enter_ts: isoZ(new Date(session.enter_ms)), mark_ts: isoZ(new Date()) });
}
export async function raveExit() { const ev = await raveTick(); session = null; return ev; }
export async function posterPlaced(spot_id) { return push('poster_placed', { spot_id }); }
export function exportQueue() { // download as JSONL for tools/flush-events.mjs
  const text = queue().map(e => JSON.stringify(e)).join('\n') + '\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/x-ndjson' })); a.download = 'rw-queued-events.jsonl'; a.click();
}
export const clearQueue = () => save([]);
