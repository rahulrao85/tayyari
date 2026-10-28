import { useState } from 'react';
import { isQuoted, overBy, setLineAmount, toggleLock } from '../../engine/budget';
import { categoryLabel } from '../../engine/data/categories';
import { formatINR, parseINR } from '../../engine/money';
import type { BudgetLine, Category } from '../../schemas/plan';
import { useActivePlan } from '../../state/PlanContext';
import { Badge } from '../common';
import { TradeoffPanel } from './TradeoffPanel';

/** One editable amount that commits on blur or Enter, so typing never thrashes the plan. */
function AmountInput({
  line,
  label,
  onCommit,
}: {
  line: BudgetLine;
  label: string;
  onCommit: (amount: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const amount = parseINR(draft);
    setDraft(null);
    if (amount !== null && amount !== line.amount) onCommit(amount);
  };
  return (
    <input
      className="amount"
      aria-label={`${label} amount in rupees`}
      inputMode="numeric"
      disabled={line.locked}
      value={draft ?? String(line.amount)}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
      }}
    />
  );
}

/** The budget: exact split, editable amounts, locks, and options when the plan is over budget. */
export function BudgetTab() {
  const { plan, update } = useActivePlan();
  const [message, setMessage] = useState('');
  const short = overBy(plan);
  const label = (category: Category) => categoryLabel(category, plan.occasion);

  function change(category: Category, amount: number) {
    const result = setLineAmount(plan.lines, category, amount);
    if (!result.lines) {
      setMessage(
        `Unlock another category first: there is nothing left to take ${formatINR(amount)} from.`,
      );
      return;
    }
    const note = `${label(category)} set to ${formatINR(result.applied)}; unlocked categories adjusted.`;
    setMessage(
      result.applied === amount ? note : `${note} (capped at what the other categories can give)`,
    );
    update({ ...plan, lines: result.lines }, note);
  }

  return (
    <div className="budget">
      <h2>Budget</h2>
      <p className="lede">
        {formatINR(plan.budget)} split across {plan.lines.length} categories. Change any amount and
        Tayyari moves the difference to unlocked categories. Your total never changes unless you
        change it.
      </p>
      {short > 0 ? <TradeoffPanel /> : null}
      <p className="sr-only" role="status">
        {message}
      </p>
      {message ? <p className="notice">{message}</p> : null}
      <table className="lines responsive">
        <caption className="sr-only">Budget by category</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
            <th scope="col">Basis</th>
            <th scope="col">Lock</th>
          </tr>
        </thead>
        <tbody>
          {plan.lines.map((line) => (
            <tr key={line.category}>
              <th scope="row" data-label="Category">
                {label(line.category)}
                {line.category === 'catering' ? (
                  <span className="sub">
                    ≈ {formatINR(plan.perGuest)} per guest × {plan.guests}
                  </span>
                ) : null}
              </th>
              <td data-label="Amount">
                <AmountInput
                  line={line}
                  label={label(line.category)}
                  onCommit={(amount) => {
                    change(line.category, amount);
                  }}
                />
                <span className="sub">
                  {Math.round((line.amount / plan.budget) * 100)}% of budget
                </span>
              </td>
              <td data-label="Basis">
                {isQuoted(plan, line.category) ? (
                  <Badge tone="ok">Quoted</Badge>
                ) : (
                  <Badge tone="muted">Estimate</Badge>
                )}
              </td>
              <td data-label="Lock">
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  aria-label={`Lock ${label(line.category)}`}
                  aria-pressed={line.locked}
                  onClick={() => {
                    update(
                      { ...plan, lines: toggleLock(plan.lines, line.category) },
                      `${label(line.category)} ${line.locked ? 'unlocked' : 'locked'}.`,
                    );
                  }}
                >
                  {line.locked ? '🔒 Locked' : 'Lock'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        <strong>Estimate</strong> means a planning split, not a price anyone has confirmed. A line
        becomes <strong>Quoted</strong> when you accept a vendor quote in Vendors.
      </p>
    </div>
  );
}
