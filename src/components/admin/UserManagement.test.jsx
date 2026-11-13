// @vitest-environment jsdom
// The admin member list counts each member's geckos, sorts by that count
// and opens a member's details. Gecko rows say who owns them by
// owner_profile_id: once members lose created_by on geckos (step 2 of
// docs/planning/owner-emails-2026-11.md) an admin cannot read another
// member's address on a gecko either, so the rows here carry none.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({
  members: [
    { id: 'p-admin', email: 'admin@example.test', full_name: 'Admin Account', role: 'admin', created_date: '2026-01-01T00:00:00Z' },
    { id: 'p-lilly', email: 'lilly@example.test', full_name: 'Lilly White Geckos', role: 'user', created_date: '2026-10-01T00:00:00Z' },
    { id: 'p-harley', email: 'harley@example.test', full_name: 'Harlequin House', role: 'user', created_date: '2026-11-01T00:00:00Z' },
  ],
  // No created_by on any row; one gecko's owner has no profile.
  geckos: [
    { id: 'g1', owner_profile_id: 'p-lilly' },
    { id: 'g2', owner_profile_id: 'p-lilly' },
    { id: 'g3', owner_profile_id: 'p-lilly' },
    { id: 'g4', owner_profile_id: 'p-harley' },
    { id: 'g5', owner_profile_id: null },
  ],
  tableReads: [],
  geckoFilters: [],
}));

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/entities/all', () => {
  const none = async () => [];
  return {
    User: { list: async () => fx.members, update: vi.fn() },
    Gecko: {
      filter: async (filter) => {
        fx.geckoFilters.push(filter);
        return fx.geckos.filter((g) => g.owner_profile_id === filter.owner_profile_id);
      },
    },
    GeckoImage: { filter: none },
    ForumPost: { filter: none },
    UserEvent: { filter: none },
    Notification: { create: vi.fn() },
    DirectMessage: { create: vi.fn() },
  };
});
vi.mock('@/lib/adminData', async () => {
  const actual = await vi.importActual('@/lib/adminData');
  return {
    ...actual,
    fetchAccountDirectory: async () => fx.members.map((m) => ({ id: m.id, has_login: true })),
    fetchAdminTable: async (table, columns) => {
      fx.tableReads.push([table, columns]);
      return fx.geckos;
    },
  };
});

import UserManagement from './UserManagement';

installDomHarness();

beforeEach(() => {
  fx.tableReads = [];
  fx.geckoFilters = [];
});

async function renderList() {
  render(
    <MemoryRouter>
      <UserManagement />
    </MemoryRouter>,
  );
  await screen.findByText('Lilly White Geckos');
}

// The row for one member: their name sits inside it.
const rowOf = (name) => screen.getByText(name).closest('.justify-between');

describe('admin member list, gecko owners by profile id', () => {
  it("counts each member's geckos from owner_profile_id and never asks for created_by", async () => {
    await renderList();
    expect(within(rowOf('Lilly White Geckos')).getByText('3 geckos')).toBeTruthy();
    expect(within(rowOf('Harlequin House')).getByText('1 geckos')).toBeTruthy();
    expect(within(rowOf('Admin Account')).getByText('0 geckos')).toBeTruthy();
    expect(fx.tableReads).toEqual([['geckos', 'id,owner_profile_id']]);
  });

  it('sorts by those counts', async () => {
    await renderList();
    const sort = screen.getAllByRole('combobox')[1];
    fireEvent.keyDown(sort, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('option', { name: 'Most geckos' }));
    const names = screen.getAllByText(/^\d+ geckos$/).map((el) => el.closest('.justify-between').querySelector('span.font-semibold').textContent);
    expect(names).toEqual(['Lilly White Geckos', 'Harlequin House', 'Admin Account']);
  });

  it("opens a member's details with their geckos found by profile id", async () => {
    await renderList();
    fireEvent.click(screen.getByText('Harlequin House'));
    const dialog = await screen.findByRole('dialog');
    const geckos = await within(dialog).findByText('Geckos');
    expect(geckos.previousElementSibling.textContent).toBe('1');
    expect(fx.geckoFilters).toEqual([{ owner_profile_id: 'p-harley' }]);
  });
});
