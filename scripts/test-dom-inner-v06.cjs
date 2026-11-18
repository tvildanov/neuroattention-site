/* DOM internal pages release smoke tests: no credentials, no production writes. */
'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const { chromium }=require('playwright');
const root=path.resolve(__dirname,'..'),ext={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.mp4':'video/mp4'};
const srv=http.createServer((req,res)=>{
  const uri=(req.url||'/').split('?')[0],file=path.resolve(root,'.'+(uri==='/'?'/index.html':decodeURIComponent(uri)));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,buf)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',ext[path.extname(file)]||'application/octet-stream');res.end(buf);});
});
(async()=>{
 await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const port=srv.address().port;
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const lang of ['ru','en','es']){
   const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
   await context.addInitScript(l=>{localStorage.setItem('na_lang',l);localStorage.setItem('na_geo_done','1');localStorage.setItem('dom_theme','light')},lang);
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   async function open(name,sel){await page.goto('http://127.0.0.1:'+port+'/'+name+'.html',{waitUntil:'domcontentloaded'});await page.locator(sel).first().waitFor({timeout:12000});}
   const wordmark=()=>page.locator('.navbar .dom-brand-name').evaluate(element=>{
     const brand=getComputedStyle(element);
     const logo=element.closest('a').querySelector('.nav-logo-icon');
     return [brand.fontFamily,brand.fontSize,brand.fontWeight,logo.getAttribute('src')];
   });
   await open('index','#home-hero h1');
   assert.equal(await page.locator('#home-hero h1').evaluate(e=>getComputedStyle(e).color),'rgb(32, 76, 142)');
   const homepageBrand=await wordmark();
   await open('dom','.dom-v06-entities');
   assert.equal(await page.locator('#dom-unity .dom-v06-entities .dom-card').count(),6,'DOM card count');
   for(const name of ['DOM Institute','DOM Platform','DOM Space','DOM Tech','NeuroAttention Lab','Custom Group Agency'])assert.equal(await page.getByRole('heading',{name,exact:true}).count(),1,name);
   assert.equal(await page.locator('.navbar .nav-logo-dom').count(),1,'same navbar brand');
   await page.evaluate(()=>{document.documentElement.dataset.domTheme='light'});
   const heading=page.locator('[data-i18n="d.idea.title"]');
   assert.equal(await heading.evaluate(e=>getComputedStyle(e).color),'rgb(32, 76, 142)');
   assert.match(await heading.evaluate(e=>getComputedStyle(e).fontFamily),/Libre Baskerville/);
   assert.equal(await page.locator('.dom-hero h1').evaluate(e=>getComputedStyle(e).color),'rgb(32, 76, 142)');
   assert.deepEqual(await wordmark(),homepageBrand);

   await open('programs','.dom-v06-programs');
   assert.equal(await page.locator('#programs-main .dom-v06-program-card').count(),6);
   assert.equal(await page.locator('#programs-main .dom-v06-subscription').count(),1);
   const summary=page.locator('.dom-v06-program-card summary').first();
   await summary.hover();
   assert.equal(await summary.evaluate(e=>e.parentElement.classList.contains('dom-card-lit')),true);
   const level=page.locator('.level-card summary').first();
   await level.hover({position:{x:12,y:12}});
   assert.ok(await level.evaluate(e=>Math.abs(parseFloat(e.parentElement.style.getPropertyValue('--dom-pointer-x')))>0));
   await level.click();
   assert.equal(await level.evaluate(e=>e.parentElement.open),true);

   await page.emulateMedia({reducedMotion:'reduce'});
   await summary.hover();
   assert.equal(await summary.evaluate(e=>e.parentElement.classList.contains('dom-card-lit')),false);
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.locator('.dom-v06-program-card summary').first().click();
   assert.equal(await page.locator('.dom-v06-program-card').first().evaluate(e=>e.open),true);
   const order=await page.evaluate(()=>{let x=document.querySelector('#programs-main'),t=document.querySelector('[data-i18n="p.spec.title"]')?.closest('section');return x&&t&&!!(x.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_FOLLOWING)});
   assert(order,'programs ahead of specialist training');
   assert.equal(await page.locator('[data-i18n="p.research.title"]').isVisible(),false,'research section hidden');
   await open('xr','[data-dom-v06="xr-title"]');
   assert.equal((await page.locator('[data-dom-v06="xr-title"]').innerText()).replace(/\s+/g,' ').trim(),'DOM Platform');
   assert.match(await page.locator('.glass-image-frame').getAttribute('src'),/assets\/images\//);
   await open('lab','.dom-v06-research-card');
   assert.equal(await page.locator('.dom-v06-research-card').count(),4);
   assert.match(await page.locator('[data-dom-v06="lab-title"]').innerText(),/адаптац|adaptation|adaptaci/i);
   assert.equal(await page.locator('[data-dom-v06="lab-title"]').evaluate(e=>getComputedStyle(e).color),'rgb(32, 76, 142)');
   assert.deepEqual(await wordmark(),homepageBrand);
   await open('method','.method-final-layout');
   await page.locator('[data-i18n="m.practice.tools"]').waitFor();
   assert.equal(await page.locator('[data-i18n="m.modules.title"]').count(),0);
   assert.deepEqual(await page.locator('.method-final-layout a').evaluateAll(links=>links.map(a=>a.getAttribute('href'))),['test.html','programs.html']);
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.method-final-layout')).display==='grid');
   const desktop=await page.locator('.method-final-layout').evaluate(e=>Array.from(e.children,c=>c.getBoundingClientRect().left));
   assert(desktop[0]<desktop[1],'animation left of CTA');
   assert(!errors.some(e=>e.includes('SyntaxError')||e.includes('ReferenceError')),lang+': '+errors.join('; '));
   await context.close();
  }
  const mobile=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await mobile.addInitScript(()=>localStorage.setItem('na_lang','ru'));
  const page=await mobile.newPage();
  await page.goto('http://127.0.0.1:'+port+'/programs.html',{waitUntil:'domcontentloaded'});
  await page.locator('.dom-v06-program-grid').waitFor();
  const over=await page.locator('.dom-v06-program-grid').evaluate(e=>e.getBoundingClientRect().right>window.innerWidth+3);
  assert.equal(over,false,'mobile program grid fits viewport');
  await page.goto('http://127.0.0.1:'+port+'/method.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.method-final-layout')).display==='grid');
  const mobileCTA=await page.locator('.method-final-layout').evaluate(e=>Array.from(e.children,c=>c.getBoundingClientRect().top));
  assert(mobileCTA[0]<mobileCTA[1],'mobile animation above CTA');
  await mobile.close();
  console.log('DOM_INNER_RELEASE_PASS: 4 pages x RU/EN/ES + mobile disclosure');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;srv.close()});
