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
  one connected component.
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

---

## Node dedup vs chain integrity — split-on-render (PR#113, Option A)

`nm_nodes` are **deduplicated in the DB** by `(user_id, type, normalized_label, valence)`
— one row per concept, `count` accumulates. This powers the vocab library and
frequency sizing. But it is **catastrophic for chain integrity**: the same emotion
(«интерес») picked in two unrelated flows resolves to ONE node, and the per-chain
`nm_links` from both flows attach to it → the node becomes an articulation point that
fuses the two flows into one connected blob (Tahir's "кишмиш" / mass-merge). This is
the SAME mechanism that produced the PR#108 phantom-stick.

**Fix = split-on-render, NOT split-in-DB.** The DB stays deduplicated. The
`/api/neuromap/v2/graph` response carries each node's `sessions` array (from
`nm_session_nodes`). `buildNmGraph` (account.html) renders **one instance per
`(node, session)`**: instance `id = dbId+'@'+sessionId`, carrying `dbId`, `_sid`,
`_baseKey`. A link is drawn only inside sessions BOTH endpoints share (`common`
sessions); a cross-session edge (the fusion link) is simply not drawn. `fsTick`
(fullscreen) and the analysis panel both consume `nmNodes`/`nmLinks` so they split
automatically; the analysis panel keys counts by label (one entry, total count — no
double-count). **No migration**: `nm_session_nodes` is already populated for every
append (both v2/append and /sensation call `nmBridgeSession`), so existing fused
graphs un-fuse on next load. Legacy pre-session nodes get `sessions:[]` → one
standalone instance keyed under the sentinel `'__nosess'`.

The Personal Path has the MIRROR bug: re-saving a flow logs a NEW `journey_event`
pointing at the SAME deduped `nm_node`, so one concept rendered twice in a chain
(«мягкость → голова → мягкость»). Fix = `buildTunnelComponents` (evolution-path.js)
collapses events by content key (`nm_node_id`, else `layer+label`) **per-component**
to the earliest, rewiring edges. PER-COMPONENT only — a global dedup would re-merge
unrelated sessions and recreate the blob on the Path.

Superadmin can prune a single node via the NeuroMap node popup → red Delete →
`POST /api/admin/nm-node/:id/delete` (server.js): removes the `nm_nodes` row, every
`nm_link` touching it, its `nm_session_nodes`, the `journey_events` whose
`payload.nm_node_id` matches, and orphaned `journey_links`; then the client reloads
the graph and re-mounts the Path.

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
   for node tones; body-first ordering.

---

## Migrations 034–042 (INLINE in `POST /api/run-migrations`, server.js ~L293)

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

`run-migrations` returns `{ ok, message, mig039, mig040, mig041, mig042 }`.

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

## Admin / ops

- **`DELETE /api/admin/wipe-day?user_id=…|email=…&date=YYYY-MM-DD`** (server.js
  ~L7082) — superadmin-only. Disposes a tester's whole day across `journey_events`,
  `nm_nodes`, `nm_links`, `nm_session_nodes`, `neuro_resource_diary`, orphaned
  `journey_links`. Accepts email OR uuid. Gated `403` for non-superadmin.
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
