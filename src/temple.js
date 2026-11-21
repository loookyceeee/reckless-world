// THE TEMPLE — converted Gothic church at Carlisle Circus. Stylised clay exterior (city) + walk-in interior.
// Built from Luke's reference photos (/workspace/reckless-world/temple-refs/): long nave, banded sandstone
// columns + pointed arcades, open broken rafter roof, 5-lancet altar window over carved arcade frieze, rose window.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Scene } from '@babylonjs/core/scene';
import { hex, rng, box, cyl, sphere, rbox, xf, color, merge, toMesh, plane, pointedArch, lancet, wallWithHoles, archRib, torus } from './geo.js';
import { beamTex } from './city.js';

const SAND = hex('#a18b74'), SAND_L = hex('#b7a48b'), SAND_D = hex('#7f6b58'), SAND_R = hex('#977058'), SLATE = hex('#3d4250');
const BRICK = hex('#9a4a32'), BRICK_D = hex('#7c3a28'), TIMBER = hex('#2a1e17'), BOARD = hex('#17110d');
const IRON = hex('#1d1f24'), WOOD = hex('#6b4a33'), PLY = hex('#c8a77a'), STEEL = hex('#9aa0a8'), ALU = hex('#c9ced6'), CASE = hex('#26272b');
const stoneTint = (c, R) => { const k = 0.9 + R() * 0.2; return new Color3(c.r * k, c.g * k, c.b * k); };

function mat(scene, name, o = {}) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = o.d || new Color3(1, 1, 1); m.specularColor = o.s || new Color3(0.08, 0.08, 0.08); m.specularPower = o.p || 16;
  if (o.e) m.emissiveColor = o.e; if (o.unlit) m.disableLighting = true; if (o.alpha != null) m.alpha = o.alpha;
  if (o.add) { m.alphaMode = 1; m.backFaceCulling = false; } if (o.two) m.backFaceCulling = false;
  return m;
}
// wall in XY plane, given outline + holes, placed with rotation/translation
const wallAt = (outer, holes, thick, r, t, col) => color(xf(wallWithHoles(outer, holes, thick), { r, t }), col);
// lancet glass panes (for emissive windows)
function glassPane(cx, bottom, spring, span, z, ry = 0, t = [0, 0, 0]) {
  const pts = lancet(cx, bottom, spring, span, 8); const vd = wallWithHoles(pts, [], 0.02);
  return xf(vd, { r: [0, ry, 0], t: [t[0], t[1], t[2] + z] });
}

// outline with pointed-arch openings notched up from the bottom edge (no degenerate holes)
function notched(x0, x1, y0, openings, top) {
  const out = [[x0, y0]];
  for (const [cx, spring, span] of openings.sort((a, b) => a[0] - b[0])) {
    out.push([cx - span / 2, y0]); if (spring > y0) out.push([cx - span / 2, spring]);
    const a = pointedArch(cx, spring, span, 10).pts; out.push(...a.slice(1, -1));
    if (spring > y0) out.push([cx + span / 2, spring]); out.push([cx + span / 2, y0]);
  }
  out.push([x1, y0]); out.push(...top); return out;
}

