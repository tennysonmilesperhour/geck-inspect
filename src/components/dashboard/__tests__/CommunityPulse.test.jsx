// @vitest-environment jsdom
// Community Pulse names who did what from their profile, read by profile id
// (owner decision E16). Members cannot read the owner's email (created_by)
// on geckos, breeding plans, photos or forum posts, so another member's
// gecko or plan carries owner_profile_id and no created_by, and the names
// must still show. There is no lookup by email any more.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ rows: {}, profiles: [], rpcCalls: [] }));

vi.mock('@/entities/all', () => {
  const listOf = (name) => ({ list: async () => (fx.rows[name] || []).map((r) => ({ ...r })) });
  return {
    Gecko: listOf('Gecko'),
    GeckoImage: listOf('GeckoImage'),
    ForumPost: listOf('ForumPost'),
    BreedingPlan: listOf('BreedingPlan'),
  };
});
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: (name, args) => {
      const call = { name, args, select: null, filters: [] };
      fx.rpcCalls.push(call);
      const query = {
        select(cols) { call.select = cols; return query; },
        in(column, values) {
          call.filters.push([column, values]);
          return Promise.resolve({ data: fx.profiles.filter((p) => values.includes(p.id)), error: null });
        },
      };
      return query;
    },
  },
}));

import CommunityPulse from '@/components/dashboard/CommunityPulse';

installDomHarness();

const minutesAgo = (n) => new Date(Date.now() - n * 60000).toISOString();

beforeEach(() => {
  fx.rows = {
    Gecko: [{ id: 'g1', name: 'Mango', created_date: minutesAgo(1), owner_profile_id: 'p-ana' }],
    BreedingPlan: [{ id: 'b1', breeding_id: 'Lilly White x Harlequin', created_date: minutesAgo(2), owner_profile_id: 'p-ben' }],
    GeckoImage: [{ id: 'i1', primary_morph: 'dalmatian', created_date: minutesAgo(3), owner_profile_id: 'p-ana' }],
    // A row with no owner id says "A keeper" and asks for nothing.
    ForumPost: [{ id: 'f1', title: 'Pinstripe or Phantom?', created_date: minutesAgo(4), owner_profile_id: null }],
  };
  fx.profiles = [
    { id: 'p-ana', full_name: 'Ana Reyes', business_name: null, profile_image_url: null },
    { id: 'p-ben', full_name: null, business_name: 'Sable Street Geckos', profile_image_url: null },
  ];
  fx.rpcCalls = [];
});

function showPulse() {
  render(
    <MemoryRouter>
      <CommunityPulse />
    </MemoryRouter>,
  );
}

describe('Community Pulse names', () => {
  it('names gecko and plan owners from their profile, with rows that carry no created_by', async () => {
    showPulse();
    const gecko = await screen.findByText('added a new gecko');
    expect(gecko.closest('p').textContent).toContain('Ana Reyes');
    expect(screen.getByText('started a breeding plan').closest('p').textContent).toContain('Sable Street Geckos');
    expect(screen.getByText('uploaded a photo').closest('p').textContent).toContain('Ana Reyes');
    expect(screen.getByText('started a forum discussion').closest('p').textContent).toContain('A keeper');
  });

  it('looks the names up once, by profile id only, and never asks for an email', async () => {
    showPulse();
    await screen.findByText('added a new gecko');
    expect(fx.rpcCalls).toHaveLength(1);
    const [call] = fx.rpcCalls;
    expect(call.name).toBe('read_profiles');
    expect(call.args).toBeUndefined();
    expect(call.filters).toEqual([['id', ['p-ana', 'p-ben']]]);
    expect(call.select).not.toMatch(/email/);
  });
});
