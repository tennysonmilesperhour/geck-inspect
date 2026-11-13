// @vitest-environment jsdom
// Who may edit or delete a vet visit (owner decision E16). The member's own
// visits come back with their email as created_by (src/lib/ownerRows.js);
// another member's visit, on a gecko in a shared collection, now has
// owner_profile_id and no created_by at all. A missing created_by used to
// mean "anyone may change it", which would have let a collaborator edit the
// owner's visits. Visits with no owner at all still may change, as before.
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ visits: [] }));

vi.mock('@/entities/all', () => ({
  VetRecord: { filter: async () => fx.visits.map((v) => ({ ...v })), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/lib/uploadFile', () => ({ uploadFile: vi.fn() }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

import VetRecordsSection from '@/components/gecko/VetRecordsSection';

installDomHarness();

const ME = 'Sam@Example.com';
const GECKO = { id: 'g-mango', name: 'Mango' };

const visit = (id, reason, owner) => ({ id, animal_id: GECKO.id, date: '2026-11-01', reason, ...owner });

beforeEach(() => {
  fx.visits = [
    visit('v-mine', 'Lilly White weigh-in check', { created_by: 'sam@example.com', owner_profile_id: 'p-me' }),
    visit('v-theirs', 'Harlequin tail check', { owner_profile_id: 'p-ana' }),
    visit('v-nobody', 'Axanthic eye check', { owner_profile_id: null }),
  ];
});

const rowOf = (reason) => screen.getByText(reason).closest('.bg-slate-800');
const actions = (reason) => within(rowOf(reason)).queryAllByRole('button', { name: /vet visit$/ }).map((b) => b.getAttribute('aria-label'));

describe('vet visit edit and delete buttons', () => {
  it('shows them on the member\'s own visits and on visits with no owner, not on another member\'s', async () => {
    render(<VetRecordsSection gecko={GECKO} canEdit currentUserEmail={ME} />);
    await screen.findByText('Harlequin tail check');
    expect(actions('Lilly White weigh-in check')).toEqual(['Edit vet visit', 'Delete vet visit']);
    expect(actions('Axanthic eye check')).toEqual(['Edit vet visit', 'Delete vet visit']);
    expect(actions('Harlequin tail check')).toEqual([]);
  });

  it('shows none when the viewer may not edit the gecko', async () => {
    render(<VetRecordsSection gecko={GECKO} canEdit={false} currentUserEmail={ME} />);
    await screen.findByText('Harlequin tail check');
    expect(actions('Lilly White weigh-in check')).toEqual([]);
    expect(actions('Axanthic eye check')).toEqual([]);
  });

  it('leaves every visit changeable when the host passes no member, as before', async () => {
    render(<VetRecordsSection gecko={GECKO} canEdit />);
    await screen.findByText('Harlequin tail check');
    expect(actions('Harlequin tail check')).toEqual(['Edit vet visit', 'Delete vet visit']);
  });
});
