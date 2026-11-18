// RECKLESS crew avatar, smooth rigged glTF (tools/blender/build_avatar.py): CC0 Quaternius base + UAL animations,
// reshaped to the app's crew render proportions. Garments are skinned shells, swapped and tinted live from the wardrobe.
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/glTFFileLoader';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_emissive_strength';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';

const KINDS = ['tee', 'crop', 'long', 'hoodie', 'jeans', 'pants', 'cuffed', 'shorts'];
const SKIN = Color3.FromHexString('#efd9cf'), HAIR = Color3.FromHexString('#141214');

export async function loadAvatar3D(scene, { name = 'player', base = import.meta.env.BASE_URL } = {}) {
  const res = await SceneLoader.ImportMeshAsync('', base + 'models/', 'avatar.glb', scene);
  const root = new TransformNode(name, scene);
  const gltfRoot = res.meshes[0]; gltfRoot.parent = root; gltfRoot.name = name + '-gltf';
  const byName = {}; for (const m of res.meshes) { if (m === gltfRoot) continue; const n = m.name.replace(/_primitive\d+$/, '').split('.')[0]; (byName[n] = byName[n] || []).push(m); m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.name = 'av3d-' + n; }
  const mat = (id, col, { rough = 0.75 } = {}) => { const m = new StandardMaterial('av3d-' + id, scene); m.diffuseColor = col.clone(); const sp = (1 - rough) * 0.35; m.specularColor = new Color3(sp, sp, sp); m.specularPower = 24; m.ambientColor = new Color3(0.35, 0.35, 0.4); return m; };
  const skinM = mat('skin', SKIN, { rough: 0.55 });
  try { const n = new Texture(base + 'models/av_body_n.webp', scene, false, false); skinM.bumpTexture = n; skinM.bumpTexture.level = 0.6; } catch (e) { }
  const hairM = mat('hair', HAIR, { rough: 0.6 }); try { hairM.diffuseTexture = new Texture(base + 'models/av_hair.webp', scene, false, false); hairM.diffuseColor = Color3.FromHexString('#5a5252'); } catch (e) { }
  const eyeM = mat('eye', Color3.White(), { rough: 0.15 }); try { eyeM.diffuseTexture = new Texture(base + 'models/av_eye.webp', scene, false, false); } catch (e) { }
  // keep the loader's winding (glTF is right-handed): new materials must copy sideOrientation or every shell renders inside-out
  const SO = (res.meshes.find(m => m.material) || {}).material?.sideOrientation;
  const set = (n, m) => (byName[n] || []).forEach(x => { if (SO != null) m.sideOrientation = SO; x.material = m; });
  set('Body', skinM); set('Hair', hairM); set('Eyebrows', hairM); set('Eyes', eyeM);
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
  av.meshes = () => res.meshes.filter(m => m !== gltfRoot && m.isEnabled());
  av.allMeshes = () => res.meshes.filter(m => m !== gltfRoot);
  return av;
}
