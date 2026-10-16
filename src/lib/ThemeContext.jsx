import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { getSupabase, getSupabaseWhenIdle } from '@/lib/supabaseLazy';

// Each theme sets CSS custom properties via :root[data-theme="..."] in
// src/index.css.
// Note on IDs vs labels: the `id` strings are persisted to localStorage
// and referenced by CSS `data-theme` / `data-secondary` selectors in
// src/index.css. Renaming an `id` would break stored prefs and styling.
// Renaming a `label` is purely cosmetic and safe. Historical labels
// "Normal", "Halloween Mask", and "Super Hypo" were renamed to
// "Emerald", "Eclipse", and "Hypo" while the IDs stay frozen.
// `statusBar` is the theme's page background (--slate-950 in index.css)
// as hex. It becomes theme-color, which tints the iPhone status bar above
// the glass header; index.html holds the same table for the first paint.
export const THEMES = [
  {
    id: 'normal',
    label: 'Emerald',
    description: 'Wild-type emerald, deep forest greens with umber accents',
    swatch: '#2fb574',
    statusBar: '#0a1913',
  },
  {
    id: 'tangerine',
    label: 'Tangerine',
    description: 'Dusk-to-ember warmth, bright amber on deep umber',
    swatch: '#ea8206',
    statusBar: '#160d09',
  },
  {
    id: 'halloween-mask',
    label: 'Eclipse',
    description: 'October night, glowing red-orange with bronze accents',
    swatch: '#e53e1a',
    statusBar: '#170b08',
  },
  {
    id: 'blizzard',
    label: 'Blizzard',
    description: 'Icy night, frost-cyan primary on cold near-black',
    swatch: '#38a7f2',
    statusBar: '#0a0f19',
  },
  {
    id: 'lavender',
    label: 'Lavender',
    description: 'Deep violet base with pale-lavender accents, Lavender Albino tones',
    swatch: '#c084fc',
    statusBar: '#160d1c',
  },
  {
    id: 'super-hypo',
    label: 'Hypo',
    description: 'High-noon sunlight, golden yellow with olive and bronze undertones',
    swatch: '#e0b308',
    statusBar: '#161109',
  },
];

// New visitors start on Emerald (comprehensive review B4, October 2026:
// the old Blizzard default painted every page blue and put four accent
// colours on one screen). Anyone with a theme already saved, on this
// device or on their profile, keeps it.
//
// Until October 2026 the default itself was saved the first time the app
// loaded, so a stored value did not mean a member chose it (115 of 147
// profiles held blizzard/blizzard on 16 Oct). From now on a value is only
// saved once the member picks one in Settings, so people who never pick
// follow the default.
export const DEFAULT_THEME = 'normal';
const STORAGE_KEY = 'geckinspect.theme';
const VALID_IDS = new Set(THEMES.map((t) => t.id));

// Secondary "Accent color" is independent of the primary theme.
// Reuses the same six morph IDs since each maps cleanly to a hue.
export const DEFAULT_SECONDARY = 'normal';
const SECONDARY_STORAGE_KEY = 'geckinspect.secondary';

export const SECONDARY_COLORS = [
  { id: 'normal',         label: 'Emerald',   swatch: '#10b981', description: 'Stock emerald, wild-type accent' },
  { id: 'tangerine',      label: 'Tangerine', swatch: '#ea8206', description: 'Warm amber accents' },
  { id: 'halloween-mask', label: 'Eclipse',   swatch: '#e53e1a', description: 'Bold red-orange accents' },
  { id: 'blizzard',       label: 'Blizzard',  swatch: '#3b82f6', description: 'Cool sky-blue accents' },
  { id: 'lavender',       label: 'Lavender',  swatch: '#a78bfa', description: 'Soft violet accents' },
  { id: 'super-hypo',     label: 'Hypo',      swatch: '#eab308', description: 'Golden yellow accents' },
];

function readStoredValue(key, validSet) {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored && validSet.has(stored)) return stored;
  } catch {}
  return null;
}

function readStored(key, validSet, fallback) {
  return readStoredValue(key, validSet) || fallback;
}

// Homepage experiment hold (docs/planning/homepage-ab-test-2026-10.md):
// index.html marks a signed-out visit that opened on "/" with
// data-landing-hold, and such a visit keeps the Blizzard defaults both
// homepage designs launched with until the page reloads. Nothing is
// saved, so it ends by itself. Remove this with the experiment.
const LANDING_HOLD_DEFAULT = 'blizzard';
function defaultFor(fallback) {
  if (typeof document === 'undefined') return fallback;
  try {
    return document.documentElement?.hasAttribute?.('data-landing-hold') ? LANDING_HOLD_DEFAULT : fallback;
  } catch {
    return fallback;
  }
}

function applyAttribute(name, value) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(name, value);
}

function applyStatusBar(themeId) {
  if (typeof document === 'undefined') return;
  const color = THEMES.find((t) => t.id === themeId)?.statusBar;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (color && meta) meta.setAttribute('content', color);
}

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  themes: THEMES,
  secondary: DEFAULT_SECONDARY,
  setSecondary: () => {},
  secondaryColors: SECONDARY_COLORS,
});

