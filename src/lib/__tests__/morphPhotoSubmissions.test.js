import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: null }));

import { MORPHS } from '@/data/morph-guide';
import {
  CONTRIBUTOR_FALLBACK,
  contributorCredit,
  fetchMorphCommunityPhotos,
  reviewNotification,
  submissionMorphLink,
  submissionMorphName,
  submissionMorphOptions,
} from '../morphPhotoSubmissions';

describe('submission form morph list', () => {
  it('lists every built-in morph once, sorted by name', () => {
    const options = submissionMorphOptions();
    expect(options).toHaveLength(MORPHS.length);
    expect(new Set(options.map((o) => o.slug)).size).toBe(MORPHS.length);
    const names = options.map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(options).toContainEqual({ slug: 'lilly-white', name: 'Lilly White' });
  });
});

describe('morph names and links', () => {
  it('reads built-in slugs and falls back to legacy database names', () => {
    expect(submissionMorphName('harlequin')).toBe('Harlequin');
    expect(submissionMorphName('abc123', { abc123: 'Phantom' })).toBe('Phantom');
    expect(submissionMorphName('nope')).toBe('Unknown morph');
    expect(submissionMorphName(null)).toBe('Unknown morph');
  });

  it('links to the morph page for a built-in slug', () => {
    expect(submissionMorphLink('lilly-white')).toBe('/MorphGuide/lilly-white');
    expect(submissionMorphLink('abc123')).toBe('/MorphGuide');
  });
});

describe('review notifications', () => {
  const submission = { submitted_by_email: 'keeper@example.com', morph_guide_id: 'lilly-white' };

  it('sends an approval to the morph page where the photo shows', () => {
    const n = reviewNotification(submission, 'approved', 'Lilly White');
    expect(n.type).toBe('submission_approved');
    expect(n.link).toBe('/MorphGuide/lilly-white');
    expect(n.user_email).toBe('keeper@example.com');
    expect(n.content).toContain('Lilly White');
  });

  it('gives a rejection its own type so it is not titled "Submission approved"', () => {
    const n = reviewNotification(submission, 'rejected', 'Lilly White', '  Blurry photo ');
    expect(n.type).toBe('submission_rejected');
    expect(n.link).toBe('/MorphGuideSubmission');
    expect(n.content).toContain('not added');
    expect(n.content).toContain('Reason: Blurry photo');
    expect(n.content).not.toMatch(/approved/i);
  });
});

describe('contributor credit', () => {
  it('never shows an email', () => {
    expect(contributorCredit('Tenny Geckos')).toBe('Tenny Geckos');
    expect(contributorCredit('keeper@example.com')).toBe(CONTRIBUTOR_FALLBACK);
    expect(contributorCredit('  ')).toBe(CONTRIBUTOR_FALLBACK);
    expect(contributorCredit(null)).toBe(CONTRIBUTOR_FALLBACK);
  });
});

describe('fetching approved photos', () => {
  it('maps rows from the database function with a credit', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { id: '1', image_url: 'https://x/1.jpg', contributor_name: 'Canopy Crested', contributor_id: 'p1' },
        { id: '2', image_url: 'https://x/2.jpg', contributor_name: null },
        { id: '3', image_url: null, contributor_name: 'Skipped' },
      ],
      error: null,
    });
    const rows = await fetchMorphCommunityPhotos('phantom', { client: { rpc } });
    expect(rpc).toHaveBeenCalledWith('morph_community_photos', { p_slug: 'phantom', p_limit: 12 });
    expect(rows).toEqual([
      { id: 'submission-1', submission_id: '1', image_url: 'https://x/1.jpg', credit: 'Canopy Crested', owner_profile_id: 'p1' },
      { id: 'submission-2', submission_id: '2', image_url: 'https://x/2.jpg', credit: CONTRIBUTOR_FALLBACK, owner_profile_id: null },
    ]);
  });

  it('shows nothing when the function is missing or the call fails', async () => {
    const missing = { rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202' } }) };
    const thrown = { rpc: vi.fn().mockRejectedValue(new Error('offline')) };
    expect(await fetchMorphCommunityPhotos('phantom', { client: missing })).toEqual([]);
    expect(await fetchMorphCommunityPhotos('phantom', { client: thrown })).toEqual([]);
    expect(await fetchMorphCommunityPhotos('', { client: missing })).toEqual([]);
  });
});
