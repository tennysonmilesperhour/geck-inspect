import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseLazy', () => ({ getSupabase: async () => { throw new Error('not in tests'); } }));

const {
  applyDetectedTimeZone, detectTimeZone, looksLikeTimeZone, saveTimeZone, timeZoneLabel, timeZoneOptions,
} = await import('@/lib/memberTimeZone');

function fakeClient(result = { error: null, data: [{ email: 'a@example.com' }] }) {
  const calls = [];
  const chain = {
    update(row) { calls.push(['update', row]); return chain; },
    eq(col, val) { calls.push(['eq', col, val]); return chain; },
    is(col, val) { calls.push(['is', col, val]); return Promise.resolve(result); },
    select(cols) { calls.push(['select', cols]); return Promise.resolve(result); },
  };
  return { calls, client: { from: (table) => { calls.push(['from', table]); return chain; } } };
}

const user = { id: 'u1', email: 'a@example.com' };

describe('time zone names', () => {
  it('accepts IANA names and refuses anything else', () => {
    for (const z of ['America/Chicago', 'Asia/Seoul', 'America/Argentina/Buenos_Aires', 'Etc/GMT+5', 'UTC']) {
      expect(looksLikeTimeZone(z)).toBe(true);
    }
    for (const z of ['', 'PST', 'America/', '../etc', 'A/B/C/D', null, 42]) {
      expect(looksLikeTimeZone(z)).toBe(false);
    }
  });

  it('reads the browser zone, and gives up quietly', () => {
    const intl = { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'Asia/Tokyo' }) }) };
    expect(detectTimeZone(intl)).toBe('Asia/Tokyo');
    expect(detectTimeZone({ DateTimeFormat: () => { throw new Error('no'); } })).toBeNull();
  });

  it('lists the browser zones plus the saved and default ones, sorted', () => {
    const intl = { supportedValuesOf: () => ['Europe/London', 'Asia/Seoul'] };
    expect(timeZoneOptions(['Pacific/Auckland'], intl)).toEqual(['America/Los_Angeles', 'Asia/Seoul', 'Europe/London', 'Pacific/Auckland']);
    expect(timeZoneLabel('America/Los_Angeles')).toBe('America / Los Angeles');
  });
});

describe('saving the browser zone on sign-in', () => {
  const detect = () => 'Asia/Seoul';

  it('skips while the column is not there yet', async () => {
    const { client, calls } = fakeClient();
    const r = await applyDetectedTimeZone(user, { email: user.email }, { getClient: async () => client, detect });
    expect(r.outcome).toBe('skipped');
    expect(calls).toEqual([]);
  });

  it('never replaces a zone the member has', async () => {
    const { client, calls } = fakeClient();
    const r = await applyDetectedTimeZone(user, { time_zone: 'Europe/Paris' }, { getClient: async () => client, detect });
    expect(r.outcome).toBe('has-zone');
    expect(calls).toEqual([]);
  });

  it('saves the browser zone only on a row that still has none', async () => {
    const { client, calls } = fakeClient();
    const r = await applyDetectedTimeZone(user, { time_zone: null }, { getClient: async () => client, detect });
    expect(r).toEqual({ outcome: 'saved', zone: 'Asia/Seoul' });
    expect(calls).toEqual([
      ['from', 'profiles'],
      ['update', { time_zone: 'Asia/Seoul' }],
      ['eq', 'email', 'a@example.com'],
      ['is', 'time_zone', null],
    ]);
  });

  it('reports a failure without throwing', async () => {
    const { client } = fakeClient({ error: { code: '22023' } });
    const r = await applyDetectedTimeZone(user, { time_zone: null }, { getClient: async () => client, detect });
    expect(r.outcome).toBe('failed');
    expect((await applyDetectedTimeZone(user, { time_zone: null }, { getClient: async () => client, detect: () => null })).outcome).toBe('unknown');
  });
});

describe('saving a zone from Settings', () => {
  it('saves a listed zone and throws the database error as is', async () => {
    const ok = fakeClient();
    await expect(saveTimeZone('a@example.com', 'Asia/Seoul', { getClient: async () => ok.client })).resolves.toBe('Asia/Seoul');
    const bad = fakeClient({ error: { code: 'PGRST204' }, data: null });
    await expect(saveTimeZone('a@example.com', 'Asia/Seoul', { getClient: async () => bad.client })).rejects.toMatchObject({ code: 'PGRST204' });
    await expect(saveTimeZone('a@example.com', 'not a zone', { getClient: async () => ok.client })).rejects.toThrow(/Choose/);
  });
});
