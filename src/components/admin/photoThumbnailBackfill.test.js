import { describe, expect, it, vi } from 'vitest';
import {
  makeOneThumbnail,
  planBatch,
  runBackfill,
  sniffImageType,
} from './photoThumbnailBackfill';

const bytes = (...values) => new Uint8Array(values);
const ascii = (text, pad = 0) => new Uint8Array([...text].map((c) => c.charCodeAt(0)).concat(Array(pad).fill(0)));

describe('sniffImageType', () => {
  it('reads the type from the first bytes, not the stored label', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0))).toBe('image/jpeg');
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffImageType(ascii('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffImageType(ascii('GIF89a', 6))).toBe('image/gif');
    expect(sniffImageType(ascii('\0\0\0\x1cftypavif'))).toBe('image/avif');
    expect(sniffImageType(ascii('\0\0\0\x18ftypheic'))).toBe('image/heic');
    expect(sniffImageType(ascii('%PDF-1.7', 4))).toBeNull();
    expect(sniffImageType(bytes(1, 2))).toBeNull();
    expect(sniffImageType(null)).toBeNull();
  });
});

describe('planBatch', () => {
  it('works on new photos and skips GIFs, thumbnails and names already tried this run', () => {
    const rows = [
      { name: 'base44.app/x/a.jpeg' },
      { name: 'uploads/u/b.gif' },
      { name: 'thumbs/uploads/u/c.webp' },
      { name: 'uploads/u/d.webp' },
      { name: 'uploads/u/e.png' },
    ];
    const { work, skipped, cursor } = planBatch(rows, new Set(['uploads/u/d.webp']));
    expect(work.map((r) => r.name)).toEqual(['base44.app/x/a.jpeg', 'uploads/u/e.png']);
    expect(skipped.map((r) => r.name)).toEqual(['uploads/u/b.gif', 'thumbs/uploads/u/c.webp', 'uploads/u/d.webp']);
    expect(cursor).toBe('uploads/u/e.png');
  });

  it('has no cursor for an empty page', () => {
    expect(planBatch([], new Set())).toEqual({ work: [], skipped: [], cursor: null });
    expect(planBatch(undefined)).toEqual({ work: [], skipped: [], cursor: null });
  });
});

// A fake database function over a fixed list: returns the photos still
// needing a thumbnail after the cursor, like admin_photos_without_thumbnail.
function fakeBucket(names) {
  const done = new Set();
  const calls = [];
  const fetchPage = vi.fn(async (after, limit) => {
    calls.push(after);
    const needing = names.filter((n) => !done.has(n)).sort();
    return needing
      .filter((n) => after === null || n > after)
      .slice(0, limit)
      .map((name) => ({ name, total_needing: needing.length }));
  });
  return { fetchPage, done, calls };
}

