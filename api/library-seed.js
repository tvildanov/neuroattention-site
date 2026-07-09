// api/library-seed.js — seed content for the Library tool (PR: library-tool).
//
// English-only for launch. The `content` column is JSONB keyed by language
// ({ en: {...} }); ru/es translations slot in under new keys later without a
// schema change. Migration 056 upserts every row here (ON CONFLICT (slug) DO
// UPDATE) so re-running run-migrations refreshes copy.
//
// Consciousness-theory content is sourced from Wikipedia + SEP/IEP + the 2025
// Nature Cogitate paper (verified 2026-07). Contested claims are represented
// honestly (Orch-OR = fringe; the 2023 IIT-vs-GNWT collaboration = "no clear
// winner"; the IIT "pseudoscience" letter reported with both sides).

// ── Theories & hypotheses ────────────────────────────────────────────────
const THEORIES = [
  {
    slug: 'integrated-information-theory', status: 'controversial', sort_order: 10,
    sources: [
      'https://en.wikipedia.org/wiki/Integrated_information_theory',
      'https://link.springer.com/article/10.1007/s10670-025-00949-1'
    ],
    content: { en: {
      title: 'Integrated Information Theory (IIT)', abbr: 'IIT',
      proponents: 'Giulio Tononi (2004); Christof Koch, Marcello Massimini, Larissa Albantakis',
      summary: 'IIT holds that consciousness IS integrated information — a system is conscious to the degree that it forms a unified causal structure that is "more than the sum of its parts." It starts from axioms about the phenomenology of experience and maps them onto physical postulates about a system’s cause-effect structure. The quantity of consciousness is measured by Φ ("phi"); its quality is the shape of the cause-effect structure itself.',
      key_points: [
        'Consciousness is identified with a maximally irreducible cause-effect structure (a "complex"), not with computation or behaviour.',
        'Φ (big phi) quantifies how irreducible a system’s causal structure is to its parts.',
        'Five axioms map to five postulates: intrinsicality, information, integration, exclusion, composition.',
        'Predicts consciousness depends on the posterior cortical "hot zone," not necessarily the prefrontal cortex.',
        'Implies consciousness is substrate-dependent and can in principle exist in simple systems — a tendency toward panpsychism that critics attack.'
      ],
      criticisms: [
        'Charged as unfalsifiable / "pseudoscience" by a 2023 open letter of 124 researchers (see Research).',
        'Φ is effectively incomputable for real brains; empirical tests rely on proxies.',
        'The panpsychism implication is seen by critics as counter-intuitive and untestable.',
        'Defenders (Koch, Tononi, and partly Seth and Chalmers) argue it is a bold but legitimate research programme.'
      ]
    } }
  },
  {
    slug: 'global-workspace-theory', status: 'influential', sort_order: 20,
    sources: [
      'https://en.wikipedia.org/wiki/Global_workspace_theory',
      'https://www.psychologytoday.com/us/blog/finding-purpose/202310/fame-in-the-brain-global-workspace-theories-of-consciousness'
    ],
    content: { en: {
      title: 'Global Workspace Theory (GWT)', abbr: 'GWT',
      proponents: 'Bernard Baars (~1988)',
      summary: 'GWT compares the mind to a theatre: a vast amount of unconscious parallel processing competes for access to a limited-capacity "global workspace," and whatever wins is "broadcast" widely, becoming conscious. Consciousness is the global availability ("fame in the brain") of information to many specialised processors — for report, memory, decision-making, and action.',
      key_points: [
        'Conscious contents are globally broadcast to many otherwise independent, unconscious specialist processes.',
        'The workspace is limited-capacity and serial, sitting atop massively parallel unconscious processing.',
        'Consciousness enables flexible coordination: working memory, executive control, cross-module integration.',
        'A functionalist/cognitive theory — largely agnostic about the specific neural substrate (later filled in by GNWT).'
      ],
      criticisms: [
        'Accused of explaining access/function while leaving the "hard problem" of why broadcast feels like anything untouched.',
        'Originally under-specified neurobiologically — the motivation for the Dehaene–Changeux refinement.',
        'Overlaps with access-consciousness; critics ask whether it addresses phenomenal consciousness at all.'
      ]
    } }
  },
  {
    slug: 'global-neuronal-workspace', status: 'mainstream', sort_order: 30,
    sources: [
      'https://en.wikipedia.org/wiki/Dehaene%E2%80%93Changeux_model',
      'https://www.cell.com/neuron/fulltext/S0896-6273(20)30052-0'
    ],
    content: { en: {
      title: 'Global Neuronal Workspace (GNW/GNWT)', abbr: 'GNWT',
      proponents: 'Stanislas Dehaene, Jean-Pierre Changeux, Lionel Naccache',
      summary: 'GNWT is the neurobiologically specified, testable descendant of Baars’s GWT. Information becomes conscious when it is amplified and "ignited" into a network of long-range cortical neurons (especially fronto-parietal), making it globally available and reportable. Below a threshold, stimuli are processed unconsciously; crossing it triggers an all-or-none ignition that broadcasts the content workspace-wide.',
      key_points: [
        '"Global ignition": a nonlinear, all-or-none avalanche of sustained long-range fronto-parietal activity marks the transition to consciousness.',
        'Neural signatures: a late (~300 ms) P3b event, late sustained activity, top-down amplification and long-range synchrony.',
        'Prefrontal cortex plays a central broadcasting/gating role — a key point of divergence from IIT.',
        'Distinguishes conscious access from mere preconscious or subliminal processing.'
      ],
      criticisms: [
        'The centrality of prefrontal cortex is contested — the "PFC = report, not consciousness" objection.',
        'The 2023 Cogitate collaboration did not decode content from PFC as strongly as predicted, and offset "re-ignition" was largely absent.',
        'Critics argue it explains reportability/access rather than phenomenal experience.'
      ]
    } }
  },
  {
    slug: 'higher-order-theories', status: 'mainstream', sort_order: 40,
    sources: [
      'https://plato.stanford.edu/entries/consciousness-higher/',
      'https://iep.utm.edu/higher-order-theories-of-consciousness/'
    ],
    content: { en: {
      title: 'Higher-Order Theories (HOT)', abbr: 'HOT',
      proponents: 'David Rosenthal (higher-order thought); Hakwan Lau (neural HOT); Peter Carruthers, William Lycan, Rocco Gennaro',
      summary: 'Higher-order theories say a mental state becomes conscious not by its first-order content alone but by being the target of a suitable higher-order representation — a thought or quasi-perception ABOUT that state. The difference between a conscious and an unconscious pain is that you are (non-inferentially) aware of yourself as being in it.',
      key_points: [
        'A state M is conscious iff it is represented by a higher-order state directed at M (the "transitivity principle").',
        'Variants: Higher-Order Thought (Rosenthal) vs Higher-Order Perception / inner-sense (Lycan); actualist vs dispositionalist (Carruthers).',
        'Locates part of the neural correlate of consciousness in prefrontal cortex (metacognition/monitoring) — Lau’s empirical program.',
        'Naturally accommodates misrepresentation (empty higher-order states → "targetless" HOTs).'
      ],
      criticisms: [
        'The "misrepresentation/rock" objection: what is experience like when there is no first-order state at all?',
        'Threat of infinite regress and of over-intellectualising animal/infant minds.',
        'First-order theorists say the higher-order representation is unnecessary and PFC activity reflects report, not experience.'
      ]
    } }
  },
  {
    slug: 'attention-schema-theory', status: 'influential', sort_order: 50,
    sources: [
      'https://en.wikipedia.org/wiki/Attention_schema_theory',
      'https://www.sciencedirect.com/science/article/pii/S030100822030099X'
    ],
    content: { en: {
      title: 'Attention Schema Theory (AST)', abbr: 'AST',
      proponents: 'Michael Graziano (Princeton); Taylor Webb, Aaron Schurger',
      summary: 'AST proposes that the brain builds a simplified internal model — an "attention schema" — of its own process of attention, just as it builds a body schema to model the body. Our conviction that we have a subjective, non-physical awareness is the content of this imperfect self-model; the brain concludes it has "awareness" because that is what its schematic model of attention tells it.',
      key_points: [
        'The attention schema is a fast, inaccurate internal model that helps monitor and control attention.',
        'Subjective awareness = the information contained in that model.',
        'One mechanism unifies control of attention, social cognition (attributing awareness to others), and the claim of subjective consciousness.',
        'A functional/engineering account amenable to AI implementation.'
      ],
      criticisms: [
        'Accused of dissolving rather than solving the hard problem — it explains why we report experience, not why there is something it is like.',
        'Thin direct empirical support that consciousness specifically arises from an attention schema.',
        'Critics say it may conflate access/awareness with phenomenality.'
      ]
    } }
  },
  {
    slug: 'predictive-processing', status: 'influential', sort_order: 60,
    sources: [
      'https://en.wikipedia.org/wiki/Predictive_coding',
      'https://onlinelibrary.wiley.com/doi/abs/10.1111/mila.12281'
    ],
    content: { en: {
      title: 'Predictive Processing / Predictive Coding', abbr: 'PP',
      proponents: 'Andy Clark, Jakob Hohwy; roots in Karl Friston, Rao & Ballard, Helmholtz',
      summary: 'Predictive processing casts the brain as a hierarchical prediction machine: higher levels generate top-down predictions of incoming sensory signals, and only the prediction ERROR is passed forward to update the model. Perception is "controlled hallucination" — the brain’s best top-down guess, reined in by sensory error. Applied to consciousness, experience is the content of the current winning generative model.',
      key_points: [
        'Hierarchical generative model + bottom-up prediction-error signals; perception = inference to the best explanation.',
        '"Precision weighting" (gain on prediction errors) is proposed to implement attention.',
        'Perception, action, and attention are unified as routes to minimising prediction error.',
        'Anil Seth’s interoceptive-inference variant ties selfhood and emotion to predictions about the body.'
      ],
      criticisms: [
        'Disputed whether it is a theory of consciousness at all, or only of perception/cognition (much unconscious processing is also predictive).',
        'Under-specifies which predictions become conscious and why.',
        'Risk of over-generality when everything is "prediction-error minimisation."'
      ]
    } }
  },
  {
    slug: 'free-energy-principle', status: 'influential', sort_order: 70,
    sources: [
      'https://en.wikipedia.org/wiki/Free_energy_principle',
      'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11202793/'
    ],
    content: { en: {
      title: 'Free Energy Principle / Active Inference', abbr: 'FEP',
      proponents: 'Karl Friston; Thomas Parr, Maxwell Ramstead (Active Inference)',
      summary: 'The FEP states that any self-organising system that persists must act to minimise "variational free energy" — an information-theoretic upper bound on surprise (the improbability of its sensory states given its model). The brain is a self-evidencing model that both updates its beliefs (perception) and acts on the world (active inference) to keep sensations within expected bounds. Predictive processing falls out of it as a special case.',
      key_points: [
        'Free energy ≈ prediction error + model complexity; minimising it approximates Bayesian inference.',
        'Active inference: organisms act to make sensory input match predictions, not only update predictions.',
        'Grounded in a "Markov blanket" formalism separating internal states from the environment.',
        'A principle about self-organisation, not a direct theory of phenomenal consciousness — applications (IWMT, interoceptive inference) are downstream.'
      ],
      criticisms: [
        'Criticised as so general as to be near-unfalsifiable ("everything that exists minimises free energy").',
        'The "dark room problem": why don’t agents just seek unsurprising, stimulus-free environments?',
        'Does not by itself explain phenomenal experience.'
      ]
    } }
  },
  {
    slug: 'orchestrated-objective-reduction', status: 'fringe', sort_order: 80,
    sources: [
      'https://en.wikipedia.org/wiki/Orchestrated_objective_reduction',
      'https://www.sciencedirect.com/science/article/pii/S1571064513001188'
    ],
    content: { en: {
      title: 'Orchestrated Objective Reduction (Orch-OR)', abbr: 'Orch-OR',
      proponents: 'Roger Penrose (physicist) & Stuart Hameroff (anaesthesiologist)',
      summary: 'Orch-OR claims consciousness arises from quantum computations inside neurons — specifically quantum-coherent states in microtubules (protein lattices of the cytoskeleton). Penrose argues from Gödelian and quantum-gravity considerations that understanding is non-computable; Hameroff supplies the biological substrate. Each "objective reduction" — a gravitationally-triggered self-collapse of the quantum state — is proposed to be a moment of conscious experience.',
      key_points: [
        'Consciousness = orchestrated sequences of objective-reduction events in neuronal microtubules.',
        'Draws on Penrose’s claim that human mathematical insight is non-algorithmic (Gödel-based argument).',
        'OR is a proposed physical collapse mechanism tied to quantum gravity, not standard decoherence.',
        'Points to anaesthetic action on microtubules as suggestive evidence.'
      ],
      criticisms: [
        'Decoherence objection (Tegmark): the warm, wet brain should destroy quantum coherence far too fast to matter — the physics is contested and most physicists side with this critique.',
        'Widely regarded as biologically implausible and lacking direct empirical confirmation.',
        'The Gödelian non-computability argument is disputed by most logicians and philosophers.'
      ]
    } }
  },
  {
    slug: 'integrated-world-modeling-theory', status: 'fringe', sort_order: 90,
    sources: [
      'https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2020.00030/full',
      'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9730424/'
    ],
    content: { en: {
      title: 'Integrated World Modeling Theory (IWMT)', abbr: 'IWMT',
      proponents: 'Adam Safron (2020)',
      summary: 'IWMT is a synthetic theory that uses the Free Energy Principle / Active Inference framework as a scaffold to combine IIT and GNWT. Its core claim is that consciousness is the brain’s integrated, embodied generative MODEL of itself-in-the-world — a coherent world-model organised around spatial, temporal, and causal (egocentric) reference frames.',
      key_points: [
        'A unifier: FEP-AI provides the "why," IIT the "integration/structure," GNWT the "global access/broadcast."',
        'Consciousness requires a coherent world-model in an embodied, embedded agent (self-in-world modelling).',
        'Proposes computational analogues: variational autoencoders, shared latent spaces for multimodal binding, graph neural networks for spatial modelling.',
        'Suggests IIT-style maximal complexes may be realised by synchronised harmonic modes across posterior cortex.'
      ],
      criticisms: [
        'Inherits the open problems of its parent theories (IIT’s Φ, FEP’s generality).',
        'Highly abstract with limited empirical testing specific to IWMT rather than its components.',
        'A comparatively new, single-author framework — less independently vetted; no dedicated encyclopedia entry yet.'
      ]
    } }
  },
  {
    slug: 'first-order-vs-higher-order-representationalism', status: 'mainstream', sort_order: 100,
    sources: [
      'https://plato.stanford.edu/entries/consciousness-higher/',
      'https://iep.utm.edu/higher-order-theories-of-consciousness/'
    ],
    content: { en: {
      title: 'First-Order vs Higher-Order Representationalism', abbr: 'FOR vs HOR',
      proponents: 'FOR: Fred Dretske, Michael Tye. HOR: David Rosenthal, William Lycan, Peter Carruthers, Rocco Gennaro',
      summary: 'Both camps are "representationalist" — the phenomenal character of an experience is exhausted by its representational content. They split on WHICH representation matters. First-Order Representationalism (FOR) says a suitably poised first-order, world-directed representation is sufficient for conscious experience. Higher-Order Representationalism (HOR) says that isn’t enough — the first-order state must ALSO be the object of a higher-order representation to be conscious.',
      key_points: [
        'FOR (Tye, Dretske): experience = first-order content "poised" to guide belief/action (Tye’s PANIC). No higher-order state needed.',
        'HOR (Rosenthal et al.): a state is conscious only if represented by a higher-order state — consciousness is relational.',
        'Empirical stakes: HOR predicts a prefrontal/metacognitive contribution; FOR predicts sensory-cortex content can suffice.',
        'Key test cases: misrepresentation, the inverted spectrum, and blindsight/masking dissociations.'
      ],
      criticisms: [
        'Against HOR: the "targetless HOT" misrepresentation problem, regress, over-intellectualisation.',
        'Against FOR: struggles to explain the conscious/unconscious distinction among equally world-representing states.',
        'Both are challenged by the hard problem — why any representation is accompanied by phenomenal feel.'
      ]
    } }
  }
];

