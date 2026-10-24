// Weekly Gecko Notes: one short email a week after a member's first two
// weeks, in order, for as long as they stay subscribed.
//
// The words live in content/weekly-notes (one file per note) and reach this
// function through weekly-notes.generated.ts, which pnpm build:weekly-notes
// writes. Adding a note is a content change only: every merge redeploys
// send-email with the new catalog. docs/planning/weekly-notes-2026-10.md has
// the whole design.
//
// send-email asks the database to claim the next note for a member
// (claim_weekly_note), passing weeklyNoteSlugs() in step order, and builds
// the email for the slug it gets back with weeklyNoteEmail().
//
// Visitors without an account (the sign-up form on the public guide pages,
// confirmed by email) get the same notes through claim_weekly_note_subscriber,
// in the order weeklyNoteVisitorSlugs() gives: every note except the ones
// marked "visitors: no", with each note's visitor button, which always
// opens a page that works signed out.
//
// Keep the import below on one line: the edge function test harness drops
// single-line imports and hands this module in as globals.
import { WEEKLY_NOTES } from "./weekly-notes.generated.ts";

export const WEEKLY_NOTES_TYPE = "weekly_notes";

// The footer line that says what this email is and why it came. The notes'
// buttons point at Geck Inspect features, so they are treated as commercial
// email. US law (CAN-SPAM, 15 U.S.C. 7704(a)(5)) then wants three things:
// a clear statement that the email is promotional (unless the member gave
// prior affirmative consent, which the default-on switch is not), a way to
// stop it, and a postal address. This line is the first; the stop link and
// EMAIL_POSTAL_ADDRESS are the others. Whether the statement can go is
// Tennyson's call (docs/planning/weekly-notes-2026-10.md, section 1).
export const WEEKLY_NOTES_REASON =
  "Weekly Gecko Notes are promotional emails from Geck Inspect, one short tip a week. You are getting them because you have a Geck Inspect account.";

// The visitor's footer line. A visitor confirmed the sign-up by email,
// which is prior affirmative consent, but the line says the same plain
// thing members read, and names where they signed up (a guide page or the
// /WeeklyNotes page, both on the website).
export const WEEKLY_NOTES_VISITOR_REASON =
  "Weekly Gecko Notes are promotional emails from Geck Inspect, one short tip a week. You are getting them because you signed up for them on the Geck Inspect website.";

// The footer link's words. The link stops only these emails.
export const WEEKLY_NOTES_STOP_WORDS = "stop Weekly Gecko Notes";

export type WeeklyNoteEmail = {
  // Subject line.
  title: string;
  // The line the inbox shows after the subject.
  preheader: string;
  // Plain text, paragraphs separated by a blank line.
  body: string;
  // In-app path for the button.
  url: string;
  // The button's words.
  cta: string;
};

export function isWeeklyNotesType(type: string): boolean {
  return type === WEEKLY_NOTES_TYPE;
}

// Every slug, in step order. The database picks the first one the member
// has not had, so this order is the order members receive them.
export function weeklyNoteSlugs(): string[] {
  return [...WEEKLY_NOTES].sort((a, b) => a.step - b.step).map((note) => note.slug);
}

// The visitor order: every note visitors may get, in step order. A visitor
// who later makes an account carries on through weeklyNoteSlugs(), and the
// shared ledger skips the notes they already had.
export function weeklyNoteVisitorSlugs(month?: number): string[] {
  return visitorNotes(month).map((note) => note.slug);
}

// A visitor's notes in step order: every note marked for visitors that is
// in season (when a month is given). The audience does not apply: a
// visitor has no record to read.
function visitorNotes(month?: number) {
  return [...WEEKLY_NOTES]
    .filter((note) => note.visitors && inSeason(note, month))
    .sort((a, b) => a.step - b.step);
}

// Months are UTC calendar months, read as the northern hemisphere's
// seasons, where nearly every member lives. No month given: every note.
function inSeason(note: { months: readonly number[] | null }, month?: number): boolean {
  if (!month || !note.months) return true;
  return note.months.includes(month);
}

// The catalog step of each note in weeklyNoteVisitorSlugs(), in the same
// order, so a visitor's ledger row records the same step a member's would.
export function weeklyNoteVisitorSteps(month?: number): number[] {
  return visitorNotes(month).map((note) => note.step);
}

// What weekly_note_facts returns for a member: their record, read to pick
// the notes that fit and to fill a note's lead.
export type WeeklyNoteFacts = {
  gecko_count?: number | null;
  // The gecko waiting longest for a weigh-in (never weighed first).
  stale?: { id?: string | null; name?: string | null; last_weight_grams?: number | string | null; last_weight_date?: string | null } | null;
  // A female, an adult one first.
  female?: { id?: string | null; name?: string | null; adult?: boolean | null } | null;
  // Has a breeding plan, an egg or a clutch on record.
  breeder?: boolean | null;
};