// Cross-device sync for the theme and accent color preferences.
//
// Source-of-truth precedence on load:
//   1. profiles.ui_theme / ui_secondary on the authenticated user's row
//      (cloud, syncs across devices)
//   2. localStorage on the current device (fast, works pre-auth)
//   3. DEFAULT_THEME / DEFAULT_SECONDARY constants
//
// Writes go to localStorage immediately so the UI never flickers, and
// also to the profile row when the user is signed in. Cloud writes
// fail silently: if Supabase is unreachable, the local choice still
// applies and re-syncs the next time the user changes the theme.
async function fetchCloudPrefs() {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;
    // Resolve the profile row by EMAIL, the app-wide convention.
    // Legacy rows carry TEXT ids that do NOT equal the auth UUID, so an
    // `.eq('id', user.id)` lookup silently missed them and cloud theme
    // prefs never loaded or saved for long-time users. See
    // supabase/SCHEMA_CONVENTIONS.md.
    const { data, error } = await supabase
      .from('profiles')
      .select('ui_theme, ui_secondary')
      .eq('email', user.email)
      .maybeSingle();
    if (error || !data) return null;
    return { userId: user.id, ...data };
  } catch {
    return null;
  }
}

async function saveCloudPref(column, value) {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    await supabase
      .from('profiles')
      .update({ [column]: value })
      .eq('email', user.email);
  } catch {
    // Best-effort. Local copy already updated.
  }
}

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() =>
    readStored(STORAGE_KEY, VALID_IDS, defaultFor(DEFAULT_THEME))
  );
  const [secondary, setSecondaryState] = useState(() =>
    readStored(SECONDARY_STORAGE_KEY, VALID_IDS, defaultFor(DEFAULT_SECONDARY))
  );
  // Whether each value is the member's own (saved earlier, synced from
  // their profile, or picked now) rather than the default. Only their own
  // values are written back, so the default is never saved as a choice.
  const themeIsOwn = useRef(readStoredValue(STORAGE_KEY, VALID_IDS) != null);
  const secondaryIsOwn = useRef(readStoredValue(SECONDARY_STORAGE_KEY, VALID_IDS) != null);

  // Cloud writes are gated until we've confirmed the auth state. On cold
  // page loads the save effect would otherwise fire before
  // supabase.auth.getUser() has restored the session, so the early
  // `if (!user?.id) return` inside saveCloudPref would skip the write
  // and the profile row never got seeded. With this gate, the save
  // effect re-runs after authReady flips true with a known user, and
  // the local theme actually lands in profiles.ui_theme.
  const [authReady, setAuthReady] = useState(false);

  // Tracks whether we should write changes through to the cloud. Stays
  // false while we're hydrating from the cloud, otherwise we'd echo
  // the cloud value right back as a "user change" and burn a write.
  const skipCloudWrite = useRef(false);

  // On mount, wait for the session to be restored, then hydrate from
  // the cloud if signed in. Re-hydrate on subsequent sign-ins (account
  // swaps). authReady flips true once we've finished the first pass,
  // at which point the save effects below are allowed to fire.
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const cloud = await fetchCloudPrefs();
      if (cancelled || !cloud) return;
      skipCloudWrite.current = true;
      if (cloud.ui_theme && VALID_IDS.has(cloud.ui_theme)) {
        themeIsOwn.current = true;
        setThemeState(cloud.ui_theme);
      }
      if (cloud.ui_secondary && VALID_IDS.has(cloud.ui_secondary)) {
        secondaryIsOwn.current = true;
        setSecondaryState(cloud.ui_secondary);
      }
      // Allow the upcoming state-effect ticks to write to localStorage
      // without echoing back to the cloud, then resume normal writes.
      setTimeout(() => { skipCloudWrite.current = false; }, 0);
    };
    let sub = null;
    // Waits for the client instead of loading it: for a signed-out
    // visitor there is no saved theme to fetch (src/lib/supabaseLazy.js).
    // A member's sign-in state loads it straight away, so this is
    // immediate for them.
    const init = async () => {
      try {
        const supabase = await getSupabaseWhenIdle();
        if (cancelled) return;
        ({ data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') hydrate();
        }));
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data?.session?.user) await hydrate();
      } catch {
        // No client (no signal): keep the theme stored on this device.
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    };
    init();
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    applyAttribute('data-theme', theme);
    applyStatusBar(theme);
    if (!themeIsOwn.current) return;
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch {}
    if (authReady && !skipCloudWrite.current) saveCloudPref('ui_theme', theme);
  }, [theme, authReady]);

  useEffect(() => {
    applyAttribute('data-secondary', secondary);
    if (!secondaryIsOwn.current) return;
    try { window.localStorage.setItem(SECONDARY_STORAGE_KEY, secondary); } catch {}
    if (authReady && !skipCloudWrite.current) saveCloudPref('ui_secondary', secondary);
  }, [secondary, authReady]);

  // Called from the Settings pickers: the member's own choice, saved.
  const setTheme = useCallback((nextId) => {
    if (!VALID_IDS.has(nextId)) return;
    themeIsOwn.current = true;
    setThemeState(nextId);
  }, []);

  const setSecondary = useCallback((nextId) => {
    if (!VALID_IDS.has(nextId)) return;
    secondaryIsOwn.current = true;
    setSecondaryState(nextId);
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme, setTheme, themes: THEMES,
      secondary, setSecondary, secondaryColors: SECONDARY_COLORS,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
