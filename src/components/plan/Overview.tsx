import { useMemo } from 'react';
import { planInsights, type Tab } from '../../engine/insights';
import { useActivePlan } from '../../state/PlanContext';
import { Badge } from '../common';
import { AskPanel } from './AskPanel';

const TONE = { urgent: 'danger', attention: 'warn', tip: 'info' } as const;
const LEVEL = { urgent: 'Urgent', attention: 'Needs attention', tip: 'Suggestion' } as const;
const TAB_NAME: Record<Tab, string> = {
  overview: 'Overview',
  budget: 'Budget',
  timeline: 'Timeline',
  vendors: 'Vendors',
  ideas: 'Ideas',
  changes: 'Change desk',
};

/** What needs the family now, ranked across budget, timeline and vendors, plus the assistant. */
export function Overview({ goTo }: { goTo: (tab: Tab) => void }) {
  const { plan, schedule } = useActivePlan();
  const insights = useMemo(() => planInsights(plan, schedule), [plan, schedule]);
  return (
    <div className="overview">
      <section aria-labelledby="attention-title">
        <h2 id="attention-title">What needs you now</h2>
        <ul className="insights">
          {insights.map((item) => (
            <li key={item.text} className={`insight insight-${item.level}`}>
              <Badge tone={TONE[item.level]}>{LEVEL[item.level]}</Badge>
              <span>{item.text}</span>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  goTo(item.tab);
                }}
              >
                Open {TAB_NAME[item.tab]}
              </button>
            </li>
          ))}
        </ul>
        <p className="hint">
          This list is worked out from your plan by Tayyari itself, so it is instant and works
          without AI.
        </p>
      </section>
      <AskPanel />
    </div>
  );
}
