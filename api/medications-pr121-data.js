// PR#121 supplementary medication data — kept separate from medications-seed.js to
// keep that file focused on the base catalog. Two exports:
//   DIAG_LINKS_EXT — extra clinically-accurate diagnosis→medication links (mig049).
//     diagnosis slugs are real human_conditions slugs + the 12 PR#115 catalog slugs;
//     medication slugs are the 60 in the base seed. Standard-of-care / FDA-indicated
//     only — the 60-drug formulary structurally caps honest coverage (~172 pairs), so
//     we DO NOT pad with fabricated pairings.
//   ORGAN_EFFECTS — per-organ effect descriptions for the Meds 3D tooltip (mig048).
//     Keys are BodyAtlas organ-slugs incl. brain sub-regions (brain_memory_hippocampus,
//     brain_emotion_amygdala, brain_serotonergic, …) used to SPLIT the brain for
//     psychoactive substances. effect = 'positive'|'negative' drives green/red.

const DIAG_LINKS_EXT = {
  adhd: [
    { slug: 'methylphenidate', is_primary: true, notes: 'Первая линия, психостимулятор' },
    { slug: 'lisdexamfetamine', is_primary: true, notes: 'Первая линия, пролекарство амфетамина' },
    { slug: 'amphetamine', is_primary: true, notes: 'Психостимулятор первой линии' },
    { slug: 'atomoxetine', is_primary: false, notes: 'Нестимулятор, ингибитор захвата НА' },
    { slug: 'bupropion', is_primary: false, notes: 'Off-label, нестимулятор' }
  ],
  'allergic-rhinitis': [
    { slug: 'prednisolone', is_primary: false, notes: 'Короткий курс при тяжёлом обострении' },
    { slug: 'methylprednisolone', is_primary: false, notes: 'Системно при тяжёлом обострении' }
  ],
  asthma: [
    { slug: 'prednisolone', is_primary: true, notes: 'Системно при обострении' },
    { slug: 'methylprednisolone', is_primary: true, notes: 'Системно при тяжёлом обострении' }
  ],
  copd: [
    { slug: 'prednisolone', is_primary: true, notes: 'Системно при обострении' },
    { slug: 'methylprednisolone', is_primary: false, notes: 'Системно при тяжёлом обострении' },
    { slug: 'doxycycline', is_primary: false, notes: 'Антибиотик при инфекционном обострении' },
    { slug: 'amoxicillin-clavulanate', is_primary: false, notes: 'Антибиотик при инфекционном обострении' }
  ],
  crohns: [
    { slug: 'infliximab', is_primary: true, notes: 'Биологическая терапия, анти-ФНО' },
    { slug: 'adalimumab', is_primary: true, notes: 'Биологическая терапия, анти-ФНО' },
    { slug: 'azathioprine', is_primary: true, notes: 'Иммуносупрессор, поддержание ремиссии' },
    { slug: 'methotrexate', is_primary: false, notes: 'Иммуносупрессор, поддержание ремиссии' },
    { slug: 'prednisolone', is_primary: true, notes: 'Системно для индукции ремиссии' },
    { slug: 'methylprednisolone', is_primary: false, notes: 'Системно при тяжёлом обострении' }
  ],
  depression: [
    { slug: 'sertraline', is_primary: true, notes: 'Первая линия, СИОЗС' },
    { slug: 'escitalopram', is_primary: true, notes: 'Первая линия, СИОЗС' },
    { slug: 'venlafaxine', is_primary: true, notes: 'СИОЗСН' },
    { slug: 'bupropion', is_primary: true, notes: 'Ингибитор захвата НА/дофамина' },
    { slug: 'mirtazapine', is_primary: false, notes: 'Норадренергический, при бессоннице' },
    { slug: 'quetiapine', is_primary: false, notes: 'Аугментация при резистентности' },
    { slug: 'lithium', is_primary: false, notes: 'Аугментация при резистентности' },
    { slug: 'ketamine', is_primary: false, notes: 'Резистентная депрессия, эскетамин' },
    { slug: 'psilocybin', is_primary: false, notes: 'Исследуется, экспериментально' }
  ],
  gad: [
    { slug: 'escitalopram', is_primary: true, notes: 'Первая линия, СИОЗС' },
    { slug: 'venlafaxine', is_primary: true, notes: 'Первая линия, СИОЗСН' },
    { slug: 'sertraline', is_primary: true, notes: 'СИОЗС' },
    { slug: 'mirtazapine', is_primary: false, notes: 'При сопутствующей бессоннице' },
    { slug: 'alprazolam', is_primary: false, notes: 'Бензодиазепин, кратковременно' },
    { slug: 'clonazepam', is_primary: false, notes: 'Бензодиазепин, кратковременно' },
    { slug: 'diazepam', is_primary: false, notes: 'Бензодиазепин, кратковременно' }
  ],
  ocd: [
    { slug: 'sertraline', is_primary: true, notes: 'Первая линия, СИОЗС, высокие дозы' },
    { slug: 'escitalopram', is_primary: true, notes: 'СИОЗС, высокие дозы' },
    { slug: 'risperidone', is_primary: false, notes: 'Аугментация при резистентности' }
  ],
  ptsd: [
    { slug: 'sertraline', is_primary: true, notes: 'Первая линия, СИОЗС' },
    { slug: 'venlafaxine', is_primary: true, notes: 'СИОЗСН' },
    { slug: 'escitalopram', is_primary: false, notes: 'СИОЗС' },
    { slug: 'quetiapine', is_primary: false, notes: 'Адъювант при тяжёлых симптомах' },
    { slug: 'mdma', is_primary: false, notes: 'Исследуется, психотерапия с МДМА' }
  ],
  bipolar: [
    { slug: 'lithium', is_primary: true, notes: 'Стабилизатор настроения, профилактика' },
    { slug: 'valproate', is_primary: true, notes: 'Стабилизатор настроения' },
    { slug: 'lamotrigine', is_primary: true, notes: 'Профилактика депрессивных фаз' },
    { slug: 'quetiapine', is_primary: true, notes: 'Атипичный антипсихотик' },
    { slug: 'olanzapine', is_primary: false, notes: 'Атипичный антипсихотик при мании' },
    { slug: 'risperidone', is_primary: false, notes: 'Атипичный антипсихотик при мании' },
    { slug: 'carbamazepine', is_primary: false, notes: 'Стабилизатор настроения, второй ряд' }
  ],
  bpd: [
    { slug: 'lamotrigine', is_primary: false, notes: 'Стабилизатор настроения, импульсивность' },
    { slug: 'quetiapine', is_primary: false, notes: 'Симптоматически, аффективная нестабильность' },
    { slug: 'sertraline', is_primary: false, notes: 'При сопутствующей депрессии/тревоге' }
  ],
  schizophrenia: [
    { slug: 'olanzapine', is_primary: true, notes: 'Атипичный антипсихотик' },
    { slug: 'risperidone', is_primary: true, notes: 'Атипичный антипсихотик' },
    { slug: 'quetiapine', is_primary: true, notes: 'Атипичный антипсихотик' }
  ],
  epilepsy: [
    { slug: 'levetiracetam', is_primary: true, notes: 'Первая линия, широкий спектр' },
    { slug: 'valproate', is_primary: true, notes: 'Генерализованная эпилепсия' },
    { slug: 'lamotrigine', is_primary: true, notes: 'Широкий спектр' },
    { slug: 'carbamazepine', is_primary: true, notes: 'Фокальные приступы' },
    { slug: 'topiramate', is_primary: false, notes: 'Противосудорожное' },
    { slug: 'gabapentin', is_primary: false, notes: 'Дополнительно при фокальных приступах' },
    { slug: 'clonazepam', is_primary: false, notes: 'Дополнительно' },
    { slug: 'diazepam', is_primary: false, notes: 'Острое купирование статуса' }
  ],
  tourette: [
    { slug: 'risperidone', is_primary: true, notes: 'Антипсихотик для подавления тиков' },
    { slug: 'olanzapine', is_primary: false, notes: 'Антипсихотик при тяжёлых тиках' }
  ],
  migraine: [
    { slug: 'topiramate', is_primary: true, notes: 'Профилактика, первая линия' },
    { slug: 'valproate', is_primary: true, notes: 'Профилактика' },
    { slug: 'naproxen', is_primary: false, notes: 'НПВС, купирование приступа' },
    { slug: 'ibuprofen', is_primary: false, notes: 'НПВС, купирование приступа' }
  ],
  insomnia: [
    { slug: 'mirtazapine', is_primary: false, notes: 'Off-label, седативный эффект' },
    { slug: 'quetiapine', is_primary: false, notes: 'Off-label, низкие дозы' },
    { slug: 'clonazepam', is_primary: false, notes: 'Бензодиазепин, кратковременно' },
    { slug: 'diazepam', is_primary: false, notes: 'Бензодиазепин, кратковременно' }
  ],
  gerd: [
    { slug: 'omeprazole', is_primary: true, notes: 'Первая линия, ИПП' },
    { slug: 'pantoprazole', is_primary: true, notes: 'ИПП' },
    { slug: 'esomeprazole', is_primary: true, notes: 'ИПП' }
  ],
  gastritis: [
    { slug: 'omeprazole', is_primary: true, notes: 'ИПП, снижение кислотности' },
    { slug: 'pantoprazole', is_primary: true, notes: 'ИПП' },
    { slug: 'esomeprazole', is_primary: true, notes: 'ИПП' },
    { slug: 'amoxicillin-clavulanate', is_primary: false, notes: 'Эрадикация H. pylori' },
    { slug: 'doxycycline', is_primary: false, notes: 'Альтернатива в схеме эрадикации H. pylori' }
  ],
  ibs: [
    { slug: 'sertraline', is_primary: false, notes: 'Низкие дозы при висцеральной боли' },
    { slug: 'escitalopram', is_primary: false, notes: 'При сопутствующей тревоге/боли' }
  ],
  cirrhosis: [
    { slug: 'doxycycline', is_primary: false, notes: 'Антибиотик при инфекционных осложнениях' }
  ],
  hypothyroidism: [
    { slug: 'levothyroxine', is_primary: true, notes: 'Заместительная гормональная терапия' }
  ],
  'coronary-artery-disease': [
    { slug: 'atorvastatin', is_primary: true, notes: 'Статин, вторичная профилактика' },
    { slug: 'apixaban', is_primary: false, notes: 'При сопутствующей фибрилляции предсердий' },
    { slug: 'rivaroxaban', is_primary: false, notes: 'Низкие дозы как адъювант при стабильной ИБС' },
    { slug: 'warfarin', is_primary: false, notes: 'Антикоагуляция по показаниям' }
  ],
  'heart-failure': [
    { slug: 'apixaban', is_primary: false, notes: 'При сопутствующей фибрилляции предсердий' },
    { slug: 'warfarin', is_primary: false, notes: 'Антикоагуляция при ФП/тромбозе' },
    { slug: 'atorvastatin', is_primary: false, notes: 'При сопутствующей ИБС' }
  ],
  stroke: [
    { slug: 'apixaban', is_primary: true, notes: 'Профилактика кардиоэмболии при ФП' },
    { slug: 'rivaroxaban', is_primary: true, notes: 'Профилактика кардиоэмболии при ФП' },
    { slug: 'warfarin', is_primary: false, notes: 'Антикоагуляция при ФП' },
    { slug: 'atorvastatin', is_primary: true, notes: 'Статин, вторичная профилактика' }
  ],
  'multiple-sclerosis': [
    { slug: 'methylprednisolone', is_primary: true, notes: 'Пульс-терапия при обострении' },
    { slug: 'prednisolone', is_primary: false, notes: 'Глюкокортикоид при обострении' }
  ],
  'disc-herniation': [
    { slug: 'ibuprofen', is_primary: true, notes: 'НПВС, обезболивание' },
    { slug: 'naproxen', is_primary: true, notes: 'НПВС' },
    { slug: 'celecoxib', is_primary: false, notes: 'Селективный НПВС' },
    { slug: 'gabapentin', is_primary: false, notes: 'При радикулярной боли' }
  ],
  'spinal-osteochondrosis': [
    { slug: 'ibuprofen', is_primary: true, notes: 'НПВС, обезболивание' },
    { slug: 'naproxen', is_primary: true, notes: 'НПВС' },
    { slug: 'celecoxib', is_primary: false, notes: 'Селективный НПВС' },
    { slug: 'gabapentin', is_primary: false, notes: 'При невропатической боли' }
  ],
  'hip-osteoarthritis': [
    { slug: 'ibuprofen', is_primary: true, notes: 'НПВС, первая линия' },
    { slug: 'naproxen', is_primary: true, notes: 'НПВС' },
    { slug: 'celecoxib', is_primary: false, notes: 'Селективный НПВС' }
  ],
  'type2-diabetes': [
    { slug: 'metformin', is_primary: true, notes: 'Первая линия, бигуанид' },
    { slug: 'semaglutide', is_primary: true, notes: 'Агонист ГПП-1' },
    { slug: 'atorvastatin', is_primary: false, notes: 'Статин для снижения ССР' }
  ],
  'type1-diabetes': [
    { slug: 'metformin', is_primary: false, notes: 'Адъювант при инсулинорезистентности' }
  ],
  pcos: [
    { slug: 'metformin', is_primary: true, notes: 'Инсулинорезистентность' },
    { slug: 'estradiol', is_primary: false, notes: 'В составе КОК для регуляции цикла' }
  ],
  'gestational-diabetes': [
    { slug: 'metformin', is_primary: false, notes: 'Альтернатива инсулину при ГСД' }
  ],
  endometriosis: [
    { slug: 'estradiol', is_primary: false, notes: 'Гормональная супрессия в составе КОК' },
    { slug: 'ibuprofen', is_primary: false, notes: 'НПВС при тазовой боли' },
    { slug: 'naproxen', is_primary: false, notes: 'НПВС при тазовой боли' }
  ],
  'uterine-fibroids': [
    { slug: 'estradiol', is_primary: false, notes: 'В составе гормональной терапии' },
    { slug: 'naproxen', is_primary: false, notes: 'НПВС при меноррагии/боли' },
    { slug: 'ibuprofen', is_primary: false, notes: 'НПВС при боли' }
  ],
  mastitis: [
    { slug: 'amoxicillin-clavulanate', is_primary: true, notes: 'Антибиотик первой линии' },
    { slug: 'ibuprofen', is_primary: false, notes: 'НПВС, обезболивание' }
  ],
  'breast-engorgement': [
    { slug: 'ibuprofen', is_primary: false, notes: 'НПВС, обезболивание' },
    { slug: 'naproxen', is_primary: false, notes: 'НПВС, обезболивание' }
  ],
  vaginitis: [
    { slug: 'doxycycline', is_primary: false, notes: 'При сопутствующем бактериальном цервиците' }
  ],
  'cervical-dysplasia': [
    { slug: 'doxycycline', is_primary: false, notes: 'При сопутствующей инфекции' }
  ],
  als: [
    { slug: 'quetiapine', is_primary: false, notes: 'Симптоматически при возбуждении/бессоннице' }
  ],
  alzheimers: [
    { slug: 'quetiapine', is_primary: false, notes: 'Off-label, ажитация (с осторожностью)' }
  ],
  'lewy-body-dementia': [
    { slug: 'quetiapine', is_primary: false, notes: 'Осторожно при психозе (низкие дозы)' }
  ],
  'frontotemporal-dementia': [
    { slug: 'sertraline', is_primary: false, notes: 'СИОЗС при поведенческих симптомах' },
    { slug: 'quetiapine', is_primary: false, notes: 'Off-label, ажитация' }
  ],
  parkinsons: [
    { slug: 'quetiapine', is_primary: false, notes: 'При психозе (не ухудшает моторику)' }
  ],
  huntingtons: [
    { slug: 'olanzapine', is_primary: false, notes: 'Антипсихотик при хорее/раздражительности' },
    { slug: 'risperidone', is_primary: false, notes: 'Антипсихотик при хорее' }
  ],
  'hyperemesis-gravidarum': [
    { slug: 'omeprazole', is_primary: false, notes: 'При сопутствующем рефлюксе/гастрите' }
  ],
  gpa: [
    { slug: 'prednisolone', is_primary: true, notes: 'Глюкокортикоид, индукция ремиссии' },
    { slug: 'methylprednisolone', is_primary: true, notes: 'Пульс-терапия при тяжёлом течении' },
    { slug: 'rituximab', is_primary: true, notes: 'Анти-CD20, индукция и поддержание' },
    { slug: 'cyclophosphamide', is_primary: true, notes: 'Индукция при тяжёлом течении' },
    { slug: 'methotrexate', is_primary: false, notes: 'Поддержание при нетяжёлом течении' },
    { slug: 'azathioprine', is_primary: false, notes: 'Поддержание ремиссии' },
    { slug: 'mycophenolate', is_primary: false, notes: 'Поддержание, альтернатива' }
  ],
  thymoma: [
    { slug: 'prednisolone', is_primary: false, notes: 'При паранеопластической миастении' },
    { slug: 'azathioprine', is_primary: false, notes: 'Иммуносупрессия при миастении' }
  ],
  breast_cancer: [
    { slug: 'cyclophosphamide', is_primary: true, notes: 'Компонент схем химиотерапии' }
  ],
  lung_cancer: [
    { slug: 'cyclophosphamide', is_primary: false, notes: 'Компонент схем при мелкоклеточном раке' }
  ],
  gastric_cancer: [
    { slug: 'cyclophosphamide', is_primary: false, notes: 'Компонент некоторых схем химиотерапии' }
  ],
  hodgkin_lymphoma: [
    { slug: 'cyclophosphamide', is_primary: true, notes: 'Компонент схемы BEACOPP' },
    { slug: 'prednisolone', is_primary: true, notes: 'Глюкокортикоид в схеме BEACOPP' }
  ],
  cml: [
    { slug: 'cyclophosphamide', is_primary: false, notes: 'Кондиционирование перед ТГСК' }
  ],
  glioblastoma: [
    { slug: 'dexamethasone', is_primary: true, notes: 'Контроль перитуморального отёка' }
  ]
};

