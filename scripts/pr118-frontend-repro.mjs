// PR#118 — render the LIVE prod NeuroMap with a fresh user + 3 flows, capture
// console errors, nmNodes/nmLinks counts, and a screenshot. Confirms whether the
// shipped frontend draws chain links.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const OUT=new URL('.',import.meta.url).pathname;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const H=t=>({'content-type':'application/json',authorization:'Bearer '+t});
async function j(u,o){ const r=await fetch(u,o); const t=await r.text(); try{return JSON.parse(t);}catch(e){return {raw:t};} }
async function freshUser(){ const email='pr118fe'+Date.now()+'@test.local';
  const reg=await j(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({email,password:'Test12345!',display_name:'fe',country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})});
  const me=await j(AUTH+'/api/auth/me',{headers:H(reg.token)}); return {tok:reg.token,user:me.user||me,email}; }
async function append(tok,sid,chain){ return j(AUTH+'/api/neuromap/v2/append',{method:'POST',headers:H(tok),body:JSON.stringify({session_id:sid,chain})}); }

const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});

const u=await freshUser();
console.log('user', u.email);
// three flows
await append(u.tok,'s'+Date.now()+'A',[
  {type:'area',label:'грудь',valence:'neutral',metadata:{area_kind:'body',source:'sensation'}},
  {type:'sensation',label:'тепло',valence:'positive',metadata:{source:'sensation'}},
  {type:'emotion',label:'спокойствие',valence:'positive',metadata:{}}]);
await append(u.tok,'s'+Date.now()+'B',[
  {type:'emotion',label:'тревога',valence:'negative',metadata:{}},
  {type:'cause',label:'работа',valence:'neutral',metadata:{}},
  {type:'thought',label:'я не справлюсь',valence:'negative',metadata:{}}]);
await append(u.tok,'s'+Date.now()+'C',[
  {type:'area',label:'живот',valence:'neutral',metadata:{area_kind:'body',source:'sensation'}},
  {type:'sensation',label:'тепло',valence:'positive',metadata:{source:'sensation'}},
  {type:'emotion',label:'спокойствие',valence:'positive',metadata:{}}]);

const page=await browser.newPage();
await page.setViewport({width:1366,height:900});
const errs=[];
page.on('console',m=>{ if(m.type()==='error'||m.type()==='warning') errs.push('['+m.type()+'] '+m.text()); });
page.on('pageerror',e=>errs.push('[pageerror] '+e.message));
await page.evaluateOnNewDocument((t,us)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(us));window.currentUser=us;},u.tok,u.user);
await page.goto(SITE+'?v='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction('typeof window.buildNmGraph === "function"',{timeout:30000});
// go to NeuroMap, all view
await page.evaluate(()=>{ window.switchTab('tools'); if(window.setToolsMode) window.setToolsMode('nm'); });
await sleep(900);
await page.evaluate(async()=>{ if(window.nmLoadV2Graph) await window.nmLoadV2Graph(); });
await sleep(1200);
await page.evaluate(()=>{ try{ if(window.setNmView) setNmView('all'); }catch(e){} try{ buildNmGraph(); }catch(e){} });
await sleep(2600);

const diag=await page.evaluate(()=>({
  v2nodes: window.nmV2Graph?window.nmV2Graph.nodes.length:-1,
  v2links: window.nmV2Graph?window.nmV2Graph.links.length:-1,
  v2chains: (window.nmV2Graph&&window.nmV2Graph.chains)?window.nmV2Graph.chains.length:-1,
  nmNodes: window.nmNodes?window.nmNodes.length:-1,
  nmLinks: window.nmLinks?window.nmLinks.length:-1,
  activeLayers: window.nmActiveLayers
}));
console.log('DIAG', JSON.stringify(diag,null,1));
console.log('ERRORS/WARN ('+errs.length+'):'); errs.slice(0,25).forEach(e=>console.log('  '+e));
await page.screenshot({path:OUT+'pr118-prod-current-allview.png'});
console.log('screenshot pr118-prod-current-allview.png');
await browser.close();
