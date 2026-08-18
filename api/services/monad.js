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
      key: 'monad.directory.people.v1',
      limit: 1,
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

/** Contour = group of agents of one meaning. Not a project, not a vertical layer. */
const CONTOUR_LABELS = {
  knowledge: { ru: 'Знание', en: 'Knowledge' },
  loom: { ru: 'Контент (Loom)', en: 'Content (Loom)' },
  design: { ru: 'Дизайн', en: 'Design' },
  marketing: { ru: 'Маркетинг', en: 'Marketing' },
  investment: { ru: 'Инвестиции', en: 'Investment' },
  learning: { ru: 'Обучение', en: 'Learning' },
  domtech: { ru: 'DomTech', en: 'DomTech' },
  awareness: { ru: 'Сверхсознание', en: 'Awareness' },
};
const PROJECT_LABELS = {
  neuroattention_lab: { ru: 'NeuroAttention Lab', en: 'NeuroAttention Lab' },
  behold: { ru: 'Be Hold', en: 'Be Hold' },
  vidas_neo: { ru: 'Vidas Neo', en: 'Vidas Neo' },
  postcontact: { ru: 'PostContact', en: 'PostContact' },
  dom: { ru: 'DOM', en: 'DOM' },
};

function labelContour(id, lang) {
  const row = CONTOUR_LABELS[id];
  if (!row) return id;
  return lang === 'en' ? row.en : row.ru;
}
function labelProject(id, lang) {
  const row = PROJECT_LABELS[id];
  if (!row) return id;
  return lang === 'en' ? row.en : row.ru;
}

function membershipFromPlacements(humanId, placements, lang) {
  const contours = [];
  const projects = [];
  const seenC = new Set();
  const seenP = new Set();
  Object.values(placements || {}).forEach((p) => {
    if (!p || p.owner !== humanId) return;
    if (p.type === 'contour_persona') {
      const id = p.contour || p.agent_id;
      if (id && !seenC.has(id)) { seenC.add(id); contours.push(labelContour(id, lang)); }
    }
    if (p.type === 'project_persona') {
      const id = p.project || (p.agent_id === 'persona_dom' ? 'dom' : null);
      if (id && !seenP.has(id)) { seenP.add(id); projects.push(labelProject(id, lang)); }
    }
  });
  return { contours, projects };
}

const WHO_YOU_RE = /кто\s+ты|ты\s+кто|who\s+are\s+you|who\s+am\s+i\s+talking|с\s+кем\s+я/i;
const WHO_AM_I_DIRECT_RE = /кто\s+я|who\s+am\s+i|знаешь\s+кто\s+я|ты\s+знаешь\s+кто/i;
const WHO_AM_I_FOLLOW_RE = /^(а\s+я|ну\s+а\s+я|и\s+я|а\s+кто\s+я|and\s+me|what\s+about\s+me)\s*[?!.…]*$/i;

function messageText(m) {
  return String((m && (m.text || m.content)) || '');
}
function messageRole(m) {
  return String((m && m.role) || '');
}
function priorHistory(history) {
  const msgs = Array.isArray(history) ? history.slice() : [];
  if (!msgs.length) return [];
  const lastRole = messageRole(msgs[msgs.length - 1]);
  if (lastRole === 'you' || lastRole === 'user' || lastRole === 'human') {
    return msgs.slice(0, -1);
  }
  return msgs;
}

/** True if a recent turn already asked who the Persona is, or Persona just introduced itself. */
function recentAskedWhoYou(history) {
  const prior = priorHistory(history).slice(-6);
  for (let i = prior.length - 1; i >= 0; i--) {
    const role = messageRole(prior[i]);
    const t = messageText(prior[i]);
    if (role === 'you' || role === 'user' || role === 'human') {
      if (WHO_YOU_RE.test(t)) return true;
    }
    if (role === 'monad' || role === 'assistant') {
      if (/Persona/i.test(t) && /(кабинет|cabinet|Telegram)/i.test(t)) return true;
    }
  }
  return false;
}

