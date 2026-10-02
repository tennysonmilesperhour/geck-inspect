/**
 * The gecko count limit for each plan (Free 10, Keeper 50, Breeder and
 * Enterprise unlimited), counted the same way everywhere a gecko can be
 * added: the full form, Quick Add, CSV import, and unarchiving.
 *
 * The database enforces the Free limit too (trigger
 * geckos_enforce_free_limit, migration 20261002221052), and this file
 * counts the same way it does:
 *
 *   - only geckos the member owns (created_by is their email). Geckos
 *     that other people share with them through a collection do not use
 *     up their slots;
 *   - only active geckos. Archived ones (sold, passed away, other) do not
 *     count, so archiving one frees a slot.
 *
 * Existing geckos are never touched (decision D12): a member already over
 * the limit keeps every gecko and can still edit them; only new adds stop.
 */
import { getTierLimits, tierOf } from '@/lib/tierLimits';

export function countActiveOwnGeckos(geckos, email) {
  if (!Array.isArray(geckos) || !email) return 0;
  const me = String(email).toLowerCase();
  return geckos.filter(
    (g) => g && !g.archived && String(g.created_by || '').toLowerCase() === me,
  ).length;
}

/** The member's gecko limit, or Infinity when the plan has none. */
export function geckoLimitFor(user) {
  const max = getTierLimits(user).maxGeckos;
  return max == null ? Infinity : max;
}

/**
 * How many more active geckos the member can add right now.
 * Returns Infinity for unlimited plans and never less than 0.
 */
export function geckoSlotsLeft(user, activeOwnCount) {
  const limit = geckoLimitFor(user);
  if (limit === Infinity) return Infinity;
  return Math.max(0, limit - (Number(activeOwnCount) || 0));
}

/** Summary for gates and messages. */
export function geckoLimitStatus(user, geckos) {
  const active = countActiveOwnGeckos(geckos, user?.email);
  const limit = geckoLimitFor(user);
  const slotsLeft = geckoSlotsLeft(user, active);
  return { tier: tierOf(user), active, limit, slotsLeft, atLimit: slotsLeft <= 0 };
}

/** True when an error came from the database gecko limit trigger. */
export function isGeckoLimitError(error) {
  const text = `${error?.hint || ''} ${error?.message || ''}`;
  return /gecko_limit_reached|holds up to \d+ active geckos/i.test(text);
}
