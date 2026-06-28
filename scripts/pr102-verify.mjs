// PR #102 — verify the two standalone-NeuroMap fixes on LIVE prod:
//   (1) the "Ощущения" (layer 1) toggle is no longer parked under a dark veil —
//       its checkbox is enabled, all 6 layer toggles are active & clickable, and
//       toggling it actually hides/shows the sensation-type nodes.
//   (2) sensation nodes "stick" to their body-location (area) node on the main
//       canvas: the sensation↔area edge is short (glued bubble), not a free
//       force-directed strand. Orphan sensations (no link) stay free — not tested
//       here since the seed always links them.
//
// Strategy: register a fresh user, seed sensation+area+links via the public
// sensation endpoint (one body location, several felt words, one word repeated to
// prove "duplicates grow"), load account.html, open NeuroMap, then assert from the
// live window.nmNodes / nmLinks after the force sim settles.
import puppeteer from '/tmp/pptr/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const AUTH = process.env.AUTH_API || 'https://neuroattention-api-production.up.railway.app';
const SITE = process.env.SITE_URL || 'https://neuroattention.org/account.html';
const CHROME = '/Users/tvildanov/.cache/puppeteer/chrome/mac_arm-150.0.7871.24/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const H = t => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const J = r => r.json();

const reg = async (tag) => {
  const email = tag + '-' + Date.now() + Math.floor(Math.random()*1e4) + '@test.local';
  const r = await J(await fetch(AUTH + '/api/auth/register', { method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ email, password:'Test12345!', display_name: tag, country:'RU', city:'Moscow', location_lat:55.75, location_lon:37.62 })}));
  return { email, token: r.token };
};
const slugs = async (cat, n) => {
  const rows = await J(await fetch(AUTH + '/api/vocab/' + cat));
  return (Array.isArray(rows) ? rows : (rows.terms||rows.items||[])).slice(0, n).map(r => r.slug);
};
const seedSensation = async (token, body) => J(await fetch(AUTH + '/api/neuromap/sensation', { method:'POST', headers:H(token), body: JSON.stringify(body) }));

