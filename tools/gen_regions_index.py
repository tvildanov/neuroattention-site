#!/usr/bin/env python3
"""Build the canonical region index for every named mesh across all body layers.

For each mesh we compute:
  - region_id : unique per mesh (layer + slug + _left/_right)
  - base_slug : laterality-stripped (layer + slug) — the i18n lookup key, so a
                paired muscle needs ONE Russian entry, not two.
  - display_en: humanized English/Latin name (Z-Anatomy names are already clean)
  - side      : 'l' | 'r' | None

Output:
  data/anatomy/regions-index.json  — full machine list (handoff + engine ref)
  prints unique base-slug count.

Slug/humanize logic here MUST stay byte-identical to body-atlas.js parseName().
"""
import json
import re
import sys


# Z-Anatomy laterality / attachment markers are a trailing ".<token>" where the
# token is a short lowercase[+digit] code: l/r (left/right), j/i (non-lateral
# part), el/er/ol/or/e1l/… (muscle origin/insertion footprints, side = last char).
_MARKER = re.compile(r"\.([a-z][a-z0-9]{0,2})$")


def parse_name(layer, name):
    s = name.strip()
    side = None
    m = _MARKER.search(s)
    if m:
        marker = m.group(1)
        s = s[:m.start()]
        if marker.endswith("l") and marker not in ("j",):
            side = "l"
        elif marker.endswith("r"):
            side = "r"
        # j / i / other → no laterality
    display_en = s.strip()
    # slug: lowercase, drop apostrophes, non-alphanumerics -> underscore
    slug = display_en.lower()
    slug = re.sub(r"['’`]", "", slug)
    slug = re.sub(r"[^a-z0-9]+", "_", slug).strip("_")
    base_slug = f"{layer}_{slug}" if slug else ""
    region_id = base_slug + ("_left" if side == "l" else "_right" if side == "r" else "")
    return region_id, base_slug, display_en, side


def main():
    layers = sys.argv[1:-1]
    out = sys.argv[-1]
    index = {}            # region_id -> entry
    base = {}             # base_slug -> {en, layer, sides}
    for path in layers:
        layer = re.sub(r".*/([a-z]+)-meshes\.json", r"\1", path)
        d = json.load(open(path))
        for n in d["named_mesh_nodes"]:
            rid, bslug, en, side = parse_name(layer, n["name"])
            if not bslug:
                continue   # garbage / non-ascii mesh name → not hit-testable
            index[rid] = {"region_id": rid, "base_slug": bslug,
                          "display_en": en, "side": side, "layer": layer,
                          "original": n["name"]}
            b = base.setdefault(bslug, {"en": en, "layer": layer, "sides": set()})
            if side:
                b["sides"].add(side)
    for b in base.values():
        b["sides"] = sorted(b["sides"])
    json.dump({"regions": index,
               "base": {k: v for k, v in base.items()}},
              open(out, "w"), indent=2, ensure_ascii=False, default=list)
    print(f"meshes={len(index)}  unique_base_slugs={len(base)}")
    # per-layer base counts
    from collections import Counter
    c = Counter(v["layer"] for v in base.values())
    print("base per layer:", dict(c))


if __name__ == "__main__":
    main()
