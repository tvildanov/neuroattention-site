/**
 * Monad LK — 3D cross of three axes (NeuroSpirituality canon).
 * X = height / 7×7 vertical, Y = width / circle 12+1, Z = depth / R10 chain.
 * Lazy-loads Three.js r128 like BodyAtlas.
 */
(function () {
  'use strict';

  var THREE_R128 = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var ORBIT_URL = 'https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js';

  var active = null;

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensureThree() {
    if (window.THREE && window.THREE.OrbitControls) return Promise.resolve();
    return loadScript(THREE_R128).then(function () { return loadScript(ORBIT_URL); });
  }

  function locLang() {
    return (document.documentElement.lang || 'ru').slice(0, 2);
  }

  function axisLabel(axis, lang) {
    if (!axis) return '';
    return axis['name_' + lang] || axis.name_ru || axis.name_en || axis.id || '';
  }

  function CrossScene(container, arch, opts) {
    this.container = container;
    this.arch = arch || {};
    this.opts = opts || {};
    this.axes = (arch && arch.three_axes) || (arch && arch.live && arch.live.three_axes) || {};
    this.depth = (arch && arch.depth) || (arch && arch.live && arch.live.depth) || {};
    this._raf = null;
    this._resizeObs = null;
    this._pickables = [];
    this._groups = { vertical: [], horizontal: [], depth: [], axes: [] };
    this._focus = { mode: 'full' };
    this._raycaster = null;
    this._mouse = null;
    this._onClickBound = null;
    this._detailEl = null;
    this._expandGroup = null;
  }

  CrossScene.prototype.mount = function () {
    var self = this;
    return ensureThree().then(function () {
      self._build();
      self._animate();
    });
  };

  CrossScene.prototype._build = function () {
    var T = window.THREE;
    var w = Math.max(320, this.container.clientWidth || 640);
    var h = Math.max(360, this.container.clientHeight || 480);

    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x070b10);
    this.scene.fog = new T.FogExp2(0x070b10, 0.045);

    this.camera = new T.PerspectiveCamera(42, w / h, 0.1, 120);
    this.camera.position.set(6.5, 5.5, 8.5);

    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.controls = new T.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 2.2, 0);

    var amb = new T.AmbientLight(0xa8f7ff, 0.35);
    this.scene.add(amb);
    var key = new T.DirectionalLight(0xffffff, 0.85);
    key.position.set(4, 8, 6);
    this.scene.add(key);
    var rim = new T.DirectionalLight(0x0ef, 0.25);
    rim.position.set(-6, 2, -4);
    this.scene.add(rim);

    this._addAxes();
    this._addVerticalSpine();
    this._addHorizontalRing();
    this._addDepthChain();
    this._addLegend();
    this._bindPick();

    var self = this;
    if (window.ResizeObserver) {
      this._resizeObs = new ResizeObserver(function () { self._onResize(); });
      this._resizeObs.observe(this.container);
    } else {
      window.addEventListener('resize', this._onResizeBound = function () { self._onResize(); });
    }
  };

  CrossScene.prototype._mat = function (color, opacity) {
    return new window.THREE.MeshStandardMaterial({
      color: color,
      transparent: opacity != null && opacity < 1,
      opacity: opacity == null ? 1 : opacity,
      metalness: 0.15,
      roughness: 0.55,
      emissive: color,
      emissiveIntensity: 0.08,
    });
  };

  CrossScene.prototype._line = function (a, b, color) {
    var T = window.THREE;
    var geo = new T.BufferGeometry().setFromPoints([new T.Vector3(a[0], a[1], a[2]), new T.Vector3(b[0], b[1], b[2])]);
    var mat = new T.LineBasicMaterial({ color: color, transparent: true, opacity: 0.85 });
    this.scene.add(new T.Line(geo, mat));
  };

  CrossScene.prototype._label = function (text, x, y, z, color) {
    var T = window.THREE;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '600 28px Inter, system-ui, sans-serif';
    ctx.fillStyle = color || '#A8F7FF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    var tex = new T.CanvasTexture(canvas);
    var mat = new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    var spr = new T.Sprite(mat);
    spr.scale.set(2.8, 0.7, 1);
    spr.position.set(x, y, z);
    this.scene.add(spr);
  };

  CrossScene.prototype._tag = function (mesh, nav, group) {
    mesh.userData = mesh.userData || {};
    mesh.userData.monadNav = nav;
    mesh.userData.monadGroup = group || (nav && nav.target) || 'axes';
    this._pickables.push(mesh);
    var g = mesh.userData.monadGroup;
    if (!this._groups[g]) this._groups[g] = [];
    this._groups[g].push(mesh);
  };

  CrossScene.prototype._setOpacity = function (mesh, opacity) {
    if (!mesh || !mesh.material) return;
    var mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(function (m) {
      m.transparent = true;
      m.opacity = opacity;
      if (m.emissiveIntensity != null) m.emissiveIntensity = opacity > 0.5 ? 0.12 : 0.02;
      m.needsUpdate = true;
    });
  };

  CrossScene.prototype._applyFocus = function () {
    var mode = (this._focus && this._focus.mode) || 'full';
    var keep = mode === 'full' ? null : mode;
    var self = this;
    Object.keys(this._groups).forEach(function (g) {
      var hi = !keep || g === keep || (keep === 'vertical' && g === 'vertCells');
      (self._groups[g] || []).forEach(function (mesh) {
        self._setOpacity(mesh, hi ? 1 : 0.12);
      });
    });
    if (this._expandGroup) {
      this.scene.remove(this._expandGroup);
      this._expandGroup = null;
    }
    if (mode === 'vertical') this._expandVerticalDetail();
    else if (mode === 'horizontal') this._expandHorizontalDetail();
    this._renderDetailPanel();
  };

  CrossScene.prototype._expandVerticalDetail = function () {
    var T = window.THREE;
    var g = new T.Group();
    this._expandGroup = g;
    this.scene.add(g);
    if (!this._groups.vertCells) this._groups.vertCells = [];
    var layers = (this.arch.vertical || []).slice().sort(function (a, b) { return (a.layer || 0) - (b.layer || 0); });
    layers.forEach(function (L, li) {
      var y = 0.55 + li * 0.95;
      for (var j = 1; j <= 7; j++) {
        var cell = ((L.cells || []).filter(function (c) { return c.n === j; })[0]) || {};
        var x = (j - 4) * 0.42;
        var mesh = new T.Mesh(
          new T.BoxGeometry(0.32, 0.28, 0.32),
          this._mat(cell.occupied ? 0x00e0ff : 0x335566, cell.occupied ? 0.95 : 0.45)
        );
        mesh.position.set(x, y, 0.55);
        g.add(mesh);
        this._tag(mesh, {
          target: 'vertical',
          layerId: L.id,
          cell: j,
          focus: 'cell',
          code: cell.code || ('L' + L.layer + 'xL' + j),
          agents: cell.agents || [],
          label: cell.ru || cell.en || '',
        }, 'vertCells');
      }
    }, this);
  };

  CrossScene.prototype._expandHorizontalDetail = function () {
    // camera nudge toward top view
    if (this.camera) {
      this.camera.position.set(0.2, 9.5, 0.2);
      if (this.controls) {
        this.controls.target.set(0, 2.2, 0);
        this.controls.update();
      }
    }
  };

  CrossScene.prototype._resetCamera = function () {
    if (!this.camera) return;
    this.camera.position.set(6.5, 5.5, 8.5);
    if (this.controls) {
      this.controls.target.set(0, 2.2, 0);
      this.controls.update();
    }
  };

  CrossScene.prototype._renderDetailPanel = function () {
    if (!this._detailEl) {
      this._detailEl = document.createElement('div');
      this._detailEl.className = 'monad-cross-detail';
      this.container.appendChild(this._detailEl);
    }
    var f = this._focus || { mode: 'full' };
    var lang = locLang();
    var html = '';
    if (f.mode === 'full') {
      html = '<p class="monad-muted">' + (lang === 'en'
        ? 'Click an axis or block to zoom in. Empty space resets. Drag to orbit.'
        : 'Кликни ось или блок — приблизим на месте. Пустое место — назад. Мышью крути.') + '</p>';
    } else {
      html = '<button type="button" class="btn btn-ghost" id="monad-cross-back" style="font-size:12px;margin-bottom:0.4rem;">← ' +
        (lang === 'en' ? 'Full cross' : 'Весь крест') + '</button>';
      if (f.mode === 'vertical') {
        html += '<strong>' + (lang === 'en' ? 'Vertical L1–L7' : 'Вертикаль L1–L7') + '</strong>';
        html += '<p class="monad-muted">' + (lang === 'en'
          ? '49 posts shown as a grid. Click a cube for agents.'
          : '49 постов сеткой. Кликни кубик — агенты справа.') + '</p>';
      } else if (f.mode === 'horizontal') {
        html += '<strong>' + (lang === 'en' ? 'Horizontal 12+1' : 'Горизонталь 12+1') + '</strong>';
        html += '<p class="monad-muted">' + (lang === 'en'
          ? 'Top view of the circle. Click a person.'
          : 'Вид сверху на круг. Кликни человека.') + '</p>';
      } else if (f.mode === 'cell') {
        html += '<strong>' + String(f.code || '').replace(/x/gi, '×') + '</strong>';
        if (f.label) html += '<p>' + f.label + '</p>';
        var agents = f.agents || [];
        if (!agents.length) html += '<p class="monad-muted">' + (lang === 'en' ? 'No agents here' : 'В этой клетке нет агентов') + '</p>';
        else {
          html += '<ul class="monad-cross-agent-list">';
          agents.forEach(function (a) {
            html += '<li><button type="button" class="monad-cross-agent" data-agent="' + a.agent_id + '">' +
              (a.name || a.agent_id) + '</button></li>';
          });
          html += '</ul>';
        }
      } else if (f.mode === 'person') {
        html += '<strong>' + (f.name || f.hour) + '</strong>';
        html += '<p class="monad-muted">' + (lang === 'en' ? 'Open Horizontal tab for full tree' : 'Полное дерево — во вкладке Горизонталь') + '</p>';
        html += '<button type="button" class="btn btn-primary" id="monad-cross-open-tab" style="font-size:12px;margin-top:0.4rem;" data-tab="horizontal" data-hour="' +
          (f.hour || '') + '">' + (lang === 'en' ? 'Open Horizontal' : 'Открыть Горизонталь') + '</button>';
      }
    }
    this._detailEl.innerHTML = html;
    var self = this;
    var back = document.getElementById('monad-cross-back');
    if (back) back.addEventListener('click', function () {
      self._focus = { mode: 'full' };
      self._resetCamera();
      self._applyFocus();
    });
    var openTab = document.getElementById('monad-cross-open-tab');
    if (openTab && this.opts.onNavigate) {
      openTab.addEventListener('click', function () {
        self.opts.onNavigate({
          target: openTab.getAttribute('data-tab'),
          hour: openTab.getAttribute('data-hour'),
        });
      });
    }
    this._detailEl.querySelectorAll('[data-agent]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (self.opts.onAgent) self.opts.onAgent(b.getAttribute('data-agent'));
      });
    });
  };

  CrossScene.prototype._bindPick = function () {
    var self = this;
    var T = window.THREE;
    if (!T || !this.renderer) return;
    this._raycaster = new T.Raycaster();
    this._mouse = new T.Vector2();
    this._onClickBound = function (e) {
      if (!self._pickables.length) return;
      var rect = self.renderer.domElement.getBoundingClientRect();
      self._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      self._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      self._raycaster.setFromCamera(self._mouse, self.camera);
      var hits = self._raycaster.intersectObjects(self._pickables, true);
      if (!hits.length) {
        // empty space → reset
        if (self._focus.mode !== 'full') {
          self._focus = { mode: 'full' };
          self._resetCamera();
          self._applyFocus();
        }
        return;
      }
      var nav = hits[0].object && hits[0].object.userData && hits[0].object.userData.monadNav;
      if (!nav) return;
      if (nav.focus === 'cell') {
        self._focus = {
          mode: 'cell',
          code: nav.code,
          label: nav.label,
          agents: nav.agents || [],
          layerId: nav.layerId,
          cell: nav.cell,
        };
        self._applyFocus();
        return;
      }
      if (nav.target === 'vertical') {
        self._focus = { mode: 'vertical', layerId: nav.layerId };
        self._applyFocus();
        return;
      }
      if (nav.target === 'horizontal') {
        if (nav.hour != null && nav.hour !== 'dom') {
          var seat = (((self.arch.horizontal || {}).seats) || []).filter(function (s) {
            return String(s.hour) === String(nav.hour);
          })[0];
          self._focus = {
            mode: 'person',
            hour: nav.hour,
            name: seat && seat.person ? (seat.person.display_name || seat.person.human_id) : String(nav.hour),
          };
        } else {
          self._focus = { mode: 'horizontal' };
        }
        self._applyFocus();
        return;
      }
      // Z / online — optional soft hint, no hard jump
      if (nav.target === 'online' && self.opts.onNavigate) {
        self._detailEl && (self._detailEl.innerHTML =
          '<button type="button" class="btn btn-primary" id="monad-cross-open-online" style="font-size:12px;">' +
          (locLang() === 'en' ? 'Open Online tab' : 'Открыть вкладку Онлайн') + '</button>');
        var btn = document.getElementById('monad-cross-open-online');
        if (btn) btn.addEventListener('click', function () { self.opts.onNavigate({ target: 'online' }); });
      }
    };
    this.renderer.domElement.addEventListener('click', this._onClickBound);
    this.renderer.domElement.style.cursor = 'pointer';
    this._renderDetailPanel();
  };

  CrossScene.prototype._addAxes = function () {
    var lang = locLang();
    var xCol = 0x00e0ff;
    var yCol = 0xe8c468;
    var zCol = 0x8dffc8;
    this._line([0, 0, 0], [0, 7.2, 0], xCol);
    this._line([0, 2.2, 0], [4.8, 2.2, 0], yCol);
    this._line([0, 2.2, 0], [0, 2.2, -4.8], zCol);
    var xHit = new window.THREE.Mesh(
      new window.THREE.BoxGeometry(0.9, 7.4, 0.9),
      new window.THREE.MeshBasicMaterial({ visible: false })
    );
    xHit.position.set(0, 3.6, 0);
    this.scene.add(xHit);
    this._tag(xHit, { target: 'vertical' }, 'vertical');
    var yHit = new window.THREE.Mesh(
      new window.THREE.BoxGeometry(5.2, 0.9, 0.9),
      new window.THREE.MeshBasicMaterial({ visible: false })
    );
    yHit.position.set(2.4, 2.2, 0);
    this.scene.add(yHit);
    this._tag(yHit, { target: 'horizontal' }, 'horizontal');
    var zHit = new window.THREE.Mesh(
      new window.THREE.BoxGeometry(0.9, 0.9, 5.2),
      new window.THREE.MeshBasicMaterial({ visible: false })
    );
    zHit.position.set(0, 2.2, -2.4);
    this.scene.add(zHit);
    this._tag(zHit, { target: 'online' }, 'depth');
    this._label('X · ' + axisLabel(this.axes.x_height, lang), 0, 7.6, 0, '#00e0ff');
    this._label('Y · ' + axisLabel(this.axes.y_width, lang), 5.2, 2.2, 0, '#e8c468');
    this._label('Z · ' + axisLabel(this.axes.z_depth, lang), 0, 2.2, -5.2, '#8dffc8');
  };

  CrossScene.prototype._addVerticalSpine = function () {
    var T = window.THREE;
    var layers = (this.arch.vertical || []).slice().sort(function (a, b) { return (a.layer || 0) - (b.layer || 0); });
    if (!layers.length) layers = new Array(7).fill(null).map(function (_, i) { return { layer: i + 1, ru: 'L' + (i + 1) }; });
    var mat = this._mat(0x00e0ff, 0.82);
    var spineMat = this._mat(0xffffff, 0.95);
    layers.forEach(function (L, i) {
      var y = 0.55 + i * 0.95;
      var geo = new T.BoxGeometry(0.55, 0.42, 0.55);
      var mesh = new T.Mesh(geo, mat);
      mesh.position.set(0, y, 0);
      this.scene.add(mesh);
      this._tag(mesh, { target: 'vertical', layerId: L.id || ('L' + (L.layer || (i + 1))), cell: L.layer || (i + 1) }, 'vertical');
      var spine = new T.Mesh(new T.BoxGeometry(0.22, 0.48, 0.22), spineMat);
      spine.position.set(0, y, 0);
      this.scene.add(spine);
      this._tag(spine, { target: 'vertical', layerId: L.id || ('L' + (L.layer || (i + 1))) }, 'vertical');
      var name = (L && (L[locLang()] || L.ru)) || ('L' + (L.layer || (i + 1)));
      this._label(String(L.layer || (i + 1)), -0.95, y, 0, '#A8F7FF');
      if (i === 0 || i === layers.length - 1) this._label(name.slice(0, 18), 0.95, y, 0, '#c5ccd4');
    }, this);
  };

  CrossScene.prototype._addHorizontalRing = function () {
    var T = window.THREE;
    var ring = new T.Mesh(
      new T.TorusGeometry(2.35, 0.06, 12, 64),
      this._mat(0xe8c468, 0.75)
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 2.2, 0);
    this.scene.add(ring);
    var seats = ((this.arch.horizontal || {}).seats) || [];
    seats.forEach(function (s) {
      if (!s || s.inactive) return;
      var hour = s.hour || 12;
      var ang = (hour / 12) * Math.PI * 2 - Math.PI / 2;
      var r = 2.35;
      var x = Math.cos(ang) * r;
      var z = Math.sin(ang) * r;
      var dot = new T.Mesh(new T.SphereGeometry(s.person ? 0.14 : 0.08, 10, 10), this._mat(s.person ? 0x00e0ff : 0x444444, s.person ? 1 : 0.45));
      dot.position.set(x, 2.2, z);
      this.scene.add(dot);
      if (s.person) this._tag(dot, { target: 'horizontal', hour: hour }, 'horizontal');
    }, this);
    var dom = new T.Mesh(new T.SphereGeometry(0.22, 16, 16), this._mat(0xffffff, 0.9));
    dom.position.set(0, 2.2, 0);
    this.scene.add(dom);
    this._tag(dom, { target: 'horizontal', hour: 'dom' }, 'horizontal');
    this._tag(ring, { target: 'horizontal' }, 'horizontal');
  };

  CrossScene.prototype._addDepthChain = function () {
    var T = window.THREE;
    var layers = (this.depth && this.depth.layers) || [
      { id: 'human', label: 'Human' },
      { id: 'entry_persona', label: 'Persona' },
      { id: 'contour', label: 'Contour' },
      { id: 'skill', label: 'Skill' },
    ];
    var mat = this._mat(0x8dffc8, 0.78);
    layers.forEach(function (L, i) {
      var z = -0.55 - i * 0.95;
      var mesh = new T.Mesh(new T.BoxGeometry(0.7, 0.35, 0.45), mat);
      mesh.position.set(0, 2.2, z);
      this.scene.add(mesh);
      this._label(String(L.label || L.id), 0, 2.75, z, '#8dffc8');
    }, this);
    for (var i = 0; i < layers.length - 1; i++) {
      var z0 = -0.55 - i * 0.95;
      var z1 = -0.55 - (i + 1) * 0.95;
      this._line([0, 2.2, z0 - 0.25], [0, 2.2, z1 + 0.25], 0x8dffc8);
    }
  };

  CrossScene.prototype._addLegend = function () {
    var lang = locLang();
    var bits = [];
    if (this.axes.neurospirituality) bits.push(String(this.axes.neurospirituality));
    var x = this.axes.x_height;
    var y = this.axes.y_width;
    var z = this.axes.z_depth;
    if (x && x.meaning) bits.push('X: ' + x.meaning.slice(0, 120));
    if (y && y.meaning) bits.push('Y: ' + y.meaning.slice(0, 120));
    if (z && z.meaning) bits.push('Z: ' + z.meaning.slice(0, 120));
    var host = document.createElement('div');
    host.className = 'monad-cross-legend';
    host.innerHTML = '';
    // legend text now in detail panel
    this.container.appendChild(host);
  };

  CrossScene.prototype._onResize = function () {
    if (!this.renderer || !this.camera) return;
    var w = Math.max(320, this.container.clientWidth || 640);
    var h = Math.max(360, this.container.clientHeight || 480);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  CrossScene.prototype._animate = function () {
    var self = this;
    function frame() {
      self._raf = window.requestAnimationFrame(frame);
      if (self.controls) self.controls.update();
      if (self.renderer && self.scene && self.camera) self.renderer.render(self.scene, self.camera);
    }
    frame();
  };

  CrossScene.prototype.destroy = function () {
    if (this._raf) window.cancelAnimationFrame(this._raf);
    if (this._resizeObs) this._resizeObs.disconnect();
    if (this._onResizeBound) window.removeEventListener('resize', this._onResizeBound);
    if (this.renderer && this._onClickBound) {
      this.renderer.domElement.removeEventListener('click', this._onClickBound);
    }
    if (this.controls) this.controls.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
    this.container.innerHTML = '';
  };

  window.MonadCross = {
    mount: function (container, arch, opts) {
      if (active) { active.destroy(); active = null; }
      if (!container) return Promise.resolve();
      var scene = new CrossScene(container, arch, opts);
      active = scene;
      return scene.mount().catch(function (err) {
        container.innerHTML = '<p class="monad-warn">' + String(err && err.message || err) + '</p>';
      });
    },
    destroy: function () {
      if (active) { active.destroy(); active = null; }
    },
  };
})();
