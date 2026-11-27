"""Flatten + smooth G_tee / G_teeD hem (and mild neck/cuff smooth) in a raw glTF GLB.
glTF is Y-up. Topology, UVs, weights, COLOR_0 and the rest of the file are unchanged.
"""
import json, struct
from pathlib import Path
from collections import defaultdict
import numpy as np

COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
VECN = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

def load_glb(path):
    data = Path(path).read_bytes()
    json_len, typ = struct.unpack_from("<II", data, 12)
    js = json.loads(data[20:20 + json_len])
    json_end = 20 + json_len
    pad = (4 - (json_end % 4)) % 4
    bin_header = json_end + pad
    bin_len, typ2 = struct.unpack_from("<II", data, bin_header)
    blob = bytearray(data[bin_header + 8: bin_header + 8 + bin_len])
    return js, blob

def acc_arr(js, blob, acc_i):
    a = js["accessors"][acc_i]
    bv = js["bufferViews"][a["bufferView"]]
    off = (bv.get("byteOffset") or 0) + (a.get("byteOffset") or 0)
    n, typ, ctype = a["count"], a["type"], a["componentType"]
    comps, (fmt, width) = VECN[typ], COMP[ctype]
    arr = np.frombuffer(blob[off:off + n * comps * width], dtype=np.dtype("<" + fmt), count=n * comps).reshape(n, comps).copy()
    return arr, a, off

def write_arr(blob, off, arr):
    blob[off:off + arr.nbytes] = np.ascontiguousarray(arr).tobytes()

def indices(js, blob, prim):
    arr, a, off = acc_arr(js, blob, prim["indices"])
    return arr.reshape(-1).astype(np.int64)

def boundary_adj(idx):
    ev = defaultdict(int)
    faces = idx.reshape(-1, 3)
    for a, b, c in faces:
        for u, v in ((int(a), int(b)), (int(b), int(c)), (int(c), int(a))):
            e = (u, v) if u < v else (v, u)
            ev[e] += 1
    adj = defaultdict(list)
    for (u, v), k in ev.items():
        if k == 1:
            adj[u].append(v); adj[v].append(u)
    return adj

def rescale(orig, nxt):
    o0, o1 = orig.min(), orig.max()
    n0, n1 = nxt.min(), nxt.max()
    if o1 - o0 < 1e-6 or n1 - n0 < 1e-6:
        return nxt
    mid_o = 0.5 * (o0 + o1)
    mid_n = 0.5 * (n0 + n1)
    s = (o1 - o0) / (n1 - n0)
    return mid_o + (nxt - mid_n) * s

def smooth_group(pos, verts, adj, *, flatten_axis=None, flatten='median', iters=8, keep=0.30, axes=(0, 2)):
    """pos is (N,3). verts is a list of vertex indices. adj is boundary adjacency.
    flatten_axis: axis to set constant. axes: the two axes to Laplacian-smooth, then rescale.
    """
    if len(verts) < 8:
        return
    V = np.array(verts, dtype=np.int64)
    if flatten_axis is not None:
        vals = pos[V, flatten_axis]
        z0 = np.median(vals) if flatten == 'median' else vals.mean()
        pos[V, flatten_axis] = z0
    for _ in range(iters):
        new = pos[V].copy()
        for i, v in enumerate(V):
            nbrs = [n for n in adj[int(v)] if n in set(map(int, V))]
            if not nbrs:
                continue
            avg = pos[np.array(nbrs)].mean(0)
            new[i] = pos[v] * keep + avg * (1 - keep)
        # rescale the smoothed axes to keep width/depth
        for ax in axes:
            new[:, ax] = rescale(pos[V, ax], new[:, ax])
        if flatten_axis is not None:
            new[:, flatten_axis] = pos[V[0], flatten_axis]
        pos[V] = new

