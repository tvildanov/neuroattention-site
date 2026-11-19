'use strict';
/* DOM v0.7 integration: founder-only agent core access and opted-in DOMunity participation.
   The browser never receives Monad credentials; SQL and MCP remain authoritative. */
const crypto=require('node:crypto');
const { reason } = require('./monad-progress');
const nextOnboardingStatus = Object.freeze({pending_onboarding:'training',training:'certifying',certifying:'active'});
function arr(x){return Array.isArray(x)?x:Array.isArray(x?.agents)?x.agents:Array.isArray(x?.rows)?x.rows:Array.isArray(x?.actions)?x.actions:[]}
function validId(x){return typeof x==='string'&&/^[a-z0-9_]{2,80}$/.test(x)}
async function readPrompt(monad, id) {
  const result = await monad.mcpCall('get_agent_prompt', {agent_id:id,as_record:true});
  if (typeof result?.system_prompt === 'string') return result.system_prompt;
  if (typeof result === 'string') return result;
  throw Error('Invalid agent prompt response');
}
function explain(e){const m=String(e?.message||e||'');return /rate.limit|quota|429/i.test(m)?'Модель временно достигла лимита.':/timeout|timed out/i.test(m)?'Подтверждение от Монады задерживается.':/not found|404/i.test(m)?'Данные не найдены.':'Не удалось обратиться к Монаде.';}
let setupPromise;
async function ensureSchema(sql){if(!setupPromise)setupPromise=(async()=>{
  await sql`CREATE TABLE IF NOT EXISTS dom_room_agent_members(
    room_id BIGINT NOT NULL, agent_id TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'mention',
    added_by TEXT NOT NULL, added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(room_id,agent_id),CHECK(mode IN ('mention','listen','active')))`;
  await sql`CREATE TABLE IF NOT EXISTS dom_room_agent_events(
    id BIGSERIAL PRIMARY KEY,room_id BIGINT NOT NULL,message_id BIGINT NOT NULL,
    agent_id TEXT NOT NULL,instruction TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',
    handoff_id TEXT,reply TEXT,error_code TEXT,attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(room_id,message_id,agent_id))`;
  await sql`CREATE TABLE IF NOT EXISTS dom_agent_prompt_versions(
    id BIGSERIAL PRIMARY KEY,agent_id TEXT NOT NULL,previous_prompt TEXT NOT NULL,
    new_sha256 TEXT NOT NULL,changed_by TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE dom_room_agent_members ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'agent'`;
  await sql`CREATE TABLE IF NOT EXISTS dom_room_harness_versions(
    room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    version INTEGER NOT NULL, context TEXT NOT NULL, changed_by UUID NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(room_id,version))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dom_room_agent_events_status ON dom_room_agent_events(status,created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dom_agent_versions ON dom_agent_prompt_versions(agent_id,created_at DESC)`;
})().catch(e=>{setupPromise=null;throw e});return setupPromise;}
async function identity(req,sql,monad){
  const id=req.user?.sub||req.user?.id;if(!id||req.monadReadonly)return null;
  const found=await sql`SELECT id,email,role,monad_human_id FROM users WHERE id=${id} LIMIT 1`;
  const u=found[0];if(!u)return null;
  const human=u.monad_human_id || null;
  return {...u,human,admin:['admin','superadmin','founder'].includes(u.role),founder:['superadmin','founder'].includes(u.role)&&['nikita','takhir'].includes(human)};
}
async function roomGate(req,sql,monad){
  const u=await identity(req,sql,monad),roomId=Number(req.params.id);
  if(!u||!Number.isSafeInteger(roomId)||roomId<1)return {status:400};
  const rooms=await sql`SELECT id,created_by,dm_thread_id FROM chat_rooms WHERE id=${roomId} LIMIT 1`;
  if(!rooms.length)return {status:404};
  const membership=await sql`SELECT role FROM chat_room_members WHERE room_id=${roomId} AND user_id=${u.id} LIMIT 1`;
  const role=membership[0]?.role||null;
  if(!role)return {status:403};
  return {status:200,u,roomId,direct:!!rooms[0].dm_thread_id,canManage:role==='admin'||String(rooms[0].created_by)===String(u.id)};
}
async function recordRoomMessage({sql,roomId,messageId,body}){
  await ensureSchema(sql);
  const members=await sql`SELECT agent_id,mode FROM dom_room_agent_members WHERE room_id=${roomId}`;
  for(const a of members){
    const escaped=a.agent_id.replace(/[.*+?^$\x7b\x7d()|[\]\\]/g,'\\$&');
    const mentioned=new RegExp('(?:^|\\s)@'+escaped+'(?=\\b|\\s|$)','i').test(body);
    if(a.mode==='mention'&&!mentioned)continue;
    const instruction=a.mode==='listen'&&!mentioned?'observe':'reply';
    await sql`INSERT INTO dom_room_agent_events(room_id,message_id,agent_id,instruction)
       VALUES(${roomId},${messageId},${a.agent_id},${instruction})
       ON CONFLICT(room_id,message_id,agent_id) DO NOTHING`;
  }
}
async function directory(monad) {
  const [raw,architecture,placements] = await Promise.all([
    monad.mcpCall('list_agents', {}),
    monad.mcpCall('get_architecture', {}).catch(()=>null),
    monad.loadPlacements().catch(()=>({}))
  ]);
  const registry=arr(raw);
  const arch=architecture?.architecture||architecture||{};
  const canon=monad.applyCanonThroughlines(placements,registry);
  const personas=new Set((arch.people||[]).map(person=>person.entry_persona));
  const contours=new Map((arch.horizontal?.contours||[]).map(contour=>[contour.persona,contour]));
  return registry.map(agent=>{
    const id=agent.agent_id;
    const contour=contours.get(id);
    const place=monad.placementOf(id,canon);
    const meta=monad.kindOfPlacement(place,canon);
    const kind=meta.type==='human_persona'||personas.has(id)?'persona':
      meta.type==='contour_persona'||contour&&!['project_persona','skill','agent'].includes(meta.type)?'contour':'agent';
    const cells=monad.cellsOfPlacement(place);
    return {agent_id:id,name:agent.name||contour?.label||id,aliases:[contour?.label,place?.name,meta.contour].filter(Boolean),
      orchestrator:place?.parent||null,placement:cells[0]||null,cells,
      owner:agent.owner,status:agent.status,platform:agent.platform,version:agent.version,domains:agent.domains,
      chat_capable:kind!=='agent'||(agent.domains||[]).includes('domunity'),kind};
  });
}
function canInvite(agent, caller) {
  return agent.status === 'active' && agent.chat_capable &&
    ((caller.human && agent.owner === caller.human) || (agent.domains || []).includes('domunity_public'));
}
async function latestHarness(sql,roomId){
  const [current]=await sql`SELECT version,context,changed_at FROM dom_room_harness_versions
    WHERE room_id=${roomId} ORDER BY version DESC LIMIT 1`;
  return current || {version:0,context:''};
}
function install(app,{requireAuth,sql,monadSvc}){
  const go=fn=>(req,res)=>Promise.resolve(fn(req,res)).catch(e=>{console.error('[dom-monad-v07]',e?.message);if(!res.headersSent)res.status(502).json({ok:false,error:explain(e),code:'MONAD_REQUEST_FAILED'});});
  const found=async(req,res)=>{const u=await identity(req,sql,monadSvc);if(!u?.founder){res.status(403).json({ok:false,error:'Только суперадминистраторы Монады могут редактировать инструкции агентов.'});return null;}return u;};
  const admin=async(req,res)=>{
    const u=await identity(req,sql,monadSvc);
    if(!u?.admin){res.status(403).json({ok:false,error:'admin_required'});return null;}
    return u;
  };
  const gate=async(req,res)=>{const g=await roomGate(req,sql,monadSvc);if(g.status!==200){res.status(g.status).json({ok:false,error:'Беседа не найдена или доступ запрещён.'});return null;}return g;};
  const ready=async()=>{await ensureSchema(sql);if(!monadSvc.configured())throw Error('Monad connection not configured');};
  app.get('/api/dom-monad/agents',requireAuth,go(async(req,res)=>{
    await ready();const u=await identity(req,sql,monadSvc);
    if(!u)return res.status(401).json({error:'authentication_required'});
    const agents=await directory(monadSvc);
    res.json({ok:true,can_edit_harness:u.founder,can_register:u.founder&&!!process.env.DOM_ACCOUNT_ADMIN_KEY,agents:agents.filter(a=>u.admin||canInvite(a,u)).map(a=>({...a,can_invite:canInvite(a,u)}))});
  }));
  app.get('/api/dom-monad/admin/agent/:agentId/harness',requireAuth,go(async(req,res)=>{
    const u=await admin(req,res);if(!u)return;await ready();
    const id=req.params.agentId;if(!validId(id))return res.status(400).json({error:'Неверный идентификатор агента.'});
    const agents=arr(await monadSvc.mcpCall('list_agents',{}));
    const agent=agents.find(a=>a.agent_id===id);if(!agent)return res.status(404).json({error:'Агент не найден.'});
    const prompt=await readPrompt(monadSvc,id);
    const canon=agent.owner ? arr(await monadSvc.mcpCall('list_canon',{source_human_id:agent.owner,include_drafts:u.founder,limit:100})) : [];
    res.json({ok:true,agent,system_prompt:prompt,etag:crypto.createHash('sha256').update(prompt).digest('hex'),canon,
      sources:{system_prompt:'agents',canon:'canon_artifacts',domains:'agent_domains',
        memory:'restricted',runtime:'no_agent_snapshot'}, can_publish:u.founder&&(agent.owner===u.human||!!process.env.DOM_ACCOUNT_ADMIN_KEY),
      next_onboarding_status:u.founder&&agent.owner===u.human&&process.env.DOM_ACCOUNT_ADMIN_KEY ? nextOnboardingStatus[agent.status]||null : null});
  }));
  app.get('/api/dom-monad/admin/canon/:artifactId',requireAuth,go(async(req,res)=>{
    const u=await admin(req,res);if(!u)return;await ready();
    const canon=await monadSvc.mcpCall('get_canon',{artifact_id:String(req.params.artifactId).slice(0,160)});
    if(!canon?.artifact_id||canon.error)return res.status(404).json({error:'canon_not_found'});
    res.json({ok:true,canon,can_publish:u.founder&&(canon.source_human_id===u.human||!!process.env.DOM_ACCOUNT_ADMIN_KEY)});
  }));
  app.put('/api/dom-monad/admin/canon/:artifactId',requireAuth,go(async(req,res)=>{
    const u=await found(req,res);if(!u)return;await ready();
    const id=req.params.artifactId;
    const {content,expected_version}=req.body||{};
    if(!/^[a-z0-9][a-z0-9_.-]{0,159}$/.test(id)||!content||Array.isArray(content)||
       typeof content!=='object'||Buffer.byteLength(JSON.stringify(content),'utf8')>80000)
      return res.status(400).json({error:'invalid_canon'});
    const current=await monadSvc.mcpCall('get_canon',{artifact_id:id});
    if(current?.artifact_id!==id||current.error)return res.status(404).json({error:'canon_not_found'});
    const accountKey=process.env.DOM_ACCOUNT_ADMIN_KEY;
    if(current.source_human_id!==u.human&&!accountKey)return res.status(403).json({error:'canon_write_denied'});
    const parts=/^(\d{1,8})\.(\d{1,8})\.(\d{1,8})$/.exec(current.version||'');
    if(!parts||expected_version!==current.version)return res.status(409).json({error:'VERSION_CONFLICT'});
    const version=parts[1]+'.'+parts[2]+'.'+(Number(parts[3])+1);
    let result;
    try{
      result=await monadSvc.mcpCall('publish_canon',{artifact_id:id,content,version,expected_version,
        kind:current.kind,title:current.title,summary:current.summary,source_human_id:current.source_human_id,
        visibility:current.visibility,status:current.status,tags:current.tags,actor_agent:'persona_'+u.human,
        dom_account_key:accountKey||undefined});
    }catch(err){
      if(/canon_version_conflict/.test(err.message))return res.status(409).json({error:'VERSION_CONFLICT'});
      if(/canon_write_denied/.test(err.message))return res.status(403).json({error:'canon_write_denied'});
      throw err;
    }
    if(!result?.ok||result.artifact_id!==id||result.version!==version)throw Error('Canon update was not confirmed');
    res.json({ok:true,version});
  }));
  app.put('/api/dom-monad/admin/agent/:agentId/prompt',requireAuth,go(async(req,res)=>{
    const u=await found(req,res);if(!u)return;await ready();
    const id=req.params.agentId,prompt=String(req.body?.system_prompt||'');
    if(!validId(id)||prompt.length<10||prompt.length>60000)return res.status(400).json({error:'Некорректный текст инструкции.'});
    const current=await readPrompt(monadSvc,id);
    const etag=crypto.createHash('sha256').update(current).digest('hex');
    if(req.body?.expected_sha256!==etag)return res.status(409).json({error:'Инструкция изменилась с момента открытия. Обновите её перед публикацией.',code:'VERSION_CONFLICT'});
    if(current===prompt)return res.json({ok:true,unchanged:true});
    const args={agent_id:id,system_prompt:prompt,actor_agent:'persona_'+u.human,bump:'patch',
      expected_sha256:etag,dom_account_key:process.env.DOM_ACCOUNT_ADMIN_KEY||undefined};
    // Monad itself enforces owner/core permissions; server never bypasses denial.
    let result;
    try { result=await monadSvc.mcpCall('update_agent_prompt',args); }
    catch (err) {
      if (/version_conflict/.test(err.message)) return res.status(409).json({error:'VERSION_CONFLICT'});
      if (/denied/.test(err.message)) return res.status(403).json({error:'PROMPT_WRITE_DENIED'});
      throw err;
    }
    if(result?.agent_id!==id)throw Error('Instruction update was not confirmed');
    await sql`INSERT INTO dom_agent_prompt_versions(agent_id,previous_prompt,new_sha256,changed_by)
       VALUES(${id},${current},${crypto.createHash('sha256').update(prompt).digest('hex')},${u.id})`;
    res.json({ok:true,result});
  }));
  app.get('/api/dom-monad/admin/agent/:agentId/versions',requireAuth,go(async(req,res)=>{
    const u=await admin(req,res);if(!u)return;await ready();
    const rows=await sql`SELECT id,agent_id,changed_by,created_at,new_sha256 FROM dom_agent_prompt_versions
      WHERE agent_id=${req.params.agentId} ORDER BY created_at DESC LIMIT 40`;
    res.json({ok:true,versions:rows});
  }));
  app.get('/api/dom-monad/admin/agent/:agentId/versions/:version',requireAuth,go(async(req,res)=>{
    const u=await found(req,res);if(!u)return;await ready();
    if(!validId(req.params.agentId)||!/^\d{1,16}$/.test(req.params.version))
      return res.status(400).json({error:'invalid_version'});
    const [v]=await sql`SELECT previous_prompt FROM dom_agent_prompt_versions
      WHERE agent_id=${req.params.agentId} AND id=${req.params.version}`;
    if(!v)return res.status(404).json({error:'version_not_found'});
    res.json({ok:true,system_prompt:v.previous_prompt});
  }));
  app.post('/api/dom-monad/admin/agent/:agentId/restore',requireAuth,go(async(req,res)=>{
    const u=await found(req,res);if(!u)return;await ready();
    const id=req.params.agentId,version=Number(req.body?.version_id);
    if(!validId(id)||!Number.isSafeInteger(version))return res.status(400).json({error:'Неверная версия.'});
    const rows=await sql`SELECT previous_prompt FROM dom_agent_prompt_versions WHERE agent_id=${id} AND id=${version} LIMIT 1`;
    if(!rows.length)return res.status(404).json({error:'Версия не найдена.'});
    const before=await readPrompt(monadSvc,id);
    if(req.body?.expected_sha256!==crypto.createHash('sha256').update(before).digest('hex'))return res.status(409).json({error:'Текст был изменён другим редактором.'});
    let result;
    try {result=await monadSvc.mcpCall('update_agent_prompt',{agent_id:id,system_prompt:rows[0].previous_prompt,actor_agent:'persona_'+u.human,bump:'patch',expected_sha256:req.body.expected_sha256,dom_account_key:process.env.DOM_ACCOUNT_ADMIN_KEY||undefined});}
    catch(err){
      if (/version_conflict/.test(err.message)) return res.status(409).json({error:'VERSION_CONFLICT'});
      if (/denied/.test(err.message)) return res.status(403).json({error:'PROMPT_WRITE_DENIED'});
      throw err;
    }
    if(result?.agent_id!==id)throw Error('Instruction restore was not confirmed');
    await sql`INSERT INTO dom_agent_prompt_versions(agent_id,previous_prompt,new_sha256,changed_by)
      VALUES(${id},${before},${crypto.createHash('sha256').update(rows[0].previous_prompt).digest('hex')},${u.id})`;
    res.json({ok:true,restored:true});
  }));
  app.get('/api/dom-monad/admin/agent/:agentId/activity',requireAuth,go(async(req,res)=>{
    const u=await admin(req,res);if(!u)return;await ready();
    const id=req.params.agentId;if(!validId(id))return res.status(400).json({error:'Неверный идентификатор.'});
    const minutes=req.query.window==='7d'?10080:1440;
    const [log,activity]=await Promise.all([
      monadSvc.mcpCall('read_action_log',{agent_id:id,since_minutes:minutes,limit:500,include_heartbeat:false,include_target:true})
        .then(value=>({ok:true,items:arr(value)}),()=>({ok:false,items:[]})),
      monadSvc.mcpCall('read_agent_task_activity',{agent_id:id,since_minutes:minutes,limit:200})
        .then(value=>Array.isArray(value?.handoffs)?value.handoffs:null).catch(()=>null)
    ]);
    const headers={'X-API-Key':process.env.MONAD_API_KEY||''};
    const sources=activity!==null?[{status:'fulfilled',value:activity}]:await Promise.allSettled(['to_agent','from_agent'].map(async key=>{
      const url=monadSvc.MONAD_BASE+'/api/handoffs?hours='+(minutes/60)+'&limit=200&'+key+'='+encodeURIComponent(id);
      const result=await fetch(url,{headers,signal:AbortSignal.timeout(10000)});
      if(!result.ok)throw Error('handoff_source_'+result.status);
      const data=await result.json();
      if(!Array.isArray(data.handoffs))throw Error('handoff_source_response');
      return data.handoffs;
    }));
    const full=sources.every(source=>source.status==='fulfilled');
    let inbox=null;
    if(!full) {
      inbox=await monadSvc.mcpCall('get_inbox',{agent_id:id,limit:200,mark_read:false,ack_handoffs:false})
        .then(value=>Array.isArray(value)?value:null).catch(()=>null);
    }
    const cutoff=Date.now()-minutes*60000;
    const fallback=(inbox||[]).filter(row=>row.kind==='handoff'&&row.agent_id===id&&row.item_id&&Date.parse(row.created_at)>=cutoff)
      .map(row=>({handoff_id:row.item_id,to_agent:id,from_agent:row.from_agent,status:row.metadata?.status||row.message_type,created_at:row.created_at}));
    const known=[...fallback,...sources.flatMap(source=>source.status==='fulfilled'?source.value:[])];
    const handoffs=[...new Map(known
      .filter(h=>h.to_agent===id||h.from_agent===id).map(h=>[h.handoff_id,{
        handoff_id:h.handoff_id,status:h.status,from_agent:h.from_agent,to_agent:h.to_agent,
        created_at:h.created_at,completed_at:h.completed_at,
        description:u.founder&&h.domain&&h.domain!=='domunity'?String(h.task_description||'').slice(0,240):undefined,domain:h.domain
      }])).values()];
    const safeActions=log.items.map(a=>({action_type:a.action_type,created_at:a.created_at,
      success:a.success,duration_ms:a.duration_ms,agent_id:a.agent_id,target:a.target}));
    const times=[...safeActions.map(a=>a.created_at),...handoffs.map(h=>h.completed_at||h.created_at)].filter(Boolean);
    const last=times.reduce((max,t)=>!max||Date.parse(t)>Date.parse(max)?t:max,null);
    const statuses=Object.create(null);
    for(const h of handoffs)statuses[h.status]=(statuses[h.status]||0)+1;
    res.json({ok:true,actions:safeActions,handoffs,statuses,last_event_at:last,
      actions_available:log.ok,handoffs_available:full||inbox!==null||sources.some(source=>source.status==='fulfilled'),
      handoffs_partial:!full,
      interactions:[...new Set(handoffs.map(h=>h.from_agent===id?h.to_agent:h.from_agent).filter(Boolean))]});
  }));
  app.get('/api/chat/rooms/:id/agents',requireAuth,go(async(req,res)=>{
    const g=await gate(req,res);if(!g)return;await ready();
    const members=await sql`SELECT agent_id,kind,mode,added_at FROM dom_room_agent_members WHERE room_id=${g.roomId} ORDER BY added_at`;
    const registry=members.length ? new Map((await directory(monadSvc)).map(a=>[a.agent_id,a])) : new Map();
    const people=await sql`SELECT u.id,u.display_name AS name,m.role FROM chat_room_members m
      JOIN users u ON u.id=m.user_id WHERE m.room_id=${g.roomId} ORDER BY m.joined_at`;
    res.json({ok:true,people,agents:members.map(member=>({...registry.get(member.agent_id),...member})),
      can_manage:g.canManage,direct:g.direct,can_edit_harness:g.u.founder,harness:await latestHarness(sql,g.roomId)});
  }));
  app.post('/api/chat/rooms/:id/agents',requireAuth,go(async(req,res)=>{
    const g=await gate(req,res);if(!g)return;if(!g.canManage)return res.status(403).json({error:'room_manage_required'});await ready();
    const id=String(req.body?.agent_id||''),mode=g.direct?'mention':String(req.body?.mode||'mention');
    if(!validId(id)||!['mention','listen','active'].includes(mode))return res.status(400).json({error:'invalid_participant'});
    const registered=(await directory(monadSvc)).find(a=>a.agent_id===id);
    if(!registered||!canInvite(registered,g.u))return res.status(403).json({error:'agent_unavailable'});
    await sql`INSERT INTO dom_room_agent_members(room_id,agent_id,kind,mode,added_by)
      VALUES(${g.roomId},${id},${registered.kind},${mode},${g.u.id})
      ON CONFLICT(room_id,agent_id) DO UPDATE SET mode=EXCLUDED.mode, kind=EXCLUDED.kind, added_by=EXCLUDED.added_by`;
    res.json({ok:true,agent_id:id,kind:registered.kind,mode});
  }));
  app.delete('/api/chat/rooms/:id/agents/:agentId',requireAuth,go(async(req,res)=>{
    const g=await gate(req,res);if(!g)return;if(!g.canManage)return res.status(403).json({error:'room_manage_required'});await ready();
    const id=req.params.agentId;
    await sql.transaction([
      sql`DELETE FROM dom_room_agent_members WHERE room_id=${g.roomId} AND agent_id=${id}`,
      sql`UPDATE dom_room_agent_events SET status='revoked',updated_at=now()
        WHERE room_id=${g.roomId} AND agent_id=${id} AND status IN ('pending','sending','queued','accepted','in_progress')`
    ]);
    res.json({ok:true});
  }));
  app.post('/api/chat/rooms/:id/members',requireAuth,go(async(req,res)=>{
    const g=await gate(req,res);if(!g)return;
    if(!g.canManage||g.direct)return res.status(403).json({error:'room_manage_required'});
    const id=String(req.body?.user_id||'');
    if(!/^[a-f0-9-]{36}$/i.test(id))return res.status(400).json({error:'invalid_user'});
    const [person]=await sql`SELECT id FROM users WHERE id=${id}`;
    if(!person)return res.status(404).json({error:'user_not_found'});
    await sql`INSERT INTO chat_room_members(room_id,user_id) VALUES(${g.roomId},${id}) ON CONFLICT DO NOTHING`;
    res.json({ok:true});
  }));
  app.get('/api/chat/rooms/:id/harness/versions',requireAuth,go(async(req,res)=>{
    const g=await gate(req,res);if(!g)return;await ready();
    const versions=await sql`SELECT version,context,changed_at FROM dom_room_harness_versions
      WHERE room_id=${g.roomId} ORDER BY version DESC LIMIT 30`;
    res.json({ok:true,versions});
  }));
  app.put('/api/chat/rooms/:id/harness',requireAuth,go(async(req,res)=>{
    const g=await gate(req,res);if(!g)return;if(!g.canManage)return res.status(403).json({error:'room_manage_required'});await ready();
    const context=req.body?.context,version=req.body?.version;
    if(typeof context!=='string'||context.length>4000||!Number.isInteger(version)||version<0)
      return res.status(400).json({error:'invalid_harness'});
    const rows=await sql`INSERT INTO dom_room_harness_versions(room_id,version,context,changed_by)
      SELECT ${g.roomId},${version+1},${context.trim()},${g.u.id}
      WHERE COALESCE((SELECT max(version) FROM dom_room_harness_versions WHERE room_id=${g.roomId}),0)=${version}
      ON CONFLICT DO NOTHING RETURNING version,context,changed_at`;
    if(!rows.length)return res.status(409).json({error:'VERSION_CONFLICT'});
    res.json({ok:true,harness:rows[0]});
  }));
  app.post('/api/dom-monad/admin/agents',requireAuth,go(async(req,res)=>{
    const u=await found(req,res);if(!u)return;await ready();
    if(!process.env.DOM_ACCOUNT_ADMIN_KEY)return res.status(503).json({error:'provisioning_unavailable'});
    const {agent_id,name,system_prompt,placement_cell,room_description} = req.body || {};
    if(!validId(agent_id)||typeof name!=='string'||!name.trim()||name.length>120||
       typeof placement_cell!=='string'||!/^L[1-7]xL[1-7]$/.test(placement_cell)||
       (room_description!=null&&(typeof room_description!=='string'||room_description.length>1500))||
       typeof system_prompt!=='string'||system_prompt.length<10||system_prompt.length>60000)
      return res.status(400).json({error:'invalid_agent'});
    const description=room_description?.trim()||'';
    let result;
    try{
      result=await monadSvc.mcpCall('register_agent',{agent_id,name,system_prompt,platform:'dom',description,
        domains:description?['domunity']:[],
        owner:u.human,create_only:true,placement_cell,dom_account_key:process.env.DOM_ACCOUNT_ADMIN_KEY});
    }catch(err){
      if(/duplicate key.*agents_pkey|agent_exists/i.test(err.message))return res.status(409).json({error:'agent_exists'});
      throw err;
    }
    if(!result?.created)return res.status(409).json({error:'agent_exists'});
    if(result.placement_cell!==placement_cell)throw Error('Agent placement was not confirmed');
    res.status(201).json({ok:true,agent_id,placement_cell,status:'pending_onboarding'});
  }));
  app.post('/api/dom-monad/admin/agent/:agentId/onboarding',requireAuth,go(async(req,res)=>{
    const u=await found(req,res);if(!u)return;await ready();
    const accountKey=process.env.DOM_ACCOUNT_ADMIN_KEY;
    if(!accountKey)return res.status(503).json({error:'provisioning_unavailable'});
    const id=req.params.agentId;
    if(!validId(id))return res.status(400).json({error:'invalid_agent'});
    const agent=arr(await monadSvc.mcpCall('list_agents',{})).find(a=>a.agent_id===id);
    if(!agent || agent.owner!==u.human)return res.status(403).json({error:'agent_owned_by_a_different_profile'});
    const next=nextOnboardingStatus[agent.status];
    if(!next || req.body?.status!==next)return res.status(409).json({error:'agent_status_changed'});
    let result;
    try{
      result=await monadSvc.mcpCall('onboard_agent',{agent_id:id,next_status:next,expected_status:agent.status,expected_owner:u.human,dom_account_key:accountKey});
    }catch(err){
      if(/agent_status_changed/.test(err.message))return res.status(409).json({error:'agent_status_changed'});
      throw err;
    }
    if(result?.agent_id!==id||result?.status!==next)throw Error('Agent status change was not confirmed');
    res.json({ok:true,agent_id:id,status:next});
  }));
  app.post('/api/chat/rooms/:id/analyze',requireAuth,go(async(req,res)=>{
    const g=await gate(req,res);if(!g)return;
    if(!g.canManage)return res.status(403).json({error:'room_manage_required'});
    await ready();
    const id=req.body?.agent_id;
    if(!validId(id))return res.status(400).json({error:'invalid_participant'});
    const [member]=await sql`SELECT 1 FROM dom_room_agent_members WHERE room_id=${g.roomId} AND agent_id=${id}`;
    if(!member)return res.status(404).json({error:'agent_not_connected'});
    const [event]=await sql`WITH request AS (
      INSERT INTO chat_room_messages(room_id,sender_id,body) VALUES(${g.roomId},${g.u.id},${'@'+id+' · Analyse recent conversation'}) RETURNING id
    )
    INSERT INTO dom_room_agent_events(room_id,message_id,agent_id,instruction)
    SELECT ${g.roomId},request.id,${id},'analyze' FROM request
    RETURNING id`;
    res.status(202).json({ok:true,event_id:event.id});
  }));
  app.get('/api/chat/rooms/:id/agent-events',requireAuth,go(async(req,res)=>{
    const g=await gate(req,res);if(!g)return;await ready();
    const events=await sql`SELECT id,room_id,message_id,agent_id,instruction,status,error_code,created_at,updated_at
      FROM dom_room_agent_events WHERE room_id=${g.roomId} ORDER BY id DESC LIMIT 100`;
    res.json({ok:true,events:events.reverse()});
  }));
  // Claim a row before contacting Monad. Reply reconciliation runs independently of viewers.
  let busy=false;
  const dispatch=async()=>{
    if(busy||!monadSvc.configured())return;
    busy=true;
    try {
      await ensureSchema(sql);
      const jobs=await sql`SELECT e.id,e.room_id,e.message_id,e.agent_id,e.instruction,e.attempts,m.body,
               member.kind,u.monad_human_id,member.added_by,r.dm_thread_id,m.created_at AS message_at
        FROM dom_room_agent_events e JOIN chat_room_messages m ON m.id=e.message_id AND m.room_id=e.room_id
        JOIN chat_rooms r ON r.id=e.room_id
        JOIN dom_room_agent_members member ON member.room_id=e.room_id AND member.agent_id=e.agent_id
        JOIN users u ON u.id::text=member.added_by
        WHERE (e.status='pending' OR (e.status='sending' AND e.updated_at<now()-interval '1 minute'))
          AND m.deleted_at IS NULL AND e.attempts<3 ORDER BY e.id LIMIT 8`;
      for(const item of jobs){
        const claimed=await sql`UPDATE dom_room_agent_events SET status='sending',attempts=attempts+1,updated_at=now()
          WHERE id=${item.id} AND (status='pending' OR (status='sending' AND updated_at<now()-interval '1 minute'))
          RETURNING id`;
        if(!claimed.length)continue;
        try {
          const registered=(await directory(monadSvc)).find(a=>a.agent_id===item.agent_id);
          if(!registered||!canInvite(registered,{human:item.monad_human_id})){
            await sql`UPDATE dom_room_agent_events SET status='failed',error_code='agent_unavailable',updated_at=now() WHERE id=${item.id} AND status='sending'`;
            continue;
          }
          const context=(await latestHarness(sql,item.room_id)).context;
          const message=String(item.body||'').slice(0,5000);
          let recent;
          if(item.instruction==='analyze'){
            const rows=item.dm_thread_id
              ? await sql`SELECT left(body,650) AS body,created_at FROM dm_messages WHERE thread_id=${item.dm_thread_id}
                  AND deleted_at IS NULL AND created_at<=${item.message_at} ORDER BY created_at DESC,id DESC LIMIT 12`
              : await sql`SELECT left(body,650) AS body,created_at FROM chat_room_messages WHERE room_id=${item.room_id}
                  AND deleted_at IS NULL AND id<${item.message_id} ORDER BY created_at DESC,id DESC LIMIT 12`;
            recent=rows.reverse();
          }
          const receipt=await monadSvc.mcpCall('handoff_task',{
            from_agent:'neuro_agent',to_agent:item.agent_id,domain:'domunity',
            dedupe_key:'domunity:'+item.room_id+':'+item.id,
            task_description:item.instruction==='analyze'?'Summarize and explain the recent conversation supplied as quoted context':
              item.instruction==='observe'?'Observe the selected DOMunity message':'Reply to the selected DOMunity message',
            payload:{channel:'domunity',room_id:item.room_id,message_id:item.message_id,event_id:item.id,
              mode:item.instruction,participant_kind:item.kind,room_context:context,message,recent_messages:recent},
            priority:5,deadline_hours:1
          });
          if(!receipt?.handoff_id)throw Error('Handoff receipt missing');
          await sql`UPDATE dom_room_agent_events SET status='queued',handoff_id=${String(receipt.handoff_id)},updated_at=now()
            WHERE id=${item.id} AND status='sending'`;
        }catch(err){
          const status=item.attempts>=2?'unconfirmed':'sending';
          await sql`UPDATE dom_room_agent_events SET status=${status},error_code=${reason(err)},updated_at=now()
            WHERE id=${item.id} AND status='sending'`;
        }
      }
      const waiting=await sql`SELECT id,handoff_id,agent_id,instruction FROM dom_room_agent_events
        WHERE status IN ('queued','accepted','in_progress') AND handoff_id IS NOT NULL
        ORDER BY updated_at LIMIT 20`;
      await Promise.all(waiting.map(async e=>{
        try{
          const response=await fetch(monadSvc.MONAD_BASE+'/api/handoffs/'+encodeURIComponent(e.handoff_id),
            {headers:{'X-API-Key':process.env.MONAD_API_KEY||''},signal:AbortSignal.timeout(4500)});
          if(!response.ok)return;
          const {handoff:h}=await response.json();
          if(h?.handoff_id!==e.handoff_id||h.to_agent!==e.agent_id)return;
          const result=h.result||{};
          const reply=e.instruction==='reply'&&h.status==='completed'
            ? (result.reply||result.text||result.answer) : null;
          const cleanReply=typeof reply==='string'&&!monadSvc.isChannelAckText(reply)?reply.trim().slice(0,15000):null;
          const status=['rejected','cancelled','failed'].includes(h.status)?'failed':
            ['accepted','in_progress','completed'].includes(h.status)?h.status:'queued';
          await sql`UPDATE dom_room_agent_events SET status=${status},reply=${cleanReply},
            error_code=${status==='failed'?reason(result.last_error):null},updated_at=now()
            WHERE id=${e.id} AND status IN ('queued','accepted','in_progress')`;
        }catch(_){}
      }));
      await sql`UPDATE dom_room_agent_events SET status='unconfirmed',error_code='timeout',updated_at=now()
        WHERE status IN ('sending','queued','accepted','in_progress') AND created_at<now()-interval '1 hour'`;
    }catch(e){console.warn('[dom-room-agents]',reason(e),e?.code||'unknown')}finally{busy=false}
  };
  const timer=setInterval(dispatch,12000);
  timer.unref?.();
}

async function roomReplies({sql,roomId}){
  await ensureSchema(sql);
  const rows=await sql`SELECT id,message_id,handoff_id,agent_id,reply,updated_at FROM dom_room_agent_events
    WHERE room_id=${roomId} AND status='completed' AND reply IS NOT NULL AND LENGTH(reply)>0
    ORDER BY updated_at DESC, id DESC LIMIT 300`;
  return rows.map(x=>({
    id:'agent-'+x.id,room_id:roomId,sender_id:null,agent_id:x.agent_id,
    sender_name:x.agent_id,role:'agent',is_agent:true,body:x.reply,in_reply_to:x.message_id,handoff_id:x.handoff_id,
    is_announcement:false,created_at:x.updated_at
  }));
}

module.exports={install,recordRoomMessage,roomReplies,explain};
