'use strict';
const fs=require('fs');const s=fs.readFileSync('account.html','utf8');
const anchors=['id="tab-overview"','id="tab-evolution"','id="tab-tools"','id="tab-monad"','id="client-dashboard"','dash-nav-primary','function switchTab(','window.switchTab','openNmSurvey','nmOpenSensationOverlay','nmOpenDiaryOverlay','dom-partner.js','dom-theme.js','domunity','DOMunity','dom-unity','neuro-map','nm-survey','id="tab-administration"','id="tab-admin"','id="tab-courses"','tab-btn-','id="profile-'];
for(const key of anchors){let start=0,idxs=[];while((start=s.indexOf(key,start))>=0&&idxs.length<3){idxs.push(start);start+=key.length}console.log('\n===== '+key+' count-first='+idxs.length+' =====');for(const i of idxs)console.log(s.slice(Math.max(0,i-430),i+Math.min(2300,key==='dash-nav-primary'?3600:2300)).replaceAll('STUB_LOGO',''))}
console.log('END size='+s.length+' scriptSrc='+[...s.matchAll(/<script[^>]+src="([^"]+)"/g)].map(x=>x[1]).slice(-42).join(';'));

for(const word of ['/api/chat/rooms','function domLoadRooms','function domOpenRoom','function domSwitch(','dom-room-messages','id="dom-subtab-rooms"','id="dom-rooms"','id="dom-room-log"','id="dom-chat-messages"']){let at=0,count=0;while((at=s.indexOf(word,at))!==-1&&count++<4){console.log('CHAT ANCHOR '+word+' #'+count+' OFFSET '+at+'\\n'+s.slice(Math.max(0,at-1300),at+2700));at+=word.length}}
