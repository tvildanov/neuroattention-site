/**
 * Issue #163 — account entry under blocked/slow CDNs and stalled auth.
 * Synthetic mocked auth only. Does not call the production API.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://neuroattention-api-production.up.railway.app';
const QUOTA_503 = 'Service is overloaded (DB compute quota exceeded). Please try again in a few minutes.';
const SYNTH_EMAIL = 'synthetic-entry@example.com';
const SYNTH_PASS = 'synthetic-pass';
const SYNTH_USER = {
  id: '00000000-0000-4000-8000-000000000163',
  email: SYNTH_EMAIL,
  display_name: 'Synthetic Entry',
  role: 'user',
  phone: '',
  avatar_url: null,
  monad_access: false,
  monad_tab: false
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function successBody() {
  return JSON.stringify({ token: 'synthetic-test-token', user: SYNTH_USER });
}

async function boot(browserType, viewport, extra) {
  const launchOpts = { headless: true };
  if (process.env.CHROME_PATH && browserType.name() === 'chromium') launchOpts.executablePath = process.env.CHROME_PATH;
  const browser = await browserType.launch(launchOpts);
  const context = await browser.newContext({
    viewport,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleText = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => consoleText.push(msg.text()));
  await page.addInitScript(() => {
    localStorage.setItem('na_lang', 'en');
    localStorage.setItem('na_lang_explicit', 'en');
  });
  const state = {
    loginHits: 0, loginBodies: 0, held: [], mode: 'success', cdn: [],
    cdnMode: extra.cdn || 'block', fontMode: extra.font || 'abort', fonts: [],
    allowPrefixes: extra.allowPrefixes || []
  };
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(extra.origin)) return route.continue();
    if (state.allowPrefixes.some((p) => url.startsWith(p))) return route.continue();
    if (/unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(url)) {
      state.cdn.push(url);
      if (state.cdnMode === 'stall') return; // never respond
      if (state.cdnMode === 'stub') return fulfillViz(route, url, state);
      if (state.cdnMode === 'd3-only' && url.includes('jsdelivr')) return fulfillViz(route, url, state);
      return route.abort('failed');
    }
    if (url.startsWith(API)) {
      if (url.includes('/api/auth/login')) return handleLogin(route, state);
      if (url.includes('/api/auth/me')) {
        if (state.mode === 'me-401') {
          await new Promise((r) => setTimeout(r, 600));
          return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' });
        }
        if (state.mode === 'me-ok' || state.mode === 'magic') {
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: SYNTH_USER }) });
        }
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)) {
      state.fonts.push(url);
      if (state.fontMode === 'stall') return; // hang; do not abort (abort does not blank the page)
      if (state.fontMode === 'apply') return fulfillFonts(route, url);
      return route.abort('failed');
    }
    return route.abort('failed');
  });
  return { browser, context, page, pageErrors, consoleText, state };
}

function fulfillFonts(route, url) {
  if (/fonts\.gstatic\.com/.test(url)) {
    return route.fulfill({ status: 200, contentType: 'font/woff2', body: '' });
  }
  const css = [
    "@font-face{font-family:'DM Sans';font-style:normal;font-weight:400;font-display:swap;",
    "src:url(https://fonts.gstatic.com/s/na-probe.woff2) format('woff2');}",
    ':root{--na-fonts-applied:1;}'
  ].join('');
  return route.fulfill({
    status: 200,
    contentType: 'text/css; charset=utf-8',
    body: css
  });
}

function fulfillViz(route, url, state) {
  state.cdn.push('fulfilled:' + url);
  let body = '/* viz stub */';
  if (url.includes('3d-force-graph')) {
    body = 'window.ForceGraph3D=function(){return function(){return {};};};';
  } else if (url.includes('d3-selection')) {
    body = 'window.d3=window.d3||{};window.d3.select=function(){return window.d3;};';
  } else if (url.includes('d3-path')) {
    body = 'window.d3=window.d3||{};window.d3.path=function(){return {};};';
  } else if (url.includes('d3-shape')) {
    body = 'window.d3=window.d3||{};window.d3.line=function(){return window.d3.line;};window.d3.line.curve=function(){return function(){return "M0 0";};};window.d3.curveCatmullRom={alpha:function(){return window.d3.curveCatmullRom;}};';
  } else if (url.includes('d3-timer')) {
    body = 'window.d3=window.d3||{};window.d3.timer=function(){};';
  } else if (url.includes('d3-dispatch')) {
    body = 'window.d3=window.d3||{};window.d3.dispatch=function(){};';
  } else if (url.includes('d3-quadtree')) {
    body = 'window.d3=window.d3||{};window.d3.quadtree=function(){};';
  } else if (url.includes('d3-force')) {
    body = 'window.d3=window.d3||{};window.d3.forceSimulation=function(){};';
  }
  return route.fulfill({ status: 200, contentType: 'application/javascript', body });
}

