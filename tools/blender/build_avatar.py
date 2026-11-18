"""Build the RECKLESS crew avatar as a smooth rigged glTF from CC0 parts (free tools only).
Base: Quaternius Universal Base Characters, Superhero_Male (CC0), on the Universal Animation Library skeleton.
Reshaped to the app's crew render proportions (bigger head, slimmer, youthful); garments are skinned shells
cut from the body by bone region and pushed out along normals, so every Drop 018 piece deforms with the rig.
Animations: Quaternius UAL1 (CC0) idle / walk / jog / sprint / jump / dance, in place.
Run: blender -b --python build_avatar.py -- out.glb"""
import bpy, bmesh, sys, math
from mathutils import Vector, Euler
OUT = sys.argv[sys.argv.index('--') + 1]
Q = "/workspace/reckless-world/research/assets/quaternius/"
BASE = Q + "universal-base-characters/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf"
HAIR = Q + "universal-base-characters/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/" + (sys.argv[sys.argv.index('--') + 2] if len(sys.argv) > sys.argv.index('--') + 2 else "Hair_SimpleParted.gltf")
UAL = Q + "universal-animation-library/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"
CLIPS = {'Walk_Loop': 'walk', 'Jog_Fwd_Loop': 'jog', 'Sprint_Loop': 'sprint', 'Jump_Start': 'jumpStart', 'Jump_Loop': 'jumpLoop', 'Jump_Land': 'jumpLand', 'Dance_Loop': 'dance', 'Sitting_Idle_Loop': 'sit'}
USE_QHAIR = False  # the app's short textured crop with a fade is built as a scalp shell below
SMOOTH_IT = int(__import__('os').environ.get('SMIT', '0'))
HEAD_S = 1.88
HEAD_AX = (1.24, 1.0, 1.2)    # app render (front overlay, shots/pass8): head ~4.2 heads tall figure, taller oval skull
LEG_F = 0.86     # app figure has shorter legs than the superhero base     # app renders: ~5.6 heads tall
TARGET_H = 1.74   # metres, matches cars (~4.3 m) and lanes

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=BASE)
for o in list(bpy.context.scene.objects):
    if o.name.startswith('Icosphere'): bpy.data.objects.remove(o, do_unlink=True)
arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]
body = bpy.data.objects['SuperHero_Male']
_bw = bmesh.new(); _bw.from_mesh(body.data); bmesh.ops.remove_doubles(_bw, verts=_bw.verts, dist=1e-5); _bw.to_mesh(body.data); _bw.free()  # weld glTF seams so shells never crack
before = set(bpy.context.scene.objects)
if USE_QHAIR: bpy.ops.import_scene.gltf(filepath=HAIR)
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
        p = toA @ v.co; s = 1 + (HEAD_S - 1) * w; q = p - pivot
        v.co = toM @ (pivot + Vector((q.x * s * (1 + (HEAD_AX[0] - 1) * w), q.y * s * (1 + (HEAD_AX[1] - 1) * w), q.z * s * (1 + (HEAD_AX[2] - 1) * w))))

