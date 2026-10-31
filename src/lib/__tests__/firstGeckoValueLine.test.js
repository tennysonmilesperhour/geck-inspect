import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/traitValueTable', () => ({ loadTraitValueIndex: vi.fn() }));

const { valueLineText } = await import('@/components/onboarding/ValueEstimateLine');

describe('first gecko payoff value line', () => {
  it('reads as one plain sentence with a rounded dollar figure', () => {
    expect(valueLineText('Mango', 399.6)).toBe('Mango is worth about $400');
    expect(valueLineText('Nimbus', 1250)).toBe('Nimbus is worth about $1,250');
  });

  it('says nothing without a name or a positive value', () => {
    expect(valueLineText('', 400)).toBeNull();
    expect(valueLineText('Mango', 0)).toBeNull();
    expect(valueLineText('Mango', null)).toBeNull();
  });
});
