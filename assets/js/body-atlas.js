/* ============================================================================
 * BodyAtlas — interactive 3D anatomy engine for neuroattention.org
 * ----------------------------------------------------------------------------
 * Vanilla JS + Three.js r128 (lazy-loaded from CDN on first use).
 *
 * Geometry sources (honest provenance — see assets/3d/CREDITS.md):
 *   • Skin layer  — REAL human mesh (Three.js examples, Xbot.glb), rendered
 *                   with a holographic x-ray wireframe shader.
 *   • Skeleton / muscles / nervous-system / brain — anatomically-faithful
 *     PROCEDURAL meshes built from standard anatomical proportions, scaled to
 *     the loaded body's bounding box. Correct topology, positions and named,
 *     hit-testable regions — schematic, not photogrammetric scans.
 *
 * Public API (see window.BodyAtlas at bottom):
 *   BodyAtlas.init(container, options) -> Promise<Atlas>
 *   atlas.render(opts) / .toggleLayer(name,vis) / .setLayerOpacity(name,0..1)
 *   atlas.setRotation(yaw,pitch) / .resetView() / .hitTest(x,y)
 *   atlas.on(event, handler) / .setMode(mode) / .setSex('male'|'female')
 *   atlas.enterBrainDetail() / .exitBrainDetail() / .focusOrgan(id) / .destroy()
 * ==========================================================================*/