# --- slim the superhero build toward the app's lean figure (radial scale about each bone axis) ---
SLIM = {'upperarm': 1.12, 'lowerarm': 1.04, 'spine_03': 1.28, 'spine_02': 1.28, 'spine_01': 1.26, 'pelvis': 1.05, 'clavicle': 0.95, 'thigh': 1.22, 'calf': 1.24, 'neck_01': 0.92}  # tuned on the front overlay vs the app body render
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
# --- arms: the app figure's arms are ~18% longer (fingertips at mid-thigh) and the shoulders sit wider ---
ARM_L, SH_OUT = 1.18, 0.04
def _bws(n): b = arm.data.bones[n]; return b.head_local.copy(), b.tail_local.copy()
ADESC = {sd: {b.name for b in arm.data.bones if b.name == 'upperarm' + sd or any(q.name == 'upperarm' + sd for q in b.parent_recursive)} for sd in ('_l', '_r')}
SJ = {sd: _bws('upperarm' + sd)[0] for sd in ADESC}
def T_arm(p, sd): s_ = SJ[sd]; q = p - s_; sg = 1 if s_.x > 0 else -1; return Vector((s_.x + sg * SH_OUT + q.x * ARM_L, p.y, p.z))
for o in meshes:
    Wm = wmap(o); toA2 = arm.matrix_world.inverted() @ o.matrix_world; inv = toA2.inverted()
    for v, d in zip(o.data.vertices, Wm):
        if not d: continue
        p = toA2 @ v.co; tw = sum(d.values()) or 1.0; a = p.copy(); moved = False
        for sd in ADESC:
            wa = sum(w for bn, w in d.items() if bn in ADESC[sd]) / tw; wc = d.get('clavicle' + sd, 0.0) / tw
            if wa > 0: a = a + (T_arm(p, sd) - p) * wa; moved = True
            if wc > 0: a.x += (1 if SJ[sd].x > 0 else -1) * SH_OUT * 0.5 * wc; moved = True
        if moved: v.co = inv @ a
bpy.ops.object.mode_set(mode='EDIT')
for eb in arm.data.edit_bones:
    for sd in ADESC:
        if eb.name in ADESC[sd]: eb.head = T_arm(eb.head, sd); eb.tail = T_arm(eb.tail, sd)
        if eb.name == 'clavicle' + sd: eb.tail = T_arm(eb.tail, sd)
bpy.ops.object.mode_set(mode='OBJECT')
def bone_ws(n):
    b = arm.data.bones[n]; return b.head_local.copy(), b.tail_local.copy()
z_neck = bone_ws('neck_01')[0].z; z_pelvis = bone_ws('pelvis')[0].z; z_sp2 = bone_ws('spine_02')[0].z; hh, ht = bone_ws('Head')

# --- shoulders: the app figure has sloped shoulders and slimmer traps than the superhero base ---
toAs = arm.matrix_world.inverted() @ body.matrix_world; invs = toAs.inverted()
def _sm(a, b, x): t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
for v in body.data.vertices:
    p = toAs @ v.co; ax_ = abs(p.x)
    if p.z < z_neck - 0.2 or p.z > z_neck + 0.03: continue
    dz = -0.042 * _sm(0.045, 0.19, ax_) * _sm(z_neck - 0.17, z_neck - 0.05, p.z); p.z += dz; v.co = invs @ p
# --- face: rounder, softer, younger (app crew render): shorter lower face, fuller cheeks and jaw, smaller nose, smoothed features ---
toA = arm.matrix_world.inverted() @ body.matrix_world
Wf = wmap(body); Pf = [toA @ v.co for v in body.data.vertices]
fv = [i for i, d in enumerate(Wf) if dom(d) in ('Head', 'neck_01') and d.get('Head', 0) > 0.5]
mn = Vector([min(Pf[i][k] for i in fv) for k in range(3)]); mx = Vector([max(Pf[i][k] for i in fv) for k in range(3)]); hc0 = (mn + mx) / 2; ex0 = (mx - mn) / 2
def sm(a, b, x): t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
eyes = bpy.data.objects.get('Eyes'); ec = []
if eyes:
    toEy = arm.matrix_world.inverted() @ eyes.matrix_world; eps = [toEy @ v.co for v in eyes.data.vertices]
    for side in (1, -1):
        pts = [p for p in eps if p.x * side > 0]; ec.append(sum(pts, Vector()) / len(pts))
