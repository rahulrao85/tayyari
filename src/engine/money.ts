/** Money helpers. All amounts are whole rupees (integers). */

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** `800000` → `₹8,00,000`. */
export function formatINR(amount: number): string {
  return INR.format(Math.round(amount));
}

/** Compact label: `₹8 L`, `₹1.25 Cr`, `₹45,000`. */
export function formatShortINR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  const trim = (value: number) => String(Number(value.toFixed(2)));
  if (abs >= 10_000_000) return `${sign}₹${trim(abs / 10_000_000)} Cr`;
  if (abs >= 100_000) return `${sign}₹${trim(abs / 100_000)} L`;
  return `${sign}${INR.format(abs)}`;
}

const UNIT: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  l: 100_000,
  lac: 100_000,
  lacs: 100_000,
  lakh: 100_000,
  lakhs: 100_000,
  cr: 10_000_000,
  crore: 10_000_000,
  crores: 10_000_000,
};

/** Matches `₹8,00,000`, `8 lakh`, `8.5L`, `2 crore`, `50k`, `Rs 60000`. */
const MONEY_PATTERN = /(\d[\d,]{0,15}(?:\.\d{1,3})?)\s?([a-z]{1,8})?/i;

/**
 * Reads an Indian-style amount from text. Returns `null` when there is none.
 * Bare numbers are taken as rupees.
 */
export function parseINR(text: string): number | null {
  const match = MONEY_PATTERN.exec(text);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/,/g, ''));
  const unit = UNIT[match[2]?.toLowerCase() ?? ''] ?? 1;
  const amount = Math.round(value * unit);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Splits `total` into whole-rupee parts proportional to `weights` so the
 * parts always add up to exactly `total` (largest-remainder method).
 */
export function largestRemainder(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const safe = weights.map((weight) => Math.max(0, weight));
  const sum = safe.reduce((acc, weight) => acc + weight, 0);
  const shares = sum === 0 ? safe.map(() => 1 / safe.length) : safe.map((weight) => weight / sum);
  const raw = shares.map((share) => share * total);
  const parts = raw.map(Math.floor);
  let left = total - parts.reduce((acc, part) => acc + part, 0);
  const order = raw
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    left -= 1;
  }
  return parts;
}

/** Sum of a list of amounts. */
export function sum(values: readonly number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}
