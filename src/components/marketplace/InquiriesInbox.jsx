import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail, MessageCircle, Phone, CheckCheck } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

/**
 * Buyer inquiries sent from the breeder page's "Contact breeder" and
 * "Inquire" buttons (send-breeder-inquiry writes breeder_inquiries and
 * emails the breeder). The breeder sees only their own; the buyer gave
 * their email so the breeder can answer, and Reply opens the breeder's
 * own email app.
 */

const STATUS_STYLES = {
  new: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  read: 'bg-slate-700/50 text-slate-300 border-slate-600',
  replied: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

export function inquiryStatus(row) {
  if (row?.replied_at || row?.status === 'replied') return 'replied';
  if (row?.read_at || row?.status === 'read') return 'read';
  return 'new';
}

export function replyHref(row) {
  const subject = row.gecko_name ? `Re: your inquiry about ${row.gecko_name}` : 'Re: your inquiry on Geck Inspect';
  const quoted = String(row.message || '').split('\n').map((l) => `> ${l}`).join('\n');
  const body = `Hi ${row.buyer_name || 'there'},\n\n\n\n${quoted}`;
  return `mailto:${encodeURIComponent(row.buyer_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function InquiriesInbox({ userEmail, onCountChange }) {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('breeder_inquiries')
      .select('id, buyer_name, buyer_email, buyer_phone, gecko_id, gecko_name, gecko_passport_code, message, status, created_at, read_at, replied_at')
      .ilike('breeder_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(200);
    if (err) setError(err.message);
    else {
      setError(null);
      setRows(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, [userEmail]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    onCountChange?.(rows.filter((r) => inquiryStatus(r) === 'new').length);
  }, [rows, onCountChange]);

  const mark = async (row, status) => {
    const now = new Date().toISOString();
    const patch = status === 'replied'
      ? { status: 'replied', replied_at: now, read_at: row.read_at || now }
      : { status: 'read', read_at: now };
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    const { error: err } = await supabase.from('breeder_inquiries').update(patch).eq('id', row.id);
    if (err) {
      toast({ title: 'Could not update the inquiry', description: err.message, variant: 'destructive' });
      load();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }
  if (error) {
    return <p className="text-sm text-red-300 py-6">Could not load inquiries: {error}</p>;
  }
  if (rows.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-8 text-center text-slate-400">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No inquiries yet. When a buyer uses "Contact breeder" or "Inquire" on your breeder page, it shows here and in your email.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const status = inquiryStatus(row);
        return (
          <Card key={row.id} className="bg-slate-900 border-slate-700">
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-100 truncate">{row.buyer_name || row.buyer_email}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(row.created_at).toLocaleString()}
                    {row.gecko_name && (
                      <>
                        {' · about '}
                        {row.gecko_passport_code ? (
                          <Link to={`/passport/${row.gecko_passport_code}`} className="text-emerald-300 hover:underline">{row.gecko_name}</Link>
                        ) : (
                          <span className="text-slate-200">{row.gecko_name}</span>
                        )}
                      </>
                    )}
                  </p>
                </div>
                <Badge variant="outline" className={`capitalize ${STATUS_STYLES[status]}`}>{status}</Badge>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{row.message}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {row.buyer_email}</span>
                {row.buyer_phone && (
                  <a href={`tel:${row.buyer_phone}`} className="inline-flex items-center gap-1 hover:text-slate-200">
                    <Phone className="w-3.5 h-3.5" /> {row.buyer_phone}
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2 justify-end pt-1">
                {status === 'new' && (
                  <Button variant="outline" size="sm" className="border-slate-600" onClick={() => mark(row, 'read')}>
                    Mark read
                  </Button>
                )}
                {status !== 'replied' && (
                  <Button variant="outline" size="sm" className="border-slate-600" onClick={() => mark(row, 'replied')}>
                    <CheckCheck className="w-4 h-4 mr-1" /> Mark replied
                  </Button>
                )}
                <Button asChild size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white">
                  <a href={replyHref(row)} onClick={() => { if (status === 'new') mark(row, 'read'); }}>
                    <Mail className="w-4 h-4 mr-1" /> Reply by email
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
