import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMMERCIAL_USE_LICENSES, isCommercialUseLicense, licenseLabel, normaliseLicense } from '../imageLicenses';

describe('outside photo licences on a commercial service', () => {
  it('refuses NonCommercial, NoDerivatives and missing licences', () => {
    for (const l of ['cc-by-nc', 'cc-by-nc-sa', 'CC BY-NC 4.0', 'cc-by-nd', 'cc-by-nc-nd', null, '', 'all rights reserved']) {
      expect(isCommercialUseLicense(l), String(l)).toBe(false);
    }
  });

  it('allows public domain, CC BY and CC BY-SA in any spelling', () => {
    for (const l of ['cc0', 'CC0', 'cc-by', 'CC BY', 'CC BY 4.0', 'cc_by_sa', 'CC BY-SA 4.0', 'pdm']) {
      expect(isCommercialUseLicense(l), l).toBe(true);
    }
    expect(normaliseLicense('CC BY-SA 4.0')).toBe('cc-by-sa');
  });

  it('the database read policy allows exactly the licences the app asks for', () => {
    const sql = readFileSync(new URL('../../../supabase/migrations/20261016090400_ux.sql', import.meta.url), 'utf8');
    const list = sql.match(/using \(license in \(([^)]+)\)\)/)[1].split(',').map((s) => s.trim().replace(/'/g, ''));
    expect([...list].sort()).toEqual([...COMMERCIAL_USE_LICENSES].sort());
    for (const l of list) expect(isCommercialUseLicense(l), l).toBe(true);
  });

  it('links each licence it shows', () => {
    expect(licenseLabel('cc-by')).toEqual({ name: 'CC BY', url: 'https://creativecommons.org/licenses/by/4.0/' });
  });

  it('the Morph Guide page shows the credit under every photo, not only on hover', () => {
    const page = readFileSync(new URL('../../pages/MorphDetail.jsx', import.meta.url), 'utf8');
    expect(page).toContain('<figcaption className="mt-1 text-xs text-neutral-300');
    expect(page).not.toMatch(/opacity-0 group-hover:opacity-100 transition-opacity">\s*\{img\.attribution/);
    expect(page).not.toMatch(/external CC-licensed sources/);
  });
});
