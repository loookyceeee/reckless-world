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

def _ofs(m, a, b, c, col, ref):  # triangle wound so its normal faces along ref
    P = [m.V[i] for i in (a, b, c)]; u = [P[1][k] - P[0][k] for k in range(3)]; w = [P[2][k] - P[0][k] for k in range(3)]
    n = (u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0])
    m.tri(a, b, c, col) if sum(n[k] * ref[k] for k in range(3)) >= 0 else m.tri(a, c, b, col)

def wheel2(m, x, y, z, r, w, rim='rim', spokes=5, seg=30, dish=0.05, hub='hub'):
    """tyre with rounded shoulders and a bulged sidewall, a bright rim lip, a recessed spoked dish and a hub cap.
    Axis along x; profile points are (axial offset from centre, outward sign s; radius)."""
    s = 1 if x > 0 else -1
    th = [2 * math.pi * k / seg for k in range(seg)]
    def ring(ax, rr): return [m.v((x + s * ax, y + rr * math.cos(t), z + rr * math.sin(t))) for t in th]
    h = w / 2
    prof = [(-h, 0.62 * r, 'tyreS'), (-h, 0.9 * r, 'tyreS'), (-h + 0.035, r, 'tyre'), (h - 0.035, r, 'tyre'), (h, 0.9 * r, 'tyre'),
            (h + 0.012, 0.8 * r, 'tyreS'), (h, 0.7 * r, 'tyreS'), (h - 0.006, 0.665 * r, rim), (h - 0.012, 0.635 * r, 'rimD')]
    R = [ring(ax, rr) for ax, rr, _ in prof]
    core = lambda k: (x + s * 0.0, y + 0.8 * r * math.cos(th[k]), z + 0.8 * r * math.sin(th[k]))
    for j in range(len(prof) - 1):
        col = prof[j + 1][2]
        for k in range(seg):
            k2 = (k + 1) % seg; a, b, c, d = R[j][k], R[j][k2], R[j + 1][k2], R[j + 1][k]
            cen = [sum(m.V[i][q] for i in (a, b, c, d)) / 4 for q in range(3)]; cc = core(k)
            ref = [cen[q] - cc[q] for q in range(3)]
            if j >= 6: ref = (s, 0, 0)  # rim lip faces out
            _ofs(m, a, b, c, col, ref); _ofs(m, a, c, d, col, ref)
    # inner face disc
    ci = m.v((x - s * h, y, z))
    for k in range(seg): _ofs(m, ci, R[0][k], R[0][(k + 1) % seg], 'tyreS', (-s, 0, 0))
    # dish: spokes sit proud (rim colour), gaps are recessed and dark; hub cap in the middle
    ad = h - dish; rs = 0.635 * r; rh = 0.2 * r
    outer = ring(ad, rs); inner = ring(ad, rh); outerG = ring(ad - 0.03, rs * 0.99); innerG = ring(ad - 0.03, rh)
    for k in range(seg):
        k2 = (k + 1) % seg; sp = (math.floor(k * spokes / seg * 2) % 2 == 0)  # alternating spoke / gap sectors
        if sp:
            _ofs(m, outer[k], outer[k2], inner[k2], rim, (s, 0, 0)); _ofs(m, outer[k], inner[k2], inner[k], rim, (s, 0, 0))
        else:
            _ofs(m, outerG[k], outerG[k2], innerG[k2], 'rimD', (s, 0, 0)); _ofs(m, outerG[k], innerG[k2], innerG[k], 'rimD', (s, 0, 0))
        # barrel from the lip down to the dish
        for (A, B) in ((R[-1], outer if sp else outerG),):
            _ofs(m, A[k], A[k2], B[k2], 'rimD', (s, 0, 0)); _ofs(m, A[k], B[k2], B[k], 'rimD', (s, 0, 0))
        if not sp:  # spoke side walls
            pass
    hc = m.v((x + s * (ad + 0.025), y, z)); hr = ring(ad + 0.005, rh)
    for k in range(seg):
        k2 = (k + 1) % seg; _ofs(m, hr[k], hr[k2], hc, hub, (s, 0, 0))
        _ofs(m, inner[k], inner[k2], hr[k2], hub, (s, 0, 0)); _ofs(m, inner[k], hr[k2], hr[k], hub, (s, 0, 0))
        _ofs(m, innerG[k], innerG[k2], inner[k2], 'rimD', (s, 0, 0)); _ofs(m, innerG[k], inner[k2], inner[k], 'rimD', (s, 0, 0))
    # nuts
    for q in range(5):
        t = 2 * math.pi * q / 5 + 0.3; box(m, (x + s * (ad + 0.012), y + 0.13 * r * math.cos(t), z + 0.13 * r * math.sin(t)), (0.02, 0.018, 0.018), 'rimD')

