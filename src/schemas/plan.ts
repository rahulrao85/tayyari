import * as z from 'zod/mini';

/** Small builders so the schemas stay readable with zod/mini's tree-shakable API. */
export const str = (min: number, max: number) =>
  z.string().check(z.minLength(min), z.maxLength(max));
export const int = (min: number, max: number) => z.int().check(z.minimum(min), z.maximum(max));
export const num = (min: number, max: number) => z.number().check(z.minimum(min), z.maximum(max));
export const list = <T extends z.core.$ZodType>(item: T, max: number) =>
  z.array(item).check(z.maxLength(max));

/** The three celebrations the challenge names. */
export const OCCASIONS = ['wedding', 'birthday', 'community'] as const;
export const OccasionSchema = z.enum(OCCASIONS);
export type Occasion = z.infer<typeof OccasionSchema>;

/** Budget categories, in display order. Contingency is always last. */
export const CATEGORIES = [
  'venue',
  'catering',
  'decor',
  'photography',
  'entertainment',
  'invitations',
  'logistics',
  'contingency',
] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

/** Categories a vendor can quote for (everything except the contingency buffer). */
const VENDOR_CATEGORIES = [
  'venue',
  'catering',
  'decor',
  'photography',
  'entertainment',
  'invitations',
  'logistics',
] as const;
export const VendorCategorySchema = z.enum(VENDOR_CATEGORIES);

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const IsoDateSchema = z.string().check(
  z.regex(ISO_DATE, 'Use a YYYY-MM-DD date'),
  z.refine((value) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return !Number.isNaN(time) && new Date(time).toISOString().startsWith(value);
  }, 'Not a real date'),
);

export const MAX_BUDGET = 100_000_000;
export const MAX_GUESTS = 5000;

const BudgetLineSchema = z.object({
  category: CategorySchema,
  amount: int(0, MAX_BUDGET),
  locked: z.boolean(),
});
export type BudgetLine = z.infer<typeof BudgetLineSchema>;

const TaskProgressSchema = z.object({
  done: z.boolean(),
  delayDays: int(0, 365),
});
export type TaskProgress = z.infer<typeof TaskProgressSchema>;

export const QuoteSchema = z.object({
  id: str(1, 40),
  category: VendorCategorySchema,
  vendor: str(1, 60),
  pricing: z.enum(['per_guest', 'flat']),
  amount: int(0, MAX_BUDGET),
  guestMinimum: z.nullable(int(1, MAX_GUESTS)),
  taxIncluded: z.nullable(z.boolean()),
  advancePercent: z.nullable(num(0, 100)),
  cancellationPolicy: z.nullable(str(0, 200)),
  inclusions: list(str(0, 60), 10),
  accepted: z.boolean(),
});
export type Quote = z.infer<typeof QuoteSchema>;

export const GuestMixSchema = z.object({
  kids: z.boolean(),
  elders: z.boolean(),
  accessibility: z.boolean(),
});
export type GuestMix = z.infer<typeof GuestMixSchema>;

export const PlanSchema = z.object({
  occasion: OccasionSchema,
  title: str(1, 80),
  eventDate: IsoDateSchema,
  createdOn: IsoDateSchema,
  budget: int(1000, MAX_BUDGET),
  guests: int(1, MAX_GUESTS),
  perGuest: int(0, 100_000),
  priorities: list(CategorySchema, 3),
  vibe: str(0, 120),
  mustHaves: list(str(0, 80), 6),
  guestMix: GuestMixSchema,
  dietary: list(str(0, 40), 6),
  lines: z.array(BudgetLineSchema).check(z.length(CATEGORIES.length)),
  tasks: z.record(str(0, 40), TaskProgressSchema),
  quotes: list(QuoteSchema, 30),
});
export type Plan = z.infer<typeof PlanSchema>;

/** What the family tells us before a plan exists. */
export const IntakeSchema = z.object({
  occasion: OccasionSchema,
  title: str(1, 80),
  eventDate: IsoDateSchema,
  budget: int(1000, MAX_BUDGET),
  guests: int(1, MAX_GUESTS),
  priorities: list(CategorySchema, 3),
  vibe: str(0, 120),
  mustHaves: list(str(0, 80), 6),
  guestMix: GuestMixSchema,
  dietary: list(str(0, 40), 6),
});
export type Intake = z.infer<typeof IntakeSchema>;

/** A requested change to a plan, from the Change Desk. Every field is optional. */
export const ChangeSetSchema = z.object({
  budget: z.nullable(
    z.object({ mode: z.enum(['set', 'delta']), amount: int(-MAX_BUDGET, MAX_BUDGET) }),
  ),
  guests: z.nullable(
    z.object({ mode: z.enum(['set', 'delta']), count: int(-MAX_GUESTS, MAX_GUESTS) }),
  ),
  date: z.nullable(
    z.union([
      z.object({ mode: z.literal('set'), iso: IsoDateSchema }),
      z.object({ mode: z.literal('shift'), days: int(-730, 730) }),
    ]),
  ),
  priorities: z.nullable(list(CategorySchema, 3)),
});
export type ChangeSet = z.infer<typeof ChangeSetSchema>;

export const EMPTY_CHANGES: ChangeSet = {
  budget: null,
  guests: null,
  date: null,
  priorities: null,
};
