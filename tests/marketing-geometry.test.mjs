/**
 * Geometry and interaction regressions for issue 165.
 *
 * Serves this repo over localhost and measures the real pages in headless
 * Chrome. Chrome binary: CHROME_PATH, else /usr/bin/google-chrome.
 *
 *   cd tests && npm install && npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const shotDir = '/opt/cursor/artifacts/issue-165';
// The face that wins each stack in redesign.css (--body-font / --hero-font /
// --mono-font) plus Space Grotesk where a control sets it directly.
// DM Sans is only the fallback behind Inter, so Chrome does not download it.
const INTENDED_FACES = [
  { selector: 'body', family: 'Inter', weight: '400' },
  { selector: '.heading-space, h1, h2', family: 'Unbounded', weight: '500' },
  { selector: '.eyebrow', family: 'JetBrains Mono', weight: '600' },
  { selector: '.img-stack-tab, .photo-fallback-label', family: 'Space Grotesk', weight: '600' },
];
const WIDTHS = [320, 375, 390, 430, 768, 1180, 1440];
const LANGS = ['ru', 'en', 'es'];
const ROUTES = [
  ['home', 'index.html'],
  ['lab', 'lab.html'],
  ['method', 'method.html'],
  ['programs', 'programs.html'],
  ['xr', 'xr.html'],
  ['dom', 'dom.html'],
  ['custom', 'custom.html'],
  ['test', 'test.html'],
];

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function startServer(port) {
  const child = spawn('python3', ['-u', '-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error('static server did not start'));
    }, 8000);
    const probe = () => {
      if (settled) return;
      fetch('http://127.0.0.1:' + port + '/index.html', { method: 'HEAD' })
        .then((res) => {
          if (settled) return;
          if (!res.ok) throw new Error('status ' + res.status);
          settled = true;
          clearTimeout(timer);
          resolve(child);
        })
        .catch(() => { if (!settled) setTimeout(probe, 80); });
    };
    child.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('static server exited ' + code));
    });
    probe();
  });
}

async function bootPage(browser, lang) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.evaluateOnNewDocument((code) => {
    try {
      localStorage.setItem('na_lang', code);
      localStorage.setItem('na_lang_explicit', code);
      localStorage.setItem('na_geo_done', '1');
    } catch (e) {}
    window.__cls = 0;
    try {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput) window.__cls += entry.value;
        });
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (e) {}
  }, lang);
  page.__errors = errors;
  return page;
}

async function open(page, base, file, width) {
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.goto(base + file, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(
    () => document.body && getComputedStyle(document.body).opacity !== '0',
    { timeout: 8000 }
  );
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    function boxFor(el) {
      const container = el.closest('.container');
      if (!container) return vw;
      const pcs = getComputedStyle(container);
      return container.clientWidth - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
    }
    function labelOf(el) {
      return ((el.className && String(el.className)) || el.tagName).toString().slice(0, 80);
    }
    const boxes = 'h1, h2, h3, .glass-card, .glass-card-elevated, .glass-card-bright, .fact-card, .stat-box, .pillar, .img-stack, .split-media, .grid.grid-2, .card-row, .img-stack-tabs';
    document.querySelectorAll(boxes).forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (el.offsetWidth < 1 || el.offsetHeight < 1) return;
      const box = boxFor(el);
      if (el.offsetWidth > box + 1.5) {
        bad.push({ kind: 'wider', label: labelOf(el), w: el.offsetWidth, box: Math.round(box * 10) / 10 });
      }
    });
    // Rendered line boxes, not just the element's border box. A heading or
    // card line that paints past its own padding is a clip even when the
    // card's offsetWidth still matches the column.
    const textHosts = 'h1, h2, h3, .card-row .heading-space, .list-bullet li, .glass-card p, .glass-card-elevated p, .fact-card p, .stat-box, .img-stack-tab';
    document.querySelectorAll(textHosts).forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (el.clientWidth < 1 || el.clientHeight < 1) return;
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 48);
      if (!text) return;
      if (el.scrollWidth > el.clientWidth + 2) {
        bad.push({ kind: 'text-clipped', label: labelOf(el), text, scroll: el.scrollWidth, client: el.clientWidth });
      }
      const range = document.createRange();
      range.selectNodeContents(el);
      const host = el.getBoundingClientRect();
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue;
        if (r.left < host.left + padL - 1.5 || r.right > host.right - padR + 1.5) {
          bad.push({
            kind: 'text-outside',
            label: labelOf(el),
            text,
            left: Math.round(r.left),
            right: Math.round(r.right),
            hostL: Math.round(host.left + padL),
            hostR: Math.round(host.right - padR),
          });
          break;
        }
      }
    });
    const stacks = [...document.querySelectorAll('.img-stack')].map((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    const logo = document.querySelector('.navbar .nav-logo');
    let logoInfo = null;
    if (logo) {
      const lr = logo.getBoundingClientRect();
      const nav = document.querySelector('.nav-right');
      const nr = nav ? nav.getBoundingClientRect() : null;
      logoInfo = {
        w: lr.width,
        h: lr.height,
        client: logo.clientWidth,
        scroll: logo.scrollWidth,
        text: logo.innerText.replace(/\s+/g, ' ').trim(),
        overlaps: !!(nr && lr.right > nr.left + 1 && lr.left < nr.right),
      };
    }
    const nbspTooLong = [];
    document.querySelectorAll('h1, h2, h3').forEach((el) => {
      String(el.innerText || '').split(/[ \n\t\r]+/).forEach((run) => {
        if (run.includes('\u00a0') && run.length > 12) nbspTooLong.push(run);
      });
    });
    return { bad, stacks, logoInfo, nbspTooLong, scroll: document.documentElement.scrollWidth, client: vw };
  });
}

async function intendedFontReport(page) {
  return page.evaluate(async (specs) => {
    const link = document.getElementById('na-fonts');
    const deadline = Date.now() + 15000;
    while (link && link.media !== 'all' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 40));
    }
    if (document.fonts && document.fonts.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 15000)),
      ]);
    }
    const faces = [];
    document.fonts.forEach((face) => {
      faces.push({
        family: String(face.family).replace(/^['"]|['"]$/g, ''),
        weight: String(face.weight),
        status: face.status,
      });
    });
    const missing = [];
    if (!link || link.media !== 'all') missing.push('stylesheet media=' + (link && link.media));
    specs.forEach((spec) => {
      const el = document.querySelector(spec.selector);
      if (!el) return;
      const specified = getComputedStyle(el).fontFamily || '';
      const first = specified.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
      const weights = spec.weight === '400' ? ['400', 'normal'] : [spec.weight];
      const loaded = faces.some((f) => f.family === spec.family && weights.includes(f.weight) && f.status === 'loaded');
      const check = document.fonts.check(spec.weight + ' 16px "' + spec.family + '"');
      if (first !== spec.family || !loaded || !check) {
        missing.push(spec.family + ' ' + spec.weight + ' first=' + first + ' loaded=' + loaded + ' check=' + check);
      }
    });
    return {
      media: link ? link.media : null,
      missing,
      loaded: faces.filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight),
      errored: faces.filter((f) => f.status === 'error').map((f) => f.family + ' ' + f.weight),
      cls: window.__cls || 0,
    };
  }, INTENDED_FACES);
}

function fontBlockingError(report) {
  return 'External font blocking: the normal-network matrix requires the painted faces (Inter 400, Unbounded 500, JetBrains Mono 600, and Space Grotesk 600 where that control exists) to load. A system-font fallback is not a pass. ' + JSON.stringify(report);
}

function hangFonts(page) {
  const hung = [];
  return page.setRequestInterception(true).then(() => {
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) hung.push(req);
      else req.continue().catch(() => {});
    });
    return hung;
  });
}

function release(hung) {
  hung.forEach((req) => {
    try { req.abort('timedout'); } catch (e) {}
  });
}

let browser;
let server;
let port;
let base;

test.before(async () => {
  port = await freePort();
  server = await startServer(port);
  base = 'http://127.0.0.1:' + port + '/';
  browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
});

test.after(async () => {
  if (browser) await browser.close();
  if (server) server.kill();
});

const NORMAL_SHOTS = {
  'en 390 home': 'fonts-normal-home-390-en',
  'ru 430 home': 'fonts-normal-home-430-ru',
  'es 320 lab': 'fonts-normal-lab-320-es',
  'en 1180 lab': 'fonts-normal-lab-1180-en',
};

async function shoot(page, file, filename) {
  fs.mkdirSync(shotDir, { recursive: true });
  await page.evaluate((which) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const target = which === 'index.html'
      ? document.querySelector('.grid.grid-2 .glass-card')
      : document.querySelector('h1');
    if (target) target.scrollIntoView({ block: 'center' });
  }, file);
  await page.screenshot({ path: path.join(shotDir, filename + '.png') });
}

test('marketing pages fit the content box with intended fonts loaded', async () => {
  const failures = [];
  for (const lang of LANGS) {
    const page = await bootPage(browser, lang);
    // Photo URLs 403. Aborting them keeps the matrix on layout and fonts.
    // Google Fonts requests are allowed: this matrix is the normal-network pass.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('cloudfront.net')) req.abort().catch(() => {});
      else req.continue().catch(() => {});
    });
    for (const width of WIDTHS) {
      for (const [name, file] of ROUTES) {
        await open(page, base, file, width);
        const fonts = await intendedFontReport(page);
        if (fonts.missing.length || fonts.media !== 'all') {
          assert.fail(fontBlockingError(fonts));
        }
        const shot = NORMAL_SHOTS[lang + ' ' + width + ' ' + name];
        if (shot) await shoot(page, file, shot);
        if (page.__errors.length) {
          failures.push(lang + ' ' + width + ' ' + name + ' pageerror ' + page.__errors.join(' | '));
          page.__errors.length = 0;
        }
        const m = await measure(page);
        m.bad.forEach((b) => failures.push(lang + ' ' + width + ' ' + name + ' ' + JSON.stringify(b)));
        m.stacks.forEach((s, i) => {
          if (s.w < 20 || s.h < 20) failures.push(lang + ' ' + width + ' ' + name + ' stack' + i + ' ' + s.w + 'x' + s.h);
        });
        if (m.nbspTooLong.length) failures.push(lang + ' ' + width + ' ' + name + ' nbsp ' + m.nbspTooLong.join(','));
        if ((file === 'index.html' || file === 'lab.html') && width <= 860) {
          const stackState = await page.evaluate(() => {
            const layers = [...document.querySelectorAll('.img-stack .stack-layer')];
            return {
              visible: layers.filter((el) => getComputedStyle(el).visibility === 'visible').length,
              tabs: document.querySelectorAll('.img-stack-tab').length,
              tabDisplay: getComputedStyle(document.querySelector('.img-stack-tabs')).display,
            };
          });
          if (stackState.visible !== 1 || stackState.tabs !== 3 || stackState.tabDisplay !== 'flex') {
            failures.push(lang + ' ' + width + ' ' + name + ' stack-tabs ' + JSON.stringify(stackState));
          }
        }
        if ((file === 'index.html' || file === 'lab.html') && width > 860) {
          const fan = await page.evaluate(() => ({
            visible: [...document.querySelectorAll('.img-stack .stack-layer')].filter((el) => getComputedStyle(el).visibility === 'visible').length,
            tabs: getComputedStyle(document.querySelector('.img-stack-tabs')).display,
          }));
          if (fan.visible !== 3 || fan.tabs !== 'none') {
            failures.push(lang + ' ' + width + ' ' + name + ' fan ' + JSON.stringify(fan));
          }
        }
        if (width <= 360 && m.logoInfo) {
          if (!m.logoInfo.text.includes('Neuro') || !m.logoInfo.text.includes('Attention')) {
            failures.push(lang + ' ' + width + ' ' + name + ' logo text ' + m.logoInfo.text);
          }
          if (m.logoInfo.scroll > m.logoInfo.client + 2) {
            failures.push(lang + ' ' + width + ' ' + name + ' logo clipped ' + m.logoInfo.scroll + '>' + m.logoInfo.client);
          }
          if (m.logoInfo.overlaps) failures.push(lang + ' ' + width + ' ' + name + ' logo overlaps nav');
        }
      }
    }
    await page.close();
  }
  assert.deepEqual(failures, [], failures.slice(0, 12).join('\n'));
});

test('narrow lab stack shows one photograph at a time by tab, keyboard, and tap', async () => {
  const page = await bootPage(browser, 'en');
  for (const file of ['index.html', 'lab.html']) {
    for (const width of [320, 390]) {
      await open(page, base, file, width);
      const tabs = await page.$$('.img-stack-tab');
      assert.equal(tabs.length, 3, file + ' ' + width);
      const tabBox = await page.$eval('.img-stack-tab', (el) => {
        const r = el.getBoundingClientRect();
        return { h: r.height, display: getComputedStyle(el.parentElement).display };
      });
      assert.equal(tabBox.display, 'flex');
      assert.ok(tabBox.h >= 44, 'tab height ' + tabBox.h);

      async function visibleAlts() {
        await page.waitForFunction(() => {
          const selected = document.querySelector('.img-stack-tab[aria-selected="true"]');
          const current = selected && document.getElementById(selected.getAttribute('aria-controls'));
          if (!current) return false;
          const layers = [...document.querySelectorAll('.img-stack .stack-layer')];
          const opaque = (el) => parseFloat(getComputedStyle(el).opacity) > 0.95
            && getComputedStyle(el).visibility === 'visible';
          const faded = (el) => parseFloat(getComputedStyle(el).opacity) < 0.05;
          return opaque(current) && layers.filter((el) => el !== current).every(faded);
        }, { timeout: 2000 });
        return page.$$eval('.img-stack .stack-layer', (els) => els.map((el) => {
          const cs = getComputedStyle(el);
          const img = el.querySelector('img');
          return {
            on: cs.visibility === 'visible' && parseFloat(cs.opacity) > 0.95,
            alt: img ? img.getAttribute('alt') : '',
            hidden: el.getAttribute('aria-hidden'),
          };
        }));
      }

      let state = await visibleAlts();
      assert.equal(state.filter((s) => s.on).length, 1, JSON.stringify(state));
      const firstAlt = state.find((s) => s.on).alt;

      await page.setViewport({ width, height: 900, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
      await page.evaluate(() => {
        document.documentElement.style.scrollBehavior = 'auto';
        document.querySelector('.img-stack-tabs').scrollIntoView({ block: 'center' });
      });
      const tab3 = await page.$('#home-lab-tab-3, #lab-tab-3');
      const tab3Box = await tab3.boundingBox();
      await page.touchscreen.tap(tab3Box.x + tab3Box.width / 2, tab3Box.y + tab3Box.height / 2);
      state = await visibleAlts();
      const shown = state.filter((s) => s.on);
      assert.equal(shown.length, 1);
      assert.match(shown[0].alt, /Headband/);
      assert.notEqual(shown[0].alt, firstAlt);
      const selected = await page.$eval('.img-stack-tab[aria-selected="true"]', (el) => el.id);
      assert.match(selected, /tab-3$/);

      await page.focus('#home-lab-tab-1, #lab-tab-1');
      await page.keyboard.press('ArrowRight');
      const afterKey = await page.$eval('.img-stack-tab[aria-selected="true"]', (el) => ({
        id: el.id,
        label: el.getAttribute('aria-label'),
      }));
      assert.match(afterKey.id, /tab-2$/);
      assert.match(afterKey.label, /team|Team|команды/i);
      state = await visibleAlts();
      assert.equal(state.filter((s) => s.on).length, 1);
      assert.match(state.find((s) => s.on).alt, /Team/);

      const target = await page.$('.img-stack-tab[aria-selected="false"]');
      const box = await target.boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      state = await visibleAlts();
      assert.equal(state.filter((s) => s.on).length, 1);

      await page.evaluate(() => {
        document.documentElement.style.scrollBehavior = 'auto';
        document.querySelector('.img-stack').scrollIntoView({ block: 'center' });
      });
      const before = await page.$eval('.img-stack-tab[aria-selected="true"]', (el) => el.id);
      const stackBox = await page.$eval('.img-stack', (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      await page.touchscreen.tap(stackBox.x, stackBox.y);
      const afterTap = await page.$eval('.img-stack-tab[aria-selected="true"]', (el) => el.id);
      assert.notEqual(afterTap, before);
      state = await visibleAlts();
      assert.equal(state.filter((s) => s.on).length, 1);
    }
  }
  await page.close();
});

test('reduced motion keeps a single stack layer and drops its transition', async () => {
  const page = await bootPage(browser, 'ru');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await open(page, base, 'index.html', 390);
  const info = await page.evaluate(() => {
    const layers = [...document.querySelectorAll('.img-stack .stack-layer')];
    const visible = layers.filter((el) => getComputedStyle(el).visibility === 'visible');
    const dur = visible.length ? getComputedStyle(visible[0]).transitionDuration : '';
    const fade = document.querySelector('.fade-up, .fade-right');
    return {
      visible: visible.length,
      dur,
      fadeOpacity: fade ? getComputedStyle(fade).opacity : null,
    };
  });
  assert.equal(info.visible, 1);
  assert.equal(info.dur, '0s');
  assert.equal(info.fadeOpacity, '1');
  await page.close();
});

test('desktop fan still shows all three layers and click brings one forward', async () => {
  const page = await bootPage(browser, 'en');
  await open(page, base, 'lab.html', 1180);
  const info = await page.evaluate(() => {
    const layers = [...document.querySelectorAll('.img-stack .stack-layer')];
    const tabs = getComputedStyle(document.querySelector('.img-stack-tabs')).display;
    return {
      tabs,
      visible: layers.filter((el) => getComputedStyle(el).visibility === 'visible').length,
      lefts: layers.map((el) => Math.round(el.getBoundingClientRect().left)),
    };
  });
  assert.equal(info.tabs, 'none');
  assert.equal(info.visible, 3);
  assert.ok(new Set(info.lefts).size > 1, 'fan collapsed ' + info.lefts.join(','));
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelector('.img-stack').scrollIntoView({ block: 'center' });
  });
  await page.$eval('.img-stack .stack-layer:nth-child(3)', (el) => el.click());
  const front = await page.$eval('.img-stack .stack-layer.front img', (img) => img.getAttribute('alt'));
  assert.match(front, /Headband/);
  await page.close();
});

test('a stalled Google Fonts stylesheet does not block first paint', async () => {
  const samples = [];
  for (const file of ['index.html', 'lab.html', 'method.html']) {
    const page = await bootPage(browser, 'en');
    const hung = await hangFonts(page);
    const started = Date.now();
    await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
    const nav = page.goto(base + file, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(
      () => {
        const h = document.querySelector('h1');
        const fonts = document.getElementById('na-fonts');
        const bodyOn = document.body && getComputedStyle(document.body).opacity !== '0';
        return h && h.getBoundingClientRect().height > 0 && fonts && fonts.media === 'print' && bodyOn;
      },
      { timeout: 2000 }
    );
    await nav;
    const elapsed = Date.now() - started;
    const snap = await page.evaluate(() => ({
      media: document.getElementById('na-fonts').media,
      h1: document.querySelector('h1').getBoundingClientRect().height,
      cls: window.__cls || 0,
      opacity: getComputedStyle(document.body).opacity,
    }));
    samples.push({ file, elapsed, ...snap, errors: page.__errors.slice() });
    assert.equal(snap.media, 'print', file);
    assert.ok(snap.h1 > 0, file);
    assert.equal(snap.opacity, '1');
    assert.ok(snap.cls < 0.1, file + ' cls ' + snap.cls);
    assert.ok(elapsed < 2000, file + ' took ' + elapsed);
    assert.deepEqual(page.__errors, []);
    release(hung);
    await page.close();
  }
  assert.equal(samples.length, 3);
});

test('a stalled Google Fonts sheet still lays out cards on fallback faces', async () => {
  const page = await bootPage(browser, 'en');
  const hung = await hangFonts(page);
  await open(page, base, 'index.html', 390);
  const fonts = await page.evaluate(() => ({
    media: document.getElementById('na-fonts').media,
    loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
  }));
  assert.equal(fonts.media, 'print');
  assert.deepEqual(fonts.loaded, []);
  const m = await measure(page);
  assert.deepEqual(m.bad, [], m.bad.slice(0, 6).map((b) => JSON.stringify(b)).join('\n'));
  await shoot(page, 'index.html', 'fonts-fallback-home-390-en');
  release(hung);
  await page.close();
});

test('account sign-in still renders while Google Fonts hang', async () => {
  const page = await bootPage(browser, 'en');
  const hung = await hangFonts(page);
  const errors = page.__errors;
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
  const nav = page.goto(base + 'account.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(
    () => {
      const email = document.getElementById('login-id');
      const pass = document.getElementById('login-pass');
      const screen = document.getElementById('auth-screen');
      const fonts = document.getElementById('na-fonts');
      const shown = screen && getComputedStyle(screen).display !== 'none';
      const bodyOn = document.body && getComputedStyle(document.body).opacity !== '0';
      return email && pass && shown && bodyOn && fonts && fonts.media === 'print';
    },
    { timeout: 2000 }
  );
  await nav;
  const snap = await page.evaluate(() => ({
    email: document.getElementById('login-id').type,
    pass: document.getElementById('login-pass').type,
    opacity: getComputedStyle(document.body).opacity,
    media: document.getElementById('na-fonts').media,
    cls: window.__cls || 0,
  }));
  assert.equal(snap.email, 'email');
  assert.equal(snap.pass, 'password');
  assert.equal(snap.opacity, '1');
  assert.equal(snap.media, 'print');
  assert.ok(snap.cls < 0.1, 'cls ' + snap.cls);
  assert.deepEqual(errors, []);
  release(hung);
  await page.close();
});
