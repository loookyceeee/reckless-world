// RECKLESS avatar: procedural stylised clay figure, skinned to a 17-bone humanoid skeleton,
// with procedural idle / walk / run / rave-dance cycles and swappable Drop 018 outfits.
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { Bone } from '@babylonjs/core/Bones/bone';
import { Matrix, Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { sphere as _sphere, box, cyl as _cyl, torus as _torus, rbox as _rbox, xf, color, merge, hex, plane } from './geo.js';
let LODK = 1; const sphere = (n = 12) => _sphere(Math.max(4, Math.round(n * LODK))); const rbox = (w, h, d, e, s = 10) => _rbox(w, h, d, e, Math.max(4, Math.round(s * LODK)));
const cyl = (h, t, b, tess = 12, cap = true) => _cyl(h, t, b, Math.max(5, Math.round(tess * LODK)), cap); const torus = (d, t, tess = 16) => _torus(d, t, Math.max(6, Math.round(tess * LODK)));

const SKIN = hex('#e9dcd8'), SKIN_D = hex('#d9c6c2'), HAIR = hex('#141416'), FADE = hex('#a39497');
const BLACK = hex('#18181b'), SOLE = hex('#2a2a2e'), WHITE = hex('#f4f4f4'), SILVER = hex('#d8d8e0');

// Rest-pose joint positions (metres, character faces +Z). Oversized head, short legs.
const J = {
  root: [0, 0, 0], hips: [0, 0.60, 0], spine: [0, 0.72, 0], chest: [0, 0.86, 0], neck: [0, 1.04, 0], head: [0, 1.10, 0],
  upperArmL: [-0.2, 0.99, 0], foreArmL: [-0.24, 0.74, 0], handL: [-0.26, 0.52, 0.01],
  upperArmR: [0.2, 0.99, 0], foreArmR: [0.24, 0.74, 0], handR: [0.26, 0.52, 0.01],
  thighL: [-0.085, 0.58, 0], shinL: [-0.09, 0.32, 0.005], footL: [-0.092, 0.075, 0],
  thighR: [0.085, 0.58, 0], shinR: [0.09, 0.32, 0.005], footR: [0.092, 0.075, 0],
};
const PARENT = { hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  upperArmL: 'chest', foreArmL: 'upperArmL', handL: 'foreArmL', upperArmR: 'chest', foreArmR: 'upperArmR', handR: 'foreArmR',
  thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR' };
const ORDER = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const BI = Object.fromEntries(ORDER.map((n, i) => [n, i]));

function v3(a) { return new Vector3(a[0], a[1], a[2]); }
// assign skin weights: either rigid to one bone, or a blend along segment a->b (blend near the top to parent)
function skin(vd, bone, opt = {}) {
  const n = vd.positions.length / 3; const mi = new Array(n * 4).fill(0), mw = new Array(n * 4).fill(0);
  const b = BI[bone];
  for (let i = 0; i < n; i++) {
    let w = 1, p = null;
    if (opt.seg) { // seg: [from, to, parentBone, blend]
      const [A, B, par, bl] = opt.seg; const P = vd.positions.slice(i * 3, i * 3 + 3);
      const ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]; const L2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
      const t = ((P[0] - A[0]) * ab[0] + (P[1] - A[1]) * ab[1] + (P[2] - A[2]) * ab[2]) / L2;
      if (t < bl) { w = 0.5 + 0.5 * Math.max(0, t) / bl; p = BI[par]; }
      if (opt.seg[4] && t > 1 - opt.seg[4].blend) { // blend to child bone at bottom
        const k = (t - (1 - opt.seg[4].blend)) / opt.seg[4].blend; const cw = Math.min(0.5, 0.5 * k);
        mi[i * 4] = b; mw[i * 4] = 1 - cw; mi[i * 4 + 1] = BI[opt.seg[4].bone]; mw[i * 4 + 1] = cw; continue;
      }
    }
    mi[i * 4] = b; mw[i * 4] = w; if (p !== null) { mi[i * 4 + 1] = p; mw[i * 4 + 1] = 1 - w; }
  }
  vd.matricesIndices = mi; vd.matricesWeights = mw; return vd;
}
// Limb capsule between joints, tapered
function limb(a, b, r1, r2, col, bone, parent, blend = 0.18, child = null, tess = 14) {
  const A = v3(a), B = v3(b); const L = Vector3.Distance(A, B); const dir = B.subtract(A).normalize();
  const vd = cyl(L, r2, r1, tess, false);
  // align cylinder Y axis to dir
  const q = new Quaternion(); const up = new Vector3(0, 1, 0);
  const axis = Vector3.Cross(up, dir); const ang = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(up, dir))));
  if (axis.length() > 1e-6) Quaternion.RotationAxisToRef(axis.normalize(), ang, q);
  const mid = A.add(B).scale(0.5);
  vd.transform(Matrix.Compose(Vector3.One(), q, mid));
  const s1 = xf(sphere(10), { s: [r1, r1, r1], t: a }), s2 = xf(sphere(10), { s: [r2, r2, r2], t: b });
  const m = merge([color(vd, col), color(s1, col), color(s2, col)]);
  return skin(m, bone, { seg: [a, b, parent, blend, child ? { bone: child, blend: 0.12 } : null] });
}
const rigid = (vd, col, bone) => skin(color(vd, col), bone);

