'use strict';
const {parseAttachment}=require('./dom-chat-controls');
const crypto=require('node:crypto');
const validId=id=>typeof id==='string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
const sizes=['small','wide','tall','panorama'];
const tones=['surface','accent','green','violet','warm'];
const kinds=['text','image','link','video','audio','file','project','collection'];
function string(s,max){if(typeof s!=='string'||s.length>max)throw Error('Invalid text');return s;}
function checked(value,choices){if(!choices.includes(value))throw Error('Invalid option');return value;}
function validate(doc){
  if(doc?.version!==1||!Array.isArray(doc.spaces)||!doc.spaces.length||doc.spaces.length>12)throw Error('Invalid spaces');
  const ids=new Set();
  function unique(id){if(!validId(id)||ids.has(id))throw Error('Invalid identifier');ids.add(id);return id;}
  const spaces=doc.spaces.map(s=>{
    if(!Array.isArray(s.cards)||s.cards.length>60)throw Error('Too many cards');
    return {id:unique(s.id),name:string(s.name,100),cards:s.cards.map(c=>{
      const url=string(c.url||'',2048);
      if(url&&!['https:','http:'].includes(new URL(url).protocol))throw Error('Invalid URL');
      if(c.media && !validId(c.media))throw Error('Invalid attachment');
      return {id:unique(c.id),kind:checked(c.kind,kinds),title:string(c.title,160),text:string(c.text,4000),url,
        size:checked(c.size,sizes),tone:checked(c.tone,tones),shared:c.shared===true,media:c.media||'',alt:string(c.alt||'',300),fit:checked(c.fit||'cover',['cover','contain'])};
    })};
  });
  if(!spaces.some(s=>s.id===doc.primary))throw Error('Invalid primary space');
  return {version:1,primary:doc.primary,spaces};
}
function attachment(raw){
  const f=parseAttachment(raw,16*1024*1024);if(!f)throw Error('Missing attachment');
  const id=crypto.createHash('sha256').update(f.base64).update('\0').update(f.name).digest('hex');
  return {id,...f};
}
async function ensureSchema(sql){
  await sql`CREATE TABLE IF NOT EXISTS dom_presence(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    revision integer NOT NULL, layout jsonb NOT NULL, media jsonb NOT NULL DEFAULT '{}')`;
}
function install(route,sql,readAccess){
  async function read(id,viewer,preview){
    const a=await readAccess(id,viewer);
    if(!a)return null;
    const owner=a.owner&&!preview;
    if(!owner&&!a.user.profile_public)return {revision:0,layout:null};
    const [row]=await sql`SELECT revision,layout FROM dom_presence WHERE user_id=${id}`;
    if(!row)return {revision:0,layout:null};
    if(!owner){
      row.layout.spaces=row.layout.spaces.map(s=>({...s,cards:s.cards.filter(c=>c.shared)})).filter(s=>s.cards.length);
      if(!row.layout.spaces.some(s=>s.id===row.layout.primary))row.layout.primary=row.layout.spaces[0]?.id;
    }
    return row;
  }
  route('get','/api/social/presence/:id',async(req,res,me)=>{
    const row=await read(req.params.id,me,req.query.preview==='1');
    if(!row)return res.sendStatus(404);
    res.json(row);
  });
  route('get','/api/social/presence/:id/media/:asset',async(req,res,me)=>{
    const {id,asset}=req.params;
    if(!validId(asset))return res.sendStatus(404);
    const view=await read(id,me,req.query.preview==='1');
    if(!view?.layout?.spaces.some(s=>s.cards.some(c=>c.media===asset)))return res.sendStatus(404);
    const [row]=await sql`SELECT media->${asset}::text AS file FROM dom_presence WHERE user_id=${id}`;
    if(!row?.file)return res.sendStatus(404);res.json(row.file);
  });
  route('put','/api/social/presence',async(req,res,me)=>{
    const {revision,layout,uploads=[],posts=[]}=req.body||{};
    let doc,newMedia={},imported;
    try{
      if(!Number.isSafeInteger(revision)||revision<0||!Array.isArray(uploads)||uploads.length>120||!Array.isArray(posts)||posts.length>1000)throw Error('Invalid archive');
      doc=validate(layout);
      for(const raw of uploads){const file=attachment(raw);if(file.id!==raw.id)throw Error('Invalid file hash');newMedia[file.id]=file;}
      imported=posts.map(p=>{
        const body=string(p.body,4000),f=parseAttachment(p.attachment,16*1024*1024);
        if(!body.trim()&&!f)throw Error('Empty post');
        const date=new Date(p.created_at);
        if(!Number.isFinite(date.getTime()))throw Error('Invalid date');
        return {body,file_name:f?.name||null,file_data:f?.base64||null,created_at:date.toISOString()};
      });
    }catch(e){return res.status(400).json({error:e.message});}
    const keys=[...new Set(doc.spaces.flatMap(s=>s.cards.map(c=>c.media).filter(Boolean)))];
    // A version check and all imported posts share one statement. A stale retry cannot duplicate posts.
    const [result]=await sql`WITH prior AS (SELECT revision,media FROM dom_presence WHERE user_id=${me}),
      files AS (SELECT COALESCE(jsonb_object_agg(key,value),'{}'::jsonb) AS data FROM jsonb_each(
        COALESCE((SELECT media FROM prior),'{}'::jsonb)||${JSON.stringify(newMedia)}::jsonb)
        WHERE key IN (SELECT jsonb_array_elements_text(${JSON.stringify(keys)}::jsonb))),
      saved AS (INSERT INTO dom_presence(user_id,revision,layout,media)
        SELECT ${me},${revision+1},${JSON.stringify(doc)}::jsonb,data FROM files
        WHERE COALESCE((SELECT revision FROM prior),0)=${revision} AND
        (SELECT count(*) FROM jsonb_object_keys(data))=${keys.length} AND octet_length(data::text)<=24000000
        ON CONFLICT(user_id) DO UPDATE SET revision=EXCLUDED.revision,layout=EXCLUDED.layout,media=EXCLUDED.media
        WHERE dom_presence.revision=${revision} RETURNING revision,user_id),
      added AS (INSERT INTO dom_profile_posts(user_id,body,file_name,file_data,created_at)
        SELECT saved.user_id,p.body,p.file_name,p.file_data,p.created_at FROM saved CROSS JOIN
        jsonb_to_recordset(${JSON.stringify(imported)}::jsonb) AS p(body text,file_name text,file_data text,created_at timestamptz)
        ORDER BY p.created_at)
      SELECT revision FROM saved`;
    if(!result)return res.status(409).json({error:'Версия изменилась, отсутствует вложение или превышен объём медиа (16 МБ).'});
    res.json(result);
  });
}
module.exports={ensureSchema,install,validate,attachment};
