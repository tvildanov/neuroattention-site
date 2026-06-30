# NeuroAttention — engineering guide for the NeuroMap / Evolution Path system

This file is the durable contract for the NeuroMap (Нейрокарта) graph and the
Evolution Path (Путь). Most bugs in this codebase are regressions of the same
handful of invariants below. Read this before touching any `nm*` code,
`evolution-path.js`, or the `/api/neuromap/*` / `/api/.../evolution/*` endpoints.

Frontend is almost entirely in **`account.html`** (single huge file: inline CSS
~L100–L900, the `nm*` engine ~L6300+, fullscreen `fsTick` ~L7700+). Backend is
**`api/server.js`** (Express + Neon serverless). The Personal/Collective Path
renderer is **`evolution-path.js`**. Deploy = GitHub Pages (static HTML/JS) +
Railway (the `api/` service). Service worker cache is **`sw.js`** — bump
`CACHE_NAME` (`na-practices-vNN`) on every shippable client change or users get
stale HTML/JS.

---

## Layered model (1–6) + palette

Node `type` → layer → palette. Source of truth: `NM_LAYERS` (account.html ~L6302),
`nmNodeLayer()`, `nmGetNodeColor()`. The toggle-chip gradients live in the inline
CSS (`.nm-layer-chk input[data-layer="N"]`).

| Layer | Name (ru) | Node types | Colour (rgb) |
|-------|-----------|------------|--------------|
| 1 | Ощущения  | `area` (body-location) + `sensation` | body **blue** `140,180,255`; sensation **cyan** `120,200,235` (split-gradient chip) |
| 2 | Переживания | `emotion` | **amber** `232,170,72`; node fill is polarity-graded via `nmPolarityColor` (dark-red → grey-blue → white-green) |
| 3 | Образы    | `area` (life-sphere: семья/работа/будущее) | **lavender** `175,150,240` |
| 4 | Понятия   | `thought`, `concept` | **purple** `166,112,226` |
| 5 | Смыслы    | `cause`, `context` | **green** `112,202,132` |
| 6 | Действия  | `event`, `action`, `practice` | **rose** `240,130,166` |

