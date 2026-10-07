import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEMO_GECKO_PHOTOS } from '../demoGeckoPhotos';
import { guestMockList } from '../guestMockData';

describe('preview gecko photos', () => {
  it('bundles only age-verified adult photos', () => {
    expect(DEMO_GECKO_PHOTOS.length).toBeGreaterThanOrEqual(6);
    for (const photo of DEMO_GECKO_PHOTOS) {
      expect(photo.hatchDate <= '2024-10-06').toBe(true);
      expect(existsSync(fileURLToPath(new URL(`../../../public${photo.src}`, import.meta.url)))).toBe(true);
    }
  });

  it('populates every guest gecko and gallery card with a bundled real photo', async () => {
    const photos = new Set(DEMO_GECKO_PHOTOS.map(photo => photo.src));
    const geckos = await guestMockList('Gecko');
    const gallery = await guestMockList('GeckoImage');
    expect(geckos.length).toBeGreaterThan(0);
    expect(gallery.length).toBeGreaterThan(0);
    for (const gecko of geckos) {
      expect(gecko.image_urls.length).toBeGreaterThan(0);
      expect(gecko.image_urls.every(src => photos.has(src))).toBe(true);
    }
    expect(gallery.every(image => photos.has(image.image_url))).toBe(true);
  });
});
