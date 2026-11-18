import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves';
import '@babylonjs/core/Rendering/prePassRendererSceneComponent';
import '@babylonjs/core/Rendering/geometryBufferRendererSceneComponent';
import '@fontsource/unbounded/700.css'; import '@fontsource/unbounded/800.css';
import '@fontsource/dm-sans/400.css'; import '@fontsource/dm-sans/600.css'; import '@fontsource/dm-sans/700.css';
import './style.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Tools } from '@babylonjs/core/Misc/tools';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import '@babylonjs/core/Misc/screenshotTools';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import '@babylonjs/core/Meshes/thinInstanceMesh'; import '@babylonjs/core/Meshes/instancedMesh';
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.dynamicTexture'; import '@babylonjs/core/Engines/Extensions/engine.dynamicTexture';
import '@babylonjs/core/Rendering/edgesRenderer';
import '@babylonjs/core/Animations/animatable';
import { buildCity, updateCity } from './city.js';
import { chunkStatic, freezeMaterials, TIERS } from './perf.js';
import { buildSky, applyWet } from './sky.js';
import { createAudio } from './audio.js';
import { buildFlavour, buildWetStreaks } from './flavour.js';
import { buildTempleExterior, updateTempleExterior, buildTempleInterior, setTempleMode, updateTempleInterior, INTERIOR_ORIGIN } from './temple.js';
import { createAvatar, animateAvatar, OUTFITS, loadAnims, bakeCrowdVariants } from './character.js';
import { buildGraph, buildTraffic, updateTraffic } from './traffic.js';
import { buildLandmarks, updateLandmarks } from './landmarks.js';
import { createHUD, buildMinimapBase, loadMinimapImage, makeRouter } from './hud.js';
import { VENUES, DISTRICTS, POSTER_SPOTS } from './venues.js';
import * as CR from './crew.js';
import { createMusic } from './music.js';
import { SegGrid } from './collide.js';
import * as EV from './events.js';
import { torus, xf, plane, toMesh, hex } from './geo.js';