def fix_tee(js, blob, name):
    node = next(n for n in js["nodes"] if n.get("name") == name)
    prim = js["meshes"][node["mesh"]]["primitives"][0]
    pos, a_pos, off_pos = acc_arr(js, blob, prim["attributes"]["POSITION"])
    nrm, a_nrm, off_nrm = acc_arr(js, blob, prim["attributes"]["NORMAL"])
    idx = indices(js, blob, prim)
    adj = boundary_adj(idx)
    bverts = sorted(adj.keys())
    # glTF Y-up: X right, Y height, Z depth
    ys = pos[bverts, 1]
    ymin, ymax = ys.min(), ys.max()
    hem = [v for v in bverts if pos[v, 1] <= ymin + 0.012]
    neck = [v for v in bverts if pos[v, 1] >= ymax - 0.07 and abs(pos[v, 0]) < 0.16]
    cuffs = [v for v in bverts if abs(pos[v, 0]) > 0.22 and pos[v, 1] > ymin + 0.12]
    cuff_l = [v for v in cuffs if pos[v, 0] < 0]
    cuff_r = [v for v in cuffs if pos[v, 0] > 0]
    z0 = pos[hem, 1].min() if hem else 0
    z1 = pos[hem, 1].max() if hem else 0
    # Hem: flatten Y, smooth XZ
    smooth_group(pos, hem, adj, flatten_axis=1, flatten='median', iters=10, keep=0.30, axes=(0, 2))
    # Neck: mild smooth, keep most of the front dip (Y)
    if len(neck) >= 8:
        V = np.array(neck)
        for _ in range(5):
            new = pos[V].copy()
            sset = set(map(int, V))
            for i, v in enumerate(V):
                nbrs = [n for n in adj[int(v)] if n in sset]
                if not nbrs:
                    continue
                avg = pos[np.array(nbrs)].mean(0)
                # keep 40% XY, 70% Y
                new[i, 0] = pos[v, 0] * 0.4 + avg[0] * 0.6
                new[i, 2] = pos[v, 2] * 0.4 + avg[2] * 0.6
                new[i, 1] = pos[v, 1] * 0.7 + avg[1] * 0.3
            pos[V] = new
    # Cuffs: pull X toward median, mild smooth
    for group in (cuff_l, cuff_r):
        if len(group) < 8:
            continue
        V = np.array(group)
        x0 = np.median(pos[V, 0])
        pos[V, 0] = pos[V, 0] * 0.4 + x0 * 0.6
        for _ in range(4):
            new = pos[V].copy()
            sset = set(map(int, V))
            for i, v in enumerate(V):
                nbrs = [n for n in adj[int(v)] if n in sset]
                if not nbrs:
                    continue
                avg = pos[np.array(nbrs)].mean(0)
                new[i, 0] = pos[v, 0] * 0.5 + avg[0] * 0.5
                new[i, 1] = pos[v, 1] * 0.35 + avg[1] * 0.65
                new[i, 2] = pos[v, 2] * 0.35 + avg[2] * 0.65
            pos[V] = new
    # recompute normals for moved verts (and their 1-ring) from faces
    moved = set(hem) | set(neck) | set(cuff_l) | set(cuff_r)
    # also 1-ring
    faces = idx.reshape(-1, 3)
    ring = set(moved)
    for a, b, c in faces:
        if a in moved or b in moved or c in moved:
            ring.update((int(a), int(b), int(c)))
    # accumulate face normals
    acc = np.zeros_like(pos)
    cnt = np.zeros((len(pos),), np.int32)
    p = pos
    for a, b, c in faces:
        a, b, c = int(a), int(b), int(c)
        if not (a in ring or b in ring or c in ring):
            continue
        n = np.cross(p[b] - p[a], p[c] - p[a])
        ln = np.linalg.norm(n)
        if ln < 1e-12:
            continue
        n /= ln
        for v in (a, b, c):
            acc[v] += n; cnt[v] += 1
    for v in ring:
        if cnt[v]:
            n = acc[v] / np.linalg.norm(acc[v])
            nrm[v] = n
    write_arr(blob, off_pos, pos.astype(np.float32))
    write_arr(blob, off_nrm, nrm.astype(np.float32))
    a_pos["min"] = pos.min(0).astype(float).tolist()
    a_pos["max"] = pos.max(0).astype(float).tolist()
    z0b, z1b = (pos[hem, 1].min(), pos[hem, 1].max()) if hem else (0, 0)
    print(f"  {name}: hem n={len(hem)} y {z0:.4f}..{z1:.4f} -> {z0b:.4f}..{z1b:.4f}; neck={len(neck)} cuffL={len(cuff_l)} cuffR={len(cuff_r)}")

def write_glb(js, blob, dest):
    js_bytes = json.dumps(js, separators=(",", ":")).encode("utf-8")
    js_pad = (4 - (len(js_bytes) % 4)) % 4
    js_bytes += b" " * js_pad
    blob_pad = (4 - (len(blob) % 4)) % 4
    blob_out = bytes(blob) + b"\x00" * blob_pad
    out = bytearray()
    total = 12 + 8 + len(js_bytes) + 8 + len(blob_out)
    out += struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(js_bytes), 0x4E4F534A)
    out += js_bytes
    out += struct.pack("<II", len(blob_out), 0x004E4942)
    out += blob_out
    Path(dest).write_bytes(out)
    print("wrote", dest, len(out))

def process(src, dst):
    js, blob = load_glb(src)
    print("===", src)
    for name in ("G_tee", "G_teeD"):
        fix_tee(js, blob, name)
    write_glb(js, blob, dst)

if __name__ == "__main__":
    base = "/workspace/reckless-world/avatar-quality-pass/work2"
    process(f"{base}/av_raw.glb", f"{base}/av_raw_hem_patched.glb")
    process(f"{base}/av_raw_f.glb", f"{base}/av_raw_f_hem_patched.glb")
