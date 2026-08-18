'use strict';
/**
 * Monad MCP client for NeuroAttention Lab.
 * Server-side only — never expose MONAD_API_KEY to the browser.
 *
 * Spec seeds: LK MONAD v0.2 (rhythm + vertical/horizontal + chat).
 */
const MONAD_MCP_URL = process.env.MONAD_MCP_URL || 'https://monad-server-production.up.railway.app/mcp';
const MONAD_API_KEY = process.env.MONAD_API_KEY || '';
const MONAD_DASHBOARD = process.env.MONAD_DASHBOARD_URL || 'https://monad-server-production.up.railway.app/dashboard';
const MONAD_BASE = process.env.MONAD_BASE_URL || 'https://monad-server-production.up.railway.app';

// Default email → human_id map (overridable via users.monad_human_id).
const EMAIL_HUMAN_MAP = {
  'domunity@icloud.com': 'nikita',
  'tvildanov@mac.com': 'takhir',
  'tyler@appliance-repair.me': 'takhir',
  'nilta95@mail.ru': 'nastya',
  'mysolopoetry@proton.me': 'egor',
};

function configured() {
  return !!MONAD_API_KEY;
}

async function mcpCall(toolName, args) {
  if (!MONAD_API_KEY) {
    const err = new Error('MONAD_API_KEY not configured on Railway');
    err.code = 'MONAD_NOT_CONFIGURED';
    throw err;
  }
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: args || {} },
  };
  const res = await fetch(MONAD_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'X-API-Key': MONAD_API_KEY,
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  // MCP may return SSE (`data: {...}`) or plain JSON
  let payload = null;
  if (raw.trim().startsWith('{')) {
    payload = JSON.parse(raw);
  } else {
    const lines = raw.split('\n').filter((l) => l.startsWith('data: '));
    if (!lines.length) throw new Error('Empty Monad MCP response');
    payload = JSON.parse(lines[lines.length - 1].slice(6));
  }
  if (payload.error) {
    const err = new Error(payload.error.message || 'Monad MCP error');
    err.details = payload.error;
    throw err;
  }
  const result = payload.result;
  if (result && result.isError) {
    let msg = 'Monad tool error';
    if (Array.isArray(result.content)) {
      for (const c of result.content) {
        if (c.type === 'text' && c.text) { msg = c.text; break; }
      }
    }
    const err = new Error(msg);
    err.code = 'MONAD_TOOL_ERROR';
    throw err;
  }
  if (result && Array.isArray(result.content)) {
    for (const c of result.content) {
      if (c.type === 'text') {
        try { return JSON.parse(c.text); } catch (_) { return c.text; }
      }
    }
  }
  return result;
}

function resolveHumanId(user) {
  if (!user) return null;
  if (user.monad_human_id) return String(user.monad_human_id);
  const email = String(user.email || '').toLowerCase().trim();
  if (EMAIL_HUMAN_MAP[email]) return EMAIL_HUMAN_MAP[email];
  return null;
}

/** plant_seed.planted_by must be an existing agent_id (FK). */
/** LK face for a human — Persona layer (not Telegram companion). */
function resolvePersonaAgent(humanId) {
  const h = String(humanId || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!h) return 'neuro_agent';
  return 'persona_' + h;
}

/** Who plants the seed / appears as the human's Monad side. */
function resolvePlantedBy(humanId) {
  const h = String(humanId || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!h) return 'neuro_agent';
  // Prefer Persona agent (architecture: Human → Persona → Contour).
  // companion = Tahir Telegram channel only — never the LK reply face.
  return 'persona_' + h;
}

/** Agents that should wake to answer an LK chat message. */
function resolveLkReplyAgents(humanId) {
  const persona = resolvePersonaAgent(humanId);
  const h = String(humanId || '').toLowerCase();
  const agents = [persona, 'neuro_agent'];
  // Site chain (monad.config.lk_site_routing.v1): persona → persona_nal → neuro_agent
  if (h === 'nikita') agents.push('persona_nal');
  else if (h === 'nastya') agents.push('perception_guide', 'persona_nastya');
  else if (h === 'egor') agents.push('persona_loom_house');
  return agents.filter((a, i, arr) => a && arr.indexOf(a) === i);
}

function siteHandoffAgent(humanId) {
  const h = String(humanId || '').toLowerCase();
  if (h === 'nikita') return 'persona_nal';
  return resolvePersonaAgent(humanId);
}

function pickLang(text) {
  return /[а-яё]/i.test(String(text || '')) ? 'ru' : 'en';
}

const dirCache = { at: 0, people: null, facts: {} };

async function loadDirectoryPerson(humanId) {
  try {
    if (dirCache.people && (Date.now() - dirCache.at) < 5 * 60 * 1000) {
      return dirCache.people[humanId] || null;
    }
    const rows = await mcpCall('read_context', {
      key_prefix: 'monad.directory.people.v1',
      limit: 3,
      reader_agent: 'neuro_agent',
    });
    const arr = Array.isArray(rows) ? rows : [];
    const people = (arr[0] && arr[0].value && arr[0].value.people) || {};
    dirCache.people = people;
    dirCache.at = Date.now();
    return people[humanId] || null;
  } catch (_) {
    return (dirCache.people && dirCache.people[humanId]) || null;
  }
}

