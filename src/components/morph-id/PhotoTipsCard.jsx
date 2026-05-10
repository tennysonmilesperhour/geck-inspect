import { Card, CardContent } from '@/components/ui/card';
import { Camera, Sun, Focus, Hand, Layers } from 'lucide-react';

const TIPS = [
  { icon: Sun,    title: 'Bright, neutral light',     body: 'Indirect daylight beats flash. Avoid red basking bulbs ,  they lie about color.' },
  { icon: Focus,  title: 'Sharp focus on the back',   body: 'Tap the dorsum in your camera app before shooting. Blurry patterns read as "flame" when they’re not.' },
  { icon: Camera, title: 'Three-quarter angle',       body: 'Shoot slightly above and to the side so flanks, dorsum, and crests are all visible.' },
  { icon: Layers, title: 'Capture both fire states',  body: 'Fired-up and fired-down colors can differ dramatically. A photo of each helps a lot.' },
  { icon: Hand,   title: 'Scale the shot',            body: 'Include a finger or coin nearby for size context ,  but keep it behind the gecko.' },
];

export default function PhotoTipsCard() {
  return (
    <Card className="bg-slate-900/60 border-slate-700">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Photo tips for an accurate ID</p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TIPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center">
                <Icon className="w-4 h-4 text-emerald-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-100">{title}</p>
                <p className="text-xs text-slate-400">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
