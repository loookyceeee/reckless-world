// City chunk streaming (OUTSTANDING C): extra OSM footprints with 2006 LiDAR heights (public/data/stream, tools/gen_stream.py),
// loaded around the player in 500 m chunks and dropped again when far. Same wall/roof look as the base city.
// One chunk is fetched + built at a time so a frame never takes the whole hit. Collision segments are added once per chunk.
import { buildChunkBuildings } from './city.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
// flat asphalt ribbons for streets the base city lacks (no kerbs or markings): [w, x0,z0, x1,z1, ...]
function roadRibbons(scene, runs, mat, name) {
  const P = [], N = [], I = [];
  for (const r of runs) { const w = r[0] / 2, n = (r.length - 1) / 2; if (n < 2) continue; const base = P.length / 3;
    for (let i = 0; i < n; i++) { const x = r[1 + i * 2], z = r[2 + i * 2]; const a = i > 0 ? i - 1 : i, b = i < n - 1 ? i + 1 : i;
      let dx = r[1 + b * 2] - r[1 + a * 2], dz = r[2 + b * 2] - r[2 + a * 2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      P.push(x - dz * w, 0.012, z + dx * w, x + dz * w, 0.012, z - dx * w); N.push(0, 1, 0, 0, 1, 0);
      if (i) { const k = base + i * 2; I.push(k - 2, k - 1, k, k - 1, k + 1, k); } } }
  if (!I.length) return null; const vd = new VertexData(); vd.positions = new Float32Array(P); vd.normals = new Float32Array(N); vd.indices = P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I);
  const m = new Mesh(name + 'roads', scene); vd.applyToMesh(m); m.material = mat; m.isPickable = false; return m;
}
let RM = null;
export async function createStream(scene, city, { base = '/', radius = 650, drop = 950, lite = false } = {}) {
  const idx = await (await fetch(base + 'data/stream/index.json')).json(); const SZ = idx.size;
  const C = idx.chunks.map(([ix, iz, n]) => ({ ix, iz, n, st: 0, m: null, data: null, col: false }));
  let busy = false, acc = 0; const api = { chunks: C, radius, drop, loaded: () => C.filter(c => c.st === 2).length, buildings: () => C.reduce((a, c) => a + (c.st === 2 ? c.n : 0), 0) };
  const dist = (c, x, z) => { const dx = Math.max(c.ix * SZ - x, 0, x - (c.ix + 1) * SZ), dz = Math.max(c.iz * SZ - z, 0, z - (c.iz + 1) * SZ); return Math.hypot(dx, dz); };
  async function load(c) {
    busy = true; c.st = 1;
    try { if (!c.data) c.data = await (await fetch(base + `data/stream/c_${c.ix}_${c.iz}.json`)).json();
      await new Promise(r => requestAnimationFrame(r));
      const m = !c.data.b.length ? null : buildChunkBuildings(scene, city, c.data.b, `stream-${c.ix}_${c.iz}-`, !c.col); c.col = true;
      if (!RM) { RM = new StandardMaterial('streamRoad', scene); RM.diffuseColor = new Color3(0.11, 0.115, 0.125); RM.specularColor = new Color3(0.18, 0.18, 0.2); RM.specularPower = 48; RM.backFaceCulling = false; }
      const rd = c.data.r ? roadRibbons(scene, c.data.r, RM, `stream-${c.ix}_${c.iz}-`) : null;
      if (rd) { rd.parent = city.root; rd.freezeWorldMatrix(); }
      if (m || rd) c.m = { walls: m && m.walls, roofs: m && m.roofs, roads: rd };
      if (m) { for (const x of [m.walls, m.roofs]) { x.parent = city.root; x.freezeWorldMatrix(); x.doNotSyncBoundingInfo = true; } }
      c.st = 2;
    } catch (e) { console.warn('stream', c.ix, c.iz, e); c.st = 3; }
    busy = false;
  }
  api.update = (dt, x, z) => {
    acc += dt; if (acc < 0.4) return; acc = 0;
    for (const c of C) if (c.st === 2 && dist(c, x, z) > api.drop) { if (c.m) for (const k of ['walls', 'roofs', 'roads']) if (c.m[k]) c.m[k].dispose(); c.m = null; c.st = 0; if (lite) c.data = null; } // LITE: also drop the parsed JSON (refetched from the HTTP cache if needed)
    if (busy) return;
    let best = null, bd = 1e9; for (const c of C) { if (c.st !== 0) continue; const d = dist(c, x, z); if (d < api.radius && d < bd) { bd = d; best = c; } }
    if (best) load(best);
  };
  return api;
}
