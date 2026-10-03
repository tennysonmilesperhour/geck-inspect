/**
 * Facts for the AI Consultant (GeckoGenius) prompt.
 *
 * The consultant used to answer genetics and price questions from the
 * model's memory, so its odds could disagree with the genetics calculator
 * and its prices with the value table on the same app. For pairing and
 * value questions we now run the same code those screens run and put the
 * results in the prompt, with an instruction to use these numbers as
 * given:
 *   - odds: predictGeckoPair (collection geckos, tags through
 *     tagTranslation.js) or the omnibox pairing parser plus
 *     predictWeighted for typed pairings like "lilly white x axanthic";
 *   - prices: the trait value table (MorphMarket asking prices), through
 *     eggValue for a pairing and valueFromTraitTable for one gecko.
 */
import { predictGeckoPair, eggValue } from '@/lib/pairingValue';
import { predictWeighted } from '@/lib/genetics/predictWeighted';
import { parsePairing } from '@/lib/genetics/pairingParser';
import { stateToSpec, stateHasSelection, stateToChips } from '@/lib/genetics/calculatorCatalog';
import { translateMorphTags } from '@/lib/genetics/tagTranslation';
import { displayText } from '@/lib/genetics';
import { valueFromTraitTable } from '@/lib/traitValuation';

const MAX_OUTCOMES = 12;

const PAIRING_WORDS = /\b(pair|pairing|pairings|paired|breed|breeding|cross|crossed|offspring|babies|baby|hatchlings?|clutch|odds|chance|chances|outcomes?|produce|het|hets|punnett)\b/i;
const VALUE_WORDS = /\b(worth|value|valued|price|prices|priced|sell|selling|cost|costs|\$)\b/i;
const CROSS_MARK = /\s(x|×)\s/i;

export function isPairingQuestion(text) {
  const t = String(text || '');
  return PAIRING_WORDS.test(t) || CROSS_MARK.test(t);
}

