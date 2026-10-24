/**
 * Weekly Gecko Notes: the email files, the rules every note must follow,
 * the set of in-app pages a note's button may open, and the append-only
 * list of published slugs (content/weekly-notes/published-slugs.json) that
 * keeps a renamed note from going to everyone a second time.
 *
 * Each note is one file, content/weekly-notes/NNN-slug.md (the format is
 * in docs/planning/weekly-notes-2026-10.md). Three things read them through
 * this module:
 *   - scripts/build-weekly-notes.mjs (pnpm build:weekly-notes), which turns
 *     them into supabase/functions/_shared/weekly-notes.generated.ts, the
 *     catalog send-email ships with, and refuses while any note breaks a rule
 *   - src/lib/__tests__/weeklyNotes.test.js, which fails when a note breaks
 *     a rule or the generated file is stale
 *   - scripts/check-genetics-consistency.mjs, which checks every note
 *     against the accepted facts
 *
 * The front matter parser is deliberately small and strict (no YAML
 * library): one "key: value" per line, known keys only, the value taken
 * literally. A file that does not parse cleanly is a problem, not a guess.
 *
 * Plain Node (no Vite aliases), so the build script can import it.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RETIRED_FEATURES, RETIRED_PAGE_NAMES, RETIRED_PAGES } from '../../src/lib/retiredPages.js';
import { CARE_CATEGORIES } from '../../src/data/care-guide.js';
import { MORPHS } from '../../src/data/morph-guide.js';
import { FEEDING_GUIDE } from '../../src/data/keepers-guides/feeding.js';
import { SETUP_GUIDE } from '../../src/data/keepers-guides/setup.js';
import { HANDBOOK_GUIDE } from '../../src/data/keepers-guides/handbook.js';
import { MORPH_GUIDE } from '../../src/data/keepers-guides/morph.js';
import { BREEDING_GUIDE } from '../../src/data/keepers-guides/breeding.js';
import { CALCULATOR_PAGES, PAIRING_PAGES } from '../../src/lib/genetics/calculatorCatalog.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');
export const NOTES_DIR = resolve(REPO_ROOT, 'content/weekly-notes');
export const GENERATED_FILE = resolve(REPO_ROOT, 'supabase/functions/_shared/weekly-notes.generated.ts');
// Every slug ever built into the catalog. See publishedProblems below.
export const PUBLISHED_FILE_NAME = 'published-slugs.json';
export const PUBLISHED_FILE = resolve(NOTES_DIR, PUBLISHED_FILE_NAME);

export const FILE_NAME_RE = /^(\d{3})-([a-z0-9-]+)\.md$/;
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX = 64;

// The front matter keys, in the order the docs list them.
export const KEYS = ['step', 'slug', 'subject', 'preview', 'lead', 'audience', 'months', 'cta', 'path', 'cta_no_gecko', 'path_no_gecko', 'visitor_cta', 'visitor_path', 'visitors', 'sources'];

// Which members a note is for (front matter "audience"; leave it out for
// everyone). send-email reads the member's record (weekly_note_facts) to
// decide. Visitors have no record, so the audience does not apply to them:
// they signed up for the tips and get every note marked for visitors.
export const AUDIENCES = ['everyone', 'keepers', 'female', 'adult-female', 'breeders'];

// The placeholders a lead may use, with the sample values the checks fill
// in. send-email fills them from the member's record; a lead alternative
// with any placeholder it cannot fill is skipped.
export const LEAD_PLACEHOLDERS = {
  gecko: 'Mango',
  gecko_s: "Mango's",
  gecko_weight: '12.4 g',
  gecko_weighed: 'Oct 2',
  female: 'Peach',
  female_s: "Peach's",
};
// Alternatives in a lead are separated by this, tried in order.
export const LEAD_SEPARATOR = ' || ';
const REQUIRED = ['step', 'slug', 'subject', 'preview', 'cta', 'path', 'sources'];

export const LIMITS = {
  subject: [1, 60],
  // The inbox line after the subject; most apps show 40 to 90 characters.
  preview: [20, 100],
  // One lead sentence or two, filled in.
  lead: [20, 200],
  cta: [1, 40],
  words: [80, 200],
};

const rel = (path) => path.slice(REPO_ROOT.length + 1);

// ---------- parsing ---------------------------------------------------------

/**
 * One note file, parsed. Never throws: anything that does not fit the
 * format goes into `errors`, which noteProblems reports.
 *
 * Returns { fileName, step, slug, subject, preview, cta, path, ctaNoGecko,
 * pathNoGecko, visitorCta, visitorPath, visitors, sources, body,
 * paragraphs, bodyStartLine, errors }. visitors is false only for a note
 * marked "visitors: no" (it goes to members only).
 * `paragraphs` is [{ line, text }] with the file line each paragraph starts
 * on; lines inside a paragraph are joined with a space, and `body` is the
 * paragraphs joined by a blank line ("\n\n").
 */
