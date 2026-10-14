import { beforeEach, describe, expect, it, vi } from 'vitest';

const { supabase } = vi.hoisted(() => ({
  supabase: {
    auth: { getUser: vi.fn(), getSession: vi.fn(), refreshSession: vi.fn() },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/supabaseClient', () => ({ supabase }));
vi.mock('@/lib/guestMode', () => ({
  isGuestMode: () => true,
  blockIfGuest: (action) => { throw new Error(`blocked ${action}`); },
}));

import { Gecko, MarketplaceCost, Notification } from '../supabaseEntities';
import { uploadFile } from '@/lib/uploadFile';

describe('guest data isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serves collection and ledger reads from local demo fixtures only', async () => {
    const [geckos, costs, notifications] = await Promise.all([
      Gecko.list(),
      MarketplaceCost.list(),
      Notification.list(),
    ]);

    expect(geckos.some((gecko) => gecko.id.startsWith('mock-demo-gecko-'))).toBe(true);
    expect(costs.every((cost) => cost.id.startsWith('mock-demo-cost-'))).toBe(true);
    expect(notifications.every((note) => note.id.startsWith('mock-notif-') && note.user_email === 'guest@local')).toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('blocks guest create, update and delete before any Supabase request', async () => {
    await expect(Gecko.create({ name: 'No write' })).rejects.toThrow('blocked save changes');
    await expect(MarketplaceCost.update('mock-demo-cost-2026-01', { amount: 1 })).rejects.toThrow('blocked save changes');
    await expect(Gecko.delete('mock-demo-gecko-2026-01')).rejects.toThrow('blocked delete records');

    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('blocks guest photo uploads before storage, auth or quota requests', async () => {
    await expect(uploadFile({ file: { type: 'image/png', size: 1 } })).rejects.toThrow('blocked upload photos');

    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