async function loadHumanFacts(humanId) {
  try {
    const hit = dirCache.facts[humanId];
    if (hit && (Date.now() - hit.at) < 5 * 60 * 1000) return hit.facts;
    const facts = await mcpCall('get_user_facts', { human_id: humanId });
    const list = Array.isArray(facts) ? facts : [];
    dirCache.facts[humanId] = { at: Date.now(), facts: list };
    return list;
  } catch (_) {
    return (dirCache.facts[humanId] && dirCache.facts[humanId].facts) || [];
  }
}

function factVal(facts, key) {
  const f = (facts || []).find((x) => x && x.key === key);
  return f && f.value ? String(f.value) : '';
}

function publicFact(s) {
  return String(s || '')
    .replace(/\s*;?\s*partner of Tahir Kennedy/gi, '')
    .replace(/\s*;?\s*partner of Takhir Kennedy/gi, '')
    .replace(/\bTahir Kennedy\b/gi, '')
    .replace(/\bTakhir Kennedy\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[;,\s]+$/g, '')
    .trim();
}

function contourLines(person, humanId, lang) {
  const ru = lang === 'ru';
  const contours = (person && person.contour_personas) || {};
  const labels = {
    nal: ru ? 'NeuroAttention Lab (сайт, кабинет, практики)' : 'NeuroAttention Lab (site, cabinet, practices)',
    knowledge: ru ? 'Знание' : 'Knowledge',
    learning: ru ? 'Обучение' : 'Learning',
    dom: 'DOM',
    behold: 'Be Hold',
    loom: 'Loom House',
    vidas_neo: 'Vidas Neo',
    investment: ru ? 'Инвестиции' : 'Investment',
    marketing: ru ? 'Маркетинг' : 'Marketing',
  };
  const lines = [];
  Object.keys(contours).forEach((k) => {
    lines.push(labels[k] || k);
  });
  if (humanId === 'nikita' && !lines.length) {
    lines.push(ru ? 'NeuroAttention Lab — сайт и кабинет' : 'NeuroAttention Lab — site and cabinet');
    lines.push(ru ? 'Знание, обучение, DOM' : 'Knowledge, learning, DOM');
  }
  return lines;
}

