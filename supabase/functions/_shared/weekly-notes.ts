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
// Keep the import below on one line: the edge function test harness drops
// single-line imports and hands this module in as globals.
import { WEEKLY_NOTES } from "./weekly-notes.generated.ts";

export const WEEKLY_NOTES_TYPE = "weekly_notes";

// The footer line that says why this email came.
export const WEEKLY_NOTES_REASON =
  "You are getting Weekly Gecko Notes, one short email a week, because you have a Geck Inspect account.";

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

// The email for one slug, or null for a slug the catalog does not have. A
// member with no gecko gets the note's no-gecko button when it has one.
export function weeklyNoteEmail(
  slug: string,
  { hasGecko }: { hasGecko: boolean } = { hasGecko: true },
): WeeklyNoteEmail | null {
  const note = WEEKLY_NOTES.find((n) => n.slug === slug);
  if (!note) return null;
  const noGecko = hasGecko === false && Boolean(note.pathNoGecko && note.ctaNoGecko);
  return {
    title: note.subject,
    body: note.body,
    url: noGecko ? (note.pathNoGecko as string) : note.path,
    cta: noGecko ? (note.ctaNoGecko as string) : note.cta,
  };
}
