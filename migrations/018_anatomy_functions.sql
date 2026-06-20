-- 018_anatomy_functions.sql — Body Functions library + region relations + circuits
-- Backs PACK F (Body Functions tool) and PACK B9 (region relations / named circuits).
-- All idempotent. NB: the migrate runner splits on semicolons and strips line
-- comments, so seed strings must contain no semicolons and no double-dash.

CREATE TABLE IF NOT EXISTS anatomy_circuits (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT,
  name_es TEXT,
  description_en TEXT,
  description_ru TEXT,
  description_es TEXT,
  region_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anatomy_region_relations (
  id SERIAL PRIMARY KEY,
  region_a TEXT NOT NULL,
  region_b TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'functional',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (region_a, region_b, relation_type)
);

CREATE TABLE IF NOT EXISTS anatomy_functions (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_ru TEXT,
  name_es TEXT,
  description_en TEXT NOT NULL,
  description_ru TEXT,
  description_es TEXT,
  category TEXT,
  region_ids TEXT[] NOT NULL DEFAULT '{}',
  circuit_ids INTEGER[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anatomy_functions_slug ON anatomy_functions(slug);
CREATE INDEX IF NOT EXISTS idx_anatomy_functions_tags ON anatomy_functions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_anatomy_functions_cat ON anatomy_functions(category);
CREATE INDEX IF NOT EXISTS idx_anatomy_circuits_slug ON anatomy_circuits(slug);

-- ── named circuits ──────────────────────────────────────────────────────────
INSERT INTO anatomy_circuits (slug, name_en, name_ru, name_es, description_en, description_ru, description_es, region_ids) VALUES
  ('default-mode', 'Default Mode Network', 'Сеть пассивного режима', 'Red neuronal por defecto', 'Active during rest, self-reflection and mind-wandering.', 'Активна в покое, при саморефлексии и блуждании мысли.', 'Activa en reposo, autorreflexion y divagacion mental.', '{frontal-lobe,parietal-lobe,cingulate,hippocampus,temporal-lobe}'),
  ('salience', 'Salience Network', 'Сеть значимости', 'Red de relevancia', 'Detects salient stimuli and switches between brain networks.', 'Выделяет значимые стимулы и переключает сети мозга.', 'Detecta estimulos relevantes y alterna entre redes.', '{insula,cingulate,amygdala}'),
  ('executive-control', 'Executive Control Network', 'Сеть исполнительного контроля', 'Red de control ejecutivo', 'Goal-directed attention, working memory and planning.', 'Целенаправленное внимание, рабочая память и планирование.', 'Atencion dirigida, memoria de trabajo y planificacion.', '{frontal-lobe,parietal-lobe}'),
  ('reward-dopaminergic', 'Reward / Dopaminergic Circuit', 'Дофаминергический контур вознаграждения', 'Circuito dopaminergico de recompensa', 'Motivation, reward learning and reinforcement.', 'Мотивация, обучение на вознаграждении и подкрепление.', 'Motivacion, aprendizaje por recompensa y refuerzo.', '{basal-ganglia,midbrain,frontal-lobe,hypothalamus}'),
  ('memory-hippocampal', 'Memory / Hippocampal Circuit', 'Гиппокампальный контур памяти', 'Circuito hipocampal de memoria', 'Encoding and retrieval of episodic memory.', 'Кодирование и извлечение эпизодической памяти.', 'Codificacion y recuperacion de la memoria episodica.', '{hippocampus,fornix,thalamus,cingulate}'),
  ('motor', 'Motor Circuit', 'Двигательный контур', 'Circuito motor', 'Planning, initiation and coordination of movement.', 'Планирование, запуск и координация движения.', 'Planificacion, inicio y coordinacion del movimiento.', '{frontal-lobe,basal-ganglia,cerebellum,thalamus,spinal-cord}')
ON CONFLICT (slug) DO NOTHING;

-- ── region relations ────────────────────────────────────────────────────────
INSERT INTO anatomy_region_relations (region_a, region_b, relation_type) VALUES
  ('frontal-lobe', 'basal-ganglia', 'functional'),
  ('frontal-lobe', 'parietal-lobe', 'functional'),
  ('frontal-lobe', 'thalamus', 'projection'),
  ('frontal-lobe', 'corpus-callosum', 'structural'),
  ('hippocampus', 'fornix', 'structural'),
  ('hippocampus', 'amygdala', 'functional'),
  ('amygdala', 'hypothalamus', 'projection'),
  ('insula', 'cingulate', 'functional'),
  ('cerebellum', 'thalamus', 'projection'),
  ('midbrain', 'basal-ganglia', 'projection'),
  ('thalamus', 'parietal-lobe', 'projection'),
  ('occipital-lobe', 'temporal-lobe', 'functional')
ON CONFLICT (region_a, region_b, relation_type) DO NOTHING;

-- ── functions library ───────────────────────────────────────────────────────
INSERT INTO anatomy_functions (slug, name_en, name_ru, name_es, description_en, description_ru, description_es, category, region_ids, tags) VALUES
  ('attention', 'Attention', 'Внимание', 'Atencion', 'Selecting and sustaining focus on relevant information.', 'Выбор и удержание фокуса на значимой информации.', 'Seleccion y mantenimiento del foco en informacion relevante.', 'cognitive', '{frontal-lobe,parietal-lobe,cingulate,thalamus}', '{focus,concentration,vnimanie}'),
  ('working-memory', 'Working memory', 'Рабочая память', 'Memoria de trabajo', 'Holding and manipulating information over seconds.', 'Удержание и обработка информации в течение секунд.', 'Mantener y manipular informacion durante segundos.', 'executive', '{frontal-lobe,parietal-lobe}', '{memory,executive}'),
  ('memory-recall', 'Memory recall', 'Воспоминание', 'Recuerdo', 'Retrieving stored episodic and semantic memories.', 'Извлечение сохранённых эпизодических и семантических воспоминаний.', 'Recuperacion de recuerdos episodicos y semanticos.', 'cognitive', '{hippocampus,fornix,frontal-lobe,temporal-lobe}', '{memory,recall}'),
  ('decision-making', 'Decision making', 'Принятие решений', 'Toma de decisiones', 'Weighing options and choosing a course of action.', 'Взвешивание вариантов и выбор действия.', 'Evaluar opciones y elegir una accion.', 'cognitive', '{frontal-lobe,basal-ganglia,cingulate}', '{decision,choice}'),
  ('planning', 'Planning', 'Планирование', 'Planificacion', 'Sequencing actions toward a future goal.', 'Выстраивание последовательности действий к цели.', 'Secuenciar acciones hacia un objetivo.', 'cognitive', '{frontal-lobe,parietal-lobe,cerebellum}', '{planning,executive}'),
  ('mental-imagery', 'Mental imagery', 'Мысленные образы', 'Imagineria mental', 'Generating and manipulating images in the mind.', 'Создание и преобразование образов в уме.', 'Generar y manipular imagenes en la mente.', 'cognitive', '{occipital-lobe,parietal-lobe,frontal-lobe}', '{imagery,visualization}'),
  ('learning', 'Learning', 'Обучение', 'Aprendizaje', 'Acquiring new knowledge and skills over time.', 'Приобретение новых знаний и навыков со временем.', 'Adquisicion de conocimientos y habilidades.', 'cognitive', '{hippocampus,basal-ganglia,cerebellum,frontal-lobe}', '{learning,plasticity}'),
  ('walking', 'Walking', 'Ходьба', 'Caminar', 'Rhythmic locomotion driven by motor and balance systems.', 'Ритмичная локомоция через двигательную систему и баланс.', 'Locomocion ritmica por los sistemas motor y de equilibrio.', 'motor', '{frontal-lobe,basal-ganglia,cerebellum,spinal-cord,thalamus}', '{gait,locomotion,movement}'),
  ('running', 'Running', 'Бег', 'Correr', 'High-intensity locomotion with strong motor and cardiac demand.', 'Высокоинтенсивная локомоция с большой нагрузкой на моторику и сердце.', 'Locomocion de alta intensidad con gran demanda motora y cardiaca.', 'motor', '{frontal-lobe,basal-ganglia,cerebellum,spinal-cord,medulla}', '{running,locomotion,cardio}'),
  ('fine-motor', 'Fine motor control', 'Тонкая моторика', 'Motricidad fina', 'Precise coordinated movements of hands and fingers.', 'Точные согласованные движения кистей и пальцев.', 'Movimientos precisos de manos y dedos.', 'motor', '{frontal-lobe,cerebellum,basal-ganglia,thalamus}', '{dexterity,hands}'),
  ('tongue-motor', 'Tongue movement', 'Движение языка', 'Movimiento de la lengua', 'Motor control of the tongue for speech and swallowing.', 'Моторный контроль языка для речи и глотания.', 'Control motor de la lengua para el habla y la deglucion.', 'motor', '{frontal-lobe,medulla,pons}', '{tongue,speech,oral}'),
  ('eye-movement', 'Eye movement', 'Движение глаз', 'Movimiento ocular', 'Saccades and smooth pursuit that aim the gaze.', 'Саккады и плавное слежение, направляющие взгляд.', 'Sacadas y seguimiento suave que dirigen la mirada.', 'motor', '{frontal-lobe,midbrain,cerebellum,occipital-lobe}', '{gaze,saccade,oculomotor}'),
  ('balance', 'Balance', 'Равновесие', 'Equilibrio', 'Maintaining postural stability against gravity.', 'Поддержание устойчивости позы против силы тяжести.', 'Mantener la estabilidad postural frente a la gravedad.', 'motor', '{cerebellum,pons,thalamus}', '{balance,vestibular}'),
  ('posture', 'Posture', 'Осанка', 'Postura', 'Sustained muscle tone that holds body alignment.', 'Поддерживающий тонус мышц, удерживающий тело.', 'Tono muscular que mantiene la alineacion del cuerpo.', 'motor', '{cerebellum,spinal-cord,basal-ganglia}', '{posture,tone}'),
  ('swallowing', 'Swallowing', 'Глотание', 'Deglucion', 'Coordinated reflex moving food from mouth to stomach.', 'Координированный рефлекс, проводящий пищу в желудок.', 'Reflejo coordinado que lleva el alimento al estomago.', 'motor', '{medulla,pons}', '{swallow,deglutition}'),
  ('vision', 'Vision', 'Зрение', 'Vision', 'Processing light into perceived images.', 'Преобразование света в воспринимаемые образы.', 'Procesar la luz en imagenes percibidas.', 'sensory', '{occipital-lobe,thalamus}', '{sight,visual}'),
  ('hearing', 'Hearing', 'Слух', 'Audicion', 'Processing sound into perceived tones and speech.', 'Преобразование звука в тоны и речь.', 'Procesar el sonido en tonos y habla.', 'sensory', '{temporal-lobe,thalamus,midbrain}', '{auditory,sound}'),
  ('touch', 'Touch', 'Осязание', 'Tacto', 'Sensing pressure, texture and vibration on the skin.', 'Восприятие давления, текстуры и вибрации кожей.', 'Percepcion de presion, textura y vibracion en la piel.', 'sensory', '{parietal-lobe,thalamus,spinal-cord}', '{tactile,somatosensory}'),
  ('proprioception', 'Proprioception', 'Проприоцепция', 'Propiocepcion', 'Sensing the position and motion of the body.', 'Ощущение положения и движения тела.', 'Percepcion de la posicion y el movimiento del cuerpo.', 'sensory', '{cerebellum,parietal-lobe,spinal-cord}', '{body-sense,kinesthesia}'),
  ('smell', 'Smell', 'Обоняние', 'Olfato', 'Detecting and identifying airborne chemicals.', 'Обнаружение и распознавание запахов.', 'Deteccion e identificacion de olores.', 'sensory', '{temporal-lobe,frontal-lobe}', '{olfaction,smell}'),
  ('taste', 'Taste', 'Вкус', 'Gusto', 'Detecting sweet, salty, sour, bitter and umami.', 'Распознавание сладкого, солёного, кислого, горького и умами.', 'Deteccion de dulce, salado, acido, amargo y umami.', 'sensory', '{insula,thalamus}', '{gustation,taste}'),
  ('pain', 'Pain perception', 'Восприятие боли', 'Percepcion del dolor', 'Detecting and interpreting noxious stimuli.', 'Обнаружение и интерпретация повреждающих стимулов.', 'Deteccion e interpretacion de estimulos nocivos.', 'sensory', '{thalamus,insula,cingulate,spinal-cord}', '{pain,nociception}'),
  ('heart-rate', 'Heart rate control', 'Регуляция пульса', 'Control del ritmo cardiaco', 'Autonomic regulation of the heartbeat.', 'Вегетативная регуляция сердечного ритма.', 'Regulacion autonoma del latido cardiaco.', 'autonomic', '{medulla,hypothalamus,heart}', '{heart,autonomic,pulse}'),
  ('breathing', 'Breathing', 'Дыхание', 'Respiracion', 'Automatic rhythmic control of ventilation.', 'Автоматическая ритмичная регуляция дыхания.', 'Control ritmico automatico de la ventilacion.', 'autonomic', '{medulla,pons,lungs}', '{respiration,breath}'),
  ('blood-pressure', 'Blood pressure control', 'Регуляция давления', 'Control de la presion arterial', 'Autonomic regulation of vascular tone and pressure.', 'Вегетативная регуляция тонуса сосудов и давления.', 'Regulacion autonoma del tono vascular y la presion.', 'autonomic', '{medulla,hypothalamus,heart}', '{baroreflex,autonomic}'),
  ('digestion', 'Digestion', 'Пищеварение', 'Digestion', 'Autonomic control of gut motility and secretion.', 'Вегетативная регуляция моторики и секреции ЖКТ.', 'Control autonomo de la motilidad y secrecion intestinal.', 'autonomic', '{medulla,hypothalamus,liver}', '{gut,digestion,autonomic}'),
  ('sleep-wake', 'Sleep and wakefulness', 'Сон и бодрствование', 'Sueno y vigilia', 'Cycling between sleep and alert states.', 'Чередование сна и бодрствования.', 'Alternancia entre el sueno y la vigilia.', 'autonomic', '{hypothalamus,thalamus,pons,midbrain}', '{sleep,arousal,circadian}'),
  ('thermoregulation', 'Thermoregulation', 'Терморегуляция', 'Termorregulacion', 'Maintaining stable core body temperature.', 'Поддержание стабильной температуры тела.', 'Mantener una temperatura corporal estable.', 'autonomic', '{hypothalamus}', '{temperature,homeostasis}'),
  ('fear', 'Fear', 'Страх', 'Miedo', 'Rapid threat detection and defensive response.', 'Быстрое обнаружение угрозы и защитная реакция.', 'Deteccion rapida de amenazas y respuesta defensiva.', 'emotional', '{amygdala,hypothalamus,insula}', '{fear,threat,emotion}'),
  ('joy', 'Joy', 'Радость', 'Alegria', 'Positive affect linked to reward and approach.', 'Положительный аффект, связанный с вознаграждением.', 'Afecto positivo ligado a la recompensa.', 'emotional', '{basal-ganglia,frontal-lobe,midbrain}', '{joy,positive,emotion}'),
  ('empathy', 'Empathy', 'Эмпатия', 'Empatia', 'Sensing and sharing the emotional states of others.', 'Восприятие и разделение эмоций других.', 'Percibir y compartir los estados emocionales de otros.', 'emotional', '{insula,cingulate,frontal-lobe}', '{empathy,social,emotion}'),
  ('reward-processing', 'Reward processing', 'Обработка вознаграждения', 'Procesamiento de recompensa', 'Valuing outcomes and reinforcing behavior.', 'Оценка результатов и подкрепление поведения.', 'Valorar resultados y reforzar la conducta.', 'emotional', '{basal-ganglia,midbrain,frontal-lobe,hypothalamus}', '{reward,dopamine,motivation}'),
  ('stress-response', 'Stress response', 'Реакция на стресс', 'Respuesta al estres', 'Mobilizing the body under perceived demand.', 'Мобилизация организма при ощущаемой нагрузке.', 'Movilizacion del cuerpo ante la demanda percibida.', 'emotional', '{amygdala,hypothalamus,hippocampus}', '{stress,hpa,emotion}'),
  ('speech-production', 'Speech production', 'Производство речи', 'Produccion del habla', 'Planning and articulating spoken language.', 'Планирование и артикуляция устной речи.', 'Planificacion y articulacion del lenguaje hablado.', 'language', '{frontal-lobe,basal-ganglia,cerebellum}', '{speech,broca,language}'),
  ('language-comprehension', 'Language comprehension', 'Понимание речи', 'Comprension del lenguaje', 'Decoding meaning from spoken and written language.', 'Извлечение смысла из устной и письменной речи.', 'Decodificar el significado del lenguaje hablado y escrito.', 'language', '{temporal-lobe,parietal-lobe,frontal-lobe}', '{wernicke,language,comprehension}'),
  ('reading', 'Reading', 'Чтение', 'Lectura', 'Mapping written symbols to language and meaning.', 'Сопоставление письменных символов с языком и смыслом.', 'Asociar simbolos escritos con lenguaje y significado.', 'language', '{occipital-lobe,temporal-lobe,frontal-lobe}', '{reading,literacy,language}'),
  ('inhibition', 'Response inhibition', 'Торможение реакции', 'Inhibicion de respuesta', 'Suppressing inappropriate or automatic responses.', 'Подавление неуместных или автоматических реакций.', 'Suprimir respuestas inapropiadas o automaticas.', 'executive', '{frontal-lobe,basal-ganglia}', '{inhibition,control,executive}'),
  ('task-switching', 'Task switching', 'Переключение задач', 'Cambio de tarea', 'Shifting flexibly between goals and rules.', 'Гибкое переключение между целями и правилами.', 'Cambiar de forma flexible entre objetivos y reglas.', 'executive', '{frontal-lobe,parietal-lobe,basal-ganglia}', '{switching,flexibility,executive}'),
  ('cognitive-flexibility', 'Cognitive flexibility', 'Когнитивная гибкость', 'Flexibilidad cognitiva', 'Adapting thinking to changing demands.', 'Адаптация мышления к меняющимся условиям.', 'Adaptar el pensamiento a demandas cambiantes.', 'executive', '{frontal-lobe,cingulate,basal-ganglia}', '{flexibility,adaptation,executive}')
ON CONFLICT (slug) DO NOTHING;

-- ── link key functions to circuits (by slug, so it is robust to serial ids) ──
UPDATE anatomy_functions SET circuit_ids = ARRAY(SELECT id FROM anatomy_circuits WHERE slug = 'memory-hippocampal') WHERE slug IN ('memory-recall', 'learning') AND circuit_ids = '{}';
UPDATE anatomy_functions SET circuit_ids = ARRAY(SELECT id FROM anatomy_circuits WHERE slug = 'reward-dopaminergic') WHERE slug IN ('reward-processing', 'joy') AND circuit_ids = '{}';
UPDATE anatomy_functions SET circuit_ids = ARRAY(SELECT id FROM anatomy_circuits WHERE slug = 'executive-control') WHERE slug IN ('working-memory', 'planning', 'task-switching', 'inhibition') AND circuit_ids = '{}';
UPDATE anatomy_functions SET circuit_ids = ARRAY(SELECT id FROM anatomy_circuits WHERE slug = 'salience') WHERE slug IN ('attention', 'fear', 'empathy') AND circuit_ids = '{}';
UPDATE anatomy_functions SET circuit_ids = ARRAY(SELECT id FROM anatomy_circuits WHERE slug = 'motor') WHERE slug IN ('walking', 'running', 'fine-motor', 'posture', 'balance') AND circuit_ids = '{}';
UPDATE anatomy_functions SET circuit_ids = ARRAY(SELECT id FROM anatomy_circuits WHERE slug = 'default-mode') WHERE slug IN ('mental-imagery') AND circuit_ids = '{}';

-- ── register the Body Functions tool (gated, like anatomy-atlas) ─────────────
INSERT INTO tools (code, name_ru, name_en, name_es, description_ru, description_en, description_es, is_free_default, order_idx) VALUES
  ('anatomy-functions', 'Функции тела', 'Body Functions', 'Funciones del cuerpo', 'Какие регионы и контуры стоят за каждой функцией тела.', 'Which regions and circuits power each body function.', 'Que regiones y circuitos sostienen cada funcion del cuerpo.', FALSE, 8)
ON CONFLICT (code) DO NOTHING;
