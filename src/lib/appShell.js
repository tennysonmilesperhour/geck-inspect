import { createContext, useContext } from 'react';

/**
 * True for anything rendered inside the app Layout's content area (signed
 * in or guest demo). Public pages that carry their own marketing chrome
 * (logo bar with a Sign In button, footer) read it so they don't stack a
 * second header under the app's own header when opened from the app.
 */
export const AppShellContext = createContext(false);

export function useInAppShell() {
  return useContext(AppShellContext);
}
