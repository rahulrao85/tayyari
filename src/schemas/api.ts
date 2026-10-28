import * as z from 'zod/mini';
import {
  CategorySchema,
  ChangeSetSchema,
  GuestMixSchema,
  IsoDateSchema,
  MAX_BUDGET,
  MAX_GUESTS,
  OccasionSchema,
  VendorCategorySchema,
  int,
  list,
  num,
  str,
} from './plan';

/**
 * Contract between the browser and `/api/*`. The same schemas validate what
 * the browser sends, what the model returns and what the browser receives.
 */

const text = (max: number) => z.string().check(z.trim(), z.minLength(1), z.maxLength(max));
const shortList = (max: number, length: number) => list(str(0, length), max);

// ---------- intake ----------
export const IntakeRequestSchema = z.object({ text: text(1000), today: IsoDateSchema });
export const IntakeExtractSchema = z.object({
  occasion: z.nullable(OccasionSchema),
  title: z.nullable(str(0, 80)),
  eventDate: z.nullable(IsoDateSchema),
  budget: z.nullable(int(1000, MAX_BUDGET)),
  guests: z.nullable(int(1, MAX_GUESTS)),
  priorities: list(CategorySchema, 3),
  vibe: z.nullable(str(0, 120)),
  mustHaves: shortList(6, 80),
  guestMix: GuestMixSchema,
  dietary: shortList(6, 40),
  followUp: z.nullable(str(0, 200)),
});

// ---------- change desk ----------
export const ChangeRequestSchema = z.object({
  text: text(500),
  today: IsoDateSchema,
  current: z.object({
    budget: int(1000, MAX_BUDGET),
    guests: int(1, MAX_GUESTS),
    eventDate: IsoDateSchema,
  }),
});
export const ChangeExtractSchema = z.extend(ChangeSetSchema, { summary: str(0, 240) });

// ---------- vendor quote ----------
export const QuoteRequestSchema = z.object({ text: text(2000), category: VendorCategorySchema });
export const QuoteExtractSchema = z.object({
  vendor: z.nullable(str(0, 60)),
  pricing: z.enum(['per_guest', 'flat']),
  amount: int(0, MAX_BUDGET),
  guestMinimum: z.nullable(int(1, MAX_GUESTS)),
  taxIncluded: z.nullable(z.boolean()),
  advancePercent: z.nullable(num(0, 100)),
  cancellationPolicy: z.nullable(str(0, 200)),
  inclusions: shortList(10, 60),
});
export type QuoteExtract = z.infer<typeof QuoteExtractSchema>;

// ---------- ideas ----------
export const IdeasRequestSchema = z.object({
  occasion: OccasionSchema,
  vibe: str(0, 120),
  guests: int(1, MAX_GUESTS),
  budgetBand: z.enum(['modest', 'comfortable', 'generous']),
  guestMix: GuestMixSchema,
  dietary: shortList(6, 40),
  mustHaves: shortList(6, 80),
});
export type IdeasRequest = z.infer<typeof IdeasRequestSchema>;
export const IdeasSchema = z.object({
  themes: shortList(4, 120),
  activities: shortList(5, 120),
  food: shortList(5, 120),
  touches: shortList(5, 120),
  invitationLine: str(0, 200),
});
export type Ideas = z.infer<typeof IdeasSchema>;

// ---------- ask about my plan ----------
const FactsSchema = z.object({
  occasion: str(0, 40),
  eventDate: str(0, 20),
  daysToGo: int(-3650, 3650),
  guests: int(1, MAX_GUESTS),
  budget: str(0, 30),
  overBudgetBy: str(0, 30),
  buffer: str(0, 30),
  lines: shortList(8, 80),
  nextTasks: shortList(5, 140),
  problems: shortList(25, 160),
  guestNotes: shortList(16, 90),
});
export const AskRequestSchema = z.object({
  question: text(400),
  facts: FactsSchema,
  history: list(z.object({ role: z.enum(['user', 'assistant']), text: str(0, 600) }), 6),
});
export const AnswerSchema = z.object({ answer: str(0, 900) });

// ---------- explain a change ----------
export const ExplainRequestSchema = z.object({
  facts: FactsSchema,
  changes: shortList(12, 160),
  options: list(z.object({ id: str(0, 20), title: str(0, 120), effect: str(0, 240) }), 4),
});
export const ExplanationSchema = z.object({
  summary: str(0, 500),
  options: list(z.object({ id: str(0, 20), reading: str(0, 300) }), 4),
});

// ---------- envelope ----------
export const ERROR_CODES = [
  'BAD_REQUEST',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'RATE_LIMITED',
  'AI_UNAVAILABLE',
  'AI_RESPONSE_INVALID',
  'AI_TIMEOUT',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Successful AI reply: validated data plus which model answered. */
export interface AiReply<T> {
  data: T;
  model: string;
  cached: boolean;
}
