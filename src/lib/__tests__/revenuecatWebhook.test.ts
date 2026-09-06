import { describe, expect, it, vi, afterEach } from 'vitest';
import { affectedUsers, authorizationMatches, fetchMembershipEntitlements, entitlementRow, PRO_ENTITLEMENT, validEvent } from '../../../supabase/functions/_shared/revenuecat';
import { createWebhookHandler } from '../../../supabase/functions/revenuecat-webhook/handler';
import { resolveTier } from '../tierLimits';
import { mirroredMembershipTier, nativePackagePlan } from '../nativeMembership';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const now = Date.parse('2026-09-06T18:00:00Z');
const past = '2026-09-01T00:00:00Z';
const future = '2026-10-01T00:00:00Z';
const event = { id: 'event-1', type: 'RENEWAL', app_user_id: user };
const snapshot = () => ({ request_date_ms: now, subscriber: {
  entitlements: { [PRO_ENTITLEMENT]: { product_identifier: 'monthly', purchase_date: past, expires_date: future, grace_period_expires_date: null as string | null } },
  subscriptions: { monthly: { store: 'app_store', is_sandbox: false, purchase_date: past, unsubscribe_detected_at: null as string | null, refunded_at: null as string | null } },
} });
afterEach(() => vi.restoreAllMocks());

describe('verified subscription state', () => {
  it('grants current Pro and uses the RevenueCat snapshot timestamp', () => {
    expect(entitlementRow(user, snapshot(), event, now)).toMatchObject({ is_active: true, will_renew: true, last_event_at: new Date(now).toISOString() });
  });
  it.each(['CANCELLATION', 'PRODUCT_CHANGE', 'SUBSCRIPTION_PAUSED', 'BILLING_ISSUE', 'SUBSCRIPTION_EXTENDED', 'REFUND_REVERSED'])(
    'uses the current entitlement for %s instead of guessing from event type', (type) => {
      const customer = snapshot();
      customer.subscriber.subscriptions.monthly.unsubscribe_detected_at = past;
      expect(entitlementRow(user, customer, { ...event, type }, now)).toMatchObject({ is_active: true, will_renew: false });
    });
  it('revokes expired access even when the last delivered event was a purchase', () => {
    const customer = snapshot(); customer.subscriber.entitlements[PRO_ENTITLEMENT].expires_date = past;
    expect(entitlementRow(user, customer, event, now).is_active).toBe(false);
  });
  it('preserves access until the verified grace period ends', () => {
    const customer = snapshot();
    customer.subscriber.entitlements[PRO_ENTITLEMENT].expires_date = past;
    customer.subscriber.entitlements[PRO_ENTITLEMENT].grace_period_expires_date = future;
    expect(entitlementRow(user, customer, event, now)).toMatchObject({ is_active: true, expires_at: new Date(future).toISOString() });
  });
  it('revokes a missing or refunded entitlement', () => {
    expect(entitlementRow(user, { subscriber: { entitlements: {} } }, event, now).is_active).toBe(false);
    const customer = snapshot(); customer.subscriber.subscriptions.monthly.refunded_at = past;
    expect(entitlementRow(user, customer, event, now).is_active).toBe(false);
  });
  it('supports lifetime purchases and revokes access after their refund', () => {
    const customer = { subscriber: {
      entitlements: { [PRO_ENTITLEMENT]: { product_identifier: 'lifetime', purchase_date: past, expires_date: null } },
      non_subscriptions: { lifetime: [{ store: 'app_store', purchase_date: past }] },
    } };
    expect(entitlementRow(user, customer, event, now)).toMatchObject({ is_active: true, will_renew: false, expires_at: null });
    customer.subscriber.entitlements = {} as typeof customer.subscriber.entitlements;
    expect(entitlementRow(user, customer, event, now).is_active).toBe(false);
  });
  it.each(['test_store', 'rc_billing', 'stripe'])('does not grant production access from %s sandbox', (store) => {
    const customer = snapshot(); customer.subscriber.subscriptions.monthly.store = store; customer.subscriber.subscriptions.monthly.is_sandbox = true;
    expect(entitlementRow(user, customer, event, now).is_active).toBe(false);
  });
  it.each(['app_store', 'play_store'])('accepts validated %s sandbox receipts for review', (store) => {
    const customer = snapshot(); customer.subscriber.subscriptions.monthly.store = store; customer.subscriber.subscriptions.monthly.is_sandbox = true;
    expect(entitlementRow(user, customer, event, now).is_active).toBe(true);
  });
  it('rejects corrupt API responses so a transient upstream error cannot revoke access', () => {
    expect(() => entitlementRow(user, {} as never, event, now)).toThrow();
    const customer = snapshot(); customer.subscriber.entitlements[PRO_ENTITLEMENT].expires_date = 'invalid';
    expect(() => entitlementRow(user, customer, event, now)).toThrow();
  });
  it('never downgrades Enterprise when Pro or a legacy grant is also active', () => {
    expect(resolveTier({ membership_tier: 'enterprise', revenuecat_pro_active: true })).toBe('enterprise');
    expect(resolveTier({ membership_tier: 'enterprise', subscription_status: 'grandfathered' })).toBe('enterprise');
    expect(resolveTier({ membership_tier: 'keeper', revenuecat_pro_active: true })).toBe('breeder');
  });
});

