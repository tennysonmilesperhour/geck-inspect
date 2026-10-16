// @vitest-environment jsdom
// GeckoForm smoke test (plan item E3 30). GeckoForm performs the atomic
// gecko save (save_gecko_record) and had no test. The real form renders
// in jsdom; saving a new gecko sends one save with what the member typed;
// a refused save keeps the form and says why. Only the network edges are
// stubbed (Supabase, the entity layer, notifications, analytics).
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness, watchConsoleErrors } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({
  rpc: null,
  captureEvent: null,
  activity: null,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: (...args) => fx.rpc(...args) },
}));
vi.mock('@/entities/all', () => ({
  Gecko: { update: vi.fn(async (id, data) => ({ id, ...data })) },
  UserActivity: { create: (...args) => fx.activity(...args) },
  FeedingGroup: { list: async () => [] },
  Collection: { filter: async () => [] },
  CollectionMember: { filter: async () => [] },
}));
vi.mock('@/integrations/Core', () => ({ UploadFile: vi.fn() }));
vi.mock('@/components/notifications/NotificationService', () => ({
  notifyFollowersNewGecko: vi.fn(async () => {}),
  checkAndNotifyLevelUp: vi.fn(async () => {}),
}));
vi.mock('@/lib/posthog', () => ({ captureEvent: (...args) => fx.captureEvent(...args) }));

import GeckoForm from '@/components/my-geckos/GeckoForm';
import { Toaster } from '@/components/ui/toaster';

installDomHarness();

const MEMBER = { id: 'u1', email: 'keeper@example.com', full_name: 'Sam Keeper' };
// Stable across renders: the form regenerates the ID code when this changes.
const NO_GECKOS = [];
const NO_GROUPS = [];

function renderForm(props = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <MemoryRouter>
      <GeckoForm
        gecko={null}
        userGeckos={NO_GECKOS}
        currentUser={MEMBER}
        feedingGroups={NO_GROUPS}
        onSubmit={onSubmit}
        onCancel={onCancel}
        {...props}
      />
      <Toaster />
    </MemoryRouter>,
  );
  return { onSubmit, onCancel };
}

beforeEach(() => {
  fx.captureEvent = vi.fn();
  fx.activity = vi.fn(async () => ({}));
  fx.rpc = vi.fn(async (fn, args) => ({
    data: { id: 'g-new', ...args.p_record },
    error: null,
  }));
});

describe('GeckoForm', () => {
  it('renders the add form with a generated ID code, with no React warnings', async () => {
    const errors = watchConsoleErrors();
    renderForm();
    expect(await screen.findByLabelText('Name *')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add Gecko' })).toBeTruthy();
    // A new gecko gets an ID code before the member types anything.
    await vi.waitFor(() => expect(screen.getByLabelText('ID Code').value).not.toBe(''));
    expect(errors).toEqual([]);
  });

  it('saves a new gecko once, in one database call, with what the member typed', async () => {
    const user = userEvent.setup();
    // Hold the save open, the way a slow connection does.
    let finish;
    fx.rpc = vi.fn((fn, args) => new Promise((resolve) => {
      finish = () => resolve({ data: { id: 'g-new', ...args.p_record }, error: null });
    }));
    const { onSubmit } = renderForm();
    await user.type(await screen.findByLabelText('Name *'), '  Mango ');
    await user.type(screen.getByLabelText('Current Weight (grams)'), '18.5');
    await user.type(screen.getByLabelText('Morphs & Traits (Free Text)'), 'Lilly White Harlequin');
    // A double tap while the save is in flight must not send a second one.
    await user.dblClick(screen.getByRole('button', { name: 'Add Gecko' }));
    expect(fx.rpc).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving...' }).hasAttribute('disabled')).toBe(true);
    finish();

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(fx.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = fx.rpc.mock.calls[0];
    expect(fn).toBe('save_gecko_record');
    expect(args).toMatchObject({
      p_gecko_id: null,
      p_record_weight: true,
      p_record_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(typeof args.p_request_id).toBe('string');
    expect(args.p_record).toMatchObject({
      name: 'Mango',
      weight_grams: 18.5,
      morphs_traits: 'Lilly White Harlequin',
      species: 'Crested Gecko',
      sire_id: null,
      dam_id: null,
    });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ id: 'g-new', name: 'Mango' }), true);
    expect(fx.captureEvent).toHaveBeenCalledWith('animal_created', expect.objectContaining({ animal_id: 'g-new' }));
  });

  it('keeps the form and explains when the save is refused', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fx.rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'Your plan holds 10 geckos. Upgrade to add more.' },
    }));
    const { onSubmit } = renderForm();
    const name = await screen.findByLabelText('Name *');
    await user.type(name, 'Mango');
    await user.click(screen.getByRole('button', { name: 'Add Gecko' }));

    const title = await screen.findByText('Gecko could not be saved');
    const toast = title.closest('li') || document.body;
    expect(within(toast).getByText('Your plan holds 10 geckos. Upgrade to add more.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    // What the member typed is still there and they can try again.
    expect(name.value).toBe('Mango');
    expect(screen.getByRole('button', { name: 'Add Gecko' }).hasAttribute('disabled')).toBe(false);
  });

  it('updates an existing gecko in place rather than creating a new one', async () => {
    const user = userEvent.setup();
    const existing = {
      id: 'g-7',
      name: 'Pumpkin',
      gecko_id_code: 'SAM-007',
      sex: 'Female',
      weight_grams: 32,
      created_by: MEMBER.email,
      image_urls: [],
    };
    const { onSubmit } = renderForm({ gecko: existing });
    const name = await screen.findByLabelText('Name *');
    expect(name.value).toBe('Pumpkin');
    await user.clear(name);
    await user.type(name, 'Pumpkin Spice');
    await user.click(screen.getByRole('button', { name: 'Update Gecko' }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [, args] = fx.rpc.mock.calls[0];
    expect(args.p_gecko_id).toBe('g-7');
    // The weight did not change, so no new weigh-in row is written.
    expect(args.p_record_weight).toBe(false);
    expect(args.p_record).toMatchObject({ name: 'Pumpkin Spice', gecko_id_code: 'SAM-007' });
    expect(onSubmit.mock.calls[0][1]).toBe(false);
  });
});
