// PR #104 — verify the four NeuroMap fixes on LIVE prod:
//   #1 default period is «Всё» (all), so historical sensations show (not just today).
//   #2 the overloaded 'area' type is split: Sensation-Map body locations → layer 1
//      ("Ощущения"), emotion-walkthrough life spheres → layer 3 ("Образы"). The
//      layer-3 toggle is back in the filter bar.
//   #3 sticky sensation↔body-part bonds render as GLUED bubbles (anchored edge short,
//      and the link is flagged _sticky so the renderer skips its arrow line).
//   #4 mobile «Заполнить эмоцию» (openNmSurvey) shows the live mini-graph inset
//      instead of display:none.
//
// Strategy: register a throwaway user, seed BOTH a Sensation-Map entry (body area +
// felt words) and an emotion-walkthrough chain carrying a life-sphere area, then read
// the live graph + the settled force layout from the browser.
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

(async () => {
  const u = await reg('p104');
  const me = await J(await fetch(AUTH+'/api/auth/me',{headers:H(u.token)}));
  const meUser = me.user||me;

  // Seed 1: Sensation Map → body-location area(s) + felt sensation words (area_kind=body).
  const sens = await slugs('sensation', 3);
  const loc  = await slugs('body_location', 2);
  await fetch(AUTH+'/api/neuromap/sensation',{method:'POST',headers:H(u.token),
    body:JSON.stringify({ body_locations:[loc[0]], sensations:sens, intensity:7 })});
  await fetch(AUTH+'/api/neuromap/sensation',{method:'POST',headers:H(u.token),
    body:JSON.stringify({ body_locations:[loc[1]], sensations:[sens[0]], intensity:5 })});

  // Seed 2: emotion walkthrough → a life-sphere area (area_kind=sphere) on a chain.
  await fetch(AUTH+'/api/neuromap/v2/append',{method:'POST',headers:H(u.token),
    body:JSON.stringify({ chain:[
      { type:'emotion', label:'тревога', valence:'negative', metadata:{} },
      { type:'area',    label:'работа',  valence:'neutral',  metadata:{ area_kind:'sphere' } },
      { type:'cause',   label:'дедлайн', valence:'negative', metadata:{} }
    ]})});

  const graph = await J(await fetch(AUTH+'/api/neuromap/v2/graph',{headers:H(u.token)}));
  const gNodes = graph.nodes||[];
  const areaBody   = gNodes.filter(n=>n.type==='area' && (n.metadata?.area_kind==='body'   || n.metadata?.source==='sensation'));
  const areaSphere = gNodes.filter(n=>n.type==='area' && n.metadata?.area_kind==='sphere');
  const seedOk = gNodes.some(n=>n.type==='sensation') && areaBody.length>0 && areaSphere.length>0;

  const browser = await puppeteer.launch({ executablePath: CHROME, headless:true,
    args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width:1280, height:900 });
  await page.evaluateOnNewDocument((t,user)=>{ localStorage.setItem('na_token',t); localStorage.setItem('na_user',JSON.stringify(user)); window.currentUser=user; }, u.token, meUser);
  await page.goto(SITE,{waitUntil:'networkidle2',timeout:60000});
  await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});
  await page.evaluate(()=>{ try{ window.switchTab('tools'); }catch(e){} });
  await sleep(700);
  await page.evaluate(()=>{ try{ if(window.setToolsMode) window.setToolsMode('nm'); }catch(e){} });
  await sleep(6500); // graph load + force sim settle

  // #1: default view is 'all' (button active + nmCurrentView).
  const viewState = await page.evaluate(()=>({
    current: window.nmCurrentView,
    activeBtn: (document.querySelector('.nm-view-btn.active')||{}).textContent||''
  }));
  const defaultAll = viewState.current === 'all';

  // #2: layer-3 toggle present in the main filter bar.
  const hasLayer3 = await page.evaluate(()=> !!document.querySelector('#nm-filters input[data-layer="3"]'));

  // #2: body-area nodes resolve to _layer 1, sphere-area nodes to _layer 3.
  const layerSplit = await page.evaluate(()=>{
    const N = window.nmNodes||[];
    const areas = N.filter(n=>n.type==='area');
    const body = areas.filter(n=> (n.metadata&&n.metadata.area_kind==='body') || (n.metadata&&n.metadata.source==='sensation'));
    const sphere = areas.filter(n=> n.metadata&&n.metadata.area_kind==='sphere');
    return {
      bodyAll1: body.length>0 && body.every(n=>n._layer===1),
      sphereAll3: sphere.length>0 && sphere.every(n=>n._layer===3),
      bodyN: body.length, sphereN: sphere.length,
      sphereLabels: sphere.map(n=>n.label)
    };
  });

  // #3: anchored sensation↔body edges short AND flagged _sticky (renderer skips arrow).
  const stick = await page.evaluate(()=>{
    const N = window.nmNodes||[], L = window.nmLinks||[];
    const by={}; N.forEach(n=>by[n.id]=n);
    const R = (typeof nmNodeR==='function') ? nmNodeR : (n)=> (n._r||12);
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    let sum=0,cnt=0; for(let i=0;i<N.length;i++)for(let j=i+1;j<N.length;j++){sum+=dist(N[i],N[j]);cnt++;}
    const meanPair=cnt?sum/cnt:0;
    const anchored=[];
    L.forEach(l=>{
      const s=by[l.source],t=by[l.target]; if(!s||!t) return;
      if((s.type==='sensation')===(t.type==='sensation')) return;
      const sensN=s.type==='sensation'?s:t, area=s.type==='sensation'?t:s;
      if(sensN._anchorId!==area.id) return;
      anchored.push({ edge:dist(s,t), glue:R(sensN)+R(area)+12, sticky:!!l._sticky });
    });
    const sensNodes=N.filter(n=>n.type==='sensation');
    return { meanPair, anchored, allAnchored: sensNodes.length>0 && sensNodes.every(n=>!!n._anchorId) };
  });
  const stuck = stick.anchored.filter(s=> s.edge < Math.max(s.glue*2.5,130) && s.edge < stick.meanPair);
  const allSticky = stick.anchored.length>0 && stick.anchored.every(s=>s.sticky);
  const stickyOk = stick.anchored.length>0 && stuck.length===stick.anchored.length && allSticky;

  const cv = await page.$('#nm-canvas'); if(cv) await cv.screenshot({ path:'scripts/pr104-canvas.png' });
  const filt = await page.$('#nm-filters'); if(filt) await filt.screenshot({ path:'scripts/pr104-filters.png' });

  // #4: mobile — live-graph inset visible (not display:none) when «Заполнить эмоцию» opens.
  await page.setViewport({ width:360, height:780, isMobile:true, hasTouch:true });
  await sleep(400);
  await page.evaluate(()=>{ try{ window.openNmSurvey(); }catch(e){} });
  await sleep(900);
  const mobileInset = await page.evaluate(()=>{
    const w=document.getElementById('nm-live-graph-wrap');
    if(!w) return { found:false };
    const cs=getComputedStyle(w), r=w.getBoundingClientRect();
    const tg=document.getElementById('nm-live-mini-toggle');
    const tcs=tg?getComputedStyle(tg):null;
    return { found:true, display:cs.display, w:Math.round(r.width), h:Math.round(r.height),
             pos:cs.position, toggleShown: !!(tcs && tcs.display!=='none') };
  });
  const insetOk = mobileInset.found && mobileInset.display!=='none' && mobileInset.w>0 && mobileInset.h>0 && mobileInset.toggleShown;
  await page.screenshot({ path:'scripts/pr104-mobile.png' });

  await browser.close();

  const checks = [
    ['seed: body-area + sphere-area + sensation nodes',  seedOk],
    ['graph: body areas tagged area_kind=body',           areaBody.length>0],
    ['graph: sphere area tagged area_kind=sphere',        areaSphere.length>0],
    ['#1 default period is «Всё» (all)',                  defaultAll],
    ['#2 layer-3 «Образы» toggle present',                hasLayer3],
    ['#2 body-area nodes resolve to layer 1',             layerSplit.bodyAll1],
    ['#2 sphere-area nodes resolve to layer 3',           layerSplit.sphereAll3],
    ['#3 anchored sensation edges are short (glued)',     stickyOk],
    ['#3 anchored edges flagged _sticky (no arrow)',      allSticky],
    ['#3 every sensation resolved an anchor',             stick.allAnchored],
    ['#4 mobile live-graph inset visible (not none)',     insetOk],
  ];
  console.log('\n── PR#104 NeuroMap verification ──');
  console.log('graph nodes=%d  body-areas=%d  sphere-areas=%d',
    gNodes.length, areaBody.length, areaSphere.length);
  console.log('view: current=%s activeBtn=%s', viewState.current, viewState.activeBtn);
  console.log('layer split: body→1=%s (%d)  sphere→3=%s (%d)  sphereLabels=%j',
    layerSplit.bodyAll1, layerSplit.bodyN, layerSplit.sphereAll3, layerSplit.sphereN, layerSplit.sphereLabels);
  console.log('sticky: anchored=%d stuck=%d allSticky=%s meanPair=%s',
    stick.anchored.length, stuck.length, allSticky, stick.meanPair.toFixed(1));
  console.log('mobile inset:', JSON.stringify(mobileInset));
  console.log('');
  let pass=true;
  for(const [name,ok] of checks){ console.log((ok?'  ✓ ':'  ✗ ')+name); if(!ok) pass=false; }
  console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
  console.log('screenshots: scripts/pr104-canvas.png, scripts/pr104-filters.png, scripts/pr104-mobile.png');
  process.exit(pass?0:1);
})().catch(e=>{ console.error('HARNESS ERROR:', e); process.exit(2); });
