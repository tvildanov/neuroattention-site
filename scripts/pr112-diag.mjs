// PR#112 diagnostic — capture CURRENT prod state for issues 2 & 4.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const OUT=new URL('.',import.meta.url).pathname;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const H=t=>({'content-type':'application/json',authorization:'Bearer '+t});
async function j(u,o){ const r=await fetch(u,o); const t=await r.text(); try{return JSON.parse(t);}catch(e){return {raw:t};} }

const TAG='pr112d'+Date.now();
const email=TAG+'@test.local';
const reg=await j(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email,password:'Test12345!',display_name:'pr112',country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})});
const tok=reg.token; const me=await j(AUTH+'/api/auth/me',{headers:H(tok)}); const meUser=me.user||me;

// ── Issue 4: one sensation (жар @ грудная клетка) then dump the Path ──
const S1=TAG+'-s1';
const sres=await j(AUTH+'/api/neuromap/sensation',{method:'POST',headers:H(tok),
  body:JSON.stringify({sensations:['heat'],body_locations:['chest'],loc_labels:{chest:'грудная клетка'},intensity:6,comment:'',session_id:S1,occurred_at:new Date(Date.now()-3600000).toISOString()})});
console.log('sensation save:',JSON.stringify(sres));
await sleep(400);
const evo=await j(AUTH+'/api/users/me/evolution?period=all',{headers:H(tok)});
console.log('\n── Path sensation layer (Issue 4) ──');
(evo.layers&&evo.layers.sensation||[]).forEach(e=>console.log(`  [${e.kind}] "${e.label}" nm_type=${e.nm_type} area_kind=${e.area_kind} src=${e.source}`));
console.log('insight layer:',(evo.layers&&evo.layers.insight||[]).map(e=>e.label).join(' | ')||'(empty)');
console.log('flat events:',(evo.events||[]).map(e=>e.layer+':'+e.label).join(' | '));
console.log('journey_links:',(evo.links||[]).length);

// ── Issue 2: screenshot the CURRENT sensation overlay ──
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage();
await page.setViewport({width:1366,height:900});
await page.evaluateOnNewDocument((t,u)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(u));window.currentUser=u;},tok,meUser);
await page.goto(SITE+'?v='+Date.now(),{waitUntil:'networkidle2',timeout:60000});
await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});
await page.evaluate(()=>{ window.switchTab('tools'); if(window.setToolsMode) window.setToolsMode('nm'); });
await sleep(900);
await page.evaluate(()=>{ if(window.nmOpenSensationOverlay) window.nmOpenSensationOverlay(); });
await sleep(1500);
// measure overlap: footer rect vs body-picker stage rect
const geo=await page.evaluate(()=>{
  const split=document.querySelector('.nm-fs-split');
  const form=document.querySelector('.nm-fs-split .nm-fs-form');
  const live=document.querySelector('.nm-fs-split .nm-fs-live');
  const footer=form&&form.querySelector('div[id]')?null:null;
  const foot=Array.from(document.querySelectorAll('.nm-fs-form > div')).find(d=>d.querySelector('#nm-sens-save-exit'));
  const stage=document.querySelector('#tools-sensation-wrap .bp-stage')||document.querySelector('#tools-sensation-wrap svg')||document.querySelector('#tools-sensation-wrap');
  const r=el=>el?el.getBoundingClientRect():null;
  const fr=r(foot), sr=r(stage), formr=r(form), liver=r(live);
  return {
    formW:formr&&Math.round(formr.width), liveW:liver&&Math.round(liver.width),
    livePct:formr&&liver?Math.round(100*liver.width/(formr.width+liver.width)):null,
    footTop:fr&&Math.round(fr.top), footBottom:fr&&Math.round(fr.bottom),
    stageBottom:sr&&Math.round(sr.bottom), stageTop:sr&&Math.round(sr.top),
    overlap: (fr&&sr)? Math.round(sr.bottom-fr.top) : null  // >0 = body extends under buttons
  };
});
console.log('\n── Sensation overlay geometry (Issue 2) ──');
console.log(JSON.stringify(geo,null,0));
console.log('livePct:',geo.livePct,'% (want ~50)  body-under-buttons overlap px:',geo.overlap,'(want <=0)');
await page.screenshot({path:OUT+'pr112-issue2-before.png'});
console.log('\nshot: pr112-issue2-before.png  user:',email);
await browser.close();
