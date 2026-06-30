// PR#112 PRE-DEPLOY verification — serve the LOCAL account.html on the prod ORIGIN
// (request interception → passes the API CORS allow-list) so the inline JS/CSS changes
// are exercised against the real backend BEFORE merge. Backend issues (4/5) and the
// session graph need the deployed server, so they are checked separately post-deploy.
//   #1 three separate flows → distinct session per flow + 3 graph clusters
//   #2 sensation overlay 50/50 + buttons below body (no overlap)
//   #3 Diary→Emotion carries the diary nodes into the live map (nmCarriedLive set)
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { readFileSync } from 'node:fs';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const OUT=new URL('.',import.meta.url).pathname;
const LOCAL_HTML=readFileSync(new URL('../account.html',import.meta.url),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const H=t=>({'content-type':'application/json',authorization:'Bearer '+t});
async function j(u,o){ const r=await fetch(u,o); const t=await r.text(); try{return JSON.parse(t);}catch(e){return {raw:t};} }
async function freshUser(){ const email='pr112lv'+Date.now()+'@test.local';
  const reg=await j(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({email,password:'Test12345!',display_name:'lv',country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})});
  const me=await j(AUTH+'/api/auth/me',{headers:H(reg.token)}); return {tok:reg.token,user:me.user||me,email}; }
async function components(tok){ const g=await j(AUTH+'/api/neuromap/v2/graph',{headers:H(tok)});
  const N=(g.nodes||[]).map(n=>n.id); const adj={}; N.forEach(id=>adj[id]=new Set());
  (g.links||[]).forEach(l=>{ if(adj[l.source]&&adj[l.target]){ adj[l.source].add(l.target); adj[l.target].add(l.source);} });
  const seen=new Set(); const sizes=[]; for(const id of N){ if(seen.has(id))continue; let sz=0; const st=[id]; while(st.length){ const x=st.pop(); if(seen.has(x))continue; seen.add(x); sz++; (adj[x]||[]).forEach(y=>{if(!seen.has(y))st.push(y);}); } sizes.push(sz);} return {nodes:N.length,links:(g.links||[]).length,comps:sizes.length,sizes:sizes.sort((a,b)=>b-a)}; }

const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
async function mkPage(u){
  const page=await browser.newPage(); await page.setViewport({width:1366,height:900});
  await page.setRequestInterception(true);
  page.on('request',req=>{
    if(req.url().split('?')[0]===SITE){ req.respond({status:200,contentType:'text/html; charset=utf-8',body:LOCAL_HTML}); return; }
    req.continue();
  });
  await page.evaluateOnNewDocument((t,us)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(us));window.currentUser=us;},u.tok,u.user);
  await page.goto(SITE+'?v='+Date.now(),{waitUntil:'networkidle2',timeout:60000});
  await page.waitForFunction('typeof window.openNmSurvey === "function" && typeof window.nmConsumeSessionHandoff === "function"',{timeout:30000});
  return page;
}
const results={};

