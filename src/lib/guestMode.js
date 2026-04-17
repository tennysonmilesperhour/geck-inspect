/**
 * Guest mode — a browser-local "continue without an account" state.
 *
 * A guest has no Supabase session, so RLS will block all writes anyway.
 * This module layers a friendlier UX on top of that: a sessionStorage
 * flag lets the app render the full authenticated layout in view-only
 * mode, and write attempts are intercepted BEFORE they hit Supabase so
 * the user sees a single clear "sign up to save your work" prompt
 * instead of a raw Postgres / RLS error.
 *
 * The flag lives in sessionStorage so closing the tab ends guest mode
 * (matching the ephemeral session behavior for signed-in users). No
 * cross-tab sync is attempted — each tab is its own guest or its own
 * signed-in user.
 */
const FLAG_KEY = 'geck_inspect_guest_mode';

export const GUEST_WRITE_BLOCKED_EVENT = 'geck_inspect_guest_write_blocked';

export function isGuestMode() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function setGuestMode(on) {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.sessionStorage.setItem(FLAG_KEY, '1');
    else window.sessionStorage.removeItem(FLAG_KEY);
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
}

/**
 * Synthetic user object shown while in guest mode. Empty `id` so any
 * page that filters "my X" by user id naturally returns nothing — a
 * guest sees the UI shell, not another user's data.
 */
export const GUEST_USER = Object.freeze({
  id: '',
  email: 'guest@local',
  full_name: 'Guest',
  membership_tier: 'free',
  membership_billing_cycle: null,
  profile_image: null,
  sidebar_badge_preference: 'collection',
  is_guest: true,
});

/**
 * Thrown by the entity layer when a guest attempts a write. Pages that
 * catch entity errors will see a useful message; a global listener on
 * `GUEST_WRITE_BLOCKED_EVENT` also fires so the app can surface a
 * consistent toast regardless of whether the caller handled the error.
 */
export class GuestWriteBlockedError extends Error {
  constructor(action = 'save changes') {
    super(`Create an account to ${action}. Guests have view-only access.`);
    this.name = 'GuestWriteBlockedError';
    this.isGuestBlock = true;
  }
}

export function blockIfGuest(action) {
  if (!isGuestMode()) return;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(GUEST_WRITE_BLOCKED_EVENT, { detail: { action } })
    );
  }
  throw new GuestWriteBlockedError(action);
}
