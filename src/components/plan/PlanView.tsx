import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { overBy } from '../../engine/budget';
import { OCCASION_LABEL } from '../../engine/data/categories';
import { formatDate, relativeDays } from '../../engine/dates';
import type { Tab } from '../../engine/insights';
import { formatShortINR } from '../../engine/money';
import { readiness } from '../../engine/timeline';
import { useActivePlan, usePlanStore } from '../../state/PlanContext';
import { Working } from '../common';
import { BudgetTab } from './BudgetTab';
import { Overview } from './Overview';
import { TimelineTab } from './TimelineTab';

const VendorsTab = lazy(() => import('./VendorsTab'));
const IdeasTab = lazy(() => import('./IdeasTab'));
const ChangeDesk = lazy(() => import('./ChangeDesk'));

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'changes', label: 'Change desk' },
  { id: 'budget', label: 'Budget' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'ideas', label: 'Ideas' },
];

/** The plan: a summary strip and six tabs that all read the same plan object. */
export function PlanView() {
  const { plan, schedule } = useActivePlan();
  const { state, dispatch } = usePlanStore();
  const [tab, setTab] = useState<Tab>('overview');
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    title.current?.focus();
  }, []);
  const short = overBy(plan);
  const ready = readiness(schedule);

  function goTo(next: Tab, focus = false) {
    setTab(next);
    if (focus) tabRefs.current.get(next)?.focus();
  }

  function onKey(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.findIndex((item) => item.id === tab);
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: TABS.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = TABS[(target + TABS.length) % TABS.length];
    if (next) goTo(next.id, true);
  }

  return (
    <div className="plan">
      <header className="plan-head">
        <div>
          <p className="eyebrow">{OCCASION_LABEL[plan.occasion]}</p>
          <h1 id="plan-title" ref={title} tabIndex={-1}>
            {plan.title}
          </h1>
          <dl className="facts">
            <div>
              <dt>Date</dt>
              <dd>
                {formatDate(plan.eventDate)} ({relativeDays(schedule.daysToGo)})
              </dd>
            </div>
            <div>
              <dt>Budget</dt>
              <dd>{formatShortINR(plan.budget)}</dd>
            </div>
            <div>
              <dt>Guests</dt>
              <dd>{plan.guests}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className={short > 0 ? 'text-danger' : 'text-ok'}>
                {short > 0 ? `✕ Over by ${formatShortINR(short)}` : '✓ Within budget'}
              </dd>
            </div>
          </dl>
          <div className="readiness">
            <label htmlFor="readiness">Plan readiness: {ready}% of tasks done</label>
            <progress id="readiness" max={100} value={ready} />
          </div>
        </div>
        <div className="plan-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={state.history.length === 0}
            onClick={() => {
              dispatch({ type: 'undo' });
            }}
          >
            Undo last change
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              window.print();
            }}
          >
            Print summary
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (window.confirm('Start a new plan? This plan will be removed from this browser.'))
                dispatch({ type: 'reset' });
            }}
          >
            New plan
          </button>
        </div>
      </header>

      <div className="tablist" role="tablist" aria-label="Plan sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            ref={(node) => {
              if (node) tabRefs.current.set(item.id, node);
            }}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onKeyDown={onKey}
            onClick={() => {
              goTo(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <section
        className="panel"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        <Suspense fallback={<Working label="Loading…" />}>
          {tab === 'overview' ? <Overview goTo={goTo} /> : null}
          {tab === 'changes' ? <ChangeDesk goTo={goTo} /> : null}
          {tab === 'budget' ? <BudgetTab /> : null}
          {tab === 'timeline' ? <TimelineTab /> : null}
          {tab === 'vendors' ? <VendorsTab /> : null}
          {tab === 'ideas' ? <IdeasTab /> : null}
        </Suspense>
      </section>
    </div>
  );
}
