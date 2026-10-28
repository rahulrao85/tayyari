import { describe, expect, it } from 'vitest';
import { overBy, toggleLock } from '../../src/engine/budget';
import {
  acceptQuote,
  compareQuotes,
  effectiveCost,
  followUpMessage,
  quoteFlags,
  removeQuote,
} from '../../src/engine/quotes';
import { overBudgetOptions } from '../../src/engine/tradeoffs';
import { amountOf, quote, total, weddingPlan } from '../helpers';

describe('quotes', () => {
  it('applies the guest minimum and adds GST when it is extra', () => {
    const cost = effectiveCost(quote({ amount: 1500, guestMinimum: 250, taxIncluded: false }), 200);
    expect(cost).toEqual({ billedGuests: 250, base: 375000, tax: 67500, total: 442500 });
    expect(effectiveCost(quote({ pricing: 'flat', amount: 90000 }), 200).total).toBe(90000);
  });

  it('flags minimums, unstated GST, missing cancellation and high advances', () => {
    const codes = quoteFlags(
      quote({ guestMinimum: 250, taxIncluded: null, cancellationPolicy: null, advancePercent: 60 }),
      200,
    ).map((flag) => flag.code);
    expect(codes).toEqual(['guest-minimum', 'gst-unstated', 'no-cancellation', 'high-advance']);
    expect(quoteFlags(quote({ taxIncluded: false }), 200).map((flag) => flag.code)).toEqual([
      'gst-extra',
    ]);
    expect(quoteFlags(quote(), 200)).toEqual([]);
  });

  it('compares quotes cheapest first against the allocation', () => {
    const plan = {
      ...weddingPlan(),
      quotes: [
        quote({ id: 'a', amount: 1600 }),
        quote({ id: 'b', amount: 1100 }),
        quote({ id: 'c', category: 'decor' }),
      ],
    };
    const rows = compareQuotes(plan, 'catering');
    expect(rows.map((row) => row.quote.id)).toEqual(['b', 'a']);
    expect(rows[0]?.vsAllocation).toBe(1100 * 200 - amountOf(plan, 'catering'));
    expect(compareQuotes(plan, 'contingency')).toEqual([]);
  });

  it('accepts one quote per category and removes quotes', () => {
    let plan = { ...weddingPlan(), quotes: [quote({ id: 'a' }), quote({ id: 'b' })] };
    plan = acceptQuote(plan, 'a');
    plan = acceptQuote(plan, 'b');
    expect(plan.quotes.map((item) => item.accepted)).toEqual([false, true]);
    expect(acceptQuote(plan, 'missing')).toBe(plan);
    expect(removeQuote(plan, 'a').quotes).toHaveLength(1);
  });

  it('writes a follow-up asking only for what is missing', () => {
    const message = followUpMessage(
      quote({ taxIncluded: null, cancellationPolicy: null, advancePercent: null }),
      200,
      '28-Feb-2027',
    );
    expect(message).toContain('whether GST is included');
    expect(message).toContain('any minimum number of plates');
    expect(message).toContain('28-Feb-2027');
    expect(followUpMessage(quote({ guestMinimum: 100 }), 200, '28-Feb-2027')).toContain(
      'confirm availability',
    );
  });
});

describe('over-budget options', () => {
  it('offers nothing when the plan fits', () => {
    expect(overBudgetOptions(weddingPlan())).toEqual([]);
  });

  it('offers trim, contingency, fewer guests and a bigger budget when guests grow to 260', () => {
    const plan = { ...weddingPlan(), guests: 260 };
    const gap = overBy(plan);
    const options = overBudgetOptions(plan);
    expect(options.map((option) => option.id)).toEqual(['trim', 'contingency', 'guests', 'raise']);
    for (const option of options) {
      expect(option.note.length).toBeGreaterThan(0);
      if (option.remainingGap === 0) expect(overBy(option.result)).toBe(0);
    }
    const trim = options[0];
    expect(total(trim!.result)).toBe(800000);
    expect(amountOf(trim!.result, 'catering')).toBe(amountOf(plan, 'catering') + gap);
    const raise = options.find((option) => option.id === 'raise');
    expect(raise?.result.budget).toBe(800000 + gap);
    const guests = options.find((option) => option.id === 'guests');
    expect(guests?.result.guests).toBeLessThan(260);
  });

  it('reports a partial cover when the buffer is too small', () => {
    const plan = { ...weddingPlan(), guests: 600 };
    const contingency = overBudgetOptions(plan).find((option) => option.id === 'contingency');
    expect(contingency?.remainingGap).toBeGreaterThan(0);
    expect(contingency?.note).toContain('still short');
    expect(amountOf(contingency!.result, 'contingency')).toBe(0);
  });

  it('skips trimming when everything else is locked or a priority', () => {
    let plan = { ...weddingPlan(), guests: 300 };
    for (const category of [
      'venue',
      'decor',
      'photography',
      'entertainment',
      'invitations',
      'logistics',
    ] as const) {
      plan = { ...plan, lines: toggleLock(plan.lines, category) };
    }
    expect(overBudgetOptions(plan).map((option) => option.id)).not.toContain('trim');
  });

  it('skips contingency when the buffer is empty, and guests when a quote is short too', () => {
    const base = weddingPlan();
    const plan = {
      ...base,
      guests: 260,
      lines: base.lines.map((line) =>
        line.category === 'contingency' ? { ...line, amount: 0 } : line,
      ),
      quotes: [
        quote({
          category: 'photography',
          pricing: 'flat' as const,
          amount: 200000,
          accepted: true,
        }),
      ],
    };
    const ids = overBudgetOptions(plan).map((option) => option.id);
    expect(ids).not.toContain('contingency');
    expect(ids).not.toContain('guests');
  });

  it('skips guests when there is no per-guest estimate', () => {
    const plan = { ...weddingPlan(), guests: 260 };
    const lines = plan.lines.map((line) =>
      line.category === 'catering' ? { ...line, amount: 0 } : line,
    );
    expect(
      overBudgetOptions({ ...plan, perGuest: 10, lines }).map((option) => option.id),
    ).not.toContain('guests');
    expect(overBudgetOptions({ ...plan, perGuest: 0 })).toEqual([]);
  });
});
