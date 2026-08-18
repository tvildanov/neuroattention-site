# Монада в личном кабинете NeuroAttention — план и статус

> **2026-08-18:** Вертикаль читает канон `monad.spec.layers_7x7` (L1 Физика … L6 Знание … L7 Сверхсистема) и живую рассадку `monad.placement`. Не выдуманные «тело/эмоции». Чат отвечает по смыслу. Sketch 3D = BodyAtlas.

**Для:** Ник (super-admin) и любой пользователь с `monad_access`

---

## Как понять, что задеплоилось

| Что | Как проверить |
|-----|----------------|
| **Pages (фронт)** | https://neuroattention.org/assets/js/monad-lk.js?v=13 — `last-modified` после мержа |
| **Railway (API)** | `curl https://neuroattention-api-production.up.railway.app/health` → `"lk_live_reply": true` |
| **В ЛК** | статус-бар: «Persona отвечает в этом чате» · SW `na-practices-v75` |

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
# optional, richer replies:
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
```

Без LLM Persona всё равно отвечает по директории/фактам (кто ты, кто я, привет, контур).
