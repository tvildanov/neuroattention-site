// PR91 screenshots: Family & Team tab — empty → with child → with partner.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH = 'https://neuroattention-api-production.up.railway.app';
const SITE = 'https://neuroattention.org/account.html';
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const SHOT = '/tmp';
const H = t => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
const reg = async tag => { const email = tag + '-' + Date.now() + '@test.local'; const r = await (await fetch(AUTH + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Test12345!', display_name: tag, country: 'RU', city: 'Moscow', location_lat: 55.75, location_lon: 37.62 }) })).json(); return { email, token: r.token }; };
const post = (p, t, b) => fetch(AUTH + p, { method: 'POST', headers: H(t), body: JSON.stringify(b) }).then(r => r.json());

const A = await reg('shot');
const partner = await reg('shot-partner');
const me = await (await fetch(AUTH + '/api/auth/me', { headers: H(A.token) })).json();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1100'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100 });
await page.evaluateOnNewDocument((t, u) => { localStorage.setItem('na_token', t); localStorage.setItem('na_user', JSON.stringify(u)); }, A.token, me.user || me);
const openFam = async () => { await page.evaluate(() => { window.switchTab('evolution'); window.evoSwitchSub('family'); }); await new Promise(r => setTimeout(r, 1800)); };

await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForFunction('typeof window.switchTab === "function"', { timeout: 30000 });

// 1) EMPTY
await openFam();
await page.screenshot({ path: SHOT + '/pr91-1-empty.png' });

// create family + add child via API, then re-mount
const fam = await post('/api/teams', A.token, { name: 'Семья Verify', kind: 'family', my_role: 'mother' });
await post('/api/dependents', A.token, { name: 'Анна', sex: 'female', birth_date: '2024-09-01', relation: 'daughter', family_id: fam.team.id });
await openFam();
await page.screenshot({ path: SHOT + '/pr91-2-child.png' });

// add partner (existing user by email) + a prenatal child
await post('/api/teams/' + fam.team.id + '/members', A.token, { email: partner.email, role: 'partner' });
await post('/api/dependents', A.token, { name: 'Малыш', sex: 'other', expected_due_date: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), relation: 'son', family_id: fam.team.id });
await post('/api/teams', A.token, { name: 'Рабочая команда', kind: 'team', is_public: true, description: 'demo' });
await openFam();
await page.screenshot({ path: SHOT + '/pr91-3-partner.png' });

console.log(JSON.stringify({ shots: [SHOT + '/pr91-1-empty.png', SHOT + '/pr91-2-child.png', SHOT + '/pr91-3-partner.png'] }));
await browser.close();
