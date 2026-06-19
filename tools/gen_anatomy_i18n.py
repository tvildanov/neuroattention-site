#!/usr/bin/env python3
"""Generate curated RU/ES anatomy region dictionaries for the body atlas.

Keys are base_slugs (laterality-stripped) from regions-index.json. We translate
whole, commonly-referenced structures (major bones, organs, vessels, nerves,
whole muscles, spine, cord). The long tail of sub-regions (surfaces, segments,
fascicles, bronchopulmonary segments…) is intentionally NOT translated — the
engine falls back to the precise Latin/English term, which is better than a
machine-mangled guess. Honest by construction.

Every key is validated against the actual index; unknown keys are dropped with a
warning so a typo can't ship a dead entry. Muscle concepts are emitted for BOTH
the `muscles_` layer and the `skeleton_` attachment-footprint layer.

Output: data/i18n/anatomy/ru.json , data/i18n/anatomy/es.json  ({slug: name})
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "data/anatomy/regions-index.json")
OUT_DIR = os.path.join(ROOT, "data/i18n/anatomy")

# ── whole muscles: concept slug (without layer prefix) → (ru, es) ──────────────
# emitted for muscles_<c>, muscles_<c>_muscle, skeleton_<c>, skeleton_<c>_muscle
MUSCLES = {
    "deltoid": ("Дельтовидная мышца", "Músculo deltoides"),
    "biceps_brachii": ("Двуглавая мышца плеча", "Bíceps braquial"),
    "triceps_brachii": ("Трёхглавая мышца плеча", "Tríceps braquial"),
    "brachialis": ("Плечевая мышца", "Músculo braquial"),
    "brachioradialis": ("Плечелучевая мышца", "Músculo braquiorradial"),
    "pectoralis_major": ("Большая грудная мышца", "Pectoral mayor"),
    "pectoralis_minor": ("Малая грудная мышца", "Pectoral menor"),
    "trapezius": ("Трапециевидная мышца", "Músculo trapecio"),
    "latissimus_dorsi": ("Широчайшая мышца спины", "Dorsal ancho"),
    "rectus_abdominis": ("Прямая мышца живота", "Recto del abdomen"),
    "external_oblique": ("Наружная косая мышца живота", "Oblicuo externo del abdomen"),
    "internal_oblique": ("Внутренняя косая мышца живота", "Oblicuo interno del abdomen"),
    "gluteus_maximus": ("Большая ягодичная мышца", "Glúteo mayor"),
    "gluteus_medius": ("Средняя ягодичная мышца", "Glúteo medio"),
    "gluteus_minimus": ("Малая ягодичная мышца", "Glúteo menor"),
    "rectus_femoris": ("Прямая мышца бедра", "Recto femoral"),
    "vastus_lateralis": ("Латеральная широкая мышца бедра", "Vasto lateral"),
    "vastus_medialis": ("Медиальная широкая мышца бедра", "Vasto medial"),
    "vastus_intermedius": ("Промежуточная широкая мышца бедра", "Vasto intermedio"),
    "biceps_femoris": ("Двуглавая мышца бедра", "Bíceps femoral"),
    "semitendinosus": ("Полусухожильная мышца", "Semitendinoso"),
    "semimembranosus": ("Полуперепончатая мышца", "Semimembranoso"),
    "sartorius": ("Портняжная мышца", "Sartorio"),
    "gracilis": ("Тонкая мышца", "Recto interno (grácil)"),
    "gastrocnemius": ("Икроножная мышца", "Gastrocnemio"),
    "soleus": ("Камбаловидная мышца", "Sóleo"),
    "tibialis_anterior": ("Передняя большеберцовая мышца", "Tibial anterior"),
    "sternocleidomastoid": ("Грудино-ключично-сосцевидная мышца", "Esternocleidomastoideo"),
    "masseter": ("Жевательная мышца", "Masetero"),
    "temporalis": ("Височная мышца", "Músculo temporal"),
    "frontalis": ("Лобное брюшко затылочно-лобной мышцы", "Vientre frontal"),
    "orbicularis_oculi": ("Круговая мышца глаза", "Orbicular de los ojos"),
    "orbicularis_oris": ("Круговая мышца рта", "Orbicular de la boca"),
    "diaphragm": ("Диафрагма", "Diafragma"),
    "iliacus": ("Подвздошная мышца", "Ilíaco"),
    "psoas_major": ("Большая поясничная мышца", "Psoas mayor"),
    "infraspinatus": ("Подостная мышца", "Infraespinoso"),
    "supraspinatus": ("Надостная мышца", "Supraespinoso"),
    "teres_major": ("Большая круглая мышца", "Redondo mayor"),
    "teres_minor": ("Малая круглая мышца", "Redondo menor"),
    "serratus_anterior": ("Передняя зубчатая мышца", "Serrato anterior"),
    "coracobrachialis": ("Клювовидно-плечевая мышца", "Coracobraquial"),
    "anconeus": ("Локтевая мышца", "Ancóneo"),
    "fibularis_longus": ("Длинная малоберцовая мышца", "Peroneo largo"),
    "fibularis_brevis": ("Короткая малоберцовая мышца", "Peroneo corto"),
    "extensor_digitorum_longus": ("Длинный разгибатель пальцев", "Extensor largo de los dedos"),
    "flexor_digitorum_longus": ("Длинный сгибатель пальцев", "Flexor largo de los dedos"),
    "extensor_hallucis_longus": ("Длинный разгибатель большого пальца стопы", "Extensor largo del dedo gordo"),
    "buccinator": ("Щёчная мышца", "Buccinador"),
    "mentalis": ("Подбородочная мышца", "Mentoniano"),
    "nasalis": ("Носовая мышца", "Nasal"),
    "mylohyoid": ("Челюстно-подъязычная мышца", "Milohioideo"),
    "geniohyoid": ("Подбородочно-подъязычная мышца", "Geniohioideo"),
    "genioglossus": ("Подбородочно-язычная мышца", "Geniogloso"),
    "hyoglossus": ("Подъязычно-язычная мышца", "Hiogloso"),
    "obturator_externus": ("Наружная запирательная мышца", "Obturador externo"),
    "obturator_internus": ("Внутренняя запирательная мышца", "Obturador interno"),
    "levator_scapulae": ("Мышца, поднимающая лопатку", "Elevador de la escápula"),
    # additional major / surface muscles (exact Z-Anatomy stems)
    "external_abdominal_oblique": ("Наружная косая мышца живота", "Oblicuo externo del abdomen"),
    "internal_abdominal_oblique": ("Внутренняя косая мышца живота", "Oblicuo interno del abdomen"),
    "transversus_abdominis": ("Поперечная мышца живота", "Transverso del abdomen"),
    "external_intercostal_muscles": ("Наружные межрёберные мышцы", "Intercostales externos"),
    "internal_intercostal_muscles": ("Внутренние межрёберные мышцы", "Intercostales internos"),
    "quadratus_lumborum": ("Квадратная мышца поясницы", "Cuadrado lumbar"),
    "tensor_fasciae_latae": ("Напрягатель широкой фасции", "Tensor de la fascia lata"),
    "adductor_longus": ("Длинная приводящая мышца", "Aductor largo"),
    "adductor_magnus": ("Большая приводящая мышца", "Aductor mayor"),
    "adductor_brevis": ("Короткая приводящая мышца", "Aductor corto"),
    "pectineus": ("Гребенчатая мышца", "Pectíneo"),
    "piriformis": ("Грушевидная мышца", "Piriforme"),
    "popliteus": ("Подколенная мышца", "Poplíteo"),
    "plantaris": ("Подошвенная мышца", "Plantar"),
    "pronator_teres": ("Круглый пронатор", "Pronador redondo"),
    "supinator": ("Супинатор", "Supinador"),
    "flexor_carpi_radialis": ("Лучевой сгибатель запястья", "Flexor radial del carpo"),
    "flexor_carpi_ulnaris": ("Локтевой сгибатель запястья", "Flexor cubital del carpo"),
    "extensor_carpi_radialis_longus": ("Длинный лучевой разгибатель запястья", "Extensor radial largo del carpo"),
    "extensor_carpi_ulnaris": ("Локтевой разгибатель запястья", "Extensor cubital del carpo"),
    "tibialis_posterior": ("Задняя большеберцовая мышца", "Tibial posterior"),
    "rhomboid_major": ("Большая ромбовидная мышца", "Romboides mayor"),
    "rhomboid_minor": ("Малая ромбовидная мышца", "Romboides menor"),
    "splenius_capitis": ("Ремённая мышца головы", "Esplenio de la cabeza"),
    "scalenus_anterior": ("Передняя лестничная мышца", "Escaleno anterior"),
    "omohyoid": ("Лопаточно-подъязычная мышца", "Omohioideo"),
    "sternohyoid": ("Грудино-подъязычная мышца", "Esternohioideo"),
    "thyrohyoid": ("Щитоподъязычная мышца", "Tirohioideo"),
    "platysma": ("Подкожная мышца шеи", "Platisma"),
    "zygomaticus_major": ("Большая скуловая мышца", "Cigomático mayor"),
    "risorius": ("Мышца смеха", "Risorio"),
    "procerus": ("Мышца гордецов", "Prócer"),
    "depressor_anguli_oris": ("Мышца, опускающая угол рта", "Depresor del ángulo de la boca"),
    "multifidus_lumborum": ("Многораздельная мышца поясницы", "Multífido lumbar"),
    "multifidus_thoracis": ("Многораздельная мышца груди", "Multífido torácico"),
    "multifidus_colli": ("Многораздельная мышца шеи", "Multífido cervical"),
    "rotatores": ("Мышцы-вращатели", "Rotadores"),
}

# ── bones & skeletal whole structures: base_slug → (ru, es) ────────────────────
BONES = {
    "skeleton_femur": ("Бедренная кость", "Fémur"),
    "skeleton_tibia": ("Большеберцовая кость", "Tibia"),
    "skeleton_fibula": ("Малоберцовая кость", "Peroné"),
    "skeleton_patella": ("Надколенник", "Rótula"),
    "skeleton_humerus": ("Плечевая кость", "Húmero"),
    "skeleton_radius": ("Лучевая кость", "Radio"),
    "skeleton_ulna": ("Локтевая кость", "Cúbito"),
    "skeleton_scapula": ("Лопатка", "Escápula"),
    "skeleton_clavicle": ("Ключица", "Clavícula"),
    "skeleton_sternum": ("Грудина", "Esternón"),
    "skeleton_rib": ("Ребро", "Costilla"),
    "skeleton_mandible": ("Нижняя челюсть", "Mandíbula"),
    "skeleton_maxilla": ("Верхняя челюсть", "Maxilar"),
    "skeleton_frontal_bone": ("Лобная кость", "Hueso frontal"),
    "skeleton_parietal_bone": ("Теменная кость", "Hueso parietal"),
    "skeleton_occipital_bone": ("Затылочная кость", "Hueso occipital"),
    "skeleton_temporal_bone": ("Височная кость", "Hueso temporal"),
    "skeleton_sphenoid_bone": ("Клиновидная кость", "Hueso esfenoides"),
    "skeleton_ethmoid_bone": ("Решётчатая кость", "Hueso etmoides"),
    "skeleton_nasal_bone": ("Носовая кость", "Hueso nasal"),
    "skeleton_zygomatic_bone": ("Скуловая кость", "Hueso cigomático"),
    "skeleton_hyoid_bone": ("Подъязычная кость", "Hueso hioides"),
    "skeleton_sacrum": ("Крестец", "Sacro"),
    "skeleton_coccyx": ("Копчик", "Cóccix"),
    "skeleton_hip_bone": ("Тазовая кость", "Hueso coxal"),
    "skeleton_ilium": ("Подвздошная кость", "Ilion"),
    "skeleton_ischium": ("Седалищная кость", "Isquion"),
    "skeleton_pubis": ("Лобковая кость", "Pubis"),
    "skeleton_atlas": ("Атлант (C1)", "Atlas (C1)"),
    "skeleton_atlas_c1": ("Атлант (C1)", "Atlas (C1)"),
    "skeleton_axis_c2": ("Осевой позвонок (C2)", "Axis (C2)"),
    "skeleton_calcaneus": ("Пяточная кость", "Calcáneo"),
    "skeleton_talus": ("Таранная кость", "Astrágalo"),
    "skeleton_vertebral_column": ("Позвоночный столб", "Columna vertebral"),
    "skeleton_skull": ("Череп", "Cráneo"),
    "skeleton_axial_skeleton": ("Осевой скелет", "Esqueleto axial"),
    "skeleton_appendicular_skeleton": ("Добавочный скелет", "Esqueleto apendicular"),
    "skeleton_pelvic_girdle": ("Тазовый пояс", "Cintura pélvica"),
    "skeleton_pectoral_girdle": ("Плечевой пояс", "Cintura escapular"),
}

# ── organs: base_slug → (ru, es) ──────────────────────────────────────────────
ORGANS = {
    "organs_kidney": ("Почка", "Riñón"),
    "organs_liver": ("Печень", "Hígado"),
    "organs_left_lobe_of_liver": ("Левая доля печени", "Lóbulo izquierdo del hígado"),
    "organs_right_lobe_of_liver": ("Правая доля печени", "Lóbulo derecho del hígado"),
    "organs_caudate_lobe": ("Хвостатая доля печени", "Lóbulo caudado"),
    "organs_lungs": ("Лёгкие", "Pulmones"),
    "organs_left_lung": ("Левое лёгкое", "Pulmón izquierdo"),
    "organs_right_lung": ("Правое лёгкое", "Pulmón derecho"),
    "organs_stomach": ("Желудок", "Estómago"),
    "organs_spleen": ("Селезёнка", "Bazo"),
    "organs_pancreas": ("Поджелудочная железа", "Páncreas"),
    "organs_gallbladder": ("Жёлчный пузырь", "Vesícula biliar"),
    "organs_urinary_bladder": ("Мочевой пузырь", "Vejiga urinaria"),
    "organs_bladder": ("Мочевой пузырь", "Vejiga"),
    "organs_oesophagus": ("Пищевод", "Esófago"),
    "organs_trachea": ("Трахея", "Tráquea"),
    "organs_larynx": ("Гортань", "Laringe"),
    "organs_pharynx": ("Глотка", "Faringe"),
    "organs_nasopharynx": ("Носоглотка", "Nasofaringe"),
    "organs_oropharynx": ("Ротоглотка", "Orofaringe"),
    "organs_laryngopharynx": ("Гортаноглотка", "Laringofaringe"),
    "organs_thyroid_gland": ("Щитовидная железа", "Glándula tiroides"),
    "organs_duodenum": ("Двенадцатиперстная кишка", "Duodeno"),
    "organs_jejunum": ("Тощая кишка", "Yeyuno"),
    "organs_ileum": ("Подвздошная кишка", "Íleon"),
    "organs_colon": ("Ободочная кишка", "Colon"),
    "organs_ascending_colon": ("Восходящая ободочная кишка", "Colon ascendente"),
    "organs_descending_colon": ("Нисходящая ободочная кишка", "Colon descendente"),
    "organs_transverse_colon": ("Поперечная ободочная кишка", "Colon transverso"),
    "organs_sigmoid_colon": ("Сигмовидная кишка", "Colon sigmoide"),
    "organs_rectum": ("Прямая кишка", "Recto"),
    "organs_caecum": ("Слепая кишка", "Ciego"),
    "organs_large_intestine": ("Толстая кишка", "Intestino grueso"),
    "organs_small_intestine": ("Тонкая кишка", "Intestino delgado"),
    "organs_appendix": ("Червеобразный отросток", "Apéndice"),
    "organs_bronchi": ("Бронхи", "Bronquios"),
    "organs_epiglottis": ("Надгортанник", "Epiglotis"),
    "organs_tongue": ("Язык", "Lengua"),
    "organs_nose": ("Нос", "Nariz"),
    "organs_mouth": ("Рот", "Boca"),
    "organs_hypophysis": ("Гипофиз", "Hipófisis"),
    "organs_ureter": ("Мочеточник", "Uréter"),
    "organs_urethra": ("Мочеиспускательный канал", "Uretra"),
    "organs_prostate": ("Предстательная железа", "Próstata"),
    "organs_testis": ("Яичко", "Testículo"),
    "organs_epididymis": ("Придаток яичка", "Epidídimo"),
    "organs_adrenal_gland": ("Надпочечник", "Glándula suprarrenal"),
    "organs_suprarenal_gland": ("Надпочечник", "Glándula suprarrenal"),
}

# ── vessels & heart: base_slug → (ru, es) ─────────────────────────────────────
VESSELS = {
    "vessels_aortic_arch": ("Дуга аорты", "Arco aórtico"),
    "vessels_ascending_aorta": ("Восходящая аорта", "Aorta ascendente"),
    "vessels_descending_aorta": ("Нисходящая аорта", "Aorta descendente"),
    "vessels_thoracic_aorta": ("Грудная аорта", "Aorta torácica"),
    "vessels_abdominal_aorta": ("Брюшная аорта", "Aorta abdominal"),
    "vessels_left_atrium": ("Левое предсердие", "Aurícula izquierda"),
    "vessels_right_atrium": ("Правое предсердие", "Aurícula derecha"),
    "vessels_left_ventricle": ("Левый желудочек", "Ventrículo izquierdo"),
    "vessels_right_ventricle": ("Правый желудочек", "Ventrículo derecho"),
    "vessels_left_coronary_artery": ("Левая венечная артерия", "Arteria coronaria izquierda"),
    "vessels_right_coronary_artery": ("Правая венечная артерия", "Arteria coronaria derecha"),
    "vessels_coronary_sinus": ("Венечный синус", "Seno coronario"),
    "vessels_pulmonary_trunk": ("Лёгочный ствол", "Tronco pulmonar"),
    "vessels_brachiocephalic_trunk": ("Плечеголовной ствол", "Tronco braquiocefálico"),
    "vessels_coeliac_trunk": ("Чревный ствол", "Tronco celíaco"),
    "vessels_common_carotid_artery": ("Общая сонная артерия", "Arteria carótida común"),
    "vessels_internal_carotid_artery": ("Внутренняя сонная артерия", "Arteria carótida interna"),
    "vessels_external_carotid_artery": ("Наружная сонная артерия", "Arteria carótida externa"),
    "vessels_internal_jugular_vein": ("Внутренняя яремная вена", "Vena yugular interna"),
    "vessels_external_jugular_vein": ("Наружная яремная вена", "Vena yugular externa"),
    "vessels_subclavian_artery": ("Подключичная артерия", "Arteria subclavia"),
    "vessels_subclavian_vein": ("Подключичная вена", "Vena subclavia"),
    "vessels_axillary_artery": ("Подмышечная артерия", "Arteria axilar"),
    "vessels_axillary_vein": ("Подмышечная вена", "Vena axilar"),
    "vessels_brachial_artery": ("Плечевая артерия", "Arteria braquial"),
    "vessels_radial_artery": ("Лучевая артерия", "Arteria radial"),
    "vessels_ulnar_artery": ("Локтевая артерия", "Arteria cubital"),
    "vessels_cephalic_vein": ("Латеральная подкожная вена руки", "Vena cefálica"),
    "vessels_basilic_vein": ("Медиальная подкожная вена руки", "Vena basílica"),
    "vessels_femoral_artery": ("Бедренная артерия", "Arteria femoral"),
    "vessels_femoral_vein": ("Бедренная вена", "Vena femoral"),
    "vessels_great_saphenous_vein": ("Большая подкожная вена ноги", "Vena safena mayor"),
    "vessels_popliteal_artery": ("Подколенная артерия", "Arteria poplítea"),
    "vessels_inferior_vena_cava": ("Нижняя полая вена", "Vena cava inferior"),
    "vessels_superior_vena_cava": ("Верхняя полая вена", "Vena cava superior"),
    "vessels_portal_vein": ("Воротная вена", "Vena porta"),
    "vessels_hepatic_portal_vein": ("Воротная вена печени", "Vena porta hepática"),
    "vessels_basilar_artery": ("Базилярная артерия", "Arteria basilar"),
    "vessels_azygos_vein": ("Непарная вена", "Vena ácigos"),
    "vessels_renal_artery": ("Почечная артерия", "Arteria renal"),
    "vessels_renal_vein": ("Почечная вена", "Vena renal"),
}

# ── nervous (PNS + cord): base_slug → (ru, es) ────────────────────────────────
NERVOUS = {
    "nervous_spinal_cord": ("Спинной мозг", "Médula espinal"),
    "nervous_median_nerve": ("Срединный нерв", "Nervio mediano"),
    "nervous_ulnar_nerve": ("Локтевой нерв", "Nervio cubital"),
    "nervous_radial_nerve": ("Лучевой нерв", "Nervio radial"),
    "nervous_musculocutaneous_nerve": ("Мышечно-кожный нерв", "Nervio musculocutáneo"),
    "nervous_axillary_nerve": ("Подмышечный нерв", "Nervio axilar"),
    "nervous_sciatic_nerve": ("Седалищный нерв", "Nervio ciático"),
    "nervous_femoral_nerve": ("Бедренный нерв", "Nervio femoral"),
    "nervous_obturator_nerve": ("Запирательный нерв", "Nervio obturador"),
    "nervous_tibial_nerve": ("Большеберцовый нерв", "Nervio tibial"),
    "nervous_common_fibular_nerve": ("Общий малоберцовый нерв", "Nervio peroneo común"),
    "nervous_common_peroneal_nerve": ("Общий малоберцовый нерв", "Nervio peroneo común"),
    "nervous_phrenic_nerve": ("Диафрагмальный нерв", "Nervio frénico"),
    "nervous_vagus_nerve_x": ("Блуждающий нерв (X)", "Nervio vago (X)"),
    "nervous_facial_nerve_vii": ("Лицевой нерв (VII)", "Nervio facial (VII)"),
    "nervous_trigeminal_nerve_v": ("Тройничный нерв (V)", "Nervio trigémino (V)"),
    "nervous_optic_nerve_ii": ("Зрительный нерв (II)", "Nervio óptico (II)"),
    "nervous_oculomotor_nerve_iii": ("Глазодвигательный нерв (III)", "Nervio oculomotor (III)"),
    "nervous_trochlear_nerve_iv": ("Блоковый нерв (IV)", "Nervio troclear (IV)"),
    "nervous_abducens_nerve_vi": ("Отводящий нерв (VI)", "Nervio abducens (VI)"),
    "nervous_glossopharyngeal_nerve_ix": ("Языкоглоточный нерв (IX)", "Nervio glosofaríngeo (IX)"),
    "nervous_accessory_nerve_xi": ("Добавочный нерв (XI)", "Nervio accesorio (XI)"),
    "nervous_hypoglossal_nerve_xii": ("Подъязычный нерв (XII)", "Nervio hipogloso (XII)"),
    "nervous_brachial_plexus": ("Плечевое сплетение", "Plexo braquial"),
    "nervous_lumbar_plexus": ("Поясничное сплетение", "Plexo lumbar"),
    "nervous_sacral_plexus": ("Крестцовое сплетение", "Plexo sacro"),
    "nervous_cranial_nerves": ("Черепные нервы", "Nervios craneales"),
    "nervous_sympathetic_trunk": ("Симпатический ствол", "Tronco simpático"),
    "nervous_cochlea": ("Улитка", "Cóclea"),
    "nervous_ear": ("Ухо", "Oído"),
    "nervous_external_ear": ("Наружное ухо", "Oído externo"),
    "nervous_middle_ear": ("Среднее ухо", "Oído medio"),
    "nervous_internal_ear": ("Внутреннее ухо", "Oído interno"),
    "nervous_tympanic_membrane": ("Барабанная перепонка", "Membrana timpánica"),
    "nervous_eyeball": ("Глазное яблоко", "Globo ocular"),
    "nervous_retina": ("Сетчатка", "Retina"),
    "nervous_cornea": ("Роговица", "Córnea"),
    "nervous_lens": ("Хрусталик", "Cristalino"),
    "nervous_lacrimal_gland": ("Слёзная железа", "Glándula lagrimal"),
}


# ── supplemental: structures that exist only as explicit Left/Right or part
# variants (the "Left"/"Right" is in the NAME, not a .l/.r marker, so each is its
# own base_slug and needs its own translation with the side baked in).
EXTRA = {
    "skeleton_cranium": ("Череп (мозговой)", "Cráneo (neurocráneo)"),
    "organs_vermiform_appendix": ("Червеобразный отросток", "Apéndice vermiforme"),
    "vessels_left_common_carotid_artery": ("Левая общая сонная артерия", "Arteria carótida común izquierda"),
    "vessels_right_common_carotid_artery": ("Правая общая сонная артерия", "Arteria carótida común derecha"),
    "vessels_left_subclavian_artery": ("Левая подключичная артерия", "Arteria subclavia izquierda"),
    "vessels_right_subclavian_artery": ("Правая подключичная артерия", "Arteria subclavia derecha"),
    "vessels_left_subclavian_vein": ("Левая подключичная вена", "Vena subclavia izquierda"),
    "vessels_right_subclavian_vein": ("Правая подключичная вена", "Vena subclavia derecha"),
    "vessels_left_renal_artery": ("Левая почечная артерия", "Arteria renal izquierda"),
    "vessels_right_renal_artery": ("Правая почечная артерия", "Arteria renal derecha"),
    "vessels_left_renal_vein": ("Левая почечная вена", "Vena renal izquierda"),
    "vessels_right_renal_vein": ("Правая почечная вена", "Vena renal derecha"),
    "vessels_inferior_vena_cava_thoracic_part": ("Нижняя полая вена (грудная часть)", "Vena cava inferior (porción torácica)"),
    "vessels_inferior_vena_cava_abdominal_part": ("Нижняя полая вена (брюшная часть)", "Vena cava inferior (porción abdominal)"),
    "nervous_subclavian_nerve": ("Подключичный нерв", "Nervio subclavio"),
}


def main():
    idx = json.load(open(INDEX))
    valid = set(idx["base"].keys())

    ru, es = {}, {}

    def put(slug, names):
        if slug not in valid:
            return False
        ru[slug] = names[0]
        es[slug] = names[1]
        return True

    dropped = []
    # muscles → both layers + optional _muscle suffix
    for concept, names in MUSCLES.items():
        hit = False
        for layer in ("muscles", "skeleton"):
            for suf in ("", "_muscle"):
                if put(f"{layer}_{concept}{suf}", names):
                    hit = True
        if not hit:
            dropped.append(f"muscle:{concept}")

    for table in (BONES, ORGANS, VESSELS, NERVOUS, EXTRA):
        for slug, names in table.items():
            if not put(slug, names):
                dropped.append(slug)

    os.makedirs(OUT_DIR, exist_ok=True)
    json.dump(ru, open(os.path.join(OUT_DIR, "ru.json"), "w"),
              indent=0, ensure_ascii=False, sort_keys=True)
    json.dump(es, open(os.path.join(OUT_DIR, "es.json"), "w"),
              indent=0, ensure_ascii=False, sort_keys=True)
    print(f"ru entries: {len(ru)}  es entries: {len(es)}")
    if dropped:
        print(f"dropped {len(dropped)} unmatched keys:")
        for d in dropped:
            print("  -", d)


if __name__ == "__main__":
    main()
