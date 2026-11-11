#!/usr/bin/env node
// Checks the hand-written documentation for links and file references that
// point at nothing.
//
//   node scripts/check-doc-links.mjs          report, exit 1 on a broken link
//   node scripts/check-doc-links.mjs --paths  also list `docs/...` paths
//                                             written in backticks that do
//                                             not exist (report only)
//
// Why: the docs are how a new session finds its way, and a link to a file
// that was moved or never existed sends it nowhere. Run this after moving
// or renaming a document. See docs/README.md for the map of the docs.
//
// Not checked: generated reports (growth, SEO, blog, agent traffic), the
// Base44 archive, applied migrations, and anything under public/.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const SKIP = [
  'docs/growth-reports/', 'docs/seo-audits/', 'docs/blog-reports/', 'docs/agent-review/',
  'docs/archive/', 'supabase/migrations/', 'public/', 'node_modules/', 'ios/', 'android/', 'vendor/',
];
const withPaths = process.argv.includes('--paths');

const files = execSync('git ls-files "*.md"', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !SKIP.some((prefix) => f.startsWith(prefix)));

const broken = [];
const missingPaths = [];
const LINK = /\]\(([^)\s]+)\)/g;
const TICKED = /`((?:docs|src|scripts|supabase|e2e|api|art|content)\/[^`\s*]+?\.(?:md|js|jsx|ts|mjs|cjs|json|sql|yml|toml|css))`/g;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    // Links are looked for in prose only: a shell command in backticks can
    // contain "](" without being a link.
    const prose = line.replace(/`[^`]*`/g, '');
    for (const match of prose.matchAll(LINK)) {
      const target = match[1];
      if (/^(https?:|mailto:|tel:|#|\/)/.test(target)) continue;
      const path = decodeURIComponent(target.split('#')[0]);
      if (!path) continue;
      if (!existsSync(normalize(join(dirname(file), path)))) {
        broken.push(`${file}:${index + 1}  ${target}`);
      }
    }
    if (withPaths) {
      for (const match of line.matchAll(TICKED)) {
        if (!existsSync(match[1])) missingPaths.push(`${file}:${index + 1}  ${match[1]}`);
      }
    }
  });
}

console.log(`Checked ${files.length} documents.`);
if (withPaths) {
  console.log(`\nPaths in backticks that do not exist (${missingPaths.length}; old documents name files that have since gone):`);
  for (const line of missingPaths) console.log(`  ${line}`);
}
if (broken.length) {
  console.log(`\nBroken links (${broken.length}):`);
  for (const line of broken) console.log(`  ${line}`);
  process.exit(1);
}
console.log('No broken links.');
