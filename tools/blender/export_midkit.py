"""Kenney City Kit Commercial + Suburban (CC0) -> compact vertex-colour JSON for the mid-distance street fill (data/midkit.json).
Run: blender -b --python export_midkit.py -- out.json
Per model: int16 positions (x scale), palette index per vertex, body indices + glass indices (glass faces render as lit windows at night).
Toy colours are knocked back: saturated cells desaturate toward a dark neutral so the runtime per-building tint (brick / sandstone / render) reads."""
import bpy, sys, json, base64, struct, colorsys
OUT = sys.argv[sys.argv.index('--') + 1]
K = '/workspace/reckless-world/research/assets/kenney/'
MODELS = [(K + 'city-kit-commercial/Models/GLB format/building-' + c + '.glb', 'c' + c, 12.0) for c in 'abcdefgh'] + \
         [(K + 'city-kit-suburban/Models/GLB format/building-type-' + c + '.glb', 's' + c, 9.0) for c in 'acehijklopqr']
def srgb(c): return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
out = {}
for f, key, S in MODELS:
    bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=f)
    img = [n.image for m in bpy.data.materials if m.use_nodes for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image][0]; W, H = img.size; px = list(img.pixels)
    dg = bpy.context.evaluated_depsgraph_get(); P = []; C = []; IB = []; IG = []; pal = {}
    for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
        me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); uv = me.uv_layers.active.data; M = o.matrix_world
        for t in me.loop_triangles:
            u = sum(uv[l].uv[0] for l in t.loops) / 3; v = sum(uv[l].uv[1] for l in t.loops) / 3
            x = min(W - 1, max(0, int((u % 1) * W))); y = min(H - 1, max(0, int((v % 1) * H))); k = (y * W + x) * 4
            r, g, b = (srgb(c) for c in px[k:k + 3]); h, l, s = colorsys.rgb_to_hls(r, g, b)
            glass = b > r + 0.12 and l > 0.45 and 0.5 < h < 0.7   # light-blue glazing cells
            if not glass:
                if s > 0.25 and not (0.2 < h < 0.45): r, g, b = colorsys.hls_to_rgb(h, l * 0.8, s * 0.25)   # toy paint -> muted
                elif 0.2 < h < 0.45 and s > 0.25: r, g, b = 0.27, 0.29, 0.33    # toy green roofs -> Belfast slate
            ck = (round(r, 2), round(g, 2), round(b, 2), 1 if glass else 0)
            ci = pal.setdefault(ck, len(pal)); base = len(P)
            for vi in t.vertices:
                p = M @ me.vertices[vi].co; P.append((p.x * S, p.z * S, -p.y * S)); C.append(ci)   # Blender Z-up -> game Y-up (glTF frame)
            (IG if glass else IB).extend((base, base + 1, base + 2))
        o.evaluated_get(dg).to_mesh_clear()
    y0 = min(p[1] for p in P); xs = [p[0] for p in P]; zs = [p[2] for p in P]
    cx, cz = (max(xs) + min(xs)) / 2, (max(zs) + min(zs)) / 2; Q = 0.002
    pos = b''.join(struct.pack('<3h', round((p[0] - cx) / Q), round((p[1] - y0) / Q), round((p[2] - cz) / Q)) for p in P)
    b64 = lambda b: base64.b64encode(b).decode()
    out[key] = {'pos': b64(pos), 'col': b64(bytes(C)), 'ind': b64(struct.pack('<%dH' % len(IB), *IB)), 'gls': b64(struct.pack('<%dH' % len(IG), *IG)),
                'pal': [list(k[:3]) for k in sorted(pal, key=pal.get)], 'scale': Q, 'size': [round(max(xs) - min(xs), 2), round(max(p[1] for p in P) - y0, 2), round(max(zs) - min(zs), 2)]}
    print('MK', key, len(P) // 3, 'tris', len(IG) // 3, 'glass', out[key]['size'])
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
