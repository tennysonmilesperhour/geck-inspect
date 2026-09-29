import { describe, expect, it } from 'vitest';
import { FIRED_STATES } from '@/components/morph-id/morphTaxonomy';
import {
  FIRE_SLOTS,
  assignFireState,
  fireStatePhotos,
  hasFireStatePhotos,
  photoFireState,
} from '../fireStatePhotos';

describe('fire-state photo slots', () => {
  it('use the same ids and labels as Morph ID', () => {
    for (const slot of FIRE_SLOTS) {
      const state = FIRED_STATES.find((s) => s.id === slot.id);
      expect(state?.label).toBe(slot.label);
    }
  });

  it('find the photo in each slot, in photo order', () => {
    const gecko = {
      image_urls: ['a.jpg', 'b.jpg', 'c.jpg'],
      image_crop_data: {
        'a.jpg': { x: 50, y: 50 },
        'b.jpg': { fire_state: 'fired_down' },
        'c.jpg': { fire_state: 'fired_up' },
        'gone.jpg': { fire_state: 'fired_up' },
      },
    };
    expect(fireStatePhotos(gecko)).toEqual({ fired_up: 'c.jpg', fired_down: 'b.jpg' });
    expect(hasFireStatePhotos(gecko)).toBe(true);
  });

  it('ignore removed photos, unknown states and missing data', () => {
    expect(fireStatePhotos({ image_urls: ['a.jpg'], image_crop_data: { 'b.jpg': { fire_state: 'fired_up' } } }))
      .toEqual({ fired_up: null, fired_down: null });
    expect(photoFireState({ 'a.jpg': { fire_state: 'transitioning' } }, 'a.jpg')).toBe('');
    expect(hasFireStatePhotos({})).toBe(false);
    expect(hasFireStatePhotos(null)).toBe(false);
  });

  it('keep one photo per state when tagging', () => {
    const start = {
      'a.jpg': { x: 20, y: 30, fire_state: 'fired_up', life_stage: 'adult' },
      'b.jpg': { x: 50, y: 50 },
    };
    const next = assignFireState(start, 'b.jpg', 'fired_up');
    expect(next['a.jpg']).toEqual({ x: 20, y: 30, life_stage: 'adult' });
    expect(next['b.jpg']).toEqual({ x: 50, y: 50, fire_state: 'fired_up' });
    expect(start['a.jpg'].fire_state).toBe('fired_up');
  });

  it('clear a tag and give new photos the default crop', () => {
    const tagged = assignFireState({}, 'new.jpg', 'fired_down');
    expect(tagged['new.jpg']).toEqual({ x: 50, y: 50, fire_state: 'fired_down' });
    expect(assignFireState(tagged, 'new.jpg', '')['new.jpg']).toEqual({ x: 50, y: 50 });
  });
});
