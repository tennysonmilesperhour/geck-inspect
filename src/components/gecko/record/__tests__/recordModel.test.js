import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// geckoAccess imports the entity layer; nothing here touches the database.
vi.mock('@/entities/all', () => ({ Gecko: {}, CollectionMember: {} }));

const {
  recordAccess, latestWeighIn, newestFirst, isNewestDay, recordSections,
  sectionId, myGeckosHandoff, handoffSteps, calculatorLink, REMOVED_WITH_GECKO,
} = await import('../recordModel');

const owner = { id: 'u1', email: 'Keeper@Example.com' };
const editor = { id: 'u2', email: 'editor@example.com' };
const admin = { id: 'u3', email: 'admin@example.com', role: 'admin' };
const gecko = { id: 'g1', name: 'Nimbus', created_by: 'keeper@example.com', sex: 'Male' };

describe('recordAccess', () => {
  it('gives the owner every action, matching email without regard to case', () => {
    expect(recordAccess({ gecko, user: owner, canEdit: true })).toEqual({
      isOwner: true, keeper: true, canEdit: true, canDelete: true, canTransfer: true, canSeeValue: true,
    });
  });

  it('lets a collection editor edit and archive but not delete, transfer or see the value', () => {
    expect(recordAccess({ gecko, user: editor, canEdit: true, isMember: true })).toEqual({
      isOwner: false, keeper: true, canEdit: true, canDelete: false, canTransfer: false, canSeeValue: false,
    });
  });

  it('shows a read-only member the care history and nothing to change', () => {
    expect(recordAccess({ gecko, user: editor, canEdit: false, isMember: true })).toEqual({
      isOwner: false, keeper: true, canEdit: false, canDelete: false, canTransfer: false, canSeeValue: false,
    });
  });

  it('shows a visitor only the public record', () => {
    for (const user of [null, { id: 'x', email: 'buyer@example.com' }]) {
      expect(recordAccess({ gecko, user })).toEqual({
        isOwner: false, keeper: false, canEdit: false, canDelete: false, canTransfer: false, canSeeValue: false,
      });
    }
  });

  it('never lets a signed-out visitor edit, even if a host passes canEdit by mistake', () => {
    expect(recordAccess({ gecko, user: null, canEdit: true, isMember: true }).canEdit).toBe(false);
    expect(recordAccess({ gecko, user: null, canEdit: true, isMember: true }).keeper).toBe(false);
  });

  it('lets an admin delete (the database allows it) without making them the owner', () => {
    const access = recordAccess({ gecko, user: admin, canEdit: false });
    expect(access.canDelete).toBe(true);
    expect(access.isOwner).toBe(false);
    expect(access.canTransfer).toBe(false);
  });

  it('treats the demo guest as the owner of the demo geckos', () => {
    const access = recordAccess({ gecko: { ...gecko, created_by: 'guest@local' }, user: { id: '', email: 'guest@local', is_guest: true }, canEdit: true });
    expect(access.isOwner).toBe(true);
    expect(access.canSeeValue).toBe(true);
  });
});

