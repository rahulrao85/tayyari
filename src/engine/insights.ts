import type { Plan } from '../schemas/plan';
import { lineAmount, overBy } from './budget';
import { categoryLabel } from './data/categories';
import { VENDOR_NEEDS } from './data/vendors';
import { formatDate } from './dates';
import { formatINR } from './money';
import { quoteFlags } from './quotes';
import type { Schedule, TaskStatus } from './timeline';

type InsightLevel = 'urgent' | 'attention' | 'tip';
export type Tab = 'overview' | 'budget' | 'timeline' | 'vendors' | 'ideas' | 'changes';

/** One thing the family should look at, and where to fix it. */
export interface Insight {
  level: InsightLevel;
  text: string;
  tab: Tab;
}

/** A contingency buffer below this share of the budget is flagged as thin. */
const THIN_BUFFER_SHARE = 0.05;

const RANK: Record<InsightLevel, number> = { urgent: 0, attention: 1, tip: 2 };
const titles = (names: readonly string[]) =>
  names.length > 2
    ? `${names.slice(0, 2).join('; ')} and ${names.length - 2} more`
    : names.join('; ');

/** Over budget, or a buffer too thin to absorb surprises. */
function budgetInsights(plan: Plan): Insight[] {
  const items: Insight[] = [];
  const short = overBy(plan);
  if (short > 0) {
    items.push({ level: 'urgent', text: `Over budget by ${formatINR(short)}.`, tab: 'budget' });
  }
  if (lineAmount(plan.lines, 'contingency') < plan.budget * THIN_BUFFER_SHARE) {
    items.push({
      level: 'tip',
      text: 'Your buffer is under 5% of the budget. Surprises will hurt.',
      tab: 'budget',
    });
  }
  return items;
}

/** Tasks that now land after the event, are overdue, or are due soon. */
function timelineInsights(schedule: Schedule): Insight[] {
  const items: Insight[] = [];
  const withStatus = (status: TaskStatus) =>
    schedule.tasks.filter((task) => task.status === status).map((task) => task.title);
  const impossible = withStatus('impossible');
  if (impossible.length > 0) {
    const text = `${String(impossible.length)} task(s) now land after the event: ${titles(impossible)}.`;
    items.push({ level: 'urgent', text, tab: 'timeline' });
  }
  const overdue = withStatus('overdue');
  if (overdue.length > 0) {
    const text = `${String(overdue.length)} task(s) are overdue: ${titles(overdue)}.`;
    items.push({ level: 'attention', text, tab: 'timeline' });
  }
  const soon = schedule.tasks.find((task) => task.status === 'soon');
  if (soon) {
    const text = `Due by ${formatDate(soon.due)}: ${soon.title}.`;
    items.push({ level: 'attention', text, tab: 'timeline' });
  }
  return items;
}

/** Accepted quotes with open questions, and vendors with no quote yet. */
function vendorInsights(plan: Plan): Insight[] {
  const items: Insight[] = [];
  for (const quote of plan.quotes.filter((item) => item.accepted)) {
    const open = quoteFlags(quote, plan.guests).find((flag) => flag.code !== 'gst-extra');
    if (open)
      items.push({ level: 'attention', text: `${quote.vendor}: ${open.message}`, tab: 'vendors' });
  }
  const unquoted = VENDOR_NEEDS[plan.occasion]
    .filter((need) => !plan.quotes.some((quote) => quote.category === need.category))
    .map((need) => categoryLabel(need.category, plan.occasion).toLowerCase());
  if (unquoted.length > 0) {
    items.push({ level: 'tip', text: `Collect quotes for ${titles(unquoted)}.`, tab: 'vendors' });
  }
  return items;
}

const ALL_CLEAR: Insight = {
  level: 'tip',
  text: 'Everything is on track. Ask for ideas or check the timeline.',
  tab: 'ideas',
};

/** Ranks what needs the family now across budget, timeline and vendors. Deterministic. */
export function planInsights(plan: Plan, schedule: Schedule): Insight[] {
  const items = [...budgetInsights(plan), ...timelineInsights(schedule), ...vendorInsights(plan)];
  if (items.length === 0) return [ALL_CLEAR];
  return items.sort((a, b) => RANK[a.level] - RANK[b.level]);
}
