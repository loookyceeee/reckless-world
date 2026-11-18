"""Project the app's front renders onto the avatar's bake UVs -> public/models/tex/*.webp (free tools only: numpy/scipy/PIL).
Input: /tmp/av_dump.npz from tools/blender/build_avatar.py (posed idle-frame loop positions/normals/UVs per part).
Technique: camera ("front") projection texturing + per-part landmark alignment + occlusion test against a front depth buffer;
pixels of the wrong class (skin on a garment, background on the edge) are in-painted from the nearest valid pixel, and
surfaces facing away from the camera get a detail-preserving 'back plate' (median-filtered front) so logos/faces don't
appear on the back. See research/techniques-sources.md."""
import numpy as np, os, sys, json
from PIL import Image
from scipy import ndimage as ndi
L = '/workspace/reckless-world/avatar-refs/canonical-looks/'
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'tex'); os.makedirs(OUT, exist_ok=True)
DBG = '/workspace/reckless-world/.scratch/bake'; os.makedirs(DBG, exist_ok=True)
D = np.load(os.environ.get('AV_DUMP', '/tmp/av_dump.npz'))
def part(n): return D[n + '|co'], D[n + '|n'], D[n + '|uv'], D[n + '|tri']

def raster(P2, tri, attrs, W, H, zbuf=None, depth=None):
    """Rasterise triangles given 2D pixel coords P2 (per-loop) into WxH; attrs (per-loop, k) are interpolated.
    If zbuf is given, depth (per-loop) is z-tested (smaller = nearer) and zbuf updated; returns (img, mask)."""
    out = np.zeros((H, W, attrs.shape[1]), np.float32); m = np.zeros((H, W), bool)
    for t in tri:
        a, b, c = P2[t[0]], P2[t[1]], P2[t[2]]
        x0 = int(max(0, np.floor(min(a[0], b[0], c[0])))); x1 = int(min(W - 1, np.ceil(max(a[0], b[0], c[0]))))
        y0 = int(max(0, np.floor(min(a[1], b[1], c[1])))); y1 = int(min(H - 1, np.ceil(max(a[1], b[1], c[1]))))
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-12: continue
        l0 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / d
        l1 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / d
        l2 = 1 - l0 - l1; e = -1e-3
        ins = (l0 >= e) & (l1 >= e) & (l2 >= e)
        if not ins.any(): continue
        val = l0[..., None] * attrs[t[0]] + l1[..., None] * attrs[t[1]] + l2[..., None] * attrs[t[2]]
        sub = out[y0:y1 + 1, x0:x1 + 1]; sm = m[y0:y1 + 1, x0:x1 + 1]
        if zbuf is not None:
            zz = l0 * depth[t[0]] + l1 * depth[t[1]] + l2 * depth[t[2]]; zs = zbuf[y0:y1 + 1, x0:x1 + 1]
            ins = ins & (zz < zs); zs[ins] = zz[ins]
        sub[ins] = val[ins]; sm[ins] = True
    return out, m

def load(name):
    im = np.array(Image.open(L + name + '.png').convert('RGBA')).astype(np.float32) / 255.0
    return im[..., :3], im[..., 3] > 0.5
def skin_mask(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]; br = rgb.mean(-1)
    gr = g / np.maximum(r, 1e-3)
    return (r > g) & (g >= b - 0.03) & (r - b > 0.035) & (r - b < 0.3) & (br > 0.2) & (gr > 0.62) & (gr < 0.97)
from scipy.cluster.vq import kmeans2
def classify(rgb, alpha, core, skinreg, k=4):
    """Pixel is garment if nearer (colour) to the garment's own clusters (sampled in a core patch) than to the skin
    clusters (sampled over the face, so lit and shadowed skin are both covered)."""
    np.random.seed(1)
    g = rgb[core & alpha]; sk = rgb[skinreg & alpha]; sk = sk[sk.mean(-1) > 0.22]
    if len(g) < 20 or len(sk) < 20: return alpha
    cg, _ = kmeans2(g.astype(np.float64), min(k, len(g)), minit='++', seed=1); cs, _ = kmeans2(sk.astype(np.float64), k, minit='++', seed=1)
    X = rgb.reshape(-1, 3)
    dg = np.min(((X[:, None] - cg[None]) ** 2).sum(-1), 1); ds = np.min(((X[:, None] - cs[None]) ** 2).sum(-1), 1)
    return (dg < ds).reshape(alpha.shape) & alpha
