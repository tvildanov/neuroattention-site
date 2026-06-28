// PR#98 — Phase 3.6: standalone Sensation Map & Diary sub-tabs removed; both now
// live inside the NeuroMap hub. Verifies, on a fresh prod user:
//  • Tools sub-tab bar shows EXACTLY 4 tabs (NeuroMap · A→B · External Field ·
//    Anatomy) — no «Карта ощущений», no «Дневник»
//  • Legacy ?tool=sensation deep-link → redirects to NeuroMap + pops the sensation
//    overlay (setToolsMode redirect)
//  • Legacy ?tool=diary deep-link → redirects to NeuroMap + pops the diary overlay
//  • NeuroMap hub panel + its 3 action buttons are present & wired
//    (openNmSurvey / nmOpenSensationOverlay / nmOpenDiaryOverlay)
//  • Course-player inline tools (PR#85/86) still render: cpRenderSensationMap /
//    cpRenderDiary intact + TOOL_TASK_META rows present
//  • 0 broken i18n keys: a.tools.sensation removed from all 3 dicts, no DOM element
//    still references it; switching lang leaves no empty tools tab labels
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const ORIGIN='https://neuroattention.org';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=[]; const ok=(n,c,x)=>{out.push({n,c:!!c,x:x||''});console.log((c?'PASS':'FAIL')+' · '+n+(x?' · '+x:''));};

async function reg(){const email='p98-'+Date.now()+Math.floor(Math.random()*1e4)+'@test.local';
  const r=await(await fetch(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'Test12345!',display_name:'p98',country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})})).json();return r.token;}

// ── 0) i18n dicts: a.tools.sensation removed everywhere, a.tools.diary kept ──
for (const lang of ['ru','en','es']){
  const d=await(await fetch(ORIGIN+'/data/i18n/'+lang+'.json?v='+Date.now())).json();
  ok('i18n['+lang+']: a.tools.sensation removed', !('a.tools.sensation' in d), Object.keys(d).filter(k=>k==='a.tools.sensation').join(','));
  ok('i18n['+lang+']: a.tools.diary kept (still used by program card)', 'a.tools.diary' in d);
}

const token=await reg();
const me=await(await fetch(AUTH+'/api/auth/me',{headers:{authorization:'Bearer '+token}})).json();const meUser=me.user||me;
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});

async function freshPage(query){
  const page=await browser.newPage();
  await page.setViewport({width:1280,height:900});
  await page.evaluateOnNewDocument((t,u)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(u));window.currentUser=u;},token,meUser);
  await page.goto(SITE+(query||('?v='+Date.now())),{waitUntil:'networkidle2',timeout:60000});
  await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});
  return page;
}

// ── 1) Tools sub-tab bar: exactly 4 tabs, no sensation/diary ──
{
  const page=await freshPage();
  await page.evaluate(()=>window.switchTab('tools'));
  await sleep(400);
  const tabs=await page.evaluate(()=>Array.prototype.map.call(
    document.querySelectorAll('.tools-subtabs .dash-subtab'),
    a=>({id:a.id,txt:a.textContent.trim()})));
  const ids=tabs.map(t=>t.id);
  const expected=['tools-mode-nm','tools-mode-pointab','tools-mode-external','tools-mode-anatomy'];
  ok('Tools bar = exactly 4 tabs', tabs.length===4, JSON.stringify(tabs.map(t=>t.txt)));
  ok('Tools bar ids match (nm/pointab/external/anatomy)', expected.every(e=>ids.includes(e)) && ids.length===4, ids.join(','));
  ok('No standalone Sensation tab', !ids.includes('tools-mode-sensation'));
  ok('No standalone Diary tab', !ids.includes('tools-mode-diary'));
  // no leftover broken label (empty text) on any tab
  ok('No empty/broken tab label', tabs.every(t=>t.txt.length>0), JSON.stringify(tabs));
  await page.close();
}

// ── 2) NeuroMap hub panel + 3 action buttons wired ──
{
  const page=await freshPage('?tool=nm&v='+Date.now());
  await sleep(1200);
  const hub=await page.evaluate(()=>({
    nmContentVisible: (function(){const e=document.getElementById('tools-nm-content');return !!e && e.style.display!=='none';})(),
    surveyFn: typeof window.openNmSurvey==='function',
    sensFn: typeof window.nmOpenSensationOverlay==='function',
    diaryFn: typeof window.nmOpenDiaryOverlay==='function',
    btnEmotion: !!document.querySelector('[onclick="openNmSurvey()"]'),
    btnSens: !!document.querySelector('[onclick="nmOpenSensationOverlay()"]'),
    btnDiary: !!document.querySelector('[onclick="nmOpenDiaryOverlay()"]'),
    miniCal: !!document.getElementById('nm-mini-cal') || typeof window.renderNmMiniCal==='function'
  }));
  ok('NeuroMap hub content visible', hub.nmContentVisible, JSON.stringify(hub));
  ok('Hub 3 fns wired (emotion/sensation/diary)', hub.surveyFn&&hub.sensFn&&hub.diaryFn, JSON.stringify(hub));
  ok('Hub 3 buttons present', hub.btnEmotion&&hub.btnSens&&hub.btnDiary, JSON.stringify(hub));
  await page.close();
}

