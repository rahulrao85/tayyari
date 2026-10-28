import type { Intake, Plan } from '../schemas/plan';
import { allocate, lineAmount } from './budget';

/** Builds a fresh plan from what the family told us. */
export function createPlan(intake: Intake, today: string): Plan {
  const lines = allocate(intake.budget, intake.occasion, intake.priorities);
  return {
    ...intake,
    createdOn: today,
    perGuest: Math.floor(lineAmount(lines, 'catering') / intake.guests),
    lines,
    tasks: {},
    quotes: [],
  };
}

/** One saved state of the plan, with a note of what changed. */
export interface PlanVersion {
  plan: Plan;
  note: string;
}

/** Keeps at most this many versions so storage stays small. */
export const MAX_VERSIONS = 20;

/** Adds a version to the history, newest last. */
export function pushVersion(
  history: readonly PlanVersion[],
  plan: Plan,
  note: string,
): PlanVersion[] {
  return [...history, { plan, note }].slice(-MAX_VERSIONS);
}
