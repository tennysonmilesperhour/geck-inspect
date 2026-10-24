// Weekly Gecko Notes in the EEA and the UK (src/lib/weeklyNotesConsent.js,
// decision of 18 Oct 2026): the sign-up box's default and the region rule
// the app applies after sign-in. The database half (the region function
// acts only on the caller, never after a choice) is in
// supabase/tests/weekly_notes_regressions.sql, block 12b.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { timeZoneNeedsConsent } from '@/lib/analyticsConsent';
import {
  CHOICE_COLUMN,
  SIGNUP_METADATA_KEY,
  __resetWeeklyNotesRegionMemory,
  applyWeeklyNotesRegionDefault,
  signupBoxDefault,
  signupBoxFromMetadata,
  WEEKLY_NOTES_CHANGED_EVENT,
  weeklyNotesAfter,
} from '@/lib/weeklyNotesConsent';

const MIGRATION = readFileSync(
  new URL('../../../supabase/migrations/20261018002200_weekly_notes.sql', import.meta.url),
  'utf8',
);

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    map,
  };
}

function fakeClient(answer = { data: 'region-off', error: null }) {
  const calls = [];
  return {
    calls,
    getClient: async () => ({
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        if (answer instanceof Error) throw answer;
        return answer;
      },
    }),
  };
}

const member = { id: 'auth-1', email: 'sam@example.com', user_metadata: { full_name: 'Sam' } };
const noChoice = { email: 'sam@example.com', email_weekly_notes_enabled: true, [CHOICE_COLUMN]: null };

function run(authUser, profile, { region = true, storage = memoryStorage(), client = fakeClient(), offline = false } = {}) {
  return applyWeeklyNotesRegionDefault(authUser, profile, {
    needsConsent: () => region,
    storage,
    getClient: client.getClient,
    offline: () => offline,
  });
}

beforeEach(() => {
  __resetWeeklyNotesRegionMemory();
});

describe('the sign-up box', () => {
  it('starts ticked, except for a browser in the EEA or the UK', () => {
    expect(signupBoxDefault({ cookie: 'gi_analytics_region=open', timeZone: 'America/Chicago' })).toBe(true);
    expect(signupBoxDefault({ cookie: '', timeZone: 'America/New_York' })).toBe(true);
    // Vercel's country cookie says ask, or the time zone is European.
    expect(signupBoxDefault({ cookie: 'gi_analytics_region=ask', timeZone: 'America/Chicago' })).toBe(false);
    expect(signupBoxDefault({ cookie: '', timeZone: 'Europe/London' })).toBe(false);
    expect(signupBoxDefault({ cookie: 'gi_analytics_region=open', timeZone: 'Europe/Berlin' })).toBe(false);
  });

  it('reads the box back from the sign-up metadata, and only a true or false counts', () => {
    expect(signupBoxFromMetadata({ user_metadata: { [SIGNUP_METADATA_KEY]: true } })).toBe(true);
    expect(signupBoxFromMetadata({ user_metadata: { [SIGNUP_METADATA_KEY]: false } })).toBe(false);
    // Google sign-in has no box.
    expect(signupBoxFromMetadata({ user_metadata: { name: 'Sam', avatar_url: 'x' } })).toBeNull();
    expect(signupBoxFromMetadata({ user_metadata: { [SIGNUP_METADATA_KEY]: 'false' } })).toBeNull();
    expect(signupBoxFromMetadata({})).toBeNull();
    expect(signupBoxFromMetadata(null)).toBeNull();
  });

  it('uses the same metadata key the database reads', () => {
    expect(SIGNUP_METADATA_KEY).toBe('weekly_notes_at_signup');
    expect(MIGRATION).toContain(`new.raw_user_meta_data -> '${SIGNUP_METADATA_KEY}'`);
    expect(MIGRATION).toContain(`v_meta -> '${SIGNUP_METADATA_KEY}'`);
    expect(MIGRATION).toContain(`add column if not exists ${CHOICE_COLUMN} timestamptz`);
  });
});