export function parseNote(fileName, text) {
  const errors = [];
  const note = {
    fileName,
    step: null,
    slug: null,
    subject: null,
    preview: null,
    lead: [],
    audience: 'everyone',
    months: null,
    cta: null,
    path: null,
    ctaNoGecko: null,
    pathNoGecko: null,
    visitorCta: null,
    visitorPath: null,
    visitors: true,
    sources: [],
    body: '',
    paragraphs: [],
    bodyStartLine: null,
    errors,
  };
  const source = String(text ?? '');
  if (source.includes('\r')) errors.push('uses CRLF or CR line endings; save the file with LF');
  if (source.includes('\uFFFD')) errors.push('is not valid UTF-8');
  if (source.charCodeAt(0) === 0xfeff) errors.push('starts with a byte order mark');
  const lines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');

  if (lines[0] !== '---') {
    errors.push('must start with a line that is exactly ---');
    return note;
  }
  const close = lines.indexOf('---', 1);
  if (close === -1) {
    errors.push('front matter has no closing --- line');
    return note;
  }

  const seen = new Set();
  const front = {};
  for (let i = 1; i < close; i += 1) {
    const line = lines[i];
    const at = line.indexOf(': ');
    if (at <= 0) {
      errors.push(`line ${i + 1}: front matter lines are "key: value" ("${line}")`);
      continue;
    }
    const key = line.slice(0, at);
    const value = line.slice(at + 2);
    if (!KEYS.includes(key)) {
      errors.push(`line ${i + 1}: unknown key "${key}" (allowed: ${KEYS.join(', ')})`);
      continue;
    }
    if (seen.has(key)) {
      errors.push(`line ${i + 1}: "${key}" appears twice`);
      continue;
    }
    seen.add(key);
    if (value !== value.trim() || value === '') {
      errors.push(`line ${i + 1}: "${key}" has an empty value or extra spaces`);
    }
    front[key] = value;
  }
  for (const key of REQUIRED) {
    if (!(key in front)) errors.push(`front matter is missing "${key}"`);
  }
  if (('cta_no_gecko' in front) !== ('path_no_gecko' in front)) {
    errors.push('cta_no_gecko and path_no_gecko go together: give both or neither');
  }
  if (('visitor_cta' in front) !== ('visitor_path' in front)) {
    errors.push('visitor_cta and visitor_path go together: give both or neither');
  }
  if ('visitors' in front && front.visitors !== 'no') {
    errors.push(`visitors "${front.visitors}" can only be no (leave it out to send the note to visitors too)`);
  }
  if (front.visitors === 'no' && 'visitor_path' in front) {
    errors.push('a note with visitors: no has no visitor button; drop visitor_cta and visitor_path');
  }
  if ('audience' in front && !AUDIENCES.includes(front.audience)) {
    errors.push(`audience "${front.audience}" must be one of ${AUDIENCES.join(', ')}`);
  }
  if ('months' in front) {
    const mm = /^([1-9]|1[0-2])(?:-([1-9]|1[0-2]))?$/.exec(front.months);
    if (!mm) errors.push(`months "${front.months}" must be one month (5) or a run of months (5-9, or 11-2 across the new year)`);
    else {
      const from = Number(mm[1]);
      const to = mm[2] ? Number(mm[2]) : from;
      const list = [];
      for (let m = from; ; m = (m % 12) + 1) {
        list.push(m);
        if (m === to) break;
      }
      note.months = list;
    }
  }

  if ('step' in front) {
    if (/^[1-9]\d*$/.test(front.step)) note.step = Number(front.step);
    else errors.push(`step "${front.step}" is not a whole number from 1`);
  }
  note.slug = front.slug ?? null;
  note.subject = front.subject ?? null;
  note.preview = front.preview ?? null;
  note.lead = front.lead ? front.lead.split(LEAD_SEPARATOR).map((t) => t.trim()) : [];
  note.audience = front.audience ?? 'everyone';
  note.cta = front.cta ?? null;
  note.path = front.path ?? null;
  note.ctaNoGecko = front.cta_no_gecko ?? null;
  note.pathNoGecko = front.path_no_gecko ?? null;
  note.visitorCta = front.visitor_cta ?? null;
  note.visitorPath = front.visitor_path ?? null;
  note.visitors = front.visitors !== 'no';
  note.sources = front.sources ? front.sources.split('; ').map((s) => s.trim()).filter(Boolean) : [];

  // The body: paragraphs separated by blank lines.
  let current = null;
  for (let i = close + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) {
      current = null;
      continue;
    }
    if (lines[i] !== lines[i].trimEnd()) errors.push(`line ${i + 1}: trailing spaces`);
    if (!current) {
      current = { line: i + 1, parts: [] };
      note.paragraphs.push(current);
    }
    current.parts.push(line);
  }
  note.paragraphs = note.paragraphs.map((p) => ({ line: p.line, text: p.parts.join(' ') }));
  note.bodyStartLine = note.paragraphs[0]?.line ?? null;
  note.body = note.paragraphs.map((p) => p.text).join('\n\n');
  if (!note.body) errors.push('has no body');
  return note;
}

