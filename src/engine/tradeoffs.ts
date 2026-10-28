import type { BudgetLine, Category, Plan } from '../schemas/plan';
import { lineAmount, shortfalls, type Shortfall } from './budget';
import { formatINR, largestRemainder, sum } from './money';

/** One way to close a budget gap. The family picks; nothing is applied automatically. */
export interface TradeoffOption {
  id: 'trim' | 'contingency' | 'guests' | 'raise';
  title: string;
  /** Exact effect of each change: a budget line, the guest count or the total budget. */
  effects: { target: Category | 'guests' | 'budget'; delta: number }[];
  /** One plain sentence about the consequence. */
  note: string;
  /** Gap left after this option (0 when it fully closes it). */
  remainingGap: number;
  /** The plan after applying the option. */
  result: Plan;
}

/** Adds each shortfall's gap to its line, so the need is now funded. */
function fundShortfalls(
  lines: readonly BudgetLine[],
  gaps: readonly Shortfall[],
  share = 1,
): BudgetLine[] {
  return lines.map((line) => {
    const gap = gaps.find((item) => item.category === line.category)?.gap ?? 0;
    return { ...line, amount: line.amount + Math.floor(gap * share) };
  });
}

function trimOption(plan: Plan, gaps: Shortfall[], total: number): TradeoffOption | null {
  const short = new Set(gaps.map((item) => item.category));
  const flexible = plan.lines.filter(
    (line) =>
      !line.locked &&
      line.category !== 'contingency' &&
      !short.has(line.category) &&
      !plan.priorities.includes(line.category) &&
      line.amount > 0,
  );
  const available = sum(flexible.map((line) => line.amount));
  if (available < total) return null;
  const cuts = largestRemainder(
    total,
    flexible.map((line) => line.amount),
  );
  const cutBy = new Map(flexible.map((line, index) => [line.category, cuts[index] ?? 0]));
  const lines = fundShortfalls(plan.lines, gaps).map((line) => ({
    ...line,
    amount: line.amount - (cutBy.get(line.category) ?? 0),
  }));
  return {
    id: 'trim',
    title: 'Trim the categories that matter less',
    effects: [...cutBy].map(([target, cut]) => ({ target, delta: -cut })),
    note: 'Your priorities and locked categories are not touched.',
    remainingGap: 0,
    result: { ...plan, lines },
  };
}

function contingencyOption(plan: Plan, gaps: Shortfall[], total: number): TradeoffOption | null {
  const buffer = lineAmount(plan.lines, 'contingency');
  if (buffer === 0) return null;
  const used = Math.min(buffer, total);
  const share = used / total;
  const funded = fundShortfalls(plan.lines, gaps, share);
  const added = sum(funded.map((line) => line.amount)) - sum(plan.lines.map((line) => line.amount));
  const lines = funded.map((line) =>
    line.category === 'contingency' ? { ...line, amount: line.amount - added } : line,
  );
  return {
    id: 'contingency',
    title: 'Use the contingency buffer',
    effects: [{ target: 'contingency', delta: -added }],
    note:
      total > added
        ? `The buffer covers ${formatINR(added)}; ${formatINR(total - added)} is still short.`
        : `Leaves ${formatINR(buffer - added)} for surprises.`,
    remainingGap: total - added,
    result: { ...plan, lines },
  };
}

function guestsOption(plan: Plan, gaps: Shortfall[]): TradeoffOption | null {
  const catering = gaps.find((item) => item.reason === 'guests');
  if (!catering || plan.perGuest === 0 || gaps.length > 1) return null;
  const guests = Math.floor(catering.allocated / plan.perGuest);
  if (guests < 1) return null;
  return {
    id: 'guests',
    title: `Invite ${guests} guests instead of ${plan.guests}`,
    effects: [{ target: 'guests', delta: guests - plan.guests }],
    note: `Catering then fits the current ${formatINR(catering.allocated)} at the same per-guest estimate.`,
    remainingGap: 0,
    result: { ...plan, guests },
  };
}

function raiseOption(plan: Plan, gaps: Shortfall[], total: number): TradeoffOption {
  return {
    id: 'raise',
    title: 'Increase the total budget',
    effects: [{ target: 'budget', delta: total }],
    note: `The total becomes ${formatINR(plan.budget + total)}. Nothing else is cut.`,
    remainingGap: 0,
    result: { ...plan, budget: plan.budget + total, lines: fundShortfalls(plan.lines, gaps) },
  };
}

/**
 * Ways to close the gap when the plan is over budget, each with its exact
 * rupee effect. Returns an empty list when the plan fits.
 */
export function overBudgetOptions(plan: Plan): TradeoffOption[] {
  const gaps = shortfalls(plan);
  const total = sum(gaps.map((item) => item.gap));
  if (total === 0) return [];
  const options = [
    trimOption(plan, gaps, total),
    contingencyOption(plan, gaps, total),
    guestsOption(plan, gaps),
    raiseOption(plan, gaps, total),
  ];
  return options.filter((option) => option !== null);
}
