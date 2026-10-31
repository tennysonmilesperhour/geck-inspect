/**
 * An OpenAPI 3.1 description of the open data files at /data (written to
 * public/data/openapi.json by scripts/build-agent-data.mjs).
 *
 * Why: the files are plain static JSON, CSV and markdown, so an agent or a
 * developer can already fetch them. A machine-readable description lets
 * API tools (and agents that read OpenAPI) find every file, its fields and
 * its license without reading the /data page first. It describes what is
 * already published; it adds no new endpoint. Every path is a GET on a
 * static file, with no key and no rate limit beyond the host's.
 *
 * The licenses are stated per file because they differ: the morph and
 * genetics data are CC BY 4.0, the Price Index is free to cite with a link,
 * the care guide text is free to quote with a link.
 */

const str = { type: 'string' };
const int = { type: 'integer' };
const strList = { type: 'array', items: str };
const nullableStr = { type: ['string', 'null'] };

function get(operationId, summary, description, contentType, schemaRef, extra = {}) {
  const content = contentType === 'application/json'
    ? { 'application/json': { schema: { $ref: `#/components/schemas/${schemaRef}` } } }
    : { [contentType]: { schema: str } };
  return {
    get: {
      operationId,
      summary,
      description,
      ...extra,
      responses: {
        200: { description: 'The file.', content },
        404: { description: 'No such file (for a path parameter, an unknown slug or topic).' },
      },
    },
  };
}