// ── Terms glossary ───────────────────────────────────────────────────────
const TERMS = [
  { slug: 'attention', sort_order: 10, related_slugs: ['selective-attention', 'executive-function', 'salience-network'],
    content: { en: { term: 'Attention', synonyms: ['attentional control', 'focus'],
      definition: 'The cognitive process of selectively concentrating on a subset of available information while ignoring the rest. Attention allocates limited processing resources, and can be voluntary (top-down, goal-driven) or involuntary (bottom-up, stimulus-driven).' } } },
  { slug: 'selective-attention', sort_order: 20, related_slugs: ['attention', 'top-down-processing'],
    content: { en: { term: 'Selective attention', synonyms: ['focused attention'],
      definition: 'The ability to prioritise one stream of information over competing streams — for example, following one voice in a noisy room. It is supported by top-down biasing signals from fronto-parietal networks.' } } },
  { slug: 'inhibitory-control', sort_order: 30, related_slugs: ['executive-function', 'self-regulation', 'prefrontal-cortex'],
    content: { en: { term: 'Inhibitory control', synonyms: ['response inhibition', 'behavioural inhibition'],
      definition: 'A core executive function: the capacity to suppress prepotent, automatic, or impulsive responses in favour of a more appropriate or goal-directed one. It underlies self-control and is heavily dependent on prefrontal circuitry.' } } },
  { slug: 'self-regulation', sort_order: 40, related_slugs: ['inhibitory-control', 'emotion-regulation', 'executive-function'],
    content: { en: { term: 'Self-regulation', synonyms: ['self-control', 'self-management'],
      definition: 'The ability to monitor and modulate one’s own emotions, thoughts, attention, and behaviour to meet situational demands and long-term goals. It integrates inhibitory control, emotion regulation, and interoceptive awareness.' } } },
  { slug: 'executive-function', sort_order: 50, related_slugs: ['working-memory', 'inhibitory-control', 'cognitive-flexibility'],
    content: { en: { term: 'Executive function', synonyms: ['executive control', 'cognitive control'],
      definition: 'A family of top-down mental processes needed for concentration and deliberate thought: primarily working memory, inhibitory control, and cognitive flexibility. Higher-order executive functions (reasoning, planning, problem-solving) build on these.' } } },
  { slug: 'working-memory', sort_order: 60, related_slugs: ['executive-function', 'attention'],
    content: { en: { term: 'Working memory', synonyms: ['short-term active memory'],
      definition: 'A limited-capacity system for temporarily holding and manipulating information in mind, such as keeping a phone number active while dialling. It is foundational for reasoning, comprehension, and learning.' } } },
  { slug: 'cognitive-flexibility', sort_order: 70, related_slugs: ['executive-function'],
    content: { en: { term: 'Cognitive flexibility', synonyms: ['set-shifting', 'task-switching'],
      definition: 'The capacity to shift between concepts, tasks, or perspectives, and to adapt behaviour to changing rules or demands. It is one of the three core executive functions.' } } },
  { slug: 'neuroplasticity', sort_order: 80, related_slugs: ['myelination', 'long-term-potentiation'],
    content: { en: { term: 'Neuroplasticity', synonyms: ['brain plasticity', 'neural plasticity'],
      definition: 'The brain’s lifelong ability to reorganise its structure, function, and connections in response to experience, learning, or injury. It ranges from synaptic changes to large-scale remapping of cortical areas.' } } },
  { slug: 'myelination', sort_order: 90, related_slugs: ['neuroplasticity'],
    content: { en: { term: 'Myelination', synonyms: ['myelinogenesis'],
      definition: 'The process by which glial cells wrap axons in a fatty myelin sheath, dramatically increasing the speed and reliability of neural signal transmission. It continues into early adulthood, especially in prefrontal regions supporting self-control.' } } },
  { slug: 'long-term-potentiation', sort_order: 100, related_slugs: ['neuroplasticity', 'hippocampus'],
    content: { en: { term: 'Long-term potentiation (LTP)', synonyms: ['synaptic strengthening'],
      definition: 'A long-lasting increase in the strength of a synapse following high-frequency stimulation — a leading cellular mechanism of learning and memory, first characterised in the hippocampus.' } } },
  { slug: 'interoception', sort_order: 110, related_slugs: ['self-regulation', 'emotion-regulation', 'insula'],
    content: { en: { term: 'Interoception', synonyms: ['internal bodily sensing'],
      definition: 'The perception of the internal state of the body — heartbeat, breathing, hunger, temperature, visceral sensations. Interoceptive signals are central to emotion, self-awareness, and homeostatic regulation, and are integrated in the insular cortex.' } } },
  { slug: 'emotion-regulation', sort_order: 120, related_slugs: ['self-regulation', 'cognitive-reappraisal', 'amygdala'],
    content: { en: { term: 'Emotion regulation', synonyms: ['affect regulation'],
      definition: 'The processes by which people influence which emotions they have, when they have them, and how they experience and express them. Strategies range from cognitive reappraisal to attentional deployment and response modulation.' } } },
  { slug: 'cognitive-reappraisal', sort_order: 130, related_slugs: ['emotion-regulation', 'prefrontal-cortex'],
    content: { en: { term: 'Cognitive reappraisal', synonyms: ['reframing'],
      definition: 'An emotion-regulation strategy that changes the emotional impact of a situation by reinterpreting its meaning. It engages prefrontal control regions to modulate activity in the amygdala and other affective areas.' } } },
  { slug: 'prefrontal-cortex', sort_order: 140, related_slugs: ['executive-function', 'inhibitory-control'],
    content: { en: { term: 'Prefrontal cortex (PFC)', synonyms: ['frontal executive cortex'],
      definition: 'The front-most region of the frontal lobes, central to executive function, working memory, decision-making, and the top-down control of attention and emotion. It is among the last brain regions to fully mature.' } } },
  { slug: 'amygdala', sort_order: 150, related_slugs: ['emotion-regulation', 'interoception'],
    content: { en: { term: 'Amygdala', synonyms: ['amygdaloid complex'],
      definition: 'An almond-shaped set of nuclei in the medial temporal lobe that assigns emotional salience to stimuli — especially threat and fear — and coordinates rapid physiological and behavioural responses.' } } },
  { slug: 'hippocampus', sort_order: 160, related_slugs: ['long-term-potentiation', 'working-memory'],
    content: { en: { term: 'Hippocampus', synonyms: ['hippocampal formation'],
      definition: 'A medial temporal lobe structure essential for forming new episodic and spatial memories and for spatial navigation. It is a key site of neuroplasticity and adult neurogenesis.' } } },
  { slug: 'salience-network', sort_order: 170, related_slugs: ['attention', 'interoception'],
    content: { en: { term: 'Salience network', synonyms: ['ventral attention network'],
      definition: 'A large-scale brain network (anchored in the anterior insula and dorsal anterior cingulate cortex) that detects behaviourally relevant stimuli and switches control between the default-mode and executive networks.' } } },
  { slug: 'default-mode-network', sort_order: 180, related_slugs: ['salience-network'],
    content: { en: { term: 'Default-mode network (DMN)', synonyms: ['task-negative network'],
      definition: 'A set of interacting brain regions most active during rest and internally-directed thought — self-reflection, mind-wandering, autobiographical memory, and imagining the future.' } } },
  { slug: 'top-down-processing', sort_order: 190, related_slugs: ['attention', 'predictive-processing'],
    content: { en: { term: 'Top-down processing', synonyms: ['conceptually-driven processing'],
      definition: 'Perception and cognition guided by prior knowledge, expectations, and goals, which bias how incoming sensory information is interpreted — contrasted with bottom-up, stimulus-driven processing.' } } },
  { slug: 'insula', sort_order: 200, related_slugs: ['interoception', 'salience-network'],
    content: { en: { term: 'Insular cortex', synonyms: ['insula'],
      definition: 'A cortical region folded deep within the lateral sulcus that integrates interoceptive, emotional, and cognitive information, and contributes to subjective feelings and bodily self-awareness.' } } }
];

