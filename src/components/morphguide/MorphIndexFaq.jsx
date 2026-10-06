import { MORPHS } from '@/data/morph-guide';

/**
 * Short FAQ for the Morph Guide index. The answers are built from the morph
 * data so the counts and lists never drift from the grid above them. The
 * same list feeds the page's FAQPage JSON-LD (see MorphGuide.jsx).
 */

function listNames(names) {
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function buildMorphIndexFaq(morphs = MORPHS) {
  const namesWhere = (pred) => morphs.filter(pred).map((m) => m.name);
  const total = morphs.length;
  const veryRare = namesWhere((m) => m.rarity === 'very_rare');
  // Best-known rare morphs first: the priciest, by the low end of the range.
  const floor = (m) => Number((String(m.priceRange || '').match(/\$([\d,]+)/) || [0, '0'])[1].replace(/,/g, ''));
  const rare = morphs
    .filter((m) => m.rarity === 'rare')
    .sort((a, b) => floor(b) - floor(a))
    .map((m) => m.name);
  const incDom = namesWhere((m) => m.inheritance === 'incomplete-dominant');
  const recessive = namesWhere((m) => m.inheritance === 'recessive');
  const hasAlbino = morphs.some((m) => m.slug === 'albino');

  const recessiveText = recessive.length
    ? ` Recessive: ${listNames(recessive)}${hasAlbino ? ' (Albino is expected to be recessive, but test breeding has not proven it yet)' : ''}.`
    : '';

  return [
    {
      question: 'How many crested gecko morphs are there?',
      answer: `This guide covers ${total} crested gecko morphs recognized in the hobby: base colors, color modifiers, pattern types such as Harlequin, Pinstripe and Dalmatian, structural traits such as Lilly White, Soft Scale and White Wall, and named combinations such as Tricolor. Breeders also maintain project lines that are not counted as separate morphs.`,
    },
    {
      question: 'What is the rarest crested gecko morph?',
      answer: veryRare.length
        ? `The rarest entries are ${listNames(veryRare)}. The first healthy albino crested geckos were only announced in March 2026, and a true all-white Moonglow has not been produced yet; line-bred near-white animals are sold under that name. Among established morphs, ${listNames(rare.slice(0, 4))} are rare.`
        : `The rarest established morphs include ${listNames(rare.slice(0, 4))}.`,
    },
    {
      question: 'Which crested gecko morphs are genetic?',
      answer: `Only a few crested gecko morphs follow a single gene you can predict with a Punnett square. Incomplete dominant: ${listNames(incDom)}.${recessiveText} The rest, including Harlequin, Pinstripe and Dalmatian, are polygenic or line-bred: selective pairing improves the odds, but no ratio guarantees the result.`,
    },
    {
      question: 'Are there albino crested geckos?',
      answer:
        'Yes. Eureka Exotics announced the first healthy albino crested geckos on 5 March 2026. They have red or pink eyes and no black pigment. Earlier albino-looking hatchlings were too weak to breed. How the trait is inherited is not proven yet, so be careful with anyone selling albinos or het albinos before the founding breeder has proven the gene.',
    },
  ];
}

export const MORPH_INDEX_FAQ = buildMorphIndexFaq();

export default function MorphIndexFaq({ faq = MORPH_INDEX_FAQ }) {
  return (
    <section aria-labelledby="morph-faq-heading" className="space-y-3">
      <h2 id="morph-faq-heading" className="text-xl md:text-2xl font-bold text-white">
        Crested gecko morph questions
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {faq.map((item) => (
          <div key={item.question} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="text-base font-semibold text-slate-100 mb-1.5">{item.question}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
