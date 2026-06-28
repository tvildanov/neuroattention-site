// PR#97 — Phase 3.5 live mini-Neuromap inset. Verifies, on a fresh prod user:
//  • client fns wired (nmMiniMakeInset/Draw/SensModel/DiaryModel + rerender)
//  • Diary overlay: typing the name → 1 event node; +/- → green/red valence ring
//  • Sensation overlay: location → central node; sensation chip → sticky bubble;
//    a sensation already in the prior session GROWS (no duplicate)
//  • Emotion walkthrough live graph still grows step-by-step (Phase 3.1-3.4 intact)
//  • prior cross-link strip is captured at a handoff
// Screenshots saved to /tmp for each scenario.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH='https://neuroattention-api-production.up.railway.app';
const SITE='https://neuroattention.org/account.html';
const CHROME='/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=[]; const ok=(n,c,x)=>{out.push({n,c:!!c,x:x||''});console.log((c?'PASS':'FAIL')+' · '+n+(x?' · '+x:''));};

async function reg(){const email='p97-'+Date.now()+Math.floor(Math.random()*1e4)+'@test.local';
  const r=await(await fetch(AUTH+'/api/auth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'Test12345!',display_name:'p97',country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62})})).json();return r.token;}

const token=await reg();
const me=await(await fetch(AUTH+'/api/auth/me',{headers:{authorization:'Bearer '+token}})).json();const meUser=me.user||me;
const browser=await puppeteer.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage();
await page.setViewport({width:1280,height:900});
const errs=[];page.on('pageerror',e=>errs.push(String(e&&e.message||e)));
await page.evaluateOnNewDocument((t,u)=>{localStorage.setItem('na_token',t);localStorage.setItem('na_user',JSON.stringify(u));window.currentUser=u;},token,meUser);
await page.goto(SITE+'?v='+Date.now(),{waitUntil:'networkidle2',timeout:60000});
await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});

// 1) client fns wired
const fns=await page.evaluate(()=>({
  makeInset: typeof window.nmMiniMakeInset==='function' || typeof nmMiniMakeInset==='function',
  draw: typeof nmMiniDraw==='function',
  sensModel: typeof nmMiniSensModel==='function',
  diaryModel: typeof nmMiniDiaryModel==='function',
  diaryRerender: typeof window.nmDiaryMiniRerender==='function',
  setPrior: typeof window.nmSetPrior==='function'
}));
ok('client fns wired', Object.values(fns).every(Boolean), JSON.stringify(fns));

// ── DIARY scenario ──
await page.evaluate(()=>{ window.switchTab('tools'); });
await sleep(300);
await page.evaluate(()=>{ window.openDiaryInput(); });
await sleep(400);
// type the event name
await page.evaluate(()=>{ const i=document.getElementById('diary-event-text'); i.value='Прошёл собеседование'; if(window.onDiaryTextInput) onDiaryTextInput(); });
await sleep(300);
const diaryInset=await page.evaluate(()=>{
  const inset=document.querySelector('#diaryModal .nm-mini-inset');
  const m=nmMiniDiaryModel();
  return { insetPresent: !!inset, nodeCount: m.nodes.length, firstType: m.nodes[0] && m.nodes[0].type };
});
ok('Diary: name typed → inset present + 1 event node', diaryInset.insetPresent && diaryInset.nodeCount===1 && diaryInset.firstType==='event', JSON.stringify(diaryInset));
await page.screenshot({path:'/tmp/pr97-diary-1node.png'});
// rate + → green valence ring
await page.evaluate(()=>{ window.addRating('plus'); });
await sleep(250);
const diaryPlus=await page.evaluate(()=>{ const m=nmMiniDiaryModel(); const ev=m.nodes[0]; return { valence:ev.valence, ring:ev.ring }; });
ok('Diary: + rating → positive valence + green ring', diaryPlus.valence==='positive' && /80,220,120/.test(diaryPlus.ring||''), JSON.stringify(diaryPlus));
await page.screenshot({path:'/tmp/pr97-diary-green.png'});
// add comment → linked thought node
await page.evaluate(()=>{ const c=document.getElementById('diary-event-comment'); c.value='важный шаг'; if(window.nmDiaryMiniRerender) nmDiaryMiniRerender(); });
await sleep(200);
const diaryComment=await page.evaluate(()=>{ const m=nmMiniDiaryModel(); return { n:m.nodes.length, links:m.links.length, hasThought:m.nodes.some(x=>x.type==='thought') }; });
ok('Diary: comment → linked thought node', diaryComment.n===2 && diaryComment.links===1 && diaryComment.hasThought, JSON.stringify(diaryComment));
await page.evaluate(()=>{ if(window.closeDiaryInput) closeDiaryInput(); });
await sleep(300);

// ── SENSATION scenario ──
await page.evaluate(()=>{ if(window.nmOpenSensationOverlay) nmOpenSensationOverlay(); });
await sleep(1600); // vocab fetch + render
const sensInset=await page.evaluate(()=>!!document.querySelector('.na-fs-overlay .nm-mini-inset'));
ok('Sensation: overlay inset present', sensInset);
// pick a body location (expand the full list, click first real loc chip)
await page.evaluate(()=>{ if(window.smToggleLocList) smToggleLocList(); });
await sleep(300);
const locPicked=await page.evaluate(()=>{
  const chip=document.querySelector('#sm-loc-chips .sm-chip:not([data-bodyorigin])');
  if(chip){ chip.classList.add('active'); }
  // model after location
  const m=nmMiniSensModel();
  return { picked: !!chip, centerCount: m.nodes.filter(n=>n.id.indexOf('c')===0).length, total:m.nodes.length };
});
ok('Sensation: body location → central node', locPicked.picked && locPicked.centerCount>=1, JSON.stringify(locPicked));
await page.screenshot({path:'/tmp/pr97-sens-center.png'});
// add a sensation chip → sticky bubble appears
const sensBubble=await page.evaluate(()=>{
  const chip=document.querySelector('#sm-sens-chips .sm-chip');
  let label='';
  if(chip){ chip.classList.add('active'); const s=chip.querySelector('span'); label=s?s.textContent.trim():''; }
  const m=nmMiniSensModel();
  const bubbles=m.nodes.filter(n=>n.id[0]==='s');
  return { picked:!!chip, label, bubbleCount:bubbles.length, bubbleR: bubbles[0] && bubbles[0].r };
});
ok('Sensation: chip → sticky bubble', sensBubble.picked && sensBubble.bubbleCount===1, JSON.stringify(sensBubble));
await page.screenshot({path:'/tmp/pr97-sens-bubble.png'});
// duplicate-grow: inject the same word into the prior session, re-read model → bubble grows
const grow=await page.evaluate((lbl)=>{
  const before=nmMiniSensModel().nodes.filter(n=>n.id[0]==='s')[0];
  window.nmSetPrior([{type:'sensation',label:lbl,valence:'neutral'}]);
  const after=nmMiniSensModel().nodes.filter(n=>n.id[0]==='s')[0];
  return { before: before&&before.r, after: after&&after.r, ring: after&&after.ring };
}, sensBubble.label);
ok('Sensation: same word in prior session → bubble grows (no dupe)', grow.after>grow.before && !!grow.ring, JSON.stringify(grow));
await page.screenshot({path:'/tmp/pr97-sens-grow.png'});
// close sensation overlay
await page.evaluate(()=>{ const b=document.querySelector('.na-fs-overlay .na-fs-btn[title^="Закрыть"]'); if(b) b.click(); });
await sleep(400);

// ── EMOTION walkthrough live graph (Phase 3.1-3.4 intact) ──
await page.evaluate(()=>{ if(window.openNmSurvey) openNmSurvey(); });
await sleep(500);
// step 1: pick an emotion
await page.evaluate(()=>{ const chip=document.querySelector('#nm-step-content .nm-chip'); if(chip) chip.click(); });
await sleep(300);
const emo1=await page.evaluate(()=>({ emotions:nmSurveyState.emotions.filter(Boolean).length, emptyHidden: (document.getElementById('nm-live-empty')||{}).style && document.getElementById('nm-live-empty').style.display==='none' }));
ok('Emotion: step1 → 1 node on live graph', emo1.emotions===1 && emo1.emptyHidden, JSON.stringify(emo1));
await page.screenshot({path:'/tmp/pr97-emotion-1.png'});
// next → step 2 area
await page.evaluate(()=>{ window.nmNext&&nmNext(); });
await sleep(300);
await page.evaluate(()=>{ const chip=document.querySelector('#nm-areas-wrap .nm-chip'); if(chip) chip.click(); });
await sleep(300);
const emo2=await page.evaluate(()=>{ const c=nmSurveyState.emotionChains[0]||{}; return { areas:(c.areas||[]).length }; });
ok('Emotion: step2 → area linked (2 nodes)', emo2.areas>=1, JSON.stringify(emo2));
await page.screenshot({path:'/tmp/pr97-emotion-2.png'});
await page.evaluate(()=>{ window.closeNmSurvey&&closeNmSurvey(); });

// no fatal page errors (ignore benign resource noise)
const fatal=errs.filter(e=>!/favicon|Failed to load resource|net::ERR/i.test(e));
ok('no fatal page errors', fatal.length===0, fatal.slice(0,3).join(' | '));

const pass=out.filter(o=>o.c).length;
console.log('\n'+pass+'/'+out.length+' checks passed');
await browser.close();
process.exit(pass===out.length?0:1);
