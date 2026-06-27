import puppeteer from 'puppeteer-core';

// PR #87 prod verification — component-level checks against the DEPLOYED account.html.
// Covers: (1) Human Atlas solid focus + per-region opacity to true 1.0, (2) sticky
// course Back/Next in the top strip, (3) nav/tool/course open-in-new-tab anchors,
// (4) full inline NeuroMap survey embed, (5) Sensation Map cursor cascade restore.
// All exercised via pure/DOM render fns + the shared engines, so no auth is needed.
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

await page.evaluate(async () => {
  localStorage.setItem('na_lang', 'en');
  if (typeof window.setLang === 'function') { const r = setLang('en'); if (r && r.then) await r; }
});
await new Promise(r => setTimeout(r, 800));

const out = await page.evaluate(async () => {
  const res = {};
  window.coursePlayer = window.coursePlayer || {};

  // ── 2: sticky Back/Next live in the (non-scrolling) top strip ──
  res.t2_nav_top = !!document.querySelector('#coursePlayerModal .cp-topstrip .cp-nav-top');
  res.t2_prev = !!document.querySelector('.cp-nav-top #cp-prev-btn');
  res.t2_next = !!document.querySelector('.cp-nav-top #cp-next-btn');

  // ── 3: open-in-new-tab anchors with meaningful hrefs ──
  const navA = Array.from(document.querySelectorAll('.dash-tabs a.dash-tab'));
  res.t3_nav_anchor_count = navA.length;
  res.t3_nav_hrefs_ok = navA.every(a => /#(overview|courses|evolution|domunity|tools|enroll|administration)$/.test(a.getAttribute('href') || ''));
  const toolA = Array.from(document.querySelectorAll('.tools-subtabs a.dash-tab'));
  res.t3_tool_anchor_count = toolA.length;
  res.t3_tool_hrefs_ok = toolA.every(a => /^\?tool=/.test(a.getAttribute('href') || ''));
  res.t3_deeplink_fns = typeof window.cpOpenCourse === 'function';

  // ── 4: inline NeuroMap is the FULL standalone survey, relocated into the block ──
  let area = document.getElementById('cp-block-area');
  if (!area) { area = document.createElement('div'); area.id = 'cp-block-area'; document.body.appendChild(area); }
  window.coursePlayer.blocks = [{ id: 1, block_type: 'tool_task', tool_kind: 'neuromap_emotion' }];
  window.coursePlayer.idx = 0;
  area.innerHTML = cpRenderNeuromap({ tool_kind: 'neuromap_emotion', payload: {} }, {}, 'en');
  res.t4_has_embed_host = !!area.querySelector('#cp-nm-embed');
  res.t4_no_old_chips = area.querySelectorAll('.cp-nm-chip').length === 0; // no bespoke picker
  cpMountNeuromap();
  for (let i = 0; i < 25 && !window.nmVocabulary; i++) await new Promise(r => setTimeout(r, 150));
  await new Promise(r => setTimeout(r, 500));
  const host = document.getElementById('cp-nm-embed');
  res.t4_survey_moved_in = !!(host && host.querySelector('#nm-step-content'));
  res.t4_live_graph = !!(host && host.querySelector('#nm-live-canvas'));
  res.t4_step0_emotions = !!(host && host.querySelector('#nm-step-content .nm-chip'));
  res.t4_first_emotion_en = host ? (function(){ const c = host.querySelector('#nm-step-content .nm-chip'); return c ? c.textContent.trim() : null; })() : null;
  res.t4_embed_flag = !!window.coursePlayer._nmEmbed;
  // teardown returns the panel to the modal
  cpDisposeNeuromap();
  const modal = document.getElementById('nmSurveyModal');
  res.t4_restored_to_modal = !!(modal && modal.querySelector('#nm-step-content'));
  res.t4_host_emptied = !!(host && !host.querySelector('#nm-step-content'));

  // ── 5: Sensation Map cursor cascade restored (hover → panel @cursor w/ whole+subs) ──
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;top:0;width:640px;height:420px;'; document.body.appendChild(d);
  const calls = [];
  window.mountBodyPicker(d, (slug, labels, picked) => calls.push({ slug, picked }), { lang: 'en' });
  const reg = d.querySelector('.bp-region[data-region="upper_back"]') || d.querySelector('.bp-region');
  const rb = reg.getBoundingClientRect();
  reg.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: rb.left + rb.width / 2, clientY: rb.top + rb.height / 2 }));
  await new Promise(r => setTimeout(r, 220));
  const panel = d.querySelector('.bp-panel.open');
  res.t5_hover_opens = !!panel;
  res.t5_has_whole = !!(panel && panel.querySelector('.bp-sub-whole'));
  res.t5_sub_count = panel ? panel.querySelectorAll('.bp-sub').length : 0;
  if (panel) {
    panel.querySelector('.bp-sub-whole').click();
    res.t5_whole_slug = (calls[calls.length - 1] || {}).slug; // expect bp_zone_*
    const subs = panel.querySelectorAll('.bp-sub');
    subs[2].click();
    res.t5_sub_slug = (calls[calls.length - 1] || {}).slug; // expect a sub slug
  }
  d.remove();

  return res;
});

