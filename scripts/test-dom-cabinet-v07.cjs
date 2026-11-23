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
   if(lang==='ru'){
     let mark;
     for(const path of ['index.html','method.html','account.html']){
       await page.goto(local+'/'+path,{waitUntil:'domcontentloaded'});
       const brand=await page.evaluate(()=>{
         document.documentElement.dataset.domTheme='light';
         const read=s=>getComputedStyle(document.querySelector('.navbar .nav-logo-dom '+s));
         const word=read('.dom-brand-name'),end=read('.text-gradient-cyan'),icon=read('.nav-logo-icon');
         return [word.color,end.color,end.webkitTextFillColor,end.backgroundImage,end.boxShadow,end.textShadow,icon.filter];
       });
       assert.deepEqual(brand.slice(0,6),['rgb(20, 36, 52)','rgb(32, 76, 142)','rgb(32, 76, 142)','none','none','none'],path);
       if(mark)assert.deepEqual(brand,mark,path);
       mark=brand;
     }
   }
   await page.goto(local+'/account.html',{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('.navbar .nav-logo-dom .dom-brand-name').count(),1);
   await page.locator('#login-id').fill('qa-'+role+'@example.invalid');
   await page.locator('#login-pass').fill('local-scenario-password');
   await page.locator('form').filter({has:page.locator('#login-id')}).locator('button[type="submit"]').click();
   await page.locator('#client-dashboard').waitFor();
   const token=await page.evaluate(()=>localStorage.getItem('na_token'));
   assert.ok(token);
   const profile=await request('/api/auth/me',token);
   assert.equal(profile.status,200,JSON.stringify(profile));
   assert.equal(await page.locator('html').getAttribute('lang'),lang);
   const social=page.locator('#dom-social-self');
   await social.locator('.dom-person-title h2').waitFor();
   assert.equal(await social.locator('.dom-person-title h2').textContent(),profile.body.user.display_name);
   assert.equal(await social.locator('.dom-guide').count(),role==='user'?0:1);
   const board=social.locator('.dom-profile-field');
   if(role==='owner-b')await board.getByText('Fixture diagnostic 12',{exact:true}).waitFor();
   await board.locator('.dom-share').click();
   const editor=page.locator('dialog.dom-social-dialog[open]');
   await editor.locator('input:not([type=file])').fill('Fixture publication '+lang);
   await editor.locator('input[type=file]').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=','base64')});
   await editor.locator('.btn-solid').click();
   const post=board.locator('article').filter({has:page.getByRole('heading',{name:'Fixture publication '+lang})});
   await post.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>document.querySelector('.dom-board-media img')?.naturalWidth===1);
   await board.locator('.dom-board-bar button').nth(1).click();
   const handle=post.locator('.dom-grip.resize');
   await handle.focus();await handle.press('ArrowDown');
   const saveLayout=page.waitForResponse(r=>r.url().includes('/api/social/board')&&r.request().method()==='PUT');
   await board.locator('.dom-board-bar button').nth(1).click();assert.equal((await saveLayout).status(),200);
   if(role!=='user'){
     await social.locator('.dom-guide input').fill('Open my path');
     await social.locator('.dom-guide form button').click();
     await social.locator('.dom-guide [role=status]').filter({hasText:/guide/i}).waitFor();
   }
   const sidebar=page.locator('.dom-cabinet-toggle');
   if(await sidebar.getAttribute('aria-expanded')==='false')await sidebar.click();
   const nav=page.locator('.dom-cabinet-sidebar');
   if(role==='user'){
     await page.waitForFunction(()=>document.querySelector('[aria-controls="dom-nav-tools"]').disabled);
     assert.equal(await nav.locator('[aria-controls="dom-nav-administration"]').isVisible(),false);
   }else{
     await nav.locator('a[data-tab="evolution"]').click();
     await nav.locator('#dom-nav-evolution [data-nav-target="tools-mode-pointab"]').click();
     await page.locator('#tools-pointab-content').waitFor();
     assert.equal(await page.locator('#tools-mode-nm').isVisible(),false);
     if(await sidebar.getAttribute('aria-expanded')==='false')await sidebar.click();
     await nav.locator('a[data-tab="administration"]').click();
     await nav.locator('[aria-controls="dom-nav-people"]').click();
     await nav.locator('[data-nav-target="admin-stats"]').click();
     await page.locator('#tab-admin-stats.active').waitFor();
     if(await sidebar.getAttribute('aria-expanded')==='false')await sidebar.click();
     await nav.locator('a[data-tab="monad"]').click();
     await nav.locator('[data-nav-target="architecture"]').click();
     assert.equal(await nav.locator('#dom-nav-architecture .dom-nav-item').count(),4);
   }
   if(await sidebar.getAttribute('aria-expanded')==='false')await sidebar.click();
   await nav.locator('a[data-tab="enroll"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('#dom-nav-enroll .dom-nav-item').length===6);
   await nav.locator('#dom-nav-enroll .dom-nav-item').nth(4).click();
   assert.ok(await page.locator('#dom-cabinet-programs .dom-v06-program-card').nth(4).evaluate(el=>el.open));
   if(await sidebar.getAttribute('aria-expanded')==='false')await sidebar.click();
   const courses=page.locator('#dom-nav-evolution a[data-tab="courses"]');
   assert.equal(await courses.count(),1);
   if(await page.locator('[aria-controls="dom-nav-evolution"]').getAttribute('aria-expanded')==='false')await page.locator('[aria-controls="dom-nav-evolution"]').click();
   assert.equal(await courses.innerText(),{ru:'Мои программы',en:'My programs',es:'Mis programas'}[lang]);
   await courses.click();
   await page.locator('#tab-courses.active').waitFor();
   if(width<860)assert.equal(await sidebar.getAttribute('aria-expanded'),'false');
   if(await sidebar.getAttribute('aria-expanded')==='false')await sidebar.click();
   await page.locator('.dom-cabinet-sidebar a[data-tab="overview"]').click();
   await page.locator('#tab-overview.active').waitFor();
   const avatar=page.locator('#rpg-avatar-wrap');
   assert.match(await avatar.evaluate(el=>getComputedStyle(el).clipPath),/^polygon\(/);
   const navItem=page.locator('.dom-cabinet-sidebar a[data-tab="overview"]');
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.dom-cabinet-sidebar a[data-tab="overview"]'),'::before').maskImage.includes('data:image/svg+xml'));
   if(width>=860){
     if(await sidebar.getAttribute('aria-expanded')==='true')await sidebar.click();
     assert.match(await navItem.evaluate(el=>getComputedStyle(el,'::before').maskImage),/data:image\/svg\+xml/);
     await sidebar.click();
   }
   await page.locator('#dom-private-journal summary').click();
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
     const saved=page.waitForResponse(r=>r.url().includes('/api/observations')&&r.request().method()==='POST');
     await page.locator('#nm-save-thought').click();
     assert.equal((await saved).status(),200);
     await page.locator('#dom-quick-record .dom-quick-status').getByText(/сохранена/i).waitFor();
     await page.locator('#dom-observation-dialog[open]').waitFor();
     await page.locator('.dom-record-close').click();
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
     await page.evaluate(()=>nmOpenSensationOverlay());
     await page.locator('#sm-sens-chips [data-slug="warmth"]').click();
     if(!await page.locator('#sm-loc-chips').isVisible())await page.locator('#tools-sensation-wrap .bp-toggle-list').click();
     await page.locator('#sm-loc-chips .sm-chip[data-slug]:visible').first().click();
     const sensationSaved=page.waitForResponse(r=>r.url().includes('/api/neuromap/sensation')&&r.request().method()==='POST');
     await page.locator('#nm-sens-save-exit').click();
     assert.equal((await sensationSaved).status(),200);
     await page.locator('#nm-sens-save-exit').waitFor({state:'detached'});
     await page.evaluate(()=>nmOpenDiaryOverlay());
     await page.locator('#diary-event-text').fill('Walk from diary to sensation to emotion');
     await page.locator('#plus-area button').first().click();
     await page.locator('button[onclick="nmDiaryLinkSensation()"]').click();
     await page.locator('#sm-sens-chips [data-slug="warmth"]').click();
     if(!await page.locator('#sm-loc-chips').isVisible())await page.locator('#tools-sensation-wrap .bp-toggle-list').click();
     await page.locator('#sm-loc-chips .sm-chip[data-slug]:visible').first().click();
     await page.locator('#nm-sens-link-stub').click();
     await emotionPanel.getByRole('button',{name:/^радость$/i}).click();
     for(let i=0;i<6;i++)await page.locator('#nm-next').click();
     const endWalk=page.waitForResponse(r=>r.url().includes('/api/observations')&&r.request().method()==='POST');
     await page.locator('#nm-step-content button[onclick="nmFinishAndSave()"]').click();
     assert.equal((await endWalk).status(),200);
     await page.locator('#dom-observation-dialog[open]').waitFor();
     await page.locator('.dom-record-close').click();
     const actualWalk=(await request('/api/neuromap/v3/graph',token)).body;
     const names=new Map(actualWalk.nodes.map(n=>[n.id,n]));
     const visit=actualWalk.chains.find(c=>c.node_ids.some(id=>names.get(id)?.label==='Walk from diary to sensation to emotion'));
     assert.deepEqual(visit.node_ids.map(id=>names.get(id).type),['event','area','sensation','emotion']);
     assert.ok(actualWalk.chains.some(c=>c.id!==visit.id&&c.node_ids.length===2&&c.node_ids.includes(visit.node_ids[2])));
     const mixed=await page.evaluate(()=>{
       const t=new Date().toISOString();
       const nodes=[['a','area','Hand'],['s','sensation','Warmth'],['x','thought','Old note']].map(([id,type,label])=>({id,type,label,metadata:id==='a'?{area_kind:'body'}:{},last_seen_at:t}));
       const g=nmWithArchive({nodes,chains:[],links:[{source:'s',target:'a'},{source:'x',target:'s'}]});
       const scene=nmOccurrenceGraph(g,()=>true);
       return [g.chains.map(c=>c.node_ids.length).sort(),scene.links.length,scene.nodes.every(n=>n.chain_ids.length===1)];
     });
     assert.deepEqual(mixed,[[1,2],1,true]);
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
     const focus=String(repeated[0].id);
     // Drive actual canvas hit testing on the recorded occurrence, including touch-style taps.
     async function tapNode(label,twice=false,fullscreen=false){
       await page.evaluate(({label,twice,fullscreen})=>{
         const normal=document.getElementById('nm-canvas');
         const canvas=fullscreen?document.getElementById('nm-fs-canvas'):normal;
         const r=canvas.getBoundingClientRect(),n=nmNodes.find(node=>node.label===label);
         const options={bubbles:true,pointerId:9,isPrimary:true,pointerType:'touch',
           clientX:r.left+n.x*r.width/normal.width,clientY:r.top+n.y*r.height/normal.height};
         for(let i=0;i<(twice?2:1);i++){
           canvas.dispatchEvent(new PointerEvent('pointerdown',options));
           canvas.dispatchEvent(new PointerEvent('pointerup',options));
         }
       },{label,twice,fullscreen});
     }
     const edges=()=>page.evaluate(()=>nmLinks.map(l=>[l.source,l.target]).sort());
     const initialEdges=await edges();
     await tapNode('first');
     await page.locator('#nm-ni-chain-list [id^="nm-ch-row"]').first().waitFor();
     await tapNode('first',true);
     await page.waitForFunction(()=>nmChainFilterId&&nmNodes.filter(n=>n._hl).length===2);
     await tapNode('first',true);
     assert.equal(await page.evaluate(()=>nmChainFilterId),'');
     await tapNode('first',true);
     await tapNode('second');
     await page.waitForFunction(()=>!nmChainFilterId&&nmNiNode?.label==='second'&&nmNiChains?.length===1);
     await page.locator('#nm-ni-chain-list [id^="nm-ch-row"]').first().click();
     await page.locator('[data-nm-reset]:visible').click();
     assert.equal(await page.evaluate(()=>nmNodes.some(n=>n._hl)),false);
     const repeatFilter=page.locator('#nm-filters input[data-layer="repeat"]');
     await repeatFilter.check({force:true});
     assert.equal(await page.evaluate(()=>nmNodes.filter(n=>n.label==='repeat').length),2);
     await repeatFilter.uncheck({force:true});
     assert.deepEqual(await edges(),initialEdges);
     await page.locator('#nm-chain-filter').selectOption(focus);
     assert.equal(await page.evaluate(()=>nmNodes.filter(n=>n.label==='repeat').length),2);
     assert.equal(await page.evaluate(()=>nmNodes.filter(n=>n._hl).length),2);
     const only=page.locator('[data-nm-chain-controls]').filter({has:page.locator('#nm-chain-filter')}).locator('input');
     await only.check();
     assert.equal(await page.evaluate(()=>nmNodes.length),2);
     const release=await page.evaluate(()=>{
       const canvas=document.getElementById('nm-canvas'), rect=canvas.getBoundingClientRect();
       const [a,b]=nmNodes;
       const send=(type,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:7,isPrimary:true,clientX:rect.left+x*rect.width/canvas.width,clientY:rect.top+y*rect.height/canvas.height}));
       send('pointerdown',a.x,a.y);send('pointermove',a.x+140,a.y+50);send('pointerup',a.x,a.y);
       return {pinned:a.fx!==undefined||a.fy!==undefined,moving:Math.hypot(b.vx,b.vy)>0};
     });
     assert.deepEqual(release,{pinned:false,moving:true});

     await page.locator('#nm-chain-filter').selectOption('');
     await page.locator('#nm-3d-toggle').click();
     await page.waitForFunction(()=>nm3DGraph?.graphData().nodes.some(n=>n.label==='QA warmth'),undefined,{timeout:10000});
     await page.locator('#nm-3d-container canvas').first().waitFor();
     await page.waitForFunction(()=>nm3DGraph.graphData().nodes.some(n=>n.label==='QA joy'&&n.__threeObj?.geometry.userData.domSides===5));
     const gap=await page.evaluate(()=>{
       const link=nm3DGraph.graphData().links.find(l=>l.bodyBond&&[l.source.label,l.target.label].includes('QA warmth'));
       const {source:a,target:b}=link;
       a.x+=140;
       for(let i=0;i<15;i++)nm3DGraph.d3Force('body-contact')();
       return Math.abs(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)-(nmThreeRadius(a)+nmThreeRadius(b)-2));
     });
     assert.ok(gap<1,'a dragged sensation rejoins its body location in 3D');
     await page.evaluate(()=>{const n=nm3DGraph.graphData().nodes.find(v=>v.label==='QA joy');nm3DGraph.onNodeClick()(n);nm3DGraph.onNodeClick()(n);});
     assert.ok(await page.evaluate(()=>nmChainFilterId));
     await page.locator('[data-nm-reset]:visible').click();
     assert.deepEqual(await edges(),initialEdges);
     await page.locator('#nm-labels-toggle').click();
     await page.waitForFunction(()=>nmLabelsMode==='all'&&document.querySelectorAll('#nm-3d-container .nm-projected-labels span:not([hidden])').length>0);
     await page.locator('#nm-labels-toggle').click();
     assert.equal(await page.locator('#nm-3d-container .nm-projected-labels span:visible').count(),0);
     assert.equal(await page.evaluate(()=>nm3DGraph.graphData().links.some(link=>link.bodyBond&&!nm3DGraph.linkVisibility()(link))),true);
     await page.locator('#nm-3d-toggle').click();
     await page.locator('#nm-canvas').waitFor();
     await page.locator('#nm-3d-toggle').click();
     await page.waitForFunction(()=>nm3DGraph?.graphData().nodes.some(n=>n.label==='QA warmth'),undefined,{timeout:10000});
     await page.locator('#nm-3d-toggle').click();
     await page.locator('#nm-fs-toggle').click();
     await page.locator('#nm-fs-chain-filter').selectOption(focus);
     assert.equal(await page.locator('#nm-chain-filter').inputValue(),focus);
     await tapNode(repeated[0].node_ids.includes(paths[0].node_ids[1])?'first':'second',true,true);
     assert.equal(await page.locator('#nm-fs-chain-filter').inputValue(),'');
     await page.locator('#nm-fs-3d-toggle').click();
     await page.waitForFunction(()=>nmFs3DGraph?.graphData().nodes.some(n=>n.label==='QA warmth'),undefined,{timeout:10000});
     await page.locator('#nm-fs-3d-toggle').click();
     await page.evaluate(()=>nmToggleFullscreen());
     // Advance the real 2D solver on a dense fixture without writing diary records.
     const dense=await page.evaluate(()=>{
       const snapshot=nmV2Graph,previous=nmPrevPositions,raf=window.requestAnimationFrame;
       const now=new Date().toISOString(),nodes=[],chains=[];
       for(let i=0;i<32;i++){
         const node_ids=[];
         for(let j=0;j<3;j++){
           const id=i+'-'+j;node_ids.push(id);
           nodes.push({id,type:'thought',label:id,created_at:now,last_seen_at:now,count:1});
         }
         chains.push({id:String(i+1),node_ids,session_id:'s'+i,started_at:now});
       }
       let frame;
       window.requestAnimationFrame=cb=>{frame=cb;return -1;};
       try{
         nmV2Graph={nodes,chains,links:[]};nmPrevPositions={};buildNmGraph();
         for(let i=0;i<249;i++)frame();
         const {width:w,height:h}=document.getElementById('nm-canvas');
         const center=nmNodes.filter(n=>n.x>w*.2&&n.x<w*.8&&n.y>h*.2&&n.y<h*.8).length;
         const border=nmNodes.filter(n=>n.x<=41||n.x>=w-41||n.y<=41||n.y>=h-41).length;
         return {center,border,total:nmNodes.length};
       }finally{window.requestAnimationFrame=raf;nmV2Graph=snapshot;nmPrevPositions=previous;buildNmGraph();}
     });
     assert.equal(dense.total,96);
     assert.ok(dense.center>20&&dense.border<10,JSON.stringify(dense));
     console.log('NEUROMAP_LAYOUT_PASS',JSON.stringify(dense));
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
     await page.locator('[data-nav-target="dom-subtab-groups"]').click();
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
     const peer=room.getByText('Their message',{exact:true});
     const menu=page.locator('.dom-chat-menu');
     assert.equal(await menu.count(),0);
     await peer.click();
     assert.equal(await menu.getByRole('button').count(),2);
     await page.keyboard.press('Escape');
     await room.getByText('My message',{exact:true}).click();
     assert.equal(await menu.getByRole('button').count(),3);
     await page.keyboard.press('Escape');
     console.log('DOMUNITY_BROWSER_PASS: three message colors and contextual actions');
   }
   console.log('ACCOUNT_BROWSER_PASS',lang,width,role);
   } finally {await browser.close();}
  }
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
