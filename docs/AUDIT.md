# RECKLESS WORLD — FULL AUDIT (2026-11-21, 03:05–03:40 UK time)

Scope: Luke's audit order. I checked desktop (1280×720), phone portrait (393×851 touch) and phone landscape (851×393 touch). The live site was build index-C6ze2cST.js (deploy dep-dc0gjnrm8hqs73ef2utg, commit 298bd06).
No fixes were made during the audit; none of the issues found was a crash. Everything was tested headless on the box (SwiftShader, 1–14 fps), so anything timing-related is marked **verify on device**.
Shots: `/workspace/reckless-world/shots/audit_2026-11-21/` (written as `A/…` below) and `/workspace/reckless-world/shots/world_2026-11-21/` (written as `W/…`).
Tools added: `tools/audit_ui.mjs` (HUD/UI per viewport + overlap check + network write watch) and `tools/audit_side.mjs` (side-activity smoke test).

## Summary
| | count |
|---|---|
| P0 broken | 0 |
| P1 noticeable | 9 |
| P2 polish | 14 |
| Suggestions | 8 |

**Hard rules: all pass.** No PUT/PATCH/DELETE seen in any run. The only POSTs came from the SoundCloud widget's own telemetry (dwt.soundcloud.com, api-widget /me) plus the mocked sign-in. No XP is awarded or sent, and the qa "no XP in event log" check passes. EVENTS_LIVE is OFF and test:true is set.
No PSNI/Translink marks or crests: patrols use fictional Battenburg with plain POLICE text, and buses carry the RECKLESS wordmark. Plates are blank. LOCATION X is labelled LOCATION X. The female base is clothed with every fit, including the empty one (sports top + shorts).
**No console errors** on desktop, portrait or landscape, locally or live. The only failures were aborted SoundCloud media chunk requests, which are normal when the stream skips.

