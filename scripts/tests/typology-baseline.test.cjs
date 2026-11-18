'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
const config = JSON.parse(fs.readFileSync(path.join(root,'data/typology/baseline-13.draft.json'),'utf8'));
const engine = require(path.join(root,'assets/js/dom-typology-core.js'));
const at='2026-11-17T23:00:00.000Z';
function session(){ return engine.createSession(config,'test-session',at); }
function complete(){
 let s=session();
 for(const q of engine.allItems(config)){
  const value=q.format==='rank-top-two'||q.format==='select-up-to-two'?q.options.slice(0,2).map(o=>o.id):q.options[0].id;
  s=engine.setAnswer(config,s,q.id,{status:'answered',value},at);
 }
 return s;
}
test('covers 13 stats, 40 primary questions and one unscored context',()=>{
 assert.equal(engine.validateConfig(config),true);
 assert.equal(config.items.length,40);assert.equal(config.context_items.length,1);
 assert.equal(config.stats.length,13);
 for(const stat of config.stats) assert.ok(stat.source_excerpt.includes('STAT '+stat.ordinal+' ---'));
});
test('skip, not-applicable and missing remain distinct; none becomes zero',()=>{
 let s=session();
 s=engine.setAnswer(config,s,config.items[0].id,{status:'skipped'},at);
 s=engine.setAnswer(config,s,config.items[1].id,{status:'not_applicable'},at);
 const stat=engine.summarize(config,s).stats[0];
 assert.deepEqual(stat.responses,{answered:0,skipped:1,not_applicable:1,missing:1});
 assert.equal(stat.score,null);assert.equal(stat.confidence,null);
});
test('rejects unknown ids, options and impossible multiple selections',()=>{
 assert.throws(()=>engine.setAnswer(config,session(),'foreign',{status:'answered',value:'x'},at));
 assert.throws(()=>engine.setAnswer(config,session(),config.items[0].id,{status:'answered',value:'x'},at));
 const ranked=config.items.find(q=>q.format==='rank-top-two');
 assert.throws(()=>engine.setAnswer(config,session(),ranked.id,{status:'answered',value:[ranked.options[0].id]},at));
 assert.throws(()=>engine.setAnswer(config,session(),ranked.id,{status:'answered',value:[ranked.options[0].id,ranked.options[0].id]},at));
});
test('restores ranked order and all saved answers without mutating previous state',()=>{
 const q=config.items.find(q=>q.format==='rank-top-two');
 const before=session();
 const s=engine.setAnswer(config,before,q.id,{status:'answered',value:[q.options[3].id,q.options[1].id]},at);
 assert.deepEqual(before.answers,{});
 const restored=engine.restoreSession(config,JSON.parse(JSON.stringify(s)));
 assert.deepEqual(restored.answers[q.id].value,[q.options[3].id,q.options[1].id]);
});
test('rejects foreign versions, malformed cursor and fabricated completion',()=>{
 const s=session();
 assert.throws(()=>engine.restoreSession(config,{...s,instrument_version:'other'}));
 assert.throws(()=>engine.restoreSession(config,{...s,cursor:-1}));
 assert.throws(()=>engine.restoreSession(config,{...s,completed_at:at}));
 assert.throws(()=>engine.finish(config,s,at));
});
test('complete export has 13 evidence summaries and no fabricated score/profile',()=>{
 const done=engine.finish(config,complete(),at);
 const out=engine.exportSession(config,done);
 assert.equal(out.summary.completed,true);assert.equal(out.summary.stats.length,13);
 assert.equal(out.summary.profile,null);assert.equal(out.summary.wmc,null);assert.equal(out.summary.xp,null);
 for(const stat of out.summary.stats){assert.equal(stat.score,null);assert.equal(stat.responses.answered,stat.item_count);}
 assert.equal(Object.keys(out.session.answers).length,41);
});
test('changing an answer after completion invalidates completion',()=>{
 const done=engine.finish(config,complete(),at);
 const revised=engine.setAnswer(config,done,config.items[0].id,{status:'skipped'},at);
 assert.equal(revised.completed_at,null);
});
