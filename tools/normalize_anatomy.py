"""Bake one shared transform into every system GLB so all layers are
mutually aligned, centered at origin, normalized to height ~2.0 (matches the
atlas skin normalization). Run after convert_anatomy.py.

  blender --background --python tools/normalize_anatomy.py
"""
import bpy, mathutils, os

OUT = "/tmp/zanatomy/output"
NORM = "/tmp/zanatomy/output/norm"
os.makedirs(NORM, exist_ok=True)
LAYERS = ["skeleton","muscles","nervous","vessels","organs","joints","regions","lymph"]
# full-body systems used to compute the shared bbox (Blender Z-up space)
REF = ["skeleton","muscles","nervous","regions"]
TARGET_H = 2.0

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def import_glb(name):
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, name + ".glb"))

def world_bbox():
    mn=[1e9]*3; mx=[-1e9]*3
    for o in bpy.data.objects:
        if o.type!='MESH': continue
        for corner in o.bound_box:
            w=o.matrix_world @ mathutils.Vector(corner)
            for i in range(3):
                mn[i]=min(mn[i],w[i]); mx[i]=max(mx[i],w[i])
    return mn,mx

# pass 1: shared bbox from reference systems
clear()
for n in REF:
    import_glb(n)
mn,mx = world_bbox()
center = mathutils.Vector(((mx[0]+mn[0])/2,(mx[1]+mn[1])/2,(mx[2]+mn[2])/2))
height = mx[2]-mn[2]                      # body long axis is Blender Z
scale = TARGET_H/height if height>0 else 1.0
print("SHARED center=%s height=%.4f scale=%.4f" % (tuple(round(c,4) for c in center), height, scale))

S = mathutils.Matrix.Scale(scale,4)
Tc = mathutils.Matrix.Translation(-center)
XFORM = S @ Tc                            # world' = scale*(world - center)

# pass 2: apply to each layer and re-export
for n in LAYERS:
    p = os.path.join(OUT, n+".glb")
    if not os.path.exists(p):
        print("skip missing", n); continue
    clear()
    import_glb(n)
    # transform only parent-less roots; children inherit (avoids compounding)
    for o in bpy.data.objects:
        if o.parent is None:
            o.matrix_world = XFORM @ o.matrix_world
    outp = os.path.join(NORM, n+".glb")
    bpy.ops.export_scene.gltf(filepath=outp, export_format='GLB', use_selection=False,
        export_apply=True, export_animations=False, export_materials='NONE',
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12, export_yup=True)
    mb=os.path.getsize(outp)/1048576.0
    print("NORM %-10s %.2f MB" % (n, mb))
print("DONE")
