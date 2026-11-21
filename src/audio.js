// Self-made procedural audio (no samples, no copyrighted music): WebAudio-synthesised city ambience outside and an
// original 140 BPM beat inside the Temple (muffled through the walls nearby). Silent until the first tap / START and toggleable.
export function createAudio() {
  let ctx = null, beatOff = false, force = false, t0 = 0, master, amb, ambF, beatBus, beatF, beatG, ambG, on = false, started = false, nextT = 0, step = 0, timer = null;
  const BPM = 140, S16 = 60 / BPM / 4;
  const noiseBuf = (sec, brown) => { const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; } return b; };
  let white;
  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    white = noiseBuf(1, false);
    // ambience: looping brown-noise city rumble + slow swell, plus occasional distant car passes
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(4, true); src.loop = true; ambF = ctx.createBiquadFilter(); ambF.type = 'lowpass'; ambF.frequency.value = 420; ambG = ctx.createGain(); ambG.gain.value = 0.55;
    src.connect(ambF).connect(ambG).connect(master); src.start();
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.15; lfo.connect(lg).connect(ambG.gain); lfo.start();
    // beat bus -> lowpass (muffled outside) -> gain
    beatBus = ctx.createGain(); beatF = ctx.createBiquadFilter(); beatF.type = 'lowpass'; beatF.frequency.value = 300; beatG = ctx.createGain(); beatG.gain.value = 0; beatBus.connect(beatF).connect(beatG).connect(master);
    nextT = ctx.currentTime + 0.1; t0 = nextT; timer = setInterval(schedule, 25);
    setTimeout(carPass, 2500);
  }
  function carPass() { if (!ctx) return; if (on && ambG.gain.value > 0.05) { const s = ctx.createBufferSource(); s.buffer = white; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8; const g = ctx.createGain(); const t = ctx.currentTime, d = 2.5 + Math.random() * 2.5;
      f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(900 + Math.random() * 500, t + d * 0.5); f.frequency.linearRampToValueAtTime(250, t + d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, t + d * 0.5); g.gain.linearRampToValueAtTime(0, t + d);
      s.connect(f).connect(g).connect(ambG); s.start(t); s.stop(t + d + 0.1); }
    setTimeout(carPass, 3500 + Math.random() * 6000); }
  const kick = (t) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(1.0, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38); o.connect(g).connect(beatBus); o.start(t); o.stop(t + 0.4); };
  const hat = (t, v) => { const s = ctx.createBufferSource(); s.buffer = white; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500; const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); s.connect(f).connect(g).connect(beatBus); s.start(t); s.stop(t + 0.06); };
  const clap = (t) => { const s = ctx.createBufferSource(); s.buffer = white; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.9; const g = ctx.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); s.connect(f).connect(g).connect(beatBus); s.start(t); s.stop(t + 0.2); };
  const BASS = [0, 0, 12, 0, 0, 0, 10, 0, 0, 0, 12, 0, 7, 0, 10, 0]; // semitones over A1, an original 1-bar riff
  const bass = (t, n) => { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 55 * Math.pow(2, n / 12); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(160, t + 0.12); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.connect(f).connect(g).connect(beatBus); o.start(t); o.stop(t + 0.16); };
  function schedule() { if (!ctx) return; while (nextT < ctx.currentTime + 0.12) { const s = step % 16, bar = Math.floor(step / 16);
      if (beatG.gain.value > 0.001) { if (s % 4 === 0) kick(nextT); if (s % 4 === 2) hat(nextT, 0.22); else if (s % 2 === 1) hat(nextT, 0.07); if (s === 4 || s === 12) clap(nextT); if (s % 4 !== 0 && BASS[s] !== undefined && (s % 2 === 0 || bar % 2)) bass(nextT, BASS[s]); }
      nextT += S16; step++; } }
  const api = {
    get on() { return on; },
    unlock() { if (!ctx) init(); if (ctx.state === 'suspended') ctx.resume(); if (!started) { started = true; api.set(true); } },
    set(v) { on = v; if (!ctx) return; master.gain.setTargetAtTime(on ? 0.7 : 0, ctx.currentTime, 0.25); },
    toggle() { if (!ctx) { api.unlock(); return on; } api.set(!on); return on; },
    // short original two-tone (not a real emergency-service sample): 4 alternating triangle notes, ~1.3 s
    rain(k) { if (!ctx) return; if (!api._rg) { const s = ctx.createBufferSource(); s.buffer = noiseBuf(3, false); s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.5; const g = ctx.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(master); s.start(); api._rg = g; }
      api._rg.gain.setTargetAtTime(Math.max(0, Math.min(1, k)) * 0.16, ctx.currentTime, 0.8); },   // stage 10: rain hiss follows the weather intensity
    siren() { if (!ctx || !on) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.connect(g).connect(master);
      for (let i = 0; i < 4; i++) o.frequency.setValueAtTime(i % 2 ? 590 : 780, t + i * 0.32); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.03); g.gain.setValueAtTime(0.05, t + 1.22); g.gain.linearRampToValueAtTime(0, t + 1.3); o.start(t); o.stop(t + 1.35); },
    // car: original two-note horn (no samples) and a low engine drone that rises with speed; both through the master gain
    horn(v = 1) { if (!ctx || !on) return; const t = ctx.currentTime; for (const f of [415, 523]) { const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter(); o.type = 'square'; o.frequency.value = f * (v < 1 ? 0.84 : 1); fl.type = 'lowpass'; fl.frequency.value = 1800; o.connect(fl).connect(g).connect(master);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035 * v, t + 0.02); g.gain.setValueAtTime(0.035 * v, t + 0.38); g.gain.linearRampToValueAtTime(0, t + 0.45); o.start(t); o.stop(t + 0.5); } },
    engine(x, run) { if (!ctx) return; if (!api._eng) { if (!run) return; const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0;
        o.connect(f); o2.connect(f); f.connect(g).connect(master); o.start(); o2.start(); api._eng = { o, o2, f, g }; }
      const E = api._eng, t = ctx.currentTime, r = Math.min(1, x); E.o.frequency.setTargetAtTime(38 + r * 70, t, 0.12); E.o2.frequency.setTargetAtTime(19 + r * 35, t, 0.12); E.f.frequency.setTargetAtTime(300 + r * 900, t, 0.2); E.g.gain.setTargetAtTime(run && on ? 0.03 + r * 0.03 : 0, t, 0.15); },
    // inside: full-band beat; outside: muffled by distance to the Temple door
    set beatOff(v) { beatOff = v; },
    set force(v) { force = v; }, // dance minigame: the synth 140 BPM bed plays full whatever else is on
    // beat position of what is coming out of the speakers now (null until audio is unlocked)
    clock() { if (!ctx || !on || !t0) return null; return (ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - t0) / (60 / BPM); },
    hit(kind) { if (!ctx || !on) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = kind === 'miss' ? 'sawtooth' : 'sine'; o.connect(g).connect(master);
      o.frequency.setValueAtTime(kind === 'miss' ? 110 : kind === 'reckless' ? 1320 : kind === 'clean' ? 990 : 660, t); if (kind === 'miss') o.frequency.linearRampToValueAtTime(70, t + 0.12);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(kind === 'miss' ? 0.05 : 0.07, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t + (kind === 'miss' ? 0.16 : 0.09)); o.start(t); o.stop(t + 0.2); },
    blip(f = 880, d = 0.08, v = 0.05) { if (!ctx || !on) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.connect(g).connect(master); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t + d); o.start(t); o.stop(t + d + 0.05); },
    shutter() { if (!ctx || !on) return; const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = white; f.type = 'bandpass'; f.frequency.value = 3200; s.connect(f).connect(g).connect(master);
      g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); g.gain.setValueAtTime(0.0, t + 0.07); g.gain.linearRampToValueAtTime(0.16, t + 0.074); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); s.start(t); s.stop(t + 0.15); }, // SoundCloud music playing -> synth beat steps aside (it stays as the fallback)
    update({ inside, dist }) { if (!ctx) return; const t = ctx.currentTime;
      const bg = (beatOff && !force) ? 0 : inside ? 0.9 : Math.max(0, 1 - dist / 90) * 0.5; beatG.gain.setTargetAtTime(bg, t, 0.3); beatF.frequency.setTargetAtTime(inside ? 16000 : 260, t, 0.3); ambG.gain.setTargetAtTime(inside ? 0.08 : 0.55, t, 0.5); },
  };
  return api;
}