// ======================= EXTERIOR (city) =======================
export function buildTempleExterior(scene, building, grid) {
  const pts = building.pts || (() => { const a = []; for (let i = 0; i < building.p.length; i += 2) a.push([building.p[i], building.p[i + 1]]); return a; })();
  // oriented frame from longest edge
  let best = 0, ax = [1, 0];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > best) { best = L; ax = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; } }
  ax = [-ax[0], -ax[1]]; // entrance gable (-z) faces NE onto Clifton St / Carlisle Circus
  { const cc = [-356 - (pts.reduce((s, p) => s + p[0], 0) / pts.length), 281 - (pts.reduce((s, p) => s + p[1], 0) / pts.length)]; if (cc[0] * ax[0] + cc[1] * ax[1] > 0) ax = [-ax[0], -ax[1]]; }
  const px = [-ax[1], ax[0]]; let mnA = 1e9, mxA = -1e9, mnP = 1e9, mxP = -1e9;
  for (const p of pts) { const a = p[0] * ax[0] + p[1] * ax[1], q = p[0] * px[0] + p[1] * px[1]; mnA = Math.min(mnA, a); mxA = Math.max(mxA, a); mnP = Math.min(mnP, q); mxP = Math.max(mxP, q); }
  const cA = (mnA + mxA) / 2, cP = (mnP + mxP) / 2; const Lz = mxA - mnA, Wx = mxP - mnP;
  const cx = ax[0] * cA + px[0] * cP, cz = ax[1] * cA + px[1] * cP;
  // local frame: +z = ax (towards altar), +x = px. Entrance gable faces -z.
  const yaw = Math.atan2(ax[0], ax[1]);
  const root = new TransformNode('templeExt', scene); root.position.set(cx, 0, cz); root.rotation.y = yaw;
  // which side faces Carlisle Circus? put the tower there.
  const circ = [-370 - cx, 277 - cz]; const side = (circ[0] * px[0] + circ[1] * px[1]) > 0 ? 1 : -1;
  const R = rng(5); const S = [], G = [], D = [];
  const hz = Lz / 2, nw = Math.min(12, Wx * 0.5), aw = (Wx - nw) / 2, wallH = 13.1, ridge = 23.2, aisleH = 7.4; // OSNI LiDAR eaves/ridge
  // nave + gable roof
  S.push(color(xf(box(nw, wallH, Lz), { t: [0, wallH / 2, 0] }), BRICK));
  const roofW = nw / 2 + 0.6, rl = Math.hypot(roofW, ridge - wallH);
  for (const sd of [-1, 1]) S.push(color(xf(box(rl, 0.4, Lz + 0.6), { r: [0, 0, -sd * Math.atan2(ridge - wallH, roofW)], t: [sd * roofW / 2, (wallH + ridge) / 2, 0] }), SLATE));
  // gable triangles (both ends)
  for (const ez of [-hz, hz]) { const tri = wallWithHoles([[-nw / 2, wallH], [nw / 2, wallH], [0, ridge]], [], 0.6); S.push(color(xf(tri, { t: [0, 0, ez - 0.3] }), BRICK)); }
  // aisles, lean-to roofs, buttresses + aisle lancets
  const bays = 6, bayL = (Lz - 4) / bays;
  for (const sd of [-1, 1]) {
    const x = sd * (nw / 2 + aw / 2);
    S.push(color(xf(box(aw, aisleH, Lz - 2), { t: [x, aisleH / 2, 0.5] }), BRICK));
    const sl = Math.hypot(aw, 3); S.push(color(xf(box(sl + 0.4, 0.35, Lz - 1.6), { r: [0, 0, sd * Math.atan2(3, aw)], t: [x, aisleH + 1.5, 0.5] }), SLATE));
    for (let b = 0; b <= bays; b++) {
      const z = -hz + 2 + b * bayL;
      S.push(color(xf(box(1.1, aisleH + 0.6, 1.0), { t: [sd * (Wx / 2 + 0.3), (aisleH + 0.6) / 2, z] }), BRICK_D));
      S.push(color(xf(box(0.8, 1.6, 0.8), { r: [0, 0, sd * 0.5], t: [sd * (Wx / 2 + 0.15), aisleH + 1.0, z] }), SAND_D));
      if (b < bays) { // tall aisle lancet + clerestory pair
        const wz = z + bayL / 2;
        G.push(glassPane(0, 1.6, 4.6, 1.5, 0, sd * Math.PI / 2, [sd * (Wx / 2 + 0.03), 0, wz]));
        for (const o of [-0.9, 0.9]) G.push(glassPane(o, aisleH + 1.4, aisleH + 3.4, 0.9, 0, sd * Math.PI / 2, [sd * (nw / 2 + 0.03), 0, wz]));
      }
    }
  }
  // entrance gable: 5-lancet group, corner pinnacle turrets, pointed door
  const fz = -hz - 0.04;
  [[-3.6, 6, 9.5], [-1.8, 5.5, 11], [0, 5.2, 12.5], [1.8, 5.5, 11], [3.6, 6, 9.5]].forEach(([x, b, s]) => G.push(glassPane(x, b, s, 1.3, fz, Math.PI)));
  G.push(xf(wallWithHoles(Array.from({ length: 24 }, (_, i) => [Math.cos(i / 24 * 6.283) * 1.5, 18 + Math.sin(i / 24 * 6.283) * 1.5]), [], 0.02), { t: [0, 0, fz] }));
  for (const x of [-nw / 2, nw / 2]) {
    S.push(color(xf(cyl(ridge - 1, 0.75, 0.9, 8), { t: [x, (ridge - 1) / 2, -hz] }), SAND_D));
    S.push(color(xf(cyl(4, 0, 0.8, 8), { t: [x, ridge + 1, -hz] }), SAND_D));
  }
  const door = lancet(0, 0, 2.8, 2.6, 8);
  D.push(color(xf(wallWithHoles(door, [], 0.15), { t: [0, 0, fz - 0.12] }), WOOD));
  S.push(color(xf(archRib(pointedArch(0, 2.8, 3.2, 10).pts, 0.35, 0.5), { t: [0, 0, fz - 0.2] }), SAND_L));
  for (const x of [-1.6, 1.6]) S.push(color(xf(box(0.4, 2.8, 0.5), { t: [x, 1.4, fz - 0.2] }), SAND_L));
  // corner tower on the Carlisle Circus side
  const tx = side * (Wx / 2 - 2.5), tzz = -hz + 2.5, th = 30;
  S.push(color(xf(box(6, th, 6), { t: [tx, th / 2, tzz] }), BRICK));
  S.push(color(xf(box(6.6, 0.8, 6.6), { t: [tx, th, tzz] }), SAND_D));
  for (const a of [-2.8, 2.8]) for (const b of [-2.8, 2.8]) S.push(color(xf(cyl(4.5, 0, 0.5, 8), { t: [tx + a, th + 2.6, tzz + b] }), SAND_D));
  for (const f of [[0, -3.02, Math.PI], [side * 3.02, 0, side * Math.PI / 2]]) for (const o of [-1, 1]) G.push(glassPane(o, th - 7, th - 4, 1.1, 0, f[2], [tx + f[0], 0, tzz + f[1]]));
  // railings + grounds along the front and the circus side
  const rail = [];
  const runRail = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0); const n = Math.floor(L / 0.22); const yw = Math.atan2(x1 - x0, z1 - z0);
    for (const y of [0.15, 1.45]) rail.push(xf(box(0.05, 0.05, L), { r: [0, yw, 0], t: [(x0 + x1) / 2, y, (z0 + z1) / 2] }));
    for (let i = 0; i <= n; i++) { const t = i / n; rail.push(xf(box(0.03, 1.6, 0.03), { t: [x0 + (x1 - x0) * t, 0.8, z0 + (z1 - z0) * t] })); if (i % 10 === 0) rail.push(xf(cyl(0.18, 0, 0.05, 4), { t: [x0 + (x1 - x0) * t, 1.7, z0 + (z1 - z0) * t] })); } };
  const gx = Wx / 2 + 4, gz = hz + 3;
  runRail(-gx, -gz - 2, -1.8, -gz - 2); runRail(1.8, -gz - 2, gx, -gz - 2); runRail(side * gx, -gz - 2, side * gx, gz);
  S.push(color(xf(box(2 * gx, 0.12, 2 * gz + 2), { t: [0, 0.06, -1] }), hex('#3f4a3a')));
  S.push(color(xf(box(3.4, 0.14, gz - hz + 2.2), { t: [0, 0.08, -hz - (gz - hz + 2.2) / 2] }), hex('#8a8178')));
  const stoneM = mat(scene, 'templeExtStone', { s: new Color3(0.1, 0.1, 0.1) });
  const stone = toMesh('templeExtStone', merge([...S, ...D]), scene, stoneM); stone.parent = root;
  const railM = mat(scene, 'rail', { d: IRON, s: new Color3(0.4, 0.4, 0.4) }); const railMesh = toMesh('templeRail', merge(rail), scene, railM); railMesh.parent = root;
  const glowM = mat(scene, 'templeGlow', { d: new Color3(0, 0, 0), e: hex('#ff3d6e'), unlit: true, two: true });
  const glass = toMesh('templeGlass', merge(G), scene, glowM); glass.parent = root;
  const light = new PointLight('templeRed', new Vector3(0, 6, -hz - 9), scene); light.parent = root; light.diffuse = hex('#ff3060'); light.range = 34; light.intensity = 0.5; light.specular = new Color3(0.2, 0.05, 0.1);
  // collisions: actual OSM footprint
  const toWorld = (x, z) => { const c = Math.cos(yaw), s = Math.sin(yaw); return { x: cx + x * c + z * s, z: cz - x * s + z * c }; };
  grid.addPoly(pts, 30.5); // 30.5 marks Temple walls (posters skip them)
  const doorPos = toWorld(0, -hz - 2.2);
  let spawn = toWorld(-side * 3, -hz - 6);
  for (const dd of [30, 26, 22, 18, 14, 10]) { const s2 = toWorld(-side * 3, -hz - dd); if (grid.raycast(doorPos.x, doorPos.z, s2.x, s2.z, 1) >= 1) { spawn = s2; break; } }
  return { root, glowM, light, doorPos, spawn, yaw, toWorld };
}
export function updateTempleExterior(ext, t, live) {
  const beat = t * 140 / 60; const ph = beat % 1;
  const pulse = Math.exp(-ph * 4.5); const flick = 0.85 + 0.15 * Math.sin(t * 37.0) * Math.sin(t * 13.3) + (Math.sin(t * 2.1) > 0.97 ? -0.4 : 0);
  const k = live ? (0.35 + 0.75 * pulse) * flick : 0.12;
  const c = live ? hex('#ff2f5f') : hex('#ffc78a');
  ext.glowM.emissiveColor.set(c.r * k, c.g * k * (0.8 + 0.2 * pulse), c.b * k);
  ext.light.intensity = live ? 0.15 + 0.55 * pulse * flick : 0.08;
}

// ======================= INTERIOR =======================
const OFF = new Vector3(4000, 0, 0); // interior lives far from the city; city is disabled while inside
export const INTERIOR_ORIGIN = OFF;

