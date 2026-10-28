import { createPlan } from '../src/engine/plan';
import type { Intake, Plan, Quote } from '../src/schemas/plan';

export const TODAY = '2026-10-28';

/** Priya's wedding from the explainer: ₹8 lakh, 200 guests, four months out. */
export function weddingIntake(overrides: Partial<Intake> = {}): Intake {
  return {
    occasion: 'wedding',
    title: "Priya's wedding",
    eventDate: '2027-02-28',
    budget: 800_000,
    guests: 200,
    priorities: ['catering'],
    vibe: 'Simple and intimate',
    mustHaves: [],
    guestMix: { kids: false, elders: true, accessibility: false },
    dietary: ['Vegetarian'],
    ...overrides,
  };
}

export function weddingPlan(overrides: Partial<Intake> = {}): Plan {
  return createPlan(weddingIntake(overrides), TODAY);
}

export function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'q1',
    category: 'catering',
    vendor: 'Annapurna Caterers',
    pricing: 'per_guest',
    amount: 1200,
    guestMinimum: null,
    taxIncluded: true,
    advancePercent: 30,
    cancellationPolicy: 'Full refund up to 30 days before',
    inclusions: [],
    accepted: false,
    ...overrides,
  };
}

export const total = (plan: Plan) => plan.lines.reduce((acc, line) => acc + line.amount, 0);
export const amountOf = (plan: Plan, category: string) =>
  plan.lines.find((line) => line.category === category)?.amount ?? -1;
