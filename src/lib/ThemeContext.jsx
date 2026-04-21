import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export const THEMES = [
  {
    id: 'normal',
    label: 'Normal',
    description: 'Wild-type leopard gecko — emerald & forest greens',
    swatch: '#34d399',
  },
  {
    id: 'tangerine',
    label: 'Tangerine',
    description: 'Bright orange Tangerine morph — amber & dusk tones',
    swatch: '#f59e0b',
  },
  {
    id: 'halloween-mask',
    label: 'Halloween Mask',
    description: 'Bold red-orange Halloween Mask contrast',
    swatch: '#ef4444',
  },
  {
    id: 'blizzard',
    label: 'Blizzard',
    description: 'Cool slate-blue patternless Blizzard',
    swatch: '#60a5fa',
  },
  {
    id: 'lavender',
    label: 'Lavender',
    description: 'Soft violet Lavender Albino tones',
    swatch: '#c084fc',
  },
  {
    id: 'super-hypo',
    label: 'Super Hypo',
    description: 'Sunlit yellow Super Hypo Tangerine tones',
    swatch: '#facc15',
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