// ── Methods we work with (list expands over time) ────────────────────────
const METHODS = [
  { slug: 'sensation-mapping', category: 'somatic', sort_order: 10,
    content: { en: { name: 'Sensation Mapping', summary: 'Locating and naming bodily sensations to build interoceptive awareness.',
      body_html: '<p>Sensation Mapping guides a person to notice where in the body a feeling lives, and to give it a precise name (warmth, tightness, buzzing). Repeated practice sharpens <em>interoception</em> — the felt sense of the body’s internal state — which is a foundation for emotion regulation and self-regulation.</p>',
      steps: ['Pause and bring attention inward.', 'Scan the body and locate the strongest sensation.', 'Name its quality, intensity, and location.', 'Notice how it changes as you attend to it.'] } } },
  { slug: 'emotion-differentiation', category: 'affective', sort_order: 20,
    content: { en: { name: 'Emotion Differentiation', summary: 'Distinguishing and labelling emotions with granularity.',
      body_html: '<p>Emotion Differentiation (emotional granularity) is the practice of resolving a vague affective state into specific, distinct emotions. Higher granularity is associated with better emotion regulation and resilience, because precisely-labelled emotions are easier to act on.</p>',
      steps: ['Notice that an emotion is present.', 'Move beyond "good/bad" to a specific label.', 'Distinguish similar emotions (e.g. anxiety vs frustration).', 'Link the emotion to its trigger and bodily sensation.'] } } },
  { slug: 'interoceptive-awareness-training', category: 'somatic', sort_order: 30,
    content: { en: { name: 'Interoceptive Awareness Training', summary: 'Systematic attention to internal bodily signals.',
      body_html: '<p>Interoceptive Awareness Training builds the capacity to detect, interpret, and regulate internal signals such as heartbeat, breath, and tension. It strengthens the insula-centred networks that underlie emotional and homeostatic regulation.</p>',
      steps: ['Attend to the breath without changing it.', 'Track the heartbeat or pulse.', 'Notice hunger, temperature, and tension signals.', 'Practice returning attention gently when it wanders.'] } } },
  { slug: 'attention-training', category: 'cognitive', sort_order: 40,
    content: { en: { name: 'Attention Training', summary: 'Exercising sustained and selective attention.',
      body_html: '<p>Attention Training uses focused practice — sustaining attention on a chosen object and redirecting it after distraction — to strengthen selective and sustained attention. Over time this supports the fronto-parietal control systems that regulate focus.</p>',
      steps: ['Choose a single anchor for attention.', 'Sustain focus on the anchor.', 'Notice when attention drifts.', 'Return to the anchor without judgement.'] } } },
  { slug: 'cognitive-reappraisal-practice', category: 'cognitive', sort_order: 50,
    content: { en: { name: 'Cognitive Reappraisal Practice', summary: 'Reframing the meaning of a situation to change its emotional impact.',
      body_html: '<p>Cognitive Reappraisal Practice trains the deliberate reinterpretation of an emotionally charged situation. Engaging prefrontal control to reframe meaning reliably lowers the intensity of negative affect and is a cornerstone of many evidence-based interventions.</p>',
      steps: ['Identify the situation and the emotion it evokes.', 'Surface the automatic interpretation.', 'Generate an alternative, plausible interpretation.', 'Notice the shift in emotional intensity.'] } } }
];

