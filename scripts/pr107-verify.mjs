// PR#107 — verify three fixes against PROD data (front-end via the PR#105/#106
// request-interception trick: load neuroattention.org origin so the Railway API CORS
// passes, but fulfil the document with the LOCAL edited account.html so we test the
// front-end WITHOUT deploying).
//   node pr107-verify.mjs            → LOCAL edited account.html (pre-deploy)
//   node pr107-verify.mjs prod       → DEPLOYED account.html (post-deploy)
//
// Coverage:
//   #1 «всё тело» sweep — create a whole_body node + 6 sensations (Tahir's exact
//      scenario), screenshot it, then run migrations (039) and confirm it is GONE.
//      (The migration assertion only PASSES once the PR#107 server is deployed.)
//   #2 snap-back — drag a sensation bubble far off its body part, release, confirm it
//      springs back to touch the body (gap before-release ≫ 0, after-release ≤ ~0).
//   #3 multi-anchor BRIDGE — a sensation on left_arm+right_arm gets _anchorIds.length===2,
//      sits at the centroid, both arms hug it (gap to each ≤ ~0).
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { readFileSync } from 'node:fs';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const USE_DEPLOYED = process.argv[2]==='prod';
const LOCAL_HTML = USE_DEPLOYED ? null : readFileSync(new URL('../account.html', import.meta.url),'utf8');
const OUT = new URL('.', import.meta.url).pathname;
const TAG='pr107v'+Date.now();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const H=t=>({'content-type':'application/json',authorization:'Bearer '+t});

async function mkUser(label){
  const email=TAG+'-'+label+'@test.local';
  const reg=await(await fetch(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({email,password:'Test12345!',display_name:label,country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})})).json();
  if(!reg.token){console.log('FATAL register',label,JSON.stringify(reg));process.exit(1);}
  const me=await(await fetch(AUTH+'/api/auth/me',{headers:H(reg.token)})).json();
  return {email,token:reg.token,user:me.user||me};
}
async function save(token,sensations,body_locations){
  return (await fetch(AUTH+'/api/neuromap/sensation',{method:'POST',headers:H(token),
    body:JSON.stringify({sensations,body_locations,comment:'pr107',
      session_id:TAG+'-'+sensations.join('_')+'-'+body_locations.join('_')})})).json();
}

const browser=await puppeteer.launch({executablePath:CHROME,headless:true,
  args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});

async function openPage(user){
  const page=await browser.newPage();
  await page.setViewport({width:1280,height:900});
  if(!USE_DEPLOYED){
    await page.setRequestInterception(true);
    page.on('request',req=>{
      const u=req.url().split('?')[0];
      if(u==='https://neuroattention.org/account.html' && req.resourceType()==='document'){
        req.respond({status:200,contentType:'text/html; charset=utf-8',body:LOCAL_HTML});
      } else req.continue();
    });
  }
  page.on('pageerror',e=>console.log('  [pageerror]',String(e&&e.message||e)));
  await page.evaluateOnNewDocument((t,u)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(u));window.currentUser=u;},user.token,user.user);
  await page.goto(SITE,{waitUntil:'networkidle2',timeout:60000});
  // open Tools → NeuroMap so the graph builds & nmSimulate runs
  await page.evaluate(()=>{ try{switchTab&&switchTab('tools');}catch(e){} try{setToolsMode&&setToolsMode('nm');}catch(e){} });
  await sleep(1200);
  // ensure the «Ощущения» layer (1) is ON so sensation bubbles render
  await page.evaluate(()=>{ try{ if(window.nmActiveLayers){ window.nmActiveLayers[1]=true; } }catch(e){} });
  await sleep(2500); // let the force layout settle
  return page;
}

// gap = dist(bubble, anchor) − (rAnchor + rBubble): >0 visible gap, ≤0 touching/pressed-in
const NODE_INFO=`(function(){
  var R=window.nmNodeR, nodes=window.nmNodes||[]; var by={}; nodes.forEach(n=>by[n.id]=n);
  function gap(s,aid){var a=by[aid];if(!a)return null;var dx=s.x-a.x,dy=s.y-a.y;return Math.sqrt(dx*dx+dy*dy)-(R(a)+R(s));}
  return {nodes:nodes.map(function(n){return {id:n.id,type:n.type,label:n.label,x:Math.round(n.x),y:Math.round(n.y),
            r:Math.round(R(n)), anchorIds:n._anchorIds||null,
            gaps:(n._anchorIds||[]).map(function(aid){var g=gap(n,aid);return g==null?null:Math.round(g*10)/10;})};}),
          counts:{area:nodes.filter(n=>n.type==='area').length, sensation:nodes.filter(n=>n.type==='sensation').length},
          wholeBody:nodes.filter(n=>n.type==='area'&&/всё тело|whole body|todo el cuerpo/i.test(n.label)).map(n=>n.label)};
})()`;

