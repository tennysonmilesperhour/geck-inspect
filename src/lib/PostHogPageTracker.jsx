import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { capturePageview } from './posthog';
import { trackPageView } from './telemetry';

/**
 * Fires a PostHog $pageview event AND a Supabase user_events row every
 * time the React Router location changes. Needs to render inside
 * <Router>. Returns null — it has no UI.
 *
 * The Supabase row is what the in-app admin analytics dashboard slices
 * for daily-active-users, top pages, and feature usage. PostHog stays
 * for the off-app product-analytics workflows.
 */
export default function PostHogPageTracker() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname + location.search;
    capturePageview(path);
    const pageName = location.pathname.replace(/^\//, '').split('/')[0] || 'Home';
    trackPageView(pageName);
  }, [location]);
  return null;
}
