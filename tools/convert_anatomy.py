"""
Z-Anatomy FBX -> GLB (Draco) converter for the BodyAtlas tool.

Source: Z-Anatomy (CC-BY-SA 4.0) per-system FBX exports in
  Resources/Models/FBX/*.fbx
Output: one Draco-compressed GLB per atlas layer in OUTPUT_DIR.

Run headless:
  blender --background --python tools/convert_anatomy.py
"""
import bpy
import os
import sys

SRC = "/tmp/zanatomy/Z-Anatomy/Resources/Models/FBX"
OUTPUT_DIR = "/tmp/zanatomy/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# atlas layer name -> source FBX
JOBS = [
    ("skeleton", "SkeletalSystem100.fbx"),
    ("muscles",  "MuscularSystem100.fbx"),
    ("nervous",  "NervousSystem100.fbx"),
    ("vessels",  "CardioVascular41.fbx"),
    ("organs",   "VisceralSystem100.fbx"),
    ("joints",   "Joints100.fbx"),
    ("regions",  "Regions of human body100.fbx"),
    ("lymph",    "LymphoidOrgans100.fbx"),
]


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def convert(layer, fbx_name):
    fbx_path = os.path.join(SRC, fbx_name)
    if not os.path.exists(fbx_path):
        print("!! MISSING %s" % fbx_path)
        return None
    reset_scene()
    print(">> importing %s" % fbx_name)
    bpy.ops.import_scene.fbx(filepath=fbx_path)

    n_mesh = sum(1 for o in bpy.context.scene.objects if o.type == 'MESH')
    print(">> %s: %d mesh objects" % (layer, n_mesh))

    out_path = os.path.join(OUTPUT_DIR, layer + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,                 # apply modifiers
        export_animations=False,           # static anatomy
        export_materials='NONE',           # atlas overrides materials with x-ray shader
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_yup=True,
    )
    mb = os.path.getsize(out_path) / 1024.0 / 1024.0
    print(">> EXPORTED %s.glb  %.1f MB  (%d meshes)" % (layer, mb, n_mesh))
    return (layer, out_path, mb, n_mesh)


def main():
    results = []
    for layer, fbx in JOBS:
        try:
            r = convert(layer, fbx)
            if r:
                results.append(r)
        except Exception as e:
            print("!! FAILED %s: %s" % (layer, e))
    print("\n==== SUMMARY ====")
    total = 0.0
    for layer, path, mb, n in results:
        total += mb
        print("  %-10s %6.1f MB  %5d meshes" % (layer, mb, n))
    print("  TOTAL      %6.1f MB" % total)


main()
