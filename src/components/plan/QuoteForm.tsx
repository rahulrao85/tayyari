import { useState, type SubmitEvent } from 'react';
import { parseINR } from '../../engine/money';
import { modelLabel } from '../../lib/api';
import { useAi } from '../../lib/useAi';
import { QuoteExtractSchema, type QuoteExtract } from '../../schemas/api';
import { QuoteSchema, type Quote } from '../../schemas/plan';
import { Field, Working } from '../common';

type VendorCategory = Quote['category'];

/** Whether a quote says GST is included (true), extra (false) or does not say (null). */
function readGst(text: string): boolean | null {
  if (/gst\s?(?:incl|included)|inclusive of gst/i.test(text)) return true;
  if (/\+\s?gst|gst\s?extra|plus gst/i.test(text)) return false;
  return null;
}

/** Rule-based reading for when AI is unavailable: an amount and whether it is per plate. */
export function roughQuote(text: string): QuoteExtract {
  const perGuest = /per\s*(plate|head|person|guest|pax)|\/\s*plate/i.test(text);
  const minimum = /min(?:imum)?\.?\s*(?:of\s*)?(\d+)\s*(?:plates|guests|pax|people)/i.exec(text);
  return {
    vendor: null,
    pricing: perGuest ? 'per_guest' : 'flat',
    amount: parseINR(text) ?? 0,
    guestMinimum: minimum?.[1] ? Number(minimum[1]) : null,
    taxIncluded: readGst(text),
    advancePercent: null,
    cancellationPolicy: null,
    inclusions: [],
  };
}

/** Paste a quote; AI pulls out the fields; the family checks them before saving. */
export function QuoteForm({
  category,
  onSave,
  onCancel,
}: {
  category: VendorCategory;
  onSave: (quote: Quote) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [fields, setFields] = useState<QuoteExtract | null>(null);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const extract = useAi('/api/quote', QuoteExtractSchema);
  const id = `quote-${category}`;

  async function read(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await extract.run({ text, category });
    if (!result.ok && result.code === 'CANCELLED') return;
    setFields(result.ok ? result.data : roughQuote(text));
    setSource(
      result.ok
        ? `Read by ${modelLabel(result.model)}. Please check every field.`
        : 'Read by the built-in parser. Please check every field.',
    );
  }

  function save() {
    if (!fields) return;
    const parsed = QuoteSchema.safeParse({
      ...fields,
      id: `q-${Date.now().toString(36)}`,
      category,
      vendor:
        fields.vendor && fields.vendor.trim().length > 0 ? fields.vendor.trim() : 'Unnamed vendor',
      accepted: false,
    });
    if (!parsed.success || parsed.data.amount === 0) {
      setError('Enter the price before saving.');
      return;
    }
    onSave(parsed.data);
  }

  const set = (patch: Partial<QuoteExtract>) => {
    setFields((current) => (current ? { ...current, ...patch } : current));
  };
  return (
    <div className="quote-form">
      <form onSubmit={(event) => void read(event)}>
        <label htmlFor={`${id}-text`}>Paste the quote (WhatsApp message, email or notes)</label>
        <textarea
          id={`${id}-text`}
          rows={3}
          maxLength={2000}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        <button
          type="submit"
          className="btn btn-primary btn-small"
          disabled={!text.trim() || extract.loading}
        >
          Read the quote
        </button>
        {extract.loading ? <Working label="Gemini is reading the quote…" /> : null}
      </form>
      {fields ? (
        <div className="quote-fields">
          <p className="source-note">{source} Anything the quote did not say is left empty.</p>
          <div className="form-grid">
            <Field id={`${id}-vendor`} label="Vendor">
              <input
                id={`${id}-vendor`}
                maxLength={60}
                value={fields.vendor ?? ''}
                onChange={(event) => {
                  set({ vendor: event.target.value });
                }}
              />
            </Field>
            <Field
              id={`${id}-amount`}
              label={fields.pricing === 'per_guest' ? 'Price per guest (₹)' : 'Total price (₹)'}
              error={error || undefined}
            >
              <input
                id={`${id}-amount`}
                type="number"
                min={0}
                value={fields.amount}
                onChange={(event) => {
                  set({ amount: Math.max(0, Math.round(Number(event.target.value) || 0)) });
                }}
              />
            </Field>
            <Field id={`${id}-pricing`} label="Priced">
              <select
                id={`${id}-pricing`}
                value={fields.pricing}
                onChange={(event) => {
                  set({ pricing: event.target.value === 'flat' ? 'flat' : 'per_guest' });
                }}
              >
                <option value="per_guest">Per guest / plate</option>
                <option value="flat">Fixed total</option>
              </select>
            </Field>
            <Field id={`${id}-minimum`} label="Minimum guests (if any)">
              <input
                id={`${id}-minimum`}
                type="number"
                min={1}
                value={fields.guestMinimum ?? ''}
                onChange={(event) => {
                  set({
                    guestMinimum:
                      Number(event.target.value) > 0
                        ? Math.round(Number(event.target.value))
                        : null,
                  });
                }}
              />
            </Field>
            <Field id={`${id}-tax`} label="GST">
              <select
                id={`${id}-tax`}
                value={fields.taxIncluded === null ? 'unknown' : String(fields.taxIncluded)}
                onChange={(event) => {
                  set({
                    taxIncluded:
                      event.target.value === 'unknown' ? null : event.target.value === 'true',
                  });
                }}
              >
                <option value="unknown">Not mentioned</option>
                <option value="true">Included</option>
                <option value="false">Extra (18%)</option>
              </select>
            </Field>
            <Field id={`${id}-cancel`} label="Cancellation policy">
              <input
                id={`${id}-cancel`}
                maxLength={200}
                value={fields.cancellationPolicy ?? ''}
                onChange={(event) => {
                  set({
                    cancellationPolicy: event.target.value.trim() ? event.target.value : null,
                  });
                }}
              />
            </Field>
          </div>
          <div className="actions">
            <button type="button" className="btn btn-primary btn-small" onClick={save}>
              Save quote
            </button>
            <button type="button" className="btn btn-secondary btn-small" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="link-button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
