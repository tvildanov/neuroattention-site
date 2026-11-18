const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const root = path.resolve(process.argv[2]);
const label = process.argv[3];
const live = process.argv.includes('--live');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const user = { id: 2468, email: 'profile-review@example.test', display_name: 'Тестовый профиль', role: 'user', location_lat: 40, location_lon: -70, location_city: 'Test' };
const fixture = {
  '/api/auth/me': { ok: true, user },
  '/api/test-result/latest': { ok: true, result: { profile: 'FUTURE_SPECIALIST' } },
  '/api/users/me/resume': { ok: true, resume: { name_ru: 'NeuroAttention', name_en: 'NeuroAttention', slug: 'neuroattention', total_blocks: 10, done_blocks: 4 } },
};
const asset = 'dom-profile-neural-light.webp';
const pseudo = async page => page.evaluate(() => {
  const atmosphere = document.querySelector('.deep-atmosphere');
  const overlay = getComputedStyle(atmosphere, '::after');
  const box = atmosphere.getBoundingClientRect();
  return { content: overlay.content, image: overlay.backgroundImage, pointer: overlay.pointerEvents, anchor: getComputedStyle(atmosphere).position, box: [box.x, box.y, box.width, box.height] };
});
const pixel = (image, x, y) => image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 3);
const delta = (a, b, x, y) => [...pixel(a, x, y)].reduce((sum, v, i) => sum + Math.abs(v - pixel(b, x, y)[i]), 0);

(async () => {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const file = path.join(root, url.pathname);
    try {
      const buffer = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(buffer);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = live ? 'https://dom.institute' : `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.PROFILE_QA_CHROME, channel: process.env.PROFILE_QA_CHROME ? undefined : 'chrome', headless: true });
    for (const options of [
      { width: 1440, height: 900, theme: 'light', lang: 'ru', signedIn: true },
      { width: 390, height: 844, theme: 'light', lang: 'ru', signedIn: true },
      { width: 1440, height: 900, theme: 'dark', lang: 'en', signedIn: true },
      { width: 390, height: 844, theme: 'light', lang: 'es', signedIn: false },
      { width: 1280, height: 720, theme: 'light', lang: 'en', signedIn: true, courses: true },
    ]) {
      const { width, height, theme, lang, signedIn, courses } = options;
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', serviceWorkers: 'block', isMobile: width < 500, hasTouch: width < 500 });
      await context.addInitScript(({ theme, lang, signedIn, user }) => {
        localStorage.setItem('dom_theme', theme);
        localStorage.setItem('na_lang', lang);
        localStorage.setItem('na_lang_explicit', lang);
        localStorage.setItem('na_geo_done', '1');
        if (signedIn) localStorage.setItem('na_token', 'local-browser-fixture');
        if (signedIn) localStorage.setItem('na_user', JSON.stringify(user));
      }, { theme, lang, signedIn, user });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: fixture[url.pathname] || { ok: true, data: [], entries: [], items: [], days: [], nodes: [], edges: [] } });
        if (url.origin === origin) return route.continue();
        return route.abort();
      });
      const page = await context.newPage();
      const textureRequests = [];
      page.on('response', response => { if (response.url().endsWith(asset)) textureRequests.push(response.status()); });
      await page.goto(`${origin}/account.html${courses ? '#courses' : '#overview'}`, { waitUntil: 'domcontentloaded' });
      await page.locator(signedIn ? (courses ? '#tab-courses' : '#tab-overview') : '#auth-form').waitFor({ state: 'visible' });
      if (theme !== 'light' || !signedIn || courses) {
        assert.equal((await pseudo(page)).content, 'none');
        assert.deepEqual(textureRequests, []);
      } else {
        await page.waitForFunction(() => document.querySelector('#rpg-profile-name')?.textContent === 'FUTURE SPECIALIST');
        await page.locator('#resume-card').waitFor({ state: 'visible' });
        await page.waitForFunction(async name => {
          const image = new Image();
          image.src = `assets/images/${name}`;
          await image.decode();
          return image.naturalWidth === 3072 && image.naturalHeight === 3072;
        }, asset, { timeout: 12000 });
        await page.evaluate(() => document.fonts.ready);
        const layer = await pseudo(page);
        assert.match(layer.image, /dom-profile-neural-light\.webp/);
        assert.equal(layer.anchor, 'fixed');
        assert.equal(layer.pointer, 'none');
        assert.deepEqual(layer.box, [0, 0, width, height]);
        assert(textureRequests.includes(200));
        const heroBefore = await page.locator('#rpg-hero').evaluate(e => e.getBoundingClientRect().top);
        const initial = PNG.sync.read(await page.screenshot({ path: path.join(__dirname, `${label}-${width}.png`) }));
        await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
        await page.waitForFunction(() => window.scrollY > 200);
        const heroAfter = await page.locator('#rpg-hero').evaluate(e => e.getBoundingClientRect().top);
        assert(heroAfter < heroBefore - 200, 'profile card scrolls');
        assert.deepEqual((await pseudo(page)).box, layer.box, 'the atmosphere remains fixed');
        const scrolled = PNG.sync.read(await page.screenshot());
        assert(delta(initial, scrolled, width - 3, Math.floor(height * 0.57)) < 5, 'texture pixels stay fixed across scroll');
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        const css = await page.addStyleTag({ content: '.deep-atmosphere::after { visibility: hidden !important; }' });
        const plain = PNG.sync.read(await page.screenshot());
        await css.evaluate(e => e.remove());
        assert(delta(initial, plain, width - 3, Math.floor(height * 0.57)) > 15, 'the right edge visibly renders the texture');
        assert(delta(initial, plain, 3, Math.floor(height * 0.57)) < 3, 'the left edge remains untouched');
        await page.locator('[data-theme-switch]').click();
        await page.waitForFunction(() => document.documentElement.dataset.domTheme === 'dark');
        assert.equal((await pseudo(page)).content, 'none');
        await page.locator('[data-theme-switch]').click();
        await page.waitForFunction(() => document.documentElement.dataset.domTheme === 'light');
        const toggle = page.locator('.dom-cabinet-toggle');
        const openNavigation = async () => {
          if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
        };
        await openNavigation();
        const group = page.locator('.dom-cabinet-path-group');
        if (await group.isVisible() && !await group.evaluate(element => element.open)) await group.locator('summary').click();
        await page.locator('#client-dashboard .dash-nav-primary a[data-tab="courses"]:visible').first().click();
        assert.equal((await pseudo(page)).content, 'none');
        await openNavigation();
        await page.locator('#client-dashboard .dash-nav-primary a[data-tab="overview"]:visible').first().click();
        assert.match((await pseudo(page)).image, /dom-profile-neural-light\.webp/);
        await page.evaluate(() => showSection('auth'));
        assert.equal((await pseudo(page)).content, 'none');
      }
      console.log(`${label} ${width}px ${lang} ${theme} ${courses ? 'courses' : signedIn ? 'profile' : 'sign-in'} passed`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
