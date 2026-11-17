/* Partner applications: verified email, own records and explicitly authorised review. */
'use strict';
const crypto=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const statuses=['submitted','in_review','needs_information','accepted','closed'];
function text(value,max,required=false){if(value==null&&!required)return '';if(typeof value!=='string')throw Error('invalid_fields');const s=value.trim();if(s.length>max||(required&&!s))throw Error('invalid_fields');return s;}
function application(body){const a={};a.display_name=text(body.display_name,120,true);a.competence=text(body.competence,600,true);a.proposal=text(body.proposal,5000,true);if(a.proposal.length<20)throw Error('invalid_fields');a.country=text(body.country,80);a.city=text(body.city,120);a.custom_direction=text(body.custom_direction,200);a.research_topic=text(body.research_topic,80);a.interest=['collaboration','research'].includes(body.interest)?body.interest:'collaboration';if(!Array.isArray(body.directions)||body.directions.length>20)throw Error('invalid_fields');a.directions=[...new Set(body.directions)];if(a.directions.some(id=>typeof id!=='string'||!/^[-a-z0-9]{1,80}$/.test(id)))throw Error('invalid_fields');if(!a.directions.length&&!a.custom_direction&&!a.research_topic)throw Error('choose_direction');a.portfolio_url=text(body.portfolio_url,1500);if(a.portfolio_url){let u;try{u=new URL(a.portfolio_url);}catch(e){throw Error('invalid_portfolio');}if(u.protocol!=='https:'||u.username||u.password)throw Error('invalid_portfolio');a.portfolio_url=u.href;}if(body.consent!==true)throw Error('consent_required');a.marketing_opt_in=body.marketing_opt_in===true;if(!UUID.test(body.client_request_id||''))throw Error('invalid_fields');a.client_request_id=body.client_request_id;return a;}
async function ensureSchema(sql){
  await sql`CREATE TABLE IF NOT EXISTS partner_email_challenges (
 id UUID PRIMARY KEY, email TEXT NOT NULL, display_name TEXT NOT NULL, code_hash TEXT NOT NULL,
 ip_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, expires_at TIMESTAMPTZ NOT NULL,
 consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
  await sql`CREATE INDEX IF NOT EXISTS partner_challenges_email_created ON partner_email_challenges (email, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS partner_challenges_ip_created ON partner_email_challenges (ip_hash, created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS partner_email_proofs (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, email TEXT NOT NULL,
 verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
  await sql`CREATE TABLE IF NOT EXISTS partner_applications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 client_request_id UUID NOT NULL, display_name TEXT NOT NULL, contact_email TEXT NOT NULL,
 directions JSONB NOT NULL DEFAULT '[]'::jsonb, custom_direction TEXT NOT NULL DEFAULT '',
 interest TEXT NOT NULL DEFAULT 'collaboration', research_topic TEXT NOT NULL DEFAULT '',
 country TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', competence TEXT NOT NULL,
 proposal TEXT NOT NULL, portfolio_url TEXT NOT NULL DEFAULT '', consent_version TEXT NOT NULL,
 consent_at TIMESTAMPTZ NOT NULL DEFAULT now(), marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
 status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','in_review','needs_information','accepted','closed')),
 version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (user_id,client_request_id)
)`;
  await sql`CREATE INDEX IF NOT EXISTS partner_applications_owner ON partner_applications (user_id,created_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS partner_application_permissions (
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 permission TEXT NOT NULL CHECK (permission IN ('partner_applications.read','partner_applications.manage')),
 granted_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (user_id,permission)
)`;
  await sql`CREATE TABLE IF NOT EXISTS partner_application_audit (
 id BIGSERIAL PRIMARY KEY, application_id UUID NOT NULL REFERENCES partner_applications(id) ON DELETE CASCADE,
 actor_id UUID NOT NULL REFERENCES users(id), action TEXT NOT NULL,
 previous_status TEXT, next_status TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`;
  await sql`CREATE TABLE IF NOT EXISTS partner_rate_limits (key_hash TEXT PRIMARY KEY,hits INTEGER NOT NULL DEFAULT 1,window_started TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS payload_digest TEXT NOT NULL DEFAULT ''`;
}
function install(app,{sql,requireAuth,signToken,hashPassword,mailReady,deliver,secret}){
 let ready=ensureSchema(sql).then(async()=>{const report=await require('./services/partner-schema-audit').audit(sql);console.info('[partner-schema-readonly]',JSON.stringify(report));if(!report.ok)throw Error('partner_schema_invalid');});ready.catch(()=>{});
 const codeHash=(id,code)=>crypto.createHmac('sha256',secret).update(id+':'+code).digest('hex');
 const error=(res,status,code)=>res.status(status).json({error:code});
 const wrap=handler=>async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');try{await ready;await handler(req,res);}catch(e){if(['invalid_fields','choose_direction','invalid_portfolio','consent_required'].includes(e.message))return error(res,422,e.message);console.error('[partner] request failed');return error(res,503,'partner_service_unavailable');}};
 async function principal(req,res,next){if(req.monadReadonly||!UUID.test(String(req.user?.id||'')))return error(res,403,'partner_access_denied');try{await ready;const users=await sql`SELECT id,email,display_name,role,avatar_url FROM users WHERE id=${req.user.id}`;if(!users.length)return error(res,401,'authentication_required');req.partnerUser=users[0];next();}catch(e){error(res,503,'partner_service_unavailable');}}
 async function permissions(user){const rows=await sql`SELECT permission FROM partner_application_permissions WHERE user_id=${user.id}`;return {read:user.role==='superadmin'||rows.some(r=>['partner_applications.read','partner_applications.manage'].includes(r.permission)),manage:user.role==='superadmin'||rows.some(r=>r.permission==='partner_applications.manage')};}
 const auth=[requireAuth,principal];
 app.post('/api/partner/auth/request-code',wrap(async(req,res)=>{
  const body=req.body||{},email=text(body.email,254,true).toLowerCase(),name=text(body.display_name,120,true),locale=['ru','es','en'].includes(body.locale)?body.locale:'en';if(!EMAIL.test(email))return error(res,422,'invalid_email');if(!mailReady())return error(res,503,'email_unavailable');
  const id=crypto.randomUUID(),code=String(crypto.randomInt(100000,1000000)),hash=codeHash(id,code),ip=crypto.createHmac('sha256',secret).update(String(req.ip||req.socket?.remoteAddress||'unknown')).digest('hex');
  const emailKey=crypto.createHmac('sha256',secret).update('email:'+email).digest('hex'),ipKey=crypto.createHmac('sha256',secret).update('source:'+ip).digest('hex');
  async function hit(key){const rows=await sql`INSERT INTO partner_rate_limits(key_hash) VALUES(${key})
    ON CONFLICT(key_hash) DO UPDATE SET hits=CASE WHEN partner_rate_limits.window_started<now()-interval '10 minutes' THEN 1 ELSE partner_rate_limits.hits+1 END,
    window_started=CASE WHEN partner_rate_limits.window_started<now()-interval '10 minutes' THEN now() ELSE partner_rate_limits.window_started END RETURNING hits`;return rows[0].hits;}
  const sourceHits=await hit(ipKey);if(sourceHits>12)return error(res,429,'try_later');
  const emailHits=await hit(emailKey);if(emailHits>3)return error(res,429,'try_later');
  await sql`INSERT INTO partner_email_challenges(id,email,display_name,code_hash,ip_hash,expires_at) VALUES(${id},${email},${name},${hash},${ip},now()+interval '10 minutes')`;
  const labels={ru:['Код входа в DOM Institute','Код подтверждения','Код действует 10 минут. Если вы не запрашивали вход, проигнорируйте письмо.'],en:['Your DOM Institute sign-in code','Verification code','Valid for 10 minutes. If you did not request this, ignore this email.'],es:['Tu código de acceso a DOM Institute','Código de verificación','Válido durante 10 minutos. Si no lo solicitaste, ignora este correo.']}[locale];
  try{await deliver({to:email,subject:labels[0],text:labels[1]+': '+code+'\n'+labels[2],html:'<p>'+labels[1]+'</p><p style="font-size:28px;letter-spacing:6px">'+code+'</p><p>'+labels[2]+'</p>'});}catch(e){await sql`UPDATE partner_email_challenges SET consumed_at=now() WHERE id=${id}`;return error(res,503,'email_unavailable');}
  // No address, challenge code, proposal or user name is logged.
  await sql`DELETE FROM partner_email_challenges WHERE created_at<now()-interval '1 day'`;
  await sql`DELETE FROM partner_rate_limits WHERE window_started<now()-interval '1 day'`;
  res.status(202).json({challenge_id:id,expires_in:600});
 }));
 app.post('/api/partner/auth/verify-code',wrap(async(req,res)=>{
  const body=req.body||{};if(!UUID.test(body.challenge_id||'')||typeof body.code!=='string'||!/^\d{6}$/.test(body.code))return error(res,422,'invalid_code');
  const hash=codeHash(body.challenge_id,body.code);
  const rows=await sql`UPDATE partner_email_challenges SET attempts=attempts+1,
    consumed_at=CASE WHEN code_hash=${hash} THEN now() ELSE consumed_at END
    WHERE id=${body.challenge_id} AND consumed_at IS NULL AND expires_at>now() AND attempts<5
    RETURNING email,display_name,(code_hash=${hash}) AS verified`;
  if(!rows.length||!rows[0].verified)return error(res,401,'invalid_or_expired_code');
  const challenge=rows[0];let users=await sql`SELECT id,email,display_name,role,avatar_url FROM users WHERE LOWER(email)=${challenge.email}`;
  if(users.length>1)return error(res,409,'account_conflict');
  if(!users.length){const password=await hashPassword(crypto.randomBytes(32).toString('hex'));await sql`INSERT INTO users(email,password_hash,display_name,role) VALUES(${challenge.email},${password},${challenge.display_name},'user') ON CONFLICT(email) DO NOTHING`;users=await sql`SELECT id,email,display_name,role,avatar_url FROM users WHERE LOWER(email)=${challenge.email}`;}
  if(users.length!==1)return error(res,409,'account_conflict');const user=users[0];
  await sql`INSERT INTO partner_email_proofs(user_id,email) VALUES(${user.id},${challenge.email}) ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,verified_at=now()`;
  res.json({token:signToken(user),user});
 }));
 app.get('/api/partner/me',...auth,wrap(async(req,res)=>{
  const user=req.partnerUser,access=await permissions(user),proof=await sql`SELECT verified_at FROM partner_email_proofs WHERE user_id=${user.id} AND email=LOWER(${user.email})`;
  const rows=await sql`SELECT id,display_name,contact_email,directions,custom_direction,interest,research_topic,country,city,competence,proposal,portfolio_url,status,version,created_at,updated_at FROM partner_applications WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 50`;
  res.json({user:{id:user.id,email:user.email,display_name:user.display_name,avatar_url:user.avatar_url},email_verified:proof.length>0,permissions:access,applications:rows});
 }));
 app.post('/api/partner/applications',...auth,wrap(async(req,res)=>{
  const a=application(req.body||{}),user=req.partnerUser,digest=crypto.createHash('sha256').update(JSON.stringify(a)).digest('hex');
  const proof=await sql`SELECT verified_at FROM partner_email_proofs WHERE user_id=${user.id} AND email=LOWER(${user.email})`;if(!proof.length)return error(res,403,'email_verification_required');
  // Ignore frontend identity and role fields. The owner/email come only from current DB identity.
  const rows=await sql`INSERT INTO partner_applications(user_id,client_request_id,display_name,contact_email,directions,custom_direction,interest,research_topic,country,city,competence,proposal,portfolio_url,consent_version,marketing_opt_in,payload_digest)
   VALUES(${user.id},${a.client_request_id},${a.display_name},${user.email},${JSON.stringify(a.directions)}::jsonb,${a.custom_direction},${a.interest},${a.research_topic},${a.country},${a.city},${a.competence},${a.proposal},${a.portfolio_url},'dom-partner-v1',${a.marketing_opt_in},${digest})
   ON CONFLICT(user_id,client_request_id) DO NOTHING RETURNING id,status,created_at`;
  const result=rows.length?rows:await sql`SELECT id,status,created_at,payload_digest FROM partner_applications WHERE user_id=${user.id} AND client_request_id=${a.client_request_id}`;
  if(!rows.length&&result[0]?.payload_digest!==digest)return error(res,409,'application_already_submitted');
  const receipt=result[0];res.status(rows.length?201:200).json({application:{id:receipt.id,status:receipt.status,created_at:receipt.created_at}});
 }));
 app.get('/api/partner/admin/applications',...auth,wrap(async(req,res)=>{
  const access=await permissions(req.partnerUser);if(!access.read)return error(res,403,'partner_access_denied');
  // Bounded queue. Contact/proposal details are available only to explicitly authorised reviewers.
  const rows=await sql`SELECT id,display_name,contact_email,directions,custom_direction,interest,research_topic,country,city,competence,proposal,portfolio_url,status,version,created_at,updated_at FROM partner_applications ORDER BY created_at DESC LIMIT 100`;
  res.json({applications:rows,can_manage:access.manage});
 }));
 app.patch('/api/partner/admin/applications/:id/status',...auth,wrap(async(req,res)=>{
  const access=await permissions(req.partnerUser);if(!access.manage)return error(res,403,'partner_access_denied');
  const body=req.body||{};if(!UUID.test(req.params.id)||!statuses.includes(body.status)||!Number.isInteger(body.version)||body.version<1)return error(res,422,'invalid_fields');
  const rows=await sql`WITH previous AS MATERIALIZED (SELECT id,status FROM partner_applications WHERE id=${req.params.id} AND version=${body.version} FOR UPDATE),
   changed AS (UPDATE partner_applications a SET status=${body.status},version=version+1,updated_at=now() FROM previous p WHERE a.id=p.id RETURNING a.id,a.status,a.version,a.updated_at,p.status AS previous_status),
   audit AS (INSERT INTO partner_application_audit(application_id,actor_id,action,previous_status,next_status) SELECT id,${req.partnerUser.id},'status_changed',previous_status,status FROM changed)
   SELECT id,status,version,updated_at FROM changed`;
  if(!rows.length)return error(res,409,'application_changed');res.json({application:rows[0]});
 }));
 return {ready};
}
module.exports={install,ensureSchema,application,statuses};
