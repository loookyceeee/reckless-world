// injected before page scripts: live GPU memory estimate (buffers + textures, minus deletes). window.__gm() -> {buf, tex} bytes
(() => { const sz = new Map(); let buf = 0, tex = 0; const tsz = new Map();
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) { if (!C) continue; const P = C.prototype;
    const bound = new WeakMap(); const st = (gl) => { let s = bound.get(gl); if (!s) bound.set(gl, s = { b: {}, unit: 0, t: {} }); return s; };
    const o = { bb: P.bindBuffer, bd: P.bufferData, db: P.deleteBuffer, bt: P.bindTexture, at: P.activeTexture, ti: P.texImage2D, ts: P.texStorage2D, dt: P.deleteTexture };
    P.bindBuffer = function (t, b) { st(this).b[t] = b; return o.bb.apply(this, arguments); };
    P.bufferData = function (t, d) { const b = st(this).b[t]; const n = typeof d === 'number' ? d : (d && d.byteLength) || 0; if (b) { buf += n - (sz.get(b) || 0); sz.set(b, n); } return o.bd.apply(this, arguments); };
    P.deleteBuffer = function (b) { if (b && sz.has(b)) { buf -= sz.get(b); sz.delete(b); } return o.db.apply(this, arguments); };
    P.activeTexture = function (u) { st(this).unit = u; return o.at.apply(this, arguments); };
    P.bindTexture = function (t, x) { const s = st(this); s.t[s.unit + ':' + t] = x; return o.bt.apply(this, arguments); };
    const curT = (gl, t) => { const s = st(gl); return s.t[s.unit + ':' + (t >= 34069 && t <= 34074 ? 34067 : t)]; };
    const addT = (x, key, n) => { if (!x) return; let m = tsz.get(x); if (!m) tsz.set(x, m = {}); tex += n - (m[key] || 0); m[key] = n; };
    P.texImage2D = function () { const a = arguments; let w = 0, h = 0; if (a.length >= 8) { w = a[3]; h = a[4]; } else { const s = a[5]; w = s && (s.width || s.videoWidth) || 0; h = s && (s.height || s.videoHeight) || 0; } addT(curT(this, a[0]), a[0] + ':' + a[1], w * h * 4); return o.ti.apply(this, a); };
    if (o.ts) P.texStorage2D = function (t, l, f, w, h) { addT(curT(this, t), 'S', w * h * 4 * 1.33 * (t === 34067 ? 6 : 1)); return o.ts.apply(this, arguments); };
    P.deleteTexture = function (x) { const m = x && tsz.get(x); if (m) { for (const k in m) tex -= m[k]; tsz.delete(x); } return o.dt.apply(this, arguments); };
  }
  window.__gm = () => ({ buf, tex });
})();
