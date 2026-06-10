/**
 * Client-side iCalendar (.ics) generator (replaces dead Base44 backend function).
 *
 * generateCalendarEvent({ title, description, startTime, endTime, repeatMonthly, repeatCount })
 *   - Builds an all-day VEVENT, optionally repeating monthly.
 *   - Returns { data: icsContent } to match the old contract; callers wrap it
 *     in a Blob and trigger a download.
 */

const formatICalDate = (date) =>
  date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

const formatICalDateOnly = (date) =>
  date.toISOString().substring(0, 10).replace(/-/g, '');

// RFC 5545: escape backslash, semicolon, comma, and newlines in text values
const escapeICalText = (text) =>
  String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export async function generateCalendarEvent(options) {
  const { title, description, startTime, endTime, repeatMonthly, repeatCount } = options || {};
  if (!title || !startTime || !endTime) {
    throw new Error('Missing required fields');
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  const now = new Date();
  const uid = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GeckInspect//GeckInspect//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@geckinspect.com`,
    `DTSTAMP:${formatICalDate(now)}`,
    `DTSTART;VALUE=DATE:${formatICalDateOnly(start)}`,
    `DTEND;VALUE=DATE:${formatICalDateOnly(end)}`,
    `SUMMARY:${escapeICalText(title)}`,
    `DESCRIPTION:${escapeICalText(description || '')}`,
  ];

  if (repeatMonthly && repeatCount) {
    icsLines.push(`RRULE:FREQ=MONTHLY;COUNT=${repeatCount}`);
  }

  icsLines.push('END:VEVENT');
  icsLines.push('END:VCALENDAR');

  return { data: icsLines.join('\r\n') };
}
