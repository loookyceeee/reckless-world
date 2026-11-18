"""Build the RECKLESS crew avatar as a smooth rigged glTF from CC0 parts (free tools only).
Base: Quaternius Universal Base Characters, Superhero_Male (CC0), on the Universal Animation Library skeleton.
Reshaped to the app's crew render proportions (bigger head, slimmer, youthful); garments are skinned shells
cut from the body by bone region and pushed out along normals, so every Drop 018 piece deforms with the rig.
Animations: Quaternius UAL1 (CC0) idle / walk / jog / sprint / jump / dance, in place.
Run: blender -b --python build_avatar.py -- out.glb"""
import bpy, bmesh, sys, math
from mathutils import Vector
OUT = sys.argv[sys.argv.index('--') + 1]
Q = "/workspace/reckless-world/research/assets/quaternius/"
BASE = Q + "universal-base-characters/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf"
HAIR = Q + "universal-base-characters/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/" + (sys.argv[sys.argv.index('--') + 2] if len(sys.argv) > sys.argv.index('--') + 2 else "Hair_SimpleParted.gltf")
UAL = Q + "universal-animation-library/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"
CLIPS = {'Idle_Loop': 'idle', 'Walk_Loop': 'walk', 'Jog_Fwd_Loop': 'jog', 'Sprint_Loop': 'sprint', 'Jump_Start': 'jumpStart', 'Jump_Loop': 'jumpLoop', 'Jump_Land': 'jumpLand', 'Dance_Loop': 'dance'}
HEAD_S = 1.75
LEG_F = 0.86     # app figure has shorter legs than the superhero base     # app renders: ~5.6 heads tall
TARGET_H = 1.74   # metres, matches cars (~4.3 m) and lanes

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=BASE)
for o in list(bpy.context.scene.objects):
    if o.name.startswith('Icosphere'): bpy.data.objects.remove(o, do_unlink=True)
arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
body = bpy.data.objects['SuperHero_Male']
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=HAIR)
for o in set(bpy.context.scene.objects) - before:
    if o.type == 'ARMATURE' or (o.type == 'MESH' and len(o.data.vertices) < 60): bpy.data.objects.remove(o, do_unlink=True)
for o in set(bpy.context.scene.objects) - before:
    if o.type == 'MESH':
        o.name = 'Hair'; o.parent = arm
        for m in o.modifiers:
            if m.type == 'ARMATURE': m.object = arm
        if not any(m.type == 'ARMATURE' for m in o.modifiers): mo = o.modifiers.new('arm', 'ARMATURE'); mo.object = arm
        if 'Head' not in o.vertex_groups: g = o.vertex_groups.new(name='Head'); g.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')

bpy.context.view_layer.update()
AWM = arm.matrix_world
def bone_ws(n):  # rest head/tail in object space of the meshes (meshes share the armature's space here)
    b = arm.data.bones[n]; return b.head_local.copy(), b.tail_local.copy()
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in meshes: print('mesh', o.name, len(o.data.vertices), o.matrix_world.translation[:], o.parent and o.parent.name)

def wmap(o):
    names = {g.index: g.name for g in o.vertex_groups}; out = []
    for v in o.data.vertices:
        d = {names[g.group]: g.weight for g in v.groups if g.weight > 0.001}; out.append(d)
    return out
def dom(d): return max(d.items(), key=lambda kv: kv[1])[0] if d else None

# --- proportions: scale head about the neck top, slim the torso a touch ---
hh, ht = bone_ws('Head'); pivot = hh
for o in meshes:
    W = wmap(o); me = o.data
    # vertex coords are in mesh space; armature space == mesh space if both identity-parented; convert via matrices
    toA = arm.matrix_world.inverted() @ o.matrix_world; toM = toA.inverted()
    for v, d in zip(me.vertices, W):
        w = d.get('Head', 0.0) + 0.5 * d.get('neck_01', 0.0) * 0.0
        if o.name in ('Hair', 'Eyes', 'Eyebrows'): w = 1.0
        if w <= 0: continue
        p = toA @ v.co; s = 1 + (HEAD_S - 1) * w
        v.co = toM @ (pivot + (p - pivot) * s)

# --- slim the superhero build toward the app's lean figure (radial scale about each bone axis) ---
SLIM = {'upperarm': 0.84, 'lowerarm': 0.88, 'spine_03': 0.93, 'spine_02': 0.94, 'clavicle': 0.9, 'thigh': 0.9, 'calf': 0.9, 'neck_01': 0.9}
def axis_pt(p, bn):
    h, t = bone_ws(bn); a = t - h; u = max(0.0, min(1.0, (p - h).dot(a) / a.length_squared)); return h + a * u
Wb = wmap(body); toAb = arm.matrix_world.inverted() @ body.matrix_world
for v, d in zip(body.data.vertices, Wb):
    if not d: continue
    p = toAb @ v.co; acc = Vector((0, 0, 0)); tw = 0
    for bn, w in d.items():
        k = next((kk for pre, kk in SLIM.items() if bn.startswith(pre)), 1.0)
        c = axis_pt(p, bn) if bn not in ('spine_02', 'spine_03') else Vector((0, p.y if False else axis_pt(p, bn).y, p.z)) * 0 + Vector((axis_pt(p, bn).x, axis_pt(p, bn).y, p.z))
        acc += (c + (p - c) * k) * w; tw += w
    if tw > 0: v.co = toAb.inverted() @ (acc / tw)

