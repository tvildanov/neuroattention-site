// PR#116 — Medications & Substances seed data (migration 045).
// Educational reference only — NOT medical advice. Sources: PubChem, DrugBank,
// FDA prescribing information, RLS (Регистр лекарственных средств России) for RU
// market brand names. target_organs_* use BodyAtlas seed-ids (see ORGAN_SEED map
// in account.html medications controller). Positive = therapeutic target tissues,
// negative = side-effect / damage tissues.
//
// Field contract mirrors the `medications` table (migration 045):
//   slug, kind, category, name_ru/en/es, brand_ru[], brand_us[],
//   effect_positive_ru/en/es, effect_negative_ru/en/es,
//   target_organs_positive[], target_organs_negative[],
//   warning_ru/en/es, sort_order
//
// DIAG_LINKS maps a diagnosis slug (from anatomy_conditions / PR#115 additions)
// to medication slugs. Keyed by TEXT slug, no FK, so unknown slugs are harmless.

'use strict';

const MEDICATIONS = [
  /* ── Глюкокортикоиды ───────────────────────────────────────────────── */
  {
    slug: 'prednisolone', kind: 'medication', category: 'glucocorticoid', sort_order: 1,
    name_ru: 'Преднизолон', name_en: 'Prednisone', name_es: 'Prednisona',
    brand_ru: ['Преднизолон Никомед', 'Медопред'], brand_us: ['Deltasone', 'Rayos'],
    effect_positive_ru: 'Системный противовоспалительный и иммуносупрессивный эффект. Снижает активность T-клеток и выработку цитокинов, подавляет воспаление при ревматических, аутоиммунных и аллергических заболеваниях; уменьшает отёк и бронхоспазм.',
    effect_positive_en: 'Systemic anti-inflammatory and immunosuppressive. Suppresses T-cell activity and cytokine production, dampening inflammation in rheumatic, autoimmune and allergic disease; reduces oedema and bronchospasm.',
    effect_positive_es: 'Antiinflamatorio sistémico e inmunosupresor. Suprime la actividad de los linfocitos T y la producción de citocinas, reduciendo la inflamación en enfermedades reumáticas, autoinmunes y alérgicas.',
    effect_negative_ru: 'ЖКТ: язвы, гастрит. Эндокринная система: подавление надпочечников, набор веса, гипергликемия. Опорно-двигательный аппарат: остеопороз, атрофия мышц. Психика: бессонница, тревога, мания.',
    effect_negative_en: 'GI: ulcers, gastritis. Endocrine: adrenal suppression, weight gain, hyperglycaemia. Musculoskeletal: osteoporosis, muscle wasting. Psychiatric: insomnia, anxiety, mania.',
    effect_negative_es: 'GI: úlceras, gastritis. Endocrino: supresión suprarrenal, aumento de peso, hiperglucemia. Musculoesquelético: osteoporosis, atrofia muscular. Psiquiátrico: insomnio, ansiedad, manía.',
    target_organs_positive: ['joints', 'lungs', 'vessels', 'skin'],
    target_organs_negative: ['stomach', 'adrenals', 'bones', 'muscles', 'pancreas'],
    warning_ru: 'Нельзя резко отменять — риск надпочечниковой недостаточности. Длительный приём требует контроля костей, глюкозы и АД.',
    warning_en: 'Never stop abruptly — risk of adrenal crisis. Long-term use needs bone, glucose and blood-pressure monitoring.',
    warning_es: 'Nunca suspender bruscamente — riesgo de crisis suprarrenal. El uso prolongado requiere control óseo, glucémico y de presión arterial.'
  },
  {
    slug: 'dexamethasone', kind: 'medication', category: 'glucocorticoid', sort_order: 2,
    name_ru: 'Дексаметазон', name_en: 'Dexamethasone', name_es: 'Dexametasona',
    brand_ru: ['Дексаметазон', 'Дексазон'], brand_us: ['Decadron', 'DexPak'],
    effect_positive_ru: 'Мощный длительно действующий глюкокортикоид. Сильно подавляет воспаление и иммунный ответ, снижает отёк мозга, применяется при тяжёлых воспалительных и онкологических состояниях.',
    effect_positive_en: 'Potent long-acting glucocorticoid. Strongly suppresses inflammation and immune response, reduces cerebral oedema; used in severe inflammatory and oncologic settings.',
    effect_positive_es: 'Glucocorticoide potente de acción prolongada. Suprime fuertemente la inflamación y la respuesta inmune, reduce el edema cerebral.',
    effect_negative_ru: 'ЖКТ: язвы. Эндокринная: выраженное подавление надпочечников, гипергликемия. Кости: остеопороз. Психика: возбуждение, психоз. Иммунитет: повышенный риск инфекций.',
    effect_negative_en: 'GI: ulcers. Endocrine: marked adrenal suppression, hyperglycaemia. Bone: osteoporosis. Psychiatric: agitation, psychosis. Immune: raised infection risk.',
    effect_negative_es: 'GI: úlceras. Endocrino: supresión suprarrenal marcada, hiperglucemia. Hueso: osteoporosis. Psiquiátrico: agitación, psicosis. Inmune: mayor riesgo de infección.',
    target_organs_positive: ['brain', 'lungs', 'joints', 'vessels'],
    target_organs_negative: ['stomach', 'adrenals', 'bones', 'pancreas', 'muscles'],
    warning_ru: 'Очень высокая глюкокортикоидная активность — даже короткие курсы дают системные эффекты. Не отменять резко.',
    warning_en: 'Very high glucocorticoid potency — even short courses have systemic effects. Do not stop abruptly.',
    warning_es: 'Potencia glucocorticoide muy alta — incluso ciclos cortos tienen efectos sistémicos. No suspender bruscamente.'
  },
  {
    slug: 'methylprednisolone', kind: 'medication', category: 'glucocorticoid', sort_order: 3,
    name_ru: 'Метилпреднизолон', name_en: 'Methylprednisolone', name_es: 'Metilprednisolona',
    brand_ru: ['Метипред', 'Солу-Медрол'], brand_us: ['Medrol', 'Solu-Medrol'],
    effect_positive_ru: 'Глюкокортикоид средней длительности. Используется пульс-терапией при тяжёлых обострениях аутоиммунных болезней, рассеянного склероза, отторжения трансплантата.',
    effect_positive_en: 'Intermediate-acting glucocorticoid. Used as pulse therapy in severe autoimmune flares, multiple sclerosis relapses and transplant rejection.',
    effect_positive_es: 'Glucocorticoide de acción intermedia. Se usa en pulsos para brotes autoinmunes graves, recaídas de esclerosis múltiple y rechazo de trasplante.',
    effect_negative_ru: 'ЖКТ: язвы, гастрит. Кости: остеопороз, аваскулярный некроз. Эндокринная: гипергликемия, подавление надпочечников. Мышцы: стероидная миопатия.',
    effect_negative_en: 'GI: ulcers, gastritis. Bone: osteoporosis, avascular necrosis. Endocrine: hyperglycaemia, adrenal suppression. Muscle: steroid myopathy.',
    effect_negative_es: 'GI: úlceras, gastritis. Hueso: osteoporosis, necrosis avascular. Endocrino: hiperglucemia, supresión suprarrenal. Músculo: miopatía esteroidea.',
    target_organs_positive: ['nervous', 'joints', 'lungs', 'vessels'],
    target_organs_negative: ['stomach', 'bones', 'adrenals', 'muscles', 'pancreas'],
    warning_ru: 'Высокие дозы пульс-терапии требуют стационарного контроля. Не отменять резко.',
    warning_en: 'High-dose pulse therapy needs inpatient monitoring. Do not stop abruptly.',
    warning_es: 'La terapia en pulsos a dosis altas requiere control hospitalario. No suspender bruscamente.'
  },

  /* ── Иммуносупрессанты ─────────────────────────────────────────────── */
  {
    slug: 'methotrexate', kind: 'medication', category: 'immunosuppressant', sort_order: 10,
    name_ru: 'Метотрексат', name_en: 'Methotrexate', name_es: 'Metotrexato',
    brand_ru: ['Метотрексат-Эбеве', 'Методжект'], brand_us: ['Trexall', 'Otrexup', 'Rasuvo'],
    effect_positive_ru: 'Антиметаболит, ингибитор дигидрофолатредуктазы. В низких дозах — базисный препарат при ревматоидном артрите, псориазе; подавляет пролиферацию иммунных клеток и воспаление суставов.',
    effect_positive_en: 'Antimetabolite, dihydrofolate-reductase inhibitor. At low dose a first-line DMARD for rheumatoid arthritis and psoriasis; suppresses immune-cell proliferation and joint inflammation.',
    effect_positive_es: 'Antimetabolito, inhibidor de la dihidrofolato reductasa. A dosis bajas es un FARME de primera línea en artritis reumatoide y psoriasis.',
    effect_negative_ru: 'Печень: гепатотоксичность, фиброз. ЖКТ: стоматит, тошнота. Костный мозг: миелосупрессия. Лёгкие: пневмонит. Требует приёма фолиевой кислоты.',
    effect_negative_en: 'Liver: hepatotoxicity, fibrosis. GI: stomatitis, nausea. Bone marrow: myelosuppression. Lungs: pneumonitis. Requires folic-acid supplementation.',
    effect_negative_es: 'Hígado: hepatotoxicidad, fibrosis. GI: estomatitis, náuseas. Médula ósea: mielosupresión. Pulmones: neumonitis. Requiere ácido fólico.',
    target_organs_positive: ['joints', 'skin'],
    target_organs_negative: ['liver', 'stomach', 'bones', 'lungs'],
    warning_ru: 'Принимается РАЗ В НЕДЕЛЮ, не ежедневно — ошибка дозирования смертельна. Противопоказан при беременности (тератоген).',
    warning_en: 'Taken ONCE WEEKLY, not daily — a dosing error is fatal. Contraindicated in pregnancy (teratogen).',
    warning_es: 'Se toma UNA VEZ POR SEMANA, no a diario — un error de dosis es mortal. Contraindicado en el embarazo (teratógeno).'
  },
  {
    slug: 'cyclophosphamide', kind: 'medication', category: 'immunosuppressant', sort_order: 11,
    name_ru: 'Циклофосфамид', name_en: 'Cyclophosphamide', name_es: 'Ciclofosfamida',
    brand_ru: ['Циклофосфан', 'Эндоксан'], brand_us: ['Cytoxan'],
    effect_positive_ru: 'Алкилирующий цитостатик. Мощно подавляет иммунитет и опухолевый рост; применяется при тяжёлых васкулитах (гранулематоз с полиангиитом), волчаночном нефрите, лимфомах.',
    effect_positive_en: 'Alkylating cytostatic. Powerfully suppresses immunity and tumour growth; used in severe vasculitis (granulomatosis with polyangiitis), lupus nephritis, lymphomas.',
    effect_positive_es: 'Citostático alquilante. Suprime potentemente la inmunidad y el crecimiento tumoral; se usa en vasculitis grave, nefritis lúpica y linfomas.',
    effect_negative_ru: 'Мочевой пузырь: геморрагический цистит. Костный мозг: тяжёлая миелосупрессия. Гонады: бесплодие. Повышенный риск инфекций и вторичных опухолей.',
    effect_negative_en: 'Bladder: haemorrhagic cystitis. Bone marrow: severe myelosuppression. Gonads: infertility. Raised risk of infection and secondary malignancy.',
    effect_negative_es: 'Vejiga: cistitis hemorrágica. Médula ósea: mielosupresión grave. Gónadas: infertilidad. Mayor riesgo de infección y tumores secundarios.',
    target_organs_positive: ['kidneys', 'lungs', 'vessels'],
    target_organs_negative: ['bones', 'kidneys', 'skin'],
    warning_ru: 'Требует гидратации и месны для защиты мочевого пузыря. Гонадотоксичен — обсудить криоконсервацию.',
    warning_en: 'Requires hydration and mesna to protect the bladder. Gonadotoxic — discuss fertility preservation.',
    warning_es: 'Requiere hidratación y mesna para proteger la vejiga. Gonadotóxico — considerar preservación de la fertilidad.'
  },
  {
    slug: 'azathioprine', kind: 'medication', category: 'immunosuppressant', sort_order: 12,
    name_ru: 'Азатиоприн', name_en: 'Azathioprine', name_es: 'Azatioprina',
    brand_ru: ['Азатиоприн', 'Имуран'], brand_us: ['Imuran', 'Azasan'],
    effect_positive_ru: 'Пуриновый антиметаболит. Поддерживающая иммуносупрессия при аутоиммунных болезнях, ВЗК, после трансплантации; позволяет снизить дозу стероидов.',
    effect_positive_en: 'Purine antimetabolite. Maintenance immunosuppression in autoimmune disease, IBD and post-transplant; spares steroid dose.',
    effect_positive_es: 'Antimetabolito purínico. Inmunosupresión de mantenimiento en enfermedades autoinmunes, EII y postrasplante.',
    effect_negative_ru: 'Костный мозг: лейкопения. Печень: гепатотоксичность. ЖКТ: тошнота, панкреатит. Повышенный риск инфекций и лимфомы.',
    effect_negative_en: 'Bone marrow: leukopenia. Liver: hepatotoxicity. GI: nausea, pancreatitis. Raised infection and lymphoma risk.',
    effect_negative_es: 'Médula ósea: leucopenia. Hígado: hepatotoxicidad. GI: náuseas, pancreatitis. Mayor riesgo de infección y linfoma.',
    target_organs_positive: ['colon', 'joints', 'kidneys'],
    target_organs_negative: ['bones', 'liver', 'pancreas'],
    warning_ru: 'Перед стартом проверить активность TPMT — дефицит даёт тяжёлую миелосупрессию. Нельзя с аллопуринолом без снижения дозы.',
    warning_en: 'Check TPMT activity before starting — deficiency causes severe myelosuppression. Do not combine with allopurinol without dose reduction.',
    warning_es: 'Comprobar la actividad TPMT antes de iniciar — su déficit causa mielosupresión grave.'
  },
  {
    slug: 'mycophenolate', kind: 'medication', category: 'immunosuppressant', sort_order: 13,
    name_ru: 'Микофенолата мофетил', name_en: 'Mycophenolate mofetil', name_es: 'Micofenolato de mofetilo',
    brand_ru: ['Селлсепт', 'Майфортик'], brand_us: ['CellCept', 'Myfortic'],
    effect_positive_ru: 'Ингибитор инозинмонофосфатдегидрогеназы; избирательно подавляет пролиферацию лимфоцитов. Применяется при волчаночном нефрите, васкулитах, после трансплантации.',
    effect_positive_en: 'Inosine-monophosphate-dehydrogenase inhibitor; selectively suppresses lymphocyte proliferation. Used in lupus nephritis, vasculitis and post-transplant.',
    effect_positive_es: 'Inhibidor de la inosina-monofosfato deshidrogenasa; suprime selectivamente la proliferación de linfocitos.',
    effect_negative_ru: 'ЖКТ: диарея, тошнота. Костный мозг: лейкопения. Повышенный риск инфекций (в т.ч. ЦМВ) и опухолей. Тератоген.',
    effect_negative_en: 'GI: diarrhoea, nausea. Bone marrow: leukopenia. Raised risk of infection (incl. CMV) and malignancy. Teratogen.',
    effect_negative_es: 'GI: diarrea, náuseas. Médula ósea: leucopenia. Mayor riesgo de infección (incl. CMV) y tumores. Teratógeno.',
    target_organs_positive: ['kidneys', 'joints', 'skin'],
    target_organs_negative: ['colon', 'stomach', 'bones'],
    warning_ru: 'Сильный тератоген — обязательна контрацепция. Контроль крови на лейкопению.',
    warning_en: 'Strong teratogen — contraception mandatory. Monitor blood counts for leukopenia.',
    warning_es: 'Teratógeno potente — anticoncepción obligatoria. Vigilar recuentos sanguíneos.'
  },

  /* ── Биологические ─────────────────────────────────────────────────── */
  {
    slug: 'rituximab', kind: 'medication', category: 'biologic', sort_order: 20,
    name_ru: 'Ритуксимаб', name_en: 'Rituximab', name_es: 'Rituximab',
    brand_ru: ['Мабтера', 'Ацеллбия'], brand_us: ['Rituxan', 'Truxima'],
    effect_positive_ru: 'Моноклональное анти-CD20 антитело. Истощает B-лимфоциты, прерывая выработку аутоантител; применяется при гранулематозе с полиангиитом, ревматоидном артрите, лимфомах.',
    effect_positive_en: 'Anti-CD20 monoclonal antibody. Depletes B-lymphocytes, interrupting autoantibody production; used in granulomatosis with polyangiitis, rheumatoid arthritis and lymphomas.',
    effect_positive_es: 'Anticuerpo monoclonal anti-CD20. Depleciona los linfocitos B, interrumpiendo la producción de autoanticuerpos.',
    effect_negative_ru: 'Инфузионные реакции. Повышенный риск инфекций, реактивация гепатита B. Редко — прогрессирующая мультифокальная лейкоэнцефалопатия. Гипогаммаглобулинемия.',
    effect_negative_en: 'Infusion reactions. Raised infection risk, hepatitis-B reactivation. Rarely progressive multifocal leukoencephalopathy. Hypogammaglobulinaemia.',
    effect_negative_es: 'Reacciones a la infusión. Mayor riesgo de infección, reactivación de hepatitis B. Raramente leucoencefalopatía multifocal progresiva.',
    target_organs_positive: ['vessels', 'joints', 'spleen', 'lungs'],
    target_organs_negative: ['liver', 'lungs'],
    warning_ru: 'Перед началом — скрининг на гепатит B. Длительная B-клеточная депрессия повышает риск инфекций.',
    warning_en: 'Screen for hepatitis B before starting. Prolonged B-cell depletion raises infection risk.',
    warning_es: 'Cribado de hepatitis B antes de iniciar. La depleción prolongada de células B aumenta el riesgo de infección.'
  },
  {
    slug: 'adalimumab', kind: 'medication', category: 'biologic', sort_order: 21,
    name_ru: 'Адалимумаб', name_en: 'Adalimumab', name_es: 'Adalimumab',
    brand_ru: ['Хумира', 'Далибра'], brand_us: ['Humira'],
    effect_positive_ru: 'Моноклональное антитело к ФНО-α. Блокирует ключевой провоспалительный цитокин; применяется при ревматоидном артрите, болезни Крона, псориазе, анкилозирующем спондилите.',
    effect_positive_en: 'Anti-TNF-α monoclonal antibody. Blocks a key pro-inflammatory cytokine; used in rheumatoid arthritis, Crohn’s disease, psoriasis and ankylosing spondylitis.',
    effect_positive_es: 'Anticuerpo monoclonal anti-TNF-α. Bloquea una citocina proinflamatoria clave.',
    effect_negative_ru: 'Повышенный риск серьёзных инфекций, реактивации туберкулёза. Реакции в месте инъекции. Редко — демиелинизация, лимфома.',
    effect_negative_en: 'Raised risk of serious infection, TB reactivation. Injection-site reactions. Rarely demyelination, lymphoma.',
    effect_negative_es: 'Mayor riesgo de infección grave, reactivación de tuberculosis. Reacciones en el sitio de inyección.',
    target_organs_positive: ['joints', 'colon', 'skin'],
    target_organs_negative: ['lungs', 'nervous'],
    warning_ru: 'Перед началом — скрининг на латентный туберкулёз и гепатиты. Отменить при активной инфекции.',
    warning_en: 'Screen for latent TB and hepatitis before starting. Hold during active infection.',
    warning_es: 'Cribado de tuberculosis latente y hepatitis antes de iniciar. Suspender durante infección activa.'
  },
  {
    slug: 'infliximab', kind: 'medication', category: 'biologic', sort_order: 22,
    name_ru: 'Инфликсимаб', name_en: 'Infliximab', name_es: 'Infliximab',
    brand_ru: ['Ремикейд', 'Фламмэгис'], brand_us: ['Remicade', 'Inflectra'],
    effect_positive_ru: 'Химерное анти-ФНО-α антитело для инфузий. Эффективен при болезни Крона, язвенном колите, ревматоидном артрите, псориазе.',
    effect_positive_en: 'Chimeric anti-TNF-α infusion antibody. Effective in Crohn’s disease, ulcerative colitis, rheumatoid arthritis and psoriasis.',
    effect_positive_es: 'Anticuerpo quimérico anti-TNF-α para infusión. Eficaz en enfermedad de Crohn, colitis ulcerosa y artritis reumatoide.',
    effect_negative_ru: 'Инфузионные реакции. Серьёзные инфекции, реактивация туберкулёза и гепатита B. Редко — лекарственная волчанка, лимфома.',
    effect_negative_en: 'Infusion reactions. Serious infection, TB and hepatitis-B reactivation. Rarely drug-induced lupus, lymphoma.',
    effect_negative_es: 'Reacciones a la infusión. Infección grave, reactivación de tuberculosis y hepatitis B.',
    target_organs_positive: ['colon', 'joints', 'skin'],
    target_organs_negative: ['lungs', 'liver'],
    warning_ru: 'Скрининг на туберкулёз/гепатит до старта. Формирование антител может снижать эффект.',
    warning_en: 'TB/hepatitis screen before starting. Anti-drug antibodies may reduce efficacy.',
    warning_es: 'Cribado de tuberculosis/hepatitis antes de iniciar.'
  },

  /* ── ИПП ───────────────────────────────────────────────────────────── */
  {
    slug: 'omeprazole', kind: 'medication', category: 'ppi', sort_order: 30,
    name_ru: 'Омепразол', name_en: 'Omeprazole', name_es: 'Omeprazol',
    brand_ru: ['Омепразол-Акрихин', 'Омез'], brand_us: ['Prilosec', 'Losec'],
    effect_positive_ru: 'Ингибитор протонной помпы. Необратимо блокирует H⁺/K⁺-АТФазу париетальных клеток, резко снижая кислотность желудка; лечит ГЭРБ, язвы, эрадикация H. pylori.',
    effect_positive_en: 'Proton-pump inhibitor. Irreversibly blocks parietal-cell H⁺/K⁺-ATPase, sharply lowering gastric acid; treats GERD, ulcers, H. pylori eradication.',
    effect_positive_es: 'Inhibidor de la bomba de protones. Bloquea la H⁺/K⁺-ATPasa, reduciendo el ácido gástrico; trata ERGE y úlceras.',
    effect_negative_ru: 'Длительно: дефицит B12, магния, кальция; повышенный риск переломов, кишечных инфекций (C. difficile), пневмонии. Возможна гипергастринемия.',
    effect_negative_en: 'Long-term: B12, magnesium, calcium deficiency; raised risk of fractures, enteric infection (C. difficile), pneumonia. Possible hypergastrinaemia.',
    effect_negative_es: 'A largo plazo: déficit de B12, magnesio y calcio; mayor riesgo de fracturas e infecciones entéricas.',
    target_organs_positive: ['stomach'],
    target_organs_negative: ['bones', 'colon', 'kidneys'],
    warning_ru: 'Не для бесконтрольного длительного приёма. Снижает всасывание ряда препаратов (клопидогрел).',
    warning_en: 'Not for uncontrolled long-term use. Reduces absorption of some drugs (clopidogrel).',
    warning_es: 'No para uso prolongado sin control. Reduce la absorción de algunos fármacos.'
  },
  {
    slug: 'pantoprazole', kind: 'medication', category: 'ppi', sort_order: 31,
    name_ru: 'Пантопразол', name_en: 'Pantoprazole', name_es: 'Pantoprazol',
    brand_ru: ['Нольпаза', 'Контролок'], brand_us: ['Protonix'],
    effect_positive_ru: 'ИПП с меньшим лекарственным взаимодействием. Снижает кислотность желудка, лечит ГЭРБ, эрозивный эзофагит, профилактика стресс-язв.',
    effect_positive_en: 'PPI with fewer drug interactions. Lowers gastric acid; treats GERD, erosive esophagitis, stress-ulcer prophylaxis.',
    effect_positive_es: 'IBP con menos interacciones. Reduce el ácido gástrico; trata ERGE y esofagitis erosiva.',
    effect_negative_ru: 'Длительно: дефицит B12 и магния, риск переломов, C. difficile. Головная боль, диарея.',
    effect_negative_en: 'Long-term: B12 and magnesium deficiency, fracture and C. difficile risk. Headache, diarrhoea.',
    effect_negative_es: 'A largo plazo: déficit de B12 y magnesio, riesgo de fracturas. Cefalea, diarrea.',
    target_organs_positive: ['stomach'],
    target_organs_negative: ['bones', 'colon'],
    warning_ru: 'Переоценивать необходимость длительного приёма каждые несколько месяцев.',
    warning_en: 'Reassess the need for long-term use every few months.',
    warning_es: 'Reevaluar la necesidad de uso prolongado periódicamente.'
  },
  {
    slug: 'esomeprazole', kind: 'medication', category: 'ppi', sort_order: 32,
    name_ru: 'Эзомепразол', name_en: 'Esomeprazole', name_es: 'Esomeprazol',
    brand_ru: ['Нексиум', 'Эманера'], brand_us: ['Nexium'],
    effect_positive_ru: 'S-изомер омепразола, более стабильное подавление кислоты. Лечит тяжёлую ГЭРБ, эрозивный эзофагит, синдром Золлингера-Эллисона.',
    effect_positive_en: 'S-isomer of omeprazole, more consistent acid suppression. Treats severe GERD, erosive esophagitis, Zollinger-Ellison syndrome.',
    effect_positive_es: 'Isómero S del omeprazol, supresión ácida más constante. Trata ERGE grave y esofagitis erosiva.',
    effect_negative_ru: 'Длительно: дефицит B12/магния, остеопороз, кишечные инфекции. Возможна интерстициальная нефропатия.',
    effect_negative_en: 'Long-term: B12/magnesium deficiency, osteoporosis, enteric infection. Possible interstitial nephritis.',
    effect_negative_es: 'A largo plazo: déficit de B12/magnesio, osteoporosis, infecciones entéricas.',
    target_organs_positive: ['stomach'],
    target_organs_negative: ['bones', 'kidneys', 'colon'],
    warning_ru: 'Использовать минимально эффективную дозу и срок.',
    warning_en: 'Use the lowest effective dose and shortest duration.',
    warning_es: 'Usar la dosis eficaz más baja y el menor tiempo posible.'
  },

  /* ── Антидепрессанты ───────────────────────────────────────────────── */
  {
    slug: 'sertraline', kind: 'medication', category: 'antidepressant', sort_order: 40,
    name_ru: 'Сертралин', name_en: 'Sertraline', name_es: 'Sertralina',
    brand_ru: ['Золофт', 'Стимулотон'], brand_us: ['Zoloft'],
    effect_positive_ru: 'СИОЗС. Повышает уровень серотонина в синапсах; первая линия при депрессии, тревожных расстройствах, ОКР, ПТСР, паническом расстройстве.',
    effect_positive_en: 'SSRI. Raises synaptic serotonin; first-line for depression, anxiety disorders, OCD, PTSD and panic disorder.',
    effect_positive_es: 'ISRS. Aumenta la serotonina sináptica; primera línea en depresión, trastornos de ansiedad, TOC y TEPT.',
    effect_negative_ru: 'ЖКТ: тошнота, диарея. Половая дисфункция. Бессонница/сонливость. В начале — усиление тревоги. Риск гипонатриемии, кровотечений.',
    effect_negative_en: 'GI: nausea, diarrhoea. Sexual dysfunction. Insomnia/somnolence. Early anxiety surge. Risk of hyponatraemia, bleeding.',
    effect_negative_es: 'GI: náuseas, diarrea. Disfunción sexual. Insomnio/somnolencia. Aumento inicial de ansiedad.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['stomach', 'brain'],
    warning_ru: 'Отменять постепенно — синдром отмены. У молодёжи в первые недели возможен рост суицидальных мыслей.',
    warning_en: 'Taper slowly — discontinuation syndrome. In youth, watch for early suicidal ideation.',
    warning_es: 'Retirar gradualmente — síndrome de discontinuación. En jóvenes, vigilar ideación suicida inicial.'
  },
  {
    slug: 'escitalopram', kind: 'medication', category: 'antidepressant', sort_order: 41,
    name_ru: 'Эсциталопрам', name_en: 'Escitalopram', name_es: 'Escitalopram',
    brand_ru: ['Ципралекс', 'Селектра'], brand_us: ['Lexapro'],
    effect_positive_ru: 'СИОЗС с высокой селективностью. Хорошо переносимая первая линия при депрессии и генерализованном тревожном расстройстве.',
    effect_positive_en: 'Highly selective SSRI. Well-tolerated first-line for depression and generalized anxiety disorder.',
    effect_positive_es: 'ISRS altamente selectivo. Primera línea bien tolerada en depresión y trastorno de ansiedad generalizada.',
    effect_negative_ru: 'Тошнота, половая дисфункция, потливость. Дозозависимое удлинение QT. Синдром отмены.',
    effect_negative_en: 'Nausea, sexual dysfunction, sweating. Dose-dependent QT prolongation. Discontinuation syndrome.',
    effect_negative_es: 'Náuseas, disfunción sexual, sudoración. Prolongación del QT dosis-dependiente.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['heart', 'stomach'],
    warning_ru: 'Не превышать 20 мг/сут (QT). Отменять постепенно.',
    warning_en: 'Do not exceed 20 mg/day (QT). Taper on stopping.',
    warning_es: 'No superar 20 mg/día (QT). Retirar gradualmente.'
  },
  {
    slug: 'venlafaxine', kind: 'medication', category: 'antidepressant', sort_order: 42,
    name_ru: 'Венлафаксин', name_en: 'Venlafaxine', name_es: 'Venlafaxina',
    brand_ru: ['Велаксин', 'Велафакс'], brand_us: ['Effexor XR'],
    effect_positive_ru: 'СИОЗСН. Повышает серотонин и норадреналин; при депрессии, тревоге, панике; в высоких дозах помогает при хронической боли.',
    effect_positive_en: 'SNRI. Raises serotonin and noradrenaline; for depression, anxiety, panic; high doses help chronic pain.',
    effect_positive_es: 'IRSN. Aumenta serotonina y noradrenalina; para depresión, ansiedad y dolor crónico.',
    effect_negative_ru: 'Повышение АД (дозозависимо), тахикардия, потливость, тошнота. Выраженный синдром отмены.',
    effect_negative_en: 'Raised blood pressure (dose-dependent), tachycardia, sweating, nausea. Marked discontinuation syndrome.',
    effect_negative_es: 'Aumento de la presión arterial, taquicardia, sudoración, náuseas. Síndrome de discontinuación marcado.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['heart', 'vessels', 'stomach'],
    warning_ru: 'Контроль АД. Никогда не отменять резко — тяжёлый синдром отмены.',
    warning_en: 'Monitor blood pressure. Never stop abruptly — severe discontinuation syndrome.',
    warning_es: 'Vigilar la presión arterial. Nunca suspender bruscamente.'
  },
  {
    slug: 'bupropion', kind: 'medication', category: 'antidepressant', sort_order: 43,
    name_ru: 'Бупропион', name_en: 'Bupropion', name_es: 'Bupropión',
    brand_ru: ['Веллбутрин', 'Зибан'], brand_us: ['Wellbutrin', 'Zyban'],
    effect_positive_ru: 'Ингибитор обратного захвата норадреналина и дофамина. Активирующий антидепрессант без половой дисфункции; помогает бросить курить.',
    effect_positive_en: 'Noradrenaline-dopamine reuptake inhibitor. Activating antidepressant without sexual dysfunction; aids smoking cessation.',
    effect_positive_es: 'Inhibidor de la recaptación de noradrenalina y dopamina. Antidepresivo activador; ayuda a dejar de fumar.',
    effect_negative_ru: 'Снижает порог судорог. Бессонница, тревога, сухость во рту, тахикардия. Противопоказан при булимии/анорексии.',
    effect_negative_en: 'Lowers seizure threshold. Insomnia, anxiety, dry mouth, tachycardia. Contraindicated in bulimia/anorexia.',
    effect_negative_es: 'Reduce el umbral convulsivo. Insomnio, ansiedad, sequedad bucal, taquicardia.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['brain', 'heart'],
    warning_ru: 'Не применять при судорожных расстройствах. Не сочетать с другими снижающими порог судорог средствами.',
    warning_en: 'Avoid in seizure disorders. Do not combine with other seizure-threshold-lowering agents.',
    warning_es: 'Evitar en trastornos convulsivos.'
  },
  {
    slug: 'mirtazapine', kind: 'medication', category: 'antidepressant', sort_order: 44,
    name_ru: 'Миртазапин', name_en: 'Mirtazapine', name_es: 'Mirtazapina',
    brand_ru: ['Ремерон', 'Каликста'], brand_us: ['Remeron'],
    effect_positive_ru: 'Норадренергический и специфический серотонинергический антидепрессант. Улучшает сон и аппетит; полезен при депрессии с бессонницей и потерей веса.',
    effect_positive_en: 'Noradrenergic and specific serotonergic antidepressant. Improves sleep and appetite; useful in depression with insomnia and weight loss.',
    effect_positive_es: 'Antidepresivo noradrenérgico y serotoninérgico específico. Mejora el sueño y el apetito.',
    effect_negative_ru: 'Сонливость, выраженный набор веса, повышение аппетита. Редко — агранулоцитоз. Сухость во рту.',
    effect_negative_en: 'Sedation, marked weight gain, increased appetite. Rarely agranulocytosis. Dry mouth.',
    effect_negative_es: 'Sedación, aumento de peso marcado, mayor apetito. Raramente agranulocitosis.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['brain', 'bones'],
    warning_ru: 'Сообщать о лихорадке/ангине (риск агранулоцитоза). Выраженная седация.',
    warning_en: 'Report fever/sore throat (agranulocytosis risk). Marked sedation.',
    warning_es: 'Informar fiebre/dolor de garganta (riesgo de agranulocitosis).'
  },

  /* ── Анксиолитики (бензодиазепины) ─────────────────────────────────── */
  {
    slug: 'alprazolam', kind: 'medication', category: 'anxiolytic', sort_order: 50,
    name_ru: 'Алпразолам', name_en: 'Alprazolam', name_es: 'Alprazolam',
    brand_ru: ['Ксанакс', 'Алзолам'], brand_us: ['Xanax'],
    effect_positive_ru: 'Бензодиазепин короткого действия. Усиливает действие ГАМК, быстро снимает острую тревогу и панические атаки.',
    effect_positive_en: 'Short-acting benzodiazepine. Potentiates GABA, rapidly relieving acute anxiety and panic attacks.',
    effect_positive_es: 'Benzodiazepina de acción corta. Potencia el GABA, aliviando rápidamente la ansiedad aguda y las crisis de pánico.',
    effect_negative_ru: 'Седация, нарушение координации и памяти. Быстрое привыкание и зависимость. Тяжёлый синдром отмены (судороги). Угнетение дыхания с алкоголем/опиоидами.',
    effect_negative_en: 'Sedation, impaired coordination and memory. Rapid tolerance and dependence. Severe withdrawal (seizures). Respiratory depression with alcohol/opioids.',
    effect_negative_es: 'Sedación, deterioro de coordinación y memoria. Tolerancia y dependencia rápidas. Abstinencia grave (convulsiones).',
    target_organs_positive: ['brain'],
    target_organs_negative: ['brain', 'lungs'],
    warning_ru: 'Высокий потенциал зависимости — только короткими курсами. Никогда не сочетать с алкоголем/опиоидами. Не отменять резко.',
    warning_en: 'High dependence potential — short courses only. Never combine with alcohol/opioids. Do not stop abruptly.',
    warning_es: 'Alto potencial de dependencia — solo ciclos cortos. Nunca combinar con alcohol/opioides.'
  },
  {
    slug: 'clonazepam', kind: 'medication', category: 'anxiolytic', sort_order: 51,
    name_ru: 'Клоназепам', name_en: 'Clonazepam', name_es: 'Clonazepam',
    brand_ru: ['Клоназепам', 'Ривотрил'], brand_us: ['Klonopin'],
    effect_positive_ru: 'Бензодиазепин длительного действия. Противосудорожный и противотревожный; при панике, некоторых формах эпилепсии, миоклониях.',
    effect_positive_en: 'Long-acting benzodiazepine. Anticonvulsant and anxiolytic; for panic, some epilepsies, myoclonus.',
    effect_positive_es: 'Benzodiazepina de acción prolongada. Anticonvulsivo y ansiolítico.',
    effect_negative_ru: 'Седация, утомляемость, нарушение координации. Зависимость, синдром отмены. Угнетение дыхания в комбинациях.',
    effect_negative_en: 'Sedation, fatigue, impaired coordination. Dependence, withdrawal. Respiratory depression in combinations.',
    effect_negative_es: 'Sedación, fatiga, deterioro de coordinación. Dependencia, abstinencia.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['brain', 'lungs'],
    warning_ru: 'Потенциал зависимости. Отменять постепенно. Осторожно с пожилыми (падения).',
    warning_en: 'Dependence potential. Taper slowly. Caution in the elderly (falls).',
    warning_es: 'Potencial de dependencia. Retirar gradualmente.'
  },
  {
    slug: 'diazepam', kind: 'medication', category: 'anxiolytic', sort_order: 52,
    name_ru: 'Диазепам', name_en: 'Diazepam', name_es: 'Diazepam',
    brand_ru: ['Реланиум', 'Сибазон', 'Седуксен'], brand_us: ['Valium'],
    effect_positive_ru: 'Классический бензодиазепин. Противотревожный, миорелаксант, противосудорожный; купирование судорог, мышечного спазма, алкогольной отмены.',
    effect_positive_en: 'Classic benzodiazepine. Anxiolytic, muscle relaxant, anticonvulsant; for seizures, muscle spasm, alcohol withdrawal.',
    effect_positive_es: 'Benzodiazepina clásica. Ansiolítico, relajante muscular y anticonvulsivo.',
    effect_negative_ru: 'Длительная седация (активные метаболиты), нарушение координации. Зависимость, синдром отмены. Угнетение дыхания.',
    effect_negative_en: 'Prolonged sedation (active metabolites), incoordination. Dependence, withdrawal. Respiratory depression.',
    effect_negative_es: 'Sedación prolongada, descoordinación. Dependencia, abstinencia. Depresión respiratoria.',
    target_organs_positive: ['brain', 'muscles'],
    target_organs_negative: ['brain', 'lungs'],
    warning_ru: 'Длинный период полувыведения — накопление у пожилых. Не сочетать с алкоголем/опиоидами.',
    warning_en: 'Long half-life — accumulation in the elderly. Do not combine with alcohol/opioids.',
    warning_es: 'Vida media larga — acumulación en ancianos.'
  },

  /* ── Антипсихотики ─────────────────────────────────────────────────── */
  {
    slug: 'quetiapine', kind: 'medication', category: 'antipsychotic', sort_order: 60,
    name_ru: 'Кветиапин', name_en: 'Quetiapine', name_es: 'Quetiapina',
    brand_ru: ['Сероквель', 'Кветирон'], brand_us: ['Seroquel'],
    effect_positive_ru: 'Атипичный антипсихотик. Блокирует D2 и 5-HT2A рецепторы; при шизофрении, биполярном расстройстве, как дополнение при депрессии; в малых дозах — седация.',
    effect_positive_en: 'Atypical antipsychotic. Blocks D2 and 5-HT2A receptors; for schizophrenia, bipolar disorder, adjunct in depression; low dose sedating.',
    effect_positive_es: 'Antipsicótico atípico. Bloquea receptores D2 y 5-HT2A; para esquizofrenia y trastorno bipolar.',
    effect_negative_ru: 'Седация, набор веса, метаболический синдром, гипергликемия. Ортостатическая гипотензия, удлинение QT. Редко — поздняя дискинезия.',
    effect_negative_en: 'Sedation, weight gain, metabolic syndrome, hyperglycaemia. Orthostatic hypotension, QT prolongation. Rarely tardive dyskinesia.',
    effect_negative_es: 'Sedación, aumento de peso, síndrome metabólico. Hipotensión ortostática, prolongación del QT.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['pancreas', 'heart', 'liver'],
    warning_ru: 'Контроль веса, глюкозы и липидов. Осторожно у пожилых с деменцией (рост смертности).',
    warning_en: 'Monitor weight, glucose and lipids. Caution in elderly dementia (raised mortality).',
    warning_es: 'Vigilar peso, glucosa y lípidos.'
  },
  {
    slug: 'olanzapine', kind: 'medication', category: 'antipsychotic', sort_order: 61,
    name_ru: 'Оланзапин', name_en: 'Olanzapine', name_es: 'Olanzapina',
    brand_ru: ['Зипрекса', 'Заласта'], brand_us: ['Zyprexa'],
    effect_positive_ru: 'Атипичный антипсихотик с сильным эффектом. При шизофрении и острой мании; стабилизирует настроение и психотическую симптоматику.',
    effect_positive_en: 'Potent atypical antipsychotic. For schizophrenia and acute mania; stabilizes mood and psychotic symptoms.',
    effect_positive_es: 'Antipsicótico atípico potente. Para esquizofrenia y manía aguda.',
    effect_negative_ru: 'Выраженный набор веса и метаболический синдром, диабет, дислипидемия. Седация. Поздняя дискинезия.',
    effect_negative_en: 'Marked weight gain and metabolic syndrome, diabetes, dyslipidaemia. Sedation. Tardive dyskinesia.',
    effect_negative_es: 'Aumento de peso marcado y síndrome metabólico, diabetes. Sedación.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['pancreas', 'liver', 'heart'],
    warning_ru: 'Один из самых метаболически неблагоприятных — обязательный контроль веса и глюкозы.',
    warning_en: 'Among the most metabolically adverse — mandatory weight and glucose monitoring.',
    warning_es: 'De los más adversos metabólicamente — control obligatorio de peso y glucosa.'
  },
  {
    slug: 'risperidone', kind: 'medication', category: 'antipsychotic', sort_order: 62,
    name_ru: 'Рисперидон', name_en: 'Risperidone', name_es: 'Risperidona',
    brand_ru: ['Рисполепт', 'Сперидан'], brand_us: ['Risperdal'],
    effect_positive_ru: 'Атипичный антипсихотик. При шизофрении, биполярной мании, раздражительности при аутизме; эффективен против позитивной симптоматики.',
    effect_positive_en: 'Atypical antipsychotic. For schizophrenia, bipolar mania, irritability in autism; effective against positive symptoms.',
    effect_positive_es: 'Antipsicótico atípico. Para esquizofrenia, manía bipolar e irritabilidad en autismo.',
    effect_negative_ru: 'Повышение пролактина (галакторея, аменорея). Экстрапирамидные симптомы, набор веса. Ортостатическая гипотензия.',
    effect_negative_en: 'Raised prolactin (galactorrhoea, amenorrhoea). Extrapyramidal symptoms, weight gain. Orthostatic hypotension.',
    effect_negative_es: 'Aumento de prolactina. Síntomas extrapiramidales, aumento de peso.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['brain', 'pancreas'],
    warning_ru: 'Чаще других атипиков повышает пролактин и даёт ЭПС. Осторожно у пожилых с деменцией.',
    warning_en: 'Raises prolactin and causes EPS more than other atypicals. Caution in elderly dementia.',
    warning_es: 'Eleva la prolactina y causa SEP más que otros atípicos.'
  },

  /* ── Стабилизаторы настроения ──────────────────────────────────────── */
  {
    slug: 'lithium', kind: 'medication', category: 'mood_stabilizer', sort_order: 70,
    name_ru: 'Литий', name_en: 'Lithium', name_es: 'Litio',
    brand_ru: ['Седалит', 'Контемнол'], brand_us: ['Lithobid', 'Eskalith'],
    effect_positive_ru: 'Эталонный стабилизатор настроения. При биполярном расстройстве снижает частоту и тяжесть маний и депрессий; единственный препарат с доказанным антисуицидальным эффектом.',
    effect_positive_en: 'Gold-standard mood stabilizer. Reduces frequency and severity of mania and depression in bipolar disorder; the only agent with proven anti-suicidal effect.',
    effect_positive_es: 'Estabilizador del ánimo de referencia. Reduce manías y depresiones en el trastorno bipolar; único con efecto antisuicida probado.',
    effect_negative_ru: 'Узкий терапевтический диапазон — риск интоксикации (тремор, спутанность). Гипотиреоз, нефрогенный несахарный диабет, поражение почек. Набор веса.',
    effect_negative_en: 'Narrow therapeutic window — toxicity risk (tremor, confusion). Hypothyroidism, nephrogenic diabetes insipidus, renal impairment. Weight gain.',
    effect_negative_es: 'Ventana terapéutica estrecha — riesgo de toxicidad. Hipotiroidismo, diabetes insípida nefrogénica, daño renal.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['kidneys', 'thyroid'],
    warning_ru: 'Обязателен контроль концентрации лития, функции почек и щитовидной железы. НПВП и обезвоживание повышают уровень до токсичного.',
    warning_en: 'Mandatory monitoring of lithium level, kidney and thyroid function. NSAIDs and dehydration raise levels into toxicity.',
    warning_es: 'Control obligatorio de litemia, función renal y tiroidea.'
  },
  {
    slug: 'lamotrigine', kind: 'medication', category: 'mood_stabilizer', sort_order: 71,
    name_ru: 'Ламотриджин', name_en: 'Lamotrigine', name_es: 'Lamotrigina',
    brand_ru: ['Ламиктал', 'Конвульсан'], brand_us: ['Lamictal'],
    effect_positive_ru: 'Противоэпилептический препарат и стабилизатор настроения. Особенно эффективен в профилактике биполярной депрессии; модулирует натриевые каналы.',
    effect_positive_en: 'Antiepileptic and mood stabilizer. Especially effective in preventing bipolar depression; modulates sodium channels.',
    effect_positive_es: 'Antiepiléptico y estabilizador del ánimo. Eficaz en la prevención de la depresión bipolar.',
    effect_negative_ru: 'Опасная сыпь (синдром Стивенса-Джонсона) при быстром наращивании дозы. Головокружение, головная боль, диплопия.',
    effect_negative_en: 'Dangerous rash (Stevens-Johnson syndrome) with rapid titration. Dizziness, headache, diplopia.',
    effect_negative_es: 'Erupción peligrosa (síndrome de Stevens-Johnson) con titulación rápida.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['skin'],
    warning_ru: 'Очень медленное наращивание дозы из-за риска тяжёлой сыпи. Сообщать о любой сыпи немедленно.',
    warning_en: 'Very slow titration due to severe-rash risk. Report any rash immediately.',
    warning_es: 'Titulación muy lenta por el riesgo de erupción grave.'
  },
  {
    slug: 'valproate', kind: 'medication', category: 'mood_stabilizer', sort_order: 72,
    name_ru: 'Вальпроевая кислота', name_en: 'Valproate', name_es: 'Ácido valproico',
    brand_ru: ['Депакин', 'Конвулекс'], brand_us: ['Depakote', 'Depakene'],
    effect_positive_ru: 'Противоэпилептический препарат и стабилизатор настроения. При биполярной мании, эпилепсии, профилактике мигрени.',
    effect_positive_en: 'Antiepileptic and mood stabilizer. For bipolar mania, epilepsy, migraine prophylaxis.',
    effect_positive_es: 'Antiepiléptico y estabilizador del ánimo. Para manía bipolar, epilepsia y profilaxis de migraña.',
    effect_negative_ru: 'Печень: гепатотоксичность. Поджелудочная: панкреатит. Набор веса, тремор, выпадение волос, тромбоцитопения. Сильный тератоген.',
    effect_negative_en: 'Liver: hepatotoxicity. Pancreas: pancreatitis. Weight gain, tremor, hair loss, thrombocytopenia. Strong teratogen.',
    effect_negative_es: 'Hígado: hepatotoxicidad. Páncreas: pancreatitis. Aumento de peso, temblor. Teratógeno potente.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['liver', 'pancreas'],
    warning_ru: 'Сильнейший тератоген — нельзя женщинам детородного возраста без надёжной контрацепции. Контроль печени и тромбоцитов.',
    warning_en: 'Severe teratogen — avoid in women of childbearing potential without reliable contraception. Monitor liver and platelets.',
    warning_es: 'Teratógeno grave — evitar en mujeres fértiles sin anticoncepción fiable.'
  },

  /* ── Стимуляторы / СДВГ ────────────────────────────────────────────── */
  {
    slug: 'methylphenidate', kind: 'medication', category: 'stimulant', sort_order: 80,
    name_ru: 'Метилфенидат', name_en: 'Methylphenidate', name_es: 'Metilfenidato',
    brand_ru: ['Риталин', 'Концерта'], brand_us: ['Ritalin', 'Concerta'],
    effect_positive_ru: 'Психостимулятор. Повышает дофамин и норадреналин в префронтальной коре; первая линия при СДВГ — улучшает внимание и контроль импульсов.',
    effect_positive_en: 'Psychostimulant. Raises dopamine and noradrenaline in the prefrontal cortex; first-line for ADHD — improves attention and impulse control.',
    effect_positive_es: 'Psicoestimulante. Aumenta dopamina y noradrenalina en la corteza prefrontal; primera línea en TDAH.',
    effect_negative_ru: 'Снижение аппетита, бессонница, тахикардия, повышение АД. Тревога, раздражительность. Потенциал злоупотребления.',
    effect_negative_en: 'Appetite loss, insomnia, tachycardia, raised blood pressure. Anxiety, irritability. Abuse potential.',
    effect_negative_es: 'Pérdida de apetito, insomnio, taquicardia, aumento de la presión arterial.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['heart', 'vessels', 'stomach'],
    warning_ru: 'Контролируемое вещество. Оценить сердечный риск до старта. Контроль роста у детей.',
    warning_en: 'Controlled substance. Assess cardiac risk before starting. Monitor growth in children.',
    warning_es: 'Sustancia controlada. Evaluar el riesgo cardíaco antes de iniciar.'
  },
  {
    slug: 'lisdexamfetamine', kind: 'medication', category: 'stimulant', sort_order: 81,
    name_ru: 'Лисдексамфетамин', name_en: 'Lisdexamfetamine', name_es: 'Lisdexanfetamina',
    brand_ru: ['Вивансе'], brand_us: ['Vyvanse'],
    effect_positive_ru: 'Пролекарство амфетамина с плавным длительным действием. При СДВГ и переедании; повышает дофамин и норадреналин.',
    effect_positive_en: 'Amfetamine prodrug with smooth long action. For ADHD and binge-eating disorder; raises dopamine and noradrenaline.',
    effect_positive_es: 'Profármaco de anfetamina de acción prolongada. Para TDAH y trastorno por atracón.',
    effect_negative_ru: 'Снижение аппетита, бессонница, сухость во рту, тахикардия, повышение АД. Потенциал злоупотребления, тревога.',
    effect_negative_en: 'Appetite loss, insomnia, dry mouth, tachycardia, raised blood pressure. Abuse potential, anxiety.',
    effect_negative_es: 'Pérdida de apetito, insomnio, taquicardia, aumento de la presión arterial.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['heart', 'vessels', 'stomach'],
    warning_ru: 'Контролируемое вещество. Сердечный скрининг до старта. Не применять при тяжёлых ССЗ.',
    warning_en: 'Controlled substance. Cardiac screening before starting. Avoid in serious cardiovascular disease.',
    warning_es: 'Sustancia controlada. Cribado cardíaco antes de iniciar.'
  },
  {
    slug: 'atomoxetine', kind: 'medication', category: 'stimulant', sort_order: 82,
    name_ru: 'Атомоксетин', name_en: 'Atomoxetine', name_es: 'Atomoxetina',
    brand_ru: ['Страттера'], brand_us: ['Strattera'],
    effect_positive_ru: 'Неэстимуляторный препарат при СДВГ — селективный ингибитор обратного захвата норадреналина. Без потенциала злоупотребления; действует не сразу.',
    effect_positive_en: 'Non-stimulant ADHD drug — selective noradrenaline reuptake inhibitor. No abuse potential; delayed onset.',
    effect_positive_es: 'Fármaco no estimulante para TDAH — inhibidor selectivo de la recaptación de noradrenalina.',
    effect_negative_ru: 'Тошнота, снижение аппетита, утомляемость, повышение АД и ЧСС. Редко — гепатотоксичность, суицидальные мысли у подростков.',
    effect_negative_en: 'Nausea, appetite loss, fatigue, raised blood pressure and heart rate. Rarely hepatotoxicity, suicidal ideation in adolescents.',
    effect_negative_es: 'Náuseas, pérdida de apetito, fatiga, aumento de presión arterial.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['liver', 'heart'],
    warning_ru: 'Следить за признаками поражения печени и настроением у подростков.',
    warning_en: 'Watch for signs of liver injury and mood changes in adolescents.',
    warning_es: 'Vigilar signos de daño hepático y cambios de ánimo en adolescentes.'
  },

  /* ── Противоэпилептические ─────────────────────────────────────────── */
  {
    slug: 'levetiracetam', kind: 'medication', category: 'antiepileptic', sort_order: 90,
    name_ru: 'Леветирацетам', name_en: 'Levetiracetam', name_es: 'Levetiracetam',
    brand_ru: ['Кеппра', 'Леветинол'], brand_us: ['Keppra'],
    effect_positive_ru: 'Противоэпилептический препарат широкого спектра. Связывается с белком синаптических везикул SV2A; мало лекарственных взаимодействий.',
    effect_positive_en: 'Broad-spectrum antiepileptic. Binds synaptic-vesicle protein SV2A; few drug interactions.',
    effect_positive_es: 'Antiepiléptico de amplio espectro. Se une a la proteína SV2A; pocas interacciones.',
    effect_negative_ru: 'Раздражительность, перепады настроения, депрессия, агрессия. Сонливость, головокружение.',
    effect_negative_en: 'Irritability, mood swings, depression, aggression. Somnolence, dizziness.',
    effect_negative_es: 'Irritabilidad, cambios de humor, depresión, agresividad. Somnolencia.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['brain'],
    warning_ru: 'Сообщать о выраженных изменениях настроения и поведения.',
    warning_en: 'Report marked mood or behavioural changes.',
    warning_es: 'Informar cambios marcados de ánimo o conducta.'
  },
  {
    slug: 'topiramate', kind: 'medication', category: 'antiepileptic', sort_order: 91,
    name_ru: 'Топирамат', name_en: 'Topiramate', name_es: 'Topiramato',
    brand_ru: ['Топамакс', 'Топсавер'], brand_us: ['Topamax'],
    effect_positive_ru: 'Противоэпилептический препарат; также профилактика мигрени и снижение веса. Множественный механизм действия.',
    effect_positive_en: 'Antiepileptic; also migraine prophylaxis and weight reduction. Multiple mechanisms.',
    effect_positive_es: 'Antiepiléptico; también profilaxis de migraña y reducción de peso.',
    effect_negative_ru: 'Парестезии, когнитивное замедление, нарушение слов. Камни в почках, метаболический ацидоз, глаукома. Снижение веса.',
    effect_negative_en: 'Paraesthesia, cognitive slowing, word-finding difficulty. Kidney stones, metabolic acidosis, glaucoma. Weight loss.',
    effect_negative_es: 'Parestesias, lentitud cognitiva. Cálculos renales, acidosis metabólica, glaucoma.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['kidneys', 'brain'],
    warning_ru: 'Пить много воды (камни). Сообщать о боли/затуманивании зрения (глаукома). Тератоген.',
    warning_en: 'Drink plenty of water (stones). Report eye pain/blurring (glaucoma). Teratogen.',
    warning_es: 'Beber mucha agua (cálculos). Informar dolor/visión borrosa (glaucoma).'
  },
  {
    slug: 'carbamazepine', kind: 'medication', category: 'antiepileptic', sort_order: 92,
    name_ru: 'Карбамазепин', name_en: 'Carbamazepine', name_es: 'Carbamazepina',
    brand_ru: ['Финлепсин', 'Тегретол'], brand_us: ['Tegretol', 'Carbatrol'],
    effect_positive_ru: 'Противоэпилептический препарат и стабилизатор настроения; первая линия при невралгии тройничного нерва. Блокирует натриевые каналы.',
    effect_positive_en: 'Antiepileptic and mood stabilizer; first-line for trigeminal neuralgia. Blocks sodium channels.',
    effect_positive_es: 'Antiepiléptico y estabilizador del ánimo; primera línea en neuralgia del trigémino.',
    effect_negative_ru: 'Гипонатриемия, сыпь (риск SJS, особенно HLA-B*1502), угнетение костного мозга, гепатотоксичность. Мощный индуктор ферментов печени.',
    effect_negative_en: 'Hyponatraemia, rash (SJS risk, esp. HLA-B*1502), bone-marrow suppression, hepatotoxicity. Potent hepatic enzyme inducer.',
    effect_negative_es: 'Hiponatremia, erupción (riesgo SJS), supresión medular, hepatotoxicidad.',
    target_organs_positive: ['brain', 'nervous'],
    target_organs_negative: ['liver', 'bones', 'skin'],
    warning_ru: 'Генетический тест HLA-B*1502 у азиатов (риск SJS). Снижает эффект многих препаратов (индукция).',
    warning_en: 'HLA-B*1502 testing in Asian patients (SJS risk). Reduces efficacy of many drugs (induction).',
    warning_es: 'Prueba HLA-B*1502 en pacientes asiáticos (riesgo SJS).'
  },

  /* ── НПВП ───────────────────────────────────────────────────────────── */
  {
    slug: 'ibuprofen', kind: 'medication', category: 'nsaid', sort_order: 100,
    name_ru: 'Ибупрофен', name_en: 'Ibuprofen', name_es: 'Ibuprofeno',
    brand_ru: ['Нурофен', 'Миг'], brand_us: ['Advil', 'Motrin'],
    effect_positive_ru: 'НПВП. Ингибирует ЦОГ-1/2, снижая простагландины; обезболивает, снимает воспаление и жар при артрите, травмах, головной боли.',
    effect_positive_en: 'NSAID. Inhibits COX-1/2, lowering prostaglandins; relieves pain, inflammation and fever in arthritis, injury, headache.',
    effect_positive_es: 'AINE. Inhibe la COX-1/2; alivia dolor, inflamación y fiebre.',
    effect_negative_ru: 'ЖКТ: гастрит, язвы, кровотечение. Почки: снижение функции, задержка жидкости. Сердечно-сосудистый риск, повышение АД.',
    effect_negative_en: 'GI: gastritis, ulcers, bleeding. Kidney: reduced function, fluid retention. Cardiovascular risk, raised blood pressure.',
    effect_negative_es: 'GI: gastritis, úlceras, sangrado. Riñón: función reducida. Riesgo cardiovascular.',
    target_organs_positive: ['joints', 'muscles'],
    target_organs_negative: ['stomach', 'kidneys', 'heart'],
    warning_ru: 'Принимать с едой, короткими курсами. Осторожно при болезнях ЖКТ, почек, сердца.',
    warning_en: 'Take with food, short courses. Caution in GI, kidney or heart disease.',
    warning_es: 'Tomar con alimentos, ciclos cortos.'
  },
  {
    slug: 'naproxen', kind: 'medication', category: 'nsaid', sort_order: 101,
    name_ru: 'Напроксен', name_en: 'Naproxen', name_es: 'Naproxeno',
    brand_ru: ['Налгезин', 'Напробене'], brand_us: ['Aleve', 'Naprosyn'],
    effect_positive_ru: 'НПВП длительного действия. Обезболивает и снимает воспаление при артрите, подагре, дисменорее; относительно меньший сердечный риск среди НПВП.',
    effect_positive_en: 'Long-acting NSAID. Relieves pain and inflammation in arthritis, gout, dysmenorrhoea; relatively lower cardiac risk among NSAIDs.',
    effect_positive_es: 'AINE de acción prolongada. Alivia dolor e inflamación en artritis y gota.',
    effect_negative_ru: 'ЖКТ: язвы, кровотечение. Почки: снижение функции. Задержка жидкости, повышение АД.',
    effect_negative_en: 'GI: ulcers, bleeding. Kidney: reduced function. Fluid retention, raised blood pressure.',
    effect_negative_es: 'GI: úlceras, sangrado. Riñón: función reducida.',
    target_organs_positive: ['joints', 'muscles'],
    target_organs_negative: ['stomach', 'kidneys'],
    warning_ru: 'Принимать с едой. Осторожно при язвенной болезни и почечной недостаточности.',
    warning_en: 'Take with food. Caution in peptic ulcer and renal impairment.',
    warning_es: 'Tomar con alimentos.'
  },
  {
    slug: 'celecoxib', kind: 'medication', category: 'nsaid', sort_order: 102,
    name_ru: 'Целекоксиб', name_en: 'Celecoxib', name_es: 'Celecoxib',
    brand_ru: ['Целебрекс', 'Дилакса'], brand_us: ['Celebrex'],
    effect_positive_ru: 'Селективный ингибитор ЦОГ-2. Противовоспалительный и обезболивающий при артрите с меньшим риском желудочных язв.',
    effect_positive_en: 'Selective COX-2 inhibitor. Anti-inflammatory and analgesic for arthritis with lower gastric-ulcer risk.',
    effect_positive_es: 'Inhibidor selectivo de COX-2. Antiinflamatorio con menor riesgo de úlcera gástrica.',
    effect_negative_ru: 'Сердечно-сосудистый риск (тромбозы). Почки: снижение функции, задержка жидкости, повышение АД.',
    effect_negative_en: 'Cardiovascular risk (thrombosis). Kidney: reduced function, fluid retention, raised blood pressure.',
    effect_negative_es: 'Riesgo cardiovascular. Riñón: función reducida, retención de líquidos.',
    target_organs_positive: ['joints'],
    target_organs_negative: ['heart', 'vessels', 'kidneys'],
    warning_ru: 'Осторожно при сердечно-сосудистых заболеваниях. Аллергия на сульфонамиды — противопоказание.',
    warning_en: 'Caution in cardiovascular disease. Sulfonamide allergy is a contraindication.',
    warning_es: 'Precaución en enfermedad cardiovascular.'
  },

  /* ── Антибиотики ───────────────────────────────────────────────────── */
  {
    slug: 'amoxicillin-clavulanate', kind: 'medication', category: 'antibiotic', sort_order: 110,
    name_ru: 'Амоксициллин/клавуланат', name_en: 'Amoxicillin/clavulanate', name_es: 'Amoxicilina/clavulánico',
    brand_ru: ['Амоксиклав', 'Аугментин'], brand_us: ['Augmentin'],
    effect_positive_ru: 'Защищённый пенициллин широкого спектра. Клавуланат блокирует бета-лактамазы; при синуситах, отитах, пневмонии, инфекциях кожи и мочевых путей.',
    effect_positive_en: 'Broad-spectrum protected penicillin. Clavulanate blocks beta-lactamases; for sinusitis, otitis, pneumonia, skin and urinary infections.',
    effect_positive_es: 'Penicilina protegida de amplio espectro. Para sinusitis, otitis, neumonía e infecciones de piel.',
    effect_negative_ru: 'ЖКТ: диарея (в т.ч. C. difficile), тошнота. Аллергические реакции. Редко — холестатическая желтуха. Кандидоз.',
    effect_negative_en: 'GI: diarrhoea (incl. C. difficile), nausea. Allergic reactions. Rarely cholestatic jaundice. Candidiasis.',
    effect_negative_es: 'GI: diarrea, náuseas. Reacciones alérgicas.',
    target_organs_positive: ['lungs', 'skin'],
    target_organs_negative: ['colon', 'liver'],
    warning_ru: 'Не применять при аллергии на пенициллины. Завершать полный курс.',
    warning_en: 'Avoid with penicillin allergy. Complete the full course.',
    warning_es: 'Evitar con alergia a penicilinas. Completar el ciclo.'
  },
  {
    slug: 'doxycycline', kind: 'medication', category: 'antibiotic', sort_order: 111,
    name_ru: 'Доксициклин', name_en: 'Doxycycline', name_es: 'Doxiciclina',
    brand_ru: ['Юнидокс Солютаб', 'Доксициклин'], brand_us: ['Vibramycin', 'Doryx'],
    effect_positive_ru: 'Тетрациклиновый антибиотик. При атипичных пневмониях, акне, болезни Лайма, инфекциях, передающихся клещами и половым путём.',
    effect_positive_en: 'Tetracycline antibiotic. For atypical pneumonia, acne, Lyme disease, tick-borne and sexually transmitted infections.',
    effect_positive_es: 'Antibiótico tetraciclina. Para neumonía atípica, acné y enfermedad de Lyme.',
    effect_negative_ru: 'Фотосенсибилизация, раздражение пищевода. ЖКТ-расстройства. Окрашивание зубов у детей. Не для беременных.',
    effect_negative_en: 'Photosensitivity, esophageal irritation. GI upset. Tooth discolouration in children. Not in pregnancy.',
    effect_negative_es: 'Fotosensibilidad, irritación esofágica. Decoloración dental en niños.',
    target_organs_positive: ['lungs', 'skin'],
    target_organs_negative: ['stomach', 'skin'],
    warning_ru: 'Запивать большим объёмом воды стоя (риск язв пищевода). Избегать солнца. Не давать детям до 8 лет и беременным.',
    warning_en: 'Take with a full glass of water upright (esophageal-ulcer risk). Avoid sun. Not for children <8 or pregnancy.',
    warning_es: 'Tomar con un vaso lleno de agua. Evitar el sol.'
  },
  {
    slug: 'ciprofloxacin', kind: 'medication', category: 'antibiotic', sort_order: 112,
    name_ru: 'Ципрофлоксацин', name_en: 'Ciprofloxacin', name_es: 'Ciprofloxacino',
    brand_ru: ['Ципролет', 'Цифран'], brand_us: ['Cipro'],
    effect_positive_ru: 'Фторхинолон широкого спектра. При сложных инфекциях мочевых путей, ЖКТ, костей; ингибирует бактериальную ДНК-гиразу.',
    effect_positive_en: 'Broad-spectrum fluoroquinolone. For complicated urinary, GI and bone infections; inhibits bacterial DNA gyrase.',
    effect_positive_es: 'Fluoroquinolona de amplio espectro. Para infecciones urinarias y digestivas complicadas.',
    effect_negative_ru: 'Тендинит и разрыв сухожилий, периферическая нейропатия, удлинение QT. Аневризма аорты. ЖКТ-расстройства, C. difficile.',
    effect_negative_en: 'Tendinitis and tendon rupture, peripheral neuropathy, QT prolongation. Aortic aneurysm. GI upset, C. difficile.',
    effect_negative_es: 'Tendinitis y rotura de tendón, neuropatía periférica, prolongación del QT.',
    target_organs_positive: ['kidneys', 'bones'],
    target_organs_negative: ['muscles', 'nervous', 'heart'],
    warning_ru: 'Резервный антибиотик из-за серьёзных рисков. Прекратить при боли в сухожилиях. Избегать у молодых без необходимости.',
    warning_en: 'Reserve antibiotic due to serious risks. Stop if tendon pain. Avoid in the young unless necessary.',
    warning_es: 'Antibiótico de reserva por sus riesgos graves. Suspender ante dolor tendinoso.'
  },

  /* ── Антикоагулянты ────────────────────────────────────────────────── */
  {
    slug: 'warfarin', kind: 'medication', category: 'anticoagulant', sort_order: 120,
    name_ru: 'Варфарин', name_en: 'Warfarin', name_es: 'Warfarina',
    brand_ru: ['Варфарин Никомед', 'Варфарекс'], brand_us: ['Coumadin', 'Jantoven'],
    effect_positive_ru: 'Антагонист витамина K. Снижает свёртываемость, предупреждая тромбозы при фибрилляции предсердий, ТЭЛА, механических клапанах.',
    effect_positive_en: 'Vitamin-K antagonist. Reduces clotting, preventing thrombosis in atrial fibrillation, PE and mechanical valves.',
    effect_positive_es: 'Antagonista de la vitamina K. Reduce la coagulación, previniendo trombosis.',
    effect_negative_ru: 'Кровотечения (в т.ч. внутричерепные). Множество пищевых и лекарственных взаимодействий. Редко — некроз кожи.',
    effect_negative_en: 'Bleeding (incl. intracranial). Many food and drug interactions. Rarely skin necrosis.',
    effect_negative_es: 'Sangrado (incl. intracraneal). Numerosas interacciones.',
    target_organs_positive: ['vessels', 'heart'],
    target_organs_negative: ['vessels', 'brain', 'skin'],
    warning_ru: 'Обязателен регулярный контроль МНО. Стабильное потребление витамина K (зелень). Множество взаимодействий.',
    warning_en: 'Requires regular INR monitoring. Keep vitamin-K intake (greens) steady. Many interactions.',
    warning_es: 'Requiere control regular del INR. Mantener constante la ingesta de vitamina K.'
  },
  {
    slug: 'apixaban', kind: 'medication', category: 'anticoagulant', sort_order: 121,
    name_ru: 'Апиксабан', name_en: 'Apixaban', name_es: 'Apixabán',
    brand_ru: ['Эликвис'], brand_us: ['Eliquis'],
    effect_positive_ru: 'Прямой ингибитор фактора Xa (DOAC). Профилактика инсульта при фибрилляции предсердий, лечение и профилактика тромбозов; не требует контроля МНО.',
    effect_positive_en: 'Direct factor-Xa inhibitor (DOAC). Stroke prevention in atrial fibrillation, treatment/prevention of thrombosis; no INR monitoring.',
    effect_positive_es: 'Inhibidor directo del factor Xa (ACOD). Prevención de ictus en fibrilación auricular.',
    effect_negative_ru: 'Кровотечения. Меньше внутричерепных кровотечений, чем у варфарина. При почечной недостаточности — коррекция дозы.',
    effect_negative_en: 'Bleeding. Fewer intracranial bleeds than warfarin. Dose adjustment in renal impairment.',
    effect_negative_es: 'Sangrado. Menos hemorragias intracraneales que la warfarina.',
    target_organs_positive: ['vessels', 'brain'],
    target_organs_negative: ['vessels', 'stomach'],
    warning_ru: 'Не пропускать дозы (короткое действие). Сообщать о признаках кровотечения. Не отменять самостоятельно.',
    warning_en: 'Do not miss doses (short action). Report bleeding signs. Do not stop on your own.',
    warning_es: 'No omitir dosis. Informar signos de sangrado.'
  },
  {
    slug: 'rivaroxaban', kind: 'medication', category: 'anticoagulant', sort_order: 122,
    name_ru: 'Ривароксабан', name_en: 'Rivaroxaban', name_es: 'Rivaroxabán',
    brand_ru: ['Ксарелто'], brand_us: ['Xarelto'],
    effect_positive_ru: 'Прямой ингибитор фактора Xa (DOAC), приём раз в сутки. Профилактика инсульта при фибрилляции предсердий, лечение ТГВ/ТЭЛА.',
    effect_positive_en: 'Once-daily direct factor-Xa inhibitor (DOAC). Stroke prevention in atrial fibrillation, treatment of DVT/PE.',
    effect_positive_es: 'Inhibidor directo del factor Xa (ACOD), una vez al día.',
    effect_negative_ru: 'Кровотечения. Принимать с едой (всасывание). При почечной недостаточности осторожно.',
    effect_negative_en: 'Bleeding. Take with food (absorption). Caution in renal impairment.',
    effect_negative_es: 'Sangrado. Tomar con alimentos.',
    target_organs_positive: ['vessels', 'brain'],
    target_organs_negative: ['vessels', 'stomach'],
    warning_ru: 'Принимать дозы ≥15 мг с едой. Сообщать о кровотечениях. Не отменять резко.',
    warning_en: 'Take ≥15 mg doses with food. Report bleeding. Do not stop abruptly.',
    warning_es: 'Tomar dosis ≥15 mg con alimentos.'
  },

  /* ── Метаболические ────────────────────────────────────────────────── */
  {
    slug: 'metformin', kind: 'medication', category: 'metabolic', sort_order: 130,
    name_ru: 'Метформин', name_en: 'Metformin', name_es: 'Metformina',
    brand_ru: ['Сиофор', 'Глюкофаж'], brand_us: ['Glucophage', 'Fortamet'],
    effect_positive_ru: 'Бигуанид, первая линия при диабете 2 типа. Снижает выработку глюкозы печенью и повышает чувствительность к инсулину; нейтрален к весу.',
    effect_positive_en: 'Biguanide, first-line for type-2 diabetes. Lowers hepatic glucose output and improves insulin sensitivity; weight-neutral.',
    effect_positive_es: 'Biguanida, primera línea en diabetes tipo 2. Reduce la producción hepática de glucosa.',
    effect_negative_ru: 'ЖКТ: тошнота, диарея, металлический вкус. Снижение B12 при длительном приёме. Редко — лактоацидоз (при почечной недостаточности).',
    effect_negative_en: 'GI: nausea, diarrhoea, metallic taste. B12 reduction with long use. Rarely lactic acidosis (in renal failure).',
    effect_negative_es: 'GI: náuseas, diarrea. Reducción de B12 con uso prolongado.',
    target_organs_positive: ['liver', 'pancreas'],
    target_organs_negative: ['stomach', 'colon'],
    warning_ru: 'Отменять при тяжёлой почечной недостаточности и перед контрастной КТ (лактоацидоз).',
    warning_en: 'Hold in severe renal failure and before contrast CT (lactic acidosis).',
    warning_es: 'Suspender en insuficiencia renal grave y antes de TC con contraste.'
  },
  {
    slug: 'semaglutide', kind: 'medication', category: 'metabolic', sort_order: 131,
    name_ru: 'Семаглутид', name_en: 'Semaglutide', name_es: 'Semaglutida',
    brand_ru: ['Оземпик', 'Вегови'], brand_us: ['Ozempic', 'Wegovy'],
    effect_positive_ru: 'Агонист рецепторов ГПП-1. Снижает сахар, аппетит и вес; защищает сердце и сосуды при диабете 2 типа и ожирении.',
    effect_positive_en: 'GLP-1 receptor agonist. Lowers blood sugar, appetite and weight; cardiovascular protection in type-2 diabetes and obesity.',
    effect_positive_es: 'Agonista del receptor GLP-1. Reduce el azúcar, el apetito y el peso.',
    effect_negative_ru: 'ЖКТ: тошнота, рвота, диарея. Риск панкреатита, желчнокаменной болезни. Гастропарез. Противопоказан при медуллярном раке щитовидной железы.',
    effect_negative_en: 'GI: nausea, vomiting, diarrhoea. Risk of pancreatitis, gallstones. Gastroparesis. Contraindicated in medullary thyroid cancer.',
    effect_negative_es: 'GI: náuseas, vómitos, diarrea. Riesgo de pancreatitis y cálculos biliares.',
    target_organs_positive: ['pancreas', 'heart', 'vessels'],
    target_organs_negative: ['stomach', 'pancreas', 'thyroid'],
    warning_ru: 'Противопоказан при медуллярном раке/МЭН-2 щитовидной железы. Медленное наращивание дозы из-за ЖКТ.',
    warning_en: 'Contraindicated in medullary thyroid cancer/MEN-2. Slow dose escalation due to GI effects.',
    warning_es: 'Contraindicado en cáncer medular de tiroides/MEN-2.'
  },
  {
    slug: 'atorvastatin', kind: 'medication', category: 'metabolic', sort_order: 132,
    name_ru: 'Аторвастатин', name_en: 'Atorvastatin', name_es: 'Atorvastatina',
    brand_ru: ['Аторис', 'Липримар'], brand_us: ['Lipitor'],
    effect_positive_ru: 'Статин. Ингибирует ГМГ-КоА-редуктазу, снижая ЛПНП-холестерин; профилактика инфарктов и инсультов, стабилизация атеросклеротических бляшек.',
    effect_positive_en: 'Statin. Inhibits HMG-CoA reductase, lowering LDL cholesterol; prevents heart attack and stroke, stabilizes plaque.',
    effect_positive_es: 'Estatina. Inhibe la HMG-CoA reductasa, reduciendo el colesterol LDL.',
    effect_negative_ru: 'Мышцы: миалгия, редко рабдомиолиз. Печень: повышение трансаминаз. Небольшой рост сахара крови.',
    effect_negative_en: 'Muscle: myalgia, rarely rhabdomyolysis. Liver: raised transaminases. Small rise in blood sugar.',
    effect_negative_es: 'Músculo: mialgia, raramente rabdomiólisis. Hígado: transaminasas elevadas.',
    target_organs_positive: ['vessels', 'heart', 'liver'],
    target_organs_negative: ['muscles', 'liver'],
    warning_ru: 'Сообщать о необъяснимой мышечной боли. Не сочетать с грейпфрутовым соком в больших количествах.',
    warning_en: 'Report unexplained muscle pain. Avoid large amounts of grapefruit juice.',
    warning_es: 'Informar dolor muscular inexplicado.'
  },

  /* ── Гормоны ───────────────────────────────────────────────────────── */
  {
    slug: 'levothyroxine', kind: 'medication', category: 'hormone', sort_order: 140,
    name_ru: 'Левотироксин', name_en: 'Levothyroxine', name_es: 'Levotiroxina',
    brand_ru: ['L-Тироксин', 'Эутирокс'], brand_us: ['Synthroid', 'Levoxyl'],
    effect_positive_ru: 'Синтетический гормон щитовидной железы (T4). Заместительная терапия при гипотиреозе; восстанавливает обмен веществ, энергию, настроение.',
    effect_positive_en: 'Synthetic thyroid hormone (T4). Replacement therapy for hypothyroidism; restores metabolism, energy and mood.',
    effect_positive_es: 'Hormona tiroidea sintética (T4). Terapia de reemplazo en hipotiroidismo.',
    effect_negative_ru: 'Передозировка имитирует гипертиреоз: тахикардия, тревога, потеря веса, остеопороз, фибрилляция предсердий.',
    effect_negative_en: 'Overdose mimics hyperthyroidism: tachycardia, anxiety, weight loss, osteoporosis, atrial fibrillation.',
    effect_negative_es: 'La sobredosis imita el hipertiroidismo: taquicardia, ansiedad, osteoporosis.',
    target_organs_positive: ['thyroid', 'heart', 'brain'],
    target_organs_negative: ['heart', 'bones'],
    warning_ru: 'Принимать натощак, отдельно от кальция/железа. Подбор дозы по ТТГ. Беременность повышает потребность.',
    warning_en: 'Take fasting, separately from calcium/iron. Titrate by TSH. Pregnancy raises requirement.',
    warning_es: 'Tomar en ayunas, separado de calcio/hierro. Ajustar por TSH.'
  },
  {
    slug: 'estradiol', kind: 'medication', category: 'hormone', sort_order: 141,
    name_ru: 'Эстрадиол', name_en: 'Estradiol', name_es: 'Estradiol',
    brand_ru: ['Дивигель', 'Прогинова'], brand_us: ['Estrace', 'Climara'],
    effect_positive_ru: 'Эстроген. Заместительная гормональная терапия в менопаузе; уменьшает приливы, защищает кости; компонент трансгендерной феминизирующей терапии.',
    effect_positive_en: 'Estrogen. Menopausal hormone therapy; reduces hot flushes, protects bone; component of feminizing gender-affirming care.',
    effect_positive_es: 'Estrógeno. Terapia hormonal en la menopausia; reduce los sofocos y protege el hueso.',
    effect_negative_ru: 'Повышенный риск тромбозов (ТГВ/ТЭЛА), инсульта. Риск рака эндометрия без прогестина, болезненность груди.',
    effect_negative_en: 'Raised risk of thrombosis (DVT/PE), stroke. Endometrial-cancer risk without a progestin, breast tenderness.',
    effect_negative_es: 'Mayor riesgo de trombosis e ictus. Riesgo de cáncer de endometrio sin progestina.',
    target_organs_positive: ['bones', 'vessels', 'brain'],
    target_organs_negative: ['vessels', 'liver'],
    warning_ru: 'Противопоказан при тромбозах в анамнезе и гормонозависимых опухолях. При сохранной матке добавляют прогестин.',
    warning_en: 'Contraindicated with prior thrombosis and hormone-sensitive tumours. Add a progestin if the uterus is intact.',
    warning_es: 'Contraindicado con trombosis previa y tumores hormonodependientes.'
  },
  {
    slug: 'testosterone', kind: 'medication', category: 'hormone', sort_order: 142,
    name_ru: 'Тестостерон', name_en: 'Testosterone', name_es: 'Testosterona',
    brand_ru: ['Андрогель', 'Небидо'], brand_us: ['AndroGel', 'Depo-Testosterone'],
    effect_positive_ru: 'Андроген. Заместительная терапия при гипогонадизме; восстанавливает либидо, мышечную массу, энергию; компонент трансгендерной маскулинизирующей терапии.',
    effect_positive_en: 'Androgen. Replacement therapy for hypogonadism; restores libido, muscle mass, energy; component of masculinizing gender-affirming care.',
    effect_positive_es: 'Andrógeno. Terapia de reemplazo en hipogonadismo; restaura libido y masa muscular.',
    effect_negative_ru: 'Эритроцитоз (густая кровь, тромбозы), акне, апноэ сна. Подавление сперматогенеза, увеличение простаты, перепады настроения.',
    effect_negative_en: 'Erythrocytosis (thick blood, clots), acne, sleep apnoea. Suppressed spermatogenesis, prostate enlargement, mood swings.',
    effect_negative_es: 'Eritrocitosis (sangre espesa, trombos), acné, apnea del sueño.',
    target_organs_positive: ['muscles', 'bones', 'brain'],
    target_organs_negative: ['vessels', 'skin'],
    warning_ru: 'Контроль гематокрита, ПСА. Противопоказан при раке простаты/груди. Беречь от контакта геля с другими людьми.',
    warning_en: 'Monitor haematocrit and PSA. Contraindicated in prostate/breast cancer. Avoid gel transfer to others.',
    warning_es: 'Vigilar hematocrito y PSA. Contraindicado en cáncer de próstata/mama.'
  },

  {
    slug: 'hydroxychloroquine', kind: 'medication', category: 'immunosuppressant', sort_order: 14,
    name_ru: 'Гидроксихлорохин', name_en: 'Hydroxychloroquine', name_es: 'Hidroxicloroquina',
    brand_ru: ['Плаквенил'], brand_us: ['Plaquenil'],
    effect_positive_ru: 'Противомалярийный и базисный антиревматический препарат. Мягко модулирует иммунитет; основа терапии системной красной волчанки и ревматоидного артрита, снижает обострения и поражение органов.',
    effect_positive_en: 'Antimalarial and disease-modifying antirheumatic drug. Gently modulates immunity; a cornerstone of lupus and rheumatoid-arthritis therapy, reducing flares and organ damage.',
    effect_positive_es: 'Antipalúdico y FARME. Modula suavemente la inmunidad; pilar del tratamiento del lupus y la artritis reumatoide.',
    effect_negative_ru: 'Глаза: ретинопатия при длительном приёме (нужен контроль офтальмолога). ЖКТ-расстройства, сыпь. Редко — кардиомиопатия, удлинение QT.',
    effect_negative_en: 'Eyes: retinopathy with long-term use (needs ophthalmic monitoring). GI upset, rash. Rarely cardiomyopathy, QT prolongation.',
    effect_negative_es: 'Ojos: retinopatía con uso prolongado (requiere control oftalmológico). Molestias GI, erupción.',
    target_organs_positive: ['joints', 'skin', 'kidneys'],
    target_organs_negative: ['heart'],
    warning_ru: 'Регулярный осмотр глаз (риск необратимой ретинопатии). Контроль дозы по массе тела.',
    warning_en: 'Regular eye exams (irreversible retinopathy risk). Dose by body weight.',
    warning_es: 'Exámenes oculares regulares (riesgo de retinopatía irreversible).'
  },
  {
    slug: 'gabapentin', kind: 'medication', category: 'antiepileptic', sort_order: 93,
    name_ru: 'Габапентин', name_en: 'Gabapentin', name_es: 'Gabapentina',
    brand_ru: ['Нейронтин', 'Конвалис'], brand_us: ['Neurontin', 'Gralise'],
    effect_positive_ru: 'Противоэпилептический препарат и средство при нейропатической боли. Связывается с α2δ-субъединицей кальциевых каналов; при невралгиях, фибромиалгии, тревоге как дополнение.',
    effect_positive_en: 'Antiepileptic and neuropathic-pain agent. Binds the α2δ calcium-channel subunit; for neuralgia, fibromyalgia and adjunctive anxiety.',
    effect_positive_es: 'Antiepiléptico y para el dolor neuropático. Se une a la subunidad α2δ de los canales de calcio.',
    effect_negative_ru: 'Сонливость, головокружение, отёки, набор веса. При резкой отмене — синдром отмены. Потенциал злоупотребления, опасен с опиоидами (угнетение дыхания).',
    effect_negative_en: 'Somnolence, dizziness, oedema, weight gain. Withdrawal on abrupt stop. Misuse potential, dangerous with opioids (respiratory depression).',
    effect_negative_es: 'Somnolencia, mareo, edema, aumento de peso. Síndrome de abstinencia al suspender bruscamente.',
    target_organs_positive: ['brain', 'nervous'],
    target_organs_negative: ['brain'],
    warning_ru: 'Снижать дозу постепенно. Осторожно с опиоидами (угнетение дыхания) и при болезнях почек.',
    warning_en: 'Taper gradually. Caution with opioids (respiratory depression) and in renal disease.',
    warning_es: 'Reducir gradualmente. Precaución con opioides y en enfermedad renal.'
  },

  /* ════ ПСИХОАКТИВНЫЕ ВЕЩЕСТВА (harm-reduction / образование) ════════ */
  {
    slug: 'cannabis', kind: 'substance', category: 'cannabinoid', sort_order: 200,
    name_ru: 'Каннабис (марихуана/гашиш)', name_en: 'Cannabis (marijuana/hashish)', name_es: 'Cannabis (marihuana/hachís)',
    brand_ru: [], brand_us: [],
    effect_positive_ru: 'ТГК действует на каннабиноидные рецепторы CB1 мозга: эйфория, расслабление, обострение чувств, рост аппетита. КБД — без опьянения, с противотревожным и противосудорожным потенциалом. Медицински: хроническая боль, тошнота при химиотерапии, спастичность, отдельные формы эпилепсии.',
    effect_positive_en: 'THC acts on brain CB1 cannabinoid receptors: euphoria, relaxation, sensory enhancement, increased appetite. CBD is non-intoxicating with anxiolytic and anticonvulsant potential. Medically: chronic pain, chemo nausea, spasticity, some epilepsies.',
    effect_positive_es: 'El THC actúa sobre los receptores CB1 del cerebro: euforia, relajación, aumento del apetito. El CBD no es intoxicante. Médicamente: dolor crónico, náuseas por quimioterapia, espasticidad.',
    effect_negative_ru: 'Острое: тревога, паранойя, тахикардия, нарушение координации и памяти. Хроническое: снижение мотивации, ухудшение памяти, бронхит при курении; у предрасположенных может провоцировать психоз. Развитие зависимости (~9%), синдром отмены.',
    effect_negative_en: 'Acute: anxiety, paranoia, tachycardia, impaired coordination and memory. Chronic: reduced motivation, memory decline, bronchitis from smoking; may trigger psychosis in the predisposed. Dependence (~9%), withdrawal syndrome.',
    effect_negative_es: 'Agudo: ansiedad, paranoia, taquicardia, deterioro de memoria. Crónico: menor motivación, bronquitis al fumar; puede desencadenar psicosis en predispuestos. Dependencia (~9%).',
    target_organs_positive: ['brain', 'nervous'],
    target_organs_negative: ['brain', 'lungs', 'heart'],
    warning_ru: 'Harm-reduction: избегать в подростковом возрасте (развивающийся мозг), при личной/семейной истории психозов и беременности. Не курить — испаряй или используй настойки; не водить под действием; начинай с малых доз («start low, go slow»); не сочетать с алкоголем. Зависимость реальна.',
    warning_en: 'Harm-reduction: avoid in adolescence (developing brain), with a personal/family history of psychosis, and in pregnancy. Don’t smoke — vaporize or use tinctures; don’t drive while affected; start low and go slow; avoid mixing with alcohol. Dependence is real.',
    warning_es: 'Reducción de daños: evitar en la adolescencia, con antecedentes de psicosis y en el embarazo. No fumar — vaporizar; no conducir; empezar con dosis bajas. La dependencia es real.'
  },
  {
    slug: 'ketamine', kind: 'substance', category: 'dissociative', sort_order: 201,
    name_ru: 'Кетамин', name_en: 'Ketamine', name_es: 'Ketamina',
    brand_ru: [], brand_us: [],
    effect_positive_ru: 'Диссоциативный анестетик, антагонист NMDA-рецепторов. Медицински: анестезия, а в малых дозах — быстрый антидепрессант при резистентной депрессии и суицидальности (под контролем врача). Вызывает ощущение отделённости от тела.',
    effect_positive_en: 'Dissociative anaesthetic, NMDA-receptor antagonist. Medically: anaesthesia, and at low dose a rapid antidepressant for treatment-resistant depression and suicidality (clinically supervised). Produces a sense of detachment from the body.',
    effect_positive_es: 'Anestésico disociativo, antagonista NMDA. Médicamente: anestesia y, a dosis bajas, antidepresivo rápido supervisado.',
    effect_negative_ru: 'Острое: дезориентация, «K-hole», тошнота, повышение АД. Хроническое: тяжёлое поражение мочевого пузыря (кетаминовый цистит), проблемы с памятью, психологическая зависимость. Опасность при сочетании с депрессантами.',
    effect_negative_en: 'Acute: disorientation, the “K-hole”, nausea, raised blood pressure. Chronic: severe bladder damage (ketamine cystitis), memory problems, psychological dependence. Dangerous with other depressants.',
    effect_negative_es: 'Agudo: desorientación, náuseas, presión alta. Crónico: daño vesical grave (cistitis por ketamina), problemas de memoria, dependencia psicológica.',
    target_organs_positive: ['brain', 'nervous'],
    target_organs_negative: ['kidneys', 'brain'],
    warning_ru: 'Harm-reduction: смертельно при сочетании с алкоголем/опиоидами/бензодиазепинами (угнетение дыхания). Не использовать в одиночку; риск травм и аспирации. Частое применение разрушает мочевой пузырь. Терапевтический кетамин — только под наблюдением врача.',
    warning_en: 'Harm-reduction: dangerous combined with alcohol/opioids/benzodiazepines (respiratory depression). Don’t use alone; risk of injury and aspiration. Frequent use destroys the bladder. Therapeutic ketamine only under medical supervision.',
    warning_es: 'Reducción de daños: peligroso con alcohol/opioides/benzodiacepinas. No usar a solas. El uso frecuente daña la vejiga.'
  },
  {
    slug: 'psilocybin', kind: 'substance', category: 'psychedelic', sort_order: 202,
    name_ru: 'Псилоцибин (грибы)', name_en: 'Psilocybin (mushrooms)', name_es: 'Psilocibina (hongos)',
    brand_ru: [], brand_us: [],
    effect_positive_ru: 'Классический психоделик, агонист серотониновых 5-HT2A рецепторов. Изменение восприятия, эмоций и мышления, ощущение единства. Изучается как прорывная терапия депрессии, ПТСР, тревоги в конце жизни и зависимостей (в клинических условиях).',
    effect_positive_en: 'Classic psychedelic, serotonin 5-HT2A agonist. Alters perception, emotion and thought, with a sense of unity. Studied as breakthrough therapy for depression, PTSD, end-of-life anxiety and addiction (in clinical settings).',
    effect_positive_es: 'Psicodélico clásico, agonista 5-HT2A. Altera la percepción y la emoción. Se estudia como terapia para depresión y TEPT en entornos clínicos.',
    effect_negative_ru: 'Острое: «плохой трип» — тревога, страх, спутанность; тошнота, расширение зрачков, рост АД. Риск опасного поведения. У предрасположенных может спровоцировать длительные психические нарушения. Опасность ошибочного сбора ядовитых грибов.',
    effect_negative_en: 'Acute: a “bad trip” — anxiety, fear, confusion; nausea, dilated pupils, raised blood pressure. Risk of dangerous behaviour. May trigger lasting psychiatric issues in the predisposed. Risk of misidentifying poisonous mushrooms.',
    effect_negative_es: 'Agudo: «mal viaje» — ansiedad, miedo, confusión. Puede desencadenar problemas psiquiátricos en predispuestos. Riesgo de confundir hongos venenosos.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['brain'],
    warning_ru: 'Harm-reduction: противопоказан при личной/семейной истории психозов и биполярного расстройства. Важны «set and setting», трезвый сопровождающий, безопасное место. Не сочетать с литием/трамадолом (судороги) и СИОЗС. Физически малотоксичен, но психологически рискован.',
    warning_en: 'Harm-reduction: avoid with a personal/family history of psychosis or bipolar disorder. “Set and setting”, a sober sitter and a safe place matter. Don’t mix with lithium/tramadol (seizures) or SSRIs. Low physical toxicity but real psychological risk.',
    warning_es: 'Reducción de daños: evitar con antecedentes de psicosis o bipolaridad. Importan el «set and setting» y un acompañante sobrio. No mezclar con litio.'
  },
  {
    slug: 'lsd', kind: 'substance', category: 'psychedelic', sort_order: 203,
    name_ru: 'ЛСД', name_en: 'LSD', name_es: 'LSD',
    brand_ru: [], brand_us: [],
    effect_positive_ru: 'Мощный синтетический психоделик, агонист 5-HT2A. Длительные (8–12 ч) изменения восприятия, синестезия, творческие и интроспективные переживания. Исследуется при тревоге, депрессии, зависимостях.',
    effect_positive_en: 'Potent synthetic psychedelic, 5-HT2A agonist. Long (8–12 h) perceptual changes, synaesthesia, creative and introspective experiences. Researched for anxiety, depression, addiction.',
    effect_positive_es: 'Psicodélico sintético potente, agonista 5-HT2A. Cambios perceptivos largos (8–12 h), sinestesia.',
    effect_negative_ru: 'Острое: тревога, паника, спутанность, рост АД и температуры. Риск опасного поведения. Редко — длительные перцептивные расстройства (HPPD). Может спровоцировать психоз у предрасположенных. Высок риск подделок (NBOMe).',
    effect_negative_en: 'Acute: anxiety, panic, confusion, raised blood pressure and temperature. Risk of dangerous behaviour. Rarely lasting perceptual disorder (HPPD). May trigger psychosis in the predisposed. High risk of fakes (NBOMe).',
    effect_negative_es: 'Agudo: ansiedad, pánico, confusión. Raramente HPPD. Alto riesgo de falsificaciones (NBOMe).',
    target_organs_positive: ['brain'],
    target_organs_negative: ['brain'],
    warning_ru: 'Harm-reduction: тестируй вещество (риск смертельного NBOMe), начинай с малой дозы, нужен трезвый сопровождающий и безопасное место. Противопоказан при психозах/биполярном расстройстве. Не сочетать с литием. Долгое действие — не за рулём.',
    warning_en: 'Harm-reduction: test your substance (deadly NBOMe risk), start with a low dose, have a sober sitter and a safe place. Avoid with psychosis/bipolar disorder. Don’t mix with lithium. Long duration — never drive.',
    warning_es: 'Reducción de daños: testear la sustancia (riesgo de NBOMe mortal), dosis baja, acompañante sobrio. Evitar con psicosis/bipolaridad.'
  },
  {
    slug: 'mdma', kind: 'substance', category: 'empathogen', sort_order: 204,
    name_ru: 'МДМА (экстази)', name_en: 'MDMA (ecstasy)', name_es: 'MDMA (éxtasis)',
    brand_ru: [], brand_us: [],
    effect_positive_ru: 'Эмпатоген, мощно высвобождает серотонин (и дофамин/норадреналин). Чувство близости, эмпатии, эйфории, прилив энергии. Изучается в психотерапии ПТСР под контролем (MAPS).',
    effect_positive_en: 'Empathogen that strongly releases serotonin (plus dopamine/noradrenaline). Feelings of closeness, empathy, euphoria and energy. Studied in supervised PTSD psychotherapy (MAPS).',
    effect_positive_es: 'Empatógeno que libera serotonina. Sensación de cercanía, empatía y euforia. Se estudia en psicoterapia supervisada del TEPT.',
    effect_negative_ru: 'Острое: гипертермия, обезвоживание ИЛИ водная интоксикация, бруксизм, рост АД и ЧСС; риск серотонинового синдрома. «Похмелье» 2–3 дня (упадок настроения). Хроническое: нейротоксичность, проблемы памяти и настроения. Частые подделки.',
    effect_negative_en: 'Acute: hyperthermia, dehydration OR water intoxication, jaw clenching, raised blood pressure and heart rate; serotonin-syndrome risk. A 2–3 day “comedown” (low mood). Chronic: neurotoxicity, memory and mood problems. Often adulterated.',
    effect_negative_es: 'Agudo: hipertermia, deshidratación o intoxicación por agua, bruxismo; riesgo de síndrome serotoninérgico. «Bajón» de 2–3 días. Crónico: neurotoxicidad.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['brain', 'heart', 'liver', 'kidneys'],
    warning_ru: 'Harm-reduction: тестируй (часто содержит другие вещества), не сочетай с СИОЗС/ИМАО (серотониновый синдром). Контролируй температуру и питьё (≈500 мл/час, не больше), делай перерывы. Смертельно опасно при болезнях сердца. Большие перерывы между приёмами.',
    warning_en: 'Harm-reduction: test it (often adulterated), don’t mix with SSRIs/MAOIs (serotonin syndrome). Manage temperature and hydration (~500 ml/hour, no more), take breaks to cool down. Dangerous with heart disease. Space doses widely apart.',
    warning_es: 'Reducción de daños: testear, no mezclar con ISRS/IMAO. Controlar temperatura e hidratación (~500 ml/hora). Peligroso con cardiopatías.'
  },
  {
    slug: 'cocaine', kind: 'substance', category: 'stimulant', sort_order: 205,
    name_ru: 'Кокаин', name_en: 'Cocaine', name_es: 'Cocaína',
    brand_ru: [], brand_us: [],
    effect_positive_ru: 'Стимулятор, блокирует обратный захват дофамина. Кратковременная эйфория, прилив энергии, уверенности, снижение усталости. Эффект короткий (~30 мин), что подталкивает к повторным приёмам.',
    effect_positive_en: 'Stimulant that blocks dopamine reuptake. Brief euphoria, surge of energy and confidence, reduced fatigue. The short effect (~30 min) drives repeated dosing.',
    effect_positive_es: 'Estimulante que bloquea la recaptación de dopamina. Euforia breve, energía y confianza.',
    effect_negative_ru: 'Острое: тахикардия, рост АД, риск инфаркта, инсульта, аритмии и судорог даже у молодых. Хроническое: разрушение носовой перегородки, сильная зависимость, паранойя, депрессия. Передозировка смертельна, особенно с примесями (фентанил).',
    effect_negative_en: 'Acute: tachycardia, raised blood pressure, risk of heart attack, stroke, arrhythmia and seizures even in the young. Chronic: nasal-septum destruction, strong addiction, paranoia, depression. Overdose is fatal, especially with adulterants (fentanyl).',
    effect_negative_es: 'Agudo: taquicardia, riesgo de infarto, ictus y convulsiones. Crónico: destrucción del tabique nasal, adicción fuerte. Sobredosis mortal (fentanilo).',
    target_organs_positive: ['brain'],
    target_organs_negative: ['heart', 'vessels', 'brain', 'nervous'],
    warning_ru: 'Harm-reduction: крайне высок риск зависимости и внезапной сердечной смерти. Смертельно с алкоголем (кокаэтилен) и опиоидами. Тестируй на фентанил, никогда не употребляй в одиночку, имей налоксон рядом. Лучший выбор для здоровья — не начинать.',
    warning_en: 'Harm-reduction: very high risk of addiction and sudden cardiac death. Deadly with alcohol (cocaethylene) and opioids. Test for fentanyl, never use alone, keep naloxone nearby. The healthiest choice is not to start.',
    warning_es: 'Reducción de daños: altísimo riesgo de adicción y muerte súbita cardíaca. Mortal con alcohol y opioides. Testear fentanilo.'
  },
  {
    slug: 'amphetamine', kind: 'substance', category: 'stimulant', sort_order: 206,
    name_ru: 'Амфетамин', name_en: 'Amphetamine', name_es: 'Anfetamina',
    brand_ru: [], brand_us: [],
    effect_positive_ru: 'Стимулятор, высвобождает дофамин и норадреналин. Бодрость, концентрация, подавление аппетита и усталости, эйфория. (Фармацевтические формы под контролем применяются при СДВГ и нарколепсии.)',
    effect_positive_en: 'Stimulant that releases dopamine and noradrenaline. Alertness, focus, appetite and fatigue suppression, euphoria. (Controlled pharmaceutical forms treat ADHD and narcolepsy.)',
    effect_positive_es: 'Estimulante que libera dopamina y noradrenalina. Estado de alerta, concentración, euforia.',
    effect_negative_ru: 'Острое: тахикардия, рост АД, гипертермия, тревога, психоз. Хроническое: бессонница, истощение, разрушение зубов («мет-рот» у метамфетамина), сильная зависимость, депрессия при отмене. Нелегальные формы часто загрязнены.',
    effect_negative_en: 'Acute: tachycardia, raised blood pressure, hyperthermia, anxiety, psychosis. Chronic: insomnia, exhaustion, tooth decay (“meth mouth” with methamphetamine), strong addiction, withdrawal depression. Illicit forms are often contaminated.',
    effect_negative_es: 'Agudo: taquicardia, hipertermia, ansiedad, psicosis. Crónico: insomnio, deterioro dental, adicción fuerte.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['heart', 'vessels', 'brain', 'skin'],
    warning_ru: 'Harm-reduction: высокий потенциал зависимости и психоза. Следи за гидратацией и температурой, не сочетай с другими стимуляторами/ИМАО. Уличные формы непредсказуемы (риск фентанила) — тестируй. Высыпайся и ешь.',
    warning_en: 'Harm-reduction: high risk of addiction and psychosis. Watch hydration and temperature, don’t mix with other stimulants/MAOIs. Street forms are unpredictable (fentanyl risk) — test them. Sleep and eat.',
    warning_es: 'Reducción de daños: alto riesgo de adicción y psicosis. Vigilar hidratación y temperatura. Las formas callejeras son impredecibles.'
  },
  {
    slug: 'alcohol', kind: 'substance', category: 'depressant', sort_order: 207,
    name_ru: 'Алкоголь', name_en: 'Alcohol', name_es: 'Alcohol',
    brand_ru: [], brand_us: [],
    effect_positive_ru: 'Депрессант ЦНС, усиливает ГАМК и подавляет глутамат. Расслабление, снижение тревоги, общительность, лёгкая эйфория в малых дозах. Легальный и культурно нормализованный, что маскирует риски.',
    effect_positive_en: 'CNS depressant that enhances GABA and suppresses glutamate. Relaxation, lower anxiety, sociability, mild euphoria at low doses. Legal and culturally normalized, which masks its risks.',
    effect_positive_es: 'Depresor del SNC que potencia el GABA. Relajación, sociabilidad, euforia leve a dosis bajas.',
    effect_negative_ru: 'Острое: нарушение координации и суждений, рвота, риск отравления и аспирации. Хроническое: цирроз печени, панкреатит, кардиомиопатия, повреждение мозга, ≥7 видов рака, тяжёлая зависимость. Смертельный синдром отмены (делирий).',
    effect_negative_en: 'Acute: impaired coordination and judgement, vomiting, risk of poisoning and aspiration. Chronic: liver cirrhosis, pancreatitis, cardiomyopathy, brain damage, ≥7 cancers, severe dependence. Withdrawal can be fatal (delirium tremens).',
    effect_negative_es: 'Agudo: deterioro de coordinación, vómitos, riesgo de intoxicación. Crónico: cirrosis, pancreatitis, daño cerebral, varios cánceres, dependencia. Abstinencia mortal (delírium trémens).',
    target_organs_positive: ['brain'],
    target_organs_negative: ['liver', 'pancreas', 'brain', 'heart', 'stomach'],
    warning_ru: 'Harm-reduction: безопасной дозы не существует, но риск снижают умеренность, дни без алкоголя, еда и вода, отказ за рулём. Смертельно с бензодиазепинами/опиоидами. При зависимости отмену проводят под наблюдением врача (риск смерти).',
    warning_en: 'Harm-reduction: no level is truly safe, but moderation, alcohol-free days, food and water, and never driving cut the risk. Deadly with benzodiazepines/opioids. In dependence, withdrawal must be medically supervised (risk of death).',
    warning_es: 'Reducción de daños: ninguna dosis es totalmente segura. Moderación, días sin alcohol, comida y agua. Mortal con benzodiacepinas/opioides.'
  },
  {
    slug: 'nicotine', kind: 'substance', category: 'stimulant', sort_order: 208,
    name_ru: 'Никотин / табак', name_en: 'Nicotine / tobacco', name_es: 'Nicotina / tabaco',
    brand_ru: [], brand_us: [],
    effect_positive_ru: 'Стимулятор, агонист никотиновых ацетилхолиновых рецепторов. Кратковременная концентрация, бодрость, снижение тревоги и аппетита. Эффект очень короткий и быстро формирует зависимость.',
    effect_positive_en: 'Stimulant, nicotinic acetylcholine-receptor agonist. Brief focus, alertness, lower anxiety and appetite. The effect is very short and rapidly addictive.',
    effect_positive_es: 'Estimulante, agonista de receptores nicotínicos. Concentración breve, menor ansiedad y apetito.',
    effect_negative_ru: 'Сам никотин: тахикардия, рост АД, сужение сосудов, сильнейшая зависимость. Курение табака: рак лёгких и др. органов, ХОБЛ, инфаркты и инсульты — ведущая предотвратимая причина смерти. Вейпинг безопаснее курения, но не безвреден.',
    effect_negative_en: 'Nicotine itself: tachycardia, raised blood pressure, vasoconstriction, intense addiction. Smoking tobacco: lung and other cancers, COPD, heart attack and stroke — the leading preventable cause of death. Vaping is safer than smoking but not harmless.',
    effect_negative_es: 'Nicotina: taquicardia, vasoconstricción, adicción intensa. Fumar: cáncer de pulmón, EPOC, infartos — principal causa de muerte evitable.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['lungs', 'heart', 'vessels'],
    warning_ru: 'Harm-reduction: бросить — лучшее решение; помогает никотинзаместительная терапия, варениклин, бупропион. Если не бросаешь — переход с курения на вейп/НЗТ снижает вред. Опасен при беременности и болезнях сердца.',
    warning_en: 'Harm-reduction: quitting is best; nicotine-replacement therapy, varenicline and bupropion help. If you won’t quit, switching from smoking to vaping/NRT reduces harm. Dangerous in pregnancy and heart disease.',
    warning_es: 'Reducción de daños: dejarlo es lo mejor; ayudan la terapia de reemplazo, vareniclina y bupropión. Peligroso en el embarazo.'
  },
  {
    slug: 'caffeine', kind: 'substance', category: 'stimulant', sort_order: 209,
    name_ru: 'Кофеин', name_en: 'Caffeine', name_es: 'Cafeína',
    brand_ru: [], brand_us: [],
    effect_positive_ru: 'Лёгкий стимулятор, блокирует аденозиновые рецепторы. Бодрость, концентрация, снижение усталости, лёгкий подъём настроения и выносливости. Легальный, самый распространённый психоактивный препарат — для контраста.',
    effect_positive_en: 'Mild stimulant that blocks adenosine receptors. Alertness, focus, less fatigue, slight mood and endurance boost. Legal and the world’s most common psychoactive drug — included for contrast.',
    effect_positive_es: 'Estimulante suave que bloquea los receptores de adenosina. Estado de alerta, concentración, menos fatiga.',
    effect_negative_ru: 'Избыток: тревога, тахикардия, тремор, бессонница, расстройство ЖКТ. Формируется привыкание; отмена даёт головную боль и усталость. Очень высокие дозы (порошки/энергетики) опасны для сердца.',
    effect_negative_en: 'Excess: anxiety, tachycardia, tremor, insomnia, GI upset. Tolerance develops; withdrawal causes headache and fatigue. Very high doses (powders/energy drinks) are dangerous for the heart.',
    effect_negative_es: 'Exceso: ansiedad, taquicardia, temblor, insomnio. Genera tolerancia; la abstinencia causa cefalea.',
    target_organs_positive: ['brain'],
    target_organs_negative: ['heart', 'stomach'],
    warning_ru: 'Harm-reduction: до ~400 мг/сут обычно безопасно для взрослых, меньше при беременности. Не пить поздно (сон). Осторожно с порошковым кофеином и сочетанием с другими стимуляторами.',
    warning_en: 'Harm-reduction: up to ~400 mg/day is generally safe for adults, less in pregnancy. Avoid late in the day (sleep). Be careful with powdered caffeine and combining with other stimulants.',
    warning_es: 'Reducción de daños: hasta ~400 mg/día suele ser seguro en adultos, menos en el embarazo. Evitar a última hora.'
  }
];