let PASS=true; const note=(ok,msg)=>{ if(!ok)PASS=false; console.log((ok?'  PASS ':'  FAIL ')+msg); };

// ───────────────────────── #1 «всё тело» sweep ─────────────────────────
console.log('\n=== #1 «всё тело» sweep ('+(USE_DEPLOYED?'DEPLOYED':'LOCAL')+') ===');
const uWB=await mkUser('wb');
for(const s of ['heat','pressure','tingling','pain','cold','warmth']) await save(uWB.token,[s],['whole_body']);
let pWB=await openPage(uWB);
let infoBefore=await pWB.evaluate(NODE_INFO);
console.log('  before: area='+infoBefore.counts.area+' sensation='+infoBefore.counts.sensation+' wholeBodyNodes='+JSON.stringify(infoBefore.wholeBody));
await pWB.screenshot({path:OUT+'pr107-wholebody-before.png'});
note(infoBefore.wholeBody.length>=1, '«всё тело» node present before sweep (created Tahir-style)');
// run the sweep (migration 039) — global, idempotent
const mig=await(await fetch(AUTH+'/api/run-migrations',{method:'POST'})).json();
console.log('  run-migrations →', JSON.stringify(mig));
await pWB.reload({waitUntil:'networkidle2'});
await pWB.evaluate(()=>{ try{switchTab&&switchTab('tools');}catch(e){} try{setToolsMode&&setToolsMode('nm');}catch(e){} });
await sleep(3500);
let infoAfter=await pWB.evaluate(NODE_INFO);
console.log('  after : area='+infoAfter.counts.area+' sensation='+infoAfter.counts.sensation+' wholeBodyNodes='+JSON.stringify(infoAfter.wholeBody));
await pWB.screenshot({path:OUT+'pr107-wholebody-after.png'});
const sweepWorked = infoAfter.wholeBody.length===0;
note(sweepWorked, '0 «всё тело» nodes after migration 039'+(sweepWorked?'':(USE_DEPLOYED?'':' (server 039 not deployed yet — expected in LOCAL)')));
await pWB.close();

// ───────────────────────── #2 snap-back ─────────────────────────
console.log('\n=== #2 snap-back ===');
const uSB=await mkUser('sb');
for(const s of ['heat','pressure','tingling']) await save(uSB.token,[s],['back']);
let pSB=await openPage(uSB);
// pick a sensation bubble with an anchor; drag it to the far corner via real mouse events
const drag=await pSB.evaluate(async ()=>{
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  var R=window.nmNodeR, nodes=window.nmNodes||[]; var by={}; nodes.forEach(n=>by[n.id]=n);
  var s=nodes.find(n=>n.type==='sensation'&&n._anchorId); if(!s) return {err:'no anchored sensation'};
  var a=by[s._anchorId];
  var cv=document.getElementById('nm-canvas'); var rect=cv.getBoundingClientRect();
  var sxScale=rect.width/cv.width, syScale=rect.height/cv.height;
  function client(nx,ny){return {x:rect.left+nx*sxScale, y:rect.top+ny*syScale};}
  function fire(type,pt){cv.dispatchEvent(new MouseEvent(type,{bubbles:true,clientX:pt.x,clientY:pt.y}));}
  function gap(){var dx=s.x-a.x,dy=s.y-a.y;return Math.round((Math.sqrt(dx*dx+dy*dy)-(R(a)+R(s)))*10)/10;}
  var start=client(s.x,s.y);
  var far=client(cv.width-60, 60); // far top-right corner
  fire('mousedown',start);
  for(var i=1;i<=8;i++){ fire('mousemove',{x:start.x+(far.x-start.x)*i/8, y:start.y+(far.y-start.y)*i/8}); await sleep(20); }
  await sleep(150);
  var gapDragged=gap();           // bubble pinned far away → big gap
  fire('mouseup',far);            // release → must snap back
  return {label:s.label,anchor:a.label,gapDragged:gapDragged};
});
console.log('  dragged "'+drag.label+'" off "'+drag.anchor+'": gapWhileDragged='+drag.gapDragged);
await pSB.screenshot({path:OUT+'pr107-snapback-dragged.png'});
await sleep(2500); // let the glue ease it back
const gapAfter=await pSB.evaluate(()=>{
  var R=window.nmNodeR, nodes=window.nmNodes||[]; var by={}; nodes.forEach(n=>by[n.id]=n);
  var s=nodes.find(n=>n.type==='sensation'&&n._anchorId); var a=by[s._anchorId];
  var dx=s.x-a.x,dy=s.y-a.y;return Math.round((Math.sqrt(dx*dx+dy*dy)-(R(a)+R(s)))*10)/10;
});
await pSB.screenshot({path:OUT+'pr107-snapback-released.png'});
await pSB.evaluate(()=>{ try{nmToggleFullscreen&&nmToggleFullscreen();}catch(e){} });
await sleep(2200);
await pSB.screenshot({path:OUT+'pr107-snapback-released-fs.png'});
console.log('  after release: gap='+gapAfter);
note(drag.gapDragged>40, 'bubble was actually pulled far away while dragged (gap>'+40+')');
note(gapAfter<=2, 'bubble snapped back to touch the body after release (gap≤2)');
await pSB.close();

