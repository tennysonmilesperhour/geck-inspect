/**
 * The open datasets Geck Inspect publishes, shared by the /data page
 * (src/pages/OpenData.jsx) and its prerendered HTML (scripts/prerender.mjs)
 * so the Dataset markup Google Dataset Search reads is the same in both.
 *
 * The files themselves are written by scripts/build-agent-data.mjs.
 * Keep this module dependency-free: prerender.mjs imports it in Node.
 */

const SITE_URL = 'https://geckinspect.com';
export const DATA_LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
export const MCP_URL = `${SITE_URL}/mcp`;

export const OPEN_DATASETS = [
  {
    id: 'price-index',
    name: 'Geck Inspect Price Index: crested gecko asking prices',
    description:
      'Asking prices for crested geckos (Correlophus ciliatus) by trait and market, compiled by Geck Inspect from public listings on the largest online reptile marketplaces in the United States, South Korea, Japan and Europe. Each row gives the number of listings and the 25th percentile, median and 75th percentile asking price in USD from the latest full check, plus monthly medians since May 2026. Asking prices, not sale prices.',
    keywords: ['crested gecko price', 'crested gecko value', 'reptile market', 'Lilly White price', 'Axanthic price'],
    license: DATA_LICENSE,
    temporalStart: '2026-05',
    spatialCoverage: ['United States', 'South Korea', 'Japan', 'Europe'],
    files: [
      { label: 'JSON', format: 'application/json', url: `${SITE_URL}/data/price-index.json` },
      { label: 'CSV', format: 'text/csv', url: `${SITE_URL}/data/price-index.csv` },
      { label: 'Markdown', format: 'text/markdown', url: `${SITE_URL}/llms/prices.md` },
    ],
  },
  {
    id: 'morphs',
    name: 'Crested gecko morph catalog',
    description:
      'Every documented crested gecko morph in the Geck Inspect Morph Guide with its definition, category, inheritance (polygenic, incomplete dominant, recessive), rarity, identification markers, lookalikes and how to tell them apart, competing genetics models, history, typical adult price range and sources.',
    keywords: ['crested gecko morphs', 'Harlequin', 'Lilly White', 'Phantom', 'Cappuccino', 'Axanthic'],
    license: DATA_LICENSE,
    files: [
      { label: 'JSON', format: 'application/json', url: `${SITE_URL}/data/morphs.json` },
      { label: 'CSV', format: 'text/csv', url: `${SITE_URL}/morphs.csv` },
      { label: 'Markdown', format: 'text/markdown', url: `${SITE_URL}/llms/morphs.md` },
    ],
  },
  {
    id: 'genetics',
    name: 'Crested gecko genetics: traits, loci, combinations and risky pairings',
    description:
      'The crested gecko traits the Geck Inspect genetics engine models, with inheritance mode, locus, super form and its health risk, identification markers, primary sources and review date, plus named trait combinations, pairings to avoid (such as Lilly White to Lilly White) and a genetics glossary. The same data the Geck Inspect genetics calculator uses.',
    keywords: ['crested gecko genetics', 'Punnett square', 'Super Lilly White', 'incomplete dominant', 'recessive'],
    license: DATA_LICENSE,
    files: [
      { label: 'JSON', format: 'application/json', url: `${SITE_URL}/data/genetics.json` },
      { label: 'Markdown', format: 'text/markdown', url: `${SITE_URL}/llms/genetics.md` },
    ],
  },
  {
    id: 'care',
    name: 'Crested gecko care guide',
    description:
      'The Geck Inspect crested gecko care guide as structured content: enclosure size by life stage, temperature, humidity and misting, diet and feeding schedule, handling, health problems such as metabolic bone disease, and breeding and incubation.',
    keywords: ['crested gecko care', 'crested gecko humidity', 'crested gecko enclosure', 'crested gecko diet'],
    license: null,
    licenseNote: 'Free to quote and cite with a link to the page; not licensed for republishing in full.',
    files: [
      { label: 'JSON', format: 'application/json', url: `${SITE_URL}/data/care.json` },
      { label: 'Markdown', format: 'text/markdown', url: `${SITE_URL}/llms/care.md` },
    ],
  },
];

/** schema.org DataCatalog + Dataset nodes for the /data page. */
export function openDataJsonLd(dateModified) {
  const org = { '@id': `${SITE_URL}/#organization` };
  return [
    {
      '@type': 'DataCatalog',
      '@id': `${SITE_URL}/data#catalog`,
      name: 'Geck Inspect open crested gecko data',
      url: `${SITE_URL}/data`,
      publisher: org,
      dataset: OPEN_DATASETS.map((d) => ({ '@id': `${SITE_URL}/data#${d.id}` })),
    },
    ...OPEN_DATASETS.map((d) => ({
      '@type': 'Dataset',
      '@id': `${SITE_URL}/data#${d.id}`,
      name: d.name,
      description: d.description,
      url: `${SITE_URL}/data#${d.id}`,
      keywords: d.keywords,
      creator: org,
      publisher: org,
      isAccessibleForFree: true,
      ...(d.license ? { license: d.license } : { usageInfo: d.licenseNote }),
      ...(dateModified ? { dateModified } : {}),
      ...(d.temporalStart && dateModified ? { temporalCoverage: `${d.temporalStart}/${dateModified.slice(0, 7)}` } : {}),
      ...(d.spatialCoverage ? { spatialCoverage: d.spatialCoverage } : {}),
      about: { '@type': 'Taxon', name: 'Correlophus ciliatus', alternateName: 'crested gecko' },
      includedInDataCatalog: { '@id': `${SITE_URL}/data#catalog` },
      distribution: d.files.map((f) => ({ '@type': 'DataDownload', encodingFormat: f.format, contentUrl: f.url })),
    })),
  ];
}
