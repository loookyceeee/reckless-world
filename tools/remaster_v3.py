"""Fix the male neck-silhouette notch, then remaster every v5 layer to 1080x1440
with premultiplied 4x supersampling (Lanczos up, area down) so edges AA cleanly
and there is no light fringe.

OLD male-only 2x was: premultiplied `over()` of 540 layers, then a straight
Lanczos resize of the *composite* to 1080x1440. We match that idea properly:
premultiply, 4x, downsample to 2x, then un-premultiply. The neck blotch itself
is a coverage hole in the v5 (and v4) body, not a 3D cover mask.
"""
from __future__ import annotations
from pathlib import Path
import numpy as np
from PIL import Image
import cv2
from scipy.interpolate import UnivariateSpline
from scipy import ndimage as ndi

ROOT = Path('/workspace/reckless-world/avatar-quality-pass')
OUT = ROOT / 'selector-2x'
PREV = ROOT / 'work2' / 'previews'
PREV.mkdir(parents=True, exist_ok=True)

# Male right-neck notch in 540 space (inclusive).
NOTCH_Y = (161, 183)
# Rows used to fit the healthy silhouette (540 space).
FIT_Y = list(range(150, 161)) + list(range(184, 230))
NECK_X = (250, 380)


def load(p):
    return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32)


def save(im, p, optimize=True):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(np.round(im), 0, 255).astype(np.uint8), 'RGBA').save(p, optimize=optimize)


def right_edge(alpha, y, x0, x1, thr=80):
    row = alpha[y, x0:x1]
    xs = np.flatnonzero(row >= thr)
    return None if len(xs) == 0 else int(x0 + xs[-1])


def fit_right_edge(alpha, fit_ys, x0, x1, y_eval, thr=80):
    xs, ys = [], []
    for y in fit_ys:
        if y < 0 or y >= alpha.shape[0]:
            continue
        x = right_edge(alpha, y, x0, x1, thr)
        if x is not None:
            ys.append(y); xs.append(x)
    ys, xs = np.array(ys, float), np.array(xs, float)
    if len(ys) < 6:
        return None
    # light smoothing
    spl = UnivariateSpline(ys, xs, s=max(len(ys) * 0.4, 2), k=3)
    return spl(np.asarray(y_eval, float))


