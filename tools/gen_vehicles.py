"""Procedural hero vehicles -> public/data/vehicles.json (same compact format as cars.json + 'emit' palette indices).
Game coords: x across (+x = offside/right), y up, z forward. Original geometry, no operator or manufacturer marks.
  glider : 18 m tram-style articulated rapid-transit bus (rounded nose, wraparound screen, purple + silver band,
           covered wheels, bellows, LED strips). Generic: no Translink/Glider names or logos.
  wagon  : armoured Land-Rover-style patrol wagon, white/silver, Battenburg chequer down the sides (no badge, crest or text).
Run: python3 tools/gen_vehicles.py"""
import json, math, base64, array, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'vehicles.json')

class M:
    def __init__(s): s.V = []; s.F = []  # F: (i0,i1,i2, colkey)
    def v(s, p): s.V.append(tuple(p)); return len(s.V) - 1
    def tri(s, a, b, c, col): s.F.append((a, b, c, col))
    def quad(s, a, b, c, d, col): s.tri(a, b, c, col); s.tri(a, c, d, col)

def rr_ring(w, h, r, y0, n=8, ys=(), xs_step=0.4):
    """rounded-rect cross-section (x,y), counter-clockwise seen from +z; n points per corner; straight sides are split at
    the livery breakpoints ys (so colour bands get their own faces) and every xs_step across roof/floor"""
    r = min(r, w / 2 - 1e-3, h / 2 - 1e-3); pts = []
    def arc(cx, cy, a0):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n); pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    lo, hi = y0 + r, y0 + h - r; yb = [min(max(y, lo + 1e-4 * (i + 1)), hi - 1e-4 * (len(ys) - i)) for i, y in enumerate(sorted(ys))]  # constant count (clamped) so rings stay loftable
    xr = w / 2 - r; m_ = max(1, int(2.2 / xs_step)); xb = [xr - 2 * xr * k / m_ for k in range(1, m_)]
    arc(xr, y0 + h - r, 0)
    pts += [(x, y0 + h) for x in xb]
    arc(-xr, y0 + h - r, 90)
    pts += [(-w / 2, y) for y in reversed(yb)]
    arc(-xr, y0 + r, 180)
    pts += [(x, y0) for x in reversed(xb)]
    arc(xr, y0 + r, 270)
    pts = [(w / 2, y) for y in yb] + pts  # right side, going up
    return pts

def loft(m, rings, colfn, cap0=True, cap1=True):
    """rings: list of (z, pts). colfn(centroid, normal) -> colour key"""
    idx = [[m.v((x, y, z)) for (x, y) in pts] for z, pts in rings]
    n = len(rings[0][1])
    def face(a, b, c, d):
        P = [m.V[i] for i in (a, b, c, d)]; cen = [sum(p[k] for p in P) / 4 for k in range(3)]
        u = [P[1][k] - P[0][k] for k in range(3)]; w = [P[3][k] - P[0][k] for k in range(3)]
        nr = (u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]); L = math.sqrt(sum(c * c for c in nr)) or 1
        nr = tuple(c / L for c in nr); m.quad(a, b, c, d, colfn(cen, nr))
    for j in range(len(rings) - 1):
        A, B = idx[j], idx[j + 1]
        for i in range(n):
            i2 = (i + 1) % n; face(A[i], A[i2], B[i2], B[i])
    for which, ok, sgn in ((0, cap0, -1), (-1, cap1, 1)):
        if not ok: continue
        R = idx[which]; z = rings[which][0]; cx = 0; cy = sum(m.V[i][1] for i in R) / n
        c = m.v((cx, cy, z))
        for i in range(n):
            i2 = (i + 1) % n; cen = m.V[R[i]]
            col = colfn((cen[0] * 0.5, (cen[1] + cy) / 2, z), (0, 0, sgn))
            if sgn > 0: m.tri(R[i], R[i2], c, col)
            else: m.tri(R[i2], R[i], c, col)

