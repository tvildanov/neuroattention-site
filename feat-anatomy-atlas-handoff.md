# Handoff — feat/anatomy-atlas

## ✅ UPDATE 2026-06-18 (Z-Anatomy session, commit `e08f679`)
**Z-Anatomy real-model pipeline is DONE and browser-verified against the live CDN.**
- **R2 was a dead end** — it is NOT configured anywhere (no `R2_*` on any Railway
  service: checked `neuroattention-api`/`monad-server`/`monad-agents`/`perfect-growth`;
  none in keychain/history/local `.env`). `api/server.js` storage is
  `r2Client ? 'r2' : 'github'` and prod uses the **GitHub-Pages fallback**.
  GitHub *release assets* don't send CORS headers → GLTFLoader can't fetch them.
- **Hosting = jsDelivr** from a dedicated public repo `tvildanov/neuroattention-anatomy@v1`
  (`cdn.jsdelivr.net/gh/...` sends `access-control-allow-origin: *`), kept OUT of
  the Pages repo (no git bloat). 8 systems, ~28 MB, CC-BY-SA 4.0 attributed.
- **Pipeline:** `tools/convert_anatomy.py` (FBX→GLB+Draco, Blender 5.1 headless) +
  `tools/normalize_anatomy.py` (one shared transform baked in → all layers aligned,
  centered, H≈2.0). URLs in `data/config/anatomy-models.json`.
- **body-atlas.js:** `ensureThree()` loads DRACOLoader; `_loadRealLayer`/`_swapRealLayer`
  lazy-stream each layer's GLB on toggle and swap the procedural capsule out.
  muscles/skeleton/nervous/vessels/organs = real; skin+brain stay procedural.
- **account.html:** added `vessels` + `organs` toggles.
- **Verified in a real browser** vs live jsDelivr: config fetch, Draco decode, all 5
  real layers stream/swap/align (skeleton 1948 / muscles 683 / vessels 676 /
  organs 296 meshes), x-ray shader applied, no console errors.
- **NOT on neuroattention.org yet:** Pages deploys from `main`; this is on
  `feat/anatomy-atlas`. Merging to main currently **conflicts in `account.html`**
  (main advanced: PACK 1/2/5.1/5.2). Go-live = a `main` merge decision.
---
# (original handoff below)


**Handoff commit base:** branch `feat/anatomy-atlas` at `d1354a7` (this doc adds one
commit on top). Everything below is pushed to `origin/feat/anatomy-atlas`.
Do **not** merge to main until Nick verifies.

---

## 1. What is already done (with paths)

### A — 3D Anatomy Atlas engine + UI (committed `7a2dbda`)
- **`assets/js/body-atlas.js`** (~720 lines) — `window.BodyAtlas`:
  - Three.js **r128** lazy-loaded from CDN (`ensureThree()`); OrbitControls + GLTFLoader.
  - Holographic **x-ray fresnel + wireframe shader** (`makeXrayMaterial`, `makeWireframe`).
  - `init / render / toggleLayer / setLayerOpacity / setMode / setRotation /
    flipView / resetView / hitTest / on / enterBrainDetail / exitBrainDetail /
    focusOrgan / setSex / destroy`.
  - Modes: `full` | `sensation-picker` | `brain-detail`.
  - 5 layers: skin / muscles / skeleton / nervous / brain.
  - Brain: **13 named hit-testable regions** (lobes, thalamus, hypothalamus,
    hippocampus, amygdala, basal ganglia, cerebellum, midbrain, pons, medulla)
    with ru/en/es names + short educational descriptions.
  - `SENSATION_REGION_MAP` exported (atlas region id ↔ sensation-map slug).
  - **r128 gotcha:** `THREE.CapsuleGeometry` does NOT exist in r128 (added r130) →
    `CapGeo()` cylinder helper is used.
  - **Proportion gotcha:** anatomical width unit is stature-derived (`H*0.28`),
    NOT bbox width — bbox width = arm span in a T-pose and blows proportions up ~3×.
