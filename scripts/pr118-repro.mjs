// PR#118 repro: register fresh user, append a few chains, inspect v3/graph.
const BASE = 'https://neuroattention-api-production.up.railway.app';
const email = `pr118_${Date.now()}@test.local`;
const password = 'test123456';

async function j(method, path, token, body){
  const r = await fetch(BASE+path, {
    method,
    headers: Object.assign({'Content-Type':'application/json'}, token?{'Authorization':'Bearer '+token}:{}),
    body: body?JSON.stringify(body):undefined
  });
  let t = await r.text(); let d; try{ d=JSON.parse(t); }catch{ d=t; }
  return { status:r.status, d };
}

(async()=>{
  // register
  let reg = await j('POST','/api/auth/register',null,{
    email, password, display_name:'PR118', country:'Spain', city:'Madrid',
    location_lat:40.4168, location_lon:-3.7038
  });
  console.log('register', reg.status, reg.d.user?reg.d.user.id:reg.d);
  const token = reg.d.token;
  if(!token){ console.log('NO TOKEN, abort'); return; }

  // Flow 1: sensation chain (body -> sensation -> emotion)
  let f1 = await j('POST','/api/neuromap/v2/append',token,{
    session_id: 'sess-'+Date.now()+'-A',
    chain: [
      { type:'area', label:'грудь', valence:'neutral', metadata:{area_kind:'body',source:'sensation'} },
      { type:'sensation', label:'тепло', valence:'positive', metadata:{source:'sensation'} },
      { type:'emotion', label:'спокойствие', valence:'positive', metadata:{} }
    ]
  });
  console.log('flow1 append', f1.status, JSON.stringify(f1.d).slice(0,300));

  // Flow 2: separate emotion chain (emotion -> cause -> thought)
  let f2 = await j('POST','/api/neuromap/v2/append',token,{
    session_id: 'sess-'+Date.now()+'-B',
    chain: [
      { type:'emotion', label:'тревога', valence:'negative', metadata:{} },
      { type:'cause', label:'работа', valence:'neutral', metadata:{} },
      { type:'thought', label:'я не справлюсь', valence:'negative', metadata:{} }
    ]
  });
  console.log('flow2 append', f2.status, JSON.stringify(f2.d).slice(0,300));

  // Flow 3: another sensation flow reusing emotion 'спокойствие' (shared node, new chain)
  let f3 = await j('POST','/api/neuromap/v2/append',token,{
    session_id: 'sess-'+Date.now()+'-C',
    chain: [
      { type:'area', label:'живот', valence:'neutral', metadata:{area_kind:'body',source:'sensation'} },
      { type:'sensation', label:'тепло', valence:'positive', metadata:{source:'sensation'} },
      { type:'emotion', label:'спокойствие', valence:'positive', metadata:{} }
    ]
  });
  console.log('flow3 append', f3.status, JSON.stringify(f3.d).slice(0,300));

  // wait a beat, then read v3/graph
  await new Promise(r=>setTimeout(r,1500));
  let g = await j('GET','/api/neuromap/v3/graph',token);
  console.log('\n=== v3/graph status', g.status, '===');
  if(typeof g.d === 'object'){
    console.log('nodes:', (g.d.nodes||[]).length);
    console.log('links:', (g.d.links||[]).length);
    console.log('chains:', (g.d.chains||[]).length);
    console.log('\nNODES:', JSON.stringify((g.d.nodes||[]).map(n=>({id:n.id.slice(0,8),type:n.type,label:n.label,count:n.count})),null,1));
    console.log('\nLINKS:', JSON.stringify((g.d.links||[]).map(l=>({s:String(l.source).slice(0,8),t:String(l.target).slice(0,8),count:l.count})),null,1));
    console.log('\nCHAINS:', JSON.stringify((g.d.chains||[]).map(c=>({id:c.id,src:c.source,n:c.node_ids.length,ids:c.node_ids.map(x=>String(x).slice(0,8))})),null,1));
  } else {
    console.log('RAW:', g.d);
  }
})();
