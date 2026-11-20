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
FEM = os.environ.get('AVB', 'male') == 'female'  # female base: face/skin/hair/shoes from her turnaround sheet's front view (tools/ref/female_front.png)
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'tex_f' if FEM else 'tex'); os.makedirs(OUT, exist_ok=True)
DBG = '/workspace/reckless-world/.scratch/bake'; os.makedirs(DBG, exist_ok=True)
V5 = os.environ.get('V5', '1') != '0'  # APP DEV v5 crew art is the colour/silhouette reference (Luke approved 2026-11-20)
V5F = {'skate-tee': 'upper-tee', 'rckls-tee': 'upper-rckls-tee', 'see-me-shorts': 'lower-see-shorts', 'deject-sleeve': 'upper-deject', 'barrel-jeans': 'lower-jeans', 'moltin-tee': 'upper-moltin', 'stripped-tee': 'upper-stripped',
  'seasoned-pants': 'lower-seasoned-pants', 'seasoned-hoodie': 'upper-hoodie', 'isometric-tee': 'upper-isometric', 'artillery': 'lower-artillery', 'ultra-tee': 'upper-ultra', 'stan-bottoms': 'lower-stan-bottoms', 'rawdwg-zip': 'upper-zip',
  'pinner-tee': 'upper-pinner', 'rawdawg-shorts': 'lower-raw-shorts', 'distress-shirt': 'upper-distress', 'manager-shorts': 'lower-manager-shorts', 'manager-zip': 'upper-manager', 'see-me-crop': 'upper-crop', 'stan-hoodie': 'upper-stan-hoodie',
  'rcklstv-jersey': 'upper-jersey', 'mesh-jersey': 'upper-mesh'}
