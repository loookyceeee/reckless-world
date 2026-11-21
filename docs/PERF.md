
## 2026-11-21 stage 12 profile (SwiftShader, Pixel 5 UA 393x851 @2.75 vs desktop 1280x720)
| view | phone draws / M idx (before → after) | desktop draws / M idx |
|---|---|---|
| street | 177 / 1.18 → 176 / 1.18 | 434 / 2.26 |
| temple ext | 156 / 0.89 → 149 / 0.77 | 402 / 1.68 |
| rave | 196 / 5.16 → 141 / 4.73 | 280 / 9.08 |
Cuts: vehicle source meshes (always-active, parked at y=-500) disabled indoors (-55 draws at the rave); crowd far-LOD distance per tier (low 5 m, med 6.5 m, high 13 m). Phones skip midkit and HDRI/wet entirely.
Remaining hot spot: near crowd bodies (~62k idx each). KTX2 + mesh LODs are queued under G.
