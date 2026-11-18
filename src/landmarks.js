// Hero landmarks in the slice, hand-modelled in the clay style on their real OSM footprints:
// St Anne's Cathedral (Romanesque, sandstone) + the 40 m stainless Spire of Hope (lit at night), and the leaning Albert Memorial Clock.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { box, cyl, sphere, xf, color, merge, toMesh, hex } from './geo.js';
import { obb } from './city.js';

export const LANDMARK_IDS = new Set([267251302, 298832670]);
function prism(L, W, h0, h1) { // gabled roof prism along X, eaves at h0, ridge at h1
  const x = L / 2, z = W / 2; const p = [-x, h0, -z, x, h0, -z, x, h1, 0, -x, h1, 0, -x, h0, z, x, h0, z];
  const idx = [0, 2, 1, 0, 3, 2, 4, 5, 2, 4, 2, 3, 0, 4, 3, 1, 2, 5];
  const vd = new VertexData(); vd.positions = p; vd.indices = idx; vd.normals = []; VertexData.ComputeNormals(p, idx, vd.normals); return vd;
}
function pyramid(w, h0, h1, n = 4) { const vd = cyl(h1 - h0, 0.02, w / Math.SQRT2 * 1.0, n, true); return xf(vd, { r: [0, Math.PI / 4, 0], t: [0, (h0 + h1) / 2, 0] }); }
function mat(scene, name, o = {}) { const m = new StandardMaterial(name, scene); m.diffuseColor = new Color3(1, 1, 1); m.specularColor = new Color3(0.08, 0.08, 0.08); if (o.em) { m.emissiveColor = hex(o.em); m.disableLighting = !!o.unlit; } return m; }

