# DOM v0.4 implementation and release record

Source: full Package 04, 495 lines / 92971 bytes; SHA256 `4ea2bb4560078de0d861a4d901b3cfcd8066a67aa7a9a55482de93b338c402a3`. Attachment ID `libfile_ab53a7bed9188191b072e7ce360c2a14`. Read in full, sections 0–J and all 39 tasks.

Base: published v0.3 `d3c8cd516a654cfeac482b0c9ff82a6a65f6bc2a`. Separate branch `codex/dom-v04-review-20261117`. Parallel typology branch `codex/account-typology-audit-20261116` observed at `a376ecfeeb34010709d91515d3fcbd3fe74d6e22`; not merged or modified.

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
| V04-01 | PARTIAL | Аудит резкости всех важных медиа на сайте [УТВЕРЖДЕНО, P0] |
| V04-02 | PARTIAL | Не подменять первоисточник «оптимизированным» thumbnail [УТВЕРЖДЕНО, P0] |
| V04-03 | DONE | Исправить наложение вопроса на мозг [УТВЕРЖДЕНО, P1] |
| V04-04 | DONE | Убрать дополнительный огромный раскрывающийся блок опроса [УТВЕРЖДЕНО, P0] |
| V04-05 | DONE | У каждого списка — поле «Другое» без увеличения экрана [УТВЕРЖДЕНО, P1] |
| V04-06 | DONE | Высота и чекпоинт [УТВЕРЖДЕНО, P1] |
| V04-07 | DONE | Заголовок того же масштаба, что DOM Space [УТВЕРЖДЕНО, P1] |
| V04-08 | DONE | Увеличить круг примерно на 25–35%, расширяя влево и вверх [УТВЕРЖДЕНО: заметное увеличение; величину подобрать по вьюпорту, P1] |
| V04-09 | DONE | Подзаголовок и раскрываемые карточки: более крупно и плотнее [УТВЕРЖДЕНО, P1] |
| V04-10 | DONE | Светящийся следующий шаг должен быть виден сразу [УТВЕРЖДЕНО, P0] |
| V04-11 | DONE | Мост из карточки DOM к DOM Space: показать причинную связь [УТВЕРЖДЕНО ПО СМЫСЛУ; рабочая редакция, P1] |
| V04-12 | DONE | Композиция секции и служебные обозначения [УТВЕРЖДЕНО, P1] |
| V04-13 | DONE | Новые заголовки четырёх переключателей [ПРИНЦИП УТВЕРЖДЁН; редакция для внедрения, P1] |
| V04-14 | DONE | Готовый текст 01 — модель будущего мира [ПОДТВЕРЖДЁН СМЫСЛ; РЕКОМЕНДУЕМАЯ РЕДАКЦИЯ, P1] |
| V04-15 | DONE | Готовый текст 02 — инновационный реабилитационный комплекс [ПОДТВЕРЖДЁН СМЫСЛ; РЕКОМЕНДУЕМАЯ РЕДАКЦИЯ, P1] |
| V04-16 | DONE | Готовый текст 03 — кампус и лаборатории [ПОДТВЕРЖДЁН СМЫСЛ; РЕКОМЕНДУЕМАЯ РЕДАКЦИЯ, P1] |
| V04-17 | DONE | Готовый текст 04 — метод как фундамент всей среды [ПОДТВЕРЖДЁН СМЫСЛ; РЕКОМЕНДУЕМАЯ РЕДАКЦИЯ, P1] |
| V04-18 | DONE | «Пространства и форматы» — разделить инфраструктуру и виды опыта [УТВЕРЖДЕНО, P2] |
| V04-19 | DONE | Сохранить изображение и слегка приблизить текст [УТВЕРЖДЕНО, P2] |
| V04-20 | DONE | Институт: говорить о факультетах, не о безликих «направлениях» [УТВЕРЖДЕНО ПО ПОЗИЦИОНИРОВАНИЮ; НАЗВАНИЯ — РЕДАКЦИЯ, P1] |
| V04-21 | DONE | Содержательные описания шести карточек факультетов [СМЫСЛ УТВЕРЖДЁН; РЕКОМЕНДУЕМАЯ РЕДАКЦИЯ, P1] |
| V04-22 | DONE | Развернуть описание непосредственно поверх выбранной карточки [УТВЕРЖДЕНО, P0] |
| V04-23 | DONE | Каталог расширить через «Ещё направления» [УТВЕРЖДЕНО, P1] |
| V04-24 | DONE | Заголовок Institute & Lab [ОТКРЫТАЯ КОМПОЗИЦИЯ; РЕКОМЕНДАЦИЯ, P2] |
| V04-25 | DONE | Лаборатория: главный вопрос плюс четыре конкретных вызова [УТВЕРЖДЕНО, P1] |
| V04-26 | DONE | Вопрос 01 — старение: смело, конкретно, про полноценную жизнь [УТВЕРЖДЁН СМЫСЛ; РЕКОМЕНДУЕМЫЙ ТЕКСТ, P1] |
| V04-27 | DONE | Вопрос 02 — молодые люди: выйти из чужого сценария [УТВЕРЖДЁН СМЫСЛ; РЕКОМЕНДУЕМЫЙ ТЕКСТ, P1] |
| V04-28 | DONE | Вопрос 03 — ИИ как формирующаяся новая форма интеллекта [УТВЕРЖДЁН АВТОРСКИЙ ВЗГЛЯД; РЕКОМЕНДУЕМЫЙ ТЕКСТ, P1] |
| V04-29 | DONE | Вопрос 04 — бизнес: сохранить текущий или усилить без изменения смысла [ЧАСТИЧНО УТВЕРЖДЕНО, P1] |
| V04-30 | DONE | Одна общая CTA вместо нагромождения кнопок [УТВЕРЖДЕНО, P1] |
| V04-31 | DONE | Удалить декоративный публичный абзац о «четырёх приоритетах» [УТВЕРЖДЕНО, P1] |
| V04-32 | PENDING DEPLOY | `/data/profile-stats.json`: исправить доступность конфигурации профилей [P1, ТЕХНИЧЕСКИЙ ДЕФЕКТ ПОДТВЕРЖДЁН] |
| V04-33 | DONE | NOAA SWPC: убрать запрос к устаревшему solar-wind endpoint [P1, ПРИЧИНА С ВЫСОКОЙ УВЕРЕННОСТЬЮ] |
| V04-34 | PARTIAL | NASA DONKI FLR: проверить ключ и реальный HTTP-ответ [P1, ДИАГНОЗ ЕЩЁ НЕ ПОДТВЕРЖДЁН] |
| V04-35 | PENDING DEPLOY | Что такое проверка рабочей БД партнёрской регистрации [P1, ПРОВЕРИТЬ БЕЗ ЗАПИСИ РЕАЛЬНЫХ ДАННЫХ] |
| V04-36 | BLOCKED: authorised mailbox required | Тест настоящего письма и партнёрской заявки [P1, НУЖЕН РЕАЛЬНЫЙ АДРЕС ТОЛЬКО С СОГЛАСИЯ] |
| V04-37 | PENDING DEPLOY | Отдельно отметить не связанные с v0.4 предупреждения [P2] |
| V04-38 | PARTIAL | Сквозная визуальная и функциональная матрица [УТВЕРЖДЕНО] |
| V04-39 | PARTIAL | Финальный отчёт Work и выпуск [УТВЕРЖДЕНО] |

