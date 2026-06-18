# 3D Anatomy Atlas — asset provenance & licenses

Honest provenance for every mesh used by the Anatomy Atlas (`assets/js/body-atlas.js`).

## Body skin mesh — REAL geometry
- **File:** `body/body-male.glb`
- **Source:** three.js examples (`examples/models/gltf/Xbot.glb`), mrdoob/three.js.
- **License:** MIT (three.js repository). Redistributable.
- **Use:** Real human body mesh rendered with a custom holographic x-ray
  wireframe shader (fresnel rim + triangle net). Provides the realistic body
  silhouette and proportions used to scale all procedural anatomy layers.

## Skeleton / muscles / nervous system / brain — PROCEDURAL (schematic)
- **Source:** generated at runtime in `body-atlas.js` from standard anatomical
  proportions, scaled to the body mesh's bounding box.
- **Why procedural:** full per-region scanned anatomy (e.g. Z-Anatomy /
  BodyParts3D, CC-BY-SA) is ~800 MB of `.blend` files — impractical to bundle
  in a static GitHub Pages site and impossible to hit-test per named region
  without separate segmentation. Procedural meshes give correct topology,
  anatomically-faithful positions, and per-region hit-testing with ru/en/es
  labels, at a web-appropriate size.
- **Honesty:** these layers are clearly labelled "schematic" in the UI. They are
  anatomically correct in arrangement (e.g. vertebral column with real
  cervical/thoracic/lumbar/sacral segmentation; brainstem stacked as
  midbrain → pons → medulla), not photogrammetric scans.

## If photoreal scanned anatomy is desired later
Stream CC-BY-SA per-organ GLB from an external CDN / GitHub Release (NOT the
repo), and add the required attribution here. `body-atlas.js` already loads the
body via GLTFLoader, so swapping/adding GLB layers is a localized change.
