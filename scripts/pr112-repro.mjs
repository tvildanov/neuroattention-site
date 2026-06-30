// PR#112 Issue 1 REPRO — drive the REAL client session FSM across 3 separate flows
// on the deployed build and dump (1) the session_id each save actually sends and
// (2) the resulting v2 graph connectivity (one blob vs distinct clusters).
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const H=t=>({'content-type':'application/json',authorization:'Bearer '+t});
async function j(u,o){ const r=await fetch(u,o); const t=await r.text(); try{return JSON.parse(t);}catch(e){return {raw:t};} }

const TAG='pr112r'+Date.now();
const email=TAG+'@test.local';
const reg=await j(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email,password:'Test12345!',display_name:'pr112',country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})});
const tok=reg.token;
const me=await j(AUTH+'/api/auth/me',{headers:H(tok)}); const meUser=me.user||me;

const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage();
await page.setViewport({width:1366,height:920});
const errs=[];page.on('pageerror',e=>errs.push(String(e&&e.message||e)));
await page.evaluateOnNewDocument((t,u)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(u));window.currentUser=u;},tok,meUser);
await page.goto(SITE+'?v='+Date.now(),{waitUntil:'networkidle2',timeout:60000});
await page.waitForFunction('typeof window.openNmSurvey === "function" && typeof window.nmConsumeSessionHandoff === "function"',{timeout:30000});

// Instrument fetch to record session_id per neuromap save
await page.evaluate(()=>{
  window.__sends=[];
  const of=window.fetch;
  window.fetch=function(u,o){
    try{
      if(typeof u==='string' && /\/api\/neuromap\/(v2\/append|sensation)/.test(u) && o && o.body){
        const b=JSON.parse(o.body);
        window.__sends.push({ep:u.replace(/.*\/api\/neuromap\//,''), sid:b.session_id||null});
      }
    }catch(e){}
    return of.apply(this,arguments);
  };
});

// Helper to run a STANDALONE emotion flow using the real functions
async function emoFlow(emotion, area){
  await page.evaluate((emo,ar)=>{
    window.openNmSurvey();                       // real opener (consumes handoff)
    window.nmSurveyState={emotions:[emo],emotionChains:[{areas:[ar],causes:[''],thoughts:['']}],intensity:5,context:'',_concept:null};
    window.nmSaveSurvey();                        // real save (sends session_id) + closeNmSurvey
  }, emotion, area);
  await sleep(700);
}

// Flow 1 — standalone emotion
await emoFlow('радость','семья');

// Flow 2 — sensation → «Привязать к эмоции» → emotion (real FSM, manual sensation POST)
await page.evaluate(()=>{
  window.nmConsumeSessionHandoff();              // sensation overlay open
  window.nmEnsureSession();                      // link-stub click ensures a session
  const sid=window.nmSessionId;
  const tok=localStorage.getItem('na_token');
  // POST the sensation exactly as submitSensationMap would, with the live session id
  window.__sensPromise=fetch((window.AUTH_API||'https://neuroattention-api-production.up.railway.app')+'/api/neuromap/sensation',{
    method:'POST',headers:{'Authorization':'Bearer '+tok,'Content-Type':'application/json'},
    body:JSON.stringify({sensations:['warmth'],body_locations:['chest'],loc_labels:{chest:'грудь'},intensity:6,comment:'',session_id:sid})
  }).then(r=>r.json());
  window.nmSessionHandoff=true;                  // hand off to emotion walkthrough
});
await page.evaluate(()=>window.__sensPromise);
await sleep(150);
await page.evaluate(()=>{
  window.openNmSurvey();                         // consumes handoff → keeps the session
  window.nmSurveyState={emotions:['интерес'],emotionChains:[{areas:['работа / деньги'],causes:[''],thoughts:['']}],intensity:5,context:'',_concept:null};
  window.nmSaveSurvey();
});
await sleep(800);

// Flow 3 — standalone emotion again (must NOT inherit flow-2's session)
await emoFlow('спокойствие','будущее');

// Dump what was sent
const sends=await page.evaluate(()=>window.__sends);
console.log('\n── session_id per save ──');
sends.forEach((s,i)=>console.log(`  ${i+1}. ${s.ep.padEnd(11)} sid=${s.sid||'∅(none)'}`));
const sids=sends.map(s=>s.sid);
const distinct=[...new Set(sids.filter(Boolean))];
console.log('distinct non-null session_ids:',distinct.length);

// ── graph connectivity: count connected components ──
const g=await j(AUTH+'/api/neuromap/v2/graph',{headers:H(tok)});
const N=(g.nodes||[]).map(n=>n.id);
const adj={}; N.forEach(id=>adj[id]=new Set());
(g.links||[]).forEach(l=>{ if(adj[l.source]&&adj[l.target]){ adj[l.source].add(l.target); adj[l.target].add(l.source);} });
const seen=new Set(); let comps=0; const compSizes=[];
for(const id of N){ if(seen.has(id))continue; comps++; let sz=0; const st=[id]; while(st.length){ const x=st.pop(); if(seen.has(x))continue; seen.add(x); sz++; (adj[x]||[]).forEach(y=>{if(!seen.has(y))st.push(y);}); } compSizes.push(sz); }
console.log('\n── graph ──');
console.log('nodes:',N.length,'links:',(g.links||[]).length);
console.log('connected components:',comps,'sizes:',compSizes.sort((a,b)=>b-a).join(','));
console.log('biggest component holds',Math.max(...compSizes,0),'of',N.length,'nodes');
console.log('\npage errors:',errs.slice(0,3).join(' | ')||'none');
console.log('EXPECT: ~3 flows → distinct session per flow, graph NOT one giant blob');
console.log('user',email);
await browser.close();
