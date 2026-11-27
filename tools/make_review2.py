"""Build REVIEW2 side-by-sides in /crew stage framing."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

ROOT = Path('/workspace/reckless-world/avatar-quality-pass')
OUT = ROOT / 'REVIEW2'
OUT.mkdir(parents=True, exist_ok=True)
RAW = OUT / 'raw'
RAW.mkdir(exist_ok=True)

def font(size, bold=True):
    path = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    return ImageFont.truetype(path, size)

def compose_layers(lo, up, size=None, resample=Image.Resampling.LANCZOS):
    lo = Image.open(lo).convert('RGBA')
    up = Image.open(up).convert('RGBA')
    if size:
        lo = lo.resize(size, resample)
        up = up.resize(size, resample)
    c = Image.new('RGBA', lo.size, (0, 0, 0, 0))
    c.alpha_composite(lo)
    c.alpha_composite(up)
    return c

def v5_live(sex, resample=Image.Resampling.BILINEAR, size=(1080, 1440)):
    d = Path(f'/workspace/rr-{sex}-v5/layers')
    return compose_layers(d / 'lower-jeans.png', d / 'upper-tee.png', size=size, resample=resample)

def v5_new(sex):
    d = ROOT / 'selector-2x' / sex
    return compose_layers(d / 'lower-jeans.png', d / 'upper-tee.png')

def old_male():
    return Image.open('/workspace/rr-male-v4/male_dressed_front_v4_2x.png').convert('RGBA')

def stage(fig, *, width, height, fig_h_frac=0.94, tag_tl='BASE: MALE', tag_br='SKATE TEE + BARREL JEANS'):
    """A /crew .stage panel at the given pixel size, figure contained at fig_h_frac height, aspect 540/720."""
    img = Image.new('RGB', (width, height), (5, 5, 5))
    # radial gradient: 90% 70% at 50% 45%, #1a1a1a 0, #0c0c0c 60%, #050505 100%
    px = np.zeros((height, width, 3), np.float32)
    yy, xx = np.mgrid[0:height, 0:width]
    cx, cy = width * 0.5, height * 0.45
    rx, ry = width * 0.45, height * 0.35  # 90% / 70% as radii ~ half
    # use an ellipse radius
    r = np.sqrt(((xx - cx) / (width * 0.5)) ** 2 + ((yy - cy) / (height * 0.35)) ** 2)
    # 0 -> #1a1a1a, 0.6 -> #0c0c0c, 1 -> #050505
    c0 = np.array([0x1A, 0x1A, 0x1A], np.float32)
    c1 = np.array([0x0C, 0x0C, 0x0C], np.float32)
    c2 = np.array([0x05, 0x05, 0x05], np.float32)
    t = np.clip(r, 0, 1)[..., None]
    a = np.empty(t.shape[:2] + (3,), np.float32)
    m = t <= 0.6
    mid = t / 0.6
    a = np.where(m, mid * c1 + (1 - mid) * c0, ((t - 0.6) / 0.4) * c2 + (1 - (t - 0.6) / 0.4) * c1)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGB')
    # figure
    fh = int(height * fig_h_frac)
    fw = int(fh * 540 / 720)
    fig_r = fig.convert('RGBA')
    # contain
    fig_r.thumbnail((fw, fh), Image.Resampling.LANCZOS)
    fx = (width - fig_r.size[0]) // 2
    fy = (height - fig_r.size[1]) // 2
    img = img.convert('RGBA')
    img.alpha_composite(fig_r, (fx, fy))
    img = img.convert('RGB')
    d = ImageDraw.Draw(img)
    # border
    d.rectangle((0, 0, width - 1, height - 1), outline=(255, 255, 255, 38))
    # corner ticks 16px, 2px, inset 10
    tick, inset, w = 16, 10, 2
    # tl
    d.rectangle((inset, inset, inset + tick, inset + w), fill='white')
    d.rectangle((inset, inset, inset + w, inset + tick), fill='white')
    # br
    d.rectangle((width - 1 - inset - tick, height - 1 - inset - w, width - 1 - inset, height - 1 - inset), fill='white')
    d.rectangle((width - 1 - inset - w, height - 1 - inset - tick, width - 1 - inset, height - 1 - inset), fill='white')
    # tags
    f = font(max(11, height // 48), True)
    d.text((inset + tick + 8, inset - 1), tag_tl, fill=(200, 200, 200), font=f)
    # bottom right tag
    br = tag_br
    bbox = d.textbbox((0, 0), br, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((width - inset - tick - 8 - tw, height - inset - th - 2), br, fill=(200, 200, 200), font=f)
    return img

def labeled_col(panel, title, subtitle, pad=24):
    w, h = panel.size
    header = 72
    canvas = Image.new('RGB', (w, h + header), (0, 0, 0))
    d = ImageDraw.Draw(canvas)
    d.text((pad, 14), title, fill='white', font=font(28, True))
    if subtitle:
        d.text((pad, 46), subtitle, fill=(160, 160, 160), font=font(13, False))
    canvas.paste(panel, (0, header))
    return canvas

def row(cols, bg=(0, 0, 0), gap=24, pad=32, title='', footer=''):
    widths = [c.size[0] for c in cols]
    heights = [c.size[1] for c in cols]
    header = 70 if title else 16
    footer_h = 48 if footer else 16
    W = pad * 2 + sum(widths) + gap * (len(cols) - 1)
    H = header + max(heights) + footer_h + pad
    canvas = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(canvas)
    if title:
        d.text((pad, 18), title, fill='white', font=font(32, True))
    x = pad
    y = header
    for c in cols:
        canvas.paste(c, (x, y))
        x += c.size[0] + gap
    if footer:
        d.text((pad, H - footer_h + 8), footer, fill=(140, 140, 140), font=font(14, False))
    return canvas

def closeup_strip(images, labels, title, box_scale=1):
    # images already cropped
    h = max(im.size[1] for im in images)
    w = max(im.size[0] for im in images)
    cols = []
    for im, lab in zip(images, labels):
        im = im.convert('RGB')
        if im.size != (w, h):
            bg = Image.new('RGB', (w, h), (12, 12, 12))
            bg.paste(im, ((w - im.size[0]) // 2, (h - im.size[1]) // 2))
            im = bg
        header = 48
        col = Image.new('RGB', (w, h + header), (0, 0, 0))
        d = ImageDraw.Draw(col)
        d.text((12, 12), lab, fill='white', font=font(20, True))
        col.paste(im, (0, header))
        cols.append(col)
    return row(cols, title=title, footer='SAME 540-SPACE CROP ON EVERY COLUMN · NEAREST SCALE · NOTHING IS LIVE')

def main():
    # figures
    old = old_male()
    cur_m = v5_live('male')
    new_m = v5_new('male')
    cur_f = v5_live('female')
    new_f = v5_new('female')
    for name, im in [('old_male', old), ('cur_male', cur_m), ('new_male', new_m), ('cur_female', cur_f), ('new_female', new_f)]:
        im.save(RAW / f'{name}.png')

    # Desktop stages at 2x of ~700x600
    SW, SH = 1400, 1200
    def desk(fig, base):
        return stage(fig, width=SW, height=SH, fig_h_frac=0.94,
                     tag_tl=f'BASE: {base}', tag_br='SKATE TEE + BARREL JEANS')

    old_s = desk(old, 'MALE')
    cur_s = desk(cur_m, 'MALE')
    new_s = desk(new_m, 'MALE')
    cur_fs = desk(cur_f, 'FEMALE')
    new_fs = desk(new_f, 'FEMALE')

    old_c = labeled_col(old_s, 'OLD  ·  MALE-ONLY', 'v4 540 composite, Lanczos to 1080×1440. Same framing as v5.')
    cur_c = labeled_col(cur_s, 'CURRENT LIVE', 'v5 540×720 layers, as the site and app serve them today.')
    new_c = labeled_col(new_s, 'NEW', 'v5 look, neck blotch repaired, 4× premult remaster to 1080×1440. Not live.')
    cur_fc = labeled_col(cur_fs, 'CURRENT LIVE', 'v5 540×720 layers, as the site and app serve them today.')
    new_fc = labeled_col(new_fs, 'NEW', 'v5 look, 4× premult remaster to 1080×1440. Not live.')

    male_desk = row(
        [old_c, cur_c, new_c],
        title='YOUR CREW  ·  DESKTOP  ·  MALE STARTER',
        footer='FRAMING MATCHES /CREW (STAGE HEIGHT 600 CSS PX, FIG 94%, ASPECT 540/720). OLD HAS NO FEMALE. NOTHING IS LIVE.',
    )
    female_desk = row(
        [cur_fc, new_fc],
        title='YOUR CREW  ·  DESKTOP  ·  FEMALE STARTER',
        footer='THE OLD MALE-ONLY SELECTOR HAD NO FEMALE BASE. CURRENT LIVE VS NEW ONLY. NOTHING IS LIVE.',
    )
    male_desk.save(OUT / 'male_desktop.jpg', quality=92, subsampling=0)
    female_desk.save(OUT / 'female_desktop.jpg', quality=92, subsampling=0)
    print('desktop', male_desk.size, female_desk.size)

    # Phone stages at 2x of 390x844 canvas with stage 440 css -> 880 px, fig 84%
    def phone(fig, base, label):
        W, H = 780, 1688  # 2x of 390x844
        canvas = Image.new('RGB', (W, H), (0, 0, 0))
        d = ImageDraw.Draw(canvas)
        d.text((40, 40), 'CREW', fill='white', font=font(48, True))
        # stage at y=140, height 880 (2x 440), width almost full with 16px inset
        st = stage(fig, width=W - 48, height=880, fig_h_frac=0.84,
                   tag_tl=f'BASE: {base}', tag_br='SKATE TEE + BARREL JEANS')
        canvas.paste(st, (24, 140))
        # header label
        banner = Image.new('RGB', (W, 64), (0, 0, 0))
        ImageDraw.Draw(banner).text((24, 18), label, fill='white', font=font(22, True))
        out = Image.new('RGB', (W, H + 64), (0, 0, 0))
        out.paste(banner, (0, 0))
        out.paste(canvas, (0, 64))
        return out

    pm_old = phone(old, 'MALE', 'OLD  ·  MALE-ONLY')
    pm_cur = phone(cur_m, 'MALE', 'CURRENT LIVE')
    pm_new = phone(new_m, 'MALE', 'NEW  ·  NOT LIVE')
    pf_cur = phone(cur_f, 'FEMALE', 'CURRENT LIVE')
    pf_new = phone(new_f, 'FEMALE', 'NEW  ·  NOT LIVE')
    male_phone = row(
        [pm_old, pm_cur, pm_new],
        title='YOUR CREW  ·  PHONE  ·  MALE STARTER',
        footer='STAGE HEIGHT 440 CSS PX, FIG 84%. NOTHING IS LIVE.',
    )
    female_phone = row(
        [pf_cur, pf_new],
        title='YOUR CREW  ·  PHONE  ·  FEMALE STARTER',
        footer='NO OLD FEMALE. NOTHING IS LIVE.',
    )
    male_phone.save(OUT / 'male_phone.jpg', quality=92, subsampling=0)
    female_phone.save(OUT / 'female_phone.jpg', quality=92, subsampling=0)
    print('phone', male_phone.size, female_phone.size)

    # Tight 2x crops (boxes in 540 space, source canvases are 1080x1440).
    # Same XY for OLD / LIVE / NEW — v4_2x is already registered to this frame.
    # Display with integer NEAREST scale so aliasing and the neck blotch stay visible
    # (Lanczos-fitting closeups hid jaggies and made OLD look cleaner than it is).
    def crop(im, box, s=2):
        x0, y0, x1, y1 = box
        return im.crop((x0 * s, y0 * s, x1 * s, y1 * s)).convert('RGB')

    def show(im, scale=3):
        return im.resize((im.size[0] * scale, im.size[1] * scale), Image.Resampling.NEAREST)

    neck_box = (250, 165, 350, 250)
    hands_box = (40, 280, 500, 580)
    handL_box = (50, 400, 200, 560)
    hem_box = (150, 310, 390, 430)

    neck_m = closeup_strip(
        [show(crop(old, neck_box)), show(crop(cur_m, neck_box)), show(crop(new_m, neck_box))],
        ['OLD MALE-ONLY', 'CURRENT LIVE', 'NEW'],
        'MALE  ·  NECK / COLLAR  ·  TIGHT 2x CROP, 3x NEAREST',
    )
    hands_m = closeup_strip(
        [show(crop(old, hands_box), 2), show(crop(cur_m, hands_box), 2), show(crop(new_m, hands_box), 2)],
        ['OLD MALE-ONLY', 'CURRENT LIVE', 'NEW'],
        'MALE  ·  ARMS + HANDS  ·  TIGHT 2x CROP, 2x NEAREST',
    )
    handL_m = closeup_strip(
        [show(crop(old, handL_box)), show(crop(cur_m, handL_box)), show(crop(new_m, handL_box))],
        ['OLD MALE-ONLY', 'CURRENT LIVE', 'NEW'],
        'MALE  ·  LEFT HAND  ·  TIGHT 2x CROP, 3x NEAREST',
    )
    hem_m = closeup_strip(
        [show(crop(old, hem_box), 2), show(crop(cur_m, hem_box), 2), show(crop(new_m, hem_box), 2)],
        ['OLD MALE-ONLY', 'CURRENT LIVE', 'NEW'],
        'MALE  ·  TEE HEM  ·  TIGHT 2x CROP, 2x NEAREST',
    )
    neck_f = closeup_strip(
        [show(crop(cur_f, neck_box)), show(crop(new_f, neck_box))],
        ['CURRENT LIVE', 'NEW'],
        'FEMALE  ·  NECK / COLLAR  ·  TIGHT 2x, 3x NEAREST',
    )
    hands_f = closeup_strip(
        [show(crop(cur_f, hands_box), 2), show(crop(new_f, hands_box), 2)],
        ['CURRENT LIVE', 'NEW'],
        'FEMALE  ·  ARMS + HANDS  ·  TIGHT 2x, 2x NEAREST',
    )
    hem_f = closeup_strip(
        [show(crop(cur_f, hem_box), 2), show(crop(new_f, hem_box), 2)],
        ['CURRENT LIVE', 'NEW'],
        'FEMALE  ·  TEE HEM  ·  TIGHT 2x CROP, 2x NEAREST',
    )

    def jpg(im, name):
        im.save(OUT / name, quality=95, subsampling=0)
        print('wrote', name, im.size)

    jpg(neck_m, 'male_neck_closeup.jpg')
    jpg(hands_m, 'male_hands_closeup.jpg')
    jpg(handL_m, 'male_handL_closeup.jpg')
    jpg(hem_m, 'male_hem_closeup.jpg')
    jpg(neck_f, 'female_neck_closeup.jpg')
    jpg(hands_f, 'female_hands_closeup.jpg')
    jpg(hem_f, 'female_hem_closeup.jpg')
    stacked = Image.new('RGB', (max(hem_m.size[0], hem_f.size[0]), hem_m.size[1] + hem_f.size[1] + 24), (0, 0, 0))
    stacked.paste(hem_m, (0, 0))
    stacked.paste(hem_f, (0, hem_m.size[1] + 24))
    jpg(stacked, 'hem_closeup.jpg')
    print('REVIEW2:', sorted(p.name for p in OUT.glob('*.jpg')))

if __name__ == '__main__':
    main()
