// PR#105 — verify the sticky-bubble fix on the LOCAL edited account.html WITHOUT
// deploying, by loading the prod URL (so the page origin is neuroattention.org and
// the Railway API's CORS allows it) but intercepting the document request and
// fulfilling it with the local edited file. Reproduces Tahir's messy data shape
// (multi-anchor sensations + a no-body sensation), renders, introspects the live
// sticky state, and screenshots desktop + mobile.
//   node pr105-verify.mjs            → uses local edited account.html (pre-deploy)
//   node pr105-verify.mjs prod       → uses the deployed account.html (post-deploy)
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { readFileSync } from 'node:fs';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const USE_DEPLOYED = process.argv[2]==='prod';
const LOCAL_HTML = USE_DEPLOYED ? null : readFileSync(new URL('../account.html', import.meta.url),'utf8');
const TAG='pr105v'+Date.now();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const H=t=>({'content-type':'application/json',authorization:'Bearer '+t});

const email=TAG+'@test.local';
const reg=await(await fetch(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email,password:'Test12345!',display_name:'PR105',country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})})).json();
const token=reg.token; if(!token){console.log('FATAL register',JSON.stringify(reg));process.exit(1);}
console.log('user',email,'mode',USE_DEPLOYED?'DEPLOYED':'LOCAL-edited');

// CANONICAL mode = the task's headline test: 5 sensations × 3 body parts, each with a
// body part (zero orphans expected). MESSY mode = Tahir's real shape (multi-anchor +
// a no-body orphan).   node pr105-verify.mjs [prod] [canon]
const CANON = process.argv.includes('canon');
const saves = CANON ? [
  {sensations:['heat'],body_locations:['back']},
  {sensations:['pressure'],body_locations:['back']},
  {sensations:['tingling'],body_locations:['head']},
  {sensations:['pain'],body_locations:['head']},
  {sensations:['cold'],body_locations:['belly']},
] : [
  {sensations:['pressure'],body_locations:['neck']},
  {sensations:['pressure'],body_locations:['back']},
  {sensations:['pressure'],body_locations:['chest']},
  {sensations:['pain'],body_locations:['head']},
  {sensations:['pain'],body_locations:['back']},
  {sensations:['heat'],body_locations:['chest']},
  {sensations:['cold'],body_locations:['belly']},
  {sensations:['tingling'],body_locations:['head']},
  {sensations:['heaviness'],body_locations:[]},   // no body → the genuinely-orphan case
];
for(const s of saves) await(await fetch(AUTH+'/api/neuromap/sensation',{method:'POST',headers:H(token),body:JSON.stringify({...s,comment:'pr105',session_id:TAG+'-'+s.sensations[0]+'-'+(s.body_locations[0]||'x')})})).json();
const me=await(await fetch(AUTH+'/api/auth/me',{headers:H(token)})).json();const meUser=me.user||me;

const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});

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
  await sleep(2800);
  const live=await page.evaluate(()=>{
    function areaKind(n){var m=n.metadata||{};return m.area_kind||(m.source==='sensation'?'body':null);}
    var nodes=window.nmNodes||[],links=window.nmLinks||[];var byId={};nodes.forEach(n=>byId[n.id]=n);
    var sens=nodes.filter(n=>n.type==='sensation');
    var bodyAreas=nodes.filter(n=>n.type==='area'&&areaKind(n)==='body');
    // arrows = links actually DRAWN (not _sensBody) connecting a sensation to a body area
    var arrows=links.filter(l=>{ if(l._sensBody)return false; var s=byId[l.source],t=byId[l.target];if(!s||!t)return false;
      return ((s.type==='sensation'&&t.type==='area'&&areaKind(t)==='body')||(t.type==='sensation'&&s.type==='area'&&areaKind(s)==='body')); })
      .map(l=>{var s=byId[l.source],t=byId[l.target];return s.label+'→'+t.label;});
    // for each sensation that HAS at least one body link, is it anchored (stuck)?
    var sensWithBody=sens.filter(s=>links.some(l=>l._sensBody&&(l.source===s.id||l.target===s.id)));
    var stuckOk=sensWithBody.filter(s=>s._anchorId).length;
    var floatingDespiteBody=sensWithBody.filter(s=>!s._anchorId).map(s=>s.label);
    var noBodyOrphans=sens.filter(s=>!links.some(l=>l._sensBody&&(l.source===s.id||l.target===s.id))).map(s=>s.label);
    return { nodeCount:nodes.length, sensCount:sens.length, bodyAreaCount:bodyAreas.length,
      bodyAreas:bodyAreas.map(a=>a.label),
      sensWithBody:sensWithBody.length, stuckOk, floatingDespiteBody,
      noBodyOrphans, arrowsDrawn:arrows, stickyLinks:links.filter(l=>l._sticky).length,
      sensBodyLinks:links.filter(l=>l._sensBody).length };
  });
  console.log('\n=== '+w+'x'+h+' ('+suffix+') ===');
  console.log(JSON.stringify(live,null,1));
  if(errs.length) console.log('PAGE ERRORS:',errs.slice(0,4));
  await page.screenshot({path:'/tmp/pr105fix-'+suffix+'.png'});
  try{const el=await page.$('#nm-canvas'); if(el) await el.screenshot({path:'/tmp/pr105fix-'+suffix+'-canvas.png'});}catch(e){}
  // FULLSCREEN render path (separate draw loop) — open it and screenshot the FS canvas.
  if(suffix==='desktop'){
    await page.evaluate(()=>{ if(typeof nmToggleFullscreen==='function') nmToggleFullscreen(); });
    await sleep(2500);
    try{const fe=await page.$('#nm-fs-canvas'); if(fe) await fe.screenshot({path:'/tmp/pr105fix-fullscreen-canvas.png'});}catch(e){ console.log('fs shot fail',e.message); }
    await page.evaluate(()=>{ if(window.nmFullscreen) nmToggleFullscreen(); });
  }
  await page.close();
  return live;
}

const d=await run(1440,900,'desktop');
const m=await run(390,844,'mobile');
await browser.close();
console.log('\n===== VERDICT =====');
const okD = d.arrowsDrawn.length===0 && d.floatingDespiteBody.length===0 && d.bodyAreaCount>=3;
const okM = m.arrowsDrawn.length===0 && m.floatingDespiteBody.length===0;
console.log('desktop: arrowsDrawn='+d.arrowsDrawn.length+' stuck='+d.stuckOk+'/'+d.sensWithBody+' bodyAreas='+d.bodyAreaCount+' orphans(no-body)='+JSON.stringify(d.noBodyOrphans)+' => '+(okD?'PASS':'FAIL'));
console.log('mobile : arrowsDrawn='+m.arrowsDrawn.length+' stuck='+m.stuckOk+'/'+m.sensWithBody+' => '+(okM?'PASS':'FAIL'));
console.log('screens: /tmp/pr105fix-desktop-canvas.png  /tmp/pr105fix-mobile-canvas.png');
