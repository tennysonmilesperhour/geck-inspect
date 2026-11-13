// @vitest-environment jsdom
// Sell and hand over on one sheet (experience review, section 8 item 2):
// sale price and date, then the transfer to the buyer. Each step saves by
// itself, each can be skipped, and closing early keeps what was saved.
// The sheet offers no passport: making one makes the gecko public, and
// other members can read a public gecko's sold price. The database is
// faked at the edges, so the test sees every write.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const state = vi.hoisted(() => ({ writes: [], events: [], pending: [] }));

vi.mock('qrcode.react', () => ({ QRCodeSVG: ({ value }) => <svg data-qr={value} /> }));
vi.mock('@/lib/posthog', () => ({ captureEvent: (name, props) => state.events.push([name, props]) }));
vi.mock('@/entities/all', () => ({
  Gecko: {
    update: vi.fn(async (id, fields) => {
      state.writes.push(['gecko', id, fields]);
      return { id, ...fields };
    }),
  },
}));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'seller@example.com' } } }) },
    // The seller's own pending link for the gecko (findPendingTransfer).
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        gt: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (resolve, reject) => Promise.resolve({ data: state.pending, error: null }).then(resolve, reject),
      };
      return chain;
    },
    rpc: vi.fn(async (name, args) => {
      state.writes.push([name, args]);
      return { data: { id: 't1', token: 'opaque-token', expires_at: '2026-11-16T02:00:00Z', claim_mode: 'link' }, error: null };
    }),
    functions: { invoke: vi.fn(async () => ({ data: { delivered: 1 }, error: null })) },
  },
}));

import SellHandoverSheet, { OFFER_PASSPORT_AT_SALE } from '../SellHandoverSheet';
import { todayLocalISO } from '@/lib/dateUtils';

installDomHarness();

const MANGO = {
  id: 'g1',
  name: 'Mango',
  created_by: 'seller@example.com',
  morphs_traits: 'Lilly White Harlequin',
  status: 'For Sale',
  asking_price: 450,
  passport_code: null,
  is_public: false,
};
const SOLD = { ...MANGO, archived: true, archive_reason: 'sold', status: 'Sold', sold_price: 300 };

// What My Geckos does on "Archive as sold": save, and hand back the gecko.
const saveSale = () => vi.fn(async (fields) => {
  state.writes.push(['sale', fields]);
  return { ...MANGO, archived: true, archive_reason: 'sold', status: 'Sold', ...fields };
});

function mount(props = {}) {
  const onClose = vi.fn();
  const onSaveSale = props.onSaveSale || saveSale();
  const onChanged = vi.fn();
  render(<SellHandoverSheet gecko={MANGO} onSaveSale={onSaveSale} onChanged={onChanged} onClose={onClose} {...props} />);
  return { onClose, onSaveSale, onChanged };
}

const sheet = () => screen.getByRole('dialog', { name: 'Sell and hand over Mango' });
const stepStates = () => [...sheet().querySelectorAll('[data-sell-step-state]')].map((li) => li.getAttribute('data-sell-step-state'));
const currentStep = () => sheet().querySelector('[aria-current="step"]').textContent;
const panel = (id) => sheet().querySelector(`[data-sell-step="${id}"]`);
const click = (name) => fireEvent.click(within(sheet()).getByRole('button', { name }));

beforeEach(() => {
  state.writes.length = 0;
  state.events.length = 0;
  state.pending = [];
});

