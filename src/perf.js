// Performance helpers: spatial chunking of merged + thin-instanced static meshes, distance culling,
// world-matrix / material freezing, and an auto quality tier driven by measured FPS.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';

const key = (x, z, c) => Math.floor(x / c) + ',' + Math.floor(z / c);

// split a merged static mesh into grid cells by triangle centroid (world == local; parent is identity)
export function splitMesh(mesh, cell) {
  const P = mesh.getVerticesData('position'), N = mesh.getVerticesData('normal'), U = mesh.getVerticesData('uv'), C = mesh.getVerticesData('color'), I = mesh.getIndices();
  if (!P || !I || I.length < 3000) return [mesh];
  const groups = new Map();
  for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3; const k = key((P[a] + P[b] + P[c]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3, cell); let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(I[t], I[t + 1], I[t + 2]); }
  if (groups.size < 2) return [mesh];
  const out = [];
  for (const [k, idx] of groups) {
    const map = new Map(), p = [], n = [], u = [], c = [], ni = [];
    for (const v of idx) { let m = map.get(v); if (m == null) { m = map.size; map.set(v, m); p.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); if (N) n.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); if (U) u.push(U[v * 2], U[v * 2 + 1]); if (C) c.push(C[v * 4], C[v * 4 + 1], C[v * 4 + 2], C[v * 4 + 3]); } ni.push(m); }
    const vd = new VertexData(); vd.positions = p; vd.indices = ni; if (N) vd.normals = n; if (U) vd.uvs = u; if (C) vd.colors = c;
    const m = new Mesh(mesh.name + '@' + k, mesh.getScene()); vd.applyToMesh(m, false); m.material = mesh.material; m.parent = mesh.parent; m.isPickable = mesh.isPickable; m.receiveShadows = mesh.receiveShadows; m.renderingGroupId = mesh.renderingGroupId; m.visibility = mesh.visibility; m.hasVertexAlpha = mesh.hasVertexAlpha; m.alphaIndex = mesh.alphaIndex;
    m.metadata = { chunkOf: mesh.name }; out.push(m);
  }
  mesh.dispose(false, false); return out;
}

// split a thin-instanced mesh into per-cell copies so frustum + distance culling can drop whole cells
export function splitThin(mesh, cell) {
  const n = mesh.thinInstanceCount; const buf = mesh._thinInstanceDataStorage && mesh._thinInstanceDataStorage.matrixData;
  if (!buf || n < 40) return [mesh];
  const groups = new Map();
  for (let i = 0; i < n; i++) { const k = key(buf[i * 16 + 12], buf[i * 16 + 14], cell); let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(i); }
  if (groups.size < 2) return [mesh];
  const out = [];
  for (const [k, ids] of groups) {
    const m = new Mesh(mesh.name + '@' + k, mesh.getScene()); mesh.geometry.applyToMesh(m); m.material = mesh.material; m.parent = mesh.parent; m.isPickable = false; m.receiveShadows = mesh.receiveShadows;
    const b = new Float32Array(ids.length * 16); ids.forEach((id, j) => b.set(buf.subarray(id * 16, id * 16 + 16), j * 16));
    m.thinInstanceSetBuffer('matrix', b, 16, true); m.thinInstanceRefreshBoundingInfo(false); m.metadata = { chunkOf: mesh.name }; out.push(m);
  }
  mesh.dispose(false, false); return out;
}

// chunk everything static under root; returns a culler
export function chunkStatic(root, { cell = 96, skip = [] } = {}) {
  const list = root.getChildMeshes(false).filter(m => m instanceof Mesh && !skip.some(s => (typeof s === 'string' ? m.name === s : s.test(m.name))) && !m.skeleton && m.getTotalIndices() > 0);
  const chunks = [], parts0 = [];
  for (const m of list) parts0.push(...(m.thinInstanceCount > 0 ? splitThin(m, cell * 2) : splitMesh(m, cell))); // light street furniture in 2x cells, heavy merged geometry in 1x
  const parts1 = bakeByMaterial(parts0);
  {
    for (const p of parts1) {
      p.refreshBoundingInfo && p.thinInstanceCount === 0 && p.refreshBoundingInfo();
      const bi = p.getBoundingInfo(); const c = bi.boundingBox.centerWorld.clone(); const r = bi.boundingSphere.radiusWorld;
      p.freezeWorldMatrix(); p.doNotSyncBoundingInfo = true; chunks.push({ m: p, c, r });
    }
  }
  let dist = 360; const cam = new Vector3();
  return {
    chunks, setDist: (d) => { dist = d; },
    update: (camPos) => { cam.copyFrom(camPos); for (const k of chunks) { const dx = k.c.x - cam.x, dz = k.c.z - cam.z; const on = Math.sqrt(dx * dx + dz * dz) - k.r < dist; if (k.on !== on) { k.on = on; k.m.setEnabled(on); } } },
  };
}

