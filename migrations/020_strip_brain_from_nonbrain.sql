-- 020_strip_brain_from_nonbrain.sql
-- Pass-2 content cleanup: a non-neuro condition's affected_region_ids must list
-- only the LOCALLY affected organs. medulla / hypothalamus were sprinkled in as a
-- "default autonomic controller" — they regulate, they aren't the lesion. Strip
-- them from the 8 non-neuro conditions. Neuro/psych conditions keep their brain
-- regions (untouched). Secondary layers (e.g. hormonal/airway extras) deferred.
--
-- Idempotent: pure UPDATE … WHERE slug. Mirrored inline at the TOP of the
-- /api/run-migrations runner (before the tools rename, which throws on re-run).

UPDATE human_conditions SET affected_region_ids = ARRAY['stomach']::text[]                 WHERE slug = 'gastritis';
UPDATE human_conditions SET affected_region_ids = ARRAY['oesophagus','stomach']::text[]    WHERE slug = 'gerd';
UPDATE human_conditions SET affected_region_ids = ARRAY['large-intestine']::text[]         WHERE slug = 'ibs';
UPDATE human_conditions SET affected_region_ids = ARRAY['lungs']::text[]                   WHERE slug = 'asthma';
UPDATE human_conditions SET affected_region_ids = ARRAY['lungs']::text[]                   WHERE slug = 'copd';
UPDATE human_conditions SET affected_region_ids = ARRAY['pancreas','liver']::text[]        WHERE slug = 'type1-diabetes';
UPDATE human_conditions SET affected_region_ids = ARRAY['pancreas','liver','kidneys']::text[] WHERE slug = 'type2-diabetes';
UPDATE human_conditions SET affected_region_ids = ARRAY['heart','kidneys']::text[]         WHERE slug = 'hypertension';
