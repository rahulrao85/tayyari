import { googleCalendarUrl, scheduleToIcs } from '../../engine/calendar';
import { RUN_SHEET } from '../../engine/data/tasks';
import { daysBetween, formatDate, relativeDays } from '../../engine/dates';
import { setTaskDelay, setTaskDone, type TaskStatus } from '../../engine/timeline';
import { useState } from 'react';
import { downloadFile } from '../../lib/download';
import { useActivePlan } from '../../state/PlanContext';
import { Badge } from '../common';

const STATUS: Record<
  TaskStatus,
  { tone: 'ok' | 'warn' | 'danger' | 'info' | 'muted'; label: string }
> = {
  done: { tone: 'ok', label: 'Done' },
  impossible: { tone: 'danger', label: 'After the event' },
  overdue: { tone: 'danger', label: 'Overdue' },
  soon: { tone: 'warn', label: 'Due soon' },
  'on-track': { tone: 'info', label: 'On track' },
};

/** Days of delay, committed on blur or Enter so each keystroke is not a new version. */
function DelayInput({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: number;
  onCommit: (days: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const days = Math.min(365, Math.max(0, Math.round(Number(draft) || 0)));
    setDraft(null);
    if (days !== value) onCommit(days);
  };
  return (
    <input
      id={id}
      type="number"
      min={0}
      max={365}
      className="delay"
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

/** Dependency-ordered tasks with book-by dates. Delays push dependent tasks, with the reason in words. */
export function TimelineTab() {
  const { plan, schedule, today, update } = useActivePlan();

  return (
    <div className="timeline-tab">
      <h2>Timeline</h2>
      {schedule.compressed ? (
        <p className="notice">
          Your event was closer than the usual {plan.occasion === 'wedding' ? 'six-month' : 'lead'}{' '}
          runway, so every task was squeezed by the same factor. The order stays the same.
        </p>
      ) : null}
      <div className="actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            downloadFile(
              'tayyari-timeline.ics',
              scheduleToIcs(plan, schedule.tasks, today),
              'text/calendar',
            );
          }}
        >
          Add all dates to my calendar (.ics)
        </button>
      </div>
      <ol className="tasks">
        {schedule.tasks.map((task) => {
          const status = STATUS[task.status];
          const delay = plan.tasks[task.id]?.delayDays ?? 0;
          return (
            <li key={task.id} className={`task task-${task.status}`}>
              <div className="task-main">
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={task.status === 'done'}
                    onChange={(event) => {
                      update(
                        setTaskDone(plan, task.id, event.target.checked),
                        `${task.title}: ${event.target.checked ? 'done' : 'not done'}.`,
                      );
                    }}
                  />
                  <span className="task-title">{task.title}</span>
                </label>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <p className="task-meta">
                By <strong>{formatDate(task.due)}</strong> (
                {relativeDays(daysBetween(today, task.due))})
                {task.pushedDays > 0 ? (
                  <span className="pushed">
                    {' '}
                    · pushed {task.pushedDays} days{' '}
                    {task.pushedBy.length > 0
                      ? `because "${task.pushedBy.join('", "')}" slipped`
                      : 'by your delay'}
                  </span>
                ) : null}
              </p>
              <div className="task-tools">
                <label htmlFor={`delay-${task.id}`}>Delay (days)</label>
                <DelayInput
                  id={`delay-${task.id}`}
                  value={delay}
                  onCommit={(days) => {
                    update(
                      setTaskDelay(plan, task.id, days),
                      `${task.title} delayed by ${days} days.`,
                    );
                  }}
                />
                <a
                  href={googleCalendarUrl(`Tayyari: ${task.title}`, task.due)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Calendar
                  <span className="sr-only"> for {task.title} (opens in a new tab)</span>
                </a>
              </div>
            </li>
          );
        })}
      </ol>
      <section aria-labelledby="runsheet-title">
        <h3 id="runsheet-title">Suggested run sheet for the day</h3>
        <p className="hint">Typical timings to adjust to your muhurat or venue slot.</p>
        <ol className="runsheet">
          {RUN_SHEET[plan.occasion].map((row) => (
            <li key={row.time}>
              <time>{row.time}</time> {row.item}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
