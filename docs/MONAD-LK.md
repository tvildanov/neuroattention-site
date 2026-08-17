# Монада в личном кабинете NeuroAttention — план и статус

> **2026-08-17:** Чат ЛК отвечает через **Persona человека** (`persona_<human_id>`), не через Telegram `companion` и не через Тахира.  
> Служебные ack («Канал ЛК живой», seed/handoff, «Отправлено Манаде…») **скрыты** и **не пишутся** сайтом.  
> Живой ответ = агент Манады вызывает `post_lk_chat_message` в тот же `chat_id`.

**Для:** Ник (super-admin) и любой пользователь с `monad_access`  
**Статус:** Persona-routing + тихий чат · ответ зависит от живых агентов Манады  
**Дата:** 2026-08-17

---

## 1. Архитектура ответа в ЛК

```
Человек (ЛК) → POST /api/monad/message
  → plant_seed (to_agent = persona_<human_id>, не companion)
  → send_message wake → persona + контур
  → в чате видно только текст человека
Агент Манады → post_lk_chat_message(chat_id, text, role=monad)
  → сайт poll (human_chat_poll) → пузырь Манады в том же чате
```

| Кто | Роль в ЛК-чате |
|-----|----------------|
| **Persona** (`persona_nikita`, `persona_nastya`, `persona_egor`…) | лицо Манады для этого человека |
| Контур (например `neuro_agent`, `cowork_neuro_site`) | помогает Persona ответить |
| **`companion`** | только Telegram Тахира — **не** лицо ЛК |
| Тахир / Никита как люди | **не** обязательные десайдеры на каждое сообщение ЛК |

Права на вкладку: founder/superadmin всегда; остальным — `monad_access` (+ опционально `monad_human_id`).

---

## 2. Что сделано на сайте

| Часть | Где |
|-------|-----|
| Вкладка **Монада** | `account.html` |
| UI чата (тихий, без ack) | `assets/js/monad-lk.js` |
| Несколько чатов, вложения | mig074 + `/api/monad/chats*` |
| Persona routing + wake | `POST /api/monad/message` |
| Фильтр channel-ack при poll | `isChannelAckText` в `api/services/monad.js` |
| Ритм | `/api/rhythm` (живой) + fallback dashboard |
| Карта email → human | `EMAIL_HUMAN_MAP` + `users.monad_human_id` |

Карта по умолчанию:
- `domunity@icloud.com` → `nikita` → `persona_nikita`
- `tvildanov@mac.com` / `tyler@appliance-repair.me` → `takhir`
- `nilta95@mail.ru` → `nastya`
- `mysolopoetry@proton.me` → `egor`
- Другие: Админка → Monad + `monad_human_id`

---

## 3. Что видит человек в чате

1. Своё сообщение — сразу.  
2. **Нет** пузыря «Отправлено Манаде. Ждём ответ…».  
3. **Нет** «Канал ЛК живой · seed=… · handoff=…» (если такие прилетели — скрыты под «Служебные сообщения»).  
4. Ответ Persona — обычный текст в том же чате, когда агент реально ответил.

«В каком чате?» — в **том же** треде ЛК, куда писал человек. Не в Telegram Тахира, не в другом аккаунте.

---

## 4. Секреты / Railway

```
MONAD_API_KEY=monad_…
# optional:
MONAD_MCP_URL=https://monad-server-production.up.railway.app/mcp
```

После деплоя API при необходимости: `POST …/api/run-migrations`.

---

## 5. Как проверять

1. Войти с `monad_access` (не только Ник).  
2. Новый чат → отправить вопрос.  
3. Видно только своё сообщение; служебного «ждём…» нет.  
4. Когда Persona онлайн и вызывает `post_lk_chat_message` — ответ в этом же чате.  
5. Hard-refresh (SW v69+).

Если ответа нет долго — это не «другой чат», а агент Манады ещё не написал в `post_lk_chat_message`. Сайт уже будит Persona; Тахира пинговать не нужно.
