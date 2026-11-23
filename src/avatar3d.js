import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
// RECKLESS crew avatar, smooth rigged glTF (tools/blender/build_avatar.py): CC0 Quaternius base + UAL animations,
// reshaped to the app's crew render proportions. Garments are skinned shells, swapped and tinted live from the wardrobe.
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/glTFFileLoader';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_emissive_strength';
import '@babylonjs/loaders/glTF/2.0/Extensions/EXT_meshopt_compression';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_mesh_quantization';
import { MeshoptCompression } from '@babylonjs/core/Meshes/Compression/meshoptCompression';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';

const KINDS = ['tee', 'crop', 'long', 'hoodie', 'jeans', 'pants', 'cuffed', 'shorts', 'shortsL', 'pantsW', 'jersey', 'teeD'];
const M3 = { 'manager-shorts': 'shortsL', 'rawdawg-shorts': 'shortsL', 'artillery': 'pantsW', 'rcklstv-jersey': 'jersey', 'distress-shirt': 'teeD', 'see-me-crop': 'crop' }; // v5 cut variants (crew.js M3)
// body cover mask (tools/blender/build_avatar.py COVER_KINDS): COLOR_0 R/G carry one bit per garment that covers the vertex
const COVER_KINDS = ['tee', 'crop', 'long', 'hoodie', 'jeans', 'pants', 'cuffed', 'shorts', 'shortsL', 'pantsW', 'jersey', 'teeD', 'shoes', 'briefs', 'bra'];
const SKIN = Color3.FromHexString('#ead3cb'), HAIR = Color3.FromHexString('#141214');

