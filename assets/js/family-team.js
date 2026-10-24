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
    removeMember: { ru: 'Убрать из семьи', en: 'Remove from family', es: 'Quitar de la familia' },
    confirmRemoveMember:{ ru: 'Убрать %s из семьи?', en: 'Remove %s from the family?', es: '¿Quitar a %s de la familia?' },
    viewPath:     { ru: 'Смотреть путь', en: 'View path', es: 'Ver camino' },
    edit:         { ru: 'Изменить', en: 'Edit', es: 'Editar' },
    editChild:    { ru: 'Изменить ребёнка', en: 'Edit child', es: 'Editar hijo' },
    addChildTitle:{ ru: 'Добавить ребёнка', en: 'Add a child', es: 'Añadir un hijo' },
    born:         { ru: 'Родился', en: 'Born', es: 'Nacido' },
    bornStatus:   { ru: 'Статус', en: 'Status', es: 'Estado' },
    years:        { ru: 'лет', en: 'y.o.', es: 'años' },
    weeksPregnant:{ ru: 'недель беременности', en: 'weeks pregnant', es: 'semanas de embarazo' },
    dueIn:        { ru: 'до родов', en: 'until due', es: 'hasta el parto' },
    days:         { ru: 'дн.', en: 'days', es: 'días' },
    childPathSub: { ru: 'Личная линия развития ребёнка', en: 'The child’s personal evolution line', es: 'La línea de evolución del niño' },
    noEventsYet:  { ru: 'Событий пока нет — они появятся, когда вы начнёте отмечать состояния для ребёнка.', en: 'No events yet — they appear once you start logging states for the child.', es: 'Aún no hay eventos — aparecerán cuando empieces a registrar estados.' },
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
  // gestational age as { weeks, days } (more precise than the rounded week count)
  function gestationWD(dueIso) {
    if (!dueIso) return null;
    var due = new Date(dueIso).getTime();
    if (isNaN(due)) return null;
    var totalDays = Math.max(0, Math.min(294, Math.round(280 - (due - Date.now()) / 864e5)));
    return { weeks: Math.floor(totalDays / 7), days: totalDays % 7, totalDays: totalDays };
  }
  // human one-liner for a dependent card: "32 weeks pregnant" / "4 y.o. · Child"
  function depSummary(d) {
    if (d.phase === 'prenatal') {
      var wd = gestationWD(d.expected_due_date);
      var w = wd ? wd.weeks : (d.gestation_weeks != null ? d.gestation_weeks : null);
      return (w != null) ? (w + ' ' + L(T.weeksPregnant)) : L(T.phase.prenatal);
    }
    var phaseLbl = L(T.phase[d.phase] || T.phase.unknown);
    if (d.age_years != null) return d.age_years + ' ' + L(T.years) + ' · ' + phaseLbl;
    return phaseLbl;
  }
  // pregnancy milestone copy by week (kept short; shown in the path view)
  function pregMilestone(weeks) {
    var M = [
      { w: 0,  ru: 'Зачатие и имплантация', en: 'Conception & implantation', es: 'Concepción e implantación' },
      { w: 8,  ru: 'Формируются органы и черты лица', en: 'Organs and facial features form', es: 'Se forman órganos y rasgos' },
      { w: 12, ru: 'Конец первого триместра', en: 'End of the first trimester', es: 'Fin del primer trimestre' },
      { w: 18, ru: 'Появляются первые шевеления', en: 'First movements felt', es: 'Primeros movimientos' },
      { w: 24, ru: 'Порог жизнеспособности', en: 'Viability threshold', es: 'Umbral de viabilidad' },
      { w: 28, ru: 'Третий триместр, открываются глаза', en: 'Third trimester, eyes open', es: 'Tercer trimestre, ojos abiertos' },
      { w: 37, ru: 'Доношенная беременность', en: 'Full term', es: 'A término' }
    ];
    var pick = M[0];
    for (var i = 0; i < M.length; i++) { if (weeks >= M[i].w) pick = M[i]; }
    return L({ ru: pick.ru, en: pick.en, es: pick.es });
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
      '.ft-linkbox{display:flex;gap:8px;margin-top:10px;}.ft-linkbox input{flex:1;}',
      // dependent card: clickable meta + small action buttons
      '.ft-card .ft-meta.ft-clickable{cursor:pointer;}',
      '.ft-card .ft-meta.ft-clickable:hover .ft-name{color:var(--accent-cyan);}',
      '.ft-iconbtn{background:transparent;border:1px solid var(--glass-border,rgba(255,255,255,0.12));color:var(--text-muted);border-radius:9px;padding:6px 9px;font-size:13px;cursor:pointer;flex:0 0 auto;line-height:1;transition:all .15s;}',
      '.ft-iconbtn:hover{color:var(--accent-cyan);border-color:rgba(0,224,255,0.4);background:rgba(0,224,255,0.08);}',
      '.ft-iconbtn.ft-danger{color:var(--accent-rose,#ff6b8b);border-color:rgba(255,107,139,0.3);}',
      '.ft-iconbtn.ft-danger:hover{background:rgba(255,107,139,0.12);}',
      // born-status radio row
      '.ft-form .ft-radio{display:flex;gap:16px;margin-top:6px;}',
      '.ft-form .ft-radio label{display:flex;align-items:center;gap:6px;margin:0;font-size:13px;color:var(--text,#e8f0f4);cursor:pointer;}',
      '.ft-form .ft-radio input{width:auto;}',
      // wide path modal + pregnancy strip
      '.ft-modal.ft-modal-wide{max-width:1000px;}',
      '@media(max-width:1040px){.ft-modal.ft-modal-wide{max-width:96vw;}}',
      '.ft-path-head{display:flex;align-items:center;gap:12px;margin:0 0 10px;}',
      '.ft-path-head .ft-av{width:46px;height:46px;font-size:22px;}',
      '.ft-preg{background:rgba(0,224,255,0.06);border:1px solid var(--glass-border,rgba(255,255,255,0.08));border-radius:12px;padding:12px 14px;margin:0 0 12px;}',
      '.ft-preg .ft-preg-top{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;color:var(--text-muted);}',
      '.ft-preg .ft-preg-week{font-size:20px;font-weight:700;color:var(--text,#e8f0f4);}',
      '.ft-preg-bar{height:8px;border-radius:999px;background:rgba(255,255,255,0.08);margin:9px 0 6px;overflow:hidden;}',
      '.ft-preg-bar>span{display:block;height:100%;background:linear-gradient(90deg,#56F2A6,#00e0ff);border-radius:999px;}',
      '.ft-preg-milestone{font-size:12px;color:var(--accent-cyan);}',
      '.ft-path-box{min-height:300px;}'
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
      var primary = families[0];
      // load the primary family's adult members (invited users) so they show as cards
      var memProm = primary ? api('/api/teams/' + primary.id) : Promise.resolve({ data: {} });
      memProm.then(function (mr) {
        var members = (mr.data && mr.data.members) || [];
        render(container, { families: families, teams: workTeams, dependents: deps, members: members });
        handlePendingJoin(container);
      });
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
      // adult members (invited platform users) — shown with their kin role. The
      // caller themselves appears here too (they're a member of their own family),
      // tagged "(you)" so it doesn't read as a separate person.
      var roleLbl = function (rv) { var r = ROLES.filter(function (x) { return x.v === rv; })[0]; return r ? L(r.o) : (rv || L(T.member)); };
      var meId = (typeof window.currentUser !== 'undefined' && window.currentUser) ? String(window.currentUser.id) : null;
      var youLbl = L({ ru: 'вы', en: 'you', es: 'tú' });
      // PR94 (#3): show ✕ Remove on EVERY adult member card except the caller's own.
      // PR93 gated this on detecting structural ownership (owner_user_id === meId),
      // but that silently failed whenever ownership couldn't be resolved — a legacy
      // family whose owner_user_id is someone else, or currentUser not yet loaded —
      // so Tahir never saw the button. The DELETE endpoint enforces the real
      // permission (owner, or any family member removing a non-owner); the button is
      // just an affordance, so showing it broadly is safe and clears legacy "сын"
      // cards regardless of who structurally owns the family.
      // A self card never gets Remove (you can't remove yourself — you'd lose the
      // family from your list); its kin-role tag is suppressed so a broken self row
      // ("you" tagged as 'сын') doesn't masquerade as a separate person.
      (state.members || []).forEach(function (mem) {
        var isMe = meId && String(mem.id) === meId;
        var roleTag = isMe ? '' : esc(roleLbl(mem.role));
        html += '<div class="ft-card">' +
                '<div class="ft-av">🧑</div>' +
                '<div class="ft-meta"><div class="ft-name">' + esc(mem.display_name || mem.email || '—') + (isMe ? ' <span class="ft-chip">' + esc(youLbl) + '</span>' : '') + '</div>' +
                '<div class="ft-tags">' + roleTag + '</div></div>' +
                (!isMe
                  ? '<button class="ft-iconbtn ft-danger ft-del-mem" data-mid="' + esc(String(mem.id)) + '" data-name="' + esc(mem.display_name || mem.email || '') + '" title="' + esc(L(T.removeMember)) + '">✕</button>'
                  : '') +
                '</div>';
      });
      // dependents
      if (!state.dependents.length) {
        html += '<div class="ft-empty">' + esc(L(T.noChildren)) + '</div>';
      } else {
        state.dependents.forEach(function (d) {
          var sub = depSummary(d);
          var emoji = d.phase === 'prenatal' ? '🤰' : (d.sex === 'female' ? '👧' : d.sex === 'male' ? '👦' : '🧒');
          var diagN = Array.isArray(d.diagnoses_ids) ? d.diagnoses_ids.length : 0;
          html += '<div class="ft-card" data-dep="' + d.id + '">' +
                  '<div class="ft-av">' + emoji + '</div>' +
                  '<div class="ft-meta ft-clickable ft-dep-open" data-dep="' + d.id + '" title="' + esc(L(T.viewPath)) + '"><div class="ft-name">' + esc(d.name) + '</div>' +
                  '<div class="ft-tags">' + esc(sub) + (diagN ? ' · ' + diagN + ' ' + esc(L(T.diagnoses).toLowerCase()) : '') + '</div></div>' +
                  '<button class="ft-iconbtn ft-view-path" data-dep="' + d.id + '" data-name="' + esc(d.name) + '" title="' + esc(L(T.viewPath)) + '">📈</button>' +
                  '<button class="ft-iconbtn ft-edit-dep" data-dep="' + d.id + '" title="' + esc(L(T.edit)) + '">✎</button>' +
                  '<button class="ft-iconbtn ft-danger ft-del-dep" data-dep="' + d.id + '" title="' + esc(L(T.confirmDelete)) + '">✕</button>' +
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

    var depById = {};
    (state.dependents || []).forEach(function (d) { depById[String(d.id)] = d; });

    container.querySelectorAll('.ft-del-dep').forEach(function (b) {
      b.onclick = function () {
        if (!confirm(L(T.confirmDelete))) return;
        api('/api/dependents/' + b.getAttribute('data-dep'), { method: 'DELETE' }).then(reload);
      };
    });
    // PR93: owner removes a legacy adult member (team_members row).
    container.querySelectorAll('.ft-del-mem').forEach(function (b) {
      b.onclick = function () {
        if (!fam) return;
        var nm = b.getAttribute('data-name') || '';
        if (!confirm(L(T.confirmRemoveMember).replace('%s', nm))) return;
        api('/api/teams/' + fam.id + '/members/' + b.getAttribute('data-mid'), { method: 'DELETE' })
          .then(reload)
          .catch(function (e) { alert((L(T.err) || 'Error') + ': ' + (e && e.message || e)); });
      };
    });
    container.querySelectorAll('.ft-view-path, .ft-dep-open').forEach(function (b) {
      b.onclick = function () {
        var d = depById[String(b.getAttribute('data-dep'))];
        openDependentPath(b.getAttribute('data-dep'), d ? d.name : b.getAttribute('data-name'), d);
      };
    });
    container.querySelectorAll('.ft-edit-dep').forEach(function (b) {
      b.onclick = function () {
        var d = depById[String(b.getAttribute('data-dep'))];
        if (d) openAddChild(fam, reload, d);
      };
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
  // Adults only — children belong in the dependent flow (+ Add child), so we drop
  // son/daughter/grandchild here to stop people creating a "child" as a member
  // card (which shows the owner's name, no DOB/diagnoses).
  function roleOptionsAdult(sel) {
    var skip = { son: 1, daughter: 1, grandchild: 1 };
    return ROLES.filter(function (r) { return !skip[r.v]; })
      .map(function (r) { return '<option value="' + r.v + '"' + (r.v === sel ? ' selected' : '') + '>' + esc(L(r.o)) + '</option>'; }).join('');
  }

  // ── Add / edit child (dependent) — a standalone form, NOT the relationship
  // picker (that's Add family member). `existing` switches the form to edit mode
  // (prefill + PATCH). For a child we collect name / sex / born-status / DOB|due /
  // diagnoses / track-from — every field is shown and never auto-filled with the
  // owner's name. ──
  function openAddChild(fam, reload, existing) {
    var isEdit = !!(existing && existing.id);
    var body = document.createElement('div');
    body.className = 'ft-form';
    var today = new Date().toISOString().slice(0, 10);
    // prefill values (edit) / sensible defaults (create)
    var pName = isEdit ? (existing.name || '') : '';
    var pSex = isEdit ? (existing.sex || 'other') : 'male';
    var pRel = isEdit ? (existing.relation || 'son') : 'son';
    var notBornInit = isEdit ? (!existing.birth_date && !!existing.expected_due_date) : false;
    var pDob = (isEdit && existing.birth_date) ? String(existing.birth_date).slice(0, 10) : today;
    var pDue = (isEdit && existing.expected_due_date) ? String(existing.expected_due_date).slice(0, 10) : '';
    var pTrack = (isEdit && existing.track_from) ? String(existing.track_from).slice(0, 10) : today;
    var selOpt = function (v, cur) { return v === cur ? ' selected' : ''; };
    body.innerHTML =
      '<label>' + esc(L(T.name)) + '</label><input type="text" id="ac-name" value="' + esc(pName) + '" placeholder="' + esc(L({ru:'Имя ребёнка',en:'Child’s name',es:'Nombre del niño'})) + '">' +
      '<div class="ft-row"><div><label>' + esc(L(T.sex)) + '</label><select id="ac-sex">' +
        '<option value="male"' + selOpt('male', pSex) + '>' + esc(L(T.male)) + '</option><option value="female"' + selOpt('female', pSex) + '>' + esc(L(T.female)) + '</option><option value="other"' + selOpt('other', pSex) + '>' + esc(L(T.other)) + '</option></select></div>' +
        '<div><label>' + esc(L(T.relation)) + '</label><select id="ac-rel"><option value="son"' + selOpt('son', pRel) + '>' + esc(L({ru:'Сын',en:'Son',es:'Hijo'})) + '</option><option value="daughter"' + selOpt('daughter', pRel) + '>' + esc(L({ru:'Дочь',en:'Daughter',es:'Hija'})) + '</option><option value="grandchild"' + selOpt('grandchild', pRel) + '>' + esc(L({ru:'Внук/внучка',en:'Grandchild',es:'Nieto/a'})) + '</option><option value="other"' + selOpt('other', pRel) + '>' + esc(L(T.other)) + '</option></select></div></div>' +
      '<label>' + esc(L(T.bornStatus)) + '</label><div class="ft-radio">' +
        '<label><input type="radio" name="ac-born" value="born"' + (notBornInit ? '' : ' checked') + '> ' + esc(L(T.born)) + '</label>' +
        '<label><input type="radio" name="ac-born" value="unborn"' + (notBornInit ? ' checked' : '') + '> ' + esc(L(T.notBorn)) + '</label></div>' +
      '<div id="ac-dob-wrap"><label>' + esc(L(T.dob)) + '</label><input type="date" id="ac-dob" max="' + today + '" value="' + esc(pDob) + '"></div>' +
      '<div id="ac-due-wrap" style="display:none;"><label>' + esc(L(T.dueDate)) + '</label><input type="date" id="ac-due" value="' + esc(pDue) + '"><div class="ft-note" id="ac-gest"></div></div>' +
      '<label>' + esc(L(T.diagnoses)) + '</label><div class="ft-secsub" style="margin:0;">' + esc(L(T.diagnosesHint)) + '</div>' +
      '<input type="text" id="ac-diag-search" placeholder="🔍" style="margin-top:6px;"><div class="ft-diag-list" id="ac-diag-list"></div>' +
      '<label>' + esc(L(T.trackFrom)) + '</label><input type="date" id="ac-track" value="' + esc(pTrack) + '">' +
      '<div class="ft-actions"><button class="ft-btn ft-primary" id="ac-save">' + esc(L(T.save)) + '</button>' +
      '<button class="ft-btn ft-ghost" id="ac-cancel">' + esc(L(T.cancel)) + '</button></div>';
    var m = modal(isEdit ? T.editChild : T.addChildTitle, body);
    var bornRadios = body.querySelectorAll('input[name="ac-born"]');
    var dobWrap = body.querySelector('#ac-dob-wrap'), dueWrap = body.querySelector('#ac-due-wrap');
    var dueInput = body.querySelector('#ac-due'), gestNote = body.querySelector('#ac-gest'), trackInput = body.querySelector('#ac-track');
    function isNotBorn() { return body.querySelector('input[name="ac-born"]:checked').value === 'unborn'; }
    function updateGest() {
      var w = gestationWeeks(dueInput.value);
      gestNote.textContent = (w != null) ? (L(T.gestation) + ': ~' + w + ' ' + L(T.weeks)) : '';
    }
    function syncBorn() {
      var nb = isNotBorn();
      dobWrap.style.display = nb ? 'none' : '';
      dueWrap.style.display = nb ? '' : 'none';
      if (nb && !dueInput.value) { var d = new Date(Date.now() + 140 * 864e5); dueInput.value = d.toISOString().slice(0, 10); }
      if (nb) updateGest();
    }
    bornRadios.forEach(function (r) { r.onchange = syncBorn; });
    dueInput.oninput = updateGest;
    syncBorn();

    // diagnoses (lazy load condition library); prefill selected in edit mode
    var selected = {};
    if (isEdit && Array.isArray(existing.diagnoses_ids)) existing.diagnoses_ids.forEach(function (id) { selected[id] = 1; });
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
    var saveBtn = body.querySelector('#ac-save');
    saveBtn.onclick = function () {
      var name = body.querySelector('#ac-name').value.trim();
      if (!name) { body.querySelector('#ac-name').focus(); return; }
      var nb = isNotBorn();
      var payload = {
        name: name,
        sex: body.querySelector('#ac-sex').value,
        relation: body.querySelector('#ac-rel').value,
        track_from: trackInput.value || null,
        diagnoses_ids: Object.keys(selected).map(Number)
      };
      // exactly one of birth_date / expected_due_date is set; null the other so an
      // edit that flips born-status clears the stale field server-side.
      if (nb) { payload.expected_due_date = dueInput.value || null; payload.birth_date = null; }
      else { payload.birth_date = body.querySelector('#ac-dob').value || null; payload.expected_due_date = null; }
      if (!payload.birth_date && !payload.expected_due_date) {
        (nb ? dueInput : body.querySelector('#ac-dob')).focus(); return;
      }
      if (!isEdit) payload.family_id = fam ? fam.id : null;
      saveBtn.disabled = true;
      var req = isEdit
        ? api('/api/dependents/' + existing.id, { method: 'PATCH', body: payload })
        : api('/api/dependents', { method: 'POST', body: payload });
      req.then(function (r) {
        saveBtn.disabled = false;
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
      '<p class="ft-secsub" style="margin:0 0 4px;">' + esc(L({ ru: 'Для взрослых. Чтобы добавить ребёнка — «+ Добавить ребёнка».', en: 'For adults. To add a child use “+ Add child”.', es: 'Para adultos. Para un hijo usa «+ Añadir hijo».' })) + '</p>' +
      '<label>' + esc(L(T.email)) + '</label><input type="email" id="am-email" placeholder="name@example.com">' +
      '<label>' + esc(L(T.relation)) + '</label><select id="am-role">' + roleOptionsAdult('partner') + '</select>' +
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
      '<label>' + esc(L(T.relation)) + '</label><select id="iv-role">' + roleOptionsAdult('partner') + '</select>' +
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

  // ── Dependent path — the child's own single timeline. Opens a wide modal with
  // the same spine visualisation as the Personal Path, scoped via
  // ?subject=dependent:<id>. For a not-yet-born child we add a pregnancy header
  // (current term + progress + week milestone) above the (initially empty) line. ──
  function openDependentPath(depId, name, dep) {
    var emoji = dep && dep.phase === 'prenatal' ? '🤰' : (dep && dep.sex === 'female' ? '👧' : dep && dep.sex === 'male' ? '👦' : '🧒');
    var body = document.createElement('div');
    var head = '<div class="ft-path-head"><div class="ft-av">' + emoji + '</div>' +
               '<div><div class="ft-name" style="font-size:16px;">' + esc(name || '') + '</div>' +
               '<div class="ft-secsub" style="margin:0;">' + esc(dep ? depSummary(dep) : '') + ' · ' + esc(L(T.childPathSub)) + '</div></div></div>';
    var pregHtml = '';
    if (dep && dep.phase === 'prenatal') {
      var wd = gestationWD(dep.expected_due_date);
      var w = wd ? wd.weeks : (dep.gestation_weeks || 0);
      var dd = wd ? wd.days : 0;
      var pct = Math.max(0, Math.min(100, Math.round(((wd ? wd.totalDays : w * 7) / 280) * 100)));
      var daysLeft = Math.max(0, Math.round((new Date(dep.expected_due_date).getTime() - Date.now()) / 864e5));
      pregHtml = '<div class="ft-preg"><div class="ft-preg-top">' +
        '<span><span class="ft-preg-week">' + w + '</span> ' + esc(L(T.weeks)) + (dd ? ' ' + dd + ' ' + esc(L(T.days)) : '') + '</span>' +
        '<span>' + daysLeft + ' ' + esc(L(T.days)) + ' ' + esc(L(T.dueIn)) + '</span></div>' +
        '<div class="ft-preg-bar"><span style="width:' + pct + '%"></span></div>' +
        '<div class="ft-preg-milestone">📍 ' + esc(pregMilestone(w)) + '</div></div>';
    }
    body.innerHTML = head + pregHtml + '<div class="ft-path-box" id="ft-dp-box"></div>';
    var m = modal(T.viewPath, body);
    m.box.classList.add('ft-modal-wide');
    var box = body.querySelector('#ft-dp-box');
    if (typeof window.mountEvolutionPath === 'function') {
      // mountEvolutionPath reads its own user; pass subject so the GET is scoped to
      // the dependent's journey_events (owner-gated server-side).
      box.setAttribute('data-subject', 'dependent:' + depId);
      window.mountEvolutionPath(box, { subject: 'dependent:' + depId, lang: lang(), mode: 'layers', alwaysStructure: true });
    } else {
      box.innerHTML = '<div class="ft-empty">' + esc(L(T.noEventsYet)) + '</div>';
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
