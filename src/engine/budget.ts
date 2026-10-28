import {
  CATEGORIES,
  type BudgetLine,
  type Category,
  type Occasion,
  type Plan,
} from '../schemas/plan';
import { CONTINGENCY_PERCENT, PRESET_SPLIT, PRIORITY_BOOST } from './data/categories';
import { effectiveCost } from './quotes';
import { largestRemainder, sum } from './money';

/**
 * Splits a budget across categories. Priorities get a boost, contingency is a
 * fixed share, and the parts always add up to exactly `budget`.
 */
export function allocate(
  budget: number,
  occasion: Occasion,
  priorities: readonly Category[],
): BudgetLine[] {
  const split = PRESET_SPLIT[occasion];
  const flexible = CATEGORIES.filter((category) => category !== 'contingency');
  const boosted = flexible.map(
    (category) => split[category] * (priorities.includes(category) ? PRIORITY_BOOST : 1),
  );
  const scale = (100 - CONTINGENCY_PERCENT) / sum(boosted);
  const weights = [...boosted.map((weight) => weight * scale), CONTINGENCY_PERCENT];
  const amounts = largestRemainder(budget, weights);
  return CATEGORIES.map((category, index) => ({
    category,
    amount: amounts[index] ?? 0,
    locked: false,
  }));
}

/** Amount of one category. */
export function lineAmount(lines: readonly BudgetLine[], category: Category): number {
  return lines.find((line) => line.category === category)?.amount ?? 0;
}

/** Lines that can absorb changes: unlocked and not the contingency buffer. */
function flexibleIndexes(lines: readonly BudgetLine[], except: Category | null): number[] {
  return lines.flatMap((line, index) =>
    !line.locked && line.category !== 'contingency' && line.category !== except ? [index] : [],
  );
}

/** Spreads `target` across the given lines in proportion to their current amounts. */
function spread(lines: BudgetLine[], indexes: readonly number[], target: number): void {
  const amounts = largestRemainder(
    target,
    indexes.map((index) => lines[index]?.amount ?? 0),
  );
  indexes.forEach((lineIndex, position) => {
    const line = lines[lineIndex];
    if (line) lines[lineIndex] = { ...line, amount: amounts[position] ?? 0 };
  });
}

/** Result of moving money between lines. `null` lines means it could not be done. */
export interface Reallocation {
  lines: BudgetLine[] | null;
  /** The amount actually applied, after clamping. */
  applied: number;
}

/**
 * Sets one category to `amount` and takes the difference from (or gives it
 * to) the unlocked categories, proportionally. The total never changes.
 */
export function setLineAmount(
  lines: readonly BudgetLine[],
  category: Category,
  amount: number,
): Reallocation {
  const next = lines.map((line) => ({ ...line }));
  const flexible = flexibleIndexes(next, category);
  const fixed = sum(
    next
      .filter((line, index) => line.category !== category && !flexible.includes(index))
      .map((line) => line.amount),
  );
  const total = sum(next.map((line) => line.amount));
  if (flexible.length === 0) return { lines: null, applied: lineAmount(lines, category) };
  const applied = Math.min(Math.max(0, Math.round(amount)), total - fixed);
  spread(next, flexible, total - fixed - applied);
  const target = next.findIndex((line) => line.category === category);
  const line = next[target];
  if (line) next[target] = { ...line, amount: applied };
  return { lines: next, applied };
}

/** Changes the total budget. Locked lines keep their amounts; the rest scale. */
export function rescaleBudget(lines: readonly BudgetLine[], budget: number): Reallocation {
  const next = lines.map((line) => ({ ...line }));
  const lockedTotal = sum(next.filter((line) => line.locked).map((line) => line.amount));
  if (lockedTotal > budget) return { lines: null, applied: budget };
  const open = next.flatMap((line, index) => (line.locked ? [] : [index]));
  if (open.length === 0) return { lines: lockedTotal === budget ? next : null, applied: budget };
  spread(next, open, budget - lockedTotal);
  return { lines: next, applied: budget };
}

/** Locks or unlocks a category so automatic changes leave it alone. */
export function toggleLock(lines: readonly BudgetLine[], category: Category): BudgetLine[] {
  return lines.map((line) =>
    line.category === category ? { ...line, locked: !line.locked } : line,
  );
}

/** A category whose real need is more than its allocation. */
export interface Shortfall {
  category: Category;
  need: number;
  allocated: number;
  gap: number;
  reason: 'guests' | 'quote';
}

/**
 * What each category actually needs: an accepted quote's real cost, or for
 * catering the per-guest estimate times today's guest count.
 */
export function shortfalls(plan: Plan): Shortfall[] {
  const result: Shortfall[] = [];
  for (const line of plan.lines) {
    const accepted = plan.quotes.find(
      (quote) => quote.accepted && quote.category === line.category,
    );
    let need = line.amount;
    let reason: Shortfall['reason'] = 'quote';
    if (accepted) need = effectiveCost(accepted, plan.guests).total;
    else if (line.category === 'catering') {
      need = plan.perGuest * plan.guests;
      reason = 'guests';
    }
    if (need > line.amount) {
      result.push({
        category: line.category,
        need,
        allocated: line.amount,
        gap: need - line.amount,
        reason,
      });
    }
  }
  return result;
}

/** Total shortfall across categories. */
export function overBy(plan: Plan): number {
  return sum(shortfalls(plan).map((item) => item.gap));
}

/** Whether a category's amount comes from an accepted quote. */
export function isQuoted(plan: Plan, category: Category): boolean {
  return plan.quotes.some((quote) => quote.accepted && quote.category === category);
}
