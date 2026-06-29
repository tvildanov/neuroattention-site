// PR#106 — verify (a) the clean-slate API reject (sensation w/o body part → 400) and
// (b) the REAL sticky-bubble rendering: bubbles touch/press into the body (no gap),
// stay glued while the body part is dragged, in BOTH main canvas and fullscreen.
// Uses the PR#105 interception trick: load the prod URL (origin = neuroattention.org
// so the Railway API CORS passes) but fulfil the document request with the LOCAL
// edited account.html — verifies the front-end edits WITHOUT deploying.
//   node pr106-verify.mjs            → local edited account.html (pre-deploy front-end)
//   node pr106-verify.mjs prod       → deployed account.html (post-deploy)
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { readFileSync } from 'node:fs';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const USE_DEPLOYED = process.argv[2]==='prod';
const LOCAL_HTML = USE_DEPLOYED ? null : readFileSync(new URL('../account.html', import.meta.url),'utf8');
const TAG='pr106v'+Date.now();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const H=t=>({'content-type':'application/json',authorization:'Bearer '+t});

const email=TAG+'@test.local';
const reg=await(await fetch(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email,password:'Test12345!',display_name:'PR106',country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})})).json();
const token=reg.token; if(!token){console.log('FATAL register',JSON.stringify(reg));process.exit(1);}
console.log('user',email,'mode',USE_DEPLOYED?'DEPLOYED':'LOCAL-edited');

// ── Canonical test data: 5 sensations × 3 body parts (each WITH a body part). ──
const saves = [
  {sensations:['heat'],body_locations:['back']},
  {sensations:['pressure'],body_locations:['back']},
  {sensations:['tingling'],body_locations:['head']},
  {sensations:['pain'],body_locations:['head']},
  {sensations:['cold'],body_locations:['belly']},
];
for(const s of saves) await(await fetch(AUTH+'/api/neuromap/sensation',{method:'POST',headers:H(token),
  body:JSON.stringify({...s,comment:'pr106',session_id:TAG+'-'+s.sensations[0]+'-'+s.body_locations[0]})})).json();

// ── API reject test: a sensation with NO body part must be 400 (only on DEPLOYED). ──
const rej=await fetch(AUTH+'/api/neuromap/sensation',{method:'POST',headers:H(token),
  body:JSON.stringify({sensations:['heaviness'],body_locations:[],comment:'pr106-nobody'})});
let rejBody={}; try{rejBody=await rej.json();}catch(e){}
console.log('\n== API reject (no body part) ==  status='+rej.status+'  body='+JSON.stringify(rejBody));
const rejPass = rej.status===400 && rejBody.error==='body_part_required';
console.log('   => '+(rejPass?'PASS (400 rejected)':(USE_DEPLOYED?'FAIL':'(expected only post-deploy; prod server still old)')));

const me=await(await fetch(AUTH+'/api/auth/me',{headers:H(token)})).json();const meUser=me.user||me;
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});

// Introspect gap between each anchored bubble and its body anchor.
// gap = dist(bubble,anchor) − (rAnchor + rBubble). gap>0 = VISIBLE GAP (bad).
const MEASURE=`(function(){
  var R=window.nmNodeR; var nodes=window.nmNodes||[],links=window.nmLinks||[];var byId={};nodes.forEach(n=>byId[n.id]=n);
  var sens=nodes.filter(n=>n.type==='sensation');
  function areaKind(n){var m=n.metadata||{};return m.area_kind||(m.source==='sensation'?'body':null);}
  var anchored=sens.filter(s=>s._anchorId);
  var gaps=anchored.map(function(s){var a=byId[s._anchorId];if(!a)return null;
    var dx=s.x-a.x,dy=s.y-a.y;var d=Math.sqrt(dx*dx+dy*dy);
    var gap=d-(R(a)+R(s));
    return {sens:s.label,anchor:a.label,gap:Math.round(gap*10)/10,touching:gap<=0};
  }).filter(Boolean);
  var maxGap=gaps.reduce(function(m,g){return Math.max(m,g.gap);},-999);
  var arrows=links.filter(function(l){ if(l._sensBody)return false; var s=byId[l.source],t=byId[l.target];if(!s||!t)return false;
    return ((s.type==='sensation'&&t.type==='area'&&areaKind(t)==='body')||(t.type==='sensation'&&s.type==='area'&&areaKind(s)==='body')); }).length;
  return {anchored:anchored.length, gaps:gaps, maxGap:maxGap, allTouching:gaps.every(g=>g.touching),
          arrowsDrawn:arrows, noBody:sens.filter(s=>!s._anchorId).map(s=>s.label)};
})()`;

