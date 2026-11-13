// @vitest-environment jsdom
// Liked geckos belong to other members, whose email is not readable on a
// gecko (owner decision E16): their rows carry owner_profile_id and no
// created_by. The page names each owner from their profile, read by id,
// and links to the profile by id rather than by address.
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ geckos: [], profiles: {}, userFilters: [] }));

vi.mock('@/api/appClient', () => ({
  api: { auth: { me: async () => ({ id: 'p-me', email: 'sam@example.com', full_name: 'Sam Keeper' }) } },
}));
vi.mock('@/entities/all', () => ({
  MarketplaceLike: {
    list: async () => fx.geckos.map((g, i) => ({ id: `like-${i}`, gecko_id: g.id })),
    delete: vi.fn(),
  },
  Gecko: { filter: async () => fx.geckos.map((g) => ({ ...g })) },
  User: {
    filter: async (query) => {
      fx.userFilters.push(query);
      return (query?.id?.$in || []).map((id) => fx.profiles[id]).filter(Boolean).map((p) => ({ ...p }));
    },
  },
}));
vi.mock('@/components/shared/SignInRequired', () => ({
  default: () => null,
  AccountOnly: ({ children }) => <>{children}</>,
}));
vi.mock('@/components/shared/SmartImage', () => ({ default: () => null }));

import LikedGeckosPage from '@/pages/LikedGeckos';

installDomHarness();

const liked = (id, name, ownerId) => ({
  id, name, status: 'For Sale', asking_price: 380, morphs_traits: 'Lilly White', image_urls: [], owner_profile_id: ownerId,
});

beforeEach(() => {
  fx.geckos = [liked('g-mango', 'Mango', 'p-ana'), liked('g-pip', 'Pip', 'p-ana'), liked('g-biscuit', 'Biscuit', 'p-ben')];
  fx.profiles = {
    'p-ana': { id: 'p-ana', full_name: 'Ana Reyes', business_name: 'Pangea Crested', profile_image_url: null, email: null },
    // A name that is really an address is never shown.
    'p-ben': { id: 'p-ben', full_name: 'ben@example.com', business_name: null, profile_image_url: null, email: null },
  };
  fx.userFilters = [];
});

function showPage() {
  render(
    <MemoryRouter initialEntries={['/LikedGeckos']}>
      <LikedGeckosPage />
    </MemoryRouter>,
  );
}

const cardOf = (name) => screen.getByRole('heading', { name }).closest('.overflow-hidden');

describe('liked geckos owners by profile id', () => {
  it('reads each owner once, by id, never by email', async () => {
    showPage();
    await screen.findByRole('heading', { name: 'Mango' });
    expect(fx.userFilters).toEqual([{ id: { $in: ['p-ana', 'p-ben'] } }]);
  });

  it('names the owner and links to the profile by id', async () => {
    showPage();
    await screen.findByRole('heading', { name: 'Mango' });
    const link = within(cardOf('Mango')).getByRole('link', { name: /Ana Reyes/ });
    expect(link.getAttribute('href')).toBe('/PublicProfile?userId=p-ana');
    expect(within(cardOf('Pip')).getByText('Ana Reyes')).toBeTruthy();
    expect(within(cardOf('Biscuit')).getByText('Breeder')).toBeTruthy();
    expect(document.body.innerHTML).not.toContain('example.com');
  });
});
