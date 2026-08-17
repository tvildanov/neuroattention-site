# JOURNAL — neuroattention-site

> Закон Манады: ни одно действие не исчезает. Каждая сессия дописывает
> датированную запись по схеме `{project, agent, at, did[], changed[],
> files[], decisions[], followups[], next_session}`. Следующая MONAD-сессия
> синхронизирует эти записи в `journal.neuro` / `shared_context`.

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
