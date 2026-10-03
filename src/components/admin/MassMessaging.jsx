import { useEffect, useState } from 'react';
import { DirectMessage, Notification, ChangeLog } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { fetchAccountDirectory, broadcastRecipients } from '@/lib/adminData';
import { InvokeLLM } from '@/lib/invokeLlm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Send,
  Users as UsersIcon,
  Shield,
  Award,
  Loader2,
  Sparkles,
  Megaphone,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Mass messaging, broadcast an announcement to a target audience.
 *
 * Each user in the target group receives:
 *   1. A DirectMessage from the admin's email
 *   2. A Notification row pointing at /Messages
 *
 * AI generation now goes through our own invoke-llm edge function instead
 * of a dead hosted `InvokeLLM`. The generator reads the latest published
 * changelog entry and uses it as the source material, so the output is
 * tied to real deploys instead of fabricated features.
 *
 * Listens for a `admin:prefill-message` window event so the ChangeLog
 * Manager's "Broadcast" button can hand off a subject+body without the
 * admin having to copy-paste.
 */

const TARGET_GROUPS = [
  {
    value: 'all',
    label: 'All Users',
    icon: <UsersIcon className="w-4 h-4" />,
    color: 'bg-blue-600',
  },
  {
    value: 'experts',
    label: 'Experts Only',
    icon: <Award className="w-4 h-4" />,
    color: 'bg-emerald-600',
  },
  {
    value: 'reviewers',
    label: 'Expert Reviewers',
    icon: <Award className="w-4 h-4" />,
    color: 'bg-teal-600',
  },
  {
    value: 'admins',
    label: 'Admins Only',
    icon: <Shield className="w-4 h-4" />,
    color: 'bg-purple-600',
  },
  {
    value: 'non_experts',
    label: 'Regular Users',
    icon: <UsersIcon className="w-4 h-4" />,
    color: 'bg-slate-600',
  },
];