export function isValueQuestion(text) {
  return VALUE_WORDS.test(String(text || ''));
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Geckos from the member's collection named in the message, in the order
 * they appear. Longer names win over names they contain ("Luna Belle"
 * over "Luna").
 */
export function findMentionedGeckos(text, geckos) {
  const message = String(text || '');
  const candidates = (geckos || [])
    .filter((g) => g?.name && String(g.name).trim().length >= 2)
    .sort((a, b) => String(b.name).length - String(a.name).length);
  const taken = [];
  const found = [];
  for (const g of candidates) {
    const name = String(g.name).trim();
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(name)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
    const m = re.exec(message);
    if (!m) continue;
    const start = m.index + m[1].length;
    const end = start + name.length;
    if (taken.some(([a, b]) => start < b && end > a)) continue;
    taken.push([start, end]);
    found.push({ gecko: g, at: start });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.gecko);
}

const pct = (p) => `${(Math.round(p * 1000) / 10).toFixed(1)}%`;
const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

function sexWord(g) {
  const s = String(g?.sex || '').toLowerCase();
  if (s.startsWith('m')) return 'male';
  if (s.startsWith('f')) return 'female';
  return 'unsexed';
}

// Put the male first when the sexes say so; otherwise keep message order.
function orderPair(a, b) {
  if (sexWord(a) === 'female' && sexWord(b) === 'male') return [b, a];
  return [a, b];
}

function describeGecko(g) {
  const tags = (g.morph_tags || []).filter(Boolean);
  const { notUsed } = translateMorphTags(tags);
  const lines = [`${g.name} (${sexWord(g)}): ${tags.length ? tags.join(', ') : 'no morph tags'}`];
  if (notUsed.length) {
    lines.push(`  Tags the calculator cannot use: ${notUsed.map((n) => n.tag).join(', ')}`);
  }
  return lines.join('\n');
}

function outcomeLines(prediction, priceIndex) {
  const phenotypes = prediction?.offspring_phenotypes || [];
  const valued = eggValue(phenotypes, priceIndex);
  const lines = valued.outcomes.slice(0, MAX_OUTCOMES).map((o) => {
    if (o.lethal) return `- ${pct(o.probability)} ${o.label} (does not survive)`;
    const price = priceIndex && o.matched ? `, about ${money(o.price)} as an unsexed hatchling` : '';
    return `- ${pct(o.probability)} ${o.label}${price}`;
  });
  if (valued.outcomes.length > MAX_OUTCOMES) {
    lines.push(`- plus ${valued.outcomes.length - MAX_OUTCOMES} smaller outcomes`);
  }
  if (priceIndex) {
    lines.push(`Expected value per egg: ${money(valued.perEgg)} (odds times median MorphMarket hatchling asking prices).`);
  }
  if (valued.lethalShare > 0) {
    lines.push(`Eggs that will not survive: ${pct(valued.lethalShare)}.`);
  }
  for (const w of prediction?.warnings || []) {
    if (w?.message) lines.push(`Warning: ${displayText(w.message)}`);
  }
  if (prediction?.uncertain) {
    lines.push('Some parent genetics are possible hets, so these odds are weighted averages.');
  }
  return lines;
}

function collectionPairingBlock(sire, dam, priceIndex) {
  let prediction;
  try {
    prediction = predictGeckoPair(sire, dam);
  } catch {
    return null;
  }
  return [
    'Pairing from the member\'s collection:',
    describeGecko(sire),
    describeGecko(dam),
    'Offspring odds per egg:',
    ...outcomeLines(prediction, priceIndex),
  ].join('\n');
}

function typedPairingBlock(text, priceIndex) {
  if (!CROSS_MARK.test(` ${text} `)) return null;
  const parsed = parsePairing(text);
  if (!stateHasSelection(parsed.sire) || !stateHasSelection(parsed.dam)) return null;
  let prediction;
  try {
    prediction = predictWeighted(stateToSpec(parsed.sire), stateToSpec(parsed.dam));
  } catch {
    return null;
  }
  const chips = (state) => stateToChips(state).join(', ');
  return [
    'Pairing as typed by the member:',
    `Parent 1: ${chips(parsed.sire)}`,
    `Parent 2: ${chips(parsed.dam)}`,
    'Offspring odds per egg:',
    ...outcomeLines(prediction, priceIndex),
  ].join('\n');
}

function singleValueBlock(gecko, priceIndex) {
  if (!priceIndex) return null;
  const v = valueFromTraitTable(gecko, priceIndex, 'breeder');
  if (!v) {
    return `Value table: no MorphMarket price data matches ${gecko.name}'s traits.`;
  }
  return [
    `Value table estimate for ${gecko.name}: about ${money(v.value)}`,
    `(priced by ${v.trait}, ${v.levelLabel}; MorphMarket asking prices from ${v.band.n} listings,`,
    `middle half ${money(v.band.p25)} to ${money(v.band.p75)}. Structure and quality move the real price.)`,
  ].join(' ');
}

/**
 * Build the facts block for one message. Returns '' when the message is
 * not a pairing or value question, or nothing could be computed, so the
 * prompt is unchanged for everyday questions.
 */
export function buildConsultantFacts(text, { geckos = [], priceIndex = null } = {}) {
  const pairing = isPairingQuestion(text);
  const value = isValueQuestion(text);
  if (!pairing && !value) return '';

  const blocks = [];
  const mentioned = findMentionedGeckos(text, geckos);

  if (pairing && mentioned.length >= 2) {
    const [sire, dam] = orderPair(mentioned[0], mentioned[1]);
    const block = collectionPairingBlock(sire, dam, priceIndex);
    if (block) blocks.push(block);
  } else if (pairing) {
    const block = typedPairingBlock(text, priceIndex);
    if (block) blocks.push(block);
  }

  if (value && mentioned.length >= 1 && !(pairing && mentioned.length >= 2)) {
    for (const g of mentioned.slice(0, 3)) {
      const block = singleValueBlock(g, priceIndex);
      if (block) blocks.push(block);
    }
  }

  if (blocks.length === 0) return '';
  return [
    'FACTS FROM GECK INSPECT (the genetics calculator and the value table). Use these numbers exactly as given.',
    'Do not recalculate odds or invent other prices. If the member asks about something these facts do not cover, say the calculator did not cover it.',
    '',
    blocks.join('\n\n'),
  ].join('\n');
}