function floorTex(scene) {
  const N = 1024; const t = new DynamicTexture('templeFloor', N, scene, true); const c = t.getContext(); const R = rng(11);
  // grey-blue stone flags in staggered courses, lighter patched slabs down the centre aisle (texture spans 19.2 x 46 m)
  c.fillStyle = '#4d535a'; c.fillRect(0, 0, N, N);
  const fw = N / 21, fh = N / 38;
  for (let r = 0; r < 38; r++) { const off = (r % 2) * fw * 0.5; for (let k = -1; k < 22; k++) { const x = k * fw + off, y = r * fh, mid = Math.abs(x + fw / 2 - N / 2) < N * 0.09;
    const v = (mid && R() < 0.35 ? 18 : 0) + (R() - 0.5) * 18; const b = [104 + v, 112 + v, 120 + v].map(q => Math.round(Math.max(40, Math.min(200, q))));
    c.fillStyle = `rgb(${b[0]},${b[1]},${b[2]})`; c.fillRect(x + 1.5, y + 1.5, fw - 3, fh - 3);
    if (R() < 0.25) { c.fillStyle = `rgba(30,32,36,${0.08 + R() * 0.1})`; c.beginPath(); c.ellipse(x + R() * fw, y + R() * fh, 4 + R() * 12, 3 + R() * 6, R() * 3, 0, 7); c.fill(); } } }
  c.strokeStyle = 'rgba(25,27,30,0.35)'; c.lineWidth = 1; for (let i = 0; i < 30; i++) { c.beginPath(); let x = R() * N, y = R() * N; c.moveTo(x, y); for (let k = 0; k < 3; k++) { x += (R() - 0.5) * 30; y += (R() - 0.5) * 30; c.lineTo(x, y); } c.stroke(); }
  t.update(); t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE; return t;
}
function signTex(scene, txt, fg, bg, w = 256, h = 96, font = 'bold 60px "DM Sans", Arial') {
  const t = new DynamicTexture('sign-' + txt, { width: w, height: h }, scene, true); const c = t.getContext();
  c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 2); t.update(); return t;
}

