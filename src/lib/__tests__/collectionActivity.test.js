import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

const { activityActor, describeActivity, groupActivityByDay } = await import('../collectionActivity');

const entry = (action, detail = null, extra = {}) => ({
  action, detail, gecko_name: 'Mango', actor_name: 'Sam', actor_email: 'sam@example.com', ...extra,
});

describe('collection activity sentences', () => {
  it('names the person, or says You', () => {
    expect(activityActor(entry('fed'), 'SAM@example.com')).toBe('You');
    expect(activityActor(entry('fed'), 'olive@example.com')).toBe('Sam');
    expect(activityActor({ actor_email: 'x@example.com' })).toBe('x@example.com');
    expect(activityActor({})).toBe('Geck Inspect');
  });

  it('reads plainly for each action', () => {
    expect(describeActivity(entry('fed', 'CGD'))).toBe('Sam fed Mango (CGD)');
    expect(describeActivity(entry('fed', 'Crickets, refused'))).toBe('Sam offered Mango Crickets (refused)');
    expect(describeActivity(entry('weighed', '31.5 g'))).toBe('Sam weighed Mango: 31.5 g');
    expect(describeActivity(entry('edited', 'listing, status: For Sale'))).toBe('Sam edited Mango: listing, status: For Sale');
    expect(describeActivity(entry('added', 'Lilly White Harlequin'))).toBe('Sam added Mango (Lilly White Harlequin)');
    expect(describeActivity(entry('archived', 'Sold'))).toBe('Sam archived Mango (Sold)');
    expect(describeActivity(entry('restored'))).toBe('Sam restored Mango from the archive');
    expect(describeActivity(entry('moved_out', 'Project Phantom'))).toBe('Sam moved Mango out to Project Phantom');
    expect(describeActivity(entry('shed', 'complete'))).toBe('Sam logged a shed for Mango (complete)');
    expect(describeActivity(entry('joined', 'editor', { gecko_name: null }))).toBe('Sam joined as an editor');
    expect(describeActivity(entry('joined', 'viewer', { gecko_name: null }))).toBe('Sam joined as a viewer');
    expect(describeActivity(entry('removed', 'pat@example.com', { gecko_name: null }))).toBe('Sam removed pat@example.com');
  });

  it('groups newest first by day', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const groups = groupActivityByDay([
      { id: 1, created_at: now.toISOString() },
      { id: 2, created_at: now.toISOString() },
      { id: 3, created_at: yesterday.toISOString() },
    ]);
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([['Today', 2], ['Yesterday', 1]]);
  });
});