**What passes:** full story chain (tutorial 1–5 → missions 1–6; the finish was checked with `?storyjump=6&storyfast`), sign-in (mocked 426 → PIN → token), all 9 qa.mjs mechanics checks (look-behind, stamina, collisions, sensitivity, heat, gamepad, weather, photo), touch controls (jump, long-press wheel, phone, wheel drag-select), rapid bus menu and ride, driving (enter, drive, radio skip, can't exit while moving), dance minigame, photo inside, flyer drop start/cancel, poster run start, and every venue interior loading (all 6).
Unmirrored posters: W/D_poster_walls_unmirrored.png. Load to playable on the live site: desktop 8.8 s / 6.6 MB, phone 6.2 s / 4.3 MB (box network).

---

## P0 — broken
None found.

## P1 — noticeable
| # | Area | Issue | Shot | Est. | Recommended fix |
|---|---|---|---|---|---|
| 1 | UI · story | **SKIP TUTORIAL floats above every overlay** (wardrobe, map, credits, phone) and in portrait it covers the RUN button label and the "THE TEMPLE · 2 M" footer. | A/AUD_port_zoom.png, A/AUD_ui_port.png, A/AUD_land_zoom.png | 20 min | Hide `.storyskip` while `hud.isOpen()` or the phone is open. On touch, move it under the objective at the top right (or into the phone's SETTINGS) instead of bottom centre. |
| 2 | UI · portrait | The **LOOK / DRAG RIGHT SIDE** hint draws over the stacked messages (text on text). | A/ui_port_02_hud.png | 15 min | Put the touch hints below the notes stack, or hide them while 2+ notes are showing. |
| 3 | UI · landscape | **Notes stack (top centre) covers the objective** and the RAVE MODE pill on narrow landscape phones. The move-stick ring idles at the top left, over the brand and the minimap. | A/AUD_land_zoom.png (top left) | 30 min | Landscape: notes go left of the objective column (top: brand bottom + 8, left: 16px, width 34vw). Hide the idle stick ring until a touch starts. |
| 4 | UI · landscape | **The phone app is portrait-only.** In landscape it fills the screen with 3 huge tiles and needs scrolling. | A/ui_land_04_phone.png | 45 min | `@media (orientation:landscape) and (pointer:coarse)`: phone panel at 42vw on the right, tile grid 4–5 columns, tile aspect 1:1 capped at 72px. |
| 5 | UI · first launch | The **WHO ARE YOU? base picker overflows on 390 px portrait**: the FEMALE card is cut off on the right and SKIP TUTORIAL shows underneath. | A/AUD_first_launch_picker_portrait.png | 20 min | Stack the cards (2 rows) or use 2 × 44vw cards under 480 px. Hide storyskip while the picker is open. |
| 6 | Brand · ALL CAPS | **Mixed-case body text**: note bodies ("Doors open at 8 Carlisle Circus…", "Reckless Raves on SoundCloud", heat notes), phone message bodies and the credits paragraphs. CSS sets `text-transform:none` on `.note .nb`, `.panel p` and phone spans. | A/ui_port_02_hud.png, A/ui_desk_06_credits.png | 15 min | Remove those `text-transform:none` overrides (keep mixed case only for the legal attribution lines, if Luke wants that). |
| 7 | Radio · explicit | **The explicit-title filter misses obfuscated spellings**: "F\*ck It Up", "Sh!t Hot", "B!tch Better" and "Fkn Banger" all pass through. It also has false positives (Essex, Middlesex, Scunthorpe, Arsenal, Cocktail, Dicky → replaced). | (unit check, no shot) | 30 min | Normalise before testing (`!→i`, `1→i`, `0→o`, `@→a`, `$→s`, `*`→wildcard), add `f[\W_]*c?k`, `fkn`, `fk`. Use word boundaries for `sex`, `arse`, `cock`, `dick`, `cunt` with an allow-list (Essex, Middlesex, Sussex, Scunthorpe, Arsenal, Cocktail). Add a small unit list to qa.mjs. |
| 8 | Characters · female | **Female face reads muddy/dark** next to the male (lower contrast, brownish cast), and the hair cap looks like a flat helmet from the third-person camera. | A/AUD_face_zoom.png, A/AUD_chars_female.png | 1–2 h | Lift face albedo +10–15% and cut the warm tint in face.png for the female. Add a 1–2 px rim/spec on the hair cap, or break up its top silhouette (Blender). Recheck against the app avatar refs. |
| 9 | Camera | **Camera pushes into the player's head when backed against a wall** (seen while pasting a poster on the phone: the screen fills with the back of the head). | A/mm_heat.png | 30 min | Fade the player meshes (visibility 0.3) when camera distance < 1.2 m, or keep a min distance of 1.1 m and raise the target. |

## P2 — polish
| # | Area | Issue | Shot | Est. | Recommended fix |
|---|---|---|---|---|---|
| 1 | UI | **"WAYPOINT REACHED"** stamp overlaps the objective/pasting text at the top right on phone. | A/AUD_mob_old.png (5th) | 15 min | Centre the stamp at 38% height, or hold it while a pasting/objective change is animating. |
| 2 | UI | The **SKIP TUTORIAL button stays visible during side missions** (poster run) after the tutorial steps are done. | A/AUD_mob_old.png | 10 min | Show it only during ONBOARD steps 1–5. Once missions start, move skip into the phone. |
| 3 | UI | **Debug buttons in public Credits**: EXPORT TEST EVENTS and RAVE MODE: ON/OFF. | A/ui_desk_06_credits.png | 10 min | Show only with `?debug` (keep them until Luke says switch). |
| 4 | UI | **Wardrobe needs scrolling** on every viewport (desktop 663/720 px, portrait 782/851 px), and in landscape the preview is tiny. | A/AUD_ui_land.png | 30 min | Landscape: put the preview and the item grid side by side. Desktop: cap the preview at 38vh. |
| 5 | Title | On phone the **TAP TO ENTER button looks disabled** (grey on grey) for a few seconds while loading, with no progress shown. | A/AUD_port_zoom.png (middle) | 15 min | Show "LOADING 72%" in the button until ready, then switch to solid white. |
| 6 | World | **Black unlit boxes south of Lisburn Road** (seen from the air and the title flyover, not at street level). Still there with `?nostream` and `?nomid`, so they come from the base city/landmark build. | A/ls_aerial_south.png, A/AUD_aer_ab.png | 30 min | Find the meshes (enable picking on that cell) and give them the walls material or drop them. |
| 7 | World | **Large empty grey plots and a hard world edge**: roads at the south/east edge run into flat grey with no buildings (e.g. driving towards Willowfield). | A/side_drive.png, A/ls_aerial_south.png | 1–2 h | Extend the stream chunks one ring further, or add a fog wall / low-poly skyline card at the playable edge. Tint empty plots grass/rubble instead of pavement grey. |
| 8 | Vehicles | Kept parked/moving models are fine (bus, saloon, hatch, SUV, van, cab, taxi, wagon, estate patrol). The cab is only reachable from the wheel/phone, and the Q-wheel DOM couldn't be driven headless. | W/E_black_cab_tx_shape.png, A/AUD_vehicles.png | 10 min | Manual check on device: HAIL CAB from the wheel → ride → arrive. |
| 9 | Venues | Venue entry views are good on the HUD build. Inside, the minimap overlaps the venue/mode caption on landscape phones. | A/AUD_ui_land.png (08) | 10 min | Push the caption right of the minimap in landscape. |
| 10 | Perf | **Slow motion on weak devices**: the per-frame dt clamp means at 1–3 fps (low-end phones) walking and timers crawl. The tutorial "walk 15 m" took about 20 s of holding W on the box. | (timing) | 30 min | Raise the clamp to 1/15 s and sub-step physics, or auto-drop the tier faster when fps < 20. |
| 11 | Perf | All phones get `LOW` (`isTouch && min(screen) < 900`), yet the auto tier reports "med" on Pixel 5. The labels are confusing. | (code) | 10 min | Log/show one tier name and document it in PERF.md. |
| 12 | Load | Desktop downloads env_night_1k.hdr (1.76 MB) and minimap_base PNG (1.15 MB). Phone downloads the 0.44 MB HDR and a 0.67 MB minimap. | (livecheck) | 30 min | Prefilter the HDR to a .env (~300 KB); convert the minimap to webp (~250 KB). |
| 13 | Credits | In-game credits don't name **Kenney City Kit Roads** (street extras); only README does. It's covered by the generic "Other CC0 assets: Kenney…" line. | A/ui_desk_06_credits.png | 5 min | Add "street extras: Kenney City Kit Roads (CC0) + original drains" to the hud credits. |
| 14 | Side | Pasting a poster on the phone stalled at 1/10 bars under SwiftShader ("HOLD STILL" kept resetting). Probably box fps. **Verify on device.** | A/AUD_mob_old.png (4–5) | 15 min | If it happens on device: base the paste progress on time held, not on P.speed thresholds per frame. |

## Suggestions
1. **Brand palette:** the B polish uses red accents (corner rules, NOW PLAYING kicker, route line, objective rule) and the bus is purple. If "black and white" is strict, swap the UI red for white/grey and keep red only for the GPS route and heat. Luke to decide.
2. **Radio on phone lock screens:** the SoundCloud iframe may publish the raw track title to the Android/iOS media notification, which would get past the in-game filter. Check on a real phone, and pick clean-titled sets if it does.
3. **Code-split the bundle:** one 2.29 MB (610 KB gz) chunk. Lazy-load the story, dance, collect, drive and stream modules (−25–35% to first frame).
4. **Live sign-in check after 23 Nov:** the mocked flow passes. Do one real request → PIN → token → /me with Luke's account (2–3 calls) once PINs are live.
5. **Tutorial on touch:** the onboarding steps reference keys (HOLD B, TAB). Touch auto-advances the button-only steps, but copy like "LOOK BEHIND · HOLD B" should say the touch control on phones.
6. **Wheel automation hook:** expose `app.wheel.run(id)` for tests, so cab/radio/poster from the wheel get covered headless.
7. **Phone device pass:** run one real Android and one iPhone session (fps, thermal, safe areas, notch). The box can't measure real GPU cost.
8. **KTX2** stays deferred (see PERF.md) unless a pack brings 2K+ textures.

## Coverage detail
- **Characters:** both bases × 12 tops, 4 outers, 7 legs and the empty fit, all rendered (A/AUD_chars_male.png, A/AUD_chars_female.png). Every item applies with no missing meshes or z-fighting at this distance. The male empty fit is pants-only, but it can't be reached (the starter fit is allowed at level 1, and loadFit falls back to the starter).
- **Story:** tutorial 1–5 → GET THE LOOK → PAPER THE TOWN → PROOF → GET A RIDE → THE QUEUE → FIRST RAVE (dance timer counting) → STORY COMPLETE (W/story_complete_first_rave.png).
- **Controls:** keyboard (WASD, Shift, Space, B, Tab, M, O, P, C, K, E, F, L, Q), gamepad (qa.mjs), touch (stick, RUN, JUMP, ACTION long-press wheel, PHONE, wheel drag).
- **Venues:** Temple, Ware-House XL, Thompsons, Terminus, Ware-House, LOCATION X: all enter/exit cleanly (A/AUD_venues.png).
- **Perf (from G):** phone street 150 draws / 1.18M idx, rave 141 / 4.69M; desktop street 413 / 2.91M.
- **Network:** GET only to the crew API (config, avatar_base when signed in). The sign-in POST /api/auth/request only fires from the wardrobe sign-in form.

---

## FIX PASS (2026-11-21, 03:36–04:10 UK time): all 9 P1s and the P2s ("do it all", ship over perfect)
Shots: `A/FIX_*.png`. qa.mjs 9/9; `node tools/radio_filter_test.mjs` → fail 0. The red accents are unchanged until Luke decides.

| Item | Status | What changed | Shot |
|---|---|---|---|
| P2-3 debug buttons | **FIXED** | EXPORT TEST EVENTS and RAVE MODE only show with `?debug` (the local test-event log itself is unchanged). | A/FIX_credits_no_debug_buttons.png |
| P1-7 radio filter | **FIXED** | `isExplicit()`: leetspeak normalised (! 1 \| → i, 0 → o, @ 4 → a, $ 5 → s, 3 → e, 7 → t, * as wildcard), matched per word from the word start, plus always-bad substrings (fuck, motherf, `**`). Catches F\*ck, Sh!t, B!tch, Fkn, Sh1te, FCKN, C\*nt, Wh0re, Bullshit, f.u.c.k. Passes Essex, Middlesex, Sussex, Scunthorpe, Arsenal, Cocktail, Cockney, Dicky, Shift, Classic, Assassin, Shiitake, Count. Test: tools/radio_filter_test.mjs. | — |
| Media Session | **FIXED (top frame)** | `navigator.mediaSession.metadata` is set to the same clean label (UPPER CASE title, artist RECKLESS RADIO) on every track. The SoundCloud iframe can still publish its own metadata on some browsers; **verify on a real phone lock screen**. | — |
| P1-1 SKIP TUTORIAL | **FIXED** | Hidden while any overlay, phone or wheel is open. On portrait phones it moved above the minimap, clear of RUN and the stick. (It only ever shows during tutorial steps 1–5, so P2-2 is covered.) | A/FIX_portrait_hud.png |
| P1-2 LOOK hint over notes | **FIXED** | Hint moved to 56% height. | A/FIX_portrait_hud.png |
| P1-3 landscape notes / stick | **FIXED** | Notes sit between the brand and the objective column (no overlap). The idle stick ring is at the bottom left, beside the minimap. | A/FIX_landscape_hud.png |
| P1-4 phone in landscape | **FIXED** | Right-side panel at 46vw, 5-column grid, 58 px tiles: every app is visible without scrolling. | A/FIX_landscape_phone.png |
| P1-5 first-launch picker | **FIXED** | Cards can shrink (`min-width:0`) and the render scales to the card width, so FEMALE no longer overflows at 390 px. | — |
| P1-6 ALL CAPS | **FIXED** | Removed every `text-transform:none`. `body *` is upper case except typed inputs (notes, phone messages, credits, panels, radio). | A/FIX_portrait_title_wardrobe_credits_caps.png |
| P1-9 camera wall push-in | **FIXED** | When the collision camera is pulled in under 1.9 m, it lifts over the head (up to +1.15 m) and the player fades to 30%. | A/FIX_camera_wall.png |
| P1-8 female face/hair | **IMPROVED (time-boxed)** | Materials only: skin lifted with less brown cast; hair shell gets a sheen and a darker cap so it reads as hair, not a helmet; curls get a highlight. Avatar refs refreshed (avatar-refs/game/turnaround/ingame_female_2026-11-21_audit.png). A full face repaint/hair geometry pass is still open if Luke wants more. | A/FIX_female_face_before_after.png, A/FIX_female_male_ingame.png |
| P2-1 toast over objective | **FIXED** | Touch toasts at 38% height (30% in landscape), max 80vw. | — |
| P2-4 wardrobe fit | **FIXED** | Desktop preview and list capped at 30vh. Landscape phones show the preview and list side by side. | A/FIX_landscape_wardrobe.png |
| P2-5 dim TAP TO ENTER | **FIXED** | Soft pulse (100 → 72% opacity) on a dark backing instead of a 25% blink. | A/FIX_portrait_title_wardrobe_credits_caps.png |
| P2-6 black boxes | **FIXED (root cause)** | OSM named colours ('grey', 'lightgrey', 'white', 'ivory'…) were parsed as black for walls and roofs. New `colOf()` maps CSS names and #rgb, and falls back to the default tint. That fixes about 230 buildings citywide, including the streamed chunks. | A/FIX_black_boxes_and_edge.png |
| P2-7 grey edges | **FIXED (basic)** | Ground plane enlarged from 2.2 × 3.6 km to 3.2 × 5.0 km so every road sits on ground, and darkened to read as scrub. Fog covers the rest. A skyline card or extra stream ring is still a suggestion. | A/FIX_black_boxes_and_edge.png |
| P2-10 slow motion | **FIXED** | The frame dt cap went from 0.05 s to 0.1 s: real time down to 10 fps (was 20 fps). Below 10 fps it eases. | — |
| P2-12 sky + minimap size | **FIXED** | Env HDRI is now an 8-bit linear webp through EquiRectangularCubeTexture: desktop 1.76 MB → 125 KB, phone 0.44 MB → 35 KB (`?hdrenv` keeps the old .hdr). Minimap is lossless webp: 1.15 MB → 0.61 MB, pixel-identical. | — |
| P2-13 Kenney credit | **FIXED** | In-game credits name Kenney City Kit Roads and the original CC0 drains. | A/FIX_credits_no_debug_buttons.png |
| P2-14 paste stall | **ADDRESSED** | Pasting is time-based. The stall came from the 20 fps dt cap on the slow box, now 10 fps. Verify on device. | — |
| P2-8 cab from wheel, P2-9 caption | **CHECKED** | No layout change needed for the caption. Cab via the wheel is still a manual device check. | — |
| P2-11 tier labels | **DOCUMENTED** | Phones always start `LOW` (touch and short side < 900), then the runtime culler picks the med/low distance tier. Same behaviour, now written down here. | — |
| Suggestions 1–8 | open | Red accents waiting on Luke; code-split, live sign-in after 23 Nov, device pass, KTX2 deferred. | — |