# ---------------- glider-style rapid bus ----------------
PAL = {'purple': (0.48, 0.12, 0.78), 'purpleD': (0.25, 0.07, 0.32), 'roof': (0.52, 0.2, 0.64), 'silver': (0.86, 0.88, 0.91), 'glass': (0.07, 0.08, 0.12),
       'skirt': (0.16, 0.12, 0.2), 'bellows': (0.4, 0.41, 0.44), 'tyre': (0.07, 0.07, 0.075), 'tyreS': (0.12, 0.12, 0.13), 'hub': (0.55, 0.56, 0.6), 'rim': (0.74, 0.76, 0.8), 'rimD': (0.1, 0.1, 0.11), 'pod': (0.7, 0.72, 0.76),
       'led': (0.85, 0.9, 1.0), 'head': (1.0, 0.97, 0.88), 'tail': (1.0, 0.08, 0.06), 'dest': (1.0, 0.62, 0.1), 'door': (0.09, 0.1, 0.13), 'frame': (0.3, 0.3, 0.34),
       'white': (0.93, 0.94, 0.95), 'bbY': (0.97, 0.8, 0.1), 'bbB': (0.07, 0.2, 0.62), 'black': (0.08, 0.08, 0.09), 'blue': (0.16, 0.42, 1.0), 'steel': (0.32, 0.33, 0.36),
       'amber': (1.0, 0.6, 0.08), 'glassLit': (0.17, 0.18, 0.21), 'cabin': (0.42, 0.4, 0.34), 'paint': (0.86, 0.87, 0.89), 'trim': (0.12, 0.12, 0.13), 'grille': (0.05, 0.05, 0.06), 'bellowsL': (0.58, 0.59, 0.62), 'btnG': (0.3, 1.0, 0.35)}
EMIT = {'led', 'head', 'tail', 'dest', 'amber', 'glassLit', 'cabin', 'btnG'}

