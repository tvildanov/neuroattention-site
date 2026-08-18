# Монада в личном кабинете NeuroAttention — план и статус

> **2026-08-18:** Чат ЛК — живой собеседник Persona (модель + инструменты Манады), не FAQ. Вертикаль = канон `monad.spec.layers_7x7`. Sketch 3D = BodyAtlas.

**Для:** Ник (super-admin) и любой пользователь с `monad_access`

---

## Как понять, что задеплоилось

| Что | Как проверить |
|-----|----------------|
| **Pages (фронт)** | https://neuroattention.org/assets/js/monad-lk.js?v=14 — `last-modified` после мержа |
| **Railway (API)** | `curl https://neuroattention-api-production.up.railway.app/health` → `"lk_live_reply": true` и `"lk_llm": true` |
| **В ЛК** | статус-бар: «живая модель» · SW `na-practices-v76` |

`lk_llm: false` = на Railway API нет `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY`. Без ключа Persona не может говорить как модель — только заготовки. Ключ ставится на сервис **neuroattention-api**, не в Pages.

---

## Архитектура

```
Человек (ЛК) → POST /api/monad/message
  1. сразу пишет сообщение человека в БД
  2. generateLkReply = живая Persona:
       system_prompt агента + get_architecture + факты
       LLM с инструментами: get_architecture, read_context,
       resolve_person, get_user_facts, plant_seed, handoff_task
  3. пузырь Persona в том же чате (post_lk_chat_message)
  4. journal plant_seed (без повторного handoff, если Persona уже посадила работу)
```

Цепь ЛК (`monad.config.lk_site_routing.v1`): human → persona_<id> → persona контура/проекта → neuro_agent.  
`companion` = только Telegram Тахира, не этот чат.

Егор в этом окне работает с контент-фабрикой: Persona `persona_egor` говорит сама и сажает задачи в `persona_loom_house`. Не из Cursor.

### Вертикаль / горизонталь / ритм

Канон, не выдумка:

- слои: `monad.spec.layers_7x7.v0_1` — 49 постов `Li×Lj` (функции). Агенты из `monad.placement`.
- горизонталь: `monad.spec.circle12.slots.v0_1` + `monad.spec.ui.lk_monad_page.v0_2` — DOM в центре (проект), контуры ветвятся от людей, пустые часы 2/4/7/8/11 нажаты и пусты.
- ритм: `monad.spec.rhythm.v0_3` — пульс L1–L7 (физика / жизнь / ум), не биологический EEG.

**Контур** = группа агентов одного смысла (знание, контент/Loom, дизайн, маркетинг, инвестиции…).  
**Проект** = NAL, DOM, Be Hold, Vidas Neo… Контур ≠ проект ≠ слой вертикали.

---

## Что видит человек

1. Своё сообщение сразу (оптимистично).  
2. Ответ Persona в **этом же** чате, в том же ходе.  
3. Нет «Отправлено Манаде…» и нет seed/handoff.

---

## Секреты

```
MONAD_API_KEY=monad_…
ANTHROPIC_API_KEY=   # обязателен для живого собеседника в ЛК
# OPENAI_API_KEY=
# OPENROUTER_API_KEY=
# LK_LLM_MODEL=
```

Без ключа LLM Persona не может говорить как модель. Тогда честно пишет, что модели нет, а не меню вкладок. С ключом — полноценный собеседник: читает живой канон Манады, отвечает по смыслу, сажает задачи (Егор → Loom / persona_loom_house).