export function buildTempleInterior(scene, { glow, low = false, makeDancer, bakeCrowd }) {
  const root = new TransformNode('templeInt', scene); root.position.copyFrom(OFF);
  const R = rng(9);
  const NW = 5, AW = 9.6, LZ = 40, CH = 46; // nave half-width (column line), aisle outer, nave length, chancel back wall
  const springY = 6.2, clerTop = 14, ridge = 20.5;
  const S = [], W = [], M = [], Wd = []; // stone, white-ish details, metal, wood/ply
  const segs = [];
  // ---- floor ----
  const fm = mat(scene, 'tFloor', { s: new Color3(0.35, 0.35, 0.35), p: 70 }); fm.diffuseTexture = floorTex(scene);
  const floor = toMesh('tFloor', xf(box(2 * AW, 0.2, CH), { t: [0, -0.1, CH / 2] }), scene, fm); floor.parent = root;
  // ---- outer walls with lancet windows ----
  const bayZ = [0, 6, 12, 18, 24, 30, 36];
  for (const sd of [-1, 1]) {
    const holes = []; for (let b = 0; b < 6; b++) holes.push(lancet(bayZ[b] + 3, 2.2, 5.4, 1.5, 8).map(([z, y]) => [z, y]));
    // outer aisle wall: XY plane rotated so local X runs along +z
    const outer = [[0, 0], [LZ, 0], [LZ, 7.8], [0, 7.8]];
    S.push(wallAt(outer, holes.map(h => h.slice().reverse()), 0.8, [0, -Math.PI / 2, 0], [sd * (AW + (sd > 0 ? 0.8 : 0)), 0, 0], SAND));
    segs.push([sd * AW, 0, sd * AW, LZ]);
  }
  // aisle window glass (for day/rave emissive)
  const G = [];
  for (const sd of [-1, 1]) for (let b = 0; b < 6; b++) G.push(glassPane(0, 2.2, 5.4, 1.5, 0, Math.PI / 2, [sd * (AW + 0.4), 0, bayZ[b] + 3]));
  // ---- arcades: banded columns, carved capitals, pointed arches + clerestory wall ----
  for (const sd of [-1, 1]) {
    for (let b = 1; b <= 6; b++) {
      const z = bayZ[b], x = sd * NW;
      S.push(color(xf(cyl(0.5, 0.85, 0.95, 12), { t: [x, 0.25, z] }), SAND_D));
      for (let k = 0; k < 8; k++) S.push(color(xf(cyl(0.72, 0.62, 0.62, 14), { t: [x, 0.5 + 0.72 * k + 0.36, z] }), k % 2 ? SAND_R : SAND_L));
      S.push(color(xf(cyl(0.6, 0.95, 0.65, 14), { t: [x, springY - 0.2, z] }), SAND_L)); // capital bell
      for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; S.push(color(xf(sphere(5), { s: [0.16, 0.2, 0.16], t: [x + Math.cos(a) * 0.78, springY - 0.25, z + Math.sin(a) * 0.78] }), SAND_D)); } // carved leaves
      S.push(color(xf(box(1.9, 0.3, 1.9), { t: [x, springY + 0.15, z] }), SAND_L)); // abacus
      segs.push([x - 0.6, z - 0.6, x + 0.6, z + 0.6], [x - 0.6, z + 0.6, x + 0.6, z - 0.6]);
    }
    // arcade wall with pointed openings between columns
    const ops = [3, 9, 15, 21, 27, 33].map(zc => [zc, springY + 0.3, 5.0]);
    const outer = notched(0.5, 36.6, springY + 0.3, ops, [[36.6, clerTop], [0.5, clerTop]]);
    S.push(wallAt(outer, [], 0.9, [0, -Math.PI / 2, 0], [sd * NW + 0.45, 0, 0], SAND));
    // arch mouldings (two orders)
    for (let b = 0; b < 6; b++) { const zc = b === 0 ? 3 : (bayZ[b] + bayZ[b + 1]) / 2; const a = pointedArch(0, springY + 0.3, 5.0, 12);
      for (const f of [-0.5, 0.5]) S.push(color(xf(archRib(a.pts, 0.35, 0.3), { r: [0, -Math.PI / 2, 0], t: [sd * NW + f, 0, zc] }), SAND_L)); }
    // clerestory windows
    for (let b = 0; b < 6; b++) G.push(glassPane(0, 10.6, 12.2, 0.8, 0, Math.PI / 2, [sd * (NW + 0.5), 0, bayZ[b] + 3]));
    // string course
    S.push(color(xf(box(0.3, 0.3, 36.6), { t: [sd * (NW - 0.5), 9.8, 18.3] }), SAND_L));
  }
  // ---- aisle lean-to roofs (timber) ----
  for (const sd of [-1, 1]) { const sl = Math.hypot(AW - NW, 3.5);
    for (let z = 0.5; z < LZ; z += 1.6) Wd.push(color(xf(box(sl, 0.18, 0.12), { r: [0, 0, sd * Math.atan2(3.5, AW - NW)], t: [sd * (NW + AW) / 2, 9.4, z] }), TIMBER));
    Wd.push(color(xf(box(sl, 0.06, LZ), { r: [0, 0, sd * Math.atan2(3.5, AW - NW)], t: [sd * (NW + AW) / 2, 9.65, LZ / 2] }), BOARD)); }
  // ---- dark open timber roof (near-black rafters + purlins, a few lost boards) ----
  const half = NW + 0.5, rh = ridge - clerTop, rl = Math.hypot(half, rh), ang = Math.atan2(rh, half);
  const gaps = [];
  for (let z = 1; z < LZ; z += 2.2) {
    for (const sd of [-1, 1]) Wd.push(color(xf(box(rl, 0.32, 0.22), { r: [0, 0, -sd * ang], t: [sd * half / 2, (clerTop + ridge) / 2, z] }), TIMBER));
    Wd.push(color(xf(box(2 * half * 0.6, 0.25, 0.2), { t: [0, clerTop + rh * 0.4, z] }), TIMBER)); // collar tie
  }
  for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) { const f = (k + 0.5) / 4; Wd.push(color(xf(box(0.2, 0.2, LZ), { t: [sd * half * (1 - f), clerTop + rh * f, LZ / 2] }), TIMBER)); }
  // boarding panels with holes (broken roof)
  for (const sd of [-1, 1]) for (let z = 0; z < LZ; z += 4) for (let k = 0; k < 3; k++) {
    if (R() < 0.05) { gaps.push([sd * half * (1 - (k + 0.5) / 3), clerTop + rh * (k + 0.5) / 3, z + 2]); continue; }
    const f = (k + 0.5) / 3; Wd.push(color(xf(box(rl / 3, 0.08, 4), { r: [0, 0, -sd * ang], t: [sd * half * (1 - f), clerTop + rh * f + 0.25, z + 2] }), BOARD));
  }
  if (!gaps.length) gaps.push([2, 18, 20]);
  // ---- altar end: chancel arch, 5 lancets, carved arcade frieze, stepped platform ----
  const chW = 9.2, chSpring = 8.2;
  const chA = pointedArch(0, chSpring, chW, 14);
  const gTop = [[AW, clerTop], [half, clerTop], [0, ridge], [-half, clerTop], [-AW, clerTop]];
  S.push(wallAt(notched(-AW, AW, 0, [[0, chSpring, chW]], gTop), [], 0.9, [0, 0, 0], [0, 0, LZ], SAND));
  for (const f of [0.0, 0.5]) S.push(color(xf(archRib(pointedArch(0, chSpring, chW + 0.6 - f, 14).pts, 0.45, 0.5), { t: [0, 0, LZ - 0.2 + f] }), SAND_L));
  for (const x of [-chW / 2 - 0.3, chW / 2 + 0.3]) { S.push(color(xf(box(0.8, chSpring, 0.9), { t: [x, chSpring / 2, LZ - 0.1] }), SAND_L)); for (let k = 0; k < 3; k++) S.push(color(xf(cyl(chSpring, 0.18, 0.18, 8), { t: [x + (x < 0 ? 0.45 : -0.45), chSpring / 2, LZ - 0.6 + k * 0.4] }), SAND_D)); }
  // chancel side walls + back wall with 5 lancets
  for (const sd of [-1, 1]) { S.push(color(xf(box(0.8, 16, CH - LZ), { t: [sd * (chW / 2 + 0.4), 8, (LZ + CH) / 2] }), SAND)); segs.push([sd * chW / 2, LZ, sd * chW / 2, CH]); }
  const lan = [[-3.2, 7.2, 11.6], [-1.6, 7.0, 12.8], [0, 7.0, 13.6], [1.6, 7.0, 12.8], [3.2, 7.2, 11.6]];
  const lanHoles = lan.map(([x, b, s]) => lancet(x, b, s, 1.2, 8).reverse());
  S.push(wallAt([[-chW / 2, 0], [chW / 2, 0], [chW / 2, 17], [-chW / 2, 17]], lanHoles, 0.8, [0, 0, 0], [0, 0, CH], SAND));
  S.push(color(xf(box(chW, 1, 1), { t: [0, 17.2, CH - 1] }), SAND)); // chancel ceiling edge
  const altarGlass = merge(lan.map(([x, b, s]) => glassPane(x, b, s, 1.2, CH + 0.45)));
  for (const [x] of lan) for (const dx of [-0.62, 0.62]) S.push(color(xf(box(0.16, 7, 0.3), { t: [x + dx, 10, CH - 0.05] }), SAND_L)); // mullions
  // carved arcade frieze (blind arches) under the windows
  const frieze = [];
  for (let k = 0; k < 11; k++) { const x = -chW / 2 + 0.55 + k * (chW - 1.1) / 10; frieze.push(color(xf(archRib(pointedArch(x, 4.8, 0.7, 6).pts, 0.1, 0.15), { t: [0, 0, CH - 0.1] }), SAND_L));
    frieze.push(color(xf(cyl(1.8, 0.07, 0.07, 6), { t: [x - 0.35, 3.9, CH - 0.1] }), SAND_L)); }
  frieze.push(color(xf(box(chW, 0.25, 0.4), { t: [0, 3.0, CH - 0.15] }), SAND_L), color(xf(box(chW, 0.3, 0.45), { t: [0, 5.6, CH - 0.15] }), SAND_L));
  S.push(...frieze);
  // stepped platform
  for (let k = 0; k < 3; k++) S.push(color(xf(box(2 * NW + 1, 0.3, CH - 36 - k * 1.0), { t: [0, 0.15 + 0.3 * k, (36 + k * 1.0 + CH) / 2] }), Color3.Lerp(SAND_D, hex('#6f6a64'), 0.5)));
  // ---- rear wall: 3 arches + rose window ----

  const rose = Array.from({ length: 32 }, (_, i) => [Math.cos(-i / 32 * 6.283) * 2.6, 12.6 + Math.sin(-i / 32 * 6.283) * 2.6]);
  S.push(wallAt(notched(-AW, AW, 0, [[-5.5, 3.0, 2.4], [0, 3.6, 3.0], [5.5, 3.0, 2.4]], gTop), [rose], 0.9, [0, 0, 0], [0, 0, -0.9], SAND));
  for (const x of [-5.5, 0, 5.5]) S.push(color(xf(archRib(pointedArch(x, x ? 3.0 : 3.6, (x ? 2.4 : 3.0) + 0.5, 10).pts, 0.3, 0.3), { t: [0, 0, 0.1] }), SAND_L));
  const roseParts = [xf(torus(5.4, 0.3, 32), { r: [Math.PI / 2, 0, 0], t: [0, 12.6, 0.05] }), xf(torus(2.2, 0.18, 24), { r: [Math.PI / 2, 0, 0], t: [0, 12.6, 0.05] })];
  for (let k = 0; k < 12; k++) roseParts.push(xf(box(0.14, 2.6, 0.18), { r: [0, 0, k / 12 * Math.PI * 2], t: [Math.sin(-k / 12 * 6.283) * 1.9, 12.6 + Math.cos(k / 12 * 6.283) * 1.9, 0.05] }));
  S.push(color(merge(roseParts), SAND_L));
  const roseGlass = xf(wallWithHoles(rose.slice().reverse(), [], 0.02), { t: [0, 0, -0.5] });
  // dark lobby behind rear doors
  S.push(color(xf(box(2 * AW, 5, 0.4), { t: [0, 2.5, -3.2] }), hex('#2b2522')));
  segs.push([-AW, 0, AW, 0]);
  // ---- right-aisle plywood partition with doors ----
  Wd.push(color(xf(box(0.12, 3.2, 22), { t: [8.6, 1.6, 14] }), PLY));
  for (const z of [9, 15]) { Wd.push(color(xf(box(0.06, 2.2, 1.0), { t: [8.52, 1.1, z] }), hex('#9a9fa3'))); M.push(color(xf(box(0.04, 0.05, 0.2), { t: [8.47, 1.05, z + 0.35] }), STEEL)); }
  // ---- stage kit: DJ booth, CDJs + mixer, truss towers with LED bars, line arrays, subs, flight cases, barriers ----
  const PZ = 0.9; // platform top
  const kit = new TransformNode('stageKit', scene); kit.parent = root;
  const K = [], LEDW = [], LEDR = [], SCR = [], BOOTHW = [], BOOTHR = [];
  // curved booth: half-cylinder shell
  const booth = xf(cyl(1.15, 2.3, 2.3, 28, true), { s: [1, 1, 0.55], t: [0, PZ + 0.575, 39.4] });
  K.push(color(booth, hex('#101012')));
  BOOTHW.push(xf(torus(4.65, 0.08, 40), { s: [1, 1, 0.55], t: [0, PZ + 1.16, 39.4] }));
  BOOTHR.push(xf(cyl(0.32, 2.33, 2.33, 28, false), { s: [1, 1, 0.555], t: [0, PZ + 0.75, 39.4] }));
  K.push(color(xf(box(4.0, 0.08, 1.0), { t: [0, PZ + 1.18, 39.5] }), hex('#1a1a1d')));
  for (const x of [-1.45, -0.75, 0.75, 1.45]) { // CDJs
    K.push(color(xf(rbox(0.6, 0.12, 0.72, 0.3, 8), { t: [x, PZ + 1.28, 39.5] }), hex('#2a2b30')));
    K.push(color(xf(cyl(0.03, 0.22, 0.22, 20), { t: [x, PZ + 1.355, 39.45] }), hex('#55575e')));
    SCR.push(xf(box(0.3, 0.02, 0.16), { t: [x, PZ + 1.35, 39.75] }));
  }
  K.push(color(xf(rbox(0.6, 0.14, 0.7, 0.3, 8), { t: [0, PZ + 1.29, 39.5] }), hex('#222327')));
  for (let k = 0; k < 4; k++) K.push(color(xf(box(0.04, 0.03, 0.3), { t: [-0.18 + k * 0.12, PZ + 1.38, 39.45] }), hex('#d0d0d0')));
  // truss towers (6) behind booth
  const towerX = [-4.1, -2.5, -0.85, 0.85, 2.5, 4.1], tz = 42.6, TH = 5.2;
  for (const x of towerX) {
    for (const a of [-0.15, 0.15]) for (const b of [-0.15, 0.15]) M.push(color(xf(cyl(TH, 0.025, 0.025, 6), { t: [x + a, PZ + TH / 2, tz + b] }), ALU));
    for (let y = 0.3; y < TH; y += 0.5) for (const f of [0, 1, 2, 3]) M.push(color(xf(cyl(0.55, 0.012, 0.012, 4), { r: [f % 2 ? 0.8 : -0.8, f * Math.PI / 2, 0], t: [x + [0, 0.15, 0, -0.15][f], PZ + y + 0.25, tz + [-0.15, 0, 0.15, 0][f]] }), ALU));
    M.push(color(xf(box(0.7, 0.05, 0.7), { t: [x, PZ + 0.03, tz] }), STEEL));
    for (const y of [TH - 0.4, 2.2]) LEDW.push(xf(box(1.05, 0.09, 0.09), { t: [x, PZ + y, tz - 0.22] }));
  }
  for (let i = 0; i < towerX.length - 1; i++) for (const o of [-0.25, 0.25]) LEDR.push(xf(box(0.05, 3.2, 0.05), { t: [(towerX[i] + towerX[i + 1]) / 2 + o, PZ + 2.9, tz + 0.1] }));
  // frieze red uplighters (cans) along back wall
  for (let k = 0; k < 6; k++) K.push(color(xf(cyl(0.3, 0.12, 0.14, 10), { t: [-3.75 + k * 1.5, PZ + 0.15, CH - 0.7] }), hex('#111')));
  // line arrays on stands either side
  for (const sd of [-1, 1]) {
    const x = sd * 6.6, z = 35.2;
    M.push(color(xf(cyl(4.6, 0.05, 0.06, 8), { t: [x, 2.3, z] }), IRON));
    for (const a of [0, 2.1, 4.2]) M.push(color(xf(box(1.3, 0.06, 0.06), { r: [0, a, -0.6], t: [x + Math.cos(a) * 0.5, 0.4, z + Math.sin(a) * 0.5] }), IRON));
    for (let k = 0; k < 6; k++) K.push(color(xf(rbox(1.1, 0.34, 0.62, 0.2, 6), { r: [0.06 * k, 0, 0], t: [x, 5.5 - k * 0.36, z - 0.03 * k * k] }), hex('#141416')));
    for (let k = 0; k < 2; k++) K.push(color(xf(rbox(1.2, 0.75, 0.9, 0.18, 6), { t: [x, 0.38 + k * 0.76, z + 1.4] }), hex('#18181a')));
    for (let k = 0; k < 3; k++) { const fc = xf(rbox(1.2, 0.6, 0.7, 0.12, 6), { t: [sd * (7.8 - k * 0.2), 0.32 + (k === 2 ? 0.62 : 0), 36.8 + (k === 1 ? 0.9 : 0)] }); K.push(color(fc, CASE));
      M.push(color(xf(box(1.22, 0.05, 0.72), { t: [sd * (7.8 - k * 0.2), 0.32 + (k === 2 ? 0.62 : 0) + 0.18, 36.8 + (k === 1 ? 0.9 : 0)] }), STEEL)); }
  }
  // crowd barriers across the nave
  for (let x = -NW + 0.6; x < NW - 0.5; x += 2.2) {
    M.push(color(xf(box(2.1, 0.06, 0.06), { t: [x + 1.05, 1.15, 34.2] }), STEEL), color(xf(box(2.1, 0.06, 0.06), { t: [x + 1.05, 0.15, 34.2] }), STEEL));
    for (let k = 0; k <= 12; k++) M.push(color(xf(box(0.025, 1.0, 0.025), { t: [x + k * 0.175, 0.65, 34.2] }), STEEL));
    M.push(color(xf(box(0.06, 0.06, 0.9), { t: [x + 0.2, 0.03, 34.3] }), STEEL), color(xf(box(0.06, 0.06, 0.9), { t: [x + 1.9, 0.03, 34.3] }), STEEL));
  }
  segs.push([-NW, 34.2, NW, 34.2], [-AW, 34.6, -NW, 34.6], [NW, 34.6, AW, 34.6]);
  // exit sign + lit exit doors at rear centre
  const exitM = mat(scene, 'exitSign', { unlit: true }); exitM.emissiveTexture = signTex(scene, '⟵ EXIT', '#ffffff', '#11a84a'); exitM.diffuseColor = Color3.Black();
  const exitSign = toMesh('exitSign', xf(plane(1.4, 0.5), { t: [0, 4.6, 0.25] }), scene, exitM); exitSign.parent = root;
  exitSign.scaling.x = -1;
  const doorM = mat(scene, 'exitDoor', { e: hex('#3a5a46'), d: hex('#2b3a30') });
  { const fdM = mat(scene, 'tFireDoor', { e: hex('#2a271f') }); const fdG = [];
    for (const z of [19.2, 31.2]) { fdG.push(color(xf(box(0.08, 2.3, 1.7), { t: [AW - 0.05, 1.15, z] }), hex('#e6dcc0')), color(xf(box(0.1, 0.06, 1.5), { t: [AW - 0.1, 1.05, z] }), hex('#8a8f96')), color(xf(box(0.1, 2.4, 0.08), { t: [AW - 0.04, 1.2, z] }), hex('#cfc4a8')));
      const sg = toMesh('fireExit' + z, xf(plane(0.9, 0.32), { r: [0, Math.PI / 2, 0], t: [AW - 0.1, 2.6, z] }), scene, exitM); sg.parent = root; }
    const fd = toMesh('tFireDoors', merge(fdG), scene, fdM); fd.parent = root; }
  const exitDoor = toMesh('exitDoor', xf(wallWithHoles(lancet(0, 0, 3.6, 3.0, 8), [], 0.1), { t: [0, 0, -0.6] }), scene, doorM); exitDoor.parent = root;
  // brand banner (B&W Reckless) hung from the chancel arch
  const banM = mat(scene, 'banner', { unlit: true, two: true }); banM.emissiveTexture = new Texture(import.meta.env.BASE_URL + 'img/logo.png', scene); banM.emissiveTexture.hasAlpha = true; banM.opacityTexture = banM.emissiveTexture; banM.diffuseColor = Color3.Black();
  const banner = toMesh('banner', xf(plane(3.0, 2.6), { t: [0, 11.5, LZ + 0.6] }), scene, banM); banner.parent = root; banner.scaling.x = -1;

  // ---- materials & meshes ----
  const stoneM = mat(scene, 'tStone', { s: new Color3(0.06, 0.06, 0.06) });
  const woodM = mat(scene, 'tWood', { s: new Color3(0.04, 0.04, 0.04) });
  const metalM = mat(scene, 'tMetal', { s: new Color3(0.6, 0.6, 0.65), p: 60 });
  const mk = (n, vds, m) => { const me = toMesh(n, merge(vds), scene, m); me.parent = root; me.isPickable = false; return me; };
  mk('tStoneM', S, stoneM); mk('tWoodM', Wd, woodM); mk('tMetalM', M, metalM); mk('tKit', K, metalM);
  const sideGlassM = mat(scene, 'tSideGlass', { unlit: true, two: true, d: Color3.Black() });
  const altarGlassM = mat(scene, 'tAltarGlass', { unlit: true, two: true, d: Color3.Black() });
  const roseM = mat(scene, 'tRoseGlass', { unlit: true, two: true, d: Color3.Black() });
  mk('tSideGlass', G, sideGlassM); mk('tAltarGlass', [altarGlass], altarGlassM); mk('tRose', [roseGlass], roseM);
  const ledWM = mat(scene, 'ledW', { unlit: true, e: new Color3(1, 1, 1), d: Color3.Black() }), ledRM = mat(scene, 'ledR', { unlit: true, e: hex('#ff1a2a'), d: Color3.Black() });
  const scrM = mat(scene, 'scr', { unlit: true, e: hex('#8fd0ff'), d: Color3.Black() });
  const bwM = mat(scene, 'boothW', { unlit: true, e: new Color3(1, 1, 1), d: Color3.Black() }), brM = mat(scene, 'boothR', { unlit: true, e: hex('#ff2233'), d: Color3.Black() });
  const ledW = mk('ledW', LEDW, ledWM), ledR = mk('ledR', LEDR, ledRM); mk('scr', SCR, scrM); mk('boothW', BOOTHW, bwM); mk('boothR', BOOTHR, brM);
  // frieze uplight wash (additive quads on the wall)
  const washT = new DynamicTexture('wash', { width: 64, height: 128 }, scene, true); { const c = washT.getContext(); const g = c.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 128); washT.hasAlpha = true; washT.update(); }
  const washM = mat(scene, 'wash', { unlit: true, add: true, d: Color3.Black() }); washM.emissiveColor = hex('#ff1020'); washM.opacityTexture = washT;
  const washes = []; for (let k = 0; k < 6; k++) washes.push(xf(plane(1.8, 6.5), { t: [-3.75 + k * 1.5, PZ + 3.2, CH - 0.45] }));
  const wash = mk('wash', washes, washM);
  // window back-glow (additive halo inside chancel for the red lancets)
  const haloM = mat(scene, 'halo', { unlit: true, add: true, d: Color3.Black() }); haloM.opacityTexture = washT; haloM.emissiveColor = hex('#600008');
  const halo = mk('halo', [xf(plane(9, 9), { t: [0, 9, CH - 0.3] })], haloM);
  // beams: moving heads on truss tops + back-light blasters
  const bT = beamTex(scene);
  const beamM = mat(scene, 'tBeam', { unlit: true, add: true, d: Color3.Black() }); beamM.opacityTexture = bT; beamM.emissiveColor = hex('#cfe3ff');
  const beams = [];
  const beamGeo = merge([xf(cyl(34, 0.08, 2.6, 16, false), { t: [0, -17, 0] }), xf(cyl(34, 0.04, 0.7, 12, false), { t: [0, -17, 0] })]); // soft outer cone + bright core (reads volumetric in haze)
  for (let i = 0; i < 6; i++) { const m = toMesh('beam' + i, beamGeo, scene, beamM); m.parent = root; m.position.set(towerX[i], PZ + TH + 0.2, tz); m.isPickable = false; beams.push({ m, i, kind: 'mh' }); }
  const beamRM = mat(scene, 'tBeamR', { unlit: true, add: true, d: Color3.Black() }); beamRM.opacityTexture = bT; beamRM.emissiveColor = hex('#ff2040');
  for (let i = 0; i < 6; i++) { const m = toMesh('beamR' + i, beamGeo, scene, beamRM); m.parent = root; m.position.set((i < 3 ? -1 : 1) * (NW + 0.4), 11.5, 14 + (i % 3) * 7); m.isPickable = false; beams.push({ m, i: i + 6, kind: 'side', sd: i < 3 ? -1 : 1 }); }
  const blastM = mat(scene, 'tBlast', { unlit: true, add: true, d: Color3.Black() }); blastM.opacityTexture = bT; blastM.emissiveColor = hex('#7fb4ff');
  const blastGeo = xf(cyl(30, 0.25, 4.5, 18, false), { t: [0, -15, 0] });
  for (let i = 0; i < 4; i++) { const m = toMesh('blast' + i, blastGeo, scene, blastM); m.parent = root; m.position.set(-3 + i * 2, PZ + 1.7, 43.5); m.isPickable = false; beams.push({ m, i, kind: 'blast' }); }
  // day light shafts through roof gaps + windows
  const shaftM = mat(scene, 'shaft', { unlit: true, add: true, d: Color3.Black() }); shaftM.opacityTexture = bT; shaftM.emissiveColor = hex('#30281c');
  const shafts = [];
  for (const g of gaps.slice(0, 5)) shafts.push(xf(cyl(20, 0.6, 1.3, 10, false), { r: [0.3, 0, -0.22], t: [g[0] + 2.2, g[1] - 9.5, g[2] + 3.0] }));
  const shaftMesh = mk('shafts', shafts, shaftM);
  // haze sheets
  const hazeT = new DynamicTexture('haze', 256, scene, true); { const c = hazeT.getContext(); const H = rng(3); c.clearRect(0, 0, 256, 256); for (let i = 0; i < 60; i++) { const x = 70 + H() * 116, y = 80 + H() * 96, r = 25 + H() * 45; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); } hazeT.hasAlpha = true; hazeT.update(); }
  const hazeM = mat(scene, 'hazeM', { unlit: true, add: true, d: Color3.Black() }); hazeM.opacityTexture = hazeT; hazeM.emissiveColor = hex('#0f1119');
  const hazes = []; for (let k = 0; k < (low ? 4 : 8); k++) { const m = toMesh('haze' + k, xf(plane(22, 9), { t: [0, 0, 0] }), scene, hazeM); m.parent = root; m.position.set((R() - 0.5) * 6, 3 + R() * 4, 10 + k * 3.4); m.isPickable = false; hazes.push(m); }

  // ---- bar: north aisle, on the LEFT as you walk in from the west entrance (Luke); the cream fire doors stay in the south aisle ----
  { const barM = mat(scene, 'tBar', { d: hex('#2a2626') }); const bar = toMesh('bar', merge([color(xf(box(0.8, 1.1, 5), { t: [-7.2, 0.55, 6.5] }), hex('#2a2626')), color(xf(box(1.0, 0.06, 5.2), { t: [-7.2, 1.13, 6.5] }), hex('#8a8580')), color(xf(box(0.4, 2.2, 5), { t: [-9.2, 1.1, 6.5] }), hex('#1c1a1a'))]), scene, barM); bar.parent = root;
    const glowM2 = mat(scene, 'tBarGlow', { unlit: true }); glowM2.emissiveColor = hex('#ff2a3a'); const strip = toMesh('barStrip', xf(box(0.02, 0.06, 5), { t: [-6.79, 0.9, 6.5] }), scene, glowM2); strip.parent = root;
    const botM = mat(scene, 'tBottles', { unlit: true }); botM.emissiveColor = hex('#ffd8a0'); const bt = []; for (let k = 0; k < 18; k++) bt.push(xf(cyl(0.28, 0.04, 0.05, 6), { t: [-8.95, 1.35 + (k % 2) * 0.55, 4.3 + Math.floor(k / 2) * 0.5] })); const bots = toMesh('bottles', merge(bt), scene, botM); bots.parent = root;
    const sT = new DynamicTexture('barSign', { width: 256, height: 128 }, scene, true); { const g = sT.getContext(); g.setTransform(1, 0, 0, 128 / 96, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 84); g.fillStyle = '#fff'; g.font = '800 54px Unbounded, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BAR', 128, 50); sT.update(); }
    const sM = mat(scene, 'tBarSignM', { unlit: true, two: true }); sM.emissiveTexture = sT; const sign = toMesh('barSign', xf(plane(1.6, 0.6), { r: [0, -Math.PI / 2, 0], t: [-7.2, 2.7, 6.5] }), scene, sM); sign.parent = root;
    segs.push([-6.8, 4, -6.8, 9]);
    // soft warm light over the back shelf (additive wash, no real light): reads as bar lighting without touching the east window
    const bwT = new DynamicTexture('barWashT', 128, scene, true); { const g = bwT.getContext(); const gr = g.createRadialGradient(64, 40, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); bwT.update(); }
    const bwM = mat(scene, 'tBarWash', { unlit: true, add: true, d: Color3.Black() }); bwM.opacityTexture = bwT; bwM.emissiveColor = hex('#6a4a2a');
    const bw = toMesh('barWash', xf(plane(5.6, 2.6), { r: [0, -Math.PI / 2, 0], t: [-8.98, 1.7, 6.5] }), scene, bwM); bw.parent = root; bw.isPickable = false; }
  // ---- crowd (thin instances) ----
  const crowdN = low ? 80 : 150;
  const crowd = [];
  for (let i = 0; i < crowdN; i++) {
    let x, z; do { x = (R() - 0.5) * 2 * (AW - 0.6); z = 10.5 + Math.pow(R(), 0.6) * 23; } while (Math.abs(Math.abs(x) - NW) < 0.8 && (z % 6 < 0.8 || z % 6 > 5.2));
    crowd.push({ x, z, ph: R() * 4, sp: 0.8 + R() * 0.4, up: R(), yaw: (R() - 0.5) * 0.7, s: 0.9 + R() * 0.18, v: Math.floor(R() * 6) });
  }
  // instanced avatars: baked mocap dance poses x Drop 018 outfit variants (thin instances, swapped on the beat)
  const CV = bakeCrowd ? bakeCrowd() : null; const cvMeshes = [];
  if (CV) for (const it of CV.list) for (const m of [it.body, it.head, it.far]) { if (!m) continue; m.parent = root; m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m._buf = new Float32Array(crowdN * 16); m.thinInstanceSetBuffer('matrix', m._buf, 16, false); m.thinInstanceCount = 0; cvMeshes.push(m); }
  const cMeshes = cvMeshes; const bufs = null; const cBody = null, cLegs = null, cHead = null, cHair = null, cArm = null;
  // a few full avatars dancing at the barrier
  const dancers = [];
  if (makeDancer) for (let i = 0; i < (low ? 3 : 6); i++) { const av = makeDancer(i); av.root.parent = root; av.root.position.set(-3.6 + i * 1.45, 0, 32.6 - (i % 2) * 1.2); av.root.rotation.y = (R() - 0.5) * 0.6; dancers.push(av); }

  const lights = {
    hemi: new HemisphericLight('tHemi', new Vector3(0.2, 1, 0.1), scene),
    sun: new DirectionalLight('tSun', new Vector3(0.4, -0.8, 0.35), scene),
    red: new PointLight('tRed', new Vector3(0, 8, CH - 3).add(OFF), scene),
    blue: new PointLight('tBlue', new Vector3(0, 5, 38).add(OFF), scene),
  };
  lights.red.range = 26; lights.blue.range = 45; lights.red.diffuse = hex('#ff1830'); lights.blue.diffuse = hex('#9cc4ff');
  for (const l of Object.values(lights)) l.setEnabled(false);
  const T = {
    root, crowd, segs: segs.map(([a, b, c, d]) => [a + OFF.x, b + OFF.z, c + OFF.x, d + OFF.z]),
    spawn: new Vector3(0, 0, 7).add(OFF), exitPos: new Vector3(0, 0, 1.2).add(OFF), lights, mode: 'rave', dancers,
    glowSkip: () => [...beams.map(b => b.m), ...hazes, shaftMesh, wash, halo, floor, ...cMeshes],
    meshes: { ledW, ledR, wash, halo, shaftMesh, hazes, beams, crowd: [...cMeshes], CVL: CV ? CV.list : null, sideGlassM, altarGlassM, roseM, ledWM, ledRM, bwM, brM, washM, haloM, beamM, blastM, exitM, beamRM },
    danceFloor: (p) => p.z - OFF.z > 4 && p.z - OFF.z < 34 && Math.abs(p.x - OFF.x) < AW,
    CV,
  };
  return T;
}

