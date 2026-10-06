import { describe, it, expect } from 'vitest';
import { MORPHS } from '../../data/morph-guide.js';
import { morphFaq } from '../morphFaq.js';
import { morphSeo } from '../morphMeta.js';

describe('morphFaq', () => {
  it('answers every question with a full sentence and no em or en dashes', () => {
    for (const m of MORPHS) {
      for (const { question, answer } of morphFaq(m)) {
        expect(answer).toMatch(/^[A-Z0-9$]/);
        expect(answer).toMatch(/[.!?]$/);
        expect(answer).not.toMatch(/Look for: Look/);
        for (const text of [question, answer]) expect(text).not.toMatch(/[–—]/);
      }
    }
  });

  it('uses the shared definition for "What is" and only the price range for cost', () => {
    const lilly = MORPHS.find((m) => m.slug === 'lilly-white');
    const faq = morphFaq(lilly);
    expect(faq[0].answer).toBe(morphSeo(lilly).definition);
    const price = faq.find((q) => q.question.startsWith('How much'));
    expect(price.answer).toContain(lilly.priceRange);
    expect(price.answer).not.toMatch(/tier/i);
  });

  it('asks "an Albino", and skips the price question when there is no price', () => {
    const albino = MORPHS.find((m) => m.slug === 'albino');
    const faq = morphFaq(albino);
    expect(faq[0].question).toBe('What is an Albino crested gecko?');
    expect(faq.some((q) => q.question.startsWith('How much'))).toBe(albino.priceRange ? true : false);
  });

  it('adds a difference question for the first lookalike when the data has one', () => {
    const pin = MORPHS.find((m) => m.slug === 'pinstripe');
    const withLookalike = {
      ...pin,
      lookalikes: [{ slug: 'phantom-pinstripe', difference: 'phantom Pinstripe keeps the raised scales dark' }],
    };
    const q = morphFaq(withLookalike).find((x) => x.question.startsWith('What is the difference'));
    expect(q.question).toBe('What is the difference between Pinstripe and Phantom Pinstripe?');
    expect(q.answer).toBe('Phantom Pinstripe keeps the raised scales dark.');
  });
});
