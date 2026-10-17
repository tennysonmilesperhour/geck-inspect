// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const db = vi.hoisted(() => ({ product: null, selects: [] }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from(table) {
  const query = {
    select(fields) { db.selects.push(fields); return this; },
    eq() { return this; }, contains() { return this; }, order() { return this; },
    async maybeSingle() { return { data: table === 'app_settings' ? { value: true } : db.product }; },
    async limit() { return { data: [db.product] }; },
  };
  return query;
} } }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/lib/store/cart', () => ({ addToCart: vi.fn() }));
vi.mock('@/components/store/StoreLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('@/components/seo/Seo', () => ({ default: ({ jsonLd }) => <script data-testid="product-schema" type="application/ld+json">{JSON.stringify(jsonLd)}</script> }));

import ProductCard from './ProductCard';
import StoreProduct from './StoreProduct';
import RecommendedKitForGecko from './RecommendedKitForGecko';

const generatedUrl = '/store/products/digital-gram-scale.jpg';
const destination = 'https://www.amazon.com/s?k=digital+gram+scale+0.1g+reptile&tag=geckinspect09-20';
beforeEach(() => {
  db.selects = [];
  db.product = {
    id: 'scale', slug: 'aff-kitchen-gram-scale-amazon', name: 'Digital gram scale',
    fulfillment_mode: 'affiliate_redirect', status: 'active',
    vendor_product_url: destination, our_price_cents: 1999,
    short_description: 'Weigh your gecko.',
    images: [{ url: generatedUrl, kind: 'representative', is_primary: true }],
    vendor_extra: { image_is_generated_category_art: true },
  };
});
afterEach(cleanup);

describe('product image display boundaries', () => {
  it('keeps card links, copy and estimated price while removing the generated image', () => {
    const { container } = render(<MemoryRouter><ProductCard product={db.product} /></MemoryRouter>);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('See photos on Amazon')).toBeTruthy();
    expect(screen.getByText('Est. $19.99')).toBeTruthy();
    expect(screen.getByText('Weigh your gecko.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Buy at vendor' }).getAttribute('href')).toBe(destination);
  });

  it('excludes generated images from detail galleries and Product JSON-LD', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/Store/p/aff-kitchen-gram-scale-amazon']}>
      <Routes><Route path="/Store/p/:slug" element={<StoreProduct />} /></Routes>
    </MemoryRouter>);
    await screen.findByText('See photos on Amazon');
    expect(container.querySelector('img')).toBeNull();
    expect(JSON.parse(screen.getByTestId('product-schema').textContent)[0].image).toEqual([]);
    expect(container.innerHTML).not.toContain(generatedUrl);
    expect(screen.getByRole('link', { name: 'Buy at vendor' }).getAttribute('href')).toBe(destination);
  });

  it('filters legacy SVGs in recommendations and requests their provenance fields', async () => {
    db.product.images = [{ url: 'data:image/svg+xml;base64,PHN2Zy8+' }];
    const { container } = render(<MemoryRouter><RecommendedKitForGecko gecko={{ name: 'Mango' }} /></MemoryRouter>);
    await screen.findByText('See photos on Amazon');
    expect(container.querySelector('img')).toBeNull();
    expect(db.selects.some((fields) => fields.includes('vendor_product_url') && fields.includes('vendor_extra'))).toBe(true);
    await waitFor(() => expect(screen.getByText('Digital gram scale')).toBeTruthy());
  });

  it('continues to render an existing supplier photo', () => {
    db.product.images = [{ url: 'https://supplier.example/existing.jpg', kind: 'supplier_example', alt: 'Actual supplier photo' }];
    render(<MemoryRouter><ProductCard product={db.product} /></MemoryRouter>);
    expect(screen.getByAltText('Actual supplier photo').getAttribute('src')).toBe(db.product.images[0].url);
  });
});
