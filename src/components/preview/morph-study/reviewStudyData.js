import { DEMO_GECKO_PORTRAITS } from '@/data/demo-gecko-portraits';

// This review uses the founder's actual, public specimens, not fictional demo
// identities. Lesson and assessment membership are separated by animal ID.
const specimen = (id, name, width, height, description, features) => ({
  id, name, width, height, description, features,
  src: `/demo-geckos/${id}.webp`,
  animalId: DEMO_GECKO_PORTRAITS[id].sourceId,
  source: `https://geckinspect.com/GeckoDetail?id=${DEMO_GECKO_PORTRAITS[id].sourceId}`,
  credit: 'Tennyson · Geck Inspect collection',
  reuseApproved: true,
});

export const REVIEW_SPECIMENS = {
  selva: specimen('selva', 'Selva', 841, 658,
    'An orange and dark crested gecko resting on pale wood. Uneven pale and orange markings occupy the flank and legs.', {
      lateral: [
        { x: 45, y: 59, label: 'Look below the crest: pale and orange patches rise from the lower flank, with dark areas between them.' },
        { x: 48, y: 74, label: 'The foreleg is patterned too. Read the flanks and limbs together.' },
        { x: 36, y: 47, label: 'The patterned field on the back is a separate region from the flank below it.' },
      ],
      pinstripe: [{ x: 53, y: 50, label: 'The raised edge forms a narrow row. Do not confuse it with the broad orange field above.' }],
    }),
  bliss: specimen('bliss', 'Bliss', 889, 1000,
    'An orange, dark and cream crested gecko clings to an ornament, exposing a patterned side and legs.', {
      lateral: [
        { x: 32, y: 43, label: 'Cream and orange patches interlock with the dark base. Their outlines and spacing are uneven.' },
        { x: 49, y: 44, label: 'The patterned leg is another useful clue; color alone is not the definition of harlequin.' },
      ],
      pinstripe: [{ x: 27, y: 31, label: 'A narrow pale crest row and extensive lateral pattern can be present on the same animal.' }],
    }),
  'pony-boy': specimen('pony-boy', 'Pony Boy', 750, 1000,
    'A cream and olive-brown crested gecko on a hand, viewed obliquely from above. The back, one flank and legs are visible.', {
      lateral: [{ x: 53, y: 45, label: 'Cream extends onto the side in uneven lobes, with dark interruptions.' }, { x: 68, y: 58, label: 'The foreleg carries pattern too. This angle also reveals the broad dorsal field.' }],
      pinstripe: [{ x: 51, y: 48, label: 'Follow the raised boundary, not the whole cream field between the two edges.' }, { x: 37, y: 42, label: 'This broad pale area is dorsal pattern. Its width does not measure pinstripe continuity.' }],
    }),
  raindrop: specimen('raindrop', 'Raindrop', 750, 1000,
    'A crested gecko on a red ornament, facing left. A pale crest row runs above irregular cream side patches.', {
      pinstripe: [{ x: 71, y: 24, label: 'Trace the individual raised scales along the visible dorsal edge.' }, { x: 66, y: 36, label: 'These larger patches sit below the crest. They are lateral pattern, not the pinstripe.' }],
      lateral: [{ x: 70, y: 34, label: 'Pale lower-flank patches rise unevenly into the dark base.' }],
    }),
  frito: specimen('frito', 'Frito', 952, 1000,
    'A pale crested gecko on cork. Dark spots of different sizes occur on its body, head and front leg.', {
      spots: [{ x: 40, y: 42, label: 'Separate dark spots have their own outlines. Several are irregular or touch one another.' }, { x: 44, y: 56, label: 'Spots also occur on the limbs. Do not limit your search to the back.' }],
    }),
  odin: specimen('odin', 'Odin', 750, 1000,
    'A dark crested gecko sits on a hand. Irregular cream patches cover parts of the lower flank and rear leg; a pale raised edge runs along the back.', {
      lateral: [{ x: 58, y: 43, label: 'Cream rises from the lower flank in uneven patches.' }, { x: 71, y: 54, label: 'The hind limb also carries cream markings.' }],
    }),
  cheeto: specimen('cheeto', 'Cheeto', 1000, 680,
    'A red-orange crested gecko rests on leaves. Separate dark spots of different sizes appear on the head, trunk and legs.', {
      spots: [{ x: 58, y: 55, label: 'These dark marks are distinct spots on a red-orange base.' }, { x: 37, y: 32, label: 'Follow individual spot outlines rather than assuming every dark mark forms a band.' }],
    }),
  moonlight: specimen('moonlight', 'Moonlight', 750, 1000,
    'A very pale gray and cream crested gecko on a hand. Cream flank patches are visible, but their contrast against the body is low.', {
      lateral: [{ x: 34, y: 61, label: 'The pale flank pattern is still visible against a low-contrast base.' }],
    }),
  olivia: specimen('olivia', 'Olivia', 750, 1000,
    'An olive-tan crested gecko among leaves. The pose and vegetation do not expose both crest rows completely.', {
      pinstripe: [],
    }),
};

export const RAINDROP_RIGHT = {
  ...REVIEW_SPECIMENS.raindrop,
  id: 'raindrop-right', width: 1050, height: 1400,
  src: '/morph-guide/specimen-studies/raindrop-right.webp',
  description: 'The same gecko faces right on the red ornament. This opposite flank has different cream patches and several dark spots.',
  features: {
    pinstripe: [{ x: 40, y: 20, label: 'The opposite dorsal edge is visible here. The tail base is outside the frame, so these photos do not establish a complete pinstripe grade.' }],
    lateral: [{ x: 26, y: 32, label: 'These cream patches belong to the opposite flank. They are not a mirror of the other side.' }],
    spots: [{ x: 38, y: 29, label: 'Several discrete dark spots sit within pale lateral pattern. Spots can coexist with other markings.' }],
  },
};
REVIEW_SPECIMENS['raindrop-right'] = RAINDROP_RIGHT;

