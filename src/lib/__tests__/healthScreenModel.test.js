// The health screen on Claude Sonnet 5.5: the request it sends, what it
// logs, what happens when the model declines, and the vet line that always
// comes back. Runs the real health-screen handler (see edgeHarness.js).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { costCentsFromUsage } from '../../../supabase/functions/_shared/model-cost.ts';
import { FALLBACK_DISCLAIMER } from '../healthScreen';
import { fakeFetch, fakeSupabase, loadFunction, payloadOf, postJson } from './edgeHarness';

const ENV = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  SUPABASE_ANON_KEY: 'anon-key',
  ANTHROPIC_API_KEY: 'sk-ant-test',
};
const USER = { id: 'user-1', email: 'keeper@example.com' };
const SCREEN = {
  stop_reason: 'end_turn',
  usage: { input_tokens: 1800, output_tokens: 700, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  content: [
    { type: 'thinking', thinking: '', signature: 'sig' },
    { type: 'text', text: '{"observations":[{"area":"Tail","finding":"Straight","severity":"looks_typical","note":""}],"overall_note":"Good weight."}' },
  ],
};

function run({ answer = { status: 200, body: SCREEN }, env = {} } = {}) {
  const db = fakeSupabase((call) => {
    if (call.table === 'profiles') return { data: { role: 'user' }, error: null };
    if (call.rpc === 'effective_tier_for_current_user') return { data: 'keeper', error: null };
    if (call.rpc === 'consume_feature_credit') return { data: { credits_included: 5, credits_consumed: 2 }, error: null };
    return undefined;
  }, { user: USER });
  const net = fakeFetch(() => answer);
  const fn = loadFunction('health-screen', {
    env: { ...ENV, ...env },
    globals: { createClient: () => db.client, fetch: net.fetch, costCentsFromUsage },
  });
  const send = () => fn.handle(postJson('https://x.test/', { image_url: 'https://img.test/g.jpg' }, { authorization: 'Bearer jwt' }));
  return { db, net, send };
}

describe('health-screen on Claude Sonnet 5.5', () => {
  it('asks Sonnet 5.5 at low effort with room for its thinking', async () => {
    const { net, send } = run();
    const res = await send();
    expect(res.status).toBe(200);
    const sent = net.requests[0].body;
    expect(sent.model).toBe('claude-sonnet-5-5');
    expect(sent.output_config).toEqual({ effort: 'low' });
    expect(sent.max_tokens).toBe(1200 + 3000);
  });

  it('reads the answer past the thinking block and always adds the vet line', async () => {
    const { send } = run();
    const body = await (await send()).json();
    expect(body.observations).toHaveLength(1);
    expect(body.disclaimer).toMatch(/cannot rule out early metabolic bone disease/);
    expect(body.disclaimer).toMatch(/see an exotics vet/);
    // The page's fallback says the same thing.
    expect(FALLBACK_DISCLAIMER).toBe(body.disclaimer);
  });

  it('logs the screen with its cost', async () => {
    const { db, send } = run();
    await send();
    const row = payloadOf(db.table('model_invocations')[0]);
    expect(row).toMatchObject({ surface: 'health_screen', model: 'claude-sonnet-5-5', user_id: USER.id, photo_count: 1, error_code: null });
    expect(row.est_cost_cents).toBe(costCentsFromUsage('claude-sonnet-5-5', SCREEN.usage));
  });

  it('gives the credit back when the model declines', async () => {
    const { db, send } = run({ answer: { status: 200, body: { stop_reason: 'refusal', content: [], usage: { input_tokens: 5, output_tokens: 0 } } } });
    const res = await send();
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: 'refused', refunded: true });
    expect(db.rpcCalls('refund_feature_credit')).toHaveLength(1);
  });

  it('can be switched to another model with the HEALTH_SCREEN_MODEL secret', async () => {
    const { net, send } = run({ env: { HEALTH_SCREEN_MODEL: 'claude-haiku-5-5' } });
    await send();
    expect(net.requests[0].body.model).toBe('claude-haiku-5-5');
  });

  it('labels a clear area as what the photo shows, not an all-clear', () => {
    const card = readFileSync(new URL('../../components/health/HealthScreenCard.jsx', import.meta.url), 'utf8');
    expect(card).toContain("label: 'Nothing visible in this photo'");
    expect(card).not.toContain("'Looks typical'");
  });
});
