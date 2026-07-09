# New bugs C1–C3 — root-cause analysis (Session B audit, 2026-07-08)

Read-only audit against worktree `sessionB-audit` @ e58bef7. All line numbers are
from that checkout of `account.html` / `assets/js/body-atlas.js` / `api/server.js`.

---

## Bug C1 — NeuroMap date-range «Применить» does nothing

**Symptom (Nick):** open NeuroMap, pick a from/to date range, click «Применить» —
the map doesn't change, it keeps showing the same period.

### Client path
- Button: `account.html:1849-1853` — two `<input type="date">` (`#nm-date-from`,
  `#nm-date-to`) + `<button onclick="nmApplyDateRange()">Применить</button>`.
- Handler `nmApplyDateRange()` — `account.html:8708-8718`. It sets the module global
  `nmCustomRange = {from, to}` (epoch ms) and calls **`buildNmGraph()`** — a pure
  client re-render. **It never re-fetches the graph.**
- The only graph fetch is `nmLoadV2Graph()` (`account.html:8424-8446`) which hits
  `GET /api/neuromap/v3/graph` **with NO date params**:
  `fetch(base+'/api/neuromap/v3/graph', {headers:{Authorization:...}})`.

### Server path (for contrast)
- `GET /api/neuromap/v3/graph` (`server.js:3521`) **does** support `range`/`from`/`to`
  and filters chains in SQL by `started_at BETWEEN from AND to` (`server.js:3542`) and
  nodes in JS by chain-membership OR `last_seen_at` in window (`server.js:3569-3575`).
  **But the client never sends those params**, so the server always returns full history.

### Where the client actually crops
- `buildNmGraph()` v3 node loop, `account.html:10051-10058`: for each node
  `if(!nmTsInRange(lastSeen)) return;` — cropping is done against the node's single
  **`last_seen_at`** timestamp. Edges are not date-filtered; a link only drops if an
  endpoint node was already cropped (`account.html:10059-10064`).

### Root cause (two compounding faults)
1. **No re-fetch + crop-by-`last_seen_at` on deduped nodes.** `nm_nodes` are
   DB-deduplicated to ONE row per concept, carrying only the *most-recent* occurrence
   time. For any window ending at/near today, essentially every still-active concept has
   a recent `last_seen_at` inside the window → nothing drops → "map doesn't change."
   For a purely-historical window, a concept that recurred inside the window but was also
   felt later has `last_seen_at > to` → it is wrongly **dropped**. The filter is
   semantically backwards from "show my map for that week."
2. **Internal inconsistency:** the per-node *count* IS period-scoped (via chain
   `started_at` in `nmNodeViewCount`, `account.html:6973-6984`), but node *visibility*
   is by `last_seen_at`. So "appears N×" changes with the range while the drawn node set
   barely does — reads to the user as "the picker does nothing."

### Fix direction (cheapest → most correct)
- **Preferred:** filter node visibility (and edge visibility) by in-range **chain
  membership** (`nmV2Graph.chains[].started_at`) — the exact source `nmNodeViewCount`
  already uses — so node set, count, and edges all agree with the window.
- **Alternative:** pass `from`/`to` from `nmApplyDateRange` into `nmLoadV2Graph` →
  `/v3/graph?from=…&to=…` and re-fetch (server already honours it). Cropping the deduped
  `last_seen_at` can never reconstruct an arbitrary past window.
- Watch the server range map too: `/v3/graph` only maps `day|week|month`; any other
  `range` string with no explicit `from` collapses to `from=null` → full history
  (`server.js:3524-3538`).

---

## Bug C2 — Medications master toggles (Skeleton/Muscles/Internal) don't work everywhere

**Symptom (Nick):** in the Medications 3D view the master toggles don't take effect on
all drugs.

### Facts
- ONE shared atlas — `window._anatomyAtlas`, created once at `account.html:17784`.
  Anatomy / Functions / Conditions / Diet / Medications all drive the same instance.
  So this is a **state-desync between render paths**, not two atlases.
- Meds toggles: UI `account.html:1783-1785` → `medToggleLayer(group,checked)`; logic
  `account.html:18472-18490`. Groups:
  `skeleton:['skeleton']`, `muscles:['muscles']`,
  `internal:['organs','nervous','vessels','female_reproductive','placenta','endocrine']`.
- Those handlers call **`setTintOpacity`**, NOT `toggleLayer`. `setTintOpacity`
  (`body-atlas.js:1595-1623`) iterates **only `this._focusBoosted`** — the meshes the
  *current drug actually tinted*.

### Root cause
The Meds master toggles operate over `_focusBoosted` (the subset of meshes the current
drug painted), whereas the Anatomy-tab toggles call `toggleLayer(name, visible)` which
shows/hides the ENTIRE GLB layer group. Consequences:
- A toggle can only fade a layer the current drug actually **tints**. A skeleton/muscle
  envelope shown but not toned, or any mesh left visible by the `matchCount===0`
  early-return path (see C3), is not in `_focusBoosted` → the checkbox silently no-ops.
- `_focusBoosted` is rebuilt on every `tintRegions` pass, and the tint is applied on
  async timers (`apply(); setTimeout(apply,400/950/2100)`, `account.html:18463`) to chase
  the streaming GLB. A toggle flipped against a not-yet-tinted/not-yet-streamed layer
  lands on an empty/partial `_focusBoosted` and does nothing until a later pass →
  "works on some drugs, not others."

