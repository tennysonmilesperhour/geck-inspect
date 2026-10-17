import { safeExternalUrl } from '../safeExternalUrl';

// Exact models checked on their Amazon.com detail pages on 2026-10-17.
// Keep this list narrow: a category, unspecified size, or similar model is
// not sufficient evidence for replacing a search destination.
const VERIFIED_PRODUCTS = {
  'aff-dymo-labelwriter-450': {
    name: 'Dymo LabelWriter 450', query: 'Dymo LabelWriter 450', asin: 'B0027JBLV4',
  },
  'aff-hova-bator-1602n': {
    name: 'Hova-Bator 1602N', query: 'Hova-Bator 1602N', asin: 'B0145O6C0S',
  },
  'aff-rhacodactylus-book': {
    name: 'Rhacodactylus: The Complete Guide', query: 'Rhacodactylus The Complete Guide', asin: '0974297100',
  },
  'aff-uniheat-40hr-heat-pack': {
    name: 'Uniheat 40-hour heat pack (10 pack)', query: 'Uniheat 40 hour heat pack', asin: 'B00I3R1RMC',
  },
};

// Owner-designated tag (2026-10-17). The database still contains the older tag;
// normalize outbound links here until that separate data correction is applied.
export const AMAZON_ASSOCIATE_TAG = 'geckinspect-20';
const LEGACY_ASSOCIATE_TAG = 'geckinspect09-20';

function applyAmazonTag(url) {
  let hasTag = false;
  const params = url.search ? url.search.slice(1).split('&') : [];
  const corrected = params.map((param) => {
    const key = param.split('=', 1)[0];
    try {
      if (decodeURIComponent(key) === 'tag') {
        hasTag = true;
        return `${key}=${AMAZON_ASSOCIATE_TAG}`;
      }
    } catch { /* Leave malformed, unrelated parameter names unchanged. */ }
    return param;
  });
  if (!hasTag) corrected.push(`tag=${AMAZON_ASSOCIATE_TAG}`);
  // Keep other parameters' order, duplicates and encoding, plus the fragment.
  url.search = corrected.join('&');
}

export function productVendorLink(product) {
  const safeUrl = safeExternalUrl(product?.vendor_product_url);
  if (!safeUrl) return { url: null, isAmazonSearch: false };
  const url = new URL(safeUrl);
  const isAmazon = url.hostname === 'amazon.com' || url.hostname === 'www.amazon.com';
  const isAmazonSearch = isAmazon && url.pathname === '/s';
  const match = VERIFIED_PRODUCTS[product?.slug];

  // A later destination edit takes precedence. Only resolve the specific legacy
  // search and product identity we verified. Attribution is corrected separately.
  const resolveVerifiedProduct = product?.fulfillment_mode === 'affiliate_redirect' && match
    && product.name === match.name && isAmazonSearch
    && url.searchParams.get('k') === match.query
    && [LEGACY_ASSOCIATE_TAG, AMAZON_ASSOCIATE_TAG].includes(url.searchParams.get('tag'))
    && [...url.searchParams.keys()].length === 2 && !url.hash;

  if (product?.fulfillment_mode === 'affiliate_redirect' && isAmazon) applyAmazonTag(url);
  if (resolveVerifiedProduct) {
    url.pathname = `/dp/${match.asin}`;
    url.searchParams.delete('k');
    return { url: url.href, isAmazonSearch: false };
  }
  return { url: url.href, isAmazonSearch };
}