function identityIntent(text, history) {
  const t = String(text || '').trim();
  const whoYou = WHO_YOU_RE.test(t);
  const whoAmIDirect = WHO_AM_I_DIRECT_RE.test(t);
  const whoAmIBare = /^(а\s+я|а\s+кто\s+я)\s*[?!.…]*$/i.test(t);
  const whoAmIFollow = WHO_AM_I_FOLLOW_RE.test(t) && (whoYou || recentAskedWhoYou(history));
  return { whoYou, whoAmI: whoAmIDirect || whoAmIBare || whoAmIFollow };
}

function composeHeuristicReply({ humanId, person, facts, text, placements, history }) {
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
  const ident = identityIntent(t, history);
  const canDo = /что ты умеешь|что ты можешь|какие у меня контур|к чему есть доступ|what can you do/i.test(t);
  const aboutContour = /что такое контур|what is a contour|контур —|контур -|контуры и проект/i.test(t);
  const hi = /^(привет|хай|здравствуй|здравствуйте|hello|hi|hey)[!.…\s]*$/i.test(t);

  const mem = membershipFromPlacements(humanId, placements, ru ? 'ru' : 'en');
  const contourBlock = [
    mem.contours.length ? (ru ? ('Контуры: ' + mem.contours.join(', ') + '.') : ('Contours: ' + mem.contours.join(', ') + '.')) : '',
    mem.projects.length ? (ru ? ('Проекты: ' + mem.projects.join(', ') + '.') : ('Projects: ' + mem.projects.join(', ') + '.')) : '',
  ].filter(Boolean).join(' ');

  const youLine = ru
    ? 'Я твоя Persona в этом чате ЛК NeuroAttention. Отвечаю здесь, без Telegram-моста.'
    : 'I am your Persona in this NeuroAttention cabinet chat. I answer here, without a Telegram bridge.';
  const aka = aliases.length ? ` (${aliases.slice(0, 3).join(', ')})` : '';
  const meLine = ru
    ? `Ты ${name}${aka}${role ? '. ' + role : '.'} Super-admin этого кабинета.`
    : `You are ${name}${aka}${role ? '. ' + role : '.'} Super-admin of this cabinet.`;

  if (ident.whoYou || ident.whoAmI) {
    if (ident.whoYou && ident.whoAmI) return `${youLine} ${meLine}`;
    if (ident.whoYou) return youLine;
    return meLine;
  }
  if (hi) {
    return ru
      ? `Привет, ${first}. Я твоя Persona в этом чате ЛК — не шаблон и не служебный канал. Спрашивай прямо: кто я, атлас, Sketch, ритм, контур.`
      : `Hi, ${first}. I am your Persona in this cabinet chat. Ask directly: who I am, atlas, Sketch, rhythm, contour.`;
  }
  if (aboutContour || (/контур|contour/i.test(low) && /что|what|это/i.test(low))) {
    return ru
      ? `Контур — группа агентов, связанных одним смыслом (знание, контент, маркетинг, дизайн, инвестиции…). Это не слой вертикали и не проект. NAL и DOM — проекты. На горизонтали контуры ветвятся от людей.`
      : `A contour is a group of agents bound by one meaning (knowledge, content, marketing, design, investment…). Not a vertical layer and not a project. NAL and DOM are projects. On the horizontal, contours branch from people.`;
  }
  if (canDo) {
    return ru
      ? `В этом чате я отвечаю сразу. Вкладки Манады: вертикаль (49 постов L1×L1…L7×L7), горизонталь (круг 12+1, контуры от людей), ритм (пульс слоёв L1–L7). ${contourBlock}`
      : `I answer in this chat. Monad tabs: vertical 7×7 (49 posts), horizontal 12+1 (contours branch from people), rhythm (L1–L7 pulse). ${contourBlock}`;
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
      ? `Горизонталь — круг 12+1 (monad.spec.circle12): DOM в центре (проект, не контур). Люди на фиксированных часах: Никита 12, Тахир 6. Пустые слоты 2,4,7,8,11 нажаты и пусты. Контуры ветвятся от людей, не висят отдельными отделами.`
      : `Horizontal is 12+1: DOM (a project) in the centre. People on fixed hours. Empty slots stay pressed empty. Contours branch from people.`;
  }
  if (/ритм|rhythm|equalizer|эквалайз/i.test(low)) {
    return ru
      ? `Ритм — пульс семи слоёв вертикали (физика L1–L2, жизнь L3–L4, ум L5–L7), не биологический EEG. Живые действия агентов с дашборда Манады. Кнопка «Живой ритм» включает онлайн; уход со вкладки гасит.`
      : `Rhythm is the pulse of the seven vertical layers (physics L1–L2, vital L3–L4, mental L5–L7), not a body EEG. Live agent actions from the Monad dashboard.`;
  }
  if (/удал|rename|переимен|чат/i.test(low) && /чат|chat/i.test(low)) {
    return ru
      ? `Чаты: в списке слева карандаш — переименовать, крестик — удалить. В шапке треда тоже есть Удалить.`
      : `Chats: pencil to rename, × to delete, in the left list.`;
  }

  if (ru) {
    return `Я твоя Persona в этом чате — прямой доступ к Манаде из кабинета. Сейчас на рантайме сайта нет живой модели, поэтому не разверну ответ как собеседник. Напиши задачу — посажу её агентам контура. Чтобы я говорил здесь как модель, на API нужен ключ LLM.`;
  }
  return `I am your Persona in this cabinet chat — direct access to Monad. There is no live model on the site runtime yet, so I cannot answer as a full interlocutor. Send a task and I will plant it with the contour agents. A model key on the API is required for conversation here.`;
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

function llmConfigured() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY);
}

