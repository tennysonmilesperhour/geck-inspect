// @vitest-environment jsdom
// The marketplace names each listing's owner by profile id (owner decision
// E16): members cannot read another member's email on a gecko, so a row
// from someone else carries owner_profile_id and no created_by. The owner's
// name, the search by breeder, the message button, the report button, the
// trust panel and the listing schema all work from that id, and none of
// them shows or sends an email address.
//
// The page is real. The message, report and trust components are stand-ins
// that show what the page handed them; each has its own tests.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ user: null, geckos: [], profiles: {}, userFilters: [], jsonLd: null }));

vi.mock('@/api/appClient', () => ({
  api: {
    auth: {
      me: async () => {
        if (!fx.user) throw new Error('Not authenticated');
        return fx.user;
      },
    },
  },
}));
vi.mock('@/entities/all', () => ({
  Gecko: { filter: async () => fx.geckos.map((g) => ({ ...g })) },
  MarketplaceLike: { filter: async () => [], create: vi.fn(), delete: vi.fn() },
  User: {
    filter: async (query) => {
      fx.userFilters.push(query);
      return (query?.id?.$in || []).map((id) => fx.profiles[id]).filter(Boolean).map((p) => ({ ...p }));
    },
  },
}));
vi.mock('@/hooks/usePageSettings', () => ({ default: (key, defaults) => [defaults, () => {}] }));
vi.mock('@/hooks/useBlockedAuthors', () => ({ useBlockedMembers: () => ({ isBlocked: () => false }) }));
vi.mock('@/components/seo/Seo', () => ({
  default: ({ jsonLd }) => {
    fx.jsonLd = jsonLd;
    return null;
  },
}));
vi.mock('@/components/ui/PageSettingsPanel', () => ({ default: () => null }));
vi.mock('@/components/shared/SmartImage', () => ({ default: () => null }));
vi.mock('@/components/marketplace/TrustPanel', () => ({
  default: ({ profileId, email }) => <span data-testid="trust" data-profile={profileId} data-email={String(email)} />,
}));
vi.mock('@/components/ui/MessageUserButton', () => ({
  default: ({ recipientProfileId, recipientEmail, recipientName }) => (
    <span data-testid="message" data-profile={recipientProfileId} data-email={String(recipientEmail)}>
      Message {recipientName}
    </span>
  ),
}));
vi.mock('@/components/support/ReportContent', () => ({
  default: (props) => (
    <span
      data-testid="report"
      data-target={props.targetId}
      data-author={props.authorProfileId}
      data-email-prop={String('authorEmail' in props)}
    />
  ),
}));

import MarketplaceBuyPage from '@/pages/MarketplaceBuy';

installDomHarness();

// Rows as members read them now: another member's gecko has no created_by.
// The member's own listing has it back (src/lib/ownerRows.js).
const listing = (id, name, ownerId, extra = {}) => ({
  id, name, status: 'For Sale', is_public: true, archived: false, sex: 'Female',
  morphs_traits: 'Lilly White Harlequin', asking_price: 450, image_urls: [], owner_profile_id: ownerId, ...extra,
});

const PROFILES = {
  // read_profiles by id: a name and picture, never another member's email.
  'p-ana': { id: 'p-ana', full_name: 'Ana Reyes', business_name: 'Pangea Crested', profile_image_url: null, email: null },
  // A name that is really an address is never shown.
  'p-ben': { id: 'p-ben', full_name: 'ben@example.com', business_name: null, profile_image_url: null, email: null },
  'p-me': { id: 'p-me', full_name: 'Sam Keeper', business_name: null, profile_image_url: null, email: 'sam@example.com' },
};

function showPage() {
  render(
    <MemoryRouter initialEntries={['/MarketplaceBuy']}>
      <MarketplaceBuyPage />
    </MemoryRouter>,
  );
}

const cardOf = (name) => screen.getByRole('heading', { name }).closest('.group');

beforeEach(() => {
  fx.geckos = [
    listing('g-mango', 'Mango', 'p-ana', { price: 450 }),
    listing('g-biscuit', 'Biscuit', 'p-ben', { morphs_traits: 'Cappuccino', price: 300 }),
    listing('g-pip', 'Pip', 'p-ana', { morphs_traits: 'Axanthic' }),
    // A private profile: read_profiles does not return it.
    listing('g-nimbus', 'Nimbus', 'p-private', { morphs_traits: 'Sable' }),
    listing('g-own', 'Own Highway', 'p-me', { morphs_traits: 'Highway', created_by: 'sam@example.com' }),
  ];
  fx.user = { id: 'p-me', email: 'sam@example.com', full_name: 'Sam Keeper' };
  fx.profiles = PROFILES;
  fx.userFilters = [];
  fx.jsonLd = null;
});

