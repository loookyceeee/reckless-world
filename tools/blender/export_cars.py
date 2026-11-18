"""Kenney Car Kit (CC0) -> compact vertex-colour JSON for the game's traffic.
Run: blender -b --python export_cars.py -- out.json
Colours are sampled from the kit's palette texture per face; the dominant paint colour is flagged tintable (a=0)."""
import bpy, sys, json, os, math
from collections import Counter
OUT = sys.argv[sys.argv.index('--') + 1]
SRC = '/workspace/reckless-world/research/assets/kenney/car-kit/Models/GLB format/'
# realistic targets (length, width, height, wheel diameter) in metres; body and wheels are scaled separately so the
# toy-proportioned kit reads like real UK traffic next to a 1.74 m avatar (car ~4.3 x 1.8 x 1.45, wheels ~0.65)
CARS = {'sedan': (4.5, 1.8, 1.45, 0.66), 'hatchback-sports': (4.1, 1.78, 1.42, 0.63), 'taxi': (4.6, 1.8, 1.52, 0.66),
        'van': (5.0, 2.0, 2.0, 0.7), 'suv': (4.7, 1.9, 1.72, 0.74), 'delivery': (5.6, 2.05, 2.45, 0.72)}
out = {}
for name, (length, width, height, wheelD) in CARS.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC + name + '.glb')
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    dg = bpy.context.evaluated_depsgraph_get()
    img = None; px = None
    for m in bpy.data.materials:
        if m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image: img = n.image
    if img: W, H = img.size; px = list(img.pixels)
    pal = Counter()
    tris = []
    for o in objs:
        me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); M = o.matrix_world; R = M.to_3x3().inverted().transposed()
        uv = me.uv_layers.active.data if me.uv_layers.active else None
        for t in me.loop_triangles:
            col = (0.8, 0.8, 0.8)
            if uv and px:
                u = sum(uv[l].uv[0] for l in t.loops) / 3; v = sum(uv[l].uv[1] for l in t.loops) / 3
                x = min(W - 1, max(0, int((u % 1) * W))); y = min(H - 1, max(0, int((v % 1) * H))); k = (y * W + x) * 4
                col = (px[k], px[k + 1], px[k + 2])
            elif o.active_material:
                bc = o.active_material.diffuse_color; col = (bc[0], bc[1], bc[2])
            ps = [M @ me.vertices[vi].co for vi in t.vertices]; nr = (R @ t.normal).normalized()
            area = t.area; key = tuple(round(c, 2) for c in col); pal[key] += area
            tris.append((ps, nr, key, o.name.startswith('wheel') and o.name))
        o.evaluated_get(dg).to_mesh_clear()
    # paint colour = largest-area saturated/bright colour
    def sat(c): return max(c) - min(c)
    paint = max(pal, key=lambda c: pal[c] * (0.3 + sat(c) * 2 + (0.5 if max(c) > 0.6 else 0)))
    body = [t for t in tris if not t[3]]
    xs = [p.x for t in body for p in t[0]]; ys = [p.y for t in body for p in t[0]]; zs = [p.z for t in tris for p in t[0]]
    WB = {}
    for t in tris:
        if t[3]: WB.setdefault(t[3], []).extend(t[0])
    WC = {}
    for wn, pts in WB.items():
        mn = [min(p[i] for p in pts) for i in range(3)]; mx = [max(p[i] for p in pts) for i in range(3)]
        WC[wn] = ([(a + b) / 2 for a, b in zip(mn, mx)], mx[2] - mn[2])
    # glTF import -> Blender Z-up; vehicle forward is -Y or +Y: use the longer horizontal extent as length
    lx, ly = max(xs) - min(xs), max(ys) - min(ys); cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2; z0 = min(zs)
    along_x = lx > ly
    L0, W0 = (lx, ly) if along_x else (ly, lx); H0 = max(zs) - z0
    sL, sW, sH = length / L0, width / W0, height / H0
    def tob(x, y):  # Blender ground plane -> (game x across, game z along)
        a, b = x - cx, y - cy
        return ((b * sW, a * sL) if along_x else (a * sW, -b * sL))
    palette = sorted(pal.keys()); pidx = {k: i for i, k in enumerate(palette)}
    V, VI, I = {}, [], []
    for ps, nr, key, wn in tris:
        tri = []
        for p in ps:
            if wn:
                (c, dia) = WC[wn]; k = wheelD / dia
                ccx, ccz = tob(c[0], c[1])
                # uniform wheel scale: offsets from the hub scaled by k on every axis
                dx, dy, dz = (p.x - c[0]) * k, (p.y - c[1]) * k, (p.z - c[2]) * k
                ax, az = ((dy, dx) if along_x else (dx, -dy)); ax *= 0.62  # tyre width ~0.22 m
                hubx = (1 if ccx >= 0 else -1) * (width / 2 - 0.14)  # track ~1.52 m: wheels sit under the arches, flush with the body side
                bx, by, bz = hubx + ax, wheelD / 2 + dz, ccz + az
            else:
                bx, bz = tob(p.x, p.y); by = (p.z - z0) * sH
            q = (round(bx * 500), round(by * 500), round(bz * 500), pidx[key])
            if q not in V: V[q] = len(VI); VI.append(q)
            tri.append(V[q])
        I += [tri[0], tri[2], tri[1]]
    import base64, array
    pos = array.array('h', [c for q in VI for c in q[:3]]); col = bytes(q[3] for q in VI); ind = array.array('H', I)
    out[name] = {'pos': base64.b64encode(pos.tobytes()).decode(), 'col': base64.b64encode(col).decode(), 'ind': base64.b64encode(ind.tobytes()).decode(),
                 'pal': [list(k) for k in palette], 'paint': pidx[paint], 'scale': 1 / 500}
    print(name, len(I) // 3, 'tris', len(VI), 'verts; paint', paint, 'along_x', along_x)
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print('wrote', OUT, os.path.getsize(OUT))