# --- shorter legs: scale leg bones + skin about each hip joint, drop everything above so the feet stay on the ground ---
LEGB = ('thigh', 'calf', 'foot', 'ball')
z0 = min((toAb @ v.co).z for v in body.data.vertices)
HJ = {sd: bone_ws('thigh' + sd)[0] for sd in ('_l', '_r')}
drop = (HJ['_l'].z - z0) * (1 - LEG_F)
def T_up(p): return p - Vector((0, 0, drop))
def T_leg(p, sd): h = HJ[sd]; return Vector((h.x, h.y, h.z - drop)) + (p - h) * LEG_F
for o in meshes:
    Wm = wmap(o); toA2 = arm.matrix_world.inverted() @ o.matrix_world; inv = toA2.inverted()
    for v, d in zip(o.data.vertices, Wm):
        p = toA2 @ v.co; wl = {'_l': 0.0, '_r': 0.0}
        for bn, w in d.items():
            if bn.startswith(LEGB): wl[bn[-2:]] += w
        tw = sum(d.values()) or 1.0; a = T_up(p) * (1 - (wl['_l'] + wl['_r']) / tw)
        for sd in wl: a = a + T_leg(p, sd) * (wl[sd] / tw)
        v.co = inv @ a
bpy.context.view_layer.objects.active = arm; arm.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
for eb in arm.data.edit_bones:
    if eb.name == 'root': continue
    if eb.name.startswith(LEGB): sd = eb.name[-2:] if eb.name[-2:] in ('_l', '_r') else '_l'; eb.head = T_leg(eb.head, sd); eb.tail = T_leg(eb.tail, sd)
    else: eb.head = T_up(eb.head); eb.tail = T_up(eb.tail)
bpy.ops.object.mode_set(mode='OBJECT')
def bone_ws(n):
    b = arm.data.bones[n]; return b.head_local.copy(), b.tail_local.copy()
z_neck = bone_ws('neck_01')[0].z; z_pelvis = bone_ws('pelvis')[0].z; z_sp2 = bone_ws('spine_02')[0].z; hh, ht = bone_ws('Head')

# --- garments: shells cut from the body by bone region ---
bm_src = body
W = wmap(body)
toA = arm.matrix_world.inverted() @ body.matrix_world
P = [toA @ v.co for v in body.data.vertices]
def tparam(p, bn):
    h, t = bone_ws(bn); a = t - h; return max(0.0, min(1.0, (p - h).dot(a) / a.length_squared))
TORSO = {'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r'}
z_neck = bone_ws('neck_01')[0].z; z_pelvis = bone_ws('pelvis')[0].z; z_sp2 = bone_ws('spine_02')[0].z
def region(kind):
    sel = set()
    for i, (p, d) in enumerate(zip(P, W)):
        b = dom(d)
        if b is None: continue
        side = b[-2:] if b[-2:] in ('_l', '_r') else ''
        up = kind in ('tee', 'long', 'crop', 'hoodie')
        if up:
            ok = b in TORSO or (b == 'neck_01' and p.z < z_neck + 0.03) or (b == 'pelvis' and p.z > z_pelvis + (0.02 if kind != 'hoodie' else -0.05))
            if b.startswith('upperarm'): ok = kind != 'tee' and kind != 'crop' or tparam(p, b) < 0.55
            if b.startswith('lowerarm'): ok = kind in ('long', 'hoodie') and tparam(p, b) < 0.93
            if kind == 'crop' and ok and p.z < z_sp2 - 0.01: ok = False
            if kind == 'hoodie' and b == 'Head':
                hc = (hh + ht) / 2; q = p - hc
                ok = (q.y > 0.01 and q.z > -0.06) or q.z > 0.12   # back and top of the head (char faces -Y)
            if ok: sel.add(i)
        else:
            ok = False
            if b == 'pelvis': ok = p.z < z_pelvis + (0.06 if kind != 'briefs' else 0.05)
            if b.startswith('thigh'): ok = kind != 'briefs' or tparam(p, b) < 0.3
            if kind == 'shorts' and b.startswith('thigh'): ok = tparam(p, b) < 0.62
            if b.startswith('calf'): ok = kind in ('jeans', 'pants', 'cuffed') and tparam(p, b) < (0.96 if kind == 'jeans' else 0.9)
            if kind == 'shoes': ok = b.startswith('foot') or b.startswith('ball') or (b.startswith('calf') and tparam(p, b) > 0.9)
            if ok: sel.add(i)
    return sel
