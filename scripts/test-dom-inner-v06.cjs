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
 const browser=await chromium.launch({headless:true});
 try{
  for(const lang of ['ru','en','es']){
   const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
   await context.addInitScript(l=>{localStorage.setItem('na_lang',l);localStorage.setItem('na_geo_done','1')},lang);
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   async function open(name,sel){await page.goto('http://127.0.0.1:'+port+'/'+name+'.html',{waitUntil:'domcontentloaded'});await page.locator(sel).first().waitFor({timeout:12000});}
   await open('dom','.dom-v06-entities');
   assert.equal(await page.locator('#dom-unity .dom-v06-entities .dom-card').count(),6,'DOM card count');
   for(const name of ['DOM Institute','DOM Platform','DOM Space','DOM Tech','NeuroAttention Lab','Custom Group Agency'])assert.equal(await page.getByRole('heading',{name,exact:true}).count(),1,name);
   assert.equal(await page.locator('.navbar .nav-logo-dom').count(),1,'same navbar brand');
   await open('programs','.dom-v06-programs');
   assert.equal(await page.locator('#programs-main .dom-v06-program-card').count(),6);
   assert.equal(await page.locator('#programs-main .dom-v06-subscription').count(),1);
   await page.locator('.dom-v06-program-card summary').first().click();
   assert.equal(await page.locator('.dom-v06-program-card').first().evaluate(e=>e.open),true);
   const order=await page.evaluate(()=>{let x=document.querySelector('#programs-main'),t=document.querySelector('[data-i18n="p.spec.title"]')?.closest('section');return x&&t&&!!(x.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_FOLLOWING)});
   assert(order,'programs ahead of specialist training');
   assert.equal(await page.locator('[data-i18n="p.research.title"]').isVisible(),false,'research section hidden');
   await open('xr','[data-i18n="xr_page.title"]');
   assert.equal((await page.locator('[data-i18n="xr_page.title"]').innerText()).trim(),'DOM Platform');
   assert.match(await page.locator('.glass-image-frame').getAttribute('src'),/assets\/images\//);
   await open('lab','.dom-v06-research-card');
   assert.equal(await page.locator('.dom-v06-research-card').count(),4);
   assert.match(await page.locator('[data-i18n="l.hero.title"]').innerText(),/адаптац|adaptation|adaptaci/i);
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
  await mobile.close();
  console.log('DOM_INNER_RELEASE_PASS: 4 pages x RU/EN/ES + mobile disclosure');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;srv.close()});