// Real socket: response headers are flushed immediately and the body is held
// until release(). Playwright's route.fulfill() cannot split those two moments.
function startHeldBodyServer() {
  const pending = [];
  const server = http.createServer((req, res) => {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (!String(req.url).includes('/api/auth/login')) {
        res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
        res.end('{}');
        return;
      }
      const mode = server.mode || 'hold';
      if (mode === 'fast') {
        res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
        res.end(successBody());
        return;
      }
      if (mode === 'malformed') {
        res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
        res.flushHeaders();
        setTimeout(() => { try { res.end('not-json{'); } catch (e) {} }, 40);
        return;
      }
      res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
      res.flushHeaders();
      const slot = { res, closed: false };
      pending.push(slot);
      res.on('close', () => { slot.closed = true; });
    });
  });
  server.mode = 'hold';
  return {
    server,
    pending,
    release(payload) {
      const slot = pending.shift();
      if (!slot || slot.closed) return false;
      try { slot.res.end(payload); return true; } catch (e) { return false; }
    }
  };
}

async function handleLogin(route, state) {
  state.loginHits++;
  const raw = route.request().postData() || '';
  if (raw.includes(SYNTH_PASS)) state.loginBodies++;
  if (state.mode === 'stall') {
    state.held.push(route);
    return;
  }
  if (state.mode === 'late-success') {
    setTimeout(() => {
      route.fulfill({ status: 200, contentType: 'application/json', body: successBody() }).catch(() => {});
    }, 3000);
    return;
  }
  if (state.mode === '401') {
    return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Invalid email or password"}' });
  }
  if (state.mode === '503') {
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: QUOTA_503 }) });
  }
  if (state.mode === 'malformed') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: 'not-json{' });
  }
  if (state.mode === 'offline') {
    return route.abort('internetdisconnected');
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: successBody() });
}

