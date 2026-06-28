// PR94 #10 — verify the standalone NeuroMap "Ощущения" (sensation, layer 1) layer is
// populated AND visible (cyan, not dark). Saves a sensation, opens the tool, isolates
// layer 1, confirms sensation nodes exist + render cyan.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const H=t=>({'content-type':'application/json',authorization:'Bearer '+t});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const OUT=process.env.OUT||'/tmp/';
const reg=async tag=>{const email=tag+'-'+Date.now()+Math.floor(Math.random()*1e4)+'@test.local';const r=await(await fetch(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'Test12345!',display_name:tag,country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})})).json();return{email,token:r.token};};
const out={};
const o=await reg('p94s');
const me=await(await fetch(AUTH+'/api/auth/me',{headers:H(o.token)})).json();const meUser=me.user||me;
// save sensations (тепло, напряжение @ грудь, голова)
await fetch(AUTH+'/api/neuromap/sensation',{method:'POST',headers:H(o.token),body:JSON.stringify({sensations:['warmth','tension'],body_locations:['chest','head']})});
// a couple more chains so the graph isn't trivial
await fetch(AUTH+'/api/neuromap/v2/append',{method:'POST',headers:H(o.token),body:JSON.stringify({chain:[{type:'emotion',label:'спокойствие',valence:'positive'},{type:'area',label:'работа',valence:'neutral'}]})});

const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage();
await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message||e)));
await page.evaluateOnNewDocument((t,u)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(u));window.currentUser=u;},o.token,meUser);
await page.goto(SITE,{waitUntil:'networkidle2',timeout:60000});
await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});
await page.evaluate(()=>{ window.switchTab('tools'); if(window.setToolsMode) window.setToolsMode('nm'); });
await sleep(2500);
await page.evaluate(()=>{ if(window.setNmView) window.setNmView('all'); });
await sleep(1500);

// sensation nodes present + their colour
out.allNodes = await page.evaluate(()=>{
  const byType={}; (window.nmNodes||[]).forEach(n=>{byType[n.type]=(byType[n.type]||0)+1;});
  const sens=(window.nmNodes||[]).filter(n=>n.type==='sensation');
  const colors = sens.map(n=> window.nmGetNodeColor ? window.nmGetNodeColor(n) : '?');
  return { byType, sensCount:sens.length, sensColors:[...new Set(colors)], sensLabels: sens.map(n=>n.label) };
});
await page.screenshot({ path: OUT+'pr94-nm-all.png' });

// isolate layer 1 (Ощущения): turn off layers 2..6, keep 1
await page.evaluate(()=>{
  window.nmActiveLayers={1:true,2:false,3:false,4:false,5:false,6:false};
  // reflect into checkboxes if present
  document.querySelectorAll('#nm-filters input[data-layer]').forEach(cb=>{ const l=cb.getAttribute('data-layer'); if(l!=='repeat') cb.checked = (parseInt(l)===1); });
  if(window.buildNmGraph) window.buildNmGraph();
});
await sleep(1200);
out.isolatedLayer1 = await page.evaluate(()=>{
  const vis=(window.nmNodes||[]);
  return { renderedCount: vis.length, allSensation: vis.every(n=>n.type==='sensation'), labels: vis.map(n=>n.label),
           emptyShown: (document.getElementById('nm-empty')||{}).style ? document.getElementById('nm-empty').style.display!=='none' : null };
});
await page.screenshot({ path: OUT+'pr94-nm-sensation-only.png' });
out.errs=errs.slice(0,5);
console.log(JSON.stringify(out,null,2));
await browser.close();
