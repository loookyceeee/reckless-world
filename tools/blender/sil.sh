# usage: sil.sh glb tag  -> .scratch/sh/sil_<tag>.jpg (app | ours | overlay) for body and tee-jeans, front + side
B=/workspace/tools/blender-4.2.9-linux-x64/blender; G=$1
$B -b --python /tmp/prev2.py -- $G /tmp/rwx/s_body.png G_briefs,G_shoes 0 idle >/dev/null 2>&1 &
$B -b --python /tmp/prev2.py -- $G /tmp/rwx/s_tee.png G_tee,G_jeans,G_shoes 0 idle >/dev/null 2>&1 &
$B -b --python /tmp/prev2.py -- $G /tmp/rwx/s_side.png G_tee,G_jeans,G_shoes 90 idle >/dev/null 2>&1 &
wait
python3 - $2 <<'PY'
import sys
from PIL import Image, ImageChops, ImageFilter
import numpy as np
L='/workspace/rr-ios-src/assets/content/avatar3d/looks/'
def norm(im):
    a=np.array(im)[...,3]; ys,xs=np.where(a>128); box=(xs.min(),ys.min(),xs.max()+1,ys.max()+1); c=im.crop(box); h=680; w=int(c.width*h/c.height); c=c.resize((w,h))
    out=Image.new('RGBA',(540,720),(0,0,0,0)); out.paste(c,(270-w//2,20),c); return out
def edge(im,col):
    a=Image.fromarray(((np.array(im)[...,3]>128)*255).astype('uint8')); e=ImageChops.difference(a.filter(ImageFilter.MaxFilter(3)),a.filter(ImageFilter.MinFilter(3)))
    o=Image.new('RGBA',im.size,col); o.putalpha(e); return o
rows=[]
for app,ours in (('body.png','s_body.png'),('tee-jeans.png','s_tee.png')):
    A=norm(Image.open(L+app).convert('RGBA')); O=norm(Image.open('/tmp/rwx/'+ours).convert('RGBA'))
    bg=lambda: Image.new('RGBA',(540,720),(45,45,50,255))
    a=bg(); a.alpha_composite(A); o=bg(); o.alpha_composite(O); ov=bg(); ov.alpha_composite(A); ov.alpha_composite(edge(O,(0,255,120,255)))
    r=Image.new('RGB',(1620,720)); r.paste(a.convert('RGB'),(0,0)); r.paste(o.convert('RGB'),(540,0)); r.paste(ov.convert('RGB'),(1080,0)); rows.append(r)
S=norm(Image.open('/tmp/rwx/s_side.png').convert('RGBA')); sb=Image.new('RGBA',(540,720),(45,45,50,255)); sb.alpha_composite(S)
W=Image.new('RGB',(2160,1440)); W.paste(rows[0],(0,0)); W.paste(rows[1],(0,720)); W.paste(sb.convert('RGB'),(1620,0))
W.resize((1440,960)).save('/workspace/reckless-world/.scratch/sh/sil_'+sys.argv[1]+'.jpg',quality=85)
PY
