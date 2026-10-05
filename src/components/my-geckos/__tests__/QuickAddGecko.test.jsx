import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rpcCalls: [], groupCreates: [], groups: [], toasts: [] }));

// Radix primitives need a DOM; these stand-ins keep the props that matter.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogDescription: ({ children }) => <p>{children}</p>,
}));
vi.mock('@/components/ui/switch', () => ({
  Switch: ({ id, checked, onCheckedChange }) => (
    <input type="checkbox" id={id} checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />
  ),
}));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: (t) => state.toasts.push(t) }) }));
vi.mock('@/integrations/Core', () => ({ UploadFile: vi.fn(async () => ({ file_url: 'https://example.com/g.jpg' })) }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/entities/all', () => ({
  FeedingGroup: {
    filter: vi.fn(async () => state.groups),
    create: vi.fn(async (row) => { state.groupCreates.push(row); return { id: 'group-1', ...row }; }),
  },
}));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(async (name, args) => {
      state.rpcCalls.push({ name, args });
      return { data: { id: 'gecko-1', ...args.p_record }, error: null };
    }),
  },
}));
vi.mock('react-router-dom', () => ({ Link: ({ children, to }) => <a href={to}>{children}</a> }));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }) => <button type="button" onClick={onClick} disabled={disabled}>{children}</button>,
}));
vi.mock('@/components/ui/input', () => ({ Input: (props) => <input {...props} /> }));
vi.mock('@/components/ui/label', () => ({ Label: ({ children, htmlFor }) => <label htmlFor={htmlFor}>{children}</label> }));
vi.mock('@/lib/dateUtils', () => ({ todayLocalISO: () => '2026-09-27' }));

const { default: QuickAddGecko } = await import('../QuickAddGecko');

const user = { id: 'u1', email: 'keeper@example.com' };
const byId = (tree, id) => tree.root.find((n) => typeof n.type === 'string' && n.props.id === id);
const innerText = (node) =>
  (node.children || []).map((c) => (typeof c === 'string' ? c : innerText(c))).join('');
const textOf = (tree) => innerText(tree.root);
const buttonWithText = (tree, text) =>
  tree.root.find((n) => n.type === 'button' && innerText(n).includes(text));

async function mount(props = {}) {
  let tree;
  const onSaved = vi.fn();
  await act(async () => {
    tree = create(<QuickAddGecko open user={user} onClose={vi.fn()} onSaved={onSaved} onMoreDetails={vi.fn()} onLogWeight={vi.fn()} {...props} />);
  });
  return { tree, onSaved };
}

