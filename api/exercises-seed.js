'use strict';
/* Seed data for the Exercises & Tests tab (migration 060).
 * Each row mirrors the `exercise_definitions` columns. Categories:
 * 'attention' | 'memory' | 'executive' | 'inhibition' | 'speed'.
 * Every task is evidence-based and used in ADHD / Alzheimer / working-memory
 * / attention research; `clinical_evidence` carries the short citation. */

const EXERCISES = [
  {
    slug: 'n-back',
    name_en: 'N-back', name_ru: 'N-назад',
    category: 'memory',
    short_description_en: 'Respond when the current letter matches the one N steps back.',
    short_description_ru: 'Реагируйте, когда буква совпадает с той, что была N шагов назад.',
    measures: ['working_memory', 'updating', 'fluid_intelligence'],
    clinical_evidence: 'Kirchner (1958); Jaeggi et al. (2008, PNAS) — working-memory training with transfer to fluid intelligence; widely used in ADHD research.',
    min_level: 1, max_level: 10, target_regions: ['brain'], sort_order: 10
  },
  {
    slug: 'stroop',
    name_en: 'Stroop Task', name_ru: 'Тест Струпа',
    category: 'inhibition',
    short_description_en: 'Name the ink colour of a colour word, ignoring what it reads.',
    short_description_ru: 'Называйте цвет чернил слова, игнорируя само слово.',
    measures: ['inhibitory_control', 'selective_attention', 'processing_speed'],
    clinical_evidence: 'Stroop (1935, J. Exp. Psychol.) — the classic interference paradigm; sensitive to prefrontal dysfunction, ADHD and early Alzheimer\'s.',
    min_level: 1, max_level: 10, target_regions: ['brain'], sort_order: 20
  },
  {
    slug: 'ant',
    name_en: 'Attention Network Test', name_ru: 'Тест сетей внимания (ANT)',
    category: 'attention',
    short_description_en: 'Judge a central arrow amid flankers to probe three attention networks.',
    short_description_ru: 'Определяйте центральную стрелку среди помех — три сети внимания.',
    measures: ['alerting', 'orienting', 'executive_attention'],
    clinical_evidence: 'Fan et al. (2002, J. Cogn. Neurosci.) — dissociates alerting, orienting and executive attention; applied in ADHD and dementia.',
    min_level: 1, max_level: 10, target_regions: ['brain'], sort_order: 30
  },
  {
    slug: 'sart',
    name_en: 'Sustained Attention (SART)', name_ru: 'Устойчивое внимание (SART)',
    category: 'attention',
    short_description_en: 'Respond to every digit except 3 — withhold on the rare target.',
    short_description_ru: 'Реагируйте на каждую цифру, кроме 3 — тормозите на редкой цели.',
    measures: ['sustained_attention', 'response_inhibition', 'vigilance'],
    clinical_evidence: 'Robertson et al. (1997, Neuropsychologia) — go/no-go vigilance measure validated in TBI and ADHD.',
    min_level: 1, max_level: 10, target_regions: ['brain'], sort_order: 40
  },
  {
    slug: 'corsi',
    name_en: 'Corsi Block-Tapping', name_ru: 'Кубики Корси',
    category: 'memory',
    short_description_en: 'Reproduce the order in which blocks light up.',
    short_description_ru: 'Повторите порядок, в котором вспыхивали кубы.',
    measures: ['visuospatial_memory', 'spatial_span'],
    clinical_evidence: 'Corsi (1972) — the standard visuospatial span task; declines early in Alzheimer\'s disease.',
    min_level: 1, max_level: 10, target_regions: ['brain'], sort_order: 50
  },
  {
    slug: 'digit-span',
    name_en: 'Digit Span', name_ru: 'Запоминание цифр',
    category: 'memory',
    short_description_en: 'Recall a growing string of digits — forward, then in reverse.',
    short_description_ru: 'Воспроизводите растущий ряд цифр — прямо, затем в обратном порядке.',
    measures: ['short_term_memory', 'working_memory', 'attention_span'],
    clinical_evidence: 'Wechsler (WAIS/WMS) — a core clinical span subtest; reverse span indexes working memory.',
    min_level: 1, max_level: 10, target_regions: ['brain'], sort_order: 60
  },
  {
    slug: 'go-no-go',
    name_en: 'Go / No-Go', name_ru: 'Иди / Стоп',
    category: 'inhibition',
    short_description_en: 'Click on the green Go signal, withhold on the red No-Go.',
    short_description_ru: 'Кликайте по зелёному сигналу, тормозите на красном.',
    measures: ['response_inhibition', 'impulsivity', 'motor_control'],
    clinical_evidence: 'Donders (1868); Cook & Rausch — response-inhibition paradigm central to ADHD and impulsivity research.',
    min_level: 1, max_level: 10, target_regions: ['brain'], sort_order: 70
  },
  {
    slug: 'task-switching',
    name_en: 'Task Switching', name_ru: 'Переключение задач',
    category: 'executive',
    short_description_en: 'Switch rule (colour vs shape) on cue — measures the switch cost.',
    short_description_ru: 'Меняйте правило (цвет/форма) по подсказке — цена переключения.',
    measures: ['cognitive_flexibility', 'set_shifting', 'executive_control'],
    clinical_evidence: 'Monsell (2003, Trends Cogn. Sci.) — task-set reconfiguration; switch cost impaired in ADHD and frontal pathology.',
    min_level: 1, max_level: 10, target_regions: ['brain'], sort_order: 80
  },
  {
    slug: 'trail-making',
    name_en: 'Trail Making A / B', name_ru: 'Тест прокладывания пути A / B',
    category: 'speed',
    short_description_en: 'Connect 1-2-3… (A) or 1-A-2-B… (B) as fast as you can.',
    short_description_ru: 'Соединяйте 1-2-3… (A) или 1-А-2-Б… (B) как можно быстрее.',
    measures: ['processing_speed', 'visual_search', 'set_shifting'],
    clinical_evidence: 'Reitan (Halstead-Reitan battery) — Trail B/A ratio is a sensitive screen for executive decline and dementia.',
    min_level: 1, max_level: 10, target_regions: ['brain'], sort_order: 90
  },
  {
    slug: 'attentional-blink',
    name_en: 'Attentional Blink', name_ru: 'Мигание внимания',
    category: 'attention',
    short_description_en: 'Spot two targets in a rapid stream — the second is often missed.',
    short_description_ru: 'Найдите две цели в быстром потоке — вторую часто пропускают.',
    measures: ['temporal_attention', 'attentional_capacity'],
    clinical_evidence: 'Raymond, Shapiro & Arnell (1992, JEP:HPP) — the temporal-attention limit; altered in ADHD and schizophrenia.',
    min_level: 1, max_level: 10, target_regions: ['brain'], sort_order: 100
  }
];

module.exports = { EXERCISES };
