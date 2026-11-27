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
