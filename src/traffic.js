import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
// Pooled stylised traffic on OSM road graph (UK: drive on the LEFT), fictional patrol vehicles, pedestrians.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { hex, rng, box, cyl, rbox, xf, color, merge, toMesh, plane } from './geo.js';
import { createAvatar, animateAvatar } from './character.js';
import { CreatePlaneVertexData } from '@babylonjs/core/Meshes/Builders/planeBuilder';

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

// RECKLESS bus livery decals (research/asset-refs/bus_colour.png): one 1024x512 atlas, one merged quad mesh per bus, 1 draw call.
// Wordmark, BELFAST destination, R logo, roof stripes; number plates are left BLANK (no real-format plates, no operator marks).
// official Reckless monogram (assets_incoming/brand, white on transparent): drawn into the livery/shelter atlases once it loads
const LOGO = typeof Image !== 'undefined' ? new Image() : null; if (LOGO) LOGO.src = import.meta.env.BASE_URL + 'img/logo.png';
const withLogo = (fn) => { if (!LOGO) return; if (LOGO.complete && LOGO.naturalWidth) fn(LOGO); else LOGO.addEventListener('load', () => fn(LOGO), { once: true }); };
function busDecalTex(scene) {
  const W = 1024, H = 512, t = new DynamicTexture('busDecal', { width: W, height: H }, scene, true), c = t.getContext(); c.clearRect(0, 0, W, H);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#fff'; c.font = 'italic 900 132px "Arial Black", Arial, Helvetica, sans-serif'; c.fillText('RECKLESS', 512, 86);           // row 0: wordmark
  c.fillStyle = '#060608'; c.fillRect(0, 172, W, 168); c.fillStyle = '#ffae1a'; c.font = 'bold 112px "Courier New", monospace'; c.fillText('BELFAST', 512, 258); // row 1: destination (amber on black)
  const R = (x0, y0, s) => { c.save(); c.translate(x0, y0); c.fillStyle = '#fff'; c.font = 'italic 900 ' + (s * 0.95) + 'px "Arial Black", Arial, sans-serif'; c.fillText('R', 0, 4);
    c.strokeStyle = '#fff'; c.lineWidth = s * 0.07; c.beginPath(); c.moveTo(-s * 0.55, s * 0.36); c.quadraticCurveTo(0, s * 0.18, s * 0.6, -s * 0.3); c.stroke(); c.restore(); };
  withLogo((img) => { c.clearRect(0, 340, 172, 172); c.drawImage(img, 4, 344, 164, 164); t.update(); });                     // row 2: official monogram (0..170)
  c.fillStyle = '#fff'; for (const x of [210, 290]) { c.beginPath(); c.moveTo(x, 500); c.lineTo(x + 40, 500); c.lineTo(x + 100, 350); c.lineTo(x + 60, 350); c.fill(); } // roof stripes (180..400)
  c.fillStyle = '#f2f2ee'; c.fillRect(430, 380, 260, 80); c.fillStyle = '#f2c21a'; c.fillRect(740, 380, 260, 80);       // blank plates: front white, rear yellow
  t.hasAlpha = true; t.anisotropicFilteringLevel = 8; t.update(); return t;
}
const BUS_UV = { word: [0, 0, 1, 172 / 512], dest: [0.08, 172 / 512, 0.92, 340 / 512], logo: [0, 340 / 512, 170 / 1024, 1], stripes: [180 / 1024, 340 / 512, 400 / 1024, 1], plateF: [430 / 1024, 380 / 512, 690 / 1024, 460 / 512], plateR: [740 / 1024, 380 / 512, 1000 / 1024, 460 / 512] };
function busDecalVD() {
  const P = [], N = [], U = [], I = [];
  const quad = (c, r, n, w, h, key) => { const [u0, v0, u1, v1] = BUS_UV[key], b = P.length / 3, up = [n[1] * r[2] - n[2] * r[1], n[2] * r[0] - n[0] * r[2], n[0] * r[1] - n[1] * r[0]];
    for (const [sx, sy, u, v] of [[-1, -1, u1, v1], [1, -1, u0, v1], [1, 1, u0, v0], [-1, 1, u1, v0]]) { P.push(c[0] + r[0] * sx * w / 2 + up[0] * sy * h / 2, c[1] + r[1] * sx * w / 2 + up[1] * sy * h / 2, c[2] + r[2] * sx * w / 2 + up[2] * sy * h / 2); N.push(...n); U.push(u, 1 - v); }
    I.push(b, b + 2, b + 1, b, b + 3, b + 2); };
  const X = 1.29;
  for (const sd of [1, -1]) { const r = [0, 0, -sd], n = [sd, 0, 0];   // viewer's right on each flank (front of the bus is +z)
    quad([sd * X, 2.95, 3.0], r, n, 3.9, 0.42, 'word'); quad([sd * X, 2.95, -4.9], r, n, 3.9, 0.42, 'word');           // big italic RECKLESS on the roof band, both cars
    quad([sd * X, 2.94, -1.75], r, n, 0.95, 0.34, 'stripes'); quad([sd * X, 2.94, 6.6], r, n, 0.95, 0.34, 'stripes'); } // white slashes behind the bellows + toward the nose
  quad([0, 2.75, 8.968], [1, 0, 0], [0, 0, 1], 1.6, 0.24, 'dest'); quad([0, 0.8, 8.968], [1, 0, 0], [0, 0, 1], 0.5, 0.5, 'logo'); quad([0, 0.6, 8.968], [1, 0, 0], [0, 0, 1], 0.52, 0.12, 'plateF');
  quad([0, 1.95, -9.02], [-1, 0, 0], [0, 0, -1], 0.6, 0.6, 'logo'); quad([0, 1.5, -9.02], [-1, 0, 0], [0, 0, -1], 1.5, 0.26, 'word'); quad([0, 0.62, -9.02], [-1, 0, 0], [0, 0, -1], 0.52, 0.12, 'plateR');
  quad([0, 2.75, -9.02], [-1, 0, 0], [0, 0, -1], 1.2, 0.2, 'dest');
  const vd = new VertexData(); vd.positions = P; vd.normals = N; vd.uvs = U; vd.indices = I; return vd;
}
// lit bus glazing (bus_colour.png): window bays show the warm interior (light strip, purple seats, grab poles) through a tint;
// glazed doors with green open buttons + blue access icons. One 1024x512 atlas: window tile 0..512, door tile 512..1024.
function busGlassTex(scene) {
  const t = new DynamicTexture('busGlass', { width: 1024, height: 512 }, scene, true), c = t.getContext();
  const interior = (x0, w, floor) => { const g = c.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#fff1c8'); g.addColorStop(0.08, '#f2cf8a'); g.addColorStop(0.16, '#a07c50'); g.addColorStop(0.55, '#5a4634'); g.addColorStop(1, floor ? '#3a3038' : '#241c26'); c.fillStyle = g; c.fillRect(x0, 0, w, 512);
    c.fillStyle = 'rgba(20,24,40,0.85)'; c.fillRect(x0 + w * 0.12, 120, w * 0.76, 170); c.fillStyle = 'rgba(255,220,150,0.25)'; c.fillRect(x0 + w * 0.12, 120, w * 0.76, 6); }; // far-side windows
  interior(0, 512, false);
  for (const sx of [70, 290]) { c.fillStyle = '#5a1fb8'; c.beginPath(); c.roundRect(sx, 300, 150, 212, 26); c.fill(); c.fillStyle = '#7b3cf0'; c.beginPath(); c.roundRect(sx + 14, 314, 122, 70, 18); c.fill(); c.fillStyle = '#3a1278'; c.fillRect(sx + 8, 420, 134, 10); }
  c.fillStyle = '#e8c23a'; c.fillRect(250, 30, 12, 482); c.fillStyle = '#fff6d8'; c.fillRect(0, 18, 512, 16);
  c.fillStyle = 'rgba(8,10,18,0.32)'; c.fillRect(0, 0, 512, 512); c.fillStyle = 'rgba(255,255,255,0.07)'; c.beginPath(); c.moveTo(40, 512); c.lineTo(200, 0); c.lineTo(260, 0); c.lineTo(100, 512); c.fill();
  c.fillStyle = '#050507'; c.fillRect(0, 0, 14, 512); c.fillRect(498, 0, 14, 512); c.fillRect(0, 0, 512, 10); c.fillRect(0, 502, 512, 10);
  interior(512, 512, true); c.fillStyle = '#e8c23a'; c.fillRect(760, 30, 10, 482); c.fillStyle = '#fff6d8'; c.fillRect(512, 14, 512, 12);
  c.fillStyle = 'rgba(8,10,18,0.3)'; c.fillRect(512, 0, 512, 512);
  c.fillStyle = '#1a1b20'; for (const x of [512, 760, 1004]) c.fillRect(x, 0, 20, 512); c.fillRect(512, 0, 512, 16); c.fillRect(512, 496, 512, 16); c.fillRect(512, 250, 512, 10); // leaf frames + rail
  for (const bx of [740, 788]) { c.fillStyle = '#121216'; c.beginPath(); c.arc(bx, 200, 17, 0, 6.29); c.fill(); c.strokeStyle = '#4dff6a'; c.lineWidth = 6; c.beginPath(); c.arc(bx, 200, 13, 0, 6.29); c.stroke();
    c.fillStyle = '#1e6bff'; c.beginPath(); c.roundRect(bx - 14, 290, 28, 28, 5); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, 306, 7, 0, 6.29); c.fill(); }
  t.anisotropicFilteringLevel = 8; t.update(); return t;
}
function busGlassVD() {
  const P = [], N = [], U = [], I = [];
  const quad = (cz, sd, w, y0, y1, u0, u1) => { const b = P.length / 3, x = sd * 1.284;
    for (const [dz, y, u, v] of [[-1, y0, 0, 1], [1, y0, 1, 1], [1, y1, 1, 0], [-1, y1, 0, 0]]) { const uu = u0 + (u1 - u0) * (sd > 0 ? 1 - u : u); P.push(x, y, cz + dz * w / 2); N.push(sd, 0, 0); U.push(uu, 1 - v); }
    if (sd > 0) I.push(b, b + 1, b + 2, b, b + 2, b + 3); else I.push(b, b + 2, b + 1, b, b + 3, b + 2); };
  const DOORS = [7.75, 3.9, -3.2, -7.2];
  for (const sd of [1, -1]) for (const [z0, z1] of [[0.0, 7.2], [-8.75, -1.2]]) { const n = Math.round((z1 - z0) / 1.3); for (let k = 0; k < n; k++) { const zc = z0 + (k + 0.5) * (z1 - z0) / n;
    if (sd < 0 && DOORS.some(d => Math.abs(zc - d) < 1.25)) continue; quad(zc, sd, (z1 - z0) / n - 0.08, 1.44, 2.46, 0, 0.5); } }
  for (const d of DOORS) quad(d, -1, 1.22, 0.42, 2.56, 0.5, 1);
  const vd = new VertexData(); vd.positions = P; vd.normals = N; vd.uvs = U; vd.indices = I; return vd;
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
  } else if (kind === 'bus') { // generic purple 18 m articulated rapid-transit bus (Glider-style colour, no operator marks)
    for (const [z0, len] of [[4.2, 9.6], [-4.95, 8.1]]) { // front section 9.6 m, rear section 8.1 m, bellows between
      P.push(color(xf(rbox(2.55, 2.55, len, 0.12, 10), { t: [0, 1.62, z0] }), body));
      P.push(color(xf(box(2.59, 1.0, len - 1.0), { t: [0, 2.08, z0 - 0.1] }), glass));
      P.push(color(xf(rbox(2.57, 0.25, len + 0.02, 0.2, 8), { t: [0, 0.48, z0] }), hex('#3a1446')));
      P.push(color(xf(box(2.58, 0.12, len - 0.6), { t: [0, 1.05, z0] }), hex('#e8e0ee'))); // pale waist band
      P.push(color(xf(rbox(2.2, 0.3, len * 0.45, 0.3, 8), { t: [0, 3.0, z0] }), Color3.Lerp(body, hex('#ffffff'), 0.15))); }
    P.push(color(xf(box(2.3, 1.6, 0.05), { t: [0, 2.0, 9.0] }), glass));
    P.push(color(xf(box(1.6, 0.25, 0.04), { t: [0, 2.92, 9.01] }), hex('#ffb000')));
    P.push(color(xf(box(2.45, 2.45, 0.9), { t: [0, 1.7, -0.6] }), hex('#1a1420'))); // articulation bellows
  } else if (kind === 'cab') { // Belfast black cab (classic tall hackney shape)
    P.push(color(xf(rbox(1.9, 0.85, 4.55, 0.28, 10), { t: [0, 0.78, 0] }), body));
    P.push(color(xf(rbox(1.75, 0.74, 2.7, 0.26, 10), { t: [0, 1.5, -0.35] }), body)); // roof ~1.85 m (TX-style hackney)
    P.push(color(xf(box(1.77, 0.42, 2.5), { t: [0, 1.53, -0.35] }), glass));
    P.push(color(xf(rbox(0.95, 0.22, 0.95, 0.25, 8), { t: [0, 0.62, 2.1] }), hex('#c9ccd2'))); // grille
    P.push(color(xf(rbox(0.55, 0.16, 0.22, 0.3, 6), { t: [0, 1.9, 0.6] }), hex('#ffb12a'))); // TAXI light
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
  const wz = kind === 'bus' ? 4.0 : kind === 'wagon' ? 1.7 : 1.35, wx = kind === 'bus' ? 1.12 : kind === 'wagon' ? 1.0 : 0.76, wr = kind === 'bus' ? 0.5 : kind === 'wagon' ? 0.42 : 0.33;
  const AX = kind === 'bus' ? [6.6 / wz, -1.9 / wz, -7.4 / wz] : [-1, 1]; // bus: front, middle and trailer axles
  for (const a of [-1, 1]) for (const b of AX) { P.push(color(xf(cyl(0.3, wr, wr, 14), { r: [0, 0, Math.PI / 2], t: [a * wx, wr, b * wz] }), tyre)); P.push(color(xf(cyl(0.31, wr * 0.55, wr * 0.55, 10), { r: [0, 0, Math.PI / 2], t: [a * wx, wr, b * wz] }), rim)); }
  return merge(P);
}
const HALF = c => c.kind === 'bus' ? 9 : c.kind === 'wagon' ? 2.7 : 2.3; // half body length for following gaps
function lightsVD(kind) { // headlights front (+z), tail lights back
  const L = kind === 'bus' ? 9.02 : kind === 'wagon' ? 2.68 : kind === 'estate' ? 2.36 : kind === 'hatch' ? 1.92 : kind === 'cab' ? 2.3 : 2.22, y = kind === 'bus' ? 0.75 : kind === 'wagon' ? 1.0 : 0.78, x = kind === 'bus' ? 0.95 : kind === 'wagon' ? 0.85 : 0.62;
  const P = []; for (const sd of [-1, 1]) { P.push(color(xf(box(0.36, 0.14, 0.06), { t: [sd * x, y, L] }), hex('#fff6dc'))); P.push(color(xf(box(0.34, 0.14, 0.06), { t: [sd * x, y, -L] }), hex('#ff2020'))); }
  return merge(P);
}