// ── 1: 3D atlas — focused region is SOLID at 1.0 + per-region slider reaches 1.0 ──
const atlas = await page.evaluate(async () => {
  const r = {};
  try {
    if (!window.BodyAtlas) { r.engine = 'missing'; return r; }
    const vp = document.createElement('div'); vp.style.cssText = 'position:fixed;left:0;top:0;width:480px;height:480px;'; document.body.appendChild(vp);
    const a = await window.BodyAtlas.init(vp, { mode: 'full' });
    await new Promise(res => { let done = false; a.on('ready', () => { done = true; res(); }); setTimeout(res, 9000); });
    const T = window.THREE;
    a.toggleLayer('organs', true);
    a.setLayerOpacity('organs', 0.5);          // dimmed layer underneath
    // organs GLB streams in lazily — retry focus until it matches meshes
    // (mirrors cpHaApplyFocus's 350/900/2000ms re-apply), up to ~8s.
    for (let i = 0; i < 10; i++) {
      a.focusRegions(['stomach']);
      await new Promise(res => setTimeout(res, 800));
      if (a._focusBoosted && a._focusBoosted.length) break;
    }
    const boosted = a._focusBoosted || [];
    r.boosted_count = boosted.length;
    // every focused mesh must be dense: uOpacity 1.0 + solid + NormalBlending
    const m = boosted[0];
    if (m) {
      r.focus_uOpacity = m.material.uniforms.uOpacity ? m.material.uniforms.uOpacity.value : null;
      r.focus_uSolid = m.material.uniforms.uSolid ? m.material.uniforms.uSolid.value : null;
      r.focus_normalBlend = (m.material.blending === T.NormalBlending);
      r.focus_depthWrite = m.material.depthWrite;
      r.focus_all_solid = boosted.every(o => o.material && o.material.uniforms && o.material.uniforms.uOpacity && o.material.uniforms.uOpacity.value >= 0.999 && (!o.material.uniforms.uSolid || o.material.uniforms.uSolid.value === 1.0));
      // per-region slider: 1.0 → solid/opaque; 0.4 → translucent (on the same mesh)
      a.setRegionOpacity('stomach', 1.0);
      r.slider_1_uOpacity = m.material.uniforms.uOpacity.value;
      r.slider_1_solid = m.material.uniforms.uSolid ? m.material.uniforms.uSolid.value : null;
      a.setRegionOpacity('stomach', 0.4);
      r.slider_04_uOpacity = m.material.uniforms.uOpacity.value;
      r.slider_04_solid = m.material.uniforms.uSolid ? m.material.uniforms.uSolid.value : null;
    } else {
      r.boosted_mesh = 'none';
    }
    r.focus_ok = true;
    try { a.destroy(); } catch (e) {}
    vp.remove();
  } catch (e) { r.err = String((e && e.message) || e); }
  return r;
});

out.t1_atlas = atlas;
out.pageErrors = errs.slice(0, 10);
console.log(JSON.stringify(out, null, 2));
await browser.close();
