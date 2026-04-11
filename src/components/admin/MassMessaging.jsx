import React, { useEffect, useState } from 'react';
import { User, DirectMessage, Notification, ChangeLog } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
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
 * Mass messaging — broadcast an announcement to a target audience.
 *
 * Each user in the target group receives:
 *   1. A DirectMessage from the admin's email
 *   2. A Notification row pointing at /Messages
 *
 * AI generation now goes through our own invoke-llm edge function instead
 * of the dead Base44 `InvokeLLM`. The generator reads the latest published
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

function filterUsers(allUsers, targetGroup) {
  switch (targetGroup) {
    case 'experts':
      return allUsers.filter((u) => u.is_expert === true);
    case 'admins':
      return allUsers.filter((u) => u.role === 'admin');
    case 'non_experts':
      return allUsers.filter((u) => !u.is_expert);
    default:
      return allUsers;
  }
}

export default function MassMessaging({ prefill, onPrefillConsumed }) {
  const [targetGroup, setTargetGroup] = useState('all');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sendProgress, setSendProgress] = useState(null);
  const { toast } = useToast();

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
      // Grab the most recent published changelog entry as the source of
      // truth so we never fabricate features.
      const entries = await ChangeLog.list('-created_date');
      const latest =
        entries.find((e) => e.is_published) || entries[0] || null;

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

Use ONLY the bullets below — do NOT invent features that aren't listed.

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
        throw new Error('Not signed in — cannot send.');
      }

      const allUsers = await User.list();
      const targetUsers = filterUsers(allUsers, targetGroup).filter(
        (u) => u.email && u.email !== adminEmail
      );
      setSendProgress({ sent: 0, total: targetUsers.length, failures: 0 });

      let sent = 0;
      let failures = 0;
      for (const user of targetUsers) {
        try {
          await DirectMessage.create({
            sender_email: adminEmail,
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
    <Card className="bg-slate-900 border-slate-800">
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
            disabled={isSending || !subject.trim() || !content.trim()}
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
                Send broadcast
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
