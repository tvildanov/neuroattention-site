# JOURNAL — neuroattention-site

> Закон Манады: ни одно действие не исчезает. Каждая сессия дописывает
> датированную запись по схеме `{project, agent, at, did[], changed[],
> files[], decisions[], followups[], next_session}`. Следующая MONAD-сессия
> синхронизирует эти записи в `journal.neuro` / `shared_context`.

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