PUSH = {'tee': 0.012, 'crop': 0.011, 'long': 0.012, 'hoodie': 0.026, 'jeans': 0.016, 'pants': 0.014, 'cuffed': 0.014, 'shorts': 0.016, 'briefs': 0.004, 'shoes': 0.02}
def make(kind):
    sel = region(kind)
    o = body.copy(); o.data = body.data.copy(); o.name = 'G_' + kind; bpy.context.collection.objects.link(o)
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    norms = [v.normal.copy() for v in bm.verts]
    kill = [v for v in bm.verts if v.index not in sel]
    for v in bm.verts:
        if v.index not in sel: continue
        p = toA @ v.co; d = PUSH[kind]; b = dom(W[v.index]) or ''
        k = 1.0
        if kind in ('tee', 'crop'): k = 1.4 if b.startswith('upperarm') else 1.2
        elif kind == 'long': k = 1.35 if b.startswith(('upperarm', 'lowerarm')) else 1.1
        elif kind == 'hoodie': k = 1.45 if b.startswith(('upperarm', 'lowerarm')) else (1.0 if b == 'Head' else 1.2)
        elif kind == 'jeans': k = (1.35 if b.startswith('thigh') else 1.95 if b.startswith('calf') else 1.12)
        elif kind == 'pants': k = (1.3 if b.startswith('thigh') else 1.6 if b.startswith('calf') else 1.1)
        elif kind == 'cuffed': k = (1.3 if b.startswith('thigh') else 1.45 if b.startswith('calf') else 1.1)
        elif kind == 'shorts': k = 1.4 if b.startswith('thigh') else 1.12
        elif kind == 'briefs': k = 1.04
        elif kind == 'shoes': k = 1.45
        if k != 1.0 and b and b != 'Head':
            c = axis_pt(p, b) if not b.startswith(('spine', 'pelvis', 'clavicle', 'neck')) else Vector((0, axis_pt(p, b).y * 0 + (axis_pt(p, 'spine_02').y), p.z))
            if b.startswith(('spine', 'pelvis', 'clavicle', 'neck')): c = Vector((0.0, axis_pt(p, 'spine_02').y + 0.01, p.z))
            if kind == 'jeans' and b.startswith('calf'): kk = 1 + (k - 1) * min(1.0, 0.55 + tparam(p, b)); q = c + (p - c) * kk
            else: q = c + (p - c) * k
            v.co = toA.inverted() @ q + norms[v.index] * d
        else:
            if kind == 'hoodie' and b == 'Head': d = 0.04
            v.co = v.co + norms[v.index] * d
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(o.data); bm.free()
    o.data.materials.clear(); mat = bpy.data.materials.get('M_' + kind) or bpy.data.materials.new('M_' + kind); o.data.materials.append(mat)
    for poly in o.data.polygons: poly.use_smooth = True
    print('garment', kind, len(o.data.vertices))
    return o
for k in ['briefs', 'shoes', 'tee', 'crop', 'long', 'hoodie', 'jeans', 'pants', 'cuffed', 'shorts']: make(k)
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    for poly in o.data.polygons: poly.use_smooth = True
body.name = 'Body'
# rename materials so the game can find them
for o in bpy.context.scene.objects:
    if o.type == 'MESH' and o.data.materials and not o.name.startswith('G_'):
        o.data.materials[0].name = 'M_' + o.name.lower()

# --- overall scale to TARGET_H ---
zs = [ (arm.matrix_world.inverted() @ o.matrix_world @ v.co).z for o in [body] for v in o.data.vertices ]
hcur = max(zs) - min(zs); print('height', hcur)

# --- animations ---
before = set(bpy.context.scene.objects); acts_before = set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=UAL)
for o in set(bpy.context.scene.objects) - before: bpy.data.objects.remove(o, do_unlink=True)
keep = []
for a in list(bpy.data.actions):
    base = a.name.replace('_Armature', '').split('.')[0]
    if a in acts_before: bpy.data.actions.remove(a); continue
    if base in CLIPS and CLIPS[base] not in [k.name for k in keep]:
        a.name = CLIPS[base]; a.use_fake_user = True; keep.append(a)
    else: bpy.data.actions.remove(a)
print('actions', [a.name for a in keep])
arm.animation_data_create()
for a in keep:
    tr = arm.animation_data.nla_tracks.new(); tr.name = a.name; st = tr.strips.new(a.name, int(a.frame_range[0]), a); tr.mute = True
arm.animation_data.action = None
s = TARGET_H / hcur; arm.scale = (arm.scale[0] * s, arm.scale[1] * s, arm.scale[2] * s)
for o in list(bpy.context.scene.objects):  # drop helper spheres (42-vert Icosphere shipped with the base kit)
    if o.type == 'MESH' and (o.name.startswith('Icosphere') or len(o.data.vertices) < 60): bpy.data.objects.remove(o, do_unlink=True)
for o in bpy.context.scene.objects:  # lean export: one UV set, no vertex colours
    if o.type != 'MESH': continue
    while len(o.data.color_attributes): o.data.color_attributes.remove(o.data.color_attributes[0])
    while len(o.data.uv_layers) > 1: o.data.uv_layers.remove(o.data.uv_layers[-1])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS', export_frame_step=2,
                          export_image_format='NONE', export_materials='EXPORT', export_apply=False, export_skins=True, export_all_influences=False,
                          export_texcoords=True, export_normals=True, export_yup=True, export_optimize_animation_size=True)
print('wrote', OUT)
