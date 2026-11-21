# RECKLESS WORLD: EMBED, APP AND WEBSITE LINK

Game URL: `https://reckless-world.onrender.com/`

## 1. Squarespace card (works on the BASIC plan)
Paste into a **Code Block** (set to HTML). Plain HTML and CSS only: no scripts, no iframe. Squarespace Basic runs HTML and CSS in code blocks; JavaScript and iframes need Core or higher.
The card opens the game in a new tab.

```html
<style>
.rw-card{display:block;max-width:640px;margin:0 auto;background:#000;color:#fff;border:2px solid #fff;padding:28px 26px 24px;text-decoration:none!important;text-transform:uppercase;font-family:"Unbounded","Arial Black",Arial,Helvetica,sans-serif;letter-spacing:.08em;line-height:1.25;transition:background .15s,color .15s}
.rw-card:hover,.rw-card:focus-visible{background:#fff;color:#000;outline:none}
.rw-card .rw-k{display:block;font-size:11px;font-weight:700;letter-spacing:.24em;opacity:.75;margin-bottom:10px}
.rw-card .rw-t{display:block;font-size:clamp(26px,6vw,44px);font-weight:900;letter-spacing:.04em;margin-bottom:10px}
.rw-card .rw-s{display:block;font-size:12px;font-weight:700;letter-spacing:.16em;opacity:.85;margin-bottom:20px}
.rw-card .rw-b{display:inline-block;border:2px solid currentColor;padding:12px 22px;font-size:13px;font-weight:900;letter-spacing:.22em}
.rw-card .rw-f{display:block;margin-top:16px;font-size:9px;letter-spacing:.16em;opacity:.6}
</style>
<a class="rw-card" href="https://reckless-world.onrender.com/" target="_blank" rel="noopener">
  <span class="rw-k">RECKLESS RAVES · FREE BROWSER GAME</span>
  <span class="rw-t">PLAY RECKLESS WORLD</span>
  <span class="rw-s">BELFAST AFTER DARK · PASTE THE TOWN · GET IN THE TEMPLE</span>
  <span class="rw-b">PLAY NOW ↗</span>
  <span class="rw-f">PHONE OR DESKTOP · NO DOWNLOAD · OPENS IN A NEW TAB</span>
</a>
```

## 2. Inline iframe version (needs Squarespace CORE or higher)
On Basic, Squarespace keeps the iframe code but doesn't run it, so use the card above. The game sends no X-Frame-Options or CSP frame-ancestors header, so it can be embedded on recklessraves.co.uk and in the app's WebView.
The frame is 16:9 on desktop and 4:5 on phones. The link under it is the fallback.

```html
<style>
.rw-embed{max-width:1100px;margin:0 auto;background:#000;border:2px solid #fff}
.rw-embed .rw-frame{position:relative;width:100%;aspect-ratio:16/9;background:#000}
@media (max-width:640px){.rw-embed .rw-frame{aspect-ratio:4/5}}
.rw-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}
.rw-embed .rw-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 14px;font-family:"Unbounded","Arial Black",Arial,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:11px;font-weight:800;color:#fff}
.rw-embed .rw-bar a{color:#000!important;background:#fff;padding:8px 12px;text-decoration:none!important}
</style>
<div class="rw-embed">
  <div class="rw-frame">
    <iframe src="https://reckless-world.onrender.com/" title="RECKLESS WORLD" loading="lazy"
      allow="fullscreen; autoplay; gamepad" allowfullscreen></iframe>
  </div>
  <div class="rw-bar"><span>RECKLESS WORLD · TAP TO ENTER</span><a href="https://reckless-world.onrender.com/" target="_blank" rel="noopener">OPEN FULL SCREEN ↗</a></div>
</div>
```

## 3. Inside the app (APP DEV contract)
- URL: `https://reckless-world.onrender.com/?app=1#token=<bearer>`. The token goes only in the fragment, so it is never sent in a request or `Referer`.
- Token handling:
  - A boot script in `index.html` reads `#token=` and strips it with `history.replaceState` before any game code runs. It is never logged.
  - The game verifies it with `GET /api/auth/me` (`Authorization: Bearer`).
    - **200:** stored exactly like the normal email + PIN sign-in (`localStorage rw.crewAccount`, 30 days).
    - **426 UPDATE_APP:** not stored. The game falls back to the email + PIN sign-in (toast "APP UPDATE NEEDED · SIGN IN WITH EMAIL + APP PIN").
    - **401/403:** not stored. Same fallback (toast "APP SIGN-IN EXPIRED · SIGN IN WITH EMAIL + APP PIN").
    - **Network error:** one retry after 8 s.
  - **No fragment:** after TAP TO ENTER the wardrobe opens on the email + PIN sign-in.
  - Accepted token characters: `A-Z a-z 0-9 . _ ~ + / = -`, 8 to 4096 long.
- `?app=1` layout:
  - Hidden: web-only chrome (safe-mode link, fullscreen button, TICKETS link, phone external links, panel external links). There are no install prompts.
  - Edge to edge (`viewport-fit=cover`, `env(safe-area-inset-*)`).
  - The top-left ~56px is kept clear for the native close [X]: the brand starts at 56px + safe inset, and the phone header is padded.
  - In-game close: PHONE > SETTINGS > CLOSE GAME, shown only when `window.ReactNativeWebView` exists. It calls `window.ReactNativeWebView.postMessage('{"type":"close"}')`.
- Audio: TAP TO ENTER stays as the iOS audio unlock. WebView needs JavaScript and DOM storage on, and inline media playback allowed.
- The game stays read-only: GET only, no XP, EVENTS_LIVE off.

## 4. Behaviour inside any iframe
- **Audio:** stays behind the TAP TO ENTER / PRESS START gesture (browser autoplay rules). `allow="autoplay"` only lets the SoundCloud radio start without a second tap.
- **Full screen:** a FULL SCREEN button shows top left on the title screen and under the logo in game. It calls `requestFullscreen()` (needs `allow="fullscreen"`). If fullscreen is blocked or missing (an iframe without the permission, or iPhone Safari), it opens the game in a new tab. Hidden with `?app=1`.
- **Mouse look:** works by click-and-drag with pointer capture, so it works in iframes without pointer lock. The game doesn't use pointer lock, so no `pointer-lock` permission is needed.
- **Touch:** the canvas uses `touch-action:none`, so the stick, look-drag and buttons don't scroll the host page.
- **Keyboard:** works once the frame has focus (the first click or tap). The mouse wheel zooms the camera without scrolling the page.
- **Gamepad:** needs `allow="gamepad"` in Chromium.

Test page: `tools/embed_test/index.html` (card + iframe). Run: `node tools/embed_test.mjs` (portrait and landscape shots, token handoff, `?app=1`, touch and drag inside the frame).
