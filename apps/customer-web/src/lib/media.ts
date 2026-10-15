/**
 * Storefront photography that is not uploaded by a vendor.
 *
 * Kitchen and dish photos come from the API (S3 / Spaces). Hero and cover
 * fallbacks live in `public/media` so a dead remote URL cannot blank the home
 * screen.
 */

/** IIT Kharagpur scenes for the home hero — one photo per time of day. */
export const CAMPUS_BY_PERIOD = {
  morning: {
    src: '/media/iit-main.jpg',
    alt: 'IIT Kharagpur Main Building in the morning',
    object: 'object-[center_42%]',
  },
  noon: {
    src: '/media/iit-lawn.jpg',
    alt: 'IIT Kharagpur campus at noon',
    object: 'object-[center_60%]',
  },
  evening: {
    src: '/media/iit-night.jpg',
    alt: 'IIT Kharagpur campus in the evening',
    object: 'object-center',
  },
} as const;

export type CampusPeriod = keyof typeof CAMPUS_BY_PERIOD;

/** Morning 05–11, noon 12–16, evening/night 17–04. */
export function campusPeriod(hour = new Date().getHours()): CampusPeriod {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'noon';
  return 'evening';
}

export function campusHeroScene(hour = new Date().getHours()) {
  return CAMPUS_BY_PERIOD[campusPeriod(hour)];
}

export const CAMPUS_HERO = CAMPUS_BY_PERIOD.morning.src;

export const PREPARING_KITCHEN = '/media/paneer.jpg';

const COVER_BY_SLUG: Record<string, string> = {
  'sharma-ji-ka-dhaba': '/media/paneer.jpg',
  'anita-rolls-momos': '/media/rolls.jpg',
};

export const DEFAULT_COVER = '/media/paneer.jpg';

export function kitchenCover(vendor: {
  slug: string;
  coverUrl?: string | null;
  logoUrl?: string | null;
}): { src: string; fallback: string } {
  const fallback = COVER_BY_SLUG[vendor.slug] ?? DEFAULT_COVER;
  return {
    src: vendor.coverUrl || vendor.logoUrl || fallback,
    fallback,
  };
}

export const CURATED_TILES = [
  {
    title: 'High Protein',
    subtitle: 'Bowls that last a lecture',
    href: '/search?q=paneer',
    image: '/media/paneer.jpg',
  },
  {
    title: 'Under ₹80',
    subtitle: 'Budget friendly',
    href: '/search?q=roll',
    image: '/media/rolls.jpg',
  },
  {
    title: 'Late night',
    subtitle: 'Open after labs',
    href: '/search?q=momos',
    image: '/media/iit-night.jpg',
  },
] as const;

export const OFFER_TILES = [
  {
    title: 'Combo Meals',
    subtitle: 'Starting ₹149',
    href: '/search?q=thali',
    image: '/media/paneer.jpg',
  },
  {
    title: 'Meal Plans',
    subtitle: 'Save up to 30%',
    href: '/offers',
    image: '/media/iit-lawn.jpg',
  },
] as const;

export function etaRange(prepMinutes: number): string {
  const low = Math.max(10, prepMinutes - 5);
  const high = prepMinutes + 8;
  return `${low}–${high} min`;
}
