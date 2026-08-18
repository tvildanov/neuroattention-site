# Монада в личном кабинете NeuroAttention — план и статус

> **2026-08-18:** Чат отвечает по смыслу (не шаблон «по этому сообщению»). Чаты можно переименовать и удалить. Вертикаль 7×7 / горизонталь 12+1 / живой ритм. Sketch 3D = тот же BodyAtlas. Вкладки на всю ширину.

**Для:** Ник (super-admin) и любой пользователь с `monad_access`

---

## Как понять, что задеплоилось

| Что | Как проверить |
|-----|----------------|
| **Pages (фронт)** | https://neuroattention.org/assets/js/monad-lk.js?v=11 — `last-modified` после мержа |
| **Railway (API)** | `curl https://neuroattention-api-production.up.railway.app/health` → `"lk_live_reply": true` |
| **В ЛК** | статус-бар: «Persona отвечает в этом чате» · SW `na-practices-v73` |

Pages уже жил после PR #153 (~17:49 UTC). API на Railway катится отдельно: пока нет `lk_live_reply`, новый фронт молчит, потому что Persona-демон не отвечает.

---

## Архитектура

```
Человек (ЛК) → POST /api/monad/message
  1. сразу пишет сообщение человека в БД
  2. generateLkReply (директория Манады + факты + опционально LLM)
  3. post_lk_chat_message + пузырь Persona в том же чате
  4. plant_seed в persona / persona_nal (журнал, не гейт ответа)
```

Цепь: human → persona_<id> → persona_nal → neuro_agent (этот API).  
`companion` = только Telegram Тахира.

---

## Что видит человек

1. Своё сообщение сразу (оптимистично).  
2. Ответ Persona в **этом же** чате, в том же ходе.  
3. Нет «Отправлено Манаде…» и нет seed/handoff.

---

## Секреты

```
MONAD_API_KEY=monad_…
# optional, richer replies:
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
```

Без LLM Persona всё равно отвечает по директории/фактам (кто ты, кто я, привет, контур).
