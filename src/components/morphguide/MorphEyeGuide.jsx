import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Info, AlertTriangle } from 'lucide-react';

export const EYE_COLOR_STUDIES = [
  {
    id: 'golden-bronze',
    name: 'Golden & Bronze Veined',
    badge: 'Wild-type / Polygenic',
    plate: '/morph-guide/eyes-v1/golden-bronze.webp',
    summary:
      'Warm amber-gold to antique bronze iris stroma laced with dark sepia branching veins around a scalloped vertical slit pupil.',
    genetics:
      'Polygenic baseline across most crested geckos. Gold and bronze xanthophore and iridophore pigments in the iris stroma inherit independently of dorsal pattern.',
    whatToCheck: [
      'Fine dendritic dark veins radiate from the pupil toward a darker outer limbal ring, creating a bark-like camouflage texture.',
      'Unlike body skin, the iris does not fire up or fire down when temperature, humidity, or mood changes.',
      'Under bright side lighting, the two pupils can constrict independently to different widths, which is normal in nocturnal geckos.',
    ],
    relatedMorphs: [
      { slug: 'buckskin', label: 'Buckskin' },
      { slug: 'harlequin', label: 'Harlequin' },
      { slug: 'tiger', label: 'Tiger' },
    ],
  },
  {
    id: 'silver-gray',
    name: 'Silver & Pearl Gray',
    badge: 'Polygenic & Axanthic',
    plate: '/morph-guide/eyes-v1/silver-gray.webp',
    summary:
      'Cool metallic silver-ivory stroma with crisp charcoal reticulation and a slate limbal ring, lacking warm yellow or amber tones.',
    genetics:
      'Occurs naturally as a polygenic variation and is consistently expressed in visual Axanthic geckos, where recessive xanthophore suppression removes yellow and red pigment.',
    whatToCheck: [
      'Silver eyes appear across both Axanthic and non-Axanthic geckos, so cool gray irises alone do not prove an animal is Axanthic or het Axanthic.',
      'Check under neutral daylight (5000K to 6500K) rather than warm halogen bulbs, which can cast a false golden tint over silver irises.',
    ],
    relatedMorphs: [
      { slug: 'axanthic', label: 'Axanthic' },
      { slug: 'lavender', label: 'Lavender' },
      { slug: 'moonglow', label: 'Moonglow' },
    ],
  },
  {
    id: 'copper-amber',
    name: 'Copper & Russet Amber',
    badge: 'Selective / Polygenic',
    plate: '/morph-guide/eyes-v1/copper-amber.webp',
    summary:
      'Burnished terracotta-copper to deep russet-orange iris stroma with rich mahogany vascular and melanin veining.',
    genetics:
      'Polygenic trait refined through selective pairings, frequently favored in Red Base, Creamsicle, and Halloween breeding programs.',
    whatToCheck: [
      'True copper irises show warm russet-orange pigment in the stromal ridges between dark veins, not a red pupil.',
      'Eye color and body base color are inherited separately: a bright red gecko can have silver or bronze eyes, and a buckskin gecko can have deep copper eyes.',
    ],
    relatedMorphs: [
      { slug: 'red-base', label: 'Red Base' },
      { slug: 'orange-base', label: 'Orange Base' },
      { slug: 'tricolor', label: 'Tricolor' },
    ],
  },
  {
    id: 'olive-green',
    name: 'Olive & Moss Green',
    badge: 'Polygenic',
    plate: '/morph-guide/eyes-v1/olive-green.webp',
    summary:
      'Muted sage-olive to lichen-green iris stroma with dark olive-sepia branching veins that blend into mossy canopy bark.',
    genetics:
      'Polygenic interaction between structural iridophore scattering and subtle yellow pigment in the iris stroma.',
    whatToCheck: [
      'Most noticeable in natural indirect light when the pupil is constricted and the full width of the iris stroma is visible.',
      'Common in Olive, Buckskin, and Phantom Pinstripe lines where muted earth tones predominate.',
    ],
    relatedMorphs: [
      { slug: 'olive', label: 'Olive' },
      { slug: 'phantom-pinstripe', label: 'Phantom Pinstripe' },
    ],
  },
  {
    id: 'melanistic-dark',
    name: 'Dark Espresso & Melanistic',
    badge: 'Cappuccino / Super Cappuccino',
    plate: '/morph-guide/eyes-v1/melanistic-dark.webp',
    summary:
      'Heavy melanin saturation across the iris stroma, ranging from deep espresso in Cappuccino and Sable to solid coal-black in Super Cappuccino.',
    genetics:
      'Associated with the incomplete-dominant Cappuccino / Sable complex. Homozygous Super Cappuccino (Melanistic) animals express solid dark eyes alongside translucent skin.',
    whatToCheck: [
      'In heterozygous Cappuccino and Sable geckos, dark espresso-bronze veining remains visible under close inspection.',
      'In homozygous Super Cappuccino geckos, dense melanin obscures the iris stroma so the eye reads as solid black.',
    ],
    welfareNote:
      'Super Cappuccino geckos frequently suffer from craniofacial and nasolacrimal malformations, including reduced nostrils and fluid accumulation behind the clear spectacle scale (spectacle eye). Responsible breeders avoid Cappuccino x Cappuccino pairings.',
    relatedMorphs: [
      { slug: 'cappuccino', label: 'Cappuccino' },
      { slug: 'sable', label: 'Sable' },
      { slug: 'frappuccino', label: 'Frappuccino' },
    ],
  },
  {
    id: 'ruby-albino',
    name: 'Ruby & Amelanistic Pink',
    badge: 'Amelanistic / Albino',
    plate: '/morph-guide/eyes-v1/ruby-albino.webp',
    summary:
      'Complete absence of melanin in the iris and retina, revealing a ruby-red vertical slit pupil and a coral-pink vascular iris.',
    genetics:
      'Expected recessive amelanism. The first viable, healthy Albino crested gecko hatchlings were announced by Eureka Exotics on 5 March 2026.',
    whatToCheck: [
      'True amelanistic eyes show pink or coral iris tissue and a ruby pupil in ordinary ambient room light, paired with complete absence of black or brown pigment across the body.',
      'Camera flash and angled light can reflect red off the retina of any normal dark-eyed gecko (flash red-eye). Always inspect eyes in diffused daylight without flash.',
    ],
    relatedMorphs: [
      { slug: 'albino', label: 'Albino' },
      { slug: 'hypo', label: 'Hypo' },
    ],
  },
];

