-- 017_tools_access.sql — per-course tool access (Anatomy Atlas pack)
-- Tools catalogue + course→tool grants. A tool is available to a user when it
-- is free-by-default, or when the user has access to a published course that
-- includes it. Existing tools are seeded as free so current access is unchanged;
-- the new anatomy-atlas tool is gated (admin grants it per course).

CREATE TABLE IF NOT EXISTS tools (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_ru TEXT, name_en TEXT, name_es TEXT,
  description_ru TEXT, description_en TEXT, description_es TEXT,
  icon_url TEXT,
  is_free_default BOOLEAN DEFAULT FALSE,
  order_idx INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_tools (
  course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
  tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, tool_id)
);

-- Seed catalogue (idempotent). Existing tools free by default; anatomy gated.
INSERT INTO tools (code, name_ru, name_en, name_es, description_ru, description_en, description_es, is_free_default, order_idx) VALUES
  ('neuromap',       'NeuroMap',            'NeuroMap',            'NeuroMap',            'Граф ваших состояний и связей.',           'Graph of your states and links.',          'Grafo de tus estados y enlaces.',           TRUE,  1),
  ('sensation-map',  'Карта ощущений',      'Sensation Map',       'Mapa de sensaciones', 'Где и что вы чувствуете в теле.',           'Where and what you feel in the body.',      'Dónde y qué sientes en el cuerpo.',         TRUE,  2),
  ('diary',          'Дневник',             'Diary',               'Diario',              'Дневник нейроресурса.',                     'Neuro-resource diary.',                     'Diario de neurorrecurso.',                  TRUE,  3),
  ('point-ab',       'Точка А → B',         'Point A → B',         'Punto A → B',         'Карта перехода из точки А в точку B.',      'Map your shift from point A to B.',         'Mapa de tu cambio de A a B.',               TRUE,  4),
  ('external-field', 'External Field',      'External Field',      'External Field',      'Объективные сигналы внешней среды.',        'Objective environmental signals.',          'Señales objetivas del entorno.',            TRUE,  5),
  ('evolution-path', 'Путь развития',       'Evolution Path',      'Camino de evolución', 'Ваш персональный путь развития.',           'Your personal evolution path.',             'Tu camino de evolución personal.',          TRUE,  6),
  ('anatomy-atlas',  'Анатомический атлас', 'Anatomy Atlas',       'Atlas anatómico',     'Интерактивное 3D-тело: слои, мозг, органы.','Interactive 3D body: layers, brain, organs.','Cuerpo 3D interactivo: capas, cerebro, órganos.', FALSE, 7)
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_course_tools_tool ON course_tools(tool_id);
