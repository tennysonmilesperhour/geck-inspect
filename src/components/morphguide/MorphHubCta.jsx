import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Dna, Scale } from 'lucide-react';
import { captureEvent } from '@/lib/posthog';

/**
 * The one next step that fits each morph hub:
 *   recessive hub  -> the calculator, to work out hets
 *   pattern hub    -> the Quality Scale, since pattern morphs are graded
 *   everything else -> Morph ID
 */
export function hubCtaFor(variant, id) {
  if (variant === 'inheritance' && id === 'recessive') {
    return {
      target: 'calculator',
      to: '/calculator',
      icon: Dna,
      title: 'Check your hets in the calculator',
      body: 'Recessive genes like Axanthic hide in carriers that look normal. Enter both parents to see the odds of visual and het babies before you pair.',
      cta: 'Open the calculator',
    };
  }
  if (variant === 'category' && id === 'pattern') {
    return {
      target: 'quality_scale',
      to: '/QualityScale',
      icon: Scale,
      title: 'Grade your gecko on the Quality Scale',
      body: 'Two Harlequins can sit a full price tier apart. Score yours on the free 10-point scale for structure, head, pattern and color, and see which tier it lands in.',
      cta: 'Grade my gecko',
    };
  }
  return {
    target: 'morph_id',
    to: '/Recognition',
    icon: Camera,
    title: 'Not sure what your gecko is?',
    body: 'Upload a photo and Morph ID reads the base color, pattern and traits for you. Your first one is free.',
    cta: 'Identify my gecko from a photo',
  };
}

export default function MorphHubCta({ variant, id, placement = 'hub', className = '' }) {
  const cta = hubCtaFor(variant, id);
  const Icon = cta.icon;
  return (
    <div
      className={`rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-900 p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4 ${className}`}
    >
      <span className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-emerald-500/20 text-emerald-300">
        <Icon className="w-5 h-5" />
      </span>
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold text-white">{cta.title}</h2>
        <p className="mt-1 text-sm text-slate-300 leading-relaxed">{cta.body}</p>
      </div>
      <Link
        to={cta.to}
        onClick={() =>
          captureEvent('morph_guide_cta_clicked', { target: cta.target, placement: `${placement}_${variant}_${id}` })
        }
        className="inline-flex items-center justify-center gap-2 min-h-11 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
      >
        {cta.cta}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
