/**
 * The shareable Morph ID result card (plan item E2 17).
 *
 * One place turns a stored Morph ID answer into the words a card shows,
 * so the in-app preview and the public share page (api/morph-share.js)
 * say exactly the same thing.
 *
 * Plain words, not percentages: Morph ID's scores are not calibrated
 * probabilities (the evaluation puts top-1 near 40 percent), so a card
 * that said "58%" would read as a measurement it is not. The card says
 * "likely" and "possible" and a confidence word instead, and always
 * carries the line "Visual traits, not proven genes". Only a best match
 * is called "likely"; a tentative answer, even one where a look leads,
 * says "possibly", because Morph ID itself did not commit to it.
 */
import { labelFor } from '../components/morph-id/morphTaxonomy.js';
import { morphHeadline } from '../components/morph-id/morphHeadline.js';

export const SHARE_DISCLAIMER = 'Visual traits, not proven genes';
export const SHARE_ID_PATTERN = /^[0-9a-f]{16}$/;
export const SHARE_PATH_PREFIX = '/morph-id/r/';
// The query parameter a share link carries to the sign-up form.
export const SHARE_REF_PARAM = 'ms';
export const SHARE_UTM = {
  utm_source: 'morph_id_card',
  utm_medium: 'share',
  utm_campaign: 'morph_card',
};

// In a tentative answer, a look leads only when it clearly beats the next
// one. A leader is named alone ("Possibly Harlequin") with moderate
// confidence; below these numbers the card offers two looks with low
// confidence.
const LEAD_MIN_SCORE = 50;
const LEAD_MIN_MARGIN = 10;
const POSSIBLE_MIN_SCORE = 20;

// Taxonomy labels written for breeders sometimes carry a number
// ("Full Pinstripe (100%)"); the card keeps the name only.
function plainLabel(id) {
  return labelFor(id, '').replace(/\s*\(\d+%\)/g, '').trim();
}