def luma(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def is_skin(px):
    """px: (..., 4) or (3,) float 0-255."""
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    a = px[..., 3] if px.shape[-1] == 4 else np.full(r.shape, 255.0)
    L = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return (a > 80) & (L > 60) & (r > b + 2) & (r > g - 4)


def fix_male_neck(img540):
    """Restore the notched right-neck silhouette on a 540x720 RGBA float image.
    Returns a copy.
    """
    out = img540.copy()
    H, W = out.shape[:2]
    a = out[..., 3]
    x0, x1 = NECK_X
    y0n, y1n = NOTCH_Y
    ys = np.arange(y0n, y1n + 1)
    pred = fit_right_edge(a, FIT_Y, x0, x1, ys, thr=80)
    if pred is None:
        print('  no edge fit'); return out

    # Healthy skin samples just inside the good edge, below the notch, for colour.
    samples = []
    for y in range(184, 210):
        x = right_edge(a, y, x0, x1, 80)
        if x is None:
            continue
        for k in range(4, 14):
            xx = x - k
            if xx < x0:
                continue
            if is_skin(out[y, xx]):
                samples.append(out[y, xx, :3])
    if not samples:
        print('  no skin samples'); return out
    samples = np.array(samples)

    # Also gather a local colour field from the front/centre of the neck (healthy).
    # Inpaint mask at 540: missing coverage + bluish/grey blotch in the notch band.
    mask = np.zeros((H, W), np.uint8)
    for y, xt in zip(ys, pred):
        y = int(y)
        xt = float(xt)
        x_cur = right_edge(a, y, x0, x1, 40)
        # mark from a little inside the current (bad) edge out to the target
        left = int(np.floor(xt)) - 8
        if x_cur is not None:
            left = min(left, x_cur - 2)
        left = max(x0, left)
        right = min(x1 - 1, int(np.ceil(xt)) + 1)
        # blotch + hole
        for x in range(left, right + 1):
            px = out[y, x]
            bad_color = (px[3] > 20) and (px[2] > px[0] + 2 or (abs(px[0] - px[1]) < 8 and abs(px[1] - px[2]) < 10 and px[0] < 190))
            missing = px[3] < 80 and x <= xt
            if bad_color or missing:
                mask[y, x] = 255

    # dilate slightly so inpaint has a clean margin
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)
    # don't inpaint the collar / dark garment or the background far outside
    L = luma(out[..., :3])
    mask[(out[..., 3] > 80) & (L < 50)] = 0  # keep dark garment
    # clear mask left of the neck interior (don't touch the face centre)
    mask[:, :270] = 0
    mask[:150] = 0
    mask[230:] = 0

    # First extend coverage to the target silhouette with a temporary fill,
    # so inpaint has a region to work in rather than empty alpha.
    for y, xt in zip(ys, pred):
        y = int(y)
        x_cur = right_edge(a, y, x0, x1, 80)
        # representative interior colour for this row (from left of notch, if skin)
        src = None
        if x_cur is not None:
            for k in range(8, 24):
                xx = x_cur - k
                if xx >= 0 and is_skin(out[y, xx]):
                    src = out[y, xx].copy(); break
        if src is None and len(samples):
            src = np.r_[np.median(samples, 0), 255.0]
        if src is None:
            continue
        # fill out to xt
        x_start = 0 if x_cur is None else x_cur
        for x in range(x_start, int(np.floor(xt)) + 1):
            if out[y, x, 3] < 80 or mask[y, x]:
                out[y, x] = src
                mask[y, x] = 255  # will be smoothed by inpaint
        # AA: partial alpha at the fractional edge
        frac = xt - np.floor(xt)
        xe = int(np.floor(xt)) + 1
        if 0 <= xe < W:
            out[y, xe, :3] = src[:3]
            out[y, xe, 3] = max(out[y, xe, 3], frac * 255.0)
            # clear anything past the AA pixel that we shouldn't keep
            out[y, xe + 1:x1, :] = 0

    # cv2 inpaint on RGB of the filled region, using surrounding healthy skin
    rgb8 = np.clip(out[..., :3], 0, 255).astype(np.uint8)
    if mask.any():
        rgb8 = cv2.inpaint(rgb8, mask, 5, cv2.INPAINT_TELEA)
        # only apply inpainted colour where we marked, keep alpha as built
        m = mask.astype(bool)
        out[..., :3][m] = rgb8[m].astype(np.float32)
        # full alpha inside the silhouette except the AA column
        for y, xt in zip(ys, pred):
            y = int(y)
            out[y, x0:int(np.floor(xt)), 3] = np.maximum(out[y, x0:int(np.floor(xt)), 3], 255)
            # but don't force alpha on true background left of the neck — only from an interior skin start
            # (x0 may include empty space to the right of the head). Restore zeros left of first skin.
            skin_xs = np.flatnonzero(is_skin(out[y, x0:x1]))
            # leave as is; the neck is solid in this x range once we hit skin.

    n = int(mask.sum())
    print(f'  neck mask px={n} target edges y{y0n}-{y1n}: {np.round(pred,1)[:5]}..{np.round(pred,1)[-5:]}')
    return out, mask


def resize_premult(im, size, up=True):
    """Premultiply, resize, return straight RGBA float 0-255 (still premult-internal during resize).
    `up` True -> Lanczos; False (downsample) -> area.
    """
    a = np.clip(im[..., 3:4] / 255.0, 0, 1)
    rgb = im[..., :3] * a  # 0-255 premult
    interp = cv2.INTER_LANCZOS4 if up else cv2.INTER_AREA
    rgb_r = cv2.resize(rgb, size, interpolation=interp)
    a_r = cv2.resize(a[..., 0], size, interpolation=interp)
    a_r = np.clip(a_r, 0, 1)
    # unpremultiply
    out = np.zeros(a_r.shape + (4,), np.float32)
    m = a_r > 1e-4
    out[..., 3] = a_r * 255.0
    out[..., 0][m] = rgb_r[..., 0][m] / a_r[m]
    out[..., 1][m] = rgb_r[..., 1][m] / a_r[m]
    out[..., 2][m] = rgb_r[..., 2][m] / a_r[m]
    # transparent pixels stay 0,0,0,0 — no fringe
    return np.clip(out, 0, 255)


def remaster_layer(src540, fix_neck=False):
    im = load(src540)
    mask = None
    if fix_neck:
        im, mask = fix_male_neck(im)
    # 540 -> 4x (2160x2880) premult Lanczos, then area down to 1080x1440
    up = resize_premult(im, (2160, 2880), up=True)
    down = resize_premult(up, (1080, 1440), up=False)
    return down, (im if fix_neck else None), mask


def nn_preview(im, box, s=4):
    x0, y0, x1, y1 = box
    crop = np.clip(im[y0:y1, x0:x1], 0, 255).astype(np.uint8)
    return Image.fromarray(crop).resize(((x1 - x0) * s, (y1 - y0) * s), Image.Resampling.NEAREST)


