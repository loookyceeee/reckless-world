// Stylised Belfast slice from OpenStreetMap (ODbL). Buildings extruded + clay-shaded, roads, lamps, venue beacons.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { earcut, hex, rng, box, rbox, cyl, sphere, xf, color, merge, toMesh, plane } from './geo.js';
import { SegGrid } from './collide.js';
import { VENUES } from './venues.js';

export const TEMPLE_OSM_ID = 398481228;
const PALETTE = ['#c9a27e', '#a5553f', '#8f4a3b', '#d8cfc0', '#9aa3ad', '#6d7b8c', '#b8b0a3', '#e3d5b8', '#7e5b4a', '#c4b49a', '#5f6b78', '#d9c2a3'].map(hex);

function windowTextures(scene) {
  const N = 512, C = 8, cs = N / C; const R = rng(7);
  const d = new DynamicTexture('win-d', N, scene, true), e = new DynamicTexture('win-e', N, scene, true);
  const cd = d.getContext(), ce = e.getContext();
  cd.fillStyle = '#e8e4e0'; cd.fillRect(0, 0, N, N); ce.fillStyle = '#000'; ce.fillRect(0, 0, N, N);
  for (let i = 0; i < C; i++) for (let j = 0; j < C; j++) {
    const x = i * cs, y = j * cs;
    if (j === C - 1) { // ground floor: shopfront bay with fascia sign + lit glass (procedural facade)
      const SIG = ['#e8433a', '#ffffff', '#2fb36b', '#f2b134', '#3a7bd5', '#d6336c', '#111111', '#ff7a1a'];
      const sc = SIG[Math.floor(R() * SIG.length)]; const shop = R() < 0.7;
      cd.fillStyle = '#3b3a3f'; cd.fillRect(x, y, cs, cs);
      if (shop) {
        cd.fillStyle = sc; cd.fillRect(x + 2, y + 4, cs - 4, cs * 0.18); ce.fillStyle = sc; ce.globalAlpha = 0.75; ce.fillRect(x + 2, y + 4, cs - 4, cs * 0.18); ce.globalAlpha = 1;
        cd.fillStyle = sc === '#ffffff' ? '#222' : '#fff'; for (let k = 0; k < 4; k++) cd.fillRect(x + 10 + k * 11, y + 9, 7, cs * 0.18 - 10);
        const g = ce.createLinearGradient(0, y + cs * 0.3, 0, y + cs); g.addColorStop(0, '#ffd9a0'); g.addColorStop(1, '#a0602a');
        ce.fillStyle = g; ce.globalAlpha = 0.35 + 0.4 * R(); ce.fillRect(x + 5, y + cs * 0.3, cs - 10, cs * 0.66); ce.globalAlpha = 1;
        cd.fillStyle = '#d9cbb0'; cd.fillRect(x + 5, y + cs * 0.3, cs - 10, cs * 0.66);
        cd.fillStyle = '#2a2a2e'; cd.fillRect(x + cs / 2 - 2, y + cs * 0.3, 4, cs * 0.66);
      } else { cd.fillStyle = '#5a5e6a'; cd.fillRect(x + cs * 0.3, y + cs * 0.25, cs * 0.4, cs * 0.75); cd.fillStyle = '#20232c'; cd.fillRect(x + cs * 0.34, y + cs * 0.3, cs * 0.32, cs * 0.7); }
      continue;
    }
    cd.fillStyle = 'rgba(0,0,0,0.06)'; cd.fillRect(x, y + cs - 6, cs, 6); // floor band
    cd.fillStyle = 'rgba(255,255,255,0.35)'; cd.fillRect(x + cs * 0.27, y + cs * 0.74, cs * 0.46, 4); // stone sill
    const wx = x + cs * 0.3, wy = y + cs * 0.22, ww = cs * 0.4, wh = cs * 0.5;
    cd.fillStyle = '#5a5e6a'; cd.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
    cd.fillStyle = '#2d3240'; cd.fillRect(wx, wy, ww, wh);
    const lit = R();
    if (lit < 0.38) {
      const warm = R() < 0.75; const g = ce.createLinearGradient(0, wy, 0, wy + wh);
      g.addColorStop(0, warm ? '#ffcf7a' : '#b9d4ff'); g.addColorStop(1, warm ? '#c9822f' : '#5d7bd6');
      ce.fillStyle = g; ce.globalAlpha = 0.55 + 0.45 * R(); ce.fillRect(wx, wy, ww, wh); ce.globalAlpha = 1;
      cd.fillStyle = warm ? '#f6d9a0' : '#cfe0ff'; cd.fillRect(wx, wy, ww, wh);
    } else if (lit < 0.46) { ce.fillStyle = 'rgba(255,60,140,0.6)'; ce.fillRect(wx, wy, ww, wh); }
    cd.fillStyle = '#5a5e6a'; cd.fillRect(wx + ww / 2 - 2, wy, 4, wh);
  }
  d.update(); e.update();
  for (const t of [d, e]) { t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 4; }
  return { d, e };
}
function radialTex(scene, name, inner, outer = 'rgba(0,0,0,0)') {
  const t = new DynamicTexture(name, 128, scene, true); const c = t.getContext();
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(1, outer);
  c.fillStyle = g; c.fillRect(0, 0, 128, 128); t.hasAlpha = true; t.update(); return t;
}
export function beamTex(scene) {
  const t = new DynamicTexture('beam', { width: 64, height: 256 }, scene, true); const c = t.getContext();
  const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0.9)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 256); t.hasAlpha = true; t.update(); return t;
}