async function openAccount(page, origin, query) {
  await page.goto(origin + '/account.html' + (query || ''), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#auth-screen', { state: 'visible', timeout: 15000 });
  await page.waitForSelector('#login-id', { state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('#auth-submit [data-i18n="a.auth.btn_login"]');
    return el && el.textContent.indexOf('Sign In') !== -1;
  }, null, { timeout: 10000 });
}

async function fillLogin(page) {
  await page.fill('#login-id', SYNTH_EMAIL);
  await page.fill('#login-pass', SYNTH_PASS);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  const results = [];
  const server = await startServer();
  const addr = server.address();
  const origin = 'http://127.0.0.1:' + addr.port;
  const outDir = '/opt/cursor/artifacts/screenshots';
  fs.mkdirSync(outDir, { recursive: true });

  async function check(name, fn) {
    if (process.env.ONLY && process.env.ONLY.split('|').every((part) => name.indexOf(part) === -1)) {
      console.log('SKIP', name);
      return;
    }
    const t0 = Date.now();
    try {
      await fn();
      results.push({ name, ok: true, ms: Date.now() - t0 });
      console.log('PASS', name, Date.now() - t0 + 'ms');
    } catch (err) {
      results.push({ name, ok: false, ms: Date.now() - t0, error: String(err && err.stack || err) });
      console.error('FAIL', name, err);
    }
  }

  await check('blocked unpkg/jsDelivr still shows login (desktop)', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      const t0 = Date.now();
      await openAccount(s.page, origin);
      const dt = Date.now() - t0;
      assert(dt < 8000, 'login took ' + dt + 'ms');
      const box = await s.page.locator('#auth-form').boundingBox();
      assert(box && box.width > 200 && box.y > 0 && box.y < 700, 'form not in desktop viewport');
      assert(!s.pageErrors.some((e) => /ForceGraph3D|d3 is not defined/.test(e)), s.pageErrors.join('\n'));
      await s.page.screenshot({ path: path.join(outDir, 'login-desktop-cdn-blocked.png') });
    } finally { await s.browser.close(); }
  });

  await check('blocked CDN still shows login (mobile)', async () => {
    const s = await boot(chromium, { width: 390, height: 844 }, { origin, cdn: 'block' });
    try {
      await openAccount(s.page, origin);
      const box = await s.page.locator('#auth-submit').boundingBox();
      assert(box && box.y + box.height < 844 && box.width > 100, 'submit not visible on mobile');
      await s.page.screenshot({ path: path.join(outDir, 'login-mobile-cdn-blocked.png') });
    } finally { await s.browser.close(); }
  });

  await check('stalled CDN does not hide login', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'stall' });
    try {
      const t0 = Date.now();
      await openAccount(s.page, origin);
      assert(Date.now() - t0 < 8000, 'stalled CDN delayed login');
      const scripts = await s.page.locator('script[src*="unpkg.com"], script[src*="jsdelivr"]').count();
      assert(scripts === 0, 'parser still has blocking viz scripts');
    } finally { await s.browser.close(); }
  });

  await check('success, progress, duplicate submit, logout', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      await openAccount(s.page, origin);
      await fillLogin(s.page);
      s.state.mode = 'stall';
      await s.page.evaluate(() => {
        const form = document.getElementById('auth-form');
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      await s.page.waitForFunction(() => {
        const el = document.querySelector('#auth-submit [data-i18n="a.auth.btn_login"]');
        return el && el.textContent.indexOf('Signing in') !== -1 && document.getElementById('auth-submit').disabled;
      });
      assert(s.state.loginHits === 1, 'duplicate produced ' + s.state.loginHits + ' requests');
      assert(s.state.loginBodies === 1, 'password was not posted exactly once');
      const route = s.state.held.shift();
      await route.fulfill({ status: 200, contentType: 'application/json', body: successBody() });
      await s.page.waitForSelector('#client-dashboard', { state: 'visible', timeout: 10000 });
      const token = await s.page.evaluate(() => localStorage.getItem('na_token'));
      assert(token === 'synthetic-test-token', 'token not stored');
      assert(!s.consoleText.some((t) => t.includes(SYNTH_PASS)), 'password leaked to console');
      await s.page.click('[data-logout]');
      await s.page.waitForSelector('#auth-screen', { state: 'visible' });
      const cleared = await s.page.evaluate(() => localStorage.getItem('na_token'));
      assert(!cleared, 'logout did not clear token');
      await s.page.screenshot({ path: path.join(outDir, 'login-after-logout.png') });
    } finally { await s.browser.close(); }
  });

  await check('401 is credentials, not a network error, and can retry', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      await openAccount(s.page, origin);
      await fillLogin(s.page);
      s.state.mode = '401';
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await s.page.waitForFunction(() => document.getElementById('auth-error').textContent.indexOf('Incorrect email or password') !== -1);
      const text = await s.page.locator('#auth-error').innerText();
      assert(!/reach the server|too long|unexpected response/i.test(text), text);
      const enabled = await s.page.locator('#auth-submit').isEnabled();
      assert(enabled, 'retry button stayed disabled');
      s.state.mode = 'success';
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await s.page.waitForSelector('#client-dashboard', { state: 'visible' });
    } finally { await s.browser.close(); }
  });

  await check('503 quota message is preserved', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      await openAccount(s.page, origin);
      await fillLogin(s.page);
      s.state.mode = '503';
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await s.page.waitForFunction((msg) => document.getElementById('auth-error').textContent === msg, QUOTA_503);
      const text = await s.page.locator('#auth-error').innerText();
      assert(!/Incorrect email|reach the server/i.test(text), text);
      assert(await s.page.locator('#auth-submit').isEnabled(), 'cannot retry after 503');
    } finally { await s.browser.close(); }
  });

  await check('offline/abort is a network error and can retry', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      await openAccount(s.page, origin);
      await fillLogin(s.page);
      s.state.mode = 'offline';
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await s.page.waitForFunction(() => /reach the server/i.test(document.getElementById('auth-error').textContent));
      const text = await s.page.locator('#auth-error').innerText();
      assert(!/Incorrect email|compute quota|unexpected response/i.test(text), text);
      s.state.mode = 'success';
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await s.page.waitForSelector('#client-dashboard', { state: 'visible' });
    } finally { await s.browser.close(); }
  });

  await check('malformed response is not a network or credential error', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      await openAccount(s.page, origin);
      await fillLogin(s.page);
      s.state.mode = 'malformed';
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await s.page.waitForFunction(() => /unexpected response/i.test(document.getElementById('auth-error').textContent));
      const token = await s.page.evaluate(() => localStorage.getItem('na_token'));
      assert(!token, 'malformed response stored a token');
      assert(await s.page.locator('#auth-submit').isEnabled(), 'cannot retry after malformed');
    } finally { await s.browser.close(); }
  });

  await check('stall times out near 15s and a late success is ignored', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      await openAccount(s.page, origin);
      await fillLogin(s.page);
      s.state.mode = 'stall';
      const t0 = Date.now();
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await s.page.waitForFunction(() => /too long to respond/i.test(document.getElementById('auth-error').textContent), null, { timeout: 20000 });
      const dt = Date.now() - t0;
      assert(dt >= 14000 && dt <= 18000, 'timeout was ' + dt + 'ms');
      assert(await s.page.locator('#auth-submit').isEnabled(), 'button not restored after timeout');
      const late = s.state.held.shift();
      if (late) await late.fulfill({ status: 200, contentType: 'application/json', body: successBody() }).catch(() => {});
      await s.page.waitForTimeout(500);
      const token = await s.page.evaluate(() => localStorage.getItem('na_token'));
      assert(!token, 'late response after timeout stored a token');
      const dash = await s.page.locator('#client-dashboard').isVisible();
      assert(!dash, 'late response opened the dashboard');
      s.state.mode = 'success';
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await s.page.waitForSelector('#client-dashboard', { state: 'visible' });
    } finally { await s.browser.close(); }
  });

  await check('headers flush immediately and a late body must not authenticate', async () => {
    const held = startHeldBodyServer();
    await new Promise((r) => held.server.listen(0, '127.0.0.1', r));
    const apiOrigin = 'http://127.0.0.1:' + held.server.address().port;
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block', allowPrefixes: [apiOrigin] });
    try {
      await openAccount(s.page, origin);
      await fillLogin(s.page);
      await s.page.evaluate((base) => { AUTH_API = base; }, apiOrigin);
      const t0 = Date.now();
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      const headersAt = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('response headers were not flushed')), 5000);
        const poll = () => {
          if (held.pending.length) { clearTimeout(timer); resolve(Date.now() - t0); return; }
          setTimeout(poll, 20);
        };
        poll();
      });
      assert(headersAt < 2000, 'headers took ' + headersAt + 'ms');
      const busy = await s.page.locator('#auth-submit').isDisabled();
      assert(busy, 'button was not busy after headers');
      await s.page.waitForFunction(() => /too long to respond/i.test(document.getElementById('auth-error').textContent), null, { timeout: 20000 });
      const dt = Date.now() - t0;
      assert(dt >= 14000 && dt <= 18000, 'body-hold timeout was ' + dt + 'ms');
      assert(await s.page.locator('#auth-submit').isEnabled(), 'button stayed disabled after the body deadline');
      assert(!(await s.page.evaluate(() => localStorage.getItem('na_token'))), 'token stored before the body arrived');
      held.release(successBody());
      await s.page.waitForTimeout(800);
      const token = await s.page.evaluate(() => localStorage.getItem('na_token'));
      assert(!token, 'late body after the deadline stored a token');
      assert(!(await s.page.locator('#client-dashboard').isVisible()), 'late body opened the cabinet');
      held.server.mode = 'fast';
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await s.page.waitForSelector('#client-dashboard', { state: 'visible', timeout: 10000 });
    } finally {
      await s.browser.close();
      held.server.close();
    }
  });

  await check('malformed body after headers is not a network error', async () => {
    const held = startHeldBodyServer();
    held.server.mode = 'malformed';
    await new Promise((r) => held.server.listen(0, '127.0.0.1', r));
    const apiOrigin = 'http://127.0.0.1:' + held.server.address().port;
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block', allowPrefixes: [apiOrigin] });
    try {
      await openAccount(s.page, origin);
      await fillLogin(s.page);
      await s.page.evaluate((base) => { AUTH_API = base; }, apiOrigin);
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await s.page.waitForFunction(() => /unexpected response/i.test(document.getElementById('auth-error').textContent), null, { timeout: 10000 });
      const text = await s.page.locator('#auth-error').innerText();
      assert(!/reach the server|too long|Incorrect email|compute quota/i.test(text), text);
      assert(!(await s.page.evaluate(() => localStorage.getItem('na_token'))), 'malformed body stored a token');
      assert(await s.page.locator('#auth-submit').isEnabled(), 'button stayed disabled after a malformed body');
    } finally {
      await s.browser.close();
      held.server.close();
    }
  });

  await check('navigation and logout ignore a body that arrives later', async () => {
    const held = startHeldBodyServer();
    await new Promise((r) => held.server.listen(0, '127.0.0.1', r));
    const apiOrigin = 'http://127.0.0.1:' + held.server.address().port;
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block', allowPrefixes: [apiOrigin] });
    try {
      await openAccount(s.page, origin);
      await fillLogin(s.page);
      await s.page.evaluate((base) => { AUTH_API = base; }, apiOrigin);
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('headers not flushed before navigation')), 5000);
        const poll = () => {
          if (held.pending.length) { clearTimeout(timer); resolve(); return; }
          setTimeout(poll, 20);
        };
        poll();
      });
      await s.page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); });
      held.release(JSON.stringify({ token: 'nav-late-token', user: SYNTH_USER }));
      await s.page.waitForTimeout(600);
      let token = await s.page.evaluate(() => localStorage.getItem('na_token'));
      assert(token !== 'nav-late-token' && !token, 'navigation late body stored ' + token);

      held.server.mode = 'hold';
      await fillLogin(s.page);
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('headers not flushed before logout')), 5000);
        const poll = () => {
          if (held.pending.length) { clearTimeout(timer); resolve(); return; }
          setTimeout(poll, 20);
        };
        poll();
      });
      await s.page.evaluate(() => document.querySelector('[data-logout]').click());
      held.release(JSON.stringify({ token: 'logout-late-token', user: SYNTH_USER }));
      await s.page.waitForTimeout(600);
      token = await s.page.evaluate(() => localStorage.getItem('na_token'));
      assert(token !== 'logout-late-token' && !token, 'logout late body stored ' + token);
      assert(!(await s.page.locator('#client-dashboard').isVisible()), 'late body restored the cabinet after logout');
    } finally {
      await s.browser.close();
      held.server.close();
    }
  });

  await check('pagehide suppresses a late success', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      await openAccount(s.page, origin);
      await fillLogin(s.page);
      await s.page.evaluate(() => {
        const orig = window.fetch;
        window.fetch = function (url, opts) {
          if (String(url).indexOf('/api/auth/login') === -1) return orig.apply(this, arguments);
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(new Response(JSON.stringify({
                token: 'late-token',
                user: { id: 'x', email: 'synthetic-entry@example.com', display_name: 'Late', role: 'user' }
              }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
            }, 400);
          });
        };
      });
      await s.page.evaluate(() => {
        document.getElementById('auth-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        window.dispatchEvent(new Event('pagehide'));
      });
      await s.page.waitForTimeout(700);
      const token = await s.page.evaluate(() => localStorage.getItem('na_token'));
      assert(token !== 'late-token' && !token, 'pagehide late response stored ' + token);
      const dash = await s.page.locator('#client-dashboard').isVisible();
      assert(!dash, 'pagehide late response opened the dashboard');
    } finally { await s.browser.close(); }
  });

  await check('register, forgot, reset, and magic-link shells still open', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      await openAccount(s.page, origin);
      await s.page.click('#auth-login a[onclick*="register"]');
      await s.page.waitForSelector('#auth-register', { state: 'visible' });
      await s.page.click('#auth-register a[onclick*="login"]');
      await s.page.waitForSelector('#auth-login', { state: 'visible' });
      await s.page.click('#auth-login a[onclick*="forgot"]');
      await s.page.waitForSelector('#auth-forgot', { state: 'visible' });
      await s.page.click('#auth-forgot a[onclick*="login"]');
      await s.page.waitForSelector('#auth-login', { state: 'visible' });
      await s.page.goto(origin + '/account.html?reset=synthetic-reset-token', { waitUntil: 'domcontentloaded' });
      await s.page.waitForSelector('#auth-reset', { state: 'visible', timeout: 10000 });
      s.state.mode = 'magic';
      await s.page.goto(origin + '/account.html?magic=synthetic-magic-token', { waitUntil: 'domcontentloaded' });
      await s.page.waitForFunction(() => localStorage.getItem('na_token') === 'synthetic-magic-token', null, { timeout: 10000 });
    } finally { await s.browser.close(); }
  });

  await check('keyboard submit works', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      await openAccount(s.page, origin);
      await s.page.focus('#login-id');
      await s.page.keyboard.type(SYNTH_EMAIL);
      await s.page.keyboard.press('Tab');
      await s.page.keyboard.type(SYNTH_PASS);
      await s.page.keyboard.press('Enter');
      await s.page.waitForSelector('#client-dashboard', { state: 'visible', timeout: 10000 });
    } finally { await s.browser.close(); }
  });

  await check('viz loader keeps dependency order and skips missing globals', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'stub' });
    try {
      await openAccount(s.page, origin);
      const before = s.state.cdn.filter((u) => u.includes('unpkg.com') || u.includes('jsdelivr')).length;
      assert(before === 0, 'viz requested before login');
      const order = await s.page.evaluate(async () => {
        const seen = [];
        const orig = document.head.appendChild.bind(document.head);
        document.head.appendChild = function (node) {
          if (node && node.src) seen.push(node.src);
          return orig(node);
        };
        await window.naEnsureViz();
        return {
          seen,
          fg: typeof window.ForceGraph3D,
          line: !!(window.d3 && window.d3.line && window.d3.curveCatmullRom),
          force: !!(window.d3 && window.d3.forceSimulation)
        };
      });
      const names = order.seen.map((u) => u.split('/').pop());
      assert(names[0] && names[0].indexOf('3d-force-graph') !== -1 || order.seen[0].includes('3d-force-graph'), 'graph was not first: ' + order.seen.join(' | '));
      const d3names = order.seen.filter((u) => u.includes('d3-')).map((u) => u.match(/d3-[a-z]+/)[0]);
      assert(d3names.join(',') === 'd3-selection,d3-path,d3-shape,d3-timer,d3-dispatch,d3-quadtree,d3-force', d3names.join(','));
      assert(order.fg === 'function' && order.line && order.force, JSON.stringify(order));
    } finally { await s.browser.close(); }
  });

  await check('d3 still loads after the graph CDN fails', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      await openAccount(s.page, origin);
      s.state.cdnMode = 'd3-only';
      const ok = await s.page.evaluate(async () => {
        try { await window.naEnsureViz('d3'); } catch (e) { return { error: String(e), d3: !!(window.d3 && window.d3.forceSimulation) }; }
        return { d3: !!(window.d3 && window.d3.forceSimulation && window.d3.curveCatmullRom), fg: typeof window.ForceGraph3D };
      });
      assert(ok.d3 === true, JSON.stringify(ok));
      assert(ok.fg !== 'function', 'graph global appeared from a blocked CDN');
    } finally { await s.browser.close(); }
  });

  await check('homepage #year null-guard does not throw', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      await s.page.goto(origin + '/index.html', { waitUntil: 'domcontentloaded' });
      await s.page.waitForTimeout(300);
      assert(!s.pageErrors.some((e) => /year/.test(e) || /textContent/.test(e)), s.pageErrors.join('\n'));
      await s.page.goto(origin + '/custom.html', { waitUntil: 'domcontentloaded' });
      await s.page.waitForTimeout(200);
      await s.page.goto(origin + '/xr.html', { waitUntil: 'domcontentloaded' });
      await s.page.waitForTimeout(200);
      assert(!s.pageErrors.some((e) => /Cannot read propert/.test(e)), s.pageErrors.join('\n'));
    } finally { await s.browser.close(); }
  });

  await check('session expiry still returns to login', async () => {
    const s = await boot(chromium, { width: 1280, height: 800 }, { origin, cdn: 'block' });
    try {
      await s.page.addInitScript(() => {
        localStorage.setItem('na_token', 'synthetic-stale-token');
        localStorage.setItem('na_user', JSON.stringify({ id: 'x', email: 'synthetic-entry@example.com', display_name: 'Synthetic', role: 'user' }));
      });
      s.state.mode = 'me-401';
      await s.page.goto(origin + '/account.html', { waitUntil: 'domcontentloaded' });
      await s.page.waitForSelector('#auth-screen', { state: 'visible', timeout: 10000 });
      await s.page.waitForFunction(() => /Session expired/i.test(document.getElementById('auth-error').textContent));
      const token = await s.page.evaluate(() => localStorage.getItem('na_token'));
      assert(!token, 'stale token was kept');
    } finally { await s.browser.close(); }
  });

  async function stalledFontsLogin(browserType, label) {
    const s = await boot(browserType, { width: 1280, height: 800 }, { origin, cdn: 'block', font: 'stall' });
    try {
      await s.page.goto(origin + '/account.html', { waitUntil: 'commit', timeout: 10000 });
      const appeared = await s.page.waitForSelector('#auth-form', { state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      const snap = await s.page.evaluate(() => ({
        ready: document.readyState,
        hasForm: !!document.getElementById('auth-form'),
        title: document.title,
        opacity: document.body ? getComputedStyle(document.body).opacity : ''
      }));
      assert(appeared && snap.hasForm && snap.ready !== 'loading', 'blank while fonts stall: ' + JSON.stringify(snap));
      await s.page.waitForFunction(() => {
        const el = document.querySelector('#auth-submit [data-i18n="a.auth.btn_login"]');
        return el && el.textContent.indexOf('Sign In') !== -1;
      }, null, { timeout: 8000 });
      const family = await s.page.evaluate(() => getComputedStyle(document.body).fontFamily);
      assert(/sans-serif|apple-system|Segoe UI|Roboto/i.test(family), 'no system fallback: ' + family);
      await fillLogin(s.page);
      const before = s.state.loginHits;
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await s.page.waitForSelector('#client-dashboard', { state: 'visible', timeout: 10000 });
      assert(s.state.loginHits === before + 1, 'login count ' + s.state.loginHits);
      assert(s.state.fonts.some((u) => u.includes('fonts.googleapis.com')), 'googleapis was not left pending');
      assert(s.state.fonts.every((u) => /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u)), s.state.fonts.join(' '));
      // WebKit's screenshot waits on document.fonts.ready. That promise stays
      // pending on purpose here; the form and the single login already settled.
      await s.page.screenshot({ path: path.join(outDir, 'login-' + label + '-fonts-stalled.png'), timeout: 3000 }).catch((err) => {
        if (!/fonts to load|Timeout/i.test(String(err))) throw err;
      });
    } finally { await s.browser.close(); }
  }

  await check('stalled fonts.googleapis.com/fonts.gstatic.com still shows login (chromium)', async () => {
    await stalledFontsLogin(chromium, 'chromium');
  });

  await check('stalled fonts.googleapis.com/fonts.gstatic.com still shows login (webkit)', async () => {
    await stalledFontsLogin(webkit, 'webkit');
  });

  async function fontsApply(browserType) {
    const s = await boot(browserType, { width: 1280, height: 800 }, { origin, cdn: 'block', font: 'apply' });
    try {
      await openAccount(s.page, origin);
      await s.page.waitForFunction(() => {
        const link = document.getElementById('na-fonts');
        const probe = getComputedStyle(document.documentElement).getPropertyValue('--na-fonts-applied').trim();
        return link && link.media === 'all' && probe === '1';
      }, null, { timeout: 8000 });
      assert(s.state.fonts.some((u) => u.includes('fonts.googleapis.com')), 'stylesheet was not requested');
      assert(s.state.fonts.some((u) => u.includes('fonts.gstatic.com')), 'font file host was not requested');
      const family = await s.page.evaluate(() => getComputedStyle(document.querySelector('.auth-wrap h1')).fontFamily);
      assert(/Unbounded|sans-serif/i.test(family), family);
    } finally { await s.browser.close(); }
  }

  await check('loaded Google Fonts stylesheet still applies (chromium)', async () => {
    await fontsApply(chromium);
  });

  await check('loaded Google Fonts stylesheet still applies (webkit)', async () => {
    await fontsApply(webkit);
  });

  let webkitStatus = 'not-run';
  await check('webkit mobile login under blocked CDN', async () => {
    let s;
    try {
      s = await boot(webkit, { width: 390, height: 844 }, { origin, cdn: 'block' });
    } catch (err) {
      webkitStatus = 'launch-failed: ' + err.message;
      throw err;
    }
    try {
      webkitStatus = 'ran';
      await openAccount(s.page, origin);
      await fillLogin(s.page);
      s.state.mode = '401';
      await s.page.locator('#auth-form').evaluate((form) => form.requestSubmit());
      await s.page.waitForFunction(() => /Incorrect email or password/.test(document.getElementById('auth-error').textContent));
      await s.page.screenshot({ path: path.join(outDir, 'login-webkit-mobile-401.png') });
    } finally { await s.browser.close(); }
  });

  server.close();
  const failed = results.filter((r) => !r.ok);
  const summary = { origin, webkitStatus, passed: results.filter((r) => r.ok).length, failed: failed.length, results };
  fs.writeFileSync('/opt/cursor/artifacts/pr163-results.json', JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed, webkitStatus }, null, 2));
  if (failed.length) process.exit(1);
}

run().catch((err) => { console.error(err); process.exit(1); });
