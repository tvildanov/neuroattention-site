# Anatomy Atlas — sources and geometry policy

## Rendered anatomy

The atlas renders real Z-Anatomy systems only: muscles, skeleton, nervous system,
vessels, organs, joints, lymph, and the separately configured anatomical detail
layers. Models are streamed lazily from the sources in
`data/config/anatomy-models.json`.

- Source: Z-Anatomy by Lluís Villanova and contributors,
  https://github.com/LluisV/Z-Anatomy, https://www.z-anatomy.com.
- Based on BodyParts3D / Anatomography, © DBCLS.
- License: CC-BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/.
- Derived GLB anatomy files remain CC-BY-SA 4.0. Attribution and ShareAlike apply.
- Pipeline: source FBX → glTF/GLB + Draco, normalized to a shared coordinate frame
  centered at the origin with height approximately 2.0.

Female anatomy sources and attribution remain documented in
`data/config/anatomy-models.json` (HuBMAP / CCF Reference Object Library, CC-BY 4.0).

## No legacy body envelope

The obsolete skin/mannequin GLB and its load/mount path have been removed.
No skin fill, wire net, procedural mannequin or substitute silhouette should be
created or loaded. Saved historical `skin` layer requests remain disabled.

The reference frame is numeric metadata only. `_initAnatomyFrame()` provides
finite dimensions for camera/brain placement without constructing geometry or
requiring a hidden body download. Real anatomy continues to mount in its existing
normalized frame. New previews must use configured anatomical layers rather than
reintroducing a generic body envelope.