newP = {}
for i in fv:
    p = Pf[i].copy(); n = Vector(((p.x - hc0.x) / ex0.x, (p.y - hc0.y) / ex0.y, (p.z - hc0.z) / ex0.z)); w = Wf[i].get('Head', 0)
    if n.z < 0.15:  # lower face: lift the chin, fill the cheeks and jaw out
        lift = sm(0.15, -1.0, n.z); p.z += (hc0.z + 0.15 * ex0.z - p.z) * 0.2 * lift
        p.x = hc0.x + (p.x - hc0.x) * (1 + 0.26 * sm(0.15, -0.45, n.z) * sm(-1.05, -0.6, n.z))
        if n.y < 0: p.y = hc0.y + (p.y - hc0.y) * (1 - 0.06 * lift)
    if n.y < -0.7 and abs(n.x) < 0.3 and -0.45 < n.z < 0.15: p.y += (hc0.y - ex0.y * 0.7 - p.y) * 0.6 * sm(0.3, 0.0, abs(n.x))  # smaller nose
    if abs(n.x) > 0.8 and -0.55 < n.z < 0.25 and -0.45 < n.y < 0.5:  # ears: smaller and tucked in like the app render
        ew = sm(0.8, 0.95, abs(n.x)); ec_ = Vector((math.copysign(hc0.x + ex0.x * 0.82, n.x) if hc0.x == 0 else hc0.x + math.copysign(ex0.x * 0.82, n.x), hc0.y + 0.05 * ex0.y, hc0.z - 0.12 * ex0.z))
        p = p + ((ec_ + (p - ec_) * 1.0) - p) * ew
    newP[i] = hc0 + (p - hc0) if w > 0 else Pf[i]
bmf = bmesh.new(); bmf.from_mesh(body.data); bmf.verts.ensure_lookup_table()
for i, p in newP.items(): bmf.verts[i].co = toA.inverted() @ p
near_eye = lambda p: any((p - c).length < ex0.x * 0.42 for c in ec)
soft = [bmf.verts[i] for i in fv if not near_eye(Pf[i]) and (Pf[i].z - hc0.z) / ex0.z < 0.35]
for _ in range(SMOOTH_IT): bmesh.ops.smooth_laplacian_vert(bmf, verts=soft, lambda_factor=0.35, lambda_border=0.0, use_x=True, use_y=True, use_z=True, preserve_volume=True)
bmf.to_mesh(body.data); bmf.free()

# --- hair: short textured crop with a skin fade, as a scalp shell (planar-projected strand texture + fade vertex colours) ---
import random
def smooth(a, b, x): t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
toA = arm.matrix_world.inverted() @ body.matrix_world
Wh = wmap(body); Ph = [toA @ v.co for v in body.data.vertices]
hv = [i for i, d in enumerate(Wh) if dom(d) == 'Head']
mn = Vector([min(Ph[i][k] for i in hv) for k in range(3)]); mx = Vector([max(Ph[i][k] for i in hv) for k in range(3)])
hc = (mn + mx) / 2; ex = (mx - mn) / 2
print('head bbox', [round(c, 3) for c in (mx - mn)], 'centre', [round(c, 3) for c in hc])
def hn(p): q = p - hc; return Vector((q.x / ex.x, q.y / ex.y, q.z / ex.z))
def scalp(n):
    zth = 0.30 - max(0.0, min(1.0, (n.y + 0.45) / 1.1)) * 0.78   # hairline: high at the forehead, low at the nape
    if abs(n.x) > 0.78 and n.z < 0.32 and n.y > -0.4: return False   # keep the ears clear
    return n.z > zth
