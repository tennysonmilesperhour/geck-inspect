import { describe, expect, it } from 'vitest';
import {
  defaultWaitlistTitle,
  matchableHatchlings,
  orderedSignups,
  pairingLabel,
  reserveFromSignup,
  waitlistOutcomes,
  waitlistSummary,
} from '../pairingWaitlist';

describe('pairing waitlist outcomes', () => {
  it('lists the likeliest babies with their odds', () => {
    const outcomes = waitlistOutcomes({ morph_tags: ['Axanthic', 'Pinstripe'] }, { morph_tags: ['Het Axanthic', 'Cappuccino'] });
    expect(outcomes).toHaveLength(8);
    expect(outcomes[0].probability).toBeCloseTo(0.125);
    expect(outcomes.map((o) => o.label)).toContain('Visual Axanthic, Pinstripe, Cappuccino');
    const total = outcomes.reduce((s, o) => s + o.probability, 0);
    expect(total).toBeCloseTo(1);
  });

  it('names a plain baby in words and caps the list', () => {
    expect(waitlistOutcomes({ morph_tags: [] }, { morph_tags: [] })).toEqual([
      { label: 'Normal (no listed traits)', probability: 1 },
    ]);
    expect(waitlistOutcomes({ morph_tags: ['Lilly White', 'Harlequin'] }, { morph_tags: ['Harlequin', 'Dalmatian'] }, { max: 3 })).toHaveLength(3);
    expect(waitlistOutcomes(null, null)).toEqual([]);
  });
});

describe('waitlist bookkeeping', () => {
  const geckos = new Map([['s', { name: 'Kiwi' }], ['d', { name: 'Mango' }]]);
  const plan = { sire_id: 's', dam_id: 'd', breeding_season: '2026' };

  it('labels the pairing', () => {
    expect(pairingLabel(plan, geckos)).toBe('Kiwi x Mango (2026)');
    expect(defaultWaitlistTitle(plan, geckos)).toBe('Kiwi x Mango 2026 babies');
  });

  it('keeps line order and skips withdrawn people', () => {
    const rows = orderedSignups([
      { id: 'c', created_date: '2026-09-03', status: 'waiting' },
      { id: 'a', created_date: '2026-09-01', status: 'withdrawn' },
      { id: 'b', created_date: '2026-09-02', status: 'deposit_paid' },
    ]);
    expect(rows.map((r) => [r.id, r.place])).toEqual([['a', null], ['b', 1], ['c', 2]]);
  });

  it('adds up deposits held', () => {
    const summary = waitlistSummary([
      { status: 'waiting' },
      { status: 'deposit_paid', deposit_paid: 100 },
      { status: 'matched', deposit_paid: 150 },
      { status: 'completed', deposit_paid: 100 },
      { status: 'withdrawn', deposit_paid: 100 },
    ]);
    expect(summary).toEqual({ active: 4, deposits: 2, depositTotal: 250, waitingForDeposit: 1, matched: 2 });
  });

  it('offers only unsold babies from this pairing', () => {
    const list = matchableHatchlings(plan, [
      { id: 1, sire_id: 's', dam_id: 'd', status: 'Holdback' },
      { id: 2, sire_id: 's', dam_id: 'd', status: 'Sold' },
      { id: 3, sire_id: 's', dam_id: 'x', status: 'For Sale' },
      { id: 4, sire_id: 's', dam_id: 'd', status: 'For Sale', archived: true },
    ]);
    expect(list.map((g) => g.id)).toEqual([1]);
  });

  it('starts a reserve with the deposit already paid', () => {
    const reserve = reserveFromSignup({
      signup: { name: 'Sam', email: 'sam@example.com', deposit_paid: 100, deposit_paid_on: '2026-09-20', wanted_outcome: 'Lilly White' },
      gecko: { id: 'g1', name: 'Mango x Kiwi 1', asking_price: 450 },
      userEmail: 'breeder@example.com',
      today: '2026-09-29',
    });
    expect(reserve).toMatchObject({
      gecko_id: 'g1', buyer_name: 'Sam', reserve_price: 450, amount_paid: 100, status: 'pending',
      payment_schedule: [{ amount: 100, paid: true, paid_date: '2026-09-20', note: 'Waitlist deposit' }],
    });
    expect(reserve.notes).toContain('sam@example.com');
    expect(reserveFromSignup({ signup: { deposit_paid: 0 }, gecko: {}, today: '2026-09-29' }).payment_schedule).toEqual([]);
  });
});
