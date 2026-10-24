// PR #103 mobile diagnostic — inspect calendar grid + layer checkbox + area nodes
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH = process.env.AUTH_API || 'https://neuroattention-api-production.up.railway.app';
const SITE = process.env.SITE_URL || 'https://neuroattention.org/account.html';
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const H = t => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const J = r => r.json();
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
  const u = await reg('p103d');
  const me = await J(await fetch(AUTH+'/api/auth/me',{headers:H(u.token)}));
  const meUser = me.user||me;
  const sens = await slugs('sensation', 4);
  const loc  = await slugs('body_location', 2);
  await seedSensation(u.token, { body_locations:[loc[0]], sensations: sens, intensity: 7 });
  await seedSensation(u.token, { body_locations:[loc[1]], sensations:[sens[1]], intensity: 5 });

  const browser = await puppeteer.launch({ executablePath: CHROME, headless:true,
    args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width:360, height:800, isMobile:true, hasTouch:true });
  await page.evaluateOnNewDocument((t,user)=>{ localStorage.setItem('na_token',t); localStorage.setItem('na_user',JSON.stringify(user)); window.currentUser=user; }, u.token, meUser);
  await page.goto(SITE,{waitUntil:'networkidle2',timeout:60000});
  await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});
  await page.evaluate(()=>{ try{ window.switchTab('tools'); }catch(e){} });
  await sleep(700);
  await page.evaluate(()=>{ try{ if(window.setToolsMode) window.setToolsMode('nm'); }catch(e){} });
  await sleep(6000);
  await page.evaluate(()=>{ try{ window.renderNmMiniCal && window.renderNmMiniCal(); }catch(e){} });
  await sleep(500);

  const diag = await page.evaluate(()=>{
    const g = document.getElementById('nm-minical-grid');
    const gs = g ? getComputedStyle(g) : null;
    const child = g && g.children[8];
    const cs = child ? getComputedStyle(child) : null;
    // checkbox
    const cb = document.querySelector('#nm-filters input[data-layer="1"]');
    const cbs = cb ? getComputedStyle(cb) : null;
    // area nodes present?
    const areaNodes = (window.nmNodes||[]).filter(n=>n.type==='area').map(n=>n.label);
    const sensNodes = (window.nmNodes||[]).filter(n=>n.type==='sensation').map(n=>n.label);
    return {
      gridExists: !!g,
      gridDisplay: gs && gs.display,
      gridCols: gs && gs.gridTemplateColumns,
      gridWidth: g && g.clientWidth,
      gridChildren: g && g.children.length,
      childWidth: child && child.clientWidth,
      childDisplay: cs && cs.display,
      cbExists: !!cb, cbChecked: cb && cb.checked,
      cbAppearance: cbs && (cbs.appearance||cbs.webkitAppearance),
      cbWidth: cb && cb.offsetWidth, cbAccent: cbs && cbs.accentColor,
      filtersDisplay: (document.getElementById('nm-filters')||{}).style ? document.getElementById('nm-filters').style.display : 'n/a',
      areaNodes, sensNodes,
      activeLayers: window.nmActiveLayers,
    };
  });
  console.log(JSON.stringify(diag,null,2));

  // now turn OFF all layers except check area behaviour: turn off layer 3 only, see if area disappears
  const afterL1only = await page.evaluate(()=>{
    // turn off layers 2,3,4,5,6 leaving only 1
    [2,3,4,5,6].forEach(L=>{ window.nmActiveLayers[L]=false; });
    document.querySelectorAll('#nm-filters input[data-layer]').forEach(cb=>{ const L=cb.getAttribute('data-layer'); if(L!=='repeat'&&L!=='1') cb.checked=false; });
    window.buildNmGraph && window.buildNmGraph();
    return new Promise(res=>setTimeout(()=>{
      res({ areaNodes:(window.nmNodes||[]).filter(n=>n.type==='area').map(n=>n.label),
            sensNodes:(window.nmNodes||[]).filter(n=>n.type==='sensation').map(n=>n.label),
            filtersDisplay: document.getElementById('nm-filters').style.display,
            emptyDisplay: document.getElementById('nm-empty').style.display });
    }, 1500));
  });
  console.log('--- layer1-only ---'); console.log(JSON.stringify(afterL1only,null,2));

  // turn ALL off
  const allOff = await page.evaluate(()=>{
    [1,2,3,4,5,6].forEach(L=>{ window.nmActiveLayers[L]=false; });
    document.querySelectorAll('#nm-filters input[data-layer]').forEach(cb=>{ if(cb.getAttribute('data-layer')!=='repeat') cb.checked=false; });
    window.buildNmGraph && window.buildNmGraph();
    return new Promise(res=>setTimeout(()=>{
      res({ filtersDisplay: document.getElementById('nm-filters').style.display,
            emptyDisplay: document.getElementById('nm-empty').style.display });
    }, 800));
  });
  console.log('--- all-off ---'); console.log(JSON.stringify(allOff,null,2));

  await browser.close();
})().catch(e=>{ console.error(e); process.exit(1); });
