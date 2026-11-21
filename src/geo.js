// Geometry helpers: vertex-data builders, colouring, merging. All procedural, no external assets.
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Matrix, Vector3, Quaternion, Vector4 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTorusVertexData } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { CreatePlaneVertexData } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import earcut from 'earcut';

export const hex = (h) => Color3.FromHexString(h);
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function sphere(seg = 12) { return CreateSphereVertexData({ segments: seg, diameter: 2 }); }
export function box(w = 1, h = 1, d = 1) { return CreateBoxVertexData({ width: w, height: h, depth: d }); }
export function cyl(h, top, bottom, tess = 12, cap = true) { return CreateCylinderVertexData({ height: h, diameterTop: top * 2, diameterBottom: bottom * 2, tessellation: tess, cap: cap ? 3 : 0 }); }
export function torus(d, t, tess = 16) { return CreateTorusVertexData({ diameter: d, thickness: t, tessellation: tess }); }
// double-sided plane that reads correctly from BOTH sides: stock front UVs, mirrored back UVs. The material MUST keep
// backFaceCulling = true: with culling off, the appended back triangles z-win from both sides and show the mirrored image.
export function planeR(w, h) { return CreatePlaneVertexData({ width: w, height: h, sideOrientation: Mesh.DOUBLESIDE, frontUVs: new Vector4(0, 0, 1, 1), backUVs: new Vector4(1, 0, 0, 1) }); }
export function plane(w, h) { return CreatePlaneVertexData({ width: w, height: h, sideOrientation: Mesh.DOUBLESIDE }); }

// Superellipsoid "rounded box": toy-like soft-cornered blocks.
export function rbox(w, h, d, e = 0.28, seg = 10) {
  const vd = sphere(seg); const p = vd.positions;
  for (let i = 0; i < p.length; i += 3) {
    for (let k = 0; k < 3; k++) { const v = p[i + k]; p[i + k] = Math.sign(v) * Math.pow(Math.abs(v), e) * [w, h, d][k] / 2; }
  }
  VertexData.ComputeNormals(p, vd.indices, (vd.normals = []));
  return vd;
}
// scale/rotate/translate a vertex data in place and return it
export function xf(vd, { s = [1, 1, 1], r = [0, 0, 0], t = [0, 0, 0] } = {}) {
  const m = Matrix.Compose(new Vector3(...s), Quaternion.FromEulerAngles(...r), new Vector3(...t));
  vd.transform(m); return vd;
}
export function color(vd, c, a = 1) {
  const n = vd.positions.length / 3; const col = new Array(n * 4);
  const f = typeof c === 'function' ? c : null;
  for (let i = 0; i < n; i++) {
    const cc = f ? f(vd.positions[i * 3], vd.positions[i * 3 + 1], vd.positions[i * 3 + 2], i) : c;
    col[i * 4] = cc.r; col[i * 4 + 1] = cc.g; col[i * 4 + 2] = cc.b; col[i * 4 + 3] = a;
  }
  vd.colors = col; return vd;
}
// Merge many vertex datas (keeps colors, uvs, skin weights if all have them)
export function merge(list) {
  const out = new VertexData(); const pos = [], nor = [], ind = [], col = [], uv = [], mi = [], mw = [];
  let hasUV = list.every(v => v.uvs), hasSkin = list.every(v => v.matricesIndices);
  for (const v of list) {
    const base = pos.length / 3; const n = v.positions.length / 3;
    for (let i = 0; i < v.positions.length; i++) pos.push(v.positions[i]);
    if (!v.normals) { v.normals = []; VertexData.ComputeNormals(v.positions, v.indices, v.normals); }
    for (let i = 0; i < v.normals.length; i++) nor.push(v.normals[i]);
    for (let i = 0; i < v.indices.length; i++) ind.push(v.indices[i] + base);
    if (v.colors) for (let i = 0; i < v.colors.length; i++) col.push(v.colors[i]); else for (let i = 0; i < n; i++) col.push(1, 1, 1, 1);
    if (hasUV) for (let i = 0; i < v.uvs.length; i++) uv.push(v.uvs[i]);
    if (hasSkin) { for (let i = 0; i < v.matricesIndices.length; i++) mi.push(v.matricesIndices[i]); for (let i = 0; i < v.matricesWeights.length; i++) mw.push(v.matricesWeights[i]); }
  }
  out.positions = pos; out.normals = nor; out.indices = ind; out.colors = col;
  if (hasUV) out.uvs = uv; if (hasSkin) { out.matricesIndices = mi; out.matricesWeights = mw; }
  return out;
}
// typed copies on the way to the GPU: Babylon keeps the CPU arrays, and plain JS number arrays cost 2-4x a Float32Array (the caller's vd is left untouched)
const F32 = (a) => (a && Array.isArray(a) ? new Float32Array(a) : a);
export function toMesh(name, vd, scene, mat) { const m = new Mesh(name, scene); const t = new VertexData(); t.positions = F32(vd.positions); t.normals = F32(vd.normals); t.colors = F32(vd.colors); t.uvs = F32(vd.uvs); t.uvs2 = F32(vd.uvs2); t.tangents = F32(vd.tangents);
  t.matricesIndices = F32(vd.matricesIndices); t.matricesWeights = F32(vd.matricesWeights); const I = vd.indices; t.indices = I && Array.isArray(I) ? new Uint32Array(I) : I; // Uint32: these meshes may be merged later
  t.applyToMesh(m, false); if (mat) m.material = mat; return m; }

