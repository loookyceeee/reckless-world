import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
// Pooled stylised traffic on OSM road graph (UK: drive on the LEFT), fictional patrol vehicles, pedestrians.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { hex, rng, box, cyl, rbox, xf, color, merge, toMesh, plane } from './geo.js';
import { createAvatar, animateAvatar } from './character.js';

export function buildGraph(roads, drive) {
  const pos = new Map(), adj = new Map(), info = new Map();
  for (const r of roads) {
    if (drive ? !r.d : false) continue;
    if (drive && ['service'].includes(r.t)) continue;
    for (let i = 0; i < r.n.length; i++) pos.set(r.n[i], r.pts[i]);
    for (let i = 0; i < r.n.length - 1; i++) {
      const a = r.n[i], b = r.n[i + 1]; if (a === b) continue;
      const add = (u, v) => { if (!adj.has(u)) adj.set(u, []); adj.get(u).push(v); info.set(u + ',' + v, r); };
      add(a, b); if (!r.o || !drive) add(b, a);
    }
  }
  return { pos, adj, info, nodes: [...adj.keys()] };
}
// Battenburg (blue/yellow blocks) — generic UK-style, no wordmarks, no emblems, no badges.
function battenburgTex(scene) {
  const t = new DynamicTexture('battenburg', { width: 512, height: 128 }, scene, true); const c = t.getContext();
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#123a9e' : '#d4ec1a'; c.fillRect(i * 64, j * 64, 64, 64); }
  t.anisotropicFilteringLevel = 8; t.update(); return t;
}
// Plain "POLICE" lettering only (allowed): no crest, no force name, no badge.
function policeTex(scene) {
  const t = new DynamicTexture('policeTxt', { width: 512, height: 128 }, scene, true); const c = t.getContext(); c.clearRect(0, 0, 512, 128);
  c.fillStyle = '#123a9e'; c.font = '900 96px Arial, Helvetica, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('POLICE', 256, 68);
  t.hasAlpha = true; t.anisotropicFilteringLevel = 8; t.update(); return t;
}
function carVD(kind, body) {
  const P = [];
  const glass = hex('#2a3550'), tyre = hex('#151517'), rim = hex('#b8bcc4');
  if (kind === 'wagon') { // fictional armoured patrol wagon: slab-sided box body, small grilled glass, flat roof (no maker grille/badge)
    P.push(color(xf(rbox(2.3, 1.5, 5.3, 0.08, 6), { t: [0, 1.2, 0] }), body));
    P.push(color(xf(rbox(2.2, 1.05, 3.9, 0.08, 6), { t: [0, 2.45, -0.45] }), body)); // tall rear box
    P.push(color(xf(rbox(2.2, 0.8, 1.0, 0.06, 6), { r: [-0.32, 0, 0], t: [0, 2.32, 1.62] }), body)); // raked armoured windscreen frame
    P.push(color(xf(box(1.7, 0.42, 0.04), { r: [-0.32, 0, 0], t: [0, 2.36, 2.14] }), glass));
    for (let k = 0; k < 6; k++) P.push(color(xf(box(0.04, 0.46, 0.05), { r: [-0.32, 0, 0], t: [-0.72 + k * 0.29, 2.36, 2.17] }), hex('#2a2c31'))); // screen guard bars
    for (const sd of [-1, 1]) { P.push(color(xf(box(0.04, 0.36, 0.7), { t: [sd * 1.11, 2.5, 1.0] }), glass)); P.push(color(xf(box(0.04, 0.3, 0.5), { t: [sd * 1.11, 2.6, -1.6] }), glass));
      for (let k = 0; k < 4; k++) P.push(color(xf(box(0.05, 0.03, 0.72), { t: [sd * 1.13, 2.36 + k * 0.09, 1.0] }), hex('#2a2c31')));
      P.push(color(xf(box(0.08, 0.18, 4.6), { t: [sd * 1.16, 0.55, 0] }), hex('#25272c'))); } // armoured sill skirt
    P.push(color(xf(box(2.32, 0.32, 0.2), { t: [0, 0.58, 2.7] }), hex('#25272c'))); // plain steel front bumper
    P.push(color(xf(box(1.6, 0.38, 0.05), { t: [0, 1.25, 2.66] }), hex('#3a3d44'))); // plain flat front panel (no logo)
    P.push(color(xf(box(2.0, 0.9, 0.05), { t: [0, 2.3, -2.66] }), hex('#3a3d44'))); // rear doors
  } else if (kind === 'bus') { // generic purple rapid-transit bus (Glider-style colour, no operator marks)
    P.push(color(xf(rbox(2.5, 2.6, 11.8, 0.12, 10), { t: [0, 1.65, 0] }), body));
    P.push(color(xf(box(2.54, 1.0, 10.6), { t: [0, 2.1, -0.3] }), glass));
    P.push(color(xf(box(2.3, 1.6, 0.05), { t: [0, 2.0, 5.92] }), glass));
    P.push(color(xf(rbox(2.52, 0.25, 11.82, 0.2, 8), { t: [0, 0.48, 0] }), hex('#3a1446')));
    P.push(color(xf(rbox(2.3, 0.3, 4.0, 0.3, 8), { t: [0, 3.05, -2] }), Color3.Lerp(body, hex('#ffffff'), 0.15)));
    P.push(color(xf(box(1.6, 0.25, 0.04), { t: [0, 2.95, 5.93] }), hex('#ffb000')));
    P.push(color(xf(box(2.56, 2.5, 0.45), { t: [0, 1.75, -1.2] }), hex('#1a1420'))); // articulation bellows (bendy rapid-transit look)
    P.push(color(xf(box(2.53, 0.12, 11.0), { t: [0, 1.05, 0] }), hex('#e8e0ee'))); // pale waist band
  } else if (kind === 'cab') { // Belfast black cab (classic tall hackney shape)
    P.push(color(xf(rbox(1.9, 0.85, 4.55, 0.28, 10), { t: [0, 0.78, 0] }), body));
    P.push(color(xf(rbox(1.75, 1.0, 2.7, 0.3, 10), { t: [0, 1.6, -0.35] }), body));
    P.push(color(xf(box(1.6, 0.55, 2.6), { t: [0, 1.68, -0.35] }), glass));
    P.push(color(xf(rbox(0.95, 0.22, 0.95, 0.25, 8), { t: [0, 0.62, 2.1] }), hex('#c9ccd2'))); // grille
    P.push(color(xf(rbox(0.55, 0.16, 0.22, 0.3, 6), { t: [0, 2.17, 0.5] }), hex('#ffb12a'))); // TAXI light
  } else if (kind === 'taxi') {
    P.push(color(xf(rbox(1.85, 0.8, 4.4, 0.25, 10), { t: [0, 0.75, 0] }), body));
    P.push(color(xf(rbox(1.7, 0.85, 2.4, 0.3, 10), { t: [0, 1.45, -0.2] }), body));
    P.push(color(xf(box(1.5, 0.5, 2.3), { t: [0, 1.5, -0.2] }), glass));
    P.push(color(xf(rbox(0.5, 0.15, 0.25, 0.3, 6), { t: [0, 1.93, 0.2] }), hex('#f4c21a')));
  } else if (kind === 'estate') { // patrol estate: long roof to the tail
    P.push(color(xf(rbox(1.84, 0.74, 4.7, 0.25, 10), { t: [0, 0.72, 0] }), body));
    P.push(color(xf(rbox(1.62, 0.66, 3.1, 0.22, 10), { t: [0, 1.3, -0.55] }), body));
    P.push(color(xf(box(1.66, 0.4, 2.9), { t: [0, 1.33, -0.5] }), glass));
  } else {
    const L = kind === 'hatch' ? 3.8 : 4.4;
    P.push(color(xf(rbox(1.8, 0.72, L, 0.25, 10), { t: [0, 0.7, 0] }), body));
    P.push(color(xf(rbox(1.55, 0.62, L * 0.5, 0.32, 10), { t: [0, 1.25, kind === 'hatch' ? -0.25 : -0.15] }), body));
    P.push(color(xf(box(1.4, 0.4, L * 0.47), { t: [0, 1.28, kind === 'hatch' ? -0.25 : -0.15] }), glass));
  }
  const wz = kind === 'bus' ? 4.0 : kind === 'wagon' ? 1.7 : 1.35, wx = kind === 'bus' ? 1.12 : kind === 'wagon' ? 1.0 : 0.82, wr = kind === 'bus' ? 0.5 : kind === 'wagon' ? 0.48 : 0.36;
  for (const a of [-1, 1]) for (const b of [-1, 1]) { P.push(color(xf(cyl(0.3, wr, wr, 14), { r: [0, 0, Math.PI / 2], t: [a * wx, wr, b * wz] }), tyre)); P.push(color(xf(cyl(0.31, wr * 0.55, wr * 0.55, 10), { r: [0, 0, Math.PI / 2], t: [a * wx, wr, b * wz] }), rim)); }
  return merge(P);
}
function lightsVD(kind) { // headlights front (+z), tail lights back
  const L = kind === 'bus' ? 5.92 : kind === 'wagon' ? 2.68 : kind === 'estate' ? 2.36 : kind === 'hatch' ? 1.92 : kind === 'cab' ? 2.3 : 2.22, y = kind === 'bus' ? 0.75 : kind === 'wagon' ? 1.0 : 0.78, x = kind === 'bus' ? 0.95 : kind === 'wagon' ? 0.85 : 0.62;
  const P = []; for (const sd of [-1, 1]) { P.push(color(xf(box(0.36, 0.14, 0.06), { t: [sd * x, y, L] }), hex('#fff6dc'))); P.push(color(xf(box(0.34, 0.14, 0.06), { t: [sd * x, y, -L] }), hex('#ff2020'))); }
  return merge(P);
}

