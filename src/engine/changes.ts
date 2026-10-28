import { MAX_BUDGET, MAX_GUESTS, type Category, type ChangeSet, type Plan } from '../schemas/plan';
import { allocate, overBy, rescaleBudget } from './budget';
import { addDays, formatDate } from './dates';
import { formatINR } from './money';
import { buildSchedule, type TaskStatus } from './timeline';

/** Outcome of applying a change set. The plan is unchanged when `blocked` is set. */
export interface ChangeResult {
  plan: Plan;
  blocked: string | null;
  /** Plain-words list of what was applied, for the change log. */
  applied: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function applyBudget(plan: Plan, change: NonNullable<ChangeSet['budget']>): ChangeResult {
  const target = clamp(
    change.mode === 'set' ? change.amount : plan.budget + change.amount,
    1000,
    MAX_BUDGET,
  );
  const { lines } = rescaleBudget(plan.lines, target);
  if (!lines) {
    return {
      plan,
      blocked: 'Locked categories already cost more than that budget. Unlock one first.',
      applied: [],
    };
  }
  return {
    plan: { ...plan, budget: target, lines },
    blocked: null,
    applied: [`Budget ${formatINR(target)}`],
  };
}

/**
 * Applies a requested change in order: priorities, budget, guests, date.
 * Locked categories and accepted quotes are respected; nothing is silently cut.
 */
export function applyChangeSet(plan: Plan, changes: ChangeSet): ChangeResult {
  let next: Plan = plan;
  const applied: string[] = [];
  if (changes.priorities) {
    const fresh = allocate(next.budget, next.occasion, changes.priorities);
    const lines = next.lines.map((line) =>
      line.locked
        ? line
        : { ...line, amount: fresh.find((item) => item.category === line.category)?.amount ?? 0 },
    );
    const { lines: balanced } = rescaleBudget(lines, next.budget);
    next = { ...next, priorities: changes.priorities, lines: balanced ?? next.lines };
    applied.push(`Priorities: ${changes.priorities.join(', ') || 'none'}`);
  }
  if (changes.budget) {
    const result = applyBudget(next, changes.budget);
    if (result.blocked) return { plan, blocked: result.blocked, applied: [] };
    next = result.plan;
    applied.push(...result.applied);
  }
  if (changes.guests) {
    const guests = clamp(
      changes.guests.mode === 'set' ? changes.guests.count : next.guests + changes.guests.count,
      1,
      MAX_GUESTS,
    );
    next = { ...next, guests };
    applied.push(`${guests} guests`);
  }
  if (changes.date) {
    const eventDate =
      changes.date.mode === 'set' ? changes.date.iso : addDays(next.eventDate, changes.date.days);
    next = { ...next, eventDate };
    applied.push(`Date ${formatDate(eventDate)}`);
  }
  return { plan: next, blocked: null, applied };
}

/** How one task's date and status moved. */
interface TaskMove {
  id: string;
  title: string;
  before: { due: string; status: TaskStatus };
  after: { due: string; status: TaskStatus };
}

/** Everything that differs between two versions of a plan. */
export interface PlanDiff {
  budget: { before: number; after: number };
  guests: { before: number; after: number };
  eventDate: { before: string; after: string };
  lines: { category: Category; before: number; after: number }[];
  tasks: TaskMove[];
  overBy: { before: number; after: number };
  /** Tasks that became overdue or impossible because of this change. */
  newProblems: number;
}

const PROBLEM: ReadonlySet<TaskStatus> = new Set(['overdue', 'impossible']);

/** Compares two plans as of `today`, for the before/after view. */
export function diffPlans(before: Plan, after: Plan, today: string): PlanDiff {
  const lines = after.lines
    .map((line) => ({
      category: line.category,
      before: before.lines.find((item) => item.category === line.category)?.amount ?? 0,
      after: line.amount,
    }))
    .filter((line) => line.before !== line.after);
  const oldTasks = new Map(buildSchedule(before, today).tasks.map((task) => [task.id, task]));
  const tasks: TaskMove[] = [];
  for (const task of buildSchedule(after, today).tasks) {
    const old = oldTasks.get(task.id);
    if (!old || (old.due === task.due && old.status === task.status)) continue;
    tasks.push({
      id: task.id,
      title: task.title,
      before: { due: old.due, status: old.status },
      after: { due: task.due, status: task.status },
    });
  }
  return {
    budget: { before: before.budget, after: after.budget },
    guests: { before: before.guests, after: after.guests },
    eventDate: { before: before.eventDate, after: after.eventDate },
    lines,
    tasks,
    overBy: { before: overBy(before), after: overBy(after) },
    newProblems: tasks.filter(
      (move) => PROBLEM.has(move.after.status) && !PROBLEM.has(move.before.status),
    ).length,
  };
}

/** True when nothing in the diff changed. */
export function isEmptyDiff(diff: PlanDiff): boolean {
  return (
    diff.lines.length === 0 &&
    diff.tasks.length === 0 &&
    diff.budget.before === diff.budget.after &&
    diff.guests.before === diff.guests.after &&
    diff.eventDate.before === diff.eventDate.after
  );
}
