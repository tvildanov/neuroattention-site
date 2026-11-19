'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const threeDir=path.dirname(require.resolve('three/package.json'));
(async()=>{
 const graphics=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
 const executablePath=process.env.DOM_CHROMIUM_EXECUTABLE;
 const browser=await chromium.launch(executablePath
   ? {executablePath,args:['--single-process','--no-zygote',...graphics]}
   : {channel:'chrome',args:graphics});
 try{
  const page=await browser.newPage({viewport:{width:1050,height:900},hasTouch:true});
  await page.setContent('<div id="cross" style="width:900px;height:650px"></div>');
  await page.addScriptTag({path:path.join(threeDir,'build/three.min.js')});
  await page.addScriptTag({path:path.join(threeDir,'examples/js/controls/OrbitControls.js')});
  await page.addScriptTag({path:path.join(root,'assets/js/monad-cross.js')});
  await page.evaluate(async()=>{
    const Real=THREE.WebGLRenderer;
    THREE.WebGLRenderer=function(...args){
      const renderer=new Real(...args);
      const render=renderer.render.bind(renderer);
      renderer.render=(scene,camera)=>{window.renderedCross={scene,camera};return render(scene,camera);};
      return renderer;
    };
    const vertical=Array.from({length:7},(_,i)=>({id:'L'+(i+1),layer:i+1,ru:'Layer '+(i+1),
      cells:Array.from({length:7},(_,j)=>({n:j+1,code:'L'+(i+1)+'xL'+(j+1),ru:'Post '+(j+1),
        agents:j===0?[{agent_id:'fixture',name:'<Fixture agent>'}]:[]}))}));
    await window.MonadCross.mount(document.getElementById('cross'),{vertical},{onAgent:id=>window.pickedAgent=id});
  });
  const canvas=page.locator('#cross canvas');
  await canvas.waitFor({timeout:10000});
  async function coords(layer,cell) {
    return page.evaluate(({layer,cell})=>{
      const {scene,camera}=window.renderedCross;
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const all=[];
      scene.traverse(o=>{const n=o.userData.monadNav;if(n?.layerId===layer&&(cell==null?n.focus!=='cell':n.focus==='cell'&&n.cell===cell))all.push(o);});
      const v=(all[0]||{}).position.clone().project(camera);
      const box=document.querySelector('#cross canvas').getBoundingClientRect();
      return {x:box.x+(v.x+1)*box.width/2,y:box.y+(1-v.y)*box.height/2};
    },{layer,cell});
  }
  async function count(layer) {
    return page.evaluate(layer=>{
      let total=0;window.renderedCross.scene.traverse(o=>{if(o.userData.monadNav?.focus==='cell'&&(!layer||o.userData.monadNav.layerId===layer))total++;});return total;
    },layer);
  }
  for(let i=1;i<=7;i++){
    const l='L'+i;
    const spine=await coords(l,null);
    await page.mouse.click(spine.x,spine.y);
    assert.equal(await count(l),7,l+' contains seven visible posts');
    assert.equal(await count(null),7,'only selected layer visible');
    for (const j of [1,2,3,4,5,6,7]){
      const point=await coords(l,j);
      await page.mouse.click(point.x,point.y);
      const title=await page.locator('.monad-cross-detail strong').textContent();
      if(title!==l+'×L'+j) {
        console.error({layer:l,cell:j,point,canvas:await canvas.boundingBox(),hit:await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName,point)});
      }
      assert.equal(title,l+'×L'+j);
      assert.equal(await count(l),7,'selecting a post retains its layer');
      if(j===1){
        await page.locator('.monad-cross-agent').click();
        assert.equal(await page.evaluate(()=>window.pickedAgent),'fixture');
        assert.equal(await page.locator('.monad-cross-agent').textContent(),'<Fixture agent>');
      }
    }
    const box=await canvas.boundingBox();
    await page.mouse.move(box.x+box.width-80,box.y+box.height-60);
    await page.mouse.down();
    await page.mouse.move(box.x+box.width-140,box.y+box.height-90,{steps:5});
    await page.mouse.up();
    assert.equal(await count(l),7,'orbit keeps expanded posts');
    assert.equal(await page.locator('.monad-cross-detail strong').textContent(),l+'×L7','orbit keeps selected post');
    await page.locator('#monad-cross-back').click();
    assert.equal(await count(null),0);
  }
  for(const layer of ['L7','L6','L5']){
    const spine=await coords(layer,null);
    await page.mouse.click(spine.x,spine.y);
  }
  assert.equal(await count(null),21,'three rows coexist');
  const second=await coords('L6',null);
  await page.mouse.click(second.x,second.y);
  assert.equal(await count(null),14,'only the selected row closes');
  assert.equal(await count('L7'),7);
  await page.locator('#monad-cross-back').click();
  const touchRow=await coords('L7',null);
  await page.touchscreen.tap(touchRow.x,touchRow.y);
  assert.equal(await count('L7'),7,'touch expands a layer');
  const touchCell=await coords('L7',1);
  await page.touchscreen.tap(touchCell.x,touchCell.y);
  assert.equal(await page.locator('.monad-cross-detail strong').textContent(),'L7×L1','touch selects a cell');
  await page.evaluate(()=>window.MonadCross.destroy());
  assert.equal(await canvas.count(),0);
  console.log('MONAD_CROSS_BROWSER_PASS: 7 layers, 49 real canvas picks, orbit and agent card');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
