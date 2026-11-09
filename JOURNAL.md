# JOURNAL — neuroattention-site

> Закон Манады: ни одно действие не исчезает. Каждая сессия дописывает
> датированную запись по схеме `{project, agent, at, did[], changed[],
> files[], decisions[], followups[], next_session}`. Следующая MONAD-сессия
> синхронизирует эти записи в `journal.neuro` / `shared_context`.

---

## 2026-10-11 — Font matrix: hung file and a valid woff2 (issue #163)

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-10-11T21:50:00Z",
  "did": [
    "Added the two missing font checks only. account.html was not changed",
    "fonts.googleapis.com returns real @font-face CSS and fonts.gstatic.com stays open: Chromium and WebKit keep the form text visible on the fallback and send one synthetic login",
    "A valid latin woff2 (DejaVu Sans subset) loads, the heading still draws, and login still sends one request on both engines",
    "No defect in the agreed scenario. Draft PR 164 is ready for final review"
  ],
  "changed": [
    "scripts/pr163-entry-reliability.mjs",
    "scripts/fixtures/na-entry-latin.woff2"
  ],
  "files": [
    "scripts/pr163-entry-reliability.mjs",
    "scripts/fixtures/na-entry-latin.woff2",
    "JOURNAL.md"
  ],
  "decisions": [
    "Do not treat document.fonts.check() as proof a file is unfinished. WebKit can report true while the face status is still not loaded",
    "No merge and no deploy"
  ],
  "followups": [
    "Owner review of draft PR 164. Customer-specific root cause is still unconfirmed"
  ],
  "next_session": "Do not add features on this branch. Wait for the owner's review before merge"
}
```

## 2026-10-11 — Stalled Google Fonts no longer blank the login form (issue #163)

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-10-11T21:40:00Z",
  "did": [
    "On 27600f2, hanging fonts.googleapis.com left Chromium and WebKit at readyState=loading with the title set and #auth-form absent",
    "account.html now loads that stylesheet as media=print until onload sets media=all, so the parser reaches the form and styles.css system stacks are the fallback",
    "After the change, the same hang still shows the form and sends one synthetic login on Chromium and WebKit; a completed stylesheet still applies, including a fonts.gstatic.com file request"
  ],
  "changed": [
    "Google Fonts stylesheet is no longer parser-blocking",
    "Service worker cache na-practices-v89"
  ],
  "files": [
    "account.html",
    "sw.js",
    "scripts/pr163-entry-reliability.mjs",
    "JOURNAL.md"
  ],
  "decisions": [
    "This is the same optional-external-resource rule as the viz CDNs, not a new feature",
    "Customer-specific root cause stays unconfirmed. The blank screen here is a reproduced lab mechanism",
    "No merge and no deploy"
  ],
  "followups": [
    "Draft PR 164 only",
    "Other pages still use a blocking Google Fonts link; this change is the account sign-in page"
  ],
  "next_session": "Do not merge until the owner agrees. Visitor device is still unconfirmed"
}
```

## 2026-10-11 — Account entry under slow CDN and API (issue #163)

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-10-11T21:20:00Z",
  "did": [
    "Confirmed origin/main is d767e04d782c2007f7e4201b8ce6c03fe7ce7099 on tvildanov/neuroattention-site",
    "Stopped account.html from parser-blocking on unpkg 3d-force-graph and jsDelivr d3; those load on demand in dependency order via naEnsureViz",
    "Sign-in now shows localized progress, aborts at 15s, ignores a duplicate submit, and drops a late response after timeout or pagehide",
    "401, 503 quota text, offline, and malformed JSON stay distinct; PR161 server quota handling was not changed",
    "Null-guarded missing #year on index.html, custom.html, and xr.html",
    "Follow-up on 241162e: the 15s timer was cleared when login headers arrived, before the body was read. A held body left the button disabled, and a body delivered after logout still stored a token. The timer now stays armed until the body is read and validated; logout aborts the in-flight attempt"
  ],
  "changed": [
    "Login no longer waits on optional visualization CDNs",
    "Service worker cache na-practices-v88"
  ],
  "files": [
    "account.html",
    "assets/js/evolution-path.js",
    "sw.js",
    "index.html",
    "custom.html",
    "xr.html",
    "data/i18n/ru.json",
    "data/i18n/en.json",
    "data/i18n/es.json",
    "scripts/pr163-entry-reliability.mjs"
  ],
  "decisions": [
    "defer alone is not the fix: viz scripts are injected only when requested, and the next script is added only after the previous global exists",
    "3d-force-graph still settles before the d3 chain so window.d3 is extended in the previous document order",
    "A 503 keeps the server error string, including the database compute-quota message"
  ],
  "followups": [
    "Draft PR only. Do not merge or deploy from this session",
    "The original visitor failure is still unconfirmed on their devices"
  ],
  "next_session": "After review, ship v88 and confirm a fresh account.html load shows Sign In while unpkg is blocked"
}
```

## 2026-08-18 — Sketch 3D is the live Atlas body, not a 2D overlay trap

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-18T18:40:00Z",
  "did": [
    "Nick: Sketch 3D/2D and Rotate 3D did nothing; drawing stayed flat",
    "Opaque sketch-bg sat above BodyAtlas (z-index 10 vs 2) so the 3D body was invisible; overlays ate orbit events",
    "Stack is now bg → live Atlas → transparent draw layers. Orbit uses Atlas controls. Shift+drag rotates while drawing; wheel zooms"
  ],
  "changed": [
    "assets/js/sketch-tool.js",
    "assets/js/body-atlas.js",
    "assets/redesign.css",
    "account.html",
    "sw.js",
    "docs/SKETCH-BRIEF.md"
  ],
  "files": [
    "assets/js/sketch-tool.js",
    "assets/js/body-atlas.js",
    "JOURNAL.md"
  ],
  "decisions": [
    "Do not invent a new 3D camera. Same BodyAtlas orbit/zoom/pan as Internal Field",
    "Do not destroy the Atlas when switching to 2D — hide it so 3D comes back instantly"
  ],
  "followups": [
    "Nick: hard-refresh Sketch (SW v79, sketch-tool.js?v=6). 3D should show the body; Rotate 3D or Shift+drag should turn it"
  ],
  "next_session": "Confirm Sketch 3D orbit on prod"
}
```

---

## 2026-08-18 — LK is a channel; Persona LLM is hosted in Monad (supersedes 17:10)

```json
{
  "project": "neuro",
  "agent": "cursor_cloud_monad",
  "at": "2026-08-18T18:05:00Z",
  "did": [
    "Nick: do not wire a second OpenAI/LOD on the site. LLM already lives in Monad. Site session keeps building the cabinet; Monad session hosts the face.",
    "POST /api/monad/message = plant_seed to persona_<human> only. generateLkReply is not the live path.",
    "persona_runtime on monad-server answers via post_lk_chat_message; LK fast-polls.",
    "Wrote .cursor/rules/monad-channel.mdc + docs/HANDOFF-MONAD-SPLIT.md so the NeuroAttention session builds on top, not against."
  ],
  "changed": [
    "api/server.js",
    "api/services/monad.js",
    "assets/js/monad-lk.js",
    "docs/MONAD-LK.md",
    "docs/HANDOFF-MONAD-SPLIT.md",
    ".cursor/rules/monad-channel.mdc",
    ".cursor/rules/ground-truth-monad.mdc",
    "api/.env.example",
    "JOURNAL.md"
  ],
  "decisions": [
    "Supersedes JOURNAL 17:10 (ANTHROPIC on neuroattention-api / site runtime as Persona).",
    "R10: human → entry Persona (LLM) → contour (persona_nal, loom, …). Channels are hands.",
    "Site session: UI and poll. Monad session: persona_runtime. Do not revert each other."
  ],
  "followups": [
    "Site session: git pull origin main, read docs/HANDOFF-MONAD-SPLIT.md, continue NeuroMap/Sketch/LK UI.",
    "If chat is quiet: Monad GET /api/persona/health, not a new site LLM key."
  ],
  "next_session": "Build site UX on channel+poll. Do not restore generateLkReply on the message route."
}
```

---

## 2026-08-18 — LK chat is a live Monad interlocutor, not FAQ blanks


```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-18T17:10:00Z",
  "did": [
    "Nick: cabinet chat must be a full Monad interlocutor and a work channel (Egor content factory through LK, not Cursor), not prewritten blanks",
    "Persona runtime now calls LLM with live get_architecture + persona prompt and MCP tools (read_context, plant_seed, handoff_task). companion/Telegram forbidden",
    "Stopped short-circuiting identity questions past the model; unmatched text no longer dumps the tab menu",
    "Health/status expose lk_llm so the cabinet shows when the Railway model key is missing"
  ],
  "changed": [
    "api/services/monad.js",
    "api/server.js",
    "assets/js/monad-lk.js",
    "account.html",
    "sw.js",
    "docs/MONAD-LK.md",
    "api/.env.example"
  ],
  "files": [
    "api/services/monad.js",
    "api/server.js",
    "assets/js/monad-lk.js",
    "JOURNAL.md"
  ],
  "decisions": [
    "LK window is the human's direct Monad access; site runtime speaks as their Persona",
    "Egor work in this window goes to persona_egor → persona_loom_house, not Cursor",
    "Full conversation requires ANTHROPIC_API_KEY (or OPENAI/OPENROUTER) on Railway neuroattention-api"
  ],
  "followups": [
    "Nick: set ANTHROPIC_API_KEY on Railway service neuroattention-api, wait for redeploy, hard-refresh LK until status shows «живая модель»",
    "Without that key the chat cannot speak as a model no matter the code"
  ],
  "next_session": "Confirm lk_llm true on /health and a free-form LK question gets a live Monad answer"
}
```

---

