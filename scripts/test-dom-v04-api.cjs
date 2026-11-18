'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/profile-stats.json')));assert.ok(Object.keys(config.profiles).length);for(const p of Object.values(config.profiles)){assert.equal(Object.keys(p.stats).length,13);for(const v of Object.values(p.stats))assert.ok(Number.isFinite(v));}
const {latestWind}=require('../api/services/external/noaa'),{isoUtc}=require('../api/services/external/_util');
// Captured NOAA object shape; malformed and inactive entries below are explicit test fixtures.
const row={time_tag:'2026-11-16T06:23:00',active:true,source:'SOLAR1',proton_speed:315.9,proton_density:1.33};assert.deepEqual(latestWind([row]),{time:'2026-11-16T06:23:00.000Z',speed:315.9,density:1.33,source:'SOLAR1'});assert.equal(latestWind([{...row,active:false}]),null);assert.equal(latestWind([{...row,proton_speed:null}]),null);assert.equal(latestWind([{...row,proton_speed:-999}]),null);assert.equal(latestWind([{...row,time_tag:'invalid'}]),null);assert.equal(latestWind([{...row,proton_density:null}]).density,null);assert.equal(latestWind([{...row,proton_density:0}]).density,0);assert.equal(latestWind([{...row,time_tag:'2026-11-16T06:24:00',active:false},row]).time,'2026-11-16T06:23:00.000Z');assert.equal(isoUtc('2026-11-16T06:23:00Z'),'2026-11-16T06:23:00.000Z');
const availabilityCase=(async()=>{const original=global.fetch,warn=console.warn,lines=[];console.warn=(...args)=>lines.push(args.join(' '));const now=new Date().toISOString();global.fetch=async url=>{url=String(url);if(/\/DONKI\/(?:WS\/get\/)?FLR/.test(url))return new Response('upstream unavailable',{status:404});if(url.includes('/DONKI/'))return Response.json([]);if(url.includes('xray-flares-7-day'))return Response.json([{begin_time:now,max_time:now,max_class:'C1.0',satellite:19}]);throw Error('Unexpected test request');};try{const d=require('../api/services/external/donki');const values=await d.fetchLatest({nasaKey:'fixture-private-key'});assert.equal(values.length,1);assert.equal(values[0].source,'NOAA SWPC');assert.equal(values[0].event_type,'flare');await d.fetchLatest({nasaKey:'fixture-private-key'});assert.equal(lines.length,1,'Upstream warning is bounded');assert.ok(!lines.join('').includes('fixture-private-key'));}finally{global.fetch=original;console.warn=warn;}console.log('DOM_V04_API_PASS canonical profiles unchanged; active RTSW values; key-free NASA failure and genuine-source fallback');})().catch(e=>{console.error(e);process.exit(1)});


// The active CCMC archive restores DONKI history without a NASA gateway key.
availabilityCase.then(async()=>{
  const original=global.fetch;
  const now=new Date().toISOString();
  const requested=[];
  global.fetch=async value=>{
    const url=new URL(value);
    requested.push(url);
    assert.equal(url.hostname,'ccmc.gsfc.nasa.gov');
    assert.equal(url.searchParams.has('api_key'),false);
    if(url.pathname.endsWith('/FLR'))return Response.json([{flrID:'historical-flare',beginTime:now,classType:'M1.2'}]);
    return Response.json([]);
  };
  try{
    const entries=await require('../api/services/external/donki').fetchHistory({from:'2024-05-10',to:'2024-05-11',nasaKey:'fixture-private-key'});
    assert.equal(entries[0].dedup_key,'donki:flr:historical-flare');
    assert.equal(entries[0].source,'NASA DONKI');
    assert.equal(requested.length,3);
    assert.equal(requested[0].searchParams.get('startDate'),'2024-05-10');
  }finally{global.fetch=original;}
}).catch(e=>{console.error(e);process.exit(1)});
