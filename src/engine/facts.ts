import type { Plan } from '../schemas/plan';
import { lineAmount, overBy, shortfalls } from './budget';
import { categoryLabel, OCCASION_LABEL } from './data/categories';
import { formatDate } from './dates';
import { formatINR } from './money';
import type { Schedule } from './timeline';

/** The only facts the AI is allowed to use when it talks about a plan. */
export interface PlanFacts {
  occasion: string;
  eventDate: string;
  daysToGo: number;
  guests: number;
  budget: string;
  overBudgetBy: string;
  buffer: string;
  lines: string[];
  nextTasks: string[];
  problems: string[];
  guestNotes: string[];
}

/** Turns a plan into short, human-formatted facts for grounding AI replies. */
export function planFacts(plan: Plan, schedule: Schedule): PlanFacts {
  const open = schedule.tasks.filter((task) => task.status !== 'done');
  const notes = [
    plan.guestMix.kids ? 'children attending' : '',
    plan.guestMix.elders ? 'elders attending' : '',
    plan.guestMix.accessibility ? 'accessibility needs' : '',
    ...plan.dietary,
    ...plan.mustHaves.map((item) => `must have: ${item}`),
  ].filter(Boolean);
  return {
    occasion: OCCASION_LABEL[plan.occasion],
    eventDate: formatDate(plan.eventDate),
    daysToGo: schedule.daysToGo,
    guests: plan.guests,
    budget: formatINR(plan.budget),
    overBudgetBy: formatINR(overBy(plan)),
    buffer: formatINR(lineAmount(plan.lines, 'contingency')),
    lines: plan.lines.map(
      (line) => `${categoryLabel(line.category, plan.occasion)}: ${formatINR(line.amount)}`,
    ),
    nextTasks: open
      .slice(0, 5)
      .map((task) => `${task.title} (by ${formatDate(task.due)}, ${task.status})`),
    problems: [
      ...shortfalls(plan).map(
        (item) =>
          `${categoryLabel(item.category, plan.occasion)} needs ${formatINR(item.gap)} more`,
      ),
      ...open
        .filter((task) => task.status === 'overdue' || task.status === 'impossible')
        .map((task) => `${task.title} is ${task.status}`),
    ].slice(0, 25),
    guestNotes: notes,
  };
}

const ASKS: [RegExp, (facts: PlanFacts) => string][] = [
  [
    /over|budget|kharcha|paisa|money|afford|left|bacha|remaining/,
    (facts) =>
      facts.overBudgetBy === formatINR(0)
        ? `You are within your ${facts.budget} budget, with ${facts.buffer} kept aside for surprises.`
        : `You are over budget by ${facts.overBudgetBy}. Open Budget to pick one of the options to close the gap.`,
  ],
  [
    /next|first|todo|to do|pehle|start|priority/,
    (facts) =>
      facts.nextTasks[0]
        ? `Next up: ${facts.nextTasks.slice(0, 3).join('; ')}.`
        : 'Every task is done. Enjoy the celebration!',
  ],
  [
    /when|days|kab|date|how long/,
    (facts) =>
      `The ${facts.occasion.toLowerCase()} is on ${facts.eventDate}, ${facts.daysToGo} days from today.`,
  ],
  [
    /guest|people|log|headcount/,
    (facts) =>
      `You are planning for ${facts.guests} guests${facts.guestNotes.length ? ` (${facts.guestNotes.join(', ')})` : ''}.`,
  ],
];

/**
 * Answers common questions from the plan's facts when AI is unavailable.
 * Always grounded; never invents numbers.
 */
export function localAnswer(question: string, facts: PlanFacts): string {
  const lower = question.toLowerCase();
  const match = ASKS.find(([pattern]) => pattern.test(lower));
  if (match) return match[1](facts);
  const problems = facts.problems.length
    ? ` Needs attention: ${facts.problems.slice(0, 2).join('; ')}.`
    : '';
  return `${facts.occasion} on ${facts.eventDate} for ${facts.guests} guests, budget ${facts.budget}.${problems}`;
}
