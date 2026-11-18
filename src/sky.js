// Night sky: procedural equirect canvas (gradient + city-glow horizon + stars + moon + soft cloud banks) on an inverted sphere,
// plus a CC0 Poly Haven night HDRI (cobblestone_street_night, downsampled to 512x256) as a cube env for wet reflections.
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { FresnelParameters } from '@babylonjs/core/Materials/fresnelParameters';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';

function rng(s) { return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

export function buildSky(scene, { low = false } = {}) {
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
  const mx = W * 0.62, my = H * 0.2, mr = W * 0.0085;
  const halo = g.createRadialGradient(mx, my, mr, mx, my, mr * 9); halo.addColorStop(0, 'rgba(200,210,255,0.35)'); halo.addColorStop(1, 'rgba(200,210,255,0)'); g.fillStyle = halo; g.beginPath(); g.arc(mx, my, mr * 9, 0, 7); g.fill();
  g.fillStyle = '#eef0ff'; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
  g.fillStyle = 'rgba(160,165,190,0.35)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(mx + (R() - 0.5) * mr * 1.1, my + (R() - 0.5) * mr * 1.1, mr * (0.12 + R() * 0.2), 0, 7); g.fill(); }
  g.fillStyle = 'rgba(10,12,28,0.55)'; g.beginPath(); g.arc(mx - mr * 1.35, my, mr * 1.05, 0, 7); g.fill();
  tex.update(); tex.wrapU = Texture.WRAP_ADDRESSMODE; tex.level = 1.25; tex.anisotropicFilteringLevel = 1;
  const m = new StandardMaterial('skyM', scene); m.emissiveTexture = tex; m.disableLighting = true; m.backFaceCulling = false; m.fogEnabled = false; m.diffuseColor = Color3.Black(); m.specularColor = Color3.Black();
  const sky = CreateSphere('sky', { diameter: 1000, segments: 32, sideOrientation: Mesh.BACKSIDE }, scene); { const P = sky.getVerticesData('position'), uv = Float32Array.from(sky.getVerticesData('uv')); for (let i = 0; i < P.length / 3; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], r = Math.hypot(x, y, z) || 1; uv[i * 2 + 1] = 0.5 + Math.asin(y / r) / Math.PI; } sky.setVerticesData('uv', uv); }
  sky.material = m; sky.infiniteDistance = true; sky.isPickable = false; sky.applyFog = false; sky.renderingGroupId = 0;
  m.freeze();
  let env = null;
  try { env = new HDRCubeTexture(import.meta.env.BASE_URL + 'data/env_night_512.hdr', scene, low ? 64 : 128, false, false, false, false); env.level = 0.4; } catch (e) { console.warn('env', e); }
  return { sky, env, mat: m };
}

// wet-look reflections: grazing-angle (fresnel) env reflections on the named StandardMaterials
export function applyWet(scene, env, spec) {
  if (!env) return;
  for (const mt of scene.materials) { const k = spec[mt.name]; if (!k) continue;
    mt.reflectionTexture = env; const f = new FresnelParameters(); f.bias = k[2] || 0.1; f.power = k[3] || 2.2; f.leftColor = new Color3(k[0], k[0], k[0] * 1.05); f.rightColor = new Color3(k[1], k[1], k[1]); mt.reflectionFresnelParameters = f; }
}
