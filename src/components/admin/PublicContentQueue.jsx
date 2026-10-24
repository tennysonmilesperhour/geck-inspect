import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { REPORT_TARGETS } from '@/lib/moderation';

export default function PublicContentQueue() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    const result = await supabase.rpc('admin_public_content_queue', { p_status: status });
    setError(result.error?.message || '');
    setRows(result.data || []);
    setLoading(false);
  }, [status]);
  useEffect(() => { load(); }, [load]);
  const review = async (row, approve) => {
    setBusy(true);
    const result = await supabase.rpc('review_public_content', {
      p_target_type: row.target_type, p_target_id: row.target_id,
      p_revision: row.revision, p_approve: approve,
    });
    if (result.error) setError(result.error.message);
    else await load();
    setBusy(false);
  };
  return <Card className="mb-6">
    <CardHeader>
      <CardTitle>Publication approvals</CardTitle>
      <p className="text-sm text-slate-400">Text with no photo or link from a member in good standing, and anything from members with at least 2 approved items, is approved automatically. Items here were held by those rules: a held word, a photo or link from a new member, an author with rejected or hidden content, or an edit of something not yet approved. Held items stay visible only to their owner and admins. Rejection keeps them private. Held words are in the moderation_held_terms table.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex gap-2">
        {['pending', 'rejected'].map(value => <Button key={value} variant={status === value ? 'default' : 'outline'} disabled={busy} onClick={() => setStatus(value)}>{value === 'pending' ? 'Awaiting approval' : 'Rejected'}</Button>)}
        <Button variant="ghost" disabled={busy || loading} onClick={load}>Refresh approvals</Button>
      </div>
      {error && <p role="alert" className="text-rose-300">{error}</p>}
      {loading ? <p>Loading approvals...</p> : rows.length === 0 ? <p>No {status} items.</p> : rows.map(row => {
        const c = row.content;
        const photos = [...new Set([c.image_url, ...(Array.isArray(c.image_urls) ? c.image_urls : []), ...(Array.isArray(c.training_meta?.image_urls) ? c.training_meta.image_urls : [])].filter(url => typeof url === 'string' && /^https?:\/\//.test(url)))];
        return <article key={`${row.target_type}:${row.target_id}`} className="border border-slate-700 rounded-lg p-4 space-y-3">
          <p className="text-sm text-slate-400">{REPORT_TARGETS[row.target_type]?.label} · {c.created_by} · Revision {row.revision}</p>
          {c.approval_hold_reason && <p className="text-sm text-amber-300">Held: {c.approval_hold_reason}</p>}
          <h3 className="font-semibold break-words">{c.title || c.primary_morph || 'Submitted content'}</h3>
          <p className="whitespace-pre-wrap break-words">{c.content || c.notes}</p>
          {c.author_name && <p>Author: {c.author_name}</p>}
          <div className="flex flex-wrap gap-3">{photos.map(url => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt="Submitted for approval" className="max-w-full w-64 object-contain" loading="lazy" /></a>)}</div>
          {row.target_type === 'gecko_image' && <details><summary>All photo details</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(c, null, 2)}</pre></details>}
          <div className="flex gap-2"><Button disabled={busy} onClick={() => review(row, true)}>Approve publication</Button><Button variant="outline" disabled={busy || status === 'rejected'} onClick={() => review(row, false)}>Reject</Button></div>
        </article>;
      })}
    </CardContent>
  </Card>;
}
