"""Mid-distance street fill: place Kenney (CC0) buildings along OSM streets that have no OSM buildings mapped.
Masks (1 px/m, minimap frame): OSM building footprints (dilated), carriageways + pavements, water and parks from the minimap.
-> public/data/midkit_place.json: [[model, x, z, rotY, tintIndex], ...]   (runtime also skips anything near a venue door)"""
import json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
D = 'public/data/'; city = json.load(open(D + 'city.json')); meta = json.load(open(D + 'minimap_meta.json')); kit = json.load(open(D + 'midkit.json'))
X0, ZT = meta['local_x_at_px0'], meta['local_z_at_top']; W, H = meta['size']
uv = lambda x, z: ((x - X0), (ZT - z))
mm = np.asarray(Image.open(D + meta['file']).convert('RGB')).astype(int)
r_, g_, b_ = mm[..., 0], mm[..., 1], mm[..., 2]
water = (b_ > r_ + 30) & (b_ > g_ + 10); green = (g_ > r_ + 12) & (g_ > b_ + 4)
bl = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(bl)
for b in city['buildings']:
    p = b['p']; pts = [uv(p[i], p[i + 1]) for i in range(0, len(p), 2)]
    if len(pts) >= 3: dr.polygon(pts, fill=255)
bl = np.asarray(bl.filter(ImageFilter.MaxFilter(7))) > 0
rd = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(rd); ROADS = []
for r in city['roads']:
    p = r['p']; pts = [uv(p[i], p[i + 1]) for i in range(0, len(p), 2)]; w = float(r.get('w', 6) or 6)
    if r['t'] in ('footway', 'path', 'cycleway', 'steps', 'corridor'): w = 2.0
    dr.line(pts, fill=255, width=int(w + 5)); ROADS.append((r['t'], w, [(p[i], p[i + 1]) for i in range(0, len(p), 2)]))
rd = np.asarray(rd) > 0
free = ~(bl | rd | water | green)
# ground slab bounds (city.js: 2200 x 3560 centred at -85, -760) minus a margin
GX = (-85 - 1100 + 20, -85 + 1100 - 20); GZ = (-760 - 1780 + 20, -760 + 1780 - 20)
occ = np.zeros_like(free)
# hero streets stay OSM-only: nothing within 160 m of a venue (src/venues.js lat/lon)
LAT0, LON0 = city['origin']; VEN = [(54.60708, -5.93657), (54.602432, -5.926183), (54.59725, -5.92905), (54.5953385, -5.9363266), (54.592256, -5.930879), (54.583353, -5.945171)]
VXZ = [((lo - LON0) * city['kx'], (la - LAT0) * city['kz']) for la, lo in VEN]
COM = [k for k in kit if k[0] == 'c']; SUB = [k for k in kit if k[0] == 's']
rnd = random.Random(11); out = []
def foot(cx, cz, ux, uz, hw, hd):  # pixel coords of a rotated footprint (sampled every 1 m)
    xs = []
    for a in np.arange(-hw, hw + 0.01, 1.0):
        for d in np.arange(-hd, hd + 0.01, 1.0):
            x = cx + ux * d - uz * a; z = cz + uz * d + ux * a; xs.append(uv(x, z))
    return np.array(xs).round().astype(int)
for t, w, pts in ROADS:
    if t not in ('primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street'): continue
    pool = COM if t in ('primary', 'secondary', 'tertiary') else SUB
    for (ax, az), (bx, bz) in zip(pts, pts[1:]):
        L = math.hypot(bx - ax, bz - az)
        if L < 8: continue
        tx, tz = (bx - ax) / L, (bz - az) / L
        for side in (1, -1):
            nx, nz = -tz * side, tx * side   # outward normal (road -> building)
            s = 4.0
            while s < L - 4:
                m = rnd.choice(pool); sx, sy, sz = kit[m]['size']; hw, hd = sx / 2, sz / 2
                if s + hw > L: break
                setback = w / 2 + 3.0 + hd
                cx = ax + tx * (s + hw) + nx * setback; cz = az + tz * (s + hw) + nz * setback
                if not (GX[0] < cx < GX[1] and GZ[0] < cz < GZ[1]) or any(math.hypot(cx - vx, cz - vz) < 160 for vx, vz in VXZ): s += 6; continue
                F = foot(cx, cz, nx, nz, hw + 0.5, hd + 0.5)
                ok = (F[:, 0] >= 0).all() and (F[:, 0] < W).all() and (F[:, 1] >= 0).all() and (F[:, 1] < H).all()
                if ok: ok = free[F[:, 1], F[:, 0]].all() and not occ[F[:, 1], F[:, 0]].any()
                if ok:
                    occ[F[:, 1], F[:, 0]] = True; ry = math.atan2(-nx, -nz)   # model front (+z) faces the road
                    out.append([m, round(cx, 1), round(cz, 1), round(ry, 3), rnd.randrange(6)]); s += sx + rnd.uniform(0.2, 1.5)
                else: s += 3.0
json.dump(out, open(D + 'midkit_place.json', 'w'), separators=(',', ':'))
from collections import Counter; print(len(out), Counter(o[0][0] for o in out))
