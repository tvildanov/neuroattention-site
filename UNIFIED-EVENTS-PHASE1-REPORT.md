# Unified Events Model — Phase 1: отчёт для Ника

**Дата:** 2026-07-11 (ночная сессия)
**Ветка:** `feat/unified-events-phase1` — git worktree в `/Users/tvildanov/Code/na-unified-events`
**Базис:** `origin/main` @ `32a0dd7` (после мержа PR#132 — atlas/sports)
**Статус:** foundation закоммичена локально. **НЕ смержено, НЕ задеплоено, prod НЕ трогали.** Ждёт твоего решения.

---

## TL;DR

Сделал **безопасный аддитивный фундамент** под единую модель событий и **не стал** переписывать
render/save/delete и гонять backfill на проде — потому что это (а) нельзя прод-verify без тебя и без
деплой-окна, (б) там нашлись факты, которые ломают часть плана из брифа. Всё что закоммичено —
**no-op при выключенном флаге**: ничего в нейромапе / инструментах / пути / календаре не меняется,
пока `EVENTS_UNIFIED` не включён. Rollback = снять переменную окружения.

Ты просил «спорные моменты — в отчёт». Их несколько, и два из них меняют архитектуру. Ниже подробно.

---

## Что сделано (закоммичено, `e35a490`)

1. **Migration 062** (в `POST /api/run-migrations`, идемпотентная, чисто аддитивная):
   добавляет в `journey_events` колонки `title, notes, valence_plus, valence_minus, chain_id,
   practice_id, source, recurrence_rule, related_user_id, related_dependent_id` + индексы
   `je_source (user_id, source)`, `je_user_kind (user_id, kind)`, `je_chain (chain_id)`.
   Возвращает `mig062 = { columns_ensured, indexes_ensured, skipped?, error? }`.

2. **`createEvent(opts)`** — единый writer-суперсет над `logJourney`. Пишет новые колонки **И**
   дублирует `title/source/notes` в `payload` (см. спорный момент №3 — иначе текущие читатели ослепнут).

3. **`eventsUnified()` / флаг `EVENTS_UNIFIED`** (env, дефолт OFF). Весь рефактор — no-op пока OFF.

4. **`POST /api/events/manual`** — новый write-эндпоинт через `createEvent`, **gated 503 при OFF**
   (чтобы не создать split-brain, пока legacy-хранилища ещё главные). Событие сразу видно на Пути.

5. **`scripts/unified-events-backfill.mjs`** — inspection/dry-run скрипт diary→events. **Ничего не
   удаляет, сам не запускается**, требует `--apply --i-understand`. Связан с флагом (см. спорный №2).

**node --check прошёл. Prod-verify НЕ делал** (нет деплой-окна и нельзя проверять на живых данных
ночью без тебя). Скриншотов (a)–(e) поэтому пока нет — они требуют деплоя + флага ON.

---

## Спорные моменты (нужно твоё решение)

### 1. ❗ neon НЕ поддерживает интерактивные транзакции — `deleteEvent` из брифа не собирается как написан
`@neondatabase/serverless` v1.1.0, HTTP-драйвер. В его типах прямо: *«transaction() supports multiple
queries run in a **non-interactive** transaction»*. Значит `sql.transaction(async tx => { const e =
await tx\`...\`; if (e.chain_id) {...} })` — прочитать результат и ветвиться внутри — **невозможно**.
- **Хорошая новость:** твой `deleteEvent` **уже существует и работает** — это
  `POST /api/me/journey-event/:id/delete` (server.js ~L8751). Он делает полный каскад по 5 таблицам
  через **последовательные subquery-DELETE** (ровно тот паттерн, что в CLAUDE.md как единственно
  безопасный для neon). Транзакция не нужна и недоступна.
- **Решение:** не тащим `sql.transaction`. Используем существующий эндпоинт как unified delete;
  `DELETE /api/events/:id` при желании — тонкий алиас к нему. Согласен?

### 2. ❗ Backfill diary→events в одиночку СОЗДАЁТ призраков, а не убирает
Путь (`GET /api/users/me/evolution`, ~L8319) **уже читает `neuro_resource_diary` как fallback-источник**.
Если залить diary в `journey_events` пока этот fallback жив (флаг OFF) — каждая запись отрисуется
**дважды**. То есть backfill **нельзя** запускать как отдельный аддитивный шаг: он жёстко связан с
изменением read-пути (которое дропает diary-fallback) и должно идти **только после флага ON**.
- Скрипт написан, но с громким предупреждением и dry-run по умолчанию. **На проде не запускал.**
- **Вопрос к тебе:** твои 2 призрака («Пуэльче» 1 июля, «Sensation: пульсация @ Живот») —
  **мигрировать** в journey_events (правильно, но только после флага) или просто **удалить** 2 строки
  (проще, сразу, но руками и с твоего явного ok)? Я не удалял твои данные ночью без подтверждения.
  NB: «Sensation: …» — это mirror-строка сенсорной ноды (её отдельно чистила migration 042); её backfill'ить как diary НЕ надо.

### 3. `title/source/valence` сейчас лежат в `payload`, не в колонках
Текущие читатели берут `payload->>'title'`, `payload->>'source'`, `payload->>'valence'`. Поэтому
`createEvent` пишет **и колонку, и payload-ключ** — иначе старый рендер покажет пустоту. При переходе
на чтение из колонок это dual-write надо сохранять весь переходный период. Заложено.

### 4. Хранилищ на самом деле ЧЕТЫРЕ, не три
Бриф называл `neuro_resource_diary / journey_events / nm_*`. Но **Календарь — это отдельная таблица
`calendar_events`** (есть свои `GET /api/calendar`, `PATCH toggle`, `DELETE`). Плюс diary. Так что
unified-read надо будет свести **4** источника, и календарный UI сейчас пишет в `calendar_events`, а
не в journey_events. Это увеличивает объём Phase 2 ((render-унификация) и делает «мгновенный»
`/api/events/manual` видимым **на Пути**, но **не в Календаре**, пока календарный read не унифицирован.

### 5. Корень бага «diary_uuid ломает parseInt» подтверждён
`neuro_resource_diary.id` = **UUID**, а `journey_events.id` = **BIGINT**. Если фронт зовёт
journey-event delete (`parseInt` → NaN → 400) с diary-uuid — отсюда «delete не срабатывает + кнопки
day/week/month виснут». В единой модели diary-события живут в journey_events c BIGINT-id → класс бага исчезает.

### 6. Отклонения в migration 062 (осознанные, задокументированы в коде)
- `occurred_at` уже есть (TIMESTAMP) → не пересоздаю и **не меняю на TIMESTAMPTZ** (ALTER TYPE на
  заполненной колонке лочит таблицу + риск tz-сдвига).
- **Не добавляю CHECK на `kind`.** Сейчас `kind` — свободный TEXT (diet, sensation, emotion…);
  рестриктивный CHECK **отвергнет существующие значения** = регрессия без пользы для Phase 1.
- `chain_id` — **голый BIGINT без FK** на nm_chains (в этом коде жизненный цикл ноды/чейна/события
  ведётся кодом — контракт удаления PR#118, — а не DB-каскадами; голая колонка идемпотентна).
- `je_occurred_at` из брифа не делаю — дубликат существующего `idx_journey_events_user_time`.

### 7. Флаг: env vs `system_settings`
В коде **нет прецедента env-флагов**; тумблеры делают через таблицу `system_settings`
(`getCollectivePublished()`). Сделал `EVENTS_UNIFIED` как **env** (как в брифе): плюс — нулевой
round-trip на горячем read-пути, флип одной переменной. Минус — флип на Railway требует рестарта
контейнера. Если хочешь мгновенный флип без деплоя — переведу на `system_settings` за 10 минут. Скажи.

### 8. SW bump — НЕ делал (осознанно)
Изменение **только серверное**, ни один клиентский ассет не тронут. Бамп SW заставил бы всех
перекачать неизменённые ассеты и мог бы **столкнуться с версиями SW параллельных сессий** (P4/P5).
Бампнем SW в Phase 2, когда появится фронт (кнопка «добавить событие» → `/api/events/manual`).

---

## Что НЕ трогалось (другие сессии в безопасности)

- **P2/P3** (Atlas search + hide-region + Sports precision) — уже в main (PR#132), не трогал.
- **P4** (Library refinement) — не трогал.
- **P5** (Exercises, mig060) — уже в main, не трогал. ⚠️ P5 пишет в `journey_events` — когда включим
  unified, координируемся: пусть новые записи P5 идут через `createEvent` (Phase 2), но `logJourney`
  оставлен рабочим, так что P5 сейчас ничего не ломает.
- Никакие render/save/delete существующие пути **не переписаны**. `logJourney` и все его вызовы
  нетронуты. Календарь/дневник/путь/нейромап работают ровно как раньше.

## Что осознанно НЕ сделал этой ночью (Phase 2, после твоего ok + деплой-окна)
- Переписать 3 render-эндпоинта на чтение из одной таблицы (самый регрессионно-опасный кусок; нужен prod-verify).
- Перенаправить существующие save-handlers через `createEvent`.
- Запустить backfill на проде (связан с флагом; трогает твои данные).
- Birthday recurrence expand (rrule) + post-event nudge (cron) + Calendar OAuth (P3-фундамент). Колонки
  `recurrence_rule/related_user_id/related_dependent_id` под дни рождения уже заложены в mig062.

---

## Rollout runbook (когда дашь добро)

1. `git worktree` уже готов. Ревью diff: `git -C /Users/tvildanov/Code/na-unified-events show e35a490`.
2. Push ветку → PR «Unified events model — Phase 1». **Не мержить в main.**
3. Деплой ветки на Railway (или staging) с **`EVENTS_UNIFIED` НЕ выставленным** (=OFF).
4. `POST /api/run-migrations` → проверить `mig062.columns_ensured=10, indexes_ensured=3`.
5. **Verify baseline:** Календарь/Путь/Нейромап рендерят то же, что до деплоя (флаг OFF = no-op).
6. Phase 2 (отдельно): собрать unified-read за флагом, dry-run backfill, потом `EVENTS_UNIFIED=true`,
   verify unified, backfill `--apply`. Каждый шаг — verify. Сломалось → снять переменную.

## Rollback
**`EVENTS_UNIFIED` unset (или ≠ 'true') на Railway → рестарт.** Мгновенно возвращает legacy-поведение.
Колонки mig062 остаются (пустые, безвредные). Никаких обратных миграций не нужно.

---

## Открытые вопросы (коротко — ответь, и я доделаю Phase 2)
1. `deleteEvent`: ок использовать существующий `journey-event/:id/delete` вместо `sql.transaction`? (спорный №1)
2. Твои 2 diary-призрака: **мигрировать** (после флага) или **удалить 2 строки** сейчас (с твоего ok)? (№2)
3. Флаг: оставить **env** или перевести на `system_settings` для мгновенного флипа? (№7)
4. Whisper для практик, deprecate `neuro_resource_diary` сразу/через 2 недели, Google Calendar OAuth
   старт — как в брифе, это Phase 2/3, подтверди приоритет.

---
---

# ЧАСТЬ 2 — Phase 2 + P6 (External auto-import) + Event templates + P7-фундамент

Ты дослал ещё три расширения (Phase 2, External auto-import, event templates + координацию с P7).
Ниже — что я **построил** (backend, аддитивно, за флагом), что **спроектировал но НЕ строил**
(фронт — зона регрессий/SW-коллизий), и новые спорные моменты. Всё так же: **не смержено, не
задеплоено, prod не трогал.** Коммиты `f41dcf0` + `1f3418d`.

## Решение по scope (почему не «весь фронт за ночь»)
Ты написал «всё за ночь, включая Phase 2», но твой же первый бриф стоит выше: «не поломай что
работает, будь аккуратен, не мержь без прод-verify». Правило: **бэкенд, аддитивный и за флагом —
строю** (его можно проверить рассуждением + юнит-тестами, флаг OFF = no-op). **Фронт в `account.html`**
(nudge-модалка, dropdown шаблонов, форма birth_date в профиле, тумблер prefs) **— проектирую, не
трогаю**: этот файл нельзя проверить локально (CORS), а бамп SW сталкивается с версиями параллельных
P4/P5. Строить непроверяемый фронт в самый хрупкий файл ночью = ровно то, что ты запретил.

## Что ПОСТРОЕНО (backend, за флагом EVENTS_UNIFIED)

### Миграции (все идемпотентные, в `POST /api/run-migrations`)
- **mig063** — `event_templates` (tri-lingual `title_ru/en/es` — иначе i18n-footgun) + `user_template_usage` + seed 14 шаблонов (ДР, Завтрак, Обед, Ужин, Прогулка, Работа, Свидание, Тренировка, Сон, Встреча, Дорога, Медитация, Практика, Личное время).
- **mig064** — `ALTER TABLE users ADD COLUMN birth_date DATE` (для своего ДР; NULL = seed no-op).
- **mig062** дополнена: `external_event_id` (P6 dedup), `imported_event_id` + `oauth_provider` (P7), `nudged_at` + partial-unique индексы `je_external_dedup`, `je_imported_dedup`.

### Event templates
- `GET /api/event-templates?lang=` — каталог (активные, sort) + «Ваши недавние» top-5 (по `user_template_usage`, 30 дней). **Ungated**, resilient (до миграции → пусто, не 500).
- `POST /api/events/manual` теперь принимает `template_slug` + `duration` → трекает usage.
- `POST /api/admin/event-templates` (superadmin) — добавить/обновить глобальный шаблон.

### P6 External Field auto-import
- Пороги (`extImportPasses`, **юнит-тестировано** 10/10): moon new/full, sun **M5+/X**, quake **M6+**, cosmos GW; weather/social/experimental — никогда.
- `runEventAutoImport(days)` — материализует сильнейшие `external_signal_events` (глобальные, `user_id IS NULL`) в `journey_events` kind='external' source='external_field'. **Opt-in**: `config.autoImport===true` (глобальный тумблер) **И** конкретный layer enabled. Dedup по `external_event_id = dedup_key` (+ unique index).
- `POST /api/admin/events/auto-import` (superadmin, gated).

### 2b Post-event nudge
- `runNudgeSweep()` → `notifications` kind='post_event_nudge' (через **существующую** notifications-таблицу и `GET /api/notifications` UI). Два прохода: (1) вчерашние one-off события без chain (dedup по `nudged_at`); (2) повторяющиеся ДР, чья годовщина была вчера (dedup по event+occurrence).
- `POST /api/admin/nudge/sweep` (superadmin, gated). Шаблоны вопросов по kind/source (moon/sun/earth/cosmos/birthday).

### 2a Birthdays
- `POST /api/me/birthdays/seed` (gated) — своё ДР из `users.birth_date` + семейные из `dependent_profiles.birth_date` (Платон и т.д.) как recurring template events (`FREQ=YEARLY;BYMONTH;BYMONTHDAY`). Идемпотентно.
- `expandRecurrence(ev, from, to)` — нативный YEARLY-разворачиватель (без `rrule` npm — birthdays это только YEARLY; leap-day корректен, до года рождения не эмитит). Юнит-тестировано.

### Nightly job
- `startUnifiedEventJobs()` — hourly-проба с day-guard, **early-return если флаг OFF** (pure no-op). Реальный external cron может заменить, дёргая admin-эндпоинты.

## Что СПРОЕКТИРОВАНО, но НЕ построено (фронт — Phase 2 UI, отдельный заход после verify)
1. **Календарь: кнопка «Шаблоны» → dropdown** (иконка+title, секция «Недавние»). Данные готовы (`GET /api/event-templates`). Клик → префилл формы, POST `/api/events/manual` c `template_slug`+`duration`.
2. **Nudge-модалка/тост** при логине: читать `GET /api/notifications` (kind='post_event_nudge'), показать «Вчера: <title>. Как прошло?» с 4 кнопками: [+эмоция]→emotion flow с привязкой к event (chain), [+ощущение]→sensation, [+контекст]→textarea → PATCH notes, [не состоялось]→delete event+notification. Нужен новый эндпоинт `PATCH /api/events/:id` для notes/context (сейчас нет — см. открытый вопрос).
3. **Профиль: форма birth_date** (записать свой ДР → потом `/api/me/birthdays/seed`).
4. **Prefs: тумблер «Auto-import from External Field»** → пишет `config.autoImport` в `POST /api/external/subscriptions`.
5. **Path/Calendar: 🎂 иконка** для birthday, разворот recurrence через `expandRecurrence` в calendar read (это часть render-унификации Phase 2, которую я держу до verify).

## P7 (внешние календари OAuth) — контракт хэндоффа
Твой PR (этот) кладёт схему: `journey_events.imported_event_id TEXT` + `oauth_provider TEXT` +
partial-unique `je_imported_dedup(user_id, oauth_provider, imported_event_id)`. P7-сессия:
пишет импортированные события через `createEvent({..., source:'imported_calendar', oauth_provider:'google', imported_event_id:<googleId>})`; создаёт свою `oauth_tokens` таблицу + интеграции. Dedup гарантирован индексом. Схему они НЕ мигрируют — только используют. Общая events-таблица — одна.

## Спорные моменты Phase 2 (новые)
- **A. Double-render внешних событий.** Сейчас external события рисуются на Пути **как overlay-маркеры** (`overlayThreshold`, read-time, НЕ в journey_events). P6 их **материализует** в journey_events. Если оба активны — на Пути будет и маркер, и spine-нода. При включении P6 нужно **подавлять overlay для материализованных layer'ов** (или явно развести визуально). Это render-решение Phase 2 (за флагом). Пока флаг OFF — материализации нет, overlay работает как раньше.
- **B. Auto-import — opt-in, не opt-out.** Я намеренно требую `config.autoImport===true` (а не «подписан = импортим»), чтобы никого не удивить событиями на Пути. Дефолт = ничего не импортится, пока юзер не включит тумблер. Если хочешь «подписан ⇒ импортим» — скажи, поменяю на 1 строку.
- **C. Nudge нужен `PATCH /api/events/:id`** для действия «+контекст» (обновить notes/payload.context). Сейчас такого нет. Добавить в Phase 2 (тривиально, owner-gated).
- **D. Порог землетрясений** — взял **M6.0** (бриф: «M6+ или M7+»). Легко поднять до 7 в `EXT_IMPORT.quakeMinMag`.
- **E. Nightly job — in-process interval**, переживает рестарты через day-guard, но при частых rolling-деплоях время дрейфит. Для точного времени — вынести на внешний cron, дёргающий `/api/admin/events/auto-import` + `/nudge/sweep`.
- **F. Свой ДР требует `users.birth_date`**, которого не было — добавил колонку (mig064), но заполнение — через будущую форму профиля. Пока пусто → seed своего ДР no-op (семейные из dependent_profiles работают сразу).

## Как разложить PR (рекомендация)
Диф уже ~330 строк (backend). Предлагаю **один PR «Unified events — Phase 1+2 backend foundation»**
(всё аддитивно и за одним флагом), **фронт — отдельным follow-up PR** после прод-verify флага.
Не дроблю бэкенд на два, т.к. он связный и целиком no-op при OFF. Фронт нельзя мержить без verify —
поэтому он отдельно, с бампом SW тогда же.

## Обновлённый rollout (добавка к части 1)
После шагов 1–5 части 1 (флаг OFF, verify baseline):
6. Флаг ON на staging → `POST /api/me/birthdays/seed` (свой юзер) → проверить ДР на Пути/Календаре.
7. Включить `config.autoImport` у тест-юзера → `POST /api/admin/events/auto-import` → проверить дедуп (повторный вызов = 0 created).
8. `POST /api/admin/nudge/sweep` → проверить notification появился, `nudged_at` проставлен, повторный вызов не дублирует.
9. Только потом — фронт-PR (dropdown/модалка/профиль/тумблер) + бамп SW.

**Rollback тот же:** `EVENTS_UNIFIED` unset → все Phase-2 эндпоинты 503, nightly job no-op, материализации нет. Колонки/таблицы остаются пустыми и безвредными.

---
---

# ЧАСТЬ 3 — Nick P6-final (правки перед merge+deploy)

Ник дал финальные корректировки и добро на merge+deploy. Применено:

## 1. Шаблоны 14 → 12
Убраны `meditation` и `personal`. Миграция (теперь **068**) сидит 12 шаблонов и
дополнительно `DELETE FROM event_templates WHERE slug IN ('meditation','personal')`
— чтобы re-run убрал строки, засеянные прежней 14-версией.

## 2. External Field — новая фильтрация
- **LIGO/GW (Cosmos) — полностью убран.** Удалён провайдер `services/external/gracedb.js`,
  запись `gracedb` из `EXT_SOURCES` и `EXT_HISTORY_SOURCES`, ветки `gw_candidate` из
  `overlayThreshold`/`extSignificant`/`extNotifyBody`/`nudgeQuestion`. Миграция теперь
  чистит ВСЕ `layer='cosmos'` строки (было — только MDC-реплеи). Фронт: вкладка «Cosmos»
  убрана из `LAYERS` (renderCosmos оставлен defensively, как сделали с experimental #132),
  «LIGO/Virgo/KAGRA» вырезан из строки источников. `external-field.js?v=10→v11`.
- **Луна:** materialize только `full`/`new` фаза **+ затмения** (лунные и солнечные).
  Новый источник `services/external/eclipse.js` — авторитетная таблица канона NASA/GSFC
  (солнечные+лунные, 2024–2030, date-accurate, `magnitude` где опубликовано). Питает
  moon-layer (`event_type='eclipse'`). Прочие фазы не materialize-ятся.
- **Солнце:** X-класс — всегда. M-класс — только если совпал с **Earth-directed CME**
  из DONKI `/CME`. `earthDirectedCmeNear()`: берёт `cmeAnalyses` (`isMostAccurate`),
  считает угол между вектором CME (lat/lon/halfAngle, Stonyhurst) и направлением на Землю
  (lat=B0, lon=0) в окне ±4 дня; проходит если Земля внутри конуса (sep ≤ halfAngle).
  Консервативно: нет подтверждённого CME → M-флейр НЕ импортится. Геометрия CME в metadata.
- **Землетрясения:** перцептивная интенсивность через **USGS ShakeMap**
  (`services/external/shakemap.js`). Предфильтр M5+; основной фильтр — MMI ≥ III в
  координатах юзера: качаем `download/grid.xml` из event-продуктов USGS, парсим MMI-грид,
  билинейная интерполяция в (lat,lon). Кэш гридов 7 дней в `shakemap_cache`.
  Fallback — Bakun–Wentworth (`log10(PGA)=-0.5+0.6M-1.66log10(R+10)`, `MMI=3.66log10(PGA)-1.66`,
  R=haversine). Нет координат у юзера → глобально M7+. Фильтр теперь **per-user**
  (интенсивность зависит от местоположения). Проверено юнит-тестами (bilinear точен,
  BW монотонен, канон затмений 2026 совпал).

## 3. Materialization
Каждое проходящее событие → `journey_events` (`kind='external'`) с
`source ∈ external_moon|external_sun_flare|external_earthquake|external_eclipse`,
новыми колонками **`intensity NUMERIC`** (MMI / M-эквивалент флейра / mag затмения /
% освещённости Луны) и **`metadata JSONB`** (геометрия CME / MMI+метод / фаза / тип
затмения), `payload` с датой. Рендерится на Пути/Календаре через существующий
journey_events-путь; ретро-привязка цепочек — существующим NeuroMap-механизмом.
Колонки/`shakemap_cache` — в миграции **067**.

## 4. Whitelist перед флагом (sanity #2)
`eventsUnified(userId)`: **сначала** читает `EVENTS_UNIFIED_WHITELIST` (CSV user_ids) —
если непусто, фича ON только для перечисленных (Ник), OFF для остальных даже при
`EVENTS_UNIFIED=true`; whitelist пуст → правит глобальный флаг. Whitelist-ветка стоит
РАНЬШЕ чтения env-флага. Per-user гейт вставлен в `runEventAutoImport`/`runNudgeSweep`
до любой записи; ночной job гейтит `eventsUnifiedActive()` (whitelist ИЛИ флаг).

## 5. Diary-призраки
2 строки (`Пуэльче` 01.07, `Sensation: пульсация @ Живот`) — backup в
`.telemetry/nick-p6-merge-backup-<ts>.sql`, затем DELETE. НЕ мигрированы в journey_events.

## Renumber миграций
`mig062/063/064` конфликтовали с уже смерженными main (P8 062/063, wearables 065) →
переномерованы в **067/068/069**. 066 оставлен параллельной P5-сессии.

## Sanity check #1 — DROP neuro_resource_diary
НЕ выполняется автоматом. Только после явного «ок» Ника (verify в приватном окне),
затем DROP + удаление fallback-кода отдельным шагом.

## Известный Phase-2 follow-up (для Ника)
Материализованные external-события рисуются на Пути как spine-ноды И как read-time
overlay-маркеры (`overlayThreshold`) — возможен двойной рендер для тех же событий.
Подавление overlay для материализованных слоёв — фронт evolution-path.js, Phase 2
(за флагом, не блокирует whitelist-verify Ника).
