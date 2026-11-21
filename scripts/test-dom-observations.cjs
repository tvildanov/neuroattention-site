'use strict';
const assert=require('node:assert/strict'),base='http://127.0.0.1:4318';
async function call(method,route,token,body){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Authorization:token?'Bearer '+token:''},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};}
(async()=>{
 const login=async role=>(await call('POST','/api/auth/login',null,{email:'qa-'+role+'@example.invalid',password:'local-scenario-password'})).body.token;
 const a=await login('user'),b=await login('owner-b');assert.ok(a&&b);
 assert.equal((await call('POST','/api/run-migrations',null,{})).status,401);assert.equal((await call('POST','/api/run-migrations',a,{})).status,403);
 assert.equal((await call('POST','/api/rtc/2147483000/signal',a,{kind:'subscribe',payload:{}})).status,403);assert.equal((await call('GET','/api/rtc/2147483000/signals',a)).status,403);
 const p={operation_id:crypto.randomUUID(),session_id:crypto.randomUUID(),occurred_at:'2026-11-20T10:00:00Z',text:'Synthetic original <script>test</script>',context:'Synthetic context',intensity:null,date_key:'2026-11-20',legacy_entry:{chains:[{emotion:'Test calm'}],intensity:null},chain:[{type:'concept',label:'Original',valence:'neutral'},{type:'emotion',label:'Test calm',valence:'positive'},{type:'concept',label:'Original',valence:'neutral'}]};
 assert.equal((await call('POST','/api/observations',null,p)).status,401);
 const replies=await Promise.all(Array.from({length:20},()=>call('POST','/api/observations',a,p)));replies.forEach(r=>assert.equal(r.status,200,JSON.stringify(r.body)));assert.equal(new Set(replies.map(x=>x.body.record.id)).size,1);
 const record=replies[0].body.record;assert.equal(record.source.intensity,null);assert.equal((await call('GET','/api/observations/'+record.id,b)).status,404);
 assert.equal((await call('GET','/api/observations/'+record.id,a)).body.record.source.text,p.text);
 assert.equal((await call('GET','/api/observations',a)).body.records.filter(x=>x.id===record.id).length,1);
 const graph=(await call('GET','/api/neuromap/v3/graph',a)).body;assert.equal(graph.chains.find(x=>x.session_id===p.session_id).node_ids.length,3);assert.equal(graph.nodes.find(x=>x.label==='Test calm').count,1);
 const other=crypto.randomUUID();assert.equal((await call('POST','/api/observations',a,{...p,text:'Different',session_id:other})).status,409);assert.equal((await call('GET','/api/neuromap/v3/graph',a)).body.chains.some(x=>x.session_id===other),false);
 assert.equal((await call('POST','/api/observations',b,{...p,operation_id:crypto.randomUUID()})).status,409);assert.equal((await call('GET','/api/observations',b)).body.records.length,0);
 assert.equal((await call('POST','/api/observations',a,{...p,operation_id:crypto.randomUUID(),text:'Second'})).status,200);
 const again=(await call('GET','/api/neuromap/v3/graph',a)).body;assert.equal(again.chains.find(x=>x.session_id===p.session_id).node_ids.length,6);assert.equal(again.nodes.find(x=>x.label==='Test calm').count,2);
 for(const bad of [{chain:[]},{intensity:0},{operation_id:'invalid'},{dependent_id:1},{chain:[{type:'unknown',label:'X'}]}])assert.equal((await call('POST','/api/observations',a,{...p,...bad})).status,400);
 const broken={...p,operation_id:crypto.randomUUID(),session_id:crypto.randomUUID(),chain:[{type:'concept',label:'Fixture force rollback'}]};assert.equal((await call('POST','/api/observations',a,broken)).status,503);assert.equal((await call('GET','/api/observations',a)).body.records.length,2);
 const rolled=(await call('GET','/api/neuromap/v3/graph',a)).body;assert.equal(rolled.nodes.some(n=>n.label==='Fixture force rollback'),false);assert.equal(rolled.chains.some(n=>n.session_id===broken.session_id),false);
 console.log('OBSERVATIONS_PASS concurrent retry x20, rollback, source recovery, session ownership, unknown intensity, access denials');
})().catch(e=>{console.error(e);process.exitCode=1});
