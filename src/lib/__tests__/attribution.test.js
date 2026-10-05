import { describe, expect, it } from 'vitest';
import {
  buildFirstTouch,
  entryFromPath,
  firstTouchProperties,
  referrerHost,
  safeLandingPath,
  sourceBucket,
} from '../attribution';
import { adminEmailSet, withoutAdminEvents, withoutAdminRows } from '../adminData';
import { isNewAccount } from '../activation';

describe('first-touch attribution', () => {
  it('keeps only the referrer host and ignores in-site referrers', () => {
    expect(referrerHost('https://www.google.com/search?q=lilly+white', 'geckinspect.com')).toBe('google.com');
    expect(referrerHost('https://geckinspect.com/MorphGuide', 'www.geckinspect.com')).toBeNull();
    expect(referrerHost('', 'geckinspect.com')).toBeNull();
    expect(referrerHost('not a url', 'geckinspect.com')).toBeNull();
  });

  it('removes secret tokens from landing paths', () => {
    expect(safeLandingPath('/claim/abc123secret')).toBe('/claim');
    expect(safeLandingPath('/collection-invite/tok')).toBe('/collection-invite');
    expect(safeLandingPath('/passport/GI-7Q2')).toBe('/passport');
    expect(safeLandingPath('/pedigree-tracker')).toBe('/pedigree-tracker');
  });

  it('names the special entry routes', () => {
    expect(entryFromPath('/passport/GI-1')).toBe('passport');
    expect(entryFromPath('/waitlist/some-breeder')).toBe('waitlist');
    expect(entryFromPath('/store/some-breeder')).toBe('store');
    expect(entryFromPath('/collection-invite/x')).toBe('invite');
    expect(entryFromPath('/claim/x')).toBe('claim');
    expect(entryFromPath('/', '?ref=ABC')).toBe('referral');
    expect(entryFromPath('/AuthPortal', '?grant=t')).toBe('store_grant');
    expect(entryFromPath('/MorphGuide', '')).toBeNull();
  });

  it('buckets the source with UTM first, then entry, then referrer kind', () => {
    expect(sourceBucket({ utm_source: 'Instagram', entry: 'passport' })).toBe('utm:instagram');
    expect(sourceBucket({ entry: 'passport', referrer_host: 'google.com' })).toBe('passport');
    expect(sourceBucket({ referrer_host: 'google.com' })).toBe('search');
    expect(sourceBucket({ referrer_host: 'l.instagram.com' })).toBe('social');
    expect(sourceBucket({ referrer_host: 'chatgpt.com' })).toBe('ai_assistant');
    expect(sourceBucket({ referrer_host: 'morphmarket.com' })).toBe('morphmarket');
    expect(sourceBucket({ referrer_host: 'pangeareptile.com' })).toBe('other_site');
    expect(sourceBucket({})).toBe('direct');
    expect(sourceBucket(null)).toBe('unknown');
  });

  it('builds a full record from a landing URL', () => {
    const touch = buildFirstTouch({
      href: 'https://geckinspect.com/claim/secret?utm_source=newsletter&utm_medium=email&utm_campaign=oct',
      referrer: 'https://mail.google.com/',
      now: Date.UTC(2026, 9, 5),
    });
    expect(touch).toMatchObject({
      referrer_host: 'mail.google.com',
      landing_path: '/claim',
      entry: 'claim',
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'oct',
      utm_content: null,
      source: 'utm:newsletter',
    });
    expect(JSON.stringify(touch)).not.toContain('secret');
    expect(firstTouchProperties(touch)).toMatchObject({ ft_source: 'utm:newsletter', ft_entry: 'claim' });
    expect(firstTouchProperties(null)).toEqual({ ft_source: 'unknown' });
  });
});

describe('new account check', () => {
  it('treats accounts created in the last day as new', () => {
    const now = Date.UTC(2026, 9, 5, 12);
    expect(isNewAccount({ created_at: new Date(now - 60_000).toISOString() }, now)).toBe(true);
    expect(isNewAccount({ created_at: new Date(now - 2 * 86_400_000).toISOString() }, now)).toBe(false);
    expect(isNewAccount({}, now)).toBe(false);
  });
});

describe('admin exclusion', () => {
  const users = [
    { email: 'Admin@example.com', role: 'admin' },
    { email: 'keeper@example.com', role: 'user' },
  ];
  const admins = adminEmailSet(users);

  it('drops admin events and every event in an admin session', () => {
    const events = [
      { user_email: 'admin@example.com', session_id: 's1', event_name: 'page_view' },
      { user_email: null, session_id: 's1', event_name: 'page_view' },
      { user_email: 'keeper@example.com', session_id: 's2', event_name: 'page_view' },
      { user_email: null, session_id: 's3', event_name: 'page_view', properties: { is_admin: true } },
      { user_email: null, session_id: 's4', event_name: 'page_view' },
    ];
    const kept = withoutAdminEvents(events, admins);
    expect(kept.map((e) => e.session_id)).toEqual(['s2', 's4']);
  });

  it('drops rows owned by an admin', () => {
    const rows = [{ created_by: 'admin@example.com' }, { created_by: 'keeper@example.com' }, { created_by: null }];
    expect(withoutAdminRows(rows, admins)).toHaveLength(2);
  });
});