// Does a note's audience fit this member's record?
function fitsMember(audience: string, facts: WeeklyNoteFacts): boolean {
  switch (audience) {
    case "everyone":
      return true;
    case "keepers":
      return Number(facts.gecko_count) > 0;
    case "female":
      return Boolean(facts.female && cleanName(facts.female.name));
    case "adult-female":
      return Boolean(facts.female && facts.female.adult === true && cleanName(facts.female.name));
    case "breeders":
      return facts.breeder === true;
    default:
      return false;
  }
}

// The notes a member may get this month, in step order, with each note's
// catalog step. send-email hands both to claim_weekly_note_from, which
// picks the first one the member has not had. A note left out (out of
// season, or not for this member yet) stays unsent, so it can still come
// later: in its season, or once the member's record fits.
export function weeklyNoteMemberPlan(facts: WeeklyNoteFacts, month?: number): { slugs: string[]; steps: number[] } {
  const notes = [...WEEKLY_NOTES]
    .filter((note) => inSeason(note, month) && fitsMember(note.audience, facts))
    .sort((a, b) => a.step - b.step);
  return { slugs: notes.map((n) => n.slug), steps: notes.map((n) => n.step) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// A gecko's name as members typed it, safe for one line of an email.
function cleanName(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

// The values a lead's placeholders take for this member. A missing value
// is left out, so any lead alternative that needs it is skipped.
function leadValues(facts: WeeklyNoteFacts): Record<string, string> {
  const out: Record<string, string> = {};
  const gecko = cleanName(facts.stale?.name);
  if (gecko) {
    out.gecko = gecko;
    out.gecko_s = possessive(gecko);
    const grams = Number(facts.stale?.last_weight_grams);
    if (Number.isFinite(grams) && grams > 0) out.gecko_weight = `${Math.round(grams * 10) / 10} g`;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(facts.stale?.last_weight_date ?? ""));
    if (m && MONTHS[Number(m[2]) - 1]) out.gecko_weighed = `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
  }
  const female = cleanName(facts.female?.name);
  if (female) {
    out.female = female;
    out.female_s = possessive(female);
  }
  return out;
}

// The first lead alternative whose placeholders all fill, filled in; null
// when none does (the note then starts with its usual first paragraph).
export function weeklyNoteLead(lead: readonly string[], facts: WeeklyNoteFacts | null | undefined): string | null {
  if (!facts || !lead.length) return null;
  const values = leadValues(facts);
  for (const alt of lead) {
    let missing = false;
    const filled = alt.replace(/\{([a-z_]+)\}/g, (_, key: string) => {
      if (!(key in values)) missing = true;
      return values[key] ?? "";
    });
    if (!missing) return filled;
  }
  return null;
}

// The email for one slug, or null for a slug the catalog does not have. A
// member with no gecko gets the note's no-gecko button when it has one. A
// visitor gets the visitor button (or the note's own, which then works
// signed out), and null for a members-only note.
export function weeklyNoteEmail(
  slug: string,
  { hasGecko, visitor = false, facts = null }: { hasGecko: boolean; visitor?: boolean; facts?: WeeklyNoteFacts | null } = { hasGecko: true },
): WeeklyNoteEmail | null {
  const note = WEEKLY_NOTES.find((n) => n.slug === slug);
  if (!note) return null;
  if (visitor) {
    if (!note.visitors) return null;
    return {
      title: note.subject,
      preheader: note.preview,
      body: note.body,
      url: note.visitorPath ?? note.path,
      cta: note.visitorCta ?? note.cta,
    };
  }
  const noGecko = hasGecko === false && Boolean(note.pathNoGecko && note.ctaNoGecko);
  const lead = weeklyNoteLead(note.lead, facts);
  return {
    title: note.subject,
    preheader: note.preview,
    body: lead ? `${lead}\n\n${note.body}` : note.body,
    url: noGecko ? (note.pathNoGecko as string) : note.path,
    cta: noGecko ? (note.ctaNoGecko as string) : note.cta,
  };
}

// The re-permission email: sent once to a member the relevance gate leaves
// out (no gecko on record, no sign-in in 60 days, no recent yes), asking
// whether they still want the notes. The button opens /KeepNotes, which
// asks for one press before recording a yes (mail scanners open links).
// docs/marketing/email-brain.md, section 5.
export const REPERMISSION_TYPE = "weekly_notes_repermission";

export const REPERMISSION_REASON =
  "This is a one-time email from Geck Inspect about Weekly Gecko Notes. You are getting it because the notes are on for your Geck Inspect account.";

export function isRepermissionType(type: string): boolean {
  return type === REPERMISSION_TYPE;
}

export function repermissionEmail(): WeeklyNoteEmail {
  return {
    title: "Still keeping crested geckos?",
    preheader: "One press keeps Weekly Gecko Notes coming. Do nothing and they stop.",
    body: [
      "Hi,",
      "Tennyson here, from Geck Inspect. You have been getting Weekly Gecko Notes, one short crested gecko tip a week. You have not signed in for a couple of months and there is no gecko in your collection yet, so I would rather ask than keep filling your inbox.",
      "If you still want them, press the button below. That is all it takes.",
      "If not, do nothing. The notes stop here, and nothing else about your account changes. Sign in or add a gecko any time and they start again.",
    ].join("\n\n"),
    url: "/KeepNotes",
    cta: "Yes, keep them coming",
  };
}
