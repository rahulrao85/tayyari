import { MAX_TASK_DELAY_DAYS, type Plan, type TaskProgress } from '../schemas/plan';
import { TASK_TEMPLATES, type TaskTemplate } from './data/tasks';
import { addDays, daysBetween } from './dates';

export type TaskStatus = 'done' | 'impossible' | 'overdue' | 'soon' | 'on-track';

/** A task placed on the calendar for this plan. */
export interface ScheduledTask {
  id: string;
  title: string;
  category: TaskTemplate['category'];
  dependsOn: readonly string[];
  /** Date it should be done by, before any delay. */
  plannedDue: string;
  /** Date it will be done by, after delays push it. */
  due: string;
  /** Days a delay (its own or a dependency's) pushed it. */
  pushedDays: number;
  /** Titles of the dependencies whose delay pushed it. */
  pushedBy: string[];
  status: TaskStatus;
}

export interface Schedule {
  tasks: ScheduledTask[];
  daysToGo: number;
  /** True when the event is closer than the usual lead time and the plan was squeezed. */
  compressed: boolean;
}

/** Days ahead of a due date that count as "soon". */
const SOON_DAYS = 7;

/** Orders templates so every task comes after its dependencies. Throws on a cycle. */
export function topoSort(templates: readonly TaskTemplate[]): TaskTemplate[] {
  const byId = new Map(templates.map((template) => [template.id, template]));
  const state = new Map<string, 'visiting' | 'done'>();
  const order: TaskTemplate[] = [];
  const visit = (template: TaskTemplate): void => {
    const seen = state.get(template.id);
    if (seen === 'done') return;
    if (seen === 'visiting') throw new Error(`Task dependency cycle at "${template.id}"`);
    state.set(template.id, 'visiting');
    for (const id of template.dependsOn) {
      const dependency = byId.get(id);
      if (!dependency) throw new Error(`Unknown dependency "${id}" in "${template.id}"`);
      visit(dependency);
    }
    state.set(template.id, 'done');
    order.push(template);
  };
  templates.forEach(visit);
  return order;
}

function statusOf(
  due: string,
  progress: TaskProgress | undefined,
  today: string,
  eventDate: string,
): TaskStatus {
  if (progress?.done) return 'done';
  if (daysBetween(eventDate, due) > 0) return 'impossible';
  const left = daysBetween(today, due);
  if (left < 0) return 'overdue';
  return left <= SOON_DAYS ? 'soon' : 'on-track';
}

/** Where a task landed, as days relative to the event (negative = before it). */
interface Placement {
  title: string;
  planned: number;
  due: number;
}

/**
 * The share of each lead time kept: 1 when the runway was long enough on the
 * day the plan was made, less when the event was closer than the longest lead.
 */
function compressionFactor(runway: number, longest: number): number {
  return runway < longest ? Math.max(runway, 0) / longest : 1;
}

/**
 * The task's due day after its own delay, pushed only as far as needed so it
 * is never due before a task it waits for. A slip early in the plan does not
 * drag every later task along with it.
 */
function dueAfterDependencies(
  template: TaskTemplate,
  planned: number,
  delayDays: number,
  placed: ReadonlyMap<string, Placement>,
): { due: number; pushedBy: string[] } {
  let due = planned + delayDays;
  const pushedBy: string[] = [];
  for (const id of template.dependsOn) {
    const dependency = placed.get(id);
    if (dependency && dependency.due > due) {
      due = dependency.due;
      pushedBy.push(dependency.title);
    }
  }
  return { due, pushedBy };
}

/**
 * Places every task on the calendar. When the event was closer than the
 * longest lead time on the day the plan was made, all lead times shrink by the
 * same factor so the plan starts that day and keeps its order. A delayed task
 * pushes a dependent task only if it would otherwise come first. Statuses are judged
 * against `today`, so tasks become overdue as time passes.
 */
export function buildSchedule(
  plan: Pick<Plan, 'occasion' | 'eventDate' | 'tasks' | 'createdOn'>,
  today: string,
  templates: readonly TaskTemplate[] = TASK_TEMPLATES[plan.occasion],
): Schedule {
  const runway = daysBetween(plan.createdOn, plan.eventDate);
  const longest = Math.max(...templates.map((template) => template.leadDays));
  const factor = compressionFactor(runway, longest);
  const placed = new Map<string, Placement>();
  const tasks: ScheduledTask[] = [];

  for (const template of topoSort(templates)) {
    const planned = -Math.floor(template.leadDays * factor);
    const progress = plan.tasks[template.id];
    const { due, pushedBy } = dueAfterDependencies(
      template,
      planned,
      progress?.delayDays ?? 0,
      placed,
    );
    placed.set(template.id, { title: template.title, planned, due });
    const dueIso = addDays(plan.eventDate, due);
    tasks.push({
      id: template.id,
      title: template.title,
      category: template.category,
      dependsOn: template.dependsOn,
      plannedDue: addDays(plan.eventDate, planned),
      due: dueIso,
      pushedDays: due - planned,
      pushedBy,
      status: statusOf(dueIso, progress, today, plan.eventDate),
    });
  }
  tasks.sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title));
  return { tasks, daysToGo: daysBetween(today, plan.eventDate), compressed: factor < 1 };
}

/** Marks a task done or not done. */
export function setTaskDone(plan: Plan, id: string, done: boolean): Plan {
  const current = plan.tasks[id] ?? { done: false, delayDays: 0 };
  return { ...plan, tasks: { ...plan.tasks, [id]: { ...current, done } } };
}

/** Longest delay a single task can record, in days. */
export const MAX_DELAY_DAYS = MAX_TASK_DELAY_DAYS;

/** Records that a task will slip by `delayDays`. */
export function setTaskDelay(plan: Plan, id: string, delayDays: number): Plan {
  const current = plan.tasks[id] ?? { done: false, delayDays: 0 };
  const days = Math.min(MAX_DELAY_DAYS, Math.max(0, Math.round(delayDays)));
  return { ...plan, tasks: { ...plan.tasks, [id]: { ...current, delayDays: days } } };
}

/** Counts tasks by status. */
export function statusCounts(schedule: Schedule): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    done: 0,
    impossible: 0,
    overdue: 0,
    soon: 0,
    'on-track': 0,
  };
  for (const task of schedule.tasks) counts[task.status] += 1;
  return counts;
}

/** Share of tasks done, 0–100. */
export function readiness(schedule: Schedule): number {
  if (schedule.tasks.length === 0) return 0;
  return Math.round((statusCounts(schedule).done / schedule.tasks.length) * 100);
}
