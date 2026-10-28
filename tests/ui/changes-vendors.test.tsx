// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { roughQuote } from '../../src/components/plan/QuoteForm';
import { toggleLock } from '../../src/engine/budget';
import { weddingPlan } from '../helpers';
import { expectAccessible, fail, mockApi, ok, renderPlan } from './helpers';

const CHANGE = {
  budget: { mode: 'delta', amount: -50000 },
  guests: null,
  date: { mode: 'shift', days: -14 },
  priorities: null,
  summary: 'Reduce the budget by ₹50,000 and move the event two weeks earlier.',
};

describe('change desk', () => {
  it('previews the explainer change with Gemini, adjusts with an option, accepts and undoes', async () => {
    mockApi({ '/api/change': ok(CHANGE) });
    const { user, container } = renderPlan();
    await user.click(screen.getByRole('tab', { name: 'Change desk' }));
    await user.click(
      await screen.findByRole('button', {
        name: 'Budget is ₹50k less and the event is 2 weeks earlier',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Preview the change' }));
    expect(await screen.findByText(CHANGE.summary)).toBeInTheDocument();
    expect(screen.getByText('Understood by Gemini 3.5 Flash')).toBeInTheDocument();
    const before = screen.getByRole('table', { name: 'Before and after' });
    expect(within(before).getByText('₹7,50,000')).toBeInTheDocument();
    expect(within(before).getByText('14-Feb-2027')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Budget lines that move' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Tasks that move/ })).toBeInTheDocument();
    await expectAccessible(container);
    await user.click(screen.getAllByRole('button', { name: 'Apply this option' })[1]!);
    expect(screen.queryByRole('heading', { name: /Over budget by/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept this version' }));
    expect(
      screen.getAllByText(/Change: Budget ₹7,50,000, Date 14-Feb-2027, Use the contingency buffer/),
    ).not.toHaveLength(0);
    expect(screen.getByText(/₹7.5 L/)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Undo last change' })[1]!);
    expect(screen.getByText(/₹8 L/)).toBeInTheDocument();
    expect(screen.getByText(/No changes yet/)).toBeInTheDocument();
  });

  it('uses the built-in parser when AI fails or finds nothing, and can discard', async () => {
    let calls = 0;
    mockApi({
      '/api/change': () =>
        calls++ === 0
          ? fail()
          : ok({ budget: null, guests: null, date: null, priorities: null, summary: '' }),
    });
    const { user } = renderPlan();
    await user.click(screen.getByRole('tab', { name: 'Change desk' }));
    const box = await screen.findByLabelText('What changed?');
    await user.type(box, '30 more guests');
    await user.click(screen.getByRole('button', { name: 'Preview the change' }));
    expect(await screen.findByText('Read as: 230 guests.')).toBeInTheDocument();
    expect(screen.getByText('Read by the built-in parser')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await user.click(screen.getByRole('button', { name: 'Preview the change' }));
    expect(await screen.findByText('Read as: 230 guests.')).toBeInTheDocument();
  });

  it('explains when nothing changed, when nothing was found, and when locks block a budget', async () => {
    mockApi({ '/api/change': fail() });
    const plan = { ...weddingPlan(), lines: toggleLock(weddingPlan().lines, 'catering') };
    const { user } = renderPlan(plan);
    await user.click(screen.getByRole('tab', { name: 'Change desk' }));
    const box = await screen.findByLabelText('What changed?');
    await user.type(box, 'nothing really');
    await user.click(screen.getByRole('button', { name: 'Preview the change' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not find a change/);
    await user.clear(box);
    await user.type(box, 'new budget is 5000');
    await user.click(screen.getByRole('button', { name: 'Preview the change' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Locked categories/);
    await user.clear(box);
    await user.type(box, 'make it 200 people');
    await user.click(screen.getByRole('button', { name: 'Preview the change' }));
    expect(
      await screen.findByText('This change does not move anything in your plan.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'See the full timeline' }));
    expect(screen.getByRole('tab', { name: 'Timeline' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('vendors', () => {
  it('reads a pasted quote with Gemini, flags it, accepts it and copies a follow-up', async () => {
    mockApi({
      '/api/quote': ok({
        vendor: 'Annapurna Caterers',
        pricing: 'per_guest',
        amount: 1500,
        guestMinimum: 250,
        taxIncluded: null,
        advancePercent: 60,
        cancellationPolicy: null,
        inclusions: [],
      }),
    });
    const { user, container } = renderPlan();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    await user.click(await screen.findByRole('button', { name: 'Add a quote for Caterer' }));
    await user.type(
      screen.getByLabelText(/Paste the quote/),
      '₹1500 per plate, minimum 250 plates, 60% advance',
    );
    await user.click(screen.getByRole('button', { name: 'Read the quote' }));
    expect(await screen.findByDisplayValue('Annapurna Caterers')).toBeInTheDocument();
    await expectAccessible(container);
    await user.click(screen.getByRole('button', { name: 'Save quote' }));
    expect(screen.getByText(/real cost ₹3,75,000/)).toBeInTheDocument();
    expect(screen.getByText(/Minimum 250 plates/)).toBeInTheDocument();
    expect(screen.getByText(/GST is not mentioned/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept Annapurna Caterers' }));
    expect(screen.getByText('Quote accepted')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy follow-up message' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('whether GST is included'));
    expect(await screen.findByRole('button', { name: 'Copied follow-up' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Annapurna Caterers' }));
    expect(screen.queryByText(/real cost ₹/)).not.toBeInTheDocument();
  });

  it('falls back to a rough reading, edits fields, requires a price and can cancel', async () => {
    mockApi({ '/api/quote': fail() });
    const { user } = renderPlan();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    await user.click(await screen.findByRole('button', { name: 'Add a quote for Photographer' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Add a quote for Photographer' }));
    await user.type(screen.getByLabelText(/Paste the quote/), 'Full day shoot, price on call');
    await user.click(screen.getByRole('button', { name: 'Read the quote' }));
    expect(await screen.findByText(/Read by the built-in parser/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save quote' }));
    expect(screen.getByText('Enter the price before saving.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Vendor'), 'Lens Co');
    await user.type(screen.getByLabelText('Total price (₹)'), '90000');
    await user.selectOptions(screen.getByLabelText('Priced'), 'per_guest');
    await user.selectOptions(screen.getByLabelText('Priced'), 'flat');
    await user.type(screen.getByLabelText('Minimum guests (if any)'), '0');
    await user.selectOptions(screen.getByLabelText('GST'), 'false');
    await user.selectOptions(screen.getByLabelText('GST'), 'true');
    await user.selectOptions(screen.getByLabelText('GST'), 'unknown');
    fireEvent.change(screen.getByLabelText('Cancellation policy'), { target: { value: '  ' } });
    fireEvent.change(screen.getByLabelText('Cancellation policy'), {
      target: { value: 'Refund till 30 days' },
    });
    await user.click(screen.getByRole('button', { name: 'Save quote' }));
    expect(screen.getByText(/real cost ₹90,000/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy follow-up message' }));
    expect(screen.getByRole('button', { name: 'Copy follow-up message' })).toBeInTheDocument();
  });

  it('roughly reads amounts, per-plate pricing, minimums and GST without AI', () => {
    expect(roughQuote('₹1,200 per plate, min 150 plates, GST extra')).toMatchObject({
      pricing: 'per_guest',
      amount: 1200,
      guestMinimum: 150,
      taxIncluded: false,
    });
    expect(roughQuote('Package 2 lakh inclusive of GST').taxIncluded).toBe(true);
    expect(roughQuote('no numbers').amount).toBe(0);
  });

  it('shows elder and accessibility questions for the venue', async () => {
    const { user } = renderPlan({ guestMix: { kids: true, elders: true, accessibility: true } });
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    expect(
      await screen.findByText('Is there step-free access and seating for elders?'),
    ).toBeInTheDocument();
  });
});
