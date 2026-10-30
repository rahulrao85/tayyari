// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { budgetBand } from '../../src/components/plan/IdeasTab';
import { addDays } from '../../src/engine/dates';
import { toggleLock } from '../../src/engine/budget';
import { TODAY, weddingPlan } from '../helpers';
import { expectAccessible, fail, mockApi, ok, renderPlan } from './helpers';

const IDEAS = {
  themes: ['Marigold courtyard'],
  activities: ['Antakshari'],
  food: ['Live dosa'],
  touches: ['Seed-paper invites'],
  invitationLine: 'Join us!',
};

describe('plan view and tabs', () => {
  it('moves between tabs with arrow keys, Home and End, and every tab is accessible', async () => {
    const { user, container } = renderPlan();
    const overview = screen.getByRole('tab', { name: 'Overview' });
    expect(overview).toHaveAttribute('aria-selected', 'true');
    await expectAccessible(container);
    overview.focus();
    for (const name of ['Change desk', 'Budget', 'Timeline', 'Vendors', 'Ideas']) {
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name })).toHaveFocus();
      expect(await screen.findByRole('heading', { level: 2, name })).toBeInTheDocument();
      await expectAccessible(container);
    }
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Ideas' })).toHaveFocus();
    await user.keyboard('{Home}');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Ideas' })).toHaveFocus();
    await user.keyboard('a');
  });

  it('links insights to their tab and prints, resets and switches theme', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const { user } = renderPlan({ guests: 260 });
    await user.click(screen.getByRole('button', { name: 'Open Budget' }));
    expect(screen.getByRole('tab', { name: 'Budget' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: 'Print summary' }));
    expect(print).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    await user.click(screen.getByRole('button', { name: 'New plan' }));
    expect(
      screen.getByRole('heading', { level: 1, name: /^Over budget|Priya/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New plan' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('button', { name: 'Read my description' })).toBeInTheDocument();
  });
});

describe('ask about the plan', () => {
  it('answers with Gemini and falls back to the built-in planner', async () => {
    let calls = 0;
    mockApi({
      '/api/ask': () => (calls++ === 0 ? ok({ answer: 'Aapke paas ₹80,000 bacha hai.' }) : fail()),
    });
    const { user } = renderPlan();
    await user.click(screen.getByRole('button', { name: 'Kitna kharcha bacha hai?' }));
    expect(await screen.findByText('Aapke paas ₹80,000 bacha hai.')).toBeInTheDocument();
    expect(screen.getByText('Answered by Gemini 3.5 Flash')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Your question'), 'What should we do first?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText(/^Next up:/)).toBeInTheDocument();
    expect(screen.getByText('Built-in planner (AI unavailable)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ask' }));
  });
});

