import { useState, useCallback } from 'react';

/**
 * Persistent page-level settings backed by localStorage.
 *
 * @param {string} key   localStorage key (e.g. "gallery_prefs")
 * @param {object} defaults  Default values for every setting
 * @returns {[object, (patch: object) => void, () => void]}
 *   [settings, updateSettings, resetSettings]
 */
export default function usePageSettings(key, defaults) {
    const [settings, setSettings] = useState(() => {
        try {
            const stored = localStorage.getItem(key);
            return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
        } catch {
            return defaults;
        }
    });

    const updateSettings = useCallback((patch) => {
        setSettings(prev => {
            const next = { ...prev, ...patch };
            localStorage.setItem(key, JSON.stringify(next));
            return next;
        });
    }, [key]);

    const resetSettings = useCallback(() => {
        localStorage.removeItem(key);
        setSettings(defaults);
    }, [key, defaults]);

    return [settings, updateSettings, resetSettings];
}
