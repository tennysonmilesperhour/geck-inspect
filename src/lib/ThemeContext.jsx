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

function readStoredTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_IDS.has(stored)) return stored;
  } catch {}
  return DEFAULT_THEME;
}

function applyThemeAttribute(themeId) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', themeId);
}

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  themes: THEMES,
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => {
    applyThemeAttribute(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const setTheme = useCallback((nextId) => {
    if (!VALID_IDS.has(nextId)) return;
    setThemeState(nextId);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
