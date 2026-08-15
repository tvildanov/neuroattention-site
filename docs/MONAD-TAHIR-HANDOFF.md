# Задание для Тахира + Монады — живой ритм и живой чат с сайта

**От:** Ник / NeuroAttention site  
**Кому:** Тахир + агенты Monad (companion / claude_cowork / monad-server)  
**Дата:** 2026-08-15  
**Зачем:** чтобы во вкладке «Монада» на https://neuroattention.org были **реальные** показатели и **настоящий диалог**, а не односторонняя отправка «семени».

---

## 1. Коротко: что уже работает, а что нет

| Что | Сейчас | Нужно |
|-----|--------|--------|
| Ключ `MONAD_API_KEY` на Railway (neuroattention-api) | ✅ есть (`/health` → `monad_configured: true`) | держать |
| Отправка из ЛК → Monad | ✅ `plant_seed` через MCP | оставить + привязка к чату |
| «Ритм» на сайте | ✅ берём **живой** статус с `/dashboard` («Ритм системы»: harmonic/drifting/…) | плюс нормальный JSON |
| `GET https://monad-server-production.up.railway.app/api/rhythm` | ❌ **404** | сделать JSON API |
| Био-слои circ / breath / heart | ❌ в данных нет → на сайте `n/a` | либо отдать live, либо честно сказать «не измеряем» |
| Ответ Манады обратно в ЛК | ❌ нет канала «human inbox» | нужен (см. §3) |

**Про 404 простыми словами:**  
сайт умеет говорить с Манадой (ключ ок). Но отдельной «ручки» `/api/rhythm` на сервере Манады **нет** — поэтому если кто-то дергает именно её, получает 404. Мы обходим это парсингом дашборда. Это костыль. Нужен нормальный JSON.

---

## 2. Задача A — JSON ритма (вместо 404)

Сделать на **monad-server**:

```
GET /api/rhythm
Header: X-API-Key: <тот же ключ / service key>
```

Ответ (пример — можно расширить, поля со звёздочкой желательны):

```json
{
  "ok": true,
  "updated_at": "2026-08-15T16:00:00Z",
  "system": {
    "status": "harmonic",
    "window_minutes": 60,
    "agents_in_window": 6,
    "collisions_per_hour": 12,
    "meta": "окно: 60 мин · агентов: 6 · …"
  },
  "agents": [
    {
      "agent_id": "companion",
      "actions_per_min": 1.2,
      "expected_per_min": 1.0,
      "drift": "ok",
      "last_seen": "12s",
      "err_rate": "0%"
    }
  ],
  "layers": [
    { "id": "agent", "level": 0.82, "available": true },
    { "id": "social", "level": 0.71, "available": true },
    { "id": "action", "level": 0.66, "available": true },
    { "id": "ultradian", "level": 0.55, "available": true },
    { "id": "metab", "level": 0.60, "available": true },
    { "id": "circ", "level": null, "available": false },
    { "id": "breath", "level": null, "available": false },
    { "id": "heart", "level": null, "available": false }
  ]
}
```

Правила:
1. `system.status` = тот же, что бейдж на `/dashboard` (harmonic / drifting / dissonant / silence).
2. Если био-слоёв нет — `available: false`, `level: null` (не выдумывать цифры).
3. Когда появятся реальные circ/breath/heart — просто заполнить `level` и `available: true`.
4. Авторизация: тот же `X-API-Key`, что MCP.

Сайт уже пробует этот URL первым и при 200 переключится сам (код в `api/services/monad.js` → `getRhythm()`).

---

## 3. Задача B — живой диалог сайт ↔ Манада

Сейчас из ЛК уходит только `plant_seed` (одностороння «посади задачу»). Для чата как в Claude/ChatGPT нужно:

### B1. Ответы писать обратно в shared_context

Когда агент отвечает на семя из ЛК (теги содержат `neuroattention` + `lk` + `chat:<uuid>`):

```
write_context
  key: neuroattention.lk.chat.<chat_uuid>.msg.<iso_or_id>
  category: lk_chat
  importance: 6
  visibility: all   (или personal slice user.<human_id>.*)
  last_updated_by: <agent_id>
  value: {
    "chat_id": "<uuid>",
    "role": "monad",
    "text": "текст ответа человеку",
    "seed_id": "<optional>",
    "human_id": "nikita|nastya|…",
    "at": "ISO-8601"
  }
```

Сайт будет опрашивать:

```
read_context
  key_prefix: neuroattention.lk.chat.<chat_uuid>.
  category: lk_chat
```

и показывать ответы в нужном чате.

### B2. (Лучше) отдельный MCP-tool для ЛК

Желательно добавить tool, например:

`human_chat_poll`  
вход: `{ human_id, chat_id?, since? }`  
выход: список новых сообщений для человека.

или HTTP:

```
GET /api/human/<human_id>/chat/<chat_id>/messages?since=...
```

### B3. project_id = чат

Сайт шлёт в `plant_seed`:
- `project_id`: `lk-chat-<short>`
- `tags`: `["neuroattention","lk","from_cabinet","chat:<uuid>"]`
- в `description` — текст + ссылки на вложения

Манада: при ответе **сохранять тот же chat_id / project_id**.

---

## 4. Задача C — что проверить руками (15 минут)

1. `curl -H "X-API-Key: …" https://monad-server-production.up.railway.app/api/rhythm` → **200 + JSON**, не 404.  
2. С сайта (вкладка Монада) написать сообщение → семя видно в dashboard / inbox агента.  
3. Агент отвечает через `write_context` по схеме B1 → через ~минуты ответ появляется в том же чате на сайте.  
4. Ритм во вкладке «Ритм» совпадает с дашбордом Манады.

---

## 5. Что делает сайт сам (не нужно Тахиру)

- Несколько чатов/задач в ЛК (как в Claude).  
- Прикрепление сохранённого контекста к чату.  
- Вложения файлов/картинок к сообщению (R2).  
- `plant_seed` с `project_id` + tags `chat:<id>`.  
- Опрос `read_context` по префиксу чата.

---

## 6. Контакты / где код сайта

- Репо: `tvildanov/neuroattention-site`  
- Прокси: `api/services/monad.js`, `assets/js/monad-lk.js`, `/api/monad/*`  
- Прод API: `https://neuroattention-api-production.up.railway.app`  
- Monad: `https://monad-server-production.up.railway.app`

Когда A+B готовы — напишите Нику «ритм JSON готов / ответы в context готовы» — сайт уже умеет подхватить.
