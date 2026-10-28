import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatDate,
  fromDay,
  relativeDays,
  toDay,
  todayInIndia,
} from '../../src/engine/dates';
import { formatINR, formatShortINR, largestRemainder, parseINR, sum } from '../../src/engine/money';

describe('money', () => {
  it('formats rupees in the Indian grouping', () => {
    expect(formatINR(800000)).toBe('₹8,00,000');
    expect(formatINR(1234.6)).toBe('₹1,235');
  });

  it('shortens to lakh and crore', () => {
    expect(formatShortINR(800000)).toBe('₹8 L');
    expect(formatShortINR(12_500_000)).toBe('₹1.25 Cr');
    expect(formatShortINR(45000)).toBe('₹45,000');
    expect(formatShortINR(-150000)).toBe('−₹1.5 L');
  });

  it.each([
    ['8 lakh', 800000],
    ['8L', 800000],
    ['8.5 lacs', 850000],
    ['₹8,00,000', 800000],
    ['Rs. 60000', 60000],
    ['2 crore', 20000000],
    ['2cr', 20000000],
    ['50k', 50000],
    ['75 thousand', 75000],
    ['INR 1200', 1200],
  ])('reads %s', (input, expected) => {
    expect(parseINR(input)).toBe(expected);
  });

  it('returns null when there is no amount', () => {
    expect(parseINR('no money here')).toBeNull();
  });

  it('splits exactly and proportionally', () => {
    expect(largestRemainder(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(largestRemainder(10, [0, 0])).toEqual([5, 5]);
    expect(largestRemainder(10, [])).toEqual([]);
    expect(largestRemainder(7, [-3, 1])).toEqual([0, 7]);
  });

  it('always adds up to the total (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000 }),
        fc.array(fc.double({ min: 0, max: 1000, noNaN: true }), { minLength: 1, maxLength: 10 }),
        (total, weights) => {
          const parts = largestRemainder(total, weights);
          return sum(parts) === total && parts.every((part) => Number.isInteger(part) && part >= 0);
        },
      ),
    );
  });
});

describe('dates', () => {
  it('converts to and from day numbers', () => {
    expect(fromDay(toDay('2026-10-28'))).toBe('2026-10-28');
  });

  it('adds days across months and leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-10-28', '2027-02-28')).toBe(123);
    expect(daysBetween('2026-10-28', '2026-10-20')).toBe(-8);
  });

  it('formats dates as DD-Mon-YYYY', () => {
    expect(formatDate('2026-10-28')).toBe('28-Oct-2026');
  });

  it('gives today in India', () => {
    expect(todayInIndia(new Date('2026-10-28T20:00:00Z'))).toBe('2026-10-29');
    expect(todayInIndia()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('describes relative days', () => {
    expect(relativeDays(0)).toBe('today');
    expect(relativeDays(1)).toBe('tomorrow');
    expect(relativeDays(-1)).toBe('yesterday');
    expect(relativeDays(5)).toBe('in 5 days');
    expect(relativeDays(-3)).toBe('3 days ago');
  });
});
