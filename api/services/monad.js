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

async function loadDirectoryPerson(humanId) {
  try {
    const rows = await mcpCall('read_context', {
      key_prefix: 'monad.directory.people.v1',
      limit: 3,
      reader_agent: 'neuro_agent',
    });
    const arr = Array.isArray(rows) ? rows : [];
    const people = (arr[0] && arr[0].value && arr[0].value.people) || {};
    return people[humanId] || null;
  } catch (_) {
    return null;
  }
}

async function loadHumanFacts(humanId) {
  try {
    const facts = await mcpCall('get_user_facts', { human_id: humanId });
    return Array.isArray(facts) ? facts : [];
  } catch (_) {
    return [];
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
  const first = String(name).split(' ')[0] || name;
  const aliases = (person && person.aliases) || [];
  const role = publicFact(factVal(facts, 'role') || (person && person.role_title) || '');
  const t = String(text || '').trim();
  const whoAmI = /кто\s+я|who\s+am\s+i|знаешь\s+кто|ты\s+знаешь\s+кто|who\s+is\s+this/i.test(t);
  const whoYou = /кто\s+ты|с\s+кем\s+я|who\s+are\s+you|who\s+am\s+i\s+talking|кто\s+это/i.test(t);
  const canDo = /умеешь|что ты можешь|доступ|контур|функц|что ты умеешь|к чему есть|what (can|do) you|access|contour|circuit|capabilit/i.test(t);
  const hi = /^(привет|хай|здравствуй|здравствуйте|hello|hi|hey|супер|о супер)\b/i.test(t);

  const contours = contourLines(person, humanId, lang);
  const contourBlock = contours.length
    ? (ru ? ('Контуры: ' + contours.join('; ') + '.') : ('Contours: ' + contours.join('; ') + '.'))
    : '';

  if (canDo) {
    if (ru) {
      return [
        `Я твоя Persona в этом чате ЛК — лицо Манады для тебя, не служебный канал.`,
        `Здесь я отвечаю сразу: ритм, вертикаль/горизонталь, задачи по сайту (атлас, Sketch, практики, кабинет), и разговор по контуру.`,
        contourBlock || 'Контур NeuroAttention: Lab / знание / обучение.',
        humanId === 'nikita'
          ? 'Доступ полный: founder NeuroAttention и super-admin кабинета. Скажи, что открыть или сделать — без эха твоего текста и без технических seed.'
          : 'Доступ — твой контур в Манаде и вкладка Монада в кабинете. Скажи, что сделать.',
      ].filter(Boolean).join(' ');
    }
    return [
      `I am your Monad Persona in this cabinet chat.`,
      `I answer here: rhythm, maps, site tasks (atlas, Sketch, practices, cabinet), and your contour.`,
      contourBlock,
      humanId === 'nikita'
        ? 'Access: founder / super-admin of NeuroAttention. Tell me what to open or do.'
        : 'Access: your Monad contour and the Monad tab. Tell me what to do.',
    ].filter(Boolean).join(' ');
  }

  if (whoAmI || (hi && /знаешь|know who/i.test(t))) {
    const aka = aliases.length ? ` (${aliases.slice(0, 3).join(', ')})` : '';
    if (ru) {
      return `Привет, ${first}. Да — ты ${name}${aka}${role ? '. ' + role : '.'} Это чат с Манадой в ЛК. Пиши сюда — отвечаю в этом же треде.`;
    }
    return `Hi, ${first}. Yes — you are ${name}${aka}${role ? '. ' + role : '.'} This is Monad in the cabinet. I answer in this same thread.`;
  }
  if (whoYou) {
    return ru
      ? `Я твоя Persona Манады в этом чате ЛК. Ритм, сайт, контур — спрашивай прямо.`
      : `I am your Monad Persona in this cabinet chat. Rhythm, site, contour — ask directly.`;
  }
  if (hi && t.length < 40) {
    return ru ? `Привет, ${first}. Я здесь, в этом же чате. Что нужно?` : `Hi, ${first}. I'm here. What do you need?`;
  }

  if (ru) {
    return [
      `Понял вопрос. Я Persona в этом чате ЛК.`,
      contourBlock,
      `Если это задача по NeuroAttention — напиши, что сделать. Могу про ритм, кабинет, атлас, Sketch, контуры.`,
    ].filter(Boolean).join(' ');
  }
  return [
    `Got it. I am Persona in this cabinet chat.`,
    contourBlock,
    `If it is a NeuroAttention task, say what to do — rhythm, cabinet, atlas, Sketch, contours.`,
  ].filter(Boolean).join(' ');
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
  const githubPat = process.env.GITHUB_PAT || '';

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
      }, 9000);
      const t = data && data.content && data.content[0] && data.content[0].text;
      if (t && String(t).trim()) return String(t).trim();
    } catch (e) {
      console.warn('[lk-llm] anthropic', e.message);
    }
  }

  const openaiish = [];
  if (openaiKey) openaiish.push({ url: 'https://api.openai.com/v1/chat/completions', key: openaiKey, model: process.env.LK_LLM_MODEL || 'gpt-4o-mini' });
  if (githubPat) openaiish.push({ url: 'https://models.github.ai/inference/chat/completions', key: githubPat, model: process.env.LK_LLM_MODEL || 'openai/gpt-4o-mini' });
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
      }, 9000);
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
  const llm = await tryLlmReply({ humanId, person, facts, text, history, personaAgent });
  if (llm && !isChannelAckText(llm)) return llm;
  return composeHeuristicReply({ humanId, person, facts, text });
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

/** Vertical 7×7 nuclei (IV-layers matrix — labels for MVP viz). */
const VERTICAL_NUCLEI = [
  { id: 'body', ru: 'Тело', en: 'Body', es: 'Cuerpo' },
  { id: 'emotion', ru: 'Эмоция', en: 'Emotion', es: 'Emoción' },
  { id: 'attention', ru: 'Внимание', en: 'Attention', es: 'Atención' },
  { id: 'meaning', ru: 'Смысл', en: 'Meaning', es: 'Sentido' },
  { id: 'relation', ru: 'Связь', en: 'Relation', es: 'Relación' },
  { id: 'action', ru: 'Действие', en: 'Action', es: 'Acción' },
  { id: 'field', ru: 'Поле', en: 'Field', es: 'Campo' },
];

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

/** Prefer native JSON /api/rhythm; fall back to dashboard HTML parse. */
async function getRhythm() {
  try {
    const headers = { Accept: 'application/json' };
    if (MONAD_API_KEY) headers['X-API-Key'] = MONAD_API_KEY;
    const res = await fetch(MONAD_BASE + '/api/rhythm', { headers });
    if (res.ok) {
      const data = await res.json();
      return {
        source: 'monad_api_rhythm',
        note: 'Native JSON /api/rhythm from monad-server',
        updated_at: (data && data.updated_at) || new Date().toISOString(),
        ...data,
      };
    }
  } catch (_) { /* fall through */ }
  return fetchSystemRhythm();
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
  RHYTHM_LAYERS,
  synthRhythm,
  fetchSystemRhythm,
  getRhythm,
  MONAD_DASHBOARD,
  MONAD_MCP_URL,
  MONAD_BASE,
};
