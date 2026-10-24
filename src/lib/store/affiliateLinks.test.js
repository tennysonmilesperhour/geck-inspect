import { describe, expect, it } from 'vitest';
import { AMAZON_ASSOCIATE_TAG, productVendorLink } from './affiliateLinks';

const cases = [
  ['aff-dymo-labelwriter-450', 'Dymo LabelWriter 450', 'Dymo LabelWriter 450', 'B0027JBLV4'],
  ['aff-hova-bator-1602n', 'Hova-Bator 1602N', 'Hova-Bator 1602N', 'B0145O6C0S'],
  ['aff-rhacodactylus-book', 'Rhacodactylus: The Complete Guide', 'Rhacodactylus The Complete Guide', '0974297100'],
  ['aff-uniheat-40hr-heat-pack', 'Uniheat 40-hour heat pack (10 pack)', 'Uniheat 40 hour heat pack', 'B00I3R1RMC'],
];
function product([slug, name, query] = cases[0], tag = 'geckinspect09-20') {
  return {
    slug, name, fulfillment_mode: 'affiliate_redirect',
    vendor_product_url: `https://www.amazon.com/s?${new URLSearchParams({ k: query, tag })}`,
    vendor_extra: { link_type: 'search' },
  };
}

describe('verified Amazon affiliate destinations', () => {
  it.each(cases)('resolves the exact verified model for %s with the owner-designated tag', (...entry) => {
    for (const tag of ['geckinspect09-20', 'geckinspect-20']) {
      const p = product(entry, tag);
      const before = structuredClone(p);
      expect(productVendorLink(p)).toEqual({
        url: `https://www.amazon.com/dp/${entry[3]}?tag=geckinspect-20`, isAmazonSearch: false,
      });
      expect(p).toEqual(before);
    }
  });

  it.each([
    [{ name: 'Dymo LabelWriter 450 Turbo' }, 'https://www.amazon.com/s?k=Dymo+LabelWriter+450&tag=geckinspect-20'],
    [{ slug: 'aff-unverified-model' }, 'https://www.amazon.com/s?k=Dymo+LabelWriter+450&tag=geckinspect-20'],
    [{ fulfillment_mode: 'direct_self' }, 'https://www.amazon.com/s?k=Dymo+LabelWriter+450&tag=geckinspect09-20'],
    [{ vendor_product_url: 'https://www.amazon.com/dp/B07P6H3SKV?tag=geckinspect09-20' }, 'https://www.amazon.com/dp/B07P6H3SKV?tag=geckinspect-20'],
    [{ vendor_product_url: 'https://www.amazon.com/s?k=Dymo+LabelWriter+450&tag=changed-20' }, 'https://www.amazon.com/s?k=Dymo+LabelWriter+450&tag=geckinspect-20'],
    [{ vendor_product_url: 'https://www.amazon.com/s?k=Dymo+LabelWriter+450' }, 'https://www.amazon.com/s?k=Dymo+LabelWriter+450&tag=geckinspect-20'],
    [{ vendor_product_url: 'https://www.amazon.com/s?k=Dymo+LabelWriter+450&tag=geckinspect09-20&rh=condition' }, 'https://www.amazon.com/s?k=Dymo+LabelWriter+450&tag=geckinspect-20&rh=condition'],
    [{ vendor_product_url: 'https://www.amazon.com/s?k=Dymo+LabelWriter+550&tag=geckinspect09-20' }, 'https://www.amazon.com/s?k=Dymo+LabelWriter+550&tag=geckinspect-20'],
    [{ vendor_product_url: 'https://supplier.example/s?k=Dymo+LabelWriter+450&tag=geckinspect09-20' }, 'https://supplier.example/s?k=Dymo+LabelWriter+450&tag=geckinspect09-20'],
  ])('preserves unverified destinations while correcting only Amazon affiliate attribution: %j', (change, expected) => {
    expect(productVendorLink({ ...product(), ...change }).url).toBe(expected);
  });

  it('identifies a tagged search independently of stale vendor metadata', () => {
    expect(productVendorLink({ ...product(), slug: 'generic-scale', vendor_extra: {} }).isAmazonSearch).toBe(true);
  });

  it.each(['javascript:alert(1)', 'https://user:password@www.amazon.com/s', undefined])('rejects unsafe URLs: %s', (url) => {
    expect(productVendorLink({ ...product(), vendor_product_url: url })).toEqual({ url: null, isAmazonSearch: false });
  });
});

describe('owner-designated Amazon attribution', () => {
  it('uses the tag explicitly supplied by the owner', () => {
    expect(AMAZON_ASSOCIATE_TAG).toBe('geckinspect-20');
  });

  it.each([
    ['https://amazon.com/dp/B07P6H3SKV?ref_=abc%2fDEF&tag=geckinspect09-20&psc=1&th=1#details', 'https://amazon.com/dp/B07P6H3SKV?ref_=abc%2fDEF&tag=geckinspect-20&psc=1&th=1#details'],
    ['https://www.amazon.com/s?k=digital%20scale&rh=a%2Cb&rh=c&tag=geckinspect09-20', 'https://www.amazon.com/s?k=digital%20scale&rh=a%2Cb&rh=c&tag=geckinspect-20'],
    ['https://www.amazon.com/dp/B07P6H3SKV#details', 'https://www.amazon.com/dp/B07P6H3SKV?tag=geckinspect-20#details'],
    ['https://www.amazon.com/dp/B07P6H3SKV?th=1#details', 'https://www.amazon.com/dp/B07P6H3SKV?th=1&tag=geckinspect-20#details'],
    ['https://www.amazon.com/dp/B07P6H3SKV?tag=other-20&tag=geckinspect09-20&x=1', 'https://www.amazon.com/dp/B07P6H3SKV?tag=geckinspect-20&tag=geckinspect-20&x=1'],
    ['https://www.amazon.com/dp/B07P6H3SKV?%74ag=geckinspect09-20&x=%2f', 'https://www.amazon.com/dp/B07P6H3SKV?%74ag=geckinspect-20&x=%2f'],
    ['https://www.amazon.com/dp/B07P6H3SKV?bad%=1&tag=geckinspect09-20', 'https://www.amazon.com/dp/B07P6H3SKV?bad%=1&tag=geckinspect-20'],
    ['https://www.amazon.com/dp/B07P6H3SKV?tag=geckinspect-20&psc=1', 'https://www.amazon.com/dp/B07P6H3SKV?tag=geckinspect-20&psc=1'],
  ])('preserves product, variant and unrelated URL bytes: %s', (source, expected) => {
    const p = { ...product(), slug: 'unverified', vendor_product_url: source };
    const before = structuredClone(p);
    expect(productVendorLink(p).url).toBe(expected);
    expect(productVendorLink({ ...p, vendor_product_url: expected }).url).toBe(expected);
    expect(p).toEqual(before);
  });

  it.each([
    'https://supplier.example/product?tag=geckinspect09-20',
    'https://www.amazon.com.example.org/dp/B07P6H3SKV?tag=geckinspect09-20',
    'https://amzn.to/existing-link',
  ])('does not rewrite other merchants or unresolved short links: %s', (url) => {
    expect(productVendorLink({ ...product(), vendor_product_url: url }).url).toBe(url);
  });
});
