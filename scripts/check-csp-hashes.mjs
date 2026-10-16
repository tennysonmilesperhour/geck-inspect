#!/usr/bin/env node
/**
 * Check every built page against the Content Security Policy.
 *
 *   node scripts/check-csp-hashes.mjs [distDir]
 *
 * Run after `vite build` and `node scripts/prerender.mjs`. It reads the
 * script-src list from vercel.json and fails when any page in dist/ has an
 * inline script (or inline event handler) whose hash is not on it, or when
 * script-src allows 'unsafe-inline' again. Without this, a page whose
 * inline script changed would ship with that script silently blocked by
 * the browser (the theme flash would come back, for example).
 * scripts/csp-inline.mjs explains the hashing.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inlineScripts } from './csp-inline.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = resolve(process.argv[2] || join(ROOT, 'dist'));

export function scriptSrcOf(vercelConfig) {
  for (const block of vercelConfig.headers || []) {
    for (const h of block.headers || []) {
      if (h.key === 'Content-Security-Policy') {
        const directive = h.value.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src '));
        if (directive) return directive.split(/\s+/).slice(1);
      }
    }
  }
  throw new Error('vercel.json has no Content-Security-Policy with a script-src directive');
}

function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...htmlFiles(path));
    else if (name.endsWith('.html')) out.push(path);
  }
  return out;
}

export function checkPages(dist, sources) {
  const allowed = new Set(sources);
  const problems = [];
  if (allowed.has("'unsafe-inline'")) problems.push("script-src allows 'unsafe-inline'");
  let pages = 0;
  let scripts = 0;
  for (const file of htmlFiles(dist)) {
    pages++;
    const found = inlineScripts(readFileSync(file, 'utf8'));
    for (const s of found.scripts) {
      scripts++;
      if (!allowed.has(s.hash)) problems.push(`${relative(dist, file)}: inline script ${s.hash} is not in script-src (${s.text.trim().slice(0, 60)})`);
    }
    for (const h of found.handlers) {
      scripts++;
      if (!allowed.has(h.hash) || !allowed.has("'unsafe-hashes'")) {
        problems.push(`${relative(dist, file)}: ${h.attribute} handler ${h.hash} is not allowed (${h.text.slice(0, 60)})`);
      }
    }
  }
  return { pages, scripts, problems };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  const { pages, scripts, problems } = checkPages(DIST, scriptSrcOf(config));
  if (problems.length > 0) {
    console.error(`[csp] ${problems.length} problem(s) in ${pages} pages:`);
    for (const p of problems.slice(0, 50)) console.error(`  ${p}`);
    console.error('[csp] Run `node scripts/build-vercel-json.mjs` and commit vercel.json, or remove the new inline script.');
    process.exit(1);
  }
  console.log(`[csp] ${pages} pages, ${scripts} inline scripts, all allowed by their hashes`);
}
