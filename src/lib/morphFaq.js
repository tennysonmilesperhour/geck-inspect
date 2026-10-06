/**
 * Per-morph FAQ generator.
 *
 * Builds a short, accurate FAQ from a morph's structured data so every
 * /MorphGuide/<slug> page can:
 *   - render a visible "Frequently asked questions" section, and
 *   - emit a FAQPage JSON-LD block that captures People-Also-Ask
 *     traffic in Google and feeds AI Overviews / Perplexity answer
 *     extraction.
 *
 * Accuracy comes from the data, not the template: questions that
 * depend on a field are skipped when that field is missing, so this
 * never fabricates a fact. Every answer is a complete sentence, because
 * answer engines quote them on their own.
 *
 * Relative imports only: scripts/prerender.mjs imports this file from
 * Node (no Vite, no '@/' alias), so the static FAQ and the React FAQ are
 * the same list.
 */

import { INHERITANCE, MORPHS } from '../data/morph-guide.js';
import { article, morphSeo } from './morphMeta.js';

const MORPH_BY_SLUG = Object.fromEntries(MORPHS.map((m) => [m.slug, m]));

// Fragments from the data are folded into sentences, so their first word
// is lowercased unless the fragment opens with a morph name, a multi-word
// alias or one of these proper nouns. Single-word aliases ("Red", "Solid")
// are ordinary words in a sentence, so they are left out.
const PROPER_STARTS = [
  ...MORPHS.flatMap((m) => [m.name, ...(m.aliases || []).filter((a) => /\s/.test(a))]),
  'Foundation Genetics',
  'Eureka Exotics',
  'Lilly',
  'Gold Standard',
].sort((a, b) => b.length - a.length);

// Notes that the generic inheritance text cannot carry.
const INHERITANCE_NOTES = {
  'lilly-white':
    'Lilly White has a lethal super form: pairing two Lilly Whites gives 25% Super Lilly White embryos that die in the egg, so the morph cannot be bred true.',
  albino:
    'This is expected rather than proven. The first healthy albino hatchlings were announced in March 2026, and breeding has not yet confirmed how the gene is passed on.',
};

/** Capitalize, trim and end with a full stop. */
function sentence(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const capped = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

/** Lowercase the first word of a fragment unless it is a name or acronym. */
function lcFirst(text) {
  const t = String(text || '').trim().replace(/[.;,\s]+$/, '');
  if (!/^[A-Z](?:[a-z]|\s)/.test(t)) return t;
  const isProper = PROPER_STARTS.some((n) => t.startsWith(n) && !/[A-Za-z]/.test(t.charAt(n.length)));
  return isProper ? t : t.charAt(0).toLowerCase() + t.slice(1);
}

/** "a, b and c" */
function listJoin(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function nameOf(slug) {
  return MORPH_BY_SLUG[slug]?.name || null;
}

function whatIsAnswer(morph) {
  return morphSeo(morph).definition || null;
}

function lookAnswer(morph) {
  const features = (morph.keyFeatures || []).slice(0, 3).map(lcFirst).filter(Boolean);
  if (!features.length) return null;
  return sentence(`A typical ${morph.name} crested gecko shows these features: ${features.join('; ')}`);
}

function identificationAnswer(morph) {
  const points = (morph.visualIdentifiers || []).slice(0, 3).map(lcFirst).filter(Boolean);
  if (!points.length) return null;
  return sentence(`To identify ${article(morph.name)} ${morph.name} crested gecko, check these points: ${points.join('; ')}`);
}

function differenceQuestion(morph) {
  const first = (morph.lookalikes || []).find((l) => l?.slug && l?.difference && nameOf(l.slug));
  if (!first) return null;
  return {
    question: `What is the difference between ${morph.name} and ${nameOf(first.slug)}?`,
    answer: sentence(first.difference),
  };
}

function inheritanceAnswer(morph) {
  const inh = INHERITANCE[morph.inheritance];
  if (!inh) return null;
  const note = INHERITANCE_NOTES[morph.slug];
  return [
    `${morph.name} is classified as ${inh.label.toLowerCase()}.`,
    sentence(inh.description),
    note || '',
  ].filter(Boolean).join(' ');
}

function priceAnswer(morph) {
  if (!morph.priceRange) return null;
  return `A typical adult ${morph.name} crested gecko sells for ${morph.priceRange}. Quality, sex, age and lineage move an individual animal within that range.`;
}

function combinesAnswer(morph) {
  const names = (morph.combinesWith || []).map(nameOf).filter(Boolean).slice(0, 6);
  if (!names.length) return null;
  return `${morph.name} is often combined with ${listJoin(names)}.`;
}

function historyAnswer(morph) {
  return morph.history ? sentence(morph.history) : null;
}

/**
 * Return an ordered list of { question, answer } pairs for a morph.
 * Short questions, concrete answers, optimized for both People Also
 * Ask extraction and readability on the page itself.
 */
export function morphFaq(morph) {
  if (!morph) return [];
  const name = morph.name;
  const a = article(name);
  const entries = [
    [`What is ${a} ${name} crested gecko?`, whatIsAnswer(morph)],
    [`What does ${a} ${name} crested gecko look like?`, lookAnswer(morph)],
    [`How do I identify ${a} ${name} crested gecko?`, identificationAnswer(morph)],
  ];
  const out = entries
    .filter(([, answer]) => answer)
    .map(([question, answer]) => ({ question, answer }));

  const difference = differenceQuestion(morph);
  if (difference) out.push(difference);

  for (const [question, answer] of [
    [`How is ${name} inherited?`, inheritanceAnswer(morph)],
    [`How much does ${a} ${name} crested gecko cost?`, priceAnswer(morph)],
    [`What other morphs combine with ${name}?`, combinesAnswer(morph)],
    [`Who discovered or first produced ${name} crested geckos?`, historyAnswer(morph)],
  ]) {
    if (answer) out.push({ question, answer });
  }
  return out;
}

/**
 * Schema.org FAQPage node for the morph, or null if no FAQ entries.
 */
export function morphFaqSchema(morph) {
  const faqs = morphFaq(morph);
  if (faqs.length === 0) return null;
  return {
    '@type': 'FAQPage',
    '@id': `https://geckinspect.com/MorphGuide/${morph.slug}#faq`,
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };
}
