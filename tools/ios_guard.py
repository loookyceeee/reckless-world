# Boot-guard test in WebKit with an iPhone profile (app WebView stand-in): python3 tools/ios_guard.py <base>
import sys, json, time
from playwright.sync_api import sync_playwright
base = sys.argv[1]; TOK = 'tok_GUARDtest.987654321'
RN = "window.__msgs=[];window.ReactNativeWebView={postMessage:function(m){window.__msgs.push(m)}};"
def st(pg): return pg.evaluate("()=>({ready:!!(window.__rw&&window.__rw.ready),fail:(document.getElementById('rwFail')||{}).innerText||null,boot:localStorage.getItem('rw.boot'),auto:!!window.__rwAutoSafe,pipe:!!(window.__rw&&window.__rw.pipe&&window.__rw.pipe()),msgs:window.__msgs||[],url:location.href})")
def short(s): s = dict(s); s['fail'] = s['fail'] and s['fail'].replace('\n', ' / ')[:160]; s['tokenInMsgs'] = any(TOK in m for m in s['msgs']); s['msgs'] = [m[:160] for m in s['msgs']][:4]; return s
with sync_playwright() as p:
    b = p.webkit.launch(); dev = dict(p.devices['iPhone 13'])
    def ctx(route_city_404=False):
        c = b.new_context(**dev); c.add_init_script(RN)
        c.route('**/api/auth/me', lambda r: r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization'}, body=json.dumps({'email': 'demo@example.com'})))
        if route_city_404: c.route('**/data/city.json', lambda r: r.fulfill(status=404, body='nope'))
        return c
    def wait_ready(pg, n=60):
        for i in range(n):
            if pg.evaluate("()=>!!(window.__rw&&window.__rw.ready)"): return True
            time.sleep(1)
        return False
    # 1 normal app load with token
    c = ctx(); pg = c.new_page(); pg.goto(base + '?app=1#token=' + TOK); print('1 normal ready', wait_ready(pg)); time.sleep(2); print('1', short(st(pg))); pg.screenshot(path='/tmp/rwx/ios/guard_1_normal.png')
    # 3 context loss after ready
    pg.evaluate("()=>{const g=window.__rw.engine._gl;window.__lc=g.getExtension('WEBGL_lose_context');window.__lc.loseContext()}"); time.sleep(4); print('3 lost', short(st(pg))); pg.screenshot(path='/tmp/rwx/ios/guard_3_contextlost.png')
    pg.evaluate("()=>window.__lc.restoreContext()"); time.sleep(4); print('3 restored overlay', st(pg)['fail'] is not None)
    # 4 crash-loop -> auto safe mode on next load
    pg.evaluate("()=>localStorage.setItem('rw.boot',JSON.stringify({t:Date.now()-60000,ok:false}))"); pg.goto(base + '?app=1'); print('4 ready', wait_ready(pg)); time.sleep(4); s4 = short(st(pg)); print('4 autosafe', s4['auto'], 'pipe', s4['pipe'], 'boot', s4['boot']); pg.screenshot(path='/tmp/rwx/ios/guard_4_autosafe.png'); c.close()
    # 2 watchdog (3 s) -> STILL LOADING, then auto-hides on ready
    c = ctx(); pg = c.new_page(); pg.goto(base + '?app=1&watch=3'); time.sleep(4.5); print('2 watchdog', short(st(pg))); pg.screenshot(path='/tmp/rwx/ios/guard_2_watchdog.png'); wait_ready(pg); time.sleep(1); print('2 after ready overlay', st(pg)['fail'] is not None); c.close()
    # 5 fatal boot error (city data 404) -> COULDN'T START with RETRY / SAFE MODE, error posted
    c = ctx(True); pg = c.new_page(); pg.goto(base + '?app=1#token=' + TOK); time.sleep(12); print('5 fatal', short(st(pg))); pg.screenshot(path='/tmp/rwx/ios/guard_5_fatal.png')
    pg.click('#rwFail [data-a=safe]'); time.sleep(2); print('5 safe button ->', pg.url); c.close()
    b.close()
