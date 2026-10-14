/**
 * Photo and phenotype are one reviewed unit. Demo records must use
 * demoPortrait() rather than attaching unrelated traits to a photo.
 * Source records and the visual audit are in public/demo-geckos/README.md.
 * Hidden genes, exact pin coverage, and base colors are not inferred from
 * a convenient-looking picture. The sample pedigrees remain fictional.
 */
export const DEMO_GECKO_PORTRAITS = {
  pepperjack: { traits: ['Lilly White'], sourceId: '689e5f9958e01a13bf6e1347' },
  mossball: { traits: ['Lilly White'], sourceId: '689e5fb680e49fa30ae433aa' },
  sparky: { traits: ['Lilly White'], sourceId: '689e6189d84da0315495be50' },
  hermes: { traits: ['Lilly White'], sourceId: '68df99109a3c803ac749843b' },
  moonlight: { traits: ['Harlequin'], sourceId: '689be89899d6c65e94f9240b' },
  odin: { traits: ['Harlequin'], sourceId: '68bf007355c654e56f90a51d' },
  selva: { traits: ['Harlequin'], sourceId: '6929c596ec727328a686894b' },
  'pony-boy': { traits: ['Harlequin'], sourceId: '689e5f78126e838dc0ea373f' },
  bliss: { traits: ['Harlequin', 'Tricolor'], sourceId: '68ede255f7417bdc260ca2fe' },
  raindrop: { traits: ['Pinstripe', 'Harlequin'], sourceId: '689e611c1b81f374051cd5b1' },
  blush: { traits: ['Phantom'], sourceId: '68fb4c34fa8878a0c40abb2d' },
  olivia: { traits: ['Olive'], sourceId: '689e6022e08e66432f57f0b1' },
  cheeto: { traits: ['Dalmatian', 'Red'], sourceId: '690a2ceabc862a7ccb5fb4fa' },
  frito: { traits: ['Dalmatian'], sourceId: '68ede1e3697bafe85281410d' },
};

export function demoPortrait(key) {
  const portrait = DEMO_GECKO_PORTRAITS[key];
  if (!portrait) throw new Error(`Unreviewed demo portrait: ${key}`);
  return {
    primary_morph: portrait.traits[0],
    morphs_traits: portrait.traits.join(', '),
    morph_tags: [...portrait.traits],
    image_urls: [`/demo-geckos/${key}.webp`],
  };
}
