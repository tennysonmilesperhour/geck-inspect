import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Field Mode's offline queue and the code that sends it (about 8 kB
// gzipped with what they pull in) are for signed-in members only. They
// load after sign-in (AuthContext imports the queue on demand, and
// MemberOfflineSync loads the sync badge), so they stay out of the startup
// script every visitor downloads before anything appears. This test walks
// the static imports from src/main.jsx and fails if one of them comes back.

const ROOT = path.resolve(__dirname, '../../..');
const SRC = path.join(ROOT, 'src');
const MEMBER_ONLY = [
  'src/lib/offlineQueue.js',
  'src/lib/offlineSync.js',
  'src/lib/husbandryLog.js',
  'src/components/shared/OfflineSyncStatus.jsx',
];

function resolveImport(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js'), path.join(base, 'index.jsx')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function staticImports(file) {
  const text = fs.readFileSync(file, 'utf8');
  const specs = [];
  for (const re of [/^import\s(?:[^'"]*?\sfrom\s)?['"]([^'"]+)['"]/gm, /^export\s[^'"]*?\sfrom\s['"]([^'"]+)['"]/gm]) {
    for (const match of text.matchAll(re)) specs.push(match[1]);
  }
  return specs.map((spec) => resolveImport(file, spec)).filter((p) => p && /\.(jsx?)$/.test(p));
}

function startupFiles() {
  const seen = new Set();
  const queue = [path.join(SRC, 'main.jsx')];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...staticImports(file));
  }
  return [...seen].map((file) => path.relative(ROOT, file));
}

describe('offline sync code loads after sign-in', () => {
  it('the startup script does not import the offline queue or its sync code', () => {
    const files = startupFiles();
    // The walk reaches the app shell, so it is reading imports correctly.
    expect(files).toContain('src/lib/AuthContext.jsx');
    expect(files).toContain('src/components/shared/MemberOfflineSync.jsx');
    expect(files.filter((file) => MEMBER_ONLY.includes(file))).toEqual([]);
  });
});
