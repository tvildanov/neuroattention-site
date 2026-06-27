import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

// PR #80 prod verification: per-region opacity slider must reach a true 1.0 even
// when the layer slider is dimmed to 0.5. Drives test-atlas.html (window.A).
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const URL = process.env.ATLAS_URL || 'https://neuroattention.org/test-atlas.html';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl',
    '--window-size=1200,1000'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 1000 });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction('window.A && window.A.root', { timeout: 60000 });

const loaded = await page.evaluate(async () => {
  const A = window.A;
  A.toggleLayer('skeleton', true);
  A.setLayerOpacity('skeleton', 0.5);
  const t0 = Date.now();
  function ribIds() {
    const ids = new Set();
    A.root.traverse((o) => {
      if (!o.isMesh || !o.userData) return;
      const s = (o.userData.regionId || o.userData.baseSlug || o.userData.originalName || '').toLowerCase();
      if (/muscle|cartilage/.test(s)) return;            // bones only, not iliocostalis muscle
      if (/(^|_)rib|costa(?!rticular)/.test(s)) ids.add(o.userData.regionId || o.userData.baseSlug);
    });
    return [...ids].filter(Boolean);
  }
  while (Date.now() - t0 < 30000) {
    const ids = ribIds();
    if (ids.length) return { ribIds: ids };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { ribIds: [] };
});

if (!loaded.ribIds.length) {
  console.error('FAIL: no rib meshes found after skeleton load');
  console.error('pageErrors:', pageErrors);
  await browser.close();
  process.exit(2);
}
const rid = loaded.ribIds[0];

const result = await page.evaluate((rid) => {
  const A = window.A;
  function sample() {
    const vals = [];
    A._forEachRegionMesh(rid, (m) => {
      const u = m.material && m.material.uniforms;
      vals.push({
        uOpacity: u && u.uOpacity ? u.uOpacity.value : null,
        uSolid: u && u.uSolid ? u.uSolid.value : null,
        blending: m.material ? m.material.blending : null,
        depthWrite: m.material ? m.material.depthWrite : null,
      });
    });
    return vals;
  }
  const beforeLayer = sample();
  A.setRegionOpacity(rid, 1.0);
  const at100 = sample();
  if (A.clearRegionOverride) A.clearRegionOverride(rid);
  const afterReset = sample();
  return { rid, count: at100.length, beforeLayer, at100, afterReset };
}, rid);

await page.evaluate((rid) => { window.A.setRegionOpacity(rid, 1.0); }, rid);
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: '/tmp/atlas-region-opacity-1.0.png' });

const all100 = result.at100.length > 0 && result.at100.every((v) => v.uOpacity === 1.0);
const allSolid = result.at100.every((v) => v.uSolid === 1.0 || v.uSolid === null);
// reset is correct when each mesh returns to its pre-override layer value (< 1.0,
// i.e. NOT stuck solid) — compare against the layer-only sample, not a fixed number.
const resetOk = result.afterReset.every((v, i) =>
  v.uOpacity !== null && v.uOpacity < 0.999 &&
  Math.abs(v.uOpacity - result.beforeLayer[i].uOpacity) < 0.001);

console.log(JSON.stringify({
  url: URL, rid: result.rid, meshCount: result.count,
  beforeLayer_uOpacity: result.beforeLayer.map((v) => v.uOpacity),
  at100_uOpacity: result.at100.map((v) => v.uOpacity),
  at100_uSolid: result.at100.map((v) => v.uSolid),
  at100_blending: result.at100.map((v) => v.blending),
  afterReset_uOpacity: result.afterReset.map((v) => v.uOpacity),
  pageErrors, PASS_at100: all100, PASS_solid: allSolid, PASS_reset: resetOk,
}, null, 2));
writeFileSync('/tmp/atlas-region-opacity-report.json', JSON.stringify(result, null, 2));
await browser.close();

if (all100 && resetOk) {
  console.log('\nPASS - per-region slider hits uOpacity=1.0 over a 0.5 layer, resets cleanly.');
  process.exit(0);
} else {
  console.error('\nFAIL - see values above.');
  process.exit(1);
}
