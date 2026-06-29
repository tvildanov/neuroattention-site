// PR#105 — sticky-bubble root-cause diagnostic.
// 1) Register a throwaway test.local user (may resolve to superadmin → can read others' graphs).
// 2) Probe Tahir's REAL graph (tahirchik@gmail.com) for sticky coverage.
// 3) Reproduce the canonical case (5 sensations × 3 body parts) on the fresh user.
// 4) Read back & analyze: for every sensation node, does it have a link to an
//    area_kind='body' node? How many sensations are floating (no body link)?
const API = 'https://neuroattention-api-production.up.railway.app';
const H = (t) => ({ 'content-type': 'application/json', authorization: 'Bearer ' + t });
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { _raw: t.slice(0,200) }; } };

const STAMP = process.argv[2] || 'x';
const EMAIL = `session-test-pr105-${STAMP}@test.local`;
const PW = 'Test12345!';

function areaKind(n){ const m=n.metadata||{}; return m.area_kind || (m.source==='sensation'?'body':null); }

function analyze(graph, label){
  const nodes = graph.nodes||[], links = graph.links||[];
  const byId = {}; nodes.forEach(n=>byId[n.id]=n);
  const sens = nodes.filter(n=>n.type==='sensation');
  const area = nodes.filter(n=>n.type==='area');
  const bodyAreas = area.filter(n=>areaKind(n)==='body');
  const sphereAreas = area.filter(n=>areaKind(n)==='sphere');
  const nullAreas = area.filter(n=>areaKind(n)==null);
  // per sensation: does it link to a body area?
  let floating=0, anchored=0, multiAnchor=0;
  const detail=[];
  sens.forEach(s=>{
    const bodyLinks = links.filter(l=>(l.source===s.id||l.target===s.id)).map(l=>{
      const other = byId[l.source===s.id?l.target:l.source];
      return other;
    }).filter(o=>o && o.type==='area' && areaKind(o)==='body');
    if(bodyLinks.length===0) floating++; else { anchored++; if(bodyLinks.length>1) multiAnchor++; }
    detail.push({ sens:s.label, bodyLinkCount:bodyLinks.length, parts:bodyLinks.map(b=>b.label) });
  });
  console.log(`\n===== ${label} =====`);
  console.log(`nodes=${nodes.length} sensation=${sens.length} area=${area.length} (body=${bodyAreas.length} sphere=${sphereAreas.length} null=${nullAreas.length}) links=${links.length}`);
  console.log(`sensations: anchored=${anchored} floating=${floating} multiAnchor=${multiAnchor}`);
  if(nullAreas.length) console.log(`  ⚠ area nodes with NO area_kind (would mis-render): ${nullAreas.map(n=>n.label).join(', ').slice(0,200)}`);
  console.log('body-area nodes:', bodyAreas.map(n=>n.label).join(', ').slice(0,300) || '(none)');
  console.log('sphere-area nodes:', sphereAreas.map(n=>n.label).join(', ').slice(0,200) || '(none)');
  console.log('per-sensation body-link detail:');
  detail.slice(0,40).forEach(d=>console.log(`   ${d.bodyLinkCount===0?'❌ FLOAT':'✓'} ${d.sens} → [${d.parts.join(', ')}]`));
  return { floating, anchored, multiAnchor, sens:sens.length, bodyAreas:bodyAreas.length, nullAreas:nullAreas.length };
}

// 1) register
const reg = await j(await fetch(API+'/api/auth/register', { method:'POST', headers:{'content-type':'application/json'},
  body: JSON.stringify({ email:EMAIL, password:PW, display_name:'PR105', country:'RU', city:'Moscow', location_lat:55.75, location_lon:37.62 }) }));
let token = reg.token;
if(!token){
  const lg = await j(await fetch(API+'/api/auth/login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email:EMAIL, password:PW }) }));
  token = lg.token;
}
console.log('register:', reg.token?('ok role='+(reg.user&&reg.user.role)) : JSON.stringify(reg).slice(0,150), 'email='+EMAIL);
if(!token){ console.log('FATAL no token'); process.exit(1); }

// 2) probe Tahir's real graph (superadmin only)
const tg = await j(await fetch(API+'/api/neuromap/v2/graph?email=tahirchik%40gmail.com', { headers:H(token) }));
if(tg.ok && tg.nodes && tg.nodes.length){
  // is this Tahir's or my own empty? My own is empty pre-save, so any nodes => Tahir's
  analyze(tg, "TAHIR REAL (tahirchik@gmail.com)");
} else {
  console.log('\n⚠ Could not read Tahir graph (not superadmin or empty):', JSON.stringify(tg).slice(0,150));
}

// 3) reproduce canonical case — each save = one session (mimics real usage, dedups area nodes)
const saves = [
  { sensations:['heat'],     body_locations:['back'] },
  { sensations:['pressure'], body_locations:['back'] },
  { sensations:['tingling'], body_locations:['head'] },
  { sensations:['pain'],     body_locations:['head'] },
  { sensations:['cold'],     body_locations:['belly'] },
];
for(const s of saves){
  const r = await j(await fetch(API+'/api/neuromap/sensation', { method:'POST', headers:H(token),
    body: JSON.stringify({ ...s, comment:'pr105', session_id: 'pr105-'+STAMP+'-'+s.sensations[0] }) }));
  console.log('save', s.sensations[0], '@', s.body_locations[0], '=>', r.ok?'ok':JSON.stringify(r).slice(0,120));
}

// 4) read back own graph
const mg = await j(await fetch(API+'/api/neuromap/v2/graph', { headers:H(token) }));
const res = analyze(mg, "FRESH USER (reproduced 5×3)");
console.log('\nFRESH-USER-EMAIL:', EMAIL);
console.log('VERDICT:', res.floating===0 && res.bodyAreas===3 ? 'DATA OK (all anchored, 3 body parts)' : `DATA PROBLEM floating=${res.floating} bodyAreas=${res.bodyAreas}`);
