"""Street extras (OUTSTANDING F) -> compact vertex-colour JSON (public/data/extras.json).
Kenney City Kit Roads 2.2 (CC0) barriers/cones/fence/blank sign posts + original CC0 manhole and kerb gully (assets_incoming/city_data/street_extras).
Kenney props are scaled to a real target height; the drains are already metres. No stop (US) sign, no operator marks.
Run: blender -b --python export_extras.py -- out.json"""
import bpy, sys, json, base64, struct
OUT = sys.argv[sys.argv.index('--') + 1]
S = '/workspace/reckless-world/assets_incoming/city_data/street_extras/'
KR = '/workspace/reckless-world/assets_incoming/free_resources/kenney/city-kit-roads/Models/GLB format/'  # same CC0 files, next to their colormap.png
MODELS = [('kenney/construction-barrier.glb', 'barrier', 1.0), ('kenney/construction-cone.glb', 'cone', 0.75), ('kenney/construction-fence.glb', 'fence', 1.15),
          ('kenney/construction-light.glb', 'blinker', 1.3), ('kenney/road-sign-empty.glb', 'post', 2.6), ('kenney/road-sign-street.glb', 'streetsign', 2.6),
          ('kenney/road-sign-warning.glb', 'warning', 2.6), ('original/manhole_circular.glb', 'manhole', None), ('original/gully_kerb.glb', 'gully', None)]
def srgb(c): return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
out = {}
for f, key, H in MODELS:
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=(KR + f[7:]) if f.startswith('kenney/') else S + f)
    imgs = [n.image for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]
    img = imgs[0] if imgs else None
    if img: W, Hh = img.size; px = list(img.pixels)
    dg = bpy.context.evaluated_depsgraph_get(); P = []; C = []; I = []; pal = {}
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    zs = [(o.matrix_world @ v.co).z for o in objs for v in o.data.vertices]; sc = (H / (max(zs) - min(zs))) if H else 1.0
    for o in objs:
        me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); uv = me.uv_layers.active.data if me.uv_layers.active else None; M = o.matrix_world
        for t in me.loop_triangles:
            if img and uv:
                u = sum(uv[l].uv[0] for l in t.loops) / 3; v = sum(uv[l].uv[1] for l in t.loops) / 3
                x = min(W - 1, max(0, int((u % 1) * W))); y = min(Hh - 1, max(0, int((v % 1) * Hh))); k = (y * W + x) * 4; r, g, b = (srgb(c) for c in px[k:k + 3])
            else:
                mat = me.materials[t.material_index] if me.materials else None; bc = (0.3, 0.3, 0.3)
                if mat and mat.use_nodes:
                    bs = [n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED']
                    if bs: bc = tuple(bs[0].inputs['Base Color'].default_value[:3])
                r, g, b = (srgb(c) for c in bc)
            ci = pal.setdefault((round(r, 2), round(g, 2), round(b, 2)), len(pal)); base = len(P)
            for vi in t.vertices:
                p = M @ me.vertices[vi].co; P.append((p.x * sc, p.z * sc, -p.y * sc)); C.append(ci)
            I.extend((base, base + 1, base + 2))
        o.evaluated_get(dg).to_mesh_clear()
    y0 = min(p[1] for p in P); xs = [p[0] for p in P]; zz = [p[2] for p in P]; cx, cz = (max(xs) + min(xs)) / 2, (max(zz) + min(zz)) / 2; Q = 0.0005
    pos = b''.join(struct.pack('<3h', round((p[0] - cx) / Q), round((p[1] - y0) / Q), round((p[2] - cz) / Q)) for p in P)
    b64 = lambda b: base64.b64encode(b).decode()
    out[key] = {'pos': b64(pos), 'col': b64(bytes(C)), 'ind': b64(struct.pack('<%dH' % len(I), *I)), 'pal': [list(k) for k in sorted(pal, key=pal.get)], 'scale': Q,
                'size': [round(max(xs) - min(xs), 2), round(max(p[1] for p in P) - y0, 2), round(max(zz) - min(zz), 2)]}
    print('EX', key, len(I) // 3, out[key]['size'], len(pal))
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
