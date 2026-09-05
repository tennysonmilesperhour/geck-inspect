import { describe, expect, it } from 'vitest';
import {
  CARD_LAYOUTS,
  CARD_STAGES,
  CARD_TYPES,
  STICKER_FINISHES,
  createDefaultDesign,
  designSummary,
  serializeDesign,
  validateDesign,
} from './customSticker';

describe('custom collector-card options', () => {
  it('uses Geck Inspect labels while retaining stable stored values', () => {
    expect(CARD_LAYOUTS.map((option) => option.label)).toEqual([
      'Keeper profile',
      'Full portrait',
    ]);
    expect(CARD_STAGES.map((option) => option.label)).toEqual([
      'Hatchling',
      'Juvenile',
      'Adult',
    ]);
    expect(CARD_TYPES.find((option) => option.value === 'grass')?.label).toBe('Canopy');
  });

  it('offers and persists all three finish choices', () => {
    expect(STICKER_FINISHES.map((option) => option.value)).toEqual([
      'glossy',
      'holographic',
      'matte',
    ]);

    const design = createDefaultDesign();
    expect(serializeDesign({ ...design, finish: 'holographic' }).finish).toBe('holographic');
  });

  it('uses the new customer-facing vocabulary in validation and summaries', () => {
    const design = {
      ...createDefaultDesign(),
      photo_url: '/gecko.webp',
      name: 'Moonlight',
      attacks: [],
    };

    expect(validateDesign(design)).toContain('Name at least one signature move.');
    expect(designSummary(design)).toContain('Canopy · 100 power');
  });
});
