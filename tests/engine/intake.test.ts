import { describe, expect, it } from 'vitest';
import {
  completeIntake,
  EMPTY_DRAFT,
  mergeDrafts,
  missingQuestions,
  parseIntakeText,
} from '../../src/engine/intake';
import { parseDate, readCount, unitDays } from '../../src/engine/parse';
import { TODAY } from '../helpers';

describe('parseDate', () => {
  it.each([
    ['on 2027-02-14', '2027-02-14'],
    ['15 March 2027', '2027-03-15'],
    ['15th of march', '2027-03-15'],
    ['March 3, 2027', '2027-03-03'],
    ['mid-Feb', '2027-02-15'],
    ['end of December 2026', '2026-12-28'],
    ['early nov', '2026-11-05'],
    ['20 oct', '2027-10-20'],
    ['in 3 weeks', '2026-11-18'],
    ['in two months', '2026-12-27'],
  ])('reads "%s"', (text, expected) => {
    expect(parseDate(text, TODAY)).toBe(expected);
  });

  it('rejects impossible or missing dates', () => {
    expect(parseDate('31 feb 2027', TODAY)).toBeNull();
    expect(parseDate('2027-02-31', TODAY)).toBeNull();
    expect(parseDate('sometime soon', TODAY)).toBeNull();
  });

  it('reads counts and units', () => {
    expect(readCount('a')).toBe(1);
    expect(readCount('4')).toBe(4);
    expect(unitDays('weeks')).toBe(7);
    expect(unitDays('month')).toBe(30);
    expect(unitDays('day')).toBe(1);
  });
});

describe('parseIntakeText', () => {
  it("reads Priya's shaadi in one sentence", () => {
    const draft = parseIntakeText(
      'Shaadi in Pune, 200 guests, 8 lakh budget, mid-Feb, simple ceremony but premium food. Grandparents coming, pure veg.',
      TODAY,
    );
    expect(draft).toMatchObject({
      occasion: 'wedding',
      budget: 800000,
      guests: 200,
      eventDate: '2027-02-15',
      priorities: ['catering'],
      vibe: 'Simple and intimate',
      guestMix: { kids: false, elders: true, accessibility: false },
      dietary: ['Vegetarian'],
    });
    expect(missingQuestions(draft)).toEqual([]);
  });

  it('reads a birthday and a community puja', () => {
    expect(
      parseIntakeText("My son's 6th birthday, 30 kids, budget of 40000, grand", TODAY),
    ).toMatchObject({
      occasion: 'birthday',
      budget: 40000,
      guests: 30,
      vibe: 'Grand',
      guestMix: { kids: true },
    });
    const puja = parseIntakeText(
      'Society Ganpati festival for 500 people, wheelchair access needed, Jain food',
      TODAY,
    );
    expect(puja.occasion).toBe('community');
    expect(puja.guestMix.accessibility).toBe(true);
    expect(puja.dietary).toEqual(['Jain']);
  });

  it('asks only for what is missing, most important first', () => {
    const draft = parseIntakeText('a party', TODAY);
    expect(missingQuestions(draft).map((item) => item.field)).toEqual([
      'occasion',
      'budget',
      'guests',
      'eventDate',
      'priorities',
    ]);
    expect(parseIntakeText('budget 500', TODAY).budget).toBeNull();
  });
});

describe('drafts', () => {
  it('merges AI fields over rule-based ones', () => {
    const base = {
      ...EMPTY_DRAFT,
      budget: 500000,
      dietary: ['Jain'],
      guestMix: { kids: true, elders: false, accessibility: false },
    };
    const merged = mergeDrafts(base, {
      occasion: 'wedding',
      guests: 120,
      priorities: ['decor'],
      mustHaves: ['Live band'],
      dietary: ['Jain', 'Vegan'],
      guestMix: { kids: false, elders: true, accessibility: false },
    });
    expect(merged).toMatchObject({
      occasion: 'wedding',
      budget: 500000,
      guests: 120,
      priorities: ['decor'],
      mustHaves: ['Live band'],
      dietary: ['Jain', 'Vegan'],
      guestMix: { kids: true, elders: true, accessibility: false },
    });
    expect(mergeDrafts(base, {}).priorities).toEqual([]);
  });

  it('completes only when the essentials are present', () => {
    expect(completeIntake(EMPTY_DRAFT)).toBeNull();
    const intake = completeIntake({
      ...EMPTY_DRAFT,
      occasion: 'birthday',
      title: '  ',
      eventDate: '2026-12-01',
      budget: 40000,
      guests: 30,
    });
    expect(intake?.title).toBe('Birthday plan');
  });
});
