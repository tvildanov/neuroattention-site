"""Extract the full anatomically-named brain subset from Z-Anatomy nervous.glb.

Keeps EVERY brain mesh Z-Anatomy provides (cortex gyri + sulci, cerebellar
lobules, brainstem nuclei, diencephalon, deep nuclei, ventricles, commissures,
optic chiasm/tract) so each becomes its own hit-testable region. Drops only the
non-brain structures (spinal cord, peripheral nerves, eye, ear, meninges) and
the two opaque telencephalic white-matter blobs that would occlude the interior.

Each kept mesh is tagged in glTF node.extras with:
  regionName : raw Z-Anatomy label (e.g. "Superior frontal gyrus.l")
  base       : side-stripped, cleaned label (e.g. "Superior frontal gyrus")
  slug       : stable key for the i18n dictionary (e.g. "superior_frontal_gyrus")
  side       : "l" | "r" | ""  (for localized "(left)/(right)" suffixing)
  coarseId   : coarse region id for colour + the region-panel description

Run:  blender --background --python tools/extract_brain.py
"""
import bpy, os, re

SRC = os.environ.get('BRAIN_SRC', '/tmp/nervous.glb')
OUT = os.environ.get('BRAIN_OUT', '/tmp/brain-output/brain-detail.glb')

# NOT brain: peripheral nerves, spinal cord, sensory organs, meninges, WM blobs.
# NB: "cauda equina" is spelled out so the substring "cauda" does NOT eat
# "Caudate"; "central canal" is the spinal canal, not a brain cavity.
NOTBRAIN = re.compile(r'(\bnerves?\b|intercostal|plexus|ganglion|ganglia|sympathetic|\brami\b|spinal|\bcord\b|cauda equina|eyeball|cornea|\biris\b|\blens\b|retina|sclera|cochlea|vestibul|tympanic|auditory tube|nasolacrimal|lacrimal|\bpupil|ciliary|ophthalmic|zonular|vitreous|conjunctiva|eyelid|\borbit\b|external ear|middle ear|internal ear|\bear\b|meninges|\bdura\b|falx|tentorium|arachnoid|ampulla|semicircular|bony limb|simple bony|common bony|\bmembrane\b|chamber of eyeball|pole of eyeball|segment of eyeball|surface of (cornea|iris)|suspensory|chorda|fasciculus proprius|corticospinal|spinocerebellar|spinothalamic|reticulospinal|vestibulospinal|rubrospinal|tectospinal|spinotectal|posterolateral tract|cuneate fasciculus|gracile fasciculus|intermediolateral|intermediomedial|lateral intermediate substance|nucleus proprius|funiculus|anterior median fissure|anterolateral|retro-olivary|trigeminal tubercle|cuneate tubercle|gracile tubercle|peripheral|roots of nerves|autonomic division|central canal|white matter of telencephalon)', re.I)


def is_brain(raw):
    low = raw.strip().lower()
    if low.endswith('.j'):
        return False                  # group / label placeholder meshes
    return not NOTBRAIN.search(low)


def split_side(raw):
    m = re.search(r'\.(l|r)$', raw.strip(), re.I)
    if m:
        return raw.strip()[:m.start()], m.group(1).lower()
    return raw.strip(), ''


def base_name(raw):
    b, _ = split_side(raw)
    b = b.replace('*', '')
    b = re.sub(r'\s+', ' ', b).strip()
    return b


def slugify(s):
    s = s.lower().replace("'", '')
    s = re.sub(r'[^a-z0-9]+', '_', s)
    return s.strip('_')


