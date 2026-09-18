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
    archSub: 'cross',
    chats: [],
    activeChatId: null,
    messages: [],
    pendingAttachments: [],
    pollTimer: null,
    awaitingPersona: false,
    showTech: false,
    vertLayer: null,
    vertCell: null,
    horizHour: null,
    pickedAgent: null,
    liveRhythm: false,
    rhythmTimer: null,
    rhythmRaf: null,
    rhythmDisplay: [],
    inbox: [],
    inboxSyncing: false,
    inboxViewId: null,
    personaHealth: null,
    live: null,
    livePollTimer: null,
    agentSearch: '',
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
    var sr = String(user.serverRole || '').toLowerCase();
    var dr = String(user.role || '').toLowerCase();
    return sr === 'superadmin' || sr === 'founder' || dr === 'founder';
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

  function setArchSub(id) {
    STATE.archSub = id || 'cross';
    document.querySelectorAll('.monad-arch-subtab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-monad-arch') === STATE.archSub);
    });
    document.querySelectorAll('.monad-arch-view').forEach(function (p) {
      p.classList.toggle('active', p.id === 'monad-arch-' + STATE.archSub);
    });
    if (STATE.archSub === 'cross') {
      if (window.MonadCross && STATE.arch) {
        var host = document.getElementById('monad-cross-host');
        if (host) {
          window.MonadCross.mount(host, STATE.arch, {
            onNavigate: function (nav) {
              if (!nav || !nav.target) return;
              setArchSub(nav.target);
              if (nav.target === 'vertical' && nav.layerId) {
                STATE.vertLayer = nav.layerId;
                STATE.vertCell = nav.cell != null ? String(nav.cell) : null;
                renderVertical(STATE.arch);
              }
              if (nav.target === 'horizontal' && nav.hour != null) {
                STATE.horizHour = String(nav.hour);
                renderHorizontal(STATE.arch);
              }
              if (nav.target === 'online') startLiveRhythm();
            },
          });
        }
      }
    } else if (window.MonadCross) {
      window.MonadCross.destroy();
    }
    if (STATE.archSub === 'vertical') renderVertical(STATE.arch);
    if (STATE.archSub === 'horizontal') renderHorizontal(STATE.arch);
    if (STATE.archSub === 'online') {
      ensureOnline();
      startLiveRhythm();
    } else if (STATE.sub === 'architecture') {
      stopLiveRhythm();
    }
  }

  function setSub(id) {
    if (id === 'rhythm') {
      id = 'architecture';
      STATE.sub = id;
      document.querySelectorAll('.monad-subtab').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-monad-sub') === id || b.getAttribute('data-monad-sub') === 'rhythm');
      });
      document.querySelectorAll('.monad-panel').forEach(function (p) {
        p.classList.toggle('active', p.id === 'monad-panel-' + id);
      });
      ensureArchitecture().then(function () { setArchSub('online'); startLiveRhythm(); });
      stopPoll();
      if (window.MonadCross) window.MonadCross.destroy();
      return;
    }
    STATE.sub = id;
    document.querySelectorAll('.monad-subtab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-monad-sub') === id);
    });
    document.querySelectorAll('.monad-panel').forEach(function (p) {
      p.classList.toggle('active', p.id === 'monad-panel-' + id);
    });
    if (id === 'architecture') ensureArchitecture();
    else stopLiveRhythm();
    if (id === 'chat') {
      startPoll();
      loadInbox().then(function () { return syncInbox(); }).catch(function () {});
    }
    else stopPoll();
    if (id !== 'architecture' && window.MonadCross) window.MonadCross.destroy();
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
      bits.push('<span class="monad-ok">● ' + esc(t('a.monad.live_model', 'живая Persona в Манаде')) + '</span>');
    } else if (s.lk_live_reply) {
      bits.push('<span class="monad-warn">● ' + esc(t('a.monad.need_key', 'нужен MONAD_API_KEY на Railway')) + '</span>');
    }
    if (STATE.personaHealth && STATE.personaHealth.note) {
      var myH = (STATE.status && STATE.status.human_id) || '';
      var myP = (STATE.status && STATE.status.persona) || (STATE.personaHealth.persona || '');
      var noteLow = String(STATE.personaHealth.note).toLowerCase();
      var showNote = !myP || noteLow.indexOf(String(myP).toLowerCase()) >= 0
        || (myH && noteLow.indexOf(String(myH).toLowerCase()) >= 0);
      if (showNote) bits.push('<span class="monad-muted">' + esc(STATE.personaHealth.note) + '</span>');
    }
    if (s.dashboard_url) {
      bits.push('<a href="' + esc(s.dashboard_url) + '" target="_blank" rel="noopener">' + esc(t('a.monad.dashboard', 'Dashboard Monad')) + '</a>');
    }
    if (s.note) bits.push('<span class="monad-muted">' + esc(s.note) + '</span>');
    el.innerHTML = bits.join(' · ');
  }

  function parseMetaField(m) {
    if (!m) return {};
    if (typeof m === 'string') {
      try { return JSON.parse(m); } catch (e) { return {}; }
    }
    return typeof m === 'object' ? m : {};
  }

  function inboxPreview(item) {
    var meta = parseMetaField(item.metadata);
    var body = String(item.body || '').replace(/\s+/g, ' ').trim();
    if (/^\[LK live\]|post_lk_chat_message/i.test(item.title || '') || meta.channel === 'neuroattention_lk') {
      var m = body.match(/Their message:\s*\n?(.+?)(?:\nReply NOW|$)/i);
      if (m && m[1]) body = m[1].trim();
      else if (body.length > 160) body = body.slice(0, 160) + '…';
    }
    return body.slice(0, 140);
  }

  function inboxDisplayTitle(item) {
    return item.display_title || item.title || t('a.monad.inbox_item', 'Сообщение');
  }
  function inboxDisplayBody(item) {
    return item.display_body || inboxPreview(item) || String(item.body || '');
  }
  function inboxDisplayFrom(item) {
    return item.display_from || item.from_agent || item.agent_id || t('a.monad.monad', 'Monad');
  }
  function inboxWhen(item) {
    if (!item.monad_created_at) return '';
    return String(item.monad_created_at).slice(0, 16).replace('T', ' ');
  }

  function findInboxItem(id) {
    return STATE.inbox.filter(function (x) { return x.item_id === id; })[0] || null;
  }

  function renderInboxDetail() {
    var view = document.getElementById('monad-inbox-view');
    var log = document.getElementById('monad-chat-log');
    var compose = document.querySelector('.monad-chat-compose');
    var toolbar = document.querySelector('.monad-chat-toolbar');
    var hint = document.querySelector('.monad-panel-chat .monad-muted');
    if (!view) return;
    var item = STATE.inboxViewId ? findInboxItem(STATE.inboxViewId) : null;
    if (!item) {
      view.style.display = 'none';
      if (log) log.style.display = '';
      if (compose) compose.style.display = '';
      if (toolbar) toolbar.style.display = '';
      if (hint) hint.style.display = '';
      return;
    }
    view.style.display = 'block';
    if (log) log.style.display = 'none';
    if (compose) compose.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
    if (hint) hint.style.display = 'none';
    var meta = parseMetaField(item.metadata);
    var chatId = meta.chat_id;
    view.innerHTML =
      '<div class="monad-inbox-detail">' +
      '<button type="button" class="btn btn-ghost monad-inbox-back" id="monad-inbox-back" style="font-size:12px;margin-bottom:0.65rem;">← ' +
      esc(t('a.monad.inbox_back', 'К списку')) + '</button>' +
      '<div class="monad-inbox-detail-head">' +
      '<h3 class="monad-inbox-detail-title">' + esc(inboxDisplayTitle(item)) + '</h3>' +
      '<p class="monad-muted monad-inbox-detail-meta">' +
      esc(t('a.monad.inbox_from', 'От')) + ': <strong>' + esc(inboxDisplayFrom(item)) + '</strong>' +
      (inboxWhen(item) ? ' · ' + esc(inboxWhen(item)) : '') +
      '</p></div>' +
      '<div class="monad-inbox-detail-body">' + esc(inboxDisplayBody(item)) + '</div>' +
      (chatId
        ? ('<p style="margin-top:1rem;"><button type="button" class="btn btn-primary" id="monad-inbox-open-chat" style="font-size:12px;">' +
          esc(t('a.monad.inbox_open_chat', 'Открыть связанный чат')) + '</button></p>')
        : '') +
      '</div>';
    var back = document.getElementById('monad-inbox-back');
    if (back) back.addEventListener('click', function () {
      STATE.inboxViewId = null;
      renderInbox();
      renderInboxDetail();
    });
    var openChatBtn = document.getElementById('monad-inbox-open-chat');
    if (openChatBtn && chatId) {
      openChatBtn.addEventListener('click', function () {
        STATE.inboxViewId = null;
        renderInboxDetail();
        openChat(chatId).catch(function () {});
      });
    }
  }

  function openInboxItem(id) {
    STATE.inboxViewId = id;
    api('/api/monad/inbox/' + encodeURIComponent(id) + '/read', { method: 'PATCH' }).catch(function () {});
    STATE.inbox = STATE.inbox.map(function (x) {
      return x.item_id === id ? Object.assign({}, x, { read_at: new Date().toISOString() }) : x;
    });
    renderInbox();
    renderInboxDetail();
  }

  function renderInbox() {
    var host = document.getElementById('monad-inbox-list');
    if (!host) return;
    if (STATE.inboxSyncing) {
      host.innerHTML = '<p class="monad-muted" style="padding:0.35rem;">' + esc(t('a.monad.inbox_syncing', 'Синхронизация…')) + '</p>';
      return;
    }
    if (!STATE.inbox.length) {
      host.innerHTML = '<p class="monad-muted" style="padding:0.35rem;">' +
        esc(t('a.monad.inbox_empty', 'Нажми Sync — подтянем inbox Persona из Манады.')) + '</p>';
      return;
    }
    host.innerHTML = STATE.inbox.map(function (item) {
      var unread = !item.read_at;
      var open = STATE.inboxViewId === item.item_id;
      var prev = inboxPreview(item);
      return '<div class="monad-inbox-row' + (unread ? ' unread' : '') + (open ? ' open' : '') + '" data-inbox-id="' + esc(item.item_id) + '">' +
        '<button type="button" class="monad-inbox-item" data-inbox-id="' + esc(item.item_id) + '">' +
        '<div class="monad-inbox-title">' + esc(inboxDisplayTitle(item)) + '</div>' +
        (prev ? '<div class="monad-inbox-prev">' + esc(prev) + '</div>' : '') +
        '<div class="monad-inbox-meta">' + esc(inboxDisplayFrom(item)) +
        (item.monad_created_at ? ' · ' + esc(inboxWhen(item)) : '') +
        '</div></button></div>';
    }).join('');
    host.querySelectorAll('.monad-inbox-item').forEach(function (b) {
      b.addEventListener('click', function () {
        openInboxItem(b.getAttribute('data-inbox-id'));
      });
    });
  }

  async function loadInbox() {
    try {
      var data = await api('/api/monad/inbox');
      STATE.inbox = data.threads || [];
      renderInbox();
    } catch (e) {
      var host = document.getElementById('monad-inbox-list');
      if (host) host.innerHTML = '<p class="monad-warn">' + esc(e.message) + '</p>';
    }
  }

  async function syncInbox() {
    if (STATE.inboxSyncing) return;
    STATE.inboxSyncing = true;
    renderInbox();
    try {
      var data = await api('/api/monad/inbox/sync', { method: 'POST', body: JSON.stringify({ limit: 50 }) });
      STATE.inbox = data.threads || [];
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      STATE.inboxSyncing = false;
      renderInbox();
    }
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
          var isVideo = /^video\//.test(a.mime || '') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(name);
          var isAudio = /^audio\//.test(a.mime || '') || /\.(mp3|m4a|wav|aac|flac)$/i.test(name);
          if (isImg && url) return '<a href="' + esc(url) + '" target="_blank" rel="noopener"><img class="monad-msg-img" src="' + esc(url) + '" alt="' + esc(name) + '"/></a>';
          if (isVideo && url) return '<div class="monad-msg-media"><video class="monad-msg-video" controls playsinline preload="metadata" src="' + esc(url) + '"></video>' +
            '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(name) + '</a></div>';
          if (isAudio && url) return '<div class="monad-msg-media"><audio class="monad-msg-audio" controls preload="metadata" src="' + esc(url) + '"></audio>' +
            '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(name) + '</a></div>';
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
    var last = STATE.messages[STATE.messages.length - 1];
    // Last bubble is from the human — Persona reply may still be in flight.
    if (last && last.role === 'you') {
      STATE.awaitingPersona = true;
      STATE.messages = STATE.messages.concat([{ role: 'monad', text: '…', meta: { typing: true } }]);
      renderMessages();
      renderPinned();
      startFastPoll();
      return;
    }
    STATE.awaitingPersona = false;
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

  // Our API takes small files (multer, 12 MB). Video/audio and anything bigger go browser → Monad
  // bucket directly (same uploader as «В Loom») and come back as a permanent link the chat can play.
  var ATTACH_DIRECT_BYTES = 10 * 1024 * 1024;
  function isDirectAttach(f) {
    return /^(video|audio)\//.test(f.type || '') || /\.(mp4|mov|m4v|mkv|webm|avi|wav|m4a|mp3|aac|flac)$/i.test(f.name || '') || f.size > ATTACH_DIRECT_BYTES;
  }

  async function uploadFiles(fileList) {
    if (!fileList || !fileList.length) return;
    if (!STATE.activeChatId) await createChat();
    var btn = document.getElementById('monad-chat-attach');
    if (btn) btn.disabled = true;
    try {
      for (var i = 0; i < fileList.length; i++) {
        var f = fileList[i];
        if (isDirectAttach(f)) {
          var item = { id: 'a' + Date.now() + '_' + i, file: f, name: f.name, size: f.size, state: 'queued', pct: 0 };
          LOOM.items.push(item);
          try {
            var fin = await loomUploadOne(item, { purpose: 'reference', note: 'вложение из ЛК-чата ' + STATE.activeChatId });
            LOOM.items = LOOM.items.filter(function (x) { return x !== item; }); renderLoomBar();
            STATE.pendingAttachments.push({
              name: f.name, url: fin.link || (fin.asset && fin.asset.r2_url) || '', mime: f.type || guessMime(f.name), size: f.size,
              asset_id: fin.asset && fin.asset.asset_id, kind: 'loom_asset',
            });
          } catch (e) {
            item.state = 'failed'; item.error = (e && e.message) || t('a.monad.attach_failed', 'не загрузилось'); renderLoomBar();
          }
          renderAttachmentsBar();
          continue;
        }
        var fd = new FormData();
        fd.append('file', f);
        var res = await fetch(apiBase() + '/api/monad/chats/' + encodeURIComponent(STATE.activeChatId) + '/upload', {
          method: 'POST', headers: authHeaders(false), body: fd,
        });
        var data = await res.json();
        if (!res.ok) throw new Error((data && data.error) || 'upload failed');
        STATE.pendingAttachments.push(data.attachment);
        renderAttachmentsBar();
      }
    } catch (err) {
      alert((err && err.message) || 'Upload error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function guessMime(name) {
    return /\.(mp4|m4v)$/i.test(name) ? 'video/mp4' : /\.mov$/i.test(name) ? 'video/quicktime' : /\.webm$/i.test(name) ? 'video/webm'
      : /\.mkv$/i.test(name) ? 'video/x-matroska' : /\.(m4a|aac)$/i.test(name) ? 'audio/mp4' : /\.mp3$/i.test(name) ? 'audio/mpeg'
      : /\.wav$/i.test(name) ? 'audio/wav' : 'application/octet-stream';
  }

  // ---- Loom direct upload: browser → Monad media bucket, bytes bypass our API ----
  // Contract: tvildanov/monad handoff/LOOM-DIRECT-UPLOAD.md. File.slice() streams from
  // disk per part, so a 20 GB take never sits in memory.
  var LOOM_MEDIA_RE = /\.(mp4|mov|m4v|mkv|webm|avi|jpe?g|png|heic|gif|webp|wav|m4a|mp3|aac|flac|srt)$/i;
  var LOOM_PART_CONCURRENCY = 3;
  var LOOM = { queue: [], active: false, items: [] };

  function fmtGb(bytes) {
    if (!bytes) return '0 МБ';
    return bytes >= 1e9 ? (bytes / 1e9).toFixed(2) + ' ГБ' : Math.round(bytes / 1e6) + ' МБ';
  }

  function renderLoomBar() {
    var host = document.getElementById('monad-loom-bar');
    if (!host) return;
    if (!LOOM.items.length) { host.innerHTML = ''; return; }
    host.innerHTML = LOOM.items.map(function (it) {
      var cls = 'monad-loom-item monad-loom-' + it.state;
      var label = it.state === 'queued' ? t('a.monad.loom_queued', 'в очереди')
        : it.state === 'uploading' ? it.pct + '%'
        : it.state === 'done' ? t('a.monad.loom_done', 'в Loom')
        : (it.error || t('a.monad.loom_failed', 'ошибка'));
      return '<div class="' + cls + '" title="' + esc(it.name) + '">' +
        '<div class="monad-loom-row"><span class="monad-loom-name">' + esc(it.name) + '</span>' +
        '<span class="monad-loom-size">' + fmtGb(it.size) + '</span>' +
        '<span class="monad-loom-state">' + esc(label) + '</span>' +
        (it.state === 'done' || it.state === 'failed' ? '<button type="button" data-loom-x="' + esc(it.id) + '" aria-label="close">×</button>' : '') +
        '</div>' +
        (it.state === 'uploading' ? '<div class="monad-loom-track"><div class="monad-loom-fill" style="width:' + it.pct + '%"></div></div>' : '') +
        '</div>';
    }).join('');
    host.querySelectorAll('[data-loom-x]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-loom-x');
        LOOM.items = LOOM.items.filter(function (x) { return x.id !== id; });
        renderLoomBar();
      });
    });
  }

  async function loomPutPart(url, blob, tries) {
    tries = tries || 4;
    for (var attempt = 1; ; attempt++) {
      try {
        var r = await fetch(url, { method: 'PUT', body: blob });
        if (!r.ok) throw new Error('PUT ' + r.status);
        var etag = r.headers.get('ETag') || r.headers.get('etag');
        if (!etag) throw new Error('no ETag (CORS ExposeHeaders?)');
        return etag.replace(/"/g, '');
      } catch (e) {
        if (attempt >= tries) throw e;
        await new Promise(function (res) { setTimeout(res, 1500 * Math.pow(2, attempt - 1)); });
      }
    }
  }

  async function loomUploadOne(item, opts) {
    opts = opts || {};
    var file = item.file;
    item.state = 'uploading'; item.pct = 0; renderLoomBar();
    var mime = file.type || guessMime(file.name);
    var init = await api('/api/monad/loom/upload/init', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, size: file.size, content_type: mime, note: opts.note }),
    });
    var completeBody = { key: init.key, filename: file.name, content_type: mime, purpose: opts.purpose, note: opts.note };
    if (init.mode === 'single') {
      await loomPutPart(init.put_url, file);
      item.pct = 100; renderLoomBar();
    } else {
      var parts = new Array(init.part_count);
      var next = 0, done = 0;
      var worker = async function () {
        while (next < init.part_count) {
          var i = next++;
          var start = i * init.part_size;
          var end = Math.min(file.size, start + init.part_size);
          parts[i] = { part_number: i + 1, etag: await loomPutPart(init.part_urls[i], file.slice(start, end)) };
          done++;
          item.pct = Math.round((done / init.part_count) * 100);
          renderLoomBar();
        }
      };
      try {
        var n = Math.min(LOOM_PART_CONCURRENCY, init.part_count);
        var workers = []; for (var w = 0; w < n; w++) workers.push(worker());
        await Promise.all(workers);
      } catch (e) {
        api('/api/monad/loom/upload/abort', { method: 'POST', body: JSON.stringify({ key: init.key, upload_id: init.upload_id }) }).catch(function () {});
        throw e;
      }
      completeBody.upload_id = init.upload_id;
      completeBody.parts = parts;
    }
    var fin = await api('/api/monad/loom/upload/complete', { method: 'POST', body: JSON.stringify(completeBody) });
    item.state = 'done'; item.asset = fin.asset; item.link = fin.link; renderLoomBar();
    return fin;
  }

  async function loomDrain() {
    if (LOOM.active) return;
    LOOM.active = true;
    var uploaded = [];
    try {
      while (LOOM.queue.length) {
        var item = LOOM.queue.shift();
        try {
          var fin = await loomUploadOne(item);
          uploaded.push({ name: item.name, size: item.size, asset_id: fin.asset && fin.asset.asset_id });
        } catch (e) {
          item.state = 'failed'; item.error = (e && e.message) || 'upload error'; renderLoomBar();
        }
      }
    } finally {
      LOOM.active = false;
    }
    if (uploaded.length) await loomAnnounce(uploaded);
  }

  // Tell Persona in this chat what just landed so the Loom chain starts (producer asks
  // about the project). Goes through the normal message route → plant_seed.
  async function loomAnnounce(uploaded) {
    var input = document.getElementById('monad-chat-input');
    var lines = uploaded.map(function (u) { return '• ' + u.name + ' (' + fmtGb(u.size) + ')'; });
    var text = t('a.monad.loom_announce', 'Загрузил в Loom напрямую в хранилище') + ' (' + uploaded.length + '):\n' + lines.join('\n') +
      '\n' + t('a.monad.loom_announce_tail', 'Файлы уже в каталоге loom.media.catalog.v1. Передай в Loom House — продюсер может задавать вопросы по проекту.');
    var prev = input ? input.value : '';
    if (input) input.value = text;
    try { await sendMessage(); } finally { if (input) input.value = prev; }
  }

  function loomEnqueue(fileList) {
    if (!fileList || !fileList.length) return;
    var added = 0;
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      if (!LOOM_MEDIA_RE.test(f.name) && !/^(video|audio|image)\//.test(f.type || '')) continue;
      var item = { id: 'l' + Date.now() + '_' + i, file: f, name: f.name, size: f.size, state: 'queued', pct: 0 };
      LOOM.items.push(item); LOOM.queue.push(item); added++;
    }
    if (!added) { alert(t('a.monad.loom_not_media', 'Это не медиафайл. В Loom идут видео, аудио и фото.')); return; }
    renderLoomBar();
    if (!STATE.activeChatId) { createChat().then(loomDrain); } else { loomDrain(); }
  }

  function bindLoomDrop() {
    var zone = document.querySelector('.monad-chat-main');
    if (!zone || zone.__loomBound) return;
    zone.__loomBound = true;
    var over = 0;
    zone.addEventListener('dragenter', function (e) { if (e.dataTransfer && e.dataTransfer.types && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { e.preventDefault(); over++; zone.classList.add('monad-loom-dragover'); } });
    zone.addEventListener('dragover', function (e) { if (zone.classList.contains('monad-loom-dragover')) e.preventDefault(); });
    zone.addEventListener('dragleave', function () { over = Math.max(0, over - 1); if (!over) zone.classList.remove('monad-loom-dragover'); });
    zone.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault(); over = 0; zone.classList.remove('monad-loom-dragover');
      uploadFiles(e.dataTransfer.files);
    });
    window.addEventListener('beforeunload', function (e) {
      if (LOOM.active || LOOM.items.some(function (x) { return x.state === 'uploading'; })) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  async function sendMessage() {
    var input = document.getElementById('monad-chat-input');
    if (!input) return;
    var text = String(input.value || '').trim();
    var loomAtts = (STATE.pendingAttachments || []).filter(function (a) { return a && a.kind === 'loom_asset' && a.asset_id; });
    if (!text && !(STATE.pendingAttachments || []).length) return;
    if (loomAtts.length) {
      // Persona and the clipper address files by asset_id; the link is for humans.
      text = (text ? text + '\n' : '') + loomAtts.map(function (a) {
        return '📎 ' + (/^audio\//.test(a.mime || '') ? t('a.monad.attach_audio', 'аудио') : t('a.monad.attach_video', 'видео')) + ' ' + a.name +
          ' (' + fmtGb(a.size) + ') → asset ' + a.asset_id + ' (reference)';
      }).join('\n');
    }
    // /api/monad/message rejects empty text; an attachment-only send gets a caption.
    if (!text) text = '📎 ' + (STATE.pendingAttachments || []).map(function (a) { return a.name || 'file'; }).join(', ');
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
      }
      var thr = await api('/api/monad/chats/' + encodeURIComponent(STATE.activeChatId));
      if (thr && thr.messages && thr.messages.length) STATE.messages = thr.messages;
      var last = STATE.messages[STATE.messages.length - 1];
      var personaAlreadyHere = last && last.role === 'monad' && !(last.meta && last.meta.typing);
      if (data && data.awaiting_persona && !personaAlreadyHere) {
        STATE.awaitingPersona = true;
        STATE.messages = STATE.messages.filter(function (m) { return !(m.meta && m.meta.typing); });
        last = STATE.messages[STATE.messages.length - 1];
        if (!last || last.role !== 'monad') {
          STATE.messages.push({ role: 'monad', text: '…', meta: { typing: true } });
        }
        renderMessages();
        await loadChats();
        startFastPoll();
      } else {
        STATE.awaitingPersona = false;
        renderMessages();
        await loadChats();
        startPoll();
      }
    } catch (err) {
      STATE.awaitingPersona = false;
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
        var hadTyping = STATE.messages.some(function (m) { return m.meta && m.meta.typing; });
        STATE.messages = data.messages;
        var last = STATE.messages[STATE.messages.length - 1];
        // Real Persona text arrived — stop waiting, drop «…».
        if (last && last.role === 'monad' && !(last.meta && last.meta.typing)) {
          STATE.awaitingPersona = false;
        } else if (STATE.awaitingPersona && (!last || last.role === 'you')) {
          // Keep typing indicator while Persona is still working — no resend timeout.
          STATE.messages = STATE.messages.concat([{ role: 'monad', text: '…', meta: { typing: true } }]);
        }
        if (
          STATE.messages.length !== before ||
          (data.imported > 0) ||
          STATE.awaitingPersona ||
          hadTyping
        ) {
          renderMessages();
        }
      }
    } catch (e) { /* quiet */ }
  }

  function startPoll() {
    stopPoll();
    if (!STATE.activeChatId) return;
    STATE.pollTimer = setInterval(pollReplies, 20000);
    pollReplies();
  }

  /**
   * Fast poll while waiting for Persona:
   *   ~5 min every 5s, then every 8s for as long as awaitingPersona.
   * When the reply arrives, fall back to the normal 20s poll.
   * Never show «Ответ не пришёл / напиши ещё раз» and never clear wait by timer.
   */
  function startFastPoll() {
    stopPoll();
    if (!STATE.activeChatId) return;
    var startedAt = Date.now();
    var phaseMs = 5000;
    function arm(ms) {
      stopPoll();
      phaseMs = ms;
      STATE.pollTimer = setInterval(function () {
        pollReplies().then(function () {
          if (!STATE.awaitingPersona) {
            stopPoll();
            startPoll();
            return;
          }
          var nextMs = (Date.now() - startedAt) < (5 * 60 * 1000) ? 5000 : 8000;
          if (nextMs !== phaseMs) arm(nextMs);
        });
      }, ms);
    }
    arm(5000);
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
    if (!a) return '<p class="monad-muted">' + esc(t('a.monad.pick_agent', 'Нажми агента — увидишь, зачем он нужен.')) + '</p>';
    var secs = Array.isArray(a.secondary_cells) ? a.secondary_cells.map(showCell).filter(Boolean) : [];
    var fn = a.function || a.function_ru || '';
    if (!fn && locLang() === 'en') fn = a.function_en || '';
    var html = '<div class="monad-agent-detail">';
    html += '<h4>' + esc(a.name || a.agent_id) + '</h4>';
    html += '<p class="monad-agent-type">' + esc(typeLabel(a.type)) + '</p>';
    if (fn) {
      html += '<div class="monad-agent-fn"><div class="monad-agent-fn-label">' + esc(t('a.monad.fn', 'Функция')) + '</div>' +
        '<p>' + esc(fn) + '</p></div>';
    } else {
      html += '<p class="monad-muted">' + esc(t('a.monad.fn_missing', 'Описание функции пока не пришло из Манады.')) + '</p>';
    }
    html += '<dl class="monad-dl monad-dl-human">';
    html += '<dt>' + esc(t('a.monad.cell', 'Ячейка')) + '</dt><dd>' + esc(a.cell ? showCell(a.cell) : t('a.monad.unplaced_one', 'без рассадки'));
    if (a.cell_sense) html += '<div class="monad-cell-sense">' + esc(a.cell_sense) + '</div>';
    html += '</dd>';
    if (secs.length) {
      html += '<dt>' + esc(t('a.monad.secondary', 'Ещё посты')) + '</dt><dd>' + esc(secs.join(', ')) + '</dd>';
    }
    if (a.contour) {
      html += '<dt>' + esc(t('a.monad.contour', 'Контур')) + '</dt><dd>' + esc(a.contour) + '</dd>';
    }
    if (a.project) {
      html += '<dt>' + esc(t('a.monad.project', 'Проект')) + '</dt><dd>' + esc(a.project) + '</dd>';
    }
    html += '<dt>' + esc(t('a.monad.owner', 'Владелец')) + '</dt><dd>' + esc(a.owner_name || a.owner || '—') + '</dd>';
    html += '<dt>' + esc(t('a.monad.status', 'Статус')) + '</dt><dd>' + esc(a.status || '—') + '</dd>';
    if (a.domains && a.domains.length) {
      html += '<dt>' + esc(t('a.monad.domains', 'Темы')) + '</dt><dd>' + esc(a.domains.join(', ')) + '</dd>';
    }
    if (a.actions_per_min != null || a.last_seen) {
      html += '<dt>' + esc(t('a.monad.live_activity', 'Сейчас')) + '</dt><dd>';
      if (a.actions_per_min != null) html += esc(String(a.actions_per_min)) + ' ' + esc(t('a.monad.act_min', 'акт/мин'));
      if (a.last_seen) html += (a.actions_per_min != null ? ' · ' : '') + esc(a.last_seen);
      if (a.live) html += ' · <span class="monad-ok">live</span>';
      html += '</dd>';
    }
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
    if (!found && STATE.live && STATE.live.agents) {
      found = STATE.live.agents.filter(function (a) { return a.agent_id === id; })[0] || null;
    }
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
    var html = '<p class="monad-viz-legend">' + esc(t('a.monad.vertical_help_short', 'Семь слоёв L1–L7. Нажми слой слева — справа откроются ветки L×L1…L×L7 с агентами.')) + '</p>';
    html += '<div class="monad-viz-split monad-viz-split-wide monad-vert-layout">';
    html += '<aside class="monad-spine-col" aria-label="vertical spine">';
    html += '<div class="monad-spine-title">' + esc(t('a.monad.spine', 'Вертикаль L1–L7')) + '</div>';
    layers.slice().reverse().forEach(function (n) {
      var label = n[locLang()] || n.ru || ('L' + n.layer);
      var on = (STATE.vertLayer === n.id) ? ' on' : '';
      var total = n.total || 0;
      html += '<button type="button" class="monad-spine-node' + on + '" data-layer="' + esc(n.id) + '" data-cell="">';
      html += '<span class="monad-spine-l">L' + esc(n.layer) + '</span>';
      html += '<span class="monad-spine-nm">' + esc(label) + '</span>';
      html += '<span class="monad-spine-code">' + total + ' ' + esc(t('a.monad.agents_short', 'аг.')) + '</span></button>';
    });
    html += '</aside>';
    html += '<div class="monad-vert-col">';
    if (!selected) {
      html += '<p class="monad-muted">' + esc(t('a.monad.vertical_pick_layer', 'Выбери слой слева — увидишь ветки и агентов на этом уровне.')) + '</p>';
    } else {
      var cells = (selected.cells || []).slice().sort(function (a, b) { return a.n - b.n; });
      html += '<div class="monad-vert-tree">';
      html += '<div class="monad-vert-tree-root">L' + esc(selected.layer) + ' · ' + esc(selected[locLang()] || selected.ru) + '</div>';
      html += '<div class="monad-vert-tree-branches">';
      cells.forEach(function (c, i) {
        var code = c.code || ('L' + selected.layer + 'xL' + c.n);
        var shown = showCell(code);
        var nm = c[locLang()] || c.ru || shown;
        var branchOn = (String(STATE.vertCell) === String(c.n)) ? ' on' : '';
        html += '<div class="monad-vert-tree-item" style="--i:' + i + '">';
        html += '<span class="monad-tree-elbow" aria-hidden="true"></span>';
        html += '<button type="button" class="monad-vert-branch' + branchOn + (c.occupied ? ' filled' : '') + '" data-layer="' + esc(selected.id) + '" data-cell="' + c.n + '">';
        html += '<span class="monad-vert-branch-code">' + esc(shown) + '</span>';
        html += '<span class="monad-vert-branch-nm">' + esc(nm) + '</span>';
        html += '<span class="monad-vert-branch-count">' + (c.count || 0) + ' ' + esc(t('a.monad.agents_short', 'аг.')) + '</span>';
        if ((c.agents || []).length) {
          html += '<span class="monad-vert-branch-chips">';
          (c.agents || []).slice(0, 4).forEach(function (a) { html += agentCard(a, 'tiny'); });
          html += '</span>';
        }
        html += '</button></div>';
      });
      html += '</div></div>';
    }
    html += '</div>';
    html += '<aside class="monad-viz-panel" id="monad-vert-side">';
    if (!selected) {
      html += '<p class="monad-muted">' + esc(t('a.monad.vertical_pick', 'Нажми ветку — функция поста и агенты.')) + '</p>';
      html += '<div id="monad-vert-agent-detail">' + (STATE.pickedAgent ? agentDetail(findAgent(STATE.pickedAgent)) : '') + '</div>';
    } else if (!selectedCell) {
      html += '<div class="monad-viz-kicker">L' + esc(selected.layer) + ' · ' + esc(selected[locLang()] || selected.ru) + '</div>';
      html += '<p class="monad-muted">' + esc(locField(selected, 'sense')) + '</p>';
      html += '<p class="monad-muted">' + esc(t('a.monad.layer_all_branches', 'Весь слой — выбери ветку L×Lj, чтобы увидеть смысл поста и агентов.')) + '</p>';
      html += '<div id="monad-vert-agent-detail">' + (STATE.pickedAgent ? agentDetail(findAgent(STATE.pickedAgent)) : '') + '</div>';
    } else {
      var agents = selectedCell.agents || [];
      var postFn = selectedCell.post_function || selectedCell[locLang()] || selectedCell.ru || '';
      html += '<div class="monad-viz-kicker">' + esc(showCell(selectedCell.code || ('L' + selected.layer + 'xL' + selectedCell.n))) + '</div>';
      html += '<h3 class="monad-viz-h">' + esc(postFn) + '</h3>';
      html += '<div class="monad-agent-fn"><div class="monad-agent-fn-label">' + esc(t('a.monad.post_sense', 'Смысл этого поста')) + '</div>';
      html += '<p>' + esc(postFn) + '. ' + esc(t('a.monad.post_in_layer', 'Это одна из семи функций слоя')) +
        ' L' + esc(selected.layer) + ' («' + esc(selected[locLang()] || selected.ru) + '»). ';
      html += esc(locField(selected, 'sense')) + '</p></div>';
      html += '<p class="monad-muted">' + agents.length + ' ' + esc(t('a.monad.agents_here', 'агентов в этой ветке')) + '.</p>';
      html += '<div class="monad-agent-list">';
      if (!agents.length) html += '<p class="monad-muted">' + esc(t('a.monad.no_agents', 'В этой ветке пока нет агентов.')) + '</p>';
      agents.forEach(function (a) { html += agentCard(a); });
      html += '</div>';
      html += '<div id="monad-vert-agent-detail">' + (STATE.pickedAgent ? agentDetail(findAgent(STATE.pickedAgent)) : '') + '</div>';
    }
    html += renderUnplaced(arch);
    html += '</aside></div>';
    host.innerHTML = html;
    host.querySelectorAll('.monad-spine-node').forEach(function (b) {
      b.addEventListener('click', function () {
        STATE.vertLayer = b.getAttribute('data-layer');
        STATE.vertCell = null;
        renderVertical(STATE.arch);
      });
    });
    host.querySelectorAll('.monad-vert-branch').forEach(function (b) {
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
    var html = '<p class="monad-viz-legend">' + esc(t('a.monad.horiz_help_short', 'Круг 12+1: люди на часах, DOM в центре. Нажми человека — справа контуры и агенты.')) + '</p>';
    html += '<div class="monad-viz-split monad-horiz-split">';
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
        html += '<div class="monad-person empty" style="left:' + pos.x.toFixed(2) + '%;top:' + pos.y.toFixed(2) + '%;" title="' + esc(t('a.monad.seat_reserved', 'Слот зарезервирован')) + '">' +
          '<div class="monad-muted">' + esc(t('a.monad.seat_empty', 'свободно')) + '</div></div>';
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
    html += '<aside class="monad-viz-panel monad-horiz-panel">';
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
      html += '<div class="monad-horiz-tree">';
      html += '<div class="monad-horiz-tree-root">' + esc(p.display_name || p.human_id) +
        '<span class="monad-muted"> · ' + selected.hour + ':00</span></div>';
      if (p.role) html += '<p class="monad-muted" style="margin:0.25rem 0 0.6rem;">' + esc(p.role) + '</p>';
      if (p.persona) {
        html += '<div class="monad-tree-node">';
        html += '<span class="monad-tree-elbow"></span>';
        html += '<div class="monad-tree-card">';
        html += '<div class="monad-tree-card-title">' + esc(t('a.monad.type_human', 'Персона человека')) + '</div>';
        html += '<div class="monad-agent-list">' + agentCard(p.persona) + '</div>';
        if (p.persona.function) html += '<p class="monad-tree-fn">' + esc(p.persona.function) + '</p>';
        html += '</div></div>';
      }
      html += '<div class="monad-tree-section">' + esc(t('a.monad.contours_from_person', 'Контуры')) + '</div>';
      if (!(p.contours || []).length) html += '<p class="monad-muted">' + esc(t('a.monad.no_contour', 'нет контура')) + '</p>';
      (p.contours || []).forEach(function (g, gi) {
        html += '<div class="monad-tree-node" style="--i:' + gi + '">';
        html += '<span class="monad-tree-elbow"></span>';
        html += '<div class="monad-tree-card">';
        html += '<div class="monad-tree-card-title">' + esc(locLang() === 'en' ? (g.label_en || g.label) : g.label) + '</div>';
        html += '<div class="monad-agent-list">';
        (g.agents || []).forEach(function (a) { html += agentCard(a); });
        html += '</div></div></div>';
      });
      html += '<div class="monad-tree-section">' + esc(t('a.monad.projects_of_person', 'Проекты')) + '</div>';
      if (!(p.projects || []).length) html += '<p class="monad-muted">' + esc(t('a.monad.no_projects', 'нет проекта')) + '</p>';
      (p.projects || []).forEach(function (g, gi) {
        html += '<div class="monad-tree-node project" style="--i:' + gi + '">';
        html += '<span class="monad-tree-elbow"></span>';
        html += '<div class="monad-tree-card project">';
        html += '<div class="monad-tree-card-title">' + esc(locLang() === 'en' ? (g.label_en || g.label) : g.label) + '</div>';
        html += '<div class="monad-agent-list">';
        (g.agents || []).forEach(function (a) { html += agentCard(a); });
        html += '</div></div></div>';
      });
      html += '<div id="monad-horiz-agent-detail">' + (STATE.pickedAgent ? agentDetail(findAgent(STATE.pickedAgent)) : '') + '</div>';
      html += '</div>';
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

  function renderRhythmBlock(hostId, rhythm, showLiveBtn) {
    var host = document.getElementById(hostId);
    if (!host) return;
    rhythm = rhythm || (STATE.rhythm && (STATE.rhythm.rhythm || STATE.rhythm));
    if (!rhythm) {
      host.innerHTML = '<p class="monad-muted">' + esc(t('a.monad.loading', 'Загрузка…')) + '</p>';
      return;
    }
    var layers = rhythm.layers || [];
    if (!STATE.rhythmDisplay.length) {
      STATE.rhythmDisplay = layers.map(function (L) { return L.level || 0; });
    }
    var html = '<div class="monad-rhythm-head">';
    html += '<div><strong>' + esc(t('a.monad.system_rhythm', 'Ритм системы Monad')) + '</strong> ';
    if (rhythm.system) {
      html += '<span class="monad-badge status-' + esc(rhythm.system.status || '') + '">' + esc(rhythm.system.status || '—') + '</span>';
    }
    html += '<p class="monad-muted" style="margin:0.35rem 0 0;">' + esc(t('a.monad.rhythm_help_short', 'Активность слоёв L1–L7 и агентов. «Живой ритм» обновляет данные каждые ~1.2 с.')) + '</p></div>';
    if (showLiveBtn !== false) {
      html += '<button type="button" id="monad-rhythm-live" class="btn ' + (STATE.liveRhythm ? 'btn-primary' : 'btn-ghost') + '" style="font-size:12px;">' +
        esc(STATE.liveRhythm ? t('a.monad.live_off', 'Выключить живой ритм') : t('a.monad.live_on', 'Живой ритм')) + '</button>';
    }
    html += '</div><div class="monad-eq-live">';
    layers.forEach(function (L, i) {
      var label = L[locLang()] || L.ru || L.id;
      var unavailable = L.available === false || L.level == null;
      var lvl = unavailable ? 0 : (STATE.rhythmDisplay[i] != null ? STATE.rhythmDisplay[i] : (L.level || 0));
      var pct = Math.round(lvl * 100);
      html += '<div class="monad-eq-col' + (unavailable ? ' unavailable' : '') + '">';
      html += '<div class="monad-eq-col-bar"><i style="height:' + (unavailable ? 6 : Math.max(6, pct)) + '%"></i></div>';
      html += '<div class="monad-eq-col-label"><code>' + esc(L.id || '') + '</code> ' + esc(label) + '</div>';
      html += '<div class="monad-eq-col-val">' + (unavailable ? 'n/a' : (pct + '%')) +
        (L.agents_in_layer != null ? ' · ' + L.agents_in_layer : '') + '</div></div>';
    });
    html += '</div>';
    if (rhythm.updated_at) {
      html += '<p class="monad-muted" style="margin-top:0.5rem;font-size:11px;">' +
        esc(t('a.monad.updated', 'Обновлено')) + ': ' + esc(String(rhythm.updated_at).slice(0, 19).replace('T', ' ')) +
        (rhythm.source ? ' · ' + esc(rhythm.source) : '') + '</p>';
    }
    host.innerHTML = html;
    var liveBtn = document.getElementById('monad-rhythm-live');
    if (liveBtn) {
      liveBtn.addEventListener('click', function () {
        if (STATE.liveRhythm) stopLiveRhythm();
        else startLiveRhythm();
        renderOnline();
      });
    }
  }

  function renderOnlineAgentDetail(agentId) {
    var box = document.getElementById('monad-online-agent-detail');
    if (!box) return;
    if (!agentId) { box.innerHTML = '<p class="monad-muted">' + esc(t('a.monad.pick_agent', 'Нажми агента — детали.')) + '</p>'; return; }
    box.innerHTML = agentDetail(findAgent(agentId));
    bindAgentClicks(box, 'monad-online-agent-detail');
  }

  function renderOnline() {
    var host = document.getElementById('monad-online');
    if (!host) return;
    var live = STATE.live || {};
    var rhythm = (live.rhythm) || (STATE.rhythm && (STATE.rhythm.rhythm || STATE.rhythm));
    if (live.rhythm) STATE.rhythm = { rhythm: live.rhythm };

    var html = '<p class="monad-viz-legend">' + esc(t('a.monad.online_help', 'Онлайн Монада: ритм слоёв, карта агентов как в офисе, поиск и детали.')) + '</p>';
    html += '<div class="monad-online-search-row">';
    html += '<input type="search" id="monad-agent-search" class="monad-agent-search" placeholder="' + esc(t('a.monad.search_agent', 'Поиск агента, контура, ячейки…')) + '" value="' + esc(STATE.agentSearch || '') + '">';
    html += '<button type="button" id="monad-agent-search-btn" class="btn btn-ghost" style="font-size:12px;">' + esc(t('a.monad.search', 'Найти')) + '</button>';
    html += '</div>';
    html += '<div class="monad-online-grid">';
    html += '<section class="monad-online-rhythm-wrap"><div id="monad-online-rhythm"></div></section>';
    html += '<section class="monad-online-office-wrap"><div id="monad-office-host"></div></section>';
    html += '<aside class="monad-online-side"><div id="monad-online-agent-detail"><p class="monad-muted">' +
      esc(t('a.monad.pick_agent', 'Нажми агента на карте офиса.')) + '</p></div></aside>';
    html += '</div>';
    host.innerHTML = html;

    renderRhythmBlock('monad-online-rhythm', rhythm, true);

    if (window.MonadOffice) {
      var officeHost = document.getElementById('monad-office-host');
      window.MonadOffice.mount(officeHost, {
        onPick: function (id) {
          STATE.pickedAgent = id;
          renderOnlineAgentDetail(id);
        },
      });
      window.MonadOffice.render(live);
      if (STATE.agentSearch) window.MonadOffice.setFilter(STATE.agentSearch);
    }

    var searchInp = document.getElementById('monad-agent-search');
    var searchBtn = document.getElementById('monad-agent-search-btn');
    function runSearch() {
      STATE.agentSearch = searchInp ? String(searchInp.value || '').trim() : '';
      if (window.MonadOffice) window.MonadOffice.setFilter(STATE.agentSearch);
      if (STATE.agentSearch.length >= 2) {
        api('/api/monad/agents/search?q=' + encodeURIComponent(STATE.agentSearch)).then(function (data) {
          if (data.agents && data.agents.length === 1) {
            STATE.pickedAgent = data.agents[0].agent_id;
            renderOnlineAgentDetail(STATE.pickedAgent);
          }
        }).catch(function () {});
      }
    }
    if (searchBtn) searchBtn.addEventListener('click', runSearch);
    if (searchInp) {
      searchInp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); runSearch(); }
      });
    }
    if (STATE.pickedAgent) renderOnlineAgentDetail(STATE.pickedAgent);
  }

  async function ensureOnline() {
    var host = document.getElementById('monad-online');
    if (!host) return;
    if (!STATE.live) host.innerHTML = '<p class="monad-muted">' + esc(t('a.monad.loading', 'Загрузка…')) + '</p>';
    try {
      STATE.live = await api('/api/monad/live');
      if (STATE.live && STATE.live.rhythm) STATE.rhythm = { rhythm: STATE.live.rhythm };
      renderOnline();
    } catch (err) {
      host.innerHTML = '<p class="monad-warn">' + esc((err.data && err.data.error) || err.message) + '</p>';
    }
  }

  function renderRhythm(rhythm) {
    renderRhythmBlock('monad-rhythm', rhythm, true);
  }
  function applyRhythmBars() {
    ['monad-rhythm', 'monad-online-rhythm'].forEach(function (hostId) {
      var host = document.getElementById(hostId);
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
      var onOnline = STATE.sub === 'architecture' && STATE.archSub === 'online';
      if (!STATE.liveRhythm || !onOnline) { stopLiveRhythm(); return; }
      api('/api/monad/live').then(function (data) {
        STATE.live = data;
        if (data && data.rhythm) STATE.rhythm = { rhythm: data.rhythm };
        var layers = rhythmLayers();
        if (STATE.rhythmDisplay.length !== layers.length) {
          STATE.rhythmDisplay = layers.map(function (L) { return L.level || 0; });
        }
        renderRhythmBlock('monad-online-rhythm', data.rhythm, false);
        if (window.MonadOffice) window.MonadOffice.render(data);
      }).catch(function () {});
    }, 1500);
    if (!STATE.rhythmRaf) STATE.rhythmRaf = window.requestAnimationFrame(tickRhythmRaf);
  }
  function stopLiveRhythm() {
    STATE.liveRhythm = false;
    if (STATE.rhythmTimer) { clearInterval(STATE.rhythmTimer); STATE.rhythmTimer = null; }
    if (STATE.rhythmRaf) { window.cancelAnimationFrame(STATE.rhythmRaf); STATE.rhythmRaf = null; }
  }
  async function ensureArchitecture() {
    if (STATE.arch) {
      if (STATE.archSub === 'vertical') renderVertical(STATE.arch);
      else if (STATE.archSub === 'horizontal') renderHorizontal(STATE.arch);
      else if (STATE.archSub === 'online') ensureOnline();
      else if (STATE.archSub === 'cross' && window.MonadCross) {
        var host = document.getElementById('monad-cross-host');
        if (host) {
          window.MonadCross.mount(host, STATE.arch, {
            onNavigate: function (nav) {
              if (!nav || !nav.target) return;
              setArchSub(nav.target);
              if (nav.target === 'vertical' && nav.layerId) {
                STATE.vertLayer = nav.layerId;
                STATE.vertCell = nav.cell != null ? String(nav.cell) : null;
                renderVertical(STATE.arch);
              }
              if (nav.target === 'horizontal' && nav.hour != null) {
                STATE.horizHour = String(nav.hour);
                renderHorizontal(STATE.arch);
              }
              if (nav.target === 'online') startLiveRhythm();
            },
          });
        }
      }
      return;
    }
    try {
      STATE.arch = await api('/api/monad/architecture');
      setArchSub(STATE.archSub);
    } catch (err) {
      var msg = (err.data && err.data.error) || err.message;
      var v = document.getElementById('monad-vertical');
      var h = document.getElementById('monad-horizontal');
      var c = document.getElementById('monad-cross-host');
      if (v) v.innerHTML = '<p class="monad-warn">' + esc(msg) + '</p>';
      if (h) h.innerHTML = '<p class="monad-warn">' + esc(msg) + '</p>';
      if (c) c.innerHTML = '<p class="monad-warn">' + esc(msg) + '</p>';
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
    try { STATE.personaHealth = await api('/api/monad/persona/health'); }
    catch (e) { STATE.personaHealth = null; }
    renderStatusBar();
    try { await loadChats(); }
    catch (e) {
      var box = document.getElementById('monad-chat-log');
      if (box) box.innerHTML = '<p class="monad-warn">' + esc(e.message) + '</p>';
    }
    if (STATE.sub === 'chat') {
      try { await loadInbox(); await syncInbox(); } catch (e) { /* inbox optional */ }
    }
    STATE.loaded = true;
  }

  function onTabOpen() {
    mount().then(function () {
      if (STATE.sub === 'architecture') ensureArchitecture();
      if (STATE.sub === 'rhythm') ensureRhythm();
    });
  }

  function wire() {
    document.querySelectorAll('.monad-subtab').forEach(function (b) {
      b.addEventListener('click', function () { setSub(b.getAttribute('data-monad-sub')); });
    });
    document.querySelectorAll('.monad-arch-subtab').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!STATE.arch && STATE.sub === 'architecture') {
          ensureArchitecture().then(function () { setArchSub(b.getAttribute('data-monad-arch')); });
        } else {
          setArchSub(b.getAttribute('data-monad-arch'));
        }
      });
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
    var loomFile = document.getElementById('monad-loom-file');
    var loomBtn = document.getElementById('monad-loom-upload');
    if (loomBtn && loomFile) {
      loomBtn.addEventListener('click', function () { loomFile.click(); });
      loomFile.addEventListener('change', function () {
        loomEnqueue(loomFile.files); loomFile.value = '';
      });
    }
    bindLoomDrop();
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
        if (window.MonadCross) window.MonadCross.destroy();
        STATE.arch = null; STATE.rhythm = null; STATE.status = null; STATE.inbox = []; STATE.live = null;
        onTabOpen();
      });
    }
    var inboxSync = document.getElementById('monad-inbox-sync');
    if (inboxSync) inboxSync.addEventListener('click', function () { syncInbox().catch(function (e) { alert(e.message); }); });
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
