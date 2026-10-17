// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ insert: vi.fn().mockResolvedValue({}), capture: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: () => ({ insert: mocks.insert }) } }));
vi.mock('@/lib/posthog', () => ({ captureEvent: mocks.capture }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));
vi.mock('@/lib/store/cart', () => ({ addToCart: vi.fn() }));
import AddToCartButton from './AddToCartButton';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('navigates and logs the resolved tagged product URL despite stale search metadata', async () => {
  const product = {
    id: 'test-book', slug: 'aff-rhacodactylus-book', name: 'Rhacodactylus: The Complete Guide',
    fulfillment_mode: 'affiliate_redirect',
    vendor_product_url: 'https://www.amazon.com/s?k=Rhacodactylus+The+Complete+Guide&tag=geckinspect09-20',
    vendor_extra: { link_type: 'search' },
  };
  render(<AddToCartButton product={product} />);
  const link = screen.getByRole('link', { name: 'Buy at vendor' });
  const expected = 'https://www.amazon.com/dp/0974297100?tag=geckinspect09-20';
  expect(link.getAttribute('href')).toBe(expected);
  expect(link.getAttribute('rel')).toContain('sponsored');
  link.addEventListener('click', event => event.preventDefault());
  fireEvent.click(link);
  await waitFor(() => expect(mocks.capture).toHaveBeenCalledWith('store_affiliate_click', expect.objectContaining({ destination_url: expected })));
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ destination_url: expected }));
});

it('labels unresolved tagged search destinations honestly', () => {
  const url = 'https://www.amazon.com/s?k=Govee+hygrometer&tag=geckinspect09-20';
  render(<AddToCartButton product={{ slug: 'aff-govee-hygrometer', fulfillment_mode: 'affiliate_redirect', vendor_product_url: url }} />);
  expect(screen.getByRole('link', { name: 'Find on Amazon' }).getAttribute('href')).toBe(url);
});
