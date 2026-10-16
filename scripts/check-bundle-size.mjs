#!/usr/bin/env node
/**
 * Size budget for what visitors download. Runs in CI after `pnpm build`
 * (needs dist/ and dist/.vite/manifest.json); run it locally the same way:
 *
 *   pnpm build && node scripts/check-bundle-size.mjs
 *
 * Why: the October 2026 reviews measured a 205 kB main script, a 2.6 MB
 * Morph Guide and 45 images over 200 KB, each of which crept in one
 * change at a time with nothing to notice it. The limits are the plan's
 * (comprehensive review, Part E item 26), in scripts/bundle-budget.json:
 *
 *   entry       the main script plus everything it imports up front,
 *               which every page downloads before anything appears
 *   route       one page's own script file
 *   public page the main script plus one public page's scripts, before
 *               that page can draw (the prerendered pages preload these)
 *   image       one image or video file in public/
 *
 * Sizes are gzip level 9, in kB of 1,000 bytes. Something already over
 * its limit on 16 Oct 2026 has an allowance at that day's size, so the
 * check still fails if it grows. The JSON file says how to tighten one.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative, extname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const MANIFEST = join(DIST, '.vite', 'manifest.json');

const kb = (bytes) => Math.round(bytes / 10) / 100;
const gz = (file) => gzipSync(readFileSync(join(DIST, file)), { level: 9 }).length;

/** Static-import closure of a manifest key: the files that load with it. */
export function closure(manifest, key, seen = new Set()) {
  if (!manifest[key] || seen.has(key)) return seen;
  seen.add(key);
  for (const next of manifest[key].imports || []) closure(manifest, next, seen);
  return seen;
}

/** Every check as { id, label, size, limit }. Pure apart from reading files through `sizeOf`. */
export function collectChecks({ manifest, budget, sizeOf, publicFiles }) {
  const { limits, allowances = {}, publicPages = {} } = budget;
  const limitFor = (id, base) => Math.max(base, allowances[id] ?? 0);
  const sum = (keys) => [...keys].reduce((total, key) => total + sizeOf(manifest[key].file), 0);
  const checks = [];

  const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
  if (!entryKey) throw new Error('No entry in the Vite manifest.');
  const entry = closure(manifest, entryKey);
  checks.push({ id: 'entry', label: `entry (${[...entry].map((k) => manifest[k].file.replace('assets/', '')).join(' + ')})`, size: sum(entry), limit: limitFor('entry', limits.entryKb) });

  for (const [key, chunk] of Object.entries(manifest)) {
    if (!chunk.isDynamicEntry || !key.startsWith('src/pages/')) continue;
    const id = `route:${key}`;
    checks.push({ id, label: `route ${key}`, size: sizeOf(chunk.file), limit: limitFor(id, limits.routeKb) });
  }

  for (const [path, key] of Object.entries(publicPages)) {
    if (!manifest[key]) throw new Error(`Public page ${path}: ${key} is not in the Vite manifest.`);
    const files = new Set([...entry, ...closure(manifest, key)]);
    const id = `page:${path}`;
    checks.push({ id, label: `public page ${path} (${files.size} files)`, size: sum(files), limit: limitFor(id, limits.publicPageKb) });
  }

  for (const [file, bytes] of publicFiles) {
    const id = `image:${file}`;
    checks.push({ id, label: file, size: bytes, limit: limitFor(id, limits.publicImageKb), raw: true });
  }
  // sizes are bytes; limits are kB
  return checks.map((c) => ({ ...c, over: c.size > c.limit * 1000 }));
}

/**
 * Pages (by file name in src/pages) that the manifest no longer lists
 * under their own path, so they get no route check here and no preload
 * links in the prerendered HTML. It happens when a part a page loads later
 * (a lazy section, a quiz) imports one of our modules that only that page
 * uses: the build then keeps the shared module in the page's file and
 * lists the page only under a hashed name such as "_MorphGuide-abc.js".
 * Keep such lazy parts to library code or code other pages share.
 */
export function pagesWithoutEntry(manifest, pageNames) {
  const names = new Set(pageNames);
  return Object.entries(manifest)
    .filter(([key, chunk]) => chunk.isDynamicEntry && !key.startsWith('src/') && names.has(chunk.name))
    .map(([, chunk]) => chunk.name)
    .sort();
}

const MEDIA = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg', '.webm', '.mp4', '.ico']);
function publicMedia(dir = join(ROOT, 'public'), out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) publicMedia(path, out);
    else if (MEDIA.has(extname(name).toLowerCase())) out.push([relative(ROOT, path), stat.size]);
  }
  return out;
}

function main() {
  if (!existsSync(MANIFEST)) {
    console.error('[size-budget] dist/.vite/manifest.json is missing: run pnpm build first.');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const budget = JSON.parse(readFileSync(join(ROOT, 'scripts', 'bundle-budget.json'), 'utf8'));
  const cache = new Map();
  const sizeOf = (file) => { if (!cache.has(file)) cache.set(file, gz(file)); return cache.get(file); };
  const checks = collectChecks({ manifest, budget, sizeOf, publicFiles: publicMedia() });

  // --print-allowances: today's size, rounded up to the next kB, for
  // everything over its base limit. For setting the starting allowances
  // once; not for raising one later.
  if (process.argv.includes('--print-allowances')) {
    const base = (id) => (id === 'entry' ? budget.limits.entryKb : id.startsWith('route:') ? budget.limits.routeKb : id.startsWith('page:') ? budget.limits.publicPageKb : budget.limits.publicImageKb);
    const over = checks.filter((c) => c.size > base(c.id) * 1000).sort((a, b) => b.size - a.size);
    console.log(JSON.stringify(Object.fromEntries(over.map((c) => [c.id, Math.ceil(c.size / 1000)])), null, 2));
    return;
  }

  const shown = checks.filter((c) => c.id === 'entry' || c.id.startsWith('page:') || c.over || budget.allowances?.[c.id] != null || c.size > c.limit * 1000 * 0.9);
  console.log('[size-budget] kB gzipped (images: kB on disk)       size   limit');
  for (const c of shown) {
    const note = budget.allowances?.[c.id] != null ? ' (allowance from 16 Oct 2026)' : '';
    console.log(`${c.over ? 'OVER ' : '     '}${c.label.slice(0, 70).padEnd(70)} ${String(kb(c.size)).padStart(8)} ${String(c.limit).padStart(7)}${note}`);
  }
  const pageNames = readdirSync(join(ROOT, 'src', 'pages')).filter((f) => /\.jsx?$/.test(f)).map((f) => f.replace(/\.jsx?$/, ''));
  for (const name of pagesWithoutEntry(manifest, pageNames)) {
    console.warn(`[size-budget] warning: src/pages/${name} has no manifest entry of its own, so its size is not checked (see pagesWithoutEntry in this script).`);
  }
  const failures = checks.filter((c) => c.over);
  if (failures.length) {
    console.error(`\n[size-budget] ${failures.length} over budget. Make it smaller (lazy-load a library at the action that needs it, resize an image), or see scripts/bundle-budget.json.`);
    process.exit(1);
  }
  console.log(`\n[size-budget] all ${checks.length} checks within budget.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
