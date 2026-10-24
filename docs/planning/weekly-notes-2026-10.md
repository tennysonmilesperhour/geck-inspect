# Weekly Gecko Notes, 18 October 2026

After a member's first two weeks (the five getting-started emails, `lifecycle-emails-2026-10.md`), each member gets **Weekly Gecko Notes**: one short email a week with one practical crested gecko tip and one button, in order, for as long as they stay subscribed. New notes are added over time by a scheduled Claude session, so a member who reaches the end simply waits for the next one.

Everything here is built and tested. **The notes are on.** The migration adds the switch off, and the session that shipped it turned it on right after the deploy (18 October), since Tennyson asked for the notes to run without waiting on him. The postal address (`EMAIL_POSTAL_ADDRESS`) was set on 18 October at about 15:20 UTC, so nothing is left blocking them. The first notes are due from about 22:50 UTC that day: 52 members, 20 a run, as each member's 20-hour wait since the last check runs out (a run that starts a fraction of a second early leaves a group for the next hour).

## 1. What Tennyson needs to do

Tennyson asked for the notes to run without waiting on his approval (18 October), so the 16 notes need no sign-off, and he delegated the legal choice for the EEA and the UK, which is decided below. The `EMAIL_POSTAL_ADDRESS` secret, which US law (CAN-SPAM) expects in commercial email, is set (18 October), so nothing is waiting on him.

