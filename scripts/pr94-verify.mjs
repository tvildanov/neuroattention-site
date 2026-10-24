// PR94 — verify on LIVE prod (mobile viewport, real screenshots).
//  #1 spine: every component anchor sits ON the spine baseline (no compOff float).
//  #2 popup ✕ closes the mini-NeuroMap; #9 header carries the full hub content.
//  #3 family: ✕ Remove shows on a 'son' member card + removal drops it; no remove/
//     no kin-tag on the own '(you)' card.
//  #4 area node "отношения" shows type "Сфера жизни" (not "Ощущение"); real
//     sensation still "тепло…".
//  #5d/#5c standalone NeuroMap: a future-only date range empties the graph; clearing
//     restores it.  #7 wheel-zoom lights up a different period button.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH = 'https://neuroattention-api-production.up.railway.app';
const SITE = 'https://neuroattention.org/account.html';
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const H = t => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/';
const reg = async (tag) => {
  const email = tag + '-' + Date.now() + Math.floor(Math.random()*1e4) + '@test.local';
  const r = await (await fetch(AUTH + '/api/auth/register', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email, password:'Test12345!', display_name: tag, country:'RU', city:'Moscow', location_lat:55.75, location_lon:37.62 })})).json();
  return { email, token: r.token };
};
const out = {};

const owner = await reg('p94-own');
const nick  = await reg('p94-nick');
const me = await (await fetch(AUTH+'/api/auth/me',{headers:H(owner.token)})).json();
const meUser = me.user||me;

// chain (тревога→работа→не успеваю) + an area node "отношения" + a real sensation
await fetch(AUTH+'/api/neuromap/v2/append',{method:'POST',headers:H(owner.token),body:JSON.stringify({chain:[
  {type:'emotion',label:'тревога',valence:'negative'},
  {type:'cause',label:'работа',valence:'neutral'},
  {type:'thought',label:'не успеваю',valence:'negative'}]})});
await fetch(AUTH+'/api/neuromap/v2/append',{method:'POST',headers:H(owner.token),body:JSON.stringify({chain:[{type:'area',label:'отношения',valence:'neutral'}]})});
await fetch(AUTH+'/api/neuromap/sensation',{method:'POST',headers:H(owner.token),body:JSON.stringify({sensations:['warmth'],body_locations:['chest']})});
// family + nick as 'son'
const fam = await (await fetch(AUTH+'/api/teams',{method:'POST',headers:H(owner.token),body:JSON.stringify({name:'Семья',kind:'family',my_role:'father'})})).json();
const famId=(fam.team&&fam.team.id)||fam.id;
await fetch(AUTH+`/api/teams/${famId}/members`,{method:'POST',headers:H(owner.token),body:JSON.stringify({email:nick.email,role:'son'})});

const browser = await puppeteer.launch({ executablePath: CHROME, headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width:390, height:844, isMobile:true, hasTouch:true });   // iPhone-ish
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message||e)));
page.on('dialog', async d=>{ try{ await d.accept(); }catch(e){} });
await page.evaluateOnNewDocument((t,u)=>{ localStorage.setItem('na_token',t); localStorage.setItem('na_user',JSON.stringify(u)); window.currentUser=u; }, owner.token, meUser);
await page.goto(SITE,{waitUntil:'networkidle2',timeout:60000});
await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});
out.liveVer = await page.evaluate(()=>{ const s=[...document.scripts].find(x=>/evolution-path\.js/.test(x.src)); return s?s.src.replace(/.*\?v=/,''):'?'; });

// ════ #1 spine anchors ON the baseline ════
await page.evaluate(()=>{ window.switchTab('evolution'); if(window.evoSwitchSub) window.evoSwitchSub('personal'); });
await sleep(2500);
await page.evaluate(()=>{ const b=[...document.querySelectorAll('.myc-seg[data-seg="period"] button')].find(x=>/Всё|All/i.test(x.textContent)); if(b)b.click(); });
await sleep(1600);
out.spine = await page.evaluate(()=>{
  const c=[...document.querySelectorAll('div')].map(d=>d.__evo).find(Boolean) || (document.querySelector('.myc-evo-canvas')&&document.querySelector('.myc-evo-canvas').parentElement.__evo);
  // find the container with __evo
  let cont=null; document.querySelectorAll('*').forEach(n=>{ if(n.__evo&&n.__evo._tunnel) cont=n; });
  const st=cont&&cont.__evo; const T=st&&st._tunnel; if(!T) return {err:'no tunnel'};
  const cy=T.cy; const vcs=st._visComps||[];
  const offs=vcs.map(v=>Math.abs(v.ay - cy));
  return { comps:vcs.length, maxAnchorOffset: offs.length?Math.max(...offs):0, cy };
});
await page.screenshot({ path: OUT+'pr94-spine.png' });