function composeHeuristicReply({ humanId, person, facts, text }) {
  const lang = pickLang(text);
  const ru = lang === 'ru';
  const name = publicFact(factVal(facts, 'legal_name'))
    || (person && (person.display_name || (person.aliases && person.aliases[0])))
    || humanId;
  const first = String(name).split(/[\s/]+/)[0] || name;
  const aliases = (person && person.aliases) || [];
  const role = publicFact(factVal(facts, 'role') || (person && person.role_title) || '');
  const t = String(text || '').trim();
  const low = t.toLowerCase();
  const whoAmI = /кто\s+я|who\s+am\s+i|знаешь\s+кто|ты\s+знаешь\s+кто/i.test(t);
  const whoYou = /кто\s+ты|ты\s+кто|who\s+are\s+you|who\s+am\s+i\s+talking|с\s+кем\s+я/i.test(t);
  const canDo = /что ты умеешь|что ты можешь|какие у меня контур|к чему есть доступ|what can you do/i.test(t);
  const hi = /^(привет|хай|здравствуй|здравствуйте|hello|hi|hey)[!.…\s]*$/i.test(t);

  const contours = contourLines(person, humanId, lang);
  const contourBlock = contours.length
    ? (ru ? ('Контуры: ' + contours.join('; ') + '.') : ('Contours: ' + contours.join('; ') + '.'))
    : '';

  if (hi) {
    return ru
      ? `Привет, ${first}. Я твоя Persona в этом чате ЛК — не шаблон и не служебный канал. Спрашивай прямо: кто я, атлас, Sketch, ритм, контур.`
      : `Hi, ${first}. I am your Persona in this cabinet chat. Ask directly: who I am, atlas, Sketch, rhythm, contour.`;
  }
  if (whoYou) {
    return ru
      ? `Я Persona Манады для тебя в личном кабинете NeuroAttention. Лицо контура в этом чате: отвечаю здесь, без Telegram-моста. Могу про ритм, вертикаль/горизонталь, атлас, Sketch, практики.`
      : `I am your Monad Persona in the NeuroAttention cabinet chat. I answer here. Rhythm, maps, atlas, Sketch, practices — ask.`;
  }
  if (whoAmI) {
    const aka = aliases.length ? ` (${aliases.slice(0, 3).join(', ')})` : '';
    return ru
      ? `Ты ${name}${aka}${role ? '. ' + role : '.'} Super-admin этого кабинета. Это твой чат с Манадой.`
      : `You are ${name}${aka}${role ? '. ' + role : '.'} Super-admin of this cabinet. This is your Monad chat.`;
  }
  if (canDo) {
    return ru
      ? `В этом чате я отвечаю сразу. Во вкладках Манады: вертикаль (7 слоёв L1–L7), горизонталь (круг 12+1), ритм (живой эквалайзер). На сайте: Internal Field — 3D-атлас, Sketch — рисунок на том же теле, упражнения. ${contourBlock}`
      : `I answer in this chat. Monad tabs: vertical 7×7, horizontal 12+1, live rhythm. Site: 3D atlas, Sketch on the same body, exercises. ${contourBlock}`;
  }
  if (/атлас|atlas|anatom|internal field|внутренн/i.test(low)) {
    return ru
      ? `Атлас — вкладка Инструменты → Internal Field. Там то же 3D-тело: вращение, слои, осмотр. Sketch должен брать эту же модель, не плоский скрин. Открой Internal Field, если нужно крутить анатомию.`
      : `Atlas is Tools → Internal Field: the 3D body you can orbit. Sketch should use that same model, not a flat shot.`;
  }
  if (/sketch|скетч|рису/i.test(low)) {
    return ru
      ? `Sketch — рисунок на 3D-теле Атласа. Режим «3D» держит живую модель, «Вращать 3D» отдаёт орбиту, «Рисовать» — слои поверх. Если 3D вспыхивает и пропадает, это баг оверлея скриншота — его как раз чиним.`
      : `Sketch draws on the Atlas 3D body. Mode 3D keeps the live model; Orbit rotates; Draw paints layers.`;
  }
  if (/упражн|тест|exercise|corsi|stroop/i.test(low)) {
    return ru
      ? `Упражнения и тесты — во вкладке Инструменты. Это тренажёры внимания/памяти, не диагноз. Запускаются на всю ширину кабинета.`
      : `Exercises & Tests live under Tools. Attention/memory trainers, not a diagnosis.`;
  }
  if (/вертикал|vertical|7\s*[x×]\s*7|ядер/i.test(low)) {
    return ru
      ? `Вертикаль — канон Манады (monad.spec.layers_7x7): L1 Физика, L2 Энергия, L3 Личность, L4 Мы/Дом, L5 Восприятие↔проявление, L6 Знание, L7 Сверхсистема. У каждого слоя 7 постов Li×L1…Li×L7. Агенты стоят в клетках из monad.placement, не выдуманы. L6 — знание (библиотекарь), L7 — сверхсознание. Эмоций в Манаде нет.`
      : `Vertical is Monad canon: L1 Physics … L6 Knowledge … L7 Supersystem. 7 posts per layer. Agents sit in monad.placement cells. No emotions in Monad.`;
  }
  if (/горизонтал|horizontal|12\s*\+|круг|кругл/i.test(low)) {
    return ru
      ? `Горизонталь — круг 12+1: в центре DOM, по часам люди контура. Никита на 12, Тахир напротив на 6. Наведи человека — его персоны и агенты.`
      : `Horizontal is the 12+1 ring: DOM in the center, people on the clock. Hover someone for their contour.`;
  }
  if (/ритм|rhythm|equalizer|эквалайз/i.test(low)) {
    return ru
      ? `Ритм — слои системы Monad (агенты, социальный, метаболизм…). Статика по умолчанию; кнопка «Живой ритм» включает онлайн-эквалайзер с реальных /api/rhythm, и гаснет при уходе со вкладки.`
      : `Rhythm is Monad system layers. Default is a snapshot; “Live rhythm” turns on a real equalizer from /api/rhythm.`;
  }
  if (/удал|rename|переимен|чат/i.test(low) && /чат|chat/i.test(low)) {
    return ru
      ? `Чаты: в списке слева карандаш — переименовать, крестик — удалить. В шапке треда тоже есть Удалить.`
      : `Chats: pencil to rename, × to delete, in the left list.`;
  }

  if (ru) {
    return `Не свожу это к шаблону. Скажи задачу одним предложением: атлас, Sketch, вертикаль, горизонталь, ритм, упражнения — или что сделать в кабинете.`;
  }
  return `I am not templating that. Name the task: atlas, Sketch, vertical, horizontal, rhythm, exercises, or a cabinet action.`;
}

