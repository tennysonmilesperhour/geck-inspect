import { useEffect, useState } from 'react';
import { SupportMessage } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { SUPPORT_EMAIL, SUPPORT_EMAIL_URL } from '@/lib/supportContact';
import { DELETION_REQUEST_SUBJECT, deleteMyAccount } from '@/lib/accountErasure';
import { supabase } from '@/lib/supabaseClient';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';

// The admin alert trigger matches on this subject. It is the fallback when
// automatic deletion is not deployed yet.
const SUBJECT = DELETION_REQUEST_SUBJECT;

export default function AccountDeletionCard({ user }) {
  const [request, setRequest] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const { toast } = useToast();
  useEffect(() => {
    if (!user?.email) return;
    SupportMessage.filter({ user_email: user.email, subject: SUBJECT }, '-created_date', 1)
      .then(rows => setRequest(rows[0] || null)).catch(console.error);
  }, [user?.email]);

  const fileRequest = async () => {
    const existing = await SupportMessage.filter({ user_email: user.email, subject: SUBJECT, status: { $in: ['new', 'in_progress'] } }, '-created_date', 1);
    const saved = existing[0] || await SupportMessage.create({
      user_email: user.email, subject: SUBJECT,
      body: 'I confirm that I want my account and associated personal data deleted. Please review retained shared records and any legal retention requirements, then complete deletion and confirm it to me. Submitted from the signed-in account settings.',
      source: 'support', page: '/Settings', status: 'new',
    });
    setRequest(saved);
    return saved;
  };

  const submit = async () => {
    if (busy || !user?.email || confirmText.trim().toUpperCase() !== 'DELETE') return;
    setBusy(true);
    try {
      const result = await deleteMyAccount();
      const leftover = result.files_failed?.length
        ? ' A few files could not be removed and will be cleared within 30 days.'
        : '';
      const stripe = result.stripe_cancelled ? ' The website subscription was cancelled.' : '';
      toast({
        title: 'Account deleted',
        description: `You are signed out.${stripe} Cancel an App Store or Google Play subscription in the store if you do not want it to renew.${leftover}`,
      });
      try { await supabase.auth.signOut(); } catch { /* the login is already gone */ }
      window.location.assign('/');
    } catch (error) {
      const code = error?.code;
      if (code === 'not_deployed' || code === 'erasure_not_installed') {
        try {
          const saved = await fileRequest();
          toast({
            title: 'Deletion request recorded',
            description: `Automatic deletion is not available yet. Reference ${saved.id}. Support completes it within 30 days. Your account stays active until then.`,
          });
        } catch (fallbackError) {
          toast({ title: 'Request was not saved', description: fallbackError.message || 'Please try again.', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Account was not deleted', description: error.message || 'Please try again.', variant: 'destructive' });
      }
    } finally { setBusy(false); }
  };

  const confirmed = confirmText.trim().toUpperCase() === 'DELETE';
  return <Card className="border-red-900 bg-slate-900">
    <CardHeader><CardTitle>Delete account</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-slate-300">Delete your account and personal data from this screen. Your login is removed. Records other keepers still depend on, such as lineage and forum posts, stay up without your name.</p>
      <p className="text-sm text-slate-400">Export your records first. If automatic deletion is unavailable, this files a request and support finishes it within 30 days.</p>
      <p className="text-sm text-slate-400">A website membership is cancelled as part of deletion so the card is not charged again. An App Store or Google Play subscription is not cancelled here. Cancel that in the store settings if you do not want it to renew.</p>
      <p className="text-sm text-slate-400">For deletion questions, email <a href={SUPPORT_EMAIL_URL} className="text-emerald-300 underline break-all">{SUPPORT_EMAIL}</a>.</p>
      {request && <p role="status" className="text-sm">Request {request.id}: {request.status.replaceAll('_', ' ')}. For an update, include this reference in the support form.</p>}
      <AlertDialog onOpenChange={(open) => { if (!open) setConfirmText(''); }}>
        <AlertDialogTrigger asChild><Button variant="destructive" disabled={busy || ['new','in_progress'].includes(request?.status)}>Delete my account</Button></AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your login and personal data. It does not cancel an App Store or Google Play subscription. Type DELETE to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            aria-label="Type DELETE to confirm"
            autoComplete="off"
            placeholder="DELETE"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep my account</AlertDialogCancel>
            <Button variant="destructive" disabled={busy || !confirmed} onClick={submit}>{busy ? 'Deleting...' : 'Delete my account'}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardContent>
  </Card>;
}
