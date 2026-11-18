(function () {
 'use strict';
 var engine=window.DOMTypology, app=document.getElementById('assessment'), config, session, items, storageKey, storageAvailable=true, selection=[];
 var status=document.getElementById('status');
 function el(tag,text,className){var n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
 function button(text,handler,kind){var b=el('button',text,kind||'');b.type='button';b.addEventListener('click',handler);return b;}
 function note(text){status.textContent=text;}
 function clear(){app.replaceChildren();note('');}
 function now(){return new Date().toISOString();}
 function newId(){return window.crypto&&crypto.randomUUID?crypto.randomUUID():'draft-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
 function persist(){
  try{localStorage.setItem(storageKey,JSON.stringify(session));storageAvailable=true;return true;}
  catch(e){storageAvailable=false;note('Не удалось сохранить в браузере. Скачайте ответы перед выходом.');return false;}
 }
 function download(data,name){
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);
  var a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
 }
 function exportData(){download(engine.exportSession(config,session),'dom-baseline-'+session.id+'.json');}
 function renderIntro(){
  clear();app.append(el('p','Исследовательский черновик','eyebrow'),el('h1','Первые сведения о себе'));
  app.append(el('p',config.participant_intro),el('p','40 вопросов по 13 характеристикам и один вопрос о контексте. Ориентир — около 20 минут; фактическое время ещё проверяется.'));
  app.append(el('p','После ответа нажимайте «Далее»: так сохраняются выбор и место продолжения. Анкета не отправляет ответы на сервер. Численные оценки и назначение профиля пока не рассчитываются.','muted'));
  var row=el('div',undefined,'actions');
  row.append(button(Object.keys(session.answers).length?'Продолжить':'Начать',function(){if(session.completed_at)renderResults();else renderQuestion();},'primary'));
  if(Object.keys(session.answers).length)row.append(button('Скачать сохранённые ответы',exportData),button('Удалить черновик',function(){
   if(!window.confirm('Удалить ответы этой анкеты из текущего браузера?'))return;
   try{localStorage.removeItem(storageKey);}catch(e){}
   session=engine.createSession(config,newId(),now());persist();renderIntro();
  }));
  app.append(row);
  if(!storageAvailable)note('Сохранение в браузере недоступно. Не закрывайте страницу до скачивания ответов.');
 }
 function hash(s){var h=2166136261;for(var i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
 function displayOptions(item){
  var a=item.options.slice(),seed=hash(session.id+item.id);
  for(var i=a.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;var j=seed%(i+1),v=a[i];a[i]=a[j];a[j]=v;}
  if(item.not_applicable)a.push(item.not_applicable);
  return a;
 }
 function renderQuestion(){
  if(session.cursor>=items.length){renderResults();return;}
  clear();var item=items[session.cursor],stat=config.stats.find(function(s){return s.id===item.stat_id;});
  app.append(el('p',stat.group_label+' · '+stat.label,'eyebrow'));
  var progress=el('progress');progress.max=items.length;progress.value=session.cursor;progress.setAttribute('aria-label','Пройдено вопросов');app.append(progress);
  app.append(el('p','Вопрос '+(session.cursor+1)+' из '+items.length,'muted'),el('h1',item.stem));
  var ranked=item.format==='rank-top-two',multi=ranked||item.format==='select-up-to-two';
  app.append(el('p',ranked?'Выберите два действия по очереди: сначала первое, затем второе.':multi?'Выберите один или два варианта.':'Выберите один вариант.','muted'));
  var saved=session.answers[item.id];
  selection=saved&&saved.status==='answered'?(Array.isArray(saved.value)?saved.value.slice():[saved.value]):saved&&saved.status==='not_applicable'?[item.not_applicable.id]:[];
  var fieldset=el('fieldset');fieldset.append(el('legend','Ваш ответ','sr-only'));
  var optionNodes=[];
  displayOptions(item).forEach(function(option){
   var label=el('label',undefined,'option'),input=el('input');input.type=multi?'checkbox':'radio';input.name='answer';input.value=option.id;input.checked=selection.indexOf(option.id)>=0;
   var span=el('span');label.append(input,span);optionNodes.push({input:input,span:span,id:option.id,text:option.text});
   input.addEventListener('change',function(){
    note('');
    if(!multi)selection=[option.id];
    else if(input.checked){
     if(selection.length>=2){input.checked=false;note('Можно выбрать не более двух вариантов.');return;}
     selection.push(option.id);
    }else selection=selection.filter(function(id){return id!==option.id;});
    syncLabels();
   });
   fieldset.append(label);
  });
  function syncLabels(){optionNodes.forEach(function(o){var n=selection.indexOf(o.id);o.input.checked=n>=0;o.span.textContent=(ranked&&n>=0?(n+1)+'. ':'')+o.text;});}
  syncLabels();app.append(fieldset);
  function commit(skip){
   try{
    session=engine.setAnswer(config,session,item.id,skip?{status:'skipped'}:{status:'answered',value:multi?selection:selection[0]},now());
    return true;
   }catch(e){note(ranked?'Выберите два разных действия либо пропустите вопрос.':'Выберите ответ либо пропустите вопрос.');return false;}
  }
  var controls=el('div',undefined,'actions');
  var back=button('Назад',function(){session.cursor=Math.max(0,session.cursor-1);persist();renderQuestion();});back.disabled=session.cursor===0;
  controls.append(back,button('Пропустить',function(){advance(true);}),button('Далее',function(){advance(false);},'primary'));
  function advance(skip){
   if(!commit(skip))return;
   session.cursor++;
   if(session.cursor===items.length)session=engine.finish(config,session,now());
   var saved=persist();
   if(session.cursor===items.length)renderResults();else renderQuestion();
   if(!saved)note('Ответ сохранён только до закрытия страницы. Скачайте ответы перед выходом.');
  }
  app.append(controls);
  var extra=el('div',undefined,'actions secondary');
  extra.append(button('Сохранить и выйти',function(){if(!commit(false))return;persist();renderIntro();}),button('Скачать сохранённые ответы',exportData));
  app.append(extra,el('p','Выбранный ответ сохраняется после «Далее» или «Сохранить и выйти». Пропуск не считается нулевой способностью.','muted'));
 }
 function answerText(item,a){
  if(!a)return 'Нет ответа';if(a.status==='skipped')return 'Пропущено';if(a.status==='not_applicable')return 'Нет подходящего случая';
  var values=Array.isArray(a.value)?a.value:[a.value];
  return values.map(function(id){var o=item.options.find(function(option){return option.id===id;});return o?o.text:id;}).join(' → ');
 }
 function renderResults(){
  clear();var summary=engine.summarize(config,session);
  app.append(el('p','Ответы сохранены в этом браузере','eyebrow'),el('h1','Сведения собраны'));
  app.append(el('p','Ниже видно, какие части анкеты заполнены. Это покрытие ответов, а не уровень способностей. Формулы расчёта и правила 12 профилей ещё разрабатываются.'));
  var list=el('div',undefined,'results');
  summary.stats.forEach(function(stat){
   var details=el('details'),head=el('summary',stat.label+' — ответы '+stat.responses.answered+' из '+stat.item_count);
   details.append(head,el('p','Пропущено: '+stat.responses.skipped+' · Не было случая: '+stat.responses.not_applicable+' · Нет ответа: '+stat.responses.missing,'muted'));
   config.items.filter(function(item){return item.stat_id===stat.stat_id;}).forEach(function(item){details.append(el('p',item.stem),el('p',answerText(item,session.answers[item.id]),'answer'));});
   list.append(details);
  });
  app.append(list);
  var row=el('div',undefined,'actions');
  row.append(button('Скачать ответы',exportData,'primary'),button('Посмотреть с начала',function(){session.cursor=0;persist();renderQuestion();}),button('К началу',renderIntro));app.append(row);
  if(!storageAvailable)note('Сохранение в браузере не сработало. Скачайте ответы сейчас.');
 }
 async function start(){
  try{
   var embedded=document.getElementById('typology-config');
   config=embedded?JSON.parse(embedded.textContent):await fetch('data/typology/baseline-13.draft.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('config');return r.json();});
   engine.validateConfig(config);items=engine.allItems(config);storageKey='dom_typology_draft:'+config.id+':'+config.version;
   var raw=null;try{raw=localStorage.getItem(storageKey);}catch(e){storageAvailable=false;}
   if(raw){
    try{session=engine.restoreSession(config,JSON.parse(raw));}
    catch(e){
     clear();app.append(el('h1','Черновик не удалось открыть'),el('p','Сохранённые данные не удалены. Скачайте их перед созданием новой анкеты.'));
     app.append(button('Скачать сохранённый черновик',function(){download({raw:raw},'dom-draft-recovery.json');}),button('Создать новый черновик',function(){
      if(!window.confirm('Заменить сохранённый черновик? Сначала скачайте его, если он нужен.'))return;
      session=engine.createSession(config,newId(),now());persist();renderIntro();
     }));return;
    }
   }else session=engine.createSession(config,newId(),now());
   renderIntro();
  }catch(e){clear();app.append(el('h1','Анкета пока недоступна'),el('p','Не удалось загрузить её описание. Попробуйте обновить страницу. Для локального запуска откройте её через веб-сервер.'));console.error('Typology draft:',e);}
 }
 start();
})();
