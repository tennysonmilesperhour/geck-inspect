import { describe, it, expect } from 'vitest';
import { MORPHS } from '../../data/morph-guide.js';
import { morphSeo, morphDefinition, article, clip } from '../morphMeta.js';

describe('morphMeta', () => {
  it('uses "an" before vowels so no page says "a uncommon"', () => {
    expect(article('uncommon')).toBe('an');
    expect(article('rare')).toBe('a');
    for (const m of MORPHS) expect(morphDefinition(m)).not.toMatch(/\ba [aeiou]/i);
  });

  it('gives every morph a title within 60 characters that names the morph and "Crested Gecko"', () => {
    for (const m of MORPHS) {
      const { title } = morphSeo(m);
      expect(title.length).toBeLessThanOrEqual(60);
      expect(title).toContain(m.name);
      expect(title).toContain('Crested Gecko');
    }
  });

  it('keeps descriptions under 160 characters and free of em dashes', () => {
    for (const m of MORPHS) {
      const { description, definition, title, h1 } = morphSeo(m);
      expect(description.length).toBeLessThanOrEqual(160);
      for (const text of [description, definition, title, h1]) expect(text).not.toContain('—');
    }
  });

  it('prefers a hand-written definition', () => {
    const m = { name: 'Test', definition: 'a Test crested gecko is a made-up morph', rarity: 'common' };
    expect(morphDefinition(m)).toBe('A Test crested gecko is a made-up morph.');
  });

  it('clips at a word boundary', () => {
    expect(clip('one two three four', 12)).toBe('one two…');
  });
});
