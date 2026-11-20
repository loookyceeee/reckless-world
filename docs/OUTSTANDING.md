# Reckless World: outstanding work vs Luke's asks
Checked against the live build (22bdbb4) and the tree on 20 Nov 2026. Legend: **[x] done**, **[~] partial / below the quality bar**, **[ ] todo**.
House rules: zero spend · the game never awards XP and never PUTs · `test:true` stays on · no PSNI/Translink marks, crests or real plates · the female avatar is always clothed.

## World
- [~] GTA-style open world of real Belfast in the avatar style: OSM slice with LiDAR/OSM heights, clay shading. The slice isn't the full city: no chunk streaming, roofs/facades are basic, and street lights/trees from DfI/BCC data aren't placed.
- [~] All six venues walkable with interiors and frontages: Temple, Ware-House XL, Thompsons, Terminus, Ware-House and Location X all have walk-in raves (clubs.js/temple.js) and frontages. Ware-House XL's door isn't exposed in venueDoors; the frontages need a sheet-quality pass.
- [~] Real Reckless event posters, not mirrored: event posters come from events.js, and no UV mirroring is left on poster materials. Each wall still needs a visual check in-game.
- [ ] Temple interior from photos: waiting on Luke's photos.
- [x] OSM and LiDAR attribution: CREDITS screen (hud.js) plus the phone map footer.

## Player and avatars
- [x] Changeable clothing: phone WARDROBE with the shared wardrobe for both bases, plus the MALE/FEMALE pick.
- [x] Running: sprint with stamina, jog and walk.
- [~] Male avatar matches the sheet: silhouette overlap 0.85–0.90 (target 0.92+). AO, warm skin and rig are done. The face texture has projection blotches and the fade edge by the ear is jagged.
- [~] Female avatar matches the sheet: overlap 0.79–0.84. The TEE2 tee re-model (remesh + shrinkwrap) FAILED its six-view gate on 2026-11-20 (holes, detached sleeves), so the old tee is kept (build with TEE2=0). Hair is still flat and her base briefs are smaller than v5's bike shorts. She is always clothed (black base layer).
- [x] avatar_base read-only from APP DEV's endpoint (null = local pick / picker); never PUTs.
- [x] v5 crew art (APP DEV, Luke-approved): 2D portraits/wardrobe/phone/picker composite the v5 layers from the live manifest (bundled fallback in public/crew/v5); 3D garment textures re-baked from v5 garment layers per gender; mapping + gaps in docs/V5_MAPPING.md. Remaining shape gaps: zips have no placket geometry, Stan hoodie hood-down shares the long-sleeve mesh, artillery has no cargo pockets, mesh jersey uses the tee mesh, male 3D body texture still has the old tee painted on the torso (v5 base is shirtless).
- [ ] Quality-bar pipeline (normal/roughness maps, fabric normals, hair anisotropy, painted face) per research/quality_pipeline.md.

## Vehicles and traffic
- [x] Glider fast travel (glider.js, stops on the minimap).
- [~] Buses (bus fix 2026-11-20b: lit glazing with purple seats + poles, glazed doors with green/blue buttons, big italic RECKLESS + slashes both cars, visible tyres in arches with purple hub covers + flares, BELFAST board and front R now visible, raised roof pods with fan vents + grilles, full-height silver bellows): the purple RECKLESS bendy bus from asset-refs (black glass band, white swoosh, RECKLESS wordmark, BELFAST destination, R logo, purple wheel spats, grey concertina, blank plates). In the tree, not yet gated or live.
- [~] Realistically proportioned cars with proper wheels: procedural cars with wheel2 tyres and rims. Some kinds still look toy-like; LODs are basic.
- [~] Armoured patrol wagons (wagon_ref + asset-refs): yellow/blue Battenburg, POLICE text, no crest or plates; caged grille, roof AC grilles, now white steel wheels, hanging mesh skirts and caged lamp pods (40656ab+1). Now also caged blue roof beacons, windscreen/side window grilles, a bull-bar cage and matte paint. TODO: LOD.
- [~] Street kit from asset-refs: DONE (b-streetkit): sheet-style Reckless shelter at every fast-travel stop (dark frame, lit RECKLESS fascia + light strip, glass, red bench, lit R/crowd ad panel, purple R stop flag, R bin, bollards; one shared atlas), plus ~1,050 baked R bins, red benches, utility boxes, planters, bike racks and cones beside lamps on the pavement (per-cell baked, no extra draw calls). Existing trees/lamps/bollards/railings kept. TODO: drains, barriers, signs, LODs.

## HUD, map and UI
- [x] Interactive HUD map: rotating GTA-style minimap (rotates with the camera, speed zoom, N marker, player arrow), A* GPS route line on minimap and pause map, tap-to-drop waypoint + venue pick, destination diamond clamped to the radar rim when off-map, and now world-space GPS: pulsing red chevrons along the next ~90 m of route plus a light beam + ring at the destination (src/gps3d.js).
- [x] Minimap marks every Reckless venue (pins T/W/G/U/H/X).
- [~] Unreal-style UI: styled HUD and phone. Needs a polish pass (motion, typography, consistent panels).
- [~] GTA, Saints Row and Red Dead-style mechanics: heat/patrol evade, poster run (Rob Run upgrades), collectibles, photo hunt, dance minigame, driving, black-cab hailing, AI traffic reacting to the player's car.

## Activities
- [x] Rob Run ideas applied to the poster run (2026-11-20): collect a roll, paste meter (hold still 1.6–2.6 s, moving gives a half poster), witnesses on a look cycle, hide spots (bus stops, venue doors) speed up cool-off, bank the run at the nearest drop, nightly notoriety. NO XP in the demo.
- [x] SoundCloud radio with clean labels (explicit titles become "artist · RECKLESS RADIO").

## Stages
- [x] Stage 9: driving (src/drive.js) + black cabs (src/cab.js, free, kerbside pickup, cinematic ride + drop). AI traffic looks further ahead for the player's car, brakes, honks when blocked, pulls over when you honk; peds hurry clear. Gamepad RT/LT/A, touch JUMP = handbrake, H horn, K next track, car-radio volume, synth engine.
- [ ] Stage 10: rain/weather, NPC reactions (peds flinch or cheer, react to dancing and sprinting), radio in cars, photo mode upgrade (filters, poses, hide HUD). A photo frame/hunt exists, so this is partial.
- [ ] Stage 11: mechanics QA (look-behind, gamepad, sensitivity, collisions, stamina, heat edge cases), with a written test list.
- [~] Stage 12: polish plus perf tiers. Perf tiers exist (perf.js low/med/high). No KTX2, LODs are partial, and mobile profiling isn't done.

- [~] Temple pass from temple_brief.md (2026-11-20): LiDAR-sized brick exterior (eaves 13.1 m, ridge 23.2 m, #9a4a32, gabled), near-black timber roof, grey-blue flags, two cream fire exits in the south aisle. Stage stays at the east end with the red lancet uplight in rave mode only; the bar stays in the south aisle by the entrance (not in front of the east window). Not yet shot.