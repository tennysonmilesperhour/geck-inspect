import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';

/** Personal feed filtering. The database separately prevents blocked messages. */
export function useBlockedAuthors() {
  const { user, isGuest } = useAuth();
  const [blocked, setBlocked] = useState(new Set());
  useEffect(() => {
    let current = true;
    if (!user?.email || isGuest) { setBlocked(new Set()); return; }
    const load = async () => {
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
