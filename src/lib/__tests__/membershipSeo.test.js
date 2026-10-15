import { describe, expect, it } from 'vitest';
import { ENTERPRISE_ON_SALE, TIER_PRICING, TRIAL_DAYS } from '../stripe-config';
import { TIER_LIMITS } from '../tierLimits';
import {
  MEMBERSHIP_FAQS,
  MEMBERSHIP_JSON_LD,
  MEMBERSHIP_OFFERS,
  MEMBERSHIP_PLAN_TABLE,
  membershipMetaDescription,
  membershipShellCopy,
} from '../membershipSeo';

const textOf = (value) => JSON.stringify(value);

describe('membership prerender copy', () => {
  it('describes the live plans with the prices on the Membership page', () => {
    expect(membershipMetaDescription()).toBe(
      'Geck Inspect plans for crested gecko keepers and breeders. Free (10 geckos), Keeper ($2.99/mo, $30/yr, or $149 lifetime), Breeder ($5.99/mo, $60/yr, or $349 lifetime), and an Enterprise waitlist. Optional 7-day free trial on monthly and yearly plans. Cancel anytime.',
    );
    expect(membershipMetaDescription()).toContain('lifetime');
    expect(membershipMetaDescription().length).toBeGreaterThanOrEqual(60);
    expect(membershipMetaDescription().length).toBeLessThanOrEqual(320);
  });

  it('puts Free, Keeper, Breeder, and the 7-day trial in the plan table', () => {
    const rows = Object.fromEntries(MEMBERSHIP_PLAN_TABLE.rows.map((row) => [row[0], row]));
    expect(rows.Free[1]).toBe('$0');
    expect(rows.Free[2]).toContain(`Up to ${TIER_LIMITS.free.maxGeckos} geckos`);
    expect(rows.Keeper[1]).toBe(`${TIER_PRICING.keeper.monthly.price}/mo or ${TIER_PRICING.keeper.annual.price}/yr or ${TIER_PRICING.keeper.lifetime.price} one-time`);
    expect(rows.Keeper[2]).toContain(`Up to ${TIER_LIMITS.keeper.maxGeckos} geckos`);
    expect(rows.Keeper[2]).toContain(`${TRIAL_DAYS}-day free trial`);
    expect(rows.Breeder[1]).toBe(`${TIER_PRICING.breeder.monthly.price}/mo or ${TIER_PRICING.breeder.annual.price}/yr or ${TIER_PRICING.breeder.lifetime.price} one-time`);
    expect(rows.Breeder[2]).toContain('Unlimited geckos');
    expect(rows.Breeder[2]).toContain(`${TRIAL_DAYS}-day free trial`);
    // Enterprise is off sale (ENTERPRISE_ON_SALE false): no price is published.
    expect(ENTERPRISE_ON_SALE).toBe(false);
    expect(rows.Enterprise[1]).toBe('Waitlist');
    expect(rows.Enterprise[2]).toContain('Not on sale right now');
  });

  it('lists live lifetime prices as one-time payments', () => {
    const flat = MEMBERSHIP_PLAN_TABLE.rows.flat().join(' ');
    expect(flat).toContain(`${TIER_PRICING.keeper.lifetime.price} one-time`);
    expect(flat).toContain(`${TIER_PRICING.breeder.lifetime.price} one-time`);
    expect(MEMBERSHIP_PLAN_TABLE.rows.find((row) => row[0] === 'Enterprise')[1]).not.toContain('one-time');
  });

  it('answers trial, cancel, and export with the page wording', () => {
    const byQuestion = Object.fromEntries(MEMBERSHIP_FAQS.map((item) => [item.q, item.a]));
    expect(byQuestion['Can I try a paid plan before subscribing?']).toContain(`${TRIAL_DAYS}-day free trial`);
    expect(byQuestion['Can I cancel anytime?']).toContain('cancelled at any time');
    expect(byQuestion['Can I export my records?']).toContain('CSV or PDF');
    expect(byQuestion['How much does Geck Inspect cost?']).toContain('Keeper at $2.99 a month or $30 a year');
    expect(byQuestion['How much does Geck Inspect cost?']).toContain('Breeder at $5.99 a month or $60 a year');
    expect(byQuestion['How much does Geck Inspect cost?']).toContain('Lifetime is $149 for Keeper and $349 for Breeder');
    expect(byQuestion['Can I buy lifetime access?']).toContain('one-time payment');
    expect(byQuestion['Can I buy lifetime access?']).toContain('not credited');
    expect(textOf(MEMBERSHIP_FAQS)).not.toMatch(/\u2014|\u2013/);
  });

  it('publishes SoftwareApplication Offers for live paid prices only', () => {
    const app = MEMBERSHIP_JSON_LD.find((node) => node['@type'] === 'SoftwareApplication');
    expect(app.offers['@type']).toBe('AggregateOffer');
    expect(app.offers.lowPrice).toBe('0');
    expect(app.offers.priceCurrency).toBe('USD');
    const prices = MEMBERSHIP_OFFERS.map((offer) => `${offer.name} ${offer.price} ${offer.priceCurrency}`);
    expect(prices).toEqual([
      'Geck Inspect Keeper (monthly) 2.99 USD',
      'Geck Inspect Keeper (annual) 30.00 USD',
      'Geck Inspect Keeper (lifetime) 149.00 USD',
      'Geck Inspect Breeder (monthly) 5.99 USD',
      'Geck Inspect Breeder (annual) 60.00 USD',
      'Geck Inspect Breeder (lifetime) 349.00 USD',
    ]);
    // No Enterprise Offer while it is off sale.
    expect(prices.some((p) => p.includes('Enterprise'))).toBe(false);
    expect(MEMBERSHIP_OFFERS.every((offer) => offer['@type'] === 'Offer')).toBe(true);
    const lifetimeOffers = MEMBERSHIP_OFFERS.filter((offer) => offer.name.includes('lifetime'));
    expect(lifetimeOffers.map((offer) => offer.category)).toEqual(['one-time', 'one-time']);
    expect(MEMBERSHIP_OFFERS.filter((offer) => !offer.name.includes('lifetime')).every((offer) => offer.category === 'subscription')).toBe(true);
    expect(app.offers.offers).toBe(MEMBERSHIP_OFFERS);
    const faq = MEMBERSHIP_JSON_LD.find((node) => node['@type'] === 'FAQPage');
    expect(faq.mainEntity.map((q) => q.name)).toEqual(MEMBERSHIP_FAQS.map((item) => item.q));
  });

  it('uses the same opening lines as the Membership page header', () => {
    const copy = membershipShellCopy();
    expect(copy.heading).toBe('Plans for every crested gecko collection');
    expect(copy.lead).toBe(
      'Start free with up to 10 geckos. Upgrade when your collection or your breeding outgrows it, from $2.99 a month.',
    );
    expect(copy.paragraphs[0]).toContain(`${TRIAL_DAYS}-day free trial`);
    expect(copy.paragraphs[0]).toContain('Cancel anytime');
    expect(copy.paragraphs[0]).toContain('Lifetime Keeper is $149');
    expect(copy.paragraphs[0]).toContain('lifetime Breeder is $349');
    expect(copy.paragraphs[0]).toContain('one-time payment');
    expect(copy.paragraphs[1]).toContain('CSV or PDF');
  });
});