// Gothic pointed (equilateral-ish) arch outline from left spring to right spring, as 2D points [x,y].
export function pointedArch(cx, springY, span, steps = 10, sharp = 1.0) {
  const half = span / 2, r = Math.max(half, span * sharp); const pts = [];
  const clx = cx - half + r, crx = cx + half - r;
  const aA = Math.acos((half - r) / r), bA = Math.acos((r - half) / r);
  for (let i = 0; i <= steps; i++) { const a = Math.PI + (aA - Math.PI) * (i / steps); pts.push([clx + r * Math.cos(a), springY + r * Math.sin(a)]); }
  for (let i = 1; i <= steps; i++) { const b = bA * (1 - i / steps); pts.push([crx + r * Math.cos(b), springY + r * Math.sin(b)]); }
  return { pts, apexY: springY + r * Math.sin(aA) };
}
// Window/door opening outline: rect from bottomY to springY then pointed arch.
export function lancet(cx, bottomY, springY, span, steps = 8) {
  const a = pointedArch(cx, springY, span, steps);
  return [[cx - span / 2, bottomY], ...a.pts, [cx + span / 2, bottomY]].reverse();
}
// Flat wall in local XY plane (z = 0..thick) with holes, with reveals (thickness faces) around holes.
export function wallWithHoles(outer, holes, thick) {
  const flat = [], holeIdx = [];
  for (const p of outer) flat.push(p[0], p[1]);
  for (const h of holes) { holeIdx.push(flat.length / 2); for (const p of h) flat.push(p[0], p[1]); }
  const tri = earcut(flat, holeIdx, 2);
  const pos = [], ind = [];
  const n = flat.length / 2;
  for (let i = 0; i < n; i++) pos.push(flat[i * 2], flat[i * 2 + 1], 0);
  for (let i = 0; i < n; i++) pos.push(flat[i * 2], flat[i * 2 + 1], thick);
  for (let i = 0; i < tri.length; i += 3) { ind.push(tri[i], tri[i + 2], tri[i + 1]); ind.push(tri[i] + n, tri[i + 1] + n, tri[i + 2] + n); }
  const ring = (pts) => { // side faces
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length]; const base = pos.length / 3;
      pos.push(a[0], a[1], 0, b[0], b[1], 0, b[0], b[1], thick, a[0], a[1], thick);
      ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  };
  ring(outer); holes.forEach(ring);
  const vd = new VertexData(); vd.positions = pos; vd.indices = ind; vd.normals = []; VertexData.ComputeNormals(pos, ind, vd.normals);
  return vd;
}
// Tube along a 2D path in XY plane (square-ish cross-section), for arch mouldings.
export function archRib(pts, w, d) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; const L = Math.hypot(x1 - x0, y1 - y0);
    out.push(xf(box(L + 0.05, w, d), { r: [0, 0, Math.atan2(y1 - y0, x1 - x0)], t: [(x0 + x1) / 2, (y0 + y1) / 2, 0] }));
  }
  return merge(out);
}
export { earcut };