function clipJson(value, max) {
  let s;
  try { s = typeof value === 'string' ? value : JSON.stringify(value); } catch (_) { s = String(value); }
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function layerBrief() {
  return VERTICAL_LAYERS.map((L) => `L${L.layer} ${L.ru}`).join(', ');
}

const LK_MCP_TOOLS = [
  {
    name: 'get_architecture',
    description: 'Live Monad architecture pack (people, R10 chains, contours/projects, site contract). Call first for Monad structure / who-is-who. Do not invent agents or layers.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'read_context',
    description: 'Read Monad shared_context. Prefer exact key= (e.g. monad.spec.layers_7x7.v0_1, monad.spec.circle12.slots.v0_1, monad.directory.people.v1). key_prefix without key is top-by-importance, not a snapshot.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        key_prefix: { type: 'string' },
        limit: { type: 'integer' },
      },
    },
  },
  {
    name: 'get_user_facts',
    description: 'Facts about a human_id in Monad.',
    input_schema: {
      type: 'object',
      properties: { human_id: { type: 'string' }, search: { type: 'string' }, limit: { type: 'integer' } },
      required: ['human_id'],
    },
  },
  {
    name: 'resolve_person',
    description: 'Resolve a name/nickname/email to the directory person. Never ask the human for agent_id.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'handoff_task',
    description: 'Give real work to another Monad agent. Egor content factory → persona_loom_house. Nick/NAL → persona_nal. Do not send to companion or Telegram.',
    input_schema: {
      type: 'object',
      properties: {
        to_agent: { type: 'string' },
        task_description: { type: 'string' },
        domain: { type: 'string' },
        priority: { type: 'integer' },
      },
      required: ['task_description'],
    },
  },
  {
    name: 'plant_seed',
    description: 'Plant a task seed in Monad when the human wants work done (content, knowledge, NAL, site). from/planted_by is this Persona. Never companion.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        to_agent: { type: 'string' },
        domain: { type: 'string' },
        priority: { type: 'integer' },
      },
      required: ['title', 'description'],
    },
  },
];

function openaiToolsFromMcp() {
  return LK_MCP_TOOLS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

async function loadPersonaPrompt(agentId) {
  try {
    const raw = await mcpCall('get_agent_prompt', { agent_id: agentId });
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object') {
      return String(raw.system_prompt || raw.prompt || raw.text || JSON.stringify(raw));
    }
    return '';
  } catch (_) {
    return '';
  }
}

