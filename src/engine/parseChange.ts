import { EMPTY_CHANGES, type ChangeSet } from '../schemas/plan';
import { COUNT, MONEY, MONEY_WITH_UNIT, moneyAfter, parseDate, readCount, unitDays } from './parse';

const GUESTS = String.raw`(?:guests?|people|pax|attendees|members)`;
const re = (source: string) => new RegExp(source, 'i');

const BUDGET_DOWN = [
  re(
    String.raw`(?:cut|reduce|lower|drop|decrease|trim)\s+(?:the\s+|our\s+)?budget\s+by\s+(${MONEY})`,
  ),
  re(String.raw`budget\s+(?:is\s+|has\s+)?(?:down|reduced|cut|lower|decreased)\s+by\s+(${MONEY})`),
  re(String.raw`(${MONEY_WITH_UNIT})\s+(?:less|lower|short|down)\b`),
];
const BUDGET_UP = [
  re(
    String.raw`(?:increase|raise|add|extend|top\s+up)\s+(?:the\s+|our\s+)?budget\s+by\s+(${MONEY})`,
  ),
  re(String.raw`budget\s+(?:is\s+|has\s+)?(?:up|increased|raised)\s+by\s+(${MONEY})`),
  re(String.raw`(${MONEY_WITH_UNIT})\s+(?:more|extra)\b(?!\s+${GUESTS})`),
];
const BUDGET_SET = [
  re(String.raw`budget\s+(?:is\s+now|now|to|of|=|:|is|becomes|will\s+be)\s+(${MONEY})`),
  re(String.raw`(${MONEY_WITH_UNIT})\s+budget\b`),
];

function readBudget(text: string): ChangeSet['budget'] {
  for (const pattern of BUDGET_DOWN) {
    const amount = moneyAfter(text, pattern);
    if (amount !== null) return { mode: 'delta', amount: -amount };
  }
  for (const pattern of BUDGET_UP) {
    const amount = moneyAfter(text, pattern);
    if (amount !== null) return { mode: 'delta', amount };
  }
  for (const pattern of BUDGET_SET) {
    const amount = moneyAfter(text, pattern);
    if (amount !== null) return { mode: 'set', amount };
  }
  return null;
}

function readGuests(text: string): ChangeSet['guests'] {
  const more =
    re(String.raw`(\d+)\s+(?:more|extra|additional)\s+${GUESTS}`).exec(text) ??
    re(String.raw`(?:add|invite)\s+(\d+)\s+(?:more\s+)?${GUESTS}`).exec(text);
  if (more?.[1]) return { mode: 'delta', count: Number(more[1]) };
  const fewer =
    re(String.raw`(\d+)\s+(?:fewer|less)\s+${GUESTS}`).exec(text) ??
    re(String.raw`(?:remove|drop|cut|reduce)\s+(\d+)\s+${GUESTS}`).exec(text);
  if (fewer?.[1]) return { mode: 'delta', count: -Number(fewer[1]) };
  const set =
    re(String.raw`${GUESTS}\s+(?:count\s+)?(?:to|now|=|is|are|becomes)\s+(\d+)`).exec(text) ??
    re(String.raw`(\d+)\s+${GUESTS}`).exec(text);
  return set?.[1] ? { mode: 'set', count: Number(set[1]) } : null;
}

function readDate(text: string, today: string): ChangeSet['date'] {
  const shift = re(
    String.raw`${COUNT}\s+(day|week|month)s?\s+(earlier|sooner|before|ahead|early|later|after|late)`,
  ).exec(text);
  if (shift?.[1] && shift[2] && shift[3]) {
    const days = readCount(shift[1]) * unitDays(shift[2]);
    return { mode: 'shift', days: /later|after|late/.test(shift[3]) ? days : -days };
  }
  const verb = re(
    String.raw`(prepone|bring\s+(?:it\s+)?forward|advance|postpone|delay|push(?:\s+it)?(?:\s+back)?)\s+(?:it\s+|the\s+event\s+)?by\s+${COUNT}\s+(day|week|month)s?`,
  ).exec(text);
  if (verb?.[1] && verb[2] && verb[3]) {
    const days = readCount(verb[2]) * unitDays(verb[3]);
    return { mode: 'shift', days: /postpone|delay|push/.test(verb[1]) ? days : -days };
  }
  const moved = re(
    String.raw`(?:move|shift|change|reschedule)\w*\s+(?:it\s+|the\s+(?:date|event)\s+)?to\s+(.+)`,
  ).exec(text);
  const iso = moved?.[1] ? parseDate(moved[1], today) : null;
  return iso ? { mode: 'set', iso } : null;
}

/**
 * Reads a change request such as "budget down by 50k, two weeks earlier and
 * 30 more guests" without AI. Anything it cannot read is left unchanged.
 */
export function parseChangeText(text: string, today: string): ChangeSet {
  const lower = text.toLowerCase().replace(/[–—]/g, '-');
  return {
    ...EMPTY_CHANGES,
    budget: readBudget(lower),
    guests: readGuests(lower),
    date: readDate(lower, today),
  };
}

/** True when the change set asks for nothing. */
export function isEmptyChange(changes: ChangeSet): boolean {
  return !changes.budget && !changes.guests && !changes.date && !changes.priorities;
}
