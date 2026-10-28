import type { Category, Occasion } from '../../schemas/plan';

/**
 * Starting split of the budget, in percent, per occasion. These are planning
 * estimates, not market prices, and every amount stays editable.
 */
export const PRESET_SPLIT: Record<Occasion, Record<Category, number>> = {
  wedding: {
    venue: 20,
    catering: 35,
    decor: 12,
    photography: 10,
    entertainment: 6,
    invitations: 4,
    logistics: 3,
    contingency: 10,
  },
  birthday: {
    venue: 15,
    catering: 30,
    decor: 15,
    photography: 6,
    entertainment: 18,
    invitations: 3,
    logistics: 3,
    contingency: 10,
  },
  community: {
    venue: 15,
    catering: 25,
    decor: 15,
    photography: 4,
    entertainment: 15,
    invitations: 4,
    logistics: 12,
    contingency: 10,
  },
};

/** Fixed share kept aside for surprises. */
export const CONTINGENCY_PERCENT = 10;

/** Weight multiplier for a category the family says matters most. */
export const PRIORITY_BOOST = 1.25;

const BASE_LABELS: Record<Category, string> = {
  venue: 'Venue',
  catering: 'Food & catering',
  decor: 'Decor & flowers',
  photography: 'Photo & video',
  entertainment: 'Music & entertainment',
  invitations: 'Invitations & gifts',
  logistics: 'Transport & logistics',
  contingency: 'Contingency buffer',
};

const OVERRIDES: Record<Occasion, Partial<Record<Category, string>>> = {
  wedding: { entertainment: 'Mehendi, sangeet & music' },
  birthday: { entertainment: 'Games & activities', invitations: 'Invites & return gifts' },
  community: {
    entertainment: 'Programme & performers',
    invitations: 'Publicity & passes',
    logistics: 'Permits, sound & safety',
  },
};

/** Occasion-aware label for a budget category. */
export function categoryLabel(category: Category, occasion: Occasion): string {
  return OVERRIDES[occasion][category] ?? BASE_LABELS[category];
}

/** Occasion display names. */
export const OCCASION_LABEL: Record<Occasion, string> = {
  wedding: 'Wedding',
  birthday: 'Birthday',
  community: 'Community event',
};

/** GST applied when a quote says tax is extra. */
export const GST_RATE = 0.18;