export function dataOpenApi({ siteUrl, updated, priceTerms, priceWhat, sampleRule, licenseData, morphSlugs = [], careIds = [] }) {
  const slugParam = {
    name: 'slug',
    in: 'path',
    required: true,
    description: 'A Morph Guide slug, as listed in /data/morphs.json.',
    schema: { type: 'string', ...(morphSlugs.length ? { enum: morphSlugs } : {}) },
  };
  const topicParam = {
    name: 'topic',
    in: 'path',
    required: true,
    description: 'A care guide section id, as listed in /data/care.json.',
    schema: { type: 'string', ...(careIds.length ? { enum: careIds } : {}) },
  };

  return {
    openapi: '3.1.0',
    info: {
      title: 'Geck Inspect open crested gecko data',
      version: updated,
      description:
        'Static files with Geck Inspect\'s open crested gecko data: the Price Index (' + priceWhat + '), the morph catalog, the genetics engine data and the care guide. '
        + 'Every path is a plain GET on a file; no key is needed. Each file states its own license. '
        + 'For live questions, the MCP server at ' + siteUrl + '/mcp answers the same data.',
      contact: { name: 'Geck Inspect', url: `${siteUrl}/Contact` },
      // Licenses differ per file (see the tags); /data states each one.
      license: { name: 'Per file: CC BY 4.0 for morphs and genetics, free to cite with a link for the Price Index', url: `${siteUrl}/data` },
    },
    // Public static files: no key or sign-in.
    security: [],
    servers: [{ url: siteUrl }],
    externalDocs: { description: 'The open data page', url: `${siteUrl}/data` },
    tags: [
      { name: 'catalog', description: 'What is published and where.' },
      { name: 'prices', description: `Geck Inspect Price Index. ${priceTerms}` },
      { name: 'morphs', description: `Morph catalog. License: CC BY 4.0 (${licenseData}).` },
      { name: 'genetics', description: `Genetics engine data. License: CC BY 4.0 (${licenseData}).` },
      { name: 'care', description: 'Care guide. Free to quote and cite with a link; not licensed for republishing in full.' },
    ],
    paths: {
      '/data/index.json': get(
        'getCatalog','Dataset catalog', 'Every dataset with its license, update date and download links.', 'application/json', 'Catalog', { tags: ['catalog'] }),
      '/data/price-index.json': get(
        'getPriceIndex',
        'Price Index (JSON)',
        `Latest asking prices by trait and market, and monthly medians. ${sampleRule} ${priceTerms}`,
        'application/json',
        'PriceIndex',
        { tags: ['prices'] },
      ),
      '/data/price-index.csv': get(
        'getPriceIndexCsv','Price Index (CSV)', `The same rows as price-index.json, flat. ${priceTerms}`, 'text/csv', null, { tags: ['prices'] }),
      '/llms/prices.md': get(
        'getPriceIndexMarkdown','Price Index (markdown)', 'The Price Index as markdown tables, for language models.', 'text/markdown', null, { tags: ['prices'] }),
      '/data/morphs.json': get(
        'getMorphs','Morph catalog (JSON)', 'Every crested gecko morph in the Morph Guide. Asking prices are not in this file; each morph\'s priceIndex field names its rows in the Price Index.', 'application/json', 'MorphCatalog', { tags: ['morphs'] }),
      '/morphs.csv': get(
        'getMorphsCsv','Morph catalog (CSV)', 'The morph catalog, flat.', 'text/csv', null, { tags: ['morphs'] }),
      '/llms/morphs.md': get(
        'getMorphsMarkdown','Morph catalog (markdown)', 'Every morph as markdown.', 'text/markdown', null, { tags: ['morphs'] }),
      '/MorphGuide/{slug}.md': {
        ...get('getMorphMarkdown', 'One morph (markdown)', 'The markdown twin of one Morph Guide page.', 'text/markdown', null, { tags: ['morphs'] }),
        parameters: [slugParam],
      },
      '/data/genetics.json': get(
        'getGenetics','Genetics data (JSON)', 'The traits the genetics calculator models, loci, named combinations and pairings to avoid.', 'application/json', 'Genetics', { tags: ['genetics'] }),
      '/llms/genetics.md': get(
        'getGeneticsMarkdown','Genetics data (markdown)', 'The genetics data as markdown.', 'text/markdown', null, { tags: ['genetics'] }),
      '/data/care.json': get(
        'getCare','Care guide (JSON)', 'The care guide as structured blocks.', 'application/json', 'CareGuide', { tags: ['care'] }),
      '/llms/care.md': get(
        'getCareMarkdown','Care guide (markdown)', 'The care guide as markdown.', 'text/markdown', null, { tags: ['care'] }),
      '/CareGuide/{topic}.md': {
        ...get('getCareTopicMarkdown', 'One care topic (markdown)', 'The markdown twin of one care guide page.', 'text/markdown', null, { tags: ['care'] }),
        parameters: [topicParam],
      },
    },
    components: {
      schemas: {
        Catalog: {
          type: 'object',
          required: ['publisher', 'datasets'],
          properties: {
            publisher: { type: 'object', properties: { name: str, url: str } },
            description: str,
            contact: str,
            updated: { type: 'string', format: 'date' },
            mcp: str,
            openapi: str,
            datasets: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'name', 'license', 'distribution'],
                properties: {
                  id: str,
                  name: str,
                  description: str,
                  license: str,
                  temporalCoverage: str,
                  updated: str,
                  distribution: { type: 'array', items: { type: 'object', properties: { format: str, url: str } } },
                },
              },
            },
          },
        },
        PriceRow: {
          type: 'object',
          description: 'The latest full catalog check for one trait in one market. Asking prices in USD.',
          required: ['market', 'trait', 'listings', 'p25', 'median', 'p75', 'checked_on'],
          properties: {
            market: { type: 'string', enum: ['US', 'KR', 'JP', 'EU'] },
            trait: { ...nullableStr, description: 'The marketplace trait label as sellers list it; null means all crested geckos in that market. A label does not prove genotype.' },
            listings: { ...int, description: 'Open listings counted in the check.' },
            p25: { type: 'number', description: '25th percentile asking price, USD.' },
            median: { type: 'number', description: 'Median asking price, USD.' },
            p75: { type: 'number', description: '75th percentile asking price, USD.' },
            checked_on: { type: 'string', format: 'date' },
            price_cuts: int,
            new_listings: int,
            thin: { type: 'boolean', description: 'True for a thin sample (fewer than 100 listings).' },
          },
        },
        PriceMonth: {
          type: 'object',
          required: ['month', 'market', 'trait', 'median'],
          properties: {
            month: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
            market: { type: 'string', enum: ['US', 'KR', 'JP', 'EU'] },
            trait: nullableStr,
            median: { type: 'number', description: 'Median of the month\'s daily medians, USD.' },
            full_checks: int,
            avg_listings: { type: 'number' },
          },
        },
        PriceIndex: {
          type: 'object',
          required: ['name', 'generated_at', 'latest', 'monthly', 'license'],
          properties: {
            name: str,
            description: str,
            url: str,
            license: str,
            licenseName: str,
            creator: str,
            attribution: str,
            methodology: strList,
            generated_at: { type: 'string', format: 'date-time' },
            latest: { type: 'array', items: { $ref: '#/components/schemas/PriceRow' } },
            monthly: { type: 'array', items: { $ref: '#/components/schemas/PriceMonth' } },
          },
        },
        Morph: {
          type: 'object',
          required: ['slug', 'name', 'url'],
          additionalProperties: true,
          properties: {
            slug: str,
            name: str,
            aliases: strList,
            definition: str,
            summary: str,
            description: str,
            history: str,
            foundationGenetics: str,
            inheritance: str,
            inheritanceLabel: str,
            rarity: str,
            rarityLabel: str,
            category: str,
            categoryLabel: str,
            priceRange: { ...str, description: 'The guide\'s hand-written typical adult price, where one is known.' },
            keyFeatures: strList,
            visualIdentifiers: strList,
            lookalikes: { type: 'array', items: { type: 'object', properties: { slug: str, difference: str } } },
            combinesWith: strList,
            sources: strList,
            url: str,
            markdown: str,
            priceIndex: {
              type: ['object', 'null'],
              description: 'Where this morph\'s asking prices are in the Price Index, or null when it has no rows.',
              properties: { name: str, traits: strList, json: str, csv: str, terms: str },
            },
          },
        },
        MorphCatalog: {
          type: 'object',
          required: ['license', 'morphs'],
          properties: {
            name: str,
            url: str,
            license: str,
            attribution: str,
            priceIndexNote: str,
            updated: str,
            count: int,
            morphs: { type: 'array', items: { $ref: '#/components/schemas/Morph' } },
          },
        },
        Genetics: {
          type: 'object',
          additionalProperties: true,
          properties: {
            name: str,
            url: str,
            license: str,
            attribution: str,
            updated: str,
            traits: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  id: str,
                  name: str,
                  category: str,
                  dominance: str,
                  locus: str,
                  has_super_form: { type: 'boolean' },
                  super_health_risk: str,
                  description: str,
                  identification_markers: strList,
                  primary_sources: strList,
                  confirmed: { type: 'boolean' },
                  last_reviewed: str,
                },
              },
            },
            combos: { type: 'array', items: { type: 'object' } },
            riskPairings: { type: 'array', items: { type: 'object' } },
            loci: { type: 'object' },
            glossary: { type: 'array', items: { type: 'object' } },
          },
        },
        CareGuide: {
          type: 'object',
          properties: {
            name: str,
            url: str,
            license: str,
            updated: str,
            sections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: str,
                  title: str,
                  category: str,
                  url: str,
                  markdown: str,
                  blocks: { type: 'array', items: { type: 'object', properties: { type: str }, additionalProperties: true } },
                },
              },
            },
          },
        },
      },
    },
  };
}
