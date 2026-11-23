/* Verified partner intake. Only a real server receipt can display success. */
(()=>{'use strict';if(!window.DOMV03Copy)return;const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)],API='https://neuroattention-api-production.up.railway.app',KEY='dom_partner_draft_v1';
const local=(()=>{try{return localStorage}catch(e){return null}})(),session=(()=>{try{return sessionStorage}catch(e){return null}})(),get=(s,k)=>{try{return s?.getItem(k)||null}catch(e){return null}},put=(s,k,v)=>{try{if(!s)return false;s.setItem(k,JSON.stringify(v));return true}catch(e){return false}},remove=(s,k)=>{try{s?.removeItem(k)}catch(e){}};
const lang=()=>window.DOMV03Copy[document.documentElement.lang]?document.documentElement.lang:'en',data=()=>window.DOMV03Copy[lang()],t=k=>data().partner[k]||data().partner.error;
const dashboard=q('#client-dashboard');
if(dashboard){
  // Applicant history belongs in Profile, not a primary account navigation tab.
  const profile=q('#tab-overview',dashboard)||q('.tab-panel',dashboard);
  if(profile&&!q('#dom-partner-account-list')){
    const details=document.createElement('details');
    details.id='dom-partner-profile-summary';
    details.className='dom-partner-profile-summary';
    details.hidden=true;
    details.innerHTML='<summary><span data-dom-partner-own></span><span id="dom-partner-profile-count"></span></summary><p id="dom-partner-account-message" role="status"></p><div id="dom-partner-account-list"></div>';
    const quick=q('#dom-private-journal')||q('#dom-quick-record'), stats=q('#rpg-dashboard');
    if(quick)quick.after(details);else if(stats)stats.before(details);else profile.prepend(details);
  }
  const admin=q('#admin-dashboard'), people=q('#admin-people-subtabs');
  if(admin&&people&&!q('#dom-partner-admin-queue')){
    const queue=document.createElement('section');
    queue.id='tab-admin-partners';
    queue.className='tab-panel';
    queue.innerHTML='<div class="dom-partner-profile-summary" id="dom-partner-admin-queue" hidden><h3 data-partner-i18n="reviewQueue"></h3><p id="dom-partner-admin-message" role="status"></p><div id="dom-partner-admin-list"></div></div>';
    (q('#admin-embed-container .tab-panel')?.parentElement||admin).append(queue);
    const tab=document.createElement('button');
    tab.type='button';
    tab.className='dash-tab';
    tab.dataset.tab='admin-partners';
    tab.dataset.partnerI18n='reviewQueue';
    tab.hidden=true;
    tab.onclick=()=>window.switchAdminTab('admin-partners');
    people.append(tab);
  }
  if(!q('#dom-partner-profile-css')){
    const style=document.createElement('style');style.id='dom-partner-profile-css';
    style.textContent='.dom-partner-profile-summary{margin:1.25rem 0;padding:1rem 1.3rem;border:1px solid var(--line-soft,#98b7a544);border-radius:15px;color:var(--text-primary);background:var(--bg-surface,#101d1b)}.dom-partner-profile-summary>summary{cursor:pointer;list-style:none;font-weight:600;padding:.35rem 0;min-height:34px}.dom-partner-profile-summary>summary::after{content:"+";float:right}.dom-partner-profile-summary[open]>summary::after{content:"−"}.dom-partner-profile-summary>summary:focus-visible{outline:2px solid var(--accent-cyan,#a3d2b3)}.dom-partner-profile-summary #dom-partner-account-list{margin:.9rem 0;display:grid;gap:.65rem}.dom-partner-profile-summary[hidden]{display:none!important}';
    document.head.append(style);
  }
}
const form=q('#dom-partner-form');let token=get(local,'na_token'),verifiedEmail='',challenge=null,busy=false,saved=false,requestId=crypto.randomUUID(),cache=null,lastToken='',interest=new URLSearchParams(location.search).get('interest')==='research'?'research':'collaboration';
function message(key,id='partner-message'){const n=document.getElementById(id);if(!n)return;if(!key){n.textContent='';delete n.dataset.messageKey;return;}if(form&&key==='error'&&!saved)key='noDraft';n.dataset.messageKey=key;n.textContent=t(key);}
async function api(path,method='GET',body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const response=await fetch(API+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,cache:'no-store'});const r=await response.json();if(!response.ok)throw Object.assign(Error(r.error||'error'),{code:r.error||'error'});return r;}finally{clearTimeout(timer);}}
function update(){if(form)q('#partner-submit').textContent=t(busy?'working':challenge?'verify':verifiedEmail===form.elements.email.value.trim().toLowerCase()&&verifiedEmail?'send':'submit');}
function localize(){const d=data();const own=q('[data-dom-partner-own]');if(own)own.textContent=({ru:'Мои заявки',en:'My applications',es:'Mis solicitudes'})[lang()]||'My applications';qa('[data-partner-i18n]').forEach(n=>n.textContent=t(n.dataset.partnerI18n));qa('[data-partner-ui]').forEach(n=>n.textContent=d.ui[n.dataset.partnerUi]);qa('[data-partner-direction]').forEach(n=>n.textContent=d.directions[+n.dataset.partnerDirection].title);qa('[data-partner-catalogue]').forEach(n=>n.textContent=d.catalogue[+n.dataset.partnerCatalogue].title);qa('[data-partner-pilot]').forEach(n=>n.textContent=d.pilots[+n.dataset.partnerPilot].topicTitle||d.pilots[+n.dataset.partnerPilot].title);qa('[data-message-key]').forEach(n=>n.textContent=t(n.dataset.messageKey));if(cache)render(cache);update();}
function payload(){const f=new FormData(form);return {client_request_id:requestId,display_name:String(f.get('name')||''),email:String(f.get('email')||'').trim().toLowerCase(),directions:f.getAll('direction'),custom_direction:String(f.get('custom')||''),research_topic:String(f.get('research_topic')||''),interest:f.get('research_topic')?'research':interest,country:f.has('omit_location')?'':String(f.get('country')||''),city:f.has('omit_location')?'':String(f.get('city')||''),competence:String(f.get('competence')||''),proposal:String(f.get('proposal')||''),portfolio_url:String(f.get('portfolio')||''),consent:f.has('consent'),marketing_opt_in:f.has('marketing_opt_in')};}
function save(){saved=put(session,KEY,{version:1,expiresAt:Date.now()+86400000,payload:payload(),omitLocation:form.elements.omit_location.checked});}
function locationMode(){['country','city'].forEach(k=>form.elements[k].disabled=form.elements.omit_location.checked);}
function codeMode(value){q('#partner-code-step').hidden=!value;form.elements.code.disabled=!value;form.elements.code.required=value;if(!value)form.elements.code.value='';update();}
function lock(value){busy=value;q('#partner-submit').disabled=value;q('#partner-resend').disabled=value;update();}
async function sendCode(){if(busy)return;form.elements.code.required=false;if(!form.reportValidity()){form.elements.code.required=!!challenge;return;}const p=payload();if(!p.directions.length&&!p.custom_direction&&!p.research_topic){message('choose_direction');return;}save();lock(true);try{const r=await api('/api/partner/auth/request-code','POST',{email:p.email,display_name:p.display_name,locale:lang()});if(!r.challenge_id)throw Error('error');challenge={id:r.challenge_id,email:p.email};codeMode(true);message('codeSent');form.elements.code.focus();}catch(e){message(e.code||'error')}finally{lock(false);form.elements.code.required=!!challenge;}}
async function submit(){if(busy||!form.reportValidity())return;const p=payload();if(!p.directions.length&&!p.custom_direction&&!p.research_topic){message('choose_direction');return;}save();if(!challenge&&verifiedEmail!==p.email){await sendCode();return;}lock(true);try{if(challenge){if(challenge.email!==p.email){challenge=null;codeMode(false);throw Object.assign(Error(),{code:'email_verification_required'});}const r=await api('/api/partner/auth/verify-code','POST',{challenge_id:challenge.id,code:form.elements.code.value});if(!r.token||!r.user?.id)throw Error('error');token=r.token;verifiedEmail=r.user.email.toLowerCase();try{local?.setItem('na_token',token);local?.setItem('na_user',JSON.stringify(r.user))}catch(e){}challenge=null;codeMode(false);}const r=await api('/api/partner/applications','POST',p);if(!r.application?.id||!r.application.created_at)throw Error('error');remove(session,KEY);form.hidden=true;q('#partner-success').hidden=false;q('#partner-receipt').textContent=t('id')+': '+r.application.id+' · '+new Date(r.application.created_at).toLocaleString(lang());q('#partner-success-title').tabIndex=-1;q('#partner-success-title').focus();try{session?.setItem('dom_partner_first_session','1')}catch(e){}}catch(e){if(e.code==='email_verification_required')verifiedEmail='';save();message(e.code||'error')}finally{lock(false);}}
function restore(){let draft;try{draft=JSON.parse(get(session,KEY))}catch(e){}if(draft?.version===1&&draft.expiresAt>Date.now()&&draft.payload){const p=draft.payload;if(typeof p.client_request_id==='string'&&/^[0-9a-f-]{36}$/i.test(p.client_request_id))requestId=p.client_request_id;const map={name:'display_name',email:'email',custom:'custom_direction',research_topic:'research_topic',country:'country',city:'city',competence:'competence',proposal:'proposal',portfolio:'portfolio_url'};Object.entries(map).forEach(([k,key])=>{if(typeof p[key]==='string')form.elements[k].value=p[key].slice(0,form.elements[k].maxLength>0?form.elements[k].maxLength:5000)});qa('[name=direction]',form).forEach(n=>n.checked=Array.isArray(p.directions)&&p.directions.includes(n.value));form.elements.omit_location.checked=draft.omitLocation!==false;form.elements.consent.checked=p.consent===true;form.elements.marketing_opt_in.checked=p.marketing_opt_in===true;interest=p.interest==='research'?'research':'collaboration';saved=true;message('draftRestored');}else remove(session,KEY);const params=new URLSearchParams(location.search),ids=(params.get('directions')||'').split(',');qa('[name=direction]',form).forEach(n=>{if(ids.includes(n.value))n.checked=true});const topic=params.get('topic');if(data().pilots.some(p=>p.id===topic))form.elements.research_topic.value=topic;locationMode();}
const name=id=>{const item=[...data().directions,...data().catalogue,...data().pilots].find(x=>x.id===id);return item?.topicTitle||item?.title||id;};
function record(item,admin,manage){const node=document.createElement('article');node.className='dom-partner-record';const h=document.createElement('h3');h.textContent=item.display_name+' · '+t(item.status);node.append(h);const meta=document.createElement('small');meta.textContent=t('id')+': '+item.id+' · '+new Date(item.created_at).toLocaleString(lang());node.append(meta);const values=[(item.directions||[]).map(name).join(' · '),item.custom_direction,item.research_topic?name(item.research_topic):'',item.competence,item.proposal];if(admin)values.unshift(item.contact_email,[item.city,item.country].filter(Boolean).join(', '));values.filter(Boolean).forEach(value=>{const p=document.createElement('p');p.textContent=value;node.append(p)});if(item.portfolio_url){try{const u=new URL(item.portfolio_url);if(u.protocol==='https:'){const a=document.createElement('a');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=t('portfolio');node.append(a)}}catch(e){}}
if(admin&&manage){const select=document.createElement('select');select.setAttribute('aria-label',t('saveStatus'));['submitted','in_review','needs_information','accepted','closed'].forEach(status=>{const o=document.createElement('option');o.value=status;o.textContent=t(status);o.selected=item.status===status;select.append(o)});const button=document.createElement('button');button.type='button';button.textContent=t('saveStatus');button.addEventListener('click',async()=>{button.disabled=true;try{await api('/api/partner/admin/applications/'+item.id+'/status','PATCH',{status:select.value,version:item.version});await loadAccount(true)}catch(e){message(e.code||'error','dom-partner-admin-message')}finally{button.disabled=false}});node.append(select,button);}return node;}
function render(result){
  const host=q('#dom-partner-account-list');
  if(!host)return;
  host.replaceChildren(...result.applications.map(item=>record(item,false,false)));
  const summary=q('#dom-partner-profile-summary');
  summary.hidden=!result.applications.length;
  if(summary.hidden)summary.open=false;
  q('#dom-partner-profile-count').textContent=result.applications.length?' · '+result.applications.length:'';
  const canRead=!!result.permissions?.read;
  q('[data-tab="admin-partners"]').hidden=!canRead;
  q('#dom-partner-admin-queue').hidden=!canRead;
  q('#dom-partner-admin-list').replaceChildren(...(result.queue||[]).map(item=>record(item,true,result.permissions.manage)));
}
async function loadAccount(force=false){
  const next=get(local,'na_token');
  if(!force&&lastToken===next)return;
  token=next;
  if(lastToken!==next){
    cache=null;
    render({applications:[],permissions:{}});
  }
  lastToken=next;
  if(!next)return;
  try{
    const result=await api('/api/partner/me');
    if(get(local,'na_token')!==next)return;
    cache=result;
    render(result);
    if(get(session,'dom_partner_first_session')==='1'||location.hash==='#partnerships'){
      if(location.hash==='#partnerships')history.replaceState(null,'','#overview');
      window.switchTab?.('overview');
      if(result.applications.length)q('#dom-partner-profile-summary').open=true;
      remove(session,'dom_partner_first_session');
    }
    if(result.permissions.read){
      try{result.queue=(await api('/api/partner/admin/applications')).applications;}
      catch(e){if(get(local,'na_token')===next)message(e.code||'error','dom-partner-admin-message');return;}
      if(get(local,'na_token')===next)render(result);
    }
  }catch(e){
    if(get(local,'na_token')===next)lastToken='';
  }
}
if(form){restore();form.addEventListener('input',()=>{save();if(challenge&&challenge.email!==form.elements.email.value.trim().toLowerCase()){challenge=null;codeMode(false)}locationMode();update()});form.addEventListener('submit',e=>{e.preventDefault();submit()});q('#partner-resend').addEventListener('click',()=>{challenge=null;codeMode(false);sendCode()});q('#partner-clear').addEventListener('click',()=>{remove(session,KEY);form.reset();requestId=crypto.randomUUID();challenge=null;codeMode(false);locationMode();message('')});q('#partner-return').addEventListener('click',e=>{let previous;try{previous=new URL(document.referrer)}catch(error){}if(previous?.origin===location.origin&&['/','/index.html'].includes(previous.pathname)&&get(session,'dom_partner_return_v1')&&history.length>1){e.preventDefault();history.back()}});
if(token)api('/api/partner/me').then(r=>{verifiedEmail=r.email_verified?r.user.email.toLowerCase():'';if(!form.elements.email.value)form.elements.email.value=r.user.email;if(!form.elements.name.value)form.elements.name.value=r.user.display_name||'';update()}).catch(()=>{});
}
if(dashboard){
  new MutationObserver(()=>loadAccount()).observe(dashboard,{attributes:true,attributeFilter:['style']});
  if(dashboard.style.display==='block')loadAccount();
  window.addEventListener('storage', e=>{if(e.key==='na_token')loadAccount();});
  window.addEventListener('hashchange',()=>{
    if(location.hash==='#partnerships'&&dashboard.style.display==='block')loadAccount(true);
  });
}
document.addEventListener('langchange',localize);localize();
})();