def coarse(raw):
    n = raw.lower()
    if any(k in n for k in ['caudate', 'putamen', 'pallidus', 'lentiform', 'corpus striatum', 'dorsal striatum', 'basal forebrain', 'septal nuclei', 'septum pellucidum']): return 'basal-ganglia'
    if 'amygdaloid' in n: return 'amygdala'
    if 'hippocamp' in n: return 'hippocampus'
    if n.startswith('fornix'): return 'fornix'
    if ('thalamus' in n and 'hypo' not in n) or 'geniculate body' in n or n.startswith('habenula') or 'stria medullaris' in n or 'stria terminalis' in n: return 'thalamus'
    if 'hypothalamus' in n or 'mamillary' in n or 'optic chiasm' in n or 'optic tract' in n: return 'hypothalamus'
    if 'corpus callosum' in n or 'commissure' in n: return 'corpus-callosum'
    if 'ventricle' in n or 'choroid plexus' in n: return 'ventricles'
    if 'medulla oblongata' in n or 'pyramid of medulla' in n or n.startswith('olive') or 'olivary' in n or 'salivatory' in n or 'ambiguus' in n or 'solitary' in n or 'hypoglossal' in n or 'cochlear nucleus' in n or 'vestibular nuclei' in n or 'vagus' in n: return 'medulla'
    if n.startswith('pons') or 'pontine' in n or 'basilar part of pons' in n or 'tegmentum of pons' in n or 'abducens' in n: return 'pons'
    if 'midbrain' in n or 'colliculus' in n or 'red nucleus' in n or 'cerebral peduncle' in n or 'tectum' in n or 'tegmentum of midbrain' in n or 'substantia nigra' in n or n.startswith('peduncle') or 'interpeduncular' in n or 'aqueduct of midbrain' in n or 'base of peduncle' in n or 'oculomotor' in n or 'trochlear' in n: return 'midbrain'
    if any(k in n for k in ['cerebellum', 'cerebellar', 'culmen', 'declive', 'folium', 'tuber of vermis', 'pyramis', 'uvula of vermis', 'nodule of vermis', 'lingula of cerebellum', 'central lobule', 'wing of central', 'biventral', 'quadrangular lobule', 'semilunar lobule', 'gracile lobule', 'tonsil of cerebellum', 'flocculus', 'vermis']): return 'cerebellum'
    if 'cingulate' in n or n.startswith('limbic') or 'parahippocampal' in n: return 'cingulate'
    if 'precuneus' in n: return 'parietal-lobe'
    if any(k in n for k in ['cuneus', 'lingual gyrus', 'occipital gyr', 'occipital sulcus', 'occipital pole', 'calcarine', 'lunate sulcus', 'parieto-occipital', 'occipital lobe']): return 'occipital-lobe'
    if any(k in n for k in ['temporal gyr', 'temporal sulcus', 'temporal pole', 'temporal plane', 'transverse temporal', 'occipitotemporal', 'temporal lobe', 'fusiform', 'collateral sulcus']): return 'temporal-lobe'
    if any(k in n for k in ['postcentral', 'parietal lob', 'supramarginal', 'angular gyrus', 'intraparietal', 'subparietal', 'paracentral']): return 'parietal-lobe'
    if 'insula' in n: return 'insula'
    if any(k in n for k in ['frontal gyr', 'frontal sulcus', 'frontal lobe', 'precentral', 'straight gyrus', 'gyrus rectus', 'orbital gyr', 'orbital sulc', 'orbital part', 'opercular part', 'triangular part', 'frontopolar', 'frontomarginal', 'olfactory sulcus', 'frontal pole', 'central sulcus', 'lat_fis', 'circular sulcus', 'sulcus interm', 'jensen', 'olfactory']): return 'frontal-lobe'
    return 'other-brain'


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

# Bake world transforms before any deletion (placeholder ".j" parents carry
# transforms; deleting them would otherwise drop their children to the origin).
for o in bpy.context.scene.objects:
    o.select_set(True)
if bpy.context.scene.objects:
    bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.select_all(action='DESELECT')

kept, dropped = [], 0
for obj in list(bpy.context.scene.objects):
    if obj.type != 'MESH':
        continue
    nverts = len(obj.data.vertices)
    if nverts <= 30 or not is_brain(obj.name):
        bpy.data.objects.remove(obj, do_unlink=True)
        dropped += 1
        continue
    b, side = base_name(obj.name), split_side(obj.name)[1]
    obj['regionName'] = obj.name.strip()
    obj['base'] = b
    obj['slug'] = slugify(b)
    obj['side'] = side
    obj['coarseId'] = coarse(obj.name)
    kept.append((obj.name.strip(), obj['slug'], obj['coarseId']))

for obj in list(bpy.context.scene.objects):
    if obj.type == 'EMPTY' and not obj.children:
        bpy.data.objects.remove(obj, do_unlink=True)

from collections import Counter
by_coarse = Counter(c for _, _, c in kept)
print("\n=== KEPT %d brain meshes, dropped %d ===" % (len(kept), dropped))
for c in sorted(by_coarse):
    print("  %-16s %d" % (c, by_coarse[c]))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_extras=True,
    export_apply=True,
)
print("Output: %.2f MB  ->  %s" % (os.path.getsize(OUT) / 1024 / 1024, OUT))