def box(m, c, s, col, cols=None):
    x, y, z = c; a, b, d = s[0] / 2, s[1] / 2, s[2] / 2
    P = [m.v((x + i * a, y + j * b, z + k * d)) for i in (-1, 1) for j in (-1, 1) for k in (-1, 1)]
    I = lambda i, j, k: P[(i > 0) * 4 + (j > 0) * 2 + (k > 0)]
    F = {'+x': (I(1, -1, -1), I(1, 1, -1), I(1, 1, 1), I(1, -1, 1)), '-x': (I(-1, -1, 1), I(-1, 1, 1), I(-1, 1, -1), I(-1, -1, -1)),
         '+y': (I(-1, 1, -1), I(-1, 1, 1), I(1, 1, 1), I(1, 1, -1)), '-y': (I(-1, -1, -1), I(1, -1, -1), I(1, -1, 1), I(-1, -1, 1)),
         '+z': (I(1, -1, 1), I(1, 1, 1), I(-1, 1, 1), I(-1, -1, 1)), '-z': (I(-1, -1, -1), I(-1, 1, -1), I(1, 1, -1), I(1, -1, -1))}
    for k, f in F.items(): m.quad(*f, (cols or {}).get(k, col))

def wheel(m, x, y, z, r, w, tyre, hub, seg=18):
    s = 1 if x > 0 else -1; o = [m.v((x - s * w / 2, y, z))]; i_ = [m.v((x + s * w / 2, y, z))]
    ro = [m.v((x - s * w / 2, y + r * math.cos(2 * math.pi * k / seg), z + r * math.sin(2 * math.pi * k / seg))) for k in range(seg)]
    ri = [m.v((x + s * w / 2, y + r * math.cos(2 * math.pi * k / seg), z + r * math.sin(2 * math.pi * k / seg))) for k in range(seg)]
    for k in range(seg):
        k2 = (k + 1) % seg; m.quad(ro[k], ro[k2], ri[k2], ri[k], tyre)
        m.tri(i_[0], ri[k], ri[k2], hub) if s > 0 else m.tri(i_[0], ri[k2], ri[k], hub)
        m.tri(o[0], ro[k2], ro[k], tyre) if s > 0 else m.tri(o[0], ro[k], ro[k2], tyre)

# ---------------- glider-style rapid bus ----------------
PAL = {'purple': (0.52, 0.17, 0.66), 'purpleD': (0.25, 0.07, 0.32), 'roof': (0.52, 0.2, 0.64), 'silver': (0.86, 0.88, 0.91), 'glass': (0.07, 0.08, 0.12),
       'skirt': (0.16, 0.12, 0.2), 'bellows': (0.13, 0.13, 0.15), 'tyre': (0.06, 0.06, 0.07), 'hub': (0.2, 0.2, 0.23), 'pod': (0.7, 0.72, 0.76),
       'led': (0.85, 0.9, 1.0), 'head': (1.0, 0.97, 0.88), 'tail': (1.0, 0.08, 0.06), 'dest': (1.0, 0.62, 0.1), 'door': (0.09, 0.1, 0.13), 'frame': (0.3, 0.3, 0.34),
       'white': (0.93, 0.94, 0.95), 'bbY': (0.83, 0.92, 0.1), 'bbB': (0.07, 0.2, 0.62), 'black': (0.08, 0.08, 0.09), 'blue': (0.16, 0.42, 1.0), 'steel': (0.32, 0.33, 0.36),
       'amber': (1.0, 0.6, 0.08), 'glassLit': (0.17, 0.18, 0.21), 'cabin': (0.42, 0.4, 0.34), 'paint': (0.86, 0.87, 0.89), 'trim': (0.12, 0.12, 0.13), 'grille': (0.05, 0.05, 0.06)}
EMIT = {'led', 'head', 'tail', 'dest', 'amber', 'glassLit', 'cabin'}

