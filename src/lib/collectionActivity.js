/**
 * The activity log on shared collections: who added, edited, weighed, fed,
 * archived or moved which gecko.
 *
 * Database triggers write the rows (supabase/migrations/
 * 20260929061634_collection_activity_and_member_guard.sql), so every screen
 * that saves a gecko or a care record is covered and nobody can forge an
 * entry. Rows are only recorded while a collection has an invited or joined
 * collaborator. The owner and joined members can read them.
 */
import { format, isToday, isYesterday } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';

const COLUMNS = 'id, collection_id, gecko_id, gecko_name, actor_email, actor_name, action, detail, created_at';

export async function fetchCollectionActivity({ collectionId, geckoId, limit = 50 } = {}) {
  if (!collectionId && !geckoId) return [];
  let query = supabase
    .from('collection_activity')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (collectionId) query = query.eq('collection_id', collectionId);
  if (geckoId) query = query.eq('gecko_id', geckoId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/** "You" for the signed-in person, otherwise their name or email. */
export function activityActor(entry, currentEmail) {
  const email = String(entry?.actor_email || '').toLowerCase();
  if (email && currentEmail && email === String(currentEmail).toLowerCase()) return 'You';
  return entry?.actor_name || entry?.actor_email || 'Geck Inspect';
}

/** One plain sentence per entry, e.g. "Sam fed Mango (CGD)". */
export function describeActivity(entry, currentEmail) {
  const who = activityActor(entry, currentEmail);
  const gecko = entry?.gecko_name || 'a gecko';
  const detail = entry?.detail ? String(entry.detail) : '';
  const paren = detail ? ` (${detail})` : '';
  switch (entry?.action) {
    case 'added':
      return `${who} added ${gecko}${paren}`;
    case 'edited':
      return `${who} edited ${gecko}${detail ? `: ${detail}` : ''}`;
    case 'archived':
      return `${who} archived ${gecko}${paren}`;
    case 'restored':
      return `${who} restored ${gecko} from the archive`;
    case 'deleted':
      return `${who} deleted ${gecko}`;
    case 'moved_in':
      return `${who} moved ${gecko} into this collection${detail ? ` from ${detail}` : ''}`;
    case 'moved_out':
      return `${who} moved ${gecko} out${detail ? ` to ${detail}` : ''}`;
    case 'weighed':
      return `${who} weighed ${gecko}${detail ? `: ${detail}` : ''}`;
    case 'fed': {
      const refused = detail.endsWith(', refused');
      const food = refused ? detail.slice(0, -', refused'.length) : detail;
      return refused
        ? `${who} offered ${gecko} ${food || 'food'} (refused)`
        : `${who} fed ${gecko}${food ? ` (${food})` : ''}`;
    }
    case 'shed':
      return `${who} logged a shed for ${gecko}${paren}`;
    case 'joined':
      if (!detail) return `${who} joined as a collaborator`;
      return `${who} joined as ${/^[aeiou]/i.test(detail) ? 'an' : 'a'} ${detail}`;
    case 'removed':
      return `${who} removed ${detail || 'a collaborator'}`;
    default:
      return `${who} updated ${gecko}`;
  }
}

/** Groups newest-first entries into days: [{ label, items }]. */
export function groupActivityByDay(entries = []) {
  const groups = [];
  for (const entry of entries) {
    const at = new Date(entry.created_at);
    const label = Number.isNaN(at.getTime())
      ? 'Earlier'
      : isToday(at) ? 'Today' : isYesterday(at) ? 'Yesterday' : format(at, 'EEE, MMM d');
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }
  return groups;
}
