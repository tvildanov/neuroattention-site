'use strict';
// Read-only inventory. Run from any cwd; emits no credentials or user records.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const account=read('account.html'),server=read('api/server.js');
const paths=['account.html','api/server.js','assets/js/neuromap-chains.js','assets/js/evolution-path.js','assets/js/dom-cabinet-v07.js','assets/js/external-field.js','assets/js/body-atlas.js','assets/js/family-team.js','assets/js/collective-path.js','sw.js'];
const syntax=[];
let index=0;
for(const match of account.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
 if(/\bsrc\s*=/.test(match[1])||/type\s*=\s*["'](?:application\/ld\+json|application\/json|importmap)["']/.test(match[1]))continue;
 index++;
 try{new vm.Script(match[2],{filename:'account-inline-'+index});syntax.push({script:index,ok:true});}
 catch(e){syntax.push({script:index,ok:false,error:e.message});}
}
const routePattern=/app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
const routes=[...server.matchAll(routePattern)].map(m=>({method:m[1].toUpperCase(),path:m[2],line:server.slice(0,m.index).split('\n').length}));
const tables=[...new Set([...server.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/g)].map(m=>m[1]))].sort();
const files=paths.map(p=>({path:p,bytes:fs.statSync(path.join(root,p)).size,lines:read(p).split('\n').length,sha256:crypto.createHash('sha256').update(read(p)).digest('hex')}));
const result={schema_version:1,generated_at:new Date().toISOString(),source_commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'Static source inventory, not live DB or endpoint verification',files,account_inline_syntax:syntax,route_count:routes.length,routes,declared_tables:tables,limits:['Dynamically registered routes and external modules may add endpoints','DDL names do not establish live database state','Syntax parsing is not behavioral or security testing']};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
if(syntax.some(x=>!x.ok))process.exitCode=1;
