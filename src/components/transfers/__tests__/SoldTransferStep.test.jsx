import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The step after "Archive as sold": "Send Mango to the buyer", then the
// usual transfer form with the sale price carried over. The database is
// faked at the edges (the gecko save, the read of a link already sent and
// the create_transfer call), so the test sees what was read and written.
const state = vi.hoisted(() => ({ writes: [], reads: [], events: [], pending: [], pendingError: null, hold: null }));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, onOpenChange, children }) => (open ? <div data-dialog onKeyDown={() => onOpenChange?.(false)}>{children}</div> : null),
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogFooter: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogDescription: ({ children }) => <p>{children}</p>,
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, type, 'aria-label': label }) => (
    <button type={type || 'button'} onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>
  ),
}));
vi.mock('@/components/ui/input', () => ({ Input: (props) => <input {...props} /> }));
vi.mock('@/components/ui/label', () => ({ Label: ({ children, htmlFor }) => <label htmlFor={htmlFor}>{children}</label> }));
vi.mock('@/components/ui/textarea', () => ({ Textarea: (props) => <textarea {...props} /> }));
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
    from: (table) => {
      const filters = {};
      const chain = {
        select: () => chain,
        eq: (column, value) => { filters[column] = value; return chain; },
        gt: (column, value) => { filters[`${column}>`] = value; return chain; },
        order: () => chain,
        limit: () => chain,
        then: (resolve, reject) => {
          state.reads.push([table, filters]);
          const answer = state.pendingError
            ? { data: null, error: state.pendingError }
            : { data: state.pending, error: null };
          return (state.hold || Promise.resolve()).then(() => answer).then(resolve, reject);
        },
      };
      return chain;
    },
    rpc: vi.fn(async (name, args) => {
      state.writes.push([name, args]);
      return { data: { id: 't1', token: 'opaque-token', expires_at: '2026-10-31T02:00:00Z', claim_mode: 'link' }, error: null };
    }),
    functions: { invoke: vi.fn(async () => ({ data: { delivered: 1 }, error: null })) },
  },
}));

const { default: SoldTransferStep } = await import('../SoldTransferStep');

const MANGO = {
  id: 'g1',
  name: 'Mango',
  created_by: 'seller@example.com',
  morphs_traits: 'Lilly White Harlequin',
  archived: true,
  archive_reason: 'sold',
  status: 'Sold',
  sold_price: 300,
  asking_price: 450,
  passport_code: null,
  is_public: false,
};

// The link the seller emailed Riley on 27 October, still open.
const EMAILED = {
  id: 't0',
  token: 'earlier-token',
  to_email: 'riley@example.com',
  claim_mode: 'email',
  status: 'pending',
  created_date: '2026-10-27T15:00:00Z',
  expires_at: '2026-10-30T15:00:00Z',
};

const innerText = (node) => (typeof node === 'string' ? node : (node?.children || []).map(innerText).join(''));
const textOf = (tree) => innerText({ children: [].concat(tree.toJSON() || []) });
const button = (tree, text) => tree.root.find((n) => n.type === 'button' && innerText(n).includes(text));
const hasButton = (tree, text) => tree.root.findAll((n) => n.type === 'button' && innerText(n).includes(text)).length > 0;
const byId = (tree, id) => tree.root.find((n) => n.type === 'input' && n.props.id === id);
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

async function mount(gecko = MANGO) {
  const onClose = vi.fn();
  let tree;
  await act(async () => {
    tree = create(<SoldTransferStep gecko={gecko} onClose={onClose} />);
  });
  await settle();
  return { tree, onClose };
}

async function submitTransfer(tree) {
  const form = tree.root.find((n) => n.type === 'form');
  await act(async () => { await form.props.onSubmit({ preventDefault() {} }); });
}

beforeEach(() => {
  state.writes.length = 0;
  state.reads.length = 0;
  state.events.length = 0;
  state.pending = [];
  state.pendingError = null;
  state.hold = null;
});

