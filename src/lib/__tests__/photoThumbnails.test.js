import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  THUMBNAIL,
  forgetMissingThumbnails,
  noteMissingThumbnail,
  thumbnailFirst,
  thumbnailStoragePath,
  thumbnailUrl,
} from '../photoThumbnails';
import { DEFAULT_GECKO_CARD, DEFAULT_GECKO_IMAGE } from '../constants';

const PROJECT = 'https://abcdefghijklmnop.supabase.co';
const MEDIA = `${PROJECT}/storage/v1/object/public/geck-inspect-media`;
const opts = { supabaseUrl: PROJECT };

describe('thumbnailStoragePath', () => {
  it('puts the thumbnail under thumbs/ with the same name', () => {
    expect(thumbnailStoragePath('uploads/0551eed0-20cc-4f04-82d7-66bb6f6327ab/d1a1d5e0.webp'))
      .toBe('thumbs/uploads/0551eed0-20cc-4f04-82d7-66bb6f6327ab/d1a1d5e0.webp');
    expect(thumbnailStoragePath('base44.app/api/apps/x/files/public/x/0be42abb4_PXL.jpg'))
      .toBe('thumbs/base44.app/api/apps/x/files/public/x/0be42abb4_PXL.jpg');
  });

  it('gives GIFs, thumbnails and unsafe paths no thumbnail', () => {
    expect(thumbnailStoragePath('uploads/a/b.gif')).toBeNull();
    expect(thumbnailStoragePath('uploads/a/b.GIF')).toBeNull();
    expect(thumbnailStoragePath('thumbs/uploads/a/b.webp')).toBeNull();
    expect(thumbnailStoragePath('uploads/../b.webp')).toBeNull();
    expect(thumbnailStoragePath('uploads//b.webp')).toBeNull();
    expect(thumbnailStoragePath('')).toBeNull();
    expect(thumbnailStoragePath(null)).toBeNull();
  });
});

describe('thumbnailUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('maps a public photo in the media bucket to its thumbnail', () => {
    expect(thumbnailUrl(`${MEDIA}/uploads/u1/p1.webp`, opts))
      .toBe(`${MEDIA}/thumbs/uploads/u1/p1.webp`);
    expect(thumbnailUrl(`${MEDIA}/base44.app/api/apps/a/files/public/a/f_IMG_1.jpeg`, opts))
      .toBe(`${MEDIA}/thumbs/base44.app/api/apps/a/files/public/a/f_IMG_1.jpeg`);
  });

  it('keeps percent-encoding and drops a query string', () => {
    expect(thumbnailUrl(`${MEDIA}/uploads/u1/my%20photo.jpg?t=123#x`, opts))
      .toBe(`${MEDIA}/thumbs/uploads/u1/my%20photo.jpg`);
  });

  it('returns null for other buckets', () => {
    expect(thumbnailUrl(`${PROJECT}/storage/v1/object/public/listing-images/3833406/1.webp`, opts)).toBeNull();
    expect(thumbnailUrl(`${PROJECT}/storage/v1/object/public/promote-images/u1/p.webp`, opts)).toBeNull();
    expect(thumbnailUrl(`${PROJECT}/storage/v1/object/public/geck-inspect-media-old/u1/p.webp`, opts)).toBeNull();
  });

  it('returns null for private and transformed addresses in the same bucket', () => {
    expect(thumbnailUrl(`${PROJECT}/storage/v1/object/sign/geck-inspect-media/u1/p.webp?token=x`, opts)).toBeNull();
    expect(thumbnailUrl(`${PROJECT}/storage/v1/render/image/public/geck-inspect-media/u1/p.webp`, opts)).toBeNull();
  });

  it('returns null for outside hosts, even with the same path', () => {
    expect(thumbnailUrl('https://evil.example/storage/v1/object/public/geck-inspect-media/u1/p.webp', opts)).toBeNull();
    expect(thumbnailUrl('https://otherproject.supabase.co/storage/v1/object/public/geck-inspect-media/u1/p.webp', opts)).toBeNull();
    expect(thumbnailUrl('http://abcdefghijklmnop.supabase.co/storage/v1/object/public/geck-inspect-media/u1/p.webp', opts)).toBeNull();
  });

  it('returns null for data:, blob:, placeholders, relative paths and junk', () => {
    expect(thumbnailUrl('data:image/png;base64,iVBORw0KGgo=', opts)).toBeNull();
    expect(thumbnailUrl(`blob:${PROJECT}/0d3c2e1f`, opts)).toBeNull();
    expect(thumbnailUrl(DEFAULT_GECKO_IMAGE, opts)).toBeNull();
    expect(thumbnailUrl(DEFAULT_GECKO_CARD, opts)).toBeNull();
    expect(thumbnailUrl('/images/gecko.jpg', opts)).toBeNull();
    expect(thumbnailUrl('', opts)).toBeNull();
    expect(thumbnailUrl(undefined, opts)).toBeNull();
    expect(thumbnailUrl({ url: `${MEDIA}/u1/p.webp` }, opts)).toBeNull();
  });

  it('returns null for GIFs and for an address that is already a thumbnail', () => {
    expect(thumbnailUrl(`${MEDIA}/uploads/u1/dance.gif`, opts)).toBeNull();
    expect(thumbnailUrl(`${MEDIA}/thumbs/uploads/u1/p1.webp`, opts)).toBeNull();
  });

  it('returns null when no project URL is configured', () => {
    expect(thumbnailUrl(`${MEDIA}/uploads/u1/p1.webp`, { supabaseUrl: '' })).toBeNull();
    expect(thumbnailUrl(`${MEDIA}/uploads/u1/p1.webp`, { supabaseUrl: 'not a url' })).toBeNull();
  });

  it('reads the project URL from VITE_SUPABASE_URL by default', () => {
    vi.stubEnv('VITE_SUPABASE_URL', PROJECT);
    expect(thumbnailUrl(`${MEDIA}/uploads/u1/p1.webp`)).toBe(`${MEDIA}/thumbs/uploads/u1/p1.webp`);
  });
});

