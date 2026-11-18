'use strict';
const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const base='http://127.0.0.1:4318';
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname.startsWith('/api/')) {
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const response=await fetch(base+req.url,{method:req.method,headers:{'Content-Type':req.headers['content-type']||'application/json',Authorization:req.headers.authorization||''},body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json'});return res.end(await response.text());
 }
 const file=path.join(root,decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(404);return res.end();}
 fs.readFile(file,(err,buf)=>{if(err){res.writeHead(404);return res.end()}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(buf)});
});
async function request(route,token,body){
 const response=await fetch(base+route,{method:body?'POST':'GET',headers:{Authorization:token?'Bearer '+token:'','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 return {status:response.status,body:await response.json()};
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const local='http://127.0.0.1:'+server.address().port;
 const executablePath=process.env.DOM_CHROMIUM_EXECUTABLE;
 try{
  for(const [lang,width,role] of [['ru',1360,'user'],['en',390,'owner-a'],['es',1024,'owner-b']]){
   const browser=await chromium.launch(executablePath
     ? {executablePath,args:['--single-process','--no-zygote']}
     : {channel:'chrome'});
   try {
   const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width,height:820}});
   await ctx.addInitScript(l=>{localStorage.setItem('na_lang',l);localStorage.setItem('na_geo_done','1');localStorage.setItem('na_loc_prompt_dismissed','1')},lang);
   const page=await ctx.newPage();
   page.setDefaultTimeout(12000);
   await page.route('**/*',async route=>{
     const u=new URL(route.request().url());
     if(u.origin===local)return route.continue();
     if(u.hostname==='neuroattention-api-production.up.railway.app')return route.fulfill({response:await route.fetch({url:local+u.pathname+u.search})});
     await route.abort();
   });
   await page.goto(local+'/account.html',{waitUntil:'domcontentloaded'});
   await page.locator('#login-id').fill('qa-'+role+'@example.invalid');
   await page.locator('#login-pass').fill('local-scenario-password');
   await page.locator('form').filter({has:page.locator('#login-id')}).locator('button[type="submit"]').click();
   await page.locator('#client-dashboard').waitFor();
   const token=await page.evaluate(()=>localStorage.getItem('na_token'));
   assert.ok(token);
   const profile=await request('/api/auth/me',token);
   assert.equal(profile.status,200,JSON.stringify(profile));
   assert.equal(await page.locator('html').getAttribute('lang'),lang);
   const sidebar=page.locator('.dom-cabinet-toggle');
   if(await sidebar.getAttribute('aria-expanded')==='false')await sidebar.click();
   const courses=page.locator('.dom-cabinet-path-group a[data-tab="courses"]');
   assert.equal(await courses.count(),1);
   await page.locator('.dom-cabinet-path-group summary').click();
   await courses.click();
   await page.locator('#tab-courses.active').waitFor();
   if(width<860)assert.equal(await sidebar.getAttribute('aria-expanded'),'false');
   if(await sidebar.getAttribute('aria-expanded')==='false')await sidebar.click();
   await page.locator('.dom-cabinet-sidebar a[data-tab="overview"]').click();
   await page.locator('#tab-overview.active').waitFor();
   const quick=page.locator('#dom-quick-record .dom-quick-trigger');
   await quick.click();
   const entry=page.locator('#dom-quick-popup #nm-entry-actions');
   assert.equal(await entry.locator('button').count(),4);
   await page.locator('.dom-quick-expand').click();
   assert.equal(await page.locator('#dom-quick-popup').evaluate(x=>x.classList.contains('dom-quick-expanded')),true);
   if(role==='user'){
     await entry.locator('button').nth(1).click();
     const thought=page.locator('#nm-thought-input');
     await thought.fill('Authenticated quick record');
     const saved=page.waitForResponse(r=>r.url().includes('/api/neuromap/v2/append')&&r.request().method()==='POST');
     await page.locator('#nm-save-thought').click();
     assert.equal((await saved).status(),200);
     await page.locator('#dom-quick-record .dom-quick-status').getByText(/сохранена/i).waitFor();
     const paths=[];
     for(const label of ['first','second']){
       const append=await request('/api/neuromap/v2/append',token,{chain:[{type:'emotion',label:'repeat'},{type:'thought',label}]});
       assert.equal(append.status,200,JSON.stringify(append));paths.push(append.body);
     }
     assert.equal(paths[0].node_ids[0],paths[1].node_ids[0]);
     const graph=await request('/api/neuromap/v3/graph?range=all',token);
     assert.equal(graph.status,200,JSON.stringify(graph));
     const repeated=graph.body.chains.filter(c=>c.node_ids.includes(paths[0].node_ids[0]));
     assert.equal(repeated.length,2);
     assert.notEqual(repeated[0].session_id,repeated[1].session_id);
     const mapped=require('../assets/js/neuromap-chains.js')(graph.body,()=>true);
     const nodes=mapped.nodes.filter(n=>n.concept_id===paths[0].node_ids[0]);
     assert.equal(nodes.length,2);
     assert.ok(!mapped.links.some(l=>nodes.some(n=>n.id===l.source)&&nodes.some(n=>n.id===l.target)));
     assert.equal((await request('/api/dom-monad/admin/agent/canon_fixture/harness',token)).status,403);
     await page.reload({waitUntil:'domcontentloaded'});
     await page.locator('#client-dashboard').waitFor();
     assert.ok((await request('/api/neuromap/v3/graph?range=all',token)).body.nodes.some(n=>n.label==='Authenticated quick record'));
   }
   console.log('ACCOUNT_BROWSER_PASS',lang,width,role);
   } finally {await browser.close();}
  }
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