export const REVIEW_LESSONS = [
  {
    id: 'harlequin', title: 'Harlequin', region: 'lateral', subtitle: 'Read the flanks and the limbs.', view: 'side',
    examples: ['selva', 'bliss', 'pony-boy'], stages: { dorsal: 4, lateral: 3 },
    observation: 'Start below the raised edge of the back. Look for irregular light pattern on the sides and legs, with darker areas between the patches.',
    comparison: 'Compare the location and shape of the markings across these three animals. Their color, coverage and patch outlines differ.',
    boundary: 'A cream back alone is not enough. “Extreme” describes high coverage in breeder usage; there is no universal percentage boundary to learn here.',
    source: 'https://www.pangeareptile.com/collections/harlequin', sourceLabel: 'Pangea: harlequin and lateral coverage',
  },
  {
    id: 'pinstripe', title: 'Pinstripe', region: 'pinstripe', subtitle: 'Follow the raised dorsal edges.', view: 'top',
    examples: ['raindrop', 'pony-boy', 'bliss'], stages: { pinstripe: 5 },
    observation: 'Trace the narrow rows of raised scales along the edges of the back. Keep them separate from the broad dorsal field and the flank pattern.',
    comparison: 'Change the viewing angle before judging continuity. A side photograph usually shows one row much better than the other.',
    boundary: 'A hidden crest row is unknown, not absent. Assessing full versus partial pinstripe requires a clear view of both rows through the tail base.',
    source: 'https://www.pangeareptile.com/collections/pinstripe', sourceLabel: 'Pangea: the structure of pinstripe',
  },
  {
    id: 'dalmatian', title: 'Dalmatian spotting', region: 'spots', subtitle: 'Find the individual spots.', view: 'side',
    examples: ['frito', 'raindrop-right'], stages: { spots: 3 },
    observation: 'Look for distinct pigment spots with their own outlines. Size and spacing vary, and some spots may touch. Check the limbs and head as well as the body.',
    comparison: 'Frito shows spots on a relatively plain pale body. Raindrop shows a few dark spots among lateral pattern. Observe the feature without forcing the animals into exclusive categories.',
    boundary: 'A spot count in one photograph misses hidden surfaces. It cannot establish a genotype or a universal “super Dalmatian” cutoff.',
    source: 'https://lmreptiles.com/fg-pt2-1/', sourceLabel: 'LIL MONSTERS: photographed pattern variation',
  },
];

// No animal from the lessons or the two-sided specimen study appears here.
// These questions test observations, not the keeper's label or hidden genes.
export const REVIEW_QUESTIONS = [
  {
    id: 'lateral', specimen: 'odin', region: 'lateral', lesson: 'harlequin',
    prompt: 'Which observation best supports a harlequin description?',
    answers: ['The pale field on the back, by itself', 'Irregular pale pattern on the flanks and limbs', 'A pale line along the raised dorsal edge, by itself'], correct: 1,
    explanation: 'Follow the cream patches on the flank and hind leg. A pale back or a pinstripe alone would not make the same observation.',
  },
  {
    id: 'spots', specimen: 'cheeto', region: 'spots', lesson: 'dalmatian',
    prompt: 'Which visible feature is clearest on this animal?',
    answers: ['Dark transverse bands connecting across the back', 'A continuous cream pinstripe', 'Discrete dark spots on the body, head and limbs'], correct: 2,
    explanation: 'Several dark marks have separate outlines and irregular spacing. The red-orange body does not change what makes them spots. This photo does not clearly demonstrate transverse banding.',
  },
  {
    id: 'contrast', specimen: 'moonlight', region: 'lateral', lesson: 'harlequin',
    prompt: 'What can you conclude from this pale, low-contrast photograph?',
    answers: ['Flank pattern is visible; the pale color alone does not establish Axanthic', 'The pale body confirms visual Axanthic', 'Low contrast means there is no lateral pattern'], correct: 0,
    explanation: 'Cream patches remain visible on the flank. Appearance in one photograph, affected by the animal’s state and lighting, cannot establish that genetic diagnosis.',
  },
  {
    id: 'viewpoint', specimen: 'olivia', region: 'pinstripe', lesson: 'pinstripe',
    prompt: 'Can you reliably grade both pinstripe rows from this view?',
    answers: ['Yes: count only the pale scales that are visible', 'No: request clear views of both rows, from the neck through the tail base', 'Yes: assume the hidden row matches the visible row'], correct: 1,
    explanation: 'Parts of the animal are hidden by its pose and the leaves. Missing visual evidence is not evidence of missing pinning, and opposite sides need not match.',
  },
];

export function recognitionSummary(attempts) {
  const answered = REVIEW_QUESTIONS.filter(q => attempts[q.id]);
  return {
    answered: answered.length,
    independentCorrect: answered.filter(q => attempts[q.id].choice === q.correct && !attempts[q.id].assisted).length,
    assisted: answered.filter(q => attempts[q.id].assisted).length,
    revisit: [...new Set(answered.filter(q => attempts[q.id].choice !== q.correct || attempts[q.id].assisted).map(q => q.lesson))],
  };
}
