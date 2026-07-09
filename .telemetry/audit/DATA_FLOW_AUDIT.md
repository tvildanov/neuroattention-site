# NeuroAttention — DATA FLOW AUDIT (Session B, read-only)

Worktree `sessionB-audit` @ `e58bef7`. All line numbers from this checkout of
`api/server.js` (10,579 L), `account.html`, `assets/js/evolution-path.js`,
`assets/js/body-atlas.js`. Produced in parallel with Session A (Nick-account reset).
**No product files touched.** Companion doc: `new-bugs-c1-c3.md`.

Legend: 🟥 real bug · 🟧 sharp edge / footgun · 🟩 verified-correct invariant.

---

## Shared helpers (used by every write path)

| Helper | Location | What it does |
|---|---|---|
| `logJourney(userId, kind, layer, payload, occurredAt, dependentId, sessionId)` | `server.js:5540` | One `INSERT INTO journey_events (user_id, kind, layer, payload, occurred_at, dependent_id, session_id) … RETURNING id`. `layer` defaults to `kind`. `session_id` sliced to 80 chars. try/catch → null on fail. |
| `bridgeJourneySession(userId, sessionId, newEventIds)` | `server.js:5569` | Links latest PRIOR same-session journey_event → `ids[0]` via `linkJourney(prior, ids[0],'sequence')`. Single seam, JS-side filter (no array cast). |
| `nmTypeToJourney(type)` | `server.js:5613` | `emotion→emotion`, `thought→thought`, `area→sensation`, `cause/event→event`, `practice→practice`, else `event`. 🟧 Takes ONE arg; callers at 3375/3309 pass `(type, metadata)` — 2nd arg silently ignored. |
| `nmBridgeSession(userId, sessionId, newNodeIds, whenIso, source)` | `server.js:3215` | The seam + chain maintainer. Full detail in §2. |

🟧 **No handler uses a DB transaction.** Every write path is a sequence of independent
awaited `sql\`\`` calls inside one `try/catch`. A mid-sequence failure leaves partial
rows (e.g. nm_nodes written, chain not). This is the single biggest structural fragility.

---

## 1. SAVE HANDLERS