(function () {
  'use strict';

  // ── palette (mycelium tokens, no purple) ──────────────────────────────────
  var COLD_CYAN  = 0xA8F7FF;   // coldCyan #A8F7FF
  var NEURO_GREEN= 0x8DFFC8;   // neuroGreen #8DFFC8
  var WARM_CYAN  = 0x6FE9F0;
  var RIM_WHITE  = 0xFFFFFF;

  var THREE_R128 = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var ORBIT_URL  = 'https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js';
  var GLTF_URL   = 'https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js';
  var DRACO_URL  = 'https://unpkg.com/three@0.128.0/examples/js/loaders/DRACOLoader.js';
  var BODY_GLB   = 'assets/3d/body/body-male.glb';

  // Real Z-Anatomy (CC-BY-SA) systems are streamed per-layer from a CDN; URLs
  // live in this config so they can be rotated without a code change. Procedural
  // capsule layers remain as an instant fallback / preview until the GLB arrives.
  var MODELS_CFG_URL = 'data/config/anatomy-models.json';
  var _cfgPromise = null;
  function loadModelsConfig() {
    if (_cfgPromise) return _cfgPromise;
    _cfgPromise = fetch(MODELS_CFG_URL)
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
    return _cfgPromise;
  }

  // Lazy anatomy data: localized region names (ru/es) + the CNS exclusion list
  // for the nervous layer. Loaded once, the first time any real layer streams.
  var ANAT_I18N_RU = 'data/i18n/anatomy/ru.json';
  var ANAT_I18N_ES = 'data/i18n/anatomy/es.json';
  var NERVOUS_CNS  = 'data/anatomy/nervous-cns-meshes.json';
  var _anatPromise = null;
  function loadAnatomyData() {
    if (_anatPromise) return _anatPromise;
    function j(u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
    _anatPromise = Promise.all([j(ANAT_I18N_RU), j(ANAT_I18N_ES), j(NERVOUS_CNS)])
      .then(function (res) {
        var cns = {};
        if (res[2] && res[2].cns_meshes) res[2].cns_meshes.forEach(function (n) { cns[n] = 1; });
        return { ru: res[0] || {}, es: res[1] || {}, cns: cns };
      });
    return _anatPromise;
  }

  // ── anatomical name parsing ────────────────────────────────────────────────
  // Mirrors tools/gen_regions_index.py parse_name() BYTE-FOR-BYTE so engine slugs
  // and the generated i18n keys always agree. Z-Anatomy laterality / attachment
  // markers are a trailing ".<token>" (l/r/j/i, el/er/ol/or, e1l…); side = last
  // char when l/r, else no laterality. Real names are already clean Latin/English.
  // THREE.GLTFLoader runs PropertyBinding.sanitizeNodeName on every node name:
  // spaces → "_", and reserved chars ([ ] . : /) are stripped. That destroys the
  // ".l/.r/.j" markers ("fascia.l" → "fascial"), so we recover the RAW node name
  // from gltf.parser.json.nodes via this same transform before parsing.
  function sanitizeNodeName(name) {
    return String(name).replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');
  }

  var _ANAT_MARKER = /\.([a-z][a-z0-9]{0,2})$/;
  function parseAnatName(layer, name) {
    var s = (name || '').trim();
    var side = null;
    var m = _ANAT_MARKER.exec(s);
    if (m) {
      var marker = m[1];
      s = s.slice(0, m.index);
      if (marker.charAt(marker.length - 1) === 'l' && marker !== 'j') side = 'l';
      else if (marker.charAt(marker.length - 1) === 'r') side = 'r';
    }
    var displayEn = s.trim();
    var slug = displayEn.toLowerCase()
      .replace(/[''`’]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!slug) return { regionId: '', baseSlug: '', displayEn: '', side: null };
    var baseSlug = layer + '_' + slug;
    var regionId = baseSlug + (side === 'l' ? '_left' : side === 'r' ? '_right' : '');
    return { regionId: regionId, baseSlug: baseSlug, displayEn: displayEn, side: side };
  }
  // i18n dictionary for the ~124 named brain structures (slug → {en,ru,es}).
  var BRAIN_I18N_URL = 'data/i18n/anatomy-brain.json';
  var _brainI18nPromise = null;
  function loadBrainI18n() {
    if (_brainI18nPromise) return _brainI18nPromise;
    _brainI18nPromise = fetch(BRAIN_I18N_URL)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.regions) || {}; })
      .catch(function () { return {}; });
    return _brainI18nPromise;
  }

  // localized "(left)/(right)" suffix appended to a paired structure's name.
  var BRAIN_SIDE = {
    l: { en: ' (left)',  ru: ' (слева)',  es: ' (izq.)' },
    r: { en: ' (right)', ru: ' (справа)', es: ' (der.)' }
  };
  // last-resort humanizer if a slug is somehow missing from the dictionary.
  function humanizeSlug(slug) {
    var s = (slug || '').replace(/_/g, ' ').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Brain region';
  }
  // build the localized {en,ru,es} fine name for a mesh from its slug + side.
  function brainNames(dict, slug, side) {
    var rec = (dict && dict[slug]) || null;
    var base = rec || { en: humanizeSlug(slug), ru: humanizeSlug(slug), es: humanizeSlug(slug) };
    var sx = BRAIN_SIDE[side] || { en: '', ru: '', es: '' };
    return { en: base.en + sx.en, ru: (base.ru || base.en) + sx.ru, es: (base.es || base.en) + sx.es };
  }

  // per-layer x-ray styling for streamed real meshes (no purple; mycelium tokens
  // + warm accents to tell vessels/organs apart)
  // B6: each layer gets a distinct base colour so multiple open layers read
  // apart at a glance, while the x-ray rim/glow (cyan-ish) stays for the
  // holographic look. Palette per Nick's spec.
  var LAYER_STYLE = {
    skin:     { color: 0xA8F7FF, rim: 0xCFF6FF, opacity: 0.40, glow: 0.6, fresnelPower: 2.4 }, // light blue, translucent
    muscles:  { color: 0xFF6B6B, rim: 0xFFC2C2, opacity: 0.50, glow: 0.6, fresnelPower: 2.1 }, // coral
    skeleton: { color: 0xFFD700, rim: 0xFFF1A8, opacity: 0.70, glow: 1.0, fresnelPower: 1.8 }, // gold/yellow
    nervous:  { color: 0x7CFC00, rim: 0xCFFFB0, opacity: 0.60, glow: 1.0, fresnelPower: 1.7 }, // lawn green
    vessels:  { color: 0xFF0000, rim: 0xFF9A9A, opacity: 0.50, glow: 0.9, fresnelPower: 1.9 }, // red
    organs:   { color: 0x9B59B6, rim: 0xD9B8E8, opacity: 0.60, glow: 0.8, fresnelPower: 2.0 }, // purple
    brain:    { color: 0xFFFFFF, rim: 0xFFFFFF, opacity: 0.78, glow: 1.2, fresnelPower: 1.6 }  // bright white
  };

  // ── tiny script loader (sequential, cached) ───────────────────────────────
  var _loaded = {};
  function loadScript(src) {
    if (_loaded[src]) return _loaded[src];
    _loaded[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
    return _loaded[src];
  }
  var _threeReady = null;
  function ensureThree() {
    if (window.THREE && window.THREE.OrbitControls && window.THREE.GLTFLoader) return Promise.resolve();
    if (_threeReady) return _threeReady;
    _threeReady = loadScript(THREE_R128)
      .then(function () { return Promise.all([loadScript(ORBIT_URL), loadScript(GLTF_URL), loadScript(DRACO_URL)]); });
    return _threeReady;
  }

  // ── x-ray fresnel shader ───────────────────────────────────────────────────
  // Edge-glowing, center-transparent fill — the classic holographic x-ray look.
  function makeXrayMaterial(opts) {
    opts = opts || {};
    var col = new window.THREE.Color(opts.color != null ? opts.color : COLD_CYAN);
    var rim = new window.THREE.Color(opts.rim != null ? opts.rim : RIM_WHITE);
    return new window.THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: window.THREE.AdditiveBlending,
      side: window.THREE.DoubleSide,
      uniforms: {
        uColor:        { value: col },
        uRim:          { value: rim },
        uFresnelPower: { value: opts.fresnelPower != null ? opts.fresnelPower : 2.4 },
        uOpacity:      { value: opts.opacity != null ? opts.opacity : 0.55 },
        uGlow:         { value: opts.glow != null ? opts.glow : 0.6 }
      },
      vertexShader: [
        'varying vec3 vN;', 'varying vec3 vV;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position,1.0);',
        '  vN = normalize(mat3(modelMatrix) * normal);',
        '  vV = normalize(cameraPosition - wp.xyz);',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform vec3 uRim;',
        'uniform float uFresnelPower; uniform float uOpacity; uniform float uGlow;',
        'varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));',
        '  f = pow(clamp(f,0.0,1.0), uFresnelPower);',
        '  vec3 c = mix(uColor, uRim, f*0.65);',
        '  float a = clamp(f*uOpacity + uGlow*0.06, 0.0, 1.0);',
        '  gl_FragColor = vec4(c * (0.4 + uGlow*f), a);',
        '}'
      ].join('\n')
    });
  }

  // r128 has no CapsuleGeometry (added in r130) — approximate with a cylinder.
  // Signature mirrors CapsuleGeometry(radius, length, capSegs, radialSegs).
  function CapGeo(r, len, _capSegs, radialSegs) {
    return new window.THREE.CylinderGeometry(r, r, len + r, radialSegs || 12, 1, false);
  }

  // wireframe "net" overlay for a geometry
  function makeWireframe(geom, color, opacity) {
    var wf = new window.THREE.WireframeGeometry(geom);
    var mat = new window.THREE.LineBasicMaterial({
      color: color != null ? color : COLD_CYAN,
      transparent: true, opacity: opacity != null ? opacity : 0.22,
      depthWrite: false
    });
    return new window.THREE.LineSegments(wf, mat);
  }

  // ── brain region catalogue (i18n names + placeholder descriptions) ─────────
  // Positions are normalized inside the brain's local space (set later).
  var BRAIN_REGIONS = [
    { id:'frontal-lobe',   group:'cortex',  color:COLD_CYAN,
      ru:'Лобная доля', en:'Frontal lobe', es:'Lóbulo frontal' },
    { id:'parietal-lobe',  group:'cortex',  color:COLD_CYAN,
      ru:'Теменная доля', en:'Parietal lobe', es:'Lóbulo parietal' },
    { id:'temporal-lobe',  group:'cortex',  color:COLD_CYAN,
      ru:'Височная доля', en:'Temporal lobe', es:'Lóbulo temporal' },
    { id:'occipital-lobe', group:'cortex',  color:COLD_CYAN,
      ru:'Затылочная доля', en:'Occipital lobe', es:'Lóbulo occipital' },
    { id:'thalamus',       group:'limbic',  color:NEURO_GREEN,
      ru:'Таламус', en:'Thalamus', es:'Tálamo' },
    { id:'hypothalamus',   group:'limbic',  color:NEURO_GREEN,
      ru:'Гипоталамус', en:'Hypothalamus', es:'Hipotálamo' },
    { id:'hippocampus',    group:'limbic',  color:NEURO_GREEN,
      ru:'Гиппокамп', en:'Hippocampus', es:'Hipocampo' },
    { id:'amygdala',       group:'limbic',  color:NEURO_GREEN,
      ru:'Миндалина', en:'Amygdala', es:'Amígdala' },
    { id:'basal-ganglia',  group:'deep',    color:WARM_CYAN,
      ru:'Базальные ганглии', en:'Basal ganglia', es:'Ganglios basales' },
    { id:'cerebellum',     group:'cerebellum', color:WARM_CYAN,
      ru:'Мозжечок', en:'Cerebellum', es:'Cerebelo' },
    { id:'midbrain',       group:'brainstem', color:WARM_CYAN,
      ru:'Средний мозг', en:'Midbrain', es:'Mesencéfalo' },
    { id:'pons',           group:'brainstem', color:WARM_CYAN,
      ru:'Мост', en:'Pons', es:'Puente' },
    { id:'medulla',        group:'brainstem', color:WARM_CYAN,
      ru:'Продолговатый мозг', en:'Medulla oblongata', es:'Bulbo raquídeo' },
    // additional regions present in the real Z-Anatomy brain model
    { id:'insula',         group:'cortex',  color:COLD_CYAN,
      ru:'Островковая доля', en:'Insula', es:'Ínsula' },
    { id:'cingulate',      group:'limbic',  color:NEURO_GREEN,
      ru:'Поясная извилина', en:'Cingulate cortex', es:'Corteza cingulada' },
    { id:'corpus-callosum',group:'deep',    color:WARM_CYAN,
      ru:'Мозолистое тело', en:'Corpus callosum', es:'Cuerpo calloso' },
    { id:'fornix',         group:'limbic',  color:NEURO_GREEN,
      ru:'Свод мозга', en:'Fornix', es:'Fórnix' },
    { id:'ventricles',     group:'deep',    color:WARM_CYAN,
      ru:'Желудочки мозга', en:'Ventricles', es:'Ventrículos' }
  ];

  // ── Sensation-map alignment (C2) ────────────────────────────────────────────
  // Maps Atlas region ids → Sensation-Map sub-part slugs (body-picker.js). Keeps
  // the 3D atlas and the existing 2D picker on ONE id space so saved sensations
  // stay backward-compatible whichever picker is shown. Body-surface zones reuse
  // body-picker region keys directly (head/neck/chest/…); spine + organs map to
  // their concrete slugs here.
  var SENSATION_REGION_MAP = {
    // vertebral column (atlas spine segments → body-picker spine slugs)
    'cervical-spine': 'bp_spine_b_cervical',
    'thoracic-spine': 'bp_spine_b_thoracic',
    'lumbar-spine':   'bp_spine_b_lumbar',
    'sacral-spine':   'bp_spine_b_sacral',
    'spinal-cord':    'bp_spine_b_cord',
    // inset organs → general organ slugs
    'heart':   'bp_org_heart',
    'lungs':   'bp_org_lungs',
    'liver':   'bp_org_liver',
    'kidneys': 'bp_org_kidneys',
    'brain':   'bp_head_f_brain'
  };

  // ── Atlas instance ─────────────────────────────────────────────────────────
  function Atlas(container, options) {
    this.container = container;
    this.opts = options || {};
    this.mode = this.opts.mode || 'full';
    this.sex = this.opts.sex || 'male';
    this._handlers = {};       // event -> [fn]
    this._layers = {};         // name -> THREE.Group
    this._layerState = {};     // name -> {visible, opacity}
    this._regionMeshes = [];   // hit-testable meshes (body regions + brain)
    this._raf = null;
    this._destroyed = false;
    this._frontView = true;    // sensation-picker front/back
    this._brainDetail = false;
    this._metrics = null;      // body proportions
  }

  Atlas.prototype.init = function () {
    var self = this;
    return ensureThree().then(function () { self._build(); return self; });
  };

  Atlas.prototype._build = function () {
    var T = window.THREE, c = this.container;
    var w = c.clientWidth || 600, h = c.clientHeight || 600;

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(38, w / h, 0.01, 100);
    this.camera.position.set(0, 0.1, 4.2);

    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    // B4: cap pixel ratio at 1.5 so retina/4K displays don't quadruple the
    // fragment load (the x-ray shader is fill-heavy) — keeps 60fps on integrated GPUs.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x000000, 0);
    c.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    // lights — subtle, the shader is mostly self-lit
    this.scene.add(new T.AmbientLight(0x6699aa, 0.6));
    var key = new T.DirectionalLight(0xA8F7FF, 0.8); key.position.set(2, 3, 4); this.scene.add(key);
    var fill = new T.DirectionalLight(0x8DFFC8, 0.3); fill.position.set(-3, 1, -2); this.scene.add(fill);

    // controls
    this.controls = new T.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;                 // B5: smooth interpolation
    // B5: wider zoom envelope so you can actually get in close (organ/region
    // detail) — min was 0.4 (too far). We own the wheel (B2 zoom-to-cursor), so
    // OrbitControls' native dolly is disabled; these clamp our custom dolly.
    this.controls.minDistance = 0.12;
    this.controls.maxDistance = 12;
    // enableZoom stays ON so touch pinch-zoom keeps working (toward target). The
    // desktop WHEEL is intercepted in capture phase for zoom-to-cursor (B2).
    this.controls.enableZoom = true;
    // B3: panning is allowed but only takes effect once zoomed in (>1.5x), gated
    // each frame in the render loop. screen-space panning feels natural here.
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.target.set(0, 0, 0);
    this._baseDist = this.camera.position.distanceTo(this.controls.target); // reference for "zoom factor"
    // default mouse map: left = rotate. Shift+drag temporarily becomes pan (B3).
    if (T.MOUSE) this.controls.mouseButtons = { LEFT: T.MOUSE.ROTATE, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.PAN };
    // two-finger touch = pan + pinch-zoom (pinch handled by our wheel-equivalent below)
    if (T.TOUCH) this.controls.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };

    // root group (so everything rotates/centers together)
    this.root = new T.Group();
    this.scene.add(this.root);

    this.raycaster = new T.Raycaster();
    this._mouse = new T.Vector2();

    this._bindEvents();
    this._startLoop();
    this._loadBody();
    this._applyMode(this.mode);
  };

  // ── body load + procedural anatomy ─────────────────────────────────────────
  Atlas.prototype._loadBody = function () {
    var self = this, T = window.THREE;
    var loader = new T.GLTFLoader();
    loader.load(BODY_GLB, function (gltf) {
      self._mountBody(gltf.scene);
    }, undefined, function (err) {
      console.warn('[BodyAtlas] GLB load failed, using procedural body', err);
      self._mountBody(null);   // procedural fallback humanoid
    });
  };

  Atlas.prototype._mountBody = function (gltfScene) {
    var T = window.THREE, self = this;
    var skin = new T.Group(); skin.name = 'skin';

    var srcMeshes = [];
    if (gltfScene) {
      gltfScene.updateMatrixWorld(true);
      gltfScene.traverse(function (o) { if (o.isMesh && o.geometry) srcMeshes.push(o); });
    }

    if (srcMeshes.length) {
      // Real mesh → x-ray fill + wireframe net, baked to world space.
      srcMeshes.forEach(function (m) {
        var g = m.geometry.clone();
        g.applyMatrix4(m.matrixWorld);
        var fill = new T.Mesh(g, makeXrayMaterial({ color: COLD_CYAN, opacity: 0.5, glow: 0.7 }));
        skin.add(fill);
        skin.add(makeWireframe(g, COLD_CYAN, 0.18));
      });
    } else {
      // Procedural humanoid fallback (capsule torso + limbs) so the tool never
      // shows an empty stage if the asset is unavailable.
      var body = this._proceduralBody();
      skin.add(body);
    }

    // center + normalize scale so total height ≈ 2.0 units, centered at origin
    var box = new T.Box3().setFromObject(skin);
    var size = new T.Vector3(); box.getSize(size);
    var center = new T.Vector3(); box.getCenter(center);
    var targetH = 2.0;
    var s = size.y > 0.0001 ? targetH / size.y : 1;
    skin.scale.setScalar(s);
    // recompute after scale to re-center
    box = new T.Box3().setFromObject(skin); box.getCenter(center); box.getSize(size);
    skin.position.sub(center);

    this.root.add(skin);
    this._layers.skin = skin;
    this._layerState.skin = { visible: true, opacity: 0.5 };

    // metrics for anatomy placement (in root space, body centered at origin)
    var bb = new T.Box3().setFromObject(skin);
    var H = bb.max.y - bb.min.y;
    this._metrics = {
      box: bb,
      height: H,
      yMin: bb.min.y, yMax: bb.max.y,
      // NB: raw bbox width is the ARM SPAN in a T-pose (~stature), useless as a
      // body-size unit. Use a stature-derived anatomical reference instead
      // (biacromial breadth ≈ 0.26·H → half torso unit ≈ 0.28·H works for our
      // proportional multipliers). armSpan kept for reference.
      armSpan: bb.max.x - bb.min.x,
      width: H * 0.28,
      depth: Math.max(bb.max.z - bb.min.z, H * 0.14),
      // anatomical landmark heights as fraction of stature, expressed as y-coords
      y: function (frac) { return bb.min.y + H * frac; }
    };

    // build the anatomy layers now that we have proportions
    this._buildSkeleton();
    this._buildMuscles();
    this._buildNervous();
    this._buildBrain();

    // apply requested layer config
    this._applyLayerConfig();
    this._applyMode(this.mode);
    this._emit('ready', {});
  };

  Atlas.prototype._proceduralBody = function () {
    var T = window.THREE, g = new T.Group();
    function part(geo, x, y, z) {
      var m = new T.Mesh(geo, makeXrayMaterial({ opacity: 0.5, glow: 0.7 }));
      m.position.set(x, y, z); g.add(m);
      g.add((function () { var wf = makeWireframe(geo, COLD_CYAN, 0.18); wf.position.set(x, y, z); return wf; })());
    }
    part(new T.SphereGeometry(0.16, 24, 18), 0, 1.55, 0);            // head
    part(new T.CylinderGeometry(0.07, 0.09, 0.18, 16), 0, 1.38, 0);  // neck
    part(CapGeo(0.26, 0.55, 8, 16), 0, 1.0, 0);       // torso
    part(CapGeo(0.09, 0.55, 6, 12), -0.34, 1.05, 0);  // arm L
    part(CapGeo(0.09, 0.55, 6, 12), 0.34, 1.05, 0);   // arm R
    part(CapGeo(0.12, 0.7, 6, 12), -0.13, 0.4, 0);    // leg L
    part(CapGeo(0.12, 0.7, 6, 12), 0.13, 0.4, 0);     // leg R
    return g;
  };

  // ── SKELETON (procedural, proportion-driven) ───────────────────────────────
  Atlas.prototype._buildSkeleton = function () {
    var T = window.THREE, M = this._metrics, g = new T.Group(); g.name = 'skeleton';
    var boneMat = function () { return makeXrayMaterial({ color: 0xE8FBFF, rim: RIM_WHITE, opacity: 0.7, glow: 1.0, fresnelPower: 1.8 }); };
    function add(geo, x, y, z, rx) { var m = new T.Mesh(geo, boneMat()); m.position.set(x, y, z); if (rx) m.rotation.x = rx; g.add(m); return m; }

    var cx = 0, w = M.width;
    // skull
    add(new T.SphereGeometry(w * 0.15, 20, 16), cx, M.y(0.94), 0.01);
    // jaw hint
    add(new T.BoxGeometry(w * 0.14, w * 0.05, w * 0.13), cx, M.y(0.905), 0.02);

    // ── vertebral column with real C/T/L/S segmentation ──
    // each vertebra is a clickable region (cervical/thoracic/lumbar/sacrum)
    var spine = this._buildSpine();           // returns {group, regions}
    g.add(spine.group);

    // ribcage — arcs hanging off thoracic region
    var ribTop = M.y(0.80), ribBot = M.y(0.62);
    for (var i = 0; i < 6; i++) {
      var ry = ribTop - (ribTop - ribBot) * (i / 5);
      var rw = w * (0.34 - i * 0.012);
      var torus = new T.TorusGeometry(rw, w * 0.012, 6, 24, Math.PI * 1.15);
      var rib = add(torus, cx, ry, -0.02); rib.rotation.x = Math.PI / 2; rib.rotation.z = Math.PI * 0.93;
      var rib2 = add(torus, cx, ry, -0.02); rib2.rotation.x = Math.PI / 2; rib2.rotation.z = -Math.PI * 0.93 + Math.PI;
    }
    // sternum
    add(new T.BoxGeometry(w * 0.05, (ribTop - ribBot) * 0.8, w * 0.02), cx, (ribTop + ribBot) / 2, M.depth * 0.32);

    // pelvis
    var pelvis = add(new T.TorusGeometry(w * 0.2, w * 0.03, 8, 20, Math.PI), cx, M.y(0.50), 0);
    pelvis.rotation.x = Math.PI / 2;
    // clavicles + shoulders
    add(new T.CylinderGeometry(w*0.02, w*0.02, w*0.34, 8), cx, M.y(0.82), M.depth*0.18).rotation.z = Math.PI/2;

    // limb long-bones — arms held HORIZONTALLY to match the T-pose body mesh.
    var armY = M.y(0.82), span = M.armSpan;
    var sx = w * 0.2;                         // shoulder joint
    var elbowX = span * 0.26, wristX = span * 0.42;
    this._bone(g, boneMat, -sx, armY, 0, -elbowX, armY, 0, w*0.03);  // humerus L
    this._bone(g, boneMat,  sx, armY, 0,  elbowX, armY, 0, w*0.03);  // humerus R
    this._bone(g, boneMat, -elbowX, armY, 0, -wristX, armY, 0, w*0.024); // forearm L
    this._bone(g, boneMat,  elbowX, armY, 0,  wristX, armY, 0, w*0.024); // forearm R
    var hipX = w * 0.09, kneeY = M.y(0.27), ankleY = M.y(0.04);
    this._bone(g, boneMat, -hipX, M.y(0.50), 0, -hipX, kneeY, 0.01, w*0.03); // femur L
    this._bone(g, boneMat,  hipX, M.y(0.50), 0,  hipX, kneeY, 0.01, w*0.03); // femur R
    this._bone(g, boneMat, -hipX, kneeY, 0.01, -hipX, ankleY, 0.02, w*0.024); // tibia L
    this._bone(g, boneMat,  hipX, kneeY, 0.01,  hipX, ankleY, 0.02, w*0.024); // tibia R

    this.root.add(g);
    this._layers.skeleton = g;
    this._layerState.skeleton = { visible: false, opacity: 0.7 };
    this._spineRegions = spine.regions;
  };

  Atlas.prototype._bone = function (parent, matFn, x1, y1, z1, x2, y2, z2, r) {
    var T = window.THREE;
    var a = new T.Vector3(x1, y1, z1), b = new T.Vector3(x2, y2, z2);
    var len = a.distanceTo(b);
    var geo = new T.CylinderGeometry(r, r * 0.85, len, 10);
    var m = new T.Mesh(geo, matFn());
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    parent.add(m);
    return m;
  };

  // Vertebral column — cervical(7), thoracic(12), lumbar(5), sacrum.
  // Each segment group is hit-testable with a region id used by sensation-map.
  Atlas.prototype._buildSpine = function () {
    var T = window.THREE, M = this._metrics, w = M.width;
    var group = new T.Group(); group.name = 'spine';
    var regions = [];
    var segs = [
      { id: 'cervical-spine',  ru:'Шейный отдел',    en:'Cervical spine',  es:'Columna cervical',  y0:0.84, y1:0.90, n:7,  z: -M.depth*0.05 },
      { id: 'thoracic-spine',  ru:'Грудной отдел',   en:'Thoracic spine',  es:'Columna torácica',  y0:0.62, y1:0.84, n:12, z: -M.depth*0.12 },
      { id: 'lumbar-spine',    ru:'Поясничный отдел',en:'Lumbar spine',    es:'Columna lumbar',    y0:0.52, y1:0.62, n:5,  z: -M.depth*0.08 },
      { id: 'sacral-spine',    ru:'Крестцовый отдел',en:'Sacrum / coccyx', es:'Sacro / cóccix',    y0:0.46, y1:0.52, n:4,  z: -M.depth*0.02 }
    ];
    var mat = function () { return makeXrayMaterial({ color: 0xE8FBFF, opacity: 0.75, glow: 1.0, fresnelPower: 1.7 }); };
    segs.forEach(function (s) {
      var sg = new T.Group();
      sg.userData = { regionId: s.id, names: { ru: s.ru, en: s.en, es: s.es }, layer: 'skeleton' };
      for (var i = 0; i < s.n; i++) {
        var t = s.n > 1 ? i / (s.n - 1) : 0;
        var y = M.y(s.y0 + (s.y1 - s.y0) * t);
        var vert = new T.Mesh(new T.BoxGeometry(w * 0.055, (M.y(s.y1) - M.y(s.y0)) / s.n * 0.7 + 0.004, w * 0.05), mat());
        vert.position.set(0, y, s.z);
        sg.add(vert);
      }
      group.add(sg);
      regions.push(sg);
    });
    return { group: group, regions: regions };
  };

  // ── MUSCLES (major groups as translucent volumes) ──────────────────────────
  Atlas.prototype._buildMuscles = function () {
    var T = window.THREE, M = this._metrics, g = new T.Group(); g.name = 'muscles'; var w = M.width;
    var mat = function () { return makeXrayMaterial({ color: 0xC0FFE0, rim: NEURO_GREEN, opacity: 0.45, glow: 0.5, fresnelPower: 2.2 }); };
    function vol(geo, x, y, z, name, ru, en, es) {
      var m = new T.Mesh(geo, mat()); m.position.set(x, y, z);
      if (name) m.userData = { regionId: name, names: { ru: ru, en: en, es: es }, layer: 'muscles' };
      g.add(m); return m;
    }
    vol(CapGeo(w*0.26, (M.y(0.82)-M.y(0.6)), 6, 14), 0, M.y(0.71), 0, 'pectoral-abdominal', 'Грудь / пресс', 'Chest / abdominals', 'Pecho / abdominales');
    vol(new T.SphereGeometry(w*0.13, 14, 12), -w*0.24, M.y(0.79), 0, 'deltoid-l', 'Дельтовидная (Л)', 'Deltoid (L)', 'Deltoides (Izq)');
    vol(new T.SphereGeometry(w*0.13, 14, 12),  w*0.24, M.y(0.79), 0, 'deltoid-r', 'Дельтовидная (П)', 'Deltoid (R)', 'Deltoides (Der)');
    vol(CapGeo(w*0.06, (M.y(0.81)-M.y(0.5))*0.45, 5, 10), -w*0.27, M.y(0.72), 0, 'biceps-l', 'Бицепс (Л)', 'Biceps (L)', 'Bíceps (Izq)');
    vol(CapGeo(w*0.06, (M.y(0.81)-M.y(0.5))*0.45, 5, 10),  w*0.27, M.y(0.72), 0, 'biceps-r', 'Бицепс (П)', 'Biceps (R)', 'Bíceps (Der)');
    vol(CapGeo(w*0.1, (M.y(0.5)-M.y(0.27))*0.7, 6, 12), -w*0.09, M.y(0.4), 0.01, 'quadriceps-l', 'Квадрицепс (Л)', 'Quadriceps (L)', 'Cuádriceps (Izq)');
    vol(CapGeo(w*0.1, (M.y(0.5)-M.y(0.27))*0.7, 6, 12),  w*0.09, M.y(0.4), 0.01, 'quadriceps-r', 'Квадрицепс (П)', 'Quadriceps (R)', 'Cuádriceps (Der)');
    vol(CapGeo(w*0.075, (M.y(0.27)-M.y(0.04))*0.65, 6, 12), -w*0.09, M.y(0.16), -0.02, 'calf-l', 'Икра (Л)', 'Calf (L)', 'Pantorrilla (Izq)');
    vol(CapGeo(w*0.075, (M.y(0.27)-M.y(0.04))*0.65, 6, 12),  w*0.09, M.y(0.16), -0.02, 'calf-r', 'Икра (П)', 'Calf (R)', 'Pantorrilla (Der)');

    this.root.add(g);
    this._layers.muscles = g;
    this._layerState.muscles = { visible: false, opacity: 0.45 };
  };

  // ── NERVOUS SYSTEM (spinal cord + major nerve trunks) ──────────────────────
  Atlas.prototype._buildNervous = function () {
    var T = window.THREE, M = this._metrics, g = new T.Group(); g.name = 'nervous'; var w = M.width;
    var mat = new T.LineBasicMaterial({ color: NEURO_GREEN, transparent: true, opacity: 0.85, depthWrite: false });
    var tubeMat = function () { return makeXrayMaterial({ color: NEURO_GREEN, rim: 0xFFFFFF, opacity: 0.8, glow: 1.0, fresnelPower: 1.6 }); };

    // spinal cord — tube following the vertebral column
    var cordPts = [
      new T.Vector3(0, M.y(0.90), -M.depth*0.04),
      new T.Vector3(0, M.y(0.82), -M.depth*0.06),
      new T.Vector3(0, M.y(0.70), -M.depth*0.10),
      new T.Vector3(0, M.y(0.60), -M.depth*0.10),
      new T.Vector3(0, M.y(0.50), -M.depth*0.04)
    ];
    var cordCurve = new T.CatmullRomCurve3(cordPts);
    var cord = new T.Mesh(new T.TubeGeometry(cordCurve, 40, w*0.018, 8, false), tubeMat());
    cord.userData = { regionId: 'spinal-cord', names: { ru:'Спинной мозг', en:'Spinal cord', es:'Médula espinal' }, layer: 'nervous' };
    g.add(cord);

    // peripheral nerve trunks (curves) — arms & legs
    function nerve(pts) {
      var curve = new T.CatmullRomCurve3(pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); }));
      var geo = new T.TubeGeometry(curve, 24, w*0.006, 5, false);
      g.add(new T.Mesh(geo, tubeMat()));
    }
    // brachial → arm L/R
    nerve([[0,M.y(0.80),-0.04],[-w*0.2,M.y(0.80),0],[-w*0.27,M.y(0.66),0],[-w*0.3,M.y(0.5),0.02]]);
    nerve([[0,M.y(0.80),-0.04],[ w*0.2,M.y(0.80),0],[ w*0.27,M.y(0.66),0],[ w*0.3,M.y(0.5),0.02]]);
    // sciatic → leg L/R
    nerve([[0,M.y(0.50),-0.04],[-w*0.09,M.y(0.48),-0.02],[-w*0.09,M.y(0.27),0.01],[-w*0.09,M.y(0.05),0.02]]);
    nerve([[0,M.y(0.50),-0.04],[ w*0.09,M.y(0.48),-0.02],[ w*0.09,M.y(0.27),0.01],[ w*0.09,M.y(0.05),0.02]]);

    this.root.add(g);
    this._layers.nervous = g;
    this._layerState.nervous = { visible: false, opacity: 0.8 };
  };

  // ── BRAIN (named, hit-testable regions) ─────────────────────────────────────
  Atlas.prototype._buildBrain = function () {
    var T = window.THREE, M = this._metrics, w = M.width;
    var g = new T.Group(); g.name = 'brain';
    // local brain frame at head center
    var headY = M.y(0.94);
    var R = w * 0.15;          // cerebrum radius
    g.position.set(0, headY, w * 0.02);
    this._brainGroup = g;
    this._brainCenter = new T.Vector3(0, headY, w * 0.02);
    this._brainRadius = R;

    var self = this;
    function regionMesh(id, geo, color, pos, rot, scale) {
      var info = BRAIN_REGIONS.filter(function (r) { return r.id === id; })[0] || { id: id };
      var m = new T.Mesh(geo, makeXrayMaterial({ color: color, rim: RIM_WHITE, opacity: 0.5, glow: 0.7, fresnelPower: 2.2 }));
      if (pos) m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      if (scale) m.scale.set(scale[0], scale[1], scale[2]);
      m.userData = {
        regionId: id, brain: true, layer: 'brain',
        names: { ru: info.ru, en: info.en, es: info.es },
        group: info.group, baseOpacity: 0.5
      };
      g.add(m);
      self._regionMeshes.push(m);
      // wireframe net on cortical lobes for the holographic look
      if (info.group === 'cortex' || info.group === 'cerebellum') {
        var wf = makeWireframe(geo, color, 0.16); if (pos) wf.position.copy(m.position); if (rot) wf.rotation.copy(m.rotation); if (scale) wf.scale.copy(m.scale); g.add(wf);
      }
      return m;
    }

    // Cerebral hemispheres split into 4 lobes (sphere octants, slightly flattened).
    // frontal (front), parietal (top-back), temporal (low-side), occipital (back)
    var lobeGeo = function () { return new T.SphereGeometry(R, 28, 22, 0, Math.PI*2, 0, Math.PI); };
    regionMesh('frontal-lobe',   new T.SphereGeometry(R*0.95, 24, 18, 0, Math.PI, 0, Math.PI*0.65), COLD_CYAN, [0, R*0.15, R*0.55], [Math.PI*0.15, 0, 0], [1, 0.9, 0.9]);
    regionMesh('parietal-lobe',  new T.SphereGeometry(R*0.9, 24, 18, 0, Math.PI, 0, Math.PI*0.55), COLD_CYAN, [0, R*0.35, -R*0.2], [-Math.PI*0.2, 0, 0], [1, 0.95, 0.95]);
    regionMesh('occipital-lobe', new T.SphereGeometry(R*0.7, 22, 16, 0, Math.PI, 0, Math.PI*0.6), COLD_CYAN, [0, R*0.05, -R*0.75], [Math.PI*0.55, Math.PI, 0], [1, 0.85, 0.8]);
    regionMesh('temporal-lobe',  new T.SphereGeometry(R*0.55, 20, 14), COLD_CYAN, [0, -R*0.45, R*0.15], null, [1.5, 0.55, 1.1]);

    // deep / limbic structures (paired, centered)
    regionMesh('thalamus',     new T.SphereGeometry(R*0.18, 16, 12), NEURO_GREEN, [0, -R*0.02, 0], null, [1.6, 0.9, 1.1]);
    regionMesh('hypothalamus', new T.SphereGeometry(R*0.09, 14, 10), NEURO_GREEN, [0, -R*0.22, R*0.08], null, [1.4, 0.7, 1]);
    regionMesh('hippocampus',  new T.TorusGeometry(R*0.16, R*0.035, 8, 20, Math.PI*1.1), NEURO_GREEN, [0, -R*0.3, -R*0.05], [Math.PI*0.5, 0, 0], [1.4, 1, 1]);
    regionMesh('amygdala',     new T.SphereGeometry(R*0.07, 12, 10), NEURO_GREEN, [0, -R*0.32, R*0.25], null, [1.6, 1, 1]);
    regionMesh('basal-ganglia',new T.SphereGeometry(R*0.12, 14, 12), WARM_CYAN, [0, R*0.05, R*0.1], null, [1.8, 1.1, 1.2]);

    // cerebellum — posterior-inferior, textured hemisphere
    regionMesh('cerebellum',   new T.SphereGeometry(R*0.45, 24, 16), WARM_CYAN, [0, -R*0.6, -R*0.7], null, [1.3, 0.75, 1]);

    // brainstem — stacked midbrain / pons / medulla
    regionMesh('midbrain',     new T.CylinderGeometry(R*0.1, R*0.11, R*0.18, 12), WARM_CYAN, [0, -R*0.55, R*0.0]);
    regionMesh('pons',         new T.CylinderGeometry(R*0.12, R*0.12, R*0.2, 12), WARM_CYAN, [0, -R*0.78, R*0.02]);
    regionMesh('medulla',      new T.CylinderGeometry(R*0.11, R*0.08, R*0.22, 12), WARM_CYAN, [0, -R*1.0, R*0.0]);

    this.root.add(g);
    this._layers.brain = g;
    this._layerState.brain = { visible: false, opacity: 0.5 };
  };

  // ── real anatomical brain (Z-Anatomy) — lazy, streamed once ──────────────────
  // Replaces the 13 procedural capsules with ~228 individually-named meshes (124
  // distinct structures). Every mesh is its own hit-testable region: its slug +
  // side resolve to a localized {en,ru,es} name via the anatomy-brain dictionary,
  // and its coarseId picks the holographic colour + the region-panel description.
  // The procedural brain stays as an instant preview until the GLB swaps in.
  Atlas.prototype._loadBrainDetail = function () {
    if (this._brainDetailReq) return this._brainDetailReq;
    var self = this, T = window.THREE;
    function regionInfo(id) {
      for (var i = 0; i < BRAIN_REGIONS.length; i++) if (BRAIN_REGIONS[i].id === id) return BRAIN_REGIONS[i];
      return null;
    }
    this._brainDetailReq = Promise.all([loadModelsConfig(), loadBrainI18n()]).then(function (res) {
      var cfg = res[0], dict = res[1] || {};
      var url = cfg && cfg.brainDetail;
      if (!url) return null;                           // no real source → keep procedural
      return new Promise(function (resolve) {
        var loader = new T.GLTFLoader();
        try {
          if (T.DRACOLoader) {
            var draco = new T.DRACOLoader();
            draco.setDecoderPath(cfg.dracoDecoderPath || 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            loader.setDRACOLoader(draco);
          }
        } catch (e) { /* draco optional */ }
        self._emit('brain-loading', {});
        loader.load(url, function (gltf) {
          if (self._destroyed) { resolve(null); return; }
          var grp = new T.Group(); grp.name = 'brain-real';
          var meshes = [];
          // each mesh carries its own anatomical tag in node.extras (→ userData):
          // { regionName, base, slug, side, coarseId }. Walk up only as a fallback
          // for multi-primitive nodes (Group keeps extras, child Meshes don't).
          function resolveTag(o) {
            var n = o;
            while (n) { if (n.userData && n.userData.slug) return n.userData; n = n.parent; }
            return null;
          }
          gltf.scene.traverse(function (o) {
            if (!o.isMesh || !o.geometry) return;
            var tag = (o.userData && o.userData.slug) ? o.userData : resolveTag(o);
            var coarseId = tag ? tag.coarseId : null;
            var info = coarseId ? regionInfo(coarseId) : null;     // coarse → colour + group
            o.material = makeXrayMaterial({ color: info ? info.color : COLD_CYAN, rim: RIM_WHITE, opacity: 0.5, glow: 0.7, fresnelPower: 2.2 });
            var slug = tag ? tag.slug : null, side = tag ? (tag.side || '') : '';
            o.userData = {
              regionId: slug ? (slug + (side ? '_' + side : '')) : 'brain',  // fine, per-mesh
              slug: slug, coarseId: coarseId,
              regionName: tag ? tag.regionName : o.name,
              names: brainNames(dict, slug, side),          // localized {en,ru,es} fine name
              group: info ? info.group : '', layer: 'brain', brain: true, baseOpacity: 0.5
            };
            meshes.push(o);
          });
          grp.add(gltf.scene);
          self.root.add(grp);
          self._brainRealGroup = grp;
          self._brainRealMeshes = meshes;
          // frame the camera on the real brain's true bounding box
          var box = new T.Box3().setFromObject(grp);
          var c = box.getCenter(new T.Vector3());
          var size = box.getSize(new T.Vector3());
          self._brainCenter = c;
          self._brainRadius = Math.max(size.x, size.y, size.z) * 0.5 || self._brainRadius;
          // hide the procedural preview now that the real mesh is in
          if (self._brainGroup) self._brainGroup.visible = false;
          grp.visible = !!self._brainDetail;
          self._emit('brain-loaded', { regions: meshes.length });
          // re-frame if we're already inside brain-detail
          if (self._brainDetail) self._frameBrain();
          resolve(grp);
        }, undefined, function (err) {
          console.warn('[BodyAtlas] brain-detail load failed', err);
          self._emit('brain-error', {});
          resolve(null);
        });
      });
    });
    return this._brainDetailReq;
  };

  Atlas.prototype._frameBrain = function () {
    if (!this._brainCenter) return;
    var T = window.THREE;
    // fit the brain's bounding sphere to the vertical FOV (+ margin) so it fills
    // the view regardless of viewport aspect, instead of a fixed radius multiple.
    var fov = ((this.camera && this.camera.fov) || 38) * Math.PI / 180;
    var dist = (this._brainRadius / Math.sin(fov / 2)) * 1.35;
    this._tweenCamera(this._brainCenter.clone().add(new T.Vector3(0, 0, dist)), this._brainCenter.clone());
    if (this.controls) this.controls.minDistance = this._brainRadius * 1.1;
  };

  // ── layer config / visibility / opacity ────────────────────────────────────
  Atlas.prototype._applyLayerConfig = function () {
    var requested = this.opts.layers;   // array of layer names to show, or undefined = full
    var all = ['skin', 'muscles', 'skeleton', 'nervous', 'brain'];
    var self = this;
    all.forEach(function (name) {
      if (!self._layers[name]) return;
      var visible;
      if (requested) visible = requested.indexOf(name) !== -1;
      else visible = (name === 'skin');   // default: skin on, rest off (full mode reveals via UI)
      self.toggleLayer(name, visible);
    });
  };

  Atlas.prototype.toggleLayer = function (name, visible) {
    visible = !!visible;
    if (this._layerState[name]) this._layerState[name].visible = visible;
    else this._layerState[name] = { visible: visible, opacity: (LAYER_STYLE[name] && LAYER_STYLE[name].opacity) || 0.5 };
    var grp = this._layers[name];
    if (grp) grp.visible = visible;
    // Stream the real Z-Anatomy mesh the first time a layer is shown; the
    // procedural capsule (if any) stays visible until the GLB swaps in.
    if (visible) this._loadRealLayer(name);
    this._emit('layer-change', { layer: name, visible: visible });
  };

  // ── real model streaming (lazy, per layer) ─────────────────────────────────
  // GLBs are pre-normalized to the atlas frame (centered, height ≈ 2.0), so they
  // mount directly with no extra transform. Materials are replaced with the
  // holographic x-ray shader at load time.
  Atlas.prototype._loadRealLayer = function (name) {
    var self = this, T = window.THREE;
    if (!this._real) this._real = {};
    if (this._real[name]) return this._real[name];     // already loading/loaded
    this._real[name] = Promise.all([loadModelsConfig(), loadAnatomyData()]).then(function (arr) {
      var cfg = arr[0], anat = arr[1];
      if (anat) self._anat = anat;     // {ru, es, cns} cached for name resolution
      if (!cfg || !cfg.layers || !cfg.layers[name]) return null;   // no real source → keep procedural
      var url = cfg.layers[name];
      return new Promise(function (resolve) {
        var loader = new T.GLTFLoader();
        try {
          if (T.DRACOLoader) {
            var draco = new T.DRACOLoader();
            draco.setDecoderPath(cfg.dracoDecoderPath || 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            loader.setDRACOLoader(draco);
          }
        } catch (e) { /* draco optional */ }
        self._emit('layer-loading', { layer: name });
        loader.load(url, function (gltf) {
          var grp = new T.Group(); grp.name = name + '-real';
          var style = LAYER_STYLE[name] || { color: COLD_CYAN, opacity: 0.5, glow: 0.7 };
          var cns = (self._anat && self._anat.cns) || {};
          var tagged = 0;
          // sanitized→raw node-name map, so we can undo GLTFLoader's name mangling
          var rawByClean = {};
          try {
            var nodes = gltf.parser && gltf.parser.json && gltf.parser.json.nodes;
            if (nodes) nodes.forEach(function (nd) { if (nd && nd.name) rawByClean[sanitizeNodeName(nd.name)] = nd.name; });
          } catch (e) { /* fall back to o.name below */ }
          gltf.scene.traverse(function (o) {
            if (!(o.isMesh && o.geometry)) return;
            o.material = makeXrayMaterial(style);
            // Tag every named mesh as an individual hit-testable region. Recover
            // the raw anatomical node name (with its .l/.r/.j marker) from the
            // parser json; fall back to the sanitized name or a named ancestor.
            var rawName = rawByClean[o.name] || (o.parent && rawByClean[o.parent.name]) || o.name || (o.parent && o.parent.name) || '';
            var p = parseAnatName(name, rawName);
            if (!p.baseSlug) return;     // garbage / unnamed mesh → not clickable
            o.userData.regionId = p.regionId;
            o.userData.baseSlug = p.baseSlug;
            o.userData.displayEn = p.displayEn;
            o.userData.side = p.side;
            o.userData.originalName = rawName;
            o.userData.layer = name;
            // nervous CNS (brain/brainstem/cerebellum/cord nuclei) is the parallel
            // brain-detail session's domain — render it, but don't hit-test it here.
            if (name === 'nervous' && cns[rawName]) o.userData.isBrain = true;
            tagged++;
          });
          console.log('[BodyAtlas] ' + name + ': ' + tagged + ' named regions');
          grp.add(gltf.scene);
          self._swapRealLayer(name, grp);
          self._emit('layer-loaded', { layer: name, regions: tagged });
          resolve(grp);
        }, undefined, function (err) {
          console.warn('[BodyAtlas] real layer load failed: ' + name, err);
          self._emit('layer-error', { layer: name });
          resolve(null);
        });
      });
    });
    return this._real[name];
  };

  Atlas.prototype._swapRealLayer = function (name, grp) {
    if (this._destroyed) return;
    var old = this._layers[name];
    if (old && old.parent) old.parent.remove(old);   // drop procedural capsule
    this.root.add(grp);
    this._layers[name] = grp;
    var st = this._layerState[name] || { visible: false, opacity: (LAYER_STYLE[name] && LAYER_STYLE[name].opacity) || 0.5 };
    grp.visible = !!st.visible;
    this.setLayerOpacity(name, st.opacity != null ? st.opacity : 0.5);
  };

  Atlas.prototype.setLayerOpacity = function (name, opacity) {
    var grp = this._layers[name]; if (!grp) return;
    opacity = Math.max(0, Math.min(1, opacity));
    if (this._layerState[name]) this._layerState[name].opacity = opacity;
    grp.traverse(function (o) {
      if (o.material) {
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (mt) {
          if (mt.uniforms && mt.uniforms.uOpacity) mt.uniforms.uOpacity.value = opacity * ((o.userData && o.userData.baseOpacity) ? o.userData.baseOpacity * 2 : 1);
          else { mt.opacity = opacity; mt.transparent = true; }
        });
      }
    });
  };

  // ── modes ──────────────────────────────────────────────────────────────────
  Atlas.prototype.setMode = function (mode) { this.mode = mode; this._applyMode(mode); };

  Atlas.prototype._applyMode = function (mode) {
    if (!this.controls) return;
    if (mode === 'sensation-picker') {
      this.controls.enableRotate = false;
      this.controls.enableZoom = false;
      this.camera.position.set(0, 0.1, 3.2);
      this.controls.target.set(0, 0, 0);
      // skin only
      if (this._layers.skin) this.toggleLayer('skin', true);
      ['muscles', 'skeleton', 'nervous', 'brain'].forEach(function (n) { /* hidden */ });
      var self = this;
      ['muscles', 'skeleton', 'nervous', 'vessels', 'organs', 'brain'].forEach(function (n) { if (self._layers[n]) self.toggleLayer(n, false); });
    } else if (mode === 'brain-detail') {
      this.enterBrainDetail();
    } else { // full
      this.controls.enableRotate = true;
      this.controls.enableZoom = true;
    }
  };

  Atlas.prototype.setRotation = function (yawDeg, pitchDeg) {
    if (!this.root) return;
    this.root.rotation.y = (yawDeg || 0) * Math.PI / 180;
    this.root.rotation.x = (pitchDeg || 0) * Math.PI / 180;
  };

  // sensation-picker front/back toggle
  Atlas.prototype.flipView = function () {
    this._frontView = !this._frontView;
    this.setRotation(this._frontView ? 0 : 180, 0);
    return this._frontView;
  };

  Atlas.prototype.resetView = function () {
    if (!this.controls) return;
    this.root.rotation.set(0, 0, 0);
    this.camera.position.set(0, 0.1, 4.2);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  };

  // ── brain detail mode (zoom + body fade) ────────────────────────────────────
  Atlas.prototype.enterBrainDetail = function () {
    if (!this._brainGroup) return;
    this._brainDetail = true;
    // procedural capsules are an instant preview; the real GLB swaps in async
    if (this._brainRealGroup) { this._brainRealGroup.visible = true; this._brainGroup.visible = false; }
    else this.toggleLayer('brain', true);
    this._loadBrainDetail();
    ['skin', 'muscles', 'skeleton', 'nervous', 'vessels', 'organs'].forEach((function (n) { this.toggleLayer(n, false); }).bind(this));
    this._frameBrain();
    this._emit('brain-enter', {});
  };

  Atlas.prototype.exitBrainDetail = function () {
    this._brainDetail = false;
    if (this._brainRealGroup) this._brainRealGroup.visible = false;
    this.toggleLayer('skin', true);
    this.toggleLayer('brain', false);
    this.controls.minDistance = 0.4;
    this._tweenCamera(new window.THREE.Vector3(0, 0.1, 4.2), new window.THREE.Vector3(0, 0, 0));
    this._emit('brain-exit', {});
  };

  Atlas.prototype.focusOrgan = function (organId) {
    // organId one of brain region ids or 'heart','liver','lungs','kidneys'
    var target = this._organAnchor(organId);
    if (!target) return;
    ['muscles', 'skeleton', 'nervous', 'vessels', 'organs'].forEach((function (n) { this.toggleLayer(n, false); }).bind(this));
    this.setLayerOpacity('skin', 0.1);
    this.toggleLayer('skin', true);
    this._tweenCamera(target.clone().add(new window.THREE.Vector3(0.4, 0.2, 1.0)), target.clone());
  };

  Atlas.prototype._organAnchor = function (id) {
    var M = this._metrics; if (!M) return null;
    var T = window.THREE;
    var map = {
      heart:   new T.Vector3(-M.width*0.05, M.y(0.72), M.depth*0.1),
      lungs:   new T.Vector3(0, M.y(0.74), 0),
      liver:   new T.Vector3(M.width*0.08, M.y(0.64), M.depth*0.12),
      kidneys: new T.Vector3(0, M.y(0.58), -M.depth*0.12),
      brain:   this._brainCenter ? this._brainCenter.clone() : new T.Vector3(0, M.y(0.94), 0)
    };
    return map[id] || null;
  };

  Atlas.prototype._tweenCamera = function (toPos, toTarget) {
    var self = this, T = window.THREE;
    var fromPos = this.camera.position.clone();
    var fromTgt = this.controls.target.clone();
    var t0 = null, dur = 700;
    function step(ts) {
      if (self._destroyed) return;
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var e = k < 0.5 ? 2*k*k : 1 - Math.pow(-2*k+2, 2)/2; // easeInOutQuad
      self.camera.position.lerpVectors(fromPos, toPos, e);
      self.controls.target.lerpVectors(fromTgt, toTarget, e);
      self.controls.update();
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  // ── hit testing ─────────────────────────────────────────────────────────────
  Atlas.prototype.hitTest = function (screenX, screenY) {
    if (!this.renderer) return null;
    var rect = this.renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this._mouse, this.camera);
    var targets = this._hittableMeshes();
    var hits = this.raycaster.intersectObjects(targets, true);
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      while (o && (!o.userData || !o.userData.regionId)) o = o.parent;
      if (o && o.userData && o.userData.regionId) {
        // CNS meshes are non-interactive outside brain-detail (their geometry is
        // still ray-hit, so skip them here and let the loop continue past).
        if (o.userData.isBrain && !this._brainDetail) continue;
        return { id: o.userData.regionId, names: this._regionNames(o.userData), object: o, point: hits[i].point, layer: o.userData.layer };
      }
    }
    return null;
  };

  // Resolve a region's display names. Procedural regions carry an explicit
  // userData.names {ru,en,es}; streamed Z-Anatomy meshes resolve on the fly:
  // en = humanized Latin (+ left/right), ru/es from the lazy dictionary (+ a
  // localized side label) — undefined when no translation exists, so the UI
  // honestly shows the Latin term alone rather than a wrong guess.
  Atlas.prototype._regionNames = function (ud) {
    if (ud.names) return ud.names;
    var sideEn = ud.side === 'l' ? ' (left)' : ud.side === 'r' ? ' (right)' : '';
    var en = (ud.displayEn || ud.originalName || ud.regionId) + sideEn;
    var dict = this._anat || {};
    var ru = dict.ru && dict.ru[ud.baseSlug];
    var es = dict.es && dict.es[ud.baseSlug];
    var sideRu = ud.side === 'l' ? ' (левая)' : ud.side === 'r' ? ' (правая)' : '';
    var sideEs = ud.side === 'l' ? ' (izq.)' : ud.side === 'r' ? ' (der.)' : '';
    return { en: en, ru: ru ? ru + sideRu : undefined, es: es ? es + sideEs : undefined };
  };

  Atlas.prototype._hittableMeshes = function () {
    var self = this, arr = [];
    if (this._brainDetail && (this._brainRealGroup || this._brainGroup)) {
      // brain-detail session's domain: prefer the real anatomical brain once it
      // has streamed in, else the procedural brain regions.
      var src = (this._brainRealGroup && this._brainRealGroup.visible) ? this._brainRealGroup : this._brainGroup;
      src.traverse(function (o) { if (o.isMesh && o.userData && o.userData.regionId) arr.push(o); });
      return arr;
    }
    // Every visible loaded layer contributes its named meshes — generic per-mesh
    // hit-testing across skin/muscles/skeleton/nervous/vessels/organs.
    Object.keys(this._layers).forEach(function (ln) {
      if (ln === 'brain') return;            // brain only in detail mode (above)
      var grp = self._layers[ln]; if (!grp || !grp.visible) return;
      grp.traverse(function (o) {
        if (!(o.isMesh || o.isGroup)) return;
        if (o.userData && o.userData.regionId) arr.push(o);
      });
    });
    // skin head → brain entry (procedural skin has no per-mesh regions)
    if (this._layers.skin && this._layers.skin.visible) arr.push(this._layers.skin);
    return arr;
  };

  // ── events ───────────────────────────────────────────────────────────────────
  Atlas.prototype.on = function (ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); return this; };
  Atlas.prototype._emit = function (ev, data) { (this._handlers[ev] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.warn(e); } }); };

  Atlas.prototype._bindEvents = function () {
    var self = this, el = this.renderer.domElement;
    this._onMove = function (e) {
      var pt = e.touches ? e.touches[0] : e;
      var hit = self.hitTest(pt.clientX, pt.clientY);
      el.style.cursor = hit ? 'pointer' : '';
      self._highlight(hit ? hit.object : null);
      self._emit('region-hover', hit);
    };
    this._onClick = function (e) {
      var pt = e.changedTouches ? e.changedTouches[0] : e;
      var hit = self.hitTest(pt.clientX, pt.clientY);
      if (hit) {
        // clicking the head (skin) in full mode → brain detail
        if (!self._brainDetail && hit.object === self._layers.skin) {
          var localY = hit.point.y;
          if (self._metrics && localY > self._metrics.y(0.86)) { self.enterBrainDetail(); return; }
        }
        self._emit('region-click', hit);
      } else {
        self._emit('empty-click', { x: pt.clientX, y: pt.clientY });
      }
    };
    el.addEventListener('mousemove', this._onMove);
    el.addEventListener('click', this._onClick);
    el.addEventListener('touchend', this._onClick);

    // ── B2 + B5: zoom-to-cursor with a logarithmic curve ──────────────────────
    // We intercept the wheel in the CAPTURE phase and stopImmediatePropagation so
    // OrbitControls' own dolly never runs (it zooms toward target = pelvis, which
    // was Nick's complaint). We raycast the cursor to find the world point under
    // it and scale both camera and target about that pivot, so the point under the
    // cursor stays fixed while everything zooms around it.
    this._onWheel = function (e) {
      if (!self.camera || !self.controls || self._destroyed) return;
      e.preventDefault(); e.stopImmediatePropagation();
      var rect = el.getBoundingClientRect();
      var rw = rect.width || el.clientWidth, rh = rect.height || el.clientHeight;
      var pivot;
      if (rw > 0 && rh > 0) {
        self._mouse.set(((e.clientX - rect.left) / rw) * 2 - 1,
                        -((e.clientY - rect.top) / rh) * 2 + 1);
        self.raycaster.setFromCamera(self._mouse, self.camera);
        var hits = self.root ? self.raycaster.intersectObjects(self.root.children, true) : [];
        pivot = (hits && hits.length) ? hits[0].point.clone() : self.controls.target.clone();
      } else {
        pivot = self.controls.target.clone();   // can't locate cursor → plain center zoom
      }
      var cam = self.camera.position, tgt = self.controls.target;
      var dist = cam.distanceTo(tgt);
      // normalise deltaY across deltaMode (pixel / line / page)
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      var scale = Math.exp(dy * 0.0012);                 // log curve, proportional to zoom
      var newDist = Math.max(self.controls.minDistance, Math.min(self.controls.maxDistance, dist * scale));
      scale = dist > 1e-5 ? newDist / dist : 1;
      cam.sub(pivot).multiplyScalar(scale).add(pivot);
      tgt.sub(pivot).multiplyScalar(scale).add(pivot);
    };
    el.addEventListener('wheel', this._onWheel, { capture: true, passive: false });

    // ── B3: Shift+drag → pan (only effective once zoomed past 1.5x, gated in loop)
    this._onPointerDown = function (e) {
      var T = window.THREE;
      if (e.shiftKey && self.controls && T && T.MOUSE) self.controls.mouseButtons.LEFT = T.MOUSE.PAN;
    };
    this._onPointerUp = function () {
      var T = window.THREE;
      if (self.controls && T && T.MOUSE) self.controls.mouseButtons.LEFT = T.MOUSE.ROTATE;
    };
    el.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);

    this._onResize = function () { self._resize(); };
    window.addEventListener('resize', this._onResize);
  };

  Atlas.prototype._highlight = function (obj) {
    if (this._hl === obj) return;
    if (this._hl && this._hl.material && this._hl.material.uniforms && this._hl.material.uniforms.uGlow) {
      this._hl.material.uniforms.uGlow.value = this._hlPrev;
    }
    this._hl = obj;
    if (obj && obj.material && obj.material.uniforms && obj.material.uniforms.uGlow) {
      this._hlPrev = obj.material.uniforms.uGlow.value;
      obj.material.uniforms.uGlow.value = 2.2;
    }
  };

  Atlas.prototype._resize = function () {
    if (!this.renderer || this._destroyed) return;
    var w = this.container.clientWidth || 600, h = this.container.clientHeight || 600;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  // ── render loop ───────────────────────────────────────────────────────────────
  Atlas.prototype._startLoop = function () {
    var self = this;
    function frame() {
      if (self._destroyed) return;
      self._raf = requestAnimationFrame(frame);
      if (self.controls) {
        // B3: only allow panning once the user has zoomed in past 1.5x (no pan at
        // the default overview, where it would feel like the model drifting away).
        if (self._baseDist) {
          var d = self.camera.position.distanceTo(self.controls.target);
          self.controls.enablePan = d < self._baseDist / 1.5;
        }
        self.controls.update();
      }
      self.renderer.render(self.scene, self.camera);
    }
    frame();
  };

  // ── reconfigure (render) ─────────────────────────────────────────────────────
  Atlas.prototype.render = function (opts) {
    opts = opts || {};
    if (opts.mode) this.setMode(opts.mode);
    if (opts.layers) { this.opts.layers = opts.layers; this._applyLayerConfig(); }
    if (opts.rotation === 'fixed') { if (this.controls) this.controls.enableRotate = false; }
    if (opts.hitMap) this.hitMap = opts.hitMap;
    this._resize();
    return this;
  };

  Atlas.prototype.setSex = function (sex) {
    this.sex = sex;   // single mesh available; hook kept for female asset when added
    this._emit('sex-change', { sex: sex });
  };

  Atlas.prototype.destroy = function () {
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    var el = this.renderer && this.renderer.domElement;
    if (el) {
      el.removeEventListener('mousemove', this._onMove);
      el.removeEventListener('click', this._onClick);
      el.removeEventListener('touchend', this._onClick);
      if (this._onWheel) el.removeEventListener('wheel', this._onWheel, { capture: true });
      if (this._onPointerDown) el.removeEventListener('pointerdown', this._onPointerDown);
    }
    if (this._onPointerUp) window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('resize', this._onResize);
    // B10: dispose every GPU resource (geometry / material / textures) before
    // dropping the renderer, so leaving the atlas frees memory and the next tool
    // (e.g. External Field) isn't starved / janky.
    if (this.scene) this.scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
        if (m.map) m.map.dispose();
        for (var k in m) { var v = m[k]; if (v && v.isTexture) v.dispose(); }
        m.dispose();
      });
    });
    if (this.scene && this.scene.clear) this.scene.clear();
    if (this.controls && this.controls.dispose) this.controls.dispose();
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss && this.renderer.forceContextLoss(); if (el && el.parentNode) el.parentNode.removeChild(el); }
    // B10: drop layer/brain caches so nothing keeps the old meshes alive.
    this._layers = {}; this._loadedLayers = {}; this._layerState = {};
    this._brainGroup = null; this._brainDetailMesh = null; this._brainMeshes = null;
    this.scene = this.camera = this.renderer = this.controls = this.root = null;
  };

  // ── public module ────────────────────────────────────────────────────────────
  var _instances = [];
  window.BodyAtlas = {
    REGIONS: BRAIN_REGIONS,
    SENSATION_REGION_MAP: SENSATION_REGION_MAP,
    init: function (container, options) {
      var a = new Atlas(container, options);
      _instances.push(a);
      return a.init();
    },
    // convenience: render(container, opts) — init-or-reconfigure
    render: function (container, opts) {
      if (container && container.__atlas) { container.__atlas.render(opts); return Promise.resolve(container.__atlas); }
      return this.init(container, opts).then(function (a) { container.__atlas = a; return a; });
    },
    ensureThree: ensureThree,
    _instances: _instances
  };
})();