def main():
    # --- 1) Preview the neck fix at 540 on upper-body and upper-tee ---
    for name in ('upper-body.png', 'upper-tee.png'):
        src = Path(f'/workspace/rr-male-v5/layers/{name}')
        im = load(src)
        fixed, mask = fix_male_neck(im)
        save(fixed, PREV / f'male_{name}')
        Image.fromarray(mask).save(PREV / f'male_{Path(name).stem}_mask.png')
        # before/after neck on dark
        def on_dark(a):
            bg = np.zeros((720, 540, 3), np.float32)
            al = a[..., 3:4] / 255.0
            return a[..., :3] * al + bg * (1 - al)
        box = (250, 155, 370, 250)
        b = nn_preview(on_dark(im), box, 5)
        a = nn_preview(on_dark(fixed), box, 5)
        side = Image.new('RGB', (b.size[0] * 2 + 8, b.size[1]), (0, 0, 0))
        side.paste(b, (0, 0)); side.paste(a, (b.size[0] + 8, 0))
        side.save(PREV / f'male_{Path(name).stem}_neck_ba.png')
        print('preview', name)

    # --- 2) Remaster all layers both sexes ---
    for sex in ('male', 'female'):
        srcdir = Path(f'/workspace/rr-{sex}-v5/layers')
        dest = OUT / sex
        dest.mkdir(parents=True, exist_ok=True)
        # fix upper-body first so we can copy the neck onto other uppers
        body_fixed_540 = None
        for name in ['upper-body.png'] + sorted(p.name for p in srcdir.glob('*.png') if p.name != 'upper-body.png'):
            src = srcdir / name
            do_neck = (sex == 'male') and name.startswith('upper-')
            print(f'remaster {sex}/{name} neck={do_neck}', flush=True)
            if do_neck and name == 'upper-body.png':
                down, fixed540, _ = remaster_layer(src, fix_neck=True)
                body_fixed_540 = fixed540
            elif do_neck and body_fixed_540 is not None:
                # copy repaired neck skin from the fixed body into this upper layer (540), then remaster
                im = load(src)
                # region: the notch band and a margin
                y0, y1, x0, x1 = 150, 230, 250, 380
                src_px = body_fixed_540[y0:y1, x0:x1]
                dst_px = im[y0:y1, x0:x1]
                Ldst = luma(dst_px[..., :3])
                # Overwrite any non-garment pixel (empty, skin, AND the bluish
                # neck blotch). The earlier "skin-like" test skipped blotch
                # pixels because they have B > R, so the tee kept the notch.
                is_garment = (dst_px[..., 3] > 80) & (Ldst < 50)
                copy = (src_px[..., 3] > 40) & ~is_garment
                dst_px = dst_px.copy()
                dst_px[copy] = src_px[copy]
                # Clear leftover blotch just outside the repaired silhouette.
                # The body edge is slightly inside the old plateau, so uncopied
                # tee pixels (light/blue, mid-alpha) remastered into a white fleck.
                yy = np.arange(y0, y1)[:, None]
                in_notch = (yy >= 161) & (yy <= 183)
                leftover = in_notch & (src_px[..., 3] <= 40) & ~is_garment & (dst_px[..., 3] > 0)
                dst_px[leftover] = 0
                im[y0:y1, x0:x1] = dst_px
                # temp save and remaster without a second geometric pass
                tmp = PREV / f'_tmp_{sex}_{name}'
                save(im, tmp)
                down, _, _ = remaster_layer(tmp, fix_neck=False)
                tmp.unlink()
            else:
                down, _, _ = remaster_layer(src, fix_neck=False)
            save(down, dest / name)
            print(f'  wrote {dest/name} { (dest/name).stat().st_size }', flush=True)

    # starter composites for preview
    def over(a, b):
        a = a.astype(np.float32); b = b.astype(np.float32)
        ab = b[..., 3:] / 255.0; aa = a[..., 3:] / 255.0
        oa = ab + aa * (1 - ab)
        out = np.empty_like(a)
        out[..., :3] = (b[..., :3] * ab + a[..., :3] * aa * (1 - ab)) / np.maximum(oa, 1e-6)
        out[..., 3:] = oa * 255
        return out

    for sex in ('male', 'female'):
        lo = load(OUT / sex / 'lower-jeans.png')
        up = load(OUT / sex / 'upper-tee.png')
        c = over(lo, up)
        save(c, PREV / f'{sex}_starter_2x.png')
        # crops
        s = 2  # already 2x canvas; crop 540-space boxes * 2
        def crop(box, tag):
            x0, y0, x1, y1 = box
            Image.fromarray(np.clip(c[y0*s:y1*s, x0*s:x1*s], 0, 255).astype(np.uint8)).save(PREV / f'{sex}_{tag}.png')
        crop((200, 165, 360, 290), 'neck')
        crop((60, 400, 210, 560), 'handL')
        crop((330, 400, 490, 560), 'handR')
        crop((140, 300, 400, 440), 'hem')
        print('composites', sex)


if __name__ == '__main__':
    main()