1. **The postal address** (done 18 October). It lives in the Supabase dashboard (Edge Functions, Secrets: https://supabase.com/dashboard/project/mmuglfphhwlaluyfyxsp/functions/secrets) as `EMAIL_POSTAL_ADDRESS`, a street address or a registered PO box or mail receiving agency; it is kept out of this public repo. If it is ever emptied, send-email skips every weekly note, and the skip uses up nothing.
2. **The switch** (turned on by the session after the 18 October deploy; to check or to turn it off), in the SQL editor:

   ```sql
   update public.app_settings set value = 'true'::jsonb where key = 'weekly_notes_enabled';
   ```

   This is a switch, not an approval: it can go on before the address is set, and until the address exists each member costs at most one skipped send-email call a day. To see who would be asked about on the next run (it sends nothing):

   ```sql
   select * from public.weekly_notes_candidates();
   ```

   Setting the value back to `false` stops the next run.
3. **After the first merge that only adds a note**, check in the Supabase dashboard (Edge Functions, send-email) that the deployed version moved. That is how a new note goes live (section 6).

The notes themselves can still change at any time: edit a note's body (section 6), never its slug.

### Decided 18 October 2026: how members agree to the notes

Tennyson delegated this call and asked not to wait for his approval. It is reversible (the end of this section), and it is decision 58 in `docs/DECISIONS.md`.

- **In the EEA and the UK the notes are off unless the member turns them on.** Turning them on (the sign-up box or the Settings switch) is the member's consent, which EU and UK law (the ePrivacy rules and PECR) want before marketing email. A browser counts as there when `regionNeedsConsent()` in `src/lib/analyticsConsent.js` is true: Vercel's country cookie says "ask", or the browser's time zone is European. It is the same signal the analytics question uses, and it errs toward asking (a few people outside the EEA and the UK are treated as inside).
- **New members choose at sign-up.** (The box sits inside the email form, under the email and password, so it reads as part of email sign-up; "Continue with Google" above it ignores the box.) The sign-up form has one box, "Send me Weekly Gecko Notes, one short crested gecko tip a week", ticked by default except when the browser is in the EEA or the UK. Its value travels in the sign-up metadata (`weekly_notes_at_signup`), and the database saves it as the member's choice when it makes the profile (`handle_new_auth_user`). When a profile row for the address already existed, the box is saved on the member's first sign-in instead. Google sign-in has no form, so it counts as no choice, and the next rule applies.
- **A member who never chose, signing in from the EEA or the UK, has the notes turned off.** After sign-in the app calls `weekly_notes_region_default(true)` at most once per browser session, in the background. It acts only on the caller's own profile, and only when no choice is recorded. It records no choice itself, so the member can still turn the notes on in Settings.
- **Every explicit choice is recorded with its time**, in `profiles.email_weekly_notes_choice_at` (the database's clock): the sign-up box, the Settings switch and the stop link in every note. The region rule never overrides a member who chose, wherever they are later.
- **Everyone else keeps the default on**, with the one-click stop in every email and the Settings switch. That is what CAN-SPAM allows in the US: email until the member opts out, as long as each email says it is promotional, has a stop link that works and carries a postal address. The weekly footer does all three.
- **What this cannot reach.** The app only learns where a member is when they sign in. An existing member in the EEA or the UK who never signs in again cannot be located, so they keep the default (on, unless they had turned off Platform Announcements or all email when the notes were added), and every note they get carries the one-click stop. Nothing else is done for them.
- **The Privacy Policy** (section 8, updated 18 October) says the sign-up box starts unticked in the EEA and the UK and that, once the app knows a member is there (at sign-up or their next sign-in from there), the notes stay off unless they turn them on; that new members choose at sign-up and that a choice is recorded and never overridden.

To reverse it:

- **Stricter (opt in for everyone).** Turn off every member who never chose, which never turns anyone on: `update public.profiles set email_weekly_notes_enabled = false where email_weekly_notes_choice_at is null;` and make the sign-up box start unticked everywhere (`signupBoxDefault` in `src/lib/weeklyNotesConsent.js`). Keep the "promotional" line in the footer: members who left a ticked box ticked are still on.
- **Looser (drop the region rule).** Remove the call in `src/lib/AuthContext.jsx`. Members it already turned off stay off, because nothing turns the notes on except the member.

## 2. The rules

- **Relevance (since 20 October 2026).** Only members with at least one gecko on record, or who signed in within the last 60 days, are candidates (`20261020230000_email_relevance_and_outcomes.sql`). Their switch is untouched; signing in or adding a gecko makes them eligible again. Why: `docs/marketing/email-brain.md`, section 2.
- **Every note has a `preview:` line** (20 to 100 characters, the grey text after the subject in the inbox), which must add to the subject, not repeat it. The build fails without one.

- **Never twice.** A member never gets the same note twice, and a repeated or overlapping run cannot double-send.
- **Spacing.** At most one weekly note per member in any 7 days, and none while the member is inside the 16-day getting-started window. At most one email of either kind (getting-started or weekly) per member in any 20 hours.
- **Who.** Only members who can sign in (a confirmed, not deleted, not anonymous, not banned account, the same rules as the getting-started emails), with the master email switch on, the Weekly Gecko Notes switch on, and an address that has not bounced or reported spam.
- **The EEA and the UK.** There the notes are off unless the member turned them on: the sign-up box starts unticked, and a member who never chose has the notes turned off when they sign in from there. A recorded choice (the sign-up box, the Settings switch, the stop link) is never overridden (section 1).
- **Stopping.** Every note has its own "stop Weekly Gecko Notes" link and one-click header. It turns off only these emails; reminders and the other emails the member chose keep coming. Settings has a switch for it. Stopping all email (the all-email link in any other email, the stop page's second button, or the master switch in Settings) turns the notes off too. Stopping lasts until the member turns the Weekly Gecko Notes switch back on; turning email back on does not restart them.
- **The stop page asks first.** Opening the stop link shows one button ("Stop Weekly Gecko Notes") and changes nothing until it is pressed, because mail security scanners open every link in an email. The mail app's own one-click Unsubscribe button needs no second click.
- **The law.** No note goes out without a postal address. A note skipped for that reason, or because the member has had every note written so far, does not use up the member's next note. A member who has caught up gets the next note within a day of it being added.

## 3. How it works

Every hour at 50 past, the job `weekly-notes-hourly` runs `enqueue_weekly_notes()`. While the switch is off, its first statement returns and that is all (one lookup an hour). When it is on:

1. It picks the members who may get a note (`weekly_notes_candidates`), oldest last-asked first, at most 20 a run.
2. For each one it writes the time into `weekly_notes_polls` (one row per member) and asks send-email about them. A member is asked at most once in any 20 hours; the poll row is claimed first, so two runs that overlap never ask about the same member twice.
3. **send-email decides**, because only send-email can see two things: the `EMAIL_POSTAL_ADDRESS` secret, and the list of written notes (the catalog bundled with the function). In order, it checks the run marker, the postal address and that the catalog is not empty, then the master switch, that the address can sign in and is not suppressed, and that a signed unsubscribe link can be made. Any of these can skip the email, and none of them writes anything.
4. Then it calls `claim_weekly_note`. Under a lock for that member, the database checks every rule again (both switches, the suppression list, the 16-day window, 7 days since the last note, 20 hours since a getting-started email), picks the first note in the catalog the member has not had, and writes the ledger row in `weekly_notes_sends`, which is unique on the address and the note. The row is stamped with the hourly run's time (the poll row's), not the claim's a few seconds later, so the next note is due at the same minute a week later instead of drifting an hour later every week.
5. Only a claimed note is sent.

What that guarantees:

- No address, no unsubscribe link, or a caught-up member means no ledger row, so the member's next note is never used up.
- The same note can never go twice: the unique key, the lock and the poll claim each prevent it. The lock is per inbox (20261024180000, merged 24 Oct), so two accounts on one inbox (a plus-tag or dotted Gmail test account) cannot claim at the same moment either.
- The hourly job stamps polls and the ledger with its start time, which varies by a fraction of a second. The 7-day and 20-hour rules allow 10 minutes (20261024180000, merged 24 Oct), so the run 7 days or 20 hours later counts even when it starts a moment earlier than the last one did. Before that, about every other week a note slid an hour later.
- The 7-day and 20-hour rules are checked twice, once when choosing candidates and once in the claim.
- A caught-up member, or one skipped for a missing address, is asked about again every 20 to 21 hours. So a newly written note reaches them within a day of the merge that adds it, at a cost of at most one function call per member per day.
- Nothing depends on the order in which the migration, the functions and the site finish deploying.

A Resend failure after the claim leaves that note spent. Never sending a member the same note twice wins over always sending.

The two series never overlap: getting-started emails need an account younger than 16 days and weekly notes need one at least 16 days old, and a weekly note waits 20 hours after any getting-started email (a day 14 email sent late, on day 15).

The limit of 20 a run spreads the first switch-on for the 64 accounts over about four hours and keeps send-email under Resend's rate limit. Raise it (the `p_limit` argument) when eligible members per day pass about 400.

### The pieces

| Piece | Where |
|---|---|
| The switch `weekly_notes_enabled` (false, not public) | `app_settings`, migration `20261018002200_weekly_notes.sql` |
| The member's switch `profiles.email_weekly_notes_enabled` (on for new members, unless they untick the sign-up box) | same migration. Its own column, never part of the Settings form, so the whole-form save (or a stale Settings tab) cannot switch it back on. Existing members who had Platform Announcements or all email off started opted out. The trigger `profiles_weekly_notes_follow_email_off` turns it off whenever all email is switched off. An address with two profile rows (an imported row that differs in case) needs the switch on in both |
| When the member last chose, `profiles.email_weekly_notes_choice_at` (empty means never) | same migration. Written by the sign-up box, the Settings switch and the stop link; the trigger `profiles_weekly_notes_stamp_choice` puts the database's clock on it |
| The sign-up box | `src/components/auth/LoginPortal.jsx` (ticked except in the EEA and the UK), sent as `weekly_notes_at_signup` in the sign-up metadata and saved by `handle_new_auth_user` (restated in the same migration with the two weekly columns) |
| The region rule for the EEA and the UK | `weekly_notes_region_default(p_consent_region)` in the same migration (members may run it, on their own profile only), called once per browser session after sign-in by `src/lib/weeklyNotesConsent.js` from `src/lib/AuthContext.jsx` |
| The ledger `weekly_notes_sends` (id, email, step, slug, created_date) | same migration. Keyed on the slug, so adding or renumbering notes later never re-sends one; `step` records the note's position when it was sent |
| The poll table `weekly_notes_polls` (email, polled_at) | same migration |
| `weekly_notes_candidates`, `claim_weekly_note`, `enqueue_weekly_notes`, `unsubscribe_weekly_notes_by_token` (which also records the choice) | same migration |
| Account deletion erases both tables' rows | `20261018002300_erase_weekly_notes.sql` (the full `admin_erase_account`, two lines added) |
| The send and the claim | `supabase/functions/send-email/index.ts` |
| One-click stop with `&scope=weekly` | `supabase/functions/email-unsubscribe/index.ts` |
| The words | `content/weekly-notes/NNN-slug.md`, one file per note |
| Every slug ever published, and the withdrawn ones | `content/weekly-notes/published-slugs.json`, which only grows (section 6) |
| The catalog send-email ships | `supabase/functions/_shared/weekly-notes.generated.ts`, written by `pnpm build:weekly-notes` |
| The helper send-email calls | `supabase/functions/_shared/weekly-notes.ts` |
| The rules every note follows | `scripts/lib/weekly-notes.mjs` |
| The Settings switch | `src/components/settings/WeeklyNotesSetting.jsx`, saved by `User.setWeeklyNotes` (the switch and the time of the choice) |
| The stop page | `src/pages/Unsubscribe.jsx` with `?scope=weekly` |
| Tests | `src/lib/__tests__/weeklyNotes.test.js`, `supabase/tests/weekly_notes_regressions.sql`, the Unsubscribe and Settings switch tests, `weeklyNotesConsent.test.js`, the sign-up box test, `privacyPolicy.test.js`, and the accepted-facts check in `scripts/check-genetics-consistency.mjs` |

Every note is tagged `weekly_notes` in Resend and in the delivery log, so `email_delivery_stats` has one row per week for the whole series (not one per note), and the admin scoreboard's limits are safe. Per-note counts come from the ledger (section 7).

### What each email looks like

Subject and heading: the note's subject. Then the body, the one button, and the footer send-email adds:

```text
<body>

<button words>: https://geckinspect.com<path>

Weekly Gecko Notes are promotional emails from Geck Inspect, one short tip a week. You are getting them because you have a Geck Inspect account.
Stop Weekly Gecko Notes: https://geckinspect.com/Unsubscribe?t=<token>&scope=weekly
Geck Inspect, <postal address>
```

The HTML version has "Change preferences" (Settings) next to the stop link. A member with no gecko gets the note's no-gecko button when the note has one. The first footer sentence says the email is promotional, which US law wants in commercial email sent without prior affirmative consent (section 1): outside the EEA and the UK the notes are on by default, so that line stays.

## 4. The notes

| Step | Slug | Subject | Button | Button with no gecko |
|---|---|---|---|---|
| 1 | `heat-is-the-bigger-risk` | Heat is the bigger risk for a crested gecko | Open the temperature guide (`/CareGuide/temperature`) | same button |
| 2 | `watch-the-weight-trend` | One weight is a snapshot. The trend is the story. | Open your geckos (`/MyGeckos`) | Add a gecko (`/MyGeckos`) |
| 3 | `today-tells-you-what-is-due` | Check each gecko's weigh-in reminder | Open My Geckos (`/MyGeckos`) | Add a gecko (`/MyGeckos`) |
| 4 | `fresh-cgd-every-feeding` | Fresh CGD, every feeding | Open Today (`/Today`) | Read the CGD basics (`/CareGuide/cgd-basics`) |
| 5 | `shed-rhythm-by-stage` | How often should your gecko shed? | Log a shed (`/FieldMode`) | Read about shedding (`/CareGuide/shedding`) |
| 6 | `humidity-rises-at-night` | Humidity should rise at night and fall by day | Open the humidity guide (`/CareGuide/humidity`) | same button |
| 7 | `is-your-gecko-on-pace` | Is your gecko growing on pace? | Open My Geckos (`/MyGeckos`) | Read about weight tracking (`/CareGuide/weight-tracking`) |
| 8 | `never-pair-two-lilly-whites` | Why you should never pair two Lilly Whites | See the Lilly White pairing (`/calculator/pairing/lilly-white-x-normal`) | same button |
| 9 | `where-66-percent-het-comes-from` | Where "66% possible het" comes from | Run the het x het pairing (`/calculator/pairing/het-axanthic-x-het-axanthic`) | same button |
| 10 | `fire-it-up-before-the-photo` | Fire it up before you take the photo | Try Morph ID (`/Recognition`) | same button |
| 11 | `reading-het-labels` | What "100% het" and "possible het" really mean | Open your family trees (`/Lineage`) | Open the Genetics Guide (`/GeneticsGuide`) |
| 12 | `forty-grams-and-eighteen-months` | 40 g and 18 months: both, not either | Check your females (`/MyGeckos`) | Read about breeding readiness (`/CareGuide/breeding-readiness`) |
| 13 | `a-lay-box-for-every-female` | Every adult female needs a lay box | Open Breeding (`/Breeding`) | Read about egg laying (`/CareGuide/egg-laying`) |
| 14 | `pick-an-incubation-temperature` | Pick an incubation temperature, get a hatch window | Open Breeding (`/Breeding`) | Read about incubation (`/CareGuide/incubation`) |
| 15 | `a-passport-before-it-leaves` | Give your gecko a passport before it leaves | Make a passport (`/MyGeckos`) | Read about hatchling records (`/CareGuide/hatching-and-record-keeping`) |
| 16 | `start-from-the-gecko-you-want` | Start from the gecko you want | Plan backward (`/calculator/reverse`) | same button |

The text is the copy from the workflow brief of 18 October, word for word. Tennyson asked for the notes to go out without waiting on his approval (section 1); any note can still be reworded by editing its body (section 6). Three changes were forced by the tests:

- Note 14's button opened `/Breeding?tab=hatchery`. Buttons may not carry a query string (the link rules in section 8), so it opens `/Breeding` and says "Open Breeding" instead of "Open the Hatchery". The body already tells the member to pick the Hatchery tab.
- Notes 9 and 11 cited `src/data/keepers-guides/morph.js` lines 269 to 271 (and 270) as a source. Those lines are the "50% het, coin flip (visual x het)" badge on the do-not-use list, so the citation was dropped. The words of both notes did not change; the glossary lines they also cite support them.
- The preheaders in the brief are not used: the format has no field for them, and send-email does not send one.

## 5. Editorial guardrails (for whoever writes the notes)

**Which source wins.** Facts come from `src/data/husbandry-facts.js` and `scripts/lib/accepted-facts.mjs` first, then `src/data/care-guide.js`, then `src/data/morph-guide.js` for genetics. Where the Keeper's Guides disagree with those, leave the number out. When in doubt, leave the fact out.

**Never use:**

- `keepers-guides/morph.js:187`, which says het x het Axanthic gives 50% visuals (wrong)
- `keepers-guides/morph.js:150`, which calls Phantom polygenic
- `keepers-guides/morph.js:266-271`, the "50% het, coin flip (visual x het)" badge (wrong)
- `genetics-sections.jsx:516-517`, "none are expected to hatch" (use the accepted Super Lilly White fact instead)
- the Handbook's sexing accuracy figures
- the 30 to 50% figures, and any price, startup cost or market tier
- "cannot be sold on MorphMarket"
- named breeders used as evidence
- UVB bulb names, distances or hours
- cooling temperatures
- conflicting handling session lengths
- the humidity figures 60 to 80% or 40 to 50%
- quarantine of 60 or more days
- a hatchling's first meal at 72 hours
- the old getting-started line that a 1 g scale is fine (the day 0 email now says 0.1 g)

The source lines on this list are in `DO_NOT_CITE` in `scripts/lib/weekly-notes.mjs`; a note that cites one fails the tests.

**Pattern traits.** Harlequin, Pinstripe, Dalmatian and Tiger are single genes in the engine. Describe what you see, or credit Foundation Genetics if you call one polygenic. Never write "not proven" or "line-bred" in a sentence that names a modeled trait unless it also gives the engine's model (the genetics check enforces this).

**Seasons.** Write "when your room warms up" or "when your house cools", never a month or a season, because every member starts at note 1 on a different date.

**Writing rules**: no em dash, no en dash, nothing that looks like a dash (a minus sign, a horizontal bar), no "--", no " - " and no "1-2" style ranges (write "1 to 2"); plain language and short sentences; crested gecko terms used precisely (Lilly White, Harlequin, Phantom, Cappuccino, Axanthic, Sable, Highway, Dalmatian, Pinstripe); never an invented statistic, study, quote, price, member count or personal story, and no first person ("I", "we", "our"); never call a note an article, a blog post or a newsletter issue, and never link the blog (blog work is shelved); never mention a retired feature or page (Promote, the AI Consultant, Other Reptiles, the supplies store, the website builder, the Morph Visualizer, and the older retired pages in `src/lib/retiredPages.js`, such as Community Connect, Shipping and the Training Center); no CGD brand or marketplace names; percentages only from 5, 10, 25, 50, 66, 70, 80 and 100, and never as "N% of" something; husbandry numbers (the 82°F heat line, the 80°F incubation maximum, the weigh-in gaps) exactly as in `src/data/husbandry-facts.js`.

The tests (`WRITING_RULES` in `scripts/lib/weekly-notes.mjs`, and the accepted facts) catch the common form of each rule, such as "50% of", "researchers found", "costs 300 bucks", "as one breeder put it" or "60 Geck Inspect members". They cannot catch every wording, so whoever writes or reviews a note still reads it against this list.

**Reserve topics** (ideas for the next notes, each with its source and the trap to avoid):

| Topic | Point it at | Watch out for |
|---|---|---|
| Tail loss: a crested gecko's tail does not grow back | `/CareGuide/tail-loss` | handling session lengths |
| A new gecko's first weeks: keep it apart, watch it eat | `/CareGuide/acclimation`, `/CareGuide/quarantine` | quarantine of 60 or more days |
| Picky eaters: what to check before you worry | `/CareGuide/picky-eaters` | brand names |
| Firing up and down as a health signal, not a morph | `/CareGuide/firing-up` | it repeats note 10; make it about health |
| Harlequin and Pinstripe: read the pattern you see | `/MorphGuide/harlequin`, `/MorphGuide/pinstripe` | the dual-model rule |
| Phantom is recessive: what a het can and cannot show | `/MorphGuide/phantom` | `morph.js:150` |
| Cappuccino and Sable: why breeders pair them, and Luwak | `/calculator/pairing/cappuccino-x-sable` | Super Cappuccino is not lethal but has documented health problems |
| Dalmatian spots: count them on the record photo | `/MorphGuide/dalmatian` | "line-bred" without the engine model |
| Hatchling care: the first weigh-in and the first sheds | `/CareGuide/hatchling-care` | a first meal at 72 hours |
| Senior geckos: what changes after 10 years | `/CareGuide/senior-care` | lifespan claims beyond husbandry-facts |
| Enclosure size by life stage | `/CareGuide/enclosure-size` | prices and product names |
| Vet visits and follow-ups on the record | `/MyGeckos` | none |
| Importing a spreadsheet of an existing collection | `/MyGeckos` | marketplace names |

## 6. Adding a note (for the scheduled session)

**Who does it.** A standing Claude session, "Weekly Gecko Notes writer" (`session_01YR1zwTcYBhRJEVBMhn1QG4`), is woken every Thursday at 15:49 UTC by the routine of the same name (`trig_01WiuAnCp2EWqc5VYotHKSBt`, set up 18 October 2026; first run 22 October). Each wake it works out whether a note is needed by the rule below, writes and checks at most two, and pushes to main. With 16 notes written, the first new one is due about week 8 (mid December). To pause it, disable the routine in Claude's routines list; to change what it does, edit the routine's prompt or message the session.

1. Read this document, including the do-not-use list in section 5.
2. Write `content/weekly-notes/<next NNN>-<slug>.md` in the format below, with its sources.
3. Run `pnpm build:weekly-notes`, then `pnpm vitest run src/lib/__tests__/weeklyNotes.test.js`, `node scripts/check-genetics-consistency.mjs` and `pnpm test`. The build also adds the new slug to `content/weekly-notes/published-slugs.json`; commit that file with the note.
4. Commit to `main`. The merge redeploys send-email with the new catalog (every merge deploys every declared function), and members who were caught up get the new note within a day.

Rules for the session:

- **Keep at least 8 written notes ahead of the number of weeks since launch.** Launch is the day the switch was turned on, **18 October 2026** (02:40 UTC); no member can be further along than one note a week since then, so this keeps every member at least 8 notes from the end. The query in section 7 gives both numbers.
- **Keep at least four unsent notes ahead of the furthest member** (the second query in section 7). If the first rule holds, this one does too.
- **Never rename or reuse a published slug.** The ledger is keyed on the slug, so a renamed note is a new note and goes again to everyone who had it. This is checked, not just asked: `published-slugs.json` lists every slug ever built, and the build and the tests fail when a listed slug has no note (a rename), when a slug is taken out of that file (checked against every committed version git can see), or when a withdrawn slug comes back.
- **Fix wording by editing the body.** The slug stays.
- **To withdraw a note, delete its file, renumber the rest** (the file names and the `step` lines) **and add its slug to `withdrawn`** in `published-slugs.json` (it stays under `published` too). Renumbering never re-sends anything, because the ledger is keyed on the slug. A withdrawn slug can never be used again: members who had the old note would never get the new one.
- A note inserted earlier in the order is sent next to anyone who has not had it, before the later notes they have not had.

### The file format

One UTF-8 file per note with LF line endings, at `content/weekly-notes/NNN-slug.md`. NNN is the step, zero-padded to three digits; the slug is lowercase words joined by single hyphens, at most 64 characters.

The file has two parts: a front matter block between two lines that are exactly `---`, then the body.

Front matter: one `key: value` per line. Everything after the first `: ` is the value, taken literally with no quotes. Only these keys:

- `step` (required): an integer equal to NNN. Steps run 1 to N with no gaps.
- `slug` (required): the file name after `NNN-`. Never renamed once published.
- `subject` (required): the subject line, 1 to 60 characters. Say what is inside, with a number or a crested gecko term where it fits (clear beats clever; `docs/marketing/email-brain.md`).
- `preview` (required, since 20 October 2026): the grey line the inbox shows after the subject, 20 to 100 characters. It adds to the subject (the useful number, the payoff) and never repeats it.
- `lead` (optional, since 24 October 2026): an opening sentence or two from the member's record, put before the body. Placeholders: `{gecko}` and `{gecko_s}` (the gecko waiting longest for a weigh-in, and its possessive), `{gecko_weight}` and `{gecko_weighed}` (its last weight and date), `{female}` and `{female_s}` (a female, an adult one first). Give alternatives separated by ` || `; send-email uses the first one whose placeholders all fill, or none. Filled with sample values, each must pass the writing rules and run 20 to 200 characters. Members only.
- `audience` (optional): `everyone` (the default), `keepers` (a gecko on record), `female`, `adult-female` (35 g or 18 months) or `breeders` (a breeding plan, an egg or a clutch). Members whose record does not fit skip the note until it does. Visitors are not affected.
- `months` (optional): the months the note may go in, `5` or a run such as `5-9` or `11-2` (UTC, northern hemisphere seasons). Out of season, the note waits; members and visitors get the next note instead.
- `cta` (required): the button words, 1 to 40 characters.
- `path` (required): an in-app path from the live pages, starting with a single `/`. Not `/log`, not a bare `/Pedigree` or `/GeckoDetail`, not `/blog`, not a retired page, not an admin or internal page (`NOT_FOR_NOTES` in `scripts/lib/weekly-notes.mjs`: the Admin panel, Image Import, Training, the sign-in page, a bare forum post or profile, the marketplace export), no query string. A `#anchor` only on `/Settings`, and only one that exists there.
- `cta_no_gecko` and `path_no_gecko` (optional, both or neither): the button for members with no gecko in their collection.
- `sources` (required): `; `-separated `file:line` or `file:start-end` references to the repo lines behind every fact in the note. For reviewers and the scheduled writer; never sent.

Body: plain text paragraphs separated by one blank line; lines inside a paragraph are joined with a space. 80 to 200 words. No greeting and no sign-off (send-email signs it "Tennyson"), no links, URLs or paths, no markdown or HTML characters (# * _ ` [ ] < >). Each note makes one practical point and asks for one action, which matches the button. send-email escapes the body, turns line breaks into line breaks in the HTML, and adds the button and the footer.

Example, `content/weekly-notes/001-heat-is-the-bigger-risk.md`:

```text
---
step: 1
slug: heat-is-the-bigger-risk
subject: 82°F: the heat line for a crested gecko
preview: Days of 72 to 78°F, nights a little cooler. Most homes never need extra heat.
cta: Open the temperature guide
path: /CareGuide/temperature
sources: src/data/husbandry-facts.js:67-75; src/data/care-guide.js:240-266
---
Crested geckos do best at room temperature. Days of 72 to 78°F suit them, with
a slight drop at night to 65 to 72°F.

The number to remember is 82°F. ...
```

## 7. Reading the numbers (read-only queries)

What each note made members do (came back to the app, recorded something, turned the notes off), the number that counts (`docs/marketing/email-brain.md`, section 4):

```sql
select * from public.email_outcomes(60) where kind like 'weekly%';
```

Delivery, opens and clicks for the whole series, by week (the same view the admin scoreboard reads; empty until Resend's webhook is connected):

```sql
select * from public.email_delivery_stats where email_type = 'weekly_notes' order by week desc;
```

Notes sent per step:

```sql
select step, slug, count(*) as sent, min(created_date)::date as first_sent, max(created_date)::date as last_sent
  from public.weekly_notes_sends
 group by step, slug
 order by step, slug;
```

How many members are within two notes of the end, the furthest member, and weeks since launch. Set `written` to the number of files in `content/weekly-notes`:

```sql
with catalog as (select 16 as written),
     per_member as (select email, count(*) as had from public.weekly_notes_sends group by email)
select count(*) filter (where p.had >= c.written - 2) as within_two_of_end,
       count(*) as members_with_a_note,
       coalesce(max(p.had), 0) as furthest_member,
       c.written - coalesce(max(p.had), 0) as unsent_ahead_of_furthest,
       (select ceil(extract(epoch from now() - min(created_date)) / 604800)::int
          from public.weekly_notes_sends) as weeks_since_launch
  from per_member p cross join catalog c
 group by c.written;
```

Who has stopped the notes, and who is still asked about:

```sql
select count(*) filter (where email_weekly_notes_enabled) as on,
       count(*) filter (where not email_weekly_notes_enabled) as off
  from public.profiles;
```

Who chose (the sign-up box, the Settings switch or the stop link), and who is off without a choice (the region rule for the EEA and the UK, or all email off):

```sql
select count(*) filter (where email_weekly_notes_choice_at is not null and email_weekly_notes_enabled) as chose_on,
       count(*) filter (where email_weekly_notes_choice_at is not null and not email_weekly_notes_enabled) as chose_off,
       count(*) filter (where email_weekly_notes_choice_at is null and not email_weekly_notes_enabled) as off_without_a_choice,
       count(*) filter (where email_weekly_notes_choice_at is null and email_weekly_notes_enabled) as on_by_default
  from public.profiles;
```

Who was asked about in the last day:

```sql
select count(*) as asked_in_the_last_day
  from public.weekly_notes_polls where polled_at > now() - interval '1 day';
```

A member asked about with no new ledger row was skipped by send-email (no postal address, caught up, a failed check, or not eligible any more). The reason is in the send-email function logs as `skipped: "weekly-notes-..."`: `weekly-notes-no-postal-address`, `weekly-notes-caught-up`, `weekly-notes-not-eligible`, `weekly-notes-no-token`, `weekly-notes-check-failed`, `weekly-notes-claim-failed`.

## 8. The tests

- `src/lib/__tests__/weeklyNotes.test.js`: the generated catalog is not stale; numbering, unique slugs and subjects; the published-slugs list (a rename, a removal and a reused withdrawn slug each fail); lengths; every writing rule, each shown catching its mistake, and the ordinary words next to them left alone; every button opens a live member page (and `/blog`, retired pages, admin pages, `/log`, `/Pedigree` and query strings are refused); every source points at real lines and none at the do-not-use list; send-email end to end (the payload's words ignored, every skip before the claim, the footer, the scoped links and headers, the tag); email-unsubscribe's weekly scope.
- `supabase/tests/weekly_notes_regressions.sql`: eligibility and each boundary, the job, the claim, the run's time on the ledger row, an address with two profile rows, never twice, the drip-only unsubscribe (and the choice it records), stopping all email stopping the notes for good, a member's own switch, the defaults and the one-time backfill, the two series never overlapping, erasure, permissions, and the delivery numbers. Block 12b covers the EEA and UK decision: the sign-up box saved with the profile (and on the first sign-in when the profile existed first), Google sign-in as no choice, the region rule turning off only a member with no choice, never another member and never after the sign-up box, the Settings switch or the stop link, and the database's clock on every choice. It also runs the migration file a second time.
- `src/lib/__tests__/weeklyNotesConsent.test.js`: the sign-up box's default by region, the metadata key the database reads, and the region rule's call (once per browser session, never after a choice, never outside the region, waits for the column, never rejects). `src/components/auth/__tests__/LoginPortal.weeklyNotes.test.jsx`: the box on the sign-up form, ticked or not by region, and its value in the sign-up metadata. `AuthContext.test.jsx`: the rule runs after sign-in with the loaded profile.
- `scripts/check-genetics-consistency.mjs` checks every note's subject, buttons and paragraphs against the accepted facts (genetics and the husbandry numbers) and the dual-model rule; `src/lib/__tests__/husbandryFacts.test.js` holds the notes to the one heat danger line.
- `src/pages/__tests__/Unsubscribe.test.jsx`: opening a stop link changes nothing until a button is pressed.
- `src/lib/__tests__/privacyPolicy.test.js` holds the Privacy Policy to the two tables' columns, the choice column, and the EEA and UK wording (off unless turned on, a choice at sign-up, never overridden).

## 9. Visitors without an account (added 18 October 2026)

Tennyson asked for an email capture for people who have not signed up, feeding the same drip. It is live with the same switch and the same postal address gate as the member notes: the postal address is set (18 October), so a confirmed visitor gets the first note at the next hourly run.

**Where the form is.** Under the account prompt at the end of the public guide pages: the Morph Guide (the grid, each morph page's end panel and the hub pages), the Care Guide and its topic pages, the Genetics Guide and the calculator. Each morph page shows it once, at the end (the mid-page prompt passes `notes={false}`). It loads only when the prompt first comes into view, so it adds nothing to those pages' first download (the size check counts only what loads up front). It is not on the homepage while the A/B test runs (`docs/planning/homepage-ab-test-2026-10.md`); add it to the winning page afterwards. There is also a page of its own, `/WeeklyNotes` (not indexed), which is a good link for a bio or a post. Signed-in members see neither form; their notes come with the account.

**How a visitor joins (double opt-in).**

1. The form posts the address to `subscribe-weekly-notes`. The database step `request_weekly_notes_signup()` applies the limits first (2 requests per inbox a day, where plus tags and Gmail dots count as one inbox through `email_inbox_key()`; 10 per network an hour, counted by a keyed hash of the IP). Then it sends nothing at all to an inbox that bounced or marked our email as spam, or to the inbox of a member (an account that can sign in) who turned all email off, whichever spelling was typed (status quiet, logged and counted like any other request, so the replies cannot tell it apart). Suppressions are matched by `email_inbox_suppressed()`: the exact address, the address without its plus tag, every spelling of an inbox that marked our email as spam, and for Gmail every spelling of the inbox. A bounce on a plus-tag address outside Gmail does not silence the plain one, because some providers (Yahoo, for one) refuse plus tags; a spam report proves the mail arrived, so it does. The visitor candidates, the homepage guide form and, through `email_is_suppressed`, send-email's check before every member email use the same match. The guide form's one-a-day limit also counts the inbox (`guide_email_sends.inbox_key`). An inbox with an account that can sign in is a member whichever spelling is typed (the form and the confirm button answer "member", and visitor candidates leave it out), and a second spelling of an inbox that already gets the notes is answered "already", so one inbox never gets two series. Otherwise it makes a confirmation link; only the link's sha256 is stored. Addresses with characters a real one does not need (angle brackets, quotes, commas, spaces) are refused; international domains are fine.
2. The visitor gets "Confirm your Weekly Gecko Notes". The button opens `/WeeklyNotes?t=...`, which asks them to press one more button (mail scanners open every link, so opening it changes nothing). That press runs `confirm_weekly_notes_signup(p_token)` with the database's clock and sets `confirmed_at`. Links last 7 days and only the newest works. A row confirmed before the form existed is not trusted: its first notes request clears that, so only the new link confirms.
3. An address already confirmed gets "You already get Weekly Gecko Notes"; an address with an account gets "Weekly Gecko Notes and your Geck Inspect account" (the switch is in Settings). The form's reply is the same for all three, so it cannot be used to learn who has an account.

Double opt-in is the consent EU and UK law want before marketing email, so visitors get the same treatment wherever they are, and it keeps typos and strangers' addresses off the list.

**What a visitor gets.** The same notes in the same order, minus the ones marked `visitors: no` (today only note 3, which is about the Today screen). A note whose button opens a page that needs an account has a visitor button instead (`visitor_cta` and `visitor_path` in the note file), always a page that works signed out: a Care Guide topic, the Genetics Guide, the calculator, Morph ID or the pedigree tracker page. `pnpm build:weekly-notes` refuses a note that breaks this (section 6). The footer says "You are getting them because you asked for them on a Geck Inspect guide page", carries the postal address and one link, "Stop Weekly Gecko Notes", with no Settings link (`&scope=visitor`; the one-click header works the same way).

**Rules.** The same spacing as members: at most one note in 7 days, asked about at most once in 20 hours, never a note twice. The hourly job asks about members first, then confirmed visitors, within the same 20 a run. The ledger (`weekly_notes_sends`) is shared and keyed on the address, and a visitor row records the note's catalog step, so a visitor who later makes an account continues as a member after their getting-started fortnight, without repeats. While an address has an account that can sign in it is never treated as a visitor (a half-finished sign-up does not count).

**Stopping and erasing.** The stop link (`unsubscribe_weekly_notes_subscriber`, signed with its own prefix so its token can never pass as a member's) stops the weekly notes to every spelling of that inbox and kills every pending confirmation link for it (it takes the form's per-inbox lock). If the inbox has an account, it also turns off the member's Weekly Gecko Notes switch and records that as their choice. What counts as a visitor stop is one function, `weekly_notes_visitor_stop_at()`: the newest stop on any spelling of the inbox, counted only when it came after that row asked for the notes (an older unsubscribe is not a stop of these notes) and only when no spelling of the inbox confirmed a new sign-up after it. A new profile for an inbox with such a stop starts with the notes off, whatever the sign-up box said, and the stop is recorded as the member's choice, dated when they pressed it (the trigger `profiles_weekly_notes_visitor_stop`). The box is ticked by default outside the EEA and the UK, so leaving it is not a new choice; in the EEA and the UK, where it starts unticked, a tick at sign-up does not undo the stop either (we err toward the stop, and the Settings switch turns them on). Recording a choice matters: on the first sign-in the app runs `weekly_notes_region_default`, which saves the sign-up box when no choice is recorded, so a stop with no choice would have been undone there (found in the third review). The stop link records the choice on a profile that was already off with no choice too, and `weekly_notes_region_default` checks for a stop itself before saving the box (the fourth review). Settings shows them off. The member rules also skip an address whose visitor stop is newer than the member's last choice. Turning the notes on in Settings afterwards is the member's own newer choice, and they come again. The row is kept with its stop date and the ledger, so the address is never mailed again by mistake. The ledger counts the whole inbox too: neither claim sends a note that any spelling of the inbox already had, and the 7-day rule counts every spelling, so moving between spellings (signing up again under another one, or joining as a member under another one) repeats nothing. Visitor candidates pick one spelling per inbox (the first confirmed), and the confirm button takes the same per-inbox lock as the form, so one inbox gets one series. "Already signed up" means a spelling that gets the notes now (`weekly_notes_inbox_signed_up`): one that bounced, or one held back by a newer stop, never locks the inbox out. An unconfirmed request is dropped 30 days after its newest link, and the form's send log and the homepage guide form's log are kept 30 days (`weekly-notes-visitor-cleanup`, daily). A deletion request from a visitor: `select public.admin_erase_weekly_notes_visitor('name@example.com');` in the SQL editor. It erases every spelling of the inbox and scrubs every spelling from the email delivery log; it refuses an inbox with an account that can sign in on any spelling, because account deletion (`admin_erase_account`) then erases the visitor rows, ledger, polls, form logs and delivery log for every spelling of the inbox, so no visitor series can start again once the account is gone. When another account that can sign in remains on the inbox (a duplicate or test account was deleted), account deletion erases only the deleted account's own address, so the remaining member keeps its ledger and gets no repeats (20261024180000, merged 24 Oct). A spelling that never confirmed only loses its link when the inbox stops, so the daily cleanup still deletes it 30 days after its last link.

**The guide PDF form on the homepage** is separate. People who asked only for the PDFs are not on the notes list: their row has no notes request, and asking for the guides never counted as asking for weekly email. They can sign up for the notes on any guide page like anyone else.

**The review of 18 October.** An independent review (five reviewers, each finding checked by two skeptics) found the stop gap above, the plus-tag limit dodge, mail to suppressed addresses, a caller-chosen clock on the confirm button, a cleanup that could kill a fresh link, an overstated Privacy Policy line, a form that could crash a guide page if its file failed to load, and a few smaller things. All are fixed in `20261018150000_weekly_notes_visitor_fixes.sql` and the matching code, each with a test.

**Security fix in the same change.** Until 18 October anyone could insert rows into `newsletter_subscribers` with the public key (an old "anyone can subscribe" policy). No app code used it, but it would have let a script add strangers to the list already marked confirmed. The table is now closed to the public API; only the two form functions (service role) and the database functions write to it, and admins can read it.

**Numbers** (read-only):

```sql
-- Sign-ups, confirmations and stops
select count(*) filter (where weekly_notes_requested_at is not null) as asked,
       count(*) filter (where confirmed_at is not null and weekly_notes_requested_at is not null) as confirmed,
       count(*) filter (where unsubscribed_at is not null and weekly_notes_requested_at is not null) as stopped
  from public.newsletter_subscribers;

-- Which pages the sign-ups came from
select weekly_notes_source, count(*), count(*) filter (where confirmed_at is not null) as confirmed
  from public.newsletter_subscribers where weekly_notes_requested_at is not null
 group by 1 order by 2 desc;

-- Visitors due on the next run
select * from public.weekly_notes_subscriber_candidates();
```

The tests: `supabase/tests/weekly_notes_visitors_regressions.sql` (the database rules), `src/lib/__tests__/weeklyNotesVisitors.test.js` (the note files, send-email's visitor branch, the one-click stop and the form function), `src/pages/__tests__/WeeklyNotes.test.jsx` (the form, the confirm page, the prompt) and the visitor cases in `src/pages/__tests__/Unsubscribe.test.jsx` and `src/lib/__tests__/privacyPolicy.test.js`.
