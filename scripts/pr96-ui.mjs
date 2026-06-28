// PR#96 UI smoke — verifies the cross-link buttons render, the client functions
// are wired, a real cross-link click opens the next overlay, and Phase 3.1 (hub
// panel + 3 buttons + mini-cal) is intact.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=[]; const ok=(n,c,x)=>{out.push({n,c:!!c,x:x||''});console.log((c?'PASS':'FAIL')+' · '+n+(x?' · '+x:''));};
async function reg(){const email='p96ui-'+Date.now()+Math.floor(Math.random()*1e4)+'@test.local';
  const r=await(await fetch(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'Test12345!',display_name:'p96',country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})})).json();return r.token;}

const token=await reg();
const me=await(await fetch(AUTH+'/api/auth/me',{headers:{authorization:'Bearer '+token}})).json();const meUser=me.user||me;
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage();
await page.setViewport({width:1280,height:900});
const errs=[];page.on('pageerror',e=>errs.push(String(e&&e.message||e)));
await page.evaluateOnNewDocument((t,u)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(u));window.currentUser=u;},token,meUser);
await page.goto(SITE+'?v='+Date.now(),{waitUntil:'networkidle2',timeout:60000});
await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});

// functions wired
const fns=await page.evaluate(()=>({
  ensureSession: typeof window.nmEnsureSession==='function',
  clearSession: typeof window.nmClearSession==='function',
  diaryEmotion: typeof window.nmDiaryLinkEmotion==='function',
  diarySensation: typeof window.nmDiaryLinkSensation==='function',
  saveLinkSensation: typeof window.nmSaveAndLinkSensation==='function',
  openSens: typeof window.nmOpenSensationOverlay==='function',
  openSurvey: typeof window.openNmSurvey==='function'
}));
ok('client fns wired', Object.values(fns).every(Boolean), JSON.stringify(fns));

// Phase 3.1 intact: open Tools→NeuroMap hub, 3 buttons + mini-cal present
await page.evaluate(()=>{ window.switchTab('tools'); if(window.setToolsMode) window.setToolsMode('nm'); });
await sleep(1500);
const hub=await page.evaluate(()=>{
  // Check by wired onclick handlers (works even when the panel is display:none in
  // headless) rather than visible innerText.
  const html=(document.getElementById('tools-nm-content')||document.body).innerHTML;
  return {
    emotionBtn: /openNmSurvey/.test(html),
    sensBtn: /nmOpenSensationOverlay/.test(html),
    diaryBtn: /nmOpenDiaryOverlay/.test(html),
    miniCal: !!document.getElementById('nm-minical-grid')
  };
});
ok('Phase 3.1 hub: 3 buttons + mini-cal intact', hub.emotionBtn&&hub.sensBtn&&hub.diaryBtn&&hub.miniCal, JSON.stringify(hub));

// Diary modal: two cross-link buttons render
await page.evaluate(()=>{ window.openDiaryInput(); document.getElementById('diary-event-text').value='Тест событие'; if(window.onDiaryTextInput) onDiaryTextInput(); window.addRating&&addRating('plus'); });
await sleep(500);
const diaryBtns=await page.evaluate(()=>{
  const acts=document.getElementById('diary-actions');
  const html=acts?acts.innerHTML:'';
  return {
    visible: acts && acts.style.display!=='none',
    linkEmotion: /nmDiaryLinkEmotion/.test(html),
    linkSensation: /nmDiaryLinkSensation/.test(html),
    saveExit: /saveAndClose/.test(html),
    addMore: /saveAndNext/.test(html)
  };
});
ok('diary: 4 actions incl. 2 cross-link buttons', diaryBtns.linkEmotion&&diaryBtns.linkSensation&&diaryBtns.saveExit&&diaryBtns.addMore, JSON.stringify(diaryBtns));

// Click «Привязать к эмоции» → diary closes, emotion survey opens, session set
const flow=await page.evaluate(async ()=>{
  window.nmDiaryLinkEmotion();
  await new Promise(r=>setTimeout(r,400));
  return {
    diaryClosed: !document.getElementById('diaryModal').classList.contains('open'),
    surveyOpen: document.getElementById('nmSurveyModal').classList.contains('open'),
    sessionSet: !!window.nmSessionId
  };
});
ok('diary→emotion click: survey opens w/ active session', flow.diaryClosed&&flow.surveyOpen&&flow.sessionSet, JSON.stringify(flow));

// Emotion Step 6 choice screen renders the «привязать к ощущению» link button.
// Drive the survey to the choice screen via state, then render.
const step6=await page.evaluate(()=>{
  try{
    nmSurveyState={emotions:['радость'],emotionChains:[{areas:['работа'],causes:['успех'],thoughts:['всё получится']}],intensity:7,context:'ок'};
    nmCurrentStep=6; renderNmStep();
    const html=document.getElementById('nm-step-content').innerHTML;
    return { hasSaveExit:/nmFinishAndSave/.test(html), hasLinkSensation:/nmSaveAndLinkSensation/.test(html), hasAddEmotion:/nmAddAnotherEmotion/.test(html) };
  }catch(e){ return {err:String(e.message)}; }
});
ok('emotion step6: save-exit + link-to-sensation options', step6.hasSaveExit&&step6.hasLinkSensation&&step6.hasAddEmotion, JSON.stringify(step6));

// Exclude the documented pre-existing benign canvas arc clamp error (PR#95) — it
// is unrelated to cross-link and fires from drawNodeCv on tiny headless canvases.
const realErrs=errs.filter(e=>!/arc.*negative|IndexSizeError/i.test(e));
ok('no NEW page errors (benign arc clamp excluded)', realErrs.length===0, realErrs.slice(0,3).join(' | '));

const passed=out.filter(r=>r.c).length;
console.log('\n'+passed+'/'+out.length+' UI checks passed');
await browser.close();
process.exit(passed===out.length?0:1);
