// The five Settings tabs, and where every anchor of the old one-page
// Settings lives now (experience review of 11 November 2026, finding J7).
//
// Emails, support replies and other pages link to /Settings#some-anchor
// (for example #email-notifications in every email footer and #id-logic
// from My Geckos). Those links are already in members' inboxes, so an
// anchor is never renamed or dropped: add new ones here, and keep the
// old ones pointing at the tab that holds the control.

export const SETTINGS_TABS = [
  { id: 'account', label: 'Account', shortLabel: 'Account' },
  { id: 'look', label: 'Look', shortLabel: 'Look' },
  { id: 'reminders', label: 'Reminders', shortLabel: 'Reminders' },
  { id: 'breeder', label: 'Breeder profile', shortLabel: 'Breeder' },
  { id: 'privacy', label: 'Data and privacy', shortLabel: 'Privacy' },
];

export const DEFAULT_SETTINGS_TAB = 'account';

const TAB_IDS = new Set(SETTINGS_TABS.map((t) => t.id));

export const SETTINGS_ANCHOR_TABS = {
  // Account
  'account-details': 'account',
  'display-name': 'account',
  'profile-photos': 'account',
  security: 'account',
  membership: 'account',
  'storage-usage': 'account',
  support: 'account',
  'log-out': 'account',
  // Look
  appearance: 'look',
  // The section is hidden (finding H7); the link still opens the tab it was on.
  'favorite-pages': 'look',
  'keeper-mode': 'look',
  'morph-id': 'look',
  // Reminders
  'email-notifications': 'reminders',
  'push-notifications': 'reminders',
  'phone-reminders': 'reminders',
  'feeding-alerts': 'reminders',
  // Breeder profile
  'basic-information': 'breeder',
  'contact-information': 'breeder',
  'social-media': 'breeder',
  'store-policy': 'breeder',
  'breeder-perks': 'breeder',
  'breeder-store': 'breeder',
  'id-logic': 'breeder',
  'default-sorts': 'breeder',
  'market-alerts': 'breeder',
  // Data and privacy
  'privacy-settings': 'privacy',
  collections: 'privacy',
  'blocked-users': 'privacy',
  'enclosure-sensors': 'privacy',
  'data-export': 'privacy',
  'danger-zone': 'privacy',
};

// ?tab= values other pages used before the tabs existed.
const LEGACY_TAB_PARAMS = {
  billing: { tab: 'account', anchor: 'membership' },
};

/**
 * Which tab to open, and which control to scroll to, for an address.
 * A known #anchor wins over ?tab=, so an old link always lands on its
 * control. `known` is false for an anchor this file does not list: the
 * page then looks for an element with that id on every tab.
 */
export function resolveSettingsTarget({ search = '', hash = '' } = {}) {
  const anchor = String(hash || '').replace(/^#/, '') || null;
  if (anchor && Object.hasOwn(SETTINGS_ANCHOR_TABS, anchor)) {
    return { tab: SETTINGS_ANCHOR_TABS[anchor], anchor, known: true };
  }
  const param = new URLSearchParams(search || '').get('tab');
  if (!anchor && param && Object.hasOwn(LEGACY_TAB_PARAMS, param)) {
    return { ...LEGACY_TAB_PARAMS[param], known: true };
  }
  const tab = TAB_IDS.has(param) ? param : DEFAULT_SETTINGS_TAB;
  return { tab, anchor, known: !anchor };
}
