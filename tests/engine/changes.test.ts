import { describe, expect, it } from 'vitest';
import { toggleLock } from '../../src/engine/budget';
import { applyChangeSet, diffPlans, isEmptyDiff } from '../../src/engine/changes';
import { addDays } from '../../src/engine/dates';
import { isEmptyChange, parseChangeText } from '../../src/engine/parseChange';
import { setTaskDelay } from '../../src/engine/timeline';
import { EMPTY_CHANGES } from '../../src/schemas/plan';
import { amountOf, TODAY, total, weddingPlan } from '../helpers';

describe('applyChangeSet', () => {
  it('handles the explainer test: ₹50k less and two weeks earlier, without starting over', () => {
    const before = weddingPlan();
    const changes = parseChangeText('Budget is ₹50k less and the event is 2 weeks earlier', TODAY);
    const { plan, blocked, applied } = applyChangeSet(before, changes);
    expect(blocked).toBeNull();
    expect(plan.budget).toBe(750000);
    expect(total(plan)).toBe(750000);
    expect(plan.eventDate).toBe(addDays(before.eventDate, -14));
    expect(plan.title).toBe(before.title);
    expect(applied).toEqual(['Budget ₹7,50,000', 'Date 14-Feb-2027']);
  });

  it('keeps locked categories when the budget shrinks', () => {
    const before = { ...weddingPlan(), lines: toggleLock(weddingPlan().lines, 'catering') };
    const { plan } = applyChangeSet(before, {
      ...EMPTY_CHANGES,
      budget: { mode: 'delta', amount: -100000 },
    });
    expect(amountOf(plan, 'catering')).toBe(amountOf(before, 'catering'));
  });

  it('blocks a budget below what is locked, and leaves the plan unchanged', () => {
    const before = { ...weddingPlan(), lines: toggleLock(weddingPlan().lines, 'catering') };
    const result = applyChangeSet(before, {
      ...EMPTY_CHANGES,
      budget: { mode: 'set', amount: 5000 },
    });
    expect(result.blocked).toMatch(/Locked/);
    expect(result.plan).toBe(before);
  });

  it('sets and adds guests, clamped to sensible limits', () => {
    const plan = weddingPlan();
    expect(
      applyChangeSet(plan, { ...EMPTY_CHANGES, guests: { mode: 'delta', count: 30 } }).plan.guests,
    ).toBe(230);
    expect(
      applyChangeSet(plan, { ...EMPTY_CHANGES, guests: { mode: 'set', count: 0 } }).plan.guests,
    ).toBe(1);
  });

  it('moves the date to a set day and re-splits on new priorities', () => {
    const plan = weddingPlan();
    const moved = applyChangeSet(plan, {
      ...EMPTY_CHANGES,
      date: { mode: 'set', iso: '2027-03-15' },
    });
    expect(moved.plan.eventDate).toBe('2027-03-15');
    const reprioritised = applyChangeSet(plan, { ...EMPTY_CHANGES, priorities: ['photography'] });
    expect(amountOf(reprioritised.plan, 'photography')).toBeGreaterThan(
      amountOf(plan, 'photography'),
    );
    expect(total(reprioritised.plan)).toBe(800000);
    expect(applyChangeSet(plan, { ...EMPTY_CHANGES, priorities: [] }).applied).toEqual([
      'Priorities: none',
    ]);
  });

  it('keeps locked lines when priorities change', () => {
    const plan = { ...weddingPlan(), lines: toggleLock(weddingPlan().lines, 'venue') };
    const result = applyChangeSet(plan, { ...EMPTY_CHANGES, priorities: ['decor'] });
    expect(amountOf(result.plan, 'venue')).toBe(amountOf(plan, 'venue'));
    expect(total(result.plan)).toBe(800000);
  });
});

describe('diffPlans', () => {
  it('shows moved budget lines, moved tasks and new problems', () => {
    const before = setTaskDelay({ ...weddingPlan(), eventDate: addDays(TODAY, 200) }, 'venue', 30);
    const { plan: after } = applyChangeSet(before, {
      ...EMPTY_CHANGES,
      budget: { mode: 'delta', amount: -50000 },
      guests: { mode: 'delta', count: 60 },
      date: { mode: 'shift', days: -150 },
    });
    const diff = diffPlans(before, after, TODAY);
    expect(diff.budget).toEqual({ before: 800000, after: 750000 });
    expect(diff.lines.length).toBeGreaterThan(0);
    expect(diff.tasks.length).toBeGreaterThan(0);
    expect(diff.overBy.before).toBe(0);
    expect(diff.overBy.after).toBeGreaterThan(0);
    expect(diff.newProblems).toBeGreaterThan(0);
    expect(isEmptyDiff(diff)).toBe(false);
  });

  it('is empty when nothing changed', () => {
    const plan = weddingPlan();
    expect(isEmptyDiff(diffPlans(plan, plan, TODAY))).toBe(true);
  });
});

describe('parseChangeText', () => {
  it.each([
    ['cut the budget by 50k', { mode: 'delta', amount: -50000 }],
    ['budget is down by 1 lakh', { mode: 'delta', amount: -100000 }],
    ['we have ₹75,000 less now', { mode: 'delta', amount: -75000 }],
    ['raise the budget by 2 lakh', { mode: 'delta', amount: 200000 }],
    ['budget up by 25k', { mode: 'delta', amount: 25000 }],
    ['we can spend 1.5 lakh more', { mode: 'delta', amount: 150000 }],
    ['new budget is 9 lakh', { mode: 'set', amount: 900000 }],
    ['10 lakh budget now', { mode: 'set', amount: 1000000 }],
  ])('reads budget in "%s"', (text, expected) => {
    expect(parseChangeText(text, TODAY).budget).toEqual(expected);
  });

  it.each([
    ['30 more guests', { mode: 'delta', count: 30 }],
    ['add 15 people', { mode: 'delta', count: 15 }],
    ['20 fewer guests', { mode: 'delta', count: -20 }],
    ['remove 10 guests', { mode: 'delta', count: -10 }],
    ['guests now 180', { mode: 'set', count: 180 }],
    ['make it 150 people', { mode: 'set', count: 150 }],
  ])('reads guests in "%s"', (text, expected) => {
    expect(parseChangeText(text, TODAY).guests).toEqual(expected);
  });

  it.each([
    ['two weeks earlier', { mode: 'shift', days: -14 }],
    ['3 days later', { mode: 'shift', days: 3 }],
    ['a month sooner', { mode: 'shift', days: -30 }],
    ['postpone it by 10 days', { mode: 'shift', days: 10 }],
    ['prepone by 1 week', { mode: 'shift', days: -7 }],
    ['move it to 15 March 2027', { mode: 'set', iso: '2027-03-15' }],
  ])('reads the date in "%s"', (text, expected) => {
    expect(parseChangeText(text, TODAY).date).toEqual(expected);
  });

  it('does not read 30 more guests as money, and finds nothing in small talk', () => {
    expect(parseChangeText('30 more guests', TODAY).budget).toBeNull();
    const nothing = parseChangeText('hello there', TODAY);
    expect(isEmptyChange(nothing)).toBe(true);
    expect(parseChangeText('move it to someday', TODAY).date).toBeNull();
    expect(isEmptyChange({ ...EMPTY_CHANGES, priorities: ['decor'] })).toBe(false);
  });
});
