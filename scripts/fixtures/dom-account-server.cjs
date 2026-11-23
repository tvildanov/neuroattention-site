'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { PGlite } = require('@electric-sql/pglite');
const root = path.resolve(__dirname, '../..');
const db = new PGlite();
const inbox = process.env.DOM_ACCOUNT_TEST_INBOX;
if (!inbox) throw Error('Set DOM_ACCOUNT_TEST_INBOX to a temporary fixture path');
const originalFetch = global.fetch;
global.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if(url.href==='https://api.anthropic.com/v1/messages'&&options?.headers?.['x-api-key']==='fixture-guide'){
    const body=JSON.parse(options.body);
    if(body.messages.at(-1)?.content.includes('"question":"Help"') && (!body.system.includes('Fixture DOM project voice') || !body.system.includes('Fixture published lesson')))return Promise.resolve(new Response('Missing project context',{status:400}));
    return Promise.resolve(Response.json({content:[{type:'text',text:body.system.includes('Fixture correction')?'Updated guide':'Fixture guide'}]}));
  }
  // UI tests run after the scoped MCP double shuts down. Simulate a pre-router installation.
  if(url.hostname==='127.0.0.1' && url.port==='4319')return originalFetch(input,options).catch(()=>Response.json({jsonrpc:'2.0',error:{message:'Unknown tool'}}));
  if (url.hostname !== '127.0.0.1') return Promise.reject(Error('External fetch blocked by account fixture'));
  return originalFetch(input, options);
};
const config = { DATABASE_URL: 'postgres://fixture:fixture@127.0.0.1/fixture', JWT_SECRET: 'fixture-only', PORT: '4318', SMTP_USER:'subject@.invalid',SMTP_PASS:'fixture-only', MONAD_BASE_URL:'http://127.0.0.1:4319',MONAD_MCP_URL:'http://127.0.0.1:4319/mcp',MONAD_API_KEY:'fixture-only',DOM_ACCOUNT_ADMIN_KEY:'fixture-admin-only' };
Object.assign(process.env,config,{ANTHROPIC_API_KEY:'fixture-guide'});

