import { useState, type InputHTMLAttributes } from 'react';

type NativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onBlur' | 'onKeyDown'
>;

interface CommitInputProps extends NativeProps {
  /** The committed value shown when the field is not being edited. */
  value: number;
  /** Reads the typed text; `null` means "not a valid value", and nothing is committed. */
  parse: (text: string) => number | null;
  /** Called once per edit, on Enter or blur, and only when the value really changed. */
  onCommit: (value: number) => void;
}

/**
 * A numeric field that reports its value on Enter or when focus leaves, never per keystroke,
 * so each edit becomes exactly one plan version.
 */
export function CommitInput({ value, parse, onCommit, ...inputProps }: CommitInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const next = parse(draft);
    setDraft(null);
    if (next !== null && next !== value) onCommit(next);
  }

  return (
    <input
      {...inputProps}
      value={draft ?? String(value)}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
      }}
    />
  );
}
