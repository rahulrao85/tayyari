import { useState, type SubmitEvent } from 'react';
import { overBy } from '../../engine/budget';
import { applyChangeSet, diffPlans, isEmptyDiff } from '../../engine/changes';
import type { Tab } from '../../engine/insights';
import { isEmptyChange, parseChangeText } from '../../engine/parseChange';
import type { TradeoffOption } from '../../engine/tradeoffs';
import { modelLabel } from '../../lib/api';
import { useAi } from '../../lib/useAi';
import { ChangeExtractSchema } from '../../schemas/api';
import type { Plan } from '../../schemas/plan';
import { useActivePlan, usePlanStore } from '../../state/PlanContext';
import { Working } from '../common';
import { DiffView } from './DiffView';
import { TradeoffPanel } from './TradeoffPanel';

const EXAMPLES = [
  'Budget is ₹50k less and the event is 2 weeks earlier',
  '60 more guests are coming',
  'Postpone it by 10 days and raise the budget by 1 lakh',
];

interface Preview {
  plan: Plan;
  notes: string[];
  understood: string;
  source: string;
}

/** Say what changed in plain words; see exactly what moves; accept or discard. Nothing restarts. */
export default function ChangeDesk({ goTo }: { goTo: (tab: Tab) => void }) {
  const { plan, today, update } = useActivePlan();
  const { state, dispatch } = usePlanStore();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [problem, setProblem] = useState('');
  const change = useAi('/api/change', ChangeExtractSchema);

  async function read(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem('');
    setPreview(null);
    const current = { budget: plan.budget, guests: plan.guests, eventDate: plan.eventDate };
    const result = await change.run({ text, today, current });
    if (!result.ok && result.code === 'CANCELLED') return;
    const fromAi = result.ok && !isEmptyChange(result.data) ? result : null;
    const changes = fromAi ? fromAi.data : parseChangeText(text, today);
    if (isEmptyChange(changes)) {
      setProblem(
        'I could not find a change of budget, guests, date or priorities in that. Try one of the examples.',
      );
      return;
    }
    const applied = applyChangeSet(plan, changes);
    if (applied.blocked) {
      setProblem(applied.blocked);
      return;
    }
    setPreview({
      plan: applied.plan,
      notes: applied.applied,
      understood: fromAi ? fromAi.data.summary : `Read as: ${applied.applied.join(', ')}.`,
      source: fromAi ? `Understood by ${modelLabel(fromAi.model)}` : 'Read by the built-in parser',
    });
  }

  function adjust(option: TradeoffOption) {
    if (preview)
      setPreview({ ...preview, plan: option.result, notes: [...preview.notes, option.title] });
  }

  function accept() {
    if (!preview) return;
    update(preview.plan, `Change: ${preview.notes.join(', ')}.`);
    setPreview(null);
    setText('');
  }

  const diff = preview ? diffPlans(plan, preview.plan, today) : null;
  return (
    <div className="change-desk">
      <h2>Change desk</h2>
      <p className="lede">
        Plans change. Say what changed in your own words and Tayyari revises this plan instead of
        starting over. You see every rupee and date that moves before anything is saved.
      </p>
      <form className="card" onSubmit={(event) => void read(event)}>
        <label htmlFor="change-text">What changed?</label>
        <textarea
          id="change-text"
          rows={2}
          maxLength={500}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        <div className="examples" role="group" aria-label="Example changes">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="chip"
              onClick={() => {
                setText(example);
              }}
            >
              {example}
            </button>
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={!text.trim() || change.loading}>
          Preview the change
        </button>
        {change.loading ? <Working label="Gemini is reading your change…" /> : null}
        {problem ? (
          <p className="error-text" role="alert">
            {problem}
          </p>
        ) : null}
      </form>

      {preview && diff ? (
        <section className="card preview" aria-labelledby="preview-title" aria-live="polite">
          <h3 id="preview-title">Preview: nothing is saved yet</h3>
          <p>{preview.understood}</p>
          <p className="source-note">{preview.source}</p>
          {isEmptyDiff(diff) ? (
            <p>This change does not move anything in your plan.</p>
          ) : (
            <DiffView diff={diff} occasion={plan.occasion} />
          )}
          {overBy(preview.plan) > 0 ? <TradeoffPanel plan={preview.plan} onApply={adjust} /> : null}
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={accept}>
              Accept this version
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setPreview(null);
              }}
            >
              Discard
            </button>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="history-title">
        <h3 id="history-title">Versions</h3>
        {state.history.length === 0 ? (
          <p className="hint">
            No changes yet. Every change you accept is kept here, and you can undo it.
          </p>
        ) : (
          <>
            <ol className="versions" reversed>
              {[...state.history].reverse().map((version, index) => (
                <li key={`${String(index)}-${version.note}`}>{version.note}</li>
              ))}
            </ol>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                dispatch({ type: 'undo' });
              }}
            >
              Undo last change
            </button>
          </>
        )}
        <button
          type="button"
          className="link-button"
          onClick={() => {
            goTo('timeline');
          }}
        >
          See the full timeline
        </button>
      </section>
    </div>
  );
}
