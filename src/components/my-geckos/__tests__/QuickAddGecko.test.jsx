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
    // Free gets one Morph ID a month, not one ever.
    expect(textOf(tree)).toContain('Try Morph ID (one free a month)');
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

  // Owner decision E12: a member with several feeding groups chooses one.
  describe('the feeding group choice', () => {
    const GROUPS = [
      { id: 'adults', label: 'A', name: 'Adults', interval_days: 4 },
      { id: 'hatchlings', label: 'B', name: 'Hatchlings', interval_days: 2, auto_weight_min_g: 1, auto_weight_max_g: 10 },
      { id: 'subadults', label: 'C', name: 'Subadults', interval_days: 3, auto_weight_min_g: 10.1, auto_weight_max_g: 30 },
    ];
    const choice = (tree) => tree.root.findAll((n) => n.type === 'select' && n.props.id === 'qa-group')[0] || null;
    const typeWeight = (tree, value) => act(async () => { byId(tree, 'qa-weight').props.onChange({ target: { value } }); });

    it('is not offered with one group or none, and the gecko joins the first group as before', async () => {
      const none = await mount();
      expect(choice(none.tree)).toBeNull();

      state.groups = [GROUPS[1]];
      const one = await mount();
      expect(choice(one.tree)).toBeNull();
      expect(textOf(one.tree)).toContain('Every 2 days, with Group B: Hatchlings.');
      await act(async () => { byId(one.tree, 'qa-name').props.onChange({ target: { value: 'Pip' } }); });
      await act(async () => { buttonWithText(one.tree, 'Save gecko').props.onClick(); });
      expect(state.rpcCalls[0].args.p_record.feeding_group_id).toBe('hatchlings');
      expect(state.groupCreates).toHaveLength(0);
      expect(textOf(one.tree)).toContain('We will remind you on feeding days, every 2 days.');
    });

    it('defaults to the group whose weight range holds the weight, else the first, and follows the weight', async () => {
      state.groups = GROUPS;
      const { tree } = await mount();
      expect(choice(tree).props.value).toBe('adults');
      expect(tree.root.findAll((n) => n.type === 'option').map((o) => innerText(o))).toEqual([
        'Group A: Adults', 'Group B: Hatchlings (1 to 10 g)', 'Group C: Subadults (10.1 to 30 g)',
      ]);
      await typeWeight(tree, '4');
      expect(choice(tree).props.value).toBe('hatchlings');
      await typeWeight(tree, '22.5');
      expect(choice(tree).props.value).toBe('subadults');
      await typeWeight(tree, '45');
      expect(choice(tree).props.value).toBe('adults');
    });

    it("saves the member's choice, which stays put when the weight changes", async () => {
      state.groups = GROUPS;
      const { tree } = await mount();
      await act(async () => { choice(tree).props.onChange({ target: { value: 'subadults' } }); });
      await typeWeight(tree, '4');
      expect(choice(tree).props.value).toBe('subadults');
      expect(textOf(tree)).toContain('Every 3 days, with the group below.');
      await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: 'Mango' } }); });
      await act(async () => { buttonWithText(tree, 'Save gecko').props.onClick(); });
      expect(state.rpcCalls[0].args.p_record).toMatchObject({ name: 'Mango', weight_grams: 4, feeding_group_id: 'subadults' });
      expect(state.groupCreates).toHaveLength(0);

      // The next gecko's group follows its own weight again.
      await act(async () => { buttonWithText(tree, 'Add another gecko').props.onClick(); });
      await typeWeight(tree, '4');
      expect(choice(tree).props.value).toBe('hatchlings');
    });

    it('goes away with reminders off, and the gecko joins no group', async () => {
      state.groups = GROUPS;
      const { tree } = await mount();
      await act(async () => { byId(tree, 'qa-remind').props.onChange({ target: { checked: false } }); });
      expect(choice(tree)).toBeNull();
      await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: 'Kiwi' } }); });
      await act(async () => { buttonWithText(tree, 'Save gecko').props.onClick(); });
      expect(state.rpcCalls[0].args.p_record.feeding_group_id).toBeNull();
    });

    it("shows in the demo with the demo's groups, and saves nothing", async () => {
      const mem = new Map();
      globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
      state.groups = GROUPS;
      const { tree, onSaved } = await mount({ guest: true, user: { id: '', email: 'guest@local', is_guest: true } });
      expect(choice(tree).props.value).toBe('adults');
      await act(async () => { choice(tree).props.onChange({ target: { value: 'hatchlings' } }); });
      expect(choice(tree).props.value).toBe('hatchlings');
      await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: 'Mango' } }); });
      await act(async () => { buttonWithText(tree, 'Keep this gecko').props.onClick(); });
      expect(state.rpcCalls).toHaveLength(0);
      expect(state.groupCreates).toHaveLength(0);
      expect(onSaved).not.toHaveBeenCalled();
      expect(textOf(tree)).toContain('Create a free account to keep Mango');
      delete globalThis.localStorage;
    });
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

  // Fields the member types into (the reminder switch and the hidden
  // file picker are not typing).
  const typedFields = (tree) => tree.root
    .findAll((n) => n.type === 'input' && n.props.type !== 'checkbox' && n.props.type !== 'file')
    .map((n) => n.props.id);
  const MORPH_DRAFT = { image_urls: ['https://x/top.webp', 'https://x/side.webp'], morph_tags: ['Lilly White', 'Harlequin'], morphs_traits: 'Lilly White', notes: 'Unverified Morph ID suggestion' };

  it('opens a Morph ID result in the guided flow as one name field and Save and continue', async () => {
    const onContinue = vi.fn();
    const { tree } = await mount({ initialDraft: MORPH_DRAFT, onContinue, saveSource: 'morph_id_draft', stepLabel: 'Step 1 of 3' });
    // One field to fill, focused; the photo and the morph are shown, not asked.
    expect(typedFields(tree)).toEqual(['qa-name']);
    expect(byId(tree, 'qa-name').props.autoFocus).toBe(true);
    expect(textOf(tree)).toContain('Step 1 of 3');
    expect(textOf(tree)).toContain('Morph ID suggestion');
    expect(textOf(tree)).toContain('Lilly White');
    expect(tree.root.find((n) => n.type === 'img').props.src).toBe('https://x/top.webp');
    // Feeding reminders stay on, and the switch stays in sight.
    expect(byId(tree, 'qa-remind').props.checked).toBe(true);

    await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: 'Mango' } }); });
    await act(async () => { buttonWithText(tree, 'Save and continue').props.onClick(); });
    const record = state.rpcCalls[0].args.p_record;
    expect(record).toMatchObject({ name: 'Mango', morphs_traits: 'Lilly White', sex: 'Unsexed' });
    expect(record.morph_tags).toEqual(['Lilly White', 'Harlequin']);
    expect(record.image_urls).toEqual(['https://x/top.webp', 'https://x/side.webp']);
    expect(record.notes).toContain('Morph ID');
    expect(record.feeding_group_id).toBe('group-1');
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue.mock.calls[0][0].name).toBe('Mango');
    // The flow takes over: no success screen here.
    expect(textOf(tree)).not.toContain('is in your collection');
  });

  it('saves the short form with Enter from the name field', async () => {
    const onContinue = vi.fn();
    const { tree } = await mount({ initialDraft: MORPH_DRAFT, onContinue, saveSource: 'morph_id_draft' });
    await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: 'Pip' } }); });
    await act(async () => { byId(tree, 'qa-name').props.onKeyDown({ key: 'Enter', preventDefault: () => {}, nativeEvent: {} }); });
    expect(state.rpcCalls).toHaveLength(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('opens the rest of the fields from the short form on request', async () => {
    const onContinue = vi.fn();
    const { tree } = await mount({ initialDraft: MORPH_DRAFT, onContinue, saveSource: 'morph_id_draft' });
    await act(async () => { buttonWithText(tree, 'Add sex, hatch date or weight').props.onClick(); });
    expect(typedFields(tree)).toEqual(expect.arrayContaining(['qa-name', 'qa-hatch', 'qa-weight', 'qa-morph']));
    expect(byId(tree, 'qa-morph').props.value).toBe('Lilly White');
    await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: 'Mango' } }); });
    await act(async () => { byId(tree, 'qa-weight').props.onChange({ target: { value: '12.5' } }); });
    await act(async () => { buttonWithText(tree, 'Save and continue').props.onClick(); });
    expect(state.rpcCalls[0].args.p_record).toMatchObject({ name: 'Mango', weight_grams: 12.5, morphs_traits: 'Lilly White' });
    expect(state.rpcCalls[0].args.p_record.morph_tags).toEqual(['Lilly White', 'Harlequin']);
  });

  it('says the morph is a suggestion the member can change on the record', async () => {
    const { tree } = await mount({ initialDraft: MORPH_DRAFT, onContinue: vi.fn(), saveSource: 'morph_id_draft' });
    expect(textOf(tree)).toContain('A suggestion from the photos, not proven genetics. You can change it on the gecko’s record.');
    // A sure answer is a line to accept, not a field.
    expect(typedFields(tree)).toEqual(['qa-name']);
  });

  it('shows the morph to check when Morph ID was unsure', async () => {
    const onContinue = vi.fn();
    const { tree } = await mount({ initialDraft: { ...MORPH_DRAFT, check_morph: true }, onContinue, saveSource: 'morph_id_draft' });
    expect(textOf(tree)).toContain('Morph ID was not sure about this one. Check the morph below.');
    // The morph sits right under the suggestion it explains, then the name.
    expect(typedFields(tree)).toEqual(['qa-morph', 'qa-name']);
    expect(byId(tree, 'qa-morph').props.value).toBe('Lilly White');
    // The name still has the focus; the member checks the morph and saves.
    expect(byId(tree, 'qa-name').props.autoFocus).toBe(true);
    await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: 'Mango' } }); });
    await act(async () => { byId(tree, 'qa-morph').props.onChange({ target: { value: 'Dalmatian' } }); });
    await act(async () => { buttonWithText(tree, 'Save and continue').props.onClick(); });
    expect(state.rpcCalls[0].args.p_record).toMatchObject({ name: 'Mango', morphs_traits: 'Dalmatian' });
    // The hint is for the form only; it is never a column on the gecko.
    expect(state.rpcCalls[0].args.p_record).not.toHaveProperty('check_morph');
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('keeps the full form for a Morph ID draft outside the guided flow', async () => {
    const { tree } = await mount({ initialDraft: MORPH_DRAFT, saveSource: 'morph_id_draft' });
    expect(typedFields(tree)).toEqual(expect.arrayContaining(['qa-name', 'qa-morph', 'qa-weight']));
    expect(buttonWithText(tree, 'Save gecko')).toBeTruthy();
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

  // Experience review D1: every "Add Gecko" opens this form, so for a
  // collection that already has geckos it is no longer the "first".
  it('reads "Add a gecko" for a later gecko, saves it and shows its own success screen', async () => {
    const { tree, onSaved } = await mount({ existingGeckos: [{ id: 'old', name: 'Mango', archived: false }] });
    expect(textOf(tree)).toContain('Add a gecko');
    expect(textOf(tree)).not.toContain('Add your first gecko');
    expect(textOf(tree)).not.toContain('Import it instead');
    expect(buttonWithText(tree, 'More details')).toBeTruthy();
    await act(async () => { byId(tree, 'qa-name').props.onChange({ target: { value: 'Pip' } }); });
    await act(async () => { buttonWithText(tree, 'Save gecko').props.onClick(); });
    expect(state.rpcCalls).toHaveLength(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(textOf(tree)).toContain('Pip is in your collection');
  });

  it('still reads "first" when every gecko in the collection is archived', async () => {
    const { tree } = await mount({ existingGeckos: [{ id: 'old', name: 'Mango', archived: true }] });
    expect(textOf(tree)).toContain('Add your first gecko');
  });

  // Experience review D3: an unfinished gecko from the long form is kept
  // in this browser; one line here leads back to it.
  it('offers an unfinished gecko kept from the long form, and never to a guest', async () => {
    const kept = JSON.stringify({ saved_at: Date.now(), draft: { form: { name: 'Mango', image_urls: [] } } });
    const mem = new Map([['geck_gecko_form_draft_v1:u1', kept]]);
    globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
    const onResumeDraft = vi.fn();
    const { tree } = await mount({ onResumeDraft });
    expect(textOf(tree)).toContain('Pick up where you left off?');
    expect(textOf(tree)).toContain('Mango is unfinished.');
    await act(async () => { buttonWithText(tree, 'Pick it up').props.onClick(); });
    expect(onResumeDraft).toHaveBeenCalledTimes(1);

    const guest = await mount({ onResumeDraft, guest: true });
    expect(textOf(guest.tree)).not.toContain('Pick up where you left off?');
    delete globalThis.localStorage;
  });
});