function headParts(o) {
  const H = [0, 1.265, 0.0]; const parts = [];
  // head: carried as its own face-textured mesh (see faceHead); hair, ears and earring stay in the clay body
  // hair cap: dark crop on top, fade on the sides, pushed inside head below hairline
  const hr = sphere(22); const q = hr.positions; const cols = [];
  for (let i = 0; i < q.length; i += 3) {
    const x = q[i], y = q[i + 1], z = q[i + 2];
    const line = z > 0.3 ? 0.42 + 0.25 * z : (z < -0.4 ? -0.02 : 0.14); // hairline height (high skin fade at sides/back)
    const inside = y < line - 0.05; const fadeBand = y < line + 0.36 && !(z > 0.3);
    const k = inside ? 0.93 : 1.055 + (y > 0.5 ? 0.04 * Math.sin(x * 40) * Math.sin(z * 37) : 0);
    q[i] = x * 0.153 * k + H[0]; q[i + 1] = y * 0.183 * k + H[1] + 0.006; q[i + 2] = z * 0.166 * k + H[2] - 0.006;
    const c = inside ? SKIN : (fadeBand ? Color3.Lerp(FADE, HAIR, Math.pow(Math.max(0, Math.min(1, (y - line) / 0.36)), 1.6)) : HAIR);
    cols.push(c.r, c.g, c.b, 1);
  }
  VertexData.ComputeNormals(q, hr.indices, (hr.normals = [])); hr.colors = cols; parts.push(skin(hr, 'head'));
  // textured crop tufts
  for (let i = 0; i < (LODK < 1 ? 10 : 26); i++) {
    const a = (i / 26) * Math.PI * 2 * 2.3, rr = 0.05 + 0.065 * ((i * 7) % 5) / 5;
    parts.push(rigid(xf(sphere(6), { s: [0.032, 0.02, 0.032], t: [H[0] + Math.cos(a) * rr, H[1] + 0.183 - rr * 0.5, H[2] + Math.sin(a) * rr * 1.05 + 0.01] }), HAIR, 'head'));
  }
  // ears + hoop earring (his right ear, +X)
  for (const sx of [-1, 1]) parts.push(rigid(xf(sphere(8), { s: [0.024, 0.05, 0.034], t: [sx * 0.15, H[1] - 0.012, H[2] - 0.012] }), SKIN_D, 'head'));
  parts.push(rigid(xf(torus(0.032, 0.006, 14), { r: [0, 0, Math.PI / 2], t: [0.156, H[1] - 0.06, H[2] - 0.005] }), SILVER, 'head'));
  return parts;
}


// Face-textured head: canonical avatar face (avatar-refs/canonical-looks/body.png) projected on a sculpted head
// with a real nose, brow ridge, cheekbones and squarer jaw so it reads in profile too.
const HEAD_C = [0, 1.265, 0];
function sculptHead(x, y, z) {
  let s = 1;
  if (y < 0) { s *= 1 - 0.13 * Math.pow(-y, 1.6); }                       // jaw taper (kept broad)
  let X = x * s, Y = y, Z = z * (y < 0 ? 1 - 0.06 * -y : 1);
  if (z > 0.2) Z *= 0.93 + 0.05 * Math.abs(x);                              // flatter face plane
  const g = (cx, cy, sx, sy) => Math.exp(-((x - cx) ** 2) / (2 * sx * sx) - ((y - cy) ** 2) / (2 * sy * sy));
  if (z > 0) {
    Z += 0.17 * g(0, -0.28, 0.085, 0.16) * z ** 3;                         // nose
    Z += 0.05 * g(0, -0.43, 0.2, 0.06) * z ** 3;                           // nostril wings
    Z += 0.05 * (g(-0.4, 0.26, 0.22, 0.07) + g(0.4, 0.26, 0.22, 0.07)) * z; // brow ridge
    Z -= 0.04 * (g(-0.39, 0.03, 0.17, 0.1) + g(0.39, 0.03, 0.17, 0.1)) * z; // eye sockets
    Z += 0.035 * g(0, -0.62, 0.22, 0.06) * z;                              // lips
    Z += 0.04 * g(0, -0.86, 0.22, 0.1) * z;                                // chin
    X *= 1 + 0.035 * (g(-0.6, -0.2, 0.2, 0.2) + g(0.6, -0.2, 0.2, 0.2));    // cheekbones
  }
  return [X * 0.152 + HEAD_C[0], Y * 0.182 + HEAD_C[1], Z * 0.168 + HEAD_C[2]];
}
function faceHead() {
  const hd = sphere(40); const p = hd.positions, uv = [];
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    if (z > 0.02) { const px = 270 - x * 74, py = 116 - (y + 0.03) * 78; uv.push((px - 208) / 124, 1 - (py - 78) / 124); }
    else uv.push(0.005, 0.995);
    const q = sculptHead(x, y, z); p[i] = q[0]; p[i + 1] = q[1]; p[i + 2] = q[2];
  }
  hd.uvs = uv; hd.normals = []; VertexData.ComputeNormals(p, hd.indices, hd.normals);
  hd.colors = new Array((p.length / 3) * 4).fill(1);
  return skin(hd, 'head');
}

