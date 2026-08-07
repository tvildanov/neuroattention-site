# JOURNAL — neuroattention-site

> Закон Манады: ни одно действие не исчезает. Каждая сессия дописывает
> датированную запись по схеме `{project, agent, at, did[], changed[],
> files[], decisions[], followups[], next_session}`. Следующая MONAD-сессия
> синхронизирует эти записи в `journal.neuro` / `shared_context`.

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