### 1.1 `POST /api/neuromap/sensation`  (source=`sensation`)
- **Location:** `server.js:5820` · **Transaction:** no (one try/catch, catch @6004)
- **Write order:**
  1. read-only vocab resolve (`vocab_terms` sensation @5829 / body_location @5830)
  2. guard: sensations but 0 body locations → `400 body_part_required` (@5849)
  3. **dependent branch** (@5863): ONE `logJourney('sensation','sensation', {sensation_ids, sensation_labels, body_locations, body_location_slugs, intensity, comment, dependent:true, source:'sensation'}, when, sensDepId)` → early return (NO nm_nodes/chain)
  4. `INSERT neuro_resource_diary (user_id,date_key,text,comment)` — the `"Sensation: … @ …"` **mirror** row (@5878) 🟧 the PR#112 #4 dup source
  5. per body loc: `INSERT nm_nodes (…, type='area', valence='neutral', count=1, metadata={source:'sensation',slug,area_kind:'body'}) ON CONFLICT (user_id,type,normalized_label,valence) DO UPDATE count+1 … RETURNING id` (@5884) → `nmNodeIds[]`
  6. per felt word: same INSERT `type='sensation'`, `metadata={source:'sensation',slug}` (no area_kind), count-accumulate, RETURNING id (@5903) → `sensNodeIds[]`
  7. 🟧 **cross-product** `nm_links` for EVERY `sensNodeIds × nmNodeIds` pair (@5912-5919) — intentional intra-batch sensation↔body wiring (NOT the session bridge)
  8. journey events — **ONE PER NODE** (PR#111 #3): body loc @5935, sensation word @5944 → `flowEventIds[]`
  9. `linkJourney(flowEventIds[k],[k+1],'sequence')` (@5953)
  10. `bridgeJourneySession(userId, session_id, flowEventIds)` (@5960)
  11. context binding `link_to[]` (@5966): correlation links + mirror to nm_links if target has `nm_node_id`
  12. custom context (@5990): each → `logJourney('thought','thought',{label,source:'custom_context'})` + correlation
  13. `nmBridgeSession(userId, session_id, nmNodeIds.concat(sensNodeIds), when, 'sensation')` (@6000)
- **journey_events payload:** `{label, nm_type('area'|'sensation'), area_kind('body'|absent), nm_node_id, body_locations[], body_location_slugs[]?, sensation_ids[]?, sensation_labels[]?, intensity?, comment?, valence:'neutral', source:'sensation'}`
- **session_id source:** request body (@5824)

### 1.2 `POST /api/neuromap/v2/append`  (emotion / thought / diary-emotion — the universal chain endpoint)
- **Location:** `server.js:3285` · **Transaction:** no (catch @3422)
- **Write order:**
  1. **dependent branch** (@3304): per item `logJourney(kind,layer,{label,valence,nm_type,source:'neuromap',dependent:true,coords}, occAt, depId)` + consecutive `linkJourney`; early return (NO nm_nodes/chain; payload has **no `nm_node_id`**)
  2. per item: `INSERT nm_nodes (…count=1…) ON CONFLICT DO UPDATE count+1, label=EXCLUDED.label RETURNING id` (@3352). 🟩 **in-call dedup**: `dedupeKey=type|normLabel|valence`; a repeat in the SAME call does a plain `SELECT id` WITHOUT incrementing (@3337) → one API call bumps a concept once → `nodeIds[]`
  3. journey events — one per node: `logJourney(kind,layer,{label,valence,nm_node_id,nm_type,area_kind|null,source:'neuromap',coords|null}, occAt, null, _sid)` (@3376) → `journeyIds[]`
  4. consecutive `linkJourney(…,'sequence')` (@3387)
  5. `bridgeJourneySession(userId,_sid,journeyIds)` (@3392)
  6. consecutive `nm_links` upsert count+1 (@3399)
  7. `chainSource` derived: any emotion→`emotion`, else thought/concept→`thought`, else sensation/area→`sensation`, else `diary` (@3414-3418)
  8. `nmBridgeSession(userId, session_id, nodeIds, occAt, chainSource)` (@3419)
- **journey_events payload:** `{label, valence, nm_node_id, nm_type, area_kind|null, source:'neuromap', coords|null}`
- **session_id source:** request body (`_sid` @3371, again @3419); `occurred_at` from body → backdating (@3298)
- 🟩 **There is NO separate thought or diary-emotion endpoint.** Emotion 6-step, thought flow (`type:'thought'|'concept'`), and the NeuroMap diary flow all POST a `chain[]` here.

### 1.3 `POST /api/diary/save`  (standalone Resource-Diary — Path-only, by design)
- **Location:** `server.js:3851` · **Transaction:** no (catch @3884)
- **Writes:** dependent branch @3865 (insight event, early return) · else `INSERT neuro_resource_diary (…) RETURNING id` @3873 · `logJourney('insight','insight',{text,comment,plus_count,minus_count,valence,date_key,diary_id,source:'diary'})` @3878
- **payload:** `{text≤280, comment, plus_count, minus_count, valence, date_key, diary_id, source:'diary'}` · kind=layer=`insight`
- **session_id:** NONE → no chain. 🟩 By design (no nm_nodes). No `nm_node_id` → delete-propagation never targets these.

### 1.4 `POST /api/me/diet/event`  (diet quick chip — Path-only, by design)
- **Location:** `server.js:10313` · **Transaction:** no (Path mirror in nested try/catch @10328; outer @10338)
- **Writes:** validate `event_kind` ∈ `clean|sugar_excess|alcohol_excess|overeating|skipped|heavy|other` @10317 · `INSERT diet_events (…) RETURNING id` @10323 · `logJourney('diet','event',{label,event_kind,notes?,icon:'🍽'}, whenIso, depId, null)` @10333
- **payload:** `{label, event_kind, notes?, icon:'🍽'}` · kind=`diet`, **layer=`event`** (diet isn't a Path lane bucket, so it rides the generic `event` lane, @10330 comment)
- **session_id:** NONE (`null` @10335) → no chain. 🟩 By design (PR#117).
- 🟧 `depId=parseInt(dependent_id)` (@10322) does NOT go through `resolveDependentId` — not owner-validated here, unlike other handlers.

### 1.5 Thought flow
🟩 No dedicated endpoint — a case of §1.2 with `type:'thought'|'concept'`.
`nmTypeToJourney('thought')→{thought,thought}`; `chainSource` classifies thought/concept→`thought`.
Free-text "custom context" in the sensation flow also persists as a thought event
(`server.js:5992`, no session_id → bare correlated Path node, no chain).

### Save-handler summary table

| Handler | nm_nodes | nm_session_nodes | nm_chains/_nodes | journey_events | neuro_resource_diary | nm_links | session_id | txn |
|---|---|---|---|---|---|---|---|---|
| `/sensation` | ✅ area+sensation, count+1 | ✅ (via bridge) | ✅ src=sensation | ✅ 1/node | ✅ mirror row | ✅ cross-product + seam | body | ❌ |
| `/v2/append` | ✅ any type, count+1, in-call dedup | ✅ (via bridge) | ✅ src=derived | ✅ 1/node | ❌ | ✅ consecutive + seam | body | ❌ |
| `/diary/save` | ❌ | ❌ | ❌ | ✅ insight | ✅ | ❌ | none | ❌ |
| `/me/diet/event` | ❌ | ❌ | ❌ | ✅ diet/event | ❌ | ❌ | none | ❌ |

---

## 2. CROSS-LINK CONTRACT

### 2.1 `nmCarriedLive` (client, `account.html`)
Snapshot/restore mechanism that carries body+sensation (Sensation→Emotion, PR#111),
thought→emotion, and diary→emotion (`nmDiaryLinkTo()` → `nmSetCarriedLive(nmMiniDiaryModel())`).
**Must be cleared on a fresh non-handoff open** or stale nodes leak into the next flow
(CLAUDE.md invariant). Cross-link keeps the SAME `session_id` so the linked pair is one
component; close+reopen rotates a NEW uuid (`nmConsumeSessionHandoff`, `NM_HANDOFF_TTL=8000`).

### 2.2 `nmBridgeSession` (server, `server.js:3215`) — 🟩 PR#111 single-seam VERIFIED intact
- Guard @3216-3220: no sessionId/empty → 0; `sid=slice(0,80)`; `ids=[...new Set(filter(Boolean))]`.
- **Seam selection** (@3235-3240):
  ```sql
  SELECT sn.node_id,
    CASE WHEN n.type='area' AND n.metadata->>'area_kind'='body' THEN 1 ELSE 0 END AS is_body
  FROM nm_session_nodes sn JOIN nm_nodes n ON n.id=sn.node_id
  WHERE sn.user_id=$user AND sn.session_id=$sid
  ORDER BY is_body ASC, sn.created_at DESC, sn.node_id DESC
  ```
  `prior = existingRows.map(node_id).find(id => !ids.includes(id))` (@3241) — exactly ONE
  prior node: first non-body, most-recent session node not in this batch. Body `area`
  nodes sort LAST so a body part never anchors the chain.
- **Single edge, NOT cross-product** (@3243-3249): only if `prior` exists, ONE insert
  `prior → ids[0]` `ON CONFLICT count+1`. 🟩 No nested loop — PR#108/#111 phantom-stick
  bug is NOT present.
- **Same-session guarantee:** the `WHERE sn.session_id=$sid` (@3239) makes cross-session
  edges impossible.
- **Register batch** (@3251-3255): each nid → `nm_session_nodes … ON CONFLICT DO NOTHING`.
- **Chain maintenance** (own try/catch @3263-3280):
  1. `INSERT nm_chains (user_id,session_id,started_at,finished_at,source) VALUES (…$when,$when,$source) ON CONFLICT (session_id) DO UPDATE finished_at=GREATEST(…), source=COALESCE(existing,new) RETURNING id`
  2. `pos = MAX(position)+1` for that chain
  3. per nid in `ids` order → `INSERT nm_chain_nodes (chain_id,node_id,position) … ON CONFLICT DO NOTHING`, pos++
- **Callers:** `/sensation`→`'sensation'`; `/v2/append`→derived `chainSource`.

### 2.3 How cross-links land in chains
Because a cross-linked pair shares one `session_id`, it becomes **ONE chain** (one
`nm_chains` row keyed on that session_id), with both flows' nodes appended at running
`position`. The single seam links the modalities inside that one chain — NOT two chains
with a bridge.

---

## 3. RENDER CONTRACT

### 3.1 `GET /api/neuromap/v3/graph`  (`server.js:3521`; v2 fallback @3430)
- **nodes SQL** (@3562): `SELECT … FROM nm_nodes WHERE user_id=$u ORDER BY count DESC` — **unfiltered by date at SQL level**; visibility computed in JS.
- **chains SQL** (@3540-3545) — the ONLY place a date WHERE is emitted:
  - `from` set → `… WHERE user_id=$u AND started_at>=$from AND started_at<=$to ORDER BY started_at ASC`
  - `from` null → `… WHERE user_id=$u ORDER BY started_at ASC`
- **membership** (@3549): `SELECT chain_id,node_id,position FROM nm_chain_nodes WHERE chain_id=ANY($ids::bigint[]) ORDER BY chain_id,position ASC`
- **links formula** (@3582-3623):
  1. chain consecutive pairs → undirected deduped edges; `count`=#chains sharing; carries `chain_ids[]`, `last_seen_at`
  2. **union nm_links (PR#118), narrowed by PR#123 B2** (@3604-3623): skip if `a===b`; skip if either endpoint not visible; **skip if BOTH endpoints already chained** (`chainedIds.has(a)&&chainedIds.has(b)` → chain authoritative). So nm_links only reconnects chained↔orphan / orphan↔orphan. Chain edges always win.
- **node visibility JS** (@3567-3580): in-range chain member, OR (if `from`) `last_seen_at ∈ [from,to]`, OR (if `!from`) everything.
- 🟩 **date filtering IS applied server-side when `from` resolves non-null.** 🟧 BUT: `range` maps only `day|week|month`; `all` and any unmapped value (`year`, `3months`) with no explicit `from` → `from=null` → NO filter → full history. v2 fallback has NO date params. **And the client never sends date params anyway (Bug C1).**

### 3.2 `GET /api/users/me/evolution`  (`server.js:7816`) — the Path timeline
- **Source:** PRIMARY = `journey_events` (@7863). Does NOT read events from nm_chains, but
  JOINs nm_chains/nm_chain_nodes to resolve each event's **chain `position`** (PR#123 D1,
  @7887-7893, fault-tolerant → falls back to time order pre-migration).
  ```sql
  SELECT id,kind,layer,payload,occurred_at,session_id FROM journey_events
  WHERE user_id=$me AND dependent_id IS NULL
    AND occurred_at>=$from AND occurred_at<=$to ORDER BY occurred_at ASC
  ```
- **Legacy fallbacks** (@7899-7913, gated by `haveJE[layer]`): `course_block_progress`
  (practice), `nm_nodes` agg (emotion/thought/sensation/event), `calendar_events` (event,
  always), `neuro_resource_diary` (insight).
- **Range:** always applied. `?from`/`?to` override `?period ∈ day|week|month|3months|year|all`
  (default `month`; `all`=36500 days). `?subject=dependent:<id>|team:<id>` scope switch.
- **Sort:** all SQL `ORDER BY occurred_at ASC`; each lane re-sorted by time (@8065); flat
  stream sorted by time (@8073). `position` carried per item (@8001) for evolution-path.js.
- **Dedup / mirror filter:** journey insights `^sensation:` dropped (@8017); legacy diary
  `^sensation:` skipped (@8059). No per-node dedup here (that's the frontend).
- **Lane buckets** (@7933): `practice|emotion|event|thought|sensation|insight|xp_gain`.
  🟧 **A journey event whose `layer` is NOT one of these is silently dropped** — the reason
  diet events use `layer='event'`. `achievement`/`block_done`→`practice`; `xp`/`xp_gain`
  handled separately (cumulative curve).

### 3.3 `chains-by-node/:id` (@3634) & `chain/:id` (@3671)
- `chains-by-node`: every chain a node appears in, `started_at DESC`, + ordered members.
- `chain/:id`: numeric id, owner/superadmin gate, ordered `nm_chain_nodes` + consecutive
  edges built in JS (@3692). Feeds the info-panel mini-view.

### 3.4 `evolution-path.js buildTunnelComponents` (@863)
- **Group strictly by `session_id`** (@863-871): `bySession[sid]` = ONE branch; sessionless
  → old link-based components. 🟩 Cross-session `journey_links` ignored for sessioned events
  → two chains can't fuse.
- **Within-branch order** by chain `position` then time (@882-888).
- **Dedup** (PR#123 D1, @893-898): per-session `seenNode` keyed by `nm_node_id` — a node
  recurring WITHIN a session drawn once; across sessions drawn per branch. Events without
  `nm_node_id` (calendar/diet/insight) never deduped. `t` re-stamped monotonic (@903-904).
- **Branch order** = `anchorT` (= earliest `t` = chain `started_at`) via `layoutComponent`
  (@935-974).
- **Sessionless** → strong-`journey_links` connected components + `splitComponent` fallback
  (@914-932).

---

## 4. DELETE PROPAGATION

🟩 **Array-cast gotcha check:** NONE of the three live delete handlers use
`= ANY(${arr}::bigint[])`. All propagation deletes are pure subquery / scalar / `@>`
containment. The dangerous form appears ONLY in migration 038 (which is why «всё тело»
survived and 039 had to redo it with subqueries).

### 4.1 `POST /api/admin/nm-node/:id/delete` (@8288-8333) — the MOST COMPLETE
Superadmin gate. UUID node id. Order:
1. `journey_events` where `payload->>'nm_node_id'=:id` **OR** (`payload ? 'nm_node_ids'` AND `@> :id` AND **no other surviving array member** @8309-8312)
2. dangling `journey_links` (if events deleted)
3. `nm_session_nodes` node_id=:id
4. `nm_links` from/to=:id
5. `nm_chain_nodes` node_id=:id
6. `nm_chains` where no surviving chain_nodes
7. `nm_nodes` id=:id

Covers all five journey invariants incl. legacy array shape with last-survivor guard.

### 4.2 `POST /api/me/journey-event/:id/delete` (@8342-8377)
Owner-or-superadmin. Integer event id.
1. `journey_events` id=:eid
2. dangling `journey_links`
3. conditional node cascade — ONLY if `payload.nm_node_id` is a real UUID AND no other
   event references it (@8363): `nm_session_nodes`, `nm_links`, `nm_chain_nodes`, empty
   `nm_chains`, `nm_nodes`. Best-effort (try/catch).
- 🟧 **Gap:** reads only scalar `payload.nm_node_id` (@8355) — does NOT handle the
  `nm_node_ids[]` array shape. Deleting an array-shaped Path event leaves its nodes behind
  (later swept only by mig052 / the nm-node endpoint).

### 4.3 `DELETE /api/admin/wipe-day` (@8224-8279)
Superadmin. By `user_id`|`email` + date. Deletes by DATE (not by nm_node_id):
`nm_session_nodes` · `nm_nodes` (created or last_seen = date) · `nm_links` (last_seen=date
OR dangling) · `journey_events` (occurred OR created = date) · dangling `journey_links` ·
`neuro_resource_diary` · `nm_chains` (started=date OR emptied). `nm_chain_nodes` relies on
the `ON DELETE CASCADE` from the nm_nodes delete. All pure subqueries.

---

## 5. MIGRATION EFFECTS (034 → 054, inline `POST /api/run-migrations`)

Numbering: 035 (`nm_session_nodes`) defined @509 not in 034+ block; 037 reversed by 038
(absent); 050 does not exist (jumps 049→051); highest = 054. Response returns mig039–mig054.

| Mig | Loc | Target | Effect | Idempotent | Counter |
|---|---|---|---|---|---|
| 034 | 1521 | nm_nodes(sensation)+nm_links | backfill sensation nodes from journey_events, link to body areas | ✅ | log |
| 036 | 1567 | nm_nodes.metadata.area_kind | classify area → body/sphere | ✅ | log |
| 038 | 1592 | nm_nodes+nm_links (whole_body) | 🟥 clean slate — **BUGGY `= ANY(::bigint[])`** @1598/1615 silent-throw | partial | log |
| 039 | 1632 | nm_nodes+nm_links | label sweep «всё тело»/orphans — **rewritten pure subquery** (fixes 038) | ✅ | `{whole_body_deleted, orphans_deleted}` |
| 040 | 1679 | journey_events | backfill `session_id` (scalar @1682 + array `nm_node_ids->>0` @1692) + delete exact dups | ✅ | `{sess_single, sess_array, dupes_deleted}` |
| 041 | 1727 | nm_links | prune phantom body↔emotion/cause/thought (PR#111) | ✅ | `{phantom_links_deleted}` |
| 042 | 1756 | journey_events | delete sensation-mirror insight dups | ✅ | `{sensation_mirror_insights_deleted}` |
| 043 | 1778 | nm_chains+nm_chain_nodes | CREATE + backfill one chain per (user,session) from nm_session_nodes, body-first | ✅ | `{chains_created, chain_nodes_created, backfilled_chains, skipped?}` |
| 046 | 1850 | diets/diagnosis_diets/user_diet/diet_events | create+seed 15 diets | ✅ | `{diets_seeded, diagnosis_links, error?}` |
| 044 | 2107 | user_diagnoses/user_medical_files | CREATE, user_id UUID | ✅ | `{ok, error?}` |
| 045 | 2146 | medications/diagnosis_medications | create+seed 60 meds + dx links | ✅ | `{medications_seeded, diagnosis_links, skipped?}` |
| 047 | 2227 | journey_events+journey_links | **orphan Path cleanup (scalar nm_node_id)** | ✅ | `{orphan_events_deleted, orphan_links_deleted}` |
| 048 | 2252 | medications.organ_effects | ALTER + backfill, re-derive target_organs_* | ✅ | `{organ_effects_set, target_organs_updated, skipped?}` |
| 049 | 2282 | diagnosis_medications | upsert ~154 extra dx-med links | ✅ | `{diagnosis_links, skipped?}` |
| 051 | 2309 | journey_events + session_nodes + chain_nodes + chains + links | **full dangling sweep** (journey_events predicate IDENTICAL to 047; adds other tables) | ✅ | `{orphan_events, orphan_session_nodes, orphan_chain_nodes, chains_pruned, orphan_links}` |
| 052 | 2344 | journey_events+journey_links | **ARRAY-shape orphan sweep** (`nm_node_ids[]`, deletes only if ZERO members survive) | ✅ | `{orphan_array_events, orphan_links}` |
| 053 | 2366 | asset_migration_log | CREATE R2 audit-log table | ✅ | `{ok, error?}` |
| 054 | 2387 | practices.audio_url | rewrite audio URLs → R2 for verified assets | ✅ | `{audio_urls_rewritten}` |

### 5.1 Orphan-coverage analysis — the effective set NOT caught
- **047 vs 051 journey_events predicate is byte-identical** (scalar `payload.nm_node_id`
  → missing node). 051 adds session_nodes/chain_nodes/chains sweeps. Scalar shape = doubly
  covered.
- **052** covers the array shape (`nm_node_ids[]`) — but ONLY when NO array element
  survives.
- 🟧 **The ONE journey_events orphan shape that escapes every automated cleanup: the
  partial-`nm_node_ids`-array event** (≥1 deleted member, ≥1 surviving member). 052's
  `NOT EXISTS(JOIN nm_nodes)` is false because a member still lives → row kept → deleted
  members keep drawing ghost steps *inside* a live branch. This matches the intentional
  last-survivor guard in `nm-node/:id/delete` (@8309-8312) — a keep-the-gestalt tradeoff,
  not a straightforward bug, but it is a permanently un-swept ghost class.
- Events referencing an nm_nodes id under any key other than `nm_node_id`/`nm_node_ids`
  slip through all three (no current code writes such, but historical rows would).

---

## 6. NICK FLOW — EXPECTED vs ACTUAL

**Control chain (7 concepts, one modal flow, one `session_id`):**
`interest → work·money → flow at work → thought → context → живот(belly) → жар(heat)`

### 6.1 EXPECTED DB state (derived from the code contract above)

Assuming ONE flow = ONE `session_id`, no cross-link split, and labels distinct from any
existing deduped nodes:

| Table | Expected | Basis |
|---|---|---|
| `nm_nodes` | **7 rows** (or fewer if a label matches an existing concept → that row's `count`+1 instead of a new row) | §1.2 ON CONFLICT dedup by (user,type,norm_label,valence) |
| `nm_session_nodes` | 7 rows, same `session_id` | nmBridgeSession register (@3251) |
| `nm_chains` | **1 row** (UNIQUE session_id), `source` = derived (likely `emotion` if any emotion present, else `thought`/`sensation`) | §2.2 upsert |
| `nm_chain_nodes` | **7 rows**, `position` 1..7 in append order | §2.2 append |
| `nm_links` | **6 consecutive edges** (v2/append consecutive pairs) + the single seam (which coincides with a consecutive pair here → still 6 distinct) | §1.2 step6 + seam |
| `journey_events` | **7 rows** (one per node, PR#111), all sharing `session_id`, each payload `{nm_node_id, nm_type, source:'neuromap', …}` | §1.2 step3 |
| `journey_links` | 6 `sequence` links between the 7 events | §1.2 step4 |

**IF the flow was saved via `/sensation` for the body+heat portion AND `/v2/append` for the
emotion/thought portion as TWO calls under the SAME session_id** (the cross-link case),
then: still 1 chain, but journey_events may be 7 across two batches, and there will be an
extra sensation↔body cross-product `nm_links` edge (§1.1 step7) plus a `neuro_resource_diary`
mirror row for the sensation. Chain node count still 7 (positions continue across batches).

### 6.2 Divergences to watch for (candidate bugs) when comparing Session A snapshots
1. **>7 or duplicate nm_chains** → session_id rotated mid-flow (KING-invariant regression;
   check `nmConsumeSessionHandoff` / lingering handoff).
2. **journey_events count ≠ chain node count** → a partial-write (no transaction, §top) or a
   dependent-branch early-return firing unexpectedly.
3. **nm_chain_nodes positions with gaps / duplicates at same position** → concurrent appends
   or ON CONFLICT DO NOTHING dropping a re-felt node (expected for a legit recurrence).
4. **journey_events with `nm_node_id` pointing at a missing node** → orphan ghost (mig047/051
   should have swept scalar; a partial-array survives — §5.1).
5. **Two branches on the Path for one flow** → session_id split OR an event missing
   `session_id` (falls into sessionless link-components).
6. **Extra `neuro_resource_diary` "Sensation:" row rendering as a 2nd Path node** → mirror
   filter regression (@8017/@8059, mig042).

### 6.3 RECONCILIATION — pending Session A snapshots
> Session A had **not** yet written `/.telemetry/nick-flow-snapshots/` at audit time.
> **TODO:** once present, load each snapshot and fill an EXPECTED|ACTUAL|Δ table per §6.1.
> The divergence checklist §6.2 is the diff harness. (Left as a stub deliberately — see
> §8 P0 item to run this reconciliation.)

---

## 7. NEW BUGS C1 / C2 / C3
Full root-cause in **`new-bugs-c1-c3.md`**. One-line each:
- 🟥 **C1** — «Применить» sets `nmCustomRange` + client re-render only; never re-fetches
  and crops deduped nodes by single `last_seen_at`, so a today-anchored window drops
  nothing. Node *count* is chain-scoped but node *visibility* is `last_seen_at`-scoped →
  "picker does nothing." Fix: crop by in-range chain membership (or send from/to to
  `/v3/graph`).
- 🟥 **C2** — Meds master toggles call `setTintOpacity` over `_focusBoosted` (only the
  current drug's tinted meshes), not `toggleLayer` (whole GLB group like Anatomy) → only
  work on layers the current drug tinted; async-timer tint passes make it drug-dependent.
  Fix: use `toggleLayer`.
- 🟥 **C3** — the stray cyan net is the `skin` layer wireframe (`body-atlas.js:458`).
  Medications' `tintRegions` does `toggleLayer('skin',true)` for skin-targeting drugs via
  `MED_SEED.skin`; its wireframe-hide pass sits AFTER the `matchCount===0` early return
  (`body-atlas.js:1549`) so skin-only drugs never hide it, and `_clearFocusState` restores
  it → random flicker. Anatomy excludes skin (`_applyLayerConfig`), Medications is the only
  tab that re-enables it — exactly the "removed in Anatomy, stayed in Medications"
  asymmetry. Fix: move wireframe-hide above the early return AND drop `skin` from
  `MED_SEED`/`need`.

---

## 8. PRIORITY LIST — REAL bugs to fix (by fixability × impact)

| # | Sev | Bug | Fix effort | Where |
|---|---|---|---|---|
| **P0** | 🟥 High | **C1 date-range filter** — user-facing, "clearly broken," small localized fix | S | `account.html:8708` `nmApplyDateRange` + `nmLoadV2Graph` / `buildNmGraph:10051` |
| **P0** | 🟥 High | **C3 stray skin wireframe in Meds** — visible glitch, exact 2-line fix known | S | `body-atlas.js:1549/1551` move hide above early-return; drop `MED_SEED.skin` `account.html:18373` |
| **P1** | 🟥 Med | **C2 Meds master toggles** — swap `setTintOpacity`→`toggleLayer(group,on)`; re-assert after tint passes | M | `account.html:18472-18490` |
| **P1** | 🟧 Med | **journey-event delete misses `nm_node_ids[]` array shape** (§4.2) → user-deleted array-events orphan their nodes until an admin sweep | S | `server.js:8355-8364` add array branch mirroring `nm-node/:id/delete` @8309 |
| **P2** | 🟧 Med | **No transactions on any save handler** (§top) → partial writes on mid-sequence failure (nm_nodes w/o chain, etc.) | L | wrap `/sensation` @5820 & `/v2/append` @3285 in `sql.begin`/neon txn |
| **P2** | 🟧 Low | **Partial-array Path ghost** never auto-swept (§5.1) — deleted node inside a still-live multi-node array event keeps drawing a step. Intentional today; document or add a "prune dead members from array" migration | M | mig052 predicate `server.js:2346` |
| **P3** | 🟧 Low | **`/v3/graph` range map only day/week/month** — `year`/`3months` silently return full history (`server.js:3524`). Moot until C1 sends params, but fix alongside | S | `server.js:3527` days map |
| **P3** | 🟧 Low | **`/me/diet/event` dependent_id not owner-validated** (`parseInt`, no `resolveDependentId`, §1.4) | S | `server.js:10322` |
| **P3** | 🟩 Info | **mig038 buggy array-cast** already superseded by 039 — leave as historical; do NOT re-run 038 | — | `server.js:1598` |

**Recommended fix order:** C1 → C3 → C2 (all user-visible, small/med, isolated) →
journey-event array delete → transactions. C1+C3 are the highest impact-per-effort.
