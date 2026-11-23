/* Personal observations: confirmed writes, owner-scoped originals and retry receipts. */
(function(){'use strict';
const dictionaries={
 ru:{prompt:'Что вы заметили?',placeholder:'Мысль, событие или ощущение — своими словами',save:'Сохранить запись',pending:'Сохраняем запись…',error:'Не удалось подтвердить сохранение. Текст сохранён в этой вкладке. Повторите отправку.',saved:'Запись сохранена',open:'Открыть запись',review:'Проверьте запись',reviewHint:'Сохраните, чтобы вернуться к исходнику и увидеть связи на карте.',optional:'Уточнения необязательны. Можно вернуться к ним позже.',association:'С чем вы связываете это состояние?',skipHint:'Если пока не знаете — продолжите без ответа.',intensityHint:'Измените ползунок, чтобы указать интенсивность, или продолжите без оценки.',recent:'Мои наблюдения',recentHint:'Последние 50 записей нового формата. Прежние записи остаются в NeuroMap и на Пути.',empty:'Здесь появятся ваши сохранённые наблюдения.',unavailable:'Не удалось загрузить записи.',retry:'Повторить',source:'Ваш исходный текст',context:'Контекст',unknown:'Не указана',intensity:'Интенсивность',sequence:'Связанные элементы',close:'Закрыть',map:'Показать цепочку',path:'Открыть мой путь',reported:'Самонаблюдение',details:'Подробные формы',loading:'Загружаем записи…'},
 en:{prompt:'What did you notice?',placeholder:'A thought, event or sensation, in your own words',save:'Save observation',pending:'Saving observation…',error:'The save could not be confirmed. Your text is retained in this tab. Please retry.',saved:'Observation saved',open:'Open observation',review:'Review your observation',reviewHint:'Save to revisit the original and explore its connections.',optional:'Details are optional. You can return to them later.',association:'What do you associate this state with?',skipHint:'Not sure yet? Continue without an answer.',intensityHint:'Move the slider to set intensity, or continue without a rating.',recent:'My observations',recentHint:'The latest 50 new-format observations. Earlier records remain in NeuroMap and your Path.',empty:'Your saved observations will appear here.',unavailable:'Observations could not be loaded.',retry:'Retry',source:'Your original text',context:'Context',unknown:'Not specified',intensity:'Intensity',sequence:'Connected items',close:'Close',map:'Show recording',path:'Open my path',reported:'Self-report',details:'Detailed forms',loading:'Loading observations…'},
 es:{prompt:'¿Qué notaste?',placeholder:'Un pensamiento, evento o sensación, con tus palabras',save:'Guardar observación',pending:'Guardando observación…',error:'No pudimos confirmar el guardado. Tu texto sigue en esta pestaña. Inténtalo de nuevo.',saved:'Observación guardada',open:'Abrir observación',review:'Revisa tu observación',reviewHint:'Guarda para volver al original y explorar sus conexiones.',optional:'Los detalles son opcionales. Puedes volver a ellos después.',association:'¿Con qué relacionas este estado?',skipHint:'Si aún no lo sabes, continúa sin responder.',intensityHint:'Mueve el control para indicar la intensidad o continúa sin valorarla.',recent:'Mis observaciones',recentHint:'Las últimas 50 observaciones del nuevo formato. Los registros anteriores siguen en NeuroMap y tu Camino.',empty:'Tus observaciones guardadas aparecerán aquí.',unavailable:'No se pudieron cargar las observaciones.',retry:'Reintentar',source:'Tu texto original',context:'Contexto',unknown:'Sin indicar',intensity:'Intensidad',sequence:'Elementos conectados',close:'Cerrar',map:'Ver registro',path:'Abrir mi camino',reported:'Autoinforme',details:'Formularios detallados',loading:'Cargando observaciones…'}
};
const lang=()=>typeof getLang==='function'?getLang():'ru',text=k=>(dictionaries[lang()]||dictionaries.ru)[k]||k;
const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value)n.textContent=value;return n;};
const token=()=>typeof naGetToken==='function'?naGetToken():null;
let account='',revision=0,history,form,timer;
function pendingPrefix(){try{return 'dom-observation-pending:'+JSON.parse(atob(token().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub+':';}catch{return '';}}
function pendingEntries(){const prefix=pendingPrefix(),out=[];if(!prefix)return out;try{for(let i=0;i<sessionStorage.length;i++){const key=sessionStorage.key(i);if(key.startsWith(prefix))out.push({key,request:JSON.parse(sessionStorage.getItem(key))});}}catch{}return out;}
async function request(route,body,method){
 const auth=token();if(!auth)throw Error('Authentication required');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{const r=await fetch((window.AUTH_API||'https://neuroattention-api-production.up.railway.app')+route,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},signal:controller.signal,body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok||!data.ok||auth!==token())throw Error('Request not confirmed');return data;}finally{clearTimeout(timeout);}
}
async function save(payload,state){
 if(!state.request)state.request={...payload,operation_id:crypto.randomUUID(),occurred_at:payload.occurred_at||new Date().toISOString()};
 const prefix=pendingPrefix(),key=prefix+state.request.operation_id;
 try{if(prefix)sessionStorage.setItem(key,JSON.stringify(state.request));}catch{}
 const result=await request('/api/observations',state.request);
 try{sessionStorage.removeItem(key);}catch{}return result;
}
function surveyStatus(state){
 const modal=document.getElementById('nmSurveyModal');if(!modal)return;
 const content=modal.querySelector('#nm-step-content'),nav=modal.querySelector('#nm-nav-btns');
 if(content)content.inert=true;if(nav)nav.inert=true;
 let status=modal.querySelector('.dom-survey-status');
 if(!status){status=el('div','dom-survey-status');status.setAttribute('role','status');modal.querySelector('.modal-box').append(status);}
 status.dataset.state=state;status.replaceChildren(el('p','',text(state==='pending'?'pending':'error')));
 if(state==='error'){const retry=el('button','btn btn-solid',text('retry'));retry.type='button';retry.onclick=()=>nmSaveSurvey(!!nmSurveyState._linkSensation);status.append(retry);}
}
function saved(record,show=true){if(record){if(show)setTimeout(()=>open(record.id),0);refresh();}}
async function open(id){
 document.getElementById('dom-observation-dialog')?.remove();
 const dialog=el('dialog','dom-observation-dialog');dialog.id='dom-observation-dialog';dialog.setAttribute('aria-labelledby','dom-observation-title');
 const close=el('button','dom-record-close',text('close'));close.type='button';close.onclick=()=>dialog.close();
 const title=el('h2','',text('open'));title.id='dom-observation-title';const content=el('div','dom-observation-content',text('loading'));
 dialog.append(close,title,content);document.body.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 try{const {record}=await request('/api/observations/'+encodeURIComponent(id));if(!dialog.isConnected)return;content.replaceChildren();
  content.append(el('p','dom-record-note',text('reported')+' · '+new Date(record.occurred_at).toLocaleString(lang())),el('h3','',text('source')),el('p','dom-record-source',record.source.text||record.chain.map(x=>x.label).join(' · ')));
  if(record.source.context&&record.source.context!==record.source.text)content.append(el('h3','',text('context')),el('p','dom-record-source',record.source.context));
  content.append(el('p','dom-record-note',text('intensity')+': '+(record.source.intensity==null?text('unknown'):record.source.intensity+'/10')),el('h3','',text('sequence')));
  const list=el('ol','dom-observation-chain');record.chain.forEach(item=>{const li=el('li','dom-observation-'+item.type);li.textContent=typeof nmTranslate==='function'?nmTranslate(item.label):item.label;list.append(li);});content.append(list);
  const actions=el('div','dom-record-actions'),tools=document.querySelector('.dom-cabinet-sidebar a[data-tab="tools"]');
  if(tools&&tools.style.pointerEvents!=='none'){const map=el('button','btn btn-solid',text('map'));map.type='button';map.onclick=async()=>{map.disabled=true;try{await nmLoadV2Graph();const chain=nmV2Graph.chains.find(x=>x.session_id===record.session_id);if(!chain)throw Error('Recording unavailable');dialog.close();switchTab('tools');setToolsMode('nm');nmCurrentFilter='all';nmSelectChain(chain.id,true);}catch{map.disabled=false;map.textContent=text('retry');}};actions.append(map);}
  const path=el('button','btn btn-ghost',text('path'));path.type='button';path.onclick=()=>{dialog.close();switchTab('evolution');};actions.append(path);
  const labels=({ru:['Удалить наблюдение','Удалить это наблюдение из журнала, Нейрокарты и Пути?'],en:['Delete observation','Delete this observation from your journal, NeuroMap and Path?'],es:['Eliminar observación','¿Eliminar esta observación del diario, NeuroMap y Camino?']})[lang()]||['Delete observation','Delete observation?'];
  const remove=el('button','btn btn-ghost',labels[0]);remove.type='button';remove.onclick=async()=>{if(!confirm(labels[1]))return;remove.disabled=true;
    try{await request('/api/observations/'+encodeURIComponent(id),null,'DELETE');dialog.close();await refresh();window.nmLoadV2Graph?.();}
    catch{remove.disabled=false;content.append(el('p','dom-record-note',text('retry')));}
  };actions.append(remove);content.append(actions);
 }catch{content.textContent=text('unavailable');const retry=el('button','btn btn-ghost',text('retry'));retry.onclick=()=>open(id);content.append(retry);}
}
async function refresh(){
 if(!history||!token())return;const version=++revision,auth=token();history.replaceChildren(el('h2','',text('recent')),el('p','dom-record-note',text('recentHint')));
 for(const item of pendingEntries()){const row=el('div','dom-pending-row'),retry=el('button','btn btn-ghost',text('retry'));retry.type='button';retry.onclick=async()=>{retry.disabled=true;try{const r=await save({}, {request:item.request});saved(r.record);}catch{retry.disabled=false;}};row.append(el('p','dom-record-note',text('error')),el('p','dom-record-source',item.request.text||item.request.chain.map(x=>x.label).join(' · ')),retry);history.append(row);}
 const list=el('div','dom-observation-list',text('loading'));history.append(list);
 try{const {records}=await request('/api/observations');if(version!==revision||auth!==token())return;list.replaceChildren();if(!records.length)list.append(el('p','dom-record-note',text('empty')));
  records.forEach(record=>{const button=el('button','dom-observation-row');button.type='button';button.append(el('span','dom-record-date',new Date(record.occurred_at).toLocaleString(lang())),el('span','dom-record-preview',record.source.text||record.chain.map(x=>x.label).join(' · ')));button.onclick=()=>open(record.id);list.append(button);});
 }catch{if(version!==revision)return;list.textContent=text('unavailable');const retry=el('button','btn btn-ghost',text('retry'));retry.onclick=refresh;list.append(retry);}
}
function mount(){
 const host=document.getElementById('dom-quick-record'),panel=document.getElementById('dom-quick-popup');if(!host||!panel||!token())return;
 if(!form){form=el('form','dom-record-form');const label=el('label','dom-record-label',text('prompt'));label.htmlFor='dom-record-text';const input=el('textarea');input.id='dom-record-text';input.rows=3;input.maxLength=12000;input.placeholder=text('placeholder');input.required=true;
  const actions=el('div','dom-record-actions'),submit=el('button','btn btn-solid',text('save')),status=el('p','dom-record-status');submit.type='submit';status.setAttribute('role','status');actions.append(submit);form.append(label,input,actions,status,el('p','dom-record-note',text('details')));panel.querySelector('.dom-quick-toolbar').after(form);let state={};
  form.onsubmit=async event=>{event.preventDefault();if(form.getAttribute('aria-busy')==='true'||!input.value.trim())return;const auth=token(),active=form;active.setAttribute('aria-busy','true');input.readOnly=true;submit.disabled=true;status.textContent=text('pending');
   try{const r=await save({text:input.value.trim(),chain:[{type:'concept',label:input.value.trim(),valence:'neutral',metadata:{source:'quick_observation',user_added:true}}],session_id:state.request?.session_id||crypto.randomUUID(),intensity:null},state);if(auth!==token())return;input.value='';state={};status.textContent=text('saved');document.dispatchEvent(new CustomEvent('neuromap:save',{detail:{ok:true,record:r.record}}));saved(r.record);window.nmLoadV2Graph?.();}
   catch{if(auth===token()){status.textContent=text('error');refresh();}}
   finally{active.removeAttribute('aria-busy');submit.disabled=false;input.readOnly=!!state.request;}
  };
 }
 if(!history){history=el('section','dom-observation-history');history.id='dom-observation-history';host.after(history);}const auth=token();if(auth!==account){account=auth;refresh();}
}
function reset(){account='';revision++;if(form){form.remove();form=null;}if(history){history.remove();history=null;}document.getElementById('dom-observation-dialog')?.remove();}
setInterval(()=>{if(account&&account!==token())reset();mount();},800);
document.addEventListener('langchange',()=>{if(form){form.querySelector('label').textContent=text('prompt');form.querySelector('textarea').placeholder=text('placeholder');form.querySelector('button[type="submit"]').textContent=text('save');form.querySelector('.dom-record-note').textContent=text('details');}refresh();});
document.addEventListener('neuromap:save',()=>{clearTimeout(timer);timer=setTimeout(refresh,100);});
function accessibleChips(){document.querySelectorAll('#nmSurveyModal .nm-chip:not(button),#tools-sensation-wrap .sm-chip:not(button)').forEach(n=>{n.tabIndex=0;n.setAttribute('role','checkbox');n.setAttribute('aria-checked',String(n.classList.contains('active')||n.classList.contains('selected')));});}
document.addEventListener('keydown',e=>{const chip=e.target.closest?.('#nmSurveyModal .nm-chip:not(button),#tools-sensation-wrap .sm-chip:not(button)');if(chip&&(e.key===' '||e.key==='Enter')){e.preventDefault();chip.click();accessibleChips();}});
for(const root of document.querySelectorAll('#nmSurveyModal,#tools-sensation-wrap'))new MutationObserver(accessibleChips).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
window.DOMRecording={text,save,saved,open,surveyStatus};accessibleChips();mount();
})();
