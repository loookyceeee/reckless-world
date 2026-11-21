// Story chain (OUTSTANDING A): a skippable first-time onboarding (~2-3 min) and a 6-mission chain that takes a
// non-raver to their first Temple rave on mechanics that already exist. ALL CAPS copy. No XP, no codes, no rewards:
// progress is local only (rw.story.v1). Missions advance on poll checks or story.emit(key) hooks from main.js.
const SK = 'rw.story.v1';
const ONBOARD = [
  { k: 'move', title: 'MOVE', obj: 'WALK 15 M · <b>WASD</b> OR LEFT STICK', touch: 'WALK 15 M · DRAG THE LEFT STICK' },
  { k: 'sprint', title: 'SPRINT', obj: 'SPRINT FOR A SECOND · HOLD <b>SHIFT</b>', touch: 'SPRINT · PUSH THE STICK ALL THE WAY OR HOLD RUN' },
  { k: 'look', title: 'LOOK BEHIND', obj: 'CHECK BEHIND YOU · HOLD <b>B</b>', touch: 'CHECK BEHIND YOU · TAP THE EYE BUTTON', auto: 7 },
  { k: 'phone', title: 'YOUR PHONE', obj: 'OPEN YOUR PHONE · <b>TAB</b>', touch: 'OPEN YOUR PHONE · TAP THE PHONE BUTTON', auto: 9 },
  { k: 'map', title: 'THE MAP', obj: 'OPEN THE MAP · <b>M</b>', touch: 'OPEN THE MAP · PHONE → MAP', auto: 9 },
];
export const CHAIN = [
  { id: 'look', title: 'GET THE LOOK', brief: 'NO ONE GETS IN LOOKING LIKE THAT. OPEN THE WARDROBE AND CHANGE ONE THING.', obj: () => 'CHANGE YOUR FIT · <b>O</b> OR PHONE → WARDROBE', on: 'fit' },
  { id: 'paper', title: 'PAPER THE TOWN', brief: 'THE TEMPLE NEEDS A CROWD. PASTE ONE POSTER ON A WALL.', obj: (c) => { const w = c.nextWall(); return `PASTE A POSTER${w ? `<br>${w.name} <b>${Math.round(w.d)}M</b>` : ''}`; }, on: 'poster', dest: (c) => c.nextWall() },
  { id: 'snap', title: 'PROOF', brief: 'SEND US A PICTURE OF THE CITY. ANY STREET WILL DO.', obj: () => 'TAKE A PHOTO · <b>P</b> OR PHONE → CAMERA', on: 'photo' },
  { id: 'ride', title: 'GET A RIDE', brief: 'IT IS A LONG WALK. GET IN A CAR OR HAIL A BLACK CAB.', obj: () => 'GET IN A CAR · <b>E</b> BY A PARKED CAR<br>OR PHONE → HAIL CAB', on: ['drive', 'cab'] },
  { id: 'queue', title: 'THE QUEUE', brief: 'DOORS ARE OPEN. GET TO THE TEMPLE.', obj: (c) => `GET TO THE TEMPLE DOOR <b>${Math.round(c.templeD())}M</b>`, check: (c) => c.templeD() < 7 || c.inTemple(), dest: (c) => c.templeDest() },
  { id: 'rave', title: 'FIRST RAVE', brief: 'YOU ARE IN. GET ON THE FLOOR AND DANCE.', obj: (c) => c.inTemple() ? `DANCE ON THE FLOOR · <b>F</b> <b>${Math.max(0, 8 - c.danceT).toFixed(0)}S</b>` : 'GO INSIDE · <b>E</b> AT THE DOOR', check: (c) => c.danceT >= 8 },
];
export function createStory(ctx) {
  // ctx: { hud, P, app, isTouch, text(m), setDest(d|null), nextWall() -> {x,z,name,d}|null, templeD(), templeDest(), inTemple(), dancing(), cinematic() }
  let S; try { S = JSON.parse(localStorage.getItem(SK) || 'null'); } catch (e) { S = null; }
  S = S || { ob: 0, obDone: false, m: 0, done: false, started: false };
  const save = () => localStorage.setItem(SK, JSON.stringify(S));
  const st = { lx: ctx.P.x, lz: ctx.P.z, walk: 0, fast: 0, t: 0, keys: new Set(), danceT: 0, announced: -1, obAnn: -1 };
  addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (k === 'b') st.keys.add('look'); if (k === 'tab') st.keys.add('phone'); if (k === 'm') st.keys.add('map'); });
  const c = { ...ctx, get danceT() { return st.danceT; } };
  let skipBtn = null;
  const showSkip = (on) => {
    if (on && !skipBtn) { skipBtn = document.createElement('button'); skipBtn.className = 'storyskip'; skipBtn.textContent = 'SKIP TUTORIAL'; skipBtn.onclick = () => api.skipOnboarding(); document.body.appendChild(skipBtn); }
    if (!on && skipBtn) { skipBtn.remove(); skipBtn = null; }
  };
  const mission = () => (S.done || !S.obDone ? null : CHAIN[S.m]);
  const announce = () => { const m = mission(); if (!m || st.announced === S.m) return; st.announced = S.m;
    ctx.hud.mtitle({ kicker: `STORY · ${S.m + 1} / ${CHAIN.length}`, title: m.title }); ctx.text({ title: m.title, body: m.brief }); const d = m.dest && m.dest(c); if (d) ctx.setDest({ x: d.x, z: d.z, label: d.label || d.name || m.title, kind: 'story' }); };
  const advance = () => { const m = mission(); if (!m) return; S.m++; st.danceT = 0;
    if (S.m >= CHAIN.length) { S.done = true; save(); ctx.setDest(null); ctx.hud.stamp({ title: 'FIRST RAVE', sub: 'STORY COMPLETE', lines: ['YOU MADE IT IN', 'SEE YOU ON THE FLOOR'] }); return; }
    save(); ctx.hud.note && ctx.hud.note({ kicker: 'STORY', title: m.title + ' · DONE', body: '' }); setTimeout(announce, 1800); };
  const api = {
    state: () => ({ ...S }),
    emit(key) { const m = mission(); if (!m) return; const on = [].concat(m.on || []); if (on.includes(key)) advance(); },
    skipOnboarding() { S.obDone = true; save(); showSkip(false); st.announced = -1; setTimeout(announce, 400); },
    reset() { S = { ob: 0, obDone: false, m: 0, done: false, started: false }; save(); st.announced = -1; st.obAnn = -1; },
    update(dt) {
      if (ctx.app.title || ctx.cinematic()) return; st.t += dt;
      const dx = ctx.P.x - st.lx, dz = ctx.P.z - st.lz, d = Math.hypot(dx, dz); st.lx = ctx.P.x; st.lz = ctx.P.z;
      if (!S.obDone) { const step = ONBOARD[S.ob]; showSkip(true);
        if (st.obAnn !== S.ob) { st.obAnn = S.ob; st.stepT = 0; if (S.ob === 0) ctx.hud.mtitle({ kicker: 'WELCOME TO BELFAST', title: 'FIRST NIGHT' }); }
        st.stepT += dt; let ok = false;
        if (d < 3) { if (step.k === 'move') { st.walk += d; ok = st.walk > 15; } if (step.k === 'sprint') { st.fast = d / Math.max(dt, 1e-3) > 5 ? st.fast + dt : Math.max(0, st.fast - dt * 0.5); ok = st.fast > 0.8; } }
        if (step.k === 'sprint' && ctx.sprinting && ctx.sprinting()) ok = true;
        if (st.keys.has(step.k)) ok = true; if (step.auto && ctx.isTouch && st.stepT > step.auto) ok = true;
        if (ok) { st.keys.clear(); S.ob++; save(); if (S.ob >= ONBOARD.length) { ctx.hud.note && ctx.hud.note({ kicker: 'TUTORIAL', title: 'YOU ARE READY', body: '' }); api.skipOnboarding(); } }
        return; }
      const m = mission(); if (!m) return; announce();
      if (m.id === 'rave') { if (ctx.inTemple() && ctx.dancing()) st.danceT += dt; }
      if (m.check && m.check(c)) advance();
      if (m.dest && st.t % 2 < dt) { const dd = m.dest(c); if (dd) ctx.setDest({ x: dd.x, z: dd.z, label: dd.label || dd.name || m.title, kind: 'story' }); }
    },
    objective() {
      if (!S.obDone) { const s = ONBOARD[S.ob]; return s ? `TUTORIAL ${S.ob + 1} / ${ONBOARD.length} · ${s.title}<br>${ctx.isTouch ? s.touch : s.obj}` : null; }
      const m = mission(); return m ? `STORY ${S.m + 1} / ${CHAIN.length} · ${m.title}<br>${m.obj(c)}` : null;
    },
  };
  return api;
}