## API implementation checkpoint

- Repository-root Docker build includes canonical `data/profile-stats.json` once at `/data/profile-stats.json`; no profile values or typology rules changed. Railway root directory must switch to `/` with this release. Health reports profile config readiness/count; init returns 503 for missing configuration, not misleading Unknown profile.
- NOAA live RTSW endpoint returned HTTP 200. Actual fields: active/source/time_tag/proton_speed/proton_density. Normalisation skips inactive/null/invalid records and preserves observation time and missing density. No fake zeros.
- NASA API key is present (name only). Direct DEMO_KEY FLR check returned HTTP 404; the endpoint remains in official docs. Existing configured-key runtime request will be observed in production; NOAA flare fallback and bounded key-free warning logging implemented. No key changes.
- Partner schema gets separate read-only catalog/constraints/index/privilege audit after startup schema verification; prints booleans and counts only, never personal records. Existing security tests remain required.


## Recovery and verification — 17 November 2026

Recovered the interrupted work from three published feature commits (`af397df`, `ecb92e1`, `cc40405`) and draft PR #190. Main was still v0.3; no scratch recovery or reimplementation was necessary. Continued that exact feature branch at `b49933247650b5d1d040991697d0a13efe41d687`.

Fixed a real repeat-click defect: percentage-height faculty buttons could overlap their expanded body after reload. Buttons now have intrinsic height, with a separately sized close control. Also corrected the cover background selector specificity, restored selected CTA context after reload, and disabled the observation inputs when skipped. Main's existing v0.3 script URL uses `20261116-1`; this release uses `20261117-4`, and the corrected composition stylesheet uses `20261117-2`.

