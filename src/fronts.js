// Street frontages for the five other Reckless venues, at their real addresses (door point = the OSM facade nearest the
// venue). Each one is a painted facade (diffuse + night-glow canvas) laid over the city building, plus 3D extras: door,
// signage, awnings/balcony/blade sign and a queue barrier lane beside the door. Modelled from research/venue-refs/
// (modelling reference only, nothing from the photos is shipped).
// Local frame: x along the facade, +z out to the street, y up; the door is at x=0.
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { hex, rng, box, cyl, sphere, xf, merge, toMesh, plane } from './geo.js';
import { kit, mat } from './clubs.js';

const SPEC = {
  // COMMON MARKET (16-20 Dunbar St): white-rendered gable warehouse, black stencil name on the gable, wide black roller
  // door, black fascia band, butterfly mural to the right, picnic benches out front.
  warehousexl: { w: 18, h: 8.5, gable: 2.4, barrier: 'steel',
    paint(P) { const { wf, Hp } = P;
      P.fill('#e9e6df'); P.noise('#d8d4cb', 900, 0.12);
      P.r(-wf / 2, 3.15, wf / 2, 3.75, '#141414'); // fascia band
      P.text('COMMON MARKET · STREET FOOD · BARS', -wf / 2 + 4.2, 3.45, 0.26, '#f2f2f2');
      P.door(-3, 0, 3, 3.1, '#0c0c0e', '#ff2a3c'); // roller door opening, red rave glow inside
      for (let y = 2.75; y < 3.12; y += 0.07) P.r(-3, y, 3, y + 0.035, '#2a2a2e');
      P.win(-wf / 2 + 0.8, 0.6, -wf / 2 + 2.6, 2.6, true); P.win(-wf / 2 + 3.2, 0.6, -wf / 2 + 4.6, 2.6, false);
      P.win(-wf / 2 + 1.2, 4.6, -wf / 2 + 3.2, 6.0, true); P.win(-wf / 2 + 4.4, 4.6, -wf / 2 + 5.8, 6.0, false);
      // mural (right): warm sweep + monarch butterflies
      const mx0 = 3.6, mx1 = wf / 2 - 0.3; P.grad(mx0, 3.9, mx1, Hp - 0.2, ['#1d3a4a', '#d2552a', '#f0a24a']);
      for (let k = 0; k < 9; k++) P.butterfly(mx0 + 0.6 + P.R() * (mx1 - mx0 - 1.2), 4.4 + P.R() * (Hp - 5), 0.35 + P.R() * 0.35);
      P.text('COMMON', -1.2, Hp + 1.05, 0.95, '#121212', 'Unbounded', 900); P.text('MARKET', -1.2, Hp + 0.05, 0.95, '#121212', 'Unbounded', 900);
    },
    build(K, P) { const { wf } = P; K.B('m', 6.3, 0.42, 0.42, 0, 3.32, 0.3, hex('#1c1c1e')); // rolled shutter box
      for (const x of [-wf / 2 + 2.6, -wf / 2 + 5.2]) { K.B('m', 1.8, 0.07, 0.7, x, 0.75, 4.6, hex('#6b4a2c')); for (const dz of [-0.6, 0.6]) K.B('m', 1.8, 0.05, 0.28, x, 0.45, 4.6 + dz, hex('#6b4a2c')); K.B('m', 0.06, 0.72, 1.4, x - 0.8, 0.36, 4.6, hex('#3a2a1c')); K.B('m', 0.06, 0.72, 1.4, x + 0.8, 0.36, 4.6, hex('#3a2a1c')); K.segs.push([x - 0.9, 3.9, x + 0.9, 3.9], [x - 0.9, 5.3, x + 0.9, 5.3]); }
      P.sign('THE WARE-HOUSE XL', 0, 3.95, 5.6, 0.9, 0.22); P.lamp(-3.5, 3.9); P.lamp(3.5, 3.9);
    } },
  // HALT (ex-Europa Bus Centre, 10 Glengall St): grey/glass tower podium, the tall yellow 'HALT' blade sign, glazed
  // ground floor, container stalls with festoon lights out front. TERMINUS is the Reckless night inside.
  terminus: { w: 16, h: 11, barrier: 'steel',
    paint(P) { const { wf, Hp } = P;
      P.fill('#8d9196'); P.noise('#7b7f85', 500, 0.1);
      for (let y = 4.6; y < Hp - 1; y += 2.1) { P.r(-wf / 2, y, wf / 2, y + 1.25, '#24323e'); for (let x = -wf / 2 + 0.2; x < wf / 2; x += 1.5) { P.r(x, y, x + 0.08, y + 1.25, '#5d646b'); if (P.R() < 0.35) P.glow(x + 0.1, y + 0.1, x + 1.45, y + 1.15, 'rgba(255,214,150,0.55)'); } }
      P.r(-wf / 2, 3.6, wf / 2, 4.3, '#2b2e33'); P.text('TERMINUS · HALT · WEAVERS CROSS', 0, 3.95, 0.3, '#f2d21a');
      P.r(-wf / 2, 0, wf / 2, 3.6, '#1a242c'); for (let x = -wf / 2; x < wf / 2; x += 1.6) P.r(x, 0, x + 0.1, 3.6, '#4a5158');
      P.glow(-wf / 2 + 0.1, 0.1, wf / 2 - 0.1, 3.5, 'rgba(255,60,70,0.28)'); P.door(-1.6, 0, 1.6, 2.8, '#2a1416', '#ff3048');
      P.r(wf / 2 - 3.5, 0, wf / 2 - 0.2, 3.3, '#1b2a50'); P.text('CHEMIST', wf / 2 - 1.85, 3.05, 0.22, '#ffffff');
    },
    build(K, P) { const { wf } = P; const bx = -wf / 2 + 2.2; // the blade sign, sticking out from the corner
      K.B('yel', 0.34, 6.4, 1.5, bx, 7.6, 0.95); P.blade('HALT', bx, 7.6, 0.95, 6.2, 1.4);
      K.B('m', wf, 0.18, 1.2, 0, 3.6, 0.6, hex('#2b2e33'));
      P.festoon(-wf / 2 + 1, 3.3, wf / 2 - 1, 3.3, 3.6); P.lamp(-2.4, 3.4); P.lamp(2.4, 3.4);
      for (const [x, z] of [[-wf / 2 + 1.2, 3.8], [wf / 2 - 1.2, 3.8]]) K.plant(x, z, 1.1);
    } },
  // THOMPSONS GARAGE (3 Patterson's Place): cream two-storey frontage with the decorative arched parapet, the new glass
  // balcony over a black awning above the street door; green crowd barriers on the pavement.
  thompsons: { w: 12, h: 8.2, barrier: 'green',
    paint(P) { const { wf, Hp } = P;
      P.fill('#e8dcc0'); P.noise('#d9cba8', 700, 0.12);
      for (const x of [-wf / 2 + 0.25, wf / 2 - 0.65]) P.r(x, 0, x + 0.4, Hp, '#dccfae');
      P.r(-wf / 2, Hp - 1.2, wf / 2, Hp - 0.95, '#cdbf9c');
      for (const x of [-3.6, -1.2, 1.2, 3.6]) { P.r(x - 0.75, 4.4, x + 0.75, 6.6, '#cdbf9c'); P.win(x - 0.6, 4.55, x + 0.6, 6.45, P.R() < 0.6); }
      P.r(-wf / 2 + 0.7, 0, wf / 2 - 0.7, 3.2, '#121214'); P.door(-1.4, 0, 1.4, 2.7, '#1a1020', '#7a5aff');
      P.win(-4.7, 0.5, -2.2, 2.7, true, 'rgba(120,90,255,0.7)'); P.win(2.2, 0.5, 4.7, 2.7, true, 'rgba(255,40,90,0.6)');
    },
    build(K, P) { const { wf, Hp } = P;
      // arched parapet (centre) + cornice
      K.B('cream', wf, 0.3, 0.35, 0, Hp - 0.15, 0.25); for (let k = 0; k <= 16; k++) { const a = Math.PI * k / 16, x = -Math.cos(a) * 2.4, y = Hp + Math.sin(a) * 1.3; K.B('cream', 0.34, 0.34, 0.3, x, y, 0.22, null, [0, 0, -a + Math.PI / 2]); }
      K.B('cream', 4.4, 0.6, 0.2, 0, Hp + 0.25, 0.18); K.B('cream', 0.6, 0.6, 0.3, -wf / 2 + 0.45, Hp + 0.3, 0.25); K.B('cream', 0.6, 0.6, 0.3, wf / 2 - 0.45, Hp + 0.3, 0.25);
      // balcony: slab, glass balustrade, steel top rail; black awning below over the door
      const bw = wf - 1.6; K.B('m', bw, 0.22, 1.9, 0, 3.45, 1.0, hex('#2a2a2c')); K.add('glass', xf(box(bw, 1.05, 0.03), { t: [0, 4.1, 1.93] })); K.add('glass', xf(box(0.03, 1.05, 1.9), { t: [-bw / 2, 4.1, 1.0] })); K.add('glass', xf(box(0.03, 1.05, 1.9), { t: [bw / 2, 4.1, 1.0] }));
      K.B('m', bw, 0.05, 0.06, 0, 4.64, 1.93, hex('#b8bcc2')); for (let x = -bw / 2 + 1.2; x < bw / 2; x += 2.4) K.add('m', xf(cyl(0.9, 0.18, 0.12, 10), { t: [x, 4.0, 0.6] }), hex('#1b1b1d'));
      K.B('m', bw, 0.08, 2.1, 0, 3.22, 1.1, hex('#0e0e10'), [-0.12, 0, 0]); K.B('m', bw, 0.42, 0.06, 0, 3.0, 2.15, hex('#0e0e10'));
      P.sign('THOMPSONS', 0, 3.0, 4.2, 0.42, 2.2, '#000', '#fff', 'frameless'); P.lamp(-2, 2.9, 1.9); P.lamp(2, 2.9, 1.9);
    } },
  // THE WARE-HOUSE (Palm House / Three Sheets, 1 Bankmore Sq, Marcus Ward building): Victorian red brick with sandstone
  // bands and round-arched windows, warm-lit, a canopy over the door; brass posts and red rope for the queue.
  warehouse: { w: 16, h: 9, barrier: 'rope', rope: '#b01020', post: '#c8a050',
    paint(P) { const { wf, Hp } = P;
      P.brick('#8a3b28'); for (const y of [3.4, 6.4, Hp - 0.5]) P.r(-wf / 2, y, wf / 2, y + 0.32, '#c9a77a');
      for (let x = -wf / 2 + 1.4; x < wf / 2 - 0.8; x += 2.2) { P.arch(x, 4.1, 1.2, 1.7, P.R() < 0.7); P.arch(x, 7.0, 1.0, 1.3, P.R() < 0.5); }
      P.r(-wf / 2 + 0.6, 0, wf / 2 - 0.6, 3.1, '#1c1410'); P.r(-wf / 2 + 0.6, 2.6, wf / 2 - 0.6, 3.1, '#2a1c12');
      P.door(-1.3, 0, 1.3, 2.5, '#1a0e08', '#ff8a30'); for (const x of [-5.6, -3.2, 3.2, 5.6]) P.win(x - 1.0, 0.5, x + 1.0, 2.4, true, 'rgba(255,150,60,0.75)');
    },
    build(K, P) { K.B('m', 3.6, 0.12, 1.6, 0, 2.75, 0.8, hex('#1b1410')); for (const x of [-1.7, 1.7]) K.B('m', 0.05, 0.05, 1.6, x, 2.7, 0.8, hex('#c8a050'));
      P.sign('THE WARE-HOUSE', 0, 3.25, 5.4, 0.44, 0.3, '#ffb04a', '#1a0e06', 'frameless'); P.sign('EST. · NOSTALGIA', 0, 3.9, 3.4, 0.32, 0.2, '#ffd890', '#1a0e06', 'frameless');
      P.lamp(-2.3, 2.6); P.lamp(2.3, 2.6); K.plant(-2.6, 0.7, 0.9); K.plant(2.6, 0.7, 0.9);
    } },
  // LOCATION X (149 Lisburn Rd): red-brick terrace, white sash windows upstairs, a ground-floor shopfront with a black
  // fascia, pink/purple neon, a big window glowing inside; chrome posts and purple rope.
  locationx: { w: 9, h: 7.5, barrier: 'rope', rope: '#7a1ab0', post: '#d8dce2',
    paint(P) { const { wf, Hp } = P;
      P.brick('#9a4630'); P.r(-wf / 2, Hp - 0.45, wf / 2, Hp, '#e8e4dc');
      for (const x of [-2.6, 0, 2.6]) for (const y of [3.9, 5.7]) { P.r(x - 0.7, y - 0.12, x + 0.7, y, '#e8e4dc'); P.win(x - 0.55, y, x + 0.55, y + 1.3, P.R() < 0.5, null, '#f2f0ea'); }
      P.r(-wf / 2, 2.9, wf / 2, 3.5, '#0c0a0e'); P.r(-wf / 2, 0, wf / 2, 2.9, '#16101a');
      P.win(-wf / 2 + 0.5, 0.45, 0.7, 2.6, true, 'rgba(200,40,255,0.75)'); P.door(1.4, 0, 3.4, 2.6, '#140a18', '#ff3ad0');
    },
    build(K, P) { const { wf } = P; P.sign('LOCATION X', -0.2, 3.2, 5.2, 0.5, 0.12, '#ff4ad8', '#0c0a0e', 'neon');
      K.B('m', 0.06, 0.06, 1.0, wf / 2 - 0.6, 3.9, 0.5, hex('#222')); P.sign('X', wf / 2 - 0.6, 3.5, 0.7, 0.7, 0.95, '#ff4ad8', '#0c0a0e', 'neon', true);
      K.B('npink', 0.04, 2.5, 0.04, 1.3, 1.3, 0.16); K.B('npink', 0.04, 2.5, 0.04, 3.5, 1.3, 0.16); K.B('npink', 2.24, 0.04, 0.04, 2.4, 2.6, 0.16); P.lamp(-2.8, 2.8);
    } },
};
// door is offset sideways at Location X (shopfront door to the right)
const DOORX = { locationx: 2.4 };

