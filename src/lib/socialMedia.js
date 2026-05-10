/**
 * Social Media Manager — shared client-side constants and helpers.
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
  { key: 'reddit',           label: 'Reddit',           mode: 'clipboard',  hint: 'Copies; we will deep-link to the submit page.' },
  { key: 'threads',          label: 'Threads',          mode: 'clipboard',  hint: 'Copy to clipboard. Direct posting in v2.' },
  { key: 'facebook_page',    label: 'Facebook Page',    mode: 'clipboard',  hint: 'Copy to clipboard. Direct posting in v2.' },
  { key: 'instagram',        label: 'Instagram',        mode: 'clipboard',  hint: 'Copy to clipboard. Direct posting after Meta app review.' },
  { key: 'x',                label: 'X (Twitter)',      mode: 'clipboard',  hint: 'Copy to clipboard, deep-link to compose.' },
  { key: 'tiktok',           label: 'TikTok',           mode: 'clipboard',  hint: 'Returns a video script you can use as a shot list.' },
  { key: 'youtube_community',label: 'YouTube Community',mode: 'clipboard',  hint: 'Copy to clipboard.' },
];

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

// Pretty cents -> dollar string ($1.50, $0.50, etc).
export function formatCents(cents) {
  if (cents == null) return '$0.00';
  const v = Number(cents) / 100;
  return `$${v.toFixed(2)}`;
}
