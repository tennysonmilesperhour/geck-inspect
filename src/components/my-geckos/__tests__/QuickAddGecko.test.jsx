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
vi.mock('react-router-dom', () => ({ Link: ({ children }) => <span>{children}</span> }));
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
});
