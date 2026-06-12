/* ============================================================================
   Fullscreen overlay — shared component (R1 + R3)
   ----------------------------------------------------------------------------
   window.mountFullscreenOverlay(content, opts) -> handle

   content : HTMLElement | string(html) | function(bodyEl){...}
   opts:
     title?        : string                 — small heading top-left
     subtitle?     : string                 — dim line under the title
     actions?      : [{ icon, title, label, onClick, accent }]  — extra top-right buttons
     onClose?      : function                — called after the overlay is removed
     onMinimize?   : function                — if set, a "–" button appears
     accent?       : string (css color)      — themes the chrome (default cyan)
     className?    : string                  — extra class on the root
     backdropClose?: bool                    — click on dim backdrop closes (default false)

   Returns: { el, body, close(), setTitle(t) }

   Behaviour:
     • fixed 100vw x 100vh, z-index above the ЛК header/tabs
     • Esc closes
     • locks body scroll while open, restores it on close
     • stacks safely if more than one overlay is opened
   ========================================================================== */
(function () {
  'use strict';

  var Z_BASE = 4000;          // above ЛК header / tabs
  var openStack = [];         // active overlays (for Esc + scroll-lock bookkeeping)

  // Inject styles once.
  function ensureStyles() {
    if (document.getElementById('na-fs-overlay-styles')) return;
    var css = ''
      + '.na-fs-overlay{position:fixed;inset:0;width:100vw;height:100vh;'
      + 'display:flex;flex-direction:column;background:rgba(6,8,11,0.86);'
      + 'backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);'
      + 'animation:naFsIn .18s ease-out;--na-fs-accent:var(--accent-cyan,#39d3c3);}'
      + '.na-fs-overlay.na-fs-closing{animation:naFsOut .16s ease-in forwards;}'
      + '@keyframes naFsIn{from{opacity:0;}to{opacity:1;}}'
      + '@keyframes naFsOut{from{opacity:1;}to{opacity:0;}}'
      + '.na-fs-chrome{position:absolute;top:0;left:0;right:0;z-index:5;'
      + 'display:flex;align-items:center;gap:.75rem;padding:.85rem 1.1rem;'
      + 'pointer-events:none;}'
      + '.na-fs-chrome > *{pointer-events:auto;}'
      + '.na-fs-titlewrap{display:flex;flex-direction:column;gap:1px;min-width:0;}'
      + '.na-fs-title{font-family:"Space Grotesk",sans-serif;font-size:13px;'
      + 'font-weight:600;color:var(--text-primary,#fff);letter-spacing:.02em;'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.na-fs-subtitle{font-size:11px;color:var(--text-dim,#7c8794);'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
      + '.na-fs-actions{margin-left:auto;display:flex;align-items:center;gap:.4rem;}'
      + '.na-fs-btn{display:inline-flex;align-items:center;justify-content:center;'
      + 'gap:.35rem;height:32px;min-width:32px;padding:0 .55rem;border-radius:9px;'
      + 'border:1px solid rgba(255,255,255,0.12);background:rgba(20,24,30,0.72);'
      + 'color:var(--text-secondary,#c3ccd6);font-size:13px;cursor:pointer;'
      + 'font-family:inherit;line-height:1;transition:background .12s,border-color .12s,color .12s;}'
      + '.na-fs-btn:hover{background:rgba(36,42,52,0.92);color:var(--text-primary,#fff);'
      + 'border-color:var(--na-fs-accent);}'
      + '.na-fs-btn.na-fs-accent{border-color:var(--na-fs-accent);'
      + 'color:var(--na-fs-accent);}'
      + '.na-fs-btn svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;}'
      + '.na-fs-body{flex:1;min-height:0;overflow:auto;padding:3.4rem 0 0;}'
      + '.na-fs-no-scroll{overflow:hidden !important;}';
    var s = document.createElement('style');
    s.id = 'na-fs-overlay-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function iconSvg(name) {
    switch (name) {
      case 'close': return '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      case 'minimize': return '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>';
      case 'invite': return '<svg viewBox="0 0 24 24"><path d="M16 11a4 4 0 1 0-4-4M3 21v-1a6 6 0 0 1 6-6h0M18 14v6M21 17h-6"/></svg>';
      default: return '';
    }
  }

  function makeBtn(spec) {
    var b = document.createElement('button');
    b.className = 'na-fs-btn' + (spec.accent ? ' na-fs-accent' : '');
    if (spec.title) b.title = spec.title;
    var inner = '';
    if (spec.icon) inner += iconSvg(spec.icon);
    if (spec.label) inner += '<span>' + spec.label + '</span>';
    b.innerHTML = inner || (spec.html || '');
    if (spec.onClick) b.addEventListener('click', function (e) { spec.onClick(e); });
    return b;
  }

  function lockScroll() {
    if (openStack.length === 1) {
      document.body.dataset.naFsPrevOverflow = document.body.style.overflow || '';
      document.body.classList.add('na-fs-no-scroll');
    }
  }
  function unlockScroll() {
    if (openStack.length === 0) {
      document.body.classList.remove('na-fs-no-scroll');
      document.body.style.overflow = document.body.dataset.naFsPrevOverflow || '';
      delete document.body.dataset.naFsPrevOverflow;
    }
  }

  function onKey(e) {
    if (e.key === 'Escape' && openStack.length) {
      var top = openStack[openStack.length - 1];
      if (top && top._escClosable !== false) top.close();
    }
  }

  function mountFullscreenOverlay(content, opts) {
    ensureStyles();
    opts = opts || {};

    var root = document.createElement('div');
    root.className = 'na-fs-overlay' + (opts.className ? ' ' + opts.className : '');
    root.style.zIndex = String(Z_BASE + openStack.length * 10);
    if (opts.accent) root.style.setProperty('--na-fs-accent', opts.accent);

    // Chrome (title + action buttons)
    var chrome = document.createElement('div');
    chrome.className = 'na-fs-chrome';

    var titleWrap = document.createElement('div');
    titleWrap.className = 'na-fs-titlewrap';
    var titleEl = document.createElement('div');
    titleEl.className = 'na-fs-title';
    titleEl.textContent = opts.title || '';
    titleWrap.appendChild(titleEl);
    var subEl = null;
    if (opts.subtitle) {
      subEl = document.createElement('div');
      subEl.className = 'na-fs-subtitle';
      subEl.textContent = opts.subtitle;
      titleWrap.appendChild(subEl);
    }
    chrome.appendChild(titleWrap);

    var actions = document.createElement('div');
    actions.className = 'na-fs-actions';
    chrome.appendChild(actions);

    // Body
    var body = document.createElement('div');
    body.className = 'na-fs-body';
    if (typeof content === 'string') body.innerHTML = content;
    else if (content instanceof Node) body.appendChild(content);
    // function content is invoked after handle exists (below)

    root.appendChild(chrome);
    root.appendChild(body);

    var closed = false;
    var handle = {
      el: root,
      body: body,
      _escClosable: opts.escClosable !== false,
      setTitle: function (t) { titleEl.textContent = t || ''; },
      setSubtitle: function (t) { if (subEl) subEl.textContent = t || ''; },
      close: function () {
        if (closed) return;
        closed = true;
        var idx = openStack.indexOf(handle);
        if (idx >= 0) openStack.splice(idx, 1);
        root.classList.add('na-fs-closing');
        setTimeout(function () {
          if (root.parentNode) root.parentNode.removeChild(root);
          unlockScroll();
          if (openStack.length === 0) document.removeEventListener('keydown', onKey);
          if (typeof opts.onClose === 'function') { try { opts.onClose(); } catch (e) {} }
        }, 160);
      }
    };

    // Custom action buttons (left of close), then optional minimize, then close.
    (opts.actions || []).forEach(function (a) { actions.appendChild(makeBtn(a)); });
    if (typeof opts.onMinimize === 'function') {
      actions.appendChild(makeBtn({
        icon: 'minimize', title: 'Свернуть',
        onClick: function () { opts.onMinimize(handle); }
      }));
    }
    actions.appendChild(makeBtn({
      icon: 'close', title: 'Закрыть (Esc)',
      onClick: function () { handle.close(); }
    }));

    if (opts.backdropClose) {
      root.addEventListener('mousedown', function (e) {
        if (e.target === root) handle.close();
      });
    }

    document.body.appendChild(root);
    openStack.push(handle);
    lockScroll();
    if (openStack.length === 1) document.addEventListener('keydown', onKey);

    if (typeof content === 'function') {
      try { content(body, handle); } catch (e) { console.warn('[fs-overlay] content fn:', e); }
    }

    return handle;
  }

  window.mountFullscreenOverlay = mountFullscreenOverlay;
})();
