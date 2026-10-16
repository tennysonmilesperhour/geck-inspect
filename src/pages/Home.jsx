import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { captureEvent, ensurePostHog } from '@/lib/posthog';
import { HOMEPAGE_FLAG, HOMEPAGE_TIMEOUT_MS, homepageEligible, homepagePreview, isHomepagePreview, readHomepageVariant, rememberHomepageExposure } from '@/lib/homepageExperiment';
import HomeControl from './HomeControl';

const ENABLED = import.meta.env.VITE_HOMEPAGE_EXPERIMENT_ENABLED === '1';

/** Both experimental arms share the same allocation and asset readiness gate. */
export default function Home() {
  const { isAuthenticated, isGuest, isLoadingAuth } = useAuth();
  const { search } = useLocation();
  const preview = homepagePreview(search);
  const [selection, setSelection] = useState(null);
  const exposed = useRef(false);
  const settled = useRef(false);
  const eligible = homepageEligible({
    hostname: window.location.hostname, isAuthenticated, isGuest, isLoadingAuth,
    doNotTrack: navigator.doNotTrack, userAgent: navigator.userAgent,
    webdriver: navigator.webdriver, preview: isHomepagePreview(),
  });
  const pending = !selection && (preview || (ENABLED && (eligible || isLoadingAuth)));

  useEffect(() => {
    if (settled.current || (!preview && !ENABLED)) return;
    let current = true;
    const controller = new AbortController();
    const fallback = () => {
      controller.abort();
      if (current) { settled.current = true; setSelection({ variant: 'control', enrolled: false }); }
    };
    // Both variants have the same bounded allocation wait. Late flags never
    // replace a homepage someone has already started reading.
    const timer = setTimeout(fallback, HOMEPAGE_TIMEOUT_MS);
    async function select() {
      if (!preview && (!ENABLED || !eligible)) return;
      try {
        const [variant, business] = await Promise.all([
          preview || ensurePostHog().then(client => readHomepageVariant(client, controller.signal)),
          import('@/components/landing/business/BusinessHome'),
        ]);
        if (!variant) return fallback();
        const Component = variant === 'business' ? business.default : HomeControl;
        if (!current || controller.signal.aborted) return;
        clearTimeout(timer);
        settled.current = true;
        setSelection({ variant, Component, enrolled: !preview && eligible });
      } catch { fallback(); }
    }
    void select();
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [preview, eligible]);

  useEffect(() => {
    if (!selection?.enrolled || exposed.current || !eligible) return;
    // Fires after the selected React page commits. Reading a flag alone is not
    // an exposure. Strict-mode rerenders do not double-count this mount.
    exposed.current = true;
    rememberHomepageExposure(selection.variant);
    captureEvent('$experiment_exposure', {
      $feature_flag: HOMEPAGE_FLAG,
      $feature_flag_response: selection.variant,
      [`$feature/${HOMEPAGE_FLAG}`]: selection.variant,
      homepage_experiment: HOMEPAGE_FLAG,
      homepage_variant: selection.variant,
      homepage_rendered: true,
    });
  }, [selection, eligible]);

  if (pending) return <div className="min-h-screen bg-[#060e0b] text-white grid place-items-center" role="status" aria-live="polite"><div className="text-center"><img src="/logo-96.png" width="48" height="48" alt="" className="mx-auto mb-3" /><p>Opening Geck Inspect…</p></div></div>;
  const Selected = selection?.Component || HomeControl;
  return <Selected />;
}
