# Монада в личном кабинете NeuroAttention — план и статус

> **2026-08-18:** Вертикаль читает канон `monad.spec.layers_7x7` (L1 Физика … L6 Знание … L7 Сверхсистема) и живую рассадку `monad.placement`. Не выдуманные «тело/эмоции». Чат отвечает по смыслу. Sketch 3D = BodyAtlas.

**Для:** Ник (super-admin) и любой пользователь с `monad_access`

---

## Как понять, что задеплоилось

| Что | Как проверить |
|-----|----------------|
| **Pages (фронт)** | https://neuroattention.org/assets/js/monad-lk.js?v=12 — `last-modified` после мержа |
| **Railway (API)** | `curl https://neuroattention-api-production.up.railway.app/health` → `"lk_live_reply": true` |
| **В ЛК** | статус-бар: «Persona отвечает в этом чате» · SW `na-practices-v74` |

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

### Вертикаль (не выдумывать имена)

Канон: `monad.spec.layers_7x7.v0_1`. Рассадка: `monad.placement.<agent>.v1.cell`.

| Слой | Имя | Посты |
|------|-----|--------|
| L1 | Физика | L1×L1 … L1×L7 |
| L2 | Энергия | L2×L1 … L2×L7 |
| L3 | Личность (человеческие Персоны на L3×L3) | L3×L1 … L3×L7 |
| L4 | Мы / Дом | L4×L1 … L4×L7 |
| L5 | Восприятие ↔ проявление | L5×L1 … L5×L7 |
| L6 | Знание | L6×L1 … L6×L7 |
| L7 | Сверхсистема | L7×L1 … L7×L7 |

Эмоций в Манаде нет. Контур — группировка проектов у человека, не слой. Не все персоны на L5.

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
