/* Account identity, optional sharing and the staff guide. */
(()=>{
  'use strict';
  const tr=(ru,en,es)=>({ru,en,es}[document.documentElement.lang]||en);
  const el=(tag,text)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;return node;};
  function button(text,action){const b=el('button',text);b.type='button';b.className='btn btn-ghost';b.onclick=action;return b;}
  function field(title,input){const label=el('label',title);label.append(input);return label;}
  const api=(path,opts)=>window.domApi(path,opts);
  const fileData=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
  const avatars=new Map();
  const avatarControls=document.getElementById('rpg-avatar-wrap')?.parentElement;
  const growthHero=document.getElementById('rpg-hero'),experience=document.getElementById('rpg-xp-card');
  let profileTab='presence';
  let serial=0,lastId='',activeDialog;
  const memberKey=()=>new URL(location.href).searchParams.get('member');
  const isMemberId=id=>typeof id==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id);
  function closeMember(){
    const url=new URL(location.href);url.searchParams.delete('member');
    if(history.state?.domMember)history.back();
    else{history.replaceState(null,'',url);activeDialog?.close();}
  }
  function restoreMember(){
    const id=memberKey();
    if(isMemberId(id)&&window.currentUser?.id){if(activeDialog?.dataset.member!==id)open(id,false);}
    else if(activeDialog?.dataset.member)activeDialog.close();
  }
  window.addEventListener('popstate',restoreMember);
  function dialog(title){
    activeDialog?.close();
    const d=el('dialog');d.className='dom-social-dialog';d.setAttribute('aria-label',title);
    d.append(button(tr('Закрыть','Close','Cerrar'),()=>d.close()));document.body.append(d);
    d.addEventListener('close',()=>{d.remove();if(activeDialog===d)activeDialog=null;});
    activeDialog=d;d.showModal();return d;
  }
  function peer(id,name){
    const b=button('',()=>open(id));b.className='dom-person-link';
    const fallback=el('span',(name||'•').trim().slice(0,1));b.append(fallback,document.createTextNode(name||tr('Профиль','Profile','Perfil')));
    const key=window.currentUser?.id+':'+id;
    if(!avatars.has(key))avatars.set(key,api('/api/social/avatar/'+encodeURIComponent(id)).then(r=>r.avatar).catch(()=>null));
    avatars.get(key).then(url=>{if(url){const img=el('img');img.alt='';img.src=url;fallback.replaceWith(img);}});
    return b;
  }
  let sensor,streamOwner;
  function streamButton(){
    const b=button(tr('Подключить датчик пульса','Connect heart rate sensor','Conectar pulsómetro'),async()=>{
      if(sensor){sensor.disconnect();return;}
      if(!navigator.bluetooth){alert(tr('Нужен браузер с Web Bluetooth и датчик Bluetooth LE.','Use a Web Bluetooth browser and a Bluetooth LE sensor.','Usa un navegador Web Bluetooth y un pulsómetro Bluetooth LE.'));return;}
      try{
        const device=await navigator.bluetooth.requestDevice({filters:[{services:['heart_rate']}]});
        const id=window.currentUser?.id,server=await device.gatt.connect();sensor=server;streamOwner=id;
        device.addEventListener('gattserverdisconnected',()=>{sensor=null;b.textContent=tr('Подключить датчик пульса','Connect heart rate sensor','Conectar pulsómetro');if(window.currentUser?.id===id)api('/api/social/live-pulse',{method:'DELETE'}).catch(()=>{});},{once:true});
        const service=await server.getPrimaryService('heart_rate');
        const c=await service.getCharacteristic('heart_rate_measurement');
        let last=0,busy=false;
        c.addEventListener('characteristicvaluechanged',async e=>{
          if(window.currentUser?.id!==id){server.disconnect();return;}
          if(busy||Date.now()-last<3500)return;
          const v=e.target.value,bpm=v.getUint8(0)&1?v.getUint16(1,true):v.getUint8(1);
          busy=true;last=Date.now();
          try{await api('/api/social/live-pulse',{method:'PUT',body:{bpm}});b.textContent=bpm+' bpm · '+tr('Остановить','Stop','Detener');}
          catch{server.disconnect();}finally{busy=false;}
        });
        await c.startNotifications();b.textContent=tr('Остановить датчик','Stop sensor','Detener sensor');
      }catch(e){sensor?.disconnect();if(e.name!=='NotFoundError')alert(e.message);}
    });if(sensor)b.textContent=tr('Остановить датчик','Stop sensor','Detener sensor');return b;
  }
  function photo(url,cls){const img=el('img');img.className=cls;img.src=url;img.alt='';return img;}
  function block(title){const section=el('section');section.append(el('h3',title));return section;}
  async function open(id,push=true){
    if(!isMemberId(id))return;
    if(push&&memberKey()!==id){const url=new URL(location.href);url.searchParams.set('member',id);history.pushState({domMember:true},'',url);}
    const d=dialog(tr('Профиль участника','Member profile','Perfil de miembro'));
    d.dataset.member=id;
    d.firstElementChild.onclick=closeMember;
    d.addEventListener('cancel',e=>{e.preventDefault();closeMember();});
    const loading=el('p',tr('Загрузка…','Loading…','Cargando…'));d.append(loading);
    try{const data=await api('/api/social/profile/'+encodeURIComponent(id));if(d.open)loading.replaceWith(card(data,false));}catch(e){loading.textContent=e.message;}
  }
  function card(p,self,preview=false){
    const box=el('article');box.className='dom-person-card';
    if(p.cover)box.append(photo(p.cover,'dom-person-cover'));
    const row=el('header');row.className='dom-person-title';
    if(self){
      const avatar=avatarControls;
      if(avatar)row.append(avatar);
      const img=document.getElementById('rpg-avatar-img');if(img)img.src=p.avatar_url||'assets/avatars/stars-default.gif';
    }else if(p.avatar_url)row.append(photo(p.avatar_url,'dom-person-avatar'));
    const identity=el('div');identity.setAttribute('data-title-case-skip','');identity.append(el('h2',p.display_name));
    if(p.tagline)identity.append(el('p',p.tagline));
    if(p.org_role)identity.append(el('small',p.org_role));
    if(p.bio)identity.append(el('p',p.bio));
    if(p.location||p.interests)identity.append(el('small',[p.location,p.interests].filter(Boolean).join(' · ')));
    if(p.links&&/^https?:\/\//i.test(p.links)){const a=el('a',p.links);a.href=p.links;a.rel='noopener noreferrer';a.target='_blank';identity.append(a);}
    row.append(identity);box.append(row);
    if(self){const editButton=button(tr('Редактировать профиль','Edit profile','Editar perfil'),()=>edit(p));row.append(editButton);}
    else if(!p.profile_public)box.append(el('p',tr('Закрытый профиль','Private profile','Perfil privado')));
    if(!self&&p.id!==window.currentUser?.id){box.append(button(tr('Написать','Message','Enviar mensaje'),()=>{const url=new URL(location.href);url.searchParams.delete('member');history.replaceState(null,'',url);activeDialog?.close();window.switchTab('domunity');window.domStartThreadFromProfile(p.id,p.display_name);}));}
    if(self&&growthHero&&experience&&(!p.result?.profile||window.TEST_PROFILES_MAP?.[p.result.profile])){
      const growth=el('section');growth.className='lp-development';growth.append(growthHero,experience);box.append(growth);
    }else if(p.result?.profile){
      const type=el('strong',window.TEST_PROFILES_MAP?.[p.result.profile]?.name||String(p.result.profile).replaceAll('_',' '));
      type.className='lp-type';type.title=tr('Тип адаптации','Adaptation type','Tipo de adaptación');identity.append(type);
    }
    const more=el('details');more.append(el('summary',tr('Данные профиля','Profile data','Datos de perfil')));
    if(p.pulse){const s=block(p.pulse.metric_kind==='rhr'?tr('Пульс в покое','Resting heart rate','Pulso en reposo'):tr('Пульс','Heart rate','Pulso'));s.append(el('p',Math.round(p.pulse.value)+' bpm · '+new Date(p.pulse.measured_at).toLocaleString()));more.append(s);}
    if(self){
      const devices=el('details'),list=el('div');
      devices.append(el('summary',tr('Подключить устройство','Connect a device','Conectar dispositivo')),list);
      list.append(streamButton());
      const wear=document.getElementById('wear-card');
      if(wear)devices.ontoggle=()=>{
        if(devices.open && wear.getClientRects().length && !list.querySelector('[data-wear]')){
          const jump=button('Oura Ring · WHOOP',()=>wear.scrollIntoView({block:'center'}));
          jump.dataset.wear='';list.append(jump);
        }
      };
      list.append(el('p',tr('Планируемые подключения: ЭЭГ и нейрообратная связь (Muse), устройства для голосовых заметок (Omi), наушники, датчики движения и дыхания, личный ИИ.','Planned connections: EEG and neurofeedback (Muse), voice notes (Omi), headphones, motion and breathing sensors, personal AI.','Conexiones previstas: EEG y neurofeedback (Muse), notas de voz (Omi), auriculares, sensores de movimiento y respiración e IA personal.')));
      box.append(devices);
    }
    if(!self&&!preview&&p.canReadPulse){
      const current=el('p');more.append(current);
      const watch=async()=>{if(!box.isConnected)return;
        try{const r=await api('/api/social/profile/'+p.id+'/pulse');if(!box.isConnected)return;
          current.textContent=r.sample?tr('Сейчас','Live','Ahora')+' · '+r.sample.bpm+' bpm':'';
          if(!r.allowed){activeDialog?.close();return;}
        }catch{current.textContent='';}
        if(box.isConnected)setTimeout(watch,5000);
      };setTimeout(watch,0);
    }
    if(p.map?.length){const s=block(tr('Последние записи Нейрокарты','Recent NeuroMap entries','Registros recientes del NeuroMapa'));for(const entry of p.map){
      const chain=el('ol');chain.className='dom-recorded-chain';
      for(const label of entry.labels)chain.append(el('li',label));
      s.append(el('small',String(entry.date).slice(0,10)),chain);
    }more.append(s);}
    let stream;
    if(p.posts){const s=el('section');stream=s;s.className='lp-stream';if(self){
      const publish=button(tr('Написать пост','Write a post','Publicar'),()=>compose());publish.className='btn btn-solid lp-publish';s.append(publish);
    }
      for(const post of p.posts){const item=el('article');item.dataset.post=post.id;item.append(el('small',new Date(post.created_at).toLocaleString()),el('p',post.body));
        if(post.file_name)item.append(button(post.file_name,async()=>{try{const f=await api('/api/social/profile/'+p.id+'/posts/'+post.id+'/file');const a=el('a');a.download=f.name;a.href='data:application/octet-stream;base64,'+f.base64;a.click();}catch(e){alert(e.message);}}));
        if(self)item.append(button(tr('Изменить','Edit','Editar'),()=>compose(post)));
        if(self)item.append(button(tr('Удалить','Delete','Eliminar'),async()=>{if(!confirm(tr('Удалить эту запись?','Delete this post?','¿Eliminar esta publicación?')))return;try{await api('/api/social/posts/'+post.id,{method:'DELETE'});item.remove();}catch(e){alert(e.message);}}));s.append(item);
      }
    }
    const space=el('div');box.append(space);if(more.children.length>1)box.append(more);
    // Keep Stream available during loading or a temporary error.
    if(stream)space.append(stream);
    const previewProfile=async()=>{
      const data=await api('/api/social/profile/'+p.id+'?preview=1');
      const d=dialog(tr('Как видит участник DOM','DOM member view','Vista de un miembro DOM'));d.append(card(data,false,true));
    };
    import('./dom-presence.js?v=1').then(m=>m.presence(space,{p,self,preview,el,button,field,tr,api,stream,
      initialTab:self?profileTab:'presence',onTab:t=>{if(self)profileTab=t;},refresh:()=>login(window.currentUser),previewProfile})).catch(e=>space.append(el('p',e.message)));
    return box;
  }
  function form(title,submit,action){
    const d=dialog(title),f=el('form'),status=el('p'),send=el('button',submit);send.className='btn btn-solid';status.setAttribute('role','status');d.append(el('h2',title),f,status,send);
    send.onclick=()=>f.requestSubmit();f.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{await action();d.close();await login(window.currentUser);}catch(err){status.textContent=err.message;}finally{send.disabled=false;}};return f;
  }
  function compose(post){
    const body=el('textarea'),file=el('input');body.maxLength=4000;file.type='file';
    body.value=post?.body||'';
    const f=form(post?tr('Изменить пост','Edit post','Editar publicación'):tr('Новый пост','New post','Nueva publicación'),post?tr('Сохранить','Save','Guardar'):tr('Опубликовать','Publish','Publicar'),async()=>{
      if(post){await api('/api/social/posts/'+post.id,{method:'PATCH',body:{body:body.value}});return;}
      let attachment=null;const selected=file.files[0];
      if(selected){if(selected.size>16*1024*1024)throw Error('Max. 16 MB');attachment={name:selected.name,base64:(await fileData(selected)).split(',')[1]};}
      await api('/api/social/posts',{method:'POST',body:{body:body.value,attachment}});
    });f.append(field(tr('Текст','Text','Texto'),body));if(!post)f.append(field(tr('Файл до 16 МБ','File up to 16 MB','Archivo de hasta 16 MB'),file));
  }
  function edit(p){
    const name=el('input'),bio=el('textarea'),visible=el('input'),cover=el('input'),remove=el('input'),fields={};
    name.value=p.display_name||'';name.maxLength=100;name.required=true;bio.value=p.bio||'';bio.maxLength=1500;visible.type=remove.type='checkbox';visible.checked=p.profile_public;cover.type='file';cover.accept='image/jpeg,image/png,image/webp';
    const labels={tagline:tr('Самоназвание','Tagline','Identidad'),location:tr('Место','Location','Lugar'),links:tr('Личная ссылка','Personal link','Enlace personal'),interests:tr('Интересы','Interests','Intereses')},identity={};
    for(const k of Object.keys(labels)){identity[k]=el('input');identity[k].maxLength=400;identity[k].value=p[k]||'';}
    identity.links.type='url';
    const role=el('input'),staff=['admin','superadmin','founder'].includes(window.currentUser?.serverRole);
    role.value=p.org_role||'';role.maxLength=160;
    const f=form(tr('Профиль','Profile','Perfil'),tr('Сохранить','Save','Guardar'),async()=>{
      const file=cover.files[0];if(file?.size>2200000)throw Error('Max. 2 MB');
      await api('/api/social/settings',{method:'PUT',body:{name:name.value,bio:bio.value,identity:Object.fromEntries(Object.entries(identity).map(([k,v])=>[k,v.value])),...(staff?{org_role:role.value}:{}),open:visible.checked,cover:file?await fileData(file):(remove.checked?'':null),sharing:Object.fromEntries(Object.entries(fields).map(([k,s])=>[k,s.value]))}});
      Object.assign(window.currentUser,{name:name.value,display_name:name.value,bio:bio.value,profile_public:visible.checked});avatars.clear();
    });
    const help=el('details'),star=el('summary','✱'),tip=tr('Выберите, кто в DOM увидит вашу страницу и каждый раздел. Имя остаётся в беседах даже при закрытом профиле.','Choose who can see your page and each section. Your name still appears in conversations when your profile is private.','Elige quién puede ver tu página y cada sección. Tu nombre sigue en las conversaciones con el perfil privado.');
    star.title=tip;star.setAttribute('aria-label',tr('Кто видит профиль?','Who sees my profile?','¿Quién ve mi perfil?'));help.append(star,el('p',tip));f.previousElementSibling.append(help);
    f.append(field(tr('Имя или псевдоним','Display name','Nombre público'),name),field(labels.tagline,identity.tagline),field(tr('О себе','Bio','Biografía'),bio));
    if(staff){
      const roles=el('details');roles.open=!!role.value;roles.append(el('summary',tr('Роли в DOM','Roles at DOM','Funciones en DOM')),field(tr('Должность или роль в проекте','Position or project role','Cargo o función en el proyecto'),role));f.append(roles);
    }
    for(const k of ['location','links','interests'])f.append(field(labels[k],identity[k]));
    f.append(field(tr('Обложка · до 2 МБ','Cover · up to 2 MB','Portada · hasta 2 MB'),cover));
    if(p.cover)f.append(field(tr('Убрать обложку','Remove cover','Quitar portada'),remove));
    f.append(field(tr('Мой профиль с фото и обложкой виден всем, кто вошёл в DOM','Show my profile photo and cover to signed-in members','Mostrar mi foto y portada a los miembros de DOM'),visible));
    f.append(el('h3',tr('Кто что видит','Who can see each field','Quién ve cada campo')));
    for(const [key,title] of Object.entries({...labels,bio:tr('О себе','Bio','Biografía'),...(staff||p.org_role?{org_role:tr('Роли в DOM','DOM roles','Funciones en DOM')}:{}),results:tr('Тип адаптации (например, Future Specialist)','Profile from my last completed test','Perfil de mi última prueba completada'),map:tr('Нейрокарта · даты и названия точек в последних восьми цепочках','NeuroMap · dates and point names in my last eight chains','Etiquetas de los últimos 8 registros'),pulse:tr('Пульс · последнее полученное измерение и время, включая сигнал подключённого датчика','Heart rate · latest recorded value and time, including a connected live sensor','Último pulso con fecha'),wall:tr('Мои публикации в профиле и прикреплённые к ним файлы','My profile posts and their attachments','Muro y archivos')})){
      const s=el('select');s.add(new Option(tr('Только я','Only me','Solo yo'),'private'));s.add(new Option(tr('Все участники','All members','Todos los miembros'),'members'));for(const g of p.groups||[])s.add(new Option(g.name,'group:'+g.id));
      for(const contact of p.contacts||[])s.add(new Option(tr('Только ','Only ','Solo ')+(contact.display_name||contact.id),'person:'+contact.id));
      s.value=p.sharing?.[key]||(['bio','org_role'].includes(key)?'members':'private');if(!s.value)s.value='private';fields[key]=s;f.append(field(title,s));
    }
    const update=()=>Object.values(fields).forEach(s=>s.disabled=!visible.checked);visible.onchange=update;update();
  }
  function guide(){
    const box=el('section');box.className='dom-person-card dom-guide';const heading=el('header');heading.append(el('h2',tr('Спросить DOM','Ask DOM','Pregunta a DOM')));box.append(heading);
    const form=el('form'),input=el('input'),answer=el('p'),go=el('button',tr('Спросить','Ask','Preguntar')),feedback=el('details'),note=el('textarea');
    input.setAttribute('aria-label',tr('Сообщение для DOM','Message for DOM','Mensaje para DOM'));input.placeholder=tr('Что хочешь сделать в кабинете?','What would you like to do?','¿Qué quieres hacer?');input.required=true;input.maxLength=note.maxLength=1500;go.className='btn btn-solid';answer.setAttribute('role','status');
    feedback.append(el('summary',tr('Уточнить инструкцию DOM','Teach DOM a correction','Corregir la guía de DOM')),note);feedback.hidden=true;
    let question='';const history=[],next=el('div');
    const transcript=el('div');transcript.className='dom-guide-transcript';
    const expand=button('',()=>setExpanded(expand.getAttribute('aria-expanded')!=='true'));
    function setExpanded(on){
      expand.setAttribute('aria-expanded',String(on));
      expand.textContent=on?tr('Свернуть','Collapse','Contraer'):tr('Развернуть','Expand','Ampliar');
      transcript.hidden=!on;next.hidden=!on;feedback.hidden=!on||!question||go.disabled||history.at(-2)?.content!==question;
    }
    heading.append(expand);setExpanded(false);
    const destinations={
      overview:['overview',null,tr('Открыть профиль','Open profile','Abrir perfil')],
      personal:['evolution','evo-subtab-personal',tr('Мой путь','My path','Mi ruta')],
      map:['tools','tools-mode-nm','NeuroMap'],anatomy:['tools','tools-mode-anatomy',tr('Внутреннее воздействие','Internal field','Campo interno')],
      programs:['enroll',null,tr('Выбрать программу','Choose a program','Elegir programa')],community:['domunity',null,'DOMunity']
    };
    feedback.append(button(tr('Сохранить для команды','Save for the team','Guardar para el equipo'),async e=>{if(!note.value.trim())return;e.currentTarget.disabled=true;const b=e.currentTarget;try{await api('/api/dom-guide/feedback',{method:'POST',body:{question,instruction:note.value}});note.value='';feedback.open=false;answer.after(el('small',tr('Поправка сохранена','Correction saved','Corrección guardada')));}catch(err){answer.textContent=err.message;}finally{b.disabled=false;}}));
    form.append(input,go);form.onsubmit=async e=>{e.preventDefault();question=input.value.trim();if(!question)return;note.value='';feedback.open=false;go.disabled=true;setExpanded(true);feedback.hidden=true;next.replaceChildren();answer.classList.remove('dom-guide-sr');answer.textContent=tr('DOM готовит ответ…','DOM is replying…','DOM está respondiendo…');try{const r=await api('/api/dom-guide/ask',{method:'POST',body:{question,screen:document.body.dataset.accountTab,language:document.documentElement.lang,history:history.slice(-6)}});if(!r.answer?.trim())throw Error(tr('DOM не прислал ответ. Попробуйте ещё раз.','DOM returned an empty answer. Try again.','DOM no envió respuesta. Inténtalo de nuevo.'));
      transcript.append(el('strong',question),el('p',r.answer));transcript.scrollTop=transcript.scrollHeight;answer.textContent=r.answer;answer.classList.add('dom-guide-sr');
      feedback.hidden=expand.getAttribute('aria-expanded')!=='true';
      history.push({role:'user',content:question},{role:'assistant',content:r.answer});input.value='';
      const dest=destinations[r.action];if(dest){const top=document.querySelector('.dash-nav-primary a[data-tab="'+dest[0]+'"]');if(top&&top.style.pointerEvents!=='none')next.append(button(dest[2],()=>{activeDialog?.close();window.switchTab(dest[0]);if(dest[1])document.getElementById(dest[1])?.click();window.history.replaceState(null,'','#'+dest[0]+(dest[1]?'/'+dest[1]:''));}));}}catch(err){answer.textContent=err.message;}finally{go.disabled=false;}};
    box.append(transcript,form,answer,next,feedback);return box;
  }
  async function login(user){
    const host=document.getElementById('dom-social-self');if(!user?.id||!host)return;
    const ticket=++serial;
    if(sensor&&streamOwner!==user.id)sensor.disconnect();
    if(lastId!==user.id){activeDialog?.close();avatars.clear();profileTab='presence';host.replaceChildren();lastId=user.id;}
    try{const p=await api('/api/social/profile/'+encodeURIComponent(user.id));
      if(ticket!==serial||window.currentUser?.id!==user.id)return;
      const profile=card(p,true);host.replaceChildren(profile);Object.assign(user,{display_name:p.display_name,bio:p.bio,profile_public:p.profile_public});
    }catch(e){if(ticket!==serial)return;host.replaceChildren(el('p',e.message),button(tr('Повторить','Retry','Reintentar'),()=>login(user)));}
    if(['admin','superadmin','founder'].includes(user.serverRole))host.prepend(guide());
    restoreMember();
  }
  function ask(){if(['admin','superadmin','founder'].includes(window.currentUser?.serverRole))dialog('DOM').append(guide());}
  window.DOMSocial={login,open,peer,ask};login(window.currentUser);
})();
