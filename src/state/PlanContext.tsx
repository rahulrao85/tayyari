import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { buildSchedule, type Schedule } from '../engine/timeline';
import type { Plan } from '../schemas/plan';
import {
  browserStorage,
  loadState,
  planReducer,
  saveState,
  type PlanAction,
  type PlanState,
} from './store';

interface PlanContextValue {
  state: PlanState;
  dispatch: Dispatch<PlanAction>;
  today: string;
}

const PlanContext = createContext<PlanContextValue | null>(null);

/** Holds the plan, autosaves it in this browser, and shares `today` so every view agrees. */
export function PlanProvider({
  today,
  children,
  initial,
}: {
  today: string;
  children: ReactNode;
  initial?: PlanState;
}) {
  const [state, dispatch] = useReducer(
    planReducer,
    initial ?? null,
    (seed) => seed ?? loadState(browserStorage()),
  );
  useEffect(() => {
    saveState(browserStorage(), state);
  }, [state]);
  const value = useMemo(() => ({ state, dispatch, today }), [state, today]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

/** Access to the plan store. */
export function usePlanStore(): PlanContextValue {
  const value = useContext(PlanContext);
  if (!value) throw new Error('usePlanStore must be used inside PlanProvider');
  return value;
}

/** The current plan with its schedule. Only for views shown once a plan exists. */
export function useActivePlan(): {
  plan: Plan;
  schedule: Schedule;
  today: string;
  update: (plan: Plan, note: string) => void;
} {
  const { state, dispatch, today } = usePlanStore();
  const plan = state.plan;
  const schedule = useMemo(() => (plan ? buildSchedule(plan, today) : null), [plan, today]);
  if (!plan || !schedule) throw new Error('No active plan');
  return {
    plan,
    schedule,
    today,
    update: (next, note) => {
      dispatch({ type: 'update', plan: next, note });
    },
  };
}
