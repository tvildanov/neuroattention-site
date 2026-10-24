// PR101 — verify the global arc-radius clamp kills the pre-existing
//   "IndexSizeError: arc radius is negative" canvas console error.
// Strategy (change not yet on prod): drive LIVE prod account.html on a narrow
// mobile viewport with a fresh EMPTY user (the documented repro), capturing
// arc/IndexSize errors —
//   Pass A: WITHOUT the shim  → baseline (may or may not throw on this run).
//   Pass B: WITH the exact PR101 shim injected via evaluateOnNewDocument
//           → must be 0 arc errors AND the neuromap canvas must still draw.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH = 'https://neuroattention-api-production.up.railway.app';
const SITE = 'https://neuroattention.org/account.html';
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const H = t => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The exact shim shipped in account.html (kept in sync by hand).
const SHIM = function(){
  if(typeof CanvasRenderingContext2D==='undefined') return;
  var P=CanvasRenderingContext2D.prototype, _arc=P.arc;
  if(_arc && !_arc._radiusGuarded){
    P.arc=function(x,y,r,a0,a1,ccw){ return _arc.call(this, x, y, (r>0?r:0), a0, a1, ccw); };
    P.arc._radiusGuarded=true;
  }
};

const reg = async (tag) => {
  const email = tag + '-' + Date.now() + Math.floor(Math.random()*1e4) + '@test.local';
  const r = await (await fetch(AUTH + '/api/auth/register', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email, password:'Test12345!', display_name: tag, country:'RU', city:'Moscow', location_lat:55.75, location_lon:37.62 })})).json();
  return { email, token: r.token };
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless:true, args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });

async function run(label, injectShim){
  // Fresh EMPTY user each pass (no neuromap/journey data — the "empty user" repro).
  const u = await reg('p101');
  const me = await (await fetch(AUTH+'/api/auth/me',{headers:H(u.token)})).json();
  const meUser = me.user||me;
  const page = await browser.newPage();
  await page.setViewport({ width:360, height:780, isMobile:true, hasTouch:true }); // narrow mobile
  const arcErrs=[];
  const note = s => { if(/arc|radius|IndexSize/i.test(s)) arcErrs.push(s.slice(0,200)); };
  page.on('pageerror', e=>note(String(e&&e.message||e)));
  page.on('console', m=>{ if(m.type()==='error') note(m.text()); });
  if(injectShim) await page.evaluateOnNewDocument(SHIM);
  await page.evaluateOnNewDocument((t,user)=>{ localStorage.setItem('na_token',t); localStorage.setItem('na_user',JSON.stringify(user)); window.currentUser=user; }, u.token, meUser);
  await page.goto(SITE,{waitUntil:'networkidle2',timeout:60000});
  await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});
  const guarded = await page.evaluate(()=>!!(CanvasRenderingContext2D.prototype.arc && CanvasRenderingContext2D.prototype.arc._radiusGuarded));
  // Exercise every canvas path: NeuroMap tool + Evolution path tabs.
  await page.evaluate(()=>{ try{ window.switchTab('tools'); }catch(e){} });
  await sleep(800);
  await page.evaluate(()=>{ try{ if(window.setToolsMode) window.setToolsMode('nm'); }catch(e){} });
  await sleep(1800);
  await page.evaluate(()=>{ try{ window.switchTab('evolution'); if(window.evoSwitchSub) window.evoSwitchSub('personal'); }catch(e){} });
  await sleep(2200);
  await page.evaluate(()=>{ try{ window.switchTab('evolution'); if(window.evoSwitchSub) window.evoSwitchSub('collective'); }catch(e){} });
  await sleep(2000);
  // Does at least one canvas have non-blank pixels? (proves nodes still render somewhere)
  const drew = await page.evaluate(()=>{
    let any=false;
    document.querySelectorAll('canvas').forEach(c=>{
      try{ if(c.width<4||c.height<4) return; const g=c.getContext('2d'); if(!g) return;
        const d=g.getImageData(0,0,Math.min(c.width,400),Math.min(c.height,400)).data;
        for(let i=3;i<d.length;i+=400){ if(d[i]>0){ any=true; break; } } }catch(e){}
    });
    return any;
  });
  await page.close();
  return { label, guarded, arcErrs, drew };
}

const A = await run('NO-shim (baseline)', false);
const B = await run('WITH-shim (PR101)', true);
await browser.close();

console.log('\n── PR101 arc-radius clamp verification ──');
for(const r of [A,B]){
  console.log(`\n[${r.label}]`);
  console.log('  arc guard active :', r.guarded);
  console.log('  canvas drew px   :', r.drew);
  console.log('  arc/radius errors:', r.arcErrs.length, r.arcErrs.length?('\n    - '+r.arcErrs.join('\n    - ')):'');
}
const pass = B.guarded && B.arcErrs.length===0 && B.drew;
console.log('\nRESULT:', pass ? 'PASS — shim active, 0 arc errors, canvas still renders' : 'FAIL');
console.log('NOTE: baseline arc errors =', A.arcErrs.length, '(repro is intermittent; the shim guarantees 0).');
process.exit(pass?0:1);
