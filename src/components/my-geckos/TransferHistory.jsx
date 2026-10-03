import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ArrowRightLeft, ArrowUpRight, ArrowDownLeft, ExternalLink, Clock, Check, Ban, Hourglass, Copy, Mail, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { cancelTransfer, claimUrlFor, copyText, effectiveTransferStatus, sendTransferEmail } from '@/lib/transfers';

/**
 * Ownership transfer history for the current user.
 *
 * Shows both directions:
 *   - Outgoing: animals this user sent to someone else (from_user_id = me)
 *   - Incoming: animals sent to this user (to_user_id = me, or to_email = me
 *     for transfers claimed before to_user_id was stamped)
 *
 * A transferred-out animal leaves your collection, so this tab is the only
 * place you can still reference it. Each row links to the animal's public
 * passport, which reflects the animal's CURRENT state (including changes the
 * new owner has made), not a frozen snapshot from the moment you transferred.
 */

const STATUS_META = {
  pending: { label: 'Pending', icon: Hourglass, color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-700/50' },
  claimed: { label: 'Completed', icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-700/50' },
  cancelled: { label: 'Cancelled', icon: Ban, color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700' },
  expired: { label: 'Expired', icon: Clock, color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700' },
};

function StatusBadge({ status, expiresAt }) {
  const effective = effectiveTransferStatus({ status, expires_at: expiresAt });
  const meta = STATUS_META[effective] || STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${meta.bg} ${meta.color}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// Copy link, resend the email, or cancel. Only for a pending transfer
// the signed-in user sent.
function PendingActions({ transfer, onCancelled }) {
  const [busy, setBusy] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const claimUrl = claimUrlFor(transfer.token);

  const handleCopy = async () => {
    const ok = await copyText(claimUrl);
    toast({
      title: ok ? 'Claim link copied' : 'Copy this link',
      description: ok ? `Send it to ${transfer.to_email}.` : claimUrl,
    });
  };

  const handleResend = async () => {
    setBusy('resend');
    const res = await sendTransferEmail(transfer.token);
    setBusy(null);
    toast(res.delivered
      ? { title: 'Email sent', description: `We emailed ${transfer.to_email} the claim link again.` }
      : { title: 'Email not sent', description: 'Copy the link and send it to the buyer yourself.', variant: 'destructive' });
  };

  const handleCancel = async () => {
    setBusy('cancel');
    try {
      await cancelTransfer(transfer.id);
      toast({ title: 'Transfer cancelled', description: 'The claim link no longer works.' });
      if (onCancelled) onCancelled();
    } catch (err) {
      toast({ title: 'Could not cancel', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const btn = 'touch:min-h-11 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border disabled:opacity-50';
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <button type="button" onClick={handleCopy} className={`${btn} border-slate-600 text-slate-300 hover:bg-slate-800`}>
        <Copy className="w-3.5 h-3.5" />
        Copy link
      </button>
      <button type="button" onClick={handleResend} disabled={!!busy} className={`${btn} border-sky-700/60 text-sky-300 hover:bg-sky-900/20`}>
        {busy === 'resend' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
        Resend email
      </button>
      <button type="button" onClick={() => setConfirmCancel(true)} disabled={!!busy} className={`${btn} border-red-800/60 text-red-300 hover:bg-red-900/20`}>
        {busy === 'cancel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
        Cancel transfer
      </button>
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Cancel this transfer?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              The claim link sent to {transfer.to_email} stops working. The animal stays in your collection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600">Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleCancel}>
              Cancel transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TransferRow({ transfer, animal, direction, onChanged }) {
  const isOutgoing = direction === 'outgoing';
  const counterparty = isOutgoing
    ? transfer.to_email
    : (transfer.from_email || 'Previous owner');
  const dateStr = transfer.claimed_at || transfer.created_date;
  const img = animal?.image_urls?.[0];

  return (
    <div className="flex items-start sm:items-center gap-3 p-3 rounded-xl border border-slate-700 bg-slate-900 hover:border-slate-600 transition-colors">
      {img ? (
        <img src={img} alt={animal?.name || 'Animal'} className="w-12 h-12 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-xl shrink-0">🦎</div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-100 truncate">{animal?.name || 'Unknown animal'}</span>
          <span
            className={`inline-flex items-center gap-1 text-xs ${isOutgoing ? 'text-sky-400' : 'text-violet-400'}`}
          >
            {isOutgoing ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
            {isOutgoing ? 'Sent to' : 'Received from'} {counterparty}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
          <StatusBadge status={transfer.status} expiresAt={transfer.expires_at} />
          {dateStr && <span>{format(new Date(dateStr), 'MMM d, yyyy')}</span>}
          {transfer.sale_price != null && (
            <span className="text-slate-400">
              ${Number(transfer.sale_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
        {isOutgoing && transfer.token && effectiveTransferStatus(transfer) === 'pending' && (
          <PendingActions transfer={transfer} onCancelled={onChanged} />
        )}
      </div>

      {animal?.passport_code && (
        <a
          href={`/passport/${animal.passport_code}`}
          target="_blank"
          rel="noopener noreferrer"
          className="touch:min-h-11 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/20 shrink-0"
          title="View the animal's current passport, including any changes the new owner has made"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Passport
        </a>
      )}
    </div>
  );
}

export default function TransferHistory({ user }) {
  const [isLoading, setIsLoading] = useState(true);
  const [outgoing, setOutgoing] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [animalsById, setAnimalsById] = useState({});
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      const email = user?.email || authData?.user?.email;
      if (!uid && !email) {
        setOutgoing([]);
        setIncoming([]);
        return;
      }

      const [outRes, inRes] = await Promise.all([
        uid
          ? supabase.from('transfer_requests').select('*').eq('from_user_id', uid).order('created_date', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase
          .from('transfer_requests')
          .select('*')
          .or([uid ? `to_user_id.eq.${uid}` : null, email ? `to_email.eq.${email}` : null].filter(Boolean).join(','))
          .order('created_date', { ascending: false }),
      ]);

      const outRows = outRes.data || [];
      // Exclude self-transfers (to me) from the incoming list if they also
      // appear in outgoing, so a row never shows in both columns.
      const outIds = new Set(outRows.map((r) => r.id));
      const inRows = (inRes.data || []).filter((r) => !outIds.has(r.id));

      setOutgoing(outRows);
      setIncoming(inRows);

      // Fetch the animals referenced by either list. animal_id can point at
      // either the geckos or the other_reptiles table, split by animal_type,
      // so look each set up in its own table and merge them by id.
      const allRows = [...outRows, ...inRows];
      const geckoIds = [...new Set(allRows.filter((r) => r.animal_type !== 'other_reptile').map((r) => r.animal_id).filter(Boolean))];
      const reptileIds = [...new Set(allRows.filter((r) => r.animal_type === 'other_reptile').map((r) => r.animal_id).filter(Boolean))];

      const map = {};
      const [geckosRes, reptilesRes] = await Promise.all([
        geckoIds.length > 0
          ? supabase.from('geckos').select('id, name, passport_code, image_urls, morphs_traits').in('id', geckoIds)
          : Promise.resolve({ data: [] }),
        reptileIds.length > 0
          ? supabase.from('other_reptiles').select('id, name, species, morph, image_urls').in('id', reptileIds)
          : Promise.resolve({ data: [] }),
      ]);
      for (const g of geckosRes.data || []) map[g.id] = g;
      for (const r of reptilesRes.data || []) map[r.id] = r;
      setAnimalsById(map);
    } catch (err) {
      console.error('Failed to load transfer history:', err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={ArrowRightLeft}
        title="Couldn't load transfers"
        message="Something went wrong loading your transfer history. Please try again in a moment."
      />
    );
  }

  if (outgoing.length === 0 && incoming.length === 0) {
    return (
      <EmptyState
        icon={ArrowRightLeft}
        title="No transfers yet"
        message="When you transfer an animal to another keeper (or receive one), it shows up here with a link to its current passport."
      />
    );
  }

  return (
    <div className="space-y-8">
      {outgoing.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-sky-400" />
            Transferred out ({outgoing.length})
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            These animals have left your collection. Open a passport to see the animal's current details, including anything the new owner has changed.
          </p>
          <div className="space-y-2">
            {outgoing.map((t) => (
              <TransferRow key={t.id} transfer={t} animal={animalsById[t.animal_id]} direction="outgoing" onChanged={load} />
            ))}
          </div>
        </section>
      )}

      {incoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-violet-400" />
            Received ({incoming.length})
          </h2>
          <div className="space-y-2">
            {incoming.map((t) => (
              <TransferRow key={t.id} transfer={t} animal={animalsById[t.animal_id]} direction="incoming" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
