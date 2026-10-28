import type { Category, Plan, Quote } from '../schemas/plan';
import { GST_RATE } from './data/categories';
import { formatINR } from './money';

/** What a quote really costs for this guest count. */
export interface QuoteCost {
  billedGuests: number | null;
  base: number;
  tax: number;
  total: number;
}

/** Real cost of a quote: guest minimums applied, and GST added when it is extra. */
export function effectiveCost(quote: Quote, guests: number): QuoteCost {
  const billedGuests =
    quote.pricing === 'per_guest' ? Math.max(guests, quote.guestMinimum ?? 0) : null;
  const base = billedGuests === null ? quote.amount : quote.amount * billedGuests;
  const tax = quote.taxIncluded === false ? Math.round(base * GST_RATE) : 0;
  return { billedGuests, base, tax, total: base + tax };
}

/** Something in a quote the family should check before booking. */
export interface QuoteFlag {
  code: 'guest-minimum' | 'gst-unstated' | 'gst-extra' | 'no-cancellation' | 'high-advance';
  message: string;
}

/** Flags anything that changes the real price or the risk of a quote. */
export function quoteFlags(quote: Quote, guests: number): QuoteFlag[] {
  const flags: QuoteFlag[] = [];
  if (quote.pricing === 'per_guest' && quote.guestMinimum !== null && quote.guestMinimum > guests) {
    flags.push({
      code: 'guest-minimum',
      message: `Minimum ${quote.guestMinimum} plates, but you have ${guests} guests. You pay for ${quote.guestMinimum}.`,
    });
  }
  if (quote.taxIncluded === null) {
    flags.push({
      code: 'gst-unstated',
      message: 'GST is not mentioned. Ask whether it is included.',
    });
  } else if (!quote.taxIncluded) {
    flags.push({ code: 'gst-extra', message: '18% GST is extra and has been added to the cost.' });
  }
  if (quote.cancellationPolicy === null) {
    flags.push({
      code: 'no-cancellation',
      message: 'No cancellation policy. Ask for it in writing.',
    });
  }
  if (quote.advancePercent !== null && quote.advancePercent > 50) {
    flags.push({
      code: 'high-advance',
      message: `${quote.advancePercent}% advance is high. Try to pay in stages.`,
    });
  }
  return flags;
}

/** One row of a side-by-side comparison. */
export interface QuoteComparison {
  quote: Quote;
  cost: QuoteCost;
  flags: QuoteFlag[];
  /** Positive when the quote is above the category's allocation. */
  vsAllocation: number;
}

/** Compares a category's quotes against its allocation, cheapest first. */
export function compareQuotes(plan: Plan, category: Category): QuoteComparison[] {
  const allocation = plan.lines.find((line) => line.category === category)?.amount ?? 0;
  return plan.quotes
    .filter((quote) => quote.category === category)
    .map((quote) => {
      const cost = effectiveCost(quote, plan.guests);
      return {
        quote,
        cost,
        flags: quoteFlags(quote, plan.guests),
        vsAllocation: cost.total - allocation,
      };
    })
    .sort((a, b) => a.cost.total - b.cost.total);
}

/** Accepts one quote for its category; any other quote in that category is un-accepted. */
export function acceptQuote(plan: Plan, quoteId: string): Plan {
  const chosen = plan.quotes.find((quote) => quote.id === quoteId);
  if (!chosen) return plan;
  return {
    ...plan,
    quotes: plan.quotes.map((quote) =>
      quote.category === chosen.category ? { ...quote, accepted: quote.id === quoteId } : quote,
    ),
  };
}

/** Removes a quote. */
export function removeQuote(plan: Plan, quoteId: string): Plan {
  return { ...plan, quotes: plan.quotes.filter((quote) => quote.id !== quoteId) };
}

/** A polite follow-up message asking the vendor for whatever is missing. */
export function followUpMessage(quote: Quote, guests: number, eventDate: string): string {
  const asks: string[] = [];
  if (quote.taxIncluded === null) asks.push('whether GST is included');
  if (quote.cancellationPolicy === null) asks.push('your cancellation and refund policy');
  if (quote.advancePercent === null) asks.push('how much advance you need and when');
  if (quote.pricing === 'per_guest' && quote.guestMinimum === null)
    asks.push('any minimum number of plates');
  const cost = formatINR(effectiveCost(quote, guests).total);
  const intro = `Namaste ${quote.vendor}, thank you for the quote (about ${cost} for ${guests} guests on ${eventDate}).`;
  if (asks.length === 0)
    return `${intro} Everything we need is covered. Could you confirm availability for our date?`;
  return `${intro} Before we decide, could you please confirm ${asks.join(', ')}? Thank you.`;
}
