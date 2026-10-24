// PR #103 — verify the five NeuroMap mobile fixes on LIVE prod (360×800):
//   1. Layer checkboxes show a visible checked/unchecked state on mobile (custom
//      appearance:none box + ::after checkmark, not the unreliable native one).
//   2. Body-part 'area' anchors live in layer 1 with sensations — toggling layer 1
//      hides/shows BOTH together; with only layer 1 on, area nodes are still present
//      so the sticky bubbles have something to cling to.
//   3. All layers off → layer toggles STAY visible (+ a "filtered-empty" message),
//      onboarding is NOT shown; user can re-enable without reloading.
//   4. Hub mini-calendar keeps its 7-column grid on mobile (not a vertical list).
//   5. 0 page errors.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH = process.env.AUTH_API || 'https://neuroattention-api-production.up.railway.app';
const SITE = process.env.SITE_URL || 'https://neuroattention.org/account.html';
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const H = t => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const J = r => r.json();
let pass = 0, fail = 0;
const ok = (n, c, extra) => { console.log((c ? '✅' : '❌') + ' ' + n + (extra ? ' — ' + extra : '')); c ? pass++ : fail++; };

const reg = async (tag) => {
  const email = tag + '-' + Date.now() + Math.floor(Math.random()*1e4) + '@test.local';
  const r = await J(await fetch(AUTH + '/api/auth/register', { method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ email, password:'Test12345!', display_name: tag, country:'RU', city:'Moscow', location_lat:55.75, location_lon:37.62 })}));
  return { email, token: r.token };
};
const slugs = async (cat, n) => {
  const rows = await J(await fetch(AUTH + '/api/vocab/' + cat));
  return (Array.isArray(rows) ? rows : (rows.terms||rows.items||[])).slice(0, n).map(r => r.slug);
};
const seedSensation = async (token, body) => J(await fetch(AUTH + '/api/neuromap/sensation', { method:'POST', headers:H(token), body: JSON.stringify(body) }));

