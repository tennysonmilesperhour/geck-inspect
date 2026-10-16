// The cost line every AI function writes to geck_data.model_invocations.
import { describe, expect, it } from 'vitest';
import {
  costCentsFromUsage,
  MODEL_PRICES_USD_PER_MTOK,
  priceKey,
} from '../../../supabase/functions/_shared/model-cost.ts';

describe('costCentsFromUsage', () => {
  it('counts cache writes at 1.25 times input and cache reads at the read price', () => {
    // Sonnet 4.6: $3 in, $15 out, $0.30 cache read, $3.75 cache write.
    const cents = costCentsFromUsage('claude-sonnet-4-6', {
      input_tokens: 1_000_000,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    });
    expect(cents).toBe(300 + 375 + 30);
  });

  it('matches what production Morph ID really cost (25 calls to 14 Oct 2026)', () => {
    // Token totals read from geck_data.model_invocations on 16 Oct 2026
    // (surface morph_id_production, claude-sonnet-4-6). The old formula
    // logged 75.84 cents; with the cache counted it is 89.53 cents, about
    // 3.6 cents a call instead of 3.0.
    const totals = {
      input_tokens: 127_435,
      output_tokens: 25_073,
      cache_creation_input_tokens: 34_638,
      cache_read_input_tokens: 23_457,
    };
    const oldFormula = (totals.input_tokens * 3 + totals.output_tokens * 15) / 1e6 * 100;
    expect(oldFormula).toBeCloseTo(75.84, 2);
    expect(costCentsFromUsage('claude-sonnet-4-6', totals)).toBeCloseTo(89.53, 2);
  });

  it('prices one-hour cache writes at twice the input price', () => {
    const cents = costCentsFromUsage('claude-sonnet-5-5', {
      cache_creation_input_tokens: 1_000_000,
      cache_creation: { ephemeral_1h_input_tokens: 400_000, ephemeral_5m_input_tokens: 600_000 },
    });
    // 0.4M x $2 x 2 + 0.6M x $2 x 1.25 = $1.60 + $1.50
    expect(cents).toBe(310);
  });

  it('has Opus at its real price, not three times it', () => {
    expect(MODEL_PRICES_USD_PER_MTOK['claude-opus-4-7']).toMatchObject({ input: 5, output: 25 });
    expect(MODEL_PRICES_USD_PER_MTOK['claude-opus-5-5']).toMatchObject({ input: 4, output: 20 });
  });

  it('prices Claude Haiku 5.5 and a dated Haiku 4.5 id', () => {
    // 50,000 in at $0.10 and 50,000 out at $0.50 per million: 3 cents.
    expect(costCentsFromUsage('claude-haiku-5-5', { input_tokens: 50_000, output_tokens: 50_000 })).toBe(3);
    expect(priceKey('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5');
    expect(costCentsFromUsage('claude-haiku-4-5-20251001', { input_tokens: 1_000_000 })).toBe(100);
  });

  it('keeps a tiny Haiku 5.5 answer above zero (four decimal places)', () => {
    // 2,000 in and 800 out: $0.0006, a twentieth of a cent.
    expect(costCentsFromUsage('claude-haiku-5-5', { input_tokens: 2000, output_tokens: 800 })).toBe(0.06);
  });

  it('switches Claude Haiku 5.5 to its long-prompt price over 100,000 prompt tokens', () => {
    const cents = costCentsFromUsage('claude-haiku-5-5', { input_tokens: 150_000, output_tokens: 0 });
    expect(cents).toBe(7.5); // 0.15M x $0.50
  });

  it('costs an unknown model or a missing usage block 0 instead of guessing', () => {
    expect(costCentsFromUsage('some-future-model', { input_tokens: 1000 })).toBe(0);
    expect(costCentsFromUsage('claude-sonnet-5-5', null)).toBe(0);
  });
});