function candidatesOf(card) {
  const seen = new Set();
  const list = Array.isArray(card?.candidate_morphs) ? card.candidate_morphs : [];
  const out = [];
  for (const item of list) {
    const morph = typeof item?.morph === 'string' ? item.morph : null;
    const score = Number(item?.score);
    if (!morph || seen.has(morph) || !Number.isFinite(score)) continue;
    seen.add(morph);
    out.push({ morph, score });
  }
  if (out.length === 0 && typeof card?.primary_morph === 'string' && card.primary_morph) {
    out.push({ morph: card.primary_morph, score: Number(card.confidence_score) || 0 });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * What the card says.
 *
 * @param {object} card - the stored card (morph_id_shares.card)
 * @returns {{
 *   headline: string,
 *   likely: string[],
 *   possible: string[],
 *   confidence: { level: 'high' | 'medium' | 'low', word: string, detail: string },
 *   disclaimer: string,
 * }}
 */
export function shareCardView(card) {
  const status = card?.assessment_status;
  const candidates = candidatesOf(card);
  const top = candidates[0] || null;
  const lead = top ? top.score - (candidates[1]?.score ?? 0) : 0;
  // Only Morph ID's own best match is "likely".
  const strong = status === 'best_match' && Boolean(top);
  const leads = Boolean(top) && (strong || (top.score >= LEAD_MIN_SCORE && lead >= LEAD_MIN_MARGIN));
  const genes = (Array.isArray(card?.genetic_traits) ? card.genetic_traits : [])
    .filter((id) => typeof id === 'string' && id);

  const likely = [];
  const possible = [];
  if (strong) likely.push(plainLabel(top.morph));
  for (const c of candidates) {
    if (strong && c === top) continue;
    // The top look is always listed, first among the possible ones.
    if (c.score >= POSSIBLE_MIN_SCORE || c === top) possible.push(plainLabel(c.morph));
  }
  // A photo can suggest Lilly White or Axanthic but cannot prove the
  // gene, so a trait is only "likely" when the whole answer is strong.
  for (const id of genes) (strong ? likely : possible).push(plainLabel(id));

  const unique = (list) => [...new Set(list.filter(Boolean))];
  const likelyOut = unique(likely);
  const possibleOut = unique(possible).filter((label) => !likelyOut.includes(label)).slice(0, 4);

  let headline;
  if (leads) {
    // A tentative leader is named the same way, without the photo-read
    // genes (those stay "possible"), and with "Possibly" in front.
    const name = morphHeadline(top.morph, strong ? genes : []).name.replace(/\s*\(\d+%\)/g, '')
      || (strong ? likelyOut[0] : possibleOut[0]);
    headline = `${strong ? 'Likely' : 'Possibly'} ${name}`;
  } else if (possibleOut.length) {
    headline = `Possibly ${possibleOut.slice(0, 2).join(' or ')}`;
  } else {
    headline = 'Crested gecko Morph ID result';
  }

  let confidence;
  if (strong) {
    confidence = {
      level: 'high',
      word: 'Strong visual match',
      detail: 'The photos and the closest breeder-tagged reference photos point the same way.',
    };
  } else if (leads) {
    confidence = {
      level: 'medium',
      word: 'Moderate confidence',
      detail: 'One look leads, but other looks still fit these photos.',
    };
  } else {
    confidence = {
      level: 'low',
      word: 'Low confidence',
      detail: 'Several looks fit these photos about equally. Better photos or a breeder can settle it.',
    };
  }

  return { headline, likely: likelyOut, possible: possibleOut, confidence, disclaimer: SHARE_DISCLAIMER };
}

/** The social preview text (title and description) for a card. */
export function shareCardMeta(card) {
  const view = shareCardView(card);
  const title = `${view.headline} crested gecko | Geck Inspect Morph ID`;
  const parts = [`${view.confidence.word}.`];
  if (view.likely.length) parts.push(`Likely: ${view.likely.join(', ')}.`);
  if (view.possible.length) parts.push(`Possible: ${view.possible.join(', ')}.`);
  parts.push(`${SHARE_DISCLAIMER}. Try Morph ID free on your own crested gecko.`);
  return { title, description: parts.join(' '), view };
}

const ID = /^[a-z][a-z0-9_]{0,39}$/;

/**
 * The card a Morph ID answer becomes, trimmed the same way the database
 * trims it (morph_id_share_card_from). Used for the preview before the
 * member taps Share; the stored card is always the server's copy.
 */
export function cardFromAnalysis(analysis) {
  const a = analysis && typeof analysis === 'object' ? analysis : {};
  const num = (v) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.min(100, Math.max(0, Math.round(Number(v)))) : 0);
  return {
    primary_morph: typeof a.primary_morph === 'string' && ID.test(a.primary_morph) ? a.primary_morph : null,
    genetic_traits: (Array.isArray(a.genetic_traits) ? a.genetic_traits : [])
      .slice(0, 6)
      .filter((t) => typeof t === 'string' && ID.test(t)),
    candidate_morphs: (Array.isArray(a.candidate_morphs) ? a.candidate_morphs : [])
      .slice(0, 5)
      .filter((c) => c && typeof c === 'object' && typeof c.morph === 'string' && ID.test(c.morph) && Number.isFinite(Number(c.score)))
      .map((c) => ({ morph: c.morph, score: num(c.score) })),
    assessment_status: ['best_match', 'tentative', 'insufficient_evidence'].includes(a.assessment_status)
      ? a.assessment_status
      : 'tentative',
    confidence_score: num(a.confidence_score),
  };
}

/** True when an answer has something worth putting on a card. */
export function canShareAnalysis(analysis) {
  if (!analysis || analysis.assessment_status === 'insufficient_evidence') return false;
  const card = cardFromAnalysis(analysis);
  return Boolean(card.primary_morph || card.candidate_morphs.length);
}

// What to tell the member when the database refuses a card.
const SHARE_ERRORS = {
  morph_share_auth_required: 'Sign in again to share this result.',
  morph_share_bad_photo: 'This photo cannot go on a card. Share a result from photos you uploaded here.',
  morph_share_no_result: 'This result cannot be shared. Run Morph ID on these photos again, then tap Share.',
  morph_share_nothing_to_share: 'A "better photos needed" answer has nothing to share yet. Retake the photos first.',
  morph_share_rate_limited: 'You have shared a lot of cards today. Try again tomorrow.',
  morph_share_bad_request: 'Something was wrong with that request. Run Morph ID again, then tap Share.',
};

export function shareErrorMessage(error) {
  const text = `${error?.message || ''} ${error?.details || ''}`;
  const code = Object.keys(SHARE_ERRORS).find((key) => text.includes(key));
  return code ? SHARE_ERRORS[code] : 'Sharing did not work just now. Please try again in a minute.';
}

export function isShareId(value) {
  return typeof value === 'string' && SHARE_ID_PATTERN.test(value);
}

/** The public address of a card. */
export function shareUrl(id, origin = 'https://geckinspect.com') {
  return `${String(origin).replace(/\/$/, '')}${SHARE_PATH_PREFIX}${id}`;
}

/**
 * Where the share page sends a viewer: Morph ID or the sign-up form,
 * carrying the card id (so a sign-up is credited to the card) and UTM
 * tags (so the first-touch record says where the visitor came from).
 */
export function shareInviteHref(id, path = '/Recognition', extra = {}) {
  const params = new URLSearchParams({ ...extra, [SHARE_REF_PARAM]: id, ...SHARE_UTM });
  return `${path}?${params.toString()}`;
}

/** The public photo address for a stored storage path. */
export function shareImageUrl(supabaseUrl, imagePath) {
  if (typeof imagePath !== 'string' || !imagePath || imagePath.includes('..')) return null;
  const path = imagePath.split('/').map(encodeURIComponent).join('/');
  return `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/geck-inspect-media/${path}`;
}

// Link previews from social apps fetch the page too. They are not people,
// so they must not count as views. classifyAgent (api/_lib/bots.js)
// already catches crawlers and scripts; these are the preview fetchers it
// does not name. In-app browsers (Facebook's FBAN, Instagram, Snapchat,
// LINE) are people reading the page and are deliberately not listed.
const PREVIEW_FETCHERS = [
  'facebookexternalhit', 'facebookcatalog', 'facebot', 'meta-externalagent', 'twitterbot',
  'slackbot', 'discordbot', 'whatsapp', 'telegrambot', 'linkedinbot', 'pinterestbot',
  'redditbot', 'embedly', 'skypeuripreview', 'iframely', 'vkshare', 'mastodon', 'cardyb',
  'google-pagerenderer', 'applebot', 'quora link preview', 'bitlybot', 'headlesschrome',
  'lighthouse', 'preview',
];

export function isLinkPreviewFetcher(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  if (!ua) return true;
  return PREVIEW_FETCHERS.some((needle) => ua.includes(needle));
}