export function buildFront(scene, id, { wx, wz, nx, nz, avail = 14, bh = 10, parent, grid, low = false }) {
  const S = SPEC[id]; if (!S) return null; const R = rng(91 + id.length * 13);
  const root = new TransformNode('front-' + id, scene); root.position.set(wx, 0, wz); root.rotation.y = Math.atan2(nx, nz); if (parent) root.parent = parent;
  const wf = Math.max(8, Math.min(S.w, avail)), Hp = Math.max(S.h, Math.min(bh, S.h + 6));
  const gable = S.gable || 0, Ht = Hp + gable;
  const PX = Math.min(48, 1024 / wf, 1024 / Ht), CW = Math.ceil(wf * PX), CH = Math.ceil(Ht * PX);
  const dT = new DynamicTexture('frontD-' + id, { width: CW, height: CH }, scene, true), eT = new DynamicTexture('frontE-' + id, { width: CW, height: CH }, scene, true);
  const D = dT.getContext(), E = eT.getContext(); E.fillStyle = '#000'; E.fillRect(0, 0, CW, CH);
  const X = (x) => (x + wf / 2) * PX, Y = (y) => (Ht - y) * PX;
  const P = { wf, Hp, R, D, E,
    fill(c) { D.fillStyle = c; D.fillRect(0, 0, CW, CH); },
    noise(c, n, s) { D.fillStyle = c; for (let i = 0; i < n; i++) D.fillRect(R() * CW, R() * CH, s * PX * (0.5 + R()), s * PX * 0.4); },
    r(x0, y0, x1, y1, c) { D.fillStyle = c; D.fillRect(X(x0), Y(y1), (x1 - x0) * PX, (y1 - y0) * PX); },
    glow(x0, y0, x1, y1, c) { E.fillStyle = c; E.fillRect(X(x0), Y(y1), (x1 - x0) * PX, (y1 - y0) * PX); },
    grad(x0, y0, x1, y1, cols) { const g = D.createLinearGradient(X(x0), Y(y1), X(x1), Y(y0)); cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c)); D.fillStyle = g; D.fillRect(X(x0), Y(y1), (x1 - x0) * PX, (y1 - y0) * PX); },
    text(t, x, y, s, c, font = 'Unbounded', wt = 800) { D.font = `${wt} ${s * PX}px ${font}`; D.fillStyle = c; D.textAlign = 'center'; D.textBaseline = 'middle'; D.fillText(t, X(x), Y(y)); },
    win(x0, y0, x1, y1, lit, col, frame = '#1a1a1c') { P.r(x0 - 0.08, y0 - 0.08, x1 + 0.08, y1 + 0.08, frame); P.r(x0, y0, x1, y1, '#20262c');
      D.fillStyle = frame; D.fillRect(X((x0 + x1) / 2) - 1.5, Y(y1), 3, (y1 - y0) * PX); D.fillRect(X(x0), Y((y0 + y1) / 2) - 1.5, (x1 - x0) * PX, 3);
      if (lit) { P.glow(x0, y0, x1, y1, col || 'rgba(255,200,130,0.8)'); P.r(x0, y0, x1, y1, '#6a5a44'); D.fillStyle = frame; D.fillRect(X((x0 + x1) / 2) - 1.5, Y(y1), 3, (y1 - y0) * PX); D.fillRect(X(x0), Y((y0 + y1) / 2) - 1.5, (x1 - x0) * PX, 3); } },
    arch(cx, y0, w, h, lit) { const x0 = cx - w / 2; D.fillStyle = '#c9a77a'; D.beginPath(); D.arc(X(cx), Y(y0 + h - w / 2), (w / 2 + 0.14) * PX, Math.PI, 0); D.fill();
      D.fillStyle = lit ? '#6a5040' : '#1e2328'; D.fillRect(X(x0), Y(y0 + h - w / 2), w * PX, (h - w / 2) * PX); D.beginPath(); D.arc(X(cx), Y(y0 + h - w / 2), w / 2 * PX, Math.PI, 0); D.fill();
      if (lit) { E.fillStyle = 'rgba(255,170,90,0.75)'; E.fillRect(X(x0), Y(y0 + h - w / 2), w * PX, (h - w / 2) * PX); E.beginPath(); E.arc(X(cx), Y(y0 + h - w / 2), w / 2 * PX, Math.PI, 0); E.fill(); }
      D.fillStyle = '#2a2a2a'; D.fillRect(X(cx) - 1.5, Y(y0 + h), 3, h * PX); },
    brick(base) { P.fill(base); for (let y = 0; y < Ht; y += 0.15) { const row = Math.round(y / 0.15); for (let x = -wf / 2 - (row % 2) * 0.11; x < wf / 2; x += 0.22) { const k = R(); D.fillStyle = k < 0.25 ? '#7a3020' : k < 0.5 ? '#9c4a32' : k < 0.6 ? '#6c2a1c' : base; D.fillRect(X(x) + 1, Y(y + 0.15) + 1, 0.22 * PX - 2, 0.15 * PX - 2); } } },
    door(x0, y0, x1, y1, c, glowC) { P.r(x0 - 0.12, y0, x1 + 0.12, y1 + 0.12, '#0a0a0a'); P.r(x0, y0, x1, y1, c); const g = E.createLinearGradient(0, Y(y0), 0, Y(y1)); g.addColorStop(0, glowC); g.addColorStop(1, 'rgba(0,0,0,0)'); E.globalAlpha = 0.85; E.fillStyle = g; E.fillRect(X(x0), Y(y1), (x1 - x0) * PX, (y1 - y0) * PX); E.globalAlpha = 1; },
    butterfly(x, y, s) { for (const sd of [-1, 1]) { D.fillStyle = '#e8781a'; D.beginPath(); D.ellipse(X(x + sd * s * 0.5), Y(y + s * 0.15), s * 0.5 * PX, s * 0.42 * PX, sd * 0.5, 0, 7); D.fill(); D.beginPath(); D.ellipse(X(x + sd * s * 0.35), Y(y - s * 0.35), s * 0.32 * PX, s * 0.3 * PX, -sd * 0.4, 0, 7); D.fill();
      D.strokeStyle = '#111'; D.lineWidth = Math.max(1, s * PX * 0.06); D.beginPath(); D.ellipse(X(x + sd * s * 0.5), Y(y + s * 0.15), s * 0.5 * PX, s * 0.42 * PX, sd * 0.5, 0, 7); D.stroke(); } D.fillStyle = '#111'; D.fillRect(X(x) - 1.5, Y(y + s * 0.5), 3, s * PX); },
  };
  S.paint(P);
  E.globalAlpha = 0.2; E.drawImage(D.canvas, 0, 0); E.globalAlpha = 1; // street-lit facade
  // warm pool of light around the door at street level
  { const dx = DOORX[id] || 0; const g = E.createRadialGradient(X(dx), Y(0), 0, X(dx), Y(0), 4.5 * PX); g.addColorStop(0, 'rgba(255,220,180,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); E.globalCompositeOperation = 'lighter'; E.fillStyle = g; E.fillRect(0, 0, CW, CH); E.globalCompositeOperation = 'source-over'; }
  if (gable) { for (const C of [D, E]) { C.globalCompositeOperation = 'destination-out'; C.fillStyle = '#000'; C.beginPath(); C.moveTo(0, 0); C.lineTo(CW / 2, 0); C.lineTo(0, gable * PX); C.closePath(); C.fill(); C.beginPath(); C.moveTo(CW, 0); C.lineTo(CW / 2, 0); C.lineTo(CW, gable * PX); C.closePath(); C.fill(); C.globalCompositeOperation = 'source-over'; } dT.hasAlpha = true; }
  dT.update(); eT.update();
  const fm = new StandardMaterial('frontM-' + id, scene); fm.diffuseTexture = dT; fm.emissiveTexture = eT; fm.specularColor = new Color3(0.04, 0.04, 0.04); fm.backFaceCulling = true;
  if (gable) fm.useAlphaFromDiffuseTexture = false, dT.hasAlpha = true, fm.transparencyMode = 1;
  const fp = toMesh('front-' + id, xf(plane(wf, Ht), { r: [0, Math.PI, 0], t: [0, Ht / 2, 0.14] }), scene, fm); fp.parent = root;
  // 3D extras
  const K = kit(scene, root, R); const unl = (c) => mat(scene, 'fr-' + id + '-' + c, { unlit: true, e: hex(c), d: Color3.Black() });
  const mats = { m: mat(scene, 'fr-' + id + '-m', { s: new Color3(0.15, 0.15, 0.15), p: 30 }), metal: mat(scene, 'fr-' + id + '-metal', { s: new Color3(0.5, 0.5, 0.55), p: 50 }), kit: mat(scene, 'fr-' + id + '-kit'), leaf: mat(scene, 'fr-' + id + '-leaf'),
    yel: mat(scene, 'fr-' + id + '-yel', { d: hex('#f2c414'), e: hex('#6a5208') }), cream: mat(scene, 'fr-' + id + '-cream', { d: hex('#e8dcc0'), e: hex('#3a3428') }),
    bulb: unl('#ffd890'), npink: unl('#ff4ad8'), glass: (() => { const g = mat(scene, 'fr-' + id + '-glass', { d: hex('#d8ecf2'), s: new Color3(0.9, 0.9, 0.9), p: 80, e: hex('#0a1216') }); g.alpha = 0.16; g.backFaceCulling = false; return g; })() };
  const signs = [];
  const signT = (txt, fg, bg, style, w, h) => { const t = new DynamicTexture('frS-' + id + txt, { width: 1024, height: Math.max(64, Math.round(1024 * h / w)) }, scene, true); const c = t.getContext(), cw = 1024, ch = t.getSize().height;
    c.fillStyle = bg; c.fillRect(0, 0, cw, ch); if (style !== 'frameless' && style !== 'neon') { c.strokeStyle = fg; c.lineWidth = 8; c.strokeRect(6, 6, cw - 12, ch - 12); }
    let fs = ch * 0.62; do { c.font = `800 ${fs}px Unbounded`; fs -= 3; } while (c.measureText(txt).width > cw - 60 && fs > 12); c.textAlign = 'center'; c.textBaseline = 'middle';
    if (style === 'neon') { c.shadowColor = fg; c.shadowBlur = ch * 0.18; } c.fillStyle = fg; c.fillText(txt, cw / 2, ch / 2 + 3); if (style === 'neon') c.fillText(txt, cw / 2, ch / 2 + 3); t.update(); return t; };
  P.sign = (txt, x, y, w, h, z, fg = '#fff', bg = '#000', style = 'frame', both = false) => { const sm = mat(scene, 'frSign-' + id + txt, { unlit: true, d: Color3.Black() }); sm.emissiveTexture = signT(txt, fg, bg, style, w, h); sm.emissiveColor = Color3.Black();
    const s = toMesh('frSign-' + id + txt, xf(plane(w, h), { r: [0, both ? Math.PI / 2 : Math.PI, 0], t: [x, y, z] }), scene, sm); s.parent = root; sm.backFaceCulling = !both; signs.push(s); K.B('m', both ? 0.08 : w + 0.08, h + 0.08, both ? w + 0.08 : 0.06, x, y, z - (both ? 0 : 0.04), hex('#111')); };
  P.blade = (txt, x, y, z, h, w) => { const sm = mat(scene, 'frBlade-' + id, { unlit: true, d: Color3.Black(), two: true }); const t = new DynamicTexture('frBladeT-' + id, { width: 256, height: Math.round(256 * h / w) }, scene, true); const c = t.getContext(), H = t.getSize().height;
    c.fillStyle = '#f5c814'; c.fillRect(0, 0, 256, H); c.fillStyle = '#121212'; c.font = `900 ${Math.min(200, H / txt.length * 0.85)}px Unbounded`; c.textAlign = 'center'; c.textBaseline = 'middle'; [...txt].forEach((ch, i) => c.fillText(ch, 128, (i + 0.5) * H / txt.length)); t.update(); sm.emissiveTexture = t; sm.emissiveColor = Color3.Black();
    for (const sd of [-1, 1]) { const s = toMesh('frBlade-' + id + sd, xf(plane(w, h), { r: [0, sd * Math.PI / 2, 0], t: [x + sd * 0.18, y, z] }), scene, sm); s.parent = root; signs.push(s); } };
  P.lamp = (x, y, z = 0.35) => { K.B('m', 0.12, 0.12, z, x, y + 0.25, z / 2, hex('#1a1a1a')); K.add('bulb', xf(sphere(8), { s: [0.12, 0.12, 0.12], t: [x, y + 0.14, z] })); };
  P.festoon = (x0, y0, x1, y1, sag) => { const n = Math.round((x1 - x0) / 0.6); for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, zz = 1.2 + Math.sin(t * Math.PI) * sag * 0.6, y = y0 + (y1 - y0) * t - Math.sin(t * Math.PI * 3) ** 2 * 0.35; K.add('bulb', xf(sphere(6), { s: [0.07, 0.09, 0.07], t: [x, y, zz] })); } };
  S.build(K, P);
  // queue lane beside the door: barrier line parallel to the facade, door end left open
  const dx = DOORX[id] || 0, sd = dx > 0 ? -1 : 1, q0 = dx + sd * 1.9, q1 = dx + sd * Math.min(8.5, wf / 2 + 1.5), qz = 1.75, lo = Math.min(q0, q1), hi = Math.max(q0, q1);
  if (S.barrier === 'rope') { for (let x = lo; x <= hi + 0.01; x += (hi - lo) / Math.round((hi - lo) / 1.3)) { K.add('metal', xf(cyl(0.95, 0.035, 0.035, 10), { t: [x, 0.48, qz] }), hex(S.post)); K.add('metal', xf(cyl(0.04, 0.17, 0.17, 14), { t: [x, 0.02, qz] }), hex(S.post)); K.add('metal', xf(sphere(8), { s: [0.06, 0.06, 0.06], t: [x, 0.97, qz] }), hex(S.post)); }
    const st = (hi - lo) / Math.round((hi - lo) / 1.3); for (let x = lo; x < hi - 0.01; x += st) for (let k = 0; k < 6; k++) { const a = x + st * k / 6, b = x + st * (k + 1) / 6, ya = 0.86 - Math.sin(Math.PI * k / 6) * 0.12, yb = 0.86 - Math.sin(Math.PI * (k + 1) / 6) * 0.12; K.add('kit', xf(box(b - a + 0.02, 0.045, 0.045), { r: [0, 0, Math.atan2(yb - ya, b - a)], t: [(a + b) / 2, (ya + yb) / 2, qz] }), hex(S.rope)); } }
  else { const col = S.barrier === 'green' ? '#5fd22a' : '#9aa0a8'; for (let x = lo; x < hi - 0.5; x += 2.2) { const L = Math.min(2.1, hi - x); K.B('metal', L, 0.05, 0.05, x + L / 2, 1.1, qz, hex(col)); K.B('metal', L, 0.05, 0.05, x + L / 2, 0.2, qz, hex(col)); for (let k = 0; k <= Math.floor(L / 0.16); k++) K.B('metal', 0.022, 0.9, 0.022, x + k * 0.16, 0.65, qz, hex(col));
      for (const fx of [x + 0.1, x + L - 0.1]) K.B('metal', 0.05, 0.05, 0.6, fx, 0.03, qz, hex(col)); } }
  K.segs.push([lo, qz, hi, qz]);
  const qpts = []; for (let k = 0; k < 6; k++) { const lx = q0 + sd * (0.35 + k * 0.9 + (R() - 0.5) * 0.2), lz = 0.85 + (R() - 0.5) * 0.25; qpts.push([lx, lz, -sd * Math.PI / 2 + (R() - 0.5) * 0.5]); }
  for (const [k, list] of Object.entries(K.G)) { if (!mats[k]) mats[k] = mat(scene, 'fr-' + id + '-' + k); const me = toMesh('fr-' + id + '-' + k, merge(list), scene, mats[k]); me.parent = root; me.isPickable = false; }
  // collision (world)
  const th = root.rotation.y, c = Math.cos(th), s = Math.sin(th), W = (lx, lz) => [wx + lx * c + lz * s, wz - lx * s + lz * c];
  if (grid) for (const [a, b, e, f] of K.segs) { const p = W(a, b), q = W(e, f); grid.add(p[0], p[1], q[0], q[1], 1.15); }
  // door in world space, 2.5 m out in front of the door point
  const door = W(dx, 2.5), qc = W((q0 + q1) / 2, 1);
  const queue = { x: qc[0], z: qc[1], pts: qpts.map(([a, b, y]) => { const p = W(a, b); return [p[0], p[1], th + y]; }) };
  return { root, signs, door: { x: door[0], z: door[1] }, facade: fp, queue };
}
export const FRONT_IDS = Object.keys(SPEC);