describe('the region rule after sign-in', () => {
  it('asks the database to turn the notes off for a member in the region who never chose', async () => {
    const client = fakeClient();
    expect(await run(member, noChoice, { client })).toBe('region-off');
    expect(client.calls).toEqual([{ fn: 'weekly_notes_region_default', args: { p_consent_region: true } }]);
  });

  it('calls at most once per browser session', async () => {
    const storage = memoryStorage();
    const client = fakeClient();
    expect(await run(member, noChoice, { storage, client })).toBe('region-off');
    expect(await run(member, noChoice, { storage, client })).toBe('already-asked');
    expect(client.calls).toHaveLength(1);
    // A new page load in the same tab still remembers (sessionStorage).
    __resetWeeklyNotesRegionMemory();
    expect(await run(member, noChoice, { storage, client })).toBe('already-asked');
    expect(client.calls).toHaveLength(1);
    // Another account in the same tab is its own question.
    expect(await run({ ...member, id: 'auth-2' }, noChoice, { storage, client })).toBe('region-off');
    expect(client.calls).toHaveLength(2);
  });

  it('still calls only once when storage cannot be used', async () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    const client = fakeClient();
    expect(await run(member, noChoice, { storage: broken, client })).toBe('region-off');
    expect(await run(member, noChoice, { storage: broken, client })).toBe('already-asked');
    expect(client.calls).toHaveLength(1);
  });

  it('never calls for a member who already chose', async () => {
    const client = fakeClient();
    const chose = { ...noChoice, [CHOICE_COLUMN]: '2026-10-18T09:00:00Z' };
    expect(await run(member, chose, { client })).toBe('chosen');
    expect(await run({ ...member, user_metadata: { [SIGNUP_METADATA_KEY]: false } }, chose, { client })).toBe('chosen');
    expect(client.calls).toEqual([]);
  });

  it('never calls outside the region, or when the notes are already off', async () => {
    const client = fakeClient();
    expect(await run(member, noChoice, { region: false, client })).toBe('nothing-to-do');
    expect(await run(member, { ...noChoice, email_weekly_notes_enabled: false }, { client })).toBe('nothing-to-do');
    expect(client.calls).toEqual([]);
  });

  it('saves a sign-up box the profile missed, inside the region or not', async () => {
    const withBox = { ...member, user_metadata: { [SIGNUP_METADATA_KEY]: false } };
    const client = fakeClient({ data: 'signup-choice', error: null });
    expect(await run(withBox, noChoice, { region: false, client })).toBe('signup-choice');
    expect(client.calls).toEqual([{ fn: 'weekly_notes_region_default', args: { p_consent_region: false } }]);
    // A ticked box in the region, with the notes off on the old row.
    const ticked = { ...member, id: 'auth-3', user_metadata: { [SIGNUP_METADATA_KEY]: true } };
    expect(await run(ticked, { ...noChoice, email_weekly_notes_enabled: false }, { region: true, client })).toBe('signup-choice');
    expect(client.calls[1]).toEqual({ fn: 'weekly_notes_region_default', args: { p_consent_region: true } });
  });

  it('waits for the column: before the migration it does nothing and asks again later', async () => {
    const storage = memoryStorage();
    const client = fakeClient();
    const oldProfile = { email: 'sam@example.com', email_weekly_notes_enabled: true };
    expect(await run(member, oldProfile, { storage, client })).toBe('skipped');
    expect(client.calls).toEqual([]);
    expect(await run(member, noChoice, { storage, client })).toBe('region-off');
  });

  it('does nothing without an account, a profile or a signal, and asks again once online', async () => {
    const storage = memoryStorage();
    const client = fakeClient();
    expect(await run(null, noChoice, { client })).toBe('skipped');
    expect(await run(member, null, { client })).toBe('skipped');
    expect(await run(member, noChoice, { offline: true, storage, client })).toBe('skipped');
    expect(client.calls).toEqual([]);
    expect(await run(member, noChoice, { storage, client })).toBe('region-off');
  });

  it('never rejects: an error or a thrown call is "failed", and the session is not asked again', async () => {
    const storage = memoryStorage();
    expect(await run(member, noChoice, { storage, client: fakeClient({ data: null, error: { code: 'PGRST202' } }) })).toBe('failed');
    expect(await run(member, noChoice, { storage, client: fakeClient() })).toBe('already-asked');
    __resetWeeklyNotesRegionMemory();
    expect(await run(member, noChoice, { storage: memoryStorage(), client: fakeClient(new Error('offline')) })).toBe('failed');
    const failingClient = { getClient: async () => { throw new Error('no client'); } };
    __resetWeeklyNotesRegionMemory();
    expect(await run(member, noChoice, { storage: memoryStorage(), client: failingClient })).toBe('failed');
  });

  it('reads the region from analyticsConsent when no override is given', async () => {
    // jsdom-free: no document, so no cookie; the time zone decides.
    const client = fakeClient({ data: 'unchanged', error: null });
    const answer = await applyWeeklyNotesRegionDefault(member, noChoice, {
      storage: memoryStorage(),
      getClient: client.getClient,
      offline: () => false,
    });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (timeZoneNeedsConsent(tz)) {
      expect(client.calls).toHaveLength(1);
      expect(answer).toBe('unchanged');
    } else {
      expect(answer).toBe('nothing-to-do');
      expect(client.calls).toEqual([]);
    }
  });
});

