import puppeteer from 'puppeteer-core';

// Phase 0 prod verification — female anatomy layers on the DEPLOYED test-atlas.html
// (no auth gate; exposes window.A). Checks: female layers stream + tag correctly,
// world placement is anatomically sane, setSex filters, focusRegions works, male model
// intact, 0 page errors. Screenshots: female / male / both / uterus-focus.
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const URL = process.env.ATLAS_URL || 'https://neuroattention.org/test-atlas.html';
const SHOT = '/tmp';

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

// helper: toggle a layer and wait until it reports loaded
async function loadLayer(layer) {
  await page.evaluate((L) => new Promise((res) => {
    const done = (d) => { if (d && d.layer === L) { window.A.off && window.A.off('layer-loaded', done); res(); } };
    window.A.on('layer-loaded', done);
    window.A.toggleLayer(L, true);
    setTimeout(res, 20000); // safety
  }), layer);
  await new Promise(r => setTimeout(r, 600));
}

// introspect the scene graph for a layer's tagged meshes + world bbox per organ
async function organStats(layer) {
  return page.evaluate((L) => {
    const T = window.THREE; const out = {};
    window.A.root.traverse((o) => {
      if (!o.isMesh || !o.userData || o.userData.layer !== L) return;
      const org = o.userData.organ || '(none)';
      const g = out[org] || (out[org] = { meshes: 0, visible: 0, sex: o.userData.sex || null, box: new T.Box3() });
      g.meshes++; if (o.visible) g.visible++;
      o.updateWorldMatrix(true, false);
      g.box.expandByObject(o);
    });
    const r = {};
    for (const [k, g] of Object.entries(out)) {
      const c = new T.Vector3(); g.box.getCenter(c);
      r[k] = { meshes: g.meshes, visible: g.visible, sex: g.sex, ctr: [+c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3)] };
    }
    return r;
  }, layer);
}

const R = { errors: errs };

// ── male model intact (regression guard) ──
await loadLayer('skeleton');
R.skeleton = await page.evaluate(() => {
  let n = 0; window.A.root.traverse(o => { if (o.isMesh && o.userData && o.userData.layer === 'skeleton') n++; });
  return n;
});

// ── female reproductive ──
await loadLayer('female_reproductive');
await loadLayer('breasts');
await page.evaluate(() => window.A.setSex('female'));
await new Promise(r => setTimeout(r, 400));
R.repro = await organStats('female_reproductive');
R.breasts = await organStats('breasts');
await page.screenshot({ path: `${SHOT}/female-anatomy-female.png` });

// ── focus uterus ──
await page.evaluate(() => window.A.focusRegions(['uterus']));
await new Promise(r => setTimeout(r, 500));
R.uterus_focus = await page.evaluate(() => {
  let lit = 0, dim = 0;
  window.A.root.traverse(o => {
    if (!o.isMesh || !o.material || !o.material.uniforms || !o.material.uniforms.uOpacity) return;
    if (o.userData.organ === 'uterus') lit += o.material.uniforms.uOpacity.value;
    else if (o.userData.layer === 'female_reproductive') dim += o.material.uniforms.uOpacity.value;
  });
  return { uterus_opacity_sum: +lit.toFixed(2), others_opacity_sum: +dim.toFixed(2) };
});
await page.screenshot({ path: `${SHOT}/female-anatomy-uterus-focus.png` });

// ── setSex transitions ──
await page.evaluate(() => { window.A.focusRegions([]); window.A.setSex('male'); });
await new Promise(r => setTimeout(r, 400));
R.male_mode_repro_visible = await page.evaluate(() => {
  let v = 0; window.A.root.traverse(o => { if (o.isMesh && o.userData && o.userData.layer === 'female_reproductive' && o.visible) v++; });
  return v; // expect 0
});
await page.screenshot({ path: `${SHOT}/female-anatomy-male.png` });

await page.evaluate(() => window.A.setSex('both'));
await new Promise(r => setTimeout(r, 400));
R.both_mode_repro_visible = await page.evaluate(() => {
  let v = 0; window.A.root.traverse(o => { if (o.isMesh && o.userData && o.userData.layer === 'female_reproductive' && o.visible) v++; });
  return v; // expect >0
});
await page.screenshot({ path: `${SHOT}/female-anatomy-both.png` });

console.log(JSON.stringify(R, null, 2));
await browser.close();
