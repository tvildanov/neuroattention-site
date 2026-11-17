'use strict';
// Bounded, key-free warning frequency. An absent feed never becomes a zero sample.
const seen=new Map();
function warn(source,error){const now=Date.now(),previous=seen.get(source)||0;if(now-previous<300000)return;seen.set(source,now);console.warn('[external-source]',source,'unavailable',Number.isInteger(error?.status)?'HTTP '+error.status:'network/format');}
module.exports={warn};
