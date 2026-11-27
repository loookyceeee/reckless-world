// Stage 10 weather: Belfast drizzle / rain showers. Camera-following stretched-billboard streaks (one particle system),
// a slow dry -> rain -> dry cycle (?rain forces rain, ?norain keeps it dry), fog thickens and the rain hiss rises with intensity.
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';

export function createWeather(scene, { low = false, lite = false, force = null, AU = null } = {}) {
  // glitch (g): the old streak was a hard-ended 2 px bar (alpha 0.9 at the tail) on a camera-facing (BILLBOARDMODE_ALL) quad
  // at ~10 m/s with up to 1.25 s life, so each drop read as a fixed vertical bar hanging in the air, and tilted with the camera.
  // Now: soft streak that fades at both ends, Y-axis billboard (stays world-vertical, faces the camera), faster fall with
  // a short life so every streak visibly travels, and lower alpha.
  const T = new DynamicTexture('rainT', { width: 16, height: 128 }, scene, true); { const g = T.getContext(); g.clearRect(0, 0, 16, 128);
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(220,228,255,0)'); gr.addColorStop(0.45, 'rgba(220,228,255,0.35)'); gr.addColorStop(0.8, 'rgba(230,236,255,0.5)'); gr.addColorStop(1, 'rgba(230,236,255,0)');
    g.fillStyle = gr; g.fillRect(7, 0, 2, 128); g.globalAlpha = 0.35; g.fillRect(6, 8, 4, 112); T.hasAlpha = true; T.update(); }
  const N = lite ? 300 : low ? 900 : 2600;
  const ps = new ParticleSystem('rain', N, scene); ps.particleTexture = T; ps.emitter = new Vector3(0, 0, 0);
  ps.minEmitBox = new Vector3(-16, 1, -16); ps.maxEmitBox = new Vector3(16, 13, 16);
  ps.direction1 = new Vector3(-0.8, -30, -0.4); ps.direction2 = new Vector3(0.5, -34, 0.6); ps.minEmitPower = 1; ps.maxEmitPower = 1; ps.updateSpeed = 0.012;
  ps.minLifeTime = 0.2; ps.maxLifeTime = 0.38; ps.minSize = 0.5; ps.maxSize = 0.7; ps.minScaleX = 0.09; ps.maxScaleX = 0.11; ps.minScaleY = 1; ps.maxScaleY = 1;
  ps.billboardMode = ParticleSystem.BILLBOARDMODE_Y; ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.color1 = new Color4(0.6, 0.65, 0.78, 0.45); ps.color2 = new Color4(0.5, 0.55, 0.68, 0.35); ps.colorDead = new Color4(0.45, 0.5, 0.62, 0);
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
