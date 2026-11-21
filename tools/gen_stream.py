"""City chunk streaming data (OUTSTANDING C) from assets_incoming/city_data (OSM ODbL footprints + 2006 LiDAR heights, OGL v3.0;
DfI street lights + BCC street trees, OGL v3.0). Only what city.json / streetfurniture.json do not already ship, clipped to the
ground slab. -> public/data/stream/index.json + c_<ix>_<iz>.json  {b:[city.json building format]}; extras.json {l:[[x,z,h,led]], t:[[x,z,h,spread]]} merged into the base lamps/trees at load"""
import json, glob, math, os
SRC = '../assets_incoming/city_data/'; D = 'public/data/'; OUT = D + 'stream/'
os.makedirs(OUT, exist_ok=True)
city = json.load(open(D + 'city.json')); sf = json.load(open(D + 'streetfurniture.json'))
have = set(b['id'] for b in city['buildings'])
GX = (-85 - 1100 + 15, -85 + 1100 - 15); GZ = (-760 - 1780 + 15, -760 + 1780 - 15)
inG = lambda x, z: GX[0] < x < GX[1] and GZ[0] < z < GZ[1]
def area(r): return sum(r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1] for i in range(len(r))) / 2
COL = {'brick': '#8a4a3a', 'stone': '#b8a68c', 'sandstone': '#c2a37a', 'concrete': '#9a9a96', 'render': '#d2cbbd', 'glass': '#6f7f8c'}
chunks = {}; seen = set()
for f in sorted(glob.glob(SRC + 'chunks/chunk_*.json')):
    for b in json.load(open(f))['buildings']:
        if b['id'] in seen: continue
        seen.add(b['id'])
        if b['id'].startswith('way/') and int(b['id'][4:]) in have: continue
        if b.get('type') in ('shed', 'roof', 'garage', 'garages', 'carport', 'hut', 'container', 'kiosk', 'parking'): continue
        r = b['rings'][0]
        if len(r) > 1 and r[0] == r[-1]: r = r[:-1]
        if len(r) < 3: continue
        A = abs(area(r))
        if A < 18: continue
        cx = sum(p[0] for p in r) / len(r); cz = sum(p[1] for p in r) / len(r)
        if not inG(cx, cz): continue
        house = b.get('type') in ('house', 'terrace', 'semidetached_house', 'detached', 'residential', 'bungalow')
        h = b.get('h') or (7.0 if house else 9.0)
        h = max(3.0, min(h, 60.0))
        rf = b.get('roof') or ('gabled' if house else 'flat')
        if rf not in ('gabled', 'hipped', 'flat', 'side_hipped', 'skillion'): rf = 'gabled' if house else 'flat'
        o = {'p': [round(v, 1) for p in r for v in p], 'h': round(h, 1), 'rf': rf, 'id': b['id']}
        if b.get('ridge') and b['ridge'] > h: o['r'] = round(b['ridge'], 1)
        if b.get('col'): o['c'] = b['col']
        elif b.get('mat') in COL: o['c'] = COL[b['mat']]
        if b.get('name'): o['n'] = b['name']
        k = (math.floor(cx / 500), math.floor(cz / 500)); chunks.setdefault(k, {'b': [], 'l': [], 't': []})['b'].append(o)
# roads the base city lacks (midpoint > 10 m from any city.json road): flat asphalt ribbons, no kerbs/markings
cov = set()
for r in city['roads']:
    p = r['p']
    for i in range(0, len(p) - 2, 2):
        ax, az, bx, bz = p[i], p[i + 1], p[i + 2], p[i + 3]; L = math.hypot(bx - ax, bz - az); n = max(1, int(L / 4))
        for k in range(n + 1):
            x = ax + (bx - ax) * k / n; z = az + (bz - az) * k / n; cov.add((round(x / 8), round(z / 8)))
