import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// jspdf (about 390 kB) and html2canvas (about 200 kB) are only needed when
// someone exports a PDF or a PNG. A top-level `import ... from 'jspdf'`
// anywhere in src/ puts the library into the download of every page that
// reaches that file (it once rode along with My Geckos, the passport page,
// Lineage and Pedigree). They must be loaded with `await import(...)` inside
// the export function instead. This test fails if a static import returns.

const SRC = path.resolve(__dirname, '../..');
const HEAVY = ['jspdf', 'html2canvas', 'html-to-image'];

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('heavy export libraries load on demand', () => {
  it('no source file imports jspdf, html2canvas or html-to-image at the top level', () => {
    const offenders = [];
    for (const file of sourceFiles(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const lib of HEAVY) {
        const staticImport = new RegExp(`^\\s*import\\s[^;]*?from\\s+['"]${lib}['"]`, 'm');
        if (staticImport.test(text)) offenders.push(`${path.relative(SRC, file)} (${lib})`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
