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
  let serial=0,lastId='',activeDialog;
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
  async function open(id){
    const d=dialog(tr('Профиль участника','Member profile','Perfil de miembro'));
    const loading=el('p',tr('Загрузка…','Loading…','Cargando…'));d.append(loading);
    try{const data=await api('/api/social/profile/'+encodeURIComponent(id));if(d.open)loading.replaceWith(card(data,false));}catch(e){loading.textContent=e.message;}
  }
  function card(p,self){
    const box=el('article');box.className='dom-person-card';
    if(p.cover)box.append(photo(p.cover,'dom-person-cover'));
    const row=el('header');row.className='dom-person-title';
    if(self){
      const avatar=avatarControls;
      if(avatar)row.append(avatar);
      const img=document.getElementById('rpg-avatar-img');if(img)img.src=p.avatar_url||'assets/avatars/stars-default.gif';
    }else if(p.avatar_url)row.append(photo(p.avatar_url,'dom-person-avatar'));
    const identity=el('div');identity.append(el('h2',p.display_name));
    if(p.bio)identity.append(el('p',p.bio));row.append(identity);box.append(row);
    if(self)box.append(button(tr('Редактировать профиль','Edit profile','Editar perfil'),()=>edit(p)));
    else if(!p.profile_public)box.append(el('p',tr('Закрытый профиль','Private profile','Perfil privado')));
    if(!self&&p.id!==window.currentUser?.id){box.append(button(tr('Написать','Message','Enviar mensaje'),()=>{activeDialog?.close();window.switchTab('domunity');window.domStartThreadFromProfile(p.id,p.display_name);}));}
    if(p.result?.profile){const s=block(tr('Результат теста','Test result','Resultado'));s.append(el('p',window.TEST_PROFILES_MAP?.[p.result.profile]?.name||String(p.result.profile)));box.append(s);}
    if(p.pulse){const s=block(p.pulse.metric_kind==='rhr'?tr('Пульс в покое','Resting heart rate','Pulso en reposo'):tr('Пульс','Heart rate','Pulso'));s.append(el('p',Math.round(p.pulse.value)+' bpm · '+new Date(p.pulse.measured_at).toLocaleString()));box.append(s);}
    if(self)box.append(streamButton());
    if(!self&&p.canReadPulse){
      const current=el('p');box.append(current);
      const watch=async()=>{if(!box.isConnected)return;
        try{const r=await api('/api/social/profile/'+p.id+'/pulse');if(!box.isConnected)return;
          current.textContent=r.sample?tr('Сейчас','Live','Ahora')+' · '+r.sample.bpm+' bpm':'';
          if(!r.allowed){activeDialog?.close();return;}
        }catch{current.textContent='';}
        if(box.isConnected)setTimeout(watch,5000);
      };setTimeout(watch,0);
    }
    if(p.map?.length){const s=block(tr('Последние записи Нейрокарты','Recent NeuroMap entries','Registros recientes del NeuroMapa'));for(const entry of p.map)s.append(el('p',String(entry.date).slice(0,10)+' · '+entry.labels.join(' → ')));box.append(s);}
    if(p.posts){const s=block(tr('Стена','Wall','Muro'));if(self)s.append(button(tr('Добавить запись','New post','Nueva publicación'),compose));
      for(const post of p.posts){const item=el('article');item.append(el('small',new Date(post.created_at).toLocaleString()),el('p',post.body));
        if(post.file_name)item.append(button(post.file_name,async()=>{try{const f=await api('/api/social/profile/'+p.id+'/posts/'+post.id+'/file');const a=el('a');a.download=f.name;a.href='data:application/octet-stream;base64,'+f.base64;a.click();}catch(e){alert(e.message);}}));
        if(self)item.append(button(tr('Удалить','Delete','Eliminar'),async()=>{if(!confirm(tr('Удалить эту запись?','Delete this post?','¿Eliminar esta publicación?')))return;try{await api('/api/social/posts/'+post.id,{method:'DELETE'});item.remove();}catch(e){alert(e.message);}}));s.append(item);
      }box.append(s);
    }
    return box;
  }
  function form(title,submit,action){
    const d=dialog(title),f=el('form'),status=el('p'),send=el('button',submit);send.className='btn btn-solid';status.setAttribute('role','status');d.append(el('h2',title),f,status,send);
    send.onclick=()=>f.requestSubmit();f.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{await action();d.close();await login(window.currentUser);}catch(err){status.textContent=err.message;}finally{send.disabled=false;}};return f;
  }
  function compose(){
    const body=el('textarea'),file=el('input');body.maxLength=4000;file.type='file';
    const f=form(tr('Новая запись','New post','Nueva publicación'),tr('Сохранить','Save','Guardar'),async()=>{
      let attachment=null;const selected=file.files[0];
      if(selected){if(selected.size>2*1024*1024)throw Error('Max. 2 MB');attachment={name:selected.name,base64:(await fileData(selected)).split(',')[1]};}
      await api('/api/social/posts',{method:'POST',body:{body:body.value,attachment}});
    });f.append(field(tr('Текст','Text','Texto'),body),field(tr('Файл до 2 МБ','File up to 2 MB','Archivo de hasta 2 MB'),file));
  }
  function edit(p){
    const name=el('input'),bio=el('textarea'),visible=el('input'),cover=el('input'),remove=el('input'),fields={};
    name.value=p.display_name||'';name.maxLength=100;name.required=true;bio.value=p.bio||'';bio.maxLength=1500;visible.type=remove.type='checkbox';visible.checked=p.profile_public;cover.type='file';cover.accept='image/jpeg,image/png,image/webp';
    const f=form(tr('Профиль и видимость','Profile and visibility','Perfil y visibilidad'),tr('Сохранить','Save','Guardar'),async()=>{
      const file=cover.files[0];if(file?.size>2200000)throw Error('Max. 2 MB');
      await api('/api/social/settings',{method:'PUT',body:{name:name.value,bio:bio.value,open:visible.checked,cover:file?await fileData(file):(remove.checked?'':null),sharing:Object.fromEntries(Object.entries(fields).map(([k,s])=>[k,s.value]))}});
      Object.assign(window.currentUser,{name:name.value,display_name:name.value,bio:bio.value,profile_public:visible.checked});avatars.clear();
    });
    f.append(field(tr('Имя или псевдоним','Display name','Nombre público'),name),field(tr('О себе','Bio','Biografía'),bio),field(tr('Обложка · до 2 МБ','Cover · up to 2 MB','Portada · hasta 2 MB'),cover));
    if(p.cover)f.append(field(tr('Убрать обложку','Remove cover','Quitar portada'),remove));
    f.append(field(tr('Открыть профиль участникам DOM','Open profile to DOM members','Abrir el perfil a miembros de DOM'),visible));
    for(const [key,title] of Object.entries({results:tr('Результат теста','Test result','Resultado'),map:tr('Метки последних 8 записей Нейрокарты','Labels of the last 8 NeuroMap entries','Etiquetas de los últimos 8 registros'),pulse:tr('Последний замер пульса с датой','Latest heart rate with timestamp','Último pulso con fecha'),wall:tr('Стена и файлы','Wall and files','Muro y archivos')})){
      const s=el('select');s.add(new Option(tr('Только я','Only me','Solo yo'),'private'));s.add(new Option(tr('Все участники','All members','Todos los miembros'),'members'));for(const g of p.groups||[])s.add(new Option(g.name,'group:'+g.id));
      s.value=p.sharing?.[key]||'private';if(!s.value)s.value='private';fields[key]=s;f.append(field(title,s));
    }
    const update=()=>Object.values(fields).forEach(s=>s.disabled=!visible.checked);visible.onchange=update;update();
  }
  function guide(){
    const box=el('section');box.className='dom-person-card dom-guide';box.append(el('h2',tr('Спросить DOM','Ask DOM','Pregunta a DOM')));
    const form=el('form'),input=el('input'),answer=el('p'),go=el('button',tr('Спросить','Ask','Preguntar')),feedback=el('details'),note=el('textarea');
    input.placeholder=tr('Что хочешь сделать в кабинете?','What would you like to do?','¿Qué quieres hacer?');input.required=true;input.maxLength=note.maxLength=1500;go.className='btn btn-solid';answer.setAttribute('role','status');
    feedback.append(el('summary',tr('Уточнить инструкцию DOM','Teach DOM a correction','Corregir la guía de DOM')),note);feedback.hidden=true;
    let question='';
    feedback.append(button(tr('Сохранить для команды','Save for the team','Guardar para el equipo'),async e=>{if(!note.value.trim())return;e.currentTarget.disabled=true;const b=e.currentTarget;try{await api('/api/dom-guide/feedback',{method:'POST',body:{question,instruction:note.value}});note.value='';feedback.open=false;answer.after(el('small',tr('Поправка сохранена','Correction saved','Corrección guardada')));}catch(err){answer.textContent=err.message;}finally{b.disabled=false;}}));
    form.append(input,go);form.onsubmit=async e=>{e.preventDefault();question=input.value.trim();if(!question)return;go.disabled=true;feedback.hidden=true;answer.textContent=tr('DOM готовит ответ…','DOM is replying…','DOM está respondiendo…');try{const r=await api('/api/dom-guide/ask',{method:'POST',body:{question,screen:document.body.dataset.accountTab,language:document.documentElement.lang}});answer.textContent=r.answer;}catch(err){answer.textContent=err.message;}finally{go.disabled=false;feedback.hidden=false;}};
    box.append(form,answer,feedback);return box;
  }
  async function login(user){
    const host=document.getElementById('dom-social-self');if(!user?.id||!host)return;
    const ticket=++serial;
    if(sensor&&streamOwner!==user.id)sensor.disconnect();
    if(lastId!==user.id){activeDialog?.close();avatars.clear();host.replaceChildren();lastId=user.id;}
    try{const p=await api('/api/social/profile/'+encodeURIComponent(user.id));
      if(ticket!==serial||window.currentUser?.id!==user.id)return;
      const profile=card(p,true);host.replaceChildren(profile);Object.assign(user,{display_name:p.display_name,bio:p.bio,profile_public:p.profile_public});
    }catch(e){if(ticket!==serial)return;host.replaceChildren(el('p',e.message),button(tr('Повторить','Retry','Reintentar'),()=>login(user)));}
    if(['admin','superadmin','founder'].includes(user.serverRole))host.prepend(guide());
  }
  function ask(){if(['admin','superadmin','founder'].includes(window.currentUser?.serverRole))dialog('DOM').append(guide());}
  window.DOMSocial={login,open,peer,ask};login(window.currentUser);
})();
