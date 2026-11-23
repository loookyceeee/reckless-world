#!/usr/bin/env python3
"""Copy Body skin weights onto G_tee / G_teeD in a glTF/GLB (nearest-vertex).

TEE2 rebuilds the tee mesh, but the Blender data-transfer can fail and leave every
vertex on the exporter's fallback `neutral_bone`. The game then has a solid shell
that does not follow the spine or arms. This patches JOINTS_0 / WEIGHTS_0 in place
without touching UVs, positions, or materials.
"""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree


COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
VECN = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def load_glb(path: Path):
    data = path.read_bytes()
    magic, ver, length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise SystemExit(f"not a GLB: {path}")
    json_len, json_type = struct.unpack_from("<II", data, 12)
    js = json.loads(data[20 : 20 + json_len])
    json_end = 20 + json_len
    pad = (4 - (json_end % 4)) % 4
    bin_header = json_end + pad
    bin_len, bin_type = struct.unpack_from("<II", data, bin_header)
    blob = bytearray(data[bin_header + 8 : bin_header + 8 + bin_len])
    return js, blob, data[:12]


def acc_view(js, blob, acc_i, writable=False):
    acc = js["accessors"][acc_i]
    bv = js["bufferViews"][acc["bufferView"]]
    off = (bv.get("byteOffset") or 0) + (acc.get("byteOffset") or 0)
    n, typ, ctype = acc["count"], acc["type"], acc["componentType"]
    fmt, width = COMP[ctype]
    comps = VECN[typ]
    stride = bv.get("byteStride") or comps * width
    if stride != comps * width:
        raise SystemExit(f"strided accessor {acc_i}")
    dtype = np.dtype("<" + fmt)
    buf = memoryview(blob)[off : off + n * comps * width]
    arr = np.frombuffer(buf, dtype=dtype, count=n * comps).reshape(n, comps)
    return arr, acc


def node_prim(js, name):
    node = next(n for n in js["nodes"] if n.get("name") == name)
    prim = js["meshes"][node["mesh"]]["primitives"][0]
    return node, prim


def joint_names(js, skin_i):
    skin = js["skins"][skin_i]
    return [js["nodes"][i].get("name") for i in skin["joints"]]


def transfer(js, blob, src="Body", targets=("G_tee", "G_teeD")):
    _, sprim = node_prim(js, src)
    spos, _ = acc_view(js, blob, sprim["attributes"]["POSITION"])
    sj, _ = acc_view(js, blob, sprim["attributes"]["JOINTS_0"])
    sw, _ = acc_view(js, blob, sprim["attributes"]["WEIGHTS_0"])
    tree = cKDTree(np.ascontiguousarray(spos, dtype=np.float64))
    report = []
    for name in targets:
        try:
            node, prim = node_prim(js, name)
        except StopIteration:
            report.append((name, "missing"))
            continue
        pos, _ = acc_view(js, blob, prim["attributes"]["POSITION"])
        j, jacc = acc_view(js, blob, prim["attributes"]["JOINTS_0"])
        w, wacc = acc_view(js, blob, prim["attributes"]["WEIGHTS_0"])
        # k=3 inverse-distance blend, then collapse to 4 influences
        dist, idx = tree.query(np.ascontiguousarray(pos, dtype=np.float64), k=3, workers=-1)
        dist = np.maximum(dist, 1e-6)
        wt = 1.0 / dist
        wt /= wt.sum(axis=1, keepdims=True)
        newj = np.zeros((len(pos), 4), dtype=j.dtype)
        neww = np.zeros((len(pos), 4), dtype=np.float32)
        for i in range(len(pos)):
            acc = {}
            for k in range(3):
                for c in range(4):
                    ww = float(sw[idx[i, k], c]) * float(wt[i, k])
                    if ww <= 1e-8:
                        continue
                    ji = int(sj[idx[i, k], c])
                    acc[ji] = acc.get(ji, 0.0) + ww
            top = sorted(acc.items(), key=lambda x: -x[1])[:4]
            s = sum(v for _, v in top) or 1.0
            for c, (ji, v) in enumerate(top):
                newj[i, c] = ji
                neww[i, c] = v / s
        # write back (accessors may be integer joints)
        j[:] = newj
        if w.dtype == np.float32:
            w[:] = neww
        else:
            raise SystemExit(f"{name} weights are {w.dtype}, expected float32")
        used = {}
        for i in range(len(neww)):
            for c in range(4):
                if neww[i, c] > 1e-6:
                    used[int(newj[i, c])] = used.get(int(newj[i, c]), 0.0) + float(neww[i, c])
        skin_i = node.get("skin") or 0
        names = joint_names(js, skin_i)
        topn = sorted(used.items(), key=lambda x: -x[1])[:12]
        label = ", ".join(f"{names[ji] if ji < len(names) else ji}:{s:.0f}" for ji, s in topn)
        report.append((name, f"verts={len(pos)} joints={len(used)} top={label}"))
    return report


def save_glb(path: Path, header12: bytes, js: dict, blob: bytearray):
    js_bytes = json.dumps(js, separators=(",", ":")).encode("utf-8")
    if len(js_bytes) % 4:
        js_bytes += b" " * (4 - (len(js_bytes) % 4))
    bin_pad = (4 - (len(blob) % 4)) % 4
    bin_bytes = bytes(blob) + (b"\x00" * bin_pad)
    # keep declared buffer length in JSON in sync
    if js.get("buffers"):
        js["buffers"][0]["byteLength"] = len(blob)
        js_bytes = json.dumps(js, separators=(",", ":")).encode("utf-8")
        if len(js_bytes) % 4:
            js_bytes += b" " * (4 - (len(js_bytes) % 4))
    total = 12 + 8 + len(js_bytes) + 8 + len(bin_bytes)
    out = bytearray()
    out += struct.pack("<III", 0x46546C67, 2, total)
    out += struct.pack("<II", len(js_bytes), 0x4E4F534A)
    out += js_bytes
    out += struct.pack("<II", len(bin_bytes), 0x004E4942)
    out += bin_bytes
    path.write_bytes(out)


def main():
    if len(sys.argv) < 3:
        print("usage: xfer_tee_weights.py IN.glb OUT.glb", file=sys.stderr)
        sys.exit(2)
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    js, blob, _ = load_glb(src)
    report = transfer(js, blob)
    for name, msg in report:
        print(name, msg)
        if "neutral_bone" in msg and msg.split("joints=")[1].startswith("1 "):
            raise SystemExit("transfer still only hits neutral_bone")
        if name != "missing" and "joints=" in msg:
            n = int(msg.split("joints=")[1].split()[0])
            if n < 6:
                raise SystemExit(f"{name}: only {n} joints after transfer")
    save_glb(dst, b"", js, blob)
    print("wrote", dst, "bytes", dst.stat().st_size)


if __name__ == "__main__":
    main()