// ════ open mini → #9 header full text, #4 type label, #2 close ════
const rect = await page.evaluate(()=>{ const c=document.querySelector('.evo-stage canvas')||document.querySelector('canvas'); const r=c.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; });
let opened=false;
outer: for (const fy of [0.5,0.45,0.55,0.4,0.6]) for (let fx=0.96; fx>=0.05; fx-=0.02){
  await page.mouse.click(rect.x+rect.w*fx, rect.y+rect.h*fy); await sleep(45);
  if (await page.evaluate(()=>!!document.querySelector('.evo-mini-nm'))) { opened=true; break outer; }
}
out.miniOpened = opened;
out.miniHeader = await page.evaluate(()=>{ const t=document.querySelector('.evo-mini-ttl'); return t?t.textContent:null; });
out.miniHeaderHasContent = /тревога|работа|не успеваю|отношения|тепло/.test(out.miniHeader||'');
await page.screenshot({ path: OUT+'pr94-mini.png' });
// #2 close via the ✕
out.closeWorks = await page.evaluate(()=>{ const x=document.querySelector('.evo-mini-x'); if(!x) return 'no-x'; x.click(); return !document.querySelector('.evo-mini-nm'); });

// ════ #4 area→Сфера жизни in mini caption ════
// open the area node: walk all nodes' detail by reading the evolution data the page holds
out.sphereLabel = await page.evaluate(()=>{
  let cont=null; document.querySelectorAll('*').forEach(n=>{ if(n.__evo&&n.__evo.data) cont=n; });
  const data=cont&&cont.__evo.data; if(!data) return {err:'no data'};
  const sens=(data.layers&&data.layers.sensation)||[];
  return sens.map(s=>({label:s.label, kind:s.kind}));
});

// ════ #7 wheel-zoom lights a different period button ════
await page.evaluate(()=>{ window.location.hash=''; });
const periodBefore = await page.evaluate(()=>{ const b=document.querySelector('.myc-seg[data-seg="period"] button.is-active'); return b?b.textContent:null; });
// switch to Layers, then wheel-zoom
await page.evaluate(()=>{ const b=[...document.querySelectorAll('.myc-seg[data-seg="mode"] button')].find(x=>/Layers|Слои|Capas/i.test(x.textContent)); if(b)b.click(); });
await sleep(1200);
const lrect = await page.evaluate(()=>{ const c=document.querySelector('.evo-stage svg')||document.querySelector('svg'); const r=c.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; });
for(let i=0;i<14;i++){ await page.mouse.move(lrect.x+lrect.w*0.6, lrect.y+lrect.h*0.5); await page.mouse.wheel({deltaY:-120}); await sleep(60); }
await sleep(800);
out.periodBefore=periodBefore;
out.periodAfterZoom = await page.evaluate(()=>{ const b=document.querySelector('.myc-seg[data-seg="period"] button.is-active'); return b?b.textContent:null; });
out.periodSynced = out.periodBefore !== out.periodAfterZoom;
await page.screenshot({ path: OUT+'pr94-layers-zoom.png' });

// ════ #3 family remove ════
await page.evaluate(()=>{ if(window.evoSwitchSub) window.evoSwitchSub('family'); });
await sleep(1800);
out.family = await page.evaluate((nm)=>{
  const cards=[...document.querySelectorAll('.ft-card')];
  const nickCard=cards.find(c=>(c.querySelector('.ft-name')||{}).textContent && c.querySelector('.ft-name').textContent.includes(nm));
  const youCard=cards.find(c=>/вы|you|tú/i.test((c.querySelector('.ft-chip')||{}).textContent||''));
  return {
    nickShown: !!nickCard,
    removeOnNick: !!(nickCard && nickCard.querySelector('.ft-del-mem')),
    noRemoveOnYou: youCard ? !youCard.querySelector('.ft-del-mem') : 'no-you-card',
    youHasNoKinTag: youCard ? !((youCard.querySelector('.ft-tags')||{}).textContent||'').trim() : 'n/a'
  };
}, 'p94-nick');
await page.screenshot({ path: OUT+'pr94-family-before.png' });
await page.evaluate(()=>{ const b=document.querySelector('.ft-del-mem'); if(b) b.click(); });
await sleep(2200);
out.family.removedAfter = await page.evaluate((nm)=>![...document.querySelectorAll('.ft-card .ft-name')].some(n=>n.textContent.includes(nm)), 'p94-nick');
await page.screenshot({ path: OUT+'pr94-family-after.png' });

// ════ #5d/#5c standalone NeuroMap date filter ════
await page.evaluate(()=>{ window.switchTab('tools'); if(window.setToolsMode) window.setToolsMode('nm'); });
await sleep(2500);
out.nm = await page.evaluate(()=>{
  const cntNodes=()=> (window.nmNodes||[]).length;
  const baseAll = (function(){ if(window.setNmView){ window.setNmView('all'); } return cntNodes(); })();
  // future-only custom range → should empty
  const f=document.getElementById('nm-date-from'), t=document.getElementById('nm-date-to');
  let future='';
  if(f&&t){ const d=new Date(); d.setDate(d.getDate()+5); future=d.toISOString().slice(0,10); f.value=future; t.value=future; if(window.nmApplyDateRange) window.nmApplyDateRange(); }
  const afterFuture=cntNodes();
  const emptyShown = (document.getElementById('nm-empty')||{}).style ? document.getElementById('nm-empty').style.display!=='none' : null;
  if(window.nmClearDateRange) window.nmClearDateRange();
  const afterClear=cntNodes();
  return { baseAll, afterFuture, emptyShown, afterClear, hasPicker: !!(f&&t) };
});
await page.screenshot({ path: OUT+'pr94-nm-filter.png' });

out.errs = errs.slice(0,8);
console.log(JSON.stringify(out, null, 2));
await browser.close();
