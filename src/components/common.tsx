import type { ReactNode } from 'react';
import { modelLabel, type AiResult } from '../lib/api';

/** Status shown as text plus a symbol, never by colour alone. */
export function Badge({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'danger' | 'info' | 'muted';
  children: ReactNode;
}) {
  const symbol = { ok: '✓', warn: '!', danger: '✕', info: 'i', muted: '•' }[tone];
  return (
    <span className={`badge badge-${tone}`}>
      <span aria-hidden="true">{symbol}</span> {children}
    </span>
  );
}

/** Says who answered: Gemini (and which model) or the built-in planner. */
export function SourceNote({
  result,
  fallback,
}: {
  result: AiResult<unknown> | null;
  fallback: boolean;
}) {
  if (fallback || !result?.ok) {
    return <p className="source-note">Built-in planner answered (AI unavailable right now).</p>;
  }
  return (
    <p className="source-note">
      Answered by {modelLabel(result.model)}
      {result.cached ? ' · from cache' : ''}
    </p>
  );
}

/** A short, polite live message while AI works. */
export function Working({ label }: { label: string }) {
  return (
    <p className="working" role="status">
      <span className="spinner" aria-hidden="true" /> {label}
    </p>
  );
}

/** A labelled form field with an optional hint, wired up for screen readers. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={`field${error ? ' field-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p className="error-text" id={`${id}-error`}>
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** `aria-describedby` for a field's hint and error. */
export function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
