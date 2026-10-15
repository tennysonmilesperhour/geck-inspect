import { act, create } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The gecko record's reminder switches use the day the defaults start from
// the same app_settings row the reminder jobs read. A release on 18 Oct
// stores 2026-10-18: a gecko added on 17 Oct gets nothing from the server,
// so its switches must show off, not on.
const state = vi.hoisted(() => ({ setting: { value: '2026-10-18' }, reads: [] }));
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
      };
      return query;
    },
  },
}));
vi.mock('@/components/ui/switch', () => ({
  Switch: ({ id, checked, disabled }) => <input type="checkbox" id={id} checked={checked} disabled={disabled} readOnly />,
}));
vi.mock('@/components/ui/label', () => ({ Label: ({ children, htmlFor }) => <label htmlFor={htmlFor}>{children}</label> }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));

const { default: WeighInReminderSwitch } = await import('../WeighInReminderSwitch');

const byId = (tree, id) => tree.root.find((n) => n.type === 'input' && n.props.id === id);

let tree;
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = null;
  state.reads = [];
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
