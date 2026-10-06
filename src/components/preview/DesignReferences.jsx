const REFERENCES = [
  ["Classic Charizard: English base hierarchy", "https://assets.pokemon.com/assets/cms2/img/cards/web/CEL25C/CEL25C_EN_4_A.png", "https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/series/cel25c/4_A"],
  [
    "Classic Pikachu",
    "https://www.pokemon-card.com/ex/classic/assets/images/deck-card-2-3.png",
    "https://www.pokemon-card.com/ex/classic/index.html"
  ],
  [
    "Classic Venusaur",
    "https://www.pokemon-card.com/ex/classic/assets/images/deck-card-1-1.png",
    "https://www.pokemon-card.com/ex/classic/index.html"
  ],
  [
    "Modern Charizard illustration",
    "https://assets.pokemon.com/assets/cms2/img/cards/web/SV3PT5/SV3PT5_EN_199.png",
    "https://www.pokemon.com/us/pokemon-tcg/scarlet-violet-151"
  ],
  [
    "Modern Blastoise illustration",
    "https://assets.pokemon.com/assets/cms2/img/cards/web/SV3PT5/SV3PT5_EN_200.png",
    "https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/sv-series/sv3pt5/200/"
  ],
  [
    "Team Up Charmander",
    "https://assets.pokemon.com/assets/cms2/img/cards/web/SM9/SM9_EN_11.png",
    "https://www.pokemon.com/us/pokemon-tcg/pokemon-cards/series/sm9/11/"
  ],
  [
    "Ferdinand Bauer: seadragon",
    "https://www.nhm.ac.uk/content/dam/nhm-www/our-science/dpts-facilities-staff/libraryandarchives/bauer-seahorses-full-width.jpg",
    "https://www.nhm.ac.uk/our-science/services/library/collections/bauer-brothers.html"
  ],
  [
    "Ferdinand Bauer: platypus",
    "https://www.nhm.ac.uk/content/dam/nhm-www/our-science/dpts-facilities-staff/libraryandarchives/bauer-platypus-two-column.jpg",
    "https://www.nhm.ac.uk/our-science/services/library/collections/bauer-brothers.html"
  ],
  [
    "Real specimen: anatomy and flank",
    "https://static.wixstatic.com/media/ccc2f5_62b516010dc143329f798bdf9bf93822~mv2.jpg/v1/fill/w_980%2Ch_654%2Cal_c%2Cq_85%2Cusm_0.66_1.00_0.01%2Cenc_auto/ccc2f5_62b516010dc143329f798bdf9bf93822~mv2.jpg",
    "https://www.evolverreptiles.com/crested-geckos-for-sale"
  ],
  [
    "Real specimen: red base and granular skin",
    "https://static.wixstatic.com/media/ccc2f5_3512c376d01b419ab0548a3d8d9029bf~mv2.jpg/v1/fill/w_980%2Ch_653%2Cal_c%2Cq_85%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/ccc2f5_3512c376d01b419ab0548a3d8d9029bf~mv2.jpg",
    "https://www.evolverreptiles.com/crested-geckos-for-sale"
  ],
  [
    "Real specimen: crest and white-wall markings",
    "https://static.wixstatic.com/media/32b1f1_99e84dfe5e614372923a5d1f627f78ea~mv2.jpg/v1/fill/w_980%2Ch_654%2Cal_c%2Cq_85%2Cusm_0.66_1.00_0.01%2Cenc_auto/32b1f1_99e84dfe5e614372923a5d1f627f78ea~mv2.jpg",
    "https://www.fringemorphs.com/product-page/white-wall-pinstripe-crested-gecko-1"
  ]
];
export default function DesignReferences() {
  return <section id="references"><h2 className="text-2xl font-semibold">The reference library.</h2><p className="mt-2 mb-6 text-sm text-stone-400">Real specimens for anatomy, historical watercolor plates for observation and touch, and published cards for format. Source images are research references, separate from our original product artwork.</p><div className="grid grid-cols-2 md:grid-cols-5 gap-4">{REFERENCES.map(([title, image, url]) => <a key={title} href={url} target="_blank" rel="noreferrer" className="rounded-xl bg-[#f4efdf] p-3 text-[#293c2f]"><img src={image} alt={title} loading="lazy" className="w-full h-52 object-contain" /><p className="mt-3 text-xs leading-relaxed">{title}</p></a>)}</div><div className="mt-6 grid sm:grid-cols-3 gap-6 text-sm text-stone-300"><p><strong className="text-stone-100">Classic frame.</strong> Compact identity, red HP, stamped energy marks, framed art, narrow specimen strip, moves with aligned damage, ruled matchups and a bordered description.</p><p><strong className="text-stone-100">Modern frame.</strong> Slim silver border, slanted stage/name rail, large HP, immersive artwork, outlined move lettering and a narrow silver information bar.</p><p><strong className="text-stone-100">Naturalist study.</strong> Observe the eye, ear opening, lip scales, crest rows, skin folds, varied digits and lamellae. Use quiet pigment and resolved linework rather than a thick silhouette.</p></div><p className="mt-6 text-sm text-stone-400">Additional morphology sources: <a className="underline" href="https://geckotime.com/wp-content/uploads/2012/09/Bauer-et-al-2012.pdf" target="_blank" rel="noreferrer">Bauer et al., 2012 specimen plates</a> · <a className="underline" href="https://sites.google.com/view/foxreptiles/morph-guide-for-crested-geckos" target="_blank" rel="noreferrer">Fox Reptiles visual trait guide</a>. These illustrations are simplified teaching examples; appearance labels do not establish a genotype.</p></section>;
}
