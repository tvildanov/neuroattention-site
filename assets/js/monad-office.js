/**
 * Monad LK — office-style live agent map (zones L1–L7 + unplaced).
 */
(function () {
  'use strict';

  var active = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function t(key, fallback) {
    try { if (typeof window.t === 'function') return window.t(key, fallback); } catch (e) {}
    return fallback || key;
  }

  function OfficeView(container, opts) {
    this.container = container;
    this.opts = opts || {};
    this.data = null;
    this.filter = '';
    this.picked = null;
  }

  OfficeView.prototype.render = function (data) {
    this.data = data || this.data;
    if (!this.container || !this.data) return;
    var office = this.data.office || {};
    var zones = office.zones || [];
    var desks = office.desks || [];
    var q = String(this.filter || '').trim().toLowerCase();
    var filtered = q
      ? desks.filter(function (d) {
        var hay = [d.agent_id, d.name, d.zone_label, d.cell, d.contour, d.project, d.owner_name].join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      })
      : desks;

    var html = '<div class="monad-office-wrap">';
    html += '<div class="monad-office-stats">';
    html += '<span>' + esc(t('a.monad.office_total', 'Агентов')) + ': <b>' + (office.agent_total || desks.length) + '</b></span>';
    html += '<span>' + esc(t('a.monad.office_live', 'Сейчас активны')) + ': <b class="monad-live-n">' + (office.live_count || 0) + '</b></span>';
    html += '<span class="monad-muted">' + esc(t('a.monad.office_hint', 'Клик по столу — детали. Зелёный пульс = недавняя активность.')) + '</span>';
    html += '</div>';

    html += '<div class="monad-office-floor">';
    zones.forEach(function (zone) {
      var rowDesks = filtered.filter(function (d) { return d.zone === zone.id; });
      if (!rowDesks.length && zone.id !== 'unplaced') {
        html += '<div class="monad-office-row empty" data-zone="' + esc(zone.id) + '">';
        html += '<div class="monad-office-row-label"><code>' + esc(zone.id) + '</code> ' + esc(zone.ru || zone.en || '') + '</div>';
        html += '<div class="monad-muted" style="font-size:11px;padding:0.35rem 0;">—</div></div>';
        return;
      }
      if (!rowDesks.length) return;
      html += '<div class="monad-office-row' + (zone.id === 'unplaced' ? ' unplaced' : '') + '" data-zone="' + esc(zone.id) + '">';
      html += '<div class="monad-office-row-label"><code>' + esc(zone.id) + '</code> ' + esc(zone.ru || zone.en || '') +
        ' <em>' + rowDesks.length + '</em></div>';
      html += '<div class="monad-office-desks">';
      rowDesks.forEach(function (d) {
        var on = this.picked === d.agent_id ? ' on' : '';
        var live = d.live ? ' live' : '';
        html += '<button type="button" class="monad-desk' + live + on + '" data-agent="' + esc(d.agent_id) + '" title="' + esc(d.name) + '">';
        html += '<span class="monad-desk-dot"></span>';
        html += '<span class="monad-desk-name">' + esc((d.name || d.agent_id).slice(0, 22)) + '</span>';
        if (d.actions_per_min != null && d.actions_per_min > 0) {
          html += '<span class="monad-desk-act">' + esc(String(d.actions_per_min)) + '/м</span>';
        }
        html += '</button>';
      }, this);
      html += '</div></div>';
    }, this);
    html += '</div></div>';

    this.container.innerHTML = html;
    var self = this;
    this.container.querySelectorAll('.monad-desk').forEach(function (b) {
      b.addEventListener('click', function () {
        self.picked = b.getAttribute('data-agent');
        if (self.opts.onPick) self.opts.onPick(self.picked, self.findDesk(self.picked));
        self.render();
      });
    });
  };

  OfficeView.prototype.findDesk = function (id) {
    var desks = (this.data && this.data.office && this.data.office.desks) || [];
    return desks.filter(function (d) { return d.agent_id === id; })[0] || null;
  };

  OfficeView.prototype.setFilter = function (q) {
    this.filter = q || '';
    this.render();
  };

  OfficeView.prototype.destroy = function () {
    if (this.container) this.container.innerHTML = '';
    this.data = null;
  };

  window.MonadOffice = {
    mount: function (container, opts) {
      if (active) { active.destroy(); active = null; }
      if (!container) return null;
      active = new OfficeView(container, opts);
      return active;
    },
    render: function (data) {
      if (active) active.render(data);
    },
    setFilter: function (q) {
      if (active) active.setFilter(q);
    },
    destroy: function () {
      if (active) { active.destroy(); active = null; }
    },
  };
})();
