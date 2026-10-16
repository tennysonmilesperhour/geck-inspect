import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesToRemove, MEDIA_BUCKET } from '../../../supabase/functions/_shared/erasure-files.ts';
import { MEDIA_BUCKET as APP_MEDIA_BUCKET, thumbnailStoragePath } from '../photoThumbnails';

describe('account erasure removes photo thumbnails too', () => {
  it("adds each member photo's thumbnail, the same path uploads write", () => {
    const photos = ['uploads/u1/a.webp', 'base44.app/legacy/b.jpg', 'cover-photos/u1/c.png'];
    const byBucket = filesToRemove(photos.map((path) => ({ bucket: MEDIA_BUCKET, path })));
    const media = byBucket.get(MEDIA_BUCKET);
    for (const path of photos) {
      expect(media).toContain(path);
      expect(media).toContain(thumbnailStoragePath(path));
    }
    expect(media).toHaveLength(6);
    expect(MEDIA_BUCKET).toBe(APP_MEDIA_BUCKET);
  });

  it('leaves GIFs, existing thumbnails and other buckets alone, and skips empty rows', () => {
    const byBucket = filesToRemove([
      { bucket: MEDIA_BUCKET, path: 'uploads/u1/moving.gif' },
      { bucket: MEDIA_BUCKET, path: 'thumbs/uploads/u1/a.webp' },
      { bucket: MEDIA_BUCKET, path: 'uploads/u1/a.webp' },
      { bucket: 'listing-images', path: 'x/y.jpg' },
      null,
      { bucket: MEDIA_BUCKET, path: '' },
    ]);
    expect(byBucket.get(MEDIA_BUCKET).sort()).toEqual(
      ['thumbs/uploads/u1/a.webp', 'uploads/u1/a.webp', 'uploads/u1/moving.gif'].sort(),
    );
    expect(byBucket.get('listing-images')).toEqual(['x/y.jpg']);
  });

  it('both erasure functions use it', () => {
    for (const fn of ['delete-my-account', 'admin-delete-account']) {
      const source = readFileSync(resolve(__dirname, `../../../supabase/functions/${fn}/index.ts`), 'utf8');
      expect(source).toContain('filesToRemove(result.files)');
    }
  });
});