/** Every note in the folder, sorted by step (then file name). */
export function readWeeklyNotes(dir = NOTES_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => parseNote(name, readFileSync(resolve(dir, name), 'utf8')))
    .sort((a, b) => (a.step ?? Infinity) - (b.step ?? Infinity) || a.fileName.localeCompare(b.fileName));
}

/** Words in a body, split on whitespace. */
export const wordCount = (text) => String(text || '').split(/\s+/).filter(Boolean).length;

// ---------- live routes -----------------------------------------------------

// Paths that are rejected outright, with the reason the problem names.
// Checked before the live set, so the reason is the useful one.
const REJECTED = [
  [/^\/blog(\/|$)/i, 'the blog is shelved; never link it'],
  [/^\/log(\/|$)/i, '/log shows "Nothing to log here" without gecko ids'],
  [/^\/pedigree(\/|$)/i, '/Pedigree needs a gecko id'],
  [/^\/geckodetail(\/|$)/i, '/GeckoDetail needs a gecko id'],
  [/^\/store(\/|$)/i, 'the supplies store is retired'],
];

// App labels a note may quote word for word. Each one must exist in the
// app (the test checks), and the writing rules read past them, so quoting
// the Morph ID button "Add to my collection" is not first person.
export const APP_LABELS = ['Add to my collection', 'My Geckos'];

function readPagesKeys() {
  const source = readFileSync(resolve(REPO_ROOT, 'src/pages.config.js'), 'utf8');
  const block = source.match(/export const PAGES = \{([\s\S]*?)\n\}/)?.[1] ?? '';
  return [...block.matchAll(/^\s*"([A-Za-z0-9]+)"\s*:/gm)].map((m) => m[1]);
}

/** The id="..." anchors on the Settings page. */
export function settingsAnchors() {
  const source = readFileSync(resolve(REPO_ROOT, 'src/pages/Settings.jsx'), 'utf8');
  return new Set([...source.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]));
}

let liveCache = null;

// Live pages a note's button must not open, with the reason: admin-only
// screens, the sign-in page (a member reading a note already has an
// account), pages that show nothing without an id in the address, and the
// export page named after a marketplace. Each name must still be a page in
// pages.config.js (the test checks), so this list cannot quietly go stale.
export const NOT_FOR_NOTES = {
  AdminPanel: 'is for admins only',
  ImageImport: 'is for admins only',
  Training: 'is an internal admin page (the Evidence Lab)',
  AuthPortal: 'is the sign-in page; a member reading a note already has an account',
  ForumPost: 'needs a post id',
  PublicProfile: 'needs a profile id',
  MorphMarketExport: 'is named after a marketplace',
};

/**
 * Every in-app path a note's button may open. Built from the app's own
 * route data, so a page that is renamed or retired drops out by itself.
 */
export function liveRoutes() {
  if (liveCache) return liveCache;
  const set = new Set(['/']);
  for (const key of readPagesKeys()) {
    if (!RETIRED_PAGE_NAMES.has(key) && !(key in NOT_FOR_NOTES)) set.add(`/${key}`);
  }
  for (const category of CARE_CATEGORIES) {
    for (const section of category.sections || []) set.add(`/CareGuide/${section.id}`);
  }
  set.add('/CareGuide/series');
  for (const guide of [FEEDING_GUIDE, SETUP_GUIDE, HANDBOOK_GUIDE, MORPH_GUIDE, BREEDING_GUIDE]) {
    set.add(`/CareGuide/series/${guide.id}`);
  }
  for (const morph of MORPHS) set.add(`/MorphGuide/${morph.slug}`);
  for (const path of ['/calculator', '/calculator/reverse', '/calculator/learn', '/crested-gecko-price', '/pedigree-tracker', '/breeding-records']) set.add(path);
  for (const page of PAIRING_PAGES) set.add(`/calculator/pairing/${page.slug}`);
  for (const page of CALCULATOR_PAGES) set.add(`/calculator/${page.slug}`);
  liveCache = set;
  return set;
}

