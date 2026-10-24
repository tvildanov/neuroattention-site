import puppeteer from 'puppeteer-core';

// PR #86 prod verification — component-level checks against the DEPLOYED account.html.
// The inline tool render fns + body picker + atlas focus helpers are pure/DOM and need
// no auth, so we exercise them directly in EN to confirm the deploy behaves correctly.
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-149.0.7827.22/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const URL = process.env.ACC_URL || 'https://neuroattention.org/account.html';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl',
    '--window-size=1400,1000'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });
const errs = [];
page.on('pageerror', (e) => errs.push(String((e && e.message) || e)));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction("typeof window.cpRenderNeuromap === 'function'", { timeout: 60000 });

// switch to EN
await page.evaluate(async () => {
  localStorage.setItem('na_lang', 'en');
  if (typeof window.setLang === 'function') { const r = setLang('en'); if (r && r.then) await r; }
});
await new Promise(r => setTimeout(r, 800));

const out = await page.evaluate(async () => {
  const res = {};
  // ensure a render host
  let area = document.getElementById('cp-block-area');
  if (!area) { area = document.createElement('div'); area.id = 'cp-block-area'; document.body.appendChild(area); }
  window.coursePlayer = window.coursePlayer || {};

  // 4A — block count localized
  res.blocks_en = cpBlocksLabel(100);

  // 4B — tool_task title falls back to localized label, not RU author title
  res.title_en = cpBlockDisplayTitle({ block_type: 'tool_task', tool_kind: 'neuromap_emotion', title_ru: 'Нейрокарта эмоций' }, 'en');

  // 1 — neuromap_emotion renders an inline mini-tool (chips, not a textarea stub)
  area.innerHTML = cpRenderToolTask({ tool_kind: 'neuromap_emotion', payload: {} }, {}, 'en');
  res.nm_has_chips = area.querySelectorAll('.cp-nm-chip').length > 0;
  res.nm_no_stub = area.querySelector('#cp-response') ? area.querySelectorAll('.cp-nm-chip').length > 5 : false;
  res.nm_emotion_label = area.textContent.indexOf('Choose an emotion') > -1;
  // vocab → English chip labels
  cpMountNeuromap();
  for (let i = 0; i < 25 && !window.nmVocabulary; i++) await new Promise(r => setTimeout(r, 150));
  await new Promise(r => setTimeout(r, 300));
  const firstChip = area.querySelector('.cp-nm-chip span');
  res.nm_chip_localized = firstChip ? firstChip.textContent : null;

  // 2A — sensation map: type before body + order hint
  const sm = cpRenderSensationMap({ tool_config: {}, payload: {} }, {}, 'en');
  res.sm_order_ok = sm.indexOf('cp-sm-sens') > -1 && sm.indexOf('cp-sm-sens') < sm.indexOf('cp-sm-picker');
  res.sm_order_hint = sm.indexOf('First choose a sensation type') > -1;

  // 2B/2C — body picker: single click → whole zone, no panel; dblclick → subs
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:420px;'; document.body.appendChild(d);
  const calls = [];
  window.mountBodyPicker(d, (slug, labels, picked) => calls.push({ slug, picked }), { lang: 'en' });
  const reg = d.querySelector('.bp-region[data-region="upper_back"]') || d.querySelector('.bp-region');
  reg.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 300, clientY: 200 }));
  await new Promise(r => setTimeout(r, 260));
  res.bp_click_zone = reg.classList.contains('picked') && !d.querySelector('.bp-panel.open') && calls.some(c => /^bp_zone_/.test(c.slug));
  reg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 310, clientY: 210 }));
  await new Promise(r => setTimeout(r, 40));
  const panel = d.querySelector('.bp-panel.open');
  res.bp_dbl_subs = !!panel && panel.querySelectorAll('.bp-sub').length > 0;
  d.remove();

  // 3 — human atlas condition focus: gastritis resolves to region ids incl. stomach,
  // and the engine routes stomach → organs layer.
  const base = window.AUTH_API || '';
  try {
    const row = await cpHaFetchEntity(base, 'condition', 'gastritis');
    res.cond_ids = row ? (row.affected_region_ids || []) : null;
    res.cond_has_stomach = !!(row && (row.affected_region_ids || []).indexOf('stomach') > -1);
    res.cond_name_en = row ? (row.name_en || row.name_ru) : null;
  } catch (e) { res.cond_err = String(e); }

  return res;
});

// 3b — actually init the 3D atlas and apply the gastritis focus, confirm no throw +
// the organs layer is among the needed layers for 'stomach'.
const atlas = await page.evaluate(async () => {
  const r = {};
  try {
    const vp = document.createElement('div'); vp.style.cssText = 'position:fixed;left:0;top:0;width:480px;height:480px;'; document.body.appendChild(vp);
    if (!window.BodyAtlas) { r.engine = 'missing'; return r; }
    const a = await window.BodyAtlas.init(vp, { mode: 'full' });
    await new Promise(res => { let done = false; a.on('ready', () => { done = true; res(); }); setTimeout(res, 8000); });
    r.layers_for_stomach = a.layersForSeedIds ? a.layersForSeedIds(['stomach', 'medulla']) : null;
    a.toggleLayer('organs', true);
    a.focusRegions(['stomach', 'medulla']);
    await new Promise(res => setTimeout(res, 1500));
    r.focus_ok = true;
    try { a.destroy(); } catch (e) {}
    vp.remove();
  } catch (e) { r.err = String((e && e.message) || e); }
  return r;
});

out.atlas = atlas;
out.pageErrors = errs.slice(0, 10);
console.log(JSON.stringify(out, null, 2));
await browser.close();
