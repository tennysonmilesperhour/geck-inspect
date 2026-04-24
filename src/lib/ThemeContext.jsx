import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Each theme sets CSS custom properties via :root[data-theme="..."] in
// src/index.css.
export const THEMES = [
  {
    id: 'normal',
    label: 'Normal',
    description: 'Wild-type leopard gecko — deep forest greens with umber accents',
    swatch: '#2fb574',
  },
  {
    id: 'tangerine',
    label: 'Tangerine',
    description: 'Dusk-to-ember warmth — bright amber on deep umber',
    swatch: '#ea8206',
  },
  {
    id: 'halloween-mask',
    label: 'Halloween Mask',
    description: 'October night — glowing red-orange with bronze accents',
    swatch: '#e53e1a',
  },
  {
    id: 'blizzard',
    label: 'Blizzard',
    description: 'Icy night — frost-cyan primary on cold near-black',
    swatch: '#38a7f2',
  },
  {
    id: 'lavender',
    label: 'Lavender',
    description: 'Deep violet base with pale-lavender accents — Lavender Albino tones',
    swatch: '#c084fc',
  },
  {
    id: 'super-hypo',
    label: 'Super Hypo',
    description: 'High-noon sunlight — golden yellow with olive and bronze undertones',
    swatch: '#e0b308',
  },
];

export const DEFAULT_THEME = 'normal';
const STORAGE_KEY = 'geckinspect.theme';
const VALID_IDS = new Set(THEMES.map((t) => t.id));

// Secondary "Accent color" — independent of the primary theme.
// Reuses the same six morph IDs since each maps cleanly to a hue.
// Picking 'normal' here keeps the app's stock emerald accent.
export const DEFAULT_SECONDARY = 'normal';
const SECONDARY_STORAGE_KEY = 'geckinspect.secondary';

export const SECONDARY_COLORS = [
  { id: 'normal',         label: 'Emerald',       swatch: '#10b981', description: 'Stock emerald — wild-type leopard gecko' },
  { id: 'tangerine',      label: 'Tangerine',     swatch: '#ea8206', description: 'Warm amber accents' },
  { id: 'halloween-mask', label: 'Halloween Mask', swatch: '#e53e1a', description: 'Bold red-orange accents' },
  { id: 'blizzard',       label: 'Blizzard',      swatch: '#3b82f6', description: 'Cool sky-blue accents' },
  { id: 'lavender',       label: 'Lavender',      swatch: '#a78bfa', description: 'Soft violet accents' },
  { id: 'super-hypo',     label: 'Super Hypo',    swatch: '#eab308', description: 'Golden yellow accents' },
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

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() =>
    readStored(STORAGE_KEY, VALID_IDS, DEFAULT_THEME)
  );
  const [secondary, setSecondaryState] = useState(() =>
    readStored(SECONDARY_STORAGE_KEY, VALID_IDS, DEFAULT_SECONDARY)
  );

  useEffect(() => {
    applyAttribute('data-theme', theme);
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);

  useEffect(() => {
    applyAttribute('data-secondary', secondary);
    try { window.localStorage.setItem(SECONDARY_STORAGE_KEY, secondary); } catch {}
  }, [secondary]);

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
