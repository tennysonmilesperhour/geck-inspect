// Which storage files an account erasure removes, grouped by bucket.
//
// admin_erase_account() returns the member's files ({ bucket, path }).
// Since 16 Oct 2026 every member photo in geck-inspect-media also has a
// thumbnail at thumbs/<path> (src/lib/photoThumbnails.js), which the
// database does not know about, so each photo's thumbnail is added here
// and erased with it. A thumbnail that does not exist is simply not
// removed. GIFs have no thumbnail, and a path that is already a
// thumbnail is not doubled. Used by delete-my-account and
// admin-delete-account.
//
// A thumbnail is erased even when the database keeps its photo because
// another member's gecko still shows it (a sold or transferred gecko).
// That is deliberate: the other member's card then loads the full photo
// until the admin thumbnail tool makes a new copy, which costs only speed,
// while keeping the departing member's own copies would leave files of
// theirs public after the account is gone.

export const MEDIA_BUCKET = "geck-inspect-media";
const THUMBNAIL_PREFIX = "thumbs/";

type ErasureFile = { bucket?: string | null; path?: string | null } | null | undefined;

function thumbnailPath(path: string): string | null {
  const clean = path.replace(/^\/+/, "");
  if (!clean || clean.startsWith(THUMBNAIL_PREFIX) || /\.gif$/i.test(clean)) return null;
  if (clean.split("/").some((part) => part === "" || part === "." || part === "..")) return null;
  return `${THUMBNAIL_PREFIX}${clean}`;
}

export function filesToRemove(files: ErasureFile[] | null | undefined): Map<string, string[]> {
  const byBucket = new Map<string, Set<string>>();
  const add = (bucket: string, path: string) => {
    if (!byBucket.has(bucket)) byBucket.set(bucket, new Set());
    byBucket.get(bucket)!.add(path);
  };
  for (const file of files || []) {
    if (!file?.bucket || !file?.path) continue;
    add(file.bucket, file.path);
    if (file.bucket === MEDIA_BUCKET) {
      const thumb = thumbnailPath(file.path);
      if (thumb) add(MEDIA_BUCKET, thumb);
    }
  }
  return new Map([...byBucket].map(([bucket, paths]) => [bucket, [...paths]]));
}
