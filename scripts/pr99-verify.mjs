// PR #99 verification — Phase 2B: dual-timeline Personal Path + tool-side
// "For: Me / [child]" target selector, on the LIVE Railway API + dashboard.
//
//   node scripts/pr99-verify.mjs            (API only)
//   UI=1 node scripts/pr99-verify.mjs       (also run the puppeteer UI smoke)
//
// API: registers a throwaway parent, creates a born + a prenatal child, then
// exercises emotion (v2/append) / sensation / diary saves WITH and WITHOUT a
// dependent_id and asserts the child-targeted entries land on the CHILD's path
// (and NOT on the parent's), self entries land on the parent, and an invalid
// dependent_id safely falls back to self. Per [[test-local-superadmin-env]]:
// uses @test.local throwaways; superadmin cleanup catches them later.

const AUTH = process.env.AUTH_API || 'https://neuroattention-api-production.up.railway.app';
const SITE = process.env.SITE || 'https://neuroattention.org/account.html';
const out = { api: {}, ui: null, pass: true, fails: [] };
const assert = (name, cond, extra) => { out.api[name] = cond ? 'PASS' : ('FAIL ' + (extra ? JSON.stringify(extra) : '')); if (!cond) { out.pass = false; out.fails.push(name); } };

const H = (tok) => ({ 'content-type': 'application/json', authorization: 'Bearer ' + tok });
const jget = (p, tok) => fetch(AUTH + p, { headers: H(tok) }).then(r => r.json().then(d => ({ status: r.status, d })).catch(() => ({ status: r.status, d: {} })));
const jpost = (p, tok, body) => fetch(AUTH + p, { method: 'POST', headers: H(tok), body: JSON.stringify(body || {}) }).then(r => r.json().then(d => ({ status: r.status, d })).catch(() => ({ status: r.status, d: {} })));

async function reg(tag) {
  const email = tag + '-' + Date.now() + Math.floor(Math.random() * 1e4) + '@test.local';
  const r = await fetch(AUTH + '/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test12345!', display_name: tag, country: 'RU', city: 'Moscow', location_lat: 55.75, location_lon: 37.62 }),
  });
  const j = await r.json();
  return { email, token: j.token };
}

// Count journey events on a given scope's path over a wide window.
const WIDE = '&from=2020-01-01T00:00:00.000Z&to=' + new Date(Date.now() + 864e5).toISOString();
async function pathCount(tok, subject) {
  const q = '/api/users/me/evolution?lang=ru' + WIDE + (subject ? '&subject=' + encodeURIComponent(subject) : '');
  const r = await jget(q, tok);
  const ev = (r.d && Array.isArray(r.d.events)) ? r.d.events.length : -1;
  return { status: r.status, ev, totals: r.d && r.d.totals };
}

const A = await reg('pr99');
if (!A.token) { console.log(JSON.stringify({ fatal: 'register failed', A })); process.exit(1); }

// Born child + prenatal child
let r = await jpost('/api/dependents', A.token, { name: 'DualKid', sex: 'male', birth_date: '2022-05-01', relation: 'son' });
assert('add_child_born', r.status === 201 && r.d.dependent && r.d.dependent.id, r);
const childId = r.d.dependent && r.d.dependent.id;
const due = new Date(Date.now() + 100 * 864e5).toISOString().slice(0, 10);
r = await jpost('/api/dependents', A.token, { name: 'DualBaby', sex: 'other', expected_due_date: due, relation: 'daughter' });
assert('add_child_prenatal', r.status === 201 && r.d.dependent.phase === 'prenatal' && typeof r.d.dependent.gestation_weeks === 'number', r);
const babyId = r.d.dependent && r.d.dependent.id;

// Baselines
const parent0 = await pathCount(A.token, null);
const child0 = await pathCount(A.token, 'dependent:' + childId);
assert('child_path_empty_baseline', child0.status === 200 && child0.ev === 0, child0);

// ── 1) Emotion (v2/append) FOR the child ──
r = await jpost('/api/neuromap/v2/append', A.token, {
  chain: [{ type: 'emotion', label: 'радость', valence: 'positive', metadata: {} }, { type: 'thought', label: 'всё хорошо', valence: 'positive', metadata: {} }],
  dependent_id: childId,
});
assert('emotion_dep_ok', r.status === 200 && r.d.ok && r.d.dependent_id === childId && (r.d.journey_ids || []).length >= 1 && (r.d.node_ids || []).length === 0, r);

// ── 2) Sensation FOR the child ──
const vocab = (await jget('/api/neuromap/vocabulary', A.token)).d || {};
const sensSlug = ((vocab.sensations || vocab.sensation || [])[0] || {}).slug || 'tension';
const locSlug = ((vocab.body_locations || vocab.locations || [])[0] || {}).slug || 'head';
r = await jpost('/api/neuromap/sensation', A.token, { sensations: [sensSlug], body_locations: [locSlug], comment: 'для ребёнка', intensity: 6, dependent_id: childId });
assert('sensation_dep_ok', r.status === 200 && r.d.ok && r.d.dependent_id === childId && r.d.journey_id, r);

// ── 3) Diary FOR the child ──
const dk = new Date().toISOString().slice(0, 10);
r = await jpost('/api/diary/save', A.token, { date_key: dk, text: 'первый шаг ребёнка', comment: '', plus_count: 1, minus_count: 0, time: '12:00', dependent_id: childId });
assert('diary_dep_ok', r.status === 200 && r.d.ok && r.d.dependent_id === childId && r.d.journey_id, r);

