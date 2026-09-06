import { useState } from 'react';
import { SupportMessage } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ReportContent({ entity, recordId, authorEmail, excerpt = '' }) {
  const { user, isGuest } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user || isGuest || authorEmail === user.email) return null;
  const submit = async (block) => {
    if (busy) return;
    if (!reason.trim()) { toast({ title: 'Please describe the problem' }); return; }
    setBusy(true);
    try {
      const report = await SupportMessage.create({ user_email: user.email, subject: `Content report: ${entity}`,
        body: `Reason: ${reason.trim()}\nEntity: ${entity}\nRecord: ${recordId}\nAuthor: ${authorEmail || 'unknown'}\nExcerpt: ${excerpt.slice(0, 3000)}`,
        source: 'support', page: window.location.pathname, status: 'new' });
      if (block && authorEmail) {
        const { error } = await supabase.from('user_blocks').upsert({ blocker_email: user.email, blocked_email: authorEmail }, { onConflict: 'blocker_email,blocked_email', ignoreDuplicates: true });
        if (error) {
          toast({ title: 'Report saved; blocking failed', description: `Report ${report.id}. ${error.message}`, variant: 'destructive' });
          return;
        }
        window.dispatchEvent(new Event('user_blocks_changed'));
      }
      toast({ title: block ? 'Report saved and user blocked' : 'Report sent to moderation', description: `Reference ${report.id}. ${block ? 'New messages between these accounts are blocked.' : 'Our support team can review this record.'}` });
      setOpen(false); setReason('');
    } catch (error) { toast({ title: 'Report was not saved', description: error.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="ghost" size="sm">Report{authorEmail ? ' or block' : ''}</Button></DialogTrigger>
    <DialogContent><DialogTitle>Report a problem</DialogTitle><DialogDescription>Tell us about harassment, misleading listings, unsafe content, or another concern. Reports go to the moderation inbox.</DialogDescription>
      <Label htmlFor="content-report-reason">What happened?</Label><Textarea id="content-report-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={3000} />
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => submit(false)}>Submit report</Button>{authorEmail && <Button variant="destructive" disabled={busy} onClick={() => submit(true)}>Report and block messages</Button>}</div>
    </DialogContent>
  </Dialog>;
}