async function runLkTool(name, input, ctx) {
  const args = input && typeof input === 'object' ? Object.assign({}, input) : {};
  if (name === 'get_architecture') {
    return clipJson(await mcpCall('get_architecture', {}), 8000);
  }
  if (name === 'read_context') {
    args.reader_agent = ctx.personaAgent;
    if (args.limit == null) args.limit = 6;
    args.limit = Math.max(1, Math.min(12, Number(args.limit) || 6));
    return clipJson(await mcpCall('read_context', args), 8000);
  }
  if (name === 'get_user_facts') {
    args.human_id = args.human_id || ctx.humanId;
    args.include_sensitive = false;
    if (args.limit == null) args.limit = 20;
    args.limit = Math.max(1, Math.min(40, Number(args.limit) || 20));
    const facts = await mcpCall('get_user_facts', args);
    const list = Array.isArray(facts) ? facts : [];
    return clipJson(list.map((f) => ({ key: f.key, value: publicFact(f.value), category: f.category })), 4000);
  }
  if (name === 'resolve_person') {
    return clipJson(await mcpCall('resolve_person', { query: String(args.query || '') }), 3000);
  }
  if (name === 'handoff_task') {
    const to = String(args.to_agent || siteHandoffAgent(ctx.humanId)).slice(0, 64);
    if (!to || to === 'companion') {
      throw new Error('handoff_task: companion / empty to_agent forbidden in LK');
    }
    ctx.didWork = true;
    return clipJson(await mcpCall('handoff_task', {
      from_agent: ctx.personaAgent,
      to_agent: to,
      task_description: String(args.task_description || '').slice(0, 8000),
      domain: args.domain ? String(args.domain).slice(0, 64) : undefined,
      priority: Math.min(10, Math.max(1, parseInt(args.priority, 10) || 7)),
    }), 2500);
  }
  if (name === 'plant_seed') {
    const to = String(args.to_agent || siteHandoffAgent(ctx.humanId)).slice(0, 64);
    if (to === 'companion') throw new Error('plant_seed: companion forbidden in LK');
    const tags = ['neuroattention', 'lk', 'from_cabinet', 'from_persona_llm'];
    if (ctx.chatId) tags.push('chat:' + ctx.chatId);
    ctx.didWork = true;
    return clipJson(await mcpCall('plant_seed', {
      planted_by: ctx.personaAgent,
      human_id: ctx.humanId,
      title: String(args.title || '').slice(0, 200),
      description: String(args.description || '').slice(0, 8000),
      to_agent: to || undefined,
      domain: args.domain ? String(args.domain).slice(0, 64) : 'neuro',
      priority: Math.min(10, Math.max(1, parseInt(args.priority, 10) || 7)),
      create_handoff: true,
      tags,
    }), 2500);
  }
  throw new Error('Unknown tool ' + name);
}

