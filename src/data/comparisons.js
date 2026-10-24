// The /compare pages: Geck Inspect next to the tools crested gecko keepers
// and breeders actually weigh it against. Each page is one entry here;
// src/pages/Compare.jsx renders them and scripts/seo-routes.mjs lists them
// for the sitemap and the prerender.
//
// Why several pages: we do not know yet which comparison people search
// for and act on. Every page records compare_viewed and
// compare_cta_clicked with its slug, so after a few weeks the numbers say
// which comparisons earn traffic and sign-ups
// (docs/planning/launch-offer-tests-2026-10.md).
//
// Rules for the copy:
//   - Competitor facts come from docs/planning/competitive-landscape-2026-10.md
//     with a source link for each, and carry the month they were checked.
//     Prices change; recheck the live page before changing a number here.
//   - Every page says where the other tool is the better pick. A
//     comparison that never concedes anything reads as an ad.
//   - Geck Inspect prices are not typed here. The page fills {keeper},
//     {breeder}, {keeperAnnual}, {breederAnnual} and {freeGeckos} from
//     src/lib/stripe-config.js and src/lib/tierLimits.js.
//   - No em dashes or en dashes (CLAUDE.md); a test checks.

export const COMPARISONS_CHECKED = 'October 2026';

// The Morph Guide's entry count, shown as proof on the hub. A test keeps it
// equal to MORPHS.length so the number is always true without loading the
// whole guide into these pages.
export const MORPH_GUIDE_COUNT = 47;