def glider():
    """purple RECKLESS articulated bus (research/asset-refs/bus_colour.png + bus_grey.png): black glazing band, purple lower body
    and roof cap, white swoosh lines, purple wheel spats, grey concertina. Text/logos are decals added in src/traffic.js."""
    m = M(); W, Y0, H = 2.55, 0.3, 2.95
    GYS = (0.5, 1.0, 1.06, 1.4, 2.47, 2.56, 2.66, 2.74)
    DOORS = [7.75, 3.9, -3.2, -7.2]  # nearside (-x) doors, UK left-hand kerb
    def col(c, n, front=None):
        x, y, z = c; nx, ny, nz = n
        if ny > 0.75 and y > 2.9: return 'purple'
        if nz > 0.45 and z > 8.6:  # nose: big black screen, amber destination, LED column, purple chin
            if 2.62 < y < 2.88 and abs(x) < 0.95: return 'dest'
            if 0.95 < y < 2.62: return 'glass' if abs(x) < 1.0 else 'black'
            if 0.45 < y < 0.95 and abs(x) > 0.82: return 'head'
            if 0.95 < y < 1.0: return 'white'
            return 'purple' if y > 0.42 else 'purpleD'
        if nz < -0.45 and z < -8.6:  # rear: black screen, red tails, purple lower
            if 0.5 < y < 1.25 and abs(x) > 0.95: return 'tail'
            if 2.62 < y < 2.88 and abs(x) < 0.6: return 'dest'
            if 1.25 < y < 2.62: return 'black'
            return 'purple' if y > 0.42 else 'purpleD'
        if abs(nx) > 0.5:
            if x < 0 and any(abs(z - d) < 0.6 for d in DOORS) and 0.5 < y < 2.56: return 'door'
            if y > 2.74: return 'purple'          # roof cap band (RECKLESS wordmark decal sits here)
            if 2.66 < y < 2.74: return 'white'    # upper swoosh line
            if 2.47 < y < 2.56: return 'cabin'    # interior light line seen through the tint
            if 1.4 < y < 2.66: return 'glass'
            if 1.06 < y < 1.4: return 'black'
            if 1.0 < y < 1.06: return 'white'     # lower swoosh line
            return 'purple' if y > 0.42 else 'purpleD'
        if ny < -0.5: return 'skirt'
        return 'purple' if y > 0.5 else 'purpleD'
    def section(z0, z1, nose_f, nose_r):
        rings = []; N = int((z1 - z0) / 0.2) + 1
        for i in range(N + 1):
            z = z0 + (z1 - z0) * i / N; w, h, r, y0 = W, H, 0.3, Y0
            tf = max(0.0, (z - (z1 - nose_f)) / nose_f) if nose_f else 0; tr = max(0.0, ((z0 + nose_r) - z) / nose_r) if nose_r else 0
            if tf > 0: w = W * (1 - 0.07 * tf ** 2.4); h = H - 0.3 * tf ** 2.2; r = 0.3 + 0.36 * tf; y0 = Y0 + 0.04 * tf ** 3
            if tr > 0: w = W * (1 - 0.05 * tr ** 2.5); h = H - 0.14 * tr ** 2; r = 0.3 + 0.14 * tr
            rings.append((z, rr_ring(w, h, r, y0, 8, GYS)))
        if nose_f:  # bulged nose cap
            for dz, k in ((0.12, 0.9), (0.2, 0.7)): rings.append((z1 + dz, rr_ring(W * (1 - 0.07) * k, (H - 0.3) * (0.82 + 0.18 * k), 0.66 * k + 0.05, Y0 + 0.08 + (1 - k) * 0.5, 8, GYS)))
        loft(m, rings, col)
    section(-0.15, 8.75, 1.4, 0)    # front car
    section(-9.0, -1.05, 0, 0.5)    # rear car
    for k in range(9):              # grey concertina: alternating light/dark ribs
        z = -1.05 + k * 0.1125; w = 2.36 if k % 2 else 2.46
        loft(m, [(z, rr_ring(w, 2.62, 0.25, 0.4)), (z + 0.1125, rr_ring(2.46 if k % 2 else 2.36, 2.62, 0.25, 0.4))], (lambda kk: (lambda c, n: 'bellowsL' if kk % 2 else 'bellows'))(k), False, False)
    for z0, z1 in ((0.6, 7.4), (-8.2, -1.8)):  # low roof fairings with vent grilles (top view on the sheet)
        loft(m, [(z0, rr_ring(1.6, 0.01, 0.005, 3.24)), (z0 + 0.4, rr_ring(1.8, 0.2, 0.09, 3.2)), (z1 - 0.4, rr_ring(1.8, 0.2, 0.09, 3.2)), (z1, rr_ring(1.6, 0.01, 0.005, 3.24))], lambda c, n: 'purple', False, False)
        for q in range(3): box(m, (0, 3.41, z0 + 0.9 + q * 0.75), (0.9, 0.02, 0.6), 'grille')
    for d in DOORS:  # door frames + green/blue door buttons
        for dz in (0.0, 0.6, -0.6): box(m, (-W / 2 - 0.012, 1.55, d + dz), (0.02, 2.3, 0.05), 'frame')
        box(m, (-W / 2 - 0.02, 1.45, d - 0.3), (0.02, 0.07, 0.07), 'btnG'); box(m, (-W / 2 - 0.02, 1.45, d + 0.3), (0.02, 0.07, 0.07), 'btnG')
    for z in (7.0, 1.0, -6.8):  # axles; wheels behind purple spats
        for x in (-1.0, 1.0):
            wheel2(m, x, 0.5, z, 0.5, 0.32, rim='steel', spokes=10, dish=0.07)
            s_ = 1 if x > 0 else -1; seg = 20; cx_ = s_ * (W / 2 + 0.006)
            c0 = m.v((cx_ + s_ * 0.03, 0.55, z)); ring = [m.v((cx_, 0.55 + 0.5 * math.cos(2 * math.pi * k / seg), z + 0.56 * math.sin(2 * math.pi * k / seg))) for k in range(seg)]
            for k in range(seg): _ofs(m, c0, ring[k], ring[(k + 1) % seg], 'purple', (s_, 0, 0))
    for x in (-1.0, 1.0): box(m, (x * 1.3, 2.3, 8.3), (0.06, 0.12, 0.3), 'black'); box(m, (x * 1.42, 2.05, 8.42), (0.16, 0.34, 0.1), 'black')  # mirror arms + heads
    return m

