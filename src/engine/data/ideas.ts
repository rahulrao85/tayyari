import type { GuestMix, Occasion } from '../../schemas/plan';
import type { Ideas } from '../../schemas/api';

const BASE: Record<Occasion, Ideas> = {
  wedding: {
    themes: [
      'Marigold and mango-leaf traditional',
      'Pastel garden day wedding',
      'Heritage haveli evening',
    ],
    activities: [
      'Family antakshari at the sangeet',
      'A memory wall of both families',
      'Live mehendi corner',
    ],
    food: [
      'Regional thali from both sides',
      'Live chaat and dosa counters',
      'Paan and kulfi send-off',
    ],
    touches: [
      'Handwritten welcome notes in rooms',
      'Seed-paper invitations',
      'A slideshow of how they met',
    ],
    invitationLine: 'With the blessings of our elders, we invite you to celebrate with us.',
  },
  birthday: {
    themes: ['Jungle safari', 'Space explorers', 'Colour-splash art party'],
    activities: [
      'Treasure hunt with clues',
      'Craft corner with take-home art',
      'Musical chairs and passing the parcel',
    ],
    food: [
      'Mini pav bhaji and sliders',
      'Fruit skewers and popsicles',
      'A theme cake with a small eggless option',
    ],
    touches: [
      'Photo booth with theme props',
      'Return gifts the kids made',
      'A wish jar for the birthday child',
    ],
    invitationLine: 'Come play, eat cake and make the day extra special!',
  },
  community: {
    themes: [
      'Eco-friendly clay and flowers',
      'Heritage of our neighbourhood',
      'Lights and rangoli',
    ],
    activities: [
      'Children’s drawing contest',
      'Bhajan sandhya with local singers',
      'Rangoli competition by building',
    ],
    food: [
      'Community bhandara with volunteers',
      'Prasad counters with queue lanes',
      'Home-chef stalls from residents',
    ],
    touches: [
      'Thank-you board for volunteers',
      'Plant saplings as prasad',
      'A transparent accounts board',
    ],
    invitationLine: 'Everyone in the neighbourhood is welcome. Come celebrate together!',
  },
};

/** Ideas used when AI is unavailable, adjusted for who is coming. Labelled as general ideas in the UI. */
export function fallbackIdeas(occasion: Occasion, mix: GuestMix): Ideas {
  const ideas = BASE[occasion];
  const extra: string[] = [];
  if (mix.elders) extra.push('Comfortable seating near the stage for elders');
  if (mix.kids) extra.push('A supervised kids corner with quiet games');
  if (mix.accessibility) extra.push('Step-free routes and an accessible washroom');
  return { ...ideas, touches: [...extra, ...ideas.touches].slice(0, 5) };
}
