// PR93 pt2 — verify on LIVE prod:
//  Item 3 — spine cluster fan-out: a 6-node chain logged in one session must yield
//    multiple INDIVIDUALLY-tappable nodes on the Personal Path (not one stacked dot).
//  Item 4 — sensation content: drill-down shows real text ("тепло в плечах").
//  Item 5 — Layers: per-layer colours (multiple distinct fills), valence rings,
//    wheel zoom changes the time window.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH = 'https://neuroattention-api-production.up.railway.app';
const SITE = 'https://neuroattention.org/account.html';
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const H = t => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/';

const reg = await (await fetch(AUTH + '/api/auth/register', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email:'p93b-'+Date.now()+'@test.local', password:'Test12345!', display_name:'P93B', country:'RU', city:'Moscow', location_lat:55.75, location_lon:37.62 })})).json();
const token = reg.token;
const me = await (await fetch(AUTH+'/api/auth/me',{headers:H(token)})).json();
const meUser = me.user||me;
// Tahir's scenario: several entries logged at the SAME instant. Logged as SEPARATE
// single-node appends → distinct same-anchorT components that, pre-fix, collapse onto
// one un-tappable dot. Each is its own root so each is reliably tappable post-fix.
const singles = [
  { type:'emotion', label:'тревога',        valence:'negative' },
  { type:'area',    label:'тепло в плечах', valence:'neutral'  },
  { type:'thought', label:'не успеваю',     valence:'negative' },
  { type:'cause',   label:'дедлайн',        valence:'negative' },
  { type:'emotion', label:'спокойствие',    valence:'positive' },
];
const occurred_at = new Date().toISOString();
for (const n of singles) await fetch(AUTH+'/api/neuromap/v2/append', { method:'POST', headers:H(token), body: JSON.stringify({ chain:[n], occurred_at }) });

const out = {};
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1440,1100'] });
const page = await browser.newPage();
await page.setViewport({ width:1440, height:1100 });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message||e)));
await page.evaluateOnNewDocument((t,u)=>{ localStorage.setItem('na_token',t); localStorage.setItem('na_user',JSON.stringify(u)); window.currentUser=u; }, token, meUser);
await page.goto(SITE,{waitUntil:'networkidle2',timeout:60000});
await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});

// ════ ITEM 3 — Personal Path fan-out ════
await page.evaluate(()=>{ window.switchTab('evolution'); if (typeof window.evoSwitchSub==='function') window.evoSwitchSub('personal'); });
await sleep(2500);
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button,[data-val]')].find(x=>/^all$|Всё|Все/i.test(x.textContent.trim())); if(b) b.click(); });
await sleep(1800);
const rect = await page.evaluate(()=>{ const c=document.querySelector('.evo-stage canvas')||document.querySelector('canvas'); if(!c)return null; const r=c.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; });
// probe a grid of click points; each opened mini's hub label = the tapped event.
// distinct hub labels ⇒ the stacked cluster is now individually tappable.
const hubLabels = new Set();
for (let fx=0.78; fx<=0.99; fx+=0.012){
  for (const fy of [0.5,0.42,0.58,0.36,0.64,0.3,0.7]){
    await page.mouse.click(rect.x+rect.w*fx, rect.y+rect.h*fy); await sleep(45);
    const hub = await page.evaluate(()=>{ const b=document.querySelector('.evo-mini-nm'); if(!b) return null;
      const hubNode=b.querySelector('.evo-mini-node.is-hub .evo-mini-label'); return hubNode?hubNode.textContent:null; });
    if (hub) { hubLabels.add(hub); await page.evaluate(()=>{ const x=document.querySelector('.evo-mini-x'); if(x) x.click(); }); await sleep(60); }
  }
}
out.fanDistinctTappable = [...hubLabels];
out.item3_fanOut = hubLabels.size >= 4;          // ≥4 of the 5 same-instant entries separately tappable
await page.screenshot({ path: OUT+'pr93b-spine.png' });

// ════ ITEM 4 — sensation real content in drill-down ════
out.item4_sensationContent = [...hubLabels].some(l=>/тепло/.test(l));

// ════ ITEM 5 — Layers tab ════
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button,[data-val]')].find(x=>/Layers|Слои|Capas/i.test(x.textContent)); if(b) b.click(); });
await sleep(1800);
const layers = await page.evaluate(()=>{
  const svg = document.querySelector('.evo-stage svg'); if(!svg) return null;
  const circles=[...svg.querySelectorAll('circle')];
  const fills = new Set(circles.map(c=>c.getAttribute('fill')).filter(f=>f && f!=='none'));
  const rings = circles.filter(c=>{ const s=c.getAttribute('stroke')||''; return /240,110,90|120,240,170/.test(s); }).length;
  const laneLabelFills = new Set([...svg.querySelectorAll('.myc-lane-label')].map(t=>t.getAttribute('fill')).filter(Boolean));
  const axis = [...svg.querySelectorAll('.evo-axis-label')].map(t=>t.textContent).join('|');
  return { distinctFills:[...fills].length, valenceRings:rings, distinctLaneFills:[...laneLabelFills].length, axis };
});
out.item5b_distinctColors = layers && (layers.distinctFills >= 2 || layers.distinctLaneFills >= 3);
out.item5c_valenceRings = layers && layers.valenceRings >= 1;
await page.screenshot({ path: OUT+'pr93b-layers.png' });
// zoom: wheel over the layers svg should change the time window (axis labels change)
const axisBefore = layers && layers.axis;
await page.evaluate(()=>{ const svg=document.querySelector('.evo-stage svg'); if(svg){ const r=svg.getBoundingClientRect();
  svg.dispatchEvent(new WheelEvent('wheel',{deltaY:-300,clientX:r.left+r.width*0.6,clientY:r.top+r.height*0.5,bubbles:true,cancelable:true})); } });
await sleep(900);
const axisAfter = await page.evaluate(()=>{ const svg=document.querySelector('.evo-stage svg'); if(!svg) return null;
  return [...svg.querySelectorAll('.evo-axis-label')].map(t=>t.textContent).join('|'); });
out.item5a_zoomChangesWindow = !!(axisBefore && axisAfter && axisBefore !== axisAfter);
out.axisBefore = axisBefore; out.axisAfter = axisAfter;
await page.screenshot({ path: OUT+'pr93b-layers-zoom.png' });

out.errs = errs.slice(0,6);
console.log(JSON.stringify(out, null, 2));
await browser.close();