HSEL = {i for i in hv if scalp(hn(Ph[i]))}
o = body.copy(); o.data = body.data.copy(); o.name = 'Hair'; bpy.context.collection.objects.link(o)
bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
norms = [v.normal.copy() for v in bm.verts]
random.seed(4)
for v in bm.verts:
    if v.index not in HSEL: continue
    n = hn(Ph[v.index]); top = smooth(0.30, 0.80, n.z)      # crop: volume on top, faded short sides
    edge = smooth(0.0, 0.14, n.z - (0.30 - max(0.0, min(1.0, (n.y + 0.45) / 1.1)) * 0.78))  # thin to nothing at the hairline
    th = (0.0025 + 0.022 * top * (1 - 0.45 * smooth(0.45, 0.95, abs(n.x)))) * (0.25 + 0.75 * edge) + 0.004 * smooth(0.6, 0.9, abs(n.x)) * smooth(0.05, 0.45, n.z) * edge + (0.010 * smooth(-0.2, -0.75, n.y) * smooth(0.25, 0.6, n.z))  # extra fringe volume at the front
    d = norms[v.index] * th
    if n.y < -0.35 and n.z > 0.25: d += Vector((0, -0.006, -0.004)) * top   # fringe pushed forward over the brow
    v.co = v.co + (toA.inverted().to_3x3() @ d)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in HSEL], context='VERTS')
bm.to_mesh(o.data); bm.free()
# planar UV from above for the strand texture; fade colour from skin-stubble (sides) to near-black (top)
uvl = o.data.uv_layers.active.data
P2 = [toA @ v.co for v in o.data.vertices]
for poly in o.data.polygons:
    for li, vi in zip(poly.loop_indices, poly.vertices):
        n = hn(P2[vi]); uvl[li].uv = (0.5 + n.x * 0.5, 0.5 + n.y * 0.5 + n.z * 0.15)
ca = o.data.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
for i, v in enumerate(o.data.vertices):
    n = hn(P2[i]); f = smooth(0.0, 0.55, n.z + (0.25 if n.y < -0.3 else 0))
    sk = (0.62, 0.55, 0.53); dk = (0.035, 0.03, 0.03)
    ca.data[i].color = tuple(sk[k] * (1 - f) * 0.55 + dk[k] * (0.45 + 0.55 * f) for k in range(3)) + (1.0,)
o.data.materials.clear(); o.data.materials.append(bpy.data.materials.new('M_hair'))
print('hair shell', len(o.data.vertices))
# brows: thicker and darker like the app's heavy straight brows
eb = bpy.data.objects.get('Eyebrows')
if eb:
    toE = arm.matrix_world.inverted() @ eb.matrix_world; ps = [toE @ v.co for v in eb.data.vertices]
    for side in (1, -1):
        idx = [i for i, p in enumerate(ps) if p.x * side > 0]
        if not idx: continue
        c = sum((ps[i] for i in idx), Vector()) / len(idx)
        for i in idx:
            q = ps[i] - c; ps[i] = c + Vector((q.x * 1.0, q.y, q.z * 0.72)) + Vector((0, -0.0015, 0.0035))
    for v, p in zip(eb.data.vertices, ps): v.co = toE.inverted() @ p

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
            ok = b in TORSO or (b == 'neck_01' and p.z < z_neck + 0.03) or (b == 'pelvis' and p.z > z_pelvis + (-0.07 if kind in ('tee', 'long') else 0.02 if kind != 'hoodie' else -0.05))
            if b.startswith('thigh') and kind in ('tee', 'long'): ok = p.z > z_pelvis - 0.07
            if b.startswith('upperarm'): ok = kind != 'tee' and kind != 'crop' or tparam(p, b) < 0.85
            if b.startswith('lowerarm'): ok = kind in ('long', 'hoodie') and tparam(p, b) < 0.93
            if kind == 'crop' and ok and p.z < z_sp2 - 0.01: ok = False
            if kind == 'hoodie' and b == 'Head':
                hc = (hh + ht) / 2; q = p - hc
                ok = q.y > 0.05 and q.z < -0.04   # hood down: only a bunched hood behind the nape, never over the skull
            if ok: sel.add(i)
        else:
            ok = False
            if b == 'pelvis': ok = p.z < z_pelvis + (0.05 if kind == 'briefs' else 0.07 if kind in ('jeans', 'pants', 'cuffed') else 0.06)
            if b.startswith('thigh'): ok = kind != 'briefs' or tparam(p, b) < 0.3
            if kind == 'shorts' and b.startswith('thigh'): ok = tparam(p, b) < 0.62
            if b.startswith('calf'): ok = kind in ('jeans', 'pants', 'cuffed') and tparam(p, b) < (1.0 if kind == 'jeans' else 0.9)
            if kind == 'shoes': ok = b.startswith('foot') or b.startswith('ball') or (b.startswith('calf') and tparam(p, b) > 0.9)
            if ok: sel.add(i)
    return sel
