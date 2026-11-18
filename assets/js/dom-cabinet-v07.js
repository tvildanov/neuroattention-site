/* DOM cabinet v0.7 — layout and genuine NeuroMap entry points. */
(() => {
 'use strict';
 if (!document.body || !document.body.classList.contains('dom-account-matrix')) return;
 const q=(s,r=document)=>r.querySelector(s);
 const lang=()=>['ru','en','es'].includes(document.documentElement.lang)?document.documentElement.lang:'ru';
 const txt=(ru,en,es)=>({ru,en,es})[lang()]||ru;
 const el=(tag,className,text)=>{const x=document.createElement(tag);if(className)x.className=className;if(text)x.textContent=text;return x};
 const icons={overview:'◉',evolution:'◇',tools:'✧',domunity:'◎',enroll:'⊕',monad:'✦',administration:'⚙',courses:'↳'};
 let sidebarOpen=window.innerWidth>=860,nav=null,trigger=null;
 try{sidebarOpen=(localStorage.getItem('dom_cabinet_sidebar')||(sidebarOpen?'open':'closed'))==='open'}catch(_){}
 function storeSide(){try{localStorage.setItem('dom_cabinet_sidebar',sidebarOpen?'open':'closed')}catch(_){}}
 function syncSide(){
   const dash=q('#client-dashboard');if(!dash)return;
   dash.classList.toggle('dom-cabinet-closed',!sidebarOpen);
   if(trigger){trigger.setAttribute('aria-expanded',String(sidebarOpen));trigger.setAttribute('aria-label',sidebarOpen?txt('Свернуть меню','Collapse navigation','Contraer navegación'):txt('Открыть меню','Open navigation','Abrir navegación'));}
   if(nav){const mobile=window.innerWidth<860;nav.setAttribute('aria-hidden',String(!sidebarOpen&&mobile));nav.inert=!sidebarOpen&&mobile;}
   storeSide();
 }
 function buildNav(){
   const dash=q('#client-dashboard'),original=q('#client-dashboard .dash-nav-primary');
   if(!dash||!original||original.dataset.domCabinetReady)return;
   original.dataset.domCabinetReady='1';
   original.id=original.id||'dom-cabinet-navigation';
   nav=original;nav.classList.add('dom-cabinet-sidebar');nav.setAttribute('aria-label',txt('Навигация личного кабинета','Account navigation','Navegación de la cuenta'));nav.setAttribute('role','navigation');
   trigger=el('button','dom-cabinet-toggle');trigger.type='button';trigger.setAttribute('aria-controls',original.id);trigger.textContent='☰';trigger.addEventListener('click',()=>{sidebarOpen=!sidebarOpen;syncSide()});dash.insertBefore(trigger,nav);
   const brand=el('div','dom-cabinet-side-head',txt('Мой DOM','My DOM','Mi DOM'));
   original.prepend(brand);
   const links=[...original.querySelectorAll('a[data-tab]')];
   links.forEach(a=>{const id=a.dataset.tab||'';a.classList.add('dom-cabinet-link');a.dataset.domIcon=icons[id]||'•';a.setAttribute('title',a.textContent.trim());});
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
   document.addEventListener('keydown',e=>{
     if(!sidebarOpen||window.innerWidth>=860||!trigger.getClientRects().length||document.querySelector('.modal-overlay.open'))return;
     if(e.key==='Escape'){sidebarOpen=false;syncSide();trigger.focus();return;}
     if(e.key!=='Tab')return;
     const items=[trigger,...nav.querySelectorAll('a,summary')].filter(x=>x.getClientRects().length);
     const edge=e.shiftKey?items[0]:items[items.length-1];
     if(document.activeElement===edge||!items.includes(document.activeElement)){
       e.preventDefault();(e.shiftKey?items[items.length-1]:items[0]).focus();
     }
   });
   window.addEventListener('resize',syncSide);
   syncSide();syncSelection();
 }
 function syncSelection(){
   if(!nav)return;
   const active=q('#client-dashboard>.tab-panel.active')||q('#client-dashboard .tab-panel.active');
   const activeTab=(active?.id||'').replace(/^tab-/,'')||'overview';
   nav.querySelectorAll('a[data-tab]').forEach(a=>{
     const current=a.dataset.tab===activeTab;
     a.classList.toggle('dom-cabinet-current',current);
     if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
   });
   const group=q('.dom-cabinet-path-group',nav);
   if(group&&activeTab==='courses')group.open=true;
 }
 function buildQuick(){
   const profile=q('#tab-overview'), actions=q('#nm-entry-actions');
   if(!profile||!actions||q('#dom-quick-record'))return;
   const host=el('div','dom-quick-record');host.id='dom-quick-record';
   const button=el('button','dom-quick-trigger');
   const hint=el('p','dom-quick-hint');
   hint.id='dom-quick-hint';
   button.type='button';
   button.setAttribute('aria-expanded','false');
   button.setAttribute('aria-controls','dom-quick-popup');
   button.setAttribute('aria-describedby',hint.id);
   const panel=el('div','dom-quick-popup');
   panel.id='dom-quick-popup';
   panel.hidden=true;
   const heading=el('strong','dom-quick-heading','NeuroMap');
   const expand=el('button','dom-quick-expand');
   expand.type='button';
   expand.setAttribute('aria-expanded','false');
   expand.addEventListener('click',()=>{
     setExpanded(!panel.classList.contains('dom-quick-expanded'));
   });
   const status=el('p','dom-quick-status');
   status.setAttribute('role','status');
   const placeholder=document.createComment('NeuroMap entry controls');
   actions.before(placeholder);
   const toolbar=el('div','dom-quick-toolbar');
   toolbar.append(heading,expand);
   panel.append(toolbar);
   host.append(button,hint,panel,status);
   const hero=q('#rpg-hero');
   if(hero)hero.before(host);else profile.prepend(host);
   if(hero && !hero.closest('#rpg-dashboard'))hero.after(host);
   const rpg=q('#rpg-dashboard');
   if(rpg && rpg.contains(host))rpg.before(host);
   function setExpanded(value){
     panel.classList.toggle('dom-quick-expanded',value);
     expand.setAttribute('aria-expanded',String(value));
     expand.textContent=value?txt('Свернуть','Collapse','Contraer'):txt('Развернуть','Expand','Ampliar');
   }
   function toggle(open,focus=false){
     if(open===!panel.hidden)return;
     panel.hidden=!open;
     button.setAttribute('aria-expanded',String(open));
     if(open){
       panel.append(actions);
       if(focus)actions.querySelector('button')?.focus();
     }else{
       placeholder.after(actions);
       setExpanded(false);
       if(focus)button.focus();
     }
   }
   button.addEventListener('click',()=>toggle(panel.hidden,true));
   document.addEventListener('click',e=>{if(!host.contains(e.target))toggle(false);});
   panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();toggle(false,true);}});
   actions.addEventListener('click',e=>{
     if(panel.contains(actions) && e.target.closest('button'))toggle(false);
   });
   document.addEventListener('neuromap:save',e=>{
     if(!q('#tab-overview.active'))return;
     status.replaceChildren();
     if(!e.detail.ok){
       status.textContent=txt('Сохранение в NeuroMap не подтверждено.','NeuroMap could not confirm the save.','NeuroMap no pudo confirmar el guardado.');
       return;
     }
     const when=new Date().toLocaleTimeString(lang(),{hour:'2-digit',minute:'2-digit'});
     status.append(txt('Запись сохранена','Entry saved','Registro guardado')+' · '+when+' ');
     const open=el('button','dom-quick-secondary',txt('Открыть NeuroMap','Open NeuroMap','Abrir NeuroMap'));
     const another=el('button','dom-quick-secondary',txt('Добавить ещё','Add another','Añadir otro'));
     open.type=another.type='button';
     open.onclick=()=>{window.switchTab('tools');window.setToolsMode('nm');};
     another.onclick=()=>toggle(true,true);
     status.append(open,another);
   });
   setExpanded(false);
   refreshTranslations();
 }
 function refreshTranslations(){
   const trigger=q('#dom-quick-record .dom-quick-trigger');
   if(trigger)trigger.textContent=txt('Добавить запись','Add an entry','Añadir un registro');
   const hint=q('#dom-quick-hint');
   if(hint)hint.textContent=txt('Мысль, эмоция, ощущение или событие','A thought, emotion, sensation or event','Un pensamiento, una emoción, una sensación o un evento');
   const expand=q('.dom-quick-expand');
   if(expand)expand.textContent=expand.getAttribute('aria-expanded')==='true'
     ?txt('Свернуть','Collapse','Contraer'):txt('Развернуть','Expand','Ampliar');
   const group=q('.dom-cabinet-path-title');if(group)group.textContent=txt('Курсы','Courses','Cursos');
   if(nav)nav.querySelectorAll('a[data-tab]').forEach(a=>a.title=a.textContent.trim());
 }
 let lastLang=lang();
 function init(){buildNav();buildQuick();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 // Account widgets are created before login; these mount points persist across
 // sign in/out. Retry only until they exist instead of watching every mutation.
 let tries=0;const timer=setInterval(()=>{init();if(++tries>24||q('#dom-quick-record')&&q('.dom-cabinet-sidebar'))clearInterval(timer);},400);
 setInterval(()=>{if(lang()!==lastLang){lastLang=lang();refreshTranslations()}syncSelection();},1500);
})();
