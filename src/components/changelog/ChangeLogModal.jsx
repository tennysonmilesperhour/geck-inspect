import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

export default function ChangeLogModal({ isOpen, onClose }) {
    const [entries, setEntries] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        const load = async () => {
            setIsLoading(true);
            try {
                const all = await base44.entities.ChangeLog.filter({ is_published: true }, '-published_date');
                setEntries(all);
                // Auto-expand the latest one
                if (all.length > 0) setExpanded({ [all[0].id]: true });
                // Mark as read
                const readKey = 'changelog_last_read';
                localStorage.setItem(readKey, new Date().toISOString());
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
            <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-slate-100 flex items-center gap-2 text-xl">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        What's New
                    </DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="text-center py-8 text-slate-400">Loading updates...</div>
                ) : entries.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">No updates yet.</div>
                ) : (
                    <div className="space-y-3 mt-2">
                        {entries.map((entry, idx) => (
                            <div key={entry.id} className="border border-slate-700 rounded-lg overflow-hidden">
                                <button
                                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 text-left"
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
                        ))}
                    </div>
                )}

                <Button onClick={onClose} className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700">
                    Got it!
                </Button>
            </DialogContent>
        </Dialog>
    );
}