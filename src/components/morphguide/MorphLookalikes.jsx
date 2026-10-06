import { Link } from 'react-router-dom';
import { ArrowRight, Camera, ScanSearch } from 'lucide-react';
import { getMorph } from '@/data/morph-guide';
import { whereToLook } from '@/lib/morphLinkify';
import { trackMorphCta } from './morphCta';
import { MorphThumb } from './MorphPreviewCard';
import MorphText from './MorphText';

function Tile({ slug, name, label, to, onClick }) {
  const body = (
    <>
      <MorphThumb slug={slug} name={name} className="aspect-[4/3] w-full rounded-lg" textClass="text-3xl sm:text-4xl" />
      <span className="mt-2 block text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="flex items-center gap-1 font-semibold text-white leading-tight">
        <span className="truncate">{name}</span>
        {to && (
          <ArrowRight
            className="h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-300"
            aria-hidden="true"
          />
        )}
      </span>
    </>
  );
  if (!to) return <div className="min-w-0">{body}</div>;
  return (
    <Link to={to} onClick={onClick} className="group min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
      {body}
    </Link>
  );
}

/**
 * "Often confused with", as a spot-the-difference: this morph and each
 * lookalike side by side, the one sentence that tells them apart, and the
 * parts of the gecko to check (worked out from the sentence and both
 * morphs' visual identifiers). Data comes from the `lookalikes` field in
 * src/data/morph-guide.js.
 */
export default function MorphLookalikes({ slug, name, lookalikes = [] }) {
  const self = getMorph(slug);
  const items = lookalikes
    .map((l) => ({ ...l, morph: getMorph(l.slug) }))
    .filter((l) => l.morph);
  if (!items.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map(({ slug: other, difference, morph }) => {
        const to = `/MorphGuide/${other}`;
        const chips = whereToLook(difference, self?.visualIdentifiers, morph.visualIdentifiers);
        return (
          <div
            key={other}
            className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3 sm:p-4"
          >
            <h3 className="sr-only">
              {name} vs {morph.name}
            </h3>
            <div className="relative grid grid-cols-2 gap-3">
              <Tile slug={slug} name={name} label="This page" />
              <Tile
                slug={other}
                name={morph.name}
                label="Often confused with"
                to={to}
                onClick={() => trackMorphCta(slug, to, 'lookalikes')}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-[calc((100%-2.75rem)/2)] -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700 bg-neutral-950 text-[11px] font-bold uppercase tracking-wide text-neutral-300 shadow-lg"
              >
                vs
              </span>
            </div>

            <p className="mt-3 text-[15px] leading-relaxed text-neutral-200">
              <MorphText text={difference} currentSlug={slug} skip={[other]} />
            </p>

            {chips.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
                  <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
                  Where to look
                </span>
                {chips.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-200"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}

            <Link
              to="/Recognition"
              onClick={() => trackMorphCta(slug, '/Recognition', 'lookalike_compare')}
              className="mt-3 inline-flex min-h-9 touch:min-h-11 items-center gap-1.5 text-xs text-neutral-400 hover:text-emerald-200 transition-colors"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              Still not sure? Identify your gecko from a photo
            </Link>
          </div>
        );
      })}
    </div>
  );
}
