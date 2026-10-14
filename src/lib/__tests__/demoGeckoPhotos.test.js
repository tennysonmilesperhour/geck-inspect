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

describe('preview gecko photos', () => {
  it('bundles only age-verified adult photos', () => {
    expect(DEMO_GECKO_PHOTOS.length).toBeGreaterThanOrEqual(6);
    for (const photo of DEMO_GECKO_PHOTOS) {
      expect(photo.hatchDate <= '2024-10-06').toBe(true);
      expect(existsSync(fileURLToPath(new URL(`../../../public${photo.src}`, import.meta.url)))).toBe(true);
    }
    for (const src of DEMO_BREEDER_ILLUSTRATIVE_PHOTOS) {
      expect(existsSync(fileURLToPath(new URL(`../../../public${src}`, import.meta.url)))).toBe(true);
    }
  });

  it('uses only attributable public-domain/CC0 illustrations in guest records', async () => {
    const allowed = new Set([...DEMO_BREEDER_ILLUSTRATIVE_PHOTOS, DEMO_BREEDER_PHOTO_PLACEHOLDER]);
    const geckos = await guestMockList('Gecko');
    const gallery = await guestMockList('GeckoImage');
    expect(geckos.length).toBeGreaterThan(0);
    expect(gallery.length).toBeGreaterThan(0);
    expect(geckos.every(gecko => gecko.photo_is_illustrative === true)).toBe(true);
    const assignedUrls = geckos.flatMap(gecko => gecko.image_urls || []);
    expect(assignedUrls).toHaveLength(7);
    expect(new Set(assignedUrls).size).toBe(assignedUrls.length);
    for (const gecko of geckos) expect((gecko.image_urls || []).every(src => allowed.has(src))).toBe(true);
    expect(gallery.every(image => allowed.has(image.image_url) && image.verified === false)).toBe(true);
    expect(gallery.every(image => /illustrative photo/i.test(image.caption))).toBe(true);
    expect(gallery.every(image => image.photo_is_illustrative === true)).toBe(true);
    expect(gallery.every(image => image.primary_morph === null && image.secondary_traits.length === 0)).toBe(true);
    const breederDemoGeckos = geckos.filter(gecko => gecko.id?.startsWith('mock-demo-gecko-'));
    expect(breederDemoGeckos.length).toBeGreaterThan(0);
    expect(breederDemoGeckos.every(gecko => gecko.photo_is_illustrative === true)).toBe(true);
    expect(Object.keys(DEMO_BREEDER_PHOTO_ASSIGNMENTS)).toHaveLength(7);
    expect(breederDemoGeckos.filter(gecko => gecko.image_urls.length > 0)).toHaveLength(4);
    expect(breederDemoGeckos.every(gecko => !gecko.image_urls.length || DEMO_BREEDER_ILLUSTRATIVE_PHOTOS.includes(gecko.image_urls[0]))).toBe(true);
    expect(breederDemoGeckos.every(gecko => /illustrative photo/i.test(gecko.notes))).toBe(true);
    expect(existsSync(fileURLToPath(new URL(`../../../public${DEMO_BREEDER_PHOTO_PLACEHOLDER}`, import.meta.url)))).toBe(true);
    expect(gallery.filter(image => image.image_url === DEMO_BREEDER_PHOTO_PLACEHOLDER).every(image => !image.verified)).toBe(true);
  });
});
