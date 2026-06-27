import puppeteer from 'puppeteer-core';

// PR #89 verification — Phase 0 micro-fixes on the Atlas test page (no auth; exposes
// window.A). Checks:
//   1. breasts are FOLDED into the female_reproductive layer (no standalone layer):
//      layersForSeedIds(['breasts']) === ['female_reproductive'], and the layer's
//      tagged meshes include an 'organ:breasts' group.
//   2. breasts sit at the CHEST, not the belly: breast bbox-center Y is up near the
//      lungs (organs layer) and well above the uterus.
//   3. isolate 'breasts' inside female_reproductive shows ONLY breast meshes.
//   4. focus(['breasts']) lights breasts, dims/hides the rest of the layer.
//   5. male model intact; setSex male hides ALL female_reproductive meshes (incl. breasts).
const CHROME = process.env.CHROME ||
  '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const URL = process.env.ATLAS_URL || 'http://localhost:8899/test-atlas.html';
const SHOT = process.env.SHOT || '/tmp';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl',
    '--window-size=1200,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 900 });
const errs = [];
page.on('pageerror', (e) => errs.push(String((e && e.message) || e)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction('window.A && window.A.toggleLayer', { timeout: 60000 });

async function loadLayer(layer) {
  await page.evaluate((L) => new Promise((res) => {
    const done = (d) => { if (d && d.layer === L) { window.A.off && window.A.off('layer-loaded', done); res(); } };
    window.A.on('layer-loaded', done);
    window.A.toggleLayer(L, true);
    setTimeout(res, 25000);
  }), layer);
  await new Promise(r => setTimeout(r, 700));
}

// per-organ tagged-mesh stats for a layer (mesh count + world bbox center)
async function organStats(layer) {
  return page.evaluate((L) => {
    const T = window.THREE; const out = {};
    window.A.root.traverse((o) => {
      if (!o.isMesh || !o.userData || o.userData.layer !== L) return;
      const org = o.userData.organ || '(none)';
      const g = out[org] || (out[org] = { meshes: 0, visible: 0, sex: o.userData.sex || null, box: new T.Box3() });
      g.meshes++; if (o.visible) g.visible++;
      o.updateWorldMatrix(true, false); g.box.expandByObject(o);
    });
    const r = {};
    for (const [k, g] of Object.entries(out)) {
      const c = new T.Vector3(); g.box.getCenter(c);
      r[k] = { meshes: g.meshes, visible: g.visible, sex: g.sex, ctrY: +c.y.toFixed(3) };
    }
    return r;
  }, layer);
}

const R = { errors: errs, ATLAS_URL: URL };

// 1) male model intact
await loadLayer('skeleton');
R.skeleton_meshes = await page.evaluate(() => { let n = 0; window.A.root.traverse(o => { if (o.isMesh && o.userData && o.userData.layer === 'skeleton') n++; }); return n; });

// chest reference: lungs center Y (organs layer)
await loadLayer('organs');
const organStatsObj = await organStats('organs');
R.lungs_ctrY = organStatsObj.lungs ? organStatsObj.lungs.ctrY : null;

// 2) fold check + 3) breasts under female_reproductive
R.no_standalone_breasts_layer = await page.evaluate(() => window.A.layersForSeedIds(['breasts']));
await loadLayer('female_reproductive');
await page.evaluate(() => window.A.setSex('both'));
await new Promise(r => setTimeout(r, 500));
R.repro = await organStats('female_reproductive');
R.breasts_in_repro = !!(R.repro.breasts && R.repro.breasts.meshes > 0);
R.breasts_ctrY = R.repro.breasts ? R.repro.breasts.ctrY : null;
R.uterus_ctrY = R.repro.uterus ? R.repro.uterus.ctrY : null;
R.breasts_above_uterus = (R.breasts_ctrY != null && R.uterus_ctrY != null) ? (R.breasts_ctrY > R.uterus_ctrY + 0.3) : null;
R.breasts_at_chest = (R.breasts_ctrY != null && R.lungs_ctrY != null) ? (R.breasts_ctrY > R.lungs_ctrY - 0.35) : null;
await page.screenshot({ path: `${SHOT}/pr89-female-both.png` });

// 4) isolate breasts
await page.evaluate(() => window.A.setSubLayerIsolation('female_reproductive', ['breasts']));
await new Promise(r => setTimeout(r, 400));
R.isolate_breasts = await page.evaluate(() => {
  const vis = {}; window.A.root.traverse(o => {
    if (!o.isMesh || !o.userData || o.userData.layer !== 'female_reproductive') return;
    if (o.visible) { const k = o.userData.organ || '(none)'; vis[k] = (vis[k] || 0) + 1; }
  });
  return vis; // expect only { breasts: N }
});
await page.screenshot({ path: `${SHOT}/pr89-isolate-breasts.png` });
await page.evaluate(() => window.A.setSubLayerIsolation('female_reproductive', []));

// 5) focus breasts
await page.evaluate(() => window.A.focusRegions(['breasts']));
await new Promise(r => setTimeout(r, 500));
R.focus_breasts = await page.evaluate(() => {
  let lit = 0, others = 0;
  window.A.root.traverse(o => {
    if (!o.isMesh || !o.material || !o.material.uniforms || !o.material.uniforms.uOpacity) return;
    if (o.userData.organ === 'breasts') lit += o.material.uniforms.uOpacity.value;
    else if (o.userData.layer === 'female_reproductive' && o.visible) others += o.material.uniforms.uOpacity.value;
  });
  return { breasts_opacity_sum: +lit.toFixed(2), others_visible_opacity_sum: +others.toFixed(2) };
});
await page.screenshot({ path: `${SHOT}/pr89-focus-breasts.png` });

// male hides repro incl breasts
await page.evaluate(() => { window.A.focusRegions([]); window.A.setSex('male'); });
await new Promise(r => setTimeout(r, 400));
R.male_repro_visible = await page.evaluate(() => { let v = 0; window.A.root.traverse(o => { if (o.isMesh && o.userData && o.userData.layer === 'female_reproductive' && o.visible) v++; }); return v; });
await page.screenshot({ path: `${SHOT}/pr89-male.png` });

console.log(JSON.stringify(R, null, 2));
await browser.close();
