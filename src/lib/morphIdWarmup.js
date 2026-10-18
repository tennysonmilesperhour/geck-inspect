import { supabase } from '@/lib/supabaseClient';

// Wakes Morph ID's photo-matching model while the member is still picking
// photos (17 Oct 2026). The model runs on Replicate and takes 35 to 75
// seconds to boot when nobody has used it lately; that boot was behind every
// Morph ID run of 100 seconds or more in October.
//
// This sends { action: 'warm' } and nothing else: no photo, no storage URL,
// no gecko details. The function embeds a photo the project owns
// (supabase/functions/_shared/morph-warm.ts), so it needs no AI consent
// prompt; that still comes at Identify, before any member photo is sent.
//
// Fire and forget: it never waits, never throws, and sends at most once
// every 3 minutes per tab. The server also skips it when any member warmed
// the model in the last minute.

export const WARM_GAP_MS = 3 * 60 * 1000;

let lastSentAt = null;

/**
 * Sends the warm-up unless one went out from this tab in the last 3 minutes.
 * Returns true when a request was sent.
 */
export function warmMorphId({ client = supabase, now = Date.now() } = {}) {
  if (lastSentAt != null && now - lastSentAt < WARM_GAP_MS) return false;
  lastSentAt = now;
  try {
    const pending = client?.functions?.invoke('recognize-gecko-morph', { body: { action: 'warm' } });
    if (pending && typeof pending.catch === 'function') pending.catch(() => {});
  } catch {
    // A warm-up that fails changes nothing for the member.
  }
  return true;
}

/** Tests only: forget the last send. */
export function resetMorphIdWarmup() {
  lastSentAt = null;
}