export function setTempleMode(T, scene, mode) {
  T.mode = mode; const day = mode === 'day'; const M = T.meshes;
  M.shaftMesh.setEnabled(day); M.hazes.forEach(h => h.setEnabled(!day)); M.beams.forEach(b => b.m.setEnabled(!day));
  M.crowd.forEach(m => m.setEnabled(!day)); M.wash.setEnabled(!day); M.halo.setEnabled(!day);
  T.dancers.forEach(d => d.root.setEnabled(!day));
  M.ledW.setEnabled(!day); M.ledR.setEnabled(!day);
  const L = T.lights;
  L.hemi.intensity = day ? 0.62 : 0.5; L.hemi.diffuse = day ? hex('#f3e6d6') : hex('#6a6fa0'); L.hemi.groundColor = day ? hex('#6a5a4a') : hex('#4a1018');
  L.sun.intensity = day ? 0.45 : 0; L.sun.diffuse = hex('#fff1d6');
  L.red.intensity = day ? 0 : 1.7; L.blue.intensity = day ? 0 : 1.0;
  M.sideGlassM.emissiveColor = day ? hex('#fff3d8') : hex('#1b1530');
  M.altarGlassM.emissiveColor = day ? hex('#fff6e2') : hex('#ff0a1e');
  M.roseM.emissiveColor = day ? hex('#ffe9c4') : hex('#3a1030');
  scene.clearColor = day ? new Color4(0.75, 0.82, 0.92, 1) : new Color4(0.01, 0.005, 0.02, 1);
  scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = day ? 0.008 : 0.016; scene.fogColor = day ? new Color3(0.5, 0.47, 0.43) : new Color3(0.1, 0.035, 0.07);
}

