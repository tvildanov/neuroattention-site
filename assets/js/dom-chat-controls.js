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
  async function renderList(root, items, kind, open, reload) {
    if (!root) return;
    const view=views.get(root)||{filter:'all',generation:0};
    const generation=++view.generation;
    views.set(root,view);
    const {folders=[]}=await domApi(folderPath).catch(()=>({}));
    if (generation!==view.generation) return;
    const filter=element('select');filter.setAttribute('aria-label',tr('folders'));
    option(filter,'all',tr('all'));option(filter,'hidden',tr('hidden'));
    folders.forEach(folder=>option(filter,String(folder.id),folder.name));
    filter.value=view.filter;
    if (!filter.value) filter.value='all';
    const bar=element('div');bar.className='dom-chat-controls';
    const status=element('small');status.setAttribute('role','status');
    bar.append(filter,button(tr('create'),feedback(status,async()=>{
      const name=window.prompt(tr('folderName'))?.trim();
      if (name) {
        const {folder}=await domApi(folderPath,{method:'POST',body:{name}});
        view.filter=String(folder.id);
        reload();
      }
    })),status);
    const list=element('div');list.className='dom-chat-list';
    function render() {
      view.filter=filter.value;
      const visible=items.filter(item=>view.filter==='hidden' ? item.hidden :
        !item.hidden && (view.filter==='all' || String(item.folder_id)===view.filter));
      list.replaceChildren(...visible.map(item=>{
        const row=element('div');row.className='dom-chat-list-item';
        const openButton=button(item.label,()=>open(item.id,item.label));
        row.append(openButton);
        if (item.preview) row.append(element('small',item.preview));
        const move=element('select');move.setAttribute('aria-label',tr('move'));
        option(move,'',tr('unsorted'));
        folders.forEach(folder=>option(move,String(folder.id),folder.name));
        move.value=item.folder_id==null?'':String(item.folder_id);
        const path=conversationPath(kind,item.id);
        move.onchange=feedback(status,async function(){
          await domApi(path,{method:'PATCH',body:{folder_id:this.value||null}});
          reload();
        });
        row.append(move,button(tr(item.hidden?'restore':'hide'),feedback(status,async()=>{
          await domApi(path,{method:'PATCH',body:{hidden:!item.hidden}});
          reload(item.hidden?null:item.id);
        })));
        return row;
      }));
    }
    filter.onchange=render;render();root.replaceChildren(bar,list);
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
  function messageActions(row, message, kind, id, reload) {
    if (message.is_agent) return;
    const own=String(message.sender_id)===String(window.currentUser?.id);
    const file=message.attachments?.[0];
    if (!own && !file?.name) return;
    const bar=element('div');bar.className='dom-chat-controls';
    const status=element('small');status.setAttribute('role','status');
    const path=conversationPath(kind,id)+'/messages/'+message.id;
    if (file?.name) bar.append(button(file.name,feedback(status,async()=>{
      const response=await fetch(AUTH_API+path+'/attachment',{
        headers:{Authorization:'Bearer '+localStorage.getItem('na_token')}
      });
      if (!response.ok) throw Error('Attachment unavailable');
      const url=URL.createObjectURL(await response.blob());
      const link=element('a');link.href=url;link.download=file.name;
      row.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
    })));
    if (own) bar.append(
      button(tr('edit'),feedback(status,async()=>{
        const body=window.prompt(tr('edit'),message.body)?.trim();
        if (body && body!==message.body) {
          await domApi(path,{method:'PATCH',body:{body}});
          reload();
        }
      })),
      button(tr('remove'),feedback(status,async()=>{
        if (window.confirm(tr('confirm'))) {
          await domApi(path,{method:'DELETE'});
          reload();
        }
      }))
    );
    if (message.edited_at) bar.append(element('small',tr('edited')));
    bar.append(status);row.append(bar);
  }
  window.DOMChatControls={renderList,mountComposer,attachment,clearAttachment,messageActions,
    hasAttachment:input=>Boolean(controls.get(input)?.files.length)};
})();
