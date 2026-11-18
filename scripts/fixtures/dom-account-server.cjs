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
  if (url.hostname !== '127.0.0.1') return Promise.reject(Error('External fetch blocked by account fixture'));
  return originalFetch(input, options);
};
const config = { DATABASE_URL: 'postgres://fixture:fixture@127.0.0.1/fixture', JWT_SECRET: 'fixture-only', PORT: '4318', SMTP_USER:'subject@.invalid',SMTP_PASS:'fixture-only', MONAD_BASE_URL:'http://127.0.0.1:4319',MONAD_MCP_URL:'http://127.0.0.1:4319/mcp',MONAD_API_KEY:'fixture-only' };
Object.assign(process.env,config);

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
 for (const name of ['courses','course_blocks','journey_events','journey_links','teams','chat_rooms','chat_room_members','chat_room_messages']) await ddl(name);
 await db.exec(fs.readFileSync(path.join(migrations,'022_family_dependents.sql'),'utf8'));
 require(path.join(root,'api/server.js'));
 const response=await fetch('http://127.0.0.1:'+config.PORT+'/api/run-migrations',{method:'POST'});
 console.log('FIXTURE_SCHEMA',response.status, (await response.text()).slice(0,250));
 const bcrypt=require(path.join(root,'api/node_modules/bcryptjs'));
 const password=await bcrypt.hash('local-scenario-password',10);
 for(const [email,role,human] of [['qa-owner-a@example.invalid','superadmin','nikita'],['qa-owner-b@example.invalid','superadmin','takhir'],['qa-user@example.invalid','user',null],['qa-admin@example.invalid','admin',null]]){
   await db.query('INSERT INTO users(email,password_hash,display_name,role,monad_human_id,monad_access) VALUES ($1,$2,$3,$4,$5,$6)',[email,password,email.split('@')[0],role,human,!!human]);
 }
 console.log('ACCOUNT_FIXTURE_READY');
})().catch(err=>{console.error(err);process.exit(1)});
