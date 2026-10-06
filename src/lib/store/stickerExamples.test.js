import { describe, expect, it } from 'vitest';
import { STICKER_EXAMPLES, exampleAsStartingDesign } from './stickerExamples';
import { validateDesign } from './customSticker';

describe('collector starting templates', () => {
  it('requires a customer photo and name while preserving valid template options', () => {
    for (const example of STICKER_EXAMPLES) {
      const start = exampleAsStartingDesign(example);
      expect(start.photo_url).toBe('');
      expect(start.photo_path).toBe('');
      expect(start.name).toBe('');
      expect(start.morph_line).toBe('');
      expect(start.finish).toBe('glossy');
      if (!example.image) {
        expect(validateDesign({ ...start, name: 'My gecko', photo_url: '/my-gecko.webp' })).toEqual([]);
      }
    }
  });
  it('does not mutate template moves when a customer edits their copy', () => {
    const example = STICKER_EXAMPLES[0];
    const start = exampleAsStartingDesign(example);
    start.attacks[0].name = 'My move';
    expect(example.design.attacks[0].name).toBe('Leaf Leap');
  });
});
