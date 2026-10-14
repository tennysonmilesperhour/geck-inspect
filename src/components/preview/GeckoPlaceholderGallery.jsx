import { useState } from 'react';
import { subMonths } from 'date-fns';
import GeckoPlaceholder from '@/components/shared/GeckoPlaceholder';
import GeckoCard from '@/components/my-geckos/GeckoCard';
import { GECKO_ART_STYLES, GECKO_ART_AGES, GECKO_ART_SEXES, geckoArtStyle } from '@/lib/geckoPlaceholderProfiles';
import { todayLocalISO } from '@/lib/dateUtils';

const NAMES = ['Fern', 'Indigo', 'Clover', 'Sol', 'Ember'];
const EXAMPLES = GECKO_ART_STYLES.map((style, index) => ({
  id: Array.from({ length: 200 }, (_, i) => `art-study-${i}`).find(id => geckoArtStyle({ id }).id === style.id),
  name: NAMES[index],
  species: 'Crested Gecko',
  status: 'Pet',
  image_urls: [],
}));
const AGE_MONTHS = { hatchling: 2, juvenile: 10, adult: 30 };

export default function GeckoPlaceholderGallery() {
  const [sex, setSex] = useState('unsexed');
  const [age, setAge] = useState('adult');
  const [today] = useState(() => new Date());
  const hatchDate = age === 'unknown' ? null : todayLocalISO(subMonths(today, AGE_MONTHS[age]));
  const examples = EXAMPLES.map(gecko => ({ ...gecko, sex: GECKO_ART_SEXES[sex].label, hatch_date: hatchDate }));

  return <section id="placeholders" className="scroll-mt-6" aria-labelledby="placeholder-heading">
    <div className="mb-7 max-w-3xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.24em] text-amber-300">The collection editions</p>
      <h2 id="placeholder-heading" className="text-3xl font-semibold sm:text-4xl">A little character, before the first photo.</h2>
      <p className="mt-4 leading-relaxed text-stone-400">Five ornate defaults, automatically mixed through your collection. Each gecko keeps its own style as its details change. Add a photo and the illustration gives way to the real animal.</p>
    </div>
    <div className="mb-7 flex flex-wrap gap-x-10 gap-y-5 rounded-xl border border-stone-700 bg-white/[.03] p-4">
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400">Recorded sex</legend>
        <div className="flex flex-wrap gap-2">{Object.entries(GECKO_ART_SEXES).map(([value, item]) =>
          <button key={value} type="button" onClick={() => setSex(value)} aria-pressed={sex === value}
            className={`min-h-11 rounded-lg border px-3 text-sm transition-colors ${sex === value ? 'border-amber-300 bg-amber-100 text-stone-900' : 'border-stone-600 text-stone-200 hover:border-stone-300'}`}>
            {item.label}
          </button>
        )}</div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400">Age from hatch date</legend>
        <div className="flex flex-wrap gap-2">{Object.entries(GECKO_ART_AGES).map(([value, label]) =>
          <button key={value} type="button" onClick={() => setAge(value)} aria-pressed={age === value}
            className={`min-h-11 rounded-lg border px-3 text-sm transition-colors ${age === value ? 'border-amber-300 bg-amber-100 text-stone-900' : 'border-stone-600 text-stone-200 hover:border-stone-300'}`}>
            {label}
          </button>
        )}</div>
      </fieldset>
    </div>
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5" data-placeholder-gallery>
      {examples.map((gecko, index) => <figure key={gecko.id}>
        <GeckoPlaceholder gecko={gecko} now={today} width={1024} className="h-auto w-full rounded-xl shadow-lg" />
        <figcaption className="mt-3 text-center">
          <p className="text-xs uppercase tracking-[.16em] text-amber-200/60">Edition 0{index + 1}</p>
          <p className="mt-1 text-sm font-semibold">{GECKO_ART_STYLES[index].label}</p>
        </figcaption>
      </figure>)}
    </div>
    <p className="mt-5 text-xs leading-relaxed text-stone-500">Illustrated placeholders, not photographs or morph examples. Artwork uses hatchling (under 6 months), juvenile (6 to 17 months) and adult (18 months onward) age bands. These are display choices, not assessments of maturity or breeding readiness. Unrecorded details stay unrecorded.</p>
    <h3 className="mb-4 mt-10 text-xl font-semibold">In the collection</h3>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-placeholder-collection>
      {examples.map(gecko => <GeckoCard key={gecko.id} gecko={gecko} canEdit={false} />)}
    </div>
  </section>;
}
