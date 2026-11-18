// Belfast street flavour: invented chippy / off-licence fascia signs snapped to real facades, steam from road vents.
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { toMesh, plane } from './geo.js';

// all names invented (no real businesses)
const SHOPS = [
  { street: 'Donegall Street', k: 0.62, side: 1, at: 0.35, p: [-87.74, 33.68, -0.6958, 0.7182, 10], name: 'THE GOLDEN SPUD', sub: 'FISH SUPPERS · PASTIE BAPS', fg: '#ffd23a', bg: '#1a0f08' },
  { street: 'Donegall Street', k: 0.62, side: -1, at: 0.7, p: [-91.36, 37.44, -0.6912, 0.7226, 10], name: 'NIGHT OWL OFF-LICENCE', sub: 'WINES · BEERS · OPEN LATE', fg: '#7de3ff', bg: '#06121c' },
  { street: 'Donegall Street', k: 0.5, side: 1, at: 0.6, p: [-67.22, 21.22, 0.5632, -0.8263, 10], name: 'CHIPPY CHAMPIONS', sub: 'CHIPS · GRAVY · CHAMP', fg: '#ff5a3a', bg: '#150606' },
  { street: 'Clifton Street', k: 0.4, side: 1, at: 0.4, p: [-307.08, 228.74, -0.7278, 0.6858, 16.0], name: 'CIRCUS OFF SALES', sub: 'OFF-LICENCE · OPEN TIL 11', fg: '#9dff7a', bg: '#08140a' },
  { street: 'Clifton Street', k: 0.6, side: -1, at: 0.5, p: [-116.8, 75.1, 0.8, -0.6, 10], name: 'SALT & VINEGAR', sub: 'FISH & CHIP SHOP', fg: '#ffe08a', bg: '#120d04' },
  { street: 'Royal Avenue', k: 0.4, side: 1, at: 0.5, p: [11.05, -509.3, -0.2225, 0.9749, 12.8], name: 'LATE LARDER', sub: 'OFF-LICENCE · SNACKS', fg: '#ff7ad9', bg: '#150712' },
];

function signTex(scene, s) {
  const t = new DynamicTexture('shopSign-' + s.name, { width: 1024, height: 256 }, scene, true); const g = t.getContext();
  g.setTransform(1, 0, 0, 256 / 192, 0, 0); g.fillStyle = s.bg; g.fillRect(0, 0, 1024, 192); g.strokeStyle = s.fg; g.lineWidth = 6; g.globalAlpha = 0.7; g.strokeRect(10, 10, 1004, 172); g.globalAlpha = 1;
  g.shadowColor = s.fg; g.shadowBlur = 18; g.fillStyle = s.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = 78; do { g.font = `800 ${fs}px Unbounded, Arial Black, sans-serif`; fs -= 2; } while (g.measureText(s.name).width > 940 && fs > 30); g.fillText(s.name, 512, 80);
  g.shadowBlur = 6; g.font = '600 32px "DM Sans", Arial, sans-serif'; g.fillStyle = '#f4f0e8'; g.fillText(s.sub, 512, 150);
  t.update(); return t;
}

