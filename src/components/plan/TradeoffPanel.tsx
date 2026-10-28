import { useMemo } from 'react';
import { overBy, shortfalls } from '../../engine/budget';
import { categoryLabel } from '../../engine/data/categories';
import { planFacts } from '../../engine/facts';
import { formatINR } from '../../engine/money';
import { buildSchedule } from '../../engine/timeline';
import { overBudgetOptions, type TradeoffOption } from '../../engine/tradeoffs';
import { useAi } from '../../lib/useAi';
import { ExplanationSchema } from '../../schemas/api';
import type { Plan } from '../../schemas/plan';
import { useActivePlan } from '../../state/PlanContext';
import { SourceNote, Working } from '../common';

/** "Decor −₹20,000", "Guests −40", "Budget +₹95,696". */
export function effectText(option: TradeoffOption, plan: Plan): string[] {
  return option.effects.map(({ target, delta }) => {
    const sign = delta < 0 ? '−' : '+';
    if (target === 'guests') return `Guests ${sign}${Math.abs(delta)}`;
    if (target === 'budget') return `Total budget ${sign}${formatINR(Math.abs(delta))}`;
    return `${categoryLabel(target, plan.occasion)} ${sign}${formatINR(Math.abs(delta))}`;
  });
}

/** Ways to close the gap, each with its exact effect. The family chooses; nothing is cut automatically. */
export function TradeoffPanel({
  plan: given,
  onApply,
}: {
  plan?: Plan;
  onApply?: (option: TradeoffOption) => void;
}) {
  const active = useActivePlan();
  const plan = given ?? active.plan;
  const options = useMemo(() => overBudgetOptions(plan), [plan]);
  const explain = useAi('/api/explain', ExplanationSchema);
  const gaps = shortfalls(plan);

  function apply(option: TradeoffOption) {
    if (onApply) onApply(option);
    else active.update(option.result, `Applied: ${option.title}.`);
  }

  function requestExplanation() {
    void explain.run({
      facts: planFacts(plan, buildSchedule(plan, active.today)),
      changes: gaps.map(
        (gap) => `${categoryLabel(gap.category, plan.occasion)} needs ${formatINR(gap.gap)} more`,
      ),
      options: options.map((option) => ({
        id: option.id,
        title: option.title,
        effect: effectText(option, plan).join('; ').slice(0, 240),
      })),
    });
  }

  const readings = explain.result?.ok ? explain.result.data : null;
  return (
    <section className="tradeoffs" aria-labelledby="tradeoff-title">
      <h3 id="tradeoff-title">
        <span aria-hidden="true">✕ </span>Over budget by {formatINR(overBy(plan))}
      </h3>
      <ul className="gaps">
        {gaps.map((gap) => (
          <li key={gap.category}>
            {categoryLabel(gap.category, plan.occasion)} needs {formatINR(gap.need)} but has{' '}
            {formatINR(gap.allocated)}
            {gap.reason === 'guests'
              ? ` (${formatINR(plan.perGuest)} per guest × ${String(plan.guests)} guests)`
              : ' (accepted quote)'}
            .
          </li>
        ))}
      </ul>
      <p>Pick what suits your family. Tayyari will not cut anything on its own.</p>
      <ol className="options">
        {options.map((option) => (
          <li key={option.id} className="option card">
            <h4>{option.title}</h4>
            <ul>
              {effectText(option, plan).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="hint">{option.note}</p>
            {readings?.options.find((item) => item.id === option.id) ? (
              <p className="reading">
                {readings.options.find((item) => item.id === option.id)?.reading}
              </p>
            ) : null}
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => {
                apply(option);
              }}
            >
              Apply this option
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={requestExplanation}
        disabled={explain.loading}
      >
        Explain these options in plain words
      </button>
      {explain.loading ? <Working label="Gemini is reading the options…" /> : null}
      {readings ? <p className="reading">{readings.summary}</p> : null}
      {explain.result ? <SourceNote result={explain.result} fallback={!explain.result.ok} /> : null}
      {explain.result && !explain.result.ok ? (
        <p className="hint">
          The options above are exact either way; only the plain-words reading needs AI.
        </p>
      ) : null}
    </section>
  );
}
