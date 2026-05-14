/**
 * Social Media Manager ,  shared client-side constants and helpers.
 *
 * Voice presets, post templates, and platform metadata are mirrored on the
 * server (generate-social-post edge function) so prompt construction stays
 * consistent between what the user sees and what the model receives.
 */

export const VOICE_PRESETS = [
  {
    key: 'educator',
    label: 'Educator',
    blurb: 'Teaches genetics or husbandry as you go. Credible and warm.',
  },
  {
    key: 'storyteller',
    label: 'Storyteller',
    blurb: 'Personal, journey-focused, present-tense moments.',
  },
  {
    key: 'hobbyist_hype',
    label: 'Hobbyist hype',
    blurb: 'Excited peer-to-peer voice. Reads like a Discord post.',
  },
  {
    key: 'pro_breeder',
    label: 'Pro breeder',
    blurb: 'Clinical and project-forward. Lineage-led, reputation-building.',
  },
  {
    key: 'casual',
    label: 'Casual',
    blurb: 'Low-key friend tone. Asks the audience an open question.',
  },
];

export const POST_TEMPLATES = [
  { key: 'meet',        label: 'Meet / introduce',     blurb: 'New gecko, holdback reveal, fresh face on the rack.' },
  { key: 'available',   label: 'Available for sale',   blurb: 'Sales post. Will include disclaimers automatically.' },
  { key: 'pairing',     label: 'Pairing announcement', blurb: 'Paired this gecko with another. Lineage-aware.' },
  { key: 'eggs',        label: 'Eggs laid / due',      blurb: 'Update on a clutch in incubation.' },
  { key: 'hatchling',   label: 'Hatchling debut',      blurb: 'New hatchling, often grouped with siblings.' },
  { key: 'milestone',   label: 'Milestone',            blurb: 'Weight, age, first shed, first ovulation.' },
  { key: 'throwback',   label: 'Throwback / glow-up',  blurb: 'Then vs now. Pulls from oldest and newest photos.' },
  { key: 'lineage',     label: 'Lineage spotlight',    blurb: 'Daughter of X, paired with Y. Story-led.' },
  { key: 'educational', label: 'Educational',          blurb: "Explains this gecko's morph or trait combo to the audience." },
];

export const PLATFORMS = [
  { key: 'bluesky',          label: 'Bluesky',          mode: 'direct',     hint: 'Posts directly via app password.' },
  { key: 'facebook_page',    label: 'Facebook Page',    mode: 'direct',     hint: 'Posts directly to your Facebook Page via Meta Graph API.' },
  { key: 'instagram',        label: 'Instagram',        mode: 'direct',     hint: 'Posts directly to your IG Business account. Requires a photo on the gecko.' },
  { key: 'reddit',           label: 'Reddit',           mode: 'direct',     hint: 'Posts directly via OAuth. Defaults to your u/profile; you can change to a subreddit in Connections.' },
  { key: 'threads',          label: 'Threads',          mode: 'clipboard',  hint: 'Copy to clipboard. Direct posting in v2.' },
  { key: 'x',                label: 'X (Twitter)',      mode: 'clipboard',  hint: 'Copy to clipboard, deep-link to compose.' },
  { key: 'tiktok',           label: 'TikTok',           mode: 'clipboard',  hint: 'Returns a video script you can use as a shot list.' },
  { key: 'youtube_community',label: 'YouTube Community',mode: 'clipboard',  hint: 'Copy to clipboard.' },
];

// Hard character limits enforced by each platform's API. `null` means the
// platform has a soft/effectively-unlimited limit (we don't show a counter
// warning for those). Used for per-platform preview counters and to pick a
// "primary" platform that drives generation when the user fans a single
// post out to several platforms at once.
export const PLATFORM_CHAR_LIMITS = {
  bluesky: 300,
  x: 280,
  threads: 500,
  reddit: null,
  facebook_page: null,
  instagram: null,
  tiktok: null,
  youtube_community: null,
};

// When a user selects multiple platforms, generation has to target a single
// set of platform rules. We pick the most restrictive selected platform so
// the generated text fits everywhere it'll be posted.
export function pickPrimaryPlatform(selected) {
  const order = ['bluesky', 'x', 'threads', 'tiktok', 'reddit', 'facebook_page', 'instagram', 'youtube_community', 'clipboard'];
  for (const key of order) {
    if (selected.includes(key)) return key;
  }
  return selected[0] || 'bluesky';
}

export function platformLabel(key) {
  return PLATFORMS.find((p) => p.key === key)?.label || key;
}

export function voiceLabel(key) {
  return VOICE_PRESETS.find((v) => v.key === key)?.label || key;
}

// Compose the final text-with-hashtags string the way each platform expects.
export function composePlatformText({ content, hashtags = [], platform }) {
  const tags = (hashtags || []).map((h) => (h && !h.startsWith('#')) ? `#${h}` : h).filter(Boolean);
  if (platform === 'instagram') return `${content}\n\n${tags.join(' ')}`.trim();
  if (platform === 'reddit') return content.trim(); // hashtags banned
  return [content, tags.join(' ')].filter(Boolean).join(' ').trim();
}

