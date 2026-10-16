/**
 * What "Verified breeder" means, in one place.
 *
 * Until October 2026 the phrase meant three different things: the
 * verification page said Geck Inspect issues no verified badge at all, the
 * breeder pages showed a "Verified breeder" badge, and the About page
 * called the whole community "verified". The badge is the real thing
 * (decision D9): an admin ticks five checks by hand and the database
 * refuses the badge unless all five are ticked
 * (admin_set_breeder_verified, migration
 * 20261003024339_breeder_trust_verified_reviews_featured.sql). Every
 * surface now reads its words from here.
 */

export const VERIFIED_BREEDER_LABEL = 'Verified breeder';

// The five checks, in the order the admin ticks them. The keys are the
// ones the database requires; do not rename them.
export const VERIFIED_BREEDER_CHECKS = [
  {
    key: 'identity',
    label: 'Identity',
    hint: 'Name or business matches their MorphMarket store, social accounts or website.',
    plain: 'who the breeder is',
  },
  {
    key: 'own_animals',
    label: 'Their own crested geckos',
    hint: 'Tracks crested geckos of their own here, with photos (see the gecko count).',
    plain: 'their own crested geckos kept on Geck Inspect with photos',
  },
  {
    key: 'sales_record',
    label: 'Sales record',
    hint: 'At least one claimed transfer, or a sales history we can check elsewhere.',
    plain: 'a record of past sales',
  },
  {
    key: 'policies',
    label: 'Store policies',
    hint: 'Published policies for shipping, live arrival and payment.',
    plain: 'published store policies (shipping, live arrival and payment)',
  },
  {
    key: 'clean_record',
    label: 'No open complaints',
    hint: 'No unresolved reports or support tickets about this breeder.',
    plain: 'no open complaints',
  },
];

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function listInWords(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** One sentence, used wherever the badge is explained. */
export const VERIFIED_BREEDER_DEFINITION =
  `A Verified breeder badge means the Geck Inspect team checked ${NUMBER_WORDS[VERIFIED_BREEDER_CHECKS.length] || VERIFIED_BREEDER_CHECKS.length} things by hand: ` +
  `${listInWords(VERIFIED_BREEDER_CHECKS.map((c) => c.plain))}.`;

/** What the badge does not promise. */
export const VERIFIED_BREEDER_LIMITS =
  'It is not a guarantee of any one animal or sale, so read the animal’s own history on the listing too.';

/** Every other member: what any account has, badge or not. */
export const EVERY_SELLER_HAS =
  'Every seller has an account with a confirmed email and a visible history on Geck Inspect.';

/** Where the full explanation lives (a section of the verification page). */
export const VERIFIED_BREEDER_HELP_PATH = '/MarketplaceVerification#verified-breeder';