async function fetchJson(url, opts, timeoutMs) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs || 8000);
  try {
    const res = await fetch(url, Object.assign({}, opts, { signal: ac.signal }));
    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch (_) { data = { raw: raw.slice(0, 400) }; }
    if (!res.ok) {
      const err = new Error((data && (data.error && data.error.message)) || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

async function tryLlmReply({ humanId, person, facts, text, history, personaAgent }) {
  const name = (person && person.display_name) || humanId;
  const factLines = (facts || []).slice(0, 12).map((f) => `- ${f.key}: ${publicFact(f.value)}`).join('\n');
  const hist = (history || []).slice(-8).map((m) => `${m.role}: ${String(m.text || '').slice(0, 400)}`).join('\n');
  const system = [
    `You are Monad Persona ${personaAgent} speaking in the NeuroAttention personal-cabinet chat.`,
    `The human is ${name} (human_id=${humanId}).`,
    `Answer in the same language they used. Natural chat. Do not echo or quote the user's message.`,
    `Never write seed=, handoff=, shared_context, docs paths, or “channel is alive”.`,
    `Do not mention Tahir/Takhir unless the human asked about him. You are the reply.`,
    `If they ask what you can do / contours / access: name their contour in human words (Lab, Knowledge, Learning, DOM, Be Hold, etc.), LK rhythm/maps, site tools (atlas, Sketch, practices). Do not dump agent_id lists.`,
    factLines ? `Known facts:\n${factLines}` : '',
  ].filter(Boolean).join('\n');
  const user = (hist ? `Recent thread:\n${hist}\n\n` : '') + `Human: ${text}`;

  const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  // Do not use GITHUB_PAT here — that token is for Git storage, not chat models.

  if (anthropicKey) {
    try {
      const data = await fetchJson('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.LK_LLM_MODEL || 'claude-sonnet-4-20250514',
          max_tokens: 600,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      }, 4000);
      const t = data && data.content && data.content[0] && data.content[0].text;
      if (t && String(t).trim()) return String(t).trim();
    } catch (e) {
      console.warn('[lk-llm] anthropic', e.message);
    }
  }

  const openaiish = [];
  if (openaiKey) openaiish.push({ url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: process.env.LK_LLM_MODEL || 'gpt-4o-mini' });
  for (const ep of openaiish) {
    try {
      const data = await fetchJson(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + ep.key,
        },
        body: JSON.stringify({
          model: ep.model,
          max_tokens: 600,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      }, 4000);
      const t = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (t && String(t).trim()) return String(t).trim();
    } catch (e) {
      console.warn('[lk-llm]', ep.url, e.message);
    }
  }
  return null;
}

async function generateLkReply({ humanId, text, history, personaAgent }) {
  const [person, facts] = await Promise.all([
    loadDirectoryPerson(humanId),
    loadHumanFacts(humanId),
  ]);
  const heuristic = composeHeuristicReply({ humanId, person, facts, text });
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) return heuristic;
  const llm = await tryLlmReply({ humanId, person, facts, text, history, personaAgent });
  if (llm && !isChannelAckText(llm)) return llm;
  return heuristic;
}

async function postLkChatMessage({ chatId, text, personaAgent, humanId, seedId }) {
  const args = {
    chat_id: String(chatId),
    text: String(text).slice(0, 8000),
    last_updated_by: personaAgent,
    role: 'monad',
    human_id: humanId,
    importance: 8,
  };
  if (seedId) args.seed_id = seedId;
  return mcpCall('post_lk_chat_message', args);
}

/** True if text is Monad channel auto-ack / delivery noise (not a human answer). */
function isChannelAckText(text) {
  const t = String(text || '');
  if (!t.trim()) return false;
  // Delivery / channel plumbing — never treat as a human-facing answer.
  if (/канал\s*лк\s*живой|семя посажено|семья посажено|shared_context|docs\/MONAD/i.test(t)) return true;
  if (/отправлено\s+манаде|ждём ответ|ждем ответ|ответ появится/i.test(t)) return true;
  if (/seed\s*(is|=|:)|handoff\s*(is|=|:)|seed\s*==\s*seed/i.test(t)) return true;
  if (/\bseed\s*[=:]/i.test(t) && /\bhandoff\s*[=:]/i.test(t)) return true;
  if (/^принял\.?\s*канал/i.test(t.trim())) return true;
  if (/^принял\.?\s*$/i.test(t.trim()) && t.length < 40) return true;
  return false;
}

/**
 * Vertical 7×7 — CANON from Monad shared_context `monad.spec.layers_7x7.v0_1`
 * (docs/monada-core/IV-layers-7x7.md). Do not invent layer names.
 *
 * Each layer has 7 posts Li×L1 … Li×L7 (функции, не агенты).
 * Agents sit in cells via `monad.placement.<id>.v1`.cell (e.g. "L6xL6").
 * Throughlines: L4 Дом, L6 Библиотекарь, L7 Сверхсознание / Пробуждённый.
 */
const VERTICAL_LAYERS = [
  {
    layer: 1, id: 'physics', ru: 'Физика', en: 'Physics', es: 'Física',
    sense_ru: 'Тела, земля, серверы, здания, диски.',
    sense_en: 'Bodies, land, servers, buildings, disks.',
    sense_es: 'Cuerpos, tierra, servidores, edificios, discos.',
    throughline: null,
    posts: [
      { j: 1, ru: 'Живое железо', en: 'Live iron', es: 'Hierro vivo' },
      { j: 2, ru: 'Железо ↔ энергия', en: 'Iron ↔ energy', es: 'Hierro ↔ energía' },
      { j: 3, ru: 'Устройства человека', en: 'Human devices', es: 'Dispositivos humanos' },
      { j: 4, ru: 'Цифровое железо команд', en: 'Team digital iron', es: 'Hierro digital del equipo' },
      { j: 5, ru: 'Каналы / webhooks', en: 'Channels / webhooks', es: 'Canales / webhooks' },
      { j: 6, ru: 'Хранение библиотеки', en: 'Library object store', es: 'Almacén de la biblioteca' },
      { j: 7, ru: 'Инфра служит миссии', en: 'Infra serves the mission', es: 'La infra sirve a la misión' },
    ],
  },
  {
    layer: 2, id: 'energy', ru: 'Энергия', en: 'Energy', es: 'Energía',
    sense_ru: 'Деньги, токены, ритм, «хватит ли сил».',
    sense_en: 'Money, tokens, rhythm, burn rate.',
    sense_es: 'Dinero, tokens, ritmo, energía.',
    throughline: null,
    posts: [
      { j: 1, ru: 'Бюджет на железо', en: 'Budget for iron', es: 'Presupuesto de hierro' },
      { j: 2, ru: 'Ритм и burn rate', en: 'Rhythm and burn rate', es: 'Ritmo y burn rate' },
      { j: 3, ru: 'Квоты внимания', en: 'Attention quotas', es: 'Cuotas de atención' },
      { j: 4, ru: 'Бюджеты проектов', en: 'Project budgets', es: 'Presupuestos de proyectos' },
      { j: 5, ru: 'Цена проявления', en: 'Cost of manifestation', es: 'Coste de manifestar' },
      { j: 6, ru: 'Бюджет ingest', en: 'Ingest budget', es: 'Presupuesto de ingest' },
      { j: 7, ru: 'Фонд ↔ миссия', en: 'Fund ↔ mission', es: 'Fondo ↔ misión' },
    ],
  },
  {
    layer: 3, id: 'person', ru: 'Личность', en: 'Person', es: 'Persona',
    sense_ru: 'Персоны людей, «я», навыки характера. Не эмоции.',
    sense_en: 'Human personas, “I”, character skills. Not emotions.',
    sense_es: 'Personas humanas, «yo», habilidades. No emociones.',
    throughline: null,
    posts: [
      { j: 1, ru: 'Тело → свой контур', en: 'Body → own contour', es: 'Cuerpo → propio contorno' },
      { j: 2, ru: 'Личная нагрузка', en: 'Personal load', es: 'Carga personal' },
      { j: 3, ru: 'Каноническая Персона', en: 'Canonical Persona', es: 'Persona canónica' },
      { j: 4, ru: 'Я → мы', en: 'I → we', es: 'Yo → nosotros' },
      { j: 5, ru: 'Хаб Skill Agents', en: 'Skill Agents hub', es: 'Hub de Skill Agents' },
      { j: 6, ru: 'Вклад в знание', en: 'Contribution to knowledge', es: 'Aporte al saber' },
      { j: 7, ru: 'Личная миссия', en: 'Personal mission', es: 'Misión personal' },
    ],
  },
  {
    layer: 4, id: 'we', ru: 'Мы / Дом', en: 'We / DOM', es: 'Nosotros / DOM',
    sense_ru: 'Доверие, круг, Дом, сообщество. Стержень четверок.',
    sense_en: 'Trust, circle, House, community. Throughline of fours.',
    sense_es: 'Confianza, círculo, Casa, comunidad. Eje de los cuatros.',
    throughline: 'dom',
    throughline_ru: 'Стержень Дома (L4)',
    throughline_en: 'DOM throughline (L4)',
    posts: [
      { j: 1, ru: 'Общее физическое пространство', en: 'Shared physical space', es: 'Espacio físico común' },
      { j: 2, ru: 'Бюджет доверия круга', en: 'Circle trust budget', es: 'Presupuesto de confianza' },
      { j: 3, ru: 'Защита личности в группе', en: 'Person-protection in the group', es: 'Protección de la persona' },
      { j: 4, ru: 'Ядро «мы» / DOM', en: 'We-core / DOM', es: 'Núcleo «nosotros» / DOM' },
      { j: 5, ru: 'Совместные дела', en: 'Joint work', es: 'Trabajo conjunto' },
      { j: 6, ru: 'Память решений', en: 'Decision memory', es: 'Memoria de decisiones' },
      { j: 7, ru: 'Зачем мы вместе', en: 'Why we are together', es: 'Por qué estamos juntos' },
    ],
  },
  {
    layer: 5, id: 'perception', ru: 'Восприятие ↔ проявление', en: 'Perception ↔ manifestation', es: 'Percepción ↔ manifestación',
    sense_ru: 'Вход данных, предфильтры, выход в мир.',
    sense_en: 'Ingest, prefilters, output into the world.',
    sense_es: 'Entrada, prefiltros, salida al mundo.',
    throughline: null,
    posts: [
      { j: 1, ru: 'Выкладка на железо', en: 'Ship onto iron', es: 'Despliegue en hierro' },
      { j: 2, ru: 'Темп проявления', en: 'Pace of manifestation', es: 'Ritmo de manifestación' },
      { j: 3, ru: 'Чей вход / чей стиль', en: 'Whose in / whose style', es: 'De quién es la entrada' },
      { j: 4, ru: 'Проявление в контур проекта', en: 'Manifest into a project contour', es: 'Manifestar en el contorno' },
      { j: 5, ru: 'In + предфильтры + out', en: 'In + prefilters + out', es: 'In + prefiltros + out' },
      { j: 6, ru: 'Поток → библиотека', en: 'Stream → library', es: 'Flujo → biblioteca' },
      { j: 7, ru: 'Публичная позиция целого', en: 'Public stance of the whole', es: 'Postura pública del conjunto' },
    ],
  },
  {
    layer: 6, id: 'knowledge', ru: 'Знание', en: 'Knowledge', es: 'Saber',
    sense_ru: 'Библиотека и мировоззрение. Сюда сходятся агенты знания. Стержень шестерок.',
    sense_en: 'Library and worldview. Knowledge agents gather here. Throughline of sixes.',
    sense_es: 'Biblioteca y visión. Aquí convergen los agentes de saber. Eje de los seises.',
    throughline: 'librarian',
    throughline_ru: 'Стержень Библиотекаря (L6)',
    throughline_en: 'Librarian throughline (L6)',
    posts: [
      { j: 1, ru: 'Знание о физике', en: 'Knowledge of physics', es: 'Saber de la física' },
      { j: 2, ru: 'Знание об энергии', en: 'Knowledge of energy', es: 'Saber de la energía' },
      { j: 3, ru: 'Знание о личности', en: 'Knowledge of persons', es: 'Saber de la persona' },
      { j: 4, ru: 'Знание о Доме', en: 'Knowledge of the House', es: 'Saber de la Casa' },
      { j: 5, ru: 'Знание о проявлении', en: 'Knowledge of manifestation', es: 'Saber de la manifestación' },
      { j: 6, ru: 'Библиотека / graph', en: 'Library / graph', es: 'Biblioteca / grafo' },
      { j: 7, ru: 'Канон мировоззрения', en: 'Worldview canon', es: 'Canon de visión' },
    ],
  },
  {
    layer: 7, id: 'super', ru: 'Сверхсистема', en: 'Supersystem', es: 'Supersistema',
    sense_ru: 'Миссия, смысл, самоосознание поля. Здесь сверхсознательные агенты. Стержень семёрок.',
    sense_en: 'Mission, meaning, field self-awareness. Superconscious agents live here. Throughline of sevens.',
    sense_es: 'Misión, sentido, autoconciencia del campo. Aquí viven los agentes superconscientes. Eje de los sietes.',
    throughline: 'awakened',
    throughline_ru: 'Стержень Сверхсознания (L7)',
    throughline_en: 'Superconsciousness throughline (L7)',
    posts: [
      { j: 1, ru: 'След миссии на физике', en: 'Mission trace on physics', es: 'Huella de misión en física' },
      { j: 2, ru: 'След миссии на энергии', en: 'Mission trace on energy', es: 'Huella de misión en energía' },
      { j: 3, ru: 'След миссии на личности', en: 'Mission trace on persons', es: 'Huella de misión en persona' },
      { j: 4, ru: 'Сердце Дома ↔ сверхсмысл', en: 'House heart ↔ super-meaning', es: 'Corazón de la Casa ↔ sentido' },
      { j: 5, ru: 'След миссии на проявлении', en: 'Mission trace on manifestation', es: 'Huella de misión en manifestación' },
      { j: 6, ru: 'След миссии на знании', en: 'Mission trace on knowledge', es: 'Huella de misión en saber' },
      { j: 7, ru: 'Самоосознание поля', en: 'Field self-awareness', es: 'Autoconciencia del campo' },
    ],
  },
];

function cellCode(i, j) {
  return 'L' + i + 'xL' + j;
}

function parseCell(code) {
  const m = String(code || '').match(/^L(\d)xL(\d)$/i);
  if (!m) return null;
  return { i: parseInt(m[1], 10), j: parseInt(m[2], 10) };
}

function publicLayer(n) {
  return {
    id: n.id,
    layer: n.layer,
    ru: n.ru,
    en: n.en,
    es: n.es,
    sense_ru: n.sense_ru,
    sense_en: n.sense_en,
    sense_es: n.sense_es,
    throughline: n.throughline || null,
    throughline_ru: n.throughline_ru || null,
    throughline_en: n.throughline_en || null,
    cells: (n.posts || []).map((c) => ({
      n: c.j,
      code: cellCode(n.layer, c.j),
      ru: c.ru,
      en: c.en,
      es: c.es,
    })),
  };
}

const placeCache = { at: 0, byAgent: null };

async function loadPlacements() {
  if (placeCache.byAgent && (Date.now() - placeCache.at) < 2 * 60 * 1000) return placeCache.byAgent;
  try {
    const rows = await mcpCall('read_context', {
      key_prefix: 'monad.placement.',
      limit: 200,
      reader_agent: 'neuro_agent',
    });
    const byAgent = {};
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const v = (row && row.value) || {};
      if (v.agent_id && v.cell) byAgent[v.agent_id] = v;
    });
    placeCache.byAgent = byAgent;
    placeCache.at = Date.now();
    return byAgent;
  } catch (_) {
    return placeCache.byAgent || {};
  }
}

