# WebKit (Playwright) iPhone repro of the app WebView: python3 tools/ios_webkit.py <base> <tag> [hash]
import sys, json, time
from playwright.sync_api import sync_playwright
base, tag = sys.argv[1], sys.argv[2]; hsh = sys.argv[3] if len(sys.argv) > 3 else ''
with sync_playwright() as p:
    b = p.webkit.launch()
    dev = dict(p.devices['iPhone 13']); ctx = b.new_context(**dev)
    ctx.route('**/api/auth/me', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization'}, body=json.dumps({'email': 'demo@example.com'})))
    pg = ctx.new_page(); logs = []
    pg.on('console', lambda m: logs.append(m.type + ' ' + m.text[:200]))
    pg.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)[:300]))
    pg.on('crash', lambda: logs.append('CRASH'))
    t0 = time.time(); pg.goto(base + hsh, wait_until='load')
    last = None
    for i in range(80):
        try: st = pg.evaluate("()=>({bar:(document.getElementById('lbar')||{}).style?.width, ready:!!(window.__rw&&window.__rw.ready), title:!!document.querySelector('#title:not(.gone)'), stage:(window.__diag&&window.__diag.info.stage), fb:!!document.getElementById('rwFail'), cls:document.documentElement.className})")
        except Exception as e: st = 'ERR ' + str(e)[:120]
        if st != last: print(f'{time.time()-t0:5.1f}s', st, flush=True); last = st
        if isinstance(st, dict) and st['ready']: break
        if i in (3, 15, 40): pg.screenshot(path=f'/tmp/rwx/ios/{tag}_{i}.png')
        time.sleep(3)
    pg.screenshot(path=f'/tmp/rwx/ios/{tag}_end.png')
    print('\n'.join(l for l in logs if 'error' in l.lower() or 'PAGE' in l or 'CRASH' in l or 'warn' in l.lower())[:3000])
    b.close()