/** Why a button path is not allowed, or null when it is fine. */
export function pathProblem(path, live = liveRoutes()) {
  const p = String(path ?? '');
  if (!p) return 'is empty';
  if (/^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith('//')) return 'is an absolute URL; use an in-app path';
  if (!p.startsWith('/')) return 'must start with a single /';
  if (p.includes('?')) return 'has a query string; link a page without one';
  const [base, anchor, extra] = p.split('#');
  if (extra !== undefined) return 'has more than one #';
  for (const [re, why] of REJECTED) {
    if (re.test(base)) return why;
  }
  const first = base.split('/')[1] || '';
  for (const name of RETIRED_PAGE_NAMES) {
    if (first.toLowerCase() === name.toLowerCase()) return `${name} is a retired page`;
  }
  for (const [name, why] of Object.entries(NOT_FOR_NOTES)) {
    if (first.toLowerCase() === name.toLowerCase()) return `/${name} ${why}`;
  }
  if (anchor !== undefined) {
    if (base !== '/Settings') return 'a #anchor is allowed only on /Settings';
    if (!settingsAnchors().has(anchor)) return `/Settings has no id="${anchor}"`;
    return null;
  }
  if (!live.has(base)) return 'is not a live page';
  return null;
}

/**
 * Why a visitor's button path is not allowed, or null when it is fine.
 * Visitors (Weekly Gecko Notes without an account, section 9 of the plan)
 * have no account, so the button must open a page that works signed out:
 * the guides, the Morph Guide, the calculator pages, Morph ID and the
 * public pages that explain the record book.
 */
export const VISITOR_PAGES = ['/', '/GeneticsGuide', '/Recognition', '/pedigree-tracker', '/breeding-records', '/crested-gecko-price', '/Membership', '/MorphGuide', '/CareGuide', '/calculator'];
const VISITOR_PREFIXES = ['/CareGuide/', '/MorphGuide/', '/calculator/'];

export function visitorPathProblem(path, live = liveRoutes()) {
  const why = pathProblem(path, live);
  if (why) return why;
  const p = String(path);
  if (VISITOR_PAGES.includes(p) || VISITOR_PREFIXES.some((prefix) => p.startsWith(prefix))) return null;
  return 'needs an account; a visitor\'s button must open a page that works signed out';
}

// ---------- the writing rules --------------------------------------------

const PERCENT_ALLOWED = new Set([5, 10, 25, 50, 66, 70, 80, 100]);

// Retired pages and features by the names a member would know them by:
// each retired page's name split into words ("Community Connect",
// "Breeding Pairs", "Shipping"), plus the older names the docs and the app
// used. Built from src/lib/retiredPages.js, so a page retired later is
// covered by itself. Multi-word names match in any case; a one-word page
// name ("Shipping", "Store") matches only capitalised, so the plain word
// in a sentence ("before shipping a gecko") is still allowed.
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const splitCamel = (name) => name.replace(/([a-z])([A-Z])/g, '$1 $2');
export const RETIRED_NAMES = [
  ...new Set([
    ...RETIRED_PAGES.map((r) => splitCamel(r.page)),
    ...Object.keys(RETIRED_FEATURES).map((key) => splitCamel(key).toLowerCase()),
    'Training Center', 'AI Training Center', 'AI Consultant', 'Breeder Consultant', 'supplies store',
    'sticker designer', 'sticker builder', 'website editor', 'website builder',
  ]),
];
const RETIRED_NAME_RES = RETIRED_NAMES.map((name) => (name.includes(' ')
  ? new RegExp(`\\b${escapeRe(name).replace(/ /g, '\\s+')}\\b`, 'i')
  : new RegExp(`\\b${escapeRe(name)}\\b`)));

// Characters that look like a dash: figure dash, horizontal bar, two- and
// three-em dashes, minus sign, small and full-width dashes, and the vertical
// presentation forms. Written by code point so this file holds none of them.
const DASH_LOOKALIKES = new RegExp(`[${[0x2012, 0x2015, 0x2e3a, 0x2e3b, 0x2212, 0xfe31, 0xfe32, 0xfe58, 0xfe63, 0xff0d]
  .map((c) => `\\u${c.toString(16).padStart(4, '0')}`).join('')}]`);

// Words that are units, so "18 months, most breeders" is not a member count.
const UNIT = '(?:g|grams?|kg|months?|weeks?|days?|years?|hours?|minutes?|eggs?|clutch\\w*|percent|\u00B0F|\u00B0C)';

