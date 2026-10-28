import { useState } from 'react';
import { categoryLabel } from '../../engine/data/categories';
import { mixQuestions, VENDOR_NEEDS, type VendorNeed } from '../../engine/data/vendors';
import { formatDate } from '../../engine/dates';
import { formatINR } from '../../engine/money';
import { acceptQuote, compareQuotes, followUpMessage, removeQuote } from '../../engine/quotes';
import { useActivePlan } from '../../state/PlanContext';
import { Badge } from '../common';
import { QuoteForm } from './QuoteForm';

function VendorCard({ need }: { need: VendorNeed }) {
  const { plan, update } = useActivePlan();
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState('');
  const rows = compareQuotes(plan, need.category);
  const booked = rows.find((row) => row.quote.accepted);
  const questions = [
    ...need.questions,
    ...(need.category === 'venue' ? mixQuestions(plan.guestMix) : []),
  ];
  const headingId = `vendor-${need.category}`;

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
    } catch {
      setCopied('');
    }
  }

  return (
    <article className="card vendor" aria-labelledby={headingId}>
      <header className="vendor-head">
        <h3 id={headingId}>{need.vendor}</h3>
        {booked ? (
          <Badge tone="ok">Quote accepted</Badge>
        ) : rows.length > 0 ? (
          <Badge tone="warn">{rows.length} quote(s) to compare</Badge>
        ) : (
          <Badge tone="muted">Not started</Badge>
        )}
      </header>
      <p className="hint">Budget line: {categoryLabel(need.category, plan.occasion)}</p>
      <details>
        <summary>Questions to ask before booking ({questions.length})</summary>
        <ul>
          {questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </details>
      {rows.length > 0 ? (
        <ul className="quotes">
          {rows.map(({ quote, cost, flags, vsAllocation }) => (
            <li key={quote.id} className={quote.accepted ? 'quote accepted' : 'quote'}>
              <p>
                <strong>{quote.vendor}</strong>: real cost {formatINR(cost.total)}
                {cost.billedGuests !== null ? ` (${String(cost.billedGuests)} plates)` : ''}
                {cost.tax > 0 ? ` incl. ${formatINR(cost.tax)} GST` : ''} ·{' '}
                {vsAllocation > 0
                  ? `${formatINR(vsAllocation)} over this line`
                  : `${formatINR(-vsAllocation)} under this line`}
              </p>
              {flags.length > 0 ? (
                <ul className="flags">
                  {flags.map((flag) => (
                    <li key={flag.code}>
                      <span aria-hidden="true">! </span>
                      {flag.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="actions">
                {!quote.accepted ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-small"
                    aria-label={`Accept ${quote.vendor}`}
                    onClick={() => {
                      update(acceptQuote(plan, quote.id), `Accepted ${quote.vendor}'s quote.`);
                    }}
                  >
                    Accept
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() =>
                    void copy(
                      quote.id,
                      followUpMessage(quote, plan.guests, formatDate(plan.eventDate)),
                    )
                  }
                >
                  {copied === quote.id ? 'Copied follow-up' : 'Copy follow-up message'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  aria-label={`Remove ${quote.vendor}`}
                  onClick={() => {
                    update(removeQuote(plan, quote.id), `Removed ${quote.vendor}'s quote.`);
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {adding ? (
        <QuoteForm
          category={need.category}
          onSave={(quote) => {
            update(
              { ...plan, quotes: [...plan.quotes, quote] },
              `Added a quote from ${quote.vendor}.`,
            );
            setAdding(false);
          }}
          onCancel={() => {
            setAdding(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="btn btn-secondary btn-small"
          aria-label={`Add a quote for ${need.vendor}`}
          disabled={plan.quotes.length >= 30}
          onClick={() => {
            setAdding(true);
          }}
        >
          Add a quote
        </button>
      )}
    </article>
  );
}

/** Vendor checklist per occasion: what to ask, quotes compared at their real cost, and polite follow-ups. */
export default function VendorsTab() {
  const { plan } = useActivePlan();
  return (
    <div className="vendors">
      <h2>Vendors</h2>
      <p className="lede">
        Tayyari never lists vendors or claims anyone is available. Paste the quotes you receive and
        it works out the real cost: guest minimums, GST and what is missing.
      </p>
      <div className="vendor-grid">
        {VENDOR_NEEDS[plan.occasion].map((need) => (
          <VendorCard key={need.category} need={need} />
        ))}
      </div>
    </div>
  );
}