// ── 3) Legacy ?tool=sensation → redirect to NeuroMap + sensation overlay pops ──
{
  const page=await freshPage('?tool=sensation&v='+Date.now());
  await sleep(1800); // wait for deep-link interval + 140ms overlay trigger
  const st=await page.evaluate(()=>({
    nmActive: !!document.querySelector('#tools-mode-nm.active'),
    sensWrapInOverlay: !!document.querySelector('.na-fs-overlay #tools-sensation-wrap'),
    overlayOpen: !!document.querySelector('.na-fs-overlay'),
    sensState: !!window._nmSensState
  }));
  ok('?tool=sensation → NeuroMap tab active', st.nmActive, JSON.stringify(st));
  ok('?tool=sensation → sensation overlay opened', st.overlayOpen && (st.sensWrapInOverlay||st.sensState), JSON.stringify(st));
  await page.screenshot({path:'/tmp/pr98-sensation-redirect.png'});
  await page.close();
}

// ── 4) Legacy ?tool=diary → redirect to NeuroMap + diary overlay pops ──
{
  const page=await freshPage('?tool=diary&v='+Date.now());
  await sleep(1800);
  const st=await page.evaluate(()=>({
    nmActive: !!document.querySelector('#tools-mode-nm.active'),
    diaryModal: (function(){const m=document.getElementById('diaryModal');return !!m && getComputedStyle(m).display!=='none';})(),
    anyModalOpen: !!document.querySelector('#diaryModal[style*="flex"], #diaryModal.open')
  }));
  ok('?tool=diary → NeuroMap tab active', st.nmActive, JSON.stringify(st));
  ok('?tool=diary → diary input overlay opened', st.diaryModal||st.anyModalOpen, JSON.stringify(st));
  await page.screenshot({path:'/tmp/pr98-diary-redirect.png'});
  await page.close();
}

// ── 5) Course-player inline tools intact (PR#85/86 not broken) ──
{
  const page=await freshPage();
  const cp=await page.evaluate(()=>{
    const r={};
    r.renderSensFn = typeof window.cpRenderSensationMap==='function' || typeof cpRenderSensationMap==='function';
    r.renderDiaryFn = typeof window.cpRenderDiary==='function' || typeof cpRenderDiary==='function';
    r.metaSens = !!(window.TOOL_TASK_META && window.TOOL_TASK_META.sensation_map);
    r.metaDiary = !!(window.TOOL_TASK_META && window.TOOL_TASK_META.diary);
    // render a stub sensation_map tool_task block → expect mini-tool markup back
    try {
      const html = (typeof cpRenderSensationMap==='function')
        ? cpRenderSensationMap({tool_kind:'sensation_map',instructions:'test'}, {}, 'ru') : '';
      r.sensHtmlLen = (html||'').length;
      r.sensHasMarkup = /sm-|sensation|cp-/i.test(html||'');
    } catch(e){ r.sensErr = String(e&&e.message||e); }
    return r;
  });
  ok('Course inline cpRenderSensationMap intact', cp.renderSensFn, JSON.stringify(cp));
  ok('Course inline cpRenderDiary intact', cp.renderDiaryFn);
  ok('TOOL_TASK_META sensation_map + diary intact', cp.metaSens && cp.metaDiary);
  ok('cpRenderSensationMap returns inline markup', cp.sensHtmlLen>0 && cp.sensHasMarkup, JSON.stringify({len:cp.sensHtmlLen,err:cp.sensErr}));
  await page.close();
}

// ── 6) 0 broken i18n keys in tools area after lang switch ──
{
  const page=await freshPage();
  await page.evaluate(()=>window.switchTab('tools'));
  await sleep(300);
  for (const lang of ['en','es','ru']){
    await page.evaluate((l)=>{ if(window.setLang) window.setLang(l); }, lang);
    await sleep(500);
  }
  await sleep(300);
  const broken=await page.evaluate(()=>{
    // any element in the tools tab whose data-i18n resolves to empty text
    const els=document.querySelectorAll('#tab-tools [data-i18n]');
    const bad=[];
    els.forEach(e=>{ if(e.offsetParent && e.textContent.trim()==='') bad.push(e.getAttribute('data-i18n')); });
    // also: no element references the removed key
    const stale=document.querySelectorAll('[data-i18n="a.tools.sensation"]').length;
    return { empties:bad, stale };
  });
  ok('No broken/empty tools i18n labels', broken.empties.length===0, broken.empties.join(','));
  ok('No DOM element references removed a.tools.sensation', broken.stale===0, String(broken.stale));
  await page.close();
}

await browser.close();
const fails=out.filter(o=>!o.c);
console.log('\n── PR#98 RESULT: '+(out.length-fails.length)+'/'+out.length+' passed ──');
if(fails.length){ console.log('FAILURES:'); fails.forEach(f=>console.log('  ✗ '+f.n+' · '+f.x)); process.exit(1); }
