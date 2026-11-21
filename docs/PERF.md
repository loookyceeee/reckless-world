
## 2026-11-21 G profile after C–F (SwiftShader, Pixel 5 UA, med tier vs desktop high)
| view | phone draws / M idx (stage 12 → G) | desktop draws / M idx |
|---|---|---|
| street | 176 / 1.18 → 150 / 1.18 | 413 / 2.91 (streaming + extras on) |
| temple ext | 149 / 0.77 → 119 / 0.70 | 311 / 1.96 |
| rave | 141 / 4.73 → 141 / 4.69 | 186 / 9.14 |
- Car LODs (E) took about 26 draws off phone street views; streaming (C) and extras (F) sit inside the phone budgets (radius 300 m, every 2nd extra lamp and tree, extras density halved on low).
- Phones bake the crowd at avatar lod 0.26 (was 0.33), which saves about 4% of rave indices. I tried a stronger far decimation (0.2) and it was worse: decimation takes longer, so near meshes stay up longer. Reverted.
- Phones cap the GPU texture size at 1024 px and cubemaps at 512 px (engine caps), so any bigger texture from future packs gets resized on upload.
- KTX2: deferred on purpose. Every shipped texture is already 1024 px or smaller (webp/jpg; largest are the 1024² body and hair maps and 540×720 posters). KTX2 would also mean shipping the Basis transcoder wasm (about 1 MB) or loading it from Babylon's CDN at runtime. No toktx/basisu tool is on the box. Revisit if a pack adds 2K+ textures.
- Remaining hot spot: near crowd bodies inside venues (tier crowd caps 70/110/999 already apply).

## 2026-11-21 stage 12 profile (SwiftShader, Pixel 5 UA 393x851 @2.75 vs desktop 1280x720)
| view | phone draws / M idx (before → after) | desktop draws / M idx |
|---|---|---|
| street | 177 / 1.18 → 176 / 1.18 | 434 / 2.26 |
| temple ext | 156 / 0.89 → 149 / 0.77 | 402 / 1.68 |
| rave | 196 / 5.16 → 141 / 4.73 | 280 / 9.08 |
Cuts: vehicle source meshes (always-active, parked at y=-500) disabled indoors (-55 draws at the rave); crowd far-LOD distance per tier (low 5 m, med 6.5 m, high 13 m). Phones skip midkit and HDRI/wet entirely.
Remaining hot spot: near crowd bodies (~62k idx each). KTX2 + mesh LODs are queued under G.
