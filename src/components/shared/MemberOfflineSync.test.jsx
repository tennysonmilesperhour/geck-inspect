// @vitest-environment jsdom
// The offline sync badge loads only for a signed-in member
// (src/components/shared/MemberOfflineSync.jsx).
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ auth: { isAuthenticated: false }, loaded: 0 }));

vi.mock('@/lib/AuthContext', () => ({ useAuth: () => fx.auth }));
vi.mock('@/components/shared/OfflineSyncStatus', () => {
  fx.loaded += 1;
  return { default: () => <div role="status">Offline, 2 waiting to sync</div> };
});

import MemberOfflineSync from '@/components/shared/MemberOfflineSync';

installDomHarness();

beforeEach(() => {
  fx.auth = { isAuthenticated: false };
});

describe('MemberOfflineSync', () => {
  it('shows nothing to a signed-out visitor and does not download the badge', async () => {
    render(<MemberOfflineSync />);
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(screen.queryByRole('status')).toBeNull();
    expect(fx.loaded).toBe(0);
  });

  it('loads the badge once a member is signed in, and hides it again on sign-out', async () => {
    const { rerender } = render(<MemberOfflineSync />);
    fx.auth = { isAuthenticated: true };
    rerender(<MemberOfflineSync />);
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(screen.getByRole('status').textContent).toBe('Offline, 2 waiting to sync');
    expect(fx.loaded).toBe(1);

    fx.auth = { isAuthenticated: false };
    rerender(<MemberOfflineSync />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
