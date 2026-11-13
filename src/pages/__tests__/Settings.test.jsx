// @vitest-environment jsdom
// Settings in five tabs that save as the member changes things (work
// package WP-9 of the experience review: findings J7, F5, J3 and H7).
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ me: null, saves: [], fail: null, merged: [], pushHere: true }));
const { stub } = vi.hoisted(() => ({ stub: () => ({ default: () => null }) }));
vi.mock('@/components/settings/BlockedUsersCard', stub);
vi.mock('@/components/settings/AccountDeletionCard', stub);
vi.mock('@/components/settings/StorageUsageCard', stub);
vi.mock('@/components/settings/CollectionsCard', stub);
vi.mock('@/components/settings/BreederStoreCard', stub);
vi.mock('@/components/settings/PushNotificationsCard', () => ({ default: () => null, pushControlsAvailable: () => fx.pushHere }));
vi.mock('@/components/settings/PhoneRemindersCard', stub);
vi.mock('@/components/settings/DataExportCard', stub);
vi.mock('@/components/support/MySupportTickets', stub);
vi.mock('@/components/iot/IotSettingsCard', stub);
vi.mock('@/components/settings/WeighInReminderSetting', stub);
vi.mock('@/components/settings/WeeklyNotesSetting', stub);
vi.mock('@/components/settings/TimeZoneSetting', stub);
vi.mock('@/components/settings/CollectionArtworkSetting', stub);
vi.mock('@/components/subscription/UpgradePlansButton', stub);
vi.mock('@/entities/User', () => ({
  User: {
    me: async () => fx.me,
    updateMyUserData: async (patch) => {
      fx.saves.push(patch);
      if (fx.fail) throw fx.fail;
      return {};
    },
  },
}));
vi.mock('@/integrations/Core', () => ({ UploadFile: async () => ({}) }));
vi.mock('@/lib/iotClient', () => ({ IOT_SENSORS_ENABLED: false }));
vi.mock('@/lib/billingPortal', () => ({ openBillingPortal: async () => {} }));
vi.mock('@/lib/revenuecat', () => ({ isNativePlatform: () => false }));
vi.mock('@/lib/nativeCareReminders', () => ({ syncNativeCareReminders: async () => {} }));
vi.mock('@/lib/onboardingState', () => ({ saveOnboarding: async () => true }));
vi.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'a', setTheme: () => {}, themes: [], secondary: 'b', setSecondary: () => {}, secondaryColors: [] }),
}));
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ logout: async () => {}, isAuthenticated: true, mergeUserExtras: (extras) => fx.merged.push(extras) }),
}));
// One toast function for every render, as the real hook gives: the page
// reloads the profile whenever it changes.
vi.mock('@/components/ui/use-toast', () => {
  const toast = () => {};
  return { useToast: () => ({ toast }), toast };
});
vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import SettingsPage from '@/pages/Settings';

installDomHarness();

const MEMBER = {
  id: 'm1', auth_user_id: 'u1', email: 'keeper@example.test', role: 'user', membership_tier: 'free',
  full_name: 'Sam Keeper', bio: 'Harlequin and Lilly White lines.', business_name: 'Mossy Branch Geckos',
  email_notification_types: ['new_message', 'new_follower', 'breeding_updates'],
  push_notification_types: ['new_message', 'feeding_due'],
  push_notifications_enabled: true,
  favorite_page_names: ['MyGeckos', 'Breeding'],
};

const open = async (path = '/Settings') => {
  render(<MemoryRouter initialEntries={[path]}><SettingsPage /></MemoryRouter>);
  await screen.findByRole('tablist', {}, { timeout: 8000 });
};
const selectedTab = () => screen.getAllByRole('tab').find((t) => t.getAttribute('aria-selected') === 'true')?.getAttribute('aria-label');

beforeEach(() => {
  fx.me = { ...MEMBER };
  fx.saves = [];
  fx.fail = null;
  fx.merged = [];
  fx.pushHere = true;
});

