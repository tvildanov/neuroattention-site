// Fixture-based screenshots for the Wearable OAuth feature (Oura + WHOOP).
// Renders the REAL account.html (served on :8766 from the worktree), injects a
// fixture session + stubbed /api/me/wearables* + /api/me/health-metrics/daily
// responses, reveals the auth-gated dashboard, and captures each view to a PNG.
// No live credentials required (the feature is flag-gated OFF in prod).
//   node scripts/wearables-shots.mjs
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8766/account.html';
const OUT = new URL('.', import.meta.url).pathname;

const FIXTURE = `(function(){
  var h=3600e3;
  var connected=[
    {id:1,provider:'oura',account_email:'demo@icloud.com',scope:'daily heartrate',needs_reauth:false,created_at:new Date(Date.now()-40*24*h).toISOString(),last_sync_at:new Date(Date.now()-2*h).toISOString()},
    {id:2,provider:'whoop',account_email:'demo@whoop.com',scope:'read:recovery',needs_reauth:false,created_at:new Date(Date.now()-12*24*h).toISOString(),last_sync_at:new Date(Date.now()-5*h).toISOString()}
  ];
  var status={enabled:true,encryption_ready:true,providers:{oura:{configured:true},whoop:{configured:true}}};
  var syncLog=[
    {provider:'whoop',ran_at:new Date(Date.now()-5*h).toISOString(),metrics_added:6,metrics_updated:2,duration_ms:840,error:null},
    {provider:'oura',ran_at:new Date(Date.now()-2*h).toISOString(),metrics_added:11,metrics_updated:3,duration_ms:1220,error:null},
    {provider:'oura',ran_at:new Date(Date.now()-26*h).toISOString(),metrics_added:0,metrics_updated:0,duration_ms:410,error:'token refresh failed: invalid_grant'}
  ];
  var days=[]; for(var i=59;i>=0;i--){var d=new Date(Date.now()-i*24*h);var base=55+30*Math.sin(i/6)+(i%7<2?-18:6);var rec=Math.max(20,Math.min(99,Math.round(base)));days.push({day:d.toISOString().slice(0,10),provider:i%2?'oura':'whoop',recovery:rec,hrv:Math.round(25+rec/2),rhr:Math.round(70-rec/6),sleep_score:Math.round(rec*0.9),strain:Math.round((21-rec/6)*10)/10,sleep_duration_min:Math.round(360+rec),deep_sleep_min:Math.round(60+rec/3),rem_min:Math.round(70+rec/4)});}
  window.__FIX={connected:connected,status:status,syncLog:syncLog,days:days,none:[]};
  localStorage.setItem('na_token','FIXTURE.TOKEN');
  localStorage.setItem('na_user', JSON.stringify({id:'u-demo',email:'demo@neuroattention.org',display_name:'Demo',role:'user'}));
  localStorage.setItem('na_lang','en');
  var _f=window.fetch;
  window.__ACCT='connected';
  window.fetch=function(url,opts){
    var u=String(url);
    function J(o){return Promise.resolve(new Response(JSON.stringify(o),{status:200,headers:{'Content-Type':'application/json'}}));}
    if(u.indexOf('/api/me/wearables/sync-log')>=0) return J({ok:true,log:window.__FIX.syncLog});
    if(u.indexOf('/api/me/wearables')>=0 && (!opts||!opts.method||opts.method==='GET')) return J({ok:true,status:window.__FIX.status,accounts:window.__FIX[window.__ACCT]});
    if(u.indexOf('/api/me/health-metrics/daily')>=0) return J({ok:true,days:window.__FIX.days});
    return _f.apply(this,arguments);
  };
})();`;

const REVEAL = `(function(){
  document.getElementById('auth-screen').style.display='none';
  var dash=document.getElementById('client-dashboard'); dash.style.display='block';
  dash.querySelectorAll('.tab-panel').forEach(function(p){p.style.display='none';p.classList.remove('active');});
  try{ window.applyTranslations && window.applyTranslations(); }catch(e){}
})();`;

function showTab(id){ return `(function(){var d=document.getElementById('client-dashboard');d.querySelectorAll('.tab-panel').forEach(function(p){p.style.display='none';});var t=document.getElementById('${id}');if(t){t.style.display='block';t.classList.add('active');}})();`; }

async function shot(page, sel, file){
  await new Promise(r=>setTimeout(r,500));
  const el = await page.$(sel);
  if(!el){ console.log('  !! selector not found:', sel); return; }
  await el.screenshot({ path: OUT + file });
  console.log('  saved', file);
}

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox','--window-size=1280,900','--force-color-profile=srgb']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
await page.evaluateOnNewDocument(FIXTURE);
await page.goto(BASE, { waitUntil: 'networkidle2' });
await page.evaluate(REVEAL);

// (a) Add-device buttons — feature enabled, no devices connected yet
console.log('(a) add-device buttons');
await page.evaluate(showTab('tab-overview'));
await page.evaluate(`window.__ACCT='none'; window.wearLoad && window.wearLoad();`);
await shot(page, '#wear-card', 'wear-a-add.png');

// (b) Connected state (Oura + WHOOP)
console.log('(b) connected state');
await page.evaluate(`window.__ACCT='connected'; window.wearLoad && window.wearLoad();`);
await shot(page, '#wear-card', 'wear-b-connected.png');

// (e) Sync log expanded
console.log('(e) sync log');
await page.evaluate(`window.wearToggleLog && window.wearToggleLog();`);
await shot(page, '#wear-card', 'wear-e-synclog.png');

// (c) Personal Path recovery ribbon
console.log('(c) path recovery ribbon');
await page.evaluate(showTab('tab-evolution'));
await page.evaluate(`document.getElementById('evo-layer-recovery').style.display='inline-flex'; window.wearToggleRecoveryLayer(document.getElementById('evo-layer-recovery'));`);
await new Promise(r=>setTimeout(r,600));
await shot(page, '#wear-recovery-bar', 'wear-c-recovery-ribbon.png');

// (d) NeuroMap physical-state panel
console.log('(d) neuromap physical state');
await page.evaluate(`(function(){
  var day=window.__FIX.days[window.__FIX.days.length-3].day; // a recent fixture day
  var panel=document.getElementById('nm-node-info'); panel.style.display='block';
  document.getElementById('nm-ni-header').innerHTML='<div style="font-size:15px;font-weight:600;color:#fff;"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:rgba(232,170,72,1);margin-right:8px;box-shadow:0 0 8px rgba(232,170,72,1);"></span>тревога</div><div style="color:#8a93a6;font-size:12px;margin-top:0.35rem;">Layer 2: Переживания · негатив · встречается 4 раз</div>';
  // move panel out of the hidden Tools tab into overview so it is visible for the shot
  var ov=document.getElementById('tab-overview'); ov.style.display='block'; ov.appendChild(panel);
  window.wearFillPhysState({last_seen: day});
})();`);
await new Promise(r=>setTimeout(r,700));
await shot(page, '#nm-node-info', 'wear-d-neuromap-physstate.png');

await browser.close();
console.log('done');
