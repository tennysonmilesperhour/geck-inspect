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

// Existing catalog tag, also verified against the owner's Associates StoreID.
const VERIFIED_ASSOCIATE_TAG = 'geckinspect09-20';

export function productVendorLink(product) {
  const safeUrl = safeExternalUrl(product?.vendor_product_url);
  if (!safeUrl) return { url: null, isAmazonSearch: false };
  const url = new URL(safeUrl);
  const isAmazonSearch = (url.hostname === 'amazon.com' || url.hostname === 'www.amazon.com')
    && url.pathname === '/s';
  const match = VERIFIED_PRODUCTS[product?.slug];

  // A later catalog edit takes precedence. Only resolve the specific legacy
  // search and product identity we verified, retaining its existing tag.
  if (product?.fulfillment_mode === 'affiliate_redirect' && match
    && product.name === match.name && isAmazonSearch
    && url.searchParams.get('k') === match.query
    && url.searchParams.get('tag') === VERIFIED_ASSOCIATE_TAG
    && [...url.searchParams.keys()].length === 2 && !url.hash) {
    url.pathname = `/dp/${match.asin}`;
    url.searchParams.delete('k');
    return { url: url.href, isAmazonSearch: false };
  }
  return { url: safeUrl, isAmazonSearch };
}
