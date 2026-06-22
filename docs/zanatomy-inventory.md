# Z-Anatomy GLB inventory (G) — what else is available on the CDN

Repo: `tvildanov/neuroattention-anatomy@v1` (jsDelivr). All `.glb` files:

| file | size | meshes | currently loaded? | contents |
|---|---|---|---|---|
| skeleton.glb | 6.5 MB | 1948 | ✅ layer | bones |
| vessels.glb | 6.6 MB | 675 | ✅ layer | arteries, veins, heart chambers |
| nervous.glb | 5.8 MB | 702 | ✅ layer | CNS + peripheral nerves |
| muscles.glb | 4.9 MB | 683 | ✅ layer | muscles + **fascia** + retinacula + bursae |
| organs.glb | 2.1 MB | 296 | ✅ layer | viscera |
| brain-detail.glb | 766 KB | 228 | ✅ (merged into nervous) | detailed brain |
| **joints.glb** | 1.6 MB | **413** | ❌ NOT loaded | **ligaments + joint capsules + articular discs** (e.g. sphenomandibular_ligament, articular_capsule_of_TMJ, cricothyroid_ligament) |
| **lymph.glb** | 438 KB | **220** | ❌ NOT loaded | **lymphatic system** — thymus, lymph nodes (aortic/lumbar/hepatic/mesenteric/colic…), lymphoid organs |
| regions.glb | 798 KB | 298 | ❌ NOT loaded | surface anatomical landmarks/zones (auricle parts, body-surface regions) — labels, not internal structures |

## Answers to Tahir's questions

- **Lymphatic system (nodes + vessels):** ✅ EXISTS — `lymph.glb` (220 meshes), not loaded.
- **Ligaments:** ✅ EXISTS — inside `joints.glb` (413 meshes incl. named ligaments).
- **Joint capsules:** ✅ EXISTS — `joints.glb` (articular capsules + discs).
- **Tendons:** ⚠ partial — some tendon meshes live in `muscles.glb`; no dedicated tendon GLB.
- **Fascia:** ✅ already loaded — fascia meshes are in `muscles.glb` (currently untagged; shown in the whole-muscles view).

## Recommendation (Tahir to decide — NOT implemented)

1. **Add `joints` layer** (ligaments + capsules) — 1.6 MB, high anatomical value, straightforward (mirror the existing layer-load path; add to `anatomy-models.json.layers`).
2. **Add `lymph` layer** (lymphatic) — 438 KB, small, good for immunology/edema topics.
3. `regions.glb` — surface landmarks; lower priority (more useful as click-labels than a render layer).

All three are already in `anatomy-models.json.extra` (joints/lymph/regions) — wiring them as toggleable layers is a contained follow-up PR, not done here.
