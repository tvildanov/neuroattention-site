'use strict';
// Independent read-only catalog inspection: never selects application/user data.
async function audit(sql){
 const rows=await sql`SELECT c.relname AS table_name,
   has_table_privilege(current_user,c.oid,'SELECT') AS can_select,
   has_table_privilege(current_user,c.oid,'INSERT') AS can_insert,
   has_table_privilege(current_user,c.oid,'UPDATE') AS can_update
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN
 ('partner_email_challenges','partner_email_proofs','partner_applications','partner_application_permissions','partner_application_audit','partner_rate_limits')`;
 const cols=await sql`SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('partner_email_challenges','partner_email_proofs','partner_applications','partner_application_permissions','partner_application_audit','partner_rate_limits')`;
 const constraints=await sql`SELECT c.contype,c.conrelid::regclass::text AS table_name,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c
 JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.conrelid IN
 (SELECT oid FROM pg_class WHERE relname IN ('partner_email_challenges','partner_email_proofs','partner_applications','partner_application_permissions','partner_application_audit','partner_rate_limits'))`;
 const indexes=await sql`SELECT tablename,indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('partner_email_challenges','partner_email_proofs','partner_applications','partner_application_permissions','partner_application_audit','partner_rate_limits')`;
 const legacy=await sql`SELECT to_regclass('public.user_stats') IS NOT NULL AS stats_present,to_regclass('public.test_results') IS NOT NULL AS results_present`;
 const column=(table,name,type)=>cols.some(c=>c.table_name===table&&c.column_name===name&&c.data_type===type&&c.is_nullable==='NO');
 const required_columns=column('partner_email_challenges','code_hash','text')&&column('partner_email_challenges','attempts','integer')&&column('partner_email_challenges','expires_at','timestamp with time zone')&&column('partner_applications','directions','jsonb')&&column('partner_applications','payload_digest','text')&&column('partner_applications','user_id','uuid');
 const owner_foreign_keys=constraints.filter(c=>c.contype==='f'&&c.definition.includes('REFERENCES users(id)')).length>=5;
 const idempotency_unique=constraints.some(c=>c.table_name==='partner_applications'&&c.contype==='u'&&c.definition.includes('user_id, client_request_id'));
 const status_check=constraints.some(c=>c.table_name==='partner_applications'&&c.contype==='c'&&c.definition.includes('submitted')&&c.definition.includes('closed'));
 const runtime_permissions=rows.length===6&&rows.every(r=>r.can_select&&r.can_insert&&r.can_update);
 const lookup_indexes=indexes.some(i=>i.indexname==='partner_applications_owner')&&indexes.some(i=>i.indexname==='partner_challenges_email_created')&&indexes.some(i=>i.indexname==='partner_challenges_ip_created');
 return {ok:required_columns&&owner_foreign_keys&&idempotency_unique&&status_check&&runtime_permissions&&lookup_indexes,tables:rows.length,required_columns,owner_foreign_keys,idempotency_unique,status_check,runtime_permissions,lookup_indexes,legacy_profile_tables_present:!!(legacy[0]?.stats_present&&legacy[0]?.results_present)};
}
module.exports={audit};
