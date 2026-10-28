import { beforeEach, describe, expect, it, vi } from 'vitest';

// Make a passport on the gecko record: a code, Public display on, and one
// funnel event that says whether the gecko was already public.
const state = vi.hoisted(() => ({ updates: [], events: [] }));
vi.mock('@/entities/all', () => ({
  Gecko: { update: vi.fn(async (id, fields) => { state.updates.push([id, fields]); return { id, ...fields }; }) },
}));
vi.mock('@/lib/posthog', () => ({ captureEvent: (name, props) => state.events.push([name, props]) }));

const { makePassport } = await import('../makePassport');

beforeEach(() => {
  state.updates.length = 0;
  state.events.length = 0;
});

describe('makePassport', () => {
  it('saves a code with Public display on and returns those fields', async () => {
    const fields = await makePassport({ id: 'g1', name: 'Mango', is_public: false });
    expect(fields).toEqual({ passport_code: expect.stringMatching(/^GI-\d{4}-[A-Z2-9]{4}$/), is_public: true });
    expect(state.updates).toEqual([['g1', fields]]);
  });

  it('says whether the gecko was already public, and null when the row did not say', async () => {
    await makePassport({ id: 'g1', is_public: true });
    await makePassport({ id: 'g2', is_public: false });
    // A row loaded without is_public: unknown, not "already public".
    await makePassport({ id: 'g3' });
    await makePassport({ id: 'g4', is_public: null });
    expect(state.events).toEqual([
      ['passport_created', { surface: 'record', was_public: true }],
      ['passport_created', { surface: 'record', was_public: false }],
      ['passport_created', { surface: 'record', was_public: null }],
      ['passport_created', { surface: 'record', was_public: null }],
    ]);
    // No code, name or id in the event.
    expect(JSON.stringify(state.events)).not.toMatch(/GI-|Mango|g1/);
  });
});
