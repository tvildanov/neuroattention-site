const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const navy = 'rgb(20, 36, 52)';
const blue = 'rgb(32, 76, 142)';
const pages = {
  dom: { titles: ['.dom-section h2', '.dom-v06-entities .dom-card h3'], copy: '.dom-section .section-text' },
  lab: { titles: ['[data-dom-v06="lab-program-title"]', '.dom-v06-research-card h3'], copy: '[data-dom-v06="lab-program-intro"]' },
  xr: { titles: ['#xr-features h2', '#xr-features h3'] },
  programs: { titles: ['#programs-main h2', '.dom-v06-summary strong', '.dom-v06-subscription h3'], copy: '.dom-v06-programs-head > p:last-child' },
  method: { titles: ['[data-i18n="m.why.title"]', '[data-i18n="m.why.c1_title"]'] },
  custom: { titles: ['[data-i18n="custom.sense.title"]', '.cat-title'] },
  projects: { titles: ['.dom-project-card h2'], copy: '.dom-project-card .dom-product-intro' },
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png' };

const capture = async (page, selector) => page.locator(selector).first().evaluate(element => {
  const style = getComputedStyle(element);
  return { font: style.fontFamily, color: style.color, weight: style.fontWeight, spacing: style.letterSpacing };
});

(async () => {
  const baseline = await fs.readFile(process.argv[2], 'utf8');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    try {
      const file = path.join(root, url.pathname);
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    for (const [theme, width, lang] of [['light', 1440, 'ru'], ['light', 390, 'es'], ['dark', 1440, 'en']]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await ctx.addInitScript(({ theme, lang }) => {
        localStorage.setItem('dom_theme', theme);
        localStorage.setItem('na_lang', lang);
        localStorage.setItem('na_lang_explicit', lang);
        localStorage.setItem('na_geo_done', '1');
      }, { theme, lang });
      await ctx.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const after = await ctx.newPage();
      const before = await ctx.newPage();
      await before.route('**/assets/dom-site-theme.css?*', route => route.fulfill({ contentType: 'text/css', body: baseline }));
      const homepageChecks = ['.dom-intro-title', '#screen-4 h2', '#dom-practice-foundation h2'];
      await Promise.all([before.goto(`${origin}/index.html`), after.goto(`${origin}/index.html`)]);
      for (const selector of homepageChecks) {
        assert.deepEqual(await capture(after, selector), await capture(before, selector), `Homepage ${selector} ${theme}`);
      }
      const reference = await capture(after, '#dom-practice-foundation h2');
      for (const [name, { titles, copy }] of Object.entries(pages)) {
        await Promise.all([before.goto(`${origin}/${name}.html`), after.goto(`${origin}/${name}.html`)]);
        const hero = 'section:first-of-type h1';
        assert.deepEqual(await capture(after, hero), await capture(before, hero), `${name} hero ${theme}`);
        for (const selector of titles) {
          const style = await capture(after, selector);
          if (theme === 'light') {
            assert.equal(style.font, reference.font, `${name} ${selector} font`);
            assert.equal(style.weight, reference.weight, `${name} ${selector} weight`);
            assert.equal(style.color, navy, `${name} ${selector} color`);
          } else {
            assert.deepEqual(style, await capture(before, selector), `${name} ${selector} dark`);
          }
        }
        if (copy) {
          const style = await capture(after, copy);
          if (theme === 'light') {
            assert.match(style.font, /Inter/);
            assert.equal(style.color, navy, `${name} intro color`);
          } else {
            assert.deepEqual(style, await capture(before, copy), `${name} intro dark`);
          }
        }
        if (name === 'dom' && theme === 'light') {
          assert.equal((await capture(after, '.dom-v06-entities .card-category')).color, blue);
          const section = after.locator('#dom-unity');
          await section.screenshot({ path: `/tmp/dom-editorial-dom-${width}.png` });
        }
        console.log(`Editorial QA passed: ${name}, ${theme}, ${width}px, ${lang}`);
      }
      await ctx.close();
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