// CC0 Kenney Car Kit bodies (tools/blender/export_cars.py -> data/cars.json): palette colours, paint colour re-tinted per car
const MODEL_OF = { saloon: 'sedan', hatch: 'hatchback-sports', taxi: 'taxi', suv: 'suv', van: 'van', bus: 'glider', wagon: 'wagon', estate: 'suv', pestate: 'pestate' }; // glider + wagon: tools/gen_vehicles.py
function modelVD(M, kind, col, part = 'body') {
  const m = M && M[MODEL_OF[kind]]; if (!m) return null; const EM = new Set(m.emit || []);
  const b64 = (str) => Uint8Array.from(atob(str), ch => ch.charCodeAt(0)).buffer;
  const pos = new Int16Array(b64(m.pos)), ci = new Uint8Array(b64(m.col)), ind = new Uint16Array(b64(m.ind));
  const hsv = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d > 1e-4) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, mx > 0 ? d / mx : 0, mx]; };
  const pc = m.paint >= 0 ? m.pal[m.paint] : [0, 0, 0], [ph, ps, pv] = hsv(pc);
  const pal = m.pal.map(e => { if (m.paint < 0) return e; const [h, sat, v] = hsv(e); const dh = Math.min(Math.abs(h - ph), 360 - Math.abs(h - ph));
    const isPaint = ps > 0.3 ? (sat > 0.2 && dh < 20) : Math.hypot(e[0] - pc[0], e[1] - pc[1], e[2] - pc[2]) < 0.035;
    if (!isPaint) return e; const k = Math.min(1.25, v / pv); return [col.r * k, col.g * k, col.b * k]; });
  const n = ci.length, P = new Float32Array(n * 3), C = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { P[i * 3] = pos[i * 3] * m.scale; P[i * 3 + 1] = pos[i * 3 + 1] * m.scale; P[i * 3 + 2] = pos[i * 3 + 2] * m.scale;
    const c = pal[ci[i]]; C[i * 4] = c[0]; C[i * 4 + 1] = c[1]; C[i * 4 + 2] = c[2]; C[i * 4 + 3] = 1; }
  let I = Array.from(ind); if (EM.size || part === 'lights') { const keep = []; for (let t = 0; t < I.length; t += 3) { const e = EM.has(ci[I[t]]); if (e === (part === 'lights')) keep.push(I[t], I[t + 1], I[t + 2]); } I = keep; }
  if (part === 'lights' && !I.length) return null;
  const vd = new VertexData(); vd.positions = P; vd.colors = C; vd.indices = I; vd.normals = []; VertexData.ComputeNormals(vd.positions, vd.indices, vd.normals); return vd;
}
export function buildTraffic(scene, city, { low = false, stops = [], signals = [], models = null } = {}) {
  const R = rng(77);
  const G = buildGraph(city.roads, true), PG = buildGraph(city.roads, false);
  // Real OSM traffic-signal nodes -> graph junction nodes (within 6 m). Two-phase cycle per junction: N-S then E-W.
  const SIG = new Map(); { const cell = new Map(); for (const [id, p] of G.pos) { const k = Math.floor(p[0] / 12) + ',' + Math.floor(p[1] / 12); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(id); }
    for (const [x, z] of signals) { let best = null, bd = 6; const gx = Math.floor(x / 12), gz = Math.floor(z / 12);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const id of cell.get((gx + i) + ',' + (gz + j)) || []) { const p = G.pos.get(id); const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = id; } }
      if (best != null) SIG.set(best, ((x * 0.137 + z * 0.291) % 1 + 1) % 1 * 24); } }
  const bodyM = new StandardMaterial('carBody', scene); bodyM.specularColor = new Color3(0.55, 0.55, 0.6); bodyM.specularPower = 64; bodyM.emissiveColor = new Color3(0.07, 0.07, 0.08); if (scene.__env) { bodyM.reflectionTexture = scene.__env; const f = new FresnelParameters(); f.bias = 0.08; f.power = 2; f.leftColor = new Color3(0.7, 0.7, 0.75); f.rightColor = new Color3(0.1, 0.1, 0.12); bodyM.reflectionFresnelParameters = f; }
  const wagonM = new StandardMaterial('wagonBody', scene); wagonM.specularColor = new Color3(0.12, 0.12, 0.13); wagonM.specularPower = 18; wagonM.emissiveColor = new Color3(0.05, 0.05, 0.055); // matte armour paint
  const lightM = new StandardMaterial('carLights', scene); lightM.disableLighting = true; lightM.emissiveColor = Color3.White();
  const COLS = ['#d64545', '#f2f2f2', '#2b2b30', '#3f6fd8', '#e7c33a', '#7d8a96', '#4e9a6b', '#b8b0a0', '#c2185b'].map(hex);
  const templates = {};
  const tpl = (key, kind, col) => {
    if (templates[key]) return templates[key];
    if (key === 'patrolcar' && models && models.pestate) kind = 'pestate'; // modelled patrol estate (tools/gen_vehicles.py)
    const b = toMesh('car-' + key, (MODEL_OF[kind] && modelVD(models, kind, col)) || carVD(kind, col), scene, kind === 'wagon' ? wagonM : bodyM); const l = toMesh('carL-' + key, (models && models[MODEL_OF[kind]] && models[MODEL_OF[kind]].emit && modelVD(models, kind, col, 'lights')) || lightsVD(kind), scene, lightM);
    b.position.y = -500; l.position.y = -500; b.alwaysSelectAsActiveMesh = true; l.alwaysSelectAsActiveMesh = true; return (templates[key] = { b, l, kind });
  };
  // patrol livery meshes (fictional Belfast-style; Battenburg side panels, blue roof bar, no marks)
  const bbM = new StandardMaterial('bbM', scene); bbM.diffuseTexture = battenburgTex(scene); bbM.diffuseTexture.uScale = 1; bbM.diffuseTexture.wAng = 0; bbM.specularColor = new Color3(0.3, 0.3, 0.3); bbM.emissiveColor = new Color3(0.12, 0.12, 0.12);
  const barM = new StandardMaterial('barM', scene); barM.disableLighting = true; barM.emissiveColor = hex('#2a6bff');
  const barM2 = new StandardMaterial('barM2', scene); barM2.disableLighting = true; barM2.emissiveColor = hex('#2a6bff');
  const polM = new StandardMaterial('polM', scene); polM.diffuseTexture = policeTex(scene); polM.useAlphaFromDiffuseTexture = true; polM.emissiveColor = new Color3(0.25, 0.25, 0.3); polM.specularColor = Color3.Black();
  bbM.emissiveColor = new Color3(0.22, 0.22, 0.22); // retro-reflective
  const busDM = new StandardMaterial('busDecalM', scene); busDM.diffuseTexture = busDecalTex(scene); busDM.useAlphaFromDiffuseTexture = true; busDM.emissiveTexture = busDM.diffuseTexture; busDM.emissiveColor = new Color3(0.45, 0.45, 0.45); busDM.specularColor = new Color3(0.2, 0.2, 0.2); busDM.backFaceCulling = false;
  const busGM = new StandardMaterial('busGlassM', scene); busGM.diffuseTexture = busGlassTex(scene); busGM.emissiveTexture = busGM.diffuseTexture; busGM.emissiveColor = new Color3(0.5, 0.48, 0.46); busGM.specularColor = new Color3(0.9, 0.9, 0.95); busGM.specularPower = 128; busGM.backFaceCulling = false;
  let busDT = null, busGT = null; const busDeco = (node) => { if (!busDT) { busDT = new Mesh('busDecal', scene); busDecalVD().applyToMesh(busDT); busDT.material = busDM; busDT.position.y = -500; busDT.alwaysSelectAsActiveMesh = true;
      busGT = new Mesh('busGlass', scene); busGlassVD().applyToMesh(busGT); busGT.material = busGM; busGT.position.y = -500; busGT.alwaysSelectAsActiveMesh = true; }
    const d = busDT.createInstance('bd'); d.parent = node; d.position.set(0, 0, 0); const g = busGT.createInstance('bg'); g.parent = node; g.position.set(0, 0, 0); };
  const darkM = new StandardMaterial('lbBase', scene); darkM.diffuseColor = hex('#1b1d22'); darkM.specularColor = new Color3(0.2, 0.2, 0.2);
  const patrolDeco = (node, kind) => {
    const W = kind === 'wagon';
    if (models && models[MODEL_OF[kind]]) { // modelled patrol vehicles: Battenburg baked into the wagon body; plain POLICE lettering + blue bar here
      const mw = W ? 0.995 : 0.965;
      const PE = !W && models.pestate; // patrol estate model has the Battenburg baked in
      if (!W && !PE) { if (!bbM.__vc) { bbM.__vc = new StandardMaterial('bbVC', scene); bbM.__vc.diffuseColor = Color3.White(); bbM.__vc.emissiveColor = new Color3(0.07, 0.07, 0.07); bbM.__vc.specularColor = new Color3(0.3, 0.3, 0.3); }
        const Q = [], Y = hex('#f5cc1a'), B = hex('#123a9e'), n = 20, sq = 3.8 / n; // retro-reflective Battenburg: two rows of square checks
        for (const sd of [-1, 1]) for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) Q.push(color(xf(box(0.02, sq, sq), { t: [sd * mw, 0.72 + (j - 0.5) * sq, -1.85 + (i + 0.5) * sq] }), (i + j) % 2 ? B : Y));
        const p = toMesh('bb', merge(Q), scene, bodyM); p.parent = node; } // same material as the wagon's baked checks -> identical crisp yellow/blue
      if (W) for (const sd of [-1, 1]) { const pl = toMesh('polS', xf(plane(1.5, 0.38), {}), scene, polM); pl.parent = node; pl.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2; pl.position.set(sd * (mw + 0.016), 1.9, -1.45); pl.scaling.set(0.8, 0.8, 1); }
      const pf = toMesh('polF', xf(plane(W ? 0.62 : 0.8, W ? 0.13 : 0.19), {}), scene, polM); pf.parent = node; pf.rotation.y = Math.PI;
      if (W) pf.position.set(0, 1.13, 2.32); else if (PE) { pf.rotation.x = Math.PI / 2 - 0.12; pf.position.set(0, 0.875, 1.85); } else { pf.rotation.x = Math.PI / 2 - 0.2; pf.position.set(0, 1.07, 1.75); }
      if (W) { // armoured wagon: two blue lights at the front corners of the roof pod, alternating; small blues in the bumper
        for (const sd of [-1, 1]) { const d = toMesh('wBlue', xf(box(0.18, 0.15, 0.18), { t: [sd * 0.72, 2.34, 0.98] }), scene, sd < 0 ? barM : barM2); d.parent = node; }
        for (const sd of [-1, 1]) { const g = toMesh('grillB', xf(box(0.14, 0.07, 0.03), { t: [sd * 0.45, 0.58, 2.38] }), scene, sd < 0 ? barM : barM2); g.parent = node; }
        return; }
      const by = W ? 3.12 : PE ? 1.6 : 1.8, bz = W ? 0.9 : PE ? -0.6 : -0.1, bw = W ? 1.9 : 1.3;
      const base = toMesh('lbB', xf(box(bw + 0.08, 0.06, 0.32), { t: [0, by - 0.07, bz] }), scene, darkM); base.parent = node;
      const b1 = toMesh('bar1', xf(box(bw / 2 - 0.02, 0.13, 0.28), { t: [-bw / 4, by, bz] }), scene, barM); b1.parent = node;
      const b2 = toMesh('bar2', xf(box(bw / 2 - 0.02, 0.13, 0.28), { t: [bw / 4, by, bz] }), scene, barM2); b2.parent = node;
      if (W) for (const sd of [-1, 1]) { const g = toMesh('grillB', xf(box(0.16, 0.08, 0.04), { t: [sd * 0.45, 1.85, 2.58] }), scene, sd < 0 ? barM : barM2); g.parent = node; }
      return;
    }
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
  for (let i = 0; i < N; i++) { const kind = models ? ['saloon', 'hatch', 'suv', 'cab', 'saloon', 'van', 'cab', 'hatch', 'saloon', 'taxi'][i % 10] : ['saloon', 'hatch', 'saloon', 'cab', 'hatch', 'saloon', 'cab'][i % 7]; const col = kind === 'cab' ? hex('#121214') : kind === 'taxi' ? hex('#f4c21a') : COLS[Math.floor(R() * COLS.length)]; spawnSpec.push({ kind, col, key: kind + (kind === 'cab' ? '' : COLS.indexOf(col)) }); }
  for (let i = 0; i < (low ? 1 : 3); i++) spawnSpec.push({ kind: 'bus', col: hex('#7e2a91'), key: 'bus' });
  spawnSpec.push({ kind: 'estate', col: hex('#9ea2aa'), key: 'patrolcar', patrol: true }, { kind: 'estate', col: hex('#9ea2aa'), key: 'patrolcar', patrol: true });
  spawnSpec.push({ kind: 'wagon', col: hex('#d6d9dd'), key: 'patrolwagon', patrol: true }, { kind: 'wagon', col: hex('#b9bec4'), key: 'patrolwagon2', patrol: true });
  for (const s of spawnSpec) {
    const t = tpl(s.key, s.kind, s.col);
    const node = new TransformNode('car', scene); node.position.y = -0.085;
    const b = t.b.createInstance('ci'); b.parent = node; b.position.set(0, 0, 0); const l = t.l.createInstance('li'); l.parent = node; l.position.set(0, 0, 0);
    if (s.patrol) patrolDeco(node, s.kind);
    if (s.kind === 'bus' && models && models.glider) busDeco(node);
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
    const r = G.info.get(a + ',' + b); c.offset = r.o ? (r.ln > 1 ? r.w * 0.2 : 0) : Math.max(1.6, r.w / 4); if (c.kind === 'bus' || c.kind === 'wagon') { const half = c.kind === 'bus' ? 1.6 : 1.45; c.offset = r.o ? Math.min(c.offset, Math.max(0, r.w / 2 - half)) : Math.max(1.35, Math.min(c.offset, r.w / 2 - half)); } c.road = r; /* big vehicles keep clear of the kerb */
  };
  // parked cars along kerbs, a black-taxi rank and a bus waiting at a real stop
  const parked = []; let busStop = null;
  const park = (key, kind, col, x, z, h, extra) => { const tp = tpl(key, kind, col); const node = new TransformNode('parked', scene); node.position.set(x, -0.085, z); node.rotation.y = h;
    const b = tp.b.createInstance('pi'); b.parent = node; b.position.set(0, 0, 0); const l = tp.l.createInstance('pl'); l.parent = node; l.position.set(0, 0, 0); l.setEnabled(!!(extra && extra.lights)); if (kind === 'bus' && models && models.glider) busDeco(node); parked.push({ node, kind, key, l }); return node; };
  const kerbSpots = []; for (const r of city.roads) { if (!r.d || !['residential', 'tertiary', 'unclassified', 'secondary'].includes(r.t) || r.w < 6) continue;
    for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 14) continue; const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      for (let s = 6; s < L - 6; s += 5.6) kerbSpots.push([a[0] + ux * s - uz * (r.w / 2 - 1.05), a[1] + uz * s + ux * (r.w / 2 - 1.05), Math.atan2(ux, uz)]); } }
  for (let i = 0; i < (low ? 30 : 90) && kerbSpots.length; i++) { const k = Math.floor(R() * kerbSpots.length); const [x, z, h] = kerbSpots.splice(k, 1)[0]; const kind = R() < 0.5 ? 'hatch' : 'saloon'; const ci = Math.floor(R() * COLS.length); park(kind + ci, kind, COLS[ci], x, z, h); }
  let near; { near = (x, z) => { let best = null, bd = 1e9; for (const r of city.roads) { if (!r.d || r.t === 'service') continue; for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 16) continue; const t = Math.max(0.2, Math.min(0.8, ((x - a[0]) * dx + (z - a[1]) * dz) / (L * L))); const px = a[0] + dx * t, pz = a[1] + dz * t; const d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; best = { px, pz, ux: dx / L, uz: dz / L, w: r.w, L }; } } } return best; };
    const tp = city.templeDoor; if (tp) { const s = near(tp.x + 30, tp.z - 10); if (s) for (let k = 0; k < 3; k++) park('cab', 'cab', hex('#121214'), s.px - s.ux * k * 5.4 - s.uz * (s.w / 2 - 1.1), s.pz - s.uz * k * 5.4 + s.ux * (s.w / 2 - 1.1), Math.atan2(s.ux, s.uz), { lights: true }); }
    const ref = tp || { x: 0, z: 0 }; let stop = null, sd = 1e9; for (const st of stops) { const d = Math.hypot(st[0] - ref.x, st[1] - ref.z); if (d < sd) { sd = d; stop = st; } }
    if (stop) { const s = near(stop[0], stop[1]); if (s) { const bx = s.px - s.uz * (s.w / 2 - 1.65), bz = s.pz + s.ux * (s.w / 2 - 1.65); park('bus', 'bus', hex('#7e2a91'), bx, bz, Math.atan2(s.ux, s.uz), { lights: true }); busStop = { x: bx - s.uz * 3.2, z: bz + s.ux * 3.2, h: Math.atan2(s.ux, s.uz) }; } } }
  // bus shelters (lit Reckless ad panel) at the Temple's real stop and a rapid-bus fast-travel stop by every venue
  // Reckless bus shelter (research/asset-refs/street_kit_colour.png): dark frame, roof with RECKLESS fascia + warm under-light, glass back/side,
  // red bench, lit R ad panel, purple stop flag, an R bin and two bollards. Shared materials/textures: ~3 draw calls per stop, ~900 tris.
  const shM = new StandardMaterial('shelter', scene); shM.diffuseColor = new Color3(1, 1, 1); shM.specularColor = new Color3(0.35, 0.35, 0.38);
  const glM = new StandardMaterial('shelterGlass', scene); glM.diffuseColor = hex('#9fb4c8'); glM.alpha = 0.28; glM.specularColor = new Color3(0.9, 0.9, 1); glM.specularPower = 96; glM.backFaceCulling = false;
  const shT = new DynamicTexture('shelterAtlas', { width: 512, height: 512 }, scene, true); { const g = shT.getContext();
    const gr = g.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, '#12051f'); gr.addColorStop(0.55, '#5a1aa8'); gr.addColorStop(1, '#a43cff'); g.fillStyle = gr; g.fillRect(0, 0, 256, 384); // ad panel (0..256 x 0..384)
    g.fillStyle = '#0a0410'; for (let k = 0; k < 26; k++) { const x = k * 10 + (k % 3) * 3, h = 40 + (k * 37 % 50); g.beginPath(); g.arc(x, 384 - h, 9, 0, 6.28); g.fill(); g.fillRect(x - 8, 384 - h, 16, h); if (k % 4 === 0) { g.fillRect(x - 2, 384 - h - 46, 4, 40); } } // crowd, hands up
    g.fillStyle = '#fff'; g.textAlign = 'center'; withLogo((img) => { g.drawImage(img, 38, 30, 180, 180); g.drawImage(img, 317, 8, 150, 150); shT.update(); });
    g.font = 'italic 900 40px "Arial Black", Arial'; g.fillText('RECKLESS', 128, 252);
    g.fillStyle = '#26282e'; g.fillRect(0, 400, 512, 112); g.fillStyle = '#fff'; g.font = 'italic 900 64px "Arial Black", Arial'; g.fillText('RECKLESS', 256, 478); // roof fascia (y 400..512)
    g.fillStyle = '#5b2a9e'; g.fillRect(272, 0, 240, 300); g.fillStyle = '#fff'; g.font = '800 44px Arial'; g.fillText('Bus Stop', 392, 210); // stop flag (272..512 x 0..300)
    g.fillStyle = '#ffd27a'; g.fillRect(272, 320, 240, 60); shT.update(); } // under-roof light strip (272..512 x 320..380)
  const shLit = new StandardMaterial('shelterLit', scene); shLit.disableLighting = true; shLit.emissiveTexture = shT;
  const uvq = (w, h, u0, v0, u1, v1, o) => { const vd = xf(CreatePlaneVertexData({ width: w, height: h }), o); const U = []; for (let k = 0; k < vd.positions.length / 3; k++) { const a = vd.uvs[k * 2], b = vd.uvs[k * 2 + 1]; U.push(u0 + (u1 - u0) * a, 1 - (v0 + (v1 - v0) * (1 - b))); } vd.uvs = U; return vd; };
  const FR = hex('#3a3d45'), RD = hex('#e8401c'), DK = hex('#2a2c33'), PU = hex('#7b2cff'), MG = hex('#8a8f99');
  const frameVD = merge([color(xf(box(3.9, 0.14, 1.75), { t: [0, 2.62, 0.05] }), FR), color(xf(box(3.9, 0.05, 1.6), { t: [0, 2.53, 0.05] }), hex('#1c1d22')),
    ...[-1.9, 1.9].flatMap(x => [color(xf(box(0.09, 2.6, 0.09), { t: [x, 1.3, -0.68] }), FR), color(xf(box(0.09, 2.6, 0.09), { t: [x, 1.3, 0.68] }), FR)]),
    ...[-0.63, 0.63].map(x => color(xf(box(0.06, 2.5, 0.06), { t: [x, 1.25, -0.7] }), FR)), color(xf(box(3.8, 0.06, 0.05), { t: [0, 0.32, -0.7] }), FR), color(xf(box(3.8, 0.05, 0.05), { t: [0, 1.6, -0.7] }), FR),
    color(xf(box(1.9, 0.12, 0.42), { t: [-0.4, 0.5, -0.42] }), RD), ...[-1.3, 0.5].map(x => color(xf(box(0.1, 0.5, 0.42), { t: [x, 0.25, -0.42] }), RD)), // red bench
    color(xf(box(1.3, 1.9, 0.12), { t: [1.18, 1.3, 0.62] }), DK), // ad panel housing (side)
    color(xf(cyl(2.9, 0.045, 0.045, 8), { t: [-2.5, 1.45, 0.75] }), MG), // stop flag pole
    color(xf(rbox(0.46, 0.92, 0.46, 0.06, 2), { t: [2.45, 0.46, 0.5] }), DK), color(xf(box(0.48, 0.09, 0.48), { t: [2.45, 0.76, 0.5] }), PU), // R bin
    ...[-3.0, 3.0].map(x => color(xf(cyl(0.95, 0.08, 0.09, 8), { t: [x, 0.475, 1.25] }), DK))]); // bollards
  const glassVD = merge([xf(box(3.7, 2.15, 0.02), { t: [0, 1.4, -0.7] }), xf(box(0.02, 2.15, 1.2), { t: [-1.9, 1.4, -0.05] })]);
  const litVD = merge([uvq(1.12, 1.68, 0, 0, 0.5, 0.75, { t: [1.18, 1.3, 0.555] }), uvq(1.12, 1.68, 0, 0, 0.5, 0.75, { t: [1.18, 1.3, 0.685], r: [0, Math.PI, 0] }), // ad, both faces
    uvq(3.9, 0.14, 0, 400 / 512, 1, 1, { t: [0, 2.62, 0.93], r: [0, Math.PI, 0] }), uvq(3.9, 0.14, 0, 400 / 512, 1, 1, { t: [0, 2.62, -0.83] }), // fascia front/back
    uvq(0.62, 0.78, 272 / 512, 0, 1, 300 / 512, { t: [-2.5, 2.6, 0.78] }), uvq(0.62, 0.78, 272 / 512, 0, 1, 300 / 512, { t: [-2.5, 2.6, 0.72], r: [0, Math.PI, 0] }), // stop flag
    uvq(3.2, 0.06, 272 / 512, 320 / 512, 1, 380 / 512, { t: [0, 2.5, 0.2], r: [-Math.PI / 2, 0, 0] })]); // light strip under the roof
  const mkShelter = (st) => {
    const sh = toMesh('busShelter-' + st.id, frameVD, scene, shM); sh.position.set(st.x, 0, st.z); sh.rotation.y = st.h + Math.PI / 2;
    const gl = toMesh('shelterGlass-' + st.id, glassVD, scene, glM); gl.parent = sh; const lit = toMesh('shelterLit-' + st.id, litVD, scene, shLit); lit.parent = sh;
    return sh; };
  const rapid = [];
  if (busStop) { mkShelter({ ...busStop, id: 'temple' }); }
  const addStops = (venueStops) => { for (const v of venueStops) {
    if (v.id === 'temple' && busStop) { const bx = busStop.x + Math.cos(busStop.h) * 3.2, bz = busStop.z - Math.sin(busStop.h) * 3.2; rapid.push({ ...v, sx: busStop.x, sz: busStop.z, bx, bz, h: busStop.h, ux: Math.sin(busStop.h), uz: Math.cos(busStop.h) }); continue; }
    const sN = near(v.x, v.z); if (!sN) continue;
    let side = 1; { const nx = -sN.uz, nz = sN.ux; if ((v.x - sN.px) * nx + (v.z - sN.pz) * nz < 0) side = -1; } // kerb on the venue's side of the road
    const nx = -sN.uz * side, nz = sN.ux * side; const ux = sN.ux * side, uz = sN.uz * side; // drive on the left: travel so the kerb is on the left
    const sh = 10, bx = sN.px + nx * (sN.w / 2 - 1.65) + ux * sh, bz = sN.pz + nz * (sN.w / 2 - 1.65) + uz * sh, sx = sN.px + nx * (sN.w / 2 + 1.6) + ux * sh, sz = sN.pz + nz * (sN.w / 2 + 1.6) + uz * sh;
    const st = { ...v, sx, sz, bx, bz, h: Math.atan2(ux, uz), ux, uz };
    mkShelter({ id: v.id, x: sx + nx * 0.9, z: sz + nz * 0.9, h: st.h, ad: v.name }); rapid.push(st);
  } return rapid; };
  // pedestrians: crowd of clay avatars, some in Drop 018 merch
  const peds = [];
  const pedN = low ? 10 : 30;
  const PCOL = ['#111114', '#f2f2f2', '#c62828', '#2e4a7d', '#5b6b3a', '#9e9e9e', '#d4a017'].map(hex);
  for (let i = 0; i < pedN; i++) {
    const merch = i % 3 === 0; const av = createAvatar(scene, { name: 'ped' + i, outfit: ['skate', 'stan', 'stanfull', 'skate', 'stan'][i % 5], decals: merch, lod: 0.4, palette: merch ? { tee: hex('#111114'), hoodie: hex('#111114'), denim: hex('#6f8fb3') } : { tee: PCOL[Math.floor(R() * PCOL.length)], hoodie: PCOL[Math.floor(R() * PCOL.length)], denim: Color3.Lerp(hex('#6f8fb3'), hex('#2c3e5c'), R()) } });
    const s = 0.94 + R() * 0.12; av.root.scaling.set(s, s, s);
    peds.push({ av, a: 0, b: 0, s: 0, len: 1, speed: 1.1 + R() * 0.5, side: R() < 0.5 ? -1 : 1 });
  }
  // venue queues: a small pool of idle clay avatars, moved to whichever venue queue lane the player is nearest
  const qPool = []; for (let i = 0; i < (low ? 3 : 6); i++) { const av = createAvatar(scene, { name: 'qped' + i, outfit: ['stan', 'skate', 'stanfull'][i % 3], decals: i % 2 === 0, lod: 0.4, palette: { tee: PCOL[Math.floor(R() * PCOL.length)], hoodie: PCOL[Math.floor(R() * PCOL.length)], denim: Color3.Lerp(hex('#6f8fb3'), hex('#2c3e5c'), R()) } });
    const s = 0.93 + R() * 0.13; av.root.scaling.set(s, s, s); av.root.setEnabled(false); qPool.push(av); }
  const setPedEdge = (p, a, b) => { p.a = a; p.b = b; const pa = PG.pos.get(a), pb = PG.pos.get(b); p.len = Math.max(0.01, Math.hypot(pb[0] - pa[0], pb[1] - pa[1])); const r = PG.info.get(a + ',' + b); p.off = r.d ? (r.w / 2 + 1.3) * p.side : 0; };
  const placePed = (p, near) => {
    for (let tries = 0; tries < 60; tries++) { const a = PG.nodes[Math.floor(R() * PG.nodes.length)]; const q = PG.pos.get(a); const d = Math.hypot(q[0] - near.x, q[1] - near.z);
      if (d < 120 && d > 8) { const nb = PG.adj.get(a); setPedEdge(p, a, nb[Math.floor(R() * nb.length)]); p.s = R() * p.len; return; } }
  };
  return { cars, parked, busStop, rapid, addStops, qPool, queues: [], qCur: null, tpl, peds, G, PG, SIG, placeCar, setEdge, placePed, setPedEdge, barM, barM2, inited: false, R };
}

