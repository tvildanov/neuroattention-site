// PR92 — verify the Family child flow + Layers cluster-fan on LIVE prod.
//  1. create family → Add Child (prenatal, due +60d) → card shows term + diagnosis
//  2. Edit reopens the form prefilled (name/sex/due)
//  3. View Path opens the wide modal: pregnancy header + the child's evolution line
//  4. Layers tab: a same-session chain of 10 events fans out (distinct Y, not 1 dot)
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH = 'https://neuroattention-api-production.up.railway.app';
const SITE = 'https://neuroattention.org/account.html';
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const H = t => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const email = 'p92-' + Date.now() + '@test.local';
const reg = await (await fetch(AUTH + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test12345!', display_name: 'Папа Тест', country: 'RU', city: 'Moscow', location_lat: 55.75, location_lon: 37.62 }) })).json();
const token = reg.token;
const me = await (await fetch(AUTH + '/api/auth/me', { headers: H(token) })).json();
const meUser = me.user || me;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1440,1100'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100 });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
await page.evaluateOnNewDocument((t, u) => { localStorage.setItem('na_token', t); localStorage.setItem('na_user', JSON.stringify(u)); window.currentUser = u; }, token, meUser);
await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction('typeof window.switchTab === "function"', { timeout: 30000 });
await page.evaluate(() => { window.switchTab('evolution'); window.evoSwitchSub('family'); });
await page.waitForFunction(() => { const c = document.getElementById('family-team'); return c && /create|Создать|family|Семья/i.test(c.textContent); }, { timeout: 30000 }).catch(() => {});
await sleep(800);

const out = { email, steps: {} };
const click = sel => page.evaluate(s => { const el = document.querySelector(s); if (el) { el.click(); return true; } return false; }, sel);
const setVal = (sel, val) => page.evaluate((s, v) => { const el = document.querySelector(s); if (!el) return false; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; }, sel, val);

// 1. create family
await click('#ft-create-family'); await sleep(400);
await click('#ff-save'); await sleep(1500);
out.steps.familyCreated = await page.evaluate(() => !!document.querySelector('#ft-add-child'));

// 2. Add Child — prenatal, due in 60 days
await click('#ft-add-child'); await sleep(500);
out.steps.addChildFormFields = await page.evaluate(() => ({
  hasName: !!document.querySelector('#ac-name'), hasSex: !!document.querySelector('#ac-sex'),
  hasBornRadio: document.querySelectorAll('input[name="ac-born"]').length === 2,
  hasDob: !!document.querySelector('#ac-dob'), hasDiagSearch: !!document.querySelector('#ac-diag-search'),
  hasTrack: !!document.querySelector('#ac-track'),
  namePrefilled: (document.querySelector('#ac-name') || {}).value || ''   // must be EMPTY (not owner name)
}));
await setVal('#ac-name', 'Тест');
await setVal('#ac-sex', 'female');
await page.evaluate(() => { const r = document.querySelector('input[name="ac-born"][value="unborn"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
await sleep(200);
const due = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
await setVal('#ac-due', due);
out.steps.gestNote = await page.evaluate(() => (document.querySelector('#ac-gest') || {}).textContent || '');
// pick first diagnosis
await sleep(500);
await page.evaluate(() => { const cb = document.querySelector('#ac-diag-list input[type=checkbox]'); if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); } });
await click('#ac-save'); await sleep(1800);

// card present with term + name
out.steps.card = await page.evaluate(() => {
  const card = document.querySelector('#family-team .ft-card[data-dep]');
  if (!card) return { found: false };
  return { found: true, text: card.textContent.replace(/\s+/g, ' ').trim(),
    hasEdit: !!card.querySelector('.ft-edit-dep'), hasView: !!card.querySelector('.ft-view-path') };
});

// 3. Edit reopens prefilled
await click('#family-team .ft-edit-dep'); await sleep(700);
out.steps.editPrefill = await page.evaluate(() => ({
  name: (document.querySelector('#ac-name') || {}).value || '',
  sex: (document.querySelector('#ac-sex') || {}).value || '',
  unbornChecked: !!(document.querySelector('input[name="ac-born"][value="unborn"]') || {}).checked,
  due: (document.querySelector('#ac-due') || {}).value || ''
}));
await click('#ac-cancel'); await sleep(300);

// 4. View Path → wide modal with pregnancy header + evolution mount
await click('#family-team .ft-view-path'); await sleep(2500);
out.steps.viewPath = await page.evaluate(() => {
  const wide = document.querySelector('.ft-modal.ft-modal-wide');
  const preg = document.querySelector('.ft-preg');
  const evo = document.querySelector('#ft-dp-box .myc-root, #ft-dp-box svg');
  return { wideModal: !!wide, pregHeader: !!preg, pregText: preg ? preg.textContent.replace(/\s+/g, ' ').trim() : '',
    evoMounted: !!evo, milestone: (document.querySelector('.ft-preg-milestone') || {}).textContent || '' };
});
try { await page.screenshot({ path: '/tmp/pr92-viewpath.png' }); out.shotViewPath = '/tmp/pr92-viewpath.png'; } catch (e) {}
// close modal
await page.evaluate(() => { const bg = document.querySelector('.ft-modal-bg'); if (bg) bg.click(); });
await sleep(300);

// 5. Layers cluster-fan — seed a 10-event chain (same timestamp), open personal layers
const chain = []; for (let i = 0; i < 10; i++) chain.push({ type: 'emotion', label: 'эмоция' + i, valence: i % 2 ? 'positive' : 'negative' });
await fetch(AUTH + '/api/neuromap/v2/append', { method: 'POST', headers: H(token), body: JSON.stringify({ chain }) });
await page.evaluate(() => { window.evoSwitchSub('personal'); });
await page.waitForFunction(() => { const c = document.getElementById('evo-path'); return c && c.__evo && c.__evo.data; }, { timeout: 30000 }).catch(() => {});
await sleep(900);
await page.evaluate(() => { document.querySelectorAll('#evo-path .myc-seg').forEach(s => { if (s.getAttribute('data-seg') === 'mode') { const b = s.querySelector('button[data-val="layers"]'); if (b) b.click(); } }); });
await sleep(700);
out.steps.layersFan = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('#evo-path .evo-node')];
  const pts = groups.map(g => { const c = g.querySelector('circle.evo-hit') || g.querySelector('circle'); return c ? { x: Math.round(+c.getAttribute('cx')), y: Math.round(+c.getAttribute('cy')) } : null; }).filter(Boolean);
  // emotion lane: the 10 chained events share x → must now have distinct y
  const byX = {}; pts.forEach(p => { (byX[p.x] = byX[p.x] || new Set()).add(p.y); });
  const maxColumn = Math.max(0, ...Object.values(byX).map(s => s.size));
  return { nodeGroups: groups.length, maxColumnDistinctY: maxColumn };
});
try { await page.screenshot({ path: '/tmp/pr92-layers.png' }); out.shotLayers = '/tmp/pr92-layers.png'; } catch (e) {}

out.errors = errs.filter(e => !/ResizeObserver|IndexSizeError/.test(e));
out.PASS = {
  family: out.steps.familyCreated,
  addChildForm: out.steps.addChildFormFields && out.steps.addChildFormFields.hasName && out.steps.addChildFormFields.hasBornRadio && out.steps.addChildFormFields.namePrefilled === '',
  cardTerm: out.steps.card && out.steps.card.found && /недел|week|sem/i.test(out.steps.card.text) && /Тест/.test(out.steps.card.text) && out.steps.card.hasEdit && out.steps.card.hasView,
  editPrefill: out.steps.editPrefill && out.steps.editPrefill.name === 'Тест' && out.steps.editPrefill.unbornChecked && out.steps.editPrefill.due === due,
  viewPath: out.steps.viewPath && out.steps.viewPath.wideModal && out.steps.viewPath.pregHeader && out.steps.viewPath.evoMounted,
  layersFan: out.steps.layersFan && out.steps.layersFan.maxColumnDistinctY >= 5,
};
out.ALL_PASS = Object.values(out.PASS).every(Boolean);
console.log(JSON.stringify(out, null, 2));
await browser.close();
process.exit(out.ALL_PASS ? 0 : 1);