// [pattern, what is wrong]. Run on the subject, the button words and the
// body (never on sources, which are file paths). The rules catch the common
// forms of each mistake, not every possible wording, so a reviewer still
// reads every new note (docs/planning/weekly-notes-2026-10.md, section 6).
export const WRITING_RULES = [
  [/\u2014/, 'has an em dash'],
  [/\u2013/, 'has an en dash'],
  [DASH_LOOKALIKES, 'has a character that looks like a dash (figure dash, horizontal bar, minus sign and similar)'],
  [/--/, 'has "--"'],
  [/ [-\u2010\u2011] /, 'has " - " used as a dash'],
  [/\d\s?[-\u2010\u2011]\s?\d/, 'has a number range with a hyphen; write "1 to 2"'],
  [/[#*_`[\]<>]/, 'has a markdown or HTML character (# * _ ` [ ] < >)'],
  [/https?:\/\/|\bwww\.|geckinspect\.com/i, 'has a web address; the button carries the link'],
  [/(^|[\s("'])\/[A-Za-z]/, 'has an in-app path; the button carries the link'],
  [/\bI\b|\bI['\u2019](m|ve|d|ll)\b/, 'speaks in the first person singular'],
  [/\b(my|me|mine|myself)\b/i, 'speaks in the first person singular'],
  [/\b(we|we're|we've|we'd|we'll|our|ours|ourselves|us)\b/i, 'speaks in the first person plural; say what the member can do, or name Geck Inspect'],
  [/\b(articles?|blogs?|blogging|newsletters?|this issue|last issue|next issue|issue #?\d+)\b/i, 'calls itself an article, blog post or newsletter issue'],
  [/\bpromote\b|\bconsultant\b|\bother reptiles\b|\bstores?\b|\bsupplies\b|\bstickers?\b|\bwebsite builder\b|\bvisuali[sz]er\b|\bguess the price\b|\bgiveaways?\b|\bmentorship\b|\bbreeding loans?\b|\bassistant chat\b|\bhealth screen\w*\b|\bgrowth reel\b|\bsensors?\b/i, 'names a retired feature'],
  ...RETIRED_NAMES.map((name, i) => [RETIRED_NAME_RES[i], `names a retired page or feature (${name})`]),
  [/[$\u20AC\u00A3\u00A5]|\b(USD|EUR|GBP)\b|\b(dollars?|bucks|cents?|euros?|quid)\b/i, 'mentions a price'],
  [/\b(costs?|costing|sells? for|sold for|selling for|worth|priced at|goes for|go for|fetch(es)?)\b[^.!?]{0,20}\d/i, 'mentions a price'],
  [/\bmorph ?market\b|\bpalm street\b|\bfauna classifieds\b|\bkingsnake\b|\breptidex\b|\bgeckistry\b|\bbreed ledger\b/i, 'names a marketplace or another app'],
  [/\b(studies|research|science|evidence|data)\s+(show|shows|showed|found|finds|suggest|suggests|suggested|proves?|proved)\b|\bsurveys?\b|\baccording to\b|\bpercent of\b|\b(researchers?|scientists?|scientific(ally)?)\b|\b(vets?|veterinarians?|experts?)\s+(say|says|agree|agrees|recommend|recommends)\b|\ban?\s+(\d{4}\s+)?(paper|study|trial|survey|report)\s+(found|finds|shows?|showed|says?|suggests?)\b|\ba\s+\d{4}\s+(paper|study|trial|survey)\b/i, 'sounds like a made-up statistic or study'],
  [/\b\d+(?:\.\d+)?\s*(?:%|percent)\s+of\b/i, 'gives "N% of" something, which reads as a statistic; the notes use percentages only for genetics odds and the 5% weight drop'],
  [new RegExp(`\\b\\d[\\d,]*\\+?\\s+(?!${UNIT}\\b)(?:[A-Za-z][\\w'-]*\\s+){0,3}?(members|accounts|keepers|breeders|users|people|owners|subscribers)\\b`, 'i'), 'counts members, keepers, breeders, people or users'],
  [/\b(hundreds|thousands|millions|dozens) of (members|keepers|breeders|people|users|owners)\b/i, 'counts members, keepers, breeders, people or users'],
  [/["\u201C\u201D][^"\u201C\u201D]{1,200}["\u201C\u201D]\s*,?\s*((he|she|they|one [\w-]+|a [\w-]+|another [\w-]+)\s+)?(said|says|say|told|tells|wrote|writes|explains?|explained|recalls?|recalled)\b|\b(said|says|told|tells|wrote|writes|put it|explained|recalls?|recalled)\s*[,:]?\s*["\u201C]|\bas (one|a|another|an) [\w-]+( [\w-]+)? (put it|puts it|says|said|told)\b/i, 'has an attributed quote; the notes never quote anyone'],
  [/\b(pangea|repashy|leachie|lugarti|black panther|zoo ?med)\b/i, 'names a CGD brand'],
  [/\b(spring|summer|autumn|winter)\b|\b(January|February|March|April|June|July|August|September|October|November|December)\b/, 'names a season or a month; write "when your room warms up" instead'],
  // May, the month, without catching "may" the verb.
  [/\b(in|of|by|until|till|since|from|through|early|late|mid|during|before|after|last|next|this|every) May\b|\bMay\s+(\d|and\b|or\b|to\b|through\b|until\b)/, 'names a season or a month; write "when your room warms up" instead'],
  [/\{\{|\}\}/, 'has a template placeholder'],
];

/** Writing-rule problems in one piece of member-facing text. */
export function writingProblems(text) {
  let t = String(text ?? '');
  for (const label of APP_LABELS) t = t.split(label).join('');
  const out = [];
  for (const [re, why] of WRITING_RULES) {
    if (re.test(t)) out.push(why);
  }
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(%|percent\b)/gi)) {
    if (!PERCENT_ALLOWED.has(Number(m[1]))) {
      out.push(`uses ${m[1]}%, which is not on the percentage allowlist (${[...PERCENT_ALLOWED].join(', ')})`);
    }
  }
  return out;
}

// Lines that must never be cited as a source, because they are wrong or
// conflict with the accepted facts (docs/planning/weekly-notes-2026-10.md,
// "Never use"). `contains` pins each range to its text, so the test fails
// with a clear message when the file moves and this list needs updating.
export const DO_NOT_CITE = [
  { file: 'src/data/keepers-guides/morph.js', from: 149, to: 151, contains: "title: 'Phantom'", why: 'calls Phantom polygenic' },
  { file: 'src/data/keepers-guides/morph.js', from: 187, to: 187, contains: '50% offspring from het × het are visual', why: 'says het x het Axanthic gives 50% visuals' },
  { file: 'src/data/keepers-guides/morph.js', from: 266, to: 271, contains: 'Coin flip (visual × het)', why: 'the "50% het, coin flip (visual x het)" badge is wrong' },
  { file: 'src/data/genetics-sections.jsx', from: 516, to: 517, contains: 'None are expected to hatch', why: 'use the accepted Super Lilly White fact instead' },
];

const SOURCE_RE = /^([A-Za-z0-9_./-]+\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?$/;

/** Problems with a note's source references. */
export function sourceProblems(note) {
  const out = [];
  if (!note.sources.length) out.push('has no sources');
  for (const ref of note.sources) {
    const m = SOURCE_RE.exec(ref);
    if (!m) {
      out.push(`source "${ref}" is not file:line or file:start-end`);
      continue;
    }
    const [, file, a, b] = m;
    const from = Number(a);
    const to = Number(b ?? a);
    const full = resolve(REPO_ROOT, file);
    if (!full.startsWith(`${REPO_ROOT}/`) || !existsSync(full)) {
      out.push(`source "${ref}": ${file} does not exist`);
      continue;
    }
    const lines = readFileSync(full, 'utf8').replace(/\n$/, '').split('\n').length;
    if (from < 1 || to < from || to > lines) {
      out.push(`source "${ref}": lines ${from} to ${to} are not inside ${file} (${lines} lines)`);
      continue;
    }
    for (const bad of DO_NOT_CITE) {
      if (bad.file === file && from <= bad.to && to >= bad.from) {
        out.push(`source "${ref}" cites ${bad.file}:${bad.from}${bad.to !== bad.from ? `-${bad.to}` : ''}, which is on the do-not-use list (${bad.why})`);
      }
    }
  }
  return out;
}

/**
 * Every rule one note must pass on its own: the format, the file name, the
 * lengths, the writing rules, the button paths and the sources. Returns a
 * list of readable problems (empty when the note is fine).
 */
export function noteProblems(note, { live = liveRoutes() } = {}) {
  const out = note.errors.map((e) => `file ${e}`);
  const m = FILE_NAME_RE.exec(note.fileName);
  if (!m) {
    out.push('file name must be NNN-slug.md (three digits, a hyphen, lowercase words joined by single hyphens)');
  } else {
    if (note.step !== null && Number(m[1]) !== note.step) out.push(`step ${note.step} does not match the file name's ${m[1]}`);
    if (note.slug !== null && m[2] !== note.slug) out.push(`slug "${note.slug}" does not match the file name's "${m[2]}"`);
  }
  if (note.slug !== null) {
    if (!SLUG_RE.test(note.slug)) out.push(`slug "${note.slug}" must be lowercase words joined by single hyphens`);
    if (note.slug.length > SLUG_MAX) out.push(`slug is longer than ${SLUG_MAX} characters`);
  }
  const length = (label, value, [lo, hi]) => {
    const n = [...String(value ?? '')].length;
    if (n < lo || n > hi) out.push(`${label} is ${n} characters; it must be ${lo} to ${hi}`);
  };
  length('subject', note.subject, LIMITS.subject);
  length('preview', note.preview, LIMITS.preview);
  for (const [i, alt] of note.lead.entries()) {
    const label = `lead ${i + 1}`;
    const unknown = [...alt.matchAll(/\{([^{}]*)\}/g)].map((x) => x[1]).filter((k) => !(k in LEAD_PLACEHOLDERS));
    if (unknown.length) out.push(`${label} has unknown placeholders ${unknown.map((k) => `{${k}}`).join(', ')} (allowed: ${Object.keys(LEAD_PLACEHOLDERS).map((k) => `{${k}}`).join(', ')})`);
    const filled = alt.replace(/\{([a-z_]+)\}/g, (_, k) => LEAD_PLACEHOLDERS[k] ?? '');
    if (/[{}]/.test(filled)) out.push(`${label} has a stray brace`);
    length(label, filled, LIMITS.lead);
    for (const why of writingProblems(filled)) out.push(`${label} ${why}`);
  }
  if (note.preview && note.subject && note.preview.toLowerCase().startsWith(note.subject.toLowerCase())) {
    out.push('preview repeats the subject; it should add to it');
  }
  length('cta', note.cta, LIMITS.cta);
  if (note.ctaNoGecko !== null) length('cta_no_gecko', note.ctaNoGecko, LIMITS.cta);
  if (note.visitorCta !== null) length('visitor_cta', note.visitorCta, LIMITS.cta);
  const words = wordCount(note.body);
  if (words < LIMITS.words[0] || words > LIMITS.words[1]) {
    out.push(`body is ${words} words; it must be ${LIMITS.words[0]} to ${LIMITS.words[1]}`);
  }
  const fields = [['subject', note.subject], ['preview', note.preview], ['cta', note.cta], ['cta_no_gecko', note.ctaNoGecko], ['visitor_cta', note.visitorCta], ['body', note.body]];
  for (const [label, value] of fields) {
    if (value === null) continue;
    for (const why of writingProblems(value)) out.push(`${label} ${why}`);
  }
  if (/^(hi|hello|hey|dear)\b/i.test(note.body)) out.push('body starts with a greeting; send-email adds none and the note needs none');
  for (const [label, value] of [['path', note.path], ['path_no_gecko', note.pathNoGecko]]) {
    if (value === null) continue;
    const why = pathProblem(value, live);
    if (why) out.push(`${label} "${value}" ${why}`);
  }
  // Visitors get visitor_path, or the note's own path when that works
  // signed out. A note whose page needs an account and has no visitor
  // button must say visitors: no.
  if (note.visitors && note.path !== null) {
    const label = note.visitorPath !== null ? 'visitor_path' : 'path';
    const value = note.visitorPath ?? note.path;
    const why = visitorPathProblem(value, live);
    if (why) {
      out.push(note.visitorPath !== null
        ? `${label} "${value}" ${why}`
        : `path "${value}" needs an account; add visitor_cta and visitor_path for visitors, or visitors: no`);
    }
  }
  out.push(...sourceProblems(note));
  return out;
}

/** Rules across the whole series: numbering, unique slugs and subjects. */
export function catalogProblems(notes) {
  const out = [];
  if (!notes.length) out.push('there are no notes in content/weekly-notes');
  else if (!notes.some((n) => n.visitors)) out.push('no note goes to visitors; at least one must');
  notes.forEach((note, i) => {
    if (note.step !== i + 1) out.push(`${note.fileName}: expected step ${i + 1} here; steps run 1 to N with no gaps or repeats`);
  });
  const dupes = (values, label) => {
    const seen = new Map();
    for (const [value, file] of values) {
      if (value === null) continue;
      const key = String(value).toLowerCase();
      if (seen.has(key)) out.push(`${file}: ${label} "${value}" is also used by ${seen.get(key)}`);
      else seen.set(key, file);
    }
  };
  dupes(notes.map((n) => [n.slug, n.fileName]), 'slug');
  dupes(notes.map((n) => [n.subject, n.fileName]), 'subject');
  return out;
}

// ---------- published slugs ----------------------------------------------
//
// The database ledger (weekly_notes_sends) is unique on the address and the
// slug, so a slug is a note's identity for good. If a published note were
// renamed, its new slug would be one nobody has had, and every member who
// already got the note would get it again as their next email. Withdrawing a
// note and later giving its slug to a different note would do the opposite:
// members who had the old one would silently never get the new one.
//
// content/weekly-notes/published-slugs.json lists every slug ever built into
// the catalog, in the order it was first built, plus the ones withdrawn on
// purpose. pnpm build:weekly-notes adds new slugs to it; nothing removes
// any. The checks below make a rename, a removal or a reuse fail the build
// and the tests instead of reaching members.

export const PUBLISHED_ABOUT = 'Every Weekly Gecko Notes slug ever built into the catalog, in the order it was first built. The ledger in the database is keyed on the slug, so a slug here is never renamed, reused or removed. pnpm build:weekly-notes adds new slugs. To withdraw a note, delete its file, renumber the rest and add its slug to withdrawn. See docs/planning/weekly-notes-2026-10.md, section 6.';

/** published-slugs.json, parsed. Never throws; problems go into `errors`. */
export function readPublished(file = PUBLISHED_FILE) {
  const empty = { published: [], withdrawn: [], errors: [], missing: false };
  if (!existsSync(file)) {
    return { ...empty, missing: true, errors: [`${PUBLISHED_FILE_NAME} is missing; run pnpm build:weekly-notes to make it`] };
  }
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    return { ...empty, errors: [`${PUBLISHED_FILE_NAME} is not valid JSON (${err.message})`] };
  }
  const errors = [];
  const list = (key) => {
    const value = data?.[key];
    if (!Array.isArray(value) || value.some((s) => typeof s !== 'string')) {
      errors.push(`${PUBLISHED_FILE_NAME}: "${key}" must be a list of slugs`);
      return [];
    }
    return value;
  };
  return { published: list('published'), withdrawn: list('withdrawn'), errors, missing: false };
}

/** The file's exact text for a ledger (deterministic, ends with a newline). */
export function publishedFileText(ledger) {
  return `${JSON.stringify({ about: PUBLISHED_ABOUT, published: ledger.published, withdrawn: ledger.withdrawn }, null, 2)}\n`;
}

/** The ledger with every catalog slug it does not list yet added, in step order. */
export function withNewSlugs(notes, ledger) {
  const published = [...ledger.published];
  for (const note of notes) {
    if (note.slug && SLUG_RE.test(note.slug) && !published.includes(note.slug)) published.push(note.slug);
  }
  return { ...ledger, published, errors: ledger.missing ? [] : ledger.errors, missing: false };
}

/**
 * Every slug in any committed version of published-slugs.json that git can
 * see here, or null when git (or the history) is not available, as in some
 * build machines. This is what makes the list append-only: a slug taken
 * out of the file by hand is still in an older version.
 */
export function committedPublishedSlugs() {
  const path = rel(PUBLISHED_FILE);
  const git = (args) => execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  let shas;
  try {
    shas = git(['log', '--format=%H', '--', path]).split('\n').filter(Boolean);
  } catch {
    return null;
  }
  const out = new Set();
  for (const sha of shas) {
    try {
      const data = JSON.parse(git(['show', `${sha}:${path}`]));
      for (const slug of Array.isArray(data?.published) ? data.published : []) out.add(slug);
    } catch {
      // The commit that deleted the file, or a version that does not parse.
    }
  }
  return out;
}

/** Problems between the notes and the published slugs. */
export function publishedProblems(notes, ledger = readPublished(), { committed = committedPublishedSlugs() } = {}) {
  const F = PUBLISHED_FILE_NAME;
  const out = [...ledger.errors];
  const catalog = new Set(notes.map((n) => n.slug).filter(Boolean));
  const published = new Set(ledger.published);
  const withdrawn = new Set(ledger.withdrawn);
  for (const [key, values] of [['published', ledger.published], ['withdrawn', ledger.withdrawn]]) {
    const seen = new Set();
    for (const slug of values) {
      if (seen.has(slug)) out.push(`${F}: "${slug}" is listed twice under ${key}`);
      seen.add(slug);
      if (!SLUG_RE.test(slug) || slug.length > SLUG_MAX) out.push(`${F}: "${slug}" under ${key} is not a valid slug`);
    }
  }
  for (const slug of withdrawn) {
    if (!published.has(slug)) out.push(`${F}: "${slug}" is under withdrawn but not under published; only a published slug can be withdrawn, and it stays under published too`);
    if (catalog.has(slug)) out.push(`${F}: "${slug}" was withdrawn and cannot come back: members who had the old note would never get the new one. Give the note a new slug`);
  }
  for (const slug of published) {
    if (!withdrawn.has(slug) && !catalog.has(slug)) {
      out.push(`${F}: "${slug}" was published and no note has it any more. Never rename a published slug: a renamed note goes again to every member who already had it. Put the old slug back, or, to withdraw the note on purpose, add "${slug}" to withdrawn`);
    }
  }
  for (const slug of catalog) {
    if (!published.has(slug)) out.push(`${F}: "${slug}" is not listed yet; run pnpm build:weekly-notes, which adds it`);
  }
  if (committed) {
    for (const slug of committed) {
      if (!published.has(slug)) out.push(`${F}: "${slug}" is in a committed version of this file and was taken out. The list only grows: put it back (and under withdrawn, if its note is gone)`);
    }
  }
  return out;
}

/** Every problem in the series, each starting with its file name. */
export function allProblems(notes = readWeeklyNotes(), { ledger = readPublished(), committed } = {}) {
  const live = liveRoutes();
  return [
    ...notes.flatMap((note) => noteProblems(note, { live }).map((p) => `${note.fileName}: ${p}`)),
    ...catalogProblems(notes),
    ...publishedProblems(notes, ledger, committed === undefined ? undefined : { committed }),
  ];
}

export const NOTES_DIR_REL = rel(NOTES_DIR);
export const PUBLISHED_FILE_REL = rel(PUBLISHED_FILE);
export const GENERATED_FILE_REL = rel(GENERATED_FILE);
