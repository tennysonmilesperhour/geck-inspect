// @vitest-environment jsdom
// The Settings page shows the Security section (two-factor sign-in) to
// admins only, under the name a reminder sends Tennyson to: "Settings,
// Security". Members get no Security link and never download the card.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ me: null, listFactors: 0 }));
const { stub } = vi.hoisted(() => ({ stub: () => ({ default: () => null }) }));
vi.mock('@/components/settings/BlockedUsersCard', stub);
vi.mock('@/components/settings/AccountDeletionCard', stub);
vi.mock('@/components/settings/StorageUsageCard', stub);
vi.mock('@/components/settings/CollectionsCard', stub);
vi.mock('@/components/settings/BreederStoreCard', stub);
vi.mock('@/components/settings/PushNotificationsCard', stub);
vi.mock('@/components/settings/PhoneRemindersCard', stub);
vi.mock('@/components/settings/DataExportCard', stub);
vi.mock('@/components/support/MySupportTickets', stub);
vi.mock('@/components/iot/IotSettingsCard', stub);
vi.mock('@/components/settings/WeighInReminderSetting', stub);
vi.mock('@/components/settings/WeeklyNotesSetting', stub);
vi.mock('@/components/settings/CollectionArtworkSetting', stub);
vi.mock('@/components/settings/IdLogicSettings', () => ({ default: () => null, DEFAULT_ID_SETTINGS: {} }));
vi.mock('@/entities/User', () => ({ User: { me: async () => fx.me, updateMyUserData: async () => ({}) } }));
vi.mock('@/integrations/Core', () => ({ UploadFile: async () => ({}) }));
vi.mock('@/lib/iotClient', () => ({ IOT_SENSORS_ENABLED: false }));
vi.mock('@/lib/billingPortal', () => ({ openBillingPortal: async () => {} }));
vi.mock('@/lib/revenuecat', () => ({ isNativePlatform: () => false }));
vi.mock('@/lib/nativeCareReminders', () => ({ syncNativeCareReminders: async () => {} }));
vi.mock('@/lib/onboardingState', () => ({ saveOnboarding: () => {} }));
vi.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'a', setTheme: () => {}, themes: [], secondary: 'b', setSecondary: () => {}, secondaryColors: [] }),
}));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ logout: async () => {}, isAuthenticated: true }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: () => {} }), toast: () => {} }));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: async () => { fx.listFactors += 1; return { data: { all: [] }, error: null }; },
      },
    },
    from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
  },
}));

import SettingsPage from '@/pages/Settings';

installDomHarness();

const renderSettings = () => render(<MemoryRouter><SettingsPage /></MemoryRouter>);

beforeEach(() => {
  fx.listFactors = 0;
});

describe('Settings, Security section', () => {
  it('is shown to an admin, with a Security link in the section list', async () => {
    fx.me = { id: 'a1', email: 'admin@example.test', role: 'admin', membership_tier: 'free' };
    renderSettings();
    expect(await screen.findByRole('link', { name: 'Security' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Security' }).getAttribute('href')).toBe('#security');
    expect(await screen.findByRole('button', { name: 'Set up an authenticator app' })).toBeTruthy();
    expect(document.getElementById('security')).toBeTruthy();
    expect(fx.listFactors).toBeGreaterThan(0);
  });

  it('is not shown to a member', async () => {
    fx.me = { id: 'm1', email: 'keeper@example.test', role: 'user', membership_tier: 'free' };
    renderSettings();
    expect(await screen.findByRole('link', { name: 'Danger Zone' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Security' })).toBeNull();
    expect(document.getElementById('security')).toBeNull();
    expect(screen.queryByText(/authenticator app/i)).toBeNull();
    expect(fx.listFactors).toBe(0);
  });
});
