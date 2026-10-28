import { categoryLabel } from '../../engine/data/categories';
import type { IntakeValues } from '../../lib/intakeForm';
import { CATEGORIES, type Category } from '../../schemas/plan';
import { Field } from '../common';

const PRIORITY_CHOICES = CATEGORIES.filter((category) => category !== 'contingency');

interface Props {
  values: IntakeValues;
  set: (patch: Partial<IntakeValues>) => void;
  prioritiesQuestion: string | undefined;
}

/** The personal part of the intake: priorities, who is coming, food habits and must-haves. */
export function PersonalFields({ values, set, prioritiesQuestion }: Props) {
  function togglePriority(category: Category) {
    const has = values.priorities.includes(category);
    set({
      priorities: has
        ? values.priorities.filter((item) => item !== category)
        : [...values.priorities, category].slice(0, 3),
    });
  }
  return (
    <>
      <fieldset id="intake-priorities" className="field">
        <legend>What matters most? (up to three)</legend>
        {prioritiesQuestion ? <p className="hint">{prioritiesQuestion}</p> : null}
        <div className="choices">
          {PRIORITY_CHOICES.map((category) => (
            <label key={category} className="choice">
              <input
                type="checkbox"
                checked={values.priorities.includes(category)}
                onChange={() => {
                  togglePriority(category);
                }}
              />
              {categoryLabel(category, values.occasion || 'wedding')}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Who is coming?</legend>
        <div className="choices">
          {(['kids', 'elders', 'accessibility'] as const).map((key) => (
            <label key={key} className="choice">
              <input
                type="checkbox"
                checked={values.guestMix[key]}
                onChange={() => {
                  set({ guestMix: { ...values.guestMix, [key]: !values.guestMix[key] } });
                }}
              />
              {
                {
                  kids: 'Children',
                  elders: 'Elders',
                  accessibility: 'Guests with accessibility needs',
                }[key]
              }
            </label>
          ))}
        </div>
      </fieldset>

      <div className="form-grid">
        <Field id="intake-dietary" label="Food habits" hint="Comma separated, e.g. Jain, pure veg">
          <input
            id="intake-dietary"
            aria-describedby="intake-dietary-hint"
            value={values.dietary}
            onChange={(event) => {
              set({ dietary: event.target.value });
            }}
          />
        </Field>
        <Field
          id="intake-mustHaves"
          label="Must-haves"
          hint="Comma separated, e.g. live band, haldi"
        >
          <input
            id="intake-mustHaves"
            aria-describedby="intake-mustHaves-hint"
            value={values.mustHaves}
            onChange={(event) => {
              set({ mustHaves: event.target.value });
            }}
          />
        </Field>
        <Field
          id="intake-vibe"
          label="The feel you want"
          hint="e.g. simple and intimate, grand, eco-friendly"
        >
          <input
            id="intake-vibe"
            aria-describedby="intake-vibe-hint"
            maxLength={120}
            value={values.vibe}
            onChange={(event) => {
              set({ vibe: event.target.value });
            }}
          />
        </Field>
      </div>
    </>
  );
}
