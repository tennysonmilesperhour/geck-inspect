import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  VERIFIED_BREEDER_CHECKS,
  VERIFIED_BREEDER_DEFINITION,
  VERIFIED_BREEDER_HELP_PATH,
  VERIFIED_BREEDER_LABEL,
} from '../verifiedBreeder';

const src = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../../../supabase/migrations/20261003024339_breeder_trust_verified_reviews_featured.sql', import.meta.url),
  'utf8',
);

describe('Verified breeder: one definition', () => {
  it('lists exactly the checks the database requires before the badge', () => {
    const keys = migration.match(/v_keys constant text\[\] := array\[([^\]]+)\]/)[1]
      .split(',').map((k) => k.trim().replace(/'/g, ''));
    expect(VERIFIED_BREEDER_CHECKS.map((c) => c.key)).toEqual(keys);
  });

  it('says the same sentence everywhere it is explained', () => {
    expect(VERIFIED_BREEDER_DEFINITION).toBe(
      'A Verified breeder badge means the Geck Inspect team checked five things by hand: who the breeder is, '
      + 'their own crested geckos kept on Geck Inspect with photos, a record of past sales, '
      + 'published store policies (shipping, live arrival and payment) and no open complaints.',
    );
    expect(VERIFIED_BREEDER_DEFINITION).not.toMatch(/\u2014|\u2013|--/);
  });

  it('the help link points at a section that exists', () => {
    const [path, anchor] = VERIFIED_BREEDER_HELP_PATH.split('#');
    expect(path).toBe('/MarketplaceVerification');
    expect(src('../../pages/MarketplaceVerification.jsx')).toContain(`id="${anchor}"`);
  });

  it('no surface says the opposite any more', () => {
    const verification = src('../../pages/MarketplaceVerification.jsx');
    expect(verification).not.toMatch(/don.t issue a (binary|single)/i);
    expect(verification).toContain('VERIFIED_BREEDER_DEFINITION');
    expect(src('../../pages/About.jsx')).not.toMatch(/a verified community/i);
    expect(src('../../components/admin/BreederVerification.jsx')).toContain('VERIFICATION_CHECKLIST = VERIFIED_BREEDER_CHECKS');
    for (const file of [
      '../../components/storefront/StorefrontWebsite.jsx',
      '../../components/marketplace/TrustPanel.jsx',
      '../../pages/MyStore.jsx',
      '../../pages/Breeder.jsx',
    ]) {
      expect(src(file), file).toMatch(/from '@\/lib\/verifiedBreeder'/);
    }
    expect(VERIFIED_BREEDER_LABEL).toBe('Verified breeder');
  });
});