// Deep links for "open the platform's compose box with my text pre-filled"
// where it's possible. Falls back to the platform's home if no compose URL.
export function platformDeepLink(platform, text) {
  const enc = encodeURIComponent(text);
  switch (platform) {
    case 'x':            return `https://twitter.com/intent/tweet?text=${enc}`;
    case 'reddit':       return `https://www.reddit.com/r/CrestedGecko/submit?title=${enc.slice(0, 1500)}`;
    case 'threads':      return `https://www.threads.net/intent/post?text=${enc}`;
    case 'facebook_page':return `https://www.facebook.com/`;
    case 'instagram':    return `https://www.instagram.com/`;
    case 'tiktok':       return `https://www.tiktok.com/upload`;
    case 'youtube_community': return `https://studio.youtube.com/`;
    default:             return null;
  }
}

// Curated crested-gecko hashtag library, grouped so the composer can
// render category chips. Tags here mirror what the server prompt knows
// about; click in the UI just adds/removes the tag from the post's
// hashtag list, server-side generation will still propose its own.
export const HASHTAG_LIBRARY = [
  {
    key: 'core',
    label: 'Core',
    blurb: 'High-volume crestie tags. Use 1-2 always.',
    tags: [
      'crestedgecko', 'crestedgeckos', 'correlophusciliatus',
      'reptilesofinstagram', 'geckosofinstagram', 'cresties',
    ],
  },
  {
    key: 'morph',
    label: 'Morphs',
    blurb: 'Pick the ones that match this animal.',
    tags: [
      'lillywhite', 'lillywhitecrested', 'lillywhitegecko',
      'harlequincrestedgecko', 'extremeharlequin',
      'phantomcrestedgecko', 'phantomgecko',
      'cappuccinocrestedgecko', 'mochacrestedgecko',
      'axanthiccrestedgecko', 'axanthicgecko',
      'sablecrestedgecko',
      'highwaycrestedgecko', 'pinstripegecko',
      'dalmatiancrestedgecko', 'pinstripecrestedgecko', 'fullpinstripe',
      'patternlesscrestedgecko', 'tigercrestedgecko',
    ],
  },
  {
    key: 'breeding',
    label: 'Breeding / lifecycle',
    blurb: 'Eggs, hatchlings, projects.',
    tags: [
      'geckoeggs', 'crestedgeckohatchling', 'babygecko', 'geckohatching',
      'crestedgeckobreeding', 'breedingproject',
    ],
  },
  {
    key: 'sales',
    label: 'Sales / community',
    blurb: 'Use when this gecko is available or you want commerce eyes.',
    tags: [
      'crestedgeckosforsale', 'reptilebreeder', 'crestedgeckobreeder',
      'morphmarket', 'geckobreeding', 'cresteddaddy', 'reptilelife',
    ],
  },
  {
    key: 'evergreen',
    label: 'Niche / evergreen',
    blurb: 'Genus tags + fired states.',
    tags: [
      'correlophus', 'rhacodactylus',
      'firedupgecko', 'firedup',
    ],
  },
];

// Flat lookup for "is this tag already in the hashtag string?"
export function normalizeHashtag(tag) {
  return (tag || '').replace(/^#/, '').toLowerCase().trim();
}

// Build a single-row CSV in MorphMarket's Bulk Import 2.0 format from
// a gecko + user-edited caption. MorphMarket has no write API
// (researched May 2026) so this is the most-automated path: generate
// the CSV here, hand the user the file + a deep-link to their import
// page. Re-uploading the same Animal ID updates the same listing
// instead of creating a duplicate.
export function buildMorphMarketCsvRow({ gecko, captionBody, hashtags }) {
  const animalId = `geckinspect:${gecko.id}`;
  const title = (gecko.name || gecko.morph_description || gecko.morph || 'Crested Gecko').slice(0, 60);
  const tagBlock = (hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const description = [captionBody?.trim(), tagBlock].filter(Boolean).join('\n\n');
  const sex = gecko.sex || '';
  const birthDate = gecko.hatch_date || '';
  const traits = gecko.morph_description || gecko.morph || '';
  const status = (() => {
    const s = (gecko.status || '').toLowerCase();
    if (s === 'for sale' || s === 'available') return 'For Sale';
    if (s === 'holdback') return 'Hold';
    if (s === 'sold') return 'Sold';
    return '';
  })();
  const photoUrls = Array.isArray(gecko.image_urls) ? gecko.image_urls.slice(0, 10).join(' ') : '';
  const headers = ['Animal ID', 'Title', 'Description', 'Sex', 'Birth Date', 'Traits', 'Status', 'Photo URLs'];
  const row = [animalId, title, description, sex, birthDate, traits, status, photoUrls];
  // CSV escape: wrap any field that contains a comma, quote, or newline
  // in double quotes and double-escape embedded quotes.
  const escape = (s) => {
    const str = String(s ?? '');
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  return `${headers.join(',')}\n${row.map(escape).join(',')}\n`;
}

// Pretty cents -> dollar string ($1.50, $0.50, etc).
export function formatCents(cents) {
  if (cents == null) return '$0.00';
  const v = Number(cents) / 100;
  return `$${v.toFixed(2)}`;
}
