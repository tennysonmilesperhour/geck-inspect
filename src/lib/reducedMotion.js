// The stylesheet already stops CSS animations for people who ask their
// device for reduced motion (index.css, prefers-reduced-motion). Framer
// Motion animates from JavaScript and ignores that CSS, so its slides,
// springs and layout moves kept running. This switch makes Framer Motion
// finish every animation instantly while the setting is on, and follows
// the setting if it changes while the app is open.
//
// Framer Motion is only loaded here when the setting is on (or turns on).
// A plain import put Framer Motion's whole index into the code every page
// shares, which tied that shared file to every animation the app uses.
// The pages that animate import the same module, so the switch reaches
// them; at worst one animation that starts in the first moment plays.
// Naming the one export in the .then lets the build leave the rest out.
const loadMotionConfig = () => import('framer-motion').then(({ MotionGlobalConfig }) => ({ MotionGlobalConfig }));

export function installReducedMotion(loadMotion = loadMotionConfig) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  let loaded = null;
  const apply = () => {
    if (!query.matches && !loaded) return;
    (loaded ||= loadMotion())
      .then(({ MotionGlobalConfig }) => { MotionGlobalConfig.skipAnimations = query.matches; })
      .catch(() => { loaded = null; });
  };
  apply();
  if (typeof query.addEventListener === 'function') query.addEventListener('change', apply);
}
