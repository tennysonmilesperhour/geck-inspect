import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEMO_GECKO_PHOTOS } from '../demoGeckoPhotos';
import { guestMockList } from '../guestMockData';
import { DEMO_GECKO_PORTRAITS, demoPortrait } from '../../data/demo-gecko-portraits';

const bundled = (src) => existsSync(fileURLToPath(new URL(`../../../public${src}`, import.meta.url)));

describe('preview gecko photos', () => {
  it('keeps the adult-only landing gallery intact', () => {
    expect(DEMO_GECKO_PHOTOS.length).toBeGreaterThanOrEqual(6);
    for (const photo of DEMO_GECKO_PHOTOS) {
      expect(photo.hatchDate <= '2024-10-06').toBe(true);
      expect(bundled(photo.src)).toBe(true);
    }
  });

  it('uses reviewed, bundled portraits with matching labels in every demo record', async () => {
    const byPhoto = new Map(Object.keys(DEMO_GECKO_PORTRAITS).map((key) => {
      const portrait = demoPortrait(key);
      expect(DEMO_GECKO_PORTRAITS[key].sourceId).toMatch(/^[a-f0-9]{24}$/);
      expect(bundled(portrait.image_urls[0])).toBe(true);
      return [portrait.image_urls[0], portrait];
    }));
    const geckos = await guestMockList('Gecko');
    expect(geckos).toHaveLength(43);
    for (const gecko of geckos) {
      expect(gecko.image_urls, gecko.name).toHaveLength(1);
      const portrait = byPhoto.get(gecko.image_urls[0]);
      expect(portrait, gecko.name).toBeDefined();
      expect(gecko, gecko.name).toMatchObject(portrait);
      expect(gecko.photo_is_illustrative).toBe(true);
    }
    const gallery = await guestMockList('GeckoImage');
    expect(gallery).toHaveLength(geckos.length);
    for (const image of gallery) {
      const gecko = geckos.find((g) => g.id === image.gecko_id);
      expect(image.image_url).toBe(gecko.image_urls[0]);
      expect(image.primary_morph).toBe(gecko.primary_morph);
      expect(image.secondary_traits).toEqual(gecko.morph_tags);
      expect(image.verified).toBe(false);
      expect(image.caption).toMatch(/illustrative photo/i);
    }
    expect(() => demoPortrait('unreviewed-photo')).toThrow('Unreviewed demo portrait');
  });

  it('prevents the visually audited mismatches from returning', async () => {
    const geckos = await guestMockList('Gecko');
    const named = (name) => geckos.find((g) => g.name === name);
    // Frito has black spots, Odin has cream side/leg pattern, and Olivia
    // is olive. None of these photos establishes Axanthic or Cappuccino.
    expect(named('Pixel').morph_tags).toEqual(['Dalmatian']);
    expect(named('Onyx').morph_tags).toEqual(['Harlequin']);
    expect(named('Cappy').morph_tags).toEqual(['Olive']);
    expect(named('Spud').morph_tags).toEqual(['Pinstripe', 'Harlequin']);
    expect(named('Aria').morph_tags).toEqual(['Harlequin', 'Tricolor']);
    expect(geckos.flatMap((g) => g.morph_tags).some((tag) => /axanthic|cappuccino|het|full pin|partial pin/i.test(tag))).toBe(false);
  });

  it('keeps Lilly White pedigrees and hatchling parent links coherent', async () => {
    const geckos = await guestMockList('Gecko');
    const byId = new Map(geckos.map((g) => [g.id, g]));
    const isLilly = (id) => byId.get(id)?.morph_tags.includes('Lilly White');
    for (const gecko of geckos) {
      if (isLilly(gecko.id) && (gecko.sire_id || gecko.dam_id)) {
        expect(isLilly(gecko.sire_id) || isLilly(gecko.dam_id), gecko.name).toBe(true);
      }
    }
    const plans = await guestMockList('BreedingPlan');
    for (const plan of plans) {
      expect(isLilly(plan.sire_id) && isLilly(plan.dam_id), plan.breeding_id).toBe(false);
    }
    const byPlan = new Map(plans.map((p) => [p.id, p]));
    const eggs = await guestMockList('Egg');
    for (const egg of eggs.filter((e) => e.gecko_id)) {
      const gecko = byId.get(egg.gecko_id);
      const plan = byPlan.get(egg.breeding_plan_id);
      expect(gecko.sire_id, gecko.name).toBe(plan.sire_id);
      expect(gecko.dam_id, gecko.name).toBe(plan.dam_id);
    }
  });
});