export function buildLandmarks(scene, city, grid) {
  const root = new TransformNode('landmarks', scene); const out = { root, glow: [], spireTip: null };
  const clay = mat(scene, 'lmClay'); const lit = mat(scene, 'lmLit', { em: '#c99a62', unlit: true }); const steel = mat(scene, 'lmSteel'); steel.specularColor = new Color3(0.9, 0.9, 1); steel.specularPower = 90; steel.emissiveColor = hex('#5a6a8a');
  const tipM = mat(scene, 'lmTip', { em: '#eaf2ff', unlit: true });
  for (const b of city.data.buildings) {
    if (!LANDMARK_IDS.has(b.id)) continue;
    const pts = []; for (let i = 0; i < b.p.length; i += 2) pts.push([b.p[i], b.p[i + 1]]);
    for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; grid.add(a[0], a[1], c[0], c[1], b.h); }
    const o = obb(pts); const L = o.u1 - o.u0, W = o.v1 - o.v0, um = (o.u0 + o.u1) / 2, vm = (o.v0 + o.v1) / 2;
    const node = new TransformNode('lm-' + b.id, scene); node.parent = root;
    node.position.set(um * o.ux - vm * o.uz, 0, um * o.uz + vm * o.ux);
    let ang = Math.atan2(o.uz, o.ux); // local +X = long axis
    if (b.id === 267251302) {
      // west front faces Donegall Street (smaller world x): make local +X point west
      if (Math.cos(ang) > 0) ang += Math.PI;
      node.rotation.y = -ang;
      const SAND = hex('#cdb28a'), SAND_D = hex('#a98d68'), SLATE = hex('#4b4f58'), DARK = hex('#2a2220');
      const P = [];
      P.push(color(xf(box(L * 0.94, 20, W * 0.5), { t: [0, 10, 0] }), SAND));
      P.push(color(prism(L * 0.94, W * 0.54, 20, 28), SLATE));
      for (const sd of [-1, 1]) { P.push(color(xf(box(L * 0.86, 11, W * 0.24), { t: [-L * 0.02, 5.5, sd * W * 0.37] }), SAND_D));
        P.push(color(xf(box(L * 0.86, 0.5, W * 0.28), { r: [sd * 0.25, 0, 0], t: [-L * 0.02, 12, sd * W * 0.36] }), SLATE));
        for (let k = 0; k < 7; k++) { const x = -L * 0.38 + k * L * 0.11; P.push(color(xf(box(1.6, 5.5, 0.4), { t: [x, 15, sd * W * 0.251] }), DARK)); P.push(color(xf(cyl(0.4, 0.8, 0.8, 10), { r: [Math.PI / 2, 0, 0], t: [x, 17.7, sd * W * 0.251] }), DARK)); } }
      const fx = L * 0.47; // west front block with gable, 3 round-arched portals and a wheel window
      P.push(color(xf(box(3.2, 24, W * 0.66), { t: [fx, 12, 0] }), SAND));
      const g = prism(W * 0.66, 3.2, 24, 31); P.push(color(xf(g, { r: [0, Math.PI / 2, 0], t: [fx, 0, 0] }), SAND));
      for (const sd of [-1, 1]) P.push(color(xf(box(3.6, 27, 2.2), { t: [fx + 0.2, 13.5, sd * W * 0.34] }), SAND_D));
      out.portals = [];
      for (const [z, w, h] of [[0, 4.2, 8], [-W * 0.19, 3, 6], [W * 0.19, 3, 6]]) { P.push(color(xf(box(3.4, h + 1.4, w + 1.4), { t: [fx + 0.15, (h + 1.4) / 2, z] }), SAND_D)); P.push(color(xf(cyl(3.42, w / 2 + 0.7, w / 2 + 0.7, 16), { r: [0, 0, Math.PI / 2], t: [fx + 0.15, h + 1.4, z] }), SAND_D)); }
      const body = toMesh('stannes', merge(P), scene, clay); body.parent = node;
      const G = [];
      for (const [z, w, h] of [[0, 4.2, 8], [-W * 0.19, 3, 6], [W * 0.19, 3, 6]]) { G.push(xf(box(0.2, h, w), { t: [fx + 1.75, h / 2, z] })); G.push(xf(cyl(0.2, w / 2, w / 2, 16), { r: [0, 0, Math.PI / 2], t: [fx + 1.75, h, z] })); }
      G.push(xf(cyl(0.2, 2.6, 2.6, 20), { r: [0, 0, Math.PI / 2], t: [fx + 1.75, 17, 0] }));
      const glowM = toMesh('stannesGlow', merge(G), scene, lit); glowM.parent = node; out.glow.push(glowM);
      // Spire of Hope: 40 m stainless needle rising through the roof near the crossing, tip lit at night
      const sx = -L * 0.12;
      const sp = toMesh('spireOfHope', merge([xf(cyl(42, 0.06, 0.9, 12, true), { t: [sx, 26 + 21, 0] }), xf(cyl(2.5, 1.3, 1.6, 12), { t: [sx, 27, 0] })]), scene, steel); sp.parent = node;
      const tip = toMesh('spireTip', xf(cyl(9, 0.04, 0.25, 8, true), { t: [sx, 26 + 37.5, 0] }), scene, tipM); tip.parent = node; out.spireTip = tipM; out.glow.push(tip);
    } else {
      // Albert Memorial Clock: sandstone Gothic clock tower that famously leans
      node.rotation.y = -ang; const w = Math.max(4.5, Math.min(L, W, 7));
      const SAND = hex('#c9a67c'), SAND_D = hex('#9d7d58'), SLATE = hex('#3f434c');
      const P = [color(xf(box(w * 1.3, 4, w * 1.3), { t: [0, 2, 0] }), SAND_D), color(xf(box(w, 22, w), { t: [0, 13, 0] }), SAND)];
      for (const a of [-1, 1]) for (const c of [-1, 1]) P.push(color(xf(box(0.9, 24, 0.9), { t: [a * w * 0.52, 12, c * w * 0.52] }), SAND_D), color(xf(pyramid(1.2, 24, 26.5), { t: [a * w * 0.52, 0, c * w * 0.52] }), SAND_D));
      P.push(color(xf(box(w * 0.82, 7, w * 0.82), { t: [0, 27.5, 0] }), SAND));
      P.push(color(pyramid(w * 0.95, 31, 38), SLATE));
      const body = toMesh('albertClock', merge(P), scene, clay); body.parent = node;
      const F = []; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; F.push(xf(cyl(0.12, w * 0.3, w * 0.3, 20), { r: [Math.PI / 2, a, 0], t: [Math.sin(a) * w * 0.42, 27.5, Math.cos(a) * w * 0.42] })); }
      const faces = toMesh('albertClockFaces', merge(F), scene, lit); faces.parent = node; out.glow.push(faces);
      node.rotation.z = 0.035; // ~1.2 m lean at the top
    }
  }
  return out;
}
export function updateLandmarks(LM, t) { if (LM && LM.spireTip) { const k = 0.75 + 0.25 * Math.sin(t * 0.8); LM.spireTip.emissiveColor.set(0.85 * k, 0.9 * k, k); } }
