import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DECLARED,
  FILES,
  declaredDate,
  lastCommit,
  readDeclaredDates,
  resolveDates,
  shallowBoundaries,
} from '../../../scripts/build-content-dates.mjs';
import { STATIC_ROUTES } from '../../../scripts/seo-routes.mjs';
import { editorialFor } from '../editorial.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('content dates (lastmod and dateModified)', () => {
  it('runs at the start of pnpm build, so a deploy never ships stale dates', () => {
    const build = JSON.parse(read('package.json')).scripts.build;
    const steps = build.split('&&').map((s) => s.trim());
    const at = steps.indexOf('node scripts/build-content-dates.mjs');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(steps.indexOf('node scripts/build-sitemap.mjs'));
    expect(at).toBeLessThan(steps.indexOf('vite build'));
  });

  it('records every file the sitemap and the structured data ask about', () => {
    const named = new Set();
    for (const file of ['scripts/seo-routes.mjs', 'src/lib/editorial.js']) {
      const src = read(file);
      for (const call of src.matchAll(/(?:dateOf|contentDate|latestContentDate|declaredDateOf|declaredDate)\(([^)]*)\)/g)) {
        for (const m of call[1].matchAll(/'((?:src|scripts)\/[^']+)'/g)) named.add(m[1]);
      }
    }
    for (const constant of ['MORPH_DATA', 'CARE_DATA', 'LINES_DATA', 'CALC_DATA']) {
      const m = read('scripts/seo-routes.mjs').match(new RegExp(`const ${constant} = '([^']+)'`));
      if (m) named.add(m[1]);
    }
    expect(named.size).toBeGreaterThan(20);
    for (const file of named) expect(FILES.concat(DECLARED), file).toContain(file);
  });

  it('never trusts a date from a shallow-clone boundary commit', () => {
    const out = resolveDates({
      files: ['a.js', 'b.js', 'c.js'],
      previous: { a: 'x', 'a.js': '2026-09-01', 'b.js': '2026-09-02' },
      commits: {
        'a.js': { hash: 'new', date: '2026-10-15' },
        'b.js': { hash: 'boundary', date: '2026-10-16' },
      },
      boundaries: new Set(['boundary']),
    });
    expect(out.files).toEqual({ 'a.js': '2026-10-15', 'b.js': '2026-09-02' });
    expect(out.kept).toBe(1);
  });

  it('reads git through the injected runner and survives no git at all', () => {
    const fake = (args) => {
      if (args[0] === 'log') return 'abc123 2026-10-15';
      if (args[0] === 'rev-parse' && args[1] === '--is-shallow-repository') return 'false';
      throw new Error('unexpected');
    };
    expect(lastCommit('x.js', fake)).toEqual({ hash: 'abc123', date: '2026-10-15' });
    expect(shallowBoundaries(fake).size).toBe(0);
    const broken = () => { throw new Error('no git'); };
    expect(lastCommit('x.js', broken)).toBeNull();
    expect(shallowBoundaries(broken).size).toBe(0);
  });

  // These checks run the build step in memory instead of comparing the
  // committed content-dates.json with the page. CI runs pnpm test before
  // pnpm build, so a Terms or Privacy Policy date edit would otherwise turn
  // CI red until someone ran pnpm build:content-dates by hand (review, 16
  // Oct 2026). Deploys were never at risk: the build regenerates the file.
  it('dates legal pages by the date they show readers', () => {
    expect(declaredDate("const LAST_UPDATED = '2026-09-08';")).toBe('2026-09-08');
    expect(declaredDate('no date here')).toBeNull();
    const fromSource = readDeclaredDates();
    expect(Object.keys(fromSource).sort()).toEqual([...DECLARED].sort());
    for (const file of DECLARED) expect(fromSource[file], file).toBe(declaredDate(read(file)));
  });

  it('picks up a changed legal date from the page, not the committed file', () => {
    const committed = JSON.parse(read('scripts/content-dates.json')).declared;
    const edited = readDeclaredDates({
      read: (file) => (file === 'src/pages/PrivacyPolicy.jsx' ? "const LAST_UPDATED = '2099-01-02';" : read(file)),
      previous: committed,
    });
    expect(edited['src/pages/PrivacyPolicy.jsx']).toBe('2099-01-02');
    expect(edited['src/pages/Terms.jsx']).toBe(declaredDate(read('src/pages/Terms.jsx')));
    // A page that loses its constant keeps the committed date.
    expect(readDeclaredDates({ read: () => 'no date', previous: { 'src/pages/Terms.jsx': '2026-09-08' } }))
      .toEqual({ 'src/pages/Terms.jsx': '2026-09-08' });
  });

  it('sends the declared legal dates to the sitemap and the structured data', () => {
    const declared = JSON.parse(read('scripts/content-dates.json')).declared;
    const lastmod = Object.fromEntries(STATIC_ROUTES.map((r) => [r.path, r.lastmod]));
    expect(lastmod['/Terms']).toBe(declared['src/pages/Terms.jsx']);
    expect(lastmod['/PrivacyPolicy']).toBe(declared['src/pages/PrivacyPolicy.jsx']);
    expect(editorialFor('/Terms').modified).toBe(declared['src/pages/Terms.jsx']);
    expect(editorialFor('/PrivacyPolicy').modified).toBe(declared['src/pages/PrivacyPolicy.jsx']);
  });

  it('gives the public landing pages their file date instead of a hand-typed one', () => {
    const dates = JSON.parse(read('scripts/content-dates.json')).files;
    expect(editorialFor('/QualityScale').modified).toBe(dates['src/pages/QualityScale.jsx']);
    expect(editorialFor('/pedigree-tracker').modified).toBe(dates['src/pages/PedigreeTracker.jsx']);
    expect(editorialFor('/').modified).toBe(dates['src/pages/Home.jsx']);
    for (const page of ['PedigreeTracker', 'BreedingRecords', 'CrestedGeckoPrice', 'QualityScale']) {
      expect(read(`src/pages/${page}.jsx`), page).not.toMatch(/const LAST_UPDATED = '\d{4}/);
    }
  });
});
