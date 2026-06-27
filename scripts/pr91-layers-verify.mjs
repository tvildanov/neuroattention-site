// PR91 — verify the Layers tab in Personal Path now responds to the period
// switch. Seeds a couple of calendar events (→ the 'event' lane), opens the
// Personal Path, flips to Layers mode, and checks that:
//   - layers mode renders an SVG with lane labels + event nodes
//   - switching period (year → day) re-renders (node count / axis changes)
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH = 'https://neuroattention-api-production.up.railway.app';
const SITE = 'https://neuroattention.org/account.html';
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const H = t => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });

const email = 'layers-' + Date.now() + '@test.local';
const reg = await (await fetch(AUTH + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test12345!', display_name: 'Layers', country: 'RU', city: 'Moscow', location_lat: 55.75, location_lon: 37.62 }) })).json();
const token = reg.token;
const me = await (await fetch(AUTH + '/api/auth/me', { headers: H(token) })).json();
// seed events on the 'event' lane (calendar feeds it unconditionally)
for (const title of ['Verify event A', 'Verify event B', 'Verify event C']) {
  await fetch(AUTH + '/api/calendar/save', { method: 'POST', headers: H(token), body: JSON.stringify({ title, event_type: 'note', date_key: new Date().toISOString().slice(0, 10) }) });
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--window-size=1440,1000'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message || e)));
await page.evaluateOnNewDocument((t, u) => { localStorage.setItem('na_token', t); localStorage.setItem('na_user', JSON.stringify(u)); }, token, me.user || me);
await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction('typeof window.switchTab === "function"', { timeout: 30000 });
await page.evaluate(() => { window.switchTab('evolution'); window.evoSwitchSub('personal'); });
// wait for the evolution path to mount + data load
await page.waitForFunction(() => { const c = document.getElementById('evo-path'); return c && c.__evo && c.__evo.data; }, { timeout: 30000 }).catch(() => {});
await new Promise(r => setTimeout(r, 800));

// A fresh user has < 1 min of history, so day/year windows would be identical —
// nothing to crop. Inject a controlled YEAR-WIDE dataset into the live page so we
// can prove the DEPLOYED renderLayers crops by period. Events at -300d,-60d,-10d,
// -1d,-2h → year shows 5 on the event lane, month ~3, day 1.
await page.evaluate(() => {
  const c = document.getElementById('evo-path'); const now = Date.now(); const D = 864e5;
  const at = (ms) => new Date(ms).toISOString();
  const ev = (id, off) => ({ id: 'inj' + id, layer: 'event', kind: 'event', t: at(now - off), occurred_at: at(now - off), label: 'Injected ' + id, valence: 'neutral', weight: 1, payload: {}, links: [] });
  const events = [ev(1, 300 * D), ev(2, 60 * D), ev(3, 10 * D), ev(4, 1 * D), ev(5, 2 * 3600e3)];
  c.__evo.data.range = { from: at(now - 365 * D), to: at(now), period: 'year' };
  c.__evo.data.layers = { practice: [], emotion: [], event: events, thought: [], sensation: [], insight: [], xp_gain: [] };
  c.__evo.data.events = events.slice();
  c.__evo.data.totals = { event: 5, xp_total: 0 };
  c.__evo.isDemo = false; c.__evo.view = null;
});

// Drive ONLY through the real seg buttons (never pre-set __evo — that trips the
// `st.period === val` early-return guard and makes the click a no-op).
async function clickSeg(kind, val) {
  await page.evaluate((k, v) => {
    const segs = document.querySelectorAll('#evo-path .myc-seg');
    segs.forEach(s => { if (s.getAttribute('data-seg') === k) { const b = s.querySelector('button[data-val="' + v + '"]'); if (b) b.click(); } });
  }, kind, val);
  await new Promise(r => setTimeout(r, 500));
}
async function setLayers(period) {
  await clickSeg('mode', 'layers');
  await clickSeg('period', period);
  return page.evaluate(() => {
    const svg = document.querySelector('#evo-path .evo-stage svg');
    const labels = [...document.querySelectorAll('#evo-path .myc-lane-label')].map(e => e.textContent);
    const circles = svg ? svg.querySelectorAll('circle').length : 0;
    const axisLabels = [...document.querySelectorAll('#evo-path .evo-axis-label')].map(e => e.textContent);
    const emptyHint = !!(svg && /No events|Нет событий|Sin eventos/.test(svg.textContent || ''));
    return { hasSvg: !!svg, laneCount: labels.length, laneLabels: labels, circles, axisLabels, emptyHint };
  });
}

const year = await setLayers('year');
const month = await setLayers('month');
const day = await setLayers('day');

const out = {
  email, errors: errs.filter(e => !/ResizeObserver|IndexSizeError/.test(e)),
  year, month, day,
  // PASS: layers renders 7 lanes; the period window crops the event nodes —
  // year (5 events) > month (~3) > day (1). Before the fix all three were equal
  // (full range), proving the period buttons now drive the Layers view.
  pass_layers_render: year.hasSvg && year.laneCount >= 6,
  pass_period_crops: year.circles > month.circles && month.circles > day.circles,
  pass_axis_changes: JSON.stringify(year.axisLabels) !== JSON.stringify(day.axisLabels),
};
try { await page.screenshot({ path: '/tmp/pr91-layers.png' }); out.shot = '/tmp/pr91-layers.png'; } catch (e) {}
console.log(JSON.stringify(out, null, 2));
await browser.close();
process.exit((out.pass_layers_render && out.pass_period_crops) ? 0 : 1);