describe('Settings, the five tabs', () => {
  it('opens on Account, with no Jump to list and no Save changes bar', async () => {
    await open();
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('aria-label'))).toEqual([
      'Account', 'Look', 'Reminders', 'Breeder profile', 'Data and privacy',
    ]);
    expect(selectedTab()).toBe('Account');
    expect(screen.queryByText('Jump to')).toBeNull();
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull();
    expect(screen.queryByText(/unsaved changes/i)).toBeNull();
    // Only the open tab's controls are on the page.
    expect(screen.getByLabelText('Display name')).toBeTruthy();
    expect(screen.queryByLabelText('Business name')).toBeNull();
  });

  it('an old link such as /Settings#id-logic opens the tab that holds the control', async () => {
    await open('/Settings#id-logic');
    expect(selectedTab()).toBe('Breeder profile');
    const section = document.getElementById('id-logic');
    expect(section).toBeTruthy();
    expect(section.closest('[data-settings-tab]').hidden).toBe(false);
    expect(within(section).getByText('Gecko ID Logic')).toBeTruthy();
  });

  it('the email footer link /Settings#email-notifications opens Reminders at the email switch', async () => {
    await open('/Settings#email-notifications');
    expect(selectedTab()).toBe('Reminders');
    expect(within(document.getElementById('email-notifications')).getByRole('switch', { name: 'Email notices' })).toBeTruthy();
  });

  it('?tab= opens a tab, and choosing a tab puts it in the address', async () => {
    const user = userEvent.setup();
    await open('/Settings?tab=look');
    expect(selectedTab()).toBe('Look');
    await user.click(screen.getByRole('tab', { name: 'Data and privacy' }));
    expect(selectedTab()).toBe('Data and privacy');
    expect(window.location.search).toBe('?tab=privacy');
    expect(screen.getByRole('switch', { name: 'Show my breeders publicly' })).toBeTruthy();
  });

  it('an anchor the list does not know is found on whichever tab holds it', async () => {
    await open('/Settings#hatch-alert-days');
    await waitFor(() => expect(selectedTab()).toBe('Reminders'));
    expect(screen.getByLabelText('Hatch alert (days incubating)')).toBeTruthy();
  });

  it('Favorite Pages is not shown, and saved favourites are never written back', async () => {
    const user = userEvent.setup();
    await open('/Settings#favorite-pages');
    expect(selectedTab()).toBe('Look');
    expect(screen.queryByText('Favorite Pages')).toBeNull();
    expect(document.getElementById('favorite-pages')).toBeNull();
    await user.click(screen.getByRole('switch', { name: 'Keeper mode' }));
    expect(fx.saves.some((patch) => 'favorite_page_names' in patch)).toBe(false);
  });

  it('a guest sees the sign-in wall and nothing is saved', async () => {
    fx.me = null;
    render(<MemoryRouter><SettingsPage /></MemoryRouter>);
    expect(await screen.findByText('Sign in to manage settings', {}, { timeout: 8000 })).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(fx.saves).toEqual([]);
  });

  it('Send feedback at the foot of the Account tab opens the feedback form', async () => {
    const user = userEvent.setup();
    const heard = vi.fn();
    window.addEventListener('open_feedback', heard);
    await open();
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));
    window.removeEventListener('open_feedback', heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe('Settings saves as the member changes things', () => {
  it('a switch saves at once, with only that field', async () => {
    const user = userEvent.setup();
    await open('/Settings?tab=privacy');
    const toggle = screen.getByRole('switch', { name: 'Show my breeders publicly' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await user.click(toggle);
    await waitFor(() => expect(fx.saves).toEqual([{ show_breeders_publicly: false }]));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('a failed save puts the switch back and shows the error, and Try again sends it again', async () => {
    const user = userEvent.setup();
    fx.fail = new Error('network down');
    await open('/Settings?tab=privacy');
    const toggle = screen.getByRole('switch', { name: 'Show my breeders publicly' });
    await user.click(toggle);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not save this, so it is back to what was saved.');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(fx.saves).toEqual([{ show_breeders_publicly: false }]);
    fx.fail = null;
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
    expect(fx.saves).toEqual([{ show_breeders_publicly: false }, { show_breeders_publicly: false }]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a text field saves when focus leaves it, and on Enter, and not while typing', async () => {
    const user = userEvent.setup();
    await open('/Settings?tab=breeder');
    const business = screen.getByLabelText('Business name');
    await user.clear(business);
    await user.type(business, 'Fern Gully Cresteds');
    expect(fx.saves).toEqual([]);
    await user.tab();
    await waitFor(() => expect(fx.saves).toEqual([{ business_name: 'Fern Gully Cresteds' }]));
    const city = screen.getByLabelText('City');
    await user.type(city, 'Portland{Enter}');
    await waitFor(() => expect(fx.saves).toEqual([{ business_name: 'Fern Gully Cresteds' }, { city: 'Portland' }]));
    // Focus leaving an unchanged field sends nothing.
    await user.click(screen.getByLabelText('Bio'));
    await user.tab();
    expect(fx.saves).toHaveLength(2);
  });

  it('what is typed is still saved if the page is left before focus moves', async () => {
    const user = userEvent.setup();
    await open('/Settings?tab=breeder');
    await user.type(screen.getByLabelText('Region'), 'Northwest');
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    await waitFor(() => expect(fx.saves).toEqual([{ region: 'Northwest' }]));
  });

  it('the display name is edited on the Account tab and writes full_name, as My Profile does', async () => {
    const user = userEvent.setup();
    await open();
    const name = screen.getByLabelText('Display name');
    expect(name.value).toBe('Sam Keeper');
    expect(name.getAttribute('maxlength')).toBe('60');
    await user.clear(name);
    await user.type(name, '  Sam of Mossy Branch  ');
    await user.tab();
    await waitFor(() => expect(fx.saves).toEqual([{ full_name: 'Sam of Mossy Branch' }]));
    expect(name.value).toBe('Sam of Mossy Branch');
    // The menu shows the name, so the signed-in member is updated too.
    expect(fx.merged).toEqual([{ full_name: 'Sam of Mossy Branch' }]);
  });

  it('an empty display name is refused and the saved name comes back', async () => {
    const user = userEvent.setup();
    await open();
    const name = screen.getByLabelText('Display name');
    await user.clear(name);
    await user.tab();
    expect((await screen.findByRole('alert')).textContent).toContain('A display name is needed.');
    expect(name.value).toBe('Sam Keeper');
    expect(fx.saves).toEqual([]);
  });

  it('a name that is still the sign-in email starts blank', async () => {
    fx.me = { ...MEMBER, full_name: MEMBER.email };
    await open();
    expect(screen.getByLabelText('Display name').value).toBe('');
  });
});

describe('Settings, Reminders: one table', () => {
  it('has a row per kind of notice with an Email and a Push column, masters above it', async () => {
    await open('/Settings?tab=reminders');
    expect(screen.getAllByRole('table')).toHaveLength(1);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Kind of notice', 'Email', 'Push']);
    expect(within(table).getAllByRole('switch', { name: /, email$/ })).toHaveLength(11);
    expect(within(table).getAllByRole('switch', { name: /, push$/ })).toHaveLength(17);
    // A kind with one channel has a blank cell that reads "Not available".
    const row = within(table).getByRole('rowheader', { name: /^Hatch alerts/ }).closest('tr');
    expect(within(row).getAllByRole('cell')[0].textContent).toBe('Not available');
    expect(within(row).getByRole('switch', { name: 'Hatch alerts, push' })).toBeTruthy();
    // The master switches come before the table.
    const master = screen.getByRole('switch', { name: 'Email notices' });
    expect(master.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Push notices' })).toBeTruthy();
    expect(within(table).getByRole('switch', { name: 'New messages, email' }).getAttribute('aria-checked')).toBe('true');
    expect(within(table).getByRole('switch', { name: 'Gecko of the Day, email' }).getAttribute('aria-checked')).toBe('false');
  });

  it('a cell saves only its own list, with the other kinds left as they were', async () => {
    const user = userEvent.setup();
    await open('/Settings?tab=reminders');
    await user.click(screen.getByRole('switch', { name: 'New followers, email' }));
    await waitFor(() => expect(fx.saves).toEqual([{ email_notification_types: ['new_message', 'breeding_updates'] }]));
    await user.click(screen.getByRole('switch', { name: 'Hatch alerts, push' }));
    await waitFor(() => expect(fx.saves[1]).toEqual({ push_notification_types: ['new_message', 'feeding_due', 'hatch_alert'] }));
  });

  it('a master switch that is off greys its column out without hiding it', async () => {
    const user = userEvent.setup();
    await open('/Settings?tab=reminders');
    await user.click(screen.getByRole('switch', { name: 'Email notices' }));
    await waitFor(() => expect(fx.saves).toEqual([{ email_notifications_enabled: false }]));
    expect(screen.getByRole('switch', { name: 'New messages, email' }).disabled).toBe(true);
    expect(screen.getByRole('switch', { name: 'New messages, push' }).disabled).toBe(false);
  });

  it('where this browser cannot take push, the Push column and its master are left out', async () => {
    fx.pushHere = false;
    await open('/Settings?tab=reminders');
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Kind of notice', 'Email']);
    expect(within(table).getAllByRole('switch')).toHaveLength(11);
    expect(screen.queryByRole('switch', { name: 'Push notices' })).toBeNull();
  });

  it('the hatch alert day count saves on blur, kept between 1 and 100', async () => {
    await open('/Settings?tab=reminders');
    const days = screen.getByLabelText('Hatch alert (days incubating)');
    expect(days.value).toBe('60');
    fireEvent.change(days, { target: { value: '250' } });
    fireEvent.blur(days);
    await waitFor(() => expect(fx.saves).toEqual([{ hatch_alert_days: 100 }]));
    expect(days.value).toBe('100');
  });
});