const Q = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const LOW = Q.has('low') || (isTouch && Math.min(screen.width, screen.height) < 900);
const app = { title: true, paused: false, inside: false, live: !Q.has('nolive'), keys: new Set(), key: null };
window.__rw = { ready: false, app };

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
async function makeEngine(canvas) {
  if (!Q.has('webgl') && navigator.gpu) {
    try {
      const adapter = await withTimeout(navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }), 2500);
      if (adapter && !(adapter.info && /swiftshader/i.test(adapter.info.vendor + adapter.info.architecture + adapter.info.description))) {
        const e = new WebGPUEngine(canvas, { antialias: !LOW, adaptToDeviceRatio: false }); await withTimeout(e.initAsync(), 6000); e.__kind = 'WebGPU'; return e;
      }
    } catch (err) { console.warn('WebGPU unavailable, using WebGL2', err); }
  }
  const e = new Engine(canvas, !LOW, { preserveDrawingBuffer: true, stencil: true, powerPreference: 'high-performance' }, false); e.__kind = 'WebGL' + e.webGLVersion; return e;
}
async function start() {
  const canvas = document.getElementById('c');
  const bar = (p) => { const b = document.getElementById('lbar'); if (b) b.style.width = p + '%'; };
  const engine = await makeEngine(canvas); bar(15);
  engine.setHardwareScalingLevel(LOW ? 1.5 : 1 / Math.min(1.5, devicePixelRatio || 1));
  const scene = new Scene(engine); scene.skipPointerMovePicking = true;
  const NIGHT = new Color4(0.07, 0.075, 0.14, 1);
  scene.clearColor = NIGHT; scene.ambientColor = new Color3(0.2, 0.2, 0.25);
  scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.0028; scene.fogColor = new Color3(0.1, 0.105, 0.17);
  const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.2), scene); hemi.intensity = 1.0; hemi.diffuse = hex('#9aa6cc'); hemi.groundColor = hex('#2a2426'); hemi.specular = new Color3(0.2, 0.2, 0.3);
  const moon = new DirectionalLight('moon', new Vector3(-0.4, -0.8, 0.5), scene); moon.intensity = 0.45; moon.diffuse = hex('#b8c4ff'); moon.specular = new Color3(0.3, 0.3, 0.4);
  const cam = new FreeCamera('cam', new Vector3(0, 5, -10), scene); cam.minZ = 0.1; cam.maxZ = 900; cam.fov = 0.95; cam.inputs.clear(); const cam0 = cam;
  const glow = LOW ? null : new GlowLayer('glow', scene, { mainTextureRatio: 0.35, blurKernelSize: 48 }); if (glow) glow.intensity = 0.7;
  // cinematic pipeline: gentle bloom, ACES filmic tone mapping, contrast grade, vignette, light grain, FXAA (+ SSAO on ?ssao)
  let pipe = null, SSAO = null;
  try {
    pipe = new DefaultRenderingPipeline('cine', true, scene, [cam0]);
    pipe.fxaaEnabled = true; pipe.bloomEnabled = !LOW; pipe.bloomThreshold = 0.72; pipe.bloomWeight = 0.32; pipe.bloomKernel = 48; pipe.bloomScale = 0.5;
    pipe.imageProcessingEnabled = true; const ip = pipe.imageProcessing; ip.toneMappingEnabled = true; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = 1.4; ip.contrast = 1.1;
    ip.vignetteEnabled = true; ip.vignetteWeight = 2.2; ip.vignetteColor = new Color4(0, 0, 0, 0); ip.vignetteStretch = 0.2;
    ip.colorCurvesEnabled = true; const cc = new ColorCurves(); cc.globalSaturation = -4; cc.shadowsHue = 215; cc.shadowsDensity = 22; cc.shadowsSaturation = 35; cc.highlightsHue = 40; cc.highlightsDensity = 6; cc.highlightsSaturation = 8; ip.colorCurves = cc;
    pipe.grainEnabled = !LOW; pipe.grain.intensity = 6; pipe.grain.animated = true;
    // SSAO (desktop high tier by default; ?nossao off, ?ssao forces it): soft contact shadows in doorways, kerbs and crowds
    if ((!isTouch && !Q.has('nossao')) || Q.has('ssao')) { try { SSAO = new SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [cam0]); SSAO.radius = 1.4; SSAO.totalStrength = 1.0; SSAO.base = 0.12; SSAO.samples = 12; SSAO.maxZ = 220; SSAO.expensiveBlur = true; SSAO._rwOn = true; } catch (e) { SSAO = null; console.warn('ssao', e); } }
  } catch (e) { console.warn('pipeline', e); }
  await document.fonts.ready;
  await loadAnims(import.meta.env.BASE_URL + 'data/anims.json').catch(e => console.warn('anims', e));

  const city = await buildCity(scene, { low: LOW }); bar(55);
  const SKY = buildSky(scene, { low: LOW }); scene.__env = SKY.env;
  applyWet(scene, SKY.env, { roads: [0.5, 0.02, 0.04, 2.5], puddle: [1.0, 0.4, 0.3, 1.6], markings: [0.3, 0.02], pavement: [0.12, 0.0, 0.02, 3.5] });
  // perf: split merged + thin-instanced static city meshes into 96 m cells, freeze them, distance-cull per tier
  const culler = Q.has('nochunk') ? null : chunkStatic(city.root, { cell: Number(Q.get('cell')) || 128, skip: city.beacons.map(b => b.m.name) });
  freezeMaterials(scene, ['trunk', 'leaf', 'furn', 'lampPoleM', 'pave', 'roads', 'pavement', 'markings']);
  const templeB = city.buildings.find(b => b.temple);
  const ext = buildTempleExterior(scene, templeB, city.grid); ext.root.parent = city.root;
  const T = buildTempleInterior(scene, { glow, low: LOW, bakeCrowd: () => bakeCrowdVariants(scene, { lod: LOW ? 0.28 : 0.33, simplify: Q.has('nosimp') ? 0 : 0.3 }), makeDancer: (i) => { const a = createAvatar(scene, { name: 'dancer' + i, outfit: ['skate', 'stan', 'stanfull', 'stanfull', 'skate', 'stan'][i], decals: true, lod: 0.5 }); return a; } });
  T.cam = cam;
  T.root.setEnabled(false);
  const tGrid = new SegGrid(8); for (const s of T.segs) tGrid.add(s[0], s[1], s[2], s[3], 99);
  const LM = buildLandmarks(scene, city, city.grid); LM.root.parent = city.root;
  city.templeDoor = ext.doorPos; const traffic = buildTraffic(scene, city, { low: LOW, stops: (city.sf && city.sf.stops) || [], signals: (city.sf && city.sf.signals) || [] }); bar(85);
  const route = makeRouter(buildGraph(city.roads, false)); let routeT = 0;
  // player
  const player = createAvatar(scene, { name: 'player', outfit: 'skate', fit: true });
  const CREW = { fit: CR.loadFit(), xp: null, account: CR.getAccount() };
  const applyFit = (f) => { CREW.fit = f; CR.saveFit(f); player.setFit(f, CR.visibleFor); }; applyFit(CREW.fit);
  const loadCrew = async () => { if (!CREW.account) return; try { const r = await CR.readCrew(CREW.account); if (r) { CREW.xp = r.xp; if (r.fit.top || r.fit.outer || r.fit.legs) applyFit(r.fit); } } catch (e) { } }; loadCrew();
  const P = { x: ext.spawn.x, z: ext.spawn.z, heading: 0, speed: 0, dancing: false };
  { const dx = ext.doorPos.x - P.x, dz = ext.doorPos.z - P.z; P.heading = Math.atan2(dx, dz); }
  // footstep dust puffs when sprinting
  const dustT = new DynamicTexture('dustT', 64, scene, true); { const g = dustT.getContext(); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(200,200,210,0.6)'); gr.addColorStop(1, 'rgba(200,200,210,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); dustT.hasAlpha = true; dustT.update(); }
  const dust = new ParticleSystem('dust', LOW ? 60 : 160, scene); dust.particleTexture = dustT; dust.emitter = new Vector3(0, 0.05, 0); dust.minEmitBox = new Vector3(-0.15, 0, -0.15); dust.maxEmitBox = new Vector3(0.15, 0, 0.15);
  dust.color1 = new Color4(0.75, 0.75, 0.8, 0.35); dust.color2 = new Color4(0.6, 0.6, 0.68, 0.25); dust.colorDead = new Color4(0.5, 0.5, 0.55, 0); dust.minSize = 0.15; dust.maxSize = 0.45; dust.minLifeTime = 0.35; dust.maxLifeTime = 0.8;
  dust.emitRate = 0; dust.direction1 = new Vector3(-0.4, 0.6, -0.4); dust.direction2 = new Vector3(0.4, 1.0, 0.4); dust.minEmitPower = 0.3; dust.maxEmitPower = 0.8; dust.gravity = new Vector3(0, -0.3, 0); dust.blendMode = ParticleSystem.BLENDMODE_STANDARD; dust.start();
  const C = { yaw: P.heading, pitch: 0.22, dist: 6.2, curDist: 6.2 };
  // markers: entrance rings + warehouse sign + poster spots
  const ringM = new StandardMaterial('ring', scene); ringM.emissiveColor = new Color3(1, 1, 1); ringM.disableLighting = true; ringM.alpha = 0.85;
  const mkRing = (x, z, n) => { const r = toMesh(n, xf(torus(2.6, 0.12, 40), { t: [0, 0.15, 0] }), scene, ringM); r.position.set(x, 0, z); r.parent = city.root; return r; };
  const templeRing = mkRing(ext.doorPos.x, ext.doorPos.z, 'templeRing');
  const cm = city.buildings.find(b => b.n === 'Common Market'); let whDoor = { x: VENUES[1].x, z: VENUES[1].z };
  if (cm) { const dun = city.roads.filter(r => r.nm === 'Dunbar Street').flatMap(r => r.pts); let best = 1e9;
    for (let i = 0; i < cm.pts.length; i++) { const a = cm.pts[i], b = cm.pts[(i + 1) % cm.pts.length]; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      for (const p of dun) { const d = Math.hypot(p[0] - m[0], p[1] - m[1]); if (d < best) { best = d; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); whDoor = { x: m[0] + (b[1] - a[1]) / L * 2.5, z: m[1] - (b[0] - a[0]) / L * 2.5, nx: (b[1] - a[1]) / L, nz: -(b[0] - a[0]) / L, wx: m[0], wz: m[1] }; } } } }
  mkRing(whDoor.x, whDoor.z, 'whRing');
  const signTex = (txt, w = 1024, h = 192) => { const t = new (window.__DT)(txt, { width: w, height: h }, scene, true); const c = t.getContext(); c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#fff'; let fs = Math.min(96, h * 0.55); do { c.font = `800 ${fs}px Unbounded`; fs -= 3; } while (c.measureText(txt).width > w - 70 && fs > 20); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 4); t.update(); return t; };
  window.__DT = DynamicTexture;
  if (whDoor.nx !== undefined) { const sm = new StandardMaterial('whSign', scene); sm.emissiveTexture = signTex('THE WARE-HOUSE XL'); sm.disableLighting = true; sm.backFaceCulling = false;
    const s = toMesh('whSign', plane(9, 1.7), scene, sm); s.position.set(whDoor.wx + whDoor.nx * 0.3, 6.5, whDoor.wz + whDoor.nz * 0.3); s.rotation.y = Math.atan2(-whDoor.nx, -whDoor.nz); s.parent = city.root; }
  { const sm = new StandardMaterial('tSign', scene); sm.emissiveTexture = signTex('THE TEMPLE'); sm.disableLighting = true; sm.backFaceCulling = false;
    const s = toMesh('tSign', plane(6, 1.1), scene, sm); s.position.set(ext.doorPos.x, 4.6, ext.doorPos.z); s.position.addInPlace(new Vector3(Math.sin(ext.yaw), 0, Math.cos(ext.yaw)).scale(0.9)); s.rotation.y = ext.yaw; s.parent = city.root; }
  // other Reckless venues in the world: fascia sign on the real facade nearest the venue point + entrance ring + prompt
  const venueDoors = [];
  for (const v of VENUES.filter(v => v.inSlice && ['thompsons', 'terminus', 'warehouse'].includes(v.id))) {
    let best = null, bd = 1e9; for (const sg of city.grid.near(v.x, v.z, 45)) { const dx = sg.x1 - sg.x0, dz = sg.z1 - sg.z0, L2 = dx * dx + dz * dz; if (L2 < 30 || sg.h < 3 || sg.h === 30.5) continue; const L = Math.sqrt(L2), m0 = Math.min(0.45, 3.2 / L);
      const t = Math.max(m0, Math.min(1 - m0, ((v.x - sg.x0) * dx + (v.z - sg.z0) * dz) / L2)); const px = sg.x0 + dx * t, pz = sg.z0 + dz * t, d = Math.hypot(px - v.x, pz - v.z);
      if (d < bd) { let nx = -dz / L, nz = dx / L; if ((px - v.x) * nx + (pz - v.z) * nz < 0) { nx = -nx; nz = -nz; } bd = d; best = { wx: px, wz: pz, nx, nz, h: sg.h }; } }
    if (!best) continue; const door = { v, x: best.wx + best.nx * 2.5, z: best.wz + best.nz * 2.5 }; venueDoors.push(door); mkRing(door.x, door.z, 'ring-' + v.id);
    const sm = new StandardMaterial('vSign-' + v.id, scene); sm.emissiveTexture = signTex(v.name); sm.disableLighting = true; sm.backFaceCulling = false;
    const sgn = toMesh('vSign-' + v.id, plane(v.name.length > 10 ? 7.5 : 5.5, 1.3), scene, sm); sgn.position.set(best.wx + best.nx * 0.35, Math.min(5.2, best.h - 0.8), best.wz + best.nz * 0.35); sgn.rotation.y = Math.atan2(-best.nx, -best.nz); sgn.parent = city.root;
    if (v.nostalgia) { const nm = new StandardMaterial('vSignN', scene); nm.emissiveTexture = signTex('EST. · NOSTALGIA', 1024, 128); nm.disableLighting = true; nm.backFaceCulling = false;
      const n2 = toMesh('vSignN', plane(4.2, 0.5), scene, nm); n2.position.copyFrom(sgn.position); n2.position.y -= 1.05; n2.rotation.y = sgn.rotation.y; n2.parent = city.root; n2.visibility = 0.75; }
  }
  window.__rw.venueDoors = venueDoors;
  const FL = buildFlavour(scene, city, { low: LOW }); const WET = buildWetStreaks(scene, city.sf && city.sf.lamps, { low: LOW });
  // posters: snap each spot to the nearest wall
  const posterM = new StandardMaterial('poster', scene); posterM.emissiveTexture = signTex('RECKLESS', 512, 720); posterM.disableLighting = true;
  { const c = posterM.emissiveTexture.getContext(); c.fillStyle = '#000'; c.fillRect(0, 0, 512, 720); const img = new Image(); img.src = import.meta.env.BASE_URL + 'img/logo.png'; await img.decode().catch(() => {}); c.drawImage(img, 56, 140, 400, 347); c.fillStyle = '#fff'; c.font = '800 54px Unbounded'; c.textAlign = 'center'; c.fillText('RECKLESS', 256, 580); c.font = '600 30px "DM Sans"'; c.fillText('BELFAST · THE TEMPLE', 256, 640); posterM.emissiveTexture.update(); }
  const posters = POSTER_SPOTS.map(sp => { let best = null, bd = 1e9; for (const s of city.grid.near(sp.x, sp.z, 40)) { const dx = s.x1 - s.x0, dz = s.z1 - s.z0, L2 = dx * dx + dz * dz; if (L2 < 4 || s.h === 30.5 || s.h < 3) continue; let t = ((sp.x - s.x0) * dx + (sp.z - s.z0) * dz) / L2; t = Math.max(0.2, Math.min(0.8, t)); const px = s.x0 + dx * t, pz = s.z0 + dz * t; const d = Math.hypot(px - sp.x, pz - sp.z); if (d < bd) { bd = d; const L = Math.sqrt(L2); best = { x: px, z: pz, nx: dz / L, nz: -dx / L }; } }
    if (!best) return null; const m = toMesh('poster-' + sp.id, plane(1.2, 1.7), scene, posterM); m.position.set(best.x + best.nx * 0.05, 2.1, best.z + best.nz * 0.05); m.rotation.y = Math.atan2(-best.nx, -best.nz); m.scaling.x = -1; m.parent = city.root; m.setEnabled(!!localStorage.getItem('rw.poster.' + sp.id));
    return { ...sp, mesh: m, ix: best.x + best.nx * 1.4, iz: best.z + best.nz * 1.4 }; }).filter(Boolean);

  if (glow) { const GX = ['walls', 'roads', 'roofs', 'ground', 'pool', 'poolLED', 'canopy', 'trunk', 'lampPole', 'hlBeam', 'pavement', 'markings', 'puddles', 'bollards', 'railings', 'signalPoles', 'beaconPoles', 'kerbs']; for (const me of scene.meshes) { const base = ((me.metadata && me.metadata.chunkOf) || me.name).split(','); if (base.some(b => GX.includes(b))) glow.addExcludedMesh(me); }
    for (const me of scene.meshes) if (/-(body|head|skate|stan|barrel|stanb)$/.test(me.name) || me.name.startsWith('car-') || me.name === 'ci') glow.addExcludedMesh(me); }
  if (glow) for (const me of T.glowSkip()) glow.addExcludedMesh(me);
  let mapBase = buildMinimapBase(city);
  try { const meta = await (await fetch(import.meta.env.BASE_URL + 'data/minimap_meta.json')).json(); const im = await loadMinimapImage(import.meta.env.BASE_URL + 'data/' + meta.file, meta); if (im) mapBase = Object.assign(im, { bounds: mapBase.bounds, proc: mapBase }); } catch (e) { console.warn('minimap', e); }
  app.mapBase = mapBase;
  const hud = createHUD(app);
  hud.setLive(app.live);
  // ---------- input ----------
  const K = app.keys;
  addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; K.add(e.code); const k = e.key.toLowerCase(); if ('emfopclnk'.includes(k) && k.length === 1) app.key(k); if (e.code === 'Escape') hud.close(); });
  addEventListener('keyup', (e) => K.delete(e.code));
  let drag = null; const stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 }; const look = { id: null, x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') { if (e.clientX < innerWidth * 0.45 && stick.id === null) { stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; hud.$('stick').style.cssText = `left:${e.clientX - 60}px;top:${e.clientY - 60}px;opacity:1`; } else if (look.id === null) { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; } }
    else { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === stick.id) { let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const d = Math.hypot(dx, dy); if (d > 50) { dx *= 50 / d; dy *= 50 / d; } stick.x = dx / 50; stick.y = dy / 50; hud.$('nub').style.transform = `translate(${dx}px,${dy}px)`; }
    else if (e.pointerId === look.id) { C.yaw += (e.clientX - look.x) * 0.006; C.pitch = Math.max(-0.35, Math.min(1.25, C.pitch + (e.clientY - look.y) * 0.004)); look.x = e.clientX; look.y = e.clientY; }
    else if (drag) { C.yaw += (e.clientX - drag.x) * 0.005; C.pitch = Math.max(-0.35, Math.min(1.25, C.pitch + (e.clientY - drag.y) * 0.004)); drag.x = e.clientX; drag.y = e.clientY; }
  });
  const up = (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; hud.$('nub').style.transform = ''; hud.$('stick').style.opacity = 0.45; } if (e.pointerId === look.id) look.id = null; drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { C.dist = Math.max(2.2, Math.min(14, C.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });
  let touchRun = false; hud.$('tRun').addEventListener('pointerdown', (e) => { e.stopPropagation(); touchRun = !touchRun; hud.$('tRun').classList.toggle('on', touchRun); });
  hud.$('tAct').addEventListener('pointerdown', (e) => { e.stopPropagation(); app.key('e'); });
  if (isTouch) document.body.classList.add('is-touch');

  // ---------- interactions ----------
  let interact = null;
  const fadeTo = async (fn) => { hud.fade(true); await new Promise(r => setTimeout(r, 380)); await fn(); await new Promise(r => setTimeout(r, 120)); hud.fade(false); };
  const cityLights = [hemi, moon, ext.light];
  const enterTemple = async () => fadeTo(() => {
    app.inside = true; city.root.setEnabled(false); SKY.sky.setEnabled(false); FL.setEnabled(false); WET.setEnabled(false); traffic.cars.forEach(c => c.node.setEnabled(false)); traffic.parked.forEach(c => c.node.setEnabled(false)); traffic.peds.forEach(p => p.av.root.setEnabled(false));
    cityLights.forEach(l => l.setEnabled(false)); Object.values(T.lights).forEach(l => l.setEnabled(true)); T.root.setEnabled(true); if (glow) glow.intensity = 0.55; if (pipe) pipe.imageProcessing.exposure = 2.0;
    setTempleMode(T, scene, Q.get('lights') === 'day' ? 'day' : 'rave'); hud.interior(true, T.mode);
    P.x = T.spawn.x; P.z = T.spawn.z; P.heading = 0; C.yaw = 0; C.pitch = 0.16; C.dist = 4.6; C.curDist = 4.6; // hero view: the chancel arch
    EV.raveEnter('The Temple'); hud.toast('THE TEMPLE · CARLISLE CIRCUS');
  });
  const exitTemple = async () => fadeTo(async () => {
    app.inside = false; T.root.setEnabled(false); Object.values(T.lights).forEach(l => l.setEnabled(false)); cityLights.forEach(l => l.setEnabled(true)); if (glow) glow.intensity = 0.7; if (pipe) pipe.imageProcessing.exposure = 1.4;
    city.root.setEnabled(true); SKY.sky.setEnabled(true); FL.setEnabled(true); WET.setEnabled(true); traffic.cars.forEach(c => c.node.setEnabled(true)); traffic.parked.forEach(c => c.node.setEnabled(true)); traffic.peds.forEach(p => { p.av.root.setEnabled(true); p._on = undefined; });
    scene.clearColor = NIGHT; scene.fogDensity = 0.0028; scene.fogColor = new Color3(0.1, 0.105, 0.17); hud.interior(false);
    P.x = ext.doorPos.x - Math.sin(ext.yaw) * 2.5; P.z = ext.doorPos.z - Math.cos(ext.yaw) * 2.5; P.heading = ext.yaw + Math.PI; C.yaw = P.heading; C.pitch = 0.2; C.dist = 6.2;
    await EV.raveExit();
  });
  const AU = createAudio();
  const MU = createMusic({ onState: (m) => { AU.beatOff = m.playing; const np = document.getElementById('np'); if (np) { np.innerHTML = m.playing && m.title ? `♪ ${m.title.toUpperCase()} · RECKLESS RAVES ON SOUNDCLOUD` : (m.failed ? '♪ RECKLESS BEAT (SOUNDCLOUD UNAVAILABLE)' : ''); np.href = m.link; } } });
  window.__rw.MU = MU;
  const sndLbl = () => { const b = document.getElementById('sndBtn'); if (b) b.textContent = 'SOUND: ' + (AU.on ? 'ON' : 'OFF'); if (AU.on && !Q.has('nosc')) MU.start(); else MU.pause(); };
  addEventListener('pointerdown', () => { if (!app.title && !AU.on && !app._snd) { app._snd = 1; AU.unlock(); sndLbl(); } }, { once: false });
  app.key = (k) => {
    if (k === 'n') { AU.toggle(); sndLbl(); return; }
    if (k === 'k') { MU.next(); return; }
    if (k === 'c') { if (hud.isOpen()) return hud.close(); hud.openCredits(`<button id="exp">EXPORT TEST EVENTS (${EV.queue().length})</button><button id="livebtn">RAVE MODE: ${app.live ? 'ON' : 'OFF'}</button>`);
      document.getElementById('exp').onclick = () => EV.exportQueue(); document.getElementById('livebtn').onclick = (e) => { app.live = !app.live; hud.setLive(app.live); e.target.textContent = 'RAVE MODE: ' + (app.live ? 'ON' : 'OFF'); }; return; }
    if (k === 'm') { if (hud.isOpen()) return hud.close(); return hud.openMap(P); }
    if (k === 'o') { if (hud.isOpen()) return hud.close(); const reopen = () => { hud.close(); app.key('o'); };
      return hud.openWardrobe(CR, { fit: { ...CREW.fit }, xp: CREW.xp, account: CREW.account, email: EV.getEmail(), setEmail: EV.setEmail, apply: applyFit,
        signIn: async (e) => { CREW.account = await CR.signIn(e); await loadCrew(); reopen(); }, signOut: () => { CR.signOut(); CREW.account = null; CREW.xp = null; reopen(); } }); }
    if (k === 'f') { P.dancing = !P.dancing; return; }
    if (k === 'l' && app.inside) { setTempleMode(T, scene, T.mode === 'day' ? 'rave' : 'day'); hud.interior(true, T.mode); return; }
    if (k === 'p') return photo();
    if (k === 'e' && interact) return interact.act();
  };
  const photo = async () => {
    hud.hud.classList.add('hidden-for-photo');
    const data = await Tools.CreateScreenshotUsingRenderTargetAsync(engine, cam, { width: 1280, height: 1600 > innerHeight ? 720 : 720 });
    hud.hud.classList.remove('hidden-for-photo');
    const img = new Image(); img.src = data; await img.decode();
    const c = document.createElement('canvas'); c.width = 1360; c.height = 900; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 40, 40, 1280, 720);
    const logo = new Image(); logo.src = import.meta.env.BASE_URL + 'img/logo.png'; await logo.decode(); g.drawImage(logo, 40, 784, 96, 83);
    g.fillStyle = '#fff'; g.font = '800 34px Unbounded'; g.fillText('RECKLESS WORLD', 156, 826); g.font = '600 22px "DM Sans"'; g.fillText((app.inside ? 'THE TEMPLE' : (state.street || 'BELFAST')) + ' · BELFAST', 158, 862);
    g.textAlign = 'right'; g.font = '600 18px "DM Sans"'; g.fillText('RECKLESSRAVES.CO.UK', 1320, 862);
    const a = document.createElement('a'); a.download = 'reckless-world.png'; a.href = c.toDataURL('image/png'); a.click(); hud.toast('PHOTO SAVED');
  };

  // ---------- state helpers ----------
  const state = { street: '', district: '' };
  const nearestStreet = () => { let best = null, bd = 28; for (const r of city.roads) { if (!r.nm) continue; for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1; let t = ((P.x - a[0]) * dx + (P.z - a[1]) * dz) / L2; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(P.x - a[0] - dx * t, P.z - a[1] - dz * t); if (d < bd) { bd = d; best = r.nm; } } } return best ? best.toUpperCase() : ''; };
  const nearestDistrict = () => { let best = DISTRICTS[0], bd = 1e9; for (const d of DISTRICTS) { const v = Math.hypot(P.x - d.x, P.z - d.z) / d.r; if (v < bd) { bd = v; best = d; } } return best.name; };
  let slowT = 0, fpsT = 0, fpsAcc = [], t = 0;
  const camPos = new Vector3(), tgt = new Vector3(), smPos = new Vector3(), smTgt = new Vector3(); let camSnap = true;
  // cinematic title flyover: high over St Anne's + the Spire of Hope, down Donegall Street, up Clifton Street to the Temple
  const dX = ext.doorPos.x, dZ = ext.doorPos.z; const _sl = Math.hypot(ext.spawn.x - dX, ext.spawn.z - dZ) || 1; const fwx = (ext.spawn.x - dX) / _sl, fwz = (ext.spawn.z - dZ) / _sl;
  const KP = [[420, 120, -520], [250, 55, -330], [60, 34, -120], [-70, 20, 20], [-200, 32, 130], [dX + fwx * 120, 38, dZ + fwz * 120], [dX + fwx * 44, 7.5, dZ + fwz * 44]].map(a => new Vector3(...a));
  const KT = [[146, 30, -249], [146, 45, -249], [-40, 6, -10], [-200, 6, 120], [dX, 6, dZ], [dX, 8, dZ], [dX, 8.5, dZ]].map(a => new Vector3(...a));
  // auto quality tier (low/med/high): ?q=low|med|high pins it, otherwise start med on phones / high on desktop and adapt to measured FPS
  let tier = Q.get('q') || (isTouch ? 'med' : 'high'); if (!TIERS[tier]) tier = 'high'; const autoTier = Q.has('auto') || (!Q.get('q') && !Q.has('webgl')); let tierT = 0, tierF = [], tierUp = false, cullT = 0;
  const baseScale = 1 / Math.min(1.5, devicePixelRatio || 1);
  function setTier(n) { tier = n; const T0 = TIERS[n]; const dprE = Math.min(2.5, devicePixelRatio || 1); engine.setHardwareScalingLevel(isTouch ? T0.scale / dprE : T0.scale === 1 ? baseScale : Math.min(T0.scale, 1.25) / Math.min(1.5, dprE)); // phones: native px / scale (1.5x down on med)
    if (pipe) { pipe.bloomEnabled = T0.bloom; pipe.grainEnabled = T0.grain; try { pipe.samples = n === 'high' && !isTouch ? 4 : 1; } catch (e) { } }
    if (SSAO) { const on = n === 'high'; const M = scene.postProcessRenderPipelineManager; if (on && !SSAO._rwOn) M.attachCamerasToRenderPipeline('ssao', cam0); if (!on && SSAO._rwOn !== false) M.detachCamerasFromRenderPipeline('ssao', cam0); SSAO._rwOn = on; } if (glow) glow.isEnabled = T0.glow; if (typeof T !== 'undefined' && T) T.crowdMax = T0.crowd; window.__rw.tier = n; console.log('[rw] quality tier', n); }
  setTier(tier);
  const FLY = 26; let titleT0 = 0;
  const flyover = (s) => { const u = Math.min(1, Math.max(0, s / FLY)); const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; const n = KP.length - 1, x = e * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
    const g = (A, j) => A[Math.max(0, Math.min(n, j))]; return { p: Vector3.CatmullRom(g(KP, i - 1), g(KP, i), g(KP, i + 1), g(KP, i + 2), f), t: Vector3.CatmullRom(g(KT, i - 1), g(KT, i), g(KT, i + 1), g(KT, i + 2), f) }; };
  window.__rwFly = { restart: () => { titleT0 = t; }, FLY };
  scene.onBeforeRenderObservable.add(() => {
    const dt = window.__rw.fixedDt || Math.min(0.05, engine.getDeltaTime() / 1000); t += dt;
    // movement
    let ix = 0, iz = 0;
    if (!app.paused && !app.title) { if (K.has('KeyW') || K.has('ArrowUp')) iz += 1; if (K.has('KeyS') || K.has('ArrowDown')) iz -= 1; if (K.has('KeyA') || K.has('ArrowLeft')) ix -= 1; if (K.has('KeyD') || K.has('ArrowRight')) ix += 1; ix += stick.x; iz -= stick.y; }
    if (window.__rw.auto) { iz = window.__rw.auto.iz || 0; ix = window.__rw.auto.ix || 0; }
    const mag = Math.min(1, Math.hypot(ix, iz)); const run = K.has('ShiftLeft') || K.has('ShiftRight') || touchRun || (window.__rw.auto && window.__rw.auto.run);
    const sp = mag * (run ? 5.2 : 2.0);
    if (mag > 0.05) { P.dancing = false; const fx = Math.sin(C.yaw), fz = Math.cos(C.yaw); const mx = fx * iz + fz * ix, mz = fz * iz - fx * ix; const L = Math.hypot(mx, mz);
      const h = Math.atan2(mx / L, mz / L); let dh = h - P.heading; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; P.heading += dh * Math.min(1, dt * 10);
      P.x += mx / L * sp * dt; P.z += mz / L * sp * dt; }
    P.speed += (sp - P.speed) * Math.min(1, dt * 10);
    const pp = { x: P.x, z: P.z }; (app.inside ? tGrid : city.grid).resolve(pp, 0.38); P.x = pp.x; P.z = pp.z;
    const autoDance = app.inside && T.mode === 'rave' && T.danceFloor(P) && P.speed < 0.2 && !window.__rw.noAutoDance;
    player.root.position.set(P.x, 0, P.z); player.root.rotation.y = P.heading; dust.emitter.set(P.x, 0.05, P.z); dust.emitRate = P.speed > 3.5 && !app.inside ? 45 : 0;
    animateAvatar(player, dt, { speed: P.speed, dancing: P.dancing || autoDance });
    // camera with collision
    tgt.set(P.x, 1.25, P.z);
    const cp = Math.cos(C.pitch), want = C.dist; const ox = -Math.sin(C.yaw) * cp, oz = -Math.cos(C.yaw) * cp, oy = Math.sin(C.pitch);
    const camY = 1.25 + oy * want; const hit = (app.inside ? tGrid : city.grid).raycast(P.x, P.z, P.x + ox * want, P.z + oz * want, camY);
    const d = Math.max(1.0, want * hit - (hit < 1 ? 0.35 : 0)); C.curDist += (d - C.curDist) * Math.min(1, dt * (d < C.curDist ? 18 : 4));
    camPos.set(P.x + ox * C.curDist, Math.max(0.35, 1.25 + oy * C.curDist), P.z + oz * C.curDist);
    // smoothed follow camera + slight FOV kick when sprinting
    if (camSnap) { smPos.copyFrom(camPos); smTgt.copyFrom(tgt); camSnap = false; } else { const k = Math.min(1, dt * 12); Vector3.LerpToRef(smPos, camPos, k, smPos); Vector3.LerpToRef(smTgt, tgt, Math.min(1, dt * 16), smTgt); }
    cam.position.copyFrom(smPos); cam.setTarget(smTgt);
    const wantFov = 0.95 + (P.speed > 3.5 ? 0.09 : 0); cam.fov += (wantFov - cam.fov) * Math.min(1, dt * 3);
    if (app.title) { const f = flyover(window.__rwFly.at != null ? window.__rwFly.at : t - titleT0); cam.position.copyFrom(f.p); cam.setTarget(f.t); cam.fov = 0.9; camSnap = true; }
    if (window.__rw.camRel) { const o = window.__rw.camRel, h = P.heading + o[0], d = o[1]; cam.position.set(P.x + Math.sin(h) * d, o[2], P.z + Math.cos(h) * d); cam.setTarget(new Vector3(P.x, o[3], P.z)); }
    else if (window.__rw.camOverride) { const o = window.__rw.camOverride; cam.position.set(o[0], o[1], o[2]); cam.setTarget(new Vector3(o[3], o[4], o[5])); }
    // world updates
    if (!app.inside) { updateCity(city, t); updateLandmarks(LM, t); updateTempleExterior(ext, t, app.live); updateTraffic(traffic, dt, P, t); templeRing.rotation.y += dt; templeRing.scaling.setAll(1 + 0.06 * Math.sin(t * 4)); }
    else updateTempleInterior(T, t, dt), T.dancers.forEach(dn => animateAvatar(dn, dt, { dancing: true }));
    // interaction prompts
    interact = null;
    if (!app.inside) {
      if (Math.hypot(P.x - ext.doorPos.x, P.z - ext.doorPos.z) < 3.2) interact = { label: `<b>E</b> ENTER THE TEMPLE`, act: enterTemple };
      else if (venueDoors.some(d => Math.hypot(P.x - d.x, P.z - d.z) < 3.2)) { const d = venueDoors.find(d => Math.hypot(P.x - d.x, P.z - d.z) < 3.2); interact = d.v.nostalgia ? { label: 'THE WARE-HOUSE · EST. · THE OLD PALM HOUSE / THREE SHEETS SITE', act: () => hud.toast('THE WARE-HOUSE · FOR THE ONES WHO WERE THERE') } : { label: `${d.v.name} · ${d.v.sub} · INSIDE COMING SOON`, act: () => hud.toast(`${d.v.name} OPENS IN A LATER BUILD`) }; }
      else if (Math.hypot(P.x - whDoor.x, P.z - whDoor.z) < 3.2) interact = { label: `THE WARE-HOUSE XL · INTERIOR COMING SOON`, act: () => hud.toast('THE WARE-HOUSE XL OPENS IN A LATER BUILD') };
      else for (const ps of posters) if (Math.hypot(P.x - ps.ix, P.z - ps.iz) < 2.4) { const done = ps.mesh.isEnabled(); interact = { label: done ? 'POSTER UP ✓' : `<b>E</b> PASTE A RECKLESS POSTER`, act: async () => { if (done) return; ps.mesh.setEnabled(true); localStorage.setItem('rw.poster.' + ps.id, '1'); const ev = await EV.posterPlaced(ps.id); hud.toast(ev ? 'POSTER UP · TEST EVENT QUEUED' : 'POSTER UP'); } }; break; }
    } else if (P.z - INTERIOR_ORIGIN.z < 2.4 && Math.abs(P.x - INTERIOR_ORIGIN.x) < 2) interact = { label: `<b>E</b> EXIT TO CARLISLE CIRCUS`, act: exitTemple };
    hud.prompt(interact ? interact.label : '');
    // HUD
    slowT -= dt; if (slowT <= 0) { slowT = 0.5; if (app.inside) EV.raveTick().then(ev => ev && hud.toast('10 MINUTES IN · TEST VISIT QUEUED')); state.street = app.inside ? 'THE TEMPLE' : nearestStreet(); state.district = app.inside ? (T.mode === 'day' ? 'NAVE · DAYLIGHT' : 'NAVE · RAVE') : nearestDistrict();
      { const dd = Math.hypot(P.x - ext.doorPos.x, P.z - ext.doorPos.z); AU.update({ inside: app.inside, dist: dd }); MU.setVolume(app.inside ? 90 : 22 + Math.max(0, 1 - dd / 90) * 30); }
      routeT -= 0.5; if (routeT <= 0 && !app.inside) { routeT = 1.5; state.route = route(P.x, P.z, ext.doorPos.x, ext.doorPos.z); } if (app.inside) state.route = null;
      const tv = VENUES[0]; state.objective = app.inside ? '' : `▲ THE TEMPLE <b>${Math.round(Math.hypot(P.x - ext.doorPos.x, P.z - ext.doorPos.z))}M</b>`; }
    hud.update(dt, { x: P.x, z: P.z, heading: P.heading, camYaw: C.yaw, inside: app.inside, lx: P.x - INTERIOR_ORIGIN.x, lz: P.z - INTERIOR_ORIGIN.z, ...state });
    fpsT += dt; if (fpsT > 0.5) { fpsT = 0; hud.fps(Math.round(engine.getFps())); }
    cullT -= dt; if (culler && cullT <= 0 && !app.inside) { cullT = 0.25; culler.setDist(app.title ? 900 : TIERS[tier].dist); culler.update(cam.position); WET.update(cam.position); const pd = TIERS[tier].dist * 0.3; for (const p of traffic.peds) { const on = Math.hypot(p.av.root.position.x - cam.position.x, p.av.root.position.z - cam.position.z) < pd; if (p._on !== on) { p._on = on; p.av.root.setEnabled(on); } } }
    if (!app.title && !app.inside && autoTier) { tierT += engine.getDeltaTime() / 1000; tierF.push(engine.getFps()); if (tierT > 4) { const avg = tierF.reduce((a, b) => a + b, 0) / tierF.length; tierF = []; tierT = 0;
      const order = ['low', 'med', 'high'], i = order.indexOf(tier); if (avg < 24 && i > 0) setTier(order[i - 1]); else if (avg > 55 && i < 2 && !tierUp) { tierUp = true; setTier(order[i + 1]); } } }
  });
  window.__rw.setTier = setTier; window.__rw.culler = culler; window.__rw.FL = FL;
  window.__rw.manual = (on) => { if (on) engine.stopRenderLoop(); else engine.runRenderLoop(() => scene.render()); }; window.__rw.renderFrame = (n = 1) => { for (let i = 0; i < n; i++) scene.render(); return true; };
  window.__rw.inst = new SceneInstrumentation(scene); window.__rw.inst.captureFrameTime = true;
  engine.runRenderLoop(() => scene.render());
  addEventListener('resize', () => engine.resize());
  document.getElementById('loading').classList.add('done'); bar(100);
  if (!Q.has('debug') && !Q.has('fps')) { const f = document.getElementById('fps'); if (f) f.style.display = 'none'; }
  hud.hud.classList.add('titlehide'); titleT0 = t; document.getElementById('title').classList.add('ready');
  const startGame = () => { if (!app.title) return; const ti = document.getElementById('title'); ti.classList.add('gone'); app.title = false; camSnap = true; hud.hud.classList.remove('titlehide'); removeEventListener('keydown', anyKey); if (!Q.has('mute')) { AU.unlock(); sndLbl(); } };
  const anyKey = (e) => { if (app.title) startGame(); }; addEventListener('keydown', anyKey);
  document.getElementById('play').onclick = startGame; document.getElementById('title').addEventListener('pointerdown', (e) => { if (document.getElementById('title').classList.contains('ready')) startGame(); });
  if (isTouch) document.getElementById('play').textContent = 'TAP TO ENTER';
  Object.assign(window.__rw, { ready: true, engine, scene, P, C, enterTemple, exitTemple, kind: engine.__kind, low: LOW,
    setMode: (m) => { setTempleMode(T, scene, m); hud.interior(true, m); }, openMap: () => hud.openMap(P), close: () => hud.close(), hud, player,
    teleport: (x, z, yaw) => { P.x = x; P.z = z; if (yaw != null) { P.heading = yaw; C.yaw = yaw; } C.curDist = C.dist; slowT = 0; },
    gotoStreet: (name, k = 0.5, side = 1) => { const rs = city.roads.filter(r => r.nm === name && r.d); if (!rs.length) return 'none'; const r = rs[Math.floor(rs.length * k) % rs.length]; const i = Math.floor(r.pts.length / 2) - (r.pts.length > 1 && r.pts.length % 2 === 0 ? 1 : 0); const a = r.pts[Math.max(0, i)], b = r.pts[Math.min(r.pts.length - 1, i + 1)]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L; const off = r.w / 2 + 1.2; P.x = (a[0] + b[0]) / 2 - uz * off * side; P.z = (a[1] + b[1]) / 2 + ux * off * side; P.heading = Math.atan2(ux, uz); C.yaw = P.heading; C.curDist = C.dist; slowT = 0; return [P.x, P.z]; },
    stats: () => { const inst = window.__rw.inst; return { drawCalls: inst ? inst.drawCallsCounter.current : -1, activeMeshes: scene.getActiveMeshes().length, activeIndices: scene.getActiveIndices(), totalVertices: scene.getTotalVertices(), meshes: scene.meshes.length, frameMs: inst ? inst.frameTimeCounter.lastSecAverage : -1 }; }, fps: () => engine.getFps(), ext, T, traffic, posters, whDoor });
}
// title screen
start().catch(e => { console.error(e); document.getElementById('loading').textContent = 'ERROR: ' + e.message; });
