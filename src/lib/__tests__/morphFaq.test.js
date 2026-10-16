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

  it('never gives a super form or a mix of genes the one-copy inheritance text', () => {
    // The generic incomplete-dominant text ("Single copy produces a visible
    // form; two copies produce a distinct super form") was said about the
    // two-copy forms themselves and about Luwak, "never a super", in the
    // same answer that then said otherwise. Search engines quote it.
    const forms = MORPHS.filter((m) => m.inheritance === 'incomplete-dominant' && (/^super-/.test(m.slug) || ['luwak', 'frappuccino'].includes(m.slug)));
    expect(forms.map((m) => m.slug).sort()).toEqual([
      'frappuccino', 'luwak', 'super-cappuccino', 'super-empty-back', 'super-highway',
      'super-lilly-white', 'super-sable', 'super-soft-scale', 'super-whiteout',
    ]);
    for (const m of forms) {
      const answer = morphFaq(m).find((q) => q.question === `How is ${m.name} inherited?`).answer;
      expect(answer, m.slug).not.toMatch(/Single copy produces a visible form/);
      expect(answer, m.slug).not.toMatch(/classified as/);
      expect(answer.startsWith(m.name), m.slug).toBe(true);
    }
    const luwak = morphFaq(MORPHS.find((m) => m.slug === 'luwak')).find((q) => q.question === 'How is Luwak inherited?').answer;
    expect(luwak).toContain('never a super');
    // A gene's own page keeps the generic text and its note.
    const lilly = morphFaq(MORPHS.find((m) => m.slug === 'lilly-white')).find((q) => q.question === 'How is Lilly White inherited?').answer;
    expect(lilly).toMatch(/^Lilly White is classified as incomplete dominant\. Single copy produces a visible form/);
    expect(lilly).toContain('lethal super form');
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
