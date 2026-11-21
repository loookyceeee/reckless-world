// Crew event client for the live APP DEV routes (deployed 61e9f1f). LIVE since 21 Nov 2026 (Luke, 12:47: 'Turn everyone on, app is finished too';
// crew_config status live, XP from 2026-11-21T00:00:00Z). Signed-in players' visits and posters go to the Crew server, which alone decides XP.
// The game never sends XP amounts; the server decides recorded/counted (reason DAILY_CAP | WEEKLY_CAP | DUPLICATE).
//   POST /api/crew/events/rave/start  {raveId}     -> {ok, sessionId, minSeconds:600, startedAt}
//   POST /api/crew/events/rave/finish {sessionId}  -> {ok, recorded, counted, reason?} | 409 TOO_SOON {remainingSeconds} (session stays open) | 404 SESSION_NOT_FOUND
//   POST /api/crew/events {type:'poster_placed', posterId}
//   GET  /api/crew/events/me -> today / week counts
// 401 SESSION = sign in again; 429 RATE = back off (server limit 30 per email per 10 min; we self-limit to 20).
import { API, getAccount } from './crew.js';
export const EVENTS_LIVE = true; // live (crew_config status: live). Sends event types + ids only, never XP amounts. Guests send nothing.
const ID = /^[A-Za-z0-9_.:-]{1,64}$/;
export const validId = (s) => typeof s === 'string' && ID.test(s);
const sent = []; let backoffUntil = 0; const WIN = 600e3, MAX = 20;
export const status = { lastError: null, needsSignIn: false };
async function call(method, path, body) {
  if (!EVENTS_LIVE) return { skipped: 'FLAG_OFF' };
  const a = getAccount(); if (!a) return { skipped: 'SIGNED_OUT' };
  const now = Date.now(); while (sent.length && now - sent[0] > WIN) sent.shift();
  if (now < backoffUntil || sent.length >= MAX) return { skipped: 'RATE' };
  sent.push(now);
  try {
    const r = await fetch(API + path, { method, headers: { Authorization: 'Bearer ' + a.token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const p = await r.json().catch(() => ({}));
    if (r.status === 401) { status.needsSignIn = true; window.dispatchEvent(new CustomEvent('rw-signin-needed')); }
    if (r.status === 429) backoffUntil = Date.now() + 120e3;
    if (!r.ok) status.lastError = p.error || String(r.status);
    return { status: r.status, ...p };
  } catch (e) { status.lastError = 'OFFLINE'; return { status: 0, error: 'OFFLINE' }; }
}
let rave = null, retryT = 0;
export async function raveStart(raveId) {
  if (!validId(raveId)) return { skipped: 'BAD_ID' };
  const r = await call('POST', '/api/crew/events/rave/start', { raveId });
  if (r && r.sessionId && validId(r.sessionId)) rave = { sessionId: r.sessionId, startedMs: Date.now(), minSeconds: r.minSeconds || 600 };
  return r;
}
/** Finish the open session. 409 TOO_SOON keeps it open and retries once after remainingSeconds; 404 drops it. */
export async function raveFinish() {
  if (!rave) return { skipped: 'NO_SESSION' };
  const r = await call('POST', '/api/crew/events/rave/finish', { sessionId: rave.sessionId });
  if (r.status === 409 && r.remainingSeconds > 0) { clearTimeout(retryT); const s = rave; retryT = setTimeout(() => { if (rave === s) raveFinish(); }, Math.min(900, r.remainingSeconds + 2) * 1000); return r; }
  if (r.status === 404 || r.ok) rave = null;
  return r;
}
export const posterPlaced = (posterId) => validId(posterId) ? call('POST', '/api/crew/events', { type: 'poster_placed', posterId }) : Promise.resolve({ skipped: 'BAD_ID' });
export const eventsMe = () => call('GET', '/api/crew/events/me');
export const openSession = () => rave;
/** Player left before 10 minutes: forget the open session (no finish, no late retry after they've gone). */
export const raveDrop = () => { clearTimeout(retryT); rave = null; };
