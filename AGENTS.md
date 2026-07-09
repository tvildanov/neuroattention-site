## Imported Claude Cowork project instructions

## ПРАВИЛО: Необратимые траты и физическая совместимость

*(расширение правила «never guess external interfaces — always return to
authoritative sources» на физический мир; канон: `~/.claude/CLAUDE.md`)*

Применяется к ЛЮБОЙ рекомендации, которая ведёт к: покупке, заказу,
поездке, резке/сверлению/монтажу или иному необратимому действию.

1. STOP-CHECK перед финальной рекомендацией. Перечислить ВСЕ точки
   физической совместимости (размеры, крепления, разъёмы, вентиляция,
   электрика, вес) и пометить каждую:
   [ПОДТВЕРЖДЕНО] — есть замер или официальный спек производителя;
   [ПРЕДПОЛОЖЕНИЕ] — вывод из «типичных размеров» или аналогий.
2. Хотя бы одно [ПРЕДПОЛОЖЕНИЕ] = покупка ЗАБЛОКИРОВАНА.
   Запросить недостающий замер или документ. Не давать финальную
   рекомендацию «бери X» на предположениях — только условную:
   «X подойдёт, ЕСЛИ подтвердится Y».
3. Совместимость проверять ТОЛЬКО по официальным источникам:
   installation manual, compatibility list, спецификация производителя.
   Обзоры, форумы и «обычно так» — не источник для решения о покупке.
4. До траты денег озвучить: стоимость ошибки (возврат возможен?
   restocking fee? повторная поездка?) и план Б.
5. Специально для замены встроенной (built-in) техники — ТРИ замера
   ДО покупки, это три РАЗНЫХ числа:
   a) проём ниши в мебели (Ш × В × Г);
   b) внутреннее окно рамки/trim/крепежа;
   c) лицевая панель и корпус нового устройства (по официальному спеку).
   Плюс: рамки/trim старше ~10 лет считать несовместимыми с новыми
   моделями по умолчанию, пока не доказано обратное.
6. Если пользователь предлагает «сэкономить» переиспользованием старой
   детали — прямо назвать риск и вероятность неудачи, а не поддерживать
   оптимистичный сценарий.

---

## MONAD Session Journal — ОБЯЗАТЕЛЬНО (закон Манады)

> Ни одно действие не исчезает. Любая сессия/агент/нейросеть, делавшая что-либо
> по этому проекту, оставляет протокол в Манаде.
> Полная спека: `read_context(key_prefix="monad.protocol.session_journal.v1")`.

**Slug этого проекта: `neuro`**

СТАРТ: `read_context(key_prefix="journal.neuro")` — прочитай, что делали до тебя
(плюс `monad.config.model_policy.v1` / snapshot / `get_inbox` по канону).

ФИНАЛ (обязательно, если что-то делал в сессии):
- **Есть MONAD MCP** (доступен `read_context`):
  1. `write_context(key="journal.neuro.latest", value=<report>, category="journal", importance=7, last_updated_by="<agent>")`
  2. `write_context(key="journal.neuro.<YYYYMMDD-HHMMSS>", value=<report>, category="journal", importance=4, ttl_hours=2160)`
  3. `log_action(agent_id, action_type="session_report", domain="neuro", action_details={"key":"journal.neuro.<ts>"})`
  4. Важные решения/состояние → `write_context` в стабильный доменный ключ (importance 8-9, без ttl).
- **Нет MONAD MCP** (ChatGPT, Cursor без MCP, любая другая нейросеть/человек):
  → допиши датированную запись в `JOURNAL.md` в корне проекта. Следующая
    MONAD-сессия синхронизирует её в `shared_context`.

Схема `<report>`: `{project, agent, at, did[], changed[], files[], decisions[], followups[], next_session}`

---

## Модель-политика и агенты этого репо (2026-07-09)

**Claude Code:** модель зафиксирована в `.claude/settings.json` → `claude-fable-5`
(brain-tier по требованию Тахира: задачи по сайту NeuroAttention разбирает Fable 5).
Не менять без согласования с Тахиром.

**Codex (OpenAI):** зарегистрирован в MONAD как агент `codex`
(домены: code, neuro_site; платформа codex_cli).

- API-ключ MONAD: `monad_IGcU7u8nFEVAMniO5l9X7ENvvxRyhOS1`
- MCP-хаб: `https://monad-server-production.up.railway.app/mcp` (header `X-API-Key`)
- Подключение в Codex CLI (`~/.codex/config.toml`):

```toml
[mcp_servers.monad]
url = "https://monad-server-production.up.railway.app/mcp"
http_headers = { "X-API-Key" = "monad_IGcU7u8nFEVAMniO5l9X7ENvvxRyhOS1" }
```

**Правила для Codex-сессий:**
1. СТАРТ: прочитай этот файл + `JOURNAL.md`; с MCP — `read_context("journal.neuro")`.
2. Ты исполнитель по коду. Стратегические/неоднозначные/архитектурные решения —
   НЕ решай сам: эскалируй к Fable 5 (`handoff_task` → `claude_cowork` с меткой
   `[ESCALATE→FABLE]`, или скажи Никите отдать вопрос Тахиру).
3. ФИНАЛ: запись в `JOURNAL.md` (или `write_context` если MCP подключён) —
   закон Манады, без исключений.
