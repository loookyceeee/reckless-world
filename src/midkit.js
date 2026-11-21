// Mid-distance street fill (desktop): CC0 Kenney City Kit Commercial / Suburban blocks on OSM streets that have no mapped buildings.
// tools/blender/export_midkit.py -> data/midkit.json (vertex-colour models), tools/gen_midkit_place.py -> data/midkit_place.json (placements).
// One thin-instanced body mesh + one unlit glazing mesh per model; per-building tint (brick / sandstone / render) and lit or dark windows.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import '@babylonjs/core/Meshes/thinInstanceMesh';

const TINT = [[0.62, 0.38, 0.3], [0.5, 0.32, 0.27], [0.78, 0.68, 0.52], [0.8, 0.77, 0.7], [0.58, 0.58, 0.6], [0.55, 0.6, 0.63]]; // red brick, dark brick, sandstone, cream render, grey, painted
const b64 = (s) => Uint8Array.from(atob(s), ch => ch.charCodeAt(0)).buffer;
function vd(m, which) {
  const pos = new Int16Array(b64(m.pos)), ci = new Uint8Array(b64(m.col)), ind = new Uint16Array(b64(m[which]));
  if (!ind.length) return null;
  const n = pos.length / 3, P = new Float32Array(n * 3), C = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { P[i * 3] = pos[i * 3] * m.scale; P[i * 3 + 1] = pos[i * 3 + 1] * m.scale; P[i * 3 + 2] = pos[i * 3 + 2] * m.scale; const c = m.pal[ci[i]]; C[i * 4] = c[0]; C[i * 4 + 1] = c[1]; C[i * 4 + 2] = c[2]; C[i * 4 + 3] = 1; }
  const v = new VertexData(); v.positions = P; v.colors = C; v.indices = Array.from(ind); v.normals = []; VertexData.ComputeNormals(v.positions, v.indices, v.normals); return v; // verts are unshared per face: flat normals
}
export async function buildMidkit(scene, parent, { base = '' } = {}) {
  const [kit, place] = await Promise.all([fetch(base + 'data/midkit.json').then(r => r.json()), fetch(base + 'data/midkit_place.json').then(r => r.json())]);
  const bodyM = new StandardMaterial('midkitM', scene); bodyM.specularColor = new Color3(0.05, 0.05, 0.06); bodyM.emissiveColor = new Color3(0.03, 0.03, 0.045);
  const glassM = new StandardMaterial('midkitGlass', scene); glassM.disableLighting = true; glassM.diffuseColor = new Color3(1, 1, 1); glassM.specularColor = Color3.Black();
  const by = new Map(); for (const p of place) { if (!kit[p[0]]) continue; if (!by.has(p[0])) by.set(p[0], []); by.get(p[0]).push(p); }
  let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const q = new Quaternion(), s = new Vector3(1, 1, 1), t = new Vector3(), M = new Matrix(); let n = 0; const sets = [];
  for (const [k, list] of by) {
    const m = kit[k]; const mats = new Float32Array(list.length * 16), tint = new Float32Array(list.length * 4), lit = new Float32Array(list.length * 4);
    list.forEach((p, i) => { Quaternion.RotationYawPitchRollToRef(p[3], 0, 0, q); t.set(p[1], 0, p[2]); Matrix.ComposeToRef(s, q, t, M); M.copyToArray(mats, i * 16);
      const c = TINT[p[4] % TINT.length]; tint.set([c[0], c[1], c[2], 1], i * 4);
      const on = R() < 0.55; lit.set(on ? [1.05, 0.78, 0.45, 1] : [0.12, 0.14, 0.2, 1], i * 4); });
    for (const [which, mat, cols] of [['ind', bodyM, tint], ['gls', glassM, lit]]) {
      const v = vd(m, which); if (!v) continue;
      const me = new Mesh('midkit-' + k + (which === 'gls' ? '-g' : ''), scene); v.applyToMesh(me, false); me.material = mat; me.parent = parent; me.isPickable = false; me.receiveShadows = false;
      me.thinInstanceSetBuffer('matrix', new Float32Array(mats), 16, false); me.thinInstanceSetBuffer('color', new Float32Array(cols), 4, false); me.alwaysSelectAsActiveMesh = true; n += list.length;
      sets.push({ me, list, mats, cols, bm: new Float32Array(mats.length), bc: new Float32Array(cols.length) });
    }
  }
  // distance cull: every update keep only the instances within `dist` of the camera (rewrites the small instance buffers in place)
  const update = (cam, dist = 420) => { const d2 = dist * dist;
    for (const S of sets) { let c = 0;
      for (let i = 0; i < S.list.length; i++) { const p = S.list[i], dx = p[1] - cam.x, dz = p[2] - cam.z; if (dx * dx + dz * dz > d2) continue;
        S.bm.set(S.mats.subarray(i * 16, i * 16 + 16), c * 16); S.bc.set(S.cols.subarray(i * 4, i * 4 + 4), c * 4); c++; }
      if (c === S.c) continue; S.c = c; S.me.setEnabled(c > 0); if (c) { S.me.thinInstanceSetBuffer('matrix', S.bm, 16, false); S.me.thinInstanceSetBuffer('color', S.bc, 4, false); S.me.thinInstanceCount = c; } } };
  return { n, update, sets };
}
