#!/usr/bin/env python3
"""Dependency-free GLB inspector — extracts node & mesh names from the JSON chunk.

GLB layout: 12-byte header, then chunks [u32 len][u32 type][bytes].
JSON chunk type = 0x4E4F534A. We only need names, not geometry.
"""
import json
import struct
import sys


def read_glb_json(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, version, length = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67:
        raise ValueError(f"{path}: not a GLB (magic={magic:#x})")
    off = 12
    while off < length:
        clen, ctype = struct.unpack_from("<II", data, off)
        off += 8
        chunk = data[off:off + clen]
        off += clen
        if ctype == 0x4E4F534A:  # 'JSON'
            return json.loads(chunk.decode("utf-8"))
    raise ValueError(f"{path}: no JSON chunk")


def main():
    in_glb, out_json = sys.argv[1], sys.argv[2]
    g = read_glb_json(in_glb)
    nodes = g.get("nodes", [])
    meshes = g.get("meshes", [])

    # node -> mesh linkage; the hit-testable unit is a node that points at a mesh
    named = []
    for i, n in enumerate(nodes):
        nm = n.get("name")
        has_mesh = "mesh" in n
        if nm and has_mesh:
            named.append({"name": nm, "mesh_index": n["mesh"], "node_index": i})

    # also collect standalone mesh names (some exporters name the mesh not the node)
    mesh_names = [m.get("name") for m in meshes if m.get("name")]

    out = {
        "file": in_glb,
        "total_nodes": len(nodes),
        "total_meshes": len(meshes),
        "named_mesh_nodes": named,
        "named_mesh_nodes_count": len(named),
        "mesh_names": mesh_names,
    }
    with open(out_json, "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"{in_glb}: nodes={len(nodes)} meshes={len(meshes)} named_mesh_nodes={len(named)}")


if __name__ == "__main__":
    main()
