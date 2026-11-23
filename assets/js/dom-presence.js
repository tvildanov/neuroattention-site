/* Shared by the owner's profile and the permission-filtered member view. */
export async function presence(host,{p,self,preview,el,button,field,tr,api,stream,compose,refresh,previewProfile,initialTab,onTab}){
  const path='/api/social/presence/'+p.id, suffix=preview?'?preview=1':'';
  const state=await api(path+suffix);
  const word=(ru,en,es)=>tr(ru,en,es);
  const uid=()=>crypto.randomUUID();
  const today=word('Сегодня','Today','Hoy');
  function initial(){const id=uid();return {version:1,primary:id,spaces:[{id,name:today,cards:[]}]};}
  let saved=state.layout||initial(),revision=state.revision,doc=saved,scene=doc.primary,editing=false,tab=initialTab==='stream'&&stream?'stream':'presence',drag=null,busy=false;
  let uploads=new Map(),importPosts=[];
  const mediaCache=new Map(),flash=el('p'),view=el('div');
  flash.setAttribute('role','status');flash.className='lp-feedback';
  host.replaceChildren(view,flash);host.classList.add('living-profile');
  function message(s){flash.textContent=s;}
  function control(label,fn){
    return button(label,async()=>{if(busy)return;try{await fn();}catch(e){message(e.message);}});
  }
  function option(values,current){
    const select=el('select');
    for(const [value,label] of values)select.add(new Option(label,value));
    select.value=current;return select;
  }
  const labels={
    text:word('Текст','Text','Texto'),image:word('Фото','Photo','Foto'),video:word('Видео','Video','Vídeo'),file:word('Файл','File','Archivo'),
    audio:'Audio',link:word('Ссылка','Link','Enlace'),project:word('Проект','Project','Proyecto'),collection:word('Коллекция','Collection','Colección'),
    small:word('Квадрат','Square','Cuadrado'),wide:word('Широкая','Wide','Ancha'),tall:word('Высокая','Tall','Alta'),panorama:word('Панорама','Panorama','Panorama'),
    surface:word('Основной','Surface','Base'),accent:word('Акцент','Accent','Acento'),green:word('Зелёный','Green','Verde'),violet:word('Фиолетовый','Violet','Violeta'),warm:word('Тёплый','Warm','Cálido')
  };
  const choices=keys=>keys.map(k=>[k,labels[k]]);
  function emptyCard(){return {id:uid(),title:'',text:'',url:'',alt:'',kind:'text',tone:'surface',size:'small',media:'',fit:'cover',shared:false};}
  function modal(title){
    const d=el('dialog');d.className='dom-social-dialog lp-modal';d.append(el('h2',title));
    const f=el('form');d.append(f);document.body.append(d);d.onclose=()=>d.remove();d.showModal();
    return {d,f};
  }
  function actions(d,f,fn){
    const err=el('p'),ok=el('button',word('Применить','Apply','Aplicar'));ok.type='submit';
    err.setAttribute('role','status');f.append(err,ok,button(word('Отмена','Cancel','Cancelar'),()=>d.close()));
    f.onsubmit=async e=>{e.preventDefault();ok.disabled=true;try{await fn();d.close();render();}catch(x){err.textContent=x.message;}finally{ok.disabled=false;}};
  }
  async function asset(file){
    if(file.size>16*1024*1024)throw Error('Max. 16 MB');
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(file);});
    const name=file.name.replace(/[\x00-\x1f\x7f/\\]/g,'_').trim().slice(0,150);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(base64+'\0'+name));
    const id=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
    return {id,name,base64,size:file.size};
  }
  function editCard(card,space,isNew){
    const {d,f}=modal(isNew?word('Новая карточка','New card','Nueva tarjeta'):word('Изменить карточку','Edit card','Editar tarjeta'));
    const title=el('input'),text=el('textarea'),url=el('input'),alt=el('input'),file=el('input'),shared=el('input');
    title.value=card.title;title.maxLength=160;title.required=true;text.value=card.text;text.maxLength=4000;
    url.value=card.url;url.type='url';file.type='file';alt.value=card.alt;alt.maxLength=300;shared.type='checkbox';shared.checked=card.shared;
    const kind=option(choices(['text','image','video','link','file','audio','collection','project']),card.kind);
    const size=option(choices(['small','wide','tall','panorama']),card.size),tone=option(choices(['surface','accent','green','violet','warm']),card.tone);
    const fit=option([['cover',word('Заполнить','Fill','Rellenar')],['contain',word('Вписать','Fit','Encajar')]],card.fit);
    const detach=el('input');detach.type='checkbox';
    for(const [label,input] of [[word('Формат','Type','Tipo'),kind],[word('Заголовок','Title','Título'),title],[labels.text,text],[labels.link,url],[word('Вложение до 16 МБ','Attachment up to 16 MB','Adjunto hasta 16 MB'),file],[word('Описание изображения','Image description','Descripción de imagen'),alt],[word('Размер','Size','Tamaño'),size],[word('Оттенок','Color','Color'),tone],[word('Фото в карточке','Photo fit','Ajuste de foto'),fit],[word('Показывать посетителям открытого профиля','Show to visitors of my open profile','Mostrar en mi perfil abierto'),shared]])f.append(field(label,input));
    if(card.media)f.append(field(word('Убрать вложение','Remove attachment','Quitar adjunto'),detach));
    actions(d,f,async()=>{
      if(url.value&&!/^https?:\/\//i.test(url.value))throw Error('HTTPS / HTTP');
      let media=detach.checked?'':card.media;
      if(file.files[0]){const a=await asset(file.files[0]);uploads.set(a.id,a);media=a.id;}
      Object.assign(card,{title:title.value,text:text.value,alt:alt.value,url:url.value,size:size.value,tone:tone.value,kind:kind.value,fit:fit.value,shared:shared.checked,media});
      if(isNew)space.cards.push(card);
    });
  }
  function start(){if(editing)return;editing=true;doc=structuredClone(saved);uploads=new Map();importPosts=[];tab='presence';}
  function stop(){editing=false;doc=saved;uploads.clear();importPosts=[];if(!doc.spaces.some(s=>s.id===scene))scene=doc.primary;}
  async function save(){
    busy=true;host.inert=true;
    try{
      const result=await api('/api/social/presence',{method:'PUT',body:{revision,layout:doc,uploads:[...uploads.values()],posts:importPosts}});
      revision=result.revision;saved=doc;const reload=importPosts.length;stop();message(word('Сохранено','Saved','Guardado'));
      if(reload)await refresh();else render();
    }finally{busy=false;host.inert=false;}
  }
  function move(space,from,to){
    if(from<0||to<0||to>=space.cards.length)return;
    space.cards.splice(to,0,space.cards.splice(from,1)[0]);render();
  }
  function sceneEditor(space){
    const {d,f}=modal(word('Композиции','Compositions','Composiciones')),name=el('input');
    name.value=space.name;name.maxLength=100;name.required=true;
    const op=option([['rename',word('Переименовать','Rename','Renombrar')],['create',word('Создать','Create','Crear')],['copy',word('Дублировать','Duplicate','Duplicar')],['primary',word('Показывать первой','Show first','Mostrar primero')],['delete',word('Удалить','Delete','Eliminar')]],'rename');
    f.append(field(word('Действие','Action','Acción'),op),field(word('Название','Name','Nombre'),name));
    actions(d,f,()=>{
      if(op.value==='delete'){
        if(doc.spaces.length===1)throw Error(word('Нужна хотя бы одна композиция','Keep one composition','Mantén una composición'));
        if(!confirm(word('Удалить композицию со всеми карточками?','Delete this composition and its cards?','¿Eliminar esta composición con sus tarjetas?')))return;
        doc.spaces=doc.spaces.filter(s=>s!==space);scene=doc.spaces[0].id;if(doc.primary===space.id)doc.primary=scene;
      }else if(op.value==='primary')doc.primary=space.id;
      else if(op.value==='rename')space.name=name.value;
      else{
        if(doc.spaces.length>=12)throw Error('Max. 12');
        const cards=op.value==='copy'?space.cards.map(c=>({...c,id:uid()})):[];
        const s={id:uid(),name:name.value,cards};doc.spaces.push(s);scene=s.id;
      }
    });
  }
  async function getMedia(id){
    if(uploads.has(id))return uploads.get(id);
    if(!mediaCache.has(id))mediaCache.set(id,api(path+'/media/'+id+suffix).catch(e=>{mediaCache.delete(id);throw e;}));
    return mediaCache.get(id);
  }
  function download(href,name){
    const a=el('a');a.href=href;a.download=name;a.click();
  }
  async function exportProfile(){
    const {pack}=await import('./dom-profile-archive.js');
    const ids=new Set(saved.spaces.flatMap(s=>s.cards.map(c=>c.media).filter(Boolean))),files=[];
    for(const id of ids)files.push(await getMedia(id));
    const posts=[];
    let cursor='',totalBytes=files.reduce((n,f)=>n+f.size,0);
    while(true){
      const page=await api('/api/social/export-posts'+(cursor?'?before='+cursor:''));
      for(const post of page.posts){
      const attachment=post.file_name?await api('/api/social/profile/'+p.id+'/posts/'+post.id+'/file'):null;
      totalBytes+=(attachment?.base64.length||0)*.75;
      if(totalBytes>96*1024*1024)throw Error('Archive exceeds 96 MB');
      posts.push({body:post.body,created_at:post.created_at,attachment});
      }
      if(page.posts.length<50)break;cursor=page.posts.at(-1).id;
    }
    const blob=pack({format:'DOMunity',version:1,layout:saved,files,posts,wallAudience:p.sharing?.wall||'private'});
    const url=URL.createObjectURL(blob);download(url,'DOMunity-profile.zip');setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function importProfile(space){
    const {d,f}=modal(word('Импорт профиля','Import profile','Importar perfil'));
    const file=el('input'),summary=el('p'),pick=el('select'),withPosts=el('input');
    file.type='file';file.accept='.zip,.json';file.required=true;withPosts.type='checkbox';let bundle;
    const mode=option([['new',word('Добавить новой композицией','Add as new','Añadir como nueva')],['merge',word('Добавить карточки в текущую','Merge into current','Combinar con actual')],['replace',word('Заменить текущую','Replace current','Reemplazar actual')]],'new');
    file.onchange=async()=>{
      bundle=null;pick.replaceChildren();
      try{
        const input=file.files[0];if(!input||input.size>100*1024*1024)throw Error('Max. 100 MB');
        const {unpack}=await import('./dom-profile-archive.js');
        const b=await unpack(input);
        if(b.format!=='DOMunity'||b.version!==1||b.layout?.version!==1||!Array.isArray(b.files)||!Array.isArray(b.posts)||!b.layout.spaces?.length)throw Error(word('Неподдерживаемый архив','Unsupported archive','Archivo incompatible'));
        for(const s of b.layout.spaces)pick.add(new Option(s.name+' · '+s.cards.length,s.id));
        summary.textContent=b.layout.spaces.length+' Presence · '+b.posts.length+' Stream · '+b.files.length+' '+labels.file;bundle=b;
      }catch(e){summary.textContent=e.message;}
    };
    f.append(file,summary,field(word('Композиция','Composition','Composición'),pick),mode,field(word('Добавить посты в мой Stream с его текущей аудиторией','Add posts to my Stream with its current audience','Añadir publicaciones con mi audiencia actual'),withPosts));
    actions(d,f,()=>{
      if(!bundle)throw Error(word('Выберите архив','Choose an archive','Elige un archivo'));
      if(mode.value==='replace'&&!confirm(word('Заменить карточки выбранной композиции?','Replace cards in this composition?','¿Reemplazar las tarjetas?')))return;
      const source=bundle.layout.spaces.find(s=>s.id===pick.value);
      const cards=source.cards.map(c=>({...c,id:uid()}));
      if(cards.some(c=>!labels[c.kind]||!labels[c.size]||!labels[c.tone]||(c.url&&!/^https?:\/\//i.test(c.url))))throw Error('Invalid card');
      const files=[...new Set(cards.map(c=>c.media).filter(Boolean))].map(id=>{const a=bundle.files.find(f=>f.id===id);if(!a)throw Error('Missing attachment');return a;});
      const posts=withPosts.checked?bundle.posts:[];
      if(new Blob([JSON.stringify([files,posts])]).size>24*1024*1024)throw Error('Max. 24 MB per import');
      if(mode.value==='new'){const n={id:uid(),name:source.name,cards};doc.spaces.push(n);scene=n.id;}
      else if(mode.value==='merge')space.cards.push(...cards);else space.cards=cards;
      for(const a of files)uploads.set(a.id,a);importPosts.push(...posts);
    });
  }
  function mediaNode(c,article){
    const load=async()=>{
      try{
        const a=await getMedia(c.media);if(!article.isConnected)return;
        const formats=[['iVBORw0KGgo','image/png'],['/9j/','image/jpeg'],['R0lGOD','image/gif']];
        const mime=formats.find(([prefix])=>a.base64.startsWith(prefix))?.[1]||(a.base64.startsWith('UklGR')&&atob(a.base64.slice(0,24)).slice(8,12)==='WEBP'?'image/webp':'');
        if(mime&&c.kind==='image'){const img=el('img');img.src='data:'+mime+';base64,'+a.base64;img.alt=c.alt||c.title;img.style.objectFit=c.fit;article.append(img);}
        else if((c.kind==='video'&&/\.mp4$/i.test(a.name))||(c.kind==='audio'&&/\.(mp3|ogg)$/i.test(a.name))){
          const media=el(c.kind);media.controls=true;media.preload='none';media.src='data:'+({video:'video/mp4',audio:/\.ogg$/i.test(a.name)?'audio/ogg':'audio/mpeg'}[c.kind])+';base64,'+a.base64;article.append(media);
        }else article.append(control(a.name,()=>download('data:application/octet-stream;base64,'+a.base64,a.name)));
      }catch(e){article.append(el('small',e.message));}
    };
    const io=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){io.disconnect();load();}});io.observe(article);
  }
  function render(){
    const bar=el('nav'),toolbar=el('div'),grid=el('div');bar.className=toolbar.className='lp-toolbar';grid.className='lp-grid';
    const space=doc.spaces.find(s=>s.id===scene)||doc.spaces[0];
    view.replaceChildren(bar);
    for(const [id,title] of [['presence','Presence'],['stream','Stream']]){
      if(id==='stream'&&(!stream||editing))continue;
      const b=control(title,()=>{tab=id;onTab(id);render();});b.setAttribute('aria-pressed',String(tab===id));bar.append(b);
    }
    if(self&&!editing){
      bar.append(control(word('Предпросмотр','Visitor preview','Vista previa'),previewProfile));
      if(tab==='presence')bar.append(control(word('Настроить пространство','Customize space','Personalizar espacio'),()=>{start();render();}));
    }
    if(tab==='stream'){view.append(stream);return;}
    if(!space)return;
    if(doc.spaces.length>1 || editing){for(const s of doc.spaces){const b=control(s.name,()=>{scene=s.id;render();});b.setAttribute('aria-pressed',String(s.id===space.id));toolbar.append(b);}view.append(toolbar);}
    if(editing){
      const edit=el('div');edit.className='lp-toolbar';
      edit.append(control(word('+ Карточка','+ Card','+ Tarjeta'),()=>editCard(emptyCard(),space,true)),control(word('Композиции','Compositions','Composiciones'),()=>sceneEditor(space)),
        control(word('Импорт','Import','Importar'),()=>importProfile(space)),control(word('Экспорт сохранённого','Export saved profile','Exportar perfil guardado'),exportProfile),
        control(word('Сохранить','Save','Guardar'),save),control(word('Отмена','Cancel','Cancelar'),()=>{stop();render();}));view.append(edit);
    }
    view.append(grid);
    if(!space.cards.length && self)grid.append(el('p',word('Здесь можно собрать своё пространство из карточек.','Build your space with cards.','Crea tu espacio con tarjetas.')));
    for(const [i,c] of space.cards.entries()){
      const card=el('article');card.className='lp-tile';card.dataset.size=c.size;card.dataset.tone=c.tone;
      if(editing){
        card.draggable=true;card.ondragstart=e=>{drag=c.id;e.dataTransfer.setData('text/plain',c.id);};card.ondragend=()=>drag=null;
        card.ondragover=e=>{if(drag)e.preventDefault();};card.ondrop=e=>{e.preventDefault();move(space,space.cards.findIndex(x=>x.id===drag),i);drag=null;};
        const tools=el('div');tools.className='lp-toolbar';
        for(const [symbol,title,fn] of [['↑',word('Раньше','Earlier','Antes'),()=>move(space,i,i-1)],['↓',word('Позже','Later','Después'),()=>move(space,i,i+1)],['✎',word('Изменить','Edit','Editar'),()=>editCard(c,space,false)],['⧉',word('Копировать','Copy','Copiar'),()=>{space.cards.splice(i+1,0,{...c,id:uid()});render();}],['×',word('Удалить','Delete','Eliminar'),()=>{if(confirm(word('Удалить карточку?','Delete card?','¿Eliminar tarjeta?'))){space.cards.splice(i,1);render();}}]]){
          const b=control(symbol,fn);b.title=title;b.setAttribute('aria-label',title+' · '+c.title);tools.append(b);
        }card.append(tools,el('small',c.shared?word('В открытом профиле','Shared on open profile','Visible en perfil abierto'):word('Только я','Only me','Solo yo')));
      }
      card.append(el('h3',c.title));if(c.text)card.append(el('p',c.text));
      if(c.url&&/^https?:\/\//i.test(c.url)){const a=el('a',new URL(c.url).hostname+' ↗');a.href=c.url;a.target='_blank';a.rel='noopener noreferrer';card.append(a);}
      grid.append(card);if(c.media)mediaNode(c,card);
    }
  }
  if(self&&stream)for(const item of stream.querySelectorAll('[data-post]')){
    const post=p.posts.find(x=>String(x.id)===item.dataset.post);
    item.append(control(word('В Presence','Add to Presence','Añadir a Presence'),async()=>{
      start();scene=doc.primary;const c=emptyCard();c.title=post.body.split('\n')[0].slice(0,160)||post.file_name;c.text=post.body;
      if(post.file_name){const f=await api('/api/social/profile/'+p.id+'/posts/'+post.id+'/file');
        const bytes=Uint8Array.from(atob(f.base64),x=>x.charCodeAt(0)),a=await asset(new File([bytes],f.name));
        uploads.set(a.id,a);c.media=a.id;c.kind=/\.(jpg|jpeg|png|webp|gif)$/i.test(a.name)?'image':'file';}
      doc.spaces.find(s=>s.id===scene).cards.push(c);render();
    }));
  }
  render();
}