describe('native membership catalog', () => {
  it.each(['keeper', 'breeder'])('maps the actual %s entitlement without granting another plan', (tier) => {
    const customer = snapshot();
    customer.subscriber.entitlements = { [tier]: customer.subscriber.entitlements[PRO_ENTITLEMENT] } as never;
    const rows = ['keeper', 'breeder', PRO_ENTITLEMENT].map(id => entitlementRow(user, customer, event, now, id));
    expect(mirroredMembershipTier(rows, now)).toBe(tier);
    expect(resolveTier({ revenuecat_tier: tier })).toBe(tier);
    expect(resolveTier({ revenuecat_tier: tier, membership_tier: 'enterprise' })).toBe('enterprise');
  });
  it('clears all supported entitlements when the customer no longer owns them', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ subscriber: { entitlements: {} } })));
    const rows = await fetchMembershipEntitlements(user, event, 'public-key', fetcher);
    expect(rows).toHaveLength(3);
    expect(rows.every(row => !row.is_active)).toBe(true);
  });
  it('rejects unknown or expired mirror rows', () => {
    expect(mirroredMembershipTier([{ entitlement_identifier: 'anything', is_active: true }], now)).toBe('free');
    expect(mirroredMembershipTier([{ entitlement_identifier: 'keeper', is_active: true, expires_at: past }], now)).toBe('free');
    expect(resolveTier({ revenuecat_tier: 'keeper', membership_tier: 'breeder' })).toBe('breeder');
  });
  it.each(['keeper', 'breeder'])('labels custom %s packages from their product and period', (tier) => {
    expect(nativePackagePlan({ packageType: 'CUSTOM', product: { identifier: `com.geckinspect.${tier}.annual` } })).toMatchObject({ tier, period: 'per year' });
    expect(nativePackagePlan({ product: { identifier: `com.geckinspect.${tier}.monthly` } })).toMatchObject({ period: 'per month' });
    expect(nativePackagePlan({ product: { identifier: 'monthly' } })).toBeNull();
  });
});

describe('identity and authorization', () => {
  it('refreshes both sides of a transfer with no app_user_id or entitlement_ids', () => {
    expect(affectedUsers({ id: 'transfer', type: 'TRANSFER', transferred_from: [user, '$RCAnonymousID:old'], transferred_to: [other] })).toEqual([user, other]);
  });
  it('deduplicates UUID aliases and rejects legacy profile/anonymous IDs', () => {
    expect(affectedUsers({ ...event, original_app_user_id: 'legacy', aliases: [user, other] })).toEqual([user, other]);
    expect(affectedUsers({ ...event, app_user_id: 'legacy' })).toEqual([]);
  });
  it('matches exactly, including a configured Bearer prefix', () => {
    expect(authorizationMatches('Bearer secret', 'Bearer secret')).toBe(true);
    expect(authorizationMatches('secret', 'Bearer secret')).toBe(false);
    expect(authorizationMatches('', '')).toBe(false);
  });
  it.each([null, {}, { id: 1, type: 'TEST' }, { id: '1', type: 'TRANSFER', transferred_to: 'bad' }])('rejects malformed event %j', (value) => {
    expect(validEvent(value)).toBe(false);
  });
  it('retries upstream failures instead of returning false success', async () => {
    await expect(fetchMembershipEntitlements(user, event, 'public-key', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))).rejects.toThrow('503');
  });
});

function harness() {
  const deps = { authorization: 'Bearer test-secret', apiKey: 'api-key', fetchEntitlements: vi.fn().mockResolvedValue([{ app_user_id: user }]), alreadyReceived: vi.fn().mockResolvedValue(false), applyEvent: vi.fn().mockResolvedValue(true) };
  return { ...deps, handle: createWebhookHandler(deps) };
}
const request = (ev = event, authorization = 'Bearer test-secret') => new Request('https://example.com/webhook', {
  method: 'POST', headers: { authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ api_version: '1.0', event: ev }),
});

describe('webhook delivery contract', () => {
  it('rejects unauthenticated and malformed requests before touching subscriptions', async () => {
    const h = harness();
    expect((await h.handle(request(event, 'wrong'))).status).toBe(401);
    expect((await h.handle(new Request('https://example.com', { method: 'GET' }))).status).toBe(405);
    expect((await h.handle(new Request('https://example.com', { method: 'POST', headers: { authorization: 'Bearer test-secret' }, body: '{' }))).status).toBe(400);
    expect(h.fetchEntitlements).not.toHaveBeenCalled(); expect(h.applyEvent).not.toHaveBeenCalled();
  });
  it('records TEST delivery without changing anyone’s access', async () => {
    const h = harness(); expect((await h.handle(request({ ...event, type: 'TEST' }))).status).toBe(200);
    expect(h.fetchEntitlements).not.toHaveBeenCalled(); expect(h.applyEvent).toHaveBeenCalledWith(expect.anything(), []);
  });
  it('skips duplicate receipts before the upstream call', async () => {
    const h = harness(); h.alreadyReceived.mockResolvedValue(true);
    expect(await (await h.handle(request())).json()).toMatchObject({ duplicate: true });
    expect(h.fetchEntitlements).not.toHaveBeenCalled(); expect(h.applyEvent).not.toHaveBeenCalled();
  });
  it('commits both transfer owners atomically', async () => {
    const h = harness();
    expect((await h.handle(request({ id: 'transfer', type: 'TRANSFER', transferred_from: [user], transferred_to: [other] } as never))).status).toBe(200);
    expect(h.fetchEntitlements).toHaveBeenCalledTimes(2); expect(h.applyEvent).toHaveBeenCalledTimes(1);
    expect(h.applyEvent.mock.calls[0][1]).toHaveLength(2);
  });
  it('does not record a receipt when either customer lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const h = harness(); h.fetchEntitlements.mockRejectedValue(new Error('timeout'));
    expect((await h.handle(request())).status).toBe(500); expect(h.applyEvent).not.toHaveBeenCalled();
  });
  it('returns 500 if persistence fails, so RevenueCat retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const h = harness(); h.applyEvent.mockRejectedValue(new Error('db unavailable'));
    expect((await h.handle(request())).status).toBe(500);
  });
});
