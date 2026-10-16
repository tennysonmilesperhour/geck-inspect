/**
 * Build-only Vite plugin: rewrites
 *
 *   import { X, Loader2 as Spinner } from 'lucide-react'
 *   import { format, parseISO } from 'date-fns'
 *
 * into one import per icon or function file:
 *
 *   import X from 'lucide-react/icons/x'
 *   import Spinner from 'lucide-react/icons/loader-circle'
 *   import { format } from 'date-fns/format'
 *
 * Why: both packages are imported through one index file that re-exports
 * every icon (1,500) or function (600). The code that ships is the same
 * either way, but the index file makes every icon look like a dependency
 * of whoever imports one, so the shared "core" chunk (vite.config.js,
 * stableChunks) would have swallowed every icon and date function the
 * whole app uses, about 250 KB, into the first download. With direct
 * imports the chunk gets only what the shared code really uses.
 *
 * Names it cannot place (lucide's `icons`, `Icon`, `createLucideIcon`, a
 * date-fns name with no file of its own) stay on the original import, so
 * nothing changes for them. Tests and the dev server keep the plain
 * imports (apply: 'build').
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const IMPORT_RE = /import\s*\{([^}]*)\}\s*from\s*(['"])(lucide-react|date-fns)\2\s*;?/g;

/** name -> icon file stem, read from lucide-react's own index file. */
export function lucideIconFiles(barrelSource) {
  const map = new Map();
  const line = /export\s*\{([^}]*)\}\s*from\s*'\.\/icons\/([a-z0-9-]+)\.js'/g;
  let m;
  while ((m = line.exec(barrelSource))) {
    for (const part of m[1].split(',')) {
      const alias = /default\s+as\s+([A-Za-z0-9_$]+)/.exec(part.trim());
      if (alias) map.set(alias[1], m[2]);
    }
  }
  return map;
}

/** The date-fns functions with their own subpath file, from its package.json exports. */
export function dateFnsFiles(pkg) {
  const names = new Set();
  for (const key of Object.keys(pkg.exports || {})) {
    const name = /^\.\/([A-Za-z0-9_]+)$/.exec(key)?.[1];
    if (name) names.add(name);
  }
  return names;
}

/**
 * Rewrites the named imports in one source file. Pure, so it is tested
 * on its own. Returns null when nothing changed.
 */
export function rewriteBarrelImports(code, { lucide, dateFns }) {
  let changed = false;
  const out = code.replace(IMPORT_RE, (whole, specList, _quote, pkg) => {
    const direct = [];
    const kept = [];
    for (const raw of specList.split(',')) {
      const spec = raw.trim();
      if (!spec) continue;
      const m = /^([A-Za-z0-9_$]+)(?:\s+as\s+([A-Za-z0-9_$]+))?$/.exec(spec);
      if (!m) { kept.push(spec); continue; }
      const [, name, local = name] = m;
      if (pkg === 'lucide-react' && lucide.has(name)) {
        direct.push(`import ${local} from 'lucide-react/icons/${lucide.get(name)}';`);
      } else if (pkg === 'date-fns' && dateFns.has(name)) {
        direct.push(`import { ${name}${local !== name ? ` as ${local}` : ''} } from 'date-fns/${name}';`);
      } else {
        kept.push(spec);
      }
    }
    if (!direct.length) return whole;
    changed = true;
    const rest = kept.length ? [`import { ${kept.join(', ')} } from '${pkg}';`] : [];
    return [...direct, ...rest].join(' ');
  });
  return changed ? out : null;
}

export default function directBarrelImports({ root }) {
  const require = createRequire(path.join(root, 'package.json'));
  let maps = null;
  const load = () => {
    if (maps) return maps;
    const lucideCjs = require.resolve('lucide-react');
    const lucideEsm = path.join(path.dirname(path.dirname(lucideCjs)), 'esm', 'lucide-react.js');
    const datePkg = JSON.parse(readFileSync(require.resolve('date-fns/package.json'), 'utf8'));
    maps = { lucide: lucideIconFiles(readFileSync(lucideEsm, 'utf8')), dateFns: dateFnsFiles(datePkg) };
    return maps;
  };
  return {
    name: 'geck-direct-barrel-imports',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('/node_modules/') || !/\.(jsx?|tsx?)$/.test(id.split('?')[0])) return null;
      if (!code.includes('lucide-react') && !code.includes('date-fns')) return null;
      const next = rewriteBarrelImports(code, load());
      return next ? { code: next, map: null } : null;
    },
  };
}