describe('weigh-ins', () => {
  const weights = [
    { id: 'a', record_date: '2026-08-01', weight_grams: 30 },
    { id: 'b', record_date: '2026-10-01', weight_grams: 36 },
    { id: 'c', record_date: '2026-09-01', weight_grams: 33 },
  ];

  it('lists newest first and reads the current weight from the newest weigh-in', () => {
    expect(newestFirst(weights).map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(latestWeighIn(weights, { weight_grams: 12 })).toEqual({ grams: 36, date: '2026-10-01' });
  });

  it('falls back to the weight on the gecko row when there are no weigh-ins', () => {
    expect(latestWeighIn([], { weight_grams: 41 })).toEqual({ grams: 41, date: null });
    expect(latestWeighIn([], {})).toBeNull();
    expect(latestWeighIn([{ id: 'x', record_date: null, weight_grams: 5 }], null)).toBeNull();
  });

  it('only a weigh-in at least as new as the rest becomes the current weight', () => {
    expect(isNewestDay(weights, '2026-10-01')).toBe(true);
    expect(isNewestDay(weights, '2026-10-15')).toBe(true);
    expect(isNewestDay(weights, '2026-09-15')).toBe(false);
    expect(isNewestDay([], '2026-01-01')).toBe(true);
  });
});

describe('recordSections', () => {
  const keeper = recordAccess({ gecko, user: owner, canEdit: true });
  const visitor = recordAccess({ gecko, user: null });

  it('gives a keeper a jump link to every part of the history', () => {
    const ids = recordSections({ access: keeper, hasMorePhotos: true, isFemale: true }).map((s) => s.id);
    expect(ids).toEqual(['overview', 'care-history', 'breeding', 'sharing', 'more']);
    expect(recordSections({ access: keeper, isFemale: true }).find((s) => s.id === 'breeding').label).toBe('Breeding');
  });

  it('gives a read-only member no link to an empty weights or passport section', () => {
    const viewer = recordAccess({ gecko, user: editor, canEdit: false, isMember: true });
    expect(recordSections({ access: viewer }).map((s) => s.id)).toEqual(['overview', 'care-history', 'breeding', 'more']);
    expect(recordSections({ access: viewer, hasWeights: true, hasPassport: true }).map((s) => s.id))
      .toEqual(['overview', 'care-history', 'breeding', 'sharing', 'more']);
  });

  it('gives a visitor links only to what is public and on the page', () => {
    expect(recordSections({ access: visitor }).map((s) => s.id)).toEqual(['overview', 'more']);
    expect(recordSections({ access: visitor, hasWeights: true, hasShedForecast: true, hasPassport: true }).map((s) => s.label))
      .toEqual(['Overview', 'Care history', 'Sharing', 'More']);
  });

  it('names each section element the way its link points', () => {
    expect(sectionId('weights')).toBe('record-weights');
  });
});

describe('the page to My Geckos hand-off', () => {
  it('builds the link with only the actions My Geckos knows', () => {
    expect(myGeckosHandoff('g1', 'edit')).toBe('/MyGeckos?gecko=g1&open=edit');
    expect(myGeckosHandoff('g1', 'archive')).toBe('/MyGeckos?gecko=g1&open=archive');
    expect(myGeckosHandoff('g1', 'sold')).toBe('/MyGeckos?gecko=g1&open=sold');
    expect(myGeckosHandoff('g1', 'delete')).toBe('/MyGeckos?gecko=g1');
    expect(myGeckosHandoff('a b&c')).toBe('/MyGeckos?gecko=a+b%26c');
  });

  it('opens the form or the archive dialog only for a member who may edit', () => {
    expect(handoffSteps('edit', { mayEdit: true })).toEqual({ openForm: true, archiveDialog: null });
    expect(handoffSteps('archive', { mayEdit: true })).toEqual({ openForm: false, archiveDialog: 'ask' });
    expect(handoffSteps('sold', { mayEdit: true, archived: true })).toEqual({ openForm: false, archiveDialog: 'sold' });
    expect(handoffSteps('archive', { mayEdit: true, archived: true })).toEqual({ openForm: false, archiveDialog: null });
    expect(handoffSteps('edit', { mayEdit: false })).toEqual({ openForm: false, archiveDialog: null });
    expect(handoffSteps('delete', { mayEdit: true })).toEqual({ openForm: false, archiveDialog: null });
    expect(handoffSteps(null, { mayEdit: true })).toEqual({ openForm: false, archiveDialog: null });
  });

  it('fills the matching calculator slot', () => {
    expect(calculatorLink({ id: 'g1', sex: 'Female' })).toBe('/calculator?damGecko=g1');
    expect(calculatorLink({ id: 'g1', sex: 'Male' })).toBe('/calculator?sireGecko=g1');
    expect(calculatorLink({ id: 'g1' })).toBe('/calculator?sireGecko=g1');
  });
});

// Deleting a gecko removes its weigh-ins (a trigger) and its feeding, shed
// and vet records and ownership history (foreign keys that cascade). The
// toast in My Geckos used to say only "its weigh-ins".
describe('what a delete removes', () => {
  it('names every kind of record that goes with the gecko', () => {
    for (const kind of ['weigh-in', 'feeding', 'shed', 'vet visit', 'ownership record']) {
      expect(REMOVED_WITH_GECKO).toContain(kind);
    }
  });

  it('is what the My Geckos toast says after a delete', () => {
    const page = readFileSync(new URL('../../../../pages/MyGeckos.jsx', import.meta.url), 'utf8');
    const handler = page.match(/const handleDelete = async[\s\S]*?\n {4}\};/)?.[0] || '';
    expect(handler).toContain('${REMOVED_WITH_GECKO} were permanently removed.');
    expect(handler).not.toContain('its weigh-ins have been permanently removed');
  });
});