def wagon():
    """armoured Defender-style patrol Land Rover, matched to research/wagon_ref.png: short, flat, low bonnet with a black mesh
    grille and square lamp pods; a separate cab with a near-vertical split windscreen; the tall white rear box (slightly wider
    and taller than the cab); black armour running the full length below a high one-and-a-half-row Battenburg; white arch
    flares; small chunky black steel wheels on a narrow track; roof AC units, two small blue beacons (traffic.js).
    No crest, plate, maker badge or force name (plain POLICE added in traffic.js)."""
    m = M()
    ZF, ZC, ZB, ZR = 2.3, 1.12, 0.22, -2.45     # bonnet front, windscreen base, cab/box joint, rear face
    FA, RA, WR, TW = 1.5, -1.3, 0.4, 0.37      # axles, wheel radius, tyre width
    XW = 0.74                                    # wheel centre x (narrow track: tyres tuck under the body)
    CW, BW = 1.86, 1.98                          # cab / bonnet width, box width
    YS, YA, YH = 0.28, 0.7, 1.2                  # armour bottom, armour top, bonnet top (flat, low)
    YCT, YBT = 2.2, 2.26                        # cab roof, box roof
    AR = WR + 0.08                               # arch radius
    SQ = 0.3; BB1 = YA + 0.01; BBh = SQ / 2     # Battenburg: a half row under a full row, sitting high
    def arch_cut(z, zc):  # height of the arch opening at z (0 outside)
        d = abs(z - zc); return WR + math.sqrt(AR * AR - d * d) if d < AR else 0.0
    def lo(z): return max([arch_cut(z, zc) for zc in (FA, RA)] + [0.0])
    # --- black armour, full length, both sides + front/rear aprons, sliced so its bottom follows the arch openings
    N = 64; zs = [ZR + (ZF - ZR) * k / N for k in range(N + 1)]
    for sd in (-1, 1):
        for a, b in zip(zs, zs[1:]):
            zm = (a + b) / 2; hw = (BW if zm < ZB else CW) / 2; yb = max(YS, lo(zm))
            if yb < YA - 0.02: box(m, (sd * (hw + 0.02), (yb + YA) / 2, zm), (0.06, YA - yb, b - a + 0.002), 'black')
    box(m, (0, (YS + YA) / 2, ZR - 0.02), (BW + 0.06, YA - YS, 0.06), 'black')
    box(m, (0, 0.4, 0.0), (1.2, 0.2, 4.4), 'black')                             # chassis/belly plate
    # --- white body: rear box, cab, bonnet + wings
    box(m, (0, (YA + YBT) / 2, (ZR + ZB) / 2), (BW, YBT - YA, ZB - ZR), 'white', {'-y': 'black'})
    box(m, (0, (YA + YCT) / 2, (ZB + ZC) / 2), (CW, YCT - YA, ZC - ZB), 'white', {'-y': 'black'})
    box(m, (0, (YA + YH) / 2, (ZC + ZF) / 2), (CW, YH - YA, ZF - ZC), 'white', {'-y': 'black'})
    box(m, (0, YH + 0.015, (ZC + ZF) / 2 - 0.03), (1.22, 0.03, ZF - ZC - 0.1), 'white')   # raised centre bonnet panel
    for sd in (-1, 1): box(m, (sd * 0.62, YH + 0.008, (ZC + ZF) / 2), (0.02, 0.02, ZF - ZC - 0.06), 'trim')
    box(m, (0, (YCT + YBT) / 2 + 0.01, ZB + 0.01), (BW, YBT - YCT + 0.02, 0.04), 'white')  # box overhang face above the cab
    for sd in (-1, 1): box(m, (sd * (CW / 2 + (BW - CW) / 4), (YA + YCT) / 2, ZB + 0.01), ((BW - CW) / 2, YCT - YA, 0.04), 'white')
    # --- white arch flares (smooth extruded half-annulus, proud of the side) round each wheel opening
    for zc in (FA, RA):
        hw = (BW if zc < ZB else CW) / 2; NS = 20; ri, ro = AR, AR + 0.17
        for sd in (-1, 1):
            xi, xo = sd * (hw - 0.01), sd * (hw + 0.11)
            pt = lambda x, r, t: m.v((x, WR + r * math.sin(t), zc - r * math.cos(t)))
            for k in range(NS):
                t0 = -0.12 + (math.pi + 0.24) * k / NS; t1 = -0.12 + (math.pi + 0.24) * (k + 1) / NS; tm = (t0 + t1) / 2
                a, b, c, d = pt(xo, ri, t0), pt(xo, ri, t1), pt(xo, ro, t1), pt(xo, ro, t0)          # outer face
                _ofs(m, a, b, c, 'white', (sd, 0, 0)); _ofs(m, a, c, d, 'white', (sd, 0, 0))
                a, b, c, d = pt(xi, ro, t0), pt(xi, ro, t1), pt(xo, ro, t1), pt(xo, ro, t0)          # top (outer radius)
                rf = (0, math.sin(tm), -math.cos(tm)); _ofs(m, a, b, c, 'white', rf); _ofs(m, a, c, d, 'white', rf)
                a, b, c, d = pt(xi, ri, t0), pt(xi, ri, t1), pt(xo, ri, t1), pt(xo, ri, t0)          # underside (inner radius)
                rf = (0, -math.sin(tm), math.cos(tm)); _ofs(m, a, b, c, 'black', rf); _ofs(m, a, c, d, 'black', rf)
        box(m, (0, WR + AR - 0.02, zc), (min(CW, BW) - 0.02, 0.04, 2 * AR), 'black')     # wheel-well liner
    # --- Battenburg: a half row (squares SQ x SQ/2) under one full row, from the wing to the tail, high on the body
    def band_side(sd, z0, z1, hw):
        n = max(1, int(round((z1 - z0) / SQ)))
        for i in range(n):
            zc_ = z0 + (i + 0.5) * (z1 - z0) / n; w_ = (z1 - z0) / n
            box(m, (sd * (hw + 0.004), BB1 + BBh / 2, zc_), (0.008, BBh, w_), 'bbY' if i % 2 else 'bbB')
            box(m, (sd * (hw + 0.004), BB1 + BBh + SQ / 2, zc_), (0.008, SQ, w_), 'bbB' if i % 2 else 'bbY')
    for sd in (-1, 1):
        band_side(sd, ZR + 0.02, ZB, BW / 2); band_side(sd, ZB + 0.04, ZF - 0.04, CW / 2)
    nb = 7
    for i in range(nb):
        xc = -BW / 2 + (i + 0.5) * BW / nb
        box(m, (xc, BB1 + BBh / 2, ZR - 0.004), (BW / nb, BBh, 0.008), 'bbY' if i % 2 else 'bbB')
        box(m, (xc, BB1 + BBh + SQ / 2, ZR - 0.004), (BW / nb, SQ, 0.008), 'bbB' if i % 2 else 'bbY')
    # --- front: white upper panel (POLICE goes here), full-width black grille band with square lamp pods, armoured bumper
    box(m, (0, 1.13, ZF + 0.006), (CW, 0.14, 0.012), 'white')                    # white nose strip (plain POLICE here)
    box(m, (0, 0.77, ZF + 0.03), (CW, 0.56, 0.06), 'black')                      # black grille band: most of the front below the nose strip
    box(m, (0, 0.8, ZF + 0.062), (1.1, 0.4, 0.01), 'grille')
    for k in range(10): box(m, (-0.5 + k * 0.111, 0.8, ZF + 0.07), (0.014, 0.4, 0.01), 'trim')
    for k in range(5): box(m, (0, 0.62 + k * 0.09, ZF + 0.072), (1.1, 0.012, 0.01), 'trim')
    for sd in (-1, 1):
        box(m, (sd * 0.76, 0.88, ZF + 0.07), (0.3, 0.3, 0.04), 'black')            # square lamp pod
        box(m, (sd * 0.76, 0.88, ZF + 0.092), (0.2, 0.2, 0.01), 'head')
        box(m, (sd * 0.76, 0.88, ZF + 0.096), (0.11, 0.11, 0.01), 'head')
        box(m, (sd * 0.9, 1.12, ZF + 0.02), (0.08, 0.05, 0.012), 'amber')
    box(m, (0, 0.38, ZF + 0.08), (CW + 0.04, 0.22, 0.18), 'black')               # armoured bumper plate
    box(m, (0, 0.46, ZF + 0.175), (1.2, 0.04, 0.01), 'trim')
    # --- cab: near-vertical split windscreen in a thick white frame, black seals; small door windows
    ZW = ZC - 0.02; WY0, WY1 = YH + 0.16, 1.88
    box(m, (0, (WY0 + WY1) / 2, ZW + 0.01), (CW - 0.22, WY1 - WY0 + 0.06, 0.02), 'black')
    for sd in (-1, 1): box(m, (sd * 0.4, (WY0 + WY1) / 2, ZW + 0.024), (0.64, WY1 - WY0 - 0.06, 0.01), 'glass')
    box(m, (0, (WY0 + WY1) / 2, ZW + 0.03), (0.12, WY1 - WY0, 0.02), 'white')   # centre pillar (split screen)
    for sd in (-1, 1): box(m, (sd * 0.3, WY0 + 0.02, ZW + 0.04), (0.5, 0.02, 0.02), 'trim')  # wipers
    box(m, (0, WY1 + 0.11, ZW + 0.02), (CW, 0.06, 0.04), 'white')                # visor lip
    for sd in (-1, 1):
        x = sd * (CW / 2 + 0.006)
        box(m, (x, 1.66, (ZB + ZC) / 2 + 0.05), (0.006, 0.56, 0.62), 'black')
        box(m, (x + sd * 0.003, 1.66, (ZB + ZC) / 2 + 0.05), (0.006, 0.48, 0.54), 'glass')
        for k in range(3): box(m, (x + sd * 0.008, 1.66, (ZB + ZC) / 2 - 0.13 + k * 0.18), (0.01, 0.44, 0.02), 'trim')
        box(m, (x, 1.62, ZB + 0.08), (0.006, 1.3, 0.016), 'trim')                 # cab/box seam
        box(m, (x, 1.62, ZC - 0.06), (0.006, 0.9, 0.016), 'trim')                 # door front shut line
        box(m, (sd * (CW / 2 + 0.16), 1.82, ZC - 0.06), (0.04, 0.04, 0.12), 'black')  # mirror
        box(m, (sd * (CW / 2 + 0.22), 1.76, ZC - 0.06), (0.06, 0.24, 0.15), 'black')
        # box: one small barred window high up near the front, otherwise blank
        xb = sd * (BW / 2 + 0.006)
        box(m, (xb, 1.78, -0.25), (0.006, 0.42, 0.62), 'black'); box(m, (xb + sd * 0.003, 1.78, -0.25), (0.006, 0.34, 0.54), 'glass')
        for k in range(4): box(m, (xb + sd * 0.008, 1.78, -0.48 + k * 0.15), (0.01, 0.36, 0.02), 'trim')
        box(m, (sd * (BW / 2 + 0.04), 0.3, -0.1), (0.06, 0.06, 0.7), 'trim')      # side step
    # --- rear: door with a small window, lamps, step
    box(m, (0, 1.62, ZR - 0.009), (1.0, 1.4, 0.006), 'trim'); box(m, (0, 1.62, ZR - 0.012), (0.96, 1.36, 0.006), 'white')
    box(m, (0, 1.95, ZR - 0.016), (0.5, 0.34, 0.006), 'glass')
    for sd in (-1, 1): box(m, (sd * 0.82, 1.55, ZR - 0.012), (0.14, 0.3, 0.012), 'tail'); box(m, (sd * 0.82, 1.33, ZR - 0.012), (0.14, 0.09, 0.012), 'amber')
    box(m, (0, 0.36, ZR - 0.1), (BW, 0.18, 0.16), 'black')
    # --- roof: three grilled AC units (front-left on the cab, mid and rear on the box); blue beacon plinths at the front corners
    for (xc, zc, yb) in ((-0.48, 0.62, YCT), (0.4, -0.5, YBT), (-0.3, -1.55, YBT)):
        box(m, (xc, yb + 0.03, zc), (0.74, 0.06, 0.66), 'trim')                      # mounting frame
        box(m, (xc, yb + 0.22, zc), (0.68, 0.34, 0.6), 'pod')
        for fz in (-1, 1):                                                           # grilles front/back + sides
            for gx in range(4):
                for gy in range(2): box(m, (xc - 0.24 + gx * 0.16, yb + 0.15 + gy * 0.13, zc + fz * 0.302), (0.12, 0.1, 0.006), 'trim')
        for fx in (-1, 1):
            for gz in range(3): box(m, (xc + fx * 0.342, yb + 0.22, zc - 0.18 + gz * 0.18), (0.006, 0.24, 0.13), 'trim')
    for sd in (-1, 1): box(m, (sd * 0.72, YCT + 0.03, 0.98), (0.2, 0.06, 0.2), 'trim')
    # --- small, chunky black steel wheels, narrow track
    # --- sheet v2: white steel wheels, hanging black mesh skirts between the arches, caged lamp pods
    for z in (FA, RA):
        for x in (-XW, XW): wheel2(m, x, WR, z, WR, TW, rim='white', spokes=6, dish=0.07, hub='black')
    for sd in (-1, 1):
        for a, b in zip(zs, zs[1:]):
            zm = (a + b) / 2
            if lo(zm) > 0 or zm < ZR + 0.08 or zm > ZF - 0.2: continue
            hw = (BW if zm < ZB else CW) / 2
            box(m, (sd * (hw + 0.045), 0.215, zm), (0.012, 0.17, b - a + 0.002), 'grille')                  # mesh flap
            box(m, (sd * (hw + 0.05), 0.135, zm), (0.02, 0.02, b - a + 0.002), 'trim')                     # bottom rail
        zk = ZR + 0.1
        while zk < ZF - 0.2:
            if lo(zk) == 0: box(m, (sd * (((BW if zk < ZB else CW) / 2) + 0.053), 0.215, zk), (0.012, 0.17, 0.016), 'trim')
            zk += 0.09
    for sd in (-1, 1):
        for k in range(3): box(m, (sd * 0.76 - 0.1 + k * 0.1, 0.88, ZF + 0.12), (0.018, 0.32, 0.018), 'trim')   # lamp cage bars
        box(m, (sd * 0.76, 0.88, ZF + 0.12), (0.32, 0.018, 0.018), 'trim')
    return m