describe('the sold sheet', () => {
  it('goes through the two steps in order, saving at each one', async () => {
    const { onClose, onSaveSale, onChanged } = mount();

    // Step 1: sale price and date.
    expect(currentStep()).toContain('Sale price and date');
    expect(stepStates()).toEqual(['todo', 'todo']);
    expect(sheet().textContent).toContain('Two short steps.');
    expect(panel('sale').textContent).toContain('Both are optional');
    // The asking price is offered as the sold price, and today as the date.
    expect(screen.getByLabelText('Sold for ($)').value).toBe('450');
    expect(screen.getByLabelText('Sale date').value).toBe(todayLocalISO());
    fireEvent.change(screen.getByLabelText('Sold for ($)'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Sale date'), { target: { value: '2026-11-12' } });
    expect(state.writes).toEqual([]);
    click('Archive as sold');

    // Step 2: the existing transfer step and form, inside the sheet.
    await waitFor(() => expect(panel('handover').textContent).toContain('Send Mango to the buyer'));
    expect(currentStep()).toContain('Hand it to the buyer');
    expect(onSaveSale).toHaveBeenCalledTimes(1);
    expect(state.writes).toEqual([['sale', { sold_price: 300, sale_category: null, archived_date: '2026-11-12' }]]);
    expect(stepStates()).toEqual(['done', 'todo']);
    expect(panel('handover').textContent).toContain('The sale price ($300) goes on the transfer');
    click('Send to the buyer');
    expect(panel('handover').textContent).toContain('Transfer Mango');
    expect(screen.getByLabelText('Sale price (optional)').value).toBe('300');
    // The form's own warnings are all still there.
    expect(panel('handover').textContent).toContain('Share it only with the new owner.');
    expect(panel('handover').textContent).toContain('Private gecko notes stay with you');
    expect(state.writes).toHaveLength(1);
    click('Create QR link');
    await waitFor(() => expect(panel('handover').textContent).toContain('Transfer started'));
    expect(state.writes[1]).toEqual(['create_transfer', expect.objectContaining({ p_animal_id: 'g1', p_animal_type: 'gecko', p_to_email: null, p_sale_price: 300 })]);
    // The sale and the transfer, and nothing else: the gecko is never
    // given a passport or made public.
    expect(state.writes).toHaveLength(2);
    expect(onChanged).not.toHaveBeenCalled();
    // The QR code and the link come from that one transfer.
    expect(panel('handover').querySelector('svg[data-qr]').getAttribute('data-qr')).toMatch(/\/claim\/opaque-token$/);
    expect(screen.getByLabelText('Claim link').value).toMatch(/\/claim\/opaque-token$/);
    expect(panel('handover').textContent).toContain('Keep this link private.');
    // One sheet throughout: no second dialog was opened on top.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();

    click('Done');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(state.events.map(([event, props]) => props.action || event)).toEqual(['shown', 'send', 'transfer_started']);
    expect(state.events[0][1]).toEqual({ action: 'shown', has_passport: false, has_price: true, has_pending: false });
    expect(state.events.at(-1)).toEqual(['transfer_started', { method: 'link', has_price: true, animal_type: 'gecko', surface: 'sold_step' }]);
  });

  it('never shows a passport step, offers one or makes one', async () => {
    expect(OFFER_PASSPORT_AT_SALE).toBe(false);
    // A gecko with no passport, start to finish.
    const first = mount();
    expect(sheet().querySelectorAll('[data-sell-step-state]')).toHaveLength(2);
    expect(sheet().textContent).not.toMatch(/passport|public/i);
    click('Archive as sold');
    await waitFor(() => expect(panel('handover').textContent).toContain('Send Mango to the buyer'));
    expect(panel('passport')).toBeNull();
    expect(sheet().querySelector('[data-sell-passport-warning]')).toBeNull();
    expect(within(sheet()).queryByRole('button', { name: /passport/i })).toBeNull();
    expect(sheet().textContent).not.toMatch(/passport|public/i);
    click('Not now');
    expect(first.onClose).toHaveBeenCalledTimes(1);
    // No write but the sale, and no passport_created from any surface.
    expect(state.writes.map(([what]) => what)).toEqual(['sale']);
    expect(state.events.map(([event]) => event)).not.toContain('passport_created');
    expect(JSON.stringify(state.events)).not.toContain('sold_sheet');
  });

  it('says nothing about a passport the gecko already has', async () => {
    mount({ gecko: { ...SOLD, passport_code: 'GI-2026-ABCD', is_public: true }, saleSaved: true });
    await waitFor(() => expect(panel('handover').textContent).toContain('Send Mango to the buyer'));
    expect(stepStates()).toEqual(['done', 'todo']);
    expect(sheet().textContent).not.toMatch(/passport|public|GI-2026-ABCD/i);
    expect(state.writes).toEqual([]);
  });

  it('saves a sale with no price: the price is optional', async () => {
    mount();
    fireEvent.change(screen.getByLabelText('Sold for ($)'), { target: { value: '' } });
    click('Archive as sold');
    await waitFor(() => expect(currentStep()).toContain('Hand it to the buyer'));
    expect(state.writes).toEqual([['sale', { sold_price: null, sale_category: null, archived_date: todayLocalISO() }]]);
  });

  it('opens on the hand-over after "Archive as sold", which can be skipped, changing nothing', async () => {
    const { onClose, onChanged } = mount({ gecko: SOLD, saleSaved: true });
    // The sale was saved in the archive dialog, so step 1 is done.
    expect(stepStates()).toEqual(['done', 'todo']);
    expect(currentStep()).toContain('Hand it to the buyer');
    await waitFor(() => expect(panel('handover').textContent).toContain('Send Mango to the buyer'));
    expect(panel('sale')).toBeNull();
    click('Not now');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChanged).not.toHaveBeenCalled();
    // No transfer, and nothing about the gecko changed.
    expect(state.writes).toEqual([]);
    expect(state.events.map(([event, props]) => props.action || event)).toEqual(['shown', 'skipped']);
  });

  it('can be closed after step 1 and keeps the sale, with nothing else changed', async () => {
    const { onClose, onSaveSale } = mount();
    click('Archive as sold');
    await waitFor(() => expect(panel('handover').textContent).toContain('Send Mango to the buyer'));
    fireEvent.keyDown(document.activeElement || sheet(), { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSaveSale).toHaveBeenCalledTimes(1);
    expect(state.writes.map(([what]) => what)).toEqual(['sale']);
  });

  it('can be closed in the middle of the hand-over, leaving no transfer', async () => {
    const { onClose } = mount({ gecko: SOLD, saleSaved: true });
    await waitFor(() => expect(panel('handover').textContent).toContain('Send Mango to the buyer'));
    click('Send to the buyer');
    expect(panel('handover').textContent).toContain('Transfer Mango');
    click('Close');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(state.writes).toEqual([]);
  });

  it('Cancel on step 1 saves nothing', () => {
    const { onClose, onSaveSale } = mount();
    click('Cancel');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaveSale).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });

  it('stays on step 1 and says so when the sale could not be saved', async () => {
    const { onClose } = mount({ onSaveSale: vi.fn(async () => null) });
    click('Archive as sold');
    await waitFor(() => expect(within(sheet()).getByRole('alert').textContent).toContain('The sale was not saved'));
    expect(currentStep()).toContain('Sale price and date');
    expect(stepStates()).toEqual(['todo', 'todo']);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('tells a collection editor that only the owner can hand the gecko over', async () => {
    const { onClose } = mount({ gecko: SOLD, saleSaved: true, canTransfer: false });
    expect(panel('handover').textContent).toContain("Only Mango's owner can hand it to a buyer.");
    expect(within(sheet()).queryByRole('button', { name: 'Send to the buyer' })).toBeNull();
    click('Done');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(state.writes).toEqual([]);
  });

  it('lets a guest see both steps and saves nothing', async () => {
    const { onClose, onSaveSale } = mount({ guest: true, canTransfer: false });
    expect(sheet().querySelector('[data-sell-guest]').textContent).toContain('nothing here is saved');
    expect(within(sheet()).queryByRole('button', { name: 'Archive as sold' })).toBeNull();
    click('Next');
    expect(currentStep()).toContain('Hand it to the buyer');
    expect(panel('handover').textContent).toContain('The buyer scans a QR code or opens a link');
    click('Done');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaveSale).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
    expect(state.events).toEqual([]);
  });
});