function bodyParts() {
  const P = [];
  P.push(...headParts());
  P.push(limb([0, 1.0, -0.005], [0, 1.12, 0.0], 0.055, 0.05, SKIN, 'neck', 'chest', 0.3));
  // torso: chest + abs + pecs
  P.push(skin(color(xf(rbox(0.38, 0.25, 0.195, 0.55, 14), { t: [0, 0.905, 0] }), SKIN), 'chest'));
  P.push(skin(color(xf(rbox(0.29, 0.2, 0.17, 0.6, 12), { t: [0, 0.75, 0.005] }), SKIN), 'spine'));
  P.push(skin(color(xf(rbox(0.3, 0.06, 0.14, 0.5, 8), { t: [0, 1.0, -0.01] }), SKIN), 'chest')); // trapezius
  for (let r = 0; r < 3; r++) for (const sx of [-1, 1]) P.push(rigid(xf(sphere(8), { s: [0.038, 0.03, 0.014], t: [sx * 0.042, 0.84 - r * 0.062, 0.084 - r * 0.004] }), SKIN, r === 0 ? 'chest' : 'spine')); // abs
  for (const sx of [-1, 1]) {
    P.push(rigid(xf(sphere(10), { s: [0.088, 0.048, 0.026], t: [sx * 0.078, 0.94, 0.08] }), SKIN, 'chest'));
    P.push(rigid(xf(sphere(10), { s: [0.078, 0.075, 0.078], t: [sx * 0.19, 0.975, 0] }), SKIN, 'upperArmL'.replace('L', sx < 0 ? 'L' : 'R'))); // deltoid
  }
  // boxers (black) pelvis
  P.push(skin(color(xf(rbox(0.285, 0.15, 0.185, 0.5, 12), { t: [0, 0.615, 0] }), BLACK), 'hips'));
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? -1 : 1;
    P.push(limb([sx * 0.085, 0.6, 0], [sx * 0.088, 0.47, 0.002], 0.083, 0.079, BLACK, 'thigh' + s, 'hips', 0.25));
    // legs (short)
    P.push(limb([sx * 0.087, 0.5, 0.002], [sx * 0.09, 0.32, 0.006], 0.072, 0.056, SKIN, 'thigh' + s, 'hips', 0.0, 'shin' + s));
    P.push(limb([sx * 0.09, 0.32, 0.006], [sx * 0.092, 0.09, 0], 0.056, 0.04, SKIN, 'shin' + s, 'thigh' + s, 0.15));
    P.push(rigid(xf(sphere(8), { s: [0.05, 0.055, 0.03], t: [sx * 0.09, 0.25, -0.03] }), SKIN, 'shin' + s)); // calf
    // chunky black trainers
    P.push(rigid(xf(rbox(0.12, 0.085, 0.265, 0.35, 10), { t: [sx * 0.093, 0.058, 0.04] }), BLACK, 'foot' + s));
    P.push(rigid(xf(rbox(0.132, 0.036, 0.282, 0.3, 8), { t: [sx * 0.093, 0.018, 0.042] }), SOLE, 'foot' + s));
    P.push(rigid(xf(rbox(0.06, 0.02, 0.1, 0.4, 6), { r: [-0.35, 0, 0], t: [sx * 0.093, 0.1, 0.08] }), hex('#2c2c31'), 'foot' + s)); // lace panel
    for (let k = 0; k < 3; k++) P.push(rigid(xf(box(0.05, 0.006, 0.008), { t: [sx * 0.093, 0.094 + k * 0.012, 0.115 - k * 0.022] }), hex('#3a3a40'), 'foot' + s));
    // arms
    const u = J['upperArm' + s], f = J['foreArm' + s], h = J['hand' + s];
    P.push(limb(u, f, 0.056, 0.044, SKIN, 'upperArm' + s, 'chest', 0.2));
    P.push(rigid(xf(sphere(8), { s: [0.045, 0.07, 0.048], t: [u[0] + (f[0] - u[0]) * 0.45, u[1] + (f[1] - u[1]) * 0.45, 0.018] }), SKIN, 'upperArm' + s)); // biceps
    P.push(limb(f, h, 0.047, 0.033, SKIN, 'foreArm' + s, 'upperArm' + s, 0.15));
    P.push(rigid(xf(rbox(0.05, 0.09, 0.07, 0.5, 8), { t: [h[0] + sx * 0.006, h[1] - 0.045, h[2]] }), SKIN, 'hand' + s));
    P.push(rigid(xf(sphere(6), { s: [0.016, 0.03, 0.016], t: [h[0] - sx * 0.01, h[1] - 0.03, h[2] + 0.035] }), SKIN, 'hand' + s));
  }
  return merge(P);
}