export default function MassMessaging({ prefill, onPrefillConsumed }) {
  const [targetGroup, setTargetGroup] = useState('all');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sendProgress, setSendProgress] = useState(null);
  const [directory, setDirectory] = useState(null);
  const [senderEmail, setSenderEmail] = useState(null);
  const [directoryError, setDirectoryError] = useState(null);
  const { toast } = useToast();

  // Load the account list once so the recipient count is shown before
  // anything is sent. Only real accounts (with a login) are counted;
  // legacy rows with no login cannot read a message.
  const loadDirectory = async () => {
    setDirectoryError(null);
    try {
      const [{ data: { user: sbUser } }, rows] = await Promise.all([
        supabase.auth.getUser(),
        fetchAccountDirectory(),
      ]);
      setSenderEmail(sbUser?.email || null);
      setDirectory(rows);
    } catch (err) {
      console.error('Recipient list failed:', err);
      setDirectoryError(err?.message || 'Could not load recipients.');
    }
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  const recipients = directory ? broadcastRecipients(directory, targetGroup, senderEmail) : null;

  // Consume a prefill payload handed down from AdminPanel (e.g. when the
  // Changelog manager clicked "Broadcast" on a published entry).
  useEffect(() => {
    if (prefill) {
      if (prefill.subject) setSubject(prefill.subject);
      if (prefill.content) setContent(prefill.content);
      onPrefillConsumed?.();
    }
  }, [prefill, onPrefillConsumed]);

  const generateUpdateAnnouncement = async () => {
    setIsGenerating(true);
    try {
      // Pick the most-recently *published* changelog entry so the
      // announcement always describes the current release.
      //
      // We can't trust `-created_date` here: the April 2026 entries were
      // backfilled from the BUILTIN_UPDATES fallback in mid-May, so their
      // created_date is newer than the genuinely-most-recent May entry.
      // Sorting by created_date and picking the first published row would
      // (and did) surface April instead of May. Sort by published_date
      // among published rows, with created_date as a tiebreaker.
      const entries = await ChangeLog.list('-created_date');
      const published = (entries || []).filter((e) => e.is_published);
      const byPublished = (a, b) => {
        const ap = a.published_date ? new Date(a.published_date).getTime() : 0;
        const bp = b.published_date ? new Date(b.published_date).getTime() : 0;
        if (bp !== ap) return bp - ap;
        const ac = a.created_date ? new Date(a.created_date).getTime() : 0;
        const bc = b.created_date ? new Date(b.created_date).getTime() : 0;
        return bc - ac;
      };
      const latest = published.sort(byPublished)[0] || entries?.[0] || null;

      if (!latest) {
        toast({
          title: 'No changelog to summarize',
          description:
            'Create and publish a changelog entry first, then auto-generate from there.',
          variant: 'destructive',
        });
        setIsGenerating(false);
        return;
      }

      const bullets = (latest.bullet_points || []).map((b) => `- ${b}`).join('\n');
      const prompt = `You are writing a platform update announcement for users of "Geck Inspect", a crested-gecko management web app.

Use ONLY the bullets below, do NOT invent features that aren't listed.

Title: ${latest.title}
Bullets:
${bullets}

Write a friendly, professional announcement (under 250 words) addressed to the community. Thank them briefly at the end. Format as markdown with a short opening paragraph, a bullet list of what's new, and a closing line.

Return JSON: { "subject": "short email-style subject, under 70 chars", "content": "markdown body" }.`;

      const result = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['subject', 'content'],
        },
      });

      setSubject(result.subject || '');
      setContent(result.content || '');
      toast({
        title: 'Draft generated',
        description: `Source: "${latest.title}". Review and edit before sending.`,
      });
    } catch (err) {
      console.error('Generate failed:', err);
      toast({
        title: 'Generation failed',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    }
    setIsGenerating(false);
  };

  const handleSend = async () => {
    if (!targetGroup || !subject.trim() || !content.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Pick a target group and write a subject and body.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    setSendProgress({ sent: 0, total: 0, failures: 0 });
    try {
      const {
        data: { user: sbUser },
      } = await supabase.auth.getUser();
      const adminEmail = sbUser?.email;
      if (!adminEmail) {
        throw new Error('Not signed in, cannot send.');
      }

      const rows = await fetchAccountDirectory();
      const targetUsers = broadcastRecipients(rows, targetGroup, adminEmail);
      if (targetUsers.length === 0) {
        throw new Error('Nobody in this group to send to.');
      }
      const groupLabel = TARGET_GROUPS.find((g) => g.value === targetGroup)?.label || targetGroup;
      if (!window.confirm(`Send "${subject.trim()}" to ${targetUsers.length} account${targetUsers.length === 1 ? '' : 's'} (${groupLabel})?`)) {
        setSendProgress(null);
        setIsSending(false);
        return;
      }
      setSendProgress({ sent: 0, total: targetUsers.length, failures: 0 });

      let sent = 0;
      let failures = 0;
      for (const user of targetUsers) {
        try {
          // Send from the system identity instead of the admin's personal
          // email so the admin's inbox doesn't end up with one outgoing
          // conversation per recipient. Messages.jsx renders this sender
          // as "Geck Inspect Team" with a System badge.
          await DirectMessage.create({
            sender_email: 'system@geckinspect.com',
            recipient_email: user.email,
            content: `**${subject}**\n\n${content}`,
            message_type: 'system',
          });
          // Notifications RLS was just fixed, so this will actually land now.
          try {
            await Notification.create({
              user_email: user.email,
              type: 'announcement',
              content: subject,
              link: '/Messages',
              metadata: { is_mass_message: true },
            });
          } catch (nErr) {
            // Non-fatal: message went through, notification failed.
            console.warn(`Notification failed for ${user.email}:`, nErr);
          }
          sent++;
        } catch (err) {
          console.error(`Failed to send to ${user.email}:`, err);
          failures++;
        }
        setSendProgress({ sent, total: targetUsers.length, failures });
      }

      toast({
        title: 'Broadcast complete',
        description: `Sent to ${sent} users${failures ? `, ${failures} failed` : ''}.`,
      });
      if (!failures) {
        setSubject('');
        setContent('');
      }
    } catch (err) {
      console.error('Send failed:', err);
      toast({
        title: 'Send failed',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    }
    setIsSending(false);
  };

  const selectedGroupInfo = TARGET_GROUPS.find((g) => g.value === targetGroup);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Megaphone className="w-5 h-5" />
          Mass Messaging & Announcements
        </CardTitle>
        <p className="text-sm text-slate-400">
          Reaches users via DirectMessage + in-app notification. Use the Changelog Manager's
          "Broadcast" button to auto-fill this form from a published deploy entry.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-slate-200">Target audience</Label>
          <Select value={targetGroup} onValueChange={setTargetGroup}>
            <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
              <SelectValue placeholder="Select target group" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
              {TARGET_GROUPS.map((group) => (
                <SelectItem key={group.value} value={group.value}>
                  <div className="flex items-center gap-2">
                    {group.icon}
                    <span>{group.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedGroupInfo && (
            <Badge
              className={`${selectedGroupInfo.color} text-white flex items-center gap-1 w-fit`}
            >
              {selectedGroupInfo.icon}
              Sending to: {selectedGroupInfo.label}
            </Badge>
          )}
          <p className="text-sm text-slate-300" aria-live="polite">
            {directoryError
              ? `Could not count recipients: ${directoryError}`
              : recipients === null
                ? 'Counting recipients...'
                : `This will reach ${recipients.length} account${recipients.length === 1 ? '' : 's'}. Legacy rows with no login and your own account are left out.`}
          </p>
        </div>

        <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              AI update generator
            </h3>
            <Button
              onClick={generateUpdateAnnouncement}
              disabled={isGenerating}
              variant="outline"
              size="sm"
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate from latest changelog
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-slate-400">
            Pulls your most recent published changelog entry and drafts a user-facing announcement
            from those exact bullets. Won't invent features.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-slate-200">Subject line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. New features - April deploy"
              className="bg-slate-950 border-slate-700 text-slate-100 mt-1"
            />
          </div>
          <div>
            <Label className="text-slate-200">Message content (markdown OK)</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your announcement here..."
              className="bg-slate-950 border-slate-700 text-slate-100 min-h-48 mt-1"
            />
            <p className="text-xs text-slate-400 mt-1">
              Users receive it as a direct message plus an in-app notification pointing at /Messages.
            </p>
          </div>
        </div>

        {(subject || content) && (
          <div className="p-4 bg-slate-800/40 rounded-lg border border-slate-700">
            <h4 className="font-semibold text-slate-200 mb-2 text-sm">Preview</h4>
            {subject && <p className="font-bold text-slate-100 mb-2">{subject}</p>}
            {content && (
              <div className="text-slate-300 whitespace-pre-wrap text-sm">{content}</div>
            )}
          </div>
        )}

        {sendProgress && (
          <div className="p-3 rounded-lg border border-emerald-800 bg-emerald-950/40 text-sm text-emerald-300">
            Sent {sendProgress.sent} / {sendProgress.total}
            {sendProgress.failures > 0 && ` · ${sendProgress.failures} failures`}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-slate-800">
          <Button
            onClick={handleSend}
            disabled={isSending || !subject.trim() || !content.trim() || (recipients && recipients.length === 0)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
            size="lg"
          >
            {isSending ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                {recipients ? `Send to ${recipients.length}` : 'Send broadcast'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
