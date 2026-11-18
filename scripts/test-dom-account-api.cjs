'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const http=require('node:http');
const occurrenceGraph=require('../assets/js/neuromap-chains.js');
const port=4318, upstream=4319;
const registry=[
 {agent_id:'persona_nikita',owner:'nikita',name:'Persona A',status:'active',domains:[]},
 {agent_id:'persona_takhir',owner:'takhir',name:'Persona B',status:'active',domains:[]},
 {agent_id:'practice_contour',owner:'nikita',name:'Practice',status:'active',domains:[]},
 {agent_id:'fixture_agent',owner:'nikita',name:'Fixture public agent',status:'active',domains:['domunity','domunity_public']},
];
const prompts=new Map(registry.map(a=>[a.agent_id,'Starting prompt for '+a.agent_id]));
const canon={artifact_id:'fixture_canon',title:'Fixture canon',summary:'Canon fixture',content:{text:'Fixture canon material'},
 source_human_id:'nikita',version:'1.0.0',kind:'protocol',status:'approved',visibility:'all',tags:[]};
const handoffs=new Map(),remoteReplies=new Map();
let roomDispatches=0;
const mcp=http.createServer(async(req,res)=>{
 if(req.headers['x-api-key']!=='fixture-only'){res.writeHead(403);res.end('{}');return;}
 if(req.url.startsWith('/api/handoffs/')){
   const row=handoffs.get(req.url.split('/').at(-1));
   res.end(JSON.stringify({handoff:row}));return;
 }
 const chunks=[];for await(const part of req)chunks.push(part);
 const {id,params}=JSON.parse(Buffer.concat(chunks));const a=params.arguments;
 let out;
 switch(params.name){
 case 'list_agents':out=registry;break;
 case 'get_architecture':out={people:[{entry_persona:'persona_nikita'},{entry_persona:'persona_takhir'}],horizontal:{contours:[{persona:'practice_contour',label:'Practice'}]}};break;
 case 'get_agent_prompt':out=prompts.get(a.agent_id);break;
 case 'list_canon':out=[{artifact_id:'fixture_canon',title:'Fixture canon'}];break;
 case 'get_canon':out=a.artifact_id===canon.artifact_id?canon:{error:'not_found'};break;
 case 'publish_canon':
   assert.equal(a.expected_version,canon.version);
   assert.equal(a.source_human_id,canon.source_human_id);
   assert.equal(a.dom_account_key,'fixture-admin-only');
   canon.content=a.content;canon.version=a.version;
   out={ok:true,artifact_id:canon.artifact_id,version:canon.version};break;
 case 'register_agent':
   assert.equal(a.dom_account_key,'fixture-admin-only');
   assert.equal(a.create_only,true);
   if(registry.some(agent=>agent.agent_id===a.agent_id)){out={created:false};break;}
   registry.push({agent_id:a.agent_id,name:a.name,owner:a.owner,status:'pending_onboarding',domains:a.domains});
   prompts.set(a.agent_id,a.system_prompt);
   out={created:true,placement_cell:a.placement_cell,api_key:'fixture-hidden'};break;
 case 'onboard_agent':{
   const agent=registry.find(agent=>agent.agent_id===a.agent_id);
   assert.equal(agent.status,a.expected_status);
   agent.status=a.next_status;out={agent_id:a.agent_id,status:agent.status};break;
 }
 case 'update_agent_prompt':{
   const previous=crypto.createHash('sha256').update(prompts.get(a.agent_id)).digest('hex');
   assert.equal(a.expected_sha256,previous);
   assert.equal(a.actor_agent,'persona_'+registry.find(x=>x.agent_id===a.agent_id).owner);
   prompts.set(a.agent_id,a.system_prompt);out={agent_id:a.agent_id,version:'0.1.1'};break;
 }
 case 'read_action_log':out=[{action_type:'update_agent_prompt',created_at:new Date().toISOString(),success:true}];break;
 case 'plant_seed':{
   const handoff_id=crypto.randomUUID(), seed_id=crypto.randomUUID();
   if(a.metadata?.channel!=='neuroattention_lk'){out={handoff_id,seed_id};break;}
   assert.ok(a.metadata.correlation_id);
   handoffs.set(handoff_id,{handoff_id,to_agent:a.to_agent,status:'pending',created_at:new Date().toISOString(),result:{},seed_id});
   out={handoff_id,seed_id};break;
 }
 case 'human_chat_poll':out={messages:remoteReplies.get(a.chat_id)||[]};break;
 case 'handoff_task':{
   if(a.domain!=='domunity'){out={handoff_id:crypto.randomUUID()};break;}
   const handoff_id=crypto.randomUUID();
   assert.match(a.dedupe_key,/^domunity:\d+:\d+$/);
   handoffs.set(handoff_id,{handoff_id,to_agent:a.to_agent,status:'completed',result:a.payload.mode==='observe'?{observed:true}:{reply:'Room response from '+a.to_agent}});
   roomDispatches++;out={handoff_id};break;
 }
 default:out=[];
 }
 res.end(JSON.stringify({jsonrpc:'2.0',id,result:{content:[{type:'text',text:typeof out==='string'?out:JSON.stringify(out)}]}}));
});
const call=async(method,url,token,body)=>{
 const r=await fetch('http://127.0.0.1:'+port+url,{method,headers:{'Content-Type':'application/json',Authorization:token?'Bearer '+token:''},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,body:await r.json()};
};
const expect=async(status,...args)=>{const x=await call(...args);assert.equal(x.status,status,args.slice(0,2).join(' ')+': '+JSON.stringify(x.body));return x.body;};
(async()=>{
 await new Promise(r=>mcp.listen(upstream,'127.0.0.1',r));
 const login=async suffix=>expect(200,'POST','/api/auth/login',null,{email:'qa-'+suffix+'@example.invalid',password:'local-scenario-password'});
 const a=await login('owner-a'), b=await login('owner-b'), member=await login('user'), admin=await login('admin');
 const get=(status,url,who)=>expect(status,'GET',url,who?.token);
 const post=(status,url,who,body)=>expect(status,'POST',url,who?.token,body);
 const snap=await get(200,'/api/auth/me',member);
 assert.equal(snap.user.role,'user');
 const append=(who,body)=>post(200,'/api/neuromap/v2/append',who,body);
 const first=await append(member,{chain:[{type:'emotion',label:'Calm'},{type:'thought',label:'First chain'}]});
 const second=await append(member,{chain:[{type:'emotion',label:'Calm'},{type:'thought',label:'Second chain'}]});
 assert.equal(first.node_ids[0],second.node_ids[0]);
 const graph=await get(200,'/api/neuromap/v3/graph?range=all',member);
 const common=graph.chains.filter(c=>c.node_ids.includes(first.node_ids[0]));
 assert.equal(common.length,2);assert.notEqual(common[0].session_id,common[1].session_id);
 const visible=occurrenceGraph(graph,()=>true);
 assert.equal(visible.nodes.filter(n=>n.concept_id===first.node_ids[0]).length,2);
 assert.equal(visible.links.length,2);
 assert.equal((await get(200,'/api/neuromap/v3/graph?range=all',b)).chains.length,0);
 await get(403,'/api/neuromap/chain/'+common[0].id,admin);
 await get(200,'/api/neuromap/chain/'+common[0].id,member);
 const session_id=crypto.randomUUID();
 await Promise.all(['one','two'].map(label=>append(member,{session_id,chain:[{type:'thought',label}]})));
 const updated=await get(200,'/api/neuromap/v3/graph?range=all',member);
 assert.deepEqual(updated.chains.find(c=>c.session_id===session_id).positions,[0,1]);
 const journey=await get(200,'/api/users/me/evolution',member);
 assert.ok(JSON.stringify(journey).includes('First chain'));
 const chosen=common.find(c=>c.node_ids.includes(first.node_ids[1]));
 const linked=await post(200,'/api/neuromap/sensation',member,{
   body_locations:['fixture_forearm'],loc_labels:{fixture_forearm:'Fixture forearm'},
   link_to:[first.journey_ids[0]],
 });
 assert.equal(linked.linked,1);
 const afterLink=await get(200,'/api/neuromap/v3/graph?range=all',member);
 const graphLink=afterLink.explicit_links.find(l=>l.target===first.node_ids[0]);
 assert.equal(graphLink.target_session,chosen.session_id,'binding selects the recorded occurrence');
 const mapped=occurrenceGraph(afterLink,()=>true);
 const explicit=mapped.links.find(link=>link.kind==='correlation');
 assert.equal(mapped.nodes.find(node=>node.id===explicit.target).session_id,chosen.session_id);
 console.log('ACCOUNT_API_PASS signed-in profiles, graph occurrences, concurrent appends, Path, record isolation');
 for(const [who,id] of [[a,'persona_nikita'],[b,'persona_takhir']]){
   const route='/api/dom-monad/admin/agent/'+id;
   const card=await get(200,route+'/harness',who);
   assert.equal(card.can_publish,true);
   assert.equal(card.canon[0].artifact_id,'fixture_canon');
   await get(200,'/api/dom-monad/admin/canon/fixture_canon',who);
   const body={system_prompt:'Updated fixture prompt for '+id,expected_sha256:card.etag};
   await expect(200,'PUT',route+'/prompt',who.token,body);
   await expect(409,'PUT',route+'/prompt',who.token,body);
   const after=await get(200,route+'/harness',who);
   const history=await get(200,route+'/versions',who);
   await post(200,route+'/restore',who,{version_id:Number(history.versions[0].id),expected_sha256:after.etag});
   assert.equal((await get(200,route+'/harness',who)).system_prompt,card.system_prompt);
 }
 await get(403,'/api/dom-monad/admin/agent/persona_nikita/harness',member);
 const adminHarness=await get(200,'/api/dom-monad/admin/agent/persona_nikita/harness',admin);
 assert.equal(adminHarness.can_publish,false);
 await expect(403,'PUT','/api/dom-monad/admin/agent/persona_nikita/prompt',admin.token,{system_prompt:'Cannot be published by an admin'});
 const canonRoute='/api/dom-monad/admin/canon/fixture_canon';
 const publication={expected_version:'1.0.0',content:{text:'Updated canon fixture'}};
 await expect(403,'PUT',canonRoute,member.token,publication);
 assert.equal((await expect(200,'PUT',canonRoute,b.token,publication)).version,'1.0.1');
 await expect(409,'PUT',canonRoute,a.token,publication);
 assert.equal((await get(200,canonRoute,a)).canon.content.text,'Updated canon fixture');
 const form={agent_id:'fixture_vertical',name:'Vertical fixture',system_prompt:'This instruction is a fixture.',
   placement_cell:'L1xL4',room_description:'A participant for local fixture rooms.'};
 const created=await post(201,'/api/dom-monad/admin/agents',a,form);
 assert.equal(created.placement_cell,form.placement_cell);
 assert.equal(created.api_key,undefined);
 await post(409,'/api/dom-monad/admin/agents',a,form);
 const onboard='/api/dom-monad/admin/agent/'+form.agent_id+'/onboarding';
 await post(403,onboard,b,{status:'training'});
 await post(409,onboard,a,{status:'active'});
 for(const status of ['training','certifying','active'])await post(200,onboard,a,{status});
 console.log('ACCOUNT_API_PASS owner A and B harness, publication, stale version, restore and role denials');
 const otp=await post(202,'/api/partner/auth/request-code',null,{email:'qa-partner@example.invalid',display_name:'QA Partner',locale:'es'});
 const {text}=JSON.parse(fs.readFileSync(process.env.DOM_ACCOUNT_TEST_INBOX,'utf8'));
 const code=text.match(/\b\d{6}\b/)[0];
 const partner=await post(200,'/api/partner/auth/verify-code',null,{challenge_id:otp.challenge_id,code});
 await post(401,'/api/partner/auth/verify-code',null,{challenge_id:otp.challenge_id,code});
 const payload={client_request_id:crypto.randomUUID(),display_name:'QA Partner',directions:['attention'],interest:'research',research_topic:'longevity',competence:'Researcher',proposal:'An isolated application integration test proposal.',consent:true};
 const application=await post(201,'/api/partner/applications',partner,payload);
 await post(200,'/api/partner/applications',partner,payload);
 assert.equal((await get(200,'/api/partner/me',member)).applications.length,0);
 assert.equal((await get(200,'/api/partner/me',partner)).applications[0].id,application.application.id);
 assert.equal((await get(200,'/api/partner/admin/applications',a)).applications[0].id,application.application.id);
 await get(403,'/api/partner/admin/applications',member);
 const rehabFields={city:'Test city',phone:'5550100',age:33,description:'Isolated regression record'};
 await post(400,'/api/rehab/apply',member,rehabFields);
 const rehab=await post(200,'/api/rehab/apply',null,{...rehabFields,contact_name:'Rehab fixture',contact_email:'rehab@example.invalid'});
 const rehabList=await get(200,'/api/admin/rehab/applications',b);
 assert.equal(rehabList.applications.find(x=>x.id===rehab.id).user_name,'Rehab fixture');
 assert.equal(rehabList.applications.find(x=>x.id===rehab.id).user_email,'rehab@example.invalid');
 await get(403,'/api/admin/rehab/applications',member);
 const dm=await post(200,'/api/dm/threads',a,{peer_id:member.user.id});
 const dmPath='/api/dm/threads/'+dm.thread_id;
 const roomLink=await post(200,dmPath+'/agent-room',a,{});
 assert.equal((await post(200,dmPath+'/agent-room',member,{})).room_id,roomLink.room_id);
 await post(404,dmPath+'/agent-room',b,{});
 await get(404,'/api/chat/rooms/'+roomLink.room_id+'/messages',b);
 const invited=await post(200,'/api/chat/rooms/'+roomLink.room_id+'/agents',a,{agent_id:'fixture_agent',mode:'active'});
 assert.equal(invited.mode,'mention');
 await post(403,'/api/chat/rooms/'+roomLink.room_id+'/members',a,{user_id:b.user.id});
 console.log('ACCOUNT_API_PASS local OTP, submission, own-only queue and authenticated rehab admin');
 const {chat}=await post(200,'/api/monad/chats',a,{title:'QA delay'});
 const message=await post(200,'/api/monad/message',a,{chat_id:chat.id,text:'Fixture delayed answer'});
 let progress=await get(200,'/api/dom-monad/chats/'+chat.id+'/progress',a);
 assert.equal(progress.statuses[0].status,'queued');
 await get(404,'/api/dom-monad/chats/'+chat.id+'/progress',b);
 const h=handoffs.get(message.handoff_id);
 h.status='accepted';h.accepted_at=new Date().toISOString();
 progress=await get(200,'/api/dom-monad/chats/'+chat.id+'/progress',a);assert.equal(progress.statuses[0].status,'processing');
 h.status='completed';h.result.reply_key='reply-key';
 progress=await get(200,'/api/dom-monad/chats/'+chat.id+'/progress',a);assert.equal(progress.statuses[0].status,'response_ready');
 remoteReplies.set(chat.id,[{key:'reply-key',role:'monad',text:'A late reply',seed_id:message.seed_id}]);
 const poll='/api/monad/chats/'+chat.id+'/poll';
 const imported=await Promise.all([post(200,poll,a,{}),post(200,poll,a,{})]);
 assert.equal(imported.reduce((sum,p)=>sum+p.imported,0),1);
 progress=await get(200,'/api/dom-monad/chats/'+chat.id+'/progress',a);assert.equal(progress.statuses[0].status,'delivered');
 console.log('ACCOUNT_API_PASS queue, processing, delayed reply import, concurrent poll, chat isolation');
 const {room}=await post(201,'/api/admin/chat/rooms',a,{slug:'fixture-domunity',name:'DOMunity QA',member_ids:[member.user.id]});
 const at='/api/chat/rooms/'+room.id;
 await get(403,at+'/agents',b);
 await post(403,at+'/agents',member,{agent_id:'fixture_agent',mode:'active'});
 const agents=await get(200,'/api/dom-monad/agents',a);assert.ok(agents.agents.some(x=>x.kind==='contour'));
 await post(200,at+'/agents',a,{agent_id:'fixture_agent',mode:'mention'});
 await post(200,at+'/agents',a,{agent_id:'practice_contour',mode:'listen'});
 await expect(200,'PUT',at+'/harness',a.token,{version:0,context:'Fixture room context'});
 await expect(409,'PUT',at+'/harness',a.token,{version:0,context:'Stale room context'});
 const {message:roomMessage}=await post(201,at+'/messages',member,{body:'Hello @fixture_agent'});
 const deadline=Date.now()+26000;
 let entries=[];
 do{
   entries=(await get(200,at+'/messages',member)).messages;
   if(entries.some(m=>m.is_agent))break;
   await new Promise(r=>setTimeout(r,1000));
 }while(Date.now()<deadline);
 const replies=entries.filter(m=>m.is_agent);
 assert.equal(roomDispatches,2);
 assert.equal(replies.length,1);
 assert.equal(String(replies[0].in_reply_to),String(roomMessage.id));
 assert.equal(replies[0].agent_id,'fixture_agent');
 await get(403,at+'/messages',b);
 console.log('ACCOUNT_API_PASS two room participants, scoped harness, silent observe and same-room reply');
})().catch(err=>{console.error(err);process.exitCode=1}).finally(()=>mcp.close());