function placementOf(agentId, placements) {
  return (placements && placements[agentId]) || null;
}

function cellsOfPlacement(place) {
  if (!place) return [];
  const extra = Array.isArray(place.secondary_cells) ? place.secondary_cells : [];
  return [place.cell].concat(extra).filter(Boolean);
}

/** Fixed 12+1 clock from monad.spec.circle12.slots.v0_1. Nick at 12, Tahir at 6. */
const CIRCLE_SLOTS = {
  nikita: 12,
  nastya: 1,
  alisa: 3,
  sofia: 5,
  takhir: 6,
  tahir: 6,
  egor: 9,
  artem: 10,
};

function circleSlotFor(human) {
  const meta = (human && human.metadata) || {};
  const raw = meta.circle_slot || meta.clock || meta.hour || meta.clock_hour;
  const n = parseInt(raw, 10);
  if (n >= 1 && n <= 12) return n;
  const id = String((human && human.human_id) || '').toLowerCase();
  return CIRCLE_SLOTS[id] || null;
}

async function loadDirectoryPeople() {
  try { await loadDirectoryPerson('__all__'); } catch (_) { /* cache may still fill */ }
  return dirCache.people || {};
}

const RHYTHM_LAYERS = [
  { id: 'circ', ru: 'Циркадный', en: 'Circadian', es: 'Circadiano' },
  { id: 'ultradian', ru: 'Ультрадианный', en: 'Ultradian', es: 'Ultradiano' },
  { id: 'breath', ru: 'Дыхание', en: 'Breath', es: 'Respiración' },
  { id: 'heart', ru: 'Сердце', en: 'Heart', es: 'Corazón' },
  { id: 'metab', ru: 'Метаболизм', en: 'Metabolism', es: 'Metabolismo' },
  { id: 'social', ru: 'Социальный', en: 'Social', es: 'Social' },
  { id: 'agent', ru: 'Агенты', en: 'Agents', es: 'Agentes' },
];