// ── Research summaries (article format) ──────────────────────────────────
const RESEARCH = [
  { slug: 'attention-networks-overview', topic: 'attention', sort_order: 10,
    source_url: 'https://en.wikipedia.org/wiki/Attention', authors: [],
    content: { en: { title: 'The organisation of attention networks',
      summary: 'A synthesis of how the brain implements attention across distinct but interacting networks.',
      body_html: '<p>Contemporary models divide attention into partly separable networks: an <strong>alerting</strong> system (maintaining a vigilant state), an <strong>orienting</strong> system (selecting information from sensory input), and an <strong>executive control</strong> system (resolving conflict among responses). These map onto fronto-parietal and cingulo-opercular circuitry with distinct neuromodulators.</p><p>Top-down (goal-driven) and bottom-up (stimulus-driven) control interact continuously, and their balance is a strong predictor of performance on tasks requiring focus.</p>',
      findings: ['Attention is not a single faculty but a set of interacting networks.', 'Dorsal fronto-parietal regions support voluntary orienting; a ventral network detects salient events.', 'Executive attention is closely tied to self-regulation and school/work outcomes.'] } } },
  { slug: 'inhibitory-control-development', topic: 'inhibitory_control', sort_order: 20,
    source_url: 'https://en.wikipedia.org/wiki/Inhibitory_control', authors: [],
    content: { en: { title: 'Inhibitory control and its development',
      summary: 'How response inhibition matures and why it matters for life outcomes.',
      body_html: '<p>Inhibitory control — suppressing prepotent responses in favour of goal-appropriate ones — depends on right inferior frontal cortex and connected basal-ganglia circuits. It develops steadily through childhood and adolescence, tracking the protracted maturation of prefrontal cortex.</p><p>Longitudinal work links early self-control to later health, wealth, and wellbeing, making inhibitory control a high-value target for intervention.</p>',
      findings: ['Right inferior frontal cortex is a hub for response inhibition.', 'Inhibitory control matures slowly, alongside prefrontal myelination.', 'Early self-control predicts a broad range of adult outcomes.'] } } },
  { slug: 'self-regulation-mechanisms', topic: 'self_regulation', sort_order: 30,
    source_url: 'https://en.wikipedia.org/wiki/Emotional_self-regulation', authors: [],
    content: { en: { title: 'Mechanisms of self-regulation',
      summary: 'The cognitive and neural machinery that lets people steer their own behaviour.',
      body_html: '<p>Self-regulation integrates inhibitory control, emotion regulation, and interoceptive awareness under top-down prefrontal guidance. Cognitive reappraisal — reinterpreting the meaning of an event — is among the most robustly effective strategies, engaging lateral prefrontal cortex to modulate the amygdala.</p><p>Interoceptive accuracy supports regulation by making internal states available for appraisal and adjustment.</p>',
      findings: ['Prefrontal control regions modulate limbic activity during regulation.', 'Reappraisal reduces negative affect more durably than suppression.', 'Interoception is a substrate for, not merely a correlate of, self-regulation.'] } } },
  { slug: 'conscious-activation-of-ns-areas', topic: 'conscious_activation', sort_order: 40,
    source_url: 'https://en.wikipedia.org/wiki/Neurofeedback', authors: [],
    content: { en: { title: 'Conscious, voluntary activation of specific nervous-system areas',
      summary: 'Evidence that people can learn to modulate targeted brain regions through feedback and attention.',
      body_html: '<p>Real-time neurofeedback and interoceptive training show that individuals can learn to up- or down-regulate activity in specific regions — for example the amygdala or anterior insula — when given a signal of their own neural state. Voluntary, attention-guided regulation of bodily and neural signals is a form of conscious activation with therapeutic potential.</p><p>Effects are typically modest and require practice, and rigorous sham-controlled designs remain important.</p>',
      findings: ['Neurofeedback can teach voluntary regulation of targeted regions.', 'Attention and interoception are the levers of conscious activation.', 'Sham-controlled trials are essential to separate specific from placebo effects.'] } } },
  { slug: 'cogitate-iit-gnwt-adversarial-collaboration', topic: 'consciousness', sort_order: 50,
    source_url: 'https://www.nature.com/articles/s41586-025-08888-1', authors: ['Cogitate Consortium'],
    content: { en: { title: 'The IIT vs GNWT adversarial collaboration (Cogitate, 2023/2025)',
      summary: 'A large preregistered study that tested two leading consciousness theories head-to-head — with a mixed, honest verdict.',
      body_html: '<p>In an unusual "adversarial collaboration," proponents of <strong>Integrated Information Theory</strong> and <strong>Global Neuronal Workspace Theory</strong> jointly preregistered rival, falsifiable predictions before any data were collected, with theory advocates kept separate from the analysis teams. 256 participants viewed stimuli while activity was recorded with fMRI, MEG, and intracranial EEG. Preliminary results were announced in 2023; the peer-reviewed paper appeared in Nature in 2025.</p><p>The verdict was genuinely <strong>mixed, with no clear winner</strong>. Conscious content was decodable maximally from posterior cortex and did not require prefrontal "broadcasting" as strongly as GNWT predicts — a point for IIT. But the sustained posterior synchronisation IIT predicted was not reliably found, and content-specific information <em>was</em> present in inferior frontal cortex — points for GNWT. Both theories were partly corroborated and partly challenged; neither was confirmed or refuted wholesale.</p>',
      findings: ['Conscious content decoded best from posterior, not prefrontal, cortex.', 'Predicted sustained posterior synchronisation (IIT) was not reliably observed.', 'Content-specific information in inferior frontal cortex partly supported GNWT.', 'Framed honestly: partial support for both, decisive for neither.'] } } },
  { slug: 'iit-pseudoscience-debate', topic: 'consciousness', sort_order: 60,
    source_url: 'https://en.wikipedia.org/wiki/Integrated_information_theory', authors: [],
    content: { en: { title: 'The 2023 "IIT is pseudoscience" open letter and the debate it sparked',
      summary: 'A high-profile dispute over whether a leading consciousness theory is properly scientific.',
      body_html: '<p>In September 2023, an open letter signed by 124 researchers argued that Integrated Information Theory should be labelled "pseudoscience" — not that its conclusions are false, but that, as promoted, it is not properly testable and receives attention disproportionate to its empirical support. Its central complaints were that Φ is effectively unfalsifiable for real systems and that IIT entails an uncomfortable commitment to panpsychism.</p><p>The reaction was itself divided. Defenders including Anil Seth argued that "even if IIT is wrong, that does not make it pseudoscience," and figures such as David Chalmers and Philip Goff defended it as a legitimate, if bold, research programme. A survey of consciousness researchers found only a small minority fully endorsed the "pseudoscience" label — the field did not broadly accept it.</p>',
      findings: ['124 researchers signed the 2023 open letter.', 'Core objections: unfalsifiability of Φ and the panpsychism implication.', 'Prominent defenders pushed back; most researchers did not endorse the label.', 'Illustrates how "is it science?" itself becomes a live question at the frontier.'] } } }
];

