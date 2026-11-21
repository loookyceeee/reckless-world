// Night sky: procedural equirect canvas (gradient + city-glow horizon + stars + moon + soft cloud banks) on an inverted sphere,
// plus a CC0 Poly Haven night HDRI (cobblestone_street_night, downsampled to 512x256) as a cube env for wet reflections.
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Layer } from '@babylonjs/core/Layers/layer';
import '@babylonjs/core/Layers/layerSceneComponent';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';

function rng(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

export function buildSky(scene, { low = false, hi = false } = {}) {
  const W = low ? 1024 : 2048, H = W / 2; const tex = new DynamicTexture('skyTex', { width: W, height: H }, scene, true); const g = tex.getContext(); const R = rng(7);
  // rows: y=0 top (zenith) .. y=H/2 horizon .. y=H nadir
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#060814'); gr.addColorStop(0.28, '#0c1024'); gr.addColorStop(0.42, '#171b34'); gr.addColorStop(0.48, '#1d1f35'); gr.addColorStop(0.5, '#2b2539'); gr.addColorStop(0.53, '#1a1b2b'); gr.addColorStop(1, '#141522');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // stars (fewer + dimmer toward the light-polluted horizon)
  for (let i = 0; i < (low ? 900 : 2200); i++) { const y = Math.pow(R(), 1.6) * H * 0.44, x = R() * W; const a = Math.min(1, (1 - y / (H * 0.47)) * 1.6) * (0.45 + R() * 0.55); const r = R() < 0.05 ? 1.8 : R() < 0.35 ? 1.15 : 0.8;
    g.fillStyle = `rgba(${220 + R() * 35 | 0},${225 + R() * 30 | 0},255,${a.toFixed(3)})`; g.beginPath(); g.arc(x, y, r * W / 2048, 0, 7); g.fill(); }
  // cloud banks: soft ellipses lit faintly by the city from below
  g.save(); for (let i = 0; i < (low ? 60 : 140); i++) { const y = H * (0.3 + R() * 0.18), x = R() * W, rx = W * (0.03 + R() * 0.07), ry = rx * (0.18 + R() * 0.15);
    const cg = g.createRadialGradient(x, y, 0, x, y, rx); const lit = (y / H - 0.3) / 0.18; cg.addColorStop(0, `rgba(${70 + lit * 50 | 0},${60 + lit * 30 | 0},${90 + lit * 10 | 0},${(0.1 + R() * 0.12).toFixed(3)})`); cg.addColorStop(1, 'rgba(40,35,60,0)');
    g.fillStyle = cg; g.setTransform(1, 0, 0, ry / rx, 0, y - y * ry / rx); g.beginPath(); g.arc(x, y, rx, 0, 7); g.fill(); g.setTransform(1, 0, 0, 1, 0, 0); } g.restore();
  // moon: waxing gibbous with halo, high in the south-east
  const mx = W * 0.62, my = H * 0.355, mr = W * 0.0048;
  const halo = g.createRadialGradient(mx, my, mr, mx, my, mr * 9); halo.addColorStop(0, 'rgba(200,210,255,0.35)'); halo.addColorStop(1, 'rgba(200,210,255,0)'); g.fillStyle = halo; g.beginPath(); g.arc(mx, my, mr * 9, 0, 7); g.fill();
  g.fillStyle = '#eef0ff'; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
  g.fillStyle = 'rgba(160,165,190,0.35)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(mx + (R() - 0.5) * mr * 1.1, my + (R() - 0.5) * mr * 1.1, mr * (0.12 + R() * 0.2), 0, 7); g.fill(); }
  g.save(); g.beginPath(); g.arc(mx, my, mr, 0, 7); g.clip(); g.fillStyle = 'rgba(40,44,70,0.78)'; g.beginPath(); g.arc(mx - mr * 1.25, my - mr * 0.1, mr * 0.95, 0, 7); g.fill(); g.restore(); // waxing gibbous terminator, kept inside the disc
  tex.update(); tex.wrapU = Texture.WRAP_ADDRESSMODE; tex.level = 1.25; tex.anisotropicFilteringLevel = 1;
  const m = new StandardMaterial('skyM', scene); m.emissiveTexture = tex; m.disableLighting = true; m.backFaceCulling = false; m.fogEnabled = false; m.diffuseColor = Color3.Black(); m.specularColor = Color3.Black();
  // screen-space background layer (no dome geometry): the 1000 m sphere's triangles leaked through the SSAO / glow passes as dark
  // wedges and bands near the camera. The equirect texture is windowed to the camera's yaw / pitch / FOV every frame.
  const layer = new Layer('skyLayer', null, scene, true); layer.texture = tex; tex.wrapV = Texture.CLAMP_ADDRESSMODE;
  const fwd = new Vector3();
  const sky = { name: 'sky', setEnabled: (v) => { layer.isEnabled = v; }, isEnabled: () => layer.isEnabled, layer,
    update: (cam) => { cam.getDirectionToRef(Vector3.Forward(), fwd); const yaw = Math.atan2(fwd.x, fwd.z), pitch = Math.asin(Math.max(-1, Math.min(1, fwd.y)));
      const asp = scene.getEngine().getAspectRatio(cam), vf = cam.fov, hf = 2 * Math.atan(Math.tan(vf / 2) * asp);
      tex.uScale = hf / (2 * Math.PI); tex.uOffset = yaw / (2 * Math.PI) - tex.uScale / 2; tex.vScale = vf / Math.PI; tex.vOffset = 0.5 + pitch / Math.PI - tex.vScale / 2; } };
  let env = null;
  // desktop: the 1K HDRI (1024x512) into a 256 cube for sharper wet reflections; phones keep the 512 px copy
  try { env = new HDRCubeTexture(import.meta.env.BASE_URL + (hi ? 'data/env_night_1k.hdr' : 'data/env_night_512.hdr'), scene, low ? 64 : hi ? 256 : 128, false, false, false, false); env.level = 0.4; } catch (e) { console.warn('env', e); }
  return { sky, env, mat: m, update: sky.update };
}

// wet-look reflections: grazing-angle (fresnel) env reflections on the named StandardMaterials
export function applyWet(scene, env, spec) {
  if (!env) return;
  for (const mt of scene.materials) { const k = spec[mt.name]; if (!k) continue;
    mt.reflectionTexture = env; const f = new FresnelParameters(); f.bias = k[2] || 0.1; f.power = k[3] || 2.2; f.leftColor = new Color3(k[0], k[0], k[0] * 1.05); f.rightColor = new Color3(k[1], k[1], k[1]); mt.reflectionFresnelParameters = f; }
}

// desktop wet asphalt: CC0 Poly Haven asphalt_02 wet derivative (normal + inverted roughness as a specular map) layered on the procedural tarmac
export function applyWetAsphalt(scene, { tile = 3 } = {}) {
  const mt = scene.getMaterialByName('roads'); if (!mt) return;
  const B = import.meta.env.BASE_URL + 'img/';
  const n = new Texture(B + 'wet_asph_nor.jpg', scene); n.uScale = n.vScale = tile; n.level = 0.45; n.anisotropicFilteringLevel = 8;
  const sp = new Texture(B + 'wet_asph_spec.jpg', scene); sp.uScale = sp.vScale = tile; sp.anisotropicFilteringLevel = 8;
  mt.bumpTexture = n; mt.invertNormalMapY = false; mt.specularTexture = sp; mt.specularColor = new Color3(0.62, 0.64, 0.74); mt.specularPower = 96;
  return mt;
}
