#!/usr/bin/env python3
"""Split nervous.glb mesh names into CNS (brain/brainstem/cerebellum/cord nuclei)
vs PNS (peripheral nerves, ganglia, special sense organs).

CNS meshes are tagged is_brain so the normal `nervous` atlas layer does NOT
hit-test them — the brain belongs to the parallel brain-detail session. They
still render (the nervous system looks complete); they're just not clickable
outside brain-detail mode.

Output: data/anatomy/nervous-cns-meshes.json — an exact-name allow/deny list the
engine loads to set userData.isBrain at load time. Deterministic & reviewable.
"""
import json
import re
import sys

# Central-nervous-system markers. A name is CNS if it contains any of these.
# Ordered roughly head→tail; chosen to capture cortex, deep nuclei, brainstem,
# cerebellum and CNS-internal structures while leaving peripheral nerves,
# ganglia and sense organs (ear/eye) as clickable PNS regions.
CNS_KW = [
    "brain", "cerebr", "cortex", "cortical", "gyrus", "sulcus", "lobe of",
    "frontal lobe", "parietal lobe", "temporal lobe", "occipital lobe",
    "limbic", "insula", "operculum", "cuneus", "precuneus", "lingula",
    "thalam", "hypothal", "subthalam", "epithalam", "metathalam",
    "hippocamp", "amygdal", "fornix", "mammillary", "septum pellucidum",
    "caudate", "putamen", "pallidum", "lentiform", "claustrum", "striatum",
    "internal capsule", "external capsule", "extreme capsule",
    "corpus callosum", "anterior commissure", "posterior commissure",
    "habenula", "pineal", "pituitar", "hypophys", "infundibulum of",
    "olfactory bulb", "olfactory tract", "optic chiasm", "optic tract",
    "lamina terminalis", "third ventricle", "lateral ventricle",
    "fourth ventricle", "cerebral aqueduct", "aqueduct of midbrain",
    "choroid plexus", "white matter", "grey matter", "gray matter",
    "corona radiata", "centrum semiovale", "corpus striatum",
    "diencephalon", "telencephalon", "mesencephalon", "metencephalon",
    "myelencephalon", "rhombencephalon", "prosencephalon",
    "midbrain", "tegmentum", "tectum", "colliculus", "cerebral peduncle",
    "substantia nigra", "red nucleus", "periaqueductal",
    "pons", "pontine", "basilar part of pons", "tegmentum of pons",
    "medulla oblongata", "pyramid of medulla", "olive", "olivary",
    "reticular formation", "raphe",
    "cerebell", "vermis", "flocculus", "nodulus", "culmen", "declive",
    "folium", "tuber of vermis", "pyramid of vermis", "uvula of vermis",
    "dentate nucleus", "emboliform", "globose", "fastigial",
    "arbor vitae", "tonsil of cerebellum",
    "nucleus",  # brainstem / thalamic / cranial-nerve nuclei are CNS
    "decussation", "lemniscus", "fasciculus of", "tract of",
    "ventral horn", "dorsal horn", "lateral horn", "central canal",
]

# Names that match a CNS keyword but are NOT central nervous system (false
# positives from generic tokens like "sulcus"/"olive"/"tract").
NOT_CNS = [
    "sulcus sclerae",
    "ciliary sulcus",
    "tractus",                 # guard (none expected, kept for safety)
]


def is_cns(name):
    low = name.lower()
    if any(x in low for x in NOT_CNS):
        return False
    return any(k in low for k in CNS_KW)


def main():
    meshes_json = sys.argv[1]
    out_json = sys.argv[2]
    d = json.load(open(meshes_json))
    names = [n["name"] for n in d["named_mesh_nodes"]]
    cns = sorted({n for n in names if is_cns(n)})
    pns = sorted({n for n in names if not is_cns(n)})
    json.dump({"cns_meshes": cns, "cns_count": len(cns), "pns_count": len(pns)},
              open(out_json, "w"), indent=2, ensure_ascii=False)
    print(f"nervous: CNS(is_brain)={len(cns)}  PNS(clickable)={len(pns)}")
    print("PNS sample:", ", ".join(pns[:12]))


if __name__ == "__main__":
    main()
