#!/bin/sh
# Build + compress the crew avatar: Blender build -> resample/prune/dedup/meshopt -> public/models/avatar.glb.json
set -e
B=/workspace/tools/blender-4.2.9-linux-x64/blender; G="npx -y @gltf-transform/cli@4"
$B -b --python tools/blender/build_avatar.py -- /tmp/av_raw.glb >/dev/null 2>&1
$G resample /tmp/av_raw.glb /tmp/av_1.glb >/dev/null; $G prune /tmp/av_1.glb /tmp/av_2.glb >/dev/null; $G dedup /tmp/av_2.glb /tmp/av_3.glb >/dev/null
$G meshopt /tmp/av_3.glb /tmp/av_4.glb && cp /tmp/av_4.glb public/models/avatar.glb.json
