(function(){
  'use strict';
  const strings = {
    all:['Все беседы','All conversations','Todas las conversaciones'],
    unsorted:['Без папки','No folder','Sin carpeta'],
    hidden:['Удалённые из списка','Hidden conversations','Conversaciones ocultas'],
    folders:['Папки бесед','Conversation folders','Carpetas de conversación'],
    create:['Новая папка','New folder','Nueva carpeta'],
    folderName:['Название папки','Folder name','Nombre de carpeta'],
    move:['Переместить в папку','Move to folder','Mover a carpeta'],
    hide:['Убрать из списка','Hide conversation','Ocultar conversación'],
    restore:['Вернуть в список','Restore conversation','Restaurar conversación'],
    attach:['Прикрепить файл','Attach a file','Adjuntar un archivo'],
    limit:['Размер файла до 2 МиБ','Maximum file size: 2 MiB','Tamaño máximo: 2 MiB'],
    edit:['Редактировать','Edit','Editar'],
    edited:['Изменено','Edited','Editado'],
    remove:['Удалить','Delete','Eliminar'],
    confirm:['Удалить это сообщение для всех участников?','Delete this message for everyone?','¿Eliminar este mensaje para todos?'],
    actions:['Действия','Actions','Acciones'],
    undo:['Отменить удаление','Undo deletion','Deshacer eliminación'],
    forward:['Переслать','Forward','Reenviar'],
    target:['Куда переслать?','Forward to…','Reenviar a…'],
    sent:['Сообщение переслано','Message forwarded','Mensaje reenviado'],
    failed:['Действие не выполнено','Action failed','No se pudo completar la acción']
  };
  const tr = key => strings[key][{ru:0,en:1,es:2}[document.documentElement.lang] ?? 0];
  const folderPath='/api/domunity/conversation-folders';
  const conversationPath=(kind,id)=>'/api/domunity/conversations/'+kind+'/'+id;
  const views = new WeakMap();
  const controls = new WeakMap();
  function element(tag,label) {
    const el=document.createElement(tag);
    if (label) el.textContent=label;
    return el;
  }
  function button(label,action) {
    const node=element('button',label);
    node.type='button';
    node.className='btn btn-ghost';
    node.onclick=action;
    return node;
  }
  function feedback(host,action) {
    return async function(){
      this.disabled=true;
      try { await action.call(this); }
      catch (_) { host.textContent=tr('failed'); }
      finally { this.disabled=false; }
    };
  }
  function option(select,value,label) {
    const node=element('option',label);node.value=value;select.append(node);
  }
  let menu = null;
  const undo = new Map();
  function closeMenu(restoreFocus=false) {
    const previous=menu;
    if (!previous) return;
    menu=null;
    previous.panel.remove();
    previous.anchor.setAttribute('aria-expanded','false');
    if (restoreFocus) previous.anchor.focus();
  }
  document.addEventListener('pointerdown',event=>{
    if (menu&&!menu.panel.contains(event.target)&&!menu.anchor.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown',event=>{
    if (event.key==='Escape'&&menu) { event.preventDefault(); closeMenu(true); }
  });
  window.addEventListener('resize',()=>closeMenu());
  function openMenu(anchor,populate) {
    const same=menu?.anchor===anchor;
    closeMenu();
    if(same)return;
    const panel=element('div');panel.className='dom-chat-menu';panel.setAttribute('role','group');panel.setAttribute('aria-label',tr('actions'));
    const status=element('small');status.setAttribute('role','status');
    const add=(label,act)=>panel.insertBefore(button(label,feedback(status,act)),status);
    panel.append(status);
    populate(add,panel);
    document.body.append(panel);
    const rect=anchor.getBoundingClientRect(), gap=6;
    panel.style.left=Math.max(6,Math.min(rect.right-panel.offsetWidth,innerWidth-panel.offsetWidth-6))+'px';
    panel.style.top=Math.max(6,Math.min(rect.bottom+gap,innerHeight-panel.offsetHeight-6))+'px';
    menu={anchor,panel}; anchor.setAttribute('aria-expanded','true');
    panel.querySelector('button')?.focus();
  }
  async function renderList(root, items, kind, open, reload) {
    if (!root) return;
    const view=views.get(root)||{filter:'all',generation:0};
    const generation=++view.generation;
    views.set(root,view);
    const {folders=[]}=await domApi(folderPath).catch(()=>({}));
    if (generation!==view.generation) return;
    const filter=element('select');filter.setAttribute('aria-label',tr('folders'));
    option(filter,'all',tr('all'));
    folders.forEach(folder=>option(filter,String(folder.id),folder.name));
    filter.value=view.filter;
    if (!filter.value) filter.value='all';
    const bar=element('div');bar.className='dom-chat-controls';
    const status=element('small');status.setAttribute('role','status');
    if(folders.length)bar.append(filter);
    const restore=undo.get(kind);
    if(restore)bar.append(button(tr('undo'),feedback(status,async()=>{
      await domApi(restore,{method:'PATCH',body:{hidden:false}});
      undo.delete(kind);reload();
    })));
    bar.append(status);
    const list=element('div');list.className='dom-chat-list';
    function render() {
      view.filter=filter.value;
      const visible=items.filter(item=>!item.hidden && (view.filter==='all' || String(item.folder_id)===view.filter));
      list.replaceChildren(...visible.map(item=>{
        const row=element('div');row.className='dom-chat-list-item';
        const openButton=button('',()=>open(item.id,item.label));
        openButton.classList.add('dom-chat-open');openButton.append(element('span',item.label));
        if (item.preview) openButton.append(element('small',item.preview));
        const path=conversationPath(kind,item.id);
        const more=button('⋯',()=>{
          openMenu(more,(add,panel)=>{
            add(tr('remove'),async()=>{
              await domApi(path,{method:'PATCH',body:{hidden:true}});
              undo.set(kind,path);closeMenu();reload(item.id);
            });
            add(tr('move'),()=>{
              panel.querySelectorAll('button').forEach(node=>node.remove());
              const move=async folder_id=>{
                await domApi(path,{method:'PATCH',body:{folder_id}});
                closeMenu();reload();
              };
              if(item.folder_id!=null)add(tr('unsorted'),()=>move(null));
              folders.forEach(folder=>add(folder.name,()=>move(folder.id)));
              add(tr('create'),async()=>{
                const name=window.prompt(tr('folderName'))?.trim();
                if(!name)return;
                const {folder}=await domApi(folderPath,{method:'POST',body:{name}});
                await move(folder.id);
              });
              panel.querySelector('button')?.focus();
            });
          });
        });
        more.classList.add('dom-chat-more');more.setAttribute('aria-label',tr('actions')+' · '+item.label);
        more.setAttribute('aria-expanded','false');
        row.append(openButton,more);return row;
      }));
    }
    filter.onchange=()=>{closeMenu();render();};render();root.replaceChildren(bar,list);
  }

  function mountComposer(input) {
    const prior=controls.get(input);
    if (prior) { clearAttachment(input); return; }
    const file=element('input');file.type='file';file.hidden=true;
    const status=element('small');status.setAttribute('role','status');
    const attach=button(tr('attach'),()=>file.click());
    attach.title=tr('limit');
    file.onchange=()=>{
      const selected=file.files[0];
      const usable=selected && selected.size>0 && selected.size<=2*1024*1024;
      status.textContent=usable?selected.name:selected?tr('limit'):'';
      if (!usable) file.value='';
    };
    file.addEventListener('input',()=>{if(!file.value)status.textContent='';});
    input.parentElement.after(file,attach,status);
    controls.set(input,file);
  }
  async function attachment(input) {
    const file=controls.get(input)?.files[0];
    if (!file) return null;
    const data=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result).split(',',2)[1]);
      reader.onerror=reject;
      reader.readAsDataURL(file);
    });
    return {name:file.name,base64:data};
  }
  function clearAttachment(input) {
    const file=controls.get(input);
    if (file) { file.value=''; file.dispatchEvent(new Event('input')); }
  }
  async function fetchAttachment(path){
    const response=await fetch(AUTH_API+path+'/attachment',{
      headers:{Authorization:'Bearer '+localStorage.getItem('na_token')}
    });
    if(!response.ok)throw Error('Attachment unavailable');
    return response.blob();
  }
  function base64File(blob){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result).split(',',2)[1]);
      reader.onerror=reject;reader.readAsDataURL(blob);
    });
  }
  async function chooseForward(message,path,kind,id,add,panel,status,reload) {
    const [privateData,groupData]=await Promise.all([domApi('/api/dm/threads'),domApi('/api/chat/rooms')]);
    if(!panel.isConnected)return;
    const me=String(window.currentUser?.id);
    const select=element('select');
    select.setAttribute('aria-label',tr('target'));option(select,'',tr('target'));
    for(const thread of privateData.threads||[]){
      if(!thread.hidden)option(select,'dm:'+thread.id,String(thread.user_a)===me?thread.user_b_name:thread.user_a_name);
    }
    for(const group of groupData.rooms||[]){
      if(!group.hidden)option(select,'group:'+group.id,group.name);
    }
    panel.replaceChildren(select);
    const send=button(tr('forward'),async()=>{
      if(!select.value)return;
      send.disabled=true;
      try {
        const [destination,targetId]=select.value.split(':');
        const file=message.attachments?.[0];
        const attachment=file?.name?{name:file.name,base64:await base64File(await fetchAttachment(path))}:null;
        const endpoint=(destination==='dm'?'/api/dm/threads/':'/api/chat/rooms/')+targetId+'/messages';
        await domApi(endpoint,{method:'POST',body:{body:message.body||'',attachment,forwarded:true}});
        closeMenu(true);status.textContent=tr('sent');
        if(destination===kind&&String(id)===targetId)reload();
      }catch(_){send.disabled=false;status.textContent=tr('failed');}
    });
    panel.append(send);select.focus();
  }
  function messageActions(row, message, kind, id, reload) {
    const own=!message.is_agent&&String(message.sender_id)===String(window.currentUser?.id);
    const link=message.attachments?.[0];
    const status=element('small');status.setAttribute('role','status');
    const path=conversationPath(kind,id)+'/messages/'+message.id;
    const target=row.querySelector('.dom-chat-message-target')||row;
    target.classList.add('dom-chat-message-target');target.tabIndex=0;
    target.setAttribute('aria-haspopup','true');target.setAttribute('aria-expanded','false');
    const show=()=>openMenu(target,(add,panel)=>{
      if(own)add(tr('edit'),async()=>{
        const body=window.prompt(tr('edit'),message.body)?.trim();
        if(!body||body===message.body)return;
        await domApi(path,{method:'PATCH',body:{body}});
        closeMenu();reload();
      });
      add(tr('remove'),async()=>{
        if(own&&!window.confirm(tr('confirm')))return;
        await domApi(path+(own?'':'/hide'),{method:own?'DELETE':'POST'});
        closeMenu();reload();
      });
      add(tr('forward'),()=>chooseForward(message,path,kind,id,add,panel,status,reload));
    });
    row.addEventListener('click',event=>{if(!event.target.closest('button,a,input,select,textarea'))show();});
    row.addEventListener('contextmenu',event=>{event.preventDefault();show();});
    target.addEventListener('keydown',event=>{
      if(event.target===target&&[' ','Enter','ContextMenu'].includes(event.key)){event.preventDefault();show();}
    });
    if(link?.name)row.append(button(link.name,feedback(status,async()=>{
      const url=URL.createObjectURL(await fetchAttachment(path));
      const file=element('a');file.href=url;file.download=link.name;
      row.append(file);file.click();file.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    })));
    if(message.edited_at)row.append(element('small',tr('edited')));
    row.append(status);
  }
  window.DOMChatControls={renderList,mountComposer,attachment,clearAttachment,messageActions,
    hasAttachment:input=>Boolean(controls.get(input)?.files.length)};
})();
