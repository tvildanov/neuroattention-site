# Монада в личном кабинете NeuroAttention — план и статус

> **2026-08-15:** `/api/rhythm` на monad-server всё ещё 404 — это не поломка ключа.
> Живой ритм уже берётся с `/dashboard`. Задание для Тахира+Монады: `docs/MONAD-TAHIR-HANDOFF.md`.
> В ЛК — несколько чатов, вложения, закреплённый контекст; ответы ждут запись Манады в `shared_context`.


**Для:** Ник  
**Статус:** код вкладки готов · нужен ключ на Railway + миграция  
**Дата:** 2026-08-07

---

## 1. Что уже сохранено в Monad (доступ / задание)

Я вытащил из Monad вот что:

### Люди
| Человек в Monad | Роль | Сайт |
|-----------------|------|------|
| **nikita** (Никита Иванов / Nick) | founder, `access: full` | neuroattention.org |
| **nastya** | member (контур восприятия) | — |
| **takhir** | founder Monad | — |
| alisa, sofia, egor, artem | members | — |

### Ключ к Monad (уже есть в проекте)
- MCP-адрес: `https://monad-server-production.up.railway.app/mcp`
- Ключ из `AGENTS.md` (общий для агентов): `monad_IGcU7u8n…`  
  **На прод сайта его нельзя светить во фронте.** Положим в Railway как секрет `MONAD_API_KEY`.
- Дашборд Monad: https://monad-server-production.up.railway.app/dashboard
- У API сайта уже заготовка `MONAD_READONLY_TOKEN` — это обратное направление (Monad → читает сайт). Для вкладки нужно направление **сайт → Monad**.

### Задание-семя (от тебя, Ник)
В Monad лежат seeds `LK MONAD v0.2` / «страница MONAD»:

1. **Визуализация Vertical** — 7 ядер × 7 ветвей (49), зум  
2. **Визуализация Horizontal** — 12 персон + DOM в центре (12+1)  
3. **Пульс / ритм** — эквалайзер слоёв (circ, breath, heart, …)  
4. **Движение агентов** — пока Office Тахира; позже 3D-территория  
5. **Написать Манаде** — сообщение → plant_seed / send_message / handoff  

Права: вкладка у **superadmin/founder** всегда; остальным — галочка `monad_access` в Администрирование → Пользователи.

Спеки (в репо `tvildanov/monad`, не в site):  
`docs/monada-core/X-living-rhythm-architecture.md`, `XI-monad-ui-and-rhythm-viz.md`, `IV-layers-7x7.md`.

---

## 2. Что сделано на сайте (этот PR)

| Часть | Где |
|-------|-----|
| Вкладка **Монада** в ЛК | `account.html` — видна только founder/superadmin |
| Подокна Чат / Вертикаль / Горизонталь / Ритм | `assets/js/monad-lk.js` + CSS |
| API-прокси (ключ только на сервере) | `/api/monad/status`, `/agents`, `/humans`, `/architecture`, `/rhythm`, `/message`, `/link` |
| Клиент MCP | `api/services/monad.js` |
| Привязка профиля → human | `users.monad_human_id` (mig070) + карта email→human |
| Документация секрета | `api/.env.example`, этот файл |

Карта по умолчанию:
- `domunity@icloud.com` → `nikita`
- `tvildanov@mac.com` / `tyler@appliance-repair.me` → `takhir`
- Настя: пока нет email на сайте — после регистрации ей ставят `monad_human_id=nastya` (или скажи email — добавим в карту)

Чат шлёт `plant_seed` с `human_id` твоего профиля и тегами `neuroattention/lk`.

Ритм (2026-08-08): с dashboard берём **живой «Ритм системы»** (agent-ops).  
JSON `/api/rhythm` у Monad всё ещё 404. Слои circ/breath/heart в спеке XI — пока без live-данных (`n/a` во вкладке). Запрос JSON посажен в Monad.

---

## 3. Что нужно от тебя / Тахира (коротко)

1. **Railway → neuroattention-api → Variables**  
   Добавить:
   ```
   MONAD_API_KEY=monad_…   (тот же ключ из AGENTS.md или отдельный service-ключ)
   ```
   Опционально: `MONAD_MCP_URL=https://monad-server-production.up.railway.app/mcp`  
   **Запрос уже посажен в Monad** (seed `seed_msin6h2r_5e5bb7f0` → companion + handoff → `claude_cowork` на Маке Тахира).
2. После деплоя API один раз вызвать миграции:  
   `POST https://neuroattention-api-production.up.railway.app/api/run-migrations`
3. **Карта людей** (email сайта → human_id Monad) + галочка доступа в админке.
4. **Позже:** попросить Monad сделать JSON для ритма (вместо синтеза).

Если ключ уже стоит на Railway — напиши «ключ есть», проверю с прода.

---

## 4. Как будешь проверять

1. Войти суперадмином (`domunity@icloud.com`)  
2. Вкладка **Монада** видна  
3. Обычный клиент — вкладки нет  
4. В статус-баре: «ключ на сервере есть» + `human=nikita`  
5. Чат: отправить сообщение → «Семя посажено»  
6. Вертикаль / горизонталь / ритм — рисуются  

Баги из чеклиста смотрим после — как договорились.
