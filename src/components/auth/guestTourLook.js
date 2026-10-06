import { Compass, Heart, LayoutGrid, Sparkles, TrendingUp, Users } from 'lucide-react';

// Icon and accent color for each guided demo tour (see src/lib/guestTour.js).
export const TOUR_LOOK = {
  quick: { Icon: Compass, chip: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30' },
  collection: { Icon: LayoutGrid, chip: 'bg-sky-500/15 text-sky-300 ring-sky-400/30' },
  breeding: { Icon: Heart, chip: 'bg-rose-500/15 text-rose-300 ring-rose-400/30' },
  morphs: { Icon: Sparkles, chip: 'bg-violet-500/15 text-violet-300 ring-violet-400/30' },
  market: { Icon: TrendingUp, chip: 'bg-amber-500/15 text-amber-300 ring-amber-400/30' },
  community: { Icon: Users, chip: 'bg-teal-500/15 text-teal-300 ring-teal-400/30' },
};

/** Rough length of a tour: about 15 seconds a stop, never under a minute. */
export const tourMinutes = (tour) => Math.max(1, Math.round((tour.steps.length * 15) / 60));
