// The other Reckless venues as walk-in raves, built on first entry (no startup cost). Each layout, bar, booth position,
// materials and lighting are modelled from research/venue-refs/<venue>/ (modelling reference only, nothing shipped).
// Local frame: entrance/exit at z≈0 (x≈0), +z into the room. Every club shares the Temple's baked crowd meshes (one interior
// is live at a time) and the same beat clock (140 BPM) as the Temple.
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3, Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Scene } from '@babylonjs/core/scene';
import { hex, rng, box, cyl, sphere, rbox, xf, color, merge, toMesh, plane, planeR, torus } from './geo.js';
import { beamTex } from './city.js';

const BASE = import.meta.env.BASE_URL;
export function mat(scene, name, o = {}) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = o.d || new Color3(1, 1, 1); m.specularColor = o.s || new Color3(0.06, 0.06, 0.06); m.specularPower = o.p || 16;
  if (o.e) m.emissiveColor = o.e; if (o.unlit) m.disableLighting = true;
  if (o.add) { m.alphaMode = 1; m.backFaceCulling = false; } if (o.two) m.backFaceCulling = false;
  return m;
}
export function canvasTex(scene, name, w, h, draw) { const t = new DynamicTexture(name, { width: w, height: h }, scene, true); const c = t.getContext(); draw(c, w, h); t.update(); return t; }
function signTex(scene, txt, { fg = '#fff', bg = '#000', w = 1024, h = 192, frame = true, font = 'Unbounded' } = {}) {
  return canvasTex(scene, 'csign-' + txt, w, h, (c) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); if (frame) { c.strokeStyle = fg; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16); }
    c.fillStyle = fg; let fs = Math.min(110, h * 0.58); do { c.font = `800 ${fs}px ${font}`; fs -= 3; } while (c.measureText(txt).width > w - 70 && fs > 16); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 4); });
}
const speckle = (scene, name, base, dots, n = 1400, size = 512, seed = 3) => canvasTex(scene, name, size, size, (c, w, h) => { const R = rng(seed); c.fillStyle = base; c.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { c.fillStyle = dots[Math.floor(R() * dots.length)]; const r = 1 + R() * 3; c.fillRect(R() * w, R() * h, r, r); } });

// ---------------------------------------------------------------- kit
export function kit(scene, root, R) {
  const G = {}; // colour-merged static geometry per material key
  const add = (k, vd, col) => { (G[k] = G[k] || []).push(col ? color(vd, col) : vd); };
  const segs = [];
  const B = (k, w, h, d, x, y, z, col, r) => add(k, xf(box(w, h, d), { t: [x, y, z], r: r || [0, 0, 0] }), col);
  return {
    G, add, segs, B,
    shell(W, D, H, { floor = '#555', wall = '#111', ceil = null, gapX = 1.6 } = {}) { // floor + four walls (+ ceiling) with a door gap at z=0
      B('floor', W, 0.2, D, 0, -0.1, D / 2, hex(floor));
      B('wall', 0.3, H, D, -W / 2 - 0.15, H / 2, D / 2, hex(wall)); B('wall', 0.3, H, D, W / 2 + 0.15, H / 2, D / 2, hex(wall));
      B('wall', W + 0.6, H, 0.3, 0, H / 2, D + 0.15, hex(wall));
      B('wall', W / 2 - gapX, H, 0.3, -(W / 4 + gapX / 2), H / 2, -0.15, hex(wall)); B('wall', W / 2 - gapX, H, 0.3, W / 4 + gapX / 2, H / 2, -0.15, hex(wall));
      B('wall', 2 * gapX, H - 2.6, 0.3, 0, 2.6 + (H - 2.6) / 2, -0.15, hex(wall));
      if (ceil) B('ceil', W, 0.2, D, 0, H + 0.1, D / 2, hex(ceil));
      segs.push([-W / 2, 0, -W / 2, D], [W / 2, 0, W / 2, D], [-W / 2, D, W / 2, D], [-W / 2, 0, -gapX, 0], [gapX, 0, W / 2, 0], [-gapX, -0.6, gapX, -0.6]);
    },
    booth(x, z, { w = 3.2, y = 0, ry = 0, front = 'led' } = {}) { // DJ table facing -z: 2 decks + mixer + laptop, lit front panel
      const c = Math.cos(ry), s = Math.sin(ry), P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
      const at = (k, bw, bh, bd, lx, ly, lz, col) => { const [px, pz] = P(lx, lz); B(k, bw, bh, bd, px, y + ly, pz, col, [0, ry, 0]); };
      at('kit', w, 1.0, 0.9, 0, 0.5, 0, hex('#151517')); at('metal', w + 0.06, 0.04, 0.96, 0, 1.02, 0, hex('#2a2b30'));
      for (const lx of [-0.95, 0.95]) { at('kit', 0.36, 0.06, 0.42, lx, 1.07, 0.05, hex('#202126')); at('scr', 0.12, 0.012, 0.08, lx, 1.105, -0.12); at('kitR', 0.3, 0.012, 0.3, lx, 1.105, 0.1); }
      at('kit', 0.36, 0.08, 0.4, 0, 1.08, 0.05, hex('#26272c')); at('scr', 0.22, 0.012, 0.06, 0, 1.13, -0.1);
      at('kit', 0.36, 0.02, 0.26, 0.55, 1.06, 0.3, hex('#c9ced6')); at('scr', 0.34, 0.22, 0.01, 0.55, 1.18, 0.43, null);
      at(front, w - 0.1, 0.08, 0.02, 0, 0.92, -0.46); at(front, w - 0.1, 0.05, 0.02, 0, 0.1, -0.46);
      segs.push([P(-w / 2, -0.5)[0], P(-w / 2, -0.5)[1], P(w / 2, -0.5)[0], P(w / 2, -0.5)[1]]);
      return P(0, 0.75); // where the DJ stands
    },
    stack(x, z, h = 2.4, ry = 0) { B('kit', 1.0, h, 0.8, x, h / 2, z, hex('#121214'), [0, ry, 0]); for (let k = 0; k < Math.floor(h / 0.6); k++) add('metal', xf(cyl(0.02, 0.2, 0.2, 14), { r: [Math.PI / 2, 0, 0], t: [x, 0.35 + k * 0.6, z - 0.41] }), hex('#3a3b40')); segs.push([x - 0.5, z - 0.4, x + 0.5, z - 0.4]); },
    bar(x0, z0, x1, z1, { top = '#8a8580', body = '#1c1a1a', back = true, glow = 'barGlow', stools = 0, stool = '#d23c5a', side = 1 } = {}) { // counter from (x0,z0) to (x1,z1); staff side = `side` normal
      const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, nx = Math.cos(ry) * side, nz = -Math.sin(ry) * side;
      B('kit', 0.75, 1.08, L, cx, 0.54, cz, hex(body), [0, ry, 0]); B('metal', 0.95, 0.06, L + 0.1, cx, 1.11, cz, hex(top), [0, ry, 0]);
      B(glow, 0.02, 0.05, L, cx - nx * 0.38, 0.95, cz - nz * 0.38, null, [0, ry, 0]);
      if (back) { B('kit', 0.4, 2.3, L, cx + nx * 1.6, 1.15, cz + nz * 1.6, hex('#141313'), [0, ry, 0]);
        for (let k = 0; k < Math.floor(L / 0.32); k++) for (let j = 0; j < 2; j++) { const t = (k + 0.5) / Math.floor(L / 0.32) - 0.5; add('bottle', xf(cyl(0.26, 0.035, 0.045, 6), { t: [cx + nx * 1.42 + Math.sin(ry) * t * L, 1.3 + j * 0.5, cz + nz * 1.42 + Math.cos(ry) * t * L] })); } }
      for (let k = 0; k < stools; k++) { const t = (k + 0.5) / stools - 0.5, sx = cx - nx * 0.85 + Math.sin(ry) * t * L, sz = cz - nz * 0.85 + Math.cos(ry) * t * L;
        add('metal', xf(cyl(0.75, 0.03, 0.03, 8), { t: [sx, 0.38, sz] }), hex('#2a2b30')); add('kit', xf(cyl(0.07, 0.2, 0.2, 14), { t: [sx, 0.78, sz] }), hex(stool)); add('metal', xf(torus(0.34, 0.02, 14), { t: [sx, 0.3, sz] }), hex('#2a2b30')); }
      segs.push([x0 - nx * 0.45, z0 - nz * 0.45, x1 - nx * 0.45, z1 - nz * 0.45]);
      return { x: cx - nx * 1.3, z: cz - nz * 1.3, ry, face: Math.atan2(nx, nz) };
    },
    barrier(x0, x1, z) { for (let x = x0; x < x1 - 0.5; x += 2.2) { B('metal', 2.1, 0.06, 0.06, x + 1.05, 1.15, z, hex('#9aa0a8')); B('metal', 2.1, 0.06, 0.06, x + 1.05, 0.15, z, hex('#9aa0a8')); for (let k = 0; k <= 12; k++) B('metal', 0.025, 1.0, 0.025, x + k * 0.175, 0.65, z, hex('#9aa0a8')); } segs.push([x0, z, x1, z]); },
    truss(x0, x1, z, y, legs = true) { const L = x1 - x0; for (const dy of [0, 0.4]) for (const dz of [-0.2, 0.2]) B('metal', L, 0.05, 0.05, (x0 + x1) / 2, y + dy, z + dz, hex('#2a2b30'));
      for (let k = 0; k <= Math.floor(L / 0.5); k++) B('metal', 0.03, 0.42, 0.42, x0 + k * 0.5, y + 0.2, z, hex('#2a2b30'), [k % 2 ? 0.78 : -0.78, 0, 0]);
      if (legs) for (const x of [x0, x1]) { for (const dx of [-0.2, 0.2]) for (const dz of [-0.2, 0.2]) B('metal', 0.05, y, 0.05, x + dx, y / 2, z + dz, hex('#2a2b30')); segs.push([x - 0.3, z - 0.3, x + 0.3, z - 0.3]); } },
    plant(x, z, s = 1) { add('kit', xf(cyl(0.5 * s, 0.28 * s, 0.22 * s, 10), { t: [x, 0.25 * s, z] }), hex('#2a2422')); for (let k = 0; k < 7; k++) { const a = R() * 6.3, r = R() * 0.25 * s; add('leaf', xf(sphere(6), { s: [0.32 * s, 0.4 * s, 0.32 * s], t: [x + Math.cos(a) * r, (0.75 + R() * 0.9) * s, z + Math.sin(a) * r] }), hex(R() < 0.5 ? '#2f6b3a' : '#3f8a46')); } segs.push([x - 0.3, z, x + 0.3, z]); },
    haze(n, w, h, z0, dz, y0) { return { n, w, h, z0, dz, y0 }; },
  };
}