// diagnosis_slug -> [{ slug, is_primary }]  (diagnosis slugs from anatomy_conditions;
// includes PR#115 additions — unknown slugs are simply ignored at render time).
const DIAG_LINKS = {
  // Keyed by REAL human_conditions.slug (verified against the live catalog). Slugs
  // absent from the catalog (autoimmune rheumatology, hormone replacement) simply
  // have no cross-link — their med cards just omit the "Prescribed for" section.
  'depression': [
    { slug: 'sertraline', is_primary: true }, { slug: 'escitalopram', is_primary: true },
    { slug: 'venlafaxine', is_primary: false }, { slug: 'bupropion', is_primary: false },
    { slug: 'mirtazapine', is_primary: false }
  ],
  'gad': [
    { slug: 'escitalopram', is_primary: true }, { slug: 'venlafaxine', is_primary: true },
    { slug: 'sertraline', is_primary: false }, { slug: 'alprazolam', is_primary: false },
    { slug: 'clonazepam', is_primary: false }
  ],
  'ocd': [
    { slug: 'sertraline', is_primary: true }, { slug: 'escitalopram', is_primary: false }
  ],
  'ptsd': [
    { slug: 'sertraline', is_primary: true }, { slug: 'mirtazapine', is_primary: false }
  ],
  'bipolar': [
    { slug: 'lithium', is_primary: true }, { slug: 'lamotrigine', is_primary: true },
    { slug: 'valproate', is_primary: false }, { slug: 'quetiapine', is_primary: false },
    { slug: 'olanzapine', is_primary: false }
  ],
  'schizophrenia': [
    { slug: 'risperidone', is_primary: true }, { slug: 'olanzapine', is_primary: true },
    { slug: 'quetiapine', is_primary: false }
  ],
  'bpd': [
    { slug: 'quetiapine', is_primary: false }, { slug: 'lamotrigine', is_primary: false }
  ],
  'adhd': [
    { slug: 'methylphenidate', is_primary: true }, { slug: 'lisdexamfetamine', is_primary: true },
    { slug: 'atomoxetine', is_primary: false }, { slug: 'bupropion', is_primary: false }
  ],
  'epilepsy': [
    { slug: 'levetiracetam', is_primary: true }, { slug: 'lamotrigine', is_primary: true },
    { slug: 'valproate', is_primary: false }, { slug: 'carbamazepine', is_primary: false },
    { slug: 'topiramate', is_primary: false }, { slug: 'gabapentin', is_primary: false }
  ],
  'migraine': [
    { slug: 'topiramate', is_primary: true }, { slug: 'valproate', is_primary: false },
    { slug: 'naproxen', is_primary: false }, { slug: 'gabapentin', is_primary: false }
  ],
  'insomnia': [
    { slug: 'mirtazapine', is_primary: true }, { slug: 'quetiapine', is_primary: false }
  ],
  'gerd': [
    { slug: 'omeprazole', is_primary: true }, { slug: 'esomeprazole', is_primary: true },
    { slug: 'pantoprazole', is_primary: false }
  ],
  'gastritis': [
    { slug: 'omeprazole', is_primary: true }, { slug: 'pantoprazole', is_primary: false }
  ],
  'crohns': [
    { slug: 'infliximab', is_primary: true }, { slug: 'adalimumab', is_primary: true },
    { slug: 'azathioprine', is_primary: false }, { slug: 'methotrexate', is_primary: false },
    { slug: 'prednisolone', is_primary: false }
  ],
  'type2-diabetes': [
    { slug: 'metformin', is_primary: true }, { slug: 'semaglutide', is_primary: true },
    { slug: 'atorvastatin', is_primary: false }
  ],
  'hypothyroidism': [
    { slug: 'levothyroxine', is_primary: true }
  ],
  'coronary-artery-disease': [
    { slug: 'atorvastatin', is_primary: true }, { slug: 'apixaban', is_primary: false }
  ],
  'stroke': [
    { slug: 'atorvastatin', is_primary: true }, { slug: 'apixaban', is_primary: true },
    { slug: 'rivaroxaban', is_primary: false }, { slug: 'warfarin', is_primary: false }
  ],
  'copd': [
    { slug: 'prednisolone', is_primary: true }, { slug: 'amoxicillin-clavulanate', is_primary: false },
    { slug: 'doxycycline', is_primary: false }
  ],
  'asthma': [
    { slug: 'prednisolone', is_primary: true }, { slug: 'methylprednisolone', is_primary: false }
  ],
  'multiple-sclerosis': [
    { slug: 'methylprednisolone', is_primary: true }
  ],
  'hip-osteoarthritis': [
    { slug: 'ibuprofen', is_primary: true }, { slug: 'naproxen', is_primary: false },
    { slug: 'celecoxib', is_primary: false }
  ],
  'disc-herniation': [
    { slug: 'ibuprofen', is_primary: true }, { slug: 'naproxen', is_primary: false },
    { slug: 'gabapentin', is_primary: false }
  ],
  'spinal-osteochondrosis': [
    { slug: 'ibuprofen', is_primary: true }, { slug: 'naproxen', is_primary: false }
  ],
  'endometriosis': [
    { slug: 'naproxen', is_primary: true }, { slug: 'ibuprofen', is_primary: false }
  ],
  'mastitis': [
    { slug: 'amoxicillin-clavulanate', is_primary: true }
  ]
};

module.exports = { MEDICATIONS, DIAG_LINKS };
