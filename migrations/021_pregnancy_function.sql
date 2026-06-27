-- 021_pregnancy_function.sql — Phase 1: Pregnancy as an anatomy_function (reproductive)
-- Backs the Human Atlas "Functions" tab. Idempotent. NB: the migrate runner splits on
-- semicolons and strips line comments, so seed strings must contain no semicolons and
-- no double-dash. region_ids use real SEED_REGION_INFO ids so focusRegions highlights
-- the meshes: uterus/ovaries/breasts/cervix (female_reproductive), placenta (placenta
-- layer), hypothalamus (nervous), thyroid-gland (organs/endocrine). pituitary is listed
-- for the hypothalamic-pituitary axis even though no distinct mesh exists yet.

INSERT INTO anatomy_functions (slug, name_en, name_ru, name_es, description_en, description_ru, description_es, category, region_ids, tags) VALUES
  ('pregnancy', 'Pregnancy', 'Беременность', 'Embarazo',
   'The physiological process of fetal development in the womb, accompanied by changes across the reproductive, endocrine and metabolic systems.',
   'Физиологический процесс развития плода в материнской утробе, сопровождается изменениями репродуктивной, эндокринной и метаболической систем.',
   'El proceso fisiologico de desarrollo del feto en el utero, acompanado de cambios en los sistemas reproductivo, endocrino y metabolico.',
   'reproductive',
   '{uterus,placenta,ovaries,breasts,hypothalamus,pituitary,thyroid-gland,cervix}',
   '{pregnancy,gestation,beremennost,embarazo}')
ON CONFLICT (slug) DO NOTHING;

-- keep the row current on re-run (region slugs were tuned to real meshes after first seed)
UPDATE anatomy_functions SET region_ids = ARRAY['uterus','placenta','ovaries','breasts','hypothalamus','pituitary','thyroid-gland','cervix']::text[], category = 'reproductive' WHERE slug = 'pregnancy';
