import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Per-user preference backed by Supabase auth.users.user_metadata with a
 * localStorage fallback for guests and as an offline cache.
 *
 * Signed-in users: reads from user[key] (normalizeSupabaseUser already
 * spreads user_metadata into the user object), writes via
 * supabase.auth.updateUser. A new sign-in with empty metadata but
 * existing localStorage data triggers a one-time migration
 * (localStorage → metadata) so existing guest-era prefs aren't lost.
 *
 * Guest users: behaves exactly like usePageSettings — pure localStorage.
 *
 * Updates are debounced (600ms) before hitting Supabase so rapid state
 * changes (e.g. dragging pins) don't spam the auth API. Local state +
 * localStorage cache update immediately so the UI always feels instant.
 *
 * @param {object|null} user   normalized user object with user_metadata fields spread in
 * @param {string} key         preference key (e.g. 'market_analytics_pins')
 * @param {object} defaults    default shape
 * @returns {[object, (patch: object) => void]}
 */
export default function useUserPreference(user, key, defaults) {
  const readInitial = () => {
    // Signed-in users: trust user.user_metadata[key] via the spread in normalizeSupabaseUser.
    if (user?.id && user[key] && typeof user[key] === 'object') {
      return { ...defaults, ...user[key] };
    }
    // Guests or no metadata yet: localStorage.
    try {
      const stored = localStorage.getItem(key);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  };

  const [state, setState] = useState(readInitial);
  const pendingWriteRef = useRef(null);
  const migratedRef = useRef(false);

  // Re-hydrate when the user signs in/out or their metadata changes.
  useEffect(() => {
    setState(readInitial());
    migratedRef.current = false; // allow one migration per sign-in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, JSON.stringify(user?.[key] || null)]);

  // One-time migration: signed-in user with empty metadata + existing
  // localStorage data. Seed their metadata from localStorage so the
  // pins/presets they built as a guest follow them into their account.
  useEffect(() => {
    if (!user?.id || migratedRef.current) return;
    const hasMetadata = user[key] && typeof user[key] === 'object' && Object.keys(user[key]).length > 0;
    if (hasMetadata) { migratedRef.current = true; return; }
    let local;
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return;
      local = JSON.parse(stored);
    } catch { return; }
    if (!local || typeof local !== 'object') return;
    migratedRef.current = true;
    supabase.auth.updateUser({ data: { [key]: local } }).catch(() => {
      // Silently fall back — localStorage still has the data, next
      // write attempt will retry the sync.
    });
  }, [user?.id, user?.[key], key]);

  const updateState = useCallback((patch) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      // localStorage cache — always write, makes guest sessions work and
      // gives signed-in users an offline fallback.
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      // Debounced write to Supabase for signed-in users.
      if (user?.id) {
        if (pendingWriteRef.current) clearTimeout(pendingWriteRef.current);
        pendingWriteRef.current = setTimeout(() => {
          pendingWriteRef.current = null;
          supabase.auth.updateUser({ data: { [key]: next } }).catch(() => {
            // No retry — next update will try again. localStorage has latest.
          });
        }, 600);
      }
      return next;
    });
  }, [user?.id, key]);

  // Flush pending write on unmount so last-second changes aren't lost.
  useEffect(() => () => {
    if (pendingWriteRef.current) {
      clearTimeout(pendingWriteRef.current);
      if (user?.id) {
        supabase.auth.updateUser({ data: { [key]: state } }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [state, updateState];
}
