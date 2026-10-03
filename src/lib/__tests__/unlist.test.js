import { describe, expect, it } from 'vitest';
import { UNLISTED_STATUSES, statusAfterUnlist, unlistPatch } from '../unlist';

describe('unlisting a gecko', () => {
  it('gives back the status it had before it was listed', () => {
    expect(statusAfterUnlist({ status: 'For Sale', status_before_listing: 'Holdback' })).toBe('Holdback');
    expect(statusAfterUnlist({ status: 'For Sale', status_before_listing: 'Proven' })).toBe('Proven');
  });

  it('does not guess when the earlier status is unknown', () => {
    expect(statusAfterUnlist({ status: 'For Sale' })).toBeNull();
    expect(statusAfterUnlist({ status: 'For Sale', status_before_listing: 'For Sale' })).toBeNull();
    expect(statusAfterUnlist(null)).toBeNull();
  });

  it('never writes Pet unless Pet was chosen', () => {
    expect(unlistPatch('Holdback')).toEqual({ status: 'Holdback', is_public: false });
    expect(() => unlistPatch('')).toThrow();
    expect(() => unlistPatch('For Sale')).toThrow();
    expect(UNLISTED_STATUSES).not.toContain('Sold');
  });
});
