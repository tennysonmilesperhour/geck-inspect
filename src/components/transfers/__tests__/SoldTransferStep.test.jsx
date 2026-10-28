import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The step after "Archive as sold": "Send Mango to the buyer", then the
// usual transfer form with the sale price carried over. The database is
// faked at the edges (the gecko save and the create_transfer call), so
// the test sees what was written and in which order.
const state = vi.hoisted(() => ({ writes: [], events: [], failPassport: false }));

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
      if (state.failPassport) throw new Error('duplicate key value violates unique constraint');
      state.writes.push(['gecko', id, fields]);
      return { id, ...fields };
    }),
  },
}));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'seller@example.com' } } }) },
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

const innerText = (node) => (typeof node === 'string' ? node : (node?.children || []).map(innerText).join(''));
const textOf = (tree) => innerText({ children: [].concat(tree.toJSON() || []) });
const button = (tree, text) => tree.root.find((n) => n.type === 'button' && innerText(n).includes(text));
const byId = (tree, id) => tree.root.find((n) => n.type === 'input' && n.props.id === id);

async function mount(gecko = MANGO) {
  const onClose = vi.fn();
  const onPassportMade = vi.fn();
  let tree;
  await act(async () => {
    tree = create(<SoldTransferStep gecko={gecko} onClose={onClose} onPassportMade={onPassportMade} />);
  });
  return { tree, onClose, onPassportMade };
}

async function submitTransfer(tree) {
  const form = tree.root.find((n) => n.type === 'form');
  await act(async () => { await form.props.onSubmit({ preventDefault() {} }); });
}

beforeEach(() => {
  state.writes.length = 0;
  state.events.length = 0;
  state.failPassport = false;
});

describe('Send the gecko to the buyer, after Archive as sold', () => {
  it('offers the transfer by name and says plainly that sending makes the passport public', async () => {
    const { tree } = await mount();
    const text = textOf(tree);
    expect(text).toContain('Send Mango to the buyer');
    expect(text).toContain('The sale price ($300) goes on the transfer');
    expect(text).toContain('Mango has no passport yet. Sending makes one and turns on Public display');
    expect(text).toContain('passport page');
    expect(text).toContain('is public');
    // Nothing is written just by showing the step.
    expect(state.writes).toEqual([]);
    expect(state.events).toEqual([['sold_transfer_step', { action: 'shown', has_passport: false, has_price: true }]]);
  });

  it('can be skipped in one tap, changing nothing', async () => {
    const { tree, onClose } = await mount();
    await act(async () => { button(tree, 'Not now').props.onClick(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(state.writes).toEqual([]);
    expect(state.events.at(-1)).toEqual(['sold_transfer_step', { action: 'skipped', has_passport: false, has_price: true }]);
  });

  it('opens the transfer form with the sale price, and makes the passport only when the transfer is sent', async () => {
    const { tree, onPassportMade } = await mount();
    await act(async () => { button(tree, 'Send to the buyer').props.onClick(); });

    const text = textOf(tree);
    expect(text).toContain('Transfer Mango');
    // The sold price, not the asking price.
    expect(byId(tree, 'transfer-price').props.value).toBe('300');
    expect(text).toContain('Sending makes Mango a passport and turns on Public display');
    // Opening the form writes nothing yet.
    expect(state.writes).toEqual([]);

    await submitTransfer(tree);

    // The passport first, then the transfer with the sale price.
    expect(state.writes.map(([what]) => what)).toEqual(['gecko', 'create_transfer']);
    const [, geckoId, fields] = state.writes[0];
    expect(geckoId).toBe('g1');
    expect(fields).toMatchObject({ is_public: true });
    expect(fields.passport_code).toMatch(/^GI-\d{4}-[A-Z2-9]{4}$/);
    expect(state.writes[1][1]).toMatchObject({ p_animal_id: 'g1', p_animal_type: 'gecko', p_to_email: null, p_sale_price: 300 });
    expect(onPassportMade).toHaveBeenCalledWith(fields);
    expect(textOf(tree)).toContain('Transfer started');

    const names = state.events.map(([name]) => name);
    expect(names).toEqual(['sold_transfer_step', 'sold_transfer_step', 'passport_created', 'transfer_started']);
    expect(state.events[2][1]).toEqual({ surface: 'sold_step', was_public: false });
    expect(state.events[3][1]).toEqual({ method: 'link', has_price: true, animal_type: 'gecko', surface: 'sold_step' });
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

  it('sends nothing when the passport cannot be made', async () => {
    state.failPassport = true;
    const { tree, onPassportMade } = await mount();
    await act(async () => { button(tree, 'Send to the buyer').props.onClick(); });
    await submitTransfer(tree);
    expect(state.writes).toEqual([]);
    expect(onPassportMade).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('The passport for Mango could not be made, so nothing was sent.');
    expect(state.events.map(([name]) => name)).not.toContain('transfer_started');
  });

  it('keeps an existing passport and visibility as they are', async () => {
    const { tree } = await mount({ ...MANGO, passport_code: 'GI-2026-ABCD', sold_price: null });
    const text = textOf(tree);
    expect(text).not.toContain('no passport yet');
    expect(text).not.toContain('sale price');
    await act(async () => { button(tree, 'Send to the buyer').props.onClick(); });
    // No sold price: the asking price stands in, as on the record.
    expect(byId(tree, 'transfer-price').props.value).toBe('450');
    expect(textOf(tree)).not.toContain('Sending makes Mango a passport');
    await submitTransfer(tree);
    expect(state.writes.map(([what]) => what)).toEqual(['create_transfer']);
  });
});
