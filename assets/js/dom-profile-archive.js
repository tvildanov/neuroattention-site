import {zipSync,unzipSync,strToU8,strFromU8} from '../vendor/fflate/fflate.js';
const limit=96*1024*1024;
function decode(base64){return Uint8Array.from(atob(base64),c=>c.charCodeAt(0));}
function encode(bytes){
  const chunks=[];
  for(let i=0;i<bytes.length;i+=24576)chunks.push(btoa(String.fromCharCode(...bytes.subarray(i,i+24576))));
  return chunks.join('');
}
export function pack(bundle){
  const entries=Object.create(null);let total=0,index=0;
  function store(f){
    if(!f)return null;
    const path='media/'+(++index),bytes=decode(f.base64);total+=bytes.length;
    if(total>limit)throw Error('Archive exceeds 96 MB');
    entries[path]=[bytes,{level:0}];return {id:f.id,name:f.name,path};
  }
  const manifest={...bundle,files:bundle.files.map(store),posts:bundle.posts.map(p=>({...p,attachment:store(p.attachment)}))};
  entries['profile.json']=strToU8(JSON.stringify(manifest));
  return new Blob([zipSync(entries,{level:1})],{type:'application/zip'});
}
export async function unpack(file){
  if(file.size>100*1024*1024)throw Error('Max. 100 MB');
  if(/\.json$/i.test(file.name))return JSON.parse(await file.text());
  let total=0,count=0;
  const entries=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter(entry){
    if(++count>400||!(/^(profile\.json|media\/[1-9][0-9]*)$/).test(entry.name)||entry.originalSize>16*1024*1024)throw Error('Invalid archive entry');
    total+=entry.originalSize;if(total>limit+1024*1024)throw Error('Archive exceeds 96 MB');return true;
  }});
  const manifest=JSON.parse(strFromU8(entries['profile.json']));let restored=0;
  function restore(f){
    if(!f)return null;
    if(!/^media\/[1-9][0-9]*$/.test(f.path)||!entries[f.path])throw Error('Missing attachment');
    const bytes=entries[f.path];restored+=bytes.length;if(restored>limit)throw Error('Archive exceeds 96 MB');
    return {id:f.id,name:f.name,base64:encode(bytes),size:bytes.length};
  }
  return {...manifest,files:manifest.files.map(restore),posts:manifest.posts.map(p=>({...p,attachment:restore(p.attachment)}))};
}
