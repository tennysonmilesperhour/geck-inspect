import { describe, expect, it } from 'vitest';
import { morphHeadline } from '../morphHeadline';

describe('morphHeadline', () => {
  it('names a plain pattern by itself', () => {
    expect(morphHeadline('harlequin', []).name).toBe('Harlequin');
    expect(morphHeadline('pinstripe').name).toBe('Pinstripe');
  });

  it('drops Harlequin when a genetic morph is present', () => {
    expect(morphHeadline('harlequin', ['lily_white'])).toMatchObject({
      name: 'Lilly White',
      pattern: 'Harlequin',
      patternInName: false,
    });
  });

  it('stacks a genetic morph after any other pattern', () => {
    expect(morphHeadline('pinstripe', ['white_wall']).name).toBe('Pinstripe White Wall');
    expect(morphHeadline('tricolor', ['lily_white']).name).toBe('Tricolor Lilly White');
    expect(morphHeadline('extreme_harlequin', ['lily_white']).name).toBe('Extreme Harlequin Lilly White');
  });

  it('orders stacked genetic morphs the way breeders list them', () => {
    expect(morphHeadline('harlequin', ['lily_white', 'axanthic']).name).toBe('Axanthic Lilly White');
    expect(morphHeadline('pinstripe', ['lily_white', 'soft_scale', 'white_wall']).name)
      .toBe('Pinstripe Soft Scale White Wall Lilly White');
  });

  it('calls Lilly White with Cappuccino a Frappuccino', () => {
    expect(morphHeadline('harlequin', ['lily_white', 'cappuccino']).name).toBe('Frappuccino');
    expect(morphHeadline('dalmatian', ['frappuccino', 'lily_white']).name).toBe('Dalmatian Frappuccino');
  });

  it('reads any Axanthic line as Axanthic and ignores traits that do not lead', () => {
    expect(morphHeadline('harlequin', ['axanthic_vca']).name).toBe('Axanthic');
    expect(morphHeadline('harlequin', ['phantom_expression', 'hypo']).name).toBe('Harlequin');
  });

  it('returns an empty name when there is nothing to name', () => {
    expect(morphHeadline('', []).name).toBe('');
  });
});
