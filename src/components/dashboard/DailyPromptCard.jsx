import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, ArrowRight } from 'lucide-react';
import { createPageUrl } from '@/utils';

/**
 * A daily conversational prompt that nudges the user toward the forum
 * or gallery. The prompt rotates by day-of-year, so every keeper sees
 * the same thing on the same day (good for shared social context) but
 * the surface stays fresh.
 *
 * Prompts are intentionally crested-gecko specific so the dashboard
 * feels like it was written by a keeper, not a SaaS template.
 */
const PROMPTS = [
    { q: 'A Lilly White in your collection worth posting?', cta: 'Open gallery', to: 'Gallery' },
    { q: 'What morph is next on your wishlist?', cta: 'Open forum', to: 'Forum' },
    { q: 'Anyone else getting late-season eggs?', cta: 'Open forum', to: 'Forum' },
    { q: 'Caught a strong fired-state shift on camera lately?', cta: 'Open gallery', to: 'Gallery' },
    { q: 'How do you label incubator containers?', cta: 'Open forum', to: 'Forum' },
    { q: 'Cleanest Harlequin in your collection right now?', cta: 'Open gallery', to: 'Gallery' },
    { q: 'Which CGD are you feeding right now, and why that one?', cta: 'Open forum', to: 'Forum' },
    { q: "Youngest pair you've gotten a successful clutch from?", cta: 'Open forum', to: 'Forum' },
    { q: "Best Phantom you've seen lately, yours or someone else's.", cta: 'Open gallery', to: 'Gallery' },
    { q: 'What is in your current bioactive build?', cta: 'Open forum', to: 'Forum' },
    { q: "Surprise morph from a pair you weren't expecting it from?", cta: 'Open forum', to: 'Forum' },
    { q: 'Newest hatchling in your collection. Post a photo if you have one.', cta: 'Open gallery', to: 'Gallery' },
    { q: 'A morph you used to overlook that you have come around on?', cta: 'Open forum', to: 'Forum' },
    { q: 'Phone or camera you use for gecko photos?', cta: 'Open forum', to: 'Forum' },
];

function dayOfYear(d) {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d - start;
    return Math.floor(diff / 86400000);
}

export default function DailyPromptCard() {
    const today = new Date();
    const prompt = PROMPTS[dayOfYear(today) % PROMPTS.length];

    return (
        <Card className="bg-gradient-to-br from-violet-950/40 via-slate-900/60 to-emerald-950/40 border-violet-500/20 backdrop-blur-sm">
            <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-violet-500/20 border border-violet-400/30 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-violet-300" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs uppercase tracking-widest text-violet-300/70 font-semibold mb-1">
                            Today's prompt
                        </p>
                        <p className="text-slate-100 text-base md:text-lg leading-snug">
                            {prompt.q}
                        </p>
                    </div>
                </div>
                <Link
                    to={createPageUrl(prompt.to)}
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 font-medium text-sm shrink-0 self-start md:self-auto"
                >
                    {prompt.cta} <ArrowRight className="w-4 h-4" />
                </Link>
            </CardContent>
        </Card>
    );
}
