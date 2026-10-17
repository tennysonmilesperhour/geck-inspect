// Upgrade prompt events: shown, clicked, and which paywall led to a
// checkout. Kept out of activation.js, which every page loads up front,
// because only plan buttons and the Membership page need these.
// See docs/planning/instrumentation-2026-10.md.
import { captureEvent } from '@/lib/posthog';

// Upgrade prompts. The clicked prompt is remembered for the tab so
// checkout_started and checkout_completed can say which paywall led there.
const LAST_PROMPT_KEY = 'geck_last_upgrade_prompt';
// Same record, so a Membership landing that already counted the click
// (the button handler ran in this tab) does not count it again.
const CLICK_EMITTED_KEY = 'geck_upgrade_click_emitted';
const PROMPT_TTL_MS = 60 * 60 * 1000;

function promptBox(store) {
  if (store) return store;
  try {
    if (typeof window !== 'undefined') return window.sessionStorage;
  } catch {
    return null;
  }
  return null;
}

function readPromptRecord(key, store) {
  const box = promptBox(store);
  if (!box) return null;
  try {
    const raw = box.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePromptRecord(key, record, store) {
  const box = promptBox(store);
  if (!box) return;
  try {
    box.setItem(key, JSON.stringify(record));
  } catch {
    // private mode: the event above is still the record
  }
}

/**
 * Membership URL for an upgrade CTA. The query is how the pricing page
 * knows which paywall sent the member, even when the click handler itself
 * did not get to run.
 */
export function upgradeMembershipPath(limitType, surface = limitType) {
  const type = limitType || surface || '';
  const face = surface || limitType || '';
  const params = new URLSearchParams();
  if (type) params.set('limit_type', String(type));
  if (face) params.set('surface', String(face));
  if (face || type) params.set('from_prompt', String(face || type));
  const query = params.toString();
  return query ? `/Membership?${query}` : '/Membership';
}

export function upgradePromptShown(limitType, surface = limitType) {
  captureEvent('upgrade_prompt_shown', { limit_type: limitType, surface });
}

export function upgradePromptClicked(limitType, surface = limitType, store) {
  const record = { limit_type: limitType, surface, at: Date.now() };
  captureEvent('upgrade_prompt_clicked', { limit_type: limitType, surface });
  writePromptRecord(LAST_PROMPT_KEY, record, store);
  writePromptRecord(CLICK_EMITTED_KEY, record, store);
}

/** Record the click, then open Membership in this tab when navigate is passed. */
export function openUpgradePlans(limitType, surface = limitType, navigate, store) {
  upgradePromptClicked(limitType, surface, store);
  const path = upgradeMembershipPath(limitType, surface);
  if (typeof navigate === 'function') navigate(path);
  return path;
}

/**
 * Membership opened with from_prompt, limit_type and surface on the URL.
 * Counts the click once when the button handler did not already record it
 * in this tab (a full page load can cancel the in-flight insert).
 */
export function noteUpgradePromptFromLocation(search, now = Date.now(), store) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const limitType = params.get('limit_type') || params.get('from_prompt');
  const surface = params.get('surface') || params.get('from_prompt') || limitType;
  if (!limitType && !surface) return false;
  const type = limitType || surface;
  const face = surface || limitType;
  const emitted = readPromptRecord(CLICK_EMITTED_KEY, store);
  const already = emitted
    && emitted.surface === face
    && emitted.limit_type === type
    && now - Number(emitted.at || 0) < PROMPT_TTL_MS;
  if (already) return false;
  upgradePromptClicked(type, face, store);
  return true;
}

/** The upgrade prompt clicked in this tab in the last hour, if any. */
export function lastUpgradePrompt(now = Date.now(), store) {
  const parsed = readPromptRecord(LAST_PROMPT_KEY, store);
  if (!parsed || now - Number(parsed.at || 0) > PROMPT_TTL_MS) return null;
  return parsed.surface || parsed.limit_type || null;
}
