// Weekly Gecko Notes (docs/planning/weekly-notes-2026-10.md): the note
// files in content/weekly-notes, the catalog generated from them, the rules
// every note follows, and the two edge functions that send and stop them.
//
// When a note changes, rebuild the catalog with pnpm build:weekly-notes;
// the first test fails until you do.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as lifecycleCopy from '../../../supabase/functions/_shared/lifecycle-copy.ts';
import * as weeklyNotes from '../../../supabase/functions/_shared/weekly-notes.ts';
import { buildWeeklyNotesModule } from '../../../scripts/build-weekly-notes.mjs';
import {
  APP_LABELS,
  DO_NOT_CITE,
  GENERATED_FILE,
  LIMITS,
  NOTES_DIR,
  NOT_FOR_NOTES,
  PUBLISHED_FILE,
  PUBLISHED_FILE_NAME,
  REPO_ROOT,
  RETIRED_NAMES,
  allProblems,
  catalogProblems,
  committedPublishedSlugs,
  liveRoutes,
  noteProblems,
  parseNote,
  pathProblem,
  publishedFileText,
  publishedProblems,
  readPublished,
  readWeeklyNotes,
  sourceProblems,
  withNewSlugs,
  wordCount,
  writingProblems,
} from '../../../scripts/lib/weekly-notes.mjs';
import { RETIRED_PAGE_NAMES } from '../retiredPages';
import { fakeFetch, fakeSupabase, loadFunction, postJson } from './edgeHarness';

const NOTES = readWeeklyNotes();
// Every file in the folder except the published-slugs list.
const FILES = readdirSync(NOTES_DIR).filter((name) => !name.startsWith('.') && name !== PUBLISHED_FILE_NAME);
const SITE = 'https://geckinspect.com';

describe('the generated catalog', () => {
  it('matches the note files (run pnpm build:weekly-notes after changing a note)', () => {
    const onDisk = readFileSync(GENERATED_FILE, 'utf8');
    expect(onDisk, 'supabase/functions/_shared/weekly-notes.generated.ts is stale: run pnpm build:weekly-notes').toBe(
      buildWeeklyNotesModule(NOTES),
    );
  });

  it('ships the words and buttons, not the sources', () => {
    const onDisk = readFileSync(GENERATED_FILE, 'utf8');
    expect(onDisk).not.toMatch(/sources|\.jsx?:\d/);
    expect(weeklyNotes.weeklyNoteSlugs()).toEqual(NOTES.map((n) => n.slug));
  });

  it('every note passes every rule (the build refuses otherwise)', () => {
    expect(allProblems(NOTES)).toEqual([]);
  });
});

describe('numbering', () => {
  it('every file in the folder is a note named NNN-slug.md (or the published-slugs list)', () => {
    expect(FILES.length).toBeGreaterThan(0);
    expect(readdirSync(NOTES_DIR)).toContain(PUBLISHED_FILE_NAME);
    for (const name of FILES) expect(name).toMatch(/^\d{3}-[a-z0-9-]+\.md$/);
    expect(NOTES).toHaveLength(FILES.length);
  });

  it('step is the file prefix and slug is the rest of the name', () => {
    for (const note of NOTES) {
      const [, prefix, rest] = /^(\d{3})-(.+)\.md$/.exec(note.fileName);
      expect(note.step, note.fileName).toBe(Number(prefix));
      expect(note.slug, note.fileName).toBe(rest);
    }
  });

  it('steps run 1 to N with no gaps', () => {
    expect(NOTES.map((n) => n.step)).toEqual(NOTES.map((_, i) => i + 1));
  });

  it('slugs and subjects are unique', () => {
    expect(new Set(NOTES.map((n) => n.slug)).size).toBe(NOTES.length);
    expect(new Set(NOTES.map((n) => n.subject.toLowerCase())).size).toBe(NOTES.length);
  });

  it('the numbering check catches a gap and a repeat', () => {
    const one = parseNote('001-a.md', '---\nstep: 1\nslug: a\n---\nx');
    const three = parseNote('003-c.md', '---\nstep: 3\nslug: c\n---\nx');
    expect(catalogProblems([one, three]).join('\n')).toMatch(/expected step 2/);
    const dupe = { ...one, fileName: '002-a.md', step: 2 };
    expect(catalogProblems([one, dupe]).join('\n')).toMatch(/slug|also used/);
  });
});