describe('marketplace owners by profile id', () => {
  it('reads the owners once, by id, never by email', async () => {
    showPage();
    await screen.findByRole('heading', { name: 'Mango' });
    expect(fx.userFilters).toEqual([{ id: { $in: ['p-ana', 'p-ben', 'p-private', 'p-me'] } }]);
  });

  it('shows the owner on each card from the profile, and never an address', async () => {
    showPage();
    await screen.findByRole('heading', { name: 'Mango' });
    expect(within(cardOf('Mango')).getByText('Ana Reyes')).toBeTruthy();
    expect(within(cardOf('Pip')).getByText('Ana Reyes')).toBeTruthy();
    expect(within(cardOf('Biscuit')).getByText('Breeder')).toBeTruthy();
    expect(within(cardOf('Nimbus')).getByText('Breeder')).toBeTruthy();
    expect(within(cardOf('Own Highway')).getByText('Sam Keeper')).toBeTruthy();
    expect(document.body.textContent).not.toContain('@example.com');
    const profileLink = within(cardOf('Mango')).getByRole('link', { name: /Ana Reyes/ });
    expect(profileLink.getAttribute('href')).toBe('/PublicProfile?userId=p-ana');
  });

  it('finds listings by the owner name although the rows carry no created_by', async () => {
    showPage();
    await screen.findByRole('heading', { name: 'Mango' });
    await userEvent.type(screen.getByPlaceholderText('Search morph, gecko name, or breeder...'), 'reyes');
    expect(screen.getByText('2 geckos found')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mango' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pip' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Biscuit' })).toBeNull();
  });

  it('messages, reports and shows the track record by profile id', async () => {
    showPage();
    await screen.findByRole('heading', { name: 'Mango' });
    const mango = within(cardOf('Mango'));
    const message = mango.getByTestId('message');
    expect(message.dataset.profile).toBe('p-ana');
    expect(message.dataset.email).toBe('undefined');
    expect(message.textContent).toBe('Message Ana Reyes');
    const report = mango.getByTestId('report');
    expect(report.dataset.author).toBe('p-ana');
    expect(report.dataset.emailProp).toBe('false');
    expect(mango.getByTestId('trust').dataset.profile).toBe('p-ana');
    expect(mango.getByTestId('trust').dataset.email).toBe('undefined');

    // The member's own listing: no message button to themselves.
    expect(within(cardOf('Own Highway')).queryByTestId('message')).toBeNull();
    // An owner whose profile is not readable: still reportable by id, no
    // message or track record (as before, they need the profile).
    const nimbus = within(cardOf('Nimbus'));
    expect(nimbus.getByTestId('report').dataset.author).toBe('p-private');
    expect(nimbus.queryByTestId('message')).toBeNull();
    expect(nimbus.queryByTestId('trust')).toBeNull();
  });

  it('shows a signed-out visitor each owner\'s name, with no track record or message button', async () => {
    fx.user = null;
    showPage();
    await screen.findByRole('heading', { name: 'Mango' });
    const mango = within(cardOf('Mango'));
    expect(mango.getByText('Ana Reyes')).toBeTruthy();
    expect(mango.getByTestId('report').dataset.author).toBe('p-ana');
    expect(screen.queryAllByTestId('trust')).toHaveLength(0);
    expect(screen.queryAllByTestId('message')).toHaveLength(0);
  });

  it('names the seller in the listing schema from the profile, never with an address', async () => {
    showPage();
    await screen.findByRole('heading', { name: 'Mango' });
    const items = fx.jsonLd[0].mainEntity.itemListElement.map((el) => el.item);
    const mango = items.find((p) => p.sku === 'g-mango');
    expect(mango.offers.seller).toEqual({
      '@type': 'Person',
      name: 'Ana Reyes',
      affiliation: { '@type': 'Organization', name: 'Pangea Crested' },
    });
    const biscuit = items.find((p) => p.sku === 'g-biscuit');
    expect(biscuit.offers.seller).toBeUndefined();
    expect(JSON.stringify(fx.jsonLd)).not.toContain('@example.com');
  });
});
