import { Link } from 'react-router-dom';
import { Camera, ChevronRight, CircleDollarSign, Dna } from 'lucide-react';
import { article } from '@/lib/morphMeta';
import { calculatorHref, trackMorphCta } from './morphCta';

/**
 * The three things a visitor usually wants next after reading what a
 * morph is: check their own gecko, see what it is worth, plan a pairing.
 * Sits right under the hero so it is reachable without scrolling far.
 */
export default function MorphActions({ slug, name, priceRange }) {
  const calc = calculatorHref(slug);
  const cards = [
    {
      key: 'morph_id',
      to: '/Recognition',
      icon: Camera,
      title: `Is your gecko ${article(name)} ${name}?`,
      body: 'Identify it from a photo with Morph ID. Your first check is free.',
      tone: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 hover:border-emerald-400/60',
      iconTone: 'bg-emerald-500/15 text-emerald-300',
    },
    {
      key: 'price_guide',
      to: '/crested-gecko-price',
      icon: CircleDollarSign,
      title: `What is ${article(name)} ${name} worth?`,
      body: priceRange
        ? `Adults typically sell for ${priceRange}. See what moves the price.`
        : 'See how crested gecko prices are set and what moves them.',
      tone: 'from-amber-500/10 to-amber-500/5 border-amber-500/25 hover:border-amber-400/50',
      iconTone: 'bg-amber-500/15 text-amber-300',
    },
    {
      key: 'calculator',
      to: calc,
      icon: Dna,
      title: `Breed ${article(name)} ${name}`,
      body: calc === '/calculator'
        ? 'Plan a pairing and see the odds for every egg.'
        : `Open the ${name} calculator and see the odds for every egg.`,
      tone: 'from-sky-500/10 to-sky-500/5 border-sky-500/25 hover:border-sky-400/50',
      iconTone: 'bg-sky-500/15 text-sky-300',
    },
  ];

  return (
    <nav aria-label={`Next steps for ${name}`} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map(({ key, to, icon: Icon, title, body, tone, iconTone }) => (
        <Link
          key={key}
          to={to}
          onClick={() => trackMorphCta(slug, to, `action_strip_${key}`)}
          className={`group flex items-start gap-3 rounded-xl border bg-gradient-to-br p-4 transition-colors ${tone}`}
        >
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-white leading-snug">{title}</span>
            <span className="mt-1 block text-sm text-neutral-400 leading-relaxed">{body}</span>
          </span>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-300" aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

/**
 * A one-line nudge placed inside a section (after "How to identify",
 * in the genetics area). Same tracking as the action strip.
 */
export function InlineMorphCta({ slug, to, placement, icon: Icon = ChevronRight, children }) {
  return (
    <Link
      to={to}
      onClick={() => trackMorphCta(slug, to, placement)}
      className="mt-5 flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-sm font-medium text-emerald-200 hover:border-emerald-400/50 hover:bg-emerald-500/10 transition-colors"
    >
      <Icon className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
      <span className="flex-1">{children}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
    </Link>
  );
}