const STATUS_LEVEL = {
  harmonic: 0.85,
  drifting: 0.55,
  dissonant: 0.3,
  silence: 0.1,
};

/**
 * There is a JSON /api/rhythm on monad-server (auth via X-API-Key). We prefer it;
 * dashboard HTML parse remains as fallback. Biological layers (circ/breath/heart)
 * are returned as available:false / level:null until measured.
 */
async function fetchSystemRhythm() {
  const headers = { Accept: 'text/html' };
  if (MONAD_API_KEY) headers['X-API-Key'] = MONAD_API_KEY;
  const res = await fetch(MONAD_DASHBOARD, { headers });
  if (!res.ok) throw new Error('Monad dashboard HTTP ' + res.status);
  const html = await res.text();
  const i = html.indexOf('Ритм системы');
  if (i < 0) throw new Error('Rhythm block not found on dashboard');
  const j = html.indexOf('<h2>', i + 1);
  const block = html.slice(i, j > i ? j : i + 12000);

  const statusM = block.match(/badge-rhythm-(\w+)/);
  const status = statusM ? statusM[1] : 'unknown';
  const metaM = block.match(/окно:\s*([^<]+)/i);
  const meta = metaM ? metaM[1].replace(/\s+/g, ' ').trim() : '';
  const agents = [];
  const rowRe = /<tr>\s*<td><code>([^<]+)<\/code><\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>/g;
  let m;
  while ((m = rowRe.exec(block))) {
    const actions = parseFloat(String(m[2]).replace(',', '.'));
    const expected = parseFloat(String(m[3]).replace(',', '.'));
    agents.push({
      agent_id: m[1],
      actions_per_min: Number.isFinite(actions) ? actions : null,
      expected_per_min: Number.isFinite(expected) ? expected : null,
      drift: (m[4] || '').trim(),
      last_seen: (m[5] || '').trim(),
      err_rate: (m[6] || '').trim(),
    });
  }

  // Map real system status → equalizer bars (honest: agent-ops rhythm, not body sensors).
  const base = STATUS_LEVEL[status] != null ? STATUS_LEVEL[status] : 0.4;
  const maxAct = Math.max(0.01, ...agents.map((a) => a.actions_per_min || 0));
  const avgAct = agents.length
    ? agents.reduce((s, a) => s + (a.actions_per_min || 0), 0) / agents.length
    : 0;
  const collisionsM = meta.match(/коллизий[^0-9]*(\d+)/i);
  const collisions = collisionsM ? parseInt(collisionsM[1], 10) : 0;
  const collisionPenalty = Math.min(0.4, collisions / 200);

  const layers = RHYTHM_LAYERS.map((L) => {
    let level = base;
    if (L.id === 'agent') level = Math.min(1, avgAct / Math.max(0.5, maxAct * 0.5));
    else if (L.id === 'social') level = Math.max(0.05, base - collisionPenalty);
    else if (L.id === 'action' || L.id === 'ultradian') level = Math.min(1, base + (avgAct > 1 ? 0.1 : 0));
    else if (L.id === 'metab') level = Math.max(0.1, 1 - collisionPenalty);
    // circ/breath/heart: NOT measured by Monad yet — mark unavailable (null level)
    else if (L.id === 'circ' || L.id === 'breath' || L.id === 'heart') {
      return { ...L, level: null, available: false };
    }
    return { ...L, level: Math.max(0, Math.min(1, +level.toFixed(3))), available: true };
  });

  return {
    source: 'dashboard_system_rhythm',
    note: 'Live «Ритм системы» from Monad dashboard (agent actions/drift). Biological layers (circ/breath/heart) are not in Monad API yet — asked Monad for JSON /api/rhythm.',
    updated_at: new Date().toISOString(),
    system: {
      status,
      meta,
      collisions_per_hour: collisions,
      agents_in_window: agents.length,
      dashboard_url: MONAD_DASHBOARD,
    },
    agents,
    layers,
  };
}