PUSH = {'tee': 0.012, 'crop': 0.011, 'long': 0.012, 'hoodie': 0.026, 'jeans': 0.016, 'pants': 0.014, 'cuffed': 0.014, 'shorts': 0.016, 'briefs': 0.004, 'shoes': 0.02}
# torso half-width / half-depth per 1 cm slice (body only, torso bones) for the boxy tee fit
TW, TD = {}, {}
_cy = axis_pt(Vector((0, 0, 1.0)), 'spine_02').y + 0.01
for i_, (p_, d_) in enumerate(zip(P, W)):
    b_ = dom(d_) or ''
    if b_.startswith(('spine', 'pelvis', 'clavicle')):
        zk = round(p_.z, 2); TW[zk] = max(TW.get(zk, 0.0), abs(p_.x)); TD[zk] = max(TD.get(zk, 0.0), abs(p_.y - _cy))
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
        if kind in ('tee', 'crop'): k = (1.04 + 0.75 * tparam(p, b) ** 1.3) if b.startswith('upperarm') else 1.27  # no puff over the shoulder, flares to the hem  # sleeve flares toward the hem
        elif kind == 'long': k = 1.35 if b.startswith(('upperarm', 'lowerarm')) else 1.1
        elif kind == 'hoodie': k = 1.45 if b.startswith(('upperarm', 'lowerarm')) else (1.0 if b == 'Head' else 1.2)
        elif kind == 'jeans': k = (1.35 if b.startswith('thigh') else 1.95 if b.startswith('calf') else 1.12)
        elif kind == 'pants': k = (1.3 if b.startswith('thigh') else 1.6 if b.startswith('calf') else 1.1)
        elif kind == 'cuffed': k = (1.3 if b.startswith('thigh') else 1.45 if b.startswith('calf') else 1.1)
        elif kind == 'shorts': k = 1.4 if b.startswith('thigh') else 1.12
        elif kind == 'briefs': k = 1.04
        elif kind == 'shoes': k = 1.62
        if kind in ('jeans', 'pants', 'cuffed', 'shorts') and p.z > z_pelvis - 0.03:  # waistband tucks under any top
            f = max(0.0, min(1.0, (p.z - (z_pelvis - 0.03)) / 0.04)); k = k + (1.02 - k) * f; d = d + (0.005 - d) * f
        if k != 1.0 and b and b != 'Head':
            c = axis_pt(p, b) if not b.startswith(('spine', 'pelvis', 'clavicle', 'neck')) else Vector((0, axis_pt(p, b).y * 0 + (axis_pt(p, 'spine_02').y), p.z))
            if b.startswith(('spine', 'pelvis', 'clavicle', 'neck')): c = Vector((0.0, axis_pt(p, 'spine_02').y + 0.01, p.z))
            if kind == 'jeans' and b.startswith(('thigh', 'calf')):  # straight-leg baggy: near-constant radius from mid-thigh to the hem
                r = (p - c).length; R = max(r * 1.12, 0.088 if b.startswith('thigh') else 0.085); q = c + (p - c) * (R / max(r, 1e-4))
                if (q.x - p.x) * (1 if p.x > 0 else -1) < 0: q.x = p.x + (q.x - p.x) * 0.2   # inner leg hugs: legs split high like the app
            elif b.startswith(('spine', 'pelvis', 'clavicle', 'neck')):  # torso: loose in depth, barely wider (no shoulder pads)
                kx = 1 + (k - 1) * (0.3 if kind in ('tee', 'crop', 'long', 'hoodie') else 0.4); dq = p - c
                if kind in ('tee', 'long', 'crop') and p.z < z_neck - 0.1:  # boxy oversized fit: sides hang straight to the hem
                    xm = TW.get(round(p.z, 2), 0.15); tgt = 0.228 * (abs(dq.x) / max(xm, 1e-3)); kb = min(1.6, tgt / max(abs(dq.x), 1e-3))
                    fz = max(0.0, min(1.0, ((z_neck - 0.13) - p.z) / 0.08)); kx = max(kx, kx + (kb - kx) * fz)   # boxy below the chest, follows the shoulder slope above (no shoulder block)
                    k = max(k, min(1.5, 0.135 / max(TD.get(round(p.z, 2), 0.1), 1e-3)))
                q = c + Vector((dq.x * kx, dq.y * k, 0))
            else:
                q = c + (p - c) * k
                if kind in ('pants', 'cuffed', 'shorts') and b.startswith(('thigh', 'calf')) and (q.x - p.x) * (1 if p.x > 0 else -1) < 0: q.x = p.x + (q.x - p.x) * 0.25
            v.co = toA.inverted() @ q + norms[v.index] * d
        else:
            if kind == 'hoodie' and b == 'Head': d = 0.04
            v.co = v.co + norms[v.index] * d
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    if kind in ('tee', 'crop', 'long', 'hoodie'):  # drape: relax the shell so the base's muscle relief doesn't print through
        dl0 = bm.verts.layers.deform.active; gn0 = {g.index: g.name for g in o.vertex_groups}
        tv = [v for v in bm.verts if not v.is_boundary and dl0 and len(v[dl0]) and gn0.get(max(v[dl0].items(), key=lambda kv: kv[1])[0], '').startswith(('spine', 'pelvis', 'clavicle'))]
        orig = {v: v.co.copy() for v in tv}; cy_ = axis_pt(Vector((0, 0, 1.0)), 'spine_02').y
        for _ in range(8): bmesh.ops.smooth_laplacian_vert(bm, verts=tv, lambda_factor=0.5, lambda_border=0.0, use_x=True, use_y=True, use_z=True, preserve_volume=False)
        for v in tv:  # cloth bridges the valleys (abs/pecs) but never sinks below the pushed shell
            a_ = toA @ orig[v]; b_ = toA @ v.co
            ra = math.hypot(a_.x, a_.y - cy_); rb = math.hypot(b_.x, b_.y - cy_)
            if rb < ra: v.co = orig[v]
    # clean straight hems: bisect the pushed shell with planes (collar, hem, sleeve ends, waistband, leg hems)
    inv = toA.inverted(); dl = bm.verts.layers.deform.active; gn = {g.index: g.name for g in o.vertex_groups}
    def vdom(v):
        d = v[dl] if dl else {}; return gn.get(max(d.items(), key=lambda kv: kv[1])[0], '') if len(d) else ''
    def cutp(pt, nrm, only=None):
        co = inv @ pt; no = (inv.to_3x3() @ nrm).normalized()
        vs = [v for v in bm.verts if only is None or vdom(v).startswith(only)]; vset = set(vs)
        es = [e for e in bm.edges if all(x in vset for x in e.verts)]; fs = [f for f in bm.faces if all(x in vset for x in f.verts)]
        bmesh.ops.bisect_plane(bm, geom=vs + es + fs, plane_co=co, plane_no=no, clear_outer=True)
    def along(bn, t):
        h, tl = bone_ws(bn); return h + (tl - h) * t, (tl - h).normalized()
    if kind in ('tee', 'long', 'crop'):  # round crew neck: drop faces inside a neck cylinder, snap the rim onto it
        ny_ = bone_ws('neck_01')[0].y; R = 0.064
        def hd(v): q = toA @ v.co; return math.hypot(q.x, (q.y - ny_) * 0.92), q
        dead = [f for f in bm.faces if all((lambda r: r[0] < R and r[1].z > z_neck - 0.06)(hd(v)) for v in f.verts) or (lambda c: math.hypot(c.x, (c.y - ny_) * 0.92) < R and c.z > z_neck - 0.06)(toA @ f.calc_center_median())]
        bmesh.ops.delete(bm, geom=dead, context='FACES_ONLY')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        for v in bm.verts:
            if v.is_boundary:
                r, q = hd(v)
                if q.z > z_neck - 0.08 and r < R * 1.6 and r > 1e-4:
                    k_ = R / r; q2 = Vector((q.x * k_, ny_ + (q.y - ny_) * k_, q.z)); v.co = inv @ q2
    if kind in ('tee', 'long'): cutp(Vector((0, 0, z_pelvis - 0.03)), Vector((0, 0, -1)))
    if kind == 'tee':
        for sd in ('_l', '_r'): pt, dr = along('upperarm' + sd, 0.66); cutp(pt, dr, only='upperarm' + sd)
    if kind in ('jeans', 'pants', 'cuffed'):
        cutp(Vector((0, 0, z_pelvis + 0.035)), Vector((0, 0, 1)))
    if kind == 'jeans':
        for sd in ('_l', '_r'): pt, dr = along('calf' + sd, 0.965); cutp(pt, dr, only=('calf' + sd, 'foot' + sd))
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
# --- idle: the app's relaxed upright stance (straight legs, arms hanging ~10 deg out), gentle breathing ---
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
arm.animation_data_create(); ia = bpy.data.actions.new('idle'); ia.use_fake_user = True; arm.animation_data.action = ia
def aim(name, d):
    bpy.context.view_layer.update(); pb = arm.pose.bones[name]; M = pb.matrix.copy()
    cur = (M.to_3x3() @ Vector((0, 1, 0))).normalized(); R = cur.rotation_difference(d.normalized()).to_matrix().to_4x4()
    N = R @ M; N.translation = M.translation; pb.matrix = N
