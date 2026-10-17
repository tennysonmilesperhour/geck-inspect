import { describe, expect, it } from 'vitest';
import { productVendorLink } from './affiliateLinks';

const cases = [
  ['aff-dymo-labelwriter-450', 'Dymo LabelWriter 450', 'Dymo LabelWriter 450', 'B0027JBLV4'],
  ['aff-hova-bator-1602n', 'Hova-Bator 1602N', 'Hova-Bator 1602N', 'B0145O6C0S'],
  ['aff-rhacodactylus-book', 'Rhacodactylus: The Complete Guide', 'Rhacodactylus The Complete Guide', '0974297100'],
  ['aff-uniheat-40hr-heat-pack', 'Uniheat 40-hour heat pack (10 pack)', 'Uniheat 40 hour heat pack', 'B00I3R1RMC'],
];
function product([slug, name, query] = cases[0]) {
  return {
    slug, name, fulfillment_mode: 'affiliate_redirect',
    vendor_product_url: `https://www.amazon.com/s?${new URLSearchParams({ k: query, tag: 'geckinspect09-20' })}`,
    vendor_extra: { link_type: 'search' },
  };
}

describe('verified Amazon affiliate destinations', () => {
  it.each(cases)('resolves the exact verified model for %s and retains its tag', (...entry) => {
    const p = product(entry);
    const before = structuredClone(p);
    expect(productVendorLink(p)).toEqual({
      url: `https://www.amazon.com/dp/${entry[3]}?tag=geckinspect09-20`, isAmazonSearch: false,
    });
    expect(p).toEqual(before);
  });

  it.each([
    { name: 'Dymo LabelWriter 450 Turbo' },
    { slug: 'aff-unverified-model' },
    { fulfillment_mode: 'direct_self' },
    { vendor_product_url: 'https://www.amazon.com/dp/B07P6H3SKV?tag=geckinspect09-20' },
    { vendor_product_url: 'https://www.amazon.com/s?k=Dymo+LabelWriter+450&tag=changed-20' },
    { vendor_product_url: 'https://www.amazon.com/s?k=Dymo+LabelWriter+450' },
    { vendor_product_url: 'https://www.amazon.com/s?k=Dymo+LabelWriter+450&tag=geckinspect09-20&rh=condition' },
    { vendor_product_url: 'https://www.amazon.com/s?k=Dymo+LabelWriter+550&tag=geckinspect09-20' },
    { vendor_product_url: 'https://supplier.example/s?k=Dymo+LabelWriter+450&tag=geckinspect09-20' },
  ])('preserves later edits and unverified destinations: %j', (change) => {
    const p = { ...product(), ...change };
    expect(productVendorLink(p).url).toBe(p.vendor_product_url);
  });

  it('identifies a tagged search independently of stale vendor metadata', () => {
    expect(productVendorLink({ ...product(), slug: 'generic-scale', vendor_extra: {} }).isAmazonSearch).toBe(true);
  });

  it.each(['javascript:alert(1)', 'https://user:password@www.amazon.com/s', undefined])('rejects unsafe URLs: %s', (url) => {
    expect(productVendorLink({ ...product(), vendor_product_url: url })).toEqual({ url: null, isAmazonSearch: false });
  });
});
