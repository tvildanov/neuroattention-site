/* Validated screening-test content (tri-lingual). Consumed by screening.js.
 *
 * These are freely-distributable public-health screeners reproduced for
 * self-administration. EVERY result is a probability signal, NOT a diagnosis
 * (see `disclaimer`). Item wording is verbatim from the authoritative English
 * source; ru/es are faithful translations. Scoring params come straight from
 * the instrument's published algorithm — see each `citation`.
 */
(function () {
  var DIS = {
    ru: 'Это скрининг, а НЕ диагноз. Он лишь указывает на вероятность и не заменяет консультацию врача. При тревожащих результатах обязательно обратитесь к специалисту.',
    en: 'This is a screening tool, NOT a diagnosis. It only indicates likelihood and does not replace a professional evaluation. If the result concerns you, please consult a specialist.',
    es: 'Esto es un cribado, NO un diagnóstico. Solo indica probabilidad y no sustituye una evaluación profesional. Si el resultado te preocupa, consulta a un especialista.'
  };
  var CRISIS = {
    ru: 'Вы отметили мысли о самоповреждении или смерти. Пожалуйста, обратитесь за помощью прямо сейчас: телефон доверия 8-800-2000-122 (РФ, бесплатно, круглосуточно), 988 (США), 112 (ЕС). Если есть непосредственная опасность — звоните в экстренные службы (112).',
    en: 'You indicated thoughts of self-harm or being better off dead. Please reach out now: a crisis line (988 in the US, 111/116 123 in the UK) or emergency services (112 in the EU). If you are in immediate danger, call emergency services.',
    es: 'Has indicado pensamientos de autolesión o de muerte. Busca ayuda ahora: línea de crisis (024 en España, 988 en EE. UU.) o emergencias (112 en la UE). Si hay peligro inmediato, llama a emergencias.'
  };

  // shared response scales ---------------------------------------------------
  var FREQ4 = [ // PHQ-9 / GAD-7
    { v: 0, label: { ru: 'Совсем нет', en: 'Not at all', es: 'Para nada' } },
    { v: 1, label: { ru: 'Несколько дней', en: 'Several days', es: 'Varios días' } },
    { v: 2, label: { ru: 'Больше половины дней', en: 'More than half the days', es: 'Más de la mitad de los días' } },
    { v: 3, label: { ru: 'Почти каждый день', en: 'Nearly every day', es: 'Casi todos los días' } }
  ];
  var PCL5SCALE = [
    { v: 0, label: { ru: 'Совсем нет', en: 'Not at all', es: 'Nada' } },
    { v: 1, label: { ru: 'Немного', en: 'A little bit', es: 'Un poco' } },
    { v: 2, label: { ru: 'Умеренно', en: 'Moderately', es: 'Moderadamente' } },
    { v: 3, label: { ru: 'Довольно сильно', en: 'Quite a bit', es: 'Bastante' } },
    { v: 4, label: { ru: 'Очень сильно', en: 'Extremely', es: 'Extremadamente' } }
  ];
  var YESNO = [
    { v: 0, label: { ru: 'Нет', en: 'No', es: 'No' } },
    { v: 1, label: { ru: 'Да', en: 'Yes', es: 'Sí' } }
  ];
  var MDQSEV = [
    { v: 0, label: { ru: 'Нет проблемы', en: 'No problem', es: 'Ningún problema' } },
    { v: 1, label: { ru: 'Незначительная', en: 'Minor problem', es: 'Problema menor' } },
    { v: 2, label: { ru: 'Умеренная', en: 'Moderate problem', es: 'Problema moderado' } },
    { v: 3, label: { ru: 'Серьёзная', en: 'Serious problem', es: 'Problema grave' } }
  ];

  function it(ru, en, es) { return { text: { ru: ru, en: en, es: es } }; }

  var D = {};

  // ── PHQ-9 (depression) ─────────────────────────────────────────────────────
  D['phq-9'] = {
    slug: 'phq-9',
    stem: { ru: 'За последние 2 недели как часто вас беспокоили следующие проблемы?',
            en: 'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
            es: 'En las últimas 2 semanas, ¿con qué frecuencia te han molestado los siguientes problemas?' },
    scale: FREQ4,
    items: [
      it('Мало интереса или удовольствия от занятий', 'Little interest or pleasure in doing things', 'Poco interés o placer en hacer cosas'),
      it('Подавленное настроение, угнетённость или безнадёжность', 'Feeling down, depressed, or hopeless', 'Sentirte decaído(a), deprimido(a) o sin esperanza'),
      it('Трудности с засыпанием, сном или слишком долгий сон', 'Trouble falling or staying asleep, or sleeping too much', 'Problemas para dormir, permanecer dormido(a) o dormir demasiado'),
      it('Усталость или упадок сил', 'Feeling tired or having little energy', 'Sentirte cansado(a) o con poca energía'),
      it('Плохой аппетит или переедание', 'Poor appetite or overeating', 'Poco apetito o comer en exceso'),
      it('Плохое мнение о себе — что вы неудачник или подвели себя или семью', 'Feeling bad about yourself — or that you are a failure or have let yourself or your family down', 'Sentirte mal contigo mismo(a), o que eres un fracaso o has decepcionado a tu familia'),
      it('Трудности с концентрацией, например при чтении или просмотре ТВ', 'Trouble concentrating on things, such as reading the newspaper or watching television', 'Dificultad para concentrarte, por ejemplo al leer o ver televisión'),
      it('Двигались или говорили так медленно, что окружающие замечали; или наоборот — были настолько беспокойны, что двигались намного больше обычного', 'Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual', 'Moverte o hablar tan lento que otros lo notaron; o lo contrario, estar tan inquieto(a) que te movías mucho más de lo habitual'),
      it('Мысли о том, что вам было бы лучше умереть, или о причинении себе вреда', 'Thoughts that you would be better off dead, or of hurting yourself in some way', 'Pensamientos de que estarías mejor muerto(a) o de hacerte daño')
    ],
    scoring: { type: 'sum', cutoff: 10 },
    bands: [
      { key: 'minimal', min: 0, max: 4, label: { ru: 'Минимальные симптомы', en: 'Minimal', es: 'Mínimo' }, detail: { ru: 'Признаков депрессии практически нет.', en: 'Little to no sign of depression.', es: 'Poca o ninguna señal de depresión.' }, tone: 'good' },
      { key: 'mild', min: 5, max: 9, label: { ru: 'Лёгкая', en: 'Mild', es: 'Leve' }, detail: { ru: 'Лёгкие симптомы — понаблюдайте за динамикой.', en: 'Mild symptoms — worth monitoring.', es: 'Síntomas leves — conviene observar.' }, tone: 'ok' },
      { key: 'moderate', min: 10, max: 14, label: { ru: 'Умеренная', en: 'Moderate', es: 'Moderado' }, detail: { ru: 'Уровень выше клинического порога (≥10). Стоит обсудить со специалистом.', en: 'Above the clinical cutoff (≥10). Consider discussing with a professional.', es: 'Por encima del umbral clínico (≥10). Considera hablar con un profesional.' }, tone: 'warn' },
      { key: 'mod-severe', min: 15, max: 19, label: { ru: 'Умеренно тяжёлая', en: 'Moderately severe', es: 'Moderadamente grave' }, detail: { ru: 'Выраженные симптомы. Рекомендуется консультация врача.', en: 'Marked symptoms. A professional evaluation is recommended.', es: 'Síntomas marcados. Se recomienda evaluación profesional.' }, tone: 'bad' },
      { key: 'severe', min: 20, max: 27, label: { ru: 'Тяжёлая', en: 'Severe', es: 'Grave' }, detail: { ru: 'Тяжёлые симптомы. Настоятельно рекомендуется обратиться к специалисту.', en: 'Severe symptoms. Professional help is strongly recommended.', es: 'Síntomas graves. Se recomienda encarecidamente ayuda profesional.' }, tone: 'bad' }
    ],
    flags: [ { itemIndex: 8, minValue: 1, crisis: true, message: CRISIS } ],
    citation: 'Kroenke, Spitzer & Williams (2001), J Gen Intern Med 16(9):606-613.',
    validity: { ru: 'Порог ≥10: чувствительность 88%, специфичность 88%.', en: 'Cutoff ≥10: sensitivity 88%, specificity 88%.', es: 'Umbral ≥10: sensibilidad 88%, especificidad 88%.' },
    disclaimer: DIS
  };

  // ── GAD-7 (anxiety) ─────────────────────────────────────────────────────────
  D['gad-7'] = {
    slug: 'gad-7',
    stem: { ru: 'За последние 2 недели как часто вас беспокоили следующие проблемы?',
            en: 'Over the last 2 weeks, how often have you been bothered by the following problems?',
            es: 'En las últimas 2 semanas, ¿con qué frecuencia te han molestado los siguientes problemas?' },
    scale: FREQ4,
    items: [
      it('Нервозность, тревога или взвинченность', 'Feeling nervous, anxious, or on edge', 'Sentirte nervioso(a), ansioso(a) o al límite'),
      it('Неспособность остановить или контролировать беспокойство', 'Not being able to stop or control worrying', 'No poder dejar de preocuparte o controlarlo'),
      it('Чрезмерное беспокойство по разным поводам', 'Worrying too much about different things', 'Preocuparte demasiado por diferentes cosas'),
      it('Трудно расслабиться', 'Trouble relaxing', 'Dificultad para relajarte'),
      it('Настолько беспокойны, что трудно усидеть на месте', 'Being so restless that it is hard to sit still', 'Estar tan inquieto(a) que es difícil quedarte quieto(a)'),
      it('Легко раздражаетесь или сердитесь', 'Becoming easily annoyed or irritable', 'Irritarte o molestarte con facilidad'),
      it('Страх, будто может случиться что-то ужасное', 'Feeling afraid, as if something awful might happen', 'Sentir miedo, como si algo terrible pudiera pasar')
    ],
    scoring: { type: 'sum', cutoff: 10 },
    bands: [
      { key: 'minimal', min: 0, max: 4, label: { ru: 'Минимальная тревога', en: 'Minimal anxiety', es: 'Ansiedad mínima' }, detail: { ru: 'Признаков тревожного расстройства практически нет.', en: 'Little to no sign of an anxiety disorder.', es: 'Poca o ninguna señal de trastorno de ansiedad.' }, tone: 'good' },
      { key: 'mild', min: 5, max: 9, label: { ru: 'Лёгкая', en: 'Mild', es: 'Leve' }, detail: { ru: 'Лёгкая тревога — понаблюдайте за динамикой.', en: 'Mild anxiety — worth monitoring.', es: 'Ansiedad leve — conviene observar.' }, tone: 'ok' },
      { key: 'moderate', min: 10, max: 14, label: { ru: 'Умеренная', en: 'Moderate', es: 'Moderado' }, detail: { ru: 'Выше клинического порога (≥10). Стоит обсудить со специалистом.', en: 'Above the clinical cutoff (≥10). Consider discussing with a professional.', es: 'Por encima del umbral clínico (≥10). Considera hablar con un profesional.' }, tone: 'warn' },
      { key: 'severe', min: 15, max: 21, label: { ru: 'Тяжёлая', en: 'Severe', es: 'Grave' }, detail: { ru: 'Выраженная тревога. Рекомендуется консультация специалиста.', en: 'Severe anxiety. A professional evaluation is recommended.', es: 'Ansiedad grave. Se recomienda evaluación profesional.' }, tone: 'bad' }
    ],
    flags: [],
    citation: 'Spitzer, Kroenke, Williams & Löwe (2006), Arch Intern Med 166(10):1092-1097.',
    validity: { ru: 'Порог ≥10: чувствительность 89%, специфичность 82%.', en: 'Cutoff ≥10: sensitivity 89%, specificity 82%.', es: 'Umbral ≥10: sensibilidad 89%, especificidad 82%.' },
    disclaimer: DIS
  };

  // ── PCL-5 (PTSD) ────────────────────────────────────────────────────────────
  D['pcl-5'] = {
    slug: 'pcl-5',
    stem: { ru: 'Держа в уме самое тяжёлое событие, укажите, насколько за последний месяц вас беспокоила каждая проблема.',
            en: 'Keeping your worst event in mind — in the past month, how much were you bothered by:',
            es: 'Teniendo en mente tu peor experiencia — en el último mes, ¿cuánto te ha molestado:' },
    scale: PCL5SCALE,
    items: [
      it('Повторяющиеся, тревожные и нежелательные воспоминания о стрессовом событии?', 'Repeated, disturbing, and unwanted memories of the stressful experience?', '¿Recuerdos repetidos, angustiantes e indeseados de la experiencia estresante?'),
      it('Повторяющиеся тревожные сны о стрессовом событии?', 'Repeated, disturbing dreams of the stressful experience?', '¿Sueños repetidos y angustiantes sobre la experiencia?'),
      it('Внезапное чувство или поведение, будто стрессовое событие происходит снова?', 'Suddenly feeling or acting as if the stressful experience were actually happening again?', '¿Sentir o actuar de repente como si la experiencia volviera a ocurrir?'),
      it('Сильное расстройство при напоминании о стрессовом событии?', 'Feeling very upset when something reminded you of the stressful experience?', '¿Sentirte muy alterado(a) cuando algo te recordaba la experiencia?'),
      it('Сильные телесные реакции при напоминании (сердцебиение, затруднённое дыхание, потливость)?', 'Having strong physical reactions when something reminded you of the stressful experience (heart pounding, trouble breathing, sweating)?', '¿Reacciones físicas fuertes ante recordatorios (palpitaciones, falta de aire, sudor)?'),
      it('Избегание воспоминаний, мыслей или чувств, связанных с событием?', 'Avoiding memories, thoughts, or feelings related to the stressful experience?', '¿Evitar recuerdos, pensamientos o sentimientos relacionados?'),
      it('Избегание внешних напоминаний (люди, места, разговоры, ситуации)?', 'Avoiding external reminders of the stressful experience (people, places, conversations, activities, objects, or situations)?', '¿Evitar recordatorios externos (personas, lugares, conversaciones, situaciones)?'),
      it('Трудности с воспоминанием важных частей события?', 'Trouble remembering important parts of the stressful experience?', '¿Dificultad para recordar partes importantes de la experiencia?'),
      it('Сильные негативные убеждения о себе, других людях или мире?', 'Having strong negative beliefs about yourself, other people, or the world?', '¿Creencias negativas fuertes sobre ti, los demás o el mundo?'),
      it('Обвинение себя или других за событие или его последствия?', 'Blaming yourself or someone else for the stressful experience or what happened after it?', '¿Culparte a ti o a otros por la experiencia o sus consecuencias?'),
      it('Сильные негативные чувства: страх, ужас, гнев, вина или стыд?', 'Having strong negative feelings such as fear, horror, anger, guilt, or shame?', '¿Sentimientos negativos fuertes como miedo, horror, ira, culpa o vergüenza?'),
      it('Потеря интереса к занятиям, которые раньше нравились?', 'Loss of interest in activities that you used to enjoy?', '¿Pérdida de interés en actividades que antes disfrutabas?'),
      it('Чувство отдалённости или отрезанности от других людей?', 'Feeling distant or cut off from other people?', '¿Sentirte distante o aislado(a) de los demás?'),
      it('Трудности испытывать положительные чувства?', 'Trouble experiencing positive feelings (unable to feel happiness or loving feelings)?', '¿Dificultad para sentir emociones positivas (felicidad o cariño)?'),
      it('Раздражительность, вспышки гнева или агрессивное поведение?', 'Irritable behavior, angry outbursts, or acting aggressively?', '¿Irritabilidad, arrebatos de ira o conducta agresiva?'),
      it('Излишний риск или действия, которые могут причинить вам вред?', 'Taking too many risks or doing things that could cause you harm?', '¿Tomar demasiados riesgos o hacer cosas que podrían dañarte?'),
      it('Чрезмерная настороженность, бдительность или «на страже»?', 'Being "superalert" or watchful or on guard?', '¿Estar "superalerta", vigilante o en guardia?'),
      it('Пугливость или лёгкое вздрагивание?', 'Feeling jumpy or easily startled?', '¿Sobresaltarte con facilidad?'),
      it('Трудности с концентрацией?', 'Having difficulty concentrating?', '¿Dificultad para concentrarte?'),
      it('Трудности с засыпанием или сном?', 'Trouble falling or staying asleep?', '¿Problemas para conciliar o mantener el sueño?')
    ],
    scoring: { type: 'pcl5', cutoff: 33, symMin: 2,
      clusters: [ { key: 'B', from: 0, to: 4, need: 1 }, { key: 'C', from: 5, to: 6, need: 1 }, { key: 'D', from: 7, to: 13, need: 2 }, { key: 'E', from: 14, to: 19, need: 2 } ] },
    bands: [
      { key: 'below', min: 0, max: 32, label: { ru: 'Ниже порога', en: 'Below threshold', es: 'Bajo el umbral' }, detail: { ru: 'Общий балл ниже ориентировочного порога вероятного ПТСР (33).', en: 'Total below the provisional PTSD cutoff (33).', es: 'Puntuación por debajo del umbral provisional de TEPT (33).' }, tone: 'good' },
      { key: 'probable', min: 33, max: 80, label: { ru: 'Вероятное ПТСР', en: 'Probable PTSD', es: 'TEPT probable' }, detail: { ru: 'Балл на уровне/выше ориентировочного порога (33). Рекомендуется профессиональная оценка.', en: 'At/above the provisional cutoff (33). A professional assessment is recommended.', es: 'En/por encima del umbral provisional (33). Se recomienda evaluación profesional.' }, tone: 'bad' }
    ],
    flags: [],
    citation: 'Weathers et al. (2013), National Center for PTSD (public domain).',
    validity: { ru: 'Порог 31–33 (по умолч. 33); α≈0.94. Также применяется кластерный метод DSM-5.', en: 'Cutoff 31-33 (default 33); α≈0.94. DSM-5 cluster method also applied.', es: 'Umbral 31-33 (por defecto 33); α≈0.94. Método de clústeres DSM-5.' },
    disclaimer: DIS
  };

  // ── MDQ (bipolar) ───────────────────────────────────────────────────────────
  var mdqQ1 = { ru: 'Был ли когда-нибудь период, когда вы были не таким, как обычно, и…', en: 'Has there ever been a period of time when you were not your usual self and…', es: '¿Ha habido alguna vez un período en el que no eras tú mismo(a) y…' };
  D['mdq'] = {
    slug: 'mdq',
    stem: mdqQ1,
    scale: YESNO,
    items: [
      it('…чувствовали себя настолько хорошо или «на подъёме», что окружающие считали вас не таким, как обычно, или это приводило к неприятностям?', '…you felt so good or so hyper that other people thought you were not your normal self or you were so hyper that you got into trouble?', '…te sentías tan bien o tan acelerado(a) que otros pensaban que no eras tú, o te metiste en problemas?'),
      it('…были настолько раздражительны, что кричали на людей, затевали ссоры или драки?', '…you were so irritable that you shouted at people or started fights or arguments?', '…estabas tan irritable que gritabas o iniciabas peleas o discusiones?'),
      it('…чувствовали себя гораздо увереннее обычного?', '…you felt much more self-confident than usual?', '…te sentías mucho más seguro(a) de lo habitual?'),
      it('…спали гораздо меньше обычного и не чувствовали в этом потребности?', '…you got much less sleep than usual and found you didn\'t really miss it?', '…dormías mucho menos de lo habitual y no lo echabas de menos?'),
      it('…были гораздо разговорчивее или говорили быстрее обычного?', '…you were much more talkative or spoke faster than usual?', '…hablabas mucho más o más rápido de lo habitual?'),
      it('…мысли неслись в голове и вы не могли замедлить ум?', '…thoughts raced through your head or you couldn\'t slow your mind down?', '…los pensamientos corrían y no podías frenar tu mente?'),
      it('…так легко отвлекались, что было трудно сосредоточиться?', '…you were so easily distracted by things around you that you had trouble concentrating or staying on track?', '…te distraías tan fácilmente que te costaba concentrarte?'),
      it('…было гораздо больше энергии, чем обычно?', '…you had much more energy than usual?', '…tenías mucha más energía de lo habitual?'),
      it('…были гораздо активнее или делали намного больше дел, чем обычно?', '…you were much more active or did many more things than usual?', '…estabas mucho más activo(a) o hacías muchas más cosas?'),
      it('…были гораздо общительнее обычного, например звонили друзьям среди ночи?', '…you were much more social or outgoing than usual, for example, you telephoned friends in the middle of the night?', '…eras mucho más sociable, por ejemplo llamabas a amigos de madrugada?'),
      it('…были гораздо больше заинтересованы в сексе, чем обычно?', '…you were much more interested in sex than usual?', '…tenías mucho más interés en el sexo de lo habitual?'),
      it('…делали то, что для вас необычно, или что другие сочли бы чрезмерным, глупым или рискованным?', '…you did things that were unusual for you or that other people might have thought were excessive, foolish, or risky?', '…hacías cosas inusuales o que otros considerarían excesivas, tontas o arriesgadas?'),
      it('…траты денег создавали проблемы вам или вашей семье?', '…spending money got you or your family in trouble?', '…gastar dinero te causó problemas a ti o a tu familia?'),
      { section: { ru: 'Дополнительные вопросы', en: 'Additional questions', es: 'Preguntas adicionales' },
        text: { ru: 'Если вы ответили «да» более чем на один пункт — случалось ли несколько из них в один и тот же период времени?', en: 'If you checked YES to more than one of the above, have several of these ever happened during the same period of time?', es: 'Si respondiste SÍ a más de uno, ¿ocurrieron varios de ellos durante el mismo período?' } },
      { scale: MDQSEV,
        text: { ru: 'Насколько эти проявления мешали вам (работа, семья, деньги, юридические проблемы, ссоры)?', en: 'How much of a problem did any of these cause you (work; family, money, or legal trouble; arguments or fights)?', es: '¿Cuánto problema te causaron (trabajo; familia, dinero o problemas legales; discusiones o peleas)?' } }
    ],
    scoring: { type: 'mdq', q1Count: 13, q2Index: 13, q3Index: 14, q1Cutoff: 7, q3Cutoff: 2 },
    posBand: { key: 'positive', label: { ru: 'Положительный скрининг', en: 'Positive screen', es: 'Cribado positivo' }, detail: { ru: '≥7 симптомов в один период + значимые проблемы. Оправдана оценка на биполярный спектр специалистом.', en: '≥7 symptoms in the same period + significant impairment. A bipolar-spectrum assessment is warranted.', es: '≥7 síntomas en el mismo período + deterioro significativo. Se justifica una evaluación del espectro bipolar.' }, tone: 'bad' },
    negBand: { key: 'negative', label: { ru: 'Отрицательный скрининг', en: 'Negative screen', es: 'Cribado negativo' }, detail: { ru: 'Критерии положительного скрининга не выполнены.', en: 'The positive-screen criteria were not met.', es: 'No se cumplen los criterios de cribado positivo.' }, tone: 'good' },
    flags: [],
    citation: 'Hirschfeld et al. (2000), Am J Psychiatry 157(11):1873-1875.',
    validity: { ru: 'Чувствительность ~73%, специфичность ~90%. Положительно = ≥7/13 + один период + умеренные/серьёзные проблемы.', en: 'Sensitivity ~73%, specificity ~90%. Positive = ≥7/13 + same period + moderate/serious impairment.', es: 'Sensibilidad ~73%, especificidad ~90%. Positivo = ≥7/13 + mismo período + deterioro moderado/grave.' },
    disclaimer: DIS
  };

  // ── ASRS-v1.1 (adult ADHD, 6-item Part A screener) ──────────────────────────
  var ASRSSCALE = [
    { v: 0, label: { ru: 'Никогда', en: 'Never', es: 'Nunca' } },
    { v: 1, label: { ru: 'Редко', en: 'Rarely', es: 'Raramente' } },
    { v: 2, label: { ru: 'Иногда', en: 'Sometimes', es: 'A veces' } },
    { v: 3, label: { ru: 'Часто', en: 'Often', es: 'A menudo' } },
    { v: 4, label: { ru: 'Очень часто', en: 'Very Often', es: 'Muy a menudo' } }
  ];
  D['asrs-v1-1'] = {
    slug: 'asrs-v1-1',
    stem: { ru: 'Отметьте, как часто это описывало вас за последние 6 месяцев.',
            en: 'Check how often each has described how you felt and conducted yourself over the past 6 months.',
            es: 'Indica con qué frecuencia esto te ha descrito durante los últimos 6 meses.' },
    scale: ASRSSCALE,
    items: [
      it('Как часто вам трудно завершить последние детали проекта, когда сложная часть уже сделана?', 'How often do you have trouble wrapping up the final details of a project, once the challenging parts have been done?', '¿Con qué frecuencia te cuesta terminar los últimos detalles de un proyecto una vez hecho lo difícil?'),
      it('Как часто вам трудно привести дела в порядок при выполнении задачи, требующей организации?', 'How often do you have difficulty getting things in order when you have to do a task that requires organization?', '¿Con qué frecuencia te cuesta ordenar las cosas en una tarea que requiere organización?'),
      it('Как часто у вас проблемы с тем, чтобы вспомнить встречи или обязательства?', 'How often do you have problems remembering appointments or obligations?', '¿Con qué frecuencia tienes problemas para recordar citas u obligaciones?'),
      it('Когда задача требует размышлений, как часто вы избегаете или откладываете начало?', 'When you have a task that requires a lot of thought, how often do you avoid or delay getting started?', 'Cuando una tarea requiere pensar mucho, ¿con qué frecuencia evitas o retrasas empezar?'),
      it('Как часто вы ёрзаете руками или ногами, когда приходится долго сидеть?', 'How often do you fidget or squirm with your hands or feet when you have to sit down for a long time?', '¿Con qué frecuencia mueves manos o pies cuando debes estar sentado(a) mucho tiempo?'),
      it('Как часто вы чувствуете себя чрезмерно активным, будто вас «заводит мотор»?', 'How often do you feel overly active and compelled to do things, like you were driven by a motor?', '¿Con qué frecuencia te sientes demasiado activo(a), como impulsado(a) por un motor?')
    ],
    scoring: { type: 'threshold', thresholds: [2, 2, 2, 3, 3, 3], cutoffCount: 4 },
    posBand: { key: 'positive', label: { ru: 'Симптомы возможно соответствуют СДВГ', en: 'Consistent with adult ADHD', es: 'Compatible con TDAH adulto' }, detail: { ru: '4+ ответа в «значимой» зоне. Симптомы могут соответствовать СДВГ у взрослых — оправдана дальнейшая оценка специалистом.', en: '4+ responses in the significant range. Symptoms may be consistent with adult ADHD — further evaluation is warranted.', es: '4+ respuestas en el rango significativo. Los síntomas podrían ser compatibles con TDAH adulto — se justifica evaluación.' }, tone: 'warn' },
    negBand: { key: 'negative', label: { ru: 'Скрининг отрицательный', en: 'Negative screen', es: 'Cribado negativo' }, detail: { ru: 'Менее 4 ответов в «значимой» зоне.', en: 'Fewer than 4 responses in the significant range.', es: 'Menos de 4 respuestas en el rango significativo.' }, tone: 'good' },
    flags: [],
    citation: 'Kessler et al. (2005), Psychol Med 35(2):245-256 (WHO ASRS).',
    validity: { ru: 'Чувствительность 68.7%, специфичность 99.5%. Положительно = 4+ отметок в затемнённой зоне.', en: 'Sensitivity 68.7%, specificity 99.5%. Positive = 4+ marks in the shaded range.', es: 'Sensibilidad 68.7%, especificidad 99.5%. Positivo = 4+ marcas en la zona sombreada.' },
    disclaimer: DIS
  };

  // ── AQ-10 (adult autism-spectrum quotient, short) ───────────────────────────
  var AQSCALE = [
    { v: 0, label: { ru: 'Полностью согласен', en: 'Definitely agree', es: 'Totalmente de acuerdo' } },
    { v: 1, label: { ru: 'Скорее согласен', en: 'Slightly agree', es: 'Algo de acuerdo' } },
    { v: 2, label: { ru: 'Скорее не согласен', en: 'Slightly disagree', es: 'Algo en desacuerdo' } },
    { v: 3, label: { ru: 'Полностью не согласен', en: 'Definitely disagree', es: 'Totalmente en desacuerdo' } }
  ];
  D['aq-10'] = {
    slug: 'aq-10',
    stem: { ru: 'Отметьте один вариант для каждого утверждения.', en: 'Please tick one option per question only.', es: 'Marca solo una opción por pregunta.' },
    scale: AQSCALE,
    items: [
      it('Я часто замечаю тихие звуки, которых не замечают другие', 'I often notice small sounds when others do not', 'A menudo noto sonidos pequeños que otros no perciben'),
      it('Обычно я больше сосредотачиваюсь на общей картине, чем на мелких деталях', 'I usually concentrate more on the whole picture, rather than the small details', 'Suelo concentrarme más en el conjunto que en los detalles pequeños'),
      it('Мне легко делать несколько дел одновременно', 'I find it easy to do more than one thing at once', 'Me resulta fácil hacer más de una cosa a la vez'),
      it('Если меня прервать, я легко и быстро возвращаюсь к тому, чем занимался', 'If there is an interruption, I can switch back to what I was doing very quickly', 'Si hay una interrupción, retomo lo que hacía muy rápido'),
      it('Мне легко «читать между строк», когда со мной говорят', "I find it easy to 'read between the lines' when someone is talking to me", 'Me resulta fácil «leer entre líneas» cuando alguien me habla'),
      it('Я умею определить, когда слушающему меня становится скучно', 'I know how to tell if someone listening to me is getting bored', 'Sé notar si alguien que me escucha se está aburriendo'),
      it('Читая рассказ, мне трудно понять намерения персонажей', "When I'm reading a story I find it difficult to work out the characters' intentions", 'Al leer una historia me cuesta entender las intenciones de los personajes'),
      it('Мне нравится собирать информацию о категориях вещей (типы машин, птиц, поездов, растений и т. п.)', 'I like to collect information about categories of things (e.g. types of car, types of bird, types of train, types of plant etc)', 'Me gusta coleccionar información sobre categorías (tipos de coche, de ave, de tren, de planta, etc.)'),
      it('Мне легко понять, что человек думает или чувствует, просто по его лицу', 'I find it easy to work out what someone is thinking or feeling just by looking at their face', 'Me resulta fácil saber qué piensa o siente alguien solo por su cara'),
      it('Мне трудно понять намерения людей', "I find it difficult to work out people's intentions", 'Me cuesta entender las intenciones de las personas')
    ],
    // agree-scored: items 1,7,8,10 (idx 0,6,7,9); disagree-scored: 2,3,4,5,6,9 (idx 1,2,3,4,5,8)
    scoring: { type: 'aq10', directions: ['agree', 'disagree', 'disagree', 'disagree', 'disagree', 'disagree', 'agree', 'agree', 'disagree', 'agree'], agreeMax: 1, disagreeMin: 2, cutoff: 6 },
    posBand: { key: 'positive', label: { ru: 'Выше порога направления', en: 'At/above referral cutoff', es: 'En/por encima del umbral' }, detail: { ru: 'Балл ≥6. Рекомендуется рассмотреть направление на специализированную диагностику аутизма.', en: 'Score ≥6. Consider a referral for a specialist autism assessment.', es: 'Puntuación ≥6. Considera derivar a una evaluación especializada de autismo.' }, tone: 'warn' },
    negBand: { key: 'negative', label: { ru: 'Ниже порога направления', en: 'Below referral cutoff', es: 'Bajo el umbral' }, detail: { ru: 'Балл ниже порога направления (6).', en: 'Score below the referral cutoff (6).', es: 'Puntuación por debajo del umbral de derivación (6).' }, tone: 'good' },
    flags: [],
    citation: 'Allison, Auyeung & Baron-Cohen (2012), JAACAP 51(2):202-212.',
    validity: { ru: 'Порог ≥6: чувствительность 0.88, специфичность 0.91 (реком. NICE CG142).', en: 'Cutoff ≥6: sensitivity 0.88, specificity 0.91 (NICE CG142).', es: 'Umbral ≥6: sensibilidad 0.88, especificidad 0.91 (NICE CG142).' },
    disclaimer: DIS
  };

  window.NA_SCREENERS = D;
})();
