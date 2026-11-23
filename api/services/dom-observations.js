'use strict';
const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES=new Set(['emotion','area','cause','thought','concept','event','sensation','meaning','action','image']);
async function ensureSchema(sql){
 await sql`CREATE TABLE IF NOT EXISTS dom_observations(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,operation_id UUID NOT NULL,request_hash TEXT NOT NULL,session_id TEXT NOT NULL,source JSONB NOT NULL,chain JSONB NOT NULL,legacy_entry JSONB,occurred_at TIMESTAMPTZ NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),UNIQUE(user_id,operation_id))`;
 await sql`ALTER TABLE dom_observations ADD COLUMN IF NOT EXISTS deleted_at timestamptz`;
 await sql`ALTER TABLE nm_chain_nodes ADD COLUMN IF NOT EXISTS observation_id uuid`;
 await sql`CREATE INDEX IF NOT EXISTS dom_observations_user_time ON dom_observations(user_id,occurred_at DESC,id)`;
}
function install(app,{sql,requireAuth,normalizeLabel,nmTypeToJourney}){
 let ready;const schema=()=>ready||(ready=ensureSchema(sql).catch(e=>{ready=null;throw e;}));
 app.post('/api/observations',requireAuth,async(req,res)=>{
  try{
   const b=req.body||{},user=req.user.id,when=new Date(b.occurred_at),session=String(b.session_id||b.operation_id||'');
   if(!UUID.test(b.operation_id||'')||!Array.isArray(b.chain)||!b.chain.length||b.chain.length>64||b.dependent_id||!Number.isFinite(+when)||!session||session.length>80)return res.status(400).json({error:'Invalid observation'});
   if(b.intensity!=null&&(!Number.isInteger(b.intensity)||b.intensity<1||b.intensity>10))return res.status(400).json({error:'Invalid intensity'});
   const source={kind:'self_report',text:String(b.text||''),context:String(b.context||''),intensity:b.intensity??null};
   if(source.text.length>12000||source.context.length>12000)return res.status(400).json({error:'Observation too long'});
   const chain=[];
   for(const item of b.chain){
    if(!item||!TYPES.has(item.type)||typeof item.label!=='string'||!item.label.trim()||item.label.length>12000)return res.status(400).json({error:'Invalid item'});
    const metadata=item.metadata&&typeof item.metadata==='object'&&!Array.isArray(item.metadata)?item.metadata:{};
    if(JSON.stringify(metadata).length>2000)return res.status(400).json({error:'Metadata too large'});
    const mapped=nmTypeToJourney(item.type,metadata);
    chain.push({type:item.type,label:item.label.trim(),normalized_label:normalizeLabel(item.label),valence:['positive','negative','neutral'].includes(item.valence)?item.valence:'neutral',metadata,kind:mapped.kind,layer:mapped.layer});
   }
   const legacy=b.legacy_entry&&typeof b.legacy_entry==='object'&&!Array.isArray(b.legacy_entry)?b.legacy_entry:null;
   const dateKey=String(b.date_key||when.toISOString().slice(0,10));
   if(!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)||(legacy&&JSON.stringify(legacy).length>100000))return res.status(400).json({error:'Invalid legacy view'});
   const hash=crypto.createHash('sha256').update(JSON.stringify({source,chain,legacy,session,dateKey,when:when.toISOString()})).digest('hex');
   await schema();
   // One transaction commits original, recording, graph, history and legacy view.
   // Lock the operation before the session: retries cannot increment counts or
   // create empty recordings, even when concurrent deliveries use another session.
   await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${user+':'+b.operation_id},0))`,
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${session},0))`,
    sql`WITH recording AS (
     INSERT INTO nm_chains(user_id,session_id,started_at,finished_at,source)
     SELECT ${user}::uuid,${session},${when.toISOString()}::timestamptz,${when.toISOString()}::timestamptz,'observation'
     WHERE NOT EXISTS(SELECT 1 FROM dom_observations WHERE user_id=${user}::uuid AND operation_id=${b.operation_id}::uuid)
     ON CONFLICT(session_id) DO UPDATE SET finished_at=GREATEST(nm_chains.finished_at,EXCLUDED.finished_at)
     WHERE nm_chains.user_id=EXCLUDED.user_id RETURNING id
    ), accepted AS (
     INSERT INTO dom_observations(user_id,operation_id,request_hash,session_id,source,chain,legacy_entry,occurred_at)
     SELECT ${user}::uuid,${b.operation_id}::uuid,${hash},${session},${JSON.stringify(source)}::jsonb,${JSON.stringify(chain)}::jsonb,${legacy?JSON.stringify(legacy):null}::jsonb,${when.toISOString()}::timestamptz FROM recording
     ON CONFLICT(user_id,operation_id) DO NOTHING RETURNING *
    ), items AS (
     SELECT item,ordinality::int AS pos FROM accepted,jsonb_array_elements(accepted.chain) WITH ORDINALITY AS x(item,ordinality)
    ), concepts AS (
     INSERT INTO nm_nodes(user_id,type,label,normalized_label,valence,count,last_seen_at,metadata)
     SELECT DISTINCT ON(item->>'type',item->>'normalized_label',item->>'valence') ${user}::uuid,item->>'type',item->>'label',item->>'normalized_label',item->>'valence',1,${when.toISOString()}::timestamptz,item->'metadata'
     FROM items ORDER BY item->>'type',item->>'normalized_label',item->>'valence',pos
     ON CONFLICT(user_id,type,normalized_label,valence) DO UPDATE SET count=nm_nodes.count+1,last_seen_at=EXCLUDED.last_seen_at
     RETURNING id,type,normalized_label,valence
    ), resolved AS (
     SELECT concepts.id,items.item,items.pos FROM items JOIN concepts ON concepts.type=items.item->>'type' AND concepts.normalized_label=items.item->>'normalized_label' AND concepts.valence=items.item->>'valence'
    ), prior AS (
     SELECT n.node_id,n.position FROM nm_chain_nodes n JOIN recording r ON r.id=n.chain_id ORDER BY n.position DESC LIMIT 1
    ), members AS (
     INSERT INTO nm_chain_nodes(chain_id,node_id,position,observation_id)
     SELECT recording.id,resolved.id,resolved.pos+COALESCE((SELECT MAX(n.position) FROM nm_chain_nodes n WHERE n.chain_id=recording.id),-1),(SELECT id FROM accepted) FROM recording,resolved RETURNING chain_id
    ), sessions AS (
     INSERT INTO nm_session_nodes(user_id,session_id,node_id,created_at)
     SELECT DISTINCT ${user}::uuid,${session},id,${when.toISOString()}::timestamptz FROM resolved ON CONFLICT(user_id,session_id,node_id) DO NOTHING
    ), edges AS (
     SELECT a.id AS a,b.id AS b FROM resolved a JOIN resolved b ON b.pos=a.pos+1
     UNION ALL SELECT prior.node_id,resolved.id FROM prior,resolved WHERE resolved.pos=1
    ), links AS (
     INSERT INTO nm_links(user_id,from_node_id,to_node_id,count,last_seen_at)
     SELECT ${user}::uuid,a,b,COUNT(*)::int,${when.toISOString()}::timestamptz FROM edges WHERE a<>b GROUP BY a,b
     ON CONFLICT(user_id,from_node_id,to_node_id) DO UPDATE SET count=nm_links.count+EXCLUDED.count,last_seen_at=EXCLUDED.last_seen_at
    ), events AS (
     INSERT INTO journey_events(user_id,kind,layer,payload,occurred_at,session_id)
     SELECT ${user}::uuid,item->>'kind',item->>'layer',jsonb_build_object('label',item->>'label','valence',item->>'valence','nm_type',item->>'type','nm_node_id',resolved.id,'source','neuromap','observation_id',(SELECT id FROM accepted),'position',resolved.pos,'intensity',${b.intensity??null}::int,'area_kind',item->'metadata'->>'area_kind'),${when.toISOString()}::timestamptz,${session} FROM resolved RETURNING id,payload
    ), event_links AS (
     INSERT INTO journey_links(event_a,event_b,kind,weight) SELECT a.id,b.id,'sequence',1 FROM events a JOIN events b ON (b.payload->>'position')::int=(a.payload->>'position')::int+1
    ), old_view AS (
     INSERT INTO neuro_map_entries(user_id,date_key,payload) SELECT ${user}::uuid,${dateKey},legacy_entry FROM accepted WHERE legacy_entry IS NOT NULL
    ) SELECT id FROM accepted`
   ]);
   const [record]=await sql`SELECT id,deleted_at,request_hash,session_id,source,occurred_at,created_at FROM dom_observations WHERE user_id=${user} AND operation_id=${b.operation_id}`;
   if(!record||record.request_hash!==hash)return res.status(409).json({error:'Operation or session conflicts with an existing recording'});
   if(record.deleted_at)return res.status(410).json({error:'Observation deleted'});
   delete record.deleted_at;delete record.request_hash;res.json({ok:true,record,projections:'committed'});
  }catch(e){console.warn('[observations] write failed:',e.message);res.status(503).json({error:'Save could not be confirmed; retry the same operation'});}
 });
 app.delete('/api/observations/:id',requireAuth,async(req,res)=>{
  const user=req.user.id,id=req.params.id;
  if(!UUID.test(id))return res.status(404).json({error:'Not found'});
  try{
   await schema();
   const [record]=await sql`SELECT operation_id,session_id FROM dom_observations WHERE user_id=${user} AND id=${id}`;
   if(!record)return res.status(404).json({error:'Not found'});
   const session=record.session_id;
   await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${user+':'+record.operation_id},0))`,
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${session},0))`,
    // Older observations have no marker on graph occurrences. Pair repeated
    // concepts only when their session event and membership counts agree.
    sql`CREATE TEMP TABLE removed_dom_members ON COMMIT DROP AS
      WITH members AS (
       SELECT n.*,row_number() OVER(PARTITION BY node_id ORDER BY position) AS ordinal,count(*) OVER(PARTITION BY node_id) AS total
       FROM nm_chain_nodes n JOIN nm_chains c ON c.id=n.chain_id WHERE c.user_id=${user} AND c.session_id=${session}
      ), events AS (
       SELECT payload->>'nm_node_id' AS node,payload->>'observation_id' AS observation,
       row_number() OVER(PARTITION BY payload->>'nm_node_id' ORDER BY id) AS ordinal,count(*) OVER(PARTITION BY payload->>'nm_node_id') AS total
       FROM journey_events WHERE user_id=${user} AND session_id=${session} AND payload ? 'nm_node_id'
      ) SELECT m.chain_id,m.node_id,m.position FROM members m LEFT JOIN events e ON e.node=m.node_id::text AND e.ordinal=m.ordinal AND e.total=m.total
      WHERE m.observation_id=${id}::uuid OR (m.observation_id IS NULL AND e.observation=${id}::text)`,
    sql`CREATE TEMP TABLE removed_dom_edges ON COMMIT DROP AS
      WITH seq AS (SELECT n.node_id AS a,lead(n.node_id) OVER(ORDER BY n.position) AS b,
      r.position IS NOT NULL AS removed,lead(r.position IS NOT NULL) OVER(ORDER BY n.position) AS next_removed
      FROM nm_chain_nodes n JOIN nm_chains c ON c.id=n.chain_id LEFT JOIN removed_dom_members r USING(chain_id,node_id,position)
      WHERE c.user_id=${user} AND c.session_id=${session})
      SELECT a,b,count(*)::int AS n FROM seq WHERE (removed OR next_removed) AND a<>b GROUP BY a,b`,
    sql`DELETE FROM nm_links l USING removed_dom_edges e WHERE l.user_id=${user} AND l.from_node_id=e.a AND l.to_node_id=e.b AND l.count<=e.n`,
    sql`UPDATE nm_links l SET count=l.count-e.n FROM removed_dom_edges e WHERE l.user_id=${user} AND l.from_node_id=e.a AND l.to_node_id=e.b`,
    sql`DELETE FROM nm_chain_nodes n USING removed_dom_members r WHERE n.chain_id=r.chain_id AND n.position=r.position AND n.node_id=r.node_id`,
    sql`DELETE FROM journey_events WHERE user_id=${user} AND payload->>'observation_id'=${id}`,
    sql`DELETE FROM nm_session_nodes s WHERE s.user_id=${user} AND s.session_id=${session} AND s.node_id IN(SELECT node_id FROM removed_dom_members)
      AND NOT EXISTS(SELECT 1 FROM nm_chain_nodes n JOIN nm_chains c ON c.id=n.chain_id WHERE c.session_id=${session} AND n.node_id=s.node_id)`,
    sql`DELETE FROM nm_chains c WHERE c.user_id=${user} AND c.session_id=${session} AND c.id IN(SELECT chain_id FROM removed_dom_members) AND NOT EXISTS(SELECT 1 FROM nm_chain_nodes n WHERE n.chain_id=c.id)`,
    sql`DELETE FROM nm_nodes n WHERE n.user_id=${user} AND n.id IN(SELECT node_id FROM removed_dom_members) AND n.count<=1
      AND NOT EXISTS(SELECT 1 FROM nm_chain_nodes m WHERE m.node_id=n.id) AND NOT EXISTS(SELECT 1 FROM nm_session_nodes s WHERE s.node_id=n.id)
      AND NOT EXISTS(SELECT 1 FROM nm_links l WHERE l.from_node_id=n.id OR l.to_node_id=n.id)
      AND NOT EXISTS(SELECT 1 FROM journey_events j WHERE j.user_id=${user} AND j.payload->>'nm_node_id'=n.id::text)`,
    sql`UPDATE nm_nodes SET count=greatest(1,count-1) WHERE user_id=${user} AND id IN(SELECT node_id FROM removed_dom_members)`,
    sql`DELETE FROM neuro_map_entries e USING dom_observations o WHERE o.id=${id} AND o.user_id=${user} AND e.user_id=o.user_id AND e.payload=o.legacy_entry AND e.created_at=o.created_at`,
    sql`UPDATE dom_observations SET deleted_at=now(),source='{}',chain='[]',legacy_entry=NULL WHERE id=${id} AND user_id=${user} AND deleted_at IS NULL`
   ]);res.json({ok:true});
  }catch(e){console.warn('[observations] delete:',e.message);res.status(503).json({error:'Deletion could not be confirmed'});}
 });
 app.get('/api/observations',requireAuth,async(req,res)=>{
  try{await schema();const records=await sql`SELECT id,session_id,source,chain,occurred_at,created_at FROM dom_observations WHERE user_id=${req.user.id} AND deleted_at IS NULL ORDER BY occurred_at DESC,id DESC LIMIT 50`;res.json({ok:true,records});}
  catch(e){res.status(503).json({error:'Observations unavailable'});}
 });
 app.get('/api/observations/:id',requireAuth,async(req,res)=>{
  if(!UUID.test(req.params.id))return res.status(404).json({error:'Not found'});
  try{await schema();const [record]=await sql`SELECT id,session_id,source,chain,occurred_at,created_at FROM dom_observations WHERE id=${req.params.id} AND user_id=${req.user.id} AND deleted_at IS NULL`;
   if(!record)return res.status(404).json({error:'Not found'});res.json({ok:true,record});}
  catch(e){res.status(503).json({error:'Observation unavailable'});}
 });
}
module.exports={install,ensureSchema};
