#!/usr/bin/env node
/**
 * Builds the Morph Guide's pattern-study layers from the ink drawings.
 *
 * Why: the Morph Guide used to download ten 1536 x 1024 ink drawings
 * (2.26 MB) and pull the pigment out of them pixel by pixel in the
 * visitor's browser, which froze a mid-range phone for about 3 seconds
 * on the site's most visited public page. The drawings never change, so
 * this script does that work once and writes small finished files.
 *
 * Run it by hand after changing anything in art/morph-guide/ink-studies-v3/
 * (the source drawings, kept out of public/ so they are not deployed):
 *
 *   node scripts/precompute-trait-layers.mjs
 *
 * It writes, and you commit:
 *   public/morph-guide/trait-layers-v1/<view>-base.webp     the plain animal
 *   public/morph-guide/trait-layers-v1/<view>-<trait>.webp  pigment only, transparent elsewhere
 *   src/components/morphguide/traitLayers.generated.js      the spot boxes the spots slider reveals
 *
 * If you change the output, bump LAYER_DIR (trait-layers-v2, ...) so
 * browsers holding the old files fetch the new ones.
 *
 * The pigment arithmetic lives in src/components/morphguide/pigmentExtract.js
 * (the old in-browser arithmetic with the thresholds retuned for the
 * 16 October 2026 drawings, and unit tested). Decoding
 * and resizing use sharp, which is already installed as a dependency of
 * @vercel/og.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DRIFT, extractPigment, MIN_SPOT, PIGMENT_TRAITS, SLOPE } from '../src/components/morphguide/pigmentExtract.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(ROOT, 'art/morph-guide/ink-studies-v3');
export const LAYER_DIR = 'morph-guide/trait-layers-v1';
const OUT_DIR = join(ROOT, 'public', LAYER_DIR);
const DATA_FILE = join(ROOT, 'src/components/morphguide/traitLayers.generated.js');
// 1200 px wide: the side drawings' own width, so phones and retina
// screens (where the studio is 900 to 1,200 device pixels wide) see the
// stipple and crest scales as drawn. 640 px looked soft on them once the
// 16 October 2026 drawings arrived. The top drawings (1536 px) come down
// to 1200; nothing is ever enlarged. The pigment layers cost more than the
// bases because their transparency is stored losslessly; alphaQuality 50
// is where that stopped looking different.
const OUT_WIDTH = 1200;
const VIEWS = ['side', 'top'];

/** The drawings' fingerprints and the settings the layers were made with. */
export function layerSource() {
  const drawings = {};
  for (const file of readdirSync(SOURCE_DIR).filter((f) => f.endsWith('.webp')).sort()) {
    drawings[file] = createHash('sha256').update(readFileSync(join(SOURCE_DIR, file))).digest('hex');
  }
  return { drawings, settings: { drift: DRIFT, minSpot: MIN_SPOT, slope: SLOPE, outWidth: OUT_WIDTH } };
}

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    // pnpm keeps sharp private to @vercel/og; reach it from there.
    const require = createRequire(createRequire(join(ROOT, 'package.json')).resolve('@vercel/og'));
    return require('sharp');
  }
}

async function main() {
  const sharp = await loadSharp();
  mkdirSync(OUT_DIR, { recursive: true });
  const raw = async (file) => {
    const { data, info } = await sharp(join(SOURCE_DIR, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
  };
  const spots = {};
  const sizes = [];
  for (const view of VIEWS) {
    const base = await raw(`${view}-base.webp`);
    const baseOut = join(OUT_DIR, `${view}-base.webp`);
    await sharp(join(SOURCE_DIR, `${view}-base.webp`)).resize({ width: OUT_WIDTH, withoutEnlargement: true }).webp({ quality: 72, effort: 6 }).toFile(baseOut);
    sizes.push(baseOut);
    for (const trait of PIGMENT_TRAITS) {
      const edited = await raw(`${view}-${trait}.webp`);
      if (edited.width !== base.width || edited.height !== base.height) throw new Error(`${view}-${trait} is not the base drawing's size`);
      const { layer, regions } = extractPigment(base.data, edited.data, base.width, base.height, trait);
      const out = join(OUT_DIR, `${view}-${trait}.webp`);
      await sharp(Buffer.from(layer.buffer), { raw: { width: base.width, height: base.height, channels: 4 } })
        .resize({ width: OUT_WIDTH, withoutEnlargement: true })
        .webp({ quality: 70, alphaQuality: 50, effort: 6 })
        .toFile(out);
      sizes.push(out);
      if (trait === 'spots') {
        spots[view] = regions.map(({ x, y, width, height }) => [x, y, width, height].map((n) => Math.round(n * 10) / 10));
      }
    }
  }
  const body = `// Generated by scripts/precompute-trait-layers.mjs. Do not edit by hand.
// One [x, y, width, height] box per painted spot, in the study's
// 1000 x 667 coordinates, already in the order the spots slider reveals them.
export const TRAIT_LAYER_ROOT = '/${LAYER_DIR}';
export const SPOT_REGIONS = ${JSON.stringify(spots)};
// What these layers were built from. src/lib/__tests__/pigmentExtract.test.js
// fails when a drawing or a setting changes without a rebuild.
export const LAYER_SOURCE = ${JSON.stringify(layerSource())};
`;
  writeFileSync(DATA_FILE, body);
  const { statSync } = await import('node:fs');
  for (const f of sizes) console.log(`${(statSync(f).size / 1024).toFixed(1).padStart(6)} KB  ${f.replace(ROOT + '/', '')}`);
  console.log(`spot boxes: side ${spots.side.length}, top ${spots.top.length}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`[trait-layers] ${SOURCE_DIR} is missing.`);
    process.exit(1);
  }
  main().catch((err) => { console.error(err); process.exit(1); });
}
