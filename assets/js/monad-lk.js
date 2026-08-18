/**
 * Monad LK tab — multi-chat (Claude-like) + vertical/horizontal + rhythm.
 * Chats persist in our DB; outbound messages plant_seed into Monad with chat tags.
 * Inbound replies: poll shared_context key_prefix neuroattention.lk.chat.<id>.
 */
(function () {
  'use strict';

  var STATE = {
    loaded: false,
    status: null,
    arch: null,
    rhythm: null,
    sub: 'chat',
    chats: [],
    activeChatId: null,
    messages: [],
    pendingAttachments: [],
    pollTimer: null,
    showTech: false,
    vertLayer: null,
    vertCell: null,
    horizHour: null,
    pickedAgent: null,
    liveRhythm: false,
    rhythmTimer: null,
    rhythmRaf: null,
    rhythmDisplay: [],
  };

  function t(key, fallback) {
    try { if (typeof window.t === 'function') return window.t(key, fallback); } catch (e) {}
    return fallback || key;
  }
  function apiBase() {
    return window.AUTH_API || window.API_BASE || 'https://neuroattention-api-production.up.railway.app';
  }
  function token() {
    if (typeof window.naGetToken === 'function') return window.naGetToken();
    try { return localStorage.getItem('na_token'); } catch (e) { return null; }
  }
  function authHeaders(json) {
    var tok = token();
    var h = { Accept: 'application/json' };
    if (json !== false) h['Content-Type'] = 'application/json';
    if (tok) h.Authorization = 'Bearer ' + tok;
    return h;
  }
  function isMonadRole(user) {
    if (!user) return false;
    if (user.monad_tab === true || user.monad_access === true) return true;
    var r = user.serverRole || user.role;
    return r === 'superadmin' || r === 'founder';
  }
  function showTabButton(user) {
    var btn = document.getElementById('tab-btn-monad');
    if (!btn) return;
    btn.style.display = isMonadRole(user) ? '' : 'none';
  }
  async function api(path, opts) {
    var res = await fetch(apiBase() + path, Object.assign({ headers: authHeaders() }, opts || {}));
    var data = null;
    try { data = await res.json(); } catch (e) { data = { error: 'Bad JSON' }; }
    if (!res.ok) {
      var err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status; err.data = data; throw err;
    }
    return data;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setSub(id) {
    STATE.sub = id;
    document.querySelectorAll('.monad-subtab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-monad-sub') === id);
    });
    document.querySelectorAll('.monad-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'monad-panel-' + id);
    });
    if (id === 'vertical' || id === 'horizontal') ensureArchitecture();
    if (id === 'rhythm') ensureRhythm();
    else stopLiveRhythm();
    if (id === 'chat') startPoll();
    else stopPoll();
  }

  function renderStatusBar() {
    var el = document.getElementById('monad-status-bar');
    if (!el) return;
    var s = STATE.status;
    if (!s) {
      el.innerHTML = '<span class="monad-muted">' + esc(t('a.monad.loading', 'Загрузка…')) + '</span>';
      return;
    }
    var bits = [];
    bits.push('<strong>' + esc(t('a.monad.you', 'Ты в Monad')) + ':</strong> ' + esc(s.human_id || '—'));
    bits.push(s.configured
      ? '<span class="monad-ok">● ' + esc(t('a.monad.connected', 'ключ на сервере есть')) + '</span>'
      : '<span class="monad-warn">● ' + esc(t('a.monad.need_key', 'нужен MONAD_API_KEY на Railway')) + '</span>');
    if (s.lk_llm) {
      bits.push('<span class="monad-ok">● ' + esc(t('a.monad.live_model', 'живая модель')) + '</span>');
    } else if (s.lk_live_reply) {
      bits.push('<span class="monad-warn">● ' + esc(t('a.monad.no_model', 'Persona без модели — нужен ключ LLM на API')) + '</span>');
    }
    if (s.dashboard_url) {
      bits.push('<a href="' + esc(s.dashboard_url) + '" target="_blank" rel="noopener">' + esc(t('a.monad.dashboard', 'Dashboard Monad')) + '</a>');
    }
    if (s.note) bits.push('<span class="monad-muted">' + esc(s.note) + '</span>');
    el.innerHTML = bits.join(' · ');
  }

  function renderChatList() {
    var host = document.getElementById('monad-chat-list');
    if (!host) return;
    if (!STATE.chats.length) {
      host.innerHTML = '<p class="monad-muted" style="padding:0.5rem;">' +
        esc(t('a.monad.no_chats', 'Пока нет чатов. Создай задачу слева сверху.')) + '</p>';
      return;
    }
    host.innerHTML = STATE.chats.map(function (c) {
      var active = c.id === STATE.activeChatId ? ' active' : '';
      var preview = (c.last_text || '').slice(0, 60);
      return '<div class="monad-chat-row' + active + '" data-chat-id="' + esc(c.id) + '">' +
        '<button type="button" class="monad-chat-item' + active + '" data-chat-id="' + esc(c.id) + '">' +
        '<div class="monad-chat-item-title">' + esc(c.title || t('a.monad.new_chat', 'Новый чат')) + '</div>' +
        (preview ? '<div class="monad-chat-item-prev">' + esc(preview) + '</div>' : '') +
        '</button>' +
        '<div class="monad-chat-item-actions">' +
        '<button type="button" class="monad-chat-ico" data-rename="' + esc(c.id) + '" title="' + esc(t('a.monad.rename', 'Переименовать')) + '">✎</button>' +
        '<button type="button" class="monad-chat-ico danger" data-del="' + esc(c.id) + '" title="' + esc(t('a.monad.delete', 'Удалить')) + '">×</button>' +
        '</div></div>';
    }).join('');
    host.querySelectorAll('.monad-chat-item').forEach(function (b) {
      b.addEventListener('click', function () { openChat(b.getAttribute('data-chat-id')); });
    });
    host.querySelectorAll('[data-rename]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        renameChat(b.getAttribute('data-rename'));
      });
    });
    host.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteChat(b.getAttribute('data-del'));
      });
    });
  }

  function renderPinned() {
    var host = document.getElementById('monad-pinned');
    if (!host) return;
    var chat = STATE.chats.filter(function (c) { return c.id === STATE.activeChatId; })[0];
    var pins = (chat && chat.pinned_context) || [];
    if (!Array.isArray(pins)) {
      try { pins = JSON.parse(pins); } catch (e) { pins = []; }
    }
    if (!pins.length) {
      host.innerHTML = '<span class="monad-muted">' + esc(t('a.monad.no_pins', 'Нет прикреплённого контекста')) + '</span>';
      return;
    }
    host.innerHTML = pins.map(function (p, i) {
      return '<span class="monad-pin-chip" title="' + esc(p.text || p.body || '') + '">' +
        esc(p.title || p.label || ('#' + (i + 1))) +
        '<button type="button" data-pin-i="' + i + '" aria-label="remove">×</button></span>';
    }).join('');
    host.querySelectorAll('[data-pin-i]').forEach(function (b) {
      b.addEventListener('click', function () { removePin(parseInt(b.getAttribute('data-pin-i'), 10)); });
    });
  }

  function renderAttachmentsBar() {
    var host = document.getElementById('monad-attach-bar');
    if (!host) return;
    if (!STATE.pendingAttachments.length) { host.innerHTML = ''; return; }
    host.innerHTML = STATE.pendingAttachments.map(function (a, i) {
      return '<span class="monad-attach-chip">' + esc(a.name || 'file') +
        '<button type="button" data-att-i="' + i + '">×</button></span>';
    }).join('');
    host.querySelectorAll('[data-att-i]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.pendingAttachments.splice(parseInt(b.getAttribute('data-att-i'), 10), 1);
        renderAttachmentsBar();
      });
    });
  }

  function parseMeta(m) {
    var meta = m && m.meta;
    if (!meta) return {};
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch (e) { return {}; }
    }
    return meta && typeof meta === 'object' ? meta : {};
  }

  function stripTechIds(text) {
    return String(text || '')
      .replace(/\bseed[=:][\w\-]+/gi, '')
      .replace(/\bhandoff[=:][\w\-]+/gi, '')
      .replace(/\bshared_context\b/gi, '')
      .replace(/см\.\s*docs\/[^\s)]+/gi, '')
      .replace(/\s*[·•]\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function isTechMessage(m) {
    var meta = parseMeta(m);
    if (meta.ack || meta.delivery || meta.channel_ack) return true;
    if (m.role === 'system') return true;
    var raw = String(m.text || '');
    if (/docs\/MONAD|shared_context|Семя посажено|Канал ЛК живой|Отправлено Манаде|Ждём ответ|Ждем ответ|ответ появится/i.test(raw)) return true;
    var cleaned = stripTechIds(raw);
    if (!cleaned && /seed=|handoff=/i.test(raw)) return true;
    if (/^принял\.?\s*канал/i.test(cleaned)) return true;
    return false;
  }

  function displayText(m) {
    return stripTechIds(m.text) || String(m.text || '');
  }

  function techDetails(m) {
    var meta = parseMeta(m);
    var bits = [];
    if (m.seed_id) bits.push('seed=' + m.seed_id);
    if (meta.seed_id && meta.seed_id !== m.seed_id) bits.push('seed=' + meta.seed_id);
    if (meta.handoff_id) bits.push('handoff=' + meta.handoff_id);
    if (meta.source_key) bits.push('key=' + meta.source_key);
    if (meta.via) bits.push('via=' + meta.via);
    if (meta.to_agent) bits.push('to=' + meta.to_agent);
    if (meta.persona) bits.push('persona=' + meta.persona);
    var raw = String(m.text || '');
    var shown = displayText(m);
    if (raw && raw !== shown) bits.push(raw.slice(0, 280));
    return bits.join(' · ');
  }

  function renderMessages() {
    var box = document.getElementById('monad-chat-log');
    if (!box) return;
    if (!STATE.activeChatId) {
      box.innerHTML = '<p class="monad-muted">' + esc(t('a.monad.pick_chat', 'Выбери или создай чат слева.')) + '</p>';
      return;
    }
    if (!STATE.messages.length) {
      box.innerHTML = '<p class="monad-muted">' + esc(t('a.monad.empty_thread', 'Напиши первое сообщение в эту задачу.')) + '</p>';
      return;
    }

    var visible = [];
    var hiddenTech = [];
    var lastVis = null;
    STATE.messages.forEach(function (m, idx) {
      if (isTechMessage(m)) { hiddenTech.push({ m: m, idx: idx }); return; }
      var body = displayText(m);
      if (lastVis && lastVis.role === m.role && displayText(lastVis) === body && (m.role === 'monad' || m.role === 'system')) return;
      lastVis = m;
      visible.push({ m: m, idx: idx });
    });

    if (!visible.length && !STATE.showTech) {
      box.innerHTML = '<p class="monad-muted">' + esc(t('a.monad.waiting_quiet', 'Монада думает… Ответ появится здесь.')) + '</p>' +
        (hiddenTech.length
          ? '<p class="monad-muted" style="font-size:11px;"><button type="button" class="btn btn-ghost" id="monad-show-tech" style="font-size:11px;padding:0.2rem 0.5rem;">' +
            esc(t('a.monad.show_tech', 'Служебные сообщения')) + ' (' + hiddenTech.length + ')</button></p>'
          : '');
      var btn0 = document.getElementById('monad-show-tech');
      if (btn0) btn0.addEventListener('click', function () { STATE.showTech = true; renderMessages(); });
      return;
    }

    var html = visible.map(function (row) {
      var m = row.m;
      var atts = m.attachments || [];
      if (typeof atts === 'string') { try { atts = JSON.parse(atts); } catch (e) { atts = []; } }
      var attHtml = '';
      if (atts && atts.length) {
        attHtml = '<div class="monad-msg-atts">' + atts.map(function (a) {
          var url = a.url || a.href || '';
          var name = a.name || a.filename || 'file';
          var isImg = /^image\//.test(a.mime || '') || /\.(png|jpe?g|gif|webp)$/i.test(name);
          if (isImg && url) return '<a href="' + esc(url) + '" target="_blank" rel="noopener"><img class="monad-msg-img" src="' + esc(url) + '" alt="' + esc(name) + '"/></a>';
          return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(name) + '</a>';
        }).join(' ') + '</div>';
      }
      var details = STATE.showTech ? techDetails(m) : '';
      var techToggle = details
        ? ('<details class="monad-tech"><summary>' + esc(t('a.monad.tech_details', 'Тех. детали')) + '</summary>' +
          '<div class="monad-msg-meta">' + esc(details) + '</div></details>')
        : '';
      return '<div class="monad-msg monad-msg-' + esc(m.role || 'monad') + '" data-msg-i="' + row.idx + '">' +
        '<div class="monad-msg-body">' + esc(displayText(m)) + '</div>' + attHtml + techToggle +
        '</div>';
    }).join('');

    if (hiddenTech.length) {
      html += '<div class="monad-tech-bar">' +
        '<button type="button" class="btn btn-ghost" id="monad-toggle-tech" style="font-size:11px;padding:0.2rem 0.5rem;">' +
        (STATE.showTech
          ? esc(t('a.monad.hide_tech', 'Скрыть служебные'))
          : esc(t('a.monad.show_tech', 'Служебные сообщения')) + ' (' + hiddenTech.length + ')') +
        '</button></div>';
    }
    if (STATE.showTech && hiddenTech.length) {
      html += hiddenTech.map(function (row) {
        var m = row.m;
        return '<div class="monad-msg monad-msg-system monad-msg-tech" data-msg-i="' + row.idx + '">' +
          '<div class="monad-msg-body">' + esc(stripTechIds(m.text) || m.text || '') + '</div>' +
          '<div class="monad-msg-meta">' + esc(techDetails(m)) + '</div></div>';
      }).join('');
    }

    box.innerHTML = html;
    var btn = document.getElementById('monad-toggle-tech');
    if (btn) btn.addEventListener('click', function () { STATE.showTech = !STATE.showTech; renderMessages(); });
    box.scrollTop = box.scrollHeight;
  }

  async function loadChats() {
    var data = await api('/api/monad/chats');
    STATE.chats = data.chats || [];
    renderChatList();
    if (!STATE.activeChatId && STATE.chats.length) {
      await openChat(STATE.chats[0].id);
    } else if (STATE.activeChatId) {
      renderPinned();
    } else {
      renderMessages();
      renderPinned();
    }
  }

  async function createChat() {
    var title = t('a.monad.new_chat', 'Новый чат');
    var data = await api('/api/monad/chats', { method: 'POST', body: JSON.stringify({ title: title }) });
    STATE.chats.unshift(data.chat);
    renderChatList();
    await openChat(data.chat.id);
  }

  async function renameChat(id) {
    var chat = STATE.chats.filter(function (c) { return c.id === id; })[0];
    if (!chat) return;
    var next = window.prompt(t('a.monad.rename_prompt', 'Новое имя чата'), chat.title || '');
    if (next == null) return;
    next = String(next).trim().slice(0, 120);
    if (!next) return;
    try {
      var data = await api('/api/monad/chats/' + encodeURIComponent(id), {
        method: 'PATCH', body: JSON.stringify({ title: next }),
      });
      STATE.chats = STATE.chats.map(function (c) { return c.id === id ? Object.assign({}, c, data.chat) : c; });
      renderChatList();
    } catch (e) { alert(e.message); }
  }

  async function deleteChat(id) {
    if (!id) return;
    if (!window.confirm(t('a.monad.delete_q', 'Удалить этот чат безвозвратно?'))) return;
    try {
      await api('/api/monad/chats/' + encodeURIComponent(id), { method: 'DELETE' });
      STATE.chats = STATE.chats.filter(function (c) { return c.id !== id; });
      if (STATE.activeChatId === id) {
        STATE.activeChatId = STATE.chats[0] ? STATE.chats[0].id : null;
        STATE.messages = [];
        if (STATE.activeChatId) await openChat(STATE.activeChatId);
        else { renderMessages(); renderPinned(); }
      }
      renderChatList();
    } catch (e) { alert(e.message); }
  }

  async function openChat(id) {
    STATE.activeChatId = id;
    STATE.pendingAttachments = [];
    renderAttachmentsBar();
    renderChatList();
    var data = await api('/api/monad/chats/' + encodeURIComponent(id));
    // refresh chat object (pins)
    STATE.chats = STATE.chats.map(function (c) { return c.id === id ? Object.assign({}, c, data.chat) : c; });
    if (!STATE.chats.filter(function (c) { return c.id === id; }).length && data.chat) STATE.chats.unshift(data.chat);
    STATE.messages = data.messages || [];
    renderMessages();
    renderPinned();
    startPoll();
  }

  async function removePin(i) {
    var chat = STATE.chats.filter(function (c) { return c.id === STATE.activeChatId; })[0];
    if (!chat) return;
    var pins = Array.isArray(chat.pinned_context) ? chat.pinned_context.slice() : [];
    pins.splice(i, 1);
    var data = await api('/api/monad/chats/' + chat.id, {
      method: 'PATCH', body: JSON.stringify({ pinned_context: pins }),
    });
    chat.pinned_context = data.chat.pinned_context;
    renderPinned();
  }

  async function addPinFromPrompt() {
    if (!STATE.activeChatId) return;
    var title = window.prompt(t('a.monad.pin_title', 'Название контекста'), '');
    if (title == null) return;
    var text = window.prompt(t('a.monad.pin_text', 'Текст / заметка для Манады'), '');
    if (text == null) return;
    var chat = STATE.chats.filter(function (c) { return c.id === STATE.activeChatId; })[0];
    var pins = Array.isArray(chat.pinned_context) ? chat.pinned_context.slice() : [];
    pins.push({ title: String(title).slice(0, 80), text: String(text).slice(0, 4000) });
    var data = await api('/api/monad/chats/' + chat.id, {
      method: 'PATCH', body: JSON.stringify({ pinned_context: pins }),
    });
    chat.pinned_context = data.chat.pinned_context;
    renderPinned();
  }

  async function uploadFiles(fileList) {
    if (!STATE.activeChatId || !fileList || !fileList.length) return;
    var btn = document.getElementById('monad-chat-attach');
    if (btn) btn.disabled = true;
    try {
      for (var i = 0; i < fileList.length; i++) {
        var fd = new FormData();
        fd.append('file', fileList[i]);
        var res = await fetch(apiBase() + '/api/monad/chats/' + encodeURIComponent(STATE.activeChatId) + '/upload', {
          method: 'POST', headers: authHeaders(false), body: fd,
        });
        var data = await res.json();
        if (!res.ok) throw new Error((data && data.error) || 'upload failed');
        STATE.pendingAttachments.push(data.attachment);
      }
      renderAttachmentsBar();
    } catch (err) {
      alert((err && err.message) || 'Upload error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function sendMessage() {
    var input = document.getElementById('monad-chat-input');
    if (!input) return;
    var text = String(input.value || '').trim();
    if (!text) return;
    if (!STATE.activeChatId) {
      await createChat();
    }
    var chat = STATE.chats.filter(function (c) { return c.id === STATE.activeChatId; })[0];
    var pins = (chat && chat.pinned_context) || [];
    input.value = '';
    var btn = document.getElementById('monad-chat-send');
    if (btn) btn.disabled = true;
    STATE.messages.push({ role: 'you', text: text, attachments: STATE.pendingAttachments || [] });
    STATE.messages.push({ role: 'monad', text: '…', meta: { typing: true } });
    renderMessages();
    try {
      var data = await api('/api/monad/message', {
        method: 'POST',
        body: JSON.stringify({
          text: text,
          chat_id: STATE.activeChatId,
          attachments: STATE.pendingAttachments,
          pinned_context: pins,
          title: (chat && chat.title && chat.title !== 'Новый чат') ? chat.title : text.slice(0, 80),
        }),
      });
      STATE.pendingAttachments = [];
      renderAttachmentsBar();
      STATE.messages = STATE.messages.filter(function (m) { return !(m.meta && m.meta.typing); });
      if (data && data.reply && data.reply.text) {
        STATE.messages.push(data.reply);
        renderMessages();
      }
      var thr = await api('/api/monad/chats/' + encodeURIComponent(STATE.activeChatId));
      if (thr && thr.messages && thr.messages.length) STATE.messages = thr.messages;
      renderMessages();
      await loadChats();
      startPoll();
    } catch (err) {
      STATE.messages = STATE.messages.filter(function (m) { return !(m.meta && m.meta.typing); });
      STATE.messages.push({ role: 'err', text: (err.data && err.data.error) || err.message || 'Error' });
      renderMessages();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function pollReplies() {
    if (!STATE.activeChatId || STATE.sub !== 'chat') return;
    try {
      var data = await api('/api/monad/chats/' + encodeURIComponent(STATE.activeChatId) + '/poll', {
        method: 'POST', body: JSON.stringify({}),
      });
      if (data && data.messages) {
        var before = STATE.messages.length;
        STATE.messages = data.messages;
        if (STATE.messages.length !== before || (data.imported > 0)) renderMessages();
      }
    } catch (e) { /* quiet */ }
  }

  function startPoll() {
    stopPoll();
    if (!STATE.activeChatId) return;
    STATE.pollTimer = setInterval(pollReplies, 20000);
    pollReplies();
  }
  function startFastPoll() {
    stopPoll();
    if (!STATE.activeChatId) return;
    var n = 0;
    STATE.pollTimer = setInterval(function () {
      n += 1;
      pollReplies();
      if (n >= 24) { // ~2 min of 5s polls, then slow
        stopPoll();
        startPoll();
      }
    }, 5000);
    pollReplies();
  }
  function stopPoll() {
    if (STATE.pollTimer) { clearInterval(STATE.pollTimer); STATE.pollTimer = null; }
  }

  /* ── architecture / rhythm ─────────────────────────────────────────── */
  function locLang() {
    return (document.documentElement.lang || 'ru').slice(0, 2);
  }
  function locField(obj, key) {
    if (!obj) return '';
    var lang = locLang();
    return obj[key + '_' + lang] || obj[lang] || obj[key + '_ru'] || obj.ru || obj.en || '';
  }
  function agentCard(a, extraClass) {
    if (!a || !a.agent_id) return '';
    var kind = a.type || '';
    return '<button type="button" class="monad-agent-chip kind-' + esc(kind) + (extraClass ? ' ' + extraClass : '') + '" data-agent="' + esc(a.agent_id) + '">' +
      '<span class="dot ' + esc(a.status || '') + '"></span>' +
      '<span class="bn">' + esc(a.name || a.agent_id) + '</span></button>';
  }
  function showCell(code) {
    return String(code || '').replace(/x/gi, '×');
  }
  function typeLabel(type) {
    var map = {
      human_persona: t('a.monad.type_human', 'Персона человека'),
      contour_persona: t('a.monad.type_contour', 'Персона контура'),
      project_persona: t('a.monad.type_project', 'Персона проекта'),
      skill: t('a.monad.type_skill', 'Skill-агент'),
    };
    return map[type] || type || '—';
  }
  function agentDetail(a) {
    if (!a) return '<p class="monad-muted">' + esc(t('a.monad.pick_agent', 'Нажми агента — функция, тип, контур или проект.')) + '</p>';
    var secs = Array.isArray(a.secondary_cells) ? a.secondary_cells.map(showCell).filter(Boolean) : [];
    var friends = Array.isArray(a.friends) ? a.friends : [];
    var html = '<div class="monad-agent-detail">';
    html += '<h4>' + esc(a.name || a.agent_id) + '</h4>';
    html += '<p class="monad-muted"><code>' + esc(a.agent_id) + '</code> · ' + esc(typeLabel(a.type)) + '</p>';
    html += '<dl class="monad-dl">';
    html += '<dt>' + esc(t('a.monad.cell', 'Ячейка')) + '</dt><dd>' + esc(a.cell ? showCell(a.cell) : t('a.monad.unplaced_one', 'без рассадки')) + '</dd>';
    if (secs.length) {
      html += '<dt>' + esc(t('a.monad.secondary', 'Ещё посты')) + '</dt><dd>' + esc(secs.join(', ')) + '</dd>';
    }
    html += '<dt>' + esc(t('a.monad.type', 'Тип')) + '</dt><dd>' + esc(typeLabel(a.type)) + '</dd>';
    if (a.contour) {
      html += '<dt>' + esc(t('a.monad.contour', 'Контур')) + '</dt><dd>' + esc(a.contour) + '</dd>';
    }
    if (a.project) {
      html += '<dt>' + esc(t('a.monad.project', 'Проект')) + '</dt><dd>' + esc(a.project) + '</dd>';
    }
    html += '<dt>' + esc(t('a.monad.owner', 'Владелец')) + '</dt><dd>' + esc(a.owner_name || a.owner || '—') + '</dd>';
    html += '<dt>' + esc(t('a.monad.parent', 'Родитель')) + '</dt><dd>' + esc(a.parent || '—') + '</dd>';
    html += '<dt>' + esc(t('a.monad.status', 'Статус')) + '</dt><dd>' + esc(a.status || '—') + '</dd>';
    html += '<dt>' + esc(t('a.monad.platform', 'Платформа')) + '</dt><dd>' + esc(a.platform || '—') + '</dd>';
    if (a.chain) {
      html += '<dt>' + esc(t('a.monad.chain', 'Цепь')) + '</dt><dd>' + esc(typeof a.chain === 'string' ? a.chain : JSON.stringify(a.chain)) + '</dd>';
    }
    if (friends.length) {
      html += '<dt>' + esc(t('a.monad.friends', 'Связи')) + '</dt><dd>' + esc(friends.join(', ')) + '</dd>';
    }
    html += '<dt>' + esc(t('a.monad.domains', 'Домены')) + '</dt><dd>' + esc((a.domains && a.domains.length) ? a.domains.join(', ') : '—') + '</dd>';
    html += '</dl></div>';
    return html;
  }
  function walkAgents(fn) {
    var arch = STATE.arch;
    if (!arch) return;
    (arch.vertical || []).forEach(function (n) {
      (n.agents || []).forEach(fn);
      (n.cells || []).forEach(function (c) { (c.agents || []).forEach(fn); });
    });
    ((arch.horizontal && arch.horizontal.persons) || []).forEach(function (p) {
      if (p.persona) fn(p.persona);
      (p.contours || []).forEach(function (g) { (g.agents || []).forEach(fn); });
      (p.projects || []).forEach(function (g) { (g.agents || []).forEach(fn); });
    });
    if (arch.horizontal && arch.horizontal.center && arch.horizontal.center.agent) fn(arch.horizontal.center.agent);
    (arch.unplaced || []).forEach(fn);
  }
  function findAgent(id) {
    var found = null;
    walkAgents(function (a) { if (a && a.agent_id === id) found = a; });
    return found;
  }
  function bindAgentClicks(host, detailId) {
    host.querySelectorAll('[data-agent]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        STATE.pickedAgent = b.getAttribute('data-agent');
        var box = document.getElementById(detailId);
        if (box) box.innerHTML = agentDetail(findAgent(STATE.pickedAgent));
      });
    });
  }

  function renderVertical(arch) {
    var host = document.getElementById('monad-vertical');
    if (!host || !arch) return;
    var layers = (arch.vertical || []).slice().sort(function (a, b) { return (b.layer || 0) - (a.layer || 0); });
    var selected = layers.filter(function (n) { return n.id === STATE.vertLayer; })[0] || null;
    var selectedCell = null;
    if (selected && STATE.vertCell) {
      selectedCell = (selected.cells || []).filter(function (c) { return String(c.n) === String(STATE.vertCell); })[0] || null;
    }
    var html = '<p class="monad-viz-legend">' + esc((arch.legend && (arch.legend[locLang()] || arch.legend.ru)) || t('a.monad.vertical_help', '49 постов Li×Lj. Клетка = функция. Агенты из monad.placement.')) + '</p>';
    html += '<div class="monad-viz-split monad-viz-split-wide">';
    html += '<div class="monad-vert-col">';
    html += '<div class="monad-matrix-scroll"><div class="monad-matrix">';
    html += '<div class="monad-matrix-corner"></div>';
    for (var col = 1; col <= 7; col++) {
      html += '<div class="monad-matrix-colh">L' + col + '</div>';
    }
    layers.forEach(function (n) {
      var label = n[locLang()] || n.ru || n.id;
      html += '<div class="monad-matrix-rowh' + (n.id === STATE.vertLayer ? ' on' : '') + '" data-layer="' + esc(n.id) + '">';
      html += '<span>L' + esc(n.layer) + '</span><b>' + esc(label) + '</b>';
      html += '<em>' + (n.total || 0) + '</em></div>';
      var cells = (n.cells || []).slice().sort(function (a, b) { return a.n - b.n; });
      cells.forEach(function (c) {
        var code = c.code || ('L' + n.layer + 'xL' + c.n);
        var shown = showCell(code);
        var cellOn = (STATE.vertLayer === n.id && String(STATE.vertCell) === String(c.n)) ? ' on' : '';
        var spine = String(c.n) === String(n.layer) ? ' spine' : '';
        var nm = c[locLang()] || c.ru || shown;
        html += '<button type="button" class="monad-matrix-cell' + (c.occupied ? ' filled' : '') + cellOn + spine + '" data-layer="' + esc(n.id) + '" data-cell="' + c.n + '">';
        html += '<span class="code">' + esc(shown) + (c.count ? ' · ' + c.count : '') + '</span>';
        html += '<span class="nm">' + esc(nm) + '</span>';
        html += '<span class="chips">';
        (c.agents || []).forEach(function (a) { html += agentCard(a, 'tiny'); });
        html += '</span></button>';
      });
    });
    html += '</div></div></div>';
    html += '<aside class="monad-viz-panel" id="monad-vert-side">';
    if (!selected) {
      html += '<p class="monad-muted">' + esc(t('a.monad.vertical_pick', 'Нажми клетку 7×7. Увидишь функцию поста и живых агентов.')) + '</p>';
      html += '<div id="monad-vert-agent-detail">' + (STATE.pickedAgent ? agentDetail(findAgent(STATE.pickedAgent)) : '') + '</div>';
    } else {
      var agents = selectedCell ? (selectedCell.agents || []) : (selected.agents || []);
      html += '<div class="monad-viz-kicker">L' + esc(selected.layer) + ' · ' + esc(selected[locLang()] || selected.ru) +
        (selectedCell ? (' · ' + esc(showCell(selectedCell.code || ('L' + selected.layer + 'xL' + selectedCell.n)))) : '') + '</div>';
      html += '<h3 class="monad-viz-h">' + esc(selectedCell ? (selectedCell[locLang()] || selectedCell.ru) : (selected[locLang()] || selected.ru)) + '</h3>';
      html += '<p class="monad-muted">' + esc(locField(selected, 'sense')) + '</p>';
      html += '<p class="monad-muted">' + esc(t('a.monad.post_is_function', 'Пост — функция слоя, не агент.')) + ' ' +
        agents.length + ' ' + esc(t('a.monad.agents_here', 'агентов в этой клетке')) + '.</p>';
      html += '<div class="monad-agent-list">';
      if (!agents.length) html += '<p class="monad-muted">' + esc(t('a.monad.no_agents', 'В этой ячейке пока нет агентов.')) + '</p>';
      agents.forEach(function (a) { html += agentCard(a); });
      html += '</div>';
      html += '<div id="monad-vert-agent-detail">' + (STATE.pickedAgent ? agentDetail(findAgent(STATE.pickedAgent)) : '') + '</div>';
    }
    html += renderUnplaced(arch);
    html += '</aside></div>';
    host.innerHTML = html;
    host.querySelectorAll('.monad-matrix-rowh').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.vertLayer = b.getAttribute('data-layer');
        STATE.vertCell = null;
        renderVertical(STATE.arch);
      });
    });
    host.querySelectorAll('.monad-matrix-cell').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        STATE.vertLayer = b.getAttribute('data-layer');
        STATE.vertCell = b.getAttribute('data-cell');
        renderVertical(STATE.arch);
      });
    });
    bindAgentClicks(host, 'monad-vert-agent-detail');
  }

  function renderUnplaced(arch) {
    var groups = (arch && arch.unplaced_groups) || {};
    var list = (arch && arch.unplaced) || [];
    if (!list.length) return '';
    if (!Object.keys(groups).length) {
      groups = { other: list };
    }
    var html = '<div class="monad-unplaced" id="monad-unplaced">';
    html += '<p class="monad-muted">' + esc(t('a.monad.unplaced', 'Без ячейки monad.placement')) + ': ' + list.length +
      '. ' + esc(t('a.monad.unplaced_why', 'Каналы, системные органы и ещё не рассаженные агенты — тоже кликабельны.')) + '</p>';
    Object.keys(groups).sort().forEach(function (k) {
      html += '<details class="monad-unplaced-g"><summary>' + esc(k) + ' · ' + groups[k].length + '</summary><div class="monad-agent-list">';
      groups[k].forEach(function (a) { html += agentCard(a); });
      html += '</div></details>';
    });
    html += '<div id="monad-unplaced-detail"></div></div>';
    return html;
  }

  function hourXY(hour, radius) {
    var angle = (hour / 12) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
  }
  function renderHorizontal(arch) {
    var host = document.getElementById('monad-horizontal');
    if (!host || !arch) return;
    var h = arch.horizontal || {};
    var seats = h.seats || [];
    var selected = null;
    var selectedDom = STATE.horizHour === 'dom';
    seats.forEach(function (s) {
      if (s.person && String(s.hour) === String(STATE.horizHour)) selected = s;
    });
    var html = '<p class="monad-viz-legend">' + esc(t('a.monad.horiz_help', 'Круг 12+1: DOM (проект) в центре. Контуры ветвятся от людей. Пустые часы 2,4,7,8,11 нажаты и пусты.')) + '</p>';
    html += '<div class="monad-viz-split">';
    html += '<div class="monad-horiz-col">';
    html += '<div class="monad-horiz-wrap"><div class="monad-horiz-ring">';
    html += '<button type="button" class="monad-dom-center' + (selectedDom ? ' on' : '') + '" data-hour="dom">';
    html += '<div class="monad-dom-label">DOM</div><div class="monad-muted">' + esc(t('a.monad.project', 'Проект')) + '</div></button>';
    for (var hour = 1; hour <= 12; hour++) {
      var mark = hourXY(hour, 46);
      html += '<div class="monad-hour-mark" style="left:' + mark.x.toFixed(2) + '%;top:' + mark.y.toFixed(2) + '%;">' + hour + '</div>';
    }
    seats.forEach(function (s) {
      var p = s.person;
      var pos = hourXY(s.hour, 38);
      if (s.inactive || !p) {
        html += '<div class="monad-person empty pressed" style="left:' + pos.x.toFixed(2) + '%;top:' + pos.y.toFixed(2) + '%;">' +
          '<div class="monad-muted">' + esc(s.inactive ? t('a.monad.seat_pressed', 'нажато') : t('a.monad.seat_empty', 'пусто')) + '</div></div>';
        return;
      }
      var on = String(s.hour) === String(STATE.horizHour) ? ' on' : '';
      var contourNames = (p.contours || []).map(function (g) { return locLang() === 'en' ? (g.label_en || g.label) : g.label; });
      html += '<button type="button" class="monad-person' + (p.is_me ? ' me' : '') + on + '" data-hour="' + s.hour + '" style="left:' + pos.x.toFixed(2) + '%;top:' + pos.y.toFixed(2) + '%;">';
      html += '<div class="monad-person-name">' + esc(p.display_name || p.human_id) + '</div>';
      html += '<div class="monad-muted">' + esc(p.human_id) + (p.is_me ? ' · you' : '') + '</div>';
      html += '<div class="monad-person-pop">';
      html += '<strong>' + esc(p.display_name || p.human_id) + '</strong>';
      html += '<div class="monad-muted">' + esc(t('a.monad.contour', 'Контур')) + ': ' +
        esc(contourNames.length ? contourNames.join(', ') : t('a.monad.no_contour', 'нет контура')) + '</div>';
      html += '</div></button>';
    });
    html += '</div></div>';
    if (h.unseated && h.unseated.length) {
      html += '<p class="monad-muted">' + esc(t('a.monad.unseated', 'В круге без часа')) + ': ' +
        h.unseated.map(function (u) { return u.display_name || u.human_id; }).join(', ') + '</p>';
    }
    html += '</div>';
    html += '<aside class="monad-viz-panel">';
    if (selectedDom && h.center) {
      html += '<div class="monad-viz-kicker">' + esc(t('a.monad.project', 'Проект')) + ' · DOM</div>';
      html += '<p class="monad-muted">' + esc(h.center.note || '') + '</p>';
      html += '<div class="monad-agent-list">';
      if (h.center.agent) html += agentCard(h.center.agent);
      html += '</div><div id="monad-horiz-agent-detail">' + (STATE.pickedAgent ? agentDetail(findAgent(STATE.pickedAgent)) : '') + '</div>';
    } else if (!selected || !selected.person) {
      html += '<p class="monad-muted">' + esc(t('a.monad.horiz_pick', 'Нажми человека. Справа — его Персона, контуры (группы агентов одного смысла) и отдельно проекты.')) + '</p>';
      html += '<div id="monad-horiz-agent-detail"></div>';
    } else {
      var p = selected.person;
      html += '<div class="monad-viz-kicker">' + esc(p.display_name || p.human_id) + ' · ' + selected.hour + ':00</div>';
      html += '<p>' + esc(p.role || '') + '</p>';
      if (p.persona) {
        html += '<h4 class="monad-viz-h">' + esc(t('a.monad.type_human', 'Персона человека')) + '</h4>';
        html += '<div class="monad-agent-list">' + agentCard(p.persona) + '</div>';
      }
      html += '<h4 class="monad-viz-h">' + esc(t('a.monad.contours_from_person', 'Контуры от человека')) + '</h4>';
      if (!(p.contours || []).length) html += '<p class="monad-muted">' + esc(t('a.monad.no_contour', 'нет контура')) + '</p>';
      (p.contours || []).forEach(function (g) {
        html += '<div class="monad-branch"><div class="monad-branch-name">' + esc(locLang() === 'en' ? (g.label_en || g.label) : g.label) + '</div>';
        html += '<div class="monad-agent-list">';
        (g.agents || []).forEach(function (a) { html += agentCard(a); });
        html += '</div></div>';
      });
      html += '<h4 class="monad-viz-h">' + esc(t('a.monad.projects_of_person', 'Проекты (не контуры)')) + '</h4>';
      if (!(p.projects || []).length) html += '<p class="monad-muted">' + esc(t('a.monad.no_projects', 'нет проекта')) + '</p>';
      (p.projects || []).forEach(function (g) {
        html += '<div class="monad-branch project"><div class="monad-branch-name">' + esc(locLang() === 'en' ? (g.label_en || g.label) : g.label) + '</div>';
        html += '<div class="monad-agent-list">';
        (g.agents || []).forEach(function (a) { html += agentCard(a); });
        html += '</div></div>';
      });
      html += '<div id="monad-horiz-agent-detail">' + (STATE.pickedAgent ? agentDetail(findAgent(STATE.pickedAgent)) : '') + '</div>';
    }
    html += '</aside></div>';
    host.innerHTML = html;
    host.querySelectorAll('[data-hour]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.horizHour = b.getAttribute('data-hour');
        renderHorizontal(STATE.arch);
      });
    });
    bindAgentClicks(host, 'monad-horiz-agent-detail');
  }

  function rhythmLayers() {
    var r = STATE.rhythm && (STATE.rhythm.rhythm || STATE.rhythm);
    return (r && r.layers) || [];
  }
  function renderRhythm(rhythm) {
    var host = document.getElementById('monad-rhythm');
    if (!host) return;
    rhythm = rhythm || (STATE.rhythm && (STATE.rhythm.rhythm || STATE.rhythm));
    if (!rhythm) return;
    var layers = rhythm.layers || [];
    if (!STATE.rhythmDisplay.length) {
      STATE.rhythmDisplay = layers.map(function (L) { return L.level || 0; });
    }
    var html = '<div class="monad-rhythm-head">';
    html += '<div>';
    html += '<strong>' + esc(t('a.monad.system_rhythm', 'Ритм системы Monad')) + '</strong> ';
    if (rhythm.system) {
      html += '<span class="monad-badge status-' + esc(rhythm.system.status || '') + '">' + esc(rhythm.system.status || '—') + '</span>';
    }
    html += '<p class="monad-muted" style="margin:0.35rem 0 0;">' + esc(t('a.monad.rhythm_help', 'Пульс семи слоёв вертикали (физика L1–L2, жизнь L3–L4, ум L5–L7). Не биологический EEG. «Живой ритм» включает онлайн; уход со вкладки гасит.')) + '</p>';
    html += '</div>';
    html += '<button type="button" id="monad-rhythm-live" class="btn ' + (STATE.liveRhythm ? 'btn-primary' : 'btn-ghost') + '" style="font-size:12px;">' +
      esc(STATE.liveRhythm ? t('a.monad.live_off', 'Выключить живой ритм') : t('a.monad.live_on', 'Живой ритм')) + '</button>';
    html += '</div>';
    html += '<div class="monad-eq-live" aria-hidden="false">';
    layers.forEach(function (L, i) {
      var label = L[locLang()] || L.ru || L.id;
      var unavailable = L.available === false || L.level == null;
      var lvl = unavailable ? 0 : (STATE.rhythmDisplay[i] != null ? STATE.rhythmDisplay[i] : (L.level || 0));
      var pct = Math.round(lvl * 100);
      html += '<div class="monad-eq-col' + (unavailable ? ' unavailable' : '') + '">';
      html += '<div class="monad-eq-col-bar"><i style="height:' + (unavailable ? 6 : Math.max(6, pct)) + '%"></i></div>';
      html += '<div class="monad-eq-col-label"><code>' + esc(L.id || '') + '</code> ' + esc(label) + '</div>';
      html += '<div class="monad-eq-col-val">' + (unavailable ? 'n/a' : (pct + '%')) +
        (L.agents_in_layer != null ? ' · ' + L.agents_in_layer : '') + '</div>';
      html += '</div>';
    });
    html += '</div>';
    if (rhythm.agents && rhythm.agents.length) {
      html += '<div class="monad-agent-rhythm" style="margin-top:1rem;"><table class="monad-mini-table"><thead><tr><th>agent</th><th>act/min</th><th>drift</th><th>seen</th></tr></thead><tbody>';
      rhythm.agents.slice(0, 16).forEach(function (a) {
        html += '<tr><td><code>' + esc(a.agent_id) + '</code></td><td>' + esc(a.actions_per_min != null ? a.actions_per_min : '—') +
          '</td><td>' + esc(a.drift || '—') + '</td><td>' + esc(a.last_seen || '—') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    if (rhythm.system && rhythm.system.meta) html += '<p class="monad-muted">' + esc(rhythm.system.meta) + '</p>';
    html += '<p class="monad-muted" style="margin-top:0.75rem;">' + esc(rhythm.note || '') +
      (rhythm.source ? ' · ' + rhythm.source : '') +
      (rhythm.updated_at ? ' · ' + rhythm.updated_at : '') + '</p>';
    host.innerHTML = html;
    var liveBtn = document.getElementById('monad-rhythm-live');
    if (liveBtn) {
      liveBtn.addEventListener('click', function () {
        if (STATE.liveRhythm) stopLiveRhythm();
        else startLiveRhythm();
        renderRhythm(rhythm);
      });
    }
  }
  function applyRhythmBars() {
    var host = document.getElementById('monad-rhythm');
    if (!host) return;
    var cols = host.querySelectorAll('.monad-eq-col');
    var layers = rhythmLayers();
    cols.forEach(function (col, i) {
      var bar = col.querySelector('i');
      var val = col.querySelector('.monad-eq-col-val');
      var L = layers[i];
      if (!bar || !L) return;
      var unavailable = L.available === false || L.level == null;
      var lvl = STATE.rhythmDisplay[i] || 0;
      var pct = unavailable ? 0 : Math.round(lvl * 100);
      bar.style.height = (unavailable ? 6 : Math.max(6, pct)) + '%';
      if (val) val.textContent = unavailable ? 'n/a' : (pct + '%');
    });
  }
  function tickRhythmRaf() {
    if (!STATE.liveRhythm) { STATE.rhythmRaf = null; return; }
    var layers = rhythmLayers();
    layers.forEach(function (L, i) {
      var target = (L.available === false || L.level == null) ? 0 : (L.level || 0);
      var cur = STATE.rhythmDisplay[i] != null ? STATE.rhythmDisplay[i] : target;
      STATE.rhythmDisplay[i] = cur + (target - cur) * 0.18;
    });
    applyRhythmBars();
    STATE.rhythmRaf = window.requestAnimationFrame(tickRhythmRaf);
  }
  function startLiveRhythm() {
    STATE.liveRhythm = true;
    if (STATE.rhythmTimer) clearInterval(STATE.rhythmTimer);
    STATE.rhythmTimer = setInterval(function () {
      if (STATE.sub !== 'rhythm' || !STATE.liveRhythm) { stopLiveRhythm(); return; }
      api('/api/monad/rhythm').then(function (data) {
        STATE.rhythm = data;
        var layers = rhythmLayers();
        if (STATE.rhythmDisplay.length !== layers.length) {
          STATE.rhythmDisplay = layers.map(function (L) { return L.level || 0; });
        }
      }).catch(function () {});
    }, 1200);
    if (!STATE.rhythmRaf) STATE.rhythmRaf = window.requestAnimationFrame(tickRhythmRaf);
  }
  function stopLiveRhythm() {
    STATE.liveRhythm = false;
    if (STATE.rhythmTimer) { clearInterval(STATE.rhythmTimer); STATE.rhythmTimer = null; }
    if (STATE.rhythmRaf) { window.cancelAnimationFrame(STATE.rhythmRaf); STATE.rhythmRaf = null; }
  }
  async function ensureArchitecture() {
    if (STATE.arch) { renderVertical(STATE.arch); renderHorizontal(STATE.arch); return; }
    try {
      STATE.arch = await api('/api/monad/architecture');
      renderVertical(STATE.arch); renderHorizontal(STATE.arch);
    } catch (err) {
      var msg = (err.data && err.data.error) || err.message;
      var v = document.getElementById('monad-vertical');
      var h = document.getElementById('monad-horizontal');
      if (v) v.innerHTML = '<p class="monad-warn">' + esc(msg) + '</p>';
      if (h) h.innerHTML = '<p class="monad-warn">' + esc(msg) + '</p>';
    }
  }
  async function ensureRhythm() {
    var host = document.getElementById('monad-rhythm');
    try {
      STATE.rhythm = await api('/api/monad/rhythm');
      var rhythm = STATE.rhythm.rhythm || STATE.rhythm;
      STATE.rhythmDisplay = (rhythm.layers || []).map(function (L) { return L.level || 0; });
      renderRhythm(rhythm);
    } catch (err) {
      if (host) host.innerHTML = '<p class="monad-warn">' + esc((err.data && err.data.error) || err.message) + '</p>';
    }
  }

  async function mount() {
    showTabButton(window.currentUser);
    if (!isMonadRole(window.currentUser)) return;
    try { STATE.status = await api('/api/monad/status'); }
    catch (err) { STATE.status = { configured: false, note: (err.data && err.data.error) || err.message }; }
    renderStatusBar();
    try { await loadChats(); }
    catch (e) {
      var box = document.getElementById('monad-chat-log');
      if (box) box.innerHTML = '<p class="monad-warn">' + esc(e.message) + '</p>';
    }
    STATE.loaded = true;
  }

  function onTabOpen() {
    mount().then(function () {
      if (STATE.sub === 'vertical' || STATE.sub === 'horizontal') ensureArchitecture();
      if (STATE.sub === 'rhythm') ensureRhythm();
    });
  }

  function wire() {
    document.querySelectorAll('.monad-subtab').forEach(function (b) {
      b.addEventListener('click', function () { setSub(b.getAttribute('data-monad-sub')); });
    });
    var send = document.getElementById('monad-chat-send');
    var input = document.getElementById('monad-chat-input');
    if (send) send.addEventListener('click', sendMessage);
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      });
    }
    var neu = document.getElementById('monad-chat-new');
    if (neu) neu.addEventListener('click', function () { createChat().catch(function (e) { alert(e.message); }); });
    var pinBtn = document.getElementById('monad-pin-add');
    if (pinBtn) pinBtn.addEventListener('click', function () { addPinFromPrompt().catch(function (e) { alert(e.message); }); });
    var file = document.getElementById('monad-chat-file');
    var attach = document.getElementById('monad-chat-attach');
    if (attach && file) {
      attach.addEventListener('click', function () { file.click(); });
      file.addEventListener('change', function () {
        uploadFiles(file.files).finally(function () { file.value = ''; });
      });
    }
    var refresh = document.getElementById('monad-refresh');
    if (refresh) {
      refresh.addEventListener('click', function () {
        stopLiveRhythm();
        STATE.arch = null; STATE.rhythm = null; STATE.status = null;
        onTabOpen();
      });
    }
    var del = document.getElementById('monad-chat-archive');
    if (del) {
      del.addEventListener('click', function () {
        if (!STATE.activeChatId) return;
        deleteChat(STATE.activeChatId);
      });
    }
  }

  window.MonadLK = {
    showTabButton: showTabButton,
    onLogin: function (user) { showTabButton(user); },
    onTab: onTabOpen,
    isRole: isMonadRole,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