near = lambda x, z: any((round(x / 8) + i, round(z / 8) + j) in cov for i in (-1, 0, 1) for j in (-1, 0, 1))
RW = {'motorway': 11, 'trunk': 10, 'primary': 9, 'secondary': 8, 'tertiary': 7.5, 'residential': 6, 'unclassified': 6, 'living_street': 5, 'service': 4}
seenR = set()
for f in sorted(glob.glob(SRC + 'chunks/chunk_*.json')):
    for r in json.load(open(f))['roads']:
        hw = r.get('highway'); w = r.get('width') or RW.get(hw)
        if not w or (r['id'], tuple(r['pts'][0])) in seenR: continue
        seenR.add((r['id'], tuple(r['pts'][0])))
        pts = r['pts']; run = []
        def flush():
            if len(run) >= 2:
                cx, cz = run[len(run) // 2]; chunks.setdefault((math.floor(cx / 500), math.floor(cz / 500)), {'b': [], 'l': [], 't': []}).setdefault('r', []).append([round(min(w, 12), 1)] + [round(v, 1) for p in run for v in p])
        for i in range(len(pts)):
            x, z = pts[i]
            if i > 0:
                mx, mz = (pts[i - 1][0] + x) / 2, (pts[i - 1][1] + z) / 2
                if near(mx, mz) or not inG(mx, mz): flush(); run = [] ; 
            if not run or run[-1] != [x, z]: run.append([x, z]) if (i == 0 or not (near((pts[i - 1][0] + x) / 2, (pts[i - 1][1] + z) / 2))) else run.append([x, z])
        flush()
# lights / trees not already in streetfurniture.json (0.6 m match)
def key(x, z): return (round(x / 0.6), round(z / 0.6))
haveL = set(key(l[0], l[1]) for l in sf['lamps']); haveT = set(key(t[0], t[1]) for t in sf['trees'])
for l in json.load(open(SRC + 'lights/dfi_street_lights.json'))['lights']:
    x, z = l['x'], l['z']
    if not inG(x, z) or key(x, z) in haveL: continue
    chunks.setdefault((math.floor(x / 500), math.floor(z / 500)), {'b': [], 'l': [], 't': []})['l'].append([round(x, 1), round(z, 1), l.get('h') or 8, 1 if l.get('class') == 'led' else 0])
for t in json.load(open(SRC + 'trees/bcc_street_trees.json'))['trees']:
    x, z = t['x'], t['z']
    if not inG(x, z) or key(x, z) in haveT: continue
    chunks.setdefault((math.floor(x / 500), math.floor(z / 500)), {'b': [], 'l': [], 't': []})['t'].append([round(x, 1), round(z, 1), t.get('h') or 7, t.get('spread') or 4])
EL = [l for c in chunks.values() for l in c['l']]; ET = [t for c in chunks.values() for t in c['t']]
json.dump({'l': EL, 't': ET}, open(OUT + 'extras.json', 'w'), separators=(',', ':'))
for c in chunks.values(): c.pop('l'); c.pop('t')
chunks = {k: c for k, c in chunks.items() if c['b'] or c.get('r')}
idx = []; tot = [0, len(EL), len(ET)]; size = 0
for (ix, iz), c in sorted(chunks.items()):
    fn = f'c_{ix}_{iz}.json'; s = json.dumps(c, separators=(',', ':')); open(OUT + fn, 'w').write(s); size += len(s)
    idx.append([ix, iz, len(c['b']), len(c.get('r', []))]); tot[0] += len(c['b'])
json.dump({'size': 500, 'chunks': idx, 'attribution': '© OpenStreetMap contributors (ODbL); Belfast City LIDAR (DfI Rivers / Cyient Europe Ltd), DfI Roads street lighting and Belfast City Council trees data, OGL v3.0 via OpenDataNI'}, open(OUT + 'index.json', 'w'), separators=(',', ':'))
print('chunks', len(idx), 'buildings', tot[0], 'lamps', tot[1], 'trees', tot[2], 'bytes', size)
