// On-device feeding and weigh-in reminders for the iOS and Android apps.
//
// The schedule is pure so it can be tested without a phone. The native
// plugin (src/lib/nativeCareReminders.js) only asks the OS to show these.
// Each item is one future local morning, never a time that has already
// passed (the OS would fire those immediately).

const MORNING_HOUR = 9;
const MAX_NOTIFICATIONS = 48;
const HORIZON_DAYS = 90;
export const CARE_REMINDER_CHANNEL = 'care-reminders';

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseYmd(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function ymdFromDate(date) {
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
}

function utcDay(ymd) {
  return Date.UTC(ymd.y, ymd.m - 1, ymd.d);
}

function addDays(ymd, days) {
  const next = new Date(utcDay(ymd) + days * 86400000);
  return { y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() };
}

function daysBetween(from, to) {
  return Math.round((utcDay(to) - utcDay(from)) / 86400000);
}

function clampDays(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(90, Math.round(n)));
}

// First date that is anchor + n*step (n >= 1) and is on or after today.
function firstDue(anchor, step, today) {
  let due = addDays(anchor, step);
  let guard = 0;
  while (daysBetween(today, due) < 0 && guard < 500) {
    due = addDays(due, step);
    guard += 1;
  }
  return due;
}

function localMorning(ymd, hour) {
  return new Date(ymd.y, ymd.m - 1, ymd.d, hour, 0, 0, 0);
}

// 9:00 on the due date, or the next morning if that time has already passed.
function morningOnOrAfter(due, now) {
  let at = localMorning(due, MORNING_HOUR);
  if (at.getTime() <= now.getTime() + 60_000) {
    at = localMorning(addDays(due, 1), MORNING_HOUR);
  }
  return at;
}

function takeId(key, used) {
  let hash = 2166136261;
  const text = String(key);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let id = (hash >>> 0) % 2147483646 + 1;
  while (used.has(id)) id = (id % 2147483646) + 1;
  used.add(id);
  return id;
}

function pushItem(items, used, { key, title, body, at }) {
  items.push({
    id: takeId(key, used),
    title,
    body,
    at: at.toISOString(),
    channelId: CARE_REMINDER_CHANNEL,
  });
}

/**
 * Build the local notifications to schedule.
 *
 * weighInGeckos matches profiles.extra_data.care_reminders.weigh_in.geckos:
 * { [geckoId]: { on, every_days, since } }.
 * geckos is { id, name, archived }[]. Archived or unknown geckos are skipped.
 * feedingGroups is { id, name, label, last_fed_date, interval_days, feeding_reminder_enabled }[].
 */
export function buildCareNotifications({
  now = new Date(),
  feedingAlertsEnabled = true,
  weighInEnabled = true,
  geckos = [],
  weighInGeckos = {},
  feedingGroups = [],
} = {}) {
  const today = ymdFromDate(now);
  const used = new Set();
  const items = [];
  const byId = new Map((geckos || []).map((gecko) => [String(gecko.id), gecko]));

  if (weighInEnabled) {
    for (const [geckoId, setting] of Object.entries(weighInGeckos || {})) {
      if (!setting || setting.on === false) continue;
      const gecko = byId.get(String(geckoId));
      if (!gecko || gecko.archived) continue;
      const every = clampDays(setting.every_days, 14);
      const anchor = parseYmd(setting.since) || today;
      const due = firstDue(anchor, every, today);
      if (daysBetween(today, due) > HORIZON_DAYS) continue;
      const name = String(gecko.name || '').trim() || 'A gecko';
      pushItem(items, used, {
        key: `weigh:${geckoId}`,
        title: 'Weigh-in due',
        body: `${name} is due for a weigh-in.`,
        at: morningOnOrAfter(due, now),
      });
    }
  }

  if (feedingAlertsEnabled) {
    for (const group of feedingGroups || []) {
      if (!group || group.feeding_reminder_enabled === false) continue;
      const interval = clampDays(group.interval_days, 7);
      const last = parseYmd(group.last_fed_date);
      const due = last ? firstDue(last, interval, today) : today;
      if (daysBetween(today, due) > HORIZON_DAYS) continue;
      const name = String(group.name || group.label || '').trim() || 'A feeding group';
      pushItem(items, used, {
        key: `feed:${group.id}`,
        title: 'Feeding due',
        body: `${name} is due to be fed.`,
        at: morningOnOrAfter(due, now),
      });
    }
  }

  items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id - b.id));
  return items.slice(0, MAX_NOTIFICATIONS);
}