def fill(rgb, valid, erode=0):
    """Push-pull style in-paint: invalid pixels take the normalised-Gaussian average of valid ones, coarse to fine."""
    if erode: valid = ndi.binary_erosion(valid, iterations=erode)
    if not valid.any(): return rgb
    out = rgb.copy(); have = valid.copy(); w0 = valid.astype(np.float32)
    for sg in (2, 5, 12, 30, 80):
        num = np.stack([ndi.gaussian_filter(rgb[..., c] * w0, sg) for c in range(3)], -1); den = ndi.gaussian_filter(w0, sg)[..., None]
        ok = (den[..., 0] > 0.02) & ~have; out[ok] = (num / np.maximum(den, 1e-6))[ok]; have |= ok
    if not have.all():
        _, (iy, ix) = ndi.distance_transform_edt(~have, return_indices=True); out = out[iy, ix]
    return out
def backplate(rgb, size=13, amp=0.05):
    med = np.stack([ndi.median_filter(rgb[..., c], size=size) for c in range(3)], -1)
    det = rgb - ndi.gaussian_filter(rgb, (1.5, 1.5, 0))
    return np.clip(med + np.clip(det, -amp, amp), 0, 1)
def sample(img, px, py):  # bilinear
    H, W = img.shape[:2]; px = np.clip(px, 0, W - 1.001); py = np.clip(py, 0, H - 1.001)
    x0 = np.floor(px).astype(int); y0 = np.floor(py).astype(int); fx = (px - x0)[..., None]; fy = (py - y0)[..., None]
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x0 + 1] * fx * (1 - fy) + img[y0 + 1, x0] * (1 - fx) * fy + img[y0 + 1, x0 + 1] * fx * fy)
def smooth(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

# ---------- front view of the posed figure (metres): x right, z up; camera looks +y ----------
def figure_bbox(names):
    cs = np.concatenate([D[n + '|co'] for n in names]); return cs[:, 0].min(), cs[:, 0].max(), cs[:, 2].min(), cs[:, 2].max()
class Map:  # metres -> reference pixels: px = ax*x + bx, py = -az*z + bz
    def __init__(s, ax, bx, az, bz): s.ax, s.bx, s.az, s.bz = ax, bx, az, bz
    def __call__(s, x, z): return s.ax * x + s.bx, -s.az * z + s.bz
def global_map(alpha, names):
    ys, xs = np.where(alpha); x0, x1, z0, z1 = figure_bbox(names)
    sc = (ys.max() - ys.min()) / (z1 - z0); cxr = (xs.min() + xs.max()) / 2; return Map(sc, cxr - sc * (x0 + x1) / 2, sc, ys.min() + sc * z1)
def bbox_map(mask, names, base, ext=None):  # refine: fit the part's projected bbox onto the reference mask bbox
    ys, xs = np.where(mask)
    if len(xs) < 50: return base
    x0, x1, z0, z1 = ext or figure_bbox(names)
    ax = (xs.max() - xs.min()) / (x1 - x0); az = (ys.max() - ys.min()) / (z1 - z0)
    return Map(ax, xs.min() - ax * x0, az, ys.min() + az * z1)

DEPTH_RES = 400.0  # px per metre for the occlusion buffer
def depth_buffer(names):
    x0, x1, z0, z1 = figure_bbox(names); W = int((x1 - x0) * DEPTH_RES) + 4; H = int((z1 - z0) * DEPTH_RES) + 4
    zb = np.full((H, W), 1e9, np.float32)
    for n in names:
        co, _, _, tri = part(n); P2 = np.stack([(co[:, 0] - x0) * DEPTH_RES + 2, (z1 - co[:, 2]) * DEPTH_RES + 2], -1)
        raster(P2, tri, np.zeros((len(co), 1), np.float32), W, H, zbuf=zb, depth=co[:, 1])
    return lambda X, Z, Y: Y <= zb[np.clip(((z1 - Z) * DEPTH_RES + 2).astype(int), 0, H - 1), np.clip(((X - x0) * DEPTH_RES + 2).astype(int), 0, W - 1)] + 0.012

TEXCACHE = {}
def texels(n, R):
    if (n, R) in TEXCACHE: return TEXCACHE[(n, R)]
    co, nr, uv, tri = part(n); P2 = np.stack([uv[:, 0] * R, (1 - uv[:, 1]) * R], -1)
    A, m = raster(P2, tri, np.concatenate([co, nr], 1), R, R); TEXCACHE[(n, R)] = (A, m); return A, m

def bake(n, R, front, back, mp, vis, facing=(0.0, 0.4)):
    A, m = texels(n, R); X, Y, Z, NY = A[..., 0], A[..., 1], A[..., 2], A[..., 4]
    px, py = mp(X, Z); fw = smooth(facing[0], facing[1], -NY) * (vis(X, Z, Y) if vis else 1.0)
    col = sample(front, px, py) * fw[..., None] + sample(back, px, py) * (1 - fw[..., None])
    col[~m] = 0
    # dilate islands so mips/bilinear never pull in black
    _, (iy, ix) = ndi.distance_transform_edt(~m, return_indices=True); col = col[iy, ix]
    return col
def save(col, name, q=88):
    Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, name + '.webp'), quality=q, method=6)

