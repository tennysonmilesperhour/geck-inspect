import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, Send, Sparkles, Loader2, CheckCircle2, Edit } from 'lucide-react';
import { format } from 'date-fns';

export default function ChangeLogManager() {
    const [entries, setEntries] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [form, setForm] = useState({
        title: '',
        week_label: `Week of ${format(new Date(), 'MMMM d, yyyy')}`,
        raw_notes: '',
        bullet_points: ['']
    });

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setIsLoading(true);
        const all = await base44.entities.ChangeLog.list('-created_date');
        setEntries(all);
        setIsLoading(false);
    };

    const handleAISummarize = async () => {
        if (!form.raw_notes.trim()) return;
        setIsGenerating(true);
        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `You are summarizing app changes for users of a crested gecko management app called "Geck Inspect". 
Convert these raw developer notes into 4–8 concise, plain-English bullet points that non-technical users can understand.
Focus on what changed, not how. Start each bullet with a verb (e.g. "Added", "Fixed", "Improved").

Raw notes:
${form.raw_notes}

Return ONLY a JSON object like: { "title": "short catchy title", "bullets": ["bullet 1", "bullet 2", ...] }`,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string' },
                        bullets: { type: 'array', items: { type: 'string' } }
                    }
                }
            });
            setForm(f => ({
                ...f,
                title: result.title || f.title,
                bullet_points: result.bullets || f.bullet_points
            }));
        } catch (e) {
            console.error(e);
        }
        setIsGenerating(false);
    };

    const handleSave = async (publish = false) => {
        setIsSaving(true);
        const data = {
            title: form.title,
            week_label: form.week_label,
            raw_notes: form.raw_notes,
            bullet_points: form.bullet_points.filter(b => b.trim()),
            is_published: publish,
            published_date: publish ? new Date().toISOString() : null
        };
        try {
            if (editingId) {
                await base44.entities.ChangeLog.update(editingId, data);
            } else {
                await base44.entities.ChangeLog.create(data);
            }
            setIsCreating(false);
            setEditingId(null);
            setForm({ title: '', week_label: `Week of ${format(new Date(), 'MMMM d, yyyy')}`, raw_notes: '', bullet_points: [''] });
            await load();
        } catch (e) {
            console.error(e);
        }
        setIsSaving(false);
    };

    const handlePublish = async (entry) => {
        await base44.entities.ChangeLog.update(entry.id, {
            is_published: !entry.is_published,
            published_date: !entry.is_published ? new Date().toISOString() : null
        });
        await load();
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this changelog entry?')) return;
        await base44.entities.ChangeLog.delete(id);
        await load();
    };

    const handleEdit = (entry) => {
        setEditingId(entry.id);
        setForm({
            title: entry.title,
            week_label: entry.week_label,
            raw_notes: entry.raw_notes || '',
            bullet_points: entry.bullet_points?.length > 0 ? entry.bullet_points : ['']
        });
        setIsCreating(true);
    };

    const addBullet = () => setForm(f => ({ ...f, bullet_points: [...f.bullet_points, ''] }));
    const updateBullet = (i, val) => setForm(f => {
        const arr = [...f.bullet_points];
        arr[i] = val;
        return { ...f, bullet_points: arr };
    });
    const removeBullet = (i) => setForm(f => ({ ...f, bullet_points: f.bullet_points.filter((_, idx) => idx !== i) }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    Changelog Manager
                </h2>
                {!isCreating && (
                    <Button onClick={() => setIsCreating(true)} className="bg-emerald-600 hover:bg-emerald-700">
                        <PlusCircle className="w-4 h-4 mr-2" /> New Entry
                    </Button>
                )}
            </div>

            {isCreating && (
                <Card className="bg-slate-800 border-slate-600">
                    <CardHeader>
                        <CardTitle className="text-slate-100 text-base">{editingId ? 'Edit Entry' : 'New Changelog Entry'}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Title</label>
                                <Input
                                    value={form.title}
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="e.g. Weight Tracking Overhaul"
                                    className="bg-slate-700 border-slate-600 text-slate-100"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">Week Label</label>
                                <Input
                                    value={form.week_label}
                                    onChange={e => setForm(f => ({ ...f, week_label: e.target.value }))}
                                    className="bg-slate-700 border-slate-600 text-slate-100"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">Raw Dev Notes (optional — for AI summarization)</label>
                            <Textarea
                                value={form.raw_notes}
                                onChange={e => setForm(f => ({ ...f, raw_notes: e.target.value }))}
                                placeholder="Paste raw notes or describe what changed in technical terms..."
                                className="bg-slate-700 border-slate-600 text-slate-100 h-24"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 border-emerald-600 text-emerald-400 hover:bg-emerald-900/20"
                                onClick={handleAISummarize}
                                disabled={isGenerating || !form.raw_notes.trim()}
                            >
                                {isGenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                                AI Summarize
                            </Button>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 mb-2 block">Bullet Points</label>
                            <div className="space-y-2">
                                {form.bullet_points.map((b, i) => (
                                    <div key={i} className="flex gap-2">
                                        <Input
                                            value={b}
                                            onChange={e => updateBullet(i, e.target.value)}
                                            placeholder={`Change ${i + 1}...`}
                                            className="bg-slate-700 border-slate-600 text-slate-100"
                                        />
                                        <Button size="icon" variant="ghost" onClick={() => removeBullet(i)} className="text-slate-500 hover:text-red-400 flex-shrink-0">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button size="sm" variant="outline" onClick={addBullet} className="border-slate-600 text-slate-400">
                                    <PlusCircle className="w-3 h-3 mr-1" /> Add bullet
                                </Button>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" onClick={() => { setIsCreating(false); setEditingId(null); }} className="border-slate-600">
                                Cancel
                            </Button>
                            <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving} className="border-slate-600 text-slate-300">
                                Save Draft
                            </Button>
                            <Button onClick={() => handleSave(true)} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                Save & Publish
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isLoading ? (
                <div className="text-slate-400 text-center py-8">Loading...</div>
            ) : entries.length === 0 ? (
                <div className="text-slate-400 text-center py-8">No changelog entries yet.</div>
            ) : (
                <div className="space-y-3">
                    {entries.map(entry => (
                        <Card key={entry.id} className="bg-slate-800 border-slate-700">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-slate-100">{entry.title}</span>
                                            {entry.is_published
                                                ? <Badge className="bg-emerald-600 text-white text-xs">Published</Badge>
                                                : <Badge className="bg-slate-600 text-slate-300 text-xs">Draft</Badge>
                                            }
                                        </div>
                                        <p className="text-xs text-slate-400 mt-0.5">{entry.week_label}</p>
                                        <ul className="mt-2 space-y-1">
                                            {(entry.bullet_points || []).slice(0, 3).map((b, i) => (
                                                <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                                                    {b}
                                                </li>
                                            ))}
                                            {(entry.bullet_points || []).length > 3 && (
                                                <li className="text-xs text-slate-500">+{entry.bullet_points.length - 3} more</li>
                                            )}
                                        </ul>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <Button size="sm" variant="outline" onClick={() => handleEdit(entry)} className="border-slate-600 text-xs h-8">
                                            <Edit className="w-3 h-3 mr-1" /> Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handlePublish(entry)}
                                            className={`text-xs h-8 ${entry.is_published ? 'border-slate-600 text-slate-400' : 'border-emerald-600 text-emerald-400'}`}
                                        >
                                            {entry.is_published ? 'Unpublish' : 'Publish'}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => handleDelete(entry.id)} className="text-red-400 hover:text-red-300 h-8">
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