// ---- roofs: real shapes from LiDAR/OSM (rf, r). Gabled/hipped on near-rectangular footprints, chimneys on terraces ----
function tri3(R, a, b, c, col) { const base = R.p.length / 3; R.p.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) R.c.push(col.r, col.g, col.b, 1); R.i.push(base, base + 2, base + 1); }
function quad3(R, a, b, c, d, col) { tri3(R, a, b, c, col); tri3(R, a, c, d, col); }
function boxAt(R, cx, y0, cz, sx, sy, sz, ang, col) {
  const ca = Math.cos(ang), sa = Math.sin(ang); const P = (u, y, v) => [cx + u * ca - v * sa, y, cz + u * sa + v * ca];
  const x = sx / 2, z = sz / 2, y1 = y0 + sy;
  const c = [P(-x, y0, -z), P(x, y0, -z), P(x, y0, z), P(-x, y0, z), P(-x, y1, -z), P(x, y1, -z), P(x, y1, z), P(-x, y1, z)];
  quad3(R, c[4], c[5], c[6], c[7], col); quad3(R, c[0], c[1], c[5], c[4], col); quad3(R, c[1], c[2], c[6], c[5], col); quad3(R, c[2], c[3], c[7], c[6], col); quad3(R, c[3], c[0], c[4], c[7], col);
}
export function obb(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L; let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const p of pts) { const u = p[0] * ux + p[1] * uz, v = -p[0] * uz + p[1] * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const A = (u1 - u0) * (v1 - v0); if (!best || A < best.A) best = { A, ux, uz, u0, u1, v0, v1 };
  }
  if (!best) return null;
  if (best.u1 - best.u0 < best.v1 - best.v0) { const { ux, uz, u0, u1, v0, v1 } = best; return { A: best.A, ux: -uz, uz: ux, u0: v0, u1: v1, v0: -u1, v1: -u0 }; }
  return best;
}
function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
function roofGeom(pts, h, b, rc, wallCol, Rf, R) {
  const rf = b.rf; if (!rf || rf === 'flat' || h > 40) return false;
  const o = obb(pts); if (!o) return false;
  const L = o.u1 - o.u0, W = o.v1 - o.v0; if (W < 3 || W > 26 || polyArea(pts) / o.A < 0.8) return false;
  const rise = Math.max(1.2, Math.min(b.r && b.r > h ? b.r - h : W * 0.38, W * 0.55, 7));
  const top = h + rise, ov = 0.35, um = (o.u0 + o.u1) / 2, vm = (o.v0 + o.v1) / 2;
  const P = (u, y, v) => [u * o.ux - v * o.uz, y, u * o.uz + v * o.ux];
  const hip = rf === 'hipped' || rf === 'side_hipped' || (rf === 'half-hipped');
  const inset = hip ? Math.min(W / 2, L / 2 - 0.2) : 0;
  const a0 = o.u0 - ov, a1 = o.u1 + ov, b0 = o.v0 - ov, b1 = o.v1 + ov, e = h - ov * rise / (W / 2);
  const r0 = P(o.u0 + inset, top, vm), r1 = P(o.u1 - inset, top, vm);
  const darker = Color3.Lerp(rc, new Color3(0, 0, 0), 0.12);
  quad3(Rf, P(a0, e, b0), P(a1, e, b0), r1, r0, rc);          // slope A
  quad3(Rf, P(a1, e, b1), P(a0, e, b1), r0, r1, darker);      // slope B
  if (hip) { tri3(Rf, P(a0, e, b1), P(a0, e, b0), r0, rc); tri3(Rf, P(a1, e, b0), P(a1, e, b1), r1, darker); }
  else { // gable ends in wall colour
    const gc = Color3.Lerp(wallCol, new Color3(0, 0, 0), 0.08);
    tri3(Rf, P(o.u0, h, o.v1), P(o.u0, h, o.v0), P(o.u0, top, vm), gc); tri3(Rf, P(o.u1, h, o.v0), P(o.u1, h, o.v1), P(o.u1, top, vm), gc);
    tri3(Rf, P(o.u0, h, o.v0), P(o.u0, h, o.v1), P(o.u0, top, vm), gc); tri3(Rf, P(o.u1, h, o.v1), P(o.u1, h, o.v0), P(o.u1, top, vm), gc);
  }
  // chimneys: brick stacks on the ridge at party walls of terraces (~ every 2nd house)
  if (W < 14 && h < 16) {
    const brick = hex('#7a3e2c'), step = 5.4 * 2; const ang = Math.atan2(o.uz, o.ux);
    for (let u = o.u0 + 0.8 + (R() * 2); u < o.u1 - 0.6; u += step) {
      const c = P(u, 0, vm); boxAt(Rf, c[0], top - 1.0, c[2], 0.7, 2.1, 1.3, ang, brick);
      for (const dv of [-0.3, 0.3]) { const q = P(u, 0, vm + dv); boxAt(Rf, q[0], top + 1.1, q[2], 0.22, 0.45, 0.22, ang, hex('#b0623f')); }
    }
  } else if (R() < 0.5) { const c = P(o.u0 + L * 0.25, 0, vm + W * 0.15); boxAt(Rf, c[0], top - 1.5, c[2], 0.8, 2.6, 0.8, Math.atan2(o.uz, o.ux), hex('#6e4433')); }
  return true;
}
function parapet(pts, h, col, Rf) {
  for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.3) continue;
    const nx = (c[1] - a[1]) / L * 0.25, nz = -(c[0] - a[0]) / L * 0.25; // inward offset for CCW is negative normal
    quad3(Rf, [a[0], h, a[1]], [c[0], h, c[1]], [c[0], h + 0.7, c[1]], [a[0], h + 0.7, a[1]], col);
    quad3(Rf, [c[0] - nx, h, c[1] - nz], [a[0] - nx, h, a[1] - nz], [a[0] - nx, h + 0.7, a[1] - nz], [c[0] - nx, h + 0.7, c[1] - nz], col);
    quad3(Rf, [a[0], h + 0.7, a[1]], [c[0], h + 0.7, c[1]], [c[0] - nx, h + 0.7, c[1] - nz], [a[0] - nx, h + 0.7, a[1] - nz], col); }
}

