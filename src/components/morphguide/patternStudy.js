/** Curated reference records support visible-feature comparison, never genotype confirmation.
 * Production links to the source unless a record has documented reuse permission.
 * After recording permission from every relevant rights holder, set reuseApproved: true.
 * Local development may embed the source-hosted images for design review.
 */
export const SPECIMEN_SOURCE = 'https://lmreptiles.com/fg-pt2-1/';
const PHOTO_SIZE = { brindle: [1024,780], pin: [1024,1019], flank: [1024,576], harlequin: [1024,683], extreme: [672,770], bicolor: [678,810], dalmatian: [1024,685], dense: [1024,683] };
const photo = (id, title, filename, credit, points) => ({ id, title, src: `https://lmreptiles.com/wp-content/uploads/${filename}`, source: SPECIMEN_SOURCE, credit, points, width: PHOTO_SIZE[id][0], height: PHOTO_SIZE[id][1] });
export const SPECIMENS = {
  brindle: photo('brindle', 'Broken transverse banding', '2022/09/AR_Tiger-01-1024x780.jpg', 'Repashy · reproduced in LIL MONSTERS research', [{ x: 57, y: 39, label: 'Jagged bands cross the back and continue onto the sides.' }]),
  pin: photo('pin', 'Crest rows in an oblique view', '2022/05/EA20_0911_MB-16G-5-1024x1019.jpg', 'LIL MONSTERS Reptiles · EA20 0911', [{ x: 34, y: 43, label: 'Follow the raised edge of the back, separate from the wide dorsal field.' }, { x: 60, y: 71, label: 'Flank markings can coexist with pinstripe.' }]),
  flank: photo('flank', 'Lateral cream with dark interruptions', '2022/09/Red-3-1024x576.jpg', 'LIL MONSTERS Reptiles', [{ x: 42, y: 68, label: 'Irregular pale patches occupy the lower flank.' }, { x: 50, y: 37, label: 'A dark separation lies below the pale dorsal edge.' }]),
  flame: {
    id: 'flame', title: 'One flame specimen, three views', width: 2000, height: 2000,
    source: 'https://www.pangeareptile.com/products/male-flame-crested-gecko-cr-2323', credit: 'Pangea Reptile · Cr-2323',
    src: 'https://www.pangeareptile.com/cdn/shop/files/Cr-2323Left2_2000x.jpg?v=1775493894',
    points: [{ x: 53, y: 45, label: 'Compare the narrow visible dorsal field with the mostly dark flank. Small pale flank markings also occur.' }],
    views: [
      { label: 'Left side', src: 'https://www.pangeareptile.com/cdn/shop/files/Cr-2323Left2_2000x.jpg?v=1775493894', points: [{ x: 53, y: 45, label: 'Compare the dorsal field with the mostly dark flank. Flame does not require completely blank sides.' }] },
      { label: 'Right side', src: 'https://www.pangeareptile.com/cdn/shop/files/Cr-2323Right2_2000x.jpg?v=1775493895', points: [{ x: 46, y: 52, label: 'The opposite flank has its own distribution of small pale markings. The two sides are not mirror images.' }] },
      { label: 'Above', width: 1200, height: 1200, src: 'https://www.pangeareptile.com/cdn/shop/files/Cr-2323Top2_1200x.jpg?v=1775493894', points: [{ x: 57, y: 46, label: 'From above, the broad dorsal pattern and its dark interruptions are much easier to see.' }] },
    ],
  },
  harlequin: photo('harlequin', 'Harlequin with pinstripe', '2022/07/EA20_1106_FA-3-1024x683.jpg', 'LIL MONSTERS Reptiles · EA20 1106', [{ x: 56, y: 58, label: 'Separate flank patches and patterned legs.' }, { x: 59, y: 49, label: 'The narrow pin row follows the edge of the broader dorsal field.' }]),
  extreme: photo('extreme', 'High lateral coverage', '2022/09/GL_Extreme-05.jpg', 'Geckological · LIL MONSTERS research library', [{ x: 29, y: 47, label: 'Extensive irregular lateral pattern; look at coverage across the whole flank.' }]),
  bicolor: photo('bicolor', 'Contrasting dorsal and lateral color', '2022/09/GL_Neon.bicolor-02.jpg', 'Geckological · LIL MONSTERS research library', [{ x: 48, y: 32, label: 'Two broad color regions are different from scattered cream patches.' }]),
  dalmatian: photo('dalmatian', 'Spots on a lightly patterned animal', '2022/08/F1-Dalmatian-1024x685.jpeg', 'Repashy · LIL MONSTERS research library', [{ x: 53, y: 48, label: 'Discrete dark spots vary in size and spacing.' }]),
  dense: photo('dense', 'Dense spotting over dorsal pattern', '2022/05/PGA18_0506_MX-33G-1-1024x683.jpg', 'LIL MONSTERS Reptiles · PGA18 0506', [{ x: 76, y: 24, label: 'Dark spots occur on pale pattern as well as the base color.' }]),
};

