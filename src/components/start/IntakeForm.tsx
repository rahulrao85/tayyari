import { useRef, useState, type SubmitEvent } from 'react';
import { OCCASION_LABEL } from '../../engine/data/categories';
import type { IntakeDraft, IntakeQuestion } from '../../engine/intake';
import { formatINR, parseINR } from '../../engine/money';
import { createPlan } from '../../engine/plan';
import {
  validateIntake,
  valuesFromDraft,
  type IntakeField,
  type IntakeValues,
} from '../../lib/intakeForm';
import { OCCASIONS } from '../../schemas/plan';
import { usePlanStore } from '../../state/PlanContext';
import { describedBy, Field } from '../common';
import { ErrorSummary, IntakeQuestions } from './IntakeNotes';
import { PersonalFields } from './PersonalFields';

const FIELD_ORDER: IntakeField[] = ['occasion', 'budget', 'guests', 'eventDate', 'priorities'];

interface Props {
  draft: IntakeDraft;
  questions: IntakeQuestion[];
  followUp: string | null;
  onBack: () => void;
}

/** Review what we understood, answer what is missing, then build the plan. */
export function IntakeForm({ draft, questions, followUp, onBack }: Props) {
  const { dispatch, today } = usePlanStore();
  const [values, setValues] = useState<IntakeValues>(() => valuesFromDraft(draft));
  const [errors, setErrors] = useState<Partial<Record<IntakeField, string>>>({});
  const summary = useRef<HTMLDivElement>(null);
  const ask = (field: IntakeField) => questions.find((item) => item.field === field)?.question;
  const set = (patch: Partial<IntakeValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  };
  const budgetValue = parseINR(values.budget);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateIntake(values, today);
    if (result.errors) {
      setErrors(result.errors);
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    dispatch({ type: 'create', plan: createPlan(result.intake, today) });
  }

  const errorList = FIELD_ORDER.filter((field) => errors[field]);
  return (
    <form className="card intake" onSubmit={submit} noValidate>
      <IntakeQuestions questions={questions} followUp={followUp} />
      <ErrorSummary fields={errorList} errors={errors} ref={summary} />

      <fieldset
        id="intake-occasion"
        className="field"
        aria-describedby={errors.occasion ? 'intake-occasion-error' : undefined}
      >
        <legend>What are you celebrating?</legend>
        <div className="choices">
          {OCCASIONS.map((occasion) => (
            <label key={occasion} className="choice">
              <input
                type="radio"
                name="occasion"
                value={occasion}
                checked={values.occasion === occasion}
                onChange={() => {
                  set({ occasion });
                }}
              />
              {OCCASION_LABEL[occasion]}
            </label>
          ))}
        </div>
        {errors.occasion ? (
          <p className="error-text" id="intake-occasion-error">
            ✕ {errors.occasion}
          </p>
        ) : null}
      </fieldset>

      <div className="form-grid">
        <Field id="intake-title" label="Name of the plan">
          <input
            id="intake-title"
            maxLength={80}
            value={values.title}
            onChange={(event) => {
              set({ title: event.target.value });
            }}
          />
        </Field>
        <Field
          id="intake-eventDate"
          label="Event date"
          hint={ask('eventDate')}
          error={errors.eventDate}
        >
          <input
            id="intake-eventDate"
            type="date"
            min={today}
            value={values.eventDate}
            aria-invalid={Boolean(errors.eventDate)}
            aria-describedby={describedBy('intake-eventDate', ask('eventDate'), errors.eventDate)}
            onChange={(event) => {
              set({ eventDate: event.target.value });
            }}
          />
        </Field>
        <Field
          id="intake-budget"
          label="Total budget"
          hint={
            budgetValue
              ? `= ${formatINR(budgetValue)}`
              : (ask('budget') ?? 'For example 8 lakh, 40k or 250000.')
          }
          error={errors.budget}
        >
          <input
            id="intake-budget"
            inputMode="text"
            value={values.budget}
            aria-invalid={Boolean(errors.budget)}
            aria-describedby={describedBy('intake-budget', 'hint', errors.budget)}
            onChange={(event) => {
              set({ budget: event.target.value });
            }}
          />
        </Field>
        <Field
          id="intake-guests"
          label="Number of guests"
          hint={ask('guests')}
          error={errors.guests}
        >
          <input
            id="intake-guests"
            type="number"
            min={1}
            max={5000}
            inputMode="numeric"
            value={values.guests}
            aria-invalid={Boolean(errors.guests)}
            aria-describedby={describedBy('intake-guests', ask('guests'), errors.guests)}
            onChange={(event) => {
              set({ guests: event.target.value });
            }}
          />
        </Field>
      </div>

      <PersonalFields values={values} set={set} prioritiesQuestion={ask('priorities')} />

      <div className="actions">
        <button type="submit" className="btn btn-primary">
          Build my plan
        </button>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </form>
  );
}
