# Female anatomy inventory (Anatomy Atlas — Phase 0)

Female reproductive anatomy, breasts and placenta integrated as new Atlas layers, derived
from the **HuBMAP CCF 3D Reference Object Library** (VH-Female), CC-BY 4.0.

- Upstream: https://github.com/hubmapconsortium/ccf-3d-reference-object-library (`VH_Female/`)
- License: Creative Commons Attribution 4.0 (CC BY 4.0). Citation: Browne, K., Schlehlein, H.,
  Herr II, B. W., Quardokus, E., Bueckle, A., Börner, K. (2022).
- Source space → atlas frame: uniform **scale 0.97 + translation [0.0537, −0.0192, 0.0533]**,
  no rotation/flip (axes coincide: +X = anatomical left, Y = up, +Z = anterior). Derived by
  matching the HuBMAP `VH_F_Pelvis` bbox to our `skeleton.glb` bony pelvis. Build pipeline:
  `scratchpad/hra/build.mjs` (rename sub-meshes → atlas tokens, wrap under one transform node,
  weld/dedup/prune, DRACO; breasts also Meshopt-simplified). Verified placements: see
  `/tmp/female-anatomy-source-research.md`.

## CDN assets (`tvildanov/neuroattention-anatomy@v2`)

| File | Layer | Size | Contents |
|---|---|---|---|
| `female-reproductive.glb` | `female_reproductive` | 243 KB | uterus, cervix, ovaries L/R, fallopian tubes L/R, vagina |
| `breasts.glb` | `breasts` | 1.4 MB | mammary glands L/R (fat, areola, nipple, lobes, ducts, ligaments) |
| `placenta.glb` | `placenta` | 432 KB | placenta, chorionic/basal plates, amnion, umbilical cord + vessels (Phase 1 overlay) |

## Mesh tokens → atlas region ids

Node names are renamed at build time to clean atlas tokens; `parseAnatName` + `assignOrganTag`
in `assets/js/body-atlas.js` resolve them. The `organ` tag value equals the `SEED_REGION_INFO`
id, which is how `focusRegions` / per-region ops match them.

| Node name in GLB | layer | baseSlug | organ / SEED id | side |
|---|---|---|---|---|
| `Uterus` | female_reproductive | female_reproductive_uterus | `uterus` | — |
| `Cervix` | female_reproductive | female_reproductive_cervix | `cervix` | — |
| `Ovary.l` / `Ovary.r` | female_reproductive | female_reproductive_ovary | `ovaries` | l / r |
| `Fallopian tube.l` / `.r` | female_reproductive | female_reproductive_fallopian_tube | `fallopian-tubes` | l / r |
| `Vagina` | female_reproductive | female_reproductive_vagina | `vagina` | — |
| `Breast.l` / `Breast.r` | breasts | breasts_breast | `breasts` | l / r |
| `Placenta` | placenta | placenta_placenta | `placenta` | — |

## Sex filtering

Meshes are tagged `userData.sex` at load (`assignSexTag`): female layers → `'female'`; existing
male reproductive meshes (prostate/testis/penis/… by name token in the organs/vessels GLBs) →
`'male'`; everything else untagged (never sex-filtered). `atlas.setSex('male'|'female'|'both')`
hides the excluded sex's reproductive meshes only — general anatomy is untouched, so the male
model renders identically at the default `'male'`.

## Source files used (HuBMAP)

- v1.2: `VH_F_Uterus`, `VH_F_Ovary_L`, `VH_F_Ovary_R`, `VH_F_Fallopian_Tube_L`,
  `VH_F_Fallopian_Tube_R`, `VH_F_Vagina`, `VH_F_Placenta`, `VH_F_Pelvis` (anchor only).
- v1.3: `VH_F_mammary_gland_L`, `VH_F_mammary_gland_R`.

## Not integrated (available upstream for later)

- External genitalia (vulva/clitoris/labia) — not in the HuBMAP VH-Female set.
- `VH_F_Ligaments_Uterus_Ovaries.glb` (broad/round ligaments) — available, deferred.
- Open3DModel (Leiden) female pelvis — not yet published as of June 2026; if released in the
  Z-Anatomy frame it could replace these assets with zero alignment.
