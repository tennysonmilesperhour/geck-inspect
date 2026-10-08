/**
 * Morph ID allowance for the Recognition page.
 *
 * The number comes from morph_id_scans_remaining() (plan scans plus
 * unexpired bonus credits, minus what is already used). This file only
 * turns that payload into the lock / banner decision. It does not
 * recompute Keeper 3, Breeder 6 or Enterprise 15.
 *
 * If the function is not installed yet, Free falls back to the old
 * "1 minus lifetime use" read so the uploader still locks after the
 * free try. That fallback does not know about bonus credits.
 */

export function morphIdGate({ isFreeTier = false, remaining = null, bonus = 0 } = {}) {
  const known = Number.isFinite(remaining);
  const left = known ? Math.max(0, remaining) : null;
  const bonusCredits = Number.isFinite(Number(bonus)) ? Math.max(0, Number(bonus)) : 0;
  const hasBonus = bonusCredits > 0;
  return {
    known,
    remaining: left,
    bonus: bonusCredits,
    locked: known && left === 0,
    // The original "first identification is free" line, only when this
    // is the unused lifetime try and no extra scans were granted.
    showFirstFreeBanner: Boolean(isFreeTier) && known && left === 1 && !hasBonus,
    showScansLeft: known && left > 0 && (!isFreeTier || hasBonus || left > 1),
  };
}

export function morphIdScansLeftLabel(remaining) {
  if (!Number.isFinite(remaining) || remaining < 0) return null;
  if (remaining === 1) return '1 Morph ID scan left.';
  return `${remaining} Morph ID scans left.`;
}

export function legacyFreeScansRemaining(consumed) {
  const used = Number(consumed) || 0;
  return Math.max(0, 1 - used);
}

export function isMissingScansRpc(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const message = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  if (code === 'PGRST202') return true;
  return /morph_id_scans_remaining/i.test(message)
    && /does not exist|schema cache|could not find/i.test(message);
}

export async function loadMorphIdQuota(client, { isFreeTier = false, userId = null } = {}) {
  const { data, error } = await client.rpc('morph_id_scans_remaining');
  if (!error) {
    return morphIdGate({
      isFreeTier,
      remaining: Number(data?.remaining),
      bonus: Number(data?.bonus),
    });
  }
  if (!isFreeTier || !isMissingScansRpc(error)) throw error;

  let query = client.from('morph_id_usage').select('credits_consumed');
  if (userId) query = query.eq('user_id', userId);
  const { data: rows, error: usageError } = await query;
  if (usageError) throw usageError;
  const consumed = (rows || []).reduce(
    (sum, row) => sum + (Number(row.credits_consumed) || 0),
    0,
  );
  return morphIdGate({
    isFreeTier: true,
    remaining: legacyFreeScansRemaining(consumed),
    bonus: 0,
  });
}
