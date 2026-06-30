// PR#118 full diagnostic: orphan nodes in v3/graph + delete→Path propagation.
const BASE='https://neuroattention-api-production.up.railway.app';
const email=`pr118diag_${Date.now()}@test.local`; // test.local → auto-superadmin
async function j(method,path,token,body){
  const r=await fetch(BASE+path,{method,headers:Object.assign({'Content-Type':'application/json'},token?{'Authorization':'Bearer '+token}:{}),body:body?JSON.stringify(body):undefined});
  let t=await r.text(); let d; try{d=JSON.parse(t);}catch{d=t;} return {status:r.status,d};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  let reg=await j('POST','/api/auth/register',null,{email,password:'test123456',display_name:'D',country:'RU',city:'Moscow',location_lat:55.75,location_lon:37.62});
  const tok=reg.d.token; const me=await j('GET','/api/auth/me',tok);
  console.log('user role:', me.d.user?me.d.user.role:me.d.role, '|', email);

  // Flow A: 3-node chain
  let fa=await j('POST','/api/neuromap/v2/append',tok,{session_id:'A'+Date.now(),chain:[
    {type:'area',label:'грудь',valence:'neutral',metadata:{area_kind:'body',source:'sensation'}},
    {type:'sensation',label:'жар',valence:'negative',metadata:{source:'sensation'}},
    {type:'emotion',label:'злость',valence:'negative',metadata:{}}]});
  // Flow D: single-node emotion (orphan candidate)
  let fd=await j('POST','/api/neuromap/v2/append',tok,{session_id:'D'+Date.now(),chain:[
    {type:'emotion',label:'радость',valence:'positive',metadata:{}}]});
  // Flow B: 3-node chain
  let fb=await j('POST','/api/neuromap/v2/append',tok,{session_id:'B'+Date.now(),chain:[
    {type:'emotion',label:'страх',valence:'negative',metadata:{}},
    {type:'cause',label:'будущее',valence:'neutral',metadata:{}},
    {type:'thought',label:'всё плохо',valence:'negative',metadata:{}}]});
  await sleep(1200);

  // v3/graph BEFORE delete
  let g1=await j('GET','/api/neuromap/v3/graph',tok);
  const nodes1=g1.d.nodes||[], links1=g1.d.links||[];
  const linkedIds=new Set(); links1.forEach(l=>{linkedIds.add(String(l.source));linkedIds.add(String(l.target));});
  const orphans1=nodes1.filter(n=>!linkedIds.has(String(n.id)));
  console.log('\n=== v3/graph BEFORE delete ===');
  console.log('nodes',nodes1.length,'links',links1.length,'chains',(g1.d.chains||[]).length);
  console.log('ORPHAN nodes (no link):',orphans1.map(n=>n.type+':'+n.label));

  // /evolution BEFORE
  let e1=await j('GET','/api/users/me/evolution?period=all',tok);
  const ev1=e1.d.events||e1.d.nodes||[];
  console.log('evolution events count:',ev1.length, '| labels:', ev1.map(x=>(x.payload&&x.payload.label)||x.label||x.title).filter(Boolean));

  // delete the middle node of flow A (sensation 'жар')
  const midId=fa.d.node_ids[1];
  let del=await j('POST',`/api/admin/nm-node/${midId}/delete`,tok,{});
  console.log('\n=== DELETE node',String(midId).slice(0,8),'(жар) ===',del.status,JSON.stringify(del.d.deleted||del.d));

  await sleep(800);
  // v3/graph AFTER
  let g2=await j('GET','/api/neuromap/v3/graph',tok);
  const nodes2=g2.d.nodes||[], links2=g2.d.links||[];
  const linked2=new Set(); links2.forEach(l=>{linked2.add(String(l.source));linked2.add(String(l.target));});
  const orphans2=nodes2.filter(n=>!linked2.has(String(n.id)));
  console.log('\n=== v3/graph AFTER delete ===');
  console.log('nodes',nodes2.length,'links',links2.length,'chains',(g2.d.chains||[]).length);
  console.log('still has жар?', nodes2.some(n=>n.label==='жар'));
  console.log('ORPHAN nodes now:',orphans2.map(n=>n.type+':'+n.label));

  // /evolution AFTER
  let e2=await j('GET','/api/users/me/evolution?period=all',tok);
  const ev2=e2.d.events||e2.d.nodes||[];
  console.log('evolution events count:',ev2.length, '| still has жар?', ev2.some(x=>((x.payload&&x.payload.label)||x.label)==='жар'));
  console.log('labels:', ev2.map(x=>(x.payload&&x.payload.label)||x.label||x.title).filter(Boolean));
})();
