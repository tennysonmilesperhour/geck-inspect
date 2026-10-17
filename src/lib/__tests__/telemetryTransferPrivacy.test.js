// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock('../guestMode', () => ({ isGuestMode: () => false }));
vi.mock('../supabaseLazy', () => ({
  getSupabaseWhenIdle: async () => ({ from: mocks.from, auth: { getUser: mocks.getUser } }),
}));
import { reportError, trackEvent, trackPageView } from '../telemetry';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { email: 'recipient@example.test' } } });
});

describe('transfer token privacy in first-party telemetry', () => {
  it('redacts the current claim path from product events and page views', async () => {
    window.history.replaceState({}, '', '/claim/private-transfer-token?code=private-auth-code#access_token=secret');
    await trackEvent('accept_transfer_fixture');
    await trackPageView();
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    for (const [event] of mocks.insert.mock.calls) {
      expect(event.page).toBe('claim/redacted');
      expect(JSON.stringify(event)).not.toMatch(/private-transfer-token|private-auth-code|access_token/);
    }
    expect(mocks.insert.mock.calls[1][0].properties.page).toBe('claim/redacted');
  });

  it('redacts claim tokens from error URLs and page context', async () => {
    window.history.replaceState({}, '', '/claim/error-transfer-token?code=error-auth-code');
    await reportError(new Error('Fixture claim failure'));
    expect(mocks.from).toHaveBeenCalledWith('error_logs');
    const error = mocks.insert.mock.calls[0][0];
    expect(error.url).toBe(`${window.location.origin}/claim/redacted`);
    expect(error.context.page).toBe('claim/redacted');
    expect(JSON.stringify(error)).not.toMatch(/error-transfer-token|error-auth-code/);
  });
});