// quality pass 2026-11-23: 2048 masters (models/tex*, desktop) + 1024 copies (models/tex*_1k, touch / low-memory), trilinear mips,
// anisotropy up to 16 (4 on low-memory), and the avatar's own textures are exempt from the low-memory 512 / touch 1024 global cap
// (the cap is for the city; the avatar is the closest thing to the camera and was being cut to 512 on iPhone / app).
let capPatched = false;
function exemptAvatarFromCap(engine, cap) {
  if (capPatched || !engine || !engine._prepareWebGLTexture) return; capPatched = true;
  const orig = engine._prepareWebGLTexture.bind(engine), caps = engine.getCaps(), hw = engine._gl ? engine._gl.getParameter(engine._gl.MAX_TEXTURE_SIZE) : cap;
  engine._prepareWebGLTexture = function (texture, ...rest) {
    const u = (texture && texture.url) || '';
    if (!/\/models\/tex(_f)?(_1k)?\//.test(u)) return orig(texture, ...rest);
    const was = caps.maxTextureSize; caps.maxTextureSize = Math.min(hw, Math.max(was, cap));
    try { return orig(texture, ...rest); } finally { caps.maxTextureSize = was; }
  };
}
export async function loadAvatar3D(scene, { name = 'player', base = import.meta.env.BASE_URL, kind = 'male', hq = true, lite = false, file = null, exempt = true } = {}) {
  const FEM = kind === 'female';
  const engine = scene.getEngine(); if (exempt) exemptAvatarFromCap(engine, hq ? 2048 : 1024); // SAFE (WebView crashed once): no exemption, the 512 cap stands
  const ANISO = Math.max(1, Math.min(lite ? 4 : 16, (engine.getCaps().maxAnisotropy || 4)));
  // meshopt-compressed glb (tools/blender/build_avatar.py -> gltf-transform resample/prune/dedup/meshopt), served as .json so the
  // host brotli-compresses it (~240 KB on the wire); decoder is the local meshoptimizer build, no CDN
  MeshoptCompression.Configuration.decoder.url = base + 'models/meshopt_decoder.js';
  const res = await SceneLoader.ImportMeshAsync('', base + 'models/', file || (FEM ? 'avatar_f.glb.json' : 'avatar.glb.json'), scene, null, '.glb');
  const root = new TransformNode(name, scene);
  const gltfRoot = res.meshes[0]; gltfRoot.parent = root; gltfRoot.name = name + '-gltf';
  const byName = {}; for (const m of res.meshes) { if (m === gltfRoot) continue; const n = m.name.replace(/_primitive\d+$/, '').split('.')[0]; (byName[n] = byName[n] || []).push(m); m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.name = 'av3d-' + n; }
  // Materials: every visible part carries a texture projected from the app's own crew renders (tools/bake_avatar_tex.py),
  // so face, hair, tee print and stonewash denim match the app. The renders already hold soft studio shading, so the
  // material lights them gently: half-Lambert-like fill through emissive (wrap lighting), low specular, no glow (main.js).
  const LOOK2 = !/[?&]avlook=1\b/.test(location.search); // quality pass lighting (?avlook=1 = the old look, for before/after)
  const TEX = base + (FEM ? 'models/tex_f' : 'models/tex') + (hq ? '/' : '_1k/');
  const tex = (f, onErr, noMip = false) => { const t = new Texture(TEX + f + '.webp', scene, noMip, false, noMip ? Texture.BILINEAR_SAMPLINGMODE : Texture.TRILINEAR_SAMPLINGMODE, null, () => onErr && onErr()); t.anisotropicFilteringLevel = ANISO; return t; };
  const mat = (id, col, { rough = 0.75, t = null, fill = 0.42 } = {}) => { const m = new StandardMaterial('av3d-' + id, scene); m.diffuseColor = col.clone(); const sp = (1 - rough) * 0.3; m.specularColor = new Color3(sp, sp, sp); m.specularPower = 28; m.ambientColor = new Color3(0.3, 0.3, 0.32);
    if (t) { m.diffuseTexture = t; m.emissiveTexture = t; m.emissiveColor = new Color3(fill, fill, fill); m.diffuseColor = new Color3(0.78, 0.78, 0.78); } return m; };
  const skinM = mat('skin', SKIN, { rough: 0.6, t: tex('body'), fill: 0.32 }); if (FEM) { skinM.diffuseColor.set(0.88, 0.81, 0.75); skinM.emissiveColor.set(0.36, 0.31, 0.27); } /* audit P1-8: lifted, less brown cast (face read muddy beside the male) */ else skinM.diffuseColor.set(0.82, 0.8, 0.8); skinM.specularColor.set(0.05, 0.04, 0.035); // warm light skin like the sheets (was washed-out pale) // less fill, more key: arms read apart from the torso
  const hairM = mat('hair', HAIR, { rough: 0.9, t: tex('hair', null, !LOOK2), fill: 0.5 }); /* no mips: stretched nape UVs must not average the fade into stripes */ hairM.diffuseColor.set(0.45, 0.45, 0.45); /* opaque hair shell: the fade carries skin colour down to the hairline, so no alpha holes or nape slit */ hairM.backFaceCulling = false; // alpha-tested fringe edge: no forehead band
  const browM = mat('brow', HAIR, { rough: 0.8 });
  const eyeM = mat('eye', Color3.White(), { rough: 0.2, t: tex('eyes'), fill: 0.5 });
  // keep the loader's winding (glTF is right-handed): new materials must copy sideOrientation or every shell renders inside-out
  const SO = (res.meshes.find(m => m.material) || {}).material?.sideOrientation;
  const set = (n, m) => (byName[n] || []).forEach(x => { if (SO != null) m.sideOrientation = SO; x.material = m; });
  const curlM = mat('curls', HAIR, { rough: 0.7 }); curlM.diffuseColor = Color3.FromHexString('#1a1412'); curlM.specularColor = new Color3(0.12, 0.1, 0.09); curlM.specularPower = 18; curlM.emissiveColor = new Color3(0.03, 0.025, 0.022);
  const studM = mat('stud', Color3.FromHexString('#d8dce4'), { rough: 0.1 }); studM.specularColor = new Color3(1, 1, 1); studM.specularPower = 64; studM.emissiveColor = new Color3(0.35, 0.36, 0.4);
  if (FEM) { // audit P1-8: hair cap read as a flat helmet -> lighter shell with a soft sheen; curls get a highlight so the bun/strands separate
    hairM.diffuseColor.set(0.36, 0.34, 0.33); hairM.specularColor.set(0.26, 0.24, 0.22); hairM.specularPower = 18; hairM.emissiveColor.set(0.3, 0.29, 0.28);
    curlM.diffuseColor = Color3.FromHexString('#2a211d'); curlM.specularColor = new Color3(0.32, 0.28, 0.25); curlM.specularPower = 26; curlM.emissiveColor = new Color3(0.06, 0.05, 0.045); }
  set('Curls', curlM); set('Stud', studM);
  const soleM = mat('soles', Color3.FromHexString('#1c1c1f'), { rough: 0.55 }); soleM.specularColor = new Color3(0.18, 0.18, 0.2); soleM.specularPower = 24; set('Soles', soleM);
  set('Body', skinM); set('Hair', hairM); set('Eyebrows', browM); set('Eyes', eyeM);
  (byName.Eyebrows || []).forEach(x => x.setEnabled(false)); // brows are painted into the projected face texture
  set('G_bra', mat('bra', Color3.FromHexString('#0e0e10'), { rough: 0.7 })); // female base layer: a black sports bra under every top, so bare-torso looks stay covered
  set('G_briefs', mat('briefs', Color3.FromHexString('#111113'), { rough: 0.8 }));
  set('G_shoes', mat('shoes', Color3.FromHexString('#101012'), { rough: 0.45, t: tex('shoes'), fill: 0.38 }));
  const gm = {}; for (const k of KINDS) { gm[k] = mat('g-' + k, Color3.White(), { rough: k === 'jeans' ? 0.9 : 0.85 }); set('G_' + k, gm[k]); (byName['G_' + k] || []).forEach(x => x.setEnabled(false)); }
  // shells are drawn two-sided: field-fitted folds can flip a few faces, and with the covered body hidden those would read as holes
  for (const m of [...Object.values(gm), byName.G_bra?.[0]?.material, byName.G_briefs?.[0]?.material, byName.G_shoes?.[0]?.material].filter(Boolean)) { m.backFaceCulling = false; m.twoSidedLighting = true; }
  const gtex = {}; // per-item garment textures, loaded when first worn
  const wear = (kind, g) => { const m = gm[kind];
    const tint = () => { m.diffuseTexture = null; m.emissiveTexture = null; m.emissiveColor = Color3.Black(); m.diffuseColor = Color3.FromHexString(g.col); m._e0 = null; av._expo = null; };
    if (gtex[g.id] === false) return tint();
    if (!gtex[g.id]) gtex[g.id] = tex('g-' + g.id, () => { gtex[g.id] = false; if (av.fit) av.setFit(av.fit, av._vis); });
    const t = gtex[g.id]; m.diffuseTexture = t; m.emissiveTexture = t;
    const c = Color3.FromHexString(g.col), L = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b, f = LOOK2 ? (L > 0.6 ? 0.2 : 0.3) : (L > 0.6 ? 0.26 : 0.4), d = LOOK2 ? (L > 0.6 ? 0.66 : 0.86) : (L > 0.6 ? 0.6 : 0.78); // white garments: no blow-out
    m.emissiveColor = new Color3(f, f, f); m.diffuseColor = new Color3(d, d, d); m._e0 = null; av._expo = null; };
  // pipeline chunk 1 (male): Cycles-baked ambient occlusion per part + a texture-coloured fresnel rim (cheap, mobile-safe)
  if (!FEM) {
    const ao = (m, f, lvl = 1) => { const t = new Texture(TEX + 'ao_' + f + '.webp', scene, false, false, Texture.TRILINEAR_SAMPLINGMODE, null, () => { m.ambientTexture = null; }); t.level = lvl; m.ambientTexture = t; };
    ao(skinM, 'Body'); ao(gm.tee, 'G_tee'); ao(gm.jeans, 'G_jeans'); ao(byName.G_shoes?.[0]?.material || skinM, 'G_shoes');
    const rimF = () => { const f = new FresnelParameters(); f.leftColor = new Color3(1.55, 1.45, 1.35); f.rightColor = Color3.White(); f.power = 2.5; f.bias = 0; return f; };
    for (const m of [skinM, ...Object.values(gm)]) m.emissiveFresnelParameters = rimF();
  }
  // quality pass: the face read flat and pale because most of its light was unlit emissive (texture x 0.32 fill, x 1.55 at
  // the fresnel rim) pushed through ACES at exposure 1.4 (1.7-2.0 in clubs); the tee print's red crossed the 0.72 bloom
  // threshold (the red chest blob). Less emissive, more key light (real form shading), a softer rim, a hair sheen with
  // mips (the 2048 hair map aliased into a blob without them), and emissive/lights compensated for scene exposure.
  if (LOOK2) {
    if (!FEM) { skinM.emissiveColor.set(0.22, 0.22, 0.22); skinM.diffuseColor.set(0.92, 0.89, 0.88); }
    else { skinM.emissiveColor.set(0.27, 0.235, 0.205); skinM.diffuseColor.set(0.96, 0.89, 0.83); }
    skinM.specularColor.set(0.07, 0.06, 0.055); skinM.specularPower = 22;
    if (!FEM) { hairM.diffuseColor.set(0.6, 0.6, 0.6); hairM.emissiveColor.set(0.3, 0.3, 0.3); hairM.specularColor.set(0.16, 0.15, 0.14); hairM.specularPower = 36; }
    const rim2 = () => { const f = new FresnelParameters(); f.leftColor = new Color3(1.2, 1.15, 1.1); f.rightColor = new Color3(0.8, 0.8, 0.8); f.power = 3; f.bias = 0; return f; };
    for (const m of [skinM, ...Object.values(gm)]) if (m.emissiveFresnelParameters || !FEM) m.emissiveFresnelParameters = rim2();
  }

  // animation groups, blended by weight
  const AG = {}; for (const g of res.animationGroups) { g.stop(); AG[g.name] = g; }
  for (const k of ['idle', 'walk', 'jog', 'sprint', 'dance', 'jumpLoop', 'sit']) if (AG[k]) { AG[k].start(true, 1.0); AG[k].setWeightForAllAnimatables(k === 'idle' ? 1 : 0); }
  const w = { idle: 1, walk: 0, jog: 0, sprint: 0, dance: 0, jumpLoop: 0, sit: 0 };
  const av = { root, isGlb: true, parts: byName, ag: AG, fit: null, kind: FEM ? 'female' : 'male' };
  // studio approach to skin-through-cloth: hide the body triangles the worn shells fully cover (one ring of overlap kept at
  // cuffs/hems by the build), so no pose or blend can push skin through. One index list per worn set, cached.
  const bodyM = (byName.Body || [])[0]; let coverV = null, idx0 = null; const idxCache = new Map();
  if (bodyM) { const c = bodyM.getVerticesData(VertexBuffer.ColorKind); bodyM.useVertexColors = false; bodyM.hasVertexAlpha = false;
    if (c) { const n = c.length / 4; coverV = new Uint16Array(n); for (let i = 0; i < n; i++) coverV[i] = Math.round(c[i * 4] * 255) | (Math.round(c[i * 4 + 1] * 255) << 8); idx0 = Array.from(bodyM.getIndices()); } }
  const coverBody = (kinds) => { if (!coverV) return; let bits = 0; for (const k of kinds) { const b = COVER_KINDS.indexOf(k); if (b >= 0) bits |= 1 << b; }
    let ix = idxCache.get(bits);
    if (!ix) { ix = []; for (let t = 0; t < idx0.length; t += 3) { const a = idx0[t], b = idx0[t + 1], c = idx0[t + 2]; if ((coverV[a] & bits) && (coverV[b] & bits) && (coverV[c] & bits)) continue; ix.push(a, b, c); } idxCache.set(bits, ix); }
    bodyM.setIndices(ix, null, true); av.bodyHidden = (idx0.length - ix.length) / 3; };
  // per-outfit idle arm offset (v5: the female hoodies hang the arms a few degrees closer to the body). Applied after the
  // animation pass each frame, about the body's front-back axis through each shoulder; the sign is picked once per arm.
  const ARM_OFF = { hoodie: FEM ? 2.5 : 0 };
  const uarms = ['upperarm_l', 'upperarm_r'].map(n => res.transformNodes.find(t => t.name === n)).filter(Boolean);
  const armSign = new Map(); av.armOff = 0;
  const elbowX = (nd) => { const kids = nd.getChildTransformNodes(true), ch = kids.find(k => k.name.startsWith('lowerarm')) || kids[0]; if (!ch) return 0; ch.computeWorldMatrix(true); const inv = Matrix.Invert(root.computeWorldMatrix(true)); return Math.abs(Vector3.TransformCoordinates(ch.getAbsolutePosition(), inv).x); };
  const offArm = (nd, ang, sg) => { const par = nd.parent; if (!par || !nd.rotationQuaternion) return; const pw = par.computeWorldMatrix(true), inv = Matrix.Invert(pw);
    const ax = Vector3.TransformNormal(gltfRoot.getDirection(new Vector3(0, 0, 1)), inv).normalize(); nd.rotationQuaternion = Quaternion.RotationAxis(ax, ang * sg).multiply(nd.rotationQuaternion); };
  scene.onAfterAnimationsObservable.add(() => { if (!av.armOff || !root.isEnabled()) return; const ang = av.armOff * Math.PI / 180;
    for (const nd of uarms) { if (!nd.rotationQuaternion) continue;
      if (!armSign.has(nd)) { const q0 = nd.rotationQuaternion.clone(); offArm(nd, ang, 1); const xp = elbowX(nd); nd.rotationQuaternion = q0.clone(); offArm(nd, ang, -1); const xm = elbowX(nd); nd.rotationQuaternion = q0; const x0 = elbowX(nd); armSign.set(nd, xp < xm ? 1 : -1); av._armDbg = [x0, xp, xm]; }
      offArm(nd, ang, armSign.get(nd)); } });
  av.setFit = (f, vis) => { av.fit = f; av._vis = vis; const V = vis(f.top, f.outer, f.legs), up = V.upper, lo = V.lower;
    for (const k of KINDS) (byName['G_' + k] || []).forEach(x => x.setEnabled(false));
    const show = (g, kind) => { if (!g) return; (byName['G_' + kind] || []).forEach(x => x.setEnabled(true)); wear(kind, g); };
    const mk = (g) => (byName['G_' + (M3[g.id] || g.kind)] ? (M3[g.id] || g.kind) : g.kind);   // older glbs without a variant fall back to the shared kind
    if (up) show(up, mk(up));
    if (lo) show(lo, mk(lo));
    (byName.G_briefs || []).forEach(x => x.setEnabled(!lo || lo.kind === 'shorts'));
    const hood = !!up && mk(up) === 'hoodie';   // v5: seasoned hoodie / rawdwg zip are worn hood-up -> hair tucked inside
    for (const n of ['Hair', 'Curls', 'Stud']) (byName[n] || []).forEach(x => x.setEnabled(!hood));   // hood up: hair and hoops tucked inside
    const worn = ['shoes']; if (up) worn.push(mk(up)); if (lo) worn.push(mk(lo)); if (!lo || lo.kind === 'shorts') worn.push('briefs'); if (byName.G_bra) worn.push('bra');
    if (!av.noCover) coverBody(worn);
    av.armOff = (up && ARM_OFF[mk(up)]) || 0;
  };
  // speed (m/s) -> gait weights; playback rate matched to stride so feet don't skate
  const GAIT = [['idle', 0], ['walk', 1.6], ['jog', 3.2], ['sprint', 6.0]];
  av.animate = (dt, { speed = 0, dancing = false, air = false, sitting = false } = {}) => {
    const tgt = { idle: 0, walk: 0, jog: 0, sprint: 0, dance: 0, jumpLoop: 0, sit: 0 };
    if (sitting && AG.sit) tgt.sit = 1;
    else if (air && AG.jumpLoop) tgt.jumpLoop = 1;
    else if (dancing) tgt.dance = 1;
    else { let i = 0; while (i < GAIT.length - 1 && speed > GAIT[i + 1][1]) i++;
      if (i >= GAIT.length - 1) tgt.sprint = 1; else { const a = GAIT[i], b = GAIT[i + 1], u = Math.max(0, Math.min(1, (speed - a[1]) / (b[1] - a[1]))); tgt[a[0]] = 1 - u; tgt[b[0]] = u; } }
    const k = Math.min(1, dt * (air || w.jumpLoop > 0.5 ? 14 : 8));
    for (const n in w) { w[n] += (tgt[n] - w[n]) * k; const g = AG[n]; if (g) g.setWeightForAllAnimatables(w[n]); }
    const rate = (n, base) => { const g = AG[n]; if (g) g.speedRatio = Math.max(0.6, Math.min(1.5, speed / base)); };
    rate('walk', 1.6); rate('jog', 3.2); rate('sprint', 6.0);
  };
  // studio look at night: warm key from camera-left and a rim from behind, lighting only the avatar
  const lit = res.meshes.filter(m => m !== gltfRoot);
  const key = new PointLight(name + '-key', new Vector3(0, 2, 0), scene); key.diffuse = Color3.FromHexString('#ffd9b8'); key.specular = new Color3(0.05, 0.05, 0.05); key.intensity = 0.6; key.range = 9;
  const rim = new PointLight(name + '-rim', new Vector3(0, 2, 0), scene); rim.diffuse = Color3.FromHexString('#ffe6cc'); rim.specular = new Color3(0.03, 0.03, 0.03); rim.intensity = 0.32; rim.range = 9;
  const fill = new PointLight(name + '-fill', new Vector3(0, 1.4, 0), scene); fill.diffuse = Color3.FromHexString('#b9c6ff'); fill.specular = Color3.Black(); fill.intensity = 0.22; fill.range = 9;
  key.includedOnlyMeshes = lit; rim.includedOnlyMeshes = lit; fill.includedOnlyMeshes = lit;
  for (const m of new Set(lit.map(x => x.material).filter(Boolean))) m.maxSimultaneousLights = 8;
  av.lights = [key, rim, fill];
  av.lightRig = (cam) => { const p = root.position, c = cam.position; let dx = c.x - p.x, dz = c.z - p.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    key.position.set(p.x + dx * 2.2 - dz * 1.6, p.y + 2.3, p.z + dz * 2.2 + dx * 1.6); rim.position.set(p.x - dx * 2.0 + dz * 0.8, p.y + 2.0, p.z - dz * 2.0 - dx * 0.8); fill.position.set(p.x + dx * 2.0 + dz * 1.8, p.y + 1.2, p.z + dz * 2.0 - dx * 1.8); };
  if (LOOK2) { key.intensity = 0.8; rim.intensity = 0.34; fill.intensity = 0.26; }
  for (const l of av.lights) l._i0 = l.intensity;
  // exposure compensation (quality pass): scene exposure is 1.4 on the street, 1.7-2.0 in venues; keep the avatar's own light constant
  av.setExposure = (e) => { if (!LOOK2) return; const k = Math.max(0.6, Math.min(1, 1.4 / (e || 1.4))); if (av._expo === k) return; av._expo = k;
    for (const m of new Set(av.allMeshes().map(x => x.material).filter(Boolean))) { if (!m._e0) m._e0 = m.emissiveColor.clone(); m.emissiveColor.copyFrom(m._e0).scaleInPlace(k); }
    for (const l of av.lights) l.intensity = l._i0 * k; };
  av.meshes = () => res.meshes.filter(m => m !== gltfRoot && m.isEnabled());
  av.allMeshes = () => res.meshes.filter(m => m !== gltfRoot);
  return av;
}