- **`account.html`** — "Анатомия" sub-tab in Инструменты + full tool UI (layer
  controls + opacity sliders, viewport, inset organs as SVG glyphs, region info
  panel, brain-detail). Wired into `setToolsMode('anatomy')`, `mountAnatomyAtlas`,
  and `toolsExpandActive` fullscreen overlay. Client access-gate fails open.
- **`assets/3d/body/body-male.glb`** — Xbot mesh (MIT), 2.9 MB. Currently the
  skin source + procedural-layer scale reference. **Per Nick this is now only a
  fallback/preview, NOT the final source** (see §3).
- **`assets/3d/CREDITS.md`** — asset provenance.
- **`test-atlas.html`** — standalone dev harness (root; public on Pages — remove
  before prod if undesired).

### B — Tool Access (committed `3edcd81`)
- **`migrations/017_tools_access.sql`** + inline SQL in `/api/run-migrations`
  (api/server.js): `tools` + `course_tools`; existing tools seeded `is_free_default=TRUE`
  (no behaviour change), `anatomy-atlas` gated.
- **api/server.js**: `getUserToolAccess` / `requireToolAccess`,
  `GET /api/tools`, `GET /api/tools/:code/access`, admin `GET/PATCH /api/admin/tools`,
  `GET/PUT /api/admin/courses/:id/tools`.
- **account.html** admin course editor: "Доступные инструменты" section (per-course
  checkboxes + global 🌐 free-default toggle), saved with course meta.
- i18n ru/en/es for all tool-access + anatomy strings.
- ⚠️ **Deploy dependency:** admin-grant + gate are only live once migration 017 is
  applied on Railway. Gate fails open pre-deploy.

### C — Sensation Map (committed `d1354a7`)
- **`assets/js/body-picker.js`**: new BACK "Позвоночник/Spine" region — cervical
  (C1–C7) / thoracic (T1–T12) / lumbar (L1–L5) / sacral / spinal-cord. New
  `bp_spine_b_*` slugs are additive; same `onSelect(slug,names,picked)` contract
  → **backward-compatible**.
- `SENSATION_REGION_MAP` in body-atlas.js aligns atlas + picker on one id space.
- **Staged / not done:** full swap of the 2D SVG picker → 3D atlas as the
  sensation picker. Skin mesh isn't surface-segmented and the save path is
  backward-compat-critical → needs surface hit-zones + E2E save verification on
  the deployed API before flipping the default.

**Verified in Chrome preview:** atlas renders (x-ray body), 5 layers toggle,
skeleton proportions, brain-detail, hit-testing returns region ids, account.html
integration (screenshot), spine picker fires onSelect. **Not yet verified:**
logged-in E2E, admin/gate live (both need migration 017 deployed).

---

## 2. Model-source findings

- **Xbot.glb** — three.js examples, MIT, 2.9 MB, real humanoid mesh. Downloaded,
  committed. Good as skeleton/animation base + preview/fallback.
- **Z-Anatomy** — full CC-BY-SA anatomy (based on BodyParts3D). Repo
  `LluisV/Z-Anatomy` ≈ **805 MB**, format **`.blend`** (not glTF). `Z-Anatomy-Sample`
  ≈ 204 MB. There is a separate **`LluisV/Z-Anatomy-blendfiles`** repo to verify.
- **Brain** — no ready-made lightweight GLB with named per-region segmentation was
  found by direct probing. Allen Brain Atlas (`download.alleninstitute.org`) and
  Sketchfab CC-BY brain models are candidates for a dedicated brain submodel.
- Network in sandbox: `raw.githubusercontent.com` reachable; `curl`/`git` present;
  no `wget`.

---

## 3. Nick's NEW architecture decision (final — no compromise)

> "восемьсот мегабайтами и всем чем можно скачанным на максимум, а не в урезанной
> версии". Full detailed Z-Anatomy, not procedural capsules as the final.