function buildLkSystemPrompt({ humanId, person, facts, placements, personaAgent, personaPrompt, arch }) {
  const name = (person && (person.display_name || (person.aliases && person.aliases[0]))) || humanId;
  const role = publicFact(factVal(facts, 'role') || (person && person.role_title) || '');
  const factLines = (facts || []).slice(0, 16).map((f) => `- ${f.key}: ${publicFact(f.value)}`).join('\n');
  const mem = membershipFromPlacements(humanId, placements, 'ru');
  const workAgent = siteHandoffAgent(humanId);
  const archClip = arch ? clipJson(arch, 4500) : '';
  const promptClip = String(personaPrompt || '').slice(0, 3500);
  return [
    `Ты живая Persona Манады в чате личного кабинета NeuroAttention (neuroattention.org).`,
    `Говоришь как ${personaAgent} с человеком ${name} (human_id=${humanId}${role ? ', ' + role : ''}).`,
    `Это прямой доступ человека к Манаде из кабинета — полноценный собеседник и рабочий канал задач, не FAQ и не меню вкладок.`,
    `Отвечай на языке человека, живо, по делу. Ты и есть ответ. Не цитируй его сообщение.`,
    ``,
    `Канон (не выдумывай):`,
    `- Вопрос про устройство Манады / кто есть кто / контуры / вертикаль / горизонталь → сначала get_architecture, детали через read_context с точным key= из поля keys.`,
    `- Контур = группа агентов одного смысла. NAL и DOM — проекты, не контуры.`,
    `- Сетка 7×7 постов (функции, не агенты): ${layerBrief()}. Агенты сидят в monad.placement. Это не то же самое, что R10-цепь Human→Persona→Contour→skill из get_architecture.vertical.`,
    `- Горизонталь 12+1: контуры ветвятся от людей; DOM в центре как проект; пустые часы остаются пустыми.`,
    `- Маршрут ЛК (monad.config.lk_site_routing.v1): человек → его Persona → persona контура/проекта. Никогда companion, никогда Telegram Тахира, никогда не спрашивай у человека agent_id.`,
    `- Если в каноне нет — скажи «неизвестно в каноне». Не изобретай агентов, слои, слоты.`,
    ``,
    `Работа:`,
    `- Разговор — отвечай сам, как модель, с пониманием Манады.`,
    `- Задача (контент-фабрика, знание, NAL, сайт, «сделай») — делай: черновик в чате, если можешь; иначе handoff_task / plant_seed. from_agent/planted_by = ты (${personaAgent}).`,
    `- Агент работы по умолчанию для этого человека: ${workAgent}. Для Егора это persona_loom_house (контент-фабрика Loom). Для Никиты — persona_nal.`,
    `- Человеку говори обычным языком, что сделано. Не пиши seed=, handoff=, shared_context, docs/ пути, «канал живой».`,
    `- Тахира/Takhir не упоминай, пока человек сам не спросил.`,
    `- Никогда не отвечай списком вкладок «атлас, Sketch, вертикаль, горизонталь, ритм, практики» вместо смысла.`,
    mem.contours.length ? `Контуры этого человека: ${mem.contours.join(', ')}.` : '',
    mem.projects.length ? `Проекты этого человека: ${mem.projects.join(', ')}.` : '',
    factLines ? `Факты:\n${factLines}` : '',
    archClip ? `Живой pack get_architecture:\n${archClip}` : '',
    promptClip ? `Живой system_prompt ${personaAgent}:\n${promptClip}` : '',
  ].filter(Boolean).join('\n');
}

async function tryLlmReply({ humanId, person, facts, text, history, personaAgent, placements, personaPrompt, arch, chatId, ctx }) {
  const system = buildLkSystemPrompt({ humanId, person, facts, placements, personaAgent, personaPrompt, arch });
  const hist = (history || []).slice(-16).map((m) => ({
    role: (m.role === 'monad' || m.role === 'assistant') ? 'assistant' : 'user',
    text: String(m.text || '').slice(0, 1200),
  }));
  // Drop a trailing duplicate of the current user turn if the DB already stored it.
  if (hist.length && hist[hist.length - 1].role === 'user' && hist[hist.length - 1].text === String(text || '').slice(0, 1200)) {
    hist.pop();
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  const openrouterKey = process.env.OPENROUTER_API_KEY || '';
  const deadline = Date.now() + 45000;

  if (anthropicKey) {
    try {
      const messages = hist.map((m) => ({ role: m.role, content: m.text }));
      messages.push({ role: 'user', content: String(text) });
      for (let round = 0; round < 6 && Date.now() < deadline; round++) {
        const data = await fetchJson('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: process.env.LK_LLM_MODEL || 'claude-sonnet-4-20250514',
            max_tokens: 1600,
            system,
            tools: LK_MCP_TOOLS,
            messages,
          }),
        }, Math.max(4000, Math.min(20000, deadline - Date.now())));
        const blocks = (data && data.content) || [];
        const toolUses = blocks.filter((b) => b && b.type === 'tool_use');
        const texts = blocks.filter((b) => b && b.type === 'text').map((b) => String(b.text || '').trim()).filter(Boolean);
        if (data && data.stop_reason !== 'tool_use' && texts.length) return texts.join('\n\n');
        if (!toolUses.length) {
          if (texts.length) return texts.join('\n\n');
          break;
        }
        messages.push({ role: 'assistant', content: blocks });
        const toolResults = [];
        for (const tu of toolUses) {
          let out;
          try {
            out = await runLkTool(tu.name, tu.input, ctx);
          } catch (e) {
            out = 'tool error: ' + (e && e.message ? e.message : String(e));
          }
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: String(out) });
        }
        messages.push({ role: 'user', content: toolResults });
      }
    } catch (e) {
      console.warn('[lk-llm] anthropic', e.message);
    }
  }

  const openaiish = [];
  if (openaiKey) {
    openaiish.push({
      url: 'https://api.openai.com/v1/chat/completions',
      key: openaiKey,
      model: process.env.LK_LLM_MODEL || 'gpt-4o',
    });
  }
  if (openrouterKey) {
    openaiish.push({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      key: openrouterKey,
      model: process.env.LK_LLM_MODEL || 'anthropic/claude-sonnet-4',
    });
  }
  for (const ep of openaiish) {
    try {
      const messages = [{ role: 'system', content: system }];
      hist.forEach((m) => messages.push({ role: m.role, content: m.text }));
      messages.push({ role: 'user', content: String(text) });
      for (let round = 0; round < 6 && Date.now() < deadline; round++) {
        const data = await fetchJson(ep.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + ep.key,
          },
          body: JSON.stringify({
            model: ep.model,
            max_tokens: 1600,
            tools: openaiToolsFromMcp(),
            messages,
          }),
        }, Math.max(4000, Math.min(20000, deadline - Date.now())));
        const msg = data && data.choices && data.choices[0] && data.choices[0].message;
        if (!msg) break;
        const calls = msg.tool_calls || [];
        if (!calls.length) {
          const t = String(msg.content || '').trim();
          if (t) return t;
          break;
        }
        messages.push(msg);
        for (const call of calls) {
          const fn = call.function || {};
          let parsed = {};
          try { parsed = JSON.parse(fn.arguments || '{}'); } catch (_) { parsed = {}; }
          let out;
          try {
            out = await runLkTool(fn.name, parsed, ctx);
          } catch (e) {
            out = 'tool error: ' + (e && e.message ? e.message : String(e));
          }
          messages.push({ role: 'tool', tool_call_id: call.id, content: String(out) });
        }
      }
    } catch (e) {
      console.warn('[lk-llm]', ep.url, e.message);
    }
  }
  return null;
}

