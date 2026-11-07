// Run with Playwright installed. Optional CHROME_PATH points to a local Chromium.
// NA_PREVIEW_URL defaults to a local static server; never submits forms or uses accounts.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(new URL('..', import.meta.url).pathname);
let server;
let base = process.env.NA_PREVIEW_URL;
if (!base) {
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw Error('Not a file');
      const types = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png'};
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch {
      res.writeHead(404); res.end();
    }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
}
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
});
const results = [];
try {
  for (const width of [320, 375, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' });
    await context.addInitScript(() => {
      try { localStorage.setItem('na_lang', 'ru'); localStorage.setItem('na_lang_explicit', 'ru'); } catch {}
    });
    const page = await context.newPage();
    await page.goto(base);
    assert.equal(await page.locator('.dom-intro-toggle').getAttribute('aria-expanded'), 'true');
    const geometry = await page.evaluate(() => {
      const bounds = s => {
        const e = document.querySelector(s), r = e.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, scroll: e.scrollWidth };
      };
      return { logo: bounds('.navbar .nav-logo'), links: bounds('.nav-links'), right: bounds('.nav-right'), cover: bounds('.dom-intro-cover') };
    });
    assert(geometry.logo.right <= (geometry.links.width ? geometry.links.left : geometry.right.left) + 1);
    assert(geometry.cover.scroll <= geometry.cover.width + 1);
    await page.waitForFunction(() => document.querySelector('.dom-intro-panel').hidden, null, { timeout: 10000 });
    assert.equal(await page.locator('.dom-intro-toggle').getAttribute('aria-expanded'), 'false');
    await page.locator('.dom-intro-toggle').click();
    await page.waitForTimeout(4000);
    assert.equal(await page.locator('.dom-intro-toggle').getAttribute('aria-expanded'), 'true', 'Manual reopening must stay open');
    await page.locator('.dom-intro-skip').click();
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => window.scrollY), 0, 'Skip must not invoke shared smooth-scroll');
    await page.locator('.dom-intro-toggle').click();
    await page.locator('.dom-intro-toggle').press('Escape');
    assert.equal(await page.locator('.dom-intro-toggle').getAttribute('aria-expanded'), 'false');
    results.push({ width, status: 'PASS' });
    await context.close();
  }
  for (const mode of ['reduced-motion', 'deep-link', 'no-js']) {
    const context = await browser.newContext({
      viewport: { width: 375, height: 900 },
      reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference',
      javaScriptEnabled: mode !== 'no-js'
    });
    const page = await context.newPage();
    await page.goto(base + (mode === 'deep-link' ? '/#home-hero' : ''));
    if (mode === 'no-js') {
      assert(await page.locator('.dom-intro-title').isVisible());
      assert.equal(await page.locator('.hero h1').count(), 1);
    } else {
      assert.equal(await page.locator('.dom-intro-toggle').getAttribute('aria-expanded'), 'false');
      await page.locator('.dom-intro-toggle').click();
      await page.waitForTimeout(4000);
      assert.equal(await page.locator('.dom-intro-toggle').getAttribute('aria-expanded'), 'true');
    }
    results.push({ mode, status: 'PASS' });
    await context.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  if (server) await new Promise(r => server.close(r));
}
