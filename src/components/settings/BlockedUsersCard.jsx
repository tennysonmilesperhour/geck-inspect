import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function BlockedUsersCard({ user }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const load = useCallback(async () => {
    if (!user?.email) return;
    const { data, error: fetchError } = await supabase.from('user_blocks').select('blocked_email').eq('blocker_email', user.email);
    setError(fetchError?.message || null);
    if (!fetchError) setRows(data || []);
  }, [user?.email]);
  useEffect(() => { load(); window.addEventListener('user_blocks_changed', load); return () => window.removeEventListener('user_blocks_changed', load); }, [load]);
  return <Card className="bg-slate-900 border-slate-700"><CardHeader><CardTitle>Blocked messages</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-sm text-slate-400">Blocking prevents new messages between your account and the blocked account. Reports remain in the moderation inbox if you unblock someone.</p>
    {error && <p role="alert">Could not load your block list. <button className="underline" onClick={load}>Retry</button></p>}
    {!error && !rows.length && <p>No blocked accounts.</p>}
    {rows.map(row => <div className="flex items-center justify-between gap-3" key={row.blocked_email}><span className="truncate">{row.blocked_email}</span><Button variant="outline" onClick={async () => {
      const { error: deleteError } = await supabase.from('user_blocks').delete().eq('blocker_email', user.email).eq('blocked_email', row.blocked_email);
      if (deleteError) toast({ title: 'Could not unblock', description: deleteError.message, variant: 'destructive' });
      else await load();
    }}>Unblock</Button></div>)}
  </CardContent></Card>;
}