async function generateLkReply({ humanId, text, history, personaAgent, chatId }) {
  const ctx = { humanId, personaAgent, chatId, didWork: false };
  const needLlm = llmConfigured();
  const [person, facts, placements, personaPrompt, arch] = await Promise.all([
    loadDirectoryPerson(humanId),
    loadHumanFacts(humanId),
    loadPlacements().catch(() => ({})),
    needLlm ? loadPersonaPrompt(personaAgent).catch(() => '') : Promise.resolve(''),
    needLlm ? mcpCall('get_architecture', {}).catch(async () => {
      try {
        const headers = { Accept: 'application/json' };
        if (MONAD_API_KEY) headers['X-API-Key'] = MONAD_API_KEY;
        const res = await fetch(MONAD_BASE + '/api/architecture', { headers });
        if (!res.ok) return null;
        return await res.json();
      } catch (_) { return null; }
    }) : Promise.resolve(null),
  ]);
  if (needLlm) {
    const llm = await tryLlmReply({
      humanId, person, facts, text, history, personaAgent, placements, personaPrompt, arch, chatId, ctx,
    });
    if (llm && !isChannelAckText(llm)) {
      return { text: llm, didWork: !!ctx.didWork, via: 'persona_llm' };
    }
  }
  const heuristic = composeHeuristicReply({ humanId, person, facts, text, placements, history });
  return { text: heuristic, didWork: false, via: needLlm ? 'heuristic_after_llm' : 'heuristic_no_llm' };
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

function friendList(friends) {
  if (!friends) return [];
  if (Array.isArray(friends)) return friends;
  if (typeof friends === 'object') return Object.keys(friends);
  return [];
}

function kindOfPlacement(place, placements) {
  if (!place) return { type: null, contour: null, project: null };
  const parent = place.parent && placements ? placements[place.parent] : null;
  let contour = place.contour || (parent && parent.contour) || null;
  let project = place.project || (parent && parent.project) || null;
  if (place.agent_id === 'persona_dom') project = project || 'dom';
  if (place.type === 'project_persona') contour = null;
  if (place.type === 'contour_persona') project = null;
  return { type: place.type || null, contour, project };
}

/** Fixed 12+1 clock from monad.spec.circle12.slots.v0_1. Empty hours stay pressed. */
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
const CIRCLE_INACTIVE = [2, 4, 7, 8, 11];

function circleSlotFor(human) {
  const id = String((human && human.human_id) || '').toLowerCase();
  if (CIRCLE_SLOTS[id]) return CIRCLE_SLOTS[id];
  const meta = (human && human.metadata) || {};
  const raw = meta.circle_slot || meta.clock || meta.hour || meta.clock_hour;
  const n = parseInt(raw, 10);
  if (n >= 1 && n <= 12 && CIRCLE_INACTIVE.indexOf(n) < 0) return n;
  return null;
}

async function loadDirectoryPeople() {
  try { await loadDirectoryPerson('__all__'); } catch (_) { /* cache may still fill */ }
  return dirCache.people || {};
}

const RHYTHM_LAYERS = [
  { id: 'L1', layer: 1, triple: 'physics', ru: 'Физика', en: 'Physics', es: 'Física' },
  { id: 'L2', layer: 2, triple: 'physics', ru: 'Энергия', en: 'Energy', es: 'Energía' },
  { id: 'L3', layer: 3, triple: 'vital', ru: 'Личность', en: 'Person', es: 'Persona' },
  { id: 'L4', layer: 4, triple: 'vital', ru: 'Мы / Дом', en: 'We / DOM', es: 'Nosotros / DOM' },
  { id: 'L5', layer: 5, triple: 'mental', ru: 'Восприятие', en: 'Perception', es: 'Percepción' },
  { id: 'L6', layer: 6, triple: 'mental', ru: 'Знание', en: 'Knowledge', es: 'Saber' },
  { id: 'L7', layer: 7, triple: 'mental', ru: 'Сверхсистема', en: 'Supersystem', es: 'Supersistema' },
];
const RHYTHM_TRIPLE = {
  physics: { ru: 'Физика', en: 'Physics', layers: [1, 2] },
  vital: { ru: 'Жизнь', en: 'Vital', layers: [3, 4] },
  mental: { ru: 'Ум', en: 'Mental', layers: [5, 6, 7] },
};

const STATUS_LEVEL = {
  harmonic: 0.85,
  drifting: 0.55,
  dissonant: 0.3,
  silence: 0.1,
};

function layerOfCell(code) {
  const p = parseCell(code);
  return p ? p.i : null;
}

function rhythmFromLive(system, agents, placements) {
  const actById = {};
  (agents || []).forEach((a) => { if (a && a.agent_id) actById[a.agent_id] = a; });
  const byLayer = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
  Object.values(placements || {}).forEach((p) => {
    const layer = layerOfCell(p && p.cell);
    if (!layer) return;
    byLayer[layer].push(p.agent_id);
  });
  const status = (system && system.status) || 'unknown';
  const base = STATUS_LEVEL[status] != null ? STATUS_LEVEL[status] : 0.35;
  const maxOcc = Math.max(1, ...RHYTHM_LAYERS.map((L) => byLayer[L.layer].length));
  const layers = RHYTHM_LAYERS.map((L) => {
    const ids = byLayer[L.layer];
    const actions = ids.reduce((s, id) => s + (Number(actById[id] && actById[id].actions_per_min) || 0), 0);
    const occ = ids.length / maxOcc;
    const pulse = Math.min(1, actions / 4);
    const level = Math.max(0.06, Math.min(1, 0.25 * base + 0.45 * occ + 0.3 * pulse));
    return {
      ...L,
      level: +level.toFixed(3),
      available: true,
      agents_in_layer: ids.length,
      actions_per_min: +actions.toFixed(3),
    };
  });
  return layers;
}

/**
 * Live pulse of the 7 vertical layers (monad.spec.rhythm.v0_3 triple).
 * Dashboard agent-ops is the live signal; occupancy comes from monad.placement.
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
  const collisionsM = meta.match(/коллизий[^0-9]*(\d+)/i);
  const collisions = collisionsM ? parseInt(collisionsM[1], 10) : 0;
  const placements = await loadPlacements().catch(() => ({}));
  return {
    source: 'dashboard_system_rhythm',
    note: 'Пульс слоёв L1–L7: рассадка monad.placement + live-действия с дашборда. Не биологический EEG. Канон: monad.spec.rhythm.v0_3 (физика / жизнь / ум).',
    updated_at: new Date().toISOString(),
    spec: 'monad.spec.rhythm.v0_3',
    triple: RHYTHM_TRIPLE,
    system: {
      status,
      meta,
      collisions_per_hour: collisions,
      agents_in_window: agents.length,
      dashboard_url: MONAD_DASHBOARD,
    },
    agents,
    layers: rhythmFromLive({ status }, agents, placements),
  };
}

function normalizeRhythmPayload(data, source, note) {
  const src = data && typeof data === 'object' ? data : {};
  const agents = Array.isArray(src.agents) ? src.agents : [];
  let layers = Array.isArray(src.layers) ? src.layers : [];
  const looksLikeCanon = layers.length && layers.every((L) => /^L[1-7]$/.test(String(L.id || '')));
  if (!looksLikeCanon) {
    layers = src.layers_from_live || [];
  }
  if (!layers.length) {
    layers = RHYTHM_LAYERS.map((L) => ({ ...L, level: null, available: false }));
  } else {
    layers = layers.map((L) => {
      const meta = RHYTHM_LAYERS.find((x) => x.id === L.id || x.layer === L.layer) || {};
      return {
        ...meta,
        ...L,
        available: L.available !== false && L.level != null,
        level: L.level == null ? null : Math.max(0, Math.min(1, Number(L.level) || 0)),
      };
    });
  }
  return {
    source: source || src.source || 'unknown',
    note: note || src.note || '',
    spec: src.spec || 'monad.spec.rhythm.v0_3',
    triple: src.triple || RHYTHM_TRIPLE,
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
      const placements = await loadPlacements().catch(() => ({}));
      if (!data.layers || !data.layers.some((L) => /^L[1-7]$/.test(String(L.id || '')))) {
        data.layers = rhythmFromLive(data.system || {}, data.agents || [], placements);
        data.triple = RHYTHM_TRIPLE;
        data.spec = 'monad.spec.rhythm.v0_3';
      }
      return normalizeRhythmPayload(
        data,
        'monad_api_rhythm',
        data.note || 'Native JSON /api/rhythm, mapped onto L1–L7'
      );
    }
  } catch (_) { /* fall through */ }
  const dash = await fetchSystemRhythm();
  return normalizeRhythmPayload(dash, dash.source, dash.note);
}