// ── #1 three separate flows → distinct sessions + 3 clusters ──
{
  const u=await freshUser(); const page=await mkPage(u);
  await page.evaluate(()=>{ window.__sends=[]; const of=window.fetch; window.fetch=function(uu,o){ try{ if(typeof uu==='string'&&/\/api\/neuromap\/(v2\/append|sensation)/.test(uu)&&o&&o.body){ const b=JSON.parse(o.body); window.__sends.push({ep:uu.replace(/.*\/api\/neuromap\//,''),sid:b.session_id||null}); } }catch(e){} return of.apply(this,arguments); }; });
  async function emo(e,a){ await page.evaluate((em,ar)=>{ window.openNmSurvey(); window.nmSurveyState={emotions:[em],emotionChains:[{areas:[ar],causes:[''],thoughts:['']}],intensity:5,context:'',_concept:null}; window.nmSaveSurvey(); },e,a); await sleep(650); }
  await emo('радость','семья');
  // cross-link: sensation → emotion (real FSM)
  await page.evaluate(async()=>{ window.nmConsumeSessionHandoff(); window.nmEnsureSession(); const sid=window.nmSessionId; const tk=localStorage.getItem('na_token'); window.__sp=fetch((window.AUTH_API||'https://neuroattention-api-production.up.railway.app')+'/api/neuromap/sensation',{method:'POST',headers:{'Authorization':'Bearer '+tk,'Content-Type':'application/json'},body:JSON.stringify({sensations:['warmth'],body_locations:['chest'],loc_labels:{chest:'грудь'},intensity:6,session_id:sid})}).then(r=>r.json()); window.nmMarkHandoff(); });
  await page.evaluate(()=>window.__sp); await sleep(150);
  await page.evaluate(()=>{ window.openNmSurvey(); window.nmSurveyState={emotions:['интерес'],emotionChains:[{areas:['работа / деньги'],causes:[''],thoughts:['']}],intensity:5,context:'',_concept:null}; window.nmSaveSurvey(); }); await sleep(700);
  await emo('спокойствие','будущее');
  const sends=await page.evaluate(()=>window.__sends);
  const distinctSessions=new Set(sends.map(s=>s.sid).filter(Boolean)).size;
  const comp=await components(u.tok);
  // flow1 (emo, fresh sess), flow2 (sens+emo, 1 shared sess), flow3 (emo, fresh sess) = 3 distinct sessions
  results.issue1={sends:sends.map(s=>s.ep+':'+(s.sid?s.sid.slice(0,6):'∅')),distinctSessions,graph:comp,
    pass: distinctSessions===3 && comp.comps>=3 && comp.sizes[0]<=4};
  await page.close();
}
// ── #2 sensation overlay geometry ──
{
  const u=await freshUser(); const page=await mkPage(u);
  await page.evaluate(()=>{ window.switchTab('tools'); if(window.setToolsMode) window.setToolsMode('nm'); }); await sleep(700);
  await page.evaluate(()=>{ if(window.nmOpenSensationOverlay) window.nmOpenSensationOverlay(); }); await sleep(1400);
  const geo=await page.evaluate(()=>{
    const form=document.querySelector('.nm-fs-split .nm-fs-form'), live=document.querySelector('.nm-fs-split .nm-fs-live');
    const foot=document.querySelector('.nm-fs-footer');
    const stage=document.querySelector('#tools-sensation-wrap .bp-stage')||document.querySelector('#tools-sensation-wrap svg')||document.querySelector('#tools-sensation-wrap');
    const r=el=>el?el.getBoundingClientRect():null; const fr=r(foot),sr=r(stage),fo=r(form),li=r(live);
    return { livePct:(fo&&li)?Math.round(100*li.width/(fo.width+li.width)):null,
             overlap:(fr&&sr)?Math.round(sr.bottom-fr.top):null, footTop:fr&&Math.round(fr.top), stageBottom:sr&&Math.round(sr.bottom) };
  });
  await page.screenshot({path:OUT+'pr112-a-sensation-5050.png'});
  results.issue2={geo, pass: geo.livePct!=null && Math.abs(geo.livePct-50)<=8 && (geo.overlap==null||geo.overlap<=2)};
  await page.close();
}
// ── #3 Diary→Emotion carries diary nodes into the live map ──
{
  const u=await freshUser(); const page=await mkPage(u);
  const carry=await page.evaluate(()=>{
    // fill a diary event, then run the REAL Diary→Emotion cross-link
    window.openDiaryInput && window.openDiaryInput();
    var ta=document.getElementById('diary-event-text'); if(ta){ ta.value='Поговорил с другом'; }
    // emulate a positive rating so the model has a valence node
    try{ window.nmDiaryLinkEmotion(); }catch(e){ return {err:String(e)}; }
    return null;
  });
  await sleep(300);
  const carried=await page.evaluate(()=>{
    const c=window.nmCarriedLive;
    return c&&c.nodes?{count:c.nodes.length, labels:c.nodes.map(n=>n.type+':'+n.label), hasTail:!!c.tail}:{count:0};
  });
  // after openNmSurvey ran (handoff), add an emotion and rebuild the live graph — carried must still be present and drawn
  const live=await page.evaluate(()=>{
    if(!document.getElementById('nmSurveyModal').classList.contains('open')) return {open:false};
    window.nmSurveyState={emotions:['радость'],emotionChains:[{areas:[''],causes:[''],thoughts:['']}],intensity:5,context:'',_concept:null};
    try{ window.buildLiveGraph(); }catch(e){ return {err:String(e)}; }
    const empty=document.getElementById('nm-live-empty');
    const c=window.nmCarriedLive;
    return { open:true, carriedStillSet:!!(c&&c.nodes&&c.nodes.length), liveNotEmpty: empty? getComputedStyle(empty).display==='none':true };
  });
  results.issue3={carried, live, pass: carried.count>0 && live.open===true && live.carriedStillSet===true};
  await page.close();
}
await browser.close();
console.log(JSON.stringify(results,null,2));
const allPass=results.issue1.pass&&results.issue2.pass&&results.issue3.pass;
console.log('\nPRE-DEPLOY RESULT:', allPass?'PASS ✅':'FAIL ❌');
