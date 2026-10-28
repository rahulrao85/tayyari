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

const list = (text: string, max: number, length: number) =>
  text
    .split(',')
    .map((item) => item.trim().slice(0, length))
    .filter(Boolean)
    .slice(0, max);

/** Checks the form and returns either an intake or a message per invalid field. */
export function validateIntake(
  values: IntakeValues,
  today: string,
):
  | { intake: Intake; errors: null }
  | { intake: null; errors: Partial<Record<IntakeField, string>> } {
  const errors: Partial<Record<IntakeField, string>> = {};
  const budget = parseINR(values.budget);
  const guests = Number(values.guests);
  if (!values.occasion) errors.occasion = 'Choose what you are celebrating.';
  if (!values.eventDate) errors.eventDate = 'Pick the date of the event.';
  else if (values.eventDate < today)
    errors.eventDate = `Pick a date from ${formatDate(today)} onwards.`;
  if (budget === null || budget < 1000 || budget > MAX_BUDGET) {
    errors.budget = 'Enter a budget of at least ₹1,000, for example "8 lakh" or "40000".';
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS) {
    errors.guests = `Enter the number of guests, between 1 and ${MAX_GUESTS}.`;
  }
  if (values.priorities.length > 3) errors.priorities = 'Pick up to three.';
  if (Object.keys(errors).length > 0 || !values.occasion) return { intake: null, errors };
  const parsed = IntakeSchema.safeParse({
    occasion: values.occasion,
    title:
      values.title.trim().slice(0, 80) ||
      `${values.occasion[0]?.toUpperCase() ?? ''}${values.occasion.slice(1)} plan`,
    eventDate: values.eventDate,
    budget,
    guests,
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
