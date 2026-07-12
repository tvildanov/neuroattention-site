// api/library-ru/articles.js — Russian translations for ARTICLES items.
// Merged onto content.ru by attachRu() in library-seed.js. Figures shared from EN.
// SVG structure (rect/path/marker/defs/viewBox/coords/colors) is byte-for-byte
// identical to EN; only visible <text> labels, <figcaption>, and prose are translated.
module.exports = {
  'what-is-attention': {
    title: 'Что такое внимание? Краткое введение',
    summary: 'Внимание как набор взаимодействующих мозговых сетей — и почему это важно для обучения и саморегуляции.',
    body_html:
      '<p>Мы говорим «уделять внимание», как будто это что-то одно. В мозге же его лучше понимать как несколько сотрудничающих систем, которые вместе решают, какая часть потока входящей информации достигнет осознания и будет направлять поведение.</p>' +
      '<h3>Три системы внимания</h3>' +
      '<figure><svg viewBox="0 0 620 220" width="100%" style="max-width:620px;background:transparent" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagram of alerting, orienting, and executive attention networks">' +
        '<rect x="20" y="70" width="160" height="80" rx="10" fill="#8ab4ff" opacity="0.85"/>' +
        '<rect x="230" y="70" width="160" height="80" rx="10" fill="#78c8eb" opacity="0.85"/>' +
        '<rect x="440" y="70" width="160" height="80" rx="10" fill="#a6a0f0" opacity="0.85"/>' +
        '<text x="100" y="105" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#0b1020">Активация</text>' +
        '<text x="100" y="128" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#0b1020">бдительность</text>' +
        '<text x="310" y="105" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#0b1020">Ориентация</text>' +
        '<text x="310" y="128" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#0b1020">выбор источника</text>' +
        '<text x="520" y="105" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#0b1020">Управление</text>' +
        '<text x="520" y="128" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#0b1020">разрешение конфликта</text>' +
        '<path d="M180 110 L230 110" stroke="#9fb0d0" stroke-width="3" marker-end="url(#ah)"/>' +
        '<path d="M390 110 L440 110" stroke="#9fb0d0" stroke-width="3" marker-end="url(#ah)"/>' +
        '<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#9fb0d0"/></marker></defs>' +
      '</svg><figcaption>Системы активации, ориентации и исполнительного контроля внимания.</figcaption></figure>' +
      '<p>Система <strong>активации</strong> удерживает нас в бдительном, готовом состоянии. Система <strong>ориентации</strong> выбирает, какой источник информации обследовать, — лицо в толпе, слово на странице. <strong>Исполнительная</strong> система разрешает конфликт между конкурирующими реакциями и наиболее тесно связана с самоконтролем и обучением.</p>' +
      '<h3>Сверху вниз и снизу вверх</h3>' +
      '<p>Внимание тянут в две стороны. <em>Восходящий</em> захват (снизу вверх) вызывается самим стимулом — внезапным шумом, яркой вспышкой. <em>Нисходящий</em> контроль (сверху вниз) отражает наши цели, смещая восприятие в сторону того, что важно для задачи. Умелая сосредоточенность — это во многом способность удерживать нисходящий контроль у руля, когда мир пытается его перехватить.</p>' +
      '<p>Поскольку исполнительное внимание пересекается с саморегуляцией, тренировка внимания — одно из самых переносимых умений, которые мы можем практиковать: она затрагивает обучение, регуляцию эмоций и повседневную доведённость дел до конца.</p>'
  },
  'the-predictive-brain': {
    title: 'Предсказывающий мозг: восприятие как управляемая галлюцинация',
    summary: 'Почему восприятие — это лучшая догадка мозга о своих причинах, корректируемая ошибкой.',
    body_html:
      '<p>Мощная идея современной нейронауки состоит в том, что мозг — не пассивный приёмник сенсорных данных, а активная <strong>машина предсказаний</strong>. Верхние уровни постоянно порождают предсказания о входящих сигналах, и вперёд передаётся лишь рассогласование — <em>ошибка предсказания</em>, — чтобы обновить модель.</p>' +
      '<figure><svg viewBox="0 0 560 210" width="100%" style="max-width:560px;background:transparent" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Predictive coding loop: predictions flow down, errors flow up">' +
        '<rect x="200" y="20" width="160" height="46" rx="8" fill="#a6a0f0" opacity="0.85"/>' +
        '<rect x="200" y="150" width="160" height="46" rx="8" fill="#78c8eb" opacity="0.85"/>' +
        '<text x="280" y="48" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#0b1020">Генеративная модель</text>' +
        '<text x="280" y="178" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#0b1020">Сенсорный вход</text>' +
        '<path d="M250 66 L250 150" stroke="#7fd4a8" stroke-width="3" marker-end="url(#d)"/>' +
        '<path d="M310 150 L310 66" stroke="#e88" stroke-width="3" marker-end="url(#u)"/>' +
        '<text x="228" y="112" text-anchor="end" font-family="sans-serif" font-size="11" fill="#7fd4a8">предсказание</text>' +
        '<text x="332" y="112" text-anchor="start" font-family="sans-serif" font-size="11" fill="#e88">ошибка</text>' +
        '<defs><marker id="d" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#7fd4a8"/></marker>' +
        '<marker id="u" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#e88"/></marker></defs>' +
      '</svg><figcaption>Предсказания текут вниз; вверх, чтобы пересмотреть модель, текут лишь ошибки предсказания.</figcaption></figure>' +
      '<p>С этой точки зрения восприятие — своего рода <em>управляемая галлюцинация</em>: лучшая нисходящая догадка мозга о причинах его ощущений, обуздываемая сигналами ошибки от органов чувств. Внимание в той же рамке — это процесс подстройки того, какой вес (точность) придавать конкретным ошибкам предсказания.</p>' +
      '<p>Эта рамка объединяет восприятие, действие и внимание как разные способы минимизации ошибки предсказания — и в своей самой амбициозной форме смыкается с принципом свободной энергии и теориями сознания. О том, как эти идеи распространяются на сознательный опыт, см. раздел <em>Теории</em>.</p>'
  }
};
