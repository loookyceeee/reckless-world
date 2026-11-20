import * as DG from './diag.js';
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
import { loadAvatar3D } from './avatar3d.js';
import { createMusic, SC_PROFILE } from './music.js';
import { createPhone, createWheel, buzz } from './phone.js';
import { createMissions } from './missions.js';
import { SegGrid } from './collide.js';
import { buildFront } from './fronts.js';
import { createDance } from './dance.js';
import { createCollect, cardArt } from './collect.js';
import { buildClub, setClubMode, updateClub } from './clubs.js';
import { createRapid } from './glider.js';
import * as EV from './events.js';
import { planeR, torus, xf, plane, toMesh, hex, cyl, merge } from './geo.js';

const Q = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// ?safe=1: lowest settings, no post-processing at all (for devices that show a black screen)
const SAFE = Q.has('safe');
const LOW = SAFE || Q.has('low') || (isTouch && Math.min(screen.width, screen.height) < 900);
const app = { title: true, paused: false, inside: false, live: !Q.has('nolive'), keys: new Set(), key: null };
window.__rw = { ready: false, app };

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
async function makeEngine(canvas) {
  // WebGPU only on request (?webgpu): real-device WebGPU (e.g. Safari 26) rendered black. WebGL2 by default, WebGL1 as fallback.
  if (Q.has('webgpu') && navigator.gpu) {
    try {
      const adapter = await withTimeout(navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }), 2500);
      if (adapter) { const e = new WebGPUEngine(canvas, { antialias: !LOW, adaptToDeviceRatio: false }); await withTimeout(e.initAsync(), 6000); e.__kind = 'WebGPU'; return e; }
    } catch (err) { console.warn('WebGPU unavailable, using WebGL', err); }
  }
  const opts = { preserveDrawingBuffer: true, stencil: true, powerPreference: SAFE ? 'default' : 'high-performance', failIfMajorPerformanceCaveat: false };
  for (const extra of (Q.has('webgl1') ? [{ disableWebGL2Support: true }] : [{}, { disableWebGL2Support: true }])) {
    try { const e = new Engine(canvas, !LOW && !SAFE, { ...opts, ...extra }, false); if (!e._gl) throw new Error('no GL context'); e.__kind = 'WebGL' + e.webGLVersion; return e; }
    catch (err) { console.warn('WebGL' + (extra.disableWebGL2Support ? '1' : '2') + ' failed', err); }
  }
  throw new Error('This browser could not start WebGL (graphics may be disabled or blocked).');
}
function gpuName(engine) { try { const gl = engine._gl; const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) + ' / ' + gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { return engine.__kind; } }
async function start() {
  const canvas = document.getElementById('c');
  const bar = (p) => { const b = document.getElementById('lbar'); if (b) b.style.width = p + '%'; };
  DG.info.stage = 'engine'; const engine = await makeEngine(canvas); if (Q.has('novao')) engine.disableVertexArrayObjects = true; bar(15); DG.info.engine = engine.__kind; DG.info.gpu = gpuName(engine); DG.log('engine', engine.__kind, DG.info.gpu);
  engine.onContextLostObservable && engine.onContextLostObservable.add(() => { console.error('WebGL context lost'); DG.show('graphics context lost'); });
  engine.setHardwareScalingLevel(SAFE ? 2 : LOW ? 1.5 : 1 / Math.min(1.5, devicePixelRatio || 1));
  const scene = new Scene(engine); scene.skipPointerMovePicking = true;
  const NIGHT = new Color4(0.07, 0.075, 0.14, 1);
  scene.clearColor = NIGHT; scene.ambientColor = new Color3(0.2, 0.2, 0.25);
  scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.0028; scene.fogColor = new Color3(0.1, 0.105, 0.17);
  const hemi = new HemisphericLight('hemi', new Vector3(0.1, 1, 0.2), scene); hemi.intensity = 1.0; hemi.diffuse = hex('#9aa6cc'); hemi.groundColor = hex('#2a2426'); hemi.specular = new Color3(0.2, 0.2, 0.3);
  const moon = new DirectionalLight('moon', new Vector3(-0.4, -0.8, 0.5), scene); moon.intensity = 0.45; moon.diffuse = hex('#b8c4ff'); moon.specular = new Color3(0.3, 0.3, 0.4);
  let DANCE = null, COL = null, SEAT = null, punch = 0;
  const cam = new FreeCamera('cam', new Vector3(0, 5, -10), scene); cam.minZ = 0.1; cam.maxZ = 900; cam.fov = 0.95; cam.inputs.clear(); const cam0 = cam;
  let glow = null; if (!LOW && !Q.has('noglow')) { try { glow = new GlowLayer('glow', scene, { mainTextureRatio: 0.35, blurKernelSize: 32 }); glow.intensity = 0.5; } catch (e) { console.warn('glow off', e); glow = null; } }
  // cinematic pipeline: gentle bloom, ACES filmic tone mapping, contrast grade, vignette, light grain, FXAA (+ SSAO on ?ssao)
  let pipe = null, SSAO = null;
  if (!SAFE && !Q.has('nopost')) try {
    pipe = new DefaultRenderingPipeline('cine', true, scene, [cam0]);
    pipe.fxaaEnabled = true; pipe.bloomEnabled = !LOW; pipe.bloomThreshold = 0.72; pipe.bloomWeight = 0.32; pipe.bloomKernel = 48; pipe.bloomScale = 0.5;
    pipe.imageProcessingEnabled = true; const ip = pipe.imageProcessing; ip.toneMappingEnabled = true; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = 1.4; ip.contrast = 1.1;
    ip.vignetteEnabled = true; ip.vignetteWeight = 2.2; ip.vignetteColor = new Color4(0, 0, 0, 0); ip.vignetteStretch = 0.2;
    ip.colorCurvesEnabled = true; const cc = new ColorCurves(); cc.globalSaturation = -4; cc.shadowsHue = 215; cc.shadowsDensity = 22; cc.shadowsSaturation = 35; cc.highlightsHue = 40; cc.highlightsDensity = 6; cc.highlightsSaturation = 8; ip.colorCurves = cc;
    pipe.grainEnabled = !LOW; pipe.grain.intensity = 6; pipe.grain.animated = true;
    // SSAO (desktop high tier by default; ?nossao off, ?ssao forces it): soft contact shadows in doorways, kerbs and crowds
    if ((!isTouch && !Q.has('nossao')) || Q.has('ssao')) { try { SSAO = new SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.5, blurRatio: 0.5 }, [cam0]); SSAO.radius = 1.4; SSAO.totalStrength = 1.0; SSAO.base = 0.12; SSAO.samples = 12; SSAO.maxZ = 220; SSAO.expensiveBlur = true; SSAO._rwOn = true; } catch (e) { SSAO = null; console.warn('ssao', e); } }
  } catch (e) { console.warn('pipeline', e); }
  window.__rw.pipe = () => pipe; window.__rw.ssao = () => SSAO;
  if (!pipe) { const ip = scene.imageProcessingConfiguration; ip.toneMappingEnabled = true; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = 1.4; ip.contrast = 1.1; }
  DG.info.stage = 'loading world';
  await document.fonts.ready;
  await loadAnims(import.meta.env.BASE_URL + 'data/anims.json').catch(e => console.warn('anims', e));

  const crewCfgP = CR.loadCrewConfig(); // loyalty's ranks/unlocks/starter fit, fetched while the city builds
  const city = await buildCity(scene, { low: LOW }); bar(55);
  const SKY = buildSky(scene, { low: LOW }); scene.__env = SKY.env;
  applyWet(scene, SKY.env, { roads: [0.5, 0.02, 0.04, 2.5], puddle: [1.0, 0.4, 0.3, 1.6], markings: [0.3, 0.02], pavement: [0.12, 0.0, 0.02, 3.5] });
  // perf: split merged + thin-instanced static city meshes into 96 m cells, freeze them, distance-cull per tier
  const culler = Q.has('nochunk') ? null : chunkStatic(city.root, { cell: Number(Q.get('cell')) || 128, skip: city.beacons.map(b => b.m.name) });
  // sharper ground/facade textures at grazing angles: anisotropic filtering (8x desktop, 4x phones, off in safe mode)
  { const af = SAFE || /swiftshader|llvmpipe|software/i.test(DG.info.gpu) ? 1 : LOW ? 4 : 8; for (const t of scene.textures) if (t && 'anisotropicFilteringLevel' in t && !t.isCube) t.anisotropicFilteringLevel = af; }
  freezeMaterials(scene, ['trunk', 'leaf', 'furn', 'lampPoleM', 'pave', 'roads', 'pavement', 'markings']);
  const templeB = city.buildings.find(b => b.temple);
  const ext = buildTempleExterior(scene, templeB, city.grid); ext.root.parent = city.root;
  const TEMPLE = buildTempleInterior(scene, { glow, low: LOW, bakeCrowd: () => bakeCrowdVariants(scene, { lod: LOW ? 0.28 : 0.33, simplify: Q.has('nosimp') ? 0 : 0.3 }), makeDancer: (i) => { const a = createAvatar(scene, { name: 'dancer' + i, outfit: ['skate', 'stan', 'stanfull', 'stanfull', 'skate', 'stan'][i], decals: true, lod: 0.5 }); return a; } });
  let T = TEMPLE; // the live interior (Temple or one of the clubs built on first entry)
  T.cam = cam; T.name = 'THE TEMPLE'; T.sub = '8 CARLISLE CIRCUS'; T.exitLabel = 'CARLISLE CIRCUS';
  T.root.setEnabled(false);
  const tGrid = new SegGrid(8); for (const s of T.segs) tGrid.add(s[0], s[1], s[2], s[3], 99); T.grid = tGrid;
  T.bars = [{ x: INTERIOR_ORIGIN.x + 6.3, z: INTERIOR_ORIGIN.z + 6.5, face: Math.PI / 2 }];
  if (T.CV) T.CV.cap = T.crowd.length;
  const LM = buildLandmarks(scene, city, city.grid); LM.root.parent = city.root;
  city.templeDoor = ext.doorPos; const carModels = Q.has('nocars') ? null : await (await fetch(import.meta.env.BASE_URL + 'data/cars.json')).json().catch(() => null); if (carModels && !Q.has('oldveh')) Object.assign(carModels, await (await fetch(import.meta.env.BASE_URL + 'data/vehicles.json')).json().catch(() => ({}))); const traffic = buildTraffic(scene, city, { models: carModels, low: LOW, stops: (city.sf && city.sf.stops) || [], signals: (city.sf && city.sf.signals) || [] }); bar(85);
  const route = makeRouter(buildGraph(city.roads, false)); let routeT = 0;
  // player
  let player = createAvatar(scene, { name: 'player', outfit: 'skate', fit: true });
  await crewCfgP; window.__rw.crewRules = CR.CREW_RULES;
  const CREW = { fit: CR.loadFit(), xp: null, account: CR.getAccount() };
  const applyFit = (f) => { f = CR.allowedFit(f, CR.playerLevel(CREW.xp)); CREW.fit = f; CR.saveFit(f); player.setFit(f, CR.visibleFor); }; applyFit(CREW.fit); window.__rw.applyFit = (f) => applyFit(f); window.__rw.fitRaw = (f) => player.setFit(f, CR.visibleFor); window.__rw.CR = CR;
  // smooth rigged crew avatar (models/avatar.glb); the procedural figure stands in until it loads (?procav keeps it)
  // crew base (MALE / FEMALE): ?base= for tests, else the app's avatar_base when signed in (read-only), else the local pick
  CREW.base = ['male', 'female'].includes(Q.get('base')) ? Q.get('base') : (CR.getLocalBase() || 'male'); CREW.baseFromApp = false;
  const swapAvatar = (kind) => { if (Q.has('procav')) return; const tok = (swapAvatar.n = (swapAvatar.n || 0) + 1);
    loadAvatar3D(scene, { name: 'player3d', kind }).then(av => { if (tok !== swapAvatar.n) { av.root.dispose(false, true); Object.values(av.ag).forEach(g => g.dispose()); return; }
      const old = player; av.root.position.copyFrom(old.root.position); av.root.rotation.y = old.root.rotation.y;
      if (old.isGlb) { old.root.dispose(false, true); Object.values(old.ag).forEach(g => g.dispose()); } else { old.root.setEnabled(false); old.allMeshes().forEach(m => m.setEnabled(false)); }
      player = av; window.__rw.player = av; player.setFit(CREW.fit, CR.visibleFor); if (glow) for (const m of av.allMeshes()) glow.addExcludedMesh(m); DG.log('avatar3d loaded ' + kind); }).catch(e => console.warn('avatar3d', e)); };
  window.__rw.swapAvatar = swapAvatar; swapAvatar(CREW.base);
  const setBase = (b, fromApp = false) => { if (!['male', 'female'].includes(b)) return; if (!fromApp) CR.setLocalBase(b); CREW.baseFromApp = fromApp; if (b !== CREW.base) { CREW.base = b; swapAvatar(b); } };
  const loadBase = async () => { if (!CREW.account || Q.get('base')) return null; const b = await CR.readAvatarBase(CREW.account); /* avatar-base endpoint: 'male'|'female' only when set in the app, null when unset (or on failure) -> local pick / first-launch picker. GET only. */ if (b) setBase(b, true); return b; };
  const loadCrew = async () => { if (!CREW.account) return; CREW.basePending = loadBase(); try { const r = await CR.readCrew(CREW.account); if (r) { CREW.xp = r.xp; if (r.fit.top || r.fit.outer || r.fit.legs) applyFit(r.fit); } } catch (e) { } }; loadCrew();
  const P = { x: ext.spawn.x, z: ext.spawn.z, heading: 0, speed: 0, dancing: false }; window.__rw.P = P; window.__rw.grid = () => city.grid;
  { const dx = ext.doorPos.x - P.x, dz = ext.doorPos.z - P.z; P.heading = Math.atan2(dx, dz); }
  // footstep dust puffs when sprinting
  const dustT = new DynamicTexture('dustT', 64, scene, true); { const g = dustT.getContext(); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(200,200,210,0.6)'); gr.addColorStop(1, 'rgba(200,200,210,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); dustT.hasAlpha = true; dustT.update(); }
  const dust = new ParticleSystem('dust', LOW ? 60 : 160, scene); dust.particleTexture = dustT; dust.emitter = new Vector3(0, 0.05, 0); dust.minEmitBox = new Vector3(-0.15, 0, -0.15); dust.maxEmitBox = new Vector3(0.15, 0, 0.15);
  dust.color1 = new Color4(0.75, 0.75, 0.8, 0.35); dust.color2 = new Color4(0.6, 0.6, 0.68, 0.25); dust.colorDead = new Color4(0.5, 0.5, 0.55, 0); dust.minSize = 0.15; dust.maxSize = 0.45; dust.minLifeTime = 0.35; dust.maxLifeTime = 0.8;
  dust.emitRate = 0; dust.direction1 = new Vector3(-0.4, 0.6, -0.4); dust.direction2 = new Vector3(0.4, 1.0, 0.4); dust.minEmitPower = 0.3; dust.maxEmitPower = 0.8; dust.gravity = new Vector3(0, -0.3, 0); dust.blendMode = ParticleSystem.BLENDMODE_STANDARD; dust.start();
  const C = { yaw: P.heading, pitch: 0.22, dist: 5.8, curDist: 5.8, arm: 1, dip: 0 }; P.y = 0; P.vy = 0; P.air = false; P.jumpReq = 0; window.__rw.C = C;
  // markers: entrance rings + warehouse sign + poster spots
  const ringM = new StandardMaterial('ring', scene); ringM.emissiveColor = new Color3(1, 1, 1); ringM.disableLighting = true; ringM.alpha = 0.85;
  const mkRing = (x, z, n) => { const r = toMesh(n, xf(torus(2.6, 0.12, 40), { t: [0, 0.15, 0] }), scene, ringM); r.position.set(x, 0, z); r.parent = city.root; return r; };
  const templeRing = mkRing(ext.doorPos.x, ext.doorPos.z, 'templeRing');
  const cm = city.buildings.find(b => b.n === 'Common Market'); let whDoor = { x: VENUES[1].x, z: VENUES[1].z };
  if (cm) { const dun = city.roads.filter(r => r.nm === 'Dunbar Street').flatMap(r => r.pts); let best = 1e9;
    for (let i = 0; i < cm.pts.length; i++) { const a = cm.pts[i], b = cm.pts[(i + 1) % cm.pts.length]; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      for (const p of dun) { const d = Math.hypot(p[0] - m[0], p[1] - m[1]); if (d < best) { best = d; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); whDoor = { x: m[0] + (b[1] - a[1]) / L * 2.5, z: m[1] - (b[0] - a[0]) / L * 2.5, nx: (b[1] - a[1]) / L, nz: -(b[0] - a[0]) / L, wx: m[0], wz: m[1], L }; } } } }
  const whRing = mkRing(whDoor.x, whDoor.z, 'whRing');
  const signTex = (txt, w = 1024, h = 192) => { const t = new (window.__DT)(txt, { width: w, height: h }, scene, true); const c = t.getContext(); c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#fff'; let fs = Math.min(96, h * 0.55); do { c.font = `800 ${fs}px Unbounded`; fs -= 3; } while (c.measureText(txt).width > w - 70 && fs > 20); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 4); t.update(); return t; };
  window.__DT = DynamicTexture;
  if (whDoor.nx !== undefined) { const F = buildFront(scene, 'warehousexl', { wx: whDoor.wx, wz: whDoor.wz, nx: whDoor.nx, nz: whDoor.nz, avail: whDoor.L - 1, bh: cm.h || 9, parent: city.root, grid: city.grid, low: LOW });
    if (F) { whDoor.x = F.door.x; whDoor.z = F.door.z; whRing.position.set(whDoor.x, 0, whDoor.z); whDoor.front = F; } }
  { const sm = new StandardMaterial('tSign', scene); sm.emissiveTexture = signTex('THE TEMPLE'); sm.disableLighting = true; sm.backFaceCulling = false;
    const s = toMesh('tSign', plane(6, 1.1), scene, sm); s.position.set(ext.doorPos.x, 4.6, ext.doorPos.z); s.position.addInPlace(new Vector3(Math.sin(ext.yaw), 0, Math.cos(ext.yaw)).scale(0.9)); s.rotation.y = ext.yaw; s.parent = city.root; }
  // other Reckless venues in the world: fascia sign on the real facade nearest the venue point + entrance ring + prompt
  const venueDoors = [];
  for (const v of VENUES.filter(v => v.inSlice && ['thompsons', 'terminus', 'warehouse', 'locationx'].includes(v.id))) {
    let best = null, bd = 1e9; for (const sg of city.grid.near(v.x, v.z, 45)) { const dx = sg.x1 - sg.x0, dz = sg.z1 - sg.z0, L2 = dx * dx + dz * dz; if (L2 < 30 || sg.h < 3 || sg.h === 30.5) continue; const L = Math.sqrt(L2), m0 = Math.min(0.45, 3.2 / L);
      const t = Math.max(m0, Math.min(1 - m0, ((v.x - sg.x0) * dx + (v.z - sg.z0) * dz) / L2)); const px = sg.x0 + dx * t, pz = sg.z0 + dz * t, d = Math.hypot(px - v.x, pz - v.z);
      if (d < bd) { let nx = -dz / L, nz = dx / L; if ((px - v.x) * nx + (pz - v.z) * nz < 0) { nx = -nx; nz = -nz; } bd = d; best = { wx: px, wz: pz, nx, nz, h: sg.h, avail: 2 * Math.min(t, 1 - t) * L }; } }
    if (!best) continue; const F = buildFront(scene, v.id, { wx: best.wx, wz: best.wz, nx: best.nx, nz: best.nz, avail: best.avail - 0.6, bh: best.h, parent: city.root, grid: city.grid, low: LOW });
    const door = { v, x: F ? F.door.x : best.wx + best.nx * 2.5, z: F ? F.door.z : best.wz + best.nz * 2.5, nx: best.nx, nz: best.nz, wx: best.wx, wz: best.wz, front: F }; venueDoors.push(door); mkRing(door.x, door.z, 'ring-' + v.id);
  }
  window.__rw.venueDoors = venueDoors;
  traffic.queues = [whDoor.front, ...venueDoors.map(d => d.front)].filter(Boolean).map(f => f.queue);
  // rapid-bus fast-travel stops: one by every venue (src/glider.js)
  traffic.addStops([{ id: 'temple', name: 'THE TEMPLE', x: ext.doorPos.x, z: ext.doorPos.z }, { id: 'warehousexl', name: 'THE WARE-HOUSE XL', x: whDoor.x, z: whDoor.z },
    ...['terminus', 'thompsons', 'warehouse', 'locationx'].map(id => venueDoors.find(d => d.v.id === id)).filter(Boolean).map(d => ({ id: d.v.id, name: d.v.name, x: d.x, z: d.z }))]);
  const FL = buildFlavour(scene, city, { low: LOW }); const WET = buildWetStreaks(scene, city.sf && city.sf.lamps, { low: LOW });
  // posters: snap each spot to the nearest wall
  const posterM = new StandardMaterial('poster', scene); posterM.emissiveTexture = signTex('RECKLESS', 512, 720); posterM.disableLighting = true;
  { const c = posterM.emissiveTexture.getContext(); c.fillStyle = '#000'; c.fillRect(0, 0, 512, 720); const img = new Image(); img.src = import.meta.env.BASE_URL + 'img/logo.png'; await img.decode().catch(() => {}); c.drawImage(img, 56, 140, 400, 347); c.fillStyle = '#fff'; c.font = '800 54px Unbounded'; c.textAlign = 'center'; c.fillText('RECKLESS', 256, 580); c.font = '600 30px "DM Sans"'; c.fillText('BELFAST · THE TEMPLE', 256, 640); posterM.emissiveTexture.update(); }
  // real Reckless event posters (public/data/posters.json): upcoming first, rotated daily across the walls; past nights fill the rest
  const PL = await fetch(import.meta.env.BASE_URL + 'data/posters.json').then(r => r.json()).then(d => d.posters || []).catch(() => []);
  const nowMs = Date.now(), dayN = Math.floor(nowMs / 864e5);
  const upP = PL.filter(p => Date.parse(p.endDate) > nowMs).sort((a, b) => Date.parse(a.endDate) - Date.parse(b.endDate)), pastP = PL.filter(p => Date.parse(p.endDate) <= nowMs).sort((a, b) => Date.parse(b.endDate) - Date.parse(a.endDate));
  const pMats = {}; let posterSeq = 0;
  const posterFor = (i) => { const p = i < upP.length ? upP[(i + dayN) % upP.length] : pastP.length ? pastP[(i - upP.length + dayN) % pastP.length] : upP.length ? upP[(i + dayN) % upP.length] : null;
    if (!p) return posterM; if (pMats[p.id]) return pMats[p.id];
    const mm = new StandardMaterial('poster-' + p.id, scene); const tx = new Texture(import.meta.env.BASE_URL + p.file, scene, false, true); tx.anisotropicFilteringLevel = 4;
    mm.emissiveTexture = tx; mm.emissiveColor = new Color3(0.34, 0.34, 0.34); mm.disableLighting = true; mm.backFaceCulling = true; mm.__poster = p; return (pMats[p.id] = mm); };
  window.__rw.posterList = () => posters.map(p => ({ id: p.id, poster: p.mesh.material.__poster && p.mesh.material.__poster.id }));
  const posters = POSTER_SPOTS.map(sp => { let best = null, bd = 1e9; for (const s of city.grid.near(sp.x, sp.z, 40)) { const dx = s.x1 - s.x0, dz = s.z1 - s.z0, L2 = dx * dx + dz * dz; if (L2 < 4 || s.h === 30.5 || s.h < 3) continue; let t = ((sp.x - s.x0) * dx + (sp.z - s.z0) * dz) / L2; t = Math.max(0.2, Math.min(0.8, t)); const px = s.x0 + dx * t, pz = s.z0 + dz * t; const d = Math.hypot(px - sp.x, pz - sp.z); if (d < bd) { bd = d; const L = Math.sqrt(L2); let nx = dz / L, nz = -dx / L; if ((sp.x - px) * nx + (sp.z - pz) * nz < 0) { nx = -nx; nz = -nz; } best = { x: px, z: pz, nx, nz }; } } // face the street side the spot is on
    if (!best) return null; const m = toMesh('poster-' + sp.id, planeR(1.2, 1.6), scene, posterFor(posterSeq++)); m.position.set(best.x + best.nx * 0.05, 2.1, best.z + best.nz * 0.05); m.rotation.y = Math.atan2(-best.nx, -best.nz); m.parent = city.root; m.setEnabled(!!localStorage.getItem('rw.poster.' + sp.id));
    return { ...sp, name: sp.id.replace(/-/g, ' ').toUpperCase(), mesh: m, ix: best.x + best.nx * 1.4, iz: best.z + best.nz * 1.4 }; }).filter(Boolean);
  const PDAY = () => { try { const o = JSON.parse(localStorage.getItem('rw.pday') || '{}'); return o.day === EV.londonDay() ? o.ids || [] : []; } catch (e) { return []; } };
  const markPasted = (id) => { const ids = PDAY(); if (!ids.includes(id)) ids.push(id); localStorage.setItem('rw.pday', JSON.stringify({ day: EV.londonDay(), ids })); };
  const posterDone = (ps) => EV.postedToday(ps.id) || PDAY().includes(ps.id); // walls reset at midnight London time
  let M = null; window.__rw.posters = posters;

  if (glow) { const GX = ['walls', 'roads', 'roofs', 'ground', 'pool', 'poolLED', 'canopy', 'trunk', 'lampPole', 'hlBeam', 'pavement', 'markings', 'puddles', 'bollards', 'railings', 'signalPoles', 'beaconPoles', 'kerbs']; for (const me of scene.meshes) { const base = ((me.metadata && me.metadata.chunkOf) || me.name).split(','); if (base.some(b => GX.includes(b))) glow.addExcludedMesh(me); }
    for (const me of scene.meshes) if (/-(body|head|skate|stan|barrel|stanb)$/.test(me.name) || me.name.startsWith('car-') || me.name === 'ci') glow.addExcludedMesh(me); }
  if (glow) for (const me of T.glowSkip()) glow.addExcludedMesh(me);
  if (glow) for (const ps of posters) glow.addExcludedMesh(ps.mesh); // photo posters: no bloom wash
  let mapBase = buildMinimapBase(city);
  try { const meta = await (await fetch(import.meta.env.BASE_URL + 'data/minimap_meta.json')).json(); const im = await loadMinimapImage(import.meta.env.BASE_URL + 'data/' + meta.file, meta); if (im) mapBase = Object.assign(im, { bounds: mapBase.bounds, proc: mapBase }); } catch (e) { console.warn('minimap', e); }
  app.mapBase = mapBase;
  const hud = createHUD(app);
  const RB = createRapid({ scene, traffic, hud, app, grid: city.grid }); window.__rw.RB = RB; window.__rw.traffic = traffic;
  // GPS destination (GTA-style): defaults to the Temple door; venues or a tapped waypoint from the pause map
  let DEST = { x: ext.doorPos.x, z: ext.doorPos.z, label: 'THE TEMPLE', kind: 'venue', id: 'temple' };
  const venueDest = VENUES.filter(v => v.inSlice).map(v => v.id === 'temple' ? { ...v, x: ext.doorPos.x, z: ext.doorPos.z } : v.id === 'warehousexl' && whDoor ? { ...v, x: whDoor.x, z: whDoor.z } : (d => d ? { ...v, x: d.x, z: d.z } : v)(venueDoors.find(q => q.v.id === v.id)));
  app.blips = { stops: RB.stops.map(s => ({ x: s.sx, z: s.sz })), posters: posters.filter(Boolean).map(ps => ({ x: ps.ix, z: ps.iz, get done() { return ps.mesh.isEnabled(); } })), collectibles: [] };
  // ---- photo hunt + crew cards (src/collect.js): no XP, no events, localStorage only
  { const byN = (n) => scene.getMeshByName(n);
    const targets = [
      { id: 'temple', name: 'THE TEMPLE', c: new Vector3(ext.doorPos.x, 7, ext.doorPos.z), r: 9, max: 160 },
      { id: 'cityhall', name: 'CITY HALL', mesh: byN('cityHall'), max: 300 },
      { id: 'stannes', name: "ST ANNE'S · SPIRE OF HOPE", mesh: byN('stannes'), max: 260 },
      { id: 'albertclock', name: 'THE ALBERT CLOCK', mesh: byN('albertClock'), max: 200 },
      { id: 'bigfish', name: 'THE BIG FISH', mesh: byN('bigFishBody'), max: 140 },
    ].filter(t => t.c || t.mesh);
    const spots = []; const tan = (d) => [d.nz, -d.nx];
    spots.push({ x: ext.doorPos.x - Math.cos(ext.yaw) * 3.2 + Math.sin(ext.yaw) * 0.6, z: ext.doorPos.z + Math.sin(ext.yaw) * 3.2 + Math.cos(ext.yaw) * 0.6, label: 'THE TEMPLE PORCH' });
    for (const d of [whDoor, ...venueDoors]) { if (d.nx === undefined) continue; const [tx, tz] = tan(d), sd = d.v && d.v.id === 'locationx' ? 1 : -1; spots.push({ x: d.x + tx * 3.4 * sd - d.nx * 1.2, z: d.z + tz * 3.4 * sd - d.nz * 1.2, label: (d.v ? d.v.name : 'THE WARE-HOUSE XL') + ' · PORCH' }); }
    for (const ps of posters.filter(Boolean)) spots.push({ x: ps.ix, z: ps.iz, label: ps.id.replace(/-/g, ' ').toUpperCase() + ' · WALL' });
    for (const st of RB.stops) spots.push({ x: st.sx - st.uz * 2.3, z: st.sz + st.ux * 2.3, label: 'RAPID STOP · ' + st.name });
    const sf = ((city.sf && city.sf.stops) || []).map(p => ({ x: p[0] ?? p.x, z: p[1] ?? p.z })).filter(p => Number.isFinite(p.x));
    while (spots.length < 20 && sf.length) { let bi = 0, bd = -1; sf.forEach((p, i) => { const d = Math.min(...spots.map(q => Math.hypot(p.x - q.x, p.z - q.z))); if (d > bd && d < 900) { bd = d; bi = i; } }); const p = sf.splice(bi, 1)[0]; spots.push({ x: p.x + 1.6, z: p.z + 1.6, label: 'BUS STOP' }); }
    for (const sp of spots) city.grid.resolve(sp, 0.5);
    COL = createCollect({ scene, hud, AU: { shutter: () => AU.shutter(), blip: (...a) => AU.blip(...a) }, app, grid: city.grid, targets, spots }); window.__rw.COL = COL; COL.onShoot = () => photo();
    if (glow) glow.addExcludedMesh(COL.mesh); }
  const mapCtx = () => ({ P, route, venues: venueDest, getDest: () => DEST, setDest: (d) => { DEST = d; routeT = 0; } });
  hud.setLive(app.live);
  // ---------- input ----------
  const K = app.keys;
  const BARTENDER = ['Poster run is on. Walls are going up on Hill St.', 'Flyers for the Ware-House XL are at the Temple door if you want a run.', 'Somebody got a photo of the Big Fish at 3am. Mad.', 'Twenty crew cards out there. One is round the back of a bus stop.', 'Floor is yours. Hit E on it and keep time.', 'Last orders is a myth in here.'];
  const sitAt = (b) => { const f = b.face ?? Math.PI / 2, sx = b.x + Math.sin(f) * 0.45, sz = b.z + Math.cos(f) * 0.45;
    if (!sitAt.stool) { const sm = new StandardMaterial('seatM', scene); sm.diffuseColor = hex('#2a2b30'); sm.specularColor = new Color3(0.2, 0.2, 0.2); sitAt.stool = toMesh('barSeat', merge([xf(cyl(0.07, 0.21, 0.21, 16), { t: [0, 0.74, 0] }), xf(cyl(0.72, 0.03, 0.03, 8), { t: [0, 0.37, 0] }), xf(cyl(0.03, 0.2, 0.2, 14), { t: [0, 0.015, 0] })]), scene, sm); }
    SEAT = { ox: P.x, oz: P.z, x: sx - Math.sin(f) * 0.08, z: sz - Math.cos(f) * 0.08, h: f, stool: sitAt.stool }; sitAt.stool.position.set(sx - Math.sin(f) * 0.12, (T.floorY ? T.floorY(sx, sz) : 0), sz - Math.cos(f) * 0.12); sitAt.stool.setEnabled(true);
    P.x = SEAT.x; P.z = SEAT.z; P.heading = f; P.speed = 0; app.lockMove = true;
    hud.note({ kicker: 'BAR · ' + T.name, title: 'THE BARTENDER', body: BARTENDER[Math.floor(Math.random() * BARTENDER.length)], hold: 6 }); };
  const standUp = () => { if (!SEAT) return; P.x = SEAT.ox; P.z = SEAT.oz; SEAT.stool.setEnabled(false); SEAT = null; app.lockMove = false; player.root.position.y = (T.floorY ? T.floorY(P.x, P.z) : 0); };
  addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; if (DANCE && DANCE.active() && DANCE.key(e)) { e.preventDefault(); return; }
    if (COL && COL.vfOn() && !app.title) { if (e.code === 'Escape' || e.code === 'KeyB') { COL.viewfinder(false); e.preventDefault(); return; } if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') { e.preventDefault(); photo(); return; } }
    if (SEAT && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) { standUp(); }
    K.add(e.code); const k = e.key.toLowerCase(); if (e.code === 'KeyB' && !app.title) { if (!C.lb) camSnap = true; C.lb = true; return; } if (e.code === 'Space' && !app.title) { e.preventDefault(); P.jumpReq = 0.15; return; } if (e.code === 'Tab') { e.preventDefault(); if (!app.title) app.key('phone'); return; } if (e.code === 'KeyQ' && !e.repeat && !app.title && !hud.isOpen() && app.wheel) { app.wheel.open(); return; } if ('emfopclnk'.includes(k) && k.length === 1) { if (app.phone && app.phone.isOpen && 'mop'.includes(k)) app.phone.close(); app.key(k); } if (e.code === 'Escape') { hud.close(); app.phone && app.phone.close(); app.wheel && app.wheel.release(false); } });
  addEventListener('keyup', (e) => { K.delete(e.code); if (e.code === 'KeyB') C.lb = false; if (e.code === 'KeyQ' && app.wheel) app.wheel.release(true); });
  let SENS = +localStorage.getItem('rw.sens') || 1; let padX = 0, padY = 0, padRun = false, padPrev = [];
  let drag = null; const stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 }; const look = { id: null, x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') { if (e.clientX < innerWidth * 0.45 && stick.id === null) { stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; hud.$('stick').style.cssText = `left:${e.clientX - 60}px;top:${e.clientY - 60}px;opacity:1`; } else if (look.id === null) { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; } }
    else { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId === stick.id) { let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const d = Math.hypot(dx, dy); if (d > 50) { dx *= 50 / d; dy *= 50 / d; } stick.x = dx / 50; stick.y = dy / 50; hud.$('nub').style.transform = `translate(${dx}px,${dy}px)`; }
    else if (e.pointerId === look.id) { C.yaw += (e.clientX - look.x) * 0.006 * SENS; C.pitch = Math.max(-0.30, Math.min(1.05, C.pitch + (e.clientY - look.y) * 0.004 * SENS)); look.x = e.clientX; look.y = e.clientY; }
    else if (drag) { C.yaw += (e.clientX - drag.x) * 0.005 * SENS; C.pitch = Math.max(-0.30, Math.min(1.05, C.pitch + (e.clientY - drag.y) * 0.004 * SENS)); drag.x = e.clientX; drag.y = e.clientY; }
  });
  const up = (e) => { if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; hud.$('nub').style.transform = ''; hud.$('stick').style.opacity = 0.3; } if (e.pointerId === look.id) look.id = null; drag = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { C.dist = Math.max(2.2, Math.min(14, C.dist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });
  let touchRun = false, fullPushT = 0; const ST = { v: 1, idle: 9, locked: false, flash: 0 }; window.__rw.stamina = ST; // RUN: hold to sprint; held > 350 ms and released while moving latches it (GTA SA mobile); a second tap cancels
  let runLatch = false, runDown = 0; const runBtn = hud.$('tRun');
  runBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (runLatch) { runLatch = false; touchRun = false; runBtn.classList.remove('on', 'latch'); return; } touchRun = true; runDown = performance.now(); runBtn.classList.add('on'); buzz(10); });
  const runUp = () => { if (!touchRun || runLatch) return; if (performance.now() - runDown > 350 && (stick.x || stick.y)) { runLatch = true; runBtn.classList.add('latch'); buzz([10, 30, 10]); } else { touchRun = false; runBtn.classList.remove('on'); } };
  runBtn.addEventListener('pointerup', runUp); runBtn.addEventListener('pointercancel', runUp);
  // ACTION: tap = context verb, long-press (450 ms) = action wheel
  let actT = null; const actBtn = hud.$('tAct');
  actBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); clearTimeout(actT); actT = setTimeout(() => { actT = 'wheel'; buzz(12); app.wheel && app.wheel.open(true); }, 450); });
  actBtn.addEventListener('pointerup', () => { if (actT === 'wheel') { actT = null; return; } clearTimeout(actT); actT = null; app.key('e'); });
  actBtn.addEventListener('pointercancel', () => { clearTimeout(actT); actT = null; });
  hud.$('tJump').addEventListener('pointerdown', (e) => { e.stopPropagation(); P.jumpReq = 0.15; });
  hud.$('tPhone').addEventListener('pointerdown', (e) => { e.stopPropagation(); app.key('phone'); });
  if (isTouch) document.body.classList.add('is-touch');

  // ---------- interactions ----------
  let interact = null;
  const fadeTo = async (fn) => { hud.fade(true); await new Promise(r => setTimeout(r, 380)); await fn(); await new Promise(r => setTimeout(r, 120)); hud.fade(false); };
  const cityLights = [hemi, moon, ext.light];
  const CLUBS = {}; const CLUB_ORDER = ['warehousexl', 'terminus', 'thompsons', 'warehouse', 'locationx'];
  const getClub = (id) => { if (CLUBS[id]) return CLUBS[id]; const v = VENUES.find(q => q.id === id);
    const c = buildClub(scene, id, { index: CLUB_ORDER.indexOf(id), low: LOW, posters: [...upP, ...pastP], venue: v }); c.cam = cam; c.root.setEnabled(false);
    c.grid = new SegGrid(8); for (const sg of c.segs) c.grid.add(sg[0], sg[1], sg[2], sg[3], 99);
    c.exitLabel = ({ warehousexl: 'DUNBAR STREET', terminus: 'GLENGALL STREET', thompsons: "PATTERSON'S PLACE", warehouse: 'BANKMORE SQUARE', locationx: 'LISBURN ROAD' })[id];
    if (glow) for (const me of c.glowSkip()) glow.addExcludedMesh(me); c.crowdMax = TEMPLE.crowdMax; return (CLUBS[id] = c); };
  const setMode = (m) => T.club ? setClubMode(T, scene, m) : setTempleMode(T, scene, m);
  let DOOR = null; // where to come back out
  const enterVenue = async (V, door) => fadeTo(() => {
    app.inside = true; city.root.setEnabled(false); SKY.sky.setEnabled(false); FL.setEnabled(false); WET.setEnabled(false); traffic.cars.forEach(c => c.node.setEnabled(false)); traffic.parked.forEach(c => c.node.setEnabled(false)); traffic.peds.forEach(p => p.av.root.setEnabled(false));
    T = V; DOOR = door; if (TEMPLE.CV) for (const it of TEMPLE.CV.list) for (const m of [it.body, it.head, it.far]) if (m) { m.parent = V.root; m.thinInstanceCount = 0; }
    cityLights.forEach(l => l.setEnabled(false)); Object.values(T.lights).forEach(l => l.setEnabled(true)); T.root.setEnabled(true); if (glow) glow.intensity = 0.55; if (pipe) pipe.imageProcessing.exposure = T.club ? 1.7 : 2.0;
    setMode(Q.get('lights') === 'day' ? 'day' : 'rave'); hud.interior(true, T.mode);
    P.x = T.spawn.x; P.z = T.spawn.z; P.heading = 0; C.yaw = 0; C.pitch = 0.16; C.dist = 4.6; C.curDist = 4.6;
    EV.raveEnter(T.club ? T.name : 'The Temple'); hud.toast(T.name + ' · ' + (T.club ? T.sub : 'CARLISLE CIRCUS'));
  });
  const enterTemple = async () => enterVenue(TEMPLE, { x: ext.doorPos.x - Math.sin(ext.yaw) * 2.5, z: ext.doorPos.z - Math.cos(ext.yaw) * 2.5, heading: ext.yaw + Math.PI });
  const enterClub = async (id, d) => enterVenue(getClub(id), { x: d.x + (d.nx || 0) * 0.8, z: d.z + (d.nz || 0) * 0.8, heading: d.nx !== undefined ? Math.atan2(d.nx, d.nz) : 0 });
  const exitTemple = async () => fadeTo(async () => {
    app.inside = false; T.root.setEnabled(false); Object.values(T.lights).forEach(l => l.setEnabled(false)); cityLights.forEach(l => l.setEnabled(true)); if (glow) glow.intensity = 0.5; if (pipe) pipe.imageProcessing.exposure = 1.4;
    city.root.setEnabled(true); SKY.sky.setEnabled(true); FL.setEnabled(true); WET.setEnabled(true); traffic.cars.forEach(c => c.node.setEnabled(true)); traffic.parked.forEach(c => c.node.setEnabled(true)); traffic.peds.forEach(p => { p.av.root.setEnabled(true); p._on = undefined; });
    scene.clearColor = NIGHT; scene.fogDensity = 0.0028; scene.fogColor = new Color3(0.1, 0.105, 0.17); hud.interior(false);
    const d = DOOR || { x: ext.doorPos.x - Math.sin(ext.yaw) * 2.5, z: ext.doorPos.z - Math.cos(ext.yaw) * 2.5, heading: ext.yaw + Math.PI };
    P.x = d.x; P.z = d.z; P.heading = d.heading; C.yaw = P.heading; C.pitch = 0.2; C.dist = 5.8;
    T = TEMPLE; await EV.raveExit();
  });
  const AU = createAudio();
  let npLast = '', muS = {};
  const MU = createMusic({ onState: (m) => { muS = m; if (m.playing && m.title && m.title !== npLast) { npLast = m.title; if (!app.title) hud.note({ kicker: 'NOW PLAYING · RECKLESS FM', title: m.title.toUpperCase(), body: 'Reckless Raves on SoundCloud', type: 'radio' }); } AU.beatOff = m.playing; const np = document.getElementById('np'); if (np) { np.innerHTML = m.playing && m.title ? `♪ ${m.title.toUpperCase()} · RECKLESS RAVES ON SOUNDCLOUD` : (m.failed ? '♪ RECKLESS BEAT (SOUNDCLOUD UNAVAILABLE)' : ''); np.href = m.link; } } });
  DANCE = createDance({ hud, AU, MU, isTouch, onPunch: (k) => { punch = Math.max(punch, k); buzz(k > 0.8 ? 18 : 8); } }); window.__rw.dance = DANCE;
  window.__rw.MU = MU; window.__rw.hud = hud;
  const sndLbl = () => { const b = document.getElementById('sndBtn'); if (b) b.textContent = 'SOUND: ' + (AU.on ? 'ON' : 'OFF'); if (AU.on && !Q.has('nosc')) MU.start(); else MU.pause(); };
  addEventListener('pointerdown', () => { if (!app.title && !AU.on && !app._snd) { app._snd = 1; AU.unlock(); sndLbl(); } }, { once: false });
  app.key = (k) => {
    if (k === 'n') { AU.toggle(); sndLbl(); return; }
    if (k === 'k') { MU.next(); return; }
    if (k === 'c') { if (hud.isOpen()) return hud.close(); hud.openCredits(`<button id="exp">EXPORT TEST EVENTS (${EV.queue().length})</button><button id="livebtn">RAVE MODE: ${app.live ? 'ON' : 'OFF'}</button>`);
      document.getElementById('exp').onclick = () => EV.exportQueue(); document.getElementById('livebtn').onclick = (e) => { app.live = !app.live; hud.setLive(app.live); e.target.textContent = 'RAVE MODE: ' + (app.live ? 'ON' : 'OFF'); }; return; }
    if (k === 'm') { if (hud.isOpen()) return hud.close(); return hud.openMap(mapCtx()); }
    if (k === 'o') { if (hud.isOpen()) return hud.close(); const reopen = () => { hud.close(); app.key('o'); };
      return hud.openWardrobe(CR, { fit: { ...CREW.fit }, xp: CREW.xp, account: CREW.account, email: EV.getEmail(), setEmail: EV.setEmail, apply: applyFit,
        signIn: async (e) => { CREW.account = await CR.signIn(e); await loadCrew(); reopen(); }, base: CREW.base, baseFromApp: CREW.baseFromApp, setBase: (b) => setBase(b), signOut: () => { CR.signOut(); CREW.account = null; CREW.xp = null; CREW.baseFromApp = false; if (CR.getLocalBase()) setBase(CR.getLocalBase()); applyFit(CREW.fit); reopen(); } }); }
    if (k === 'f') { if (app.inside && T.mode === 'rave' && T.danceFloor(P) && DANCE && !DANCE.active()) { standUp(); return DANCE.start({ venue: T.name, t }); } P.dancing = !P.dancing; return; }
    if (k === 'l' && app.inside) { setMode(T.mode === 'day' ? 'rave' : 'day'); hud.interior(true, T.mode); return; }
    if (k === 'p') return photo();
    if (k === 'e' && interact) return interact.act();
  };
  const photo = async () => {
    if (COL && !app.inside) { scene.render(); COL.checkShot(cam, engine.getRenderingCanvas()); }
    hud.hud.classList.add('hidden-for-photo');
    const data = await Tools.CreateScreenshotUsingRenderTargetAsync(engine, cam, { width: 1280, height: 1600 > innerHeight ? 720 : 720 });
    hud.hud.classList.remove('hidden-for-photo');
    const img = new Image(); img.src = data; await img.decode();
    const c = document.createElement('canvas'); c.width = 1360; c.height = 900; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 40, 40, 1280, 720);
    const logo = new Image(); logo.src = import.meta.env.BASE_URL + 'img/logo.png'; await logo.decode(); g.drawImage(logo, 40, 784, 96, 83);
    g.fillStyle = '#fff'; g.font = '800 34px Unbounded'; g.fillText('RECKLESS WORLD', 156, 826); g.font = '600 22px "DM Sans"'; g.fillText((app.inside ? T.name : (state.street || 'BELFAST')) + ' · BELFAST', 158, 862);
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
    const dt = (window.__rw.fixedDt || Math.min(0.05, engine.getDeltaTime() / 1000)) * (app.wheel && app.wheel.isOpen && !isTouch ? 0.3 : 1); t += dt;
    // movement
    let ix = 0, iz = 0;
    if (!app.paused && !app.title) { if (K.has('KeyW') || K.has('ArrowUp')) iz += 1; if (K.has('KeyS') || K.has('ArrowDown')) iz -= 1; if (K.has('KeyA') || K.has('ArrowLeft')) ix -= 1; if (K.has('KeyD') || K.has('ArrowRight')) ix += 1; ix += stick.x; iz -= stick.y; }
    { const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(p => p && p.connected && p.axes.length >= 2) : null;
      if (gp && !app.title) { if (!app._pad) { app._pad = true; document.body.classList.add('has-pad'); hud.note({ title: 'CONTROLLER CONNECTED', body: 'A jump · X action · Y phone · RB sprint · hold LB wheel · R3 look back · START map.' }); }
        const dz = (v) => Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85; padX = dz(gp.axes[0]); padY = dz(gp.axes[1]); const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
        const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5)), ed = (i) => b(i) && !padPrev[i];
        if (app.wheel.isOpen) { if (Math.hypot(rx, ry) > 0.5) app.wheel.point(innerWidth / 2 + rx * 160, innerHeight / 2 + ry * 160); }
        else { C.yaw += rx * 2.6 * SENS * dt; C.pitch = Math.max(-0.30, Math.min(1.05, C.pitch + ry * 1.6 * SENS * dt)); }
        const dz2 = DANCE && DANCE.active(); if (dz2) { [[14, 0], [13, 1], [12, 2], [15, 3], [2, 0], [0, 1], [3, 2], [1, 3]].forEach(([i, l]) => { if (ed(i)) DANCE.pad(l); }); if (ed(9)) DANCE.stop(false); }
        else if (COL && COL.vfOn()) { if (ed(0) || ed(2)) photo(); if (ed(1)) COL.viewfinder(false); }
        else { if (ed(0)) { if (SEAT) standUp(); else P.jumpReq = 0.15; } if (ed(2)) app.key('e'); if (ed(3)) app.key('phone'); if (ed(9)) app.key('m'); if (ed(1)) { hud.close(); app.phone.close(); } }
        padRun = b(5) || b(7); if (b(11) && !C.lb) camSnap = true; C.lb = b(11) || K.has('KeyB');
        if (ed(4)) app.wheel.open(true); if (!b(4) && padPrev[4] && app.wheel.isOpen) app.wheel.release(true);
        padPrev = gp.buttons.map((x, i) => b(i)); ix += padX; iz -= padY; } }
    if (window.__rw.auto) { iz = window.__rw.auto.iz || 0; ix = window.__rw.auto.ix || 0; }
    if (SEAT && Math.hypot(ix, iz) > 0.3) standUp();
    if (app.lockMove || (DANCE && DANCE.active())) { ix = 0; iz = 0; }
    const mag = Math.min(1, Math.hypot(ix, iz)); const kb0 = K.has('KeyW') || K.has('KeyS') || K.has('KeyA') || K.has('KeyD') || K.has('ArrowUp') || K.has('ArrowDown') || K.has('ArrowLeft') || K.has('ArrowRight'); const kb = kb0 && !(padX || padY);
    // gait (research/game-design.md 2.1): walk 1.6 / jog 3.2 / sprint 6.0 m/s; keyboard jogs, Shift sprints; stick < 0.55 walks, full push (or RUN) sprints
    if (stick.x || stick.y) { if (mag > 0.97) fullPushT += dt; else fullPushT = 0; } else fullPushT = 0;
    const wantRun = K.has('ShiftLeft') || K.has('ShiftRight') || touchRun || padRun || fullPushT > 0.35 || (window.__rw.auto && window.__rw.auto.run);
    const sprint = wantRun && mag > 0.3 && ST.v > 0 && !ST.locked && !app.inside;
    let gait = mag < 0.05 ? 0 : sprint ? 6.0 : (kb || mag >= 0.55) ? 3.2 : 1.6; if (app.inside) gait *= 0.85;
    // stamina: 4.5 s of sprint, 2.5 s delay after release, 3.0 s to refill; jogging drains at 0.25x; empty -> jog + red pulse
    const draining = sprint ? 1 : (gait >= 3.2 && !app.inside ? 0.25 : 0);
    if (draining) { ST.v = Math.max(0, ST.v - draining * dt / 4.5); ST.idle = 0; if (ST.v === 0 && sprint) { ST.locked = true; ST.flash = 0.6; } }
    else { ST.idle += dt; if (ST.idle > 2.5) ST.v = Math.min(1, ST.v + dt / 3.0); }
    if (ST.locked && ST.v > 0.35) ST.locked = false; ST.flash = Math.max(0, ST.flash - dt);
    const sp = gait * mag / Math.max(mag, 1e-3) * (mag < 0.05 ? 0 : 1);
    if (mag > 0.05) { P.dancing = false; const fx = Math.sin(C.yaw), fz = Math.cos(C.yaw); const mx = fx * iz + fz * ix, mz = fz * iz - fx * ix; const L = Math.hypot(mx, mz);
      const h = Math.atan2(mx / L, mz / L); let dh = h - P.heading; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; P.heading += dh * Math.min(1, dt * (sprint ? 7 : 10)); P.mx = mx / L; P.mz = mz / L; }
    // envelope: accel 10 (14 sprinting) m/s^2, decel 22 m/s^2
    if (sp > P.speed) P.speed = Math.min(sp, P.speed + (sprint ? 14 : 10) * dt * (P.air ? 0.3 : 1)); else P.speed = Math.max(sp, P.speed - (P.air ? 3 : 22) * dt);
    // jump (Space / JUMP): ~1.1 m, 0.6 s in the air; context vault over a low wall/railing (<= 1.05 m) within 1.1 m at jog or faster
    const GRAV = 24; if (P.jumpReq > 0) P.jumpReq -= dt;
    if (!P.air && !app.paused && !app.title) {
      let go = P.jumpReq > 0, vault = false;
      if (!go && !app.inside && P.speed >= 1.8 && P.mx != null && mag > 0.3) { const gr = city.grid, ax = P.x + P.mx * 1.1, az = P.z + P.mz * 1.1, lo = gr.raycast(P.x, P.z, ax, az, 0.01);
        if (lo < 0.8 && gr.raycast(P.x, P.z, ax, az, 1.06) >= 1) { go = true; vault = true; } }
      if (go) { P.air = true; P.vy = 7.0; P.jumpReq = 0; P.vault = vault; if (vault) P.speed = Math.max(P.speed, 3.4); buzz(10); }
    }
    if (P.air) { P.y += P.vy * dt; P.vy -= GRAV * dt; if (P.y <= 0) { P.y = 0; P.air = false; P.vy = 0; P.vault = false; C.dip = 0.14; buzz(12); } }
    if (P.speed > 0.01 && P.mx != null) { P.x += P.mx * P.speed * dt; P.z += P.mz * P.speed * dt; }
    const pp = { x: P.x, z: P.z }; (app.inside ? T.grid : city.grid).resolve(pp, 0.38, P.y - 0.02); P.x = pp.x; P.z = pp.z;
    const autoDance = app.inside && T.mode === 'rave' && T.danceFloor(P) && P.speed < 0.2 && !window.__rw.noAutoDance;
    if (SEAT) { P.x = SEAT.x; P.z = SEAT.z; P.heading = SEAT.h; P.speed = 0; }
    player.root.position.set(P.x, P.y + (app.inside && T.floorY ? T.floorY(P.x, P.z) : 0) + (SEAT ? (window.__rw.seatY ?? 0.3) : 0), P.z); player.root.rotation.y = P.heading; dust.emitter.set(P.x, 0.05, P.z); dust.emitRate = P.speed > 4.5 && !app.inside ? 45 : 0;
    if (player.lightRig) player.lightRig(cam);
    SKY.update(cam);
    if (player.animate) player.animate(dt, { speed: SEAT ? 0 : P.speed, dancing: (P.dancing || autoDance || (DANCE && DANCE.active())) && !SEAT, air: P.air && !SEAT, sitting: !!SEAT }); else animateAvatar(player, dt, { speed: P.speed * 0.8, dancing: P.dancing || autoDance });
    // camera with collision
    C.dip = Math.max(0, C.dip - dt); const dipY = C.dip > 0 ? -0.14 * Math.sin(Math.PI * C.dip / 0.14) : 0; // 0.14 s landing dip
    tgt.set(P.x, 1.5 + P.y * 0.55 + dipY, P.z);
    C.arm += ((P.speed > 4.5 && !app.inside ? 6.6 / 5.8 : 1) - C.arm) * Math.min(1, dt * 2); // arm 5.8 m walking, 6.6 m sprinting
    C.lbA = C.lb ? 1 : Math.max(0, (C.lbA || 0) - dt / 0.18); const yawE = C.yaw + Math.PI * (C.lbA * C.lbA * (3 - 2 * C.lbA)); // look-behind: snap, restore in 180 ms
    const cp = Math.cos(C.pitch), want = C.dist * C.arm; const ox = -Math.sin(yawE) * cp, oz = -Math.cos(yawE) * cp, oy = Math.sin(C.pitch);
    const camY = 1.5 + oy * want; const hit = (app.inside ? T.grid : city.grid).raycast(P.x, P.z, P.x + ox * want, P.z + oz * want, camY);
    const d = Math.max(1.0, want * hit - (hit < 1 ? 0.35 : 0)); C.curDist += (d - C.curDist) * Math.min(1, dt * (d < C.curDist ? 20 : 3.5)); // hide fast, restore lazily
    camPos.set(P.x + ox * C.curDist, Math.max(0.35, 1.5 + P.y * 0.55 + dipY + oy * C.curDist), P.z + oz * C.curDist);
    // smoothed follow camera + slight FOV kick when sprinting
    if (camSnap) { smPos.copyFrom(camPos); smTgt.copyFrom(tgt); camSnap = false; } else { const k = Math.min(1, dt * 8); Vector3.LerpToRef(smPos, camPos, k, smPos); Vector3.LerpToRef(smTgt, tgt, Math.min(1, dt * 14), smTgt); }
    cam.position.copyFrom(smPos); cam.setTarget(smTgt);
    const wantFov = 0.95 + (P.speed > 4.5 && !app.inside ? 0.09 : 0); cam.fov += (wantFov - cam.fov) * Math.min(1, dt * 3);
    if (app.title) { const f = flyover(window.__rwFly.at != null ? window.__rwFly.at : t - titleT0); cam.position.copyFrom(f.p); cam.setTarget(f.t); cam.fov = 0.9; camSnap = true; }
    if (window.__rw.camRel) { const o = window.__rw.camRel, h = P.heading + o[0], d = o[1]; cam.position.set(P.x + Math.sin(h) * d, o[2], P.z + Math.cos(h) * d); cam.setTarget(new Vector3(P.x, o[3], P.z)); }
    if (RB.update(dt, P, cam, () => { C.yaw = P.heading; })) camSnap = true;
    else if (window.__rw.camOverride) { const o = window.__rw.camOverride; cam.position.set(o[0], o[1], o[2]); cam.setTarget(new Vector3(o[3], o[4], o[5])); }
    // world updates
    if (COL) { COL.update(P, t, app.inside); COL.frameHint(cam); }
    if (DANCE) DANCE.update(dt, t); punch = Math.max(0, punch - dt * 3.5); if (glow && app.inside) glow.intensity = 0.55 + punch * 0.9; if (pipe && app.inside) pipe.imageProcessing.exposure = (T.club ? 1.7 : 2.0) + punch * 0.35;
    if (!app.inside) { updateCity(city, t); updateLandmarks(LM, t); updateTempleExterior(ext, t, app.live); updateTraffic(traffic, dt, P, t); templeRing.rotation.y += dt; templeRing.scaling.setAll(1 + 0.06 * Math.sin(t * 4)); }
    else if (T.club) updateClub(T, t, dt, TEMPLE.CV); else updateTempleInterior(T, t, dt), T.dancers.forEach(dn => animateAvatar(dn, dt, { dancing: true }));
    // interaction prompts
    interact = null;
    if (!app.inside) {
      if (M && (interact = M.interact())) { }
      else if (Math.hypot(P.x - ext.doorPos.x, P.z - ext.doorPos.z) < 3.2) interact = { label: `<b>E</b> ENTER THE TEMPLE`, act: enterTemple };
      else if (venueDoors.some(d => Math.hypot(P.x - d.x, P.z - d.z) < 3.2)) { const d = venueDoors.find(d => Math.hypot(P.x - d.x, P.z - d.z) < 3.2); interact = { label: `<b>E</b> ENTER ${d.v.name}${d.v.nostalgia ? ' · EST. · THE OLD PALM HOUSE' : ''}`, act: () => enterClub(d.v.id, d) }; }
      else if (Math.hypot(P.x - whDoor.x, P.z - whDoor.z) < 3.2) interact = { label: `<b>E</b> ENTER THE WARE-HOUSE XL`, act: () => enterClub('warehousexl', whDoor) };
      else if (RB.nearStop(P)) { const st = RB.nearStop(P); interact = { label: `<b>E</b> RAPID BUS · FAST TRAVEL`, act: () => RB.menu(st, P) }; }
      else for (const ps of posters) if (Math.hypot(P.x - ps.ix, P.z - ps.iz) < 2.4) { const done = posterDone(ps); interact = { label: done ? 'POSTER UP ✓' : `<b>E</b> ${ps.mesh.isEnabled() ? 'PASTE A FRESH POSTER' : 'PASTE A RECKLESS POSTER'}`, act: async () => { if (done) return; ps.mesh.setEnabled(true); localStorage.setItem('rw.poster.' + ps.id, '1'); markPasted(ps.id); buzz([20, 40, 20]); const ev = await EV.posterPlaced(ps.id); if (!(M && M.onPaste(ps, ev))) hud.toast(ev && ev.blocked ? 'POSTER UP · ' + ev.blocked : ev ? 'POSTER UP · TEST EVENT QUEUED' : 'POSTER UP'); } }; break; }
    } else if (DANCE && DANCE.active()) interact = null;
    else if (SEAT) interact = { label: '<b>E</b> STAND UP', act: standUp };
    else if (P.z - T.exitPos.z < 1.2 && Math.abs(P.x - T.exitPos.x) < 2) interact = { label: `<b>E</b> EXIT TO ${T.exitLabel}`, act: exitTemple };
    else if (app.ordered === T.name && T.bars && T.bars.some(b => Math.hypot(P.x - b.x, P.z - b.z) < 1.7)) { const b = T.bars.find(b => Math.hypot(P.x - b.x, P.z - b.z) < 1.7); interact = { label: '<b>E</b> TAKE A SEAT', act: () => sitAt(b) }; }
    else if (T.bars && T.bars.some(b => Math.hypot(P.x - b.x, P.z - b.z) < 1.7)) interact = { label: '<b>E</b> ORDER AT THE BAR', act: () => { const D = ['RECKLESS RED · CHERRY SODA', 'CARLISLE COOLER · LIME + MINT', 'NIGHT BUS · COLD BREW TONIC', 'THE USUAL · WATER, LOTS OF ICE', 'GLENGALL GINGER · GINGER BEER']; buzz(15); hud.toast('ORDERED · ' + D[Math.floor(Math.random() * D.length)] + ' · SOFT DRINKS ONLY'); app.ordered = T.name; } };
    else if (T.mode === 'rave' && T.danceFloor(P)) interact = { label: '<b>E</b> DANCE', act: () => DANCE.start({ venue: T.name, t }) };
    hud.prompt(interact ? interact.label : ''); if (isTouch) { const ia = !!interact; if (ia && !app._ia) buzz(12); app._ia = ia; hud.$('tAct').classList.toggle('on', ia); }
    // HUD
    slowT -= dt; if (slowT <= 0) { slowT = 0.5; if (COL) app.blips.collectibles = COL.blips(); if (app.inside) EV.raveTick().then(ev => { if (!ev) return; if (ev.blocked) hud.note({ kicker: 'CREW', title: '10 MINUTES IN', body: ev.blocked }); else hud.stamp({ title: 'VISIT LOGGED', sub: T.name + ' · 10 MINUTES IN', lines: ['RAVE VISIT · TEST EVENT QUEUED', 'CREW ADDS XP AFTER LAUNCH'] }); }); state.street = app.inside ? T.name : nearestStreet(); state.district = app.inside ? (T.club ? T.sub + (T.mode === 'day' ? ' · HOUSE LIGHTS' : ' · RAVE') : (T.mode === 'day' ? 'NAVE · DAYLIGHT' : 'NAVE · RAVE')) : nearestDistrict();
      { const dd = Math.hypot(P.x - ext.doorPos.x, P.z - ext.doorPos.z); AU.update({ inside: app.inside, dist: dd }); MU.setVolume(app.inside ? 90 : 22 + Math.max(0, 1 - dd / 90) * 30); }
      routeT -= 0.5; if (routeT <= 0 && !app.inside) { routeT = 1.5; if (DEST && DEST.kind === 'waypoint' && Math.hypot(DEST.x - P.x, DEST.z - P.z) < 14) { DEST = null; hud.toast('WAYPOINT REACHED'); } state.route = DEST ? route(P.x, P.z, DEST.x, DEST.z) : null; } if (app.inside) state.route = null; state.dest = DEST;
      const tv = VENUES[0]; state.objective = (M && M.objective()) || (app.inside ? '' : `▲ THE TEMPLE <b>${Math.round(Math.hypot(P.x - ext.doorPos.x, P.z - ext.doorPos.z))}M</b>`); }
    if (!app.title && !isTouch) { const idle = Math.abs(P.speed) < 0.05 && !hud.isOpen() && !app.phone.isOpen; app.idleT = idle ? (app.idleT || 0) + dt : 0;
      if (app.idleT > 14 && !app._kIdle) { app._kIdle = true; keyHints(app.inside ? 'temple' : ''); } if (!idle && app._kIdle) { app._kIdle = false; hud.keys(null); }
      if (!!app.inside !== !!app._kIn) { app._kIn = !!app.inside; if (app.inside) keyHints('temple'); } }
    if (M && !app.title) { M.update(dt); state.patrols = M.blips(); const hk = M.H.level + '|' + (M.H.hidden > 0) + '|' + (M.H.flash > 0); if (hk !== app._hk) { app._hk = hk; hud.heat(M.H.level, M.H.hidden > 0, M.H.flash > 0); } }
    hud.update(dt, { stamina: ST.v, stamFlash: ST.flash, x: P.x, z: P.z, heading: P.heading, camYaw: C.yaw, inside: app.inside, lx: P.x - T.root.position.x, lz: P.z - T.root.position.z, plan: app.inside && T.club ? T.plan : null, ...state });
    fpsT += dt; if (fpsT > 0.5) { fpsT = 0; hud.fps(Math.round(engine.getFps())); }
    cullT -= dt; if (culler && cullT <= 0 && !app.inside) { cullT = 0.25; culler.setDist(app.title ? 900 : TIERS[tier].dist); culler.update(cam.position); WET.update(cam.position); const pd = TIERS[tier].dist * 0.3; for (const p of traffic.peds) { const on = Math.hypot(p.av.root.position.x - cam.position.x, p.av.root.position.z - cam.position.z) < pd; if (p._on !== on) { p._on = on; p.av.root.setEnabled(on); } } }
    if (!app.title && !app.inside && autoTier) { tierT += engine.getDeltaTime() / 1000; tierF.push(engine.getFps()); if (tierT > 4) { const avg = tierF.reduce((a, b) => a + b, 0) / tierF.length; tierF = []; tierT = 0;
      const order = ['low', 'med', 'high'], i = order.indexOf(tier); if (avg < 24 && i > 0) setTier(order[i - 1]); else if (avg > 55 && i < 2 && !tierUp) { tierUp = true; setTier(order[i + 1]); } } }
  });
  window.__rw.setTier = setTier; window.__rw.culler = culler; window.__rw.FL = FL;
  window.__rw.manual = (on) => { if (on) engine.stopRenderLoop(); else engine.runRenderLoop(() => scene.render()); }; window.__rw.renderFrame = (n = 1) => { for (let i = 0; i < n; i++) scene.render(); return true; };
  window.__rw.inst = new SceneInstrumentation(scene); window.__rw.inst.captureFrameTime = true;
  // render guard: if a frame throws (shader/post-process unsupported on this GPU), drop post-processing and keep going
  let rErr = 0; const stripPost = (why) => { console.warn('post-processing off:', why); try { if (SSAO) { scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline('ssao', cam0); SSAO.dispose(); SSAO = null; } } catch (e) { } try { if (pipe) { pipe.dispose(); pipe = null; } } catch (e) { } try { if (glow) { glow.dispose(); glow = null; } } catch (e) { } try { scene.disableGeometryBufferRenderer && scene.disableGeometryBufferRenderer(); scene.disablePrePassRenderer && scene.disablePrePassRenderer(); } catch (e) { } { const ip = scene.imageProcessingConfiguration; ip.isEnabled = true; ip.toneMappingEnabled = true; ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES; ip.exposure = 1.4; ip.contrast = 1.1; } };
  const frame = () => { try { scene.render(); rErr = 0; } catch (e) { rErr++; console.error('render', e); if (rErr === 1) stripPost(e.message); if (rErr > 5) { engine.stopRenderLoop(); DG.fatal('rendering failed', e); } } };
  engine.runRenderLoop(frame); DG.info.stage = 'running'; DG.info.ready = true;
  // black-canvas check: the night sky clear colour is never pure black, so an all-black canvas means the GPU output failed
  const blackCheck = async (pass) => { try { const w = engine.getRenderWidth(), h = engine.getRenderHeight(); const px = await new Promise((res, rej) => scene.onAfterRenderObservable.addOnce(() => { try { res(engine.readPixels(Math.floor(w / 2) - 8, Math.floor(h * 0.25), 16, 16)); } catch (e) { rej(e); } })); // read inside the frame: after present the drawing buffer is cleared, which read as a false 'black canvas' let sum = 0; for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2];
      DG.log('pixel check', pass, sum); if (sum === 0) { if (pass === 1) { stripPost('black canvas'); setTimeout(() => blackCheck(2), 1500); } else DG.show('black screen detected (post-processing already off)'); } } catch (e) { DG.log('pixel check skipped', e.message); } };
  setTimeout(() => blackCheck(1), 2500);
  addEventListener('resize', () => engine.resize());
  document.getElementById('loading').classList.add('done'); bar(100);
  if (!Q.has('debug') && !Q.has('fps')) { const f = document.getElementById('fps'); if (f) f.style.display = 'none'; }
  // ---- stage 6: crew phone hub + action wheel (research/game-design.md 1.5/1.6) ----
  const uiRoot = document.body;
  const templeDest = () => ({ x: ext.doorPos.x, z: ext.doorPos.z, label: 'THE TEMPLE', kind: 'venue', id: 'temple' });
  const setDestP = (d, id) => { const vd = id && venueDest.find(v => v.id === id); DEST = id === 'temple' ? templeDest() : vd ? { x: vd.x, z: vd.z, label: vd.name, kind: 'venue', id } : d; routeT = 0; hud.toast('GPS · ' + DEST.label); };
  const spotName = (id) => id.replace(/-/g, ' ').toUpperCase();
  app.phone = createPhone({ root: uiRoot,
    open: { map: () => app.key('m'), wardrobe: () => app.key('o'), camera: () => app.key('p'), viewfinder: () => COL && COL.viewfinder(true), credits: () => app.key('c') },
    cardArt: (() => { const cache = {}; return (i) => cache[i] || (cache[i] = cardArt(i, 160).toDataURL('image/png')); })(), hunt: () => COL ? COL.photoList() : [], cards: () => COL ? COL.cards() : [], danceBest: () => +localStorage.getItem('rw.danceBest') || 0,
    sound: { label: () => (AU.on ? 'SOUND ON' : 'SOUND OFF'), toggle: () => app.key('n') },
    quality: { get: () => tier, set: (n) => { if (TIERS[n]) setTier(n); } },
    radio: () => ({ ...muS, link: SC_PROFILE }), skip: () => MU.next(),
    rave: () => ({ inside: !!app.inside, lights: T.mode, venue: app.inside ? T.name : 'THE TEMPLE', venues: venueDest.map(v => ({ id: v.id, name: v.name, sub: v.sub })), dwell: app.inside ? EV.dwell() : 0, need: EV.MIN_DWELL }),
    posters: () => posters.map(p => ({ name: spotName(p.id), done: posterDone(p), x: p.ix, z: p.iz })),
    crew: () => CREW.account ? { rank: 'CREW LEVEL ' + CR.playerLevel(CREW.xp), line: 'Signed in. Your crew rank unlocks wardrobe pieces.' } : { rank: 'SIGNED OUT', line: 'Sign in with your crew email to wear unlocked pieces.' },
    onAct: (a) => { if (a === 'lights') { app.key('l'); return true; } return false; },
    sens: { get: () => SENS, set: (v) => { SENS = v; localStorage.setItem('rw.sens', String(v)); } },
    setDest: setDestP, onUnread: (n) => { const b = document.getElementById('tPhoneN'); if (b) { b.textContent = n || ''; b.classList.toggle('on', n > 0); } } });
  app.wheel = createWheel({ root: uiRoot, run: (id) => {
    if (id === 'phone') return app.key('phone');
    if (id === 'radio') { if (!AU.on) app.key('n'); else MU.next(); return; }
    if (id === 'camera') return app.inside ? app.key('p') : COL ? COL.viewfinder(true) : app.key('p');
    if (id === 'dance') return app.key('f');
    if (id === 'wardrobe') return app.key('o');
    if (id === 'map') return app.key('m');
    if (id === 'poster') { if (interact && /POSTER/i.test(interact.label || '')) return interact.act(); return hud.toast('NO POSTER WALL IN RANGE'); }
    if (id === 'cab') return hud.toast('BLACK CABS · COMING SOON');
  } });
  const _key = app.key; app.key = (k) => { if (k === 'phone') { if (hud.isOpen()) hud.close(); return app.phone.toggle(); } return _key(k); };
  window.__rw.phone = app.phone; window.__rw.wheel = app.wheel;
  { const sx = ext.spawn.x - ext.doorPos.x, sz = ext.spawn.z - ext.doorPos.z, L = Math.hypot(sx, sz) || 1;
    const pickup = { x: ext.spawn.x - sz / L * 3, z: ext.spawn.z + sx / L * 3 };
    const drops = [{ id: 'warehousexl', name: VENUES[1].name, x: whDoor.x, z: whDoor.z }, ...venueDoors.filter(d => d.v.id !== 'locationx').map(d => ({ id: d.v.id, name: d.v.name, x: d.x, z: d.z }))];
    M = createMissions({ hud, P, app, posters, isDone: posterDone, traffic, grid: () => city.grid, route, buzz, siren: () => AU.siren(), inside: () => !!app.inside,
      setDest: (d) => { DEST = d; routeT = 0; }, text: (m) => app.phone.text(m), pickup, drops,
      relocate: () => { hud.fade(true); setTimeout(() => { P.x = ext.spawn.x; P.z = ext.spawn.z; P.speed = 0; P.heading = ext.yaw + Math.PI; C.yaw = P.heading; camSnap = true; hud.fade(false); }, 450); } });
    app.phone.ctx.missions = M; window.__rw.M = M; }
  hud.$('tWheel').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (app.wheel.isOpen) return app.wheel.release(false); app.wheel.open(true); });
  hud.hud.classList.add('titlehide'); titleT0 = t; document.getElementById('title').classList.add('ready');
  const posterText = () => { const P0 = posters.find(p => !(posterDone(p))); if (!P0) return;
    app.phone.text({ title: 'POSTER RUN. ' + posters.length + ' WALLS.', body: 'Watch for patrols. Start when you are ready.', act: () => M && M.startPosterRun() }); setTimeout(() => app.phone.text({ title: 'FLYERS NEED DROPPING', body: 'Bundle at the Temple door, four venues, against the clock.', act: () => M && M.startFlyers() }), 30000); };
  const showHints = () => { if (localStorage.getItem('rw.hints')) return; localStorage.setItem('rw.hints', '1');
    hud.hints(isTouch ? `<div class="hk" style="left:14%;top:52%">MOVE<i>DRAG LEFT SIDE</i></div><div class="hk" style="right:22%;top:36%">LOOK<i>DRAG RIGHT SIDE</i></div>
      <div class="hk" style="right:10px;bottom:calc(max(28px,env(safe-area-inset-bottom) + 12px) + 70px);display:none"></div>
      <div class="hk" style="right:96px;bottom:calc(max(28px,env(safe-area-inset-bottom) + 12px) + 136px)">◎ WHEEL<i>OR HOLD E</i></div><div class="hk" style="right:150px;bottom:calc(max(28px,env(safe-area-inset-bottom) + 12px) + 20px)">RUN<i>HOLD · LATCH</i></div>`
      : `<div class="card"><b>WASD</b>MOVE<b>SHIFT</b>SPRINT<b>SPACE</b>JUMP · VAULT<b>E</b>ACTION<b>TAB</b>PHONE<b>HOLD Q</b>WHEEL<b>B</b>LOOK BACK<b>M</b>MAP</div>`, 7000); };
  const keyHints = (ctxt) => { if (isTouch) return; const pad = !!app._pad;
    const base = pad ? [['Y', 'PHONE'], ['LB', 'WHEEL'], ['START', 'MAP'], ['R3', 'LOOK BACK']] : [['TAB', 'PHONE'], ['Q', 'WHEEL'], ['M', 'MAP'], ['B', 'LOOK BACK']];
    const temple = pad ? [['X', 'DANCE'], ['Y', 'PHONE · LIGHTS']] : [['F', 'DANCE'], ['L', 'LIGHTS'], ['TAB', 'PHONE']];
    hud.keys(ctxt === 'temple' ? temple : base, 6500); };
  app.keyHints = keyHints;
  const startGame = () => { if (!app.title) return; if (!CR.getLocalBase() && !Q.get('base') && !Q.has('nobase')) (CREW.basePending || Promise.resolve(null)).then(b => { if (!b) setTimeout(() => hud.chooseBase((k) => setBase(k)), 400); }); setTimeout(showHints, 1800); setTimeout(() => keyHints(), localStorage.getItem('rw.hints') ? 2500 : 9500); setTimeout(posterText, 9000); const ti = document.getElementById('title'); ti.classList.add('gone'); app.title = false; camSnap = true; hud.hud.classList.remove('titlehide'); removeEventListener('keydown', anyKey); setTimeout(() => hud.note({ kicker: 'RECKLESS', title: 'TONIGHT AT THE TEMPLE', body: 'Doors open at 8 Carlisle Circus. Follow the red line, or ' + (isTouch ? 'open MAP on the phone' : 'press M') + ' to pick a venue.', hold: 7 }), 1200); if (!Q.has('mute')) { AU.unlock(); sndLbl(); } };
  const anyKey = (e) => { if (app.title) startGame(); }; addEventListener('keydown', anyKey);
  document.getElementById('play').onclick = startGame; document.getElementById('title').addEventListener('pointerdown', (e) => { if (document.getElementById('title').classList.contains('ready')) startGame(); });
  if (isTouch) document.getElementById('play').textContent = 'TAP TO ENTER';
  Object.assign(window.__rw, { enterClub: (id) => { const d = id === 'warehousexl' ? whDoor : venueDoors.find(q => q.v.id === id); return enterClub(id, d || { x: 0, z: 0 }); }, cur: () => T, ready: true, engine, scene, P, C, enterTemple, exitTemple, kind: engine.__kind, low: LOW,
    setMode: (m) => { setTempleMode(T, scene, m); hud.interior(true, m); }, openMap: () => hud.openMap(mapCtx()), close: () => hud.close(), hud, player,
    teleport: (x, z, yaw) => { P.x = x; P.z = z; if (yaw != null) { P.heading = yaw; C.yaw = yaw; } C.curDist = C.dist; slowT = 0; },
    gotoStreet: (name, k = 0.5, side = 1) => { const rs = city.roads.filter(r => r.nm === name && r.d); if (!rs.length) return 'none'; const r = rs[Math.floor(rs.length * k) % rs.length]; const i = Math.floor(r.pts.length / 2) - (r.pts.length > 1 && r.pts.length % 2 === 0 ? 1 : 0); const a = r.pts[Math.max(0, i)], b = r.pts[Math.min(r.pts.length - 1, i + 1)]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L; const off = r.w / 2 + 1.2; P.x = (a[0] + b[0]) / 2 - uz * off * side; P.z = (a[1] + b[1]) / 2 + ux * off * side; P.heading = Math.atan2(ux, uz); C.yaw = P.heading; C.curDist = C.dist; slowT = 0; return [P.x, P.z]; },
    stats: () => { const inst = window.__rw.inst; return { drawCalls: inst ? inst.drawCallsCounter.current : -1, activeMeshes: scene.getActiveMeshes().length, activeIndices: scene.getActiveIndices(), totalVertices: scene.getTotalVertices(), meshes: scene.meshes.length, frameMs: inst ? inst.frameTimeCounter.lastSecAverage : -1 }; }, fps: () => engine.getFps(), ext, T, traffic, posters, whDoor });
}
// title screen
start().catch(e => { console.error(e); const l = document.getElementById('loading'); if (l) l.textContent = 'ERROR: ' + e.message; DG.fatal('could not start', e); });
