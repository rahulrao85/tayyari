import type { Category, Occasion } from '../../schemas/plan';

/** A planning task with the number of days before the event it should be done. */
export interface TaskTemplate {
  id: string;
  title: string;
  leadDays: number;
  dependsOn: readonly string[];
  category: Category | null;
}

/** What a task waits for, and which budget line it books. */
interface TaskLinks {
  after?: readonly string[];
  books?: Category;
}

/** Builds a task template; `after` lists the tasks that must be done first. */
const task = (
  id: string,
  title: string,
  leadDays: number,
  links: TaskLinks = {},
): TaskTemplate => ({
  id,
  title,
  leadDays,
  dependsOn: links.after ?? [],
  category: links.books ?? null,
});

/** Typical Indian lead times. Dependencies always have a longer lead time. */
export const TASK_TEMPLATES: Record<Occasion, readonly TaskTemplate[]> = {
  wedding: [
    task('date', 'Fix the date and muhurat with both families', 180),
    task('budget', 'Agree the budget and what matters most', 175, { after: ['date'] }),
    task('venue', 'Book the venue', 160, { after: ['budget'], books: 'venue' }),
    task('caterer', 'Taste-test and book the caterer', 120, {
      after: ['venue'],
      books: 'catering',
    }),
    task('photo', 'Book photographer and videographer', 110, {
      after: ['date'],
      books: 'photography',
    }),
    task('decor', 'Finalise decor and flowers', 90, { after: ['venue'], books: 'decor' }),
    task('guests', 'Finalise the guest list', 75, { after: ['budget'] }),
    task('music', 'Book DJ, band or sangeet choreographer', 70, {
      after: ['venue'],
      books: 'entertainment',
    }),
    task('invites', 'Send invitations', 45, { after: ['guests', 'venue'], books: 'invitations' }),
    task('travel', 'Arrange guest transport and stays', 40, {
      after: ['guests'],
      books: 'logistics',
    }),
    task('menu', 'Confirm the final menu and headcount', 14, {
      after: ['caterer', 'guests'],
      books: 'catering',
    }),
    task('runsheet', 'Share the day-of run sheet with vendors', 5, {
      after: ['menu', 'decor', 'music'],
    }),
    task('payments', 'Settle vendor balances and keep receipts', 2, { after: ['runsheet'] }),
  ],
  birthday: [
    task('theme', 'Pick the theme with the birthday person', 45),
    task('budget', 'Set the budget and what matters most', 42, { after: ['theme'] }),
    task('venue', 'Book the venue or prepare home space', 35, {
      after: ['budget'],
      books: 'venue',
    }),
    task('guests', 'Make the guest list', 30, { after: ['budget'] }),
    task('food', 'Order the cake and food', 21, { after: ['venue', 'guests'], books: 'catering' }),
    task('activities', 'Book games, entertainer or activities', 21, {
      after: ['venue'],
      books: 'entertainment',
    }),
    task('invites', 'Send invitations', 20, { after: ['guests', 'venue'], books: 'invitations' }),
    task('decor', 'Buy or book decorations', 14, { after: ['theme', 'venue'], books: 'decor' }),
    task('photo', 'Arrange a photographer or a family member', 10, {
      after: ['venue'],
      books: 'photography',
    }),
    task('gifts', 'Prepare return gifts', 7, { after: ['guests'], books: 'invitations' }),
    task('confirm', 'Confirm headcount with the venue and caterer', 3, {
      after: ['food', 'invites'],
    }),
    task('runsheet', 'Plan the party schedule hour by hour', 2, {
      after: ['activities', 'confirm'],
    }),
  ],
  community: [
    task('committee', 'Form the organising committee and roles', 90),
    task('budget', 'Agree the budget and contribution plan', 85, { after: ['committee'] }),
    task('venue', 'Book the ground or hall', 75, { after: ['budget'], books: 'venue' }),
    task('permits', 'Apply for police, sound and fire permissions', 60, {
      after: ['venue'],
      books: 'logistics',
    }),
    task('volunteers', 'Recruit volunteers and assign shifts', 45, { after: ['committee'] }),
    task('program', 'Book performers and plan the programme', 45, {
      after: ['venue'],
      books: 'entertainment',
    }),
    task('caterer', 'Book food stalls or bhandara caterer', 40, {
      after: ['venue'],
      books: 'catering',
    }),
    task('decor', 'Book pandal, lighting and decor', 35, { after: ['venue'], books: 'decor' }),
    task('publicity', 'Print posters and share invites in groups', 25, {
      after: ['program'],
      books: 'invitations',
    }),
    task('photo', 'Arrange photo and video coverage', 20, {
      after: ['program'],
      books: 'photography',
    }),
    task('safety', 'Plan crowd flow, first aid and lost-and-found', 10, {
      after: ['permits', 'volunteers'],
    }),
    task('runsheet', 'Share the run sheet with every volunteer', 3, {
      after: ['safety', 'program'],
    }),
    task('accounts', 'Publish accounts of contributions and spend', 0, { after: ['runsheet'] }),
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