// ───────────────────────── #3 multi-anchor bridge ─────────────────────────
console.log('\n=== #3 multi-anchor bridge (left_arm + right_arm) ===');
const uBR=await mkUser('br');
await save(uBR.token,['tingling'],['left_arm','right_arm']);
let pBR=await openPage(uBR);
const bridge=await pBR.evaluate(()=>{
  var R=window.nmNodeR, nodes=window.nmNodes||[]; var by={}; nodes.forEach(n=>by[n.id]=n);
  var s=nodes.find(n=>n.type==='sensation'); if(!s) return {err:'no sensation'};
  var ids=s._anchorIds||[]; var anchs=ids.map(id=>by[id]).filter(Boolean);
  var gaps=anchs.map(function(a){var dx=s.x-a.x,dy=s.y-a.y;return Math.round((Math.sqrt(dx*dx+dy*dy)-(R(a)+R(s)))*10)/10;});
  // is the bubble between the two anchors? (dot of (a0->s) and (a0->a1) > 0 and < |a0a1|)
  var between=null;
  if(anchs.length===2){
    var a0=anchs[0],a1=anchs[1];
    var cx=(a0.x+a1.x)/2, cy=(a0.y+a1.y)/2;
    between=Math.round(Math.sqrt((s.x-cx)*(s.x-cx)+(s.y-cy)*(s.y-cy)));
  }
  return {label:s.label, anchorLabels:anchs.map(a=>a.label), gaps:gaps, distFromMidpoint:between};
});
console.log('  sensation "'+bridge.label+'" anchors='+JSON.stringify(bridge.anchorLabels));
console.log('  gaps to each anchor='+JSON.stringify(bridge.gaps)+'  distFromMidpoint='+bridge.distFromMidpoint+'px');
await pBR.screenshot({path:OUT+'pr107-bridge.png'});
// fullscreen capture — nodes render ~large so the bridge is clearly visible
await pBR.evaluate(()=>{ try{nmToggleFullscreen&&nmToggleFullscreen();}catch(e){} });
await sleep(2500);
await pBR.screenshot({path:OUT+'pr107-bridge-fs.png'});
note((bridge.anchorLabels||[]).length===2, 'sensation glued to BOTH arms (_anchorIds.length===2)');
note(bridge.gaps && bridge.gaps.every(g=>g!=null && g<=4), 'bubble touches both arms (each gap≤4)');
note(bridge.distFromMidpoint!=null && bridge.distFromMidpoint<=12, 'bubble sits at the centroid between the two arms (≤12px)');
await pBR.close();

await browser.close();
console.log('\n'+(PASS?'✅ ALL PASS':'❌ SOME FAILED')+'  ('+(USE_DEPLOYED?'DEPLOYED':'LOCAL pre-deploy')+')');
process.exit(PASS?0:1);