export function buildTraffic(scene, city, { low = false, stops = [], signals = [] } = {}) {
  const R = rng(77);
  const G = buildGraph(city.roads, true), PG = buildGraph(city.roads, false);
  // Real OSM traffic-signal nodes -> graph junction nodes (within 6 m). Two-phase cycle per junction: N-S then E-W.
  const SIG = new Map(); { const cell = new Map(); for (const [id, p] of G.pos) { const k = Math.floor(p[0] / 12) + ',' + Math.floor(p[1] / 12); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(id); }
    for (const [x, z] of signals) { let best = null, bd = 6; const gx = Math.floor(x / 12), gz = Math.floor(z / 12);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const id of cell.get((gx + i) + ',' + (gz + j)) || []) { const p = G.pos.get(id); const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = id; } }
      if (best != null) SIG.set(best, ((x * 0.137 + z * 0.291) % 1 + 1) % 1 * 24); } }
  const bodyM = new StandardMaterial('carBody', scene); bodyM.specularColor = new Color3(0.45, 0.45, 0.5); bodyM.specularPower = 48; if (scene.__env) { bodyM.reflectionTexture = scene.__env; const f = new FresnelParameters(); f.bias = 0.08; f.power = 2; f.leftColor = new Color3(0.7, 0.7, 0.75); f.rightColor = new Color3(0.1, 0.1, 0.12); bodyM.reflectionFresnelParameters = f; }
  const lightM = new StandardMaterial('carLights', scene); lightM.disableLighting = true; lightM.emissiveColor = Color3.White();
  const COLS = ['#d64545', '#f2f2f2', '#2b2b30', '#3f6fd8', '#e7c33a', '#7d8a96', '#4e9a6b', '#b8b0a0', '#c2185b'].map(hex);
  const templates = {};
  const tpl = (key, kind, col) => {
    if (templates[key]) return templates[key];
    const b = toMesh('car-' + key, carVD(kind, col), scene, bodyM); const l = toMesh('carL-' + key, lightsVD(kind), scene, lightM);
    b.position.y = -500; l.position.y = -500; b.alwaysSelectAsActiveMesh = true; l.alwaysSelectAsActiveMesh = true; return (templates[key] = { b, l, kind });
  };
  // patrol livery meshes (fictional Belfast-style; Battenburg side panels, blue roof bar, no marks)
  const bbM = new StandardMaterial('bbM', scene); bbM.diffuseTexture = battenburgTex(scene); bbM.diffuseTexture.uScale = 1; bbM.diffuseTexture.wAng = 0; bbM.specularColor = new Color3(0.3, 0.3, 0.3); bbM.emissiveColor = new Color3(0.12, 0.12, 0.12);
  const barM = new StandardMaterial('barM', scene); barM.disableLighting = true; barM.emissiveColor = hex('#2a6bff');
  const barM2 = new StandardMaterial('barM2', scene); barM2.disableLighting = true; barM2.emissiveColor = hex('#2a6bff');
  const polM = new StandardMaterial('polM', scene); polM.diffuseTexture = policeTex(scene); polM.useAlphaFromDiffuseTexture = true; polM.emissiveColor = new Color3(0.25, 0.25, 0.3); polM.specularColor = Color3.Black();
  bbM.emissiveColor = new Color3(0.22, 0.22, 0.22); // retro-reflective
  const darkM = new StandardMaterial('lbBase', scene); darkM.diffuseColor = hex('#1b1d22'); darkM.specularColor = new Color3(0.2, 0.2, 0.2);
  const patrolDeco = (node, kind) => {
    const W = kind === 'wagon';
    const len = W ? 4.9 : 4.3, y = W ? 1.22 : 0.7, h = W ? 0.78 : 0.42, x = W ? 1.162 : 0.93;
    for (const sd of [-1, 1]) { const p = toMesh('bb', xf(box(0.02, h, len), { t: [sd * x, y, 0] }), scene, bbM); p.parent = node;
      const pl = toMesh('polS', xf(plane(W ? 1.9 : 1.3, W ? 0.48 : 0.32), {}), scene, polM); pl.parent = node; pl.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
      pl.position.set(sd * (x + 0.02), W ? 2.15 : 1.12, W ? -0.7 : -0.15); }
    const pf = toMesh('polF', xf(plane(W ? 1.4 : 1.0, W ? 0.34 : 0.24), {}), scene, polM); pf.parent = node; pf.rotation.y = Math.PI;
    if (W) pf.position.set(0, 1.62, 2.69); else { pf.rotation.x = Math.PI / 2 - 0.12; pf.position.set(0, 1.08, 1.55); }
    // full-width blue lightbar on a dark base, two halves flashing alternately
    const by = W ? 3.02 : 1.69, bz = W ? 1.0 : 0.2, bw = W ? 1.9 : 1.3;
    const base = toMesh('lbB', xf(box(bw + 0.08, 0.06, 0.32), { t: [0, by - 0.07, bz] }), scene, darkM); base.parent = node;
    const b1 = toMesh('bar1', xf(box(bw / 2 - 0.02, 0.13, 0.28), { t: [-bw / 4, by, bz] }), scene, barM); b1.parent = node;
    const b2 = toMesh('bar2', xf(box(bw / 2 - 0.02, 0.13, 0.28), { t: [bw / 4, by, bz] }), scene, barM2); b2.parent = node;
    if (W) for (const sd of [-1, 1]) { const g = toMesh('grillB', xf(box(0.16, 0.08, 0.04), { t: [sd * 0.55, 0.9, 2.7] }), scene, sd < 0 ? barM : barM2); g.parent = node; } // front grille blues
  };
  const cars = [];
  // headlight pools on the tarmac (additive) + rear red wash
  const beamTex = new DynamicTexture('hlT', { width: 128, height: 256 }, scene, true); { const g = beamTex.getContext(); g.clearRect(0, 0, 128, 256);
    const gr = g.createRadialGradient(64, 230, 4, 64, 150, 130); gr.addColorStop(0, 'rgba(255,240,210,0.9)'); gr.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(52, 256); g.lineTo(76, 256); g.lineTo(128, 0); g.lineTo(0, 0); g.closePath(); g.fill();
    const gr2 = g.createRadialGradient(64, 0, 2, 64, 0, 40); gr2.addColorStop(0, 'rgba(255,40,30,0.7)'); gr2.addColorStop(1, 'rgba(255,40,30,0)'); g.fillStyle = gr2; g.fillRect(0, 0, 128, 40); beamTex.hasAlpha = true; beamTex.update(); }
  const hlM = new StandardMaterial('hlM', scene); hlM.diffuseTexture = beamTex; hlM.useAlphaFromDiffuseTexture = true; hlM.emissiveColor = new Color3(0.36, 0.34, 0.3); hlM.disableLighting = true; hlM.alphaMode = 1; hlM.backFaceCulling = false;
  const beamSrc = toMesh('hlBeam', xf(plane(4.2, 13), { r: [Math.PI / 2, 0, 0], t: [0, 0.1, 6.6] }), scene, hlM); beamSrc.position.y = -500; beamSrc.alwaysSelectAsActiveMesh = true;
  const N = low ? 24 : 58;
  const spawnSpec = [];
  for (let i = 0; i < N; i++) { const kind = ['saloon', 'hatch', 'saloon', 'cab', 'hatch', 'saloon', 'cab'][i % 7]; const col = kind === 'cab' ? hex('#121214') : COLS[Math.floor(R() * COLS.length)]; spawnSpec.push({ kind, col, key: kind + (kind === 'cab' ? '' : COLS.indexOf(col)) }); }
  for (let i = 0; i < (low ? 1 : 3); i++) spawnSpec.push({ kind: 'bus', col: hex('#7e2a91'), key: 'bus' });
  spawnSpec.push({ kind: 'estate', col: hex('#dcdfe3'), key: 'patrolcar', patrol: true }, { kind: 'estate', col: hex('#dcdfe3'), key: 'patrolcar', patrol: true });
  spawnSpec.push({ kind: 'wagon', col: hex('#d6d9dd'), key: 'patrolwagon', patrol: true }, { kind: 'wagon', col: hex('#b9bec4'), key: 'patrolwagon2', patrol: true });
  for (const s of spawnSpec) {
    const t = tpl(s.key, s.kind, s.col);
    const node = new TransformNode('car', scene); node.position.y = -0.085;
    const b = t.b.createInstance('ci'); b.parent = node; b.position.set(0, 0, 0); const l = t.l.createInstance('li'); l.parent = node; l.position.set(0, 0, 0);
    if (s.patrol) patrolDeco(node, s.kind);
    if (!low) { const hb = beamSrc.createInstance('hb'); hb.parent = node; hb.position.set(0, 0, 0); }
    cars.push({ node, kind: s.kind, patrol: !!s.patrol, a: 0, b: 0, s: 0, len: 1, speed: 0, max: s.kind === 'bus' ? 8 : s.kind === 'wagon' ? 9 : 10 + R() * 4, heading: 0, offset: 0 });
  }
  const placeCar = (c, near) => {
    for (let tries = 0; tries < 40; tries++) {
      const a = G.nodes[Math.floor(R() * G.nodes.length)]; const p = G.pos.get(a);
      const d = Math.hypot(p[0] - near.x, p[1] - near.z); if (d > 200 || d < 15) continue;
      const nb = G.adj.get(a); const b = nb[Math.floor(R() * nb.length)]; setEdge(c, a, b); c.s = 0; c.speed = c.max * 0.6; return true;
    }
    const a = G.nodes[Math.floor(R() * G.nodes.length)]; setEdge(c, a, G.adj.get(a)[0]); return false;
  };
  const setEdge = (c, a, b) => {
    c.a = a; c.b = b; const pa = G.pos.get(a), pb = G.pos.get(b); c.len = Math.max(0.01, Math.hypot(pb[0] - pa[0], pb[1] - pa[1]));
    const r = G.info.get(a + ',' + b); c.offset = r.o ? (r.ln > 1 ? r.w * 0.2 : 0) : Math.max(1.6, r.w / 4); c.road = r;
  };
  // parked cars along kerbs, a black-taxi rank and a bus waiting at a real stop
  const parked = []; let busStop = null;
  const park = (key, kind, col, x, z, h, extra) => { const tp = tpl(key, kind, col); const node = new TransformNode('parked', scene); node.position.set(x, -0.085, z); node.rotation.y = h;
    const b = tp.b.createInstance('pi'); b.parent = node; b.position.set(0, 0, 0); const l = tp.l.createInstance('pl'); l.parent = node; l.position.set(0, 0, 0); l.setEnabled(!!(extra && extra.lights)); parked.push({ node, kind }); return node; };
  const kerbSpots = []; for (const r of city.roads) { if (!r.d || !['residential', 'tertiary', 'unclassified', 'secondary'].includes(r.t) || r.w < 6) continue;
    for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 14) continue; const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      for (let s = 6; s < L - 6; s += 5.6) kerbSpots.push([a[0] + ux * s - uz * (r.w / 2 - 1.05), a[1] + uz * s + ux * (r.w / 2 - 1.05), Math.atan2(ux, uz)]); } }
  for (let i = 0; i < (low ? 30 : 90) && kerbSpots.length; i++) { const k = Math.floor(R() * kerbSpots.length); const [x, z, h] = kerbSpots.splice(k, 1)[0]; const kind = R() < 0.5 ? 'hatch' : 'saloon'; const ci = Math.floor(R() * COLS.length); park(kind + ci, kind, COLS[ci], x, z, h); }
  { const near = (x, z) => { let best = null, bd = 1e9; for (const r of city.roads) { if (!r.d || r.t === 'service') continue; for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 16) continue; const t = Math.max(0.2, Math.min(0.8, ((x - a[0]) * dx + (z - a[1]) * dz) / (L * L))); const px = a[0] + dx * t, pz = a[1] + dz * t; const d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; best = { px, pz, ux: dx / L, uz: dz / L, w: r.w, L }; } } } return best; };
    const tp = city.templeDoor; if (tp) { const s = near(tp.x + 30, tp.z - 10); if (s) for (let k = 0; k < 3; k++) park('cab', 'cab', hex('#121214'), s.px - s.ux * k * 5.4 - s.uz * (s.w / 2 - 1.1), s.pz - s.uz * k * 5.4 + s.ux * (s.w / 2 - 1.1), Math.atan2(s.ux, s.uz), { lights: true }); }
    const ref = tp || { x: 0, z: 0 }; let stop = null, sd = 1e9; for (const st of stops) { const d = Math.hypot(st[0] - ref.x, st[1] - ref.z); if (d < sd) { sd = d; stop = st; } }
    if (stop) { const s = near(stop[0], stop[1]); if (s) { const bx = s.px - s.uz * (s.w / 2 - 1.5), bz = s.pz + s.ux * (s.w / 2 - 1.5); park('bus', 'bus', hex('#7e2a91'), bx, bz, Math.atan2(s.ux, s.uz), { lights: true }); busStop = { x: bx - s.uz * 3.2, z: bz + s.ux * 3.2, h: Math.atan2(s.ux, s.uz) }; } } }
  if (busStop) { // bus shelter with a lit Reckless ad panel
    const shM = new StandardMaterial('shelter', scene); shM.diffuseColor = new Color3(1, 1, 1); shM.specularColor = new Color3(0.4, 0.4, 0.4);
    const sh = toMesh('busShelter', merge([color(xf(box(3.6, 0.08, 1.5), { t: [0, 2.5, 0] }), hex('#30343c')), ...[-1.75, 1.75].map(x => color(xf(box(0.08, 2.5, 0.08), { t: [x, 1.25, -0.65] }), hex('#30343c'))), color(xf(box(3.5, 2.1, 0.03), { t: [0, 1.25, -0.7] }), hex('#8fa4b8')), color(xf(box(2.2, 0.08, 0.4), { t: [0, 0.5, -0.45] }), hex('#30343c'))]), scene, shM);
    sh.position.set(busStop.x, 0, busStop.z); sh.rotation.y = busStop.h + Math.PI / 2;
    const adM = new StandardMaterial('shelterAd', scene); adM.disableLighting = true; const adT = new DynamicTexture('adT', { width: 256, height: 384 }, scene, true); { const g = adT.getContext(); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 384); g.fillStyle = '#fff'; g.font = '800 34px Unbounded, Arial'; g.textAlign = 'center'; g.fillText('RECKLESS', 128, 170); g.font = '600 18px "DM Sans", Arial'; g.fillText('THE TEMPLE · BELFAST', 128, 210); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(14, 14, 228, 356); adT.update(); }
    adM.emissiveTexture = adT; const ad = toMesh('shelterAdPanel', xf(plane(1.1, 1.65), { t: [1.15, 1.25, -0.74] }), scene, adM); ad.parent = sh; }
  // pedestrians: crowd of clay avatars, some in Drop 018 merch
  const peds = [];
  const pedN = low ? 10 : 30;
  const PCOL = ['#111114', '#f2f2f2', '#c62828', '#2e4a7d', '#5b6b3a', '#9e9e9e', '#d4a017'].map(hex);
  for (let i = 0; i < pedN; i++) {
    const merch = i % 3 === 0; const av = createAvatar(scene, { name: 'ped' + i, outfit: ['skate', 'stan', 'stanfull', 'skate', 'stan'][i % 5], decals: merch, lod: 0.4, palette: merch ? { tee: hex('#111114'), hoodie: hex('#111114'), denim: hex('#6f8fb3') } : { tee: PCOL[Math.floor(R() * PCOL.length)], hoodie: PCOL[Math.floor(R() * PCOL.length)], denim: Color3.Lerp(hex('#6f8fb3'), hex('#2c3e5c'), R()) } });
    const s = 0.94 + R() * 0.12; av.root.scaling.set(s, s, s);
    peds.push({ av, a: 0, b: 0, s: 0, len: 1, speed: 1.1 + R() * 0.5, side: R() < 0.5 ? -1 : 1 });
  }
  const setPedEdge = (p, a, b) => { p.a = a; p.b = b; const pa = PG.pos.get(a), pb = PG.pos.get(b); p.len = Math.max(0.01, Math.hypot(pb[0] - pa[0], pb[1] - pa[1])); const r = PG.info.get(a + ',' + b); p.off = r.d ? (r.w / 2 + 1.3) * p.side : 0; };
  const placePed = (p, near) => {
    for (let tries = 0; tries < 60; tries++) { const a = PG.nodes[Math.floor(R() * PG.nodes.length)]; const q = PG.pos.get(a); const d = Math.hypot(q[0] - near.x, q[1] - near.z);
      if (d < 120 && d > 8) { const nb = PG.adj.get(a); setPedEdge(p, a, nb[Math.floor(R() * nb.length)]); p.s = R() * p.len; return; } }
  };
  return { cars, parked, busStop, peds, G, PG, SIG, placeCar, setEdge, placePed, setPedEdge, barM, barM2, inited: false, R };
}

