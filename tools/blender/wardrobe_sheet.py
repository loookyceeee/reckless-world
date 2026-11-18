"""Contact sheet: app render vs our textured avatar (front, flat-lit) for every wardrobe piece -> shots/pass5/wardrobe_sheet.jpg"""
import re, json, subprocess, os
from PIL import Image, ImageDraw
import numpy as np
G = '/workspace/reckless-world/game'; L = '/workspace/reckless-world/avatar-refs/canonical-looks/'
B = '/workspace/tools/blender-4.2.9-linux-x64/blender'
src = open(G + '/src/crew.js').read()
items = re.findall(r"W\('([\w-]+)', '([^']*)', '(\w+)', \d+, '[\w-]+', '([\w-]+)', ('[\w-]+'|null), '#[0-9a-f]+', '(\w+)'\)", src)
def norm(im, H=300):
    a = np.array(im)[..., 3]; ys, xs = np.where(a > 128); c = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)); w = int(c.width * (H - 10) / c.height); c = c.resize((w, H - 10))
    o = Image.new('RGBA', (230, H), (58, 58, 62, 255)); o.alpha_composite(c, (115 - w // 2, 5)); return o.convert('RGB')
cells = []
for iid, name, slot, look, wj, kind in items:
    kind = 'crop' if iid == 'see-me-crop' else kind
    M = {'Body': 'body', 'Hair': 'hair', 'Eyes': 'eyes', 'G_shoes': 'shoes', 'G_' + kind: 'g-' + iid}
    ref = look
    if slot != 'legs' and wj != 'null': M['G_jeans'] = 'g-barrel-jeans'; ref = wj.strip("'")
    out = f'/tmp/rwx/ws_{iid}.png'
    subprocess.run([B, '-b', '--python', G + '/tools/blender/prev_tex.py', '--', '/tmp/av_raw.glb', out, '0', 'flat', G + '/public/models/tex', json.dumps(M)], capture_output=True)
    a = norm(Image.open(L + ref + '.png').convert('RGBA')); b = norm(Image.open(out).convert('RGBA'))
    c = Image.new('RGB', (460, 322), (20, 20, 22)); c.paste(a, (0, 0)); c.paste(b, (230, 0)); d = ImageDraw.Draw(c); d.text((6, 304), f'{name}  ({slot}, {kind})  app | game', fill=(255, 255, 255))
    cells.append(c); print('ok', iid)
cols = 4; rows = (len(cells) + cols - 1) // cols
S = Image.new('RGB', (460 * cols, 322 * rows), (0, 0, 0))
for i, c in enumerate(cells): S.paste(c, ((i % cols) * 460, (i // cols) * 322))
os.makedirs('/workspace/reckless-world/shots/pass5', exist_ok=True); S.save('/workspace/reckless-world/shots/pass5/wardrobe_sheet.jpg', quality=85); print('sheet', S.size)
