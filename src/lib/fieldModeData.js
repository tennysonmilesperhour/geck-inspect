// The geckos a member can log for, shared by Field Mode and the one-tap
// log that reminder links open (/log). Both use the same react-query key,
// and src/lib/offlineCache.js keeps that key in this browser, so either
// screen opens with no signal once the collection has loaded once.
import { CollectionMember } from '@/entities/all';
import { getVisibleGeckos, canWriteGecko } from '@/lib/geckoAccess';

export function fieldModeQueryKey(email) {
  return ['field-mode', email || null];
}

/** Active geckos the member owns or may log for in a shared collection. */
export async function loadWritableGeckos(user) {
  const [allGeckos, memberships] = await Promise.all([
    getVisibleGeckos(user, {}, '-created_date', 500),
    CollectionMember.filter({ status: 'accepted' }).catch(() => []),
  ]);
  return (allGeckos || []).filter((g) => !g.archived && canWriteGecko(g, user, memberships));
}
