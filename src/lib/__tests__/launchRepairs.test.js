import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildMorphMarketCSV } from '../morphmarketSync';

const native = vi.hoisted(() => ({
  configure: vi.fn(), setLogLevel: vi.fn(), getAppUserID: vi.fn(), logIn: vi.fn(),
}));
vi.mock('@revenuecat/purchases-capacitor', () => ({ Purchases: native, LOG_LEVEL: { WARN: 'WARN' } }));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); vi.clearAllMocks(); });

describe('launch repair regressions', () => {
  it('neutralizes spreadsheet formulas in exported descriptions', () => {
    for (const value of ['=1+1', '+SUM(1,2)', '@SUM(1,2)', '-cmd', '  =HYPERLINK("https://example.com")', '\t=1+1']) {
      const csv = buildMorphMarketCSV([{ marketplace_description: value }]);
      expect(csv).toContain("'" + value.replaceAll('"', '""'));
    }
  });
  it('retains ordinary exported text and numeric prices', () => {
    const csv = buildMorphMarketCSV([{ marketplace_description: 'Healthy Lilly White', asking_price: 250 }]);
    expect(csv).toContain('Healthy Lilly White');
    expect(csv).toContain(',250,');
  });
  it('returns a configured native SDK instead of a false signed-out result', async () => {
    vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } });
    vi.stubEnv('VITE_REVENUECAT_ANDROID_API_KEY', 'fixture-key');
    const { configureRevenueCat } = await import('../revenuecat');
    expect(await configureRevenueCat({ id: '11111111-1111-4111-8111-111111111111' })).toBe(native);
    expect(native.configure).toHaveBeenCalledWith({ apiKey: 'fixture-key', appUserID: '11111111-1111-4111-8111-111111111111' });
    native.getAppUserID.mockResolvedValue({ appUserID: '11111111-1111-4111-8111-111111111111' });
    expect(await configureRevenueCat({ id: '22222222-2222-4222-8222-222222222222' })).toBe(native);
    expect(native.logIn).toHaveBeenCalledWith({ appUserID: '22222222-2222-4222-8222-222222222222' });
  });
});

describe('release configuration', () => {
  it('rejects an incomplete store release', async () => {
    const { execFileSync } = await import('node:child_process');
    expect(() => execFileSync(process.execPath, ['scripts/check-env.mjs'], {
      env: { PATH: process.env.PATH, GECK_RELEASE_TARGET: 'android' }, stdio: 'pipe',
    })).toThrow();
  });
});
