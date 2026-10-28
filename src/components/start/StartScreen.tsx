import { useState, type SubmitEvent } from 'react';
import {
  EMPTY_DRAFT,
  mergeDrafts,
  missingQuestions,
  parseIntakeText,
  withoutNulls,
  type IntakeDraft,
} from '../../engine/intake';
import { useAi } from '../../lib/useAi';
import { IntakeExtractSchema } from '../../schemas/api';
import { usePlanStore } from '../../state/PlanContext';
import { SourceNote, Working } from '../common';
import { IntakeForm } from './IntakeForm';

const EXAMPLES = [
  {
    label: 'Wedding',
    text: 'Shaadi in Pune for 200 guests, 8 lakh budget, mid-Feb. Simple ceremony but premium food. Grandparents are coming and most guests are pure veg.',
  },
  {
    label: "Kid's birthday",
    text: "My daughter's 6th birthday, 30 kids plus parents, budget 40k, in 3 weeks. Jungle theme, games matter most.",
  },
  {
    label: 'Community puja',
    text: 'Society Ganpati festival for 500 people, 3 lakh from contributions, on 14 September 2027. Bhandara food is the priority, wheelchair access needed.',
  },
];

/** First screen: describe the celebration in your own words; we ask only for what is missing. */
export function StartScreen() {
  const { today } = usePlanStore();
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<IntakeDraft | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const intake = useAi('/api/intake', IntakeExtractSchema);

  async function read(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const rules = parseIntakeText(text, today);
    const result = await intake.run({ text, today });
    if (result.ok) {
      const { followUp: question, ...fields } = result.data;
      setFollowUp(question);
      setDraft(mergeDrafts(rules, withoutNulls(fields)));
    } else {
      setFollowUp(null);
      setDraft(rules);
    }
  }

  if (draft) {
    return (
      <section className="start" aria-labelledby="review-title">
        <h1 id="review-title">A few details before we plan</h1>
        {intake.result ? <SourceNote result={intake.result} fallback={!intake.result.ok} /> : null}
        <IntakeForm
          draft={draft}
          questions={missingQuestions(draft)}
          followUp={followUp}
          onBack={() => {
            setDraft(null);
          }}
        />
      </section>
    );
  }

  return (
    <section className="start" aria-labelledby="start-title">
      <p className="eyebrow">Weddings · birthdays · community events</p>
      <h1 id="start-title">
        Plan the celebration. <span className="mark">Revise it</span> when life happens.
      </h1>
      <p className="lede">
        Tell Tayyari about your event in your own words. It splits your budget, builds a
        dependency-aware timeline, tracks vendor quotes and, when the budget or date changes, shows
        exactly what moves before you accept it.
      </p>
      <form className="card describe" onSubmit={(event) => void read(event)}>
        <label htmlFor="describe">Describe your celebration</label>
        <p className="hint" id="describe-hint">
          Occasion, budget, number of guests, date, and what matters most. Hindi or Hinglish is
          fine.
        </p>
        <textarea
          id="describe"
          aria-describedby="describe-hint"
          rows={4}
          maxLength={1000}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        <div className="examples" role="group" aria-label="Try an example">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              className="chip"
              onClick={() => {
                setText(example.text);
              }}
            >
              Try: {example.label}
            </button>
          ))}
        </div>
        <div className="actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={text.trim().length === 0 || intake.loading}
          >
            Read my description
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
            }}
          >
            Fill the form instead
          </button>
        </div>
        {intake.loading ? <Working label="Gemini is reading your description…" /> : null}
      </form>
    </section>
  );
}
