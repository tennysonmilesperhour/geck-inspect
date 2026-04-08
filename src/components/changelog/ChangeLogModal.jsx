import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

const LAST_READ_KEY = 'changelog_last_read';

export default function ChangeLogModal({ isOpen, onClose }) {
    const [entries, setEntries] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [newSinceLastVisit, setNewSinceLastVisit] = useState(0);

    useEffect(() => {
        if (!isOpen) return;
        const load = async () => {
            setIsLoading(true);
            try {
                const lastRead = localStorage.getItem(LAST_READ_KEY);
                const all = await base44.entities.ChangeLog.filter({ is_published: true }, '-published_date');
                setEntries(all);

                // Count entries published since last visit
                if (lastRead) {
                    const newCount = all.filter(e => new Date(e.published_date) > new Date(lastRead)).length;
                    setNewSinceLastVisit(newCount);
                } else {
                    setNewSinceLastVisit(all.length);
                }

                // Auto-expand entries newer than last visit (or just the latest if first time)
                if (all.length > 0) {
                    const toExpand = lastRead
                        ? all.filter(e => new Date(e.published_date) > new Date(lastRead))
                        : [all[0]];
                    const expanded = {};
                    (toExpand.length > 0 ? toExpand : [all[0]]).forEach(e => { expanded[e.id] = true; });
                    setExpanded(expanded);
                }

                // Mark as read now
                localStorage.setItem(LAST_READ_KEY, new Date().toISOString());
                window.dispatchEvent(new Event('changelog_read'));
            } catch (e) {
                console.error(e);
            }
            setIsLoading(false);
        };
        load();
    }, [isOpen]);

    const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg max-h-[80vh] overflow-y-auto [&>button:last-child]:!hidden"
                hideCloseButton
            >
                <DialogHeader>
                    <DialogTitle className="text-slate-100 flex items-center gap-2 text-xl">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        What's New
                        {newSinceLastVisit > 0 && (
                            <Badge className="bg-emerald-600 text-white text-xs ml-1">
                                {newSinceLastVisit} new since your last visit
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="text-center py-8 text-slate-400">Loading updates...</div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">No updates yet.</div>
                ) : (
                    <div className="space-y-3 mt-2">
                        {entries.map((entry, idx) => {
                            const lastRead = localStorage.getItem(LAST_READ_KEY);
                            const isNew = lastRead ? new Date(entry.published_date) > new Date(lastRead) : idx === 0;
                            return (
                                <div key={entry.id} className={`border rounded-lg overflow-hidden ${isNew ? 'border-emerald-600' : 'border-slate-700'}`}>
                                    <button
                                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-700 text-left"
                                        onClick={() => toggle(entry.id)}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-100">{entry.title}</span>
                                                {idx === 0 && (
                                                    <Badge className="bg-emerald-600 text-white text-xs">Latest</Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">{entry.week_label}</p>
                                        </div>
                                        {expanded[entry.id]
                                            ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                            : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                        }
                                    </button>
                                    {expanded[entry.id] && (
                                        <ul className="px-4 py-3 space-y-2 bg-slate-900">
                                            {(entry.bullet_points || []).map((point, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                                    {point}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <Button onClick={onClose} className="mt-4 w-full">
                    Got it!
                </Button>
            </DialogContent>
        </Dialog>
    );
}