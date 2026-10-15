import { MotionGlobalConfig } from 'framer-motion';

// The stylesheet already stops CSS animations for people who ask their
// device for reduced motion (index.css, prefers-reduced-motion). Framer
// Motion animates from JavaScript and ignores that CSS, so its slides,
// springs and layout moves kept running. This switch makes Framer Motion
// finish every animation instantly while the setting is on, and follows
// the setting if it changes while the app is open.
//
// Only the small shared config object is imported here, not the animation
// engine, so the first page load does not grow.
export function installReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = () => {
    MotionGlobalConfig.skipAnimations = query.matches;
  };
  apply();
  if (typeof query.addEventListener === 'function') query.addEventListener('change', apply);
}
