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
      ? `Вертикаль — 7 слоёв единого поля Манады, не «новые сущности». Снизу L1 Тело → L7 Поле. Наведи слой: внутри 7 ячеек. Нажми — агенты этого слоя, чей контур, статус.`
      : `Vertical is 7 layers of Monad (L1 Body at the bottom → L7 Field). Hover a layer for 7 inner cells; click for agents.`;
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
 * Vertical 7×7 — seven layers of ONE Monad field (L1 bottom → L7 top).
 * Inner cells are functions of that layer, not new products.
 * Clock seats for Horizontal 12+1 (Nick at 12, Tahir opposite at 6).
 */
const VERTICAL_NUCLEI = [
  {
    id: 'body', layer: 1, ru: 'Тело', en: 'Body', es: 'Cuerpo',
    sense_ru: 'Сома и физиология поля.',
    sense_en: 'Soma and physiology of the field.',
    sense_es: 'Soma y fisiología del campo.',
    cells: [
      { n: 1, ru: 'Сома', en: 'Soma', es: 'Soma', kw: /soma|skin|tissue/ },
      { n: 2, ru: 'Висцера', en: 'Viscera', es: 'Víscera', kw: /organ|viscer|gut/ },
      { n: 3, ru: 'Дыхание', en: 'Breath', es: 'Respiración', kw: /breath|respir/ },
      { n: 4, ru: 'Моторика', en: 'Motor', es: 'Motor', kw: /motor|sport|move|motion|physio/ },
      { n: 5, ru: 'Интероцепция', en: 'Interoception', es: 'Interocepción', kw: /intero|sensation|pain|anatomy/ },
      { n: 6, ru: 'Поза', en: 'Posture', es: 'Postura', kw: /posture|balance|spine/ },
      { n: 7, ru: 'Восстановление', en: 'Recovery', es: 'Recuperación', kw: /recover|sleep|rehab|heal|health/ },
    ],
  },
  {
    id: 'emotion', layer: 2, ru: 'Эмоция', en: 'Emotion', es: 'Emoción',
    sense_ru: 'Аффект, валентность, регуляция.',
    sense_en: 'Affect, valence, regulation.',
    sense_es: 'Afecto, valencia, regulación.',
    cells: [
      { n: 1, ru: 'Валентность', en: 'Valence', es: 'Valencia', kw: /valen/ },
      { n: 2, ru: 'Возбуждение', en: 'Arousal', es: 'Activación', kw: /arousal|activ/ },
      { n: 3, ru: 'Аффект', en: 'Affect', es: 'Afecto', kw: /affect|feel|emot/ },
      { n: 4, ru: 'Эмпатия', en: 'Empathy', es: 'Empatía', kw: /empath/ },
      { n: 5, ru: 'Настроение', en: 'Mood', es: 'Ánimo', kw: /mood/ },
      { n: 6, ru: 'Травма', en: 'Trauma', es: 'Trauma', kw: /trauma|psych/ },
      { n: 7, ru: 'Регуляция', en: 'Regulation', es: 'Regulación', kw: /regulat/ },
    ],
  },
  {
    id: 'attention', layer: 3, ru: 'Внимание', en: 'Attention', es: 'Atención',
    sense_ru: 'Фокус, переключение, торможение.',
    sense_en: 'Focus, switching, inhibition.',
    sense_es: 'Foco, cambio, inhibición.',
    cells: [
      { n: 1, ru: 'Фокус', en: 'Focus', es: 'Foco', kw: /focus|neuro/ },
      { n: 2, ru: 'Удержание', en: 'Sustain', es: 'Sostener', kw: /sustain|hold/ },
      { n: 3, ru: 'Переключение', en: 'Switch', es: 'Cambio', kw: /switch/ },
      { n: 4, ru: 'Торможение', en: 'Inhibit', es: 'Inhibir', kw: /inhibit/ },
      { n: 5, ru: 'Сканирование', en: 'Scan', es: 'Barrido', kw: /scan|perception/ },
      { n: 6, ru: 'Замечание', en: 'Notice', es: 'Notar', kw: /notice|cognit/ },
      { n: 7, ru: 'Покой', en: 'Rest', es: 'Reposo', kw: /rest|exercis/ },
    ],
  },
  {
    id: 'meaning', layer: 4, ru: 'Смысл', en: 'Meaning', es: 'Sentido',
    sense_ru: 'Канон, метод, знание, язык.',
    sense_en: 'Canon, method, knowledge, language.',
    sense_es: 'Canon, método, saber, lenguaje.',
    cells: [
      { n: 1, ru: 'Канон', en: 'Canon', es: 'Canon', kw: /canon/ },
      { n: 2, ru: 'Метод', en: 'Method', es: 'Método', kw: /method|protocol/ },
      { n: 3, ru: 'Знание', en: 'Knowledge', es: 'Saber', kw: /know|learn/ },
      { n: 4, ru: 'Язык', en: 'Language', es: 'Lengua', kw: /lang|book|reader|content/ },
      { n: 5, ru: 'Нарратив', en: 'Narrative', es: 'Narrativa', kw: /narr|stor/ },
      { n: 6, ru: 'Символ', en: 'Symbol', es: 'Símbolo', kw: /symbol/ },
      { n: 7, ru: 'Протокол', en: 'Protocol', es: 'Protocolo', kw: /course|lesson/ },
    ],
  },
  {
    id: 'relation', layer: 5, ru: 'Связь', en: 'Relation', es: 'Relación',
    sense_ru: 'Контур, персона, команда, забота.',
    sense_en: 'Contour, persona, team, care.',
    sense_es: 'Contorno, persona, equipo, cuidado.',
    cells: [
      { n: 1, ru: 'Семья', en: 'Family', es: 'Familia', kw: /family/ },
      { n: 2, ru: 'Команда', en: 'Team', es: 'Equipo', kw: /team/ },
      { n: 3, ru: 'Контур', en: 'Contour', es: 'Contorno', kw: /contour|human/ },
      { n: 4, ru: 'Персона', en: 'Persona', es: 'Persona', kw: /persona/ },
      { n: 5, ru: 'Социум', en: 'Social', es: 'Social', kw: /social|comms|telegram/ },
      { n: 6, ru: 'Забота', en: 'Care', es: 'Cuidado', kw: /care/ },
      { n: 7, ru: 'Конфликт', en: 'Conflict', es: 'Conflicto', kw: /conflict/ },
    ],
  },
  {
    id: 'action', layer: 6, ru: 'Действие', en: 'Action', es: 'Acción',
    sense_ru: 'Код, ops, сборка, исполнение.',
    sense_en: 'Code, ops, build, execute.',
    sense_es: 'Código, ops, construir, ejecutar.',
    cells: [
      { n: 1, ru: 'Код', en: 'Code', es: 'Código', kw: /code|dev/ },
      { n: 2, ru: 'Ops', en: 'Ops', es: 'Ops', kw: /ops|devops/ },
      { n: 3, ru: 'Финансы', en: 'Finance', es: 'Finanzas', kw: /finance/ },
      { n: 4, ru: 'Сборка', en: 'Build', es: 'Build', kw: /build|agent/ },
      { n: 5, ru: 'Порядок', en: 'Order', es: 'Orden', kw: /order/ },
      { n: 6, ru: 'Ремонт', en: 'Repair', es: 'Reparar', kw: /repair/ },
      { n: 7, ru: 'Исполнение', en: 'Execute', es: 'Ejecutar', kw: /execut|action/ },
    ],
  },
  {
    id: 'field', layer: 7, ru: 'Поле', en: 'Field', es: 'Campo',
    sense_ru: 'Коллектив, ритм, DOM, пространство.',
    sense_en: 'Collective, rhythm, DOM, space.',
    sense_es: 'Colectivo, ritmo, DOM, espacio.',
    cells: [
      { n: 1, ru: 'Пространство', en: 'Space', es: 'Espacio', kw: /space|spatial/ },
      { n: 2, ru: 'Коллектив', en: 'Collective', es: 'Colectivo', kw: /collect/ },
      { n: 3, ru: 'Ритм', en: 'Rhythm', es: 'Ritmo', kw: /rhythm/ },
      { n: 4, ru: 'DOM', en: 'DOM', es: 'DOM', kw: /\bdom\b/ },
      { n: 5, ru: 'XR', en: 'XR', es: 'XR', kw: /\bxr\b|lab/ },
      { n: 6, ru: 'Сайт', en: 'Site', es: 'Sitio', kw: /site|web/ },
      { n: 7, ru: 'Поле', en: 'Field', es: 'Campo', kw: /field/ },
    ],
  },
];

/** Fixed 12+1 clock. Nick at 12, Tahir opposite at 6. */
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

function publicNucleus(n) {
  return {
    id: n.id,
    layer: n.layer,
    ru: n.ru,
    en: n.en,
    es: n.es,
    sense_ru: n.sense_ru,
    sense_en: n.sense_en,
    sense_es: n.sense_es,
    cells: (n.cells || []).map((c) => ({ n: c.n, code: n.layer + '-' + c.n, ru: c.ru, en: c.en, es: c.es })),
  };
}

function cellForAgent(agent, nucleusId) {
  const n = VERTICAL_NUCLEI.find((x) => x.id === nucleusId);
  const blob = `${agent.agent_id || ''} ${(agent.domains || []).join(' ')} ${agent.name || ''}`.toLowerCase();
  if (n && n.cells) {
    for (const c of n.cells) {
      if (c.kw && c.kw.test(blob)) return c.n;
    }
  }
  let h = 0;
  const s = String(agent.agent_id || agent.name || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 7) + 1;
}

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
  VERTICAL_NUCLEI,
  CIRCLE_SLOTS,
  publicNucleus,
  cellForAgent,
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
