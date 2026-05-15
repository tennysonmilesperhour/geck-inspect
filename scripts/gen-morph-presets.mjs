#!/usr/bin/env node
/**
 * Generate the preset gallery images for the Morph Visualizer.
 *
 * Reads the preset list from src/components/morph-visualizer/data/presets.js,
 * builds a Replicate Flux 1.1 Pro prompt per preset, downloads the resulting
 * webp to public/morph-presets/<id>.webp.
 *
 * Run locally (the cloud sandbox can't reach api.replicate.com):
 *
 *   REPLICATE_API_TOKEN=r8_... node scripts/gen-morph-presets.mjs
 *
 * Flags:
 *   --force         regenerate even if the output file already exists
 *   --only id1,id2  only generate the listed preset ids
 *   --dry-run       print the prompts without calling the API
 *
 * Cost: ~$0.04 per image at Flux 1.1 Pro, 13 presets, expect $1-2 total.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const OUT_DIR = path.join(ROOT, 'public', 'morph-presets');

// Replicate model. Flux 1.1 Pro gives the most reliable anatomy on reptiles.
// If you want to try a cheaper alternative swap MODEL for 'black-forest-labs/flux-schnell'.
const MODEL = 'black-forest-labs/flux-1.1-pro';

// Style preamble applied to every preset. The reference suffix nails down
// composition (side profile, branch perch, clean backdrop) so the gallery
// reads consistently across morphs.
const STYLE_PREAMBLE = [
  'Studio-quality wildlife photograph of a single adult crested gecko',
  '(Correlophus ciliatus) perched on a horizontal mossy branch, full body',
  'in side profile facing right, head slightly raised, all four feet visible',
  'gripping the branch with characteristic toe pads.',
].join(' ');

const STYLE_SUFFIX = [
  'Prominent supraorbital eyelash crests above the large vertical-pupil eye,',
  'dorsal crest of small pointed scales running from above the eye to the hip,',
  'fine scale texture, sharp focus on the gecko, soft natural lighting from',
  'above-right, dark muted forest backdrop with gentle bokeh, professional',
  'reptile photography, 4k detail, no text, no watermark.',
].join(' ');

// Per-preset morph copy. Keyed by preset id from presets.js. Kept inline
// (not pulled from presets.js description) so the prompt can be tuned for
// the image gen model without changing user-facing copy.
const PROMPTS = {
  wild_type:
    'Wild-type buckskin coloration: warm brown body with tan flanks and a slightly paler dorsum. Subtle flame markings climbing the dorsum. Natural fired-down expression, gold-copper eye. The unmodified ancestral look.',
  red_harlequin:
    'Classic Red Harlequin morph: saturated brick-red body in full fired-up expression, with crisp cream-white harlequin lateral pattern climbing from belly partway up the flanks. White portholes scattered along the ribs. Copper eye.',
  extreme_harlequin:
    'Extreme Harlequin morph: deep dark red base color, with heavy cream-white harlequin pattern that breaks past the dorsal line and reaches across the back. Heavy dorsal crests. Bright white fringe along the lower belly, white kneecaps. Fired-up. Copper eye.',
  pinstripe_harlequin:
    'Pinstripe Harlequin morph: warm orange base in fired-up state, with 100% cream pinstripe rails running unbroken along the entire length of the dorsum from shoulder to hip. Strong cream harlequin pattern climbing the flanks. White kneecaps and white portholes. Copper eye.',
  lilly_white:
    'Lilly White morph: chocolate-brown base body with bright clean white patches and highlights randomly distributed across the entire body, especially on the head, dorsum and flanks. Mild harlequin lateral pattern visible underneath. Fired-up. Copper eye.',
  cappuccino_lw:
    'Cappuccino Lilly White double morph: deep coffee-brown body with a connected cream-colored dorsum stripe running unbroken from head to tail, plus bright Lilly White body splashes layered on top. Subtle harlequin lateral. Fired-up. Copper eye.',
  frappuccino:
    'Super Cappuccino (Frappuccino) morph: dark coffee-brown body with a fully patternless solid cream dorsum cap covering the entire back from head to hip. No pattern on the dorsum. Fired-up. Copper eye.',
  axanthic:
    'Axanthic morph: completely grayscale crested gecko with no warm pigment at all - dark charcoal-gray body, silver-gray flanks, white harlequin lateral pattern, near-black dorsum. Bright silver eye. Fired-up. The signature axanthic look: it looks like a black-and-white photo of a gecko in color.',
  moonglow_style:
    'Moonglow-style aesthetic: very pale, almost-white body on a soft phantom base, with bright Lilly White highlights layered over the top. Fired-down pale ghostly appearance, minimal pattern, silver eye.',
  super_dalmatian:
    'Super Dalmatian polygenic morph: cream-buckskin base body absolutely covered in dense pure-black ink spots from head to tail tip, blanketing the dorsum, flanks and limbs. Fired-up. Gold eye.',
  tiger:
    'Tiger morph: warm orange base body in fired-up state, with prominent dark chocolate-brown vertical tiger bands running across the ribs and flanks at regular intervals, like a tabby cat. Copper eye.',
  phantom_pinstripe:
    'Phantom Pinstripe morph: desaturated olive-gray phantom base coloration, with full cream pinstripe rails running unbroken along the entire dorsum. Muted ghostly low-contrast appearance, fired-down. Gold eye.',
};

async function loadPresets() {
  // Read presets.js as a string and pull out the ids - keeps a single source
  // of truth without having to evaluate the ES module (which imports from
  // other files that pull in the whole React app).
  const file = await fs.readFile(
    path.join(ROOT, 'src/components/morph-visualizer/data/presets.js'),
    'utf8',
  );
  const ids = [...file.matchAll(/id:\s*'([a-z_]+)'/g)].map((m) => m[1]);
  return [...new Set(ids)];
}

async function generate({ id, prompt, force, dryRun }) {
  const outPath = path.join(OUT_DIR, `${id}.webp`);
  if (!force) {
    try {
      await fs.access(outPath);
      console.log(`[skip] ${id} already exists (use --force to regen)`);
      return;
    } catch {
      // file doesn't exist - proceed
    }
  }

  const fullPrompt = `${STYLE_PREAMBLE} ${prompt} ${STYLE_SUFFIX}`;

  if (dryRun) {
    console.log(`\n--- ${id} ---\n${fullPrompt}\n`);
    return;
  }

  console.log(`[gen] ${id}...`);

  const startRes = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=60',
    },
    body: JSON.stringify({
      input: {
        prompt: fullPrompt,
        aspect_ratio: '4:3',
        output_format: 'webp',
        output_quality: 92,
        safety_tolerance: 2,
        prompt_upsampling: false,
      },
    }),
  });

  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`Replicate ${startRes.status} for ${id}: ${text}`);
  }

  let prediction = await startRes.json();

  // If the wait=60 hint already returned a terminal state, skip polling.
  while (prediction.status === 'starting' || prediction.status === 'processing') {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(prediction.urls.get, {
      headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` },
    });
    prediction = await pollRes.json();
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(`${id} failed: ${prediction.status} ${prediction.error || ''}`);
  }

  const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Download failed for ${id}: ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  await fs.writeFile(outPath, buf);
  console.log(`[done] ${id} -> ${path.relative(ROOT, outPath)} (${(buf.length / 1024).toFixed(0)} KB)`);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');
  const onlyIdx = args.indexOf('--only');
  const onlyList = onlyIdx >= 0 ? args[onlyIdx + 1].split(',').map((s) => s.trim()) : null;

  if (!process.env.REPLICATE_API_TOKEN && !dryRun) {
    console.error('REPLICATE_API_TOKEN env var is required (unless --dry-run).');
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const ids = await loadPresets();
  const targets = onlyList ? ids.filter((id) => onlyList.includes(id)) : ids;

  console.log(`Generating ${targets.length} preset image(s) into ${path.relative(ROOT, OUT_DIR)}/`);

  for (const id of targets) {
    const prompt = PROMPTS[id];
    if (!prompt) {
      console.warn(`[warn] no prompt for preset ${id}, skipping`);
      continue;
    }
    try {
      await generate({ id, prompt, force, dryRun });
    } catch (err) {
      console.error(`[error] ${id}: ${err.message}`);
    }
  }

  console.log('\nDone. Review the images, regenerate any you want with --force --only <id1,id2>.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
