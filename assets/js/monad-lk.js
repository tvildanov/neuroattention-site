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
      return '<button type="button" class="monad-chat-item' + active + '" data-chat-id="' + esc(c.id) + '">' +
        '<div class="monad-chat-item-title">' + esc(c.title || t('a.monad.new_chat', 'Новый чат')) + '</div>' +
        (preview ? '<div class="monad-chat-item-prev">' + esc(preview) + '</div>' : '') +
        '</button>';
    }).join('');
    host.querySelectorAll('.monad-chat-item').forEach(function (b) {
      b.addEventListener('click', function () { openChat(b.getAttribute('data-chat-id')); });
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
      if (data && data.message) {
        STATE.messages = STATE.messages.filter(function (m) { return !(m.meta && m.meta.typing); });
        // Replace optimistic you+typing with server thread if we have reply
        var thr = await api('/api/monad/chats/' + encodeURIComponent(STATE.activeChatId));
        STATE.messages = thr.messages || [];
        renderMessages();
      } else {
        var thr2 = await api('/api/monad/chats/' + encodeURIComponent(STATE.activeChatId));
        STATE.messages = thr2.messages || [];
        renderMessages();
      }
      await loadChats();
      startFastPoll();
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

  /* ── architecture / rhythm (unchanged) ─────────────────────────────── */
  function renderVertical(arch) {
    var host = document.getElementById('monad-vertical');
    if (!host || !arch) return;
    var lang = (document.documentElement.lang || 'ru').slice(0, 2);
    var html = '<div class="monad-vert-grid">';
    (arch.vertical || []).forEach(function (n) {
      var label = n[lang] || n.ru || n.id;
      html += '<div class="monad-nucleus">';
      html += '<div class="monad-nucleus-head"><span>' + esc(label) + '</span>';
      html += '<span class="monad-muted">' + (n.active || 0) + '/' + (n.total || 0) + '</span></div>';
      html += '<div class="monad-branches">';
      (n.branches || []).forEach(function (b) {
        var empty = !b.agent_id || b.status === 'empty';
        html += '<div class="monad-branch' + (empty ? ' empty' : '') + '" title="' + esc(b.agent_id || '') + '">';
        html += '<span class="dot ' + esc(b.status || 'empty') + '"></span>';
        html += '<span class="bn">' + esc(empty ? '—' : (b.name || b.agent_id)) + '</span></div>';
      });
      html += '</div></div>';
    });
    html += '</div><p class="monad-muted" style="margin-top:0.75rem;">' +
      esc(t('a.monad.vertical_note', 'Вертикаль 7×7 — MVP.')) + '</p>';
    host.innerHTML = html;
  }
  function renderHorizontal(arch) {
    var host = document.getElementById('monad-horizontal');
    if (!host || !arch) return;
    var h = arch.horizontal || {};
    var persons = h.persons || [];
    var html = '<div class="monad-horiz-wrap"><div class="monad-horiz-ring">';
    html += '<div class="monad-dom-center"><div class="monad-dom-label">DOM</div><div class="monad-muted">12+1</div></div>';
    persons.forEach(function (p, i) {
      var angle = (360 / Math.max(persons.length, 1)) * i - 90;
      var rad = (angle * Math.PI) / 180;
      var x = 50 + 42 * Math.cos(rad), y = 50 + 42 * Math.sin(rad);
      html += '<div class="monad-person' + (p.is_me ? ' me' : '') + '" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;" title="' + esc(p.human_id) + '">';
      html += '<div class="monad-person-name">' + esc(p.display_name || p.human_id) + '</div>';
      html += '<div class="monad-muted">' + esc(p.human_id) + (p.is_me ? ' · you' : '') + '</div></div>';
    });
    html += '</div></div>';
    host.innerHTML = html;
  }
  function renderRhythm(rhythm) {
    var host = document.getElementById('monad-rhythm');
    if (!host || !rhythm) return;
    var lang = (document.documentElement.lang || 'ru').slice(0, 2);
    var html = '';
    if (rhythm.system) {
      html += '<div class="monad-sys-status"><div><strong>' + esc(t('a.monad.system_rhythm', 'Ритм системы Monad')) + '</strong> ';
      html += '<span class="monad-badge status-' + esc(rhythm.system.status || '') + '">' + esc(rhythm.system.status || '—') + '</span></div>';
      if (rhythm.system.meta) html += '<div class="monad-muted">' + esc(rhythm.system.meta) + '</div></div>';
    }
    html += '<div class="monad-eq">';
    (rhythm.layers || []).forEach(function (L) {
      var label = L[lang] || L.ru || L.id;
      var unavailable = L.available === false || L.level == null;
      var pct = unavailable ? 0 : Math.round((L.level || 0) * 100);
      html += '<div class="monad-eq-row' + (unavailable ? ' unavailable' : '') + '">';
      html += '<div class="monad-eq-label">' + esc(label) + '</div>';
      html += '<div class="monad-eq-bar"><div class="monad-eq-fill" style="width:' + pct + '%"></div></div>';
      html += '<div class="monad-eq-val">' + (unavailable ? 'n/a' : (pct + '%')) + '</div></div>';
    });
    html += '</div>';
    if (rhythm.agents && rhythm.agents.length) {
      html += '<div class="monad-agent-rhythm" style="margin-top:1rem;"><table class="monad-mini-table"><thead><tr><th>agent</th><th>act/min</th><th>drift</th><th>seen</th></tr></thead><tbody>';
      rhythm.agents.slice(0, 12).forEach(function (a) {
        html += '<tr><td><code>' + esc(a.agent_id) + '</code></td><td>' + esc(a.actions_per_min != null ? a.actions_per_min : '—') +
          '</td><td>' + esc(a.drift || '—') + '</td><td>' + esc(a.last_seen || '—') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '<p class="monad-muted" style="margin-top:0.75rem;">' + esc(rhythm.note || '') +
      (rhythm.source ? ' · source=' + rhythm.source : '') + '</p>';
    host.innerHTML = html;
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
      renderRhythm(STATE.rhythm.rhythm || STATE.rhythm);
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
        STATE.arch = null; STATE.rhythm = null; STATE.status = null;
        onTabOpen();
      });
    }
    var del = document.getElementById('monad-chat-archive');
    if (del) {
      del.addEventListener('click', function () {
        if (!STATE.activeChatId) return;
        if (!window.confirm(t('a.monad.archive_q', 'Скрыть этот чат?'))) return;
        api('/api/monad/chats/' + STATE.activeChatId, { method: 'DELETE' }).then(function () {
          STATE.activeChatId = null; STATE.messages = [];
          return loadChats();
        }).catch(function (e) { alert(e.message); });
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
