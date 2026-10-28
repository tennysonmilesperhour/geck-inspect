import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
// Loaded on first use, not with the page (src/lib/supabaseLazy.js).
import { getSupabase } from '@/lib/supabaseLazy';
import { isBlockedContent } from '@/lib/moderation';

/** Personal feed filtering. The database separately prevents blocked messages. */
export function useBlockedAuthors() {
  const { user, isGuest } = useAuth();
  const [blocked, setBlocked] = useState(new Set());
  useEffect(() => {
    let current = true;
    if (!user?.email || isGuest) { setBlocked(new Set()); return; }
    const load = async () => {
      const supabase = await getSupabase();
      const { data, error } = await supabase.from('user_blocks').select('blocked_email').eq('blocker_email', user.email);
      if (!current) return;
      if (error) { console.warn('Blocked-author preferences unavailable:', error.message); return; }
      setBlocked(new Set(data.map(row => row.blocked_email)));
    };
    const refresh = () => { void load().catch(error => console.warn('Could not load blocked authors:', error.message)); };
    refresh();
    window.addEventListener('user_blocks_changed', refresh);
    return () => { current = false; window.removeEventListener('user_blocks_changed', refresh); };
  }, [user?.email, isGuest]);
  return blocked;
}

/**
 * Blocked members by email and by profile id, for pages whose rows only
 * carry the owner's profile id (listings, store pages, morph photos).
 * `isBlocked(row)` checks any owner column the row has.
 */
export function useBlockedMembers() {
  const emails = useBlockedAuthors();
  const [profileIds, setProfileIds] = useState(new Set());
  useEffect(() => {
    let current = true;
    const list = Array.from(emails);
    if (!list.length) { setProfileIds(new Set()); return undefined; }
    (async () => {
      try {
        const supabase = await getSupabase();
        // my_blocked_profile_ids (20261028040000) finds every blocked
        // member, public profile or not. read_profiles is the fallback
        // until that migration is live; it only returns public profiles.
        let { data, error } = await supabase.rpc('my_blocked_profile_ids');
        if (error && (error.code === 'PGRST202' || error.code === '42883')) {
          ({ data, error } = await supabase
            .rpc('read_profiles', { p_emails: list })
            .select('id, email'));
        }
        if (!current || error || !Array.isArray(data)) return;
        setProfileIds(new Set(data.map(row => String(row.id))));
      } catch (error) {
        console.warn('Could not resolve blocked members:', error?.message);
      }
    })();
    return () => { current = false; };
  }, [emails]);
  return useMemo(() => {
    const blocked = { emails, profileIds };
    return { ...blocked, isBlocked: (row) => isBlockedContent(blocked, row) };
  }, [emails, profileIds]);
}