describe('Send the gecko to the buyer, after Archive as sold', () => {
  it('offers the transfer by name and never offers to make the gecko public', async () => {
    const { tree } = await mount();
    const text = textOf(tree);
    expect(text).toContain('Send Mango to the buyer');
    expect(text).toContain('The sale price ($300) goes on the transfer');
    // The step sends a transfer only: no passport, no Public display.
    expect(text).not.toMatch(/passport/i);
    expect(text).not.toMatch(/public/i);
    // It first checked for a link already sent for Mango, and wrote nothing.
    expect(state.reads).toEqual([['transfer_requests', expect.objectContaining({
      from_user_id: 'u1', animal_id: 'g1', animal_type: 'gecko', status: 'pending',
    })]]);
    expect(state.writes).toEqual([]);
    expect(state.events).toEqual([['sold_transfer_step', { action: 'shown', has_passport: false, has_price: true, has_pending: false }]]);
  });

  it('shows nothing until the check for a link already sent has answered', async () => {
    let release;
    state.hold = new Promise((resolve) => { release = resolve; });
    const onClose = vi.fn();
    let tree;
    await act(async () => { tree = create(<SoldTransferStep gecko={MANGO} onClose={onClose} />); });
    expect(tree.toJSON()).toBeNull();
    expect(state.events).toEqual([]);
    await act(async () => { release(); });
    await settle();
    expect(textOf(tree)).toContain('Send Mango to the buyer');
  });

  it('can be skipped in one tap, changing nothing', async () => {
    const { tree, onClose } = await mount();
    await act(async () => { button(tree, 'Not now').props.onClick(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(state.writes).toEqual([]);
    expect(state.events.at(-1)).toEqual(['sold_transfer_step', { action: 'skipped', has_passport: false, has_price: true, has_pending: false }]);
  });

  it('opens the transfer form with the sale price and sends the transfer only, leaving the gecko private', async () => {
    const { tree } = await mount();
    await act(async () => { button(tree, 'Send to the buyer').props.onClick(); });

    const text = textOf(tree);
    expect(text).toContain('Transfer Mango');
    // The sold price, not the asking price.
    expect(byId(tree, 'transfer-price').props.value).toBe('300');
    expect(text).not.toMatch(/public/i);
    expect(tree.root.findAll((n) => n.props?.['data-transfer-notice'])).toHaveLength(0);
    expect(state.writes).toEqual([]);

    await submitTransfer(tree);

    // Only the transfer: no passport and no change to the gecko, so Mango
    // stays private. create_transfer works on a private gecko.
    expect(state.writes.map(([what]) => what)).toEqual(['create_transfer']);
    expect(state.writes[0][1]).toMatchObject({ p_animal_id: 'g1', p_animal_type: 'gecko', p_to_email: null, p_sale_price: 300 });
    expect(textOf(tree)).toContain('Transfer started');

    // The funnel stays honest: no passport_created from this step.
    const names = state.events.map(([name]) => name);
    expect(names).toEqual(['sold_transfer_step', 'sold_transfer_step', 'transfer_started']);
    expect(state.events[1][1]).toEqual({ action: 'send', has_passport: false, has_price: true, has_pending: false });
    expect(state.events[2][1]).toEqual({ method: 'link', has_price: true, animal_type: 'gecko', surface: 'sold_step' });
    // No personal data in any event: no email, gecko name, code or price.
    expect(JSON.stringify(state.events)).not.toMatch(/seller|example|Mango|GI-|300|opaque/);
  });

  it('closing the transfer form without sending leaves the gecko as it was', async () => {
    const { tree, onClose } = await mount();
    await act(async () => { button(tree, 'Send to the buyer').props.onClick(); });
    await act(async () => { button(tree, 'Cancel').props.onClick(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(state.writes).toEqual([]);
  });

  it('says plainly that a new link replaces the one already emailed, and lets the seller keep it', async () => {
    state.pending = [EMAILED];
    const { tree, onClose } = await mount();
    const text = textOf(tree);
    expect(text).toContain('You already emailed riley@example.com a transfer link for Mango on October 27.');
    expect(text).toContain('A new link replaces it, and the one you sent stops working.');
    expect(hasButton(tree, 'Keep the link I sent')).toBe(true);
    expect(hasButton(tree, 'Send a new link')).toBe(true);
    expect(state.events).toEqual([['sold_transfer_step', { action: 'shown', has_passport: false, has_price: true, has_pending: true }]]);

    // Keeping it shows that same link again, and cancels nothing.
    await act(async () => { button(tree, 'Keep the link I sent').props.onClick(); });
    const kept = textOf(tree);
    expect(kept).toContain('Only riley@example.com can accept it.');
    expect(tree.root.find((n) => n.type === 'svg' && n.props['data-qr']).props['data-qr']).toMatch(/\/claim\/earlier-token$/);
    expect(byId(tree, 'sold-step-existing-link').props.value).toMatch(/\/claim\/earlier-token$/);
    expect(state.writes).toEqual([]);
    expect(state.events.at(-1)).toEqual(['sold_transfer_step', { action: 'kept_existing', has_passport: false, has_price: true, has_pending: true }]);

    await act(async () => { button(tree, 'Done').props.onClick(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(state.writes).toEqual([]);
  });

  it('repeats the warning in the transfer form when the seller sends a new link anyway', async () => {
    state.pending = [EMAILED];
    const { tree } = await mount();
    await act(async () => { button(tree, 'Send a new link').props.onClick(); });
    const notice = tree.root.find((n) => n.props?.['data-transfer-notice']);
    expect(innerText(notice)).toBe('This replaces the link you sent on October 27. That link stops working.');
    await submitTransfer(tree);
    expect(state.writes.map(([what]) => what)).toEqual(['create_transfer']);
    expect(state.events.map(([name, props]) => props.action || name)).toEqual(['shown', 'send', 'transfer_started']);
  });

  it('names a QR link the same way', async () => {
    state.pending = [{ ...EMAILED, to_email: '', claim_mode: 'link' }];
    const { tree } = await mount();
    expect(textOf(tree)).toContain('You already made a QR transfer link for Mango on October 27.');
    await act(async () => { button(tree, 'Keep the link I sent').props.onClick(); });
    expect(textOf(tree)).toContain('Share it only with the new owner.');
  });

  it('says a new link replaces any earlier one when the check could not be made', async () => {
    state.pendingError = { message: 'network down' };
    const { tree } = await mount();
    expect(textOf(tree)).toContain('If you already sent a transfer link for Mango, a new one replaces it and the old link stops working.');
    expect(state.events).toEqual([['sold_transfer_step', { action: 'shown', has_passport: false, has_price: true, has_pending: null }]]);
    await act(async () => { button(tree, 'Send to the buyer').props.onClick(); });
    await submitTransfer(tree);
    expect(state.writes.map(([what]) => what)).toEqual(['create_transfer']);
  });

  it('treats a sale price of 0 as no price: no "$0" line and no $0 sale on the transfer', async () => {
    const { tree } = await mount({ ...MANGO, sold_price: 0 });
    expect(textOf(tree)).not.toContain('$0');
    expect(textOf(tree)).not.toContain('sale price');
    expect(state.events[0][1]).toMatchObject({ has_price: false });
    await act(async () => { button(tree, 'Send to the buyer').props.onClick(); });
    // Not the asking price either: Mango was given away.
    expect(byId(tree, 'transfer-price').props.value).toBe('');
    await submitTransfer(tree);
    expect(state.writes[0][1]).toMatchObject({ p_sale_price: null });
  });

  it('keeps an existing passport and visibility as they are', async () => {
    const { tree } = await mount({ ...MANGO, passport_code: 'GI-2026-ABCD', sold_price: null });
    const text = textOf(tree);
    expect(text).not.toContain('sale price');
    await act(async () => { button(tree, 'Send to the buyer').props.onClick(); });
    // No sold price: the asking price stands in, as on the record.
    expect(byId(tree, 'transfer-price').props.value).toBe('450');
    await submitTransfer(tree);
    expect(state.writes.map(([what]) => what)).toEqual(['create_transfer']);
  });
});