**`area` is overloaded** (the single most error-prone fact here). The Sensation
Map stores body locations as `type='area'`; the emotion 6-step walkthrough stores
LIFE SPHERES as `type='area'` too. They are split *per-node* by
`metadata.area_kind` (`'body'`→layer 1, `'sphere'`→layer 3), with fallback
`metadata.source==='sensation'` ⇒ body. Never re-fold them into one layer (that
was the PR#103 regression). See `nmAreaKind()` / `nmNodeLayer()`.

---

## Tables

- **`nm_nodes`** — graph nodes. Key cols: `id`, `user_id`, `type`, `label`,
  `session_id` (uuid, the flow grouping — see contract below), `valence`,
  `metadata` (jsonb; `area_kind`, `source`, `mirror`, …), `created_at`,
  `last_seen`. One *concept occurrence* = one node (re-felt sensations grow an
  existing node, they do not duplicate).
- **`nm_links`** — edges between `nm_nodes` (`source_id`, `target_id`). Bridges
  created by `nmBridgeSession` are normal rows here.
- **`nm_session_nodes`** — session bridge table (migration 035). Maps a
  `session_id` to the nodes created in that flow so cross-linked flows resolve to
  one connected component. Still written on every append; it is the SOURCE the chain
  tables are derived/backfilled from.
- **`nm_chains`** (migration 043, PR#114) — FIRST-CLASS chain entity. One row per
  `(user_id, session_id)` (UNIQUE on `session_id`) with `started_at`/`finished_at`
  (minute-accurate) and `source` (`sensation`|`emotion`|`thought`|`diary`). A chain
  IS one modal flow (= one `session_id`). `session_id` is **TEXT** (matches
  `nm_session_nodes`/`journey_events`; the spec's UUID would break the cast).
- **`nm_chain_nodes`** (migration 043) — chain membership. `(chain_id, node_id,
  position)` PK; a node may legitimately repeat at different positions (within or
  across chains — that recurrence is the gestalt). `node_id` FK → `nm_nodes(id)
  ON DELETE CASCADE`, `chain_id` FK → `nm_chains(id) ON DELETE CASCADE`. Position =
  append order (body-first within a batch).
- **`journey_events`** — the Evolution Path timeline. Cols incl. `occurred_at`,
  `created_at`, `kind` (`insight`, `block_done`, …), `dependent_id` (PR#91/#99
  family routing), `session_id` (PR#109, merges one flow into one Path chain).
  Path render reads this; mirror/duplicate insights are filtered out (see Path-dup
  bug).
- **`neuro_resource_diary`** — diary + the *sensation mirror* rows (kept only for
  the recent-list UI). A sensation save writes a `"Sensation: … @ …"` mirror here;
  these must be tagged/skipped so they never render as a second Path node.
- **`vocab_terms`** (a.k.a. vocab; `/api/admin/vocab`) — emotion/sensation
  vocabulary incl. `polarity_strength` that drives `nmPolarityColor`.
- **`user_diagnoses`** (migration 044, PR#115) — which catalog diagnoses a user has
  claimed. `(user_id, diagnosis_slug)` UNIQUE; `diagnosed_at` DATE optional; `notes`.
  `user_id` is **UUID** (the PR spec said BIGINT — wrong for this DB; `users.id` is
  UUID, see migration 005). `diagnosis_slug` references the static catalog
  **`data/diagnoses.json`** (NOT a DB table) — the 12 educational entries are front-end
  data; the server only stores claims + files and validates the slug against the
  `KNOWN_DIAGNOSIS_SLUGS` allow-list (server.js).
- **`user_medical_files`** (migration 044, PR#115) — uploaded medical documents,
  `user_diagnosis_id` FK → `user_diagnoses(id) ON DELETE SET NULL`. Stored via the same
  `storeMediaAsset` path as course/recording uploads (R2 if configured, GitHub
  fallback); `storage_url` is the public URL, `doc_type` ∈ `lab|report|discharge|other`,
  `doc_date` DATE required, 10 MB cap (`uploadMedical` multer, PDF/JPG/PNG only).

---

## Hybrid model — shared node + first-class chains (PR#114, the current contract)

`nm_nodes` are **deduplicated in the DB** by `(user_id, type, normalized_label,
valence)` — one row per concept, `count` accumulates. This powers the vocab library
and frequency sizing. PR#113 tried to protect chain integrity with **split-on-render**
(one node instance per session), but that LOST the gestalt («эта эмоция повторилась
10 раз») and shattered the map into look-alike twins. **PR#114 reverts split-on-render
and goes hybrid:**

- **NeuroMap = ONE shared node per concept**, radius ∝ `log(count)` (`nmNodeR`). A
  count=10 «любовь» field is visibly bigger than a count=1 «грусть». `buildNmGraph`
  keys `nodeMap` by `dbId` again (NOT `dbId@session`). The old `_sid`/`_baseKey`/
  `'__nosess'` machinery is GONE.
- **Edges come from CHAINS, not a cross-product.** The `v3/graph` response derives
  `links[]` from CONSECUTIVE members of each chain: one edge per node-pair, `count` =
  #chains sharing it (→ thickness), `chain_ids` carried for hover. The only edges
  drawn are real repetition points; no shared concept ever fuses two flows.
- **Click a node → info-panel UNDER the NeuroMap** (`#nm-node-info`, NOT a floating
  popup, NOT a sidebar). Shows identity + global count, an expandable **Цепочки ▼ N**
  list (from `GET /api/neuromap/chains-by-node/:id`, most-recent first, with minute
  timestamps + `a → b → c` preview), and an in-panel **mini-view canvas**: clicking a
  timestamp fetches `GET /api/neuromap/chain/:chain_id` and draws that one chain
  isolated (`nmDrawChainMini`), the clicked node highlighted. Superadmin Delete lives
  at the panel foot.

**Chains are first-class, not inferred at render time.** `nm_chains` /
`nm_chain_nodes` (migration 043) store each flow with explicit minute timestamps +
node positions. They are maintained live in `nmBridgeSession` (upsert chain on the
session_id, append batch nodes at the running `position`) and backfilled from
`nm_session_nodes`. The three read endpoints are `v3/graph`, `chains-by-node/:id`,
`chain/:chain_id`. `nmLoadV2Graph` fetches **v3** (falls back to v2 pre-migration) and
stores `nmV2Graph.chains`.

**Personal Path = one branch per chain.** `buildTunnelComponents` (evolution-path.js)
now groups events **strictly by `session_id`** — each session is ONE branch, events
strung in time (= position) order. NO per-component dedup (PR#113's `ckey` collapse is
REMOVED): a node that recurs within a chain, or appears in two chains, is drawn each
time. Cross-session `journey_links` are IGNORED so two chains can never fuse. Branch
order falls out of `anchorT` (= started_at). Sessionless legacy/calendar events keep
the old link-based connected-component + `splitComponent` fallback.

Superadmin can prune a single node via the NeuroMap node info-panel → red Delete →
`POST /api/admin/nm-node/:id/delete` (server.js): removes the `nm_nodes` row, every
`nm_link` touching it, its `nm_session_nodes`, its `nm_chain_nodes` + any chain it
empties, the `journey_events` whose `payload.nm_node_id` matches, and orphaned
`journey_links`; then the client reloads the graph and re-mounts the Path.

## `session_id` contract (the KING invariant)

**One modal flow == one `session_id`.**

- Every time a survey/overlay modal *opens*, `nmConsumeSessionHandoff()` ROTATES
  to a fresh uuid — UNLESS a genuine, *recent* handoff is continuing a linked pair.
- Cross-link (e.g. "Привязать к эмоции" / Link-to-Emotion) keeps the SAME
  `session_id` so the linked pair is one component.
- Close + reopen = NEW `session_id`. No auto-reuse, ever.
- Mechanism: `nmMarkHandoff()` sets `nmSessionHandoff=true` + `nmHandoffAt`
  timestamp; a legit auto-open consumes it within ~80ms; `NM_HANDOFF_TTL=8000`
  expires a lingering flag. **Why the TTL exists:** an abandoned cross-link used to
  leave `nmSessionHandoff=true` set, so the NEXT unrelated flow inherited the old
  session and glued into it → the "mass-merge blob" (PR#112 #1). Do not reintroduce
  a bare `nmSessionHandoff=true` without a timestamp.

## `nmBridgeSession` contract

- Bridges ONLY nodes that share the same `session_id`.
- **Single seam**: most-recent prior node → first new node (not a cross-product —
  the cross-product was the PR#108/#111 phantom-stick bug).
- `ORDER BY is_body ASC` so the felt sensation (not the body part) is the seam, and
  the body never anchors the chain.
- **Also maintains the chain (PR#114)**: upserts the `nm_chains` row keyed on
  `session_id` (start on first append, `finished_at = GREATEST(…)` after) and appends
  the batch's nodes to `nm_chain_nodes` at the running `position`. Takes a `source`
  arg (`/sensation` → `'sensation'`; v2/append derives from the chain's node types).
  Wrapped in try/catch so a missing-table window (pre-migration deploy) never breaks a
  save.

---

## Render paths (FOUR separate draw loops — patch ALL of them)

A fix applied to only one of these is the classic "works on main canvas, broken in
fullscreen" miss.

1. **`nmSimulate`** — main canvas force-sim + draw (account.html ~L6300+ region).
2. **`fsTick`** — fullscreen draw loop (~L7700+). SEPARATE from `nmSimulate`; reuses
   `nmNodes` positions. Sticky-link / arrow / clip logic must be duplicated here.
3. **`nmMiniMakeInset` / `nmMiniDraw`** — live mini-preview inset (static, no RAF);
   reuses `nmGetNodeColor`.
4. **`evolution-path.js`** — Personal/Collective Path (timeline), uses `nmPathColor`
   for node tones; body-first ordering. ONE branch per chain (PR#114).
5. **`nmDrawChainMini`** (PR#114) — the info-panel mini-view canvas; draws a single
   chain left→right (consecutive edges), clicked node highlighted. Reuses
   `nmGetNodeColor` (which returns an OPEN `rgba(…,` prefix — append `'1)'`).

---

## Migrations 034–046 (INLINE in `POST /api/run-migrations`, server.js ~L293)

Railway has **no auto-migrate** — migrations 034+ are inline in this endpoint and
run on demand (POST it after deploy). `app.delete`/array-cast gotcha: never
`DELETE … WHERE id = ANY(${jsArray}::bigint[])` — neon **silently throws** inside
the try/catch and reports "applied successfully" while deleting nothing (this hid
the «всё тело» bug for 4 PRs). Use pure SUBQUERY deletes.

- **034** — sensation-node backfill (create `type='sensation'` nodes for felt words).
- **035** — `nm_session_nodes` bridge table.
- **036** — `area_kind` classify: backfill body vs sphere by source.
- **037** — (PR#105) default-anchor no-body sensations to «всё тело». **Reversed by 038.**
- **038** — clean slate: delete `whole_body` nodes + orphan sensations.
- **039** — label sweep: subquery deletes of remaining `whole_body` + orphans
  (first run swept 16 whole_body + 42 orphans). Returns counts.
- **040** — Path session merge: backfill `journey_events.session_id`; delete dupes.
- **041** — phantom-bridge prune: delete body↔emotion/cause/thought links.
- **042** — sensation-mirror insight prune: delete backfilled `"Sensation: …"`
  insight events that duplicated the cyan sensation node (first run deleted 35).
- **043** — (PR#114) FIRST-CLASS CHAINS. Creates `nm_chains` + `nm_chain_nodes`
  (`IF NOT EXISTS`), then backfills one chain per `(user, session)` from
  `nm_session_nodes` (`started_at`=min/`finished_at`=max created_at, nodes ordered
  body-first then created_at). Idempotent (chains UNIQUE on `session_id`, ON CONFLICT
  DO NOTHING); per-group try/catch so one bad row can't abort the sweep. Returns
  `{ chains_created, chain_nodes_created, backfilled_chains, skipped? }`.
- **044** — (PR#115) DIAGNOSES. Creates `user_diagnoses` + `user_medical_files`
  (`IF NOT EXISTS`). `user_id UUID` (NOT the spec's BIGINT — `users.id` is UUID). No
  backfill (new feature). Returns `mig044 = { ok, error? }`.

- **045** — (PR#116) MEDICATIONS & SUBSTANCES. Creates `medications` + `diagnosis_medications`
  (`IF NOT EXISTS`), then seeds 60 rows (50 drugs + 10 psychoactive substances) from
  `api/medications-seed.js`. `ON CONFLICT (slug) DO UPDATE` so re-running refreshes copy /
  target-organs. Links resolve medication slug→id then upsert the join. Per-row try/catch.
  Returns `{ medications_seeded, diagnosis_links, skipped? }`.

- **046** — (PR#117) DIET. Creates `diets` (15 patterns, seeded ru/en/es with
  pros/cons `TEXT[]` + `target_organs_positive/negative[]` = BodyAtlas seed-ids),
  `diagnosis_diets` (`diagnosis_slug` TEXT → human_conditions.slug, `diet_id` FK, PK
  both), `user_diet` (one primary diet per user, `user_id` **UUID** PK), `diet_events`
  (the once-a-day "how I ate" log). `ON CONFLICT (slug) DO UPDATE` refreshes diet copy /
  organs; diet→diagnosis links upsert against existing condition slugs. Per-row try/catch.
  Returns `{ diets_seeded, diagnosis_links, error? }`.

`run-migrations` returns
`{ ok, message, mig039, mig040, mig041, mig042, mig043, mig044, mig045, mig046 }`.

---

## Medications & Substances tab (PR#116, 4th Human-Atlas tab)

A 4th tab «Препараты и вещества» / «Medications & substances» sits beside Anatomy /
Functions / Conditions, driven by the SAME controller IIFE (account.html ~L17068) and the
SAME `window._anatomyAtlas` instance. Self-contained — no edit to `body-atlas.js`.

- **Tables.** `medications` (id, slug UNIQUE, `kind` `medication`|`substance`, `category`,
  `name_ru/en/es`, `brand_ru[]`/`brand_us[]`, `effect_positive_*`, `effect_negative_*`,
  `target_organs_positive[]`/`target_organs_negative[]`, `warning_*`, `sort_order`,
  `is_active`). `diagnosis_medications` (`diagnosis_slug` TEXT → human_conditions.slug,
  `medication_id` FK, `is_primary`, PK both) — TEXT-slug join, NO FK on the diagnosis side so
  unknown/PR#115-pending slugs are harmless. Seed in `api/medications-seed.js`
  (`MEDICATIONS` + `DIAG_LINKS`). RU names = РФ-market (Золофт/Велаксин…), EN/ES = US-market.
- **Endpoints** (server.js, after the anatomy block): `GET /api/medications?kind=&category=&q=`,
  `GET /api/medication-links` (bulk join, client builds both nav directions),
  `GET /api/medications/:slug` (detail + its diagnoses), `GET /api/diagnoses/:slug/medications`,
  `GET /api/medications/:id/diagnoses` (`:id` = numeric id OR slug). Route order:
  `/api/medications/:id/diagnoses` and `/api/medication-links` precede `/api/medications/:slug`.
- **3D green/red overlay** (account.html `medFocus`/`medClearTint`). **PR#119 (Issue#2): now
  calls `BodyAtlas.tintRegions({positive,negative})` — the SAME path Diet uses — instead of the
  old custom `medTintNow` mesh-walk, which left organs in their native colour because
  `focus()`+`medMeshMatch` didn't reliably load/tint the target layer.** `medResolveSeeds` maps
  med organ-slugs → seed-ids via `MED_SEED` (brain, lungs, liver, kidneys, stomach,
  colon→large-intestine, small_intestine, pancreas, heart, thyroid→thyroid-gland, spinal_cord)
  and passes any other slug through normalized; `tintRegions` then loads the layer
  (`layersForSeedIds`), isolates, and paints positives **green** / negatives **red**. Non-mesh
  systems (vessels/skin/bones/joints/muscles/adrenals/spleen) are coloured CHIPS only — not
  tinted in 3D. Re-applied on lazy GLB stream via timers (400/950/2100 ms). `medClearTint()`
  restores via `atlas._clearFocusState()` (tintRegions state), called on tab-switch + card close.
  `medTintNow`/`medExpand`/`medMeshMatch` remain but are dead code.
- **Bidirectional links.** Condition card gains a «Препараты для лечения» section
  (`DATA.medsByDiag`) → `haGoMedication`; med card has «Назначается при» (`DATA.diagsByMed`) →
  `haGoCondition`. Both built client-side from the bulk `/api/medication-links`.
- **Disclaimers.** EVERY card shows the not-medical-advice disclaimer; `kind='substance'` adds
  a harm-reduction notice + WHO resource link. All labels live in the controller's local `T`
  table (ru/en/es) — NOT i18n.js (the `a.ha.*` data-i18n attrs are inert fallbacks the
  controller overrides in `localize()`).

---

## Internal Field rename + Diet tab (PR#117)

The «Anatomy» TOOL (the `#tools-mode-anatomy` sub-tab of Tools, sibling of External
Field) is renamed **«Внутреннее воздействие» / «Internal Field» / «Campo Interno»**
(`a.tools.internal_field`). The content/element-id stay `anatomy` for back-compat;
`?tool=internal-field` is the canonical deep-link, `?tool=anatomy` still routes via a
`setToolsMode` alias (`if(mode==='internal-field') mode='anatomy'`). The FIRST sub-tab
(`ha-tab-anatomy`) is relabelled **«Анатомический атлас» / «Anatomical Atlas»** — value
changed in BOTH the JSON `a.ha.tab_anatomy` AND the controller's local `T.tab_anatomy`
(+ the `localize()` map), else `localize()` reverts it to «Анатомия» at runtime.

**Diet** is the 5th `.ha-tab` (🥗 `ha-tab-diet`, `a.ha.tab_diet`). UNLIKE the other four
sub-tabs it is NOT part of the anatomy controller IIFE — it's a **standalone module**
(account.html, last `<script>` before `</body>`) using `window.t`/`getLang`/`naAuthHeaders`.
`haSwitchTab('diet')` hides `.atlas-body` + `#ha-topbar` and shows the full-width
`#ha-diet-panel` (primary banner + quick diet-event chips + 15-card grid). `dietOpenDetail`
re-shows `.atlas-body`, swaps the left column for `#ha-left-diet` (name/desc/pros/cons/
diagnoses/set-primary), and tints the shared `window._anatomyAtlas`. `haSwitchTab` clears
the diet tint on every switch (`if(a._focusColored.length) a.focusRegions([])`).

- **Tables** (migration 046): `diets`, `diagnosis_diets`, `user_diet`, `diet_events`
  (see migrations list). `target_organs_*` are BodyAtlas seed-ids.
- **Endpoints** (server.js, right after the anatomy/conditions block, BEFORE the
  medications block): `GET /api/diets`, `/api/diets/:slug` (+diagnoses join),
  `/api/diagnoses/:slug/diets` (reverse — for the Diagnoses tab to consume),
  `GET/PUT /api/me/diet`, `POST /api/me/diet/event` (mirrors onto the Personal Path via
  `logJourney` kind=`diet`, **layer=`event`** — the evolution endpoint DROPS events whose
  `layer` isn't one of its lane buckets `practice|emotion|event|thought|sensation|insight|
  xp_gain`, so a diet pick rides the generic `event` lane with a 🍽 `payload.label`),
  `GET /api/me/diet/events`. All 503 cleanly pre-migration.
- **3D green/red overlay** — NEW first-class atlas method `BodyAtlas.tintRegions({positive,
  negative})` (body-atlas.js, `v=32`): FIRST toggles on the target organs' LAYERS (via
  `layersForSeedIds`+`toggleLayer`, like Conditions `focus()` — else a seed like 'heart'
  has no mesh in the skin-only default scene and nothing tints), then isolates like
  `focusRegions` but paints positives **green** `0x6BE89B` / negatives **red** `0xFF6B6B`
  via `uniforms.uColor`; the colour is cached in `_focusColored` and restored by
  `_clearFocusState`. `dietOpenDetail` re-applies on timers (GLB streams async). (Distinct from PR#116's
  in-place `medTint`/`_medBaseColor` mechanism — they don't share cache state and both
  clear on tab-switch, so they coexist on the shared atlas.)
- **i18n.** Diet UI strings are `a.diet.*` in the JSON dicts (the standalone module reads
  them via `window.t`), added to all three locales at once.
- **Diet DETAIL mobile (PR#119 Issue#3).** `dietOpenDetail` adds class `diet-detail-open` to
  `.atlas-body` (removed by `dietBackToList` + `haSwitchTab`); a `@media(max-width:760px)`
  rule scoped to `.atlas-body.diet-detail-open` overrides the aside's inline
  `width:300px;flex:0 0 300px` → full-width vertical stack (3D body fit-to-width `order:1` on
  top, info card `order:2` below). Without the class scope the rule would reorder the other
  Atlas tabs too.

SW bump: PR#115 took `v28`, PR#116 `v29`, PR#117 `v30` (+ `v31` follow-up for the
`tintRegions` layer-loading fix; `body-atlas.js?v=32`). PR#118 `v32`, **PR#119 `v33`**.

## Mobile bottom-nav (PR#119 Issue#6)

The fixed mobile bottom-nav rule is scoped to **`.dash-nav-primary`** (the ONE primary
top-level tab bar), NOT every `.dash-tabs`. The blanket `@media(max-width:768px){.dash-tabs{
position:fixed;bottom:0}}` used to pin the inner sub-tab strips (`#evo-subtabs`
Personal/Collective/Family, the admin sub-tab bars) to `bottom:0` too, so they stacked on top
of the bottom-nav — the "две полоски накладываются" overlap. Inner `.dash-tabs` now flow
inline (`position:static` + horizontal-scroll). Add a new top-level nav? give it
`class="dash-tabs dash-nav-primary"`. Add an inner sub-tab bar? plain `class="dash-tabs"` is
fine — it will NOT be pinned.

---

## Cross-link points

- **Sensation → Emotion** (PR#108): carries body+sensation into the emotion live map
  via `nmCarriedLive` (PR#111).
- **Thought → Emotion** (PR#108).
- **Diary → Emotion** (PR#112 #3): `nmDiaryLinkTo()` sets
  `nmSetCarriedLive(nmMiniDiaryModel())` so the emotion walkthrough EXTENDS the diary
  map instead of resetting it.

`nmCarriedLive` must be **cleared on a fresh, non-handoff open**, or stale nodes leak
into the next unrelated flow.

---

## Grand bugs (recurring — verify these did not regress)

1. **Mass-merge blob** — lingering `nmSessionHandoff` flag glued unrelated flows
   (PR#112). Fixed by rotate-on-open + TTL. Server bridging was already correct
   (clean separate flows → separate clusters; proven by repro).
2. **Cross-product / phantom-stick links** — bridge must be single-seam, same-session
   only (PR#108/#111, migration 041).
3. **Sticky-bubble physics** — sensation bubbles glue to their body part via a
   ring-slot/force model, NOT repulsion (repulsion degenerates when nodes coincide);
   `_sticky` links must be skipped in BOTH `nmSimulate` AND `fsTick` draw loops, else
   they render as stray arrow-lines (PR#102–107).
4. **Path duplicates** — the `neuro_resource_diary` sensation *mirror* rendered
   alongside the real cyan sensation node ("два жара / две мягкости"). Backfill must
   skip `^\s*sensation\s*:` rows; render must drop sensation-mirror insights;
   migration 042 cleans history (PR#112 #4).
5. **Sensation Map UI** — body picker 50% left, live map 50% right, footer buttons
   BELOW the body (sticky `margin-top:auto`), never an absolute bar overlapping the
   figures (PR#112 #2; inline CSS `.nm-fs-form`/`.nm-fs-live`/`.nm-fs-footer`).

---

## Diagnoses section (PR#115 → restructured by PR#119)

**PR#119 moved diagnoses INTO `Tools → Internal Field → "Диагнозы и состояния"`** (the
`ha`-engine Conditions sub-tab, `ha-tab-conditions`). The old standalone top-level
`#tab-diagnoses` / `data-tab="diagnoses"` tab is GONE; `switchTab('diagnoses')` (and any
`#diagnoses` bookmark) now redirects to Tools → Internal Field → conditions. There is ONE
unified list: the `human_conditions` catalog **plus** the 12 PR#115 catalog diagnoses.

- **Two catalogs, one list.** `human_conditions` (DB table, 30+ conditions, 3D-atlas
  `affected_region_ids`) is loaded by `ensureData`; the 12 catalog diagnoses come from the
  static **`data/diagnoses.json`** (tri-lingual ru/en/es, groups vasculitis/thymus/oncology;
  each `slug`/`group`/`icd10`/`regions[]`/`name`/`aka`/`summary`/`symptoms`/`complications`).
  `dxMergeCatalog()` folds the 12 into `DATA.conds` as condition-shaped rows, mapping their
  schematic `regions` → real BodyAtlas seed-ids via **`DX_SEED`** (brain→brain,
  thyroid→thyroid-gland, lungs→lungs, stomach→stomach, kidneys→kidneys, colon→large-intestine,
  skin→skin, mediastinum→heart; breast/prostate/bone_marrow/lymph_nodes/spleen have no mesh →
  list-only). `_isDx`/`_dx` keep the raw entry for the symptoms/complications shown in the
  detail card. To add a catalog diagnosis: append to the JSON, add its slug to
  `KNOWN_DIAGNOSIS_SLUGS`, and (for a 3D zone) add a `DX_SEED` mapping.
- **Claim on EVERY card.** `haSelectCondition`'s detail renders a "Это мой диагноз"
  (`a.dx.add_mine`) button for catalog AND human_conditions rows. The claim endpoint
  (`POST /api/diagnoses/:slug/claim`) now validates the slug against `KNOWN_DIAGNOSIS_SLUGS`
  **OR** `human_conditions` (so existing conditions are claimable too), with a slug-format
  guard. `user_diagnoses`/`user_medical_files` (mig044) unchanged.
- **"Мои диагнозы" folder** (`#ha-cond-mine`, sticky at the top of `#ha-left-conditions`):
  claimed list + per-item upload/✕ + a **"Сводное воздействие"** button when ≥2 claimed.
- **Combined view = the REAL 3D atlas** (`haCondCombined` → `focus(union)` over every claimed
  diagnosis' `affected_region_ids`, + `showCombinedCard` overlay listing overlapping zones and
  pooled symptoms/complications). NOT the old schematic `dxBodyMap`.
- **The `dx*` IIFE is now a shared claim/upload SERVICE**, not a tab renderer. The Conditions
  panel calls `window.dxSetCatalog(items)` (name registry for all slugs) so `dxClaimPrompt`/
  `dxOpenUpload`/`dxOpenAllDocs` can title any slug; every dx* mutation calls
  `dxAfterChange()` → `window.haDxRefresh()` so the folder/detail/profile refresh.
- **Profile tab "Мои документы"** (`#profile-docs-card`, `profileLoadDocs`/`profileDocsToggle`):
  expandable list of every medical file across all claimed diagnoses, hidden until ≥1 file.
  Owner-scoped (`/api/me/medical-files`); superadmin reads others via
  `GET /api/admin/users/:id/diagnoses` + `/medical-files`.
- i18n: all UI strings are `a.dx.*` flat keys, present in ALL THREE locales (`t()` does a
  FLAT `dict[key]` lookup — keys must be flat `"a.dx.x"`, NOT nested). `a.tabs.diagnoses` is
  now unused.

---

## Admin / ops

- **`DELETE /api/admin/wipe-day?user_id=…|email=…&date=YYYY-MM-DD`** (server.js
  ~L7082) — superadmin-only. Disposes a tester's whole day across `journey_events`,
  `nm_nodes`, `nm_links`, `nm_session_nodes`, `nm_chains` (PR#114: started that day or
  emptied by the node sweep), `neuro_resource_diary`, orphaned `journey_links`.
  Accepts email OR uuid. Gated `403` for non-superadmin.
- **Superadmin** is `SUPERADMIN_EMAILS` + `SUPERADMIN_LIMIT=2` (env on Railway).
  Slots are limited; a fresh `test.local` user only auto-promotes if a slot is free.
- Railway has no auto-migrate: `POST /api/run-migrations` after each backend deploy.

---

## Test strategy

- **Harness PASS ≠ prod OK.** A green local/intercept harness must be followed by a
  **fresh-user prod repro** (register a throwaway user, walk the real UI).
- Local `account.html` cannot hit the API directly (CORS blocks localhost) — serve it
  on the prod ORIGIN via puppeteer request-interception (see `scripts/pr1xx-*.mjs`).
- Railway is a **rolling deploy** — confirm convergence over multiple trials; a single
  post-deploy hit may still see the old container.
- Always verify the deployed asset version (SW `CACHE_NAME`, `?v=NN` query strings)
  matches what you shipped; the preview/browser caches linked CSS/JS aggressively.

## i18n footgun (`_pr95t` family)

Every UI string key (`a.tools.*`, `mini_*`, `rate_*`, hub button labels, …) MUST
exist in **all three** locales (`ru`, `en`, `es`). A key present only in `ru` shows
Russian text inside the English/Spanish UI (the PR#109 #2 bug). When you add a
string, add all three at once.