const m4 = new Matrix(), q4 = new Quaternion(), v4 = new Vector3(), s4 = new Vector3();
export function updateTempleInterior(T, t, dt) {
  if (T.mode === 'day') return;
  const beat = t * 140 / 60, ph = beat % 1, kick = Math.exp(-ph * 5);
  const M = T.meshes;
  // crowd: pick the baked pose on the half-beat, bounce on the kick
  if (M.CVL) {
    for (const it of M.CVL) { it.n = 0; it.fn = 0; }
    const cp = T.cam ? T.cam.position : null, rp = T.root.position, FAR2 = 13 * 13;
    const cmax = T.crowdMax || 1e9; T.crowd.forEach((c, ci) => {
      if (ci >= cmax) return; const pose = Math.floor(beat * 2 + c.ph) % T.CV.poses; const it = T.CV.list[c.v * T.CV.poses + pose];
      const b = Math.max(0, Math.sin((beat + c.ph) * Math.PI)); const sway = Math.sin(beat * 0.5 * Math.PI + c.ph) * 0.12;
      Quaternion.FromEulerAnglesToRef(0, c.yaw + sway * 0.5, 0, q4); s4.set(c.s, c.s, c.s); v4.set(c.x, b * 0.06, c.z); Matrix.ComposeToRef(s4, q4, v4, m4);
      const far = it.farReady && cp && ((c.x + rp.x - cp.x) ** 2 + (c.z + rp.z - cp.z) ** 2) > FAR2;
      if (far) { m4.copyToArray(it.far._buf, it.fn * 16); it.fn++; } else { m4.copyToArray(it.body._buf, it.n * 16); it.n++; }
      if (it.head) { m4.copyToArray(it.head._buf, (it.hn2 = (it.hn2 || 0)) * 16); it.hn2++; }
    });
    for (const it of M.CVL) { it.body.thinInstanceCount = it.n; it.body.thinInstanceBufferUpdated('matrix'); if (it.far) { it.far.thinInstanceCount = it.fn; it.far.thinInstanceBufferUpdated('matrix'); } if (it.head) { it.head.thinInstanceCount = it.hn2 || 0; it.head.thinInstanceBufferUpdated('matrix'); it.hn2 = 0; } }
  }
  // lights
  const strobe = (Math.floor(beat) % 16) >= 14 ? (Math.floor(beat * 4) % 2) : 0;
  M.ledWM.emissiveColor.set(0.6 + 0.6 * kick + strobe, 0.6 + 0.6 * kick + strobe, 0.65 + 0.6 * kick + strobe);
  const r = 0.6 + 0.5 * Math.sin(beat * Math.PI * 0.25) ** 2; M.ledRM.emissiveColor.set(r, 0.03, 0.06);
  M.altarGlassM.emissiveColor.set(0.7 + 0.3 * kick, 0.0, 0.0);
  M.washM.emissiveColor.set(0.45 + 0.25 * kick, 0.0, 0.02);
  M.brM.emissiveColor.set(1, 0.08 + 0.1 * kick, 0.12);
  M.beams.forEach(b => {
    if (b.kind === 'mh') { const s = t * 0.9 + b.i * 0.8; b.m.rotation.x = 1.0 + Math.sin(s) * 0.35; b.m.rotation.z = Math.sin(s * 0.7 + b.i) * 0.6; b.m.visibility = 0.65 + 0.35 * kick; }
    else if (b.kind === 'side') { const s = t * 0.6 + b.i; b.m.rotation.z = -b.sd * (0.9 + Math.sin(s) * 0.4); b.m.rotation.x = Math.sin(s * 0.8) * 0.5; b.m.visibility = (Math.floor(beat / 4) % 2 ? 1 : 0.4) * (0.65 + 0.35 * kick); }
    else { b.m.rotation.x = -1.45 + Math.sin(t * 0.3 + b.i) * 0.05; b.m.rotation.z = (b.i - 1.5) * 0.12 + Math.sin(t * 0.5 + b.i) * 0.08; b.m.visibility = (Math.floor(beat) % 8 < 4 ? 0.55 : 0.25) + 0.35 * kick; }
  });
  M.beamM.emissiveColor.set(0.42 + strobe * 0.4, 0.46 + strobe * 0.4, 0.56 + strobe * 0.4); M.blastM.emissiveColor.set(0.12, 0.18, 0.32); if (M.beamRM) M.beamRM.emissiveColor.set(1.0, 0.07, 0.16);
  T.lights.hemi.intensity = 0.5 + strobe * 0.9;
  T.lights.red.intensity = 0.7 + 0.6 * kick; T.lights.blue.intensity = 0.45 + 0.45 * kick;
  M.hazes.forEach((h, k) => { h.position.x = Math.sin(t * 0.07 + k) * 3; h.rotation.y = Math.PI; });
}