// ---------------------------------------------------------------- venue specs
// Each spec(scene, K, R, ctx) adds geometry into K and returns { size, crowd area, lights rig, plan, dj, extra update }.
const SPECS = {
  // THE WARE-HOUSE XL: Common Market, 16-20 Dunbar St. Black two-storey ex-fruit warehouse: steel portal frames, concrete
  // floor, a long CDJ table on a low stage behind a steel crowd barrier, truss with red LED bars + vertical red strips,
  // cyan/blue lasers + movers in thick haze (Reckless gallery: WARE-HOUSE XL HALLOWEEN / XL 003). Street-food bars by day.
  warehousexl(scene, K, R) {
    const W = 24, D = 30, H = 9;
    K.shell(W, D, H, { floor: '#5f5f62', wall: '#0e0e10', gapX: 2.0 });
    for (let z = 3; z < D; z += 4.5) { for (const sd of [-1, 1]) K.B('metal', 0.35, H, 0.35, sd * (W / 2 - 0.2), H / 2, z, hex('#1d1e22')); K.B('metal', W, 0.5, 0.3, 0, H - 0.3, z, hex('#1d1e22'));
      for (const sd of [-1, 1]) K.B('metal', W / 2, 0.12, 0.12, sd * W / 4, H - 0.9, z, hex('#1d1e22'), [0, 0, sd * 0.12]); }
    for (let x = -W / 2 + 1; x < W / 2; x += 1.1) K.B('wall', 0.08, H - 1, 0.06, x, (H - 1) / 2, D - 0.02, hex('#151518')); // corrugated back wall ribs
    for (let z = 1; z < D; z += 1.1) for (const sd of [-1, 1]) K.B('wall', 0.06, H - 1, 0.08, sd * (W / 2 - 0.02), (H - 1) / 2, z, hex('#151518'));
    K.B('kit', 16, 1.0, 5, 0, 0.5, D - 2.5, hex('#111113')); K.segs.push([-8, D - 5, 8, D - 5]); // stage
    const dj = K.booth(0, D - 3.2, { w: 4.2, y: 1.0, front: 'ledR' });
    K.stack(-7.2, D - 4.4, 3.0); K.stack(7.2, D - 4.4, 3.0); K.stack(-9.6, D - 2, 3.6); K.stack(9.6, D - 2, 3.6);
    K.barrier(-8, 8, D - 6.2);
    K.truss(-7.5, 7.5, D - 4.0, 6.4); K.truss(-7.5, 7.5, D - 1.2, 6.4, false);
    for (let k = 0; k < 10; k++) K.B('ledR', 1.1, 0.1, 0.1, -6.3 + k * 1.4, 6.3, D - 4.25);
    for (const x of [-7.5, 7.5]) K.B('ledR', 0.08, 5.8, 0.08, x, 3.1, D - 4.25);
    for (let k = 0; k < 6; k++) K.B('ledR', 0.08, 3.6, 0.08, -9 + k * 3.6, 6.8, D - 0.3); // vertical red strips on the back wall
    const b1 = K.bar(-W / 2 + 1.4, 6, -W / 2 + 1.4, 15, { side: -1, stools: 0, glow: 'barGlow' });
    const b2 = K.bar(W / 2 - 1.4, 5, W / 2 - 1.4, 11, { side: 1, glow: 'barGlow' });
    // mezzanine along the right wall (the warehouse is two storeys)
    K.B('kit', 4, 0.3, 12, W / 2 - 2, 3.3, 16, hex('#18181b')); for (let z = 10; z <= 22; z += 2) K.B('metal', 0.2, 3.2, 0.2, W / 2 - 4, 1.6, z, hex('#2a2b30'));
    K.B('metal', 0.05, 1.0, 12, W / 2 - 4, 3.95, 16, hex('#9aa0a8')); K.B('metal', 0.05, 0.05, 12, W / 2 - 4, 4.45, 16, hex('#9aa0a8'));
    for (let z = 10; z <= 22; z += 2) K.segs.push([W / 2 - 4.1, z - 0.1, W / 2 - 3.9, z + 0.1]);
    return { W, D, H, dj, crowd: { n: 150, x: [-10, 10], z: [6, D - 6.8] }, floorZ: [3, D - 6.3], bars: [b1, b2],
      rig: { movers: [-6, -3.6, -1.2, 1.2, 3.6, 6].map(x => [x, 6.6, D - 4.0]), moverCol: '#7fe9ff', lasers: { at: [0, 2.0, D - 3.6], n: 10, col: '#2a7bff' }, washCol: '#ff1a2a', hemi: 0.35, fog: [0.022, '#0a0f1c'] },
      plan: [{ x: -8, z: D - 5, w: 16, d: 5, c: '#fff', t: 'STAGE' }, { x: -W / 2 + 0.9, z: 6, w: 1, d: 9, c: '#ff2a3c', t: 'BAR' }, { x: W / 2 - 1.9, z: 5, w: 1, d: 6, c: '#ff2a3c', t: 'BAR' }, { x: W / 2 - 4, z: 10, w: 4, d: 12, c: '#333', t: 'MEZZ' }] };
  },
  // TERMINUS: HALT, ex-Europa Bus Centre, 10 Glengall St. The old waiting hall: speckled terrazzo, low panelled ceiling,
  // a teal panelled bar with pink-red high stools, one ticket booth turned cocktail bar, the station clock, timber slat
  // walls with planting, a painted mural wall; the DJ in among the crowd under red light (TERMINUS gallery).
  terminus(scene, K, R) {
    const W = 22, D = 24, H = 4.6;
    K.shell(W, D, H, { floor: '#bdb6aa', wall: '#24302f', ceil: '#9a9a96', gapX: 2.2 });
    for (let x = -W / 2 + 1.5; x < W / 2; x += 3) K.B('trim', 0.08, 0.06, D, x, H - 0.04, D / 2, hex('#5a5a58'));
    for (let z = 1.5; z < D; z += 3) K.B('trim', W, 0.06, 0.08, 0, H - 0.04, z, hex('#5a5a58'));
    for (let x = -W / 2 + 3; x < W / 2 - 1; x += 3) for (let z = 3; z < D - 1; z += 3) K.B('ceilLED', 0.6, 0.03, 0.6, x, H - 0.03, z);
    for (const [x, z] of [[-4, 8], [4, 8], [-4, 16], [4, 16]]) { K.B('wall', 0.6, H, 0.6, x, H / 2, z, hex('#d9d4c8')); K.segs.push([x - 0.3, z - 0.3, x + 0.3, z + 0.3]); }
    for (let z = 0.4; z < D - 0.2; z += 0.16) K.B('wood', 0.06, H - 0.4, 0.09, -W / 2 + 0.06, (H - 0.4) / 2, z, hex(R() < 0.5 ? '#7a5434' : '#8a6040')); // timber slat wall
    for (let z = 3; z < D - 2; z += 2.6) K.plant(-W / 2 + 0.8, z, 1.1);
    const b1 = K.bar(-6.5, 4, -6.5, 12, { side: -1, body: '#1d5f63', top: '#d8d2c6', stools: 7, stool: '#d4364f', glow: 'barGlowT' });
    // ticket booth cocktail bar (front right): glazed kiosk with a TICKETS fascia
    K.B('kit', 3.6, 1.1, 2.4, 7.2, 0.55, 3.6, hex('#1d5f63')); K.B('glass', 0.04, 1.4, 2.4, 5.42, 1.8, 3.6); K.B('kit', 3.6, 0.6, 2.4, 7.2, 2.9, 3.6, hex('#d9d4c8'));
    K.B('tickets', 0.02, 0.4, 2.2, 5.38, 2.9, 3.6); K.segs.push([5.4, 2.4, 5.4, 4.8], [5.4, 2.4, 9, 2.4], [5.4, 4.8, 9, 4.8]);
    // station clock on the back wall + mural on the right wall
    K.add('metal', xf(cyl(0.12, 0.62, 0.62, 28), { r: [Math.PI / 2, 0, 0], t: [0, 3.3, D - 0.08] }), hex('#22252a')); K.add('clockF', xf(cyl(0.02, 0.55, 0.55, 28), { r: [Math.PI / 2, 0, 0], t: [0, 3.3, D - 0.15] }));
    K.B('kit', 0.04, 0.36, 0.03, 0, 3.42, D - 0.17, hex('#111')); K.B('kit', 0.26, 0.03, 0.03, 0.1, 3.3, D - 0.17, hex('#111'));
    K.add('mural', xf(planeR(D - 4, H - 1.2), { r: [0, -Math.PI / 2, 0], t: [W / 2 - 0.02, (H - 1.2) / 2 + 0.4, D / 2 + 1] }));
    K.B('kit', 1.5, 1.1, 0.6, 3.6, 0.55, 1.2, hex('#ff6fb0')); // the pink public piano
    const dj = K.booth(0, D - 7, { w: 3.0, y: 0.3, front: 'ledR' }); K.B('kit', 5, 0.3, 3.2, 0, 0.15, D - 6.6, hex('#161616'));
    K.stack(-3.2, D - 6.2, 1.8); K.stack(3.2, D - 6.2, 1.8);
    return { W, D, H, dj, crowd: { n: 110, x: [-9, 9], z: [6, D - 2], avoid: (x, z) => Math.abs(x) < 2.8 && z > D - 8.6 && z < D - 5 }, floorZ: [5, D - 1], bars: [b1, { x: 5.0, z: 3.6, ry: -Math.PI / 2 }],
      rig: { movers: [-6, -2, 2, 6].map(x => [x, H - 0.3, D - 10]), moverCol: '#ff3048', washCol: '#ff1a2a', hemi: 0.5, fog: [0.03, '#1a0608'], par: true },
      plan: [{ x: -2.5, z: D - 8.2, w: 5, d: 3.2, c: '#fff', t: 'DJ' }, { x: -7, z: 4, w: 1, d: 8, c: '#ff2a3c', t: 'BAR' }, { x: 5.4, z: 2.4, w: 3.6, d: 2.4, c: '#1d5f63', t: 'TICKETS' }] };
  },
  // THOMPSONS: Thompsons Garage, 3 Patterson's Place. Black box club: a two-tier dancefloor (raised tier by the door with a
  // rail), the booth front-and-centre on a low stage, a 5 x 2 m LED screen behind the DJ, big stacks either side,
  // pixel-LED ceiling, upstairs + downstairs bars (club site: Funktion-One, Avolites, Resolume, 5x2 m LED screen).
  thompsons(scene, K, R) {
    const W = 18, D = 26, H = 6;
    K.shell(W, D, H, { floor: '#2a2a2e', wall: '#0c0c0e', ceil: '#0a0a0c', gapX: 1.8 });
    K.B('kit', W, 0.6, 6, 0, 0.3, 4.4, hex('#18181b')); // raised tier by the door
    K.B('metal', W - 6, 0.05, 0.05, 1.5, 1.6, 7.4, hex('#c9ced6')); for (let x = -4.5; x <= 7.5; x += 1.5) K.B('metal', 0.04, 1.0, 0.04, x, 1.1, 7.4, hex('#c9ced6'));
    K.segs.push([-4.5, 7.4, 7.5, 7.4]); K.B('kit', 3, 0.3, 1.2, -6, 0.15, 7.9, hex('#18181b'));
    K.B('kit', 8, 0.5, 4, 0, 0.25, D - 2.6, hex('#111113')); K.segs.push([-4, D - 4.6, 4, D - 4.6]);
    const dj = K.booth(0, D - 3.4, { w: 3.4, y: 0.5, front: 'ledW' });
    K.B('kit', 5.4, 2.4, 0.2, 0, 2.9, D - 0.25, hex('#050505')); K.add('screen', xf(planeR(5, 2), { r: [0, Math.PI, 0], t: [0, 2.9, D - 0.37] }));
    K.stack(-5.5, D - 3, 3.4); K.stack(5.5, D - 3, 3.4); K.stack(-7.5, 10, 2.4); K.stack(7.5, 10, 2.4);
    for (let x = -W / 2 + 1; x < W / 2; x += 1) for (let z = 9; z < D - 4; z += 1) K.B('ceilPix', 0.12, 0.02, 0.12, x, H - 0.02, z);
    const b1 = K.bar(-W / 2 + 1.2, 9.5, -W / 2 + 1.2, 16, { side: -1, top: '#c9ced6', glow: 'barGlowW', stools: 0 });
    const b2 = K.bar(W / 2 - 1.2, 2.2, W / 2 - 1.2, 6.2, { side: 1, top: '#c9ced6', glow: 'barGlowW' });
    return { W, D, H, dj, crowd: { n: 130, x: [-7.5, 7.5], z: [8.5, D - 5.2] }, floorZ: [8, D - 4.6], bars: [b1, b2], tierZ: [1.4, 7.4, 0.6],
      rig: { movers: [-6, -3, 0, 3, 6].map(x => [x, H - 0.4, D - 6]), moverCol: '#ffffff', lasers: { at: [0, 4.6, D - 1.2], n: 6, col: '#38ff7a' }, washCol: '#4a2bff', hemi: 0.5, fog: [0.026, '#08060f'], strobe: true },
      plan: [{ x: -4, z: D - 4.6, w: 8, d: 4, c: '#fff', t: 'STAGE' }, { x: -W / 2, z: 1.4, w: W, d: 6, c: '#2a2a2e', t: 'TIER' }, { x: -W / 2 + 0.7, z: 9.5, w: 1, d: 6.5, c: '#ff2a3c', t: 'BAR' }] };
  },
  // THE WARE-HOUSE (nostalgia): the old Palm House, now Three Sheets, 1 Bankmore Sq (Marcus Ward building). Warm timber slat
  // ceiling with copper ducting, pool tables, cafe tables + green chairs, planting, arcade cabinets, bar at the back,
  // and for the night a booth in the corner under amber + red (Three Sheets opening photos; past Palm House raves).
  warehouse(scene, K, R) {
    const W = 20, D = 22, H = 5;
    K.shell(W, D, H, { floor: '#d8c8b0', wall: '#3a2c24', gapX: 1.8 });
    for (let x = -W / 2 + 0.2; x < W / 2; x += 0.22) K.B('wood', 0.12, 0.16, D, x, H - 0.4, D / 2, hex(R() < 0.5 ? '#8a5a34' : '#9b6a40'));
    for (const x of [-5, 0, 5]) K.add('copper', xf(cyl(D, 0.28, 0.28, 16), { r: [Math.PI / 2, 0, 0], t: [x, H - 1.0, D / 2] }));
    for (const [x, z] of [[-6, 6], [-6, 11]]) { K.B('wood', 2.6, 0.18, 1.5, x, 0.82, z, hex('#5a3a22')); K.B('felt', 2.36, 0.02, 1.28, x, 0.92, z); for (const dx of [-1.1, 1.1]) for (const dz of [-0.6, 0.6]) K.B('wood', 0.12, 0.75, 0.12, x + dx, 0.38, z + dz, hex('#3d2716'));
      K.add('lamp', xf(cyl(0.25, 0.25, 0.4, 14), { t: [x, 2.2, z] })); K.segs.push([x - 1.3, z - 0.75, x + 1.3, z - 0.75], [x - 1.3, z + 0.75, x + 1.3, z + 0.75]); }
    for (const [x, z] of [[-2, 3.5], [1.5, 3.5], [-8, 15.5]]) { K.add('metal', xf(cyl(0.05, 0.45, 0.45, 18), { t: [x, 0.75, z] }), hex('#e8e2d6')); K.add('metal', xf(cyl(0.72, 0.04, 0.04, 8), { t: [x, 0.37, z] }), hex('#2a2b30'));
      for (let k = 0; k < 3; k++) { const a = k * 2.1; K.B('kit', 0.42, 0.45, 0.42, x + Math.cos(a) * 0.75, 0.23, z + Math.sin(a) * 0.75, hex('#5f8f4a')); K.B('kit', 0.42, 0.45, 0.08, x + Math.cos(a) * 0.95, 0.65, z + Math.sin(a) * 0.95, hex('#5f8f4a'), [0, -a + Math.PI / 2, 0]); } }
    for (let k = 0; k < 4; k++) { const z = 3 + k * 1.2; K.B('kit', 0.8, 1.8, 0.9, W / 2 - 0.6, 0.9, z, hex('#141418')); K.B('arcade', 0.02, 0.5, 0.6, W / 2 - 1.01, 1.35, z); K.B('neonP', 0.02, 0.12, 0.7, W / 2 - 1.01, 1.72, z); }
    K.segs.push([W / 2 - 1.05, 2.4, W / 2 - 1.05, 7.8]);
    for (const [x, z] of [[-W / 2 + 0.7, 2], [-W / 2 + 0.7, 18], [W / 2 - 0.7, 9], [W / 2 - 0.7, 19]]) K.plant(x, z, 1.2);
    const b1 = K.bar(3, D - 2.2, 9, D - 2.2, { side: 1, body: '#3d2716', top: '#c49a5a', stools: 6, stool: '#5f8f4a', glow: 'barGlowA' });
    const dj = K.booth(-5.5, D - 2.4, { w: 3.0, y: 0.4, front: 'ledA' }); K.B('kit', 5, 0.4, 3, -5.5, 0.2, D - 2.2, hex('#2a1e18')); K.stack(-8.6, D - 2.4, 2.0); K.stack(-2.4, D - 2.4, 2.0);
    K.B('estSign', 0.02, 0.9, 5, -W / 2 + 0.03, 3.4, 11);
    return { W, D, H, dj, crowd: { n: 95, x: [-8.5, 8], z: [9.5, D - 4.2], avoid: (x, z) => (x < -3.8 && z < 12.6) || Math.hypot(x + 8, z - 15.5) < 1.6 }, floorZ: [9, D - 3.8], bars: [b1],
      rig: { movers: [-8, -5.5, -3].map(x => [x, H - 0.5, D - 5]), moverCol: '#ffb04a', washCol: '#ff5a10', hemi: 1.0, fog: [0.02, '#1c1008'], warm: true },
      plan: [{ x: -8, z: D - 3.7, w: 5, d: 3, c: '#fff', t: 'DJ' }, { x: 3, z: D - 2.7, w: 6, d: 1, c: '#ff2a3c', t: 'BAR' }, { x: -7.3, z: 5.2, w: 2.6, d: 6.6, c: '#2e6b3a', t: 'POOL' }, { x: W / 2 - 1, z: 2.4, w: 1, d: 5, c: '#d24ad6', t: 'ARCADE' }] };
  },
  // LOCATION X: 149 Lisburn Rd (Ma Nelsons, then Cuckoo, now Happy's). A narrow terrace bar-club: jam-jar cocktail bar
  // down one side, arcade with a dance-mat machine, glass karaoke booth at the back, small dancefloor under a mirror ball,
  // booth against the back wall, pink/purple neon (Cuckoo site description).
  locationx(scene, K, R) {
    const W = 11, D = 20, H = 3.8;
    K.shell(W, D, H, { floor: '#2b2326', wall: '#1a1220', ceil: '#120c14', gapX: 1.4 });
    const b1 = K.bar(-W / 2 + 1.2, 2.5, -W / 2 + 1.2, 10, { side: -1, body: '#2a1830', top: '#e6c8ff', stools: 6, stool: '#ff3aa0', glow: 'barGlowP' });
    for (let z = 2.6; z < 10; z += 0.5) K.add('jar', xf(cyl(0.12, 0.05, 0.05, 8), { t: [-W / 2 + 1.25, 1.2, z] }));
    K.B('neonP', 0.02, 0.06, 7, -W / 2 + 0.04, 2.9, 6.2); K.B('neonC', 0.02, 0.06, 7, -W / 2 + 0.04, 3.1, 6.2);
    for (let k = 0; k < 2; k++) { const z = 3 + k * 1.3; K.B('kit', 0.8, 1.8, 0.9, W / 2 - 0.6, 0.9, z, hex('#141418')); K.B('arcade', 0.02, 0.5, 0.6, W / 2 - 1.01, 1.35, z); }
    K.B('kit', 1.2, 2.1, 1.0, W / 2 - 0.8, 1.05, 6.2, hex('#1b1b22')); K.B('arcade', 0.02, 0.6, 0.8, W / 2 - 1.41, 1.5, 6.2); // dance-mat machine
    for (let i = 0; i < 4; i++) K.B('pad' + i, 0.3, 0.03, 0.3, W / 2 - 1.9 + (i % 2 ? 0.34 : -0.34) * (i < 2 ? 1 : 0), 0.02, 6.2 + (i === 2 ? 0.34 : i === 3 ? -0.34 : 0));
    K.segs.push([W / 2 - 1.05, 2.4, W / 2 - 1.05, 7]);
    K.B('glass', 3.6, 2.4, 0.05, W / 2 - 1.9, 1.2, D - 3.6); K.B('glass', 0.05, 2.4, 3.4, W / 2 - 3.7, 1.2, D - 1.9); K.B('neonC', 3.0, 0.05, 0.02, W / 2 - 1.9, 2.3, D - 3.64);
    K.segs.push([W / 2 - 3.7, D - 3.6, W / 2, D - 3.6], [W / 2 - 3.7, D - 3.6, W / 2 - 3.7, D]);
    const dj = K.booth(-1.6, D - 1.4, { w: 2.6, y: 0.2, front: 'ledP' }); K.B('kit', 4, 0.2, 2.2, -1.6, 0.1, D - 1.2, hex('#161018')); K.stack(-4.4, D - 1.2, 1.8);
    K.add('ball', xf(sphere(14), { s: [0.35, 0.35, 0.35], t: [-0.5, H - 0.7, 13] })); K.B('metal', 0.02, 0.4, 0.02, -0.5, H - 0.2, 13, hex('#888'));
    return { W, D, H, dj, crowd: { n: 60, x: [-3.6, 2.8], z: [10.5, D - 3.2] }, floorZ: [10, D - 2.6], bars: [b1], ball: [-0.5, H - 0.7, 13],
      rig: { movers: [-3, 1].map(x => [x, H - 0.3, D - 4]), moverCol: '#ff4ad8', washCol: '#b01aff', hemi: 0.55, fog: [0.03, '#14061a'] },
      plan: [{ x: -3, z: D - 2.6, w: 3, d: 2.2, c: '#fff', t: 'DJ' }, { x: -W / 2 + 0.7, z: 2.5, w: 1, d: 7.5, c: '#ff2a3c', t: 'BAR' }, { x: W / 2 - 3.7, z: D - 3.6, w: 3.7, d: 3.6, c: '#5a2a7a', t: 'KARAOKE' }, { x: W / 2 - 1, z: 2.4, w: 1, d: 4.6, c: '#d24ad6', t: 'ARCADE' }] };
  },
};
export const CLUB_IDS = Object.keys(SPECS);

