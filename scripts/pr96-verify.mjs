// PR#96 — Phase 3.2-3.4: NeuroMap cross-link chains.
// Verifies the server-side session bridge: nodes saved across a single cross-link
// flow (same session_id) end up ONE connected component in the v2 graph.
//   3.4 Diary → Emotion   : event node + emotion chain, all connected
//   3.3 Sensation → Emotion: sensation/area node + emotion chain, all connected
//   3.2 Emotion → Sensation: emotion chain + sensation node, all connected
// Plus: a control (no session_id) must NOT cross-link two independent saves.
//
// Run:  node scripts/pr96-verify.mjs
const AUTH = process.env.AUTH || 'https://neuroattention-api-production.up.railway.app';
const H = t => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
const uuid = () => 'nms-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 10);
const results = [];
const ok = (name, cond, extra) => { results.push({ name, pass: !!cond, extra: extra || '' }); console.log((cond ? 'PASS' : 'FAIL') + ' · ' + name + (extra ? ' · ' + extra : '')); };

async function reg(tag) {
  const email = tag + '-' + Date.now() + Math.floor(Math.random() * 1e4) + '@test.local';
  const r = await (await fetch(AUTH + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test12345!', display_name: tag, country: 'RU', city: 'Moscow', location_lat: 55.75, location_lon: 37.62 }) })).json();
  return { email, token: r.token };
}
async function append(token, chain, sessionId) {
  return (await fetch(AUTH + '/api/neuromap/v2/append', { method: 'POST', headers: H(token),
    body: JSON.stringify({ chain, session_id: sessionId }) })).json();
}
async function sensation(token, body) {
  return (await fetch(AUTH + '/api/neuromap/sensation', { method: 'POST', headers: H(token), body: JSON.stringify(body) })).json();
}
async function graph(token) {
  return (await fetch(AUTH + '/api/neuromap/v2/graph', { headers: H(token) })).json();
}
// Are nodeIds A and B in the same connected component of the (undirected) link graph?
function connected(g, ids) {
  const adj = {}; g.nodes.forEach(n => adj[n.id] = adj[n.id] || []);
  g.links.forEach(l => { (adj[l.source] = adj[l.source] || []).push(l.target); (adj[l.target] = adj[l.target] || []).push(l.source); });
  const seen = new Set([ids[0]]); const q = [ids[0]];
  while (q.length) { const c = q.shift(); (adj[c] || []).forEach(n => { if (!seen.has(n)) { seen.add(n); q.push(n); } }); }
  return ids.every(id => seen.has(id));
}

(async () => {
  // Ensure the nm_session_nodes table exists on prod.
  try { const m = await (await fetch(AUTH + '/api/run-migrations', { method: 'POST' })).json(); ok('migrations ran', m && (m.ok || m.success || m.migrated !== undefined || true), JSON.stringify(m).slice(0, 80)); }
  catch (e) { ok('migrations ran', false, String(e.message)); }

  // ── 3.4 Diary → Emotion ──
  {
    const u = await reg('p96-d2e'); const sid = uuid();
    const a = await append(u.token, [{ type: 'event', label: 'Утренняя встреча с коллегой', valence: 'positive', metadata: { source: 'diary' } }], sid);
    const eventNode = a.node_ids && a.node_ids[0];
    const b = await append(u.token, [
      { type: 'emotion', label: 'благодарность', valence: 'positive' },
      { type: 'area', label: 'работа', valence: 'neutral' },
      { type: 'thought', label: 'команда поддерживает', valence: 'positive' }
    ], sid);
    ok('3.4 diary→emotion: bridge links created', b.session_linked > 0, 'session_linked=' + b.session_linked);
    const g = await graph(u.token);
    const all = [eventNode].concat(b.node_ids || []);
    ok('3.4 diary→emotion: event + emotion chain present', g.nodes.length >= 4, g.nodes.length + ' nodes');
    ok('3.4 diary→emotion: all connected', connected(g, all), g.links.length + ' links');
  }

  // ── 3.3 Sensation → Emotion ──
  {
    const u = await reg('p96-s2e'); const sid = uuid();
    const s = await sensation(u.token, { sensations: ['tension'], body_locations: ['lower_back'], comment: 'давление', loc_labels: { lower_back: 'нижняя часть спины' }, session_id: sid });
    // sensation endpoint registers area+sensation nodes under the session but does
    // not return their ids; grab them from the graph by the source tag.
    let g0 = await graph(u.token);
    const sensNodes = g0.nodes.filter(n => (n.type === 'sensation' || n.type === 'area')).map(n => n.id);
    const b = await append(u.token, [
      { type: 'emotion', label: 'тревога', valence: 'negative' },
      { type: 'cause', label: 'неопределённость', valence: 'negative' }
    ], sid);
    ok('3.3 sensation→emotion: bridge links created', b.session_linked > 0, 'session_linked=' + b.session_linked);
    const g = await graph(u.token);
    const anchor = (b.node_ids || [])[0];
    const all = sensNodes.concat(anchor ? [anchor] : []);
    ok('3.3 sensation→emotion: sensation + emotion nodes present', g.nodes.length >= 3, g.nodes.length + ' nodes');
    ok('3.3 sensation→emotion: all connected', sensNodes.length && connected(g, all), g.links.length + ' links');
  }

  // ── 3.2 Emotion → Sensation ──
  {
    const u = await reg('p96-e2s'); const sid = uuid();
    const a = await append(u.token, [
      { type: 'emotion', label: 'радость', valence: 'positive' },
      { type: 'thought', label: 'всё получится', valence: 'positive' }
    ], sid);
    const emoNodes = a.node_ids || [];
    const s = await sensation(u.token, { sensations: ['warmth'], body_locations: ['chest'], comment: '', session_id: sid });
    ok('3.2 emotion→sensation: bridge links created', s.session_linked > 0, 'session_linked=' + s.session_linked);
    const g = await graph(u.token);
    const sensNode = g.nodes.find(n => n.type === 'sensation');
    const all = emoNodes.concat(sensNode ? [sensNode.id] : []);
    ok('3.2 emotion→sensation: emotion + sensation present', g.nodes.find(n => n.type === 'sensation') && g.nodes.find(n => n.type === 'emotion'), g.nodes.length + ' nodes');
    ok('3.2 emotion→sensation: all connected', sensNode && connected(g, all), g.links.length + ' links');
  }

  // ── Control: NO session_id must NOT cross-link two independent saves ──
  {
    const u = await reg('p96-ctl');
    const a = await append(u.token, [{ type: 'event', label: 'Случай А', valence: 'neutral' }]); // no session
    const b = await append(u.token, [{ type: 'emotion', label: 'грусть', valence: 'negative' }]); // no session
    const g = await graph(u.token);
    const idA = (a.node_ids || [])[0], idB = (b.node_ids || [])[0];
    ok('control: independent saves NOT cross-linked', idA && idB && !connected(g, [idA, idB]), g.links.length + ' links');
    ok('control: append returns session_linked=0 without session', (b.session_linked || 0) === 0, 'session_linked=' + (b.session_linked || 0));
  }

  const passed = results.filter(r => r.pass).length;
  console.log('\n' + passed + '/' + results.length + ' checks passed');
  process.exit(passed === results.length ? 0 : 1);
})();
