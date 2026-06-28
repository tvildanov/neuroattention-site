// PR94 — targeted re-check of #2 (✕ closes) + #9 (header full content) by opening
// the mini-NeuroMap at an exact spine-node coordinate (st._nodes), on mobile touch.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH = 'https://neuroattention-api-production.up.railway.app';
const SITE = 'https://neuroattention.org/account.html';
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const H = t => ({ 'content-type':'application/json', authorization:'Bearer '+t });
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const OUT = process.env.OUT||'/tmp/';
const reg = async (tag)=>{ const email=tag+'-'+Date.now()+Math.floor(Math.random()*1e4)+'@test.local'; const r=await(await fetch(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'Test12345!',display_name:tag,country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})})).json(); return {email,token:r.token}; };
const out={};
const owner=await reg('p94m');
const me=await(await fetch(AUTH+'/api/auth/me',{headers:H(owner.token)})).json(); const meUser=me.user||me;
await fetch(AUTH+'/api/neuromap/v2/append',{method:'POST',headers:H(owner.token),body:JSON.stringify({chain:[
  {type:'emotion',label:'сильная тревога перед сном',valence:'negative'},
  {type:'cause',label:'работа',valence:'neutral'},
  {type:'thought',label:'не успеваю ничего',valence:'negative'}]})});

const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage();
await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message||e)));
await page.evaluateOnNewDocument((t,u)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(u));window.currentUser=u;},owner.token,meUser);
await page.goto(SITE,{waitUntil:'networkidle2',timeout:60000});
await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});
await page.evaluate(()=>{ window.switchTab('evolution'); if(window.evoSwitchSub) window.evoSwitchSub('personal'); });
await sleep(2500);
await page.evaluate(()=>{ const b=[...document.querySelectorAll('.myc-seg[data-seg="period"] button')].find(x=>/Всё|All/i.test(x.textContent)); if(b)b.click(); });
await sleep(1600);

// switch to Layers (which renders real .evo-node DOM nodes) and open via a node click
await page.evaluate(()=>{ const b=[...document.querySelectorAll('.myc-seg[data-seg="mode"] button')].find(x=>/Layers|Слои|Capas/i.test(x.textContent)); if(b)b.click(); });
await sleep(1500);
out.nodeCount = await page.evaluate(()=>document.querySelectorAll('.evo-node').length);
await page.evaluate(()=>{ const n=document.querySelector('.evo-node'); if(n) n.dispatchEvent(new MouseEvent('click',{bubbles:true})); });
await sleep(600);
out.openedByClick = await page.evaluate(()=>!!document.querySelector('.evo-mini-nm'));
out.header = await page.evaluate(()=>{ const t=document.querySelector('.evo-mini-ttl'); return t?t.textContent:null; });
out.headerFull = /тревога перед сном|работа|не успеваю ничего/.test(out.header||'');
await page.screenshot({ path: OUT+'pr94-mini-open.png' });

// #2 — tap the ✕ (touch) and confirm it closes (the mobile-preventDefault bug)
if(await page.evaluate(()=>!!document.querySelector('.evo-mini-nm'))){
  const xr = await page.evaluate(()=>{ const x=document.querySelector('.evo-mini-x'); if(!x) return null; const r=x.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; });
  if(xr){ await page.touchscreen.tap(xr.x, xr.y); await sleep(400); }
  out.closedByTouchTap = await page.evaluate(()=>!document.querySelector('.evo-mini-nm'));
}
await page.screenshot({ path: OUT+'pr94-mini-closed.png' });
out.errs=errs.slice(0,5);
console.log(JSON.stringify(out,null,2));
await browser.close();
