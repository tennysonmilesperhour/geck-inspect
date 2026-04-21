import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from './ga';

/**
 * Fires a GA4 `page_view` event on every React-Router navigation,
 * including the initial mount. Mirrors the existing
 * PostHogPageTracker pattern but writes to Google Analytics.
 *
 * Must render inside <Router>. Returns null — no UI.
 *
 * The gtag loader in index.html uses `send_page_view: false` so this
 * component is the single source of page_view events — no double-count
 * on the first render.
 */
export default function GA4PageTracker() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname + location.search;
    // Defer one tick so react-helmet-async can update document.title
    // before we read it. Without this, the very first page_view
    // carries the index.html default title instead of the route title.
    const t = setTimeout(() => trackPageView(path), 0);
    return () => clearTimeout(t);
  }, [location]);
  return null;
}
