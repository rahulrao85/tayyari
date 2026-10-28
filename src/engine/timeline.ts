import type { Plan, TaskProgress } from '../schemas/plan';
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

/**
 * Places every task on the calendar. When the event was closer than the
 * longest lead time on the day the plan was made, all lead times shrink by the
 * same factor so the plan starts that day and keeps its order. Delays push
 * dependent tasks by the same gap they originally had. Statuses are judged
 * against `today`, so tasks become overdue as time passes.
 */
export function buildSchedule(
  plan: Pick<Plan, 'occasion' | 'eventDate' | 'tasks' | 'createdOn'>,
  today: string,
  templates: readonly TaskTemplate[] = TASK_TEMPLATES[plan.occasion],
): Schedule {
  const daysToGo = daysBetween(today, plan.eventDate);
  const runway = daysBetween(plan.createdOn, plan.eventDate);
  const longest = Math.max(...templates.map((template) => template.leadDays));
  const compressed = runway < longest;
  const factor = compressed ? Math.max(runway, 0) / longest : 1;
  const planned = new Map<string, number>();
  const actual = new Map<string, number>();
  const result = new Map<string, ScheduledTask>();

  for (const template of topoSort(templates)) {
    const lead = Math.floor(template.leadDays * factor);
    const base = -lead;
    const progress = plan.tasks[template.id];
    let due = base + (progress?.delayDays ?? 0);
    const pushedBy: string[] = [];
    for (const id of template.dependsOn) {
      const depPlanned = planned.get(id) ?? base;
      const depActual = actual.get(id) ?? depPlanned;
      const earliest = depActual + (base - depPlanned);
      if (earliest > due) {
        due = earliest;
        pushedBy.push(result.get(id)?.title ?? id);
      }
    }
    planned.set(template.id, base);
    actual.set(template.id, due);
    const dueIso = addDays(plan.eventDate, due);
    result.set(template.id, {
      id: template.id,
      title: template.title,
      category: template.category,
      dependsOn: template.dependsOn,
      plannedDue: addDays(plan.eventDate, base),
      due: dueIso,
      pushedDays: due - base,
      pushedBy,
      status: statusOf(dueIso, progress, today, plan.eventDate),
    });
  }
  const tasks = templates
    .map((template) => result.get(template.id))
    .filter((task) => task !== undefined);
  tasks.sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title));
  return { tasks, daysToGo, compressed };
}

/** Marks a task done or not done. */
export function setTaskDone(plan: Plan, id: string, done: boolean): Plan {
  const current = plan.tasks[id] ?? { done: false, delayDays: 0 };
  return { ...plan, tasks: { ...plan.tasks, [id]: { ...current, done } } };
}

/** Records that a task will slip by `delayDays`. */
export function setTaskDelay(plan: Plan, id: string, delayDays: number): Plan {
  const current = plan.tasks[id] ?? { done: false, delayDays: 0 };
  const days = Math.min(365, Math.max(0, Math.round(delayDays)));
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