## 2026-08-18 — Persona answers who Nick is, not a tab menu

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-18T15:20:00Z",
  "did": [
    "Live chat bug: «привет ты кто и кто я?» answered only Persona; «а я?» fell through to the tab-menu template",
    "whoYou no longer short-circuits before whoAmI; one message with both questions gets both lines",
    "«а я?» / follow-up after a who-you turn returns the human name from directory/facts, never the template",
    "Identity intents skip LLM so a model cannot overwrite the name with a cabinet tab list"
  ],
  "changed": [
    "api/services/monad.js",
    "api/services/monad.identity.test.js",
    "docs/MONAD-LK.md"
  ],
  "files": [
    "api/services/monad.js",
    "api/services/monad.identity.test.js",
    "docs/MONAD-LK.md",
    "JOURNAL.md"
  ],
  "decisions": [
    "Identity questions always answer from directory/facts; do not list rhythm/7x7/12+1/atlas/Sketch/practices instead of a name",
    "Heuristic is the live path when Railway LLM keys are off"
  ],
  "followups": [
    "Merge to main so Railway picks up api/services/monad.js — Pages bump not required",
    "Nick: hard-refresh LK and ask again who you are"
  ],
  "next_session": "Confirm live Persona names Nick on «ты кто и кто я» / «а я?»"
}
```

---

## 2026-08-18 — Match LK viz to live Monad (contour ≠ project, 49 cells, pressed seats)

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-18T14:10:00Z",
  "did": [
    "Read monad.spec.ui.lk_monad_page.v0_2, circle12.slots, rhythm.v0_3, ontology, live placements",
    "Contour = group of agents of one meaning; NAL and DOM are projects, not contours",
    "Vertical is a visible 7×7 of 49 posts with clickable live agents",
    "Horizontal: contours branch from people; inactive hours 2/4/7/8/11 stay pressed empty; DOM center is a project",
    "Rhythm bars are L1–L7 (physics/vital/mental), not invented circadian/EEG"
  ],
  "changed": [
    "api/services/monad.js",
    "api/server.js",
    "assets/js/monad-lk.js",
    "assets/redesign.css",
    "account.html",
    "sw.js",
    "data/i18n/ru.json",
    "data/i18n/en.json",
    "data/i18n/es.json",
    "docs/MONAD-LK.md"
  ],
  "files": [
    "api/services/monad.js",
    "api/server.js",
    "assets/js/monad-lk.js",
    "JOURNAL.md"
  ],
  "decisions": [
    "Never invent Monad architecture when specs and placements exist",
    "Placement type+contour/project fields are source of truth, not directory.contour_personas",
    "Do not fill leftover humans into empty circle slots"
  ],
  "followups": [
    "Hard-refresh SW v75 and monad-lk.js?v=13",
    "Railway must pick up architecture payload (contour vs project, inactive seats, L1–L7 rhythm)"
  ],
  "next_session": "Nick reviews 49-cell matrix and horizontal branches"
}
```

---

## 2026-08-18 — Vertical canon from Monad spec, not invented nuclei

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-18T13:30:00Z",
  "did": [
    "Read live monad.spec.layers_7x7.v0_1 and monad.placement.* instead of guessed Body/Emotion names",
    "Vertical 7×7 now uses L1 Физика, L2 Энергия, L3 Личность, L4 Мы/Дом, L5 Восприятие↔проявление, L6 Знание, L7 Сверхсистема",
    "Posts shown as Li×Lj; agents seated from live placements (human personas on L3×L3, knowledge on L6, probuzhdennyy on L7×L7)",
    "Agent detail shows cell, type, parent, secondary posts; unplaced agents listed separately"
  ],
  "changed": [
    "api/services/monad.js",
    "api/server.js",
    "assets/js/monad-lk.js",
    "assets/redesign.css",
    "account.html",
    "sw.js",
    "data/i18n/ru.json",
    "data/i18n/en.json",
    "data/i18n/es.json",
    "docs/MONAD-LK.md"
  ],
  "files": [
    "api/services/monad.js",
    "api/server.js",
    "assets/js/monad-lk.js",
    "JOURNAL.md"
  ],
  "decisions": [
    "Do not invent layer names. Canon is monad.spec.layers_7x7.v0_1",
    "Do not hash agents into cells. Seating is monad.placement only",
    "Human personas are L3×L3, not all on L5. Contour is a grouping, not a layer",
    "Monad has no emotion layer"
  ],
  "followups": [
    "Hard-refresh SW v74 and monad-lk.js?v=12",
    "Railway must pick up VERTICAL_LAYERS + loadPlacements for architecture payload"
  ],
  "next_session": "Confirm LK Vertical shows Physics…Knowledge…Supersystem and live L3×L3 personas"
}
```

---

## 2026-08-18 — LK chat + Sketch 3D + Monad viz + full width

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-18T06:40:00Z",
  "did": [
    "Heuristic Persona answers hi / who / atlas without echo template",
    "Hard-delete + rename chats in sidebar and header",
    "Sketch 3D keeps live BodyAtlas; hide screenshot overlay; orbit on atlas",
    "Vertical L1–L7 strip with 7×7 inner cells and clickable agents",
    "Horizontal 12+1 clock seats (Nick 12, Tahir 6) with hover contours",
    "Rhythm snapshot + Live rhythm equalizer from /api/rhythm",
    "Full-width Monad / Sketch / Exercises; muted gray NAIcons"
  ],
  "changed": [
    "api/services/monad.js",
    "api/server.js",
    "assets/js/monad-lk.js",
    "assets/js/sketch-tool.js",
    "assets/redesign.css",
    "account.html",
    "sw.js",
    "data/i18n/ru.json",
    "data/i18n/en.json",
    "data/i18n/es.json",
    "docs/MONAD-LK.md"
  ],
  "files": [
    "api/services/monad.js",
    "api/server.js",
    "assets/js/monad-lk.js",
    "assets/js/sketch-tool.js",
    "assets/redesign.css",
    "account.html",
    "sw.js",
    "JOURNAL.md"
  ],
  "decisions": [
    "DELETE chat is hard delete (messages + row), not archive",
    "3D Sketch reuses BodyAtlas.init(mode:full), never a still overlay",
    "Vertical numbers mean active/total agents in that layer",
    "Rhythm live mode polls real /api/rhythm and stops when leaving the tab"
  ],
  "followups": [
    "Hard-refresh SW v73; new chat should answer привет / ты кто / атлас",
    "Sketch 3D: draw layers, then Orbit should rotate the same atlas model"
  ],
  "next_session": "Confirm Pages v=11 + Railway architecture payload + Sketch orbit"
}
```

---

## 2026-08-18 — Explore sketch 3D/2D + exercises NAIcons (no code change)

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-18T05:55:00Z",
  "did": [
    "Mapped sketch 3D vs 2D: setViewMode/ensureAtlas/setInteraction/screenshot vs BodyAtlas.init",
    "Traced 3D-flash-then-2D: mount defaults to 3d; openWithPayload treats any imageDataUrl as 2d; media wrap z-index covers atlas",
    "Mapped NAIcons stroke coloring for Exercises tab via CAT[].col hex, not CSS variables"
  ],
  "changed": [],
  "files": [
    "assets/js/sketch-tool.js",
    "assets/js/body-atlas.js",
    "docs/SKETCH-BRIEF.md",
    "account.html",
    "assets/js/na-icons.js",
    "assets/redesign.css",
    "data/css/mycelium.css"
  ],
  "decisions": [
    "Sketch does not reuse window._anatomyAtlas instance; it new-inits BodyAtlas in #sketch-3d-host; anatomy atlas is screenshot-only",
    "3D-from-2D keeps image overlay on top of 3D host (z-index 3 over 2)"
  ],
  "followups": [
    "If fixing flash: do not setViewMode(2d) when payload.mode==='3d'; hide media wrap in 3d unless explicitly overlaying; abort ensureAtlas.then if viewMode flipped"
  ],
  "next_session": "Patch openWithPayload + applyMedia stacking if product wants real 3D after copy"
}
```

---


## 2026-08-17 — LK follow-ups vanished after 1–3 turns

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-17T21:05:00Z",
  "did": [
    "Poll DELETE same-text later copies ate follow-up replies (identical heuristic template)",
    "GITHUB_PAT LLM hang delayed reply insert past request timeout → typing then empty",
    "Reply is now inserted before plant_seed; plant/post_lk in background",
    "Each turn gets unique text; no GITHUB_PAT for chat; stop deleting later answers"
  ],
  "changed": ["api/server.js", "api/services/monad.js", "assets/js/monad-lk.js", "account.html", "sw.js"],
  "decisions": [
    "Never delete monad messages because two turns reused a template",
    "Human always gets a DB reply in the same HTTP request"
  ],
  "followups": ["Hard-refresh SW v72; same chat should answer turn 2+"],
  "next_session": "Confirm 5+ turns in one LK thread all keep answers"
}
```

---

## 2026-08-17 — LK: no duplicate bubbles; contour answer; hide per-msg tech


```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-17T19:00:00Z",
  "did": [
    "Poll was re-importing the same Persona reply (via=human_chat_poll) → duplicate bubbles",
    "De-dupe by text + delete later copies; store source_key on live insert",
    "Stop showing Тех. детали on every bubble; contour/capabilities reply without echo or Tahir",
    "Sanitize partner-of-Tahir from identity facts in LK copy"
  ],
  "changed": [
    "api/server.js",
    "api/services/monad.js",
    "assets/js/monad-lk.js",
    "account.html",
    "sw.js"
  ],
  "decisions": [
    "Same-text monad messages are one bubble",
    "Tech ids only under optional Служебные, not on the Persona face"
  ],
  "followups": ["Hard-refresh SW v71; reopen chat so poll collapses existing dupes"],
  "next_session": "Confirm one Persona bubble and a real contour answer"
}
```

