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

  function CrossScene(container, arch) {
    this.container = container;
    this.arch = arch || {};
    this.axes = (arch && arch.three_axes) || (arch && arch.live && arch.live.three_axes) || {};
    this.depth = (arch && arch.depth) || (arch && arch.live && arch.live.depth) || {};
    this._raf = null;
    this._resizeObs = null;
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

  CrossScene.prototype._addAxes = function () {
    var lang = locLang();
    var xCol = 0x00e0ff;
    var yCol = 0xe8c468;
    var zCol = 0x8dffc8;
    this._line([0, 0, 0], [0, 7.2, 0], xCol);
    this._line([0, 2.2, 0], [4.8, 2.2, 0], yCol);
    this._line([0, 2.2, 0], [0, 2.2, -4.8], zCol);
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
      var spine = new T.Mesh(new T.BoxGeometry(0.22, 0.48, 0.22), spineMat);
      spine.position.set(0, y, 0);
      this.scene.add(spine);
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
    }, this);
    var dom = new T.Mesh(new T.SphereGeometry(0.22, 16, 16), this._mat(0xffffff, 0.9));
    dom.position.set(0, 2.2, 0);
    this.scene.add(dom);
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
    host.innerHTML = '<p class="monad-muted">' + bits.map(function (b) {
      return String(b).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    }).join(' · ') + '</p>' +
      '<p class="monad-muted">' + (lang === 'en'
        ? 'Drag to orbit · wheel zoom · Shift+drag also works'
        : 'Крути мышью · колесо — масштаб · Shift+drag — орбита') + '</p>';
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
    mount: function (container, arch) {
      if (active) { active.destroy(); active = null; }
      if (!container) return Promise.resolve();
      var scene = new CrossScene(container, arch);
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