// ── Cognitive functions library (mini-atlas) ─────────────────────────────
// body_regions are BodyAtlas seed-ids (verified against the live
// /api/anatomy/functions region vocabulary) passed to BodyAtlas.tintRegions()
// so the in-page mini-atlas highlights this function's brain regions.
const FUNCTIONS = [
  { slug: 'attention', sort_order: 10, body_regions: ['frontal-lobe', 'parietal-lobe', 'cingulate', 'thalamus'],
    content: { en: { name: 'Attention',
      summary: 'The selective allocation of limited processing resources to relevant information.',
      body_html: '<p><strong>Attention</strong> is the cognitive process of selectively concentrating on some information while filtering out the rest. It is not a single faculty but a set of interacting systems — alerting (staying vigilant), orienting (selecting a source), and executive control (resolving conflict).</p><p>Voluntary, goal-driven (top-down) attention is supported by a dorsal fronto-parietal network, while a ventral network detects unexpected, salient events (bottom-up). The <em>thalamus</em> gates and relays the signals these networks act on. Attention is tightly coupled to working memory and to self-regulation.</p>' } } },
  { slug: 'working-memory', sort_order: 20, body_regions: ['frontal-lobe', 'parietal-lobe'],
    content: { en: { name: 'Working memory',
      summary: 'Temporarily holding and manipulating information in mind.',
      body_html: '<p><strong>Working memory</strong> is a limited-capacity system for holding information active and manipulating it over seconds — keeping a phone number in mind while dialling, or tracking the thread of a sentence. It is foundational for reasoning, comprehension, and learning.</p><p>Sustained activity in the <em>dorsolateral prefrontal cortex</em> and <em>posterior parietal cortex</em> maintains representations, while attention and executive control protect them from interference.</p>' } } },
  { slug: 'executive-control', sort_order: 30, body_regions: ['frontal-lobe', 'cingulate', 'basal-ganglia'],
    content: { en: { name: 'Executive control',
      summary: 'Top-down coordination of thought and action: inhibition, updating, and shifting.',
      body_html: '<p><strong>Executive control</strong> (cognitive control) is the family of top-down processes that let us override habits and pursue goals. Its core components are inhibitory control (suppressing prepotent responses), updating (working-memory maintenance), and shifting (cognitive flexibility).</p><p>The <em>lateral prefrontal cortex</em> and <em>anterior cingulate cortex</em> implement control and monitor for conflict, working with the <em>basal ganglia</em> to gate which actions are released. Executive control matures slowly, tracking prefrontal myelination into early adulthood.</p>' } } },
  { slug: 'language', sort_order: 40, body_regions: ['frontal-lobe', 'temporal-lobe', 'parietal-lobe'],
    content: { en: { name: 'Language',
      summary: 'Comprehending and producing structured, meaningful communication.',
      body_html: '<p><strong>Language</strong> spans comprehension and production of speech, reading, and writing. Classically, <em>Broca’s area</em> (inferior frontal) supports production and syntax, and <em>Wernicke’s area</em> (posterior temporal) supports comprehension, connected by the arcuate fasciculus.</p><p>Modern accounts describe a distributed left-lateralised network across frontal, temporal, and parietal cortex, integrating sound, meaning, and grammar in real time.</p>' } } },
  { slug: 'motor-planning', sort_order: 50, body_regions: ['frontal-lobe', 'cerebellum', 'basal-ganglia', 'parietal-lobe'],
    content: { en: { name: 'Motor planning',
      summary: 'Preparing and sequencing voluntary movement before execution.',
      body_html: '<p><strong>Motor planning</strong> transforms an intention into an ordered sequence of muscle commands. The <em>premotor</em> and <em>supplementary motor</em> areas of the frontal lobe assemble the plan, the <em>basal ganglia</em> select and scale it, and the <em>cerebellum</em> tunes its timing and coordination.</p><p>Parietal cortex supplies the spatial and proprioceptive information the plan needs, so that movements are shaped to the body and the world.</p>' } } },
  { slug: 'emotion-regulation', sort_order: 60, body_regions: ['frontal-lobe', 'amygdala', 'cingulate', 'insula'],
    content: { en: { name: 'Emotion regulation',
      summary: 'Influencing which emotions arise, and how they are experienced and expressed.',
      body_html: '<p><strong>Emotion regulation</strong> is the set of processes by which we shape our emotional responses — through reappraisal, attentional deployment, or response modulation. Effective regulation is central to wellbeing and mental health.</p><p>The <em>prefrontal cortex</em> exerts top-down control over the <em>amygdala</em>, which assigns emotional salience; the <em>anterior cingulate</em> monitors affective conflict and the <em>insula</em> integrates the bodily (interoceptive) side of feeling. Cognitive reappraisal is among the most durable strategies.</p>' } } },
  { slug: 'decision-making', sort_order: 70, body_regions: ['frontal-lobe', 'basal-ganglia', 'cingulate'],
    content: { en: { name: 'Decision-making',
      summary: 'Evaluating options and selecting actions under uncertainty and reward.',
      body_html: '<p><strong>Decision-making</strong> weighs the value, risk, and cost of options to choose an action. The <em>orbitofrontal</em> and <em>ventromedial prefrontal cortex</em> represent value, the <em>anterior cingulate</em> tracks effort and outcomes, and the <em>basal ganglia</em> and midbrain dopamine system encode reward and learning signals.</p><p>Decisions integrate evidence over time, and are shaped by both deliberate reasoning and fast, affect-driven heuristics.</p>' } } },
  { slug: 'theory-of-mind', sort_order: 80, body_regions: ['frontal-lobe', 'temporal-lobe', 'parietal-lobe', 'cingulate'],
    content: { en: { name: 'Theory of mind',
      summary: 'Attributing mental states — beliefs, desires, intentions — to oneself and others.',
      body_html: '<p><strong>Theory of mind</strong> (mentalising) is the capacity to understand that others have beliefs, desires, and intentions different from one’s own. It underpins empathy, cooperation, and social prediction.</p><p>A dedicated social-cognition network is engaged: the <em>medial prefrontal cortex</em>, the <em>temporo-parietal junction</em> (at the temporal–parietal border), the posterior <em>superior temporal sulcus</em>, and the precuneus/cingulate.</p>' } } },
  { slug: 'interoception', sort_order: 90, body_regions: ['insula', 'cingulate', 'thalamus', 'medulla'],
    content: { en: { name: 'Interoception',
      summary: 'Sensing the internal physiological state of the body.',
      body_html: '<p><strong>Interoception</strong> is the perception of the body’s internal state — heartbeat, breathing, hunger, temperature, and visceral sensations. It is a foundation for emotion, bodily self-awareness, and homeostatic regulation.</p><p>Visceral signals ascend via the brainstem (<em>medulla</em>) and <em>thalamus</em> to the <em>insular cortex</em>, where they are integrated into felt experience; the <em>anterior cingulate</em> links interoceptive states to motivation and control. Training interoceptive awareness is a core method in self-regulation work.</p>' } } }
];

