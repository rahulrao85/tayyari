import type { Plan } from '../schemas/plan';
import { lineAmount, overBy } from './budget';
import { categoryLabel } from './data/categories';
import { VENDOR_NEEDS } from './data/vendors';
import { formatDate } from './dates';
import { formatINR } from './money';
import { quoteFlags } from './quotes';
import type { Schedule } from './timeline';

type InsightLevel = 'urgent' | 'attention' | 'tip';
export type Tab = 'overview' | 'budget' | 'timeline' | 'vendors' | 'ideas' | 'changes';

/** One thing the family should look at, and where to fix it. */
export interface Insight {
  level: InsightLevel;
  text: string;
  tab: Tab;
}

const RANK: Record<InsightLevel, number> = { urgent: 0, attention: 1, tip: 2 };
const titles = (names: readonly string[]) =>
  names.length > 2
    ? `${names.slice(0, 2).join('; ')} and ${names.length - 2} more`
    : names.join('; ');

/** Ranks what needs the family now across budget, timeline and vendors. Deterministic. */
export function planInsights(plan: Plan, schedule: Schedule): Insight[] {
  const items: Insight[] = [];
  const short = overBy(plan);
  if (short > 0)
    items.push({ level: 'urgent', text: `Over budget by ${formatINR(short)}.`, tab: 'budget' });

  const impossible = schedule.tasks.filter((task) => task.status === 'impossible');
  if (impossible.length > 0) {
    items.push({
      level: 'urgent',
      text: `${impossible.length} task(s) now land after the event: ${titles(impossible.map((task) => task.title))}.`,
      tab: 'timeline',
    });
  }
  const overdue = schedule.tasks.filter((task) => task.status === 'overdue');
  if (overdue.length > 0) {
    items.push({
      level: 'attention',
      text: `${overdue.length} task(s) are overdue: ${titles(overdue.map((task) => task.title))}.`,
      tab: 'timeline',
    });
  }
  const soon = schedule.tasks.find((task) => task.status === 'soon');
  if (soon) {
    items.push({
      level: 'attention',
      text: `Due by ${formatDate(soon.due)}: ${soon.title}.`,
      tab: 'timeline',
    });
  }

  for (const quote of plan.quotes.filter((item) => item.accepted)) {
    const open = quoteFlags(quote, plan.guests).filter((flag) => flag.code !== 'gst-extra');
    if (open.length > 0) {
      items.push({
        level: 'attention',
        text: `${quote.vendor}: ${open[0]?.message ?? ''}`,
        tab: 'vendors',
      });
    }
  }

  const unquoted = VENDOR_NEEDS[plan.occasion].filter(
    (need) => !plan.quotes.some((quote) => quote.category === need.category),
  );
  if (unquoted.length > 0) {
    const names = unquoted.map((need) => categoryLabel(need.category, plan.occasion).toLowerCase());
    items.push({ level: 'tip', text: `Collect quotes for ${titles(names)}.`, tab: 'vendors' });
  }
  if (lineAmount(plan.lines, 'contingency') < plan.budget * 0.05) {
    items.push({
      level: 'tip',
      text: 'Your buffer is under 5% of the budget. Surprises will hurt.',
      tab: 'budget',
    });
  }
  if (items.length === 0) {
    items.push({
      level: 'tip',
      text: 'Everything is on track. Ask for ideas or check the timeline.',
      tab: 'ideas',
    });
  }
  return items.sort((a, b) => RANK[a.level] - RANK[b.level]);
}
