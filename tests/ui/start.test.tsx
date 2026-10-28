// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { validateIntake, valuesFromDraft } from '../../src/lib/intakeForm';
import { EMPTY_DRAFT } from '../../src/engine/intake';
import { TODAY } from '../helpers';
import { expectAccessible, fail, mockApi, ok, renderApp } from './helpers';

const EXTRACT = {
  occasion: 'wedding',
  title: 'Priya weds Arjun',
  eventDate: '2027-02-15',
  budget: 800000,
  guests: 200,
  priorities: ['catering'],
  vibe: 'Simple ceremony',
  mustHaves: [],
  guestMix: { kids: false, elders: true, accessibility: false },
  dietary: ['Vegetarian'],
  followUp: 'Will any elders need step-free access?',
};

describe('start screen', () => {
  it('reads a description with Gemini, asks only the follow-up, and builds the plan', async () => {
    const api = mockApi({ '/api/intake': ok(EXTRACT) });
    const { user, container } = renderApp();
    await expectAccessible(container);
    await user.click(screen.getByRole('button', { name: 'Try: Wedding' }));
    expect(screen.getByLabelText<HTMLTextAreaElement>('Describe your celebration').value).toContain(
      'Shaadi in Pune',
    );
    await user.click(screen.getByRole('button', { name: 'Read my description' }));
    expect(await screen.findByText('Will any elders need step-free access?')).toBeInTheDocument();
    expect(screen.getByText('Answered by Gemini 3.5 Flash')).toBeInTheDocument();
    expect(screen.getByLabelText('Name of the plan')).toHaveValue('Priya weds Arjun');
    expect(screen.getByText('= ₹8,00,000')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/api/intake', expect.objectContaining({ method: 'POST' }));
    await expectAccessible(container);
    await user.click(screen.getByRole('button', { name: 'Build my plan' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Priya weds Arjun' }),
    ).toHaveFocus();
    expect(screen.getByText('✓ Within budget')).toBeInTheDocument();
  });

  it('falls back to the built-in reader when AI is down and asks for what is missing', async () => {
    mockApi({ '/api/intake': fail() });
    const { user } = renderApp();
    await user.type(screen.getByLabelText('Describe your celebration'), 'a small get-together');
    await user.click(screen.getByRole('button', { name: 'Read my description' }));
    expect(await screen.findByText(/Built-in planner answered/)).toBeInTheDocument();
    expect(
      screen.getAllByText('What is the total budget you are comfortable with?'),
    ).not.toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Read my description' })).toBeInTheDocument();
  });

  it('validates the form with a focused error summary, then builds the plan', async () => {
    const { user, container } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Fill the form instead' }));
    await user.click(screen.getByRole('button', { name: 'Build my plan' }));
    const summary = await screen.findByRole('alert');
    expect(within(summary).getAllByRole('link')).toHaveLength(4);
    await expectAccessible(container);
    await user.click(screen.getByLabelText('Birthday'));
    await user.type(screen.getByLabelText('Event date'), '2026-12-20');
    await user.type(screen.getByLabelText('Total budget'), '40k');
    await user.type(screen.getByLabelText('Number of guests'), '30');
    await user.click(screen.getByLabelText('Games & activities'));
    await user.click(screen.getByLabelText('Children'));
    await user.type(screen.getByLabelText('Food habits'), 'Jain, Veg');
    await user.type(screen.getByLabelText('Must-haves'), 'Magician');
    await user.type(screen.getByLabelText('The feel you want'), 'Playful');
    await user.click(screen.getByLabelText('Games & activities'));
    await user.click(screen.getByLabelText('Games & activities'));
    await user.click(screen.getByRole('button', { name: 'Build my plan' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Birthday plan' }),
    ).toBeInTheDocument();
  });
});

describe('validateIntake', () => {
  const base = {
    ...valuesFromDraft(EMPTY_DRAFT),
    occasion: 'community' as const,
    eventDate: '2027-09-14',
    budget: '3 lakh',
    guests: '500',
  };

  it('accepts a complete form and tidies lists', () => {
    const result = validateIntake({ ...base, dietary: ' Jain ,, Veg ', mustHaves: '' }, TODAY);
    expect(result.intake).toMatchObject({
      budget: 300000,
      guests: 500,
      dietary: ['Jain', 'Veg'],
      title: 'Community plan',
    });
  });

  it('rejects past dates, tiny budgets, bad guest counts and too many priorities', () => {
    const result = validateIntake(
      {
        ...base,
        eventDate: '2020-01-01',
        budget: '500',
        guests: '0',
        priorities: ['venue', 'decor', 'catering', 'photography'],
      },
      TODAY,
    );
    expect(Object.keys(result.errors ?? {})).toEqual([
      'eventDate',
      'budget',
      'guests',
      'priorities',
    ]);
    expect(validateIntake({ ...base, eventDate: '2027-02-31' }, TODAY).errors).toEqual({
      eventDate: 'Check the date.',
    });
  });
});