export function eyeStudyForMorph(slug) {
  if (slug === 'albino') return EYE_COLOR_STUDIES.find((e) => e.id === 'ruby-albino');
  if (slug === 'axanthic' || slug === 'moonglow' || slug === 'lavender') {
    return EYE_COLOR_STUDIES.find((e) => e.id === 'silver-gray');
  }
  if (slug === 'cappuccino' || slug === 'sable' || slug === 'frappuccino') {
    return EYE_COLOR_STUDIES.find((e) => e.id === 'melanistic-dark');
  }
  if (slug === 'olive' || slug === 'phantom-pinstripe') {
    return EYE_COLOR_STUDIES.find((e) => e.id === 'olive-green');
  }
  if (slug === 'red-base' || slug === 'orange-base') {
    return EYE_COLOR_STUDIES.find((e) => e.id === 'copper-amber');
  }
  return null;
}

export default function MorphEyeGuide({ className = '' }) {
  const [selectedId, setSelectedId] = useState(EYE_COLOR_STUDIES[0].id);
  const active = EYE_COLOR_STUDIES.find((e) => e.id === selectedId) || EYE_COLOR_STUDIES[0];

  return (
    <section
      aria-label="Crested gecko eye colors and anatomy"
      className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-400">
            Ocular anatomy &amp; pigment guide
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-1 flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
            Crested Gecko Eye Colors &amp; Structure
          </h2>
          <p className="mt-2 text-sm text-slate-300 max-w-3xl leading-relaxed">
            Unlike leopard geckos, where eye traits are tightly bound to specific recessive morphs, most crested gecko iris colors are polygenic and inherit independently of body pattern. Only mutations that alter melanin or xanthophore pathways across the whole animal directly reshape eye pigment.
          </p>
        </div>
      </div>

      {/* 3 anatomical fundamentals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            1 · Fixed spectacle scale (brille)
          </div>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            Crested geckos lack movable eyelids. A transparent fusion of the eyelids (the brille) covers the cornea, sheds with the skin, and is wiped clean with the tongue.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            2 · Scalloped vertical slit pupil
          </div>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            In bright light the pupil constricts to a vertical slit with tiny scalloped pinhole lobes that preserve depth judgment while protecting the nocturnal retina.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            3 · Fixed dendritic iris veining
          </div>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            Fine branching melanin and capillary networks create a bark-like pinwheel pattern across the iris stroma. Iris color stays constant when the body fires up or down.
          </p>
        </div>
      </div>

      {/* 6-plate selector strip */}
      <div
        role="group"
        aria-label="Select eye color study"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-5"
      >
        {EYE_COLOR_STUDIES.map((study) => {
          const isSelected = study.id === active.id;
          return (
            <button
              key={study.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedId(study.id)}
              className={`group text-left rounded-xl overflow-hidden border transition-all ${
                isSelected
                  ? 'border-emerald-400 bg-slate-950 ring-2 ring-emerald-500/30'
                  : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
              }`}
            >
              <div className="aspect-[3/2] bg-[#f4efdf] overflow-hidden">
                <img
                  src={study.plate}
                  alt={`${study.name} crested gecko eye study`}
                  width="900"
                  height="600"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="p-2.5">
                <div className="text-xs font-semibold text-white leading-snug">
                  {study.name}
                </div>
                <div className="text-[10px] text-emerald-300/90 mt-0.5 truncate">
                  {study.badge}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active eye study detail card */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-5 items-start rounded-2xl border border-slate-800 bg-slate-950/80 p-4 sm:p-5">
        <figure className="m-0 overflow-hidden rounded-xl border border-slate-800 bg-[#f4efdf] p-2.5">
          <img
            src={active.plate}
            alt={`${active.name} close-up field guide eye illustration`}
            width="900"
            height="600"
            className="w-full h-auto rounded-lg block"
          />
          <figcaption className="mt-2 text-center text-xs font-medium text-[#564c3d]">
            Field guide ocular plate · {active.name} ({active.badge})
          </figcaption>
        </figure>

        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-white">{active.name}</h3>
            <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
              {active.badge}
            </span>
          </div>

          <p className="text-sm text-slate-200 leading-relaxed">{active.summary}</p>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              <Info className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              Genetic &amp; pigment mechanism
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{active.genetics}</p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              What to check in person &amp; in photos
            </div>
            <ul className="space-y-1.5">
              {active.whatToCheck.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {active.welfareNote && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-amber-200/90 leading-relaxed">{active.welfareNote}</p>
            </div>
          )}

          {active.relatedMorphs?.length > 0 && (
            <div className="pt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 mr-1">Commonly seen with:</span>
              {active.relatedMorphs.map((m) => (
                <Link
                  key={m.slug}
                  to={`/MorphGuide/${m.slug}`}
                  className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 px-2.5 py-1 text-xs font-medium text-slate-200 hover:text-emerald-200 transition-colors"
                >
                  {m.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
