// @vitest-environment jsdom
// Experience review D6: Edit on the gecko record PAGE used to leave for My
// Geckos and strand the member there after saving. The long form now opens
// over the record page, and saving or cancelling returns to the record,
// refreshed. The record and the form are stand-ins; each has its own test.
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ gecko: null, user: null, collection: [], cached: null, gets: 0, loads: 0, form: null, toasts: [], invalidated: [] }));

vi.mock('@/components/gecko/record/GeckoRecord', () => ({
  default: ({ gecko, onEdit }) => (
    <div data-testid="record">
      Record of {gecko.name}
      <button type="button" onClick={() => onEdit(gecko)}>Edit {gecko.name}</button>
    </div>
  ),
}));
vi.mock('@/components/my-geckos/GeckoForm', () => ({
  default: (props) => {
    fx.form = props;
    return <div data-testid="long-form">Long form for {props.gecko.name}</div>;
  },
}));
vi.mock('@/components/ui/use-toast', () => ({ toast: (t) => fx.toasts.push(t) }));
vi.mock('@/api/appClient', () => ({ api: { auth: { me: async () => fx.user } } }));
vi.mock('@/lib/query-client', () => ({
  queryClientInstance: {
    invalidateQueries: (q) => fx.invalidated.push(q.queryKey),
    getQueryData: () => fx.cached,
  },
}));
vi.mock('@/lib/geckoAccess', () => ({
  canWriteGecko: () => true,
  canDeleteGecko: () => true,
  getVisibleGeckos: async () => { fx.loads += 1; return fx.collection; },
}));
vi.mock('@/entities/all', () => ({
  Gecko: { get: async () => { fx.gets += 1; return fx.gecko; }, update: vi.fn(), delete: vi.fn() },
  CollectionMember: { filter: async () => [] },
}));

import GeckoDetail from '@/pages/GeckoDetail';

installDomHarness();

const OWNER = { id: 'u1', email: 'keeper@example.com' };
const NIMBUS = { id: 'g1', name: 'Nimbus', created_by: OWNER.email, collection_id: 'c1', sire_id: 'g2' };
const SPUD = { id: 'g2', name: 'Spud', sex: 'Male', created_by: OWNER.email };

function Where() {
  const loc = useLocation();
  return <output data-testid="where">{`${loc.pathname}${loc.search}`}</output>;
}

async function showPage() {
  render(
    <MemoryRouter initialEntries={['/GeckoDetail?id=g1']}>
      <Routes>
        <Route path="*" element={<><GeckoDetail /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByTestId('record');
}

beforeEach(() => {
  fx.gecko = { ...NIMBUS };
  fx.user = OWNER;
  fx.collection = [NIMBUS, SPUD];
  fx.cached = null;
  fx.gets = 0;
  fx.loads = 0;
  fx.form = null;
  fx.toasts.length = 0;
  fx.invalidated.length = 0;
});

describe('/GeckoDetail: Edit opens the long form over the record', () => {
  it('opens the form on the page, with the collection for the parent pickers, and cancel returns to the record', async () => {
    const user = userEvent.setup();
    await showPage();
    await user.click(screen.getByRole('button', { name: 'Edit Nimbus' }));

    expect(await screen.findByTestId('long-form')).toBeTruthy();
    // Still the record page, with the record under the form.
    expect(screen.getByTestId('where').textContent).toBe('/GeckoDetail?id=g1');
    expect(screen.getByTestId('record')).toBeTruthy();
    expect(fx.form.gecko.id).toBe('g1');
    expect(fx.form.currentUser).toBe(OWNER);
    await waitFor(() => expect(fx.form.userGeckos.map((g) => g.id)).toEqual(['g1', 'g2']));

    act(() => fx.form.onCancel());
    expect(screen.queryByTestId('long-form')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe('/GeckoDetail?id=g1');
    expect(screen.getByTestId('record').textContent).toContain('Record of Nimbus');
  });

  it('uses the copy of the collection My Geckos already holds', async () => {
    const user = userEvent.setup();
    fx.cached = { geckos: [NIMBUS, SPUD] };
    await showPage();
    await user.click(screen.getByRole('button', { name: 'Edit Nimbus' }));
    await screen.findByTestId('long-form');
    expect(fx.form.userGeckos).toBe(fx.cached.geckos);
    expect(fx.loads).toBe(0);
  });

  it('saving stays on the record, shows what was saved, reloads it and marks My Geckos stale', async () => {
    const user = userEvent.setup();
    await showPage();
    await user.click(screen.getByRole('button', { name: 'Edit Nimbus' }));
    await screen.findByTestId('long-form');
    const getsBefore = fx.gets;

    // What save_gecko_record returns, and what the next read returns.
    fx.gecko = { ...NIMBUS, name: 'Nimbus II', weight_grams: 41 };
    await act(async () => { await fx.form.onSubmit({ ...NIMBUS, name: 'Nimbus II' }, false); });

    expect(screen.queryByTestId('long-form')).toBeNull();
    expect(screen.getByTestId('where').textContent).toBe('/GeckoDetail?id=g1');
    expect(screen.getByTestId('record').textContent).toContain('Record of Nimbus II');
    expect(fx.gets).toBe(getsBefore + 1);
    expect(fx.invalidated).toContainEqual(['my-geckos']);
    expect(fx.toasts.at(-1).title).toBe('Nimbus II saved');
  });
});
