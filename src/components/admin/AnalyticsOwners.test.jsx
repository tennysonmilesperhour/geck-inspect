// @vitest-environment jsdom
// The admin Analytics screen groups geckos, breeding plans, photos and
// forum rows by owner (active members, cohort activation, power users)
// and leaves admin accounts out. Those rows say who owns them by
// owner_profile_id: once members lose created_by on geckos and plans
// (step 2 of docs/planning/owner-emails-2026-11.md) admins cannot read it
// either, so the screen reads owner_profile_id and takes the address from
// the profiles list it already loads.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => {
  const DAY = 24 * 60 * 60 * 1000;
  const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
  return {
    profiles: [
      { id: 'p-admin', email: 'admin@example.test', role: 'admin', full_name: 'Admin Account', created_date: ago(400) },
      { id: 'p-lilly', email: 'lilly@example.test', role: 'user', full_name: 'Lilly White Geckos', created_date: ago(10) },
      { id: 'p-harley', email: 'harley@example.test', role: 'user', full_name: 'Harlequin House', created_date: ago(200) },
    ],
    // No created_by on any row.
    tables: {
      geckos: [
        { id: 'g1', owner_profile_id: 'p-lilly', created_date: ago(5) },
        { id: 'g2', owner_profile_id: 'p-lilly', created_date: ago(4) },
        { id: 'g3', owner_profile_id: 'p-harley', created_date: ago(3) },
        { id: 'g4', owner_profile_id: 'p-admin', created_date: ago(2) },
        { id: 'g5', owner_profile_id: 'p-admin', created_date: ago(2) },
        { id: 'g6', owner_profile_id: 'p-admin', created_date: ago(1) },
      ],
      breeding_plans: [
        { id: 'b1', owner_profile_id: 'p-lilly', created_date: ago(4) },
        { id: 'b2', owner_profile_id: 'p-admin', created_date: ago(1) },
        { id: 'b3', owner_profile_id: 'p-admin', created_date: ago(1) },
      ],
      gecko_images: [{ id: 'i1', owner_profile_id: 'p-harley', created_date: ago(3) }],
      forum_posts: [{ id: 'f1', owner_profile_id: 'p-lilly', created_date: ago(6) }],
    },
    reads: [],
  };
});

vi.mock('@/lib/adminData', async () => {
  const actual = await vi.importActual('@/lib/adminData');
  return {
    ...actual,
    fetchAllProfiles: async () => fx.profiles,
    fetchAdminTable: async (table, columns) => {
      fx.reads.push([table, columns]);
      return fx.tables[table] || [];
    },
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

installDomHarness();

// The number printed under a KPI or engagement label.
const valueUnder = (label) => screen.getByText(label).nextElementSibling.textContent;

describe('Analytics screen, owners by profile id', () => {
  it('reads owner_profile_id, never created_by, on geckos and breeding plans', async () => {
    render(<AnalyticsDashboard />);
    await screen.findByText('Power users');
    const columns = Object.fromEntries(fx.reads);
    expect(columns.geckos).toBe('id,owner_profile_id,created_date');
    expect(columns.breeding_plans).toBe('id,owner_profile_id,created_date');
    for (const [, cols] of fx.reads) expect(cols).not.toMatch(/created_by/);
  });

  it("leaves the admin's geckos and plans out and groups the rest by owner", async () => {
    render(<AnalyticsDashboard />);
    await screen.findByText('Power users');
    expect(valueUnder('New geckos')).toBe('3');
    expect(valueUnder('Breeding plans')).toBe('1');
    expect(valueUnder('Active users this period')).toBe('2');
    // Lilly signed up this period and added a gecko.
    expect(valueUnder('Cohort activation')).toBe('100%');

    const card = screen.getByText('Power users').closest('.rounded-xl');
    const rows = within(card).getAllByText(/^#\d+$/).map((rank) => rank.parentElement);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Lilly White Geckos')).toBeTruthy();
    expect(within(rows[0]).getByText('lilly@example.test')).toBeTruthy();
    expect(within(rows[1]).getByText('Harlequin House')).toBeTruthy();
    expect(within(card).queryByText('admin@example.test')).toBeNull();
  });
});
