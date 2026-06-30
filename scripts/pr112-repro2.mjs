// PR#112 Issue 1 REPRO-2 — find the mass-merge trigger. Test two patterns on the
// deployed build, each on its OWN fresh user:
//   A) 3 standalone flows that SHARE a life-sphere (семья) → dedup-merge?
//   B) chained cross-links Sensation→Emotion→Sensation→Emotion (long handoff chain)
//   C) abandoned cross-link (handoff left true) then a standalone flow → contamination?
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const H=t=>({'content-type':'application/json',authorization:'Bearer '+t});
async function j(u,o){ const r=await fetch(u,o); const t=await r.text(); try{return JSON.parse(t);}catch(e){return {raw:t};} }
async function freshUser(tag){
  const email=tag+Date.now()+'@test.local';
  const reg=await j(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({email,password:'Test12345!',display_name:'pr112',country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})});
  const tok=reg.token; const me=await j(AUTH+'/api/auth/me',{headers:H(tok)});
  return {tok,user:me.user||me,email};
}
async function newPage(browser,u){
  const page=await browser.newPage();
  await page.setViewport({width:1366,height:920});
  await page.evaluateOnNewDocument((t,us)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(us));window.currentUser=us;},u.tok,u.user);
  await page.goto(SITE+'?v='+Date.now(),{waitUntil:'networkidle2',timeout:60000});
  await page.waitForFunction('typeof window.openNmSurvey === "function" && typeof window.nmConsumeSessionHandoff === "function"',{timeout:30000});
  return page;
}
async function components(tok){
  const g=await j(AUTH+'/api/neuromap/v2/graph',{headers:H(tok)});
  const N=(g.nodes||[]).map(n=>n.id); const adj={}; N.forEach(id=>adj[id]=new Set());
  (g.links||[]).forEach(l=>{ if(adj[l.source]&&adj[l.target]){ adj[l.source].add(l.target); adj[l.target].add(l.source);} });
  const seen=new Set(); const sizes=[];
  for(const id of N){ if(seen.has(id))continue; let sz=0; const st=[id]; while(st.length){ const x=st.pop(); if(seen.has(x))continue; seen.add(x); sz++; (adj[x]||[]).forEach(y=>{if(!seen.has(y))st.push(y);}); } sizes.push(sz); }
  return {nodes:N.length,links:(g.links||[]).length,comps:sizes.length,sizes:sizes.sort((a,b)=>b-a)};
}
async function emoFlow(page,emo,area){
  await page.evaluate((e,a)=>{ window.openNmSurvey(); window.nmSurveyState={emotions:[e],emotionChains:[{areas:[a],causes:[''],thoughts:['']}],intensity:5,context:'',_concept:null}; window.nmSaveSurvey(); },emo,area);
  await sleep(650);
}
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});

// ── A) shared sphere across 3 standalone flows ──
{
  const u=await freshUser('pr112A'); const page=await newPage(browser,u);
  await emoFlow(page,'радость','семья');
  await emoFlow(page,'грусть','семья');
  await emoFlow(page,'интерес','семья');
  console.log('A) 3 standalone, ALL area=семья →', JSON.stringify(await components(u.tok)));
  await page.close();
}
// ── B) chained cross-links: S→E→S→E (one long handoff chain) ──
{
  const u=await freshUser('pr112B'); const page=await newPage(browser,u);
  await page.evaluate(()=>{ window.__t=localStorage.getItem('na_token'); window.AP='https://neuroattention-api-production.up.railway.app'; });
  async function sens(loc,word){ await page.evaluate(async(l,w)=>{ window.nmConsumeSessionHandoff(); window.nmEnsureSession(); const sid=window.nmSessionId; await fetch(window.AP+'/api/neuromap/sensation',{method:'POST',headers:{'Authorization':'Bearer '+window.__t,'Content-Type':'application/json'},body:JSON.stringify({sensations:[w],body_locations:[l],loc_labels:{},intensity:6,session_id:sid})}).then(r=>r.json()); window.nmSessionHandoff=true; },loc,word); await sleep(200); }
  async function emo(e,a){ await page.evaluate((em,ar)=>{ window.openNmSurvey(); window.nmSurveyState={emotions:[em],emotionChains:[{areas:[ar],causes:[''],thoughts:['']}],intensity:5,context:'',_concept:null}; window.nmSessionHandoff=true; window.nmSaveSurvey(); },e,a); await sleep(400); }
  // long chain, handoff kept true throughout
  await sens('chest','warmth'); await emo('интерес','работа / деньги');
  await sens('belly','tingling'); await emo('радость','семья');
  // terminate
  await page.evaluate(()=>{ window.nmSessionHandoff=false; window.nmClearSession(); });
  console.log('B) chained S→E→S→E (handoff kept) →', JSON.stringify(await components(u.tok)));
  await page.close();
}
// ── C) abandoned cross-link (handoff left TRUE) then 3 standalone flows ──
{
  const u=await freshUser('pr112C'); const page=await newPage(browser,u);
  await page.evaluate(()=>{ window.__t=localStorage.getItem('na_token'); window.AP='https://neuroattention-api-production.up.railway.app'; });
  // emotion → "save and link sensation" sets handoff true, but user never opens/saves the sensation
  await page.evaluate(()=>{ window.openNmSurvey(); window.nmSurveyState={emotions:['тревога'],emotionChains:[{areas:['будущее'],causes:[''],thoughts:['']}],intensity:5,context:'',_concept:null}; window.nmEnsureSession(); window.nmSessionHandoff=true; window.nmSaveSurvey(); /* closeNmSurvey keeps session because handoff true */ });
  await sleep(600);
  // now the user just does 3 normal standalone flows — does the leaked session glue them?
  await emoFlow(page,'злость','работа / деньги');
  await emoFlow(page,'спокойствие','отношения');
  await emoFlow(page,'благодарность','творчество');
  console.log('C) abandoned-handoff then 3 standalone →', JSON.stringify(await components(u.tok)));
  await page.close();
}
console.log('\nIDEAL: A merges via shared node (expected by design), B one chain (intended), C should be 4+ separate — if C is one blob, that is the leak');
await browser.close();
