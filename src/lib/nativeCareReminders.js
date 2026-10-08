// Schedules the care reminders from nativeCareSchedule.js on the phone.
// The website never calls the plugin. Permission is requested only from
// the Settings card, not on launch.
import { isNativePlatform } from '@/lib/revenuecat';
import { supabase } from '@/lib/supabaseClient';
import { memberWeighInEnabled, weighInSection } from '@/lib/careReminders';
import { CARE_REMINDER_CHANNEL, buildCareNotifications } from '@/lib/nativeCareSchedule';

const STORAGE_KEY = 'geckinspect.nativeCareNotificationIds';

function readIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function writeIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // A full private-storage quota should not block the reminder itself.
  }
}

async function loadScheduleInput(email, feedingAlertsEnabled) {
  const [profileRes, geckoRes, groupRes] = await Promise.all([
    supabase.from('profiles').select('extra_data, feeding_alerts_enabled').eq('email', email).maybeSingle(),
    supabase.from('geckos').select('id,name,archived').eq('created_by', email),
    supabase.from('feeding_groups').select('id,name,label,last_fed_date,interval_days,feeding_reminder_enabled').eq('created_by', email),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (geckoRes.error) throw geckoRes.error;
  if (groupRes.error) throw groupRes.error;
  const extra = profileRes.data?.extra_data;
  const feedingOn = typeof feedingAlertsEnabled === 'boolean'
    ? feedingAlertsEnabled
    : profileRes.data?.feeding_alerts_enabled !== false;
  return buildCareNotifications({
    feedingAlertsEnabled: feedingOn,
    weighInEnabled: memberWeighInEnabled(extra),
    geckos: geckoRes.data || [],
    weighInGeckos: weighInSection(extra).geckos || {},
    feedingGroups: groupRes.data || [],
  });
}

/**
 * Replace this phone's care reminders with the member's current schedule.
 * Does nothing on the website, and does nothing until notification
 * permission is already granted.
 */
export async function syncNativeCareReminders({ email, feedingAlertsEnabled } = {}) {
  if (!isNativePlatform() || !email) return { scheduled: 0, reason: 'skipped' };
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') return { scheduled: 0, reason: perm.display || 'prompt' };

  const notifications = await loadScheduleInput(email, feedingAlertsEnabled);
  try {
    await LocalNotifications.createChannel({
      id: CARE_REMINDER_CHANNEL,
      name: 'Care reminders',
      description: 'Feeding and weigh-in reminders for your geckos',
      importance: 4,
    });
  } catch {
    // iOS has no notification channels.
  }

  const previous = readIds();
  if (previous.length) {
    await LocalNotifications.cancel({ notifications: previous.map((id) => ({ id })) });
  }
  if (notifications.length) {
    await LocalNotifications.schedule({
      notifications: notifications.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        channelId: item.channelId,
        schedule: { at: new Date(item.at) },
      })),
    });
  }
  writeIds(notifications.map((item) => item.id));
  return { scheduled: notifications.length, reason: 'ok' };
}

/** Ask for notification permission, then schedule. Used by Settings. */
export async function enableNativeCareReminders(email) {
  if (!isNativePlatform() || !email) return { scheduled: 0, reason: 'skipped' };
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return { scheduled: 0, reason: perm.display || 'denied' };
  return syncNativeCareReminders({ email });
}

export async function nativeCarePermission() {
  if (!isNativePlatform()) return 'unsupported';
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.checkPermissions();
  return perm.display || 'prompt';
}
