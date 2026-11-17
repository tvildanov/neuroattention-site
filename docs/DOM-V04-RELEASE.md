# DOM v0.4 implementation and release record

Source: full Package 04, 495 lines / 92971 bytes; SHA256 `4ea2bb4560078de0d861a4d901b3cfcd8066a67aa7a9a55482de93b338c402a3`. Attachment ID `libfile_ab53a7bed9188191b072e7ce360c2a14`. Read in full, sections 0–J and all 39 tasks.

Base: published v0.3 `d3c8cd516a654cfeac482b0c9ff82a6a65f6bc2a`. Separate branch `codex/dom-v04-review-20261117`. Parallel typology branch `12dc8a5c10110a920c8a5726b0139e8acdf226d6`, not merged or modified.

## Findings

- Native drop video is 320×320 at 25 fps; will retain fallback and replace scaled display with resolution-independent point-field rendering.
- Brain 1440×1440 / 46732 bytes, campus 924×1536 / 462975 bytes; historical checked-in originals have the same dimensions. No AI upscale. Genuine Retina source limitation must be reported.
- XR original JPEG is 1774×887 / 478351 bytes versus the 170626-byte WebP; preserve complete composition and coordinates, restore original and correct crop-aware sizes.
- World map is 864×1536 / 2316861 bytes, identical to supplied PNG; low source width despite file size. Crowd image 1440×1440.
- Railway root is /api; canonical profile config is outside build context. Fix delivery without changing profile values.
- Real email test needs an explicitly authorised mailbox; not authorised to use personal addresses or write real application records.

## Tasks

