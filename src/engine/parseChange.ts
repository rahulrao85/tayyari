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

const RELATIVE_SHIFT = re(
  String.raw`${COUNT}\s{1,3}(day|week|month)s?\s{1,3}(earlier|sooner|before|ahead|early|later|after|late)`,
);
const VERB_SHIFT = re(
  String.raw`(prepone|bring\s{1,3}(?:it\s{1,3})?forward|advance|postpone|delay|push(?:\s{1,3}it)?(?:\s{1,3}back)?)\s{1,3}(?:it\s{1,3}|the\s{1,3}event\s{1,3})?by\s{1,3}${COUNT}\s{1,3}(day|week|month)s?`,
);
const MOVED_TO = re(
  String.raw`(?:move|shift|change|reschedule)\w{0,3}\s{1,3}(?:it\s{1,3}|the\s{1,3}(?:date|event)\s{1,3})?to\s{1,3}(.{1,60})`,
);

/** A shift of `count` units, negative when the direction word means earlier. */
function shiftBy(count: string, unit: string, later: boolean): ChangeSet['date'] {
  const days = readCount(count) * unitDays(unit);
  return { mode: 'shift', days: later ? days : -days };
}

/** "2 weeks earlier", "3 days later". */
function readRelativeShift(text: string): ChangeSet['date'] {
  const match = RELATIVE_SHIFT.exec(text);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return shiftBy(match[1], match[2], /later|after|late/.test(match[3]));
}

/** "postpone it by 10 days", "prepone by 1 week". */
function readVerbShift(text: string): ChangeSet['date'] {
  const match = VERB_SHIFT.exec(text);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  return shiftBy(match[2], match[3], /postpone|delay|push/.test(match[1]));
}

/** "move it to 15 March 2027". */
function readMovedTo(text: string, today: string): ChangeSet['date'] {
  const target = MOVED_TO.exec(text)?.[1];
  const iso = target ? parseDate(target, today) : null;
  return iso ? { mode: 'set', iso } : null;
}

function readDate(text: string, today: string): ChangeSet['date'] {
  return readRelativeShift(text) ?? readVerbShift(text) ?? readMovedTo(text, today);
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
