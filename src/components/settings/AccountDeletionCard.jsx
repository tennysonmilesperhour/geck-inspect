import { useEffect, useState } from 'react';
import { SupportMessage } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';

const SUBJECT = 'Account deletion request';
export default function AccountDeletionCard({ user }) {
  const [request, setRequest] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  useEffect(() => {
    if (!user?.email) return;
    SupportMessage.filter({ user_email: user.email, subject: SUBJECT }, '-created_date', 1)
      .then(rows => setRequest(rows[0] || null)).catch(console.error);
  }, [user?.email]);
  const submit = async () => {
    if (busy || !user?.email) return;
    setBusy(true);
    try {
      const existing = await SupportMessage.filter({ user_email: user.email, subject: SUBJECT, status: { $in: ['new', 'in_progress'] } }, '-created_date', 1);
      const saved = existing[0] || await SupportMessage.create({
        user_email: user.email, subject: SUBJECT,
        body: 'I confirm that I want my account and associated personal data deleted. Please review retained shared records and any legal retention requirements, then complete deletion and confirm it to me. Submitted from the signed-in account settings.',
        source: 'support', page: '/Settings', status: 'new',
      });
      setRequest(saved);
      toast({ title: 'Deletion request recorded', description: `Reference ${saved.id}. Your account remains active until support completes the request.` });
    } catch (error) {
      toast({ title: 'Request was not saved', description: error.message || 'Please try again.', variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return <Card className="border-red-900 bg-slate-900">
    <CardHeader><CardTitle>Delete account</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-slate-300">Request deletion of your account and personal data. This creates a tracked request in our support inbox. Support must complete the deletion; submitting this form does not immediately erase your account.</p>
      <p className="text-sm text-slate-400">Export your records first. Cancel any recurring subscription through its billing provider to stop future renewal charges.</p>
      {request && <p role="status" className="text-sm">Request {request.id}: {request.status.replaceAll('_', ' ')}. For an update, include this reference in the support form.</p>}
      <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" disabled={busy || ['new','in_progress'].includes(request?.status)}>Request account deletion</Button></AlertDialogTrigger>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Submit a deletion request?</AlertDialogTitle><AlertDialogDescription>Support will review your request, arrange deletion of your personal data, and explain any records that must be retained. Your account stays available while the request is being processed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep my account</AlertDialogCancel><AlertDialogAction onClick={submit}>Submit deletion request</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardContent>
  </Card>;
}