describe('lengths', () => {
  it.each(NOTES.map((n) => [n.fileName, n]))('%s: subject, button and body lengths', (_name, note) => {
    expect(note.subject.length).toBeGreaterThanOrEqual(1);
    expect(note.subject.length).toBeLessThanOrEqual(60);
    expect(note.cta.length).toBeGreaterThanOrEqual(1);
    expect(note.cta.length).toBeLessThanOrEqual(40);
    if (note.ctaNoGecko !== null) expect(note.ctaNoGecko.length).toBeLessThanOrEqual(40);
    const words = note.body.split(/\s+/).filter(Boolean).length;
    expect(words).toBeGreaterThanOrEqual(80);
    expect(words).toBeLessThanOrEqual(200);
    expect(wordCount(note.body)).toBe(words);
    expect(LIMITS).toEqual({ subject: [1, 60], preview: [20, 100], lead: [20, 200], cta: [1, 40], words: [80, 200] });
  });
});

describe('writing rules', () => {
  it.each(NOTES.map((n) => [n.fileName, n]))('%s: subject, button and body follow the rules', (_name, note) => {
    for (const text of [note.subject, note.preview, note.cta, note.ctaNoGecko, note.body].filter((t) => t !== null)) {
      expect(writingProblems(text), text.slice(0, 60)).toEqual([]);
      expect(text).not.toMatch(/\u2014|\u2013|--| - |\d-\d/);
      expect(text).not.toMatch(/[#*_`[\]<>]/);
    }
    expect(note.body).not.toMatch(/https?:|www\.|geckinspect\.com|(^|\s)\/[A-Za-z]/);
  });

  // Each rule, shown catching the mistake it is for.
  it.each([
    ['an em dash', 'Heat kills \u2014 fast.'],
    ['an en dash', 'Weigh every 1\u20132 weeks.'],
    ['a double hyphen', 'Heat kills -- fast.'],
    ['a spaced hyphen', 'Heat kills - fast.'],
    ['a hyphen range', 'Weigh every 1-2 weeks.'],
    ['markdown', 'Read the **care guide**.'],
    ['a link', 'Open https://geckinspect.com/Today now.'],
    ['a bare domain', 'See geckinspect.com for more.'],
    ['an in-app path', 'Open /Today and log it.'],
    ['first person', 'When I hatched my first clutch, it was a surprise.'],
    ['"me"', 'Ask me anything.'],
    ['an article', 'This article explains humidity.'],
    ['the blog', 'Read the blog for more.'],
    ['a newsletter issue', 'In this issue: humidity.'],
    ['a retired feature', 'Try the Morph Visualizer.'],
    ['the store', 'Buy CGD in the store.'],
    ['the AI Consultant', 'Ask the consultant.'],
    ['a price', 'A Lilly White sells for $300.'],
    ['dollars', 'It costs a few dollars.'],
    ['a marketplace', 'List it on MorphMarket.'],
    ['a study', 'Studies show heat kills.'],
    ['a survey', 'A survey of keepers found this.'],
    ['a member count', 'Over 500 keepers use it.'],
    ['an odd percentage', 'About 37% of eggs hatch.'],
    ['a CGD brand', 'Feed Pangea or Repashy.'],
    ['a season', 'Every summer, check the heat.'],
    ['a month', 'Check again in July.'],
    ['May, the month', 'Check again in May, when the room warms up.'],
    // The forms a review showed slipping past the first version of the rules.
    ['a share of something', 'About 50% of hatchlings that die are lost to heat.'],
    ['researchers', 'Researchers found that a cool room halves the risk.'],
    ['a dated paper', 'A 2019 paper found heat stress.'],
    ['vets agreeing', 'Vets agree that heat is the bigger risk.'],
    ['first person plural', 'When we hatched our first clutch, half of it was lost to a hot week.'],
    ['a member count with words between', 'Over 60 Geck Inspect members logged a heat loss last year.'],
    ['bucks', 'A Lilly White costs about 300 bucks.'],
    ['a price without a symbol', 'A Harlequin sells for 200 now.'],
    ['an attributed quote', 'As one breeder put it, "Heat is the silent killer."'],
    ['a quote with its speaker after it', '"Never again," she said.'],
    ['Community Connect', 'Ask in Community Connect.'],
    ['the Training Center', 'Try the Training Center.'],
    ['Breeding Pairs', 'Open Breeding Pairs.'],
    ['the Shipping page', 'Book it on Shipping.'],
    ['a horizontal bar', 'Heat kills \u2015 fast.'],
    ['a minus sign', 'A \u22125 g change.'],
    ['a figure dash', 'Weigh every 1\u20122 weeks.'],
  ])('rejects %s', (_label, text) => {
    expect(writingProblems(text).length).toBeGreaterThan(0);
  });

  it('leaves alone the ordinary words the stricter rules sit next to', () => {
    for (const text of [
      'Most breeders wait for at least 40 g and 18 months.',
      'At 40 g and 18 months, most breeders pair her.',
      'You may see it shed overnight.',
      'Weigh before shipping a gecko to a new home.',
      'Soak the gecko on damp paper towel. On paper, two in three are hets.',
      'The record says what is missing.',
      'That is where "66% possible het" comes from.',
    ]) {
      expect(writingProblems(text), text).toEqual([]);
    }
  });

  it('names every retired page and feature', () => {
    for (const name of ['Community Connect', 'Breeding Pairs', 'Morph Visualizer', 'Other Reptiles', 'Training Center', 'AI Consultant', 'Shipping', 'website builder']) {
      expect(RETIRED_NAMES, name).toContain(name);
    }
    for (const name of RETIRED_PAGE_NAMES) {
      const words = name.replace(/([a-z])([A-Z])/g, '$1 $2');
      expect(writingProblems(`Open ${words} today.`), words).not.toEqual([]);
    }
  });

  it('allows the percentages, compound words and app labels the notes use', () => {
    expect(writingProblems('25% visual, 50% het, 66% possible het and 100% het. Look into a 5% drop.')).toEqual([]);
    expect(writingProblems('A fired-down, low-wattage, high-calcium sub-adult.')).toEqual([]);
    expect(writingProblems('Tap Add to my collection, then open My Geckos.')).toEqual([]);
    expect(writingProblems('Let it fall back by day, and check again when your room warms up.')).toEqual([]);
  });

  it('every app label a note may quote exists in the app', () => {
    const recognition = readFileSync(`${REPO_ROOT}/src/pages/Recognition.jsx`, 'utf8');
    const nav = readFileSync(`${REPO_ROOT}/src/lib/navItems.js`, 'utf8');
    expect(APP_LABELS).toEqual(['Add to my collection', 'My Geckos']);
    expect(recognition).toContain('Add to my collection');
    expect(nav).toContain('My Geckos');
  });
});

describe('live links', () => {
  const live = liveRoutes();

  it.each(NOTES.flatMap((n) => [[n.fileName, 'path', n.path], ...(n.pathNoGecko ? [[n.fileName, 'path_no_gecko', n.pathNoGecko]] : [])]))(
    '%s: %s %s is a live page',
    (_name, _field, path) => {
      expect(pathProblem(path, live)).toBeNull();
    },
  );

  it('the no-gecko button comes as a pair', () => {
    for (const note of NOTES) expect(note.ctaNoGecko === null, note.fileName).toBe(note.pathNoGecko === null);
  });

  it('the live set is built from the app\'s own routes', () => {
    for (const path of [
      '/', '/MyGeckos', '/Today', '/Breeding', '/Lineage', '/FieldMode', '/Recognition', '/GeneticsGuide',
      '/CareGuide/temperature', '/CareGuide/series', '/CareGuide/series/handbook', '/MorphGuide/lilly-white',
      '/calculator', '/calculator/reverse', '/calculator/learn', '/calculator/pairing/lilly-white-x-normal',
      '/calculator/axanthic', '/crested-gecko-price',
    ]) {
      expect(live.has(path), path).toBe(true);
    }
    for (const name of RETIRED_PAGE_NAMES) expect(live.has(`/${name}`), name).toBe(false);
  });

  it.each([
    ['/blog', /blog/],
    ['/blog/heat-stress', /blog/],
    ['/Promote', /retired/],
    ['/MorphVisualizer', /retired/],
    ['/BreederConsultant', /retired/],
    ['/OtherReptiles', /retired/],
    ['/Store', /retired/],
    ['/Store/stickers', /retired/],
    ['/log', /Nothing to log here/],
    ['/log?gecko=1&type=weight', /query string/],
    ['/Pedigree', /needs a gecko id/],
    ['/GeckoDetail', /needs a gecko id/],
    ['/Breeding?tab=hatchery', /query string/],
    ['https://geckinspect.com/Today', /absolute URL/],
    ['//evil.example/Today', /absolute URL/],
    ['Today', /single \//],
    ['/NoSuchPage', /not a live page/],
    ['/CareGuide/no-such-topic', /not a live page/],
    ['/MyGeckos#weights', /only on \/Settings/],
    ['/Settings#no-such-section', /no id=/],
    ['/AdminPanel', /admins only/],
    ['/ImageImport', /admins only/],
    ['/Training', /internal admin page/],
    ['/AuthPortal', /sign-in page/],
    ['/ForumPost', /needs a post id/],
    ['/MorphMarketExport', /marketplace/],
  ])('rejects %s', (path, reason) => {
    expect(pathProblem(path, live)).toMatch(reason);
  });

  it('allows a Settings anchor that exists on the page', () => {
    expect(pathProblem('/Settings#email-notifications', live)).toBeNull();
  });

  it('every page kept out of the notes is still a page, so the list cannot go stale', () => {
    const pages = readFileSync(`${REPO_ROOT}/src/pages.config.js`, 'utf8');
    for (const name of Object.keys(NOT_FOR_NOTES)) {
      expect(pages, name).toMatch(new RegExp(`"${name}"\\s*:`));
      expect(live.has(`/${name}`), name).toBe(false);
    }
  });
});

// ---------- published slugs ---------------------------------------------------
//
// The ledger is unique on (email, slug), so a renamed note would go again to
// everyone who had it. published-slugs.json only ever grows.

describe('published slugs', () => {
  const ledger = readPublished();
  const note = (step, slug) => ({ ...parseNote(`${String(step).padStart(3, '0')}-${slug}.md`, `---\nstep: ${step}\nslug: ${slug}\n---\nx`) });
  const a = note(1, 'heat-first');
  const b = note(2, 'weight-next');
  const L = (published, withdrawn = []) => ({ published, withdrawn, errors: [], missing: false });

  it('the file lists every note, in step order, and is exactly what the build writes', () => {
    expect(ledger.errors).toEqual([]);
    for (const n of NOTES) expect(ledger.published, n.slug).toContain(n.slug);
    expect(readFileSync(PUBLISHED_FILE, 'utf8')).toBe(publishedFileText(ledger));
    expect(withNewSlugs(NOTES, ledger).published).toEqual(ledger.published);
    expect(publishedProblems(NOTES, ledger)).toEqual([]);
  });

  it('only ever grows: every slug in a committed version of the file is still listed', () => {
    const committed = committedPublishedSlugs();
    // null where git or the history is not available (some build machines).
    if (committed === null) return;
    for (const slug of committed) expect(ledger.published, slug).toContain(slug);
  });

  it('a renamed note fails: its old slug was published and no note has it', () => {
    const renamed = note(1, 'heat-renamed');
    const next = withNewSlugs([renamed, b], L(['heat-first', 'weight-next']));
    expect(next.published).toEqual(['heat-first', 'weight-next', 'heat-renamed']);
    expect(publishedProblems([renamed, b], next, { committed: null }).join('\n')).toMatch(/"heat-first" was published and no note has it any more/);
  });

  it('a slug taken out of the file by hand fails against the committed history', () => {
    expect(publishedProblems([b], L(['weight-next']), { committed: new Set(['heat-first', 'weight-next']) }).join('\n'))
      .toMatch(/"heat-first" is in a committed version of this file and was taken out/);
  });

  it('a note withdrawn on purpose passes, and its slug can never come back', () => {
    expect(publishedProblems([b], L(['heat-first', 'weight-next'], ['heat-first']), { committed: null })).toEqual([]);
    expect(publishedProblems([a, b], L(['heat-first', 'weight-next'], ['heat-first']), { committed: null }).join('\n'))
      .toMatch(/"heat-first" was withdrawn and cannot come back/);
    expect(publishedProblems([b], L(['weight-next'], ['heat-first']), { committed: null }).join('\n'))
      .toMatch(/only a published slug can be withdrawn/);
  });

  it('a new note not built yet is named, and the build adds it at the end', () => {
    expect(publishedProblems([a, b], L(['heat-first']), { committed: null }).join('\n')).toMatch(/"weight-next" is not listed yet; run pnpm build:weekly-notes/);
    expect(withNewSlugs([a, b], L(['heat-first'])).published).toEqual(['heat-first', 'weight-next']);
  });

  it('allProblems includes these checks, so the build refuses a rename', () => {
    const renamed = { ...NOTES[0], slug: `${NOTES[0].slug}-renamed`, fileName: NOTES[0].fileName.replace('.md', '-renamed.md') };
    const problems = allProblems([renamed, ...NOTES.slice(1)], { ledger: withNewSlugs([renamed, ...NOTES.slice(1)], ledger), committed: null });
    expect(problems.join('\n')).toMatch(new RegExp(`"${NOTES[0].slug}" was published and no note has it any more`));
  });
});

describe('sources', () => {
  it.each(NOTES.map((n) => [n.fileName, n]))('%s: every source points at real lines', (_name, note) => {
    expect(note.sources.length).toBeGreaterThan(0);
    expect(sourceProblems(note)).toEqual([]);
  });

  it('a missing file, lines past the end and a do-not-use line are caught', () => {
    const bad = parseNote('001-x.md', [
      '---',
      'sources: src/nope.js:1; src/data/husbandry-facts.js:9999; src/data/keepers-guides/morph.js:269; not-a-ref',
      '---',
      'Body.',
    ].join('\n'));
    const problems = sourceProblems(bad).join('\n');
    expect(problems).toMatch(/src\/nope\.js does not exist/);
    expect(problems).toMatch(/lines 9999 to 9999 are not inside/);
    expect(problems).toMatch(/do-not-use list/);
    expect(problems).toMatch(/not file:line/);
  });

  it('the do-not-use list still points at the lines it means', () => {
    for (const entry of DO_NOT_CITE) {
      const lines = readFileSync(`${REPO_ROOT}/${entry.file}`, 'utf8').split('\n').slice(entry.from - 1, entry.to).join('\n');
      expect(lines, `${entry.file}:${entry.from}-${entry.to} moved; update DO_NOT_CITE in scripts/lib/weekly-notes.mjs`).toContain(entry.contains);
    }
  });
});

describe('the note file format', () => {
  const good = [
    '---',
    'step: 1',
    'slug: heat-is-the-bigger-risk',
    'subject: Heat is the bigger risk',
    'preview: Days of 72 to 78°F, nights a little cooler.',
    'cta: Open the temperature guide',
    'path: /CareGuide/temperature',
    'sources: src/data/husbandry-facts.js:68-75',
    '---',
    'Line one of a paragraph',
    'continues here.',
    '',
    'A second paragraph.',
    '',
  ].join('\n');

  it('joins lines inside a paragraph with a space and paragraphs with a blank line', () => {
    const note = parseNote('001-heat-is-the-bigger-risk.md', good);
    expect(note.errors).toEqual([]);
    expect(note.body).toBe('Line one of a paragraph continues here.\n\nA second paragraph.');
    expect(note.paragraphs.map((p) => p.line)).toEqual([10, 13]);
  });

  it('is strict: unknown or repeated keys, a lone no-gecko key, CRLF and a missing fence are problems', () => {
    expect(parseNote('x.md', good.replace('step: 1', 'step: 1\nauthor: me')).errors.join()).toMatch(/unknown key "author"/);
    expect(parseNote('x.md', good.replace('step: 1', 'step: 1\nstep: 2')).errors.join()).toMatch(/appears twice/);
    expect(parseNote('x.md', good.replace('step: 1', 'step: 1\ncta_no_gecko: Add a gecko')).errors.join()).toMatch(/go together/);
    expect(parseNote('x.md', good.replace(/\n/g, '\r\n')).errors.join()).toMatch(/CRLF/);
    expect(parseNote('x.md', good.replace(/^---\n/, '')).errors.join()).toMatch(/must start/);
    expect(parseNote('x.md', good.replace('slug: heat', 'slug heat')).errors.join()).toMatch(/key: value/);
    expect(parseNote('x.md', good.replace('step: 1', 'step: one')).errors.join()).toMatch(/whole number/);
  });

  it('noteProblems names the file name, slug and step mismatches', () => {
    const note = parseNote('002-other-slug.md', good);
    const problems = noteProblems(note).join('\n');
    expect(problems).toMatch(/step 1 does not match the file name's 002/);
    expect(problems).toMatch(/slug "heat-is-the-bigger-risk" does not match/);
    expect(problems).toMatch(/body is 10 words/);
  });
});

describe('weekly-notes.ts', () => {
  const { weeklyNoteEmail, weeklyNoteSlugs, isWeeklyNotesType, WEEKLY_NOTES_TYPE, WEEKLY_NOTES_REASON, WEEKLY_NOTES_STOP_WORDS } = weeklyNotes;

  it('names the type, the footer reason and the stop words', () => {
    expect(WEEKLY_NOTES_TYPE).toBe('weekly_notes');
    expect(isWeeklyNotesType('weekly_notes')).toBe(true);
    expect(isWeeklyNotesType('weekly_digest')).toBe(false);
    // It says the email is promotional (CAN-SPAM wants that in commercial
    // email sent without prior affirmative consent), and follows the rules.
    expect(WEEKLY_NOTES_REASON).toBe('Weekly Gecko Notes are promotional emails from Geck Inspect, one short tip a week. You are getting them because you have a Geck Inspect account.');
    expect(WEEKLY_NOTES_REASON).toMatch(/promotional/);
    expect(writingProblems(WEEKLY_NOTES_REASON)).toEqual([]);
    expect(WEEKLY_NOTES_STOP_WORDS).toBe('stop Weekly Gecko Notes');
  });

  it('builds the email for a slug, with the no-gecko button when there is one', () => {
    const withButton = NOTES.find((n) => n.pathNoGecko);
    const withoutButton = NOTES.find((n) => !n.pathNoGecko);
    expect(weeklyNoteEmail(withButton.slug, { hasGecko: true })).toEqual({
      title: withButton.subject, preheader: withButton.preview, body: withButton.body, url: withButton.path, cta: withButton.cta,
    });
    expect(weeklyNoteEmail(withButton.slug, { hasGecko: false })).toMatchObject({
      url: withButton.pathNoGecko, cta: withButton.ctaNoGecko,
    });
    expect(weeklyNoteEmail(withoutButton.slug, { hasGecko: false })).toMatchObject({
      url: withoutButton.path, cta: withoutButton.cta,
    });
    expect(weeklyNoteEmail('no-such-note', { hasGecko: true })).toBeNull();
    expect(weeklyNoteSlugs()[0]).toBe(NOTES[0].slug);
  });
});

// ---------- send-email --------------------------------------------------------

const ENV = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  RESEND_API_KEY: 're_test',
};
const POSTAL = '123 Gecko Lane, Springfield, OR 97477';
const NOTE_1 = NOTES[0];
const NO_GECKO_NOTE = NOTES.find((n) => n.pathNoGecko);

function setup({ profile = {}, rpc = {}, env = { EMAIL_POSTAL_ADDRESS: POSTAL } } = {}) {
  const db = fakeSupabase((call) => {
    if (call.table === 'profiles') {
      return {
        data: {
          id: 'p1', role: 'user', email_notifications_enabled: true,
          email_notification_types: ['announcements', 'breeding_updates', 'forum_replies'], ...profile,
        },
        error: null,
      };
    }
    if (call.rpc && rpc[call.rpc]) return rpc[call.rpc](call);
    if (call.rpc === 'email_has_login') return { data: true, error: null };
    if (call.rpc === 'email_is_suppressed') return { data: false, error: null };
    if (call.rpc === 'email_unsubscribe_token') return { data: 'p1.sig', error: null };
    if (call.rpc === 'claim_weekly_note_from') return { data: { slug: NOTE_1.slug, step: 1, has_gecko: true }, error: null };
    if (call.rpc === 'weekly_note_facts') return { data: FACTS, error: null };
    if (call.rpc === 'record_email_event') return { data: true, error: null };
    return undefined;
  });
  const net = fakeFetch(() => ({ body: { id: 'email-1' } }));
  const fn = loadFunction('send-email', {
    env: { ...ENV, ...env },
    globals: { createClient: () => db.client, fetch: net.fetch, ...lifecycleCopy, ...weeklyNotes },
  });
  const send = async (payload) => {
    const res = await fn.handle(postJson('https://x.test/', payload, { authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}` }));
    return res.json();
  };
  return { db, net, send };
}

// A keeper with no weights yet and no female: fits the everyone and
// keepers notes, and gets the leads that need no weight.
const FACTS = { gecko_count: 1, stale: { id: 'g1', name: 'Mango', last_weight_grams: null, last_weight_date: null }, female: null, breeder: false };
const MONTH = new Date().getUTCMonth() + 1;

const WEEKLY = { user_email: 'Sam@Example.com', type: 'weekly_notes', weekly: { run_at: '2026-10-18T00:50:00Z' } };

describe('send-email sends Weekly Gecko Notes', () => {
  it('sends note 1 from the catalog, with its own footer, links and tag', async () => {
    const { db, net, send } = setup();
    const out = await send(WEEKLY);
    expect(out).toMatchObject({ delivered: 1, id: 'email-1' });
    const plan = weeklyNotes.weeklyNoteMemberPlan(FACTS, MONTH);
    expect(db.rpcCalls('claim_weekly_note_from')[0].args).toEqual({ p_email: 'sam@example.com', p_slugs: plan.slugs, p_steps: plan.steps });
    const mail = net.requests[0].body;
    expect(mail.subject).toBe(NOTE_1.subject);
    expect(mail.text.startsWith(NOTE_1.body)).toBe(true);
    expect(mail.text).toContain(`${NOTE_1.cta}: ${SITE}${NOTE_1.path}`);
    // The footer: why it came, a link that stops only these, and the address.
    expect(mail.text).toContain(weeklyNotes.WEEKLY_NOTES_REASON);
    expect(mail.text).toContain(`Stop Weekly Gecko Notes: ${SITE}/Unsubscribe?t=p1.sig&scope=weekly`);
    expect(mail.text).toContain(`Geck Inspect, ${POSTAL}`);
    expect(mail.html).toContain(`href="${SITE}/Unsubscribe?t=p1.sig&amp;scope=weekly" style="color:#047857;">stop Weekly Gecko Notes</a>`);
    expect(mail.html).toContain(weeklyNotes.WEEKLY_NOTES_REASON);
    expect(mail.html).toContain(`Geck Inspect, ${POSTAL}`);
    // One-click from the mail app stops only these too.
    expect(mail.headers['List-Unsubscribe']).toBe('<https://project.supabase.co/functions/v1/email-unsubscribe?t=p1.sig&scope=weekly>');
    expect(mail.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(mail.tags).toEqual([{ name: 'type', value: 'weekly_notes' }]);
    expect(db.rpcCalls('record_email_event')[0].args).toMatchObject({ p_email: 'sam@example.com', p_email_type: 'weekly_notes' });
  });

  it('a member with no gecko gets the no-gecko button', async () => {
    const { net, send } = setup({
      rpc: { claim_weekly_note_from: () => ({ data: { slug: NO_GECKO_NOTE.slug, step: NO_GECKO_NOTE.step, has_gecko: false }, error: null }) },
    });
    await send(WEEKLY);
    const mail = net.requests[0].body;
    expect(mail.subject).toBe(NO_GECKO_NOTE.subject);
    expect(mail.text).toContain(`${NO_GECKO_NOTE.ctaNoGecko}: ${SITE}${NO_GECKO_NOTE.pathNoGecko}`);
    expect(mail.html).toContain(`href="${SITE}${NO_GECKO_NOTE.pathNoGecko}"`);
  });

  it('ignores a title, body or url in the payload', async () => {
    const { net, send } = setup();
    await send({ ...WEEKLY, title: 'Buy now', body: 'spam', url: 'https://evil.example/' });
    const mail = net.requests[0].body;
    expect(mail.subject).toBe(NOTE_1.subject);
    expect(mail.text).not.toContain('spam');
    expect(mail.html).not.toContain('evil.example');
  });

  it('skips without a run marker (a member-written notification), and never claims', async () => {
    for (const weekly of [undefined, null, 'run', ['x'], 5]) {
      const { db, net, send } = setup();
      expect(await send({ user_email: 'sam@example.com', type: 'weekly_notes', title: 'Hi', body: 'Hi', weekly }))
        .toEqual({ delivered: 0, skipped: 'weekly-notes-without-run' });
      expect(db.rpcCalls('claim_weekly_note_from')).toHaveLength(0);
      expect(net.requests).toHaveLength(0);
    }
  });

  it('skips while no postal address is set, before any claim (the next note is not used up)', async () => {
    for (const env of [{}, { EMAIL_POSTAL_ADDRESS: '   ' }]) {
      const { db, net, send } = setup({ env });
      expect(await send(WEEKLY)).toEqual({ delivered: 0, skipped: 'weekly-notes-no-postal-address' });
      expect(db.rpcCalls('claim_weekly_note_from')).toHaveLength(0);
      expect(db.calls).toHaveLength(0);
      expect(net.requests).toHaveLength(0);
    }
  });

  it('skips a member with email switched off, before any claim', async () => {
    const { db, net, send } = setup({ profile: { email_notifications_enabled: false } });
    expect(await send(WEEKLY)).toEqual({ delivered: 0, skipped: 'master-off' });
    expect(db.rpcCalls('claim_weekly_note_from')).toHaveLength(0);
    expect(net.requests).toHaveLength(0);
  });

  it('does not need a key in the old preference list (its switch is its own column)', async () => {
    const { net, send } = setup({ profile: { email_notification_types: [] } });
    expect(await send(WEEKLY)).toMatchObject({ delivered: 1 });
    expect(net.requests).toHaveLength(1);
  });

  it('skips with no signed unsubscribe link (the token fails twice), before any claim', async () => {
    const { db, net, send } = setup({ rpc: { email_unsubscribe_token: () => ({ data: null, error: { message: 'no secret' } }) } });
    expect(await send(WEEKLY)).toEqual({ delivered: 0, skipped: 'weekly-notes-no-token' });
    expect(db.rpcCalls('email_unsubscribe_token')).toHaveLength(2);
    expect(db.rpcCalls('claim_weekly_note_from')).toHaveLength(0);
    expect(net.requests).toHaveLength(0);
  });

  it('skips when the login or suppression check cannot answer, before any claim', async () => {
    for (const rpc of [
      { email_has_login: () => ({ data: null, error: { message: 'down' } }) },
      { email_is_suppressed: () => ({ data: null, error: { message: 'down' } }) },
    ]) {
      const { db, net, send } = setup({ rpc });
      expect(await send(WEEKLY)).toEqual({ delivered: 0, skipped: 'weekly-notes-check-failed' });
      expect(db.rpcCalls('claim_weekly_note_from')).toHaveLength(0);
      expect(net.requests).toHaveLength(0);
    }
  });

  it('skips no-login and suppressed addresses as for every email', async () => {
    const noLogin = setup({ rpc: { email_has_login: () => ({ data: false, error: null }) } });
    expect(await noLogin.send(WEEKLY)).toEqual({ delivered: 0, skipped: 'no-login' });
    const suppressed = setup({ rpc: { email_is_suppressed: () => ({ data: true, error: null }) } });
    expect(await suppressed.send(WEEKLY)).toEqual({ delivered: 0, skipped: 'suppressed' });
    expect(noLogin.db.rpcCalls('claim_weekly_note_from')).toHaveLength(0);
    expect(suppressed.db.rpcCalls('claim_weekly_note_from')).toHaveLength(0);
  });

  it('sends nothing when the claim says caught-up, not-eligible or fails', async () => {
    for (const [answer, skipped] of [
      [{ data: { reason: 'caught-up' }, error: null }, 'weekly-notes-caught-up'],
      [{ data: { reason: 'not-eligible' }, error: null }, 'weekly-notes-not-eligible'],
      [{ data: { reason: 'Drop Table' }, error: null }, 'weekly-notes-not-claimed'],
      [{ data: null, error: { message: 'function does not exist' } }, 'weekly-notes-claim-failed'],
      [{ data: { slug: 'not-in-the-catalog', step: 99 }, error: null }, 'weekly-notes-unknown-slug'],
    ]) {
      const { net, send } = setup({ rpc: { claim_weekly_note_from: () => answer } });
      expect(await send(WEEKLY)).toEqual({ delivered: 0, skipped });
      expect(net.requests).toHaveLength(0);
    }
  });

  it('leaves lifecycle emails and ordinary notifications as they were, with no scope', async () => {
    const life = setup();
    await life.send({ user_email: 'sam@example.com', type: 'lifecycle_day1', facts: { first_name: 'Sam' } });
    const lifeMail = life.net.requests[0].body;
    expect(lifeMail.headers['List-Unsubscribe']).toBe('<https://project.supabase.co/functions/v1/email-unsubscribe?t=p1.sig>');
    expect(lifeMail.text).toContain(`Unsubscribe from these emails: ${SITE}/Unsubscribe?t=p1.sig\n`);
    expect(lifeMail.html).toContain('>unsubscribe from these emails</a>');
    expect(lifeMail.html).not.toContain('scope=');
    expect(life.db.rpcCalls('claim_weekly_note_from')).toHaveLength(0);

    const note = setup();
    await note.send({ user_email: 'sam@example.com', type: 'new_reply', title: 'New reply', body: 'Bob replied.', url: '/Forum' });
    const mail = note.net.requests[0].body;
    expect(mail.subject).toBe('New reply');
    expect(mail.headers['List-Unsubscribe']).not.toContain('scope=');
    expect(mail.text).not.toContain('Weekly Gecko Notes');
    expect(mail.tags).toEqual([{ name: 'type', value: 'new_reply' }]);
    expect(note.db.rpcCalls('claim_weekly_note_from')).toHaveLength(0);
  });
});

// ---------- email-unsubscribe -------------------------------------------------

function unsubscribe(rpcAnswer = { data: true, error: null }) {
  const db = fakeSupabase((call) => (call.rpc ? rpcAnswer : undefined));
  const fn = loadFunction('email-unsubscribe', { env: ENV, globals: { createClient: () => db.client } });
  return { db, handle: fn.handle };
}

describe('email-unsubscribe and the weekly scope', () => {
  it('a GET keeps the weekly scope on its way to the page', async () => {
    const { handle } = unsubscribe();
    const res = await handle(new Request('https://x.test/email-unsubscribe?t=p1.sig&scope=weekly'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${SITE}/Unsubscribe?t=p1.sig&scope=weekly`);
    const plain = await handle(new Request('https://x.test/email-unsubscribe?t=p1.sig'));
    expect(plain.headers.get('location')).toBe(`${SITE}/Unsubscribe?t=p1.sig`);
    const other = await handle(new Request('https://x.test/email-unsubscribe?t=p1.sig&scope=everything'));
    expect(other.headers.get('location')).toBe(`${SITE}/Unsubscribe?t=p1.sig`);
  });

  it('a one-click POST with scope=weekly stops only Weekly Gecko Notes', async () => {
    const { db, handle } = unsubscribe();
    const res = await handle(new Request('https://x.test/email-unsubscribe?t=p1.sig&scope=weekly', { method: 'POST', body: 'List-Unsubscribe=One-Click' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('You will not get Weekly Gecko Notes any more. Reminders and other email you chose still arrive.');
    expect(db.calls.map((c) => c.rpc)).toEqual(['unsubscribe_weekly_notes_by_token']);
    expect(db.calls[0].args).toEqual({ p_token: 'p1.sig' });
  });

  it('a POST with no scope, or any other scope, stops all email as before', async () => {
    for (const query of ['?t=p1.sig', '?t=p1.sig&scope=all', '?t=p1.sig&scope=WEEKLY']) {
      const { db, handle } = unsubscribe();
      const res = await handle(new Request(`https://x.test/email-unsubscribe${query}`, { method: 'POST', body: 'List-Unsubscribe=One-Click' }));
      expect(await res.text()).toBe('You are unsubscribed from Geck Inspect notification emails.');
      expect(db.calls.map((c) => c.rpc)).toEqual(['unsubscribe_email_by_token']);
    }
  });

  it('an invalid token is refused for the weekly scope too', async () => {
    const { handle } = unsubscribe({ data: false, error: null });
    const res = await handle(new Request('https://x.test/email-unsubscribe?t=bad&scope=weekly', { method: 'POST' }));
    expect(res.status).toBe(400);
  });
});
