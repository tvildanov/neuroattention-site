# Lymph layer "renders as points" — investigation (PR #75 item 1)

## What `lymph.glb` actually contains
Traversed the loaded `lymph` layer group in the engine:

| primitive | count |
|---|---|
| `Mesh` | **220** (all hit-testable) |
| `Line` / `LineSegments` / `LineLoop` | **0** |
| `Points` | **0** |

So the "points" are **NOT** lymphatic vessels that our loader is hiding. Our code at
`body-atlas.js:907` hides `Line/LineSegments/Points` (to kill stray "sticks"), but
`lymph.glb` has **none** of those — nothing is being hidden.

## What the 220 meshes are
Every mesh is a **lymph node group** or a **lymphoid organ** — examples:
`lymph_thymus`, `lymph_right_lobe_of_thymus`, `lymph_primary_lymphoid_organs`,
`lymph_pre_aortic_nodes`, `lymph_lateral_aortic_nodes`, `lymph_precaval_nodes`,
`lymph_hepatic_nodes`, `lymph_inferior_mesenteric_nodes`, `lymph_left_colic_nodes`,
`lymph_pancreaticoduodenal_nodes`, `lymph_juxta_intestinal_mesenteric_nodes`, …

There are **no** lymphatic **vessels / ducts / trunks / cisterna chyli** in the file —
a name search for `vessel|duct|trunk|cisterna|channel|thoracic` returned **0**.

## Conclusion
The scattered-points look is faithful to the source: `lymph.glb` is **nodes + thymus
only**. The lymphatic **channels (vessels) are simply absent** from the Z-Anatomy
export — there is nothing to "un-hide" and no Line geometry to reveal. No code fix
restores channels because the geometry doesn't exist in the GLB.

## Flag (no integration today, per instruction)
To show actual lymphatic **vasculature** (thoracic duct, lymphatic trunks, vessel
network) we need a different source. Best open-licensed candidate found in the
female-model research (same library):
- **NIH 3D / Human Reference Atlas (HRA)** has lymphatic-vasculature reference
  objects (CC-BY 4.0, native GLB). Would need: download the vessel GLB(s), align to
  our Z-Anatomy coordinate frame/scale, DRACO-compress, add as part of the `lymph`
  layer (or a `lymph-vessels` sub-mesh set) in `neuroattention-anatomy@v2`.

Optional smaller improvement (no new source): make the existing node meshes read less
like stray dots — e.g. a slightly larger/softer glow for the `lymph` layer — but that
does not add channels. Deferred for Tahir's call.