### Fix direction
Have the Meds master toggles call **`toggleLayer(group, on)`** (whole-layer show/hide,
matching the Anatomy tab) instead of — or in addition to — `setTintOpacity`. Re-assert
toggle state after each async `tintRegions` pass.

---

## Bug C3 — stray cyan "net"/wireframe body outline in Medications, uncovered by any toggle

**Symptom (Nick):** a net-like/wireframe outline of the body appears in Medications that
no toggle controls; it appears/disappears seemingly at random. "We removed this layer in
the normal Anatomical Atlas but it stayed in Medications."

### The single source of the net
- `makeWireframe` (`body-atlas.js:233-241`) is the ONLY generator of the net:
  `WireframeGeometry → LineSegments`, cyan `LineBasicMaterial`, opacity 0.18-0.22.
- It is added to the **`skin`** layer in `_mountBody` at **`body-atlas.js:458`**
  (`skin.add(makeWireframe(g, COLD_CYAN, 0.18))`), and skin is then force-hidden
  (`skin.visible=false`, `body-atlas.js:482`).
- Real GLB layers (`_loadRealLayer`, `body-atlas.js:907+`) get NO wireframe and even hide
  incoming line primitives (`body-atlas.js:956-958`). So the net can ONLY come from skin.
- Anatomy default (`_applyLayerConfig`, `body-atlas.js:783-800`) lists
  `['muscles','skeleton','nervous','vessels','organs']` — **skin deliberately excluded**
  and re-forced hidden (`body-atlas.js:798-799`). *This* is the "we removed it in the
  Anatomical Atlas" the user means.

### Why Medications revives it (root cause)
- `tintRegions` (the Diet+Meds path, `body-atlas.js:1496-1589`) begins by toggling ON the
  target organs' layers: `['skin','muscles','skeleton',...].forEach(l => toggleLayer(l,
  !!need[l]))` (`body-atlas.js:1511-1517`). `MED_SEED.skin=['skin']` (`account.html:18373`)
  → `medResolveSeeds` → `layersForSeedIds` returns `'skin'` (`body-atlas.js:1445-1451`).
  So **any drug whose targets include skin runs `toggleLayer('skin', true)` → skin group
  visible → the wireframe net appears.** Many meds target skin, e.g.
  `api/medications-seed.js:446` (`target_organs_negative:['skin']`, skin-only), plus
  lines 31/81/98/129/163/179/562/629/645, and skin entries in `medications-pr121-data.js`.
- `tintRegions` HAS a wireframe-hiding pass (collects LineSegments into `wires` at
  `body-atlas.js:1535-1540`, hides them at `1551`) — **but it sits AFTER the early return
  `if (matchCount===0){ …; return this; }` at `body-atlas.js:1549`.** Skin fill meshes
  carry no `userData.regionId` (mounted in `_mountBody`, not `_loadRealLayer`), so they're
  never counted in `matchCount` (guard at `1541`). A **skin-only drug** (e.g. seed line
  446) therefore hits `matchCount===0` → early return → **wireframe never hidden → net
  stays on screen.**
- Even when `matchCount>0` and the wires ARE hidden, they're recorded in `_focusVis` with
  `prior=true`; `_clearFocusState` (`body-atlas.js:1459-1463`, called by `medClearTint`
  `account.html:18441`) restores them to **visible** on med-switch/card-close. The next
  drug that doesn't target skin runs `toggleLayer('skin', false)` and hides it again →
  **the "appears/disappears at random" flicker as the user moves between drug cards.**
- Contrast: Conditions `focus()` (`account.html:18316`) runs the same toggle loop but its
  `need` set **never contains `skin`** (`account.html:18313-18315`), so Conditions/Functions
  never revive the net. Medications is the only tab whose seed map feeds `skin` into
  `layersForSeedIds`. That is exactly the "removed in Anatomy, stayed in Medications"
  asymmetry.
- **No Meds toggle governs it:** `MED_LAYER_GROUPS` has skeleton/muscles/internal but no
  `skin`, and the wireframe is a `LineSegments` (never in `_focusBoosted`), so
  `setTintOpacity` can't touch it regardless.

### Fix direction
1. In `tintRegions`, move the wireframe-hide (currently `body-atlas.js:1551`) **above** the
   `matchCount===0` early return (`1549`) — or hide skin wires unconditionally at the top
   of the isolate pass.
2. Drop `skin` from `MED_SEED` / the toggle `need` list — treat skin as chip-only (like
   spleen/thymus), so Medications never toggles the skin layer on.
3. (Belt-and-suspenders) keep skin unconditionally hidden in the Meds path, matching
   `_applyLayerConfig`.

### Key line references
- Wireframe generator: `body-atlas.js:233-241`; added at `458` (skin) / `518` (procedural)
- Skin excluded+hidden in Anatomy: `body-atlas.js:482`, `788`, `798-799`
- Meds revives skin: toggle loop `body-atlas.js:1511-1517` + `MED_SEED.skin` `account.html:18373`
  + `layersForSeedIds` `body-atlas.js:1445-1451`
- Wireframe-hide after early-return gap: `body-atlas.js:1549` (return) vs `1535-1540`/`1551` (hide)
- `_clearFocusState` restores wires: `body-atlas.js:1459-1463` ← `medClearTint` `account.html:18441`
- Meds toggles use `setTintOpacity`/`_focusBoosted` only: `account.html:18472-18490`,
  `body-atlas.js:1595-1623`
- Single shared atlas: `account.html:17784`
