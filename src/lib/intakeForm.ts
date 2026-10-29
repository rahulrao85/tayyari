import { formatDate } from '../engine/dates';
import type { IntakeDraft } from '../engine/intake';
import { parseINR } from '../engine/money';
import {
  IntakeSchema,
  MAX_BUDGET,
  MAX_GUESTS,
  type Category,
  type GuestMix,
  type Intake,
  type Occasion,
} from '../schemas/plan';

/** The intake form's raw values, as typed. */
export interface IntakeValues {
  occasion: Occasion | '';
  title: string;
  eventDate: string;
  budget: string;
  guests: string;
  priorities: Category[];
  guestMix: GuestMix;
  dietary: string;
  mustHaves: string;
  vibe: string;
}

export type IntakeField = 'occasion' | 'eventDate' | 'budget' | 'guests' | 'priorities';

/** Pre-fills the form from what we read in the description. */
export function valuesFromDraft(draft: IntakeDraft): IntakeValues {
  return {
    occasion: draft.occasion ?? '',
    title: draft.title ?? '',
    eventDate: draft.eventDate ?? '',
    budget: draft.budget === null ? '' : String(draft.budget),
    guests: draft.guests === null ? '' : String(draft.guests),
    priorities: draft.priorities,
    guestMix: draft.guestMix,
    dietary: draft.dietary.join(', '),
    mustHaves: draft.mustHaves.join(', '),
    vibe: draft.vibe,
  };
}

const MIN_BUDGET = 1000;
const MAX_PRIORITIES = 3;

const list = (text: string, max: number, length: number) =>
  text
    .split(',')
    .map((item) => item.trim().slice(0, length))
    .filter(Boolean)
    .slice(0, max);

type FieldErrors = Partial<Record<IntakeField, string>>;

/** Rules per field: each returns an error message, or `undefined` when the value is fine. */
const RULES: Record<IntakeField, (values: IntakeValues, today: string) => string | undefined> = {
  occasion: (values) => (values.occasion ? undefined : 'Choose what you are celebrating.'),
  eventDate: (values, today) => {
    if (!values.eventDate) return 'Pick the date of the event.';
    return values.eventDate < today ? `Pick a date from ${formatDate(today)} onwards.` : undefined;
  },
  budget: (values) => {
    const budget = parseINR(values.budget);
    const valid = budget !== null && budget >= MIN_BUDGET && budget <= MAX_BUDGET;
    return valid
      ? undefined
      : 'Enter a budget of at least ₹1,000, for example "8 lakh" or "40000".';
  },
  guests: (values) => {
    const guests = Number(values.guests);
    const valid = Number.isInteger(guests) && guests >= 1 && guests <= MAX_GUESTS;
    return valid ? undefined : `Enter the number of guests, between 1 and ${String(MAX_GUESTS)}.`;
  },
  priorities: (values) =>
    values.priorities.length > MAX_PRIORITIES ? 'Pick up to three.' : undefined,
};

/** Every field that breaks a rule, with its message. */
function fieldErrors(values: IntakeValues, today: string): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of Object.keys(RULES) as IntakeField[]) {
    const message = RULES[field](values, today);
    if (message) errors[field] = message;
  }
  return errors;
}

/** The typed name, or "Wedding plan" style default. */
function planTitle(values: IntakeValues, occasion: Occasion): string {
  const typed = values.title.trim().slice(0, 80);
  return typed.length > 0 ? typed : `${occasion[0]?.toUpperCase() ?? ''}${occasion.slice(1)} plan`;
}

/** Checks the form and returns either an intake or a message per invalid field. */
export function validateIntake(
  values: IntakeValues,
  today: string,
): { intake: Intake; errors: null } | { intake: null; errors: FieldErrors } {
  const errors = fieldErrors(values, today);
  if (Object.keys(errors).length > 0 || !values.occasion) return { intake: null, errors };
  const parsed = IntakeSchema.safeParse({
    occasion: values.occasion,
    title: planTitle(values, values.occasion),
    eventDate: values.eventDate,
    budget: parseINR(values.budget),
    guests: Number(values.guests),
    priorities: values.priorities,
    vibe: values.vibe.trim().slice(0, 120),
    mustHaves: list(values.mustHaves, 6, 80),
    guestMix: values.guestMix,
    dietary: list(values.dietary, 6, 40),
  });
  return parsed.success
    ? { intake: parsed.data, errors: null }
    : { intake: null, errors: { eventDate: 'Check the date.' } };
}
