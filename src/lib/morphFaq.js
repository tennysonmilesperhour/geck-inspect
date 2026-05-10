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
 * never fabricates a fact.
 */

import { INHERITANCE, PRICE_TIERS } from '@/data/morph-guide';

function inheritanceAnswer(morph) {
  const inh = INHERITANCE[morph.inheritance];
  if (!inh) return null;
  const base = inh.description;
  const special = morph.slug === 'lilly-white'
    ? ' Lilly White specifically has a lethal super form ,  pairing two Lilly Whites together produces 25% non-viable homozygous embryos, so the morph cannot be bred "true".'
    : '';
  return `${morph.name} is classified as ${inh.label.toLowerCase()}. ${base}${special}`;
}

function priceAnswer(morph) {
  if (!morph.priceTier) return null;
  const tier = PRICE_TIERS[morph.priceTier];
  const range = morph.priceRange ? ` Typical adult price: ${morph.priceRange}.` : '';
  return `${morph.name} crested geckos fall into the ${tier?.label || morph.priceTier} price tier.${range} ${tier?.description || ''}`.trim();
}

function identificationAnswer(morph) {
  if (morph.visualIdentifiers?.length) {
    return `Look for: ${morph.visualIdentifiers.slice(0, 3).join('; ')}.`;
  }
  if (morph.keyFeatures?.length) {
    return `Key visual features: ${morph.keyFeatures.slice(0, 3).join('; ')}.`;
  }
  return null;
}

function combinesAnswer(morph) {
  if (!morph.combinesWith?.length) return null;
  const names = morph.combinesWith
    .map((s) => s.replace(/-/g, ' '))
    .slice(0, 6);
  return `${morph.name} commonly combines with ${names.join(', ')}. These combinations are highly sought after in the hobby and often produce some of the most visually striking animals.`;
}

function historyAnswer(morph) {
  return morph.history || null;
}

function summaryAnswer(morph) {
  return morph.summary || morph.description?.slice(0, 280) || null;
}

/**
 * Return an ordered list of { question, answer } pairs for a morph.
 * Short questions, concrete answers ,  optimized for both People Also
 * Ask extraction and readability on the page itself.
 */
export function morphFaq(morph) {
  if (!morph) return [];
  const out = [];

  const summary = summaryAnswer(morph);
  if (summary) {
    out.push({
      question: `What is a ${morph.name} crested gecko?`,
      answer: summary,
    });
  }

  const ident = identificationAnswer(morph);
  if (ident) {
    out.push({
      question: `How do I identify a ${morph.name} crested gecko?`,
      answer: ident,
    });
  }

  const inheritance = inheritanceAnswer(morph);
  if (inheritance) {
    out.push({
      question: `How is ${morph.name} inherited?`,
      answer: inheritance,
    });
  }

  const price = priceAnswer(morph);
  if (price) {
    out.push({
      question: `How much does a ${morph.name} crested gecko cost?`,
      answer: price,
    });
  }

  const combines = combinesAnswer(morph);
  if (combines) {
    out.push({
      question: `What other morphs combine with ${morph.name}?`,
      answer: combines,
    });
  }

  const history = historyAnswer(morph);
  if (history) {
    out.push({
      question: `Who discovered or first produced ${morph.name} crested geckos?`,
      answer: history,
    });
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
