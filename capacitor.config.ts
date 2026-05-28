import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor config for the Geck Inspect mobile shell. The web app
// (built by Vite into ./dist) is wrapped as a WebView-backed native
// app and shipped to Google Play and the App Store.
//
// Keep `appId` stable forever: this is the Android package name and
// the iOS bundle id. Changing it after the first store upload means
// shipping a brand-new listing.
const config: CapacitorConfig = {
  appId: 'com.geckinspect.app',
  appName: 'Geck Inspect',
  webDir: 'dist',
  server: {
    // Capacitor serves the bundled web app from inside the APK over
    // the capacitor:// scheme; androidScheme keeps cookies and
    // service workers happy across origins.
    androidScheme: 'https',
  },
  android: {
    // allowMixedContent stays false: every Geck Inspect URL is https,
    // and mixed content is what gets Play Store warnings in pre-launch
    // reports.
    allowMixedContent: false,
  },
};

export default config;
