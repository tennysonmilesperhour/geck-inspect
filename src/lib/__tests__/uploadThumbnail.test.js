import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// uploadFile with the Supabase client and the browser resize mocked: the
// photo uploads first, then its thumbnail at thumbs/<the photo's path>,
// and nothing about the thumbnail can fail the photo.
const state = vi.hoisted(() => ({
  uploads: [],
  uploadImpl: null,
  storageBytes: 0,
  thumbnail: null,
  warn: null,
}));

vi.mock('@/lib/supabaseClient', () => {
  const bucket = (name) => ({
    upload: (path, body, options) => {
      state.uploads.push({ bucket: name, path, body, options });
      return state.uploadImpl ? state.uploadImpl(path, body, options) : Promise.resolve({ data: { path }, error: null });
    },
    getPublicUrl: (path) => ({ data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/${name}/${path}` } }),
  });
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: '0551eed0-20cc-4f04-82d7-66bb6f6327ab', email: 'a@example.com' } } }) },
      rpc: async (fn) => (fn === 'get_user_storage_bytes' ? { data: state.storageBytes, error: null } : { data: null, error: { message: 'no' } }),
      storage: { from: bucket },
    },
  };
});
vi.mock('@/lib/userProfile', () => ({ loadUserProfile: async () => ({ email: 'a@example.com', subscription_tier: 'free' }) }));
vi.mock('@/lib/imageResize', () => ({
  isHeicFile: () => false,
  convertHeicForUpload: async (file) => file,
  downscaleImage: async (file) => file,
  makeThumbnail: vi.fn(async () => state.thumbnail),
}));

import { uploadFile, THUMBNAIL_WAIT_MS } from '../uploadFile';
import { makeThumbnail } from '@/lib/imageResize';

const photo = () => new File([new Uint8Array(200_000)], 'IMG_1.webp', { type: 'image/webp' });
const thumb = () => new File([new Uint8Array(25_000)], 'IMG_1.webp', { type: 'image/webp' });

beforeEach(() => {
  state.uploads = [];
  state.uploadImpl = null;
  state.storageBytes = 0;
  state.thumbnail = thumb();
  state.warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  state.warn.mockRestore();
  vi.useRealTimers();
});

describe('uploadFile thumbnails', () => {
  it('uploads the photo, then its thumbnail beside it under thumbs/', async () => {
    const result = await uploadFile({ file: photo() });
    expect(state.uploads).toHaveLength(2);
    const [main, small] = state.uploads;
    expect(main.bucket).toBe('geck-inspect-media');
    expect(main.path).toMatch(/^uploads\/0551eed0-20cc-4f04-82d7-66bb6f6327ab\/[0-9a-f-]{36}\.webp$/);
    expect(small.bucket).toBe('geck-inspect-media');
    expect(small.path).toBe(`thumbs/${main.path}`);
    expect(small.body).toBe(state.thumbnail);
    expect(small.options).toMatchObject({ contentType: 'image/webp', upsert: false });
    // The member gets the photo's own address; the thumbnail's follows from it.
    expect(result.path).toBe(main.path);
    expect(result.file_url).toBe(`https://proj.supabase.co/storage/v1/object/public/geck-inspect-media/${main.path}`);
    // Made from the resized photo that was uploaded.
    expect(makeThumbnail).toHaveBeenCalledWith(main.body);
  });

  it('keeps the photo when the thumbnail upload returns an error', async () => {
    state.uploadImpl = (path) => Promise.resolve(path.startsWith('thumbs/')
      ? { data: null, error: { message: 'The resource already exists' } }
      : { data: { path }, error: null });
    const result = await uploadFile({ file: photo() });
    expect(result.file_url).toContain('/geck-inspect-media/uploads/');
    expect(state.uploads.map((u) => u.path.startsWith('thumbs/'))).toEqual([false, true]);
    expect(state.warn).toHaveBeenCalled();
  });

  it('keeps the photo when the thumbnail upload throws', async () => {
    state.uploadImpl = (path) => (path.startsWith('thumbs/')
      ? Promise.reject(new Error('network down'))
      : Promise.resolve({ data: { path }, error: null }));
    const result = await uploadFile({ file: photo() });
    expect(result.path).toMatch(/^uploads\//);
  });

  it('stops waiting for a stalled thumbnail upload', async () => {
    vi.useFakeTimers();
    state.uploadImpl = (path) => (path.startsWith('thumbs/')
      ? new Promise(() => {}) // never settles
      : Promise.resolve({ data: { path }, error: null }));
    const pending = uploadFile({ file: photo() });
    await vi.advanceTimersByTimeAsync(THUMBNAIL_WAIT_MS);
    const result = await pending;
    expect(result.path).toMatch(/^uploads\//);
  });

  it('uploads only the photo when no thumbnail could be made (a GIF, an undecodable photo)', async () => {
    state.thumbnail = null;
    const result = await uploadFile({ file: photo() });
    expect(state.uploads).toHaveLength(1);
    expect(result.path).toMatch(/^uploads\//);
  });

  it('does not upload anything when the photo itself fails', async () => {
    state.uploadImpl = () => Promise.resolve({ data: null, error: { message: 'Payload too large' } });
    await expect(uploadFile({ file: photo() })).rejects.toThrow('Image upload failed: Payload too large');
    expect(state.uploads).toHaveLength(1);
  });

  it('counts the thumbnail in the storage quota check', async () => {
    // Free plan, 1 GB. The photo alone fits; the photo and its thumbnail do not.
    state.storageBytes = 1024 ** 3 - 210_000;
    await expect(uploadFile({ file: photo() })).rejects.toThrow('Storage quota reached');
    expect(state.uploads).toHaveLength(0);
    state.thumbnail = null;
    await expect(uploadFile({ file: photo() })).resolves.toMatchObject({ path: expect.stringMatching(/^uploads\//) });
  });
});
