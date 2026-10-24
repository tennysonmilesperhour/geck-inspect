import { describe, expect, it } from 'vitest';
import { countNavNotifications, notificationPage } from '../navNotifications';

describe('menu event counts', () => {
  const row = { id: 'one', user_email: 'sam@example.com', is_read: false, link: '/ForumPost?id=123' };
  it('groups detail links and ignores read, quiet, duplicate and other-account rows', () => {
    expect(countNavNotifications([
      row, row,
      { ...row, id: 'two', link: '/Forum' },
      { ...row, id: 'read', is_read: true },
      { ...row, id: 'quiet', metadata: { quiet: 'true' } },
      { ...row, id: 'other', user_email: 'someone@example.com' },
    ], row.user_email)).toEqual({ Forum: 2 });
    expect(countNavNotifications([row], null)).toEqual({});
  });
  it('uses current destinations and ignores external links', () => {
    expect(notificationPage({ link: '/GeckoDetail?id=1' })).toBe('MyGeckos');
    expect(notificationPage({ link: '/OtherReptiles' })).toBe('MyGeckos');
    expect(notificationPage({ link: '/log?type=feeding', type: 'feeding_due' })).toBe('Today');
    expect(notificationPage({ link: '/BatchHusbandry' })).toBe('Today');
    expect(notificationPage({ link: '//elsewhere.test/Forum' })).toBeNull();
    expect(notificationPage({ link: 'https://elsewhere.test/Forum' })).toBeNull();
  });
  it('clears a count when its final event is read', () => {
    expect(countNavNotifications([{ ...row, is_read: true }], row.user_email)).toEqual({});
  });
});