function tag(db) {
  function sql(parts,...values) {
    const text = typeof parts === 'string' ? parts : parts.reduce((acc,p,i) => acc + (i ? '$'+i : '') + p, '');
    const run = target => target.query(text, values).then(r => r.rows);
    let promise;
    return {run, then(ok,fail) { promise ??= run(db); return promise.then(ok,fail); }};
  }
  sql.transaction = tasks => db.transaction(async tx => {
    const out = [];
    for (const task of typeof tasks === 'function' ? tasks(tag(tx)) : tasks) out.push(await task.run(tx));
    return out;
  });
  return sql;
}
const load = Module._load;
Module._load = function(name,parent,...args) {
  if(name === '@neondatabase/serverless') return { neon: () => tag(db), neonConfig: {} };
  if(name === 'nodemailer') return {createTransport:()=>({verify:async()=>{},sendMail:async message=>{
    fs.writeFileSync(inbox,JSON.stringify(message),{mode:0o600});
    return {messageId:'fixture-mail'};
  }})};
  return load.call(this,name,parent,...args);
};
const source = fs.readFileSync(path.join(root,'api/server.js'),'utf8');
const migrations = path.join(root,'migrations');
async function ddl(name) {
  const statement = source.match(new RegExp('CREATE TABLE IF NOT EXISTS '+name+' \\(.*?\\n    \\)', 's'))?.[0];
  if (!statement) throw Error('No DDL for '+name);
  await db.exec(statement);
}
(async()=>{
 await db.exec(fs.readFileSync(path.join(migrations,'002_users.sql'),'utf8'));
 for (const file of ['001_point_ab.sql','003_user_roles.sql','004_password_resets.sql','007_nm_nodes_links.sql','012_avatar_url.sql','014_rehab_applications.sql','070_monad_human_id.sql','071_monad_access.sql','074_monad_chats.sql','078_partner_applications.sql']) {
   try {await db.exec(fs.readFileSync(path.join(migrations,file),'utf8'));} catch(e){console.warn('fixture migration',file,e.message)}
 }
 for (const name of ['courses','course_blocks','journey_events','journey_links','teams','dm_threads','dm_messages','chat_rooms','chat_room_members','chat_room_messages']) await ddl(name);
 await db.exec('ALTER TABLE rehab_applications ADD COLUMN contact_name TEXT, ADD COLUMN contact_email TEXT');
 await db.exec('ALTER TABLE chat_rooms ADD COLUMN dm_thread_id INTEGER UNIQUE REFERENCES dm_threads(id) ON DELETE CASCADE');
 await db.exec(fs.readFileSync(path.join(migrations,'022_family_dependents.sql'),'utf8'));
 require(path.join(root,'api/server.js'));
 const base='http://127.0.0.1:'+config.PORT;
 for(let attempt=0;attempt<50;attempt++){
   if(await fetch(base+'/health').then(r=>r.ok).catch(()=>false))break;
   await new Promise(resolve=>setTimeout(resolve,100));
 }
 const bootstrap='00000000-0000-4000-8000-000000000001';
 await db.query("INSERT INTO users(id,email,password_hash,role) VALUES($1,'fixture-bootstrap@example.invalid','unused','superadmin')",[bootstrap]);
 const migrationToken=require(path.join(root,'api/node_modules/jsonwebtoken')).sign({sub:bootstrap},config.JWT_SECRET);
 const response=await fetch(base+'/api/run-migrations',{method:'POST',headers:{Authorization:'Bearer '+migrationToken}});
 console.log('FIXTURE_SCHEMA',response.status, (await response.text()).slice(0,250));
 await db.query('DELETE FROM users WHERE id=$1',[bootstrap]);
 const bcrypt=require(path.join(root,'api/node_modules/bcryptjs'));
 const password=await bcrypt.hash('local-scenario-password',10);
 for(const [email,role,human] of [['qa-owner-a@example.invalid','superadmin','nikita'],['qa-owner-b@example.invalid','superadmin','takhir'],['qa-user@example.invalid','user',null],['qa-admin@example.invalid','admin',null]]){
   await db.query('INSERT INTO users(email,password_hash,display_name,role,monad_human_id,monad_access) VALUES ($1,$2,$3,$4,$5,$6)',[email,password,email.split('@')[0],role,human,!!human]);
 }
 // Exercise all diagnostic slots without assigning them names from the introductory test.
 const diagnostic=require(path.join(root,'api/services/dom-social')).recordCompletedDiagnostic;
 const {rows:[subject]}=await db.query("SELECT id FROM users WHERE email='qa-owner-b@example.invalid'");
 for(let slot=1;slot<=12;slot++){
   await diagnostic(tag(db),subject.id,{slot,name:'Fixture diagnostic '+slot,completedAt:new Date(Date.UTC(2026,0,slot)).toISOString()});
   const {rows:[result]}=await db.query('SELECT slot,name FROM dom_diagnostic_profiles WHERE user_id=$1',[subject.id]);
   if(result.slot!==slot||result.name!=='Fixture diagnostic '+slot)throw Error('Diagnostic slot mismatch');
 }
 // Historical production shape: the journey survived but no nm_chains row was saved.
 for (const [type,label] of [['event','Old event'],['emotion','Old emotion']]) {
   await db.query(`WITH n AS (
     INSERT INTO nm_nodes(user_id,type,label,normalized_label,valence)
     SELECT id,$1,$2,lower($2),'neutral' FROM users WHERE email='qa-admin@example.invalid'
     RETURNING id,user_id)
     INSERT INTO journey_events(user_id,kind,layer,session_id,payload)
     SELECT user_id,'neuromap_node','emotion','fixture-old-recording',jsonb_build_object('nm_node_id',id,'source','neuromap') FROM n`,[type,label]);
 }
 await db.exec(`CREATE FUNCTION fixture_observation_failure() RETURNS trigger AS $$
 BEGIN IF NEW.payload->>'label' = 'Fixture force rollback' THEN RAISE EXCEPTION 'fixture-only write failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
 CREATE TRIGGER fixture_observation_failure BEFORE INSERT ON journey_events FOR EACH ROW EXECUTE FUNCTION fixture_observation_failure();`);
 console.log('ACCOUNT_FIXTURE_READY');
})().catch(err=>{console.error(err);process.exit(1)});
