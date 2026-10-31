#!/usr/bin/env node
// Which member photos still carry camera GPS (the place a photo was taken)?
//
// Background: the app shrinks and re-encodes photos in the browser before
// upload, which drops GPS. Photos that skipped that step (originals under
// 1,600 px and 400 KB, GIFs, and photos the browser could not decode) were
// stored as the camera wrote them, so some may still hold the position of a
// member's home (comprehensive review, 14 Oct 2026, Part C item 8).
//
// Two modes:
//
// 1. Audit (the default). READ-ONLY. Downloads each photo (only the first
//    256 KB where that is enough), looks for GPS in its EXIF and XMP, and
//    writes a report. It never uploads, moves or deletes anything. The report
//    names which GPS tags exist, never the coordinates.
//
//      node scripts/photo-gps-audit.mjs --manifest objects.json --out report.json
//
// 2. Strip (--strip). For each photo the audit flags: download the full
//    original, save it under --backup-dir and check the saved copy byte for
//    byte, then write a copy with the GPS removed in place (same length,
//    picture untouched, see scripts/lib/exif-gps.mjs). Without --apply it
//    stops there: nothing leaves this computer. With --apply (and the
//    service role key) it uploads the stripped copy over the original and
//    downloads it again to check. Read "Before running --apply" below first.
//
//      node scripts/photo-gps-audit.mjs --manifest objects.json --strip --backup-dir ~/gps-backup
//      node scripts/photo-gps-audit.mjs --manifest objects.json --strip --backup-dir ~/gps-backup --apply
//
// Which photos: either a manifest, or the Storage list API with the service
// role key. A manifest is the output of this read-only query in the SQL
// editor (or the Supabase MCP), saved as JSON:
//
//   select bucket_id, name, metadata->>'size' as size,
//          metadata->>'mimetype' as mimetype, created_at, owner_id
//     from storage.objects
//    where bucket_id in ('geck-inspect-media', 'promote-images')
//      and name not like 'thumbs/%'
//    order by created_at;
//
// Options:
//   --manifest <file>      JSON array (or JSONL) of {bucket_id, name, ...}
//   --bucket <id>          bucket to scan when listing through the API
//                          (repeatable; default geck-inspect-media and promote-images)
//   --before <date>        only objects created before this date (manifest only)
//   --include-thumbs       also scan thumbs/ (they are re-encoded, so normally skipped)
//   --limit <n>            stop after n objects
//   --concurrency <n>      downloads at once (default 6)
//   --out <file>           report path (default photo-gps-report.json in the
//                          system temp folder)
//   --strip                strip mode (see above); needs --backup-dir
//   --backup-dir <dir>     where originals and stripped copies are written
//   --apply                with --strip: upload the stripped copies
//
// Environment: SUPABASE_URL (default the production project), and
// SUPABASE_SERVICE_ROLE_KEY for API listing, private buckets and --apply.
// Behind a proxy, run with NODE_USE_ENV_PROXY=1 so Node's fetch uses it.
//
// Before running --apply:
//   - The database and photo backups are not running yet (docs/OPERATIONS.md,
//     section 3). The copies under --backup-dir are the only way back, so
//     keep that folder somewhere safe and check it holds every original.
//   - Run --strip without --apply first and open a few stripped copies.
//   - An upload with the service role key may change the object's owner, and
//     the member's own update and delete rules key on the owner. The strip
//     log records each object's owner_id from the manifest; compare
//     storage.objects afterwards and restore the owner if it changed.
//   - Public photos are cached by the CDN, so the old bytes can be served
//     for a while after the upload.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectImage, stripGps, sniffFormat } from './lib/exif-gps.mjs';

const DEFAULT_URL = 'https://mmuglfphhwlaluyfyxsp.supabase.co';
const DEFAULT_BUCKETS = ['geck-inspect-media', 'promote-images'];
const HEAD_BYTES = 256 * 1024;

