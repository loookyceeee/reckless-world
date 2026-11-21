// Reckless Raves' own tracks streamed through the official SoundCloud Widget API (hidden iframe,
// no audio files downloaded or re-hosted). Controlled from the game: play/pause, volume by place, next track.
// If the widget can't load or play (offline, blocked, region), the self-made WebAudio beat stays on as the fallback.
export const SC_PROFILE = 'https://soundcloud.com/recklessraves';
const SC_USER = 'https://api.soundcloud.com/users/1468076891'; // soundcloud.com/recklessraves (DOUBLE R RECORDS)
export function createMusic({ onState } = {}) {
  let W = null, ready = false, playing = false, failed = false, want = false, vol = 0, title = '', link = SC_PROFILE, count = 0, tries = 0;
  // lock-screen / OS media controls get the same clean label (never the raw SoundCloud title)
  const meta = () => { try { if ('mediaSession' in navigator && window.MediaMetadata) navigator.mediaSession.metadata = new MediaMetadata({ title: (title || 'RECKLESS RADIO').toUpperCase(), artist: 'RECKLESS RADIO', album: 'RECKLESS WORLD' }); } catch (e) { } };
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
      W.bind(E.PLAY, () => { playing = true; W.getCurrentSound(s => { if (s) { title = cleanTitle(s.title || '', s.user && s.user.username); link = s.permalink_url || SC_PROFILE; } meta(); st(); }); });
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
// Normalise leetspeak (! 1 | -> i, 0 -> o, @ 4 -> a, $ 5 -> s, 3 -> e, 7 -> t), keep * as a wildcard letter, then match per word
// from the word start (so Essex, Middlesex, Arsenal, Scunthorpe, Cocktail, Dicky pass) plus a few always-bad substrings.
const LEET = { '!': 'i', '1': 'i', '|': 'i', '0': 'o', '@': 'a', '4': 'a', '$': 's', '5': 's', '3': 'e', '7': 't' };
const WORD = [/^f+[u*]*c*k+/, /sh[i*]+t(e|es|s|y|ty|ting|ter|head|hole)?$/, /^b[i*]+tch/, /^c[u*]+nt/, /^d[i*]+cks?$/, /^d[i*]+ckhead/, /^c[o*]+cks?$/, /^p[u*]+ss(y|ies)/, /^wh[o*]+re/, /^sl[u*]+t/, /^n[i*]+gg/,
  /^w[a*]+nk/, /^tw[a*]+t/, /^bollock/, /^arse(hole)?s?$/, /^ass(hole|holes)?$/, /^sexy?$/, /^porn/, /^coke$/, /^nonce/, /^explicit/];
const ANY = [/f+u+c+k/, /motherf/, /\*{2,}/];
export function isExplicit(raw) {
  const n = String(raw || '').toLowerCase().replace(/[!1|0@4$537]/g, (c) => LEET[c]);
  if (ANY.some(r => r.test(n.replace(/[^a-z*]/g, '')))) return true;
  return n.split(/[^a-z*]+/).filter(Boolean).some(w => WORD.some(r => r.test(w)));
}
export function cleanTitle(raw, artist) {
  const t = String(raw || '').trim(); if (!t) return '';
  return isExplicit(t) ? `${String(artist || 'Reckless Raves').trim()} · RECKLESS RADIO` : t;
}
