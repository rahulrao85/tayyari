import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  allocate,
  isQuoted,
  lineAmount,
  overBy,
  rescaleBudget,
  setLineAmount,
  shortfalls,
  toggleLock,
} from '../../src/engine/budget';
import { categoryLabel } from '../../src/engine/data/categories';
import { createPlan, pushVersion, MAX_VERSIONS } from '../../src/engine/plan';
import { CATEGORIES, OCCASIONS } from '../../src/schemas/plan';
import { amountOf, quote, TODAY, total, weddingIntake, weddingPlan } from '../helpers';

describe('allocate', () => {
  it('splits ₹8 lakh exactly, boosting the priority and keeping 10% contingency', () => {
    const lines = allocate(800000, 'wedding', ['catering']);
    expect(lines.map((line) => line.category)).toEqual([...CATEGORIES]);
    expect(lines.reduce((acc, line) => acc + line.amount, 0)).toBe(800000);
    expect(lineAmount(lines, 'contingency')).toBe(80000);
    const plain = allocate(800000, 'wedding', []);
    expect(lineAmount(lines, 'catering')).toBeGreaterThan(lineAmount(plain, 'catering'));
  });

  it('always sums to the budget for every occasion and priority set (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 100_000_000 }),
        fc.constantFrom(...OCCASIONS),
        fc.subarray([...CATEGORIES.slice(0, 7)], { maxLength: 3 }),
        (budget, occasion, priorities) =>
          allocate(budget, occasion, priorities).reduce((acc, line) => acc + line.amount, 0) ===
          budget,
      ),
    );
  });

  it('labels categories per occasion', () => {
    expect(categoryLabel('entertainment', 'birthday')).toBe('Games & activities');
    expect(categoryLabel('logistics', 'community')).toBe('Permits, sound & safety');
    expect(categoryLabel('venue', 'wedding')).toBe('Venue');
  });
});

describe('createPlan', () => {
  it('derives a per-guest catering estimate', () => {
    const plan = weddingPlan();
    expect(plan.perGuest).toBe(Math.floor(amountOf(plan, 'catering') / 200));
    expect(plan.createdOn).toBe(TODAY);
    expect(overBy(plan)).toBe(0);
  });

  it('keeps only the latest versions', () => {
    const plan = createPlan(weddingIntake(), TODAY);
    let history = pushVersion([], plan, 'start');
    for (let index = 0; index < MAX_VERSIONS + 5; index += 1)
      history = pushVersion(history, plan, `v${index}`);
    expect(history).toHaveLength(MAX_VERSIONS);
    expect(history.at(-1)?.note).toBe(`v${MAX_VERSIONS + 4}`);
  });
});

describe('setLineAmount', () => {
  it('moves money into photography and takes it from unlocked lines only', () => {
    const plan = weddingPlan();
    const locked = toggleLock(plan.lines, 'catering');
    const result = setLineAmount(locked, 'photography', 120000);
    expect(result.applied).toBe(120000);
    expect(result.lines?.reduce((acc, line) => acc + line.amount, 0)).toBe(800000);
    expect(lineAmount(result.lines ?? [], 'catering')).toBe(lineAmount(plan.lines, 'catering'));
    expect(lineAmount(result.lines ?? [], 'contingency')).toBe(80000);
  });

  it('clamps to what the other lines can give', () => {
    const plan = weddingPlan();
    const result = setLineAmount(plan.lines, 'venue', 10_000_000);
    expect(result.applied).toBe(800000 - 80000);
    expect(setLineAmount(plan.lines, 'venue', -5).applied).toBe(0);
  });

  it('refuses when nothing can absorb the change', () => {
    let lines = weddingPlan().lines;
    for (const category of CATEGORIES.slice(0, 7)) {
      if (category !== 'venue') lines = toggleLock(lines, category);
    }
    const result = setLineAmount(lines, 'venue', 1000);
    expect(result.lines).toBeNull();
    expect(result.applied).toBe(lineAmount(lines, 'venue'));
  });

  it('unlocks again', () => {
    const lines = toggleLock(toggleLock(weddingPlan().lines, 'decor'), 'decor');
    expect(lines.every((line) => !line.locked)).toBe(true);
  });
});

describe('rescaleBudget', () => {
  it('cuts a ₹50k reduction from unlocked lines and keeps locked ones', () => {
    const plan = weddingPlan();
    const lines = toggleLock(plan.lines, 'catering');
    const result = rescaleBudget(lines, 750000);
    expect(result.lines?.reduce((acc, line) => acc + line.amount, 0)).toBe(750000);
    expect(lineAmount(result.lines ?? [], 'catering')).toBe(lineAmount(plan.lines, 'catering'));
  });

  it('refuses a budget below the locked total', () => {
    const lines = toggleLock(weddingPlan().lines, 'catering');
    expect(rescaleBudget(lines, 1000).lines).toBeNull();
  });

  it('handles every line locked', () => {
    let lines = weddingPlan().lines;
    for (const category of CATEGORIES) lines = toggleLock(lines, category);
    expect(rescaleBudget(lines, 800000).lines).not.toBeNull();
    expect(rescaleBudget(lines, 900000).lines).toBeNull();
  });
});

describe('shortfalls', () => {
  it('flags catering when guests grow from 200 to 260', () => {
    const plan = { ...weddingPlan(), guests: 260 };
    const [gap] = shortfalls(plan);
    expect(gap?.category).toBe('catering');
    expect(gap?.reason).toBe('guests');
    expect(gap?.gap).toBe(plan.perGuest * 260 - amountOf(plan, 'catering'));
    expect(overBy(plan)).toBe(gap?.gap);
  });

  it('uses an accepted quote as the real need', () => {
    const plan = weddingPlan();
    const withQuote = {
      ...plan,
      quotes: [quote({ category: 'photography', pricing: 'flat', amount: 150000, accepted: true })],
    };
    expect(isQuoted(withQuote, 'photography')).toBe(true);
    expect(isQuoted(withQuote, 'decor')).toBe(false);
    expect(shortfalls(withQuote)[0]).toMatchObject({
      category: 'photography',
      reason: 'quote',
      need: 150000,
    });
  });

  it('is empty when the plan fits', () => {
    expect(shortfalls(weddingPlan())).toEqual([]);
    expect(total(weddingPlan())).toBe(800000);
  });
});
