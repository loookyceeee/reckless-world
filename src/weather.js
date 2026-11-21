// Stage 10 weather: Belfast drizzle / rain showers. Camera-following stretched-billboard streaks (one particle system),
// a slow dry -> rain -> dry cycle (?rain forces rain, ?norain keeps it dry), fog thickens and the rain hiss rises with intensity.
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';

export function createWeather(scene, { low = false, force = null, AU = null } = {}) {
  const T = new DynamicTexture('rainT', { width: 8, height: 64 }, scene, true); { const g = T.getContext(); const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, 'rgba(210,220,255,0)'); gr.addColorStop(0.6, 'rgba(210,220,255,0.55)'); gr.addColorStop(1, 'rgba(230,235,255,0.9)'); g.fillStyle = gr; g.fillRect(3, 0, 2, 64); T.hasAlpha = true; T.update(); }
  const N = low ? 900 : 2600;
  const ps = new ParticleSystem('rain', N, scene); ps.particleTexture = T; ps.emitter = new Vector3(0, 0, 0);
  ps.minEmitBox = new Vector3(-16, 1, -16); ps.maxEmitBox = new Vector3(16, 13, 16);
  ps.direction1 = new Vector3(-0.6, -16, -0.3); ps.direction2 = new Vector3(0.4, -19, 0.5); ps.minEmitPower = 1; ps.maxEmitPower = 1;
  ps.minLifeTime = 0.15; ps.maxLifeTime = 0.75; ps.minSize = 0.16; ps.maxSize = 0.22; ps.minScaleX = 0.35; ps.maxScaleX = 0.45; ps.minScaleY = 1.4; ps.maxScaleY = 2.0;
  ps.billboardMode = ParticleSystem.BILLBOARDMODE_ALL; // the streak lives in the texture (stretched mode drew nothing on SwiftShader) ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.color1 = new Color4(0.75, 0.8, 0.95, 0.7); ps.color2 = new Color4(0.6, 0.65, 0.8, 0.5); ps.colorDead = new Color4(0.55, 0.6, 0.75, 0.35);
  ps.emitRate = 0; ps.start();
  const S = { k: 0, want: force === 'rain' ? 1 : 0, t: force === 'rain' ? 1e9 : 150 + Math.random() * 120, inside: false };
  const api = {
    get k() { return S.k; }, raining: () => S.k > 0.3,
    set(v) { S.want = v; S.t = v ? 120 + Math.random() * 120 : 240 + Math.random() * 180; },
    update(dt, cam, { inside = false } = {}) {
      if (force !== 'dry' && force !== 'rain') { S.t -= dt; if (S.t <= 0) api.set(S.want ? 0 : (Math.random() < 0.35 ? 0.45 : 1)); }
      if (force === 'dry') S.want = 0;
      S.k += (S.want - S.k) * Math.min(1, dt / 6);
      const k = inside ? 0 : S.k; ps.emitRate = k * N / 0.7; ps.emitter.copyFrom(cam.position); ps.emitter.y = 0;
      if (AU && AU.rain) AU.rain(inside ? S.k * 0.25 : k);   // muffled on the roof when inside
      return k;
    },
  };
  return api;
}
