"""Street furniture for the game world from the research data pack (all OGL / ODbL).
Usage: python3 scripts/build_furniture.py ../research/belfast/geojson
Writes public/data/streetfurniture.json (lamps, trees, stops, signals) and public/data/crossings.json."""
import json, math, sys
G = sys.argv[1] if len(sys.argv) > 1 else '../research/belfast/geojson'
LAT0, LON0 = 54.6050, -5.9310
KX = math.cos(math.radians(LAT0)) * 111320.0; KZ = 110540.0
X0, X1, Z0, Z1, M = -830, 660, -1520, 660, 60
def xz(c): return ((c[0] - LON0) * KX, (c[1] - LAT0) * KZ)

# Lisburn Road corridor down to LOCATION X (149 Lisburn Rd): Shaftesbury Sq -> Bradbury Pl -> Lisburn Rd
CORR = [(-215, -1480), (-210, -1714), (-268, -1839), (-658, -2177), (-914, -2393), (-1010, -2475)]
CW = 115
def in_corr(x, z, m=0):
    for (ax, az), (bx, bz) in zip(CORR, CORR[1:]):
        dx, dz = bx - ax, bz - az; t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
        if (x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2 < (CW + m) ** 2: return True
    return False
def inside(x, z): return (X0 - M < x < X1 + M and Z0 - M < z < Z1 + M) or in_corr(x, z, 20)
def load(n): return json.load(open(f'{G}/{n}.geojson'))['features']
def f(v, d):
    try: return float(str(v).split(';')[0])
    except: return d
lamps = []
for ft in load('dfi_street_lights'):
    x, z = xz(ft['geometry']['coordinates'])
    if not inside(x, z): continue
    p = ft['properties']; nm = (p.get('LANTERN_BOQ_NAME') or '').upper()
    led = 0 if ('SON' in nm or 'SOX' in nm) and 'LED' not in nm else 1
    lamps.append([round(x, 1), round(z, 1), max(4.0, min(12.0, f(p.get('MOUNT_HEIGHT'), 8.0))), led])
trees = []
for ft in load('bcc_trees'):
    x, z = xz(ft['geometry']['coordinates'])
    if not inside(x, z): continue
    p = ft['properties']; trees.append([round(x, 1), round(z, 1), max(3.0, min(22.0, f(p.get('Height'), 8.0))), max(1.5, min(12.0, f(p.get('Spread'), 4.0)))])
stops = []
for ft in load('translink_stops'):
    x, z = xz(ft['geometry']['coordinates'])
    if inside(x, z): stops.append([round(x, 1), round(z, 1), ft['properties'].get('lines', '')])
signals = []
for ft in load('traffic_signals'):
    x, z = xz(ft['geometry']['coordinates'])
    if inside(x, z): signals.append([round(x, 1), round(z, 1)])
xs = []
for ft in load('crossings'):
    x, z = xz(ft['geometry']['coordinates'])
    if not inside(x, z): continue
    c = ft['properties'].get('crossing') or ''
    if 'traffic_signals' in c: xs.append([round(x, 2), round(z, 2), 's'])
    elif c in ('uncontrolled', 'marked', 'zebra'): xs.append([round(x, 2), round(z, 2), 'z'])
out = {'lamps': lamps, 'trees': trees, 'stops': stops, 'signals': signals,
       'attribution': 'Contains DfI Roads street lighting data and Belfast City Council trees data, OGL v3.0 via OpenDataNI'}
json.dump(out, open('public/data/streetfurniture.json', 'w'), separators=(',', ':'))
json.dump(xs, open('public/data/crossings.json', 'w'), separators=(',', ':'))
print('lamps', len(lamps), 'led', sum(l[3] for l in lamps), 'trees', len(trees), 'stops', len(stops), 'signals', len(signals), 'crossings', len(xs))
