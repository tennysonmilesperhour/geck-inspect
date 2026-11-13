import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The gecko record's reminder switches use the day the defaults start from
// the same app_settings row the reminder jobs read. A release on 18 Oct
// stores 2026-10-18: a gecko added on 17 Oct gets nothing from the server,
// so its switches must show off, not on.
// `write` answers a save of the settings: null lets it through at once; a
// test sets it to hold the save open or to fail it.
const state = vi.hoisted(() => ({ setting: { value: '2026-10-18' }, reads: [], write: null, guest: false }));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (table) => {
      state.reads.push(table);
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => (table === 'app_settings'
          ? { data: state.setting, error: null }
          : { data: { extra_data: {} }, error: null }),
        update: () => ({ eq: () => (state.write ? state.write() : Promise.resolve({ error: null })) }),
      };
      return query;
    },
  },
}));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => state.guest }));
vi.mock('@/components/ui/switch', () => ({
  Switch: ({ id, checked, disabled, onCheckedChange }) => (
    <input type="checkbox" id={id} checked={checked} disabled={disabled} onChange={() => onCheckedChange?.(!checked)} />
  ),
}));
vi.mock('@/components/ui/label', () => ({ Label: ({ children, htmlFor }) => <label htmlFor={htmlFor}>{children}</label> }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));

const { default: WeighInReminderSwitch } = await import('../WeighInReminderSwitch');
const { toast } = await import('@/components/ui/use-toast');

const byId = (tree, id) => tree.root.find((n) => n.type === 'input' && n.props.id === id);

let tree;
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = null;
  state.reads = [];
  state.write = null;
  state.guest = false;
  vi.clearAllMocks();
});

async function mount(gecko) {
  await act(async () => {
    tree = create(<WeighInReminderSwitch gecko={gecko} email="keeper@example.com" />);
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

describe('WeighInReminderSwitch and the stored defaults day', () => {
  it('shows a gecko added before the stored day with both reminders off', async () => {
    await mount({ id: 'g17', name: 'Mango', created_date: '2026-10-17T15:00:00+00:00', weight_grams: 6 });
    expect(state.reads).toContain('app_settings');
    expect(byId(tree, 'weigh-remind-g17').props.checked).toBe(false);
    expect(byId(tree, 'feed-remind-g17').props.checked).toBe(false);
  });

  it('shows a gecko added on the stored day with both reminders on', async () => {
    await mount({ id: 'g18', name: 'Kiwi', created_date: '2026-10-18T09:00:00+00:00', weight_grams: 6 });
    expect(byId(tree, 'weigh-remind-g18').props.checked).toBe(true);
    expect(byId(tree, 'feed-remind-g18').props.checked).toBe(true);
    expect(byId(tree, 'weigh-remind-g18').props.disabled).toBe(false);
  });
});

// Experience review L2: the switch moves before the server answers, and
// goes back if the save fails.
describe('WeighInReminderSwitch changes first', () => {
  const NEW_GECKO = { id: 'g18', name: 'Kiwi', created_date: '2026-10-18T09:00:00+00:00', weight_grams: 6 };
  // A save that waits for the test to let it through or fail it.
  const holdWrite = () => {
    let settle;
    state.write = () => new Promise((resolve) => { settle = resolve; });
    return {
      ok: () => act(async () => { settle({ error: null }); }),
      fail: () => act(async () => { settle({ error: new Error('The connection dropped.') }); }),
    };
  };
  const tap = (id) => act(async () => { byId(tree, id).props.onChange(); });

  it('the weigh-in switch is off the moment it is tapped, and stays off once saved', async () => {
    await mount(NEW_GECKO);
    const server = holdWrite();
    await tap('weigh-remind-g18');
    // The server has not answered yet.
    expect(byId(tree, 'weigh-remind-g18').props.checked).toBe(false);
    await server.ok();
    expect(byId(tree, 'weigh-remind-g18').props.checked).toBe(false);
    expect(byId(tree, 'weigh-remind-g18').props.disabled).toBe(false);
    expect(toast).not.toHaveBeenCalled();
  });

  it('the weigh-in switch goes back on, with a notice, when the save fails', async () => {
    await mount(NEW_GECKO);
    const server = holdWrite();
    await tap('weigh-remind-g18');
    expect(byId(tree, 'weigh-remind-g18').props.checked).toBe(false);
    await server.fail();
    expect(byId(tree, 'weigh-remind-g18').props.checked).toBe(true);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not change the reminder', variant: 'destructive' }));
  });

  it('the feeding switch does the same: off at once, back on when the save fails', async () => {
    await mount(NEW_GECKO);
    const server = holdWrite();
    await tap('feed-remind-g18');
    expect(byId(tree, 'feed-remind-g18').props.checked).toBe(false);
    await server.fail();
    expect(byId(tree, 'feed-remind-g18').props.checked).toBe(true);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not change the reminder' }));
  });

  it('in the demo the switch waits for the answer, so a guest is never shown a change that was not kept', async () => {
    state.guest = true;
    await mount(NEW_GECKO);
    const server = holdWrite();
    await tap('weigh-remind-g18');
    expect(byId(tree, 'weigh-remind-g18').props.checked).toBe(true);
    await server.fail();
    expect(byId(tree, 'weigh-remind-g18').props.checked).toBe(true);
  });
});
