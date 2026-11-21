# WebKit iPhone: load, tap to enter, screenshot in game: python3 tools/ios_shot.py <url> <out.png> [landscape]
import sys, time
from playwright.sync_api import sync_playwright
url, out = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    b = p.webkit.launch(); dev = dict(p.devices['iPhone 13' + (' landscape' if len(sys.argv) > 3 else '')]); c = b.new_context(**dev); pg = c.new_page()
    pg.add_init_script("localStorage.setItem('rw.avatarBase','male')")
    pg.goto(url); pg.wait_for_function("()=>window.__rw&&window.__rw.ready", timeout=200000); time.sleep(2); pg.screenshot(path=out.replace('.png', '_title.png'))
    vw = pg.viewport_size; pg.touchscreen.tap(vw['width'] / 2, vw['height'] * 0.7); time.sleep(9)
    for sel in ['#rwFail']: print('fallback shown', pg.evaluate("()=>!!document.getElementById('rwFail')"))
    pg.screenshot(path=out); print(pg.evaluate("()=>({lite:window.__rwLiteFreed||0, fps:window.__rw.engine.getFps().toFixed(0), title:window.__rw.app.title})")); b.close()
