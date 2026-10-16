// Signed-out visitors open /Membership (pricing is public), and public
// pages load the Supabase client only when they need it
// (src/lib/supabaseLazy.js): it is the largest library in the first
// download. The plan buttons and the billing portal need it only when
// clicked, so nothing /Membership imports up front may pull
// '@/lib/supabaseClient' in. This walks the page's static imports (the
// ones that load with it) and fails if the client is among them.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '../..');
const CLIENT = path.join(SRC, 'lib', 'supabaseClient.js');
const EXTENSIONS = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'];
// `import x from '...'`, `export ... from '...'` and `import '...'`; an
// `import('...')` call loads later, on demand, so it is not followed.
const STATIC_IMPORT = /^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm;

function resolveImport(from, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return null; // a package
  for (const ext of EXTENSIONS) {
    const file = base + ext;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

/** The chain of static imports from entry to target, or null. */
function staticChain(entry, target) {
  const parent = new Map([[entry, null]]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (file === target) break;
    for (const m of fs.readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const next = resolveImport(file, m[1] || m[2]);
      if (next && !parent.has(next)) {
        parent.set(next, file);
        queue.push(next);
      }
    }
  }
  if (!parent.has(target)) return null;
  const chain = [];
  for (let f = target; f; f = parent.get(f)) chain.unshift(path.relative(SRC, f));
  return chain;
}

describe('the Membership page loads the Supabase client on demand', () => {
  it('nothing it imports up front pulls in the client', () => {
    expect(staticChain(path.join(SRC, 'pages', 'Membership.jsx'), CLIENT)).toBeNull();
  });

  it('nor does the billing portal helper Settings and the payment banner share', () => {
    expect(staticChain(path.join(SRC, 'lib', 'billingPortal.js'), CLIENT)).toBeNull();
  });

  it('the check itself finds a static import when there is one', () => {
    expect(staticChain(path.join(SRC, 'lib', 'supabaseLazy.js'), CLIENT)).toBeNull();
    expect(staticChain(path.join(SRC, 'pages', 'Settings.jsx'), CLIENT)).not.toBeNull();
  });
});