// ---- outfits (Drop 018 approximations) ----
function decalTex(scene, kind) {
  const t = new DynamicTexture('decal-' + kind, { width: 256, height: 128 }, scene, true); const c = t.getContext();
  c.clearRect(0, 0, 256, 128);
  if (kind === 'skate') { // orange rckls mark + white wordmark
    c.fillStyle = '#ff6a13'; c.fillRect(40, 38, 40, 48); c.fillStyle = '#111'; c.fillRect(52, 38, 4, 48); c.fillRect(64, 38, 4, 48); c.fillRect(40, 58, 40, 4);
    c.fillStyle = '#fff'; c.font = 'bold 54px "DM Sans", Arial'; c.fillText('rckls', 88, 82);
  } else { // STAN oval RCKLS badge
    c.strokeStyle = '#fff'; c.lineWidth = 8; c.beginPath(); c.ellipse(128, 64, 96, 44, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold 44px Unbounded, Arial'; c.textAlign = 'center'; c.fillText('RCKLS', 128, 80);
  }
  t.hasAlpha = true; t.update(); return t;
}
function shirt({ col, long = false, hood = false, length = 0.6 }) {
  const P = [];
  P.push(skin(color(xf(rbox(0.43, 0.28, 0.235, 0.5, 14), { t: [0, 0.91, 0] }), col), 'chest'));
  P.push(skin(color(xf(rbox(0.35, 0.29, 0.22, 0.62, 12), { t: [0, length + 0.13, 0.002] }), col), 'spine'));
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? -1 : 1; const u = J['upperArm' + s], f = J['foreArm' + s], h = J['hand' + s];
    P.push(rigid(xf(sphere(10), { s: [0.092, 0.082, 0.088], t: [sx * 0.19, 0.975, 0] }), col, 'upperArm' + s));
    const end = long ? f : [u[0] + (f[0] - u[0]) * 0.5, u[1] + (f[1] - u[1]) * 0.5, 0];
    P.push(limb(u, end, 0.078, long ? 0.064 : 0.075, col, 'upperArm' + s, 'chest', 0.2));
    if (long) { P.push(limb(f, [h[0], h[1] + 0.02, h[2]], 0.058, 0.047, col, 'foreArm' + s, 'upperArm' + s, 0.15));
      P.push(rigid(xf(cyl(0.035, 0.045, 0.045, 12), { t: [h[0], h[1] + 0.025, h[2]] }), Color3.Lerp(col, BLACK, 0.3), 'foreArm' + s)); }
  }
  if (hood) {
    P.push(skin(color(xf(torus(0.2, 0.07, 18), { s: [1, 0.7, 1], r: [0.35, 0, 0], t: [0, 1.06, -0.03] }), col), 'chest'));
    P.push(skin(color(xf(sphere(12), { s: [0.13, 0.13, 0.06], t: [0, 1.07, -0.13] }), col), 'chest'));
    P.push(skin(color(xf(rbox(0.2, 0.09, 0.03, 0.4, 8), { t: [0, length + 0.1, 0.112] }), Color3.Lerp(col, BLACK, 0.25)), 'spine')); // kangaroo pocket
    P.push(skin(color(xf(cyl(0.05, 0.168, 0.168, 18), { s: [1, 1, 0.68], t: [0, length + 0.0, 0] }), Color3.Lerp(col, BLACK, 0.3)), 'hips')); // ribbed hem
    for (const sx of [-0.035, 0.035]) P.push(rigid(xf(cyl(0.14, 0.004, 0.004, 5), { t: [sx, 0.97, 0.13] }), WHITE, 'chest'));
  }
  return merge(P);
}
function trousers({ col, wide = 1, cuff = false, seam = null }) {
  const P = [];
  P.push(skin(color(xf(rbox(0.30, 0.16, 0.2, 0.5, 12), { t: [0, 0.615, 0] }), col), 'hips'));
  P.push(skin(color(xf(cyl(0.035, 0.153, 0.153, 18), { s: [1, 1, 0.68], t: [0, 0.69, 0] }), Color3.Lerp(col, BLACK, 0.25)), 'hips'));
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? -1 : 1;
    P.push(limb([sx * 0.085, 0.6, 0], [sx * 0.09, 0.32, 0.006], 0.09 * wide, 0.078 * wide, col, 'thigh' + s, 'hips', 0.22, 'shin' + s));
    const bot = cuff ? 0.06 * 1.0 : 0.075 * wide * 1.1;
    P.push(limb([sx * 0.09, 0.32, 0.006], [sx * 0.093, 0.075, 0], 0.078 * wide, bot, col, 'shin' + s, 'thigh' + s, 0.15));
    if (cuff) P.push(rigid(xf(cyl(0.04, 0.058, 0.058, 14), { t: [sx * 0.093, 0.085, 0] }), Color3.Lerp(col, BLACK, 0.3), 'shin' + s));
    if (seam) P.push(rigid(xf(sphere(8), { s: [0.03, 0.035, 0.005], t: [sx * 0.105, 0.17, 0.075] }), seam, 'shin' + s)); // embroidered knee mark
  }
  return merge(P);
}
export const OUTFITS = [
  { id: 'base', name: 'BASE · BOXERS', top: null, bottom: null },
  { id: 'skate', name: "SKATE TEE + BARREL JEANS", top: 'skate', bottom: 'barrel' },
  { id: 'stan', name: "STAN HOODIE + BARREL JEANS", top: 'stan', bottom: 'barrel' },
  { id: 'stanfull', name: "STAN HOODIE + STAN BOTTOMS", top: 'stan', bottom: 'stanb' },
];