// ---------------------------------------------------------------- build
export function buildClub(scene, id, { index = 0, low = false, posters = [], venue }) {
  const OFF = new Vector3(4400 + index * 400, 0, 0);
  const root = new TransformNode('club-' + id, scene); root.position.copyFrom(OFF);
  const R = rng(17 + index * 7);
  const K = kit(scene, root, R);
  const S = SPECS[id](scene, K, R);
  // exit door + sign, and real Reckless posters by the entrance
  K.B('door', 2.6, 2.5, 0.06, 0, 1.25, -0.02); K.add('exit', xf(planeR(1.4, 0.5), { t: [0, 3.0 > S.H - 0.4 ? S.H - 0.5 : 3.0, 0.12] }));
  const mats = {
    floor: mat(scene, id + '-floor', { s: new Color3(0.25, 0.25, 0.25), p: 60 }), wall: mat(scene, id + '-wall'), ceil: mat(scene, id + '-ceil'), metal: mat(scene, id + '-metal', { s: new Color3(0.5, 0.5, 0.55), p: 50 }),
    kit: mat(scene, id + '-kit', { s: new Color3(0.2, 0.2, 0.2), p: 40 }), wood: mat(scene, id + '-wood'), trim: mat(scene, id + '-trim'), leaf: mat(scene, id + '-leaf'),
    scr: mat(scene, id + '-scr', { unlit: true, e: hex('#8fd0ff'), d: Color3.Black() }), kitR: mat(scene, id + '-kitR', { unlit: true, e: hex('#ff3a2a'), d: Color3.Black() }),
    ledR: mat(scene, id + '-ledR', { unlit: true, e: hex('#ff1a2a'), d: Color3.Black() }), ledW: mat(scene, id + '-ledW', { unlit: true, e: hex('#ffffff'), d: Color3.Black() }),
    ledA: mat(scene, id + '-ledA', { unlit: true, e: hex('#ffa040'), d: Color3.Black() }), ledP: mat(scene, id + '-ledP', { unlit: true, e: hex('#ff3ad0'), d: Color3.Black() }),
    barGlow: mat(scene, id + '-bg', { unlit: true, e: hex('#ff2a3a'), d: Color3.Black() }), barGlowT: mat(scene, id + '-bgt', { unlit: true, e: hex('#ff5a7a'), d: Color3.Black() }),
    barGlowW: mat(scene, id + '-bgw', { unlit: true, e: hex('#d8e4ff'), d: Color3.Black() }), barGlowA: mat(scene, id + '-bga', { unlit: true, e: hex('#ffb060'), d: Color3.Black() }), barGlowP: mat(scene, id + '-bgp', { unlit: true, e: hex('#ff3ad0'), d: Color3.Black() }),
    bottle: mat(scene, id + '-bot', { unlit: true, e: hex('#ffd8a0'), d: Color3.Black() }), glass: mat(scene, id + '-glass', { d: hex('#1a2a30'), s: new Color3(0.9, 0.9, 0.9), p: 90 }),
    ceilLED: mat(scene, id + '-cled', { unlit: true, e: hex('#ffe6d0'), d: Color3.Black() }), ceilPix: mat(scene, id + '-cpix', { unlit: true, e: hex('#6040ff'), d: Color3.Black() }),
    door: mat(scene, id + '-door', { d: hex('#2b3a30'), e: hex('#24402e') }), copper: mat(scene, id + '-copper', { d: hex('#b8734a'), s: new Color3(0.8, 0.5, 0.35), p: 40 }),
    felt: mat(scene, id + '-felt', { d: hex('#1f6b3a') }), lamp: mat(scene, id + '-lamp', { unlit: true, e: hex('#ffd890'), d: Color3.Black() }),
    arcade: mat(scene, id + '-arc', { unlit: true, e: hex('#40d0ff'), d: Color3.Black() }), neonP: mat(scene, id + '-np', { unlit: true, e: hex('#ff2ad0'), d: Color3.Black() }), neonC: mat(scene, id + '-nc', { unlit: true, e: hex('#30e0ff'), d: Color3.Black() }),
    jar: mat(scene, id + '-jar', { unlit: true, e: hex('#ffc06a'), d: Color3.Black() }), ball: mat(scene, id + '-ball', { d: hex('#c9ced6'), s: new Color3(1, 1, 1), p: 128, e: hex('#404048') }),
    clockF: mat(scene, id + '-clk', { unlit: true, e: hex('#f2efe6'), d: Color3.Black() }),
  };
  for (let i = 0; i < 4; i++) mats['pad' + i] = mat(scene, id + '-pad' + i, { unlit: true, e: hex(['#ff2a6a', '#2ad0ff', '#ffe02a', '#6aff2a'][i]), d: Color3.Black() });
  // textures: terrazzo / concrete floor, mural, signs, LED screen
  if (id === 'terminus') mats.floor.diffuseTexture = speckle(scene, id + '-terrazzo', '#c9c2b4', ['#7a746a', '#e8e2d4', '#a35d3d', '#4a5a5c', '#ddd2b8'], 5000, 512, 5);
  else if (id === 'warehouse') mats.floor.diffuseTexture = canvasTex(scene, id + '-planks', 512, 512, (c, w, h) => { const Rp = rng(23); for (let y = 0; y < h; y += 32) for (let x = -Math.floor(Rp() * 200); x < w; x += 200) { const k = Rp(); c.fillStyle = k < 0.33 ? '#9a6a42' : k < 0.66 ? '#a8774c' : '#8a5c38'; c.fillRect(x, y, 198, 30); c.fillStyle = 'rgba(60,35,20,0.25)'; for (let g = 0; g < 6; g++) c.fillRect(x + Rp() * 190, y + 4 + Rp() * 22, 30 + Rp() * 60, 1.5); } });
  else mats.floor.diffuseTexture = speckle(scene, id + '-conc', '#8a8a8a', ['#7a7a7a', '#999', '#6a6a6a'], 900, 256, 9);
  mats.floor.diffuseTexture.uScale = mats.floor.diffuseTexture.vScale = id === 'terminus' ? 4 : id === 'warehouse' ? 5 : 6;
  const um = (k, tex) => { const m = mat(scene, id + '-' + k, { unlit: true, two: true, d: Color3.Black() }); m.emissiveTexture = tex; mats[k] = m; return m; };
  um('exit', signTex(scene, '⟵ EXIT', { bg: '#11a84a', w: 256, h: 96 }));
  um('tickets', signTex(scene, 'TICKETS · COCKTAILS', { fg: '#1d5f63', bg: '#f2efe6', w: 1024, h: 160, frame: false }));
  um('estSign', signTex(scene, 'THE WARE-HOUSE · EST.', { fg: '#ffd890', bg: '#1a120c', w: 1024, h: 180 }));
  um('mural', canvasTex(scene, id + '-mural', 1024, 256, (c, w, h) => { const Rm = rng(41); c.fillStyle = '#20303a'; c.fillRect(0, 0, w, h); const cols = ['#ff6f3c', '#ffd23c', '#3cc8ff', '#ff3c8a', '#5fe07a', '#ffffff'];
    for (let i = 0; i < 26; i++) { c.fillStyle = cols[i % cols.length]; c.globalAlpha = 0.85; c.beginPath(); c.ellipse(Rm() * w, Rm() * h, 30 + Rm() * 120, 20 + Rm() * 70, Rm() * 3, 0, 7); c.fill(); }
    c.globalAlpha = 1; c.fillStyle = '#fff'; c.font = '800 64px Unbounded'; c.textAlign = 'center'; c.fillText('ALL ABOARD', w / 2, h / 2 + 20); }));
  let scrT = null; if (id === 'thompsons') { scrT = new DynamicTexture(id + '-screen', { width: 320, height: 128 }, scene, true); um('screen', scrT); }
  // merge static geometry per material
  const meshes = {};
  for (const [k, list] of Object.entries(K.G)) { if (!mats[k]) mats[k] = mat(scene, id + '-' + k); const me = toMesh(id + '-' + k, merge(list), scene, mats[k]); me.parent = root; me.isPickable = false; meshes[k] = me; }
  if (meshes.ball) meshes.ball.setPivotPoint(new Vector3(...S.ball));
  // posters: two real Reckless event posters either side of the door (inside face)
  posters.slice(0, 2).forEach((p, i) => { const pm = mat(scene, id + '-poster' + i, { unlit: true }); pm.emissiveTexture = new Texture(BASE + p.file, scene, false, true); pm.emissiveTexture.level = 0.75; pm.emissiveColor = Color3.Black();
    const pl = toMesh(id + '-posterM' + i, planeR(1.2, 1.6), scene, pm); pl.parent = root; pl.position.set((i ? 1 : -1) * (Math.min(S.W / 2 - 1, 3.4)), 1.7, 0.05); pl.rotation.y = Math.PI; });
  // beams / lasers / haze
  const bT = beamTex(scene); const beams = [];
  const beamM = mat(scene, id + '-beam', { unlit: true, add: true, d: Color3.Black() }); beamM.opacityTexture = bT; beamM.emissiveColor = hex(S.rig.moverCol).scale(0.55);
  const beamGeo = merge([xf(cyl(22, 0.06, 1.8, 14, false), { t: [0, -11, 0] }), xf(cyl(22, 0.03, 0.5, 10, false), { t: [0, -11, 0] })]);
  S.rig.movers.forEach((p, i) => { const m = toMesh(id + '-mv' + i, beamGeo, scene, beamM); m.parent = root; m.position.set(...p); m.isPickable = false; beams.push({ m, i, kind: 'mh' });
  });
  const lasers = [];
  if (S.rig.lasers) { const lm = mat(scene, id + '-laser', { unlit: true, add: true, d: Color3.Black() }); lm.emissiveColor = hex(S.rig.lasers.col);
    const lg = xf(box(0.025, 0.025, 30), { t: [0, 0, -15] });
    for (let i = 0; i < S.rig.lasers.n; i++) { const m = toMesh(id + '-lz' + i, lg, scene, lm); m.parent = root; m.position.set(...S.rig.lasers.at); m.isPickable = false; lasers.push({ m, i }); } mats.laser = lm; }
  const washT = canvasTex(scene, id + '-washT', 64, 128, (c) => { const g = c.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 128); }); washT.hasAlpha = true;
  const washM = mat(scene, id + '-wash', { unlit: true, add: true, d: Color3.Black() }); washM.emissiveColor = hex(S.rig.washCol); washM.opacityTexture = washT;
  const washes = []; for (let k = 0; k < 6; k++) washes.push(xf(plane(S.W / 6, S.H * 0.8), { t: [-S.W / 2 + (k + 0.5) * S.W / 6, S.H * 0.4, S.D - 0.35] }));
  for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) washes.push(xf(plane(S.D / 5, S.H * 0.6), { r: [0, sd * Math.PI / 2, 0], t: [sd * (S.W / 2 - 0.35), S.H * 0.3, 3 + k * S.D / 4.4] }));
  const wash = toMesh(id + '-washM', merge(washes), scene, washM); wash.parent = root; wash.isPickable = false;
  const hazeT = canvasTex(scene, id + '-hazeT', 256, 256, (c) => { const Hh = rng(3); c.clearRect(0, 0, 256, 256); for (let i = 0; i < 60; i++) { const x = 70 + Hh() * 116, y = 80 + Hh() * 96, r = 25 + Hh() * 45; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256); } }); hazeT.hasAlpha = true;
  const hazeM = mat(scene, id + '-haze', { unlit: true, add: true, d: Color3.Black() }); hazeM.opacityTexture = hazeT; hazeM.emissiveColor = hex(S.rig.fog[1]).scale(1.4);
  const hazes = []; for (let k = 0; k < (low ? 3 : 6); k++) { const m = toMesh(id + '-hz' + k, plane(S.W, S.H * 1.1), scene, hazeM); m.parent = root; m.position.set((R() - 0.5) * 3, S.H * 0.5, 5 + k * (S.D - 6) / 6); m.isPickable = false; hazes.push(m); }
  // crowd slots
  // natural spread: dart-throwing with a minimum spacing (denser toward the booth), varied height, everyone faces the DJ
  const crowd = []; const CA = S.crowd, target = Math.round(CA.n * 0.6 * (low ? 0.6 : 1)), [djx, djz] = S.dj;
  const zs = CA.z[1] - CA.z[0], gap2 = (d) => crowd.every(c => (c.x - d.x) ** 2 + (c.z - d.z) ** 2 > d.r * d.r);
  for (let g = 0; g < target * 60 && crowd.length < target; g++) {
    const x = CA.x[0] + R() * (CA.x[1] - CA.x[0]), z = CA.z[0] + R() * zs, f = (z - CA.z[0]) / zs;
    if (R() > 0.35 + 0.65 * f) continue; if (CA.avoid && CA.avoid(x, z)) continue;
    if (Math.hypot(x - djx, z - djz) < 2.2) continue;
    const r = 0.95 + (1 - f) * 0.45 + R() * 0.35; if (!gap2({ x, z, r })) continue;
    const s0 = 0.93 + R() * 0.12; crowd.push({ x, z, ph: R() * 4, yaw: Math.atan2(djx - x, djz - z) + (R() - 0.5) * 0.6, s: s0, sy: s0 * (0.94 + R() * 0.13), v: Math.floor(R() * 6) }); }
  // lights
  const lights = { hemi: new HemisphericLight(id + '-hemi', new Vector3(0.2, 1, 0.1), scene), wash: new PointLight(id + '-wash', new Vector3(0, S.H - 1, S.D - 3).add(OFF), scene), front: new PointLight(id + '-front', new Vector3((S.crowd.x[0] + S.crowd.x[1]) / 2, S.H - 0.4, (S.crowd.z[0] + S.crowd.z[1]) / 2 + 1).add(OFF), scene) };
  lights.hemi.intensity = S.rig.hemi; lights.hemi.diffuse = S.rig.warm ? hex('#ffd2a0') : hex('#b8c0d8'); lights.hemi.groundColor = hex('#201820');
  lights.wash.diffuse = hex(S.rig.washCol); lights.wash.range = S.D * 1.1; lights.front.diffuse = Color3.Lerp(hex(S.rig.moverCol), Color3.White(), 0.45); lights.front.range = S.D * 0.9;
  for (const l of Object.values(lights)) l.setEnabled(false);
  const T = {
    club: true, id, name: venue.name, sub: venue.sub, root, crowd, lights, mode: 'rave', dancers: [], S, mats, meshes, beams, lasers, hazes, wash, scrT,
    segs: K.segs.map(([a, b, c, d]) => [a + OFF.x, b + OFF.z, c + OFF.x, d + OFF.z]),
    spawn: new Vector3(0, 0, 3.2).add(OFF), exitPos: new Vector3(0, 0, 1.2).add(OFF), origin: OFF,
    plan: { W: S.W, D: S.D, rects: S.plan }, bars: S.bars.map(b => ({ x: b.x + OFF.x, z: b.z + OFF.z, ry: b.ry, face: b.face })), djPos: S.dj,
    danceFloor: (p) => { const z = p.z - OFF.z, x = p.x - OFF.x; return z > S.floorZ[0] && z < S.floorZ[1] && Math.abs(x) < S.W / 2; },
    floorY: (x, z) => { const tz = S.tierZ; if (!tz) return 0; const lz = z - OFF.z; return lz > tz[0] && lz < tz[1] ? tz[2] : 0; },
    glowSkip: () => [...beams.map(b => b.m), ...lasers.map(l => l.m), ...hazes, wash, meshes.floor].filter(Boolean),
  };
  return T;
}

