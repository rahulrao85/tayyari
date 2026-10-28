import * as z from 'zod/mini';
import { pushVersion, type PlanVersion } from '../engine/plan';
import { list, PlanSchema, str, type Plan } from '../schemas/plan';

/** Everything the app remembers: the current plan and the versions before it. */
export interface PlanState {
  plan: Plan | null;
  history: PlanVersion[];
  /** Short note about the last change, announced to screen readers. */
  notice: string;
}

export type PlanAction =
  | { type: 'create'; plan: Plan }
  | { type: 'update'; plan: Plan; note: string }
  | { type: 'undo' }
  | { type: 'reset' };

export const INITIAL_STATE: PlanState = { plan: null, history: [], notice: '' };

/** Every change keeps the previous version, so nothing is ever lost and undo always works. */
export function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case 'create':
      return { plan: action.plan, history: [], notice: 'Plan created.' };
    case 'update':
      if (!state.plan) return state;
      return {
        plan: action.plan,
        history: pushVersion(state.history, state.plan, action.note),
        notice: action.note,
      };
    case 'undo': {
      const last = state.history.at(-1);
      if (!last) return state;
      return {
        plan: last.plan,
        history: state.history.slice(0, -1),
        notice: `Undid: ${last.note}`,
      };
    }
    case 'reset':
      return INITIAL_STATE;
  }
}

const STORAGE_KEY = 'tayyari-plan-v1';
const SavedSchema = z.object({
  plan: PlanSchema,
  history: list(z.object({ plan: PlanSchema, note: str(0, 200) }), 50),
});

/** Loads a saved plan, ignoring anything missing, corrupt or tampered with. */
export function loadState(storage: Pick<Storage, 'getItem'> | null): PlanState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = SavedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { ...parsed.data, notice: '' } : INITIAL_STATE;
  } catch {
    return INITIAL_STATE;
  }
}

/** Saves the plan in this browser only. Fails quietly when storage is blocked or full. */
export function saveState(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
  state: PlanState,
): void {
  try {
    if (!storage) return;
    if (!state.plan) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify({ plan: state.plan, history: state.history }));
  } catch {
    /* storage unavailable: the plan still works for this visit */
  }
}

/** The browser's localStorage, or null where it is blocked. */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