export function buildFlavour(scene, city, { low = false, parent = null } = {}) {
  const out = { signs: [], steam: [] };
  const wallNear = (x, z, maxD = 26) => { let best = null, bd = 1e9; for (const s of city.grid.near(x, z, maxD)) { const dx = s.x1 - s.x0, dz = s.z1 - s.z0, L2 = dx * dx + dz * dz; if (L2 < 64 || s.h < 3 || s.h === 30.5) continue; const Ls = Math.sqrt(L2), m0 = 3.4 / Ls; let t = ((x - s.x0) * dx + (z - s.z0) * dz) / L2; t = Math.max(m0, Math.min(1 - m0, t)); /* whole 5.2 m sign stays on this facade */ const px = s.x0 + dx * t, pz = s.z0 + dz * t; const d = Math.hypot(px - x, pz - z); if (d < bd) { const L = Math.sqrt(L2); let nx = -dz / L, nz = dx / L; if ((x - px) * nx + (z - pz) * nz < 0) { nx = -nx; nz = -nz; } bd = d; best = { x: px, z: pz, nx, nz }; } } return best; };
  const roadPt = (name, k, at) => { const rs = city.roads.filter(r => r.nm === name); if (!rs.length) return null; const r = rs[Math.floor(rs.length * k) % rs.length]; const f = at * (r.pts.length - 1), i = Math.min(r.pts.length - 2, Math.floor(f)); if (i < 0) return null; const a = r.pts[i], b = r.pts[i + 1], u = f - i; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return { x: a[0] + dx * u, z: a[1] + dz * u, ux: dx / L, uz: dz / L, w: r.w || 8 }; };
  for (const s of SHOPS) {
    const p = s.p ? { x: s.p[0], z: s.p[1], ux: s.p[2], uz: s.p[3], w: s.p[4] } : roadPt(s.street, s.k, s.at); if (!p) continue;
    const ox = p.x - p.uz * s.side * (p.w / 2 + 1.2), oz = p.z + p.ux * s.side * (p.w / 2 + 1.2); const w = wallNear(ox, oz); if (!w) continue;
    const m = new StandardMaterial('shopSignM', scene); m.emissiveTexture = signTex(scene, s); m.disableLighting = true; m.diffuseColor = Color3.Black(); m.specularColor = Color3.Black();
    const mesh = toMesh('shopSign', plane(5.2, 0.98), scene, m); mesh.position.set(w.x + w.nx * 0.45, 3.3, w.z + w.nz * 0.45); mesh.rotation.y = Math.atan2(w.nx, w.nz); mesh.scaling.x = -1; mesh.isPickable = false; if (parent) mesh.parent = parent;
    out.signs.push({ mesh, ...s, x: w.x, z: w.z });
  }
  // steam from road vents / manholes near the busy streets
  const st = new DynamicTexture('steamT', 64, scene, true); { const g = st.getContext(); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(225,228,240,0.55)'); gr.addColorStop(0.6, 'rgba(210,214,230,0.18)'); gr.addColorStop(1, 'rgba(200,205,220,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); st.hasAlpha = true; st.update(); }
  const vents = [[-90.04, 36.06, -0.6912, 0.7226], [-79.18, 38.7, 0.5655, -0.8247], [-114.6, 57.0, -0.748, 0.6637], [8.8, -499.66, -0.2316, 0.9728], [-334.32, 260.42, 0.5525, -0.8335]].slice(0, low ? 2 : 5); /* fixed spots from the original slice */
  for (const [vx, vz, vux, vuz] of vents) {
    const p = { x: vx, z: vz, ux: vux, uz: vuz };
    const ps = new ParticleSystem('steam', low ? 40 : 90, scene); ps.particleTexture = st; ps.emitter = new Vector3(p.x + p.uz * 1.2, -0.05, p.z - p.ux * 1.2);
    ps.minEmitBox = new Vector3(-0.3, 0, -0.3); ps.maxEmitBox = new Vector3(0.3, 0, 0.3); ps.direction1 = new Vector3(-0.15, 1, -0.1); ps.direction2 = new Vector3(0.2, 1.4, 0.15); ps.gravity = new Vector3(0.25, 0.15, 0);
    ps.color1 = new Color4(0.85, 0.87, 0.95, 0.42); ps.color2 = new Color4(0.75, 0.77, 0.86, 0.3); ps.colorDead = new Color4(0.6, 0.62, 0.7, 0); ps.minSize = 0.8; ps.maxSize = 2.2; ps.minScaleY = 1; ps.maxScaleY = 1.3;
    ps.minLifeTime = 2.2; ps.maxLifeTime = 4; ps.emitRate = low ? 10 : 22; ps.minEmitPower = 0.35; ps.maxEmitPower = 0.7; ps.updateSpeed = 0.016; ps.blendMode = ParticleSystem.BLENDMODE_STANDARD; ps.minAngularSpeed = -0.4; ps.maxAngularSpeed = 0.4;
    ps.start(); out.steam.push({ ps, x: p.x, z: p.z });
  }
  out.setEnabled = (on) => { out.signs.forEach(s => s.mesh.setEnabled(on)); out.steam.forEach(s => on ? s.ps.start() : s.ps.stop()); };
  return out;
}

