// PR #91 verification — Family & Team (Phase 2A) on the LIVE Railway API +
// dashboard. Registers two throwaway users, exercises the full family/dependent/
// team/invite/search/subject-scope API, then a puppeteer smoke test that the
// "Family & Team" sub-tab renders and the Add-Child form opens.
//
//   node scripts/pr91-verify.mjs            (API only)
//   UI=1 node scripts/pr91-verify.mjs       (also run the puppeteer UI smoke)
//
// Per [[atlas-live-verification-harness]] / [[test-local-superadmin-env]]: uses
// @test.local throwaways; superadmin cleanup catches them later.

const AUTH = process.env.AUTH_API || 'https://neuroattention-api-production.up.railway.app';
const SITE = process.env.SITE || 'https://neuroattention.org/account.html';
const out = { api: {}, ui: null, pass: true, fails: [] };
const assert = (name, cond, extra) => { out.api[name] = cond ? 'PASS' : ('FAIL ' + (extra ? JSON.stringify(extra) : '')); if (!cond) { out.pass = false; out.fails.push(name); } };

async function reg(tag) {
  const email = tag + '-' + Date.now() + Math.floor(Math.random() * 1e4) + '@test.local';
  const r = await fetch(AUTH + '/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test12345!', display_name: tag, country: 'RU', city: 'Moscow', location_lat: 55.75, location_lon: 37.62 }),
  });
  const j = await r.json();
  return { email, token: j.token };
}
const H = (tok) => ({ 'content-type': 'application/json', authorization: 'Bearer ' + tok });
const jget = (p, tok) => fetch(AUTH + p, { headers: H(tok) }).then(r => r.json().then(d => ({ status: r.status, d })));
const jpost = (p, tok, body) => fetch(AUTH + p, { method: 'POST', headers: H(tok), body: JSON.stringify(body || {}) }).then(r => r.json().then(d => ({ status: r.status, d })).catch(() => ({ status: r.status, d: {} })));
const jdel = (p, tok) => fetch(AUTH + p, { method: 'DELETE', headers: H(tok) }).then(r => r.json().then(d => ({ status: r.status, d })));

const A = await reg('fam-a');
const B = await reg('fam-b');
if (!A.token || !B.token) { console.log(JSON.stringify({ fatal: 'register failed', A, B })); process.exit(1); }

// 1) create a family
let r = await jpost('/api/teams', A.token, { name: 'Verify Family', kind: 'family', my_role: 'mother' });
assert('create_family', r.status === 201 && r.d.team && r.d.team.kind === 'family', r);
const familyId = r.d.team && r.d.team.id;

// 2) add a born child with a diagnosis
const conds = (await jget('/api/anatomy/conditions?limit=5', A.token)).d.conditions || [];
const diagId = conds[0] && conds[0].id;
r = await jpost('/api/dependents', A.token, { name: 'Anna', sex: 'female', birth_date: '2024-09-01', relation: 'daughter', family_id: familyId, diagnoses_ids: diagId ? [diagId] : [] });
assert('add_child_born', r.status === 201 && r.d.dependent && ['infant', 'toddler'].includes(r.d.dependent.phase), r);
const childId = r.d.dependent && r.d.dependent.id;

// 3) add an unborn child → prenatal + gestation weeks
const due = new Date(Date.now() + 100 * 864e5).toISOString().slice(0, 10);
r = await jpost('/api/dependents', A.token, { name: 'Baby', sex: 'other', expected_due_date: due, relation: 'son', family_id: familyId });
assert('add_child_prenatal', r.status === 201 && r.d.dependent.phase === 'prenatal' && typeof r.d.dependent.gestation_weeks === 'number', r);

// 4) list dependents
r = await jget('/api/dependents', A.token);
assert('list_dependents', r.status === 200 && (r.d.dependents || []).length === 2, r);

// 5) constraint: neither date → 400
r = await jpost('/api/dependents', A.token, { name: 'NoDate' });
assert('dependent_requires_date', r.status === 400, r);

// 6) PATCH a dependent
r = await fetch(AUTH + '/api/dependents/' + childId, { method: 'PATCH', headers: H(A.token), body: JSON.stringify({ name: 'Anna R.' }) }).then(x => x.json());
assert('patch_dependent', r.dependent && r.dependent.name === 'Anna R.', r);