let sharedMat = null, decalMats = {};
export function avatarMaterial(scene) {
  if (sharedMat) return sharedMat;
  const m = new StandardMaterial('clay', scene);
  m.diffuseColor = new Color3(1, 1, 1); m.specularColor = new Color3(0.22, 0.22, 0.24); m.specularPower = 28;
  m.emissiveColor = new Color3(0.06, 0.05, 0.07);
  m.emissiveFresnelParameters = new FresnelParameters({ leftColor: new Color3(0.34, 0.33, 0.42), rightColor: Color3.Black(), power: 3.2, bias: 0.05 });
  return (sharedMat = m);
}

let faceMat = null;
export function faceMaterial(scene) {
  if (faceMat) return faceMat; const base = avatarMaterial(scene);
  const m = new StandardMaterial('face', scene); m.diffuseTexture = new Texture(import.meta.env.BASE_URL + 'data/face.png', scene);
  m.diffuseTexture.wrapU = m.diffuseTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
  m.specularColor = base.specularColor.clone(); m.specularPower = base.specularPower; m.emissiveColor = base.emissiveColor.clone(); m.emissiveFresnelParameters = base.emissiveFresnelParameters.clone();
  return (faceMat = m);
}
export function createAvatar(scene, { name = 'avatar', palette = null, outfit = 'stan', decals = true, lod = 1 } = {}) {
  LODK = lod;
  const sk = new Skeleton(name + '-skel', name + '-skel', scene);
  const bones = {};
  for (const n of ORDER) {
    const p = J[n], par = PARENT[n] ? J[PARENT[n]] : [0, 0, 0];
    const local = Matrix.Translation(p[0] - par[0], p[1] - par[1], p[2] - par[2]);
    bones[n] = new Bone(n, sk, PARENT[n] ? bones[PARENT[n]] : null, local);
  }
  const root = new TransformNode(name, scene);
  const mat = avatarMaterial(scene);
  const mk = (id, vd) => { const m = new Mesh(name + '-' + id, scene); vd.applyToMesh(m); m.skeleton = sk; m.numBoneInfluencers = 2; m.material = mat; m.parent = root; return m; };
  let bodyVD = bodyParts();
  if (palette && palette.skin) bodyVD.colors = bodyVD.colors.map((v, i) => v); // keep
  const body = mk('body', bodyVD);
  const head = mk('head', faceHead()); head.material = faceMaterial(scene);
  const parts = { body, head };
  const pal = Object.assign({ tee: BLACK, hoodie: BLACK, denim: hex('#6f8fb3'), stanb: hex('#1c1c20') }, palette || {});
  parts.skate = mk('skate', shirt({ col: pal.tee }));
  parts.stan = mk('stan', shirt({ col: pal.hoodie, long: true, hood: true, length: 0.56 }));
  parts.barrel = mk('barrel', trousers({ col: pal.denim, wide: 1.32, seam: hex('#9fb4cc') }));
  parts.stanb = mk('stanb', trousers({ col: pal.stanb, wide: 1.15, cuff: true }));
  if (decals) {
    for (const k of ['skate', 'stan']) {
      if (!decalMats[k]) { const dm = new StandardMaterial('decal-' + k, scene); dm.diffuseTexture = decalTex(scene, k); dm.emissiveTexture = dm.diffuseTexture; dm.useAlphaFromDiffuseTexture = true; dm.backFaceCulling = false; dm.specularColor = Color3.Black(); decalMats[k] = dm; }
      const vd = k === 'skate' ? xf(plane(0.12, 0.06), { t: [0, 0.965, 0.1205] }) : xf(plane(0.12, 0.06), { t: [0, 0.95, 0.121] });
      vd.uvs = vd.uvs.map((u, i) => (i % 2 === 0 ? 1 - u : u)); // mirror for +Z facing
      skin(vd, 'chest');
      const dmesh = new Mesh(name + '-decal-' + k, scene); vd.applyToMesh(dmesh); dmesh.skeleton = sk; dmesh.material = decalMats[k]; dmesh.parent = parts[k]; dmesh.parent = root;
      parts[k + 'Decal'] = dmesh;
    }
  }
  const av = { root, skeleton: sk, bones, parts, outfit: null, t: Math.random() * 10, w: { idle: 1, walk: 0, run: 0, dance: 0 }, phase: 0 };
  av.setOutfit = (id) => {
    const o = OUTFITS.find(x => x.id === id) || OUTFITS[0]; av.outfit = o.id;
    for (const k of ['skate', 'stan', 'barrel', 'stanb']) parts[k].setEnabled(o.top === k || o.bottom === k);
    if (parts.skateDecal) { parts.skateDecal.setEnabled(o.top === 'skate'); parts.stanDecal.setEnabled(o.top === 'stan'); }
  };
  av.setOutfit(outfit); LODK = 1;
  av.meshes = () => Object.values(parts).filter(m => m.isEnabled());
  av.allMeshes = () => Object.values(parts);
  return av;
}

