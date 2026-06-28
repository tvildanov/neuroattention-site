// PR#95 Phase 3.1 — verify the NeuroMap hub right-panel on LIVE prod.
//   • 3 buttons + mini-calendar render in the right panel
//   • «Карта эмоций» opens the 6-step emotion walkthrough (nmSurveyModal)
//   • «Карта ощущений» opens a fullscreen overlay with the full Sensation Map
//     (body picker + sensation chips); save → overlay closes → cyan nodes appear
//   • «Добавить событие» opens the diary overlay with date+time pickers; save →
//     overlay closes → event lands in the graph
//   • mini-calendar highlights days with diary events
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const H=t=>({'content-type':'application/json',authorization:'Bearer '+t});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const OUT=process.env.OUT||'/tmp/';
const reg=async tag=>{const email=tag+'-'+Date.now()+Math.floor(Math.random()*1e4)+'@test.local';const r=await(await fetch(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'Test12345!',display_name:tag,country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})})).json();return{email,token:r.token};};
const out={pass:{},fail:[]};
const ok=(k,v)=>{out.pass[k]=v; if(!v) out.fail.push(k);};

const o=await reg('p95');
const me=await(await fetch(AUTH+'/api/auth/me',{headers:H(o.token)})).json();const meUser=me.user||me;

const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage();
await page.setViewport({width:1280,height:900});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message||e)));
await page.evaluateOnNewDocument((t,u)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(u));window.currentUser=u;},o.token,meUser);
await page.goto(SITE,{waitUntil:'networkidle2',timeout:60000});
await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});
await page.evaluate(()=>{ window.switchTab('tools'); if(window.setToolsMode) window.setToolsMode('nm'); });
await sleep(2500);

// ── 1. right-panel structure ──
out.panel = await page.evaluate(()=>{
  const txt=el=>el?el.textContent.trim():null;
  const btns=[...document.querySelectorAll('#tools-nm-content .span-4 button')].map(b=>b.textContent.trim()).filter(Boolean);
  return {
    hasEmotionBtn: !!document.querySelector('[data-i18n="a.tools.fill_emotion_map"]'),
    hasSensationBtn: !!document.querySelector('[data-i18n="a.tools.fill_sensation_map"]'),
    hasDiaryBtn: !!document.querySelector('[data-i18n="a.tools.add_diary_event"]'),
    hasMiniCalGrid: !!document.getElementById('nm-minical-grid'),
    miniCalTitle: txt(document.getElementById('nm-minical-title')),
    fnDefined: typeof window.nmOpenSensationOverlay==='function' && typeof window.nmOpenDiaryOverlay==='function' && typeof window.renderNmMiniCal==='function',
    sampleBtns: btns.slice(0,6)
  };
});
ok('emotion_btn', out.panel.hasEmotionBtn);
ok('sensation_btn', out.panel.hasSensationBtn);
ok('diary_btn', out.panel.hasDiaryBtn);
ok('minical_grid', out.panel.hasMiniCalGrid);
ok('hub_fns_defined', out.panel.fnDefined);
await page.screenshot({ path: OUT+'pr95-panel.png' });

// ── 2. emotion walkthrough opens ──
await page.evaluate(()=>window.openNmSurvey&&window.openNmSurvey());
await sleep(600);
out.emotionModalOpen = await page.evaluate(()=>{ const m=document.getElementById('nmSurveyModal'); return !!(m && m.classList.contains('open')); });
ok('emotion_walkthrough_opens', out.emotionModalOpen);
await page.evaluate(()=>window.closeNmSurvey&&window.closeNmSurvey());
await sleep(300);

// ── 3. sensation overlay ──
await page.evaluate(()=>window.nmOpenSensationOverlay&&window.nmOpenSensationOverlay());
await sleep(2500);
out.sensOverlay = await page.evaluate(()=>{
  const ov=document.querySelector('.na-fs-overlay');
  return {
    overlayPresent: !!ov,
    hasBodyPicker: !!document.querySelector('#sm-body-picker svg, #sm-body-picker canvas, #sm-body-picker'),
    sensChips: document.querySelectorAll('#sm-sens-chips .sm-chip').length,
    locChips: document.querySelectorAll('#sm-loc-chips .sm-chip').length,
    hasSaveExit: !!document.getElementById('nm-sens-save-exit'),
    hasLinkStub: !!document.getElementById('nm-sens-link-stub')
  };
});
ok('sens_overlay_present', out.sensOverlay.overlayPresent);
ok('sens_overlay_chips', out.sensOverlay.sensChips>0);
ok('sens_overlay_savebtn', out.sensOverlay.hasSaveExit && out.sensOverlay.hasLinkStub);
await page.screenshot({ path: OUT+'pr95-sens-overlay.png' });

