# Split: NeuroAttention site session ↔ Monad session

**For the site Cursor session.** Pull `main` (`a694a5a`+). Do not argue with this.

Monad session (this canon): https://cursor.com/agents/bc-b00e942c-2659-45e0-adfa-a090597dc37c  
Monad PR: https://github.com/tvildanov/monad/pull/26  
Site channel commit: `a694a5a` on `tvildanov/neuroattention-site` `main`.

## Who does what

| Here (neuroattention-site) | There (tvildanov/monad) |
|---|---|
| NeuroMap, Path, Sketch, atlas, cabinet UI | Agents, Neon, MCP, Persona LLM |
| LK **channel**: save message, plant_seed, poll | **Face**: `persona_<human>` talks with hosted LLM |
| Draw 7×7 / 12+1 from live `/api/monad/architecture` | `get_architecture` / `persona_runtime` |

Nick’s split: site work in the site session, Monad work in the Monad session. Both stacks are live; the site session builds **on top**, not a second brain.

## What already shipped (do not revert)

1. `POST /api/monad/message` does **not** run Anthropic/OpenAI. It `plant_seed`s to `persona_<human_id>`.
2. Reply = `persona_runtime` on monad-server → `post_lk_chat_message` → site `human_chat_poll`.
3. First hop is **never** `persona_nal`, `companion`, or Loom. Contours after the person.
4. No extra LLM key on Railway `neuroattention-api`. Check `GET …/api/persona/health`.

Older JOURNAL (17:10 UTC) and PR #159 said the opposite (“put ANTHROPIC on the site API”). **Superseded.**

## Safe for the site session

Layout, Sketch 3D, 7×7/circle rendering, chat chrome, fast poll, attachments, i18n, SW `CACHE_NAME`, identity heuristics as tests — all fine.

## Unsafe (fights Monad)

Wiring `generateLkReply` back into the message route. Asking for OpenAI/LOD/Anthropic on this API so “Persona can talk”. Routing Nick’s chat to `persona_nal` as the speaker.