(async () => {
  const u = await reg('p102');
  const me = await J(await fetch(AUTH+'/api/auth/me',{headers:H(u.token)}));
  const meUser = me.user||me;

  // Seed: 1 body location + 4 felt sensations, then re-log one of them so its count
  // grows (duplicate → bigger node). All sensations link to the same area.
  const sens = await slugs('sensation', 4);
  const loc  = await slugs('body_location', 2);
  const seeded = [];
  seeded.push(await seedSensation(u.token, { body_locations:[loc[0]], sensations: sens, intensity: 7 }));
  seeded.push(await seedSensation(u.token, { body_locations:[loc[0]], sensations:[sens[0]], intensity: 6 })); // grow sens[0]
  seeded.push(await seedSensation(u.token, { body_locations:[loc[1]], sensations:[sens[1], sens[2]], intensity: 5 }));
  const graph = await J(await fetch(AUTH+'/api/neuromap/v2/graph',{headers:H(u.token)}));
  const gNodes = graph.nodes||[], gLinks = graph.links||[];
  const seedOk = gNodes.some(n=>n.type==='sensation') && gNodes.some(n=>n.type==='area') && gLinks.length>0;

  const browser = await puppeteer.launch({ executablePath: CHROME, headless:true,
    args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
  const page = await browser.newPage();
  await page.setViewport({ width:1280, height:900 });
  await page.evaluateOnNewDocument((t,user)=>{ localStorage.setItem('na_token',t); localStorage.setItem('na_user',JSON.stringify(user)); window.currentUser=user; }, u.token, meUser);
  await page.goto(SITE,{waitUntil:'networkidle2',timeout:60000});
  await page.waitForFunction('typeof window.switchTab === "function"',{timeout:30000});

  // Open Tools → NeuroMap.
  await page.evaluate(()=>{ try{ window.switchTab('tools'); }catch(e){} });
  await sleep(700);
  await page.evaluate(()=>{ try{ if(window.setToolsMode) window.setToolsMode('nm'); }catch(e){} });
  await sleep(6000); // let the v2 graph load + the force sim FULLY settle (250 iters ≈ 4.2s)

  // ── Assertion 1: all 6 layer toggles present, enabled, and checked. ──
  const toggles = await page.evaluate(()=>{
    const out=[];
    document.querySelectorAll('#nm-filters input[data-layer]').forEach(cb=>{
      const L=cb.getAttribute('data-layer');
      if(L==='repeat') return;
      const label=cb.closest('label');
      out.push({ layer:L, disabled:cb.disabled, checked:cb.checked,
                 opacity: label?parseFloat(getComputedStyle(label).opacity):1 });
    });
    return out.sort((a,b)=>(+a.layer)-(+b.layer));
  });
  const sensTog = toggles.find(t=>t.layer==='1');
  const allSix = toggles.length===6;
  const noneDisabled = toggles.every(t=>!t.disabled);
  const sensEnabled = !!sensTog && !sensTog.disabled && sensTog.opacity>0.9;

  // ── Assertion 3 (measured on the SETTLED initial layout, before any toggling). ──
  // sensation↔area edges are short (glued) AND siblings don't stack on one point.
  const stick = await page.evaluate(()=>{
    const N = window.nmNodes||[], L = window.nmLinks||[];
    const by={}; N.forEach(n=>by[n.id]=n);
    const R = (typeof nmNodeR==='function') ? nmNodeR : (n)=> (n._r||12);
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    let sum=0,cnt=0;
    for(let i=0;i<N.length;i++) for(let j=i+1;j<N.length;j++){ sum+=dist(N[i],N[j]); cnt++; }
    const meanPair = cnt?sum/cnt:0;
    const sticky=[];
    L.forEach(l=>{
      const s=by[l.source], t=by[l.target]; if(!s||!t) return;
      if((s.type==='sensation')===(t.type==='sensation')) return;
      const sensN = s.type==='sensation'?s:t, area=s.type==='sensation'?t:s;
      sticky.push({ edge: dist(s,t), glue: R(sensN)+R(area)+12,
                    sLabel: sensN.label, aType: area.type, anchored: sensN._anchorId===area.id });
    });
    // sibling spread: for each anchor, min pairwise distance among its sensations
    const groups={};
    N.forEach(n=>{ if(n.type==='sensation'&&n._anchorId){ (groups[n._anchorId]=groups[n._anchorId]||[]).push(n); } });
    let minSib=Infinity, sibPairs=0;
    Object.values(groups).forEach(g=>{ for(let i=0;i<g.length;i++)for(let j=i+1;j<g.length;j++){ minSib=Math.min(minSib,dist(g[i],g[j])); sibPairs++; } });
    return { meanPair, sticky, minSib: sibPairs?minSib:null,
      maxEdge: sticky.length?Math.max(...sticky.map(s=>s.edge)):0 };
  });
  const stuckEdges = stick.sticky.filter(s=> s.edge < Math.max(s.glue*1.8, 90) && s.edge < stick.meanPair*0.7);
  const stickyOk = stick.sticky.length>0 && stuckEdges.length === stick.sticky.length;
  const anchorsResolved = stick.sticky.every(s=>s.anchored);
  const siblingsSpread = stick.minSib===null || stick.minSib > 8; // not collapsed to one point

  // ── Screenshots (captured on the settled layout, before the toggle-cycle). ──
  const filt = await page.$('#nm-filters');
  if(filt) await filt.screenshot({ path:'scripts/pr102-toggles.png' });
  const cv = await page.$('#nm-canvas');
  if(cv) await cv.screenshot({ path:'scripts/pr102-canvas.png' });

  // ── Assertion 2: toggling layer 1 actually hides/shows sensation nodes. ──
  const beforeCnt = await page.evaluate(()=> (window.nmNodes||[]).filter(n=>n.type==='sensation').length);
  await page.evaluate(()=>{ const cb=document.querySelector('#nm-filters input[data-layer="1"]'); if(cb){ cb.checked=false; cb.dispatchEvent(new Event('change',{bubbles:true})); } });
  await sleep(900);
  const offCnt = await page.evaluate(()=> (window.nmNodes||[]).filter(n=>n.type==='sensation').length);
  await page.evaluate(()=>{ const cb=document.querySelector('#nm-filters input[data-layer="1"]'); if(cb){ cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true})); } });
  await sleep(1500);
  const onCnt = await page.evaluate(()=> (window.nmNodes||[]).filter(n=>n.type==='sensation').length);
  const toggleWorks = beforeCnt>0 && offCnt===0 && onCnt>0;

  await browser.close();

  const checks = [
    ['seed: sensation+area+links created', seedOk],
    ['all 6 layer toggles present',        allSix],
    ['no toggle disabled (veil gone)',     noneDisabled],
    ['layer-1 sensation toggle enabled',   sensEnabled],
    ['toggle hides/shows sensation nodes', toggleWorks],
    ['sensation↔area edges are sticky',    stickyOk],
    ['sensation _anchorId resolved',       anchorsResolved],
    ['sibling bubbles spread (not stacked)', siblingsSpread],
  ];
  console.log('\n── PR#102 standalone-NeuroMap verification ──');
  console.log('seeded graph: nodes=%d links=%d', gNodes.length, gLinks.length);
  console.log('toggles:', JSON.stringify(toggles));
  console.log('sensation node count  before/off/on: %d / %d / %d', beforeCnt, offCnt, onCnt);
  console.log('sticky edges: count=%d  meanPair=%s  maxEdge=%s  minSiblingGap=%s',
    stick.sticky.length, stick.meanPair.toFixed(1), stick.maxEdge.toFixed(1),
    stick.minSib===null?'n/a':stick.minSib.toFixed(1));
  stick.sticky.forEach(s=>console.log('   • %s → %s  edge=%s glue=%s anchored=%s',
    s.sLabel, s.aType, s.edge.toFixed(1), s.glue.toFixed(1), s.anchored));
  console.log('');
  let pass=true;
  for(const [name,ok] of checks){ console.log((ok?'  ✓ ':'  ✗ ')+name); if(!ok) pass=false; }
  console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
  console.log('screenshots: scripts/pr102-toggles.png, scripts/pr102-canvas.png');
  process.exit(pass?0:1);
})().catch(e=>{ console.error('HARNESS ERROR:', e); process.exit(2); });
