/**
 * Weekly Gecko Notes: the email files, the rules every note must follow,
 * and the set of in-app pages a note's button may open.
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
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RETIRED_PAGE_NAMES } from '../../src/lib/retiredPages.js';
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

export const FILE_NAME_RE = /^(\d{3})-([a-z0-9-]+)\.md$/;
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX = 64;

// The front matter keys, in the order the docs list them.
export const KEYS = ['step', 'slug', 'subject', 'cta', 'path', 'cta_no_gecko', 'path_no_gecko', 'sources'];
const REQUIRED = ['step', 'slug', 'subject', 'cta', 'path', 'sources'];

export const LIMITS = {
  subject: [1, 60],
  cta: [1, 40],
  words: [80, 200],
};

const rel = (path) => path.slice(REPO_ROOT.length + 1);

// ---------- parsing ---------------------------------------------------------

/**
 * One note file, parsed. Never throws: anything that does not fit the
 * format goes into `errors`, which noteProblems reports.
 *
 * Returns { fileName, step, slug, subject, cta, path, ctaNoGecko,
 * pathNoGecko, sources, body, paragraphs, bodyStartLine, errors }.
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
    cta: null,
    path: null,
    ctaNoGecko: null,
    pathNoGecko: null,
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

  if ('step' in front) {
    if (/^[1-9]\d*$/.test(front.step)) note.step = Number(front.step);
    else errors.push(`step "${front.step}" is not a whole number from 1`);
  }
  note.slug = front.slug ?? null;
  note.subject = front.subject ?? null;
  note.cta = front.cta ?? null;
  note.path = front.path ?? null;
  note.ctaNoGecko = front.cta_no_gecko ?? null;
  note.pathNoGecko = front.path_no_gecko ?? null;
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

/**
 * Every in-app path a note's button may open. Built from the app's own
 * route data, so a page that is renamed or retired drops out by itself.
 */
export function liveRoutes() {
  if (liveCache) return liveCache;
  const set = new Set(['/']);
  for (const key of readPagesKeys()) {
    if (!RETIRED_PAGE_NAMES.has(key)) set.add(`/${key}`);
  }
  for (const category of CARE_CATEGORIES) {
    for (const section of category.sections || []) set.add(`/CareGuide/${section.id}`);
  }
  set.add('/CareGuide/series');
  for (const guide of [FEEDING_GUIDE, SETUP_GUIDE, HANDBOOK_GUIDE, MORPH_GUIDE, BREEDING_GUIDE]) {
    set.add(`/CareGuide/series/${guide.id}`);
  }
  for (const morph of MORPHS) set.add(`/MorphGuide/${morph.slug}`);
  for (const path of ['/calculator', '/calculator/reverse', '/calculator/learn', '/crested-gecko-price']) set.add(path);
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
  if (anchor !== undefined) {
    if (base !== '/Settings') return 'a #anchor is allowed only on /Settings';
    if (!settingsAnchors().has(anchor)) return `/Settings has no id="${anchor}"`;
    return null;
  }
  if (!live.has(base)) return 'is not a live page';
  return null;
}

// ---------- the writing rules --------------------------------------------

const PERCENT_ALLOWED = new Set([5, 10, 25, 50, 66, 70, 80, 100]);

// [pattern, what is wrong]. Run on the subject, the button words and the
// body (never on sources, which are file paths).
export const WRITING_RULES = [
  [/\u2014/, 'has an em dash'],
  [/\u2013/, 'has an en dash'],
  [/--/, 'has "--"'],
  [/ - /, 'has " - " used as a dash'],
  [/\d\s?-\s?\d/, 'has a number range with a hyphen; write "1 to 2"'],
  [/[#*_`[\]<>]/, 'has a markdown or HTML character (# * _ ` [ ] < >)'],
  [/https?:\/\/|\bwww\.|geckinspect\.com/i, 'has a web address; the button carries the link'],
  [/(^|[\s("'])\/[A-Za-z]/, 'has an in-app path; the button carries the link'],
  [/\bI\b|\bI['\u2019](m|ve|d|ll)\b/, 'speaks in the first person singular'],
  [/\b(my|me|mine|myself)\b/i, 'speaks in the first person singular'],
  [/\b(articles?|blogs?|blogging|newsletters?|this issue|last issue|next issue|issue #?\d+)\b/i, 'calls itself an article, blog post or newsletter issue'],
  [/\bpromote\b|\bconsultant\b|\bother reptiles\b|\bstores?\b|\bsupplies\b|\bstickers?\b|\bwebsite builder\b|\bvisuali[sz]er\b|\bguess the price\b|\bgiveaways?\b|\bmentorship\b|\bbreeding loans?\b|\bassistant chat\b|\bhealth screen\w*\b|\bgrowth reel\b|\bsensors?\b/i, 'names a retired feature'],
  [/[$\u20AC\u00A3]|\bUSD\b|\bdollars?\b/i, 'mentions a price'],
  [/\bmorph ?market\b|\bpalm street\b|\bfauna classifieds\b|\bkingsnake\b|\breptidex\b|\bgeckistry\b|\bbreed ledger\b/i, 'names a marketplace or another app'],
  [/\b(studies|research|science)\s+(show|shows|found|finds|suggest|suggests|proves?)\b|\bsurveys?\b|\baccording to\b|\bpercent of\b/i, 'sounds like a made-up statistic'],
  [/\b\d[\d,.]*\s*(members|keepers|breeders|people|users)\b|\b(hundreds|thousands|millions|dozens) of (members|keepers|breeders|people|users)\b/i, 'counts members, keepers, breeders, people or users'],
  [/\b(pangea|repashy|leachie|lugarti|black panther|zoo ?med)\b/i, 'names a CGD brand'],
  [/\b(spring|summer|autumn|winter)\b|\b(January|February|March|April|June|July|August|September|October|November|December)\b/, 'names a season or a month; write "when your room warms up" instead'],
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
  length('cta', note.cta, LIMITS.cta);
  if (note.ctaNoGecko !== null) length('cta_no_gecko', note.ctaNoGecko, LIMITS.cta);
  const words = wordCount(note.body);
  if (words < LIMITS.words[0] || words > LIMITS.words[1]) {
    out.push(`body is ${words} words; it must be ${LIMITS.words[0]} to ${LIMITS.words[1]}`);
  }
  const fields = [['subject', note.subject], ['cta', note.cta], ['cta_no_gecko', note.ctaNoGecko], ['body', note.body]];
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
  out.push(...sourceProblems(note));
  return out;
}

/** Rules across the whole series: numbering, unique slugs and subjects. */
export function catalogProblems(notes) {
  const out = [];
  if (!notes.length) out.push('there are no notes in content/weekly-notes');
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

/** Every problem in the series, each starting with its file name. */
export function allProblems(notes = readWeeklyNotes()) {
  const live = liveRoutes();
  return [
    ...notes.flatMap((note) => noteProblems(note, { live }).map((p) => `${note.fileName}: ${p}`)),
    ...catalogProblems(notes),
  ];
}

export const NOTES_DIR_REL = rel(NOTES_DIR);
export const GENERATED_FILE_REL = rel(GENERATED_FILE);
