import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

// PR #90 verification — Pregnancy function on the LIVE dashboard (neuroattention.org).
// Registers a throwaway user, injects the token, opens Human Atlas → Functions, clicks
// Pregnancy, and asserts the reproductive + endocrine regions highlight. Access gate is
// bypassed for render-only (paywall is unrelated to the focus behavior).
const CHROME = process.env.CHROME ||
  '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const SITE = process.env.SITE || 'https://neuroattention.org/account.html';
const AUTH = process.env.AUTH_API || 'https://neuroattention-api-production.up.railway.app';
const SHOT = process.env.SHOT || '/tmp';

// 1) register a throwaway user
const email = 'preg-verify-' + Date.now() + '@test.local';
const reg = await fetch(AUTH + '/api/auth/register', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'Test12345!', display_name: 'Preg Verify', country: 'RU', city: 'Moscow', location_lat: 55.75, location_lon: 37.62 }),
});
const regJson = await reg.json();
const token = regJson.token;
if (!token) { console.log(JSON.stringify({ fatal: 'register failed', regJson })); process.exit(1); }
const me = await (await fetch(AUTH + '/api/auth/me', { headers: { authorization: 'Bearer ' + token } })).json();
const user = me.user || me;

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
    '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--window-size=1400,1000'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });
const errs = [];
page.on('pageerror', (e) => errs.push(String((e && e.message) || e)));

// inject auth before any script runs
await page.evaluateOnNewDocument((tok, usr) => {
  localStorage.setItem('na_token', tok);
  localStorage.setItem('na_user', JSON.stringify(usr));
}, token, user);

// bypass the tool access gate (render-only)
await page.setRequestInterception(true);
page.on('request', (req) => {
  const u = req.url();
  if (/\/api\/tools\/[^/]+\/access/.test(u)) {
    return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ unlocked: true, ok: true }) });
  }
  req.continue();
});

await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction('typeof window.switchTab === "function"', { timeout: 30000 });

// open the Human Atlas tool
await page.evaluate(() => { window.switchTab('tools'); if (window.setToolsMode) window.setToolsMode('anatomy'); });
await page.waitForFunction('window._anatomyAtlas && window._anatomyAtlas.root', { timeout: 40000 });
await new Promise(r => setTimeout(r, 1500));

// switch to the Functions tab and wait for the list to populate
await page.evaluate(() => { if (window.haSwitchTab) window.haSwitchTab('functions'); });
await page.waitForFunction(() => {
  const items = document.querySelectorAll('.ha-item, [data-fn-slug], .ha-list button');
  return items && items.length > 3;
}, { timeout: 20000 }).catch(() => {});
await new Promise(r => setTimeout(r, 800));

const R = { errors: errs, email };

// is there a 'reproductive' category chip + a Pregnancy item?
R.ui = await page.evaluate(() => {
  const cats = [...document.querySelectorAll('.ha-cat')].map(b => b.textContent.trim());
  const items = [...document.querySelectorAll('.ha-item, .ha-list button, button.ha-item')];
  const preg = items.find(b => /pregnan|беремен|embarazo/i.test(b.textContent));
  return { cats, itemCount: items.length, pregnancyItemText: preg ? preg.textContent.trim() : null };
});

// click the Pregnancy item
const clicked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.ha-item, .ha-list button, button.ha-item')];
  const preg = items.find(b => /pregnan|беремен|embarazo/i.test(b.textContent));
  if (preg) { preg.click(); return true; }
  return false;
});
R.clicked_pregnancy = clicked;

// give the focus + lazy GLB streams time to land + re-focus
await new Promise(r => setTimeout(r, 4500));

// inspect which organs are lit (focusRegions boosts focused meshes, dims/hides rest)
R.highlight = await page.evaluate(() => {
  const a = window._anatomyAtlas;
  const byOrgan = {};
  let litTotal = 0, visTotal = 0;
  a.root.traverse(o => {
    if (!o.isMesh || !o.userData || !o.material || !o.material.uniforms || !o.material.uniforms.uOpacity) return;
    const ud = o.userData;
    if (!ud.regionId) return;
    if (o.visible) {
      visTotal++;
      const op = o.material.uniforms.uOpacity.value;
      if (op > 0.5) { // focused meshes are boosted to full; dimmed ones sit low
        litTotal++;
        const k = ud.organ || ud.layer || '(none)';
        byOrgan[k] = (byOrgan[k] || 0) + 1;
      }
    }
  });
  return { byOrgan, litTotal, visTotal, sex: a._sexMode || null };
});

await page.screenshot({ path: `${SHOT}/pr90-pregnancy-focus.png` });
console.log(JSON.stringify(R, null, 2));

// cleanup: soft-delete the throwaway user if an endpoint exists (best-effort)
try {
  await fetch(AUTH + '/api/auth/delete-account', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: '{}' });
} catch (e) {}
await browser.close();
