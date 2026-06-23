import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

// PR #80 verification: the per-region opacity slider must reach a true 1.0 even
// when the layer slider is dimmed. Drives test-atlas.html on prod:
//   1. skeleton layer ON, layer opacity = 0.5
//   2. pick a rib mesh, A.setRegionOpacity(rid, 1.0)
//   3. assert every rib mesh's mat.uniforms.uOpacity.value === 1.0
//   4. close (resetRegion) → assert it snaps back to layer value (~0.5)

const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const URL = process.env.ATLAS_URL || 'https://neuroattention.org/test-atlas.html';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--window-size=1200,1000',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 1000 });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

// Wait for the atlas instance.
await page.waitForFunction('window.A && window.A.root', { timeout: 60000 });

// Turn skeleton on, dim layer to 0.5, and wait for the real GLB to stream in.
const loaded = await page.evaluate(async () => {
  const A = window.A;
  A.toggleLayer('skeleton', true);
  A.setLayerOpacity('skeleton', 0.5);
  // Wait up to ~25s for ribs to appear in the scene graph.
  const t0 = Date.now();
  function ribIds() {
    const ids = new Set();
    A.root.traverse((o) => {
      if (!o.isMesh || !o.userData) return;
      const s = (o.userData.regionId || o.userData.baseSlug || o.userData.originalName || '').toLowerCase();
      if (/rib|costa|costal/.test(s)) ids.add(o.userData.regionId || o.userData.baseSlug);
    });
    return [...ids].filter(Boolean);
  }
  while (Date.now() - t0 < 25000) {
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

// Apply per-region opacity = 1.0 and read back the uniforms for that region.
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
  const beforeLayer = sample();          // at layer 0.5, no override
  A.setRegionOpacity(rid, 1.0);
  const at100 = sample();                // per-region 100%
  A.resetRegion(rid);
  const afterReset = sample();           // back to layer 0.5
  return { rid, count: at100.length, beforeLayer, at100, afterReset };
}, rid);

await page.evaluate((rid) => { window.A.setRegionOpacity(rid, 1.0); }, rid);
await page.screenshot({ path: '/tmp/atlas-region-opacity-1.0.png' });

const all100 = result.at100.length > 0 && result.at100.every((v) => v.uOpacity === 1.0);
const allSolid = result.at100.every((v) => v.uSolid === 1.0 || v.uSolid === null);
const resetOk = result.afterReset.every((v) => v.uOpacity !== null && v.uOpacity <= 0.6);

console.log(JSON.stringify({
  rid: result.rid,
  meshCount: result.count,
  beforeLayer_uOpacity: result.beforeLayer.map((v) => v.uOpacity),
  at100_uOpacity: result.at100.map((v) => v.uOpacity),
  at100_uSolid: result.at100.map((v) => v.uSolid),
  afterReset_uOpacity: result.afterReset.map((v) => v.uOpacity),
  pageErrors,
  PASS_at100: all100,
  PASS_solid: allSolid,
  PASS_reset: resetOk,
}, null, 2));

writeFileSync('/tmp/atlas-region-opacity-report.json', JSON.stringify(result, null, 2));
await browser.close();

if (all100 && resetOk) {
  console.log('\n✅ PASS — per-region slider reaches uOpacity=1.0 over a 0.5 layer, and resets cleanly.');
  process.exit(0);
} else {
  console.error('\n❌ FAIL — see values above.');
  process.exit(1);
}
