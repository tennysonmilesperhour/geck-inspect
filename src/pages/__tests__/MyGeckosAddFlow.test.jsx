// @vitest-environment jsdom
// How My Geckos opens its add and edit forms (experience review WP-3).
//
// D1: "Add Gecko" opens Quick Add for a collection of any size; the long
// form is behind Quick Add's "More details". An empty collection still
// gets the guided first gecko, the plan limit is still checked first, and
// editing still opens the long form. D6: an edit begun on a gecko's record
// window goes back to that record.
//
// The page is real. Quick Add, the long form and the record window are
// stand-ins that show what the page handed them; each has its own test.
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ user: null, geckos: [], quickAdd: null, form: null }));

vi.mock('@/api/appClient', () => ({ api: { auth: { me: async () => fx.user } } }));
vi.mock('@/entities/all', () => ({
  Gecko: { update: vi.fn(), delete: vi.fn() },
  FeedingGroup: { list: async () => [] },
  CollectionMember: { filter: async () => [] },
}));
vi.mock('@/lib/geckoAccess', () => ({
  getVisibleGeckos: async () => fx.geckos.map((g) => ({ ...g })),
  canWriteGecko: () => true,
  canDeleteGecko: () => true,
}));
vi.mock('@/lib/recentWeights', () => ({ loadRecentWeights: async () => [] }));
vi.mock('@/lib/layoutCache', () => ({ retryApiCall: (fn) => fn() }));
vi.mock('@/lib/posthog', () => ({ captureEvent: () => {} }));
vi.mock('@/lib/activation', () => ({ recordGeckoAdded: () => {} }));
vi.mock('@/lib/exportUtils', () => ({ exportGeckosCSV: vi.fn(), exportGeckosPDF: vi.fn() }));
vi.mock('@/lib/transfers', () => ({ shouldOfferSoldTransfer: () => false }));
vi.mock('@/hooks/usePageSettings', () => ({ default: (key, defaults) => [defaults, () => {}] }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  motion: { div: ({ children }) => <div>{children}</div> },
}));
vi.mock('@/components/gecko/record/loadOnDemand', () => ({ lazyOptional: () => () => null }));
vi.mock('@/components/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/shared/GeckoImage', () => ({ default: () => null }));
vi.mock('@/components/bulk/GeckoBulkActions', () => ({ default: () => null }));
vi.mock('@/components/ui/PageSettingsPanel', () => ({ default: () => null }));
vi.mock('@/components/my-geckos/WeighInMode', () => ({ default: () => null }));
vi.mock('@/components/my-geckos/CSVImportModal', () => ({ default: () => null }));
vi.mock('@/components/my-geckos/TransferHistory', () => ({ default: () => null }));
vi.mock('@/components/my-geckos/GeckoFilters', () => ({ default: () => null }));
vi.mock('@/components/my-geckos/ArchiveReasonDialog', () => ({ default: () => null }));
vi.mock('@/components/my-geckos/quickGeckoSave', () => ({ saveQuickGecko: vi.fn() }));
vi.mock('@/components/onboarding/FirstGeckoFlow', () => ({ default: () => null }));
vi.mock('@/components/onboarding/RoleQuestion', () => ({ default: () => null, useRoleQuestion: () => ({}) }));
vi.mock('@/components/onboarding/FirstGeckoStarter', () => ({
  default: ({ onStart }) => <button type="button" onClick={onStart}>Type the first gecko</button>,
}));
vi.mock('@/components/subscription/PlanLimitChecker', () => ({
  default: ({ isOpen }) => (isOpen ? <p>Plan limit reached</p> : null),
}));
vi.mock('@/components/my-geckos/GeckoCard', () => ({
  default: ({ gecko, onView }) => <button type="button" onClick={() => onView(gecko)}>View {gecko.name}</button>,
}));
vi.mock('@/components/my-geckos/GeckoDetailModal', () => ({
  default: ({ gecko, onEdit }) => (
    <div data-testid="record">
      Record of {gecko.name}
      <button type="button" onClick={() => onEdit(gecko)}>Edit on the record</button>
    </div>
  ),
}));
vi.mock('@/components/my-geckos/QuickAddGecko', () => ({
  default: (props) => {
    fx.quickAdd = props;
    return <div data-testid="quick-add">Quick Add</div>;
  },
}));
vi.mock('@/components/my-geckos/GeckoForm', () => ({
  default: (props) => {
    fx.form = props;
    return <div data-testid="long-form">Long form for {props.gecko?.name || 'a new gecko'}</div>;
  },
}));

import MyGeckosPage from '@/pages/MyGeckos';

installDomHarness();

const MEMBER = { id: 'u1', email: 'keeper@example.com', full_name: 'Sam Keeper', membership_tier: 'free' };
const MANGO = { id: 'g-mango', name: 'Mango', sex: 'Female', status: 'Pet', created_by: MEMBER.email, archived: false, image_urls: [], morphs_traits: 'Lilly White Harlequin' };

function showPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/MyGeckos']}>
        <MyGeckosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const addGecko = () => screen.getByRole('button', { name: 'Add Gecko' });

beforeEach(() => {
  fx.user = MEMBER;
  fx.geckos = [MANGO];
  fx.quickAdd = null;
  fx.form = null;
});

describe('My Geckos: adding and editing', () => {
  it('opens Quick Add, not the long form, for a collection that already has geckos', async () => {
    const user = userEvent.setup();
    showPage();
    await screen.findByRole('button', { name: 'View Mango' });
    await user.click(addGecko());

    expect(screen.getByTestId('quick-add')).toBeTruthy();
    expect(screen.queryByTestId('long-form')).toBeNull();
    // Plain Quick Add: no guided steps, so it saves and shows its own
    // success screen. It knows the collection, so it reads "Add a gecko".
    expect(fx.quickAdd).toMatchObject({ open: true, guest: false, offerPhotoChoice: false, stepLabel: null, initialDraft: null });
    expect(fx.quickAdd.onContinue).toBeUndefined();
    expect(fx.quickAdd.existingGeckos.map((g) => g.id)).toEqual(['g-mango']);
  });

  it('hands "More details" to the long form with what was typed, and the draft stays in it', async () => {
    const user = userEvent.setup();
    showPage();
    await screen.findByRole('button', { name: 'View Mango' });
    await user.click(addGecko());
    const draft = { name: 'Pip', sex: 'Unsexed', morphs_traits: 'Harlequin', image_urls: [], species: 'Crested Gecko' };
    act(() => fx.quickAdd.onMoreDetails(draft));

    expect(screen.queryByTestId('quick-add')).toBeNull();
    // The draft has no id and is not in the list; it used to be cleared a
    // moment after the form opened, which left the form empty.
    await waitFor(() => expect(screen.getByTestId('long-form').textContent).toBe('Long form for Pip'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(fx.form.gecko).toBe(draft);
    expect(fx.form.restoreDraftOnOpen).toBe(false);
  });

  it('opens the long form on the kept draft when Quick Add says "Pick it up"', async () => {
    const user = userEvent.setup();
    showPage();
    await screen.findByRole('button', { name: 'View Mango' });
    await user.click(addGecko());
    act(() => fx.quickAdd.onResumeDraft());

    expect(screen.getByTestId('long-form').textContent).toBe('Long form for a new gecko');
    expect(fx.form.gecko).toBeNull();
    expect(fx.form.restoreDraftOnOpen).toBe(true);
  });

  it('keeps the guided first gecko for an empty collection', async () => {
    const user = userEvent.setup();
    fx.geckos = [];
    showPage();
    await user.click(await screen.findByRole('button', { name: 'Type the first gecko' }));

    expect(screen.getByTestId('quick-add')).toBeTruthy();
    expect(fx.quickAdd).toMatchObject({ stepLabel: 'Step 1 of 3', offerPhotoChoice: false });
    expect(typeof fx.quickAdd.onContinue).toBe('function');
  });

  it('checks the plan limit before opening anything', async () => {
    const user = userEvent.setup();
    // Free holds 10 active geckos.
    fx.geckos = Array.from({ length: 10 }, (_, i) => ({ ...MANGO, id: `g-${i}`, name: `Gecko ${i}` }));
    showPage();
    await screen.findByRole('button', { name: 'View Gecko 0' });
    await user.click(addGecko());

    expect(screen.getByText('Plan limit reached')).toBeTruthy();
    expect(screen.queryByTestId('quick-add')).toBeNull();
    expect(screen.queryByTestId('long-form')).toBeNull();
  });

  it('opens the long form to edit, and goes back to the record the edit started from', async () => {
    const user = userEvent.setup();
    showPage();
    await user.click(await screen.findByRole('button', { name: 'View Mango' }));
    expect(screen.getByTestId('record').textContent).toContain('Record of Mango');
    await user.click(screen.getByRole('button', { name: 'Edit on the record' }));

    expect(screen.getByTestId('long-form').textContent).toBe('Long form for Mango');
    expect(screen.queryByTestId('record')).toBeNull();
    expect(screen.queryByTestId('quick-add')).toBeNull();

    // Cancel: back on the record.
    act(() => fx.form.onCancel());
    expect(screen.queryByTestId('long-form')).toBeNull();
    expect(screen.getByTestId('record').textContent).toContain('Record of Mango');

    // Save: back on the record, showing what was saved.
    await user.click(screen.getByRole('button', { name: 'Edit on the record' }));
    fx.geckos = [{ ...MANGO, name: 'Mango II' }];
    await act(async () => { await fx.form.onSubmit({ ...MANGO, name: 'Mango II' }, false); });
    expect(screen.queryByTestId('long-form')).toBeNull();
    expect(screen.getByTestId('record').textContent).toContain('Record of Mango II');
  });
});
