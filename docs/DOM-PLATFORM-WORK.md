# DOM Platform — рабочий реестр и координация выпусков

Обновлено: 21 ноября 2026, America/Cancun. Владелец разрешил публикацию аудита и начало реализации, с сохранением параллельных правок.

## Текущий пакет

Ветка `platform/recording-foundation`: подтверждённая персональная запись, исходник, история, короткий ввод, безопасный повтор; затемнение/светлая тема и доступность форм. Дополнительно серверные проверки миграций, доступа к курсу и RTC-комнате.

Общие файлы: `account.html`, `api/server.js`, `assets/js/dom-cabinet-v07.js`, `assets/js/evolution-path.js`, `sw.js`, тестовая фикстура и cabinet workflow. Новые модули изолированы: `api/services/dom-observations.js`, `assets/js/dom-recording.js`, `assets/dom-recording.css`.

Перед работой в другой ветке перечитать этот реестр и актуальный main. Не копировать целиком старые account.html, сервер или словари поверх новых файлов. Косметические изменения по возможности выносить в отдельные CSS/JS-модули и сохранять новым diff.

## Перед каждым выпуском

1. Проверить main и открытые PR, включая работу над типированием и интерфейсом DOM-агента. Чужие незавершённые ветки не вливать автоматически.
2. Подтянуть свежую базу в свой worktree. Сохранить обе независимые правки; после разрешения конфликтов повторить относящиеся к ним проверки.
3. Проверить, нет ли идущего выпуска Pages/Railway. Выпускать последовательно; main обновлять без force push и с проверкой ожидаемого SHA.
4. Зафиксировать commit/PR, пройденные проверки и ограничения. Для API дождаться SUCCESS нужного коммита в Railway; SKIPPED не называть новым деплоем API. Для фронтенда отдельно проверить Pages и опубликованные файлы.
5. После выпуска обновить статус здесь и в JOURNAL.md. Общая тема и служебный кэш не должны возвращаться из старой копии.

Это рабочий протокол, а не техническая блокировка: отдельные чаты не видят друг друга автоматически. Открытый PR и этот файл служат общей точкой сверки. Чужая ветка с незаписанными изменениями не может быть обнаружена надёжно.

## Границы первого пакета

Новый endpoint обслуживает личные наблюдения. Семейные/dependent-формы пока используют прежний маршрут с ожиданием подтверждения; полная идемпотентность для него не заявляется. Курсы продолжают пользоваться прежними блоками; повторные попытки практик — отдельный следующий пакет. Типология, ассеты анатомии, провайдеры устройств и XR-runtime не заменяются этим выпуском.

Исходная запись и её производные представления сохраняются транзакционно. Сервер хранит ID операции и возвращает прежний результат повтора. Неподтверждённый запрос сохраняется в sessionStorage текущей вкладки в области пользователя; это не резервная копия при закрытии вкладки или потере устройства. История показывает 50 новых записей; прежние доступны прежними представлениями.

Аудит включён в объединённый PR #212; отдельный PR #209 закрыт как заменённый. Дальнейшие пакеты: `docs/platform-audit/README.md` и `BACKLOG-RU.md`.


## 2026-11-21 — Verified observation foundation release

PR #212 merged as `e3cc703ccb8356c8cf4cc91bbecab40dc3f6cdfb`. API shipped first as `e708c05ea4334aa45f177615c8c77bc8c1c6b210`: Railway deployment `18c5f697-4201-4776-b72e-1602d3b6f2cf` SUCCESS. The frontend merge deployment `cd07c8e2-667b-4e9e-b43b-80c957b8fbb1` was SKIPPED because the watched API source was already live; it is not a second API release. Pages run `44962277665` SUCCESS. Published account.html, recording JS/CSS, social JS and service-worker Git blob hashes match the merge commit.

Candidate `bb261de0adc1e19d1971388b079556ec61e43659` passed Actions `44961615868`, `44961615900`, `44961615933`: observations x20 retry/rollback/access matrix, lost-ack/reload browser retry, RU/EN/ES responsive themes, existing cabinet/NeuroMap/social/Monad regression and container checks. Live ordinary test USER smoke: one explicitly synthetic short record, acknowledged source dialog, unknown intensity, reload, one retained history row, original reopened, Path workspace navigation. No faults were injected into production. API health 200, unauthenticated observations 401. PR #209 closed as superseded; its audit is included in #212.

This completes the first personal recording foundation, not the whole premium platform. Next: package D list/inspector/map navigation, then practice-to-result loop E. Family idempotency, paid user walkthrough, real devices and XR remain open. Preserve the parallel staff-guide/social work from #211, typology and current main; coordinate through docs/DOM-PLATFORM-WORK.md. The protocol is not an automatic lock between chats.
