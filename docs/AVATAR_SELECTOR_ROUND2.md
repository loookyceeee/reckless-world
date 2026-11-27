# Avatar selector quality, round 2 (not live)

23–27 Nov 2026, Europe/London. Branch `avatar-quality-pass`. Nothing deployed.

## What Luke asked for

The original crew avatar, from when there was only the male base, rendered extremely clean. That is the minimum bar for the **/crew selector** (site + app), for both bases. In-game 3D may be harder. Keep v5 proportions, faces, starter outfit (Skate Tee + Barrel Jeans). Do not change the wardrobe grid or its thumbnails. Fix the jagged tee hem. Hold the release until he approves before/after.

## Cause

The /crew selector on recklessraves.co.uk/crew and in the app is **not** the game’s Babylon mesh. It is a 2D composite of 540×720 PNG layers (`lower-jeans` then `upper-tee`) from `GET /avatar/manifest.json` (live version `f97d7a11274f`, 540×720). The stage is `height: clamp(360px, 62svh, 600px)` (phone `clamp(300px, 50vh, 440px)`), `.fig` at 94% height and aspect 540/720. On a retina desktop or a 3× iPhone that 540 source is stretched ~1.5–1.6×, which is the main “soft / blurry” look.

The **old male-only selector** that looks extremely clean is the studio 3D dressed turnaround (`/home/box/shared/reckless-crew/avatar-refs/avatar_turnaround_ref.png`, “OLD 3D DRESSED REF”) and the grey sculpt sheet (`avatar_male_base_body_ref.png`). A high-res reconstruction of that era is `/workspace/rr-male-v4/male_dressed_front_v4_2x.png` (1080×1440). Canonical shipped looks (`avatar-refs/canonical-looks/tee-jeans.png`) are the same art at 540×720. Female did not exist then.

Live layers hash-match `/workspace/rr-male-v5/layers` (and `rr-ios-src`). v5 rebuilt the body to the current silhouette and warped garments onto it at 540 px, which lost studio sharpness and left a slightly stepped collar and a few soft clothing edges. An earlier 2× Real-ESRGAN pass of those unfixed layers made the neck worse (hallucinated jags), so it was not used as-is.

The **in-game Babylon avatar** is a separate, harder pipeline. It was never as clean as the studio selector. Diff of the last male-only game setup (`d4e6dbf`, 18 Nov 2026, before `ba69d37` added the female base) vs live `761e5df` vs this branch:

| | old male-only `d4e6dbf` | live `761e5df` | this branch |
|---|---|---|---|
| body map | 1024, 42 KB | 1024, 54 KB | 2048, 159 KB (1024 copy for phones) |
| skate tee / jeans | 512 | 512 | 2048 (1024 copy for phones) |
| hair | 256, 11 KB | 1024, 156 KB | 2048, 350 KB |
| eyes | 128 | 128 | 256 |
| COLOR_0 cover mask | no | yes (`e978723`) | yes, unchanged |
| despike | no | male lowers (`78808a4`) | kept |
| TEE shells | early boxy tee | later fitted + holes | TEE2 + hole-fill; hem now flattened to constant Y and XY-smoothed on G_tee and G_teeD, both bases |
| materials | unlit-ish emissive fill ~0.32, key+rim | + fill light, female warmer, fresnel | less emissive, warmer skin, hair bump, setExposure, anisotropy 16 (4 in LITE) |
| AA / DPR | game defaults | later FXAA / caps | desktop MSAA 4, phone DPR cap 2 |

The leftover jagged/scalloped hem was not a 6–8 mm height wobble; the hem ring was already almost planar (Y span ~6 mm). The visible scallop is a high-frequency XY zigzag on that ring, plus (on the selector) the 540 px layer edge. This round flattens the 3D hem to a single Y and smooths the ring, on every tee shell (G_tee and G_teeD) for male and female.

## What APP DEV and RR WEBSITE OPTIMISER should change (after Luke approves)

Do not ship until he signs off the REVIEW2 set. Do not touch the wardrobe grid or `icon-*.png` thumbnails.

