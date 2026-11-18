"""Bake Quaternius Universal Animation Library (CC0) clips onto the RECKLESS avatar skeleton.
Run: blender -b --python export_anims.py -- out.json
Retarget = world-space rotation deltas from the UAL rest pose, corrected for our A-pose rest (swing), then converted to
local bone rotations in Babylon (left-handed, Y-up, +Z forward) space."""
import bpy, sys, json, math
from mathutils import Matrix, Vector, Quaternion
OUT = sys.argv[sys.argv.index('--') + 1]
UAL = "/workspace/reckless-world/research/assets/quaternius/universal-animation-library/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"
CLIPS = {'idle': 'Idle_Loop', 'walk': 'Walk_Loop', 'jog': 'Jog_Fwd_Loop', 'run': 'Sprint_Loop', 'dance': 'Dance_Loop', 'talk': 'Idle_Talking_Loop'}
MAP = {'hips': 'pelvis', 'spine': 'spine_01', 'chest': 'spine_03', 'neck': 'neck_01', 'head': 'Head',
       'upperArmL': 'upperarm_l', 'foreArmL': 'lowerarm_l', 'handL': 'hand_l', 'upperArmR': 'upperarm_r', 'foreArmR': 'lowerarm_r', 'handR': 'hand_r',
       'thighL': 'thigh_l', 'shinL': 'calf_l', 'footL': 'foot_l', 'thighR': 'thigh_r', 'shinR': 'calf_r', 'footR': 'foot_r'}
PARENT = {'hips': None, 'spine': 'hips', 'chest': 'spine', 'neck': 'chest', 'head': 'neck', 'upperArmL': 'chest', 'foreArmL': 'upperArmL', 'handL': 'foreArmL',
          'upperArmR': 'chest', 'foreArmR': 'upperArmR', 'handR': 'foreArmR', 'thighL': 'hips', 'shinL': 'thighL', 'footL': 'shinL', 'thighR': 'hips', 'shinR': 'thighR', 'footR': 'shinR'}
# our rest bone directions (Babylon coords), from character.js joint table
J = {'hips': (0, .60, 0), 'spine': (0, .72, 0), 'chest': (0, .86, 0), 'neck': (0, 1.04, 0), 'head': (0, 1.10, 0),
     'upperArmL': (-.2, .99, 0), 'foreArmL': (-.24, .74, 0), 'handL': (-.26, .52, .01), 'upperArmR': (.2, .99, 0), 'foreArmR': (.24, .74, 0), 'handR': (.26, .52, .01),
     'thighL': (-.085, .58, 0), 'shinL': (-.09, .32, .005), 'footL': (-.092, .075, 0), 'thighR': (.085, .58, 0), 'shinR': (.09, .32, .005), 'footR': (.092, .075, 0)}
CHILD = {'hips': 'spine', 'spine': 'chest', 'chest': 'neck', 'neck': 'head', 'upperArmL': 'foreArmL', 'foreArmL': 'handL', 'upperArmR': 'foreArmR', 'foreArmR': 'handR', 'thighL': 'shinL', 'shinL': 'footL', 'thighR': 'shinR', 'shinR': 'footR'}
def mydir(b):
    if b in CHILD: a, c = Vector(J[b]), Vector(J[CHILD[b]]); return (c - a).normalized()
    return {'head': Vector((0, 1, 0)), 'handL': Vector((-0.05, -1, 0.02)).normalized(), 'handR': Vector((0.05, -1, 0.02)).normalized(), 'footL': Vector((0, 0, 1)), 'footR': Vector((0, 0, 1))}[b]
M = Matrix(((-1, 0, 0), (0, 0, 1), (0, -1, 0)))  # Blender (-Y fwd, Z up, +X = char left) -> Babylon (+Z fwd, Y up, +X = char right)
Mi = M.inverted()
def tob(R): return M @ R @ Mi
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=UAL)
arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
AW = arm.matrix_world.to_3x3()
# glTF edit-bone rest is not the T-pose; use the A_TPose clip as reference pose instead
arm.animation_data_create(); arm.animation_data.action = bpy.data.actions['A_TPose_Armature']
bpy.context.scene.frame_set(int(bpy.data.actions['A_TPose_Armature'].frame_range[0]))
rest = {b: tob((arm.matrix_world @ arm.pose.bones[MAP[b]].matrix).to_3x3().normalized()) for b in MAP}
def _head(n): return M @ (arm.matrix_world @ arm.pose.bones[n].head)
_TIP = {'head': None, 'handL': 'middle_01_l', 'handR': 'middle_01_r', 'footL': 'ball_l', 'footR': 'ball_r'}
restdir = {}
for b in MAP:
    if b in CHILD: restdir[b] = (_head(MAP[CHILD[b]]) - _head(MAP[b])).normalized()
    elif _TIP.get(b) and _TIP[b] in arm.pose.bones: restdir[b] = (_head(_TIP[b]) - _head(MAP[b])).normalized()
    else: restdir[b] = mydir(b)
# swing correction C_b: our rest direction -> UAL rest direction (torso bones keep identity so the spine stays upright)
C = {}
for b in MAP:
    if b in ('hips', 'spine', 'chest', 'neck', 'head'): C[b] = Matrix.Identity(3); continue
    C[b] = mydir(b).rotation_difference(restdir[b]).to_matrix()
pel_rest = M @ (arm.matrix_world @ arm.pose.bones['pelvis'].head)
scale = 0.60 / pel_rest.y
out = {'fps': 30, 'source': 'Quaternius Universal Animation Library (CC0 1.0)', 'bones': list(MAP), 'clips': {}}
scn = bpy.context.scene
for key, name in CLIPS.items():
    act = bpy.data.actions.get(name + '_Armature') or bpy.data.actions.get(name)
    if not act: print('missing', name); continue
    arm.animation_data_create(); arm.animation_data.action = act
    f0, f1 = act.frame_range; dur = (f1 - f0) / 24.0; n = max(2, int(round(dur * 30)))
    frames = []
    for i in range(n):
        f = f0 + (f1 - f0) * i / n; scn.frame_set(int(f), subframe=f - int(f))
        W = {}
        for b in MAP:
            pb = arm.pose.bones[MAP[b]]
            Wt = tob((AW @ (arm.matrix_world.to_3x3().inverted() @ (arm.matrix_world @ pb.matrix).to_3x3())).normalized())
            W[b] = (Wt @ rest[b].inverted()) @ C[b]   # desired world rotation of our bone
        fr = []
        for b in MAP:
            L = W[b] if PARENT[b] is None else W[PARENT[b]].inverted() @ W[b]
            q = L.to_quaternion()
            # Babylon stores row-vector matrices (= L^T) but Quaternion->Matrix also transposes, so q maps 1:1
            fr += [round(q.x, 4), round(q.y, 4), round(q.z, 4), round(q.w, 4)]
        p = M @ (arm.matrix_world @ arm.pose.bones['pelvis'].head)
        d = (p - pel_rest) * scale
        fr += [round(d.x, 4), round(d.y, 4), round(d.z, 4)]
        frames.append(fr)
    out['clips'][key] = {'dur': dur, 'frames': frames}
    print('clip', key, n, 'frames', round(dur, 2), 's')
print('RESTDIRS', {b: [round(v, 2) for v in restdir[b]] for b in ('hips','thighL','upperArmL','footL','handL')}, 'pel', pel_rest)
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print('WROTE', OUT)
