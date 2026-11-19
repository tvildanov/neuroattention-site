/* DOMunity participants and the shared Monad agent inspector. */
(() => {
  'use strict';
  const labels = {
    participants:['Участники','Participants','Participantes'],
    invite:['Подключить Монаду','Connect Monad','Conectar Mónada'],
    invite_human:['Добавить человека','Add a person','Añadir una persona'],
    order:['Порядок списка','List order','Orden de la lista'],
    by_name:['По имени','By name','Por nombre'],
    by_location:['По расположению','By placement','Por ubicación'],
    all_levels:['Все уровни','All levels','Todos los niveles'],
    no_cell:['Без ячейки','Unplaced','Sin celda'],
    invite_unavailable:['Подключение недоступно','Invitation unavailable','Invitación no disponible'],
    inbox_only:['Показаны доступные задачи. История может быть неполной.','Available tasks are shown. History may be incomplete.','Se muestran las tareas disponibles. El historial puede estar incompleto.'],
    analyze:['Проанализировать переписку','Analyze recent conversation','Analizar conversación reciente'],
    analyze_confirm:['Передать выбранному агенту до 12 последних текстовых сообщений?','Share up to 12 recent text messages with this agent?','¿Compartir hasta 12 mensajes de texto recientes con este agente?'],
    human:['Человек','Person','Persona'],
    persona:['Персона Монады','Monad persona','Persona de Monad'],
    agent:['Агент Монады','Monad agent','Agente de Monad'],
    contour:['Контур Монады','Monad contour','Contorno de Monad'],
    search:['Поиск по имени или функции','Search by name or function','Buscar por nombre o función'],
    listen:['Наблюдает','Observes','Observa'],
    mention:['По @упоминанию','On @mention','Por @mención'],
    active:['Участвует активно','Replies automatically','Responde automáticamente'],
    privacy:['Приглашённые агенты получают сообщения по указанным режимам, а также контекст этой беседы.','Invited agents receive messages according to their participation settings, along with the room context.','Los agentes invitados reciben mensajes según su modo de participación, junto con el contexto de la conversación.'],
    queued:['В очереди','Queued','En cola'],
    pending:['Ожидает передачи','Waiting for delivery','Pendiente de entrega'],
    sending:['Передаётся','Sending','Enviando'],
    accepted:['Задача принята','Task accepted','Tarea aceptada'],
    in_progress:['В обработке','In progress','En proceso'],
    completed:['Задача завершена','Task completed','Tarea completada'],
    failed:['Задача завершилась ошибкой','Task failed','Falló la tarea'],
    unconfirmed:['Нет подтверждения ответа','Reply unconfirmed','Respuesta sin confirmar'],
    revoked:['Доступ отозван','Access revoked','Acceso revocado'],
    room_context:['Контекст беседы','Room context','Contexto de la conversación'],
    remove:['Отключить','Remove','Quitar'],
    close:['Закрыть','Close','Cerrar'],
    save:['Сохранить','Save','Guardar'],
    description:['Описание','Description','Descripción'],
    scope:['Канон и инструкции','Canon and instructions','Canon e instrucciones'],
    parameters:['Параметры','Settings','Configuración'],
    versions:['Версии','Versions','Versiones'],
    preview:['Предпросмотр изменений','Preview changes','Vista previa de cambios'],
    publish:['Подтвердить публикацию','Confirm publication','Confirmar publicación'],
    previous:['Текущая версия','Current version','Versión actual'],
    next:['Предлагаемая версия','Proposed version','Versión propuesta'],
    restore:['Предпросмотр восстановления','Preview restore','Vista previa de restauración'],
    denied:['Для этого действия нужны права владельца.','This action requires owner access.','Esta acción requiere acceso de propietario.'],
    error:['Не удалось получить данные Монады. Попробуйте ещё раз.','Could not load Monad data. Try again.','No se pudieron obtener los datos de Monad. Inténtalo de nuevo.'],
    updated:['Сохранено','Saved','Guardado'],
    conflict:['Версия изменилась. Откройте её снова перед публикацией.','This version changed. Reopen it before publishing.','La versión cambió. Vuelve a abrirla antes de publicar.'],
    send_failed:['Не удалось отправить сообщение. Текст остался в поле ввода.','The message could not be sent. Your draft is still in the composer.','No se pudo enviar el mensaje. Tu borrador sigue en el campo de texto.'],
    empty:['Подходящих участников нет','No matching participants','No hay participantes que coincidan'],
    activity:['Активность и задачи','Activity and tasks','Actividad y tareas'],
    active_tasks:['В работе','In progress','En curso'],
    none_recorded:['За этот период нет зарегистрированных задач','No tasks recorded in this time range','No hay tareas registradas en este periodo'],
    hours:['24 часа','24 hours','24 horas'],
    days:['7 дней','7 days','7 días'],
    awaiting:['Загружаем…','Loading…','Cargando…'],
    unavailable:['Источник недоступен','Source unavailable','Fuente no disponible'],
    last:['Последнее событие','Last event','Último evento'],
    tasks:['Задачи','Tasks','Tareas'],
    interactions:['Взаимодействия','Interactions','Interacciones'],
    create:['Зарегистрировать агента','Register agent','Registrar agente'],
    agent_name:['Имя агента','Agent name','Nombre del agente'],
    agent_id:['Идентификатор (a–z, 0–9, _)','Identifier (a–z, 0–9, _)','Identificador (a–z, 0–9, _)'],
    instructions:['Инструкции агента','Agent instructions','Instrucciones del agente'],
    public_role:['Публичная роль в DOMunity (необязательно)','Public role in DOMunity (optional)','Rol público en DOMunity (opcional)'],
    canon_content:['Содержание канона','Canon content','Contenido del canon'],
    canon_sources:['Материалы канона владельца','Owner canon materials','Materiales del canon del propietario'],
    canon_scope:['Здесь видны доступные материалы владельца. Журнал не подтверждает, какие из них загрузил этот агент.','These are available owner materials. The activity log does not establish which materials the agent loaded.','Estos son materiales disponibles del propietario. El registro no indica cuáles cargó el agente.'],
    canon_invalid:['Содержание должно быть объектом JSON.','Content must be a JSON object.','El contenido debe ser un objeto JSON.'],
    pending_onboarding:['Зарегистрирован · ожидает настройки','Registered · awaiting onboarding','Registrado · en espera de configuración'],
    training:['Начать обучение','Start training','Iniciar formación'],
    certifying:['Перейти к проверке','Start certification','Iniciar certificación'],
    active_agent:['Активировать агента','Activate agent','Activar agente']
  };
  const tr = key => (labels[key] || [key,key,key])[({ru:0,en:1,es:2})[document.documentElement.lang] ?? 1];
  const element = (tag, text) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    return node;
  };
  const button = (key, click) => {
    const node = element('button',tr(key));
    node.type = 'button';
    node.onclick = click;
    return node;
  };
  async function api(path, method='GET', body) {
    const token = window.naGetToken?.() || localStorage.getItem('na_token');
    const result = await fetch((window.AUTH_API || '')+path,{
      method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await result.json();
    if(!result.ok)throw Object.assign(Error(data.error),{status:result.status});
    return data;
  }
  const failure = err => tr(err?.status===409?'conflict':err?.status===403?'denied':'error');
  let room = null;
  let roomHead = null;
  let roomPanel = null;
  let indicator = null;
  let inspector = null;
  let updateToken = 0;
  let directory = [];
  let members = null;
  const roomPath = id => '/api/chat/rooms/'+encodeURIComponent(id);
  function notice(key) {
    if(indicator)indicator.textContent=tr(key);
  }
  function panel(title) {
    const aside = element('aside');
    aside.className='dom-agent-panel';
    aside.tabIndex=-1;
    aside.setAttribute('aria-label',tr(title));
    const controls=element('header');
    controls.append(element('strong',tr(title)),button('close',()=>aside.remove()));
    const body=element('div');
    aside.append(controls,body);
    aside.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();aside.remove();}});
    return {aside,body};
  }
  function showRoomPanel(title) {
    roomPanel?.remove();
    const p=panel(title);
    roomPanel=p.aside;
    roomHead?.after(p.aside);
    p.aside.focus();
    return p;
  }
  async function showParticipants() {
    const id=room;
    if(id==null)return;
    const {aside,body}=showRoomPanel('participants');
    body.textContent=tr('awaiting');
    try {
      const info=await api(roomPath(id)+'/agents');
      if(!aside.isConnected)return;
      members=info;
      body.replaceChildren();
      if(info.agents.length)body.append(element('p',tr('privacy')));
      const list=element('ul');
      for(const person of info.people)list.append(element('li',person.name+' · '+tr('human')));
      for(const agent of info.agents) {
        const item=element('li');
        item.append(button(agent.name||agent.agent_id,()=>showAgent(agent.agent_id)),
          element('span',' · '+tr(agent.kind)+' · '+tr(agent.mode)));
        if(info.can_manage) {
          if(agent.mode!=='listen')item.append(button('analyze',async()=>{
            if(!window.confirm(tr('analyze_confirm')))return;
            try{
              await api(roomPath(id)+'/analyze','POST',{agent_id:agent.agent_id});
              await refreshStatus();
            }catch(error){notice(failure(error));}
          }));
          item.append(button('remove',async()=>{
            try{await api(roomPath(id)+'/agents/'+encodeURIComponent(agent.agent_id),'DELETE');await showParticipants();}
            catch(err){notice(failure(err));}
          }));
        }
        list.append(item);
      }
      body.append(list);
      body.append(button('room_context',showContext));
      if(info.can_manage){
        body.append(button('invite',()=>showInvite()));
        if(!info.direct)body.append(button('invite_human',()=>showInvite(true)));
      }
    } catch(err){body.textContent=failure(err);}
  }
  function showContext() {
    const id=room;
    const {aside,body}=showRoomPanel('room_context');
    const harness=members.harness;
    const form=element('textarea',harness.context);
    form.value=harness.context;
    form.maxLength=4000;form.rows=6;form.readOnly=!members.can_manage;
    form.setAttribute('aria-label',tr('room_context'));
    const result=element('p');result.setAttribute('role','status');
    body.append(element('p',tr('privacy')),form,result);
    if(members.can_manage)body.append(button('save',async()=>{
      try {
        const data=await api(roomPath(id)+'/harness','PUT',{context:form.value,version:members.harness.version});
        if(!aside.isConnected)return;
        members.harness=data.harness;result.textContent=tr('updated');
      }catch(err){result.textContent=failure(err);}
    }));
    body.append(button('versions',async()=>{
      try {
        const data=await api(roomPath(id)+'/harness/versions');
        const list=element('ul');
        for(const version of data.versions){
          const row=element('li');
          row.append(button(String(version.version)+' · '+new Date(version.changed_at).toLocaleString(),()=>{form.value=version.context;}));
          list.append(row);
        }
        body.append(list);
      }catch(err){result.textContent=failure(err);}
    }));
  }
  async function showInvite(humans=false) {
    const id=room;
    const {aside,body}=showRoomPanel(humans?'invite_human':'invite');
    const search=element('input');
    search.placeholder=tr('search');search.type='search';search.setAttribute('aria-label',tr('search'));
    const type=element('select');type.setAttribute('aria-label',tr('invite'));
    for(const key of (humans?['human']:['persona','agent','contour'])){
      const option=element('option',tr(key));option.value=key;type.append(option);
    }
    type.value=humans?'human':'persona';
    type.hidden=humans;
    const order=element('select');
    order.setAttribute('aria-label',tr('order'));
    for(const key of ['by_name','by_location']){
      const option=element('option',tr(key));option.value=key;order.append(option);
    }
    order.hidden=humans;
    const levels=element('select');
    levels.setAttribute('aria-label',tr('by_location'));
    for(const value of ['',...Array.from({length:7},(_,i)=>'L'+(i+1)),'none']){
      const option=element('option',value==='none'?tr('no_cell'):value||tr('all_levels'));
      option.value=value;levels.append(option);
    }
    const mode=element('select');mode.setAttribute('aria-label',tr('parameters'));
    for(const key of ['mention','listen','active']){
      const option=element('option',tr(key));option.value=key;mode.append(option);
    }
    const results=element('ul'),status=element('p');status.setAttribute('role','status');
    if(!humans)body.append(element('p',tr('privacy')));
    body.append(type,order,levels,mode,search,results,status);
    let query=0;
    const refresh=async()=>{
      const request=++query;
      const term=search.value.trim().toLowerCase();
      mode.hidden=members?.direct||type.value==='human';
      levels.hidden=humans||order.value!=='by_location';
      const level=levels.hidden?'':levels.value;
      const normalize=s=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
      try {
        const entries=type.value==='human'
          ? (term.length>=2 ? (await api('/api/users/search?q='+encodeURIComponent(term))).users || [] : [])
          : directory.filter(a=>{
              if(a.kind!==type.value)return false;
              const cells=a.cells||[];
              if(level==='none'&&cells.length)return false;
              if(level&&level!=='none'&&!cells.some(cell=>cell.split(/[x×]/i)[0]===level))return false;
              const corpus=normalize([a.name,a.agent_id,a.orchestrator,...(a.aliases||[]),...cells,...(a.domains||[])].join(' '));
              return normalize(term).split(' ').every(word=>corpus.includes(word));
            })
            .sort((a,b)=>{
              const byName=(a.name||a.agent_id).localeCompare(b.name||b.agent_id);
              if(order.value!=='by_location')return byName;
              const left=a.placement||a.orchestrator;
              const right=b.placement||b.orchestrator;
              if(!left||!right)return Number(!left)-Number(!right)||byName;
              return left.localeCompare(right,undefined,{numeric:true})||byName;
            });
        if(request!==query||!aside.isConnected)return;
        results.replaceChildren();
        if(!entries.length)results.append(element('li',tr('empty')));
        for(const agent of entries){
          const item=element('li');
          const name=agent.name||agent.display_name||agent.agent_id;
          const invite=button(name,async()=>{
            const human=type.value==='human';
            try {
              await api(roomPath(id)+(human?'/members':'/agents'),'POST',
                human?{user_id:agent.id}:{agent_id:agent.agent_id,mode:mode.value});
              if(room===id)await showParticipants();
            }catch(err){status.textContent=failure(err);}
          });
          invite.disabled=agent.can_invite===false;
          if(invite.disabled)invite.title=tr('invite_unavailable');
          item.append(invite);
          const location=[...(agent.cells||[]),agent.orchestrator,invite.disabled&&tr('invite_unavailable')].filter(Boolean).join(' · ');
          if(location)item.append(element('small',' · '+location));
          results.append(item);
        }
      }catch(err){status.textContent=failure(err);}
    };
    type.onchange=refresh;
    order.onchange=refresh;
    levels.onchange=refresh;
    let timer;
    search.oninput=()=>{clearTimeout(timer);timer=setTimeout(refresh,180);};
    try {
      if(!humans)directory=(await api('/api/dom-monad/agents')).agents;
    }catch(err){status.textContent=failure(err);}
    refresh();
    search.focus();
  }
  async function showAgent(id, mount) {
    if(!id)return;
    inspector?.remove();
    const {aside,body}=panel('description');
    inspector=aside;
    aside.classList.add('dom-agent-inspector');
    if(room && !mount && roomHead?.isConnected) roomHead.after(aside);
    else (mount||document.getElementById('tab-monad')||document.body).append(aside);
    const matching=members?.agents?.find(a=>a.agent_id===id) || directory.find(a=>a.agent_id===id);
    const description=element('div');
    description.append(element('h3',matching?.name||id));
    if(matching)description.append(element('p',[tr(matching.kind),matching.orchestrator,matching.owner,matching.version,matching.mode&&tr(matching.mode)].filter(Boolean).join(' · ')));
    const tabs=element('nav'),content=element('div');
    body.append(tabs,content);
    content.append(description);
    tabs.append(button('description',()=>content.replaceChildren(description)));
    const loading=element('p',tr('awaiting'));description.append(loading);
    try {
      const details=await api('/api/dom-monad/admin/agent/'+encodeURIComponent(id)+'/harness');
      if(!aside.isConnected)return;
      loading.remove();
      description.append(element('p',[details.agent.name,details.agent.status,details.agent.owner,...(details.agent.domains||[])].filter(Boolean).join(' · ')));
      if(details.next_onboarding_status){
        const next=details.next_onboarding_status;
        const status=element('p');status.setAttribute('role','status');
        description.append(button(next==='active'?'active_agent':next,async function(){
          this.disabled=true;
          try{
            await api('/api/dom-monad/admin/agent/'+encodeURIComponent(id)+'/onboarding','POST',{status:next});
            if(aside.isConnected)await showAgent(id,mount);
          }catch(err){status.textContent=failure(err);this.disabled=false;}
        }),status);
      }
      tabs.append(button('scope',()=>renderHarness(content,id,details)),button('activity',()=>renderActivity(content,id)));
    }catch(err){
      loading.textContent=failure(err);
    }
    aside.focus();
  }
  function renderHarness(host,id,details) {
    host.replaceChildren();
    const prompt=element('textarea');prompt.rows=10;prompt.maxLength=60000;
    prompt.value=details.system_prompt;prompt.readOnly=!details.can_publish;
    prompt.setAttribute('aria-label',tr('scope'));
    const status=element('p');status.setAttribute('role','status');
    const output=element('div');
    const endpoint='/api/dom-monad/admin/agent/'+encodeURIComponent(id);
    const sources=element('ul');
    host.append(element('h4',tr('instructions')));
    for(const [layer,source] of Object.entries(details.sources||{}))sources.append(element('li',layer+' · '+source));
    host.append(prompt,status,output,sources);
    function preview() {
      output.replaceChildren(element('h4',tr('previous')),element('pre',details.system_prompt),
        element('h4',tr('next')),element('pre',prompt.value));
      const proposed=prompt.value;
      output.append(button('publish',async()=>{
        try {
          await api(endpoint+'/prompt','PUT',{expected_sha256:details.etag,system_prompt:proposed});
          renderHarness(host,id,await api(endpoint+'/harness'));
        }catch(err){status.textContent=failure(err);}
      }));
    }
    if(details.can_publish)host.append(button('preview',preview));
    if(details.can_publish)host.append(button('versions',async()=>{
      try{
        const data=await api(endpoint+'/versions');
        output.replaceChildren();
        for(const v of data.versions)output.append(button(new Date(v.created_at).toLocaleString(),async()=>{
          try {
            const revision=await api(endpoint+'/versions/'+encodeURIComponent(v.id));
            prompt.value=revision.system_prompt;
            preview();
          }catch(err){status.textContent=failure(err);}
        }));
      }catch(err){status.textContent=failure(err);}
    }));
    if(details.canon?.length)host.append(element('h4',tr('canon_sources')),element('p',tr('canon_scope')));
    for(const item of details.canon||[]) host.append(button(item.title,async()=>{
      try {
        await showCanon(output,item.artifact_id);
      }catch(err){status.textContent=failure(err);}
    }));
  }
  async function showCanon(host,id){
    const endpoint='/api/dom-monad/admin/canon/'+encodeURIComponent(id);
    const {canon,can_publish}=await api(endpoint);
    host.replaceChildren(element('h4',canon.title+' · '+canon.version),element('p',canon.summary));
    const current=JSON.stringify(canon.content,null,2);
    if(!can_publish){host.append(element('pre',current));return;}
    const editor=element('textarea');editor.value=current;editor.rows=10;
    editor.setAttribute('aria-label',tr('canon_content'));
    const status=element('p');status.setAttribute('role','status');
    const preview=element('div');
    host.append(editor,button('preview',()=>{
      let content;
      try{
        content=JSON.parse(editor.value);
        if(!content||typeof content!=='object'||Array.isArray(content))throw Error();
      }catch(_){status.textContent=tr('canon_invalid');return;}
      status.textContent='';
      preview.replaceChildren(element('h5',tr('previous')),element('pre',current),
        element('h5',tr('next')),element('pre',JSON.stringify(content,null,2)),
        button('publish',async function(){
          this.disabled=true;
          try{
            await api(endpoint,'PUT',{expected_version:canon.version,content});
            await showCanon(host,id);
          }catch(err){status.textContent=failure(err);this.disabled=false;}
        }));
    }),status,preview);
  }
  function renderActivity(host,id) {
    const view=element('div');
    host.replaceChildren(button('hours',()=>load('24h')),button('days',()=>load('7d')),view);
    let request=0;
    async function load(window) {
      const current=++request;
      view.textContent=tr('awaiting');
      try {
        const data=await api('/api/dom-monad/admin/agent/'+encodeURIComponent(id)+'/activity?window='+window);
        if(current!==request)return;
        view.replaceChildren(
          element('p',tr('last')+' · '+(data.last_event_at?new Date(data.last_event_at).toLocaleString():'—')),
          element('p',tr('tasks')+' · '+(data.handoffs_available===false?tr('unavailable'):String(data.handoffs.length))),
          element('p',tr('interactions')+' · '+(data.interactions||[]).join(', '))
        );
        const list=element('ul');
        if(data.handoffs_partial&&data.handoffs_available)view.append(element('p',tr('inbox_only')));
        const ongoing=data.handoffs.filter(task=>['accepted','in_progress'].includes(task.status));
        view.append(element('p',tr('active_tasks')+' · '+(data.handoffs_available?ongoing.length:tr('unavailable'))));
        if(!data.handoffs.length&&data.handoffs_available)view.append(element('p',tr('none_recorded')));
        for(const task of data.handoffs)list.append(element('li',[
          tr(task.status),task.description||task.domain,task.from_agent+' → '+task.to_agent,
          new Date(task.completed_at||task.created_at).toLocaleString()
        ].filter(Boolean).join(' · ')));
        for(const action of (data.actions||[]).slice(0,30))list.append(element('li',[
          action.action_type,action.agent_id!==id&&action.agent_id,
          action.success===false&&tr('failed'),action.created_at&&new Date(action.created_at).toLocaleString()
        ].filter(Boolean).join(' · ')));
        view.append(list);
      }catch(err){if(current===request)view.textContent=failure(err);}
    }
    load('24h');
  }
  async function mountProvision(host,cell){
    if(!host||!/^L[1-7]xL[1-7]$/.test(cell))return;
    try{
      const access=await api('/api/dom-monad/agents');
      if(!host.isConnected||!access.can_register)return;
    }catch(_){return;}
    const trigger=button('create',()=>{
      trigger.hidden=true;
      const form=element('form');form.className='dom-agent-panel';
      const name=element('input');name.required=true;name.maxLength=120;
      const id=element('input');id.required=true;id.pattern='[a-z0-9_]{2,80}';id.autocomplete='off';
      const prompt=element('textarea');prompt.required=true;prompt.minLength=10;prompt.maxLength=60000;prompt.rows=6;
      const role=element('textarea');role.maxLength=1500;role.rows=2;
      for(const [key,input] of [['agent_name',name],['agent_id',id],['instructions',prompt],['public_role',role]]){
        const label=element('label',tr(key));label.append(input);form.append(label);
      }
      const save=element('button',tr('create'));save.type='submit';
      const status=element('p');status.setAttribute('role','status');
      form.append(save,button('close',()=>{form.remove();trigger.hidden=false;trigger.focus();}),status);
      form.onsubmit=async event=>{
        event.preventDefault();save.disabled=true;
        try{
          const data=await api('/api/dom-monad/admin/agents','POST',{agent_id:id.value,name:name.value,system_prompt:prompt.value,
            placement_cell:cell,room_description:role.value});
          form.replaceChildren(element('p',tr(data.status)+' · '+data.agent_id+' · '+data.placement_cell),
            button('description',()=>showAgent(data.agent_id,host)));
        }catch(err){status.textContent=failure(err);save.disabled=false;}
      };
      host.append(form);name.focus();
    });
    host.append(trigger);
  }
  const refreshStatus=async()=>{
    const id=room;
    const generation=updateToken;
    if(!id||!indicator?.isConnected||document.hidden||!['groups','dms'].includes(window.dom?.sub))return;
    try{
      const data=await api(roomPath(id)+'/agent-events');
      if(generation!==updateToken)return;
      const pending=(data.events||[]).filter(e=>['pending','sending','queued','accepted','in_progress','failed','unconfirmed'].includes(e.status)).slice(-3);
      indicator.textContent=pending.map(e=>e.agent_id+' · '+tr(e.status)).join(' | ');
    }catch(_){}
  };
  setInterval(refreshStatus,10000);
  window.DOMRoomAgents={
    label:tr,
    async open(id, head, invite=false){
      room=id;roomHead=head;members=null;updateToken++;roomPanel?.remove();inspector?.remove();
      head.append(button('participants',showParticipants));
      async function openInvite(){
        await showParticipants();
        if(room===id&&members?.can_manage)await showInvite();
      }
      head.append(button('invite',openInvite));
      indicator=element('small');indicator.className='dom-agent-notice';indicator.setAttribute('role','status');
      head.append(indicator);
      refreshStatus();
      if(invite)await openInvite();
    },
    showAgent,mountProvision,notice,refreshStatus
  };
})();