// 7) ownership isolation: B cannot read A's dependent
r = await jget('/api/dependents/' + childId, B.token);
assert('dependent_owner_isolation', r.status === 404, r);

// 8) family invite link → B previews + joins
r = await jpost('/api/teams/' + familyId + '/invite', A.token, { role: 'partner' });
assert('gen_invite', r.status === 201 && r.d.token, r);
const tok = r.d.token;
r = await jget('/api/teams/join/' + tok, B.token);
assert('preview_invite', r.status === 200 && r.d.valid === true && r.d.team_id === familyId, r);
r = await jpost('/api/teams/join/' + tok, B.token, {});
assert('accept_invite', r.status === 200 && r.d.team_id === familyId, r);
r = await jget('/api/teams', B.token);
assert('b_now_in_family', (r.d.teams || []).some(t => t.id === familyId), r);

// 9) create a public team + search + direct join
r = await jpost('/api/teams', A.token, { name: 'Verify Public Team ' + Date.now(), kind: 'team', is_public: true, description: 'searchable squad' });
assert('create_team', r.status === 201 && r.d.team.kind === 'team', r);
const teamName = r.d.team.name;
r = await jget('/api/teams/search?q=' + encodeURIComponent(teamName.slice(0, 12)), B.token);
assert('search_team', r.status === 200 && (r.d.teams || []).some(t => t.name === teamName), r);
const teamId = r.d.teams.find(t => t.name === teamName).id;
r = await jpost('/api/teams/' + teamId + '/join', B.token, {});
assert('direct_join_public', r.status === 200 && r.d.team_id === teamId, r);

// 10) evolution subject scoping — owner can read child path (empty but 200), others 403
r = await jget('/api/users/me/evolution?subject=dependent:' + childId, A.token);
assert('evolution_subject_owner', r.status === 200 && r.d.ok === true, { status: r.status });
r = await jget('/api/users/me/evolution?subject=dependent:' + childId, B.token);
assert('evolution_subject_isolation', r.status === 403, { status: r.status });
r = await jget('/api/users/me/evolution?subject=team:' + familyId, B.token);
assert('evolution_subject_team_member', r.status === 200, { status: r.status });

// 11) soft-delete dependent
r = await jdel('/api/dependents/' + childId, A.token);
assert('delete_dependent', r.status === 200, r);
r = await jget('/api/dependents', A.token);
assert('deleted_dependent_gone', !(r.d.dependents || []).some(d => d.id === childId), r);

// ── optional UI smoke ──
if (process.env.UI === '1') {
  const CHROME = process.env.CHROME ||
    '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  const puppeteer = (await import('/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).default;
  const me = (await jget('/api/auth/me', A.token)).d;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1000'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
  await page.evaluateOnNewDocument((tok, usr) => { localStorage.setItem('na_token', tok); localStorage.setItem('na_user', JSON.stringify(usr)); }, A.token, me.user || me);
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction('typeof window.switchTab === "function"', { timeout: 30000 });
  await page.evaluate(() => { window.switchTab('evolution'); if (window.evoSwitchSub) window.evoSwitchSub('family'); });
  await new Promise(r => setTimeout(r, 2500));
  const ui = await page.evaluate(() => {
    const box = document.getElementById('family-team');
    return {
      visible: !!(box && box.offsetParent !== null),
      hasTitle: !!(box && /Семья|Family|Familia/.test(box.textContent || '')),
      hasAddChild: !!(box && box.querySelector('#ft-add-child, #ft-create-family')),
    };
  });
  // open add-child if a family exists, else create-family modal
  await page.evaluate(() => { const b = document.querySelector('#ft-add-child') || document.querySelector('#ft-create-family'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 800));
  ui.modalOpened = await page.evaluate(() => !!document.querySelector('.ft-modal'));
  ui.errors = errs.filter(e => !/ResizeObserver|IndexSizeError/.test(e));
  try { await page.screenshot({ path: (process.env.SHOT || '/tmp') + '/pr91-family.png' }); ui.shot = (process.env.SHOT || '/tmp') + '/pr91-family.png'; } catch (e) {}
  out.ui = ui;
  assert('ui_tab_renders', ui.visible && ui.hasTitle, ui);
  assert('ui_modal_opens', ui.modalOpened, ui);
  await browser.close();
}

console.log(JSON.stringify(out, null, 2));
process.exit(out.pass ? 0 : 1);
