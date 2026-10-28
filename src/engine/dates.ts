/**
 * Date helpers that work on ISO `YYYY-MM-DD` strings as whole UTC days,
 * so plans never drift with the viewer's time zone.
 */

const MS_PER_DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Days since the Unix epoch for an ISO date. */
export function toDay(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY);
}

/** ISO date for a day number. */
export function fromDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Adds (or subtracts) whole days to an ISO date. */
export function addDays(iso: string, days: number): string {
  return fromDay(toDay(iso) + days);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return toDay(to) - toDay(from);
}

/** Human date in the `28-Oct-2026` style used across the app. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day ?? ''}-${MONTHS[Number(month) - 1] ?? ''}-${year ?? ''}`;
}

/** Today's ISO date in India, where the families using this live. */
export function todayInIndia(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** Short relative phrase such as "in 12 days", "today" or "3 days ago". */
export function relativeDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