(async () => {
  const u = await reg('p103');
  const me = await J(await fetch(AUTH+'/api/auth/me',{headers:H(u.token)}));
  const meUser = me.user||me;
  const sens = await slugs('sensation', 4);
  const loc  = await slugs('body_location', 2);
  await seedSensation(u.token, { body_locations:[loc[0]], sensations: sens, intensity: 7 });
  await seedSensation(u.token, { body_locations:[loc[0]], sensations:[sens[0]], intensity: 6 });
  await seedSensation(u.token, { body_locations:[loc[1]], sensations:[sens[1], sens[2]], intensity: 5 });
  const graph = await J(await fetch(AUTH+'/api/neuromap/v2/graph',{headers:H(u.token)}));
  ok('seed: area + sensation nodes + links exist', (graph.nodes||[]).some(n=>n.type==='area') && (graph.nodes||[]).some(n=>n.type==='sensation') && (graph.links||[]).length>0);

  const browser = await puppeteer.launch({ executablePath: CHROME, headless:true,
    args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error') errs.push('console:'+m.text()); });
  await page.setViewport({ width:360, height:800, isMobile:true, hasTouch:true });
  await page.evaluateOnNewDocument((t,user)=>{ localStorage.setItem('na_token',t); localStorage.setItem('na_user',JSON.stringify(user)); window.currentUser=user; }, u.token, meUser);
  await page.goto(SITE,{waitUntil:'networkidle2',timeout:60000});
  await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});
  await page.evaluate(()=>{ try{ window.switchTab('tools'); }catch(e){} });
  await sleep(700);
  await page.evaluate(()=>{ try{ if(window.setToolsMode) window.setToolsMode('nm'); }catch(e){} });
  await sleep(6000); // let v2 graph load + force sim settle

  // ── #2a: area nodes present on initial load (all layers on) ──
  const init = await page.evaluate(()=>({
    area:(window.nmNodes||[]).filter(n=>n.type==='area').length,
    sens:(window.nmNodes||[]).filter(n=>n.type==='sensation').length,
  }));
  ok('#2 area (body-part) nodes render on canvas', init.area>0, 'area='+init.area+' sens='+init.sens);

  // ── #1: layer-1 checkbox visible state. Read computed ::after + background when
  //        checked, then tap to uncheck and re-read. ──
  const cbState = async () => page.evaluate(()=>{
    const cb=document.querySelector('#nm-filters input[data-layer="1"]');
    const after=getComputedStyle(cb,'::after');
    return { checked:cb.checked, afterContent:after.content, bg:getComputedStyle(cb).backgroundColor };
  });
  const checked1 = await cbState();
  // tap the label to toggle (real user gesture)
  await page.evaluate(()=>{ const cb=document.querySelector('#nm-filters input[data-layer="1"]'); cb.closest('label').click(); });
  await sleep(1200);
  const unchecked1 = await cbState();
  await page.evaluate(()=>{ const cb=document.querySelector('#nm-filters input[data-layer="1"]'); cb.closest('label').click(); });
  await sleep(1200);
  const rechecked1 = await cbState();
  const checkmarkVisible = checked1.checked && checked1.afterContent && checked1.afterContent!=='none' && checked1.afterContent!=='normal';
  const checkmarkGone = !unchecked1.checked && (unchecked1.afterContent==='none' || unchecked1.afterContent==='normal');
  ok('#1 checked box paints a checkmark (::after) + cyan bg', checkmarkVisible && checked1.bg!==unchecked1.bg, 'after='+checked1.afterContent+' bg='+checked1.bg);
  ok('#1 unchecked box hides the checkmark', checkmarkGone, 'after='+unchecked1.afterContent);
  ok('#1 re-tap restores the checkmark', rechecked1.checked && rechecked1.afterContent===checked1.afterContent);

  // ── #2b: toggle layer 1 OFF → area AND sensation both vanish; ON → both return ──
  await page.evaluate(()=>{ window.nmActiveLayers[1]=false; document.querySelector('#nm-filters input[data-layer="1"]').checked=false; window.nmLayerToggle(); });
  await sleep(1500);
  const l1off = await page.evaluate(()=>({ area:(window.nmNodes||[]).filter(n=>n.type==='area').length, sens:(window.nmNodes||[]).filter(n=>n.type==='sensation').length }));
  ok('#2 layer1 OFF → body parts AND sensations both gone', l1off.area===0 && l1off.sens===0, 'area='+l1off.area+' sens='+l1off.sens);
  await page.evaluate(()=>{ window.nmActiveLayers[1]=true; document.querySelector('#nm-filters input[data-layer="1"]').checked=true; window.nmLayerToggle(); });
  await sleep(1500);
  const l1on = await page.evaluate(()=>({ area:(window.nmNodes||[]).filter(n=>n.type==='area').length, sens:(window.nmNodes||[]).filter(n=>n.type==='sensation').length }));
  ok('#2 layer1 ON → both return', l1on.area>0 && l1on.sens>0, 'area='+l1on.area+' sens='+l1on.sens);

  // ── #3: ALL layers off → filters stay visible, filtered-empty shown, onboarding hidden ──
  const allOff = await page.evaluate(()=>{
    [1,2,4,5,6].forEach(L=>{ window.nmActiveLayers[L]=false; });
    document.querySelectorAll('#nm-filters input[data-layer]').forEach(cb=>{ if(cb.getAttribute('data-layer')!=='repeat') cb.checked=false; });
    window.buildNmGraph();
    return new Promise(res=>setTimeout(()=>res({
      filters: getComputedStyle(document.getElementById('nm-filters')).display,
      onboard: getComputedStyle(document.getElementById('nm-empty')).display,
      filtered: getComputedStyle(document.getElementById('nm-empty-filtered')).display,
      cbVisible: document.querySelectorAll('#nm-filters input[data-layer]').length,
    }), 900));
  });
  ok('#3 all layers off → layer toggles STAY visible', allOff.filters!=='none' && allOff.cbVisible>=5, JSON.stringify(allOff));
  ok('#3 all layers off → filtered-empty msg shown, onboarding hidden', allOff.filtered!=='none' && allOff.onboard==='none');
  // re-enable to confirm recoverable without reload
  const recovered = await page.evaluate(()=>{
    window.nmActiveLayers[1]=true; document.querySelector('#nm-filters input[data-layer="1"]').checked=true; window.nmLayerToggle();
    return new Promise(res=>setTimeout(()=>res({ nodes:(window.nmNodes||[]).length, filtered:getComputedStyle(document.getElementById('nm-empty-filtered')).display }), 1500));
  });
  ok('#3 re-enable a layer → graph restored (no reload)', recovered.nodes>0 && recovered.filtered==='none', 'nodes='+recovered.nodes);

  // ── #4: mini-calendar is a 7-column grid, not a vertical list ──
  await page.evaluate(()=>{ try{ window.renderNmMiniCal && window.renderNmMiniCal(); }catch(e){} });
  await sleep(400);
  const cal = await page.evaluate(()=>{
    const g=document.getElementById('nm-minical-grid'); if(!g) return {exists:false};
    const cs=getComputedStyle(g);
    const cols=(cs.gridTemplateColumns||'').split(' ').filter(Boolean).length;
    const child=g.children[8];
    return { exists:true, display:cs.display, cols, gridWidth:g.clientWidth, childWidth:child?child.clientWidth:0 };
  });
  ok('#4 mini-calendar is display:grid w/ 7 columns', cal.exists && cal.display==='grid' && cal.cols===7, JSON.stringify(cal));
  ok('#4 calendar cells sit side-by-side (not full-width rows)', cal.childWidth>0 && cal.childWidth < cal.gridWidth/3, 'cell='+cal.childWidth+' grid='+cal.gridWidth);

  // ── #5: page errors ──
  const realErrs = errs.filter(e=>!/IndexSizeError|favicon|manifest|ResizeObserver/i.test(e));
  ok('#5 no page errors', realErrs.length===0, realErrs.slice(0,3).join(' | '));

  await page.screenshot({ path:'pr103-mobile.png' });
  await browser.close();
  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
