/**
 * Build-only Vite plugin: every lucide-react icon file imports
 * '../createLucideIcon.mjs'; this points that import at the smaller
 * src/lib/leanLucideIcon.js instead. That file says why, and its test
 * checks that both draw the same <svg>.
 *
 * It also drops what each icon file carries that the smaller function
 * does not need: a React key on every shape (it hands React the shapes
 * one by one, not as a list, so React needs no keys), "size: 24," (it
 * assumes 24 when the size is missing) and a bare "__iconData.node;"
 * statement that does nothing. The keys are random six-letter codes
 * that do not compress, so on a page with sixty icons they come to
 * about a kilobyte, more than lucide 1 added to it.
 *
 * Only imports made from lucide's own icon files are redirected, so code
 * that imports createLucideIcon or Icon from 'lucide-react' directly
 * still gets lucide's. The dev server and tests are untouched
 * (apply: 'build').
 */
import path from 'node:path';

const LUCIDE_ICON_FILE = /\/lucide-react\/dist\/esm\/icons\/[a-z0-9-]+\.mjs$/;

/** True when `source`, imported from `importer`, is lucide's icon factory. */
export function isLucideIconFactory(source, importer) {
  return source === '../createLucideIcon.mjs' && LUCIDE_ICON_FILE.test((importer || '').split('?')[0].replace(/\\/g, '/'));
}

/** An icon file's source without what the smaller function does not need. */
export function trimLucideIconFile(code) {
  return code
    .replace(/,\s*key: "[a-z0-9]+"(?=\s*\})/g, '')
    .replace(/^__iconData\.node;\n/m, '')
    .replace(/^ {2}size: 24,\n/m, '');
}

export default function leanLucideIcons({ root }) {
  const lean = path.join(root, 'src', 'lib', 'leanLucideIcon.js');
  return {
    name: 'geck-lean-lucide-icons',
    apply: 'build',
    enforce: 'pre',
    resolveId(source, importer) {
      return isLucideIconFactory(source, importer) ? lean : null;
    },
    transform(code, id) {
      if (!LUCIDE_ICON_FILE.test(id.split('?')[0].replace(/\\/g, '/'))) return null;
      const next = trimLucideIconFile(code);
      return next === code ? null : { code: next, map: null };
    },
  };
}
