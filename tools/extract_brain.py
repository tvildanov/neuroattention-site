"""Extract anatomically-named brain regions from Z-Anatomy nervous.glb.

Keeps cortex (gyri+sulci grouped by lobe), cerebellum, brainstem and deep
subcortical nuclei — dropping spinal cord, peripheral nerves, eye/ear and the
opaque telencephalic white-matter blobs. Each kept mesh is tagged with a
canonical `regionId` (for the atlas panel/i18n) and `regionName` (the raw
anatomical label, for fine hover tooltips), written to glTF node.extras so the
three.js loader exposes them on child.userData with no JS-side classifier.

Run:  blender --background --python tools/extract_brain.py
"""
import bpy, os, re

SRC = os.environ.get('BRAIN_SRC', '/tmp/nervous.glb')
OUT = os.environ.get('BRAIN_OUT', '/tmp/brain-output/brain-detail.glb')

EXCLUDE = re.compile(r'(nerve|plexus|ganglion|ganglia|sympathetic trunk|\brami\b|root of|spinal|\bcord\b|cauda|eyeball|cornea|\biris\b|\blens\b|retina|sclera|cochlea|vestibul|tympanic|auditory|nasolacrimal|lacrimal|\bpupil|ciliary|ophthalmic|zonular|vitreous|conjunctiva|eyelid|\borbit\b|meninges|\bdura\b|falx|tentorium|choroid plexus|ependyma|arachnoid|auditory tube|ampulla|semicircular|bony limb|\bmembrane\b|chamber of eyeball|pole of eyeball|segment of eyeball|suspensory|chorda|ventricle|white matter of telencephalon|fasciculus proprius|corticospinal|spinothalamic|reticulospinal|vestibulospinal|rubrospinal|tectospinal|spinotectal|posterolateral tract|cuneate fasciculus|gracile fasciculus|central canal|nucleus proprius|intermediolateral|intermediomedial|lateral intermediate substance)', re.I)

def classify(raw):
    n = raw.strip().lower()
    if EXCLUDE.search(n): return None
    if 'caudate' in n or 'putamen' in n or 'pallidus' in n or 'lentiform' in n or 'corpus striatum' in n or 'dorsal striatum' in n: return 'basal-ganglia'
    if 'amygdaloid' in n: return 'amygdala'
    if 'hippocamp' in n: return 'hippocampus'
    if n.startswith('fornix'): return 'fornix'
    if 'thalamus' in n and 'hypothalamus' not in n: return 'thalamus'
    if 'geniculate body' in n or n.startswith('habenula') or 'stria medullaris' in n or n.startswith('pulvinar'): return 'thalamus'
    if 'hypothalamus' in n or 'mamillary' in n or 'mammillary' in n: return 'hypothalamus'
    if 'corpus callosum' in n or 'commissure' in n: return 'corpus-callosum'
    if 'medulla oblongata' in n or 'pyramid of medulla' in n or n.startswith('olive') or 'olivary' in n: return 'medulla'
    if n.startswith('pons') or 'basilar part of pons' in n or 'tegmentum of pons' in n or 'pontine' in n: return 'pons'
    if 'midbrain' in n or 'colliculus' in n or 'red nucleus' in n or 'cerebral peduncle' in n or 'tectum' in n or 'tegmentum of midbrain' in n or 'substantia nigra' in n or n.startswith('peduncle') or 'interpeduncular' in n or 'aqueduct of midbrain' in n or 'base of peduncle' in n: return 'midbrain'
    CEREB = ['cerebellum','cerebellar','culmen','declive','folium','tuber of vermis','pyramis','uvula of vermis','nodule of vermis','lingula of cerebellum','central lobule','wing of central','biventral','quadrangular lobule','semilunar lobule','gracile lobule','tonsil of cerebellum','flocculus','vermis']
    if any(k in n for k in CEREB): return 'cerebellum'
    if 'cingulate' in n or n.startswith('limbic') or 'parahippocampal' in n or 'septal nuclei' in n or 'septum pellucidum' in n: return 'cingulate'
    if 'precuneus' in n: return 'parietal-lobe'
    OCC=['cuneus','lingual gyrus','occipital gyr','occipital sulcus','occipital pole','calcarine','lunate sulcus','parieto-occipital','occipital lobe']
    if any(k in n for k in OCC): return 'occipital-lobe'
    TEMP=['temporal gyr','temporal sulcus','temporal pole','temporal plane','transverse temporal','occipitotemporal','temporal lobe','fusiform']
    if any(k in n for k in TEMP): return 'temporal-lobe'
    PAR=['postcentral','parietal lob','supramarginal','angular gyrus','intraparietal','subparietal','paracentral']
    if any(k in n for k in PAR): return 'parietal-lobe'
    if 'insula' in n: return 'insula'
    FRO=['frontal gyr','frontal sulcus','frontal lobe','precentral','straight gyrus','gyrus rectus','orbital gyr','orbital sulc','orbital part','opercular part','triangular part','frontopolar','frontomarginal','olfactory sulcus','frontal pole']
    if any(k in n for k in FRO): return 'frontal-lobe'
    return None

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

kept, dropped = [], 0
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    # vertex guard: skip empty placeholder group meshes (.j ~24 verts)
    nverts = len(obj.data.vertices)
    region = classify(obj.name)
    if region is None or nverts <= 30:
        bpy.data.objects.remove(obj, do_unlink=True)
        dropped += 1
        continue
    obj['regionId'] = region
    obj['regionName'] = obj.name.strip()
    kept.append((obj.name.strip(), region, nverts))

# drop now-childless empties to keep the file clean
for obj in list(bpy.context.scene.objects):
    if obj.type == 'EMPTY' and not obj.children:
        bpy.data.objects.remove(obj, do_unlink=True)

from collections import Counter
by_region = Counter(r for _,r,_ in kept)
print("\n=== KEPT %d meshes, dropped %d ===" % (len(kept), dropped))
for r in sorted(by_region):
    print("  %-16s %d" % (r, by_region[r]))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_extras=True,         # <-- exports obj['regionId'] etc to node.extras
    export_apply=True,
)
mb = os.path.getsize(OUT)/1024/1024
print("Output: %.2f MB  ->  %s" % (mb, OUT))
