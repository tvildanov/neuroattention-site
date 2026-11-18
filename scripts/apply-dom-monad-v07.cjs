'use strict';
const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'..','api','server.js'),s0=fs.readFileSync(file,'utf8');
if(s0.includes('dom-monad-v07')){console.log('DOM_MONAD_V07_ALREADY_PATCHED');process.exit(0)}
let s=s0;
const getAnchor="app.get('/api/chat/rooms/:id/messages', requireAuth, async (req, res) => {";
const postAnchor="app.post('/api/chat/rooms/:id/messages', requireAuth, async (req, res) => {";
const afterAnchor="// ── DOMunity: Donations via Stripe";
const start=s.indexOf(getAnchor),middle=s.indexOf(postAnchor,start),end=s.indexOf(afterAnchor,middle);
if(start<0||middle<0||end<0)throw Error('DOMunity room API anchors changed; refuse speculative patch');
let getBlock=s.slice(start,middle),postBlock=s.slice(middle,end);
const replyAnchor="    res.json({ messages: rows });";
if(getBlock.split(replyAnchor).length!==2)throw Error('Room GET format changed');
getBlock=getBlock.replace(replyAnchor,
 "    const aiReplies = await domMonadV07.roomReplies({sql,roomId:rid}).catch(err=>{console.warn('[room-agent-replies]',err.message);return []});\n"+
 "    res.json({ messages: rows.concat(aiReplies).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)) });");
const sendAnchor="    res.status(201).json({ message: row });";
if(postBlock.split(sendAnchor).length!==2)throw Error('Room POST format changed');
postBlock=postBlock.replace(sendAnchor,
 "    // One delivery record per opted-in agent; canonical room message is persisted first.\n"+
 "    await domMonadV07.recordRoomMessage({sql,roomId:rid,messageId:row.id,body:String(body)}).catch(err=>console.warn('[room-agent-record]',err.message));\n"+
 sendAnchor);
s=s.slice(0,start)+getBlock+postBlock+s.slice(end);
const listenAnchor="app.listen(PORT,";
if(s.split(listenAnchor).length!==2)throw Error('Server listen anchor changed');
s=s.replace(listenAnchor,
 "// DOM v0.7 server-authoritative Monad access, founder harness and DOMunity delivery.\n"+
 "const domMonadV07=require('./services/dom-monad-v07');\n"+
 "domMonadV07.install(app,{requireAuth,sql,monadSvc});\n\n"+listenAnchor);
fs.writeFileSync(file,s);console.log('DOM_MONAD_V07_PATCHED',s.length-s0.length,'bytes');
