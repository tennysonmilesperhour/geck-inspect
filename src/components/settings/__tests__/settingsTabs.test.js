// @vitest-environment jsdom
// Settings is five tabs (finding J7). Emails, My Geckos and support
// replies link to anchors of the old one-page Settings, and those links
// are already in members' inboxes, so every old anchor must still open
// the tab that holds its control.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildNoticeRows } from '@/components/settings/NoticesTable';
import {
  DEFAULT_SETTINGS_TAB, SETTINGS_ANCHOR_TABS, SETTINGS_TABS, resolveSettingsTarget,
} from '@/components/settings/settingsTabs';

const ROOT = process.cwd();
const PAGE = readFileSync(resolve(ROOT, 'src/pages/Settings.jsx'), 'utf8');
const CARDS = readdirSync(resolve(ROOT, 'src/components/settings'))
  .filter((name) => name.endsWith('.jsx'))
  .map((name) => readFileSync(resolve(ROOT, 'src/components/settings', name), 'utf8'))
  .join('\n');
const idsIn = (source) => new Set([...source.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]));

// The anchors the one-page Settings had on 11 November 2026.
const OLD_ANCHORS = {
  'storage-usage': 'account', membership: 'account', security: 'account', support: 'account', 'profile-photos': 'account',
  appearance: 'look', 'favorite-pages': 'look', 'keeper-mode': 'look', 'morph-id': 'look',
  'email-notifications': 'reminders', 'push-notifications': 'reminders', 'phone-reminders': 'reminders', 'feeding-alerts': 'reminders',
  'basic-information': 'breeder', 'contact-information': 'breeder', 'social-media': 'breeder', 'store-policy': 'breeder',
  'breeder-perks': 'breeder', 'breeder-store': 'breeder', 'id-logic': 'breeder', 'default-sorts': 'breeder', 'market-alerts': 'breeder',
  'privacy-settings': 'privacy', collections: 'privacy', 'blocked-users': 'privacy', 'enclosure-sensors': 'privacy',
  'data-export': 'privacy', 'danger-zone': 'privacy',
};

describe('Settings tabs', () => {
  it('are the five tabs, in order', () => {
    expect(SETTINGS_TABS.map((t) => t.label)).toEqual(['Account', 'Look', 'Reminders', 'Breeder profile', 'Data and privacy']);
    expect(DEFAULT_SETTINGS_TAB).toBe('account');
  });

  it.each(Object.entries(OLD_ANCHORS))('the old anchor #%s opens the %s tab', (anchor, tab) => {
    expect(resolveSettingsTarget({ hash: `#${anchor}` })).toEqual({ tab, anchor, known: true });
  });

  it('every listed anchor is an id on the page or one of its cards', () => {
    const ids = new Set([...idsIn(PAGE), ...idsIn(CARDS)]);
    for (const anchor of Object.keys(SETTINGS_ANCHOR_TABS)) expect(ids.has(anchor), anchor).toBe(true);
  });

  it('every section of the page is listed, so a new one cannot be left without a tab', () => {
    const sections = [...PAGE.matchAll(/<section id="([a-z-]+)"/g)].map((m) => m[1]);
    expect(sections.length).toBeGreaterThan(15);
    for (const id of sections) expect(Object.hasOwn(SETTINGS_ANCHOR_TABS, id), id).toBe(true);
  });

  it('?tab= picks a tab, an anchor wins over it, and anything else opens Account', () => {
    expect(resolveSettingsTarget({ search: '?tab=reminders' })).toEqual({ tab: 'reminders', anchor: null, known: true });
    expect(resolveSettingsTarget({ search: '?tab=look', hash: '#id-logic' }).tab).toBe('breeder');
    expect(resolveSettingsTarget({ search: '?tab=nope' }).tab).toBe('account');
    expect(resolveSettingsTarget({}).tab).toBe('account');
    expect(resolveSettingsTarget({ hash: '#constructor' })).toEqual({ tab: 'account', anchor: 'constructor', known: false });
    // The address the retired Promote offer used.
    expect(resolveSettingsTarget({ search: '?tab=billing' })).toEqual({ tab: 'account', anchor: 'membership', known: true });
  });

  it('an anchor the list does not know is looked for on every tab', () => {
    expect(resolveSettingsTarget({ hash: '#hatch-alert-days' })).toEqual({ tab: 'account', anchor: 'hatch-alert-days', known: false });
  });
});

describe('the notices table rows', () => {
  const email = [
    { key: 'care', label: 'Care', description: 'c' },
    { key: 'messages', label: 'Messages', description: 'm' },
  ];
  const push = [
    { key: 'messages', email: 'messages', shared: true },
    { key: 'inquiry', email: 'messages', label: 'Inquiries', description: 'i' },
    { key: 'feeding', email: 'care', label: 'Feeding', description: 'f' },
    { key: 'orphan', label: 'Orphan', description: 'o' },
  ];

  it('puts a shared push switch on its email row and the rest on rows of their own under it', () => {
    expect(buildNoticeRows(email, push).map((r) => [r.label, r.emailKey, r.pushKey, r.parentLabel])).toEqual([
      ['Care', 'care', null, null],
      ['Feeding', null, 'feeding', 'Care'],
      ['Messages', 'messages', 'messages', null],
      ['Inquiries', null, 'inquiry', 'Messages'],
      ['Orphan', null, 'orphan', null],
    ]);
  });

  it('the page lists every stored key exactly once: 11 email switches and 17 push switches', () => {
    const list = (name) => {
      const from = PAGE.indexOf(`const ${name} = [`);
      const body = PAGE.slice(from, PAGE.indexOf('\n];', from));
      return [...body.matchAll(/\{ key: '([a-z_]+)'(?:, email: '([a-z_]+)')?(, shared: true)?/g)]
        .map((m) => ({ key: m[1], email: m[2], shared: Boolean(m[3]), label: m[1], description: '' }));
    };
    const emailKinds = list('notificationTypes');
    const pushKinds = list('pushNotificationTypes');
    expect(emailKinds.map((k) => k.key).sort()).toEqual([
      'announcements', 'breeding_updates', 'expert_status', 'following_activity', 'forum_replies', 'gecko_of_day',
      'level_up', 'market_alert', 'market_brief', 'new_follower', 'new_message',
    ]);
    expect(pushKinds.map((k) => k.key).sort()).toEqual([
      'announcement', 'expert_status', 'feeding_due', 'future_breeding_ready', 'gecko_of_the_day', 'hatch_alert', 'level_up',
      'market_alert', 'market_brief', 'marketplace_inquiry', 'new_breeding_plan', 'new_comment', 'new_follower',
      'new_gecko_listing', 'new_message', 'new_reply', 'submission_approved',
    ]);
    const rows = buildNoticeRows(emailKinds, pushKinds);
    expect(rows.map((r) => r.emailKey).filter(Boolean).sort()).toEqual(emailKinds.map((k) => k.key).sort());
    expect(rows.map((r) => r.pushKey).filter(Boolean).sort()).toEqual(pushKinds.map((k) => k.key).sort());
    // Every push kind names an email switch that exists.
    for (const kind of pushKinds) expect(emailKinds.some((e) => e.key === kind.email), kind.key).toBe(true);
  });
});
