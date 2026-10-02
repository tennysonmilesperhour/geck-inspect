import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null }));
afterAll(() => vi.unstubAllGlobals());

vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));
vi.mock('@/lib/store/cart', () => ({ addToCart: vi.fn() }));
import AddToCartButton from '@/components/store/AddToCartButton';
import { isAwaitingCheckout } from '@/lib/store/checkoutFlags';

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

describe('closed checkout', () => {
  it('never offers add to cart or a builder for items sold through Geck Inspect', () => {
    for (const p of [
      { slug: 'gi-tee', fulfillment_mode: 'direct_pod' },
      { slug: 'gi-food', fulfillment_mode: 'direct_self' },
      { slug: 'partner-tub', fulfillment_mode: 'dropship_wholesale' },
      { slug: 'custom-pet-sticker', fulfillment_mode: 'direct_pod' },
      { slug: 'custom-gecko-tee', fulfillment_mode: 'direct_pod' },
    ]) {
      const html = renderToStaticMarkup(<AddToCartButton product={p} />);
      expect(html, p.slug).toContain('Not available to order yet');
      expect(html, p.slug).toContain(' disabled=');
      expect(html, p.slug).not.toContain('href=');
      expect(html, p.slug).not.toMatch(/Add to cart|Build your/);
    }
  });

  it('treats only non-affiliate products as awaiting checkout, and none once it opens', () => {
    expect(isAwaitingCheckout({ fulfillment_mode: 'direct_self' }, false)).toBe(true);
    expect(isAwaitingCheckout({ slug: 'custom-pet-sticker' }, false)).toBe(true);
    expect(isAwaitingCheckout({ fulfillment_mode: 'affiliate_redirect' }, false)).toBe(false);
    expect(isAwaitingCheckout({ fulfillment_mode: 'direct_self' }, true)).toBe(false);
  });
});