export function freezeMaterials(scene, names) { for (const mt of scene.materials) if (names.includes(mt.name)) { try { mt.freeze(); } catch (e) { } } }

// quality tiers
export const TIERS = {
  low: { scale: 2.0, dist: 200, mid: 0, bloom: false, glow: false, grain: false, ssao: false, crowd: 70 },
  med: { scale: 1.5, dist: 300, mid: 220, bloom: true, glow: true, grain: false, ssao: false, crowd: 110 },
  high: { scale: 1.0, dist: 440, mid: 360, bloom: true, glow: true, grain: true, ssao: false, crowd: 999 },
};

// bake every chunk that shares a cell + material + vertex layout into ONE mesh (thin instances expanded) -> far fewer draw calls
function bakeByMaterial(parts) {
  const groups = new Map(), out = [];
  for (const p of parts) {
    const cellKey = p.name.includes('@') ? p.name.split('@')[1] : null;
    const attrs = ['normal', 'uv', 'color'].filter(a => p.isVerticesDataPresent(a)).join('|');
    if (!cellKey || !p.material || !p.isVerticesDataPresent('normal')) { out.push(p); continue; }
    const k = cellKey + '#' + p.material.uniqueId + '#' + attrs; let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(p);
  }
  const tmp = new Vector3(), M = new Matrix();
  for (const [k, g] of groups) {
    if (g.length < 2) { out.push(...g); continue; }
    const hasU = g[0].isVerticesDataPresent('uv'), hasC = g[0].isVerticesDataPresent('color');
    let nv = 0, ni = 0; for (const p of g) { const c = Math.max(1, p.thinInstanceCount); nv += p.getTotalVertices() * c; ni += p.getTotalIndices() * c; }
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), U = hasU ? new Float32Array(nv * 2) : null, C = hasC ? new Float32Array(nv * 4) : null, I = new Uint32Array(ni);
    let vo = 0, io = 0;
    for (const p of g) {
      const pp = p.getVerticesData('position'), pn = p.getVerticesData('normal'), pu = hasU ? p.getVerticesData('uv') : null, pc = hasC ? p.getVerticesData('color') : null, pi = p.getIndices(), v = pp.length / 3;
      const buf = p.thinInstanceCount > 0 ? p._thinInstanceDataStorage.matrixData : null, cnt = buf ? p.thinInstanceCount : 1;
      for (let i = 0; i < cnt; i++) {
        if (buf) Matrix.FromArrayToRef(buf, i * 16, M);
        for (let j = 0; j < v; j++) {
          if (buf) { Vector3.TransformCoordinatesFromFloatsToRef(pp[j * 3], pp[j * 3 + 1], pp[j * 3 + 2], M, tmp); P[(vo + j) * 3] = tmp.x; P[(vo + j) * 3 + 1] = tmp.y; P[(vo + j) * 3 + 2] = tmp.z;
            Vector3.TransformNormalFromFloatsToRef(pn[j * 3], pn[j * 3 + 1], pn[j * 3 + 2], M, tmp); tmp.normalize(); N[(vo + j) * 3] = tmp.x; N[(vo + j) * 3 + 1] = tmp.y; N[(vo + j) * 3 + 2] = tmp.z; }
          else { P[(vo + j) * 3] = pp[j * 3]; P[(vo + j) * 3 + 1] = pp[j * 3 + 1]; P[(vo + j) * 3 + 2] = pp[j * 3 + 2]; N[(vo + j) * 3] = pn[j * 3]; N[(vo + j) * 3 + 1] = pn[j * 3 + 1]; N[(vo + j) * 3 + 2] = pn[j * 3 + 2]; }
          if (U) { U[(vo + j) * 2] = pu[j * 2]; U[(vo + j) * 2 + 1] = pu[j * 2 + 1]; }
          if (C) for (let q = 0; q < 4; q++) C[(vo + j) * 4 + q] = pc[j * 4 + q];
        }
        for (let j = 0; j < pi.length; j++) I[io + j] = pi[j] + vo; io += pi.length; vo += v;
      }
    }
    const vd = new VertexData(); vd.positions = P; vd.normals = N; vd.indices = I; if (U) vd.uvs = U; if (C) vd.colors = C;
    const m = new Mesh('bake@' + k, g[0].getScene()); vd.applyToMesh(m, false); m.material = g[0].material; m.parent = g[0].parent; m.isPickable = false;
    m.metadata = { chunkOf: g.map(p => p.metadata && p.metadata.chunkOf).join(',') }; m.hasVertexAlpha = g.some(p => p.hasVertexAlpha);
    g.forEach(p => p.dispose(false, false)); out.push(m);
  }
  return out;
}
