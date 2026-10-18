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
  // Subject line and heading.
  title: string;
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
export function weeklyNoteVisitorSlugs(): string[] {
  return [...WEEKLY_NOTES].filter((note) => note.visitors).sort((a, b) => a.step - b.step).map((note) => note.slug);
}

// The catalog step of each note in weeklyNoteVisitorSlugs(), in the same
// order, so a visitor's ledger row records the same step a member's would.
export function weeklyNoteVisitorSteps(): number[] {
  return [...WEEKLY_NOTES].filter((note) => note.visitors).sort((a, b) => a.step - b.step).map((note) => note.step);
}

// The email for one slug, or null for a slug the catalog does not have. A
// member with no gecko gets the note's no-gecko button when it has one. A
// visitor gets the visitor button (or the note's own, which then works
// signed out), and null for a members-only note.
export function weeklyNoteEmail(
  slug: string,
  { hasGecko, visitor = false }: { hasGecko: boolean; visitor?: boolean } = { hasGecko: true },
): WeeklyNoteEmail | null {
  const note = WEEKLY_NOTES.find((n) => n.slug === slug);
  if (!note) return null;
  if (visitor) {
    if (!note.visitors) return null;
    return {
      title: note.subject,
      body: note.body,
      url: note.visitorPath ?? note.path,
      cta: note.visitorCta ?? note.cta,
    };
  }
  const noGecko = hasGecko === false && Boolean(note.pathNoGecko && note.ctaNoGecko);
  return {
    title: note.subject,
    body: note.body,
    url: noGecko ? (note.pathNoGecko as string) : note.path,
    cta: noGecko ? (note.ctaNoGecko as string) : note.cta,
  };
}
