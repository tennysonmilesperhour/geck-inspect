import { afterAll, describe, expect, it, vi } from 'vitest';

// The panel's UI imports read window at load time.
vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null, addEventListener() {}, removeEventListener() {} }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));
afterAll(() => vi.unstubAllGlobals());

import { MORPH_OPTIONS } from '../IdNeedsPanel';
import { submissionMorphOptions } from '@/lib/morphPhotoSubmissions';
import { MORPHS } from '@/data/morph-guide';

// "Help ID these" lets a member relabel a photo. No living gecko is a Super
// Lilly White (two copies are lethal), so it is not offered; Super
// Cappuccino and Super Highway hatch and live, so they stay.
describe('Help ID these morph labels', () => {
  const slugs = MORPH_OPTIONS.map((m) => m.slug);

  it('leave out lethal supers and keep health-risk supers', () => {
    expect(slugs).not.toContain('super-lilly-white');
    expect(slugs).toContain('super-cappuccino');
    expect(slugs).toContain('super-highway');
    for (const m of MORPHS.filter((x) => x.doNotBreed === 'lethal')) expect(slugs, m.slug).not.toContain(m.slug);
  });

  it('use the same rule as the Morph Guide photo submission form', () => {
    expect([...slugs].sort()).toEqual(submissionMorphOptions().map((m) => m.slug).sort());
  });
});
