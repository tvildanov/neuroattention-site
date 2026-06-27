/*
   family-team.js — Family & Team tab (PR91 / Phase 2A).

   A third sub-tab of the Evolution Path area where a user manages their
   relationships: a FAMILY (children/dependents + invited family members) and
   TEAMS (work/study groups). Families and teams are both rows in the `teams`
   table (kind='family' vs 'team'); children who are NOT platform users live in
   dependent_profiles. This module only talks to the existing/PR91 API:

     GET  /api/teams                 — my families + teams
     POST /api/teams                 — create family (kind:'family') or team
     POST /api/teams/:id/members     — add a member by email
     POST /api/teams/:id/invite      — generate a shareable invite link
     GET  /api/teams/search?q=       — discover public teams
     POST /api/teams/join/:token     — accept an invite
     GET/POST/PATCH/DELETE /api/dependents — children/dependents
     GET  /api/anatomy/conditions    — diagnosis library (multi-select)

   No build step; loaded with a cache-bust query in account.html.
*/
(function () {
  'use strict';

  function lang() { return (typeof window.getLang === 'function') ? window.getLang() : 'ru'; }
  function L(o) { var g = lang(); return (o && (o[g] || o.ru || o.en)) || ''; }
  function token() { try { return (typeof naGetToken === 'function' ? naGetToken() : localStorage.getItem('na_token')) || ''; } catch (e) { return ''; } }
  function apiBase() { return window.AUTH_API || ''; }

  function api(path, opts) {
    opts = opts || {};
    var headers = { 'Authorization': 'Bearer ' + token() };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(apiBase() + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, data: j }; }).catch(function () { return { ok: r.ok, status: r.status, data: {} }; }); });
  }

  var T = {
    title:        { ru: 'Семья и команда', en: 'Family & Team', es: 'Familia y equipo' },
    sub:          { ru: 'Управляйте связями: семья, дети и команды.', en: 'Manage your connections: family, children and teams.', es: 'Gestiona tus conexiones: familia, hijos y equipos.' },
    family:       { ru: 'Семья', en: 'Family', es: 'Familia' },
    teams:        { ru: 'Команды', en: 'Teams', es: 'Equipos' },
    loading:      { ru: 'Загрузка…', en: 'Loading…', es: 'Cargando…' },
    createFamily: { ru: 'Создать семью', en: 'Create your family', es: 'Crea tu familia' },
    createFamilyHint: { ru: 'Объедините близких и отслеживайте путь развития детей.', en: 'Bring your loved ones together and track your children’s path.', es: 'Reúne a tus seres queridos y sigue el camino de tus hijos.' },
    familyName:   { ru: 'Название семьи', en: 'Family name', es: 'Nombre de la familia' },
    defaultFamily:{ ru: 'Моя семья', en: 'My family', es: 'Mi familia' },
    myRole:       { ru: 'Моя роль', en: 'My role', es: 'Mi rol' },
    addChild:     { ru: '+ Добавить ребёнка', en: '+ Add child', es: '+ Añadir hijo' },
    addMember:    { ru: '+ Добавить члена семьи', en: '+ Add family member', es: '+ Añadir familiar' },
    inviteLink:   { ru: '+ Пригласить по ссылке', en: '+ Invite by link', es: '+ Invitar por enlace' },
    createTeam:   { ru: 'Создать команду', en: 'Create team', es: 'Crear equipo' },
    findTeam:     { ru: 'Найти команду', en: 'Find / join team', es: 'Buscar equipo' },
    noTeams:      { ru: 'У вас пока нет команд.', en: 'You have no teams yet.', es: 'Aún no tienes equipos.' },
    members:      { ru: 'участн.', en: 'members', es: 'miembros' },
    name:         { ru: 'Имя', en: 'Name', es: 'Nombre' },
    sex:          { ru: 'Пол', en: 'Sex', es: 'Sexo' },
    male:         { ru: 'Мужской', en: 'Male', es: 'Masculino' },
    female:       { ru: 'Женский', en: 'Female', es: 'Femenino' },
    other:        { ru: 'Другое', en: 'Other', es: 'Otro' },
    dob:          { ru: 'Дата рождения', en: 'Date of birth', es: 'Fecha de nacimiento' },
    notBorn:      { ru: 'Ещё не родился', en: 'Not born yet', es: 'Aún no ha nacido' },
    dueDate:      { ru: 'Предполагаемая дата родов', en: 'Expected due date', es: 'Fecha prevista de parto' },
    gestation:    { ru: 'Срок беременности', en: 'Gestational age', es: 'Edad gestacional' },
    weeks:        { ru: 'нед.', en: 'weeks', es: 'sem.' },
    diagnoses:    { ru: 'Диагнозы', en: 'Diagnoses', es: 'Diagnósticos' },
    diagnosesHint:{ ru: 'Необязательно. Поиск по библиотеке состояний.', en: 'Optional. Search the condition library.', es: 'Opcional. Busca en la biblioteca.' },
    trackFrom:    { ru: 'С какого момента отслеживать?', en: 'Track from when?', es: '¿Desde cuándo seguir?' },
    relation:     { ru: 'Кем приходится', en: 'Relation', es: 'Relación' },
    save:         { ru: 'Сохранить', en: 'Save', es: 'Guardar' },
    cancel:       { ru: 'Отмена', en: 'Cancel', es: 'Cancelar' },
    create:       { ru: 'Создать', en: 'Create', es: 'Crear' },
    email:        { ru: 'Email', en: 'Email', es: 'Email' },
    sendInvite:   { ru: 'Отправить приглашение', en: 'Send invite', es: 'Enviar invitación' },
    genLink:      { ru: 'Сгенерировать ссылку', en: 'Generate link', es: 'Generar enlace' },
    copyLink:     { ru: 'Скопировать', en: 'Copy', es: 'Copiar' },
    copied:       { ru: 'Скопировано!', en: 'Copied!', es: '¡Copiado!' },
    description:  { ru: 'Описание', en: 'Description', es: 'Descripción' },
    teamName:     { ru: 'Название команды', en: 'Team name', es: 'Nombre del equipo' },
    publicTeam:   { ru: 'Публичная (видна в поиске)', en: 'Public (visible in search)', es: 'Pública (visible en búsqueda)' },
    searchPh:     { ru: 'Поиск команды по названию…', en: 'Search teams by name…', es: 'Buscar equipos…' },
    join:         { ru: 'Вступить', en: 'Join', es: 'Unirse' },
    joined:       { ru: 'Вы вступили', en: 'Joined', es: 'Te uniste' },
    member:       { ru: 'Участник', en: 'Member', es: 'Miembro' },
    noResults:    { ru: 'Ничего не найдено', en: 'No results', es: 'Sin resultados' },
    noChildren:   { ru: 'Пока нет добавленных детей или зависимых.', en: 'No children or dependents added yet.', es: 'Aún no hay hijos o dependientes.' },
    err:          { ru: 'Ошибка', en: 'Error', es: 'Error' },
    confirmDelete:{ ru: 'Удалить?', en: 'Remove?', es: '¿Eliminar?' },
    viewPath:     { ru: 'Смотреть путь', en: 'View path', es: 'Ver camino' },
    joinAccept:   { ru: 'Принять приглашение', en: 'Accept invite', es: 'Aceptar invitación' },
    invitedTo:    { ru: 'Вас пригласили в', en: 'You were invited to', es: 'Te invitaron a' },
    phase: {
      prenatal:   { ru: 'Беременность', en: 'Prenatal', es: 'Prenatal' },
      infant:     { ru: 'Младенец', en: 'Infant', es: 'Bebé' },
      toddler:    { ru: 'Ранний возраст', en: 'Toddler', es: 'Pequeño' },
      child:      { ru: 'Ребёнок', en: 'Child', es: 'Niño' },
      adolescent: { ru: 'Подросток', en: 'Adolescent', es: 'Adolescente' },
      adult:      { ru: 'Взрослый', en: 'Adult', es: 'Adulto' },
      unknown:    { ru: '—', en: '—', es: '—' }
    }
  };
  // kin roles (mirror server FAMILY_ROLES)
  var ROLES = [
    { v: 'mother',  o: { ru: 'Мать', en: 'Mother', es: 'Madre' } },
    { v: 'father',  o: { ru: 'Отец', en: 'Father', es: 'Padre' } },
    { v: 'spouse',  o: { ru: 'Супруг(а)', en: 'Spouse', es: 'Cónyuge' } },
    { v: 'partner', o: { ru: 'Партнёр', en: 'Partner', es: 'Pareja' } },
    { v: 'son',     o: { ru: 'Сын', en: 'Son', es: 'Hijo' } },
    { v: 'daughter',o: { ru: 'Дочь', en: 'Daughter', es: 'Hija' } },
    { v: 'brother', o: { ru: 'Брат', en: 'Brother', es: 'Hermano' } },
    { v: 'sister',  o: { ru: 'Сестра', en: 'Sister', es: 'Hermana' } },
    { v: 'grandmother', o: { ru: 'Бабушка', en: 'Grandmother', es: 'Abuela' } },
    { v: 'grandfather', o: { ru: 'Дедушка', en: 'Grandfather', es: 'Abuelo' } },
    { v: 'other',   o: { ru: 'Другое', en: 'Other', es: 'Otro' } }
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function gestationWeeks(dueIso) {
    if (!dueIso) return null;
    var due = new Date(dueIso).getTime();
    if (isNaN(due)) return null;
    return Math.max(0, Math.min(42, Math.round(40 - (due - Date.now()) / (7 * 864e5))));
  }
  function ensureStyles() {
    if (document.getElementById('ft-styles')) return;
    var s = document.createElement('style');
    s.id = 'ft-styles';
    s.textContent = [
      '.ft-wrap{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;}',
      '@media(max-width:860px){.ft-wrap{grid-template-columns:1fr;}}',
      '.ft-sec{background:var(--glass-bg,rgba(255,255,255,0.03));border:1px solid var(--glass-border,rgba(255,255,255,0.08));border-radius:16px;padding:1.25rem;}',
      '.ft-sec h3{margin:0 0 0.25rem;font-size:18px;}',
      '.ft-sec .ft-secsub{color:var(--text-muted);font-size:13px;margin:0 0 1rem;}',
      '.ft-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(0,224,255,0.10);color:var(--accent-cyan);border:1px solid rgba(0,224,255,0.35);border-radius:10px;padding:8px 14px;font-size:13px;cursor:pointer;transition:background .15s;}',
      '.ft-btn:hover{background:rgba(0,224,255,0.18);}',
      '.ft-btn.ft-ghost{background:transparent;color:var(--text-muted);border-color:var(--glass-border,rgba(255,255,255,0.12));}',
      '.ft-btn.ft-primary{background:var(--accent-cyan);color:#04121a;border-color:var(--accent-cyan);font-weight:600;}',
      '.ft-btn.ft-danger{background:transparent;color:var(--accent-rose,#ff6b8b);border-color:rgba(255,107,139,0.4);}',
      '.ft-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:0.75rem;}',
      '.ft-card{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border,rgba(255,255,255,0.07));border-radius:12px;padding:10px 12px;margin-bottom:8px;}',
      '.ft-card .ft-av{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;background:rgba(0,224,255,0.12);flex:0 0 auto;}',
      '.ft-card .ft-meta{flex:1;min-width:0;}',
      '.ft-card .ft-name{font-weight:600;font-size:14px;}',
      '.ft-card .ft-tags{color:var(--text-muted);font-size:12px;margin-top:2px;}',
      '.ft-chip{display:inline-block;background:rgba(0,224,255,0.10);color:var(--accent-cyan);border-radius:999px;padding:1px 8px;font-size:11px;margin-right:5px;}',
      '.ft-empty{color:var(--text-muted);font-size:13px;text-align:center;padding:1rem 0;}',
      '.ft-form label{display:block;font-size:12px;color:var(--text-muted);margin:10px 0 4px;}',
      '.ft-form input[type=text],.ft-form input[type=email],.ft-form input[type=date],.ft-form select,.ft-form textarea{width:100%;box-sizing:border-box;background:rgba(0,0,0,0.25);border:1px solid var(--glass-border,rgba(255,255,255,0.12));border-radius:9px;color:var(--text,#e8f0f4);padding:9px 11px;font-size:14px;font-family:inherit;}',
      '.ft-form .ft-row{display:flex;gap:10px;}.ft-form .ft-row>*{flex:1;}',
      '.ft-form .ft-check{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;color:var(--text,#e8f0f4);}',
      '.ft-form .ft-check input{width:auto;}',
      '.ft-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;padding:5vh 16px;z-index:9999;overflow:auto;}',
      '.ft-modal{background:var(--bg-elevated,#0d1620);border:1px solid var(--glass-border,rgba(255,255,255,0.1));border-radius:16px;padding:1.5rem;max-width:480px;width:100%;}',
      '.ft-modal h4{margin:0 0 0.5rem;font-size:17px;}',
      '.ft-diag-list{max-height:180px;overflow:auto;border:1px solid var(--glass-border,rgba(255,255,255,0.1));border-radius:9px;padding:6px;margin-top:6px;}',
      '.ft-diag-item{display:flex;align-items:center;gap:8px;padding:4px 6px;font-size:13px;cursor:pointer;border-radius:6px;}',
      '.ft-diag-item:hover{background:rgba(255,255,255,0.04);}',
      '.ft-note{font-size:12px;color:var(--accent-cyan);margin-top:6px;}',
      '.ft-linkbox{display:flex;gap:8px;margin-top:10px;}.ft-linkbox input{flex:1;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── modal helper ──
  function modal(titleObj, bodyEl, onClose) {
    var bg = document.createElement('div');
    bg.className = 'ft-modal-bg';
    var box = document.createElement('div');
    box.className = 'ft-modal';
    box.innerHTML = '<h4>' + esc(L(titleObj)) + '</h4>';
    box.appendChild(bodyEl);
    bg.appendChild(box);
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    function close() { bg.remove(); if (onClose) onClose(); }
    document.body.appendChild(bg);
    return { close: close, box: box };
  }

  function mountFamilyTeam(container) {
    if (!container) return;
    ensureStyles();
    container.innerHTML = '<div class="ft-empty">' + esc(L(T.loading)) + '</div>';
    Promise.all([ api('/api/teams'), api('/api/dependents') ]).then(function (res) {
      var teams = (res[0].data && res[0].data.teams) || [];
      var deps = (res[1].data && res[1].data.dependents) || [];
      var families = teams.filter(function (t) { return t.kind === 'family'; });
      var workTeams = teams.filter(function (t) { return t.kind !== 'family'; });
      render(container, { families: families, teams: workTeams, dependents: deps });
      // process a pending ?join=<token> invite, if any
      handlePendingJoin(container);
    }).catch(function (e) {
      container.innerHTML = '<div class="ft-empty">' + esc(L(T.err)) + ': ' + esc(e.message || '') + '</div>';
    });
  }

  function render(container, state) {
    var fam = state.families[0] || null; // one primary family for the simple UI
    var html = '';
    html += '<div style="margin-bottom:1rem;"><h2 style="margin:0 0 0.25rem;font-size:22px;">' + esc(L(T.title)) + '</h2>' +
            '<p style="margin:0;color:var(--text-muted);font-size:14px;">' + esc(L(T.sub)) + '</p></div>';
    html += '<div class="ft-wrap">';

    // ── Family section ──
    html += '<div class="ft-sec" id="ft-family-sec"><h3>👪 ' + esc(L(T.family)) + '</h3>';
    if (!fam) {
      html += '<p class="ft-secsub">' + esc(L(T.createFamilyHint)) + '</p>';
      html += '<button class="ft-btn ft-primary" id="ft-create-family">' + esc(L(T.createFamily)) + '</button>';
    } else {
      html += '<p class="ft-secsub">' + esc(fam.name) + '</p>';
      // dependents
      if (!state.dependents.length) {
        html += '<div class="ft-empty">' + esc(L(T.noChildren)) + '</div>';
      } else {
        state.dependents.forEach(function (d) {
          var phaseLbl = L(T.phase[d.phase] || T.phase.unknown);
          var sub = phaseLbl;
          if (d.phase === 'prenatal' && d.gestation_weeks != null) sub += ' · ' + d.gestation_weeks + ' ' + L(T.weeks);
          else if (d.age_years != null) sub += ' · ' + d.age_years + (lang() === 'ru' ? ' г.' : ' y');
          var emoji = d.phase === 'prenatal' ? '🤰' : (d.sex === 'female' ? '👧' : d.sex === 'male' ? '👦' : '🧒');
          html += '<div class="ft-card" data-dep="' + d.id + '">' +
                  '<div class="ft-av">' + emoji + '</div>' +
                  '<div class="ft-meta"><div class="ft-name">' + esc(d.name) + '</div>' +
                  '<div class="ft-tags">' + esc(sub) + (Array.isArray(d.diagnoses_ids) && d.diagnoses_ids.length ? ' · ' + d.diagnoses_ids.length + ' ' + esc(L(T.diagnoses).toLowerCase()) : '') + '</div></div>' +
                  '<button class="ft-btn ft-ghost ft-view-path" data-dep="' + d.id + '" data-name="' + esc(d.name) + '" title="' + esc(L(T.viewPath)) + '">📈</button>' +
                  '<button class="ft-btn ft-danger ft-del-dep" data-dep="' + d.id + '">✕</button>' +
                  '</div>';
        });
      }
      html += '<div class="ft-actions">' +
              '<button class="ft-btn" id="ft-add-child">' + esc(L(T.addChild)) + '</button>' +
              '<button class="ft-btn" id="ft-add-member">' + esc(L(T.addMember)) + '</button>' +
              '<button class="ft-btn ft-ghost" id="ft-invite-family">' + esc(L(T.inviteLink)) + '</button>' +
              '</div>';
    }
    html += '</div>';

    // ── Teams section ──
    html += '<div class="ft-sec" id="ft-teams-sec"><h3>🧩 ' + esc(L(T.teams)) + '</h3>';
    html += '<p class="ft-secsub">' + (state.teams.length ? '' : esc(L(T.noTeams))) + '</p>';
    state.teams.forEach(function (t) {
      html += '<div class="ft-card">' +
              '<div class="ft-av">🧩</div>' +
              '<div class="ft-meta"><div class="ft-name">' + esc(t.name) + '</div>' +
              '<div class="ft-tags">' + (t.member_count || 1) + ' ' + esc(L(T.members)) +
              (t.my_role === 'owner' ? ' · <span class="ft-chip">owner</span>' : '') + '</div></div>' +
              '</div>';
    });
    html += '<div class="ft-actions">' +
            '<button class="ft-btn" id="ft-create-team">' + esc(L(T.createTeam)) + '</button>' +
            '<button class="ft-btn ft-ghost" id="ft-find-team">' + esc(L(T.findTeam)) + '</button>' +
            '</div>';
    html += '</div>';

    html += '</div>'; // ft-wrap
    container.innerHTML = html;
    wire(container, state, fam);
  }

  function wire(container, state, fam) {
    var q = function (id) { return container.querySelector('#' + id); };
    var reload = function () { mountFamilyTeam(container); };

    if (q('ft-create-family')) q('ft-create-family').onclick = function () { openCreateFamily(reload); };
    if (q('ft-add-child')) q('ft-add-child').onclick = function () { openAddChild(fam, reload); };
    if (q('ft-add-member')) q('ft-add-member').onclick = function () { openAddMember(fam, reload); };
    if (q('ft-invite-family')) q('ft-invite-family').onclick = function () { openInvite(fam); };
    if (q('ft-create-team')) q('ft-create-team').onclick = function () { openCreateTeam(reload); };
    if (q('ft-find-team')) q('ft-find-team').onclick = function () { openFindTeam(reload); };

    container.querySelectorAll('.ft-del-dep').forEach(function (b) {
      b.onclick = function () {
        if (!confirm(L(T.confirmDelete))) return;
        api('/api/dependents/' + b.getAttribute('data-dep'), { method: 'DELETE' }).then(reload);
      };
    });
    container.querySelectorAll('.ft-view-path').forEach(function (b) {
      b.onclick = function () { openDependentPath(b.getAttribute('data-dep'), b.getAttribute('data-name')); };
    });
  }

  // ── Create family ──
  function openCreateFamily(reload) {
    var body = document.createElement('div');
    body.className = 'ft-form';
    body.innerHTML =
      '<label>' + esc(L(T.familyName)) + '</label><input type="text" id="ff-name" value="' + esc(L(T.defaultFamily)) + '">' +
      '<label>' + esc(L(T.myRole)) + '</label><select id="ff-role">' + roleOptions('mother') + '</select>' +
      '<div class="ft-actions"><button class="ft-btn ft-primary" id="ff-save">' + esc(L(T.create)) + '</button>' +
      '<button class="ft-btn ft-ghost" id="ff-cancel">' + esc(L(T.cancel)) + '</button></div>';
    var m = modal(T.createFamily, body);
    body.querySelector('#ff-cancel').onclick = m.close;
    body.querySelector('#ff-save').onclick = function () {
      var name = body.querySelector('#ff-name').value.trim() || L(T.defaultFamily);
      var role = body.querySelector('#ff-role').value;
      api('/api/teams', { method: 'POST', body: { name: name, kind: 'family', my_role: role } }).then(function (r) {
        if (!r.ok) return alert(L(T.err) + ': ' + (r.data.error || r.status));
        m.close(); reload();
      });
    };
  }

  function roleOptions(sel) {
    return ROLES.map(function (r) { return '<option value="' + r.v + '"' + (r.v === sel ? ' selected' : '') + '>' + esc(L(r.o)) + '</option>'; }).join('');
  }

  // ── Add child / dependent ──
  function openAddChild(fam, reload) {
    var body = document.createElement('div');
    body.className = 'ft-form';
    var today = new Date().toISOString().slice(0, 10);
    body.innerHTML =
      '<label>' + esc(L(T.name)) + '</label><input type="text" id="ac-name">' +
      '<div class="ft-row"><div><label>' + esc(L(T.sex)) + '</label><select id="ac-sex">' +
        '<option value="male">' + esc(L(T.male)) + '</option><option value="female">' + esc(L(T.female)) + '</option><option value="other">' + esc(L(T.other)) + '</option></select></div>' +
        '<div><label>' + esc(L(T.relation)) + '</label><select id="ac-rel"><option value="son">' + esc(L({ru:'Сын',en:'Son',es:'Hijo'})) + '</option><option value="daughter">' + esc(L({ru:'Дочь',en:'Daughter',es:'Hija'})) + '</option><option value="other">' + esc(L(T.other)) + '</option></select></div></div>' +
      '<label class="ft-check"><input type="checkbox" id="ac-notborn"> ' + esc(L(T.notBorn)) + '</label>' +
      '<div id="ac-dob-wrap"><label>' + esc(L(T.dob)) + '</label><input type="date" id="ac-dob" max="' + today + '" value="' + today + '"></div>' +
      '<div id="ac-due-wrap" style="display:none;"><label>' + esc(L(T.dueDate)) + '</label><input type="date" id="ac-due"><div class="ft-note" id="ac-gest"></div></div>' +
      '<label>' + esc(L(T.diagnoses)) + '</label><div class="ft-secsub" style="margin:0;">' + esc(L(T.diagnosesHint)) + '</div>' +
      '<input type="text" id="ac-diag-search" placeholder="🔍" style="margin-top:6px;"><div class="ft-diag-list" id="ac-diag-list"></div>' +
      '<label>' + esc(L(T.trackFrom)) + '</label><input type="date" id="ac-track" value="' + today + '">' +
      '<div class="ft-actions"><button class="ft-btn ft-primary" id="ac-save">' + esc(L(T.save)) + '</button>' +
      '<button class="ft-btn ft-ghost" id="ac-cancel">' + esc(L(T.cancel)) + '</button></div>';
    var m = modal(T.addChild, body);
    var notBorn = body.querySelector('#ac-notborn');
    var dobWrap = body.querySelector('#ac-dob-wrap'), dueWrap = body.querySelector('#ac-due-wrap');
    var dueInput = body.querySelector('#ac-due'), gestNote = body.querySelector('#ac-gest');
    function updateGest() {
      var w = gestationWeeks(dueInput.value);
      gestNote.textContent = (w != null) ? (L(T.gestation) + ': ~' + w + ' ' + L(T.weeks)) : '';
    }
    notBorn.onchange = function () {
      var nb = notBorn.checked;
      dobWrap.style.display = nb ? 'none' : '';
      dueWrap.style.display = nb ? '' : 'none';
      if (nb && !dueInput.value) { var d = new Date(Date.now() + 140 * 864e5); dueInput.value = d.toISOString().slice(0, 10); updateGest(); }
    };
    dueInput.oninput = updateGest;

    // diagnoses (lazy load condition library)
    var selected = {};
    var listEl = body.querySelector('#ac-diag-list');
    var allConds = [];
    api('/api/anatomy/conditions?limit=500').then(function (r) {
      allConds = (r.data && r.data.conditions) || [];
      renderDiag('');
    });
    function renderDiag(filter) {
      var g = lang();
      var f = filter.toLowerCase();
      var rows = allConds.filter(function (c) {
        if (!f) return true;
        return ((c['name_' + g] || c.name_en || '') + ' ' + (c.name_en || '')).toLowerCase().indexOf(f) > -1;
      }).slice(0, 60);
      listEl.innerHTML = rows.map(function (c) {
        var nm = c['name_' + g] || c.name_en || c.slug;
        return '<label class="ft-diag-item"><input type="checkbox" data-cid="' + c.id + '"' + (selected[c.id] ? ' checked' : '') + '> ' + esc(nm) + '</label>';
      }).join('') || '<div class="ft-empty">' + esc(L(T.noResults)) + '</div>';
      listEl.querySelectorAll('input').forEach(function (cb) {
        cb.onchange = function () { var id = cb.getAttribute('data-cid'); if (cb.checked) selected[id] = 1; else delete selected[id]; };
      });
    }
    body.querySelector('#ac-diag-search').oninput = function (e) { renderDiag(e.target.value); };

    body.querySelector('#ac-cancel').onclick = m.close;
    body.querySelector('#ac-save').onclick = function () {
      var name = body.querySelector('#ac-name').value.trim();
      if (!name) { body.querySelector('#ac-name').focus(); return; }
      var nb = notBorn.checked;
      var payload = {
        name: name,
        sex: body.querySelector('#ac-sex').value,
        relation: body.querySelector('#ac-rel').value,
        track_from: body.querySelector('#ac-track').value || null,
        diagnoses_ids: Object.keys(selected).map(Number),
        family_id: fam ? fam.id : null
      };
      if (nb) payload.expected_due_date = dueInput.value || null;
      else payload.birth_date = body.querySelector('#ac-dob').value || null;
      if (!payload.birth_date && !payload.expected_due_date) { alert(L(T.err)); return; }
      api('/api/dependents', { method: 'POST', body: payload }).then(function (r) {
        if (!r.ok) return alert(L(T.err) + ': ' + (r.data.error || r.status));
        m.close(); reload();
      });
    };
  }

  // ── Add family member (existing user by email, or invite link) ──
  function openAddMember(fam, reload) {
    if (!fam) return;
    var body = document.createElement('div');
    body.className = 'ft-form';
    body.innerHTML =
      '<label>' + esc(L(T.email)) + '</label><input type="email" id="am-email" placeholder="name@example.com">' +
      '<label>' + esc(L(T.relation)) + '</label><select id="am-role">' + roleOptions('partner') + '</select>' +
      '<div class="ft-actions"><button class="ft-btn ft-primary" id="am-send">' + esc(L(T.sendInvite)) + '</button>' +
      '<button class="ft-btn ft-ghost" id="am-link">' + esc(L(T.genLink)) + '</button>' +
      '<button class="ft-btn ft-ghost" id="am-cancel">' + esc(L(T.cancel)) + '</button></div>' +
      '<div id="am-out"></div>';
    var m = modal(T.addMember, body);
    body.querySelector('#am-cancel').onclick = m.close;
    body.querySelector('#am-send').onclick = function () {
      var email = body.querySelector('#am-email').value.trim();
      if (!email) { body.querySelector('#am-email').focus(); return; }
      api('/api/teams/' + fam.id + '/members', { method: 'POST', body: { email: email, role: body.querySelector('#am-role').value } }).then(function (r) {
        if (!r.ok) { body.querySelector('#am-out').innerHTML = '<div class="ft-note" style="color:var(--accent-rose,#ff6b8b)">' + esc(r.data.error || L(T.err)) + '</div>'; return; }
        m.close(); reload();
      });
    };
    body.querySelector('#am-link').onclick = function () {
      genInviteLink(fam.id, body.querySelector('#am-role').value, body.querySelector('#am-out'));
    };
  }

  // ── Invite by link only ──
  function openInvite(fam) {
    if (!fam) return;
    var body = document.createElement('div');
    body.className = 'ft-form';
    body.innerHTML = '<p class="ft-secsub">' + esc(L({ ru: 'Поделитесь ссылкой — присоединившийся станет членом семьи.', en: 'Share the link — whoever opens it joins your family.', es: 'Comparte el enlace para unir a alguien a tu familia.' })) + '</p>' +
      '<label>' + esc(L(T.relation)) + '</label><select id="iv-role">' + roleOptions('partner') + '</select>' +
      '<div class="ft-actions"><button class="ft-btn ft-primary" id="iv-gen">' + esc(L(T.genLink)) + '</button>' +
      '<button class="ft-btn ft-ghost" id="iv-cancel">' + esc(L(T.cancel)) + '</button></div><div id="iv-out"></div>';
    var m = modal(T.inviteLink, body);
    body.querySelector('#iv-cancel').onclick = m.close;
    body.querySelector('#iv-gen').onclick = function () { genInviteLink(fam.id, body.querySelector('#iv-role').value, body.querySelector('#iv-out')); };
  }

  function genInviteLink(teamId, role, outEl) {
    outEl.innerHTML = '<div class="ft-note">' + esc(L(T.loading)) + '</div>';
    api('/api/teams/' + teamId + '/invite', { method: 'POST', body: { role: role } }).then(function (r) {
      if (!r.ok) { outEl.innerHTML = '<div class="ft-note" style="color:var(--accent-rose,#ff6b8b)">' + esc(r.data.error || L(T.err)) + '</div>'; return; }
      var url = location.origin + location.pathname + '?join=' + encodeURIComponent(r.data.token);
      outEl.innerHTML = '<div class="ft-linkbox"><input type="text" readonly value="' + esc(url) + '" id="ft-link-val">' +
        '<button class="ft-btn" id="ft-link-copy">' + esc(L(T.copyLink)) + '</button></div>';
      outEl.querySelector('#ft-link-copy').onclick = function () {
        var inp = outEl.querySelector('#ft-link-val'); inp.select();
        try { navigator.clipboard ? navigator.clipboard.writeText(inp.value) : document.execCommand('copy'); } catch (e) { document.execCommand('copy'); }
        outEl.querySelector('#ft-link-copy').textContent = L(T.copied);
      };
    });
  }

  // ── Create team ──
  function openCreateTeam(reload) {
    var body = document.createElement('div');
    body.className = 'ft-form';
    body.innerHTML =
      '<label>' + esc(L(T.teamName)) + '</label><input type="text" id="ct-name">' +
      '<label>' + esc(L(T.description)) + '</label><textarea id="ct-desc" rows="2"></textarea>' +
      '<label class="ft-check"><input type="checkbox" id="ct-public" checked> ' + esc(L(T.publicTeam)) + '</label>' +
      '<div class="ft-actions"><button class="ft-btn ft-primary" id="ct-save">' + esc(L(T.create)) + '</button>' +
      '<button class="ft-btn ft-ghost" id="ct-cancel">' + esc(L(T.cancel)) + '</button></div>';
    var m = modal(T.createTeam, body);
    body.querySelector('#ct-cancel').onclick = m.close;
    body.querySelector('#ct-save').onclick = function () {
      var name = body.querySelector('#ct-name').value.trim();
      if (!name) { body.querySelector('#ct-name').focus(); return; }
      api('/api/teams', { method: 'POST', body: { name: name, kind: 'team', description: body.querySelector('#ct-desc').value.trim(), is_public: body.querySelector('#ct-public').checked } }).then(function (r) {
        if (!r.ok) return alert(L(T.err) + ': ' + (r.data.error || r.status));
        m.close(); reload();
      });
    };
  }

  // ── Find / join team ──
  function openFindTeam(reload) {
    var body = document.createElement('div');
    body.className = 'ft-form';
    body.innerHTML = '<input type="text" id="fd-q" placeholder="' + esc(L(T.searchPh)) + '"><div id="fd-results" style="margin-top:10px;"></div>' +
      '<div class="ft-actions"><button class="ft-btn ft-ghost" id="fd-cancel">' + esc(L(T.cancel)) + '</button></div>';
    var m = modal(T.findTeam, body);
    body.querySelector('#fd-cancel').onclick = m.close;
    var resEl = body.querySelector('#fd-results');
    var tmr = null;
    body.querySelector('#fd-q').oninput = function (e) {
      clearTimeout(tmr);
      var v = e.target.value.trim();
      if (v.length < 2) { resEl.innerHTML = ''; return; }
      tmr = setTimeout(function () {
        api('/api/teams/search?q=' + encodeURIComponent(v)).then(function (r) {
          var teams = (r.data && r.data.teams) || [];
          if (!teams.length) { resEl.innerHTML = '<div class="ft-empty">' + esc(L(T.noResults)) + '</div>'; return; }
          resEl.innerHTML = teams.map(function (t) {
            return '<div class="ft-card"><div class="ft-av">🧩</div><div class="ft-meta"><div class="ft-name">' + esc(t.name) + '</div>' +
              '<div class="ft-tags">' + (t.member_count || 0) + ' ' + esc(L(T.members)) + '</div></div>' +
              (t.is_member ? '<span class="ft-chip">' + esc(L(T.member)) + '</span>' : '<button class="ft-btn fd-join" data-tid="' + t.id + '">' + esc(L(T.join)) + '</button>') + '</div>';
          }).join('');
          resEl.querySelectorAll('.fd-join').forEach(function (b) {
            b.onclick = function () {
              b.disabled = true; b.textContent = '…';
              api('/api/teams/' + b.getAttribute('data-tid') + '/join', { method: 'POST' }).then(function (rr) {
                if (rr.ok) { b.outerHTML = '<span class="ft-chip">' + esc(L(T.joined)) + '</span>'; reload(); }
                else { alert(L(T.err) + ': ' + (rr.data.error || rr.status)); b.disabled = false; b.textContent = L(T.join); }
              });
            };
          });
        });
      }, 250);
    };
  }

  // ── Dependent path (read-only twin timeline preview) ──
  function openDependentPath(depId, name) {
    var body = document.createElement('div');
    body.innerHTML = '<p class="ft-secsub">' + esc(name || '') + '</p><div id="ft-dp-box" style="min-height:160px;"></div>';
    var m = modal(T.viewPath, body);
    var box = body.querySelector('#ft-dp-box');
    if (typeof window.mountEvolutionPath === 'function') {
      // mountEvolutionPath reads its own user; pass subject so the GET is scoped.
      box.setAttribute('data-subject', 'dependent:' + depId);
      window.mountEvolutionPath(box, { subject: 'dependent:' + depId });
    } else {
      box.innerHTML = '<div class="ft-empty">—</div>';
    }
  }

  // ── pending invite from ?join=<token> ──
  function handlePendingJoin(container) {
    var params = new URLSearchParams(location.search);
    var tk = params.get('join');
    if (!tk) return;
    api('/api/teams/join/' + encodeURIComponent(tk)).then(function (r) {
      if (!r.ok || !r.data || !r.data.valid) return;
      var body = document.createElement('div');
      body.className = 'ft-form';
      body.innerHTML = '<p>' + esc(L(T.invitedTo)) + ' <strong>' + esc(r.data.team_name) + '</strong></p>' +
        '<div class="ft-actions"><button class="ft-btn ft-primary" id="pj-accept">' + esc(L(T.joinAccept)) + '</button>' +
        '<button class="ft-btn ft-ghost" id="pj-cancel">' + esc(L(T.cancel)) + '</button></div>';
      var m = modal(T.joinAccept, body, function () { clearJoinParam(); });
      body.querySelector('#pj-cancel').onclick = m.close;
      body.querySelector('#pj-accept').onclick = function () {
        api('/api/teams/join/' + encodeURIComponent(tk), { method: 'POST' }).then(function (rr) {
          m.close(); clearJoinParam();
          if (rr.ok) mountFamilyTeam(container);
        });
      };
    });
  }
  function clearJoinParam() {
    try { var u = new URL(location.href); u.searchParams.delete('join'); history.replaceState({}, '', u.toString()); } catch (e) {}
  }

  window.mountFamilyTeam = mountFamilyTeam;
})();
