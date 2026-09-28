import { installNativeAuth } from '@/lib/nativeAuth';
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import ErrorBoundary from '@/components/ErrorBoundary'
import { initPostHog } from '@/lib/posthog'
import { installGlobalErrorHandlers } from '@/lib/telemetry'
import { registerServiceWorker } from '@/lib/serviceWorker'
import { installTranslationGuard } from '@/lib/translationGuard'

// Initialize PostHog as early as possible so autocapture picks up the
// very first click. No-op if VITE_POSTHOG_KEY isn't set.
initPostHog();

// Capture uncaught errors + unhandled promise rejections into Supabase so
// the admin error log shows real-world failures, not just what the
// ErrorBoundary catches.
installGlobalErrorHandlers();

// Register the push-handling service worker eagerly. iOS needs the
// worker in place before the page can even ASK for Notification
// permission from an installed PWA, so we don't defer this to the
// moment the user flips the Settings toggle.
registerServiceWorker();
installNativeAuth().catch(() => console.warn('Native sign-in listener could not start.'));

// Keep the app alive when a visitor uses the browser's page translation.
// See translationGuard.js for why this crashed sign-up and the dashboard.
installTranslationGuard();

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}