const ORGAN_EFFECTS = {
  prednisolone: {
    lungs: { effect: 'positive', detail_ru: 'Подавляет воспаление дыхательных путей при астме/ХОБЛ, уменьшая отёк слизистой и бронхоспазм.', detail_en: 'Suppresses airway inflammation in asthma/COPD, reducing mucosal oedema and bronchospasm.', detail_es: 'Suprime la inflamación de las vías respiratorias en asma/EPOC, reduciendo el edema y el broncoespasmo.', severity: 'high', onset: 'acute' },
    adrenals: { effect: 'negative', detail_ru: 'Подавляет гипоталамо-гипофизарно-надпочечниковую ось; резкая отмена грозит надпочечниковой недостаточностью.', detail_en: 'Suppresses the HPA axis; abrupt withdrawal risks adrenal insufficiency.', detail_es: 'Suprime el eje hipotálamo-hipófiso-suprarrenal; la retirada brusca arriesga insuficiencia suprarrenal.', severity: 'high', onset: 'chronic' },
    bones: { effect: 'negative', detail_ru: 'Длительный приём (>3 мес) подавляет остеобласты и вызывает остеопороз — риск переломов позвонков и шейки бедра.', detail_en: 'Long-term use (>3 mo) suppresses osteoblasts causing osteoporosis — risk of vertebral and hip fractures.', detail_es: 'El uso prolongado (>3 meses) suprime los osteoblastos causando osteoporosis — riesgo de fracturas vertebrales y de cadera.', severity: 'high', onset: 'chronic' },
    stomach: { effect: 'negative', detail_ru: 'Повышает риск пептической язвы и желудочного кровотечения, особенно в сочетании с НПВП.', detail_en: 'Raises risk of peptic ulcer and gastric bleeding, especially combined with NSAIDs.', detail_es: 'Aumenta el riesgo de úlcera péptica y hemorragia gástrica, sobre todo combinado con AINE.', severity: 'medium', onset: 'chronic' },
    pancreas: { effect: 'negative', detail_ru: 'Снижает чувствительность к инсулину и повышает глюконеогенез — стероидная гипергликемия/диабет.', detail_en: 'Reduces insulin sensitivity and raises gluconeogenesis — steroid-induced hyperglycaemia/diabetes.', detail_es: 'Reduce la sensibilidad a la insulina y aumenta la gluconeogénesis — hiperglucemia/diabetes esteroidea.', severity: 'medium', onset: 'chronic' }
  },
  dexamethasone: {
    brain: { effect: 'positive', detail_ru: 'Мощно снижает вазогенный отёк мозга вокруг опухолей и при отёке, уменьшая внутричерепное давление.', detail_en: 'Potently reduces vasogenic cerebral oedema around tumours, lowering intracranial pressure.', detail_es: 'Reduce potentemente el edema cerebral vasogénico peritumoral, disminuyendo la presión intracraneal.', severity: 'high', onset: 'acute' },
    lungs: { effect: 'positive', detail_ru: 'Снижает смертность при тяжёлом COVID/ОРДС, подавляя цитокиновое воспаление лёгких.', detail_en: 'Reduces mortality in severe COVID/ARDS by suppressing pulmonary cytokine inflammation.', detail_es: 'Reduce la mortalidad en COVID/SDRA grave al suprimir la inflamación citoquínica pulmonar.', severity: 'high', onset: 'acute' },
    adrenals: { effect: 'negative', detail_ru: 'Сильнейший супрессор ГГН-оси (длительный t½) — выраженное подавление эндогенного кортизола.', detail_en: 'Strongest HPA-axis suppressor (long half-life) — marked suppression of endogenous cortisol.', detail_es: 'El mayor supresor del eje HHS (vida media larga) — marcada supresión del cortisol endógeno.', severity: 'high', onset: 'chronic' },
    bones: { effect: 'negative', detail_ru: 'Подавляет остеобласты; высокий риск остеопороза и аваскулярного некроза головки бедра.', detail_en: 'Suppresses osteoblasts; high risk of osteoporosis and avascular necrosis of the femoral head.', detail_es: 'Suprime los osteoblastos; alto riesgo de osteoporosis y necrosis avascular de la cabeza femoral.', severity: 'high', onset: 'chronic' },
    pancreas: { effect: 'negative', detail_ru: 'Выраженная стероидная гипергликемия из-за инсулинорезистентности и глюконеогенеза.', detail_en: 'Marked steroid hyperglycaemia from insulin resistance and gluconeogenesis.', detail_es: 'Marcada hiperglucemia esteroidea por resistencia a la insulina y gluconeogénesis.', severity: 'medium', onset: 'chronic' }
  },
  methylprednisolone: {
    spinal_cord: { effect: 'positive', detail_ru: 'Высокодозная пульс-терапия применяется при остром повреждении/демиелинизации для уменьшения воспалительного отёка.', detail_en: 'High-dose pulse therapy used in acute injury/demyelination to reduce inflammatory oedema.', detail_es: 'La terapia de pulsos a dosis altas se usa en lesión/desmielinización aguda para reducir el edema inflamatorio.', severity: 'high', onset: 'acute' },
    nervous: { effect: 'positive', detail_ru: 'Пульс-терапия гасит обострения рассеянного склероза, ускоряя восстановление неврологической функции.', detail_en: 'Pulse therapy quells multiple-sclerosis relapses, speeding neurological recovery.', detail_es: 'La terapia de pulsos sofoca los brotes de esclerosis múltiple, acelerando la recuperación neurológica.', severity: 'high', onset: 'acute' },
    adrenals: { effect: 'negative', detail_ru: 'Подавляет ГГН-ось; необходима постепенная отмена во избежание надпочечниковой недостаточности.', detail_en: 'Suppresses the HPA axis; gradual taper needed to avoid adrenal insufficiency.', detail_es: 'Suprime el eje HHS; se necesita reducción gradual para evitar insuficiencia suprarrenal.', severity: 'high', onset: 'chronic' },
    bones: { effect: 'negative', detail_ru: 'Длительный приём вызывает остеопороз и риск аваскулярного некроза кости.', detail_en: 'Prolonged use causes osteoporosis and risk of avascular bone necrosis.', detail_es: 'El uso prolongado causa osteoporosis y riesgo de necrosis ósea avascular.', severity: 'high', onset: 'chronic' },
    stomach: { effect: 'negative', detail_ru: 'Повышает риск пептической язвы и желудочно-кишечного кровотечения.', detail_en: 'Raises risk of peptic ulcer and gastrointestinal bleeding.', detail_es: 'Aumenta el riesgo de úlcera péptica y hemorragia gastrointestinal.', severity: 'medium', onset: 'chronic' }
  },
  methotrexate: {
    joints: { effect: 'positive', detail_ru: 'Базисный препарат ревматоидного артрита: подавляет синовиальное воспаление и замедляет эрозию суставов.', detail_en: 'Anchor DMARD in rheumatoid arthritis: suppresses synovial inflammation and slows joint erosion.', detail_es: 'FAME ancla en artritis reumatoide: suprime la inflamación sinovial y frena la erosión articular.', severity: 'high', onset: 'chronic' },
    skin: { effect: 'positive', detail_ru: 'Снижает гиперпролиферацию кератиноцитов при тяжёлом псориазе, уменьшая бляшки.', detail_en: 'Reduces keratinocyte hyperproliferation in severe psoriasis, clearing plaques.', detail_es: 'Reduce la hiperproliferación de queratinocitos en psoriasis grave, aclarando las placas.', severity: 'medium', onset: 'chronic' },
    liver: { effect: 'negative', detail_ru: 'Кумулятивная гепатотоксичность — фиброз и цирроз при длительном приёме; нужен контроль трансаминаз.', detail_en: 'Cumulative hepatotoxicity — fibrosis and cirrhosis with chronic use; requires transaminase monitoring.', detail_es: 'Hepatotoxicidad acumulativa — fibrosis y cirrosis con uso crónico; requiere control de transaminasas.', severity: 'high', onset: 'chronic' },
    lungs: { effect: 'negative', detail_ru: 'Может вызвать гиперчувствительный пневмонит/лёгочный фиброз — кашель и одышка требуют отмены.', detail_en: 'Can cause hypersensitivity pneumonitis/pulmonary fibrosis — cough and dyspnoea warrant stopping.', detail_es: 'Puede causar neumonitis por hipersensibilidad/fibrosis pulmonar — tos y disnea obligan a suspender.', severity: 'high', onset: 'chronic' },
    spleen: { effect: 'negative', detail_ru: 'Миелосупрессия: подавление костного мозга вызывает цитопении; фолат снижает риск.', detail_en: 'Myelosuppression: bone-marrow suppression causes cytopenias; folate lowers risk.', detail_es: 'Mielosupresión: la supresión de la médula ósea causa citopenias; el folato reduce el riesgo.', severity: 'high', onset: 'chronic' },
    stomach: { effect: 'negative', detail_ru: 'Вызывает стоматит и мукозит ЖКТ из-за антифолатного действия на быстро делящиеся клетки.', detail_en: 'Causes stomatitis and GI mucositis from antifolate action on rapidly dividing cells.', detail_es: 'Causa estomatitis y mucositis GI por la acción antifolato sobre células de división rápida.', severity: 'medium', onset: 'acute' }
  },
  cyclophosphamide: {
    spleen: { effect: 'positive', detail_ru: 'Алкилирующий цитостатик подавляет пролиферацию лимфоцитов — лечит лимфомы и тяжёлый васкулит.', detail_en: 'Alkylating cytotoxic suppresses lymphocyte proliferation — treats lymphomas and severe vasculitis.', detail_es: 'Citotóxico alquilante suprime la proliferación de linfocitos — trata linfomas y vasculitis grave.', severity: 'high', onset: 'chronic' },
    kidneys: { effect: 'negative', detail_ru: 'Метаболит акролеин вызывает геморрагический цистит мочевого пузыря; месна снижает риск.', detail_en: 'Acrolein metabolite causes haemorrhagic cystitis of the bladder; mesna lowers the risk.', detail_es: 'El metabolito acroleína causa cistitis hemorrágica vesical; el mesna reduce el riesgo.', severity: 'high', onset: 'acute' },
    bones: { effect: 'negative', detail_ru: 'Тяжёлая миелосупрессия костного мозга — нейтропения и риск инфекций.', detail_en: 'Severe bone-marrow myelosuppression — neutropenia and infection risk.', detail_es: 'Mielosupresión grave de la médula ósea — neutropenia y riesgo de infección.', severity: 'high', onset: 'acute' },
    heart: { effect: 'negative', detail_ru: 'В высоких дозах кардиотоксичен — геморрагический миокардит и сердечная недостаточность.', detail_en: 'High doses are cardiotoxic — haemorrhagic myocarditis and heart failure.', detail_es: 'A dosis altas es cardiotóxico — miocarditis hemorrágica e insuficiencia cardíaca.', severity: 'high', onset: 'acute' }
  },
  azathioprine: {
    joints: { effect: 'positive', detail_ru: 'Иммуносупрессор-стероидсберегатель при ревматоидном артрите и аутоиммунных болезнях.', detail_en: 'Steroid-sparing immunosuppressant in rheumatoid arthritis and autoimmune disease.', detail_es: 'Inmunosupresor ahorrador de esteroides en artritis reumatoide y enfermedad autoinmune.', severity: 'medium', onset: 'chronic' },
    colon: { effect: 'positive', detail_ru: 'Поддерживает ремиссию воспалительных заболеваний кишечника, снижая аутоиммунное воспаление слизистой.', detail_en: 'Maintains remission in inflammatory bowel disease by reducing autoimmune mucosal inflammation.', detail_es: 'Mantiene la remisión en enfermedad inflamatoria intestinal reduciendo la inflamación mucosa autoinmune.', severity: 'medium', onset: 'chronic' },
    bones: { effect: 'negative', detail_ru: 'Миелосупрессия (дозозависимая, усилена при дефиците TPMT) — лейкопения и риск инфекций.', detail_en: 'Myelosuppression (dose-dependent, worse with TPMT deficiency) — leukopenia and infection risk.', detail_es: 'Mielosupresión (dosis-dependiente, peor con déficit de TPMT) — leucopenia y riesgo de infección.', severity: 'high', onset: 'chronic' },
    liver: { effect: 'negative', detail_ru: 'Гепатотоксичность с холестазом и риском узловой регенеративной гиперплазии; нужен контроль АЛТ.', detail_en: 'Hepatotoxicity with cholestasis and risk of nodular regenerative hyperplasia; ALT monitoring needed.', detail_es: 'Hepatotoxicidad con colestasis y riesgo de hiperplasia regenerativa nodular; control de ALT.', severity: 'medium', onset: 'chronic' },
    pancreas: { effect: 'negative', detail_ru: 'Может вызвать острый идиосинкразический панкреатит, особенно при ВЗК.', detail_en: 'Can cause acute idiosyncratic pancreatitis, particularly in IBD.', detail_es: 'Puede causar pancreatitis aguda idiosincrásica, especialmente en EII.', severity: 'medium', onset: 'acute' }
  },
  hydroxychloroquine: {
    joints: { effect: 'positive', detail_ru: 'Базисный препарат при волчанке и РА: модулирует TLR-сигнализацию, снижает воспаление суставов.', detail_en: 'DMARD in lupus and RA: modulates TLR signalling, reducing joint inflammation.', detail_es: 'FAME en lupus y AR: modula la señalización TLR, reduciendo la inflamación articular.', severity: 'medium', onset: 'chronic' },
    skin: { effect: 'positive', detail_ru: 'Лечит кожные проявления красной волчанки, уменьшая фоточувствительные высыпания.', detail_en: 'Treats cutaneous lupus, reducing photosensitive rashes.', detail_es: 'Trata el lupus cutáneo, reduciendo las erupciones fotosensibles.', severity: 'medium', onset: 'chronic' },
    heart: { effect: 'negative', detail_ru: 'Удлиняет интервал QT и редко вызывает кардиомиопатию при длительном приёме.', detail_en: 'Prolongs the QT interval and rarely causes cardiomyopathy with long-term use.', detail_es: 'Prolonga el intervalo QT y raramente causa cardiomiopatía con uso prolongado.', severity: 'medium', onset: 'chronic' }
  },
  rituximab: {
    spleen: { effect: 'positive', detail_ru: 'Анти-CD20 моноклональное АТ истощает B-лимфоциты — лечит B-клеточные лимфомы и аутоиммунные болезни.', detail_en: 'Anti-CD20 monoclonal depletes B-lymphocytes — treats B-cell lymphomas and autoimmune disease.', detail_es: 'Anticuerpo monoclonal anti-CD20 depleta linfocitos B — trata linfomas B y enfermedad autoinmune.', severity: 'high', onset: 'chronic' },
    joints: { effect: 'positive', detail_ru: 'При рефрактерном ревматоидном артрите подавляет B-клеточно-опосредованное воспаление синовии.', detail_en: 'In refractory rheumatoid arthritis suppresses B-cell-mediated synovial inflammation.', detail_es: 'En artritis reumatoide refractaria suprime la inflamación sinovial mediada por células B.', severity: 'medium', onset: 'chronic' },
    lungs: { effect: 'negative', detail_ru: 'Повышает риск тяжёлых инфекций дыхательных путей из-за длительной B-клеточной депрессии.', detail_en: 'Raises risk of severe respiratory infections from prolonged B-cell depletion.', detail_es: 'Aumenta el riesgo de infecciones respiratorias graves por depleción prolongada de células B.', severity: 'high', onset: 'chronic' },
    brain: { effect: 'negative', detail_ru: 'Редко реактивирует JC-вирус с развитием прогрессирующей мультифокальной лейкоэнцефалопатии.', detail_en: 'Rarely reactivates JC virus causing progressive multifocal leukoencephalopathy.', detail_es: 'Raramente reactiva el virus JC causando leucoencefalopatía multifocal progresiva.', severity: 'high', onset: 'chronic' }
  },
  adalimumab: {
    joints: { effect: 'positive', detail_ru: 'Блокатор ФНО-α подавляет суставное воспаление при РА/псориатическом артрите, замедляя эрозии.', detail_en: 'TNF-α blocker suppresses joint inflammation in RA/psoriatic arthritis, slowing erosions.', detail_es: 'Bloqueador de TNF-α suprime la inflamación articular en AR/artritis psoriásica, frenando erosiones.', severity: 'high', onset: 'chronic' },
    colon: { effect: 'positive', detail_ru: 'Индуцирует и поддерживает ремиссию болезни Крона и язвенного колита, заживляя слизистую.', detail_en: 'Induces and maintains remission in Crohn disease and ulcerative colitis, healing the mucosa.', detail_es: 'Induce y mantiene la remisión en Crohn y colitis ulcerosa, cicatrizando la mucosa.', severity: 'high', onset: 'chronic' },
    lungs: { effect: 'negative', detail_ru: 'Подавление ФНО реактивирует латентный туберкулёз — обязателен скрининг до начала терапии.', detail_en: 'TNF suppression reactivates latent tuberculosis — screening mandatory before therapy.', detail_es: 'La supresión de TNF reactiva la tuberculosis latente — cribado obligatorio antes de la terapia.', severity: 'high', onset: 'chronic' },
    spleen: { effect: 'negative', detail_ru: 'Повышает восприимчивость к серьёзным и оппортунистическим инфекциям из-за иммуносупрессии.', detail_en: 'Raises susceptibility to serious and opportunistic infections from immunosuppression.', detail_es: 'Aumenta la susceptibilidad a infecciones graves y oportunistas por inmunosupresión.', severity: 'high', onset: 'chronic' }
  },
  infliximab: {
    colon: { effect: 'positive', detail_ru: 'Анти-ФНО инфузия индуцирует ремиссию тяжёлой болезни Крона и язвенного колита, заживляя слизистую.', detail_en: 'Anti-TNF infusion induces remission in severe Crohn disease and ulcerative colitis, healing the mucosa.', detail_es: 'La infusión anti-TNF induce remisión en Crohn grave y colitis ulcerosa, cicatrizando la mucosa.', severity: 'high', onset: 'chronic' },
    joints: { effect: 'positive', detail_ru: 'Подавляет воспаление при РА и анкилозирующем спондилите, замедляя структурное повреждение.', detail_en: 'Suppresses inflammation in RA and ankylosing spondylitis, slowing structural damage.', detail_es: 'Suprime la inflamación en AR y espondilitis anquilosante, frenando el daño estructural.', severity: 'high', onset: 'chronic' },
    lungs: { effect: 'negative', detail_ru: 'Реактивирует латентный туберкулёз и грибковые инфекции лёгких — нужен предварительный скрининг.', detail_en: 'Reactivates latent tuberculosis and fungal lung infections — pre-screening required.', detail_es: 'Reactiva tuberculosis latente e infecciones fúngicas pulmonares — se requiere cribado previo.', severity: 'high', onset: 'chronic' },
    liver: { effect: 'negative', detail_ru: 'Может вызвать аутоиммунный гепатит и реактивацию гепатита B; контроль печёночных проб.', detail_en: 'Can cause autoimmune hepatitis and hepatitis-B reactivation; monitor liver enzymes.', detail_es: 'Puede causar hepatitis autoinmune y reactivación de hepatitis B; controlar enzimas hepáticas.', severity: 'medium', onset: 'chronic' }
  },
  omeprazole: {
    stomach: { effect: 'positive', detail_ru: 'Ингибитор протонной помпы необратимо блокирует H/K-АТФазу, заживляя язву и снижая кислотность.', detail_en: 'Proton-pump inhibitor irreversibly blocks H/K-ATPase, healing ulcers and cutting acidity.', detail_es: 'Inhibidor de la bomba de protones bloquea irreversiblemente la H/K-ATPasa, cicatrizando úlceras y reduciendo la acidez.', severity: 'high', onset: 'acute' },
    bones: { effect: 'negative', detail_ru: 'Длительный приём снижает всасывание кальция — повышен риск переломов бедра и позвоночника.', detail_en: 'Long-term use impairs calcium absorption — raised risk of hip and spine fractures.', detail_es: 'El uso prolongado altera la absorción de calcio — mayor riesgo de fracturas de cadera y columna.', severity: 'medium', onset: 'chronic' },
    kidneys: { effect: 'negative', detail_ru: 'Может вызвать острый интерстициальный нефрит и хроническую болезнь почек при длительном применении.', detail_en: 'Can cause acute interstitial nephritis and chronic kidney disease with prolonged use.', detail_es: 'Puede causar nefritis intersticial aguda y enfermedad renal crónica con uso prolongado.', severity: 'medium', onset: 'chronic' },
    small_intestine: { effect: 'negative', detail_ru: 'Снижает всасывание B12 и магния; гипохлоргидрия повышает риск кишечных инфекций (C. difficile).', detail_en: 'Reduces B12 and magnesium absorption; hypochlorhydria raises gut infection risk (C. difficile).', detail_es: 'Reduce la absorción de B12 y magnesio; la hipoclorhidria aumenta el riesgo de infección intestinal (C. difficile).', severity: 'low', onset: 'chronic' }
  },
  sertraline: {
    brain_serotonergic: { effect: 'positive', detail_ru: 'СИОЗС блокирует обратный захват серотонина, повышая его в синапсах — лечит депрессию и тревогу.', detail_en: 'SSRI blocks serotonin reuptake, raising synaptic serotonin — treats depression and anxiety.', detail_es: 'ISRS bloquea la recaptación de serotonina, elevándola en la sinapsis — trata depresión y ansiedad.', severity: 'high', onset: 'chronic' },
    brain_emotion_amygdala: { effect: 'positive', detail_ru: 'Снижает гиперреактивность миндалины на угрозу, ослабляя тревогу и панические реакции.', detail_en: 'Dampens amygdala hyper-reactivity to threat, easing anxiety and panic responses.', detail_es: 'Atenúa la hiperreactividad de la amígdala a la amenaza, aliviando la ansiedad y el pánico.', severity: 'medium', onset: 'chronic' },
    stomach: { effect: 'negative', detail_ru: 'Тошнота и диарея в начале лечения из-за стимуляции серотониновых рецепторов ЖКТ.', detail_en: 'Nausea and diarrhoea early in treatment from gut serotonin-receptor stimulation.', detail_es: 'Náuseas y diarrea al inicio del tratamiento por estimulación de receptores de serotonina GI.', severity: 'low', onset: 'acute' }
  },
  escitalopram: {
    brain_serotonergic: { effect: 'positive', detail_ru: 'Наиболее селективный СИОЗС: повышает синаптический серотонин — лечит большую депрессию и ГТР.', detail_en: 'Most selective SSRI: raises synaptic serotonin — treats major depression and GAD.', detail_es: 'El ISRS más selectivo: eleva la serotonina sináptica — trata depresión mayor y TAG.', severity: 'high', onset: 'chronic' },
    brain_emotion_amygdala: { effect: 'positive', detail_ru: 'Снижает реактивность миндалины, ослабляя тревожную руминацию и панические приступы.', detail_en: 'Lowers amygdala reactivity, easing anxious rumination and panic attacks.', detail_es: 'Reduce la reactividad de la amígdala, aliviando la rumiación ansiosa y los ataques de pánico.', severity: 'medium', onset: 'chronic' },
    heart: { effect: 'negative', detail_ru: 'Дозозависимое удлинение QT — осторожность при высоких дозах и сердечной патологии.', detail_en: 'Dose-dependent QT prolongation — caution at high doses and in cardiac disease.', detail_es: 'Prolongación del QT dosis-dependiente — precaución a dosis altas y en cardiopatía.', severity: 'medium', onset: 'chronic' }
  },
  venlafaxine: {
    brain_serotonergic: { effect: 'positive', detail_ru: 'СИОЗСН повышает серотонин и норадреналин — лечит депрессию и тревожные расстройства.', detail_en: 'SNRI raises serotonin and noradrenaline — treats depression and anxiety disorders.', detail_es: 'IRSN eleva serotonina y noradrenalina — trata depresión y trastornos de ansiedad.', severity: 'high', onset: 'chronic' },
    brain_attention_prefrontal: { effect: 'positive', detail_ru: 'Норадренергический эффект усиливает префронтальную концентрацию и устраняет апатию.', detail_en: 'Noradrenergic effect enhances prefrontal focus and lifts apathy.', detail_es: 'El efecto noradrenérgico mejora la concentración prefrontal y levanta la apatía.', severity: 'medium', onset: 'chronic' },
    heart: { effect: 'negative', detail_ru: 'В высоких дозах повышает АД и ЧСС из-за норадренергической активности — контроль давления.', detail_en: 'At high doses raises BP and heart rate from noradrenergic activity — monitor blood pressure.', detail_es: 'A dosis altas eleva la TA y la frecuencia cardíaca por actividad noradrenérgica — controlar la presión.', severity: 'medium', onset: 'chronic' }
  },
  bupropion: {
    brain_dopaminergic: { effect: 'positive', detail_ru: 'Ингибитор обратного захвата дофамина/норадреналина — лечит депрессию и снижает тягу к никотину.', detail_en: 'Dopamine/noradrenaline reuptake inhibitor — treats depression and reduces nicotine craving.', detail_es: 'Inhibidor de recaptación de dopamina/noradrenalina — trata depresión y reduce el ansia de nicotina.', severity: 'high', onset: 'chronic' },
    brain_glutamatergic: { effect: 'negative', detail_ru: 'Снижает порог судорог дозозависимо — противопоказан при эпилепсии и булимии.', detail_en: 'Lowers seizure threshold dose-dependently — contraindicated in epilepsy and bulimia.', detail_es: 'Reduce el umbral convulsivo de forma dosis-dependiente — contraindicado en epilepsia y bulimia.', severity: 'high', onset: 'acute' },
    heart: { effect: 'negative', detail_ru: 'Может вызвать тахикардию и повышение АД из-за норадренергической стимуляции.', detail_en: 'Can cause tachycardia and raised blood pressure from noradrenergic stimulation.', detail_es: 'Puede causar taquicardia y aumento de la TA por estimulación noradrenérgica.', severity: 'medium', onset: 'acute' }
  },
  alprazolam: {
    brain_gabaergic: { effect: 'positive', detail_ru: 'Бензодиазепин усиливает ГАМК-А-передачу, быстро снимая острую тревогу; но быстро формирует зависимость.', detail_en: 'Benzodiazepine potentiates GABA-A transmission, rapidly relieving acute anxiety; but rapidly produces dependence.', detail_es: 'Benzodiacepina potencia la transmisión GABA-A, aliviando rápidamente la ansiedad aguda; pero genera dependencia rápida.', severity: 'high', onset: 'acute' },
    brain_memory_hippocampus: { effect: 'negative', detail_ru: 'Нарушает консолидацию памяти в гиппокампе — антероградная амнезия, особенно у пожилых.', detail_en: 'Impairs hippocampal memory consolidation — anterograde amnesia, especially in the elderly.', detail_es: 'Altera la consolidación de memoria hipocampal — amnesia anterógrada, sobre todo en ancianos.', severity: 'medium', onset: 'acute' },
    lungs: { effect: 'negative', detail_ru: 'Угнетает дыхательный центр; опасное синергическое подавление дыхания с опиоидами/алкоголем.', detail_en: 'Depresses the respiratory centre; dangerous synergistic respiratory depression with opioids/alcohol.', detail_es: 'Deprime el centro respiratorio; depresión respiratoria sinérgica peligrosa con opioides/alcohol.', severity: 'high', onset: 'acute' }
  },
  diazepam: {
    brain_gabaergic: { effect: 'positive', detail_ru: 'Усиливает ГАМК-А-передачу — купирует тревогу, эпистатус и алкогольный абстинентный синдром.', detail_en: 'Potentiates GABA-A transmission — treats anxiety, status epilepticus and alcohol withdrawal.', detail_es: 'Potencia la transmisión GABA-A — trata ansiedad, estatus epiléptico y abstinencia alcohólica.', severity: 'high', onset: 'acute' },
    muscles: { effect: 'positive', detail_ru: 'Центральный миорелаксант снижает спастичность скелетных мышц через спинальные ГАМК-механизмы.', detail_en: 'Central muscle relaxant reduces skeletal-muscle spasticity via spinal GABA mechanisms.', detail_es: 'Relajante muscular central reduce la espasticidad esquelética por mecanismos GABA espinales.', severity: 'medium', onset: 'acute' },
    brain_memory_hippocampus: { effect: 'negative', detail_ru: 'Нарушает формирование новой памяти; седация и риск падений, особенно у пожилых.', detail_en: 'Impairs new memory formation; sedation and fall risk, especially in the elderly.', detail_es: 'Altera la formación de memoria nueva; sedación y riesgo de caídas, sobre todo en ancianos.', severity: 'medium', onset: 'acute' },
    lungs: { effect: 'negative', detail_ru: 'Угнетает дыхание; высокий риск при сочетании с опиоидами/алкоголем (длинный t½).', detail_en: 'Depresses respiration; high risk combined with opioids/alcohol (long half-life).', detail_es: 'Deprime la respiración; alto riesgo combinado con opioides/alcohol (vida media larga).', severity: 'high', onset: 'acute' }
  },
  quetiapine: {
    brain_dopaminergic: { effect: 'positive', detail_ru: 'Атипичный антипсихотик блокирует D2/5HT2A-рецепторы — ослабляет психоз и манию.', detail_en: 'Atypical antipsychotic blocks D2/5HT2A receptors — reduces psychosis and mania.', detail_es: 'Antipsicótico atípico bloquea receptores D2/5HT2A — reduce psicosis y manía.', severity: 'high', onset: 'chronic' },
    pancreas: { effect: 'negative', detail_ru: 'Вызывает метаболический синдром: набор веса, инсулинорезистентность, риск диабета.', detail_en: 'Causes metabolic syndrome: weight gain, insulin resistance, diabetes risk.', detail_es: 'Causa síndrome metabólico: aumento de peso, resistencia a la insulina, riesgo de diabetes.', severity: 'high', onset: 'chronic' },
    heart: { effect: 'negative', detail_ru: 'Удлиняет QT и вызывает ортостатическую гипотензию из-за α1-блокады.', detail_en: 'Prolongs QT and causes orthostatic hypotension from α1-blockade.', detail_es: 'Prolonga el QT y causa hipotensión ortostática por bloqueo α1.', severity: 'medium', onset: 'chronic' }
  },
  olanzapine: {
    brain_dopaminergic: { effect: 'positive', detail_ru: 'Атипичный антипсихотик блокирует D2/5HT2A — эффективно купирует психоз и острую манию.', detail_en: 'Atypical antipsychotic blocks D2/5HT2A — effectively treats psychosis and acute mania.', detail_es: 'Antipsicótico atípico bloquea D2/5HT2A — trata eficazmente psicosis y manía aguda.', severity: 'high', onset: 'chronic' },
    pancreas: { effect: 'negative', detail_ru: 'Один из самых сильных по метаболической токсичности: набор веса, диабет, дислипидемия.', detail_en: 'Among the most metabolically toxic: weight gain, diabetes, dyslipidaemia.', detail_es: 'Entre los más tóxicos metabólicamente: aumento de peso, diabetes, dislipidemia.', severity: 'high', onset: 'chronic' },
    liver: { effect: 'negative', detail_ru: 'Способствует стеатозу печени на фоне метаболического синдрома; рост трансаминаз.', detail_en: 'Promotes hepatic steatosis amid metabolic syndrome; transaminase elevation.', detail_es: 'Promueve esteatosis hepática junto al síndrome metabólico; elevación de transaminasas.', severity: 'medium', onset: 'chronic' },
    brain_motor_basal_ganglia: { effect: 'negative', detail_ru: 'При длительном приёме риск экстрапирамидных симптомов и поздней дискинезии (ниже, чем у типичных).', detail_en: 'Long-term risk of extrapyramidal symptoms and tardive dyskinesia (lower than typicals).', detail_es: 'Riesgo a largo plazo de síntomas extrapiramidales y discinesia tardía (menor que los típicos).', severity: 'medium', onset: 'chronic' }
  },
  lithium: {
    brain_emotion_amygdala: { effect: 'positive', detail_ru: 'Стабилизатор настроения снижает частоту маниакальных и депрессивных эпизодов; антисуицидальный эффект.', detail_en: 'Mood stabiliser reduces manic and depressive episodes; proven anti-suicidal effect.', detail_es: 'Estabilizador del ánimo reduce episodios maníacos y depresivos; efecto antisuicida probado.', severity: 'high', onset: 'chronic' },
    kidneys: { effect: 'negative', detail_ru: 'Вызывает нефрогенный несахарный диабет и хроническую тубулоинтерстициальную нефропатию.', detail_en: 'Causes nephrogenic diabetes insipidus and chronic tubulointerstitial nephropathy.', detail_es: 'Causa diabetes insípida nefrogénica y nefropatía tubulointersticial crónica.', severity: 'high', onset: 'chronic' },
    thyroid: { effect: 'negative', detail_ru: 'Подавляет синтез/высвобождение тиреоидных гормонов — гипотиреоз и зоб; контроль ТТГ.', detail_en: 'Inhibits thyroid-hormone synthesis/release — hypothyroidism and goitre; monitor TSH.', detail_es: 'Inhibe la síntesis/liberación de hormona tiroidea — hipotiroidismo y bocio; controlar TSH.', severity: 'medium', onset: 'chronic' },
    nervous: { effect: 'negative', detail_ru: 'Узкое терапевтическое окно: токсичность даёт тремор, атаксию, спутанность; нужен контроль уровня.', detail_en: 'Narrow therapeutic window: toxicity causes tremor, ataxia, confusion; level monitoring required.', detail_es: 'Ventana terapéutica estrecha: la toxicidad causa temblor, ataxia, confusión; control de niveles.', severity: 'high', onset: 'acute' }
  },
  valproate: {
    brain_glutamatergic: { effect: 'positive', detail_ru: 'Повышает ГАМК и блокирует Na-каналы — широкий антиконвульсант при генерализованной эпилепсии.', detail_en: 'Raises GABA and blocks Na channels — broad anticonvulsant for generalised epilepsy.', detail_es: 'Eleva GABA y bloquea canales de Na — anticonvulsivo amplio para epilepsia generalizada.', severity: 'high', onset: 'chronic' },
    brain_emotion_amygdala: { effect: 'positive', detail_ru: 'Стабилизатор настроения купирует острую манию при биполярном расстройстве.', detail_en: 'Mood stabiliser controls acute mania in bipolar disorder.', detail_es: 'Estabilizador del ánimo controla la manía aguda en trastorno bipolar.', severity: 'medium', onset: 'chronic' },
    liver: { effect: 'negative', detail_ru: 'Гепатотоксичен — риск фатальной печёночной недостаточности, особенно у детей <2 лет.', detail_en: 'Hepatotoxic — risk of fatal hepatic failure, especially in children under 2.', detail_es: 'Hepatotóxico — riesgo de insuficiencia hepática fatal, sobre todo en niños menores de 2 años.', severity: 'high', onset: 'chronic' },
    pancreas: { effect: 'negative', detail_ru: 'Может вызвать острый, иногда геморрагический панкреатит.', detail_en: 'Can cause acute, sometimes haemorrhagic pancreatitis.', detail_es: 'Puede causar pancreatitis aguda, a veces hemorrágica.', severity: 'medium', onset: 'acute' }
  },
  methylphenidate: {
    brain_attention_prefrontal: { effect: 'positive', detail_ru: 'Блокирует обратный захват дофамина/норадреналина в префронтальной коре — улучшает внимание при СДВГ.', detail_en: 'Blocks dopamine/noradrenaline reuptake in prefrontal cortex — improves attention in ADHD.', detail_es: 'Bloquea la recaptación de dopamina/noradrenalina en corteza prefrontal — mejora la atención en TDAH.', severity: 'high', onset: 'acute' },
    brain_dopaminergic: { effect: 'positive', detail_ru: 'Повышает дофамин в стриатуме, усиливая мотивацию и тормозный контроль; есть риск злоупотребления.', detail_en: 'Raises striatal dopamine, boosting motivation and inhibitory control; some abuse potential.', detail_es: 'Eleva la dopamina estriatal, aumentando la motivación y el control inhibitorio; cierto potencial de abuso.', severity: 'medium', onset: 'acute' },
    heart: { effect: 'negative', detail_ru: 'Симпатомиметик повышает ЧСС и АД; осторожность при структурной патологии сердца.', detail_en: 'Sympathomimetic raises heart rate and blood pressure; caution with structural heart disease.', detail_es: 'Simpaticomimético eleva la frecuencia cardíaca y la TA; precaución con cardiopatía estructural.', severity: 'medium', onset: 'acute' },
    stomach: { effect: 'negative', detail_ru: 'Подавляет аппетит, замедляя прибавку массы и роста у детей; бессонница.', detail_en: 'Suppresses appetite, slowing weight gain and growth in children; insomnia.', detail_es: 'Suprime el apetito, frenando la ganancia de peso y el crecimiento en niños; insomnio.', severity: 'low', onset: 'chronic' }
  },
  lisdexamfetamine: {
    brain_attention_prefrontal: { effect: 'positive', detail_ru: 'Пролекарство высвобождает d-амфетамин, повышая дофамин/норадреналин в коре — стойкое внимание при СДВГ.', detail_en: 'Prodrug releases d-amfetamine, raising cortical dopamine/noradrenaline — sustained attention in ADHD.', detail_es: 'Profármaco libera d-anfetamina, elevando dopamina/noradrenalina cortical — atención sostenida en TDAH.', severity: 'high', onset: 'acute' },
    brain_dopaminergic: { effect: 'positive', detail_ru: 'Усиливает дофаминовую передачу в стриатуме; снижает импульсивность, но имеет потенциал зависимости.', detail_en: 'Enhances striatal dopamine transmission; reduces impulsivity but carries dependence potential.', detail_es: 'Potencia la transmisión dopaminérgica estriatal; reduce impulsividad pero conlleva potencial de dependencia.', severity: 'medium', onset: 'acute' },
    heart: { effect: 'negative', detail_ru: 'Повышает ЧСС и АД; риск аритмий и редко внезапной смерти при кардиопатии.', detail_en: 'Raises heart rate and BP; risk of arrhythmia and rarely sudden death in cardiac disease.', detail_es: 'Eleva frecuencia cardíaca y TA; riesgo de arritmia y raramente muerte súbita en cardiopatía.', severity: 'high', onset: 'acute' },
    stomach: { effect: 'negative', detail_ru: 'Выраженно подавляет аппетит и вызывает бессонницу; замедление роста у детей.', detail_en: 'Markedly suppresses appetite and causes insomnia; growth slowing in children.', detail_es: 'Suprime marcadamente el apetito y causa insomnio; retraso del crecimiento en niños.', severity: 'low', onset: 'chronic' }
  },
  carbamazepine: {
    brain_glutamatergic: { effect: 'positive', detail_ru: 'Блокирует вольтаж-зависимые Na-каналы — стабилизирует нейроны при фокальной эпилепсии.', detail_en: 'Blocks voltage-gated Na channels — stabilises neurons in focal epilepsy.', detail_es: 'Bloquea canales de Na dependientes de voltaje — estabiliza neuronas en epilepsia focal.', severity: 'high', onset: 'chronic' },
    nervous: { effect: 'positive', detail_ru: 'Препарат первой линии при невралгии тройничного нерва, подавляя пароксизмальную боль.', detail_en: 'First-line for trigeminal neuralgia, suppressing paroxysmal pain.', detail_es: 'Primera línea en neuralgia del trigémino, suprimiendo el dolor paroxístico.', severity: 'medium', onset: 'acute' },
    skin: { effect: 'negative', detail_ru: 'Риск тяжёлых кожных реакций (Стивенс–Джонсон) — выше у носителей HLA-B*1502.', detail_en: 'Risk of severe skin reactions (Stevens–Johnson) — higher in HLA-B*1502 carriers.', detail_es: 'Riesgo de reacciones cutáneas graves (Stevens–Johnson) — mayor en portadores de HLA-B*1502.', severity: 'high', onset: 'acute' },
    spleen: { effect: 'negative', detail_ru: 'Может вызвать апластическую анемию и агранулоцитоз — нужен контроль гемограммы.', detail_en: 'Can cause aplastic anaemia and agranulocytosis — blood-count monitoring needed.', detail_es: 'Puede causar anemia aplásica y agranulocitosis — requiere control hematológico.', severity: 'high', onset: 'chronic' },
    kidneys: { effect: 'negative', detail_ru: 'Вызывает гипонатриемию через SIADH-подобный эффект на водный баланс.', detail_en: 'Causes hyponatraemia via an SIADH-like effect on water balance.', detail_es: 'Causa hiponatremia por un efecto tipo SIADH sobre el balance hídrico.', severity: 'medium', onset: 'chronic' }
  },
  ibuprofen: {
    joints: { effect: 'positive', detail_ru: 'НПВП ингибирует ЦОГ-1/2, снижая синтез простагландинов — обезболивает и снимает воспаление суставов.', detail_en: 'NSAID inhibits COX-1/2, cutting prostaglandin synthesis — relieves pain and joint inflammation.', detail_es: 'AINE inhibe COX-1/2, reduciendo la síntesis de prostaglandinas — alivia el dolor y la inflamación articular.', severity: 'medium', onset: 'acute' },
    stomach: { effect: 'negative', detail_ru: 'Блокада ЦОГ-1 снижает защитную слизь — риск гастрита, пептической язвы и кровотечения.', detail_en: 'COX-1 blockade reduces protective mucus — risk of gastritis, peptic ulcer and bleeding.', detail_es: 'El bloqueo de COX-1 reduce el moco protector — riesgo de gastritis, úlcera péptica y hemorragia.', severity: 'high', onset: 'acute' },
    kidneys: { effect: 'negative', detail_ru: 'Снижает почечный кровоток (ингибиция простагландинов) — острое повреждение почек, задержка натрия.', detail_en: 'Reduces renal blood flow (prostaglandin inhibition) — acute kidney injury, sodium retention.', detail_es: 'Reduce el flujo renal (inhibición de prostaglandinas) — lesión renal aguda, retención de sodio.', severity: 'medium', onset: 'acute' },
    heart: { effect: 'negative', detail_ru: 'Повышает АД и риск инфаркта/инсульта при длительном приёме высоких доз.', detail_en: 'Raises blood pressure and MI/stroke risk with long-term high-dose use.', detail_es: 'Eleva la TA y el riesgo de infarto/ictus con uso prolongado a dosis altas.', severity: 'medium', onset: 'chronic' }
  },
  naproxen: {
    joints: { effect: 'positive', detail_ru: 'Длительно действующий НПВП ингибирует ЦОГ — обезболивает при артрите и подагре дольше ибупрофена.', detail_en: 'Long-acting NSAID inhibits COX — relieves arthritis and gout pain longer than ibuprofen.', detail_es: 'AINE de acción prolongada inhibe COX — alivia el dolor de artritis y gota más que el ibuprofeno.', severity: 'medium', onset: 'acute' },
    stomach: { effect: 'negative', detail_ru: 'Высокий гастро-риск: ингибиция ЦОГ-1 вызывает язвы и желудочно-кишечное кровотечение.', detail_en: 'High GI risk: COX-1 inhibition causes ulcers and gastrointestinal bleeding.', detail_es: 'Alto riesgo GI: la inhibición de COX-1 causa úlceras y hemorragia gastrointestinal.', severity: 'high', onset: 'acute' },
    kidneys: { effect: 'negative', detail_ru: 'Снижает почечную перфузию через простагландины — риск ОПП и задержки жидкости.', detail_en: 'Reduces renal perfusion via prostaglandins — risk of AKI and fluid retention.', detail_es: 'Reduce la perfusión renal vía prostaglandinas — riesgo de IRA y retención de líquidos.', severity: 'medium', onset: 'acute' }
  },
  warfarin: {
    vessels: { effect: 'positive', detail_ru: 'Ингибирует витамин-K-зависимые факторы свёртывания — предотвращает тромбоз и эмболию.', detail_en: 'Inhibits vitamin-K-dependent clotting factors — prevents thrombosis and embolism.', detail_es: 'Inhibe los factores de coagulación dependientes de vitamina K — previene trombosis y embolia.', severity: 'high', onset: 'chronic' },
    heart: { effect: 'positive', detail_ru: 'При фибрилляции предсердий снижает риск кардиоэмболического инсульта.', detail_en: 'In atrial fibrillation reduces the risk of cardioembolic stroke.', detail_es: 'En fibrilación auricular reduce el riesgo de ictus cardioembólico.', severity: 'high', onset: 'chronic' },
    brain: { effect: 'negative', detail_ru: 'При передозировке (высокий МНО) — внутричерепное кровоизлияние; узкое терапевтическое окно.', detail_en: 'Over-anticoagulation (high INR) — intracranial haemorrhage; narrow therapeutic window.', detail_es: 'Sobreanticoagulación (INR alto) — hemorragia intracraneal; ventana terapéutica estrecha.', severity: 'high', onset: 'acute' },
    stomach: { effect: 'negative', detail_ru: 'Повышает риск желудочно-кишечного кровотечения; усиливается множеством лекарств и продуктов.', detail_en: 'Raises gastrointestinal bleeding risk; potentiated by many drugs and foods.', detail_es: 'Aumenta el riesgo de hemorragia gastrointestinal; potenciado por muchos fármacos y alimentos.', severity: 'high', onset: 'acute' }
  },
  metformin: {
    liver: { effect: 'positive', detail_ru: 'Подавляет печёночный глюконеогенез (через AMPK) — основной механизм снижения глюкозы при СД2.', detail_en: 'Suppresses hepatic gluconeogenesis (via AMPK) — primary glucose-lowering mechanism in T2D.', detail_es: 'Suprime la gluconeogénesis hepática (vía AMPK) — mecanismo principal de reducción de glucosa en DM2.', severity: 'high', onset: 'chronic' },
    muscles: { effect: 'positive', detail_ru: 'Повышает чувствительность периферических тканей к инсулину, усиливая захват глюкозы.', detail_en: 'Increases peripheral tissue insulin sensitivity, enhancing glucose uptake.', detail_es: 'Aumenta la sensibilidad a la insulina de los tejidos periféricos, mejorando la captación de glucosa.', severity: 'medium', onset: 'chronic' },
    stomach: { effect: 'negative', detail_ru: 'Частые желудочно-кишечные расстройства: тошнота, диарея; смягчается приёмом с едой/форма XR.', detail_en: 'Common GI upset: nausea, diarrhoea; eased by taking with food/XR formulation.', detail_es: 'Molestias GI frecuentes: náuseas, diarrea; se atenúan tomándolo con comida/formulación XR.', severity: 'low', onset: 'acute' },
    kidneys: { effect: 'negative', detail_ru: 'При почечной недостаточности накапливается — риск редкого, но опасного лактоацидоза.', detail_en: 'Accumulates in renal impairment — risk of rare but dangerous lactic acidosis.', detail_es: 'Se acumula en insuficiencia renal — riesgo de acidosis láctica rara pero peligrosa.', severity: 'high', onset: 'acute' }
  },
  atorvastatin: {
    vessels: { effect: 'positive', detail_ru: 'Ингибирует ГМГ-КоА-редуктазу, снижая ЛПНП и стабилизируя атеросклеротические бляшки.', detail_en: 'Inhibits HMG-CoA reductase, lowering LDL and stabilising atherosclerotic plaques.', detail_es: 'Inhibe la HMG-CoA reductasa, reduciendo LDL y estabilizando placas ateroscleróticas.', severity: 'high', onset: 'chronic' },
    heart: { effect: 'positive', detail_ru: 'Снижает риск инфаркта и сердечно-сосудистой смерти (первичная и вторичная профилактика).', detail_en: 'Reduces risk of myocardial infarction and cardiovascular death (primary and secondary prevention).', detail_es: 'Reduce el riesgo de infarto y muerte cardiovascular (prevención primaria y secundaria).', severity: 'high', onset: 'chronic' },
    muscles: { effect: 'negative', detail_ru: 'Может вызвать миалгию, миопатию и редко рабдомиолиз — боль в мышцах требует контроля КФК.', detail_en: 'Can cause myalgia, myopathy and rarely rhabdomyolysis — muscle pain warrants CK check.', detail_es: 'Puede causar mialgia, miopatía y raramente rabdomiólisis — el dolor muscular obliga a control de CK.', severity: 'medium', onset: 'chronic' },
    liver: { effect: 'negative', detail_ru: 'Может повышать трансаминазы; редко — лекарственное поражение печени, контроль АЛТ.', detail_en: 'Can elevate transaminases; rarely drug-induced liver injury, monitor ALT.', detail_es: 'Puede elevar las transaminasas; raramente daño hepático inducido, controlar ALT.', severity: 'low', onset: 'chronic' }
  },
  levothyroxine: {
    thyroid: { effect: 'positive', detail_ru: 'Синтетический T4 замещает дефицит гормона при гипотиреозе, нормализуя метаболизм.', detail_en: 'Synthetic T4 replaces hormone deficit in hypothyroidism, normalising metabolism.', detail_es: 'T4 sintética reemplaza el déficit hormonal en hipotiroidismo, normalizando el metabolismo.', severity: 'high', onset: 'chronic' },
    heart: { effect: 'negative', detail_ru: 'Передозировка вызывает тахикардию, аритмию (фибрилляцию предсердий); осторожно у пожилых.', detail_en: 'Over-replacement causes tachycardia, arrhythmia (atrial fibrillation); caution in the elderly.', detail_es: 'El exceso de dosis causa taquicardia, arritmia (fibrilación auricular); precaución en ancianos.', severity: 'medium', onset: 'acute' },
    bones: { effect: 'negative', detail_ru: 'Хроническая передозировка ускоряет резорбцию кости — снижение МПК и риск переломов.', detail_en: 'Chronic over-replacement accelerates bone resorption — reduced BMD and fracture risk.', detail_es: 'El exceso crónico acelera la resorción ósea — menor DMO y riesgo de fractura.', severity: 'medium', onset: 'chronic' }
  },
  cannabis: {
    brain_emotion_amygdala: { effect: 'positive', detail_ru: 'Острая активация CB1 в миндалине даёт анксиолизис и расслабление в низких дозах.', detail_en: 'Acute CB1 activation in the amygdala produces anxiolysis and relaxation at low doses.', detail_es: 'La activación aguda de CB1 en la amígdala produce ansiólisis y relajación a dosis bajas.', severity: 'low', onset: 'acute' },
    brain_memory_hippocampus: { effect: 'negative', detail_ru: 'ТГК нарушает консолидацию памяти в гиппокампе; хроническое употребление подростками — стойкий когнитивный дефицит.', detail_en: 'THC impairs hippocampal memory consolidation; chronic adolescent use causes lasting cognitive deficits.', detail_es: 'El THC altera la consolidación de memoria hipocampal; el uso crónico adolescente causa déficits cognitivos duraderos.', severity: 'medium', onset: 'chronic' },
    lungs: { effect: 'negative', detail_ru: 'Курение раздражает дыхательные пути — хронический бронхит, кашель и продукция мокроты.', detail_en: 'Smoking irritates the airways — chronic bronchitis, cough and sputum production.', detail_es: 'Fumar irrita las vías respiratorias — bronquitis crónica, tos y producción de esputo.', severity: 'medium', onset: 'chronic' },
    heart: { effect: 'negative', detail_ru: 'Острая тахикардия и повышение АД; риск инфаркта в первый час у уязвимых лиц.', detail_en: 'Acute tachycardia and raised BP; MI risk in the first hour in vulnerable individuals.', detail_es: 'Taquicardia aguda y aumento de la TA; riesgo de infarto en la primera hora en personas vulnerables.', severity: 'medium', onset: 'acute' }
  },
  ketamine: {
    brain_glutamatergic: { effect: 'positive', detail_ru: 'NMDA-антагонизм запускает быстрый антидепрессивный эффект через всплеск глутамата и синаптогенез.', detail_en: 'NMDA antagonism drives a rapid antidepressant effect via a glutamate surge and synaptogenesis.', detail_es: 'El antagonismo NMDA produce un efecto antidepresivo rápido mediante una descarga de glutamato y sinaptogénesis.', severity: 'high', onset: 'acute' },
    brain_memory_hippocampus: { effect: 'negative', detail_ru: 'Вызывает диссоциацию и нарушение памяти; при злоупотреблении — стойкий когнитивный дефицит.', detail_en: 'Causes dissociation and memory disruption; with abuse, persistent cognitive deficits.', detail_es: 'Causa disociación y alteración de la memoria; con el abuso, déficits cognitivos persistentes.', severity: 'medium', onset: 'acute' },
    kidneys: { effect: 'negative', detail_ru: 'Хроническое злоупотребление вызывает кетаминовый язвенный цистит мочевого пузыря и гидронефроз.', detail_en: 'Chronic abuse causes ketamine ulcerative cystitis of the bladder and hydronephrosis.', detail_es: 'El abuso crónico causa cistitis ulcerosa vesical por ketamina e hidronefrosis.', severity: 'high', onset: 'chronic' },
    liver: { effect: 'negative', detail_ru: 'Частое употребление в высоких дозах вызывает холангиопатию и повреждение печени.', detail_en: 'Frequent high-dose use causes cholangiopathy and hepatic injury.', detail_es: 'El uso frecuente a dosis altas causa colangiopatía y daño hepático.', severity: 'medium', onset: 'chronic' }
  },
  psilocybin: {
    brain_serotonergic: { effect: 'positive', detail_ru: 'Псилоцин — агонист 5HT2A; в исследованиях снижает резистентную депрессию и тревогу при поддержке терапии.', detail_en: 'Psilocin is a 5HT2A agonist; trials show reduced treatment-resistant depression and anxiety with therapy support.', detail_es: 'La psilocina es agonista 5HT2A; los ensayos muestran reducción de depresión resistente y ansiedad con apoyo terapéutico.', severity: 'high', onset: 'acute' },
    brain_attention_prefrontal: { effect: 'positive', detail_ru: 'Перестраивает префронтальную связность, ослабляя ригидные негативные паттерны мышления.', detail_en: 'Reshapes prefrontal connectivity, loosening rigid negative thought patterns.', detail_es: 'Remodela la conectividad prefrontal, aflojando patrones de pensamiento negativo rígidos.', severity: 'medium', onset: 'acute' },
    brain_emotion_amygdala: { effect: 'negative', detail_ru: 'Может вызвать острую тревогу/панику («бэд-трип») при высокой дозе или плохой обстановке.', detail_en: 'Can trigger acute anxiety/panic (bad trip) at high dose or poor setting.', detail_es: 'Puede provocar ansiedad/pánico agudo (mal viaje) a dosis alta o en un entorno inadecuado.', severity: 'medium', onset: 'acute' },
    heart: { effect: 'negative', detail_ru: 'Умеренное повышение ЧСС и АД; стимуляция 5HT2B при частом приёме теоретически вредна для клапанов.', detail_en: 'Modest rise in heart rate and BP; 5HT2B stimulation with frequent use is theoretically valve-toxic.', detail_es: 'Aumento moderado de frecuencia cardíaca y TA; la estimulación 5HT2B con uso frecuente es teóricamente valvulotóxica.', severity: 'low', onset: 'acute' }
  },
  lsd: {
    brain_serotonergic: { effect: 'positive', detail_ru: 'Мощный агонист 5HT2A вызывает изменённое сознание; исследуется при тревоге и зависимости.', detail_en: 'Potent 5HT2A agonist produces altered consciousness; studied for anxiety and addiction.', detail_es: 'Potente agonista 5HT2A produce conciencia alterada; en estudio para ansiedad y adicción.', severity: 'high', onset: 'acute' },
    brain_attention_prefrontal: { effect: 'positive', detail_ru: 'Усиливает префронтальную пластичность и связность, размывая ригидные когнитивные границы.', detail_en: 'Enhances prefrontal plasticity and connectivity, dissolving rigid cognitive boundaries.', detail_es: 'Aumenta la plasticidad y conectividad prefrontal, disolviendo límites cognitivos rígidos.', severity: 'medium', onset: 'acute' },
    brain_emotion_amygdala: { effect: 'negative', detail_ru: 'Может вызвать острую панику и параноидальные реакции; редко — затяжной HPPD (флешбэки).', detail_en: 'Can cause acute panic and paranoid reactions; rarely prolonged HPPD (flashbacks).', detail_es: 'Puede causar pánico agudo y reacciones paranoides; raramente HPPD prolongado (flashbacks).', severity: 'medium', onset: 'acute' },
    heart: { effect: 'negative', detail_ru: 'Симпатомиметическое повышение ЧСС и АД; вазоконстрикция из-за 5HT2-активности.', detail_en: 'Sympathomimetic rise in heart rate and BP; vasoconstriction from 5HT2 activity.', detail_es: 'Aumento simpaticomimético de frecuencia cardíaca y TA; vasoconstricción por actividad 5HT2.', severity: 'low', onset: 'acute' }
  },
  mdma: {
    brain_serotonergic: { effect: 'negative', detail_ru: 'Острый массивный выброс серотонина даёт эмпатогенез, но повторное употребление — серотонинергическая нейротоксичность и истощение.', detail_en: 'Acute massive serotonin release gives empathogenesis, but repeated use causes serotonergic neurotoxicity and depletion.', detail_es: 'La liberación masiva aguda de serotonina produce empatogénesis, pero el uso repetido causa neurotoxicidad serotoninérgica y depleción.', severity: 'high', onset: 'chronic' },
    heart: { effect: 'negative', detail_ru: 'Симпатомиметик вызывает тахикардию, гипертермию и риск аритмии/сердечной недостаточности.', detail_en: 'Sympathomimetic causes tachycardia, hyperthermia and risk of arrhythmia/heart failure.', detail_es: 'Simpaticomimético causa taquicardia, hipertermia y riesgo de arritmia/insuficiencia cardíaca.', severity: 'high', onset: 'acute' },
    kidneys: { effect: 'negative', detail_ru: 'Гипертермия и неконтролируемое питьё воды вызывают гипонатриемию и риск ОПП/рабдомиолиза.', detail_en: 'Hyperthermia and unchecked water intake cause hyponatraemia and risk of AKI/rhabdomyolysis.', detail_es: 'La hipertermia y la ingesta excesiva de agua causan hiponatremia y riesgo de IRA/rabdomiólisis.', severity: 'high', onset: 'acute' },
    liver: { effect: 'negative', detail_ru: 'Гипертермия и токсичность метаболитов могут вызвать острую печёночную недостаточность.', detail_en: 'Hyperthermia and metabolite toxicity can cause acute hepatic failure.', detail_es: 'La hipertermia y la toxicidad de los metabolitos pueden causar insuficiencia hepática aguda.', severity: 'high', onset: 'acute' }
  },
  cocaine: {
    brain_dopaminergic: { effect: 'positive', detail_ru: 'Блокирует обратный захват дофамина, давая острую эйфорию; то же подкрепление ведёт к тяжёлой зависимости.', detail_en: 'Blocks dopamine reuptake giving acute euphoria; the same reinforcement drives severe addiction.', detail_es: 'Bloquea la recaptación de dopamina dando euforia aguda; ese mismo refuerzo conduce a adicción grave.', severity: 'high', onset: 'acute' },
    heart: { effect: 'negative', detail_ru: 'Вызывает коронарный спазм, тахикардию и гипертензию — риск инфаркта и аритмии даже у молодых.', detail_en: 'Causes coronary spasm, tachycardia and hypertension — MI and arrhythmia risk even in the young.', detail_es: 'Causa espasmo coronario, taquicardia e hipertensión — riesgo de infarto y arritmia incluso en jóvenes.', severity: 'high', onset: 'acute' },
    vessels: { effect: 'negative', detail_ru: 'Интенсивная вазоконстрикция повышает риск инсульта, расслоения аорты и ишемии тканей.', detail_en: 'Intense vasoconstriction raises risk of stroke, aortic dissection and tissue ischaemia.', detail_es: 'La vasoconstricción intensa eleva el riesgo de ictus, disección aórtica e isquemia tisular.', severity: 'high', onset: 'acute' },
    skin: { effect: 'negative', detail_ru: 'Интраназальное употребление вызывает некроз носовой перегородки из-за хронической вазоконстрикции.', detail_en: 'Intranasal use causes nasal-septum necrosis from chronic vasoconstriction.', detail_es: 'El uso intranasal causa necrosis del tabique nasal por vasoconstricción crónica.', severity: 'medium', onset: 'chronic' }
  },
  amphetamine: {
    brain_dopaminergic: { effect: 'positive', detail_ru: 'Высвобождает дофамин/норадреналин, давая острый прилив энергии и эйфории; повторно — зависимость.', detail_en: 'Releases dopamine/noradrenaline giving an acute surge of energy and euphoria; repeated use leads to addiction.', detail_es: 'Libera dopamina/noradrenalina dando un subidón agudo de energía y euforia; el uso repetido lleva a adicción.', severity: 'high', onset: 'acute' },
    heart: { effect: 'negative', detail_ru: 'Симпатомиметик вызывает тахикардию, гипертензию и риск инфаркта, аритмии и кардиомиопатии.', detail_en: 'Sympathomimetic causes tachycardia, hypertension and risk of MI, arrhythmia and cardiomyopathy.', detail_es: 'Simpaticomimético causa taquicardia, hipertensión y riesgo de infarto, arritmia y cardiomiopatía.', severity: 'high', onset: 'acute' },
    brain: { effect: 'negative', detail_ru: 'Высокие дозы вызывают психоз и стимуляторную нейротоксичность дофаминовых терминалей.', detail_en: 'High doses cause psychosis and stimulant neurotoxicity of dopamine terminals.', detail_es: 'Las dosis altas causan psicosis y neurotoxicidad estimulante de las terminales dopaminérgicas.', severity: 'high', onset: 'chronic' },
    skin: { effect: 'negative', detail_ru: 'Хроническое употребление вызывает бруксизм, расчёсы кожи («формикация») и плохое заживление.', detail_en: 'Chronic use causes bruxism, skin-picking (formication) and poor wound healing.', detail_es: 'El uso crónico causa bruxismo, rascado de la piel (formicación) y mala cicatrización.', severity: 'medium', onset: 'chronic' }
  },
  alcohol: {
    brain_gabaergic: { effect: 'positive', detail_ru: 'Острое усиление ГАМК-А-передачи даёт седацию и расслабление; этот же механизм ведёт к толерантности и абстиненции.', detail_en: 'Acute GABA-A potentiation gives sedation and relaxation; the same mechanism drives tolerance and withdrawal.', detail_es: 'La potenciación aguda de GABA-A da sedación y relajación; ese mismo mecanismo conduce a tolerancia y abstinencia.', severity: 'low', onset: 'acute' },
    liver: { effect: 'negative', detail_ru: 'Хроническое употребление вызывает стеатоз, алкогольный гепатит и цирроз печени.', detail_en: 'Chronic use causes steatosis, alcoholic hepatitis and cirrhosis.', detail_es: 'El uso crónico causa esteatosis, hepatitis alcohólica y cirrosis.', severity: 'high', onset: 'chronic' },
    brain_memory_hippocampus: { effect: 'negative', detail_ru: 'Нарушает гиппокампальную память (провалы); дефицит тиамина даёт амнестический синдром Корсакова.', detail_en: 'Impairs hippocampal memory (blackouts); thiamine deficiency causes Korsakoff amnestic syndrome.', detail_es: 'Altera la memoria hipocampal (lagunas); el déficit de tiamina causa el síndrome amnésico de Korsakoff.', severity: 'high', onset: 'chronic' },
    pancreas: { effect: 'negative', detail_ru: 'Вызывает острый и хронический панкреатит с риском диабета и мальабсорбции.', detail_en: 'Causes acute and chronic pancreatitis with risk of diabetes and malabsorption.', detail_es: 'Causa pancreatitis aguda y crónica con riesgo de diabetes y malabsorción.', severity: 'high', onset: 'chronic' },
    heart: { effect: 'negative', detail_ru: 'Хроническое употребление вызывает дилатационную кардиомиопатию, аритмию и гипертензию.', detail_en: 'Chronic use causes dilated cardiomyopathy, arrhythmia (holiday heart) and hypertension.', detail_es: 'El uso crónico causa miocardiopatía dilatada, arritmia (holiday heart) e hipertensión.', severity: 'medium', onset: 'chronic' }
  },
  nicotine: {
    brain_dopaminergic: { effect: 'positive', detail_ru: 'Активирует никотиновые рецепторы, высвобождая дофамин в системе вознаграждения — основа сильной зависимости.', detail_en: 'Activates nicotinic receptors releasing reward-system dopamine — the basis of strong addiction.', detail_es: 'Activa receptores nicotínicos liberando dopamina en el sistema de recompensa — base de la fuerte adicción.', severity: 'high', onset: 'acute' },
    lungs: { effect: 'negative', detail_ru: 'Табачный дым вызывает ХОБЛ и рак лёгкого; никотин повреждает реснитчатый эпителий и сужает бронхи.', detail_en: 'Tobacco smoke causes COPD and lung cancer; nicotine harms ciliary epithelium and narrows airways.', detail_es: 'El humo del tabaco causa EPOC y cáncer de pulmón; la nicotina daña el epitelio ciliar y estrecha las vías aéreas.', severity: 'high', onset: 'chronic' },
    heart: { effect: 'negative', detail_ru: 'Повышает ЧСС, АД и потребность миокарда в кислороде — ускоряет ИБС и риск инфаркта.', detail_en: 'Raises heart rate, BP and myocardial oxygen demand — accelerates coronary disease and MI risk.', detail_es: 'Eleva la frecuencia cardíaca, la TA y la demanda miocárdica de oxígeno — acelera la enfermedad coronaria y el riesgo de infarto.', severity: 'high', onset: 'chronic' },
    vessels: { effect: 'negative', detail_ru: 'Способствует эндотелиальной дисфункции и атеросклерозу — болезнь периферических артерий.', detail_en: 'Promotes endothelial dysfunction and atherosclerosis — peripheral arterial disease.', detail_es: 'Promueve disfunción endotelial y aterosclerosis — enfermedad arterial periférica.', severity: 'high', onset: 'chronic' }
  },
  caffeine: {
    brain_attention_prefrontal: { effect: 'positive', detail_ru: 'Антагонизм аденозиновых рецепторов повышает бодрость, концентрацию и снижает усталость.', detail_en: 'Adenosine-receptor antagonism boosts alertness, focus and reduces fatigue.', detail_es: 'El antagonismo de receptores de adenosina aumenta el estado de alerta, la concentración y reduce la fatiga.', severity: 'low', onset: 'acute' },
    heart: { effect: 'negative', detail_ru: 'В высоких дозах вызывает сердцебиение, тахикардию и эктопические сокращения.', detail_en: 'At high doses causes palpitations, tachycardia and ectopic beats.', detail_es: 'A dosis altas causa palpitaciones, taquicardia y latidos ectópicos.', severity: 'low', onset: 'acute' },
    stomach: { effect: 'negative', detail_ru: 'Стимулирует секрецию желудочной кислоты — изжога и обострение гастрита/рефлюкса.', detail_en: 'Stimulates gastric acid secretion — heartburn and aggravation of gastritis/reflux.', detail_es: 'Estimula la secreción de ácido gástrico — acidez y agravamiento de gastritis/reflujo.', severity: 'low', onset: 'acute' }
  }
};

module.exports = { DIAG_LINKS_EXT, ORGAN_EFFECTS };