describe('thumbnailFirst', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('tries the thumbnail first for slots up to the thumbnail size', () => {
    vi.stubEnv('VITE_SUPABASE_URL', PROJECT);
    const photo = `${MEDIA}/uploads/u1/p1.webp`;
    expect(thumbnailFirst(photo, 96)).toEqual([`${MEDIA}/thumbs/uploads/u1/p1.webp`, photo]);
    expect(thumbnailFirst(photo, THUMBNAIL.maxEdge)).toEqual([`${MEDIA}/thumbs/uploads/u1/p1.webp`, photo]);
  });

  it('loads the photo itself for large or unsized slots and for photos with no thumbnail', () => {
    vi.stubEnv('VITE_SUPABASE_URL', PROJECT);
    const photo = `${MEDIA}/uploads/u1/p1.webp`;
    expect(thumbnailFirst(photo, THUMBNAIL.maxEdge + 1)).toEqual([photo]);
    expect(thumbnailFirst(photo, 800)).toEqual([photo]);
    expect(thumbnailFirst(photo)).toEqual([photo]);
    expect(thumbnailFirst(photo, 0)).toEqual([photo]);
    expect(thumbnailFirst('https://cdn.example/x.jpg', 96)).toEqual(['https://cdn.example/x.jpg']);
    expect(thumbnailFirst('   ', 96)).toEqual([]);
  });

  it('documents the size the thumbnails are made at', () => {
    expect(THUMBNAIL.maxEdge).toBe(480);
    expect(THUMBNAIL.quality).toBeCloseTo(0.75);
  });
});

// Until 16 Oct 2026 each card that mounted asked for a missing thumbnail
// again: a failed request before every photo, on every screen.
describe('a thumbnail that failed once in this visit', () => {
  const photo = `${MEDIA}/uploads/u1/p1.webp`;
  const thumb = `${MEDIA}/thumbs/uploads/u1/p1.webp`;
  afterEach(() => {
    forgetMissingThumbnails();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is skipped from then on, and the photo is tried straight away', () => {
    vi.stubEnv('VITE_SUPABASE_URL', PROJECT);
    noteMissingThumbnail(thumb);
    expect(thumbnailFirst(photo, 96)).toEqual([photo]);
    // Other photos still try their own thumbnails.
    const other = `${MEDIA}/uploads/u1/p2.webp`;
    expect(thumbnailFirst(other, 96)).toEqual([`${MEDIA}/thumbs/uploads/u1/p2.webp`, other]);
  });

  it('never skips a photo itself, whatever address is reported', () => {
    vi.stubEnv('VITE_SUPABASE_URL', PROJECT);
    noteMissingThumbnail(photo);
    noteMissingThumbnail('https://cdn.example/x.jpg');
    noteMissingThumbnail(null);
    expect(thumbnailFirst(photo, 96)).toEqual([thumb, photo]);
    expect(thumbnailFirst('https://cdn.example/x.jpg', 96)).toEqual(['https://cdn.example/x.jpg']);
  });

  it('is not remembered with no signal, when every address fails', () => {
    vi.stubEnv('VITE_SUPABASE_URL', PROJECT);
    vi.stubGlobal('navigator', { onLine: false });
    noteMissingThumbnail(thumb);
    expect(thumbnailFirst(photo, 96)).toEqual([thumb, photo]);
  });

  it('is forgotten on request (each new visit starts empty)', () => {
    vi.stubEnv('VITE_SUPABASE_URL', PROJECT);
    noteMissingThumbnail(thumb);
    forgetMissingThumbnails();
    expect(thumbnailFirst(photo, 96)).toEqual([thumb, photo]);
  });
});