export function parseArgs(argv) {
  const opts = {
    manifest: null,
    buckets: [],
    before: null,
    includeThumbs: false,
    limit: Infinity,
    concurrency: 6,
    out: path.join(os.tmpdir(), 'photo-gps-report.json'),
    strip: false,
    backupDir: null,
    apply: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`${a} needs a value`);
      i += 1;
      return v;
    };
    if (a === '--manifest') opts.manifest = next();
    else if (a === '--bucket') opts.buckets.push(next());
    else if (a === '--before') opts.before = new Date(next());
    else if (a === '--include-thumbs') opts.includeThumbs = true;
    else if (a === '--limit') opts.limit = Number(next());
    else if (a === '--concurrency') opts.concurrency = Math.max(1, Number(next()));
    else if (a === '--out') opts.out = next();
    else if (a === '--strip') opts.strip = true;
    else if (a === '--backup-dir') opts.backupDir = next();
    else if (a === '--apply') opts.apply = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`Unknown option ${a}`);
  }
  if (opts.apply && !opts.strip) throw new Error('--apply only works with --strip');
  if (opts.strip && !opts.backupDir) throw new Error('--strip needs --backup-dir, where each original is saved before anything else happens');
  if (!opts.buckets.length) opts.buckets = DEFAULT_BUCKETS;
  return opts;
}

export async function loadManifest(file) {
  const text = (await readFile(file, 'utf8')).trim();
  const rows = text.startsWith('[') ? JSON.parse(text) : text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return rows.map((r) => ({
    bucket: r.bucket_id || r.bucket,
    name: r.name,
    size: r.size == null ? null : Number(r.size),
    mimetype: r.mimetype || null,
    createdAt: r.created_at || null,
    ownerId: r.owner_id || r.owner || null,
  }));
}

export function selectObjects(objects, opts) {
  return objects
    .filter((o) => o.bucket && o.name && !o.name.endsWith('/'))
    .filter((o) => opts.includeThumbs || !o.name.startsWith('thumbs/'))
    .filter((o) => !opts.before || !o.createdAt || new Date(o.createdAt) < opts.before)
    .filter((o) => !o.name.endsWith('.emptyFolderPlaceholder'))
    .slice(0, opts.limit);
}

function encodePath(name) {
  return name.split('/').map(encodeURIComponent).join('/');
}

export function objectUrl(base, bucket, name, key) {
  return key
    ? `${base}/storage/v1/object/authenticated/${bucket}/${encodePath(name)}`
    : `${base}/storage/v1/object/public/${bucket}/${encodePath(name)}`;
}

async function listBucket(base, key, bucket, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!res.ok) throw new Error(`list ${bucket}/${prefix}: HTTP ${res.status}`);
    const page = await res.json();
    for (const item of page) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listBucket(base, key, bucket, full)));
      else out.push({
        bucket,
        name: full,
        size: item.metadata?.size ?? null,
        mimetype: item.metadata?.mimetype ?? null,
        createdAt: item.created_at ?? null,
        ownerId: item.owner_id ?? item.owner ?? null,
      });
    }
    if (page.length < 1000) break;
  }
  return out;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(url, key, range) {
  const headers = {};
  if (key) Object.assign(headers, { apikey: key, Authorization: `Bearer ${key}` });
  if (range) headers.Range = `bytes=0-${range - 1}`;
  let res;
  // Storage answers 429 when asked for too much at once: wait and retry.
  for (let attempt = 0; ; attempt += 1) {
    res = await fetch(url, { headers });
    if ((res.status !== 429 && res.status < 500) || attempt >= 5) break;
    await res.arrayBuffer().catch(() => {});
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
  }
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // 206: we got part; 200: the server sent everything.
  return { buf, complete: res.status === 200 || (range && buf.length < range) };
}

// Inspect one object: the first 256 KB, then the whole file when the GPS
// could sit later in it (PNG, WebP and HEIF can keep metadata at the end).
export async function auditObject(obj, { base, key, fetchBytes = download }) {
  const url = objectUrl(base, obj.bucket, obj.name, key);
  const row = { bucket: obj.bucket, name: obj.name, size: obj.size, mimetype: obj.mimetype, created_at: obj.createdAt };
  try {
    let { buf, complete } = await fetchBytes(url, key, HEAD_BYTES);
    let result = inspectImage(buf);
    if (!result.hasGps && result.truncated && !complete) {
      ({ buf, complete } = await fetchBytes(url, key, null));
      result = inspectImage(buf);
    }
    return { ...row, ...result, bytes_read: buf.length, complete: Boolean(complete) };
  } catch (err) {
    return { ...row, error: String(err.message || err) };
  }
}

async function mapPool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

export function summarize(rows) {
  const s = { scanned: rows.length, errors: 0, with_exif: 0, gps_directory: 0, with_gps: 0, xmp_gps: 0, by_format: {}, gps_by_format: {} };
  for (const r of rows) {
    if (r.error) { s.errors += 1; continue; }
    s.by_format[r.format] = (s.by_format[r.format] || 0) + 1;
    if (r.exif) s.with_exif += 1;
    if (r.gpsDirectory) s.gps_directory += 1;
    if (r.xmpGps) s.xmp_gps += 1;
    if (r.hasGps) {
      s.with_gps += 1;
      s.gps_by_format[r.format] = (s.gps_by_format[r.format] || 0) + 1;
    }
  }
  return s;
}

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

