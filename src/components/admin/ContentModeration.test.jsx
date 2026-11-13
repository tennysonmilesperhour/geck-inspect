// @vitest-environment jsdom
// The Marketplace tab of Content moderation names each listed gecko's
// owner by email. Gecko rows say who owns them by owner_profile_id: once
// members lose created_by on geckos (step 2 of
// docs/planning/owner-emails-2026-11.md) an admin reads it only on their
// own geckos, so the address comes from the owner's profile, looked up
// once for the whole list.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({
  profiles: [
    { id: 'p-lilly', email: 'lilly@example.test' },
    { id: 'p-harley', email: 'harley@example.test' },
  ],
  // No created_by on any row. p-gone has no profile; the last row has no owner.
  listings: [
    { id: 'g1', name: 'Lilly White male', owner_profile_id: 'p-lilly', status: 'For Sale', is_public: true },
    { id: 'g2', name: 'Harlequin female', owner_profile_id: 'p-harley', status: 'For Sale', is_public: true },
    { id: 'g3', name: 'Phantom holdback', owner_profile_id: 'p-gone', status: 'For Sale', is_public: true },
    { id: 'g4', name: 'Sable pair', owner_profile_id: null, status: 'For Sale', is_public: true },
  ],
  profileReads: [],
  geckoFilters: [],
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: (name) => ({
      select: (columns) => ({
        in: async (_column, ids) => {
          fx.profileReads.push([name, columns, ids]);
          return { data: fx.profiles.filter((p) => ids.includes(p.id)), error: null };
        },
      }),
    }),
  },
}));
vi.mock('@/entities/all', () => ({
  ForumPost: { list: async () => [], delete: vi.fn() },
  ForumComment: { list: async () => [], delete: vi.fn() },
  Gecko: {
    filter: async (filter) => {
      fx.geckoFilters.push(filter);
      return fx.listings.map((g) => ({ ...g }));
    },
    update: vi.fn(),
  },
}));

import ContentModeration from './ContentModeration';

installDomHarness();

beforeEach(() => {
  fx.profileReads = [];
  fx.geckoFilters = [];
});

async function openMarketplace() {
  render(<ContentModeration />);
  fireEvent.mouseDown(screen.getByRole('tab', { name: /Marketplace/ }));
  await screen.findByText('Lilly White male');
}

// The owner line under a listing: name, then the owner and the age.
const ownerOf = (name) => screen.getByText(name).closest('.flex-1').querySelector('.mt-1\\.5 span').textContent;

describe('Content moderation, marketplace owners', () => {
  it("shows each listing's owner from their profile, with one lookup for the list", async () => {
    await openMarketplace();
    expect(ownerOf('Lilly White male')).toBe('lilly@example.test');
    expect(ownerOf('Harlequin female')).toBe('harley@example.test');
    expect(ownerOf('Phantom holdback')).toBe('Unknown owner');
    expect(ownerOf('Sable pair')).toBe('Unknown owner');
    expect(fx.geckoFilters).toEqual([{ status: 'For Sale', is_public: true }]);
    expect(fx.profileReads).toEqual([['read_profiles', 'id, email', ['p-lilly', 'p-harley', 'p-gone']]]);
  });

  it("finds a listing by its owner's email", async () => {
    await openMarketplace();
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'harley@' } });
    expect(screen.getByText('Harlequin female')).toBeTruthy();
    expect(screen.queryByText('Lilly White male')).toBeNull();
    expect(screen.queryByText('Sable pair')).toBeNull();
  });
});