def stance(br):
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'; pb.matrix_basis.identity()
    for sd in ('_l', '_r'):
        sx = 1 if arm.data.bones['upperarm' + sd].head_local.x > 0 else -1
        aim('upperarm' + sd, Vector((sx * (0.37 + br * 0.015), 0.03, -1)))  # ~11 deg out: clear gap to the torso like the app render
        aim('lowerarm' + sd, Vector((sx * 0.16, -0.1, -1)))
        aim('hand' + sd, Vector((sx * 0.12, -0.06, -1)))
        aim('thigh' + sd, Vector((sx * 0.045, 0.0, -1))); aim('calf' + sd, Vector((sx * 0.03, 0.012, -1)))
        for f in ('index', 'middle', 'ring', 'pinky'):
            for j, ang in ((1, 7), (2, 11), (3, 6)):   # relaxed open hand like the app render (was a loose fist)
                bn = f'{f}_0{j}{sd}'
                if bn in arm.pose.bones: pb = arm.pose.bones[bn]; pb.rotation_quaternion = Euler((math.radians(ang), 0, 0)).to_quaternion()
    for bn, ang in (('spine_02', 1.2 * br), ('spine_03', -3.0 + 1.0 * br), ('neck_01', -5.0 - 0.8 * br), ('Head', 3.0)):  # upright chest, neck back over the shoulders
        if bn in arm.pose.bones: arm.pose.bones[bn].rotation_quaternion = Euler((math.radians(ang), 0, 0)).to_quaternion()
    bpy.context.view_layer.update()