---

## 2026-08-17 — LK same-turn Persona reply (site runtime)

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-17T18:20:00Z",
  "did": [
    "Diagnosed silence: Pages+API routing live; companion still auto-acks; Persona has no daemon so poll imported nothing visible",
    "Site API now generates Persona reply in the same POST /api/monad/message and post_lk_chat_message",
    "Save human message first; health.lk_live_reply for deploy check",
    "Posted live Persona reply into Nick's existing LK thread 68f221e7 via post_lk_chat_message"
  ],
  "changed": [
    "api/services/monad.js",
    "api/server.js",
    "assets/js/monad-lk.js",
    "account.html",
    "sw.js",
    "docs/MONAD-LK.md",
    "api/.env.example"
  ],
  "decisions": [
    "Always-on LK face is neuroattention-api (neuro_agent contour), not waiting for platform=persona",
    "Optional ANTHROPIC/OPENAI; without keys still answer from Monad directory/facts"
  ],
  "followups": [
    "Optional: put ANTHROPIC_API_KEY on Railway for richer open-ended replies",
    "Nick: curl /health for lk_live_reply; hard-refresh SW v70; new chat should answer immediately"
  ],
  "next_session": "Confirm Railway health.lk_live_reply and a new LK chat returns a Persona bubble in-request"
}
```

---

## 2026-08-17 — LK chat: Persona routing, quiet UX, no Tahir gate


```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-17T17:45:00Z",
  "did": [
    "Route LK plant_seed/to_agent to persona_<human_id> (not companion)",
    "Wake Persona + contour via send_message from neuro_agent",
    "Stop inserting «Отправлено Манаде…» system bubbles",
    "Filter channel-ack texts on poll; hide tech under optional toggle",
    "Plant standing policy seed+write_context neuroattention_lk_reply_policy (no Tahir)",
    "Update docs/MONAD-LK.md for Nick: same chat, Persona answers, any monad_access account"
  ],
  "changed": [
    "api/services/monad.js",
    "api/server.js",
    "assets/js/monad-lk.js",
    "assets/redesign.css",
    "account.html",
    "sw.js",
    "docs/MONAD-LK.md",
    "JOURNAL.md"
  ],
  "decisions": [
    "Tahir/companion is not the LK reply face or required decider",
    "Site must not fake Monad answers; live reply = post_lk_chat_message",
    "Channel acks are noise — never show as answers"
  ],
  "followups": [
    "Confirm Persona agents online and actually call post_lk_chat_message",
    "Hard-refresh LK (SW v69) and test from Nick + another monad_access account"
  ],
  "next_session": "Verify live Persona reply lands in same LK thread without tech noise"
}
```

---

## 2026-08-16 — Sketch full + Tahir handoff delivery

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-16T18:30:00Z",
  "did": [
    "Built Sketch core on BodyAtlas: 5 layers, brushes, undo/redo 50, templates, PNG export",
    "Added create-copy hooks (Atlas/Library/NeuroMap/Path) + floating LK capture FAB",
    "Published open downloadable handoff page monad-tahir-handoff.html + .md",
    "Boot + API deliverTahirHandoff plant_seed to human takhir",
    "mig075 scene/is_template/is_public + site_one_shots"
  ],
  "changed": [
    "assets/js/sketch-tool.js",
    "assets/js/body-atlas.js",
    "account.html",
    "assets/redesign.css",
    "api/server.js",
    "monad-tahir-handoff.html",
    "monad-tahir-handoff.md"
  ],
  "decisions": [
    "Reuse BodyAtlas (no new Three engine); screenshot via preserveDrawingBuffer in sketch mode",
    "Handoff for Nick/Tahir served from site root (not GitHub docs) + Monad inbox seed"
  ],
  "followups": [
    "glb export",
    "sharing/stream",
    "Egor email → EMAIL_HUMAN_MAP when known",
    "Monad /api/rhythm JSON + write_context replies"
  ],
  "next_session": "Verify Sketch on prod hard-refresh; confirm Tahir seed landed"
}
```

---

