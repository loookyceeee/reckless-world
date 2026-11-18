"""Convert raw Overpass JSON (data/osm.json) into compact local-metre city data.
Data (c) OpenStreetMap contributors, ODbL 1.0."""
import json, math, hashlib
LAT0, LON0 = 54.6050, -5.9310
KX = math.cos(math.radians(LAT0)) * 111320.0
KZ = 110540.0
def ll2xz(lat, lon): return ((lon - LON0) * KX, (lat - LAT0) * KZ)
d = json.load(open('data/osm.json'))
nodes = {e['id']: (e['lat'], e['lon']) for e in d['elements'] if e['type'] == 'node'}
DRIVE = {'motorway':(3,12),'motorway_link':(1,7),'trunk':(2,11),'trunk_link':(1,7),'primary':(2,10),'primary_link':(1,7),
         'secondary':(2,9),'secondary_link':(1,7),'tertiary':(2,8),'tertiary_link':(1,6),'unclassified':(1,7),'residential':(1,7),
         'living_street':(1,6),'service':(1,4.5),'busway':(1,6)}
WALK = {'footway':3,'pedestrian':6,'path':2.5,'steps':3,'cycleway':2.5,'corridor':2}
buildings, roads = [], []
def h01(s): return int(hashlib.md5(str(s).encode()).hexdigest()[:8], 16) / 0xffffffff
def num(v):
    try: return float(str(v).split(';')[0].replace('m','').strip())
    except: return None
for e in d['elements']:
    if e['type'] != 'way': continue
    t = e.get('tags', {})
    pts = [nodes[n] for n in e['nodes'] if n in nodes]
    if len(pts) < 2: continue
    xz = [ll2xz(*p) for p in pts]
    if 'building' in t and len(xz) >= 4:
        if xz[0] == xz[-1]: xz = xz[:-1]
        if t.get('building') in ('roof',):
            continue
        h = num(t.get('height'))
        lv = num(t.get('building:levels'))
        if h is None and lv is not None: h = lv * 3.3 + 1.0
        est = h is None
        if h is None:
            area = 0.5*abs(sum(xz[i][0]*xz[(i+1)%len(xz)][1]-xz[(i+1)%len(xz)][0]*xz[i][1] for i in range(len(xz))))
            r = h01(e['id'])
            bt = t.get('building')
            if bt in ('house','terrace','residential','semidetached_house'): h = 7 + r*3
            elif bt in ('church','cathedral'): h = 16 + r*6
            elif area > 3000: h = 14 + r*10
            elif area > 600: h = 10 + r*10
            else: h = 7 + r*7
        h = max(3.0, min(h, 90.0))
        flat = [round(c, 1) for p in xz for c in p]
        b = {'p': flat, 'h': round(h, 1), 'id': e['id']}
        if 'name' in t: b['n'] = t['name']
        if t.get('building') in ('church','cathedral') or t.get('amenity') == 'place_of_worship': b['k'] = 'church'
        if est: b['e'] = 1
        buildings.append(b)
    elif 'highway' in t and t['highway'] in DRIVE or t.get('highway') in WALK:
        hw = t['highway']
        if t.get('area') == 'yes': continue
        if hw in DRIVE:
            lanes_default, w = DRIVE[hw]
            ln = num(t.get('lanes')) or (lanes_default*(1 if t.get('oneway')=='yes' else 2))
            w = max(w, ln*3.2)
            r = {'t': hw, 'w': round(w,1), 'd': 1, 'n': e['nodes'], 'ln': int(ln)}
            if t.get('oneway') in ('yes','1','true') or hw in ('motorway','motorway_link') or t.get('junction')=='roundabout': r['o'] = 1
        else:
            r = {'t': hw, 'w': WALK[hw], 'd': 0, 'n': e['nodes']}
        if 'name' in t: r['nm'] = t['name']
        r['p'] = [round(c, 1) for p in xz for c in p]
        roads.append(r)
# node ids used by roads -> compact index for graph
used = {}
for r in roads:
    idx = []
    for n in r['n']:
        if n in nodes:
            if n not in used: used[n] = len(used)
            idx.append(used[n])
    r['n'] = idx
VEN = {'temple': (54.608211, -5.935652), 'warehouse': (54.602432, -5.926183)}
out = {'origin': [LAT0, LON0], 'kx': KX, 'kz': KZ, 'buildings': buildings, 'roads': roads,
       'attribution': '© OpenStreetMap contributors, ODbL 1.0 (openstreetmap.org/copyright). Fetched via Overpass API 18 Nov 2026.'}
json.dump(out, open('public/data/city.json', 'w'), separators=(',', ':'))
print(len(buildings), len(roads), len(used))
for k, (la, lo) in VEN.items():
    x, z = ll2xz(la, lo)
    best = sorted(buildings, key=lambda b: min((b['p'][i]-x)**2+(b['p'][i+1]-z)**2 for i in range(0,len(b['p']),2)))[:4]
    print(k, round(x,1), round(z,1), [(b.get('n'), b['h'], b['id']) for b in best])
