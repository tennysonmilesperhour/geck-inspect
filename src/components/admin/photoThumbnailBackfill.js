/**
 * Thumbnail backfill: makes the small copy (src/lib/photoThumbnails.js) for
 * member photos uploaded before thumbnails existed. Used by the admin
 * panel's Photo thumbnails tool.
 *
 * Why it runs in the admin's browser: Supabase edge functions get about
 * 2 seconds of processor time per request, too little to decode and
 * resize a full phone photo. The admin's browser downloads each public
 * photo, resizes it with the same code uploads use, and uploads the
 * thumbnail with the admin's own session. No script or session here holds
 * the service role key.
 *
 * Which photos: the database function admin_photos_without_thumbnail()
 * (migration 20261016090800) returns, a page at a time in name order, the
 * photos with no thumbnail or with one someone other than the photo's
 * owner made. Photos that already have a good thumbnail never come back,
 * so stopping and starting again simply carries on. Within one run the
 * page cursor moves past photos that failed, so a bad photo is counted
 * once and never loops; the next run tries it again.
 */
import { MEDIA_BUCKET, THUMBNAIL_PREFIX, thumbnailStoragePath } from '@/lib/photoThumbnails';

export const BACKFILL_PAGE_SIZE = 20;
// Photos resized at the same time. Two keeps a laptop responsive while
// the next download overlaps the current resize; some of the old photos
// are 14 MB.
export const BACKFILL_CONCURRENCY = 2;

/**
 * The image type from a file's first bytes. Most photos carried over from
 * the old platform are stored as "application/octet-stream", so the
 * stored type cannot be trusted. Returns null for anything that is not a
 * known image.
 *
 * @param {Uint8Array} bytes: at least the first 12 bytes of the file
 * @returns {string|null}
 */
export function sniffImageType(bytes) {
  if (!bytes || bytes.length < 4) return null;
  const at = (i) => bytes[i];
  const ascii = (from, to) => String.fromCharCode(...bytes.slice(from, to));
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  if (at(0) === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 12 && ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  return null;
}

/**
 * Pure: which rows of a page to work on. Skips names already handled in
 * this run, thumbnails themselves, and GIFs (they never get one), and
 * returns the cursor for the next page (the last name on this page).
 *
 * @param {{ name: string }[]} rows: one page from admin_photos_without_thumbnail
 * @param {Set<string>} seen: names already attempted in this run
 * @returns {{ work: object[], skipped: object[], cursor: string|null }}
 */
export function planBatch(rows, seen = new Set()) {
  const work = [];
  const skipped = [];
  for (const row of rows || []) {
    const name = row?.name;
    if (typeof name !== 'string' || !name) continue;
    if (seen.has(name) || name.startsWith(THUMBNAIL_PREFIX) || !thumbnailStoragePath(name)) {
      skipped.push(row);
    } else {
      work.push(row);
    }
  }
  const last = rows?.length ? rows[rows.length - 1]?.name : null;
  return { work, skipped, cursor: typeof last === 'string' ? last : null };
}

async function inPool(items, size, task) {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

/**
 * Pure loop (everything it touches is passed in, so tests can drive it):
 * fetch a page, make each thumbnail, count successes and failures, move
 * the cursor, repeat until a page comes back empty or shouldStop() says
 * so. A failure is counted and the run carries on.
 *
 * @param {object} deps
 * @param {(after: string|null, limit: number) => Promise<object[]>} deps.fetchPage
 * @param {(row: object) => Promise<'made'|'skipped'>} deps.makeOne
 * @param {() => boolean} [deps.shouldStop]
 * @param {(progress: object) => void} [deps.onProgress]
 * @param {number} [deps.pageSize]
 * @param {number} [deps.concurrency]
 * @returns {Promise<{ made: number, failed: number, skipped: number, total: number, failures: {name: string, message: string}[], stopped: boolean }>}
 */
export async function runBackfill({
  fetchPage,
  makeOne,
  shouldStop = () => false,
  onProgress = () => {},
  pageSize = BACKFILL_PAGE_SIZE,
  concurrency = BACKFILL_CONCURRENCY,
}) {
  const seen = new Set();
  const failures = [];
  const progress = { made: 0, failed: 0, skipped: 0, total: 0, current: null, failures, stopped: false };
  let after = null;
  let firstPage = true;

  while (!shouldStop()) {
    const rows = await fetchPage(after, pageSize);
    if (!rows || rows.length === 0) break;
    if (firstPage) {
      progress.total = Number(rows[0]?.total_needing) || rows.length;
      firstPage = false;
    }
    const { work, skipped, cursor } = planBatch(rows, seen);
    progress.skipped += skipped.length;
    for (const row of work) seen.add(row.name);

    await inPool(work, concurrency, async (row) => {
      if (shouldStop()) return;
      progress.current = row.name;
      onProgress({ ...progress });
      try {
        const outcome = await makeOne(row);
        if (outcome === 'skipped') progress.skipped += 1;
        else progress.made += 1;
      } catch (error) {
        progress.failed += 1;
        failures.push({ name: row.name, message: error?.message || String(error) });
      }
      onProgress({ ...progress });
    });

    // A page that does not move the cursor would repeat for ever.
    if (!cursor || cursor === after) break;
    after = cursor;
  }

  progress.stopped = shouldStop();
  progress.current = null;
  onProgress({ ...progress });
  return progress;
}

/**
 * Make and upload one photo's thumbnail. `storage` is the Supabase
 * client's storage API; `makeThumbnail` and `convertHeic` are the upload
 * code's own (src/lib/imageResize.js); `fetchImpl` is the browser's fetch
 * (tests pass their own). The admin's session uploads with
 * upsert, so a thumbnail someone else planted is replaced (the bucket's
 * rules let admins overwrite any file).
 *
 * @returns {Promise<'made'|'skipped'>}
 */
export async function makeOneThumbnail(row, { storage, makeThumbnail, convertHeic, fetchImpl = globalThis.fetch }) {
  const thumbPath = thumbnailStoragePath(row.name);
  if (!thumbPath) return 'skipped';

  // The public address, the same one members' browsers load. It needs no
  // read permission on the file list, so it keeps working if the bucket's
  // listing is ever narrowed to stop anyone listing every member's files.
  const publicUrl = storage.from(MEDIA_BUCKET).getPublicUrl(row.name)?.data?.publicUrl;
  if (!publicUrl) throw new Error('Could not work out the photo address');
  let response;
  try {
    response = await fetchImpl(publicUrl);
  } catch (error) {
    throw new Error(`Could not download the photo: ${error?.message || 'network error'}`);
  }
  if (!response?.ok) {
    throw new Error(`Could not download the photo (HTTP ${response?.status ?? 'error'})`);
  }
  const blob = await response.blob();

  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const type = sniffImageType(head);
  if (!type) throw new Error('Not an image this tool can read');
  if (type === 'image/gif') return 'skipped';

  const baseName = row.name.split('/').pop() || 'photo';
  let file = new File([blob], baseName, { type });
  if (type === 'image/heic') file = await convertHeic(file);

  const thumbnail = await makeThumbnail(file);
  if (!thumbnail) throw new Error('This browser could not draw the photo');

  const { error: uploadError } = await storage.from(MEDIA_BUCKET).upload(thumbPath, thumbnail, {
    contentType: thumbnail.type || 'image/webp',
    cacheControl: '3600',
    upsert: true,
  });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message || 'unknown error'}`);
  return 'made';
}
