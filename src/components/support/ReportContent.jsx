import { useState } from 'react';
import { Flag } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REPORT_CATEGORIES, REPORT_TARGETS, submitReport } from '@/lib/moderation';

/** The author's email for blocking, looked up by profile id when the row only has that. */
async function resolveAuthorEmail(authorEmail, authorProfileId) {
  if (authorEmail) return authorEmail;
  if (!authorProfileId) return null;
  const { data } = await supabase.rpc('read_profiles').select('email').eq('id', authorProfileId).maybeSingle();
  return data?.email || null;
}

/**
 * Report button for anything a member publishes. Files a row in
 * content_reports for the admin Reports view, and can block the author in
 * the same step. Signed-out visitors and the item's own author do not see it.
 *
 * targetType is one of REPORT_TARGETS (forum_post, gecko_image, gecko,
 * profile, ...). `entity` and `recordId` are the older prop names.
 */
export default function ReportContent({
  targetType,
  targetId,
  entity,
  recordId,
  authorEmail,
  authorProfileId,
  authorAuthId,
  excerpt = '',
  label,
  className = '',
  compact = false,
}) {
  const type = targetType || entity;
  const id = targetId ?? recordId;
  const { user, isGuest } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('other');
  const [busy, setBusy] = useState(false);
  if (!user || isGuest || !type || id == null || id === '') return null;
  if (authorEmail && authorEmail === user.email) return null;
  if (authorProfileId && String(authorProfileId) === String(user.id)) return null;
  if (authorAuthId && String(authorAuthId) === String(user.auth_user_id)) return null;
  const canBlock = Boolean(authorEmail || authorProfileId);
  const what = (REPORT_TARGETS[type]?.label || 'item').toLowerCase();

  const submit = async (block) => {
    if (busy) return;
    if (!reason.trim()) { toast({ title: 'Please describe the problem' }); return; }
    setBusy(true);
    try {
      const { alreadyReported } = await submitReport({
        targetType: type, targetId: id, category, reason, excerpt, page: window.location.pathname,
      });
      if (block) {
        const email = await resolveAuthorEmail(authorEmail, authorProfileId);
        const { error } = email
          ? await supabase.from('user_blocks').upsert({ blocker_email: user.email, blocked_email: email }, { onConflict: 'blocker_email,blocked_email', ignoreDuplicates: true })
          : { error: { message: 'We could not find this member to block.' } };
        if (error) {
          toast({ title: 'Report saved; blocking failed', description: error.message, variant: 'destructive' });
          return;
        }
        window.dispatchEvent(new Event('user_blocks_changed'));
      }
      toast({
        title: block ? 'Reported and blocked' : alreadyReported ? 'You already reported this' : 'Report sent',
        description: block
          ? 'You will no longer see this member\'s posts, photos or listings, and they cannot message you.'
          : 'A moderator will review it. Thank you for helping keep Geck Inspect safe.',
      });
      setOpen(false); setReason(''); setCategory('other');
    } catch (error) {
      toast({ title: 'Report was not saved', description: error.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const buttonText = label || (canBlock ? 'Report or block' : 'Report');
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button variant="ghost" size="sm" className={`touch:min-h-11 text-slate-400 hover:text-rose-300 ${className}`} aria-label={`Report this ${what}`}>
        <Flag className={compact ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 mr-1.5'} />
        {!compact && buttonText}
      </Button>
    </DialogTrigger>
    <DialogContent onClick={(e) => e.stopPropagation()}>
      <DialogTitle>Report this {what}</DialogTitle>
      <DialogDescription>Tell us about harassment, scams, misleading listings, stolen photos, animal welfare worries or anything else that breaks the rules. A moderator reviews every report.</DialogDescription>
      <div className="space-y-2">
        <Label htmlFor="content-report-category">What kind of problem?</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="content-report-category"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REPORT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="content-report-reason">What happened?</Label>
        <Textarea id="content-report-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={3000} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => submit(false)}>Submit report</Button>
        {canBlock && <Button variant="destructive" disabled={busy} onClick={() => submit(true)}>Report and block member</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}