function synthRhythm(agents, placements) {
  const list = Array.isArray(agents) ? agents : [];
  const fakeLive = list.map((a) => ({
    agent_id: a.agent_id,
    actions_per_min: a.status === 'active' ? 0.4 : 0,
  }));
  return {
    source: 'synthetic_from_agents',
    note: 'Fallback only if dashboard parse fails. Bars = occupancy of 7×7 cells.',
    spec: 'monad.spec.rhythm.v0_3',
    triple: RHYTHM_TRIPLE,
    updated_at: new Date().toISOString(),
    layers: rhythmFromLive({ status: 'drifting' }, fakeLive, placements || {}),
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
  llmConfigured,
  identityIntent,
  composeHeuristicReply,
  postLkChatMessage,
  EMAIL_HUMAN_MAP,
  VERTICAL_LAYERS,
  VERTICAL_NUCLEI: VERTICAL_LAYERS,
  CIRCLE_SLOTS,
  CIRCLE_INACTIVE,
  publicLayer,
  publicNucleus: publicLayer,
  cellCode,
  parseCell,
  loadPlacements,
  placementOf,
  cellsOfPlacement,
  friendList,
  kindOfPlacement,
  CONTOUR_LABELS,
  PROJECT_LABELS,
  labelContour,
  labelProject,
  circleSlotFor,
  loadDirectoryPeople,
  RHYTHM_LAYERS,
  RHYTHM_TRIPLE,
  synthRhythm,
  fetchSystemRhythm,
  getRhythm,
  MONAD_DASHBOARD,
  MONAD_MCP_URL,
  MONAD_BASE,
};
