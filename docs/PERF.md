# RECKLESS WORLD: MEMORY AND PERFORMANCE ON PHONES

## The iOS app crash (21 Nov 2026)
- **Symptom.** TestFlight build 12 (WKWebView, `?app=1`) stopped at LOADING BELFAST, about 20%, then went black. The WebContent process was killed twice, also at `?app=1&safe=1`.
- **Root cause.** The load used too much memory and iOS killed the WebView process (jetsam). It wasn't a JS error. Safe mode only switched off post-processing, so it didn't help.
  - Before the fix, the phone profile in Chromium (`tools/mem_probe.mjs`, iPhone viewport) measured:
    - about 900 MB of live JS heap after GC, peaking at about 1 GB
    - about 290 MB of GPU buffers
    - 76-90 MB of textures
  - That is about 1.3 GB in total. iOS allows a WebContent process roughly 1-1.5 GB, depending on the device.
- **Biggest consumers.** `tools/mem_sites.mjs` uses the sampling heap profiler to show which code paths hold the memory.
  1. **About 330 MB:** Babylon `refreshBoundingInfo` caches one `Vector3` per vertex (`_positions`) on every mesh. The city has about 5M vertices.
  2. **About 190 MB, plus GPU:** the city chunker expanded thin instances into raw geometry when baking.
  3. **About 190 MB:** chunk and city geometry was kept as plain JS number arrays (8 B per number, plus growth), where `Float32Array` uses 4 B.
  4. **About 130 MB:** the crowd mesh simplifier was still running, and holding its data, when the title showed.
  5. **Roof detail:** chimneys and parapets made the roofs about 670k vertices, more than all the walls.
  6. **Minimap:** the image decodes to 36 MB at 1 px/m.

## Fixes
- **All devices** (same picture, less memory):
  - no per-vertex `_positions` cache (picking regenerates it from the geometry)
  - typed arrays everywhere geometry is created (`toMesh`, `splitMesh`, city walls and roofs, stream roads)
  - the simplifier frees its data when it's done
  - the `/api/auth/me` handoff has an 8 s timeout, so it can't hold up the boot
- **Touch:** thin-instanced parts stay instanced (no expansion).
- **LITE profile.** Turned on for iOS (Safari and WKWebView), `?app=1` and `?safe=1`. `?full` opts out and `?lite` forces it. It gives:
  - the low tier (it never goes above med), rendering at CSS pixels (DPR 1). Safe mode renders at 1/1.25.
  - no post-processing, bloom, glow, SSAO or MSAA
  - textures capped at 512 px, cube maps at 256 px
  - chunk streaming radius 150 m (drop at 400 m), with the parsed chunk JSON freed when a chunk is dropped
  - no chimneys, parapets or puddles, and no crowd simplifier
  - 300 rain particles, a half-resolution minimap
  - CPU copies of the static city geometry released once it's on the GPU. After a WebGL context loss the boot guard keeps RETRY up, because that geometry can't be rebuilt.
  - The radio iframe already loads only after the first tap with sound on. Only one avatar GLB loads.
- **Boot guard** (`index.html`, runs before any module, also in app mode):
  - a 45 s load watchdog
  - a fallback on a fatal start error or a WebGL context loss: RETRY / SAFE MODE / KEEP WAITING / CLOSE GAME (close only in the app)
  - crash-loop memory: if a load on a touch device never finished, the next load within 15 minutes starts in safe mode
  - errors posted to the app as `{"type":"error",reason,detail,stage,safe,t}`, with tokens scrubbed

## Numbers
Measured in Chromium with an iPhone-sized touch viewport, live JS heap after GC, using `tools/mem_probe.mjs` and the GPU tracker `tools/gl_track.js`:

| build | JS heap (peak) | GPU buffers | textures |
|---|---|---|---|
| before (f64f46d), `?app=1` | 898 MB (978) | 290 MB | 90 MB |
| before, `?app=1&safe=1` | 875 MB (1024) | 289 MB | 76 MB |
| after, `?app=1` / safe | 192 MB (219) | 104 MB | 68 MB |
| after, Android-class touch (not LITE) | about 420 MB | 158 MB | 90 MB |

- WebKit (Playwright, iPhone 13 profile) loads `?app=1`, `?app=1&safe=1` and `?app=1#token=` to the title in about 6 s with no crash. WebKit has no heap API, so the heap figures are from Chromium.
- Desktop is not LITE and keeps its quality. The only desktop changes are memory-only (typed arrays, no `_positions` cache).

## Tools
- `node tools/mem_probe.mjs <url>`: heap and GPU over the load
- `node tools/mem_sites.mjs <url>`: retained allocation sites
- `node tools/mem_top.mjs <url>` and `node tools/mem_tex.mjs <url>`: vertices by mesh, and textures
- `python3 tools/ios_webkit.py <url> <tag> [#hash]`, `python3 tools/ios_shot.py <url> <png> [land]`, `python3 tools/ios_guard.py <base>`: WebKit iPhone load, screenshots, and the boot guard

## Cut 4: venues on demand, lighter LITE traffic and crowd
- **Venues on demand:** the Temple and club interiors are built on first entry, inside the entry fade, on every platform. Before, the Temple was built at load. `?eagervenue` restores the old behaviour.
- **Shared crowd:** the shared instanced crowd is baked on first entry too, and it now sets up its own instance buffers, so a club can be the first venue entered.
- **LITE exit:** in LITE the interior and the crowd are disposed on exit. Everything the build created is tracked: meshes, materials, textures, lights, skeletons, animation groups, nodes and particles. Desktop keeps visited venues cached. `?keepvenue` keeps them cached in LITE too.
- **LITE traffic and crowd:**
  - 12 moving cars (phones 24, desktop 58), 14 parked cars (30/90) and 6 pedestrians (10/30)
  - 3 dance poses instead of 4, at crowd model detail 0.2 instead of 0.28
- **Results:**

| build | JS heap after GC (peak) | GPU buffers | textures | total |
|---|---|---|---|---|
| live before cut 4, `?app=1` | 195 MB (205) | 106 MB | 68 MB | about 370 MB |
| cut 4, `?app=1` and `?app=1&safe=1` | 139 MB (209-240) | 73 MB | 62 MB | about 274 MB |
| cut 4, Android-class touch | 155 MB | 114 MB | 84 MB | about 353 MB |

- **Venue cycle in LITE** (`tools/venue_cycle.mjs`): outside 137 MB, Temple 172 MB, back outside 143 MB, Temple again 176 MB, back outside 144 MB, club 168 MB, back outside 148 MB. Mesh and material counts return to the outside baseline after every exit, with no errors.
