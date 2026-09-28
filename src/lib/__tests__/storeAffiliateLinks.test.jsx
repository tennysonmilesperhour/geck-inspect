import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null }));
afterAll(() => vi.unstubAllGlobals());

vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));
vi.mock('@/lib/store/cart', () => ({ addToCart: vi.fn() }));
import AddToCartButton from '@/components/store/AddToCartButton';

const product = {
  slug: 'amazon-fixture', fulfillment_mode: 'affiliate_redirect',
  vendor_product_url: 'https://www.amazon.com/dp/B0HBBF8KRV?tag=geckinspect09-20',
};

describe('affiliate shopping links', () => {
  it('renders a working tagged link without waiting for click tracking', () => {
    const html = renderToStaticMarkup(<AddToCartButton product={product} compact />);
    expect(html).toContain(`href="${product.vendor_product_url}"`);
    expect(html).toContain('rel="noopener noreferrer sponsored"');
    expect(html).not.toContain(' disabled=');
    expect(html).toContain('Buy at vendor');
  });

  it('labels search destinations so shoppers know they are browsing options', () => {
    const html = renderToStaticMarkup(<AddToCartButton product={{ ...product,
      vendor_product_url: 'https://www.amazon.com/s?k=reptile&tag=geckinspect09-20',
      vendor_extra: { link_type: 'search' },
    }} />);
    expect(html).toContain('Find on Amazon');
  });

  it.each([null, 'javascript:alert(1)', 'https://user:password@example.com'])
    ('does not render an unsafe or missing destination: %s', (url) => {
      const html = renderToStaticMarkup(<AddToCartButton product={{ ...product, vendor_product_url: url }} />);
      expect(html).not.toContain('href=');
      expect(html).toContain(' disabled=');
    });
});
