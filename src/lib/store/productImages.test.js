import { describe, expect, it } from 'vitest';
import { isAmazonAffiliateProduct, primaryProductImage, productImages } from './productImages';

const amazon = {
  fulfillment_mode: 'affiliate_redirect',
  vendor_product_url: 'https://www.amazon.com/s?k=gram+scale&tag=geckinspect09-20',
};
const generated = { url: '/store/products/digital-gram-scale.jpg', kind: 'representative', is_primary: true };
const supplier = { url: 'https://supplier.example/scale.jpg', kind: 'supplier_example' };

describe('Amazon product images', () => {
  it('removes generated photos from the whole gallery and selects the remaining photo', () => {
    const product = { ...amazon, images: [generated, supplier] };
    expect(productImages(product)).toEqual([supplier]);
    expect(primaryProductImage(product)).toBe(supplier);
    expect(product.images).toEqual([generated, supplier]);
  });

  it('recognizes the old source marker even when the kind is missing', () => {
    expect(productImages({ ...amazon, images: [{ url: generated.url, source: 'geck_inspect_original' }] })).toEqual([]);
  });

  it('removes category SVGs that have only the legacy product-level marker', () => {
    const product = { ...amazon, images: [{ url: 'data:image/svg+xml;base64,PHN2Zy8+' }],
      vendor_extra: { image_is_generated_category_art: true } };
    expect(productImages(product)).toEqual([]);
    expect(primaryProductImage(product)).toBeNull();
  });

  it('preserves existing real photos even with a stale product-level marker', () => {
    const imported = { url: 'https://m.media-amazon.com/existing-photo.jpg', source: 'amazon_creator_connections' };
    const product = { ...amazon, images: [supplier, imported],
      vendor_extra: { image_is_generated_category_art: true } };
    expect(productImages(product)).toEqual([supplier, imported]);
  });

  it('leaves unrelated product artwork and other vendors untouched', () => {
    for (const product of [
      { ...amazon, fulfillment_mode: 'direct_pod', images: [generated] },
      { ...amazon, vendor_product_url: 'https://supplier.example/product', images: [generated] },
    ]) expect(productImages(product)).toBe(product.images);
  });

  it.each(['https://amazon.com/s?k=cups', 'https://www.amazon.com/dp/B0B5W8GMPB', 'https://amzn.to/example'])(
    'recognizes Amazon destinations: %s', (url) => {
      expect(isAmazonAffiliateProduct({ ...amazon, vendor_product_url: url })).toBe(true);
    });

  it.each(['https://amazon.com.evil.example/product', 'not a URL', null])(
    'does not classify a different or invalid host as Amazon: %s', (url) => {
      expect(isAmazonAffiliateProduct({ ...amazon, vendor_product_url: url })).toBe(false);
    });

  it('handles empty and malformed Amazon galleries', () => {
    expect(productImages(null)).toEqual([]);
    expect(productImages({ ...amazon, images: {} })).toEqual([]);
    expect(productImages({ ...amazon, images: [null, {}, generated] })).toEqual([]);
  });
});
