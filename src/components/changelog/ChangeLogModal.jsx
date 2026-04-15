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
            id: 'w-apr-15-2026',
            title: 'Week of April 15',
            week_label: 'April 2026 — Week 3',
            published_date: '2026-04-15T00:00:00Z',
            bullet_points: [
                'Notification bell now opens a quick-view popup — see your latest alerts without leaving the page',
                'Dismissed notifications stay dismissed and won\'t reappear',
                'Business Tools (formerly Sales Stats) — renamed and moved to Tools section',
                'Market Analytics tab added for Enterprise users — explore pricing trends across global regions',
                'Season Planner now remembers which tab you were on when you take an action',
                'Due-date reminders — get notified when planner tasks or projects are due or overdue',
                'Revenue entries in Business Tools no longer appear in your gecko collection or lineage tree',
                'Albino morph added to the morph ID tag selector and marketplace filters',
                'Every page now has a settings gear icon for quick access to page-specific preferences',
            ],
        },
        {
            id: 'w-apr-8-2026',
            title: 'Week of April 8',
            week_label: 'April 2026 — Week 2',
            published_date: '2026-04-08T00:00:00Z',
            bullet_points: [
                'Shipping integration with Zero\'s Geckos — get quotes, book shipments, and track packages (Breeder tier)',
                'MorphMarket CSV export — download your listings in a format you can upload directly to MorphMarket',
                'MorphMarket CSV import — bring your MorphMarket listings into Geck Inspect',
                'Admin users now have full access to all features regardless of membership tier',
                'Stay signed in option added to the login page',
                'Login page cleaned up — just the logo and name, no clutter',
                'Landing page now has Sign In next to Create Account for easier access',
                'Fixed invisible dropdown menus in the Future Breeding plan creator',
            ],
        },
        {
            id: 'w-apr-1-2026',
            title: 'Week of April 1',
            week_label: 'April 2026 — Week 1',
            published_date: '2026-04-01T00:00:00Z',
            bullet_points: [
                'Gecko Passport — generate a verifiable digital certificate with QR code for any gecko',
                'Breeding Simulator — see predicted offspring traits with probability percentages',
                'Weight Health Score — automatic alerts when a gecko\'s weight drops significantly',
                'Morph Price Index — view average sale prices when creating marketplace listings',
                'Pedigree poster export — download a branded family tree image for any gecko',
                'Improved app performance — faster page loads and smoother navigation',
            ],
        },
        {
            id: 'w-mar-2026',
            title: 'March 2026 Highlights',
            week_label: 'March 2026',
            published_date: '2026-03-15T00:00:00Z',
            bullet_points: [
                'Genetics Guide — learn crested gecko genetics with interactive diagrams and a glossary',
                'Season Planner — plan your breeding seasons with a calendar view and future pairing tools',
                'Marketplace improvements — toggle between card sizes, better morph filters',
                'Community Connect — follow breeders and see what they\'re working on',
                'Dashboard redesign — personalized greeting, community stats, and Gecko of the Day',
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