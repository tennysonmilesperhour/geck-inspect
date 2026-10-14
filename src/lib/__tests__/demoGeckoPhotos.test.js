import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEMO_GECKO_PHOTOS } from '../demoGeckoPhotos';
import { guestMockList } from '../guestMockData';
import {
  DEMO_BREEDER_ILLUSTRATIVE_PHOTOS,
  DEMO_BREEDER_PHOTO_ASSIGNMENTS,
  DEMO_BREEDER_PHOTO_PLACEHOLDER,
} from '../guestBreederDemo';

const bundled = (src) => existsSync(fileURLToPath(new URL(`../../../public${src}`, import.meta.url)));

describe('preview gecko photos', () => {
  it('keeps the adult-only landing gallery intact', () => {
    expect(DEMO_GECKO_PHOTOS.length).toBeGreaterThanOrEqual(6);
    for (const photo of DEMO_GECKO_PHOTOS) {
      expect(photo.hatchDate <= '2024-10-06').toBe(true);
      expect(bundled(photo.src)).toBe(true);
    }
  });

  it('uses distinct licensed photos only as illustrative guest imagery', async () => {
    const allowed = new Set(DEMO_BREEDER_ILLUSTRATIVE_PHOTOS);
    const geckos = await guestMockList('Gecko');
    const gallery = await guestMockList('GeckoImage');
    expect(geckos).toHaveLength(43);
    expect(geckos.every((gecko) => gecko.photo_is_illustrative === true)).toBe(true);

    const assignedUrls = geckos.flatMap((gecko) => gecko.image_urls || []);
    expect(assignedUrls).toHaveLength(7);
    expect(new Set(assignedUrls).size).toBe(assignedUrls.length);
    for (const gecko of geckos) {
      expect((gecko.image_urls || []).every((src) => allowed.has(src)), gecko.name).toBe(true);
    }
    for (const src of allowed) expect(bundled(src)).toBe(true);

    expect(gallery).toHaveLength(7);
    expect(gallery.every((image) => allowed.has(image.image_url) && image.verified === false)).toBe(true);
    expect(gallery.every((image) => image.photo_is_illustrative === true)).toBe(true);
    expect(gallery.every((image) => image.primary_morph === null && image.secondary_traits.length === 0)).toBe(true);
    expect(gallery.every((image) => /illustrative photo/i.test(image.caption))).toBe(true);

    const breederDemoGeckos = geckos.filter((gecko) => gecko.id?.startsWith('mock-demo-gecko-'));
    expect(breederDemoGeckos).toHaveLength(24);
    expect(Object.keys(DEMO_BREEDER_PHOTO_ASSIGNMENTS)).toHaveLength(7);
    expect(breederDemoGeckos.filter((gecko) => gecko.image_urls.length > 0)).toHaveLength(4);
    expect(breederDemoGeckos.every((gecko) => !gecko.image_urls.length
      || allowed.has(gecko.image_urls[0]))).toBe(true);
    expect(breederDemoGeckos.every((gecko) => /illustrative photo/i.test(gecko.notes))).toBe(true);
    expect(bundled(DEMO_BREEDER_PHOTO_PLACEHOLDER)).toBe(true);
  });

  it('keeps synthetic visible-trait labels and pedigree links coherent', async () => {
    const geckos = await guestMockList('Gecko');
    const named = (name) => geckos.find((gecko) => gecko.name === name);
    expect(named('Pixel').morph_tags).toEqual(['Dalmatian']);
    expect(named('Onyx').morph_tags).toEqual(['Harlequin']);
    expect(named('Cappy').morph_tags).toEqual(['Olive']);
    expect(named('Spud').morph_tags).toEqual(['Pinstripe', 'Harlequin']);
    expect(named('Aria').morph_tags).toEqual(['Harlequin', 'Tricolor']);
    expect(geckos.flatMap((gecko) => gecko.morph_tags)
      .some((tag) => /axanthic|cappuccino|het|full pin|partial pin/i.test(tag))).toBe(false);

    const byId = new Map(geckos.map((gecko) => [gecko.id, gecko]));
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
    const plansById = new Map(plans.map((plan) => [plan.id, plan]));
    const eggs = await guestMockList('Egg');
    for (const egg of eggs.filter((record) => record.gecko_id)) {
      const gecko = byId.get(egg.gecko_id);
      const plan = plansById.get(egg.breeding_plan_id);
      expect(gecko.sire_id, gecko.name).toBe(plan.sire_id);
      expect(gecko.dam_id, gecko.name).toBe(plan.dam_id);
    }
  });
});
