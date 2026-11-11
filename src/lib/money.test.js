import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('adds thousands separators and drops empty cents', () => {
    expect(formatMoney(34975)).toBe('$34,975');
    expect(formatMoney(34975.0)).toBe('$34,975');
    expect(formatMoney(1200000)).toBe('$1,200,000');
  });

  it('keeps cents when the amount has them', () => {
    expect(formatMoney(12.5)).toBe('$12.50');
    expect(formatMoney(7280.37)).toBe('$7,280.37');
    expect(formatMoney(0.5)).toBe('$0.50');
  });

  it('puts the minus sign before the symbol', () => {
    expect(formatMoney(-8895)).toBe('-$8,895');
    expect(formatMoney(-0.004)).toBe('$0');
  });

  it('reads anything that is not a number as zero', () => {
    expect(formatMoney(null)).toBe('$0');
    expect(formatMoney(undefined)).toBe('$0');
    expect(formatMoney('abc')).toBe('$0');
    expect(formatMoney('250')).toBe('$250');
  });

  it('uses the symbol it is given', () => {
    expect(formatMoney(40, { symbol: '£' })).toBe('£40');
    expect(formatMoney(1999.9, { symbol: '€' })).toBe('€1,999.90');
  });

  it('does not round a half cent into the wrong dollar', () => {
    expect(formatMoney(19.999)).toBe('$20');
    expect(formatMoney(19.994)).toBe('$19.99');
  });
});
