#!/usr/bin/env python3
"""Zip open side/armpit seams on G_tee / G_teeD, leaving neck, hem and cuffs open."""
from __future__ import annotations
import json, struct, sys
from collections import defaultdict
from pathlib import Path
import numpy as np

COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
VECN = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def load_glb(path: Path):
    data = path.read_bytes()
    json_len, _ = struct.unpack_from("<II", data, 12)
    js = json.loads(data[20:20 + json_len])
    json_end = 20 + json_len
    pad = (4 - (json_end % 4)) % 4
    bin_header = json_end + pad
    bin_len, _ = struct.unpack_from("<II", data, bin_header)
    blob = bytearray(data[bin_header + 8: bin_header + 8 + bin_len])
    return js, blob


def acc_arr(js, blob, acc_i):
    a = js["accessors"][acc_i]
    bv = js["bufferViews"][a["bufferView"]]
    off = (bv.get("byteOffset") or 0) + (a.get("byteOffset") or 0)
    n, typ, ctype = a["count"], a["type"], a["componentType"]
    comps, (fmt, width) = VECN[typ], COMP[ctype]
    arr = np.frombuffer(blob[off:off + n * comps * width], dtype=np.dtype("<" + fmt), count=n * comps).reshape(n, comps).copy()
    return arr, a, bv, off


def node_prim(js, name):
    node = next(n for n in js["nodes"] if n.get("name") == name)
    return node, js["meshes"][node["mesh"]]["primitives"][0]


def boundary_edges(idx):
    ev = defaultdict(int)
    for a, b, c in idx:
        for u, v in ((int(a), int(b)), (int(b), int(c)), (int(c), int(a))):
            e = (u, v) if u < v else (v, u)
            ev[e] += 1
    return [e for e, k in ev.items() if k == 1]


def classify(pos, edges):
    ys = pos[:, 1]
    ymin, ymax = float(ys.min()), float(ys.max())
    hem, neck, cuff, slit = [], [], [], []
    # cuff: far out on x, mid-high (sleeves)
    # neck: high, near centre
    # hem: along the bottom plane
    for u, v in edges:
        yu, yv = pos[u, 1], pos[v, 1]
        xu, xv = pos[u, 0], pos[v, 0]
        ru = np.hypot(pos[u, 0], pos[u, 2])
        rv = np.hypot(pos[v, 0], pos[v, 2])
        if yu <= ymin + 0.018 and yv <= ymin + 0.018:
            hem.append((u, v))
        elif yu >= ymax - 0.07 and yv >= ymax - 0.07 and max(abs(xu), abs(xv)) < 0.16:
            neck.append((u, v))
        elif min(abs(xu), abs(xv)) > 0.22 and yu > ymin + 0.12 and yv > ymin + 0.12:
            cuff.append((u, v))
        else:
            slit.append((u, v))
    return hem, neck, cuff, slit


def zip_slits(pos, slit):
    """Pair nearby non-adjacent slit vertices (front/back at similar x,y) and emit triangles."""
    verts = sorted({i for e in slit for i in e})
    if not verts:
        return []
    # adjacency along the slit
    adj = defaultdict(set)
    for u, v in slit:
        adj[u].add(v); adj[v].add(u)
    P = pos[verts]
    # greedy matching: each vert to nearest eligible partner
    used = set()
    pairs = []
    # search radius: side seams are a few cm apart (front vs back)
    for i, vi in enumerate(verts):
        if vi in used:
            continue
        d = np.linalg.norm(P - P[i], axis=1)
        order = np.argsort(d)
        for j in order[1:]:
            vj = verts[int(j)]
            if vj in used or vj in adj[vi]:
                continue
            if d[j] > 0.055:
                break
            # prefer opposite front/back (z differs) at similar x and y
            if abs(pos[vi, 0] - pos[vj, 0]) > 0.04:
                continue
            if abs(pos[vi, 1] - pos[vj, 1]) > 0.045:
                continue
            if abs(pos[vi, 2] - pos[vj, 2]) < 0.008:
                continue
            used.add(vi); used.add(vj)
            pairs.append((vi, vj, d[j]))
            break
    pairs.sort(key=lambda p: (0.5 * (pos[p[0], 1] + pos[p[1], 1]), pos[p[0], 0]))
    # connect consecutive pairs into quads (two tris) along each side
    # group by left/right
    left = [p for p in pairs if 0.5 * (pos[p[0], 0] + pos[p[1], 0]) < 0]
    right = [p for p in pairs if 0.5 * (pos[p[0], 0] + pos[p[1], 0]) >= 0]
    tris = []
    def stitch(chain):
        chain = sorted(chain, key=lambda p: 0.5 * (pos[p[0], 1] + pos[p[1], 1]))
        for a, b in zip(chain, chain[1:]):
            a0, a1 = a[0], a[1]
            b0, b1 = b[0], b[1]
            # order so triangles don't flip: match nearer endpoints
            if np.linalg.norm(pos[a0] - pos[b0]) > np.linalg.norm(pos[a0] - pos[b1]):
                b0, b1 = b1, b0
            tris.append((a0, b0, a1))
            tris.append((a1, b0, b1))
    stitch(left); stitch(right)
    return tris, pairs


