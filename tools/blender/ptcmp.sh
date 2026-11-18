# usage: ptcmp.sh tag look mapjson
B=/workspace/tools/blender-4.2.9-linux-x64/blender; cd /workspace/reckless-world/game
for ang in 0 180; do $B -b --python tools/blender/prev_tex.py -- /tmp/av_raw.glb /tmp/rwx/pt_$ang.png $ang ${MODE:-flat} public/models/tex "$3" >/dev/null 2>&1; done
python3 - $1 $2 <<'PY'
import sys
from PIL import Image
import numpy as np
L='/workspace/reckless-world/avatar-refs/canonical-looks/'
def norm(im):
    a=np.array(im)[...,3]; ys,xs=np.where(a>128); c=im.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1)); h=680; w=int(c.width*h/c.height); c=c.resize((w,h))
    o=Image.new('RGBA',(540,720),(60,60,64,255)); o.alpha_composite(c,(270-w//2,20)); return o.convert('RGB')
ims=[norm(Image.open(L+sys.argv[2]+'.png').convert('RGBA')), norm(Image.open('/tmp/rwx/pt_0.png').convert('RGBA')), norm(Image.open('/tmp/rwx/pt_180.png').convert('RGBA'))]
W=Image.new('RGB',(1620,720)); [W.paste(im,(i*540,0)) for i,im in enumerate(ims)]; W.save('/workspace/reckless-world/.scratch/sh/pt_'+sys.argv[1]+'.jpg',quality=88)
f=[im.crop((170,20,370,220)).resize((300,300)) for im in ims[:2]]; F=Image.new('RGB',(600,300)); F.paste(f[0],(0,0)); F.paste(f[1],(300,0)); F.save('/workspace/reckless-world/.scratch/sh/ptf_'+sys.argv[1]+'.jpg')
PY