// Strip one flagged object. The original is saved and re-read before any
// stripped copy exists; the upload happens only with apply.
export async function stripObject(obj, { base, key, backupDir, apply, fetchBytes = download, upload = uploadObject }) {
  const url = objectUrl(base, obj.bucket, obj.name, key);
  const { buf: original } = await fetchBytes(url, key, null);
  const originalPath = path.join(backupDir, 'originals', obj.bucket, obj.name);
  await mkdir(path.dirname(originalPath), { recursive: true });
  await writeFile(originalPath, original, { flag: 'wx' }).catch(async (err) => {
    // Already backed up by an earlier run: keep the first copy, which is the
    // untouched original, and never overwrite it.
    if (err.code !== 'EEXIST') throw err;
  });
  const saved = await readFile(originalPath);
  const entry = { bucket: obj.bucket, name: obj.name, owner_id: obj.ownerId, original_sha256: sha256(original), backup: originalPath };
  if (sha256(saved) !== entry.original_sha256) {
    return { ...entry, status: 'skipped', reason: 'backup_differs_from_storage' };
  }
  const { buffer, changed, reason } = stripGps(original);
  if (!changed) return { ...entry, status: 'skipped', reason };
  const strippedPath = path.join(backupDir, 'stripped', obj.bucket, obj.name);
  await mkdir(path.dirname(strippedPath), { recursive: true });
  await writeFile(strippedPath, buffer);
  const out = { ...entry, stripped: strippedPath, stripped_sha256: sha256(buffer) };
  if (!apply) return { ...out, status: 'stripped_locally' };
  await upload(base, key, obj, buffer);
  const { buf: check } = await fetchBytes(url, key, null);
  if (sha256(check) !== out.stripped_sha256) return { ...out, status: 'uploaded_unverified' };
  return { ...out, status: 'uploaded' };
}

const CONTENT_TYPES = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heif: 'image/heic', avif: 'image/avif', tiff: 'image/tiff' };

async function uploadObject(base, key, obj, buffer) {
  const res = await fetch(`${base}/storage/v1/object/${obj.bucket}/${encodePath(obj.name)}`, {
    method: 'PUT',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': obj.mimetype || CONTENT_TYPES[sniffFormat(buffer)] || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`upload ${obj.bucket}/${obj.name}: HTTP ${res.status}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('See the comment at the top of scripts/photo-gps-audit.mjs.');
    return;
  }
  const base = (process.env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (opts.apply && !key) throw new Error('--apply needs SUPABASE_SERVICE_ROLE_KEY');

  let objects;
  if (opts.manifest) objects = await loadManifest(opts.manifest);
  else if (key) {
    objects = [];
    for (const b of opts.buckets) objects.push(...(await listBucket(base, key, b)));
  } else throw new Error('Give --manifest, or set SUPABASE_SERVICE_ROLE_KEY to list the buckets');
  objects = selectObjects(objects, opts);
  console.log(`Scanning ${objects.length} objects (read-only)`);

  let done = 0;
  const rows = await mapPool(objects, opts.concurrency, async (o) => {
    const r = await auditObject(o, { base, key });
    done += 1;
    if (done % 50 === 0) console.log(`  ${done}/${objects.length}`);
    return r;
  });
  const summary = summarize(rows);
  await writeFile(opts.out, JSON.stringify({ generated_at: new Date().toISOString(), summary, rows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report: ${opts.out}`);

  if (!opts.strip) return;
  const flagged = objects.filter((o, i) => rows[i].hasGps);
  console.log(`${opts.apply ? 'Stripping and uploading' : 'Stripping locally (no upload)'}: ${flagged.length} photos`);
  await mkdir(opts.backupDir, { recursive: true });
  const log = path.join(opts.backupDir, 'strip-log.jsonl');
  for (const o of flagged) {
    let entry;
    try {
      entry = await stripObject(o, { base, key, backupDir: opts.backupDir, apply: opts.apply });
    } catch (err) {
      entry = { bucket: o.bucket, name: o.name, status: 'error', reason: String(err.message || err) };
    }
    await appendFile(log, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
    console.log(`  ${entry.status} ${o.bucket}/${o.name}${entry.reason ? ` (${entry.reason})` : ''}`);
  }
  console.log(`Strip log: ${log}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