// ---- procedural animation ----
const E = (x = 0, y = 0, z = 0) => [x, y, z];
function pose(state, t, ph) {
  const P = {}; let bob = 0, lean = 0;
  if (state === 'idle') {
    const b = Math.sin(t * 1.6);
    P.chest = E(0.02 * b, 0, 0); P.head = E(0.02 * Math.sin(t * 0.7), 0.08 * Math.sin(t * 0.33), 0);
    P.upperArmL = E(0.02 * b, 0, -0.08); P.upperArmR = E(0.02 * b, 0, 0.08);
    P.foreArmL = E(-0.12, 0, 0); P.foreArmR = E(-0.12, 0, 0); bob = 0.004 * b;
  } else if (state === 'walk' || state === 'run') {
    const run = state === 'run'; const s = Math.sin(ph), c = Math.cos(ph);
    const A = run ? 0.85 : 0.5, K = run ? 1.3 : 0.75;
    P.thighL = E(-A * s, 0, 0); P.thighR = E(A * s, 0, 0);
    P.shinL = E(K * Math.max(0, Math.sin(ph + 1.3)) + 0.05, 0, 0); P.shinR = E(K * Math.max(0, Math.sin(ph + Math.PI + 1.3)) + 0.05, 0, 0);
    P.footL = E(-0.2 * Math.cos(ph), 0, 0); P.footR = E(0.2 * Math.cos(ph), 0, 0);
    P.upperArmL = E(A * 0.8 * s, 0, -0.12); P.upperArmR = E(-A * 0.8 * s, 0, 0.12);
    P.foreArmL = E(run ? -1.3 : -0.35 - 0.2 * Math.max(0, s), 0, 0); P.foreArmR = E(run ? -1.3 : -0.35 - 0.2 * Math.max(0, -s), 0, 0);
    P.hips = E(run ? 0.15 : 0.03, 0.12 * s, 0); P.chest = E(run ? 0.12 : 0.02, -0.2 * s, 0); P.head = E(run ? -0.12 : 0, 0.08 * s, 0);
    bob = (run ? 0.045 : 0.022) * Math.abs(c) - (run ? 0.03 : 0.01);
  } else if (state === 'dance') { // 128bpm rave bounce + fist pump + shuffle
    const beat = t * (128 / 60) * Math.PI * 2; const b = Math.sin(beat), h = Math.sin(beat / 2), q = Math.sin(beat / 4);
    const k = 0.25 + 0.2 * (0.5 + 0.5 * b);
    P.thighL = E(-k - 0.15 * h, 0, -0.05); P.thighR = E(-k + 0.15 * h, 0, 0.05);
    P.shinL = E(2 * k + 0.2 * h, 0, 0); P.shinR = E(2 * k - 0.2 * h, 0, 0);
    P.footL = E(-k * 0.9, 0, 0); P.footR = E(-k * 0.9, 0, 0);
    P.hips = E(0.05, 0.35 * q, 0.06 * h); P.chest = E(0.12 + 0.08 * b, -0.2 * q, -0.06 * h); P.head = E(0.2 + 0.2 * b, 0.1 * q, 0);
    const up = q > 0; // alternate: right fist pump / both hands up
    P.upperArmR = E(-2.6 - 0.25 * b, 0, 0.25); P.foreArmR = E(-0.4 - 0.5 * (0.5 + 0.5 * b), 0, 0);
    P.upperArmL = up ? E(-2.4 - 0.25 * b, 0, -0.25) : E(-0.6 - 0.3 * b, 0, -0.35); P.foreArmL = up ? E(-0.4, 0, 0) : E(-1.4, 0, 0);
    bob = -0.06 - 0.035 * (0.5 + 0.5 * b);
  }
  return { P, bob, lean };
}
const tmpQ = new Quaternion();
// ---- baked CC0 mocap (Quaternius UAL, retargeted in tools/blender/export_anims.py) ----
let ANIM = null;
export async function loadAnims(url) {
  const d = await (await fetch(url)).json(); const idx = Object.fromEntries(d.bones.map((b, i) => [b, i]));
  for (const k in d.clips) { const c = d.clips[k]; c.q = c.frames.map(f => d.bones.map((b, i) => new Quaternion(f[i * 4], f[i * 4 + 1], f[i * 4 + 2], f[i * 4 + 3]))); c.p = c.frames.map(f => { const o = d.bones.length * 4; return new Vector3(f[o], f[o + 1], f[o + 2]); }); }
  ANIM = { ...d, idx }; return ANIM;
}
const CYCLE = { walk: 1.05, jog: 1.85, run: 2.6 }; // metres per loop at avatar scale
function sampleClip(c, phase, bone, out) { // phase 0..1 looping, slerp between baked frames
  const n = c.q.length, f = phase * n, i0 = Math.floor(f) % n, i1 = (i0 + 1) % n, a = f - Math.floor(f);
  Quaternion.SlerpToRef(c.q[i0][bone], c.q[i1][bone], a, out); return out;
}
const qa = new Quaternion(), qb = new Quaternion(), pA = new Vector3();
export function animateAvatar(av, dt, { speed = 0, dancing = false } = {}) {
  av.t += dt;
  if (!ANIM) return animateProcedural(av, dt, { speed, dancing });
  const target = dancing ? 'dance' : speed > 3.6 ? 'jog' : speed > 0.15 ? 'walk' : 'idle';
  av.w.jog = av.w.jog || 0;
  for (const k of ['idle', 'walk', 'jog', 'dance']) av.w[k] = (av.w[k] || 0) + ((k === target ? 1 : 0) - (av.w[k] || 0)) * Math.min(1, dt * 7);
  av.ph = av.ph || { idle: Math.random(), walk: 0, jog: 0, dance: Math.random() };
  const loco = Math.max(speed, 0.6);
  av.ph.walk = (av.ph.walk + dt * loco / CYCLE.walk) % 1; av.ph.jog = (av.ph.jog + dt * loco / CYCLE.jog) % 1;
  av.ph.idle = (av.ph.idle + dt / ANIM.clips.idle.dur) % 1; av.ph.dance = (av.ph.dance + dt * (128 / 60) / 2 / ANIM.clips.dance.dur * ANIM.clips.dance.dur) % 1; // 1 loop = 2 beats @128bpm
  const order = ['idle', 'walk', 'jog', 'dance'].filter(k => av.w[k] > 0.002);
  const tot = order.reduce((s, k) => s + av.w[k], 0);
  const names = ANIM.bones;
  for (let b = 0; b < names.length; b++) {
    let acc = 0; let first = true;
    for (const k of order) { const w = av.w[k] / tot; sampleClip(ANIM.clips[k], av.ph[k], b, qb);
      if (first) { qa.copyFrom(qb); first = false; acc = w; } else { acc += w; Quaternion.SlerpToRef(qa, qb, w / acc, qa); } }
    av.bones[names[b]].setRotationQuaternion(qa);
  }
  pA.set(0, 0, 0);
  for (const k of order) { const c = ANIM.clips[k], n = c.p.length, f = av.ph[k] * n, i0 = Math.floor(f) % n, i1 = (i0 + 1) % n, a = f - Math.floor(f);
    const w = av.w[k] / tot; pA.x += (c.p[i0].x * (1 - a) + c.p[i1].x * a) * w; pA.y += (c.p[i0].y * (1 - a) + c.p[i1].y * a) * w; }
  const hp = J.hips; av.bones.hips.setPosition(new Vector3(hp[0] + pA.x, hp[1] + pA.y, hp[2]));
}
function animateProcedural(av, dt, { speed = 0, dancing = false } = {}) {
  const target = dancing ? 'dance' : speed > 3.6 ? 'run' : speed > 0.2 ? 'walk' : 'idle';
  for (const k in av.w) av.w[k] += ((k === target ? 1 : 0) - av.w[k]) * Math.min(1, dt * 8);
  av.phase += dt * (speed > 3.6 ? speed * 2.0 : Math.max(speed, 0.1) * 3.3);
  const acc = {}; let bob = 0;
  for (const st of ['idle', 'walk', 'run', 'dance']) {
    const w = av.w[st]; if (w < 0.001) continue;
    const r = pose(st, av.t, av.phase); bob += r.bob * w;
    for (const b in r.P) { const a = acc[b] || (acc[b] = [0, 0, 0]); a[0] += r.P[b][0] * w; a[1] += r.P[b][1] * w; a[2] += r.P[b][2] * w; }
  }
  for (const n of ORDER) {
    if (n === 'root') continue;
    const e = acc[n] || [0, 0, 0];
    Quaternion.FromEulerAnglesToRef(e[0], e[1], e[2], tmpQ);
    av.bones[n].setRotationQuaternion(tmpQ);
  }
  const hp = J.hips; av.bones.hips.setPosition(new Vector3(hp[0], hp[1] + bob, hp[2]));
}

