import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Each theme sets CSS custom properties via :root[data-theme="..."] in
// src/index.css.
// Note on IDs vs labels: the `id` strings are persisted to localStorage
// and referenced by CSS `data-theme` / `data-secondary` selectors in
// src/index.css. Renaming an `id` would break stored prefs and styling.
// Renaming a `label` is purely cosmetic and safe. Historical labels
// "Normal", "Halloween Mask", and "Super Hypo" were renamed to
// "Emerald", "Eclipse", and "Hypo" while the IDs stay frozen.
export const THEMES = [
  {
    id: 'normal',
    label: 'Emerald',
    description: 'Wild-type emerald, deep forest greens with umber accents',
    swatch: '#2fb574',
  },
  {
    id: 'tangerine',
    label: 'Tangerine',
    description: 'Dusk-to-ember warmth, bright amber on deep umber',
    swatch: '#ea8206',
  },
  {
    id: 'halloween-mask',
    label: 'Eclipse',
    description: 'October night, glowing red-orange with bronze accents',
    swatch: '#e53e1a',
  },
  {
    id: 'blizzard',
    label: 'Blizzard',
    description: 'Icy night, frost-cyan primary on cold near-black',
    swatch: '#38a7f2',
  },
  {
    id: 'lavender',
    label: 'Lavender',
    description: 'Deep violet base with pale-lavender accents, Lavender Albino tones',
    swatch: '#c084fc',
  },
  {
    id: 'super-hypo',
    label: 'Hypo',
    description: 'High-noon sunlight, golden yellow with olive and bronze undertones',
    swatch: '#e0b308',
  },
];

// New profiles default to Blizzard for both primary theme and accent.
// Existing users keep whatever they already saved in localStorage; the
// default only applies when nothing is stored yet.
export const DEFAULT_THEME = 'blizzard';
const STORAGE_KEY = 'geckinspect.theme';
const VALID_IDS = new Set(THEMES.map((t) => t.id));

// Secondary "Accent color" is independent of the primary theme.
// Reuses the same six morph IDs since each maps cleanly to a hue.
export const DEFAULT_SECONDARY = 'blizzard';
const SECONDARY_STORAGE_KEY = 'geckinspect.secondary';

export const SECONDARY_COLORS = [
  { id: 'normal',         label: 'Emerald',   swatch: '#10b981', description: 'Stock emerald, wild-type accent' },
  { id: 'tangerine',      label: 'Tangerine', swatch: '#ea8206', description: 'Warm amber accents' },
  { id: 'halloween-mask', label: 'Eclipse',   swatch: '#e53e1a', description: 'Bold red-orange accents' },
  { id: 'blizzard',       label: 'Blizzard',  swatch: '#3b82f6', description: 'Cool sky-blue accents' },
  { id: 'lavender',       label: 'Lavender',  swatch: '#a78bfa', description: 'Soft violet accents' },
  { id: 'super-hypo',     label: 'Hypo',      swatch: '#eab308', description: 'Golden yellow accents' },
];

function readStored(key, validSet, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored && validSet.has(stored)) return stored;
  } catch {}
  return fallback;
}

function applyAttribute(name, value) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(name, value);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('ui_theme, ui_secondary')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !data) return null;
    return { userId: user.id, ...data };
  } catch {
    return null;
  }
}

async function saveCloudPref(column, value) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;
    await supabase
      .from('profiles')
      .update({ [column]: value })
      .eq('id', user.id);
  } catch {
    // Best-effort. Local copy already updated.
  }
}

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() =>
    readStored(STORAGE_KEY, VALID_IDS, DEFAULT_THEME)
  );
  const [secondary, setSecondaryState] = useState(() =>
    readStored(SECONDARY_STORAGE_KEY, VALID_IDS, DEFAULT_SECONDARY)
  );

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
        setThemeState(cloud.ui_theme);
      }
      if (cloud.ui_secondary && VALID_IDS.has(cloud.ui_secondary)) {
        setSecondaryState(cloud.ui_secondary);
      }
      // Allow the upcoming state-effect ticks to write to localStorage
      // without echoing back to the cloud, then resume normal writes.
      setTimeout(() => { skipCloudWrite.current = false; }, 0);
    };
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data?.session?.user) await hydrate();
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') hydrate();
    });
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    applyAttribute('data-theme', theme);
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch {}
    if (authReady && !skipCloudWrite.current) saveCloudPref('ui_theme', theme);
  }, [theme, authReady]);

  useEffect(() => {
    applyAttribute('data-secondary', secondary);
    try { window.localStorage.setItem(SECONDARY_STORAGE_KEY, secondary); } catch {}
    if (authReady && !skipCloudWrite.current) saveCloudPref('ui_secondary', secondary);
  }, [secondary, authReady]);

  const setTheme = useCallback((nextId) => {
    if (!VALID_IDS.has(nextId)) return;
    setThemeState(nextId);
  }, []);

  const setSecondary = useCallback((nextId) => {
    if (!VALID_IDS.has(nextId)) return;
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
