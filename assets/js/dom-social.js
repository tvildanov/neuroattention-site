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
  const hero=document.getElementById('rpg-hero'),xp=document.getElementById('rpg-xp-card');

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
  function card(p,self){
    const box=el('article');box.className='dom-person-card';
    if(p.cover)box.append(photo(p.cover,'dom-person-cover'));
    const row=el('header');row.className='dom-person-title';
    if(self){
      const avatar=avatarControls;
      if(avatar)row.append(avatar);
      const img=avatar?.querySelector('#rpg-avatar-img');if(img)img.src=p.avatar_url||'assets/avatars/stars-default.gif';
    }else if(p.avatar_url)row.append(photo(p.avatar_url,'dom-person-avatar'));
    const identity=el('div');identity.setAttribute('data-title-case-skip','');identity.append(el('h2',p.display_name));
    if(p.org_role)identity.append(el('small',p.org_role));
    if(p.bio)identity.append(el('p',p.bio));row.append(identity);box.append(row);
    const typeName=p.diagnostic?.name||window.TEST_PROFILES_MAP?.[p.result?.profile]?.name||p.result?.profile?.replaceAll('_',' ');
    if(typeName){const type=el('p',typeName);type.className='dom-person-type';identity.append(type);box.classList.add('dom-has-type');}
    if(self){
      row.append(button(tr('Редактировать','Edit profile','Editar perfil'),()=>edit(p)));
      if(hero&&xp){
        const progress=el('div');progress.className='dom-profile-progress';
        progress.append(hero,xp);box.append(progress);
      }
    }else{
      if(!p.profile_public)box.append(el('p',tr('Закрытый профиль','Private profile','Perfil privado')));
      if(p.id!==window.currentUser?.id)box.append(button(tr('Написать','Message','Enviar mensaje'),()=>{const url=new URL(location.href);url.searchParams.delete('member');history.replaceState(null,'',url);activeDialog?.close();window.switchTab('domunity');window.domStartThreadFromProfile(p.id,p.display_name);}));
    }
    if(p.pulse){const s=block(p.pulse.metric_kind==='rhr'?tr('Пульс в покое','Resting heart rate','Pulso en reposo'):tr('Пульс','Heart rate','Pulso'));s.append(el('p',Math.round(p.pulse.value)+' bpm · '+new Date(p.pulse.measured_at).toLocaleString()));box.append(s);}
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
    return makeBoard(p,self,box);
  }
  function showAttachment(host,p,post){
    const ext=post.file_name.split('.').pop().toLowerCase();
    const mime={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',avif:'image/avif',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',pdf:'application/pdf',txt:'text/plain'}[ext];
    let pending;
    const load=()=>pending||(pending=api('/api/social/profile/'+p.id+'/posts/'+post.id+'/file').catch(e=>{pending=null;throw e;}));
    const download=button(post.file_name,async()=>{try{const f=await load(),a=el('a');a.href='data:application/octet-stream;base64,'+f.base64;a.download=f.name;a.click();}catch(e){alert(e.message);}});
    host.append(download);if(!mime)return;
    const preview=el('div');preview.className='dom-board-media';download.before(preview);
    async function render(){
      try{const f=await load();if(!host.isConnected)return;
        let media;
        if(mime==='text/plain'){media=el('pre',new TextDecoder().decode(Uint8Array.from(atob(f.base64.slice(0,65536)),c=>c.charCodeAt(0))));}
        else{
          media=el(mime.startsWith('image/')?'img':mime.startsWith('video/')?'video':mime.startsWith('audio/')?'audio':'iframe');
          if(media.tagName==='IFRAME'){media.setAttribute('sandbox','');media.title=f.name;}
          if(media.tagName==='IMG')media.alt=post.title||f.name;else{media.controls=true;media.preload='metadata';}
          media.src='data:'+mime+';base64,'+f.base64;
        }
        preview.replaceChildren(media);
      }catch(e){preview.replaceChildren(button(tr('Повторить загрузку','Retry preview','Reintentar'),render));}
    }
    if(['application/pdf','text/plain'].includes(mime)){preview.append(button(tr('Развернуть файл','Expand file','Abrir archivo'),render));return;}
    const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();render();}},{rootMargin:'160px'});observer.observe(preview);
  }
  function makeBoard(p,self,identity){
    const root=el('div'),grid=el('div'),bar=el('div'),status=el('span'),items=new Map();
    root.className='dom-profile-field';grid.className='dom-profile-grid';bar.className='dom-board-bar';status.setAttribute('role','status');
    root.append(bar,grid);let editing=false,busy=false;
    const mobile=()=>grid.clientWidth<560;
    function add(key,tile,w,h){
      tile.classList.add('dom-board-tile');tile.dataset.key=key;items.set(key,{key,tile,w,h});grid.append(tile);
    }
    add('identity',identity,window.innerWidth<700?12:8,p.cover?22:13);
    for(const post of p.posts||[]){
      const tile=el('article');
      if(post.title)tile.append(el('h3',post.title));
      if(post.file_name)showAttachment(tile,p,post);
      if(post.body)tile.append(el('p',post.body));
      if(post.snapshot){const excerpt=el('section'),list=el('ol');excerpt.className='dom-board-excerpt';excerpt.append(el('strong',sourceNames()[post.snapshot.kind]),list);
        for(const line of post.snapshot.items)list.append(el('li',line));tile.append(excerpt);}
      tile.append(el('small',new Date(post.created_at).toLocaleString()));
      if(self)tile.append(button(tr('Удалить','Delete','Eliminar'),async()=>{if(!confirm(tr('Удалить публикацию?','Delete this post?','¿Eliminar publicación?')))return;try{await api('/api/social/posts/'+post.id,{method:'DELETE'});tile.remove();items.delete('post-'+post.id);}catch(e){alert(e.message);}}));
      add('post-'+post.id,tile,6,post.file_name?14:8);
    }
    (p.presence||[]).forEach((card,i)=>{const tile=el('article');tile.dataset.tone=card.tone;
      tile.append(el('h3',card.title),el('p',card.text));add('card-'+i,tile,{full:12,wide:8,small:4}[card.size]||4,9);});
    const saved=p.board||[];
    const ordered=saved.map(t=>items.get(t.key)).filter(Boolean);
    for(const entry of saved){const item=items.get(entry.key);if(item)Object.assign(item,{w:entry.w,h:entry.h});}
    const missing=[...items.values()].filter(x=>!ordered.includes(x));
    if(ordered.length)ordered.splice(Math.max(0,ordered.findIndex(x=>x.key==='identity')+1),0,...missing);else ordered.push(...missing);
    for(const item of ordered)grid.append(item.tile);
    function paint(item){
      item.tile.style.setProperty('--tile-width',mobile()?Math.max(6,item.w):item.w);
      item.tile.style.setProperty('--tile-height',item.h);
    }
    const observer=new ResizeObserver(()=>{if(!grid.isConnected){observer.disconnect();return;}items.forEach(paint);});observer.observe(grid);
    items.forEach(paint);
    if(!self)return root;
    const share=button(tr('Поделиться','Share','Compartir'),()=>compose(p));share.classList.add('dom-share');
    const arrange=button(tr('Расставить блоки','Arrange blocks','Organizar bloques'),()=>editing?finish():start());
    bar.append(share,arrange,status);
    let hold;
    grid.addEventListener('pointerdown',e=>{
      if(editing||e.button!==0||e.target.closest('button,a,input,summary,video,audio'))return;
      const origin=[e.clientX,e.clientY];
      const cancel=()=>{clearTimeout(hold);grid.removeEventListener('pointermove',move);window.removeEventListener('pointerup',cancel);window.removeEventListener('pointercancel',cancel);};
      const move=m=>{if(Math.hypot(m.clientX-origin[0],m.clientY-origin[1])>8)cancel();};
      grid.addEventListener('pointermove',move);window.addEventListener('pointerup',cancel);window.addEventListener('pointercancel',cancel);
      hold=setTimeout(()=>{cancel();if(root.isConnected&&!editing)start();},480);
    });
    function start(){
      editing=true;root.classList.add('dom-arranging');arrange.textContent=tr('Сохранить расположение','Save layout','Guardar diseño');share.disabled=true;
      for(const item of items.values())handles(item);
    }
    async function finish(){
      if(busy)return;busy=true;arrange.disabled=true;grid.inert=true;
      try{
        const tiles=[...grid.children].map(node=>{const {key,w,h}=items.get(node.dataset.key);return {key,w,h};});
        const r=await api('/api/social/board',{method:'PUT',body:{tiles,version:p.board_version||0}});
        p.board_version=r.version;editing=false;root.classList.remove('dom-arranging');grid.querySelectorAll('.dom-grip').forEach(n=>n.remove());arrange.textContent=tr('Расставить блоки','Arrange blocks','Organizar bloques');share.disabled=false;status.textContent='';
      }catch(e){status.textContent=e.message;}finally{busy=false;arrange.disabled=false;grid.inert=false;}
    }
    function handles(item){
      const tile=item.tile;
      for(const resize of [false,true]){
        const grip=button(resize?'↘':'✥',()=>{});grip.className='dom-grip '+(resize?'resize':'move');grip.title=resize?tr('Размер · стрелки','Resize · arrow keys','Tamaño · flechas'):tr('Переместить · стрелки','Move · arrow keys','Mover · flechas');grip.setAttribute('aria-label',grip.title);tile.append(grip);
        function size(w,h){item.w=Math.max(mobile()?6:2,Math.min(12,w));item.h=Math.max(3,Math.min(40,h));paint(item);}
        grip.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const forward=['ArrowRight','ArrowDown'].includes(e.key);
          if(resize)size(item.w+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0),item.h+(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0));
          else{const other=forward?tile.nextElementSibling:tile.previousElementSibling;if(other){forward?other.after(tile):other.before(tile);grip.focus();}}
        };
        grip.onpointerdown=e=>{
          if(e.button!==0)return;e.preventDefault();grip.setPointerCapture(e.pointerId);
          const x=e.clientX,y=e.clientY,w=mobile()?Math.max(6,item.w):item.w,h=item.h;
          tile.classList.add('dom-dragging');
          grip.onpointermove=move=>{if(resize){size(w+Math.round((move.clientX-x)/((grid.clientWidth+8)/12)),h+Math.round((move.clientY-y)/20));}
            else{tile.style.translate=(move.clientX-x)+'px '+(move.clientY-y)+'px';}};
          const end=up=>{tile.style.translate='';tile.classList.remove('dom-dragging');grip.onpointermove=null;grip.onpointerup=null;grip.onpointercancel=null;
            if(!resize&&up.type==='pointerup'){const other=document.elementFromPoint(up.clientX,up.clientY)?.closest('.dom-board-tile');
              if(other&&other!==tile&&other.parentElement===grid){const children=[...grid.children];children.indexOf(other)>children.indexOf(tile)?other.after(tile):other.before(tile);}}
          };grip.onpointerup=end;grip.onpointercancel=end;
        };
      }
    }
    return root;
  }
  function sourceNames(){return {chain:tr('Цепочка Нейрокарты','NeuroMap chain','Cadena de NeuroMap'),path:tr('Личный путь','Personal path','Camino personal'),pattern:tr('Повторяющаяся связь','Recurring connection','Conexión recurrente'),atlas:tr('Снимок атласа','Atlas snapshot','Captura del atlas')};}
  function editPresence(p){
    let cards=p.presence.map(card=>({...card})),draggedIndex=null;
    const d=dialog('Presence'),list=el('div'),status=el('p'),tools=el('div');
    status.setAttribute('role','status');tools.className='dom-profile-tabs';
    function draw(){
      list.replaceChildren();
      cards.forEach((card,index)=>{
        const row=el('fieldset'),title=el('input'),body=el('textarea'),collection=el('input');
        function bind(input,key,limit){
          input.value=card[key];input.maxLength=limit;input.oninput=()=>{card[key]=input.value;};
        }
        bind(title,'title',100);bind(body,'text',1500);bind(collection,'collection',50);
        const size=el('select'),tone=el('select');
        for(const [value,label] of [['small',tr('Обычная','Standard','Normal')],['wide',tr('Широкая','Wide','Ancha')],['full',tr('Во всю строку','Full width','Fila completa')]])size.add(new Option(label,value));
        for(const [value,label] of [['neutral',tr('Спокойный','Neutral','Neutro')],['accent',tr('Акцентный','Accent','Acento')],['warm',tr('Тёплый','Warm','Cálido')]])tone.add(new Option(label,value));
        size.value=card.size;tone.value=card.tone;size.onchange=()=>card.size=size.value;tone.onchange=()=>card.tone=tone.value;
        function move(to){cards.splice(to,0,cards.splice(index,1)[0]);draw();list.children[to]?.querySelector('input')?.focus();}
        const up=button('↑',()=>move(index-1)),down=button('↓',()=>move(index+1));
        up.disabled=index===0;down.disabled=index===cards.length-1;
        up.setAttribute('aria-label',tr('Переместить выше','Move up','Subir'));down.setAttribute('aria-label',tr('Переместить ниже','Move down','Bajar'));
        const grip=el('legend',tr('Карточка ','Card ','Tarjeta ')+(index+1)+' ⠿');
        grip.draggable=true;grip.style.cursor='grab';
        grip.ondragstart=e=>{draggedIndex=index;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(index));};
        grip.ondragend=()=>{draggedIndex=null;};
        row.ondragover=e=>{if(draggedIndex!==null)e.preventDefault();};
        row.ondrop=e=>{
          if(draggedIndex===null)return;
          e.preventDefault();cards.splice(index,0,cards.splice(draggedIndex,1)[0]);draggedIndex=null;draw();
        };
        row.append(grip,field(tr('Заголовок','Title','Título'),title),field(tr('Текст','Text','Texto'),body),field(tr('Композиция','Collection','Colección'),collection),field(tr('Размер','Size','Tamaño'),size),field(tr('Цвет','Color','Color'),tone),up,down,button(tr('Убрать','Remove','Quitar'),()=>{cards.splice(index,1);draw();}));
        list.append(row);
      });
    }
    const file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
    file.onchange=async()=>{
      try{
        const selected=file.files[0];if(!selected)return;
        if(selected.size>300000)throw Error();
        const data=JSON.parse(await selected.text());
        if(data.format!=='dom-presence-v1'||!Array.isArray(data.cards)||data.cards.length>24||!data.cards.every(c=>c&&typeof c.title==='string'&&c.title.length<=100&&typeof c.text==='string'&&c.text.length<=1500&&typeof c.collection==='string'&&c.collection.length<=50&&['small','wide','full'].includes(c.size)&&['neutral','accent','warm'].includes(c.tone)))throw Error();
        cards=data.cards;draw();status.textContent='';
      }catch{status.textContent=tr('Проверьте формат файла Presence.','Check the Presence file format.','Comprueba el formato del archivo Presence.');}finally{file.value='';}
    };
    const save=button(tr('Сохранить','Save','Guardar'),async()=>{
      if(cards.some(c=>!c.title.trim()||!c.collection.trim())){status.textContent=tr('Укажите заголовок и композицию каждой карточки.','Each card needs a title and collection.','Añade un título y una colección a cada tarjeta.');return;}
      save.disabled=true;
      try{await api('/api/social/presence',{method:'PUT',body:{cards,version:p.presence_version}});d.close();await login(window.currentUser);}
      catch(e){status.textContent=e.message;}finally{save.disabled=false;}
    });
    tools.append(button(tr('Добавить карточку','Add card','Añadir tarjeta'),()=>{
      if(cards.length>=24){status.textContent=tr('Максимум 24 карточки.','Up to 24 cards.','Hasta 24 tarjetas.');return;}
      cards.push({title:'',text:'',collection:cards.at(-1)?.collection||tr('Сегодня','Today','Hoy'),size:'small',tone:'neutral'});draw();list.lastElementChild.querySelector('input').focus();
    }),button(tr('Импорт','Import','Importar'),()=>file.click()),button(tr('Экспорт','Export','Exportar'),()=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify({format:'dom-presence-v1',cards},null,2)],{type:'application/json'}));
      const a=el('a');a.download='dom-presence.json';a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }),save);
    d.append(el('h2','Presence'),list,tools,file,status);draw();
  }
  function form(title,submit,action){
    const d=dialog(title),f=el('form'),status=el('p'),send=el('button',submit);send.className='btn btn-solid';status.setAttribute('role','status');d.append(el('h2',title),f,status,send);
    send.onclick=()=>f.requestSubmit();f.onsubmit=async e=>{e.preventDefault();send.disabled=true;try{await action();d.close();await login(window.currentUser);}catch(err){status.textContent=err.message;}finally{send.disabled=false;}};return f;
  }
  function compose(p){
    const title=el('input'),body=el('textarea'),file=el('input'),preview=el('div');
    title.maxLength=160;body.maxLength=4000;file.type='file';
    const kind=el('select'),pick=el('select'),excerpt=el('ol'),note=el('p');
    kind.add(new Option(tr('Без фрагмента','No excerpt','Sin fragmento'),''));
    for(const [value,label] of Object.entries(sourceNames()))kind.add(new Option(label,value));
    let choices=[],snapshot=null,ticket=0;
    pick.hidden=true;
    pick.onchange=()=>{const choice=choices[Number(pick.value)];snapshot=pick.value!==''&&choice?{kind:kind.value,items:choice.items}:null;excerpt.replaceChildren();
      for(const line of snapshot?.items||[])excerpt.append(el('li',line));};
    kind.onchange=async()=>{
      const current=++ticket,mode=kind.value;
      snapshot=null;choices=[];pick.hidden=true;pick.replaceChildren();excerpt.replaceChildren();note.textContent='';
      if(!mode)return;
      try{
        let options=[];
        if(mode==='chain'||mode==='pattern'){
          const graph=await api('/api/neuromap/v3/graph'),names=new Map(graph.nodes.map(n=>[String(n.id),n.label]));
          if(mode==='chain')options=graph.chains.map(c=>({label:new Date(c.started_at).toLocaleDateString(),items:c.node_ids.map(id=>names.get(String(id))).filter(Boolean)}));
          else options=graph.links.filter(l=>l.count>1).map(l=>({label:'×'+l.count,items:[names.get(String(l.source)),names.get(String(l.target))].filter(Boolean)}));
        }else if(mode==='path'){
          const path=await api('/api/users/me/evolution?period=all'),days=new Map();
          for(const event of path.events||[]){if(!event.label||!event.occurred_at)continue;const day=new Date(event.occurred_at).toLocaleDateString();if(!days.has(day))days.set(day,[]);days.get(day).push(event.label);}
          options=[...days].map(([label,items])=>({label,items}));
        }else{
          const {snapshots}=await api('/api/me/atlas-snapshots');
          options=snapshots.map(s=>({label:s.label||new Date(s.taken_at).toLocaleDateString(),items:[...(s.state?.positive||[]),...(s.state?.negative||[])].filter(x=>typeof x==='string')}));
        }
        if(current!==ticket)return;choices=options.filter(x=>x.items.length).map(x=>({...x,items:x.items.slice(0,64).map(line=>String(line).slice(0,500))}));
        if(!choices.length){note.textContent=tr('Сохранённых фрагментов пока нет.','No saved excerpts yet.','Todavía no hay fragmentos.');return;}
        pick.add(new Option(tr('Выбрать фрагмент','Choose an excerpt','Elegir fragmento'),''));
        choices.forEach((x,i)=>pick.add(new Option(x.label+' · '+x.items.join(' → ').slice(0,85),String(i))));pick.hidden=false;
      }catch(e){if(current===ticket)note.textContent=e.message;}
    };
    const f=form(tr('Поделиться','Share','Compartir'),tr('Опубликовать','Publish','Publicar'),async()=>{
      if(kind.value&&!snapshot)throw Error(tr('Выберите фрагмент для публикации.','Choose the excerpt to publish.','Elige un fragmento.'));
      let attachment=null;const selected=file.files[0];
      if(selected){if(selected.size>16*1024*1024)throw Error('Max. 16 MB');attachment={name:selected.name,base64:(await fileData(selected)).split(',')[1]};}
      if(!title.value.trim()&&!body.value.trim()&&!attachment&&!snapshot)throw Error(tr('Добавьте текст, файл или фрагмент.','Add text, a file or an excerpt.','Añade texto, archivo o fragmento.'));
      await api('/api/social/posts',{method:'POST',body:{title:title.value,body:body.value,attachment,snapshot}});
    });
    let url;const clean=()=>{if(url)URL.revokeObjectURL(url);url=null;};f.closest('dialog').addEventListener('close',clean,{once:true});
    file.onchange=()=>{clean();preview.replaceChildren();const selected=file.files[0];if(!selected)return;
      const tag=/^image\/(jpeg|png|gif|webp|avif)$/.test(selected.type)?'img':selected.type.startsWith('video/')?'video':selected.type.startsWith('audio/')?'audio':null;
      if(tag){url=URL.createObjectURL(selected);const media=el(tag);media.src=url;media.controls=true;media.alt=selected.name;preview.append(media);}
    };preview.className='dom-board-media';
    const audience=p.profile_public?p.sharing?.wall:'private';
    const scope=audience==='members'?tr('Все участники','All members','Todos los miembros'):audience?.startsWith('group:')?p.groups?.find(g=>'group:'+g.id===audience)?.name:audience?.startsWith('person:')?p.contacts?.find(c=>'person:'+c.id===audience)?.display_name:null;
    f.append(field(tr('Заголовок (по желанию)','Title (optional)','Título (opcional)'),title),field(tr('Текст','Text','Texto'),body),field(tr('Фото, аудио, видео или файл · до 16 МБ','Photo, audio, video or file · up to 16 MB','Foto, audio, vídeo o archivo · hasta 16 MB'),file),preview,field(tr('Фрагмент из DOM','Excerpt from DOM','Fragmento de DOM'),kind),pick,note,excerpt,el('small',tr('Аудитория публикации · ','Post audience · ','Audiencia · ')+(scope||tr('Только я','Only me','Solo yo'))));
  }
  function edit(p){
    const name=el('input'),bio=el('textarea'),visible=el('input'),cover=el('input'),remove=el('input'),fields={};
    name.value=p.display_name||'';name.maxLength=100;name.required=true;bio.value=p.bio||'';bio.maxLength=1500;visible.type=remove.type='checkbox';visible.checked=p.profile_public;cover.type='file';cover.accept='image/jpeg,image/png,image/webp';
    const role=el('input'),staff=['admin','superadmin','founder'].includes(window.currentUser?.serverRole);
    role.value=p.org_role||'';role.maxLength=160;
    const f=form(tr('Профиль','Profile','Perfil'),tr('Сохранить','Save','Guardar'),async()=>{
      const file=cover.files[0];if(file?.size>2200000)throw Error('Max. 2 MB');
      await api('/api/social/settings',{method:'PUT',body:{name:name.value,bio:bio.value,...(staff?{org_role:role.value}:{}),open:visible.checked,cover:file?await fileData(file):(remove.checked?'':null),sharing:{map:'private',...Object.fromEntries(Object.entries(fields).map(([k,s])=>[k,s.value]))}}});
      Object.assign(window.currentUser,{name:name.value,display_name:name.value,bio:bio.value,profile_public:visible.checked});avatars.clear();
    });
    const help=el('details'),star=el('summary','✱'),tip=tr('Выберите, кто в DOM увидит вашу страницу и каждый раздел. Имя остаётся в беседах даже при закрытом профиле.','Choose who can see your page and each section. Your name still appears in conversations when your profile is private.','Elige quién puede ver tu página y cada sección. Tu nombre sigue en las conversaciones con el perfil privado.');
    star.title=tip;star.setAttribute('aria-label',tr('Кто видит профиль?','Who sees my profile?','¿Quién ve mi perfil?'));help.append(star,el('p',tip));f.previousElementSibling.append(help);
    f.append(field(tr('Имя или псевдоним','Display name','Nombre público'),name),field(tr('О себе','Bio','Biografía'),bio));
    if(p.presence)f.append(button(tr('Архив карточек · импорт и экспорт','Card archive · import and export','Archivo de tarjetas · importar y exportar'),()=>editPresence(p)));
    if(staff){
      const roles=el('details');roles.open=!!role.value;roles.append(el('summary',tr('Роли в DOM','Roles at DOM','Funciones en DOM')),field(tr('Должность или роль в проекте','Position or project role','Cargo o función en el proyecto'),role));f.append(roles);
    }
    f.append(field(tr('Обложка · до 2 МБ','Cover · up to 2 MB','Portada · hasta 2 MB'),cover));
    if(p.cover)f.append(field(tr('Убрать обложку','Remove cover','Quitar portada'),remove));
    f.append(field(tr('Моё фото, обложку и описание видят все, кто вошёл в DOM','Show my photo, cover and bio to everyone signed in to DOM','Mostrar mi foto, portada y biografía a quienes inicien sesión en DOM'),visible));
    for(const [key,title] of Object.entries({presence:tr('Прежние карточки профиля','Existing profile cards','Tarjetas anteriores'),results:tr('Название профиля по последнему пройденному тесту','Profile from my last completed test','Perfil de mi última prueba completada'),pulse:tr('Пульс · последнее полученное измерение и время, включая сигнал подключённого датчика','Heart rate · latest recorded value and time, including a connected live sensor','Último pulso con fecha'),wall:tr('Мои публикации в профиле и прикреплённые к ним файлы','My profile posts and their attachments','Muro y archivos')})){
      const s=el('select');s.add(new Option(tr('Только я','Only me','Solo yo'),'private'));s.add(new Option(tr('Все участники','All members','Todos los miembros'),'members'));for(const g of p.groups||[])s.add(new Option(g.name,'group:'+g.id));
      for(const contact of p.contacts||[])s.add(new Option(tr('Только ','Only ','Solo ')+(contact.display_name||contact.id),'person:'+contact.id));
      s.value=p.sharing?.[key]||'private';if(!s.value)s.value='private';fields[key]=s;f.append(field(title,s));
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
    if(lastId!==user.id){activeDialog?.close();avatars.clear();host.replaceChildren();lastId=user.id;}
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
