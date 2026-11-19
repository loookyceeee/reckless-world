// Reckless Raves' own tracks streamed through the official SoundCloud Widget API (hidden iframe,
// no audio files downloaded or re-hosted). Controlled from the game: play/pause, volume by place, next track.
// If the widget can't load or play (offline, blocked, region), the self-made WebAudio beat stays on as the fallback.
export const SC_PROFILE = 'https://soundcloud.com/recklessraves';
const SC_USER = 'https://api.soundcloud.com/users/1468076891'; // soundcloud.com/recklessraves (DOUBLE R RECORDS)
export function createMusic({ onState } = {}) {
  let W = null, ready = false, playing = false, failed = false, want = false, vol = 0, title = '', link = SC_PROFILE, count = 0, tries = 0;
  const st = () => onState && onState({ ready, playing, failed, title, link });
  function load() {
    if (W || failed) return;
    const fr = document.createElement('iframe'); fr.id = 'scw'; fr.allow = 'autoplay; encrypted-media'; fr.title = 'SoundCloud player';
    fr.style.cssText = 'position:fixed;left:-2px;bottom:-2px;width:1px;height:1px;opacity:0;pointer-events:none;border:0';
    fr.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(SC_USER) + '&auto_play=false&buying=false&sharing=false&download=false&show_artwork=false&visual=false';
    document.body.appendChild(fr);
    const sc = document.createElement('script'); sc.src = 'https://w.soundcloud.com/player/api.js';
    sc.onerror = () => { failed = true; st(); };
    sc.onload = () => {
      const SCW = window.SC && window.SC.Widget; if (!SCW) { failed = true; st(); return; }
      W = SCW(fr); const E = SCW.Events;
      W.bind(E.READY, () => { ready = true; W.getSounds(s => { count = (s || []).length; if (want && count > 1) W.skip(Math.floor(Math.random() * count)); }); W.setVolume(vol); if (want) W.play(); st(); });
      W.bind(E.PLAY, () => { playing = true; W.getCurrentSound(s => { if (s) { title = cleanTitle(s.title || '', s.user && s.user.username); link = s.permalink_url || SC_PROFILE; } st(); }); });
      W.bind(E.PAUSE, () => { playing = false; st(); });
      W.bind(E.FINISH, () => { W.next(); });
      W.bind(E.ERROR, () => { if (++tries < 3) W.next(); else { failed = true; st(); } });
    };
    document.head.appendChild(sc);
    setTimeout(() => { if (!ready) { failed = true; st(); } }, 12000);
  }
  return {
    get playing() { return playing; }, get failed() { return failed; }, get title() { return title; }, get link() { return link; },
    start() { want = true; load(); if (W && ready) W.play(); },
    pause() { want = false; if (W && ready) W.pause(); },
    next() { if (W && ready) { W.next(); W.play(); } },
    setVolume(v) { const nv = Math.round(Math.max(0, Math.min(100, v))); if (Math.abs(nv - vol) < 2) return; vol = nv; if (W && ready) W.setVolume(vol); },
  };
}

// Luke: never show explicit track titles in game. Explicit titles become a clean label: artist + RECKLESS RADIO.
const EXPLICIT = /(f+u+c+k|sh[i1]t|b[i1]tch|c+u+n+t|d[i1]ck|pussy|wh[o0]re|sl[u]t|n[i1]gg|cock|wank|tw[a@]t|bollock|motherf|\bass\b|arse|porn|sex|coke|\*{2,}|explicit)/i;
export function cleanTitle(raw, artist) {
  const t = String(raw || '').trim(); if (!t) return '';
  return EXPLICIT.test(t) ? `${String(artist || 'Reckless Raves').trim()} · RECKLESS RADIO` : t;
}