**Target pipeline:**
1. Keep **Xbot.glb** as skeleton/animation base + preview/fallback only.
2. **Z-Anatomy full** (CC-BY-SA) as the real source. Pre-bake each system
   (skin / muscles / skeleton / nervous / brain / organs / vessels) in **Blender
   headless** → **glTF (GLB) + Draco** compression. Target 50–200 MB total.
3. **Host on Cloudflare R2** (same backend as audio practices — see §4), under an
   `/anatomy/` prefix. Commit public URLs to **`data/config/anatomy-models.json`**:
   `{ "skin": "...", "muscles": "...", "skeleton": "...", "nervous": "...",
   "brain": "...", "organs": "..." }`.
4. **`body-atlas.js` loader update:** on tool open show a spinner; read
   `anatomy-models.json`; **lazy-fetch each layer's GLB via GLTFLoader on toggle**;
   real anatomy loads **by default**; procedural capsule layers remain only as a
   1–2 s fallback / when a URL is unavailable. Cache via service worker / browser.
5. Dedicated **brain submodel** with named regions (Z-Anatomy brain if detailed
   enough; else Allen/Sketchfab CC-BY) through the same R2 pipeline.
6. **Before the Blender path — search for a community pre-converted glTF/GLB**
   (Sketchfab CC-BY, GitHub `topics:anatomy`, Hugging Face 3D). A ready CC-BY(-SA)
   port saves a day.

---

## 4. ⚠️ Prerequisites / blockers to resolve BEFORE running the pipeline

These are why the pipeline was not executed blind in the parallel session:

1. **Platform is macOS (darwin), not Linux.** The `apt-get install blender` /
   `blender-*-linux-x64` AppImage steps will NOT work here. Use either
   `brew install --cask blender` locally, or run conversion in a Linux CI/container.
   Decide where the multi-hour conversion runs.
2. **R2 credentials are ENV-only — NOT in `api/server.js`.** Code reads
   `process.env.R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `R2_BUCKET`, `R2_PUBLIC_BASE_URL` (set on Railway). There is nothing to "reuse
   from server.js". To upload locally these must be provided to the session as env
   vars (never commit them). Bucket creation + public-base config is an owner
   action in the Cloudflare dashboard. R2 client pattern: see api/server.js
   `~line 3243` (`S3Client`, endpoint `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`).
3. **License compliance:** Z-Anatomy is **CC-BY-SA** → attribution + share-alike.
   Record attribution in `assets/3d/CREDITS.md` and alongside the hosted assets.
4. **Size/time:** ~800 MB download + Blender conversion is a long background job;
   plan disk + run async.
5. **Outward/irreversible:** creating an R2 bucket and publicly hosting third-party
   licensed content is an owner-level, hard-to-reverse action — confirm bucket
   name + public-base + attribution with Nick before upload.

---

## 5. Suggested order for the next session

1. **Try community pre-converted glTF first** (10–15 min web search). If found
   under CC0/CC-BY/CC-BY-SA/MIT → skip Blender.
2. Else: confirm Blender host (mac/CI) + obtain R2 env creds + confirm bucket/public-base.
3. Download Z-Anatomy (verify `LluisV/Z-Anatomy` vs `…-blendfiles`).
4. `tools/convert_anatomy.py` → Blender headless, GLB + Draco, one file per system.
5. Upload to R2 `/anatomy/`; write `data/config/anatomy-models.json`.
6. Update `body-atlas.js` loader (lazy per-layer; procedural = fallback).
7. Test on prod, incognito + hard refresh: open Анатомия, toggle layers, confirm
   real models stream from R2.
8. Then resume polish + deploy migration 017 + logged-in E2E with test users
   (`atlas-test-1@test.local`, `atlas-test-2@test.local`; soft-delete after).

---

*Handoff written from session in `/Users/tvildanov/Code/neuroattention-site` on
`feat/anatomy-atlas`. Base commit `d1354a7`.*
