import { v4 as uuidv4 } from 'npm:uuid@9.0.1';

// Helper to format dates for iCalendar spec (YYYYMMDDTHHMMSSZ)
const formatICalDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

// Helper to format date-only (for all-day events)
const formatICalDateOnly = (date) => {
    return date.toISOString().substring(0, 10).replace(/-/g, '');
};

Deno.serve(async (req) => {
    try {
        const { title, description, startTime, endTime, repeatMonthly, repeatCount } = await req.json();

        if (!title || !startTime || !endTime) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const start = new Date(startTime);
        const end = new Date(endTime);
        const now = new Date();

        const icsLines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Base44//GeckInspect//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${uuidv4()}@geckinspect.base44.com`,
            `DTSTAMP:${formatICalDate(now)}`,
            `DTSTART;VALUE=DATE:${formatICalDateOnly(start)}`,
            `DTEND;VALUE=DATE:${formatICalDateOnly(end)}`,
            `SUMMARY:${title}`,
            `DESCRIPTION:${description || ''}`,
        ];

        // Add recurrence rule if repeatMonthly is true
        if (repeatMonthly && repeatCount) {
            // RRULE for monthly recurrence on the same day
            icsLines.push(`RRULE:FREQ=MONTHLY;COUNT=${repeatCount}`);
        }

        icsLines.push('END:VEVENT');
        icsLines.push('END:VCALENDAR');

        const icsContent = icsLines.join('\r\n');

        return new Response(icsContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'attachment; filename="event.ics"'
            }
        });

    } catch (error) {
        console.error("Error generating calendar event:", error);
        return new Response(JSON.stringify({ error: 'Failed to generate calendar event' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
});