// PR#105 — VISUAL verification of sticky bubbles on real-equivalent data.
// Creates a fresh user, saves 5 sensations × 3 body parts, renders the standalone
// NeuroMap on the given SITE, screenshots the main canvas (desktop + mobile), and
// introspects the LIVE render: floating sensations, sticky links, arrow links.
//   node pr105-shot.mjs [site]   site = prod (default) | local URL
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE=(process.argv[2]||'https://neuroattention.org')+'/account.html';
const TAG=process.argv[3]||('p'+Date.now());
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const H=t=>({'content-type':'application/json',authorization:'Bearer '+t});

async function reg(){
  const email=TAG+'@test.local';
  const r=await(await fetch(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({email,password:'Test12345!',display_name:'PR105',country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})})).json();
  return {token:r.token,email};
}

const {token,email}=await reg();
if(!token){ console.log('FATAL register failed'); process.exit(1); }
console.log('user',email);

// save 5 sensations × 3 body parts
const saves=[
  {sensations:['heat'],body_locations:['back']},
  {sensations:['pressure'],body_locations:['back']},
  {sensations:['tingling'],body_locations:['head']},
  {sensations:['pain'],body_locations:['head']},
  {sensations:['cold'],body_locations:['belly']},
];
for(const s of saves){
  await(await fetch(AUTH+'/api/neuromap/sensation',{method:'POST',headers:H(token),
    body:JSON.stringify({...s,comment:'pr105',session_id:TAG+'-'+s.sensations[0]})})).json();
}
const me=await(await fetch(AUTH+'/api/auth/me',{headers:H(token)})).json();const meUser=me.user||me;

const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});

async function renderAndShoot(w,h,tagSuffix){
  const page=await browser.newPage();
  await page.setViewport({width:w,height:h});
  const errs=[];page.on('pageerror',e=>errs.push(String(e&&e.message||e)));
  await page.evaluateOnNewDocument((t,u)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(u));window.currentUser=u;},token,meUser);
  await page.goto(SITE+'?v='+Date.now(),{waitUntil:'networkidle2',timeout:60000});
  await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});
  await page.evaluate(()=>{ window.switchTab('tools'); });
  await sleep(400);
  await page.evaluate(()=>{ if(typeof setToolsMode==='function') setToolsMode('nm'); });
  // wait for graph fetched + built
  await page.waitForFunction('window.nmV2Graph && window.nmV2Graph.nodes && window.nmV2Graph.nodes.length>0',{timeout:30000}).catch(()=>{});
  await sleep(500);
  await page.evaluate(()=>{ if(typeof buildNmGraph==='function') buildNmGraph(); });
  await sleep(2500); // let the force sim settle
  // introspect live render
  const live=await page.evaluate(()=>{
    function areaKind(n){var m=n.metadata||{};return m.area_kind||(m.source==='sensation'?'body':null);}
    var nodes=window.nmNodes||[],links=window.nmLinks||[];
    var byId={};nodes.forEach(n=>byId[n.id]=n);
    var sens=nodes.filter(n=>n.type==='sensation');
    var areas=nodes.filter(n=>n.type==='area');
    var floating=sens.filter(s=>!s._anchorId).map(s=>s.label);
    var stickyLinks=links.filter(l=>l._sticky).length;
    // arrows = non-sticky links where one end is a sensation and the other an area (these draw a line+arrowhead)
    var arrowSensArea=links.filter(l=>{
      if(l._sticky) return false;
      var s=byId[l.source],t=byId[l.target];if(!s||!t)return false;
      return (s.type==='sensation'&&t.type==='area')||(t.type==='sensation'&&s.type==='area');
    }).map(l=>{var s=byId[l.source],t=byId[l.target];return s.label+'→'+t.label;});
    return {
      activeLayers:window.nmActiveLayers,
      nodeCount:nodes.length, sensCount:sens.length, areaCount:areas.length,
      areaLayers:areas.map(a=>a.label+':L'+a._layer+'('+(areaKind(a)||'?')+')'),
      sensWithAnchor:sens.filter(s=>s._anchorId).length,
      floating, stickyLinks, arrowSensArea
    };
  });
  console.log('\n=== LIVE RENDER '+w+'x'+h+' ('+tagSuffix+') ===');
  console.log(JSON.stringify(live,null,1));
  if(errs.length) console.log('PAGE ERRORS:',errs.slice(0,5));
  // screenshot the canvas region
  const path1='/tmp/pr105-'+tagSuffix+'.png';
  await page.screenshot({path:path1});
  try{
    const el=await page.$('#nm-canvas');
    if(el) await el.screenshot({path:'/tmp/pr105-'+tagSuffix+'-canvas.png'});
  }catch(e){ console.log('canvas shot failed',e.message); }
  await page.close();
  return live;
}

const desk=await renderAndShoot(1440,900,'desktop');
const mob=await renderAndShoot(390,844,'mobile');
await browser.close();

console.log('\n===== VERDICT =====');
const okDesk = desk.floating.length===0 && desk.arrowSensArea.length===0 && desk.areaCount===3;
const okMob  = mob.floating.length===0 && mob.arrowSensArea.length===0;
console.log('desktop: floating='+desk.floating.length+' arrows='+desk.arrowSensArea.length+' areas='+desk.areaCount+' sticky='+desk.stickyLinks+' => '+(okDesk?'PASS':'FAIL'));
console.log('mobile : floating='+mob.floating.length+' arrows='+mob.arrowSensArea.length+' areas='+mob.areaCount+' sticky='+mob.stickyLinks+' => '+(okMob?'PASS':'FAIL'));
console.log('screens: /tmp/pr105-desktop.png /tmp/pr105-desktop-canvas.png /tmp/pr105-mobile.png /tmp/pr105-mobile-canvas.png');