export const STUDY_LESSONS = [
  { id: 'flame', title: 'Dorsal pattern', subtitle: 'Flame & bicolor', region: 'dorsal', view: 'side', examples: ['flame', 'bicolor'], traits: { dorsal: 1 },
    look: 'Compare the back with the flanks and legs. Flame describes prominent dorsal pattern with little lateral or limb pattern.',
    distinction: 'Bicolor describes contrasting broad color regions. A few small side markings do not create a universal boundary between flame and harlequin.', guide: 'flame' },
  { id: 'harlequin', title: 'Lateral pattern', subtitle: 'Harlequin & extreme', region: 'lateral', view: 'side', examples: ['harlequin', 'flank', 'extreme'], traits: { dorsal: 1, lateral: .62 },
    look: 'Look for irregular markings on the lower flanks and limbs. Compare light and heavy coverage across several animals.',
    distinction: '“Extreme” is a breeder descriptor, with no universal percentage cutoff. Pattern color can be cream, yellow or orange.', guide: 'harlequin' },
  { id: 'pinstripe', title: 'Raised crest rows', subtitle: 'Partial & full pinstripe', region: 'pinstripe', view: 'top', examples: ['pin', 'harlequin'], traits: { pinstripe: 1 },
    look: 'Follow each raised dorsal edge from the neck toward the tail base. Check both rows for interruptions.',
    distinction: 'Pinstripe is separate from the wide dorsal field. A dark line beside a pale pin is called reverse pinning; it does not establish Phantom.', guide: 'pinstripe' },
  { id: 'tiger', title: 'Transverse markings', subtitle: 'Tiger & brindle', region: 'tiger', view: 'top', examples: ['brindle', 'flank'], traits: { tiger: 1 },
    look: 'Follow dark markings across the back and down the sides. Their edges and spacing can be irregular.',
    distinction: 'Brindle usually describes more broken or disorganized banding. It is not simply a darker setting on a tiger.', guide: 'tiger' },
  { id: 'dalmatian', title: 'Discrete spots', subtitle: 'Dalmatian variation', region: 'spots', view: 'side', examples: ['dalmatian', 'dense'], traits: { spots: .65 },
    look: 'Separate individual spots from the surrounding pattern. Inspect their size, shape and distribution.',
    distinction: '“Super Dalmatian” may describe heavy spotting or a breeder’s homozygous claim. A spot count alone does not establish a genotype.', guide: 'dalmatian' },
];

export const STUDY_QUESTIONS = [
  { id: 'pin', specimen: 'pin', question: 'Which feature identifies the pinstripe here?', answers: ['The wide pale field on the back', 'Pale scales along the raised dorsal edges', 'The light patches on the legs'], correct: 1, explanation: 'Trace the narrow raised rows. The broad field between them is dorsal pattern, and the legs show a separate feature.' },
  { id: 'flank', specimen: 'harlequin', question: 'Which observation supports a harlequin description?', answers: ['The eye color', 'A continuous pinstripe alone', 'Pattern on the flanks and legs'], correct: 2, explanation: 'Lateral and limb pattern is the useful clue. Harlequin and pinstripe can describe the same animal.' },
  { id: 'spots', specimen: 'dense', question: 'Where can you see dark spots in this specimen?', answers: ['On pale pattern as well as base color', 'Only on the darker base', 'Only on the head'], correct: 0, explanation: 'The photograph shows spots over pale dorsal pattern. Base-only spotting would be an incorrect rule.' },
  { id: 'bands', specimen: 'brindle', question: 'What is the useful observation here?', answers: ['Perfectly evenly spaced lines', 'Broken markings crossing the body', 'A precisely measurable brindle percentage'], correct: 1, explanation: 'Describe direction and broken edges. The appearance is irregular; the label is not a numerical scale.' },
  { id: 'limits', specimen: 'extreme', question: 'What can this photograph establish by itself?', answers: ['Extensive visible flank pattern', 'A guaranteed inheritance ratio', 'The animal’s hidden genes'], correct: 0, explanation: 'Photographs support observations of appearance. Lineage and breeding evidence are separate questions.' },
];

export const EMPTY_TRAITS = Object.freeze({ dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0 });
export const normalizedStudy = input => Object.fromEntries(Object.keys(EMPTY_TRAITS).map(k => [k, Math.max(0, Math.min(1, Number(input?.[k]) || 0))]));
export function traitDescription(key, value) {
  if (value <= 0) return 'Absent';
  if (key === 'pinstripe') return value >= .999 ? 'Continuous' : value > .8 ? 'Nearly continuous' : value > .35 ? 'Interrupted' : 'A few pin scales';
  if (key === 'spots') return value > .8 ? 'Dense' : value > .35 ? 'Scattered' : 'Sparse';
  if (key === 'tiger') return value > .7 ? 'Pronounced' : value > .3 ? 'Moderate' : 'Faint';
  return value > .8 ? 'Extensive' : value > .35 ? 'Moderate' : 'Limited';
}
