import type { Category, Occasion } from '../../schemas/plan';

/** A planning task with the number of days before the event it should be done. */
export interface TaskTemplate {
  id: string;
  title: string;
  leadDays: number;
  dependsOn: readonly string[];
  category: Category | null;
}

const t = (
  id: string,
  title: string,
  leadDays: number,
  dependsOn: readonly string[] = [],
  category: Category | null = null,
): TaskTemplate => ({ id, title, leadDays, dependsOn, category });

/** Typical Indian lead times. Dependencies always have a longer lead time. */
export const TASK_TEMPLATES: Record<Occasion, readonly TaskTemplate[]> = {
  wedding: [
    t('date', 'Fix the date and muhurat with both families', 180),
    t('budget', 'Agree the budget and what matters most', 175, ['date']),
    t('venue', 'Book the venue', 160, ['budget'], 'venue'),
    t('caterer', 'Taste-test and book the caterer', 120, ['venue'], 'catering'),
    t('photo', 'Book photographer and videographer', 110, ['date'], 'photography'),
    t('decor', 'Finalise decor and flowers', 90, ['venue'], 'decor'),
    t('guests', 'Finalise the guest list', 75, ['budget']),
    t('music', 'Book DJ, band or sangeet choreographer', 70, ['venue'], 'entertainment'),
    t('invites', 'Send invitations', 45, ['guests', 'venue'], 'invitations'),
    t('travel', 'Arrange guest transport and stays', 40, ['guests'], 'logistics'),
    t('menu', 'Confirm the final menu and headcount', 14, ['caterer', 'guests'], 'catering'),
    t('runsheet', 'Share the day-of run sheet with vendors', 5, ['menu', 'decor', 'music']),
    t('payments', 'Settle vendor balances and keep receipts', 2, ['runsheet']),
  ],
  birthday: [
    t('theme', 'Pick the theme with the birthday person', 45),
    t('budget', 'Set the budget and what matters most', 42, ['theme']),
    t('venue', 'Book the venue or prepare home space', 35, ['budget'], 'venue'),
    t('guests', 'Make the guest list', 30, ['budget']),
    t('food', 'Order the cake and food', 21, ['venue', 'guests'], 'catering'),
    t('activities', 'Book games, entertainer or activities', 21, ['venue'], 'entertainment'),
    t('invites', 'Send invitations', 20, ['guests', 'venue'], 'invitations'),
    t('decor', 'Buy or book decorations', 14, ['theme', 'venue'], 'decor'),
    t('photo', 'Arrange a photographer or a family member', 10, ['venue'], 'photography'),
    t('gifts', 'Prepare return gifts', 7, ['guests'], 'invitations'),
    t('confirm', 'Confirm headcount with the venue and caterer', 3, ['food', 'invites']),
    t('runsheet', 'Plan the party schedule hour by hour', 2, ['activities', 'confirm']),
  ],
  community: [
    t('committee', 'Form the organising committee and roles', 90),
    t('budget', 'Agree the budget and contribution plan', 85, ['committee']),
    t('venue', 'Book the ground or hall', 75, ['budget'], 'venue'),
    t('permits', 'Apply for police, sound and fire permissions', 60, ['venue'], 'logistics'),
    t('volunteers', 'Recruit volunteers and assign shifts', 45, ['committee']),
    t('program', 'Book performers and plan the programme', 45, ['venue'], 'entertainment'),
    t('caterer', 'Book food stalls or bhandara caterer', 40, ['venue'], 'catering'),
    t('decor', 'Book pandal, lighting and decor', 35, ['venue'], 'decor'),
    t('publicity', 'Print posters and share invites in groups', 25, ['program'], 'invitations'),
    t('photo', 'Arrange photo and video coverage', 20, ['program'], 'photography'),
    t('safety', 'Plan crowd flow, first aid and lost-and-found', 10, ['permits', 'volunteers']),
    t('runsheet', 'Share the run sheet with every volunteer', 3, ['safety', 'program']),
    t('accounts', 'Publish accounts of contributions and spend', 0, ['runsheet']),
  ],
};

/** Suggested schedule for the day itself, to adjust to the venue slot. */
export const RUN_SHEET: Record<Occasion, readonly { time: string; item: string }[]> = {
  wedding: [
    { time: '08:00', item: 'Vendors arrive: decor, catering, sound' },
    { time: '10:30', item: 'Baraat assembles' },
    { time: '12:00', item: 'Ceremony per the muhurat' },
    { time: '13:30', item: 'Lunch service opens' },
    { time: '19:00', item: 'Reception and dinner' },
    { time: '22:30', item: 'Vendor wrap-up and final payments' },
  ],
  birthday: [
    { time: '15:00', item: 'Decor set up, music check' },
    { time: '16:00', item: 'Guests arrive, welcome activity' },
    { time: '16:45', item: 'Games or entertainer' },
    { time: '17:30', item: 'Cake cutting' },
    { time: '17:45', item: 'Food served' },
    { time: '18:45', item: 'Return gifts and goodbyes' },
  ],
  community: [
    { time: '06:00', item: 'Volunteer briefing and stall set-up' },
    { time: '08:00', item: 'Opening ceremony or puja' },
    { time: '11:00', item: 'Cultural programme, first half' },
    { time: '13:00', item: 'Bhandara or food stalls open' },
    { time: '18:00', item: 'Evening programme and aarti' },
    { time: '21:30', item: 'Clean-up crew and lost-and-found desk' },
  ],
};
