import { Link } from 'react-router-dom';
import { ArrowRight, Camera, DollarSign, Dna } from 'lucide-react';
import { captureEvent } from '@/lib/posthog';

/**
 * Closing block of the Morph Guide index: the three tools a morph reader
 * most often needs next, as big cards, with the reading guides as smaller
 * links underneath.
 */
const HOOKS = [
  {
    target: 'morph_id',
    to: '/Recognition',
    icon: Camera,
    eyebrow: 'Morph ID',
    title: 'Not sure what you have?',
    body: 'Upload a photo and get a read on base color, pattern and traits like Lilly White or Dalmatian spots. Your first one is free.',
    cta: 'Identify my gecko',
    tone: 'border-emerald-500/40 from-emerald-900/50 hover:border-emerald-400/70',
    iconTone: 'bg-emerald-500/20 text-emerald-300',
  },
  {
    target: 'price_guide',
    to: '/crested-gecko-price',
    icon: DollarSign,
    eyebrow: 'Price guide',
    title: 'What is it worth?',
    body: 'Real 2026 price ranges by morph and quality, from a $60 Flame to a $3,000 Axanthic, and what moves an animal between tiers.',
    cta: 'See crested gecko prices',
    tone: 'border-amber-500/40 from-amber-900/40 hover:border-amber-400/70',
    iconTone: 'bg-amber-500/20 text-amber-300',
  },
  {
    target: 'calculator',
    to: '/calculator',
    icon: Dna,
    eyebrow: 'Breeding calculator',
    title: 'Plan a pairing',
    body: 'See the odds before you pair: Lilly White, Cappuccino, Axanthic and hets, with the lethal super forms flagged.',
    cta: 'Open the calculator',
    tone: 'border-sky-500/40 from-sky-900/40 hover:border-sky-400/70',
    iconTone: 'bg-sky-500/20 text-sky-300',
  },
];

export default function MorphIndexAppHooks() {
  return (
    <section aria-labelledby="morph-next-heading" className="space-y-4">
      <h2 id="morph-next-heading" className="text-xl md:text-2xl font-bold text-white">
        Put the guide to work
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        {HOOKS.map((h) => (
          <Link
            key={h.target}
            to={h.to}
            onClick={() => captureEvent('morph_guide_cta_clicked', { target: h.target, placement: 'closing_hooks' })}
            className={`group flex flex-col rounded-2xl border bg-gradient-to-br to-slate-900 p-5 transition-colors ${h.tone}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${h.iconTone}`}>
                <h.icon className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">{h.eyebrow}</span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{h.title}</h3>
            <p className="text-sm text-slate-300 leading-relaxed flex-1">{h.body}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
              {h.cta}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        ))}
      </div>
      <p className="text-sm text-slate-400">
        Keep reading:{' '}
        <Link to="/CareGuide" className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline">
          Care Guide
        </Link>
        {', '}
        <Link to="/GeneticsGuide" className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline">
          Genetics Guide
        </Link>
        {' and the '}
        <Link to="/QualityScale" className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline">
          Quality Scale
        </Link>
        .
      </p>
    </section>
  );
}