export const COMPARISONS = [
  {
    slug: 'spreadsheet',
    name: 'a spreadsheet',
    short: 'Spreadsheet',
    metaTitle: 'Geck Inspect vs a Spreadsheet for Crested Gecko Records',
    metaDescription:
      'Should you keep crested gecko records in Google Sheets or Excel, or in Geck Inspect? What a spreadsheet does well, what it cannot do (clutch odds, growth checks, lineage, buyer papers) and when to switch.',
    heading: 'Geck Inspect vs a spreadsheet',
    lead:
      'Most breeders start in Google Sheets or Excel, and a spreadsheet is a fine place to start. It stops working when you want it to answer questions: is this hatchling growing on track, what will this pairing produce, who are this gecko’s grandparents.',
    rows: [
      ['Price', 'Free for up to {freeGeckos} geckos; Keeper {keeper} a month; Breeder {breeder} a month', 'Free'],
      ['Weights', 'Logged in a tap and charted against a healthy growth band', 'A column you chart yourself'],
      ['Clutch odds', 'Crested gecko genetics calculator, with a warning on Lilly White x Lilly White', 'Worked out by hand'],
      ['Lineage', 'Multi-generation family tree linked from each gecko', 'Parent names typed into cells'],
      ['Reminders', 'Feeding and weigh-in reminders', 'None'],
      ['Paperwork for buyers', 'A passport page and QR card for each gecko', 'A copy of the row'],
      ['Leaving', 'Export everything to CSV or PDF on every plan', 'It is already a file'],
    ],
    theyWin: [
      'Free, with no account and no limit on rows.',
      'Any column you want, laid out any way you like.',
      'Works offline on any computer.',
    ],
    weWin: [
      'Answers questions a sheet cannot: growth against the healthy band, breeding readiness, clutch odds.',
      'Lineage that links, so a grandparent is one tap away.',
      'A passport a buyer can scan, built from the records you already keep.',
    ],
    pickThem: 'You keep a handful of geckos, do not breed, and like building your own sheet.',
    pickUs: 'You pair every season, sell hatchlings, or want the records to warn you when something is off.',
    sources: [],
  },
  {
    slug: 'morphmarket-animal-manager',
    name: 'MorphMarket Animal Manager',
    short: 'MorphMarket',
    metaTitle: 'Geck Inspect vs MorphMarket Animal Manager for Crested Geckos',
    metaDescription:
      'MorphMarket’s free Animal Manager and Geck Inspect compared for crested gecko keepers and breeders: records, genetics, morph ID, growth checks, price data, and how to use both together.',
    heading: 'Geck Inspect vs MorphMarket Animal Manager',
    lead:
      'MorphMarket is where most buyers are, and its free Animal Manager keeps records next to your listings. Geck Inspect is built for crested geckos only. Many breeders will want both: sell on MorphMarket, keep crested records here.',
    rows: [
      ['Price', 'Free for up to {freeGeckos} geckos; Keeper {keeper} a month; Breeder {breeder} a month', 'Animal Manager is free; seller plans run from about $3 to $125 a month'],
      ['Species', 'Crested geckos only', 'Every species on the marketplace'],
      ['Buyers', 'A small marketplace and breeder pages', 'The largest reptile marketplace in the US and Canada'],
      ['Crested genetics', 'Calculator built on crested traits, with reverse calculation and clutch odds', 'General calculators for many species'],
      ['AI Morph ID', 'Two-photo identification that explains its evidence', 'None'],
      ['Growth check', 'Weights against a healthy crested growth band', 'Weight log'],
      ['Moving records', 'Breeder exports a MorphMarket-ready CSV', 'Transfers husbandry history with a sold animal'],
    ],
    theyWin: [
      'The buyers are there.',
      'Records come free with your listings.',
      'Husbandry history moves to the buyer when an animal sells.',
    ],
    weWin: [
      'Crested gecko depth: genetics, Morph Guide, care guide and growth band in one place.',
      'AI Morph ID that asks for two photos and says how sure it is.',
      'Price data for crested traits from the Geck Inspect Price Index.',
    ],
    pickThem: 'You keep many species, or you only need records next to your listings.',
    pickUs: 'Crested geckos are your focus and you want records that know crested genetics. Keep listing on MorphMarket; Breeder exports your listings for it.',
    sources: [
      { label: 'MorphMarket pricing', url: 'https://www.morphmarket.com/us/pricing/' },
      { label: 'MorphMarket Spring/Summer 2026 updates', url: 'https://community.morphmarket.com/t/spring-summer-2026-site-updates-features/62976' },
    ],
  },
  {
    slug: 'breed-ledger',
    name: 'Breed Ledger',
    short: 'Breed Ledger',
    metaTitle: 'Geck Inspect vs Breed Ledger for Crested Gecko Breeders',
    metaDescription:
      'Breed Ledger and Geck Inspect compared for crested gecko breeders: price, genetics, morph ID, websites, deposits and contracts. Where each one is the better pick.',
    heading: 'Geck Inspect vs Breed Ledger',
    lead:
      'Breed Ledger is breeder software for dogs, reptiles, cats and livestock, with websites, deposits and contracts. Geck Inspect is built for crested geckos only, for keepers and breeders, at a fraction of the price.',
    rows: [
      ['Price', 'Free for up to {freeGeckos} geckos; Breeder {breeder} a month', 'Free plan; Starter $29 a month; Professional $49 a month'],
      ['Species', 'Crested geckos only', 'Dogs, reptiles, cats, livestock and more'],
      ['Crested genetics', 'Calculator with reverse calculation and clutch odds', 'Genetics engine with lethal pairing warnings'],
      ['AI Morph ID', 'Two-photo identification on every plan', 'Through Geckistry’s free beta identifier'],
      ['Keeper tools', 'Growth band, feeding reminders, care guide', 'Built for breeders'],
      ['Waitlists', 'With written deposit terms, on Breeder', 'Yes, on Starter'],
      ['Deposits and contracts', 'Not offered', 'Deposits through Stripe and e-signed contracts'],
      ['Your own website', 'A breeder page on geckinspect.com', 'Website with templates and a custom domain'],
    ],
    theyWin: [
      'Takes deposits online and e-signs contracts.',
      'A full breeder website on your own domain.',
      'Club and registry tools; a gecko club runs its registry on it.',
    ],
    weWin: [
      'Built for crested geckos only, so the genetics, guides and Morph ID go deeper.',
      'Waitlists with deposit terms for {breeder} a month instead of $29.',
      'Keeper tools for the people who buy your geckos.',
    ],
    pickThem: 'You breed several species, or you need online deposits, contracts and a custom-domain website now.',
    pickUs: 'Crested geckos are your program and you want the deepest crested tools for under $6 a month.',
    sources: [
      { label: 'Breed Ledger pricing', url: 'https://breedledger.co/pricing' },
      { label: 'Breed Ledger features', url: 'https://breedledger.co/features' },
      { label: 'Breed Ledger for reptile breeders', url: 'https://breedledger.co/for/reptile-breeders' },
    ],
  },
  {
    slug: 'reptidex',
    name: 'ReptiDex',
    short: 'ReptiDex',
    metaTitle: 'Geck Inspect vs ReptiDex for Crested Gecko Records',
    metaDescription:
      'ReptiDex and Geck Inspect compared for crested gecko keepers and breeders: price, AI morph ID, genetics, lineage, QR codes and record transfer.',
    heading: 'Geck Inspect vs ReptiDex',
    lead:
      'ReptiDex is a reptile records app for iPhone and the web. Its maker says active development has moved to Breed Ledger. Geck Inspect is built for crested geckos only and is actively developed.',
    rows: [
      ['Price', 'Free for up to {freeGeckos} geckos; Keeper {keeper} a month; Breeder {breeder} a month', 'Free for 10 animals; Pro $4.99 a month; Premium $9.99 a month'],
      ['Annual price', 'Keeper {keeperAnnual}; Breeder {breederAnnual} a year', 'Pro $49.99; Premium $99.99 a year'],
      ['AI Morph ID', 'One free every month, more on paid plans', 'Multi-photo identifier on paid plans'],
      ['Crested genetics', 'Calculator with reverse calculation and clutch odds', 'Free web calculator'],
      ['Lineage', 'Multi-generation family tree', 'Five-generation pedigrees'],
      ['QR and buyer records', 'Passport page and QR card; claim link for the buyer', 'QR code per animal; record transfer'],
      ['Development', 'Active', 'Moved to Breed Ledger, per its maker'],
    ],
    theyWin: [
      'Record transfer to a buyer’s account has been out longer.',
      'Its iPhone app has been on the App Store longer.',
    ],
    weWin: [
      'Lower price on both paid plans.',
      'A Morph ID try every month on the free plan.',
      'Crested growth band, breeding readiness and care guide built in.',
    ],
    pickThem: 'You already keep your records there and they still do what you need.',
    pickUs: 'You want a crested gecko app that is still adding features, for less.',
    sources: [
      { label: 'ReptiDex on the App Store', url: 'https://apps.apple.com/us/app/reptidex/id6758026225' },
      { label: 'Breed Ledger for reptile breeders', url: 'https://breedledger.co/for/reptile-breeders' },
    ],
  },
  {
    slug: 'husbandry-pro',
    name: 'Husbandry.Pro',
    short: 'Husbandry.Pro',
    metaTitle: 'Geck Inspect vs Husbandry.Pro for Crested Geckos',
    metaDescription:
      'Husbandry.Pro and Geck Inspect compared for crested gecko keepers: price per animal count, genetics, morph ID, growth checks, NFC and platforms.',
    heading: 'Geck Inspect vs Husbandry.Pro',
    lead:
      'Husbandry.Pro is a deep, mature husbandry app for any species, from pet keepers to zoos. Geck Inspect does one species and goes further on it.',
    rows: [
      ['Price', 'Free for {freeGeckos}; Keeper {keeper} a month for 50; Breeder {breeder} a month, unlimited', 'Free for 5; $4 a month for 50; $9 for 200; Breeder $18'],
      ['Species', 'Crested geckos only', 'Any species'],
      ['Crested genetics', 'Calculator with clutch odds and reverse calculation', 'Custom genetics tables you set up'],
      ['AI Morph ID', 'Two-photo identification', 'None'],
      ['Growth check', 'Weights against a healthy crested growth band', 'Weight charts tied to feedings'],
      ['Tags', 'QR passport cards', 'QR codes and NFC tags'],
      ['Platforms', 'Web and iPhone', 'iPhone, Android and desktop'],
    ],
    theyWin: [
      'Android and desktop apps.',
      'NFC tags and thermostat integration.',
      'Works for every species in your room.',
    ],
    weWin: [
      'Crested genetics, Morph Guide and Morph ID ready to use, with nothing to set up.',
      'A growth band that answers "is this weight normal?" for a crested gecko.',
      'Unlimited geckos for {breeder} a month.',
    ],
    pickThem: 'You keep many species, need Android, or run tags and sensors across a facility.',
    pickUs: 'Your collection is crested geckos and you want tools that already know the species.',
    sources: [
      { label: 'Husbandry.Pro', url: 'https://husbandry.pro/' },
    ],
  },
  {
    slug: 'chatgpt-morph-id',
    name: 'asking ChatGPT',
    short: 'ChatGPT',
    metaTitle: 'Crested Gecko Morph ID: Geck Inspect vs Asking ChatGPT',
    metaDescription:
      'Can ChatGPT identify a crested gecko morph? How a general chatbot compares with Geck Inspect’s crested gecko Morph ID: photos, fire state, honest confidence, and keeping the result.',
    heading: 'Crested gecko Morph ID: Geck Inspect vs asking ChatGPT',
    lead:
      'You can upload a gecko photo to a general chatbot and get an answer. Crested morphs are hard: most are visual traits, not proven genes, and the same gecko looks different fired up and fired down. Geck Inspect’s Morph ID is built around that.',
    rows: [
      ['Price', 'One free Morph ID every month; more on Keeper and Breeder', 'Depends on your chatbot plan'],
      ['Photos', 'Asks for two photos and the fire state', 'Whatever you upload'],
      ['Crested knowledge', 'Linked to the Morph Guide’s {morphCount} crested morph pages', 'General knowledge'],
      ['Confidence', 'Says how sure it is and what it saw', 'Varies by answer'],
      ['Afterwards', 'Save the result to the gecko’s record and share a result card', 'Stays in the chat'],
    ],
    theyWin: [
      'You may already pay for it.',
      'It will answer follow-up questions about anything.',
    ],
    weWin: [
      'Built only for crested geckos, with the evidence for each trait shown.',
      'The result lands on the gecko’s record, next to its weights and lineage.',
      'A shareable result card for "what morph is this?" threads.',
    ],
    pickThem: 'You want a quick general opinion and do not need to keep it.',
    pickUs: 'You want a crested-specific read you can save, share and check against the Morph Guide.',
    sources: [],
  },
];

export const comparisonBySlug = (slug) => COMPARISONS.find((c) => c.slug === slug) || null;