| ID | Status | Requirement |
|---|---|---|
| V04-01 | Pending | Аудит резкости всех важных медиа на сайте [УТВЕРЖДЕНО, P0] |
| V04-02 | Pending | Не подменять первоисточник «оптимизированным» thumbnail [УТВЕРЖДЕНО, P0] |
| V04-03 | Pending | Исправить наложение вопроса на мозг [УТВЕРЖДЕНО, P1] |
| V04-04 | Pending | Убрать дополнительный огромный раскрывающийся блок опроса [УТВЕРЖДЕНО, P0] |
| V04-05 | Pending | У каждого списка — поле «Другое» без увеличения экрана [УТВЕРЖДЕНО, P1] |
| V04-06 | Pending | Высота и чекпоинт [УТВЕРЖДЕНО, P1] |
| V04-07 | Pending | Заголовок того же масштаба, что DOM Space [УТВЕРЖДЕНО, P1] |
| V04-08 | Pending | Увеличить круг примерно на 25–35%, расширяя влево и вверх [УТВЕРЖДЕНО: заметное увеличение; величину подобрать по вьюпорту, P1] |
| V04-09 | Pending | Подзаголовок и раскрываемые карточки: более крупно и плотнее [УТВЕРЖДЕНО, P1] |
| V04-10 | Pending | Светящийся следующий шаг должен быть виден сразу [УТВЕРЖДЕНО, P0] |
| V04-11 | Pending | Мост из карточки DOM к DOM Space: показать причинную связь [УТВЕРЖДЕНО ПО СМЫСЛУ; рабочая редакция, P1] |
| V04-12 | Pending | Композиция секции и служебные обозначения [УТВЕРЖДЕНО, P1] |
| V04-13 | Pending | Новые заголовки четырёх переключателей [ПРИНЦИП УТВЕРЖДЁН; редакция для внедрения, P1] |
| V04-14 | Pending | Готовый текст 01 — модель будущего мира [ПОДТВЕРЖДЁН СМЫСЛ; РЕКОМЕНДУЕМАЯ РЕДАКЦИЯ, P1] |
| V04-15 | Pending | Готовый текст 02 — инновационный реабилитационный комплекс [ПОДТВЕРЖДЁН СМЫСЛ; РЕКОМЕНДУЕМАЯ РЕДАКЦИЯ, P1] |
| V04-16 | Pending | Готовый текст 03 — кампус и лаборатории [ПОДТВЕРЖДЁН СМЫСЛ; РЕКОМЕНДУЕМАЯ РЕДАКЦИЯ, P1] |
| V04-17 | Pending | Готовый текст 04 — метод как фундамент всей среды [ПОДТВЕРЖДЁН СМЫСЛ; РЕКОМЕНДУЕМАЯ РЕДАКЦИЯ, P1] |
| V04-18 | Pending | «Пространства и форматы» — разделить инфраструктуру и виды опыта [УТВЕРЖДЕНО, P2] |
| V04-19 | Pending | Сохранить изображение и слегка приблизить текст [УТВЕРЖДЕНО, P2] |
| V04-20 | Pending | Институт: говорить о факультетах, не о безликих «направлениях» [УТВЕРЖДЕНО ПО ПОЗИЦИОНИРОВАНИЮ; НАЗВАНИЯ — РЕДАКЦИЯ, P1] |
| V04-21 | Pending | Содержательные описания шести карточек факультетов [СМЫСЛ УТВЕРЖДЁН; РЕКОМЕНДУЕМАЯ РЕДАКЦИЯ, P1] |
| V04-22 | Pending | Развернуть описание непосредственно поверх выбранной карточки [УТВЕРЖДЕНО, P0] |
| V04-23 | Pending | Каталог расширить через «Ещё направления» [УТВЕРЖДЕНО, P1] |
| V04-24 | Pending | Заголовок Institute & Lab [ОТКРЫТАЯ КОМПОЗИЦИЯ; РЕКОМЕНДАЦИЯ, P2] |
| V04-25 | Pending | Лаборатория: главный вопрос плюс четыре конкретных вызова [УТВЕРЖДЕНО, P1] |
| V04-26 | Pending | Вопрос 01 — старение: смело, конкретно, про полноценную жизнь [УТВЕРЖДЁН СМЫСЛ; РЕКОМЕНДУЕМЫЙ ТЕКСТ, P1] |
| V04-27 | Pending | Вопрос 02 — молодые люди: выйти из чужого сценария [УТВЕРЖДЁН СМЫСЛ; РЕКОМЕНДУЕМЫЙ ТЕКСТ, P1] |
| V04-28 | Pending | Вопрос 03 — ИИ как формирующаяся новая форма интеллекта [УТВЕРЖДЁН АВТОРСКИЙ ВЗГЛЯД; РЕКОМЕНДУЕМЫЙ ТЕКСТ, P1] |
| V04-29 | Pending | Вопрос 04 — бизнес: сохранить текущий или усилить без изменения смысла [ЧАСТИЧНО УТВЕРЖДЕНО, P1] |
| V04-30 | Pending | Одна общая CTA вместо нагромождения кнопок [УТВЕРЖДЕНО, P1] |
| V04-31 | Pending | Удалить декоративный публичный абзац о «четырёх приоритетах» [УТВЕРЖДЕНО, P1] |
| V04-32 | Pending | `/data/profile-stats.json`: исправить доступность конфигурации профилей [P1, ТЕХНИЧЕСКИЙ ДЕФЕКТ ПОДТВЕРЖДЁН] |
| V04-33 | Pending | NOAA SWPC: убрать запрос к устаревшему solar-wind endpoint [P1, ПРИЧИНА С ВЫСОКОЙ УВЕРЕННОСТЬЮ] |
| V04-34 | Pending | NASA DONKI FLR: проверить ключ и реальный HTTP-ответ [P1, ДИАГНОЗ ЕЩЁ НЕ ПОДТВЕРЖДЁН] |
| V04-35 | Pending | Что такое проверка рабочей БД партнёрской регистрации [P1, ПРОВЕРИТЬ БЕЗ ЗАПИСИ РЕАЛЬНЫХ ДАННЫХ] |
| V04-36 | Pending | Тест настоящего письма и партнёрской заявки [P1, НУЖЕН РЕАЛЬНЫЙ АДРЕС ТОЛЬКО С СОГЛАСИЯ] |
| V04-37 | Pending | Отдельно отметить не связанные с v0.4 предупреждения [P2] |
| V04-38 | Pending | Сквозная визуальная и функциональная матрица [УТВЕРЖДЕНО] |
| V04-39 | Pending | Финальный отчёт Work и выпуск [УТВЕРЖДЕНО] |

## API implementation checkpoint

- Repository-root Docker build includes canonical `data/profile-stats.json` once at `/data/profile-stats.json`; no profile values or typology rules changed. Railway root directory must switch to `/` with this release. Health reports profile config readiness/count; init returns 503 for missing configuration, not misleading Unknown profile.
- NOAA live RTSW endpoint returned HTTP 200. Actual fields: active/source/time_tag/proton_speed/proton_density. Normalisation skips inactive/null/invalid records and preserves observation time and missing density. No fake zeros.
- NASA API key is present (name only). Direct DEMO_KEY FLR check returned HTTP 404; the endpoint remains in official docs. Existing configured-key runtime request will be observed in production; NOAA flare fallback and bounded key-free warning logging implemented. No key changes.
- Partner schema gets separate read-only catalog/constraints/index/privilege audit after startup schema verification; prints booleans and counts only, never personal records. Existing security tests remain required.