// wet-pavement reflections: stretched additive streaks under nearby street lamps, turned toward the camera each tick
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { CreatePlaneVertexData } from '@babylonjs/core/Meshes/Builders/planeBuilder';
export function buildWetStreaks(scene, lamps, { low = false } = {}) {
  if (!lamps || !lamps.length) return { update() {}, setEnabled() {} };
  const T = new DynamicTexture('wetStreakT', { width: 64, height: 256 }, scene, true); { const g = T.getContext(); const img = g.createImageData(64, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) { const u = Math.abs(x - 31.5) / 32, v = y / 255; const a = Math.pow(Math.max(0, 1 - u), 2.2) * Math.pow(Math.sin(Math.PI * v), 1.3) * (0.75 + 0.25 * Math.sin(y * 0.9 + x * 0.3)); const i = (y * 64 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.min(255, a * 255); }
    g.putImageData(img, 0, 0); T.hasAlpha = true; T.update(); }
  const mk = (name, col) => { const m = new StandardMaterial(name, scene); m.diffuseTexture = T; m.useAlphaFromDiffuseTexture = true; m.emissiveColor = col; m.disableLighting = true; m.alphaMode = 1; m.backFaceCulling = false; m.disableDepthWrite = true; m.diffuseColor = Color3.Black();
    const vd = CreatePlaneVertexData({ width: 1, height: 1 }); const me = new Mesh(name, scene); vd.applyToMesh(me); me.material = m; me.isPickable = false; me.alwaysSelectAsActiveMesh = true; me.thinInstanceSetBuffer('matrix', new Float32Array(16 * 64), 16, false); me.thinInstanceCount = 0; return me; };
  const led = mk('wetLED', new Color3(0.75, 0.8, 0.95)), sod = mk('wetSod', new Color3(1.0, 0.56, 0.2));
  const maxN = low ? 16 : 40, R = 70, mat = new Matrix(), q = new Quaternion(), s = new Vector3(), p = new Vector3();
  let on = true;
  return {
    setEnabled(v) { on = v; led.setEnabled(v); sod.setEnabled(v); },
    update(cam) { if (!on) return; const near = []; for (const L of lamps) { const dx = L[0] - cam.x, dz = L[1] - cam.z, d2 = dx * dx + dz * dz; if (d2 < R * R && d2 > 4) near.push([d2, L]); } near.sort((a, b) => a[0] - b[0]);
      let nl = 0, ns = 0; const bl = led._thinInstanceDataStorage.matrixData, bs = sod._thinInstanceDataStorage.matrixData;
      for (const [d2, L] of near.slice(0, maxN)) { const d = Math.sqrt(d2), ux = (cam.x - L[0]) / d, uz = (cam.z - L[1]) / d; const len = Math.min(9, 3 + d * 0.12), wd = 0.7 + d * 0.012;
        Quaternion.FromEulerAnglesToRef(Math.PI / 2, Math.atan2(ux, uz), 0, q); s.set(wd, len, 1); p.set(L[0] + ux * (len / 2 + 0.6), 0.015, L[1] + uz * (len / 2 + 0.6)); Matrix.ComposeToRef(s, q, p, mat);
        if (L[3]) { mat.copyToArray(bl, nl * 16); nl++; } else { mat.copyToArray(bs, ns * 16); ns++; } }
      led.thinInstanceCount = nl; sod.thinInstanceCount = ns; led.thinInstanceBufferUpdated('matrix'); sod.thinInstanceBufferUpdated('matrix'); },
  };
}
