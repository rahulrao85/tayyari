import { categoryLabel } from '../../engine/data/categories';
import type { PlanDiff } from '../../engine/changes';
import { formatDate } from '../../engine/dates';
import { formatINR } from '../../engine/money';
import type { TaskStatus } from '../../engine/timeline';
import type { Occasion } from '../../schemas/plan';

const STATUS_WORD: Record<TaskStatus, string> = {
  done: 'done',
  impossible: 'after the event',
  overdue: 'overdue',
  soon: 'due soon',
  'on-track': 'on track',
};

const signed = (delta: number, format: (value: number) => string) =>
  `${delta < 0 ? '−' : '+'}${format(Math.abs(delta))}`;

/** Before and after, side by side: what the change does to money, guests, dates and tasks. */
export function DiffView({ diff, occasion }: { diff: PlanDiff; occasion: Occasion }) {
  const rows = [
    {
      label: 'Total budget',
      before: formatINR(diff.budget.before),
      after: formatINR(diff.budget.after),
      changed: diff.budget.before !== diff.budget.after,
    },
    {
      label: 'Guests',
      before: String(diff.guests.before),
      after: String(diff.guests.after),
      changed: diff.guests.before !== diff.guests.after,
    },
    {
      label: 'Event date',
      before: formatDate(diff.eventDate.before),
      after: formatDate(diff.eventDate.after),
      changed: diff.eventDate.before !== diff.eventDate.after,
    },
    {
      label: 'Over budget by',
      before: formatINR(diff.overBy.before),
      after: formatINR(diff.overBy.after),
      changed: diff.overBy.before !== diff.overBy.after,
    },
  ];
  return (
    <div className="diff">
      <table className="responsive">
        <caption>Before and after</caption>
        <thead>
          <tr>
            <th scope="col">What</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={row.changed ? 'changed' : undefined}>
              <th scope="row" data-label="What">
                {row.label}
              </th>
              <td data-label="Before">{row.before}</td>
              <td data-label="After">
                {row.after}
                {row.changed ? <span className="sr-only"> (changed)</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {diff.lines.length > 0 ? (
        <table className="responsive">
          <caption>Budget lines that move</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {diff.lines.map((line) => (
              <tr key={line.category}>
                <th scope="row" data-label="Category">
                  {categoryLabel(line.category, occasion)}
                </th>
                <td data-label="Before">{formatINR(line.before)}</td>
                <td data-label="After">{formatINR(line.after)}</td>
                <td data-label="Change">{signed(line.after - line.before, formatINR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {diff.tasks.length > 0 ? (
        <section aria-labelledby="moved-title">
          <h4 id="moved-title">Tasks that move ({diff.tasks.length})</h4>
          {diff.newProblems > 0 ? (
            <p className="text-danger">
              <span aria-hidden="true">✕ </span>
              {diff.newProblems} task(s) become overdue or land after the event.
            </p>
          ) : null}
          <ul className="moves">
            {diff.tasks.map((move) => (
              <li key={move.id}>
                <strong>{move.title}</strong>: {formatDate(move.before.due)} →{' '}
                {formatDate(move.after.due)}
                {move.before.status !== move.after.status
                  ? ` (${STATUS_WORD[move.before.status]} → ${STATUS_WORD[move.after.status]})`
                  : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