def glider():
    m = M(); W, Y0, H = 2.55, 0.3, 2.95
    GYS = (0.5, 1.06, 1.32, 1.4, 2.47, 2.56, 2.66, 2.74)
    DOORS = [7.75, 3.9, -3.2, -7.2]  # nearside (-x) doors, UK left-hand kerb
    def col(c, n, front=None):
        x, y, z = c; nx, ny, nz = n
        if ny > 0.75 and y > 2.9: return 'roof'
        if nz > 0.45 and z > 8.6:  # nose
            if 2.62 < y < 2.88 and abs(x) < 0.95: return 'dest'
            if 0.95 < y < 2.62: return 'glass'
            if 0.55 < y < 0.75 and abs(x) > 0.45: return 'head'
            if 1.06 < y < 1.32 or 0.8 < y < 0.95: return 'silver'
            return 'purple' if y > 0.5 else 'skirt'
        if nz < -0.45 and z < -8.6:
            if 0.6 < y < 0.92 and abs(x) > 0.55: return 'tail'
            if 1.4 < y < 2.6 and abs(x) < 0.9: return 'glass'
            if 2.82 < y < 2.9: return 'led'
            return 'purple' if y > 0.5 else 'skirt'
        if abs(nx) > 0.5:
            if x < 0 and any(abs(z - d) < 0.6 for d in DOORS) and 0.5 < y < 2.56: return 'door'
            if 2.66 < y < 2.74: return 'led'
            if 2.47 < y < 2.56: return 'cabin'  # interior ceiling light-line seen through the tint
            if 1.4 < y < 2.47: return 'glass'  # dark tinted side glass (reflective body material)
            if 1.06 < y < 1.32: return 'silver'
            if y < 0.5: return 'skirt'
            return 'purple'
        if ny < -0.5: return 'skirt'
        return 'purple' if y > 0.5 else 'skirt'
    def section(z0, z1, nose_f, nose_r):
        rings = []; N = int((z1 - z0) / 0.2) + 1
        for i in range(N + 1):
            z = z0 + (z1 - z0) * i / N; w, h, r, y0 = W, H, 0.32, Y0
            tf = max(0.0, (z - (z1 - nose_f)) / nose_f) if nose_f else 0; tr = max(0.0, ((z0 + nose_r) - z) / nose_r) if nose_r else 0
            if tf > 0: w = W * (1 - 0.09 * tf ** 2.4); h = H - 0.38 * tf ** 2.2; r = 0.32 + 0.38 * tf; y0 = Y0 + 0.05 * tf ** 3
            if tr > 0: w = W * (1 - 0.05 * tr ** 2.5); h = H - 0.18 * tr ** 2; r = 0.32 + 0.12 * tr
            rings.append((z, rr_ring(w, h, r, y0, 8, GYS)))
        if nose_f:  # bulged tram nose cap
            for dz, k in ((0.12, 0.9), (0.2, 0.7)): rings.append((z1 + dz, rr_ring(W * (1 - 0.09) * k, (H - 0.38) * (0.82 + 0.18 * k), 0.7 * k + 0.05, Y0 + 0.08 + (1 - k) * 0.5, 8, GYS)))
        loft(m, rings, col)
    section(-0.15, 8.75, 1.6, 0)    # front car (tram nose)
    section(-9.0, -1.05, 0, 0.6)    # rear car
    for k in range(9):              # bellows: accordion rings
        z = -1.05 + k * 0.1125; w = 2.36 if k % 2 else 2.44
        loft(m, [(z, rr_ring(w, 2.6, 0.25, 0.42)), (z + 0.1125, rr_ring(2.44 if k % 2 else 2.36, 2.6, 0.25, 0.42))], lambda c, n: 'bellows', False, False)
    for z0, z1 in ((0.4, 7.6), (-8.4, -1.6)):  # roof pods (battery/HVAC fairings)
        loft(m, [(z0, rr_ring(1.7, 0.01, 0.005, 3.24)), (z0 + 0.5, rr_ring(1.9, 0.32, 0.14, 3.18)), (z1 - 0.5, rr_ring(1.9, 0.32, 0.14, 3.18)), (z1, rr_ring(1.7, 0.01, 0.005, 3.24))], lambda c, n: 'pod', False, False)
    for d in DOORS:  # door frames
        box(m, (-W / 2 - 0.012, 1.55, d), (0.02, 2.3, 0.05), 'frame'); box(m, (-W / 2 - 0.012, 1.55, d + 0.6), (0.02, 2.3, 0.05), 'frame'); box(m, (-W / 2 - 0.012, 1.55, d - 0.6), (0.02, 2.3, 0.05), 'frame')
    for z in (7.0, 1.0, -6.8):  # axles, wheels mostly hidden behind the skirts ("covered wheels")
        for x in (-1.0, 1.0): wheel(m, x, 0.5, z, 0.5, 0.32, 'tyre', 'hub')
    for x in (-1.0, 1.0): box(m, (x * 1.28, 2.25, 8.1), (0.06, 0.12, 0.26), 'frame')  # camera-mirror stalks
    return m

