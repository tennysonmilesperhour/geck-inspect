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
    { q: 'What is a Lilly White you are proud of? Drop a photo.', cta: 'Open the gallery', to: 'Gallery' },
    { q: 'Cappuccino, Sable, or Frappuccino — what is the next morph on your wishlist?', cta: 'Open the forum', to: 'Forum' },
    { q: 'Anyone else seeing late-season eggs this week?', cta: 'Post about it', to: 'Forum' },
    { q: 'What is the weirdest fired-state color shift you have caught on camera?', cta: 'Share a photo', to: 'Gallery' },
    { q: 'How do you label your incubator containers? Show your system.', cta: 'Start a thread', to: 'Forum' },
    { q: 'Which Harlequin do you think is the cleanest in your collection right now?', cta: 'Show it off', to: 'Gallery' },
    { q: 'CGD brand preferences. Who is using what and why?', cta: 'Open the forum', to: 'Forum' },
    { q: 'What is the youngest pair you have ever had a successful clutch from?', cta: 'Tell the story', to: 'Forum' },
    { q: 'Best-looking Phantom you have seen lately. Bonus points if it is yours.', cta: 'Drop the photo', to: 'Gallery' },
    { q: 'Tank setup show-and-tell. What is in your bioactive build?', cta: 'Post your build', to: 'Forum' },
    { q: 'Axanthic out of a non-Axanthic visual parent — anyone hit it this season?', cta: 'Share the story', to: 'Forum' },
    { q: 'Newest hatchling. Show us the freshest face in your collection.', cta: 'Upload', to: 'Gallery' },
    { q: 'A morph you used to dismiss that grew on you?', cta: 'Open the forum', to: 'Forum' },
    { q: 'Favorite breeder photo gear. What camera or phone are you using?', cta: 'Recommend yours', to: 'Forum' },
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
