import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const URL = 'https://neuroattention.org/test-atlas.html';

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

const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

// wait for the atlas instance + ready
await page.waitForFunction('window.A && window.A.root', { timeout: 60000 });

// drive layer loading + brain-detail load entirely in-page, resolve when settled
const result = await page.evaluate(async () => {
  const A = window.A;
  // only these have real GLB sources in anatomy-models.json
  const LAYERS = ['muscles', 'skeleton', 'nervous', 'vessels', 'organs'];
  const layerRegions = {};
  A.on('layer-loaded', (e) => { layerRegions[e.layer] = e.regions || 0; });

  // turn every GLB layer on and AWAIT each layer's load promise (A._real[name])
  LAYERS.forEach((l) => A.toggleLayer(l, true));
  const layerResults = {};
  await Promise.all(LAYERS.map(async (l) => {
    try {
      const g = (A._real && A._real[l]) ? await A._real[l] : null;
      layerResults[l] = g ? 'loaded' : 'no-source';
    } catch (e) { layerResults[l] = 'error:' + (e && e.message || e); }
  }));

  // load the brain-detail GLB explicitly (adds to root regardless of mode) and await
  let brainState = 'pending', brainRegions = 0;
  A.on('brain-loaded', (e) => { brainRegions = e.regions || 0; });
  try {
    const g = A._loadBrainDetail ? await A._loadBrainDetail() : null;
    brainState = g ? 'loaded' : 'no-source';
    if (A._brainRealMeshes) brainRegions = A._brainRealMeshes.length;
  } catch (e) { brainState = 'error:' + (e && e.message || e); }

  // settle a beat for any late traversal-able meshes
  await new Promise((r) => setTimeout(r, 800));
  const layerEvents = layerResults;

  // traverse root, collect identity fields for every mesh
  const meshes = [];
  A.root.traverse((o) => {
    if (!o.isMesh || !o.userData) return;
    const u = o.userData;
    // only meshes carrying any anatomical identity
    if (!u.regionId && !u.baseSlug && !u.slug && !u.coarseId) return;
    meshes.push({
      regionId: u.regionId ?? null,
      baseSlug: u.baseSlug ?? null,
      coarseId: u.coarseId ?? null,
      slug: u.slug ?? null,
      group: u.group ?? null,
      layer: u.layer ?? null,
      brain: !!u.brain,
      name: o.name || null,
    });
  });

  const REGIONS = (window.BodyAtlas && window.BodyAtlas.REGIONS) || null;

  return {
    layerEvents, layerRegions, brainState, brainRegions,
    meshCount: meshes.length, meshes,
    REGIONS,
  };
});

result.consoleErrors = consoleErrors;
result.pageErrors = pageErrors;

writeFileSync('/tmp/mesh_inventory.json', JSON.stringify(result, null, 2));

// summary to stdout
console.log('layer load results:', JSON.stringify(result.layerEvents));
console.log('layer region counts:', JSON.stringify(result.layerRegions));
console.log('brain-detail:', result.brainState, '(' + result.brainRegions + ' regions)');
console.log('total meshes with identity:', result.meshCount);
const byLayer = {};
result.meshes.forEach((m) => { byLayer[m.layer || '?'] = (byLayer[m.layer || '?'] || 0) + 1; });
console.log('meshes by layer:', JSON.stringify(byLayer));
console.log('console errors:', result.consoleErrors.length, '| page errors:', result.pageErrors.length);
if (result.consoleErrors.length) console.log('  first console error:', result.consoleErrors[0]);
if (result.pageErrors.length) console.log('  first page error:', result.pageErrors[0]);

await browser.close();