// select a couple sensation chips + a body location, then Save & exit
await page.evaluate(()=>{
  const chips=[...document.querySelectorAll('#sm-sens-chips .sm-chip')].slice(0,2); chips.forEach(c=>c.click());
  const loc=[...document.querySelectorAll('#sm-loc-chips .sm-chip')].slice(0,1); loc.forEach(c=>c.click());
});
await sleep(400);
await page.evaluate(()=>{ const b=document.getElementById('nm-sens-save-exit'); if(b) b.click(); });
await sleep(3000);
out.sensClosed = await page.evaluate(()=>!document.querySelector('.na-fs-overlay'));
ok('sens_overlay_closed_after_save', out.sensClosed);
// reload graph + check cyan sensation nodes
await page.evaluate(()=>{ if(window.setNmView) window.setNmView('all'); });
await sleep(2000);
out.sensNodes = await page.evaluate(()=>{
  const sens=(window.nmNodes||[]).filter(n=>n.type==='sensation');
  const colors=sens.map(n=> window.nmGetNodeColor ? window.nmGetNodeColor(n) : '?');
  return { count: sens.length, colors:[...new Set(colors)], labels: sens.map(n=>n.label).slice(0,6) };
});
ok('sensation_nodes_in_graph', out.sensNodes.count>0);

// ── 4. diary overlay with date+time ──
await page.evaluate(()=>window.nmOpenDiaryOverlay&&window.nmOpenDiaryOverlay());
await sleep(800);
out.diaryOverlay = await page.evaluate(()=>{
  const m=document.getElementById('diaryModal');
  const d=document.getElementById('diary-event-date');
  const tm=document.getElementById('diary-event-time');
  return {
    open: !!(m && m.classList.contains('open')),
    hasDate: !!d, dateVal: d?d.value:null,
    hasTime: !!tm
  };
});
ok('diary_overlay_open', out.diaryOverlay.open);
ok('diary_date_picker', out.diaryOverlay.hasDate && /^\d{4}-\d{2}-\d{2}$/.test(out.diaryOverlay.dateVal||''));
ok('diary_time_picker', out.diaryOverlay.hasTime);
await page.screenshot({ path: OUT+'pr95-diary-overlay.png' });

// fill + rate + save & exit
await page.evaluate(()=>{
  const ev=document.getElementById('diary-event-text'); ev.value='Тестовое событие PR95'; ev.dispatchEvent(new Event('input',{bubbles:true}));
});
await sleep(400);
await page.evaluate(()=>window.addRating&&window.addRating('plus'));
await sleep(400);
out.diaryActionsShown = await page.evaluate(()=>{ const a=document.getElementById('diary-actions'); return a && a.style.display!=='none'; });
ok('diary_actions_shown', out.diaryActionsShown);
await page.evaluate(()=>window.saveAndClose&&window.saveAndClose());
await sleep(2500);
out.diaryClosed = await page.evaluate(()=>{ const m=document.getElementById('diaryModal'); return !(m && m.classList.contains('open')); });
ok('diary_overlay_closed', out.diaryClosed);
out.eventNode = await page.evaluate(()=>{
  const evs=(window.nmNodes||[]).filter(n=>n.type==='event');
  return { count: evs.length, labels: evs.map(n=>n.label).slice(0,6) };
});
ok('diary_event_in_graph', out.eventNode.count>0);

// ── 5. mini-calendar highlight ──
await sleep(500);
out.miniCal = await page.evaluate(()=>{
  if(window.renderNmMiniCal) window.renderNmMiniCal();
  const cells=[...document.querySelectorAll('#nm-minical-grid > div')];
  const highlighted=cells.filter(c=>/rgba\((100, 255, 150|255, 100, 100|140, 180, 255)/.test(c.style.background) || (c.style.background||'').includes('rgba')).length;
  return { totalCells: cells.length, highlighted };
});
ok('minical_has_highlight', out.miniCal.highlighted>0);

out.errs=errs.slice(0,8);
out.summary = { passed: Object.values(out.pass).filter(Boolean).length, total: Object.keys(out.pass).length, failed: out.fail };
console.log(JSON.stringify(out,null,2));
await browser.close();