// Review of 18 Oct 2026: Settings reads the profile at the same moment the
// rule runs, so a member who lands on Settings could see the switch "On"
// while the database had just turned it off. The rule now announces what
// it changed, and Settings and the signed-in user follow it.
describe('telling the page what the rule changed', () => {
  const seen = [];
  const listen = (event) => seen.push(event.detail);
  // This file runs without a browser; a bare EventTarget stands in for window.
  let hadWindow;
  beforeEach(() => {
    seen.length = 0;
    hadWindow = 'window' in globalThis;
    if (!hadWindow) globalThis.window = new EventTarget();
    globalThis.window.addEventListener(WEEKLY_NOTES_CHANGED_EVENT, listen);
  });
  afterEach(() => {
    globalThis.window.removeEventListener(WEEKLY_NOTES_CHANGED_EVENT, listen);
    if (!hadWindow) delete globalThis.window;
  });

  it('reads the new state from the database answer', () => {
    expect(weeklyNotesAfter('region-off', member)).toBe(false);
    expect(weeklyNotesAfter('signup-choice', { ...member, user_metadata: { [SIGNUP_METADATA_KEY]: true } })).toBe(true);
    expect(weeklyNotesAfter('signup-choice', { ...member, user_metadata: { [SIGNUP_METADATA_KEY]: false } })).toBe(false);
    for (const nothing of ['chosen', 'unchanged', 'no-profile', 'not-signed-in', 'failed', 'skipped']) {
      expect(weeklyNotesAfter(nothing, member)).toBeNull();
    }
  });

  it('announces a region switch-off once, and nothing when the database changed nothing', async () => {
    await run(member, noChoice, { client: fakeClient({ data: 'region-off', error: null }) });
    expect(seen).toEqual([{ enabled: false }]);
    __resetWeeklyNotesRegionMemory();
    await run(member, noChoice, { client: fakeClient({ data: 'unchanged', error: null }) });
    expect(seen).toEqual([{ enabled: false }]);
  });

  it('Settings listens for it', () => {
    const settings = readFileSync(new URL('../../pages/Settings.jsx', import.meta.url), 'utf8');
    expect(settings).toContain('window.addEventListener(WEEKLY_NOTES_CHANGED_EVENT, onChanged)');
    const auth = readFileSync(new URL('../AuthContext.jsx', import.meta.url), 'utf8');
    expect(auth).toContain('weeklyNotesAfter(outcome, session.user)');
  });
});
