// Hero landmarks in the slice, hand-modelled in the clay style on their real OSM footprints:
// St Anne's Cathedral (Romanesque, sandstone) + the 40 m stainless Spire of Hope (lit at night), and the leaning Albert Memorial Clock.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { box, cyl, sphere, xf, color, merge, toMesh, hex } from './geo.js';
import { obb } from './city.js';
import { ll2xz } from './venues.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';

export const LANDMARK_IDS = new Set([267251302, 298832670, 539787113]);
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
    } else if (b.id === 298832670) {
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
    } else if (b.id === 539787113) {
      // Belfast City Hall (1906, Portland stone, Baroque Revival): the OSM quadrangle is extruded by the city builder;
      // here: the copper-green central dome over the north front, 4 corner towers with cupolas and the north portico.
      if (Math.cos(ang) < 0) ang += Math.PI; node.rotation.y = -ang; // local +Z = north (Donegall Place)
      const ST = hex('#e6e0d2'), ST_D = hex('#c9c2b2'), CU = hex('#6f9f8a'), CU_D = hex('#557f6e');
      const P = [], hz = W / 2, hx = L / 2, eave = b.h;
      const dz = hz - 13; // dome sits on the front range
      P.push(color(xf(cyl(10, 17, 17, 28), { t: [0, eave + 5, dz] }), ST)); // drum
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; P.push(color(xf(cyl(8.5, 0.9, 0.9, 8), { t: [Math.sin(a) * 9.4, eave + 5, dz + Math.cos(a) * 9.4] }), ST_D)); }
      P.push(color(xf(cyl(1.2, 20.4, 20.4, 28), { t: [0, eave + 10.4, dz] }), ST_D)); // cornice ring
      P.push(color(xf(sphere(20), { s: [8.8, 11, 8.8], t: [0, eave + 11, dz] }), CU)); // dome
      P.push(color(xf(cyl(4.5, 3.4, 3.4, 12), { t: [0, eave + 23.5, dz] }), ST)); // lantern
      P.push(color(xf(sphere(10), { s: [1.9, 2.4, 1.9], t: [0, eave + 25.8, dz] }), CU));
      P.push(color(xf(cyl(9, 0.08, 0.35, 6), { t: [0, eave + 31, dz] }), CU_D)); // finial (~53 m)
      for (const a of [-1, 1]) for (const c of [-1, 1]) { const x = a * (hx - 5.5), z = c * (hz - 5.5);
        P.push(color(xf(box(9.5, eave + 7, 9.5), { t: [x, (eave + 7) / 2, z] }), ST));
        P.push(color(xf(box(10.4, 0.8, 10.4), { t: [x, eave + 7.4, z] }), ST_D));
        P.push(color(xf(cyl(3, 6.2, 7, 12), { t: [x, eave + 9.3, z] }), ST));
        P.push(color(xf(sphere(12), { s: [3.3, 4, 3.3], t: [x, eave + 10.8, z] }), CU));
        P.push(color(xf(cyl(3.5, 0.06, 0.25, 6), { t: [x, eave + 16, z] }), CU_D)); }
      // north portico: steps, 6 columns, entablature and pediment
      const pz = hz + 2.2; P.push(color(xf(box(22, 1.4, 6), { t: [0, 0.7, pz] }), ST_D));
      for (let k = 0; k < 6; k++) P.push(color(xf(cyl(11, 0.75, 0.85, 12), { t: [-8 + k * 3.2, 1.4 + 5.5, pz + 1.6] }), ST));
      P.push(color(xf(box(21, 2.2, 5.4), { t: [0, 13.5, pz] }), ST));
      P.push(color(xf(prism(5.4, 21, 0, 4), { r: [0, Math.PI / 2, 0], t: [0, 14.6, pz] }), ST_D));
      P.push(color(xf(box(L * 0.98, 1.0, 1.2), { t: [0, eave + 0.5, hz - 0.3] }), ST_D)); // front balustrade line
      const body = toMesh('cityHall', merge(P), scene, clay); body.parent = node;
    }
  }
  // The Big Fish (John Kindness, 1999): 10 m ceramic-mosaic salmon on Donegall Quay, blue/white tiles
  { const q = ll2xz(54.601476, -5.921671); const node = new TransformNode('bigFish', scene); node.parent = root; node.position.set(q.x, 0, q.z); node.rotation.y = 0.15;
    const t = new DynamicTexture('fishTiles', { width: 512, height: 256 }, scene, true); const g = t.getContext(); const R = (n) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
    for (let y = 0; y < 256; y += 8) for (let x = 0; x < 512; x += 8) { const n = R(x * 0.37 + y * 1.71); const band = y / 256;
      g.fillStyle = n < 0.12 ? '#f2f2ee' : band > 0.62 ? (n < 0.5 ? '#e8e8e2' : '#cfd8dc') : (n < 0.45 ? '#2f5f9e' : n < 0.75 ? '#3f7fbf' : '#1d3f73'); g.fillRect(x, y, 7, 7); }
    g.fillStyle = '#a8b0b4'; for (let y = 0; y < 256; y += 8) g.fillRect(0, y + 7, 512, 1); for (let x = 0; x < 512; x += 8) g.fillRect(x + 7, 0, 1, 256); t.update();
    const fm = new StandardMaterial('fishM', scene); fm.diffuseTexture = t; fm.specularColor = new Color3(0.5, 0.5, 0.55); fm.specularPower = 60; fm.emissiveColor = new Color3(0.05, 0.06, 0.08);
    const fish = toMesh('bigFishBody', xf(sphere(24), { s: [1.35, 1.3, 4.6], t: [0, 2.35, 0.2] }), scene, fm); fish.parent = node;
    const tail = toMesh('bigFishTail', merge([xf(box(0.22, 1.9, 1.1), { r: [0.55, 0, 0], t: [0, 3.0, -5.3] }), xf(box(0.22, 1.9, 1.1), { r: [-0.55, 0, 0], t: [0, 1.6, -5.3] })]), scene, fm); tail.parent = node;
    const plinth = toMesh('bigFishPlinth', color(xf(box(2.2, 1.0, 7.5), { t: [0, 0.5, 0] }), hex('#5a5c60')), scene, clay); plinth.parent = node;
    if (grid) grid.add(q.x - 1, q.z - 5, q.x + 1, q.z + 5, 3); }
  return out;
}
export function updateLandmarks(LM, t) { if (LM && LM.spireTip) { const k = 0.75 + 0.25 * Math.sin(t * 0.8); LM.spireTip.emissiveColor.set(0.85 * k, 0.9 * k, k); } }