// ---- instanced crowd: bake N dance poses x outfit variants into static meshes for thin instancing ----
export function bakeCrowdVariants(scene, { poses = 4, lod = 0.35 } = {}) {
  const VARS = [
    { outfit: 'skate', palette: { tee: hex('#111114'), denim: hex('#6f8fb3') } },
    { outfit: 'stan', palette: { hoodie: hex('#111114'), denim: hex('#4a5f80') } },
    { outfit: 'base' },
    { outfit: 'skate', palette: { tee: hex('#f2f2f2'), denim: hex('#2c3e5c') } },
    { outfit: 'stanfull', palette: { hoodie: hex('#2b2f3a'), stanb: hex('#1c1c20') } },
    { outfit: 'skate', palette: { tee: hex('#c62828'), denim: hex('#1f2a3c') } },
  ];
  const out = [];
  VARS.forEach((v, vi) => {
    const av = createAvatar(scene, { name: 'crowdsrc' + vi, outfit: v.outfit, palette: v.palette || null, decals: false, lod });
    for (let p = 0; p < poses; p++) {
      av.w = { idle: 0, walk: 0, jog: 0, dance: 1, run: 0 }; av.ph = { idle: 0, walk: 0, jog: 0, dance: p / poses };
      if (ANIM) { // sample the mocap dance at an exact phase
        const names = ANIM.bones; for (let b = 0; b < names.length; b++) { sampleClip(ANIM.clips.dance, p / poses, b, qb); av.bones[names[b]].setRotationQuaternion(qb); }
        const c = ANIM.clips.dance, f = Math.floor(p / poses * c.p.length) % c.p.length; av.bones.hips.setPosition(new Vector3(J.hips[0] + c.p[f].x, J.hips[1] + c.p[f].y, J.hips[2]));
      } else animateProcedural(av, p * 0.12, { dancing: true });
      av.skeleton.computeAbsoluteMatrices(true);
      const clay = [], face = [];
      for (const m of av.meshes()) { const c = m.clone(m.name + '-bk' + p); c.skeleton = av.skeleton; c.applySkeleton(av.skeleton); c.skeleton = null; c.parent = null; (m.material && m.material.name === 'face' ? face : clay).push(c); }
      const body = Mesh.MergeMeshes(clay, true, true); const head = face.length ? Mesh.MergeMeshes(face, true, true) : null;
      body.name = 'crowd-v' + vi + 'p' + p; if (head) head.name = 'crowdHead-v' + vi + 'p' + p;
      out.push({ v: vi, p, body, head });
    }
    for (const m of av.allMeshes()) m.dispose(); av.root.dispose(); av.skeleton.dispose();
  });
  return { list: out, variants: VARS.length, poses };
}
