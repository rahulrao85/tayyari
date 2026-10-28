import { fallbackIdeas } from '../../engine/data/ideas';
import { useAi } from '../../lib/useAi';
import { IdeasSchema, type Ideas, type IdeasRequest } from '../../schemas/api';
import type { Plan } from '../../schemas/plan';
import { useActivePlan } from '../../state/PlanContext';
import { SourceNote, Working } from '../common';

/** Budget band per guest, so ideas fit the money without the AI ever seeing a price list. */
export function budgetBand(plan: Plan): IdeasRequest['budgetBand'] {
  const perGuest = plan.budget / plan.guests;
  if (perGuest < 1500) return 'modest';
  return perGuest < 5000 ? 'comfortable' : 'generous';
}

const SECTIONS: { key: Exclude<keyof Ideas, 'invitationLine'>; title: string }[] = [
  { key: 'themes', title: 'Themes' },
  { key: 'activities', title: 'Activities' },
  { key: 'food', title: 'Food ideas' },
  { key: 'touches', title: 'Personal touches' },
];

/** Personalised ideas from Gemini, tuned to who is coming; general ideas if AI is down. Never with prices. */
export default function IdeasTab() {
  const { plan } = useActivePlan();
  const ideas = useAi('/api/ideas', IdeasSchema);
  const result = ideas.result;
  const shown = result
    ? result.ok
      ? result.data
      : fallbackIdeas(plan.occasion, plan.guestMix)
    : null;

  function request() {
    void ideas.run({
      occasion: plan.occasion,
      vibe: plan.vibe,
      guests: plan.guests,
      budgetBand: budgetBand(plan),
      guestMix: plan.guestMix,
      dietary: plan.dietary,
      mustHaves: plan.mustHaves,
    });
  }

  return (
    <div className="ideas">
      <h2>Ideas</h2>
      <p className="lede">
        Ideas fitted to your occasion, the feel you want, your budget band ({budgetBand(plan)}) and
        who is coming. No prices and no vendor names, ever.
      </p>
      <button type="button" className="btn btn-primary" onClick={request} disabled={ideas.loading}>
        {shown ? 'Suggest different ideas' : 'Suggest ideas for us'}
      </button>
      {ideas.loading ? <Working label="Gemini is thinking of ideas…" /> : null}
      {result ? <SourceNote result={result} fallback={!result.ok} /> : null}
      {result && !result.ok ? (
        <p className="hint">
          These are general ideas for your occasion, adjusted for who is coming.
        </p>
      ) : null}
      {shown ? (
        <div className="idea-grid" aria-live="polite">
          {SECTIONS.map((section) => (
            <section key={section.key} className="card">
              <h3>{section.title}</h3>
              <ul>
                {shown[section.key].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
          <section className="card">
            <h3>Invitation line</h3>
            <blockquote>{shown.invitationLine}</blockquote>
          </section>
        </div>
      ) : null}
    </div>
  );
}
