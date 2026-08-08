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

/** plant_seed.planted_by must be an existing agent_id (FK). Prefer human-named agent. */
const PLANTED_BY_FALLBACK = {
  nikita: 'nikita',
  nastya: 'nastya',
  takhir: 'companion',
  alisa: 'companion',
  sofia: 'companion',
  egor: 'companion',
  artem: 'companion',
};

function resolvePlantedBy(humanId) {
  const h = String(humanId || '').toLowerCase();
  if (PLANTED_BY_FALLBACK[h]) return PLANTED_BY_FALLBACK[h];
  return h || 'companion';
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
 * REAL system rhythm already computed by monad-server and shown on /dashboard
 * ("Ритм системы": harmonic|drifting|dissonant|silence + per-agent actions/min).
 * There is still NO JSON /api/rhythm — we parse the public HTML until Monad ships it.
 * This is NOT the biological equalizer (circ/breath/heart) from spec XI — that layer
 * set is still not exposed as live data (confirmed 2026-08-08).
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

/** Try JSON /api/rhythm first; fall back to dashboard HTML parse. */
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
        updated_at: new Date().toISOString(),
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
  EMAIL_HUMAN_MAP,
  PLANTED_BY_FALLBACK,
  VERTICAL_NUCLEI,
  RHYTHM_LAYERS,
  synthRhythm,
  fetchSystemRhythm,
  getRhythm,
  MONAD_DASHBOARD,
  MONAD_MCP_URL,
  MONAD_BASE,
};
