'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const ct={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const srv=http.createServer((req,res)=>{let file;try{file=path.resolve(root,'.'+decodeURIComponent((req.url||'/').split('?')[0]||'/account.html'));}catch(e){res.writeHead(400);return res.end()}if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(file,(err,b)=>{if(err){res.writeHead(404);return res.end()}res.setHeader('Content-Type',ct[path.extname(file)]||'application/octet-stream');res.end(b)})});
(async()=>{
 await new Promise(done=>srv.listen(0,'127.0.0.1',done));
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  for(const [lang,width] of [['ru',1380],['en',390],['es',1366]]){
   const ctx=await browser.newContext({viewport:{width,height:840},serviceWorkers:'block'});
   await ctx.addInitScript(l=>{localStorage.setItem('na_lang',l);localStorage.setItem('na_geo_done','1');localStorage.setItem('dom_cabinet_sidebar','closed')},lang);
   const page=await ctx.newPage();
   page.on('console',m=>{if(m.type()==='error'&&/dom-cabinet-v07/.test(m.text()))console.error(m.text())});
   await page.goto('http://127.0.0.1:'+srv.address().port+'/account.html',{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('#dom-quick-record').waitFor({timeout:20000,state:'attached'});
   await page.locator('.dom-cabinet-sidebar').waitFor({timeout:20000,state:'attached'});
   await page.evaluate(()=>{document.getElementById('client-dashboard').style.setProperty('display','block','important');document.getElementById('tab-overview').style.setProperty('display','block','important');document.getElementById('rpg-dashboard').style.setProperty('display','block','important')});
   assert.equal(await page.locator('.dom-cabinet-sidebar a[data-tab]').count(),8);
   const course=page.locator('.dom-cabinet-path-group a[data-tab="courses"]');
   assert.equal(await course.count(),1,'courses remains in path hierarchy');
   assert.equal(await page.locator('a[data-tab="courses"]').count(),1,'original courses tab is reused, not cloned');
   await page.locator('.dom-cabinet-toggle').click();
   assert.equal(await page.locator('.dom-cabinet-toggle').getAttribute('aria-expanded'),'true');
   await page.locator('.dom-cabinet-toggle').click();
   const quick=page.locator('#dom-quick-record .dom-quick-trigger');
   await quick.click();assert.equal(await page.locator('#dom-quick-record .dom-quick-option').count(),4);
   const methods=['openNmSurvey','openNmThought','nmOpenSensationOverlay','nmOpenDiaryOverlay'];
   for(let i=0;i<4;i++){
    await page.evaluate(()=>{for(const n of ['openNmSurvey','openNmThought','nmOpenSensationOverlay','nmOpenDiaryOverlay'])window[n]=()=>{window.__quickCalled=n}});
    if(i)await quick.click();
    await page.locator('#dom-quick-record .dom-quick-option').nth(i).click();
    const called=await page.evaluate(()=>window.__quickCalled);
    assert.equal(called,methods[i],'quick record must call canonical NeuroMap method');
   }
   assert.equal(await page.locator('.dom-cabinet-toggle').getAttribute('aria-expanded'),'false');
   await ctx.close();
  }
  console.log('DOM_CABINET_V07_PASS');
 }finally{await browser.close();srv.close();}
})().catch(err=>{console.error(err);process.exitCode=1;srv.close()});
