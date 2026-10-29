import type { Ref } from 'react';
import type { IntakeQuestion } from '../../engine/intake';
import type { IntakeField } from '../../lib/intakeForm';

/** The questions Tayyari still needs answered, plus the AI's one personal follow-up. */
export function IntakeQuestions({
  questions,
  followUp,
}: {
  questions: IntakeQuestion[];
  followUp: string | null;
}) {
  if (questions.length === 0 && !followUp) return null;
  return (
    <div className="questions">
      <h2>{questions.length > 0 ? 'Just a few questions' : 'One more thing'}</h2>
      <ul>
        {questions.map((item) => (
          <li key={item.field}>{item.question}</li>
        ))}
        {followUp ? <li>{followUp}</li> : null}
      </ul>
    </div>
  );
}

/** A focusable summary of every invalid field, each linking to the field itself. */
export function ErrorSummary({
  fields,
  errors,
  ref,
}: {
  fields: IntakeField[];
  errors: Partial<Record<IntakeField, string>>;
  ref: Ref<HTMLDivElement>;
}) {
  if (fields.length === 0) return null;
  return (
    <div
      className="error-summary"
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
    >
      <h2 id="error-summary-title">Please fix {fields.length === 1 ? 'this' : 'these'}</h2>
      <ul>
        {fields.map((field) => (
          <li key={field}>
            <a href={`#intake-${field}`}>{errors[field]}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
