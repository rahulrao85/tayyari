import { ISO_DATE } from '../schemas/plan';
import { addDays, fromDay, toDay } from './dates';
import { parseINR } from './money';

/**
 * Small, predictable readers for the things families type: amounts, counts,
 * dates and durations. They back up the AI and never guess.
 */

/** An amount with an explicit rupee sign or unit, as text. */
export const MONEY = String.raw`(?:₹|rs\.?\s?|inr\s?)?\d[\d,]*(?:\.\d+)?\s*(?:lakhs?|lacs?|l|crores?|cr|k|thousand)?`;
/** Same, but the sign or unit is required, so "30 guests" is never read as money. */
export const MONEY_WITH_UNIT = String.raw`(?:(?:₹|rs\.?\s?|inr\s?)\d[\d,]*(?:\.\d+)?\s*(?:lakhs?|lacs?|l|crores?|cr|k|thousand)?|\d[\d,]*(?:\.\d+)?\s*(?:lakhs?|lacs?|l|crores?|cr|k|thousand))(?![a-z])`;

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};
export const COUNT = String.raw`(\d+|an?|one|two|three|four|five|six)`;

/** "3" → 3, "two" → 2, "a" → 1. */
export function readCount(token: string): number {
  return WORD_NUMBERS[token.toLowerCase()] ?? Number(token);
}

/** Days in a unit, for "2 weeks earlier" style phrases. */
export function unitDays(unit: string): number {
  if (unit.startsWith('week')) return 7;
  if (unit.startsWith('month')) return 30;
  return 1;
}

/** First match of a pattern, read as money. */
export function moneyAfter(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(text);
  return match?.[1] ? parseINR(match[1]) : null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;

function isoFrom(year: number, month: number, day: number): string | null {
  const iso = `${String(year)}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return fromDay(toDay(iso)) === iso ? iso : null;
}

/** Picks the next occurrence of a month/day after today when no year is given. */
function nextOccurrence(month: number, day: number, today: string): string | null {
  const year = Number(today.slice(0, 4));
  const thisYear = isoFrom(year, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return isoFrom(year + 1, month, day);
}

const PART_DAY: Record<string, number> = { early: 5, mid: 15, late: 25, end: 28 };

/**
 * Reads a date from free text: ISO, "15 March 2027", "March 15", "mid-Feb",
 * "end of Dec", "in 3 months". Returns `null` when unsure.
 */
export function parseDate(text: string, today: string): string | null {
  const lower = text.toLowerCase();
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(lower);
  if (iso?.[1] && ISO_DATE.test(iso[1]))
    return isoFrom(
      Number(iso[1].slice(0, 4)),
      Number(iso[1].slice(5, 7)) - 1,
      Number(iso[1].slice(8)),
    );
  const relative = new RegExp(String.raw`\bin\s+${COUNT}\s+(day|week|month)s?\b`).exec(lower);
  if (relative?.[1] && relative[2])
    return addDays(today, readCount(relative[1]) * unitDays(relative[2]));
  const dayFirst = new RegExp(
    String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\b,?\s*(\d{4})?`,
  ).exec(lower);
  const monthFirst = new RegExp(
    String.raw`\b${MONTH}\s+(\d{1,2})(?:st|nd|rd|th)?\b,?\s*(\d{4})?`,
  ).exec(lower);
  const part = new RegExp(
    String.raw`\b(early|mid|late|end)(?:\s+of)?[\s-]+${MONTH}\b\s*(\d{4})?`,
  ).exec(lower);
  let found: { day: number; month: string; year: string | undefined } | null = null;
  if (dayFirst?.[1] && dayFirst[2])
    found = { day: Number(dayFirst[1]), month: dayFirst[2], year: dayFirst[3] };
  else if (monthFirst?.[1] && monthFirst[2])
    found = { day: Number(monthFirst[2]), month: monthFirst[1], year: monthFirst[3] };
  else if (part?.[1] && part[2])
    found = { day: PART_DAY[part[1]] ?? 15, month: part[2], year: part[3] };
  if (!found) return null;
  const month = MONTHS.indexOf(found.month.slice(0, 3));
  return found.year
    ? isoFrom(Number(found.year), month, found.day)
    : nextOccurrence(month, found.day, today);
}