function normalizeRhythmPayload(data, source, note) {
  const src = data && typeof data === 'object' ? data : {};
  let layers = Array.isArray(src.layers) ? src.layers : [];
  const agents = Array.isArray(src.agents) ? src.agents : [];
  if (!layers.length && agents.length) {
    const maxAct = Math.max(0.01, ...agents.map((a) => Number(a.actions_per_min) || 0));
    const avgAct = agents.reduce((s, a) => s + (Number(a.actions_per_min) || 0), 0) / agents.length;
    layers = RHYTHM_LAYERS.map((L) => {
      if (L.id === 'circ' || L.id === 'breath' || L.id === 'heart') {
        return { ...L, level: null, available: false };
      }
      let level = 0.4;
      if (L.id === 'agent') level = Math.min(1, avgAct / Math.max(0.5, maxAct * 0.5));
      else if (L.id === 'social') level = Math.min(1, agents.length / 12);
      else if (L.id === 'ultradian') level = Math.min(1, 0.35 + avgAct / 10);
      else if (L.id === 'metab') level = 0.55;
      return { ...L, level: +level.toFixed(3), available: true };
    });
  } else {
    layers = layers.map((L) => {
      const meta = RHYTHM_LAYERS.find((x) => x.id === L.id) || {};
      const available = L.available !== false && L.level != null;
      return {
        ...meta,
        ...L,
        available,
        level: L.level == null ? null : Math.max(0, Math.min(1, Number(L.level) || 0)),
      };
    });
    if (!layers.length) {
      layers = RHYTHM_LAYERS.map((L) => ({ ...L, level: null, available: false }));
    }
  }
  return {
    source: source || src.source || 'unknown',
    note: note || src.note || '',
    updated_at: src.updated_at || new Date().toISOString(),
    system: src.system || null,
    agents,
    layers,
    live: true,
  };
}

