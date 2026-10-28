import { describe, expect, it } from 'vitest';
import { escapeIcs, foldLine, googleCalendarUrl, scheduleToIcs } from '../../src/engine/calendar';
import { fallbackIdeas } from '../../src/engine/data/ideas';
import { mixQuestions, VENDOR_NEEDS } from '../../src/engine/data/vendors';
import { addDays } from '../../src/engine/dates';
import { localAnswer, planFacts } from '../../src/engine/facts';
import { planInsights } from '../../src/engine/insights';
import { buildSchedule, setTaskDone, setTaskDelay } from '../../src/engine/timeline';
import { IdeasSchema } from '../../src/schemas/api';
import { OCCASIONS, type Plan } from '../../src/schemas/plan';
import { quote, TODAY, weddingPlan } from '../helpers';

const insightsFor = (plan: Plan) => planInsights(plan, buildSchedule(plan, TODAY));

describe('planInsights', () => {
  it('puts over-budget and impossible tasks first', () => {
    const plan = setTaskDelay(
      { ...weddingPlan(), guests: 260, eventDate: addDays(TODAY, 30) },
      'date',
      60,
    );
    const items = insightsFor(plan);
    expect(items[0]?.level).toBe('urgent');
    expect(items.map((item) => item.text).join(' ')).toMatch(/Over budget by/);
    expect(items.map((item) => item.text).join(' ')).toMatch(/after the event/);
  });

  it('lists overdue and soon tasks, and accepted quotes with open questions', () => {
    const plan = {
      ...weddingPlan(),
      createdOn: addDays(TODAY, -30),
      eventDate: addDays(TODAY, 166),
      quotes: [
        quote({ accepted: true, cancellationPolicy: null }),
        quote({ id: 'b', taxIncluded: false, accepted: false }),
      ],
    };
    const texts = insightsFor(plan).map((item) => item.text);
    expect(texts.some((text) => text.includes('overdue'))).toBe(true);
    expect(texts.some((text) => text.startsWith('Due by'))).toBe(true);
    expect(texts.some((text) => text.includes('cancellation'))).toBe(true);
    expect(texts.some((text) => text.startsWith('Collect quotes for'))).toBe(true);
  });

  it('warns about a thin buffer and says when all is well', () => {
    const plan = weddingPlan();
    const thin = {
      ...plan,
      lines: plan.lines.map((line) =>
        line.category === 'contingency' ? { ...line, amount: 0 } : line,
      ),
    };
    expect(insightsFor(thin).some((item) => item.text.includes('buffer'))).toBe(true);
    let calm: Plan = {
      ...plan,
      eventDate: addDays(TODAY, 400),
      quotes: VENDOR_NEEDS.wedding.map((need, index) =>
        quote({
          id: `q${index}`,
          category: need.category,
          pricing: 'flat',
          amount: 1,
          accepted: false,
        }),
      ),
    };
    calm = setTaskDone(calm, 'date', true);
    expect(insightsFor(calm)).toEqual([
      { level: 'tip', text: expect.stringContaining('on track') as string, tab: 'ideas' },
    ]);
  });
});

describe('facts and local answers', () => {
  const plan = {
    ...weddingPlan(),
    guests: 260,
    mustHaves: ['Live band'],
    guestMix: { kids: true, elders: true, accessibility: true },
  };
  const facts = planFacts(plan, buildSchedule(plan, TODAY));

  it('grounds the AI in formatted facts', () => {
    expect(facts.budget).toBe('₹8,00,000');
    expect(facts.lines).toHaveLength(8);
    expect(facts.problems[0]).toMatch(/needs ₹/);
    expect(facts.guestNotes).toEqual([
      'children attending',
      'elders attending',
      'accessibility needs',
      'Vegetarian',
      'must have: Live band',
    ]);
  });

  it('answers common questions from the facts', () => {
    expect(localAnswer('Kitna kharcha bacha hai?', facts)).toMatch(/over budget by/);
    expect(localAnswer('What should we do first?', facts)).toMatch(/^Next up:/);
    expect(localAnswer('When is it?', facts)).toMatch(/days from today/);
    expect(localAnswer('How many guests?', facts)).toMatch(/260 guests \(children/);
    expect(localAnswer('Tell me a joke', facts)).toMatch(/Needs attention/);
  });

  it('handles a plan that fits and has every task done', () => {
    let calm = weddingPlan({
      mustHaves: [],
      guestMix: { kids: false, elders: false, accessibility: false },
      dietary: [],
    });
    const schedule = buildSchedule(calm, TODAY);
    for (const task of schedule.tasks) calm = setTaskDone(calm, task.id, true);
    const calmFacts = planFacts(calm, buildSchedule(calm, TODAY));
    expect(localAnswer('are we over budget?', calmFacts)).toMatch(/within your/);
    expect(localAnswer('what next?', calmFacts)).toMatch(/Every task is done/);
    expect(localAnswer('how many people', calmFacts)).toBe('You are planning for 200 guests.');
    expect(localAnswer('hello', calmFacts)).not.toMatch(/Needs attention/);
  });
});

describe('calendar export', () => {
  it('escapes and folds lines per RFC 5545', () => {
    expect(escapeIcs('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const folded = foldLine(`SUMMARY:${'x'.repeat(200)}`);
    expect(folded.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true,
    );
    expect(foldLine('short')).toBe('short');
  });

  it('exports open tasks and the event', () => {
    const plan = setTaskDone(weddingPlan(), 'date', true);
    const ics = scheduleToIcs(plan, buildSchedule(plan, TODAY).tasks, TODAY);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270228');
    expect(ics).not.toContain('UID:date@tayyari');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('builds a Google Calendar link', () => {
    const url = new URL(googleCalendarUrl('Book the venue', '2026-11-20'));
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('dates')).toBe('20261120/20261121');
  });
});

describe('fallback ideas and vendor questions', () => {
  it.each(OCCASIONS)('%s ideas are valid and adapt to the guest mix', (occasion) => {
    const ideas = fallbackIdeas(occasion, { kids: true, elders: true, accessibility: true });
    expect(IdeasSchema.safeParse(ideas).success).toBe(true);
    expect(ideas.touches[0]).toMatch(/elders/);
    expect(
      fallbackIdeas(occasion, { kids: false, elders: false, accessibility: false }).touches,
    ).toHaveLength(3);
  });

  it('adds questions for who is coming', () => {
    expect(mixQuestions({ kids: true, elders: true, accessibility: true })).toHaveLength(3);
    expect(mixQuestions({ kids: false, elders: false, accessibility: false })).toEqual([]);
  });
});