describe('budget tab', () => {
  it('edits an amount on Enter, caps it, locks a line and shows Estimate labels', async () => {
    const { user, container } = renderPlan();
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    const photo = screen.getByLabelText('Photo & video amount in rupees');
    await user.clear(photo);
    await user.type(photo, '1.2 lakh{Enter}');
    expect(screen.getAllByText(/Photo & video set to ₹1,20,000/)).not.toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Lock Photo & video' }));
    expect(screen.getByRole('button', { name: 'Lock Photo & video' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const venue = screen.getByLabelText('Venue amount in rupees');
    await user.clear(venue);
    await user.type(venue, '99 lakh');
    fireEvent.blur(venue);
    expect(screen.getAllByText(/capped at what the other categories can give/)).not.toHaveLength(0);
    expect(screen.getAllByText('Estimate').length).toBeGreaterThan(0);
    await expectAccessible(container);
  });

  it('explains when nothing can absorb a change', async () => {
    let plan = weddingPlan();
    for (const category of [
      'catering',
      'decor',
      'photography',
      'entertainment',
      'invitations',
      'logistics',
    ] as const) {
      plan = { ...plan, lines: toggleLock(plan.lines, category) };
    }
    const { user } = renderPlan(plan);
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    const venue = screen.getByLabelText('Venue amount in rupees');
    await user.clear(venue);
    await user.type(venue, '5000{Enter}');
    expect(screen.getAllByText(/Unlock another category first/)).not.toHaveLength(0);
    await user.type(venue, '{Enter}');
  });

  it('offers exact options when over budget, explains them and applies one', async () => {
    mockApi({
      '/api/explain': ok({
        summary: 'Food now needs more.',
        options: [{ id: 'trim', reading: 'Less decor, same food.' }],
      }),
    });
    const { user, container } = renderPlan({ guests: 260 });
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    expect(screen.getByRole('heading', { name: /Over budget by/ })).toBeInTheDocument();
    expect(screen.getByText(/per guest × 260 guests/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Explain these options in plain words' }));
    expect(await screen.findByText('Less decor, same food.')).toBeInTheDocument();
    await expectAccessible(container);
    await user.click(screen.getAllByRole('button', { name: 'Apply this option' })[0]!);
    expect(screen.queryByRole('heading', { name: /Over budget by/ })).not.toBeInTheDocument();
  });

  it('keeps exact options when the explanation fails, and shows quoted lines', async () => {
    mockApi({ '/api/explain': fail() });
    const plan = weddingPlan();
    const { user } = renderPlan({
      quotes: [
        {
          id: 'q',
          category: 'photography',
          vendor: 'Lens Co',
          pricing: 'flat',
          amount: 200000,
          guestMinimum: null,
          taxIncluded: true,
          advancePercent: null,
          cancellationPolicy: 'Yes',
          inclusions: [],
          accepted: true,
        },
      ],
      lines: plan.lines,
    });
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    expect(screen.getByText(/\(accepted quote\)/)).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Quoted')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Explain these options in plain words' }));
    expect(await screen.findByText(/only the plain-words reading needs AI/)).toBeInTheDocument();
  });
});

describe('timeline tab', () => {
  it('marks tasks done, records delays on Enter or blur and exports a calendar', async () => {
    const createObjectURL = vi.fn(() => 'blob:x');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { user, container } = renderPlan({ eventDate: addDays(TODAY, 60) });
    await user.click(screen.getByRole('tab', { name: 'Timeline' }));
    expect(screen.getByText(/squeezed by the same factor/)).toBeInTheDocument();
    const box = screen.getByRole('checkbox', { name: 'Book the venue' });
    await user.click(box);
    expect(box).toBeChecked();
    await user.click(box);
    const delay = screen.getByLabelText('Delay (days)', { selector: '#delay-venue' });
    await user.clear(delay);
    await user.type(delay, '30{Enter}');
    expect(screen.getAllByText(/because "Book the venue" slipped/).length).toBeGreaterThan(0);
    await user.type(delay, '{Enter}');
    const decor = screen.getByLabelText('Delay (days)', { selector: '#delay-decor' });
    await user.type(decor, 'x');
    fireEvent.blur(decor);
    await user.click(screen.getByRole('button', { name: 'Add all dates to my calendar (.ics)' }));
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(within(container).getAllByRole('link', { name: /Google Calendar/ })[0]).toHaveAttribute(
      'target',
      '_blank',
    );
    await expectAccessible(container);
  });

  it('describes a birthday runway without the six-month wording', async () => {
    const { user } = renderPlan({ occasion: 'birthday', eventDate: addDays(TODAY, 10) });
    await user.click(screen.getByRole('tab', { name: 'Timeline' }));
    expect(screen.getByText(/usual lead runway/)).toBeInTheDocument();
    expect(screen.getByText('Cake cutting')).toBeInTheDocument();
  });
});

describe('ideas tab', () => {
  it('shows Gemini ideas, then general ideas when AI fails', async () => {
    let calls = 0;
    mockApi({ '/api/ideas': () => (calls++ === 0 ? ok(IDEAS) : fail()) });
    const { user, container } = renderPlan();
    await user.click(screen.getByRole('tab', { name: 'Ideas' }));
    await user.click(await screen.findByRole('button', { name: 'Suggest ideas for us' }));
    expect(await screen.findByText('Marigold courtyard')).toBeInTheDocument();
    await expectAccessible(container);
    await user.click(screen.getByRole('button', { name: 'Suggest different ideas' }));
    expect(await screen.findByText(/These are general ideas/)).toBeInTheDocument();
  });

  it('bands budgets per guest', () => {
    expect(budgetBand({ ...weddingPlan(), budget: 100000, guests: 100 })).toBe('modest');
    expect(budgetBand({ ...weddingPlan(), budget: 300000, guests: 100 })).toBe('comfortable');
    expect(budgetBand({ ...weddingPlan(), budget: 900000, guests: 100 })).toBe('generous');
  });
});