// ── child path now carries all three; parent path unchanged by them ──
const child1 = await pathCount(A.token, 'dependent:' + childId);
assert('child_path_got_events', child1.status === 200 && child1.ev >= 3, { child0, child1 });
const parent1 = await pathCount(A.token, null);
assert('parent_path_unaffected_by_child', parent1.ev === parent0.ev, { parent0, parent1 });

// ── 4) Self saves (no dependent_id) land on the PARENT path, not the child's ──
r = await jpost('/api/neuromap/v2/append', A.token, { chain: [{ type: 'emotion', label: 'спокойствие', valence: 'positive', metadata: {} }] });
assert('emotion_self_ok', r.status === 200 && r.d.ok && !r.d.dependent_id && (r.d.node_ids || []).length >= 1, r);
const parent2 = await pathCount(A.token, null);
assert('parent_path_got_self', parent2.ev > parent1.ev, { parent1, parent2 });
const child2 = await pathCount(A.token, 'dependent:' + childId);
assert('child_path_unaffected_by_self', child2.ev === child1.ev, { child1, child2 });

// ── 5) Invalid dependent_id → graceful fallback to self (no 500, no dep echo) ──
r = await jpost('/api/neuromap/v2/append', A.token, { chain: [{ type: 'emotion', label: 'тест', valence: 'neutral', metadata: {} }], dependent_id: 999999999 });
assert('invalid_dep_falls_back_to_self', r.status === 200 && r.d.ok && !r.d.dependent_id && (r.d.node_ids || []).length >= 1, r);

// ── 6) prenatal baby path scope works (owner-gated 200) ──
r = await jget('/api/users/me/evolution?subject=dependent:' + babyId + WIDE, A.token);
assert('prenatal_scope_ok', r.status === 200 && r.d.ok === true, { status: r.status });

// ── optional UI smoke ──
if (process.env.UI === '1') {
  const CHROME = process.env.CHROME ||
    '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  let puppeteer;
  try { puppeteer = (await import('/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).default; }
  catch (e) { puppeteer = (await import(new URL('./node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js', import.meta.url).href)).default; }
  const me = (await jget('/api/auth/me', A.token)).d;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1500,1000'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000 });
  const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.evaluateOnNewDocument((tok, usr) => { localStorage.setItem('na_token', tok); localStorage.setItem('na_user', JSON.stringify(usr)); }, A.token, me.user || me);
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction('typeof window.switchTab === "function"', { timeout: 30000 });

  // Hub "For: Me / [child]" target selector (Tools/dashboard right panel)
  await new Promise(r => setTimeout(r, 2000));
  const hub = await page.evaluate(() => {
    const row = document.getElementById('nm-target-row');
    const sel = document.getElementById('nm-target-select');
    return {
      rowShown: !!(row && getComputedStyle(row).display !== 'none'),
      optionCount: sel ? sel.options.length : 0,
      hasChildOption: sel ? Array.from(sel.options).some(o => /DualKid|DualBaby/.test(o.textContent)) : false,
    };
  });
  out.ui = { hub };
  assert('ui_hub_selector_shown', hub.rowShown && hub.optionCount >= 2 && hub.hasChildOption, hub);

  // Personal Path dual switcher
  await page.evaluate(() => { window.switchTab('evolution'); if (window.evoSwitchSub) window.evoSwitchSub('personal'); });
  await page.waitForFunction(() => { const h = document.querySelector('#evo-path .myc-evo-head'); return h && h.querySelector('.myc-seg[data-seg="viewType"]'); }, { timeout: 20000 }).catch(() => {});
  const sw = await page.evaluate(() => {
    const seg = document.querySelector('#evo-path .myc-seg[data-seg="viewType"]');
    return { switcherShown: !!(seg && seg.offsetParent !== null), buttons: seg ? Array.from(seg.querySelectorAll('button')).map(b => b.getAttribute('data-val')) : [] };
  });
  out.ui.switcher = sw;
  assert('ui_dual_switcher_shown', sw.switcherShown && sw.buttons.includes('dual'), sw);

  // Switch to dual → two spine canvases
  await page.evaluate(() => { const b = document.querySelector('#evo-path .myc-seg[data-seg="viewType"] button[data-val="dual"]'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 3000));
  const dual = await page.evaluate(() => ({
    canvases: document.querySelectorAll('#evo-path canvas.evo-2d').length,
    topPane: !!document.querySelector('#evo-path .evo-dual-top'),
    botPane: !!document.querySelector('#evo-path .evo-dual-bot'),
  }));
  out.ui.dual = dual;
  assert('ui_dual_two_spines', dual.canvases === 2 && dual.topPane && dual.botPane, dual);

  out.ui.errors = errs.filter(e => !/ResizeObserver|IndexSizeError/.test(e));
  assert('ui_no_page_errors', out.ui.errors.length === 0, out.ui.errors);
  try { await page.screenshot({ path: (process.env.SHOT || '/tmp') + '/pr99-dual.png' }); out.ui.shot = (process.env.SHOT || '/tmp') + '/pr99-dual.png'; } catch (e) {}
  await browser.close();
}

console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