describe('runBackfill', () => {
  const names = Array.from({ length: 7 }, (_, i) => `uploads/u/p${i}.webp`);

  it('works through every page in batches and reports progress', async () => {
    const bucket = fakeBucket(names);
    const makeOne = vi.fn(async (row) => { bucket.done.add(row.name); return 'made'; });
    const progress = [];
    const result = await runBackfill({
      fetchPage: bucket.fetchPage,
      makeOne,
      pageSize: 3,
      concurrency: 2,
      onProgress: (p) => progress.push(p),
    });
    expect(result).toMatchObject({ made: 7, failed: 0, skipped: 0, total: 7, stopped: false });
    expect(makeOne).toHaveBeenCalledTimes(7);
    // Pages of 3, each after the last name of the one before.
    expect(bucket.calls).toEqual([null, 'uploads/u/p2.webp', 'uploads/u/p5.webp', 'uploads/u/p6.webp']);
    expect(progress.at(-1)).toMatchObject({ made: 7, current: null });
    expect(progress.some((p) => p.current === 'uploads/u/p4.webp')).toBe(true);
  });

  it('counts failures without stopping, and never retries them in the same run', async () => {
    const bucket = fakeBucket(names);
    const makeOne = vi.fn(async (row) => {
      if (row.name.endsWith('p1.webp') || row.name.endsWith('p4.webp')) throw new Error('could not draw');
      bucket.done.add(row.name);
      return 'made';
    });
    const result = await runBackfill({ fetchPage: bucket.fetchPage, makeOne, pageSize: 2, concurrency: 1 });
    expect(result.made).toBe(5);
    expect(result.failed).toBe(2);
    expect(result.failures).toEqual([
      { name: 'uploads/u/p1.webp', message: 'could not draw' },
      { name: 'uploads/u/p4.webp', message: 'could not draw' },
    ]);
    expect(makeOne).toHaveBeenCalledTimes(7);
  });

  it('stops when asked and the next run carries on with what is left', async () => {
    const bucket = fakeBucket(names);
    let stop = false;
    const makeOne = vi.fn(async (row) => {
      bucket.done.add(row.name);
      if (bucket.done.size === 3) stop = true;
      return 'made';
    });
    const first = await runBackfill({
      fetchPage: bucket.fetchPage, makeOne, pageSize: 2, concurrency: 1, shouldStop: () => stop,
    });
    expect(first).toMatchObject({ made: 3, stopped: true, total: 7 });

    // Resume: photos that already have a thumbnail are no longer listed.
    stop = false;
    makeOne.mockClear();
    const second = await runBackfill({ fetchPage: bucket.fetchPage, makeOne, pageSize: 2, concurrency: 1 });
    expect(second).toMatchObject({ made: 4, failed: 0, total: 4, stopped: false });
    expect(makeOne.mock.calls.map(([row]) => row.name)).toEqual(names.slice(3));
  });

  it('counts photos it decides to skip (GIFs found by their bytes) separately', async () => {
    const bucket = fakeBucket(['a.jpg', 'b.jpg', 'c.gif']);
    const makeOne = vi.fn(async (row) => {
      bucket.done.add(row.name);
      return row.name === 'b.jpg' ? 'skipped' : 'made';
    });
    const result = await runBackfill({ fetchPage: bucket.fetchPage, makeOne, pageSize: 10 });
    // c.gif is skipped by name before any download; b.jpg turned out to be a GIF.
    expect(result).toMatchObject({ made: 1, skipped: 2, failed: 0 });
    expect(makeOne).toHaveBeenCalledTimes(2);
  });

  it('ends instead of looping when a page does not move the cursor', async () => {
    const fetchPage = vi.fn(async () => [{ name: 'same.jpg', total_needing: 1 }]);
    const makeOne = vi.fn(async () => { throw new Error('nope'); });
    const result = await runBackfill({ fetchPage, makeOne });
    expect(result.failed).toBe(1);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('lets a failed page fetch end the run with an error', async () => {
    const fetchPage = vi.fn(async () => { throw new Error('network'); });
    await expect(runBackfill({ fetchPage, makeOne: vi.fn() })).rejects.toThrow('network');
  });
});

describe('makeOneThumbnail', () => {
  const jpegBlob = () => new Blob([bytes(0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8)], { type: 'application/octet-stream' });

  const PUBLIC = 'https://proj.supabase.co/storage/v1/object/public/geck-inspect-media';

  // Storage that serves public addresses and records uploads, plus a fetch
  // that answers those addresses (status 404 for `missing`, a thrown
  // network error for `offline`).
  function fakeStorage({ blob = jpegBlob(), status = 200, offline = false, uploadError = null } = {}) {
    const uploads = [];
    const from = vi.fn((bucket) => ({
      getPublicUrl: (path) => ({ data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
      upload: vi.fn(async (path, body, options) => {
        uploads.push({ path, body, options });
        return { data: uploadError ? null : { path }, error: uploadError };
      }),
    }));
    const fetchImpl = vi.fn(async () => {
      if (offline) throw new Error('Failed to fetch');
      return { ok: status === 200, status, blob: async () => blob };
    });
    return { storage: { from }, uploads, from, fetchImpl };
  }

  it('reads a photo stored as octet-stream as a JPEG and uploads its thumbnail over any planted one', async () => {
    const { storage, uploads, from, fetchImpl } = fakeStorage();
    const thumb = new File([bytes(1, 2, 3)], 'f.webp', { type: 'image/webp' });
    const makeThumbnail = vi.fn(async () => thumb);
    const outcome = await makeOneThumbnail(
      { name: 'base44.app/api/apps/a/files/public/a/f_IMG_1.jpeg' },
      { storage, makeThumbnail, convertHeic: vi.fn(), fetchImpl },
    );
    expect(outcome).toBe('made');
    expect(from).toHaveBeenCalledWith('geck-inspect-media');
    // Downloaded from the public address members' browsers use.
    expect(fetchImpl).toHaveBeenCalledWith(`${PUBLIC}/base44.app/api/apps/a/files/public/a/f_IMG_1.jpeg`);
    expect(makeThumbnail.mock.calls[0][0].type).toBe('image/jpeg');
    expect(uploads).toEqual([{
      path: 'thumbs/base44.app/api/apps/a/files/public/a/f_IMG_1.jpeg',
      body: thumb,
      options: { contentType: 'image/webp', cacheControl: '3600', upsert: true },
    }]);
  });

  it('converts HEIC before drawing', async () => {
    const heic = new Blob([ascii('\0\0\0\x18ftypheic', 4)]);
    const { storage, fetchImpl } = fakeStorage({ blob: heic });
    const jpeg = new File([bytes(1)], 'x.jpg', { type: 'image/jpeg' });
    const convertHeic = vi.fn(async () => jpeg);
    const makeThumbnail = vi.fn(async () => new File([bytes(1)], 'x.webp', { type: 'image/webp' }));
    await makeOneThumbnail({ name: 'uploads/u/x.jpg' }, { storage, makeThumbnail, convertHeic, fetchImpl });
    expect(convertHeic).toHaveBeenCalled();
    expect(makeThumbnail).toHaveBeenCalledWith(jpeg);
  });

  it('skips a GIF found by its bytes', async () => {
    const { storage, uploads, fetchImpl } = fakeStorage({ blob: new Blob([ascii('GIF89a', 10)]) });
    const outcome = await makeOneThumbnail({ name: 'uploads/u/x.jpg' }, { storage, makeThumbnail: vi.fn(), convertHeic: vi.fn(), fetchImpl });
    expect(outcome).toBe('skipped');
    expect(uploads).toHaveLength(0);
  });

  it('throws (so the run counts a failure) when a step fails', async () => {
    const deps = { makeThumbnail: vi.fn(async () => new File([bytes(1)], 'x.webp', { type: 'image/webp' })), convertHeic: vi.fn() };
    const run = (storageOpts, extra = {}) => {
      const fake = fakeStorage(storageOpts);
      return makeOneThumbnail({ name: 'a.jpg' }, { ...deps, storage: fake.storage, fetchImpl: fake.fetchImpl, ...extra });
    };
    await expect(run({ status: 404 })).rejects.toThrow('Could not download the photo (HTTP 404)');
    await expect(run({ offline: true })).rejects.toThrow('Could not download the photo: Failed to fetch');
    await expect(run({ blob: new Blob([ascii('%PDF-1.7', 8)]) })).rejects.toThrow('Not an image');
    await expect(run({}, { makeThumbnail: vi.fn(async () => null) })).rejects.toThrow('could not draw');
    await expect(run({ uploadError: { message: 'new row violates row-level security policy' } }))
      .rejects.toThrow('Upload failed: new row violates row-level security policy');
  });
});
