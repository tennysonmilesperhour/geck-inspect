import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

const LAST_READ_KEY = 'changelog_last_read';

export default function ChangeLogModal({ isOpen, onClose }) {
    // Capture the lastRead timestamp BEFORE we update it, so the "new" highlight
    // shows entries published since the user's actual last visit, not since "right now".
    const lastReadRef = useRef(null);
    const [entries, setEntries] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [newSinceLastVisit, setNewSinceLastVisit] = useState(0);

    // Fallback changelog entries generated from recent app updates.
    // Shown when no admin-created ChangeLog entries exist in the DB.
    const BUILTIN_UPDATES = [
        {
            id: 'builtin-apr-2026',
            title: 'April 2026 Update',
            week_label: 'April 2026',
            published_date: '2026-04-14T00:00:00Z',
            bullet_points: [
                'Breeding Simulator — Monte Carlo engine shows phenotype probability distributions',
                'Weight Health Score — automated alerts when a gecko drops >5% in a week',
                'Morph Price Index — see average sale prices when listing on the marketplace',
                'Gecko Passport — generate a verifiable digital certificate for any gecko',
                'Pedigree Poster Export — one-click branded PNG download',
                'Security hardening — admin panel gated, upload validation, XSS fixes',
                'Performance — removed 9 unused dependencies, added chunk splitting',
                'Accessibility — skip-to-content link, WCAG landmarks',
            ],
        },
        {
            id: 'builtin-mar-2026',
            title: 'March 2026 Update',
            week_label: 'March 2026',
            published_date: '2026-03-15T00:00:00Z',
            bullet_points: [
                'Genetics Guide — interactive educational reference with diagrams and glossary',
                'Season Planner — calendar-first layout with future breeding plans',
                'Marketplace — card size toggle (regular/large) and improved filters',
                'Community Connect — follow breeders and see their activity feed',
                'Dashboard redesign — personal hero, three-column layout, Gecko of the Day',
            ],
        },
    ];

    useEffect(() => {
        if (!isOpen) return;
        const lastRead = localStorage.getItem(LAST_READ_KEY);
        lastReadRef.current = lastRead;
        const load = async () => {
            setIsLoading(true);
            try {
                const all = await base44.entities.ChangeLog.filter({ is_published: true }, '-published_date');

                // Use admin-created entries if available, otherwise show built-in updates
                const displayEntries = all.length > 0 ? all : BUILTIN_UPDATES;
                setEntries(displayEntries);

                // Count entries published since last visit
                if (lastRead) {
                    const newCount = displayEntries.filter(e => new Date(e.published_date) > new Date(lastRead)).length;
                    setNewSinceLastVisit(newCount);
                } else {
                    setNewSinceLastVisit(displayEntries.length);
                }

                // Auto-expand entries newer than last visit (or just the latest if first time)
                if (displayEntries.length > 0) {
                    const toExpand = lastRead
                        ? displayEntries.filter(e => new Date(e.published_date) > new Date(lastRead))
                        : [displayEntries[0]];
                    const expandedMap = {};
                    (toExpand.length > 0 ? toExpand : [displayEntries[0]]).forEach(e => { expandedMap[e.id] = true; });
                    setExpanded(expandedMap);
                }

                // Mark as read AFTER computing newSinceLastVisit
                localStorage.setItem(LAST_READ_KEY, new Date().toISOString());
                window.dispatchEvent(new Event('changelog_read'));
            } catch (e) {
                console.error(e);
                // Even on fetch failure, show built-in updates
                setEntries(BUILTIN_UPDATES);
                setNewSinceLastVisit(BUILTIN_UPDATES.length);
                setExpanded({ [BUILTIN_UPDATES[0].id]: true });
                localStorage.setItem(LAST_READ_KEY, new Date().toISOString());
                window.dispatchEvent(new Event('changelog_read'));
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
                            const isNew = lastReadRef.current
                                ? new Date(entry.published_date) > new Date(lastReadRef.current)
                                : idx === 0;
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