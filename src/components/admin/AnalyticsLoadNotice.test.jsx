// The admin Analytics screen counts a table that fails to load as empty.
// It now says so above the charts (analyticsLoadNotice), so a zero caused
// by a failed read is not mistaken for a real zero.
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.window = globalThis.window || { self: null, top: null, addEventListener() {}, removeEventListener() {} };
  globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((fn) => setTimeout(fn, 0));
  globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || ((id) => clearTimeout(id));
  // Radix Select checks `instanceof HTMLFormElement` after it mounts.
  globalThis.HTMLFormElement = globalThis.HTMLFormElement || class HTMLFormElement {};
});

const reads = vi.hoisted(() => ({ fail: new Set() }));

vi.mock('@/lib/adminData', async () => {
  const actual = await vi.importActual('@/lib/adminData');
  return {
    ...actual,
    fetchAllProfiles: async () => (reads.fail.has('profiles') ? Promise.reject(new Error('down')) : []),
    fetchAdminTable: async (table) => (reads.fail.has(table) ? Promise.reject(new Error('down')) : []),
  };
});
// Charts and the error log viewer are not what this test is about.
vi.mock('recharts', () => {
  const Stub = ({ children }) => children ?? null;
  return Object.fromEntries(
    ['Area', 'AreaChart', 'Bar', 'BarChart', 'CartesianGrid', 'Line', 'LineChart', 'ResponsiveContainer', 'Tooltip', 'XAxis', 'YAxis']
      .map((name) => [name, Stub]),
  );
});
vi.mock('@/components/admin/ErrorLogsViewer', () => ({ default: () => null }));

import AnalyticsDashboard from './AnalyticsDashboard';

const textOf = (node) => (typeof node === 'string' ? node : (node.children || []).map(textOf).join(''));
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function render() {
  let tree;
  await act(async () => { tree = create(<AnalyticsDashboard />); });
  await settle();
  return tree;
}

describe('Analytics screen when a table does not load', () => {
  it('says which tables did not load', async () => {
    reads.fail = new Set(['geckos', 'user_events']);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tree = await render();
    const status = tree.root.findAll((n) => n.type === 'p' && n.props.role === 'status');
    expect(status).toHaveLength(1);
    expect(textOf(status[0])).toBe('Could not load geckos and events, so their numbers show as zero. Refresh to try again.');
    spy.mockRestore();
    await act(async () => tree.unmount());
  });

  it('shows no notice when every table loaded', async () => {
    reads.fail = new Set();
    const tree = await render();
    expect(textOf(tree.root)).toContain('Growth & Usage');
    expect(tree.root.findAll((n) => n.type === 'p' && n.props.role === 'status')).toHaveLength(0);
    await act(async () => tree.unmount());
  });
});