export function setClubMode(T, scene, mode) {
  T.mode = mode; const day = mode === 'day', S = T.S;
  T.beams.forEach(b => b.m.setEnabled(!day)); T.lasers.forEach(l => l.m.setEnabled(!day)); T.hazes.forEach(h => h.setEnabled(!day)); T.wash.setEnabled(!day);
  T.lights.hemi.intensity = day ? 1.1 : S.rig.hemi; T.lights.wash.setEnabled(!day); T.lights.front.setEnabled(!day);
  scene.clearColor = new Color4(0.01, 0.005, 0.02, 1);
  scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = day ? 0.006 : S.rig.fog[0]; scene.fogColor = day ? new Color3(0.3, 0.3, 0.3) : hex(S.rig.fog[1]);
}

// crowd + light show, same beat clock as the Temple (140 BPM)
const m4 = new Matrix(), q4 = new Quaternion(), v4 = new Vector3(), s4 = new Vector3();
export function updateClub(T, t, dt, CV) {
  const beat = t * 140 / 60, ph = beat % 1, kick = Math.exp(-ph * 5), S = T.S, M = T.mats;
  if (CV && T.mode === 'rave') {
    for (const it of CV.list) { it.n = 0; it.fn = 0; it.hn2 = 0; }
    const cp = T.cam ? T.cam.position : null, rp = T.root.position, FAR2 = (T.crowdFar || 12) ** 2, cmax = Math.min(T.crowdMax || 1e9, CV.cap || 1e9);
    T.crowd.forEach((c, ci) => {
      if (ci >= cmax) return; const it = CV.list[c.v * CV.poses + (Math.floor(beat * 2 + c.ph) % CV.poses)];
      const b = Math.max(0, Math.sin((beat + c.ph) * Math.PI)); const sway = Math.sin(beat * 0.5 * Math.PI + c.ph) * 0.12;
      Quaternion.FromEulerAnglesToRef(0, c.yaw + sway * 0.5, 0, q4); s4.set(c.s, c.sy || c.s, c.s); v4.set(c.x, b * 0.06, c.z); Matrix.ComposeToRef(s4, q4, v4, m4);
      const far = it.farReady && cp && ((c.x + rp.x - cp.x) ** 2 + (c.z + rp.z - cp.z) ** 2) > FAR2;
      if (far) { m4.copyToArray(it.far._buf, it.fn * 16); it.fn++; } else { m4.copyToArray(it.body._buf, it.n * 16); it.n++; }
      if (it.head) { m4.copyToArray(it.head._buf, it.hn2 * 16); it.hn2++; }
    });
    for (const it of CV.list) { it.body.thinInstanceCount = it.n; it.body.thinInstanceBufferUpdated('matrix'); if (it.far) { it.far.thinInstanceCount = it.fn; it.far.thinInstanceBufferUpdated('matrix'); } if (it.head) { it.head.thinInstanceCount = it.hn2; it.head.thinInstanceBufferUpdated('matrix'); } }
  }
  if (T.mode === 'day') return;
  const strobe = S.rig.strobe && (Math.floor(beat) % 16) >= 14 ? (Math.floor(beat * 4) % 2) : 0;
  const pulse = (m, c, k = 0.6) => { if (m) { const b = hex(c); m.emissiveColor.set(b.r * (0.55 + k * kick) + strobe, b.g * (0.55 + k * kick) + strobe, b.b * (0.55 + k * kick) + strobe); } };
  pulse(M.ledR, '#ff1a2a'); pulse(M.ledW, '#ffffff', 0.5); pulse(M.ledA, '#ffa040'); pulse(M.ledP, '#ff3ad0'); pulse(M.kitR, '#ff3a2a', 0.3);
  if (M.ceilPix) { const h = (beat * 0.125) % 1; M.ceilPix.emissiveColor.set(0.3 + 0.5 * Math.sin(h * 6.28) ** 2 + strobe, 0.1 + kick * 0.3 + strobe, 0.8 + strobe); }
  for (let i = 0; i < 4; i++) if (M['pad' + i]) M['pad' + i].alpha = 1, M['pad' + i].emissiveColor.scaleInPlace(0).addInPlace(hex(['#ff2a6a', '#2ad0ff', '#ffe02a', '#6aff2a'][i]).scale((Math.floor(beat) % 4) === i ? 1 : 0.18));
  const wc = hex(S.rig.washCol); T.wash.material.emissiveColor.set(wc.r * (0.35 + 0.3 * kick), wc.g * (0.35 + 0.3 * kick), wc.b * (0.35 + 0.3 * kick));
  T.beams.forEach(b => { const s = t * 0.9 + b.i * 0.8; b.m.rotation.x = 0.9 + Math.sin(s) * 0.4; b.m.rotation.z = Math.sin(s * 0.7 + b.i) * 0.7; b.m.visibility = (Math.floor(beat / 4 + b.i) % 3 ? 0.75 : 0.3) + 0.25 * kick; });
  T.lasers.forEach(l => { const n = T.lasers.length, a = (l.i / Math.max(1, n - 1) - 0.5) * 1.4; const sweep = Math.sin(t * 0.8) * 0.5; l.m.rotation.y = Math.PI + a + sweep; l.m.rotation.x = -0.08 - 0.12 * Math.sin(t * 0.5 + l.i); l.m.visibility = Math.floor(beat / 2) % 4 === 3 ? 0 : 0.9; });
  T.lights.wash.intensity = 0.6 + 0.8 * kick + strobe; T.lights.front.intensity = 0.8 + 0.35 * kick; T.lights.hemi.intensity = S.rig.hemi + strobe * 0.8;
  T.hazes.forEach((h, k) => { h.position.x = Math.sin(t * 0.07 + k) * 2; });
  if (T.meshes.ball) T.meshes.ball.rotation.y = t * 0.8;
  if (T.scrT && (T._scr = (T._scr || 0) + dt) > 0.08) { T._scr = 0; const c = T.scrT.getContext(), w = 320, h = 128; c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 9; k++) { const x = ((k * 40 + beat * 60) % (w + 40)) - 20; c.fillStyle = k % 2 ? `rgba(255,30,60,${0.4 + kick * 0.6})` : `rgba(90,60,255,${0.4 + kick * 0.5})`; c.fillRect(x, 0, 14, h); }
    c.fillStyle = '#fff'; c.font = '800 40px Unbounded'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.6 + 0.4 * kick; c.fillText('RECKLESS', w / 2, h / 2); c.globalAlpha = 1; T.scrT.update(); }
}
