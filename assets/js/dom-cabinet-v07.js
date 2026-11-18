/* DOM cabinet v0.7 — layout and genuine NeuroMap entry points. */
(() => {
 'use strict';
 if (!document.body || !document.body.classList.contains('dom-account-matrix')) return;
 const q=(s,r=document)=>r.querySelector(s);
 const lang=()=>['ru','en','es'].includes(document.documentElement.lang)?document.documentElement.lang:'ru';
 const txt=(ru,en,es)=>({ru,en,es})[lang()]||ru;
 const el=(tag,className,text)=>{const x=document.createElement(tag);if(className)x.className=className;if(text)x.textContent=text;return x};
 const icons={overview:'◉',evolution:'◇',tools:'✧',domunity:'◎',enroll:'⊕',monad:'✦',administration:'⚙',courses:'↳'};
 let sidebarOpen=true,nav=null,trigger=null,menu=null;
 try{sidebarOpen=localStorage.getItem('dom_cabinet_sidebar')!=='closed'}catch(_){}
 function storeSide(){try{localStorage.setItem('dom_cabinet_sidebar',sidebarOpen?'open':'closed')}catch(_){}}
 function syncSide(){
   const dash=q('#client-dashboard');if(!dash)return;
   dash.classList.toggle('dom-cabinet-closed',!sidebarOpen);
   if(trigger){trigger.setAttribute('aria-expanded',String(sidebarOpen));trigger.setAttribute('aria-label',sidebarOpen?txt('Свернуть меню','Collapse navigation','Contraer navegación'):txt('Открыть меню','Open navigation','Abrir navegación'));}
   if(nav){nav.setAttribute('aria-hidden',String(!sidebarOpen));nav.inert=!sidebarOpen;}
   storeSide();
 }
 function buildNav(){
   const dash=q('#client-dashboard'),original=q('#client-dashboard .dash-nav-primary');
   if(!dash||!original||original.dataset.domCabinetReady)return;
   original.dataset.domCabinetReady='1';
   nav=original;nav.classList.add('dom-cabinet-sidebar');nav.setAttribute('aria-label',txt('Навигация личного кабинета','Account navigation','Navegación de la cuenta'));nav.setAttribute('role','navigation');
   trigger=el('button','dom-cabinet-toggle');trigger.type='button';trigger.textContent='☰';trigger.addEventListener('click',()=>{sidebarOpen=!sidebarOpen;syncSide()});dash.insertBefore(trigger,nav);
   const brand=el('div','dom-cabinet-side-head',txt('Мой DOM','My DOM','Mi DOM'));
   original.prepend(brand);
   const links=[...original.querySelectorAll('a[data-tab]')];
   links.forEach(a=>{const id=a.dataset.tab||'';a.classList.add('dom-cabinet-link');a.dataset.domIcon=icons[id]||'•';});
   // This is the same original tab navigation, moved and reordered, not cloned.
   const byTab=Object.fromEntries(links.map(a=>[a.dataset.tab,a]));
   const courseItem=byTab.courses;
   const group=el('details','dom-cabinet-path-group');
   const sum=el('summary','dom-cabinet-path-title',txt('Мои курсы','My courses','Mis cursos'));
   group.append(sum);if(courseItem)group.append(courseItem);
   for(const id of ['overview','evolution','tools','domunity','enroll','monad','administration']){
     if(!byTab[id])continue;original.append(byTab[id]);if(id==='evolution')original.append(group);
   }
   original.addEventListener('click',e=>{
     if(e.target.closest('a[data-tab]')&&window.innerWidth<860){sidebarOpen=false;syncSide();}
   });
   // Program/course progress remains in the original tab panel.
   original.querySelectorAll('a[data-tab]').forEach(a=>a.addEventListener('click',()=>requestAnimationFrame(syncSelection)));
   window.addEventListener('hashchange',syncSelection);
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sidebarOpen&&window.innerWidth<860){sidebarOpen=false;syncSide();}});
   syncSide();syncSelection();
 }
 function syncSelection(){
   if(!nav)return;
   const active=q('#client-dashboard>.tab-panel.active')||q('#client-dashboard .tab-panel.active');
   const activeTab=(active?.id||'').replace(/^tab-/,'')||'overview';
   nav.querySelectorAll('a[data-tab]').forEach(a=>a.classList.toggle('dom-cabinet-current',a.dataset.tab===activeTab));
   const group=q('.dom-cabinet-path-group',nav);
   if(group&&activeTab==='courses')group.open=true;
 }
 function buildQuick(){
   const profile=q('#tab-overview');if(!profile||q('#dom-quick-record'))return;
   const host=el('div','dom-quick-record');host.id='dom-quick-record';
   const btn=el('button','dom-quick-trigger',txt('✚  Записать сейчас','✚  Record now','✚  Registrar ahora'));
   btn.type='button';btn.setAttribute('aria-haspopup','true');btn.setAttribute('aria-expanded','false');host.append(btn);
   const panel=el('div','dom-quick-popup');panel.hidden=true;panel.setAttribute('role','group');
   const items=[
     {label:txt('Эмоция / переживание','Emotion / experience','Emoción'),method:'openNmSurvey'},
     {label:txt('Мысль','Thought','Pensamiento'),method:'openNmThought'},
     {label:txt('Ощущение','Sensation','Sensación'),method:'nmOpenSensationOverlay'},
     {label:txt('Событие','Event','Evento'),method:'nmOpenDiaryOverlay'}
   ];
   for(const item of items){const b=el('button','dom-quick-option',item.label);b.type='button';b.addEventListener('click',()=>{
     panel.hidden=true;btn.setAttribute('aria-expanded','false');
     // Invoke the canonical NeuroMap functionality; do not fork storage, session,
     // journey links, events, or validations.
     if(typeof window[item.method]==='function') {
       try{window[item.method]();window.dispatchEvent(new CustomEvent('dom-neuromap-quick-open',{detail:{method:item.method}}));}
       catch(err){notify(txt('Не удалось открыть инструмент. Попробуйте через NeuroMap.','Could not open the tool. Try the NeuroMap section.','No se pudo abrir la herramienta. Prueba NeuroMap.'));}
     }else notify(txt('Инструмент ещё не загрузился. Попробуйте ещё раз.','Tool is still loading. Try again.','La herramienta todavía se está cargando.'));
   });panel.append(b);}
   host.append(panel);
   btn.addEventListener('click',()=>{panel.hidden=!panel.hidden;btn.setAttribute('aria-expanded',String(!panel.hidden));});
   document.addEventListener('click',e=>{if(!host.contains(e.target)){panel.hidden=true;btn.setAttribute('aria-expanded','false');}});
   const hero=q('#rpg-hero');if(hero)hero.after(host);else {const dash=q('#rpg-dashboard');if(dash)dash.before(host);else profile.prepend(host)}
 }
 function notify(message){let box=q('#dom-cabinet-notice');if(!box){box=el('div','dom-cabinet-notice');box.id='dom-cabinet-notice';document.body.append(box)}box.textContent=message;box.hidden=false;setTimeout(()=>box.hidden=true,5000);}
 function refreshTranslations(){
   const trigger=q('#dom-quick-record .dom-quick-trigger');if(trigger)trigger.textContent=txt('✚  Записать сейчас','✚  Record now','✚  Registrar ahora');
   const labels=[[txt('Эмоция / переживание','Emotion / experience','Emoción')],[txt('Мысль','Thought','Pensamiento')],[txt('Ощущение','Sensation','Sensación')],[txt('Событие','Event','Evento')]];
   document.querySelectorAll('.dom-quick-option').forEach((b,i)=>b.textContent=labels[i]?.[0]||b.textContent);
   const group=q('.dom-cabinet-path-title');if(group)group.textContent=txt('Мои курсы','My courses','Mis cursos');
 }
 let lastLang=lang();
 function init(){buildNav();buildQuick();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 // Account widgets are created before login; these mount points persist across
 // sign in/out. Retry only until they exist instead of watching every mutation.
 let tries=0;const timer=setInterval(()=>{init();if(++tries>24||q('#dom-quick-record')&&q('.dom-cabinet-sidebar'))clearInterval(timer);},400);
 setInterval(()=>{if(lang()!==lastLang){lastLang=lang();refreshTranslations()}syncSelection();},1500);
})();