// PR93 — verify on LIVE prod:
//  Task 2 (mini-Neuromap drill-down): log a chain тревога→работа→не успеваю,
//    open Personal Path, click the spine chain → mini-Neuromap shows REAL content
//    (not "эмоция/событие" placeholders), nodes are walkable (click a satellite to
//    re-centre), and the same works on the Layers tab.
//  Task 1 (legacy member removal): owner sees a ✕ Remove button on an adult member
//    card (not on their own), and removal drops the card.
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

const out = { task2: {}, task1: {} };

// ── owner + a second adult to add as a member ──
const owner = await reg('p93-own');
const other = await reg('p93-mem');
const me = await (await fetch(AUTH+'/api/auth/me',{headers:H(owner.token)})).json();
const meUser = me.user||me;

// log the chain on the owner
const chain = [
  { type:'emotion', label:'тревога', valence:'negative' },
  { type:'cause',   label:'работа',  valence:'neutral' },
  { type:'thought', label:'не успеваю', valence:'negative' },
];
await fetch(AUTH+'/api/neuromap/v2/append', { method:'POST', headers:H(owner.token), body: JSON.stringify({ chain }) });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1440,1100'] });
const page = await browser.newPage();
await page.setViewport({ width:1440, height:1100 });
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message||e)));
await page.evaluateOnNewDocument((t,u)=>{ localStorage.setItem('na_token',t); localStorage.setItem('na_user',JSON.stringify(u)); window.currentUser=u; }, owner.token, meUser);
await page.goto(SITE,{waitUntil:'networkidle2',timeout:60000});
await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});

// ════ TASK 2a — Personal Path drill-down ════
await page.evaluate(()=>{ window.switchTab('evolution'); if (typeof window.evoSwitchSub==='function') window.evoSwitchSub('personal'); });
await sleep(2500);
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button,[data-period]')].find(x=>/^all$|Всё|Все/i.test(x.textContent.trim())); if(b) b.click(); });
await sleep(1800);
const rect = await page.evaluate(()=>{ const c=document.querySelector('.evo-stage canvas')||document.querySelector('canvas'); if(!c)return null; const r=c.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; });
let opened=false;
outer: for (const fy of [0.5,0.45,0.55,0.4,0.6]) for (let fx=0.96; fx>=0.05; fx-=0.02){
  await page.mouse.click(rect.x+rect.w*fx, rect.y+rect.h*fy); await sleep(55);
  if (await page.evaluate(()=>!!document.querySelector('.evo-mini-nm'))) { opened=true; break outer; }
}
const readMini = () => page.evaluate(()=>{
  const box=document.querySelector('.evo-mini-nm'); if(!box) return null;
  return { labels:[...box.querySelectorAll('.evo-mini-label')].map(t=>t.textContent),
           caps:[...box.querySelectorAll('.evo-mini-typecap')].map(t=>t.textContent),
           satellites: box.querySelectorAll('.evo-mini-node:not(.is-hub)').length };
});
out.task2.pathOpened = opened;
out.task2.miniFirst = await readMini();
await page.screenshot({ path: OUT+'pr93-path-mini.png' });
// WALK: click a satellite node → re-centre, collect labels seen across the walk
const seen = new Set((out.task2.miniFirst?.labels)||[]);
for (let hop=0; hop<3; hop++){
  const clicked = await page.evaluate(()=>{ const s=document.querySelector('.evo-mini-node:not(.is-hub)'); if(!s) return false; s.dispatchEvent(new MouseEvent('click',{bubbles:true})); return true; });
  if(!clicked) break; await sleep(500);
  const m = await readMini(); if(m) m.labels.forEach(l=>seen.add(l));
}
out.task2.walkSeen = [...seen];
out.task2.allThreeReachable = ['тревога','работа','не успеваю'].every(x=>seen.has(x));
out.task2.noPlaceholders = !out.task2.miniFirst?.labels?.some(l=>/^Эмоция$|^Событие$|^Мысль$|^Emotion$|^Event$|^Thought$/i.test(l));

// ════ TASK 2b — Layers tab drill-down ════
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button,[data-view],[data-mode]')].find(x=>/Layers|Слои|Capas/i.test(x.textContent)); if(b) b.click(); });
await sleep(1800);
const layClick = await page.evaluate(()=>{ const n=document.querySelector('.evo-node'); if(!n) return false; n.dispatchEvent(new MouseEvent('click',{bubbles:true})); return true; });
await sleep(700);
out.task2.layersOpened = await page.evaluate(()=>!!document.querySelector('.evo-mini-nm'));
out.task2.layersMini = await readMini();
await page.screenshot({ path: OUT+'pr93-layers-mini.png' });

// ════ TASK 1 — legacy member removal ════
await page.evaluate(()=>{ if (typeof window.evoSwitchSub==='function') window.evoSwitchSub('family'); });
await sleep(1500);
const click = sel => page.evaluate(s=>{ const e=document.querySelector(s); if(e){e.click();return true;} return false; }, sel);
const setVal = (sel,v) => page.evaluate((s,val)=>{ const e=document.querySelector(s); if(!e)return false; e.value=val; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true; }, sel, v);
await click('#ft-create-family'); await sleep(400); await click('#ff-save'); await sleep(1500);
// add the other user as a member by email
await click('#ft-add-member'); await sleep(500);
await setVal('#am-email', other.email); await sleep(200);
await click('#am-send'); await sleep(1800);
out.task1.memberCardShown = await page.evaluate((nm)=>{
  return [...document.querySelectorAll('.ft-card .ft-name')].some(n=>n.textContent.includes(nm));
}, 'p93-mem');
out.task1.removeBtnOnMember = await page.evaluate(()=>!!document.querySelector('.ft-del-mem'));
out.task1.noRemoveOnSelf = await page.evaluate(()=>{
  // the "(you)" card must NOT carry a remove button
  const cards=[...document.querySelectorAll('.ft-card')];
  const you=cards.find(c=>/\(?you\)?|вы|tú/i.test(c.querySelector('.ft-chip')?.textContent||''));
  return you ? !you.querySelector('.ft-del-mem') : true;
});
await page.screenshot({ path: OUT+'pr93-family-before.png' });
// remove the member (auto-accept confirm)
page.on('dialog', async d=>{ try{ await d.accept(); }catch(e){} });
await page.evaluate(()=>{ const b=document.querySelector('.ft-del-mem'); if(b) b.click(); });
await sleep(2000);
out.task1.memberGoneAfterRemove = await page.evaluate((nm)=>{
  return ![...document.querySelectorAll('.ft-card .ft-name')].some(n=>n.textContent.includes(nm));
}, 'p93-mem');
await page.screenshot({ path: OUT+'pr93-family-after.png' });

out.errs = errs.slice(0,8);
console.log(JSON.stringify(out, null, 2));
await browser.close();
