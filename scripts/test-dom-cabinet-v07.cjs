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
     ? {executablePath,args:['--single-process','--no-zygote','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
     : {channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
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
   assert.equal(await quick.getAttribute('aria-describedby'),'dom-quick-hint');
   assert.match(await page.locator('#dom-quick-hint').innerText(),{ru:/мысль, эмоция/i,en:/thought, emotion/i,es:/pensamiento, una emoción/i}[lang]);
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
     await quick.click();
     await entry.locator('button').first().click();
     const emotionPanel=page.locator('#nm-step-content');
     for(const emotion of ['спокойствие','любовь','забота','радость','тревога','раздражение','ощущение пустоты']){
       const option=emotionPanel.getByRole('button',{name:new RegExp('^'+emotion+'$','i')});
       if(['забота','ощущение пустоты'].includes(emotion)){
         // Exercise the same renderer with names outside the default chip set.
         await page.evaluate(value=>{nmSurveyState.emotions[nmSurveyState._chainIdx||0]=value},emotion);
       }else{
         await option.click();
         assert.equal(await option.getAttribute('aria-pressed'),'true');
       }
       await page.locator('#nm-next').click();
       assert.match(await emotionPanel.locator('h3').innerText(),/С какой сферой жизни связано это переживание/);
       assert.match(await emotionPanel.locator('.nm-selected-emotion').innerText(),new RegExp(emotion,'i'));
       await page.locator('#nm-prev').click();
     }
     await page.evaluate(()=>window.closeNmSurvey());
     const drawing=await page.evaluate(()=>{
       const types=['sensation','emotion','area','concept','cause','action'];
       function trace(type){
         const points=[];
         const pen={beginPath(){},arc(){points.push('circle')},moveTo(){points.push('point')},lineTo(){points.push('point')},closePath(){}};
         nmTraceNode(pen,{type},0,0,10);
         return points[0]==='circle'?'circle':points.length;
       }
       const colored={};
       for(const theme of ['dark','light']){
         document.documentElement.dataset.domTheme=theme;
         colored[theme]=types.map(type=>nmGetNodeColor({type}));
       }
       return {shapes:types.map(trace),colored};
     });
     assert.deepEqual(drawing.shapes,['circle',5,4,6,8,12]);
     assert.equal(new Set(drawing.colored.dark).size,6);
     assert.equal(new Set(drawing.colored.light).size,6);
     assert.notDeepEqual(drawing.colored.light,drawing.colored.dark);
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
     await request('/api/neuromap/v2/append',token,{chain:[
       {type:'area',label:'QA shoulder',metadata:{area_kind:'body'}},
       {type:'sensation',label:'QA warmth'},
       {type:'emotion',label:'QA joy'}
     ]});
     await page.evaluate(async()=>{
       switchTab('tools');setToolsMode('nm');await nmLoadV2Graph();
     });
     const map=page.locator('#nm-graph-wrap');
     await map.waitFor();
     assert.equal(await page.locator('#nm-filters .nm-layer-symbol').count(),6);
     assert.equal(await page.evaluate(()=>{
       const body=nmNodes.find(n=>n.label==='QA shoulder'),sensation=nmNodes.find(n=>n.label==='QA warmth');
       return body&&sensation&&sensation._anchorIds?.includes(body.id)&&nmGetNodeColor(body)!==nmGetNodeColor(sensation);
     }),true);
     await page.locator('#nm-3d-toggle').click();
     await page.waitForFunction(()=>nm3DGraph?.graphData().nodes.some(n=>n.label==='QA warmth'),undefined,{timeout:10000});
     await page.locator('#nm-3d-container canvas').first().waitFor();
     assert.equal(await page.evaluate(()=>nm3DGraph.graphData().links.some(link=>link.bodyBond&&!nm3DGraph.linkVisibility()(link))),true);
     await page.locator('#nm-3d-toggle').click();
     await page.locator('#nm-canvas').waitFor();
     await page.locator('#nm-fs-toggle').click();
     await page.locator('#nm-fs-3d-toggle').click();
     await page.waitForFunction(()=>nmFs3DGraph?.graphData().nodes.some(n=>n.label==='QA warmth'),undefined,{timeout:10000});
     await page.locator('#nm-fs-3d-toggle').click();
     await page.evaluate(()=>nmToggleFullscreen());
     await page.evaluate(()=>window.switchTab('evolution'));
     const stage=page.locator('#evo-path .evo-stage').first();
     await stage.waitFor();
     assert.equal(await stage.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 251, 242)');
     for(const expanded of ['true','false']){
       if(await sidebar.getAttribute('aria-expanded')!==expanded)await sidebar.click();
       await page.waitForFunction(()=>{
         const rail=document.querySelector('#evo-path .evo-rail');
         const navigation=document.querySelector('.dom-cabinet-sidebar');
         return rail&&navigation&&rail.getBoundingClientRect().left>=navigation.getBoundingClientRect().right;
       });
     }
     assert.equal((await request('/api/dom-monad/admin/agent/canon_fixture/harness',token)).status,403);
     await page.reload({waitUntil:'domcontentloaded'});
     await page.locator('#client-dashboard').waitFor();
     assert.ok((await request('/api/neuromap/v3/graph?range=all',token)).body.nodes.some(n=>n.label==='Authenticated quick record'));
     const timestamp=new Date().toISOString();
     const messages=[
       {id:1001,sender_id:profile.body.user.id,sender_name:'Me',body:'My message',created_at:timestamp},
       {id:1002,sender_id:'room-peer',sender_name:'Other person',body:'Their message',created_at:timestamp},
       {id:1003,sender_id:null,is_agent:true,agent_id:'fixture_agent',sender_name:'Fixture agent',body:'Agent reply',in_reply_to:1002,created_at:timestamp},
     ];
     await page.route('**/api/chat/rooms/731/messages',route=>route.fulfill({json:{messages}}));
     if(await sidebar.getAttribute('aria-expanded')==='false')await sidebar.click();
     await page.locator('.dom-cabinet-sidebar a[data-tab="domunity"]').click();
     await page.locator('#dom-subtab-groups').click();
     await page.evaluate(()=>window.domGroupOpen(731,'DOMunity bubble test'));
     const room=page.locator('#dom-group-messages');
     await room.getByText('Fixture agent · Monad',{exact:true}).waitFor();
     assert.equal(await room.locator('.dom-group-message-mine').getByText('My message').count(),1);
     assert.equal(await room.locator('[data-reply-to="1002"]').getByText('Agent reply').count(),1);
     for(const theme of ['dark','light']){
       await page.evaluate(value=>{document.documentElement.dataset.domTheme=value},theme);
       const colors=await room.locator('.dom-group-message').evaluateAll(rows=>rows.map(row=>getComputedStyle(row).backgroundColor));
       assert.equal(new Set(colors).size,3,`${theme} message backgrounds: ${colors.join(', ')}`);
     }
     console.log('DOMUNITY_BROWSER_PASS: three message colors in both themes');
   }
   console.log('ACCOUNT_BROWSER_PASS',lang,width,role);
   } finally {await browser.close();}
  }
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
