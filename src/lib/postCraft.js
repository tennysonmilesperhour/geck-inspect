/**
 * Post craft helpers for the Promote composer.
 *
 * Two jobs, both pure so vitest can cover them:
 *
 * 1. buildGeckoFacts turns a gecko row plus its logs (weights, events,
 *    sheds) into short, true statements the writer can use. The model
 *    only gets facts from here, the keeper's own words and the photo,
 *    so it has real material and no reason to invent any.
 *
 * 2. findAiTells scans a caption for the phrases and habits that make a
 *    post read as machine written. The composer shows them next to the
 *    editor so the keeper can fix them in their own words.
 */

const DAY = 24 * 60 * 60 * 1000;

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// "3 weeks", "5 months", "1 year and 2 months". Rounds down so we never
// claim an animal is older than it is.
export function describeAge(hatch, now = new Date()) {
  const h = toDate(hatch);
  if (!h || h > now) return null;
  const days = Math.floor((now - h) / DAY);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 60) {
    const w = Math.floor(days / 7);
    return `${w} week${w === 1 ? '' : 's'}`;
  }
  let months = (now.getUTCFullYear() - h.getUTCFullYear()) * 12 + (now.getUTCMonth() - h.getUTCMonth());
  if (now.getUTCDate() < h.getUTCDate()) months -= 1;
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} year${years === 1 ? '' : 's'}`;
  return rest ? `${y} and ${rest} month${rest === 1 ? '' : 's'}` : y;
}

const EVENT_LABELS = {
  shed: 'Shed',
  feeding: 'Fed',
  bug_feeding: 'Took insects',
  cage_cleaning: null, // not post material
  weight: null, // weights come from weight_records
  pairing: 'Paired',
  egg_laid: 'Laid eggs',
  eggs_laid: 'Laid eggs',
  hatched: 'Hatched',
  vet_visit: 'Vet visit',
};

const SHED_QUALITY = {
  complete: 'clean, complete shed',
  partial: 'partial shed',
  retained_toes: 'shed with some stuck on the toes',
  retained_eye_caps: 'shed with retained eye caps',
};

/**
 * @param {object} args
 * @param {object} args.gecko   row from public.geckos
 * @param {Array}  [args.weights] weight_records rows (any order)
 * @param {Array}  [args.events]  gecko_events rows (any order)
 * @param {Array}  [args.sheds]   shed_records rows (any order)
 * @param {object} [args.sire]    parent gecko row, when known
 * @param {object} [args.dam]     parent gecko row, when known
 * @param {Date}   [args.now]
 * @returns {{ profile: string[], recent: string[] }}
 *   profile: stable facts (morph, sex, age, parents, price).
 *   recent: dated things that happened in the last ~90 days, newest first.
 */
export function buildGeckoFacts({ gecko, weights = [], events = [], sheds = [], sire = null, dam = null, now = new Date() }) {
  const profile = [];
  const recent = [];
  if (!gecko) return { profile, recent };

  if (gecko.morphs_traits) profile.push(`Morph and traits: ${gecko.morphs_traits}`);
  if (gecko.sex && !/unknown|unsexed/i.test(gecko.sex)) profile.push(`Sex: ${gecko.sex}`);
  else if (gecko.sex) profile.push('Sex: not known yet');

  const age = describeAge(gecko.hatch_date, now);
  if (age) profile.push(`Age: ${age} (hatched ${toDate(gecko.hatch_date).toISOString().slice(0, 10)})`);
  else if (gecko.estimated_hatch_year) profile.push(`Hatched around ${gecko.estimated_hatch_year}`);

  const parent = (label, row, name) => {
    const n = row?.name || name;
    if (!n && !row?.morphs_traits) return;
    profile.push(`${label}: ${n || 'unnamed'}${row?.morphs_traits ? ` (${row.morphs_traits})` : ''}`);
  };
  parent('Sire', sire, gecko.sire_name);
  parent('Dam', dam, gecko.dam_name);

  if (gecko.breeder_name) profile.push(`Bred by: ${gecko.breeder_name}`);
  if (gecko.pattern_grade) profile.push(`Pattern grade: ${gecko.pattern_grade}`);
  if (gecko.genetics_notes) profile.push(`Genetics notes: ${String(gecko.genetics_notes).slice(0, 300)}`);
  if (gecko.status) profile.push(`Status: ${gecko.status}`);
  const price = gecko.asking_price ?? gecko.listing_price;
  if (price != null && Number(price) > 0 && /sale|available/i.test(gecko.status || '')) {
    profile.push(`Asking price: $${Number(price).toLocaleString('en-US')}`);
  }
  // Tail loss is permanent in crested geckos and buyers expect it said
  // up front, so it always goes in when recorded.
  if (gecko.tail_status && !/intact|full|^yes$/i.test(gecko.tail_status)) {
    profile.push(`Tail: ${gecko.tail_status}`);
  }
  if (gecko.is_gravid) {
    const since = toDate(gecko.gravid_since);
    profile.push(`Currently gravid${since ? ` (since ${fmtDate(since)})` : ''}`);
  }

  // Weights: current weight, plus the change over the last ~60 days when
  // there is a reading to compare against.
  const w = (weights || [])
    .map((r) => ({ g: Number(r.weight_grams), d: toDate(r.record_date) }))
    .filter((r) => r.d && Number.isFinite(r.g) && r.g > 0)
    .sort((a, b) => b.d - a.d);
  if (w.length > 0) {
    const latest = w[0];
    profile.push(`Latest weight: ${latest.g}g on ${fmtDate(latest.d)}`);
    const older = w.find((r) => latest.d - r.d >= 21 * DAY && latest.d - r.d <= 120 * DAY);
    if (older) {
      const diff = Math.round((latest.g - older.g) * 10) / 10;
      if (diff !== 0) {
        recent.push({
          d: latest.d,
          text: `Weight went from ${older.g}g (${fmtDate(older.d)}) to ${latest.g}g (${fmtDate(latest.d)})`,
        });
      }
    }
    // A round-number milestone is something keepers do post about.
    const milestone = [10, 20, 30, 35, 40, 45, 50].find((m) => latest.g >= m && w.slice(1).every((r) => r.g < m));
    if (milestone && w.length > 1 && now - latest.d < 30 * DAY) {
      recent.push({ d: latest.d, text: `Just passed ${milestone}g for the first time` });
    }
  } else if (gecko.weight_grams) {
    profile.push(`Weight: ${gecko.weight_grams}g`);
  }

  const cutoff = now - 90 * DAY;
  for (const s of sheds || []) {
    const d = toDate(s.date);
    if (!d || d < cutoff) continue;
    const q = SHED_QUALITY[s.quality] || 'shed';
    recent.push({ d, text: `${fmtDate(d)}: ${q}${s.notes ? ` (${String(s.notes).slice(0, 120)})` : ''}` });
  }
  for (const e of events || []) {
    const d = toDate(e.event_date);
    if (!d || d < cutoff) continue;
    const label = e.event_type === 'custom' ? e.custom_event_name : EVENT_LABELS[e.event_type];
    if (!label) continue;
    // Routine feedings are noise unless the keeper wrote something.
    if ((e.event_type === 'feeding' || e.event_type === 'bug_feeding') && !e.notes) continue;
    recent.push({ d, text: `${fmtDate(d)}: ${label}${e.notes ? `, "${String(e.notes).slice(0, 160)}"` : ''}` });
  }
  if (gecko.egg_drop_date) {
    const d = toDate(gecko.egg_drop_date);
    if (d && d >= cutoff) recent.push({ d, text: `${fmtDate(d)}: dropped eggs` });
  }

  recent.sort((a, b) => b.d - a.d);
  // Dedupe identical lines (two logs of the same shed, say).
  const seen = new Set();
  const recentText = [];
  for (const r of recent) {
    if (seen.has(r.text)) continue;
    seen.add(r.text);
    recentText.push(r.text);
    if (recentText.length >= 8) break;
  }
  return { profile, recent: recentText };
}

// Phrases that crested gecko keepers (and everyone else on social media
// in 2026) read as machine written. Each entry carries a plain reason
// so the composer can say why, not just flag it.
const TELLS = [
  { re: /\u2014/g, label: 'em dash', why: 'The long dash is the most common sign of AI text. Use a comma or a period.' },
  { re: /\u2013/g, label: 'en dash', why: 'Reads like a swapped-in em dash. Use a comma, a period or "to".' },
  { re: /\b(meet|say hello to|introducing|allow me to introduce)\b[^.!?\n]{0,40}[!:]/gi, label: 'announcer opening', why: 'Keepers rarely open like a product launch. Start with the thing that happened.' },
  { re: /\b(absolute|total|true|real) (stunner|showstopper|gem|unit|beauty)\b/gi, label: 'stock praise', why: 'Says nothing about this gecko. Name the trait you are looking at instead.' },
  { re: /\b(stunning|gorgeous|breathtaking|jaw-?dropping|eye candy|show-?stopper|stunner)\b/gi, label: 'empty adjective', why: 'Every gecko post says this. What exactly looks good: the dorsal, the pinstripe, the color?' },
  { re: /\bsteals? the show\b|\bturning heads\b|\bspeaks for itself\b|\bneeds no introduction\b/gi, label: 'cliche', why: 'Stock phrase. Cut it and let the photo do that work.' },
  { re: /\b(delve|tapestry|testament to|embark|journey of|in the world of|realm of|elevate|unleash|unlock|showcase|boasts?|nestled)\b/gi, label: 'AI vocabulary', why: 'Words people almost never use in a casual post.' },
  { re: /\bnot (just|only) (a|an|another)?\s?\w+[^.!?\n]{0,40}[,;] (it'?s|she'?s|he'?s|this is|but)\b/gi, label: '"not just X, it\'s Y"', why: 'A very common AI sentence shape. Just say the Y part.' },
  { re: /\b(who else|anyone else) (loves?|is obsessed|agrees)\b/gi, label: 'engagement bait', why: 'Asks for a reply without giving a reason to reply. Ask something you actually want to know.' },
  { re: /\b(drop a|smash|hit) (the )?(like|follow|\S+ (emoji|below))\b|\bdrop (a|an) \S+ if\b/gi, label: 'engagement bait', why: 'Reads as a growth tactic. People reply to real questions.' },
  { re: /\blet (us|me) know in the comments\b|\bcomment below\b|\bstay tuned\b/gi, label: 'stock call to action', why: 'Generic sign-off. End on something specific to this gecko, or just stop.' },
  { re: /\b(won'?t last long|act fast|don'?t miss out|limited time|grab (her|him|them|this one) before)\b/gi, label: 'pushy sales line', why: 'Crestie buyers trust plain facts more than urgency. Give price, sex, weight and how to ask.' },
  { re: /\b(this little (one|guy|girl|lady|nugget)|little bundle of)\b/gi, label: 'filler nickname', why: 'Use the gecko\'s name, or what you actually call it.' },
  { re: /\b(obsessed|can'?t get over)\b/gi, label: 'hype word', why: 'Fine once in a while. Check it sounds like you.' },
  { re: /(\p{Extended_Pictographic}️?\s*){4,}/gu, label: 'emoji string', why: 'A run of emoji reads as filler. One, or none, lands better.' },
  { re: /\[[^\]\n]{2,40}\]/g, label: 'placeholder', why: 'Fill this in or delete it before posting.' },
];

/**
 * @param {string} text
 * @returns {{ label: string, why: string, match: string }[]}  one entry per
 *   distinct label, with the first matching text.
 */
export function findAiTells(text) {
  if (!text) return [];
  const out = [];
  const seen = new Set();
  for (const t of TELLS) {
    t.re.lastIndex = 0;
    const m = t.re.exec(text);
    if (!m || seen.has(t.label)) continue;
    seen.add(t.label);
    out.push({ label: t.label, why: t.why, match: m[0].trim() });
  }
  // Exclamation overload: more than a third of sentences shouting.
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 3);
  const bangs = sentences.filter((s) => /!\s*$/.test(s.trim())).length;
  if (sentences.length >= 3 && bangs / sentences.length > 0.34) {
    out.push({ label: 'too many exclamation points', why: 'Most sentences end in "!". Calm a few down and the excited ones hit harder.', match: '!' });
  }
  return out;
}

// One-tap revisions the composer offers after a draft exists. The key is
// sent to the server, which holds the actual instruction.
export const TWEAKS = [
  { key: 'shorter', label: 'Shorter' },
  { key: 'plainer', label: 'Plainer' },
  { key: 'warmer', label: 'Warmer' },
  { key: 'funnier', label: 'Lighter' },
  { key: 'more_detail', label: 'More gecko detail' },
  { key: 'less_salesy', label: 'Less salesy' },
  { key: 'add_question', label: 'End with a real question' },
  { key: 'more_me', label: 'More like me' },
];

// Per-template prompt for the "what's going on" box, so the keeper
// knows what kind of detail makes the post worth reading.
export const MOMENT_PROMPTS = {
  meet: 'Where did this gecko come from, and what did you notice first?',
  available: 'What would you tell a buyer in person? Price, why you are letting this one go, anything they should know.',
  pairing: 'Who is the pairing with, and what are you hoping to see from it?',
  eggs: 'How many eggs, when, and how are they looking?',
  hatchling: 'What is this baby like so far? Anything that surprised you?',
  milestone: 'What happened? A weight, a first shed, finally eating from the dish?',
  throwback: 'What did this gecko look like when you got it, and what changed?',
  lineage: 'What is special about this line to you?',
  educational: 'What do people usually get wrong about this morph or trait?',
};