const tmp = new Vector3();
export function updateTraffic(T, dt, player, t) {
  const { G, PG } = T;
  if (!T.inited) { T.cars.forEach(c => T.placeCar(c, player)); T.peds.forEach(p => T.placePed(p, player)); T.inited = true; }
  for (const c of T.cars) {
    if (c.chase) continue; // driven by src/missions.js while chasing (heat)
    const pa = G.pos.get(c.a), pb = G.pos.get(c.b);
    const ux = (pb[0] - pa[0]) / c.len, uz = (pb[1] - pa[1]) / c.len;
    // stop for the player if they are in front of the car
    const cx = c.node.position.x, cz = c.node.position.z; const dx = player.x - cx, dz = player.z - cz;
    const ahead = dx * ux + dz * uz, lat = Math.abs(-dx * uz + dz * ux);
    let target = c.max; if (ahead > 0 && ahead < 8.5 + HALF(c) && lat < 2.2) target = 0;
    for (const o of T.cars) { if (o === c) continue; const ox = o.node.position.x - cx, oz = o.node.position.z - cz; const ah = ox * ux + oz * uz; const hl = HALF(c) + HALF(o); if (ah > 0 && ah < hl + 4.5 && Math.abs(-ox * uz + oz * ux) < 1.6) { target = Math.min(target, Math.max(0, (ah - hl - 0.8) * 1.5)); } }
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
      const out = G.adj.get(c.b) || []; const next = nb.length ? nb[Math.floor(T.R() * nb.length)] : out[0];
      if (next == null || !G.info.has(c.b + ',' + next)) { T.placeCar(c, player); break; } // dead-end one-way: respawn near the player instead of throwing
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
  if (T.queues.length) { let best = null, bd = 85; for (const q of T.queues) { const d = Math.hypot(q.x - player.x, q.z - player.z); if (d < bd) { bd = d; best = q; } }
    if (best !== T.qCur) { T.qCur = best; T.qPool.forEach((a, i) => { const p = best && best.pts[i]; a.root.setEnabled(!!p); if (p) { a.root.position.set(p[0], 0, p[1]); a.root.rotation.y = p[2]; } }); }
    if (best && bd < 60) T.qPool.forEach((a, i) => { if (best.pts[i]) animateAvatar(a, dt, { speed: 0 }); }); }
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
