-- 019_fix_anatomy_seed_regions.sql
-- Corrects medically-wrong region mappings in the anatomy seed (migration 018):
-- GI conditions used 'liver' as a placeholder; endocrine missed pancreas/thyroid;
-- rhinitis pointed at lungs; hip-OA at the spine. Targets the now-registered
-- organ/skeleton sub-layer regions (SEED_REGION_INFO in assets/js/body-atlas.js).
--
-- Idempotent: pure UPDATE … WHERE slug = … (safe to run repeatedly; no-ops if a
-- slug is absent). Touches ONLY the 11 listed rows — medically-correct rows
-- (brain / cardio / neuro / psychiatric / cirrhosis / asthma / copd …) untouched.
-- Region ids are SEED_REGION_INFO keys; the engine maps them to real GLB meshes.

-- ── conditions ──
UPDATE human_conditions SET affected_region_ids = ARRAY['stomach','medulla']::text[]                       WHERE slug = 'gastritis';
UPDATE human_conditions SET affected_region_ids = ARRAY['oesophagus','stomach','medulla']::text[]          WHERE slug = 'gerd';
UPDATE human_conditions SET affected_region_ids = ARRAY['small-intestine','large-intestine']::text[]       WHERE slug = 'crohns';
UPDATE human_conditions SET affected_region_ids = ARRAY['large-intestine','medulla']::text[]               WHERE slug = 'ibs';
UPDATE human_conditions SET affected_region_ids = ARRAY['pancreas','hypothalamus','liver']::text[]         WHERE slug = 'type1-diabetes';
UPDATE human_conditions SET affected_region_ids = ARRAY['pancreas','hypothalamus','liver','kidneys']::text[] WHERE slug = 'type2-diabetes';
UPDATE human_conditions SET affected_region_ids = ARRAY['thyroid-gland']::text[]                           WHERE slug = 'hyperthyroidism';
UPDATE human_conditions SET affected_region_ids = ARRAY['thyroid-gland']::text[]                           WHERE slug = 'hypothyroidism';
UPDATE human_conditions SET affected_region_ids = ARRAY['nose']::text[]                                    WHERE slug = 'allergic-rhinitis';
UPDATE human_conditions SET affected_region_ids = ARRAY['hip']::text[]                                     WHERE slug = 'hip-osteoarthritis';

-- ── functions ──
UPDATE anatomy_functions SET region_ids = ARRAY['stomach','small-intestine','large-intestine','medulla','hypothalamus','liver']::text[] WHERE slug = 'digestion';
