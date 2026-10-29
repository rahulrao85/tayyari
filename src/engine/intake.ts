import type { Category, GuestMix, Intake, Occasion } from '../schemas/plan';
import { OCCASION_LABEL } from './data/categories';
import { MONEY, MONEY_WITH_UNIT, moneyAfter, parseDate } from './parse';

/** What we know so far. Anything missing becomes a question. */
export interface IntakeDraft {
  occasion: Occasion | null;
  title: string | null;
  eventDate: string | null;
  budget: number | null;
  guests: number | null;
  priorities: Category[];
  vibe: string;
  mustHaves: string[];
  guestMix: GuestMix;
  dietary: string[];
}

export const EMPTY_DRAFT: IntakeDraft = {
  occasion: null,
  title: null,
  eventDate: null,
  budget: null,
  guests: null,
  priorities: [],
  vibe: '',
  mustHaves: [],
  guestMix: { kids: false, elders: false, accessibility: false },
  dietary: [],
};

const OCCASION_WORDS: [Occasion, RegExp][] = [
  ['wedding', /\b(wedding|shaadi|shadi|marriage|vivah|reception|engagement|sangeet)\b/],
  ['birthday', /\b(birthday|bday|b'day|turning \d+|\d+(?:st|nd|rd|th) birthday)\b/],
  [
    'community',
    /\b(puja|pooja|festival|ganpati|ganesh|durga|navratri|diwali|society|community|mela|satsang|annual day|get-together)\b/,
  ],
];

const PRIORITY_WORDS: [Category, RegExp][] = [
  ['catering', /\b(food|catering|menu|dinner|lunch)\b/],
  ['photography', /\b(photo\w*|video\w*|pictures)\b/],
  ['decor', /\b(decor\w*|flowers|lighting)\b/],
  ['entertainment', /\b(music|dj|band|games|performers?|entertainment)\b/],
  ['venue', /\b(venue|hall|lawn|location)\b/],
];
const EMPHASIS =
  /\b(premium|great|best|top|lavish|grand|matters?|important|priority|focus|must|amazing)\b/;

const DIET_WORDS: [string, RegExp][] = [
  ['Vegetarian', /\b(veg|vegetarian|pure veg)\b/],
  ['Jain', /\bjain\b/],
  ['Vegan', /\bvegan\b/],
  ['No onion or garlic', /no onion|without onion/],
  ['Halal', /\bhalal\b/],
  ['Gluten-free', /gluten/],
];

/** Which categories the family emphasises, e.g. "premium food" or "photos matter most". */
function readPriorities(text: string): Category[] {
  const clauses = text.split(/[,.;!?\n]| but | and /);
  const found = new Set<Category>();
  for (const clause of clauses) {
    if (!EMPHASIS.test(clause)) continue;
    for (const [category, pattern] of PRIORITY_WORDS) if (pattern.test(clause)) found.add(category);
  }
  return [...found].slice(0, 3);
}

/** "budget of 8 lakh", "budget: 40000". Quantifiers are bounded so long input cannot backtrack. */
const BUDGET_PHRASE = new RegExp(
  String.raw`budget\s{1,3}(?:(?:of|is|around|about)\s{1,3}|[:=]\s{0,3})?(${MONEY})`,
);
const MONEY_WITH_UNIT_PATTERN = new RegExp(`(${MONEY_WITH_UNIT})`);
/** Smallest amount read as a total budget, so stray numbers are not mistaken for one. */
const MIN_BUDGET = 1000;
/** "200 guests", "30 kids". */
const GUEST_COUNT = /(\d[\d,]{0,6})\s?(?:guests|people|pax|attendees|members|families|kids)\b/;

/** The feel of the event, if the description says. */
function readVibe(text: string): string {
  if (/\b(simple|intimate|small)\b/.test(text)) return 'Simple and intimate';
  if (/\b(grand|lavish)\b/.test(text)) return 'Grand';
  return '';
}

/** The total budget, if stated: "budget of 8 lakh" first, otherwise any amount with a unit. */
function readBudget(text: string): number | null {
  const budget = moneyAfter(text, BUDGET_PHRASE) ?? moneyAfter(text, MONEY_WITH_UNIT_PATTERN);
  return budget !== null && budget >= MIN_BUDGET ? budget : null;
}

/** The guest count, if stated as "200 guests" or similar. */
function readGuests(text: string): number | null {
  const count = Number(GUEST_COUNT.exec(text)?.[1]?.replace(/,/g, '') ?? '0');
  return count > 0 ? count : null;
}

/** Who is coming, from words like "kids", "grandparents" or "wheelchair". */
function readGuestMix(text: string): GuestMix {
  return {
    kids: /\b(kids|children|child|toddlers?)\b/.test(text),
    elders: /\b(elders?|elderly|grandparents?|senior|dadi|nani|dada|nana)\b/.test(text),
    accessibility: /\b(wheelchair|accessible|accessibility|disabled|mobility)\b/.test(text),
  };
}

/** Reads what it can from a free-text description, without AI. */
export function parseIntakeText(text: string, today: string): IntakeDraft {
  const lower = text.toLowerCase();
  const occasion = OCCASION_WORDS.find(([, pattern]) => pattern.test(lower))?.[0] ?? null;
  return {
    ...EMPTY_DRAFT,
    occasion,
    title: occasion ? `${OCCASION_LABEL[occasion]} plan` : null,
    eventDate: parseDate(lower, today),
    budget: readBudget(lower),
    guests: readGuests(lower),
    priorities: readPriorities(lower),
    vibe: readVibe(lower),
    guestMix: readGuestMix(lower),
    dietary: DIET_WORDS.filter(([, pattern]) => pattern.test(lower)).map(([label]) => label),
  };
}

/** A question to ask because a needed detail is missing. */
export interface IntakeQuestion {
  field: 'occasion' | 'eventDate' | 'budget' | 'guests' | 'priorities';
  question: string;
}

/** Asks only for what is missing, most important first. */
export function missingQuestions(draft: IntakeDraft): IntakeQuestion[] {
  const questions: IntakeQuestion[] = [];
  if (!draft.occasion) questions.push({ field: 'occasion', question: 'What are you celebrating?' });
  if (draft.budget === null)
    questions.push({
      field: 'budget',
      question: 'What is the total budget you are comfortable with?',
    });
  if (draft.guests === null)
    questions.push({ field: 'guests', question: 'Roughly how many guests do you expect?' });
  if (!draft.eventDate) questions.push({ field: 'eventDate', question: 'When is the event?' });
  if (draft.priorities.length === 0) {
    questions.push({
      field: 'priorities',
      question: 'What matters most to you: food, photos, decor, music or the venue?',
    });
  }
  return questions;
}

/** The AI's list when it found one, otherwise the rule-based list. */
const preferList = <T>(extra: T[] | undefined, base: T[]): T[] =>
  extra && extra.length > 0 ? extra : base;

/** A guest group counts as coming if either reader found it. */
function mergeGuestMix(base: GuestMix, extra: GuestMix | undefined): GuestMix {
  if (!extra) return base;
  return {
    kids: base.kids || extra.kids,
    elders: base.elders || extra.elders,
    accessibility: base.accessibility || extra.accessibility,
  };
}

/** Merges AI-extracted fields over the rule-based ones, keeping whichever is filled. */
export function mergeDrafts(base: IntakeDraft, extra: Partial<IntakeDraft>): IntakeDraft {
  return {
    ...base,
    ...withoutUndefined(extra),
    priorities: preferList(extra.priorities, base.priorities),
    mustHaves: preferList(extra.mustHaves, base.mustHaves),
    guestMix: mergeGuestMix(base.guestMix, extra.guestMix),
    dietary: [...new Set([...base.dietary, ...(extra.dietary ?? [])])].slice(0, 6),
  };
}

/** Drops keys whose value is `undefined`, so spreading never blanks a filled field. */
function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

/** Drops the `null`s an AI extraction uses for "not stated", so they never overwrite rule-based values. */
export function withoutNulls<T extends object>(
  extract: T,
): { [K in keyof T]?: Exclude<T[K], null> } {
  return Object.fromEntries(Object.entries(extract).filter(([, value]) => value !== null)) as {
    [K in keyof T]?: Exclude<T[K], null>;
  };
}

/** Turns a complete draft into an intake, or returns `null` if something required is missing. */
export function completeIntake(draft: IntakeDraft): Intake | null {
  if (!draft.occasion || !draft.eventDate || draft.budget === null || draft.guests === null)
    return null;
  return {
    occasion: draft.occasion,
    title:
      draft.title && draft.title.trim().length > 0
        ? draft.title.trim()
        : `${OCCASION_LABEL[draft.occasion]} plan`,
    eventDate: draft.eventDate,
    budget: draft.budget,
    guests: draft.guests,
    priorities: draft.priorities,
    vibe: draft.vibe,
    mustHaves: draft.mustHaves,
    guestMix: draft.guestMix,
    dietary: draft.dietary,
  };
}