def append_indices(js, blob, prim, new_tris):
    if not new_tris:
        return 0
    idx, acc, bv, off = acc_arr(js, blob, prim["indices"])
    extra = np.asarray(new_tris, dtype=idx.dtype).reshape(-1)
    merged = np.concatenate([np.asarray(idx).reshape(-1), extra], axis=0)
    raw = merged.astype(idx.dtype).tobytes()
    # append to end of blob (don't overwrite)
    if len(blob) % 4:
        blob.extend(b"\x00" * (4 - len(blob) % 4))
    new_off = len(blob)
    blob.extend(raw)
    if len(blob) % 4:
        blob.extend(b"\x00" * (4 - len(blob) % 4))
    # new bufferView + accessor so we don't disturb others
    js["bufferViews"].append({"buffer": 0, "byteOffset": new_off, "byteLength": len(raw), "target": 34963})
    new_acc = dict(acc)
    new_acc["bufferView"] = len(js["bufferViews"]) - 1
    new_acc["byteOffset"] = 0
    new_acc["count"] = int(merged.size)
    # max/min
    new_acc["max"] = [int(merged.max())]
    new_acc["min"] = [int(merged.min())]
    js["accessors"].append(new_acc)
    prim["indices"] = len(js["accessors"]) - 1
    js["buffers"][0]["byteLength"] = len(blob)
    return len(extra)


def save_glb(path, js, blob):
    js["buffers"][0]["byteLength"] = len(blob)
    js_bytes = json.dumps(js, separators=(",", ":")).encode("utf-8")
    if len(js_bytes) % 4:
        js_bytes += b" " * (4 - len(js_bytes) % 4)
    bin_pad = (4 - (len(blob) % 4)) % 4
    bin_bytes = bytes(blob) + (b"\x00" * bin_pad)
    total = 12 + 8 + len(js_bytes) + 8 + len(bin_bytes)
    out = bytearray()
    out += struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(js_bytes), 0x4E4F534A)
    out += js_bytes
    out += struct.pack("<II", len(bin_bytes), 0x004E4942)
    out += bin_bytes
    path.write_bytes(out)


def stitch_one(js, blob, name):
    node, prim = node_prim(js, name)
    pos, _, _, _ = acc_arr(js, blob, prim["attributes"]["POSITION"])
    idx, _, _, _ = acc_arr(js, blob, prim["indices"])
    idx = np.asarray(idx).reshape(-1, 3)
    edges = boundary_edges(idx)
    hem, neck, cuff, slit = classify(pos, edges)
    tris, pairs = zip_slits(pos, slit)
    n = append_indices(js, blob, prim, tris)
    print(f"{name}: bound={len(edges)} hem={len(hem)} neck={len(neck)} cuff={len(cuff)} slit={len(slit)} pairs={len(pairs)} newtris={n}")
    return n


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    js, blob = load_glb(src)
    for name in ("G_tee", "G_teeD"):
        try:
            stitch_one(js, blob, name)
        except StopIteration:
            print(name, "missing")
    save_glb(dst, js, blob)
    print("wrote", dst, "bytes", dst.stat().st_size)


if __name__ == "__main__":
    main()