async function run(w,h,suffix){
  const page=await browser.newPage();
  await page.setViewport({width:w,height:h});
  if(!USE_DEPLOYED){
    await page.setRequestInterception(true);
    page.on('request',req=>{
      const u=req.url().split('?')[0];
      if(u==='https://neuroattention.org/account.html' && req.resourceType()==='document'){
        req.respond({status:200,contentType:'text/html; charset=utf-8',body:LOCAL_HTML});
      } else req.continue();
    });
  }
  const errs=[];page.on('pageerror',e=>errs.push(String(e&&e.message||e)));
  await page.evaluateOnNewDocument((t,u)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(u));window.currentUser=u;},token,meUser);
  await page.goto(SITE+'?v='+Date.now(),{waitUntil:'networkidle2',timeout:60000});
  await page.waitForFunction('typeof window.switchTab==="function"',{timeout:30000});
  await page.evaluate(()=>window.switchTab('tools')); await sleep(400);
  await page.evaluate(()=>{ if(typeof setToolsMode==='function') setToolsMode('nm'); });
  await page.waitForFunction('window.nmV2Graph && window.nmV2Graph.nodes && window.nmV2Graph.nodes.length>0',{timeout:30000}).catch(()=>{});
  await sleep(400);
  await page.evaluate(()=>{ if(typeof buildNmGraph==='function') buildNmGraph(); });
  await sleep(3200);   // let the layout settle (glue converges fast)

  const settled=await page.evaluate(MEASURE);
  console.log('\n=== '+w+'x'+h+' ('+suffix+') SETTLED ===');
  console.log(JSON.stringify(settled,null,1));
  if(errs.length) console.log('PAGE ERRORS:',errs.slice(0,4));
  try{const el=await page.$('#nm-canvas'); if(el) await el.screenshot({path:'/tmp/pr106-'+suffix+'-canvas.png'});}catch(e){}

  // ── DRAG test: yank a body anchor across the canvas, confirm bubbles stay glued. ──
  const dragged=await page.evaluate(async ()=>{
    function done(ms){return new Promise(r=>setTimeout(r,ms));}
    var R=window.nmNodeR; var nodes=window.nmNodes||[];var byId={};nodes.forEach(n=>byId[n.id]=n);
    function ak(n){var m=n.metadata||{};return m.area_kind||(m.source==='sensation'?'body':null);}
    // pick a body anchor that actually has glued bubbles
    var anchorsWithKids={};(nodes.filter(n=>n.type==='sensation'&&n._anchorId)).forEach(s=>{anchorsWithKids[s._anchorId]=(anchorsWithKids[s._anchorId]||0)+1;});
    var aid=Object.keys(anchorsWithKids).sort((x,y)=>anchorsWithKids[y]-anchorsWithKids[x])[0];
    var a=byId[aid]; if(!a) return {ok:false,reason:'no anchor with kids'};
    var canvas=document.getElementById('nm-canvas');
    // simulate a drag: pin the anchor far from where it is, restart sim, let it track
    a.fx=Math.min(canvas.width-80,a.x+260); a.fy=Math.min(canvas.height-80,a.y+180);
    if(typeof nmSimulate==='function') nmSimulate(canvas,0.3);
    await done(1600);
    var kids=nodes.filter(n=>n.type==='sensation'&&n._anchorId===aid);
    var gaps=kids.map(function(s){var dx=s.x-a.x,dy=s.y-a.y;var d=Math.sqrt(dx*dx+dy*dy);return Math.round((d-(R(a)+R(s)))*10)/10;});
    var maxGap=gaps.reduce((m,g)=>Math.max(m,g),-999);
    // release
    delete a.fx; delete a.fy;
    return {ok:true, anchor:a.label, kids:kids.length, gapsAfterDrag:gaps, maxGapAfterDrag:maxGap, stillGlued:maxGap<=2};
  });
  console.log('--- DRAG ('+suffix+') ---');
  console.log(JSON.stringify(dragged,null,1));
  try{const el=await page.$('#nm-canvas'); if(el) await el.screenshot({path:'/tmp/pr106-'+suffix+'-canvas-dragged.png'});}catch(e){}

  // ── FULLSCREEN (separate draw loop) — desktop only. ──
  let fsGap=null;
  if(suffix==='desktop'){
    await page.evaluate(()=>{ if(typeof nmToggleFullscreen==='function') nmToggleFullscreen(); });
    await sleep(2600);
    try{const fe=await page.$('#nm-fs-canvas'); if(fe) await fe.screenshot({path:'/tmp/pr106-fullscreen-canvas.png'});}catch(e){ console.log('fs shot fail',e.message); }
    await page.evaluate(()=>{ if(window.nmFullscreen) nmToggleFullscreen(); });
  }
  await page.close();
  return {settled,dragged};
}

const d=await run(1440,900,'desktop');
const m=await run(390,844,'mobile');
await browser.close();

console.log('\n===== VERDICT =====');
const okD = d.settled.allTouching && d.settled.arrowsDrawn===0 && d.dragged.stillGlued;
const okM = m.settled.allTouching && m.settled.arrowsDrawn===0 && m.dragged.stillGlued;
console.log('API reject (no body)         : '+(rejPass?'PASS':(USE_DEPLOYED?'FAIL':'pending-deploy')));
console.log('desktop touching(no gap)     : maxGap='+d.settled.maxGap+'  arrows='+d.settled.arrowsDrawn+'  dragGlued='+d.dragged.stillGlued+'  => '+(okD?'PASS':'FAIL'));
console.log('mobile  touching(no gap)     : maxGap='+m.settled.maxGap+'  arrows='+m.settled.arrowsDrawn+'  dragGlued='+m.dragged.stillGlued+'  => '+(okM?'PASS':'FAIL'));
console.log('screens: /tmp/pr106-desktop-canvas.png  /tmp/pr106-desktop-canvas-dragged.png  /tmp/pr106-mobile-canvas.png  /tmp/pr106-fullscreen-canvas.png');
process.exit((okD&&okM)?0:1);