def pestate():
    """Fictional patrol estate: rounded bonnet, raked screen, glasshouse with tumblehome, wheel arches, Battenburg baked
    in two rows of 0.19 m squares (crisp, same palette as the wagon). No maker badge, crest or text."""
    m = M(); W, L = 1.84, 4.7; ZF, ZR = 2.35, -2.35; ZW = (1.42, -1.38); RW = 0.34; SQ = 0.19; BB0 = 0.53
    def sm(a, b, x): t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
    def bcol(c, n):
        x, y, z = c; nx, ny, nz = n
        ya = max([0.3 + math.sqrt(max(0.0, (RW + 0.08) ** 2 - (z - zw) ** 2)) * 1.05 for zw in ZW if abs(z - zw) < RW + 0.08] or [0.0])
        if abs(nx) > 0.55 and ya and y < ya + 0.035: return 'paint'   # clean white lip round the arches
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
        top = 0.97 - 0.11 * sm(0.9, 2.3, z) - 0.07 * f ** 2 - 0.04 * r_  # bonnet falls gently: blunt, level nose
        y0 = 0.3 + 0.07 * f + 0.1 * r_
        for zw in ZW:
            d = abs(z - zw)
            if d < RW + 0.08: y0 = max(y0, 0.3 + math.sqrt(max(0.0, (RW + 0.08) ** 2 - d * d)) * 1.05)
        w = W * (1 - 0.1 * f ** 1.6 - 0.05 * r_ ** 1.6)
        h = max(0.12, top - y0)
        rings.append((z, rr_ring(w, h, min(0.16, h * 0.45), y0, 5, (BB0, BB0 + SQ, BB0 + 2 * SQ), 0.3)))
    loft(m, rings, bcol)
    # Battenburg as a decal skin just proud of the body side: crisp squares, clipped cleanly to the wheel arches
    def prof(z):
        f = sm(1.85, ZF, z); r_ = sm(-1.95, ZR, z)
        top = 0.97 - 0.11 * sm(0.9, 2.3, z) - 0.07 * f ** 2 - 0.04 * r_; w = W * (1 - 0.1 * f ** 1.6 - 0.05 * r_ ** 1.6)
        y0 = 0.3 + 0.07 * f + 0.1 * r_
        for zw in ZW:
            d = abs(z - zw)
            if d < RW + 0.08: y0 = max(y0, 0.3 + math.sqrt(max(0.0, (RW + 0.08) ** 2 - d * d)) * 1.05)
        return top, w, y0
    def sx(z, y):
        top, w, y0 = prof(z); h = max(0.12, top - y0); r = min(0.16, h * 0.45); xr = w / 2 - r
        if y > top - r: return xr + math.sqrt(max(0.0, r * r - (y - (top - r)) ** 2))
        if y < y0 + r: return xr + math.sqrt(max(0.0, r * r - (y0 + r - y) ** 2))
        return w / 2
    NZ, NY = 4, 3
    for sd in (-1, 1):
        for u in range(int(4.05 / SQ)):
            z0 = -2.05 + u * SQ; z1 = min(z0 + SQ, 2.0)
            if z1 <= z0: continue
            for v in range(2):
                colk = 'bbY' if (u + v) % 2 == 0 else 'bbB'; ya0, ya1 = BB0 + v * SQ, BB0 + (v + 1) * SQ
                for a_ in range(NZ):
                    za, zb = z0 + (z1 - z0) * a_ / NZ, z0 + (z1 - z0) * (a_ + 1) / NZ
                    lo = lambda z: max(ya0, prof(z)[2] + 0.035 if prof(z)[2] > 0.31 else ya0)
                    la, lb = lo(za), lo(zb)
                    if la >= ya1 - 1e-3 and lb >= ya1 - 1e-3: continue
                    la, lb = min(la, ya1), min(lb, ya1)
                    for b_ in range(NY):
                        ta, tb = b_ / NY, (b_ + 1) / NY
                        P = [(za, la + (ya1 - la) * ta), (zb, lb + (ya1 - lb) * ta), (zb, lb + (ya1 - lb) * tb), (za, la + (ya1 - la) * tb)]
                        ids = [m.v((sd * (sx(z, y) + 0.004), y, z)) for z, y in P]
                        _ofs(m, ids[0], ids[1], ids[2], colk, (sd, 0, 0)); _ofs(m, ids[0], ids[2], ids[3], colk, (sd, 0, 0))
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
        for zw in ZW: wheel2(m, sd * 0.8, 0.335, zw, 0.335, 0.22, rim='rim', spokes=5, dish=0.045)
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
