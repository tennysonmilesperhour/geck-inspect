/**
 * Super forms that breeders avoid making on purpose: Super Lilly White is
 * lethal, and Super Cappuccino and Super Highway hatch with documented or
 * reported health problems. Their Morph Guide pages must not invite a
 * visitor to breed one, price one or identify one from a photo, so this
 * file decides what those pages show instead: a short "not bred on
 * purpose" note that points to the safe pairing.
 *
 * Before 16 Oct 2026 /MorphGuide/super-lilly-white said "Breed a Super
 * Lilly White", "What is a Super Lilly White worth?" and "Track your own
 * Super Lilly White's lineage and value", on a page that says no Super
 * Lilly White lives past a few days.
 *
 * Relative imports only, so Node scripts can import it too.
 */
import { getMorph } from '../data/morph-guide.js';

const TITLE = {
  lethal: 'Not bred on purpose: two copies are lethal',
  health: 'Not bred on purpose: breeders avoid producing it',
};

const FACT = {
  lethal: 'Lethal, avoid',
  health: 'Health risk, avoid',
};

/**
 * The "not bred on purpose" details for a morph page, or null for every
 * morph a keeper can breed on purpose.
 *
 * @returns {null | {
 *   reason: 'lethal' | 'health',
 *   title: string,
 *   fact: string,
 *   safeText: string | null,
 *   safeLabel: string | null,
 *   pairingHref: string | null,
 *   parent: { slug: string, name: string } | null,
 * }}
 */
export function notBredStatus(morph) {
  const reason = morph?.doNotBreed;
  if (reason !== 'lethal' && reason !== 'health') return null;
  // A super page's one-copy morph: super-lilly-white -> lilly-white.
  const parent = getMorph(String(morph.slug || '').replace(/^super-/, ''));
  const safe = morph.safePairing || null;
  return {
    reason,
    title: TITLE[reason],
    fact: FACT[reason],
    safeText: safe?.text || null,
    safeLabel: safe?.label || null,
    pairingHref: safe?.pairing ? `/calculator/pairing/${safe.pairing}` : null,
    parent: parent && parent.slug !== morph.slug ? { slug: parent.slug, name: parent.name } : null,
  };
}

/**
 * Whether a living gecko can be this morph. A lethal super never grows
 * up, so it is left out of photo labels and ID options; a member photo
 * labelled Super Lilly White is always a mislabel.
 */
export function isLivingMorph(morph) {
  return morph?.doNotBreed !== 'lethal';
}
