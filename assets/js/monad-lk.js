/**
 * Monad LK tab — chat + vertical/horizontal architecture + rhythm viz.
 * Visible only for founder/superadmin. Talks to /api/monad/* (server holds the key).
 */
(function () {
  'use strict';

  var STATE = {
    loaded: false,
    status: null,
    arch: null,
    rhythm: null,
    sub: 'chat',
    chatLog: [],
  };

  function t(key, fallback) {
    try {
      if (typeof window.t === 'function') return window.t(key, fallback);
    } catch (e) {}
    return fallback || key;
  }

  function apiBase() {
    return window.AUTH_API || window.API_BASE || 'https://neuroattention-api-production.up.railway.app';
  }

  function token() {
    if (typeof window.naGetToken === 'function') return window.naGetToken();
    try { return localStorage.getItem('na_token'); } catch (e) { return null; }
  }

  function authHeaders() {
    var tok = token();
    var h = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (tok) h.Authorization = 'Bearer ' + tok;
    return h;
  }

  function isMonadRole(user) {
    if (!user) return false;
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
      err.status = res.status;
      err.data = data;
      throw err;
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
    if (s.dashboard_url) {
      bits.push('<a href="' + esc(s.dashboard_url) + '" target="_blank" rel="noopener">' + esc(t('a.monad.dashboard', 'Dashboard Monad')) + '</a>');
    }
    if (s.note) bits.push('<span class="monad-muted">' + esc(s.note) + '</span>');
    el.innerHTML = bits.join(' · ');
  }

  function appendChat(role, text, meta) {
    STATE.chatLog.push({ role: role, text: text, meta: meta || null, at: new Date().toISOString() });
    var box = document.getElementById('monad-chat-log');
    if (!box) return;
    var div = document.createElement('div');
    div.className = 'monad-msg monad-msg-' + role;
    div.innerHTML = '<div class="monad-msg-body">' + esc(text) + '</div>' +
      (meta ? '<div class="monad-msg-meta">' + esc(meta) + '</div>' : '');
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  async function sendMessage() {
    var input = document.getElementById('monad-chat-input');
    if (!input) return;
    var text = String(input.value || '').trim();
    if (!text) return;
    input.value = '';
    appendChat('you', text);
    var btn = document.getElementById('monad-chat-send');
    if (btn) btn.disabled = true;
    try {
      var data = await api('/api/monad/message', {
        method: 'POST',
        body: JSON.stringify({ text: text }),
      });
      var seedId = '';
      try {
        if (data.result && data.result.seed_id) seedId = data.result.seed_id;
        else if (data.result && data.result.id) seedId = data.result.id;
        else if (typeof data.result === 'string') seedId = data.result.slice(0, 80);
      } catch (e) {}
      appendChat('monad', t('a.monad.sent_ok', 'Семя посажено в Monad. Агенты подхватят.'),
        (data.human_id ? 'human=' + data.human_id : '') + (seedId ? ' · ' + seedId : ''));
    } catch (err) {
      appendChat('err', (err.data && err.data.error) || err.message || 'Error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

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
        html += '<span class="bn">' + esc(empty ? '—' : (b.name || b.agent_id)) + '</span>';
        html += '</div>';
      });
      html += '</div></div>';
    });
    html += '</div>';
    html += '<p class="monad-muted" style="margin-top:0.75rem;">' +
      esc(t('a.monad.vertical_note', 'Вертикаль 7×7 — MVP: ядра × до 7 агентов по доменам. Полная матрица — в спеках Monad.')) +
      '</p>';
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
      var r = 42; // % of container
      var x = 50 + r * Math.cos(rad);
      var y = 50 + r * Math.sin(rad);
      html += '<div class="monad-person' + (p.is_me ? ' me' : '') + '" style="left:' + x.toFixed(2) + '%;top:' + y.toFixed(2) + '%;"';
      html += ' title="' + esc(p.human_id) + ' · ' + (p.agents || 0) + ' agents">';
      html += '<div class="monad-person-name">' + esc(p.display_name || p.human_id) + '</div>';
      html += '<div class="monad-muted">' + esc(p.human_id) + (p.is_me ? ' · you' : '') + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
    if (h.extra_humans) {
      html += '<p class="monad-muted">' + esc(t('a.monad.more_humans', 'Ещё людей за кольцом')) + ': ' + h.extra_humans + '</p>';
    }
    host.innerHTML = html;
  }

  function renderRhythm(rhythm) {
    var host = document.getElementById('monad-rhythm');
    if (!host || !rhythm) return;
    var lang = (document.documentElement.lang || 'ru').slice(0, 2);
    var html = '<div class="monad-eq">';
    (rhythm.layers || []).forEach(function (L) {
      var label = L[lang] || L.ru || L.id;
      var pct = Math.round((L.level || 0) * 100);
      html += '<div class="monad-eq-row">';
      html += '<div class="monad-eq-label">' + esc(label) + '</div>';
      html += '<div class="monad-eq-bar"><div class="monad-eq-fill" style="width:' + pct + '%"></div></div>';
      html += '<div class="monad-eq-val">' + pct + '%</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<p class="monad-muted" style="margin-top:0.75rem;">' +
      esc(rhythm.note || t('a.monad.rhythm_note', 'Ритм пока синтетический (из статусов агентов), пока Monad не отдаёт JSON /api/rhythm.')) +
      '</p>';
    host.innerHTML = html;
  }

  async function ensureArchitecture() {
    if (STATE.arch) {
      renderVertical(STATE.arch);
      renderHorizontal(STATE.arch);
      return;
    }
    var v = document.getElementById('monad-vertical');
    var h = document.getElementById('monad-horizontal');
    if (v) v.innerHTML = '<p class="monad-muted">' + esc(t('a.monad.loading', 'Загрузка…')) + '</p>';
    if (h) h.innerHTML = '<p class="monad-muted">' + esc(t('a.monad.loading', 'Загрузка…')) + '</p>';
    try {
      STATE.arch = await api('/api/monad/architecture');
      renderVertical(STATE.arch);
      renderHorizontal(STATE.arch);
    } catch (err) {
      var msg = (err.data && err.data.error) || err.message;
      if (v) v.innerHTML = '<p class="monad-warn">' + esc(msg) + '</p>';
      if (h) h.innerHTML = '<p class="monad-warn">' + esc(msg) + '</p>';
    }
  }

  async function ensureRhythm() {
    var host = document.getElementById('monad-rhythm');
    if (STATE.rhythm) { renderRhythm(STATE.rhythm.rhythm || STATE.rhythm); return; }
    if (host) host.innerHTML = '<p class="monad-muted">' + esc(t('a.monad.loading', 'Загрузка…')) + '</p>';
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
    try {
      STATE.status = await api('/api/monad/status');
    } catch (err) {
      STATE.status = { configured: false, note: (err.data && err.data.error) || err.message };
    }
    renderStatusBar();
    if (!STATE.loaded) {
      STATE.loaded = true;
      appendChat('monad', t('a.monad.welcome',
        'Привет. Пиши Манаде от своего human-профиля. Сообщение станет семенем (plant_seed) в Monad.'));
    }
  }

  function onTabOpen() {
    mount().then(function () {
      if (STATE.sub === 'vertical' || STATE.sub === 'horizontal') ensureArchitecture();
      if (STATE.sub === 'rhythm') ensureRhythm();
    });
  }

  function wire() {
    document.querySelectorAll('.monad-subtab').forEach(function (b) {
      b.addEventListener('click', function () {
        setSub(b.getAttribute('data-monad-sub'));
      });
    });
    var send = document.getElementById('monad-chat-send');
    var input = document.getElementById('monad-chat-input');
    if (send) send.addEventListener('click', sendMessage);
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }
    var refresh = document.getElementById('monad-refresh');
    if (refresh) {
      refresh.addEventListener('click', function () {
        STATE.arch = null;
        STATE.rhythm = null;
        STATE.status = null;
        onTabOpen();
      });
    }
  }

  // Public hooks for account.html
  window.MonadLK = {
    showTabButton: showTabButton,
    onLogin: function (user) {
      showTabButton(user);
    },
    onTab: onTabOpen,
    isRole: isMonadRole,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
