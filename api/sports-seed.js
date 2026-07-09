// PR — Sports sub-section of the Functions tab (migration 055).
// Educational reference only — NOT medical / training advice. Grounded in
// general sports-medicine consensus (Mayo Clinic, NIH/NIAMS, AHA physical-
// activity guidance). Positive tissues = what the sport chiefly conditions /
// benefits; negative tissues = characteristic overuse / injury load.
//
// target_tissues_* use the SAME BodyAtlas seed-id vocabulary as medications
// (see MED_SEED / SPORT_SEED in account.html). Mesh-backed seeds
// (brain, heart, lungs, spinal_cord …) tint in 3D; system seeds
// (muscles, bones, joints, vessels, skin) render as coloured chips only.
//
// Field contract mirrors the `sports` table (migration 055):
//   slug, category, name_ru/en/es, description_ru/en/es,
//   target_tissues_positive[], target_tissues_negative[],
//   warning_ru/en/es, sort_order

'use strict';

const SPORTS = [
  /* ── Cardio / endurance ─────────────────────────────────────────────── */
  {
    slug: 'running', category: 'endurance', sort_order: 1,
    name_ru: 'Бег', name_en: 'Running', name_es: 'Correr',
    description_ru: 'Циклическая аэробная нагрузка. Развивает выносливость сердечно-сосудистой и дыхательной систем, укрепляет мышцы ног и — за счёт ударной нагрузки — плотность костей. Повышает выработку BDNF и эндорфинов, улучшает настроение и сон.',
    description_en: 'Cyclic aerobic exercise. Builds cardiovascular and respiratory endurance, strengthens leg muscles and — through impact loading — bone density. Raises BDNF and endorphin output, improving mood and sleep.',
    description_es: 'Ejercicio aeróbico cíclico. Desarrolla la resistencia cardiovascular y respiratoria, fortalece los músculos de las piernas y, por el impacto, la densidad ósea. Aumenta el BDNF y las endorfinas, mejorando el ánimo y el sueño.',
    target_tissues_positive: ['heart', 'lungs', 'vessels', 'muscles', 'bones'],
    target_tissues_negative: ['joints'],
    warning_ru: 'Ударная нагрузка на колени, голеностоп и стопы. Наращивайте объём постепенно (правило +10%/нед), нужна амортизирующая обувь и разминка.',
    warning_en: 'Impact loads the knees, ankles and feet. Increase volume gradually (~10%/week rule); cushioned shoes and a warm-up are essential.',
    warning_es: 'El impacto carga rodillas, tobillos y pies. Aumente el volumen de forma gradual (~10%/semana); calzado amortiguado y calentamiento son esenciales.'
  },
  {
    slug: 'walking', category: 'endurance', sort_order: 2,
    name_ru: 'Ходьба', name_en: 'Walking', name_es: 'Caminar',
    description_ru: 'Низкоударная аэробная активность, доступная почти всем. Улучшает работу сердца и сосудов, контроль сахара и веса, настроение; бережна к суставам. Быстрая ходьба даёт умеренную кардионагрузку.',
    description_en: 'Low-impact aerobic activity accessible to almost everyone. Improves heart and vessel health, glucose and weight control and mood while sparing the joints. Brisk walking delivers moderate cardio load.',
    description_es: 'Actividad aeróbica de bajo impacto accesible para casi todos. Mejora el corazón y los vasos, el control de la glucosa y del peso y el ánimo, cuidando las articulaciones.',
    target_tissues_positive: ['heart', 'vessels', 'brain', 'bones', 'joints'],
    target_tissues_negative: [],
    warning_ru: 'Практически без противопоказаний. При боли в стопах — удобная обувь и ортопедические стельки.',
    warning_en: 'Very few contraindications. For foot pain use comfortable shoes and orthotic insoles.',
    warning_es: 'Muy pocas contraindicaciones. Para el dolor de pies use calzado cómodo y plantillas ortopédicas.'
  },
  {
    slug: 'swimming', category: 'endurance', sort_order: 3,
    name_ru: 'Плавание', name_en: 'Swimming', name_es: 'Natación',
    description_ru: 'Аэробная нагрузка всего тела без ударов по суставам. Развивает сердце и лёгкие, мышцы спины, плечевого пояса и кора, увеличивает подвижность суставов. Идеально при лишнем весе и болях в спине.',
    description_en: 'Whole-body aerobic exercise with no joint impact. Develops the heart and lungs, back, shoulder-girdle and core muscles and joint mobility. Ideal for excess weight and back pain.',
    description_es: 'Ejercicio aeróbico de todo el cuerpo sin impacto articular. Desarrolla corazón y pulmones, músculos de espalda, hombros y core, y la movilidad articular.',
    target_tissues_positive: ['heart', 'lungs', 'muscles', 'joints', 'vessels'],
    target_tissues_negative: ['skin'],
    warning_ru: 'Плечо пловца при перегрузке кроля. Хлорированная вода сушит кожу и волосы; не плавать в одиночку.',
    warning_en: 'Swimmer’s shoulder from freestyle overuse. Chlorinated water dries skin and hair; never swim alone.',
    warning_es: 'Hombro del nadador por sobreuso del crol. El agua clorada reseca la piel y el cabello; nunca nade solo.'
  },
  {
    slug: 'cycling', category: 'endurance', sort_order: 4,
    name_ru: 'Велоспорт', name_en: 'Cycling', name_es: 'Ciclismo',
    description_ru: 'Аэробная нагрузка с низким ударным воздействием на суставы. Мощно развивает сердце, лёгкие и мышцы ног, помогает контролировать вес. Подходит для реабилитации коленей.',
    description_en: 'Aerobic exercise with low joint impact. Powerfully develops the heart, lungs and leg muscles and aids weight control. Suitable for knee rehabilitation.',
    description_es: 'Ejercicio aeróbico de bajo impacto articular. Desarrolla con fuerza el corazón, los pulmones y los músculos de las piernas y ayuda al control del peso.',
    target_tissues_positive: ['heart', 'lungs', 'muscles', 'vessels'],
    target_tissues_negative: ['spinal_cord'],
    warning_ru: 'Наклонная посадка нагружает поясницу и шею; онемение кистей и промежности при неверной подгонке. Обязателен шлем.',
    warning_en: 'The forward posture loads the lower back and neck; hand and perineal numbness with poor bike fit. A helmet is mandatory.',
    warning_es: 'La postura inclinada carga la zona lumbar y el cuello; entumecimiento de manos y periné con mal ajuste. El casco es obligatorio.'
  },
  {
    slug: 'rowing', category: 'endurance', sort_order: 5,
    name_ru: 'Гребля', name_en: 'Rowing', name_es: 'Remo',
    description_ru: 'Аэробно-силовая нагрузка, задействующая ~85% мышц. Развивает сердце, лёгкие, мышцы спины, ног и кора одновременно, с низким ударным воздействием.',
    description_en: 'Combined aerobic-strength effort using ~85% of the body’s muscles. Simultaneously develops the heart, lungs, back, legs and core with low impact.',
    description_es: 'Esfuerzo aeróbico y de fuerza que emplea ~85% de los músculos. Desarrolla a la vez corazón, pulmones, espalda, piernas y core con bajo impacto.',
    target_tissues_positive: ['heart', 'lungs', 'muscles', 'vessels', 'bones'],
    target_tissues_negative: ['spinal_cord'],
    warning_ru: 'Круглая спина под нагрузкой травмирует поясницу. Техника «ноги → корпус → руки» и жёсткий поясничный контроль обязательны.',
    warning_en: 'A rounded back under load injures the lumbar spine. The “legs → body → arms” sequence and firm lumbar control are essential.',
    warning_es: 'Una espalda redondeada bajo carga lesiona la zona lumbar. La secuencia “piernas → tronco → brazos” y el control lumbar son esenciales.'
  },

  /* ── Team / ball sports ─────────────────────────────────────────────── */
  {
    slug: 'tennis', category: 'team_ball', sort_order: 10,
    name_ru: 'Теннис', name_en: 'Tennis', name_es: 'Tenis',
    description_ru: 'Интервальная нагрузка со спринтами, сменой направлений и ударами. Развивает сердце, мышцы, координацию и — за счёт нагрузки — плотность костей; тренирует реакцию и концентрацию.',
    description_en: 'Interval exercise with sprints, direction changes and strokes. Builds the heart, muscles, coordination and — through loading — bone density; trains reaction and focus.',
    description_es: 'Ejercicio interválico con esprints, cambios de dirección y golpes. Desarrolla el corazón, los músculos, la coordinación y la densidad ósea; entrena la reacción.',
    target_tissues_positive: ['heart', 'muscles', 'bones', 'vessels', 'brain'],
    target_tissues_negative: ['joints'],
    warning_ru: '«Локоть теннисиста», травмы плеча, колена и голеностопа при рывках. Нужна разминка и грамотная техника удара.',
    warning_en: 'Tennis elbow, shoulder, knee and ankle injuries from cutting movements. Warm-up and sound stroke technique are needed.',
    warning_es: 'Codo de tenista y lesiones de hombro, rodilla y tobillo por los cambios bruscos. Calentamiento y buena técnica son necesarios.'
  },
  {
    slug: 'basketball', category: 'team_ball', sort_order: 11,
    name_ru: 'Баскетбол', name_en: 'Basketball', name_es: 'Baloncesto',
    description_ru: 'Высокоинтенсивная командная игра с прыжками, спринтами и остановками. Развивает сердце, лёгкие, мышцы ног, координацию и плотность костей.',
    description_en: 'High-intensity team game with jumps, sprints and stops. Develops the heart, lungs, leg muscles, coordination and bone density.',
    description_es: 'Juego de equipo de alta intensidad con saltos, esprints y frenadas. Desarrolla corazón, pulmones, músculos de las piernas, coordinación y densidad ósea.',
    target_tissues_positive: ['heart', 'lungs', 'muscles', 'bones', 'vessels'],
    target_tissues_negative: ['joints'],
    warning_ru: 'Высокий риск травм голеностопа и разрыва ПКС при приземлениях и разворотах. Нужны фиксирующая обувь и укрепление коленей.',
    warning_en: 'High risk of ankle sprains and ACL tears on landings and pivots. Supportive shoes and knee strengthening help.',
    warning_es: 'Alto riesgo de esguinces de tobillo y roturas del LCA en aterrizajes y giros. Ayudan calzado de sujeción y fortalecer las rodillas.'
  },
  {
    slug: 'football', category: 'team_ball', sort_order: 12,
    name_ru: 'Футбол', name_en: 'Football (soccer)', name_es: 'Fútbol',
    description_ru: 'Командная игра на выносливость с постоянными спринтами. Отлично развивает сердце, лёгкие, мышцы ног и плотность костей, тренирует координацию и командное мышление.',
    description_en: 'Endurance team game with constant sprints. Excellently develops the heart, lungs, leg muscles and bone density; trains coordination and team thinking.',
    description_es: 'Juego de equipo de resistencia con esprints constantes. Desarrolla el corazón, los pulmones, los músculos de las piernas y la densidad ósea.',
    target_tissues_positive: ['heart', 'lungs', 'muscles', 'bones', 'vessels'],
    target_tissues_negative: ['joints', 'brain'],
    warning_ru: 'Разрывы ПКС и мениска, травмы голеностопа; сотрясения и микротравмы мозга при ударах головой. Ограничивайте игру головой у подростков.',
    warning_en: 'ACL and meniscus tears, ankle injuries; concussion and sub-concussive brain load from heading. Limit heading in youth.',
    warning_es: 'Roturas de LCA y menisco, lesiones de tobillo; conmociones y carga cerebral por cabecear. Limite el cabeceo en jóvenes.'
  },

  /* ── Combat / strength ──────────────────────────────────────────────── */
  {
    slug: 'boxing', category: 'combat', sort_order: 20,
    name_ru: 'Бокс', name_en: 'Boxing', name_es: 'Boxeo',
    description_ru: 'Интервальная нагрузка высокой интенсивности. Развивает сердце, лёгкие, мышцы плечевого пояса и кора, скорость реакции и координацию. Мощно снимает стресс.',
    description_en: 'High-intensity interval training. Builds the heart, lungs, shoulder-girdle and core muscles, reaction speed and coordination. A powerful stress outlet.',
    description_es: 'Entrenamiento interválico de alta intensidad. Desarrolla corazón, pulmones, músculos de hombros y core, velocidad de reacción y coordinación.',
    target_tissues_positive: ['heart', 'lungs', 'muscles', 'vessels'],
    target_tissues_negative: ['brain', 'skin', 'bones'],
    warning_ru: 'Спарринг несёт риск сотрясений и хронической травматической энцефалопатии (ХТЭ), переломов кисти и носа, рассечений. Защитный шлем и капа обязательны; удары в голову — по показаниям.',
    warning_en: 'Sparring carries a risk of concussion and chronic traumatic encephalopathy (CTE), hand and nose fractures and cuts. Headgear and a mouthguard are essential; limit head contact.',
    warning_es: 'El sparring conlleva riesgo de conmoción y encefalopatía traumática crónica (ETC), fracturas de mano y nariz y cortes. Casco y protector bucal son esenciales.'
  },
  {
    slug: 'wrestling', category: 'combat', sort_order: 21,
    name_ru: 'Борьба', name_en: 'Wrestling', name_es: 'Lucha',
    description_ru: 'Силовое единоборство всего тела. Развивает мышцы, силовую выносливость, плотность костей и сердечно-сосудистую систему, тренирует баланс и волю.',
    description_en: 'Whole-body strength combat sport. Builds muscle, strength-endurance, bone density and the cardiovascular system; trains balance and grit.',
    description_es: 'Deporte de combate de fuerza de todo el cuerpo. Desarrolla músculo, resistencia a la fuerza, densidad ósea y el sistema cardiovascular.',
    target_tissues_positive: ['muscles', 'heart', 'bones', 'vessels'],
    target_tissues_negative: ['joints', 'skin', 'spinal_cord'],
    warning_ru: 'Вывихи и травмы плеча, колена, шеи; кожные инфекции (герпес, стригущий лишай), «ухо борца». Резкий сгон веса опасен.',
    warning_en: 'Shoulder, knee and neck injuries and dislocations; skin infections (herpes, ringworm), cauliflower ear. Rapid weight cutting is dangerous.',
    warning_es: 'Luxaciones y lesiones de hombro, rodilla y cuello; infecciones cutáneas, oreja de coliflor. El corte rápido de peso es peligroso.'
  },
  {
    slug: 'martial-arts', category: 'combat', sort_order: 22,
    name_ru: 'Боевые искусства', name_en: 'Martial arts', name_es: 'Artes marciales',
    description_ru: 'Каратэ, дзюдо, тхэквондо, ММА и др. Развивают сердце, мышцы, гибкость, координацию, плотность костей, дисциплину и концентрацию.',
    description_en: 'Karate, judo, taekwondo, MMA and others. Develop the heart, muscles, flexibility, coordination, bone density, discipline and focus.',
    description_es: 'Kárate, judo, taekwondo, MMA y otros. Desarrollan corazón, músculos, flexibilidad, coordinación, densidad ósea, disciplina y concentración.',
    target_tissues_positive: ['heart', 'muscles', 'bones', 'vessels'],
    target_tissues_negative: ['joints', 'brain'],
    warning_ru: 'Контактные стили несут риск сотрясений, вывихов и переломов. Спарринг в защите, под контролем тренера, с постепенным ростом контакта.',
    warning_en: 'Contact styles risk concussion, dislocations and fractures. Spar with protective gear under a coach, escalating contact gradually.',
    warning_es: 'Los estilos de contacto arriesgan conmociones, luxaciones y fracturas. Haga sparring con protección y bajo supervisión.'
  },
  {
    slug: 'weightlifting', category: 'strength', sort_order: 23,
    name_ru: 'Тяжёлая атлетика', name_en: 'Weightlifting', name_es: 'Levantamiento de pesas',
    description_ru: 'Силовая тренировка с отягощениями. Наращивает мышечную массу и силу, повышает плотность костей и чувствительность к инсулину, укрепляет связки и сухожилия.',
    description_en: 'Resistance strength training. Builds muscle mass and strength, raises bone density and insulin sensitivity, strengthens ligaments and tendons.',
    description_es: 'Entrenamiento de fuerza con cargas. Aumenta la masa y la fuerza muscular, la densidad ósea y la sensibilidad a la insulina.',
    target_tissues_positive: ['muscles', 'bones', 'vessels'],
    target_tissues_negative: ['joints', 'spinal_cord'],
    warning_ru: 'Травмы поясницы, плеч и коленей при плохой технике или чрезмерном весе. Освойте технику с малым весом; натуживание опасно при гипертонии.',
    warning_en: 'Lower-back, shoulder and knee injuries from poor form or excess load. Master technique light first; the Valsalva strain is risky in hypertension.',
    warning_es: 'Lesiones lumbares, de hombro y rodilla por mala técnica o exceso de carga. Domine la técnica con poco peso primero.'
  },

  /* ── Mind-body / mobility ───────────────────────────────────────────── */
  {
    slug: 'yoga', category: 'mind_body', sort_order: 30,
    name_ru: 'Йога', name_en: 'Yoga', name_es: 'Yoga',
    description_ru: 'Сочетание поз, растяжки и дыхания. Развивает гибкость, силу и баланс мышц, подвижность позвоночника; дыхательные практики снижают стресс и активируют парасимпатику.',
    description_en: 'Combines postures, stretching and breathing. Develops flexibility, muscular strength and balance and spinal mobility; breath work lowers stress and engages the parasympathetic system.',
    description_es: 'Combina posturas, estiramientos y respiración. Desarrolla flexibilidad, fuerza y equilibrio muscular y movilidad de la columna; reduce el estrés.',
    target_tissues_positive: ['muscles', 'joints', 'spinal_cord', 'brain', 'lungs'],
    target_tissues_negative: [],
    warning_ru: 'Форсированные прогибы и стойки на голове/плечах опасны для шеи и поясницы. Входите в асаны без боли, избегайте гиперрастяжения суставов.',
    warning_en: 'Forced backbends and head/shoulder stands risk the neck and lower back. Enter poses without pain; avoid over-stretching joints.',
    warning_es: 'Las flexiones forzadas y las posturas invertidas arriesgan cuello y zona lumbar. Entre en las posturas sin dolor.'
  },
  {
    slug: 'pilates', category: 'mind_body', sort_order: 31,
    name_ru: 'Пилатес', name_en: 'Pilates', name_es: 'Pilates',
    description_ru: 'Контролируемые упражнения на кор, осанку и стабилизацию. Укрепляет глубокие мышцы живота и спины, улучшает осанку и подвижность позвоночника, снижает боли в пояснице.',
    description_en: 'Controlled core, posture and stabilisation exercise. Strengthens the deep abdominal and back muscles, improves posture and spinal mobility and eases lower-back pain.',
    description_es: 'Ejercicio controlado de core, postura y estabilización. Fortalece los músculos profundos del abdomen y la espalda y mejora la postura.',
    target_tissues_positive: ['muscles', 'spinal_cord', 'joints'],
    target_tissues_negative: [],
    warning_ru: 'Как правило безопасен. При грыжах диска и остеопорозе избегайте глубокого сгибания позвоночника — консультация со специалистом.',
    warning_en: 'Generally safe. With disc herniation or osteoporosis avoid deep spinal flexion — consult a specialist.',
    warning_es: 'Generalmente seguro. Con hernias de disco u osteoporosis evite la flexión profunda de la columna — consulte a un especialista.'
  },
  {
    slug: 'dance', category: 'mind_body', sort_order: 32,
    name_ru: 'Танцы', name_en: 'Dance', name_es: 'Baile',
    description_ru: 'Ритмичная аэробная нагрузка. Развивает сердце, мышцы, координацию, баланс и плотность костей; заучивание связок тренирует мозг и память, поднимает настроение.',
    description_en: 'Rhythmic aerobic activity. Develops the heart, muscles, coordination, balance and bone density; learning routines trains the brain and memory and lifts mood.',
    description_es: 'Actividad aeróbica rítmica. Desarrolla el corazón, los músculos, la coordinación, el equilibrio y la densidad ósea; entrena el cerebro y el ánimo.',
    target_tissues_positive: ['heart', 'muscles', 'bones', 'brain', 'vessels'],
    target_tissues_negative: ['joints'],
    warning_ru: 'Травмы голеностопа, колена и стопы, особенно в танцах на пуантах. Нужна подходящая обувь, покрытие и разминка.',
    warning_en: 'Ankle, knee and foot injuries, especially in pointe dance. Proper footwear, flooring and a warm-up are needed.',
    warning_es: 'Lesiones de tobillo, rodilla y pie, sobre todo en danza de puntas. Se necesitan calzado, suelo adecuado y calentamiento.'
  },

  /* ── Cognitive ──────────────────────────────────────────────────────── */
  {
    slug: 'chess', category: 'cognitive', sort_order: 40,
    name_ru: 'Шахматы', name_en: 'Chess', name_es: 'Ajedrez',
    description_ru: 'Интеллектуальный вид спорта. Тренирует память, внимание, расчёт вариантов, стратегическое мышление и эмоциональную саморегуляцию под давлением времени. Замедляет когнитивное старение.',
    description_en: 'A cognitive sport. Trains memory, attention, calculation, strategic thinking and emotional self-regulation under time pressure. Slows cognitive ageing.',
    description_es: 'Un deporte cognitivo. Entrena la memoria, la atención, el cálculo, el pensamiento estratégico y la autorregulación emocional bajo presión de tiempo.',
    target_tissues_positive: ['brain'],
    target_tissues_negative: ['spinal_cord', 'vessels'],
    warning_ru: 'Сидячий вид спорта: многочасовые партии вредят осанке и кровообращению. Делайте перерывы, разминайте спину, поддерживайте общую физическую активность.',
    warning_en: 'A sedentary sport: multi-hour games harm posture and circulation. Take breaks, mobilise the back and keep up general physical activity.',
    warning_es: 'Un deporte sedentario: las partidas de varias horas dañan la postura y la circulación. Tome descansos y mantenga actividad física general.'
  }
];

// Map a sport slug → catalog diagnosis / human_condition slugs it commonly
// benefits (therapeutic recommendation). Keyed by diagnosis slug like
// DIAG_LINKS in medications-seed. TEXT slug join, no FK, unknown slugs harmless.
const SPORT_DIAG_LINKS = {
  // populated conservatively; sports↔condition benefit links are advisory only
  'depression': [ { slug: 'running', is_primary: true }, { slug: 'walking' }, { slug: 'swimming' }, { slug: 'yoga' } ],
  'anxiety':    [ { slug: 'yoga', is_primary: true }, { slug: 'swimming' }, { slug: 'walking' }, { slug: 'boxing' } ],
  'type-2-diabetes': [ { slug: 'walking', is_primary: true }, { slug: 'running' }, { slug: 'cycling' }, { slug: 'weightlifting' } ],
  'hypertension':    [ { slug: 'walking', is_primary: true }, { slug: 'swimming' }, { slug: 'cycling' } ],
  'osteoporosis':    [ { slug: 'weightlifting', is_primary: true }, { slug: 'running' }, { slug: 'dance' } ]
};

module.exports = { SPORTS, SPORT_DIAG_LINKS };
