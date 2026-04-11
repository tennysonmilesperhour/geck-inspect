import React, { useEffect, useState } from 'react';
import { ChangeLog } from '@/entities/all';
import { InvokeLLM } from '@/lib/invokeLlm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  PlusCircle,
  Trash2,
  Send,
  Sparkles,
  Loader2,
  CheckCircle2,
  Edit,
  Megaphone,
} from 'lucide-react';
import { format } from 'date-fns';

/**
 * Changelog manager — admins log deploy notes, optionally run them through
 * an LLM for plain-English bullets, save as draft, publish, and (optionally)
 * broadcast the published entry to users via the Mass Messaging surface.
 *
 * This version drops the dead `base44.integrations.Core.InvokeLLM` call and
 * uses our own Supabase edge function via `@/lib/invokeLlm` instead. It also
 * switches from `base44.entities.ChangeLog` to the Supabase entity client.
 */

function defaultForm() {
  return {
    title: '',
    week_label: `Deploy ${format(new Date(), 'MMM d, yyyy')}`,
    raw_notes: '',
    bullet_points: [''],
  };
}

export default function ChangeLogManager() {
  const [entries, setEntries] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm());
  const { toast } = useToast();

  const load = async () => {
    setIsLoading(true);
    try {
      const all = await ChangeLog.list('-created_date');
      setEntries(Array.isArray(all) ? all : []);
    } catch (err) {
      console.error('Load changelog failed:', err);
      toast({
        title: 'Error',
        description: 'Could not load changelog entries.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAISummarize = async () => {
    if (!form.raw_notes.trim()) {
      toast({
        title: 'Nothing to summarize',
        description: 'Paste raw notes or a git log into the box first.',
        variant: 'destructive',
      });
      return;
    }
    setIsGenerating(true);
    try {
      const prompt = `You are summarizing app changes for users of a crested gecko management app called "Geck Inspect".

Convert these raw developer notes (git commit messages, dev diary entries, or bullet scratch) into 4-10 concise, plain-English bullet points that non-technical users will understand. Focus on what changed and why users should care, NOT implementation details. Start each bullet with a verb like "Added", "Fixed", "Improved", "Faster", "Now you can...".

Skip anything that's purely internal (refactors, typos, test changes, CI config). Combine related commits into a single bullet.

Raw notes:
${form.raw_notes}

Return a JSON object with { "title": "short catchy headline, 3-6 words", "bullets": ["bullet 1", ...] }.`;

      const result = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'bullets'],
        },
      });

      setForm((f) => ({
        ...f,
        title: result.title || f.title,
        bullet_points: Array.isArray(result.bullets) && result.bullets.length > 0
          ? result.bullets
          : f.bullet_points,
      }));
      toast({ title: 'Summarized', description: 'Review and edit before saving.' });
    } catch (err) {
      console.error('AI summarize failed:', err);
      toast({
        title: 'AI summarize failed',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    }
    setIsGenerating(false);
  };

  const handleSave = async (publish = false) => {
    if (!form.title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const data = {
      title: form.title.trim(),
      week_label: form.week_label.trim(),
      raw_notes: form.raw_notes.trim(),
      bullet_points: form.bullet_points.map((b) => b.trim()).filter(Boolean),
      is_published: publish,
      published_date: publish ? new Date().toISOString() : null,
    };
    try {
      if (editingId) {
        await ChangeLog.update(editingId, data);
      } else {
        await ChangeLog.create(data);
      }
      setIsCreating(false);
      setEditingId(null);
      setForm(defaultForm());
      await load();
      toast({
        title: publish ? 'Published' : 'Saved as draft',
        description: publish ? 'Visible to users on the changelog page.' : null,
      });
    } catch (err) {
      console.error('Save failed:', err);
      toast({
        title: 'Save failed',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    }
    setIsSaving(false);
  };

  const handleTogglePublish = async (entry) => {
    try {
      await ChangeLog.update(entry.id, {
        is_published: !entry.is_published,
        published_date: !entry.is_published ? new Date().toISOString() : null,
      });
      await load();
    } catch (err) {
      console.error('Publish toggle failed:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this changelog entry?')) return;
    try {
      await ChangeLog.delete(id);
      await load();
    } catch (err) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setForm({
      title: entry.title || '',
      week_label: entry.week_label || '',
      raw_notes: entry.raw_notes || '',
      bullet_points:
        Array.isArray(entry.bullet_points) && entry.bullet_points.length > 0
          ? entry.bullet_points
          : [''],
    });
    setIsCreating(true);
  };

  const handleBroadcast = (entry) => {
    // Hand off to the Mass Messaging tab via a custom event. AdminPanel
    // listens for this and pre-fills the messaging form, so the admin can
    // review before sending to users.
    const bullets = (entry.bullet_points || []).map((b) => `• ${b}`).join('\n');
    window.dispatchEvent(
      new CustomEvent('admin:prefill-message', {
        detail: {
          subject: `${entry.title}`,
          content: `We just shipped a new update to Geck Inspect!\n\n${bullets}\n\nThanks for being part of the community.`,
        },
      })
    );
    toast({
      title: 'Ready to broadcast',
      description: 'Opened in Mass Messaging — review and send.',
    });
  };

  const addBullet = () => setForm((f) => ({ ...f, bullet_points: [...f.bullet_points, ''] }));
  const updateBullet = (i, val) =>
    setForm((f) => {
      const arr = [...f.bullet_points];
      arr[i] = val;
      return { ...f, bullet_points: arr };
    });
  const removeBullet = (i) =>
    setForm((f) => ({
      ...f,
      bullet_points: f.bullet_points.filter((_, idx) => idx !== i),
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Changelog & Deploy Log
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Log changes between deploys. AI-summarize raw notes, publish, and optionally broadcast to users.
          </p>
        </div>
        {!isCreating && (
          <Button
            onClick={() => {
              setEditingId(null);
              setForm(defaultForm());
              setIsCreating(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <PlusCircle className="w-4 h-4 mr-2" /> New entry
          </Button>
        )}
      </div>

      {isCreating && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-100 text-base">
              {editingId ? 'Edit entry' : 'New deploy log entry'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Title</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Weight Tracking Overhaul"
                  className="bg-slate-800 border-slate-700 text-slate-100"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Label</label>
                <Input
                  value={form.week_label}
                  onChange={(e) => setForm((f) => ({ ...f, week_label: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-slate-100"
                  placeholder="e.g. Deploy Apr 11, 2026"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Raw notes (paste git log output, commit messages, or scratch notes)
              </label>
              <Textarea
                value={form.raw_notes}
                onChange={(e) => setForm((f) => ({ ...f, raw_notes: e.target.value }))}
                placeholder={`Paste output of \`git log --oneline origin/main..HEAD\` or just bullet-scratch what changed since last deploy. The AI will turn it into user-facing bullets.`}
                className="bg-slate-800 border-slate-700 text-slate-100 h-32 font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="mt-2 border-emerald-600 text-emerald-400 hover:bg-emerald-900/20"
                onClick={handleAISummarize}
                disabled={isGenerating || !form.raw_notes.trim()}
              >
                {isGenerating ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 mr-1" />
                )}
                AI summarize
              </Button>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-2 block">Bullet points (what users see)</label>
              <div className="space-y-2">
                {form.bullet_points.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={b}
                      onChange={(e) => updateBullet(i, e.target.value)}
                      placeholder={`Change ${i + 1}...`}
                      className="bg-slate-800 border-slate-700 text-slate-100"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeBullet(i)}
                      className="text-slate-500 hover:text-red-400 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addBullet}
                  className="border-slate-700 text-slate-300"
                >
                  <PlusCircle className="w-3 h-3 mr-1" /> Add bullet
                </Button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setEditingId(null);
                  setForm(defaultForm());
                }}
                className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                Save draft
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Save & publish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-slate-400 text-center py-8">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-slate-400 text-center py-12 border border-dashed border-slate-800 rounded-lg">
          No changelog entries yet. Create your first entry to track what changed between deploys.
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-100">{entry.title}</span>
                      {entry.is_published ? (
                        <Badge className="bg-emerald-600 text-white text-xs">Published</Badge>
                      ) : (
                        <Badge className="bg-slate-700 text-slate-300 text-xs">Draft</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{entry.week_label}</p>
                    <ul className="mt-2 space-y-1">
                      {(entry.bullet_points || []).slice(0, 4).map((b, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                          {b}
                        </li>
                      ))}
                      {(entry.bullet_points || []).length > 4 && (
                        <li className="text-xs text-slate-500">
                          +{entry.bullet_points.length - 4} more
                        </li>
                      )}
                    </ul>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(entry)}
                      className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs h-8"
                    >
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    {entry.is_published && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBroadcast(entry)}
                        className="border-emerald-600 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50 text-xs h-8"
                      >
                        <Megaphone className="w-3 h-3 mr-1" /> Broadcast
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTogglePublish(entry)}
                      className={`text-xs h-8 ${
                        entry.is_published
                          ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : 'border-emerald-600 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50'
                      }`}
                    >
                      {entry.is_published ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-400 hover:text-red-300 h-8"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
