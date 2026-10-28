import type { Category, GuestMix, Occasion } from '../../schemas/plan';

/** A vendor the family will probably need, and what to ask before booking. */
export interface VendorNeed {
  category: Exclude<Category, 'contingency'>;
  vendor: string;
  questions: readonly string[];
}

const ASK_ALWAYS = ['Is GST included in this price?', 'What is the cancellation policy?'];

const CATERER: VendorNeed = {
  category: 'catering',
  vendor: 'Caterer',
  questions: [
    'Price per plate, and is there a minimum number of plates?',
    'Can we do a tasting before booking?',
    'Are service staff, crockery and counters included?',
    ...ASK_ALWAYS,
  ],
};

const PHOTOGRAPHER: VendorNeed = {
  category: 'photography',
  vendor: 'Photographer',
  questions: [
    'How many hours and how many photographers?',
    'When do we get edited photos, and how many?',
    ...ASK_ALWAYS,
  ],
};

export const VENDOR_NEEDS: Record<Occasion, readonly VendorNeed[]> = {
  wedding: [
    {
      category: 'venue',
      vendor: 'Venue',
      questions: [
        'What is the seated and floating capacity?',
        'Is power backup and parking included?',
        'Can we bring our own caterer and decorator?',
        ...ASK_ALWAYS,
      ],
    },
    CATERER,
    PHOTOGRAPHER,
    {
      category: 'decor',
      vendor: 'Decorator',
      questions: [
        'Are flowers fresh or artificial?',
        'Is set-up and removal included?',
        ...ASK_ALWAYS,
      ],
    },
    {
      category: 'entertainment',
      vendor: 'DJ or band',
      questions: [
        'How many hours, and what does overtime cost?',
        'Is the sound system included?',
        ...ASK_ALWAYS,
      ],
    },
  ],
  birthday: [
    {
      category: 'venue',
      vendor: 'Venue or party hall',
      questions: ['How many hours is the slot?', 'Is there a kids play area?', ...ASK_ALWAYS],
    },
    CATERER,
    {
      category: 'entertainment',
      vendor: 'Entertainer or games host',
      questions: ['Which age group are the games for?', 'How long is the act?', ...ASK_ALWAYS],
    },
    {
      category: 'decor',
      vendor: 'Balloon and theme decorator',
      questions: ['Can you match our theme?', 'How long does set-up take?', ...ASK_ALWAYS],
    },
  ],
  community: [
    {
      category: 'venue',
      vendor: 'Ground or hall',
      questions: [
        'Which permissions do you already hold?',
        'Are toilets and water included?',
        ...ASK_ALWAYS,
      ],
    },
    {
      category: 'logistics',
      vendor: 'Sound and lighting',
      questions: [
        'Is the system within the permitted decibel limit?',
        'Is a generator included?',
        ...ASK_ALWAYS,
      ],
    },
    CATERER,
    {
      category: 'decor',
      vendor: 'Pandal and decor',
      questions: [
        'Is the structure certified safe?',
        'Who handles fire extinguishers?',
        ...ASK_ALWAYS,
      ],
    },
    PHOTOGRAPHER,
  ],
};

/** Extra questions that come from who is coming. */
export function mixQuestions(mix: GuestMix): string[] {
  const questions: string[] = [];
  if (mix.elders) questions.push('Is there step-free access and seating for elders?');
  if (mix.kids) questions.push('Is there a safe, supervised space for children?');
  if (mix.accessibility) questions.push('Is there an accessible toilet and wheelchair route?');
  return questions;
}
