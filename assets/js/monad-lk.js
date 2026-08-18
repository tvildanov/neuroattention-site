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
    if (s.lk_live_reply) {
      bits.push('<span class="monad-ok">● ' + esc(t('a.monad.live_reply', 'Persona отвечает в этом чате')) + '</span>');
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
  function agentCard(a) {
    if (!a || !a.agent_id) return '';
    return '<button type="button" class="monad-agent-chip" data-agent="' + esc(a.agent_id) + '">' +
      '<span class="dot ' + esc(a.status || '') + '"></span>' +
      '<span class="bn">' + esc(a.name || a.agent_id) + '</span></button>';
  }
  function agentDetail(a) {
    if (!a) return '<p class="monad-muted">' + esc(t('a.monad.pick_agent', 'Нажми агента — владелец, контур, статус.')) + '</p>';
    var html = '<div class="monad-agent-detail">';
    html += '<h4>' + esc(a.name || a.agent_id) + '</h4>';
    html += '<p class="monad-muted"><code>' + esc(a.agent_id) + '</code></p>';
    html += '<dl class="monad-dl">';
    html += '<dt>' + esc(t('a.monad.owner', 'Владелец')) + '</dt><dd>' + esc(a.owner_name || a.owner || '—') + '</dd>';
    html += '<dt>' + esc(t('a.monad.status', 'Статус')) + '</dt><dd>' + esc(a.status || '—') + '</dd>';
    html += '<dt>' + esc(t('a.monad.platform', 'Платформа')) + '</dt><dd>' + esc(a.platform || '—') + '</dd>';
    html += '<dt>' + esc(t('a.monad.contour', 'Контур')) + '</dt><dd>' + esc((a.contour && a.contour.length) ? a.contour.join(', ') : '—') + '</dd>';
    html += '<dt>' + esc(t('a.monad.domains', 'Домены')) + '</dt><dd>' + esc((a.domains && a.domains.length) ? a.domains.join(', ') : '—') + '</dd>';
    html += '</dl></div>';
    return html;
  }
  function findAgent(id) {
    var arch = STATE.arch;
    if (!arch || !id) return null;
    var found = null;
    (arch.vertical || []).forEach(function (n) {
      (n.agents || []).forEach(function (a) { if (a.agent_id === id) found = a; });
    });
    if (found) return found;
    ((arch.horizontal && arch.horizontal.persons) || []).forEach(function (p) {
      (p.agents || []).forEach(function (a) { if (a.agent_id === id) found = a; });
    });
    return found;
  }

  function renderVertical(arch) {
    var host = document.getElementById('monad-vertical');
    if (!host || !arch) return;
    var layers = (arch.vertical || []).slice().sort(function (a, b) { return (a.layer || 0) - (b.layer || 0); });
    var selected = layers.filter(function (n) { return n.id === STATE.vertLayer; })[0] || null;
    var selectedCell = null;
    if (selected && STATE.vertCell) {
      selectedCell = (selected.cells || []).filter(function (c) { return String(c.n) === String(STATE.vertCell); })[0] || null;
    }
    var html = '<div class="monad-viz-split">';
    html += '<div class="monad-vert-col">';
    html += '<p class="monad-viz-legend">' + esc((arch.legend && (arch.legend[locLang()] || arch.legend.ru)) || t('a.monad.vertical_help', '7 слоёв одного поля. L1 Тело внизу, L7 Поле наверху. Наведи слой — 7 внутренних ячеек. Нажми — агенты.')) + '</p>';
    html += '<div class="monad-vert-strip" role="list">';
    layers.forEach(function (n) {
      var label = n[locLang()] || n.ru || n.id;
      var on = n.id === STATE.vertLayer ? ' on' : '';
      var sense = locField(n, 'sense');
      html += '<div class="monad-vert-layer' + on + '" data-layer="' + esc(n.id) + '" role="listitem">';
      html += '<button type="button" class="monad-vert-band" data-layer="' + esc(n.id) + '">';
      html += '<span class="monad-vert-l">L' + esc(n.layer) + '</span>';
      html += '<span class="monad-vert-name">' + esc(label) + '</span>';
      html += '<span class="monad-vert-count" title="' + esc(t('a.monad.agents_active', 'Активные агенты / все агенты этого слоя')) + '">' +
        (n.active || 0) + ' ' + esc(t('a.monad.of', 'из')) + ' ' + (n.total || 0) + '</span>';
      html += '</button>';
      html += '<div class="monad-vert-inners">';
      (n.cells || []).slice().sort(function (a, b) { return b.n - a.n; }).forEach(function (c) {
        var code = (n.layer || '') + '-' + c.n;
        var cellOn = (STATE.vertLayer === n.id && String(STATE.vertCell) === String(c.n)) ? ' on' : '';
        var nm = c[locLang()] || c.ru || code;
        html += '<button type="button" class="monad-vert-cell' + (c.occupied ? ' filled' : '') + cellOn + '" data-layer="' + esc(n.id) + '" data-cell="' + c.n + '" title="' + esc(code + ' · ' + nm) + '">';
        html += '<span class="code">' + esc(code) + '</span><span class="nm">' + esc(nm) + '</span>';
        html += '</button>';
      });
      html += '</div>';
      if (sense) html += '<div class="monad-vert-sense">' + esc(sense) + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
    html += '<aside class="monad-viz-panel">';
    if (!selected) {
      html += '<p class="monad-muted">' + esc(t('a.monad.vertical_pick', 'Выбери слой слева. Это не новые сущности — слои одного поля Манады.')) + '</p>';
    } else {
      var agents = selectedCell ? (selectedCell.agents || []) : (selected.agents || []);
      html += '<div class="monad-viz-kicker">L' + esc(selected.layer) + ' · ' + esc(selected[locLang()] || selected.ru) +
        (selectedCell ? (' · ' + (selected.layer + '-' + selectedCell.n) + ' ' + esc(selectedCell[locLang()] || selectedCell.ru)) : '') + '</div>';
      html += '<p class="monad-muted">' + esc(locField(selected, 'sense')) + ' ' +
        esc(t('a.monad.agents_active', 'Активные агенты / все агенты этого слоя')) + ': ' +
        (selected.active || 0) + ' / ' + (selected.total || 0) + '.</p>';
      html += '<div class="monad-agent-list">';
      if (!agents.length) html += '<p class="monad-muted">' + esc(t('a.monad.no_agents', 'В этой ячейке пока нет агентов.')) + '</p>';
      agents.forEach(function (a) { html += agentCard(a); });
      html += '</div>';
      html += '<div id="monad-vert-agent-detail"></div>';
    }
    html += '</aside></div>';
    host.innerHTML = html;
    host.querySelectorAll('.monad-vert-band').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.vertLayer = b.getAttribute('data-layer');
        STATE.vertCell = null;
        renderVertical(STATE.arch);
      });
    });
    host.querySelectorAll('.monad-vert-cell').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        STATE.vertLayer = b.getAttribute('data-layer');
        STATE.vertCell = b.getAttribute('data-cell');
        renderVertical(STATE.arch);
      });
    });
    host.querySelectorAll('[data-agent]').forEach(function (b) {
      b.addEventListener('click', function () {
        var box = document.getElementById('monad-vert-agent-detail');
        if (box) box.innerHTML = agentDetail(findAgent(b.getAttribute('data-agent')));
      });
    });
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
    seats.forEach(function (s) {
      if (s.person && String(s.hour) === String(STATE.horizHour)) selected = s;
    });
    var html = '<div class="monad-viz-split">';
    html += '<div class="monad-horiz-col">';
    html += '<p class="monad-viz-legend">' + esc(t('a.monad.horiz_help', 'Круг 12+1: DOM в центре. Никита на 12, Тахир напротив на 6. Наведи человека — его контур и агенты.')) + '</p>';
    html += '<div class="monad-horiz-wrap"><div class="monad-horiz-ring">';
    html += '<div class="monad-dom-center"><div class="monad-dom-label">DOM</div><div class="monad-muted">12+1</div></div>';
    for (var hour = 1; hour <= 12; hour++) {
      var mark = hourXY(hour, 46);
      html += '<div class="monad-hour-mark" style="left:' + mark.x.toFixed(2) + '%;top:' + mark.y.toFixed(2) + '%;">' + hour + '</div>';
    }
    seats.forEach(function (s) {
      var p = s.person;
      var pos = hourXY(s.hour, 38);
      if (!p) {
        html += '<div class="monad-person empty" style="left:' + pos.x.toFixed(2) + '%;top:' + pos.y.toFixed(2) + '%;">' +
          '<div class="monad-muted">' + esc(t('a.monad.seat_empty', 'пусто')) + '</div></div>';
        return;
      }
      var on = String(s.hour) === String(STATE.horizHour) ? ' on' : '';
      html += '<button type="button" class="monad-person' + (p.is_me ? ' me' : '') + on + '" data-hour="' + s.hour + '" style="left:' + pos.x.toFixed(2) + '%;top:' + pos.y.toFixed(2) + '%;">';
      html += '<div class="monad-person-name">' + esc(p.display_name || p.human_id) + '</div>';
      html += '<div class="monad-muted">' + esc(p.human_id) + (p.is_me ? ' · you' : '') + ' · ' + (p.agents_count || 0) + '</div>';
      html += '<div class="monad-person-pop">';
      html += '<strong>' + esc(p.display_name || p.human_id) + '</strong>';
      html += '<div class="monad-muted">' + esc((p.contour && p.contour.length) ? p.contour.join(', ') : t('a.monad.no_contour', 'Контур не указан')) + '</div>';
      html += '<div class="monad-agent-mini">';
      (p.agents || []).slice(0, 8).forEach(function (a) {
        html += '<span>' + esc(a.name || a.agent_id) + '</span>';
      });
      html += '</div></div></button>';
    });
    html += '</div></div></div>';
    html += '<aside class="monad-viz-panel">';
    if (!selected || !selected.person) {
      html += '<p class="monad-muted">' + esc(t('a.monad.horiz_pick', 'Нажми человека на круге. Раскроется его контур и агенты.')) + '</p>';
    } else {
      var p = selected.person;
      html += '<div class="monad-viz-kicker">' + esc(p.display_name || p.human_id) + ' · ' + selected.hour + ':00</div>';
      html += '<p>' + esc(p.role || '') + '</p>';
      html += '<p class="monad-muted">' + esc(t('a.monad.contour', 'Контур')) + ': ' +
        esc((p.contour && p.contour.length) ? p.contour.join(', ') : '—') + '</p>';
      html += '<div class="monad-agent-list">';
      (p.agents || []).forEach(function (a) { html += agentCard(a); });
      html += '</div><div id="monad-horiz-agent-detail"></div>';
    }
    html += '</aside></div>';
    host.innerHTML = html;
    host.querySelectorAll('.monad-person[data-hour]').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.horizHour = b.getAttribute('data-hour');
        renderHorizontal(STATE.arch);
      });
    });
    host.querySelectorAll('[data-agent]').forEach(function (b) {
      b.addEventListener('click', function () {
        var box = document.getElementById('monad-horiz-agent-detail');
        if (box) box.innerHTML = agentDetail(findAgent(b.getAttribute('data-agent')));
      });
    });
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
    html += '<p class="monad-muted" style="margin:0.35rem 0 0;">' + esc(t('a.monad.rhythm_help', 'Снимок с живого /api/rhythm. «Живой ритм» включает онлайн-эквалайзер; выключение или уход со вкладки его гасит.')) + '</p>';
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
      html += '<div class="monad-eq-col-label">' + esc(label) + '</div>';
      html += '<div class="monad-eq-col-val">' + (unavailable ? 'n/a' : (pct + '%')) + '</div>';
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