def eye_centres_ref(rgb, alpha, mp_guess, ours):
    """Find the two iris centres near where the global map puts our eyes (darkest blobs)."""
    out = []
    for (x, z) in ours:
        gx, gy = mp_guess(x, z); r = 14
        x0, x1, y0, y1 = int(gx - r), int(gx + r), int(gy - r), int(gy + r)
        win = rgb[y0:y1, x0:x1].mean(-1); w = np.clip(0.35 - win, 0, None) ** 2
        yy, xx = np.mgrid[y0:y1, x0:x1]; out.append(((w * xx).sum() / w.sum(), (w * yy).sum() / w.sum()))
    return out

if __name__ == '__main__':
    BODY = ['Body', 'Hair', 'Eyes']
    # ---- face / head / skin / hair / eyes / shoes from the default-outfit render ----
    rgb, alpha = load('tee-jeans'); look_parts = BODY + ['G_tee', 'G_jeans', 'G_shoes']
    gm = global_map(alpha, look_parts)
    eo = D['Eyes|co']; ours = [tuple(eo[eo[:, 0] * s > 0][:, [0, 2]].mean(0)) for s in (-1, 1)]
    er = eye_centres_ref(rgb, alpha, gm, ours)
    # head map: x from the eye spacing, z from crown (top of alpha) to the eye line
    ax = (er[1][0] - er[0][0]) / (ours[1][0] - ours[0][0]); bx = er[0][0] - ax * ours[0][0]
    ys, xs = np.where(alpha); ztop = figure_bbox(['Hair', 'Body'])[3]; ez = (ours[0][1] + ours[1][1]) / 2; eyy = (er[0][1] + er[1][1]) / 2
    az = (eyy - ys.min()) / (ztop - ez); bz = ys.min() + az * ztop
    hm = Map(ax, bx, az, bz); print('global', vars(gm), 'head', vars(hm), 'eyes ref', er)
    vis_all = depth_buffer(look_parts)
    sk = skin_mask(rgb) & alpha
    skin_c = np.median(rgb[sk], 0); print('skin', skin_c)
    # body skin: head region (face, ears, neck) projected with the head map; rest = arm skin with in-painting
    head_front = fill(rgb, alpha & (skin_mask(rgb) | (rgb.mean(-1) < 0.5)), 2)  # keep eyes/brows/lips (dark) on the face
    ska = sk.copy(); ska[int(gm(0, 0.78)[1]):] = False  # arms/hands only (shoe leather reads as skin)
    body_front = fill(rgb, ska, 2)
    plate = np.ones_like(rgb) * skin_c * 0.97
    A, m = texels('Body', 1024); X, Y, Z = A[..., 0], A[..., 1], A[..., 2]
    zneck = ez - 0.2
    hw = smooth(zneck - 0.03, zneck + 0.03, Z)[..., None]
    vis_body = depth_buffer(['Body'])
    face_lo = np.stack([ndi.median_filter(head_front[..., c], size=25) for c in range(3)], -1); face_lo = ndi.gaussian_filter(face_lo, (10, 10, 0))
    cH = bake('Body', 1024, head_front, face_lo, hm, vis_body, (0.12, 0.5)); cB = bake('Body', 1024, body_front, plate, gm, vis_body, (-0.15, 0.3))
    save(cH * hw + cB * (1 - hw), 'body')
    hairm = alpha & ~skin_mask(rgb) & (rgb.mean(-1) < 0.42)
    hy = np.where(alpha)[0].min(); hairm[int(eyy) - 8:] = False
    hair_front = fill(rgb, hairm, 1); raw_head = fill(rgb, alpha, 1)
    hr = np.where(hairm.any(1))[0]; top, hl = hr.min(), int(np.percentile(np.where(hairm)[0], 70))
    hair_back = hair_front.copy(); band = hair_front[top + 4:hl]
    for y in range(hl, hair_back.shape[0]): hair_back[y] = band[(y - hl) % max(1, len(band))]
    save(bake('Hair', 256, raw_head, hair_back, hm, None, (0.55, 0.85)), 'hair')
    save(bake('Eyes', 128, rgb, rgb, hm, None, (-1, -0.5)), 'eyes')
    # shoes: below the jeans hem, not denim/skin
    blue = (rgb[..., 2] > rgb[..., 0] + 0.04) & alpha
    sh = alpha & ~blue & ~sk; sh[:int(gm(0, 0.12)[1])] = False
    shoe_front = fill(rgb, sh, 2); save(bake('G_shoes', 256, shoe_front, shoe_front, gm, None, (-1, -0.5)), 'shoes')
    json.dump({'global': vars(gm), 'head': vars(hm)}, open(DBG + '/maps.json', 'w'))
    # ---- every wardrobe garment from its own app render ----
    import re
    src = open(os.path.join(os.path.dirname(__file__), '..', 'src', 'crew.js')).read()
    items = re.findall(r"W\('([\w-]+)', '[^']*', '(\w+)', \d+, '[\w-]+', '([\w-]+)', (?:'[\w-]+'|null), '#[0-9a-f]+', '(\w+)'\)", src)
    only = sys.argv[1:]
    for iid, slot, look, kind in items:
        if only and iid not in only: continue
        if not os.path.exists(L + look + '.png'): print('no look', look); continue
        kind = 'crop' if iid == 'see-me-crop' else kind
        rgb, alpha = load(look); gname = 'G_' + kind
        parts = BODY + [gname, 'G_shoes'] + (['G_briefs'] if slot != 'legs' else [])
        gm = global_map(alpha, parts); vis = depth_buffer(parts)
        x0, x1, z0, z1 = figure_bbox([gname]); px0, py0 = gm(x0, z1); px1, py1 = gm(x1, z0)
        box = np.zeros_like(alpha); pad = 0.08 * (px1 - px0)
        box[int(max(0, py0 - pad)):int(py1 + pad), int(max(0, px0 - pad)):int(px1 + pad)] = True
        # core patch: chest (tops) or thighs (legs); skin reference: the face
        core = np.zeros_like(alpha)
        if slot == 'legs':
            for sx in (-1, 1):
                cx, cy = gm(sx * 0.09, 0.55); core[int(cy) - 25:int(cy) + 25, int(cx) - 8:int(cx) + 8] = True
        else:
            cx, cy = gm(0, 1.05); core[int(cy) - 40:int(cy) + 40, int(cx) - 40:int(cx) + 40] = True
        eo = D['Eyes|co']; ex, ey = gm(0, eo[:, 2].mean()); skr = np.zeros_like(alpha); skr[int(ey) + 6:int(ey) + 45, int(ex) - 28:int(ex) + 28] = True
        cls = classify(rgb, alpha, core, skr)
        gmask = cls & box
        lab, nl = ndi.label(gmask); cc = np.bincount(lab[core & gmask].ravel(), minlength=nl + 1); cc[0] = 0
        if nl: gmask = np.isin(lab, np.where(cc > 0.02 * cc.sum())[0])
        if slot == 'legs': gmask[int(gm(0, 0.1)[1]):] = False  # shoes
        else: gmask[:int(gm(0, z1 + 0.02)[1])] = False
        gmask = ndi.binary_opening(gmask, iterations=1); fh = ndi.binary_fill_holes(gmask)  # keep logos/prints inside the garment
        if kind == 'hoodie': fh[:int(gm(0, eo[:, 2].mean() - 0.14)[1])] = gmask[:int(gm(0, eo[:, 2].mean() - 0.14)[1])]  # not the face inside the hood
        gmask = fh
        if slot == 'legs': mp = bbox_map(gmask, [gname], gm)
        else:  # tops: keep the global scale, but put the app's hem exactly on our hem (centre columns, no sleeves)
            cxp = int(gm(0, 1)[0]); colm = gmask[:, cxp - 30:cxp + 30]; hem = np.where(colm.any(1))[0].max()
            mp = Map(gm.ax, gm.bx, gm.az, hem + gm.az * z0)
        front = fill(rgb, gmask, 3); back = backplate(front, 31 if slot != 'legs' else 7, 0.03 if slot != 'legs' else 0.05)
        Image.fromarray((np.concatenate([np.clip(front, 0, 1), np.clip(back, 0, 1), np.stack([gmask] * 3, -1).astype(np.float32)], 1) * 255).astype(np.uint8)).save(DBG + '/front_' + iid + '.png')
        save(bake(gname, 512, front, back, mp, vis, (-0.05, 0.35)), 'g-' + iid)
        print('baked', iid, kind, look)
