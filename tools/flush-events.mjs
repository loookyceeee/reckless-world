#!/usr/bin/env node
// Append queued RECKLESS WORLD test events to the Crew loyalty game-events log (local testing only).
// Usage: node tools/flush-events.mjs rw-queued-events.jsonl [--out /home/box/shared/reckless-crew/game_events.jsonl] [--dry]
// - Input: JSONL exported from the game (Credits > EXPORT TEST EVENTS) or the localStorage queue.
// - dwell_seconds is "server-timed": recomputed here from the queue's _meta enter/mark times; visits under 600 s are dropped.
// - event_id is rebuilt to the ingest format: wr:<session_id>:<h> / wp:<spot_id>:<h>, h = sha256(normalised email)[:12].
// - Appends complete lines only (each ends with \n); never rewrites or truncates the queue file.
// - Enforces test:true on everything. Never calls the Crew API, never awards XP or codes.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const args = process.argv.slice(2); const inFile = args.find(a => !a.startsWith('--'));
const out = (args.includes('--out') ? args[args.indexOf('--out') + 1] : null) || '/home/box/shared/reckless-crew/game_events.jsonl';
const dry = args.includes('--dry');
if (!inFile) { console.error('usage: node tools/flush-events.mjs <queued.jsonl> [--out path] [--dry]'); process.exit(1); }
const hash12 = (e) => crypto.createHash('sha256').update(String(e).trim().toLowerCase()).digest('hex').slice(0, 12);
const BASE = ['event_id', 'type', 'email', 'ts', 'test'];
const EXTRA = { digital_rave_attended: ['venue', 'session_id', 'dwell_seconds'], poster_placed: ['spot_id'] };
// dedupe key: event_id, plus the London day for posters (crew_config: a poster over the daily/weekly cap does not consume the
// spot and may be re-sent with the same event_id on a later day; ingest decides)
const lday = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(ts));
const dkey = (o) => o.type === 'poster_placed' ? o.event_id + '@' + lday(o.ts) : o.event_id;
const existing = new Set(fs.existsSync(out) ? fs.readFileSync(out, 'utf8').split('\n').filter(Boolean).map(l => { try { return dkey(JSON.parse(l)); } catch { return null; } }) : []);
const lines = fs.readFileSync(inFile, 'utf8').split('\n').filter(Boolean); const outLines = []; let skipped = 0;
for (const l of lines) {
  let e; try { e = JSON.parse(l); } catch { skipped++; continue; }
  if (!EXTRA[e.type]) { skipped++; continue; }
  const email = String(e.email || '').trim().toLowerCase(); if (!email) { skipped++; continue; }
  const o = { event_id: e.event_id, type: e.type, email, ts: e.ts || new Date().toISOString(), test: true };
  if (e.type === 'digital_rave_attended') {
    const m = e._meta || {}; const d = Math.floor((Date.parse(m.mark_ts || m.exit_ts) - Date.parse(m.enter_ts)) / 1000);
    if (!Number.isFinite(d) || d < 600) { skipped++; continue; } // ingest ignores < 600 s; same session can be re-sent later
    Object.assign(o, { venue: e.venue, session_id: e.session_id, dwell_seconds: d });
    o.event_id = `wr:${e.session_id}:${hash12(email)}`;
  } else { o.spot_id = e.spot_id; o.event_id = `wp:${e.spot_id}:${hash12(email)}`; }
  o.ts = new Date(Date.parse(o.ts)).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const ordered = Object.fromEntries([...BASE, ...EXTRA[e.type]].map(k => [k, o[k]]));
  if (existing.has(dkey(ordered))) { skipped++; continue; }
  existing.add(dkey(ordered)); outLines.push(JSON.stringify(ordered));
}
if (dry) { console.log(outLines.join('\n')); console.error(`[dry] ${outLines.length} event(s) would be appended to ${out}; ${skipped} skipped`); process.exit(0); }
if (outLines.length) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.appendFileSync(out, outLines.join('\n') + '\n'); }
console.log(`appended ${outLines.length} test event(s) to ${out}; ${skipped} skipped (dupes/invalid)`);
