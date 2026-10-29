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

/** A day and month read from text, with the year if one was given. */
interface DayMonth {
  day: number;
  month: string;
  year: string | undefined;
}

const ISO_IN_TEXT = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const RELATIVE = new RegExp(String.raw`\bin\s{1,3}${COUNT}\s{1,3}(day|week|month)s?\b`);
const DAY_FIRST = new RegExp(
  String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s{1,3}(?:of\s{1,3})?${MONTH}\b,?\s{0,3}(\d{4})?`,
);
const MONTH_FIRST = new RegExp(
  String.raw`\b${MONTH}\s{1,3}(\d{1,2})(?:st|nd|rd|th)?\b,?\s{0,3}(\d{4})?`,
);
const PART_OF_MONTH = new RegExp(
  String.raw`\b(early|mid|late|end)(?:\s{1,3}of)?[\s-]{1,3}${MONTH}\b\s{0,3}(\d{4})?`,
);

/** "2027-02-14" → that date, if it is real. */
function readIsoDate(text: string): string | null {
  const match = ISO_IN_TEXT.exec(text);
  if (!match) return null;
  return isoFrom(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** "in 3 weeks" → today plus 21 days. */
function readRelativeDate(text: string, today: string): string | null {
  const match = RELATIVE.exec(text);
  if (!match?.[1] || !match[2]) return null;
  return addDays(today, readCount(match[1]) * unitDays(match[2]));
}

/** Each date shape and how to read its captures, tried in order. */
const DAY_MONTH_READERS: [RegExp, (match: RegExpExecArray) => DayMonth | null][] = [
  [DAY_FIRST, (m) => (m[1] && m[2] ? { day: Number(m[1]), month: m[2], year: m[3] } : null)],
  [MONTH_FIRST, (m) => (m[1] && m[2] ? { day: Number(m[2]), month: m[1], year: m[3] } : null)],
  [
    PART_OF_MONTH,
    (m) => (m[1] && m[2] ? { day: PART_DAY[m[1]] ?? 15, month: m[2], year: m[3] } : null),
  ],
];

/** "15 March", "March 15" or "mid-Feb", each with an optional year. */
function readDayMonth(text: string): DayMonth | null {
  for (const [pattern, read] of DAY_MONTH_READERS) {
    const match = pattern.exec(text);
    const found = match ? read(match) : null;
    if (found) return found;
  }
  return null;
}

/**
 * Reads a date from free text: ISO, "15 March 2027", "March 15", "mid-Feb",
 * "end of Dec", "in 3 months". Returns `null` when unsure.
 */
export function parseDate(text: string, today: string): string | null {
  const lower = text.toLowerCase();
  if (ISO_IN_TEXT.test(lower)) return readIsoDate(lower);
  const relative = readRelativeDate(lower, today);
  if (relative) return relative;
  const found = readDayMonth(lower);
  if (!found) return null;
  const month = MONTHS.indexOf(found.month.slice(0, 3));
  return found.year
    ? isoFrom(Number(found.year), month, found.day)
    : nextOccurrence(month, found.day, today);
}