D = np.load(os.environ.get('AV_DUMP', '/tmp/av_dump_f.npz' if FEM else '/tmp/av_dump.npz'))
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
    if FEM and name == 'tee-jeans': name = '../../game/tools/ref/female_front'
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
    WARM = np.array([1.0, 1.0, 1.0]) if FEM else np.array([1.03, 0.96, 0.9])  # male: the app render's pinkish-grey skin -> the sheet's warm light skin
    skin_c = np.clip(skin_c * WARM, 0, 1)
    # body skin: head region (face, ears, neck) projected with the head map; rest = arm skin with in-painting
    de_ = abs(er[1][0] - er[0][0]); scalp_ = np.zeros_like(alpha); scalp_[:int(eyy - 0.62 * de_)] = True  # above the brows: the app's hair
    head_front = fill(rgb, alpha & (skin_mask(rgb) | ((rgb.mean(-1) < 0.5) & ~scalp_)), 2)  # keep eyes/brows/lips (dark) on the face; scalp = skin under the fade
    ska = sk.copy(); ska[int(gm(0, 0.78)[1]):] = False  # arms/hands only (shoe leather reads as skin)
    body_front = fill(rgb, ska, 2)
    plate = np.ones_like(rgb) * skin_c * 0.97
    A, m = texels('Body', 1024); X, Y, Z = A[..., 0], A[..., 1], A[..., 2]
    zneck = ez - 0.2
    hw = smooth(zneck - 0.03, zneck + 0.03, Z)[..., None]
    vis_body = depth_buffer(['Body'])
    skin_only = fill(rgb, sk & (rgb.mean(-1) > 0.45), 2); face_lo = np.stack([ndi.median_filter(skin_only[..., c], size=25) for c in range(3)], -1); face_lo = ndi.gaussian_filter(face_lo, (10, 10, 0))
    cH = bake('Body', 1024, head_front, face_lo, hm, vis_body, (0.32, 0.72) if FEM else (0.3, 0.62)); # torso / arms / hands from the shirtless 'jeans' look so bare torsos carry the app's abs and arm shading
    rgbJ, alphaJ = load('tee-jeans' if FEM else 'jeans'); gmJ = global_map(alphaJ, BODY + ['G_jeans', 'G_shoes'])
    skJ = skin_mask(rgbJ) & alphaJ; skJ[int(gmJ(0, 0.78)[1]):] = False; skJ = ndi.binary_erosion(skJ, iterations=2)
    cB = bake('Body', 1024, fill(rgbJ, skJ, 2), plate, gmJ, vis_body, (-0.15, 0.3))
    cBody = cH * hw + cB * (1 - hw)
    if FEM:  # under her hair: the back and top of the scalp is hair-dark, so any gap in the shell reads as hair, not skin
        Ab, mb_ = texels('Body', 1024); hcy = np.median(D['Eyes|co'][:, 1]) + 0.08; ezz = D['Eyes|co'][:, 2].mean()
        dk_ = (Ab[..., 2] > ezz + 0.035) & (Ab[..., 1] > hcy) | (Ab[..., 2] > ezz + 0.1) | (Ab[..., 2] > ezz - 0.07) & (Ab[..., 1] > hcy + 0.04)  # nape down to the hairline
        cBody[dk_ & mb_] = np.array([0.06, 0.05, 0.045])
    if not FEM: cBody = np.clip(cBody * WARM, 0, 1)
    save(cBody, 'body')
    hairm = alpha & ~skin_mask(rgb) & (rgb.mean(-1) < 0.42)
    hy = np.where(alpha)[0].min(); hairm[int(eyy) - 8:] = False
    hair_front = fill(rgb, hairm, 1); raw_head = fill(rgb, alpha, 1)
    hr = np.where(hairm.any(1))[0]; top, hl = hr.min(), int(np.percentile(np.where(hairm)[0], 70))
    hair_back = hair_front.copy(); band = hair_front[top + 4:hl]
    for y in range(hl, hair_back.shape[0]): hair_back[y] = band[(y - hl) % max(1, len(band))]
    # hair with alpha: where the app shows skin (hairline / fade), the shell is cut out so the projected forehead shows
    hm_soft = ndi.gaussian_filter(ndi.binary_dilation(hairm, iterations=1).astype(np.float32), 1.0)
    hcol = bake('Hair', 256, raw_head, hair_back, hm, None, (0.55, 0.85))
    A_, m_ = texels('Hair', 256); px_, py_ = hm(A_[..., 0], A_[..., 2]); ff = smooth(0.35, 0.7, -A_[..., 4])
    a_ = sample(hm_soft[..., None], px_, py_)[..., 0]; al = np.clip(1 - ff * (1 - a_), 0, 1)
    _, (iy, ix) = ndi.distance_transform_edt(~m_, return_indices=True); al = al[iy, ix]
    # turnaround sheet: curls live on the Curls mesh; the shell carries a high skin fade (dense stubble at the curl line,
    # thinning to bare skin) as an alpha-tested speckle, near-black under the curls. Procedural, 1024 px.
    A_, m_ = texels('Hair', 1024); Z_, Y_ = A_[..., 2], A_[..., 1]; zz = Z_[m_]; yy = Y_[m_]
    sp_ = float(D['Hair|span'][0]) if 'Hair|span' in D else zz.max() - zz.min(); f_ = (Z_ - (zz.max() - sp_)) / max(1e-4, sp_);  # f_ anchored at the crown (the shell below the fade is cut)
    ny_ = (Y_ - (yy.min() + yy.max()) / 2) / max(1e-4, (yy.max() - yy.min()) / 2)
    cl_ = 0.6 - 0.3 * smooth(-0.25, -0.75, ny_)
    rs = np.random.RandomState(5); nz_ = ndi.gaussian_filter(rs.rand(1024, 1024), 0.8); nz_ = (np.argsort(np.argsort(nz_.ravel())).reshape(nz_.shape) + 0.5) / nz_.size  # rank -> uniform
    dens = 0.92 * smooth(0.0, 1.0, np.clip((f_ - 0.1) / np.maximum(cl_ - 0.1, 1e-3), 0, 1)) ** 2.0 * (1 - smooth(-0.5, -0.7, ny_))
    over = f_ >= cl_ - 0.015
    # colour fade (reads at any distance, mips can't wash it out): skin -> stubble -> near-black; speckled alpha only at the bottom edge
    al = np.where(over | (f_ > 0.1), 1.0, 0.0).astype(np.float32)  # colour fade all the way down: skin-tone scalp -> dark stubble -> curls; only the very rim is cut
    g_ = 0.05 + 0.03 * rs.rand(1024, 1024); dark = np.dstack([g_ * 1.15, g_, g_ * 0.92])
    skinT = np.clip(skin_c * 1.12, 0, 1) * (0.94 + 0.06 * rs.rand(1024, 1024))[..., None]
    stub = np.clip(dens + (nz_ - 0.5) * 0.25, 0, 1)[..., None] ** 0.7
    hcol = np.where(over[..., None], dark, skinT * (1 - stub) + dark * 1.6 * stub)
    if FEM:  # sleek pulled-back hair: opaque, near-black with fine combed streaks
        st2 = ndi.gaussian_filter(rs.rand(1024, 1024), (0.6, 6)); st2 = (st2 - st2.mean()) / (st2.std() + 1e-6)
        g2 = np.clip(0.06 + 0.018 * st2, 0.02, 0.12); hcol = np.dstack([g2 * 1.2, g2, g2 * 0.9]); al = np.ones_like(al)
    dd_, (iy, ix) = ndi.distance_transform_edt(~m_, return_indices=True); al = al[iy, ix] * (dd_ <= 3); hcol = hcol[iy, ix]
    if not FEM: lowf = (f_[iy, ix] < 0.1); al[lowf] = 0  # alpha never bleeds far: slivers at the nape stay clear
    Image.fromarray((np.dstack([np.clip(hcol, 0, 1), al]) * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'hair.webp'), quality=92, method=6, exact=True)
    save(bake('Eyes', 128, rgb, rgb, hm, None, (-1, -0.5)), 'eyes')
    # shoes: below the jeans hem, not denim/skin
    blue = (rgb[..., 2] > rgb[..., 0] + 0.04) & alpha
    sh = alpha & ~blue & ~sk; sh[:int(gm(0, 0.12)[1])] = False
    shoe_front = fill(rgb, sh, 2); csh = bake('G_shoes', 512, shoe_front, shoe_front, gm, None, (-1, -0.5))
    # trainer detail (sheet close-up): matte black upper, grey panel stitching, light-grey laces across the instep, rubber toe band
    As, ms_ = texels('G_shoes', 512); X_, Y_, Z_, NZ_ = As[..., 0], As[..., 1], As[..., 2], As[..., 5]
    csh = csh * 0.0 + np.array([0.07, 0.07, 0.075]); zmn = Z_[ms_].min(); ht_ = Z_ - zmn
    for sx in (-1, 1):
        sel_ = ms_ & (X_ * sx > 0); cxs_ = np.median(X_[sel_]); ys_ = Y_[sel_]; y0s, y1s = np.percentile(ys_, 3), np.percentile(ys_, 97)
        inst = sel_ & (NZ_ > 0.45) & (np.abs(X_ - cxs_) < 0.022) & (Y_ < y0s + (y1s - y0s) * 0.62) & (Y_ > y0s + (y1s - y0s) * 0.22) & (ht_ > 0.05)
        lace = inst & (np.mod((Y_ - y0s) / 0.011, 1.0) < 0.42); csh[lace] = np.array([0.72, 0.72, 0.74]); csh[inst & ~lace] = np.array([0.03, 0.03, 0.035])
        stitch = sel_ & (np.abs(np.mod(ht_ / 0.028, 1.0) - 0.5) < 0.05) & (ht_ < 0.1); csh[stitch] = np.array([0.2, 0.2, 0.21])
        toe = sel_ & (Y_ < y0s + (y1s - y0s) * 0.12) & (ht_ < 0.05); csh[toe] = np.array([0.13, 0.13, 0.135])
    csh[~ms_] = 0.07; save(csh, 'shoes')
    json.dump({'global': vars(gm), 'head': vars(hm)}, open(DBG + '/maps.json', 'w'))
    # ---- every wardrobe garment from its own app render ----
    import re
    src = open(os.path.join(os.path.dirname(__file__), '..', 'src', 'crew.js')).read()
    items = re.findall(r"W\('([\w-]+)', '[^']*', '(\w+)', \d+, '[\w-]+', '([\w-]+)', (?:'[\w-]+'|null), '#[0-9a-f]+', '(\w+)'\)", src)
    only = sys.argv[1:]
    for iid, slot, look, kind in items:
        if only and iid not in only: continue
        V5D = '/workspace/rr-' + ('female' if FEM else 'male') + '-v5/'
        if V5 and V5F.get(iid):  # v5: per-gender garment-only RGBA over the fixed base -> exact garment mask, no colour classification
            bi = np.array(Image.open(V5D + 'base.png').convert('RGBA')).astype(np.float32) / 255.0; gi = np.array(Image.open(V5D + 'garments/' + V5F[iid] + '.png').convert('RGBA')).astype(np.float32) / 255.0
            ga = gi[..., 3:4]; rgb = gi[..., :3] * ga + bi[..., :3] * (1 - ga); alpha = (bi[..., 3] > 0.5) | (ga[..., 0] > 0.5); v5mask = ga[..., 0] > 0.5
        else:
            if not os.path.exists(L + look + '.png'): print('no look', look); continue
            rgb, alpha = load(look); v5mask = None
        kind = 'crop' if iid == 'see-me-crop' else kind
        kind = {'manager-shorts': 'shortsL', 'rawdawg-shorts': 'shortsL', 'artillery': 'pantsW', 'rcklstv-jersey': 'jersey', 'distress-shirt': 'teeD'}.get(iid, kind)  # v5 cut variants (crew.js M3)
        gname = 'G_' + kind
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
        cls = v5mask if v5mask is not None else classify(rgb, alpha, core, skr)
        gmask = cls & box
        lab, nl = ndi.label(gmask); cc = np.bincount(lab[core & gmask].ravel(), minlength=nl + 1); cc[0] = 0
        if nl and cc.sum() == 0: cc = np.bincount(lab.ravel(), minlength=nl + 1); cc[0] = 0   # core patch missed the garment (e.g. a logo hole): fall back to component size
        if nl: gmask = np.isin(lab, np.where(cc > 0.02 * cc.sum())[0])
        if slot == 'legs': gmask[int(gm(0, 0.1)[1]):] = False  # shoes
        else: gmask[:max(0, int(gm(0, z1 + 0.02)[1]))] = False   # clamp: a hood-up top reaches the image top (negative index wiped the mask)
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
