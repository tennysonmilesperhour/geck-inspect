/**
 * Social Media Manager, shared client-side constants and helpers.
 *
 * Voice presets, post templates, and platform metadata are mirrored on the
 * server (generate-social-post edge function) so prompt construction stays
 * consistent between what the user sees and what the model receives.
 */

export const VOICE_PRESETS = [
  { key: 'casual', label: 'Casual', blurb: 'Like texting a friend who also keeps cresties.' },
  { key: 'storyteller', label: 'Storyteller', blurb: 'Tells the small true moment, in order, with one real detail.' },
  { key: 'hobbyist_hype', label: 'Excited', blurb: 'Can\'t wait to show you. Energy from specifics, not adjectives.' },
  { key: 'educator', label: 'Teacher', blurb: 'Explains one thing this gecko shows, like you would at an expo table.' },
  { key: 'pro_breeder', label: 'Breeder', blurb: 'Plain and precise. The facts a serious buyer wants.' },
];

export const POST_TEMPLATES = [
  { key: 'meet',        label: 'Meet / introduce',     blurb: 'New gecko, holdback reveal, fresh face on the rack.' },
  { key: 'available',   label: 'Available for sale',   blurb: 'Sales post. Plain facts a buyer needs, tail loss disclosed.' },
  { key: 'pairing',     label: 'Pairing announcement', blurb: 'Paired this gecko with another. Lineage-aware.' },
  { key: 'eggs',        label: 'Eggs laid / due',      blurb: 'Update on a clutch in incubation.' },
  { key: 'hatchling',   label: 'Hatchling debut',      blurb: 'New hatchling, often grouped with siblings.' },
  { key: 'milestone',   label: 'Milestone',            blurb: 'Weight, age, first shed, first ovulation.' },
  { key: 'throwback',   label: 'Throwback / glow-up',  blurb: 'Then and now, with real dates and weights.' },
  { key: 'lineage',     label: 'Lineage spotlight',    blurb: 'Daughter of X, paired with Y. Story-led.' },
  { key: 'educational', label: 'Educational',          blurb: "Explains this gecko's morph or trait combo to the audience." },
];

// Decision D8: Bluesky posts directly; every other platform is copy-out
// (the text goes on the clipboard and the platform's compose page opens).
// Facebook and Instagram direct posting waits on Meta's App Review, so
// they are copy-out too. A copy never uses a post credit.
export const PLATFORMS = [
  { key: 'bluesky',          label: 'Bluesky',          mode: 'direct',     hint: 'Posts directly with your Bluesky app password.' },
  { key: 'facebook_page',    label: 'Facebook',         mode: 'clipboard',  hint: 'Copies your post and opens Facebook so you can paste it.' },
  { key: 'instagram',        label: 'Instagram',        mode: 'clipboard',  hint: 'Copies your caption and opens Instagram so you can paste it.' },
  { key: 'reddit',           label: 'Reddit',           mode: 'clipboard',  hint: 'Copies your post and opens r/CrestedGecko so you can paste it.' },
  { key: 'threads',          label: 'Threads',          mode: 'clipboard',  hint: 'Copies your post and opens Threads.' },
  { key: 'x',                label: 'X (Twitter)',      mode: 'clipboard',  hint: 'Copies your post and opens X.' },
  { key: 'tiktok',           label: 'TikTok',           mode: 'clipboard',  hint: 'Copies a caption you can use with your video.' },
  { key: 'youtube_community',label: 'YouTube Community',mode: 'clipboard',  hint: 'Copies your post and opens YouTube Studio.' },
];

export function isDirectPlatform(key) {
  return PLATFORMS.find((p) => p.key === key)?.mode === 'direct';
}

// Member-facing wording for the error codes publish-social-post returns,
// so the composer never shows a raw code or setup instructions.
const PUBLISH_ERROR_MESSAGES = {
  platform_not_connected: 'Connect your Bluesky account in Connections first, or use Copy to post it yourself.',
  bluesky_auth_failed: 'Bluesky did not accept your handle and app password. Reconnect Bluesky in Connections with a new app password.',
  bluesky_post_failed: 'Bluesky did not accept the post. Try again in a minute, or copy the text and post it yourself.',
  token_decrypt_failed: 'We could not read your saved Bluesky login. Reconnect Bluesky in Connections.',
  variant_already_published: 'This post already went out.',
  forbidden: 'You can only publish your own posts.',
  publish_failed: 'The post did not go out. Try again, or copy the text and post it yourself.',
};

// Member-facing wording for generate-social-post error codes.
const GENERATION_ERROR_MESSAGES = {
  iteration_cap_reached: 'You have used all 10 tries on this post. Copy or publish it, or close this and start a new post.',
  post_not_found: 'This draft was not saved. Close the composer and try again.',
  forbidden: 'This draft belongs to a different account.',
  declined: 'The writer could not draft this one. Try rewording what is going on.',
  no_variants_returned: 'The drafts came back empty. Try again.',
  anthropic_failed: 'The writer is busy right now. Try again in a minute.',
  anthropic_unreachable: 'The writer is busy right now. Try again in a minute.',
  anthropic_key_missing: 'Drafting is not available right now. Please try again later.',
};

export function generationErrorMessage(code) {
  return GENERATION_ERROR_MESSAGES[code] || 'Something went wrong writing the drafts. Try again.';
}

export function publishErrorMessage(code, detail) {
  const fromDetail = typeof detail === 'string' ? detail.split(':')[0].trim() : '';
  if (fromDetail && PUBLISH_ERROR_MESSAGES[fromDetail]) return PUBLISH_ERROR_MESSAGES[fromDetail];
  if (code && PUBLISH_ERROR_MESSAGES[code]) return PUBLISH_ERROR_MESSAGES[code];
  return 'Something went wrong. Try again, or copy the text and post it yourself.';
}

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
  const title = (gecko.name || gecko.morphs_traits || 'Crested Gecko').slice(0, 60);
  const tagBlock = (hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  const description = [captionBody?.trim(), tagBlock].filter(Boolean).join('\n\n');
  const sex = gecko.sex || '';
  const birthDate = gecko.hatch_date || '';
  const traits = gecko.morphs_traits || '';
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

// Members paste handles as "@name.bsky.social", "name.bsky.social" or a
// full profile link. Bluesky's login wants the bare handle. Mirrors
// normalizeBlueskyHandle in supabase/functions/_shared/promote.ts.
export function normalizeBlueskyHandle(raw) {
  let h = String(raw || '').trim();
  h = h.replace(/^https?:\/\/(www\.)?bsky\.app\/profile\//i, '');
  h = h.replace(/\/.*$/, '');
  h = h.replace(/^@/, '');
  return h.toLowerCase();
}

// Member-facing wording for set-platform-connection error codes. Setup
// problems (a missing server key) read as "try later", never as
// instructions meant for the admin.
const CONNECTION_ERROR_MESSAGES = {
  bluesky_auth_failed: 'Bluesky did not accept that handle and app password. Check the handle, make a new app password, and try again.',
  bluesky_unreachable: 'We could not reach Bluesky just now. Please try again in a minute.',
  account_handle_required: 'Enter your Bluesky handle, for example yourname.bsky.social.',
  access_token_required: 'Enter a Bluesky app password.',
  unknown_platform: 'That platform cannot be connected.',
};

export function connectionErrorMessage(code) {
  return CONNECTION_ERROR_MESSAGES[code]
    || 'Connecting is not available right now. Please try again later, or use Copy to post it yourself.';
}
