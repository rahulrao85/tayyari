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

/** Reads what it can from a free-text description, without AI. */
export function parseIntakeText(text: string, today: string): IntakeDraft {
  const lower = text.toLowerCase();
  const occasion = OCCASION_WORDS.find(([, pattern]) => pattern.test(lower))?.[0] ?? null;
  const budget =
    moneyAfter(lower, new RegExp(String.raw`budget\s+(?:of|is|around|about|:|=)?\s*(${MONEY})`)) ??
    moneyAfter(lower, new RegExp(`(${MONEY_WITH_UNIT})`));
  const guestMatch = /(\d[\d,]*)\s*(?:guests|people|pax|attendees|members|families|kids)\b/.exec(
    lower,
  );
  const guests = guestMatch?.[1] ? Number(guestMatch[1].replace(/,/g, '')) : null;
  return {
    ...EMPTY_DRAFT,
    occasion,
    title: occasion ? `${OCCASION_LABEL[occasion]} plan` : null,
    eventDate: parseDate(lower, today),
    budget: budget !== null && budget >= 1000 ? budget : null,
    guests: guests !== null && guests > 0 ? guests : null,
    priorities: readPriorities(lower),
    vibe: /\b(simple|intimate|small)\b/.test(lower)
      ? 'Simple and intimate'
      : /\b(grand|lavish)\b/.test(lower)
        ? 'Grand'
        : '',
    guestMix: {
      kids: /\b(kids|children|child|toddlers?)\b/.test(lower),
      elders: /\b(elders?|elderly|grandparents?|senior|dadi|nani|dada|nana)\b/.test(lower),
      accessibility: /\b(wheelchair|accessible|accessibility|disabled|mobility)\b/.test(lower),
    },
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

/** Merges AI-extracted fields over the rule-based ones, keeping whichever is filled. */
export function mergeDrafts(base: IntakeDraft, extra: Partial<IntakeDraft>): IntakeDraft {
  return {
    occasion: extra.occasion ?? base.occasion,
    title: extra.title ?? base.title,
    eventDate: extra.eventDate ?? base.eventDate,
    budget: extra.budget ?? base.budget,
    guests: extra.guests ?? base.guests,
    priorities: extra.priorities?.length ? extra.priorities : base.priorities,
    vibe: extra.vibe ?? base.vibe,
    mustHaves: extra.mustHaves?.length ? extra.mustHaves : base.mustHaves,
    guestMix: {
      kids: base.guestMix.kids || (extra.guestMix?.kids ?? false),
      elders: base.guestMix.elders || (extra.guestMix?.elders ?? false),
      accessibility: base.guestMix.accessibility || (extra.guestMix?.accessibility ?? false),
    },
    dietary: [...new Set([...base.dietary, ...(extra.dietary ?? [])])].slice(0, 6),
  };
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