export async function buildCity(scene, { low = false } = {}) {
  const data = await (await fetch(import.meta.env.BASE_URL + 'data/city.json')).json();
  const root = new TransformNode('city', scene);
  const grid = new SegGrid(16);
  const R = rng(42);
  // ---------- ground ----------
  const gm = new StandardMaterial('ground', scene); gm.diffuseColor = hex('#2b2f2a'); gm.specularColor = new Color3(0.05, 0.05, 0.08);
  const ground = toMesh('ground', xf(box(2200, 0.2, 3560), { t: [-85, -0.22, -760] }), scene, gm); ground.parent = root;
  // ---------- buildings ----------
  const { d, e } = windowTextures(scene);
  const wm = new StandardMaterial('walls', scene); wm.diffuseTexture = d; wm.emissiveTexture = e; wm.specularColor = new Color3(0.12, 0.12, 0.14); wm.specularPower = 24; wm.backFaceCulling = false;
  const rm = new StandardMaterial('roofs', scene); rm.diffuseColor = new Color3(1, 1, 1); rm.specularColor = new Color3(0.05, 0.05, 0.05); rm.backFaceCulling = false; rm.twoSidedLighting = true;
  const W = { p: [], n: [], u: [], c: [], i: [] }, Rf = { p: [], n: [], c: [], i: [] };
  const buildings = [];
  for (const b of data.buildings) {
    if (b.id === TEMPLE_OSM_ID) { buildings.push({ ...b, temple: true }); continue; }
    if (b.id === 267251302 || b.id === 298832670) { const lp = []; for (let i = 0; i < b.p.length; i += 2) lp.push([b.p[i], b.p[i + 1]]); buildings.push({ ...b, pts: lp, landmark: true }); continue; }
    const pts = []; for (let i = 0; i < b.p.length; i += 2) pts.push([b.p[i], b.p[i + 1]]);
    let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; area += a[0] * c[1] - c[0] * a[1]; }
    if (Math.abs(area) < 8) continue;
    if (area < 0) pts.reverse(); // CCW
    const h = b.h; const col = b.c ? Color3.Lerp(hex(b.c), hex('#d8cfc0'), 0.18) : b.k === 'church' ? hex('#b89b7a') : PALETTE[Math.floor(R() * PALETTE.length)];
    const tint = 0.9 + R() * 0.2;
    let u0 = R() * 8;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length]; const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue;
      const nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L; // outward for CCW
      const base = W.p.length / 3; const u1 = u0 + L / 3.6; const vtop = h / 3.4;
      W.p.push(a[0], 0, a[1], c[0], 0, c[1], c[0], h, c[1], a[0], h, a[1]);
      for (let k = 0; k < 4; k++) { W.n.push(nx, 0, nz); W.c.push(col.r * tint, col.g * tint, col.b * tint, 1); }
      W.u.push(u0 / 8, 0, u1 / 8, 0, u1 / 8, vtop / 8, u0 / 8, vtop / 8);
      W.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
      u0 = u1;
      grid.add(a[0], a[1], c[0], c[1], h);
    }
    const rc = b.rc ? Color3.Lerp(hex(b.rc), col, 0.12) : Color3.Lerp(col, hex('#3a3d4a'), 0.6);
    if (!roofGeom(pts, h, b, rc, col, Rf, R)) {
      const flat = pts.flat(); const tri = earcut(flat); const base = Rf.p.length / 3;
      for (const p of pts) { Rf.p.push(p[0], h, p[1]); Rf.n.push(0, 1, 0); Rf.c.push(rc.r, rc.g, rc.b, 1); }
      for (let i = 0; i < tri.length; i += 3) Rf.i.push(base + tri[i], base + tri[i + 1], base + tri[i + 2]);
      if (pts.length < 40) parapet(pts, h, Color3.Lerp(col, hex('#000000'), 0.15), Rf);
    }
    buildings.push({ ...b, pts, h });
  }
  const wv = new VertexData(); wv.positions = W.p; wv.normals = W.n; wv.uvs = W.u; wv.colors = W.c; wv.indices = W.i;
  const walls = toMesh('walls', wv, scene, wm); walls.parent = root; walls.freezeWorldMatrix(); walls.isPickable = false;
  const rv = new VertexData(); rv.positions = Rf.p; Rf.n = []; VertexData.ComputeNormals(Rf.p, Rf.i, Rf.n); rv.normals = Rf.n; rv.colors = Rf.c; rv.indices = Rf.i;
  const roofs = toMesh('roofs', rv, scene, rm); roofs.parent = root; roofs.freezeWorldMatrix(); roofs.isPickable = false;

  // ---------- roads: textured asphalt, raised kerbed pavements, UK markings, crossings, street furniture ----------
  const mkTex = (name, N, draw, rep) => { const t = new DynamicTexture(name, N, scene, true); const g = t.getContext(); draw(g, N); t.update(); t.wrapU = t.wrapV = Texture.WRAP_ADDRESSMODE; t.anisotropicFilteringLevel = 8; return t; };
  const asphT = mkTex('asphT', 512, (g, N) => { const r = rng(5); g.fillStyle = '#c4c4c8'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 16000; i++) { const v = 160 + r() * 95 | 0; g.fillStyle = `rgba(${v},${v},${v + 4},${0.2 + r() * 0.4})`; const s = 1 + r() * 1.6; g.fillRect(r() * N, r() * N, s, s); }
    for (let i = 0; i < 3; i++) { const x = r() * N, y = r() * N, rr = 40 + r() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(120,120,128,0.18)'); gr.addColorStop(1, 'rgba(120,120,128,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); } // worn patches
    g.strokeStyle = 'rgba(60,60,66,0.35)'; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { g.beginPath(); let x = r() * N, y = r() * N; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); } });
  const paveT = mkTex('paveT', 512, (g, N) => { const r = rng(9); g.fillStyle = '#d4d0ca'; g.fillRect(0, 0, N, N); const n = 5, s = N / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 190 + r() * 40 | 0; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      for (let k = 0; k < 60; k++) { const w = 120 + r() * 80 | 0; g.fillStyle = `rgba(${w},${w},${w},0.25)`; g.fillRect(i * s + r() * s, j * s + r() * s, 2, 2); } }
    g.fillStyle = 'rgba(70,68,64,0.6)'; for (let i = 0; i <= n; i++) { g.fillRect(i * s - 1.5, 0, 3, N); g.fillRect(0, i * s - 1.5, N, 3); } });
  const roadM = new StandardMaterial('roads', scene); roadM.diffuseTexture = asphT; roadM.specularColor = new Color3(0.34, 0.35, 0.42); roadM.specularPower = 64; roadM.backFaceCulling = false; // damp Belfast tarmac sheen
  const paveM = new StandardMaterial('pavement', scene); paveM.diffuseTexture = paveT; paveM.specularColor = new Color3(0.12, 0.12, 0.14); paveM.specularPower = 32; paveM.backFaceCulling = false;
  const markM = new StandardMaterial('markings', scene); markM.specularColor = new Color3(0.2, 0.2, 0.2); markM.emissiveColor = new Color3(0.08, 0.08, 0.08); markM.backFaceCulling = false;
  const cobT = mkTex('cobT', 512, (g, N) => { const r = rng(13); g.fillStyle = '#4a4744'; g.fillRect(0, 0, N, N); const rows = 16, h = N / rows;
    for (let j = 0; j < rows; j++) { let x = (j % 2) * h * 0.6 - h; while (x < N) { const w = h * (1.1 + r() * 0.7), v = 120 + r() * 70 | 0; g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      g.beginPath(); g.roundRect ? g.roundRect(x + 2, j * h + 2, w - 4, h - 4, 5) : g.rect(x + 2, j * h + 2, w - 4, h - 4); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x + 4, j * h + 3, w - 9, 3); x += w; } } });
  const cobM = new StandardMaterial('cobbles', scene); cobM.diffuseTexture = cobT; cobM.specularColor = new Color3(0.4, 0.4, 0.45); cobM.specularPower = 50; cobM.backFaceCulling = false;
  const NB = () => ({ p: [], c: [], u: [], i: [] });
  const RD = NB(), PV = NB(), MK = NB(), CB = NB(); const SETT = [];
  const quadB = (B, a, b, w, y, col, uvs = 6) => {
    const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (L < 0.01) return;
    const nx = -dz / L * w / 2, nz = dx / L * w / 2; const base = B.p.length / 3;
    const P4 = [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]];
    for (const q of P4) { B.p.push(q[0], y, q[1]); B.c.push(col.r, col.g, col.b, 1); B.u.push(q[0] / uvs, q[1] / uvs); }
    B.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const discB = (B, p, r, y, col, uvs = 6) => { const base = B.p.length / 3; B.p.push(p[0], y, p[1]); B.c.push(col.r, col.g, col.b, 1); B.u.push(p[0] / uvs, p[1] / uvs);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; const x = p[0] + Math.cos(a) * r, z = p[1] + Math.sin(a) * r; B.p.push(x, y, z); B.c.push(col.r, col.g, col.b, 1); B.u.push(x / uvs, z / uvs); }
    for (let k = 0; k < 12; k++) B.i.push(base, base + 1 + ((k + 1) % 12), base + 1 + k); };
  const wallB = (B, a, b, y0, y1, col) => { const base = B.p.length / 3; B.p.push(a[0], y0, a[1], b[0], y0, b[1], b[0], y1, b[1], a[0], y1, a[1]); for (let k = 0; k < 4; k++) { B.c.push(col.r, col.g, col.b, 1); B.u.push(0, 0); } B.i.push(base, base + 1, base + 2, base, base + 2, base + 3); };
  const ASPH = hex('#4a4d57'), PAVE = hex('#8d8b88'), FOOT = hex('#9a958d'), KERB = hex('#b9b6b0'), KERBF = hex('#6e6c6a'), LINE = hex('#f0eee6'), YEL = hex('#f2c230');
  const YR = -0.085, YP = 0.0, YM = -0.072; // carriageway sits 8.5 cm below the kerbed pavement
  const lamps = [];
  const roadsOut = [];
  const nodeDeg = new Map(), nodeW = new Map();
  for (const r of data.roads) {
    const pts = []; for (let i = 0; i < r.p.length; i += 2) pts.push([r.p[i], r.p[i + 1]]);
    roadsOut.push({ ...r, pts });
    if (r.d && r.n) for (let i = 0; i < r.n.length; i++) { const k = r.n[i]; const end = i === 0 || i === r.n.length - 1; nodeDeg.set(k, (nodeDeg.get(k) || 0) + (end ? 1 : 2)); nodeW.set(k, Math.max(nodeW.get(k) || 0, r.w)); }
  }
  const PW = 2.7; // pavement width
  for (const r of roadsOut) {
    const pts = r.pts;
    if (r.d) {
      const RB = r.sf ? CB : RD; if (r.sf) SETT.push(r);
      for (let i = 0; i < pts.length - 1; i++) quadB(RB, pts[i], pts[i + 1], r.w, YR, r.sf ? hex('#ffffff') : ASPH, r.sf ? 3 : 6);
      for (let i = 0; i < pts.length; i++) { const p = pts[i]; discB(RB, p, r.w / 2, r.sf ? YR + 0.002 : YR, r.sf ? hex('#ffffff') : ASPH, r.sf ? 3 : 6); const jn = r.n && nodeDeg.get(r.n[i]) > 2; if (jn) discB(PV, p, nodeW.get(r.n[i]) / 2 + PW, YR - 0.004, PAVE, 3); }
      if (r.t === 'service') continue;
      for (let i = 0; i < pts.length - 1; i++) {
        let a = pts[i], b = pts[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (L < 0.05) continue; const ux = dx / L, uz = dz / L;
        const ta = r.n && nodeDeg.get(r.n[i]) > 2 ? nodeW.get(r.n[i]) / 2 + PW : 0, tb = r.n && nodeDeg.get(r.n[i + 1]) > 2 ? nodeW.get(r.n[i + 1]) / 2 + PW : 0;
        if (ta + tb > L - 0.5) continue;
        const A = [a[0] + ux * ta, a[1] + uz * ta], Bp = [b[0] - ux * tb, b[1] - uz * tb];
        for (const sd of [-1, 1]) {
          const o = r.w / 2 + PW / 2, ox = -uz * sd, oz = ux * sd;
          quadB(PV, [A[0] + ox * o, A[1] + oz * o], [Bp[0] + ox * o, Bp[1] + oz * o], PW, YP, PAVE, 3);
          const k1 = r.w / 2, k2 = r.w / 2 + 0.22; // kerb face + kerb stone
          wallB(MK, [A[0] + ox * k1, A[1] + oz * k1], [Bp[0] + ox * k1, Bp[1] + oz * k1], YR, YP + 0.004, KERBF);
          quadB(MK, [A[0] + ox * (k1 + k2) / 2, A[1] + oz * (k1 + k2) / 2], [Bp[0] + ox * (k1 + k2) / 2, Bp[1] + oz * (k1 + k2) / 2], 0.22, YP + 0.004, KERB);
          const o2 = r.w / 2 + PW; wallB(MK, [Bp[0] + ox * o2, Bp[1] + oz * o2], [A[0] + ox * o2, A[1] + oz * o2], -0.12, YP, KERBF);
        }
      }
    } else {
      if (r.sf) SETT.push(r);
      for (let i = 0; i < pts.length - 1; i++) quadB(r.sf ? CB : PV, pts[i], pts[i + 1], Math.max(1.6, r.w), r.t === 'pedestrian' ? YP + 0.002 : YP + 0.003, r.sf ? hex('#ffffff') : FOOT, 3);
    }
  }
  const dyRoad = (r) => ['primary', 'secondary', 'trunk', 'tertiary'].includes(r.t) || Math.abs(Math.floor(r.p[0] * 7)) % 3 === 0;
  for (const r of roadsOut) { // markings + fallback lamps
    if (!r.d) continue; const pts = r.pts; let acc = 0, lampAcc = R() * 30;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (L < 0.01) continue;
      const ux = dx / L, uz = dz / L;
      const ta = r.n && nodeDeg.get(r.n[i]) > 2 ? nodeW.get(r.n[i]) / 2 + 1 : 0, tb = r.n && nodeDeg.get(r.n[i + 1]) > 2 ? nodeW.get(r.n[i + 1]) / 2 + 1 : 0;
      if (r.w >= 6 && !['service'].includes(r.t)) {
        if (r.o && r.ln > 1) { for (let ln = 1; ln < r.ln; ln++) { const off = -r.w / 2 + r.w * ln / r.ln; for (let s = Math.max(ta, (3 - acc % 9 + 9) % 9); s < L - 2 - tb; s += 9) quadB(MK, [a[0] + ux * s - uz * off, a[1] + uz * s + ux * off], [a[0] + ux * (s + 2) - uz * off, a[1] + uz * (s + 2) + ux * off], 0.12, YM, LINE); } }
        else if (!r.o) for (let s = Math.max(ta, (3 - acc % 6 + 6) % 6); s < L - 3 - tb; s += 6) quadB(MK, [a[0] + ux * s, a[1] + uz * s], [a[0] + ux * (s + 3), a[1] + uz * (s + 3)], 0.14, YM, LINE);
      }
      if (dyRoad(r) && L - ta - tb > 1) for (const sd of [-1, 1]) for (const k of [0.3, 0.5]) { // double yellow lines along the kerb
        const ox = -uz * sd * (r.w / 2 - k), oz = ux * sd * (r.w / 2 - k);
        quadB(MK, [a[0] + ux * ta + ox, a[1] + uz * ta + oz], [b[0] - ux * tb + ox, b[1] - uz * tb + oz], 0.1, YM, YEL);
      }
      acc += L;
      while (lampAcc < L && r.t !== 'service') { const sd = lamps.length % 2 ? 1 : -1; const off = r.w / 2 + 1.6;
        lamps.push([a[0] + ux * lampAcc - uz * sd * off, a[1] + uz * lampAcc + ux * sd * off, Math.atan2(-uz * sd, ux * sd)]); lampAcc += low ? 55 : 34; }
      lampAcc -= L;
    }
  }
  // crossings (OSM via research pack): zebras with belisha beacons, signal crossings with studs + stop lines; bollards + guard railings
  const furn = { bollard: [], beacon: [], railing: [], signal: [] };
  let XS = null; try { XS = await (await fetch(import.meta.env.BASE_URL + 'data/crossings.json')).json(); } catch (e) { }
  if (XS) {
    const segs = []; for (const r of roadsOut) if (r.d && r.t !== 'service') for (let i = 0; i < r.pts.length - 1; i++) segs.push([r.pts[i], r.pts[i + 1], r]);
    const grid2 = new Map(); const gk = (x, z) => Math.floor(x / 30) + ',' + Math.floor(z / 30);
    segs.forEach(s => { const k = gk((s[0][0] + s[1][0]) / 2, (s[0][1] + s[1][1]) / 2); if (!grid2.has(k)) grid2.set(k, []); grid2.get(k).push(s); });
    for (const [x, z, kind] of XS) {
      let best = null, bd = 6; const gx = Math.floor(x / 30), gz = Math.floor(z / 30);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const s of grid2.get((gx + i) + ',' + (gz + j)) || []) { const [a, b] = s; const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)); const d = Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z); if (d < bd) { bd = d; best = { s, px: a[0] + dx * t, pz: a[1] + dz * t, L: Math.sqrt(L2), dx, dz }; } }
      if (!best) continue; const r = best.s[2]; const ux = best.dx / best.L, uz = best.dz / best.L, nx = -uz, nz = ux, w = r.w, cx = best.px, cz = best.pz;
      const P = (u, v) => [cx + ux * u + nx * v, cz + uz * u + nz * v];
      if (kind === 'z') { for (let v = -w / 2 + 0.4; v < w / 2 - 0.3; v += 1.0) quadB(MK, P(-1.5, v + 0.25), P(1.5, v + 0.25), 0.5, YM + 0.002, LINE);
        for (const sd of [-1, 1]) { const q = P(0, sd * (w / 2 + 0.5)); furn.beacon.push([q[0], q[1]]); }
        for (const sd of [-1, 1]) quadB(MK, P(sd * 2.6, -w / 2 + 0.2), P(sd * 2.6, w / 2 - 0.2), 0.25, YM + 0.001, LINE); // give-way lines
      } else {
        for (const sd of [-1, 1]) { for (let v = -w / 2 + 0.3; v < w / 2 - 0.3; v += 0.8) quadB(MK, P(sd * 1.2, v), P(sd * 1.2, v + 0.45), 0.15, YM + 0.002, LINE); // dotted studs
          const off = sd > 0 ? [0.2, w / 2 - 0.2] : [-w / 2 + 0.2, -0.2]; quadB(MK, P(sd * 3.0, off[0]), P(sd * 3.0, off[1]), 0.3, YM + 0.002, LINE); // stop line (left-hand traffic)
          const q = P(sd * 1.8, sd * (w / 2 + 0.45)); furn.signal.push([q[0], q[1], Math.atan2(nx * sd, nz * sd)]);
          for (const su of [-1, 1]) { const rr = P(su * 3.6, sd * (w / 2 + 0.35)); furn.railing.push([rr[0], rr[1], Math.atan2(ux, uz)]); } }
      }
      for (const sd of [-1, 1]) for (const su of [-1, 1]) { const q = P(su * 1.9, sd * (w / 2 + 0.35)); furn.bollard.push([q[0], q[1]]); }
    }
  }
  const mkMesh = (name, B, m) => { const vd = new VertexData(); vd.positions = B.p; vd.colors = B.c; vd.uvs = B.u; vd.indices = B.i; vd.normals = []; VertexData.ComputeNormals(B.p, B.i, vd.normals); for (let i = 1; i < vd.normals.length; i += 3) if (B.p[i] !== undefined && Math.abs(vd.normals[i]) > 0.5) vd.normals[i] = 1; const me = toMesh(name, vd, scene, m); me.parent = root; me.freezeWorldMatrix(); me.isPickable = false; return me; };
  const roads = mkMesh('roads', RD, roadM); mkMesh('pavement', PV, paveM); mkMesh('markings', MK, markM);
  if (CB.p.length) mkMesh('cobbles', CB, cobM);
  // festoon lights: warm bulb strings zig-zagging across the Cathedral Quarter's cobbled streets
  { const bulbs = [], WI = []; const inCQ = (x, z) => Math.hypot(x - 150, z + 230) < 260;
    for (const r of SETT) { const pts = r.pts; let acc = 3, flip = 0;
      for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.5) continue; const ux = dx / L, uz = dz / L;
        while (acc < L) { const cx = a[0] + ux * acc, cz = a[1] + uz * acc; if (inCQ(cx, cz)) { const half = (r.d ? r.w / 2 + PW : Math.max(1.6, r.w) / 2 + 1.2) - 0.3, sk = flip ? 2.2 : -2.2; flip ^= 1;
            const A = [cx - uz * half - ux * sk / 2, cz + ux * half - uz * sk / 2], B2 = [cx + uz * half + ux * sk / 2, cz - ux * half + uz * sk / 2]; const n = Math.max(4, Math.round(Math.hypot(B2[0] - A[0], B2[1] - A[1]) / 0.75));
            let prev = null; for (let k = 0; k <= n; k++) { const t = k / n, y = 5.6 - Math.sin(t * Math.PI) * 0.7; const q = [A[0] + (B2[0] - A[0]) * t, y, A[1] + (B2[1] - A[1]) * t];
              if (k > 0 && k < n) bulbs.push(q); if (prev) WI.push(xf(box(0.025, 0.025, Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2])), { r: [-Math.atan2(q[1] - prev[1], Math.hypot(q[0] - prev[0], q[2] - prev[2])), Math.atan2(q[0] - prev[0], q[2] - prev[2]), 0], t: [(q[0] + prev[0]) / 2, (q[1] + prev[1]) / 2, (q[2] + prev[2]) / 2] })); prev = q; } }
          acc += 6.5; }
        acc -= L; } }
    if (bulbs.length) { const bm = new StandardMaterial('festoonBulb', scene); bm.emissiveColor = hex('#e0943a'); bm.disableLighting = true;
      // merged (not thin-instanced: thin-instanced bulbs never drew after chunking), 3000 bulbs per mesh
      const BV = bulbs.map(q => xf(sphere(4), { s: [0.13, 0.16, 0.13], t: q }));
      for (let i = 0; i < BV.length; i += 3000) { const bm2 = toMesh('festoonBulbs', merge(BV.slice(i, i + 3000)), scene, bm); bm2.parent = root; bm2.isPickable = false; }
      const wm = new StandardMaterial('festoonWire', scene); wm.diffuseColor = hex('#151515'); wm.specularColor = Color3.Black();
      for (let i = 0; i < WI.length; i += 3000) { const w = toMesh('festoonWire', merge(WI.slice(i, i + 3000)), scene, wm); w.parent = root; w.isPickable = false; } } }
  // puddles: glossy dark patches near the kerbs that catch lamp and moon highlights (wet Belfast night)
  { const pud = []; const rr = rng(31); for (const r of roadsOut) { if (!r.d || r.t === 'service') continue; for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      for (let s = rr() * 25; s < L; s += 18 + rr() * 30) { const sd = rr() < 0.5 ? -1 : 1, off = (r.w / 2 - 0.6 - rr() * 1.2) * sd; pud.push([a[0] + ux * s - uz * off, a[1] + uz * s + ux * off, Math.atan2(ux, uz), 0.8 + rr() * 1.6]); } } }
    const pm = new StandardMaterial('puddle', scene); pm.diffuseColor = hex('#0e1016'); pm.specularColor = new Color3(1, 1, 1.05); pm.specularPower = 180; pm.emissiveColor = hex('#141a2a'); pm.alpha = 0.9;
    const pv = color(xf(cyl(0.004, 1, 1, 12, true), { s: [1, 1, 0.6] }), new Color3(1, 1, 1)); const pmesh = toMesh('puddles', pv, scene, pm);
    const buf = new Float32Array(pud.length * 16); pud.forEach((p, i) => Matrix.Compose(new Vector3(p[3], 1, p[3] * (0.6 + (i % 5) * 0.15)), Quaternion.FromEulerAngles(0, p[2] + i, 0), new Vector3(p[0], YM + 0.003, p[1])).copyToArray(buf, i * 16));
    pmesh.thinInstanceSetBuffer('matrix', buf, 16, true); pmesh.parent = root; pmesh.isPickable = false; }
  // street furniture thin instances
  const furnM = new StandardMaterial('furn', scene); furnM.diffuseColor = new Color3(1, 1, 1); furnM.specularColor = new Color3(0.3, 0.3, 0.3);
  const tiBuf = (list, f) => { const buf = new Float32Array(list.length * 16); list.forEach((it, i) => f(it).copyToArray(buf, i * 16)); return buf; };
  const place = (name, vd, list, rotIdx) => { if (!list.length) return null; const me = toMesh(name, vd, scene, furnM); me.thinInstanceSetBuffer('matrix', tiBuf(list, (it) => Matrix.Compose(Vector3.One(), Quaternion.FromEulerAngles(0, rotIdx != null ? it[rotIdx] : 0, 0), new Vector3(it[0], 0, it[1]))), 16, true); me.parent = root; me.isPickable = false; return me; };
  const BLK = hex('#1c1c20'), WHT = hex('#f2f2f2');
  place('bollards', merge([color(xf(cyl(0.95, 0.08, 0.1, 7), { t: [0, 0.475, 0] }), BLK), color(xf(cyl(0.06, 0.085, 0.085, 7, false), { t: [0, 0.82, 0] }), WHT), color(xf(sphere(3), { s: [0.085, 0.05, 0.085], t: [0, 0.95, 0] }), BLK)]), furn.bollard);
  const beaconPole = []; for (let k = 0; k < 8; k++) beaconPole.push(color(xf(cyl(0.3, 0.06, 0.06, 8), { t: [0, 0.15 + k * 0.3, 0] }), k % 2 ? WHT : BLK));
  place('beaconPoles', merge(beaconPole), furn.beacon);
  if (furn.beacon.length) { const gm2 = new StandardMaterial('belisha', scene); gm2.emissiveColor = hex('#ffa21a'); gm2.disableLighting = true; const g = toMesh('belishaGlobe', xf(sphere(10), { s: [0.2, 0.2, 0.2], t: [0, 2.55, 0] }), scene, gm2); g.thinInstanceSetBuffer('matrix', tiBuf(furn.beacon, it => Matrix.Translation(it[0], 0, it[1])), 16, true); g.parent = root; }
  place('railings', merge([color(xf(box(3.0, 0.05, 0.05), { t: [0, 1.0, 0] }), hex('#d8dadc')), color(xf(box(3.0, 0.05, 0.05), { t: [0, 0.25, 0] }), hex('#d8dadc')), ...[-1.45, -0.7, 0, 0.7, 1.45].map(x => color(xf(box(0.04, 0.8, 0.04), { t: [x, 0.62, 0] }), hex('#d8dadc'))), ...Array.from({ length: 14 }, (_, k) => color(xf(box(0.018, 0.72, 0.018), { t: [-1.3 + k * 0.2, 0.62, 0] }), hex('#b8bcc0')))]), furn.railing.map(r => [r[0], r[1], r[2] + Math.PI / 2]), 2);
  if (furn.signal.length) { place('signalPoles', merge([color(xf(cyl(3.0, 0.06, 0.07, 8), { t: [0, 1.5, 0] }), hex('#2a2a2e')), color(xf(rbox(0.32, 0.9, 0.26, 0.3, 6), { t: [0, 2.7, 0.12] }), hex('#1a1a1c')), color(xf(box(0.22, 0.3, 0.14), { t: [0, 1.25, 0.08] }), hex('#d8c63a'))]), furn.signal, 2);
    const sm = new StandardMaterial('sigLamps', scene); sm.disableLighting = true; sm.emissiveColor = new Color3(1, 1, 1);
    const sl = toMesh('signalLamps', merge([color(xf(cyl(0.03, 0.08, 0.08, 10), { r: [Math.PI / 2, 0, 0], t: [0, 2.98, 0.26] }), hex('#ff2a1a')), color(xf(cyl(0.03, 0.08, 0.08, 10), { r: [Math.PI / 2, 0, 0], t: [0, 2.7, 0.26] }), hex('#40220a')), color(xf(cyl(0.03, 0.08, 0.08, 10), { r: [Math.PI / 2, 0, 0], t: [0, 2.42, 0.26] }), hex('#0a3018'))]), scene, sm);
    sl.thinInstanceSetBuffer('matrix', tiBuf(furn.signal, it => Matrix.Compose(Vector3.One(), Quaternion.FromEulerAngles(0, it[2], 0), new Vector3(it[0], 0, it[1]))), 16, true); sl.parent = root; }
  for (const b of furn.bollard) grid.add(b[0] - 0.1, b[1], b[0] + 0.1, b[1], 1);

  // ---------- street lamps (thin instances) + light pools ----------
  const poleM = new StandardMaterial('pole', scene); poleM.diffuseColor = hex('#4b4f5c'); poleM.specularColor = new Color3(0.3, 0.3, 0.3);
  const pole = toMesh('lampPole', merge([xf(cyl(7.5, 0.07, 0.11, 8), { t: [0, 3.75, 0] }), xf(box(1.3, 0.1, 0.1), { t: [0.6, 7.4, 0] })]), scene, poleM);
  // Real DfI lamp positions (OGL) when available: arm faces the nearest carriageway, LED white vs SON-T sodium orange
  let SF = null; try { SF = await (await fetch(import.meta.env.BASE_URL + 'data/streetfurniture.json')).json(); } catch (e) { }
  if (SF && SF.lamps && SF.lamps.length) {
    const segs = new Map(); const key = (x, z) => Math.floor(x / 25) + ',' + Math.floor(z / 25);
    for (const r of roadsOut) if (r.d) for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; const k = key((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); if (!segs.has(k)) segs.set(k, []); segs.get(k).push([a, b]); }
    lamps.length = 0;
    for (const [x, z, mh, led] of SF.lamps) {
      let best = null, bd = 1e9; const gx = Math.floor(x / 25), gz = Math.floor(z / 25);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [a, b] of segs.get((gx + i) + ',' + (gz + j)) || []) {
        const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
        const px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; best = [px, pz]; } }
      const ang = best && bd > 0.3 ? Math.atan2(best[1] - z, best[0] - x) : 0;
      lamps.push([x, z, ang, mh, led]);
    }
  }
  const mkHead = (nm, col) => { const m = new StandardMaterial(nm, scene); m.emissiveColor = hex(col); m.disableLighting = true; return toMesh(nm, xf(box(0.6, 0.12, 0.3), { t: [1.15, 7.3, 0] }), scene, m); };
  const mkPool = (nm, rgba, em) => { const m = new StandardMaterial(nm, scene); m.diffuseTexture = radialTex(scene, nm + 'T', rgba); m.useAlphaFromDiffuseTexture = true; m.emissiveColor = hex(em); m.disableLighting = true; m.alphaMode = 1; return toMesh(nm, xf(plane(16, 16), { r: [Math.PI / 2, 0, 0], t: [1.1, 0.09, 0] }), scene, m); };
  const groups = [{ led: 1, head: mkHead('lampHeadLED', '#eef3ff'), pool: mkPool('poolLED', 'rgba(220,230,255,0.24)', '#9aa6c2') },
                  { led: 0, head: mkHead('lampHead', '#ffb35a'), pool: mkPool('pool', 'rgba(255,170,80,0.3)', '#c97a3a') }];
  const mats = [];
  const mtx = ([x, z, a, mh = 7.5]) => Matrix.Compose(new Vector3(1, mh / 7.5, 1), Quaternion.FromEulerAngles(0, -a, 0), new Vector3(x, 0, z));
  for (const l of lamps) mats.push(mtx(l));
  const toBuf = (ms) => { const buf = new Float32Array(ms.length * 16); ms.forEach((m, i) => m.copyToArray(buf, i * 16)); return buf; };
  pole.thinInstanceSetBuffer('matrix', toBuf(mats), 16, true); pole.parent = root; pole.isPickable = false;
  for (const g of groups) { const sel = lamps.filter(l => (l[4] === undefined ? 0 : l[4]) === g.led); const ms = sel.map(mtx);
    const poolMs = sel.filter((l, i) => !low || i % 2 === 0).map(l => Matrix.Compose(Vector3.One(), Quaternion.FromEulerAngles(0, -l[2], 0), new Vector3(l[0], 0, l[1])));
    if (!ms.length) { g.head.setEnabled(false); g.pool.setEnabled(false); continue; }
    g.head.thinInstanceSetBuffer('matrix', toBuf(ms), 16, true); g.pool.thinInstanceSetBuffer('matrix', toBuf(poolMs), 16, true);
    for (const m of [g.head, g.pool]) { m.parent = root; m.isPickable = false; } }
  const pool = groups[1].pool, head = groups[1].head;
  // ---------- BCC street trees (OGL): clay canopy blobs ----------
  if (SF && SF.trees && SF.trees.length) {
    const trunkM = new StandardMaterial('trunk', scene); trunkM.diffuseColor = hex('#4a3a30'); trunkM.specularColor = Color3.Black();
    const leafM = new StandardMaterial('leaf', scene); leafM.diffuseColor = new Color3(1, 1, 1); leafM.specularColor = new Color3(0.06, 0.08, 0.06);
    const trunk = toMesh('trunk', xf(cyl(1, 0.09, 0.14, 7), { t: [0, 0.5, 0] }), scene, trunkM);
    const G1 = hex('#3f6b3a'), G2 = hex('#557f44'), G3 = hex('#2f5530');
    const canopy = toMesh('canopy', merge([color(xf(sphere(4), { s: [0.5, 0.42, 0.5], t: [0, 0.62, 0] }), G1), color(xf(sphere(3), { s: [0.34, 0.3, 0.34], t: [0.22, 0.78, 0.1] }), G2), color(xf(sphere(3), { s: [0.32, 0.28, 0.32], t: [-0.2, 0.74, -0.14] }), G3), color(xf(sphere(3), { s: [0.28, 0.26, 0.28], t: [0.02, 0.95, 0.02] }), G2)]), scene, leafM);
    const tm = [], cm = [];
    for (const [x, z, h, s] of SF.trees) { const rot = Quaternion.FromEulerAngles(0, (x * 7.13 + z * 3.7) % 6.28, 0);
      tm.push(Matrix.Compose(new Vector3(1, h * 0.45, 1), rot, new Vector3(x, 0, z))); cm.push(Matrix.Compose(new Vector3(s * 1.1, h * 0.9, s * 1.1), rot, new Vector3(x, h * 0.1, z))); grid.add(x - 0.15, z, x + 0.15, z, 3); }
    trunk.thinInstanceSetBuffer('matrix', toBuf(tm), 16, true); canopy.thinInstanceSetBuffer('matrix', toBuf(cm), 16, true);
    for (const m of [trunk, canopy]) { m.parent = root; m.isPickable = false; }
  }
  for (const [x, z] of lamps) grid.add(x - 0.12, z, x + 0.12, z, 8);

  // ---------- venue beacons (sky searchlights), ground rings ----------
  const beamM = new StandardMaterial('beamM', scene); beamM.diffuseTexture = beamTex(scene); beamM.useAlphaFromDiffuseTexture = true; beamM.emissiveColor = new Color3(0.32, 0.3, 0.42); beamM.disableLighting = true; beamM.alphaMode = 1; beamM.backFaceCulling = false;
  const beacons = [];
  for (const v of VENUES.filter(v => v.inSlice)) {
    for (let k = 0; k < 2; k++) {
      const b = toMesh('beacon-' + v.id + k, xf(cyl(260, 4.5, 0.4, 16, false), { t: [0, 130, 0] }), scene, beamM);
      b.position.set(v.x, 12, v.z); b.parent = root; b.isPickable = false; beacons.push({ m: b, k, v });
    }
  }
  return { root, grid, buildings, roads: roadsOut, lamps, beacons, data, walls, roofs, sf: SF };
}
export function updateCity(city, t) {
  for (const b of city.beacons) { b.m.rotation.z = Math.sin(t * 0.4 + b.k * 2) * 0.35; b.m.rotation.x = Math.cos(t * 0.33 + b.k) * 0.3; }
}
