import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { TASK_TEMPLATES, RUN_SHEET, type TaskTemplate } from '../../src/engine/data/tasks';
import { addDays } from '../../src/engine/dates';
import {
  buildSchedule,
  readiness,
  setTaskDelay,
  setTaskDone,
  statusCounts,
  topoSort,
} from '../../src/engine/timeline';
import { OCCASIONS } from '../../src/schemas/plan';
import { TODAY, weddingPlan } from '../helpers';

const task = (id: string, leadDays: number, dependsOn: string[] = []): TaskTemplate => ({
  id,
  title: id,
  leadDays,
  dependsOn,
  category: null,
});

describe('task templates', () => {
  it.each(OCCASIONS)(
    '%s: dependencies always have a longer lead time and no cycles',
    (occasion) => {
      const templates = TASK_TEMPLATES[occasion];
      const byId = new Map(templates.map((item) => [item.id, item]));
      expect(topoSort(templates)).toHaveLength(templates.length);
      for (const item of templates) {
        for (const dep of item.dependsOn)
          expect(byId.get(dep)?.leadDays).toBeGreaterThan(item.leadDays);
      }
      expect(RUN_SHEET[occasion].length).toBeGreaterThan(3);
    },
  );

  it('detects cycles and unknown dependencies', () => {
    expect(() => topoSort([task('a', 5, ['b']), task('b', 3, ['a'])])).toThrow(/cycle/);
    expect(() => topoSort([task('a', 5, ['ghost'])])).toThrow(/Unknown dependency/);
  });
});

describe('buildSchedule', () => {
  it('schedules a wedding four months out without compression', () => {
    const plan = { ...weddingPlan(), eventDate: addDays(TODAY, 200) };
    const schedule = buildSchedule(plan, TODAY);
    expect(schedule.compressed).toBe(false);
    expect(schedule.daysToGo).toBe(200);
    const venue = schedule.tasks.find((item) => item.id === 'venue');
    expect(venue?.due).toBe(addDays(plan.eventDate, -160));
    expect(venue?.status).toBe('on-track');
    expect(schedule.tasks.map((item) => item.due)).toEqual(
      [...schedule.tasks.map((item) => item.due)].sort(),
    );
  });

  it('compresses a close event so it starts today and keeps its order', () => {
    const plan = weddingPlan();
    const schedule = buildSchedule(plan, TODAY);
    expect(schedule.compressed).toBe(true);
    expect(schedule.tasks[0]?.due).toBe(TODAY);
    expect(statusCounts(schedule).overdue).toBe(0);
    expect(statusCounts(schedule).impossible).toBe(0);
  });

  it('a compressed plan is never overdue, impossible or out of order (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...OCCASIONS),
        fc.integer({ min: 0, max: 400 }),
        (occasion, runway) => {
          const plan = { occasion, eventDate: addDays(TODAY, runway), tasks: {}, createdOn: TODAY };
          const schedule = buildSchedule(plan, TODAY);
          const due = new Map(schedule.tasks.map((item) => [item.id, item.due]));
          return schedule.tasks.every(
            (item) =>
              item.status !== 'overdue' &&
              item.status !== 'impossible' &&
              item.dependsOn.every((dep) => (due.get(dep) ?? '') <= item.due),
          );
        },
      ),
    );
  });

  it('pushes a dependent task only as far as the delayed task it waits for', () => {
    const base = { ...weddingPlan(), eventDate: addDays(TODAY, 200) };
    const delayed = setTaskDelay(base, 'venue', 50);
    const schedule = buildSchedule(delayed, TODAY);
    const find = (id: string) => schedule.tasks.find((item) => item.id === id);
    expect(find('venue')?.pushedDays).toBe(50);
    expect(find('venue')?.due).toBe(addDays(base.eventDate, -110));
    expect(find('caterer')?.pushedBy).toEqual(['Book the venue']);
    expect(find('caterer')?.due).toBe(addDays(base.eventDate, -110));
    expect(find('caterer')?.pushedDays).toBe(10);
    expect(find('decor')?.pushedDays).toBe(0);
    expect(find('photo')?.pushedDays).toBe(0);
  });

  it('a short slip early on never drags the last tasks past the event', () => {
    const base = { ...weddingPlan(), eventDate: addDays(TODAY, 94) };
    const schedule = buildSchedule(setTaskDelay(base, 'venue', 10), TODAY);
    expect(statusCounts(schedule).impossible).toBe(0);
    expect(schedule.tasks.find((item) => item.id === 'payments')?.pushedDays).toBe(0);
  });

  it('marks tasks that land after the event as impossible', () => {
    const plan = setTaskDelay({ ...weddingPlan(), eventDate: addDays(TODAY, 30) }, 'date', 60);
    const schedule = buildSchedule(plan, TODAY);
    expect(statusCounts(schedule).impossible).toBeGreaterThan(0);
  });

  it('flags overdue and soon tasks, and done tasks stay done', () => {
    const plan = {
      ...weddingPlan(),
      createdOn: addDays(TODAY, -30),
      eventDate: addDays(TODAY, 170),
    };
    const schedule = buildSchedule(plan, TODAY);
    expect(schedule.compressed).toBe(false);
    expect(schedule.tasks.find((item) => item.id === 'date')?.status).toBe('overdue');
    expect(schedule.tasks.find((item) => item.id === 'venue')?.status).toBe('on-track');
    const soon = buildSchedule({ ...plan, eventDate: addDays(TODAY, 163) }, TODAY);
    expect(soon.tasks.find((item) => item.id === 'venue')?.status).toBe('soon');
    const done = buildSchedule(setTaskDone(plan, 'date', true), TODAY);
    expect(done.tasks.find((item) => item.id === 'date')?.status).toBe('done');
  });

  it('becomes overdue as days pass on a compressed plan', () => {
    const schedule = buildSchedule(weddingPlan(), addDays(TODAY, 20));
    expect(schedule.tasks[0]?.status).toBe('overdue');
  });

  it('a past event puts everything on the event day', () => {
    const schedule = buildSchedule({ ...weddingPlan(), eventDate: addDays(TODAY, -2) }, TODAY);
    expect(schedule.tasks.every((item) => item.due === addDays(TODAY, -2))).toBe(true);
  });
});

describe('task progress', () => {
  it('clamps delays and tracks readiness', () => {
    let plan = weddingPlan();
    plan = setTaskDelay(plan, 'venue', 999);
    expect(plan.tasks.venue?.delayDays).toBe(365);
    plan = setTaskDelay(plan, 'venue', -4);
    expect(plan.tasks.venue?.delayDays).toBe(0);
    plan = setTaskDone(plan, 'venue', true);
    plan = setTaskDone(plan, 'date', true);
    const schedule = buildSchedule(plan, TODAY);
    expect(readiness(schedule)).toBe(Math.round((2 / schedule.tasks.length) * 100));
    expect(readiness({ tasks: [], daysToGo: 0, compressed: false })).toBe(0);
  });
});