describe('QuickAddGecko', () => {
  beforeEach(() => {
    state.rpcCalls.length = 0;
    state.groupCreates.length = 0;
    state.toasts.length = 0;
    state.groups = [];
    globalThis.crypto ??= { randomUUID: () => '00000000-0000-4000-8000-000000000000' };
  });

  it('opens on the photo-first first-gecko form', async () => {
    const { tree } = await mount();
    expect(textOf(tree)).toContain('Add your first gecko');
    expect(textOf(tree)).toContain('Add a photo');
  });

  it('asks for a name instead of saving a blank gecko', async () => {
    const { tree } = await mount();
    await act(async () => { buttonWithText(tree, 'Save gecko').props.onClick(); });
    expect(state.rpcCalls).toHaveLength(0);
    expect(state.toasts[0].title).toMatch(/name/i);
  });

  it('saves through save_gecko_record with the weight and a feeding reminder', async () => {
    const { tree, onSaved } = await mount();
    await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: '  Mango ' } }); });
    await act(async () => { byId(tree, 'qa-weight').props.onChange({ target: { value: '34' } }); });
    await act(async () => { buttonWithText(tree, 'Save gecko').props.onClick(); });

    expect(state.groupCreates).toHaveLength(1);
    expect(state.groupCreates[0]).toMatchObject({ name: 'My geckos', diet_type: 'CGD', interval_days: 3, feeding_reminder_enabled: true });
    expect(state.rpcCalls).toHaveLength(1);
    const { name, args } = state.rpcCalls[0];
    expect(name).toBe('save_gecko_record');
    expect(args.p_record).toMatchObject({ name: 'Mango', species: 'Crested Gecko', weight_grams: 34, feeding_group_id: 'group-1', is_public: false });
    expect(args.p_record_weight).toBe(true);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(textOf(tree)).toContain('Mango is in your collection');
    expect(textOf(tree)).toContain('Try Morph ID free');
  });

  it('gives the new gecko the next ID code, counting geckos saved in this dialog', async () => {
    const yy = String(new Date().getFullYear()).slice(-2);
    const { tree } = await mount({ existingGeckos: [{ id: 'old', gecko_id_code: `KEE1-${yy}` }] });
    await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: 'Mango' } }); });
    await act(async () => { buttonWithText(tree, 'Save gecko').props.onClick(); });
    expect(state.rpcCalls[0].args.p_record.gecko_id_code).toBe(`KEE2-${yy}`);

    await act(async () => { buttonWithText(tree, 'Add another gecko').props.onClick(); });
    await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: 'Pip' } }); });
    await act(async () => { buttonWithText(tree, 'Save gecko').props.onClick(); });
    expect(state.rpcCalls[1].args.p_record.gecko_id_code).toBe(`KEE3-${yy}`);
  });

  it('reuses an existing feeding group and skips it when reminders are off', async () => {
    state.groups = [{ id: 'existing' }];
    const first = await mount();
    await act(async () => { byId(first.tree, 'qa-name').props.onChange({ target: { value: 'Pip' } }); });
    await act(async () => { buttonWithText(first.tree, 'Save gecko').props.onClick(); });
    expect(state.groupCreates).toHaveLength(0);
    expect(state.rpcCalls[0].args.p_record.feeding_group_id).toBe('existing');
    expect(state.rpcCalls[0].args.p_record_weight).toBe(false);

    state.rpcCalls.length = 0;
    const second = await mount();
    await act(async () => { byId(second.tree, 'qa-name').props.onChange({ target: { value: 'Kiwi' } }); });
    await act(async () => { byId(second.tree, 'qa-remind').props.onChange({ target: { checked: false } }); });
    await act(async () => { buttonWithText(second.tree, 'Save gecko').props.onClick(); });
    expect(state.rpcCalls[0].args.p_record.feeding_group_id).toBeNull();
  });

  it('offers photo or typing first, and the photo choice hands off', async () => {
    const onChoosePhoto = vi.fn();
    const { tree } = await mount({ offerPhotoChoice: true, onChoosePhoto, stepLabel: 'Step 1 of 3' });
    expect(textOf(tree)).toContain('Step 1 of 3');
    expect(textOf(tree)).toContain('Add it by photo');
    await act(async () => { buttonWithText(tree, 'Add it by photo').props.onClick(); });
    expect(onChoosePhoto).toHaveBeenCalledTimes(1);
    await act(async () => { buttonWithText(tree, 'Type a name and morph').props.onClick(); });
    expect(byId(tree, 'qa-name')).toBeTruthy();
  });

  it('prefills a Morph ID draft and saves its tags, then continues the flow', async () => {
    const onContinue = vi.fn();
    const draft = { image_urls: ['https://x/top.webp', 'https://x/side.webp'], morph_tags: ['Lilly White', 'Harlequin'], morphs_traits: 'Lilly White', notes: 'Unverified Morph ID suggestion' };
    const { tree } = await mount({ initialDraft: draft, onContinue, saveSource: 'morph_id_draft' });
    expect(byId(tree, 'qa-morph').props.value).toBe('Lilly White');
    await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: 'Mango' } }); });
    await act(async () => { buttonWithText(tree, 'Save and continue').props.onClick(); });
    const record = state.rpcCalls[0].args.p_record;
    expect(record.morph_tags).toEqual(['Lilly White', 'Harlequin']);
    expect(record.image_urls).toEqual(['https://x/top.webp', 'https://x/side.webp']);
    expect(record.notes).toContain('Morph ID');
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue.mock.calls[0][0].name).toBe('Mango');
    // The flow takes over: no success screen here.
    expect(textOf(tree)).not.toContain('is in your collection');
  });

  it('in the guest demo keeps the gecko for sign-up instead of saving', async () => {
    const mem = new Map();
    globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
    const { tree, onSaved } = await mount({ guest: true });
    expect(textOf(tree)).toContain('Photos and Morph ID open once you have a free account');
    await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: 'Mango' } }); });
    await act(async () => { byId(tree, 'qa-morph').props.onChange({ target: { value: 'Lilly White' } }); });
    await act(async () => { buttonWithText(tree, 'Keep this gecko').props.onClick(); });
    expect(state.rpcCalls).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Create a free account to keep Mango');
    expect(textOf(tree)).toContain('Back to the demo');
    expect(JSON.parse(mem.get('geck_pending_first_gecko_v1')).draft).toMatchObject({ name: 'Mango', morphs_traits: 'Lilly White' });
  });
});
