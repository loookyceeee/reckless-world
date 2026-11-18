"""Contact sheet: app render | in-game (headless Babylon snap, front) for all 23 wardrobe pieces -> shots/pass5/wardrobe_sheet.jpg
Run /tmp/wsgame.sh-style snaps first (tools/snap.mjs with __rw.fitRaw per item -> /tmp/rwx/wg_<id>.png)."""
import re, sys
from PIL import Image, ImageDraw
import numpy as np
G = '/workspace/reckless-world/game'; L = '/workspace/reckless-world/avatar-refs/canonical-looks/'
src = open(G + '/src/crew.js').read()
items = re.findall(r"W\('([\w-]+)', '([^']*)', '(\w+)', \d+, '[\w-]+', '([\w-]+)', ('[\w-]+'|null), '#[0-9a-f]+', '(\w+)'\)", src)
H = 340
def app(im):
    a = np.array(im)[..., 3]; ys, xs = np.where(a > 128); c = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)); w = int(c.width * (H - 10) / c.height); c = c.resize((w, H - 10), Image.LANCZOS)
    o = Image.new('RGBA', (240, H), (58, 58, 62, 255)); o.alpha_composite(c, (120 - w // 2, 5)); return o.convert('RGB')
def game(im):  # centre crop around the player
    w, h = im.size; c = im.crop((int(w * 0.18), int(h * 0.04), int(w * 0.82), int(h * 0.96))); return c.resize((240, H), Image.LANCZOS)
cells = []
for iid, name, slot, look, wj, kind in items:
    ref = look if (slot == 'legs' or wj == 'null') else wj.strip("'")
    c = Image.new('RGB', (480, H + 22), (16, 16, 18)); c.paste(app(Image.open(L + ref + '.png').convert('RGBA')), (0, 0)); c.paste(game(Image.open(f'/tmp/rwx/wg_{iid}.png').convert('RGB')), (240, 0))
    ImageDraw.Draw(c).text((8, H + 5), f'{name}  ({slot}/{kind})      APP  |  IN-GAME', fill=(255, 255, 255)); cells.append(c)
cols = 4; rows = (len(cells) + cols - 1) // cols
S = Image.new('RGB', (480 * cols, (H + 22) * rows), (0, 0, 0))
for i, c in enumerate(cells): S.paste(c, ((i % cols) * 480, (i // cols) * (H + 22)))
out = sys.argv[1] if len(sys.argv) > 1 else '/workspace/reckless-world/shots/pass5/wardrobe_sheet.jpg'
S.save(out, quality=86); print('sheet', S.size, out)
