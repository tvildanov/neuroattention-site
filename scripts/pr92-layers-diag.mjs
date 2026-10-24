// PR92 — DIAGNOSTIC: does the Layers tab show ALL event types, or drop some?
// Seeds a mix across emotion/thought/sensation/event (neuromap append, backdated)
// + insight (diary), then compares the API ground-truth (/evolution?period=all)
// against what the DEPLOYED Layers view actually renders per lane.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH = 'https://neuroattention-api-production.up.railway.app';
const SITE = 'https://neuroattention.org/account.html';
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const H = t => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
const D = 864e5;
const iso = ms => new Date(ms).toISOString();

const email = 'p92lay-' + Date.now() + '@test.local';
const reg = await (await fetch(AUTH + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test12345!', display_name: 'P92Lay', country: 'RU', city: 'Moscow', location_lat: 55.75, location_lon: 37.62 }) })).json();
const token = reg.token;
const me = await (await fetch(AUTH + '/api/auth/me', { headers: H(token) })).json();
const meUser = me.user || me;

// Seed across last ~25 days. neuromap append takes a chain + occurred_at.
const now = Date.now();
async function append(type, label, valence, offDays) {
  return (await fetch(AUTH + '/api/neuromap/v2/append', { method: 'POST', headers: H(token), body: JSON.stringify({ chain: [{ type, label, valence: valence || 'neutral' }], occurred_at: iso(now - offDays * D) }) })).json();
}
const plan = [
  ['emotion', 'тревога', 'negative', 1], ['emotion', 'радость', 'positive', 3], ['emotion', 'спокойствие', 'positive', 7], ['emotion', 'грусть', 'negative', 12], ['emotion', 'интерес', 'positive', 20],
  ['thought', 'я справлюсь', 'positive', 2], ['thought', 'руминация', 'negative', 6], ['thought', 'план на день', 'neutral', 14], ['thought', 'сомнение', 'negative', 22],
  ['area', 'грудь сжатие', 'negative', 2], ['area', 'тепло в животе', 'positive', 9], ['area', 'плечи напряжение', 'negative', 16], ['area', 'руки покалывание', 'neutral', 24],
  ['cause', 'разговор с коллегой', 'neutral', 4], ['cause', 'тренировка', 'positive', 10], ['cause', 'недосып', 'negative', 18],
];
for (const [t, l, v, off] of plan) await append(t, l, v, off);
// insight via diary
for (let i = 0; i < 4; i++) {
  await fetch(AUTH + '/api/diary/save', { method: 'POST', headers: H(token), body: JSON.stringify({ text: 'инсайт ' + i, comment: '', date_key: iso(now - (i * 5 + 1) * D).slice(0, 10) }) });
}
// events via calendar too (separate instrument)
for (let i = 0; i < 3; i++) {
  await fetch(AUTH + '/api/calendar/save', { method: 'POST', headers: H(token), body: JSON.stringify({ title: 'кал. событие ' + i, event_type: 'note', date_key: iso(now - (i * 6 + 1) * D).slice(0, 10) }) });
}

// Ground truth from API (full range)
const apiAll = await (await fetch(AUTH + '/api/users/me/evolution?from=' + iso(now - 40 * D) + '&to=' + iso(now), { headers: H(token) })).json();
const apiCounts = {};
Object.keys(apiAll.layers || {}).forEach(k => apiCounts[k] = (apiAll.layers[k] || []).length);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1440,1000'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
// Force an early created_at so the frontend's from=registration window covers the backdated seeds.
const earlyUser = Object.assign({}, meUser, { created_at: iso(now - 60 * D) });
await page.evaluateOnNewDocument((t, u) => { localStorage.setItem('na_token', t); localStorage.setItem('na_user', JSON.stringify(u)); }, token, earlyUser);
await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction('typeof window.switchTab === "function"', { timeout: 30000 });
await page.evaluate(() => { window.switchTab('evolution'); window.evoSwitchSub('personal'); });
await page.waitForFunction(() => { const c = document.getElementById('evo-path'); return c && c.__evo && c.__evo.data; }, { timeout: 30000 }).catch(() => {});
await new Promise(r => setTimeout(r, 800));

async function clickSeg(kind, val) {
  await page.evaluate((k, v) => {
    document.querySelectorAll('#evo-path .myc-seg').forEach(s => { if (s.getAttribute('data-seg') === k) { const b = s.querySelector('button[data-val="' + v + '"]'); if (b) b.click(); } });
  }, kind, val);
  await new Promise(r => setTimeout(r, 500));
}
async function readLayers(period) {
  await clickSeg('mode', 'layers');
  await clickSeg('period', period);
  return page.evaluate(() => {
    const svg = document.querySelector('#evo-path .evo-stage svg');
    const labels = [...document.querySelectorAll('#evo-path .myc-lane-label')].map(e => e.textContent);
    const circles = svg ? svg.querySelectorAll('.evo-node').length : 0;
    return { laneLabels: labels, nodeGroups: circles, dataLayerCounts: (() => { const c = document.getElementById('evo-path'); const L = c && c.__evo && c.__evo.data && c.__evo.data.layers || {}; const o = {}; Object.keys(L).forEach(k => o[k] = L[k].length); return o; })() };
  });
}

const month = await readLayers('month');
const year = await readLayers('year');

const out = { email, apiCounts, month, year, errors: errs.filter(e => !/ResizeObserver|IndexSizeError/.test(e)) };
console.log(JSON.stringify(out, null, 2));
await browser.close();
