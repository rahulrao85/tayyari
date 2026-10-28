import type { Plan } from '../schemas/plan';
import { OCCASION_LABEL } from './data/categories';
import { addDays } from './dates';
import type { ScheduledTask } from './timeline';

/** Escapes text for an iCalendar property value (RFC 5545 §3.3.11). */
export function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets, continuing with a space (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else current += char;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const compact = (iso: string) => iso.replace(/-/g, '');

function allDayEvent(uid: string, iso: string, summary: string, stamp: string): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@tayyari`,
    `DTSTAMP:${compact(stamp)}T000000Z`,
    `DTSTART;VALUE=DATE:${compact(iso)}`,
    `DTEND;VALUE=DATE:${compact(addDays(iso, 1))}`,
    `SUMMARY:${escapeIcs(summary)}`,
    'END:VEVENT',
  ];
}

/** Every open task plus the event itself, as an .ics calendar file. */
export function scheduleToIcs(plan: Plan, tasks: readonly ScheduledTask[], today: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tayyari//Celebration planner//EN',
    'CALSCALE:GREGORIAN',
    ...allDayEvent(
      'event',
      plan.eventDate,
      `${plan.title} (${OCCASION_LABEL[plan.occasion]})`,
      today,
    ),
    ...tasks
      .filter((task) => task.status !== 'done')
      .flatMap((task) => allDayEvent(task.id, task.due, `Tayyari: ${task.title}`, today)),
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

/** A Google Calendar link that pre-fills an all-day event. */
export function googleCalendarUrl(title: string, iso: string): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${compact(iso)}/${compact(addDays(iso, 1))}`,
    details: 'Added from Tayyari, your celebration plan.',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