Local Chromium checks passed:
- 30 original narrative cases: RU/EN/ES × dark/light × 1440×900, 1366×768, 1280×720, 375×812, 320×740.
- 24 additional v0.4 cases: RU/EN/ES × dark/light × 1366×768 DPR1, 1920×1080 DPR1, 1440×900 DPR2, 375×812 DPR2. Stable observation height, ten choices/two optional local fields, reload/skip, all six faculty switches/repeat close/cross/Escape, all four Space and Lab narratives, no horizontal overflow or runtime errors. 72 screenshots and a machine-readable media inventory are emitted under `qa-v04`.
- All 12 XR hotspot checks in 12 locale/theme/desktop/mobile cases passed; scene composition and coordinates retained.
- Six partner browser scenarios passed against an isolated API fixture, including restored scroll position, interest transfer and history. These are not real email-delivery tests.
- CI API suites and the actual repository-root Docker image passed. Canonical profile content is checked by SHA256 inside the built image. No values in `data/profile-stats.json` were changed.

The full remote browser job additionally runs Firefox and WebKit. Its terminal result, publication and API runtime evidence are recorded below when observed.

## Media evidence and remaining source limitations

Physical source dimensions measured from local bytes, separately from browser `naturalWidth` (which is density-corrected when using width-descriptor srcsets). Representative displayed dimensions are from RU/light, 1440×900, DPR2. `qa-v04/report.json` contains the complete browser inventory for all 24 cases.

| File | Physical pixels / bytes | Displayed CSS pixels / currentSrc | Cause and result |
|---|---|---|---|
| theme/brain.webp | 1440×1440 / 46,732 | CSS background, matching file | Removed excessive 156% enlargement; corrected cascade to use 100%. Existing genuine source retained; no AI upscale or invented detail. |
| world-map.jpg | 864×1536 / 2,316,861 | 591×106 / same JPEG | Removed display filters. The original's narrow width cannot supply full desktop DPR2 detail; requires a higher-resolution original. |
| crowd-phones.jpg | 1440×1440 / 3,056,904 | 591×106 / same JPEG | Original source retained, no filter. |
| dom-xr-presence-brain-v3.jpg | 1774×887 / 478,351 | each full-image layer 1286×643, clipped to half / same JPEG | Restored original JPEG versus 170,626-byte WebP. Crop-aware `sizes`; all hotspots unchanged. Full Retina detail at this size still needs an original wider than 2572px. |
| dom-campus-original.jpg | 924×1536 / 462,975 | 457×760 / same JPEG | Original retained without filter; approximately matches DPR2 at this viewport. Larger displays still depend on source resolution. |
| theme/anatomical-presence-hd.webp | 935×1681 / 243,568 | 462×830 / same WebP | Existing high-resolution full silhouette retained, with established theme tint. No crop or enlargement of the original. |
| media/drop-ripple.mp4 | 320×320 / 25 fps | replaced at display size by DPR-aware native canvas | Resolution-independent point field, original video retained as fallback when canvas is unavailable. Reduced motion is static; animation stops offscreen/hidden. |

V04-01/02 remain PARTIAL because no higher-resolution historical source was found for the limiting media, and a blanket claim of restored Retina detail would be inaccurate. Before/after source byte/dimension comparison is documented; no historical full-screen screenshot baseline is claimed. V04-24 retains the unified Institute & Lab heading; the split title was optional.

## External sources and partner verification

- Live NOAA RTSW returned HTTP 200 with 4,208 rows / 1,436 active samples at inspection. Its actual object fields include time_tag, active, source, proton_speed and proton_density. Inactive/null/invalid values are skipped; original observation timestamps retained. Official source: https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json .
- NASA_API_KEY is present in the service variable-name inventory; its value was neither displayed nor changed. FLR remains a documented endpoint at https://api.nasa.gov/ . Key-specific response-body diagnosis from inside the container remains unverified. The tested NOAA flare fallback and bounded key-free warnings isolate upstream failures from API availability.
- No production user applications, personal email messages, roles or typology calculations were changed by QA. Runtime catalog audit is read-only, emits only aggregate booleans/counts, and complements isolated permission tests. It is not proof of real mailbox delivery.
- V04-36 remains BLOCKED until an authorised team test mailbox is supplied for OTP delivery and a real consented test application. No personal mailbox or real-user application was used.

## Deployment evidence

Pending terminal GitHub Pages / Railway results. Do not interpret this pre-release section as a claim of publication.
