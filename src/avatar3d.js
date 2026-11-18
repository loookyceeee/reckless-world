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
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointLight } from '@babylonjs/core/Lights/pointLight';

const KINDS = ['tee', 'crop', 'long', 'hoodie', 'jeans', 'pants', 'cuffed', 'shorts'];
const SKIN = Color3.FromHexString('#ead3cb'), HAIR = Color3.FromHexString('#141214');

export async function loadAvatar3D(scene, { name = 'player', base = import.meta.env.BASE_URL } = {}) {
  // meshopt-compressed glb (tools/blender/build_avatar.py -> gltf-transform resample/prune/dedup/meshopt), served as .json so the
  // host brotli-compresses it (~240 KB on the wire); decoder is the local meshoptimizer build, no CDN
  MeshoptCompression.Configuration.decoder.url = base + 'models/meshopt_decoder.js';
  const res = await SceneLoader.ImportMeshAsync('', base + 'models/', 'avatar.glb.json', scene, null, '.glb');
  const root = new TransformNode(name, scene);
  const gltfRoot = res.meshes[0]; gltfRoot.parent = root; gltfRoot.name = name + '-gltf';
  const byName = {}; for (const m of res.meshes) { if (m === gltfRoot) continue; const n = m.name.replace(/_primitive\d+$/, '').split('.')[0]; (byName[n] = byName[n] || []).push(m); m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.name = 'av3d-' + n; }
  const mat = (id, col, { rough = 0.75 } = {}) => { const m = new StandardMaterial('av3d-' + id, scene); m.diffuseColor = col.clone(); const sp = (1 - rough) * 0.35; m.specularColor = new Color3(sp, sp, sp); m.specularPower = 24; m.ambientColor = new Color3(0.35, 0.35, 0.4); return m; };
  const skinM = mat('skin', SKIN, { rough: 0.55 });
  try { const n = new Texture(base + 'models/av_body_n.webp', scene, false, false); skinM.bumpTexture = n; skinM.bumpTexture.level = 0.35; } catch (e) { }
  // hair: strand texture (planar UV from the build) x fade vertex colours (dark top, stubble sides)
  const hairM = mat('hair', Color3.White(), { rough: 0.7 }); try { hairM.diffuseTexture = new Texture(base + 'models/av_hair.webp', scene, false, false); hairM.diffuseColor = new Color3(2.2, 2.1, 2.05); } catch (e) { }
  const browM = mat('brow', HAIR, { rough: 0.8 });
  const eyeM = mat('eye', Color3.White(), { rough: 0.15 }); try { eyeM.diffuseTexture = new Texture(base + 'models/av_eye.webp', scene, false, false); } catch (e) { }
  // keep the loader's winding (glTF is right-handed): new materials must copy sideOrientation or every shell renders inside-out
  const SO = (res.meshes.find(m => m.material) || {}).material?.sideOrientation;
  const set = (n, m) => (byName[n] || []).forEach(x => { if (SO != null) m.sideOrientation = SO; x.material = m; });
  set('Body', skinM); set('Hair', hairM); set('Eyebrows', browM); set('Eyes', eyeM);
  set('G_briefs', mat('briefs', Color3.FromHexString('#111113'), { rough: 0.8 }));
  set('G_shoes', mat('shoes', Color3.FromHexString('#101012'), { rough: 0.5 }));
  const gm = {}; for (const k of KINDS) { gm[k] = mat('g-' + k, Color3.White(), { rough: k === 'jeans' ? 0.9 : 0.85 }); set('G_' + k, gm[k]); (byName['G_' + k] || []).forEach(x => x.setEnabled(false)); }
  // animation groups, blended by weight
  const AG = {}; for (const g of res.animationGroups) { g.stop(); AG[g.name] = g; }
  for (const k of ['idle', 'walk', 'jog', 'sprint', 'dance']) if (AG[k]) { AG[k].start(true, 1.0); AG[k].setWeightForAllAnimatables(k === 'idle' ? 1 : 0); }
  const w = { idle: 1, walk: 0, jog: 0, sprint: 0, dance: 0 };
  const av = { root, isGlb: true, parts: byName, ag: AG, fit: null };
  av.setFit = (f, vis) => { av.fit = f; const V = vis(f.top, f.outer, f.legs), up = V.upper, lo = V.lower;
    for (const k of KINDS) (byName['G_' + k] || []).forEach(x => x.setEnabled(false));
    const show = (g, kind) => { if (!g) return; (byName['G_' + kind] || []).forEach(x => x.setEnabled(true)); gm[kind].diffuseColor = Color3.FromHexString(g.col); };
    if (up) show(up, up.id === 'see-me-crop' ? 'crop' : up.kind);
    if (lo) show(lo, lo.kind);
    (byName.G_briefs || []).forEach(x => x.setEnabled(!lo || lo.kind === 'shorts'));
  };
  // speed (m/s) -> gait weights; playback rate matched to stride so feet don't skate
  const GAIT = [['idle', 0], ['walk', 1.6], ['jog', 3.2], ['sprint', 6.0]];
  av.animate = (dt, { speed = 0, dancing = false } = {}) => {
    const tgt = { idle: 0, walk: 0, jog: 0, sprint: 0, dance: 0 };
    if (dancing) tgt.dance = 1;
    else { let i = 0; while (i < GAIT.length - 1 && speed > GAIT[i + 1][1]) i++;
      if (i >= GAIT.length - 1) tgt.sprint = 1; else { const a = GAIT[i], b = GAIT[i + 1], u = Math.max(0, Math.min(1, (speed - a[1]) / (b[1] - a[1]))); tgt[a[0]] = 1 - u; tgt[b[0]] = u; } }
    const k = Math.min(1, dt * 8);
    for (const n in w) { w[n] += (tgt[n] - w[n]) * k; const g = AG[n]; if (g) g.setWeightForAllAnimatables(w[n]); }
    const rate = (n, base) => { const g = AG[n]; if (g) g.speedRatio = Math.max(0.6, Math.min(1.5, speed / base)); };
    rate('walk', 1.6); rate('jog', 3.2); rate('sprint', 6.0);
  };
  // studio look at night: warm key from camera-left and a rim from behind, lighting only the avatar
  const lit = res.meshes.filter(m => m !== gltfRoot);
  const key = new PointLight(name + '-key', new Vector3(0, 2, 0), scene); key.diffuse = Color3.FromHexString('#ffd9b8'); key.specular = new Color3(0.1, 0.09, 0.08); key.intensity = 0.85; key.range = 9;
  const rim = new PointLight(name + '-rim', new Vector3(0, 2, 0), scene); rim.diffuse = Color3.FromHexString('#ffe6cc'); rim.specular = new Color3(0.18, 0.16, 0.14); rim.intensity = 0.9; rim.range = 9;
  key.includedOnlyMeshes = lit; rim.includedOnlyMeshes = lit;
  for (const m of new Set(lit.map(x => x.material).filter(Boolean))) m.maxSimultaneousLights = 8;
  av.lights = [key, rim];
  av.lightRig = (cam) => { const p = root.position, c = cam.position; let dx = c.x - p.x, dz = c.z - p.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    key.position.set(p.x + dx * 2.2 - dz * 1.6, p.y + 2.3, p.z + dz * 2.2 + dx * 1.6); rim.position.set(p.x - dx * 2.0 + dz * 0.8, p.y + 2.0, p.z - dz * 2.0 - dx * 0.8); };
  av.meshes = () => res.meshes.filter(m => m !== gltfRoot && m.isEnabled());
  av.allMeshes = () => res.meshes.filter(m => m !== gltfRoot);
  return av;
}