// ── Scientific articles (rich content w/ inline SVG figure) ──────────────
// Inline SVG keeps the "article with images" demo self-contained and offline.
const ARTICLES = [
  { slug: 'what-is-attention', format: 'rich', sort_order: 10, authors: ['NeuroAttention'],
    source_url: 'https://en.wikipedia.org/wiki/Attention', cover_url: '',
    content: { en: {
      title: 'What is attention? A short introduction',
      summary: 'Attention as a set of interacting brain networks — and why it matters for learning and self-regulation.',
      body_html:
        '<p>We speak of "paying attention" as if it were one thing. In the brain, it is better understood as several cooperating systems that together decide which slice of the flood of incoming information reaches awareness and guides behaviour.</p>' +
        '<h3>Three attention systems</h3>' +
        '<figure><svg viewBox="0 0 620 220" width="100%" style="max-width:620px;background:transparent" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagram of alerting, orienting, and executive attention networks">' +
          '<rect x="20" y="70" width="160" height="80" rx="10" fill="#8ab4ff" opacity="0.85"/>' +
          '<rect x="230" y="70" width="160" height="80" rx="10" fill="#78c8eb" opacity="0.85"/>' +
          '<rect x="440" y="70" width="160" height="80" rx="10" fill="#a6a0f0" opacity="0.85"/>' +
          '<text x="100" y="105" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#0b1020">Alerting</text>' +
          '<text x="100" y="128" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#0b1020">stay vigilant</text>' +
          '<text x="310" y="105" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#0b1020">Orienting</text>' +
          '<text x="310" y="128" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#0b1020">select a source</text>' +
          '<text x="520" y="105" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="700" fill="#0b1020">Executive</text>' +
          '<text x="520" y="128" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#0b1020">resolve conflict</text>' +
          '<path d="M180 110 L230 110" stroke="#9fb0d0" stroke-width="3" marker-end="url(#ah)"/>' +
          '<path d="M390 110 L440 110" stroke="#9fb0d0" stroke-width="3" marker-end="url(#ah)"/>' +
          '<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#9fb0d0"/></marker></defs>' +
        '</svg><figcaption>The alerting, orienting, and executive-control systems of attention.</figcaption></figure>' +
        '<p>The <strong>alerting</strong> system keeps us in a vigilant, ready state. The <strong>orienting</strong> system selects which source of information to sample — a face in a crowd, a word on a page. The <strong>executive</strong> system resolves conflict between competing responses, and is the part most closely tied to self-control and learning.</p>' +
        '<h3>Top-down and bottom-up</h3>' +
        '<p>Attention is pulled in two directions. <em>Bottom-up</em> capture is driven by the stimulus itself — a sudden noise, a bright flash. <em>Top-down</em> control reflects our goals, biasing perception toward what matters for the task. Skilled focus is largely the ability to keep top-down control in charge when the world is trying to grab it.</p>' +
        '<p>Because executive attention overlaps with self-regulation, training attention is one of the most transferable things we can practise — it touches learning, emotion regulation, and everyday follow-through.</p>'
    } } },
  { slug: 'the-predictive-brain', format: 'rich', sort_order: 20, authors: ['NeuroAttention'],
    source_url: 'https://en.wikipedia.org/wiki/Predictive_coding', cover_url: '',
    content: { en: {
      title: 'The predictive brain: perception as controlled hallucination',
      summary: 'Why perception is the brain’s best guess about its causes, corrected by error.',
      body_html:
        '<p>A powerful idea in modern neuroscience is that the brain is not a passive receiver of sensory data but an active <strong>prediction machine</strong>. Higher levels constantly generate predictions about incoming signals, and only the mismatch — the <em>prediction error</em> — is passed forward to update the model.</p>' +
        '<figure><svg viewBox="0 0 560 210" width="100%" style="max-width:560px;background:transparent" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Predictive coding loop: predictions flow down, errors flow up">' +
          '<rect x="200" y="20" width="160" height="46" rx="8" fill="#a6a0f0" opacity="0.85"/>' +
          '<rect x="200" y="150" width="160" height="46" rx="8" fill="#78c8eb" opacity="0.85"/>' +
          '<text x="280" y="48" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#0b1020">Generative model</text>' +
          '<text x="280" y="178" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#0b1020">Sensory input</text>' +
          '<path d="M250 66 L250 150" stroke="#7fd4a8" stroke-width="3" marker-end="url(#d)"/>' +
          '<path d="M310 150 L310 66" stroke="#e88" stroke-width="3" marker-end="url(#u)"/>' +
          '<text x="228" y="112" text-anchor="end" font-family="sans-serif" font-size="11" fill="#7fd4a8">prediction</text>' +
          '<text x="332" y="112" text-anchor="start" font-family="sans-serif" font-size="11" fill="#e88">error</text>' +
          '<defs><marker id="d" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#7fd4a8"/></marker>' +
          '<marker id="u" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#e88"/></marker></defs>' +
        '</svg><figcaption>Predictions flow downward; only prediction errors flow upward to revise the model.</figcaption></figure>' +
        '<p>On this view, perception is a kind of <em>controlled hallucination</em>: the brain’s best top-down guess about the causes of its sensations, reined in by error signals from the senses. Attention, in the same framework, is the process of adjusting how much weight (precision) to give particular prediction errors.</p>' +
        '<p>The framework unifies perception, action, and attention as different ways of minimising prediction error — and connects, at its most ambitious, to the Free Energy Principle and to theories of consciousness. See the <em>Theories</em> section for how these ideas extend to conscious experience.</p>'
    } } }
];

module.exports = { THEORIES, TERMS, METHODS, RESEARCH, FUNCTIONS, ARTICLES };
