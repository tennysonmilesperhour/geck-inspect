import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { capturePageview } from './posthog';

/**
 * Fires a PostHog $pageview event every time the React Router location
 * changes. Needs to render inside <Router>. Returns null — it has no UI.
 */
export default function PostHogPageTracker() {
  const location = useLocation();
  useEffect(() => {
    capturePageview(location.pathname + location.search);
  }, [location]);
  return null;
}