- Point the /crew and app 3D/portrait loader at the remastered **1080×1440** layers in `avatar-quality-pass/selector-2x/{male,female}/` (same filenames as today). Update the manifest `size` to 1080×1440 and serve a `srcset` / 2× URL so retina and iPhones get the 2× asset. 540 can stay as the 1× fallback.
- Keep compositing order: lower first, then upper.
- Do not swap the portrait for the in-game Babylon mesh. That mesh is still below the old studio bar; the selector should stay the 2D studio-style composite, just sharper.
- No change to Close Game, tokens, XP, or `crew_config.json`.

## Neck blotch and edge remaster (27 Nov 2026, after first REVIEW2 was rejected)

The first REVIEW2 set was not done. NEW was a hybrid upscale of the same 540 art, so it still showed Luke’s grey, notched patch on the male right neck above the collar, and at desktop size NEW looked almost identical to CURRENT LIVE. Arm/hand/garment silhouettes were jaggy with a light fringe. The OLD column used a bbox-relative crop that made the v4 neck look cleaner than a same-anatomy crop.

### How OLD was produced

- Studio 3D dressed turnaround (`avatar_turnaround_ref.png`) is the true clean-neck bar.
- The historical 2× selector file `rr-male-v4/male_dressed_front_v4_2x.png` (1080×1440) was made by `dressed_front.py`: premultiplied `over()` of the v4 540 `lower-jeans` + `upper-tee`, then a Lanczos resize of that single composite to 1080×1440. Transparent RGB was not strictly held at 0,0,0.
- The v4 540 body already has the same right-neck coverage hole; Lanczos only softens it. Same-XY crops of v4_2x still show the notch. Female did not exist.

### Cause of the neck gap

It is not the game COLOR_0 cover mask, and it is not a missing “body under tee” composite (layers are already base+garment). It is a silhouette hole in the 2D body art, present on `upper-body` and every `upper-*` layer in both v4 and v5 540 sources. The male right-neck edge plateaus at x≈297 for y≈163–181 (540 space) and that bite is filled with cool/blue-grey pixels. The left neck is smooth. Female has no equivalent blue notch (right edge is earrings/hair, then a clean jump to the neck).

A first “copy repaired skin onto the tee” pass skipped the blotch: those pixels have B>R, so they failed the skin-like test and stayed on every upper garment layer.

### Fix (still not live)

`tools/remaster_v3.py`:

1. Fit a spline to the healthy male right-neck silhouette, excluding y=161–183. Extend coverage, Telea-inpaint the blotch, 1 px AA. Dark garment (collar) is protected.
2. Copy the repaired neck onto every male `upper-*`, overwriting any non-garment pixel (empty, skin, and the bluish blotch). Hoodie/zip fabric was checked and was not painted over.
3. Premultiply RGB by alpha, Lanczos up to 4× (2160×2880), area-downsample to 1080×1440, un-premultiply. Transparent RGB stays 0,0,0 — no white/grey fringe. Every v5 layer, both sexes.
4. Keep the 3D tee-hem flatten from `c2b31f5` (unchanged).

Output: `/workspace/reckless-world/avatar-quality-pass/selector-2x/{male,female}/` (same filenames, 1080×1440). Do not point APP DEV at these until Luke approves REVIEW2.

### REVIEW2 (remade)

`/workspace/reckless-world/avatar-quality-pass/REVIEW2/` — same 540-space crop on every column, integer nearest scale so aliasing stays visible:

- `male_desktop.jpg`, `male_phone.jpg` — OLD | LIVE | NEW in /crew framing
- `female_desktop.jpg`, `female_phone.jpg` — LIVE | NEW
- `male_neck_closeup.jpg`, `male_handL_closeup.jpg`, `male_hands_closeup.jpg`, `male_hem_closeup.jpg`
- `female_neck_closeup.jpg`, `female_hands_closeup.jpg`, `female_hem_closeup.jpg`, `hem_closeup.jpg`

### Verdict

NEW male neck is visibly cleaner than both CURRENT LIVE and the v4_2x OLD file: the grey notch is gone, collar junction is clean. A very small dark contact-shadow remains at the far-right neck/collar meeting point; it is not the grey square. Hand, arm and garment alpha edges are antialiased and at least as clean as OLD, with no light fringe. Female has no notch; her edges are cleaner than LIVE. v5 proportions, faces and starter outfit are unchanged. Nothing is live.
