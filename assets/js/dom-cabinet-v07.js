/* DOM cabinet v0.7 — layout and genuine NeuroMap entry points. */
(() => {
 'use strict';
 if (!document.body || !document.body.classList.contains('dom-account-matrix')) return;
 const q=(s,r=document)=>r.querySelector(s);
 const lang=()=>['ru','en','es'].includes(document.documentElement.lang)?document.documentElement.lang:'ru';
 const txt=(ru,en,es)=>({ru,en,es})[lang()]||ru;
 const el=(tag,className,text)=>{const x=document.createElement(tag);if(className)x.className=className;if(text)x.textContent=text;return x};
 const icons={
   overview:'M7 3.34h10L22 12l-5 8.66H7L2 12Z',
   evolution:'M3 12h6l5-6h7 M9 12l5 6h7 M14 12h7 M3 10v4 M21 4v4 M21 10v4 M21 16v4',
   tools:'M5 21 17 7 M7 3c6 0 12 3 15 9-4-2-6-4-8-6-2-1-4-2-7-3Z',
   domunity:'M9 8a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M5 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2Z M5 6a2 2 0 1 0 0 4 M19 6a2 2 0 1 1 0 4 M4 13a4 4 0 0 0-3 4v1 M20 13a4 4 0 0 1 3 4v1',
   enroll:'M5 3h13v18H5z M8 8h7 M8 12l2 2 5-5 M8 17h7',
   monad:'M12 2c0 6 4 10 10 10-6 0-10 4-10 10 0-6-4-10-10-10 6 0 10-4 10-10Z',
   administration:'M18.56 9.28 L18.92 10.40 L21.55 10.32 L21.55 13.68 L18.92 13.60 L18.56 14.72 L18.02 15.76 L19.95 17.56 L17.56 19.95 L15.76 18.02 L14.72 18.56 L13.60 18.92 L13.68 21.55 L10.32 21.55 L10.40 18.92 L9.28 18.56 L8.24 18.02 L6.44 19.95 L4.05 17.56 L5.98 15.76 L5.44 14.72 L5.08 13.60 L2.45 13.68 L2.45 10.32 L5.08 10.40 L5.44 9.28 L5.98 8.24 L4.05 6.44 L6.44 4.05 L8.24 5.98 L9.28 5.44 L10.40 5.08 L10.32 2.45 L13.68 2.45 L13.60 5.08 L14.72 5.44 L15.76 5.98 L17.56 4.05 L19.95 6.44 L18.02 8.24Z M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0Z',
   courses:'M5 3h13v18H5z M9 8h5 M9 12h5 M9 16h5'
 };
 function setNavIcon(link,id){
   const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="'+(icons[id]||icons.courses)+'" fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
   link.style.setProperty('--cabinet-nav-icon','url("data:image/svg+xml,'+encodeURIComponent(svg)+'")');
 }
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
 const routes = {
   evolution:'#evo-subtabs [id^="evo-subtab-"], .tools-subtabs a[id^="tools-mode-"]',
   tools:'.tools-subtabs a[id^="tools-mode-"]',
   domunity:'[id^="dom-subtab-"]',
   overview:'#dom-social-self [data-profile-action]',
   monad:'.monad-subtabs [data-monad-sub]',
   architecture:'.monad-arch-subtabs [data-monad-arch]',
   administration:'#admin-tabs [data-tab]',
   people:'#admin-people-subtabs [data-tab]'
 };
 const branches=new Map();
 function mobileDone(){
   if(window.innerWidth<860){sidebarOpen=false;syncSide();trigger.focus();}
 }
 function openBranch(key,open){
   const branch=branches.get(key);
   if(!branch)return;
   branch.list.hidden=!open;
   branch.arrow.setAttribute('aria-expanded',String(open));
 }
 function makeBranch(key,owner){
   const arrow=el('button','dom-nav-arrow','⌄');
   arrow.type='button';
   const list=el('div','dom-nav-children');
   list.id='dom-nav-'+key;
   arrow.setAttribute('aria-controls',list.id);
   list.hidden=true;
   arrow.setAttribute('aria-expanded','false');
   owner.after(arrow,list);
   branches.set(key,{owner,arrow,list,entries:new Map()});
   arrow.onclick=()=>{
     const expand=list.hidden;
     sidebarOpen=true;syncSide();openBranch(key,expand);syncBranches();
   };
   return list;
 }
 function syncBranches(){
   for(const [key,branch] of branches){
     const {owner,arrow,list,entries}=branch;
     arrow.hidden=owner.hidden||owner.style.display==='none';
     arrow.setAttribute('aria-label',txt('Подразделы','Subsections','Subsecciones')+' · '+owner.textContent.trim());
     arrow.disabled=owner.style.pointerEvents==='none'||owner.disabled===true;
     if(arrow.hidden||arrow.disabled)openBranch(key,false);
     const sources=[...document.querySelectorAll(routes[key])];
     for(const [source,item] of entries){
       if(!sources.includes(source)){item.remove();entries.delete(source);}
     }
     for(const source of sources){
       const nested=source.dataset.monadSub==='architecture'?'architecture':source.dataset.tab==='admin-people'?'people':null;
       let item=entries.get(source);
       if(!item){
         item=el(source.matches('a')?'a':'button','dom-nav-item');
         if(item.tagName==='A')item.href=source.href;else item.type='button';
         item.dataset.navTarget=source.id||source.dataset.tab||source.dataset.monadSub||source.dataset.monadArch||source.dataset.profileAction||String(sources.indexOf(source));
         if(key==='evolution'){
           const tools=source.id.startsWith('tools-'),group=list.querySelector(tools?'.dom-tools-group':'.dom-path-group');
           if(source.id==='evo-subtab-personal')group.querySelector('summary').after(item);else group.append(item);
         }else list.append(item);
         if(nested)makeBranch(nested,item);
         item.onclick=event=>{
           if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
           event.preventDefault();
           const top=source.id.startsWith('tools-mode-')?'tools':key==='architecture'?'monad':key==='people'?'administration':key;
           const topLink=branches.get(top).owner;
           if(topLink.hidden||topLink.style.display==='none'||topLink.style.pointerEvents==='none')return;
           if(!q('#tab-'+top)?.classList.contains('active'))topLink.click();
           if(key==='architecture'&&!q('[data-monad-sub="architecture"]').classList.contains('active'))q('[data-monad-sub="architecture"]').click();
           source.click();
           if(nested)openBranch(nested,true);else mobileDone();
           syncBranches();
         };
         entries.set(source,item);
       }
       const label=source.dataset.tab==='admin-tools'?txt('Хранилище','Storage','Almacenamiento'):(source.querySelector('.dom-v06-summary strong')||source).textContent.trim();
       if(item.textContent!==label)item.textContent=label;
       item.hidden=source.hidden||source.style.display==='none';
       if(source.id.startsWith('tools-mode-'))item.disabled=branches.get('tools')?.owner.style.pointerEvents==='none';
       if(key==='overview')item.disabled=source.disabled;
       item.classList.toggle('selected',source.getAttribute('aria-pressed')==='true'||source.classList.contains('active'));
     }
   }
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
   links.forEach(a=>{const id=a.dataset.tab||'';a.classList.add('dom-cabinet-link');a.setAttribute('title',a.textContent.trim());setNavIcon(a,id);});
   // This is the same original tab navigation, moved and reordered, not cloned.
   const byTab=Object.fromEntries(links.map(a=>[a.dataset.tab,a]));
   const enroll=byTab.enroll;
   for(const id of ['overview','evolution','tools','domunity','monad','administration']){
     const link=byTab[id];if(!link)continue;
     original.append(link);
     if(!routes[id]){link.addEventListener('click',mobileDone);continue;}
     const list=makeBranch(id,link);
     if(id==='overview')openBranch(id,true);
     if(id==='evolution'){
       const path=el('details','dom-path-group'),tools=el('details','dom-tools-group');path.open=true;
       path.append(el('summary','',txt('Мой путь','My path','Mi camino')));tools.append(el('summary','',txt('Инструменты','Tools','Herramientas')));
       list.append(path,tools);
       if(enroll){enroll.className='dash-tab dom-nav-item';path.append(enroll);enroll.addEventListener('click',mobileDone);}
       if(byTab.courses){q('#dom-cabinet-programs').after(byTab.courses);byTab.courses.onclick=()=>window.switchTab('courses');}
     }
     link.addEventListener('click',event=>{
       if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
       sidebarOpen=true;syncSide();openBranch(id,true);
       if(id==='overview')q('[data-profile-action="mine"]')?.click();
       if(id==='evolution')q('#evo-subtab-personal')?.click();
       if(id==='tools')q('#tools-mode-nm')?.click();
       if(id==='domunity')q('#dom-subtab-feed')?.click();
       if(id==='monad')q('[data-monad-sub="chat"]')?.click();
       syncBranches();
     });
   }
   document.addEventListener('dom-profile-actions-ready',syncBranches);
   original.addEventListener('click',event=>{
     const link=event.target.closest('a[data-tab]');
     if(link?.style.pointerEvents==='none'){event.preventDefault();event.stopImmediatePropagation();}
   },true);
   syncBranches();
   // Program/course progress remains in the original tab panel.
   original.querySelectorAll('a[data-tab]').forEach(a=>a.addEventListener('click',()=>requestAnimationFrame(syncSelection)));
   window.addEventListener('hashchange',syncSelection);
   document.addEventListener('keydown',e=>{
     if(!sidebarOpen||window.innerWidth>=860||!trigger.getClientRects().length||document.querySelector('.modal-overlay.open'))return;
     if(e.key==='Escape'){sidebarOpen=false;syncSide();trigger.focus();return;}
     if(e.key!=='Tab')return;
     const items=[trigger,...nav.querySelectorAll('a,button')].filter(x=>x.getClientRects().length);
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
     const current=a.dataset.tab===activeTab||(['tools','enroll'].includes(activeTab)&&a.dataset.tab==='evolution');
     a.classList.toggle('dom-cabinet-current',current);
     if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
   });
   syncBranches();
 }
 function buildWorkspace(){
   const dash=q('#client-dashboard'), first=q('#tab-overview');
   if(!dash||!first||q('#dom-workspace-switch'))return;
   const bar=el('nav','dom-workspace-switch');bar.id='dom-workspace-switch';
   bar.setAttribute('aria-label',txt('Путь развития','Development path','Ruta de desarrollo'));
   first.before(bar);
   const sources=[...document.querySelectorAll(routes.evolution)];
   let lastTab=document.body.dataset.accountTab,toolsOpen=lastTab==='tools';
   const pathButton=el('button','',txt('Мой путь','My path','Mi camino')),toolsButton=el('button','',txt('Инструменты','Tools','Herramientas'));
   pathButton.onclick=()=>{toolsOpen=false;sync();};toolsButton.onclick=()=>{toolsOpen=true;sync();};bar.append(pathButton,toolsButton);
   const ordered=['evo-subtab-personal','evo-subtab-collective','evo-subtab-family','tools-mode-nm'];
   sources.sort((a,b)=>(ordered.includes(a.id)?ordered.indexOf(a.id):99)-(ordered.includes(b.id)?ordered.indexOf(b.id):99));
   const sync=()=>{
     const active=document.body.dataset.accountTab;
     if(lastTab!==active){if(active==='tools'||active==='evolution')toolsOpen=active==='tools';lastTab=active;}
     pathButton.setAttribute('aria-pressed',String(!toolsOpen));toolsButton.setAttribute('aria-pressed',String(toolsOpen));
     programs.hidden=toolsOpen;
     ask.hidden=!['admin','superadmin','founder'].includes(window.currentUser?.serverRole);
     for(const source of sources){
       const b=bar.querySelector('[data-source="'+source.id+'"]');
       const tab=source.id.startsWith('tools-')?'tools':'evolution';
       b.textContent=source.textContent.trim();b.hidden=(toolsOpen!==(tab==='tools'))||source.hidden||source.style.display==='none';
       b.disabled=branches.get(tab)?.owner.style.pointerEvents==='none';
       b.setAttribute('aria-pressed',String(active===tab&&source.classList.contains('active')));
     }
     const purchased=q('#purchase-banner-outer');
     const enrolled=Boolean(purchased&&purchased.style.display!=='none');
     dash.classList.toggle('dom-has-program',enrolled);
     const monad=q('#tab-btn-monad');
     shortcut.hidden=!monad||monad.style.display==='none';
     shortcut.textContent=monad?.textContent.trim()||'Monad';
     programs.textContent=q('a[data-tab="enroll"]',nav)?.textContent.trim()||'Programs';
   };
   for(const source of sources){
     const b=el('button');b.type='button';b.dataset.source=source.id;
     b.onclick=()=>{
       const tab=source.id.startsWith('tools-')?'tools':'evolution';
       if(branches.get(tab)?.owner.style.pointerEvents==='none')return;
       if(document.body.dataset.accountTab!==tab)window.switchTab(tab);
       source.click();history.replaceState(null,'','#'+tab+'/'+source.id);sync();
       const panel=q('#tab-'+tab);if(panel)panel.scrollTop=0;
     };bar.append(b);
   }
   const programs=el('button');programs.type='button';programs.onclick=()=>q('a[data-tab="enroll"]',nav)?.click();bar.querySelector('[data-source="evo-subtab-personal"]')?.after(programs);
   const ask=el('button','',txt('Спросить DOM','Ask DOM','Pregunta a DOM'));ask.type='button';ask.hidden=true;ask.onclick=()=>window.DOMSocial?.ask();bar.append(ask);
   const shortcut=el('button','dom-nav-item');shortcut.type='button';
   shortcut.onclick=()=>{q('#tab-btn-monad')?.click();mobileDone();};branches.get('domunity')?.list.append(shortcut);
   const observer=new MutationObserver(sync);
   for(const n of [...sources,document.body,q('#tab-btn-monad'),q('#purchase-banner-outer'),q('a[data-tab="tools"]',nav)].filter(Boolean))observer.observe(n,{attributes:true,attributeFilter:['class','style','hidden','lang','data-account-tab']});
   observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});sync();
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
   const journal=el('details','dom-private-journal');journal.id='dom-private-journal';
   journal.append(el('summary','',txt('Личный журнал Нейрокарты','Private NeuroMap journal','Diario privado de NeuroMap')),host);
   const social=q('#dom-social-self');if(social)social.after(journal);else profile.append(journal);
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
       if(focus)(panel.querySelector('textarea')||actions.querySelector('button'))?.focus();
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
     if(e.detail.record&&window.DOMRecording){open.textContent=DOMRecording.text('open');open.onclick=()=>DOMRecording.open(e.detail.record.id);}
     else open.onclick=()=>{window.switchTab('tools');window.setToolsMode('nm');};
     another.onclick=()=>toggle(true,true);
     status.append(open,another);
   });
   setExpanded(false);
   refreshTranslations();
 }
 function refreshTranslations(){
   const trigger=q('#dom-quick-record .dom-quick-trigger');
   if(trigger)trigger.textContent=txt('Записать наблюдение','Record observation','Registrar observación');
   const hint=q('#dom-quick-hint');
   if(hint)hint.textContent=txt('Мысль, эмоция, ощущение или событие','A thought, emotion, sensation or event','Un pensamiento, una emoción, una sensación o un evento');
   const expand=q('.dom-quick-expand');
   if(expand)expand.textContent=expand.getAttribute('aria-expanded')==='true'
     ?txt('Свернуть','Collapse','Contraer'):txt('Развернуть','Expand','Ampliar');
   if(nav)nav.querySelectorAll('a[data-tab]').forEach(a=>a.title=a.textContent.trim());
 }
 let lastLang=lang();
 function init(){buildNav();buildQuick();buildWorkspace();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 // Account widgets are created before login; these mount points persist across
 // sign in/out. Retry only until they exist instead of watching every mutation.
 let tries=0;const timer=setInterval(()=>{init();if(++tries>24||q('#dom-quick-record')&&q('.dom-cabinet-sidebar'))clearInterval(timer);},400);
 setInterval(()=>{if(lang()!==lastLang){lastLang=lang();refreshTranslations()}syncSelection();},1500);
})();