/** Prefer native JSON /api/rhythm; fall back to dashboard HTML parse. */
async function getRhythm() {
  try {
    const headers = { Accept: 'application/json' };
    if (MONAD_API_KEY) headers['X-API-Key'] = MONAD_API_KEY;
    const res = await fetch(MONAD_BASE + '/api/rhythm', { headers });
    if (res.ok) {
      const data = await res.json();
      return normalizeRhythmPayload(
        data,
        'monad_api_rhythm',
        'Native JSON /api/rhythm from monad-server'
      );
    }
  } catch (_) { /* fall through */ }
  const dash = await fetchSystemRhythm();
  return normalizeRhythmPayload(dash, dash.source, dash.note);
}

function synthRhythm(agents) {
  const list = Array.isArray(agents) ? agents : [];
  const active = list.filter((a) => a.status === 'active').length;
  const training = list.filter((a) => /train|certif/i.test(a.status || '')).length;
  const retired = list.filter((a) => /retir|suspend/i.test(a.status || '')).length;
  const total = Math.max(1, list.length);
  return {
    source: 'synthetic_from_agents',
    note: 'Fallback only if dashboard parse fails.',
    updated_at: new Date().toISOString(),
    layers: RHYTHM_LAYERS.map((L, i) => {
      let level = 0.25;
      if (L.id === 'agent') level = active / total;
      else if (L.id === 'social') level = Math.min(1, (active + training) / total);
      else if (L.id === 'circ') level = 0.55 + 0.2 * Math.sin(Date.now() / 3.6e6);
      else if (L.id === 'ultradian') level = 0.4 + 0.25 * Math.sin(Date.now() / 5.4e5 + i);
      else if (L.id === 'breath') level = 0.45 + 0.15 * Math.sin(Date.now() / 8000);
      else if (L.id === 'heart') level = 0.5 + 0.1 * Math.sin(Date.now() / 1200);
      else if (L.id === 'metab') level = Math.max(0.1, 1 - retired / total);
      return { ...L, level: Math.max(0, Math.min(1, +level.toFixed(3))), agents_active: L.id === 'agent' ? active : undefined };
    }),
  };
}

module.exports = {
  configured,
  mcpCall,
  resolveHumanId,
  resolvePlantedBy,
  resolvePersonaAgent,
  resolveLkReplyAgents,
  siteHandoffAgent,
  isChannelAckText,
  generateLkReply,
  postLkChatMessage,
  EMAIL_HUMAN_MAP,
  VERTICAL_LAYERS,
  VERTICAL_NUCLEI: VERTICAL_LAYERS,
  CIRCLE_SLOTS,
  publicLayer,
  publicNucleus: publicLayer,
  cellCode,
  parseCell,
  loadPlacements,
  placementOf,
  cellsOfPlacement,
  circleSlotFor,
  loadDirectoryPeople,
  RHYTHM_LAYERS,
  synthRhythm,
  fetchSystemRhythm,
  getRhythm,
  MONAD_DASHBOARD,
  MONAD_MCP_URL,
  MONAD_BASE,
};