def wagon():
    m = M(); W = 2.25
    def col(c, n):
        x, y, z = c; nx, ny, nz = n
        if ny > 0.75: return 'white'
        if abs(nx) > 0.6:
            if 0.95 < y < 1.75:  # Battenburg: two rows of 0.4 m squares
                u = int(math.floor((z + 2.6) / 0.4)); v = 0 if y < 1.35 else 1
                return 'bbY' if (u + v) % 2 == 0 else 'bbB'
            if 2.0 < y < 2.5 and ((-0.9 < z < 0.4) or (1.0 < z < 1.9)): return 'glass'
            if y < 0.62: return 'black'
            return 'white'
        if nz > 0.4:
            if 1.95 < y < 2.55 and z < 2.5: return 'glass'
            return 'white' if y > 0.62 else 'black'
        if nz < -0.4:
            if 0.75 < y < 1.0 and abs(x) > 0.75: return 'tail'
            if 2.1 < y < 2.5 and abs(x) < 0.7: return 'glass'
            return 'white' if y > 0.62 else 'black'
        return 'white' if y > 0.62 else 'black'
    rings = []
    for z in [x * 0.2 - 2.6 for x in range(26)] + [2.55]:
        w, h, r, y0 = W, 2.55, 0.14, 0.42
        tf = max(0.0, (z - 1.75) / 0.8)
        if tf > 0: h = 2.55 - 0.85 * tf ** 1.4; r = 0.14 + 0.06 * tf  # raked armoured screen / bonnet
        if z > 2.3: h = min(h, 1.45)
        rings.append((z, rr_ring(w, h, r, y0, 4, (0.62, 0.95, 1.35, 1.75, 2.0, 2.5), 0.4)))
    loft(m, rings, col)
    for sd in (-1, 1): box(m, (sd * 0.8, 0.86, 2.565), (0.36, 0.16, 0.03), 'head')       # headlamps
    box(m, (0, 1.05, 2.562), (0.9, 0.3, 0.03), 'black')                                     # plain grille (no badge)
    for i in range(5):                                                                       # Battenburg across the nose
        for j in range(2): box(m, (-0.9 + i * 0.45, 1.33 + j * 0.2, 2.566), (0.45, 0.2, 0.02), 'bbY' if (i + j) % 2 == 0 else 'bbB')
    box(m, (0, 0.62, 2.72), (2.3, 0.3, 0.2), 'steel')            # plain steel bumper / push bar
    for x in (-0.75, 0.75): box(m, (x, 0.95, 2.78), (0.08, 0.6, 0.08), 'steel')
    box(m, (0, 0.95, 2.82), (1.6, 0.06, 0.06), 'steel')
    for sd in (-1, 1):
        box(m, (sd * (W / 2 + 0.03), 0.55, 0), (0.07, 0.22, 4.4), 'black')  # armoured sill
        for k in range(4): box(m, (sd * (W / 2 + 0.02), 2.06 + k * 0.12, 1.45), (0.03, 0.03, 0.95), 'steel')  # window grilles
        box(m, (sd * (W / 2 + 0.1), 2.0, 1.95), (0.06, 0.22, 0.14), 'black')  # mirrors
    box(m, (0, 1.4, -2.72), (0.9, 0.9, 0.18), 'black')                 # rear spare wheel cover
    box(m, (0, 3.0, -0.6), (1.5, 0.05, 2.6), 'steel')                  # roof rack
    for z in (1.75, -1.75):
        for x in (-0.98, 0.98): wheel(m, x, 0.42, z, 0.42, 0.3, 'tyre', 'steel')
    return m

