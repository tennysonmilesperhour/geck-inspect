// @vitest-environment jsdom
// GeckoForm smoke test (plan item E3 30). GeckoForm performs the atomic
// gecko save (save_gecko_record) and had no test. The real form renders
// in jsdom; saving a new gecko sends one save with what the member typed;
// a refused save keeps the form and says why. Only the network edges are
// stubbed (Supabase, the entity layer, notifications, analytics).
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  mergeGeckoSalePrices: async (rows) => rows,
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
    expect(screen.getByRole('button', { name: 'Add gecko' })).toBeTruthy();
    // A new gecko gets an ID code before the member types anything.
    await vi.waitFor(() => expect(screen.getByLabelText('ID code').value).not.toBe(''));
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
    await user.type(screen.getByLabelText('Current weight (grams)'), '18.5');
    await user.type(screen.getByLabelText('Anything else about its look (optional)'), 'Lilly White Harlequin');
    // A double tap while the save is in flight must not send a second one.
    await user.dblClick(screen.getByRole('button', { name: 'Add gecko' }));
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
    await user.click(screen.getByRole('button', { name: 'Add gecko' }));

    const title = await screen.findByText('Gecko could not be saved');
    const toast = title.closest('li') || document.body;
    expect(within(toast).getByText('Your plan holds 10 geckos. Upgrade to add more.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    // What the member typed is still there and they can try again.
    expect(name.value).toBe('Mango');
    expect(screen.getByRole('button', { name: 'Add gecko' }).hasAttribute('disabled')).toBe(false);
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
    await user.click(screen.getByRole('button', { name: 'Update gecko' }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [, args] = fx.rpc.mock.calls[0];
    expect(args.p_gecko_id).toBe('g-7');
    // The weight did not change, so no new weigh-in row is written.
    expect(args.p_record_weight).toBe(false);
    expect(args.p_record).toMatchObject({ name: 'Pumpkin Spice', gecko_id_code: 'SAM-007' });
    expect(onSubmit.mock.calls[0][1]).toBe(false);
  });

  // Experience review D3: a tap outside the form, Escape or Cancel used to
  // throw away everything typed and every photo uploaded without asking.
  it('closes an untouched form at once, and asks before discarding a changed one', async () => {
    const untouched = renderForm();
    await screen.findByLabelText(/^Name/);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(untouched.onCancel).toHaveBeenCalledTimes(1);
    cleanup();

    const changed = renderForm();
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Mango' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(changed.onCancel).not.toHaveBeenCalled();
    expect(await screen.findByText('Discard your changes?')).toBeTruthy();

    // Keep editing: the form and what was typed are still there.
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(changed.onCancel).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Name/).value).toBe('Mango');

    // Discard: now it closes.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(changed.onCancel).toHaveBeenCalledTimes(1);
  });

  // Experience review WP-3 (D2, D4): six headed sections with photos
  // first, one Morph group, and no species choice (crested geckos only).
  it('groups the fields under six headings with photos first, one Morph group and no species choice', async () => {
    renderForm();
    await screen.findByLabelText('Name *');
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent.trim());
    expect(headings).toEqual(['Photos', 'Identity', 'Parents', 'Morph and quality', 'Selling and visibility', 'Care and notes']);

    expect(screen.getAllByRole('group', { name: 'Morph' })).toHaveLength(1);
    expect(screen.getByLabelText('Search morphs')).toBeTruthy();
    expect(screen.getByLabelText('Anything else about its look (optional)')).toBeTruthy();
    expect(screen.queryByText(/Morph ID Tags/)).toBeNull();
    expect(screen.queryByLabelText('Species')).toBeNull();
    expect(screen.queryByText('Species')).toBeNull();

    // The catalogue stays folded until the member asks for it.
    expect(screen.queryByRole('button', { name: 'Harlequin' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Browse all/ }));
    expect(screen.getByRole('button', { name: 'Harlequin' })).toBeTruthy();
  });

  it('folding a section is not a change, and what was typed in it is kept', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderForm();
    await screen.findByLabelText('Name *');
    const parents = screen.getByRole('button', { name: /^Parents/ });
    expect(parents.getAttribute('aria-expanded')).toBe('true');
    await user.click(parents);
    expect(parents.getAttribute('aria-expanded')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('adds morph tags from the search box as chips, and sends the rest to the free-text line', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(await screen.findByLabelText('Name *'), 'Mango');
    const search = screen.getByLabelText('Search morphs');
    // A common misspelling still finds the tag.
    await user.type(search, 'lily');
    await user.click(within(screen.getByRole('group', { name: 'Matching morphs' })).getByRole('button', { name: 'Lilly White' }));
    expect(search.value).toBe('');
    // Enter picks the first match and never submits the form.
    await user.type(search, 'harleq{Enter}');
    expect(fx.rpc).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remove Lilly White' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Harlequin' })).toBeTruthy();
    // Not in the list: it goes to the free-text line under the tags.
    await user.type(search, 'tangerine dorsal');
    await user.click(screen.getByRole('button', { name: /tangerine dorsal.* to the line below/ }));
    expect(screen.getByLabelText('Anything else about its look (optional)').value).toBe('tangerine dorsal');

    await user.click(screen.getByRole('button', { name: 'Remove Harlequin' }));
    await user.click(screen.getByRole('button', { name: 'Add gecko' }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(fx.rpc.mock.calls[0][1].p_record).toMatchObject({
      morph_tags: ['Lilly White'],
      morphs_traits: 'tangerine dorsal',
      species: 'Crested Gecko',
    });
  });

  // The two morph columns are read all over the app, so an edit that does
  // not touch them must send them back exactly as they were.
  it('sends back the morph text, the tags and the species an untouched gecko already had', async () => {
    const user = userEvent.setup();
    const existing = {
      id: 'g-9',
      name: 'Biscuit',
      gecko_id_code: 'SAM-009',
      sex: 'Male',
      created_by: MEMBER.email,
      image_urls: [],
      morphs_traits: 'Lilly White Harlequin,\ncream dorsal',
      morph_tags: ['Lilly White', 'Harlequin', 'Het Axanthic'],
      // A record from before the app was crested geckos only keeps the
      // species it has, though the form no longer offers the choice.
      species: 'Gargoyle Gecko',
    };
    const { onSubmit } = renderForm({ gecko: existing });
    await vi.waitFor(() => expect(screen.getByLabelText('Name *').value).toBe('Biscuit'));
    expect(screen.getByLabelText('Anything else about its look (optional)').value).toBe(existing.morphs_traits);
    await user.click(screen.getByRole('button', { name: 'Update gecko' }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const record = fx.rpc.mock.calls[0][1].p_record;
    expect(record.morphs_traits).toBe(existing.morphs_traits);
    expect(record.morph_tags).toEqual(existing.morph_tags);
    expect(record.species).toBe('Gargoyle Gecko');
  });

  // Experience review D7.
  it('fills the three hatch date boxes from one pasted date and saves it', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(await screen.findByLabelText('Name *'), 'Mango');
    const year = screen.getByLabelText('Hatch year');
    await user.click(year);
    await user.paste('24 Feb 2026');
    expect(year.value).toBe('2026');
    expect(screen.getByLabelText('Hatch day').value).toBe('24');
    expect(screen.getByText('Hatched February 24, 2026.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add gecko' }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(fx.rpc.mock.calls[0][1].p_record.hatch_date).toBe('2026-02-24');
  });

  it('still saves a gecko whose hatch date is unfinished, without inventing a day', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.type(await screen.findByLabelText('Name *'), 'Mango');
    await user.type(screen.getByLabelText('Hatch year'), '2025');
    expect(screen.getByText(/A hatch date is saved once all three are filled in/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add gecko' }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(fx.rpc.mock.calls[0][1].p_record.hatch_date).toBeNull();
  });

  // Experience review D3, second half: a draft that survives a closed tab.
  const draftKeys = () => Object.keys(window.localStorage).filter((key) => key.startsWith('geck_gecko_form_draft'));
  const offer = () => screen.queryByText('Pick up where you left off?');

  it('keeps an unsaved new gecko in the browser and offers it back the next time the form opens', async () => {
    const user = userEvent.setup();
    const first = renderForm();
    await user.type(await screen.findByLabelText('Name *'), 'Mango');
    await user.type(screen.getByLabelText('Anything else about its look (optional)'), 'cream dorsal');
    await user.type(screen.getByLabelText('Hatch year'), '2025');
    // The tab is closed or reloaded: the form goes with no save and no discard.
    cleanup();
    expect(first.onCancel).not.toHaveBeenCalled();
    expect(draftKeys()).toEqual(['geck_gecko_form_draft_v1:u1']);
    // Text and choices only, under the member's id, with no email in it.
    expect(window.localStorage.getItem(draftKeys()[0])).not.toContain(MEMBER.email);

    const { onSubmit } = renderForm();
    await screen.findByLabelText('Name *');
    expect(offer()).toBeTruthy();
    expect(screen.getByText('You were adding Mango.')).toBeTruthy();
    expect(screen.getByLabelText('Name *').value).toBe('');
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(screen.getByLabelText('Name *').value).toBe('Mango');
    expect(screen.getByLabelText('Anything else about its look (optional)').value).toBe('cream dorsal');
    expect(screen.getByLabelText('Hatch year').value).toBe('2025');
    expect(offer()).toBeNull();

    // A successful save clears it.
    await user.click(screen.getByRole('button', { name: 'Add gecko' }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(fx.rpc.mock.calls[0][1].p_record).toMatchObject({ name: 'Mango', morphs_traits: 'cream dorsal' });
    expect(draftKeys()).toEqual([]);
  });

  it('drops the kept draft on Start fresh and on Discard', async () => {
    renderForm();
    fireEvent.change(await screen.findByLabelText('Name *'), { target: { value: 'Mango' } });
    cleanup();
    expect(draftKeys()).toHaveLength(1);

    renderForm();
    await screen.findByLabelText('Name *');
    fireEvent.click(screen.getByRole('button', { name: 'Start fresh' }));
    expect(offer()).toBeNull();
    expect(draftKeys()).toEqual([]);

    // A new draft, then Cancel and Discard.
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Pip' } });
    expect(draftKeys()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(draftKeys()).toEqual([]);
    cleanup();

    renderForm();
    await screen.findByLabelText('Name *');
    expect(offer()).toBeNull();
  });

  it('opens with the draft already restored when asked to, and keeps no draft for a guest or an edit', async () => {
    renderForm();
    fireEvent.change(await screen.findByLabelText('Name *'), { target: { value: 'Mango' } });
    cleanup();

    // Quick Add's "Pick it up".
    renderForm({ restoreDraftOnOpen: true });
    await vi.waitFor(() => expect(screen.getByLabelText('Name *').value).toBe('Mango'));
    expect(offer()).toBeNull();
    // The ID code generated for this form is kept alongside the draft.
    await vi.waitFor(() => expect(screen.getByLabelText('ID code').value).not.toBe(''));
    expect(screen.getByLabelText('Name *').value).toBe('Mango');
    cleanup();
    window.localStorage.clear();

    // The guest demo.
    renderForm({ currentUser: { id: '', email: 'guest@local', full_name: 'Guest', is_guest: true } });
    fireEvent.change(await screen.findByLabelText('Name *'), { target: { value: 'Demo' } });
    cleanup();
    expect(draftKeys()).toEqual([]);

    // Editing a saved gecko.
    renderForm({ gecko: { id: 'g-7', name: 'Pumpkin', created_by: MEMBER.email, image_urls: [] } });
    await vi.waitFor(() => expect(screen.getByLabelText('Name *').value).toBe('Pumpkin'));
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Pumpkin Spice' } });
    cleanup();
    expect(draftKeys()).toEqual([]);
  });

  it('treats what Quick Add handed over as unsaved work: it is kept, and closing asks first', async () => {
    const handed = { name: 'Mango', sex: 'Female', hatch_date: null, morphs_traits: 'Lilly White Harlequin', image_urls: [], weight_grams: null, species: 'Crested Gecko' };
    const { onCancel } = renderForm({ gecko: handed });
    await vi.waitFor(() => expect(screen.getByLabelText('Name *').value).toBe('Mango'));
    await vi.waitFor(() => expect(draftKeys()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(await screen.findByText('Discard your changes?')).toBeTruthy();
  });
});