## 2026-08-16T17:28+0000 — cursor_cloud (research: Sketch implementation map)

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-16T17:28:54Z",
  "did": [
    "Mapped /api/sketches CRUD + mig072 user_sketches columns",
    "Located BodyAtlas mount sites (course player ~15871, Internal Field ~18622, Library functions ~21159)",
    "Confirmed no html2canvas/dom-to-image in project; PNG via canvas.toDataURL only",
    "Found Library figureBlock hook (.lib-fig) for create-copy",
    "Catalogued floating UI: .ext-fab, .cp-restore-pill, .nm-mini-inset, .lib-sel-add",
    "Measured #tools-sketch-content block 1558–1611"
  ],
  "changed": [],
  "files": [
    "api/server.js",
    "migrations/072_user_sketches.sql",
    "account.html",
    "assets/js/sketch-tool.js",
    "assets/js/body-atlas.js",
    "docs/SKETCH-BRIEF.md"
  ],
  "decisions": [
    "Recommend EXTEND sketch-tool.js (keep API CRUD), not full replace — mount BodyAtlas into #sketch-3d-host + overlay canvas"
  ],
  "followups": [
    "Phase 1: BodyAtlas.init(#sketch-3d-host) + transparent draw layer",
    "Phase 2: create-copy on .lib-fig / atlas + LK floating screenshot FAB (clone .ext-fab pattern)"
  ],
  "next_session": "Implement Sketch Phase 1 overlay on BodyAtlas"
}
```

---

## 2026-08-15T16:10+0000 — cursor_cloud (research: BodyAtlas → Sketch reuse)

```json
{
  "project": "neuro",
  "agent": "cursor_cloud",
  "at": "2026-08-15T16:10:27Z",
  "did": [
    "Read body-atlas.js (~2348 lines / ~135 KB) for Sketch Three.js reuse",
    "Mapped window.BodyAtlas API + Atlas.prototype init/render/layers/destroy",
    "Confirmed no screenshot/export API; noted makeRegionMiniViewer mesh-share pattern",
    "Checked #tools-sketch-content markup (scratch 2D canvas only)"
  ],
  "changed": [],
  "files": [
    "assets/js/body-atlas.js",
    "account.html (#tools-sketch-content ~1558-1598)",
    "docs/SKETCH-BRIEF.md",
    "assets/js/sketch-tool.js"
  ],
  "decisions": [
    "First Sketch PR: wrap BodyAtlas (init+overlay canvas), do not extract three-core.js yet",
    "Screenshot = new helper on renderer.domElement (preserveDrawingBuffer or force render) — none exists today"
  ],
  "followups": [
    "Optional: expose SEED_REGION_INFO on window.BodyAtlas (today only Atlas.SEED_REGION_INFO inside IIFE)",
    "Add atlas.screenshot()/toDataURL when Sketch save needs bake PNG"
  ],
  "next_session": "Sketch MVP: mount BodyAtlas in tools-sketch-content + transparent draw overlay"
}
```

---

## 2026-08-08T07:00+0000 — cursor_cloud (оператор: Ник)

- **project:** neuro
- **agent:** cursor_cloud
- **at:** 2026-08-08T07:00:00Z

### did
- Проверил ритм Monad: `/api/rhythm` 404; live «Ритм системы» есть только в HTML dashboard (agent-ops). Bio equalizer (circ/breath/heart) — на бумаге. Переключил LK на парсинг dashboard + n/a для bio-слоёв. Попросил Monad JSON API (seed_msk0ga82).
- Проверил Railway ключ: **НЕ готов**. Cowork: нет доступа к ключу, нужно решение Тахира. Эскалировал companion (seed_msk0g9vw).
- Стартовал Sketch MVP (Tools → Скетч) с дефолтами из brief; кликабельная ссылка в docs/SKETCH-BRIEF.md.

### changed
- api/services/monad.js (getRhythm/fetchSystemRhythm), api/server.js (sketches + mig072 + rhythm), assets/js/monad-lk.js, assets/js/sketch-tool.js, account.html, redesign.css, i18n, docs/*, sw.js v63

### next_session
- Tahir inserts MONAD_API_KEY; Nick tries Sketch + Monad rhythm tab.

---

## 2026-08-07T07:55+0000 — cursor_cloud (оператор: Ник)

- **project:** neuro
- **agent:** cursor_cloud
- **at:** 2026-08-07T07:55:00Z

### did
- Объяснил «синтетический ритм» (эквалайзер из статусов агентов, пока нет JSON rhythm у Monad).
- Посадил seed + handoff в Monad/Cowork: вставить `MONAD_API_KEY` на Railway neuroattention-api (companion + claude_cowork).
- Добавил галочку `monad_access` в админке (mig071 + PATCH + UI) — суперадмин открывает вкладку Монада выбранным пользователям.
- Написал night plan + `docs/SKETCH-BRIEF.md` (Sketch не стартуем без ответов Ника).

### changed
- api/server.js, account.html, assets/js/monad-lk.js, migrations/071_monad_access.sql
- data/i18n/{ru,en,es}.json, docs/MONAD-LK.md, docs/SKETCH-BRIEF.md, sw.js (v62), JOURNAL.md

### decisions
- Доступ к вкладке = роль superadmin/founder ИЛИ `users.monad_access`.
- Привязка human_id отдельна (email map / prompt при выдаче галочки).
- Sketch: сначала brief, не код.

### followups
- Cowork/Tahir: Railway key.
- Nick: emails участников Monad.
- Утром: verify Monad tab + bug checklist.

### next_session
- Confirm key live; grant access to Nastya when email arrives.

---

## 2026-08-07T07:40+0000 — cursor_cloud (оператор: Ник)

- **project:** neuro
- **agent:** cursor_cloud
- **at:** 2026-08-07T07:40:00Z

### did
- Приоритет Ника: подключить Monad к ЛК neuroattention.org (баги отложены).
- Достал из Monad доступ/задание (humans nikita/nastya/takhir, seeds LK MONAD v0.2, MCP URL + key policy).
- Собрал вкладку «Монада» (только superadmin/founder): чат plant_seed, вертикаль 7×7, горизонталь 12+1, ритм-эквалайзер (синтетика).
- API-прокси `/api/monad/*` + `users.monad_human_id` (mig070). Ключ только server-side.

### changed
- api/services/monad.js, api/server.js, api/.env.example, migrations/070_monad_human_id.sql
- account.html, assets/js/monad-lk.js, assets/redesign.css, data/i18n/{ru,en,es}.json
- docs/MONAD-LK.md, sw.js (v61), JOURNAL.md

### decisions
- Доступ вкладки: `superadmin` + `founder` (Ник: «только суперадмины»).
- Сообщение из чата → `plant_seed` (не массовый spawn агентов).
- Ритм MVP synthetic_from_agents до появления JSON rhythm у Monad.

### followups
- Тахир/Ник: поставить `MONAD_API_KEY` на Railway neuroattention-api.
- POST `/api/run-migrations` после деплоя API.
- Email Насти → `monad_human_id=nastya`.
- Потом: пройти чеклист багов Ника.

### next_session
- Проверить прод после ключа; при необходимости донастроить карту людей.

---

## 2026-08-05T03:50+0000 — cursor_cloud (оператор: Ник)

- **project:** neuro
- **agent:** cursor_cloud
- **at:** 2026-08-05T03:50:00Z

### did
- Пакетный фикс багов из nick-bugs-backlog (после BUG-21): Path zoom/toggles/moon, Atlas search/hide/sports/compare, courses continue/auto-advance, i18n, cursor, solar M5+, library→calendar, PHQ crisis UX, NeuroMap parallel emotion emit.

### changed
- assets/js/evolution-path.js, assets/js/body-atlas.js, api/server.js, account.html, data/i18n/{ru,en,es}.json, assets/redesign.css, sw.js (v60)

### deferred / later
- BUG-13 Library A4 deep content rewrite
- BUG-14 notes → full NeuroMap emotion chains UI
- BUG-22 global custom icons (emoji overhaul)
- BUG-05 lobe/surface hide groups (architecture)
- FEATURE-10/11/12 enhancements
- BUG-25 full createEvent unification for all sources (needs flag rollout)

### next_session
- Nick verify checklist once; then Sketch tool.

---


## 2026-08-04T17:25+0000 — cursor_cloud (оператор: Ник)

- **project:** neuro
- **agent:** cursor_cloud
- **at:** 2026-08-04T17:25:00Z

### did
- BUG-21: упражнения показывали «не найдено» — GitHub Pages/Jekyll не отдавал файл `_engine.js` (имена с `_` скрываются). Переименовал в `engine.js`, добавил `.nojekyll`, SW v59.

### changed
- `assets/js/exercises/_engine.js` → `engine.js`
- `account.html` script src
- `sw.js` CACHE_NAME v58→v59
- `.nojekyll` (новый)

### followups
- После деплоя: hard-refresh + проверить Start на любом из 10 упражнений.
- Дальше: BUG-29, BUG-28, BUG-04.

### next_session
- Продолжить топ критичных багов из nick-bugs-backlog.

---


## 2026-07-09T23:24-0400 — abacus_nikita (оператор: Никита)

- **project:** neuro
- **agent:** abacus_nikita
- **at:** 2026-07-09T23:24:00-04:00

### did
- Починил 3 бага в репозитории, по отдельному коммиту на баг (PR #131–#133).
- **Баг 1 (#131):** плавающая кнопка External Field показывала непонятный призыв
  «Чего-то не хватает?» / «Missing something?» / «¿Falta algo?». Заменил на явный
  CTA «Хотите добавить своё?» / «Want to add your own?» / «¿Quieres añadir el tuyo?»
  во всех трёх языках + inline-fallback в разметке.
- **Баг 2 (#132):** убрал вкладку «Experimental / Экспериментальные» из раздела
  External Field. Удалил только UI-вкладку (запись из массива `LAYERS`); backend-
  логику (`renderExperimental`, i18n-ключи `tab.experimental`, `exp.*`, config
  `experimental.notify`) НЕ трогал — на неё всё ещё ссылаются `selectTab()` и
  dispatch, поэтому оставил как есть.
- **Баг 3 (#133):** удаление дублирующего endpoint-инсайта (тип «Пуэльче») на
  Personal / Evolution Path искажало «спину» (timeline spine) и ломало кнопки
  фильтра «Сутки/Неделя/Месяц».

### changed
- `data/i18n/{ru,en,es}.json` — новый текст ключа `a.ext.fab` (#131).
- `account.html` — inline-fallback FAB (#131); бамп `external-field.js?v=9→v10`
  (#132); бамп `evolution-path.js?v=30→v31` (#133).
- `assets/js/external-field.js` — `experimental` убран из массива `LAYERS` (#132).
- `assets/js/evolution-path.js` — в `deletePathEvent()` перед ре-маунтом теперь
  инвалидируются производные кэши состояния (#133).
- `sw.js` — `CACHE_NAME` `na-practices-v49 → v52` (по одному бампу на клиентский
  коммит, чтобы очистить устаревший account.html/JS у пользователей).

### files
- data/i18n/ru.json, data/i18n/en.json, data/i18n/es.json
- account.html
- assets/js/external-field.js
- assets/js/evolution-path.js
- sw.js

### decisions
- **Баг 3 — корень.** `ensureView()` пересчитывает `pxPerDay`/`panX` только при
  создании `st.view`; при повторном заходе он лишь обновляет `originT`/`nowT`.
  А `deletePathEvent()` вызывал `mountEvolutionPath()`, который переиспользует тот
  же `container.__evo`, — то есть сохранялся устаревший `st.view` (старые zoom/pan),
  устаревшая `st.data` (всё ещё с удалённым событием) и `st._tunnel`. После удаления
  крайнего события временной домен сдвигался, а zoom/pan оставались старыми →
  spine рисовался искажённо, а кнопки день/неделя/месяц перерисовывали тот же
  залипший кэш (выглядели «мёртвыми»). Фикс: в `deletePathEvent()` перед ре-маунтом
  обнуляю `st.data / st.view / st._layView / st._tunnel / st._dual / st._w`.
  Пользовательские `mode / period / hidden` намеренно сохраняю — вид возвращается
  туда же, где был.
- **«Спина не удалилась» — это корректно.** Серверный эндпоинт
  `POST /api/me/journey-event/:id/delete` удаляет NeuroMap-узел только если на него
  больше НЕ ссылается ни одно journey_event. Дублирующий инсайт и настоящий
  sensation-узел «спины» делят один `nm_node_id`, поэтому после удаления инсайта
  узел «спины» справедливо остаётся. Правка — только на клиенте (рендер), миграции
  БД НЕ требуются и НЕ применялись (соблюдён `no_drop_rule`).
- Баг 2: удаление именно из `LAYERS`, а не вырезание `renderExperimental` — минимально
  инвазивно, не ломает существующие ссылки в проде.

### followups
- В БД могут оставаться исторические дубликаты инсайтов (тип «Пуэльче» и др.),
  созданные ДО фикса PR#129. Их теперь можно спокойно удалять кнопкой на Path
  (после #133 без искажений). При желании — отдельная idempotent-миграция для
  массового сноса дублей (только `DELETE` дублей insight с общим `nm_node_id`,
  оставляя настоящий sensation-узел) — согласовать с Тахиром перед применением.
- Более глубокий рефактор: сделать так, чтобы `ensureView()` пересчитывал zoom/pan
  при существенном изменении домена и без ручной инвалидации (сейчас клиент-фикс
  локальный, чтобы не задеть прод-поведение pan/zoom).

### next_session
- Проверить деплой на GitHub Pages (клиент) + Railway (api), убедиться что новый
  `CACHE_NAME` (v52) выкатился и SW обновил закешированный account.html/JS.
- При необходимости — открыть PR-ветки #131–#133 в GitHub UI (сейчас закоммичено
  и запушено в `main`).

## 2026-07-09T23:55:00Z — abacus_nikita (Abacus AI Agent)

- did:
  - PR#131: FAB label External Field — "missing something" → "Хотите добавить своё?" (ru/en/es)
  - PR#132: удалена UI-вкладка Experimental из External Field, бекенд-логика сохранена
  - PR#133: fix Evolution Path — инвалидация кэша st.data/view/_tunnel/_layView/_dual/_w после удаления события; чинит искажение spine и мёртвые кнопки день/неделя/месяц
- changed: account.html, assets/js/external-field.js, assets/js/evolution-path.js, sw.js (CACHE_NAME=na-practices-v52)
- decisions: Experimental backend сохранён для обратной совместимости; st._w=0 сброс для принудительного пересчёта pxPerDay в ensureView()
- followups: проверить #133 на реальных данных (дублирующий Пуэльче) после деплоя
- next_session: TODO-prod-hygiene (test-юзеры в БД) ждёт решения Тахира

## 2026-07-11T23:15:00Z — claude-opus (Exercises & Tests feature)

- did:
  - New **Exercises & Tests** tool (Tools sub-tab «Упражнения и тесты»): 10
    evidence-based canvas cognitive exercises — N-back, Stroop, ANT, SART, Corsi,
    Digit Span, Go/No-Go, Task Switching, Trail Making A/B, Attentional Blink.
  - assets/js/exercises/_engine.js + 10 self-contained modules (mount(host,opts,
    onComplete) contract, 1-10 levels, 3-2-1 countdown, accuracy/RT/composite score).
  - Backend: migration **060** (exercise_definitions + exercise_results, seeded from
    api/exercises-seed.js w/ real clinical citations) + REST GET /api/exercises[/:slug],
    POST /api/exercises/result (personal-best + percentile + Path mirror),
    GET /api/me/exercises/results.
  - Personal Path: kind='exercise' lane + «🧠 Упражнения» toggle (server whitelist
    L8342/L8479 + evolution-path.js LAYERS/LAYER_YFRAC/nmPathColor/EVENT_LABELS).
  - Course Builder: exercises embeddable as tool_task blocks (courseAddExercise picker
    + inline cpRenderExercise/cpMountExercise/cpDisposeExercise player).
  - i18n a.tools.exercises (ru/en/es). Launcher UI (grid → level + mini brain-atlas +
    clinical evidence → play → result + POST).
- changed: account.html, api/server.js, assets/js/evolution-path.js, api/exercises-seed.js
  (new), assets/js/exercises/*.js (11 new), data/i18n/{ru,en,es}.json.
- committed: feat/exercises-tests @ 09bdbe2 (MY files only, by explicit path).
- verify: 10/10 modules register + mount clean (error-free console, correct control
  counts, dispose fns) via standalone harness. Node --check passes on all JS. Visual/
  gameplay + prod fresh-user pass DEFERRED (headless viewport is 0-width; and deploy
  is on hold — see below).
- decisions:
  - Used migration **060** (actual next-free on main), NOT the task's guessed 062.
  - **HOLD on merge/deploy/SW-bump.** File mtimes proved a CONCURRENT worker was
    editing this SAME tree mid-session (api/library-seed.js @23:02, sw.js→v53 «Library
    content pass» @23:04, new untracked api/library-ru/) — between my own edits. My
    SW v52→v53 bump collided with theirs. Committed only my files, left their WIP
    untouched. Did NOT push to main / deploy / run prod migrations.
- followups:
  - Reconcile ONE SW version covering BOTH features (their Library v53 + Exercises → v54)
    before deploy; my commit has NO sw.js bump.
  - After backend deploy: POST /api/run-migrations to create mig060 tables + seed 10 rows.
  - Prod fresh-user pass (register throwaway, walk the real Tools→Упражнения UI, run an
    exercise, confirm result saves + Path «Упражнения» marker appears).
- next_session: coordinate merge with the concurrent Library pass; push branch + open PR.

## 2026-07-12T00:05:00Z — claude-opus (Exercises addendum: 6 screening tests)

- did: Added 6 validated screening self-report tests (kind='screening_test') to the
  Exercises tab → 16 tools total: PHQ-9 (depression), GAD-7 (anxiety), ASRS-v1.1
  (adult ADHD), PCL-5 (PTSD), MDQ (bipolar), AQ-10 (autism traits). Deliberately
  EXCLUDED antisocial/"sociopathy" (no valid user-facing instrument; PCL-R is
  clinician-only) per Nick's guidance.
- verify: Item text + scoring VERIFIED against authoritative sources via 3 web-research
  agents (Kroenke 2001, Spitzer 2006, Kessler 2005/WHO, Weathers 2013/NCPTSD,
  Hirschfeld 2000, Allison 2012). 20 scoring reference cases pass. Full browser flow
  verified: account.html loads clean (0 console errors), grid→screener→questionnaire,
  submit-gating, PHQ-9 item-9 crisis banner fires.
- changed: account.html, api/server.js (exercise_definitions.kind col), api/exercises-seed.js
  (6 rows), + new assets/js/exercises/screening.js + screening-data.js (tri-lingual).
- committed: feat/exercises-tests @ aa17876 (my files only; co-founder sw.js/library-seed.js
  WIP still untouched; origin/main advanced to c623b08 Library A4 pass w/ SW v53).
- decisions: kind='screening_test' column added to exercise_definitions (mig060 + ALTER).
  Data-driven scoring (sum|threshold|aq10|mdq|pcl5). Every result shows NOT-A-DIAGNOSIS
  disclaimer + citation + validity. Screeners course-embeddable too.
- followups: UNCHANGED — SW must become v54 (v53 taken by merged Library pass); rebase
  feat/exercises-tests onto origin/main before merge; run mig060 after backend deploy;
  prod fresh-user pass. Deploy still HELD pending SW reconciliation + review.

---

## 2026-08-08T21:09:26Z — cursor_cloud (explore subagent)

- **project:** neuro
- **agent:** cursor_cloud
- **at:** 2026-08-08T21:09:26Z

### did
- Explored evolution-path.js pan/zoom (ensureView, wireCanvasPanZoom, overlaySeverityColor/drawOverlayTracks) for External Field Sun timeline reuse.
- Mapped external-field.js renderSun + timeline() vertical flare/CME list structure.
- Inventoried emoji maps: exercises ICON/CAT, EF tab icons, sketch (almost none), monad-lk (none).
- Located Sketch handoff docs mentioning 3D/layers/anatomy (SKETCH-BRIEF.md out-of-scope; feat-anatomy-atlas-handoff.md is anatomy not sketch).
- Listed exercises-seed.js short_description_ru; found Tools→Sketch registration in account.html.

### changed
- (read-only explore; JOURNAL.md only)

### files
- assets/js/evolution-path.js, assets/js/external-field.js, api/exercises-seed.js, account.html, docs/SKETCH-BRIEF.md, feat-anatomy-atlas-handoff.md, assets/js/sketch-tool.js, assets/js/monad-lk.js

### decisions
- []

### followups
- Parent can implement Sun horizontal timeline reusing ensureView + wheel zoom + overlaySeverityColor markers.

### next_session
- Implement External Field Sun events horizontal timeline if tasked.

## 2026-08-08 — Nick feedback batch (exercises / EF sun / icons / sketch / monad)

1. **Exercises:** longer natural RU instructions; splash stays until «Понял(а), начать»; after finish / mid-exit → back to **that exercise launcher** (not full grid).
2. **Corsi:** real drawn cubes (not circles) + copy about кубики.
3. **Icons:** `assets/js/na-icons.js` stroke set (index-style) for exercises + EF tabs (emoji chrome removed there).
4. **EF Sun:** Path-like horizontal intensity timeline (pan/zoom) instead of vertical flare list for today + history.
5. **Sketch:** brief rewritten — doodle is temporary; need original handoff re-upload for layers+3D.
6. **Monad:** `nilta95@mail.ru` → `nastya` (+ mig073 access); `/health` exposes `monad_configured`.

---

## 2026-08-15T15:43:10Z — cursor_cloud (emoji chrome inventory)

- **project:** neuro
- **agent:** cursor_cloud
- **at:** 2026-08-15T15:43:10Z

### did
- Inventoried remaining UI-chrome emoji in account.html, external-field.js, evolution-path.js; confirmed monad-lk.js / sketch-tool.js / index.html / method.html have none.
- Mapped each to existing NAIcons keys or noted new keys needed; prioritized a one-PR safe set (HA tabs, EF leftovers, OVERLAY_ICON HTML+toast, warn/check) excluding pickers/achievements/archetypes/joint reactions.

### changed
- JOURNAL.md only (read-only inventory)

### files
- account.html, assets/js/external-field.js, assets/js/evolution-path.js, assets/js/na-icons.js, assets/js/monad-lk.js, assets/js/sketch-tool.js

### decisions
- Exercises grid already on NAIcons (exIc); leftover chrome is HA tabs + EF body copy + Path overlay glyphs + NM toast/onboard.
- Canvas OVERLAY_ICON uses ctx.fillText — HTML rail/card can swap to NAIcons immediately; canvas needs Path2D or keep text glyphs until stroke draw helper exists.

### followups
- One PR: HA tabs (new keys anatomy/heart/conditions/pills/diet), EF 📍/☀/🌇/🌙/🌑/⚠, OVERLAY_ICON HTML sites + nmShowToast party/check, dx warn→warn.
- Defer: admin chrome, course block-type emoji map, emotion pickers, badge_emoji, archetype CHARACTER_TYPES, cpJointReact, canvas moon phase glyphs.

### next_session
- Implement prioritized replacements if tasked.

## 2026-08-15 — Follow-up: migrations + more NAIcons + Sketch roadmap

- Ran prod `/api/run-migrations` → mig066 seed upsert + mig073 Nastya link OK; exercise RU copy live.
- Expanded `na-icons.js` (anatomy/heart/conditions/pills/diet/pin/…).
- Replaced emoji chrome in HA tabs, EF location/sun/moon/warn, Path overlay HTML toggles.
- Boot-time light sync for exercise seed + Nastya (so we don’t depend only on the long migration endpoint).
- Sketch tab: roadmap bullets for layers+3D; still waiting on Nick’s original handoff file.

## 2026-08-15 — Sketch brief restored + Monad multi-chat

- Nick re-uploaded `nick-handoff-brief-2026-07-12` → copied to `docs/`, Sketch ТЗ rewritten from §6.
- Clarified Monad `/api/rhythm` 404 (dashboard live OK; JSON missing) → `docs/MONAD-TAHIR-HANDOFF.md` for Tahir+Monad.
- Monad LK: multiple chats/tasks, pinned context, file/image uploads, poll shared_context for replies (mig074).
- Sketch Phase 0/1 shell: 5-layer panel + Atlas viewport placeholder.


## 2026-11-07 — DOM Institute rebrand: repository access and workspace setup

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-07T17:22:13.433Z",
  "did": [
    "Verified GitHub read and push permissions for tvildanov/neuroattention-site",
    "Read AGENTS.md, engineering guide, recent session journal and main commits; inventoried open pull requests",
    "Confirmed GitHub Pages frontend and Railway neuroattention-api backend; Railway latest deployment SUCCESS",
    "Created codex/dom-institute-rebrand from main 25a237ab2a7cdf19a41e0974d742575a1a2422be for the user-requested DOM Institute rebrand"
  ],
  "changed": [
    "Session journal only; no application changes or deployment"
  ],
  "files": [
    "JOURNAL.md"
  ],
  "decisions": [
    "Use current repository sources while Monada MCP connection is being configured",
    "Keep rebrand work isolated from main and existing Cursor pull requests",
    "User will provide first concrete corrections before website content edits"
  ],
  "followups": [
    "Implement user-provided website corrections",
    "Keep RU/EN/ES strings synchronized and bump service worker cache for shippable frontend changes",
    "Synchronize session journal into Monada once MCP is available"
  ],
  "next_session": "Continue on codex/dom-institute-rebrand; recheck main and relevant files before each update to account for Cursor work"
}
```


## 2026-11-07 — Historical bug backlog reconciliation

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-07T17:27:14.610Z",
  "did": [
    "Reconciled historical Nick bug package against main journal, handoff files, open issues and merged/open PRs",
    "Documented missing original 29-item file; distinguished deferred, merged and unverified work"
  ],
  "changed": [
    "Documentation only"
  ],
  "files": [
    "docs/BACKLOG-REVIEW-2026-11-07.md",
    "JOURNAL.md"
  ],
  "decisions": [
    "No bug fixes, merges, deploys or task reprioritization; await Nick's selection",
    "Use backlog review as working reference alongside DOM rebrand"
  ],
  "followups": [
    "Choose which public-site issues to combine with rebrand",
    "Recover original nick-bugs-backlog file if available later",
    "Recheck runtime/code before treating historical TODOs as active bugs"
  ],
  "next_session": "Read docs/BACKLOG-REVIEW-2026-11-07.md; implement only user-selected corrections"
}
```


## 2026-11-07 — Homepage identity: DOM wordmark and directions eyebrow

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-07T18:11:52.058Z",
  "did": [
    "Prepared homepage-only DOM Institute wordmark with readable second line for Human Adaptation",
    "Preserved existing logo asset, hover logoPulse selector, accent line, hero title/subtitle/description, orbit video and all three CTA links",
    "Added localized homepage-only direction eyebrow in RU/EN/ES"
  ],
  "changed": [
    "Homepage header/eyebrow and scoped stylesheet; SW cache version"
  ],
  "files": [
    "index.html",
    "assets/dom-brand.css",
    "data/i18n/ru.json",
    "data/i18n/en.json",
    "data/i18n/es.json",
    "sw.js"
  ],
  "decisions": [
    "User retains current hero narrative",
    "CTA alternatives remain discussion only; existing buttons retained",
    "No main merge or deploy"
  ],
  "followups": [
    "Visual responsive verification before publishing: local Playwright browser executable unavailable; source invariants and locale JSON verified",
    "User to review wording and later choose CTA structure"
  ],
  "next_session": "Review homepage identity proposal, verify visual layout and continue next user-approved changes"
}
```


## 2026-11-07 — Retractable DOM institute cover (Russian editorial pass)

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-07T18:25:06.773Z",
  "did": [
    "Implemented a Russian retractable DOM institute cover above the existing homepage hero",
    "Verified in local Chromium at widths 320,375,768,1024,1440 using the site's font families: geometry, 3.5s auto-collapse, persistent manual reopening, skip, Escape and preserved logo hover",
    "Verified reduced-motion, deep-link and no-JavaScript fallbacks; visually inspected mobile and desktop screenshots",
    "Added a portable Playwright verification script"
  ],
  "changed": [
    "Homepage-only cover, scoped CSS, dedicated JS, service worker cache v91; existing hero unchanged"
  ],
  "files": [
    "index.html",
    "assets/dom-brand.css",
    "assets/js/dom-intro.js",
    "sw.js",
    "scripts/dom-intro-verify.mjs"
  ],
  "decisions": [
    "Every ordinary fresh page load opens the cover, then collapses after 3.5s of visible time",
    "Manual interactions stop automatic dismissal; background-tab time is paused",
    "Reduced motion and deep links start collapsed; cover is manually reopenable",
    "RU editorial pass first across pages; do not translate the new cover to EN/ES until requested",
    "No publication or main merge"
  ],
  "followups": [
    "Nick to review Russian cover and duration",
    "Safari and real-phone verification pending; orbit video asset playback was not tested in local cover harness",
    "Translate new cover in the later EN/ES pass"
  ],
  "next_session": "Continue user-directed homepage revisions; preserve current hero and buttons; publish only after agreed release approval"
}
```


## 2026-11-07 — Krona One cover preview and simplified identity labels

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-07T18:34:52.089Z",
  "did": [
    "Revised Russian cover subtitle to Институт человеческой адаптации",
    "Simplified navbar to logo + DOM Institute; moved For Human Adaptation to disclosure bar with arrow",
    "Previewed actual self-hosted Krona One on cover title; included OFL license",
    "Checked font loading, header/title geometry and disclosure behavior in Chromium at 320/375/768/1024/1440; visually inspected screenshots"
  ],
  "changed": [
    "Cover typography and labels; local 11KB font asset; cache v92"
  ],
  "files": [
    "index.html",
    "assets/dom-brand.css",
    "assets/fonts/Krona-One-OFL.txt",
    "sw.js",
    "docs/DOM-REBRAND-DECISIONS.md",
    "assets/fonts/krona-one-latin-400-normal.woff2"
  ],
  "decisions": [
    "Krona One is scoped to DOM Institute cover heading; no global heading-font replacement",
    "Cyrillic subtitle retains existing font because provided Krona One distribution has Latin only",
    "Russian editorial sequence remains; no publish"
  ],
  "followups": [
    "Nick to review Krona One preview",
    "Safari/real-device verification remains pending"
  ],
  "next_session": "Continue homepage review on codex/dom-institute-rebrand"
}
```


## 2026-11-07 — Authorized DOM homepage release and cursor tracking

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-07T19:05:29.781Z",
  "did": [
    "User explicitly requested deployment of the approved DOM homepage",
    "Reverted Krona One trial to prior hero font and removed trial assets",
    "Reproduced cursor failures for pointer-only movement and stopped bubbling in the old code; capture-phase pointermove/mousemove fixes both",
    "Verified widths 320/375/768/1024/1440, cover auto/manual behavior, native touch cursor and native fallback on blur in Chromium"
  ],
  "changed": [
    "DOM homepage release, cursor tracking and cache v93"
  ],
  "files": [
    "index.html",
    "assets/dom-brand.css",
    "assets/redesign.js",
    "assets/redesign.css",
    "sw.js",
    "docs/DOM-REBRAND-DECISIONS.md"
  ],
  "decisions": [
    "Publish this approved release through main/GitHub Pages",
    "No API code changes; deferred backlog remains untouched",
    "Exact cause on visitor hardware is unconfirmed"
  ],
  "followups": [
    "Confirm Pages deployment and live homepage",
    "Safari and physical-device verification pending"
  ],
  "next_session": "Continue Russian homepage editorial work after user reviews the deployed result"
}
```


## 2026-11-07 — Center purpose disclosure and shorten cover

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-07T19:47:40.699Z",
  "did": [
    "Previous release PR170 deployed successfully via Pages run 42404562033; live cover, original font and video resources verified",
    "Implemented Nick's follow-up: centered purpose label, larger/heavier existing navbar font, arrow directly below label",
    "Shortened visible countdown to 2500ms and curtain to 450ms",
    "Chromium passed centered geometry at 320/375/768/1024/1440, countdown ~2.5s, persistent manual reopening and RU/EN/ES label switching; inspected desktop/mobile screenshots"
  ],
  "changed": [
    "Homepage cover disclosure and timing; SW v94"
  ],
  "files": [
    "assets/js/dom-intro.js",
    "assets/dom-brand.css",
    "index.html",
    "data/i18n/ru.json",
    "data/i18n/en.json",
    "data/i18n/es.json",
    "sw.js",
    "docs/DOM-REBRAND-DECISIONS.md"
  ],
  "decisions": [
    "RU purpose label: Для человеческой адаптации; EN/ES label follows selected language",
    "Full cover translation remains deferred",
    "Publish the requested iterative adjustment; no unrelated backlog work"
  ],
  "followups": [
    "Verify deployed layout on live homepage"
  ],
  "next_session": "Continue user-directed homepage text and design"
}
```


## 2026-11-07 — Pending compact purpose tab and cover order

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-07T20:05:25.691Z",
  "did": [
    "Updated RU tab label, moved arrow inline and reduced bar to 48px",
    "Added slow cyan text-shadow pulse without scaling, disabled for reduced motion",
    "Expanded state shows only accessible collapse arrow; moved logo above directions",
    "Chromium checks at 320/375/768/1440 passed single-line compact tab, label hiding/restoration and logo ordering; reduced-motion pulse opt-out passed",
    "Reviewed existing Russian Problem/Facts/Solution text for editorial recommendations"
  ],
  "changed": [
    "Pending homepage tab and cover layout only"
  ],
  "files": [
    "index.html",
    "assets/dom-brand.css",
    "data/i18n/ru.json",
    "docs/DOM-REBRAND-DECISIONS.md",
    "JOURNAL.md"
  ],
  "decisions": [
    "No merge or deployment: user explicitly requested batching future changes",
    "EN/ES tab labels and 2.5-second countdown preserved",
    "Problem/Facts/Solution copy not changed; recommend preserving structure, substantiating numerical facts and broadening solution framing"
  ],
  "followups": [
    "Discuss Problem/Facts/Solution proposals and Hero CTAs",
    "Bump service worker on eventual release and recheck current main before publishing"
  ],
  "next_session": "Continue on codex/dom-institute-rebrand without deployment until user requests the grouped release"
}
```


## 2026-11-08 — Approved question and compact facts release

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-08T06:28:14.299Z",
  "did": [
    "Added the approved Russian institute question to the cover with link to dom.html",
    "Combined problem and facts in one section with a small facts introduction and four compact rows",
    "Preserved four fact texts, media URLs, alternating animation classes and concluding adaptation CTA",
    "Chromium verification at 320/375/768/1024/1440: no overflow, question link, three original Hero CTAs, four facts in problem section; row stack measures 428px at desktop and 585.5px at 375px width",
    "Inspected mobile facts and desktop cover screenshots; media binary playback requires live verification"
  ],
  "changed": [
    "Homepage cover and compact facts; Russian combined section label; service worker v95"
  ],
  "files": [
    "index.html",
    "assets/dom-brand.css",
    "data/i18n/ru.json",
    "sw.js",
    "docs/DOM-REBRAND-DECISIONS.md"
  ],
  "decisions": [
    "User explicitly authorized deploying this batch together with previous compact tab, pulse and cover-order changes",
    "Keep the current 30-year wording and Hero CTA buttons",
    "Do not reorder programs/method/ecosystem or rewrite subsequent sections; user still considering"
  ],
  "followups": [
    "Confirm Pages release and public homepage"
  ],
  "next_session": "Continue homepage changes after user reviews this deployed batch"
}
```


## 2026-11-08 — Thin heading-font tab and integration/media diagnosis

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-08T06:57:52.882Z",
  "did": [
    "Prepared thinner 36px purpose tab with existing heading font and title case; preserved responsive font sizes",
    "Chromium geometry passed at 320/375/768/1440",
    "Verified site API health, Railway services and public Monad persona health; inspected authentication code and site Unauthorized logs",
    "Verified all eight external homepage CloudFront images return 403, including AccessDenied body; repository has no matching originals",
    "Documented diagnosis and precise recovery steps"
  ],
  "changed": [
    "Purpose tab draft and diagnostic documentation"
  ],
  "files": [
    "assets/dom-brand.css",
    "index.html",
    "data/i18n/ru.json",
    "data/i18n/es.json",
    "docs/INTEGRATION-AND-MEDIA-2026-11-08.md",
    "docs/DOM-REBRAND-DECISIONS.md"
  ],
  "decisions": [
    "No automatic light-theme redesign; provide design opinion for owner discussion",
    "No secret access, credential rotation or authentication changes; API key validity remains unverified with current credentials",
    "No image substitutions without original assets",
    "Prepared branch changes without deploying this new typography draft"
  ],
  "followups": [
    "Owner reviews tab font and thickness",
    "Monad administrator validates and refreshes site integration key if needed, then performs authenticated read and persona test",
    "Recover original CloudFront images and migrate to controlled storage"
  ],
  "next_session": "Continue from typography draft and documented integration/media diagnosis"
}
```


## 2026-11-08 — Attention insight preview, awaiting release approval

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-08T10:12:53.258Z",
  "did": [
    "Prepared attention insight block replacing the current Solution section in the work branch",
    "Retained original drop-ripple.mp4 and circular mask, including mobile",
    "Arranged five text points along the circle's right arc on desktop, single column on mobile; cyan/blue markers",
    "Added a programs.html CTA; preserved following Method and all subsequent sections",
    "Verified Chromium at 320/375/768/1024/1440: no overflow, five points, expected arc/column, circle clipping and original video readyState 4; inspected screenshots"
  ],
  "changed": [
    "Russian attention insight preview, CSS and cache-busted stylesheet reference"
  ],
  "files": [
    "index.html",
    "assets/dom-brand.css",
    "docs/DOM-REBRAND-DECISIONS.md",
    "JOURNAL.md"
  ],
  "decisions": [
    "No deployment or main merge until user confirms preview",
    "Pending batch also includes approved thin Unbounded purpose tab and title-case labels",
    "Future sequence proposed: problem/facts, short attention insight, programs, method, ecosystem; program block not yet designed or moved"
  ],
  "followups": [
    "Owner approves or revises layout and copy",
    "At release recheck main and bump service worker",
    "Separately agree on homepage program section"
  ],
  "next_session": "Show preview and wait for confirmation before publishing grouped changes"
}
```


## 2026-11-08 — Mobile-first attention insight revision

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-08T10:18:06.088Z",
  "did": [
    "Recorded explicit approval of desktop insight and rejection of first mobile layout",
    "Rebuilt mobile composition with two-line heading, compact orb next to intro, divided readable rows and full-width 48px CTA",
    "Preserved all five point texts and original video; desktop layout unaffected",
    "Chromium verification at 320/375/390/430/768/1440: no overflow, heading exactly two lines on phones, video readyState 4; desktop arc coordinates and section height unchanged",
    "Mobile section at 375px reduced from ~1049px to ~807px; visually inspected 390px screenshot"
  ],
  "changed": [
    "Mobile-only insight layout and inline heading spans"
  ],
  "files": [
    "index.html",
    "assets/dom-brand.css",
    "docs/DOM-REBRAND-DECISIONS.md",
    "JOURNAL.md"
  ],
  "decisions": [
    "Desktop approved; new phone composition awaits review",
    "No main merge/deployment until mobile review is complete",
    "Retain app-friendly fully visible rows and full-width action"
  ],
  "followups": [
    "Owner reviews phone preview",
    "After approval publish insight with previously prepared thin heading-font tab"
  ],
  "next_session": "Continue with mobile review or explicitly approved release"
}
```


## 2026-11-08 — Approved white markers and grouped insight release

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-08T10:24:50.636Z",
  "did": [
    "Applied owner-requested pure-white markers without glow on desktop and mobile",
    "Changed phone title accent to muted dusty blue #A8C6D5",
    "Verified Chromium at 320/375/390/430/768/1440: pure-white markers, no shadow, correct phone accent, two-line phone title, no overflow and original video readyState 4",
    "Prepared owner-authorized deployment including pending attention insight, revised phone composition and thin heading-font purpose tab"
  ],
  "changed": [
    "Final insight color adjustment and cache v96"
  ],
  "files": [
    "assets/dom-brand.css",
    "index.html",
    "sw.js",
    "docs/DOM-REBRAND-DECISIONS.md"
  ],
  "decisions": [
    "Owner explicitly requested immediate deployment; release previous approved pending changes together",
    "Desktop arc and mobile composition preserved",
    "No auth/secret/image changes; earlier integration/media diagnosis remains unresolved"
  ],
  "followups": [
    "Confirm Pages success and public site release"
  ],
  "next_session": "Continue homepage program section after user reviews published insight"
}
```


## 2026-11-09 — DOM browser title and river-jade palette review

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-09T04:18:57.966Z",
  "did": [
    "Prepared porcelain/graphite/river-jade palette previews only; no palette implementation.",
    "Confirmed live homepage order remains attention insight -> method -> XR; program move has not been approved.",
    "Changed homepage document title, social title metadata, site name and shared RU/EN/ES meta.title to the requested DOM name."
  ],
  "changed": [
    "Browser title and social title metadata"
  ],
  "files": [
    "index.html",
    "data/i18n/ru.json",
    "data/i18n/en.json",
    "data/i18n/es.json"
  ],
  "decisions": [
    "Keep all favicon links and assets.",
    "Keep main/deployment unchanged; prepare reviewable branch for the next release.",
    "Homepage content order and colors remain unchanged."
  ],
  "followups": [
    "Owner selects jade preview and agrees next homepage content block.",
    "Publish browser-title branch with the next authorized release."
  ],
  "next_session": "Review programs vs method placement after the attention insight."
}
```

Validation: Chromium confirmed the requested title before translation and after switching RU/EN/ES; four existing favicon declarations retained. Jade previews passed 320/390/736/1024px geometry, equal carousel heights, original video playback and the local insight jump. Prepared PR #174; main/deployment unchanged.


## 2026-11-09 — Attention-to-method handoff and XR sequence

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-09T04:46:23.814Z",
  "did": [
    "Changed Russian attention headline to Human adaptation begins with attention.",
    "Added a compact NeuroAttention method bridge and method.html CTA; removed the redundant standalone homepage method section so XR immediately follows the insight.",
    "Prepared stronger white-jade Matrix palette preview and paired dark comparison; removed the mockup-only decorative oval.",
    "Verified actual insight at 320/375/390/736/1024/1440px: no overflow, five points, original video readyState 4, method link; explicit three-line phone title.",
    "Verified preview at 320/390/736/1024px with no overflow and local insight jump."
  ],
  "changed": [
    "Homepage insight copy, method handoff, section order and responsive title wrapping"
  ],
  "files": [
    "index.html",
    "assets/dom-brand.css",
    "JOURNAL.md"
  ],
  "decisions": [
    "User explicitly chose a compact method mention within insight; next homepage section is XR.",
    "Keep standalone method.html and all navigation links.",
    "Color work is preview only; no palette change to repository, no deployment.",
    "Pending DOM browser-title change remains in the same PR."
  ],
  "followups": [
    "Review white-jade Matrix preview; refine XR section next.",
    "Bump release cache and deploy only when requested."
  ],
  "next_session": "Continue with the DOM XR Platform block immediately after the attention insight."
}
```


## 2026-11-09 — Authorized homepage Matrix trial release

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-09T05:17:17.737Z",
  "did": [
    "Implemented user-approved dark Matrix palette across the homepage using a dedicated stylesheet and body.home-matrix scope.",
    "Preserved original media, cursor, logo and reveal animations; all other page palettes unchanged.",
    "Included previously approved DOM browser title, longer attention heading, compact NeuroAttention method bridge and direct insight-to-XR sequence.",
    "Fixed homepage Problem card heading wrapping and offset the attention anchor below sticky navigation.",
    "Verified full homepage at 320/375/390/768/1024/1440px, all sections without overflow after reveal; original insight video readyState 4; checked RU/EN/ES title switching and unchanged method-page palette; visually reviewed phone/desktop Hero, insight and cover.",
    "Prepared a stronger green white-jade Matrix beta preview only."
  ],
  "changed": [
    "Homepage-only palette and small responsive/anchor fixes; pending DOM content/title release"
  ],
  "files": [
    "index.html",
    "assets/dom-home-matrix.css",
    "assets/dom-brand.css",
    "data/i18n/ru.json",
    "data/i18n/en.json",
    "data/i18n/es.json",
    "JOURNAL.md"
  ],
  "decisions": [
    "User explicitly authorized deploying homepage Matrix and all pending approved changes.",
    "Do not implement or deploy the light theme; do not recolor other pages.",
    "Keep offline practice-audio service-worker cache unchanged: documents and styles are not cached by this worker. The new theme uses its own versioned CSS URL.",
    "Publish through the existing GitHub Pages workflow; no Railway/backend changes.",
    "Deployment outcome and run URL will be recorded in PR #174."
  ],
  "followups": [
    "Observe Pages workflow SUCCESS and verify live homepage after merge.",
    "Owner evaluates dark homepage; continue XR platform content next."
  ],
  "next_session": "Continue DOM XR Platform section after the Matrix homepage trial; light beta remains discussion only."
}
```


## 2026-11-09 — Homepage disclosures and mobile composition

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-09T11:52:18.043Z",
  "did": [
    "Made four homepage facts collapsible, initially closed, with fine-pointer partial hover preview and click/keyboard/touch expansion.",
    "Added bounded soft magnetic child movement and pointer highlight to both homepage disclosure bars.",
    "Cropped and scaled Hero media into a circle; moved it into a small upper-right thumbnail on phones.",
    "Enlarged mobile institute-cover logo and tightened cover spacing without changing the 2.5-second auto-collapse.",
    "Prepared two fresher yellow-green white-nephrite palette previews only.",
    "Chromium verification passed at 320/375/390/768/1024/1440px: no overflow, circular playable media, closed defaults, hover preview, full expansion, keyboard, touch, reduced motion, RU/EN/ES labels and no-JS fallback. Visually reviewed desktop Hero, phone cover/facts and light preview."
  ],
  "changed": [
    "Homepage disclosures and mobile composition"
  ],
  "files": [
    "index.html",
    "assets/js/dom-intro.js",
    "assets/js/dom-home-ui.js",
    "assets/dom-home-ui.css",
    "JOURNAL.md"
  ],
  "decisions": [
    "Owner explicitly authorized immediate deployment of this batch.",
    "Keep the dark Matrix theme live; light variants remain preview only.",
    "Preserve existing facts, media, program CTA, shared page styles and backend.",
    "Use existing GitHub Pages publication; no Railway mutation.",
    "Record terminal deployment outcome and public readback in this release PR."
  ],
  "followups": [
    "Observe Pages success and verify public source/assets after merge.",
    "Continue XR platform copy when owner is ready."
  ],
  "next_session": "Review published mobile homepage and choose whether to pursue a light palette."
}
```


## 2026-11-09 — Hero desktop-mode breakpoint regression

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-09T12:17:55.635Z",
  "did": [
    "Reproduced the reported Hero stacking between 768 and 1023 CSS pixels, including the width used by phone desktop mode.",
    "Added a homepage-scoped two-column Hero rule for the missing breakpoint range.",
    "Adjusted Hero headline sizing from 768 to 1199px to prevent copy extending toward the circle; retained the existing narrow-phone thumbnail and wide desktop composition.",
    "Verified 390/767/768/820/900/980/1023/1024/1199/1440px across regression runs, with explicit column-position and copy-overflow assertions; verified RU/EN/ES and 980x420 landscape; reviewed corrected 980px screenshot."
  ],
  "changed": [
    "Hero breakpoint layout and intermediate headline size; CSS URL version 2"
  ],
  "files": [
    "assets/dom-home-ui.css",
    "index.html",
    "JOURNAL.md"
  ],
  "decisions": [
    "User requested fixing the public regression within the ongoing authorized deployment workflow.",
    "No changes to facts, intro cover, palette or backend.",
    "Publish via existing GitHub Pages; record terminal outcome and live readback in release PR."
  ],
  "followups": [
    "Observe successful Pages deployment and verify public page/CSS match tested source."
  ],
  "next_session": "Continue homepage content after mobile desktop-mode Hero fix."
}
```


## 2026-11-09 — Half Facts preview, bounded pointer work and intro feedback

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-09T16:35:48.644Z",
  "did": [
    "Checked previous Hero deployment: first deploy timed out in Pages syncing_files; failed-job retry remained queued. Hero fix is already on main.",
    "Reworked Facts hover into an out-of-flow half-height preview so hovering does not animate the large blurred section height or trigger surrounding page relayout.",
    "Coalesced magnetic pointer events to one animation frame; cached button bounds and removed moving-gradient repaint. Added small leave debounce and guarded resize writes.",
    "Replaced homepage footer brand with DOM Institute; retained the existing legal company name.",
    "Added subpixel cover tremor and short mobile vibration pattern for the automatic 2.5-second intro. Both stop on timeout, manual interaction/collapse, page hiding and reduced motion. Actual vibration depends on browser hardware/user-activation policy.",
    "Prevented the older welcome pulse from overriding the intro signal and gated drop-video haptics to visible video.",
    "Chromium checks passed at 390/980/1440px: exact half-height inert preview, stable section height, full click and Escape, touch, reduced motion, footer label in RU/EN/ES, no page errors. A 1000-event pointer burst produced zero bounds reads and two style writes before the next frame. Mock vibration API verified a <=2500ms pattern and stop command at cover close. Reviewed preview screenshot."
  ],
  "changed": [
    "Facts preview performance and size",
    "DOM footer brand",
    "Intro visual/haptic feedback"
  ],
  "files": [
    "index.html",
    "assets/dom-home-ui.css",
    "assets/js/dom-home-ui.js",
    "assets/js/dom-intro.js",
    "assets/redesign.js",
    "JOURNAL.md"
  ],
  "decisions": [
    "User reported whole-page lag, not merely visual shaking; remove repeated layout/paint work instead of adding more animation to the Facts bar.",
    "Hover is visual half-preview; click/tap remains full expansion.",
    "Only automatic intro receives tremor; respect reduced-motion preference and do not repeat on manual reopening.",
    "Publish this authorized batch with the previously merged Hero fix; light theme remains preview only.",
    "A full hardware/browser freeze was not reproduced on the test machine; structural costs were reduced and bounded behavior verified. Deployment outcome belongs in the release PR."
  ],
  "followups": [
    "Observe new Pages workflow terminal status and public asset readback.",
    "If Pages continues to fail due the existing 2.5GB media artifact, address deployment/media hosting separately without removing practice audio."
  ],
  "next_session": "Confirm public release; continue DOM XR section after homepage interaction fixes."
}
```


## 2026-11-09 — Public Matrix rollout and readable three-second cover

```json
{
  "project": "neuro",
  "agent": "codex_chatgpt_work",
  "at": "2026-11-09T16:56:48.665Z",
  "did": [
    "Rolled the approved Matrix palette out to 14 public HTML pages using an explicitly linked shared assets/dom-matrix.css and body.dom-matrix scope.",
    "Aligned legacy cyan/violet decorative colors and dark surfaces in public page-local styles with the Matrix palette; retained semantic error/warning and program-category colors.",
    "Kept account.html, private practice.html, internal handoff and developer harness unchanged. Shared base styles and shared dashboard scripts are unchanged.",
    "Extended the automatic cover reading countdown and mobile signal to 3000ms; wait for fonts/logo with a bounded 1500ms fallback and two paint frames before countdown.",
    "Increased tremor amplitude from <=0.35px to <=0.85px; stops at close/manual intervention/reduced motion as before.",
    "Temporarily disable scroll anchoring during the height-collapse animation; no automatic scrolling added.",
    "Removed a pre-existing unmatched IIFE closer on method.html, verified identical syntax error existed in original main.",
    "Chromium checked all 14 pages at 390px and 1440px: correct Matrix background/accent and no horizontal overflow. Reviewed method, programs, test and checkout screenshots, including settled chat text.",
    "Measured phone cover: ~3 seconds open after readiness; height transitions 514px -> 88px -> 0, scrollY remains 0, zero scrollTo/scrollBy calls. Manual reopening stays open and does not repeat tremor. All public inline scripts pass node --check; method page has no page errors after syntax fix."
  ],
  "changed": [
    "Shared public Matrix palette",
    "Public page palette links/classes and legacy decorative colors",
    "Three-second cover timing, stronger tremor and collapse anchoring"
  ],
  "files": [
    "index.html",
    "checkout-confirm.html",
    "checkout-success.html",
    "custom.html",
    "dom.html",
    "lab.html",
    "method.html",
    "payment-coming-soon.html",
    "privacy-policy.html",
    "programs.html",
    "rehabilitation-application.html",
    "terms-of-service.html",
    "test.html",
    "xr.html",
    "assets/dom-matrix.css",
    "assets/dom-home-ui.css",
    "assets/js/dom-intro.js",
    "JOURNAL.md"
  ],
  "decisions": [
    "User explicitly authorized sitewide public theme and immediate deployment.",
    "Personal dashboard and its practice player are outside this rollout.",
    "Retain old homepage-only stylesheet for cached older HTML; new public pages use the shared theme explicitly.",
    "Keep existing images/animations, product behavior and legal entity data.",
    "Use existing GitHub Pages publication; record terminal deployment/public readback in release PR."
  ],
  "followups": [
    "Observe Pages terminal success and compare public assets with tested files."
  ],
  "next_session": "Review the public Matrix rollout; continue DOM XR platform content."
}
```