const tmp = new Vector3();
export function updateTraffic(T, dt, player, t) {
  const { G, PG } = T;
  if (!T.inited) { T.cars.forEach(c => T.placeCar(c, player)); T.peds.forEach(p => T.placePed(p, player)); T.inited = true; }
  for (const c of T.cars) {
    const pa = G.pos.get(c.a), pb = G.pos.get(c.b);
    const ux = (pb[0] - pa[0]) / c.len, uz = (pb[1] - pa[1]) / c.len;
    // stop for the player if they are in front of the car
    const cx = c.node.position.x, cz = c.node.position.z; const dx = player.x - cx, dz = player.z - cz;
    const ahead = dx * ux + dz * uz, lat = Math.abs(-dx * uz + dz * ux);
    let target = c.max; if (ahead > 0 && ahead < 11 && lat < 2.2) target = 0;
    for (const o of T.cars) { if (o === c) continue; const ox = o.node.position.x - cx, oz = o.node.position.z - cz; const ah = ox * ux + oz * uz; if (ah > 0 && ah < 9 && Math.abs(-ox * uz + oz * ux) < 1.6) { target = Math.min(target, Math.max(0, (ah - 5) * 1.5)); } }
    // corner slowdown
    if (c.len - c.s < 8) target = Math.min(target, c.max * 0.55);
    // stop at red signals: 24 s cycle, N-S green 0-10 s, all-red 10-12, E-W green 12-22, all-red 22-24
    if (T.SIG.has(c.b)) { const rem = c.len - c.s; if (rem < 22) { const ph = (t + T.SIG.get(c.b)) % 24, qa0 = G.pos.get(c.a), qb0 = G.pos.get(c.b);
      const ns = Math.abs(qb0[1] - qa0[1]) >= Math.abs(qb0[0] - qa0[0]); const green = ns ? ph < 10 : (ph >= 12 && ph < 22);
      if (!green && !(c.speed > 4 && rem < 4)) target = Math.min(target, Math.max(0, (rem - 7) * 0.9)); } }
    c.speed += (target - c.speed) * Math.min(1, dt * (target < c.speed ? 4 : 1.2));
    c.s += c.speed * dt;
    while (c.s >= c.len) {
      c.s -= c.len; const nb = (G.adj.get(c.b) || []).filter(n => n !== c.a);
      const next = nb.length ? nb[Math.floor(T.R() * nb.length)] : (G.adj.get(c.b) || [c.a])[0];
      T.setEdge(c, c.b, next);
    }
    const qa = G.pos.get(c.a), qb = G.pos.get(c.b); const vx = (qb[0] - qa[0]) / c.len, vz = (qb[1] - qa[1]) / c.len; const f = c.s;
    // drive on the left: offset to the left of travel direction
    const x = qa[0] + vx * f + (-vz) * c.offset, z = qa[1] + vz * f + vx * c.offset;
    const h = Math.atan2(vx, vz); let dh = h - c.heading; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    c.heading += dh * Math.min(1, dt * 6);
    c.node.position.x += (x - c.node.position.x) * Math.min(1, dt * 8); c.node.position.z += (z - c.node.position.z) * Math.min(1, dt * 8);
    c.node.rotation.y = c.heading;
    if (Math.hypot(c.node.position.x - player.x, c.node.position.z - player.z) > 330) { T.placeCar(c, player); const p = G.pos.get(c.a); c.node.position.set(p[0], -0.085, p[1]); }
  }
  const on = Math.floor(t * 4) % 2; T.barM.emissiveColor.set(on ? 0.15 : 0.1, on ? 0.4 : 0.1, on ? 1 : 0.2); T.barM2.emissiveColor.set(on ? 0.1 : 0.15, on ? 0.1 : 0.4, on ? 0.2 : 1);
  for (const p of T.peds) {
    p.s += p.speed * dt;
    while (p.s >= p.len) { p.s -= p.len; const nb = (PG.adj.get(p.b) || []).filter(n => n !== p.a); const next = nb.length ? nb[Math.floor(T.R() * nb.length)] : p.a; T.setPedEdge(p, p.b, next); }
    const qa = PG.pos.get(p.a), qb = PG.pos.get(p.b); const vx = (qb[0] - qa[0]) / p.len, vz = (qb[1] - qa[1]) / p.len;
    p.av.root.position.set(qa[0] + vx * p.s + (-vz) * p.off, 0, qa[1] + vz * p.s + vx * p.off);
    p.av.root.rotation.y = Math.atan2(vx, vz);
    const d = Math.hypot(p.av.root.position.x - player.x, p.av.root.position.z - player.z);
    if (d > 140) T.placePed(p, player);
    if (d < 70) animateAvatar(p.av, dt, { speed: p.speed });
  }
}