for fr, br in ((1, 0.0), (45, 1.0), (90, 0.0)):
    stance(br)
    for pb in arm.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=fr); pb.keyframe_insert('location', frame=fr)
    if 'pelvis' in arm.pose.bones: pass
bpy.ops.object.mode_set(mode='OBJECT'); arm.animation_data.action = None
keep.append(ia)
print('actions', [a.name for a in keep])
arm.animation_data_create()
for a in keep:
    tr = arm.animation_data.nla_tracks.new(); tr.name = a.name; st = tr.strips.new(a.name, int(a.frame_range[0]), a); tr.mute = True
arm.animation_data.action = None
s = TARGET_H / hcur; arm.scale = (arm.scale[0] * s, arm.scale[1] * s, arm.scale[2] * s)
for o in list(bpy.context.scene.objects):  # drop helper spheres (42-vert Icosphere shipped with the base kit)
    if o.type == 'MESH' and (o.name.startswith('Icosphere') or len(o.data.vertices) < 60): bpy.data.objects.remove(o, do_unlink=True)
# --- bake UVs + projection dump: every visible part gets a fresh non-overlapping UV layout (smart project) and its posed
# (idle frame 1 = the app's stance) loop positions/normals are dumped so tools/bake_avatar_tex.py can project the app's
# front renders onto it (face, hair, skin, every wardrobe garment). See research/techniques-sources.md (texture projection).
import numpy as np, os
BAKE = os.environ.get('AV_DUMP', '/tmp/av_dump.npz')
TEXM = [o for o in bpy.context.scene.objects if o.type == 'MESH' and (o.name in ('Body', 'Hair', 'Eyes') or o.name.startswith('G_'))]
for o in TEXM:
    while len(o.data.color_attributes): o.data.color_attributes.remove(o.data.color_attributes[0])
    while len(o.data.uv_layers): o.data.uv_layers.remove(o.data.uv_layers[0])
    o.data.uv_layers.new(name='UVMap')
    bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=1e-5)  # glTF import splits every UV/normal seam: weld so islands are whole
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.012, area_weight=0.0, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
arm.animation_data.action = ia; bpy.context.scene.frame_set(1); bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get(); D = {}
for o in TEXM:
    oe = o.evaluated_get(dg); me = oe.to_mesh(); me.calc_loop_triangles()
    Mw = oe.matrix_world; R3 = Mw.to_3x3()
    co = np.array([tuple(Mw @ v.co) for v in me.vertices], np.float32)
    lv = np.array([l.vertex_index for l in me.loops], np.int32)
    try: ln = np.array([tuple((R3 @ l.normal).normalized()) for l in me.loops], np.float32)
    except Exception: ln = np.array([tuple((R3 @ me.vertices[l.vertex_index].normal).normalized()) for l in me.loops], np.float32)
    uv = np.array([tuple(d.uv) for d in me.uv_layers.active.data], np.float32)
    tri = np.array([tuple(t.loops) for t in me.loop_triangles], np.int32)
    D[o.name + '|co'] = co[lv]; D[o.name + '|n'] = ln; D[o.name + '|uv'] = uv; D[o.name + '|tri'] = tri
    oe.to_mesh_clear()
np.savez_compressed(BAKE, **D); print('dumped', BAKE, len(TEXM))
arm.animation_data.action = None; bpy.context.scene.frame_set(0)
for o in bpy.context.scene.objects:  # lean export: one UV set, no vertex colours
    if o.type != 'MESH': continue
    while o.name != 'Hair' and len(o.data.color_attributes): o.data.color_attributes.remove(o.data.color_attributes[0])
    while len(o.data.uv_layers) > 1: o.data.uv_layers.remove(o.data.uv_layers[-1])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS', export_frame_step=2,
                          export_image_format='NONE', export_materials='EXPORT', export_apply=False, export_skins=True, export_all_influences=False,
                          export_texcoords=True, export_normals=True, export_vertex_color='ACTIVE', export_yup=True, export_optimize_animation_size=True)
print('wrote', OUT)
# Post-process (repo root game/):  npx @gltf-transform/cli@4 resample|prune|dedup|meshopt  out.glb -> public/models/avatar.glb.json