def pestate():
    """Fictional patrol estate: rounded bonnet, raked screen, glasshouse with tumblehome, wheel arches, Battenburg baked
    in two rows of 0.19 m squares (crisp, same palette as the wagon). No maker badge, crest or text."""
    m = M(); W, L = 1.84, 4.7; ZF, ZR = 2.35, -2.35; ZW = (1.42, -1.38); RW = 0.34; SQ = 0.19; BB0 = 0.53
    def sm(a, b, x): t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
    def bcol(c, n):
        x, y, z = c; nx, ny, nz = n
        if abs(nx) > 0.55 and BB0 < y < BB0 + 2 * SQ and -2.05 < z < 2.0:
            u = int(math.floor((z + 2.05) / SQ)); v = 0 if y < BB0 + SQ else 1
            return 'bbY' if (u + v) % 2 == 0 else 'bbB'
        if nz > 0.35 and z > 2.0:
            if 0.55 < y < 0.69 and abs(x) > 0.4: return 'head'
            if 0.44 < y < 0.56 and abs(x) < 0.5: return 'grille'
            if y < 0.42: return 'trim'
            return 'paint'
        if nz < -0.35 and z < -2.0:
            if 0.72 < y < 0.92 and abs(x) > 0.58: return 'tail'
            if y < 0.48: return 'trim'
            return 'paint'
        if ny < -0.5 or y < 0.36: return 'trim'
        return 'paint'
    rings = []; zs = [ZR + k * 0.0475 for k in range(int(L / 0.0475) + 1)]
    for z in zs:
        f = sm(1.85, ZF, z); r_ = sm(-1.95, ZR, z)  # nose / tail rounding
        top = 0.97 - 0.15 * sm(0.9, 2.25, z) - 0.12 * f ** 2 - 0.04 * r_  # bonnet falls toward the nose
        y0 = 0.3 + 0.12 * f + 0.1 * r_
        for zw in ZW:
            d = abs(z - zw)
            if d < RW + 0.08: y0 = max(y0, 0.3 + math.sqrt(max(0.0, (RW + 0.08) ** 2 - d * d)) * 1.05)
        w = W * (1 - 0.1 * f ** 1.6 - 0.05 * r_ ** 1.6)
        h = max(0.12, top - y0)
        rings.append((z, rr_ring(w, h, min(0.16, h * 0.45), y0, 5, (BB0, BB0 + SQ, BB0 + 2 * SQ), 0.3)))
    loft(m, rings, bcol)
    # glasshouse: belt 0.93, roof 1.5, raked screen (base z 0.95 -> roof z 0.05), slight estate tailgate rake
    def ccol(c, n):
        x, y, z = c; nx, ny, nz = n
        if ny > 0.7: return 'paint'
        if nz > 0.3: return 'glass' if y > 1.0 else 'paint'
        if nz < -0.3: return 'glass' if 1.0 < y < 1.42 else 'paint'
        if 1.0 < y < 1.43:
            if abs(z + 0.45) < 0.07 or abs(z + 1.55) < 0.06: return 'trim'  # B / C pillars
            return 'glass'
        return 'paint'
    crings = []
    for z in [-2.22 + k * 0.08 for k in range(41)]:
        if z > 1.0: break
        rf = 1.5 - 0.06 * sm(-1.6, -2.22, z)
        if z > 0.05: rf = 1.5 - (1.5 - 0.95) * ((z - 0.05) / 0.95) ** 1.15
        h = max(0.05, rf - 0.9); w = 1.58 - 0.05 * sm(0.3, 1.0, z)
        crings.append((z, rr_ring(w, h, min(0.2, h * 0.45), 0.9, 5, (1.0, 1.43), 0.3)))
    loft(m, crings, ccol)
    for sd in (-1, 1):
        box(m, (sd * 0.93, 1.02, 0.78), (0.1, 0.07, 0.16), 'trim')                     # mirrors
        box(m, (sd * (W / 2 + 0.005), 0.34, 0.02), (0.03, 0.08, 2.0), 'trim')          # sills
        for zw in ZW: wheel(m, sd * 0.79, 0.33, zw, 0.33, 0.24, 'tyre', 'steel')
    box(m, (0, 1.53, -1.0), (1.2, 0.03, 0.05), 'trim'); box(m, (0, 1.53, -0.2), (1.2, 0.03, 0.05), 'trim')  # roof bars
    return m

def pack(m):
    pal = sorted({f[3] for f in m.F}); pidx = {k: i for i, k in enumerate(pal)}
    V, VI, I = {}, [], []
    for a, b, c, k in m.F:
        tri = []
        for vi in (a, b, c):
            p = m.V[vi]; q = (round(p[0] * 500), round(p[1] * 500), round(p[2] * 500), pidx[k])
            if q not in V: V[q] = len(VI); VI.append(q)
            tri.append(V[q])
        I += [tri[0], tri[2], tri[1]]
    pos = array.array('h', [c for q in VI for c in q[:3]]); col = bytes(q[3] for q in VI); ind = array.array('H' if len(VI) < 65536 else 'I', I)
    assert len(VI) < 65536
    return {'pos': base64.b64encode(pos.tobytes()).decode(), 'col': base64.b64encode(col).decode(), 'ind': base64.b64encode(ind.tobytes()).decode(),
            'pal': [list(PAL[k]) for k in pal], 'names': pal, 'emit': [pidx[k] for k in pal if k in EMIT], 'paint': -1, 'scale': 1 / 500}

out = {'glider': pack(glider()), 'wagon': pack(wagon()), 'pestate': pack(pestate())}
for k, v in out.items(): print(k, len(base64.b64decode(v['ind'])) // 6, 'tris')
json.dump(out, open(OUT, 'w'), separators=(',', ':')); print('wrote', OUT, os.path.getsize(OUT))
