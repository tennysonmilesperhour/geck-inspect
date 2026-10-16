#!/usr/bin/env node
/**
 * Shrinks every picture in public/ that is over the 200 KB image limit
 * (scripts/bundle-budget.json), so the size check in CI passes.
 *
 *   pnpm shrink:images            shrink them in place
 *   pnpm shrink:images --dry-run  only list them
 *
 * Each over-limit .webp, .jpg, .jpeg or .png is saved again as the same
 * file type at a slightly lower quality, step by step, until it fits (a
 * .png that cannot fit is reported, since it needs to become a .webp).
 * The picture keeps its size in pixels, so pages that show it do not
 * change. Pictures with their own allowance in bundle-budget.json are left
 * alone. Commit the shrunk files.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const budget = JSON.parse(readFileSync(join(ROOT, 'scripts', 'bundle-budget.json'), 'utf8'));
const LIMIT = budget.limits.publicImageKb * 1000;
const KINDS = new Set(['.webp', '.jpg', '.jpeg', '.png']);
const dryRun = process.argv.includes('--dry-run');

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    const require = createRequire(createRequire(join(ROOT, 'package.json')).resolve('@vercel/og'));
    return require('sharp');
  }
}

function overLimit(dir = join(ROOT, 'public'), out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) overLimit(path, out);
    else if (KINDS.has(extname(name).toLowerCase()) && stat.size > LIMIT) {
      const id = `image:${relative(ROOT, path)}`;
      if (budget.allowances?.[id] == null) out.push({ path, size: stat.size });
    }
  }
  return out;
}

async function shrink(sharp, path) {
  const ext = extname(path).toLowerCase();
  const input = readFileSync(path);
  for (let quality = 88; quality >= 60; quality -= 4) {
    const img = sharp(input);
    const out = ext === '.webp' ? await img.webp({ quality, effort: 6 }).toBuffer()
      : ext === '.png' ? await img.png({ quality, compressionLevel: 9, palette: true }).toBuffer()
      : await img.jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.length <= LIMIT) {
      writeFileSync(path, out);
      return { quality, size: out.length };
    }
  }
  return null;
}

const files = overLimit();
if (!files.length) {
  console.log(`[shrink-images] every picture in public/ is within ${LIMIT / 1000} KB.`);
  process.exit(0);
}
const sharp = dryRun ? null : await loadSharp();
let failed = 0;
for (const { path, size } of files) {
  const name = relative(ROOT, path);
  if (dryRun) { console.log(`${(size / 1000).toFixed(0).padStart(6)} KB  ${name}`); continue; }
  const result = await shrink(sharp, path);
  if (result) console.log(`${(size / 1000).toFixed(0).padStart(6)} KB -> ${(result.size / 1000).toFixed(0)} KB (quality ${result.quality})  ${name}`);
  else { failed += 1; console.error(`[shrink-images] could not fit ${name} under ${LIMIT / 1000} KB; save it as a smaller .webp or resize it.`); }
}
process.exit(failed ? 1 : 0);
