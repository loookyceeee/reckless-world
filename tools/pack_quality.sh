#!/bin/sh
# Rebuild and pack both crew avatars for the quality pass. Does not deploy.
set -e
cd "$(dirname "$0")/.."
B=/workspace/tools/blender-4.2.9-linux-x64/blender
G="npx -y @gltf-transform/cli@4"
ENV="TEE2=1 RES_G=2048 RES_BODY=2048 RES_HAIR=2048 RES_EYES=256 AO_RES=1024 AV_GUV=proj AV_BUV_HEAD=3.2 WEBP_Q=88 LEAKFIX=1"
ENV="$ENV SR_CANON=/workspace/reckless-world/avatar-quality-pass/sr/canon"
ENV="$ENV SR_DIR=/workspace/reckless-world/avatar-quality-pass/sr"

pack_one() {
  base="$1"   # male | female
  raw="$2"
  ao="$3"
  out="$4"
  dump="$5"
  texdir="$6"
  log="$7"
  echo "===== BUILD $base ====="
  rm -rf "$ao"
  env $ENV AVB="$base" AV_DUMP="$dump" AO_DIR="$ao" TEX_OUT="$texdir" \
    $B -b --python tools/blender/build_avatar.py -- "$raw" >"$log" 2>&1
  tail -30 "$log"
  mkdir -p "$texdir"
  python3 -c "
import glob,os
from PIL import Image
ao=os.environ['AO']
out=os.environ['TEX']
os.makedirs(out, exist_ok=True)
for f in glob.glob(ao+'/ao_*.png'):
    Image.open(f).convert('L').save(os.path.join(out, os.path.basename(f)[:-4]+'.webp'), quality=88, method=6)
    print('ao', f)
" 
  echo "===== TEE WEIGHTS $base ====="
  python3 tools/xfer_tee_weights.py "$raw" "$raw"
  echo "===== MESHOPT $base ====="
  $G resample "$raw" /tmp/av_${base}_1.glb >/dev/null
  $G prune --keep-attributes true /tmp/av_${base}_1.glb /tmp/av_${base}_2.glb >/dev/null
  # --meshes false: TEE2 gives G_tee and G_teeD identical shells; mesh dedup would merge them.
  $G dedup --meshes false /tmp/av_${base}_2.glb /tmp/av_${base}_3.glb >/dev/null
  $G meshopt /tmp/av_${base}_3.glb /tmp/av_${base}_4.glb
  cp /tmp/av_${base}_4.glb "$out"
  echo "wrote $out"
  echo "===== BAKE TEX $base ====="
  env $ENV AVB="$base" AV_DUMP="$dump" TEX_OUT="$texdir" python3 tools/bake_avatar_tex.py
}

# AO converter needs AO and TEX
export AO=/tmp/ao_m TEX=public/models/tex
pack_one male /tmp/av_raw.glb /tmp/ao_m public/models/avatar.glb.json /tmp/av_dump.npz public/models/tex /tmp/bl_male.log

export AO=/tmp/ao_f TEX=public/models/tex_f
pack_one female /tmp/av_raw_f.glb /tmp/ao_f public/models/avatar_f.glb.json /tmp/av_dump_f.npz public/models/tex_f /tmp/bl_female.log

echo "===== 1K COPIES ====="
python3 /workspace/reckless-world/avatar-quality-pass/tools/make_1k.py
echo DONE
