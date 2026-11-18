// Stage 8 activities (research/game-design.md 2.4, 2.5, 1.9; build plan items 6 + 7): POSTER RUN with HEAT / patrol evades,
// and FLYER DELIVERY (route + clock). State machine per activity: idle | intro | running | done | failed.
// Rules kept: events only via the existing EV contract (poster once per spot per day, test:true), never an XP grant in copy,
// fail words are SEEN / MOVE ON (not GTA's), no attack verb, patrols cut off rather than ram, original two-tone (no sample).
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const HIDE = [0, 25, 35, 50]; // seconds unseen to clear heat, by level
export function createMissions(ctx) {
  // ctx: { hud, P, app, posters: [{id, name, ix, iz}], isDone(ps), traffic, grid(), route(ax,az,bx,bz), setDest(d|null), text(m), buzz,
  //        siren(), relocate(), pickup: {x,z}, drops: [{id,name,x,z}], inside() }
  const { hud, P } = ctx;
  const H = { level: 0, inView: 0, hidden: 0, chasers: [], lastSeen: null, caughtT: 0, flash: 0, seenRun: false };
  const PR = { state: 'idle', t0: 0, queued: 0, blocked: '', n0: 0 };
  const FD = { state: 'idle', left: 0, total: 0, done: [], t0: 0, warned: 0, best: +localStorage.getItem('rw.flyerBest') || 0 };
  let tNow = 0;
  const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const patrols = () => ctx.traffic.cars.filter(c => c.patrol && c.node.isEnabled());
  const los = (c) => ctx.grid().raycast(c.node.position.x, c.node.position.z, P.x, P.z, 1.4) >= 1;
  const coneSees = (c, R = 28, half = 20) => { const dx = P.x - c.node.position.x, dz = P.z - c.node.position.z, d = Math.hypot(dx, dz); if (d > R) return false;
    const h = c.node.rotation.y, a = Math.acos(Math.max(-1, Math.min(1, (dx * Math.sin(h) + dz * Math.cos(h)) / Math.max(d, 1e-3)))) * 180 / Math.PI; return a <= half && los(c); };
  const anySees = () => !ctx.inside() && patrols().some(c => coneSees(c) || (H.level > 0 && near(c.node.position, P) < 40 && los(c)));
  // ---------- heat ----------
  function raise(to, why) {
    to = to || H.level + 1; if (to <= H.level) return; const first = H.level === 0; H.level = Math.min(3, to); H.hidden = 0; H.inView = 0; H.flash = 0.18; H.seenRun = true;
    ctx.buzz([30, 40, 30, 40, 60]); ctx.siren();
    hud.note({ kicker: 'HEAT', title: first ? 'SEEN · MOVE ON' : 'HEAT ' + H.level, body: why || (first ? 'A patrol clocked you. Break line of sight and lie low.' : 'More patrols on you. Get off the main roads.'), type: 'heat' });
    const want = H.level >= 2 ? 2 : 1; const free = patrols().filter(c => !c.chase).sort((a, b) => near(a.node.position, P) - near(b.node.position, P));
    while (H.chasers.length < want && free.length) { const c = free.shift(); c.chase = { path: null, rt: 0, i: 0 }; H.chasers.push(c); }
  }
  function clearHeat(quiet) {
    for (const c of H.chasers) { c.chase = null; ctx.traffic.placeCar && ctx.traffic.placeCar(c, P); }
    H.chasers = []; const was = H.level; H.level = 0; H.inView = 0; H.hidden = 0; H.caughtT = 0;
    if (was && !quiet) hud.note({ kicker: 'HEAT', title: 'LOST THEM', body: 'Heat cleared. Carry on.' });
  }
  function driveChasers(dt) {
    const sp = [0, 9, 11.5, 13][H.level];
    for (const c of H.chasers) { const ch = c.chase, n = c.node.position; const tgt = H.hidden > 0 && H.lastSeen ? H.lastSeen : P;
      ch.rt -= dt; if (ch.rt <= 0 || !ch.path) { ch.rt = 1.0; ch.path = ctx.route(n.x, n.z, tgt.x, tgt.z) || null; ch.i = 1; }
      let gx = tgt.x, gz = tgt.z, v = sp;
      const dP = Math.hypot(tgt.x - n.x, tgt.z - n.z);
      if (ch.path && ch.path.length > 1 && dP > 12) { while (ch.i < ch.path.length - 1 && Math.hypot(ch.path[ch.i][0] - n.x, ch.path[ch.i][1] - n.z) < 3) ch.i++; gx = ch.path[ch.i][0]; gz = ch.path[ch.i][1]; }
      else v = Math.min(sp, Math.max(0, dP - 3.0) * 2.2); // cut off and stop beside the player, never ram
      if (H.hidden > 0 && dP < 6) v = 0;
      const dx = gx - n.x, dz = gz - n.z, d = Math.hypot(dx, dz) || 1; const h = Math.atan2(dx, dz); let dh = h - c.heading; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
      c.heading += dh * Math.min(1, dt * 4); c.node.rotation.y = c.heading; c.speed = v; const step = Math.min(d, v * dt); n.x += Math.sin(c.heading) * step; n.z += Math.cos(c.heading) * step; }
  }
  function updateHeat(dt) {
    H.flash = Math.max(0, H.flash - dt);
    if (H.level === 0) return;
    const inside = ctx.inside(); const seen = !inside && H.chasers.concat(patrols()).some(c => near(c.node.position, P) < 40 && los(c));
    if (seen) { H.inView += dt; H.hidden = 0; H.lastSeen = { x: P.x, z: P.z };
      if (H.level === 1 && H.inView > 8) raise(2, 'Still in view. A second car is on you.');
      else if (H.level === 2 && H.inView > 20) raise(3, 'They are closing the main roads. Lose them in the side streets.'); }
    else { H.inView = 0; H.hidden += inside ? dt * (H.hidden > 4 ? 6 : 1) : dt; if (H.hidden >= HIDE[H.level]) return clearHeat(); }
    driveChasers(dt);
    // caught: a patrol within 3 m (stopped beside you) for 1.2 s
    if (!inside && H.chasers.some(c => near(c.node.position, P) < 3.7)) { H.caughtT += dt; if (H.caughtT > 1.2) caught(); } else H.caughtT = Math.max(0, H.caughtT - dt);
  }
  function caught() {
    const wasRun = PR.state === 'running', wasFly = FD.state === 'running';
    clearHeat(true); ctx.buzz([40, 60, 80]);
    hud.stamp({ title: 'SEEN', sub: wasRun ? 'POSTER RUN' : wasFly ? 'FLYER DELIVERY' : 'MOVED ON', lines: wasRun ? ['POSTERS IN HAND LOST', 'WALLS ALREADY UP STAY UP'] : wasFly ? ['FLYERS LOST'] : ['MOVED ON TO CARLISLE CIRCUS'], fail: true });
    setTimeout(() => ctx.relocate(), 900);
    if (wasRun) fail('pr'); if (wasFly) fail('fd');
  }
  // ---------- poster run ----------
  const left = () => ctx.posters.filter(p => !ctx.isDone(p));
  const nextWall = () => { const L = left(); if (!L.length) return null; return L.sort((a, b) => Math.hypot(a.ix - P.x, a.iz - P.z) - Math.hypot(b.ix - P.x, b.iz - P.z))[0]; };
  function routeNext() { const w = nextWall(); if (w) ctx.setDest({ x: w.ix, z: w.iz, label: 'POSTER · ' + w.name, kind: 'waypoint', mission: true }); return w; }
  function startPosterRun() {
    if (PR.state === 'running' || PR.state === 'intro') { hud.toast('POSTER RUN ALREADY ON'); return false; }
    if (FD.state === 'running' || FD.state === 'pickup') { hud.toast('FINISH THE FLYER DROP FIRST'); return false; }
    if (!left().length) { hud.note({ title: 'ALL WALLS UP TODAY', body: 'Every wall has a poster. Come back tomorrow (walls reset at midnight, London time).' }); return false; }
    PR.state = 'intro'; PR.queued = 0; PR.blocked = ''; PR.nb = 0; PR.t0 = tNow; PR.n0 = ctx.posters.length - left().length; H.seenRun = false;
    hud.mtitle({ kicker: 'NEW ACTIVITY · HEAT RISK', title: 'POSTER RUN', red: true });
    setTimeout(() => { if (PR.state !== 'intro') return; PR.state = 'running'; routeNext(); }, 2600);
    return true;
  }
  function onPaste(ps, ev) {
    // patrol in view of the paste raises heat (twice while seen = heat 2)
    if (!ctx.inside() && patrols().some(c => coneSees(c))) raise(H.level >= 1 ? 2 : 1, 'Pasting in front of a patrol. Move on, now.');
    if (PR.state !== 'running') return false;
    if (ev && !ev.blocked) PR.queued++; else if (ev && ev.blocked) { PR.blocked = ev.blocked; PR.nb++; }
    const w = routeNext();
    if (!w) {
      PR.state = 'done'; ctx.setDest(null); const tot = ctx.posters.length;
      const lines = [`POSTERS ${tot} / ${tot}`]; if (PR.queued) lines.push(`TEST EVENT QUEUED × ${PR.queued}`); if (PR.nb) lines.push(`${PR.nb} OVER TODAY'S LIMIT · NOT QUEUED`); if (!PR.queued && !PR.nb) lines.push('SIGN IN WITH YOUR CREW EMAIL TO QUEUE POSTER EVENTS'); lines.push(`TIME ${fmt(tNow - PR.t0)}`);
      if (!H.seenRun) lines.push('UNSEEN ✓');
      hud.stamp({ title: 'WALLS DONE', sub: 'POSTER RUN', lines });
    } else hud.toast(`POSTER UP · ${ctx.posters.length - left().length} / ${ctx.posters.length}${ev && !ev.blocked ? ' · TEST EVENT QUEUED' : ''}`);
    return true;
  }
  function fail(which) {
    if (which === 'pr') { PR.state = 'failed'; ctx.setDest(null);
      setTimeout(() => ctx.text({ title: 'RETRY THE POSTER RUN?', body: `${left().length} walls still need a poster. Tap to go again.`, act: () => startPosterRun() }), 5600); }
    if (which === 'fd') { FD.state = 'failed'; ctx.setDest(null);
      setTimeout(() => ctx.text({ title: 'RETRY THE FLYER DROP?', body: 'Fresh bundle at the Temple door. Tap to go again.', act: () => startFlyers() }), 5600); }
  }
  function cancel(which) {
    if (which === 'pr' && (PR.state === 'running' || PR.state === 'intro')) { PR.state = 'idle'; ctx.setDest(null); hud.note({ title: 'POSTER RUN CANCELLED', body: 'Walls already up stay up.' }); }
    if (which === 'fd' && (FD.state === 'running' || FD.state === 'pickup')) { FD.state = 'idle'; ctx.setDest(null); hud.note({ title: 'FLYER DROP CANCELLED', body: 'Bundle back at the Temple door.' }); }
  }
  // ---------- flyer delivery ----------
  const dropsLeft = () => ctx.drops.filter(d => !FD.done.includes(d.id));
  function routeDrop() { const L = dropsLeft().sort((a, b) => near(a, P) - near(b, P)); if (L[0]) ctx.setDest({ x: L[0].x, z: L[0].z, label: 'DROP · ' + L[0].name, kind: 'waypoint', mission: true }); return L[0]; }
  function startFlyers() {
    if (PR.state === 'running' || PR.state === 'intro') { hud.toast('FINISH THE POSTER RUN FIRST'); return false; }
    if (FD.state === 'running' || FD.state === 'pickup') { hud.toast('FLYER DROP ALREADY ON'); return false; }
    FD.state = 'pickup'; FD.done = [];
    hud.mtitle({ kicker: 'NEW ACTIVITY', title: 'FLYER DELIVERY' });
    setTimeout(() => ctx.setDest({ x: ctx.pickup.x, z: ctx.pickup.z, label: 'PICK UP FLYERS', kind: 'waypoint', mission: true }), 2600);
    return true;
  }
  function pickUp() {
    FD.state = 'running'; FD.done = [];
    // clock from a nearest-neighbour tour of the drops at a mostly-sprinted pace (road factor 1.3, 6 m/s), +40 s grace; the rapid bus counts
    let at = { x: P.x, z: P.z }, L = ctx.drops.slice(), dist = 0; while (L.length) { L.sort((a, b) => near(a, at) - near(b, at)); dist += near(L[0], at); at = L.shift(); }
    FD.total = Math.round((dist * 1.3 / 6.0 + 40) / 5) * 5; FD.left = FD.total; FD.t0 = tNow; ctx.buzz([20, 40, 20]);
    hud.toast('FLYERS IN HAND · ' + fmt(FD.total)); routeDrop();
  }
  function drop(d) {
    FD.done.push(d.id); ctx.buzz([20, 40, 20]);
    if (!dropsLeft().length) {
      FD.state = 'done'; ctx.setDest(null); const used = tNow - FD.t0, best = !FD.best || used < FD.best; if (best) { FD.best = used; localStorage.setItem('rw.flyerBest', String(Math.round(used))); }
      hud.stamp({ title: 'DROPS DONE', sub: 'FLYER DELIVERY', lines: [`DROPS ${ctx.drops.length} / ${ctx.drops.length}`, `TIME ${fmt(used)}${best ? ' · NEW BEST' : ' · BEST ' + fmt(FD.best)}`, 'PRACTICE RUN · NO CREW EVENT'] });
    } else { hud.toast(`FLYERS DROPPED · ${FD.done.length} / ${ctx.drops.length}`); routeDrop(); }
  }
  // ---------- per frame ----------
  return {
    H, PR, FD, startPosterRun, startFlyers, cancel, onPaste, caught, clearHeat, raise, pickup: ctx.pickup, drops: ctx.drops,
    active: () => PR.state === 'running' || PR.state === 'intro' ? 'pr' : (FD.state === 'running' || FD.state === 'pickup') ? 'fd' : null,
    update(dt) {
      tNow += dt; updateHeat(dt);
      if (FD.state === 'running') { FD.left -= dt;
        if (P.speed > 4.5 && tNow - FD.warned > 20 && patrols().some(c => near(c.node.position, P) < 20 && los(c))) { FD.warned = tNow; hud.note({ kicker: 'HEAT', title: 'EASY', body: "You're carrying. Walk past patrols, don't sprint.", type: 'heat' }); }
        if (FD.left <= 0) { FD.state = 'failed'; ctx.setDest(null); hud.stamp({ title: 'MOVE ON', sub: 'FLYER DELIVERY', lines: ['OUT OF TIME', `DROPS ${FD.done.length} / ${ctx.drops.length}`], fail: true }); fail('fd'); } }
    },
    interact() {
      if (FD.state === 'pickup' && near(ctx.pickup, P) < 3) return { label: '<b>E</b> PICK UP THE FLYER BUNDLE', act: pickUp };
      if (FD.state === 'running') { const d = dropsLeft().find(d => near(d, P) < 3.6); if (d) return { label: `<b>E</b> DROP FLYERS · ${d.name}`, act: () => drop(d) }; }
      return null;
    },
    objective() {
      if (PR.state === 'running') { const w = nextWall(), n = ctx.posters.length - left().length; return `PASTE ${n} / ${ctx.posters.length}${w ? `<br>${w.name} <b>${Math.round(Math.hypot(w.ix - P.x, w.iz - P.z))}M</b>` : ''}`; }
      if (FD.state === 'pickup') return `PICK UP FLYERS<br>TEMPLE DOOR <b>${Math.round(near(ctx.pickup, P))}M</b>`;
      if (FD.state === 'running') { const L = dropsLeft().sort((a, b) => near(a, P) - near(b, P)); return `DROP ${FD.done.length} / ${ctx.drops.length} · <span class="${FD.left < 30 ? 'red' : ''}">${fmt(FD.left)}</span>${L[0] ? `<br>${L[0].name} <b>${Math.round(near(L[0], P))}M</b>` : ''}`; }
      return null;
    },
    // minimap: during an activity or heat every patrol within 150 m shows its view cone; chasers always show
    blips: () => { const on = H.level > 0 || PR.state === 'running' || PR.state === 'intro' || FD.state === 'running';
      if (!on) return []; return patrols().filter(c => c.chase || near(c.node.position, P) < 150).map(c => ({ x: c.node.position.x, z: c.node.position.z, h: c.node.rotation.y, cone: !c.chase, sees: !c.chase && coneSees(c) })); },
  };
}
